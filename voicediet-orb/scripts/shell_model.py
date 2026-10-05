"""Модель точечной оболочки VoiceDiet (общая для подгонки и экспорта).

Оболочка = вершины икосферы с ICO_LEVELS уровнями деления (5 -> 10 242 точки,
как Ico Sphere в Blender/C4D). Так устроена решётка референса: гекс-сетка с
пятиугольными дефектами в 12 вершинах икосаэдра, плотность ~154 px^2 на
точку в центре кадра совпадает с 10 242 точками. Точки смещены гладким
векторным полем D(u) = sum_k a_k * sin(w_k . u + phi_k) - это гауссово
случайное поле со спектром как у шума Перлина (w_k, phi_k фиксированы сидом,
a_k подобраны под референс). Затем поворот объекта.
Единицы: радиус ядра = 1.0. Камера в (0,0,CAM_DIST), смотрит на центр по -Z.
"""
import math
import numpy as np

ICO_LEVELS = 5
CORE_R = 1.0
FOV_DEG = 30.0
FRAME = 1024
CORE_PX = 362.0  # радиус ядра в кадре референса (px из 1024)
FOCAL = (FRAME / 2) / math.tan(math.radians(FOV_DEG / 2))
CAM_DIST = CORE_R / math.sin(math.atan(CORE_PX / FOCAL))
K_FEAT = 400
FEAT_SEED = 11
W_MIN, W_MAX = 1.5, 14.0
SHELL_R_MAX = 1.42    # мягкая граница радиуса оболочки (силуэт референса ~1.3)
TANGENT_W_MAX = 4.5   # выше этой частоты поле действует только вдоль нормали


def features(seed=FEAT_SEED, k=K_FEAT):
    """Частоты w_k (случайное направление, модуль W_MIN..W_MAX лог-равномерно) и фазы."""
    rng = np.random.default_rng(seed)
    v = rng.normal(size=(k, 3))
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    mag = np.exp(rng.uniform(np.log(W_MIN), np.log(W_MAX), size=k))
    return v * mag[:, None], rng.uniform(0, 2 * math.pi, size=k), mag


def rot_from_axis_angle(r):
    r = np.asarray(r, float)
    th = np.linalg.norm(r)
    if th < 1e-12:
        return np.eye(3)
    k = r / th
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K


def base_dirs(levels=ICO_LEVELS):
    from geodesic import icosphere
    return icosphere(levels)


def matrix_to_axis_angle(R):
    th = math.acos(max(-1.0, min(1.0, (np.trace(R) - 1) / 2)))
    if th < 1e-9:
        return np.zeros(3)
    v = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]) / (2 * math.sin(th))
    return v * th


def default_rotation():
    """Две соседние вершины икосаэдра -> видимые пятиугольные дефекты
    референса (кадр ~(445,210) и ~(533,770), радиус проекции ~520 px)."""
    from geodesic import icosahedron
    V, _ = icosahedron()
    def view_dir(px, py, r=520.0):
        x, y = (px - 512) / r, (512 - py) / r
        return np.array([x, y, math.sqrt(max(0.0, 1 - x * x - y * y))])
    a, b = view_dir(445, 210), view_dir(533, 770)
    def frame(p, q):
        e1 = p / np.linalg.norm(p)
        e2 = q - e1 * (e1 @ q); e2 /= np.linalg.norm(e2)
        return np.stack([e1, e2, np.cross(e1, e2)], 1)
    R = frame(a, b) @ frame(V[0], V[1]).T
    return matrix_to_axis_angle(R)


def shell_points_object(fit):
    """Точки в объектной системе (до поворота) - это и есть сетка модели."""
    d, _ = base_dirs(fit["ico_levels"])
    W, phi, _ = features(fit["feat_seed"], fit["k_feat"])
    A = np.asarray(fit["amp"])
    h = np.asarray(fit.get("height", np.zeros(len(d))))
    B = np.sin(d @ W.T + phi)
    lo = (np.linalg.norm(W, axis=1) <= fit.get("tangent_w_max", TANGENT_W_MAX)).astype(float)[:, None]
    radial = (B @ (A * (1 - lo))).mean(1) * 3 ** 0.5
    return d * (fit["radius"] + radial + h)[:, None] + B @ (A * lo)


def object_rotation(fit):
    return rot_from_axis_angle(fit["rot"])
