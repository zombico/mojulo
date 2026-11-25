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
 *                                far a wall's corner is pushed (along the wall, out of the rock; 0 off a wall), inside(x, y) →
 *                                true on the rock itself (in a block's outline, off a cut's floor and the aprons), wash(x, y) →
 *                                how far into a dry wash's bed (1 its floor, 0 off it), crush(x, y) → how much of a fresh
 *                                crater's broken ground lies here (its bowl and rim), far(x, y) → true past the detail's reach
 *                                (the horizon's escarpments, seen only across the field: no push there, its walls cut coarser;
 *                                the push eases out before it, so a wall cut both ways where they meet still meets),
 *                                outcrops: the ledges the dice laid }
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
 *   outcrops { count, height: [lo, hi], size: [lo, hi], within }: the ground in front of a frame: low ledges of the same
 *            rock (slickrock, a pavement stepped up a bed or two) laid by the dice over the floor `within` metres of the
 *            middle, off the blocks and the water, each `size` metres across (its half-length) and `height` high: cover a
 *            frame crouches behind and a ledge it steps up, stepped by the same beds and worn by the same face
 *   washes   { count, width: [lo, hi], depth: [lo, hi] }: dry washes wandering across the floor, a flash flood's bed:
 *            shallow channels `depth` metres deep (never under the sea line: dry), their banks cut, their beds laid as
 *            gravel (`wash(x, y)` says where, the scene lays it as scree)
 *   scatter  { clusters, per: [lo, hi], spread, size: [lo, hi] }: boulders out on the open floor in clusters (a frame's cover,
 *            the ground in front of it at its scale): `clusters` places laid by the dice off the rock and the water, each
 *            `per` boulders within `spread` metres, their size the scene's boulder units (most small, a few large)
 *   horizon  { count, radius, length: [lo, hi], depth: [lo, hi], height: [lo, hi] }: the field's skyline, escarpments
 *            standing round it `radius` metres out (an island's rim, not a wall: the jebels and mesas the floor runs up to),
 *            each `length` metres along the ring (its half), `depth` across it, its own height; laid by the dice round the
 *            ring so they overlap into a broken skyline with its gaps, of the same rock as the rest
 *   craters  { count, diameter: [lo, hi], slope?, fresh, within, at? }: meteorite impacts on the floor. Each a simple crater, a bowl
 *            a fifth of its diameter deep under a raised rim (a twenty-fifth), its ejecta thinning as the cube of the
 *            distance out to three radii. Their sizes by the power law impacts keep, `slope` its exponent (1.1: many small pits,
 *            a fair few of every size between, a few great bowls; steeper, nearly all pits);
 *            each its own age, `fresh` the share young: a fresh one deep, its rim sharp, its ejected blocks strewn round it
 *            as boulders; an old one shallow, its rim worn, its floor filled flat with sand. Laid by the dice `within`
 *            metres of the middle (`count` of them), or named in `at` ([{ at: [x, y], diameter, fresh? }]); off the rock
 *            and the water; a younger one printed over an older. A bowl under the island's sea line is a crater lake.
 *            `clusters` { count, members: [lo, hi], length: [lo, hi], width: [lo, hi], diameter: [lo, hi], fresh }: STREWN
 *            FIELDS, a meteorite broken up on its way down and its fragments struck together along its flight: each field
 *            an ellipse `length` by `width` metres turned to its own heading, `members` craters in it all of one age, the
 *            largest (the heaviest fragments carry furthest) at its down-range end and the small trailing behind
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
  face: f({ beds: f([5, 10]), bulge: 2.2, undercut: 2.4, grain: 1.6 }),
  outcrops: f({ count: 0, height: f([1.5, 5]), size: f([6, 22]), within: 520 }), washes: f({ count: 0, width: f([8, 18]), depth: f([0.8, 1.6]) }),
  scatter: f({ clusters: 0, per: f([3, 8]), spread: 24, size: f([2, 5]) }),
  horizon: f({ count: 0, radius: 545, length: f([90, 170]), depth: f([40, 70]), height: f([50, 140]) }),
  craters: f({ count: 0, diameter: f([10, 120]), slope: 1.1, fresh: 0.4, within: 520, at: f([]), clusters: f({ count: 0, members: f([6, 14]), length: f([60, 160]), width: f([16, 40]), diameter: f([8, 26]), fresh: 0.6 }) }) });

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
    cuts: f([f({ path: f([f([-420, -40]), f([-300, -10]), f([-230, 30])]), width: 26 })]),
    // (the floor between: low ledges of slickrock and two dry washes across it)
    outcrops: f({ count: 30, height: f([2.5, 7]), size: f([8, 26]), within: 480 }), washes: f({ count: 2, width: f([10, 20]), depth: f([1, 1.7]) }),
    scatter: f({ clusters: 26, per: f([3, 8]), spread: 22, size: f([2, 5]) }),
    horizon: f({ count: 14, radius: 560, length: f([110, 180]), depth: f([40, 70]), height: f([60, 140]) }),
    craters: f({ count: 14, diameter: f([10, 70]), slope: 1.1, fresh: 0.4, within: 480, at: f([]), clusters: f({ count: 2, members: f([6, 12]), length: f([60, 140]), width: f([16, 32]), diameter: f([8, 24]), fresh: 0.6 }) }) }),
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
    talus: f({ share: 0.34, angle: 33, fan: 0.9 }), outcrops: f({ count: 26, height: f([2.5, 5]), size: f([6, 18]), within: 460 }), washes: f({ count: 3, width: f([8, 16]), depth: f([0.8, 1.4]) }),
    scatter: f({ clusters: 40, per: f([4, 10]), spread: 26, size: f([2, 5]) }),
    horizon: f({ count: 10, radius: 560, length: f([110, 180]), depth: f([40, 70]), height: f([50, 110]) }),
    craters: f({ count: 22, diameter: f([10, 90]), slope: 1.1, fresh: 0.5, within: 460, at: f([]), clusters: f({ count: 2, members: f([6, 12]), length: f([60, 140]), width: f([16, 32]), diameter: f([8, 24]), fresh: 0.6 }) }), flute: f({ depth: 7, scale: 18 }), strew: f({ count: 200, size: f([2, 8]) }),
    // (a scarp shedding its rock: thick beds, broken more than bedded)
    face: f({ beds: f([6, 14]), bulge: 1.6, undercut: 1.6, grain: 2.4 }) }),
  // a crater plain: a stony floor struck all over, its craters of every size by the impacts' law, one great fresh bowl and
  // one old one worn nearly flat; a few low buttes standing out on it, low ledges between
  craters: f({ ...CARD, id: 'craters', reads: 'A stony plain struck all over: craters of every size, one great fresh bowl, low buttes standing out',
    beds: f([f({ top: 6, bench: 4 }), f({ top: 30, bench: 6 }), f({ top: 44, bench: 5 }), f({ top: 120, bench: 6 })]),
    blocks: f([B([-380, 260], [90, 50], 40, 46, 3), B([400, -220], [70, 46], 120, 38, 3), B([-60, -420], [60, 34], 10, 30, 4), B([330, 330], [50, 30], 70, 26, 3)]),
    cap: f({ form: 'flat', height: 0, run: 40 }), clefts: f({ per: 0.8, width: f([10, 20]), reach: 0.6 }),
    outcrops: f({ count: 18, height: f([2, 5]), size: f([6, 18]), within: 480 }),
    scatter: f({ clusters: 18, per: f([3, 7]), spread: 20, size: f([2, 4]) }),
    horizon: f({ count: 13, radius: 565, length: f([100, 180]), depth: f([35, 60]), height: f([40, 90]) }),
    craters: f({ count: 60, diameter: f([10, 150]), slope: 1.0, fresh: 0.35, within: 520,
      at: f([f({ at: f([110, 150]), diameter: 240, fresh: 0.95 }), f({ at: f([-230, -150]), diameter: 210, fresh: 0.12 })]),
      // (and strewn fields, broken meteorites' craters struck together, the largest down-range)
      clusters: f({ count: 6, members: f([8, 18]), length: f([80, 220]), width: f([18, 50]), diameter: f([8, 34]), fresh: 0.6 }) }) }),
  // an oasis: a lake on the floor of a wadi among jebels, a pool beside it
  oasis: f({ ...CARD, id: 'oasis', reads: 'A lake on a wadi\'s floor among sheer jebels, a pool beside it',
    blocks: f([
      B([-340, 40], [130, 110], 80, 98), B([-180, -320], [130, 60], 30, 84), B([200, -340], [150, 70], 160, 90),
      B([370, 90], [100, 150], 95, 112), B([120, 360], [170, 80], 10, 96), B([-260, 330], [90, 70], 150, 78),
    ]),
    pools: f([f({ at: f([40, 60]), radius: 150, depth: 6 }), f({ at: f([-150, -150]), radius: 46, depth: 4 })]),
    outcrops: f({ count: 22, height: f([2.5, 6]), size: f([8, 22]), within: 480 }), washes: f({ count: 1, width: f([10, 16]), depth: f([1, 1.5]) }),
    scatter: f({ clusters: 20, per: f([3, 7]), spread: 20, size: f([2, 5]) }),
    horizon: f({ count: 14, radius: 560, length: f([110, 180]), depth: f([40, 70]), height: f([60, 130]) }) }),
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
  const range = (v, lo, hi, m) => { if (!(Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && v[0] >= lo && v[1] >= v[0] && v[1] <= hi)) bad(m); };
  if (!isObj(M.outcrops)) bad('.outcrops is { count, height: [lo, hi], size: [lo, hi], within }');
  num(M.outcrops.count, 0, 400, '.outcrops.count is 0..400');
  range(M.outcrops.height, 0.5, 30, '.outcrops.height is [lo, hi] metres, 0.5..30');
  range(M.outcrops.size, 2, 120, '.outcrops.size is [lo, hi] metres (half-lengths), 2..120');
  num(M.outcrops.within, 20, 2000, '.outcrops.within is metres from the middle, 20..2000');
  if (!isObj(M.washes)) bad('.washes is { count, width: [lo, hi], depth: [lo, hi] }');
  num(M.washes.count, 0, 20, '.washes.count is 0..20');
  range(M.washes.width, 2, 80, '.washes.width is [lo, hi] metres, 2..80');
  range(M.washes.depth, 0.2, 1.9, '.washes.depth is [lo, hi] metres, 0.2..1.9 (a dry wash: over the sea line)');
  if (!isObj(M.scatter)) bad('.scatter is { clusters, per: [lo, hi], spread, size: [lo, hi] }');
  num(M.scatter.clusters, 0, 200, '.scatter.clusters is 0..200');
  range(M.scatter.per, 1, 30, '.scatter.per is [lo, hi] boulders a cluster, 1..30');
  num(M.scatter.spread, 2, 200, '.scatter.spread is metres a cluster spreads, 2..200');
  range(M.scatter.size, 1, 8, '.scatter.size is [lo, hi] boulder units, 1..8');
  M.horizon = { ...CARD.horizon, ...(M.horizon ?? {}) };
  if (!isObj(M.horizon)) bad('.horizon is { count, radius, length, depth, height }');
  num(M.horizon.count, 0, 80, '.horizon.count is 0..80');
  num(M.horizon.radius, 50, 4000, '.horizon.radius is metres from the middle, 50..4000');
  range(M.horizon.length, 10, 2000, '.horizon.length is [lo, hi] metres along the ring (half), 10..2000');
  range(M.horizon.depth, 5, 1000, '.horizon.depth is [lo, hi] metres across it (half), 5..1000');
  range(M.horizon.height, 5, 400, '.horizon.height is [lo, hi] metres, 5..400');
  if (!isObj(M.craters)) bad('.craters is { count, diameter: [lo, hi], fresh, within, at? }');
  // (a document's craters over the card's: the words it leaves out its starter's)
  M.craters = { ...CARD.craters, ...M.craters };
  num(M.craters.count, 0, 400, '.craters.count is 0..400');
  range(M.craters.diameter, 4, 1200, '.craters.diameter is [lo, hi] metres, 4..1200');
  num(M.craters.slope ?? 1.1, 0.3, 3, '.craters.slope is the size law\'s exponent, 0.3..3 (1.1: every size, the small the most)');
  M.craters.slope = M.craters.slope ?? 1.1;
  num(M.craters.fresh, 0, 1, '.craters.fresh is the share of them young, 0..1');
  num(M.craters.within, 20, 2000, '.craters.within is metres from the middle, 20..2000');
  const CL = M.craters.clusters = { ...CARD.craters.clusters, ...(M.craters.clusters ?? {}) };
  if (!isObj(CL)) bad('.craters.clusters is { count, members, length, width, diameter, fresh }');
  num(CL.count, 0, 60, '.craters.clusters.count is 0..60');
  range(CL.members, 1, 60, '.craters.clusters.members is [lo, hi] craters a field, 1..60');
  range(CL.length, 10, 1500, '.craters.clusters.length is [lo, hi] metres a field runs along its flight, 10..1500');
  range(CL.width, 4, 600, '.craters.clusters.width is [lo, hi] metres a field spreads across it, 4..600');
  range(CL.diameter, 4, 300, '.craters.clusters.diameter is [lo, hi] metres, 4..300: its smallest pit and its largest crater');
  num(CL.fresh, 0, 1, '.craters.clusters.fresh is the share of fields young, 0..1');
  if (!Array.isArray(M.craters.at)) bad('.craters.at is [{ at: [x, y], diameter, fresh? }]');
  M.craters.at.forEach((c, i) => {
    if (!isObj(c)) bad(`.craters.at[${i}] is { at: [x, y], diameter, fresh? }`);
    pt(c.at, `.craters.at[${i}].at is [x, y] metres from the middle`);
    num(c.diameter, 4, 2000, `.craters.at[${i}].diameter is metres, 4..2000`);
    if (c.fresh !== undefined) num(c.fresh, 0, 1, `.craters.at[${i}].fresh is 0 (worn flat) to 1 (just struck)`);
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
  // the OUTCROPS: low ledges laid by the dice over the floor, off the card's own blocks and its water
  const O = M.outcrops, laid = [];
  for (let k = 0, tries = 0; laid.length < O.count && tries < O.count * 30; tries++, k++) {
    const a = 2 * Math.PI * hash3(k, 41, sd + 1401), r = O.within * Math.sqrt(hash3(k, 43, sd + 1403)), at = [r * Math.cos(a), r * Math.sin(a)];
    const half = O.size[0] + (O.size[1] - O.size[0]) * hash3(k, 47, sd + 1407) ** 1.6, height = O.height[0] + (O.height[1] - O.height[0]) * hash3(k, 53, sd + 1409) ** 1.5;
    const clear = (q, pad) => Math.hypot(at[0] - q[0], at[1] - q[1]) > pad;
    if (!M.blocks.every((b) => clear(b.at, Math.max(...b.size) + half + 20)) || !M.pools.every((q) => clear(q.at, q.radius * 1.3 + half)) || !laid.every((q) => clear(q.at, Math.max(...q.size) + half + 6))) continue;
    laid.push({ at, size: [half, half * (0.45 + 0.5 * hash3(k, 59, sd + 1411))], dir: 360 * hash3(k, 61, sd + 1413), height: r3(height), square: 2 + 3 * hash3(k, 67, sd + 1417) });
  }
  // the HORIZON: escarpments round the ring, each turned along it, spaced by the dice so they overlap into a skyline
  const HZ = M.horizon, ring = [];
  for (let k = 0, a = 2 * Math.PI * hash3(0, 301, sd + 2101); k < HZ.count; k++) {
    const len = HZ.length[0] + (HZ.length[1] - HZ.length[0]) * hash3(k, 307, sd + 2103), dep = HZ.depth[0] + (HZ.depth[1] - HZ.depth[0]) * hash3(k, 311, sd + 2105);
    const r = HZ.radius + dep * 0.5 * (hash3(k, 313, sd + 2107) - 0.3), at = [r * Math.cos(a), r * Math.sin(a)];
    ring.push({ at, size: [len, dep], dir: (a * 180) / Math.PI + 90 + 14 * (hash3(k, 317, sd + 2109) - 0.5), height: r3(HZ.height[0] + (HZ.height[1] - HZ.height[0]) * hash3(k, 331, sd + 2111)), square: 2.6 + 1.2 * hash3(k, 337, sd + 2113) });
    a += (2 * Math.PI) / HZ.count * (0.7 + 0.6 * hash3(k, 347, sd + 2117));
  }
  // each block: its frame, and the box it reaches (its outline's wander and its talus)
  const blocks = [...M.blocks, ...laid, ...ring].map((b, i) => {
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
  // the WASHES: from one side of the floor to the other through a point near the middle, wandering, each its own width
  // and depth
  const W = M.washes, washes = [];
  for (let k = 0; k < W.count; k++) {
    const a = 2 * Math.PI * hash3(k, 71, sd + 1501), R = (M.outcrops.within || 520) * 1.25, through = [cx + 160 * (hash3(k, 73, sd + 1503) - 0.5), cy + 160 * (hash3(k, 79, sd + 1507) - 0.5)];
    const path = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10 - 0.5, side = 70 * (hash3(k * 16 + i, 83, sd + 1509) - 0.5);
      path.push([through[0] + Math.cos(a) * 2 * R * t - Math.sin(a) * side, through[1] + Math.sin(a) * 2 * R * t + Math.cos(a) * side]);
    }
    washes.push({ path, width: W.width[0] + (W.width[1] - W.width[0]) * hash3(k, 89, sd + 1511), depth: W.depth[0] + (W.depth[1] - W.depth[0]) * hash3(k, 97, sd + 1513) });
  }
  // (how far into a wash's bed a point is: 1 on its floor, easing to 0 over its banks; and how deep it is cut there)
  const washAt = (x, y) => {
    let w = 0, D = 0;
    for (const q of washes) {
      const [wx, wy] = warp2(x, y, { strength: q.width * 1.2, scale: 90, seed: sd + 1601 }), [d] = toPath(q.path, wx, wy), hw = q.width / 2;
      if (d < hw * 1.5) { const t = 1 - smoothstep(hw * 0.6, hw * 1.25, d); if (t > w) { w = t; D = q.depth; } }
    }
    return [w, D];
  };
  // (what each cut can reach: its path's box, out past its half width, the warp's push, a flute and the talus a wall
  // sheds into it; past that its profile stands over any rock, so it is not read)
  const maxH = Math.max(0, ...blocks.map((b) => b.height)), cutPad = M.warp.strength * 1.6 + M.flute.depth + (0.8 * M.talus.share * maxH * 2) / tan + 10;
  for (const c of cuts) {
    const xs = c.path.map((q) => q[0]), ys = c.path.map((q) => q[1]), m = c.width * 0.65 + cutPad;
    c.box = [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m];
  }
  // the rock's height at a point, kept per point (a land reads the same corner for its grid, its classes, its walls'
  // push and its stones): a point no block can reach is 0 without the warp's noise
  const ROCK = new Map(), key = (x, y) => Math.round(x * 256) * 4194304 + Math.round(y * 256);
  const rockAt = (x, y) => {
    let near = false;
    for (const b of blocks) if (Math.abs(x - b.c[0]) <= b.reach && Math.abs(y - b.c[1]) <= b.reach) { near = true; break; }
    if (!near) return 0;
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
      if (x < c.box[0] || y < c.box[1] || x > c.box[2] || y > c.box[3]) continue;
      const [d, along] = toPath(c.path, wx, wy), w = c.width * (1 + 0.25 * wn(along, 0, 160, 601)) * (c.cleft ? 1 - 0.7 * smoothstep(0, c.length, along) : 1);
      z = Math.min(z, Math.max(0, profile(x, y, d + flute(x, y) * 0.6 - w / 2, z)));
    }
    return z;
  };
  const rock = (x, y) => {
    const k = key(x, y);
    let z = ROCK.get(k);
    if (z === undefined) { z = rockAt(x, y); if (ROCK.size > 3e6) ROCK.clear(); ROCK.set(k, z); }
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
  // THE CRATERS: the named, then the dice's (sizes by the impacts' power law), off the rock and the water; oldest first,
  // so a younger one prints over an older
  const CR = M.craters, CL = CR.clusters, craters = [];
  const clearOf = (x, y, R) => [[0, 0], [R, 0], [-R, 0], [0, R], [0, -R]].every(([dx, dy]) => rock(x + dx, y + dy) <= 0.3 && sink(x + dx, y + dy)[0] <= 0);
  CR.at.forEach((c, i) => craters.push({ c: [cx + c.at[0], cy + c.at[1]], D: c.diameter, fresh: c.fresh ?? 0.8, age: 1 - (c.fresh ?? 0.8), k: 900 + i }));
  const dLo = CR.diameter[0], dHi = CR.diameter[1], A = CR.slope;
  for (let k = 0, tries = 0; craters.length - CR.at.length < CR.count && tries < CR.count * 30; tries++, k++) {
    const u = hash3(k, 131, sd + 1801), D = dLo * (1 - u * (1 - (dLo / dHi) ** A)) ** (-1 / A);
    const a = 2 * Math.PI * hash3(k, 137, sd + 1803), r = CR.within * Math.sqrt(hash3(k, 139, sd + 1807)), x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (!clearOf(x, y, D / 2)) continue;
    const fresh = hash3(k, 149, sd + 1811) < CR.fresh ? 0.75 + 0.25 * hash3(k, 151, sd + 1813) : 0.5 * hash3(k, 157, sd + 1817);
    craters.push({ c: [x, y], D, fresh, age: hash3(k, 163, sd + 1819), k });
  }
  // the STREWN FIELDS: an ellipse turned to its flight, its craters of one age, the largest down-range
  for (let k = 0, made = 0, tries = 0; made < CL.count && tries < CL.count * 30; tries++, k++) {
    const a = 2 * Math.PI * hash3(k, 191, sd + 2001), r = CR.within * Math.sqrt(hash3(k, 193, sd + 2003)), x0 = cx + r * Math.cos(a), y0 = cy + r * Math.sin(a);
    const head = 2 * Math.PI * hash3(k, 197, sd + 2005), ux = Math.cos(head), uy = Math.sin(head);
    const L = CL.length[0] + (CL.length[1] - CL.length[0]) * hash3(k, 199, sd + 2007), Wd = CL.width[0] + (CL.width[1] - CL.width[0]) * hash3(k, 211, sd + 2009);
    if (!clearOf(x0, y0, L / 2)) continue;
    made++;
    const n = CL.members[0] + Math.floor(hash3(k, 223, sd + 2011) * (CL.members[1] - CL.members[0] + 1));
    const fresh = hash3(k, 227, sd + 2013) < CL.fresh ? 0.7 + 0.3 * hash3(k, 229, sd + 2015) : 0.15 + 0.4 * hash3(k, 233, sd + 2017), age = hash3(k, 239, sd + 2019);
    for (let m = 0; m < n; m++) {
      // (along its flight t from −½ up-range to +½ down-range; across it narrowing to its ends; its size growing down-range)
      const t = hash3(k * 97 + m, 241, sd + 2021) - 0.5, side = (hash3(k * 97 + m, 251, sd + 2023) - 0.5) * Wd * (1 - 0.6 * Math.abs(2 * t));
      const x = x0 + ux * t * L - uy * side, y = y0 + uy * t * L + ux * side;
      const grow = (t + 0.5) ** 1.6 * (0.55 + 0.45 * hash3(k * 97 + m, 257, sd + 2025)), D = CL.diameter[0] + (CL.diameter[1] - CL.diameter[0]) * grow;
      if (!clearOf(x, y, D / 2)) continue;
      craters.push({ c: [x, y], D, fresh, age: age + 0.001 * m, k: 3000 + k * 97 + m, field: made - 1 });
    }
  }
  craters.sort((p, q) => q.age - p.age);
  for (const q of craters) {
    // (a fresh one: a fifth of its diameter deep, its rim a twenty-fifth high; worn: shallower, its rim down, its floor sand)
    q.R = q.D / 2; q.depth = q.D * 0.2 * (0.35 + 0.65 * q.fresh); q.rim = q.D * 0.04 * (0.25 + 0.75 * q.fresh); q.infill = 0.55 * (1 - q.fresh);
  }
  const craterAt = (x, y, h) => {
    let z = h;
    for (const q of craters) {
      const dx = x - q.c[0], dy = y - q.c[1];
      if (Math.abs(dx) > q.R * 3.2 || Math.abs(dy) > q.R * 3.2) continue;
      // (its rim not a ruled circle: its radius wanders round it)
      const R = q.R * (1 + 0.07 * wn(x, y, Math.max(6, q.R * 0.6), 1901 + q.k)), t = Math.hypot(dx, dy) / R;
      if (t >= 3.2) continue;
      if (t < 1) {
        // (the bowl, a paraboloid from the rim down; its floor filled flat as it wears; the level it was struck into)
        const bowl = q.rim - (q.depth + q.rim) * (1 - t * t), floorZ = -q.depth * (1 - q.infill);
        z += Math.max(bowl, floorZ);
      } else z += q.rim * t ** -3 * (1 - smoothstep(2.2, 3.2, t));
    }
    return z;
  };
  // (how much a crater's broken ground lies here: its bowl and rim, as fresh as it is; an old one's sand-filled)
  const crushAt = (x, y) => {
    let w = 0;
    for (const q of craters) {
      if (q.fresh < 0.5) continue;
      const dx = x - q.c[0], dy = y - q.c[1];
      if (Math.abs(dx) > q.R * 1.6 || Math.abs(dy) > q.R * 1.6) continue;
      const t = Math.hypot(dx, dy) / (q.R * (1 + 0.12 * wn(x, y, Math.max(4, q.R * 0.4), 1951 + q.k)));
      w = Math.max(w, (1 - smoothstep(1.05, 1.5, t)) * smoothstep(0.5, 0.8, q.fresh));
    }
    return w;
  };
  const at = (x, y, h0) => {
    const h = craters.length ? craterAt(x, y, h0) : h0;
    const z = rock(x, y), [w, D] = sink(x, y), [ww, WD] = washes.length ? washAt(x, y) : [0, 0];
    const base = (w > 0 ? h + (floor - D - h) * w : h) - WD * ww;
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
  // THE SCATTER: clusters of boulders out on the open floor, off the rock, its aprons and the water
  const SCT = M.scatter, within = M.outcrops.within;
  for (let k = 0, made = 0, tries = 0; made < SCT.clusters && tries < SCT.clusters * 30; tries++, k++) {
    const a = 2 * Math.PI * hash3(k, 101, sd + 1701), r = within * Math.sqrt(hash3(k, 103, sd + 1703)), x0 = cx + r * Math.cos(a), y0 = cy + r * Math.sin(a);
    if (rock(x0, y0) > 0.3 || sink(x0, y0)[0] > 0) continue;
    made++;
    const n = SCT.per[0] + Math.floor(hash3(k, 107, sd + 1707) * (SCT.per[1] - SCT.per[0] + 1));
    for (let m = 0; m < n; m++) {
      const b = 2 * Math.PI * hash3(k * 40 + m, 109, sd + 1709), d = SCT.spread * Math.sqrt(hash3(k * 40 + m, 113, sd + 1711)), x = x0 + d * Math.cos(b), y = y0 + d * Math.sin(b);
      if (rock(x, y) > 0.3 || sink(x, y)[0] > 0) continue;
      boulders.push({ x: r3(x), y: r3(y), size: SCT.size[0] + Math.floor(hash3(k * 40 + m, 127, sd + 1713) ** 2.2 * (SCT.size[1] - SCT.size[0] + 1)) });
    }
  }
  // (a fresh crater's ejected blocks: strewn on its rim and its blanket, more the larger it is)
  for (const q of craters) {
    if (q.fresh < 0.7 || q.D < 12) continue;
    const n = Math.min(40, Math.max(2, Math.round(q.D / 6)));
    for (let m = 0; m < n; m++) {
      const b = 2 * Math.PI * hash3(q.k * 64 + m, 167, sd + 1901), d = q.R * (0.95 + 1.1 * hash3(q.k * 64 + m, 173, sd + 1903) ** 2), x = q.c[0] + d * Math.cos(b), y = q.c[1] + d * Math.sin(b);
      if (rock(x, y) > 0.3 || sink(x, y)[0] > 0) continue;
      boulders.push({ x: r3(x), y: r3(y), size: 1 + Math.floor(hash3(q.k * 64 + m, 179, sd + 1907) ** 2.5 * Math.min(5, 1 + q.D / 40)) });
    }
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
  // THE DETAIL'S REACH: inside the horizon's escarpments (and FAR_FADE short of them) a wall is pushed and cut at every thin
  // bed; past it, where the field is only ever seen across it, a wall stands as its bands do, cut coarser
  const HZr = M.horizon.count ? M.horizon.radius - M.horizon.depth[1] - 20 : Infinity, FAR_FADE = 40;
  const nearness = (x, y) => (HZr === Infinity ? 1 : 1 - smoothstep(HZr - FAR_FADE, HZr, Math.hypot(x - cx, y - cy)));
  const far = (x, y) => HZr !== Infinity && Math.hypot(x - cx, y - cy) > HZr - FAR_FADE;
  const warp = (x, y, z) => {
    if (still) return [0, 0];
    const nr = nearness(x, y);
    if (nr <= 0) return [0, 0];
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
    const d = (bulge - under + grain) * w * nr, ox = -gx / g, oy = -gy / g;
    return [r3(ox * d), r3(oy * d)];
  };
  // (on the rock itself: inside a block's outline, not down a cut's floor or its aprons)
  const inside = (x, y) => {
    const [wx, wy] = M.warp.strength ? warp2(x, y, warpW) : [x, y];
    let e = -Infinity;
    for (const b of blocks) if (Math.abs(x - b.c[0]) <= b.reach && Math.abs(y - b.c[1]) <= b.reach) e = Math.max(e, into(b, x, y, wx, wy));
    if (e <= 1) return false;
    for (const c of cuts) { const [d, along] = toPath(c.path, wx, wy), w = c.width * (1 + 0.25 * wn(along, 0, 160, 601)) * (c.cleft ? 1 - 0.7 * smoothstep(0, c.length, along) : 1); if (d + flute(x, y) * 0.6 - w / 2 < 1) return false; }
    return true;
  };
  return { at, rock, craters: craters.map((q) => ({ at: [r3(q.c[0] - cx), r3(q.c[1] - cy)], diameter: r3(q.D), fresh: r3(q.fresh), depth: r3(q.depth), rim: r3(q.rim), ...(q.field !== undefined ? { field: q.field } : {}) })), water: (x, y) => sink(x, y)[0] > 0, wash: (x, y) => (washes.length ? washAt(x, y)[0] : 0), crush: (x, y) => (craters.length ? crushAt(x, y) : 0), boulders, partings, warp, far, inside, outcrops: laid };
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
