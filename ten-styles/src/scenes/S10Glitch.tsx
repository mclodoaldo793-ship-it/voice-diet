import React from 'react';
import {AbsoluteFill, Freeze, random} from 'remotion';
import {Grain} from '../components/Grain';
import {EASE, tw} from '../lib/anim';
import {FONT} from '../lib/fonts';
import {useUid} from '../lib/geom';
import {SceneTime, useT} from '../lib/time';
import {glitchAmount} from './glitchSchedule';
import {ArtDeco} from './S01ArtDeco';
import {Bauhaus} from './S02Bauhaus';
import {Constructivism} from './S03Constructivism';
import {Swiss} from './S04Swiss';
import {PopArt} from './S05PopArt';
import {Psychedelia} from './S06Psychedelia';
import {Memphis} from './S07Memphis';
import {Y2K} from './S08Y2K';
import {Retrowave} from './S09Retrowave';

// 10 · Глитч: сбой. Белый круг и заголовок в режиме difference, RGB-расслоение,
// срывы строк. Во время сбоев в полосах мелькают стоп-кадры всех прошлых стилей.
export const GL = {
  bg: '#050505',
  white: '#F2F2F2',
};
const CALLBACKS: [React.FC, number][] = [
  [ArtDeco, 60],
  [Bauhaus, 60],
  [Constructivism, 50],
  [Swiss, 62],
  [PopArt, 40],
  [Psychedelia, 50],
  [Memphis, 50],
  [Y2K, 50],
  [Retrowave, 50],
];
const C = [960, 540];
const R = 230;
const CHANNELS = ['#FF0000', '#00FF00', '#0000FF'];

/** Значок для финала: круг с RGB-расслоением. Центр (0,0). */
export const GlitchBadge: React.FC<{r: number; t: number}> = ({r, t}) => {
  const uid = useUid('glB');
  const f = Math.floor(t / 2);
  const k = random(`gb${f}`) < 0.3 ? 1 : 0.35;
  const dx = r * 0.06 * k;
  const sliceY = (random(`gby${f}`) - 0.5) * r * 1.4;
  const sliceDx = (random(`gbd${f}`) - 0.5) * r * 0.5 * k;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}c`}>
          <circle r={r} />
        </clipPath>
        <clipPath id={`${uid}s`}>
          <rect x={-2 * r} y={sliceY} width={4 * r} height={r * 0.16} />
        </clipPath>
      </defs>
      <circle r={r} fill={GL.bg} />
      <g clipPath={`url(#${uid}c)`}>
        {CHANNELS.map((c, i) => (
          <circle key={c} cx={(i - 1) * dx} r={r * 0.62} fill={c} style={{mixBlendMode: 'screen'}} />
        ))}
        <g clipPath={`url(#${uid}s)`} transform={`translate(${sliceDx} 0)`}>
          <rect x={-r} y={-r} width={2 * r} height={2 * r} fill={GL.bg} />
          <circle cx={-dx} r={r * 0.62} fill={GL.white} />
        </g>
        {Array.from({length: Math.floor(r / 3)}, (_, i) => (
          <rect key={i} x={-r} y={-r + i * 6} width={2 * r} height={2} fill="#000" opacity={0.35} />
        ))}
      </g>
      <circle r={r} fill="none" stroke={GL.white} strokeOpacity={0.4} strokeWidth={Math.max(1, r * 0.012)} />
    </g>
  );
};

export const Glitch: React.FC = () => {
  const t = useT();
  const uid = useUid('gl');
  const g = glitchAmount(t);
  const f = Math.floor(t);
  const on = g > 0;

  const split = 3 + 34 * g;
  const jitterY = on ? (random(`jy${f}`) - 0.5) * 18 * g : 0;

  // Полосы срыва
  const bands: {y0: number; y1: number; dx: number}[] = [];
  if (on) {
    const n = 6;
    const cuts = Array.from({length: n - 1}, (_, i) => random(`cut${f}-${i}`) * 1080).sort((a, b) => a - b);
    const edges = [0, ...cuts, 1080];
    for (let i = 0; i < n; i++) {
      const big = random(`big${f}-${i}`) < 0.4;
      bands.push({y0: edges[i], y1: edges[i + 1], dx: (random(`bdx${f}-${i}`) - 0.5) * (big ? 260 : 40) * g});
    }
  } else {
    bands.push({y0: 0, y1: 1080, dx: 0});
  }

  const rgb = (
    <g transform={`translate(0 ${jitterY})`}>
      <circle cx={C[0]} cy={C[1]} r={R * 1.9} fill={`url(#${uid}bloom)`} />
      {CHANNELS.map((c, i) => (
        <g key={c} style={{mixBlendMode: 'screen'}}>
          <g style={{isolation: 'isolate'}} transform={`translate(${(i - 1) * split} 0)`}>
            <circle cx={C[0]} cy={C[1]} r={R} fill={c} />
            <text
              x={960}
              y={615}
              textAnchor="middle"
              fontFamily={FONT.glitch}
              fontSize={210}
              letterSpacing="0.04em"
              fill={c}
              style={{mixBlendMode: 'difference'}}
            >
              ГЛИТЧ
            </text>
          </g>
        </g>
      ))}
    </g>
  );

  // Стоп-кадры прошлых стилей в полосах (только во время сильных сбоев)
  const callbacks: React.ReactNode[] = [];
  if (g > 0.45) {
    const count = 1 + Math.floor(random(`cbn${f}`) * 2);
    for (let i = 0; i < count; i++) {
      const k = Math.floor(random(`cbk${f}-${i}`) * CALLBACKS.length);
      const [Scene, hold] = CALLBACKS[k];
      const y0 = random(`cby${f}-${i}`) * 900;
      const h = 40 + random(`cbh${f}-${i}`) * 150;
      const dx = (random(`cbx${f}-${i}`) - 0.5) * 300;
      callbacks.push(
        <AbsoluteFill
          key={`${f}-${i}`}
          style={{
            clipPath: `inset(${y0.toFixed(0)}px 0 ${(1080 - y0 - h).toFixed(0)}px 0)`,
            translate: `${dx.toFixed(0)}px 0`,
            filter: random(`cbf${f}-${i}`) < 0.5 ? 'saturate(1.6) contrast(1.2)' : 'hue-rotate(90deg) saturate(1.4)',
          }}
        >
          <Freeze frame={hold}>
            <SceneTime offset={0}>
              <Scene />
            </SceneTime>
          </Freeze>
        </AbsoluteFill>,
      );
    }
  }

  // Шум: блоки и «сортировка пикселей»
  const noise: React.ReactNode[] = [];
  if (on) {
    for (let i = 0; i < 14; i++) {
      if (random(`nz${f}-${i}`) > 0.55 * g + 0.15) continue;
      const colors = ['#FFFFFF', '#00E5FF', '#FF1E3C', '#5C5C5C', '#C8FF00'];
      noise.push(
        <rect
          key={`b${i}`}
          x={random(`nx${f}-${i}`) * 1800}
          y={random(`ny${f}-${i}`) * 1060}
          width={20 + random(`nw${f}-${i}`) * 380}
          height={3 + random(`nh${f}-${i}`) * 46}
          fill={colors[Math.floor(random(`nc${f}-${i}`) * colors.length)]}
          opacity={0.85}
        />,
      );
    }
    for (let i = 0; i < 7; i++) {
      const y = random(`sy${f}-${i}`) * 1080;
      const x = random(`sx${f}-${i}`) * 1200;
      noise.push(<rect key={`s${i}`} x={x} y={y} width={300 + random(`sw${f}-${i}`) * 700} height={2 + random(`sh${f}-${i}`) * 5} fill={`url(#${uid}streak)`} />);
    }
  }

  const flicker = random(`fl${f}`) * 0.07;
  const labels = on || (t > 12 && t < 40);

  return (
    <AbsoluteFill style={{backgroundColor: GL.bg}}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id={`${uid}bloom`} cx={C[0]} cy={C[1]} r={R * 1.9} gradientUnits="userSpaceOnUse">
            <stop offset={0.5} stopColor="#FFFFFF" stopOpacity={0.16} />
            <stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${uid}streak`} x1={0} y1={0} x2={1} y2={0}>
            <stop offset={0} stopColor="#FFFFFF" stopOpacity={0.9} />
            <stop offset={0.4} stopColor="#00E5FF" stopOpacity={0.6} />
            <stop offset={1} stopColor="#FF1E3C" stopOpacity={0} />
          </linearGradient>
          {bands.map((b, i) => (
            <clipPath key={i} id={`${uid}band${i}`}>
              <rect x={-400} y={b.y0} width={2720} height={b.y1 - b.y0 + 0.5} />
            </clipPath>
          ))}
        </defs>
        {bands.map((b, i) => (
          <g key={i} clipPath={`url(#${uid}band${i})`}>
            <g transform={`translate(${b.dx} 0)`}>{rgb}</g>
          </g>
        ))}
        {noise}
        {labels ? (
          <g fontFamily={FONT.mono} fontSize={18} fill="#BDBDBD" letterSpacing="0.1em" opacity={on ? 1 : 0.55}>
            <text x={1225} y={330}>{on ? `RGB_SHIFT ${(split / 40).toFixed(2)}` : 'RGB_SHIFT 0.08'}</text>
            <text x={540} y={792}>{on ? `CRC ERR 0x${Math.floor(random(`hex${f}`) * 65535).toString(16).toUpperCase().padStart(4, '0')}` : 'CRC OK'}</text>
          </g>
        ) : null}
      </svg>
      {callbacks}
      <Grain opacity={0.1} blend="screen" step={1} />
      <AbsoluteFill
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 2px, transparent 2px, transparent 4px)',
          backgroundPosition: `0 ${(t * 0.7) % 4}px`,
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(0,0,0,0.5) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill style={{backgroundColor: '#000', opacity: flicker + tw(t, 74, 80, 0, 0.0, EASE.linear), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
