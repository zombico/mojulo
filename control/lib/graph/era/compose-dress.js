/**
 * THE DRESSING (the scene composer, era/compose.js): the things a composed room holds, laid as a sane default the
 * operator then changes. Each thing is an ITEM in the recipe (`props`), laid once at authoring time (compose-lay.js) and
 * read by the build; an item is edited, moved or removed by update_sketch's own patch, by its id, and the room keeps
 * the rest as they were.
 *
 *   PIECES        { kind: { class, w, d, h, stack?, solid?, parts: [[u0, u1, v0, v1, z0, z1, surface] | ['prism', u, v,
 *                 r, z0, z1, sides, surface]] } }: a piece in its own frame (u along the wall it backs on, v out from
 *                 it, z up, metres), each part painted with a surface of the kit (so a piece takes the composed palette);
 *                 `class` what it is to breakability (playscape/destruct/breakability.js), `stack` how many high it
 *                 stands, `solid: false` for a thing that blocks nothing (a sign)
 *   PIECE_SETS    the pieces a dressing lays (style/bay-axes.js DRESSINGS)
 *   SET_PIECES    the set piece a role stands at its focus (compose-roles.js ROLES), a register's great object its own
 *   keepOuts(plan) → [{ room, kind, min, max } | { room, kind: 'sight', a, b, half }]: where nothing stands: a doorway's
 *                 approach (construction/circulation.js: the game stair's door depth), a stair, its foot and its head, a
 *                 doorway's sightline to its room's focus
 *   layProps(plan) → [{ id, kind, room, at: [x, y], facing, level?, scale?, set?, wall? }]: the default; ids are places
 *                 (`hall/+y/crate-2`, `hall/focus/generator`); a set piece the focus's doorway approach or stair takes
 *                 moves to the nearest clear place, it is not dropped; a great object scaled with its room (`scale`)
 *   propFaces(plan, items, surf) → { faces, anchors }: each item's faces named by its id (`node`), an anchor each (kind
 *                 'prop', its class the form) so a collider stands for it and breakability can take it
 *   dressLaws(plan, items) → laws: no item in a keep-out, every focus's sightline clear, each room's count
 */
import { box, r5 } from './geom.js';
import { STAIR_PROFILES } from '../construction/circulation.js';
import { STOCK, GREAT, EXTINGUISHER, roleOf, stockLaws } from './stocking.js';

const B = (u0, u1, v0, v1, z0, z1, s) => [u0, u1, v0, v1, z0, z1, s];
export const PIECES = Object.freeze({
  crate: { class: 'crate', w: 1, d: 1, h: 0.9, stack: 3, parts: [B(0.03, 0.97, 0.03, 0.97, 0.08, 0.82, 'cabinet'), B(0, 1, 0, 1, 0, 0.08, 'beam'), B(0, 1, 0, 1, 0.82, 0.9, 'beam')] },
  'ammo-can': { class: 'crate', w: 0.5, d: 0.3, h: 0.35, stack: 4, parts: [B(0, 0.5, 0, 0.3, 0, 0.3, 'paint'), B(0.02, 0.48, 0.02, 0.28, 0.3, 0.35, 'trim')] },
  drum: { class: 'barrel', w: 0.62, d: 0.62, h: 0.9, stack: 1, parts: [['prism', 0.31, 0.31, 0.3, 0, 0.9, 8, 'services'], ['prism', 0.31, 0.31, 0.31, 0.28, 0.34, 8, 'trim'], ['prism', 0.31, 0.31, 0.31, 0.6, 0.66, 8, 'trim']] },
  'tool-chest': { class: 'lockers', w: 0.8, d: 0.5, h: 1.0, parts: [B(0, 0.8, 0, 0.5, 0.05, 1.0, 'paint'), B(0.02, 0.78, 0.5, 0.52, 0.2, 0.9, 'trim'), B(0.05, 0.75, 0.05, 0.45, 0, 0.05, 'beam')] },
  rack: { class: 'rack', w: 2.7, d: 1.0, h: 3.0, parts: [B(0, 0.1, 0, 0.1, 0, 3, 'column'), B(2.6, 2.7, 0, 0.1, 0, 3, 'column'), B(0, 0.1, 0.9, 1, 0, 3, 'column'), B(2.6, 2.7, 0.9, 1, 0, 3, 'column'),
    B(0, 2.7, 0.9, 1, 1.0, 1.12, 'paint'), B(0, 2.7, 0.9, 1, 2.0, 2.12, 'paint'), B(0.1, 2.6, 0.1, 0.9, 1.12, 1.16, 'grate'), B(0.1, 2.6, 0.1, 0.9, 2.12, 2.16, 'grate'),
    B(0.2, 1.2, 0.15, 0.85, 1.16, 1.86, 'cabinet'), B(1.4, 2.4, 0.15, 0.85, 1.16, 1.7, 'cabinet'), B(0.4, 1.4, 0.15, 0.85, 2.16, 2.8, 'cabinet'), B(0.3, 2.4, 0.1, 0.9, 0, 0.7, 'cabinet')] },
  cart: { class: 'cart', w: 1.0, d: 0.6, h: 0.95, parts: [B(0, 1, 0, 0.6, 0.15, 0.25, 'services'), B(0, 1, 0, 0.6, 0.65, 0.72, 'services'), B(0, 0.04, 0, 0.6, 0.15, 0.95, 'trim'), B(0.96, 1, 0, 0.04, 0.15, 0.72, 'trim'),
    B(0.96, 1, 0.56, 0.6, 0.15, 0.72, 'trim'), B(0.05, 0.15, 0.05, 0.15, 0, 0.15, 'beam'), B(0.85, 0.95, 0.45, 0.55, 0, 0.15, 'beam')] },
  bench: { class: 'bench', w: 2.4, d: 0.8, h: 0.92, parts: [B(0, 2.4, 0, 0.8, 0.86, 0.92, 'cabinet'), B(0.05, 1.0, 0.05, 0.75, 0, 0.86, 'cabinet'), B(1.6, 2.35, 0.05, 0.75, 0, 0.86, 'cabinet'), B(0, 2.4, 0, 0.06, 0.92, 1.6, 'services')] },
  'fume-hood': { class: 'lockers', w: 1.5, d: 0.85, h: 2.4, parts: [B(0, 1.5, 0, 0.85, 0, 0.9, 'cabinet'), B(0, 1.5, 0, 0.85, 1.7, 2.4, 'cabinet'), B(0, 0.08, 0, 0.85, 0.9, 1.7, 'cabinet'), B(1.42, 1.5, 0, 0.85, 0.9, 1.7, 'cabinet'), B(0.08, 1.42, 0, 0.1, 0.9, 1.7, 'services')] },
  'instrument-rack': { class: 'rack', w: 0.6, d: 0.8, h: 2.0, parts: [B(0, 0.6, 0, 0.8, 0, 2.0, 'cabinet'), B(0.05, 0.55, 0.8, 0.82, 0.3, 0.6, 'services'), B(0.05, 0.55, 0.8, 0.82, 0.8, 1.3, 'trim'), B(0.05, 0.55, 0.8, 0.82, 1.5, 1.8, 'services')] },
  desk: { class: 'bench', w: 1.6, d: 0.8, h: 0.75, parts: [B(0, 1.6, 0, 0.8, 0.71, 0.75, 'cabinet'), B(0.02, 0.08, 0.05, 0.75, 0, 0.71, 'trim'), B(1.52, 1.58, 0.05, 0.75, 0, 0.71, 'trim'), B(1.1, 1.5, 0.05, 0.75, 0.1, 0.71, 'cabinet')] },
  filing: { class: 'lockers', w: 0.5, d: 0.62, h: 1.32, parts: [B(0, 0.5, 0, 0.62, 0, 1.32, 'cabinet'), B(0.03, 0.47, 0.62, 0.64, 0.05, 1.27, 'trim')] },
  locker: { class: 'lockers', w: 0.4, d: 0.5, h: 1.9, parts: [B(0, 0.4, 0, 0.5, 0, 1.9, 'paint'), B(0.03, 0.37, 0.5, 0.52, 1.5, 1.6, 'trim')] },
  // a military base's stock (stocking.js): what its rooms hold, as a supply chain stocks them. The load-bearing ones are
  // read by play: sandbags and barriers are cover (a boulder's class: they take a beating), a container is climbed
  bunk: { class: 'bench', w: 2.0, d: 0.9, h: 1.75, parts: [B(0, 0.05, 0, 0.05, 0, 1.75, 'trim'), B(1.95, 2, 0, 0.05, 0, 1.75, 'trim'), B(0, 0.05, 0.85, 0.9, 0, 1.75, 'trim'), B(1.95, 2, 0.85, 0.9, 0, 1.75, 'trim'),
    B(0.05, 1.95, 0.05, 0.85, 0.35, 0.43, 'beam'), B(0.08, 1.92, 0.08, 0.82, 0.43, 0.56, 'cabinet'), B(0.05, 1.95, 0.05, 0.85, 1.12, 1.2, 'beam'), B(0.08, 1.92, 0.08, 0.82, 1.2, 1.33, 'cabinet'), B(0.05, 1.95, 0.85, 0.9, 1.42, 1.47, 'trim')] },
  footlocker: { class: 'crate', w: 0.8, d: 0.45, h: 0.45, parts: [B(0, 0.8, 0, 0.45, 0, 0.42, 'paint'), B(0.01, 0.79, 0.01, 0.44, 0.42, 0.45, 'trim')] },
  'weapon-rack': { class: 'rack', w: 1.6, d: 0.45, h: 1.8, parts: [B(0, 1.6, 0, 0.45, 0, 0.12, 'beam'), B(0, 1.6, 0, 0.05, 0.12, 1.8, 'trim'), B(0, 1.6, 0, 0.22, 1.55, 1.6, 'trim'), B(0, 1.6, 0.26, 0.3, 0.88, 0.94, 'paint'),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => B(0.1 + i * 0.185, 0.15 + i * 0.185, 0.1, 0.2, 0.12, 1.22, 'cabinet'))] },
  'ammo-crate': { class: 'crate', w: 1.0, d: 0.55, h: 0.45, stack: 3, parts: [B(0, 1, 0, 0.55, 0, 0.4, 'paint'), B(0.02, 0.98, 0.02, 0.53, 0.4, 0.45, 'trim'), B(0, 0.04, 0.2, 0.35, 0.18, 0.27, 'trim'), B(0.96, 1, 0.2, 0.35, 0.18, 0.27, 'trim')] },
  sandbags: { class: 'boulder', w: 1.8, d: 0.7, h: 0.96, parts: [B(0, 0.58, 0, 0.7, 0, 0.32, 'concrete'), B(0.61, 1.19, 0, 0.7, 0, 0.32, 'concrete'), B(1.22, 1.8, 0, 0.7, 0, 0.32, 'concrete'),
    B(0.3, 0.88, 0.05, 0.65, 0.32, 0.64, 'concrete'), B(0.91, 1.49, 0.05, 0.65, 0.32, 0.64, 'concrete'), B(0.1, 0.68, 0.1, 0.6, 0.64, 0.96, 'concrete'), B(0.71, 1.29, 0.1, 0.6, 0.64, 0.96, 'concrete'), B(1.32, 1.75, 0.1, 0.6, 0.64, 0.96, 'concrete')] },
  barrier: { class: 'boulder', w: 2.0, d: 0.6, h: 0.85, parts: [B(0, 2, 0, 0.6, 0, 0.25, 'concrete'), B(0, 2, 0.12, 0.48, 0.25, 0.55, 'concrete'), B(0, 2, 0.18, 0.42, 0.55, 0.85, 'concrete'), B(0, 2, 0.17, 0.43, 0.68, 0.76, 'paint')] },
  container: { class: 'lockers', w: 6.0, d: 2.4, h: 2.6, parts: [B(0, 6, 0, 2.4, 0.15, 2.45, 'services'), B(0, 6, 0, 2.4, 0, 0.15, 'beam'), B(0, 6, 0, 2.4, 2.45, 2.6, 'beam'), B(0, 0.12, 0, 2.4, 0.15, 2.45, 'beam'), B(5.88, 6, 0, 2.4, 0.15, 2.45, 'trim'),
    ...[1, 2, 3, 4, 5].map((i) => B(i - 0.04, i + 0.04, 2.4, 2.43, 0.2, 2.4, 'beam'))] },
  'radio-console': { class: 'bench', w: 1.8, d: 0.8, h: 1.6, parts: [B(0, 1.8, 0, 0.8, 0.7, 0.75, 'cabinet'), B(0, 0.5, 0, 0.75, 0, 0.7, 'cabinet'), B(1.3, 1.8, 0, 0.75, 0, 0.7, 'cabinet'), B(0.1, 1.7, 0, 0.45, 0.75, 1.55, 'services'), B(0.15, 1.65, 0.45, 0.47, 0.85, 1.45, 'trim')] },
  'ops-table': { class: 'set-piece', w: 3.2, d: 1.8, h: 0.95, parts: [B(0.3, 2.9, 0.3, 1.5, 0, 0.85, 'cabinet'), B(0, 3.2, 0, 1.8, 0.85, 0.95, 'paint'), B(0.1, 3.1, 0.1, 1.7, 0.95, 0.97, 'trim')] },
  'mess-table': { class: 'bench', w: 2.4, d: 1.8, h: 0.76, parts: [B(0, 2.4, 0.5, 1.3, 0.72, 0.76, 'cabinet'), B(0.1, 0.18, 0.55, 1.25, 0, 0.72, 'trim'), B(2.22, 2.3, 0.55, 1.25, 0, 0.72, 'trim'),
    B(0, 2.4, 0.05, 0.4, 0.42, 0.46, 'cabinet'), B(0, 2.4, 1.4, 1.75, 0.42, 0.46, 'cabinet'), B(0.1, 0.15, 0.1, 0.35, 0, 0.42, 'trim'), B(2.25, 2.3, 0.1, 0.35, 0, 0.42, 'trim'), B(0.1, 0.15, 1.45, 1.7, 0, 0.42, 'trim'), B(2.25, 2.3, 1.45, 1.7, 0, 0.42, 'trim')] },
  cot: { class: 'bench', w: 2.0, d: 0.85, h: 0.65, parts: [B(0, 2, 0, 0.85, 0.5, 0.55, 'trim'), B(0.05, 1.95, 0.05, 0.8, 0.55, 0.65, 'cabinet'), B(0, 0.05, 0, 0.05, 0, 0.5, 'trim'), B(1.95, 2, 0, 0.05, 0, 0.5, 'trim'), B(0, 0.05, 0.8, 0.85, 0, 0.5, 'trim'), B(1.95, 2, 0.8, 0.85, 0, 0.5, 'trim')] },
  switchgear: { class: 'lockers', w: 2.4, d: 0.6, h: 2.2, parts: [B(0, 2.4, 0, 0.6, 0, 0.1, 'beam'), B(0, 2.4, 0, 0.6, 0.1, 2.2, 'cabinet'), B(0.79, 0.81, 0.6, 0.62, 0.2, 2.1, 'trim'), B(1.59, 1.61, 0.6, 0.62, 0.2, 2.1, 'trim')] },
  pump: { class: 'barrel', w: 1.6, d: 0.9, h: 1.1, parts: [B(0, 1.6, 0, 0.9, 0, 0.15, 'beam'), ['prism', 0.45, 0.45, 0.35, 0.15, 0.95, 10, 'paint'], ['prism', 1.15, 0.45, 0.32, 0.15, 0.75, 10, 'services'], B(1.1, 1.2, 0.4, 0.5, 0.75, 1.1, 'trim')] },
  'sink-row': { class: 'bench', w: 2.4, d: 0.55, h: 1.8, parts: [B(0, 2.4, 0, 0.55, 0.8, 0.9, 'cabinet'), B(0, 2.4, 0, 0.5, 0, 0.8, 'trim'), B(0, 2.4, 0, 0.02, 1.2, 1.8, 'services')] },
  washer: { class: 'lockers', w: 0.7, d: 0.7, h: 0.9, parts: [B(0, 0.7, 0, 0.7, 0, 0.9, 'services'), ['prism', 0.35, 0.7, 0.2, 0.3, 0.32, 12, 'trim']] },
  // (it blocks nothing: a can on a bracket by a door, at hand height)
  extinguisher: { class: 'sign', w: 0.25, d: 0.2, h: 1.45, solid: false, parts: [B(0.05, 0.2, 0, 0.02, 0.9, 1.4, 'trim'), ['prism', 0.125, 0.1, 0.08, 0.95, 1.45, 8, 'paint']] },
  // the set pieces: a register's great object, a find, a prize on its pedestal, a sign over the way on
  generator: { class: 'set-piece', w: 3.2, d: 2.0, h: 2.4, parts: [B(0, 3.2, 0, 2.0, 0, 0.25, 'beam'), B(0.2, 2.2, 0.2, 1.8, 0.25, 2.0, 'services'), B(2.3, 3.0, 0.4, 1.6, 0.25, 1.4, 'paint'), ['prism', 1.2, 1.0, 0.45, 2.0, 2.4, 8, 'trim']] },
  press: { class: 'set-piece', w: 3.0, d: 2.2, h: 3.6, parts: [B(0, 0.4, 0, 2.2, 0, 3.6, 'column'), B(2.6, 3.0, 0, 2.2, 0, 3.6, 'column'), B(0, 3.0, 0, 2.2, 3.0, 3.6, 'paint'), B(0.5, 2.5, 0.3, 1.9, 0, 0.9, 'paint'), B(0.7, 2.3, 0.5, 1.7, 1.6, 2.6, 'services')] },
  centrifuge: { class: 'set-piece', w: 2.6, d: 2.6, h: 2.2, parts: [['prism', 1.3, 1.3, 1.3, 0, 0.3, 12, 'beam'], ['prism', 1.3, 1.3, 1.1, 0.3, 1.6, 12, 'cabinet'], ['prism', 1.3, 1.3, 0.7, 1.6, 2.2, 12, 'services']] },
  sculpture: { class: 'set-piece', w: 1.6, d: 1.6, h: 2.6, parts: [B(0, 1.6, 0, 1.6, 0, 0.5, 'concrete'), B(0.3, 1.2, 0.35, 1.25, 0.5, 1.7, 'paint'), B(0.5, 1.4, 0.2, 1.0, 1.7, 2.6, 'concrete')] },
  find: { class: 'crate', w: 0.8, d: 0.5, h: 0.45, parts: [B(0, 0.8, 0, 0.5, 0, 0.4, 'paint'), B(0.02, 0.78, 0.02, 0.48, 0.4, 0.45, 'trim')] },
  prize: { class: 'set-piece', w: 0.9, d: 0.9, h: 1.45, parts: [B(0, 0.9, 0, 0.9, 0, 1.0, 'concrete'), B(0.2, 0.7, 0.25, 0.65, 1.0, 1.4, 'paint'), B(0.18, 0.72, 0.23, 0.67, 1.4, 1.45, 'trim')] },
  sign: { class: 'sign', w: 1.4, d: 0.06, h: 0.5, solid: false, parts: [B(0, 1.4, 0, 0.06, 0, 0.5, 'paint')] },
});
export const PIECE_SETS = Object.freeze({
  military: Object.freeze(['crate', 'ammo-can', 'drum', 'tool-chest']),
  utility: Object.freeze(['rack', 'drum', 'cart', 'crate']),
  science: Object.freeze(['bench', 'instrument-rack', 'fume-hood', 'cart']),
  everyday: Object.freeze(['desk', 'filing', 'locker', 'cart']),
});
export const SET_PIECES = Object.freeze({
  'great-object': Object.freeze({ military: 'generator', utility: 'press', science: 'centrifuge', everyday: 'sculpture' }),
  find: 'find', prize: 'prize', sign: 'sign',
});
// how many clusters a room's role takes (a passage is left clear), and a dark mood's clutter in a dead end
const CLUSTERS = Object.freeze({ arrival: 1, passage: 0, landmark: 2, pocket: 2, climax: 1, rest: 1 });
const CLUTTER = Object.freeze({ even: 0, drama: 0, noir: 1 });
// a room's clear edge (off its walls' faces, its corners), a sightline's half width, the gap between pieces abreast
const EDGE = 0.5, SIGHT = 0.8, GAP = 0.08;
const SIDES = Object.freeze(['-y', '+y', '-x', '+x']);
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// a doorway in a room: its middle, its span along the wall, the axis of its wall and the way it opens into the room
function openingsOf(plan, r) {
  const out = [];
  for (const l of plan.links || []) {
    if (l.from !== r.id && l.to !== r.id) continue;
    const X = l.wall.endsWith('x'), s = l.wall.startsWith('+') ? 1 : -1, into = l.to === r.id ? s : -s;
    out.push({ at: l.at, lo: l.lo, hi: l.hi, X, into });
  }
  for (const w of plan.ways || []) {
    if (w.room !== r.id) continue;
    const X = w.side.endsWith('x'), s = w.side.startsWith('+') ? 1 : -1;
    out.push({ at: w.at, lo: w.lo, hi: w.hi, X, into: -s });
  }
  return out;
}

/** Where nothing stands: each doorway's approach, each stair with its foot and head, each doorway's sightline to the focus. */
export function keepOuts(plan) {
  const depth = STAIR_PROFILES.game.door, roles = new Map((plan.compose?.roles || []).map((R) => [R.room, R])), out = [];
  for (const r of plan.rooms) {
    const R = roles.get(r.id);
    for (const o of openingsOf(plan, r)) {
      const a = [o.at, o.at + o.into * depth].sort((x, y) => x - y), lo = o.lo - 0.6, hi = o.hi + 0.6;
      out.push({ room: r.id, kind: 'door', min: o.X ? [a[0], lo] : [lo, a[0]], max: o.X ? [a[1], hi] : [hi, a[1]] });
      if (R) { const m = (o.lo + o.hi) / 2; out.push({ room: r.id, kind: 'sight', a: o.X ? [o.at, m] : [m, o.at], b: [R.focus[0], R.focus[1]], half: SIGHT }); }
    }
  }
  for (const s of plan.stairs || []) {
    const [x0, y0, x1, y1] = s.rect;
    for (const id of [s.lower, s.upper]) out.push({ room: id, kind: 'stair', min: [x0 - 1, y0 - 1], max: [x1 + 1, y1 + 1] });
    for (const p of [s.approach, s.arrival]) if (p) for (const id of [s.lower, s.upper]) out.push({ room: id, kind: 'stair', min: [p[0] - 1.2, p[1] - 1.2], max: [p[0] + 1.2, p[1] + 1.2] });
  }
  return out;
}

// a footprint against a keep-out: rectangles overlapping, or a rectangle within a sightline's half width of its segment
const hits = (k, mn, mx) => {
  if (k.kind !== 'sight') return mn[0] < k.max[0] && mx[0] > k.min[0] && mn[1] < k.max[1] && mx[1] > k.min[1];
  const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2], e = [(mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2];
  const d = [k.b[0] - k.a[0], k.b[1] - k.a[1]], L2 = d[0] * d[0] + d[1] * d[1] || 1, t = Math.max(0, Math.min(1, ((c[0] - k.a[0]) * d[0] + (c[1] - k.a[1]) * d[1]) / L2));
  const q = [k.a[0] + d[0] * t, k.a[1] + d[1] * t];
  return Math.abs(c[0] - q[0]) < e[0] + k.half && Math.abs(c[1] - q[1]) < e[1] + k.half;
};

/** An item's footprint (plan): its piece's w along the wall it backs on, d out from it, its centre at `at`. */
export function footprintOf(it) {
  const P = PIECES[it.kind], k = it.scale ?? 1, along = it.facing.endsWith('y'), hw = ((along ? P.w : P.d) * k) / 2, hd = ((along ? P.d : P.w) * k) / 2;
  return { min: [it.at[0] - hw, it.at[1] - hd], max: [it.at[0] + hw, it.at[1] + hd] };
}

/** The default dressing of a composed plan: a set piece at each focus its role names, clusters along the walls. */
export function layProps(plan) {
  const C = plan.compose, reg = C.axes.dressing, set = PIECE_SETS[reg], keep = keepOuts(plan), items = [];
  const off = (plan.kit?.B?.pilaster?.out ?? 0.1) + 0.05;
  const free = (r, mn, mx) => mn[0] >= r.x0 + 0.05 && mx[0] <= r.x1 - 0.05 && mn[1] >= r.y0 + 0.05 && mx[1] <= r.y1 - 0.05
    && !keep.some((k) => k.room === r.id && hits(k, mn, mx))
    && !items.some((o) => { if (o.room !== r.id || o.wall) return false; const f = footprintOf(o); return mn[0] < f.max[0] + GAP && mx[0] > f.min[0] - GAP && mn[1] < f.max[1] + GAP && mx[1] > f.min[1] - GAP; });
  const add = (it, P, dice) => {
    const base = it.id, idx = items.filter((o) => o.id.startsWith(`${base}-`) && !o.id.includes('@')).length + 1;
    it.id = `${base}-${idx}`;
    items.push(it);
    // (a piece that stacks, stacked: up to its own height, by the dice)
    const high = P.stack ? 1 + Math.floor(dice() * P.stack) : 1;
    for (let lv = 1; lv < high && (lv + 1) * P.h <= plan.rooms.find((x) => x.id === it.room).h - 0.6; lv++) items.push({ ...it, id: `${it.id}@${lv}`, level: lv });
  };
  // a room's stock line: `n` of a piece along its walls (backs to them, the walls in the dice's order, each filled
  // from its start), or in rows about its middle (aisles between them), as many as stand clear
  const layStock = (r, kind, n, where, dice) => {
    const P = PIECES[kind];
    let placed = 0;
    // (a centre line its middle cannot hold, a doorway's sightline across it, lays the rest along the walls)
    if (where === 'centre') { placed = layCentre(r, kind, n, dice); if (placed >= n) return; n -= placed; placed = 0; }
    {
      // (the walls in the dice's order: a seeded shuffle, never a sort by a random comparator)
      const sides = [...SIDES];
      for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(dice() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
      for (const side of sides) {
        const X = side.endsWith('x'), facing = side.startsWith('-') ? `+${side[1]}` : `-${side[1]}`;
        const v = side.startsWith('-') ? (X ? r.x0 : r.y0) + off + P.d / 2 : (X ? r.x1 : r.y1) - off - P.d / 2;
        for (let u = (X ? r.y0 : r.x0) + EDGE + P.w / 2; placed < n && u <= (X ? r.y1 : r.x1) - EDGE - P.w / 2; u += 0.25) {
          const it = { id: `${r.id}/${side}/${kind}`, kind, room: r.id, at: X ? [r5(v), r5(u)] : [r5(u), r5(v)], facing }, f = footprintOf(it);
          if (!free(r, f.min, f.max)) continue;
          add(it, P, dice); placed++; u += P.w + GAP - 0.25;
        }
        if (placed >= n) break;
      }
    }
  };
  const layCentre = (r, kind, n, dice) => {
    const P = PIECES[kind];
    let placed = 0;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, alongX = r.x1 - r.x0 >= r.y1 - r.y0, facing = alongX ? '+y' : '+x';
    const sw = P.w + 1.0, sd = P.d + 1.2, spots = [];
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) spots.push(alongX ? [cx + i * sw, cy + j * sd] : [cx + j * sd, cy + i * sw]);
    spots.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    for (const q of spots) {
      if (placed >= n) break;
      const it = { id: `${r.id}/centre/${kind}`, kind, room: r.id, at: [r5(q[0]), r5(q[1])], facing }, f = footprintOf(it);
      if (f.min[0] < r.x0 + EDGE || f.max[0] > r.x1 - EDGE || f.min[1] < r.y0 + EDGE || f.max[1] > r.y1 - EDGE || !free(r, f.min, f.max)) continue;
      add(it, P, dice); placed++;
    }
    return placed;
  };
  // an extinguisher beside each doorway of a stocked room, on its wall, past the doorway's approach
  const layExtinguishers = (r) => {
    const P = PIECES[EXTINGUISHER];
    for (const o of openingsOf(plan, r)) {
      const facing = o.X ? (o.into > 0 ? '+x' : '-x') : o.into > 0 ? '+y' : '-y', v = o.at + o.into * (off + P.d / 2);
      for (const u of [o.hi + 0.75, o.lo - 0.75]) {
        const it = { id: `${r.id}/door/${EXTINGUISHER}`, kind: EXTINGUISHER, room: r.id, at: o.X ? [r5(v), r5(u)] : [r5(u), r5(v)], facing }, f = footprintOf(it);
        if (f.min[0] < r.x0 || f.max[0] > r.x1 || f.min[1] < r.y0 || f.max[1] > r.y1 || !free(r, f.min, f.max)) continue;
        add(it, P, () => 0);
        break;
      }
    }
  };
  for (const R of C.roles) {
    const r = plan.rooms.find((x) => x.id === R.room), dice = mulberry32(hashOf(`props|${r.id}`));
    // the set piece its role names: at the focus a great object, a find, a prize; over the way on, a sign
    // (a base building's great object is its use's own, stocking.js GREAT, or none: an armoury's core is no generator hall)
    const sp = R.setPiece && (R.setPiece === 'great-object' ? (plan.use ? GREAT[plan.use] : SET_PIECES['great-object'][reg]) : SET_PIECES[R.setPiece]);
    if (sp && sp !== 'sign') {
      // (a great object as great as its room: scaled from the room's short side, a quarter at a time, but never past half
      // its height nor a third of its short side, so it stands in the room and does not fill it)
      const P0 = PIECES[sp], short = Math.min(r.x1 - r.x0, r.y1 - r.y0), most = Math.min(3, (0.5 * r.h) / P0.h, (0.3 * short) / Math.max(P0.w, P0.d));
      const k = R.setPiece === 'great-object' ? Math.max(1, Math.floor(Math.min(short / 8, most) * 4) / 4) : 1;
      const it = { id: `${r.id}/focus/${sp}`, kind: sp, room: r.id, at: [r5(R.focus[0]), r5(R.focus[1])], facing: '+y', set: true, ...(k !== 1 ? { scale: k } : {}) };
      const f = footprintOf(it);
      // (a set piece clear of the room's walls: pulled in from them)
      const dx = Math.max(0, r.x0 + EDGE - f.min[0]) - Math.max(0, f.max[0] - (r.x1 - EDGE)), dy = Math.max(0, r.y0 + EDGE - f.min[1]) - Math.max(0, f.max[1] - (r.y1 - EDGE));
      it.at = [r5(it.at[0] + dx), r5(it.at[1] + dy)];
      // (where a doorway's approach or a stair takes the focus, the nearest place round it that is clear: a set piece
      // moves, it is not dropped)
      const ok = (q) => { const g = footprintOf({ ...it, at: q }); return g.min[0] >= r.x0 + 0.05 && g.max[0] <= r.x1 - 0.05 && g.min[1] >= r.y0 + 0.05 && g.max[1] <= r.y1 - 0.05 && !keep.some((k) => k.room === r.id && k.kind !== 'sight' && hits(k, g.min, g.max)); };
      const tries = [[0, 0]];
      for (let d = 1; d <= 8; d++) for (const [ax, ay] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, d], [d, -d], [-d, -d]]) tries.push([ax, ay]);
      const at = tries.map(([ax, ay]) => [r5(it.at[0] + ax), r5(it.at[1] + ay)]).find(ok);
      if (at) items.push({ ...it, at });
    }
    if (sp === 'sign') {
      // (over the way on: on the wall nearest the focus, facing into the room)
      const f = R.focus, ds = { '-x': f[0] - r.x0, '+x': r.x1 - f[0], '-y': f[1] - r.y0, '+y': r.y1 - f[1] }, side = Object.keys(ds).reduce((a, b) => (ds[b] < ds[a] ? b : a));
      const X = side.endsWith('x'), facing = side.startsWith('-') ? `+${side[1]}` : `-${side[1]}`, v = side.startsWith('-') ? (X ? r.x0 : r.y0) + 0.05 : (X ? r.x1 : r.y1) - 0.05;
      items.push({ id: `${r.id}/focus/sign`, kind: 'sign', room: r.id, at: X ? [r5(v), r5(f[1])] : [r5(f[0]), r5(v)], facing, set: true, wall: true });
    }
    // a military base's building (plan.use): each room its stock (stocking.js) in place of the register's clusters, and
    // an extinguisher by each of its doorways; a room the tables do not stock (a corridor, a core) holds none of it
    if (plan.use) {
      const lines = STOCK[roleOf(r.id)];
      if (lines) {
        const sd = mulberry32(hashOf(`stock|${r.id}`));
        for (const [kind, [lo, hi], where] of lines) layStock(r, kind, lo + Math.floor(sd() * (hi - lo + 1)), where, sd);
        layExtinguishers(r);
      }
      continue;
    }
    // the clusters along the walls: a wall by the dice, a place along it, one to three of the dressing's pieces abreast
    const n = (CLUSTERS[R.role] ?? 1) + (['pocket', 'rest'].includes(R.role) ? CLUTTER[C.mood ?? 'even'] : 0) + ((r.x1 - r.x0) * (r.y1 - r.y0) > 120 && R.role !== 'passage' ? 1 : 0);
    for (let c = 0, tries = 0; c < n && tries < n * 6; tries++) {
      const side = SIDES[Math.floor(dice() * 4)], kind = set[Math.floor(dice() * set.length)], P = PIECES[kind];
      const X = side.endsWith('x'), facing = side.startsWith('-') ? `+${side[1]}` : `-${side[1]}`, len = X ? r.y1 - r.y0 : r.x1 - r.x0;
      const count = 1 + Math.floor(dice() * 3), run = count * P.w + (count - 1) * GAP;
      if (run > len - 2 * EDGE) continue;
      const u0 = (X ? r.y0 : r.x0) + EDGE + dice() * (len - 2 * EDGE - run);
      const v = side.startsWith('-') ? (X ? r.x0 : r.y0) + off + P.d / 2 : (X ? r.x1 : r.y1) - off - P.d / 2;
      let placed = 0;
      for (let k = 0; k < count; k++) {
        const u = u0 + k * (P.w + GAP) + P.w / 2, it = { id: '', kind, room: r.id, at: X ? [r5(v), r5(u)] : [r5(u), r5(v)], facing };
        const f = footprintOf(it);
        if (!free(r, f.min, f.max)) continue;
        const base = `${r.id}/${side}/${kind}`, idx = items.filter((o) => o.id.startsWith(`${base}-`) && !o.id.includes('@')).length + 1;
        it.id = `${base}-${idx}`;
        items.push(it);
        placed++;
        // (a piece that stacks, stacked: up to its own height, by the dice)
        const high = P.stack ? 1 + Math.floor(dice() * P.stack) : 1;
        for (let lv = 1; lv < high && (lv + 1) * P.h <= r.h - 0.6; lv++) items.push({ ...it, id: `${it.id}@${lv}`, level: lv });
      }
      if (placed) c++;
    }
  }
  return items;
}

// an item's part as a world box: the piece's frame turned to face the room (u along its wall, v out of it)
function partBox(it, p, z0) {
  const k = it.scale ?? 1, [u0, u1, v0, v1, pz0, pz1] = p.slice(0, 6).map((v) => v * k), f = footprintOf(it), dir = it.facing[0] === '+' ? 1 : -1;
  // (the piece's back on the wall: v grows away from it; u runs left to right as one faces the piece)
  if (it.facing.endsWith('y')) {
    const x0 = dir > 0 ? f.min[0] + u0 : f.max[0] - u1, x1 = dir > 0 ? f.min[0] + u1 : f.max[0] - u0;
    const y0 = dir > 0 ? f.min[1] + v0 : f.max[1] - v1, y1 = dir > 0 ? f.min[1] + v1 : f.max[1] - v0;
    return [[x0, y0, z0 + pz0], [x1, y1, z0 + pz1]];
  }
  const y0 = dir > 0 ? f.max[1] - u1 : f.min[1] + u0, y1 = dir > 0 ? f.max[1] - u0 : f.min[1] + u1;
  const x0 = dir > 0 ? f.min[0] + v0 : f.max[0] - v1, x1 = dir > 0 ? f.min[0] + v1 : f.max[0] - v0;
  return [[x0, y0, z0 + pz0], [x1, y1, z0 + pz1]];
}

// a prism (a drum, a turned body): its sides as quads and its caps as polygons
function prism(out, c, r, z0, z1, sides, sf) {
  const pts = Array.from({ length: sides }, (_, i) => { const a = (2 * Math.PI * (i + 0.5)) / sides; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
  for (let i = 0; i < sides; i++) {
    const p = pts[i], q = pts[(i + 1) % sides], m = (2 * Math.PI * (i + 1)) / sides, n = [r5(Math.cos(m)), r5(Math.sin(m)), 0];
    const corners = [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]].map((v) => v.map(r5)), s = Math.hypot(q[0] - p[0], q[1] - p[1]) * i;
    out.push({ corners, normal: n, outNormal: n, texture: sf.key, textureLit: true, uv: [[s, z0], [s + 1, z0], [s + 1, z1], [s, z1]].map(([u, v]) => [r5(u / sf.scale), r5(v / sf.scale)]), tint: sf.tint, group: sf.group });
  }
  const cap = (z, n, list) => out.push({ corners: list.map((p) => [r5(p[0]), r5(p[1]), r5(z)]), normal: n, outNormal: n, texture: sf.key, textureLit: true, uv: list.map((p) => [r5(p[0] / sf.scale), r5(p[1] / sf.scale)]), tint: sf.tint, group: sf.group });
  cap(z1, [0, 0, 1], pts);
  cap(z0, [0, 0, -1], [...pts].reverse());
}

/** Each item's faces, named by its id, and an anchor each (a prop of its piece's class). */
export function propFaces(plan, items, surf) {
  const faces = [], anchors = [], rooms = new Map(plan.rooms.map((r) => [r.id, r]));
  for (const it of items) {
    const r = rooms.get(it.room), P = PIECES[it.kind];
    if (!r || !P) continue;
    // (a wall piece over the doorway's head, under the ceiling)
    const k = it.scale ?? 1, z0 = (r.z0 ?? 0) + (it.level ?? 0) * P.h * k + (it.wall ? Math.min(r.h - P.h * k - 0.1, (plan.kit?.door?.height ?? 2.7) + 0.2) : 0), out = [];
    for (const p of P.parts) {
      if (p[0] === 'prism') {
        const [, cu, cv, rad, pz0, pz1, sides, s] = p, [mn] = partBox(it, [cu, cu, cv, cv, pz0, pz1], z0);
        prism(out, [mn[0], mn[1]], rad * k, z0 + pz0 * k, z0 + pz1 * k, sides, surf(s));
      } else {
        const [mn, mx] = partBox(it, p, z0);
        box(out, mn.map(r5), mx.map(r5), surf(p[6]), 2);
      }
    }
    for (const f of out) faces.push({ ...f, node: it.id });
    anchors.push({ id: it.id, kind: 'prop', form: P.class, room: it.room, at: [it.at[0], it.at[1], r5(z0)], ...(P.solid === false ? {} : { solid: true }), ...(it.breakable !== undefined ? { breakable: it.breakable } : {}) });
  }
  return { faces, anchors };
}

/** The dressing's laws: nothing in a keep-out (a doorway's approach, a stair), every focus's sightline clear, each room's count. */
export function dressLaws(plan, items) {
  const keep = keepOuts(plan), inKeep = [], inSight = [];
  for (const it of items) {
    if (it.set || it.wall || !PIECES[it.kind]) continue;
    const f = footprintOf(it), k = keep.find((q) => q.room === it.room && hits(q, f.min, f.max));
    if (k) (k.kind === 'sight' ? inSight : inKeep).push(it.id);
  }
  const count = {};
  for (const it of items) count[it.room] = (count[it.room] ?? 0) + 1;
  // (a military base's building: its supply chain's laws beside the dressing's, stocking.js)
  const stock = plan.use ? stockLaws(plan, items, (room) => { const r = plan.rooms.find((x) => x.id === room); return r ? openingsOf(plan, r).map((o) => (o.X ? [o.at, (o.lo + o.hi) / 2] : [(o.lo + o.hi) / 2, o.at])) : []; }) : [];
  return [
    ...stock,
    { id: 'keep-outs', ok: !inKeep.length, says: inKeep.length ? `${inKeep.slice(0, 6).join(', ')}${inKeep.length > 6 ? ` and ${inKeep.length - 6} more` : ''}: in a doorway's approach or by a stair` : 'every doorway\'s approach and every stair clear' },
    { id: 'sightlines', ok: !inSight.length, says: inSight.length ? `${inSight.slice(0, 6).join(', ')}: between a doorway and its room's focus` : 'every focus seen from its doorways' },
    { id: 'count', ok: true, says: Object.entries(count).map(([r, n]) => `${r} ${n}`).join(', ') || 'nothing laid' },
  ];
}
