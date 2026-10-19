/**
 * Shoot plan — the sampler. Turns a NORMALIZED plan (plan.js `normalizeShoot`) into cameras at times.
 *
 * The model is After Effects' keyframe model, kept small:
 *   - TEMPORAL: each segment between two keys runs a 1-D cubic timing curve. A linear side has its handle on the
 *     diagonal; an eased side (AE's Easy Ease: speed 0, influence 1/3) has it flat. `easy_ease` eases both sides of
 *     its key, `easy_ease_in` the arrival, `easy_ease_out` the departure; `hold` freezes until the next key.
 *   - SPATIAL: `pos` and `poi` travel along the segment's curve (Catmull-Rom through the keys, or straight with
 *     `path: 'linear'`) by ARC LENGTH, so linear timing is constant speed and a dot per frame shows the ease.
 *   - `focal_mm`, `yaw`, `pitch`, `roll` follow the same eased fraction.
 *   - FOLLOW: a key's `pos` or `poi` may name a moving subject (subjects.js) instead of a point. Times are the world
 *     clock's, so a followed subject is read at the instant being sampled; a segment with a followed end blends its
 *     two ends, each read at that instant, by the eased fraction (a fixed key easing onto a moving car, or off it).
 *
 * A sampled camera is `{ pos, look, hfov, roll }`; `frameOf` wraps it as the `worldFraming` every camera consumer
 * already reads. Pure and deterministic: no clock, no dice.
 */
import { catmullRom, lerp, lerp3 } from '../../motion/easing.js';
import { hfovForFocal } from './lens.js';
import { followPoint } from './subjects.js';

const EASE_INF = 1 / 3;   // AE's Easy Ease influence
const ARC_STEPS = 32;     // arc-length table resolution per segment
const AIM_M = 10;         // a one-node camera's look point sits this far down its view axis

const easesOut = (e) => e === 'easy_ease' || e === 'easy_ease_out';
const easesIn = (e) => e === 'easy_ease' || e === 'easy_ease_in';

/**
 * The eased fraction of a segment at linear fraction u: a cubic bezier (0,0)–(x1,y1)–(x2,y2)–(1,1) solved for x = u.
 * With both sides linear it is the identity.
 */
export function easeFraction(u, outEased, inEased) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const x1 = EASE_INF, y1 = outEased ? 0 : EASE_INF, x2 = 1 - EASE_INF, y2 = inEased ? 1 : 1 - EASE_INF;
  if (!outEased && !inEased) return u;
  const bx = (s) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
  const by = (s) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
  // x(s) is monotone for these handles: bisection is exact enough and never diverges
  let lo = 0, hi = 1, s = u;
  for (let i = 0; i < 48; i++) {
    s = (lo + hi) / 2;
    if (bx(s) < u) lo = s; else hi = s;
  }
  return by((lo + hi) / 2);
}

// a point on segment i of a key channel at curve parameter s ∈ [0,1]
function curvePoint(pts, i, s, smooth) {
  const b = pts[i], c = pts[i + 1];
  if (!smooth) return lerp3(b, c, s);
  const a = pts[Math.max(0, i - 1)], d = pts[Math.min(pts.length - 1, i + 2)];
  return [0, 1, 2].map((k) => catmullRom(a[k], b[k], c[k], d[k], s));
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// arc-length table of segment i: cumulative length at ARC_STEPS + 1 evenly spaced curve parameters
function arcTable(pts, i, smooth) {
  const acc = [0];
  let prev = curvePoint(pts, i, 0, smooth);
  for (let j = 1; j <= ARC_STEPS; j++) {
    const p = curvePoint(pts, i, j / ARC_STEPS, smooth);
    acc.push(acc[j - 1] + dist(prev, p));
    prev = p;
  }
  return acc;
}

// the point a fraction f of the way along segment i BY LENGTH
function alongArc(pts, i, table, f, smooth) {
  const L = table[ARC_STEPS];
  if (!(L > 1e-9)) return pts[i].slice();
  const target = f * L;
  let j = 1;
  while (j < ARC_STEPS && table[j] < target) j++;
  const a = table[j - 1], b = table[j];
  const s = (j - 1 + (b > a ? (target - a) / (b - a) : 0)) / ARC_STEPS;
  return curvePoint(pts, i, s, smooth);
}

const fixed = (v) => Array.isArray(v);

/** Compile a normalized camera once (arc tables per fixed segment); `cameraAt` reads it. `subjects` (subjects.js
 * `shootSubjects`) resolves the keys that follow something; a camera that follows nothing needs none. */
export function compileCamera(cam, { subjects = null } = {}) {
  const smooth = cam.path !== 'linear';
  const at = (v, t) => (fixed(v) ? v : followPoint(v, subjects, t));
  // control points: a followed key stands where its subject is at the key's own time
  const pos = cam.keys.map((k) => at(k.pos, k.t));
  const poi = cam.type === 'two_node' ? cam.keys.map((k) => at(k.poi, k.t)) : null;
  const segs = [];
  for (let i = 0; i + 1 < cam.keys.length; i++) {
    const k0 = cam.keys[i], k1 = cam.keys[i + 1];
    const dynPos = !fixed(k0.pos) || !fixed(k1.pos), dynPoi = poi ? !fixed(k0.poi) || !fixed(k1.poi) : false;
    segs.push({ dynPos, dynPoi, pos: dynPos ? null : arcTable(pos, i, smooth), poi: poi && !dynPoi ? arcTable(poi, i, smooth) : null });
  }
  return { cam, smooth, pos, poi, segs, at };
}

function aimPoint(pos, yaw, pitch) {
  const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180;
  return [pos[0] + AIM_M * Math.cos(p) * Math.cos(y), pos[1] + AIM_M * Math.cos(p) * Math.sin(y), pos[2] + AIM_M * Math.sin(p)];
}

// a key held (before the first, after the last, through a hold): a followed end keeps following at time t
function keyCamera(compiled, k, t) {
  const { cam } = compiled;
  const pos = compiled.at(k.pos, t).slice();
  return {
    pos,
    look: cam.type === 'two_node' ? compiled.at(k.poi, t).slice() : aimPoint(pos, k.yaw, k.pitch),
    hfov: hfovForFocal(k.focal_mm, cam.film_mm),
    roll: k.roll,
  };
}

/** The camera `{ pos, look, hfov, roll }` at camera-local time t (seconds), clamped to the first and last key. */
export function cameraAt(compiled, t) {
  const { cam, smooth } = compiled;
  const keys = cam.keys;
  if (keys.length === 1 || t <= keys[0].t) return keyCamera(compiled, keys[0], t);
  const last = keys.length - 1;
  if (t >= keys[last].t) return keyCamera(compiled, keys[last], t);
  let i = 0;
  while (i + 1 < last && keys[i + 1].t <= t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  if (k0.ease === 'hold') return keyCamera(compiled, k0, t);
  const f = easeFraction((t - k0.t) / (k1.t - k0.t), easesOut(k0.ease), easesIn(k1.ease));
  const seg = compiled.segs[i];
  const pos = seg.dynPos ? lerp3(compiled.at(k0.pos, t), compiled.at(k1.pos, t), f) : alongArc(compiled.pos, i, seg.pos, f, smooth);
  const yaw = lerp(k0.yaw, k1.yaw, f), pitch = lerp(k0.pitch, k1.pitch, f);
  const look = cam.type !== 'two_node' ? aimPoint(pos, yaw, pitch)
    : seg.dynPoi ? lerp3(compiled.at(k0.poi, t), compiled.at(k1.poi, t), f) : alongArc(compiled.poi, i, seg.poi, f, smooth);
  return { pos, look, hfov: hfovForFocal(lerp(k0.focal_mm, k1.focal_mm, f), cam.film_mm), roll: lerp(k0.roll, k1.roll, f) };
}

/** The edit's running order: each shot's start on the program clock, and the program's length. */
export function programOf(plan) {
  let at = 0;
  // a cued shot (`cue`: it plays when an event fires, in a live world) has no place in the running order
  const shots = plan.shots.filter((s) => !s.cue).map((s) => {
    // a shot's length on the program clock: its span of the world, stretched by its speed
    const row = { ...s, start: at, length: (s.span[1] - s.span[0]) / (s.speed || 1) };
    at += row.length;
    return row;
  });
  return { shots, total: at };
}

/** Which shot plays at program time τ, and the camera-local time inside it. */
export function shotAt(program, tau) {
  const { shots, total } = program;
  const x = Math.max(0, Math.min(total, tau));
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1].start <= x) i++;
  const s = shots[i];
  return { shot: s, index: i, t: s.span[0] + Math.min(s.span[1] - s.span[0], (x - s.start) * (s.speed || 1)) };
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r4v = (v) => v.map(r4);

/** The camera as a `worldFraming` frame (the shape `lib/motion/camera-path.js` emits), rounded for stable bytes. */
export function frameOf(c) {
  return { worldFraming: { cameraPosition: r4v(c.pos), lookAt: r4v(c.look), horizontalFov: r4(c.hfov) }, roll: r4(c.roll) };
}

/**
 * The program sampled at the plan's fps (or `fps`): one frame per tick from 0 to the end, the last frame on the
 * final instant. Each frame names its shot and camera, its time on the edit (`t`) and the world clock it shows
 * (`world_t`: the camera's own time, which every moving thing in the world must be stepped to). This array is what a
 * renderer (world-motion, Blender) eats.
 */
export function sampleProgram(plan, { fps = plan.fps, subjects = null } = {}) {
  const program = programOf(plan);
  const compiled = new Map(plan.cameras.map((c) => [c.id, compileCamera(c, { subjects })]));
  const n = Math.max(1, Math.round(program.total * fps) + 1);
  const frames = [];
  for (let j = 0; j < n; j++) {
    const tau = Math.min(program.total, j / fps);
    const at = shotAt(program, tau);
    frames.push({ ...frameOf(cameraAt(compiled.get(at.shot.camera), at.t)), shot: at.shot.name, camera: at.shot.camera, t: r4(tau), world_t: r4(at.t) });
  }
  return frames;
}

/**
 * A camera's key range sampled at fps (camera-local time), for drawing: the dot per frame along the path and the
 * per-frame view the World page's body rides. Positions, look points, hfov and roll in flat arrays.
 */
export function sampleCameraTrack(cam, fps, { subjects = null } = {}) {
  const compiled = compileCamera(cam, { subjects });
  const t0 = cam.keys[0].t, t1 = cam.keys[cam.keys.length - 1].t;
  const n = Math.max(1, Math.round((t1 - t0) * fps) + 1);
  const pos = [], look = [], hfov = [], roll = [];
  for (let j = 0; j < n; j++) {
    const c = cameraAt(compiled, Math.min(t1, t0 + j / fps));
    pos.push(...r4v(c.pos)); look.push(...r4v(c.look)); hfov.push(r4(c.hfov)); roll.push(r4(c.roll));
  }
  return { t0, t1, fps, n, pos, look, hfov, roll };
}

/** The camera's path as a dense polyline through its keys (the curve itself, independent of timing). Fixed keys
 * only: a camera that follows something has no path apart from its timing, so its track is its path. */
export function pathPolyline(cam, channel = 'pos', { per = 16, subjects = null } = {}) {
  const compiled = compileCamera(cam, { subjects });
  const pts = channel === 'poi' ? compiled.poi : compiled.pos;
  if (!pts) return [];
  if (pts.length === 1) return [r4v(pts[0])];
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    for (let j = 0; j < per; j++) out.push(r4v(curvePoint(pts, i, j / per, compiled.smooth)));
  }
  out.push(r4v(pts[pts.length - 1]));
  return out;
}
