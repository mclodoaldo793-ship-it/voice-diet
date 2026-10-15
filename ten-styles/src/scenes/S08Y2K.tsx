import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {EASE, lerp, prog, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {deg, polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 08 · Y2K: хромовый пузырь, орбита с сателлитом, искры, радужный ободок.
// Свет — отражения и спекулярные блики, которые живут на хроме.
export const Y2 = {
  top: '#DCE6F6',
  bottom: '#F6DDEE',
  ink: '#26304A',
  ice: '#8FE3FF',
  pink: '#FF9FDB',
};
const C: Pt = [960, 470];
const R = 230;
const IRIS = ['#FF9FDB', '#9BE7FF', '#B5FFD9', '#FFF3A8', '#C9B5FF', '#FF9FDB'];

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const iris = (k: number) => {
  const x = (((k % 1) + 1) % 1) * (IRIS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = hex(IRIS[i]);
  const b = hex(IRIS[i + 1]);
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')})`;
};

/** Хромовый пузырь. Центр (0,0). */
export const ChromeBubble: React.FC<{r: number; t: number}> = ({r, t}) => {
  const uid = useUid('chr');
  const yh = r * (0.08 + 0.03 * Math.sin(t * 0.05));
  const streak = -0.35 * r + 0.28 * r * Math.sin(t * 0.04);
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}base`} cx={-0.3 * r} cy={-0.35 * r} r={1.45 * r} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor="#FFFFFF" />
          <stop offset={0.32} stopColor="#E4EAF3" />
          <stop offset={0.72} stopColor="#97A3B8" />
          <stop offset={1} stopColor="#4C586E" />
        </radialGradient>
        <linearGradient id={`${uid}ground`} x1={0} y1={yh} x2={0} y2={r} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor="#3E4A62" />
          <stop offset={0.45} stopColor="#7E8AA2" />
          <stop offset={1} stopColor="#D2DAE8" />
        </linearGradient>
        <radialGradient id={`${uid}sky`} cx={-0.1 * r} cy={-0.45 * r} r={0.85 * r} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor="#D8F4FF" stopOpacity={0.75} />
          <stop offset={1} stopColor="#D8F4FF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}spec`} cx={0} cy={0} r={1}>
          <stop offset={0} stopColor="#FFFFFF" stopOpacity={1} />
          <stop offset={0.6} stopColor="#FFFFFF" stopOpacity={0.85} />
          <stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}edge`} cx={0} cy={0} r={r} gradientUnits="userSpaceOnUse">
          <stop offset={0.78} stopColor="#1E2638" stopOpacity={0} />
          <stop offset={1} stopColor="#1E2638" stopOpacity={0.45} />
        </radialGradient>
        <clipPath id={`${uid}c`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={`url(#${uid}base)`} />
      <g clipPath={`url(#${uid}c)`}>
        <circle r={r} fill={`url(#${uid}sky)`} />
        <path d={`M${-r} ${yh} Q0 ${yh + 0.24 * r} ${r} ${yh} L${r} ${r} L${-r} ${r} Z`} fill={`url(#${uid}ground)`} opacity={0.92} />
        <path d={`M${-r} ${yh} Q0 ${yh + 0.24 * r} ${r} ${yh}`} fill="none" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={Math.max(0.8, r * 0.012)} />
        <g transform={`rotate(12)`} opacity={0.42}>
          <rect x={streak} y={-0.75 * r} width={0.09 * r} height={0.95 * r} rx={0.045 * r} fill="#FFFFFF" />
          <rect x={streak + 0.14 * r} y={-0.62 * r} width={0.035 * r} height={0.7 * r} rx={0.02 * r} fill="#FFFFFF" />
        </g>
        <circle r={r} fill={`url(#${uid}edge)`} />
      </g>
      {/* Радужный ободок */}
      <g style={{mixBlendMode: 'screen'}} opacity={0.85}>
        {Array.from({length: 36}, (_, i) => {
          const a0 = deg(i * 10);
          const a1 = deg(i * 10 + 10.5);
          const rr = r * 0.955;
          return (
            <path
              key={i}
              d={`M${Math.cos(a0) * rr} ${Math.sin(a0) * rr} A${rr} ${rr} 0 0 1 ${Math.cos(a1) * rr} ${Math.sin(a1) * rr}`}
              fill="none"
              stroke={iris(i / 36 + t * 0.012)}
              strokeWidth={r * 0.075}
            />
          );
        })}
      </g>
      <ellipse cx={-0.37 * r} cy={-0.47 * r} rx={0.2 * r} ry={0.11 * r} fill={`url(#${uid}spec)`} transform={`rotate(-32 ${-0.37 * r} ${-0.47 * r})`} />
      <circle cx={-0.2 * r} cy={-0.63 * r} r={0.03 * r} fill="#FFFFFF" />
      <circle r={r} fill="none" stroke={Y2.ink} strokeOpacity={0.35} strokeWidth={Math.max(0.8, r * 0.008)} />
    </g>
  );
};

const star = (cx: number, cy: number, L: number, rot = 0) =>
  polyPath(
    Array.from({length: 8}, (_, i) => {
      const a = deg(i * 45 + rot - 90);
      const rr = i % 2 === 0 ? L : L * 0.11;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt;
    }),
  );

const SPARKS: [number, number, number][] = [
  [640, 250, 38],
  [1300, 215, 30],
  [1410, 590, 44],
  [530, 640, 26],
  [1190, 300, 18],
  [760, 160, 16],
  [1500, 380, 20],
  [420, 420, 22],
  [1260, 720, 24],
];

export const Y2K: React.FC = () => {
  const t = useT();
  const uid = useUid('y2k');

  const inflate = t < 0 ? 0 : springAt(t, 0, {damping: 11, stiffness: 140});
  const jel = Math.exp(-Math.max(0, t) / 7) * Math.sin(Math.max(0, t) * 0.95);
  const bs = 0.45 + 0.55 * inflate;
  const bsx = bs * (1 + 0.09 * jel);
  const bsy = bs * (1 - 0.09 * jel);
  const bob = Math.sin(t * 0.07) * 6;

  const unfold = tw(t, 3, 20, 0, 1, EASE.outCubic);
  const rx = 400 * unfold;
  const ry = 96 * unfold;
  const sat = 1.2 + t * 0.085;
  const satP: Pt = [Math.cos(sat) * rx, Math.sin(sat) * ry];
  const satBehind = Math.sin(sat) < 0;

  const titleUp = tw(t, 8, 22, 90, 0, EASE.outCubic);
  const titleOp = tw(t, 8, 16, 0, 1);
  const sheenA = prog(t, 18, 34);
  const sheenB = prog(t, 56, 72);
  const sheen = sheenA > 0 && sheenA < 1 ? sheenA : sheenB;
  const sheenX = lerp(560, 1360, sheen);
  const sheenOn = (sheenA > 0 && sheenA < 1) || (sheenB > 0 && sheenB < 1);

  const orbitArc = (front: boolean) =>
    front ? `M${rx} 0 A${rx} ${ry} 0 0 1 ${-rx} 0` : `M${-rx} 0 A${rx} ${ry} 0 0 1 ${rx} 0`;

  const satellite = (
    <g transform={`translate(${satP[0]} ${satP[1]})`}>
      <ChromeBubble r={24} t={t + 40} />
    </g>
  );

  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${Y2.top} 0%, #E9E3F6 55%, ${Y2.bottom} 100%)`}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id={`${uid}orbit`} x1={-400} y1={0} x2={400} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#FFFFFF" />
            <stop offset={0.25} stopColor="#8C98AC" />
            <stop offset={0.5} stopColor="#FFFFFF" />
            <stop offset={0.75} stopColor="#6B778C" />
            <stop offset={1} stopColor="#E7ECF4" />
          </linearGradient>
          <linearGradient id={`${uid}chrome`} x1={0} y1={772} x2={0} y2={940} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#FFFFFF" />
            <stop offset={0.4} stopColor="#C3CCDA" />
            <stop offset={0.5} stopColor="#5B677D" />
            <stop offset={0.54} stopColor="#2E3A50" />
            <stop offset={0.58} stopColor="#E9EEF6" />
            <stop offset={0.82} stopColor="#A8B3C6" />
            <stop offset={1} stopColor="#FFFFFF" />
          </linearGradient>
          <linearGradient id={`${uid}sheen`} x1={sheenX - 120} y1={760} x2={sheenX + 120} y2={950} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#fff" stopOpacity={0} />
            <stop offset={0.5} stopColor="#fff" stopOpacity={sheenOn ? 0.95 : 0} />
            <stop offset={1} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          {['#FFB8E6', '#9FE6FF', '#D9C8FF'].map((c, i) => (
            <radialGradient key={i} id={`${uid}blob${i}`}>
              <stop offset={0} stopColor={c} stopOpacity={1} />
              <stop offset={1} stopColor={c} stopOpacity={0} />
            </radialGradient>
          ))}
          <radialGradient id={`${uid}glow`} cx={0} cy={0} r={1}>
            <stop offset={0} stopColor="#FFFFFF" stopOpacity={0.9} />
            <stop offset={0.35} stopColor={Y2.ice} stopOpacity={0.35} />
            <stop offset={1} stopColor={Y2.ice} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Мягкие цветные пятна света */}
        {[
          {x: 260 + 40 * Math.sin(t * 0.03), y: 180, r: 520, c: '#FFB8E6', o: 0.55},
          {x: 1700, y: 860 + 30 * Math.sin(t * 0.04), r: 600, c: '#9FE6FF', o: 0.55},
          {x: 1620, y: 160, r: 380, c: '#D9C8FF', o: 0.45},
        ].map((b, i) => (
          <circle key={`b${i}`} cx={b.x} cy={b.y} r={b.r} fill={`url(#${uid}blob${i})`} opacity={b.o} />
        ))}
        {/* Рябь от пузыря */}
        {Array.from({length: 16}, (_, k) => {
          const rr = 270 + k * 80 + ((t * 1.6) % 80);
          return <circle key={k} cx={C[0]} cy={C[1]} r={rr} fill="none" stroke="#FFFFFF" strokeOpacity={0.55 * Math.max(0, 1 - rr / 1450)} strokeWidth={1.6} />;
        })}
        {Array.from({length: 12}, (_, i) => {
          const x = 120 + random(`px${i}`) * 1680;
          const y = 120 + random(`py${i}`) * 820;
          const o = 0.35 + 0.35 * Math.sin(t * 0.2 + i * 1.7);
          return (
            <g key={i} opacity={o} stroke="#8E9DBA" strokeWidth={2}>
              <line x1={x - 9} y1={y} x2={x + 9} y2={y} />
              <line x1={x} y1={y - 9} x2={x} y2={y + 9} />
            </g>
          );
        })}

        <g transform={`translate(${C[0]} ${C[1] + bob})`}>
          {/* Орбита: задняя половина */}
          <g transform="rotate(-14)">
            <path d={orbitArc(false)} fill="none" stroke={`url(#${uid}orbit)`} strokeWidth={12} opacity={0.75} />
            {satBehind ? satellite : null}
          </g>
          {/* Пузырь с желейной упругостью */}
          <g transform={`scale(${bsx} ${bsy})`}>
            <ChromeBubble r={R} t={t} />
          </g>
          <g transform="rotate(-14)">
            <path d={orbitArc(true)} fill="none" stroke={`url(#${uid}orbit)`} strokeWidth={12} />
            <path d={orbitArc(true)} fill="none" stroke="#FFFFFF" strokeWidth={2} transform="translate(0 -4)" opacity={0.8} />
            {!satBehind ? satellite : null}
          </g>
        </g>

        {/* Искры */}
        {SPARKS.map(([x, y, L], i) => {
          const ph = random(`sp${i}`) * 60;
          const s = Math.pow(Math.max(0, Math.sin((t - ph) * 0.21)), 4) * tw(t, 6, 14, 0, 1);
          if (s < 0.02) return null;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={L * 1.3 * s} fill={`url(#${uid}glow)`} />
              <path d={star(x, y, L * s, t * 2)} fill="#FFFFFF" />
            </g>
          );
        })}

        {/* Хромовое Y2K */}
        <g transform={`translate(0 ${titleUp})`} opacity={titleOp} fontFamily={FONT.y2k} fontWeight={900} fontSize={230} letterSpacing="0.02em">
          <text x={960} y={935} textAnchor="middle" fill="none" stroke={Y2.ice} strokeOpacity={0.4} strokeWidth={28} strokeLinejoin="round">
            Y2K
          </text>
          <text x={960} y={935} textAnchor="middle" fill={`url(#${uid}chrome)`} stroke={Y2.ink} strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
            Y2K
          </text>
          <text x={960} y={935} textAnchor="middle" fill={`url(#${uid}sheen)`}>
            Y2K
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
