#!/usr/bin/env python3
"""Рендер styleframes: главное состояние каждой сцены и ключевые кадры переходов
в planning/styleframes/ (JPEG 1920×1080, качество 92) + общий контактный лист."""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
OUT = os.path.join(ROOT, "planning", "styleframes")

FRAMES = {
    30: "00_intro_odin_krug",
    62: "00_intro_ring",
    86: "tr01_iris",
    130: "01_art_deco",
    162: "tr02_clock",
    210: "02_bauhaus",
    240: "tr03_diagonal",
    290: "03_constructivism",
    318: "tr04_columns",
    382: "04_swiss",
    398: "tr05_halftone",
    440: "05_pop_art",
    480: "tr06_melt",
    520: "06_psychedelia",
    560: "tr07_shapes",
    605: "07_memphis",
    640: "tr08_flash",
    680: "08_y2k",
    720: "tr09_blinds",
    760: "09_retrowave",
    798: "tr10_glitch",
    830: "10_glitch",
    848: "10_glitch_burst",
    876: "tr11_crt",
    1000: "11_outro",
}


def main() -> int:
    tmp = tempfile.mkdtemp(prefix="sf-")
    frames = ",".join(str(f) for f in FRAMES)
    cmd = ["npx", "remotion", "render", "TenStyles", tmp, f"--frames={frames}", "--image-format=png", "--sequence", "--log=error"]
    res = subprocess.run(cmd, cwd=ROOT)
    if res.returncode != 0:
        return res.returncode
    os.makedirs(OUT, exist_ok=True)
    produced = sorted(os.listdir(tmp))
    paths = []
    for name in produced:
        num = int("".join(ch for ch in name if ch.isdigit()))
        if num not in FRAMES:
            continue
        dst = os.path.join(OUT, f"{FRAMES[num]}_f{num:04d}.jpg")
        Image.open(os.path.join(tmp, name)).convert("RGB").save(dst, quality=92, optimize=True, progressive=True)
        paths.append(dst)
    shutil.rmtree(tmp, ignore_errors=True)
    sheet = os.path.join(OUT, "contact_sheet.jpg")
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "contact_sheet.py"), sheet, *sorted(paths), "--cols", "5", "--width", "384"], check=True)
    print(f"{len(paths)} styleframes → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
