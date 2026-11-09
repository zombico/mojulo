/**
 * OUT-TILE-WATER — water across a glyph map (level/grid.js): its WATER tiles (a grid's `~`, a sketch's `w`) laid as
 * BODIES on the level's one land, each at one level, its edge a BEACH or a CLIFF. Every height here is a function of the
 * level's frame alone, so each tile cuts its own square of it and two tiles meet at one height along every seam, the
 * shore running on across them; the water's sheets are clipped to each tile's square at the body's one level.
 *
 *   THE SHORELINE  the water tiles' outline (the signed distance to their squares: − inside, + outside), rounded (the
 *                  distance averaged over a disc of SHORE.round), wandered by two octaves of noise on the level's frame
 *                  (SHORE.wander, SHORE.stride) and set SHORE.inset into the water, so a lake is never a square; a water
 *                  tile on the map's edge runs to the edge
 *   ITS LEVEL      a body's water stands SHORE.under under the lowest of the land round its outline (its land tiles'
 *                  edges, sampled), so no shore is under it
 *   A BEACH        the land eased down to a strand: sand from the waterline up to a berm over SHORE.beach metres, eased
 *                  into the land over SHORE.ease; under the water a shelf falling SHORE.depth over SHORE.shelf
 *   A CLIFF        the land held up: its lip at least CLIFF.min over the water (falling back to the land behind it at
 *                  CLIFF.back), a sheer face down to a toe under the water, the bed falling away past it. Steep ground
 *                  is drawn as rock by the builder (isekai.js isekaiGround), so the face is the cube's stone
 *   HELD GROUND    round a place's square (W.hold: the places near the water), the land as it lies, eased out over
 *                  SHORE.hold metres, so a building beside the water stands on the ground it was planned on
 *   WHICH EDGE     each land tile beside water says its edge (level/map-water.js: 0 a beach, 1 a cliff), weighed at a
 *                  point by how near each such tile's square is (SHORE.blend), so the shore beside a cliff's tile is all
 *                  cliff, a beach turns into a cliff along the shore, and nothing steps at a seam
 *
 *   SHORE, CLIFF               the shore's and the cliff's numbers (metres)
 *   tileWater(W, ctx)          → the site's `water` (out-water.js's shape: wet, sand, level, clear, bare, faces, forms,
 *                                anchors, hazards, cameras, plan) and `carve(x, y, z)`: the land's height there with the
 *                                water cut into it (tile frame). W: the tile's `water` (level/map-water.js near): { rows,
 *                                cols, cells: [[r, c, body]], levels, shore: [[r, c, k]], hold?: [[r, c]], seed? }; ctx: { size, origin,
 *                                land (tile frame), fill }
 * Pure: value noise on the level's frame, the same map the same water.
 */
import { vnoise } from './dirt.js';
import { r5 } from './geom.js';

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

export const SHORE = Object.freeze({ wander: Object.freeze([4, 1.6]), stride: Object.freeze([11, 4.5]), round: 4, inset: 2.5, under: 0.45, beach: 7, berm: 0.45, ease: 6, shelf: 9, depth: 2.4, blend: 5, turn: Object.freeze([0.3, 0.7]), hold: Object.freeze([1, 8]) });
export const CLIFF = Object.freeze({ min: 3.2, back: 0.22, face: 1, toe: 0.7, depth: 3.2, foot: 5, lip: 2 });
// (how far past the shoreline nothing grows: a beach's sand and a strip past it; a cliff's lip)
const CLEAR = Object.freeze({ beach: 1.5, cliff: 1.2 });
// (the sheets' cell, m, their alpha (shallow and deep), and how far past the shoreline a sheet's corner may stand)
const SHEET = Object.freeze({ cell: 1, alpha: [0.22, 0.9], reach: 1.5 });

/** The water laid on a tile (see the header). */
export function tileWater(W, { size: T, origin: [ox, oy], land, fill = '#3a8cb8' }) {
  const water = new Map(W.cells.map(([r, c, b]) => [`${r},${c}`, b])), seed = W.seed ?? 1;
  const shore = new Map((W.shore ?? []).map(([r, c, k]) => [`${r},${c}`, k]));
  // a level point's tile (row south, column east) and a square's distance from it
  const cellOf = (X, Y) => [Math.floor(-Y / T), Math.floor(X / T)];
  const dSq = (X, Y, r, c) => { const x0 = c * T, x1 = x0 + T, y1 = -r * T, y0 = y1 - T; return Math.hypot(Math.max(x0 - X, 0, X - x1), Math.max(y0 - Y, 0, Y - y1)); };
  // THE SIGNED DISTANCE to the water's squares (− inside), within SHORE.reach tiles; a body's index where it is nearest
  const R = 2;
  const signed = (X, Y) => {
    const [r0, c0] = cellOf(X, Y), inside = water.has(`${r0},${c0}`);
    let d = Infinity, body = inside ? water.get(`${r0},${c0}`) : null;
    for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
      const r = r0 + dr, c = c0 + dc, w = water.has(`${r},${c}`);
      // (inside: the nearest square that is not water, off the map's edge too; outside: the nearest water square)
      if (inside ? w : !w) continue;
      if (inside && (r < 0 || c < 0 || r >= W.rows || c >= W.cols)) continue;
      const q = dSq(X, Y, r, c);
      if (q < d) { d = q; if (!inside) body = water.get(`${r},${c}`); }
    }
    return { s: inside ? -Math.min(d, R * T) : Math.min(d, R * T), body };
  };
  // the shoreline ROUNDED (the distance averaged over a disc of SHORE.round, so no square's corner shows, convex or
  // hollow), WANDERED (two octaves of noise on the level's frame) and SET IN: + on the land, − on the water
  const RING = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * SHORE.round, Math.sin((i * Math.PI) / 4) * SHORE.round]);
  const sAt = (X, Y) => {
    const S = signed(X, Y);
    let sum = S.s; for (const [dx, dy] of RING) sum += signed(X + dx, Y + dy).s;
    const wander = SHORE.wander[0] * (2 * vnoise(X / SHORE.stride[0], Y / SHORE.stride[0], seed + 1201) - 1) + SHORE.wander[1] * (2 * vnoise(X / SHORE.stride[1], Y / SHORE.stride[1], seed + 1207) - 1);
    return { ...S, s: sum / 9 + SHORE.inset + wander };
  };
  // WHICH EDGE: the shore tiles near a point, each weighed by how near its square is (SHORE.blend), so the shoreline
  // beside a cliff's tile is that cliff and a beach turns into it along the shore; none near, a beach
  const kAt = (X, Y) => {
    let w = 0, k = 0;
    for (const [key, v] of shore) { const [r, c] = key.split(',').map(Number), d = dSq(X, Y, r, c), q = 1 / (1 + (d / SHORE.blend) ** 2) ** 2; w += q; k += q * v; }
    // (the turn from a beach to a cliff kept short: a shore is one or the other, the mix only where they meet)
    return w ? smooth(SHORE.turn[0], SHORE.turn[1], k / w) : 0;
  };
  const levelOf = (b) => W.levels[b] ?? 0;
  // THE HELD GROUND: round each place's square (its building's), the land as it lies, eased out over SHORE.hold
  const hold = W.hold ?? [];
  const holdAt = (X, Y) => { let d = Infinity; for (const [r, c] of hold) d = Math.min(d, dSq(X, Y, r, c)); return d === Infinity ? 0 : 1 - smooth(SHORE.hold[0], SHORE.hold[1], d); };
  // THE PROFILE at a point of the tile: the land with the water cut in (tile frame in, level frame within)
  const profile = (x, y, zl) => {
    const X = ox + x, Y = oy + y, S = sAt(X, Y);
    if (S.body === null || S.s > Math.max(SHORE.beach + SHORE.ease, CLIFF.lip + 30) + 1) return { z: zl, s: S.s, k: 0, L: null };
    const L = levelOf(S.body), s = S.s, k = kAt(X, Y);
    // the beach: a strand from the waterline to its berm, eased into the land; the shelf under the water
    const zb = s >= 0 ? mix(L + SHORE.berm * smooth(0, SHORE.beach, s), zl, smooth(SHORE.beach, SHORE.beach + SHORE.ease, s)) : L - SHORE.depth * smooth(0, SHORE.shelf, -s);
    // the cliff: the lip held up and falling back to the land behind it, the face down to its toe, the bed past it
    const top = Math.max(zl, L + CLIFF.min - CLIFF.back * Math.max(0, s - CLIFF.lip));
    const zc = s >= 0 ? top : s > -CLIFF.face ? mix(L - CLIFF.toe, top, smooth(-CLIFF.face, 0, s)) : L - CLIFF.toe - (CLIFF.depth - CLIFF.toe) * smooth(0, CLIFF.foot, -s - CLIFF.face);
    // (the land past the shore's reach stays the land: a beach lowers only, a cliff raises only near its lip; and round a
    // place the land is held as it lies, so a building beside the water stands on the ground it was planned on)
    const h = holdAt(X, Y), z = mix(mix(zb, zc, k), zl, h);
    return { z, s, k, L, held: h > 0.5 };
  };
  const carve = (x, y, zl) => profile(x, y, zl).z;
  // what the builders read: sand on a beach, wet under the water, nothing grown on either nor on a cliff's lip
  const at = (x, y) => profile(x, y, land(x, y));
  // (the bed under the water is the shore's sand whatever its edge, never grass; on the land, a beach's strand only)
  // (and a place's held ground is its own, never cut as a beach)
  const sand = (x, y) => { const P = at(x, y); if (P.L === null || (P.held && P.z > P.L)) return -1; if (P.s < 0) return 1 - P.s; return P.k >= 0.1 ? -1 : SHORE.beach + 0.6 - P.s; };
  const wet = (x, y) => { const P = at(x, y); return P.L !== null && P.s < 0 && P.z < P.L; };
  const level = (x, y) => { const P = at(x, y); return P.L !== null && P.s < SHORE.beach ? P.L : null; };
  const clear = (x, y) => { const P = at(x, y); return P.L !== null && P.s < (P.k >= 0.5 ? CLEAR.cliff : SHORE.beach + CLEAR.beach); };
  // THE SHEETS: 1 m cells over the tile's square where its ground lies under its body's level, at that level
  const faces = [], bodies = new Set();
  for (let y = 0; y < T - 1e-9; y += SHEET.cell) for (let x = 0; x < T - 1e-9; x += SHEET.cell) {
    const cs = [[x, y], [Math.min(T, x + SHEET.cell), y], [Math.min(T, x + SHEET.cell), Math.min(T, y + SHEET.cell)], [x, Math.min(T, y + SHEET.cell)]].map(([a, b]) => ({ a, b, P: at(a, b) }));
    // (only on the water's side of the shoreline: a hollow inland under a body's level is dry land, never flooded)
    const Q = cs.find((q) => q.P.L !== null);
    if (!Q || cs.every((q) => q.P.L === null || q.P.s > SHEET.reach || q.P.z > q.P.L + 0.02)) continue;
    const L = Q.P.L;
    bodies.add(L);
    // (a corner over dry land fully clear, so the water's edge is where the land meets it, never a cell's)
    const alpha = cs.map((q) => r5(q.P.z >= L ? 0 : Math.max(SHEET.alpha[0], Math.min(SHEET.alpha[1], SHEET.alpha[0] + ((L - q.P.z) / SHORE.depth) * (SHEET.alpha[1] - SHEET.alpha[0])))));
    faces.push({ corners: cs.map((q) => [r5(q.a), r5(q.b), r5(L)]), normal: [0, 0, 1], outNormal: [0, 0, 1], fill, water: true, cornerAlpha: alpha, group: 'isekai:water' });
  }
  return {
    carve, forms: [...bodies].map((L) => ({ form: 'map-water', level: r5(L) })), faces, cameras: [], anchors: [], hazards: [], plan: [],
    wet, sand, level, clear, bare: (x, y) => wet(x, y) || sand(x, y) > 0,
    // (the shore at a point, for the map's readout and laws: its signed distance, its edge, its level)
    at,
  };
}
