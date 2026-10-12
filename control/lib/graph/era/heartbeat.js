/**
 * THE HEARTBEAT — the ripples and flow of a level's land, as data, apart from its look. Where a geocube says what the
 * land is made of and how it is lit, a heartbeat says how it moves: how hard the walk climbs and drops, the long swell
 * from trailhead to exit, and the few marks that make the place (a cliff, a gorge, a knoll). It holds no colour and no
 * kit: it is seen as a greybox, in values, and a level paints it with its kit, its style or a geocube.
 *
 *   pulse    the dials every trail of the level takes (out-ground.js GROUND_DIALS less its edits): amplitude, depth, …
 *   rise     the level's long swell along its walk: [[v, metres], …], v from 0 (trailhead) to 1 (the last trail's end)
 *   marks    the ground shaped by hand, in the level's RELATIVE frame: u across from 0 (the far side, the kit's cliff)
 *            to 1 (the open side), v along from 0 to 1. Each is an edit (raise, lower, flatten, cliff, gorge, ridge)
 *            with `at: [u, v]` or `path: [[u, v], …]` (a cliff's high side by `high: [u, v]` or `side`); heights,
 *            sizes and widths stay in metres
 *   why      the principles, one line each, for whoever lays a level on it
 *   terrain  the geocube terrain it was made for (a name: 'shore', 'highland'): a level painted by a cube that has one
 *            by that name gets it, unless the level asks for another; the answer says which it got (geocube.js)
 *
 * Because its places are relative and its heights are not, one heartbeat laid on a longer level, another kit or
 * another seed is not the same ground byte for byte, but it is the same ground to walk: the climb comes at the same
 * point of the level, the cliff stands as tall, the gorge cuts as deep. That is what a heartbeat promises.
 *
 *   readHeartbeat(spec)              a preset id, a document, or { from: preset, …changes } → the heartbeat, checked
 *   heartbeatInFrame(hb, frame)      → { tune, edits }: its pulse, and its rise and marks in the level's metres
 *   heartbeatFromLevel(parts, frame) → a heartbeat document from a level's own ground (what tune_ground exports)
 */
import { GROUND_DIALS, GROUND_EDITS, readEdits } from './out-ground.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b === undefined ? a : b);
const no = (msg) => { throw new Error(`heartbeat: ${msg}`); };
const r3 = (v) => Math.round(v * 1000) / 1000;
const isUV = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && v >= -0.25 && v <= 1.25);

/** The heartbeats to start from. A heartbeat is a starter: copy one with `from` and change what the level needs. */
export const HEARTBEAT_PRESETS = Object.freeze({
  'meadow-breath': {
    id: 'meadow-breath', title: 'Meadow breath', reads: 'Low, easy swells; nothing to climb, everything in view',
    pulse: { amplitude: 2.5, depth: 1.5, bump: { height: 0.35 } },
    rise: [[0, 0], [1, 3]],
    marks: [{ op: 'raise', at: [0.82, 0.35], size: [6, 8], falloff: 10, height: 2.5, shape: 'dome' }],
    why: ['The walk never asks for stairs: every climb is a breath.', 'One soft knoll off the walk to stand on and look back from.'],
  },
  ascent: {
    id: 'ascent', title: 'Ascent', reads: 'A level that climbs from start to end, a ridge to walk under',
    pulse: { amplitude: 5, depth: 2 },
    rise: [[0, 0], [0.45, 6], [1, 14]],
    marks: [{ op: 'ridge', path: [[0.86, 0.2], [0.86, 0.72]], height: 3.5, width: 10 }],
    why: ['Every stretch ends higher than it began: the exit is the top.', 'Dips are shallow; the climbs are what the walk remembers.', 'A ridge on the open side holds the eye up the slope.'],
  },
  'broken-ground': {
    id: 'broken-ground', title: 'Broken ground', reads: 'A step up a cliff, then a gorge to cross: the land is in the way',
    pulse: { amplitude: 6, depth: 5, bump: { height: 1.2 } },
    marks: [
      { op: 'cliff', path: [[0.45, 0.3], [1, 0.3]], height: 5, high: [0.8, 0.45] },
      { op: 'gorge', path: [[0.3, 0.6], [1, 0.6]], depth: 5, width: 5 },
    ],
    why: ['The land is the obstacle: a face to climb, a cut to cross.', 'Between them the ground is rough underfoot.'],
  },
  cliffside: {
    id: 'cliffside', title: 'Cliffside', reads: 'A walk pressed between the far cliff and a wall on the open side',
    pulse: { amplitude: 4, depth: 3, cliff: { height: 18, face: 80 } },
    marks: [{ op: 'cliff', path: [[0.78, 0.15], [0.78, 0.85]], height: 8, high: [0.95, 0.5], reach: 10 }],
    why: ['High walls on both sides: the sky is a strip.', 'The open side opens only at the ends.'],
  },
});
export const HEARTBEAT_IDS = Object.freeze(Object.keys(HEARTBEAT_PRESETS));

const KEYS = ['id', 'title', 'reads', 'pulse', 'rise', 'marks', 'why', 'terrain', 'source'];
const MARK_OPS = Object.keys(GROUND_EDITS).filter((k) => k !== 'rise');

/** A preset id, a whole document, or { from: preset, …changes } (merged key by key; arrays are replaced) → the heartbeat. */
export function readHeartbeat(spec) {
  if (typeof spec === 'string') {
    if (!HEARTBEAT_PRESETS[spec]) no(`'${spec}' is not a preset (presets: ${HEARTBEAT_IDS.join(', ')}); or write the heartbeat`);
    return readHeartbeat(structuredClone(HEARTBEAT_PRESETS[spec]));
  }
  if (!isObj(spec)) no('a heartbeat is a preset id or a document { id, pulse?, rise?, marks?, why? }');
  if (spec.from !== undefined) {
    const { from, ...rest } = spec;
    if (!HEARTBEAT_PRESETS[from]) no(`from: '${from}' is not a preset (presets: ${HEARTBEAT_IDS.join(', ')})`);
    return readHeartbeat(merge(structuredClone(HEARTBEAT_PRESETS[from]), { id: `${from}-variant`, ...rest }));
  }
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) no(`'${k}' is not a setting (a heartbeat: ${KEYS.join(', ')})`);
  const h = structuredClone(spec);
  if (typeof h.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(h.id)) no('id is a lowercase slug');
  h.title ??= h.id; h.reads ??= '';
  if (typeof h.title !== 'string' || typeof h.reads !== 'string' || h.reads.length > 200) no('title and reads are words (reads: 200 characters at most)');
  if (h.source !== undefined && typeof h.source !== 'string') no('source is where it was cloned from, in words or a ref');
  if (h.terrain !== undefined && !(typeof h.terrain === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(h.terrain))) no('terrain is the name of the geocube terrain it was made for, a lowercase slug');
  // pulse: the trail's dials (checked by the trail's own reader)
  h.pulse ??= {};
  if (!isObj(h.pulse)) no(`pulse is the dials { ${Object.keys(GROUND_DIALS).filter((k) => k !== 'edits').join(', ')} }`);
  if (h.pulse.edits !== undefined) no('pulse.edits: a heartbeat\'s edits are its marks, in the relative frame');
  // rise
  if (h.rise !== undefined) {
    if (!Array.isArray(h.rise) || h.rise.length < 2 || !h.rise.every((p) => Array.isArray(p) && p.length === 2 && p[0] >= 0 && p[0] <= 1 && Number.isFinite(p[1]) && Math.abs(p[1]) <= 60)) no('rise is two or more [v, metres]: v from 0 (the trailhead) to 1 (the end), the height there (±60)');
    h.rise = h.rise.map((p) => [...p]).sort((a, b) => a[0] - b[0]);
  }
  // marks
  h.marks ??= [];
  if (!Array.isArray(h.marks) || h.marks.length > 32) no('marks is a list of at most 32 edits in the relative frame');
  h.marks.forEach((m, i) => {
    const at = `marks[${i}]`;
    if (!isObj(m) || !MARK_OPS.includes(m.op)) no(`${at} is { op, … } with op one of ${MARK_OPS.join(', ')}`);
    if (m.at !== undefined && !isUV(m.at)) no(`${at}.at is [u, v]: u across (0 the far side, 1 the open side), v along (0 the trailhead, 1 the end)`);
    if (m.path !== undefined && (!Array.isArray(m.path) || m.path.length < 2 || !m.path.every(isUV))) no(`${at}.path is two or more [u, v]`);
    if (m.high !== undefined && (m.op !== 'cliff' || !isUV(m.high))) no(`${at}.high is a cliff's: a place [u, v] on its high side`);
    if (m.op === 'cliff' && (m.high === undefined) === (m.side === undefined)) no(`${at}: a cliff names its high side, by a place on it (high: [u, v]) or as left | right of its path (side)`);
  });
  // why
  h.why ??= [];
  if (!Array.isArray(h.why) || !h.why.every((w) => typeof w === 'string' && w.length && w.length <= 200)) no('why is the principles, one line each (200 characters at most)');
  // every mark must make an edit once placed: checked against a unit frame
  heartbeatInFrame(h, { x0: 0, x1: 100, length: 100 });
  return h;
}

/** The side of a path a place stands on: 'left' (of the way walked from its first place) or 'right'. */
export function sideOf(path, [hx, hy]) {
  const [ax, ay] = path[0], [bx, by] = path[path.length - 1], cross = (bx - ax) * (hy - ay) - (by - ay) * (hx - ax);
  if (Math.abs(cross) < 1e-9) return null;
  return cross > 0 ? 'left' : 'right';
}

/** The heartbeat in a level's frame ({ x0, x1, length }, metres): its pulse as dials, its rise and marks as edits. */
export function heartbeatInFrame(h, F) {
  const W = F.x1 - F.x0, X = (u) => r3(F.x0 + u * W), Y = (v) => r3(v * F.length), P = ([u, v]) => [X(u), Y(v)];
  const edits = [];
  if (h.rise) edits.push({ op: 'rise', id: 'heartbeat-rise', points: h.rise.map(([v, z]) => [Y(v), z]) });
  h.marks.forEach((m, i) => {
    const { high, ...e } = m, out = { ...e, id: e.id ?? `heartbeat-${i + 1}` };
    if (m.at) out.at = P(m.at);
    if (m.path) out.path = m.path.map(P);
    if (high) {
      out.side = sideOf(out.path, P(high));
      if (!out.side) no(`marks[${i}].high is on the cliff's line: name a place to one side of it`);
    }
    edits.push(out);
  });
  try { readEdits(edits, 'heartbeat'); } catch (err) { no(err.message.replace(/^stage: heartbeat/, 'marks')); }
  return { tune: Object.keys(h.pulse).length ? structuredClone(h.pulse) : null, edits };
}

/**
 * A heartbeat from a level's own ground: `parts` is { tune, edits } in the level's metres (rise edits included) and
 * `meta` its { id, title?, reads?, why?, source? }. Places become relative to the frame; several rises sum into one.
 */
export function heartbeatFromLevel({ tune, edits }, F, meta) {
  const W = F.x1 - F.x0, U = (x) => r3((x - F.x0) / W), V = (y) => r3(y / F.length), UV = ([x, y]) => [U(x), V(y)];
  const rises = edits.filter((e) => e.op === 'rise'), marks = [];
  for (const e of edits) {
    if (e.op === 'rise') continue;
    const { id, ...m } = e, out = { ...m, ...(id && !/^heartbeat-\d+$/.test(id) ? { id } : {}) };
    if (e.at) out.at = UV(e.at);
    if (e.path) out.path = e.path.map(UV);
    marks.push(out);
  }
  let rise;
  if (rises.length) {
    const ys = [...new Set(rises.flatMap((e) => e.points.map((p) => p[0])))].sort((a, b) => a - b);
    const at = (e, y) => { const p = e.points; if (y <= p[0][0]) return p[0][1]; if (y >= p[p.length - 1][0]) return p[p.length - 1][1]; let k = 0; while (y > p[k + 1][0]) k++; const t = (y - p[k][0]) / (p[k + 1][0] - p[k][0]); return p[k][1] + (p[k + 1][1] - p[k][1]) * t * t * (3 - 2 * t); };
    rise = ys.map((y) => [Math.max(0, Math.min(1, V(y))), r3(rises.reduce((s, e) => s + at(e, y), 0))]);
    rise = rise.filter((p, i) => i === 0 || p[0] - rise[i - 1][0] >= 0.005);
  }
  return readHeartbeat({ id: meta.id, ...(meta.title ? { title: meta.title } : {}), ...(meta.reads ? { reads: meta.reads } : {}),
    pulse: tune ? structuredClone(tune) : {}, ...(rise && rise.length >= 2 ? { rise } : {}), marks, why: meta.why ?? [], ...(meta.terrain ? { terrain: meta.terrain } : {}), ...(meta.source ? { source: meta.source } : {}) });
}
