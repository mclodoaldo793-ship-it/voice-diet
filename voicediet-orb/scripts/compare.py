"""Сравнение рендера с референсом: рядом, наложение, разница, метрики.

Вход:  reference/ref_full.png, ref_shell_a.png, ref_core.png
       renders/<name>_ref_view.png, renders/<name>_shell_only.png (если есть)
Выход: qa/<name>_side_by_side.png, qa/<name>_overlay.png, qa/<name>_diff.png,
       qa/<name>_shell_overlay.png, qa/<name>_metrics.json
Запуск: py scripts/compare.py threejs
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
name = sys.argv[1] if len(sys.argv) > 1 else "threejs"
Q = ROOT / "qa"
Q.mkdir(exist_ok=True)


def load(p, mode="RGB"):
    return np.asarray(Image.open(p).convert(mode), np.float32) / 255


def blur(a, s):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), np.float32) / 255


ref = load(ROOT / "reference/ref_full.png")
ren_p = ROOT / f"renders/{name}_ref_view.png"
ren_img = Image.open(ren_p)
if ren_img.mode == "RGBA":  # прозрачный рендер (Blender) -> на фон слайда
    bg = Image.open(ROOT / "reference/ref_bg.png").convert("RGBA")
    ren_img = Image.alpha_composite(bg, ren_img.resize(bg.size))
ren = np.asarray(ren_img.convert("RGB").resize((1024, 1024)), np.float32) / 255

yy, xx = np.mgrid[:1024, :1024]
core_m = np.hypot(xx - 512.5, yy - 509) < 362 * 0.97
m = {}
m["rmse_full_255"] = float(np.sqrt(((ren - ref) ** 2).mean()) * 255)
m["rmse_full_blur3_255"] = float(np.sqrt(((blur(ren, 3) - blur(ref, 3)) ** 2).mean()) * 255)
m["rmse_core_region_blur3_255"] = float(np.sqrt(((blur(ren, 3) - blur(ref, 3))[core_m] ** 2).mean()) * 255)

shell_p = ROOT / f"renders/{name}_shell_only.png"
if shell_p.exists():
    ra = load(ROOT / "reference/ref_shell_a.png", "L")
    sa = load(shell_p, "L")
    fill = lambda a: blur(a, 8) > 0.07
    fr, fs = fill(ra), fill(sa)
    m["silhouette_iou"] = float((fr & fs).sum() / (fr | fs).sum())
    for s in (2, 4, 8):
        a, b = blur(ra, s).ravel(), blur(sa, s).ravel()
        m[f"density_corr_blur{s}"] = float(np.corrcoef(a, b)[0, 1])
    m["mean_alpha_ref"] = float(ra.mean())
    m["mean_alpha_render"] = float(sa.mean())
    ov = np.zeros((1024, 1024, 3), np.float32)
    ov[..., 0] = ra            # референс - пурпурный
    ov[..., 2] = ra
    ov[..., 1] = sa            # рендер - зелёный; совпадение -> белое
    Image.fromarray((np.clip(ov, 0, 1) * 255).astype(np.uint8)).save(Q / f"{name}_shell_overlay.png")
    # контуры силуэтов поверх референса
    cont = (ref * 255).astype(np.uint8).copy()
    for f, c in ((fr, (255, 0, 160)), (fs, (0, 160, 90))):
        e = f ^ (np.asarray(Image.fromarray(f.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5))) > 0)
        cont[e] = c
    Image.fromarray(cont).save(Q / f"{name}_silhouettes.png")

def label(img, text):
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    ImageDraw.Draw(im).text((16, 14), text, fill=(30, 28, 60))
    return np.asarray(im, np.float32) / 255

side = np.concatenate([label(ref, "REFERENCE (PDF)"), label(ren, f"RENDER ({name})")], 1)
Image.fromarray((side * 255).astype(np.uint8)).save(Q / f"{name}_side_by_side.png")
Image.fromarray(((ref * 0.5 + ren * 0.5) * 255).astype(np.uint8)).save(Q / f"{name}_overlay.png")
diff = np.clip(np.abs(ren - ref).mean(2) * 3, 0, 1)
Image.fromarray((diff * 255).astype(np.uint8)).save(Q / f"{name}_diff.png")
json.dump(m, open(Q / f"{name}_metrics.json", "w"), indent=1)
print(json.dumps(m, indent=1))
