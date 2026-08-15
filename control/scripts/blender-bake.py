"""blender-bake.py — the local Blender worker's one verb (interchange.plan.md, I5 hero-object leg).

Run headless by blender-bake.mjs:  Blender -b -P blender-bake.py -- <config.json>

Config-driven so this file stays a dumb, deterministic executor; the driver
resolves presets → light rig and passes everything in. The loop it serves:
mojulo export_model (.glb, baked-flat palette) → THIS (Cycles diffuse GI baked
into vertex colours) → bind_mesh_render (the baked .glb is a bound derived
artifact). No pixels leave as the artifact — the geometry's own COLOR_0 now
CONTAINS the lighting, which is exactly what mojulo's unlit runtime renders.

Config keys:
  src_glb, out_glb           (required) paths
  preview_png                (optional) flat vertex-colour still of the result
  hero_node                  (optional) isolate this wrapper subtree; null = whole scene
  clip                       (optional) animation name to pose from before baking
  frame                      (int) frame to pose at (default 10)
  drop                       (list) mesh-name substrings to remove entirely (e.g. stowed weapons)
  no_cast                    (list) mesh-name substrings that RECEIVE but don't CAST
                             (armor that digs occlusion wells — the bicep fix)
  plinth                     (bool) add a dense shadow-catching floor grid under the feet
  recenter                   (bool) move bbox centre to origin, feet to z=0
  samples                    (int) Cycles samples (default 160)
  light                      { ambient:{color,strength}, key:{...}, fill:{...}, rim:{...} }
                             each lamp: { energy, color:[r,g,b], size, dir:[dx,dy,dz] } (dir = offset from centre, ×span)
"""
import bpy, sys, json, mathutils

cfg = json.load(open(sys.argv[sys.argv.index("--") + 1:][0]))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=cfg["src_glb"])
objs = bpy.data.objects

# --- pose (before any deletion, so the animation still resolves) ---
clip = cfg.get("clip")
if clip:
    for o in objs:
        if o.animation_data:
            for t in o.animation_data.nla_tracks:
                t.mute = t.name != clip
    bpy.context.scene.frame_set(int(cfg.get("frame", 10)))
    bpy.context.view_layer.update()

# --- isolate the hero subtree (+ ancestors) if asked ---
hero_name = cfg.get("hero_node")
if hero_name and hero_name in objs:
    hero = objs[hero_name]
    keep = {hero.name} | {c.name for c in hero.children_recursive}
    p = hero.parent
    while p is not None:
        keep.add(p.name); p = p.parent
    for o in list(bpy.data.objects):
        if o.name not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
else:
    hero = next((o for o in objs if o.parent is None and o.children), objs[0])

# --- drop unwanted parts (stowed weapon forms, etc.) ---
for c in list(hero.children_recursive):
    if any(s in c.name for s in cfg.get("drop", [])):
        bpy.data.objects.remove(c, do_unlink=True)

# --- freeze the posed transforms into plain matrices (evaluated, parents first) ---
dg0 = bpy.context.evaluated_depsgraph_get()
frozen = {o: o.evaluated_get(dg0).matrix_world.copy() for o in bpy.data.objects}
for o in bpy.data.objects:
    if o.animation_data:
        o.animation_data_clear()
def _depth(o):
    d = 0
    while o.parent is not None:
        o = o.parent; d += 1
    return d
for o in sorted(frozen, key=_depth):
    o.matrix_world = frozen[o]
    bpy.context.view_layer.update()

meshes = [c for c in hero.children_recursive if c.type == "MESH"]

def _bounds(ms):
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys, zs = [], [], []
    for m in ms:
        for corner in m.evaluated_get(dg).bound_box:
            w = m.matrix_world @ mathutils.Vector(corner)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    cx, cy, cz = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2
    span = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    return cx, cy, cz, span, min(zs)

cx, cy, cz, span, minz = _bounds(meshes)

# --- re-centre so placement coords are sane (bbox centre → origin, feet → z=0) ---
if cfg.get("recenter", True):
    root = hero
    while root.parent is not None:
        root = root.parent
    root.matrix_world = mathutils.Matrix.Translation((-cx, -cy, -minz)) @ root.matrix_world
    bpy.context.view_layer.update()
    cx, cy, cz, span, minz = _bounds(meshes)

# --- shadow plinth: a DENSE grid so vertex-baked shadows have vertices to live in ---
if cfg.get("plinth", True):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=56, y_subdivisions=56, size=span*1.8, location=(cx, cy, minz + 0.01))
    plinth = bpy.context.active_object
    plinth.name = "plinth"
    attr = plinth.data.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    for d in attr.data:
        d.color = (0.09, 0.10, 0.13, 1.0)
    meshes.append(plinth)

# --- albedo-from-vertex-colour material on every mesh ---
mat = bpy.data.materials.new("bake-src")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Color"  # read the ORIGINAL albedo by name, never the bake target
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.5
bsdf.inputs["Metallic"].default_value = 0.1
for m in meshes:
    m.data.materials.clear()
    m.data.materials.append(mat)

# NOTE on the mirror-normal problem (see export-normals.plan.md): mojulo now AUTHORS outward
# normals in its geometry layer and exports them BOTH as the GLB NORMAL attribute AND as
# consistent triangle WINDING (facesToGlb / faceListToMesh). So a diffuse bake keys off a
# correct, mirror-symmetric outward direction and no longer shades mirror-built parts' unlit
# BACK to black. No normal handling here ON PURPOSE — but now because the export is already
# correct, not because the fix was deferred. (History: earlier Blender-side guesses — a per-face
# centroid flip and a Backfacing-driven shader normal — each fixed only complementary halves,
# proving the geometry had no consistent "outward" to key off. The fix had to live in the export,
# and does: exporting the NORMAL alone was insufficient — a Cycles diffuse bake still reads the
# geometric WINDING normal, so mirror-built parts needed their winding made consistent too.)

for m in meshes:
    if any(s in m.name for s in cfg.get("no_cast", [])):
        m.visible_shadow = False

# --- light rig (driver-resolved) ---
light = cfg["light"]
def add_area(name, spec):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = spec["energy"]; d.color = spec["color"]; d.size = spec.get("size", span)
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    dx, dy, dz = spec["dir"]
    o.location = (cx + span*dx, cy + span*dy, cz + span*dz)
    look = mathutils.Vector((cx, cy, cz)) - o.location
    o.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
for key in ("key", "fill", "rim"):
    if key in light:
        add_area(key, light[key])
world = bpy.data.worlds.new("bake-world")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
amb = light.get("ambient", {"color": [0.22, 0.24, 0.28], "strength": 1.0})
bg.inputs["Color"].default_value = (*amb["color"], 1.0)
bg.inputs["Strength"].default_value = amb["strength"]

# --- Cycles diffuse bake (colour × direct × indirect) → vertex colours ---
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
    print("MOJ_GPU_FALLBACK", e)
sc.cycles.samples = int(cfg.get("samples", 160))
sc.cycles.bake_type = "DIFFUSE"
sc.render.bake.use_pass_direct = True
sc.render.bake.use_pass_indirect = True
sc.render.bake.use_pass_color = True
sc.render.bake.target = "VERTEX_COLORS"

for m in meshes:
    src_name = m.data.color_attributes[0].name
    m.data.color_attributes.new("Baked", "FLOAT_COLOR", "CORNER")
    m.data.color_attributes.active_color = m.data.color_attributes["Baked"]
    bpy.ops.object.select_all(action="DESELECT")
    m.select_set(True)
    bpy.context.view_layer.objects.active = m
    bpy.ops.object.bake(type="DIFFUSE")
    m.data.color_attributes.remove(m.data.color_attributes[src_name])
    m.data.color_attributes["Baked"].name = "Color"
    m.data.color_attributes.active_color = m.data.color_attributes["Color"]
print("MOJ_BAKE_DONE")

# --- optional interior cull: delete faces that baked to (near) pure black ---
# A fully SEALED interior face (inside overlapping solid parts) receives no light path — not even
# ambient, which needs line-of-sight to the world — so it bakes to ~0. A face visible from ANY
# angle catches some GI, so it is never pure black. That means a STRICT threshold removes only
# never-visible geometry: the silhouette is untouched from every viewpoint (no holes as the camera
# orbits), while ~65% of a suit's triangles — invisible interior seams — drop out. Off by default;
# `cull_black` is a LINEAR threshold (a face is culled only if EVERY loop's max channel < it).
cull_thresh = float(cfg.get("cull_black", 0) or 0)
if cull_thresh > 0:
    import bmesh
    total_before = 0
    total_culled = 0
    for m in meshes:
        me = m.data
        col = me.attributes.get("Color")
        if col is None:
            continue
        total_before += len(me.polygons)
        doomed = []
        for poly in me.polygons:
            sealed = True
            for li in poly.loop_indices:
                c = col.data[li].color
                if max(c[0], c[1], c[2]) >= cull_thresh:
                    sealed = False
                    break
            if sealed:
                doomed.append(poly.index)
        if not doomed:
            continue
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in doomed], context="FACES")
        bm.to_mesh(me)
        bm.free()
        total_culled += len(doomed)
    print("MOJ_CULL_DONE culled=%d of=%d thresh=%g" % (total_culled, total_before, cull_thresh))

# --- optional decimate: fewer triangles for a lighter, faster display statue ---
# Runs AFTER the bake + interior cull so the GI is computed at full detail, then Collapse-decimates
# the visible shell to `decimate` × its faces. Blender interpolates the baked CORNER colour onto the
# survivors, so the shading rides along; too low a ratio facets curved surfaces (the eyes gate).
decimate = float(cfg.get("decimate", 0) or 0)
protect_top = float(cfg.get("protect_top", 0) or 0)
if 0 < decimate < 1:
    # Region protection: spare the top `protect_top` fraction of the figure (head + chest — the
    # detail-dense, camera-facing part) from the collapse. Build a "protect" vertex group weighted
    # 1.0 above the height cutoff, 0.0 below; the Collapse modifier decimates weight-0 verts fully
    # and leaves weight-1 verts untouched (invert_vertex_group so the group is the SPARED set).
    z_cut = None
    if 0 < protect_top < 1:
        zmin = 1e9
        zmax = -1e9
        for m in meshes:
            for v in m.data.vertices:
                wz = (m.matrix_world @ v.co).z
                if wz < zmin: zmin = wz
                if wz > zmax: zmax = wz
        z_cut = zmin + (1.0 - protect_top) * (zmax - zmin)
    before = 0
    after = 0
    for m in meshes:
        before += len(m.data.polygons)
        bpy.ops.object.select_all(action="DESELECT")
        m.select_set(True)
        bpy.context.view_layer.objects.active = m
        mod = m.modifiers.new("dec", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = decimate
        if z_cut is not None:
            vg = m.vertex_groups.new(name="protect")
            for v in m.data.vertices:
                wz = (m.matrix_world @ v.co).z
                vg.add([v.index], 1.0 if wz >= z_cut else 0.0, "REPLACE")
            mod.vertex_group = vg.name
            mod.vertex_group_factor = 1.0
            mod.invert_vertex_group = True   # spare the weighted (top) region, decimate the rest
        bpy.ops.object.modifier_apply(modifier=mod.name)
        after += len(m.data.polygons)
    print("MOJ_DECIMATE_DONE before=%d after=%d ratio=%g protect_top=%g" % (before, after, decimate, protect_top))

# --- export the baked geometry ---
bpy.ops.object.select_all(action="DESELECT")
for m in meshes:
    m.select_set(True)
hero.select_set(True)
for c in hero.children_recursive:
    c.select_set(True)
bpy.ops.export_scene.gltf(filepath=cfg["out_glb"], export_format="GLB",
                          use_selection=True, export_animations=False)
print("MOJ_EXPORT_DONE")

# --- optional preview: FLAT vertex-colour still = what mojulo will show ---
if cfg.get("preview_png"):
    em = bpy.data.materials.new("preview-unlit")
    em.use_nodes = True
    et = em.node_tree
    et.nodes.remove(et.nodes["Principled BSDF"])
    emit = et.nodes.new("ShaderNodeEmission")
    a2 = et.nodes.new("ShaderNodeVertexColor"); a2.layer_name = "Color"
    et.links.new(a2.outputs["Color"], emit.inputs["Color"])
    et.links.new(emit.outputs["Emission"], et.nodes["Material Output"].inputs["Surface"])
    for m in meshes:
        m.data.materials.clear(); m.data.materials.append(em)
    sc.cycles.samples = 16
    cam_data = bpy.data.cameras.new("prev")
    cam = bpy.data.objects.new("prev", cam_data)
    sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (cx + span*1.3, cy + span*1.7, cz + span*0.35)
    look = mathutils.Vector((cx, cy, cz)) - cam.location
    cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 1100, 1300
    sc.render.filepath = cfg["preview_png"]
    bpy.ops.render.render(write_still=True)
    print("MOJ_PREVIEW_DONE")
