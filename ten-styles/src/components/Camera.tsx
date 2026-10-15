import React from 'react';
import {AbsoluteFill} from 'remotion';
import {EASE, tw} from '../lib/anim';
import {useT} from '../lib/time';

// «Камера» внутри сцены: наезд за такт + удары на долях (2, 3, 4) — ритм музыки
// виден в кадре. HUD и маски переходов от камеры не зависят.
// Время — авторские кадры (такт = 80, доля = 20).
type Punch = 'zoom' | 'rot' | 'none';
type Cam = {s0: number; s1: number; r0?: number; r1?: number; ox: number; oy: number; punch: Punch; amp: number};

// Индекс — номер сегмента: 0 интро, 1–10 стили, 11 финал
const CAMERA: Record<number, Cam> = {
  0: {s0: 1, s1: 1.04, ox: 960, oy: 540, punch: 'none', amp: 0},
  1: {s0: 1, s1: 1.06, ox: 960, oy: 540, punch: 'zoom', amp: 0.035},
  2: {s0: 1, s1: 1.03, ox: 720, oy: 470, punch: 'rot', amp: 1.4},
  3: {s0: 1.02, s1: 1.07, r0: 0, r1: -1.5, ox: 1150, oy: 520, punch: 'zoom', amp: 0.03},
  4: {s0: 1, s1: 1.02, ox: 640, oy: 560, punch: 'zoom', amp: 0.015},
  5: {s0: 1, s1: 1.05, ox: 960, oy: 520, punch: 'zoom', amp: 0.05},
  6: {s0: 1, s1: 1.08, r0: 0, r1: 4, ox: 960, oy: 450, punch: 'zoom', amp: 0.025},
  7: {s0: 1, s1: 1.02, ox: 960, oy: 540, punch: 'rot', amp: 1.2},
  8: {s0: 1, s1: 1.07, r0: 0, r1: 1.5, ox: 960, oy: 470, punch: 'zoom', amp: 0.04},
  9: {s0: 1, s1: 1.07, ox: 960, oy: 600, punch: 'zoom', amp: 0.035},
  11: {s0: 1, s1: 1.05, ox: 960, oy: 520, punch: 'none', amp: 0},
};

const BEATS = [20, 40, 60];

/** Импульс удара: подъём за 2 кадра, спад ~7 кадров */
const hit = (t: number, b: number) => {
  const k = t - b;
  if (k < 0) return 0;
  return k < 2 ? k / 2 : Math.exp(-(k - 2) / 7);
};

export const Camera: React.FC<{segment: number; len: number; children: React.ReactNode}> = ({segment, len, children}) => {
  const t = useT();
  const cam = CAMERA[segment];
  if (!cam) return <>{children}</>;
  let s = tw(t, -10, len + 10, cam.s0, cam.s1, EASE.inOutSine);
  let r = tw(t, -10, len + 10, cam.r0 ?? 0, cam.r1 ?? 0, EASE.inOutSine);
  let rp = 0;
  BEATS.forEach((b, i) => {
    const h = hit(t, b);
    if (cam.punch === 'zoom') s += cam.amp * h;
    if (cam.punch === 'rot') rp += (i % 2 === 0 ? 1 : -1) * cam.amp * h;
  });
  // поворот без открытых углов: компенсирующий масштаб
  r += rp;
  s *= 1 + Math.abs(rp) * 0.025;
  return (
    <AbsoluteFill style={{transform: `rotate(${r}deg) scale(${s})`, transformOrigin: `${cam.ox}px ${cam.oy}px`}}>
      {children}
    </AbsoluteFill>
  );
};
