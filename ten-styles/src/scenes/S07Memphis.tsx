import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {bounce, bounceImpact, EASE, prog, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {ngon, polyPath, type Pt, useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 07 · Мемфис: игра. Пружины, squash & stretch, паттерны.
// Свет — жёсткие смещённые тени: тень отрывается, когда фигура в воздухе.
export const MEM = {
  bg: '#FFD3E0',
  mint: '#8EE3C8',
  yellow: '#FFE14A',
  cobalt: '#2B59FF',
  black: '#121212',
  lilac: '#B79CFF',
  coral: '#FF6F59',
  white: '#FFFFFF',
};
const C: Pt = [860, 470];
const R = 220;
const TITLE = 'МЕМФИС';
const LETTER_COLORS = [MEM.cobalt, MEM.coral, MEM.mint, MEM.yellow, MEM.lilac, MEM.cobalt];

/** Жёлтый круг с чёрными полосами. Центр (0,0). */
export const MemphisDisc: React.FC<{r: number}> = ({r}) => {
  const uid = useUid('memD');
  return (
    <g>
      <defs>
        <clipPath id={`${uid}half`}>
          <path d={`M0 ${-r} A${r} ${r} 0 0 1 0 ${r} Z`} />
        </clipPath>
      </defs>
      <circle r={r} fill={MEM.yellow} />
      <g clipPath={`url(#${uid}half)`}>
        {Array.from({length: 14}, (_, i) => (
          <rect
            key={i}
            x={-r * 1.5 + i * r * 0.22}
            y={-r * 1.5}
            width={r * 0.085}
            height={r * 3}
            fill={MEM.black}
            transform={`rotate(45)`}
          />
        ))}
      </g>
      <circle r={r} fill="none" stroke={MEM.black} strokeWidth={Math.max(1.5, r * 0.032)} />
    </g>
  );
};

const squiggle = (x0: number, y0: number, len: number, amp: number, waves: number, phase: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const k = i / 80;
    pts.push(`${(x0 + k * len).toFixed(1)},${(y0 + Math.sin(k * waves * Math.PI * 2 + phase) * amp).toFixed(1)}`);
  }
  return pts.join(' ');
};

const CONFETTI = Array.from({length: 24}, (_, i) => ({
  x: 80 + random(`cfx${i}`) * 1760,
  y: 80 + random(`cfy${i}`) * 900,
  kind: Math.floor(random(`cfk${i}`) * 3),
  color: [MEM.cobalt, MEM.coral, MEM.mint, MEM.lilac, MEM.black, MEM.yellow][Math.floor(random(`cfc${i}`) * 6)],
  rot: random(`cfr${i}`) * 360,
  spin: (random(`cfs${i}`) - 0.5) * 6,
  delay: random(`cfd${i}`) * 16,
}));

export const Memphis: React.FC = () => {
  const t = useT();
  const uid = useUid('mem');

  // Круг падает сверху на «пол» и дважды отскакивает, сжимаясь при касании
  const lift = -bounce(t, 760, 10);
  const vel = Math.min(1, lift / 300);
  const land = bounceImpact(t, 10);
  const inflate = tw(t, 66, 80, 0, 1, EASE.inCubic);
  const sx = (1 + 0.14 * land) * (1 + 0.22 * inflate + 0.03 * Math.sin(t * 1.3) * inflate);
  const sy = (1 - 0.14 * land) * (1 + 0.22 * inflate - 0.03 * Math.sin(t * 1.3) * inflate);
  const shadowOff = 16 + Math.min(40, lift * 0.06) + 18 * inflate;

  const pop = (st: number, damping = 8) => (t < st ? 0 : springAt(t, st, {damping, stiffness: 240}));
  const half = pop(4);
  const tri = pop(7);
  const zig = tw(t, 9, 24, 0, 1, EASE.outCubic);
  const squig = tw(t, 6, 20, 0, 1, EASE.outCubic);
  const dotsK = tw(t, 2, 16, 0, 1, EASE.outCubic);

  const letters = TITLE.split('');
  let prev = 0;
  const letterSpans = (fillFor: (i: number) => string) =>
    letters.map((ch, i) => {
      const st = 10 + i * 2.2;
      const hop = [40, 60].reduce((acc, b) => acc + Math.sin(Math.PI * prog(t, b + i * 2, b + i * 2 + 8)) * 30, 0);
      const y = bounce(t - st, 260, 8) - hop;
      const dy = y - (i === 0 ? 0 : prev);
      prev = y;
      return (
        <tspan key={i} dy={i === 0 ? y : dy} fill={fillFor(i)} fillOpacity={t < st ? 0 : 1} strokeOpacity={t < st ? 0 : 1}>
          {ch}
        </tspan>
      );
    });

  const titleRot = letters.map((_, i) => (i % 2 === 0 ? -5 : 4) + 3 * Math.sin(t * 0.15 + i)).join(' ');

  return (
    <AbsoluteFill style={{backgroundColor: MEM.bg}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <pattern id={`${uid}polka`} width={26} height={26} patternUnits="userSpaceOnUse">
            <circle cx={13} cy={13} r={5} fill={MEM.white} />
          </pattern>
        </defs>

        {/* Сетка точек */}
        {Array.from({length: 9}, (_, j) =>
          Array.from({length: 15}, (_, i) => {
            const k = prog(dotsK * 30, i + j, i + j + 6);
            return <circle key={`${i}-${j}`} cx={130 + i * 34} cy={150 + j * 34} r={4.2 * k} fill={MEM.black} />;
          }),
        )}

        {/* Сквигглы */}
        <polyline
          points={squiggle(1260, 170, 520, 26, 4, t * 0.25)}
          fill="none"
          stroke={MEM.black}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${700 * squig} 2000`}
        />
        <polyline
          points={squiggle(120, 985, 420, 20, 3, -t * 0.3)}
          fill="none"
          stroke={MEM.cobalt}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${560 * squig} 2000`}
        />

        {/* Конфетти */}
        {CONFETTI.map((c, i) => {
          const s = t < c.delay ? 0 : springAt(t, c.delay, {damping: 9, stiffness: 260});
          const rot = c.rot + t * c.spin;
          const shape =
            c.kind === 0 ? (
              <rect x={-15} y={-6} width={30} height={12} rx={2} fill={c.color} />
            ) : c.kind === 1 ? (
              <path d={polyPath(ngon(0, 0, 13, 3))} fill={c.color} />
            ) : (
              <circle r={8} fill={c.color} />
            );
          return (
            <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${rot}) scale(${s})`}>
              {shape}
            </g>
          );
        })}

        {/* Мятный полукруг */}
        <g transform={`translate(1430 330) rotate(${-20 + 12 * Math.sin(t * 0.08)}) scale(${half})`}>
          <path d="M-170 0 A170 170 0 0 1 170 0 Z" fill={MEM.black} transform="translate(12 12)" />
          <path d="M-170 0 A170 170 0 0 1 170 0 Z" fill={MEM.mint} stroke={MEM.black} strokeWidth={6} strokeLinejoin="round" />
        </g>

        {/* Коралловый треугольник в горошек */}
        <g transform={`translate(540 760) rotate(${-12 + 8 * Math.sin(t * 0.1 + 1)}) scale(${tri})`}>
          <path d={polyPath(ngon(0, 0, 150, 3))} fill={MEM.black} transform="translate(12 12)" />
          <path d={polyPath(ngon(0, 0, 150, 3))} fill={MEM.coral} />
          <path d={polyPath(ngon(0, 0, 150, 3))} fill={`url(#${uid}polka)`} />
          <path d={polyPath(ngon(0, 0, 150, 3))} fill="none" stroke={MEM.black} strokeWidth={6} strokeLinejoin="round" />
        </g>

        {/* Кобальтовый зигзаг */}
        <polyline
          points={Array.from({length: 8}, (_, i) => `${1200 + i * 72},${i % 2 === 0 ? 820 : 760}`).join(' ')}
          fill="none"
          stroke={MEM.cobalt}
          strokeWidth={18}
          strokeLinejoin="miter"
          strokeDasharray={`${620 * zig} 2000`}
        />

        {/* Герой: жёлтый круг с тенью, которая отрывается в прыжке */}
        <g transform={`translate(${C[0]} ${C[1] - lift})`}>
          <circle cx={shadowOff} cy={shadowOff + lift * 0.4} r={R} fill={MEM.cobalt} opacity={1 - Math.min(0.6, vel * 0.8)} />
          <g transform={`translate(0 ${R}) scale(${sx} ${sy}) translate(0 ${-R})`}>
            <MemphisDisc r={R} />
          </g>
        </g>

        {/* МЕМФИС — буквы падают и прыгают волной */}
        <g fontFamily={FONT.memphis} fontWeight={400} fontSize={150} letterSpacing="0.01em">
          <text x={969} y={939} textAnchor="middle" rotate={titleRot} fill={MEM.black}>
            {letterSpans(() => MEM.black)}
          </text>
          {(() => {
            prev = 0;
            return (
              <text
                x={960}
                y={930}
                textAnchor="middle"
                rotate={titleRot}
                stroke={MEM.black}
                strokeWidth={6}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {letterSpans((i) => LETTER_COLORS[i])}
              </text>
            );
          })()}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
