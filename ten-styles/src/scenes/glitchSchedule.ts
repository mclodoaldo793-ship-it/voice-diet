import {random} from 'remotion';

// Расписание сбоев сцены «Глитч» (t — локальный кадр сцены).
// Между всплесками заголовок стабилен, чтобы его успели прочитать.
const BURSTS: [number, number, number][] = [
  [-1, 7, 1],
  [22, 25, 0.35],
  [42, 56, 0.9],
  [64, 70, 0.6],
];

export const glitchAmount = (t: number) => {
  const f = Math.floor(t);
  for (const [a, b, k] of BURSTS) {
    if (f >= a && f < b) return k * (0.45 + 0.55 * random(`gs${f}`));
  }
  return 0;
};
