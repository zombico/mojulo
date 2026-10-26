/**
 * OUT-GROUND — the trail's ground as dials and edits, in the trail's own metres (x across, y along, z up). The trail
 * card (out-trail.js `OUT_TRAIL`) holds what a trail is by default; `trail.ground` tunes it per trail without touching
 * the card, and shapes it by hand:
 *
 *   DIALS      amplitude (how high the heartbeat climbs), depth (how low it falls), grade, drift, bump, the beats'
 *              shapes, the far cliff. Each left out is the card's own, so a trail without `ground` is built as before,
 *              to the byte.
 *   EDITS      raise, lower, flatten, cliff, gorge, ridge: a stamp at a place or a stroke along a path, summed over the
 *              ground after the heartbeat's field. An edit the walk crosses carries the walk with it (`walk: 'follow'`,
 *              the default: the walk climbs onto a raise, steps down a cliff, drops through a gorge, and the stairs
 *              sites and the grade law answer it); `walk: 'keep'` holds the walk at the heartbeat's height through it.
 *
 * The level tier (level/ground.js) writes these from its top-down grid; this file only knows metres.
 * Pure: the same dials and edits build the same ground.
 */
import { JOINT_PATTERNS } from '../polygonizer/landform.js';
import { readWater } from './out-water.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;

/** The dials, in the words a reader is taught. */
export const GROUND_DIALS = Object.freeze({
  amplitude: 'metres the heartbeat climbs to its crests (a reveal, a landmark, the drift): heartbeat × 7 when left out',
  depth: 'metres it falls into its dips (a pinch, a ford, the drop off a reveal\'s far side): the amplitude when left out',
  grade: 'the steepest walk, rise over run (0.1–0.6, 0.3): steeper is a stairs site',
  drift: 'the slow wander under the beats, a share of the amplitude (0–1, 0.3)',
  bump: '{ height?, scale?, walk? }: the mounds and hollows: metres (bumpiness × 1.1), their size (0.25–4, under 1 broader), the share left on the walk (0–1, 0.12)',
  shapes: '{ reveal?, landmark?, pinch?, crossing? }: each beat\'s { share?, reach? }: how much of the amplitude (a crest) or the depth (a dip) it takes, and how far it reaches in metres',
  cliff: '{ height?, face?, bed?, dip?, joint?, pattern? } | false: the kit\'s cliff down the far side (false: none, the land open on both sides of the trail): metres of throw, the face in degrees, its beds\' thickness in metres and their tilt in degrees, its joints\' spacing in metres and their pattern (blocky, columnar, slabby)',
  edits: 'the ground shaped by hand: a list of raise, lower, flatten, cliff, gorge, ridge',
  water: '{ lake?, coast?, river?, falls? } | false: the water cut into the land (era/out-water.js): a lake beside the walk, the open side falling to the sea, a river beside the walk, water off the far cliff; false: none',
});
/** Each beat's shape on the heartbeat: its share of the amplitude (a crest) or the depth (a dip), and its reach (m).
 *  A reveal climbs over `reach` to its crest and falls 0.7 of it again over `fall`. */
export const BEAT_SHAPES = Object.freeze({
  reveal: Object.freeze({ share: 1, reach: 20, fall: 18 }),
  landmark: Object.freeze({ share: 0.3, reach: 6 }),
  pinch: Object.freeze({ share: 0.45, reach: 6 }),
  crossing: Object.freeze({ share: 0.6, reach: 7 }),
});
export const BUMP = Object.freeze({ m: 1.1, walk: 0.12 });

/** The edits, what each takes and what it does. */
export const GROUND_EDITS = Object.freeze({
  raise: 'lift the ground over a place: { at, size?, falloff?, height, shape?: mesa | dome, walk? }',
  lower: 'sink the ground over a place: { at, size?, falloff?, depth, shape?: mesa | dome, walk? }',
  flatten: 'lay a place level: { at, size?, falloff?, to?: metres | \'walk\' } (the walk\'s height there when left out); the walk itself is not moved',
  cliff: 'a steep face along a path, one side high: { path, height, side: left | right, face?: degrees (70), reach?: metres the high side holds before it eases down (14), walk? }',
  gorge: 'a channel cut along a path: { path, depth, width?: its floor in metres (4), wall?: degrees (65), walk? }',
  ridge: 'a spine raised along a path: { path, height, width?: metres (8), walk? }',
  rise: 'the long swell along the walk: { points: [[y, metres], …] } eased between, held past the ends; the whole width rises, the walk with it',
});
const AREA = ['raise', 'lower', 'flatten'];
const EDIT_KEYS = {
  raise: ['at', 'size', 'falloff', 'height', 'shape', 'walk'],
  lower: ['at', 'size', 'falloff', 'depth', 'shape', 'walk'],
  flatten: ['at', 'size', 'falloff', 'to'],
  cliff: ['path', 'height', 'side', 'face', 'reach', 'walk'],
  gorge: ['path', 'depth', 'width', 'wall', 'walk'],
  ridge: ['path', 'height', 'width', 'walk'],
  rise: ['points', 'walk'],
};
export const GROUND_EDIT_OPS = Object.freeze(Object.keys(GROUND_EDITS));
export const MAX_EDITS = 48;

const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

/** Read a trail's `ground` and say what is wrong; → the dials as written (validated) and the edits read. */
export function readGround(g, at = 'trail.ground') {
  if (g === undefined) return null;
  if (!isObj(g)) throw new Error(`stage: ${at} is { ${Object.keys(GROUND_DIALS).join(', ')} } (every one optional)`);
  for (const k of Object.keys(g)) if (!GROUND_DIALS[k]) throw new Error(`stage: ${at}.${k} is not a ground dial (dials: ${Object.keys(GROUND_DIALS).join(', ')})`);
  const num = (o, k, lo, hi, where, words) => {
    if (o[k] === undefined) return;
    if (typeof o[k] !== 'number' || !(o[k] >= lo && o[k] <= hi)) throw new Error(`stage: ${where}.${k} is ${words}`);
  };
  num(g, 'amplitude', 0, 40, at, 'metres the heartbeat climbs, 0 to 40');
  num(g, 'depth', 0, 40, at, 'metres the heartbeat falls, 0 to 40');
  num(g, 'grade', 0.1, 0.6, at, 'the steepest walk, rise over run, 0.1 to 0.6');
  num(g, 'drift', 0, 1, at, 'a share of the amplitude, 0 to 1');
  const sub = (k, keys) => {
    if (g[k] === undefined) return;
    if (!isObj(g[k])) throw new Error(`stage: ${at}.${k} is { ${keys.join(', ')} }`);
    for (const q of Object.keys(g[k])) if (!keys.includes(q)) throw new Error(`stage: ${at}.${k}.${q} is not a ${k} setting (settings: ${keys.join(', ')})`);
  };
  sub('bump', ['height', 'scale', 'walk']);
  if (g.bump) {
    num(g.bump, 'height', 0, 8, `${at}.bump`, 'metres of mound, 0 to 8');
    num(g.bump, 'scale', 0.25, 4, `${at}.bump`, 'the mounds\' size, 0.25 (broad) to 4 (fine)');
    num(g.bump, 'walk', 0, 1, `${at}.bump`, 'the share left on the walk, 0 to 1');
  }
  sub('shapes', Object.keys(BEAT_SHAPES));
  for (const [b, s] of Object.entries(g.shapes || {})) {
    const keys = Object.keys(BEAT_SHAPES[b]);
    if (!isObj(s)) throw new Error(`stage: ${at}.shapes.${b} is { ${keys.join(', ')} }`);
    for (const q of Object.keys(s)) if (!keys.includes(q)) throw new Error(`stage: ${at}.shapes.${b}.${q} is not a shape setting (settings: ${keys.join(', ')})`);
    num(s, 'share', 0, 3, `${at}.shapes.${b}`, 'a share of the amplitude or depth, 0 to 3');
    num(s, 'reach', 2, 60, `${at}.shapes.${b}`, 'metres, 2 to 60');
    num(s, 'fall', 2, 60, `${at}.shapes.${b}`, 'metres, 2 to 60');
  }
  if (g.cliff !== false) sub('cliff', ['height', 'face', 'bed', 'dip', 'joint', 'pattern']);
  if (g.cliff) {
    num(g.cliff, 'height', 0, 40, `${at}.cliff`, 'metres of throw, 0 to 40');
    num(g.cliff, 'face', 20, 89, `${at}.cliff`, 'the face in degrees, 20 to 89');
    // its geology (polygonizer/landform.js strata and joints): the card's own where left out
    num(g.cliff, 'bed', 0.2, 20, `${at}.cliff`, 'the beds\' thickness in metres, 0.2 to 20');
    num(g.cliff, 'dip', 0, 40, `${at}.cliff`, 'the beds\' tilt in degrees, 0 to 40');
    num(g.cliff, 'joint', 0.5, 20, `${at}.cliff`, 'the joints\' spacing in metres, 0.5 to 20');
    if (g.cliff.pattern !== undefined && !JOINT_PATTERNS[g.cliff.pattern]) throw new Error(`stage: ${at}.cliff.pattern is one of ${Object.keys(JOINT_PATTERNS).join(', ')}`);
  }
  const edits = g.edits === undefined ? undefined : readEdits(g.edits, `${at}.edits`);
  // (the water, era/out-water.js: a fall wants the far cliff it falls from)
  const water = readWater(g.water, `${at}.water`);
  if (water?.falls && g.cliff === false) throw new Error(`stage: ${at}.water.falls drop off the far cliff: a trail with no cliff (cliff: false) has none to fall from`);
  return { ...g, ...(edits ? { edits } : {}) };
}

/** Read a list of edits in metres; → the edits with their defaults. */
export function readEdits(list, at = 'trail.ground.edits') {
  if (!Array.isArray(list)) throw new Error(`stage: ${at} is a list of edits (${GROUND_EDIT_OPS.join(', ')})`);
  if (list.length > MAX_EDITS) throw new Error(`stage: ${at} holds at most ${MAX_EDITS} edits`);
  return list.map((e, i) => readEdit(e, `${at}[${i}]`));
}
function readEdit(e, at) {
  if (!isObj(e) || !GROUND_EDITS[e.op]) throw new Error(`stage: ${at} is { op, … } with op one of ${GROUND_EDIT_OPS.join(', ')}`);
  const keys = ['op', 'id', ...EDIT_KEYS[e.op]];
  for (const k of Object.keys(e)) if (!keys.includes(k)) throw new Error(`stage: ${at}.${k} is not a ${e.op} setting (${GROUND_EDITS[e.op]})`);
  if (e.id !== undefined && (typeof e.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(e.id))) throw new Error(`stage: ${at}.id is a short lower-case name`);
  const pos = (k, lo, hi, d, words) => {
    if (e[k] === undefined) { if (d === null) throw new Error(`stage: ${at}.${k} is ${words}`); return d; }
    if (typeof e[k] !== 'number' || !(e[k] >= lo && e[k] <= hi)) throw new Error(`stage: ${at}.${k} is ${words}`);
    return e[k];
  };
  const walk = e.walk === undefined ? 'follow' : e.walk;
  if (e.op !== 'flatten' && !['follow', 'keep'].includes(walk)) throw new Error(`stage: ${at}.walk is 'follow' (the walk goes with the ground) or 'keep' (the walk holds its height through it)`);
  const out = { op: e.op, ...(e.id ? { id: e.id } : {}) };
  if (e.op === 'rise') {
    if (!Array.isArray(e.points) || e.points.length < 2 || !e.points.every((p) => isPt(p) && Math.abs(p[1]) <= 60)) throw new Error(`stage: ${at}.points is two or more [y, metres] (along the walk, the height there, ±60)`);
    const pts = e.points.map((p) => [...p]).sort((a, b) => a[0] - b[0]);
    if (pts.some((p, i) => i && p[0] - pts[i - 1][0] < 1)) throw new Error(`stage: ${at}.points stand a metre or more apart along the walk`);
    return { ...out, points: pts, walk };
  }
  if (AREA.includes(e.op)) {
    if (!isPt(e.at)) throw new Error(`stage: ${at}.at is a place [x, y] in metres`);
    const size = e.size === undefined ? [0, 0] : e.size;
    if (!isPt(size) || size.some((v) => v < 0 || v > 400)) throw new Error(`stage: ${at}.size is [across, along] in metres, 0 to 400`);
    Object.assign(out, { at: [...e.at], size: [...size], falloff: pos('falloff', 0.5, 80, 6, 'metres it eases back over, 0.5 to 80') });
    if (e.op === 'flatten') {
      if (e.to !== undefined && e.to !== 'walk' && !(typeof e.to === 'number' && Math.abs(e.to) <= 200)) throw new Error(`stage: ${at}.to is a height in metres, or 'walk'`);
      out.to = e.to === undefined ? 'walk' : e.to;
    } else {
      const k = e.op === 'raise' ? 'height' : 'depth';
      out[k] = pos(k, 0, 40, null, `metres, 0 to 40`);
      const shape = e.shape === undefined ? 'mesa' : e.shape;
      if (!['mesa', 'dome'].includes(shape)) throw new Error(`stage: ${at}.shape is 'mesa' (flat over its size) or 'dome' (rounded)`);
      Object.assign(out, { shape, walk });
    }
  } else {
    if (!Array.isArray(e.path) || e.path.length < 2 || !e.path.every(isPt)) throw new Error(`stage: ${at}.path is two or more places [[x, y], …] in metres`);
    out.path = e.path.map((p) => [...p]);
    if (e.op === 'cliff') {
      if (!['left', 'right'].includes(e.side)) throw new Error(`stage: ${at}.side is the high side, 'left' or 'right' of the path walked from its first place`);
      Object.assign(out, { height: pos('height', 0, 40, null, 'metres, 0 to 40'), side: e.side, face: pos('face', 20, 89, 70, 'degrees, 20 to 89'), reach: pos('reach', 1, 200, 14, 'metres, 1 to 200') });
    } else if (e.op === 'gorge') {
      Object.assign(out, { depth: pos('depth', 0, 40, null, 'metres, 0 to 40'), width: pos('width', 0.5, 60, 4, 'metres of floor, 0.5 to 60'), wall: pos('wall', 20, 89, 65, 'degrees, 20 to 89') });
    } else {
      Object.assign(out, { height: pos('height', 0, 40, null, 'metres, 0 to 40'), width: pos('width', 1, 120, 8, 'metres, 1 to 120') });
    }
    out.walk = walk;
  }
  return out;
}

/** The dials a trail is built by: its `ground` over the card. `T` is the read trail, `C` the card. */
export function groundOf(T, C) {
  const g = T.ground || {}, sh = g.shapes || {};
  const A = g.amplitude !== undefined ? g.amplitude : T.heartbeat * C.rise;
  const Dp = g.depth !== undefined ? g.depth : A;
  return {
    A, Dp,
    // the heartbeat as a 0…1 dial again, up and down (the beats' banks and drop-offs scale by it)
    up: g.amplitude !== undefined ? g.amplitude / C.rise : T.heartbeat,
    down: g.depth !== undefined ? g.depth / C.rise : g.amplitude !== undefined ? g.amplitude / C.rise : T.heartbeat,
    grade: g.grade !== undefined ? g.grade : C.grade,
    drift: g.drift !== undefined ? g.drift : 0.3,
    B: g.bump?.height !== undefined ? g.bump.height : T.bumpiness * C.bump.m,
    bumpScale: g.bump?.scale !== undefined ? g.bump.scale : 1,
    bumpWalk: g.bump?.walk !== undefined ? g.bump.walk : C.bump.walk,
    shapes: Object.fromEntries(Object.entries(BEAT_SHAPES).map(([b, d]) => [b, { ...d, ...(sh[b] || {}) }])),
    // (false: no far cliff, the land open on both sides; out-trail.js siteOf)
    cliff: g.cliff === false ? false : g.cliff || {},
    edits: g.edits || [],
    // (the water cut into the land, era/out-water.js: none when absent or false)
    ...(g.water ? { water: readWater(g.water) } : {}),
  };
}

// ── the edits as fields: each a height change at (x, y) ───────────────────────────────────────────────────────
// a path's segments, and the nearest point on them: its distance, its side (+ left of the way walked) and its arc
function segsOf(path) {
  const segs = []; let total = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k], b = path[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > 0) { segs.push({ a, ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L, L, s0: total }); total += L; }
  }
  return { segs, total };
}
function nearest({ segs }, x, y, extend) {
  let best = Infinity, sd = 0, arc = 0;
  segs.forEach((sg, n) => {
    const px = x - sg.a[0], py = y - sg.a[1], tRaw = px * sg.ux + py * sg.uy;
    const t = Math.max(extend && n === 0 ? -Infinity : 0, Math.min(extend && n === segs.length - 1 ? Infinity : sg.L, tRaw));
    const d = Math.hypot(px - t * sg.ux, py - t * sg.uy);
    if (d < best) { best = d; sd = (sg.ux * py - sg.uy * px >= 0 ? 1 : -1) * d; arc = sg.s0 + t; }
  });
  return { d: best, sd, arc };
}
/** An area's weight at (x, y): 1 over its size, eased to 0 over its falloff; a dome is rounded across the whole. */
function areaWeight(e, x, y) {
  const hw = e.size[0] / 2, hd = e.size[1] / 2, dx = Math.abs(x - e.at[0]), dy = Math.abs(y - e.at[1]);
  const out = Math.hypot(Math.max(0, dx - hw), Math.max(0, dy - hd));
  const w = 1 - smooth(0, e.falloff, out);
  if (e.shape !== 'dome' || w <= 0) return w;
  const r = Math.hypot(dx / (hw + e.falloff), dy / (hd + e.falloff));
  return 1 - smooth(0, 1, r);
}

/** One edit as a height change (x, y) → metres; null for a flatten (it is a blend, not a change). */
export function editField(e) {
  if (e.op === 'raise') return (x, y) => e.height * areaWeight(e, x, y);
  if (e.op === 'lower') return (x, y) => -e.depth * areaWeight(e, x, y);
  if (e.op === 'flatten') return null;
  if (e.op === 'rise') {
    const pts = e.points, n = pts.length;
    return (x, y) => {
      if (y <= pts[0][0]) return pts[0][1];
      if (y >= pts[n - 1][0]) return pts[n - 1][1];
      let k = 0; while (y > pts[k + 1][0]) k++;
      const [y0, h0] = pts[k], [y1, h1] = pts[k + 1];
      return h0 + (h1 - h0) * smooth(y0, y1, y);
    };
  }
  const P = segsOf(e.path);
  if (!P.segs.length) return () => 0;
  if (e.op === 'cliff') {
    const W = e.height / Math.tan(e.face * D2R), sgn = e.side === 'right' ? -1 : 1, tipLen = Math.max(4, 2 * e.height);
    return (x, y) => {
      const { sd, arc } = nearest(P, x, y, true), v = sgn * sd;
      const beyond = Math.max(0, -arc, arc - P.total);
      return e.height * smooth(-W / 2, W / 2, v) * (1 - smooth(e.reach, 2 * e.reach, v)) * (1 - smooth(0, tipLen, beyond));
    };
  }
  if (e.op === 'gorge') {
    const half = e.width / 2, wallW = Math.max(0.25, e.depth / Math.tan(e.wall * D2R));
    return (x, y) => -e.depth * (1 - smooth(half, half + wallW, nearest(P, x, y, false).d));
  }
  const half = e.width / 2;
  return (x, y) => e.height * (1 - smooth(0, half, nearest(P, x, y, false).d));
}

/** The edits a field sums: (x, y) → metres, with `walkOnly` only those the walk follows. → null when there are none. */
export function editsField(edits, { walkOnly = false } = {}) {
  const fs = edits.filter((e) => e.op !== 'flatten' && (!walkOnly || e.walk === 'follow')).map(editField);
  if (!fs.length) return null;
  return (x, y) => { let z = 0; for (const f of fs) z += f(x, y); return z; };
}

/**
 * The edits laid on a baked grid (landform.js state) in their order: the changes summed in, each flatten blended in
 * where it stands. `walkAt(y)` is the walk's height at a row (a flatten's 'walk').
 */
export function applyEdits(g, edits, { gridX, gridY, walkAt }) {
  for (const e of edits) {
    if (e.op === 'flatten') {
      const to = e.to === 'walk' ? walkAt(e.at[1]) : e.to;
      for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
        const w = areaWeight(e, gridX(g, i), gridY(g, j)); if (w <= 0) continue;
        const q = j * g.nx + i; g.z[q] += (to - g.z[q]) * w;
      }
      continue;
    }
    const f = editField(e);
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) { const q = j * g.nx + i; g.z[q] += f(gridX(g, i), gridY(g, j)); }
  }
  return g;
}

/** Where each edit meets the walk: → [{ edit, crosses, dz }] (dz the most the edit moves the walk, metres). */
export function editsOnWalk(edits, trailX, D) {
  return edits.map((e, i) => {
    const f = editField(e);
    let most = 0, near = Infinity;
    for (let y = 0; y <= D; y += 1) {
      const x = trailX(y);
      if (f) { const dz = f(x, y); if (Math.abs(dz) > Math.abs(most)) most = dz; }
      else near = Math.min(near, Math.hypot(Math.max(0, Math.abs(x - e.at[0]) - e.size[0] / 2), Math.max(0, Math.abs(y - e.at[1]) - e.size[1] / 2)));
    }
    return { edit: e.id || `${e.op}-${i + 1}`, op: e.op, crosses: f ? Math.abs(most) > 0.05 : near < e.falloff, dz: Math.round(most * 100) / 100, walk: e.walk ?? 'keep' };
  });
}
