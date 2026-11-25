/**
 * THE MASSIF (`massif`, opt-in on a local meru's island): the standing rock of a land seen at a mech's scale. Sandstone
 * country: blocks of rock (jebels, buttes, fins) standing sheer out of an open floor, their walls stepped by the beds they
 * are made of, fluted where the rain ran down them, capped with domes; gorges cut between and through them; an apron of
 * talus at every wall's foot at the angle of repose, lobed into fans; and hollows and river beds under the island's
 * waterline, so its sea fills them (a lake, a river in its gorge) with no water of their own.
 *
 *   MASSIF_CARDS              the cards to start from (a card is a starter: change what the field needs)
 *   readMassif(spec)          a card id or { from?, …words } → the massif, checked
 *   massifField(M, centre, seed, floor) → { at(x, y, h) → h' (the land's height with the massif on it, from the plain's h),
 *                                rock(x, y) → metres of rock over the floor (0 off it), water(x, y) → true where a hollow or a
 *                                river is carved, boulders: [{ x, y, size }], partings(lo, hi) → the thin beds' partings and
 *                                middles between two heights (the levels a wall is cut at), warp(x, y, z) → [dx, dy]: how
 *                                far a wall's corner is pushed (along the wall, out of the rock; 0 off a wall) }
 *   massifLaws(M, heightAt, square) → the ledger: [{ law, want, why, ok, value }]
 *
 * One wall profile reads both sides of the rock: a block's inward distance from its outline and a cut's distance past
 * its edge are the same `e` (metres into the rock), so a gorge's walls are the beds a jebel's are. The BEDS are one column
 * for the whole massif, in metres over the floor: the same bed tops at the same heights on every block, so the country
 * reads as one rock cut apart, not as blocks set down.
 *
 * A massif's words (metres; coordinates from the island's middle, x east, y north):
 *   beds     [{ top, bench }], bottom up: each bed's top over the floor, and how far its top steps back before the next
 *            bed's riser (0: the next bed rises straight on). A block's height ends the column where it stands
 *   slope    a bench's rise per metre of its run (a soft bed weathered back): 0 flat, 0.6 a steep scramble
 *   bench    0..1, how much a bench's run wanders along the wall (0: rings round every block; 1: from none to double)
 *   blocks   [{ at: [x, y], size: [a, b] (half-lengths), dir (degrees of its long axis), height, square? }]: each block's
 *            plan a superellipse (`square` its corner: 2 an ellipse, 4 nearly a box) warped and fluted
 *   warp     { strength, scale }: the outline pushed into lobes and embayments
 *   flute    { depth, scale }: vertical ribs and gullies down every wall (the outline's own small wander)
 *   cap      { form: 'dome' | 'knobs' | 'flat', height, run }: what tops a block over its last bed
 *   talus    { share (of the wall's height at its foot), angle (degrees, the repose), fan (0..1, how lobed) }
 *   cuts     [{ path: [[x, y], …], width, river?: { width, depth } }]: gorges carved through the rock to the floor, a
 *            river bed down the middle of a cut that names one
 *   clefts   { per, width: [lo, hi], reach }: slots cut into every block from its edge (Wadi Rum's siqs into a jebel):
 *            `per` of them for each 150 m of the block's half-lengths summed, each `reach` of the way to its middle, its
 *            width between lo and hi; per 0 for none
 *   pools    [{ at: [x, y], radius, depth }]: hollows in the floor (under the island's sea line, a lake)
 *   strew    { count, size: [lo, hi] }: fallen blocks on the talus, the boulders the scene lays (their size in its units)
 *   face     { beds: [lo, hi], bulge, undercut, grain }: the walls' own relief at a mech's scale, the land's corners pushed
 *            in and out along the wall (`warp`): the column parted again into thin beds lo to hi metres thick, each of its
 *            own hardness; a hard bed BULGES (up to `bulge` metres at its middle), a parting is a recess, the foot of a
 *            massive bed is UNDERCUT (up to `undercut`, the overhang a height grid cannot draw, leaned in), and `grain`
 *            metres of noise in all three directions so no two walls are alike. 0s for a smooth wall
 *
 * Pure and seeded: the same words, the same rock.
 */
import { fractal2, warp2, smoothstep } from '../noise/noise.js';
import { hash3 } from '../era/dirt.js';

const f = Object.freeze;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bad = (m) => { throw new Error(`local-meru: massif${m}`); };
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

// the wadi's column: a plinth, the massive red wall, a ledge, the upper wall, the pale domed beds
const WADI_BEDS = f([f({ top: 8, bench: 4 }), f({ top: 46, bench: 10 }), f({ top: 54, bench: 4 }), f({ top: 82, bench: 12 }), f({ top: 96, bench: 5 }), f({ top: 140, bench: 8 })]);
const CARD = f({ beds: WADI_BEDS, slope: 0.25, bench: 0.7, blocks: f([]), warp: f({ strength: 60, scale: 120 }), flute: f({ depth: 6, scale: 16 }),
  cap: f({ form: 'knobs', height: 16, run: 40 }), talus: f({ share: 0.2, angle: 34, fan: 0.6 }), cuts: f([]), clefts: f({ per: 1.2, width: f([12, 28]), reach: 0.75 }), pools: f([]), strew: f({ count: 90, size: f([2, 8]) }),
  face: f({ beds: f([5, 10]), bulge: 2.2, undercut: 2.4, grain: 1.6 }) });

// how far a riser runs to its shoulder at most (metres): sheer at the foot, its top rounded over this
const SHOULDER = 6;
const B = (at, size, dir, height, square = 3) => f({ at: f(at), size: f(size), dir, height, square });

/** The cards: the field's standing rock as its own words. Each is laid for a field some 760 m across (the frame's square). */
export const MASSIF_CARDS = f({
  // a wadi: an open sand floor between sheer jebels, a siq where two nearly meet, one butte standing alone mid-field
  wadi: f({ ...CARD, id: 'wadi', reads: 'An open sand floor between sheer stepped jebels, a siq between two, a butte alone',
    blocks: f([
      B([-330, 80], [150, 95], 70, 104), B([-250, -260], [120, 70], 20, 86), B([150, -330], [170, 70], 165, 96),
      B([360, 40], [110, 160], 95, 118), B([210, 330], [150, 80], 10, 92), B([-140, 360], [110, 70], 160, 80),
      B([-60, 30], [46, 32], 40, 62, 4), B([130, -40], [40, 26], 120, 48, 4),
    ]),
    cuts: f([f({ path: f([f([-420, -40]), f([-300, -10]), f([-230, 30])]), width: 26 })]) }),
  // a gorge: a plateau cut through by one winding canyon the field runs down, side canyons into it, a river on its floor
  gorge: f({ ...CARD, id: 'gorge', reads: 'A plateau cut by a winding canyon, side canyons into it, a river down its floor',
    beds: f([f({ top: 6, bench: 3 }), f({ top: 38, bench: 10 }), f({ top: 46, bench: 4 }), f({ top: 70, bench: 12 }), f({ top: 120, bench: 6 })]),
    blocks: f([B([0, 0], [900, 900], 0, 74, 4)]), cap: f({ form: 'dome', height: 6, run: 80 }), warp: f({ strength: 40, scale: 120 }),
    cuts: f([
      f({ path: f([f([-80, -600]), f([-40, -300]), f([90, -150]), f([60, 60]), f([-90, 200]), f([-30, 400]), f([60, 620])]), width: 190, river: f({ width: 34, depth: 4.5 }) }),
      f({ path: f([f([-600, -120]), f([-300, -90]), f([-60, -170])]), width: 70 }),
      f({ path: f([f([620, 260]), f([320, 200]), f([40, 120])]), width: 84 }),
    ]), strew: f({ count: 100, size: f([2, 8]) }),
    // (a canyon's walls thinner-bedded and harder-edged than a jebel's)
    face: f({ beds: f([4, 8]), bulge: 2.6, undercut: 2.6, grain: 1.4 }) }),
  // scree country: a long scarp on the north, its foot a broad apron of fans and the blocks fallen off it, low buttes out
  // on the broken floor
  scree: f({ ...CARD, id: 'scree', reads: 'A long scarp, its foot a broad apron of scree fans and fallen blocks, low buttes on a broken floor',
    beds: f([f({ top: 14, bench: 6 }), f({ top: 40, bench: 4 }), f({ top: 62, bench: 8 }), f({ top: 120, bench: 5 })]),
    blocks: f([
      B([0, 520], [900, 260], 0, 96, 4),
      B([-200, 80], [36, 26], 30, 26, 3), B([140, -60], [30, 22], 120, 22, 3), B([-60, -240], [44, 30], 70, 30, 3),
      B([260, 170], [26, 18], 10, 18, 3), B([-340, -120], [28, 20], 150, 20, 3), B([330, -280], [40, 26], 60, 34, 3),
    ]),
    talus: f({ share: 0.34, angle: 33, fan: 0.9 }), flute: f({ depth: 7, scale: 18 }), strew: f({ count: 200, size: f([2, 8]) }),
    // (a scarp shedding its rock: thick beds, broken more than bedded)
    face: f({ beds: f([6, 14]), bulge: 1.6, undercut: 1.6, grain: 2.4 }) }),
  // an oasis: a lake on the floor of a wadi among jebels, a pool beside it
  oasis: f({ ...CARD, id: 'oasis', reads: 'A lake on a wadi\'s floor among sheer jebels, a pool beside it',
    blocks: f([
      B([-340, 40], [130, 110], 80, 98), B([-180, -320], [130, 60], 30, 84), B([200, -340], [150, 70], 160, 90),
      B([370, 90], [100, 150], 95, 112), B([120, 360], [170, 80], 10, 96), B([-260, 330], [90, 70], 150, 78),
    ]),
    pools: f([f({ at: f([40, 60]), radius: 150, depth: 6 }), f({ at: f([-150, -150]), radius: 46, depth: 4 })]) }),
});

const WORDS = ['id', 'reads', 'from', ...Object.keys(CARD)];
const num = (v, lo, hi, m) => { if (!(typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi)) bad(m); };
const pt = (v, m) => { if (!(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite))) bad(m); };

/** A card id or { from?, …words } → the massif, every word checked. */
export function readMassif(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (typeof spec === 'string') {
    if (!MASSIF_CARDS[spec]) bad(` '${spec}' is not a card (cards: ${Object.keys(MASSIF_CARDS).join(', ')})`);
    return structuredClone(MASSIF_CARDS[spec]);
  }
  if (!isObj(spec)) bad(` is a card id (${Object.keys(MASSIF_CARDS).join(', ')}) or { from?, …words }`);
  for (const k of Object.keys(spec)) if (!WORDS.includes(k)) bad(`.${k} is not a word (words: ${WORDS.join(', ')})`);
  if (spec.from !== undefined && !MASSIF_CARDS[spec.from]) bad(`.from '${spec.from}' is not a card (cards: ${Object.keys(MASSIF_CARDS).join(', ')})`);
  const { from, ...own } = spec, M = structuredClone({ ...(from ? MASSIF_CARDS[from] : { ...CARD, id: 'own', reads: '' }), ...own });
  if (from && own.id === undefined) M.id = `${from}*`;
  if (!Array.isArray(M.beds) || !M.beds.length) bad('.beds is [{ top, bench }], bottom up, at least one');
  M.beds.forEach((b, i) => {
    if (!isObj(b)) bad(`.beds[${i}] is { top, bench }`);
    num(b.top, 0.5, 400, `.beds[${i}].top is metres over the floor, 0.5..400`);
    num(b.bench, 0, 80, `.beds[${i}].bench is metres the bed's top steps back, 0..80`);
    if (i && b.top <= M.beds[i - 1].top) bad(`.beds[${i}].top stands over the bed below it (bottom up)`);
  });
  num(M.slope, 0, 1.5, '.slope is a bench\'s rise per metre, 0..1.5');
  num(M.bench, 0, 1, '.bench is 0..1, how much a bench wanders along the wall');
  if (!Array.isArray(M.blocks)) bad('.blocks is [{ at, size, dir, height, square? }]');
  M.blocks.forEach((b, i) => {
    if (!isObj(b)) bad(`.blocks[${i}] is { at, size, dir, height, square? }`);
    pt(b.at, `.blocks[${i}].at is [x, y] metres from the middle`);
    if (!(Array.isArray(b.size) && b.size.length === 2 && b.size.every((v) => typeof v === 'number' && v >= 4 && v <= 2000))) bad(`.blocks[${i}].size is [a, b] half-lengths in metres, 4..2000`);
    num(b.dir ?? 0, -360, 360, `.blocks[${i}].dir is degrees`);
    num(b.height, 2, 400, `.blocks[${i}].height is metres, 2..400`);
    num(b.square ?? 3, 2, 8, `.blocks[${i}].square is the plan's corner, 2 (an ellipse) to 8 (a box)`);
  });
  for (const [k, v, lim] of [['warp', M.warp, ['strength', 0, 400, 'scale', 4, 2000]], ['flute', M.flute, ['depth', 0, 40, 'scale', 2, 200]]]) {
    if (!isObj(v)) bad(`.${k} is { ${lim[0]}, ${lim[3]} }`);
    num(v[lim[0]], lim[1], lim[2], `.${k}.${lim[0]} is ${lim[1]}..${lim[2]}`);
    num(v[lim[3]], lim[4], lim[5], `.${k}.${lim[3]} is metres, ${lim[4]}..${lim[5]}`);
  }
  if (!isObj(M.cap) || !['dome', 'knobs', 'flat'].includes(M.cap.form)) bad(".cap is { form: 'dome' | 'knobs' | 'flat', height, run }");
  num(M.cap.height, 0, 120, '.cap.height is metres, 0..120');
  num(M.cap.run, 1, 400, '.cap.run is metres, 1..400');
  if (!isObj(M.talus)) bad('.talus is { share, angle, fan }');
  num(M.talus.share, 0, 0.8, '.talus.share is its height at the wall\'s foot as a share of the wall, 0..0.8');
  num(M.talus.angle, 20, 45, '.talus.angle is degrees of repose, 20..45');
  num(M.talus.fan, 0, 1, '.talus.fan is 0..1');
  if (!Array.isArray(M.cuts)) bad('.cuts is [{ path, width, river? }]');
  M.cuts.forEach((c, i) => {
    if (!isObj(c) || !Array.isArray(c.path) || c.path.length < 2) bad(`.cuts[${i}] is { path: [[x, y], …] (2 or more), width, river? }`);
    c.path.forEach((q, j) => pt(q, `.cuts[${i}].path[${j}] is [x, y]`));
    num(c.width, 4, 800, `.cuts[${i}].width is metres, 4..800`);
    if (c.river !== undefined) {
      if (!isObj(c.river)) bad(`.cuts[${i}].river is { width, depth }`);
      num(c.river.width, 2, c.width, `.cuts[${i}].river.width is metres, 2 up to the cut's width`);
      num(c.river.depth, 0.5, 40, `.cuts[${i}].river.depth is metres under the floor, 0.5..40`);
    }
  });
  if (!isObj(M.clefts)) bad('.clefts is { per, width: [lo, hi], reach }');
  num(M.clefts.per, 0, 6, '.clefts.per is 0..6, slots for each 150 m of a block');
  if (!(Array.isArray(M.clefts.width) && M.clefts.width.length === 2 && M.clefts.width[0] >= 4 && M.clefts.width[1] >= M.clefts.width[0] && M.clefts.width[1] <= 200)) bad('.clefts.width is [lo, hi] metres, 4..200');
  num(M.clefts.reach, 0.1, 1.2, '.clefts.reach is the share of the way to a block\'s middle, 0.1..1.2');
  if (!Array.isArray(M.pools)) bad('.pools is [{ at, radius, depth }]');
  M.pools.forEach((q, i) => {
    if (!isObj(q)) bad(`.pools[${i}] is { at, radius, depth }`);
    pt(q.at, `.pools[${i}].at is [x, y]`);
    num(q.radius, 2, 800, `.pools[${i}].radius is metres, 2..800`);
    num(q.depth, 0.5, 40, `.pools[${i}].depth is metres under the floor, 0.5..40`);
  });
  if (!isObj(M.face)) bad('.face is { beds: [lo, hi], bulge, undercut, grain }');
  if (!(Array.isArray(M.face.beds) && M.face.beds.length === 2 && M.face.beds[0] >= 2 && M.face.beds[1] >= M.face.beds[0] && M.face.beds[1] <= 40)) bad('.face.beds is [lo, hi] metres a thin bed stands, 2..40');
  num(M.face.bulge, 0, 4, '.face.bulge is metres a hard bed stands out, 0..4');
  num(M.face.undercut, 0, 4, '.face.undercut is metres a bed\'s foot is cut in, 0..4');
  num(M.face.grain, 0, 3, '.face.grain is metres of noise, 0..3');
  if (!isObj(M.strew)) bad('.strew is { count, size: [lo, hi] }');
  num(M.strew.count, 0, 600, '.strew.count is 0..600');
  if (!(Array.isArray(M.strew.size) && M.strew.size.length === 2 && M.strew.size[0] >= 1 && M.strew.size[1] >= M.strew.size[0] && M.strew.size[1] <= 8)) bad('.strew.size is [lo, hi], 1..8');
  return M;
}

/** The distance from (x, y) to a polyline, and how far along it (metres). */
function toPath(path, x, y) {
  let best = Infinity, along = 0, run = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0, qx = ax + dx * t - x, qy = ay + dy * t - y, d = Math.sqrt(qx * qx + qy * qy);
    if (d < best) { best = d; along = run + t * L; }
    run += L;
  }
  return [best, along];
}

/**
 * The massif laid on its island → its height (from the plain's), its rock, its water and its fallen blocks. `centre` is
 * the island's middle, where the words' coordinates start.
 */
export function massifField(M, centre, seed = 1, floor = 0) {
  const [cx, cy] = centre, sd = (seed | 0) * 7919;
  const tan = Math.tan((M.talus.angle * Math.PI) / 180);
  const wn = (x, y, s, k) => fractal2(x / s, y / s, { seed: sd + k, octaves: 3 })[0];
  // the wall's profile: e metres into the rock of a block `H` high at (x, y) → its height over the floor
  const risers = (x, y, H) => {
    const out = [];
    let inset = 0;
    for (let k = 0; k < M.beds.length; k++) {
      const b = M.beds[k], top = Math.min(b.top, H);
      out.push([inset, top]);
      if (top >= H) return out;
      inset += b.bench * Math.max(0, 1 + M.bench * 1.4 * wn(x, y, 46, 101 + k * 13));
    }
    out.push([inset, H]);
    return out;
  };
  const capAt = (x, y, e) => {
    const C = M.cap, t = smoothstep(0, C.run, e);
    if (C.form === 'flat' || !C.height) return 0;
    if (C.form === 'dome') return C.height * t;
    // knobs: the pale beds weathered to beehive domes, a knob every few tens of metres
    const n = fractal2(x / 34, y / 34, { seed: sd + 211, octaves: 2, flavour: 'billow' })[0];
    return C.height * t * (0.45 + 0.55 * (1 - Math.abs(n)));
  };
  const profile = (x, y, e, H) => {
    const fan = 1 + M.talus.fan * 0.9 * wn(x, y, 28, 401), T = Math.max(0, M.talus.share * H * fan);
    const talus = e <= 0 ? T + e * tan : T;
    if (e <= 0) return talus;
    const R = risers(x, y, H);
    let z = 0;
    for (let k = 0; k < R.length; k++) {
      const [inset, top] = R[k];
      if (e < inset) break;
      // (each riser climbs over a short run to a rounded shoulder: sheer at its foot, its top weathered round)
      const below = k ? R[k - 1][1] : 0, run = Math.min(SHOULDER, (top - below) * 0.15), u = run > 0 ? Math.min(1, (e - inset) / run) : 1;
      const rise = below + (top - below) * (1 - (1 - u) ** 3);
      const next = k + 1 < R.length ? R[k + 1][1] : Infinity;
      z = u < 1 ? rise : Math.min(top + (e - inset - run) * M.slope, next);
      if (k === R.length - 1 && u >= 1) z = top + capAt(x, y, e - inset - run);
    }
    return Math.max(z, talus);
  };
  // each block: its frame, and the box it reaches (its outline's wander and its talus)
  const blocks = M.blocks.map((b, i) => {
    const a = ((b.dir ?? 0) * Math.PI) / 180, u = [Math.cos(a), Math.sin(a)], reach = Math.max(...b.size) + M.warp.strength * 1.5 + M.flute.depth + (M.talus.share * b.height * 2) / tan + 4;
    return { ...b, i, u, n: b.square ?? 3, c: [cx + b.at[0], cy + b.at[1]], reach };
  });
  const flute = (x, y) => M.flute.depth * fractal2(x / M.flute.scale, y / M.flute.scale, { seed: sd + 307, octaves: 2, flavour: 'ridged' })[0];
  const warpW = { strength: M.warp.strength, scale: M.warp.scale, seed: sd + 503 };
  // e metres into block b at (x, y) (negative outside)
  const into = (b, x, y, wx, wy) => {
    const dx = wx - b.c[0], dy = wy - b.c[1], lx = (dx * b.u[0] + dy * b.u[1]) / b.size[0], ly = (-dx * b.u[1] + dy * b.u[0]) / b.size[1];
    const q = (Math.abs(lx) ** b.n + Math.abs(ly) ** b.n) ** (1 / b.n), d = Math.hypot(dx, dy);
    const rDir = q > 1e-9 ? d / q : Math.min(...b.size);
    return rDir - d + flute(x, y);
  };
  const cuts = M.cuts.map((c) => ({ ...c, path: c.path.map(([px, py]) => [cx + px, cy + py]) }));
  // the clefts: from a point on each block's outline toward its middle, bent once on the way, each its own width
  const C = M.clefts;
  for (const b of blocks) {
    const n = Math.round((C.per * (b.size[0] + b.size[1])) / 150);
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * ((k + 0.5 + 0.6 * (hash3(b.i, k, sd + 1001) - 0.5)) / n), ca = Math.cos(a), sa = Math.sin(a);
      const lx = ca * b.size[0], ly = sa * b.size[1], ox = b.c[0] + lx * b.u[0] - ly * b.u[1], oy = b.c[1] + lx * b.u[1] + ly * b.u[0];
      const reach = C.reach * (0.6 + 0.6 * hash3(b.i, k, sd + 1003)), bend = 0.35 * (hash3(b.i, k, sd + 1005) - 0.5);
      const mx = ox + (b.c[0] - ox) * reach * 0.5 - (b.c[1] - oy) * bend, my = oy + (b.c[1] - oy) * reach * 0.5 + (b.c[0] - ox) * bend;
      const ex = ox + (b.c[0] - ox) * reach, ey = oy + (b.c[1] - oy) * reach, out = 0.25;
      cuts.push({ path: [[ox - (ex - ox) * out, oy - (ey - oy) * out], [mx, my], [ex, ey]], width: C.width[0] + (C.width[1] - C.width[0]) * hash3(b.i, k, sd + 1007), cleft: true });
    }
  }
  for (const c of cuts) { let L = 0; for (let i = 0; i + 1 < c.path.length; i++) L += Math.hypot(c.path[i + 1][0] - c.path[i][0], c.path[i + 1][1] - c.path[i][1]); c.length = L; }
  const pools = M.pools.map((q) => ({ ...q, c: [cx + q.at[0], cy + q.at[1]] }));
  const rock = (x, y) => {
    const [wx, wy] = M.warp.strength ? warp2(x, y, warpW) : [x, y];
    let z = 0;
    for (const b of blocks) {
      if (Math.abs(x - b.c[0]) > b.reach || Math.abs(y - b.c[1]) > b.reach) continue;
      const e = into(b, x, y, wx, wy);
      if (e < -b.reach) continue;
      z = Math.max(z, profile(x, y, e, b.height));
    }
    if (z <= 0) return 0;
    for (const c of cuts) {
      const [d, along] = toPath(c.path, wx, wy), w = c.width * (1 + 0.25 * wn(along, 0, 160, 601)) * (c.cleft ? 1 - 0.7 * smoothstep(0, c.length, along) : 1);
      z = Math.min(z, Math.max(0, profile(x, y, d + flute(x, y) * 0.6 - w / 2, z)));
    }
    return z;
  };
  // the water carved under the floor: a cut's river bed, a pool's bowl → [w, depth]: how far (0..1) the land is drawn
  // down to `depth` under the floor's datum, so a bed lies under the sea line whatever the floor's roll lifts round it
  const sink = (x, y) => {
    let w = 0, D = 0;
    for (const c of cuts) {
      if (!c.river) continue;
      const [wx, wy] = warp2(x, y, { strength: c.river.width * 0.6, scale: 70, seed: sd + 701 }), [d] = toPath(c.path, wx, wy), hw = c.river.width / 2;
      if (d < hw * 1.6) { const t = 1 - smoothstep(hw * 0.4, hw * 1.6, d); if (t > w) { w = t; D = c.river.depth; } }
    }
    for (const q of pools) {
      const d = Math.hypot(x - q.c[0], y - q.c[1]), R = q.radius * (1 + 0.22 * wn(x, y, q.radius * 0.6, 801));
      if (d < R * 1.2) { const t = 1 - smoothstep(R * 0.35, R * 1.2, d); if (t > w) { w = t; D = q.depth; } }
    }
    return [w, D];
  };
  const at = (x, y, h) => {
    const z = rock(x, y), [w, D] = sink(x, y), base = w > 0 ? h + (floor - D - h) * w : h;
    return z > 0 ? Math.max(base, h + z) : base;
  };
  // the fallen blocks: dice on the talus aprons (a point outside a wall and under its apron's line), off the water
  const boulders = [];
  const lo = Math.min(...blocks.map((b) => b.c[0] - b.reach)), hi = Math.max(...blocks.map((b) => b.c[0] + b.reach));
  const lo2 = Math.min(...blocks.map((b) => b.c[1] - b.reach)), hi2 = Math.max(...blocks.map((b) => b.c[1] + b.reach));
  for (let k = 0, tries = 0; blocks.length && boulders.length < M.strew.count && tries < M.strew.count * 40; tries++, k++) {
    const x = lo + (hi - lo) * hash3(k, 1, sd + 901), y = lo2 + (hi2 - lo2) * hash3(k, 2, sd + 903);
    if (sink(x, y)[0] > 0) continue;
    const [wx, wy] = M.warp.strength ? warp2(x, y, warpW) : [x, y];
    const on = blocks.find((b) => { const e = into(b, x, y, wx, wy); return e < -2 && e > -(M.talus.share * b.height * 1.6) / tan; });
    // (on an apron, never on a neighbour's rock: the ground there no higher than the apron's own foot)
    if (!on || rock(x, y) > M.talus.share * on.height * 1.3) continue;
    // (most of them small, a few great slabs: the size's dice weighted toward its low end)
    boulders.push({ x: r3(x), y: r3(y), size: M.strew.size[0] + Math.floor(hash3(k, 3, sd + 905) ** 2.5 * (M.strew.size[1] - M.strew.size[0] + 1)) });
  }
  // THE FACE: the column parted into thin beds (each lo..hi thick, its hardness its own), from the floor's datum up
  const FC = M.face, thin = [];
  for (let z = 0, k = 0; z < 420; k++) { const t = FC.beds[0] + (FC.beds[1] - FC.beds[0]) * hash3(k, 11, sd + 1101); thin.push({ z0: z, t, hard: 0.35 + 0.65 * hash3(k, 13, sd + 1103) }); z += t; }
  const bedAt = (h) => { let lo = 0, hi = thin.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (thin[m].z0 <= h) lo = m; else hi = m - 1; } return thin[lo]; };
  const partings = (lo, hi) => {
    const out = [];
    for (const b of thin) { const a = floor + b.z0, m = a + b.t / 2; if (a > hi) break; if (a > lo) out.push(r3(a)); if (m > lo && m < hi) out.push(r3(m)); }
    return out;
  };
  const still = !FC.bulge && !FC.undercut && !FC.grain;
  const warp = (x, y, z) => {
    if (still) return [0, 0];
    // (the wall's way out of the rock and how much of a wall it is here: the rock's slope over a few metres)
    const S = 3, gx = (rock(x + S, y) - rock(x - S, y)) / (2 * S), gy = (rock(x, y + S) - rock(x, y - S)) / (2 * S), g = Math.hypot(gx, gy);
    const w = smoothstep(0.9, 2.6, g);
    if (w <= 0) return [0, 0];
    const h = z - floor, b = bedAt(h), u = Math.min(1, Math.max(0, (h - b.z0) / b.t));
    // (a hard bed bulges at its middle; its parting recesses; its foot is cut in under it; the bulge wanders along the wall)
    // (and the country's own swing over a few hundred metres: one jebel massive and smooth, the next ledged bed on bed)
    const along = (0.55 + 0.45 * wn(x, y, 38, 1201 + (b.z0 | 0))) * (0.45 + 0.55 * smoothstep(-0.6, 0.6, wn(x, y, 260, 1207)));
    const bulge = FC.bulge * b.hard * along * (4 * u * (1 - u) - 0.45), under = FC.undercut * b.hard * (1 - u) ** 6;
    const grain = FC.grain * (0.6 * fractal2((x + y) / 11, h / 7, { seed: sd + 1301, octaves: 2 })[0] + 0.4 * fractal2((x - y) / 6, h / 4, { seed: sd + 1303, octaves: 2 })[0]);
    // (the floor and a cap are no wall: their corners stay where the land has them, the slope's weight easing to none)
    const d = (bulge - under + grain) * w, ox = -gx / g, oy = -gy / g;
    return [r3(ox * d), r3(oy * d)];
  };
  return { at, rock, water: (x, y) => sink(x, y)[0] > 0, boulders, partings, warp };
}

/**
 * The massif's ledger on the land it made, over the frame's square `[x0, y0, x1, y1]` sampled every `cell` metres. The
 * rock's laws weigh each steep step by the height it climbs, so a wall 60 m high outweighs a dome's knob:
 *   walls-stand    the rock's height is climbed by cliffs, not slopes: of the rise on faces steeper than 35°, most is on
 *                  faces over 70°
 *   talus-repose   the aprons lie at their repose and the walls stand: little of the rise on faces between 45° and 70°
 *   floor-open     a frame has room: a share of the square is ground it stands on (under 20°)
 */
export function massifLaws(heightAt, square, { cell = 4 } = {}) {
  const [x0, y0, x1, y1] = square;
  let steep = 0, wall = 0, mid = 0, open = 0, n = 0;
  for (let y = y0; y < y1; y += cell) for (let x = x0; x < x1; x += cell) {
    const h = heightAt(x, y), gx = (heightAt(x + cell, y) - h) / cell, gy = (heightAt(x, y + cell) - h) / cell, g = Math.hypot(gx, gy), rise = g * cell;
    n++;
    if (g < 0.364) open++;
    if (g > 0.7) { steep += rise; if (g > 2.75) wall += rise; else if (g > 1) mid += rise; }
  }
  const share = (a, b) => (b ? Math.round((a / b) * 1000) / 1000 : 0);
  return [
    { law: 'walls-stand', want: '≥ 0.6', why: 'a cliff reads as a wall a frame boosts up, not a slope it walks', value: share(wall, steep), ok: share(wall, steep) >= 0.6 },
    { law: 'talus-repose', want: '≤ 0.3', why: 'an apron lies at its repose and a wall stands: little ground between them', value: share(mid, steep), ok: share(mid, steep) <= 0.3 },
    { law: 'floor-open', want: '≥ 0.4', why: 'a frame fights on the floor: it needs room to skate and quick-boost', value: share(open, n), ok: share(open, n) >= 0.4 },
  ];
}
