/**
 * scene-film — a SCENE as a Blender film pack: its actors (each its own GLB: the hero with the scene's face take and act,
 * actor/act.js sceneActOf), their places over time, the coverage's cameras cut together (coverage.js, laid out as the
 * world film pack lays a shoot plan's shots: motion/blender-film.js film_shots.py), and a LOOK built in Blender:
 *
 *   film   the production look: each material a Principled BSDF over the GLB's own colour, a little subsurface on the
 *          skin, Cycles
 *   anime  the cel look shaded live: each material's light read by Shader to RGB, stepped by a constant ramp, its colour
 *          multiplied in, a rim on the edges; an inverted-hull ink outline; EEVEE. The export is the lit one (the realistic
 *          body's smooth normals, no light baked into its colours), so the bands move with Blender's lights
 *
 *   sceneFilmFiles({ S, coverage, actors, fps, width, height, title }) → [{ file, text }] (no GLBs: the caller writes
 *     each actor's as `actors/<who>.glb`)
 *     scene.json   the scene: its seconds and fps, each actor's GLB, take and place over time ([{ t, x, y, yaw }], metres,
 *                  yaw 0 facing +y), the coverage, the turns (who, when, the words)
 *     shot.json, shots/*.json, film_shots.py, film_light.py, film_render.py   the film layer (blender-film.js), a shot
 *                  each of the coverage's, each camera keyed every frame
 *     actors.py    builds the cast: each GLB imported under an empty `actor:<who>` keyed on its place and facing, its
 *                  body's act and its face's take bound and laid from frame 1, the scene's frame range set
 *     look.py      `-- --look film | anime`: the look on every actor
 *     SCENE.md     the operator's page, the director's notes on the scene among it (notes.js)
 *
 * The scripts are constant text (everything per scene rides scene.json and the shot files). Pure and deterministic.
 */
import { filmShot, emitBlenderFilm, BLENDER_FILM_VERSION } from '../../motion/blender-film.js';
import { directorsNotes } from './notes.js';

export const LOOKS = Object.freeze(['film', 'anime']);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** the coverage's camera at t: its shot's two keys eased linearly, as the shoot plan's linear path plays them */
export function coverageCameraAt(coverage, t) {
  const s = coverage.shots.find((x) => t >= x.span[0] && t < x.span[1]) ?? coverage.shots.at(-1);
  const cam = coverage.cameras.find((c) => c.id === s.camera), ks = cam.keys.filter((k) => k.t >= s.span[0] - 1e-3 && k.t <= s.span[1] + 1e-3);
  const a = ks[0], b = ks.at(-1), u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0, lerp = (p, q) => p.map((v, i) => v + (q[i] - v) * u);
  const focal = a.focal_mm + (b.focal_mm - a.focal_mm) * u, film = cam.film_mm ?? 36;
  return { shot: s, framing: { cameraPosition: lerp(a.pos, b.pos), lookAt: lerp(a.poi, b.poi), horizontalFov: (2 * Math.atan(film / (2 * focal)) * 180) / Math.PI } };
}

/** The pack's files (see the header) */
export function sceneFilmFiles({ S, coverage, actors, fps = 24, width = 1920, height = 1080, title = 'scene' }) {
  const frames = Math.max(1, Math.round(S.seconds * fps));
  // (each shot of the coverage a film shot, its camera keyed every frame it holds)
  const shots = coverage.shots.map((s, k) => {
    const f0 = Math.round(s.span[0] * fps), f1 = Math.max(f0 + 1, Math.round(s.span[1] * fps)), cameras = [];
    for (let f = f0; f < f1; f++) cameras.push(coverageCameraAt(coverage, Math.min(S.seconds - 1e-6, f / fps)).framing);
    return filmShot({ motionRef: `${title}-${String(k + 1).padStart(2, '0')}`, worldRef: title, title: s.name, motion: 'scene', fps, width, height, cameras });
  });
  const film = emitBlenderFilm({ shot: shots[0], shots, title });
  const scene = {
    source: 'mojulo', film_version: BLENDER_FILM_VERSION, title, seconds: S.seconds, fps, frames, width, height, up: 'z', units: 'metres',
    actors: Object.fromEntries(Object.entries(actors).map(([who, A]) => [who, { glb: `actors/${who}.glb`, act: `act:${A.take}`, face: `face:${A.take}`, root: S.actors[who].root.map((k) => ({ t: r6(k.t), x: r6(k.x), y: r6(k.y), yaw: r6(k.yaw) })) }])),
    turns: S.turns.map((T) => ({ who: T.who, at: T.at, end: T.end, text: T.text })),
    coverage,
  };
  return [
    { file: 'scene.json', text: `${JSON.stringify(scene, null, 2)}\n` },
    ...film.files.filter((f) => f.file !== 'FILM.md'),
    { file: 'actors.py', text: actorsPy() },
    { file: 'look.py', text: lookPy() },
    { file: 'SCENE.md', text: sceneReadme({ title, S, coverage, frames, fps, notes: directorsNotes(S, coverage), shotFiles: film.files.filter((f) => f.file.startsWith('shots/')).map((f) => f.file) }) },
  ];
}

/** actors.py — constant text */
export function actorsPy() {
  return String.raw`"""
actors.py - a mojulo scene's cast into Blender (mojulo scene film v${BLENDER_FILM_VERSION}).

Each actor's GLB (scene.json) imported under an Empty "actor:<who>", the empty keyed on the actor's place and facing
over the scene (metres, z up; yaw 0 faces +y, turning toward +x), the body's act and the face's take bound and laid
from frame 1, the scene's frame range and rate set. Run it once in a fresh film.blend, before film_shots.py:

  blender -b film.blend --python actors.py
  In Blender: Scripting > Open > actors.py > Run Script (uses scene.json beside it)
"""
import bpy
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def log(msg):
    print('[mojulo actors] %s' % msg)


def load_scene():
    with open(os.path.join(HERE, 'scene.json')) as f:
        return json.load(f)


def fcurves_of(act):
    """An action's F-curves: the legacy list (Blender 4), else its layers' strips' channel bags (Blender 5's layered
    actions, where the legacy list is gone)."""
    legacy = getattr(act, 'fcurves', None)
    if legacy is not None:
        try:
            return list(legacy)
        except Exception:
            pass
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in getattr(layer, 'strips', []):
            for bag in getattr(strip, 'channelbags', []):
                out.extend(bag.fcurves)
    return out


def bind(datablock_owner, prefix, wants, actions):
    """Give an owner (an armature, a mesh's shape keys) the action, among this actor's own import's, whose name starts
    with prefix and moves what it wants ('pose.bones' or 'key_blocks'); clear its NLA so nothing else plays over it.
    (Only this import's: a second actor's actions come in named 'act:scene.001' and the like, and the first actor's
    would match its prefix too.)"""
    for act in actions:
        if not act.name.startswith(prefix):
            continue
        paths = [fc.data_path for fc in fcurves_of(act)]
        if paths and not any(wants in p for p in paths):
            continue
        ad = datablock_owner.animation_data or datablock_owner.animation_data_create()
        for track in list(ad.nla_tracks):
            ad.nla_tracks.remove(track)
        ad.action = act
        if hasattr(ad, 'action_slot') and getattr(act, 'slots', None):
            ad.action_slot = act.slots[0]
        return act.name
    return None


def build(S):
    sc = bpy.context.scene
    sc.render.fps = int(S['fps'])
    sc.frame_start = 1
    sc.frame_end = int(S['frames'])
    sc.render.resolution_x, sc.render.resolution_y = int(S['width']), int(S['height'])
    fps = float(S['fps'])
    for who, A in S['actors'].items():
        name = 'actor:%s' % who
        old = bpy.data.objects.get(name)
        if old is not None:
            log('%s is already in the file: left as it is' % name)
            continue
        before, had = set(bpy.data.objects), set(bpy.data.actions)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, A['glb']))
        new = [o for o in bpy.data.objects if o not in before]
        mine = sorted([a for a in bpy.data.actions if a not in had], key=lambda a: a.name)
        holder = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(holder)
        for o in new:
            if o.parent is None:
                o.parent = holder
            # (the GLB's own root is named for mojulo; one per actor, renamed so nothing takes it for the world's)
            if o.name.startswith('mojulo'):
                o.name = '%s:root' % name
        # the place and the facing: the empty keyed every frame the root names, linear between
        for k in A['root']:
            frame = 1 + k['t'] * fps
            holder.location = (k['x'], k['y'], 0.0)
            holder.rotation_euler = (0.0, 0.0, -math.radians(k['yaw']))
            holder.keyframe_insert('location', frame=frame)
            holder.keyframe_insert('rotation_euler', frame=frame)
        if holder.animation_data and holder.animation_data.action:
            for fc in fcurves_of(holder.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'BEZIER'
        bound = []
        for o in new:
            if o.type == 'ARMATURE':
                bound.append(bind(o, A['act'], 'pose.bones', mine))
            if o.type == 'MESH' and o.data.shape_keys is not None:
                bound.append(bind(o.data.shape_keys, A['face'], 'key_blocks', mine))
        log('%s: %d objects, bound %s' % (name, len(new), [b for b in bound if b]))
    sc.frame_set(1)


if __name__ == '__main__':
    build(load_scene())
`;
}

/** look.py — constant text */
export function lookPy() {
  return String.raw`"""
look.py - a mojulo scene's LOOK on its cast (mojulo scene film v${BLENDER_FILM_VERSION}).

  blender -b film.blend --python look.py -- --look film     the production look: Principled BSDF, a little subsurface
                                                            on the skin, Cycles
  blender -b film.blend --python look.py -- --look anime    the cel look shaded live: Shader to RGB stepped by a constant
                                                            ramp, the colour multiplied in, a rim; an inverted-hull ink
                                                            outline; EEVEE (Shader to RGB is EEVEE's)

Each material of every object under an "actor:<who>" empty is rebuilt over the colour the GLB gave it (its base colour
texture, its colour attribute, or its factor); run it again with the other look to switch. The ink is a Solidify
modifier with flipped normals drawing a back-face-culled dark material.
"""
import bpy
import sys

INK = 'mojulo.ink'
SKIN_HINTS = ('skin', 'body', 'face', 'head')


def log(msg):
    print('[mojulo look] %s' % msg)


def opt(name, default):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default


def cast_objects():
    out = []
    for o in bpy.data.objects:
        p = o
        while p is not None and not p.name.startswith('actor:'):
            p = p.parent
        if p is not None and o.type == 'MESH':
            out.append(o)
    return out


def colour_source(mat):
    """The socket that coloured the GLB's material (a texture's, a colour attribute's), else its base colour value."""
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return None, (0.8, 0.8, 0.8, 1.0)
    base = bsdf.inputs['Base Color']
    if base.is_linked:
        return base.links[0].from_socket, tuple(base.default_value)
    return None, tuple(base.default_value)


def film(mat):
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        return
    skin = any(h in mat.name.lower() for h in SKIN_HINTS)
    for key, value in (('Roughness', 0.55 if skin else 0.6), ('Subsurface Weight', 0.12 if skin else 0.0), ('Subsurface', 0.12 if skin else 0.0)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    if 'Subsurface Radius' in bsdf.inputs and skin:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.35, 0.2)


def mix(nt, blend, name):
    """A colour mix (blend MULTIPLY | ADD, its factor 1) -> (node, A, B, result): the Mix node in its colour mode
    (Blender 3.4 on), else the legacy MixRGB."""
    try:
        n = nt.nodes.new('ShaderNodeMix')
        n.data_type = 'RGBA'
        n.blend_type = blend
        n.name = name
        n.inputs[0].default_value = 1.0
        return n, n.inputs[6], n.inputs[7], n.outputs[2]
    except Exception:
        n = nt.nodes.new('ShaderNodeMixRGB')
        n.blend_type = blend
        n.name = name
        n.inputs[0].default_value = 1.0
        return n, n.inputs[1], n.inputs[2], n.outputs[0]


def anime(mat):
    nt = mat.node_tree
    src, base = colour_source(mat)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
    for n in [n for n in nt.nodes if n.name.startswith('mojulo.')]:
        nt.nodes.remove(n)
    diffuse = nt.nodes.new('ShaderNodeBsdfDiffuse'); diffuse.name = 'mojulo.light'
    to_rgb = nt.nodes.new('ShaderNodeShaderToRGB'); to_rgb.name = 'mojulo.toRGB'
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.name = 'mojulo.bands'
    ramp.color_ramp.interpolation = 'CONSTANT'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.62, 1.0)
    ramp.color_ramp.elements[1].position = 0.35
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    mul, mul_a, mul_b, mul_out = mix(nt, 'MULTIPLY', 'mojulo.colour')
    if src is not None:
        nt.links.new(src, mul_b)
    else:
        mul_b.default_value = base
    rim_w = nt.nodes.new('ShaderNodeLayerWeight'); rim_w.name = 'mojulo.rimWeight'
    rim_w.inputs['Blend'].default_value = 0.35
    rim = nt.nodes.new('ShaderNodeValToRGB'); rim.name = 'mojulo.rim'
    rim.color_ramp.interpolation = 'CONSTANT'
    rim.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    rim.color_ramp.elements[1].position = 0.72
    rim.color_ramp.elements[1].color = (0.25, 0.25, 0.28, 1.0)
    add, add_a, add_b, add_out = mix(nt, 'ADD', 'mojulo.lit')
    emit = nt.nodes.new('ShaderNodeEmission'); emit.name = 'mojulo.emit'
    nt.links.new(diffuse.outputs['BSDF'], to_rgb.inputs['Shader'])
    nt.links.new(to_rgb.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mul_a)
    nt.links.new(rim_w.outputs['Facing'], rim.inputs['Fac'])
    nt.links.new(mul_out, add_a)
    nt.links.new(rim.outputs['Color'], add_b)
    nt.links.new(add_out, emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])


def ink_material():
    mat = bpy.data.materials.get(INK) or bpy.data.materials.new(INK)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nt = mat.node_tree
    nt.nodes.clear()
    emit = nt.nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (0.04, 0.035, 0.03, 1.0)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
    return mat


def ink(obj, on):
    mod = obj.modifiers.get('mojulo.ink')
    if not on:
        if mod is not None:
            obj.modifiers.remove(mod)
        return
    mat = ink_material()
    if mat.name not in [m.name for m in obj.data.materials if m is not None]:
        obj.data.materials.append(mat)
    if mod is None:
        mod = obj.modifiers.new('mojulo.ink', 'SOLIDIFY')
    mod.thickness = -0.004
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = len(obj.data.materials) - 1


def main():
    look = opt('--look', 'film')
    if look not in ('film', 'anime'):
        raise SystemExit('look.py: --look film | anime, not %r' % look)
    objs = cast_objects()
    done = set()
    for o in objs:
        for slot in o.material_slots:
            mat = slot.material
            if mat is None or mat.name == INK or mat.name in done:
                continue
            mat.use_nodes = True
            if look == 'film':
                for n in [n for n in mat.node_tree.nodes if n.name.startswith('mojulo.')]:
                    mat.node_tree.nodes.remove(n)
                bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                out = next((n for n in mat.node_tree.nodes if n.type == 'OUTPUT_MATERIAL'), None)
                if bsdf is not None and out is not None:
                    mat.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
                film(mat)
            else:
                anime(mat)
            done.add(mat.name)
        ink(o, look == 'anime')
    sc = bpy.context.scene
    if look == 'film':
        sc.render.engine = 'CYCLES'
    else:
        engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
        sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    log('%s on %d objects, %d materials, %s' % (look, len(objs), len(done), sc.render.engine))


if __name__ == '__main__':
    main()
`;
}

/** SCENE.md — the operator's page */
export function sceneReadme({ title, S, coverage, frames, fps, notes = [], shotFiles }) {
  return `# ${title} — a mojulo scene for Blender

${Object.keys(S.actors).length} actors, ${S.seconds} s (${frames} frames at ${fps} fps), ${coverage.shots.length} shots on ${coverage.cameras.length} cameras.

## Build it (once, in an empty film.blend beside these files)

    <blender> -b --python-expr "import bpy; bpy.ops.wm.save_as_mainfile(filepath='film.blend')"
    <blender> -b film.blend --python actors.py -- && <blender> -b film.blend --python-expr "import bpy; bpy.ops.wm.save_mainfile()"
    <blender> -b film.blend --python film_shots.py -- --root none ${shotFiles.length ? shotFiles.map((f) => `--shot ${f}`).join(' ') : ''}
    <blender> -b film.blend --python look.py -- --look film      # or --look anime
    <blender> -b film.blend --python film_render.py

Or open film.blend and run actors.py, film_shots.py and look.py from the Scripting tab, in that order.

## What is here

- \`actors/<who>.glb\`: each actor's hero, skinned, its body's take \`act:scene\` and its face's \`face:scene\` on the scene's
  clock (the act's \`moj:act\` extras carry its place over time too). \`actors.py\` hangs each under an empty
  \`actor:<who>\` keyed on that place and facing.
- \`scene.json\`: the scene (the actors, their places, the lines, the coverage). \`shot.json\` and \`shots/\`: the
  coverage's cameras, each shot keyed every frame, cut at markers by \`film_shots.py\`.
- \`look.py\`: the look. \`film\` is the production look in Cycles; \`anime\` is the cel look shaded live in EEVEE, the
  bands moving with the scene's lights, with an ink outline.

## The shots

${coverage.shots.map((s) => `- ${s.span[0].toFixed(2)}–${s.span[1].toFixed(2)} s: ${s.name}`).join('\n')}

## The director's notes

${notes.length ? notes.map((n) => `- **${n.id}**${n.at !== undefined ? ` (${n.at} s)` : ''}: ${n.says} ${n.why} Try: ${n.try}`).join('\n') : 'None: the scene is free of the notes the department reads (docs/cinematics.md), which is not the same as good.'}

## The gates

- Machine: \`film_shots.py -- --verify film-gate.json\` reads every keyed camera back against the shot files.
- Eyes: yours. Render a still a shot (\`film_shots.py -- --check 1,${Math.ceil(frames / 2)},${frames}\`) and look.
`;
}
