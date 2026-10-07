/**
 * blender-film.js — a world camera shot as a Blender film pack (blender-film.plan.md).
 *
 * forge_motion export:'blender' (and scripts/export-blender-film.mjs) write, into a motion's
 * outcome folder, the world's Blender pack (blender-pack.js — the lit GLB + import_mojulo.py)
 * plus the FILM layer:
 *   atmosphere.json  the world's declared sky preset, lamp intensities, fog knobs and water surfaces
 *   shot.json        the exact per-frame cameras the motion rendered (worldMotionCameras —
 *                    z-up world units, horizontal FOV), fps and frame size
 *   film_shots.py    shot(s) → a keyed camera + target empty + Track To each, a timeline marker
 *                    bound per shot so several shots cut; --verify reads the keys back → film-gate.json
 *   film_light.py    performs atmosphere.json (sky + sun or moon per preset, lamp power, fog volume, water),
 *                    once: a scene with the operator's own light is left alone
 *   film_render.py   PNG sequence (resumable) → H.264 through Blender's own sequencer (no ffmpeg)
 *   FILM.md          the operator's page
 *
 * The scripts are CONSTANT text (everything per-shot rides shot.json); mojulo never launches
 * Blender from a tool. Deterministic: same recipe → same bytes.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FOG_DEFAULTS } from '@/lib/graph/effects/effects-fog';

export const BLENDER_FILM_VERSION = '0.1.0';

const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** The shot.json body for one world camera motion. `cameras` are worldFraming objects. */
export function filmShot({ motionRef = null, worldRef, title = null, motion, fps, width, height, cameras }) {
  if (!Array.isArray(cameras) || cameras.length < 1) throw new Error('filmShot: no cameras');
  return {
    source: 'mojulo',
    film_version: BLENDER_FILM_VERSION,
    world_ref: worldRef,
    motion_ref: motionRef,
    title,
    motion,
    fps,
    width,
    height,
    frame_count: cameras.length,
    up: 'z',
    units: 'world units (the pack root scales them to metres)',
    cameras: cameras.map((w) => ({
      pos: w.cameraPosition.map(r6),
      look_at: w.lookAt.map(r6),
      hfov_deg: r6(w.horizontalFov),
    })),
  };
}

/** film_shots.py — constant text. */
export function filmShotsPy() {
  return String.raw`"""
film_shots.py - mojulo shot(s) -> keyed Blender cameras, cut together (mojulo blender film v${BLENDER_FILM_VERSION}).

Per shot: an Empty "<shot>.target" keyed on the look-at point, a Camera "<shot>" keyed on position
(and on FOV only when the shot zooms) and aimed by a Track To on the target, so moving the target
re-aims the camera. A timeline marker bound to each camera makes the shots play as cuts.

The shots given REPLACE the file's mojulo shots and are laid out from the first frame in order
(--append keeps the existing ones and adds after them). Lights, materials and your art are untouched.

  blender -b film.blend --python film_shots.py -- [--shot shot.json ...] [--append] [--root mojulo]
          [--verify film-gate.json] [--check 1,18 --check-dir check/] [--save out.blend]
  In Blender: Scripting > Open > film_shots.py > Run Script (uses shot.json beside it)
"""
import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Vector


def _argv():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []


def _opts(name):
    a, out = _argv(), []
    for i, v in enumerate(a):
        if v == name and i + 1 < len(a):
            out.append(a[i + 1])
    return out


def _opt(name, default=None):
    v = _opts(name)
    return v[-1] if v else default


def _here():
    p = os.environ.get('MOJULO_PACK')
    if p:
        return os.path.abspath(p)
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        return os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()


def log(*a):
    print('[film]', *a)


def root_matrix():
    """The pack's GLB hangs under a root empty that scales world units to Blender metres. Its
    rotation is glTF's y-up -> z-up fix for the mesh data; shot coordinates are already z-up,
    so only the root's scale and offset apply to them."""
    name = _opt('--root', 'mojulo')
    root = bpy.data.objects.get(name)
    if root is None:
        log('no root object %r - shot coordinates used as metres' % name)
        return Matrix.Identity(4)
    loc, _rot, scl = root.matrix_world.decompose()
    return Matrix.Translation(loc) @ Matrix.Diagonal((scl[0], scl[1], scl[2], 1.0))


def fcurves(action):
    """Blender 4.4+ layered actions keep fcurves in channelbags; older ones on the action."""
    if hasattr(action, 'fcurves') and len(action.fcurves):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out.extend(bag.fcurves)
    return out


def shot_name(shot, path):
    base = shot.get('motion_ref') or os.path.splitext(os.path.basename(path))[0]
    return 'Shot_%s_%s' % (shot.get('motion', 'cam'), base)


def clear_shots():
    sc = bpy.context.scene
    for m in [m for m in sc.timeline_markers if m.camera is not None and m.camera.get('mojulo_end') is not None]:
        sc.timeline_markers.remove(m)
    for o in [o for o in bpy.data.objects if o.get('mojulo_end') is not None or o.get('mojulo_target')]:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data is not None and data.users == 0:
            bpy.data.cameras.remove(data)


def next_free_frame(sc):
    ends = [o.get('mojulo_end') for o in bpy.data.objects if o.get('mojulo_end') is not None]
    return (max(ends) + 1) if ends else sc.frame_start


def load_shot(path, start, M):
    with open(path) as f:
        shot = json.load(f)
    if shot.get('source') != 'mojulo' or not shot.get('cameras'):
        raise SystemExit('%s is not a mojulo shot file' % path)
    sc = bpy.context.scene
    name = shot_name(shot, path)
    first = not any(o.get('mojulo_end') is not None for o in bpy.data.objects)

    coll = bpy.data.collections.get('mojulo-shots') or bpy.data.collections.new('mojulo-shots')
    if coll.name not in sc.collection.children:
        sc.collection.children.link(coll)
    unit = M.to_scale()[0]

    target = bpy.data.objects.new(name + '.target', None)
    target.empty_display_type = 'SPHERE'
    target.empty_display_size = 0.5 * unit
    target['mojulo_target'] = True
    coll.objects.link(target)

    cd = bpy.data.cameras.new(name)
    cd.sensor_fit = 'HORIZONTAL'          # mojulo's FOV is horizontal
    cd.clip_start = 0.05 * unit
    cd.clip_end = 5000 * unit
    cam = bpy.data.objects.new(name, cd)
    coll.objects.link(cam)
    track = cam.constraints.new('TRACK_TO')
    track.target = target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'                # world up is z, as in mojulo

    fovs = [c['hfov_deg'] for c in shot['cameras']]
    zooms = max(fovs) - min(fovs) > 1e-4
    cd.angle = math.radians(fovs[0])
    for i, c in enumerate(shot['cameras']):
        fr = start + i
        cam.location = M @ Vector(c['pos'])
        cam.keyframe_insert('location', frame=fr)
        target.location = M @ Vector(c['look_at'])
        target.keyframe_insert('location', frame=fr)
        if zooms:
            cd.angle = math.radians(c['hfov_deg'])
            cd.keyframe_insert('lens', frame=fr)
    # every frame is a key (mojulo baked the easing already), so play them straight
    for idb in (cam, target, cd):
        ad = idb.animation_data
        if ad and ad.action:
            for fc in fcurves(ad.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'

    end = start + len(shot['cameras']) - 1
    cam['mojulo_end'] = end
    cam['mojulo_start'] = start
    cam['mojulo_shot'] = os.path.abspath(path)
    cam['mojulo_motion'] = shot.get('motion') or ''
    cam['mojulo_world'] = shot.get('world_ref') or ''
    if shot.get('motion_ref'):
        cam['mojulo_motion_ref'] = shot['motion_ref']
    sc.timeline_markers.new(name, frame=start).camera = cam

    sc.render.fps = int(shot['fps'])
    sc.render.resolution_x = int(shot['width'])
    sc.render.resolution_y = int(shot['height'])
    if first:
        sc.frame_start = start
        sc.camera = cam
    sc.frame_end = end
    log('%s: frames %d-%d, %d fps, %dx%d%s' % (name, start, end, shot['fps'], shot['width'], shot['height'], ', zoom keyed' if zooms else ''))
    return end


def verify(M, out):
    """Machine gate: read every keyed frame back and compare to the shot files."""
    sc = bpy.context.scene
    unit = M.to_scale()[0]
    shots, ok = [], True
    for cam in sorted((o for o in bpy.data.objects if o.get('mojulo_end') is not None), key=lambda o: o['mojulo_start']):
        with open(cam['mojulo_shot']) as f:
            shot = json.load(f)
        pe = ae = fe = 0.0
        for i, c in enumerate(shot['cameras']):
            sc.frame_set(cam['mojulo_start'] + i)
            mw = cam.matrix_world
            want_pos = M @ Vector(c['pos'])
            want_dir = (M @ Vector(c['look_at']) - want_pos).normalized()
            got_dir = -(mw.to_3x3() @ Vector((0, 0, 1))).normalized()
            pe = max(pe, (mw.translation - want_pos).length / unit)
            ae = max(ae, math.degrees(want_dir.angle(got_dir, 0.0)))
            fe = max(fe, abs(math.degrees(cam.data.angle) - c['hfov_deg']))
        good = pe < 1e-3 and ae < 0.05 and fe < 1e-3
        ok = ok and good
        shots.append({'camera': cam.name, 'frames': [cam['mojulo_start'], cam['mojulo_end']], 'ok': good,
                      'max_pos_err_units': round(pe, 6), 'max_aim_err_deg': round(ae, 6), 'max_fov_err_deg': round(fe, 6)})
        log('verify %s %s pos %.2g u, aim %.2g deg, fov %.2g deg' % ('ok ' if good else 'BAD', cam.name, pe, ae, fe))
    with open(out, 'w') as f:
        json.dump({'ok': ok, 'blender': bpy.app.version_string, 'shots': shots}, f, indent=2)
    log('gate', 'green' if ok else 'RED', '->', out)
    return ok


def check_renders(frames, out_dir):
    """Workbench stills (no lights needed) to hold against the forged GIF frames. Not saved."""
    sc = bpy.context.scene
    engine, light, ctype = sc.render.engine, sc.display.shading.light, sc.display.shading.color_type
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'MATERIAL'
    os.makedirs(out_dir, exist_ok=True)
    for fr in frames:
        sc.frame_set(fr)
        sc.render.filepath = os.path.join(out_dir, 'frame_%04d.png' % fr)
        bpy.ops.render.render(write_still=True)
        log('check', sc.render.filepath)
    sc.render.engine, sc.display.shading.light, sc.display.shading.color_type = engine, light, ctype


def main():
    sc = bpy.context.scene
    M = root_matrix()
    paths = [os.path.abspath(p) for p in _opts('--shot')]
    if not paths and not _opt('--verify'):
        paths = [os.path.join(_here(), 'shot.json')]
    if paths:
        if '--append' not in _argv():
            clear_shots()
        start = int(_opt('--start', 0)) or next_free_frame(sc)
        for p in paths:
            start = load_shot(p, start, M) + 1
    save = _opt('--save')
    if save:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(save), compress=True)
        log('saved', save)
    elif paths and bpy.app.background and bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
        log('saved', bpy.data.filepath)
    gate = _opt('--verify')
    if gate:
        verify(M, os.path.abspath(gate))
    chk = _opt('--check')
    if chk:
        beside = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else _here()
        check_renders([int(x) for x in chk.split(',')], os.path.abspath(_opt('--check-dir', os.path.join(beside, 'check'))))
    print('MOJ_FILM_SHOTS_DONE')


main()
`;
}

/**
 * The world's declared atmosphere, from the UNSHADED resolve the pack itself reads (the lit handoff:
 * the recipe's declarations travel, the engine performs them): the sky preset, the fog's look knobs,
 * the water surfaces the pack leaves out, and each lamp's intensity (the lamps themselves are in
 * model.glb). Pure over (payload, manifest).
 */
export function filmAtmosphere({ payload, manifest = {} }) {
  const sky = payload?.sky && typeof payload.sky === 'object' ? payload.sky : null;
  const preset = sky?.preset ?? (manifest.time === 'day' || manifest.time === 'night' ? manifest.time : null);
  const fogOpts = manifest.fog && typeof manifest.fog === 'object' ? manifest.fog : {};
  const fog = payload?.fog && manifest.fog
    ? {
      height: Number.isFinite(+fogOpts.height) ? +fogOpts.height : FOG_DEFAULTS.height,
      density: Number.isFinite(+fogOpts.density) ? +fogOpts.density : FOG_DEFAULTS.density,
      color: Array.isArray(fogOpts.color) && fogOpts.color.length === 3 ? fogOpts.color.map(Number) : [...FOG_DEFAULTS.color],
      reach: Number.isFinite(+fogOpts.maxDist) ? +fogOpts.maxDist : FOG_DEFAULTS.maxDist,   // how far mojulo marches it
    }
    : null;
  const water = (Array.isArray(payload?.faces) ? payload.faces : [])
    .filter((f) => f?.water && Array.isArray(f.corners) && f.corners.length >= 3)
    .map((f) => ({
      corners: f.corners.map((c) => c.map(r6)),
      fill: typeof f.fill === 'string' ? f.fill : '#3c524e',
      ...(Number.isFinite(f.alpha) ? { alpha: f.alpha } : {}),
      ...(f.liquid ? { liquid: f.liquid } : {}),
    }));
  // the lamps themselves ride model.glb (KHR_lights_punctual, named light:<name>); their mojulo
  // intensity rides here so the rig sets a Blender power by name, whatever the importer converted.
  const lamps = (Array.isArray(payload?.lights) ? payload.lights : [])
    .filter((l) => l && Array.isArray(l.position) && typeof l.name === 'string')
    .map((l) => ({ name: l.name, intensity: Number.isFinite(l.intensity) ? l.intensity : 1 }));
  return {
    film_version: BLENDER_FILM_VERSION,
    preset,
    sky: sky ? { preset: sky.preset ?? null, stars: !!sky.stars, moon: !!sky.moon } : null,
    meters_per_unit: Number.isFinite(payload?.metersPerUnit) ? payload.metersPerUnit : null,
    lamps,
    fog,
    water,
  };
}

/** film_light.py — constant text. */
export function filmLightPy() {
  return String.raw`"""
film_light.py - light a mojulo film as its recipe declared it (mojulo blender film v${BLENDER_FILM_VERSION}).

Reads atmosphere.json beside it - the world's sky preset, fog and water - and performs it:
  day / none   physical sky + sun (35 deg up)
  dawn / dusk  low warm sun (12 deg up)
  night        dark sky + a faint cool moon (40 deg up); the street lamps carry the scene
  interior     no sun, a faint fill; the world's own lights carry it
  lamps        mojulo's lamps arrive in model.glb as point lights; each is set to its intensity x --lamp-gain watts
  fog          a ground-hugging volume to the recipe's fog height, thinning with height (EEVEE and Cycles)
  water        the water surfaces the pack leaves out, rebuilt as a reflective water mesh
plus a ground to the horizon and AgX.

Light ONCE: a scene with a light of yours (anything but mojulo's imported lamps and this rig) is left
alone, and a rig already placed is kept - unless --force, which rebuilds the rig. Water is added once.

  blender -b film.blend --python film_light.py -- [--preset day|dawn|dusk|night|interior]
          [--sun-elevation 35] [--sun-azimuth 215] [--sun 2.6] [--sky 0.35] [--exposure -0.4]
          [--lamp-gain 3] [--fog-scale 0.3] [--fog-glow 0.008] [--no-fog] [--no-water] [--no-ground] [--force]
"""
import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Vector


def _argv():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []


def _opt(name, default=None):
    a = _argv()
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def _flag(name):
    return name in _argv()


def log(*a):
    print('[film]', *a)


def _here():
    p = os.environ.get('MOJULO_PACK')
    if p:
        return os.path.abspath(p)
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        return os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()


def root_matrix():
    """World units -> Blender metres: the pack root's scale and offset (its rotation is the mesh's y-up fix)."""
    root = bpy.data.objects.get(_opt('--root', 'mojulo'))
    if root is None:
        return Matrix.Identity(4)
    loc, _rot, scl = root.matrix_world.decompose()
    return Matrix.Translation(loc) @ Matrix.Diagonal((scl[0], scl[1], scl[2], 1.0))


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def rig(obj):
    obj['film_rig'] = True
    bpy.context.scene.collection.objects.link(obj)
    return obj


def scene_box():
    """World-space bounds of the imported meshes (not the rig, not the ground)."""
    mesh = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.get('film_rig')]
    pts = [o.matrix_world @ Vector(c) for o in mesh for c in o.bound_box]
    if not pts:
        return Vector((0, 0, 0)), Vector((1, 1, 1))
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def sun(name, elevation, azimuth, energy, color):
    sd = bpy.data.lights.new(name, 'SUN')
    sd.energy = energy
    sd.color = color
    sd.angle = math.radians(0.6)
    ob = rig(bpy.data.objects.new(name, sd))
    d = Vector((math.sin(azimuth) * math.cos(elevation), math.cos(azimuth) * math.cos(elevation), math.sin(elevation)))
    ob.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    return ob


def world(preset, el, az):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('film-world')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground')
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    if preset in ('night', 'interior'):
        bg.inputs['Color'].default_value = (0.004, 0.006, 0.014, 1) if preset == 'night' else (0.02, 0.02, 0.02, 1)
        bg.inputs['Strength'].default_value = 1.0
        return
    sky = nt.nodes.new('ShaderNodeTexSky')
    for t in ('MULTIPLE_SCATTERING', 'NISHITA', 'SINGLE_SCATTERING'):
        try:
            sky.sky_type = t
            break
        except TypeError:
            continue
    sky.sun_elevation = el
    sky.sun_rotation = az
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = float(_opt('--sky', 0.35))


def ground(z):
    r = 10000.0
    gm = bpy.data.meshes.new('film-ground')
    gm.from_pydata([(-r, -r, z), (r, -r, z), (r, r, z), (-r, r, z)], [], [(0, 1, 2, 3)])
    m = bpy.data.materials.new('film-ground')
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.16, 0.17, 0.14, 1)
    p.inputs['Roughness'].default_value = 0.9
    gm.materials.append(m)
    rig(bpy.data.objects.new('film-ground', gm))


def fog(spec, unit):
    lo, hi = scene_box()
    top = lo.z + spec['height'] * unit
    pad = spec.get('reach', 150) * unit           # out as far as mojulo's march reaches, so no box edge shows
    x0, x1, y0, y1, z0 = lo.x - pad, hi.x + pad, lo.y - pad, hi.y + pad, lo.z - 0.5
    vs = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, top), (x1, y0, top), (x1, y1, top), (x0, y1, top)]
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new('film-fog')
    me.from_pydata(vs, [], fs)
    m = bpy.data.materials.new('film-fog')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (*spec['color'], 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    rng = nt.nodes.new('ShaderNodeMapRange')            # 1 at the ground, 0 at the fog ceiling
    rng.inputs['From Min'].default_value = lo.z
    rng.inputs['From Max'].default_value = top
    rng.inputs['To Min'].default_value = 1.0
    rng.inputs['To Max'].default_value = 0.0
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    # mojulo's density is per world unit and its march thins it with drift noise; per metre, scaled to read alike
    mul.inputs[1].default_value = spec['density'] / unit * float(_opt('--fog-scale', 0.3))
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], rng.inputs['Value'])
    nt.links.new(rng.outputs['Result'], mul.inputs[0])
    nt.links.new(mul.outputs['Value'], vol.inputs['Density'])
    # mojulo's fog is airlight - it glows in its own colour, day or night - so the volume emits too
    glow = nt.nodes.new('ShaderNodeMath')
    glow.operation = 'MULTIPLY'
    glow.inputs[1].default_value = float(_opt('--fog-glow', 0.008))
    nt.links.new(rng.outputs['Result'], glow.inputs[0])
    vol.inputs['Emission Color'].default_value = (*spec['color'], 1)
    nt.links.new(glow.outputs['Value'], vol.inputs['Emission Strength'])
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    me.materials.append(m)
    rig(bpy.data.objects.new('film-fog', me))
    log('fog volume to %.1f m, density %.3g /m' % (top - lo.z, mul.inputs[1].default_value))


def water(faces, M):
    verts, polys, mats, index = [], [], [], {}
    for f in faces:
        poly = []
        for c in f['corners']:
            verts.append(tuple(M @ Vector(c)))
            poly.append(len(verts) - 1)
        polys.append(tuple(poly))
        key = f.get('fill', '#3c524e')
        if key not in index:
            index[key] = len(index)
        mats.append(index[key])
    me = bpy.data.meshes.new('film-water')
    me.from_pydata(verts, [], polys)
    for key in index:
        m = bpy.data.materials.new('film-water ' + key)
        m.use_nodes = True
        p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (*srgb(key), 1)
        p.inputs['Roughness'].default_value = 0.04
        p.inputs['IOR'].default_value = 1.33
        p.inputs['Coat Weight'].default_value = 1.0
        nt = m.node_tree
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 0.6
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.08
        nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
        me.materials.append(m)
    for poly, mi in zip(me.polygons, mats):
        poly.material_index = mi
    ob = bpy.data.objects.new('film-water', me)
    ob['film_water'] = True
    bpy.context.scene.collection.objects.link(ob)
    log('water: %d surfaces' % len(polys))


def main():
    sc = bpy.context.scene
    path = os.path.join(_here(), 'atmosphere.json')
    atm = json.load(open(path)) if os.path.exists(path) else {}
    M = root_matrix()
    unit = M.to_scale()[0]
    preset = _opt('--preset') or atm.get('preset') or 'day'
    force = _flag('--force')

    lamps = [o for o in sc.objects if o.type == 'LIGHT' and o.name.startswith('light:')]
    placed = [o for o in sc.objects if o.get('film_rig')]
    yours = [o for o in sc.objects if o.type == 'LIGHT' and o not in lamps and not o.get('film_rig')]
    if yours and not force:
        log('your lights are in the scene - left as is (--force adds the rig anyway)')
    elif placed and not force:
        log('rig already placed - kept (light once; --force rebuilds it)')
    else:
        for o in placed:
            bpy.data.objects.remove(o, do_unlink=True)
        default_el = {'night': 40, 'dawn': 12, 'dusk': 12}.get(preset, 35)
        el = math.radians(float(_opt('--sun-elevation', default_el)))
        az = math.radians(float(_opt('--sun-azimuth', 215)))
        world(preset, el, az)
        if preset == 'night':
            sun('film-moon', el, az, float(_opt('--sun', 0.12)), (0.65, 0.75, 1.0))
        elif preset in ('dawn', 'dusk'):
            sun('film-sun', el, az, float(_opt('--sun', 2.0)), (1.0, 0.72, 0.48))
        elif preset != 'interior':
            sun('film-sun', el, az, float(_opt('--sun', 2.6)), (1.0, 1.0, 1.0))
        # mojulo lamp intensity -> watts; the glTF importer's own conversion leaves a street lamp near-dark
        gain = float(_opt('--lamp-gain', 3.0))
        table = {l['name']: l['intensity'] for l in atm.get('lamps', [])}
        for o in lamps:
            key = o.name[len('light:'):].split('.')[0]
            if key in table:
                o.data.energy = table[key] * gain
                o.data.shadow_soft_size = 0.1 * unit
        if not _flag('--no-ground'):
            ground(scene_box()[0].z - 0.05)
        if atm.get('fog') and not _flag('--no-fog'):
            fog(atm['fog'], unit)
        sc.view_settings.view_transform = 'AgX'
        try:
            sc.view_settings.look = 'AgX - Medium High Contrast'
        except TypeError:
            pass
        sc.view_settings.exposure = float(_opt('--exposure', {'night': 1.0, 'interior': 0.0}.get(preset, -0.4)))
        log('light rig placed: %s, sun %.0f deg up, %d lamp(s)' % (preset, math.degrees(el), len(lamps)))
    if atm.get('water') and not _flag('--no-water') and not any(o.get('film_water') for o in sc.objects):
        water(atm['water'], M)
    if bpy.app.background and bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
    print('MOJ_FILM_LIGHT_DONE')


main()
`;
}

/** film_render.py — constant text. */
export function filmRenderPy() {
  return String.raw`"""
film_render.py - render a mojulo film to a PNG sequence, then H.264 (mojulo blender film v${BLENDER_FILM_VERSION}).

Frames first, so a crash loses one frame; a re-run skips frames already on disk. The MP4 is cut in
Blender's own sequencer - no ffmpeg install needed. Markers switch the camera at each cut.

  blender -b film.blend --python film_render.py -- [--preset draft|final] [--engine EEVEE|CYCLES]
          [--samples 128] [--res 100] [--out film/]
    draft: EEVEE at the shot size        final: Cycles, 128 samples, denoised, at 200 %
"""
import bpy
import os
import sys
import time


def _argv():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []


def _opt(name, default=None):
    a = _argv()
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def log(*a):
    print('[film]', *a)


PRESETS = {'draft': ('EEVEE', 0, 100), 'final': ('CYCLES', 128, 200)}


def main():
    preset = _opt('--preset', 'draft')
    if preset not in PRESETS:
        raise SystemExit('--preset must be draft or final')
    engine, samples, res = PRESETS[preset]
    engine = (_opt('--engine') or engine).upper()
    samples = int(_opt('--samples', samples))
    res = int(_opt('--res', res))
    here = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()
    out = os.path.abspath(_opt('--out', os.path.join(here, 'film')))
    frames_dir = os.path.join(out, 'frames-%s' % preset)

    sc = bpy.context.scene
    if engine == 'CYCLES':
        sc.render.engine = 'CYCLES'
    else:
        try:
            sc.render.engine = 'BLENDER_EEVEE'          # Blender 5+
        except TypeError:
            sc.render.engine = 'BLENDER_EEVEE_NEXT'     # Blender 4.2-4.x
    sc.render.resolution_percentage = res
    if engine != 'CYCLES' and hasattr(sc.eevee, 'use_raytracing'):
        sc.eevee.use_raytracing = True                # reflections on water and glass
    if engine == 'CYCLES':
        sc.cycles.samples = samples
        sc.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            for kind in ('METAL', 'OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
                try:
                    prefs.compute_device_type = kind
                except TypeError:
                    continue
                prefs.get_devices()
                if any(d.type == kind for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = True
                    sc.cycles.device = 'GPU'
                    break
        except Exception as e:
            log('GPU unavailable, CPU render:', e)

    os.makedirs(frames_dir, exist_ok=True)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.use_overwrite = False
    sc.render.use_placeholder = True
    sc.render.filepath = os.path.join(frames_dir, '')
    t = time.time()
    bpy.ops.render.render(animation=True)
    n = sc.frame_end - sc.frame_start + 1
    log('%d frames (%s) in %.1f s' % (n, preset, time.time() - t))

    # encode: a throwaway scene whose sequencer plays the PNGs
    files = sorted(f for f in os.listdir(frames_dir) if f.endswith('.png'))
    w, h = sc.render.resolution_x * res // 100, sc.render.resolution_y * res // 100
    enc = bpy.data.scenes.new('film-encode')
    enc.render.resolution_x, enc.render.resolution_y, enc.render.resolution_percentage = w, h, 100
    enc.render.fps = sc.render.fps
    enc.frame_start, enc.frame_end = 1, len(files)
    seq = enc.sequence_editor_create()
    strips = seq.strips if hasattr(seq, 'strips') else seq.sequences
    strip = strips.new_image('frames', os.path.join(frames_dir, files[0]), channel=1, frame_start=1)
    for f in files[1:]:
        strip.elements.append(f)
    if hasattr(enc.render.image_settings, 'media_type'):   # Blender 5+: video is its own media type
        enc.render.image_settings.media_type = 'VIDEO'
    enc.render.image_settings.file_format = 'FFMPEG'
    enc.render.ffmpeg.format = 'MPEG4'
    enc.render.ffmpeg.codec = 'H264'
    enc.render.ffmpeg.constant_rate_factor = 'HIGH'
    enc.render.filepath = os.path.join(out, 'film-%s.mp4' % preset)
    with bpy.context.temp_override(scene=enc):
        bpy.ops.render.render(animation=True, scene=enc.name)
    log('encoded', enc.render.filepath)
    print('MOJ_FILM_RENDER_DONE', enc.render.filepath)


main()
`;
}

/** FILM.md — the operator's page for the film layer. */
export function filmReadme({ title, worldRef, motionRef, motion, frames, fps, width, height }) {
  const cli = `node scripts/export-blender-film.mjs --motion ${motionRef ?? '<mo_…>'}`;
  return `# ${title} — Blender film

A mojulo world shot as a real Blender camera (mojulo blender film v${BLENDER_FILM_VERSION}). The world pack
beside this file (model.glb, import_mojulo.py, README.md) is \`${worldRef}\`; \`shot.json\` is the
\`${motion}\` shot ${motionRef ? `\`${motionRef}\` ` : ''}— ${frames} frames at ${fps} fps, ${width}×${height} — as the exact
per-frame cameras mojulo rendered the preview from.

## One command (from mojulo's \`control/\`)

    ${cli} [--motion mo_… …] [--render draft|final]

builds \`film.blend\` here (once), lays the shots out in order as cuts, checks every keyed frame against
\`shot.json\` (machine gate → \`film-gate.json\`), adds the starter light rig if the scene has no lights, and
optionally renders \`film/film-draft.mp4\` (EEVEE) or \`film/film-final.mp4\` (Cycles). Re-running keeps your
lights and art: only the mojulo cameras are replaced.

## By hand

    <blender> -b --python import_mojulo.py -- --mode run --blend film.blend
    <blender> -b film.blend --python film_shots.py -- --shot shot.json --verify film-gate.json
    <blender> -b film.blend --python film_light.py
    <blender> -b film.blend --python film_render.py -- --preset draft

## What stays fixed, what is yours

- Fixed: camera position, aim and FOV on every frame, and the cuts. Upgrading models, materials and
  light changes the look, not the shot — as long as a replacement keeps its footprint and height.
- Resolution: keep the aspect (${width}:${height}) and the framing holds; another aspect crops or extends vertically.
- Frame rate: re-forge the shot with more frames for 24 fps rather than stretching the keys.
- Light: \`film_light.py\` performs \`atmosphere.json\` — the recipe's sky preset (day, dawn/dusk, night with a
  moon, interior), mojulo's street lamps at street-lamp power, a glowing ground fog when the recipe has \`fog\`,
  and the water surfaces the pack leaves out. Tune with its dials (\`--lamp-gain\`, \`--fog-glow\`, \`--fog-scale\`,
  \`--preset\`); \`--force\` rebuilds the rig. Not carried: night window glow, glow billboards, clouds.
- Static set: traffic, walkers, fire and rig clips are frozen at their export pose; the camera is the only
  thing that moves. A camera path can pass through geometry — check the preview before a long render.
- Eyes gate: \`film_shots.py -- --check 1,${Math.ceil(frames / 2)},${frames}\` renders Workbench stills to hold against the GIF.
`;
}

/** The film layer's files (no world pack). */
export function emitBlenderFilm({ shot, title, atmosphere = null }) {
  const files = [
    { file: 'shot.json', text: `${JSON.stringify(shot, null, 2)}\n` },
    ...(atmosphere ? [{ file: 'atmosphere.json', text: `${JSON.stringify(atmosphere, null, 2)}\n` }] : []),
    { file: 'film_shots.py', text: filmShotsPy() },
    { file: 'film_light.py', text: filmLightPy() },
    { file: 'film_render.py', text: filmRenderPy() },
    {
      file: 'FILM.md',
      text: filmReadme({
        title: title || shot.title || shot.world_ref, worldRef: shot.world_ref, motionRef: shot.motion_ref,
        motion: shot.motion, frames: shot.frame_count, fps: shot.fps, width: shot.width, height: shot.height,
      }),
    },
  ];
  return { files };
}

/**
 * Write a film pack: the world's Blender pack + the film layer, into `outDir` (written in place —
 * the operator's film.blend and renders beside it survive). Returns the pack result + the film files.
 */
export async function writeBlenderFilm({ outDir, shot, title, base = 'lit', log = () => {} }) {
  const { buildBlenderPack } = await import('@/lib/graph/scene/blender-pack.js');
  const { SketchRepository } = await import('@/lib/db/repositories/sketches');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const pack = await buildBlenderPack({ ref: shot.world_ref, outDir, base, log });
  // the same unshaded resolve the pack reads: the declarations (sky, lamps, fog, water) travel
  const sketch = SketchRepository.getByRef(shot.world_ref);
  const { payload } = await resolveWorldScene(sketch, { unshaded: true });
  const atmosphere = filmAtmosphere({ payload, manifest: sketch.manifest || {} });
  const { files } = emitBlenderFilm({ shot, title, atmosphere });
  const written = [];
  for (const f of files) {
    await fs.writeFile(path.join(outDir, f.file), f.text);
    written.push({ file: f.file, bytes: Buffer.byteLength(f.text) });
  }
  return { dir: outDir, pack, written: [...pack.written, ...written] };
}
