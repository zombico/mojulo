/**
 * native — THE FILM SHOT IN MOJULO: a scene played on its set's own World page and shot there by its coverage, with no
 * other program. The page is the one a person walks (scene/scene-three.js), so what the world moves by itself is in
 * the picture with nothing written for it: a city's traffic, its signals and its people, the weather it is asked for,
 * the hour a geocube is read at. The cast is each actor's own page figure playing its scene's take (the body's act, the
 * face's performance), carried along its blocking by the rig preview's `travel` (scene/channels/rig-preview.js). The
 * Blender film (actor/scene-film.js) is the same plan lit and rendered by a renderer: the high-end outcome.
 *
 *   NATIVE                         the film's size, its frame rate, how often an actor's place is keyed
 *   nativeShots(S, coverage, { fps?, aspect?, units?, floor?, lift?, clock? }) → { frames, seconds, specs, cuts, times }
 *       specs   a camera a frame, as the page's capture takes one: { pos, target, vfov, t } in the page's units, `t`
 *               the page's clock in milliseconds (the world's `clock` at the scene's start, then the scene's own time,
 *               so a slowed line slows the street with it)
 *       cuts    [{ shot, from, frames }] where each shot starts in the frames
 *       times   the scene's time at each frame
 *   castTravel(root, { seconds, units?, floor?, lift?, clock?, fps? }) → the preview's `travel`: { from, fps, scale, keys }
 *   stageFaces(S)                  a bare stage: the floor a scene with no set is played on, as page faces
 *   nativeSet(manifest, { hour?, weather?, clouds? }) → { manifest, reads }   the set's recipe as the scene asks it
 *       shot: the weather any world's page performs, the hour and the clouds a geocube is read under
 *   nativeUnread(set, sp)          what the scene asks that this film does not perform yet, as advice
 *
 * Pure and deterministic: no clock, no dice, no IO.
 */
import { programOf, shotAt } from '../shoot/sample.js';
import { coverageCameraAt } from '../actor/scene-film.js';
import { placeOn } from '../actor/scene.js';

export const NATIVE = Object.freeze({ width: 1280, height: 720, fps: 24, travel: 24 });

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const flat = () => 0;

/** The coverage as the page's capture shoots it, a camera a frame (see the header) */
export function nativeShots(S, coverage, { fps = NATIVE.fps, aspect = NATIVE.width / NATIVE.height, units = 1, floor = 0, lift = flat, clock = 0 } = {}) {
  const program = programOf({ ...coverage, fps }), frames = Math.max(1, Math.round(program.total * fps));
  const up = (p) => [r4(p[0] / units), r4(p[1] / units), r4((p[2] + lift(p[0], p[1]) + floor) / units)];
  const specs = [], cuts = [], times = [];
  for (let f = 0; f < frames; f++) {
    const at = shotAt(program, f / fps), t = Math.min(S.seconds - 1e-6, at.t), s = coverage.shots[at.index];
    const F = coverageCameraAt(coverage, Math.min(S.seconds - 1e-6, at.camera_t ?? at.t), s).framing;
    if (!cuts.length || cuts.at(-1).index !== at.index) cuts.push({ shot: s.name, index: at.index, from: f, frames: 0 });
    cuts.at(-1).frames++;
    const h = (F.horizontalFov * Math.PI) / 180;
    specs.push({ pos: up(F.cameraPosition), target: up(F.lookAt), vfov: r4((2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI), t: Math.round((clock + t) * 1e6) / 1e3 });
    times.push(r4(t));
  }
  return { frames, seconds: r4(frames / fps), specs, cuts: cuts.map(({ index, ...c }) => c), times };
}

/** An actor's place over the scene, as the rig preview's `travel` carries a figure (see the header): yaw 0 faces +y and
 * turns clockwise, the page's turn is about +z, so it is the yaw's negative, unwrapped the short way key to key */
export function castTravel(root, { seconds, units = 1, floor = 0, lift = flat, clock = 0, fps = NATIVE.travel } = {}) {
  const n = Math.max(1, Math.ceil(seconds * fps)) + 1, keys = [];
  let turn = null;
  for (let i = 0; i < n; i++) {
    const p = placeOn(root, Math.min(seconds, i / fps)), rz = (-p.yaw * Math.PI) / 180;
    turn = turn === null ? rz : turn + Math.atan2(Math.sin(rz - turn), Math.cos(rz - turn));
    keys.push(r4(p.x / units), r4(p.y / units), r4((lift(p.x, p.y) + floor) / units), r4(turn));
  }
  return { from: clock, fps, scale: r4(1 / units), keys };
}

/** A bare stage: a floor under the cast, a little past where anyone goes (a scene with no set) */
export function stageFaces(S, { margin = 8, fill = '#8a8f98' } = {}) {
  const pts = Object.values(S.actors).flatMap((A) => A.root), xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - margin, x1 = Math.max(...xs) + margin, y0 = Math.min(...ys) - margin, y1 = Math.max(...ys) + margin;
  return [{ corners: [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]].map((c) => c.map(r4)), fill, group: 'stage' }];
}

/** The set's recipe as the scene asks it shot (see the header): what the page reads of the ask, by name */
export function nativeSet(manifest, { hour, weather, clouds } = {}) {
  const cube = manifest?.kind === 'geocube', out = { ...manifest }, reads = [];
  if (weather !== undefined) { out.weather = weather; reads.push('weather'); }
  if (cube && hour !== undefined) { out.hour = hour; reads.push('hour'); }
  if (cube && clouds !== undefined) { out.clouds = clouds; reads.push('clouds'); }
  return { manifest: reads.length ? out : manifest, reads };
}

/** What a scene asks that the film shot in mojulo does not perform yet: each said once, with what performs it */
export function nativeUnread(set, sp) {
  const cube = set?.kind === 'geocube', unread = [];
  if (sp.props && Object.keys(sp.props).length) unread.push('its props (a thing stood in the scene, or driving in)');
  if (set && sp.wind !== undefined) unread.push('its wind (the set\'s plants move as the world\'s own page moves them)');
  if (set && !cube && sp.hour !== undefined) unread.push('its hour (only a place made as a geocube is read at another hour: this set is shot in its own light)');
  if (set && !cube && sp.clouds !== undefined) unread.push('its clouds (a geocube\'s sky takes them: this set keeps its own)');
  return unread.length ? [{ id: 'native-unread', says: `the film shot in mojulo does not perform ${unread.join('; ')}`, try: 'the Blender film performs them (run: \'blender\'), or shoot the scene without them' }] : [];
}
