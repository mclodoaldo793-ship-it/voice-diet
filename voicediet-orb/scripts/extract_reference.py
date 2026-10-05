"""Извлекает референс сферы VoiceDiet из PDF в единую систему координат.

Кадр: квадрат 520x520 pt страницы 1, центр в центре точечной оболочки,
выход 1024x1024 px. Сохраняет:
  reference/ref_full.png    - страница целиком (фон + ядро + оболочка)
  reference/ref_core.png    - только ядро (картинка-пузырь, RGBA)
  reference/ref_shell_a.png - альфа точечной оболочки (L)
  reference/ref_bg.png      - фон страницы без сферы (для композита рендера)
  reference/frame.json      - параметры кадра
"""
import json, sys
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image

PDF = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\IlyaL\Downloads\VoiceDiet 3_0.pdf")
OUT = Path(__file__).resolve().parent.parent / "reference"
OUT.mkdir(exist_ok=True)

SIZE = 1024
CX, CY, HALF = 812.6, 425.1, 260.0          # кадр в pt страницы
X0, Y0 = CX - HALF, CY - HALF
S = SIZE / (2 * HALF)                         # px на pt

doc = pymupdf.open(PDF)
page = doc[0]
info = {i["xref"]: i for i in page.get_image_info(xrefs=True)}

# 1. Полная страница в кадре
clip = pymupdf.Rect(X0, Y0, X0 + 2 * HALF, Y0 + 2 * HALF)
pix = page.get_pixmap(matrix=pymupdf.Matrix(S, S), clip=clip, alpha=False)
full = Image.frombytes("RGB", (pix.width, pix.height), pix.samples).resize((SIZE, SIZE), Image.LANCZOS)
full.save(OUT / "ref_full.png")


def place(img, transform):
    """Кладёт картинку в кадр по матрице PDF (единичный квадрат -> страница)."""
    a, b, c, d, e, f = transform
    W, H = img.size
    # пиксель кадра (px,py) -> страница -> (u,v) единичного квадрата -> пиксель картинки
    M = np.array([[a, c, e], [b, d, f], [0, 0, 1]], float)
    Minv = np.linalg.inv(M)
    F = np.array([[1 / S, 0, X0], [0, 1 / S, Y0], [0, 0, 1]], float)
    U = np.array([[W, 0, 0], [0, H, 0], [0, 0, 1]], float)
    T = U @ Minv @ F
    return img.transform((SIZE, SIZE), Image.AFFINE, data=tuple(T[:2].ravel()),
                         resample=Image.BICUBIC, fillcolor=(0,) * len(img.getbands()))


# 2. Ядро (xref 223)
core = pymupdf.Pixmap(doc, 223)
core_img = Image.frombytes("RGB", (core.width, core.height), core.samples).convert("RGBA")
place(core_img, info[223]["transform"]).save(OUT / "ref_core.png")

# 3. Альфа оболочки (smask xref 224)
mask = pymupdf.Pixmap(doc, 224)
mask_img = Image.frombytes("L", (mask.width, mask.height), mask.samples)
place(mask_img, info[225]["transform"]).save(OUT / "ref_shell_a.png")
shell_rgb = pymupdf.Pixmap(doc, 225)
rgb = np.frombuffer(shell_rgb.samples, np.uint8).reshape(shell_rgb.height, shell_rgb.width, 3)

# 4. Фон без сферы: рендер страницы с удалёнными картинками сферы
bgdoc = pymupdf.open(PDF)
bp = bgdoc[0]
for x in (223, 225):
    bp.delete_image(x)
pix = bp.get_pixmap(matrix=pymupdf.Matrix(S, S), clip=clip, alpha=False)
Image.frombytes("RGB", (pix.width, pix.height), pix.samples).resize((SIZE, SIZE), Image.LANCZOS).save(OUT / "ref_bg.png")

json.dump({
    "page_frame_pt": [X0, Y0, 2 * HALF, 2 * HALF], "size_px": SIZE, "px_per_pt": S,
    "core_transform": info[223]["transform"], "shell_transform": info[225]["transform"],
    "shell_rgb_mean": rgb.reshape(-1, 3).mean(0).tolist(), "shell_rgb_min": rgb.reshape(-1, 3).min(0).tolist(),
}, open(OUT / "frame.json", "w"), indent=1)
print("ok", rgb.reshape(-1, 3).mean(0), rgb.reshape(-1, 3).min(0))
