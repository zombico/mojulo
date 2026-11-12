/**
 * SKANDART ON THE LAND — a land's debris, as a room's is (era/skandart.js): the heaps its causes leave, each a body at its
 * fines' repose and the pieces on it off the debris shelf, laid where the cause puts it. A room's floor is flat, so its
 * heaps are built once and stamped; a land's floor rises and falls, so each heap is laid on the land where it lies, its
 * body draped over the ground under it and each piece set on the ground under its own middle, and goes to the page as its
 * own faces. The cavern is the first land that answers (era/cavern.js):
 *
 *   foot   its walls shed their rock: talus heaped against each wall's foot (era/cavern.js wallFeet), a heap a stretch of
 *          wall, the stretches in the walls' rhythm (the full heap and the lesser)
 *   cone   its ceiling lets its slabs go: breakdown standing free on the floor under it, off the walk and its rocks
 *
 *   CAVE_SKANDART                          the cavern's answer: each cause's pieces, its heaps' heights and reach
 *   caveSkandart(site, { amount, read, seed, rocks }) → { heaps: [{ tpl, at, turn, faces }], templates, laws }: each heap's
 *          faces laid on the land, each `{ corners, normal, matter }` (stone or grit), for the land to dress as its own
 *     amount  0…1 (a recipe's `skandart`, or its `condition`'s, era/condition.js); read the frame it is read in
 *     rocks   [{ x, y, r }] what already stands on the floor (its boulders, wall rocks, formations): no heap on one
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { wallRhythm } from './wall-rhythm.js';
import { buildHeap, skandartLaws, skandartRead } from './skandart.js';
import { wallFeet, CAVERN } from './cavern.js';

/** The cavern's answer: what its walls shed and its ceiling lets go, as many pieces as a heap holds at the most. */
export const CAVE_SKANDART = Object.freeze({
  foot: Object.freeze({ why: 'its walls shed their rock: talus heaped against each wall\'s foot, a heap a stretch of wall in the walls\' rhythm',
    pieces: Object.freeze({ 'breakdown-slab': 2, spall: 18 }), len: 3.2, every: 4.4 }),
  cone: Object.freeze({ why: 'its ceiling lets its slabs go: breakdown standing free on the floor under it, off the walk and off its rocks',
    pieces: Object.freeze({ 'breakdown-slab': 5, spall: 12 }), most: 6 }),
  // (bigger than a room's: a cave's walls and ceiling are its own rock, and what they let go is theirs)
  heights: Object.freeze({ foot: Object.freeze([0.3, 1]), cone: Object.freeze([0.35, 1.15]) }),
  reach: 2.6,
});

// a cave's floor has no plinth and no gutter: its heaps' frames start at the foot itself
const LAND = Object.freeze({ plinth: Object.freeze({ out: 0 }) });

/** A template's faces laid on the land at (x0, y0) turned `a`: the body's corners over the ground under each, a piece's
 *  over the ground under its own middle (so a block stays a block on a slope). */
function drape(T, site, x0, y0, a) {
  const c = Math.cos(a), s = Math.sin(a), W = (x, y) => [x0 + x * c - y * s, y0 + x * s + y * c];
  const under = T.pieces.map((q) => { const [X, Y] = W(q.x, q.y); return site.ground(X, Y); });
  return T.faces.map((f) => ({
    corners: f.corners.map(([x, y, z]) => { const [X, Y] = W(x, y); return [r5(X), r5(Y), r5((f.of >= 0 ? under[f.of] : site.ground(X, Y)) + z)]; }),
    normal: [r5(f.normal[0] * c - f.normal[1] * s) + 0, r5(f.normal[0] * s + f.normal[1] * c) + 0, f.normal[2]],
    matter: f.matter,
  }));
}

export function caveSkandart(site, { amount, read = skandartRead(), seed = 1, rocks = [] }) {
  const A = CAVE_SKANDART, spec = { heights: A.heights, reach: A.reach }, pools = {}, templates = {};
  for (let fam = 0; fam < 2; fam++) {
    templates[`foot-${fam}a`] = { role: 'foot', ...buildHeap(LAND, 'foot', A.foot.pieces, amount, read.least, 2111 + fam * 37, A.foot.len, pools, spec) };
    templates[`foot-${fam}b`] = { role: 'foot', ...buildHeap(LAND, 'foot', A.foot.pieces, amount * 0.55, read.least, 2111 + fam * 37, A.foot.len, pools, spec) };
    templates[`cone-${fam}`] = { role: 'cone', ...buildHeap(LAND, 'cone', A.cone.pieces, amount, read.least, 2301 + fam * 41, 0, pools, spec) };
  }
  const offWalk = (x, y, r) => site.trailDist(x, y) > site.halfWAt(y) + r + 0.4;
  const clear = (x, y, r) => rocks.every((q) => Math.hypot(q.x - x, q.y - y) > q.r + r * 0.6);
  const heaps = [];
  // TALUS: along each wall, a stretch every `every` metres, its heap against the foot, turned to face the floor
  [0, 1].forEach((side) => {
    const laid = [];
    for (let y = CAVERN.endRun + A.foot.every / 2; y < site.D - CAVERN.endRun - A.foot.every / 2; y += A.foot.every) {
      const x = wallFeet(site, y)[side], toe = templates['foot-0a'].body.toe;
      if (!offWalk(x + (side ? -toe : toe), y, 0)) continue;
      laid.push({ x, y });
    }
    const order = wallRhythm(laid.length, { pick: hash3(seed, side, 7801) }) || '';
    laid.forEach((p, i) => heaps.push({ tpl: `foot-${Math.floor(hash3(seed, side, 7803) * 2)}${order[i] === 'B' ? 'b' : 'a'}`, x: p.x, y: p.y, a: side ? Math.PI / 2 : -Math.PI / 2, wall: side }));
  });
  // BREAKDOWN: on the floor between the walk and the walls, free of the walk, the rocks and one another
  const want = Math.round(A.cone.most * amount), spots = [];
  for (let k = 0; k < want * 12 && spots.length < want; k++) {
    const y = CAVERN.endRun + hash3(seed, k, 7811) * (site.D - 2 * CAVERN.endRun), [l, r] = wallFeet(site, y), side = hash3(seed, k, 7813) < 0.5;
    const t = templates[`cone-${k % 2}`], toe = t.body.toe, edge = side ? [site.trailX(y) + site.halfWAt(y) + toe + 0.6, r - toe - 0.4] : [l + toe + 0.4, site.trailX(y) - site.halfWAt(y) - toe - 0.6];
    if (edge[1] <= edge[0]) continue;
    const x = edge[0] + hash3(seed, k, 7815) * (edge[1] - edge[0]);
    if (!offWalk(x, y, toe) || !clear(x, y, toe) || spots.some((q) => Math.hypot(q.x - x, q.y - y) < q.toe + toe + 0.6)) continue;
    spots.push({ x, y, toe });
    heaps.push({ tpl: `cone-${k % 2}`, x, y, a: hash3(seed, k, 7817) * 2 * Math.PI });
  }
  // the laws: each heap's own (its pieces on its face, its body at repose, read, …) and the walls' rhythm
  const laws = skandartLaws({ kit: LAND }, templates, heaps.filter((h) => h.wall !== undefined).map((h) => ({ tpl: h.tpl, wall: h.wall })), read, A.reach);
  for (const h of heaps) { const T = templates[h.tpl]; laws.push({ law: 'off-the-walk', what: `${h.tpl} at ${r5(h.x)}, ${r5(h.y)}: its toe clear of the walk`, ok: offWalk(h.x + (h.wall === undefined ? 0 : h.wall ? -T.body.toe : T.body.toe), h.y, h.wall === undefined ? T.body.toe : 0) }); }
  return { heaps: heaps.map(({ tpl, x, y, a }) => ({ tpl, at: [r5(x), r5(y)], turn: r5(a), faces: templates[tpl].faces.length ? drape(templates[tpl], site, x, y, a) : [] })), templates, laws };
}
