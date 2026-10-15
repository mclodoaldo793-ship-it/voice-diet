import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EASE, lerp, prog, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {deg, polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 01 · Ар-деко: строгая симметрия, золото, лучи-прожекторы, блик по металлу.
const CX = 960;
const CY = 540;
const R = 230;
export const DECO = {
  bg: '#0B1113',
  hi: '#F8EAC0',
  mid: '#D9B25B',
  lo: '#8C6528',
  deep: '#4E3714',
};

/** Золотой медальон с силуэтом ступенчатой башни. Центр в (0,0). */
export const DecoMedallion: React.FC<{r: number; t: number; rise?: number; sheen?: number}> = ({
  r,
  t,
  rise = 1,
  sheen = -1,
}) => {
  const uid = useUid('decoMed');
  const tiers: [number, number, number][] = [
    [0.64, 0.36, 1.05],
    [0.47, 0.12, 0.36],
    [0.33, -0.08, 0.12],
    [0.21, -0.26, -0.08],
    [0.11, -0.42, -0.26],
  ];
  const lift = (1 - rise) * r * 1.25;
  const sheenX = lerp(-1.6 * r, 1.6 * r, sheen);
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}gold`} x1={-r} y1={-r} x2={r} y2={r} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={DECO.hi} />
          <stop offset={0.45} stopColor={DECO.mid} />
          <stop offset={1} stopColor={DECO.lo} />
        </linearGradient>
        <clipPath id={`${uid}disc`}>
          <circle r={r} />
        </clipPath>
        <linearGradient
          id={`${uid}sheen`}
          x1={sheenX - r * 0.5}
          y1={0}
          x2={sheenX + r * 0.5}
          y2={0}
          gradientUnits="userSpaceOnUse"
          gradientTransform="rotate(-35)"
        >
          <stop offset={0} stopColor="#fff" stopOpacity={0} />
          <stop offset={0.5} stopColor="#fff" stopOpacity={0.55} />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <circle r={r} fill={`url(#${uid}gold)`} />
      <g clipPath={`url(#${uid}disc)`}>
        {/* Гравированные лучи восхода за башней */}
        {Array.from({length: 23}, (_, i) => {
          const a = deg(-90 + (i - 11) * 7.5);
          return (
            <line
              key={i}
              x1={0}
              y1={-0.42 * r + lift}
              x2={Math.cos(a) * r * 1.4}
              y2={-0.42 * r + lift + Math.sin(a) * r * 1.4}
              stroke={DECO.lo}
              strokeOpacity={0.55}
              strokeWidth={Math.max(0.8, r * 0.006)}
            />
          );
        })}
        {[0.9, 0.82].map((k) => (
          <circle key={k} r={r * k} fill="none" stroke={DECO.lo} strokeOpacity={0.5} strokeWidth={Math.max(0.8, r * 0.005)} />
        ))}
        {/* Ступенчатая башня */}
        <g transform={`translate(0 ${lift})`}>
          {tiers.map(([w, y0, y1], i) => (
            <rect key={i} x={-w * r} y={y0 * r} width={2 * w * r} height={(y1 - y0) * r} fill={DECO.bg} />
          ))}
          <path
            d={polyPath([
              [-0.045 * r, -0.42 * r],
              [0.045 * r, -0.42 * r],
              [0, -0.8 * r],
            ])}
            fill={DECO.bg}
          />
          {Array.from({length: 11}, (_, i) => (
            <line
              key={i}
              x1={(-0.5 + i * 0.1) * r}
              y1={0.44 * r}
              x2={(-0.5 + i * 0.1) * r}
              y2={0.95 * r}
              stroke={DECO.mid}
              strokeOpacity={0.55}
              strokeWidth={Math.max(0.7, r * 0.005)}
            />
          ))}
          {Array.from({length: 7}, (_, i) => (
            <line
              key={`b${i}`}
              x1={(-0.27 + i * 0.09) * r}
              y1={0.17 * r}
              x2={(-0.27 + i * 0.09) * r}
              y2={0.32 * r}
              stroke={DECO.mid}
              strokeOpacity={0.5}
              strokeWidth={Math.max(0.7, r * 0.005)}
            />
          ))}
        </g>
        {sheen >= 0 && sheen <= 1 ? (
          <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={`url(#${uid}sheen)`} style={{mixBlendMode: 'screen'}} />
        ) : null}
      </g>
      <circle r={r * 0.985} fill="none" stroke={DECO.deep} strokeWidth={Math.max(1, r * 0.022)} />
      <circle r={r} fill="none" stroke={DECO.hi} strokeOpacity={0.9} strokeWidth={Math.max(0.8, r * 0.008)} />
      {/* лёгкое мерцание кромки */}
      <circle r={r} fill="none" stroke="#fff" strokeOpacity={0.12 + 0.08 * Math.sin(t * 0.3)} strokeWidth={Math.max(0.6, r * 0.004)} />
    </g>
  );
};

// Табличка с вырезанными углами
const plate = (w: number, h: number, n: number): Pt[] => [
  [-w + n, -h],
  [w - n, -h],
  [w - n, -h + n],
  [w, -h + n],
  [w, h - n],
  [w - n, h - n],
  [w - n, h],
  [-w + n, h],
  [-w + n, h - n],
  [-w, h - n],
  [-w, -h + n],
  [-w + n, -h + n],
];

export const ArtDeco: React.FC = () => {
  const t = useT();
  const uid = useUid('deco');

  const beams = tw(t, 4, 24, 0, 1, EASE.inOutSine);
  const spin = t * 0.06;
  const plateK = tw(t, 12, 26, 0, 1, EASE.outExpo);
  const lines = tw(t, 18, 34, 0, 1, EASE.outCubic);
  const track = tw(t, 18, 44, 0.95, 0.34, EASE.outCubic);
  const titleOp = tw(t, 18, 30, 0, 1, EASE.outCubic);
  const titleSize = 92;
  const sheenTitle = prog(t, 46, 64);

  return (
    <AbsoluteFill style={{backgroundColor: DECO.bg}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id={`${uid}glow`} cx={CX} cy={CY} r={760} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#E9C778" stopOpacity={0.38} />
            <stop offset={0.4} stopColor="#C99A45" stopOpacity={0.12} />
            <stop offset={1} stopColor="#C99A45" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}beam`} cx={CX} cy={CY} r={1250} gradientUnits="userSpaceOnUse">
            <stop offset={0.18} stopColor="#F4DC9C" stopOpacity={0.42} />
            <stop offset={0.55} stopColor="#E3BF6A" stopOpacity={0.12} />
            <stop offset={1} stopColor="#E3BF6A" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}vig`} cx={CX} cy={CY} r={1150} gradientUnits="userSpaceOnUse">
            <stop offset={0.45} stopColor="#000" stopOpacity={0} />
            <stop offset={1} stopColor="#000" stopOpacity={0.6} />
          </radialGradient>
          <linearGradient id={`${uid}title`} x1={0} y1={870} x2={0} y2={945} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={DECO.hi} />
            <stop offset={0.55} stopColor={DECO.mid} />
            <stop offset={1} stopColor="#F1D990" />
          </linearGradient>
          <linearGradient
            id={`${uid}titleSheen`}
            x1={lerp(520, 1400, sheenTitle) - 90}
            y1={0}
            x2={lerp(520, 1400, sheenTitle) + 90}
            y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={0} stopColor="#fff" stopOpacity={0} />
            <stop offset={0.5} stopColor="#fff" stopOpacity={sheenTitle > 0 && sheenTitle < 1 ? 0.95 : 0} />
            <stop offset={1} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>

        <rect width={1920} height={1080} fill={`url(#${uid}glow)`} />

        {/* Лучи-прожекторы (свет) */}
        <g style={{mixBlendMode: 'screen'}} opacity={beams} transform={`rotate(${spin} ${CX} ${CY})`}>
          {Array.from({length: 16}, (_, i) => {
            const a = deg(i * 22.5 + 11.25 - 90);
            const w = deg(1.7);
            const r0 = 240;
            const r1 = 1500;
            const pts: Pt[] = [
              [CX + Math.cos(a - w * 0.2) * r0, CY + Math.sin(a - w * 0.2) * r0],
              [CX + Math.cos(a + w * 0.2) * r0, CY + Math.sin(a + w * 0.2) * r0],
              [CX + Math.cos(a + w) * r1, CY + Math.sin(a + w) * r1],
              [CX + Math.cos(a - w) * r1, CY + Math.sin(a - w) * r1],
            ];
            return <path key={i} d={polyPath(pts)} fill={`url(#${uid}beam)`} />;
          })}
        </g>

        {/* Тонкие золотые лучи: прорисовка от вертикали к низу, симметрично */}
        <g transform={`rotate(${spin * 0.5} ${CX} ${CY})`}>
          {Array.from({length: 64}, (_, i) => {
            const aDeg = i * (360 / 64);
            const d = Math.min(aDeg, 360 - aDeg) / 180;
            const q = EASE.inOutCubic(prog(t, 1 + 10 * d, 17 + 10 * d));
            const long = i % 2 === 0;
            const target = long ? 1250 : 720;
            const r0 = 262;
            const r1 = lerp(r0, target, q);
            const a = deg(aDeg - 90);
            return q > 0 ? (
              <line
                key={i}
                x1={CX + Math.cos(a) * r0}
                y1={CY + Math.sin(a) * r0}
                x2={CX + Math.cos(a) * r1}
                y2={CY + Math.sin(a) * r1}
                stroke={DECO.mid}
                strokeOpacity={long ? 0.5 : 0.32}
                strokeWidth={1.4}
              />
            ) : null;
          })}
        </g>

        {/* Кольца: замыкаются от верхней точки в обе стороны */}
        {[
          {r: 252, w: 2.6, c: DECO.mid, o: 1, a: 2, b: 20},
          {r: 268, w: 1, c: DECO.hi, o: 0.7, a: 5, b: 23},
        ].map((ring) => {
          const half = Math.PI * ring.r;
          const q = EASE.inOutCubic(prog(t, ring.a, ring.b));
          const d = `M ${CX} ${CY - ring.r} A ${ring.r} ${ring.r} 0 0 1 ${CX} ${CY + ring.r}`;
          return [1, -1].map((s) => (
            <path
              key={`${ring.r}${s}`}
              d={d}
              fill="none"
              stroke={ring.c}
              strokeOpacity={ring.o}
              strokeWidth={ring.w}
              strokeDasharray={`${half * q} ${half}`}
              transform={s === -1 ? `translate(${2 * CX} 0) scale(-1 1)` : undefined}
            />
          ));
        })}
        {Array.from({length: 72}, (_, i) => {
          const aDeg = i * 5;
          const d = Math.min(aDeg, 360 - aDeg) / 180;
          const s = t < 8 + 14 * d ? 0 : springAt(t, 8 + 14 * d, {damping: 11, stiffness: 300});
          const a = deg(aDeg - 90);
          const x = CX + Math.cos(a) * 286;
          const y = CY + Math.sin(a) * 286;
          const tw2 = 0.6 + 0.4 * Math.sin(t * 0.25 + i * 0.9);
          return (
            <rect
              key={i}
              x={-3.2}
              y={-3.2}
              width={6.4}
              height={6.4}
              fill={DECO.hi}
              opacity={tw2}
              transform={`translate(${x} ${y}) rotate(${aDeg + 45}) scale(${s})`}
            />
          );
        })}
        <circle
          cx={CX}
          cy={CY}
          r={304}
          fill="none"
          stroke={DECO.mid}
          strokeWidth={1}
          strokeDasharray="2 7"
          opacity={tw(t, 14, 26, 0, 0.8)}
        />

        {/* Медальон */}
        <g transform={`translate(${CX} ${CY})`}>
          <DecoMedallion r={R} t={t} rise={tw(t, 4, 22, 0, 1, EASE.outCubic)} sheen={prog(t, 28, 48) || -1} />
        </g>

        {/* Табличка и название */}
        <g opacity={lines}>
          {[-1, 1].map((s) => (
            <g key={s}>
              <line
                x1={CX + s * 392}
                y1={905}
                x2={CX + s * lerp(392, 720, lines)}
                y2={905}
                stroke={DECO.mid}
                strokeWidth={1.2}
              />
              <rect
                x={-5}
                y={-5}
                width={10}
                height={10}
                fill={DECO.hi}
                transform={`translate(${CX + s * lerp(392, 734, lines)} 905) rotate(45)`}
              />
            </g>
          ))}
        </g>
        <g transform={`translate(${CX} 905) scale(${plateK} 1)`}>
          <path d={polyPath(plate(380, 56, 14))} fill={DECO.bg} stroke={DECO.mid} strokeWidth={2} />
          <path d={polyPath(plate(370, 46, 10))} fill="none" stroke={DECO.hi} strokeOpacity={0.6} strokeWidth={1} />
        </g>
        {[`url(#${uid}title)`, `url(#${uid}titleSheen)`].map((fill, i) => (
          <text
            key={i}
            x={CX + (track * titleSize) / 2}
            y={937}
            textAnchor="middle"
            fontFamily={FONT.deco}
            fontSize={titleSize}
            letterSpacing={`${track}em`}
            fill={fill}
            opacity={titleOp}
          >
            АР-ДЕКО
          </text>
        ))}

        <rect width={1920} height={1080} fill={`url(#${uid}vig)`} />
      </svg>
    </AbsoluteFill>
  );
};
