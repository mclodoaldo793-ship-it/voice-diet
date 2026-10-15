import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {EASE, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 09 · Ретровейв: солнце в полоску на горизонте, неоновая сетка летит на зрителя.
// Свет — неон включается с мерцанием, солнце и линии светятся.
export const RET = {
  sky0: '#070220',
  sky1: '#250A4D',
  sky2: '#5E1670',
  sky3: '#A42A80',
  pink: '#FF2E97',
  pinkCore: '#FF8FCB',
  cyan: '#2BF0FF',
  ground0: '#14052E',
  ground1: '#050012',
};
const HORIZON = 640;
const F = 440;
const SUN_R = 260;
const FLICKER = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1];
const MOUNT_L: Pt[] = [
  [-10, 641],
  [-10, 572],
  [90, 600],
  [175, 540],
  [262, 588],
  [338, 515],
  [440, 598],
  [520, 572],
  [610, 641],
];

/** Солнце в полоску. Центр (0,0). */
export const RetroSun: React.FC<{r: number; t: number}> = ({r, t}) => {
  const uid = useUid('sun');
  const spacing = 0.115 * r;
  const shift = (t * 0.9 * (r / SUN_R)) % spacing;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}g`} x1={0} y1={-r} x2={0} y2={r} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor="#FFF07A" />
          <stop offset={0.45} stopColor="#FF9A3C" />
          <stop offset={0.8} stopColor="#FF3D7F" />
          <stop offset={1} stopColor="#E01E8A" />
        </linearGradient>
        <mask id={`${uid}m`} maskUnits="userSpaceOnUse" x={-r} y={-r} width={2 * r} height={2 * r}>
          <circle r={r} fill="#fff" />
          {Array.from({length: 11}, (_, k) => {
            const y = -0.05 * r + k * spacing - shift;
            const h = (0.016 + 0.011 * k) * r;
            return y > -0.1 * r ? <rect key={k} x={-r} y={y} width={2 * r} height={h} fill="#000" /> : null;
          })}
        </mask>
      </defs>
      <circle r={r} fill={`url(#${uid}g)`} mask={`url(#${uid}m)`} />
    </g>
  );
};

export const Retrowave: React.FC = () => {
  const t = useT();
  const uid = useUid('ret');
  const fi = Math.floor(t);
  const neon = fi < 0 ? 0 : fi < FLICKER.length ? FLICKER[fi] : 1;
  const neonSoft = fi < FLICKER.length ? neon * 0.7 : 1;

  const sunY = tw(t, 0, 20, 760, 560, EASE.outCubic);
  const scroll = (Math.max(0, t) * 0.055) % 1;

  // Сетка в перспективе
  const hLines: React.ReactNode[] = [];
  for (let n = 1; n <= 34; n++) {
    const z = n - scroll;
    if (z < 0.22) continue;
    const y = HORIZON + F / z;
    if (y > 1090) continue;
    const o = Math.pow(Math.min(1, (y - HORIZON - 2) / 70), 1.2);
    hLines.push(
      <g key={`h${n}`} opacity={o}>
        <line x1={0} x2={1920} y1={y} y2={y} stroke={RET.pink} strokeOpacity={0.25} strokeWidth={8} />
        <line x1={0} x2={1920} y1={y} y2={y} stroke={RET.pinkCore} strokeWidth={2.2} />
      </g>,
    );
  }
  const vLines: React.ReactNode[] = [];
  for (let m = -16; m <= 16; m++) {
    const X = m * 0.55;
    const zb = 0.25;
    const xb = 960 + (F * X) / zb;
    const yb = HORIZON + F / zb;
    vLines.push(
      <g key={`v${m}`}>
        <line x1={960} y1={HORIZON} x2={xb} y2={yb} stroke={RET.pink} strokeOpacity={0.25} strokeWidth={8} />
        <line x1={960} y1={HORIZON} x2={xb} y2={yb} stroke={RET.pinkCore} strokeWidth={2.2} />
      </g>,
    );
  }

  const fly = tw(t, 6, 18, 1, 0, EASE.outExpo);
  const titleX = 1900 * fly;
  const skew = -24 * fly;
  const flare = 0.75 + 0.25 * Math.sin(t * 0.4);

  const titleText = (props: React.SVGProps<SVGTextElement>, key: string) => (
    <text
      key={key}
      x={960}
      y={268}
      textAnchor="middle"
      fontFamily={FONT.retro}
      fontStyle="italic"
      fontWeight={900}
      fontSize={150}
      letterSpacing="0.02em"
      {...props}
    >
      РЕТРОВЕЙВ
    </text>
  );

  return (
    <AbsoluteFill style={{backgroundColor: RET.ground1}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id={`${uid}sky`} x1={0} y1={0} x2={0} y2={HORIZON} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={RET.sky0} />
            <stop offset={0.55} stopColor={RET.sky1} />
            <stop offset={0.85} stopColor={RET.sky2} />
            <stop offset={1} stopColor={RET.sky3} />
          </linearGradient>
          <linearGradient id={`${uid}ground`} x1={0} y1={HORIZON} x2={0} y2={1080} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={RET.ground0} />
            <stop offset={1} stopColor={RET.ground1} />
          </linearGradient>
          <radialGradient id={`${uid}sunGlow`} cx={960} cy={sunY} r={700} gradientUnits="userSpaceOnUse">
            <stop offset={0.25} stopColor="#FF8A3D" stopOpacity={0.55} />
            <stop offset={0.55} stopColor="#FF2E7E" stopOpacity={0.2} />
            <stop offset={1} stopColor="#FF2E7E" stopOpacity={0} />
          </radialGradient>
          <clipPath id={`${uid}skyClip`}>
            <rect x={0} y={0} width={1920} height={HORIZON} />
          </clipPath>
          <clipPath id={`${uid}groundClip`}>
            <rect x={0} y={HORIZON} width={1920} height={1080 - HORIZON} />
          </clipPath>
          <linearGradient id={`${uid}title`} x1={0} y1={160} x2={0} y2={270} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#0E2470" />
            <stop offset={0.38} stopColor="#63C9FF" />
            <stop offset={0.5} stopColor="#FFFFFF" />
            <stop offset={0.54} stopColor="#4B1460" />
            <stop offset={0.76} stopColor="#C2479E" />
            <stop offset={1} stopColor="#FFC2EA" />
          </linearGradient>
          <linearGradient id={`${uid}flare`} x1={0} y1={0} x2={1920} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#FFE3F6" stopOpacity={0} />
            <stop offset={0.5} stopColor="#FFE3F6" stopOpacity={1} />
            <stop offset={1} stopColor="#FFE3F6" stopOpacity={0} />
          </linearGradient>
        </defs>

        <rect width={1920} height={HORIZON} fill={`url(#${uid}sky)`} />
        {/* Звёзды */}
        {Array.from({length: 70}, (_, i) => {
          const x = random(`stx${i}`) * 1920;
          const y = random(`sty${i}`) * 560;
          const tw2 = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.17 + i * 2.3), 3);
          return <circle key={i} cx={x} cy={y} r={0.8 + random(`str${i}`) * 1.6} fill="#FFFFFF" opacity={tw2 * (1 - y / 700)} />;
        })}

        <g clipPath={`url(#${uid}skyClip)`}>
          <circle cx={960} cy={sunY} r={700} fill={`url(#${uid}sunGlow)`} />
          <g transform={`translate(960 ${sunY})`}>
            <RetroSun r={SUN_R} t={t} />
          </g>
        </g>

        {/* Горы с неоновой кромкой */}
        {[MOUNT_L, MOUNT_L.map(([x, y]) => [1920 - x, y] as Pt)].map((pts, i) => (
          <g key={i}>
            <path d={polyPath(pts)} fill="#1B0838" />
            <path d={polyPath(pts)} fill="none" stroke={RET.cyan} strokeOpacity={0.3 * neonSoft} strokeWidth={9} strokeLinejoin="round" />
            <path d={polyPath(pts)} fill="none" stroke="#B9FBFF" strokeOpacity={neon} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        ))}

        <rect x={0} y={HORIZON} width={1920} height={1080 - HORIZON} fill={`url(#${uid}ground)`} />
        <g clipPath={`url(#${uid}groundClip)`} opacity={neon}>
          {vLines}
          {hLines}
        </g>

        {/* Блик на горизонте */}
        <rect x={0} y={HORIZON - 14} width={1920} height={28} fill={`url(#${uid}flare)`} opacity={0.22 * flare * neonSoft} />
        <rect x={0} y={HORIZON - 1.5} width={1920} height={3} fill={`url(#${uid}flare)`} opacity={flare * neonSoft} />

        {/* Заголовок влетает со шлейфом скорости */}
        <g
          transform={`translate(${titleX} 0) skewX(${skew})`}
          style={{transformOrigin: '960px 220px', transformBox: 'view-box'}}
          opacity={fly > 0.995 ? 0 : 1}
        >
          {[3, 2, 1].map((k) =>
            fly > 0.02
              ? titleText({fill: RET.pink, opacity: 0.16 * k * fly, transform: `translate(${k * 90 * fly} 0)`}, `trail${k}`)
              : null,
          )}
          {titleText({fill: 'none', stroke: RET.pink, strokeWidth: 16, strokeOpacity: 0.5 * neonSoft, strokeLinejoin: 'round'}, 'glow')}
          {titleText({fill: `url(#${uid}title)`, stroke: '#FFFFFF', strokeWidth: 2.5, paintOrder: 'stroke', strokeLinejoin: 'round'}, 'main')}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
