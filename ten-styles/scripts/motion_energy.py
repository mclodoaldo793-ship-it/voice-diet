#!/usr/bin/env python3
"""Динамика без просмотра: средняя разница соседних кадров (0–255) по видео.
python3 scripts/motion_energy.py video.mp4 [--segments 56] [--png out.png]
Печатает долю «статичных» кадров и среднюю энергию по тактам."""
import argparse
import subprocess
import sys

import numpy as np


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--segments", type=int, default=0, help="длина такта в кадрах для сводки")
    ap.add_argument("--png", default=None)
    a = ap.parse_args()
    w, h = 240, 135
    cmd = ["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    static = float(np.mean(d < 0.6))
    print(f"кадров: {len(frames)}, средняя энергия: {d.mean():.2f}, медиана: {np.median(d):.2f}, статичных (<0.6): {static * 100:.1f}%")
    if a.segments:
        seg = a.segments
        vals = [d[i : i + seg].mean() for i in range(0, len(d), seg)]
        stat = [np.mean(d[i : i + seg] < 0.6) * 100 for i in range(0, len(d), seg)]
        print("по тактам (энергия / % статичных):", " | ".join(f"{v:.1f}/{s:.0f}%" for v, s in zip(vals, stat)))
    if a.png:
        from PIL import Image, ImageDraw

        W, H = 1600, 300
        im = Image.new("RGB", (W, H), (20, 20, 20))
        dr = ImageDraw.Draw(im)
        mx = max(8.0, float(np.percentile(d, 99)))
        pts = [(int(i / (len(d) - 1) * (W - 1)), int(H - 1 - min(1.0, v / mx) * (H - 20))) for i, v in enumerate(d)]
        dr.line(pts, fill=(255, 170, 60), width=2)
        if a.segments:
            for i in range(0, len(d), a.segments):
                x = int(i / (len(d) - 1) * (W - 1))
                dr.line([(x, 0), (x, H)], fill=(80, 80, 80), width=1)
        im.save(a.png)
    return 0


if __name__ == "__main__":
    sys.exit(main())
