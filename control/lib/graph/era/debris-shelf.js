/**
 * THE DEBRIS SHELF — the things that pile up when a place comes down, as a room's debris lays them (era/skandart.js):
 * one row a thing, under the words people say, with what it is made of, the sizes it comes in, the shape it is built as
 * and how it comes to rest. A new thing that piles is a row; a new way of being shaped is a builder. Gravity-bound only:
 * what falls and lies (what hangs or clings is another shelf's).
 *
 *   DEBRIS     { [id]: { words, shape, matter, size: [least, most] (metres, its longest span), how, ...its shape's dials } }
 *     shape    chip   a broken lump (the rock pool's convex chips)              dials: none
 *              block  a dressed block with a broken arris: not a box (era/laws.js 'no-voxel-first')   dials: prop [l, w, h]
 *              plate  a thin piece lying flat, bent where it was curved        dials: thick, sides, bend
 *              stick  a length of timber, one end broken off on the slant     dials: section [w, h]
 *     how      lies   it lies where it lands, on the heap's face, square to it
 *              rolls  it rolls: the bigger, the farther (fall sorting: what comes down a slope lands big at its toe)
 *   REPOSE     the slope a heap's body stands at, by what it is: a matter's angle of repose (rupa/matter.js `phi`)
 *   debrisPiece(id, w, seed) → { faces: [{ corners, normal, matter }], w, h } built at the origin, its foot at z 0
 *
 * Every piece is cheap: a chip a few dozen triangles, a block sixteen, a plate a score. Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { rockPool } from '../polygonizer/rock-pool.js';
import { MATTER } from '../rupa/matter.js';

const mix = (a, b, t) => a + (b - a) * t;

/** The things that pile up. */
export const DEBRIS = Object.freeze({
  spall: Object.freeze({ words: ['spall', 'chips', 'rubble', 'broken stone'], shape: 'chip', matter: 'stone', size: [0.05, 0.2], how: 'rolls' }),
  'fallen-block': Object.freeze({ words: ['fallen block', 'ashlar block', 'masonry', 'a stone from the wall'], shape: 'block', matter: 'stone', size: [0.32, 0.6], how: 'rolls', prop: [1, 0.55, 0.5] }),
  'breakdown-slab': Object.freeze({ words: ['breakdown', 'slab', 'fallen slab', 'rockfall', 'ceiling slab'], shape: 'block', matter: 'stone', size: [0.45, 1.1], how: 'rolls', prop: [1, 0.7, 0.28] }),
  brick: Object.freeze({ words: ['brick', 'bricks', 'brickbat', 'half brick'], shape: 'block', matter: 'brick', size: [0.11, 0.23], how: 'rolls', prop: [1, 0.47, 0.3] }),
  'render-flake': Object.freeze({ words: ['plaster', 'render', 'flakes of plaster', 'fallen coat'], shape: 'plate', matter: 'render', size: [0.05, 0.26], how: 'lies', thick: 0.016, sides: 6 }),
  slate: Object.freeze({ words: ['slate', 'slates', 'roof slate'], shape: 'plate', matter: 'slate', size: [0.15, 0.36], how: 'lies', thick: 0.01, sides: 4 }),
  'roof-tile': Object.freeze({ words: ['roof tile', 'tiles', 'pantile'], shape: 'plate', matter: 'terracotta', size: [0.18, 0.34], how: 'lies', thick: 0.014, sides: 4, bend: 0.35 }),
  sherd: Object.freeze({ words: ['sherd', 'potsherd', 'broken pot', 'pottery'], shape: 'plate', matter: 'terracotta', size: [0.06, 0.2], how: 'lies', thick: 0.01, sides: 5, bend: 0.5 }),
  plank: Object.freeze({ words: ['plank', 'board', 'boards'], shape: 'stick', matter: 'wood', size: [0.6, 1.4], how: 'lies', section: [0.18, 0.025] }),
  beam: Object.freeze({ words: ['beam', 'joist', 'timber', 'rafter'], shape: 'stick', matter: 'wood', size: [1.2, 2.4], how: 'lies', section: [0.16, 0.16] }),
  splinter: Object.freeze({ words: ['splinter', 'splinters', 'kindling'], shape: 'stick', matter: 'wood', size: [0.15, 0.4], how: 'lies', section: [0.03, 0.02] }),
});

/** The slope a heap's body stands at (degrees): loose stone as gravel lies, its fines as sand (rupa/matter.js phi). */
export const REPOSE = Object.freeze({ stone: MATTER.gravel.phi, grit: MATTER.sand.phi });

const yawP = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

/** A rectangle-ish cross-section extruded along x, one end cut on the slant: the block's and the stick's body. */
function prism(section, len, slant, matter) {
  // section: [[y, z], …] counter-clockwise seen from +x; its ends at x = ±len/2, the +x end leaning by `slant`
  const n = section.length, at = (end, [y, z]) => [r5(end * len / 2 + (end > 0 ? slant * (z - 0.5 * Math.max(...section.map((q) => q[1]))) : 0)), r5(y), r5(z)];
  const A = section.map((q) => at(-1, q)), B = section.map((q) => at(1, q)), faces = [];
  faces.push({ corners: [...A].reverse(), normal: [-1, 0, 0], matter });
  const sl = Math.hypot(1, slant);
  faces.push({ corners: B, normal: [r5(1 / sl), 0, r5(-slant / sl)], matter });
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, [y0, z0] = section[i], [y1, z1] = section[j], ny = z1 - z0, nz = -(y1 - y0), l = Math.hypot(ny, nz) || 1;
    faces.push({ corners: [A[i], A[j], B[j], B[i]], normal: [0, r5(ny / l) + 0, r5(nz / l) + 0], matter });
  }
  return faces;
}

/** One piece of a shelf row, `w` across its longest span, built at the origin with its foot at z 0. → { faces, w, h } */
export function debrisPiece(id, w, seed, pools = {}) {
  const R = DEBRIS[id];
  if (!R) throw new Error(`debris: '${id}' is not on the shelf (${Object.keys(DEBRIS).join(', ')})`);
  if (R.shape === 'chip') {
    const pool = pools.chip || (pools.chip = rockPool({ rock: 'basalt', variants: 6, detail: 0, tone: '#808080', seed: 'debris-chip', group: 'debris' }));
    const T = pool[Math.floor(hash3(seed, 1, 8101) * pool.length)].faces, s = w / 0.6, yaw = hash3(seed, 2, 8103) * 2 * Math.PI;
    return { w, h: 0.4 * s, faces: T.map((f) => ({ corners: f.corners.map((p) => yawP(p, yaw).map((v) => r5(v * s))), normal: yawP(f.outNormal, yaw).map(r5), matter: R.matter })) };
  }
  if (R.shape === 'block') {
    // a block from the wall, its top arris broken away: a pentagon run along its length
    const [l, b, c] = R.prop.map((v) => v * w), k = mix(0.3, 0.55, hash3(seed, 3, 8105));
    const sec = [[-b / 2, 0], [b / 2, 0], [b / 2, c * (1 - k)], [b / 2 - b * k, c], [-b / 2, c]];
    return { w, h: c, faces: prism(sec, l, mix(-0.25, 0.25, hash3(seed, 4, 8107)), R.matter) };
  }
  if (R.shape === 'stick') {
    const [b, c] = R.section, sec = [[-b / 2, 0], [b / 2, 0], [b / 2, c], [-b / 2, c]];
    return { w, h: c, faces: prism(sec, w, mix(0.4, 1.2, hash3(seed, 5, 8109)) * (hash3(seed, 6, 8111) < 0.5 ? -1 : 1), R.matter) };
  }
  // a plate: an irregular ring, its thickness standing proud (its broken edge casts), bent along x where it was curved
  const n = R.sides, t = R.thick, bend = R.bend || 0;
  const ring = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI + Math.PI / n + (hash3(seed, i, 8113) - 0.5) * (n > 4 ? 0.6 : 0.2), r = (w / 2) * mix(n > 4 ? 0.65 : 0.85, 1, hash3(seed, i, 8115));
    return [Math.cos(a) * r, Math.sin(a) * r * (n > 4 ? 0.8 : 0.62)];
  });
  // (the bend rises from its two long edges, which rest on the ground, to its middle)
  const ym = Math.max(...ring.map(([, y]) => Math.abs(y))) || 1;
  const lift = (x, y, z) => [r5(x), r5(y), r5(z + bend * (w / 2) * (1 - (y / ym) ** 2) * 0.35)];
  const top = ring.map(([x, y]) => lift(x, y, t)), bot = ring.map(([x, y]) => lift(x, y, 0)).reverse();
  const faces = [{ corners: top, normal: [0, 0, 1], matter: R.matter }, { corners: bot, normal: [0, 0, -1], matter: R.matter }];
  for (let i = 0; i < n; i++) {
    const a = ring[i], q = ring[(i + 1) % n], m = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2], l = Math.hypot(m[0], m[1]) || 1;
    faces.push({ corners: [lift(a[0], a[1], 0), lift(q[0], q[1], 0), lift(q[0], q[1], t), lift(a[0], a[1], t)], normal: [r5(m[0] / l), r5(m[1] / l), 0], matter: R.matter });
  }
  return { w, h: t + bend * w * 0.18, faces };
}
