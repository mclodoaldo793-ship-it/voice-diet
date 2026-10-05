// VoiceDiet Orb — интерактивный просмотр GLB.
// GLB хранит геометрию (ядро-сфера, облако точек оболочки, камеру референса).
// Вид ядра (градиенты, блики, френель в пространстве камеры) и мягкие точки
// в glTF не описываются — здесь они воспроизводятся шейдерами по тем же
// параметрам, что и в Blender (core_params.json = build/core_fit.json).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const qs = new URLSearchParams(location.search);
const CAPTURE = qs.has('capture');           // кадр 1024x1024 с ракурса референса, без UI
const LAYER = qs.get('layer') || 'all';      // all | core | shell
const REF_FRAME = 1024;                      // кадр референса, px
const DOT_SIGMA_PX = 1.9;                    // профиль точки (замер по альфе PDF), px кадра
const SHELL_FRONT = 1.3;                     // передняя поверхность оболочки ближе центра на ~1.3:
                                             // на ней в ракурсе референса точка имеет σ = 1.9 px

if (CAPTURE) {
  document.body.classList.add('capture');
  if (qs.get('bg') === 'ref') document.body.classList.add('bg-ref');
}

const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: CAPTURE });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(CAPTURE ? 1 : Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
let refDist = 5.37;

function hexColor(h) { return new THREE.Color().setRGB(...[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)); }

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
  };
  // Цвета в uniforms - сырые sRGB-числа (uniform передаётся без конвертации);
  // формула считается в sRGB и пишется в буфер без colorspace-преобразования.
  return new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: true,
    vertexShader: /* glsl */`
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;                                   // к камере, view space
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 colorLight, colorDeep, colorViolet, colorGlow, colorSpec, colorRim, dirDeep;
      uniform vec2 violetCenter, glowCenter, specCenter, specSize;
      uniform float deepThreshold, deepWidth, deepAmount, violetSize, violetAmount, glowSize, glowIntensity,
                    haloSize, haloIntensity, specRotation, specIntensity, fresnelPower, rimAmount, rimTransparency,
                    glowShape, specShape;
      varying vec3 vN;
      varying vec3 vV;
      float g2(vec2 d, float s) { return exp(-0.5 * dot(d, d) / (s * s)); }
      vec3 screenBlend(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 c = colorLight;
        float kd = deepAmount / (1.0 + exp(-(dot(n, dirDeep) - deepThreshold) / deepWidth));
        c = mix(c, colorDeep, clamp(kd, 0.0, 1.0));
        c = mix(c, colorViolet, clamp(violetAmount * g2(n.xy - violetCenter, violetSize), 0.0, 1.0));
        vec2 gd = n.xy - glowCenter;
        float g = glowIntensity * exp(-0.5 * pow(dot(gd, gd) / (glowSize * glowSize) + 1e-9, glowShape))
                + haloIntensity * g2(gd, haloSize);
        c = screenBlend(c, colorGlow * min(g, 1.0));
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

function dotMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 1 },          // px экрана на px кадра референса
      uRefDist: { value: refDist },
      uSigma: { value: DOT_SIGMA_PX },
      uColor: { value: new THREE.Color(1, 1, 1) },
    },
    transparent: true, depthWrite: false, depthTest: true,
    vertexShader: /* glsl */`
      uniform float uScale, uRefDist, uSigma;
      varying float vSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // размер как в кадре референса, с перспективой относительно дистанции референса
        vSize = uSigma * 6.0 * uScale * (uRefDist / max(-mv.z, 0.01));
        gl_PointSize = vSize;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vSize;
      void main() {
        float r = length(gl_PointCoord - 0.5) * vSize;          // px от центра
        float s = vSize / 6.0;                                   // спрайт = 6 сигм
        float a = exp(-0.5 * r * r / (s * s));
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

let core, shell, dotMat, refCamera;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !CAPTURE;
controls.enablePan = false;
controls.minDistance = 2.4;
controls.maxDistance = 12;
controls.autoRotateSpeed = 0.6;

// сторона квадрата кадра референса на экране: в просмотре оставляем место под панель снизу
function frameSide() { return CAPTURE ? REF_FRAME : Math.max(240, Math.min(innerWidth - 32, innerHeight - 180)); }

function resize() {
  const w = CAPTURE ? REF_FRAME : innerWidth;
  const h = CAPTURE ? REF_FRAME : innerHeight;
  renderer.setSize(w, h, !CAPTURE);
  camera.aspect = w / h;
  // кадр референса (FOV 30° на сторону квадрата) вписан в frameSide() по центру экрана
  const side = frameSide();
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) * h / side));
  camera.updateProjectionMatrix();
  document.getElementById('overlay').style.width = document.getElementById('overlay').style.height = side + 'px';
  if (dotMat) dotMat.uniforms.uScale.value = side * renderer.getPixelRatio() / REF_FRAME;
}

function toReferenceView() {
  camera.position.copy(refCamera.position);
  camera.quaternion.copy(refCamera.quaternion);
  controls.target.set(0, 0, 0);
  camera.up.set(0, 1, 0);
  controls.update();
}

const loader = new GLTFLoader();
const [gltf, params] = await Promise.all([
  loader.loadAsync('../export/voicediet_orb.glb'),
  fetch('./core_params.json').then(r => r.json()),
]);
scene.add(gltf.scene);
gltf.scene.updateMatrixWorld(true);
core = gltf.scene.getObjectByName('VD_Core');
shell = gltf.scene.getObjectByName('VD_Shell');
refCamera = gltf.cameras[0] ?? gltf.scene.getObjectByName('VD_Camera');
refCamera.updateMatrixWorld(true);
refCamera.position.setFromMatrixPosition(refCamera.matrixWorld);
refCamera.quaternion.setFromRotationMatrix(refCamera.matrixWorld);
refDist = refCamera.position.length();

core.material = coreMaterial(params);
core.renderOrder = 0;
dotMat = dotMaterial();
dotMat.uniforms.uRefDist.value = refDist - SHELL_FRONT;
shell.traverse(o => { if (o.isPoints) { o.material = dotMat; o.renderOrder = 1; o.frustumCulled = false; } });
if (LAYER === 'shell') core.material.colorWrite = false;    // ядро только перекрывает задние точки
if (LAYER === 'core') shell.visible = false;

resize();
toReferenceView();
// съёмка с других ракурсов: ?capture=1&az=90&el=20 (градусы, орбита вокруг центра)
if (qs.has('az') || qs.has('el')) {
  const az = THREE.MathUtils.degToRad(+qs.get('az') || 0), el = THREE.MathUtils.degToRad(+qs.get('el') || 0);
  camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(refDist);
  camera.lookAt(0, 0, 0);
  controls.update();
}
addEventListener('resize', resize);
statusEl.textContent = '';

if (!CAPTURE) {
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const overlay = document.getElementById('overlay');
  const range = document.getElementById('rOverlay');
  document.getElementById('btnRef').onclick = () => { controls.autoRotate = false; document.getElementById('tSpin').checked = false; toReferenceView(); };
  document.getElementById('tCore').onchange = e => { core.visible = e.target.checked; };
  document.getElementById('tShell').onchange = e => { shell.visible = e.target.checked; };
  document.getElementById('tSpin').onchange = e => { controls.autoRotate = e.target.checked; };
  range.oninput = () => {
    if (+range.value > 0) { controls.autoRotate = false; document.getElementById('tSpin').checked = false; toReferenceView(); }
    overlay.style.opacity = range.value / 100;
  };
}

function tick() {
  controls.update();
  renderer.render(scene, camera);
  if (!CAPTURE) requestAnimationFrame(tick);
}
tick();
window.__orbReady = true;
window.__orb = { scene, camera, core, shell, controls, renderer };
