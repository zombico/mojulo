/**
 * blender-project.js — the Blender DESTINATION leg's pure-text emitters
 * (export-blender.plan.md rev 3, B0): the two pack-carried Blender scripts, the
 * T-numbered ARTPASS-GUIDE.md (operator-guide.js, the D10 lift) and the README.
 *
 * The pack realizes a mojulo artifact inside a fresh .blend for a HAND surfacing pass
 * (materials, texture paint, sculpt detail); the pass comes home through
 * `bind_mesh_render` as a bound derived variant — never a recipe edit. The worker legs
 * (blender-bake.mjs, bake-world-gi.mjs) are a different seam on the same binary and are
 * untouched by this file.
 *
 * Transports (D8/D9): the scripts read MOJULO_MODE / MOJULO_PACK (argv fallback) so one
 * file runs headless, from Blender's Text editor, or over the OPERATOR's blender-mcp
 * (`execute_blender_code`). Nothing mojulo ships lives inside Blender's process; there is
 * no add-on, no socket, no listener.
 *
 * Pure text: deterministic, no clock, no dice, no host paths. blender-pack.js assembles
 * the binaries (model.glb, pack.json, recipe/) around these files.
 */
import { fmt, ledgerLines, greyboxSection, guideLedger, guidePreamble, numberedFacts } from './operator-guide.js';

export const BLENDER_LEG_VERSION = '0.1.0';
export const BLENDER_TARGET = 'Blender 4.x+ (5.2 LTS verified)';

/* ---------------------------------------------------------------- scripts --- */

// Shared by both scripts: locate the pack folder (env → __file__ → the Text editor's file).
const PY_PACK_DIR = `def pack_dir():
    p = os.environ.get('MOJULO_PACK')
    if p:
        return os.path.abspath(p)
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        pass
    try:
        t = bpy.context.space_data.text
        if t and t.filepath:
            return os.path.dirname(bpy.path.abspath(t.filepath))
    except Exception:
        pass
    raise SystemExit('cannot locate the pack folder - set MOJULO_PACK=<folder>')
`;

/** import_mojulo.py — modes run / verify; constant text (everything per-pack rides pack.json). */
export function importerPy() {
  return `"""
import_mojulo.py - realize a mojulo Blender pack inside Blender (export-blender.plan.md rev 3).

Two modes, one script, three transports:
  MOJULO_MODE=run     fresh scene -> import model.glb -> one collection per part -> viewport
                      shading -> unit display scale -> framing camera -> save <ref>.blend beside
                      the pack (refuses to overwrite an existing .blend unless MOJULO_FORCE=1)
  MOJULO_MODE=verify  open the saved .blend (or import fresh) and report what Blender built
                      -> mojulo-gate.json (the machine gate reads it; advisory)

  headless:    blender -b --python import_mojulo.py -- --mode run|verify [--blend p] [--gate p] [--force]
  in Blender:  Scripting > Text > Open this file > Run Script      (MOJULO_MODE env; default run)
  blender-mcp: execute_blender_code("import os; os.environ['MOJULO_MODE']='run'; os.environ['MOJULO_PACK']=r'<pack>'; exec(open(r'<pack>/import_mojulo.py').read())")

No geometry logic lives here: model.glb is the authority, pack.json says which node goes in which
collection, and nothing flows Blender -> recipe.
"""
import bpy
import json
import os
import sys
from mathutils import Vector


def _argv():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []


def _opt(name, default=None):
    a = _argv()
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


MODE = _opt('--mode') or os.environ.get('MOJULO_MODE', 'run')
FORCE = ('--force' in _argv()) or os.environ.get('MOJULO_FORCE') == '1'
LENGTH_UNIT = {'mm': 'MILLIMETERS', 'cm': 'CENTIMETERS', 'm': 'METERS', 'in': 'INCHES', 'ft': 'FEET'}


${PY_PACK_DIR}

PACK = pack_dir()
with open(os.path.join(PACK, 'pack.json')) as f:
    P = json.load(f)
REF = P['ref']
GLB = os.path.join(PACK, 'model.glb')
BLEND = _opt('--blend') or os.environ.get('MOJULO_BLEND') or os.path.join(PACK, REF + '.blend')
GATE = _opt('--gate') or os.environ.get('MOJULO_GATE') or os.path.join(PACK, 'mojulo-gate.json')


def log(*a):
    print('[mojulo]', *a)


def fresh_scene():
    try:
        bpy.ops.wm.read_homefile(use_empty=True)
    except Exception:
        try:
            bpy.ops.wm.read_factory_settings(use_empty=True)
        except Exception:
            for o in list(bpy.data.objects):
                bpy.data.objects.remove(o, do_unlink=True)


def import_glb():
    props = {p.identifier for p in bpy.ops.import_scene.gltf.get_rna_type().properties}
    kw = {'filepath': GLB, 'import_shading': 'NORMALS', 'import_scene_as_collection': False, 'merge_vertices': False}
    bpy.ops.import_scene.gltf(**{k: v for k, v in kw.items() if k in props})


def base_name(n):
    # Blender dedupes as name.001; a pack node never ends that way
    if len(n) > 4 and n[-4] == '.' and n[-3:].isdigit():
        return n[:-4]
    return n


def build_collections():
    sc = bpy.context.scene
    node_to_coll = {}
    for coll, names in P.get('collections', {}).items():
        for n in names:
            node_to_coll[n] = coll
    made = {}
    for o in [o for o in bpy.data.objects if o.type == 'MESH']:
        coll = node_to_coll.get(o.name) or node_to_coll.get(base_name(o.name))
        if not coll:
            continue
        c = made.get(coll) or bpy.data.collections.get(coll)
        if c is None:
            c = bpy.data.collections.new(coll)
            sc.collection.children.link(c)
        made[coll] = c
        for old in list(o.users_collection):
            if old is not c:
                old.objects.unlink(o)
        if o.name not in c.objects:
            c.objects.link(o)
    return sorted(made)


def world_box(objs):
    xs, ys, zs = [], [], []
    for o in objs:
        for v in o.bound_box:
            w = o.matrix_world @ Vector(v)
            xs.append(w.x); ys.append(w.y); zs.append(w.z)
    if not xs:
        return None
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def set_units():
    # DISPLAY scale only - coordinates stay in mojulo units so the return lands in the same frame
    u = bpy.context.scene.unit_settings
    label = (P.get('units') or '').strip().lower()
    try:
        u.system = 'IMPERIAL' if label in ('in', 'ft') else 'METRIC'
        u.scale_length = float(P.get('meters_per_unit') or 1.0)
        u.length_unit = LENGTH_UNIT.get(label, 'ADAPTIVE')
    except Exception as e:
        log('unit display not set:', e)


def set_shading():
    for screen in bpy.data.screens:
        for area in screen.areas:
            for space in area.spaces:
                if space.type != 'VIEW_3D':
                    continue
                try:
                    space.shading.color_type = 'VERTEX'   # solid mode shows COLOR_0 with no material at all
                    space.shading.type = 'MATERIAL' if screen.name == 'Layout' else 'SOLID'
                except Exception as e:
                    log('shading not set on', screen.name, e)


def frame_camera():
    sc = bpy.context.scene
    box = world_box([o for o in bpy.data.objects if o.type == 'MESH'])
    if not box:
        return None
    (x0, y0, z0), (x1, y1, z1) = box
    c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    span = max(x1 - x0, y1 - y0, z1 - z0, 1e-6)
    cam_data = bpy.data.cameras.new('MojuloFraming')
    cam_data.lens_unit = 'FOV'
    cam_data.angle = 0.9
    cam_data.clip_start = span * 0.01
    cam_data.clip_end = max(1000.0, span * 50)
    cam = bpy.data.objects.new('MojuloFraming', cam_data)
    sc.collection.objects.link(cam)
    cam.location = c + Vector((span * 1.1, -span * 1.4, span * 0.6))
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    for screen in bpy.data.screens:
        if screen.name != 'Layout':
            continue
        for area in screen.areas:
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    try:
                        space.region_3d.view_perspective = 'CAMERA'
                    except Exception:
                        pass
    return cam.name


def realize():
    fresh_scene()
    import_glb()
    colls = build_collections()
    set_units()
    set_shading()
    cam = frame_camera()
    log('realized', REF, '-', len([o for o in bpy.data.objects if o.type == 'MESH']), 'meshes in', len(colls), 'collections; camera', cam)
    return colls


def save_blend():
    if os.path.exists(BLEND) and not FORCE:
        log('REFUSED: %s exists - your pass in progress is untouched. Pass --force / MOJULO_FORCE=1 to start over.' % BLEND)
        print('MOJ_REFUSED', BLEND)
        if bpy.app.background:
            sys.exit(3)
        return None
    os.makedirs(os.path.dirname(os.path.abspath(BLEND)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    log('saved', BLEND)
    print('MOJ_RUN_DONE', BLEND)
    return BLEND


def report():
    objs = list(bpy.data.objects)
    meshes = [o for o in objs if o.type == 'MESH']
    rows = []
    tris = 0
    for o in objs:
        row = {'name': o.name, 'type': o.type, 'parent': o.parent.name if o.parent else None,
               'collections': sorted(c.name for c in o.users_collection)}
        if o.type == 'MESH':
            t = sum(max(0, len(p.vertices) - 2) for p in o.data.polygons)
            tris += t
            box = world_box([o])
            row.update({'triangles': t, 'bbox_min': [round(v, 4) for v in box[0]], 'bbox_max': [round(v, 4) for v in box[1]],
                        'vertex_colour': bool(o.data.color_attributes), 'materials': [m.name for m in o.data.materials if m]})
        rows.append(row)
    box = world_box(meshes)
    textured = [m.name for m in bpy.data.materials if m.use_nodes and any(n.type == 'TEX_IMAGE' and n.image for n in m.node_tree.nodes)]
    shading = {}
    for screen in bpy.data.screens:
        if screen.name != 'Layout':
            continue
        for area in screen.areas:
            for space in area.spaces:
                if space.type == 'VIEW_3D' and not shading:
                    shading = {'layout': space.shading.type, 'color_type': space.shading.color_type}
    u = bpy.context.scene.unit_settings
    arms = [o for o in objs if o.type == 'ARMATURE']
    return {
        'file': GLB, 'blend': BLEND if os.path.exists(BLEND) else None, 'mode': MODE, 'blender': bpy.app.version_string,
        'objects': rows, 'meshes': len(meshes), 'triangles': tris,
        'size': [round(box[1][i] - box[0][i], 4) for i in range(3)] if box else None,
        'vertex_colour_meshes': sum(1 for o in meshes if o.data.color_attributes),
        'textured_materials': textured,
        'armatures': len(arms), 'bones': sorted(b.name for a in arms for b in a.data.bones), 'actions': len(bpy.data.actions),
        'cameras': sum(1 for o in objs if o.type == 'CAMERA'), 'empties': sum(1 for o in objs if o.type == 'EMPTY'),
        'collections': sorted(c.name for c in bpy.data.collections),
        'shading': shading, 'unit': {'system': u.system, 'scale_length': round(u.scale_length, 6), 'length_unit': u.length_unit},
        'scene_camera': bpy.context.scene.camera.name if bpy.context.scene.camera else None,
    }


def verify():
    if os.path.exists(BLEND):
        bpy.ops.wm.open_mainfile(filepath=BLEND)
        log('opened', BLEND)
    else:
        log('no .blend at', BLEND, '- importing fresh for the report')
        realize()
    rep = report()
    os.makedirs(os.path.dirname(os.path.abspath(GATE)), exist_ok=True)
    with open(GATE, 'w') as f:
        json.dump(rep, f, indent=2)
    print('MOJ_GATE_WRITTEN', GATE)


if MODE == 'verify':
    verify()
elif MODE == 'run':
    realize()
    save_blend()
else:
    raise SystemExit('import_mojulo.py: MOJULO_MODE must be run or verify (got %r)' % MODE)
`;
}

/** export_return.py — the return re-export with the pinned settings; constant text. */
export function exportReturnPy() {
  return `"""
export_return.py - the return re-export of a mojulo Blender pack, with the pinned settings
(export-blender.plan.md rev 3, D9). Writes <pack>/return-<n>.glb (append-only numbering):
GLB, +Y up (Blender z-up -> glTF; mojulo's reader inverts it), object names kept, modifiers
applied, normals, UVs, materials with images embedded, vertex colours ACTIVE (COLOR_0 always
travels), no Draco / meshopt (the bind-back reader refuses compressed geometry). Cameras,
lights, animations and skins are left out - the return is a MESH.

  in Blender:  Scripting > Text > Open this file > Run Script
  headless:    blender -b <ref>.blend --python export_return.py
  blender-mcp: execute_blender_code("import os; os.environ['MOJULO_PACK']=r'<pack>'; exec(open(r'<pack>/export_return.py').read())")
Then, from your host agent: bind_mesh_render({ ref, glb_path: '<pack>/return-<n>.glb', source: 'blender-artpass' }).
"""
import bpy
import os
import re


${PY_PACK_DIR}

PACK = pack_dir()
existing = [int(m.group(1)) for f in os.listdir(PACK) for m in [re.match(r'^return-(\\d+)\\.glb$', f)] if m]
OUT = os.environ.get('MOJULO_RETURN') or os.path.join(PACK, 'return-%d.glb' % ((max(existing) + 1) if existing else 1))

props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
want = {
    'filepath': OUT, 'export_format': 'GLB', 'use_selection': False,
    'export_apply': True, 'export_yup': True, 'export_normals': True, 'export_texcoords': True,
    'export_materials': 'EXPORT', 'export_image_format': 'AUTO',
    'export_vertex_color': 'ACTIVE', 'export_active_vertex_color_when_no_material': True, 'export_all_vertex_colors': False,
    'export_colors': True,  # the pre-4.2 spelling; dropped where absent
    'export_draco_mesh_compression_enable': False,
    'export_hierarchy_flatten_objs': False, 'export_extras': True,
    'export_cameras': False, 'export_lights': False, 'export_animations': False, 'export_skins': False,
}
kw = {k: v for k, v in want.items() if k in props}
bpy.ops.export_scene.gltf(**kw)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
tris = sum(max(0, len(p.vertices) - 2) for o in meshes for p in o.data.polygons)
print('[mojulo] return written:', OUT, '-', len(meshes), 'meshes,', tris, 'triangles; settings:', sorted(kw))
print('MOJ_RETURN_WRITTEN', OUT)
`;
}

/* ------------------------------------------------------------------ guide --- */

const dims = (size, units) => `${size.map((v) => fmt(v)).join(' × ')}${units ? ` ${units}` : ' units'}`;
const listSome = (arr, max = 8) => (arr.length <= max ? arr.map((c) => `\`${c}\``).join(', ') : `${arr.slice(0, max).map((c) => `\`${c}\``).join(', ')} +${arr.length - max} more`);

/** ARTPASS-GUIDE.md — open, look, what is yours, re-export, bind back. */
export function artpassGuide({ title, ref, pack, ledger, remint }) {
  const colls = Object.keys(pack.collections ?? {});
  const lm = pack.landmark;
  const units = pack.units || null;
  const eyes = [
    `every panel reads its intended colour from every angle — no black face, no inside-out face, no panel mirrored against its twin`,
    ...(pack.glb.textures ? [`the ${pack.glb.textures} carried texture${pack.glb.textures === 1 ? '' : 's'} sit on the right panels (Material Preview shows them)`] : []),
    `scale reads right: the whole object is ${dims(pack.bounds.size, units)}`,
  ];
  const facts = numberedFacts([
    'YOURS to change: materials, texture paint, sculpt detail on a surface, decals, weathering — everything the greybox sentence calls "surfaces"',
    `NOT yours here: form, scale, layout, object names, the \`mojulo\` root — change those in the recipe (\`recipe/${ref}.json\`), re-mint (\`${remint}\`), re-import`,
    `keep object NAMES and the object COUNT: the return gate matches your mesh back to the pack by name and bounds${lm ? ` (\`${lm.name}\` is the frame landmark)` : ''}`,
    'rigs: paint, don\'t sculpt — a suit that must still walk takes colour only; a moved vertex orphans its colour (prelit, W2)',
    'the pack is regenerated in place on every re-mint; your `<ref>.blend` and `return-<n>.glb` beside it are never touched',
  ]);
  return `${guidePreamble({
    title, heading: 'Blender art-pass guide', recipeNote: `\`recipe/${ref}.json\``, target: BLENDER_TARGET,
    doer: 'the pack scripts (`import_mojulo.py`, `export_return.py`)', doerShort: 'a pack script',
  })}
## ① Open the pack in Blender

T001 double-click \`${ref}.blend\` beside this guide (present when \`export-blender.mjs\` ran its machine gate here) — or make it: Terminal > \`cd\` into this folder > \`<blender> -b --python import_mojulo.py -- --mode run\` — or in an open Blender: Scripting > Text > Open > \`import_mojulo.py\` > Run Script
T001.01 blender-mcp (optional transport): \`execute_blender_code\` — \`import os; os.environ['MOJULO_MODE']='run'; os.environ['MOJULO_PACK']=r'<this folder>'; exec(open(r'<this folder>/import_mojulo.py').read())\`
T001.02 the script refuses to overwrite an existing \`${ref}.blend\` (your pass in progress) — pass \`--force\` / \`MOJULO_FORCE=1\` to start over

## ② Look — the eyes gate before any art hours

T002 Outliner — one collection per part: ${listSome(colls)}; the \`mojulo\` empty is the frame root (leave it)
T003 3D Viewport > header > Viewport Shading(currently Material Preview in the Layout workspace; Solid shows the vertex colours) — the object reads in its baked colours${lm ? `; N panel > Item > Dimensions on \`${lm.name}\` reads ${dims(lm.size, units)}` : ''}
T004 orbit: front / ¾ / side / back / top / under — judge with your own eyes:
${numberedFacts(eyes, 3).join('\n')}
T004.01 optional true-scale check: \`export_model({ ref: '${ref}', format: 'usdz' })\` → AirDrop to an iPhone → Quick Look

## ③ What is yours to change (and what is not)

${facts.map((l, i) => l.replace(/^#\d{3}/, `#${String(3 + eyes.length + i).padStart(3, '0')}`)).join('\n')}

## ④ Re-export for the return door

T005 Scripting > Text > Open > \`export_return.py\` > Run Script — writes \`return-<n>.glb\` beside this guide (GLB · names kept · modifiers applied · vertex colours ACTIVE · images embedded · no Draco / meshopt) — or Terminal: \`<blender> -b ${ref}.blend --python export_return.py\`
T005.01 blender-mcp: \`execute_blender_code\` — \`import os; os.environ['MOJULO_PACK']=r'<this folder>'; exec(open(r'<this folder>/export_return.py').read())\`
T005.02 by hand instead: File > Export > glTF 2.0 > Format(currently glTF Binary) · Transform: +Y Up ✓ · Mesh: Apply Modifiers ✓, Normals ✓, Vertex Colors: Active · Material: Export, Images: Automatic · Compression: off · Animation: off

## ⑤ Bind it back

T006 from your host agent: \`bind_mesh_render({ ref: '${ref}', glb_path: '<this folder>/return-<n>.glb', source: 'blender-artpass', note: '<what changed>' })\`
T006.01 or durable, with a different pair of eyes accepting: \`request_mesh_render({ ref: '${ref}' })\` first, then \`submit_mesh_render({ request_id, glb_path, source: 'blender-artpass' })\`, then \`accept_mesh_render\` from someone else
T007 look at the FAITHFUL render: place it — \`figures: { <name>: { meshRef: '${ref}' } }\` in any world — and open \`/world\`; when the machine gate and your eyes disagree, your eyes win

${greyboxSection(pack.posture === 'greybox')}## What travelled, what didn't

${guideLedger(ledger)}
`;
}

/* ----------------------------------------------------------------- README --- */

export function blenderReadme({ title, ref, kind, pack, ledger, remint }) {
  return `# ${title} — Blender art pass

A generated Blender pack (mojulo \`export-blender\`, leg v${BLENDER_LEG_VERSION}) — the DESTINATION half
of the Blender seam: the operator (or their artist) opens the window and surfaces this object
by hand; the pass comes home through \`bind_mesh_render\` as a bound derived variant with
provenance. The artifact's truth lives in \`recipe/\` — this folder is derived; nothing flows
Blender → recipe. To change FORM, edit the recipe, re-mint (\`${remint}\`), re-import. The
headless worker legs (\`blender-bake.mjs\`, \`bake-world-gi.mjs\`) are a different seam on the
same binary — regenerable bakes; this pass is hand work and goes stale honestly when the
recipe moves past \`${pack.manifestHash}\`.

## Files

- \`model.glb\` — the ${pack.base === 'lit' ? 'LIT base: real PBR materials over the raw albedo (Blender\'s light is the only light)' : pack.base === 'unlit' ? 'UNLIT base: vertex colours on unlit materials (the bake worker\'s flat albedo)' : 'SHADED base: the vivid runtime look, mojulo\'s own shading baked in'}, named group nodes, authored normals${pack.glb.textures ? `, ${pack.glb.textures} embedded texture${pack.glb.textures === 1 ? '' : 's'}` : ''}
- \`pack.json\` — ref, manifest hash, units, the node inventory (name → bounds), the expected collections, the frame landmark
- \`import_mojulo.py\` — run: realize the pack in a fresh scene and save \`${ref}.blend\` here · verify: report what Blender built → \`mojulo-gate.json\`
- \`export_return.py\` — the return re-export with the pinned settings → \`return-<n>.glb\` here
- \`ARTPASS-GUIDE.md\` — the T-numbered operator guide (open · look · what is yours · re-export · bind)
- \`recipe/${ref}.json\` — the sovereign manifest, the re-mint source

The pack files are regenerated IN PLACE on every re-mint; \`${ref}.blend\`, \`return-<n>.glb\` and
\`mojulo-gate.json\` beside them are yours (derived, never packed, never overwritten by the emitter).

## Provenance

- source ref: \`${ref}\`
- kind: \`${kind}\`
- manifest sha256/16: \`${pack.manifestHash}\`
- blender leg: v${BLENDER_LEG_VERSION}, target ${BLENDER_TARGET}
- base: ${pack.base}
- units: ${pack.units ? `\`${pack.units}\` (1 unit = ${fmt(pack.meters_per_unit)} m — the script sets Blender's unit DISPLAY scale; coordinates are untouched)` : '1 mojulo unit = 1 meter (nothing declared on the recipe)'}
- frame: z-up; the GLB carries mojulo's y-up root rotation, so it lands upright in Blender with no axis settings
- re-mint: \`${remint}\` (from mojulo's \`control/\`)

## The four gates (never conflated — docs/bicycles.md)

1. **Machine, emit side** — \`node scripts/export-blender.mjs --ref ${ref}\` runs \`import_mojulo.py\` headless (run, then verify) and compares the report to \`pack.json\`: every node present with its bounds, the collections, the frame landmark (sign-sensitive: a mirrored import fails it), triangles, vertex colours, shading, units → \`mojulo-gate.json\`. Advisory.
2. **Eyes, emit side** — \`ARTPASS-GUIDE.md\` ② — the object reads right from every angle BEFORE art hours are spent.
3. **Machine, return side** — \`bind_mesh_render\` / \`submit_mesh_render\` decode the returned GLB fully before anything lands on disk (Draco / meshopt refused, quantization tolerated; albedo textures carried, other maps counted) and measure it against this pack's \`pack.json\`: node inventory · bounds · the landmark · scale. A HAND return's drift is stamped as \`contract_drift\` findings, never a refusal — you may have had reasons. A WORKER return that comes back re-scaled is a generator bug and is refused at \`accept_mesh_render\` (the handoff's size gate).
4. **Eyes, return side** — the FAITHFUL \`/world\` render of the bound variant, section by section. When the two gates disagree, the eyes win.

## blender-mcp (optional transport, never a dependency)

If you run blender-mcp, the three motions are one \`execute_blender_code\` each — the guide's
T001.01 / T005.01 lines — and \`get_viewport_screenshot\` is the agent's eyes for gate 2. The
loop reads identically without it. Cautions (the archived blender-mcp finding): set
\`DISABLE_TELEMETRY=true\`; its socket is unauthenticated code-exec — loopback only; heavy work
(bakes, renders, the recorded gate) stays headless.

${greyboxSection(pack.posture === 'greybox')}## What travelled, what didn't

${ledgerLines(ledger)}
`;
}

/**
 * emitBlenderPack — the text files of a pack. The assembler (blender-pack.js) adds
 * model.glb, pack.json and recipe/<ref>.json.
 */
export function emitBlenderPack({ ref, title, kind, pack, ledger, remint }) {
  const files = [
    { file: 'import_mojulo.py', text: importerPy() },
    { file: 'export_return.py', text: exportReturnPy() },
    { file: 'ARTPASS-GUIDE.md', text: artpassGuide({ title, ref, pack, ledger, remint }) },
    { file: 'README.md', text: blenderReadme({ title, ref, kind, pack, ledger, remint }) },
  ];
  return { files, ledger };
}
