// Единый источник тайминга. Его же читает scripts/make_audio.py.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// 128,57 BPM при 30 fps: четверть = 14 кадров, шестнадцатая = 3,5 кадра,
// такт = 56 кадров = одна сцена (1,87 с). Склейки всегда на сильной доле.
export const BEAT = 14;
export const SCENE_LEN = 56;
export const INTRO_LEN = 56;
export const OUTRO_LEN = 112;
export const STYLE_COUNT = 10;

// Анимация сцен записана в «авторских» кадрах: такт = 80 единиц, доля = 20.
// На экране время идёт быстрее в RATE раз, и доли совпадают с музыкой.
export const AUTHOR_SCENE = 80;
export const RATE = AUTHOR_SCENE / SCENE_LEN;

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
  // Окно перехода вокруг склейки в реальных кадрах: [cut - pre, cut + post)
  pre: number;
  post: number;
  // Точка, из которой растёт переход (обычно центр круга уходящей сцены)
  origin: [number, number];
};

// TRANSITIONS[k] — переход в сегмент k + 1 (0: интро → 01, 10: 10 → финал)
export const TRANSITIONS: TransitionSpec[] = [
  {kind: 'iris', pre: 0, post: 10, origin: [960, 540]},
  {kind: 'clock', pre: 4, post: 6, origin: [960, 540]},
  {kind: 'diagonal', pre: 5, post: 5, origin: [960, 540]},
  {kind: 'columns', pre: 6, post: 6, origin: [960, 540]},
  {kind: 'halftone', pre: 6, post: 6, origin: [640, 560]},
  {kind: 'melt', pre: 4, post: 7, origin: [960, 520]},
  {kind: 'shapes', pre: 6, post: 6, origin: [960, 450]},
  {kind: 'flash', pre: 3, post: 6, origin: [880, 500]},
  {kind: 'blinds', pre: 6, post: 6, origin: [960, 540]},
  {kind: 'glitch', pre: 4, post: 2, origin: [960, 540]},
  {kind: 'crt', pre: 6, post: 8, origin: [960, 540]},
];
