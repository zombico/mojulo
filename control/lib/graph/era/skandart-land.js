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
 *
 * And the open land beside a trail (era/out-trail.js), its rockfall (`trailSkandart`): what its cliff lets go comes to
 * rest by its size, the biggest rolling farthest, past its apron's toe toward the walk; and every big stone beside the
 * walk sheds its spalls round its own foot:
 *
 *   talus  a cone of fallen rock where the cliff's apron meets the land, off the walk, in the cliff's rhythm
 *   runner the fall's biggest blocks, rolled farthest: each alone at the walk's edge on the cliff's side, sunk where it
 *          stopped, a few to each cone (more the more has fallen)
 *   ring   spalls round a boulder's foot: a cone centred in it, its body and its pieces under the stone not made, so
 *          what shows is the ring round it
 *
 *   TRAIL_SKANDART                         the open land's answer
 *   trailSkandart(site, { amount, read, seed, rocks, apronMin }) → { heaps: [{ tpl, at, turn, faces }], templates, laws,
 *          claims }: claims [[x, y, r]] the ground each heap and block covers, for the grass to keep off
 *     rocks     [{ x, y, r, h }] the boulders standing on the land (a ring round each big enough, within `near` of the walk)
 *     apronMin  how much of the cliff's apron counts as its talus (the style's landform.apronMin)
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { wallRhythm } from './wall-rhythm.js';
import { buildHeap, skandartLaws, skandartRead, SKANDART } from './skandart.js';
import { REPOSE, debrisPiece } from './debris-shelf.js';
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

/** The open land's answer: its cliff's rockfall and its boulders' spalls. */
export const TRAIL_SKANDART = Object.freeze({
  talus: Object.freeze({ why: 'its cliff lets its rock go: the biggest rolls farthest, past the apron\'s toe toward the walk',
    pieces: Object.freeze({ 'talus-block': 5, spall: 16 }), every: 7, past: 0.6 }),
  // the runners: how many a cone sends at the most, their sizes (m), how far off the walk's edge each stops (m) and along it
  runner: Object.freeze({ most: 3, size: Object.freeze([0.42, 0.7]), off: Object.freeze([0.15, 0.6]), along: 2.4 }),
  ring: Object.freeze({ why: 'a big stone beside the walk sheds its spalls round its own foot',
    pieces: Object.freeze({ spall: 14, 'talus-block': 1 }), out: Object.freeze([0.25, 0.75]), least: 0.7, near: 9, bucket: 0.25 }),
  heights: Object.freeze({ cone: Object.freeze([0.3, 0.85]) }),
  reach: 2.4,
});

export function trailSkandart(site, { amount, read = skandartRead(), seed = 1, rocks = [], apronMin = 0.5 }) {
  const A = TRAIL_SKANDART, pools = {}, templates = {}, slope = Math.tan((REPOSE.grit * Math.PI) / 180), heaps = [];
  const offWalk = (x, y, r) => site.trailDist(x, y) > site.halfWAt(y) + r + 0.4;
  const clear = (x, y, r) => rocks.every((q) => Math.hypot(q.x - x, q.y - y) > q.r + r * 0.6);
  // TALUS: where the cliff's apron meets the land, a cone every `every` m, its middle `past` of its toe beyond the apron
  for (let fam = 0; fam < 2; fam++) templates[`talus-${fam}`] = { role: 'cone', ...buildHeap(LAND, 'cone', A.talus.pieces, amount, read.least, 2501 + fam * 43, 0, pools, { heights: A.heights, reach: A.reach }) };
  if (site.cliffX && site.apronAt) {
    const laid = [];
    for (let y = A.talus.every / 2, k = 0; y < site.D - A.talus.every / 2; y += A.talus.every, k++) {
      const y1 = y + (hash3(seed, k, 7901) - 0.5) * A.talus.every * 0.5, x0 = site.cliffX(y1), x1 = site.trailX(y1);
      // (the apron's toe: from the cliff toward the walk, past where the apron begins, the first point where it gives out)
      let toe = null, on = false;
      for (let x = x0; Math.abs(x - x0) < Math.abs(x1 - x0); x += Math.sign(x1 - x0) * 0.25) { const w = site.apronAt(x, y1); if (w >= apronMin) on = true; else if (on) { toe = x; break; } }
      if (toe === null) continue;
      const T = templates[`talus-${k % 2}`], r = T.body.toe, x = toe + Math.sign(x1 - x0) * r * A.talus.past;
      if (!offWalk(x, y1, r) || !clear(x, y1, r) || laid.some((q) => Math.hypot(q.x - x, q.y - y1) < q.r + r + 0.5)) continue;
      laid.push({ x, y: y1, r });
      heaps.push({ tpl: `talus-${k % 2}`, x, y: y1, a: hash3(seed, k, 7903) * 2 * Math.PI });
      // (its RUNNERS: the biggest it let go, rolled on to the walk's edge on the cliff's side)
      const dir = Math.sign(x1 - x0), n = Math.round(A.runner.most * amount * (0.6 + 0.4 * hash3(seed, k, 7907)));
      for (let j = 0; j < n; j++) {
        const h = (q) => hash3(seed, k * 7 + j, 7911 + q), yr = y1 + (h(1) - 0.5) * 2 * A.runner.along, w = A.runner.size[0] + (A.runner.size[1] - A.runner.size[0]) * h(2);
        const xr = site.trailX(yr) - dir * (site.halfWAt(yr) + w / 2 + A.runner.off[0] + (A.runner.off[1] - A.runner.off[0]) * h(3));
        if (!offWalk(xr, yr, w / 2 - 0.4 + 0.05) || !clear(xr, yr, w) || laid.some((q) => Math.hypot(q.x - xr, q.y - yr) < q.r + w)) continue;
        const id = `runner-${Math.round(w * 20) / 20}`;
        if (!templates[id]) { const P = debrisPiece('talus-block', w, 2701 + Math.round(w * 100), pools), z = -P.h * SKANDART.bury; templates[id] = { role: 'runner', faces: P.faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + z]), of: 0 })), pieces: [{ id: 'talus-block', x: 0, y: 0, z, w, h: P.h }] }; }
        laid.push({ x: xr, y: yr, r: w });
        heaps.push({ tpl: id, x: xr, y: yr, a: h(4) * 2 * Math.PI, runner: true, w });
      }
    }
  }
  // RINGS: round each big stone near the walk, a cone centred in it reaching `out` past its foot; what lies under the
  // stone is not made. One template a size of stone (to `bucket` m), so stones of a size share it
  const ringOut = A.ring.out[0] + (A.ring.out[1] - A.ring.out[0]) * amount;
  for (const q of rocks) {
    if (q.h < A.ring.least || site.trailDist(q.x, q.y) > A.ring.near) continue;
    const R = Math.max(A.ring.bucket, Math.round(q.r / A.ring.bucket) * A.ring.bucket), id = `ring-${R}`;
    if (!templates[id]) {
      const toe = R + ringOut, H = (toe * slope) / 1.25, T = buildHeap(LAND, 'cone', A.ring.pieces, 1, read.least, 2601 + Math.round(R * 100), 0, pools, { heights: { cone: [H, H] }, reach: toe * 1.06 });
      // (under the stone: the body's cells wholly inside it, and every piece whose middle is in it)
      const inside = (c) => Math.hypot(c[0], c[1]) < R * 0.8, hidden = new Set(T.pieces.map((p, i) => (Math.hypot(p.x, p.y) < R * 0.92 ? i : -1)).filter((i) => i >= 0));
      templates[id] = { role: 'cone', ...T, faces: T.faces.filter((f) => (f.of >= 0 ? !hidden.has(f.of) : !f.corners.every(inside))), pieces: T.pieces.filter((_, i) => !hidden.has(i)) };
    }
    if (!offWalk(q.x, q.y, templates[id].body.toe * 0.9)) continue;
    heaps.push({ tpl: id, x: q.x, y: q.y, a: hash3(seed, Math.round(q.x * 10), Math.round(q.y * 10) + 7905) * 2 * Math.PI, ring: true });
  }
  // the laws: each heap's own (its pieces on its face, its body at repose, read), and each laid off the walk
  const laws = skandartLaws({ kit: LAND }, Object.fromEntries(Object.entries(templates).filter(([, T]) => T.body)), [], read, Math.max(A.reach, ...Object.values(templates).filter((T) => T.body).map((T) => T.body.toe)));
  const reachOf = (h) => (h.runner ? h.w / 2 : templates[h.tpl].body.toe * (h.ring ? 0.9 : 1));
  for (const h of heaps) laws.push({ law: 'off-the-walk', what: `${h.tpl} at ${r5(h.x)}, ${r5(h.y)}: clear of the walk`, ok: offWalk(h.x, h.y, h.runner ? reachOf(h) - 0.35 : reachOf(h)) });
  for (const h of heaps.filter((q) => q.runner)) laws.push({ law: 'too-small-to-read', what: `${h.tpl}: ${r5(h.w)} m (the eye spot ${r5(read.least)} m)`, ok: h.w >= read.least });
  const kept = laws.filter((r) => r.law !== 'placed');
  kept.push({ law: 'placed', what: `${heaps.length} laid (${heaps.filter((h) => !h.ring && !h.runner).length} cones of talus, ${heaps.filter((h) => h.runner).length} runners, ${heaps.filter((h) => h.ring).length} rings)`, ok: heaps.length > 0 });
  // (the ground each covers, the grass kept off it: a heap's toe, a runner's breadth)
  const claims = heaps.map((h) => [r5(h.x), r5(h.y), r5(h.runner ? h.w * 0.75 : templates[h.tpl].body.toe)]);
  return { heaps: heaps.map(({ tpl, x, y, a }) => ({ tpl, at: [r5(x), r5(y)], turn: r5(a), faces: templates[tpl].faces.length ? drape(templates[tpl], site, x, y, a) : [] })), templates, laws: kept, claims };
}
