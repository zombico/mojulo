# audit-figure-mesh.py — the Blender half of the figure mesh machine gate.
#
#   blender -b -P scripts/audit-figure-mesh.py -- <objDir> <outJson>
#
# Reads the OBJ set written by audit-figure-mesh.mjs (one file per build, one
# object per render part) and reports, per part: boundary edges (1 face),
# non-manifold edges (>2 faces), degenerate (near-zero-area) faces, loose verts.
#
# The two numbers that matter:
#   degenerate_faces — REAL defects. Collapsed quads the strip mesher emits where a
#                      ring pinches to a point. Burn-down target is 0.
#   boundary_edges   — RAW open edges, exactly as the renderer's strips are wound. Two
#                      of these are pure bookkeeping of the ring-stack currency and say
#                      nothing about holes: every ring polyline REPEATS its first point,
#                      so each strip has an open seam column, and a cap fan terminates in
#                      a ring of COINCIDENT points, so a closed cap still shows a rim.
#   open_edges       — the honest one: boundary edges after welding coincident vertices
#                      (remove_doubles). The seam column and cap apex fuse away, so what
#                      is left is real, unclosed surface — the distance to STL closure.
#                      WATCHED, not gated: render-only geometry is open by construction
#                      (painter's sort + backface cull hide it). Advise, never refuse.
#
# Optional, operator-hosted: no Blender ⇒ no audit, and nothing else depends on it.
import bpy, bmesh, json, sys, glob, os

argv = sys.argv[sys.argv.index("--") + 1:]
obj_dir, out_json = argv[0], argv[1]
EPS_AREA = 1e-9

report = []
for path in sorted(glob.glob(os.path.join(obj_dir, "*.obj"))):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=path)
    animal = {"label": os.path.splitext(os.path.basename(path))[0], "parts": []}
    for obj in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.edges.ensure_lookup_table()
        boundary = sum(1 for e in bm.edges if len(e.link_faces) == 1)
        nonmanifold = sum(1 for e in bm.edges if len(e.link_faces) > 2)
        degenerate = sum(1 for f in bm.faces if f.calc_area() < EPS_AREA)
        loose = sum(1 for v in bm.verts if not v.link_edges)
        nverts, nfaces = len(bm.verts), len(bm.faces)   # as-drawn counts, before the weld
        # weld coincident verts, then re-count — the seam column and the cap apex fuse
        # away and what remains is a REAL open edge (see the header).
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
        bm.edges.ensure_lookup_table()
        open_edges = sum(1 for e in bm.edges if len(e.link_faces) == 1)
        animal["parts"].append({
            "part": obj.name, "verts": nverts, "faces": nfaces,
            "boundary_edges": boundary, "open_edges": open_edges,
            "nonmanifold_edges": nonmanifold, "degenerate_faces": degenerate,
            "loose_verts": loose,
        })
        bm.free()
    animal["totals"] = {
        k: sum(p[k] for p in animal["parts"])
        for k in ("boundary_edges", "open_edges", "nonmanifold_edges", "degenerate_faces", "loose_verts")
    }
    report.append(animal)

with open(out_json, "w") as f:
    json.dump(report, f, indent=1)
print(f"audited {len(report)} builds -> {out_json}")
