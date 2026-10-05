"""Находит центры точек оболочки в исходной альфа-маске (1971x1987) и
переводит их в координаты кадра 1024. Сохраняет reference/dots.npy (x, y, peak)."""
import json
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
fr = json.load(open(ROOT / "reference/frame.json"))
doc = pymupdf.open(r"C:\Users\IlyaL\Downloads\VoiceDiet 3_0.pdf")
m = pymupdf.Pixmap(doc, 224)
A = np.frombuffer(m.samples, np.uint8).reshape(m.height, m.width).astype(np.float32)

# локальные максимумы 5x5
pad = np.pad(A, 2)
win = np.lib.stride_tricks.sliding_window_view(pad, (5, 5)).max(axis=(2, 3))
peaks = (A >= win) & (A > 90)
ys, xs = np.nonzero(peaks)
# схлопываем плато (соседние равные пики)
key = (ys // 3) * 100000 + xs // 3
_, idx = np.unique(key, return_index=True)
ys, xs = ys[idx], xs[idx]
a, b, c, d, e, f = fr["shell_transform"]
X0, Y0, _, _ = fr["page_frame_pt"]
S = fr["px_per_pt"]
u = (xs + 0.5) / m.width
v = (ys + 0.5) / m.height
px = (a * u + c * v + e - X0) * S
py = (b * u + d * v + f - Y0) * S
dots = np.c_[px, py, A[ys, xs]]
np.save(ROOT / "reference/dots.npy", dots)

# расстояние до ближайшего соседа (сетка по ячейкам)
from collections import defaultdict
cell = defaultdict(list)
for i, (x, y) in enumerate(zip(px, py)):
    cell[(int(x // 16), int(y // 16))].append(i)
nn = np.full(len(px), 99.0)
for (cx, cy), ids in cell.items():
    near = [j for dx in (-1, 0, 1) for dy in (-1, 0, 1) for j in cell.get((cx + dx, cy + dy), [])]
    P = np.c_[px[near], py[near]]
    for i in ids:
        dd = np.hypot(P[:, 0] - px[i], P[:, 1] - py[i])
        dd = dd[dd > 0.3]
        if len(dd): nn[i] = dd.min()
r = np.hypot(px - 512, py - 512)
print("dots", len(px))
for lo, hi in [(0, 150), (150, 300), (300, 380), (380, 430), (430, 480)]:
    s = (r >= lo) & (r < hi)
    print(f"r {lo}-{hi}: n={s.sum()} nn median={np.median(nn[s]):.2f} p25={np.percentile(nn[s],25):.2f} p75={np.percentile(nn[s],75):.2f}")
# размер точки: полуширина профиля у изолированных пиков
iso = nn * 2 > 14
print("isolated peak value median", np.median(A[ys[iso], xs[iso]]))
