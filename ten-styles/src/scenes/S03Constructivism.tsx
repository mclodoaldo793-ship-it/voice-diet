import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Grain} from '../components/Grain';
import {EASE, lerp, shake, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {deg, polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 03 · Конструктивизм: диагональ, красный клин бьёт в круг, прожекторы в чёрном поле.
export const CON = {
  paper: '#E7D9BD',
  red: '#C9231E',
  redDark: '#8E1512',
  black: '#141210',
  cream: '#F4EAD5',
};

const FIELD: Pt[] = [
  [860, -40],
  [1960, -40],
  [1960, 1120],
  [1170, 1120],
];
const C: Pt = [1360, 470];
const R = 255;
const AXIS = deg(-24);
const TIP: Pt = [1150, 522];
const WEDGE_LEN = 1260;
const WEDGE_HALF = 235;
const TITLE = 'КОНСТРУКТИВИЗМ';
const EDGE_A = deg(-13.6);

const wedgePts = (tip: Pt): Pt[] => {
  const u: Pt = [Math.cos(AXIS), Math.sin(AXIS)];
  const n: Pt = [-u[1], u[0]];
  const b: Pt = [tip[0] - u[0] * WEDGE_LEN, tip[1] - u[1] * WEDGE_LEN];
  return [tip, [b[0] + n[0] * WEDGE_HALF, b[1] + n[1] * WEDGE_HALF], [b[0] - n[0] * WEDGE_HALF, b[1] - n[1] * WEDGE_HALF]];
};

/** Значок для финала: кремовый круг, в который входит красный клин. Центр (0,0). */
export const ConstructivismBadge: React.FC<{r: number}> = ({r}) => {
  const uid = useUid('conB');
  return (
    <g>
      <defs>
        <clipPath id={`${uid}c`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}c)`}>
        <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={CON.black} />
        <path d={`M${-r} ${-r} L${-0.15 * r} ${-r} L${0.2 * r} ${r} L${-r} ${r} Z`} fill={CON.paper} />
        <circle cx={0.28 * r} cy={-0.1 * r} r={0.5 * r} fill={CON.cream} />
        <path
          d={polyPath([
            [0.05 * r, 0.02 * r],
            [-1.2 * r, 0.95 * r],
            [-1.2 * r, 0.25 * r],
          ])}
          fill={CON.red}
        />
      </g>
      <circle r={r} fill="none" stroke={CON.black} strokeWidth={Math.max(1, r * 0.03)} />
    </g>
  );
};

export const Constructivism: React.FC = () => {
  const t = useT();
  const uid = useUid('con');

  // Круг съезжает по диагонали, клин бьёт в него
  const circIn = tw(t, 0, 11, 0, 1, EASE.outExpo);
  const cx = lerp(C[0] + 320, C[0], circIn);
  const cy = lerp(C[1] - 170, C[1], circIn);
  const thrust = tw(t, 6, 16, 0, 1, EASE.thrust);
  const recoil = t < 16 ? 0 : (1 - springAt(t, 16, {damping: 7, stiffness: 260})) * -1;
  const u: Pt = [Math.cos(AXIS), Math.sin(AXIS)];
  const back = (1 - thrust) * 1400 + recoil * 22;
  const tip: Pt = [TIP[0] - u[0] * back, TIP[1] - u[1] * back];
  const [shx, shy] = shake(t, 16, 7, 13, 3);
  const flash = t >= 16 ? Math.exp(-(t - 16) / 2.5) : 0;

  // Рельсы параллельно клину
  const rails = tw(t, 3, 15, 0, 1, EASE.outExpo);

  // Прожекторы
  const src: Pt = [2050, 1180];
  const beams = [0, 1, 2].map((k) => deg(-150 + k * 17 + 7 * Math.sin(t * 0.045 + k * 1.7)));

  const letters = TITLE.split('');
  const titleOrigin: Pt = [112, 752];

  const textEl = (fill: string) => (
    <text
      x={titleOrigin[0]}
      y={titleOrigin[1]}
      fontFamily={FONT.constructivism}
      fontWeight={700}
      fontSize={138}
      letterSpacing="0.01em"
      fill={fill}
      transform={`rotate(${(EDGE_A * 180) / Math.PI} ${titleOrigin[0]} ${titleOrigin[1]})`}
    >
      {letters.map((ch, i) => {
        const st = 13 + i * 1.3;
        const y = tw(t, st, st + 5, -150, 0, EASE.thrust);
        const prevY = i === 0 ? 0 : tw(t, st - 1.3, st - 1.3 + 5, -150, 0, EASE.thrust);
        return (
          <tspan key={i} dy={i === 0 ? y : y - prevY} fillOpacity={tw(t, st, st + 1.5, 0, 1, EASE.linear)}>
            {ch}
          </tspan>
        );
      })}
    </text>
  );

  return (
    <AbsoluteFill style={{backgroundColor: CON.paper}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{translate: `${shx}px ${shy}px`}}>
        <defs>
          <clipPath id={`${uid}field`}>
            <path d={polyPath(FIELD)} />
          </clipPath>
          <clipPath id={`${uid}disc`}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
          <clipPath id={`${uid}paperZone`}>
            <path d="M-100 -100 L860 -40 L1170 1120 L-100 1200 Z" />
          </clipPath>
          <linearGradient id={`${uid}beam`} x1={src[0]} y1={src[1]} x2={src[0] - 1700} y2={src[1] - 900} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={CON.cream} stopOpacity={0.5} />
            <stop offset={1} stopColor={CON.cream} stopOpacity={0} />
          </linearGradient>
          <pattern id={`${uid}dots`} width={18} height={18} patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
            <circle cx={9} cy={9} r={4.2} fill={CON.redDark} />
          </pattern>
          <linearGradient id={`${uid}wedgeShade`} x1={tip[0]} y1={tip[1]} x2={tip[0] - 1100} y2={tip[1] + 500} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#fff" stopOpacity={0} />
            <stop offset={1} stopColor="#fff" stopOpacity={1} />
          </linearGradient>
          <mask id={`${uid}wedgeMask`} maskUnits="userSpaceOnUse" x={-200} y={-200} width={2400} height={1500}>
            <path d={polyPath(wedgePts(tip))} fill={`url(#${uid}wedgeShade)`} />
          </mask>
        </defs>

        {/* Чёрное поле с прожекторами */}
        <path d={polyPath(FIELD)} fill={CON.black} />
        <g clipPath={`url(#${uid}field)`} style={{mixBlendMode: 'screen'}} opacity={tw(t, 4, 16, 0, 1)}>
          {beams.map((a, k) => {
            const w = deg(4.5);
            const L = 2600;
            return (
              <path
                key={k}
                d={polyPath([
                  src,
                  [src[0] + Math.cos(a - w) * L, src[1] + Math.sin(a - w) * L],
                  [src[0] + Math.cos(a + w) * L, src[1] + Math.sin(a + w) * L],
                ])}
                fill={`url(#${uid}beam)`}
              />
            );
          })}
        </g>

        {/* Рельсы */}
        {[-330, 330].map((off, k) => {
          const n: Pt = [-u[1], u[0]];
          const slide = (1 - rails) * (k === 0 ? 1600 : -1600);
          const a: Pt = [TIP[0] + n[0] * off - u[0] * (1700 + slide), TIP[1] + n[1] * off - u[1] * (1700 + slide)];
          const b: Pt = [TIP[0] + n[0] * off + u[0] * (900 - slide), TIP[1] + n[1] * off + u[1] * (900 - slide)];
          return <line key={k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={k === 0 ? CON.black : CON.red} strokeWidth={k === 0 ? 7 : 5} />;
        })}

        {/* Круг: вспыхивает при ударе */}
        <circle cx={cx} cy={cy} r={R * 1.35} fill={CON.cream} opacity={0.25 * flash} />
        <circle cx={cx} cy={cy} r={R} fill={CON.cream} />
        <circle cx={cx} cy={cy} r={R} fill="#FFFFFF" opacity={flash} />
        <circle cx={cx} cy={cy} r={R * 0.62} fill="none" stroke={CON.black} strokeWidth={3} opacity={tw(t, 18, 28, 0, 0.9)} strokeDasharray={`${2 * Math.PI * R * 0.62 * tw(t, 18, 34, 0, 1, EASE.outCubic)} 4000`} />

        {/* Клин с растровой тенью */}
        <path d={polyPath(wedgePts(tip))} fill={CON.red} />
        <rect x={-200} y={-200} width={2400} height={1500} fill={`url(#${uid}dots)`} mask={`url(#${uid}wedgeMask)`} opacity={0.55} />

        {/* Линии удара */}
        {flash > 0.02
          ? Array.from({length: 7}, (_, i) => {
              const a = deg(-200 + i * 26);
              const r0 = 30 + (t - 16) * 22;
              const r1 = r0 + 60;
              return (
                <line
                  key={i}
                  x1={TIP[0] + Math.cos(a) * r0}
                  y1={TIP[1] + Math.sin(a) * r0}
                  x2={TIP[0] + Math.cos(a) * r1}
                  y2={TIP[1] + Math.sin(a) * r1}
                  stroke={CON.black}
                  strokeWidth={6}
                  opacity={flash}
                />
              );
            })
          : null}

        {/* Малые элементы */}
        <rect
          x={-34}
          y={-34}
          width={68}
          height={68}
          fill={CON.red}
          transform={`translate(330 250) rotate(-24) scale(${t < 22 ? 0 : springAt(t, 22, {damping: 9, stiffness: 280})})`}
        />
        <rect x={330} y={300} width={360 * tw(t, 24, 34, 0, 1, EASE.outExpo)} height={14} fill={CON.black} transform="rotate(-24 330 300)" />

        {/* Название: чёрное на бумаге и на круге, кремовое в чёрном поле */}
        <g clipPath={`url(#${uid}paperZone)`}>{textEl(CON.black)}</g>
        <g clipPath={`url(#${uid}field)`}>{textEl(CON.cream)}</g>
        <g clipPath={`url(#${uid}disc)`}>{textEl(CON.black)}</g>
      </svg>
      <Grain opacity={0.28} />
    </AbsoluteFill>
  );
};
