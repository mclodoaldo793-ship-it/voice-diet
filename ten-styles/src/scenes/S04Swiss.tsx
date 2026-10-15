import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EASE, lerp, prog, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {useUid} from '../lib/geom';
import {useT} from '../lib/time';

// 04 · Швейцарский стиль: модульная сетка, гротеск, один красный круг.
// Круг шагает по колонкам и выворачивает буквы, над которыми проходит.
export const SWISS = {
  paper: '#F2F1ED',
  ink: '#0F0F0F',
  red: '#E2231A',
};

const MARGIN = 80;
const GUTTER = 20;
const COL = (1920 - 2 * MARGIN - 11 * GUTTER) / 12;
const PITCH = COL + GUTTER;
const R = 212;
const CY = 560;
// шаги круга — на восьмые доли (авторские 30/40/50/60 = реальные 21/28/35/42)
const STEPS = [30, 40, 50, 60];
const X0 = 1233.33;
const CAPTIONS: [string, string][] = [
  ['01', 'Сетка'],
  ['02', 'Гротеск'],
  ['03', 'Порядок'],
];

/** Значок для финала: бумага, сетка и красный круг. Центр (0,0). */
export const SwissBadge: React.FC<{r: number}> = ({r}) => {
  const uid = useUid('swB');
  return (
    <g>
      <defs>
        <clipPath id={`${uid}c`}>
          <circle r={r} />
        </clipPath>
      </defs>
      <circle r={r} fill={SWISS.paper} />
      <g clipPath={`url(#${uid}c)`}>
        {[-0.6, -0.2, 0.2, 0.6].map((k) => (
          <line key={k} x1={k * r} y1={-r} x2={k * r} y2={r} stroke={SWISS.ink} strokeOpacity={0.18} strokeWidth={1} />
        ))}
        <circle cx={0.22 * r} cy={0.18 * r} r={0.56 * r} fill={SWISS.red} />
        <rect x={-0.7 * r} y={-0.56 * r} width={0.62 * r} height={0.1 * r} fill={SWISS.ink} />
        <rect x={-0.7 * r} y={-0.38 * r} width={0.36 * r} height={0.1 * r} fill={SWISS.ink} />
      </g>
      <circle r={r} fill="none" stroke={SWISS.ink} strokeOpacity={0.25} strokeWidth={Math.max(1, r * 0.01)} />
    </g>
  );
};

export const Swiss: React.FC = () => {
  const t = useT();
  const uid = useUid('sw');

  const steps = STEPS.reduce((acc, s) => acc + EASE.outQuart(prog(t, s, s + 7)), 0);
  const cx = X0 - steps * PITCH;
  const scale = tw(t, 10, 22, 0, 1, EASE.outQuart);
  const r = R * scale;

  // строки начинают выезжать ещё под колонками перехода
  const line1 = tw(t, -7, 7, 1, 0, EASE.outQuart);
  const line2 = tw(t, -3, 11, 1, 0, EASE.outQuart);
  const sheen = prog(t, 24, 80);

  const headline = (fill: string) => (
    <g fontFamily={FONT.swiss} fontWeight={800} fontSize={200} letterSpacing="-0.045em" fill={fill}>
      <g clipPath={`url(#${uid}l1)`}>
        <text x={68} y={300 + line1 * 210}>
          Швейцарский
        </text>
      </g>
      <g clipPath={`url(#${uid}l2)`}>
        <text x={68} y={480 + line2 * 210}>
          стиль
        </text>
      </g>
    </g>
  );

  return (
    <AbsoluteFill style={{backgroundColor: SWISS.paper}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <clipPath id={`${uid}l1`}>
            <rect x={0} y={120} width={1920} height={232} />
          </clipPath>
          <clipPath id={`${uid}l2`}>
            <rect x={0} y={352} width={1920} height={180} />
          </clipPath>
          <clipPath id={`${uid}circle`}>
            <circle cx={cx} cy={CY} r={r} />
          </clipPath>
          <linearGradient
            id={`${uid}sheen`}
            x1={lerp(-600, 2400, sheen)}
            y1={0}
            x2={lerp(-600, 2400, sheen) + 500}
            y2={300}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={0} stopColor="#fff" stopOpacity={0} />
            <stop offset={0.5} stopColor="#fff" stopOpacity={0.55} />
            <stop offset={1} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Модульная сетка */}
        {Array.from({length: 12}, (_, i) => {
          const h = 1080 * EASE.outQuart(prog(t, i * 0.7, 12 + i * 0.7));
          const x = MARGIN + i * PITCH;
          return (
            <g key={i} opacity={0.09}>
              <rect x={x} y={0} width={1} height={h} fill={SWISS.ink} />
              <rect x={x + COL - 1} y={0} width={1} height={h} fill={SWISS.ink} />
            </g>
          );
        })}
        {[120, 352, 532, 850].map((y, i) => (
          <rect key={y} x={0} y={y} width={1920 * EASE.outQuart(prog(t, 2 + i, 16 + i))} height={1} fill={SWISS.ink} opacity={0.09} />
        ))}

        {headline(SWISS.ink)}

        {/* Красный круг и вывороченные буквы внутри него */}
        <circle cx={cx} cy={CY} r={r} fill={SWISS.red} />
        <g clipPath={`url(#${uid}circle)`}>{headline(SWISS.paper)}</g>

        {/* Подписи по колонкам */}
        {CAPTIONS.map(([num, word], k) => {
          const x = MARGIN + k * 3 * PITCH;
          const st = 18 + k * 4;
          const rule = tw(t, st, st + 10, 0, 1, EASE.outQuart);
          const up = tw(t, st + 3, st + 13, 1, 0, EASE.outQuart);
          return (
            <g key={num}>
              <rect x={x} y={850} width={(2 * COL + GUTTER) * rule} height={3} fill={SWISS.ink} />
              <g clipPath={`url(#${uid}cap)`}>
                <text x={x} y={896 + up * 70} fontFamily={FONT.swiss} fontWeight={500} fontSize={26} fill={SWISS.red}>
                  {num}
                </text>
                <text x={x} y={938 + up * 70} fontFamily={FONT.swiss} fontWeight={800} fontSize={34} letterSpacing="-0.02em" fill={SWISS.ink}>
                  {word}
                </text>
              </g>
            </g>
          );
        })}
        <defs>
          <clipPath id={`${uid}cap`}>
            <rect x={0} y={856} width={1920} height={100} />
          </clipPath>
        </defs>

        {/* Справочный блок в колонках 9–12 */}
        {['Интернациональный', 'типографический стиль'].map((line, i) => {
          const st = 30 + i * 4;
          const up = tw(t, st, st + 12, 1, 0, EASE.outQuart);
          return (
            <g key={line} clipPath={`url(#${uid}info${i})`}>
              <text
                x={MARGIN + 8 * PITCH}
                y={690 + i * 40 + up * 50}
                fontFamily={FONT.swiss}
                fontWeight={500}
                fontSize={32}
                letterSpacing="-0.01em"
                fill={SWISS.ink}
              >
                {line}
              </text>
            </g>
          );
        })}
        <rect x={MARGIN + 8 * PITCH} y={630} width={(4 * COL + 3 * GUTTER) * tw(t, 26, 40, 0, 1, EASE.outQuart)} height={3} fill={SWISS.red} />
        <defs>
          {[0, 1].map((i) => (
            <clipPath key={i} id={`${uid}info${i}`}>
              <rect x={0} y={652 + i * 40} width={1920} height={50} />
            </clipPath>
          ))}
        </defs>

        {/* Свет скользит по бумаге */}
        <rect width={1920} height={1080} fill={`url(#${uid}sheen)`} opacity={0.5} />
      </svg>
    </AbsoluteFill>
  );
};
