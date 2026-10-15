#!/usr/bin/env python3
"""Саундтрек «Один круг — десять стилей»: бит и саунд-дизайн, синтезированные кодом.

Без сэмплов, внешних сервисов и платных API. Детерминированно (фиксированный seed).
Тайминг читается из src/lib/timeline.ts, события сцен совпадают с кадрами анимации
(см. planning/audio-map.md).

Запуск:  python3 scripts/make_audio.py
Выход:   public/audio/soundtrack.wav (48 кГц, 16 бит, стерео)
Нужны:   numpy, scipy
"""
from __future__ import annotations

import math
import os
import re
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(ROOT, "public", "audio", "soundtrack.wav")


# ---------------------------------------------------------------- тайминг
def read_timeline() -> dict[str, int]:
    path = os.path.join(ROOT, "src", "lib", "timeline.ts")
    with open(path, encoding="utf-8") as fh:
        src = fh.read()
    out = {}
    for name in ("FPS", "BEAT", "SCENE_LEN", "INTRO_LEN", "OUTRO_LEN", "STYLE_COUNT"):
        m = re.search(rf"export const {name} = (\d+);", src)
        if not m:
            raise SystemExit(f"не найдена константа {name} в {path}")
        out[name] = int(m.group(1))
    return out


TL = read_timeline()
FPS = TL["FPS"]
BEAT_F = TL["BEAT"]  # четверть в кадрах
STEP_F = BEAT_F / 4  # шестнадцатая в кадрах
SCENE_F = TL["SCENE_LEN"]
INTRO_F = TL["INTRO_LEN"]
OUTRO_F = TL["OUTRO_LEN"]
STYLES = TL["STYLE_COUNT"]
OUTRO_START_F = INTRO_F + STYLES * SCENE_F
TOTAL_F = OUTRO_START_F + OUTRO_F
DUR = TOTAL_F / FPS
N = int(round(DUR * SR))

rng = np.random.default_rng(2026)


def sec(frame: float) -> float:
    return frame / FPS


def scene_f(i: int) -> int:
    return INTRO_F + i * SCENE_F


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------------------------------------------------------------- шины
class Bus:
    def __init__(self) -> None:
        self.buf = np.zeros((2, N))

    def add(self, sig: np.ndarray, t0: float, gain: float = 1.0, pan: float = 0.0) -> None:
        """Моно или стерео сигнал с момента t0 (сек). pan: -1..1, равномощная панорама."""
        i0 = int(round(t0 * SR))
        if sig.ndim == 1:
            a = (pan + 1) * math.pi / 4
            sig = np.vstack([sig * math.cos(a), sig * math.sin(a)]) * math.sqrt(2)
        n = sig.shape[1]
        s0 = 0
        if i0 < 0:
            s0 = -i0
            i0 = 0
        i1 = min(N, i0 + n - s0)
        if i1 <= i0:
            return
        self.buf[:, i0:i1] += sig[:, s0 : s0 + (i1 - i0)] * gain


drums = Bus()
bass = Bus()
music = Bus()
sfx = Bus()
verb_send = Bus()


# ---------------------------------------------------------------- генераторы
def tarr(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR)) / SR


def osc_sine(freq, dur: float, phase: float = 0.0) -> np.ndarray:
    n = int(dur * SR)
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    return np.sin(ph)


def osc_saw(freq, dur: float, phase0: float = 0.0) -> np.ndarray:
    """Пила с polyBLEP (без алиасинга на слух)."""
    n = int(dur * SR)
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    ph = (np.cumsum(dt) + phase0) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def osc_square(freq, dur: float) -> np.ndarray:
    return 0.5 * (osc_saw(freq, dur) - osc_saw(freq, dur, 0.5))


def noise(dur: float) -> np.ndarray:
    return rng.standard_normal(int(dur * SR))


def env_exp(dur: float, decay: float, attack: float = 0.002) -> np.ndarray:
    t = tarr(dur)
    e = np.exp(-t / decay)
    if attack > 0:
        e *= np.clip(t / attack, 0, 1)
    return e


def env_adsr(dur: float, a: float, d: float, s: float, r: float) -> np.ndarray:
    """dur — длина ноты до отпускания; общий сигнал = dur + r, в конце ровно ноль"""
    t = tarr(dur + r)
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = t >= dur
    if np.any(rel):
        level = e[np.argmax(rel) - 1] if np.argmax(rel) > 0 else s
        tr = t[rel] - dur
        e[rel] = level * np.exp(-tr / max(r / 4, 1e-6)) * np.clip(1 - tr / max(r, 1e-6), 0, 1)
    return e


def fit(e: np.ndarray, n: int) -> np.ndarray:
    """Обрезает или дополняет нулями до длины n"""
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def lp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def hp(x: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, fc, "high", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bp(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def svf(x: np.ndarray, fc: np.ndarray, q: float = 0.8, mode: str = "bp") -> np.ndarray:
    """Фильтр с переменной частотой среза (TPT SVF) — для свистов и «вау»."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1 / (1 + g * (g + k))
    ic1 = ic2 = 0.0
    y = np.empty_like(x)
    lpm, bpm = mode == "lp", mode == "bp"
    for i in range(len(x)):
        gi = g[i]
        v3 = x[i] - ic2
        v1 = a1[i] * ic1 + gi * a1[i] * v3
        v2 = ic2 + gi * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        if lpm:
            y[i] = v2
        elif bpm:
            y[i] = v1
        else:
            y[i] = x[i] - k * v1 - v2
    return y


def soft(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(x * drive) / math.tanh(drive)


def crush(x: np.ndarray, bits: int, hold: int) -> np.ndarray:
    y = np.repeat(x[::hold], hold)[: len(x)]
    q = 2 ** (bits - 1)
    return lp(np.round(y * q) / q, 9000, 2)


# ---------------------------------------------------------------- инструменты
def kick(punch: float = 1.0) -> np.ndarray:
    d = 0.36
    t = tarr(d)
    f = 52 + 125 * np.exp(-t / 0.03) * punch
    body = osc_sine(f, d) * env_exp(d, 0.17, 0.001)
    knock = osc_sine(118, d) * env_exp(d, 0.035, 0.001) * 0.3
    click = hp(noise(0.01), 2500) * env_exp(0.01, 0.002, 0.0005) * 0.35
    body = body + knock
    body[: len(click)] += click
    return soft(body * 1.1, 1.6)


def clap() -> np.ndarray:
    d = 0.32
    n = noise(d)
    e = np.zeros(len(n))
    t = tarr(d)
    for k, off in enumerate((0.0, 0.011, 0.022, 0.034)):
        e += (t >= off) * np.exp(-(t - off).clip(0) / (0.007 if k < 3 else 0.11))
    x = bp(n, 900, 3200) * e
    body = osc_sine(185, d) * env_exp(d, 0.06) * 0.8 + osc_sine(330, d) * env_exp(d, 0.03) * 0.3
    return (x + body) * 0.8


def hat(open_: bool = False) -> np.ndarray:
    d = 0.32 if open_ else 0.07
    metal = sum(osc_square(f, d) for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)) / 6
    x = hp(bp(metal * 0.6 + noise(d) * 0.4, 6500, 15000), 7000)
    return x * env_exp(d, 0.11 if open_ else 0.022, 0.0005)


def bell(freq: float, dur: float = 1.6, index: float = 2.2, ratio: float = 3.5) -> np.ndarray:
    t = tarr(dur)
    mod_env = np.exp(-t / 0.35)
    mod = np.sin(2 * np.pi * freq * ratio * t) * index * mod_env
    car = np.sin(2 * np.pi * freq * t + mod)
    return car * env_exp(dur, dur / 3.2, 0.002)


def pluck_saw(freq: float, dur: float, cutoff: float = 2400, decay: float = 0.18) -> np.ndarray:
    x = osc_saw(freq, dur) * 0.5 + osc_saw(freq * 1.005, dur) * 0.5
    fc = 300 + cutoff * np.exp(-tarr(dur) / decay)
    return svf(x, fc, 0.9, "lp") * env_exp(dur, decay * 2.2, 0.003)


def pad_chord(notes: list[int], dur: float, cutoff: float = 1600) -> np.ndarray:
    x = np.zeros(int((dur + 0.6) * SR))
    for n in notes:
        for det in (-0.08, 0.0, 0.08):
            x += osc_saw(midi(n + det), dur + 0.6)
    x /= len(notes) * 3
    e = fit(env_adsr(dur, 0.25, 0.6, 0.85, 0.6), len(x))
    return lp(x, cutoff, 2) * e


def whoosh(dur: float, f0: float, f1: float, q: float = 1.4, swell: float = 1.0) -> np.ndarray:
    t = tarr(dur)
    k = t / dur
    fc = f0 * (f1 / f0) ** k
    x = svf(noise(dur), fc, q, "bp")
    e = np.sin(np.pi * np.clip(k, 0, 1)) ** 1.5 if swell >= 1 else np.clip(k, 0, 1) ** 2
    return x * e


def riser(dur: float) -> np.ndarray:
    t = tarr(dur)
    k = t / dur
    x = svf(noise(dur), 300 * (9000 / 300) ** k, 1.8, "bp") * k**2.2
    tone = osc_saw(110 * (2 ** (k * 2)), dur) * 0.08 * k**2
    return x + lp(tone, 3000)


def impact(size: float = 1.0) -> np.ndarray:
    d = 1.4
    t = tarr(d)
    boom = osc_sine(46 + 70 * np.exp(-t / 0.08), d) * env_exp(d, 0.38, 0.001)
    crack = lp(noise(d), 5000) * env_exp(d, 0.05, 0.0005) * 0.6
    return soft((boom + crack) * size, 1.4)


def blip(freq: float, dur: float = 0.05, wave: str = "sine") -> np.ndarray:
    x = osc_sine(freq, dur) if wave == "sine" else osc_square(freq, dur)
    return x * env_exp(dur, dur / 3, 0.001)


def boing(f0: float = 180) -> np.ndarray:
    d = 0.45
    t = tarr(d)
    f = f0 * (1 + 0.9 * np.exp(-t / 0.05)) * (1 + 0.12 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.2))
    return osc_sine(f, d) * env_exp(d, 0.16, 0.002)


def pop(freq: float = 900) -> np.ndarray:
    d = 0.08
    t = tarr(d)
    return osc_sine(freq * (1 + 1.5 * np.exp(-t / 0.008)), d) * env_exp(d, 0.02, 0.0005)


def wood(freq: float = 900) -> np.ndarray:
    d = 0.09
    x = bp(noise(d), freq * 0.7, freq * 1.6) * env_exp(d, 0.012, 0.0005)
    tone = osc_sine(freq, d) * env_exp(d, 0.02, 0.0005) * 0.6
    return x * 0.8 + tone


def metal_hit() -> np.ndarray:
    d = 2.2
    parts = [(180, 1.0, 0.9), (427, 0.6, 0.7), (683, 0.5, 0.5), (1051, 0.35, 0.35), (1609, 0.25, 0.22), (2390, 0.18, 0.15)]
    x = sum(a * osc_sine(f, d) * env_exp(d, dec, 0.001) for f, a, dec in parts)
    return x / 2.2 + fit(impact(0.9), len(x)) * 0.8


# ---------------------------------------------------------------- гармония
# A-минор: аккорд на такт (сцену)
CHORDS = {
    "Am": {"root": 33, "pad": [57, 60, 64, 71], "arp": [57, 60, 64, 69, 72, 69, 64, 60]},
    "F": {"root": 29, "pad": [53, 57, 60, 64], "arp": [53, 57, 60, 65, 69, 65, 60, 57]},
    "C": {"root": 36, "pad": [55, 60, 64, 71], "arp": [55, 60, 64, 67, 72, 67, 64, 60]},
    "G": {"root": 31, "pad": [55, 59, 62, 69], "arp": [55, 59, 62, 67, 71, 67, 62, 59]},
}
PROG = ["Am", "F", "C", "G", "Am", "F", "C", "G", "Am", "F"]


def step_time(bar_start_f: float, step: float) -> float:
    return sec(bar_start_f + step * STEP_F)


# ---------------------------------------------------------------- партитура
kick_times: list[float] = []


def put_kick(t: float, gain: float = 1.0, punch: float = 1.0) -> None:
    drums.add(kick(punch), t, 0.95 * gain)
    kick_times.append(t)


def groove_bar(i: int, variant: str = "full") -> None:
    """Барабаны на один такт сцены i"""
    b = scene_f(i)
    kicks = {"full": [0, 8, 10], "sparse": [0, 8], "push": [0, 6, 8, 10, 14]}[variant]
    for s in kicks:
        put_kick(step_time(b, s), 1.0 if s in (0, 8) else 0.8)
    for s in (4, 12):
        c = clap()
        drums.add(c, step_time(b, s), 0.55)
        verb_send.add(c, step_time(b, s), 0.22)
    for s in range(0, 16, 2):
        drums.add(hat(), step_time(b, s), 0.16 if s % 4 == 0 else 0.24, pan=0.25)
    for s in (7, 13, 15):
        drums.add(hat(), step_time(b, s), 0.09, pan=-0.2)
    if i % 2 == 1:
        drums.add(hat(True), step_time(b, 14), 0.12, pan=0.3)


def bass_bar(i: int, chord: str) -> None:
    b = scene_f(i)
    root = CHORDS[chord]["root"]
    pattern = [(0, 0, 2.5), (3, 0, 1.5), (6, 12, 1.5), (8, 0, 2.5), (11, 0, 1.5), (14, 7, 1.5)]
    for s, off, length in pattern:
        f = midi(root + off)
        d = length * STEP_F / FPS
        sub = osc_sine(f, d + 0.06)
        mid = soft(osc_saw(f * 2, d + 0.06) * 0.6, 2.0)
        x = sub * 0.42 + lp(mid, 1500) * 0.72
        e = fit(env_adsr(d, 0.004, 0.12, 0.75, 0.06), len(x))
        bass.add(x * e, step_time(b, s), 0.55)


def pad_bar(start_f: float, chord: str, bars: float = 1.0, gain: float = 0.2, cutoff: float = 1800) -> None:
    d = bars * SCENE_F / FPS
    x = pad_chord(CHORDS[chord]["pad"], d, cutoff)
    music.add(x, sec(start_f), gain, pan=-0.1)
    music.add(x, sec(start_f) + 0.012, gain * 0.8, pan=0.3)
    verb_send.add(x, sec(start_f), gain * 0.6)


def arp_bar(i: int, chord: str, gain: float, kind: str = "pluck", every: int = 1) -> None:
    b = scene_f(i)
    notes = CHORDS[chord]["arp"]
    for s in range(0, 16, every):
        n = notes[s % len(notes)] + 12
        if kind == "pluck":
            x = pluck_saw(midi(n), 0.3, 1800, 0.08)
        elif kind == "saw":
            x = pluck_saw(midi(n - 12), 0.4, 3200, 0.14)
        else:
            x = bell(midi(n), 0.9, 1.4, 2.0)
        t = step_time(b, s)
        music.add(x, t, gain, pan=0.35 if s % 2 else -0.35)
        # эхо пунктирной восьмой
        music.add(x, t + 3 * STEP_F / FPS, gain * 0.35, pan=-0.5 if s % 2 else 0.5)
        verb_send.add(x, t, gain * 0.3)


def transition_whoosh(cut_f: int, pre: int, post: int, f0: float, f1: float, gain: float, pan: float = 0.0) -> None:
    d = (pre + post + 6) / FPS
    sfx.add(whoosh(d, f0, f1), sec(cut_f - pre - 3), gain, pan)


def build() -> None:
    # ---------------- Интро
    pad_bar(0, "Am", 1.0, 0.11, 900)
    r = riser(sec(INTRO_F))
    gap = int(0.05 * SR)
    r[-gap:] *= np.linspace(1, 0, gap) ** 3
    sfx.add(r, 0.0, 0.16)
    sfx.add(pop(1400), sec(7), 0.32)  # точка появилась
    sfx.add(impact(0.55), sec(15), 0.38)  # круг растёт
    verb_send.add(bell(midi(81), 1.5), sec(16), 0.12)
    sfx.add(whoosh(0.9, 400, 4000), sec(44), 0.16, -0.3)  # кольцевая надпись
    for k in range(10):  # десять делений
        sfx.add(blip(midi(76 + [0, 2, 3, 5, 7, 8, 10, 12, 14, 15][k]), 0.06), sec(52 + k * 1.6), 0.09, -0.6 + k * 0.13)
    for s in range(8, 16):
        drums.add(hat(), step_time(0, s), 0.05 + 0.012 * (s - 8))

    # ---------------- Сцены
    for i in range(STYLES):
        chord = PROG[i]
        variant = "sparse" if i in (3,) else "push" if i in (4, 6) else "full"
        groove_bar(i, variant)
        bass_bar(i, chord)
        pad_bar(scene_f(i), chord, 1.0, 0.17 if i != 8 else 0.2)
        if i in (0, 2, 3, 4, 6):
            arp_bar(i, chord, 0.075, "pluck", 2)
        if i == 7:
            arp_bar(i, chord, 0.08, "bell", 2)
        if i == 8:
            arp_bar(i, chord, 0.12, "saw", 1)

    # Переходы: окно [cut - pre, cut + post)
    cuts = [scene_f(i) for i in range(STYLES)] + [OUTRO_START_F]
    sfx.add(impact(1.1), sec(cuts[0]), 0.5)  # дроп: ирис в ар-деко
    verb_send.add(impact(1.0), sec(cuts[0]), 0.15)
    transition_whoosh(cuts[1], 6, 8, 600, 5000, 0.22, -0.6)  # часы
    transition_whoosh(cuts[2], 7, 7, 300, 7000, 0.28, 0.5)  # диагональ
    for k in range(12):  # колонки падают
        tk = cuts[3] - 8 + (k * 0.05 / 1.55) * 16
        sfx.add(wood(1400 + k * 60), sec(tk), 0.12, -0.8 + k * 0.145)
    for k in range(18):  # растровые точки
        sfx.add(pop(1600 + rng.random() * 1800), sec(cuts[4] - 8 + k * 0.9), 0.07, rng.random() * 1.6 - 0.8)
    # плавление: свист вниз
    melt = whoosh(0.7, 3000, 250)
    sfx.add(melt, sec(cuts[5] - 6), 0.24)
    for k in range(9):  # фигуры
        sfx.add(pop(500 + k * 90), sec(cuts[6] - 8 + k * 1.6), 0.13, rng.random() * 1.4 - 0.7)
    sfx.add(pop(2400), sec(cuts[7]), 0.35)  # пузырь лопается
    sfx.add(whoosh(0.5, 2000, 12000), sec(cuts[7] - 4), 0.18)
    for k in range(12):  # жалюзи
        tk = cuts[8] - 8 + (k * (0.5 / 11) / 1.5) * 16
        sfx.add(wood(2600 - k * 80), sec(tk), 0.09, 0.4 - k * 0.07)
    sfx.add(whoosh(0.5, 1500, 9000), sec(cuts[8] - 8), 0.12)
    dig = crush(noise(0.3) * 0.6, 4, 12)
    sfx.add(dig, sec(cuts[9] - 5), 0.2)  # цифровой срыв

    # ---------------- Подписи сцен
    # 01 Ар-деко: колокольчики-глиссандо под лучи, блеск на медальоне
    b = scene_f(0)
    for k, n in enumerate([69, 72, 76, 79, 83, 84, 88, 93]):
        x = bell(midi(n), 1.6)
        music.add(x, sec(b + 2 + k * 2.2), 0.07, -0.6 + k * 0.17)
        verb_send.add(x, sec(b + 2 + k * 2.2), 0.08)
    sfx.add(whoosh(0.6, 5000, 14000), sec(b + 28), 0.08, 0.4)

    # 02 Баухаус: механика
    b = scene_f(1)
    for f, fq, g in ((18, 700, 0.3), (24, 520, 0.34), (30, 900, 0.18), (32, 1100, 0.16), (40, 800, 0.22), (60, 800, 0.22)):
        sfx.add(wood(fq), sec(b + f), g)
    for k in range(7):
        sfx.add(wood(2200 + k * 40), sec(b + 22 + k * 2.6), 0.1, -0.5 + k * 0.12)
    for f in (30, 50, 70):
        for r in range(3):
            sfx.add(wood(1600), sec(b + f + r * 1.5), 0.07, -0.7)

    # 03 Конструктивизм: свист клина и металлический удар
    b = scene_f(2)
    sfx.add(whoosh(10 / FPS + 0.1, 200, 3000, swell=0), sec(b + 6), 0.3, -0.5)
    sfx.add(metal_hit(), sec(b + 16), 0.42, 0.15)
    verb_send.add(metal_hit(), sec(b + 16), 0.18)
    for k in range(0, 14, 2):
        sfx.add(kick(0.4)[: int(0.12 * SR)], sec(b + 13 + k * 1.3), 0.14, -0.6 + k * 0.09)
    hum = osc_sine(60, sec(SCENE_F)) * 0.5 + osc_sine(120.5, sec(SCENE_F)) * 0.2
    sfx.add(hum * fit(env_adsr(sec(SCENE_F) - 0.3, 0.3, 1, 1, 0.3), len(hum)), sec(b), 0.04)

    # 04 Швейцарский: точные тики, панорама вслед за кругом (справа налево)
    b = scene_f(3)
    for k, f in enumerate((26, 36, 46, 56)):
        sfx.add(blip(2093, 0.03), sec(b + f), 0.22, 0.55 - k * 0.3)
        sfx.add(blip(4186, 0.015), sec(b + f), 0.08, 0.55 - k * 0.3)

    # 05 Поп-арт: «поу» и слэм заголовка
    b = scene_f(4)
    sfx.add(crush(impact(1.2), 6, 3), sec(b), 0.3)
    imp = impact(1.3)
    slam = imp + fit(clap(), len(imp))
    sfx.add(soft(slam, 2.0), sec(b + 15), 0.42)
    verb_send.add(clap(), sec(b + 15), 0.3)
    sfx.add(boing(140), sec(b + 17), 0.12)

    # 06 Психоделия: вау-стабы на слабые доли и пульсирующий гул
    b = scene_f(5)
    for s in (2, 6, 10, 14):
        d = 0.32
        notes = CHORDS["F"]["pad"]
        x = sum(osc_saw(midi(n), d) for n in notes) / 4
        fc = 400 + 2600 * np.sin(np.pi * np.clip(tarr(d) / d, 0, 1)) ** 2
        y = svf(x, fc, 3.0, "lp") * env_exp(d, 0.2, 0.004)
        music.add(y, step_time(b, s), 0.2, 0.4 if s % 4 == 2 else -0.4)
        verb_send.add(y, step_time(b, s), 0.1)
    drone = osc_saw(midi(41), sec(SCENE_F)) * (1 + 0.5 * np.sin(2 * np.pi * 0.75 * tarr(sec(SCENE_F))))
    music.add(lp(drone, 500) * fit(env_adsr(sec(SCENE_F) - 0.2, 0.3, 1, 1, 0.2), len(drone)), sec(b), 0.05)

    # 07 Мемфис: «боинги» и поп-щелчки букв
    b = scene_f(6)
    sfx.add(boing(150), sec(b + 10), 0.28)  # круг коснулся «пола»
    sfx.add(boing(190), sec(b + 15.5), 0.1)  # первый отскок
    sfx.add(pop(700), sec(b + 4), 0.18, 0.5)
    sfx.add(pop(560), sec(b + 7), 0.18, -0.5)
    pent = [72, 74, 76, 79, 81, 84]
    for k in range(6):
        sfx.add(pop(midi(pent[k])), sec(b + 18 + k * 2.2), 0.16, -0.5 + k * 0.2)  # буква приземлилась
    for hop in (40, 60):
        for k in range(6):
            sfx.add(blip(midi(pent[k] + 12), 0.04), sec(b + hop + k * 2), 0.06, -0.5 + k * 0.2)
    sfx.add(boing(220), sec(b + 66), 0.12)

    # 08 Y2K: надувание, искры, блеск
    b = scene_f(7)
    sfx.add(boing(320), sec(b + 1), 0.14)
    for k, f in enumerate((10, 18, 27, 33, 45, 52, 63, 70)):
        x = bell(midi(96 + [0, 3, 7, 10, 12, 7, 3, 15][k]), 0.8, 1.2, 2.0)
        sfx.add(x, sec(b + f), 0.05, rng.random() * 1.6 - 0.8)
        verb_send.add(x, sec(b + f), 0.05)
    for f in (18, 56):
        sfx.add(whoosh(0.5, 4000, 15000), sec(b + f), 0.1, 0.3)

    # 09 Ретровейв: неон включается с тем же мерцанием, что и картинка
    b = scene_f(8)
    flicker = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1]
    d = len(flicker) / FPS + 0.3
    z = hp(soft(osc_saw(100, d) * 0.7 + osc_square(150, d) * 0.3, 2.5), 120)
    tt = tarr(d)
    gate = np.array([flicker[min(int(x * FPS), len(flicker) - 1)] if x * FPS < len(flicker) else 0.35 for x in tt], dtype=float)
    gate = np.convolve(gate, np.ones(96) / 96, mode="same")
    gate *= np.where(tt * FPS > len(flicker), np.exp(-(tt * FPS - len(flicker)) / 3), 1)
    sfx.add(z * gate, sec(b), 0.12)
    fly = tarr(0.5)
    fly_sig = svf(noise(0.5), 6000 * np.exp(-fly / 0.25) + 300, 1.2, "bp") * np.sin(np.pi * np.clip(fly / 0.5, 0, 1))
    sfx.add(fly_sig, sec(b + 6), 0.3, 0.7)
    # «гейтовый» реверб на хлопках — примета 80-х
    for s in (4, 12):
        tt = tarr(0.25)
        tail = lp(noise(0.25), 6000) * np.clip((0.22 - tt) / 0.01, 0, 1) * 0.25
        verb_send.add(tail, step_time(b, s), 0.25)

    # 10 Глитч: см. post-обработку (стоттер, биткраш) ниже
    b = scene_f(9)
    for k in range(10):
        f = 1200 + rng.random() * 2400
        sfx.add(blip(f, 0.035, "square"), sec(b + 42 + k * 1.4), 0.05, rng.random() * 1.6 - 0.8)
    for f in (0, 3, 44, 49, 65):
        sfx.add(crush(noise(0.12), 3, 20), sec(b + f), 0.09)
    # выключение ЭЛТ
    d = 0.42
    tt = tarr(d)
    off = osc_sine(1800 * np.exp(-tt / 0.08) + 60, d) * env_exp(d, 0.18, 0.001)
    sfx.add(off, sec(OUTRO_START_F - 8), 0.24)
    sfx.add(hp(noise(0.3), 3000) * env_exp(0.3, 0.06), sec(OUTRO_START_F - 8), 0.08)

    # ---------------- Финал
    o = OUTRO_START_F
    tt = tarr(0.5)
    up = osc_sine(60 + 240 * np.clip(tt / 0.5, 0, 1) ** 2, 0.5) * np.sin(np.pi * np.clip(tt / 0.5, 0, 1))
    sfx.add(up, sec(o), 0.12)
    pad_bar(o + 6, "F", 0.6, 0.1, 1200)
    for k in range(10):
        n = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91][k]
        x = bell(midi(n), 1.4, 1.5, 3.0)
        t_arr = sec(o + 12 + k * 1.3 + 16)
        music.add(x, t_arr, 0.08, -0.8 + k * 0.18)
        verb_send.add(x, t_arr, 0.08)
    put_kick(sec(o + 46), 0.8, 0.7)
    sfx.add(impact(0.7), sec(o + 46), 0.22)
    final = pad_chord([57, 60, 64, 67, 71], sec(OUTRO_F - 46) - 0.6, 1400)
    music.add(final, sec(o + 46), 0.16, -0.15)
    music.add(final, sec(o + 46) + 0.015, 0.13, 0.25)
    verb_send.add(final, sec(o + 46), 0.12)
    sub = osc_sine(midi(33), sec(OUTRO_F - 46))
    sub = sub * fit(env_adsr(sec(OUTRO_F - 46) - 0.8, 0.02, 0.8, 0.6, 0.8), len(sub))
    bass.add(sub, sec(o + 46), 0.4)
    sfx.add(whoosh(0.9, 5000, 15000), sec(o + 66), 0.06, 0.3)


# ---------------------------------------------------------------- сведение
def biquad(kind: str, f0: float, gain_db: float, q: float = 0.707) -> tuple[np.ndarray, np.ndarray]:
    """RBJ-эквалайзер: 'peak', 'lowshelf', 'highshelf'"""
    A = 10 ** (gain_db / 40)
    w = 2 * math.pi * f0 / SR
    cw, sw = math.cos(w), math.sin(w)
    alpha = sw / (2 * q)
    if kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    else:
        sq = 2 * math.sqrt(A) * alpha
        if kind == "lowshelf":
            b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
            a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
            a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    return np.array(b) / a[0], np.array(a) / a[0]


def master_eq(x: np.ndarray) -> np.ndarray:
    """Меньше саба, плотнее середина — чтобы звучало и на телефоне"""
    for kind, f0, g, q in (("lowshelf", 65, -4.5, 0.7), ("peak", 220, 1.5, 0.8), ("peak", 800, 3.0, 0.6), ("peak", 2500, 1.5, 0.8)):
        b, a = biquad(kind, f0, g, q)
        x = signal.lfilter(b, a, x, axis=1)
    return x


def lufs(x: np.ndarray) -> float:
    """Интегральная громкость по ITU-R BS.1770-4 (K-взвешивание, стробирование)"""
    sos_shelf = signal.iirfilter(2, 1681.97, btype="highpass", ftype="butter", fs=SR, output="sos")
    b_sh = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a_sh = [1.0, -1.69065929318241, 0.73248077421585]
    b_hp = [1.0, -2.0, 1.0]
    a_hp = [1.0, -1.99004745483398, 0.99007225036621]
    del sos_shelf
    if SR != 48000:
        raise ValueError("коэффициенты K-фильтра даны для 48 кГц")
    y = signal.lfilter(b_hp, a_hp, signal.lfilter(b_sh, a_sh, x, axis=1), axis=1)
    block, hop = int(0.4 * SR), int(0.1 * SR)
    z = np.array([np.mean(y[:, i : i + block] ** 2, axis=1).sum() for i in range(0, y.shape[1] - block, hop)])
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    z1 = z[lk > -70]
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z1[(-0.691 + 10 * np.log10(z1)) > rel]
    return float(-0.691 + 10 * np.log10(np.mean(z2)))

def make_ir(dur: float = 2.2, decay: float = 0.55) -> np.ndarray:
    t = tarr(dur)
    ir = np.vstack([rng.standard_normal(len(t)), rng.standard_normal(len(t))]) * np.exp(-t / decay)
    ir = np.vstack([lp(ir[0], 7000), lp(ir[1], 6000)])
    ir[:, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir**2) / 2)


def sidechain(times: list[float], depth: float = 0.55, rel: float = 0.13) -> np.ndarray:
    g = np.ones(N)
    t = np.arange(N) / SR
    for tk in times:
        i0 = int(tk * SR)
        i1 = min(N, i0 + int(rel * 6 * SR))
        seg = t[i0:i1] - tk
        g[i0:i1] = np.minimum(g[i0:i1], 1 - depth * np.exp(-seg / rel))
    return g


def glitch_post(mix_bus: Bus) -> None:
    """Стоттер и биткраш во время сбоев сцены «Глитч» (окна как в glitchSchedule.ts)"""
    b = scene_f(9)
    bursts = [(-1, 7), (22, 25), (42, 56), (64, 70)]
    buf = mix_bus.buf
    for a, z in bursts:
        i0 = int(sec(b + a) * SR)
        i1 = int(sec(b + z) * SR)
        seg = buf[:, i0:i1].copy()
        # повтор кусочков по 1/32 доли — «заедание»
        L = int(STEP_F / 2 / FPS * SR)
        if seg.shape[1] > L:
            src = seg[:, :L] * np.hanning(L) ** 0.25
            reps = seg.shape[1] // L
            stut = np.tile(src, reps)
            stut = np.pad(stut, ((0, 0), (0, seg.shape[1] - stut.shape[1])))
            seg = 0.5 * seg + 0.6 * stut
        crushed = np.vstack([crush(seg[0], 5, 6), crush(seg[1], 5, 6)])
        fade = np.ones(seg.shape[1])
        f = min(240, seg.shape[1] // 4)
        if f > 0:
            fade[:f] = np.linspace(0, 1, f)
            fade[-f:] = np.linspace(1, 0, f)
        buf[:, i0:i1] = buf[:, i0:i1] * (1 - fade) + crushed * fade


def limiter(x: np.ndarray, ceiling: float = 0.84, look: float = 0.004, release: float = 0.09) -> np.ndarray:
    L = int(look * SR)
    peak = np.max(np.abs(x), axis=0)
    target = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    # минимум по окну упреждения
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    # минимум по окну ±L и сглаживание окном L: усиление снижается заранее и плавно,
    # среднее значение на пике не больше нужного
    g = uniform_filter1d(minimum_filter1d(target, size=2 * L + 1), size=L)
    # плавное восстановление после пика
    a = math.exp(-1 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        v = g[i]
        cur = v if v < cur else a * cur + (1 - a) * v
        out[i] = cur
    return x * out


def main() -> int:
    build()
    duck = sidechain(kick_times)
    bass.buf *= duck
    music.buf *= 0.55 + 0.45 * duck

    ir = make_ir()
    wet = np.vstack(
        [
            signal.fftconvolve(verb_send.buf[0], ir[0])[:N],
            signal.fftconvolve(verb_send.buf[1], ir[1])[:N],
        ]
    )
    wet = hp(wet, 180) * 0.5

    drums.buf = np.vstack([hp(drums.buf[0], 30), hp(drums.buf[1], 30)])
    mix = Bus()
    mix.buf = drums.buf * 0.9 + bass.buf * 0.95 + music.buf * 1.0 + sfx.buf * 1.0 + wet
    glitch_post(mix)
    mix.buf = master_eq(np.vstack([hp(mix.buf[0], 32), hp(mix.buf[1], 32)]))

    # громкость: −14 LUFS до лимитера, затем лимитер −1 dBFS
    loud = lufs(mix.buf)
    mix.buf *= 10 ** ((-14.0 - loud) / 20)
    out = limiter(mix.buf)
    print(f"громкость до лимитера {loud:.1f} LUFS → после {lufs(out):.1f} LUFS")

    # мягкий вход и затухание в конце
    fi = int(0.01 * SR)
    out[:, :fi] *= np.linspace(0, 1, fi)
    fo_start = int(sec(TOTAL_F - 34) * SR)
    fo = N - fo_start
    out[:, fo_start:] *= np.linspace(1, 0, fo) ** 1.5

    peak = float(np.max(np.abs(out)))
    if not np.all(np.isfinite(out)):
        print("ошибка: NaN/Inf в сигнале", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # 16 бит с TPDF-дизерингом — читается любым декодером
    dither = (rng.random(out.T.shape) - rng.random(out.T.shape)) / 32768
    pcm = np.clip(out.T + dither, -1, 1 - 1 / 32768)
    wavfile.write(OUT, SR, np.round(pcm * 32767).astype(np.int16))
    print(f"{OUT}: {DUR:.3f} с, {N} сэмплов, пик {20 * math.log10(peak):.2f} dBFS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
