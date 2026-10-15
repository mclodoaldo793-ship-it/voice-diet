// Единый источник тайминга. Его же читает scripts/make_audio.py (через timeline.json).
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// 90 BPM при 30 fps: четверть = 20 кадров, восьмая = 10, такт = 80 кадров = одна сцена.
export const BEAT = 20;
export const SCENE_LEN = 80;
export const INTRO_LEN = 80;
export const OUTRO_LEN = 140;
export const STYLE_COUNT = 10;

export const sceneStart = (i: number) => INTRO_LEN + i * SCENE_LEN;
export const OUTRO_START = sceneStart(STYLE_COUNT);
export const TOTAL_FRAMES = OUTRO_START + OUTRO_LEN;

export type TransitionKind =
  | 'iris'
  | 'clock'
  | 'diagonal'
  | 'columns'
  | 'halftone'
  | 'melt'
  | 'shapes'
  | 'flash'
  | 'blinds'
  | 'glitch'
  | 'crt';

export type TransitionSpec = {
  kind: TransitionKind;
  // Окно перехода вокруг склейки: [cut - pre, cut + post)
  pre: number;
  post: number;
  // Точка, из которой растёт переход (обычно центр круга уходящей сцены)
  origin: [number, number];
};

// TRANSITIONS[k] — переход в сегмент k + 1 (0: интро → 01, 10: 10 → финал)
export const TRANSITIONS: TransitionSpec[] = [
  {kind: 'iris', pre: 0, post: 14, origin: [960, 540]},
  {kind: 'clock', pre: 6, post: 8, origin: [960, 540]},
  {kind: 'diagonal', pre: 7, post: 7, origin: [960, 540]},
  {kind: 'columns', pre: 8, post: 8, origin: [960, 540]},
  {kind: 'halftone', pre: 8, post: 8, origin: [640, 560]},
  {kind: 'melt', pre: 6, post: 10, origin: [960, 520]},
  {kind: 'shapes', pre: 8, post: 8, origin: [960, 450]},
  {kind: 'flash', pre: 4, post: 8, origin: [880, 500]},
  {kind: 'blinds', pre: 8, post: 8, origin: [960, 540]},
  {kind: 'glitch', pre: 5, post: 3, origin: [960, 540]},
  {kind: 'crt', pre: 8, post: 10, origin: [960, 540]},
];
