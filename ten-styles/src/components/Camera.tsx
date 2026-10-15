import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EASE, tw} from '../lib/anim';
import {useT} from '../lib/time';

// Медленная «камера» внутри каждой сцены: наезд, лёгкий поворот.
// HUD и маски переходов остаются неподвижными — двигается только изображение.
type Cam = {s0: number; s1: number; r0?: number; r1?: number; ox: number; oy: number};

// Индекс — номер сегмента: 0 интро, 1–10 стили, 11 финал
const CAMERA: Record<number, Cam> = {
  0: {s0: 1, s1: 1.03, ox: 960, oy: 540},
  1: {s0: 1, s1: 1.045, ox: 960, oy: 540},
  2: {s0: 1, s1: 1.025, ox: 720, oy: 470},
  3: {s0: 1.02, s1: 1.06, r0: 0, r1: -1.2, ox: 1150, oy: 520},
  5: {s0: 1, s1: 1.04, ox: 960, oy: 520},
  6: {s0: 1, s1: 1.06, r0: 0, r1: 3, ox: 960, oy: 450},
  7: {s0: 1, s1: 1.02, ox: 960, oy: 540},
  8: {s0: 1, s1: 1.035, ox: 960, oy: 470},
  9: {s0: 1, s1: 1.05, ox: 960, oy: 600},
};

export const Camera: React.FC<{segment: number; len: number; children: React.ReactNode}> = ({segment, len, children}) => {
  const t = useT();
  const cam = CAMERA[segment];
  if (!cam) return <>{children}</>;
  const s = tw(t, -10, len + 10, cam.s0, cam.s1, EASE.inOutSine);
  const r = tw(t, -10, len + 10, cam.r0 ?? 0, cam.r1 ?? 0, EASE.inOutSine);
  return (
    <AbsoluteFill style={{transform: `rotate(${r}deg) scale(${s})`, transformOrigin: `${cam.ox}px ${cam.oy}px`}}>
      {children}
    </AbsoluteFill>
  );
};
