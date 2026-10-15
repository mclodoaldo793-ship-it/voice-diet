import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp01, EASE, prog, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {useUid} from '../lib/geom';
import {STAGE} from '../lib/styles';
import {useT} from '../lib/time';

// Интро: точка в конце фразы «Один круг.» вырастает в круг-источник света
// и выталкивает слова. Круг освещает буквы со своей стороны.
const CX = 960;
const CY = 540;
const R = 230;
const DOT = 13;
const RING_R = 308;
const RING_TEXT = 'ДЕСЯТЬ СТИЛЕЙ · ДЕСЯТЬ СТИЛЕЙ · ДЕСЯТЬ СТИЛЕЙ · ';

const mix = (a: string, b: string, k: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp01(k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/** Радиус круга интро в момент t (используется и в финале, и в переходе) */
export const introRadius = (t: number) => {
  const dot = t < 7 ? 0 : springAt(t, 7, {damping: 9, stiffness: 240});
  const grow = t < 16 ? 0 : springAt(t, 16, {damping: 14, stiffness: 120});
  const dip = Math.sin(Math.PI * prog(t, 12, 16)) * 0.35;
  const breathe = Math.sin(Math.PI * prog(t, 66, 80)) * 0.04;
  return (DOT * dot * (1 - dip) + (R - DOT) * grow) * (1 - breathe);
};

export const Intro: React.FC = () => {
  const t = useT();
  const uid = useUid('intro');
  const r = introRadius(t);
  const light = clamp01(r / R);
  // Свет собирается перед склейкой
  const charge = tw(t, 70, 80, 0, 1, EASE.inCubic);

  const xEnd = CX - Math.max(r, DOT) - 14;
  const o1 = tw(t, 0, 12, 160, 0, EASE.outExpo) + tw(t, 44, 54, 0, -170, EASE.inCubic);
  const o2 = tw(t, 3, 15, 160, 0, EASE.outExpo) + tw(t, 47, 57, 0, -170, EASE.inCubic);

  const ringReveal = tw(t, 46, 64, 0, 1, EASE.inOutCubic);
  const ringRot = tw(t, 46, 100, -40, 30, EASE.outCubic);
  const circ = 2 * Math.PI * RING_R;

  return (
    <AbsoluteFill style={{backgroundColor: STAGE.bg}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id={`${uid}stage`} cx={CX} cy={CY} r={980} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#FFF0D6" stopOpacity={0.05 + 0.13 * light + 0.08 * charge} />
            <stop offset={0.55} stopColor="#FFF0D6" stopOpacity={0.03 * light} />
            <stop offset={1} stopColor="#FFF0D6" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}halo`} cx={CX} cy={CY} r={Math.max(r, 1) * 3.1} gradientUnits="userSpaceOnUse">
            <stop offset={0.3} stopColor="#FFF6E6" stopOpacity={0.55 + 0.3 * charge} />
            <stop offset={0.45} stopColor="#FFE9C4" stopOpacity={0.18 + 0.15 * charge} />
            <stop offset={1} stopColor="#FFE9C4" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}disc`} cx={0.42} cy={0.36} r={0.75}>
            <stop offset={0} stopColor="#FFFFFF" />
            <stop offset={0.6} stopColor="#FBF4E7" />
            <stop offset={1} stopColor="#E9DFCB" />
          </radialGradient>
          {/* Буквы освещены кругом: ярче со стороны круга */}
          <linearGradient id={`${uid}lit`} x1={xEnd - 700} y1={0} x2={xEnd} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={mix('#5A564E', '#A7A194', light)} />
            <stop offset={0.65} stopColor={mix('#B5AFA2', '#EFE7D6', light)} />
            <stop offset={1} stopColor={mix('#E2DCCF', '#FFFFFF', light)} />
          </linearGradient>
          <clipPath id={`${uid}words`}>
            <rect x={0} y={CY + DOT - 130} width={1920} height={175} />
          </clipPath>
          <path
            id={`${uid}ring`}
            d={`M ${CX} ${CY - RING_R} A ${RING_R} ${RING_R} 0 1 1 ${CX - 0.01} ${CY - RING_R}`}
          />
          <mask id={`${uid}ringMask`} maskUnits="userSpaceOnUse" x={0} y={0} width={1920} height={1080}>
            <circle
              cx={CX}
              cy={CY}
              r={RING_R}
              fill="none"
              stroke="#fff"
              strokeWidth={110}
              strokeDasharray={`${circ * ringReveal} ${circ}`}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          </mask>
        </defs>

        <rect width={1920} height={1080} fill={`url(#${uid}stage)`} />

        {/* Фраза «Один круг» — слова выезжают из маски, круг их выталкивает */}
        <g clipPath={`url(#${uid}words)`}>
          <text
            x={xEnd}
            y={CY + DOT}
            textAnchor="end"
            fontFamily={FONT.meta}
            fontWeight={800}
            fontSize={130}
            letterSpacing="-0.02em"
            fill={`url(#${uid}lit)`}
          >
            <tspan dy={o1}>Один </tspan>
            <tspan dy={o2 - o1}>круг</tspan>
          </text>
        </g>

        {/* Ореол и сам круг */}
        {r > 0.5 ? <circle cx={CX} cy={CY} r={r * 3.1} fill={`url(#${uid}halo)`} /> : null}
        {r > 0.2 ? <circle cx={CX} cy={CY} r={r} fill={`url(#${uid}disc)`} /> : null}

        {/* Кольцевая надпись */}
        <g transform={`rotate(${ringRot} ${CX} ${CY})`} opacity={tw(t, 46, 52, 0, 1)}>
          <g mask={`url(#${uid}ringMask)`}>
            <text
              fontFamily={FONT.meta}
              fontWeight={800}
              fontSize={40}
              fill="#F7EEDC"
              letterSpacing="0.12em"
            >
              <textPath href={`#${uid}ring`} textLength={circ - 12} lengthAdjust="spacing">
                {RING_TEXT}
              </textPath>
            </text>
          </g>
        </g>

        {/* Десять делений — обещание десяти стилей */}
        {Array.from({length: 10}, (_, i) => {
          const s = t < 52 + i * 1.6 ? 0 : springAt(t, 52 + i * 1.6, {damping: 10, stiffness: 260});
          const fade = 1 - tw(t, 72, 80, 0, 1);
          return (
            <circle
              key={i}
              cx={CX + (i - 4.5) * 34}
              cy={980}
              r={4.5 * s}
              fill={STAGE.ink}
              opacity={0.65 * fade}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
