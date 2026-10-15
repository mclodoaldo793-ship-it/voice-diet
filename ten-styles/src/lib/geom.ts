import {useId} from 'react';

/** Уникальный id для SVG-определений: несколько сцен бывают на экране одновременно */
export const useUid = (name: string) => `${name}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

export type Pt = [number, number];

export const deg = (d: number) => (d * Math.PI) / 180;

export const rotPt = ([x, y]: Pt, a: number, [cx, cy]: Pt = [0, 0]): Pt => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};

export const polyPath = (pts: Pt[]) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z';

/** Окружность как путь (по часовой стрелке на экране) */
export const circlePath = (cx: number, cy: number, r: number) =>
  `M${(cx + r).toFixed(2)} ${cy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx + r).toFixed(2)} ${cy.toFixed(2)} Z`;

/** Правильный многоугольник, вершины по часовой стрелке на экране */
export const ngon = (cx: number, cy: number, r: number, n: number, rot = 0): Pt[] =>
  Array.from({length: n}, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });

export const circlePts = (cx: number, cy: number, r: number, n = 64): Pt[] => ngon(cx, cy, r, n);

/** Выпуклая оболочка (монотонная цепь) — для длинных теней */
export const hull = (input: Pt[]): Pt[] => {
  const pts = [...input].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
};

/** Длинная тень фигуры: оболочка фигуры и её копии, сдвинутой на (dx, dy) */
export const longShadow = (pts: Pt[], dx: number, dy: number): Pt[] =>
  hull([...pts, ...pts.map(([x, y]) => [x + dx, y + dy] as Pt)]);
