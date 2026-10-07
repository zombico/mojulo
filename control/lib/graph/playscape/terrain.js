/**
 * Breakable terrain: scapeshift says WHERE and WHAT SHAPE, playscape makes it breakable. Two ways in:
 *
 *   its own boxes   scapeshift hands the boxes it already built (a stage's colliders, `{ min, max, of }`): playscape
 *                   cuts each into blocks (`course`, so a hit takes a block and not the whole wall) and draws them
 *   a generic ask   scapeshift names a form from the library here and where it stands:
 *                     wall    a run of coursed blocks in running bond, `length` × `height` × `thick`, facing `N`
 *                     pillar  blocks stacked `height` high on a `size` footprint
 *                     crate   one block (or a `stack` of them)
 *                     slab    a floor of tiles to stand on, `size` across, `thick` deep, its top at `at`
 *
 * A block has two states and only two: STANDING (a collider like any wall: it blocks the walk, the sight and the
 * shot, and the ground stands on it) and BROKEN (gone from the colliders: it blocks nothing). The runtime keeps the
 * state (worlds/controllable/rules-basic.js `break`): a block has `hp` (1 while testing), and each hit (a shot that
 * stops on it, a burst that reaches it, a swing that takes it in) is one damage.
 *
 * GRAVITY (the runtime's too): a block stands while it is held, resting on the floor, on a fixed collider or on a held
 * block; a `bond: 'lateral'` block is also held by a held block beside it (a slab's tiles span between its legs, a
 * lintel between its jambs).
 * A block that loses its hold falls, lands on what stands under it, and a hard landing breaks it and what it lands on.
 * So a running-bond wall stands while either block under a block stands, a stack drops when its foot goes, and a
 * crate on a slab falls through the hole when the tile under it breaks. `bond` overrides per ask: 'lateral' | 'none'.
 *
 * The blocks are axis-aligned, because the colliders are: a wall faces ±x or ±y. Every block's faces carry its
 * `node` (`break:<id>`, as scapeshift's anchors do), so the page hides that node when the block breaks and plays its
 * pieces (`blockPieces`, the destruct primitives' cleave) in its place.
 *
 *   breakableTerrain(ask, { hp?, value?, seed? })   → { blocks: [{ id, min, max, hp, of, bond }], faces, world: { breakables } }
 *   fromColliders(colliders, pick, { course?, hp?, bond? }) → { terrain, colliders }   the picked boxes made breakable,
 *                                                     the rest untouched; a box off the floor (a lintel) bonds laterally
 *   groundOf(colliders, floor?)                       → pos → the top a walker stands on (reads the LIVE list)
 *   blockPieces(block, { pattern?, count?, seed? })   → cleave chunks for the swap
 */
import { obox, blockSink } from '../era/props.js';
import { r5, P } from '../era/geom.js';
import { cleave } from './destruct/cleave.js';

export const TERRAIN_FORMS = Object.freeze(['wall', 'pillar', 'crate', 'slab']);
export const BLOCK = Object.freeze({ length: 1, course: 0.5 });   // a wall's block: 1 m long, a 0.5 m course
export const BLOCK_MIN = 0.2;                                     // no block thinner than this along any axis
export const FORM_BOND = Object.freeze({ wall: 'none', pillar: 'none', crate: 'none', slab: 'lateral' });   // how a form's blocks hold each other

// the axis a facing points along: walls face ±x or ±y, because their blocks are colliders and colliders are AABBs
function axisOf(N = [0, -1]) {
  const ax = Math.abs(N[0]) >= Math.abs(N[1]) ? 0 : 1, other = Math.abs(N[1 - ax]) / (Math.hypot(N[0], N[1]) || 1);
  if (other > 1e-6) throw new Error(`terrain: a wall faces ±x or ±y (its blocks are axis-aligned colliders); N [${N}] is not`);
  return ax;
}

// cut [a, b] into pieces near `size`, the same size each; `half` starts with a half piece (the running bond's next
// course), and no piece is left thinner than BLOCK_MIN
function cuts(a, b, size, half = false) {
  const L = b - a, n = Math.max(1, Math.round(L / size)), s = L / n;
  if (!half || n < 2) return Array.from({ length: n + 1 }, (_, i) => a + s * i);
  const xs = [a, a + s / 2];
  for (let i = 1; i < n; i++) xs.push(a + s / 2 + s * i);
  xs.push(b);
  return xs;
}

// cut a box into coursed blocks: along its long horizontal axis by `length` (each course offset by half a block),
// up by `course`; through its thickness never
function course(box, { length = BLOCK.length, course: ch = BLOCK.course } = {}) {
  const { min, max } = box, along = max[0] - min[0] >= max[1] - min[1] ? 0 : 1;
  const zs = cuts(min[2], max[2], ch), out = [];
  for (let r = 0; r < zs.length - 1; r++) {
    const us = cuts(min[along], max[along], length, r % 2 === 1);
    for (let c = 0; c < us.length - 1; c++) {
      const lo = [...min], hi = [...max];
      lo[along] = us[c]; hi[along] = us[c + 1]; lo[2] = zs[r]; hi[2] = zs[r + 1];
      out.push({ min: lo, max: hi, row: r, col: c });
    }
  }
  return out;
}

// a grid of tiles over a box's footprint (a slab), `tile` metres
function tiles(box, tile = 1) {
  const xs = cuts(box.min[0], box.max[0], tile), ys = cuts(box.min[1], box.max[1], tile), out = [];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) out.push({ min: [xs[i], ys[j], box.min[2]], max: [xs[i + 1], ys[j + 1], box.max[2]], row: j, col: i });
  return out;
}

// the generic library: each form as its box (or boxes) and how it is cut
const FORMS = {
  wall({ at, N, length = 4, height = 2.5, thick = 0.4, block }) {
    const ax = axisOf(N), u = 1 - ax, min = [0, 0, at[2]], max = [0, 0, at[2] + height];
    min[u] = at[u] - length / 2; max[u] = at[u] + length / 2; min[ax] = at[ax] - thick / 2; max[ax] = at[ax] + thick / 2;
    return course({ min, max }, block);
  },
  pillar({ at, size = [0.8, 0.8], height = 3, block }) {
    const min = [at[0] - size[0] / 2, at[1] - size[1] / 2, at[2]], max = [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] + height];
    return cuts(min[2], max[2], (block && block.course) || BLOCK.course * 2).slice(0, -1).map((z, r, zs) => ({ min: [min[0], min[1], z], max: [max[0], max[1], zs[r + 1] ?? max[2]], row: r, col: 0 }));
  },
  crate({ at, size = [1, 1, 1], stack = 1 }) {
    return Array.from({ length: stack }, (_, r) => ({ min: [at[0] - size[0] / 2, at[1] - size[1] / 2, at[2] + size[2] * r], max: [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2] + size[2] * (r + 1)], row: r, col: 0 }));
  },
  slab({ at, size = [4, 4], thick = 0.3, tile = 1 }) {
    return tiles({ min: [at[0] - size[0] / 2, at[1] - size[1] / 2, at[2] - thick], max: [at[0] + size[0] / 2, at[1] + size[1] / 2, at[2]] }, tile);
  },
};

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const surf = (v, node) => ({ key: null, scale: 1, tint: [v, v, v], group: 'obj:body', node });

/** A block's box record (what obox records and cleave cuts). */
const boxRecord = (b, value) => ({
  c: [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2), A: [1, 0, 0], B: [0, 1, 0], C: [0, 0, 1],
  h: [0, 1, 2].map((k) => (b.max[k] - b.min[k]) / 2), group: 'obj:body', value, part: 'block',
});

/**
 * The ask, made breakable: `{ form, id?, at, ... }` from the library, or `{ blocks: [{ min, max, of? }], id?, course? }`
 * (scapeshift's own boxes, cut into coursed blocks unless `course: false`).
 */
export function breakableTerrain(ask, { hp = 1, value = 0.62, seed = 1 } = {}) {
  if (!ask || typeof ask !== 'object') throw new Error('terrain: ask for a form ({ form, at }) or give boxes ({ blocks: [{ min, max }] })');
  let cut, name;
  if (ask.blocks) {
    name = ask.id || 'blocks';
    cut = ask.blocks.flatMap((b, i) => {
      if (!Array.isArray(b.min) || !Array.isArray(b.max)) throw new Error(`terrain: box ${i} needs min and max`);
      const of = b.of ?? b.id ?? `${name}.${i}`, bd = b.bond;
      return (ask.course === false ? [{ min: b.min, max: b.max, row: 0, col: 0 }] : course(b, ask.course || {})).map((q) => ({ ...q, of, ...(bd ? { bond: bd } : {}) }));
    });
  } else {
    if (!FORMS[ask.form]) throw new Error(`terrain: no form '${ask.form}' (forms: ${TERRAIN_FORMS.join(', ')}), or give scapeshift's own boxes as { blocks }`);
    if (!Array.isArray(ask.at) || ask.at.length !== 3) throw new Error(`terrain: a ${ask.form} needs \`at\` [x, y, z]`);
    name = ask.id || ask.form;
    cut = FORMS[ask.form](ask).map((q) => ({ ...q, of: name }));
  }
  const bond = ask.bond ?? (ask.blocks ? 'none' : FORM_BOND[ask.form]);
  const odd = [bond, ...cut.map((q) => q.bond)].find((x) => x != null && !['none', 'lateral'].includes(x));
  if (odd) throw new Error(`terrain: bond is 'none' or 'lateral', not '${odd}'`);
  const rnd = mulberry32(seed), faces = blockSink(), seen = new Map();
  const blocks = cut.filter((q) => [0, 1, 2].every((k) => q.max[k] - q.min[k] >= BLOCK_MIN - 1e-9 || ask.course === false)).map((q) => {
    const base = `${q.of}:r${q.row}c${q.col}`, n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return { id: n ? `${base}.${n}` : base, min: P(q.min), max: P(q.max), hp, of: q.of, bond: q.bond ?? bond };
  });
  for (const b of blocks) {
    // each block its own value, a little off its neighbours', so the bond reads under any tone
    const v = r5(Math.min(0.92, Math.max(0.12, value + (rnd() - 0.5) * 0.08))), rec = boxRecord(b, v), from = faces.length;
    obox(faces, rec.c, rec.A, rec.B, rec.C, rec.h, surf(v, `break:${b.id}`), 1);
    for (let i = from; i < faces.length; i++) faces[i].node = `break:${b.id}`;
    faces.boxes[faces.boxes.length - 1].part = 'block';
  }
  return { form: ask.form || 'blocks', id: name, blocks, faces, world: { breakables: blocks.map(({ id, min, max, hp: h, bond: bd }) => ({ id, min, max, hp: h, ...(bd === 'lateral' ? { bond: bd } : {}) })) } };
}

/**
 * Take scapeshift's colliders and make the picked ones breakable: `pick` is an `of` (a string, matched as a prefix:
 * 'wall:crypt' takes every crypt wall), a list of them, or a test on the collider. The rest come back untouched, so
 * a world built from both has every box once.
 */
export function fromColliders(colliders, pick, { course: c, hp, value, seed, id = 'scape', bond, floor = 0 } = {}) {
  const test = typeof pick === 'function' ? pick : (x) => [].concat(pick).some((p) => typeof x.of === 'string' && x.of.startsWith(p));
  const picked = colliders.filter(test), rest = colliders.filter((x) => !test(x));
  if (!picked.length) throw new Error(`terrain: no collider matches ${typeof pick === 'function' ? 'the test' : `'${[].concat(pick).join("', '")}'`}`);
  const boxes = picked.map((x) => ({ ...x, bond: bond ?? (x.min[2] > floor + 0.02 ? 'lateral' : 'none') }));   // a lintel spans its opening
  return { terrain: breakableTerrain({ id, blocks: boxes, course: c }, { hp, value, seed }), colliders: rest };
}

/** The ground under a walker from the colliders as they stand NOW (a broken slab drops it): the highest top at or below its feet. */
export function groundOf(colliders, floor = 0) {
  return (pos) => {
    let g = floor;
    for (const c of colliders || []) if (pos[0] >= c.min[0] && pos[0] <= c.max[0] && pos[1] >= c.min[1] && pos[1] <= c.max[1] && c.max[2] <= pos[2] + 1e-6) g = Math.max(g, c.max[2]);
    return g;
  };
}

/** A broken block's pieces, from the destruct primitives (cleave): a shatter by default. */
export function blockPieces(block, { pattern = 'voronoi', count = 4, seed = 1, value = 0.62 } = {}) {
  const rec = boxRecord(block, value);
  return cleave({ blocks: [rec], frame: { at: rec.c, N: [0, -1, 0], U: [1, 0, 0] } }, { pattern, count, seed });
}
