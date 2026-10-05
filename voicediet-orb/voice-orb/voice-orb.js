// VoiceDiet Orb — анимированная сфера для экрана голосового ввода.
//
// Использует существующую модель без изменений: export/voicediet_orb.glb
// (ядро-сфера + 10 242 точки икосферы с атрибутом _REST_DIR) и параметры шейдера
// ядра viewer/core_params.json. Вид ядра и мягкие точки — те же формулы, что в viewer/orb.js.
//
// Движение:
//  • ядро — вращается внутренняя окраска (маджента/фиолет), блики и край привязаны к камере;
//  • сетка — точки смещаются только вдоль своего луча: r' = r·(1 + f(rest_dir)), f — гладкое поле
//    бегущих сферических волн, поэтому соседние точки связаны и не пересекаются;
//  • импульсы — бегут по 30 рёбрам икосаэдра (реальные ряды точек решётки) между 12 пятиугольными узлами.
// Всё зависит от времени (dt), фазы и угол ядра накапливаются и не сбрасываются при смене состояний.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ROOT = new URL('../', import.meta.url);
const REF_FRAME = 1024;            // кадр референса, px
const DOT_SIGMA_PX = 1.9;          // профиль точки по альфе PDF, px кадра референса
const SHELL_FRONT = 1.3;           // глубина передней поверхности оболочки (как в viewer/orb.js)
const LOOP_SECONDS = 16;           // цикл ожидания: оборот ядра и периоды волн кратны ему
const OMEGA0 = (2 * Math.PI) / LOOP_SECONDS;
const TAU = Math.PI * 2;

export const STATES = ['idle', 'listening', 'processing', 'ready'];

// Цели параметров по состояниям. Текущие значения плавно сходятся к ним.
const STATE_TARGETS = {
  idle:       { core: 1.0,  glow: 0.0,  amp: 1.0,  speed: 1.0, voice: 0, flow: 1 / 8, flowSpeed: 0.5, proc: 0 },
  listening:  { core: 1.7,  glow: 0.03, amp: 1.15, speed: 1.5, voice: 1, flow: 0.2,   flowSpeed: 0.75, proc: 0 },
  processing: { core: 1.25, glow: 0.03, amp: 0.55, speed: 0.8, voice: 0, flow: 0,     flowSpeed: 0.75, proc: 1 },
  ready:      { core: 1.0,  glow: 0.02, amp: 0.85, speed: 1.0, voice: 0, flow: 0,     flowSpeed: 0.5, proc: 0 },
};

export const DEFAULT_PARAMS = {
  coreSpeed: 1,        // множитель скорости вращения ядра
  shellAmplitude: 1,   // множитель амплитуды деформации сетки
  shellSpeed: 1,       // множитель скорости волн сетки
  pulseIntensity: 1,   // яркость импульсов по рёбрам (0 — выкл.)
  audioGain: 1,        // чувствительность к уровню голоса
};

// Константы поля деформации (доли радиуса).
const BASE_AMP = 0.012;            // ожидание: ±1.2 %
const VOICE_AMP = 0.03;            // добавка при громкой речи
const COUPLE_AMP = 0.01;           // отклик на ориентацию ядра (2-я гармоника)
const RIPPLE_AMP = 0.009;          // рябь от узла в обработке
const READY_AMP = 0.018;           // единственная волна «готово»
const READY_SECONDS = 1.8;
const CORE_TILT = THREE.MathUtils.degToRad(14);   // наклон окраски ядра при прецессии
const tiltAxis = new THREE.Vector3();

// Волны: направления, пространственная частота, целые множители частоты (для бесшовного цикла), вес.
const WAVES = [
  { k: [0.62, 0.55, 0.56], s: 2.2, m: 1, w: 0.30, p: 0.0 },
  { k: [-0.71, 0.21, 0.67], s: 2.7, m: -1, w: 0.25, p: 1.3 },
  { k: [0.12, -0.83, 0.54], s: 3.1, m: 2, w: 0.18, p: 2.1 },
  { k: [-0.35, -0.38, -0.86], s: 3.6, m: 1, w: 0.12, p: 4.0 },
  { k: [0.93, -0.12, -0.35], s: 4.0, m: -2, w: 0.09, p: 5.2 },
  { k: [-0.18, 0.95, -0.25], s: 4.5, m: 3, w: 0.06, p: 0.7 },
];
const VOICE_WAVES = [
  { k: [0.41, -0.64, 0.65], s: 5.5, m: 3, p: 0.4 },
  { k: [-0.77, -0.44, 0.46], s: 6.3, m: -4, p: 2.2 },
  { k: [0.28, 0.79, 0.54], s: 7.1, m: 5, p: 3.9 },
  { k: [-0.52, 0.48, -0.71], s: 5.9, m: -3, p: 5.5 },
];

function glslVec3Array(name, list) {
  return `const vec3 ${name}[${list.length}] = vec3[${list.length}](${list.map(w => {
    const l = Math.hypot(...w.k); return `vec3(${w.k.map(v => (v / l).toFixed(5)).join(',')})`;
  }).join(',')});`;
}
const f5 = v => v.toFixed(5);

function hexColor(h) { return new THREE.Color().setRGB(...[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)); }

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeInOut = x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const approach = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

// Критически демпфированная пружина: мягкое запаздывание без перерегулирования.
class Spring {
  constructor(value, omega) { this.x = value; this.v = 0; this.w = omega; }
  step(target, dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.w * this.w * (target - this.x) - 2 * this.w * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

// ---------- Решётка: 12 пятиугольных узлов и 30 рёбер икосаэдра ----------
function buildLattice(rest) {
  const n = rest.length / 3;
  const cell = 0.05;
  const key = (x, y, z) => `${x},${y},${z}`;
  const grid = new Map();
  const ci = v => Math.floor((v + 1.1) / cell);
  for (let i = 0; i < n; i++) {
    const k = key(ci(rest[3 * i]), ci(rest[3 * i + 1]), ci(rest[3 * i + 2]));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const pent = [];
  for (let i = 0; i < n; i++) {
    const x = rest[3 * i], y = rest[3 * i + 1], z = rest[3 * i + 2];
    const cx = ci(x), cy = ci(y), cz = ci(z);
    const d = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const list = grid.get(key(cx + a, cy + b, cz + c));
      if (!list) continue;
      for (const j of list) {
        if (j === i) continue;
        const dd = Math.hypot(rest[3 * j] - x, rest[3 * j + 1] - y, rest[3 * j + 2] - z);
        if (dd < cell) d.push(dd);
      }
    }
    d.sort((p, q) => p - q);
    if (d.length && d.filter(v => v < d[0] * 1.45).length === 5) pent.push(i);
  }
  const P = pent.map(i => new THREE.Vector3(rest[3 * i], rest[3 * i + 1], rest[3 * i + 2]));
  const edges = [];
  const adj = P.map(() => []);
  for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
    if (P[a].dot(P[b]) > Math.cos(THREE.MathUtils.degToRad(70))) {
      adj[a].push(b); adj[b].push(a);
      edges.push({ a, b, id: edges.length, n: new THREE.Vector3().crossVectors(P[a], P[b]).normalize(), ang: P[a].angleTo(P[b]) });
    }
  }
  const edgeAttr = new Float32Array(n * 2).fill(-1);
  const nodeAttr = new Float32Array(n * 2).fill(-1);
  const r = new THREE.Vector3();
  let onEdges = 0;
  for (let i = 0; i < n; i++) {
    r.set(rest[3 * i], rest[3 * i + 1], rest[3 * i + 2]);
    for (const e of edges) {
      if (Math.abs(r.dot(e.n)) > 0.006) continue;
      const ca = Math.cos(e.ang) - 1e-4;
      if (r.dot(P[e.a]) < ca || r.dot(P[e.b]) < ca) continue;
      edgeAttr[2 * i] = e.id;
      edgeAttr[2 * i + 1] = clamp01(r.angleTo(P[e.a]) / e.ang);
      onEdges++;
      break;
    }
    let best = -1, bestAng = 9;
    for (let p = 0; p < P.length; p++) { const ang = r.angleTo(P[p]); if (ang < bestAng) { bestAng = ang; best = p; } }
    if (bestAng < 0.1) { nodeAttr[2 * i] = best; nodeAttr[2 * i + 1] = Math.exp(-((bestAng / 0.055) ** 2)); }
  }
  const edgeIndex = new Map(edges.map(e => [e.a * 16 + e.b, e]));
  return { P, edges, adj, edgeIndex, edgeAttr, nodeAttr, onEdges, ok: pent.length === 12 && edges.length === 30 };
}

// ---------- Материалы ----------
function coreMaterial(p) {
  const u = {
    colorLight: { value: hexColor(p.colorLight) }, colorDeep: { value: hexColor(p.colorDeep) },
    colorViolet: { value: hexColor(p.colorViolet) }, colorGlow: { value: hexColor(p.colorGlow) },
    colorSpec: { value: hexColor(p.colorSpec) }, colorRim: { value: hexColor(p.colorRim) },
    dirDeep: { value: new THREE.Vector3(...p.dirDeep) }, deepThreshold: { value: p.deepThreshold },
    deepWidth: { value: p.deepWidth }, deepAmount: { value: p.deepAmount },
    violetCenter: { value: new THREE.Vector2(...p.violetCenter) }, violetSize: { value: p.violetSize },
    violetAmount: { value: p.violetAmount },
    glowCenter: { value: new THREE.Vector2(...p.glowCenter) }, glowSize: { value: p.glowSize },
    glowIntensity: { value: p.glowIntensity }, haloSize: { value: p.haloSize }, haloIntensity: { value: p.haloIntensity },
    specCenter: { value: new THREE.Vector2(...p.specCenter) }, specSize: { value: new THREE.Vector2(...p.specSize) },
    specRotation: { value: p.specRotation }, specIntensity: { value: p.specIntensity },
    glowShape: { value: p.glowShape ?? 1 }, specShape: { value: p.specShape ?? 1 },
    fresnelPower: { value: p.fresnelPower }, rimAmount: { value: p.rimAmount }, rimTransparency: { value: p.rimTransparency },
    uBodyRot: { value: new THREE.Matrix3() },   // вращение внутренней окраски (view space)
    uGlowGain: { value: 1 },                    // «активность» ядра: лёгкое усиление ореола
  };
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: true,
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 colorLight, colorDeep, colorViolet, colorGlow, colorSpec, colorRim, dirDeep;
      uniform vec2 violetCenter, glowCenter, specCenter, specSize;
      uniform float deepThreshold, deepWidth, deepAmount, violetSize, violetAmount, glowSize, glowIntensity,
                    haloSize, haloIntensity, specRotation, specIntensity, fresnelPower, rimAmount, rimTransparency,
                    glowShape, specShape, uGlowGain;
      uniform mat3 uBodyRot;
      varying vec3 vN;
      varying vec3 vV;
      float g2(vec2 d, float s) { return exp(-0.5 * dot(d, d) / (s * s)); }
      vec3 screenBlend(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        // окраска массы ядра вращается, освещение (ореол, блик, край) — нет
        vec3 nb = uBodyRot * n;
        vec3 c = colorLight;
        float kd = deepAmount / (1.0 + exp(-(dot(nb, dirDeep) - deepThreshold) / deepWidth));
        c = mix(c, colorDeep, clamp(kd, 0.0, 1.0));
        c = mix(c, colorViolet, clamp(violetAmount * g2(nb.xy - violetCenter, violetSize), 0.0, 1.0));
        vec2 gd = n.xy - glowCenter;
        float g = glowIntensity * exp(-0.5 * pow(dot(gd, gd) / (glowSize * glowSize) + 1e-9, glowShape))
                + haloIntensity * g2(gd, haloSize);
        c = screenBlend(c, colorGlow * min(g * uGlowGain, 1.0));
        float cr = cos(specRotation), sr = sin(specRotation);
        vec2 sd = n.xy - specCenter;
        vec2 q = vec2(cr * sd.x + sr * sd.y, -sr * sd.x + cr * sd.y) / specSize;
        c = screenBlend(c, colorSpec * clamp(specIntensity * exp(-0.5 * pow(dot(q, q) + 1e-9, specShape)), 0.0, 1.0));
        float fres = pow(clamp(1.0 - dot(n, normalize(vV)), 0.0, 1.0), fresnelPower);
        c = mix(c, colorRim, clamp(rimAmount * fres, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0 - rimTransparency * fres);
      }`,
  });
}

function shellMaterial(rimColor) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 1 }, uRefDist: { value: 4 }, uSigma: { value: DOT_SIGMA_PX },
      uPh: { value: new Float32Array(WAVES.length) }, uPhV: { value: new Float32Array(VOICE_WAVES.length) },
      uAmp: { value: BASE_AMP }, uVoiceAmp: { value: 0 }, uCoupleAmp: { value: COUPLE_AMP },
      uLagAxis: { value: new THREE.Vector3(0, -1, 0) },
      uRipple: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
      uRippleAmp: { value: new Float32Array(4) },
      uReady: { value: new THREE.Vector3() },          // фронт (рад), амплитуда, подсветка
      uPulse: { value: Array.from({ length: 8 }, () => new THREE.Vector4(-9, 1, 0, 0)) },
      uNode: { value: new Float32Array(12) },
      uPulseColor: { value: hexColor(rimColor) },
    },
    transparent: true, depthWrite: false, depthTest: true,
    vertexShader: /* glsl */`
      attribute vec3 _rest_dir;
      attribute vec2 aEdge;   // ребро икосаэдра (-1 — нет), позиция 0..1 вдоль ребра
      attribute vec2 aNode;   // ближайший пятиугольный узел (-1 — далеко), вес
      uniform float uScale, uRefDist, uSigma, uAmp, uVoiceAmp, uCoupleAmp;
      uniform float uPh[${WAVES.length}];
      uniform float uPhV[${VOICE_WAVES.length}];
      uniform vec3 uLagAxis, uReady;
      uniform vec4 uRipple[4];
      uniform float uRippleAmp[4];
      uniform vec4 uPulse[8];
      uniform float uNode[12];
      varying float vSize, vSigma, vGlow, vAlphaK;
      ${glslVec3Array('K', WAVES)}
      ${glslVec3Array('KV', VOICE_WAVES)}
      const float S[${WAVES.length}] = float[${WAVES.length}](${WAVES.map(w => f5(w.s)).join(',')});
      const float W[${WAVES.length}] = float[${WAVES.length}](${WAVES.map(w => f5(w.w)).join(',')});
      const float SV[${VOICE_WAVES.length}] = float[${VOICE_WAVES.length}](${VOICE_WAVES.map(w => f5(w.s)).join(',')});
      void main() {
        vec3 d = normalize(mat3(modelMatrix) * _rest_dir);   // направление недеформированной сферы в мире
        float f = 0.0;
        for (int i = 0; i < ${WAVES.length}; i++) f += W[i] * sin(S[i] * dot(K[i], d) + uPh[i]);
        f *= uAmp;
        float v = 0.0;
        for (int i = 0; i < ${VOICE_WAVES.length}; i++) v += sin(SV[i] * dot(KV[i], d) + uPhV[i]);
        f += uVoiceAmp * 0.25 * v;
        float x = dot(d, uLagAxis);
        f += uCoupleAmp * (1.5 * x * x - 0.5);
        for (int i = 0; i < 4; i++) {
          float a = acos(clamp(dot(d, uRipple[i].xyz), -1.0, 1.0)) - uRipple[i].w;
          f += uRippleAmp[i] * exp(-a * a / 0.05);
        }
        float th = acos(clamp(d.z, -1.0, 1.0)) - uReady.x;      // угол от центра кадра
        float band = exp(-th * th / 0.12);
        f += uReady.y * band;

        // импульсы по рёбрам и узлам
        float glow = 0.0;
        for (int i = 0; i < 8; i++) {
          vec4 p = uPulse[i];
          if (p.w <= 0.0 || abs(aEdge.x - p.x) > 0.5) continue;
          float u = p.y > 0.0 ? aEdge.y : 1.0 - aEdge.y;
          float dd = p.z - u;                                     // >0 — позади головки
          glow += p.w * smoothstep(-0.035, 0.0, dd) * exp(-max(dd, 0.0) / 0.12);
        }
        if (aNode.x > -0.5) glow += uNode[int(aNode.x + 0.5)] * aNode.y;
        glow += uReady.z * band;
        vGlow = clamp(glow, 0.0, 1.5);

        vec4 mv = modelViewMatrix * vec4(position * (1.0 + f), 1.0);
        float sig = uSigma * uScale * (uRefDist / max(-mv.z, 0.01));
        vSigma = max(sig, 0.85);                    // точки мельче пикселя не рисуем «крошкой»…
        vAlphaK = (sig * sig) / (vSigma * vSigma);  // …а сохраняем их суммарную яркость
        vSigma *= 1.0 + 0.8 * min(vGlow, 1.3);
        vSize = vSigma * (6.0 + 8.0 * min(vGlow, 1.3));
        gl_PointSize = vSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uPulseColor;
      varying float vSize, vSigma, vGlow, vAlphaK;
      void main() {
        float r = length(gl_PointCoord - 0.5) * vSize;
        float a = exp(-0.5 * r * r / (vSigma * vSigma));
        float s2 = vSigma * 3.0;
        a += 0.4 * min(vGlow, 1.0) * exp(-0.5 * r * r / (s2 * s2));     // мягкий ореол только у светящихся точек
        a = min(a * vAlphaK, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(vec3(1.0), uPulseColor, 0.35 * min(vGlow, 1.0)), a);
      }`,
  });
}

// ---------- Тестовый сигнал «речи» (явно обозначается в UI) ----------
export function testSignal(t) {
  const P = 6.4;
  const x = ((t % P) + P) % P;
  const seg = (a, b) => smooth((x - a) / 0.15) * (1 - smooth((x - b) / 0.25));
  const gate = Math.max(seg(0.2, 2.5), 0.8 * seg(3.3, 5.4));
  const syl = Math.pow(Math.sin(TAU * 2.05 * t), 2) * (0.75 + 0.25 * Math.sin(TAU * 0.63 * t + 1.1))
            + 0.25 * Math.pow(Math.sin(TAU * 3.3 * t + 0.6), 2);
  return gate * (0.3 + 0.55 * Math.min(syl, 1));
}

// ---------- Компонент ----------
export async function createVoiceOrb(container, options = {}) {
  const opt = {
    modelUrl: new URL('export/voicediet_orb.glb', ROOT).href,
    coreParamsUrl: new URL('viewer/core_params.json', ROOT).href,
    fit: 0.9,                 // доля стороны контейнера под кадр референса (оболочка ≈ 0.93 кадра)
    maxPixelRatio: 2,
    reducedMotion: 'auto',    // 'auto' | true | false
    manual: false,            // true — без rAF, кадры двигает вызывающий код (advance/render)
    seed: 7,
    autoIdleAfterReady: true,
    params: {},
    ...options,
  };
  const params = { ...DEFAULT_PARAMS, ...opt.params };
  const rand = mulberry32(opt.seed);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: opt.manual });
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);

  const [gltf, coreParams] = await Promise.all([
    new GLTFLoader().loadAsync(opt.modelUrl),
    fetch(opt.coreParamsUrl).then(r => r.json()),
  ]);
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  const core = gltf.scene.getObjectByName('VD_Core');
  const shellNode = gltf.scene.getObjectByName('VD_Shell');
  let points = null;
  shellNode.traverse(o => { if (o.isPoints) points = o; });
  const refCam = gltf.cameras[0] ?? gltf.scene.getObjectByName('VD_Camera');
  refCam.updateMatrixWorld(true);
  camera.position.setFromMatrixPosition(refCam.matrixWorld);
  camera.quaternion.setFromRotationMatrix(refCam.matrixWorld);
  const refDist = camera.position.length();

  const coreMat = coreMaterial(coreParams);
  core.material = coreMat;
  core.renderOrder = 0;
  const shellMat = shellMaterial(coreParams.colorRim);
  shellMat.uniforms.uRefDist.value = refDist - SHELL_FRONT;
  const geo = points.geometry;
  const lattice = buildLattice(geo.getAttribute('_rest_dir').array);
  geo.setAttribute('aEdge', new THREE.BufferAttribute(lattice.edgeAttr, 2));
  geo.setAttribute('aNode', new THREE.BufferAttribute(lattice.nodeAttr, 2));
  points.material = shellMat;
  points.renderOrder = 1;
  points.frustumCulled = false;

  // узлы в мировых координатах (для выбора видимых маршрутов)
  const shellRot = new THREE.Matrix3().setFromMatrix4(points.matrixWorld);
  const nodesW = lattice.P.map(p => p.clone().applyMatrix3(shellRot).normalize());

  // Вращение ядра — прецессия: окраска наклонена на CORE_TILT, ось наклона обходит круг
  // в плоскости кадра. Каждая цветовая зона описывает малую окружность и остаётся у своего
  // места макета; полный оборот за 16 с в ожидании.
  const dirDeep = new THREE.Vector3(...coreParams.dirDeep).normalize();

  // ---------- состояние движения ----------
  const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = opt.reducedMotion === 'auto' ? !!reduceQuery?.matches : !!opt.reducedMotion;
  const onReduceChange = e => { if (opt.reducedMotion === 'auto') reduced = e.matches; };
  reduceQuery?.addEventListener?.('change', onReduceChange);

  let state = 'idle';
  const cur = { ...STATE_TARGETS.idle };
  const curSprings = Object.fromEntries(Object.keys(cur).map(k => [k, new Spring(cur[k], k === 'voice' ? 6 : 4)]));
  let coreAngle = 0;                 // угол окраски ядра, рад (накапливается)
  let masterPhase = 0;               // фаза волн сетки (накапливается)
  let voicePhase = 0;
  const lagCore = new Spring(1, 4);              // скорость ядра → сетка, задержка ≈0.5 с
  // старт пружины с положения полюса в момент t = 0, чтобы цикл ожидания был бесшовным
  const pole0 = dirDeep.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), CORE_TILT));
  const lagAxis = [0, 1, 2].map(i => new Spring(pole0.getComponent(i), 2.6));
  {
    // прогрев пружины на двух циклах ожидания: при t = 0 она уже в установившемся режиме
    const q = new THREE.Quaternion(), pv = new THREE.Vector3(), ax = new THREE.Vector3();
    for (let t = 0; t < 2 * LOOP_SECONDS; t += 1 / 60) {
      q.setFromAxisAngle(ax.set(Math.cos(OMEGA0 * t), Math.sin(OMEGA0 * t), 0), CORE_TILT);
      pv.copy(dirDeep).applyQuaternion(q);
      lagAxis.forEach((sp, i) => sp.step(pv.getComponent(i), 1 / 60));
    }
  }
  const levelSpring = new Spring(0, 9);
  let env = 0;                       // огибающая аудио
  let rawLevel = 0;
  let audioSource = 'none';          // 'none' | 'test' | 'mic' | 'external'
  let testClock = 0;
  let mic = null;
  let readyT = -1;
  let time = 0;

  const walkers = [];                // импульсы «поток»
  let flowAcc = 0.75;                // импульсы ожидания на 2-й и 10-й с цикла, оба гаснут до 16-й
  let spawnCount = 0;
  const relays = [];                 // эстафеты обработки
  const ripples = [];
  const nodeKick = new Float32Array(12);    // энергия, переданная узлу импульсом
  const nodeGlow = new Float32Array(12);    // видимое свечение: мягко нарастает за ~0.1 с и гаснет

  const listeners = new Map();
  const emit = (ev, data) => (listeners.get(ev) || []).forEach(fn => fn(data));

  function pickStart() {
    // старт с видимых узлов (впереди ядра)
    const w = nodesW.map(p => (p.z > -0.25 ? p.z + 0.6 : 0));
    return weightedPick(w);
  }
  function weightedPick(w) {
    const sum = w.reduce((a, b) => a + b, 0);
    let r = rand() * sum;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return w.length - 1;
  }
  function extendRoute(route, count) {
    while (route.length < count) {
      const last = route[route.length - 1], prev = route[route.length - 2];
      // только видимые узлы: перед ядром и на кромке силуэта (задние закрыты ядром)
      let cand = lattice.adj[last].filter(j => j !== prev && nodesW[j].z > -0.25);
      if (!cand.length) cand = lattice.adj[last].filter(j => j !== prev);
      route.push(cand[weightedPick(cand.map(j => (nodesW[j].z + 1.25) ** 2))]);
    }
  }
  function edgeSlot(a, b) {
    const e = a < b ? lattice.edgeIndex.get(a * 16 + b) : lattice.edgeIndex.get(b * 16 + a);
    return { id: e.id, dir: a < b ? 1 : -1 };
  }

  function spawnFlow(speed) {
    const route = [pickStart()];
    extendRoute(route, 4);
    const len = 1.6 + rand() * 0.8;
    walkers.push({ route, head: 0, len, speed, amp: 0, lastNode: 0 });
    if (walkers.length > 3) walkers.shift();
    spawnCount++;
  }

  function startRelays() {
    relays.length = 0;
    for (let k = 0; k < 2; k++) {
      const route = [pickStart()];
      extendRoute(route, 8);
      relays.push({ route, beat: -0.5 * k, arrived: -1 });
    }
  }

  // ---------- шаг симуляции ----------
  function advance(dt) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    time += dt;
    const rm = reduced;

    // параметры состояния плавно сходятся к цели
    // пружины, а не экспонента: непрерывны и значение, и скорость — без рывка в начале перехода
    const tgt = STATE_TARGETS[state];
    for (const k in cur) cur[k] = curSprings[k].step(tgt[k], dt);

    // аудио
    if (audioSource === 'test') { testClock += dt; rawLevel = testSignal(testClock); }
    else if (audioSource === 'mic' && mic) rawLevel = readMic();
    const a = clamp01(rawLevel * params.audioGain);
    env = approach(env, a, dt, a > env ? 0.05 : 0.3);
    const level = Math.max(0, levelSpring.step(env, dt));
    const voice = cur.voice * level;

    // ядро
    const motion = rm ? 0.35 : 1;
    const coreSpeed = OMEGA0 * params.coreSpeed * motion * (cur.core + 0.5 * voice);
    coreAngle = (coreAngle + coreSpeed * dt) % TAU;
    const lagSpeed = lagCore.step(coreSpeed / OMEGA0, dt);

    // сетка: скорость волн наполовину своя, наполовину — запаздывающая скорость ядра
    const waveSpeed = OMEGA0 * (0.5 * cur.speed * params.shellSpeed * (rm ? 0.5 : 1) + 0.5 * lagSpeed);
    masterPhase = (masterPhase + waveSpeed * dt) % TAU;
    voicePhase = (voicePhase + OMEGA0 * (1 + 2 * level) * dt) % TAU;

    // полюс маджента-зоны ядра → сетка догоняет его с задержкой
    const bodyQ = new THREE.Quaternion().setFromAxisAngle(
      tiltAxis.set(Math.cos(coreAngle), Math.sin(coreAngle), 0), CORE_TILT * (rm ? 0.6 : 1));
    const pole = dirDeep.clone().applyQuaternion(bodyQ);
    const lag = new THREE.Vector3(...lagAxis.map((s, i) => s.step(pole.getComponent(i), dt))).normalize();

    // поток импульсов
    const pulseOn = !rm && params.pulseIntensity > 0;
    flowAcc += dt * (cur.flow + 0.9 * voice);
    if (flowAcc >= 1) { flowAcc -= 1; if (pulseOn) spawnFlow(cur.flowSpeed + 0.4 * voice); }
    for (const w of walkers) {
      w.head += w.speed * dt;
      const life = w.head / w.len;
      w.amp = smooth(life / 0.15) * (1 - smooth((life - 0.75) / 0.25));
      const ni = Math.floor(w.head);
      if (ni > w.lastNode) { w.lastNode = ni; nodeKick[w.route[ni]] = Math.max(nodeKick[w.route[ni]], 0.55 * w.amp); }
      extendRoute(w.route, Math.floor(w.head) + 3);
    }
    for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].head > walkers[i].len + 0.4) walkers.splice(i, 1);

    // эстафета обработки: прыжок по ребру с easing, пауза на узле
    if (cur.proc > 0.003) {
      if (!relays.length) startRelays();
      for (const r of relays) {
        r.beat += dt / 0.9;
        const idx = Math.floor(r.beat);
        extendRoute(r.route, Math.max(idx, 0) + 3);
        const frac = r.beat - idx;
        if (r.beat >= 0 && frac >= 0.55 && r.arrived !== idx) {
          r.arrived = idx;
          const node = r.route[idx + 1];
          nodeKick[node] = Math.max(nodeKick[node], 1.3 * cur.proc);
          if (!rm) ripples.push({ dir: nodesW[node], t: 0, amp: cur.proc });
          if (ripples.length > 4) ripples.shift();
        }
      }
    } else if (relays.length) relays.length = 0;
    for (const rp of ripples) rp.t += dt;
    for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].t > 2.5) ripples.splice(i, 1);
    for (let i = 0; i < 12; i++) {
      nodeKick[i] *= Math.exp(-dt / 0.35);
      nodeGlow[i] = approach(nodeGlow[i], nodeKick[i], dt, 0.12);
    }

    // «готово»: одна волна от центра к краю
    let readyFront = 0, readyAmp = 0, readyGlow = 0;
    if (readyT >= 0) {
      readyT += dt;
      const p = readyT / READY_SECONDS;
      const envR = Math.sin(Math.PI * clamp01(p)) ** 2;
      readyFront = rm ? 1.1 : 1.9 * (0.5 - 0.5 * Math.cos(Math.PI * clamp01(p)));   // упрощённо: свечение без бега
      readyAmp = rm ? 0 : READY_AMP * envR;
      readyGlow = 0.35 * envR * params.pulseIntensity;
      if (p >= 1) {
        readyT = -1;
        if (opt.autoIdleAfterReady && state === 'ready') setState('idle');
      }
    }

    // ---------- uniforms ----------
    coreMat.uniforms.uBodyRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(bodyQ.clone().invert()));
    coreMat.uniforms.uGlowGain.value = 1 + cur.glow + 0.03 * voice;

    const u = shellMat.uniforms;
    WAVES.forEach((w, i) => { u.uPh.value[i] = w.m * masterPhase + w.p; });
    VOICE_WAVES.forEach((w, i) => { u.uPhV.value[i] = w.m * voicePhase + w.p; });
    const ampK = params.shellAmplitude * (rm ? 0.4 : 1);
    u.uAmp.value = BASE_AMP * ampK * cur.amp * (1 + 0.6 * voice);
    u.uVoiceAmp.value = VOICE_AMP * ampK * voice;
    u.uCoupleAmp.value = COUPLE_AMP * ampK;
    u.uLagAxis.value.copy(lag);
    for (let i = 0; i < 4; i++) {
      const rp = ripples[i];
      if (rp) {
        u.uRipple.value[i].set(rp.dir.x, rp.dir.y, rp.dir.z, 0.15 + 1.1 * rp.t);
        u.uRippleAmp.value[i] = RIPPLE_AMP * ampK * rp.amp * Math.exp(-rp.t / 0.8) * smooth(rp.t / 0.3);
      } else u.uRippleAmp.value[i] = 0;
    }
    u.uReady.value.set(readyFront, readyAmp * ampK, readyGlow);

    const slots = u.uPulse.value;
    let s = 0;
    const put = (a, b, head, amp) => {
      if (s >= 8 || amp <= 0.001) return;
      const e = edgeSlot(a, b);
      slots[s++].set(e.id, e.dir, head, amp);
    };
    const gain = params.pulseIntensity;
    for (const r of relays) {
      if (r.beat < 0) continue;
      const idx = Math.floor(r.beat);
      const head = easeInOut((r.beat - idx) / 0.55);
      const amp = 1.4 * cur.proc * gain * (rm ? 0 : 1);
      put(r.route[idx], r.route[idx + 1], head, amp);
      if (idx > 0) put(r.route[idx - 1], r.route[idx], head + 1, amp);
    }
    for (const w of walkers) {
      const idx = Math.floor(w.head);
      const amp = w.amp * gain * 0.85;
      put(w.route[idx], w.route[idx + 1], w.head - idx, amp);
      if (idx > 0) put(w.route[idx - 1], w.route[idx], w.head - idx + 1, amp);
    }
    for (; s < 8; s++) slots[s].w = 0;
    for (let i = 0; i < 12; i++) u.uNode.value[i] = nodeGlow[i] * gain;

    return { level, env, raw: rawLevel };
  }

  function readMic() {
    mic.analyser.getFloatTimeDomainData(mic.buf);
    let sum = 0;
    for (let i = 0; i < mic.buf.length; i++) sum += mic.buf[i] * mic.buf[i];
    const db = 20 * Math.log10(Math.sqrt(sum / mic.buf.length) + 1e-8);
    return clamp01((db + 58) / 40);
  }

  // ---------- размер ----------
  let side = 1;
  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, opt.maxPixelRatio);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    side = Math.min(w, h) * opt.fit;
    camera.aspect = w / h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * h / side));
    camera.updateProjectionMatrix();
    shellMat.uniforms.uScale.value = side * pr / REF_FRAME;
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  ro?.observe(container);
  resize();

  function render() { renderer.render(scene, camera); }

  // ---------- цикл ----------
  let raf = 0, last = null, running = false, visible = true, onScreen = true, userPaused = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last == null ? 0 : (now - last) / 1000;
    last = now;
    lastInfo = advance(Math.min(dt, 0.1));   // при просадке fps — время идёт честно, длинные паузы не прыгают
    render();
  }
  let lastInfo = { level: 0, env: 0, raw: 0 };
  function updateRunning() {
    const should = !opt.manual && visible && onScreen && !userPaused && !disposed;
    if (should && !running) { running = true; last = null; raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }
  const onVis = () => { visible = document.visibilityState !== 'hidden'; updateRunning(); };
  document.addEventListener('visibilitychange', onVis);
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; updateRunning(); }) : null;
  io?.observe(container);
  let disposed = false;
  advance(0);
  render();
  updateRunning();

  // ---------- API ----------
  function setState(next) {
    if (!STATES.includes(next) || next === state) return;
    const prev = state;
    state = next;
    if (next === 'ready') readyT = 0;
    emit('state', { state: next, prev });
  }

  const api = {
    get state() { return state; },
    get reducedMotion() { return reduced; },
    get audioSource() { return audioSource; },
    get audioLevel() { return lastInfo.level; },
    get time() { return time; },
    debugNodes: () => nodesW.map(v => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]),
    debugRelays: () => relays.map(r => ({ beat: +r.beat.toFixed(2), route: r.route.slice(0, 8) })),
    lattice: { pentagons: lattice.P.length, edges: lattice.edges.length, pointsOnEdges: lattice.onEdges, ok: lattice.ok },
    setState,
    setParams(p) { Object.assign(params, p); },
    getParams() { return { ...params }; },
    setReducedMotion(v) { opt.reducedMotion = v; reduced = v === 'auto' ? !!reduceQuery?.matches : !!v; },
    /** Внешний уровень голоса 0..1 (например, из вашего аудио-конвейера). */
    setAudioLevel(v) { if (audioSource !== 'mic' && audioSource !== 'test') audioSource = 'external'; rawLevel = clamp01(v); },
    useTestSignal(on = true) {
      if (on) { stopMic(); audioSource = 'test'; testClock = 0; }
      else if (audioSource === 'test') { audioSource = 'none'; rawLevel = 0; }
    },
    async connectMicrophone() {
      stopMic();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      mic = { stream, ctx, analyser, buf: new Float32Array(analyser.fftSize) };
      audioSource = 'mic';
    },
    disconnectAudio() { stopMic(); audioSource = 'none'; rawLevel = 0; },
    on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, []); listeners.get(ev).push(fn); return () => api.off(ev, fn); },
    off(ev, fn) { const l = listeners.get(ev); if (l) listeners.set(ev, l.filter(f => f !== fn)); },
    pause() { userPaused = true; updateRunning(); },
    resume() { userPaused = false; updateRunning(); },
    /** Ручной режим (manual: true): шаг по времени и отрисовка. */
    advance(dt) { lastInfo = advance(dt); return lastInfo; },
    render,
    resize,
    canvas,
    dispose() {
      if (disposed) return;
      disposed = true;
      updateRunning();
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      reduceQuery?.removeEventListener?.('change', onReduceChange);
      ro?.disconnect(); io?.disconnect();
      stopMic();
      scene.traverse(o => {
        o.geometry?.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      listeners.clear();
    },
  };
  function stopMic() {
    if (!mic) return;
    mic.stream.getTracks().forEach(t => t.stop());
    mic.ctx.close();
    mic = null;
    if (audioSource === 'mic') { audioSource = 'none'; rawLevel = 0; }
  }
  return api;
}
