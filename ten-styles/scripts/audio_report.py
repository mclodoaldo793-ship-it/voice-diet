#!/usr/bin/env python3
"""Измерения звука без прослушивания: баланс по октавам, пики, щелчки, совпадение атак со склейками.
python3 scripts/audio_report.py public/audio/soundtrack.wav"""
import math
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile


def main(path: str) -> int:
    sr, x = wavfile.read(path)
    x = x.astype(np.float64)
    if x.dtype.kind in "iu" or np.max(np.abs(x)) > 2:
        x /= 2**31 if np.max(np.abs(x)) > 2**16 else 2**15
    mono = x.mean(axis=1) if x.ndim == 2 else x
    f, p = signal.welch(mono, sr, nperseg=8192)
    print("Октавные полосы (дБ отн. макс.):")
    bands = [(20, 60), (60, 125), (125, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 12000), (12000, 20000)]
    lv = []
    for lo, hi in bands:
        m = (f >= lo) & (f < hi)
        lv.append(10 * math.log10(np.sum(p[m]) + 1e-20))
    mx = max(lv)
    for (lo, hi), v in zip(bands, lv):
        print(f"  {lo:>5}-{hi:<5} Гц  {v - mx:6.1f}  {'#' * max(0, int((v - mx + 40) / 1.5))}")
    print(f"Пик: {20 * math.log10(np.max(np.abs(x))):.2f} dBFS")
    d = np.abs(np.diff(mono))
    thr = np.percentile(d, 99.999)
    print(f"Макс. скачок между сэмплами: {d.max():.4f} (99.999 перцентиль {thr:.4f})")
    # огибающая атак
    env = np.abs(signal.hilbert(signal.sosfilt(signal.butter(2, 150, 'high', fs=sr, output='sos'), mono)))
    hop = sr // 100
    e = np.array([env[i:i + hop].mean() for i in range(0, len(env) - hop, hop)])
    on = np.maximum(0, np.diff(e))
    peaks, _ = signal.find_peaks(on, height=np.percentile(on, 99.3), distance=8)
    print("Сильнейшие атаки (сек):", ", ".join(f"{p / 100:.2f}" for p in sorted(peaks)[:60]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
