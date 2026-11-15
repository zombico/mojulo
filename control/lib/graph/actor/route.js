/**
 * route — a cross walked ROUND what stands in the way. A scene blocks a cross as a straight line between two marks
 * (scene.js); on a set that says what stands on its floor (a decorated room's furniture: interior/places.js `blocks`)
 * the line is bent round it: the shortest way over the corners of what is in the way, each kept a body's width off.
 *
 *   routeWalk(from, to, { blocks, room?, people? }) → [from, …corners, to]
 *     blocks   [{ min: [x, y], max: [x, y] }] what stands on the floor, metres
 *     room     { min, max } the walled room the walk is in: no corner is taken outside it
 *     people   [[x, y]] where the others stand: walked round like a piece
 *   The way keeps BODY off every piece where it can; through a gap narrower than that the walker squeezes by
 *   (SQUEEZE). A walk with nothing in its way, or with no way round at all, is the straight line [from, to]. A block the walk starts or
 *   ends inside (a mark written into a piece) is not in its way: the script's word wins.
 *
 * Pure and deterministic.
 */

/** a body's half width (m): how far a walk keeps off a piece; and the room a standing person takes (m, half a side) */
export const BODY = 0.22, PERSON = 0.3;
/** the bodies a way is searched with, the easy one first: a walker turns side on through a narrow gap */
export const SQUEEZE = Object.freeze([BODY, 0.14, 0.07]);
const SKIN = 0.03;   // a corner stands this far outside the kept-off edge, so a leg along an edge is clear of it
const r3 = (v) => Math.round(v * 1000) / 1000;

const grown = (B, by) => ({ x0: B.min[0] - by, y0: B.min[1] - by, x1: B.max[0] + by, y1: B.max[1] + by });
const holds = (R, p) => p[0] > R.x0 && p[0] < R.x1 && p[1] > R.y0 && p[1] < R.y1;

/** whether the segment a→b passes through a rect's inside (Liang–Barsky) */
function crosses(R, a, b) {
  let t0 = 0, t1 = 1;
  const d = [b[0] - a[0], b[1] - a[1]];
  for (const [p, q] of [[-d[0], a[0] - R.x0], [d[0], R.x1 - a[0]], [-d[1], a[1] - R.y0], [d[1], R.y1 - a[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q <= 0) return false; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    if (t0 >= t1) return false;
  }
  return t1 - t0 > 1e-9;
}

/** how near a way's two ends must be to a path to follow it (m), how far apart the corners kept from it are at least
 * (m), and how many times the straight line a way along it may be before the straight line is walked */
export const PATH_NEAR = 3, PATH_STEP = 1.2, PATH_MOST = 3;

/**
 * A cross that FOLLOWS a path the world lays (a trail, a sidewalk: set.js `paths`): where both its ends stand by one
 * path, the way goes along it, not across country. → [from, …the path's corners between, to], or null where no path
 * passes both ends, the ends are by the same stretch of it, or the way along it is far longer than the straight line.
 */
export function pathWalk(from, to, paths = []) {
  const a = [from[0], from[1]], b = [to[0], to[1]], straight = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (straight < PATH_STEP * 2) return null;
  let best = null;
  for (const P of paths) {
    const nearest = (p) => { let k = -1, d = Infinity; P.forEach((q, i) => { const e = Math.hypot(q[0] - p[0], q[1] - p[1]); if (e < d) { d = e; k = i; } }); return { k, d }; };
    const A = nearest(a), B = nearest(b);
    if (A.d > PATH_NEAR || B.d > PATH_NEAR || A.k === B.k) continue;
    const run = A.k < B.k ? P.slice(A.k, B.k + 1) : P.slice(B.k, A.k + 1).reverse();
    let len = A.d + B.d;
    for (let i = 1; i < run.length; i++) len += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
    if (len > straight * PATH_MOST || (best && len >= best.len)) continue;
    // (its corners thinned to a step apart: a walk is keyed corner to corner)
    const mid = [];
    for (const q of run) if (Math.hypot(q[0] - a[0], q[1] - a[1]) >= PATH_STEP && Math.hypot(q[0] - b[0], q[1] - b[1]) >= PATH_STEP && (!mid.length || Math.hypot(q[0] - mid.at(-1)[0], q[1] - mid.at(-1)[1]) >= PATH_STEP)) mid.push([r3(q[0]), r3(q[1])]);
    best = { len, way: [a, ...mid, b] };
  }
  return best && best.way.length > 2 ? best.way : null;
}

/** The way from `from` to `to` (see the header) */
export function routeWalk(from, to, opts = {}) {
  // (the easy way first; where the pieces stand too close for it, a decorator's 420 mm between a sofa and its table,
  // the walker squeezes by: the same search a narrower body at a time)
  for (const body of SQUEEZE) { const way = wayOff(from, to, opts, body); if (way) return way; }
  return [[from[0], from[1]], [to[0], to[1]]];
}

// the shortest way keeping `body` off every piece: the straight line when it is clear, null when there is no way
function wayOff(from, to, { blocks = [], room = null, people = [] } = {}, body) {
  const a = [from[0], from[1]], b = [to[0], to[1]], straight = [a, b];
  const all = [...blocks.map((B) => grown(B, body)), ...people.map((p) => grown({ min: p, max: p }, PERSON + body))]
    .filter((R) => !holds(R, a) && !holds(R, b));
  const clear = (p, q) => !all.some((R) => crosses(R, p, q));
  if (!all.length || clear(a, b)) return straight;
  const inRoom = (p) => !room || (p[0] >= room.min[0] + body && p[0] <= room.max[0] - body && p[1] >= room.min[1] + body && p[1] <= room.max[1] - body);
  const corners = all.flatMap((R) => [[R.x0 - SKIN, R.y0 - SKIN], [R.x1 + SKIN, R.y0 - SKIN], [R.x1 + SKIN, R.y1 + SKIN], [R.x0 - SKIN, R.y1 + SKIN]])
    .filter((p) => inRoom(p) && !all.some((R) => holds(R, p)));
  // the shortest way over the corners (Dijkstra on the sight graph; a room holds a few pieces, so it is small)
  const P = [a, ...corners, b], n = P.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity || u === n - 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const d = dist[u] + Math.hypot(P[v][0] - P[u][0], P[v][1] - P[u][1]);
      if (d < dist[v] - 1e-9 && clear(P[u], P[v])) { dist[v] = d; prev[v] = u; }
    }
  }
  if (dist[n - 1] === Infinity) return null;
  const way = [];
  for (let i = n - 1; i >= 0; i = prev[i]) way.unshift(i === 0 ? a : i === n - 1 ? b : P[i].map(r3));
  return way;
}
