"""bake-map-gi.py — the Blender worker for the map-GI bicycle (bake-map-gi.mjs).

Run headless:  Blender -b -P bake-map-gi.py -- <config.json>

Config-driven so this stays a dumb, deterministic executor; the driver resolves the
per-map light preset and passes everything in. The loop it serves:

  facesToGlb(raw-albedo, authored outNormal)  →  THIS (Cycles diffuse GI → COLOR_0)
    →  driver recolours the map's own faces from the baked vertex colours

No pixels leave as the artifact — the geometry's COLOR_0 now CONTAINS the light,
which is exactly what mojulo's unlit runtime draws (zero runtime cost).

Config keys:
  src_glb, out_glb        (required) paths
  preview_png             (optional) flat vertex-colour still of the result
  roof_cut                (float|null) remove faces in the top fraction of Z before
                          baking (open an enclosed roof to daylight); null = keep all
  samples                 (int) Cycles samples (default 128)
  ambient                 { color:[r,g,b], strength }  — the sky/fill
  sun                     { energy, color:[r,g,b], euler:[x,y,z] } | null
  points                  [ { energy, color:[r,g,b], at:[x,y,z], size } ]  — interior fixtures
"""
import bpy, sys, json, mathutils, bmesh

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1:][0]))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=cfg["src_glb"])

ms = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for m in ms:
    m.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
me = obj.data
print("MOJ_TRIS", len(me.polygons))

bb = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
zmin, zmax = min(zs), max(zs)
cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
spanx, spany, spanz = max(xs) - min(xs), max(ys) - min(ys), zmax - zmin
span = max(spanx, spany, spanz)

# --- open the roof to daylight if asked (an enclosed ceiling starves interior GI) ---
rc = cfg.get("roof_cut")
if rc:
    bm = bmesh.new(); bm.from_mesh(me); zc = zmax - spanz * rc
    for f in list(bm.faces):
        if sum((obj.matrix_world @ v.co).z for v in f.verts) / len(f.verts) > zc:
            bm.faces.remove(f)
    bm.to_mesh(me); bm.free()
    print("MOJ_ROOF_CUT", rc)

if not len(me.color_attributes):
    me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
if me.color_attributes[0].name != "Color":
    me.color_attributes[0].name = "Color"

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.render.resolution_x, sc.render.resolution_y = 1280, 900
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = "GPU"
except Exception as e:
    print("MOJ_GPU_FALLBACK", e)

# --- light rig from the preset ---
amb = cfg.get("ambient", {"color": [0.6, 0.66, 0.78], "strength": 1.6})
w = bpy.data.worlds.new("sky"); w.use_nodes = True
bg = w.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (*amb["color"], 1.0)
bg.inputs["Strength"].default_value = amb["strength"]
sc.world = w
sun = cfg.get("sun")
if sun:
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = sun["energy"]; d.color = sun.get("color", [1, 1, 1]); d.angle = 0.1
    o = bpy.data.objects.new("sun", d); sc.collection.objects.link(o)
    o.rotation_euler = mathutils.Euler(sun.get("euler", [0.4, 0.25, 0.4]))
for i, pt in enumerate(cfg.get("points", []) or []):
    d = bpy.data.lights.new(f"pt{i}", "AREA")
    d.energy = pt["energy"]; d.color = pt.get("color", [1, 1, 1]); d.size = pt.get("size", span * 0.05)
    o = bpy.data.objects.new(f"pt{i}", d); sc.collection.objects.link(o)
    o.location = pt["at"]
# optional SOFT area studio lights (prelit hero bakes) — big soft sources give clean, low-variance
# DIRECT light, so smooth curved surfaces (helmet dome, calves) bake without Monte-Carlo "cow spots"
# the way a hard sun + strong world ambient do. Scale-free: `dir` = offset from centre ×span, `size`
# ×span (big = soft), `irr` sets on-subject brightness (energy = irr × dist², the inverse-square comp),
# aimed at the subject centre. Additive — a config without `areas` (every map) is byte-identical.
czc = (zmin + zmax) / 2
for i, ar in enumerate(cfg.get("areas", []) or []):
    d = bpy.data.lights.new(f"area{i}", "AREA")
    d.color = ar.get("color", [1, 1, 1]); d.size = span * ar.get("size", 0.8)
    dx, dy, dz = ar["dir"]
    dist = span * ((dx * dx + dy * dy + dz * dz) ** 0.5) or 1.0
    d.energy = ar.get("irr", 1.0) * dist * dist
    o = bpy.data.objects.new(f"area{i}", d); sc.collection.objects.link(o)
    o.location = (cx + span * dx, cy + span * dy, czc + span * dz)
    look = mathutils.Vector((cx, cy, czc)) - o.location
    o.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()

# --- Principled from vertex COLOR, bake DIFFUSE GI into COLOR_0 ---
mat = bpy.data.materials.new("bake-src"); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes["Principled BSDF"]
vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Color"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.7
bsdf.inputs["Metallic"].default_value = 0.0
me.materials.clear(); me.materials.append(mat)
me.color_attributes.new("Baked", "FLOAT_COLOR", "CORNER")
me.color_attributes.active_color = me.color_attributes["Baked"]
sc.cycles.samples = int(cfg.get("samples", 128))
sc.cycles.bake_type = "DIFFUSE"
sc.render.bake.use_pass_direct = True
sc.render.bake.use_pass_indirect = True
sc.render.bake.use_pass_color = True
sc.render.bake.target = "VERTEX_COLORS"
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True); bpy.context.view_layer.objects.active = obj
bpy.ops.object.bake(type="DIFFUSE")
me.color_attributes.remove(me.color_attributes["Color"])
me.color_attributes["Baked"].name = "Color"
print("MOJ_BAKE_DONE")

# --- export the baked geometry (COLOR_0 carries the light) ---
bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=cfg["out_glb"], export_format="GLB",
                          use_selection=True, export_animations=False)
print("MOJ_EXPORT_DONE")

# --- optional eyes-gate still: FLAT vertex colour = what mojulo will show ---
if cfg.get("preview_png"):
    em = bpy.data.materials.new("flat"); em.use_nodes = True
    et = em.node_tree; et.nodes.remove(et.nodes["Principled BSDF"])
    emit = et.nodes.new("ShaderNodeEmission")
    a2 = et.nodes.new("ShaderNodeVertexColor"); a2.layer_name = "Color"
    et.links.new(a2.outputs["Color"], emit.inputs["Color"])
    et.links.new(emit.outputs["Emission"], et.nodes["Material Output"].inputs["Surface"])
    me.materials.clear(); me.materials.append(em)
    sc.cycles.samples = 24
    sc.world = bpy.data.worlds.new("bg2"); sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.06, 1)
    cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("c", cam)
    sc.collection.objects.link(co); sc.camera = co
    co.location = (cx + spanx * 0.28, cy - spany * 0.92, zmax + spanz * 3.4)
    look = mathutils.Vector((cx, cy, zmin + spanz * 0.2)) - co.location
    co.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    cam.lens = 26
    sc.render.filepath = cfg["preview_png"]
    bpy.ops.render.render(write_still=True)
    print("MOJ_PREVIEW_DONE")
