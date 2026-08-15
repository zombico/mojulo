"""studio-render.py — photoreal studio product render of an exported mojulo model.

Headless:  blender -b -P studio-render.py -- <config.json>

NOT a GI bake (that is blender-bake.py). This produces premium STILL images:
imports the .glb geometry, DROPS mojulo's baked vertex-colour look and the study
grid, assigns a real PBR material, builds an infinity-cove sweep + softbox rig,
and path-traces several hero angles with Cycles.

config keys:
  src_glb    (req) path to the exported .glb
  out_dir    (req) directory for the PNGs
  samples    (int) Cycles samples (default 200)
  res        [w,h] pixels (default [1600,1200])
  material   {base:[r,g,b], metallic, roughness}  (the whole object)
  cams       [ {name, az, el, dist, fov} ...]  azimuth/elevation in degrees
  drop_grid  (bool) remove the flat study-grid mesh (default true)
"""
import bpy, sys, json, math, mathutils
from mathutils import Vector

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1:][0]))
samples = int(cfg.get("samples", 200))
res = cfg.get("res", [1600, 1200])
mat_cfg = cfg.get("material", {})

# ---------------------------------------------------------------- import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=cfg["src_glb"])

meshes = [o for o in bpy.data.objects if o.type == "MESH"]

def bounds(objs):
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx

# ---- drop the flat study grid (planar, thin-in-z) so only the subject remains
if cfg.get("drop_grid", True):
    for o in list(meshes):
        mn, mx = bounds([o])
        if (mx.z - mn.z) < 0.6:            # a flat plane = the measurement grid
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]

# ---- recenter subject: x,y centroid to origin, rest on z=0
mn, mx = bounds(meshes)
ctr = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
for o in meshes:
    o.location -= ctr
bpy.context.view_layer.update()
mn, mx = bounds(meshes)
subj_h = mx.z - mn.z
subj_r = max(mx.x - mn.x, mx.y - mn.y) / 2
target = Vector((0, 0, subj_h * 0.5))

# ---------------------------------------------------------------- material
def principled(name, base, metallic, roughness):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    return m

def _color_attr(m):
    try:
        return m.color_attributes.active_color or (m.color_attributes[0]
               if len(m.color_attributes) else None)
    except Exception:
        return None

def _poly_lum(ca, poly):
    if ca is None:
        return 1.0
    idx = poly.vertices if ca.domain == 'POINT' else poly.loop_indices
    vals = []
    for i in idx:
        c = ca.data[i].color
        vals.append(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
    return sum(vals) / len(vals) if vals else 1.0

mode = mat_cfg.get("mode", "uniform")
if mode == "byluma":
    # Segment the merged mesh into connected islands (one per monomer) and classify
    # EACH ISLAND by its MEAN vertex-colour luminance. Averaging over the whole part
    # cancels mojulo's baked directional shading (bright top + dark front ≈ the tint),
    # so a steel body classifies as steel even though its front face is dark. Clean
    # flat materials are then assigned — no double-lighting.
    steel = principled("steel", mat_cfg.get("base", [0.80, 0.82, 0.85]),
                       1.0, mat_cfg.get("roughness", 0.28))
    dark = principled("dark", mat_cfg.get("dark", [0.015, 0.016, 0.02]),
                      mat_cfg.get("dark_metallic", 0.0), mat_cfg.get("dark_rough", 0.42))
    thr = mat_cfg.get("thresh", 0.12)
    for o in meshes:
        m = o.data
        ca = _color_attr(m)
        np = len(m.polygons)
        # weld by POSITION — the glTF export splits vertices per-face, so index-
        # sharing finds no adjacency. Group faces that share a coincident coordinate.
        def _key(co):
            return (round(co.x, 2), round(co.y, 2), round(co.z, 2))
        pos_faces = {}
        for pi, poly in enumerate(m.polygons):
            for v in poly.vertices:
                pos_faces.setdefault(_key(m.vertices[v].co), []).append(pi)
        label = [-1] * np
        cur = 0
        for start in range(np):
            if label[start] != -1:
                continue
            stack = [start]; label[start] = cur
            while stack:
                f = stack.pop()
                for v in m.polygons[f].vertices:
                    for nf in pos_faces[_key(m.vertices[v].co)]:
                        if label[nf] == -1:
                            label[nf] = cur; stack.append(nf)
            cur += 1
        sums = [0.0] * cur; cnts = [0] * cur
        for pi, poly in enumerate(m.polygons):
            sums[label[pi]] += _poly_lum(ca, poly); cnts[label[pi]] += 1
        mean = [sums[i] / cnts[i] if cnts[i] else 1.0 for i in range(cur)]
        m.materials.clear(); m.materials.append(steel); m.materials.append(dark)
        for pi, poly in enumerate(m.polygons):
            poly.material_index = 1 if mean[label[pi]] < thr else 0
            poly.use_smooth = True
        print("byluma islands:", cur, "dark:", sum(1 for x in mean if x < thr))
else:
    steel = principled("steel",
                       mat_cfg.get("base", [0.82, 0.84, 0.86]),
                       mat_cfg.get("metallic", 1.0),
                       mat_cfg.get("roughness", 0.25))
    for o in meshes:
        o.data.materials.clear()
        o.data.materials.append(steel)
        for p in o.data.polygons:
            p.use_smooth = True

# ---------------------------------------------------------------- cyclorama sweep
# profile in (Y depth, Z height): floor -> quarter fillet -> vertical wall
R = max(220.0, subj_r * 6)
Yc = subj_r * 2.2            # where the floor starts curving (behind subject)
prof = [(-R * 3, 0.0)]
prof += [(-R * 0.5, 0.0), (0.0, 0.0), (Yc, 0.0)]                 # floor
for k in range(1, 13):                                           # fillet
    th = (math.pi / 2) * (k / 12)
    prof.append((Yc + R * math.sin(th), R - R * math.cos(th)))
prof.append((Yc + R, R * 2.4))                                   # up the wall
W = max(R * 3, subj_r * 8)
verts, faces = [], []
for i, (y, z) in enumerate(prof):
    verts.append((-W, y, z)); verts.append((W, y, z))
    if i > 0:
        a = 2 * (i - 1); faces.append((a, a + 1, a + 3, a + 2))
mesh = bpy.data.meshes.new("cove"); mesh.from_pydata(verts, [], faces)
mesh.update()
cove = bpy.data.objects.new("cove", mesh)
bpy.context.collection.objects.link(cove)
for p in cove.data.polygons:
    p.use_smooth = True
sweep_mat = principled("sweep", [0.55, 0.56, 0.58], 0.0, 0.5)
cove.data.materials.append(sweep_mat)

# ---------------------------------------------------------------- lights (softboxes)
def area(name, loc, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size
    ld.color = color
    ob = bpy.data.objects.new(name, ld); ob.location = loc
    bpy.context.collection.objects.link(ob)
    d = (target - Vector(loc)).normalized()
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob

span = max(subj_h, subj_r * 2)
area("key",  (-span * 2.2, -span * 2.4, span * 3.0), 90000, span * 2.2, (1.0, 0.98, 0.95))
area("fill", ( span * 2.8, -span * 1.6, span * 1.6), 32000, span * 2.8, (0.96, 0.98, 1.0))
area("rim",  ( span * 0.6,  span * 3.0, span * 3.2), 70000, span * 2.0, (0.95, 0.97, 1.0))
area("top",  (0, 0, span * 4.5), 30000, span * 2.6)

# soft ambient world
world = bpy.data.worlds.new("w"); bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.19, 0.20, 0.22, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.55

# ---------------------------------------------------------------- render settings
sc = bpy.context.scene
sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = "GPU"
except Exception as e:
    print("GPU setup failed, CPU:", e)
sc.cycles.samples = samples
sc.cycles.use_denoising = True
try:
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = int(res[0]), int(res[1])
sc.render.film_transparent = False
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"

# ---------------------------------------------------------------- camera + shoot
tgt = bpy.data.objects.new("tgt", None); tgt.location = target
bpy.context.collection.objects.link(tgt)
cam_d = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_d)
bpy.context.collection.objects.link(cam)
sc.camera = cam
con = cam.constraints.new("TRACK_TO"); con.target = tgt
con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'

default_cams = [
    {"name": "hero_34l", "az": -35, "el": 12, "dist": 3.2, "fov": 38},
    {"name": "front",    "az": 0,   "el": 6,  "dist": 3.4, "fov": 36},
    {"name": "hero_34r", "az": 35,  "el": 14, "dist": 3.2, "fov": 38},
    {"name": "side",     "az": 90,  "el": 8,  "dist": 3.3, "fov": 36},
    {"name": "high_34",  "az": -28, "el": 30, "dist": 3.0, "fov": 40},
]
cams = cfg.get("cams", default_cams)
base = max(subj_h, subj_r * 2)
for c in cams:
    az = math.radians(c["az"]); el = math.radians(c["el"])
    dist = c.get("dist", 3.2) * base
    cam.location = target + Vector((
        dist * math.cos(el) * math.sin(az),
        -dist * math.cos(el) * math.cos(az),
        dist * math.sin(el)))
    cam_d.lens = 36 / (2 * math.tan(math.radians(c.get("fov", 38)) / 2)) * 1.0
    cam_d.sensor_width = 36
    bpy.context.view_layer.update()
    sc.render.filepath = f'{cfg["out_dir"]}/{c["name"]}.png'
    print("RENDER", c["name"])
    bpy.ops.render.render(write_still=True)
print("DONE")
