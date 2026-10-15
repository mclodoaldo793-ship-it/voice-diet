import {Easing, interpolate, spring} from 'remotion';
import {FPS} from './timeline';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Прогресс 0..1 на отрезке [a, b] */
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

// Кривые, подобранные под характер стилей
export const EASE = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
  outCubic: Easing.bezier(0.33, 1, 0.68, 1),
  inOutCubic: Easing.bezier(0.65, 0, 0.35, 1),
  inOutSine: Easing.bezier(0.37, 0, 0.63, 1),
  inCubic: Easing.bezier(0.32, 0, 0.67, 0),
  inQuad: Easing.bezier(0.11, 0, 0.5, 0),
  machine: Easing.bezier(0.7, 0, 0.15, 1),
  thrust: Easing.bezier(0.9, 0, 0.1, 1),
  linear: (x: number) => x,
} as const;

/** Твин с клампом: значение from→to на [a, b] */
export const tw = (
  t: number,
  a: number,
  b: number,
  from: number,
  to: number,
  easing: (x: number) => number = EASE.outCubic,
) =>
  interpolate(t, [a, b], [from, to], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Пружина от момента start: 0 → 1 с перелётом, зависит только от кадра */
export const springAt = (
  t: number,
  start: number,
  config: {damping?: number; stiffness?: number; mass?: number} = {},
) =>
  spring({
    frame: t - start,
    fps: FPS,
    config: {damping: 12, stiffness: 160, mass: 1, ...config},
  });

/** Затухающая тряска (детерминированная) */
export const shake = (t: number, start: number, dur: number, amp: number, seed = 1) => {
  if (t < start || t > start + dur) return [0, 0] as const;
  const k = 1 - (t - start) / dur;
  const a = amp * k * k;
  return [Math.sin((t - start) * 2.7 + seed) * a, Math.cos((t - start) * 3.3 + seed * 2) * a] as const;
};

/**
 * Падение на «пол» с двумя затухающими отскоками (как мяч).
 * u — время от начала падения, H — высота, T — длительность падения в кадрах.
 * Возвращает смещение по Y: 0 — на полу, отрицательное — выше.
 */
export const bounce = (u: number, H: number, T = 9) => {
  if (u <= 0) return -H;
  if (u < T) {
    const v = u / T;
    return -H * (1 - v * v);
  }
  const hops: [number, number][] = [
    [0.55 * T, 0.18 * H],
    [0.32 * T, 0.05 * H],
  ];
  let s = u - T;
  for (const [d, h] of hops) {
    if (s < d) {
      const v = s / d;
      return -h * 4 * v * (1 - v);
    }
    s -= d;
  }
  return 0;
};

/** Импульс сжатия в моменты касания пола для bounce() — 0..1 */
export const bounceImpact = (u: number, T = 9) => {
  const hits: [number, number][] = [
    [T, 1],
    [T + 0.55 * T, 0.4],
    [T + 0.87 * T, 0.15],
  ];
  return hits.reduce((acc, [h, a]) => acc + a * Math.exp(-((u - h) ** 2) / 3), 0);
};
