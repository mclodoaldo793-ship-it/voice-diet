import React from 'react';
import {random} from 'remotion';
import {clamp01, EASE, lerp, tw} from '../lib/anim';
import {circlePath, deg, ngon, polyPath, type Pt} from '../lib/geom';
import type {TransitionSpec} from '../lib/timeline';

// Переходы. local = кадр относительно склейки (cut): окно [-pre, post).
// incoming — маска входящей сцены, outgoing — что происходит с уходящей,
// overlay — свет и линии поверх обеих.

export type Slice = {y0: number; y1: number; dx: number};
export type LayerFx = {style?: React.CSSProperties; slices?: Slice[]; hidden?: boolean};

const progress = (s: TransitionSpec, local: number) => clamp01((local + s.pre) / (s.pre + s.post));

const DIAG = deg(-28);
const DIAG_W = 150;
const diagOffset = (p: number) => {
  const n: Pt = [-Math.sin(DIAG), Math.cos(DIAG)];
  const D = Math.abs(960 * n[0]) + Math.abs(540 * n[1]);
  return lerp(-D - DIAG_W - 20, D + 20, EASE.inOutCubic(p));
};
const halfPlane = (d: number): Pt[] => {
  const u: Pt = [Math.cos(DIAG), Math.sin(DIAG)];
  const n: Pt = [-Math.sin(DIAG), Math.cos(DIAG)];
  const b: Pt = [960 + n[0] * d, 540 + n[1] * d];
  const L = 3000;
  return [
    [b[0] + u[0] * L, b[1] + u[1] * L],
    [b[0] - u[0] * L, b[1] - u[1] * L],
    [b[0] - u[0] * L - n[0] * L, b[1] - u[1] * L - n[1] * L],
    [b[0] + u[0] * L - n[0] * L, b[1] + u[1] * L - n[1] * L],
  ];
};
const band = (d0: number, d1: number): Pt[] => {
  const u: Pt = [Math.cos(DIAG), Math.sin(DIAG)];
  const n: Pt = [-Math.sin(DIAG), Math.cos(DIAG)];
  const L = 3000;
  const at = (d: number, s: number): Pt => [960 + n[0] * d + u[0] * s, 540 + n[1] * d + u[1] * s];
  return [at(d0, -L), at(d0, L), at(d1, L), at(d1, -L)];
};
const cssPoly = (pts: Pt[]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;

const columnsH = (p: number) =>
  Array.from({length: 12}, (_, i) => 1080 * EASE.outQuart(clamp01(p * 1.55 - i * 0.05)));

const blindsH = (p: number) =>
  Array.from({length: 12}, (_, j) => 90 * EASE.outCubic(clamp01(p * 1.5 - j * (0.5 / 11))));

const meltPath = (p: number, [ox, oy]: [number, number]) => {
  const R = lerp(0, 1420, EASE.inOutCubic(p));
  const pts: Pt[] = [];
  for (let i = 0; i < 180; i++) {
    const th = (i / 180) * Math.PI * 2;
    const k = 1 + 0.11 * Math.sin(5 * th + 7 * p) + 0.05 * Math.sin(9 * th - 11 * p) + 0.03 * Math.sin(15 * th + 5 * p);
    pts.push([ox + Math.cos(th) * R * k, oy + Math.sin(th) * R * k]);
  }
  return polyPath(pts);
};

type ShapeDef = {kind: 0 | 1 | 2; cx: number; cy: number; rot: number; delay: number; size: number};
const SHAPES: ShapeDef[] = Array.from({length: 18}, (_, i) => {
  const j = i % 6;
  const k = Math.floor(i / 6);
  const kind = ((i * 7) % 3) as 0 | 1 | 2;
  return {
    kind,
    cx: (j + 0.5) * 320 + (random(`sx${i}`) - 0.5) * 80,
    cy: (k + 0.5) * 360 + (random(`sy${i}`) - 0.5) * 80,
    rot: random(`sr${i}`) * 120,
    delay: random(`sd${i}`) * 0.38,
    size: kind === 0 ? 330 : kind === 1 ? 310 : 600,
  };
});
const backOut = (x: number) => {
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const shapePath = (s: ShapeDef, p: number, local: number) => {
  const q = clamp01((p - s.delay) / 0.6);
  const size = s.size * backOut(q);
  if (size <= 0.5) return '';
  const rot = deg(s.rot + local * 3);
  if (s.kind === 0) return circlePath(s.cx, s.cy, size);
  return polyPath(ngon(s.cx, s.cy, size, s.kind === 1 ? 4 : 3, rot));
};

const glitchSlices = (seed: string, intensity: number): Slice[] => {
  const n = 7;
  const cuts = Array.from({length: n - 1}, (_, i) => random(`${seed}c${i}`) * 1080).sort((a, b) => a - b);
  const edges = [0, ...cuts, 1080];
  return edges.slice(0, -1).map((y0, i) => ({
    y0,
    y1: edges[i + 1],
    dx: (random(`${seed}d${i}`) - 0.5) * 2 * 140 * intensity * (random(`${seed}m${i}`) > 0.35 ? 1 : 0.1),
  }));
};

export const incoming = (s: TransitionSpec, local: number): LayerFx => {
  const p = progress(s, local);
  const [ox, oy] = s.origin;
  if (local >= s.post) return {};
  switch (s.kind) {
    case 'iris': {
      const R = lerp(230, 1120, EASE.inOutCubic(p));
      return {style: {clipPath: `circle(${R.toFixed(1)}px at ${ox}px ${oy}px)`}};
    }
    case 'clock': {
      const a = 360 * EASE.inOutSine(p);
      if (a <= 0.01) return {hidden: true};
      const m = `conic-gradient(from 0deg at ${ox}px ${oy}px, #000 0deg ${a.toFixed(2)}deg, transparent ${(a + 0.6).toFixed(2)}deg 360deg)`;
      return {style: {maskImage: m, WebkitMaskImage: m}};
    }
    case 'diagonal':
      return {style: {clipPath: cssPoly(halfPlane(diagOffset(p)))}};
    case 'columns': {
      const hs = columnsH(p);
      const d = hs.map((h, i) => `M${i * 160} 0 H${(i + 1) * 160} V${h.toFixed(1)} H${i * 160} Z`).join(' ');
      return {style: {clipPath: `path('${d}')`}};
    }
    case 'halftone': {
      const cell = 40;
      const maxD = Math.hypot(Math.max(ox, 1920 - ox), Math.max(oy, 1080 - oy));
      const spread = 420;
      const front = p * (maxD + spread);
      let d = '';
      for (let j = 0; j < 27; j++) {
        for (let i = 0; i < 48; i++) {
          const cx = (i + 0.5) * cell;
          const cy = (j + 0.5) * cell;
          const q = clamp01((front - Math.hypot(cx - ox, cy - oy)) / spread);
          const r = q * q * (3 - 2 * q) * cell * 0.74;
          if (r > 0.4) d += circlePath(cx, cy, r);
        }
      }
      if (!d) return {hidden: true};
      return {style: {clipPath: `path('${d}')`}};
    }
    case 'melt':
      if (p <= 0) return {hidden: true};
      return {style: {clipPath: `path('${meltPath(p, s.origin)}')`}};
    case 'shapes': {
      if (p >= 0.999) return {};
      const d = SHAPES.map((sh) => shapePath(sh, p, local)).join(' ');
      if (!d.trim()) return {hidden: true};
      return {style: {clipPath: `path('${d}')`}};
    }
    case 'blinds': {
      const hs = blindsH(p);
      const d = hs
        .map((h, j) => {
          const yc = 45 + j * 90;
          return h > 0.2 ? `M0 ${(yc - h / 2).toFixed(1)} H1920 V${(yc + h / 2).toFixed(1)} H0 Z` : '';
        })
        .join(' ');
      if (!d.trim()) return {hidden: true};
      return {style: {clipPath: `path('${d}')`}};
    }
    case 'flash':
    case 'glitch':
    case 'crt':
      return local < 0 ? {hidden: true} : {};
    default:
      return {};
  }
};

export const outgoing = (s: TransitionSpec, local: number): LayerFx => {
  if (local < -s.pre) return {};
  switch (s.kind) {
    case 'glitch': {
      if (local >= 0) return {hidden: true};
      const k = tw(local, -s.pre, 0, 0.25, 1, EASE.inQuad);
      const f = Math.floor(local);
      return {
        slices: glitchSlices(`gl${f}`, k),
        style: {filter: `url(#rgbSplit${Math.min(3, Math.max(1, Math.round(k * 3)))})`},
      };
    }
    case 'crt': {
      if (local >= 0) return {hidden: true};
      const sy = local < -3 ? tw(local, -8, -3, 1, 0.006, EASE.inCubic) : 0.006;
      const sx = local < -3 ? 1 : tw(local, -3, 0, 1, 0.012, EASE.inCubic);
      return {
        style: {
          transform: `scale(${sx}, ${sy})`,
          transformOrigin: '960px 540px',
          filter: `brightness(${1 + 2.2 * (1 - sy)})`,
        },
      };
    }
    default:
      return {};
  }
};

export const TransitionOverlay: React.FC<{spec: TransitionSpec; local: number}> = ({spec: s, local}) => {
  const p = progress(s, local);
  const [ox, oy] = s.origin;
  const svg = (children: React.ReactNode, style?: React.CSSProperties) => (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, ...style}}>
      {children}
    </svg>
  );
  switch (s.kind) {
    case 'iris': {
      const R = lerp(230, 1120, EASE.inOutCubic(p));
      const o = 1 - p * p;
      return svg(
        <>
          <circle cx={ox} cy={oy} r={R} fill="none" stroke="#F3DC9A" strokeOpacity={0.22 * o} strokeWidth={22} />
          <circle cx={ox} cy={oy} r={R} fill="none" stroke="#FFF1C9" strokeOpacity={o} strokeWidth={2.5} />
        </>,
      );
    }
    case 'clock': {
      const a = 360 * EASE.inOutSine(p);
      const env = Math.sin(Math.PI * p);
      const ex = ox + Math.sin(deg(a)) * 1400;
      const ey = oy - Math.cos(deg(a)) * 1400;
      const trail = `conic-gradient(from ${(a - 28).toFixed(2)}deg at ${ox}px ${oy}px, rgba(246,226,170,0) 0deg, rgba(246,226,170,${(0.32 * env).toFixed(3)}) 28deg, rgba(246,226,170,0) 28.4deg)`;
      return (
        <>
          <div style={{position: 'absolute', inset: 0, background: trail, mixBlendMode: 'screen'}} />
          {svg(
            <>
              <line x1={ox} y1={oy} x2={ex} y2={ey} stroke="#F6E2AA" strokeOpacity={0.25 * env} strokeWidth={16} />
              <line x1={ox} y1={oy} x2={ex} y2={ey} stroke="#FFF4D6" strokeOpacity={env} strokeWidth={2.5} />
            </>,
          )}
        </>
      );
    }
    case 'diagonal': {
      const d = diagOffset(p);
      return svg(
        <>
          <path d={polyPath(band(d, d + DIAG_W))} fill="#C9231E" />
          <path d={polyPath(band(d + DIAG_W - 4, d + DIAG_W))} fill="#F4E9D2" />
          <path d={polyPath(band(d + DIAG_W, d + DIAG_W + 36))} fill="#FFFFFF" opacity={0.18} />
        </>,
      );
    }
    case 'columns': {
      const hs = columnsH(p);
      return svg(
        hs.map((h, i) =>
          h > 1 && h < 1079 ? (
            <rect key={i} x={i * 160} y={h - 3} width={160} height={3} fill="#0F0F0F" />
          ) : null,
        ),
      );
    }
    case 'melt': {
      if (p <= 0 || p >= 1) return null;
      const d = meltPath(p, s.origin);
      const o = 1 - p;
      return svg(
        <>
          <path d={d} fill="none" stroke="#FF7A1A" strokeOpacity={0.35 * o} strokeWidth={30} />
          <path d={d} fill="none" stroke="#E0257E" strokeOpacity={o} strokeWidth={7} />
        </>,
      );
    }
    case 'shapes': {
      if (p <= 0 || p >= 0.999) return null;
      const colors = ['#2B59FF', '#FF6F59', '#8EE3C8', '#FFE14A', '#B79CFF', '#121212'];
      return svg(
        SHAPES.map((sh, i) => {
          const q = clamp01((p - sh.delay) / 0.6);
          const d = shapePath(sh, p, local);
          const o = 1 - clamp01(q / 0.45);
          return d && o > 0.02 ? (
            <path key={i} d={d} fill="none" stroke={colors[i % colors.length]} strokeWidth={18} strokeLinejoin="round" opacity={o} />
          ) : null;
        }),
      );
    }
    case 'flash': {
      const I = local < 0 ? Math.pow((local + s.pre) / s.pre, 2) : Math.exp(-local / 2.4);
      const size = 120 + 520 * I;
      const rot = local * 7;
      const star = (sz: number) =>
        polyPath(
          Array.from({length: 8}, (_, i) => {
            const a = deg(i * 45 + rot - 90);
            const rr = i % 2 === 0 ? sz : sz * 0.12;
            return [ox + Math.cos(a) * rr, oy + Math.sin(a) * rr] as Pt;
          }),
        );
      return (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at ${ox}px ${oy}px, rgba(255,255,255,${(0.95 * I).toFixed(3)}) 0px, rgba(255,240,250,${(0.6 * I).toFixed(3)}) ${(260 + 700 * I).toFixed(0)}px, rgba(255,255,255,0) ${(500 + 1200 * I).toFixed(0)}px)`,
            }}
          />
          {svg(<path d={star(size)} fill="#FFFFFF" opacity={Math.min(1, I * 1.4)} />)}
        </>
      );
    }
    case 'blinds': {
      const hs = blindsH(p);
      return svg(
        hs.map((h, j) => {
          if (h <= 0.5 || h >= 89.5) return null;
          const yc = 45 + j * 90;
          return (
            <g key={j}>
              {[yc - h / 2, yc + h / 2].map((y, k) => (
                <g key={k}>
                  <line x1={0} x2={1920} y1={y} y2={y} stroke="#FF2E97" strokeOpacity={0.35} strokeWidth={8} />
                  <line x1={0} x2={1920} y1={y} y2={y} stroke="#FFD6F0" strokeWidth={2} />
                </g>
              ))}
            </g>
          );
        }),
      );
    }
    case 'glitch': {
      if (local < -4 || local > 2) return null;
      const f = Math.floor(local);
      return svg(
        Array.from({length: 9}, (_, i) => {
          if (random(`gb${f}${i}`) < 0.35) return null;
          const colors = ['#FFFFFF', '#00E5FF', '#FF1E3C', '#7A7A7A'];
          return (
            <rect
              key={i}
              x={random(`gbx${f}${i}`) * 1700}
              y={random(`gby${f}${i}`) * 1040}
              width={60 + random(`gbw${f}${i}`) * 420}
              height={4 + random(`gbh${f}${i}`) * 60}
              fill={colors[Math.floor(random(`gbc${f}${i}`) * colors.length)]}
              opacity={0.85}
            />
          );
        }),
      );
    }
    case 'crt': {
      if (local < -5 || local > 5) return null;
      const lineK = local < -3 ? tw(local, -5, -3, 0, 1) : 1;
      const w = local < -3 ? 1920 : tw(local, -3, 0, 1920, 24, EASE.inCubic);
      const fade = local <= 0 ? 1 : tw(local, 0, 5, 1, 0, EASE.outCubic);
      return svg(
        <>
          <rect x={960 - w / 2} y={530} width={w} height={20} fill="#FFFFFF" opacity={0.25 * lineK * fade} />
          <rect x={960 - w / 2} y={538} width={w} height={4} fill="#FFFFFF" opacity={lineK * fade} />
          <circle cx={960} cy={540} r={60} fill="#FFFFFF" opacity={0.18 * fade * (local > -3 ? 1 : 0)} />
        </>,
      );
    }
    default:
      return null;
  }
};

/** SVG-фильтры RGB-расслоения трёх интенсивностей для глитч-перехода */
export const GlitchDefs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      {[1, 2, 3].map((k) => (
        <filter key={k} id={`rgbSplit${k}`} x="-5%" y="0%" width="110%" height="100%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={-8 * k} dy={0} result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx={8 * k} dy={0} result="b2" />
          <feBlend mode="screen" in="r2" in2="g" result="rg" />
          <feBlend mode="screen" in="rg" in2="b2" />
        </filter>
      ))}
    </defs>
  </svg>
);
