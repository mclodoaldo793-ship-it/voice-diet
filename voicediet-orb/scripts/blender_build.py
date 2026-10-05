"""Сборка сцены VoiceDiet Orb в Blender 4.5 + экспорт GLB + рендер ракурса референса.

Запуск (из папки voicediet-orb):
  ../tools/blender-4.5.14-windows-x64/blender.exe -b --factory-startup \
      --python scripts/blender_build.py -- [--no-render] [--samples 64]

Данные: build/shell_fit.json (оболочка), build/core_fit.json (шейдер ядра).
Выход:  blender/voicediet_orb.blend, export/voicediet_orb.glb,
        renders/blender_ref_view.png (1024x1024, прозрачный фон)

Система координат модели (как в Three.js): Y вверх, камера на +Z.
В Blender: (x, y, z)_model -> (x, -z, y). glTF-экспорт возвращает Y-up.
"""
import json, math, sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import shell_model as SM  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DO_RENDER = "--no-render" not in argv
SAMPLES = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 64

shell_fit = json.load(open(ROOT / "build/shell_fit.json"))
core_fit = json.load(open(ROOT / "build/core_fit.json"))

M2B = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)   # model -> blender


def to_b(v):
    return np.asarray(v, float) @ M2B.T


def hex_srgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def srgb_to_lin(c):
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


# ---------------------------------------------------------------- сцена
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "VoiceDiet_Orb"
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = SM.FRAME
scene.render.film_transparent = True
scene.render.filter_size = 1.2
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.display_settings.display_device = "sRGB"
world = bpy.data.worlds.new("VD_World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb_to_lin([0.73, 0.78, 0.99]), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.0   # освещение не нужно: всё на эмиссии
scene.world = world

col = bpy.data.collections.new("VoiceDiet_Orb")
scene.collection.children.link(col)

root = bpy.data.objects.new("VD_Orb", None)
root.empty_display_type = "SPHERE"
col.objects.link(root)

# ---------------------------------------------------------------- камера
cam_data = bpy.data.cameras.new("VD_Camera")
cam_data.lens_unit = "FOV"
cam_data.sensor_fit = "VERTICAL"
cam_data.angle = math.radians(SM.FOV_DEG)
cam_data.clip_start = 0.1
cam_data.clip_end = 100
cam = bpy.data.objects.new("VD_Camera", cam_data)
cam.location = Vector(to_b([0, 0, SM.CAM_DIST]))
cam.rotation_euler = (math.radians(90), 0, 0)               # смотрит в +Y Blender = -Z модели
col.objects.link(cam)
scene.camera = cam

# ---------------------------------------------------------------- ядро
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=SM.CORE_R)
core = bpy.context.active_object
core.name = core.data.name = "VD_Core"
for p in core.data.polygons:
    p.use_smooth = True
for c in core.users_collection:
    c.objects.unlink(core)
col.objects.link(core)
core.parent = root


def build_core_material(cf):
    """Шейдер ядра из core_fit.json: цвет - функция нормали в пространстве камеры."""
    mat = bpy.data.materials.new("VD_Core_Mat")
    mat.use_nodes = True
    mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else None
    nt = mat.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    x = [0]

    def node(t, **kw):
        n = N.new(t)
        n.location = (x[0], 0)
        x[0] += 40
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    def math_(op, a, b=None, c=None):
        n = node("ShaderNodeMath", operation=op)
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]

    def vmix(a, b, fac):  # mix(a,b,fac) для цветов (RGB-векторы)
        n = node("ShaderNodeMix", data_type="RGBA", blend_type="MIX", clamp_factor=True)
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, (list, tuple)):
                sock.default_value = (*v, 1)
            else:
                L.new(v, sock)
        L.new(fac, n.inputs[0]) if not isinstance(fac, (int, float)) else setattr(n.inputs[0], "default_value", fac)
        return n.outputs[2]

    def screen(a, color, k):  # 1-(1-a)(1-color*k)
        n = node("ShaderNodeMix", data_type="RGBA", blend_type="SCREEN", clamp_factor=True)
        L.new(k, n.inputs[0])
        L.new(a, n.inputs[6])
        n.inputs[7].default_value = (*color, 1)
        return n.outputs[2]

    geo = node("ShaderNodeNewGeometry")
    vt = node("ShaderNodeVectorTransform", vector_type="NORMAL", convert_from="WORLD", convert_to="CAMERA")
    L.new(geo.outputs["Normal"], vt.inputs[0])
    sep = node("ShaderNodeSeparateXYZ")
    L.new(vt.outputs[0], sep.inputs[0])
    # пространство камеры Cycles: +Z направлен от зрителя -> как в Three.js нужен -Z
    nx, ny = sep.outputs[0], sep.outputs[1]
    nz = math_("MULTIPLY", sep.outputs[2], -1.0)

    def gauss(cx, cy, s, k=1.0):  # exp(-0.5*(((nx-cx)^2+(ny-cy)^2)/s^2)^k)
        dx = math_("SUBTRACT", nx, cx)
        dy = math_("SUBTRACT", ny, cy)
        r2 = math_("ADD", math_("MULTIPLY", dx, dx), math_("MULTIPLY", dy, dy))
        q = math_("ADD", math_("MULTIPLY", r2, 1.0 / (s * s)), 1e-9)
        if k != 1.0:
            q = math_("POWER", q, k)
        return math_("EXPONENT", math_("MULTIPLY", q, -0.5))

    # deep: sigmoid((dot(n,d)-t)/w)
    d = cf["dirDeep"]
    dot = math_("ADD", math_("ADD", math_("MULTIPLY", nx, d[0]), math_("MULTIPLY", ny, d[1])), math_("MULTIPLY", nz, d[2]))
    z = math_("MULTIPLY", math_("SUBTRACT", dot, cf["deepThreshold"]), -1.0 / cf["deepWidth"])
    sig = math_("DIVIDE", 1.0, math_("ADD", 1.0, math_("EXPONENT", z)))
    c = vmix(hex_srgb(cf["colorLight"]), hex_srgb(cf["colorDeep"]), math_("MULTIPLY", sig, cf["deepAmount"]))
    kv = math_("MULTIPLY", gauss(*cf["violetCenter"], cf["violetSize"]), cf["violetAmount"])
    c = vmix(c, hex_srgb(cf["colorViolet"]), kv)
    gx, gy = cf["glowCenter"]
    g = math_("ADD", math_("MULTIPLY", gauss(gx, gy, cf["glowSize"], cf.get("glowShape", 1.0)), cf["glowIntensity"]),
              math_("MULTIPLY", gauss(gx, gy, cf["haloSize"]), cf["haloIntensity"]))
    c = screen(c, hex_srgb(cf["colorGlow"]), math_("MINIMUM", g, 1.0))
    # анизотропный блик
    cr, sr = math.cos(cf["specRotation"]), math.sin(cf["specRotation"])
    su, sv = cf["specSize"]
    u = math_("SUBTRACT", nx, cf["specCenter"][0])
    v = math_("SUBTRACT", ny, cf["specCenter"][1])
    uu = math_("DIVIDE", math_("ADD", math_("MULTIPLY", u, cr), math_("MULTIPLY", v, sr)), su)
    vv = math_("DIVIDE", math_("SUBTRACT", math_("MULTIPLY", v, cr), math_("MULTIPLY", u, sr)), sv)
    q = math_("ADD", math_("ADD", math_("MULTIPLY", uu, uu), math_("MULTIPLY", vv, vv)), 1e-9)
    q = math_("POWER", q, cf.get("specShape", 1.0))
    sp = math_("MULTIPLY", math_("EXPONENT", math_("MULTIPLY", q, -0.5)), cf["specIntensity"])
    c = screen(c, hex_srgb(cf["colorSpec"]), sp)
    # френель-край: 1 - dot(N, к камере) = Layer Weight Facing при Blend 0.5
    lw = node("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    fres = math_("POWER", math_("MAXIMUM", lw.outputs["Facing"], 0.0), cf["fresnelPower"])
    c = vmix(c, hex_srgb(cf["colorRim"]), math_("MULTIPLY", fres, cf["rimAmount"]))
    # формула в sRGB -> линейный для эмиссии (view transform Standard вернёт sRGB)
    gam = node("ShaderNodeGamma")
    L.new(c, gam.inputs[0])
    gam.inputs[1].default_value = 2.2
    em = node("ShaderNodeEmission")
    L.new(gam.outputs[0], em.inputs[0])
    tr = node("ShaderNodeBsdfTransparent")
    mix = node("ShaderNodeMixShader")
    alpha = math_("SUBTRACT", 1.0, math_("MULTIPLY", fres, cf["rimTransparency"]))
    L.new(alpha, mix.inputs[0])
    L.new(tr.outputs[0], mix.inputs[1])
    L.new(em.outputs[0], mix.inputs[2])
    out = node("ShaderNodeOutputMaterial")
    L.new(mix.outputs[0], out.inputs[0])
    for k, val in cf.items():
        if isinstance(val, (int, float, str)):
            mat[k] = val
    return mat


core_mat = build_core_material(core_fit)
core.data.materials.append(core_mat)

# упрощённый PBR для glTF (ноды с математикой нормали в glTF не переносятся)
core_gltf = bpy.data.materials.new("VD_Core_GLTF")
core_gltf.use_nodes = True
bsdf = core_gltf.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (*srgb_to_lin(hex_srgb(core_fit["colorLight"])), 1)
bsdf.inputs["Emission Color"].default_value = (*srgb_to_lin(hex_srgb(core_fit["colorDeep"])), 1)
bsdf.inputs["Emission Strength"].default_value = 0.25
bsdf.inputs["Roughness"].default_value = 0.25
bsdf.inputs["Coat Weight"].default_value = 1.0
core_gltf.use_fake_user = True

# ---------------------------------------------------------------- оболочка
dirs, faces = SM.base_dirs(shell_fit["ico_levels"])
P_obj = SM.shell_points_object(shell_fit)
R_obj = SM.object_rotation(shell_fit)

me = bpy.data.meshes.new("VD_Shell")
me.from_pydata(to_b(P_obj).tolist(), [], faces.tolist())
me.update()
rest = me.attributes.new("rest_dir", "FLOAT_VECTOR", "POINT")     # направление недеформированной сферы
rest.data.foreach_set("vector", to_b(dirs).astype(np.float32).ravel())
shell = bpy.data.objects.new("VD_Shell", me)
col.objects.link(shell)
shell.parent = root
Rb = M2B @ R_obj @ M2B.T
shell.rotation_mode = "QUATERNION"
shell.rotation_quaternion = Matrix(Rb.tolist()).to_quaternion()
for k in ("ico_levels", "radius", "feat_seed", "k_feat", "iou_256", "corr_256"):
    if k in shell_fit:
        shell[k] = shell_fit[k]

dot_mat = bpy.data.materials.new("VD_Dot_Mat")
dot_mat.use_nodes = True
nt = dot_mat.node_tree
nt.nodes.clear()
em = nt.nodes.new("ShaderNodeEmission")
em.inputs[0].default_value = (1, 1, 1, 1)
em.inputs[1].default_value = 1.0
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs[0])
me.materials.append(dot_mat)

# Geometry Nodes: вершины -> точки (сферы в Cycles).
# твёрдый диск = уровень 0.5 гауссовой точки (σ 1.9 px -> r 2.2 px) на передней поверхности
# оболочки (ближе центра на ~1.3)
DOT_RADIUS = 2.2 * (SM.CAM_DIST - 1.3) / SM.FOCAL
gn = bpy.data.node_groups.new("VD_ShellDots", "GeometryNodeTree")
gn.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
rs = gn.interface.new_socket("Dot Radius", in_out="INPUT", socket_type="NodeSocketFloat")
rs.default_value = DOT_RADIUS
rs.min_value = 0.0
gn.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
gi = gn.nodes.new("NodeGroupInput")
go = gn.nodes.new("NodeGroupOutput")
m2p = gn.nodes.new("GeometryNodeMeshToPoints")
m2p.mode = "VERTICES"
sm = gn.nodes.new("GeometryNodeSetMaterial")
sm.inputs["Material"].default_value = dot_mat
gn.links.new(gi.outputs[0], m2p.inputs["Mesh"])
gn.links.new(gi.outputs[1], m2p.inputs["Radius"])
gn.links.new(m2p.outputs[0], sm.inputs["Geometry"])
gn.links.new(sm.outputs[0], go.inputs[0])
mod = shell.modifiers.new("VD_ShellDots", "NODES")
mod.node_group = gn

# ---------------------------------------------------------------- сохранить .blend
(ROOT / "blender").mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender/voicediet_orb.blend"), compress=True)

# ---------------------------------------------------------------- экспорт GLB
# В GLB: VD_Core (сфера + PBR), VD_Shell (POINTS: только вершины, атрибут _REST_DIR),
# VD_Camera (ракурс референса). Шейдер ядра и вид точек повторяет viewer.
core.data.materials[0] = core_gltf
pts_me = bpy.data.meshes.new("VD_Shell_Points")
pts_me.from_pydata(to_b(P_obj).tolist(), [], [])
pa = pts_me.attributes.new("_REST_DIR", "FLOAT_VECTOR", "POINT")
pa.data.foreach_set("vector", to_b(dirs).astype(np.float32).ravel())
pts_me.materials.append(dot_mat)
shell.data = pts_me
shell.modifiers.remove(mod)
(ROOT / "export").mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "export/voicediet_orb.glb"), export_format="GLB",
    use_mesh_vertices=True, use_mesh_edges=False, export_attributes=True,
    export_cameras=True, export_lights=False, export_apply=False, export_yup=True,
    export_extras=True, export_materials="EXPORT")
print("GLB exported")

# ---------------------------------------------------------------- рендер (из сохранённого .blend)
if DO_RENDER:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "blender/voicediet_orb.blend"))
    sc = bpy.context.scene
    (ROOT / "renders").mkdir(exist_ok=True)
    sc.render.filepath = str(ROOT / "renders/blender_ref_view.png")
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    print("render done")
