import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EASE, lerp, prog, springAt, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {deg, polyPath, type Pt, useUid} from '../lib/geom';
import {STAGE, STYLES} from '../lib/styles';
import {useT} from '../lib/time';
import {DECO, DecoMedallion} from './S01ArtDeco';
import {BauhausBadge} from './S02Bauhaus';
import {ConstructivismBadge} from './S03Constructivism';
import {SwissBadge} from './S04Swiss';
import {PopDisc} from './S05PopArt';
import {PSY, PsySpiral} from './S06Psychedelia';
import {MEM, MemphisDisc} from './S07Memphis';
import {ChromeBubble} from './S08Y2K';
import {RetroSun} from './S09Retrowave';
import {GlitchBadge} from './S10Glitch';

// Финал: точка после «выключения экрана» снова становится кругом,
// делится на десять и каждый круг надевает свой стиль. Тёмная сцена, мягкий свет.
const GX = [360, 660, 960, 1260, 1560];
const GY = [300, 615];
const BR = 92;
const GRID: Pt[] = Array.from({length: 10}, (_, i) => [GX[i % 5], GY[Math.floor(i / 5)]] as Pt);

const Badge: React.FC<{i: number; r: number; t: number}> = ({i, r, t}) => {
  switch (i) {
    case 0:
      return (
        <g>
          {Array.from({length: 32}, (_, k) => {
            const a = deg(k * 11.25 + t * 0.4);
            const long = k % 2 === 0;
            return (
              <line
                key={k}
                x1={Math.cos(a) * r * 1.08}
                y1={Math.sin(a) * r * 1.08}
                x2={Math.cos(a) * r * (long ? 1.26 : 1.16)}
                y2={Math.sin(a) * r * (long ? 1.26 : 1.16)}
                stroke={DECO.mid}
                strokeWidth={1.4}
              />
            );
          })}
          <DecoMedallion r={r} t={t} />
        </g>
      );
    case 1:
      return <BauhausBadge r={r} t={t} />;
    case 2:
      return <ConstructivismBadge r={r} />;
    case 3:
      return <SwissBadge r={r} />;
    case 4:
      return <PopDisc r={r} lightA={deg(-140 + 50 * Math.sin(t * 0.05))} />;
    case 5: {
      const pts: Pt[] = Array.from({length: 90}, (_, k) => {
        const th = (k / 90) * Math.PI * 2;
        const rr = r * (1.1 + 0.05 * Math.sin(6 * th + t * 0.15));
        return [Math.cos(th) * rr, Math.sin(th) * rr];
      });
      return (
        <g>
          <path d={polyPath(pts)} fill={PSY.magenta} />
          <PsySpiral r={r} rot={t * 7} />
        </g>
      );
    }
    case 6:
      return (
        <g>
          <circle cx={r * 0.1} cy={r * 0.1} r={r} fill={MEM.cobalt} />
          <MemphisDisc r={r} />
        </g>
      );
    case 7:
      return <ChromeBubble r={r} t={t} />;
    case 8:
      return (
        <g>
          <circle r={r * 1.7} fill="url(#outroSunGlow)" />
          <RetroSun r={r} t={t} />
        </g>
      );
    default:
      return <GlitchBadge r={r} t={t} />;
  }
};

export const Outro: React.FC = () => {
  const t = useT();
  const uid = useUid('outro');
  const grow = t < 0 ? 0 : springAt(t, 0, {damping: 12, stiffness: 150});
  const r0 = 6 + 64 * grow;
  const halo = tw(t, 0, 8, 1, 0.35) * (1 - tw(t, 14, 30, 0, 1));

  const titleUp = tw(t, 46, 60, 1, 0, EASE.outQuart);
  const sheen = prog(t, 66, 88);

  return (
    <AbsoluteFill style={{backgroundColor: STAGE.bg}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id={`${uid}spot`} cx={960} cy={470} r={1000} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor="#FFF0D6" stopOpacity={0.12} />
            <stop offset={0.6} stopColor="#FFF0D6" stopOpacity={0.03} />
            <stop offset={1} stopColor="#FFF0D6" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`${uid}halo`} cx={960} cy={540} r={420} gradientUnits="userSpaceOnUse">
            <stop offset={0.12} stopColor="#FFF6E6" stopOpacity={0.6} />
            <stop offset={1} stopColor="#FFF6E6" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="outroSunGlow">
            <stop offset={0.45} stopColor="#FF6A5A" stopOpacity={0.45} />
            <stop offset={1} stopColor="#FF2E7E" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${uid}title`} x1={lerp(560, 1360, sheen) - 120} y1={0} x2={lerp(560, 1360, sheen) + 120} y2={0} gradientUnits="userSpaceOnUse">
            <stop offset={0} stopColor={STAGE.ink} />
            <stop offset={0.5} stopColor={sheen > 0 && sheen < 1 ? '#FFFFFF' : STAGE.ink} />
            <stop offset={1} stopColor={STAGE.ink} />
          </linearGradient>
          <clipPath id={`${uid}titleClip`}>
            <rect x={0} y={860} width={1920} height={95} />
          </clipPath>
        </defs>
        <rect width={1920} height={1080} fill={`url(#${uid}spot)`} />
        <circle cx={960} cy={540} r={420} fill={`url(#${uid}halo)`} opacity={halo} />

        {GRID.map(([gx, gy], i) => {
          const st = 12 + i * 1.3;
          const m = EASE.inOutCubic(prog(t, st, st + 16));
          const x = lerp(960, gx, m);
          const y = lerp(540, gy, m) - Math.sin(Math.PI * m) * 70;
          const r = lerp(r0, BR, m);
          const reveal = prog(t, st + 13, st + 19);
          const ring = prog(t, st + 14, st + 26);
          const label = tw(t, 32 + i * 1.5, 42 + i * 1.5, 0, 1, EASE.outCubic);
          return (
            <g key={i}>
              <g transform={`translate(${x} ${y})`}>
                {reveal < 1 ? <circle r={r} fill="#F7F1E6" opacity={1 - reveal} /> : null}
                {reveal > 0 ? (
                  <g opacity={reveal} transform={`scale(${0.86 + 0.14 * EASE.outCubic(reveal)})`}>
                    <Badge i={i} r={BR} t={t} />
                  </g>
                ) : null}
                {ring > 0 && ring < 1 ? (
                  <circle r={BR + 40 * EASE.outCubic(ring)} fill="none" stroke="#FFF3DC" strokeWidth={2} opacity={1 - ring} />
                ) : null}
              </g>
              <g opacity={label} transform={`translate(0 ${(1 - label) * 14})`}>
                <text x={gx} y={gy + 142} textAnchor="middle" fontFamily={FONT.mono} fontWeight={700} fontSize={18} letterSpacing="0.12em" fill={STAGE.dim}>
                  {STYLES[i].num}
                </text>
                <text x={gx} y={gy + 173} textAnchor="middle" fontFamily={FONT.meta} fontWeight={600} fontSize={26} fill={STAGE.ink}>
                  {STYLES[i].name}
                </text>
              </g>
            </g>
          );
        })}

        <g clipPath={`url(#${uid}titleClip)`}>
          <text
            x={960}
            y={935 + titleUp * 100}
            textAnchor="middle"
            fontFamily={FONT.meta}
            fontWeight={800}
            fontSize={62}
            letterSpacing="-0.01em"
            fill={`url(#${uid}title)`}
          >
            Один круг. Десять стилей.
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
