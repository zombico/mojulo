/**
 * A STREET CIRCUIT'S TOWN — the city a race through streets runs between, laid from the geocity's ideas (geocity/:
 * blocks fronting their streets, heights that rise toward the middle, the street's kit near the eye) in a track's
 * design language (track-language.js `parts.city`), so the town is of the track's family:
 *
 *   fronts     a row of buildings down each side of every straight, facing the way, back past the rail and a
 *              sidewalk; their kinds by how near the town's middle they stand (a shop, flats, a tower: tall in the
 *              middle, low at the edge, as a geocity's rings are), never three alike in a row (era/wall-rhythm.js's
 *              rule), each in a colour of the family by turns, never the one beside it (its windows and its trim in
 *              cream where they would wear its own colour); a row stops short of a corner
 *              and a building that would stand in another is left out
 *   sidewalk   the paving between the rail and the fronts
 *   kit        lamps down the sidewalks, the two sides by turns; a signal at the outside of every corner
 *   crossings  a zebra across the way at the start of each straight: a town's mark on its street
 *
 *   planFrontage(plan, card, { seed }) → { lots: [{ block, params, at: [x, y], yaw, facade, kind, row }], kit, keepOut }
 *     placed in two dimensions first, so the land round the track (surrounds.js) is kept clear of them
 *   buildFrontage(planned, plan, card, K) → { faces, colliders, things, report }
 *     stood on the ground the land was shaped to, painted in the card's family (set-pieces.js paintPiece)
 *
 * Pure, seeded (mulberry32).
 */
import { buildBlock } from '../era/blocks.js';
import { mulberry32 } from '../vegetation/grow.js';
import { TRACK_BLOCKS, paintPiece } from './set-pieces.js';
import { trackRuns } from './track.js';
import { chunkyFaces, chunkyLightOf } from './chunky-look.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
/** The kinds a front can be and the heights each reads at, metres. */
export const FRONT_KINDS = Object.freeze(['shop', 'flat', 'tower']);

// a point `off` metres left of the line at s, `dz` up (the track's frame without its bank: the town stands past it)
function pointer(a) {
  const L = a.length, at = (s) => a.at(a.closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s)));
  return { at, P: (s, off, dz = 0) => { const q = at(s); return [q.x - Math.sin(q.heading) * off, q.y + Math.cos(q.heading) * off, q.z + dz]; } };
}
// a rectangle w wide along `dir` and d deep away from the way, its front's middle at `at`: its corners
const rect = (at, dir, side, w, d) => { const t = [Math.cos(dir), Math.sin(dir)], n = [-t[1] * side, t[0] * side]; return [[-w / 2, 0], [w / 2, 0], [w / 2, d], [-w / 2, d]].map(([u, v]) => [at[0] + t[0] * u + n[0] * v, at[1] + t[1] * u + n[1] * v]); };
// two convex polygons overlap (separating axes)
function overlap(A, B) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], ax = [q[1] - p[1], p[0] - q[0]];
    const pr = (Q) => Q.map((v) => v[0] * ax[0] + v[1] * ax[1]), a = pr(A), b = pr(B);
    if (Math.max(...a) <= Math.min(...b) + 0.3 || Math.max(...b) <= Math.min(...a) + 0.3) return false;
  }
  return true;
}

export function planFrontage(plan, card, { seed = 1 } = {}) {
  const C = card?.parts?.city;
  if (!C) return null;
  const a = plan.alignment, X = plan.X, { P } = pointer(a), runs = trackRuns(plan), rnd = mulberry32(((seed * 2246822519) ^ 0x5eed) >>> 0);
  // the town's middle: the middle of the lap; how far its edge is
  const xs = plan.stations.map((p) => p.x), ys = plan.stations.map((p) => p.y), core = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const reach = Math.max(...plan.stations.map((p) => Math.hypot(p.x - core[0], p.y - core[1]))) + 30;
  const set = X.outer + C.sidewalk, lots = [], kit = { lamps: [], signals: [], crossings: [] }, taken = [];
  const kindAt = (p) => {
    const t = Math.min(1, Math.hypot(p[0] - core[0], p[1] - core[1]) / reach), h = C.heights.edge + (C.heights.core - C.heights.edge) * (1 - t) ** 1.4;
    const hh = h * (0.7 + 0.6 * rnd());
    return { kind: hh >= C.heights.tower ? 'tower' : hh >= C.heights.flat ? 'flat' : 'shop', h: hh };
  };
  let facadeIx = Math.floor(rnd() * C.facades.length);
  runs.straights.forEach((r, ri) => {
    if (r.s1 - r.s0 < C.margin * 2 + 6) return;
    for (const side of [1, -1]) {
      let s = r.s0 + C.margin, last = [];
      while (s < r.s1 - C.margin - 5) {
        let { kind, h } = kindAt(P(s, side * set));
        // never three alike in a row: the third stands in another kind
        if (last.length >= 2 && last[last.length - 1] === kind && last[last.length - 2] === kind) kind = kind === 'shop' ? 'flat' : 'shop';
        const B = TRACK_BLOCKS[C.blocks[kind]], wr = B.params.w, hr = B.params.h;
        let w = wr[0] + (wr[1] - wr[0]) * rnd();
        if (s + w > r.s1 - C.margin) w = r.s1 - C.margin - s;
        if (w < wr[0]) break;
        const hp = Math.max(hr[0], Math.min(hr[1], kind === 'shop' ? hr[0] + (hr[1] - hr[0]) * rnd() : h));
        const depth = kind === 'tower' ? w : kind === 'flat' ? 10 : 8, mid = s + w / 2, at = P(mid, side * (set + 0.3)), q = P(mid, 0);
        const dir = Math.atan2(P(mid + 1, 0)[1] - q[1], P(mid + 1, 0)[0] - q[0]), foot = rect(at, dir, side, w, depth);
        if (!taken.some((f) => overlap(f, foot))) {
          taken.push(foot);
          facadeIx = (facadeIx + 1 + Math.floor(rnd() * (C.facades.length - 1))) % C.facades.length;
          lots.push({ block: C.blocks[kind], kind, params: { w: r3(w), h: r3(hp) }, at: [r3(at[0]), r3(at[1])], yaw: r3(Math.atan2(q[1] - at[1], q[0] - at[0]) + Math.PI / 2), facade: C.facades[facadeIx], row: ri * 2 + (side > 0 ? 0 : 1), foot });
          last.push(kind);
        }
        s += w + (rnd() < 0.2 ? 2.5 : 0.4);
      }
      // the lamps down this side, the sides by turns (a lamp a gap in the other side's)
      for (let t = r.s0 + C.margin + (side > 0 ? 0 : C.lamps / 2); t < r.s1 - C.margin; t += C.lamps) kit.lamps.push({ at: P(t, side * (X.outer + 1.3)), toward: P(t, 0) });
    }
    kit.crossings.push({ s: r.s0 + 4, ri });
  });
  // a signal at the outside of every corner, where the straight before it ends
  for (const c of runs.corners) kit.signals.push({ at: P(c.s - 2, -c.d * (X.outer + 1.4)), toward: P(c.s - 2, 0) });
  const keepOut = lots.map((l) => ({ at: l.at, r: Math.hypot(l.params.w, l.kind === 'tower' ? l.params.w : 10) / 2 + 2 }));
  return { lots, kit, keepOut, core: core.map(r3), reach: r3(reach) };
}

export function buildFrontage(planned, plan, card, K) {
  if (!planned) return null;
  const C = card.parts.city, a = plan.alignment, X = plan.X, { P } = pointer(a), ground = plan.groundAt, faces = [], colliders = [], things = [];
  const paint = card.parts.pieces?.paint ?? {};
  const stand = (id, params, at, yaw, facade, seed) => {
    const z = ground(at[0], at[1]) - 0.15;
    const b = buildBlock(TRACK_BLOCKS[id], { params, library: TRACK_BLOCKS, at: [at[0], at[1], r3(z)], yaw: (yaw * 180) / Math.PI, seed });
    // (a front in the windows' colour, or the trim's, has them in cream: a detail always parts from its body)
    const parts = (g) => (paint[g] === facade ? { [g]: card.materials.cream ? 'cream' : paint['tech:frame'] } : {});
    const lang = facade ? { ...card, parts: { ...card.parts, pieces: { ...card.parts.pieces, paint: { ...paint, 'str:plaster': facade, ...parts('tech:glass'), ...parts('tech:trim') } } } } : card;
    faces.push(...paintPiece(b.faces, K, { language: lang }));
    return b;
  };
  planned.lots.forEach((l, i) => {
    const b = stand(l.block, l.params, l.at, l.yaw, l.facade, i + 1);
    colliders.push({ min: b.box.lo.map(r3), max: b.box.hi.map(r3), of: `street:${l.kind}` });
    const sz = b.box.hi.map((v, k) => v - b.box.lo[k]);
    things.push({ kind: 'front', interest: l.kind === 'tower' ? 'focus' : 'prop', at: b.box.hi.map((v, k) => r3((v + b.box.lo[k]) / 2)), span: r3(Math.min(Math.max(sz[0], sz[1]), sz[2])), top: r3(b.box.hi[2]) });
  });
  const yawTo = (at, to) => Math.atan2(to[1] - at[1], to[0] - at[0]) + Math.PI / 2;
  planned.kit.lamps.forEach((m, i) => stand(C.kit.lamp, { h: 4.6 }, m.at, yawTo(m.at, m.toward), null, 100 + i));
  planned.kit.signals.forEach((m, i) => stand(C.kit.signal, { h: 3.4 }, m.at, yawTo(m.at, m.toward), null, 200 + i));
  // the sidewalks (the paving between the rail and the fronts) and the zebras across the way, in the card's own
  const raw = [], pave = card.materials[C.paving], zebra = card.materials[C.crossing];
  const runs = trackRuns(plan);
  for (const r of runs.straights) for (const side of [1, -1]) for (let s = r.s0; s < r.s1 - 0.01; s += 4) {
    const t = Math.min(r.s1, s + 4), q = [P(s, side * X.outer, 0.02), P(t, side * X.outer, 0.02), P(t, side * (X.outer + C.sidewalk), 0.02), P(s, side * (X.outer + C.sidewalk), 0.02)];
    raw.push({ corners: side > 0 ? q : q.slice().reverse(), hex: pave.hex, normal: [0, 0, 1], gloss: 0, part: 'sidewalk' });
  }
  for (const z of planned.kit.crossings) for (let k = 0; k < C.zebra; k++) {
    const w = (2 * X.road) / (2 * C.zebra - 1), o0 = -X.road + 2 * k * w, o1 = o0 + w, q = [P(z.s, o0, 0.025), P(z.s, o1, 0.025), P(z.s + 3, o1, 0.025), P(z.s + 3, o0, 0.025)];
    raw.push({ corners: q.slice().reverse(), hex: zebra.hex, normal: [0, 0, 1], gloss: 0, part: 'crossing' });
  }
  faces.push(...chunkyFaces(raw, { light: chunkyLightOf(K) }));
  const kinds = planned.lots.reduce((n, l) => ({ ...n, [l.kind]: (n[l.kind] ?? 0) + 1 }), {});
  return { faces, colliders, things, report: { fronts: planned.lots.length, kinds, lamps: planned.kit.lamps.length, signals: planned.kit.signals.length, crossings: planned.kit.crossings.length, core: planned.core } };
}
