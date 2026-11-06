/**
 * THE MAP — a level laid as a GRAPH on one ground, walked as one page (the `map` layout). Its sections are PLACED: each
 * has a position and a heading on the level's frame, so a trail may leave a junction in any direction and the ones that
 * follow it carry its line on. A straight chain is a map whose placements all point one way.
 *
 *   junction  a hub (graph.js readJunction): a flat disc `radius` metres across, its gates on its edge at compass
 *             bearings (0 the frame's +y, clockwise), turned by its own heading. The root's heading is the frame's.
 *   trail     placed from what it follows: off a junction's gate, its frame's +y the gate's bearing outward and its
 *             path's first point on the gate; after a trail, on that trail's frame carried `D` metres on (the seam: the
 *             trail recipe's own `after`, so its line, heading and height start on the followed one's, as sequential
 *             lays them). A trail may arrive at a junction: the junction is set past the trail's far end, its gate turned
 *             back to meet it.
 *
 * A section's BAND is the ground it owns: a trail's its site (from the land behind its cliff to its open edge, the whole
 * of its depth), a junction's its disc. Two bands that do not join may not overlap: the layout refuses them (gates too
 * close together for the junction's radius, or an arm folded back over another), naming both.
 *
 *   mapLevel(G) → { layout: 'map', root, spawn, order, edges, places: { <id>: { at: [x, y], heading } },
 *                   bands: { <id>: [[x, y], …] }, gates: { <trail>: [x, y] } (its path's first point), ends: { <trail>:
 *                   { D, x0, x1, band: [bx0, bx1] } } (its depth, its path's ends across it, its band's own x), junctions, stages: [{ node, section,
 *                   manifest, place }] }
 *   placeOf(place, [x, y]) → the point of a section's own frame on the level's (its heading turns +y)
 *
 * A meru (a climb) is not laid on a map yet. Pure.
 */
import { outTrailSpan } from '../era/out-trail.js';
import { outTrailStyle } from '../era/out-trail-board.js';
import { readJunction } from './graph.js';
import { paintOf } from './sequential.js';

const r3 = (v) => Math.round(v * 1000) / 1000, r6 = (v) => Math.round(v * 1e6) / 1e6;
const DEG = Math.PI / 180;
// a bearing (degrees, 0 is +y, clockwise) as a direction on the frame, turned by a heading (radians, the section's +y)
const bearingDir = (deg, heading) => { const a = heading - deg * DEG; return [Math.cos(a), Math.sin(a)]; };

/** The point (x, y) of a section's own frame on the level's: its +y along its heading, its +x to the right of it. */
export function placeOf(place, p) {
  const f = [Math.cos(place.heading), Math.sin(place.heading)], rt = [f[1], -f[0]];
  return [place.at[0] + rt[0] * p[0] + f[0] * p[1], place.at[1] + rt[1] * p[0] + f[1] * p[1]];
}

// the band a trail owns in its own frame: from the land behind its cliff to its open edge, its whole depth
function trailBand(st, D) {
  const back = (st.landform && st.landform.back) || 0, x0 = (st.cliff ? st.cliff.x : 0) - back, x1 = st.site.w;
  return [[x0, 0], [x1, 0], [x1, D], [x0, D]];
}
const disc = (c, r, n = 16) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((i / n) * 2 * Math.PI), c[1] + r * Math.sin((i / n) * 2 * Math.PI)]);

// two convex polygons overlap (separating axes), each shrunk a little so bands that only touch do not count
function overlaps(A, B) {
  const shrink = (P) => { const c = P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]); return P.map((p) => [c[0] + (p[0] - c[0]) * 0.97, c[1] + (p[1] - c[1]) * 0.97]); };
  const a = shrink(A), b = shrink(B);
  for (const P of [a, b]) for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], n = [q[1] - p[1], p[0] - q[0]];
    const proj = (Q) => Q.reduce((m, v) => [Math.min(m[0], v[0] * n[0] + v[1] * n[1]), Math.max(m[1], v[0] * n[0] + v[1] * n[1])], [Infinity, -Infinity]);
    const [a0, a1] = proj(a), [b0, b1] = proj(b);
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

export function mapLevel(G) {
  if (G.layout !== 'map') throw new Error(`level: '${G.layout}' is not the map layout`);
  // the TREE: every node reached once, from the root, along the edges as written (a loop is not laid yet)
  const out = {}, inn = {};
  for (const e of G.edges) {
    if (inn[e.to]) throw new Error(`level: map: '${e.to}' is reached from both '${inn[e.to].from}' and '${e.from}'; a map is a tree from its root (a loop is not laid yet)`);
    inn[e.to] = e; (out[e.from] ??= []).push(e);
  }
  if (inn[G.root]) throw new Error(`level: map: the root '${G.root}' is reached from '${inn[G.root].from}'; the map grows from its root`);
  const order = [], queue = [G.root];
  while (queue.length) { const id = queue.shift(); order.push(id); for (const e of out[id] ?? []) queue.push(e.to); }
  const off = G.ids.filter((id) => !order.includes(id));
  if (off.length) throw new Error(`level: map: ${off.map((id) => `'${id}'`).join(', ')} ${off.length > 1 ? 'are' : 'is'} not reached from the root '${G.root}'`);

  // PLACES: each section from its parent, in the order reached
  const places = {}, spans = {}, bands = {}, rects = {}, stages = [], junctions = {};
  for (const id of order) {
    const n = G.nodes[id], e = inn[id], parent = e ? G.nodes[e.from] : null;
    if (n.section === 'meru') throw new Error(`level: map: '${id}' is a climb (meru); a climb is not laid on a map yet`);
    if (n.section === 'junction') {
      const J = readJunction(n.recipe, `nodes.${id}`);
      let place;
      if (!e) place = { at: [0, 0], heading: Math.PI / 2 };
      else {
        // (arriving from a trail: the junction past its far end, its gate turned back toward it)
        if (parent.section !== 'trail') throw new Error(`level: map: the junction '${id}' follows the ${parent.section} '${e.from}'; a junction is reached along a trail`);
        const P = places[e.from], S = spans[e.from], end = placeOf(P, [S.x, S.D]), f = [Math.cos(P.heading), Math.sin(P.heading)];
        // its gate's bearing must point back along the trail: heading − bearing = the trail's heading + π
        const heading = P.heading + Math.PI + J.gates[e.gate] * DEG;
        place = { at: [end[0] + f[0] * J.radius, end[1] + f[1] * J.radius], heading };
      }
      places[id] = { at: place.at.map(r3), heading: r6(place.heading) };
      junctions[id] = J;
      bands[id] = disc(places[id].at, J.radius).map((p) => p.map(r3));
      stages.push({ node: id, section: 'junction', manifest: { kind: 'stage', ...paintOf(G, n), seed: n.seed, junction: { radius: J.radius, gates: J.gates, ...(n.recipe.surface ? { surface: n.recipe.surface } : {}) } }, place: places[id] });
      continue;
    }
    // a TRAIL: its span (depth and line) found without building it
    const { st, seed } = outTrailStyle({ kit: n.kit, seed: n.seed });
    const followed = e && parent.section === 'trail' ? stages.find((s) => s.node === e.from) : null;
    const recipe = { ...n.recipe, id, ...(followed ? { after: { ...followed.manifest.trail, seed: followed.manifest.seed } } : {}) };
    const join = followed ? (() => { const S = spans[e.from]; return { x: S.x, slope: S.slope }; })() : null;
    const S = outTrailSpan(st, recipe, seed, join);
    let place;
    if (!e) place = { at: [0, 0], heading: Math.PI / 2 };
    else if (parent.section === 'junction') {
      // off a gate: +y the gate's bearing outward, the path's first point on the gate
      const J = junctions[e.from], Pj = places[e.from], d = bearingDir(J.gates[e.gate], Pj.heading), gate = [Pj.at[0] + d[0] * J.radius, Pj.at[1] + d[1] * J.radius];
      const heading = Math.atan2(d[1], d[0]), rt = [d[1], -d[0]], x0 = S.trailX(0);
      place = { at: [gate[0] - rt[0] * x0, gate[1] - rt[1] * x0], heading };
    } else {
      // after a trail: its frame carried on by its depth
      const P = places[e.from], D = spans[e.from].D, f = [Math.cos(P.heading), Math.sin(P.heading)];
      place = { at: [P.at[0] + f[0] * D, P.at[1] + f[1] * D], heading: P.heading };
    }
    places[id] = { at: place.at.map(r3), heading: r6(place.heading) };
    spans[id] = S;
    const own = trailBand(st, S.D);
    rects[id] = [r3(own[0][0]), r3(own[1][0])];
    bands[id] = own.map((p) => placeOf(places[id], p).map(r3));
    stages.push({ node: id, section: 'trail', manifest: { kind: 'stage', ...paintOf(G, n), seed: n.seed, trail: recipe, ...(n.weather ? { weather: n.weather } : {}) }, place: places[id] });
  }

  // the BANDS apart: two sections that do not join own no ground in common
  const joined = new Set(G.edges.map((e) => [e.from, e.to].sort().join('|')));
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
    const a = order[i], b = order[j];
    if (joined.has([a, b].sort().join('|'))) continue;
    // (two arms off the same junction meet at it: their first stretch inside its reach is the junction's, not theirs)
    if (overlaps(bands[a], bands[b])) throw new Error(`level: map: '${a}' and '${b}' lie over each other (their grounds overlap): turn one, or widen the junction between them`);
  }
  // (where each trail meets what it leaves: its path's first point, for the heights to be met there)
  const gates = Object.fromEntries(order.filter((id) => G.nodes[id].section === 'trail').map((id) => [id, placeOf(places[id], [spans[id].trailX(0), 0]).map(r3)]));
  // (each trail's depth and its path's two ends across it, in its own frame)
  const ends = Object.fromEntries(Object.entries(spans).map(([id, S]) => [id, { D: r3(S.D), x0: r3(S.trailX(0)), x1: r3(S.x), band: rects[id] }]));
  return { layout: 'map', root: G.root, spawn: G.spawn, order, edges: G.edges, places, bands, gates, ends, junctions, stages };
}
