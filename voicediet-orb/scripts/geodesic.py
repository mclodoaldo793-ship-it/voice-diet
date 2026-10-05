"""Геодезическая сфера частоты f (каждая грань икосаэдра -> f^2 треугольников).
Вершин: 10 f^2 + 2. Возвращает (dirs[N,3], faces[M,3])."""
import numpy as np

def icosahedron():
    t = (1 + 5 ** 0.5) / 2
    v = np.array([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                  [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], float)
    f = np.array([[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
                  [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
                  [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]])
    return v / np.linalg.norm(v, axis=1, keepdims=True), f

def geodesic(freq):
    V, Fc = icosahedron()
    key = {}
    verts = []
    faces = []
    def vid(p):
        k = tuple(np.round(p / np.linalg.norm(p), 9))
        if k not in key:
            key[k] = len(verts); verts.append(k)
        return key[k]
    for a, b, c in Fc:
        A, B, C = V[a], V[b], V[c]
        idx = {}
        for i in range(freq + 1):
            for j in range(freq + 1 - i):
                p = A + (B - A) * (i / freq) + (C - A) * (j / freq)
                idx[(i, j)] = vid(p)
        for i in range(freq):
            for j in range(freq - i):
                faces.append((idx[(i, j)], idx[(i + 1, j)], idx[(i, j + 1)]))
                if i + j + 1 < freq:
                    faces.append((idx[(i + 1, j)], idx[(i + 1, j + 1)], idx[(i, j + 1)]))
    return np.array(verts, float), np.array(faces)

if __name__ == "__main__":
    v, f = geodesic(35)
    print(len(v), 10 * 35 ** 2 + 2, len(f))


def icosphere(levels):
    """Икосфера рекурсивным делением (как Ico Sphere в Blender): каждое ребро
    делится пополам, новая вершина проецируется на сферу. 10*4^L + 2 вершин."""
    V, F = icosahedron()
    verts = [tuple(v) for v in V]
    faces = [tuple(f) for f in F]
    for _ in range(levels):
        cache = {}
        def mid(a, b):
            k = (a, b) if a < b else (b, a)
            if k not in cache:
                p = (np.array(verts[a]) + np.array(verts[b])) / 2
                verts.append(tuple(p / np.linalg.norm(p)))
                cache[k] = len(verts) - 1
            return cache[k]
        nf = []
        for a, b, c in faces:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    return np.array(verts, float), np.array(faces)
