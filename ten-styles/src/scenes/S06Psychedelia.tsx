import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EASE, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 06 · Психоделия: туннель волнистых колец течёт наружу, спираль гипнотизирует,
// по буквам бежит волна. Свет пульсирует.
export const PSY = {
  purple: '#3B0F5E',
  magenta: '#E0257E',
  orange: '#FF7A1A',
  yellow: '#FFD23D',
  deep: '#22073A',
};
const PALETTE = [PSY.purple, PSY.magenta, PSY.orange, PSY.yellow, PSY.orange, PSY.magenta];
const C: Pt = [960, 450];
const HERO_R = 190;
const RING_W = 50;
const TITLE = 'ПСИХЕДЕЛИЯ';

const wobblyPath = (cx: number, cy: number, R: number, amp: number, phase: number, k: number) => {
  const pts: Pt[] = [];
  const N = 140;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const rr = R + amp * Math.sin(6 * th + phase + k * 0.35) + amp * 0.5 * Math.sin(11 * th - phase * 0.7 + k * 0.6);
    pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
  }
  return polyPath(pts);
};

/** Спираль в круге. Центр (0,0). */
export const PsySpiral: React.FC<{r: number; rot: number}> = ({r, rot}) => {
  const uid = useUid('psyS');
  const arm = (offset: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 160; i++) {
      const th = (i / 160) * Math.PI * 6;
      const rr = (th / (Math.PI * 6)) * r * 1.15;
      pts.push(`${(Math.cos(th + offset) * rr).toFixed(2)},${(Math.sin(th + offset) * rr).toFixed(2)}`);
    }
    return pts.join(' ');
  };
  return (
    <g>
      <defs>
        <clipPath id={`${uid}c`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={PSY.yellow} />
      <g clipPath={`url(#${uid}c)`} transform={`rotate(${rot})`}>
        {[0, Math.PI].map((o) => (
          <polyline key={o} points={arm(o)} fill="none" stroke={PSY.purple} strokeWidth={r * 0.12} strokeLinecap="round" />
        ))}
      </g>
      <circle r={r} fill="none" stroke={PSY.purple} strokeWidth={Math.max(1, r * 0.05)} />
    </g>
  );
};

export const Psychedelia: React.FC = () => {
  const t = useT();
  const uid = useUid('psy');

  const melt = tw(t, 0, 22, 0, 1, EASE.inOutCubic);
  const flow = Math.max(0, t) * 0.05 + 0.4 * melt;
  const base = Math.floor(flow);
  const frac = flow - base;
  const phase = t * 0.12;
  const rings: React.ReactNode[] = [];
  for (let k = 27; k >= 0; k--) {
    const R = HERO_R + (k + frac) * RING_W;
    const amp = (4 + 0.075 * R) * melt;
    const color = PALETTE[(((k - base) % PALETTE.length) + PALETTE.length) % PALETTE.length];
    rings.push(<path key={k} d={wobblyPath(C[0], C[1], R, amp, phase, k)} fill={color} />);
  }

  const pulse = 0.5 + 0.5 * Math.cos(((t % 20) / 20) * Math.PI * 2);
  const heroScale = tw(t, 0, 14, 0.7, 1, EASE.outCubic) * (1 + 0.02 * pulse);

  const letters = TITLE.split('');
  const dys: number[] = [];
  const rots: number[] = [];
  let prev = 0;
  letters.forEach((_, i) => {
    const rise = tw(t, 6 + i * 1.4, 18 + i * 1.4, 180, 0, EASE.outCubic);
    const y = rise + 22 * Math.sin(t * 0.22 - i * 0.75);
    dys.push(y - prev);
    prev = y;
    rots.push(7 * Math.cos(t * 0.22 - i * 0.75));
  });
  const titleOpacity = tw(t, 6, 14, 0, 1);

  const titleLayer = (stroke: string, width: number, fill: string) => (
    <text
      x={960}
      y={915}
      textAnchor="middle"
      fontFamily={FONT.psy}
      fontWeight={900}
      fontSize={150}
      letterSpacing="0.02em"
      fill={fill}
      stroke={stroke}
      strokeWidth={width}
      strokeLinejoin="round"
      paintOrder="stroke"
      dy={dys.join(' ')}
      rotate={rots.join(' ')}
      opacity={titleOpacity}
    >
      {TITLE}
    </text>
  );

  return (
    <AbsoluteFill style={{backgroundColor: PSY.deep}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id={`${uid}glow`} cx={C[0]} cy={C[1]} r={430} gradientUnits="userSpaceOnUse">
            <stop offset={0.42} stopColor="#FFC93D" stopOpacity={0.2 + 0.18 * pulse} />
            <stop offset={1} stopColor="#FFC93D" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}vig`} cx={960} cy={540} r={1150} gradientUnits="userSpaceOnUse">
            <stop offset={0.55} stopColor={PSY.deep} stopOpacity={0} />
            <stop offset={1} stopColor={PSY.deep} stopOpacity={0.55} />
          </radialGradient>
        </defs>
        {rings}
        <rect width={1920} height={1080} fill={`url(#${uid}vig)`} />
        <circle cx={C[0]} cy={C[1]} r={430} fill={`url(#${uid}glow)`} style={{mixBlendMode: 'screen'}} />
        <g transform={`translate(${C[0]} ${C[1]}) scale(${heroScale})`}>
          <PsySpiral r={HERO_R} rot={t * 7} />
        </g>
        {titleLayer(PSY.purple, 40, PSY.purple)}
        {titleLayer(PSY.magenta, 22, PSY.magenta)}
        {titleLayer(PSY.purple, 5, PSY.yellow)}
      </svg>
    </AbsoluteFill>
  );
};
