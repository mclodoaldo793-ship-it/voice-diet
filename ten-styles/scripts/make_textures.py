#!/usr/bin/env python3
"""Генерирует бесшовную текстуру зерна public/textures/grain.png (детерминированно, seed=7)."""
import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures", "grain.png")


def main() -> None:
    rng = np.random.default_rng(7)
    n = rng.normal(0.0, 1.0, (512, 512))
    # лёгкое размытие 3×3 по тору — зерно мягче, текстура остаётся бесшовной
    k = sum(np.roll(np.roll(n, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0
    k = (k - k.mean()) / k.std()
    img = np.clip(128 + k * 46, 0, 255).astype(np.uint8)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(img, "L").save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
