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
 *     each actor's as `actors/<who>.glb`, each prop's as `props/<name>.glb`)
 *     A coverage with a time map (shoot/time.js: the screenplay's slow motion and freezes, a grain) is laid on the
 *     screen's clock: the film runs its screen frames, each camera keyed at its own clock, scene.json's `clock` the
 *     scene's time each frame shows, each actor's place keyed every frame, and actors.py plays the takes through an NLA
 *     strip whose time is keyed to that clock. Without one, all is as it was.
 *     scene.json   the scene: its seconds and fps, each actor's GLB, take and place over time ([{ t, x, y, yaw }], metres,
 *                  yaw 0 facing +y), the coverage, the turns (who, when, the words)
 *     shot.json, shots/*.json, film_shots.py, film_light.py, film_render.py   the film layer (blender-film.js), a shot
 *                  each of the coverage's, each camera keyed every frame
 *     actors.py    builds the cast: each GLB imported under an empty `actor:<who>` keyed on its place and facing, its
 *                  body's act and its face's take bound and laid from frame 1, the scene's frame range set
 *     look.py      `-- --look film | anime`: the look on every actor, and the pack's `grade` (scene.json, the World
 *                  page's dials: scene/channels/grade.js) as compositor nodes
 *     SCENE.md     the operator's page, the director's notes on the scene among it (notes.js)
 *
 * The scripts are constant text (everything per scene rides scene.json and the shot files). Pure and deterministic.
 */
import { filmShot, emitBlenderFilm, BLENDER_FILM_VERSION } from '../../motion/blender-film.js';
import { directorsNotes } from './notes.js';
import { programOf, shotAt } from '../shoot/sample.js';
import { warped } from '../shoot/time.js';
import { placeOn } from './scene.js';
import { heightAt } from './relief.js';
import { setupLights } from '../film/setup-light.js';
import { EMPTY_BLEND } from '../film/render-plan.js';

/** The scene pack's revision: raised when its scripts change what a build makes, so a film's kept scenes are made again
 * (tools/film.js). 2: an empty film.blend, the hero's page left out of the cast, a bare stage where there is no set.
 * 3: a set lit as its world declares (atmosphere.json, film_light.py). 5: a scene's props (props/<name>.glb).
 * 6: ground that is not flat (a root's `z`, a prop's). 7: a prop that arrives (its `keys`). 8: a moving prop
 * turns along its way (a key's `turn`). 9: a scene's weather (atmosphere.json weather, film_light.py). */
export const SCENE_PACK_REV = 9;
/** how far apart a walk is keyed on ground that is not flat, metres */
const WALK_KEY = 0.4;

export const LOOKS = Object.freeze(['film', 'anime']);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** the coverage's camera at t: its shot's two keys eased linearly, as the shoot plan's linear path plays them (the shot
 * given, or the one whose span holds t) */
export function coverageCameraAt(coverage, t, shot = null) {
  const s = shot ?? coverage.shots.find((x) => t >= x.span[0] && t < x.span[1]) ?? coverage.shots.at(-1);
  const cam = coverage.cameras.find((c) => c.id === s.camera), ks = cam.keys.filter((k) => k.t >= s.span[0] - 1e-3 && k.t <= s.span[1] + 1e-3);
  const a = ks[0], b = ks.at(-1), u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0, lerp = (p, q) => p.map((v, i) => v + (q[i] - v) * u);
  const focal = a.focal_mm + (b.focal_mm - a.focal_mm) * u, film = cam.film_mm ?? 36;
  return { shot: s, framing: { cameraPosition: lerp(a.pos, b.pos), lookAt: lerp(a.poi, b.poi), horizontalFov: (2 * Math.atan(film / (2 * focal)) * 180) / Math.PI } };
}

/** The pack's files (see the header) */
export function sceneFilmFiles({ S, coverage, actors, fps = 24, width = 1920, height = 1080, title = 'scene', grade = null, sound = null, set = null, render = null, atmosphere = null, props = [] }) {
  // (a time map lays the film on the screen's clock: the program at the film's fps, a grain stepped at it)
  const program = coverage.shots.some(warped) ? programOf({ ...coverage, fps }) : null;
  const frames = Math.max(1, Math.round((program ? program.total : S.seconds) * fps));
  const clock = program ? Array.from({ length: frames }, (_, f) => shotAt(program, f / fps)) : null;
  // (on ground that is not flat, `set.relief`: the plan is level, so each camera is lifted by the ground under it and
  //  looks at its subject on the ground under that)
  const relief = set?.relief ?? null, lift = (x, y) => (relief ? heightAt(relief, x, y) : 0);
  const onGround = (F) => (relief ? { ...F, cameraPosition: [F.cameraPosition[0], F.cameraPosition[1], F.cameraPosition[2] + lift(F.cameraPosition[0], F.cameraPosition[1])], lookAt: [F.lookAt[0], F.lookAt[1], F.lookAt[2] + lift(F.lookAt[0], F.lookAt[1])] } : F);
  // (each shot of the coverage a film shot, its camera keyed every frame it holds)
  const shots = coverage.shots.map((s, k) => {
    const cameras = [];
    if (program) {
      const P = program.shots[k], f0 = Math.round(P.start * fps), f1 = Math.max(f0 + 1, Math.round((P.start + P.length) * fps));
      for (let f = f0; f < f1; f++) { const at = clock[Math.min(frames - 1, f)]; cameras.push(onGround(coverageCameraAt(coverage, at.camera_t ?? at.t, s).framing)); }
    } else {
      const f0 = Math.round(s.span[0] * fps), f1 = Math.max(f0 + 1, Math.round(s.span[1] * fps));
      for (let f = f0; f < f1; f++) cameras.push(onGround(coverageCameraAt(coverage, Math.min(S.seconds - 1e-6, f / fps)).framing));
    }
    return filmShot({ motionRef: `${title}-${String(k + 1).padStart(2, '0')}`, worldRef: title, title: s.name, motion: 'scene', fps, width, height, cameras, ...(render?.dof ? { dof: { fstop: render.dof } } : {}) });
  });
  // (an actor's place: its root keys on the scene's clock, or, under a time map, sampled every screen frame)
  // (on ground that is not flat, `set.relief`: its height where it stands, and a walk keyed along its way so the feet
  //  keep to the ground between the plan's keys)
  const walked = (root) => root.flatMap((k, i) => {
    const n = root[i + 1];
    if (!n || (Math.abs(n.x - k.x) < 1e-6 && Math.abs(n.y - k.y) < 1e-6)) return [k];
    const steps = Math.max(1, Math.ceil(Math.hypot(n.x - k.x, n.y - k.y) / WALK_KEY));
    return Array.from({ length: steps }, (_, s) => (s ? { ...placeOn(root, k.t + ((n.t - k.t) * s) / steps), t: k.t + ((n.t - k.t) * s) / steps } : k));
  });
  const rootOf = (who) => (clock ? clock.map((at, f) => ({ ...placeOn(S.actors[who].root, at.t), t: f / fps })) : relief ? walked(S.actors[who].root) : S.actors[who].root)
    .map((k) => ({ t: r6(k.t), x: r6(k.x), y: r6(k.y), ...(relief ? { z: r6(lift(k.x, k.y)) } : {}), yaw: r6(k.yaw) }));

  // (a set's atmosphere, blender-film.js filmAtmosphere: film_light.py lights the set by it)
  const film = emitBlenderFilm({ shot: shots[0], shots, title, ...(set && atmosphere ? { atmosphere } : {}) });
  const scene = {
    source: 'mojulo', film_version: BLENDER_FILM_VERSION, title, seconds: S.seconds, fps, frames, width, height, up: 'z', units: 'metres',
    ...(clock ? { clock: clock.map((at) => r6(at.t)) } : {}),
    ...(grade ? { grade } : {}),
    ...(sound?.audio ? { audio: sound.audio, captions: sound.captions } : {}),
    ...(sound?.dubs ? { dubs: sound.dubs } : {}),
    // (the land's heights ride each root, camera and prop: the pack does not carry the grid itself)
    ...(set ? { set: Object.fromEntries(Object.entries(set).filter(([k]) => k !== 'relief')) } : {}),
    ...(props.length ? { props } : {}),
    ...(render ? { render: Object.fromEntries(Object.entries({ samples: render.samples, motion_blur: render.motion_blur, dof: render.dof }).filter(([, v]) => v !== undefined && v !== null && v !== false)) } : {}),
    // (each setup's lights stand about its subject: on ground that is not flat they rise with it)
    ...(render?.light === 'setups' ? { lights: setupLights({ S, coverage, shots }).map((L) => { const dz = lift(L.subject[0], L.subject[1]), up = (p) => [p[0], p[1], r6(p[2] + dz)]; return relief ? { ...L, subject: up(L.subject), key: { ...L.key, pos: up(L.key.pos) }, fill: { ...L.fill, pos: up(L.fill.pos) }, rim: { ...L.rim, pos: up(L.rim.pos) } } : L; }) } : {}),
    actors: Object.fromEntries(Object.entries(actors).map(([who, A]) => [who, { glb: `actors/${who}.glb`, act: `act:${A.take}`, face: `face:${A.take}`, root: rootOf(who) }])),
    turns: S.turns.map((T) => ({ who: T.who, at: T.at, end: T.end, text: T.text, ...(T.recording ? { recording: T.recording } : {}) })),
    coverage,
  };
  return [
    { file: 'scene.json', text: `${JSON.stringify(scene, null, 2)}\n` },
    ...film.files.filter((f) => f.file !== 'FILM.md'),
    { file: 'actors.py', text: actorsPy() },
    { file: 'look.py', text: lookPy() },
    ...(set ? [{ file: 'set.py', text: setPy() }] : []),
    ...(render?.light === 'setups' ? [{ file: 'light.py', text: lightPy() }] : []),
    ...(sound?.dubs ? [{ file: 'dub.py', text: dubPy() }] : []),
    { file: 'SCENE.md', text: sceneReadme({ title, S, coverage, frames, fps, grade, notes: directorsNotes(S, coverage), shotFiles: film.files.filter((f) => f.file.startsWith('shots/')).map((f) => f.file), sound, set, render }) },
  ];
}

/** set.py — constant text: the set's world (its pack under set/, built into film.blend by its own import_mojulo.py)
 * lowered by the floor under the cast's marks, its root renamed so nothing takes it for an actor's */
export function setPy() {
  return String.raw`"""
set.py - a mojulo scene's set into Blender (mojulo scene film v${BLENDER_FILM_VERSION}).

The set is a mojulo world's own Blender pack (set/). Its import_mojulo.py builds film.blend first; this script then
lowers the world by the floor under the cast's marks (scene.json set.floor, metres) so they stand on it, and names its
root set:root. Run it once, after the set's import and before actors.py:

  blender -b --python set/import_mojulo.py -- --mode run --blend film.blend
  blender -b film.blend --python set.py
"""
import bpy
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    with open(os.path.join(HERE, 'scene.json')) as f:
        S = json.load(f)
    st = S.get('set') or {}
    root = bpy.data.objects.get('set:root') or bpy.data.objects.get('mojulo')
    if root is None:
        raise SystemExit('[mojulo set] no world root (run set/import_mojulo.py first)')
    if root.name != 'set:root':
        root.name = 'set:root'
        root.location.z -= float(st.get('floor', 0.0))
    print('[mojulo set] %s on its floor (%.3f m)' % (st.get('ref', 'the set'), float(st.get('floor', 0.0))))
    bpy.ops.wm.save_mainfile()


main()
`;
}

/** light.py — constant text: each shot lit as its setup (scene.json lights: film/setup-light.js), a key, a fill and a
 * rim of area lights, aimed at the shot's subject, each keyed at its shot's first frame and held through it (constant:
 * the lights jump on the cut, as a crew relights a setup) */
export function lightPy() {
  return String.raw`"""
light.py - a mojulo scene lit per setup (mojulo scene film v${BLENDER_FILM_VERSION}).

Each shot of the coverage its own key (on the short side of the face), fill (across the lens) and rim (from behind),
in the cast rig's colours (scene.json lights), as three area lights aimed at the shot's subject and keyed at the shot's
first frame, holding to the next cut. Run it once, after film_shots.py:

  blender -b film.blend --python light.py
"""
import bpy
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def srgb(hexstr):
    h = hexstr.lstrip('#')
    return tuple(((int(h[i:i + 2], 16) / 255.0) ** 2.2) for i in (0, 2, 4))


def fcurves_of(act):
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


def held(idb):
    ad = getattr(idb, 'animation_data', None)
    if ad and ad.action:
        for fc in fcurves_of(ad.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def main():
    with open(os.path.join(HERE, 'scene.json')) as f:
        S = json.load(f)
    setups = S.get('lights') or []
    if not setups:
        raise SystemExit('[mojulo light] scene.json has no lights (the pack was written without render.light = setups)')
    sc = bpy.context.scene
    coll = bpy.data.collections.get('mojulo-light') or bpy.data.collections.new('mojulo-light')
    if coll.name not in sc.collection.children:
        sc.collection.children.link(coll)
    aim = bpy.data.objects.get('light:subject') or bpy.data.objects.new('light:subject', None)
    if aim.name not in coll.objects:
        coll.objects.link(aim)
    lamps = {}
    for role in ('key', 'fill', 'rim'):
        name = 'light:%s' % role
        ob = bpy.data.objects.get(name)
        if ob is None:
            ob = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA'))
            coll.objects.link(ob)
            track = ob.constraints.new('TRACK_TO')
            track.target = aim
            track.track_axis = 'TRACK_NEGATIVE_Z'
            track.up_axis = 'UP_Y'
        lamps[role] = ob
    for L in setups:
        fr = int(L['frame'])
        aim.location = L['subject']
        aim.keyframe_insert('location', frame=fr)
        for role, ob in lamps.items():
            spec = L[role]
            ob.location = spec['pos']
            ob.keyframe_insert('location', frame=fr)
            ob.data.energy = float(spec['energy'])
            ob.data.color = srgb(spec['color'])
            ob.data.size = float(spec.get('size', 1.0))
            ob.data.keyframe_insert('energy', frame=fr)
            ob.data.keyframe_insert('color', frame=fr)
    for ob in [aim, *lamps.values()]:
        held(ob)
        if ob.data is not None:
            held(ob.data)
    print('[mojulo light] %d setups lit (key, fill, rim)' % len(setups))
    bpy.ops.wm.save_mainfile()


main()
`;
}

/** dub.py — constant text: each actor's face given a locale's dub take (face:dub-<locale>), or back to the scene's */
export function dubPy() {
  return String.raw`"""
dub.py - a mojulo scene dubbed to picture (mojulo scene film v${BLENDER_FILM_VERSION}).

Each actor's face plays the locale's take (face:dub-<locale>: the same acting, the mouth on the dub's recording), the
body and the cameras unchanged. --locale none gives the scene's own take back. Render the locale's sound with
film_render.py -- --locale <locale>.

  blender -b film.blend --python dub.py -- --locale fr
"""
import bpy
import sys

def _opt(name):
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else None


def target_of(name, locale):
    """the face action a locale plays, keeping the import's suffix (face:scene.001 -> face:dub-fr.001)"""
    base, dot, suffix = name.partition('.')
    want = ('face:scene' if locale == 'none' else 'face:dub-%s' % locale) + (dot + suffix if dot else '')
    return bpy.data.actions.get(want)


def assign(holder, act):
    holder.action = act
    if hasattr(holder, 'action_slot') and getattr(act, 'slots', None):
        holder.action_slot = act.slots[0]


def main():
    locale = _opt('--locale')
    if not locale:
        raise SystemExit('dub.py -- --locale <locale> | none')
    done = 0
    for key in bpy.data.shape_keys:
        ad = key.animation_data
        if ad is None:
            continue
        if ad.action is not None and ad.action.name.startswith('face:'):
            act = target_of(ad.action.name, locale)
            if act is not None:
                assign(ad, act)
                done += 1
        for track in ad.nla_tracks:
            for strip in track.strips:
                if strip.action is not None and strip.action.name.startswith('face:'):
                    act = target_of(strip.action.name, locale)
                    if act is not None:
                        assign(strip, act)
                        done += 1
    print('[mojulo dub] %s: %d faces' % (locale, done))
    # (no face took the locale's take: the picture would be the original's under the dub's sound, so say so and stop)
    if not done:
        raise SystemExit('[mojulo dub] no face in this file has a take for %r (face:dub-%s): build film.blend again (actors.py)' % (locale, locale))
    bpy.ops.wm.save_mainfile()


main()
`;
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
from mathutils import Vector

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


def remap(owner, name, clock, fps):
    """Play an owner's bound action through an NLA strip whose time is keyed to the scene's clock (scene.json clock:
    the scene's time each screen frame shows, under a time map): slow motion, a freeze, the world on twos."""
    ad = owner.animation_data
    act = bpy.data.actions.get(name)
    if ad is None or act is None:
        return
    ad.action = None
    track = ad.nla_tracks.new()
    track.name = 'time map'
    start = act.frame_range[0]
    strip = track.strips.new(name, int(start), act)
    if hasattr(strip, 'action_slot') and getattr(act, 'slots', None):
        strip.action_slot = act.slots[0]
    strip.extrapolation = 'HOLD'
    end = 1 + len(clock)
    if strip.frame_end < end:
        if hasattr(strip, 'frame_end_ui'):
            strip.frame_end_ui = end
        else:
            strip.frame_end = end
    strip.use_animated_time = True
    for i, t in enumerate(clock):
        strip.strip_time = start + t * fps
        strip.keyframe_insert('strip_time', frame=1 + i)
    for fc in strip.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


def carried(o):
    """Whether an armature carries an object: skinned to one, or hung under one (a thing held on a bone)."""
    if any(m.type == 'ARMATURE' for m in o.modifiers):
        return True
    p = o.parent
    while p is not None:
        if p.type == 'ARMATURE':
            return True
        p = p.parent
    return False


def principled(idb, colour, strength=None):
    """A material's or a world's first shader given a colour (a world's a strength too), its nodes on."""
    try:
        idb.use_nodes = True
    except Exception:
        pass
    for n in idb.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs['Base Color'].default_value = colour
            n.inputs['Roughness'].default_value = 0.9
        if n.type == 'BACKGROUND':
            n.inputs['Color'].default_value = colour
            n.inputs['Strength'].default_value = strength


def stage(S):
    """A scene with no set plays on a BARE STAGE: a matte floor out past the widest shot, a soft even sky and, unless
    each setup is lit (light.py), one key from the camera's side. Made once; a set brings its own floor and light."""
    if S.get('set') or bpy.data.objects.get('stage:floor') is not None:
        return
    sc = bpy.context.scene
    r = 200.0
    me = bpy.data.meshes.new('stage:floor')
    me.from_pydata([(-r, -r, 0.0), (r, -r, 0.0), (r, r, 0.0), (-r, r, 0.0)], [], [(0, 1, 2, 3)])
    mat = bpy.data.materials.new('stage:floor')
    principled(mat, (0.30, 0.31, 0.33, 1.0))
    me.materials.append(mat)
    sc.collection.objects.link(bpy.data.objects.new('stage:floor', me))
    if sc.world is None:
        sc.world = bpy.data.worlds.new('stage:sky')
        principled(sc.world, (0.62, 0.66, 0.72, 1.0), 0.7)
    if not S.get('lights'):
        key = bpy.data.objects.new('stage:key', bpy.data.lights.new('stage:key', 'SUN'))
        key.data.energy = 3.0
        key.data.angle = math.radians(6.0)
        key.rotation_euler = (math.radians(52.0), 0.0, math.radians(-38.0))
        sc.collection.objects.link(key)
    log('a bare stage: its floor, its sky%s' % ('' if S.get('lights') else ', its key'))


def house(S):
    """A walled set with no light of its own (a room of a house: no sky reaches it, no lamp is declared) is lit as a
    studio lights a room: one soft panel under each ceiling, the HOUSE LIGHTS (scene.json set.house). Made once."""
    for i, H in enumerate((S.get('set') or {}).get('house') or []):
        name = 'house:%d' % (i + 1)
        if bpy.data.objects.get(name) is not None:
            continue
        lamp = bpy.data.lights.new(name, 'AREA')
        lamp.shape = 'RECTANGLE'
        lamp.size, lamp.size_y = float(H['size'][0]), float(H['size'][1])
        lamp.energy = float(H['watts'])
        lamp.color = tuple(H.get('color') or (1.0, 0.94, 0.86))
        ob = bpy.data.objects.new(name, lamp)
        ob.location = tuple(float(v) for v in H['at'])
        bpy.context.scene.collection.objects.link(ob)
        log('%s: %d W under the ceiling' % (name, round(lamp.energy)))


def props(S):
    """The scene's PROPS (scene.json props): each a thing mojulo made, its own model, stood where the plan stood it. Its
    size is the one it was read at (dims, metres, before its turn), whatever unit its model came in; its middle is over
    its place, its lowest point on the floor, turned clockwise from above. Made once."""
    for Q in S.get('props') or []:
        name = 'prop:%s' % Q['name']
        if bpy.data.objects.get(name) is not None:
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, Q['glb']))
        new = [o for o in bpy.data.objects if o not in before]
        # (a thing's page brings its view cameras and its lights: the film has its own)
        for o in [o for o in new if o.type in ('CAMERA', 'LIGHT')]:
            new.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
        holder = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(holder)
        for o in new:
            if o.parent is None:
                o.parent = holder
            if o.name.startswith('mojulo'):
                o.name = '%s:root' % name
        bpy.context.view_layer.update()
        lo, hi = [1e30] * 3, [-1e30] * 3
        for o in new:
            if o.type != 'MESH':
                continue
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                for i in range(3):
                    lo[i], hi[i] = min(lo[i], w[i]), max(hi[i], w[i])
        if lo[0] > hi[0]:
            log('%s: no mesh in %s' % (name, Q['glb']))
            continue
        # (the size: by its longest side, so a model in millimetres or with no unit stands at the plan's)
        ext, dims = [hi[i] - lo[i] for i in range(3)], [float(v) for v in Q['dims']]
        ax = max(range(3), key=lambda i: dims[i])
        k = dims[ax] / ext[ax] if ext[ax] > 1e-9 else 1.0
        a = -math.radians(float(Q.get('turn', 0.0)))
        cx, cy = k * (lo[0] + hi[0]) / 2.0, k * (lo[1] + hi[1]) / 2.0
        holder.scale = (k, k, k)
        holder.rotation_euler = (0.0, 0.0, a)
        def place(x, y, z, a):
            return (float(x) - (cx * math.cos(a) - cy * math.sin(a)), float(y) - (cx * math.sin(a) + cy * math.cos(a)), float(z) - k * lo[2])
        holder.location = place(Q['at'][0], Q['at'][1], Q.get('z', 0.0), a)
        # (a thing that MOVES, scene.json props keys: it goes along its way on the scene's clock, facing along it, and
        #  rests at its place)
        for K in Q.get('keys') or []:
            ka = -math.radians(float(K['turn'])) if 'turn' in K else a
            holder.rotation_euler = (0.0, 0.0, ka)
            holder.location = place(K['x'], K['y'], K.get('z', 0.0), ka)
            frame = 1 + float(K['t']) * float(S['fps'])
            holder.keyframe_insert('location', frame=frame)
            holder.keyframe_insert('rotation_euler', frame=frame)
        if Q.get('keys') and holder.animation_data and holder.animation_data.action:
            for fc in fcurves_of(holder.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
        log('%s: %.2f x %.2f x %.2f m at [%.2f, %.2f]' % (name, k * ext[0], k * ext[1], k * ext[2], float(Q['at'][0]), float(Q['at'][1])))


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
        # (a hero's GLB brings its page with it: the page's view cameras and the ground it stands on. The film has its
        #  own cameras and its own floor, the set's or the stage's, so they go. A mesh no armature carries is the page's;
        #  a thing the hero holds hangs under a bone and stays.)
        if any(o.type == 'ARMATURE' for o in new):
            for o in [o for o in new if o.type == 'CAMERA' or (o.type == 'MESH' and not carried(o))]:
                new.remove(o)
                bpy.data.objects.remove(o, do_unlink=True)
        mine = sorted([a for a in bpy.data.actions if a not in had], key=lambda a: a.name)
        # (every take stays in the file: binding one clears the NLA that held the others, and Blender saves no
        #  action that nothing uses, so a dub's faces, face:dub-<locale>, would be gone when dub.py asks for them)
        for a in mine:
            a.use_fake_user = True
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
            holder.location = (k['x'], k['y'], float(k.get('z', 0.0)))
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
                bound.append((o, bind(o, A['act'], 'pose.bones', mine)))
            if o.type == 'MESH' and o.data.shape_keys is not None:
                bound.append((o.data.shape_keys, bind(o.data.shape_keys, A['face'], 'key_blocks', mine)))
        if S.get('clock'):
            for owner, b in bound:
                if b:
                    remap(owner, b, S['clock'], fps)
        log('%s: %d objects, bound %s%s' % (name, len(new), [b for _, b in bound if b], ' on the time map' if S.get('clock') else ''))
    props(S)
    stage(S)
    house(S)
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
import json
import os

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


def load_grade():
    """The pack's grade (scene.json grade), or None."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scene.json')
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f).get('grade')


def grade_tree(sc):
    """The scene's compositor tree: Blender 5 a node group the scene names, Blender 4 the scene's own."""
    if hasattr(sc, 'compositing_node_group'):
        tree = sc.compositing_node_group or bpy.data.node_groups.new('mojulo grade', 'CompositorNodeTree')
        sc.compositing_node_group = tree
        return tree, True
    sc.use_nodes = True
    return sc.node_tree, False


def grade(sc, G):
    """The pack's grade (scene.json grade: the World page's dials, scene/channels/grade.js) as compositor nodes: the
    exposure, the contrast, the saturation, the warmth as a colour balance, the aberration as the lens's dispersion, the
    vignette and the bars as masks. The grain, the zoom, the flash and a moment's look are the page's alone. A node the
    running Blender does not take is named in the log and left out (advisory)."""
    tree, group = grade_tree(sc)
    nodes, links = tree.nodes, tree.links
    for n in list(nodes):
        nodes.remove(n)
    rl = nodes.new('CompositorNodeRLayers')
    cur = [rl.outputs[0]]
    made, missed = [], []

    def step(kind, what, setup, inp=0):
        try:
            n = nodes.new(kind)
            links.new(cur[0], n.inputs[inp])
            setup(n)
            cur[0] = n.outputs[0]
            made.append(what)
        except Exception as e:  # (a node or socket another Blender names otherwise)
            missed.append('%s (%s)' % (what, e))

    def set_in(n, names, v):
        for name in names:
            if name in n.inputs:
                n.inputs[name].default_value = v
                return
        raise KeyError('no input %s' % '/'.join(names))

    def multiply_by(mask_kind, what, mask_setup, fac):
        try:
            m = nodes.new(mask_kind)
            mask_setup(m)
            b = nodes.new('CompositorNodeBlur')
            b.size_x = b.size_y = 200
            b.use_relative = False
            links.new(m.outputs[0], b.inputs[0])
            mix = nodes.new('CompositorNodeMixRGB')
            mix.blend_type = 'MULTIPLY'
            mix.inputs[0].default_value = fac
            links.new(cur[0], mix.inputs[1])
            links.new(b.outputs[0], mix.inputs[2])
            cur[0] = mix.outputs[0]
            made.append(what)
        except Exception as e:
            missed.append('%s (%s)' % (what, e))

    if G.get('exposure'):
        step('CompositorNodeExposure', 'exposure', lambda n: set_in(n, ['Exposure'], G['exposure']))
    if 'contrast' in G:
        step('CompositorNodeBrightContrast', 'contrast', lambda n: set_in(n, ['Contrast'], (G['contrast'] - 1) * 100))
    if 'saturation' in G:
        step('CompositorNodeHueSat', 'saturation', lambda n: set_in(n, ['Saturation'], G['saturation']), inp='Image')
    if G.get('warmth'):
        w = G['warmth']

        def warm(n):
            n.correction_method = 'LIFT_GAMMA_GAIN'
            n.gain = (1 + 0.15 * w, 1.0, 1 - 0.15 * w)
            n.lift = (1 - 0.05 * w, 1.0, 1 + 0.05 * w)
        step('CompositorNodeColorBalance', 'warmth', warm, inp='Image')
    if G.get('aberration'):
        step('CompositorNodeLensdist', 'aberration', lambda n: set_in(n, ['Dispersion'], min(1.0, G['aberration'] / 60.0)), inp='Image')
    if G.get('vignette'):
        def ellipse(m):
            m.width, m.height = 1.15, 1.15
        multiply_by('CompositorNodeEllipseMask', 'vignette', ellipse, G['vignette'])
    if G.get('bars'):
        def box(m):
            m.width, m.height = 2.0, 1.0 - 2 * G['bars']
        try:
            m = nodes.new('CompositorNodeBoxMask')
            box(m)
            mix = nodes.new('CompositorNodeMixRGB')
            mix.blend_type = 'MULTIPLY'
            links.new(cur[0], mix.inputs[1])
            links.new(m.outputs[0], mix.inputs[2])
            cur[0] = mix.outputs[0]
            made.append('bars')
        except Exception as e:
            missed.append('bars (%s)' % e)
    if group:
        out = nodes.new('NodeGroupOutput')
        if not any(s.in_out == 'OUTPUT' for s in tree.interface.items_tree):
            tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        links.new(cur[0], out.inputs[0])
    else:
        links.new(cur[0], nodes.new('CompositorNodeComposite').inputs[0])
    log('the grade: %s%s' % (', '.join(made) or 'nothing', ('; left out: ' + '; '.join(missed)) if missed else ''))


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
    G = load_grade()
    if G:
        grade(sc, G)


if __name__ == '__main__':
    main()
`;
}

/** SCENE.md — the operator's page */
export function sceneReadme({ title, S, coverage, frames, fps, grade = null, notes = [], shotFiles, sound = null, set = null, render = null }) {
  return `# ${title} — a mojulo scene for Blender

${Object.keys(S.actors).length} actors, ${S.seconds} s (${frames} frames at ${fps} fps), ${coverage.shots.length} shots on ${coverage.cameras.length} cameras.${coverage.shots.some(warped) ? `
The scene plays on a time map (its slow motion, its freezes${coverage.shots.some((s) => s.grain) ? ', the world on twos' : ''}): ${S.seconds} s of the scene in ${frames} frames on screen. \`scene.json\`'s \`clock\` is the scene's time each frame shows; \`actors.py\` plays each take through an NLA strip keyed to it.` : ''}

## Build it (once, in an empty film.blend beside these files)

${set ? `    <blender> -b --python set/import_mojulo.py -- --mode run --blend film.blend
    <blender> -b film.blend --python set.py
    <blender> -b film.blend --python film_light.py -- --root set:root` : `    <blender> -b --python-expr "${EMPTY_BLEND}"`}
    <blender> -b film.blend --python actors.py --python-expr "import bpy; bpy.ops.wm.save_mainfile()"
    <blender> -b film.blend --python film_shots.py -- --root none ${shotFiles.length ? shotFiles.map((f) => `--shot ${f}`).join(' ') : ''}${render?.light === 'setups' ? `
    <blender> -b film.blend --python light.py` : ''}
    <blender> -b film.blend --python look.py -- --look film      # or --look anime
    <blender> -b film.blend --python film_render.py
${sound?.dubs ? `
A dub (${Object.keys(sound.dubs).join(', ')}), to picture: the faces take the locale's mouths, then its sound renders with them.

${Object.keys(sound.dubs).map((L) => `    <blender> -b film.blend --python dub.py -- --locale ${L} && <blender> -b film.blend --python film_render.py -- --locale ${L}`).join('\n')}
    <blender> -b film.blend --python dub.py -- --locale none      # the scene's own faces again
` : ''}
Or open film.blend and run ${set ? 'set.py, ' : ''}actors.py, film_shots.py and look.py from the Scripting tab, in that order.
${set ? `
The set is the world ${set.ref}${set.title ? ` (${set.title})` : ''}: its own Blender pack under \`set/\` (its README says what it is), lowered
${set.floor} m so the cast stands on its floor.
` : ''}${sound?.audio ? `
The voice: \`${sound.audio}\`, every recorded line at its moment on the screen's clock; \`film_render.py\` lays it under
the film (its \`--audio\` takes another). The captions: \`${sound.captions}\`.${sound.dubs ? ` Each dub's: ${Object.entries(sound.dubs).map(([L, D]) => `\`${D.audio}\` and \`${D.captions}\` (${L})`).join(', ')}.` : ''}
` : ''}
## What is here

- \`actors/<who>.glb\`: each actor's hero, skinned, its body's take \`act:scene\` and its face's \`face:scene\` on the scene's
  clock (the act's \`moj:act\` extras carry its place over time too). \`actors.py\` hangs each under an empty
  \`actor:<who>\` keyed on that place and facing.
- \`props/<name>.glb\`, where the scene has props: each thing stood in it, its own model. \`actors.py\` stands each under
  an empty \`prop:<name>\` at its place, its turn and the size the plan read it at (\`scene.json\` \`props\`).
- \`scene.json\`: the scene (the actors, their places, the lines, the coverage). \`shot.json\` and \`shots/\`: the
  coverage's cameras, each shot keyed every frame, cut at markers by \`film_shots.py\`.
- \`look.py\`: the look. \`film\` is the production look in Cycles; \`anime\` is the cel look shaded live in EEVEE, the
  bands moving with the scene's lights, with an ink outline.${grade ? ` It also builds the grade (\`scene.json\`'s \`grade\`: ${Object.entries(grade).map(([k, v]) => `${k} ${v}`).join(', ')}) as compositor
  nodes; a node the running Blender does not take is named in its log and left out.` : ''}

## The shots

${coverage.shots.map((s) => `- ${s.span[0].toFixed(2)}–${s.span[1].toFixed(2)} s: ${s.name}${s.time ? ` (${s.time.map((m) => (m.span ? `slowed to ${m.speed} over ${m.span[0]}–${m.span[1]} s` : `held ${m.hold} s at ${m.at} s`)).join(', ')})` : ''}`).join('\n')}

## The director's notes

${notes.length ? notes.map((n) => `- **${n.id}**${n.at !== undefined ? ` (${n.at} s)` : ''}: ${n.says} ${n.why} Try: ${n.try}`).join('\n') : 'None: the scene is free of the notes the department reads (docs/cinematics.md), which is not the same as good.'}

## The gates

- Machine: \`film_shots.py -- --verify film-gate.json\` reads every keyed camera back against the shot files.
- Eyes: yours. Render a still a shot (\`film_shots.py -- --check 1,${Math.ceil(frames / 2)},${frames}\`) and look.
`;
}
