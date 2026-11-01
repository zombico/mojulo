"""
import_handoff.py - THE ENGINE HANDOFF IN BLENDER (mojulo's scene/handoff.js, written by scene/handoff-blender.js).

  headless:   blender -b --python mojulo/import_handoff.py [-- --blend <path>] [--render <png> [--camera <name>]
              [--engine eevee|cycles] [--res 1280x720] [--samples n]] [--no-save]
  in Blender: open level.blend (or a new file), Scripting > Text > Open mojulo/import_handoff.py > Run Script, then save

It builds the level in mojulo's own collections of the artist's .blend (level.blend beside mojulo/, made the first
time): a re-handoff (mojulo/ replaced whole) opens it, removes only what a previous run built (every datablock it made
carries the custom property `mojulo_handoff`: its collections "Mojulo", "Mojulo Markers", "Mojulo Seats" and
"mojulo-fire", their objects, meshes, materials, images, actions, its world) and builds them again; the artist's own
collections, objects and materials stay as they left them. The scene's settings (its view transform, engine, units) are
set the first time only, and its camera and world only where none of the artist's stands. From mojulo/handoff.json it:
  - imports level.glb with Blender's glTF importer (the GLB's root turns glTF's y-up to mojulo's z-up, which Blender's
    is): meshes, instances sharing their meshes, the rigged figures with their clips, the cameras, the room's lamps
  - gives every material its vertex colour as base colour (glTF's COLOR_0 is linear, and multiplies the base) and, where
    the handoff names one, its height map as a Bump over the normal map, bound but at strength 0: at the relief's own
    depth (millimetres) it reads as nothing over the normal map, which carries the relief; an artist raises it
  - lays the layered ground (`terrain`): every part it names takes the material `mojulo:terrain`, the page's fragment as
    nodes (handoff_nodes.py), reading each corner's weights (`_SPLAT`) and the layers' images from mojulo/terrain/
  - lays the sea (`sea`): its plane takes `mojulo:sea`, its colour faded toward the shore by its depth map, the level's
    sky in its reflection; it casts no shadow
  - builds the World (the page's sky dome to the camera, the solve's ambient to every other ray), the haze over every
    material (three's exp-squared fog by the view's depth, toward the haze's colour; a see-through surface hazed once),
    the sun as a Sun lamp (its strength the record's: π x the solve's level, which in Blender lights a white surface to
    that level, as the page's sun does), the lamps at the page's strength (4π x the glTF intensity, their reach their
    cutoff, no shadow: each stands inside its fitting), the page's tone (Khronos PBR Neutral, exposure 0)
  - makes a camera active: the level's camera marker's (its glTF camera), else the GLB's first, else one behind the spawn
  - stands every marker and seat as an Empty in "Mojulo Markers" / "Mojulo Seats", its record as custom properties
    (`mojulo`, the record as JSON; `mojulo_kind`), and the level record on the scene (`mojulo_level`)
  - with mojulo/fire/ (a world with fire), builds its fire at the packed instant (handoff_fire.py, the art pack's builder)
"""
import bpy
import json
import math
import os
import struct
import sys

from mathutils import Vector


def _here():
    p = os.environ.get('MOJULO_HANDOFF')
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
    raise SystemExit('import_handoff.py: cannot find mojulo/ - set MOJULO_HANDOFF=<the pack>/mojulo')


HERE = _here()
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import importlib  # noqa: E402
import handoff_nodes as N  # noqa: E402
# (run again in the same Blender after a re-handoff: the new module, not the one the last run loaded)
N = importlib.reload(N)

TAG = N.TAG
COLL, MARKERS, SEATS, FIRE = 'Mojulo', 'Mojulo Markers', 'Mojulo Seats', 'mojulo-fire'


def _argv():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []


def _opt(name, default=None):
    a = _argv()
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def log(*a):
    print('[mojulo-handoff]', *a)


def fail(msg):
    # (the gate looks for this mark in Blender's log)
    print('[mojulo-handoff] ERROR', msg)


BLEND = os.path.abspath(_opt('--blend') or os.environ.get('MOJULO_BLEND') or os.path.join(os.path.dirname(HERE), 'level.blend'))


def rel(p):
    return os.path.join(HERE, p)


# ---- what mojulo built, removed for a rebuild ---------------------------------------------------------------------

DATA = ('objects', 'collections', 'meshes', 'materials', 'images', 'node_groups', 'actions', 'armatures', 'cameras',
        'lights', 'worlds', 'textures', 'curves', 'volumes', 'shape_keys')


def owned():
    out = []
    for k in DATA:
        coll = getattr(bpy.data, k, None)
        if coll is None:
            continue
        out.extend(i for i in coll if i.get(TAG))
    return out


def clear_mojulo():
    ids = owned()
    if ids:
        bpy.data.batch_remove(ids)
    # (what the removed left behind: meshes and materials no longer used)
    try:
        bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=False, do_recursive=True)
    except Exception:
        pass
    sc = bpy.context.scene
    for k in [k for k in sc.keys() if k.startswith('moj:') or k in ('mojulo_level', 'mojulo_handoff')]:
        del sc[k]
    return len(ids)


def snapshot():
    snap = {}
    for k in DATA:
        coll = getattr(bpy.data, k, None)
        if coll is not None:
            snap[k] = set(i.as_pointer() for i in coll)
    return snap


def tag_new(snap):
    n = 0
    for k, seen in snap.items():
        for i in getattr(bpy.data, k):
            if i.as_pointer() not in seen and not i.library:
                i[TAG] = True
                n += 1
    return n


def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    c[TAG] = True
    (parent or bpy.context.scene.collection).children.link(c)
    return c


# ---- the GLB ------------------------------------------------------------------------------------------------------

def glb_json(path):
    with open(path, 'rb') as f:
        head = f.read(20)
        n = struct.unpack('<I', head[12:16])[0]
        return json.loads(f.read(n).decode('utf8'))


def import_glb(coll):
    lc = bpy.context.view_layer.layer_collection
    for c in lc.children:
        if c.collection == coll:
            bpy.context.view_layer.active_layer_collection = c
    props = {p.identifier for p in bpy.ops.import_scene.gltf.get_rna_type().properties}
    kw = {'filepath': rel('level.glb'), 'merge_vertices': False, 'import_shading': 'NORMALS', 'import_scene_as_collection': False,
          'export_import_convert_lighting_mode': 'RAW', 'disable_bone_shape': True, 'import_scene_extras': True}
    before = set(o.as_pointer() for o in bpy.data.objects)
    bpy.ops.import_scene.gltf(**{k: v for k, v in kw.items() if k in props})
    bpy.context.view_layer.active_layer_collection = lc
    # (what the importer linked to the scene itself goes in mojulo's collection)
    sc = bpy.context.scene.collection
    for o in bpy.data.objects:
        if o.as_pointer() not in before and o.name in sc.objects:
            if o.name not in coll.objects:
                coll.objects.link(o)
            sc.objects.unlink(o)


def base_name(n):
    if len(n) > 4 and n[-4] == '.' and n[-3:].isdigit():
        return n[:-4]
    return n


# ---- the materials --------------------------------------------------------------------------------------------------

def principled(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.node_tree else None


def vertex_colour(m):
    """glTF's COLOR_0 multiplies the base colour: where the importer did not wire it, wire it (linear)."""
    b = principled(m)
    if b is None:
        return False
    nt = m.node_tree
    if any(n.type == 'VERTEX_COLOR' for n in nt.nodes):
        return True
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Color'
    vc.location = (b.location[0] - 520, b.location[1] + 200)
    sock = b.inputs['Base Color']
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.blend_type = 'MULTIPLY'
    mx.location = (b.location[0] - 260, b.location[1] + 200)
    mx.inputs['Factor'].default_value = 1.0
    a_in = next(s for s in mx.inputs if s.identifier == 'A_Color')
    b_in = next(s for s in mx.inputs if s.identifier == 'B_Color')
    if sock.links:
        nt.links.new(sock.links[0].from_socket, a_in)
    else:
        a_in.default_value = sock.default_value
    nt.links.new(vc.outputs['Color'], b_in)
    nt.links.new(next(s for s in mx.outputs if s.identifier == 'Result_Color'), sock)
    return True


def height(m, spec):
    """A dressed face's or a bark's height map as a Bump over its normal map, bound at strength 0."""
    b = principled(m)
    p = rel(spec['height'])
    if b is None or not os.path.exists(p):
        return False
    nt = m.node_tree
    img = bpy.data.images.load(p, check_existing=True)
    img.colorspace_settings.name = 'Non-Color'
    tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = img
    tx.name = tx.label = 'mojulo:height'
    tx.location = (b.location[0] - 700, b.location[1] - 520)
    # (the height's repeat is the normal map's: the same UVs)
    uv_from = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.inputs['Vector'].links), None)
    if uv_from:
        nt.links.new(uv_from.inputs['Vector'].links[0].from_socket, tx.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.name = bump.label = 'mojulo:height-bump'
    bump.location = (b.location[0] - 260, b.location[1] - 520)
    bump.inputs['Strength'].default_value = 0.0
    bump.inputs['Distance'].default_value = float(spec.get('depth', 0.02) or 0.02)
    nt.links.new(tx.outputs['Color'], bump.inputs['Height'])
    nrm = b.inputs['Normal']
    if nrm.links:
        nt.links.new(nrm.links[0].from_socket, bump.inputs['Normal'])
    nt.links.new(bump.outputs['Normal'], nrm)
    return True


def load_image(p, colour):
    if p is None:
        return None
    ap = rel(p)
    if not os.path.exists(ap):
        fail('missing ' + p)
        return None
    img = bpy.data.images.load(ap, check_existing=True)
    img.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    # (a mask's channels are data: never premultiplied)
    img.alpha_mode = 'CHANNEL_PACKED'
    return img


def terrain(T):
    L = T.get('layers', {})
    if not all(k in L for k in ('base', 'normal', 'orm')):
        fail('the terrain\'s layers are missing')
        return 0
    I = T.get('images', {})
    images = {'layers': {k: [load_image(p, k == 'base') for p in L[k]] for k in ('base', 'normal', 'orm')},
              'dice': load_image(I.get('dice'), False), 'path': load_image(I.get('path'), False), 'grass': load_image(I.get('grass'), False)}
    ng = N.terrain_group(T, images)
    m = bpy.data.materials.new('mojulo:terrain')
    m[TAG] = True
    N.use_nodes(m)
    nt = m.node_tree
    b = principled(m)
    gn = nt.nodes.new('ShaderNodeGroup')
    gn.node_tree = ng
    gn.location = (b.location[0] - 300, b.location[1])
    nt.links.new(gn.outputs['Base Color'], b.inputs['Base Color'])
    nt.links.new(gn.outputs['Roughness'], b.inputs['Roughness'])
    nt.links.new(gn.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Metallic'].default_value = 0.0
    parts, n = set(T.get('parts', [])), 0
    for me in bpy.data.meshes:
        if not me.get(TAG):
            continue
        for i, mm in enumerate(me.materials):
            if mm is not None and base_name(mm.name) in parts:
                me.materials[i] = m
                n += 1
    return n


def sea(S, env):
    part, n = S.get('part', 'form:sea'), 0
    img = load_image(S.get('image'), False)
    m = None
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.get(TAG):
            continue
        for i, mm in enumerate(o.data.materials):
            if mm is None or base_name(mm.name) != part:
                continue
            if m is None:
                b = principled(mm)
                base = tuple(b.inputs['Base Color'].default_value)[:3] if b else (0.0, 0.29, 0.45)
                rough = b.inputs['Roughness'].default_value if b else 0.06
                m = N.sea_material(S, env, img, base, rough)
            o.data.materials[i] = m
            o.visible_shadow = False
            n += 1
    return n


# ---- the environment ----------------------------------------------------------------------------------------------

def zrot(d):
    v = Vector(d).normalized()
    return v.to_track_quat('Z', 'Y').to_euler()


def environment(env, coll, first):
    sc = bpy.context.scene
    w = N.world(env)
    if first or sc.world is None:
        sc.world = w
    hz = None
    if isinstance(env.get('haze'), dict) and env['haze'].get('density'):
        hz = N.haze_group(env['haze'])
    sun = None
    if isinstance(env.get('sun'), dict):
        s = env['sun']
        ld = bpy.data.lights.new('mojulo:sun', 'SUN')
        ld[TAG] = True
        # (the page's sun: π x the solve's level; a Sun lamp of that strength lights a white surface facing it to the level)
        ld.energy = float(s.get('intensity', math.pi))
        c = s.get('color', [1, 1, 1])
        ld.color = (float(c[0]), float(c[1]), float(c[2]))
        ld.angle = math.radians(0.5)
        sun = bpy.data.objects.new('mojulo:sun', ld)
        sun[TAG] = True
        sun.rotation_euler = zrot(s['direction'])
        sun.location = Vector(s['direction']).normalized() * 100.0
        if s.get('default'):
            sun['mojulo_default'] = True
        coll.objects.link(sun)
    return w, hz, sun


def lamps(glb):
    """The room's lamps (`form:lamp:*`) at the page's strength: three lights base x intensity / (π d²); Blender's point of
    power P lights it P / (4π² d²): P = 4π x the glTF intensity (imported raw), its reach its cutoff, no shadow. Any
    other light in the GLB (a kind's own pot lights) is candela, as the extension says: Blender's own conversion
    (4π x cd / 683 W), as the glTF importer makes it."""
    nodes = {n.get('name'): n for n in glb.get('nodes', [])}
    lights = glb.get('extensions', {}).get('KHR_lights_punctual', {}).get('lights', [])
    n = 0
    for o in bpy.data.objects:
        if o.type != 'LIGHT' or not o.get(TAG) or o.data.type not in ('POINT', 'SPOT'):
            continue
        nd = nodes.get(base_name(o.name))
        li = None
        if nd is not None:
            k = nd.get('extensions', {}).get('KHR_lights_punctual', {}).get('light')
            li = lights[k] if k is not None and k < len(lights) else None
        inten = float(li.get('intensity', 1.0)) if li else float(o.data.energy)
        if not base_name(o.name).startswith('light:form:lamp:'):
            o.data.energy = 4.0 * math.pi * inten / 683.0
            continue
        o.data.energy = 4.0 * math.pi * inten
        o.data.shadow_soft_size = 0.05
        # (a lamp stands at its flame, inside its fitting: it casts no shadow, or the fitting would hold its light in; the
        # page bakes it so, and Godot's lamps cast none)
        o.data.use_shadow = False
        if li and li.get('range'):
            try:
                o.data.use_custom_distance = True
                o.data.cutoff_distance = float(li['range'])
            except Exception:
                pass
        n += 1
    return n


def camera(level, coll):
    sc = bpy.context.scene
    cams = [o for o in bpy.data.objects if o.type == 'CAMERA' and o.get(TAG)]
    by = {base_name(o.name): o for o in cams}
    marks = [m for m in level.get('markers', []) if m.get('kind') == 'camera']
    for m in marks:
        o = by.get('cam:' + str(m.get('name', ''))[len('camera:'):])
        if o is not None:
            return o
    if marks and marks[0].get('at') is not None:
        m = marks[0]
        return stand_camera('mojulo:camera', m['at'], m.get('look') or [0, 0, 0], m.get('yfov'), coll)
    if cams:
        return sorted(cams, key=lambda o: o.name)[0]
    spawn = next((m for m in level.get('markers', []) if m.get('kind') == 'spawn' and m.get('at') is not None), None)
    look = spawn['at'] if spawn else [0, 0, 0]
    return stand_camera('mojulo:camera', [look[0], look[1] - 8, look[2] + 5], look, None, coll)


def stand_camera(name, at, look, yfov, coll):
    cd = bpy.data.cameras.new(name)
    cd[TAG] = True
    cd.sensor_fit = 'VERTICAL'
    cd.angle = float(yfov) if yfov else math.radians(50)
    cd.clip_start, cd.clip_end = 0.05, 8000
    o = bpy.data.objects.new(name, cd)
    o[TAG] = True
    o.location = Vector(at)
    o.rotation_euler = (Vector(look) - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(o)
    return o


# ---- the markers and seats ----------------------------------------------------------------------------------------

def record(o, r, kind):
    o['mojulo'] = json.dumps(r, sort_keys=True)
    o['mojulo_kind'] = str(kind)
    o[TAG] = True


def empty(name, at, coll, size=0.5, shape='PLAIN_AXES'):
    o = bpy.data.objects.new(name, None)
    o.empty_display_type = shape
    o.empty_display_size = size
    if at is not None:
        o.location = Vector([float(v) for v in at[:3]])
    coll.objects.link(o)
    return o


def markers(level):
    mc = collection(MARKERS)
    for m in level.get('markers', []):
        o = empty(str(m.get('name', 'marker')), m.get('at'), mc, 0.6 if m.get('kind') == 'spawn' else 0.4, 'ARROWS' if m.get('kind') in ('spawn', 'entity') else 'PLAIN_AXES')
        record(o, m, m.get('kind', 'marker'))
    seats = level.get('seats')
    if isinstance(seats, dict):
        scoll = collection(SEATS)
        scoll['mojulo'] = json.dumps({k: seats.get(k) for k in ('screen', 'lives', 'pool', 'join', 'drop')}, sort_keys=True)
        for r in seats.get('rows', []):
            o = empty('seat_' + str(r.get('label', r.get('n'))), r.get('spawn'), scoll, 0.6, 'SINGLE_ARROW')
            record(o, r, 'seat')
            c = r.get('color')
            if isinstance(c, str) and c.startswith('#') and len(c) == 7:
                o.color = N.hex_rgb(c) + (1.0,)


# ---- the scene's settings (the first time only: then they are the artist's) --------------------------------------

def settings():
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except Exception:
            continue
    vs = sc.view_settings
    # (the page's tone: Khronos PBR Neutral at exposure 1, Blender's since 4.2; Standard where it has none)
    try:
        vs.view_transform = 'Khronos PBR Neutral'
    except Exception:
        vs.view_transform = 'Standard'
    try:
        vs.look = 'None'
    except Exception:
        pass
    vs.exposure, vs.gamma = 0.0, 1.0
    sc.display_settings.display_device = 'sRGB'
    sc.unit_settings.system, sc.unit_settings.scale_length = 'METRIC', 1.0
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    try:
        sc.eevee.use_shadows = True
    except Exception:
        pass
    sc['mojulo_settings'] = True


# ---- the fire -----------------------------------------------------------------------------------------------------

def fire():
    if not os.path.exists(rel(os.path.join('fire', 'fire.json'))) or not os.path.exists(rel('handoff_fire.py')):
        return None
    os.environ['MOJULO_FIRE_PACK'] = HERE
    F = importlib.reload(importlib.import_module('handoff_fire'))
    sc = bpy.context.scene
    keep = (sc.world, sc.view_settings.view_transform, sc.camera, sc.render.engine)
    S = F.build_fire()
    # (the fire's builder sets its own night, tone, engine and camera for its still: the level's are the handoff's, and
    # its `Fire` camera stands beside the level's, for a Cycles still: --render <png> --camera Fire --engine cycles)
    sc.world, sc.view_settings.view_transform, sc.camera, sc.render.engine = keep
    return S


# ---- the build ----------------------------------------------------------------------------------------------------

def build():
    with open(rel('handoff.json')) as f:
        H = json.load(f)
    sc = bpy.context.scene
    removed = clear_mojulo()
    first = not sc.get('mojulo_settings')
    snap = snapshot()
    coll = collection(COLL)
    import_glb(coll)
    glb = glb_json(rel('level.glb'))
    # (every datablock the import made is mojulo's: tagged now, removed on the next build)
    tag_new(snap)
    mats = H.get('materials', {})
    vc = hh = 0
    # (the materials on a mesh that carries colours: a mesh with none, a stone or a plant's wood, keeps its base colour)
    coloured = set()
    for me in bpy.data.meshes:
        if me.get(TAG) and me.color_attributes.get('Color') is not None:
            coloured.update(m.name for m in me.materials if m)
    for m in bpy.data.materials:
        if not m.get(TAG) or not m.node_tree:
            continue
        if m.name in coloured and vertex_colour(m):
            vc += 1
        spec = mats.get(base_name(m.name))
        if isinstance(spec, dict) and spec.get('height') and height(m, spec):
            hh += 1
    level = H.get('level') if isinstance(H.get('level'), dict) else None
    env = (level or {}).get('environment', {}) if level else {}
    t = terrain(H['terrain']) if isinstance(H.get('terrain'), dict) else 0
    s = sea(H['sea'], env) if isinstance(H.get('sea'), dict) else 0
    nl = lamps(glb)
    w = hz = sun = None
    if level:
        w, hz, sun = environment(env, coll, first)
        markers(level)
        cam = camera(level, coll)
        if sc.camera is None or first:
            sc.camera = cam
        sc['mojulo_level'] = json.dumps(level, sort_keys=True)
    sc['mojulo_handoff'] = str(H.get('version', ''))
    fr = fire()
    # (the haze over every material mojulo built, the fire's volumes and glows aside)
    hzn = 0
    if hz is not None:
        for m in bpy.data.materials:
            if m.get(TAG) and m.node_tree and not m.name.startswith(('mojulo-flame', 'mojulo-smoke', 'mojulo-embers', 'mojulo-fire-coals')) and N.wrap_haze(m, hz):
                hzn += 1
    tag_new(snap)
    if first:
        settings()
    log('built', H.get('version'), '- removed', removed, 'of a previous build;', len([o for o in bpy.data.objects if o.get(TAG)]), 'objects,',
        vc, 'vertex-coloured materials,', hh, 'heights,', t, 'terrain slots,', s, 'sea slots,', nl, 'lamps, haze on', hzn,
        'materials; camera', sc.camera.name if sc.camera else None, '; fire' if fr else '')


def render():
    out = _opt('--render')
    if not out:
        return
    sc = bpy.context.scene
    cam = _opt('--camera')
    if cam:
        if cam not in bpy.data.objects:
            raise SystemExit('no camera %r: %s' % (cam, ', '.join(o.name for o in bpy.data.objects if o.type == 'CAMERA')))
        sc.camera = bpy.data.objects[cam]
    eng = (_opt('--engine') or 'eevee').lower()
    sc.render.engine = 'CYCLES' if eng == 'cycles' else sc.render.engine if 'EEVEE' in sc.render.engine else 'BLENDER_EEVEE'
    if eng == 'cycles':
        sc.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            for kind in ('METAL', 'OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
                try:
                    prefs.compute_device_type = kind
                    prefs.get_devices()
                    if any(d.type == kind for d in prefs.devices):
                        for d in prefs.devices:
                            d.use = True
                        sc.cycles.device = 'GPU'
                        break
                except Exception:
                    continue
        except Exception as e:
            log('rendering on the CPU:', e)
    res = (_opt('--res') or '1280x720').lower().split('x')
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = int(res[0]), int(res[1]), 100
    smp = _opt('--samples')
    if smp:
        if eng == 'cycles':
            sc.cycles.samples = int(smp)
        else:
            sc.eevee.taa_render_samples = int(smp)
    sc.render.filepath = os.path.abspath(out)
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    log('rendered', out)


def main():
    if bpy.app.background:
        if os.path.exists(BLEND):
            bpy.ops.wm.open_mainfile(filepath=BLEND)
            log('opened', BLEND)
        else:
            bpy.ops.wm.read_homefile(use_empty=True)
    try:
        build()
    except Exception as e:
        import traceback
        traceback.print_exc()
        fail('the build stopped: %s' % e)
        if bpy.app.background:
            sys.exit(2)
        raise
    if bpy.app.background and '--no-save' not in _argv():
        bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
        log('saved', BLEND)
    render()


main()
