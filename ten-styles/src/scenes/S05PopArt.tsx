import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {EASE, shake, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {deg, polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 05 · Поп-арт: взрыв, растр Бен-Дей, жирный контур.
// Растровая светотень на круге поворачивается вслед за источником света.
export const POP = {
  yellow: '#FFD21F',
  dots: '#F29A00',
  red: '#E8202A',
  redDark: '#8F0C17',
  blue: '#1E5BD8',
  black: '#111111',
  white: '#FFFDF5',
};

const C: Pt = [960, 520];
const R = 250;

const BURST: Pt[] = Array.from({length: 32}, (_, i) => {
  const a = deg(i * (360 / 32) - 90);
  const outer = i % 2 === 0;
  const rr = outer ? 470 + (random(`bo${i}`) - 0.5) * 90 : 368 + (random(`bi${i}`) - 0.5) * 30;
  return [Math.cos(a) * rr, Math.sin(a) * rr] as Pt;
});

/** Красный круг с растровой светотенью. Центр (0,0). lightA — направление на свет. */
export const PopDisc: React.FC<{r: number; lightA: number; outline?: number}> = ({r, lightA, outline}) => {
  const uid = useUid('popD');
  const L = [Math.cos(lightA) * 0.62, Math.sin(lightA) * 0.62, 0.78];
  const step = r / 15.5;
  const dots: React.ReactNode[] = [];
  for (let gy = -r; gy <= r; gy += step) {
    const row = Math.round((gy + r) / step);
    for (let gx = -r + (row % 2 ? step / 2 : 0); gx <= r; gx += step) {
      const d2 = (gx * gx + gy * gy) / (r * r);
      if (d2 >= 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lit = Math.max(0, (gx / r) * L[0] + (gy / r) * L[1] + nz * L[2]);
      const shadeK = Math.pow(1 - lit, 1.35);
      const rad = step * 0.62 * shadeK;
      if (rad > 0.35) dots.push(<circle key={`${gx}-${gy}`} cx={gx} cy={gy} r={rad} />);
    }
  }
  const hx = Math.cos(lightA) * r * 0.5;
  const hy = Math.sin(lightA) * r * 0.5;
  const hRot = (lightA * 180) / Math.PI + 90;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}c`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={POP.red} />
      <g clipPath={`url(#${uid}c)`} fill={POP.redDark}>
        {dots}
      </g>
      <ellipse cx={hx} cy={hy} rx={r * 0.27} ry={r * 0.11} fill={POP.white} transform={`rotate(${hRot} ${hx} ${hy})`} />
      <circle cx={hx * 1.42} cy={hy * 1.42} r={r * 0.045} fill={POP.white} />
      <circle r={r} fill="none" stroke={POP.black} strokeWidth={outline ?? r * 0.048} />
    </g>
  );
};

export const PopArt: React.FC = () => {
  const t = useT();

  const burst = t < 0 ? 0 : springAt(t, 0, {damping: 8, stiffness: 190});
  const disc = t < 2 ? 0 : springAt(t, 2, {damping: 9, stiffness: 220});
  const slam = tw(t, 10, 15, 2.6, 1, EASE.inCubic);
  const settle = t < 15 ? 0 : (1 - springAt(t, 15, {damping: 7, stiffness: 320})) * -0.06;
  const titleScale = slam + settle;
  const titleRot = tw(t, 10, 15, -15, -6, EASE.inCubic);
  const [sx, sy] = shake(t, 15, 7, 15, 5);
  const impact = t >= 15 && t < 17;
  const lightA = deg(tw(t, 0, 80, -150, -35, EASE.inOutSine));
  const beat = Math.exp(-((t % 20) / 4)) * (t >= 20 ? 1 : 0);

  // Фон: растр крупнеет к краям, по нему бежит волна
  const bgDots: React.ReactNode[] = [];
  const S = 30;
  for (let j = 0; j < 37; j++) {
    for (let i = 0; i < 65; i++) {
      const x = i * S + (j % 2 ? S / 2 : 0);
      const y = j * S;
      const d = Math.hypot(x - C[0], y - C[1]);
      const k = Math.min(1, d / 1050);
      const wave = 1 + 0.28 * Math.sin(d / 46 - t * 0.55);
      const rr = (2 + 9.5 * k) * wave;
      bgDots.push(<circle key={`${i}-${j}`} cx={x} cy={y} r={rr} />);
    }
  }
  const lineSet = Math.floor(t / 3) % 2;

  return (
    <AbsoluteFill style={{backgroundColor: POP.yellow, filter: impact ? 'invert(1)' : undefined}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{translate: `${sx}px ${sy}px`}}>
        <g fill={POP.dots}>{bgDots}</g>

        {/* Линии действия */}
        <g opacity={tw(t, 0, 6, 0, 0.9)}>
          {Array.from({length: 36}, (_, i) => {
            if (i % 2 !== lineSet) return null;
            const a = deg(i * 10 + random(`la${i}`) * 4);
            const w0 = deg(0.5);
            const w1 = deg(1.6 + random(`lw${i}`) * 1.2);
            const r0 = 560 + random(`lr${i}`) * 120;
            const r1 = 1400;
            return (
              <path
                key={i}
                d={polyPath([
                  [C[0] + Math.cos(a - w0) * r0, C[1] + Math.sin(a - w0) * r0],
                  [C[0] + Math.cos(a + w0) * r0, C[1] + Math.sin(a + w0) * r0],
                  [C[0] + Math.cos(a + w1) * r1, C[1] + Math.sin(a + w1) * r1],
                  [C[0] + Math.cos(a - w1) * r1, C[1] + Math.sin(a - w1) * r1],
                ])}
                fill={POP.black}
              />
            );
          })}
        </g>

        {/* Взрыв */}
        <g transform={`translate(${C[0]} ${C[1]}) rotate(${(1 - burst) * -14 + Math.sin(t * 0.12) * 1.5}) scale(${burst * (1 + 0.025 * beat)})`}>
          <path d={polyPath(BURST)} fill={POP.blue} stroke={POP.black} strokeWidth={9} strokeLinejoin="round" transform="translate(18 18)" />
          <path d={polyPath(BURST)} fill={POP.white} stroke={POP.black} strokeWidth={9} strokeLinejoin="round" />
        </g>

        {/* Круг */}
        <g transform={`translate(${C[0]} ${C[1]}) scale(${disc})`}>
          <PopDisc r={R} lightA={lightA} />
        </g>

        {/* Заголовок со слэм-зумом */}
        <g transform={`translate(960 905) rotate(${titleRot}) scale(${titleScale})`} opacity={t < 10 ? 0 : 1}>
          {[
            {dx: 14, dy: 14, fill: POP.blue},
            {dx: 0, dy: 0, fill: POP.white},
          ].map((l, i) => (
            <text
              key={i}
              x={l.dx}
              y={l.dy}
              textAnchor="middle"
              fontFamily={FONT.pop}
              fontStyle="italic"
              fontWeight={900}
              fontSize={196}
              letterSpacing="-0.01em"
              fill={l.fill}
              stroke={POP.black}
              strokeWidth={16}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              ПОП-АРТ
            </text>
          ))}
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at ${C[0]}px ${C[1]}px, rgba(255,255,255,${(0.5 * Math.exp(-Math.max(0, t - 15) / 2.5) * (t >= 15 ? 1 : 0)).toFixed(3)}) 0px, rgba(255,255,255,0) 900px)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
