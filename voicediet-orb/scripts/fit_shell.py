"""Подгонка деформации точечной оболочки под альфу референса (PyTorch, CPU).

1) Перебор: тысячи случайных полей смещения (спектр как у шума) ->
   оценка по силуэту (IoU) и по плотности точек (корреляция).
2) Доводка лучших градиентом: многомасштабное сравнение плотности +
   силуэт + априорная гладкость поля.
Дифференцируемый рендер: проекция -> скрытие ядром -> билинейный сплат ->
гауссово размытие -> покрытие 1-exp(-плотность).
Результат: build/shell_fit.json, build/fit_preview.png
Запуск: py scripts/fit_shell.py [--trials 3000] [--top 4] [--iters 1500]
"""
import argparse, json, math, time
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

import shell_model as SM

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)

ap = argparse.ArgumentParser()
ap.add_argument("--trials", type=int, default=3000)
ap.add_argument("--top", type=int, default=4)
ap.add_argument("--iters", type=int, default=1500)
ap.add_argument("--seed", type=int, default=0)
ap.add_argument("--h_iters", type=int, default=2500)
ap.add_argument("--h_smooth", type=float, default=0.02)
ap.add_argument("--init", type=str, default="", help="доводка от готового shell_fit.json (без перебора)")
ap.add_argument("--sil_w", type=float, default=0.05)
args = ap.parse_args()
H_SMOOTH = args.h_smooth

ref = np.asarray(Image.open(ROOT / "reference/ref_shell_a.png").convert("L"), np.float32) / 255.0
ref_t = torch.from_numpy(ref)[None, None]
DOT_AREA = 154.0                      # px^2 кадра на точку в центре (замер detect_dots)
yy, xx = np.mgrid[:1024, :1024]
DOT_INTEGRAL = float(ref[np.hypot(xx - 512, yy - 512) < 120].mean() * DOT_AREA)
print("dot integral px^2:", round(DOT_INTEGRAL, 2))

dirs_np, faces_np = SM.base_dirs()
# рёбра геодезической сетки -> матрица усреднения соседей (для лапласиана высоты)
E = np.concatenate([faces_np[:, [0, 1]], faces_np[:, [1, 2]], faces_np[:, [2, 0]]])
E = np.unique(np.sort(E, 1), axis=0)
NV = len(dirs_np)
deg = np.bincount(E.ravel(), minlength=NV).astype(np.float32)
ei = torch.tensor(np.concatenate([E[:, 0], E[:, 1]]))
ej = torch.tensor(np.concatenate([E[:, 1], E[:, 0]]))
deg_t = torch.tensor(deg)


def laplacian(h):
    nb = torch.zeros_like(h).index_add(0, ei, h[ej])
    return h - nb / deg_t
W_np, phi_np, mag_np = SM.features()
dirs = torch.tensor(dirs_np, dtype=torch.float32)
mag = torch.tensor(mag_np, dtype=torch.float32)
basis = torch.sin(dirs @ torch.tensor(W_np, dtype=torch.float32).T + torch.tensor(phi_np, dtype=torch.float32))
# касательные (векторные) смещения - только низкие частоты; высокие - только вдоль нормали,
# иначе решётка точек мелко перекашивается (в референсе ряды текут плавно)
LO = (mag <= SM.TANGENT_W_MAX).float()[:, None]

ROT0 = SM.default_rotation()


def gauss_kernel(sigma):
    r = max(1, int(math.ceil(sigma * 3)))
    x = torch.arange(-r, r + 1, dtype=torch.float32)
    k = torch.exp(-0.5 * (x / sigma) ** 2)
    return k / k.sum()


def blur(img, sigma):
    k = gauss_kernel(sigma)
    r = (len(k) - 1) // 2
    img = F.conv2d(F.pad(img, (r, r, 0, 0), mode="replicate"), k.view(1, 1, 1, -1))
    return F.conv2d(F.pad(img, (0, 0, r, r), mode="replicate"), k.view(1, 1, -1, 1))


def axis_angle_matrix(r):
    th = torch.sqrt((r * r).sum() + 1e-12)
    k = r / th
    z = torch.zeros(())
    Kx = torch.stack([torch.stack([z, -k[2], k[1]]), torch.stack([k[2], z, -k[0]]), torch.stack([-k[1], k[0], z])])
    return torch.eye(3) + torch.sin(th) * Kx + (1 - torch.cos(th)) * Kx @ Kx


def core_visibility(P, tau=0.01):
    cam = torch.tensor([0.0, 0.0, SM.CAM_DIST])
    v = P - cam
    L = torch.sqrt((v * v).sum(1) + 1e-12)
    d = v / L[:, None]
    tc = (-cam * d).sum(1)
    perp2 = (cam * cam).sum() - tc ** 2
    perp = torch.sqrt(torch.clamp(perp2, min=1e-12))
    t_enter = tc - torch.sqrt(torch.clamp(SM.CORE_R ** 2 - perp2, min=1e-8))
    return 1 - torch.sigmoid((SM.CORE_R - perp) / tau) * torch.sigmoid((L - t_enter) / tau)


def render(A, radius, rot, res, h=None):
    radial = (basis @ (A * (1 - LO))).mean(1, keepdim=True) * 3 ** 0.5
    X = dirs * (radius + radial + (0 if h is None else h[:, None])) + basis @ (A * LO)
    P = X @ axis_angle_matrix(rot).T
    z = SM.CAM_DIST - P[:, 2]
    s = res / 1024.0
    x = (512 + SM.FOCAL * P[:, 0] / z) * s - 0.5
    y = (512 - SM.FOCAL * P[:, 1] / z) * s - 0.5
    # площадь точки как в рендере: σ = 1.9 px на передней поверхности (дистанция D-1.3), дальше - мельче
    w_dot = core_visibility(P) * DOT_INTEGRAL * s * s * ((SM.CAM_DIST - 1.3) / z) ** 2
    x0, y0 = torch.floor(x).detach(), torch.floor(y).detach()
    fx, fy = x - x0, y - y0
    img = torch.zeros(res * res)
    for dx, dy, w in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi, yi = (x0 + dx).long(), (y0 + dy).long()
        ok = (xi >= 0) & (xi < res) & (yi >= 0) & (yi < res)
        img = img.index_add(0, (yi * res + xi)[ok], (w * w_dot)[ok])
    return img.view(1, 1, res, res), X


REF = {}
for res in (64, 128, 256, 512):
    r = F.adaptive_avg_pool2d(ref_t, res)
    REF[res] = r
    REF[(res, "fill")] = (blur(r, 2.0 * res / 128) > 0.035).float()
REF_FILL_SOFT = {res: blur(REF[(res, "fill")], 1.0) for res in (64, 128, 256, 512)}


def fill_of(dens, res):
    return 1 - torch.exp(-30 * blur(dens, 2.0 * res / 128))


def metrics(A, radius, rot, res=128):
    dens, _ = render(A, radius, rot, res)
    fm = (fill_of(dens, res) > 0.5).float()
    rf = REF[(res, "fill")]
    iou = float((fm * rf).sum() / torch.clamp(((fm + rf) > 0).float().sum(), min=1))
    a = (1 - torch.exp(-blur(dens, 1.5))).flatten()
    b = blur(REF[res], 1.5).flatten()
    corr = float(torch.corrcoef(torch.stack([a, b]))[0, 1])
    return iou, corr


def loss_fn(A, radius, rot, res, sigma, sigma_prior, h=None):
    dens, X = render(A, radius, rot, res, h)
    cov = 1 - torch.exp(-blur(dens, sigma))
    data = ((cov - blur(REF[res], sigma)) ** 2).mean()
    sil = ((blur(fill_of(dens, res), 1.0) - REF_FILL_SOFT[res]) ** 2).mean()
    prior = ((A / sigma_prior[:, None]) ** 2).mean()
    r = torch.sqrt((X * X).sum(1))
    inner = (F.relu(1.04 * SM.CORE_R - r) ** 2).mean()
    outer = (F.relu(r - SM.SHELL_R_MAX) ** 2).mean()      # без шипов вдоль луча зрения
    L = data + args.sil_w * sil + 2e-4 * prior + 2.0 * inner + 10.0 * outer
    if h is not None:
        L = L + H_SMOOTH * (laplacian(h) ** 2).mean() + 1e-2 * (h ** 2).mean()
    return L, data, sil


rot0 = torch.tensor(ROT0, dtype=torch.float32)
if args.init:
    args.trials, args.top = 0, 0
# ---------- 1. перебор ----------
g = torch.Generator().manual_seed(args.seed)
cands = []
t0 = time.time()
with torch.no_grad():
    for t in range(args.trials):
        beta = float(torch.empty(1).uniform_(1.0, 2.2, generator=g))
        amp0 = float(torch.empty(1).uniform_(0.04, 0.16, generator=g))
        radius = float(torch.empty(1).uniform_(1.10, 1.30, generator=g))
        sig = amp0 * (mag / SM.W_MIN) ** (-beta)
        sig = sig / torch.sqrt((sig ** 2).sum()) * amp0 * 3.0       # СКО смещения ~ amp0 по каждой оси
        A = torch.randn(SM.K_FEAT, 3, generator=g) * sig[:, None]
        iou, corr = metrics(A, torch.tensor(radius), rot0, 128)
        score = iou + 0.5 * corr
        cands.append((score, iou, corr, A, radius, beta, amp0))
        if t % 500 == 0:
            best = max(cands, key=lambda c: c[0])
            print(f"trial {t}: best score={best[0]:.4f} iou={best[1]:.4f} corr={best[2]:.4f} beta={best[5]:.2f} amp={best[6]:.3f} r={best[4]:.3f} ({time.time() - t0:.0f}s)", flush=True)
cands.sort(key=lambda c: -c[0])

# ---------- 2. доводка ----------
SCHEDULE = [(64, 2.5, 0.2), (128, 2.0, 0.3), (128, 1.2, 0.25), (256, 1.5, 0.25)]
results = []
for i, (score, iou, corr, A0, radius0, beta, amp0) in enumerate(cands[: args.top]):
    sig_prior = amp0 * (mag / SM.W_MIN) ** (-beta)
    sig_prior = sig_prior / torch.sqrt((sig_prior ** 2).sum()) * amp0 * 3.0
    A = A0.clone().requires_grad_()
    radius = torch.tensor(radius0, requires_grad=True)
    rot = rot0.clone().requires_grad_()
    opt = torch.optim.Adam([{"params": [A], "lr": 2e-3}, {"params": [radius], "lr": 2e-3}, {"params": [rot], "lr": 3e-3}])
    for res, sigma, frac in SCHEDULE:
        for _ in range(int(args.iters * frac)):
            opt.zero_grad()
            L, d, s = loss_fn(A, radius, rot, res, sigma, sig_prior)
            L.backward()
            opt.step()
    with torch.no_grad():
        iou2, corr2 = metrics(A, radius, rot, 256)
        _, d_eval, _ = loss_fn(A, radius, rot, 256, 1.5, sig_prior)
    print(f"cand {i}: before iou={iou:.4f} corr={corr:.4f} -> after iou={iou2:.4f} corr={corr2:.4f} mse={d_eval.item():.5f}", flush=True)
    results.append((iou2 + 0.5 * corr2, A.detach(), radius.detach(), rot.detach(), iou2, corr2, beta, amp0))

if args.init:
    f0 = json.load(open(args.init))
    best = (0, torch.tensor(f0["amp"], dtype=torch.float32), torch.tensor(f0["radius"]), torch.tensor(f0["rot"], dtype=torch.float32),
            0, 0, f0["beta"], f0["amp0"])
    H0 = torch.tensor(f0["height"], dtype=torch.float32)
    H_SCHED = [(256, 1.4, 0.3), (512, 2.0, 0.35), (512, 1.5, 0.35)]
else:
    best = max(results, key=lambda r: r[0])
    H0 = None
    H_SCHED = [(128, 2.0, 0.25), (256, 2.0, 0.25), (256, 1.4, 0.25), (256, 1.0, 0.25)]
_, A, radius, rot, iou, corr, beta, amp0 = best

# ---------- 3. повершинная высота вдоль нормали (складки) ----------
sig_prior = amp0 * (mag / SM.W_MIN) ** (-beta)
sig_prior = sig_prior / torch.sqrt((sig_prior ** 2).sum()) * amp0 * 3.0
A = A.clone().requires_grad_()
radius = radius.clone().requires_grad_()
rot = rot.clone().requires_grad_()
h = (H0.clone() if H0 is not None else torch.zeros(NV)).requires_grad_()
opt = torch.optim.Adam([{"params": [h], "lr": 1.5e-3}, {"params": [A], "lr": 1e-3},
                        {"params": [radius, rot], "lr": 1e-3}])
for res, sigma, frac in H_SCHED:
    for _ in range(int(args.h_iters * frac)):
        opt.zero_grad()
        L, d, s_ = loss_fn(A, radius, rot, res, sigma, sig_prior, h)
        L.backward()
        opt.step()
    print(f"h-stage res={res} sigma={sigma}: data={d.item():.5f} sil={s_.item():.5f} |h|max={h.abs().max().item():.3f}", flush=True)
with torch.no_grad():
    A, radius, rot, h = A.detach(), radius.detach(), rot.detach(), h.detach()
    dens, _ = render(A, radius, rot, 256, h)
    iou, corr = metrics(A, radius, rot, 256)  # (без h - для справки)
    a_ = (1 - torch.exp(-blur(dens, 1.5))).flatten(); b_ = blur(REF[256], 1.5).flatten()
    corr = float(torch.corrcoef(torch.stack([a_, b_]))[0, 1])
    fm = (fill_of(dens, 256) > 0.5).float(); rf = REF[(256, "fill")]
    iou = float((fm * rf).sum() / ((fm + rf) > 0).float().sum())
print("after h: iou", iou, "corr", corr)
fit = {"score": best[0], "iou_256": iou, "corr_256": corr, "beta": beta, "amp0": amp0,
       "radius": float(radius), "rot": rot.tolist(), "amp": A.tolist(), "height": h.tolist(),
       "ico_levels": SM.ICO_LEVELS, "tangent_w_max": SM.TANGENT_W_MAX, "fov_deg": SM.FOV_DEG, "cam_dist": SM.CAM_DIST,
       "core_r": SM.CORE_R, "dot_integral_px2": DOT_INTEGRAL, "feat_seed": SM.FEAT_SEED, "k_feat": SM.K_FEAT}
json.dump(fit, open(BUILD / "shell_fit.json", "w"))
with torch.no_grad():
    dens, _ = render(A, radius, rot, 1024, h)
    cov = 1 - torch.exp(-blur(dens, 1.0))
prev = (cov[0, 0].numpy().clip(0, 1) * 255).astype(np.uint8)
Image.fromarray(np.concatenate([(ref * 255).astype(np.uint8), prev], 1)).resize((1400, 700)).save(BUILD / "fit_preview.png")
print("best: iou", iou, "corr", corr)
