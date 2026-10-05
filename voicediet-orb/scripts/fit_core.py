"""Подгонка параметрического шейдера ядра под референс (PyTorch).

Шейдер зависит только от нормали в пространстве камеры n (x вправо,
y вверх, z к зрителю). Та же формула - в viewer (GLSL) и в Blender (ноды).
Все цвета и смешивания - в sRGB (как в макете).

  col = colorLight
  col = mix(col, colorDeep,   deepAmount * sigmoid((dot(n,dirDeep)-deepThreshold)/deepWidth))
  col = mix(col, colorViolet, violetAmount * gauss(n.xy - violetCenter, violetSize))
  col = screen(col, colorGlow * (glowI*gaussK(n.xy-glowCenter, glowSize, glowShape) + haloI*gauss(.., haloSize)))
  col = screen(col, colorSpec * specI * gaussK(rot(n.xy - specCenter), specSize, specShape))
  gaussK(d, s, k) = exp(-0.5 * (|d/s|^2)^k)   (k=1 - гаусс, k>1 - плоская вершина, чёткий край)
  fres = (1 - dot(n, v))^fresnelPower        (v - направление на камеру)
  col = mix(col, colorRim, rimAmount * fres);  alpha = 1 - rimTransparency * fres

Результат: build/core_fit.json, qa/core_fit_compare.png
"""
import json, math
from pathlib import Path
import numpy as np
import sys
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shell_model as SM  # камера/фокус общие с оболочкой

ROOT = Path(__file__).resolve().parent.parent
CX, CY, R = 512.5, 509.0, 362.0

core = np.asarray(Image.open(ROOT / "reference/ref_core.png").convert("RGB"), np.float32) / 255
bg = np.asarray(Image.open(ROOT / "reference/ref_bg.png").convert("RGB"), np.float32) / 255
yy, xx = np.mgrid[:1024, :1024].astype(np.float64)
# перспектива как в сцене: луч из камеры -> пересечение со сферой ядра (центр (0,0,-D), R=1).
# Центр ядра в референсе смещён на (0.5, -3) px от центра кадра - учитываем сдвигом лучей.
dx = (xx + 0.5 - CX) / SM.FOCAL
dy = -(yy + 0.5 - CY) / SM.FOCAL
dvec = np.stack([dx, dy, -np.ones_like(dx)], -1)
dvec /= np.linalg.norm(dvec, axis=-1, keepdims=True)
c = np.array([0, 0, -SM.CAM_DIST])
tc = dvec @ c
disc = tc ** 2 - (c @ c - SM.CORE_R ** 2)
hit = disc > 0
t = tc - np.sqrt(np.clip(disc, 0, None))
Pn = dvec * t[..., None] - c
Pn /= np.linalg.norm(Pn, axis=-1, keepdims=True)
facing = np.clip((Pn * -dvec).sum(-1), 0, 1)              # dot(n, v)
rr = np.where(hit, 1 - facing ** 2, 2.0)                  # для масок: 0 в центре, 1 на краю
valid = hit & (facing > 0.06) & (core.sum(2) > 0.3)        # без чёрных углов исходной картинки
sel = np.nonzero(valid.ravel())[0][::2]
NV = np.concatenate([Pn, facing[..., None]], -1).reshape(-1, 4).astype(np.float32)
N = torch.tensor(NV[sel])
T = torch.tensor(core.reshape(-1, 3)[sel])
B = torch.tensor(bg.reshape(-1, 3)[sel])
# горячее пятно и блик весомее (крупные перцептивные детали)
Wt = torch.ones(len(sel))
hot = ((N[:, 0] + 0.28) ** 2 + (N[:, 1] - 0.10) ** 2 < 0.2 ** 2) | ((N[:, 0] - 0.30) ** 2 + (N[:, 1] + 0.78) ** 2 < 0.15 ** 2)
Wt[hot] = 3.0


def isig(x):
    return math.log(x / (1 - x))


def unit(a):  # 2 угла -> единичный вектор
    return torch.stack([torch.sin(a[0]) * torch.cos(a[1]), torch.sin(a[1]), torch.cos(a[0]) * torch.cos(a[1])])


def col(*rgb):
    return torch.tensor([isig(c) for c in rgb])


P = {
    "c_light": col(0.98, 0.86, 0.99), "c_deep": col(0.85, 0.45, 0.95), "c_violet": col(0.62, 0.40, 0.93),
    "c_rim": col(0.80, 0.90, 0.98), "c_glow": col(0.97, 0.97, 0.97), "c_spec": col(0.97, 0.95, 0.97),
    "a_deep": torch.tensor([0.6, -0.5]), "deep_t": torch.tensor(0.4), "deep_w": torch.tensor(math.log(0.2)),
    "deep_k": torch.tensor(isig(0.9)),
    "vio_c": torch.tensor([0.72, -0.45]), "vio_s": torch.tensor(math.log(0.2)), "vio_k": torch.tensor(isig(0.6)),
    "glow_c": torch.tensor([-0.28, 0.10]), "glow_s": torch.tensor(math.log(0.12)), "glow_k": torch.tensor(isig(0.9)),
    "halo_s": torch.tensor(math.log(0.35)), "halo_k": torch.tensor(isig(0.4)),
    "spec_c": torch.tensor([0.30, -0.78]), "spec_s": torch.tensor([math.log(0.15), math.log(0.07)]),
    "spec_rot": torch.tensor(0.3), "spec_k": torch.tensor(isig(0.9)),
    "glow_shape": torch.tensor(0.0), "spec_shape": torch.tensor(0.0),     # log(k)
    "fres_p": torch.tensor(math.log(3.0)), "rim_k": torch.tensor(isig(0.6)), "trans_k": torch.tensor(isig(0.3)),
}
for v in P.values():
    v.requires_grad_()


def g2(dx, dy, s):
    return torch.exp(-0.5 * (dx * dx + dy * dy) / (s * s))


def shade(P, n, Bg):
    S = torch.sigmoid
    c = S(P["c_light"]).expand(len(n), 3)
    kd = S(P["deep_k"]) * S((n[:, :3] @ unit(P["a_deep"]) - P["deep_t"]) / torch.exp(P["deep_w"]))
    c = c + (S(P["c_deep"]) - c) * kd[:, None]
    kv = S(P["vio_k"]) * g2(n[:, 0] - P["vio_c"][0], n[:, 1] - P["vio_c"][1], torch.exp(P["vio_s"]))
    c = c + (S(P["c_violet"]) - c) * kv[:, None]
    gx, gy = n[:, 0] - P["glow_c"][0], n[:, 1] - P["glow_c"][1]
    q_g = (gx * gx + gy * gy) / torch.exp(P["glow_s"]) ** 2
    g = S(P["glow_k"]) * torch.exp(-0.5 * (q_g + 1e-9) ** torch.exp(P["glow_shape"]))         + S(P["halo_k"]) * g2(gx, gy, torch.exp(P["halo_s"]))
    c = 1 - (1 - c) * (1 - S(P["c_glow"]) * torch.clamp(g, 0, 1)[:, None])
    cr, sr = torch.cos(P["spec_rot"]), torch.sin(P["spec_rot"])
    u, v = n[:, 0] - P["spec_c"][0], n[:, 1] - P["spec_c"][1]
    su, sv = torch.exp(P["spec_s"])
    q_s = ((cr * u + sr * v) / su) ** 2 + ((-sr * u + cr * v) / sv) ** 2
    sp = S(P["spec_k"]) * torch.exp(-0.5 * (q_s + 1e-9) ** torch.exp(P["spec_shape"]))
    c = 1 - (1 - c) * (1 - S(P["c_spec"]) * sp[:, None])
    fres = torch.clamp(1 - n[:, 3], 0, 1) ** torch.exp(P["fres_p"])
    c = c + (S(P["c_rim"]) - c) * (S(P["rim_k"]) * fres)[:, None]
    a = 1 - S(P["trans_k"]) * fres
    return Bg * (1 - a[:, None]) + c * a[:, None]


opt = torch.optim.Adam(P.values(), lr=0.02)
sched = torch.optim.lr_scheduler.StepLR(opt, 2000, 0.3)
for i in range(6000):
    opt.zero_grad()
    L = (((shade(P, N, B) - T) ** 2).mean(1) * Wt).sum() / Wt.sum()
    L.backward()
    opt.step()
    sched.step()
    if i % 1000 == 0:
        print(i, round(L.item(), 6))
with torch.no_grad():
    rmse = math.sqrt(((shade(P, N, B) - T) ** 2).mean().item()) * 255
print("final rmse (0-255):", round(rmse, 2))


def hexc(t):
    return "#%02x%02x%02x" % tuple((torch.sigmoid(t).detach().numpy() * 255).round().astype(int))


S = torch.sigmoid
with torch.no_grad():
    out = {
        "colorLight": hexc(P["c_light"]), "colorDeep": hexc(P["c_deep"]), "colorViolet": hexc(P["c_violet"]),
        "colorGlow": hexc(P["c_glow"]), "colorSpec": hexc(P["c_spec"]), "colorRim": hexc(P["c_rim"]),
        "dirDeep": unit(P["a_deep"]).tolist(), "deepThreshold": P["deep_t"].item(),
        "deepWidth": torch.exp(P["deep_w"]).item(), "deepAmount": S(P["deep_k"]).item(),
        "violetCenter": P["vio_c"].tolist(), "violetSize": torch.exp(P["vio_s"]).item(), "violetAmount": S(P["vio_k"]).item(),
        "glowCenter": P["glow_c"].tolist(), "glowSize": torch.exp(P["glow_s"]).item(), "glowIntensity": S(P["glow_k"]).item(),
        "haloSize": torch.exp(P["halo_s"]).item(), "haloIntensity": S(P["halo_k"]).item(),
        "specCenter": P["spec_c"].tolist(), "specSize": torch.exp(P["spec_s"]).tolist(),
        "specRotation": P["spec_rot"].item(), "specIntensity": S(P["spec_k"]).item(),
        "glowShape": torch.exp(P["glow_shape"]).item(), "specShape": torch.exp(P["spec_shape"]).item(),
        "fresnelPower": torch.exp(P["fres_p"]).item(), "rimAmount": S(P["rim_k"]).item(),
        "rimTransparency": S(P["trans_k"]).item(), "rmse255": rmse,
    }
    (ROOT / "build").mkdir(exist_ok=True)
    json.dump(out, open(ROOT / "build/core_fit.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in out.items() if k.startswith("color")}))
    Nall = torch.tensor(NV)
    img = shade(P, Nall, torch.tensor(bg.reshape(-1, 3))).numpy().reshape(1024, 1024, 3)
    img = np.where(hit[..., None], img, bg)
    refc = np.where(valid[..., None], core, bg)
    strip = np.concatenate([refc, img, np.clip(np.abs(img - refc) * 4, 0, 1)], 1)
    Image.fromarray((strip * 255).astype(np.uint8)).resize((1536, 512)).save(ROOT / "qa/core_fit_compare.png")
