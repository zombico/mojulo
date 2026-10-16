/**
 * historic/solver/site — the ground a form's town stands on: which way is which, where the water is, and how high
 * the land is at any point (`hAt`). Everything is anchored on the TOWN rect, so the same form lays the same ground
 * whether the frame is the town alone or a region round it: a river along the town's west side runs on north and
 * south past it, a bluff carries on, a canal runs through and out. Metres; x east, y south (`'n'` is −y). Pure: the
 * dice come in as a stream.
 */
export const SIDES4 = Object.freeze(['n', 'e', 's', 'w']);
const TURN = { n: 0, e: 1, s: 2, w: 3 };
/** A part's facing in its building's frame ('n' its front) → the world, for a building facing `facing`. */
export const turnFacing = (local, facing) => SIDES4[(TURN[local] + TURN[facing]) % 4];
export const opposite = (s) => ({ n: 's', s: 'n', e: 'w', w: 'e' })[s];
/** The unit step toward a side. */
export const toward = (s) => ({ n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] })[s];

/**
 * Coordinates against one side of the town: `across` how far in from that side's edge, `along` the position along
 * it, `at(along, across)` back to a point, `len` the town's depth away from that side.
 */
export function sideAxes(side, town) {
  const { x, y, w, d } = town;
  switch (side) {
    case 'n': return { across: (px, py) => py - y, along: (px) => px, at: (a, c) => [a, y + c], len: d, span: [x, x + w] };
    case 's': return { across: (px, py) => y + d - py, along: (px) => px, at: (a, c) => [a, y + d - c], len: d, span: [x, x + w] };
    case 'w': return { across: (px) => px - x, along: (px, py) => py, at: (a, c) => [x + c, a], len: w, span: [y, y + d] };
    default: return { across: (px) => x + w - px, along: (px, py) => py, at: (a, c) => [x + w - c, a], len: w, span: [y, y + d] };
  }
}

/**
 * The water: `{ kind, z, isWater(x, y), side?, axes?, edge(along)?, centre(x)?, width }`. A canal crosses the town west
 * to east a little south of its middle, meandering; a river is a band `width` wide along a side of the town, its near
 * bank meandering; the sea lies beyond a shore `width` in from a side, out to the frame's edge.
 */
export function waterOf(W, town, rng) {
  if (!W || W.kind === 'none') return { kind: 'none', z: 0, isWater: () => false, width: 0 };
  const z = -(W.sink ?? 1.5), width = W.width ?? 10;
  if (W.kind === 'canal') {
    const y0 = town.y + town.d * (0.6 + rng() * 0.06), amp = town.d * 0.04, ph = rng() * 6.283;
    const centre = (px) => y0 + amp * Math.sin(((px - town.x) / town.w) * 6.283 * 0.8 + ph);
    return { kind: 'canal', z, width, centre, isWater: (px, py) => Math.abs(py - centre(px)) < width / 2, upstream: W.flows ? opposite(W.flows) : 'w' };
  }
  const side = W.side ?? 'w', axes = sideAxes(side, town), amp = W.kind === 'river' ? 7 : 10, ph = rng() * 6.283, period = axes.span[1] - axes.span[0];
  const edge = (a) => width + amp * Math.sin(((a - axes.span[0]) / period) * 6.283 * 0.7 + ph);
  const isWater = W.kind === 'river'
    ? (px, py) => { const a = axes.along(px, py), c = axes.across(px, py); return c < edge(a) && c > edge(a) - width; }
    : (px, py) => axes.across(px, py) < edge(axes.along(px, py));
  return { kind: W.kind, z, width, side, axes, edge, isWater, upstream: W.flows ? opposite(W.flows) : side === 'n' || side === 's' ? 'w' : 'n' };
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const terraced = (z, step) => (step > 0 ? Math.round(z / step) * step : z);

/**
 * The height of the land, metres: the landform (a bluff's jump, a plateau's escarpment, a hill rising in terraces), a
 * summit `rock` standing round `rockRect` (sheer with `cliff`), and the water's bed under the water.
 *   `u` runs from the town's low side (0) to its high side (1); `edge` is where on it a bluff or plateau steps up. A
 *   town on the high ground (`town: 'high'`) stands at z = 0, the land below it at −relief; `base` keeps the landform's own.
 */
export function heightOf(site, water, town, { rockRect = null, rng }) {
  const form = site.landform ?? 'flat', relief = site.relief ?? 0, edgeAt = site.edge ?? 0.5;
  const axes = sideAxes(site.high ?? 'n', town), ph = rng() * 6.283;
  const u = (x, y) => 1 - axes.across(x, y) / axes.len;
  const ragged = (a) => 0.02 * Math.sin(a / 41 * 6.283 + ph) + 0.01 * Math.sin(a / 13.7 * 6.283 + ph * 2);
  const base = (x, y) => {
    if (form === 'bluff') return u(x, y) > edgeAt + ragged(axes.along(x, y)) ? relief : 0;
    if (form === 'plateau') return relief * smooth(((u(x, y) - edgeAt) * axes.len) / 34 + 0.5);
    if (form === 'hill') return terraced(relief * Math.max(0, Math.min(1.2, u(x, y))) ** 1.3, site.terraces ?? 0);
    return 0;
  };
  const rock = site.rock && rockRect ? site.rock : 0, R = rockRect && { x: rockRect.x - 4, y: rockRect.y - 4, w: rockRect.w + 8, d: rockRect.d + 8 };
  const outside = (x, y) => (R ? Math.hypot(Math.max(R.x - x, 0, x - R.x - R.w), Math.max(R.y - y, 0, y - R.y - R.d)) : Infinity);
  const land = (x, y) => {
    const b = base(x, y);
    if (!rock) return b;
    const d = outside(x, y);
    if (d <= 0) return rock;
    return site.cliff ? b : Math.max(b, terraced(rock * (1 - d / (rock * 1.4)), site.terraces ?? 0));
  };
  const bed = water.kind === 'sea' ? -6 : water.z - 1;
  // a town on the high ground stands at z = 0 and the land falls away below it (Pompeii on its spur, the plain under it)
  const shift = site.town === 'high' ? -relief : 0;
  const hAt = (x, y) => (water.isWater(x, y) && !(rock && outside(x, y) <= 0) ? bed : land(x, y) + shift);
  return { hAt, land, base, u, rock };
}
