/**
 * THE GROUND UNDER A LOCAL MERU (`ground`, opt-in): the plain taken from a terrain world's field (terrain/terrain-field.js)
 * instead of the level ground. A painted scene's heartbeat, its landform and erosion and the fracture detail below its
 * grid, at real scale, laid under the meru: the sixth-gen land lit by polygons, on the terrain kind's ground.
 *
 *   readGround(v)                       the recipe's `ground`, checked → { from, span, height, at, detail } or null
 *   groundField(G, centre, seed)        → (x, y) → metres at or above 0: the field's height under the level, its lowest
 *                                       point within REACH of the first tier made the level's datum and its range
 *                                       scaled to `height`, so a hollow never sinks under the plain (or an island's sea)
 *
 * A ground's words:
 *   from     a painted-landscape recipe ({ heartbeat, splatch, seed, landform?, erosion?, … }): the scene the ground is
 *   span     metres the painting's width covers (the terrain world's `span`, 10 to 2000; 120 by default, so the level
 *            sees a few of its hills and not one slope of one). Under the terrain world's least (50 m) the field is
 *            built at 50 and drawn in, its detail with it
 *   height   metres from the ground's lowest point under the level to its highest (3 by default): the mounds still rise
 *            over it; a terrain taller than the tiers buries them
 *   at       [x, y] metres in the terrain world where the first tier stands (its centre by default)
 *   detail   the terrain's fracture detail ({ rock?, soil?, hurst?, crossover?, min? }); `min` is 1.5 m by default, three
 *            of the land's cells: finer detail aliases to needles on the half-metre grid (landform.js peaks says the same)
 */
import { terrainField, validateTerrainSpec } from '../terrain/terrain-field.js';

export const GROUND = Object.freeze({ span: 120, height: 3, at: null, detail: Object.freeze({ min: 1.5 }) });
// how far round the first tier the datum is looked for, and how finely
const REACH = 60, STEP = 2, LEAST_SPAN = 50;
const WORDS = ['from', 'span', 'height', 'at', 'detail'];
const bad = (m) => { throw new Error(`local-meru: ground${m}`); };

/** The recipe's `ground`, checked against the terrain world's own rules → the ground, or null when absent. */
export function readGround(v) {
  if (v === undefined || v === false || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) bad(' is { from: <painted-landscape recipe>, span?, height?, at?, detail? }');
  for (const k of Object.keys(v)) if (!WORDS.includes(k)) bad(`.${k} is not a setting (ground: ${WORDS.join(', ')})`);
  const G = { ...GROUND, ...v, detail: v.detail === false ? false : { ...GROUND.detail, ...(v.detail || {}) } };
  if (!(typeof G.span === 'number' && G.span >= 10 && G.span <= 2000)) bad('.span is the metres the painting\'s width covers under the level, 10 to 2000 (120 by default)');
  const errs = validateTerrainSpec({ from: G.from, detail: G.detail });
  if (errs.length) bad(`: ${errs.map((e) => e.replace(/^terrain\.?/, '')).join('; ')}`);
  if (!(typeof G.height === 'number' && G.height > 0 && G.height <= 40)) bad('.height is metres from the lowest ground under the level to the highest, above 0 and at most 40');
  if (G.at !== null && !(Array.isArray(G.at) && G.at.length === 2 && G.at.every(Number.isFinite))) bad('.at is [x, y] metres in the terrain world, or null (its centre)');
  return G;
}

// the field per recipe: a painted scene's landform and erosion are the slow part, and a level reads it more than once
const MEMO = new Map();
function fieldOf(G, seed, draw) {
  const key = JSON.stringify([G.from, G.span, G.detail, seed]);
  let f = MEMO.get(key);
  if (!f) {
    // drawn in under the least span: the detail's lengths are the level's, so they are drawn out by the same factor
    const detail = G.detail === false ? false : { ...G.detail, ...(G.detail.min !== undefined ? { min: G.detail.min * draw } : {}) };
    f = terrainField({ from: G.from, span: G.span * draw, detail, seed: G.from.seed ?? seed });
    MEMO.set(key, f);
    if (MEMO.size > 8) MEMO.delete(MEMO.keys().next().value);
  }
  return f;
}

/** The ground's height under the level → (x, y) → metres at or above 0. `centre`: the first tier's centre. */
export function groundField(G, centre, seed = 1) {
  const draw = G.span < LEAST_SPAN ? LEAST_SPAN / G.span : 1, f = fieldOf(G, seed, draw), b = f.bounds;
  // `at` is in the field's own metres; the level's metres are drawn out by `draw` round it
  const at = G.at ?? [(b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2];
  const H = (x, y) => f.heightAt(at[0] + (x - centre[0]) * draw, at[1] + (y - centre[1]) * draw);
  // the datum: the lowest ground round the first tier, and the range it spans there
  let lo = Infinity, hi = -Infinity;
  for (let y = centre[1] - REACH; y <= centre[1] + REACH; y += STEP) for (let x = centre[0] - REACH; x <= centre[0] + REACH; x += STEP) {
    const z = H(x, y); if (z < lo) lo = z; if (z > hi) hi = z;
  }
  const k = hi > lo ? G.height / (hi - lo) : 0;
  return (x, y) => { const z = (H(x, y) - lo) * k; return z > 0 ? z : 0; };
}
