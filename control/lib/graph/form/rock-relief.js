/**
 * THE ROCK'S RELIEF (gen-7): a heartbeat at a cliff's scale. Where a level's heartbeat (era/heartbeat.js) says how its
 * land climbs and falls over hundreds of metres, a relief says how a rock face stands in and out over a few: its ledges,
 * cracks, ribs and bulges, and the swell and roughness between them. The same words and the same fields: a `pulse` of
 * dials, `marks` in a relative frame with sizes in metres (checked by out-ground.js `readEdits`, summed by `editField`),
 * `why` lines, presets copied with `from`. Its frame is a tile of face, `tile` metres square: u along the face, v up it.
 * It wraps, so it can be laid round a cliff of any length; the strata cut (matte-paint/dressed.js) is the grain below it.
 *
 *   pulse   swell: metres the face swells in and out over `wave` metres; bump: { height, scale } the roughness, metres
 *           and the bumps' size
 *   marks   cliff (a ledge or step along a path: `side` the side standing out, right of the way walked being below),
 *           gorge (a crack or chimney), ridge (a rib), raise and lower (a bulge, a scoop; mesa or dome). At most a
 *           metre each, in or out; places [u, v] in 0..1 of the tile, sizes in metres
 *
 *   readRelief(spec)               a preset id, a document, or { from: preset, …changes } → the relief, checked
 *   reliefMap(relief, { seed?, cell? }) → { tile, cell, size, h: Float32Array (row j at v = j·cell), lo, hi }
 *       the face's height in and out at each cell, metres, its mean taken out (the face neither grows nor shrinks);
 *       the seed nudges each mark's place and height and draws the pulse, so one relief gives many faces of a kind
 *
 * Pure, seeded: the same relief and seed, the same map, byte for byte.
 */
import { readEdits, editField } from '../era/out-ground.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b === undefined ? a : b);
const no = (msg) => { throw new Error(`relief: ${msg}`); };
const isUV = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && v >= -0.25 && v <= 1.25);
const smooth = (t) => t * t * (3 - 2 * t);

/** The marks a relief takes: the heartbeat's edits that stand in a place (a rise and a flatten are a walk's, not a face's). */
export const RELIEF_MARKS = Object.freeze(['cliff', 'gorge', 'ridge', 'raise', 'lower']);
/** How far a mark stands in or out, at most (metres): the relief is display only, the land as built under it. */
export const RELIEF_MAX = 1;

/** The reliefs to start from. A relief is a starter: copy one with `from` and change what the face needs. */
export const RELIEF_PRESETS = Object.freeze({
  ledged: {
    id: 'ledged', title: 'Ledged face', reads: 'Benches stepping out along the hard beds, a slow swell between',
    tile: 24,
    pulse: { swell: 0.16, wave: 7, bump: { height: 0.1, scale: 1.4 } },
    marks: [
      { op: 'cliff', path: [[0.04, 0.2], [0.4, 0.23], [0.78, 0.19]], height: 0.32, side: 'right', face: 72, reach: 1.4 },
      { op: 'cliff', path: [[0.36, 0.55], [0.7, 0.58], [0.96, 0.56]], height: 0.26, side: 'right', face: 75, reach: 1.1 },
      { op: 'cliff', path: [[0.08, 0.8], [0.5, 0.78]], height: 0.2, side: 'right', face: 70, reach: 1 },
      { op: 'lower', at: [0.62, 0.38], size: [2, 3], falloff: 1.6, depth: 0.22, shape: 'dome' },
      { op: 'raise', at: [0.2, 0.5], size: [1.5, 1], falloff: 1.2, height: 0.18, shape: 'dome' },
    ],
    why: ['The hard beds stand out as benches; the soft between them weather back.', 'A ledge never runs the whole face: it starts and stops.'],
  },
  cracked: {
    id: 'cracked', title: 'Cracked face', reads: 'Chimneys and cracks running up it, the blocks between bulging',
    tile: 24,
    pulse: { swell: 0.12, wave: 5, bump: { height: 0.08, scale: 1 } },
    marks: [
      { op: 'gorge', path: [[0.18, 0.04], [0.21, 0.5], [0.17, 0.96]], depth: 0.35, width: 0.5, wall: 70 },
      { op: 'gorge', path: [[0.58, 0.12], [0.6, 0.7]], depth: 0.25, width: 0.5, wall: 75 },
      { op: 'gorge', path: [[0.82, 0.3], [0.86, 0.9]], depth: 0.2, width: 0.5, wall: 70 },
      { op: 'raise', at: [0.4, 0.45], size: [3, 4], falloff: 1.5, height: 0.2, shape: 'dome' },
      { op: 'raise', at: [0.72, 0.6], size: [2, 3], falloff: 1.2, height: 0.16, shape: 'dome' },
    ],
    why: ['The joints open into cracks and chimneys running up the face.', 'Between them each block bulges a little on its own.'],
  },
  ribbed: {
    id: 'ribbed', title: 'Ribbed face', reads: 'Ribs and flutes running down it, as rain carves a soft rock',
    tile: 24,
    pulse: { swell: 0.1, wave: 6, bump: { height: 0.06, scale: 0.9 } },
    marks: [
      { op: 'ridge', path: [[0.1, 0.1], [0.12, 0.92]], height: 0.24, width: 1.4 },
      { op: 'ridge', path: [[0.34, 0.2], [0.31, 0.95]], height: 0.2, width: 1.2 },
      { op: 'ridge', path: [[0.55, 0.06], [0.57, 0.8]], height: 0.26, width: 1.6 },
      { op: 'ridge', path: [[0.8, 0.15], [0.78, 0.9]], height: 0.18, width: 1.1 },
      { op: 'gorge', path: [[0.45, 0.1], [0.44, 0.85]], depth: 0.18, width: 0.5, wall: 60 },
    ],
    why: ['Water running down a soft face carves flutes and leaves the ribs between.', 'The ribs wander a little; none is ruled.'],
  },
});
export const RELIEF_IDS = Object.freeze(Object.keys(RELIEF_PRESETS));

/** A preset id, a document, or `{ from, …changes }` → the relief, checked. */
export function readRelief(spec) {
  if (typeof spec === 'string') { if (!RELIEF_PRESETS[spec]) no(`'${spec}' is not a relief (reliefs: ${RELIEF_IDS.join(', ')}); or write one`); return readRelief(RELIEF_PRESETS[spec]); }
  if (!isObj(spec)) no('a relief is a preset id or { tile?, pulse?, marks?, why? }');
  let d = spec;
  if (spec.from !== undefined) {
    if (!RELIEF_PRESETS[spec.from]) no(`from: '${spec.from}' is not a relief (reliefs: ${RELIEF_IDS.join(', ')})`);
    const { from, ...rest } = spec; d = merge(RELIEF_PRESETS[from], rest);
  }
  const tile = d.tile ?? 24;
  if (!(Number.isFinite(tile) && tile >= 6 && tile <= 64)) no('tile is the face it covers before it repeats, 6 to 64 metres');
  const p = d.pulse ?? {}, swell = p.swell ?? 0, wave = p.wave ?? 6, bh = p.bump?.height ?? 0, bs = p.bump?.scale ?? 1;
  if (!(swell >= 0 && swell <= RELIEF_MAX)) no(`pulse.swell is metres in and out, 0 to ${RELIEF_MAX}`);
  if (!(wave >= 1 && wave <= tile)) no('pulse.wave is metres from one swell to the next, 1 to the tile');
  if (!(bh >= 0 && bh <= RELIEF_MAX)) no(`pulse.bump.height is metres, 0 to ${RELIEF_MAX}`);
  if (!(bs >= 0.3 && bs <= 6)) no('pulse.bump.scale is the bumps\' size in metres, 0.3 to 6');
  const marks = d.marks ?? [];
  if (!Array.isArray(marks)) no(`marks is a list of ${RELIEF_MARKS.join(', ')}`);
  marks.forEach((m, i) => {
    if (!isObj(m) || !RELIEF_MARKS.includes(m.op)) no(`marks[${i}] is { op, … } with op one of ${RELIEF_MARKS.join(', ')}`);
    if (m.at !== undefined && !isUV(m.at)) no(`marks[${i}].at is [u, v], 0 to 1 of the tile`);
    if (m.path !== undefined && !(Array.isArray(m.path) && m.path.every(isUV))) no(`marks[${i}].path is [[u, v], …], 0 to 1 of the tile`);
    for (const k of ['height', 'depth']) if (m[k] !== undefined && !(m[k] >= 0 && m[k] <= RELIEF_MAX)) no(`marks[${i}].${k} is metres, 0 to ${RELIEF_MAX}`);
  });
  // (the heartbeat's own reader checks each mark, its places in metres)
  readEdits(toMetres(marks, tile), 'relief.marks');
  return { id: d.id ?? null, tile, pulse: { swell, wave, bump: { height: bh, scale: bs } }, marks: marks.map((m) => ({ ...m })), why: d.why ?? [] };
}
const toMetres = (marks, T) => marks.map((m) => ({ ...m, ...(m.at ? { at: m.at.map((v) => v * T) } : {}), ...(m.path ? { path: m.path.map((p) => p.map((v) => v * T)) } : {}) }));

// dice: an integer hash, no Math.random
const hash = (a, b, s) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// value noise on a lattice of n × n cells over the tile, wrapping with it
function wrapNoise(u, v, n, s) {
  const x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), fx = smooth(x - i), fy = smooth(y - j);
  const at = (a, b) => hash(((a % n) + n) % n, ((b % n) + n) % n, s);
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy - 0.5;
}

/** The face's height in and out over the tile, metres (see the header). */
export function reliefMap(R, { seed = 1, cell = 0.1 } = {}) {
  const T = R.tile, size = Math.max(8, Math.round(T / cell)), c = T / size, h = new Float32Array(size * size);
  // (the seed nudges each mark: its place a little along and up the face, its height a fifth either way)
  const marks = R.marks.map((m, i) => {
    const du = (hash(i, 11, seed) - 0.5) * 0.12, dv = (hash(i, 13, seed) - 0.5) * 0.06, k = 0.8 + 0.4 * hash(i, 17, seed), mv = (p) => [p[0] + du, p[1] + dv];
    return { ...m, ...(m.at ? { at: mv(m.at) } : {}), ...(m.path ? { path: m.path.map(mv) } : {}), ...(m.height !== undefined ? { height: Math.min(RELIEF_MAX, m.height * k) } : {}), ...(m.depth !== undefined ? { depth: Math.min(RELIEF_MAX, m.depth * k) } : {}) };
  });
  const fields = readEdits(toMetres(marks, T), 'relief.marks').map(editField).filter(Boolean);
  const nS = Math.max(1, Math.round(T / R.pulse.wave)), nB = Math.max(1, Math.round(T / R.pulse.bump.scale));
  let sum = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5) * c, y = (j + 0.5) * c;
    // (each mark summed over the tile and its neighbours, so a mark near an edge carries over it: the tile wraps)
    let z = 0;
    for (const f of fields) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) z += f(x + a * T, y + b * T);
    z += 2 * R.pulse.swell * wrapNoise(x / T, y / T, nS, seed + 3) + 2 * R.pulse.bump.height * (wrapNoise(x / T, y / T, nB, seed + 5) * 0.7 + wrapNoise(x / T, y / T, nB * 2, seed + 7) * 0.3);
    h[j * size + i] = z; sum += z;
  }
  const mean = sum / h.length; let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < h.length; k++) { h[k] -= mean; lo = Math.min(lo, h[k]); hi = Math.max(hi, h[k]); }
  return { tile: T, cell: c, size, h, lo, hi };
}
