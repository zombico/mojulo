/**
 * SHRUBS — bushes seeded through an open stage's grass (era/isekai.js): the understory between the meadow and the trees.
 * Each is the flora index's bush (era/out-flora.js broccoli/bush), a `bloom` share of them in flower (posies on the
 * lit side), a `fruit` share in fruit (berries hanging at the canopy's edge), the rest green. They stand where a walker
 * sees them: within `band` metres of the trail's fringe, clear of the trail, the cliff and its apron, the rocks, the
 * trees and each other by `gap`, on ground the reserve keeps. They go through the ikebana's path to the page
 * (ikebana-place.js ikebanaFaces/ikebanaFill): coloured from the kit's flora skin, banded by the same sun and shadow, a
 * collider for an engine where a bush is taller than a step, and the live grass kept off their feet. Pure; seeded.
 *
 *   card.shrubs = { n, band: [near, far], gap, height: [lo, hi], bloom, fruit, blooms: [lo, hi], fruits: [lo, hi] }
 *   recipe `shrubs`: true | { count?, bloom?, fruit? } (absent or false: none — opt-in, so a minted meadow is unchanged)
 */
import { designFlora, subSeed, floraMeasures } from './out-flora.js';
import { mulberry32 } from '../vegetation/grow.js';
import { kept } from './reserve.js';
import { WALK } from './out-ikebana.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
export const SHRUB_GROUP = 'flora:bush';   // (stage-buildings.js clears a bush where a building stands)

/** `shrubs` on a stage recipe → error strings. */
export function validateShrubs(v) {
  if (v === undefined || v === true || v === false) return [];
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some((k) => !['count', 'bloom', 'fruit'].includes(k))) return ['shrubs must be true, false or { count?, bloom?, fruit? }'];
  const e = [];
  if (v.count !== undefined && !(Number.isInteger(v.count) && v.count >= 0 && v.count <= 80)) e.push('shrubs.count must be an integer 0–80 (bushes in the meadow)');
  for (const k of ['bloom', 'fruit']) if (v[k] !== undefined && !(Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 1)) e.push(`shrubs.${k} must be 0–1 (the share of bushes in ${k === 'bloom' ? 'flower' : 'fruit'})`);
  if (Number.isFinite(v.bloom) && Number.isFinite(v.fruit) && v.bloom + v.fruit > 1) e.push('shrubs.bloom + shrubs.fruit must be at most 1 (a bush is in flower, in fruit or green)');
  return e;
}

/**
 * The bushes on a site. `card` the style card's `shrubs`, `ask` the recipe's; rocks and trees to keep clear of.
 * → { elements: [{ x, y, z, design, soft, of, state }], colliders, avoid, anchors: [{ id, kind: 'shrub', at, state, height }] }
 */
export function placeShrubs(card, ask, site, { rocks = [], trees = [], unit = 1, reserved = null } = {}, seed = 1) {
  if (!ask || !card) return { elements: [], colliders: [], avoid: [], anchors: [] };   // opt-in: a recipe asks, the card's dials
  const C = { ...card, ...(ask && ask !== true ? { ...(ask.count !== undefined ? { n: ask.count } : {}), ...(ask.bloom !== undefined ? { bloom: ask.bloom } : {}), ...(ask.fruit !== undefined ? { fruit: ask.fruit } : {}) } : {}) };
  const { W, D, trailX, halfWAt, fringeAt, cliffX, apronAt, ground } = site, rand = mulberry32(subSeed(seed, 'shrubs'));
  const ok = (x, y) => x > cliffX(y) + 2.5 && x < W - 2 && y > 2 && y < D - 2 && apronAt(x, y) < 0.02 && !(site.clear && site.clear(x, y)) && (!reserved || kept(reserved, x, y, 1));
  const at = [];
  for (let tries = 0; at.length < C.n && tries < C.n * 40; tries++) {
    const y = 3 + rand() * (D - 6), side = rand() < 0.5 ? -1 : 1, off = C.band[0] + (C.band[1] - C.band[0]) * rand();
    const x = trailX(y) + side * (halfWAt(y) + fringeAt(y) + off);
    if (!ok(x, y)) continue;
    if (rocks.some((r) => r.role !== 'pebble' && Math.hypot(r.x - x, r.y - y) < r.size * unit * 0.6 + 1)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 1.8)) continue;
    if (at.some((q) => Math.hypot(q[0] - x, q[1] - y) < C.gap)) continue;
    at.push([r5(x), r5(y)]);
  }
  const elements = [], colliders = [], avoid = [], anchors = [];
  at.forEach(([x, y], i) => {
    const roll = rand(), state = roll < C.bloom ? 'bloom' : roll < C.bloom + C.fruit ? 'fruit' : 'green', s = subSeed(seed, `shrub:${i}`);
    const over = { height: C.height, ...(state === 'bloom' ? { blooms: C.blooms } : state === 'fruit' ? { fruit: C.fruits } : {}) };
    const design = designFlora('broccoli', 'bush', s, { level: 'near', over });
    const h = floraMeasures(design).height, soft = h < WALK.step;
    elements.push({ x, y, z: r5(ground(x, y) - 0.04), design, soft, of: `shrub-${i}`, state });
    anchors.push({ id: `shrub-${i}`, kind: 'shrub', at: [x, y, r5(ground(x, y))], state, height: r5(h) });
    if (!soft) {
      const r = r5(design.dials.width * h * 0.4), g = ground(x, y);
      colliders.push({ min: [r5(x - r), r5(y - r), r5(g)], max: [r5(x + r), r5(y + r), r5(g + h)], of: `shrub:${i}` });
      avoid.push({ x, y });
    }
  });
  return { elements, colliders, avoid, anchors };
}
