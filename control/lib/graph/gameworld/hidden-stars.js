/**
 * THE CITY'S HIDDEN STARS (a world's `hidden`): a few stars tucked where nobody walks on the way anywhere: a park's
 * far corner, the back of an empty lot or a building site, under a highway ramp's foot, the corners of the dock's and
 * the yards' lots. Found by looking round, picked up into the bag (the `collect` mechanic, its star glyph:
 * game/mechanic-decor.js), counted on the bag's page. Nothing is won by them.
 *
 *   hidden: true | { stars?: 1..24, item? }             on a world (gameworld/levels.js lays it on a city's stage)
 *   readHidden(h)                → { stars, item } | null
 *   hiddenSpots(ends, H, seed)   → [{ at: [x, y, z], from: 'park' | 'lot' | 'ramp' | 'dock' | 'yard', id }]
 *     the candidates every place the district says gives (ends.parks, lots, ramps, dock, depots), each on the ground and
 *     out of every box, none near the start or a door; then picked far apart, each the candidate farthest from those
 *     picked (ties by the seed's dice), so they spread over the district rather than bunch in one park
 *   HIDDEN  the measures (m)
 *
 * Pure: the level's ends in, the spots out.
 */
export const HIDDEN = Object.freeze({ stars: 8, most: 24, item: 'hidden-star', inset: 2.2, lift: 0.6, start: 30, door: 12, apart: 18, clear: 0.6, under: 3.5 });

const r3 = (v) => Math.round(v * 1000) / 1000;
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

/** A world's `hidden`, checked (see the header); none ⇒ null. */
export function readHidden(h) {
  if (h === undefined || h === null || h === false) return null;
  const H = h === true ? {} : h;
  if (typeof H !== 'object' || Array.isArray(H)) throw new Error('hidden is true or { stars?, item? }: stars tucked round the city, picked up into the bag');
  for (const k of Object.keys(H)) if (!['stars', 'item'].includes(k)) throw new Error(`hidden.${k} is not a setting (stars, item)`);
  const stars = H.stars ?? HIDDEN.stars;
  if (!Number.isInteger(stars) || stars < 1 || stars > HIDDEN.most) throw new Error(`hidden.stars is 1 to ${HIDDEN.most}`);
  if (H.item !== undefined && !(typeof H.item === 'string' && /^[a-z][a-z0-9-]*$/.test(H.item))) throw new Error('hidden.item is an item\'s id (lower case words joined by dashes)');
  return { stars, item: H.item ?? HIDDEN.item };
}

// a rect's corners, `inset` in from each side
const corners = (R, inset) => [[R[0] + inset, R[1] + inset], [R[2] - inset, R[1] + inset], [R[2] - inset, R[3] - inset], [R[0] + inset, R[3] - inset]];

/** The candidates and the stars picked from them (see the header). */
export function hiddenSpots(ends, H, seed = 1) {
  if (!H || !ends) return [];
  const ground = typeof ends.ground === 'function' ? ends.ground : () => 0, boxes = ends.colliders ?? [];
  const doors = (ends.doors ?? []).map((d) => d.at), start = ends.spawn ?? [0, 0, 0];
  const cand = [];
  const offer = (x, y, from, id) => {
    const z = ground(x, y);
    if (z === null || z === undefined || !Number.isFinite(z)) return;
    // (out of every box a star would sit in, on its ground: never inside a wall, a tree's trunk, a fence)
    if (boxes.some((c) => x > c.min[0] - HIDDEN.clear && x < c.max[0] + HIDDEN.clear && y > c.min[1] - HIDDEN.clear && y < c.max[1] + HIDDEN.clear && z + HIDDEN.lift > c.min[2] && z < c.max[2])) return;
    if (d2([x, y], start) < HIDDEN.start || doors.some((p) => d2([x, y], p) < HIDDEN.door)) return;
    cand.push({ at: [r3(x), r3(y), r3(z + HIDDEN.lift)], from, id });
  };
  // (a park's corners: away from its paths, behind its trees)
  for (const P of ends.parks ?? []) corners(P.rect, HIDDEN.inset).forEach(([x, y], k) => offer(x, y, 'park', `${P.id}:${k}`));
  // (an empty lot's or a building site's back corners: those away from its open side)
  for (const Q of ends.lots ?? []) corners(Q.rect, HIDDEN.inset).forEach(([x, y], k) => offer(x, y, 'lot', `${Q.id}:${k}`));
  // (under a highway's ramp: beside its foot, back under the deck it climbs to)
  for (const R of ends.ramps ?? []) {
    const dx = R.top[0] - R.foot[0], dy = R.top[1] - R.foot[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, side = (R.w ?? 8) / 2 + 1.2;
    for (const s of [-1, 1]) offer(R.foot[0] + ux * HIDDEN.under - uy * side * s, R.foot[1] + uy * HIDDEN.under + ux * side * s, 'ramp', `${R.id}:${s > 0 ? 'l' : 'r'}`);
  }
  // (the dock's and the yards' lots: their corners, behind the stacks and the parked)
  if (ends.dock?.rect) corners(ends.dock.rect, HIDDEN.inset).forEach(([x, y], k) => offer(x, y, 'dock', `${ends.dock.id}:${k}`));
  for (const Y of ends.depots ?? []) if (Y.half) corners([Y.at[0] - Y.half[0], Y.at[1] - Y.half[1], Y.at[0] + Y.half[0], Y.at[1] + Y.half[1]], HIDDEN.inset).forEach(([x, y], k) => offer(x, y, 'yard', `${Y.id}:${k}`));
  // (far apart: the first the candidate farthest from the start, each next the farthest from those picked)
  const dice = (c) => hash(seed, [...c.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7));
  const pool = cand.slice().sort((a, b) => dice(a) - dice(b) || (a.id < b.id ? -1 : 1)), out = [];
  while (out.length < H.stars && pool.length) {
    let best = -1, far = -1;
    pool.forEach((c, i) => { const f = out.length ? Math.min(...out.map((o) => d2(o.at, c.at))) : d2(c.at, start); if (f > far + 1e-9) { far = f; best = i; } });
    if (out.length && far < HIDDEN.apart) break;
    out.push(pool.splice(best, 1)[0]);
  }
  return out;
}
