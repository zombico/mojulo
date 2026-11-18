/**
 * Shoot plan — the FRAME READ: what a camera puts in its frame, in a cinematographer's words. The clearance gate asks
 * where a camera stands (through a wall, inside a car); this asks what it sees: the subject a shot is about, how big
 * (the shot size, by where the frame's bottom edge cuts a figure), the room over its head, its eyes against the upper
 * third, the room ahead of the way it faces, and at each cut whether the next shot of the same subject jumps (under 30°
 * and within one size) or turns its screen direction round (the line crossed).
 *
 *   projectPoint(cam, p, { aspect }) → { u, v, depth } | null   a point on the frame: u 0 left → 1 right, v 0 top → 1
 *     bottom, `depth` along the lens; null behind the camera. `cam` is a sampled camera (sample.js `cameraAt`:
 *     { pos, look, hfov, roll }), hfov the horizontal field of view in degrees, `aspect` the frame's width over height
 *   readFigure(cam, subject, { aspect }) → the read of one subject standing at `pos` facing `heading`, `height` tall:
 *     { size, top, bottom, cut, fill, eyes, u, facing, lateral, in_frame }   (a figure's size is a SIZES word; a thing
 *     that is not a figure, `figure: false`, an OBJECT_SIZES word by its fill)
 *   frameRead(plan, { subjects, metersPerUnit, aspect }) → { aspect, shots: [...], notes: [...] }   each shot of the
 *     running order read at its start, middle and end on the subject it is about (the one its camera follows, else the
 *     one standing at its point of interest); `notes` the advice, each { code, shot, t, why, fix }
 *
 * The words are rows (SIZES, OBJECT_SIZES, LANDMARKS): a new size is a row, never a branch. Advice, never a refusal; the
 * eyes gate (looking through the camera on the World page) is the person's. Pure and deterministic.
 */
import { compileCamera, cameraAt, programOf, shotAt } from './sample.js';

/** the frame the render draws by default (motion/world-motion.js: 720 × 540) */
export const ASPECT = 4 / 3;
/** a standing figure's height (m) when its subject carries no box (a live entity) */
export const FIGURE_H = 1.75;

/** where things are on a standing figure, as a share of its height from the feet (the anthropometric canon) */
export const LANDMARKS = Object.freeze({ crown: 1, eyes: 0.936, chin: 0.87, shoulders: 0.82, chest: 0.72, waist: 0.6, hips: 0.48, knees: 0.28, ankles: 0.04, feet: 0 });

/**
 * The shot sizes of a figure, tightest first. A size whose frame cuts the figure is read by `cut`: the lowest share of
 * the figure the frame still shows (its bottom edge) is at or above it. One that shows the whole figure is read by
 * `fill`: the share of the frame's height the figure fills. `aim` is where the solver puts the bottom edge (a cut) or
 * how much it fills (a whole figure); `headroom` the share of the frame over the crown it leaves (negative: the crown is
 * cut); `lens` the focal length (mm) it reaches for when none is said.
 */
export const SIZES = Object.freeze([
  { id: 'ecu', name: 'extreme close-up', says: 'the eyes and the mouth: the face fills the frame', cut: 0.85, aim: 0.87, headroom: -0.32, lens: 100 },
  { id: 'cu', name: 'close-up', says: 'the head and the top of the shoulders', cut: 0.77, aim: 0.81, headroom: 0.06, lens: 85 },
  { id: 'mcu', name: 'medium close-up', says: 'from the chest up', cut: 0.66, aim: 0.7, headroom: 0.08, lens: 50 },
  { id: 'ms', name: 'medium shot', says: 'from the waist up', cut: 0.45, aim: 0.54, headroom: 0.09, lens: 50 },
  { id: 'mls', name: 'medium long shot', says: 'from the thigh up: the cowboy', cut: 0.12, aim: 0.38, headroom: 0.1, lens: 35 },
  { id: 'fs', name: 'full shot', says: 'the whole figure, head to foot, filling the frame', fill: 0.5, aim: 0.78, headroom: 0.11, lens: 35 },
  { id: 'ws', name: 'wide shot', says: 'the figure in its place', fill: 0.16, aim: 0.32, headroom: 0.2, lens: 24 },
  { id: 'ews', name: 'extreme wide shot', says: 'the place, the figure small in it', fill: 0, aim: 0.08, headroom: 0.3, lens: 24 },
]);
/** the sizes of a thing that is not a figure (a car, a mover), by the share of the frame its larger side fills */
export const OBJECT_SIZES = Object.freeze([
  { id: 'detail', name: 'detail', fill: 1 },
  { id: 'full', name: 'full', fill: 0.4 },
  { id: 'wide', name: 'wide', fill: 0.12 },
  { id: 'extreme-wide', name: 'extreme wide', fill: 0 },
]);
/** the share of the frame's height a whole standing figure would fill at a size (a cut size's frame shows less than
 * the figure, so more than 1): what a figure seen from far above or below is sized by */
export const fillEquivalent = (z) => (z.cut != null ? (1 - z.headroom) / (1 - z.aim) : z.aim);
/** a lens tilted more than this (degrees) down onto a figure, or up at it, sees its plan, not its height: it is sized by
 * its length across the frame, as if it lay along it */
export const STEEP = 55;

/** the words a size is also said by */
const SIZE_WORDS = { 'extreme-close-up': 'ecu', 'extreme-closeup': 'ecu', 'close-up': 'cu', closeup: 'cu', close: 'cu', 'medium-close-up': 'mcu', 'medium-closeup': 'mcu', medium: 'ms', 'medium-shot': 'ms', 'mid-shot': 'ms', 'waist-shot': 'ms', 'medium-long-shot': 'mls', 'medium-long': 'mls', cowboy: 'mls', 'american-shot': 'mls', 'medium-wide': 'mls', full: 'fs', 'full-shot': 'fs', 'full-figure': 'fs', 'long-shot': 'fs', wide: 'ws', 'wide-shot': 'ws', 'extreme-wide': 'ews', 'extreme-wide-shot': 'ews', 'extreme-long-shot': 'ews', establishing: 'ews' };

/** a size by its id or a word it is said by; null if none */
export function sizeOf(word) {
  if (word == null) return null;
  const s = String(word).trim().toLowerCase().replace(/[\s_]+/g, '-');
  return SIZES.find((z) => z.id === s) || SIZES.find((z) => z.id === SIZE_WORDS[s]) || null;
}

/** the thresholds the advice reads (shares of the frame unless said) */
export const RULES = Object.freeze({
  third: 1 / 3,            // the upper third line
  eyesLow: 0.46,           // eyes below this, in a close or medium size, sink the figure
  loose: 0.24,             // more headroom than this, from a medium close-up to a medium long shot, floats the head
  joint: 0.035,            // a frame edge within this share of the figure from a knee or an ankle cuts at a joint
  lateral: 0.5,            // a facing this far across the frame (the sine of its turn off the lens) has a side
  shortSided: 0.06,        // a figure this far toward the side it faces has its room behind it
  jumpDeg: 30,             // two shots of one subject closer than this in angle, and within one size, jump
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const r3 = (v) => Math.round(v * 1000) / 1000;
const DEG = Math.PI / 180;

/** the camera's basis: forward along the lens, right and up on the frame, banked by its roll (+ clockwise) */
export function basisOf(cam) {
  const f = norm(sub(cam.look, cam.pos));
  let r = cross(f, [0, 0, 1]);
  if (Math.hypot(...r) < 1e-6) r = cross(f, [1, 0, 0]);   // looking straight up or down: any right will do
  r = norm(r);
  let u = cross(r, f);
  const a = (cam.roll || 0) * DEG;
  if (a) { const c = Math.cos(a), s = Math.sin(a); [r, u] = [[r[0] * c - u[0] * s, r[1] * c - u[1] * s, r[2] * c - u[2] * s], [u[0] * c + r[0] * s, u[1] * c + r[1] * s, u[2] * c + r[2] * s]]; }
  return { f, r, u };
}

/** A point on the frame (see the header) */
export function projectPoint(cam, p, { aspect = ASPECT, basis = basisOf(cam) } = {}) {
  const d = sub(p, cam.pos), z = dot(d, basis.f);
  if (!(z > 1e-6)) return null;
  const th = Math.tan((cam.hfov * DEG) / 2), tv = th / aspect;
  return { u: (1 + dot(d, basis.r) / (z * th)) / 2, v: (1 - dot(d, basis.u) / (z * tv)) / 2, depth: z };
}

const sizeByFill = (rows, fill) => rows.find((z) => fill >= z.fill) || rows[rows.length - 1];

/**
 * The read of one subject (see the header). `subject` is { pos, heading, height, figure? } in the world's units: `pos`
 * its ground point, `heading` radians from +x. Fields are shares of the frame (top and bottom, the frame's v of the
 * crown and of the feet; `cut` the share of the figure the bottom edge cuts it at, 0 when the feet show; `eyes` the
 * frame's v of the eyes; `u` across, at the figure's middle), `facing` how it faces on the frame (left | right | toward
 * | away) and `lateral` the sine of its turn across the frame (+ to frame right).
 */
export function readFigure(cam, subject, { aspect = ASPECT } = {}) {
  const basis = basisOf(cam), P = subject.pos, H = subject.height;
  const at = (h) => projectPoint(cam, [P[0], P[1], P[2] + h * H], { aspect, basis });
  const top = at(1), feet = at(0), eyes = at(LANDMARKS.eyes), mid = at(0.55) || eyes || top;
  const hd = [Math.cos(subject.heading || 0), Math.sin(subject.heading || 0), 0];
  const lateral = dot(hd, basis.r), toward = -dot(hd, basis.f);
  const facing = Math.abs(lateral) >= RULES.lateral ? (lateral > 0 ? 'right' : 'left') : (toward >= 0 ? 'toward' : 'away');
  if (!mid) return { in_frame: false, behind: true, facing, lateral: r3(lateral) };
  if (subject.figure !== false && Math.abs(Math.asin(Math.max(-1, Math.min(1, basis.f[2])))) > STEEP * DEG) {
    // seen from far above or below: its length across the frame, as if it lay along the frame's up
    const uh = norm([basis.u[0], basis.u[1], 0]), c = [P[0], P[1], P[2] + 0.5 * H];
    const ends = [-0.5, 0.5].map((k) => projectPoint(cam, [c[0] + uh[0] * H * k, c[1] + uh[1] * H * k, c[2]], { aspect, basis }));
    const fill = ends.every(Boolean) ? Math.abs(ends[1].v - ends[0].v) : 0, lg = Math.log(Math.max(1e-3, fill));
    const near = SIZES.reduce((b, z) => (Math.abs(Math.log(Math.max(1e-3, fillEquivalent(z))) - lg) < Math.abs(Math.log(Math.max(1e-3, fillEquivalent(b))) - lg) ? z : b));
    return { size: near.id, steep: true, in_frame: mid.u >= 0 && mid.u <= 1 && mid.v >= 0 && mid.v <= 1, fill: r3(fill), u: r3(mid.u), depth: r3(mid.depth), facing, lateral: r3(lateral) };
  }
  // the share of the figure the frame's bottom edge cuts it at: bisected along the figure (v grows as h falls)
  let cut = 0;
  if (!feet || feet.v > 1) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const h = (lo + hi) / 2, p = at(h); if (!p || p.v > 1) lo = h; else hi = h; }
    cut = hi;
  }
  const tv = top ? top.v : -Infinity, bv = feet ? feet.v : Infinity;
  // across the frame, the part the frame shows: its middle (the face in a close-up, the figure's middle in a full shot)
  const shown = cut > 0 ? at((cut + 1) / 2) || mid : mid;
  const fill = Math.max(0, Math.min(1, bv) - Math.max(0, tv));
  const inFrame = shown.u >= 0 && shown.u <= 1 && tv < 1 && bv > 0;
  let size;
  if (subject.figure === false) {
    const w = subject.width ?? H, ends = [-0.5, 0.5].map((s) => projectPoint(cam, [P[0] + basis.r[0] * w * s, P[1] + basis.r[1] * w * s, P[2] + H / 2], { aspect, basis }));
    const across = ends.every(Boolean) ? Math.abs(ends[1].u - ends[0].u) : 0;
    size = sizeByFill(OBJECT_SIZES, Math.max(bv - tv, across)).id;
  } else size = (SIZES.find((z) => z.cut != null && cut >= z.cut) || sizeByFill(SIZES.filter((z) => z.fill != null), bv - tv)).id;
  return {
    size, in_frame: inFrame,
    top: r3(tv === -Infinity ? 0 : tv), bottom: r3(bv === Infinity ? 1 : bv), cut: r3(cut), fill: r3(fill),
    ...(eyes ? { eyes: r3(eyes.v) } : {}), u: r3(shown.u), depth: r3(shown.depth), facing, lateral: r3(lateral),
  };
}

const sizeIndex = (id) => SIZES.findIndex((z) => z.id === id);
// the moves (moves.js, and a long take's glide, actor/coverage.js) whose frames in between are on the way, not a
// composition
const FAST = ['whip_pan', 'crash_zoom', 'glide'];
// the subject a key's point of interest stands on, at an instant: within its own height of the point
function standingAt(poi, subjects, t, heightOf) {
  let best = null;
  for (const s of subjects.values()) {
    const { pos } = s.at(t), h = heightOf(s);
    if (h == null) continue;
    const d = Math.hypot(poi[0] - pos[0], poi[1] - pos[1]), up = poi[2] - pos[2];
    if (d <= h * 0.75 && up >= -0.25 * h && up <= 1.4 * h && (!best || d < best.d)) best = { s, d };
  }
  return best && best.s;
}

/**
 * The frame read of a normalized plan (see the header). `subjects` (subjects.js `shootSubjects`) are what a shot can
 * be about; `metersPerUnit` turns FIGURE_H into the world's units for a subject with no box.
 */
export function frameRead(plan, { subjects = null, metersPerUnit = 1, aspect = ASPECT } = {}) {
  const mpu = Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1;
  const heightOf = (s) => (s.box ? s.box.hgt : s.kind === 'entity' ? FIGURE_H / mpu : null);
  const figureOf = (s) => s.kind === 'walker' || s.kind === 'entity' || s.kind === 'figure';
  const program = programOf(plan), compiled = new Map(plan.cameras.map((c) => [c.id, compileCamera(c, { subjects })]));
  const notes = [], shots = [];
  const note = (code, shot, t, why, fix) => { if (notes.length < 40) notes.push({ code, shot, t: r3(t), why, fix }); };
  const camOf = (c) => plan.cameras.find((x) => x.id === c);
  const aboutOf = (shot, t, cam, ct) => {
    // the subject the key in play says it is about (the last one keyed by then), else the one it follows, else the
    // one standing at its point of interest
    const camDef = camOf(shot.camera), said = camDef.keys.filter((k) => k.about && subjects && subjects.has(k.about));
    const key = said.filter((k) => k.t <= ct + 1e-9).at(-1) || said[0];
    if (key) return { s: subjects.get(key.about) };
    for (const k of camDef.keys) for (const v of [k.poi, k.pos]) if (v && v.follow && subjects && subjects.has(v.follow)) return { s: subjects.get(v.follow) };
    const near = subjects && subjects.size ? standingAt(cam.look, subjects, t, heightOf) : null;
    return near ? { s: near, guessed: true } : null;
  };
  program.shots.forEach((shot, i) => {
    const ends = [shot.start + 1e-6, shot.start + shot.length / 2, shot.start + shot.length - 1e-6];
    const reads = ends.map((tau) => {
      const at = shotAt(program, tau), cam = cameraAt(compiled.get(shot.camera), at.camera_t ?? at.t);
      const ct = at.camera_t ?? at.t, found = aboutOf(shot, at.t, cam, ct), s = found?.s;
      if (!s) return { t: at.t, ct, cam };
      const h = heightOf(s), here = s.at(at.t);
      if (h == null) { const p = projectPoint(cam, here.pos, { aspect }); return { t: at.t, ct, cam, s, read: { in_frame: !!p && p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1, ...(p ? { u: r3(p.u), v: r3(p.v) } : { behind: true }) } }; }
      const read = readFigure(cam, { pos: here.pos, heading: here.heading, height: h, figure: figureOf(s), ...(s.box ? { width: s.box.len } : {}) }, { aspect });
      // (a subject only guessed from where the camera looks is the shot's only while it is in the frame: a camera
      //  between two framings, a long take's glide, is about no one, and loses no one)
      if (found.guessed && !read.in_frame) return { t: at.t, ct, cam };
      return { t: at.t, ct, cam, s, read };
    });
    const about = reads.find((x) => x.s)?.s;
    const mid = reads[1].read || reads.find((x) => x.read)?.read;
    const row = { name: shot.name, camera: shot.camera, ...(about ? { about: about.id } : {}) };
    if (mid) {
      const sizes = [...new Set(reads.filter((x) => x.read?.size).map((x) => x.read.size))];
      Object.assign(row, {
        ...(mid.size ? { size: mid.size } : {}), ...(sizes.length > 1 ? { sizes } : {}),
        ...(mid.top != null && mid.size && sizeIndex(mid.size) >= 0 ? { headroom: r3(mid.top) } : {}),
        ...(mid.eyes != null && sizeIndex(mid.size) >= 0 ? { eyes: mid.eyes } : {}),
        ...(mid.u != null ? { across: mid.u } : {}), ...(mid.facing ? { facing: mid.facing } : {}),
        ...(reads.some((x) => x.read && !x.read.in_frame) ? { leaves_frame: true } : {}),
      });
    }
    row._reads = reads;
    shots.push(row);
    if (!about) return;
    // ─── the advice on one shot ─────────────────────────────────────────────────────────────────────────────────────
    // (a whip pan leaves its subject between its keys on purpose: the blur is the move)
    const inMove = (x, ids) => { const ks = camOf(shot.camera).keys, ct = x.ct; return ks.some((k, j) => ids.includes(k.framing?.move) && ks[j + 1] && ks[j + 1].framing?.move === k.framing.move && k.t <= ct && ct < ks[j + 1].t); };
    const lost = reads.find((x) => x.read && !x.read.in_frame && !inMove(x, ['whip_pan', 'glide']));
    if (lost) note('lost', shot.name, lost.t, `${about.id} is out of the frame at ${r3(lost.t)}s`, 'aim the point of interest at it (follow it), or open the lens');
    const R = mid;
    // (a frame in a fast move, a whip or a crash zoom, is a blur on its way: its composition is the keys')
    if (!R || !R.size || sizeIndex(R.size) < 0 || !R.in_frame || inMove(reads[1], FAST)) return;
    const k = sizeIndex(R.size);
    if (R.top < -0.005 && k >= sizeIndex('ms')) note('head-cut', shot.name, reads[1].t, `a ${SIZES[k].name} cuts ${about.id}'s head off at the top`, 'lower the point of interest, or pull back');
    if (R.top > RULES.loose && k >= sizeIndex('mcu') && k <= sizeIndex('mls')) note('loose-head', shot.name, reads[1].t, `${r3(R.top * 100)}% of the frame over ${about.id}'s head: it sinks in a ${SIZES[k].name}`, 'raise the point of interest so the eyes sit near the upper third');
    else if (R.eyes != null && R.eyes > RULES.eyesLow && k >= sizeIndex('cu') && k <= sizeIndex('ms')) note('eyes-low', shot.name, reads[1].t, `${about.id}'s eyes are ${r3(R.eyes * 100)}% down the frame; the upper third is where they read`, 'raise the point of interest a little');
    const joint = ['knees', 'ankles'].find((j) => R.cut > 0 && Math.abs(R.cut - LANDMARKS[j]) < RULES.joint);
    if (joint) note('joint-cut', shot.name, reads[1].t, `the frame's bottom edge cuts ${about.id} at the ${joint}`, 'cut between the joints: tighter to the thigh, or wide enough for the feet');
    if ((R.facing === 'left' || R.facing === 'right') && (R.u - 0.5) * Math.sign(R.lateral) > RULES.shortSided) note('short-sided', shot.name, reads[1].t, `${about.id} faces frame ${R.facing} from the ${R.facing} of the frame: its room is behind it`, `give it lead room: place it on the frame's ${R.facing === 'right' ? 'left' : 'right'} third`);
  });
  // ─── the advice at each cut ──────────────────────────────────────────────────────────────────────────────────────
  for (let i = 1; i < shots.length; i++) {
    const A = shots[i - 1], B = shots[i], a = A._reads[2], b = B._reads[0];
    // (one camera running on from one shot into the next, a long take's glide into its hold, is no cut)
    if (A.camera === B.camera && Math.abs(program.shots[i].span[0] - program.shots[i - 1].span[1]) < 1e-3) continue;
    if (!a.s || !b.s || a.s.id !== b.s.id || !a.read?.size || !b.read?.size || !a.read.in_frame || !b.read.in_frame) continue;
    const pa = a.s.at(a.t).pos, pb = b.s.at(b.t).pos;
    const az = (cam, p) => Math.atan2(cam.pos[1] - p[1], cam.pos[0] - p[0]);
    const turn = Math.abs(((((az(b.cam, pb) - az(a.cam, pa)) / DEG) + 540) % 360) - 180);
    const ka = sizeIndex(a.read.size), kb = sizeIndex(b.read.size);
    const steps = ka >= 0 && kb >= 0 ? Math.abs(ka - kb) : (a.read.size === b.read.size ? 0 : 2);
    if (turn < RULES.jumpDeg && steps <= 1) note('jump-cut', B.name, b.t, `'${A.name}' to '${B.name}' turns ${Math.round(turn)}° round ${a.s.id} and ${steps ? 'moves one size' : 'keeps its size'}: the cut jumps`, 'move the camera 30° or more round it, or change the size by two steps');
    if (Math.abs(a.read.lateral) >= RULES.lateral && Math.abs(b.read.lateral) >= RULES.lateral && Math.sign(a.read.lateral) !== Math.sign(b.read.lateral)) {
      note('direction-flip', B.name, b.t, `${a.s.id} moves frame ${a.read.facing} in '${A.name}' and frame ${b.read.facing} in '${B.name}': the cut crosses the line`, 'keep both cameras on one side of its path, or cut through a shot along it (toward or away)');
    }
  }
  for (const s of shots) delete s._reads;
  return { aspect: r3(aspect), shots, notes };
}
