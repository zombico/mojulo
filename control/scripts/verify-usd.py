"""
verify-usd.py — the Blender half of the USD machine gate (interchange-seams.plan.md
seam 2, run by scripts/verify-usd.mjs). Headless `blender -b --python verify-usd.py
-- <file> <out.json>`: imports a .usdz / .usda / .usdc (or a .glb, so the same gate
covers the quantized + humanoid exports) into an empty scene and reports what
Blender actually built — mesh + triangle counts, the world-space bounding box in
Blender units (metres for USD, via metersPerUnit), vertex-colour coverage,
materials with image textures, armature bone names, actions. The driver compares
these to what mojulo declared it wrote. Prints nothing else on stdout; the result
is the JSON file.
"""
import bpy
import json
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 2:
    raise SystemExit('usage: blender -b --python verify-usd.py -- <file> <out.json>')
src, out = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = src.lower().rsplit('.', 1)[-1]
if ext in ('usdz', 'usda', 'usdc', 'usd'):
    bpy.ops.wm.usd_import(filepath=src)
elif ext in ('glb', 'gltf'):
    bpy.ops.import_scene.gltf(filepath=src)
else:
    raise SystemExit(f'unsupported extension: {ext}')

# The glTF importer parks its own helpers — the armature's custom bone-shape Icosphere
# (80 faces) — in a `glTF_not_exported` collection. They are Blender's, not the file's:
# skipped before every tally and named in the report (interchange-next.plan.md N1).
IMPORTER_ONLY = 'glTF_not_exported'
def importer_only(o):
    return any(c.name == IMPORTER_ONLY for c in o.users_collection)
all_objs = list(bpy.data.objects)
objs = [o for o in all_objs if not importer_only(o)]
meshes = [o for o in objs if o.type == 'MESH']
tris = 0
xs, ys, zs = [], [], []
for o in meshes:
    tris += sum(max(0, len(p.vertices) - 2) for p in o.data.polygons)
    for v in o.bound_box:
        w = o.matrix_world @ Vector(v)
        xs.append(w.x); ys.append(w.y); zs.append(w.z)
size = [max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)] if xs else None
arms = [o for o in objs if o.type == 'ARMATURE']
bones = sorted(b.name for a in arms for b in a.data.bones)
textured = []
for m in bpy.data.materials:
    if m.use_nodes and any(n.type == 'TEX_IMAGE' and n.image for n in m.node_tree.nodes):
        textured.append(m.name)
report = {
    'file': src,
    'blender': bpy.app.version_string,
    'objects': len(objs),
    'meshes': len(meshes),
    'triangles': tris,
    'size': [round(v, 4) for v in size] if size else None,
    'vertex_colour_meshes': sum(1 for o in meshes if o.data.color_attributes),
    'textured_materials': textured,
    'armatures': len(arms),
    'bones': bones,
    'actions': len(bpy.data.actions),
    'cameras': sum(1 for o in objs if o.type == 'CAMERA'),
    'empties': sum(1 for o in objs if o.type == 'EMPTY'),
    'importer_only': [o.name for o in all_objs if importer_only(o)],
}
with open(out, 'w') as f:
    json.dump(report, f, indent=2)
