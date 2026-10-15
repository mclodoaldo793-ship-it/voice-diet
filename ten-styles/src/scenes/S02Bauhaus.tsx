import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Grain} from '../components/Grain';
import {EASE, lerp, prog, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {circlePts, deg, longShadow, ngon, polyPath, type Pt, rotPt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 02 · Баухаус: механическая сборка основных фигур. Свет обходит композицию,
// жёсткие тени поворачиваются вслед за ним.
export const BAU = {
  bg: '#EFE7D6',
  red: '#D63A2F',
  yellow: '#F2B417',
  blue: '#1F4E9C',
  black: '#161616',
};

const CIRCLE_END: Pt = [720, 470];
const SQUARE_C: Pt = [1180, 380];
const TRI_C: Pt = [980, 600];
const TITLE = 'баухаус';

/** Синий круг Баухауса с «катящимся» диаметром. Центр (0,0). */
export const BauhausDisc: React.FC<{r: number; roll: number}> = ({r, roll}) => (
  <g>
    <circle r={r} fill={BAU.blue} />
    <g transform={`rotate(${roll})`}>
      <rect x={-r} y={-r * 0.024} width={2 * r} height={r * 0.048} fill={BAU.black} />
      <circle cx={r * 0.62} cy={0} r={r * 0.11} fill={BAU.bg} />
    </g>
  </g>
);

export const Bauhaus: React.FC = () => {
  const t = useT();
  const uid = useUid('bau');

  // Круг откатывается из центра кадра (точка склейки) на своё место
  const move = tw(t, 2, 17, 0, 1, EASE.machine);
  const cx = lerp(960, CIRCLE_END[0], move);
  const cy = lerp(540, CIRCLE_END[1], move);
  const r = lerp(230, 250, move);
  const tick = (a: number) => 90 * EASE.machine(prog(t, a, a + 6));
  const roll = ((cx - 960) / r) * (180 / Math.PI) + tick(40) + tick(60);

  // Квадрат кувыркается справа
  const sqIn = tw(t, 5, 18, 0, 1, EASE.outCubic);
  const sqSettle = t < 18 ? 0 : springAt(t, 18, {damping: 9, stiffness: 300});
  const sqX = lerp(SQUARE_C[0] + 860, SQUARE_C[0], sqIn);
  const sqRot = lerp(-270, 0, sqIn) + (1 - sqSettle) * 4 + tick(50);

  // Треугольник падает с ускорением и чуть приседает при ударе
  const fall = tw(t, 11, 24, 0, 1, EASE.inQuad);
  const triY = lerp(-420, TRI_C[1], fall);
  const squash = t < 24 ? 0 : Math.exp(-(t - 24) / 3) * Math.cos((t - 24) * 1.2);
  const triSX = 1 + 0.07 * squash;
  const triSY = 1 - 0.1 * squash;

  const bar = tw(t, 15, 30, 0, 1, EASE.outExpo);
  const vline = tw(t, 20, 32, 0, 1, EASE.machine);
  const half = tw(t, 6, 18, 0, 1, EASE.outCubic);
  const halfRot = 180 * EASE.machine(prog(t, 30, 36)) + 90 * EASE.machine(prog(t, 50, 56)) + 90 * EASE.machine(prog(t, 70, 76));

  // Свет обходит сцену → направление теней
  const lightA = deg(205 + t * 1.1);
  const shadowLen = 54 + 14 * Math.sin(t * 0.06);
  const sdx = -Math.cos(lightA) * shadowLen;
  const sdy = -Math.sin(lightA) * shadowLen;
  const lightPos: Pt = [960 + Math.cos(lightA) * 1100, 540 + Math.sin(lightA) * 700];

  const squarePts = ngon(sqX, SQUARE_C[1], 150 * Math.SQRT2, 4, deg(sqRot + 45));
  const triPts = ngon(TRI_C[0], triY, 215, 3).map(([x, y]) => [TRI_C[0] + (x - TRI_C[0]) * triSX, triY + (y - triY) * triSY] as Pt);
  const discPts = circlePts(cx, cy, r, 72);
  const halfPts: Pt[] = Array.from({length: 33}, (_, i) => {
    const a = deg(-180 + i * (180 / 32));
    return [Math.cos(a) * 70, Math.sin(a) * 70] as Pt;
  }).map((p) => rotPt(p, deg(halfRot)))
    .map(([x, y]) => [360 + x * half, 230 + y * half] as Pt);

  const shadows = [discPts, squarePts, triPts, halfPts]
    .map((pts) => polyPath(longShadow(pts, sdx, sdy)))
    .join(' ');

  const letters = TITLE.split('');

  return (
    <AbsoluteFill style={{backgroundColor: BAU.bg}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id={`${uid}light`} cx={lightPos[0]} cy={lightPos[1]} r={1500} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#FFF9EC" stopOpacity={0.85} />
            <stop offset={0.55} stopColor="#FFF9EC" stopOpacity={0.15} />
            <stop offset={1} stopColor="#E6DAC2" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}shade`} cx={960} cy={540} r={1200} gradientUnits="userSpaceOnUse">
            <stop offset={0.5} stopColor="#7A6243" stopOpacity={0} />
            <stop offset={1} stopColor="#7A6243" stopOpacity={0.18} />
          </radialGradient>
        </defs>
        <rect width={1920} height={1080} fill={`url(#${uid}light)`} />
        <rect width={1920} height={1080} fill={`url(#${uid}shade)`} />

        {/* Тени от бегущего света */}
        <path d={shadows} fill="#5A4428" fillOpacity={0.17} />
        <rect
          x={300 + sdx * 0.5}
          y={790 + sdy * 0.5}
          width={1320 * bar}
          height={22}
          fill="#5A4428"
          fillOpacity={0.12}
        />

        {/* Чёрная планка и вертикаль */}
        <rect x={300} y={790} width={1320 * bar} height={22} fill={BAU.black} />
        <rect x={1556} y={150} width={8} height={640 * vline} fill={BAU.black} />

        {/* Полукруг-«шестерня» */}
        <path d={polyPath(halfPts)} fill={BAU.black} />

        {/* Фигуры с наложением как в печати (multiply) */}
        <g style={{mixBlendMode: 'multiply'}}>
          <g transform={`translate(${cx} ${cy})`}>
            <BauhausDisc r={r} roll={roll} />
          </g>
        </g>
        <path d={polyPath(squarePts)} fill={BAU.red} style={{mixBlendMode: 'multiply'}} />
        <path d={polyPath(triPts)} fill={BAU.yellow} style={{mixBlendMode: 'multiply'}} />

        {/* Строчное «баухаус» набирается механически */}
        <text x={300} y={975} fontFamily={FONT.bauhaus} fontWeight={700} fontSize={190} letterSpacing="-0.01em" fill={BAU.black}>
          {letters.map((ch, i) => {
            const st = 22 + i * 2.6;
            const y = tw(t, st, st + 7, 46, 0, EASE.machine);
            const prevY = i === 0 ? 0 : tw(t, st - 2.6, st - 2.6 + 7, 46, 0, EASE.machine);
            return (
              <tspan key={i} dy={i === 0 ? y : y - prevY} fillOpacity={tw(t, st, st + 2, 0, 1, EASE.linear)}>
                {ch}
              </tspan>
            );
          })}
        </text>
      </svg>
      <Grain opacity={0.22} />
    </AbsoluteFill>
  );
};

/** Значок для финала: синий круг и красный квадрат с наложением. Центр (0,0). */
export const BauhausBadge: React.FC<{r: number; t: number}> = ({r, t}) => (
  <g>
    <circle r={r} fill={BAU.bg} />
    <g style={{mixBlendMode: 'multiply'}}>
      <BauhausDisc r={r * 0.78} roll={-30 + 90 * Math.floor(t / 20) + 90 * EASE.machine(prog(t % 20, 0, 6))} />
    </g>
    <rect x={r * 0.12} y={r * 0.12} width={r * 0.6} height={r * 0.6} fill={BAU.red} style={{mixBlendMode: 'multiply'}} />
    <path d={polyPath(ngon(-0.42 * r, 0.48 * r, 0.3 * r, 3))} fill={BAU.yellow} style={{mixBlendMode: 'multiply'}} />
    <circle r={r} fill="none" stroke={BAU.black} strokeOpacity={0.25} strokeWidth={Math.max(1, r * 0.01)} />
  </g>
);
