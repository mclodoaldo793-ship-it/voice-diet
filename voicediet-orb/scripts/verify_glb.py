"""Проверка GLB: импорт в чистый Blender, сверка с исходной .blend и данными подгонки.
Запуск: blender -b --factory-startup --python scripts/verify_glb.py"""
import json, sys
from pathlib import Path
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import shell_model as SM  # noqa: E402

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / "export/voicediet_orb.glb"))
rep = {"objects": {}}
for o in bpy.data.objects:
    e = {"type": o.type, "parent": o.parent.name if o.parent else None}
    if o.type == "MESH":
        me = o.data
        e.update(verts=len(me.vertices), faces=len(me.polygons), edges=len(me.edges),
                 materials=[m.name for m in me.materials], attributes=[a.name for a in me.attributes])
    if o.type == "CAMERA":
        e.update(fov_deg=round(np.degrees(o.data.angle_y), 3), location=[round(v, 4) for v in o.location])
    rep["objects"][o.name] = e
fit = json.load(open(ROOT / "build/shell_fit.json"))
P = SM.shell_points_object(fit) @ SM.object_rotation(fit).T          # model space, вид референса
sh = bpy.data.objects["VD_Shell"]
W = np.array([list(sh.matrix_world @ v.co) for v in sh.data.vertices])
W = W @ np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float).T            # blender -> model (Y up)
rep["shell_max_abs_err"] = float(np.abs(W - P).max())                   # тот же порядок вершин
core = bpy.data.objects["VD_Core"]
rep["core_radius"] = float(np.linalg.norm([list(v.co) for v in core.data.vertices], axis=1).mean())
m = bpy.data.materials.get("VD_Core_GLTF")
if m:
    b = m.node_tree.nodes.get("Principled BSDF")
    rep["core_gltf_material"] = {k: [round(x, 3) for x in b.inputs[k].default_value][:3] if hasattr(b.inputs[k].default_value, "__len__") else round(b.inputs[k].default_value, 3)
                                 for k in ("Base Color", "Emission Color", "Emission Strength", "Roughness", "Coat Weight")}
print("VERIFY " + json.dumps(rep, ensure_ascii=False))
json.dump(rep, open(ROOT / "qa/glb_verify.json", "w"), indent=1, ensure_ascii=False)
