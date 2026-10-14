/**
 * contract — what a drawn track (track.js) tells the game driving on it. A game reads this, never the track's shape:
 * laps take its checkpoints, a grid its slots, an AI driver its racing line, a minimap its outline, the drive rule its
 * surface. Metres, the level's frame, rounded to the millimetre.
 *
 *   trackContract(plan, { leg?, slots? }) → {
 *     form, class, closed, length, width (road), footprint,
 *     columns, stations: [[s, x, y, z, heading, bank]]   every STEP m (bank: rise per metre leftward, signed); a map's
 *                                                        outline and profile are these
 *     start: { s, at, heading }, finish: { s, at }       a lap's are its start line; a stage's its two lines
 *     sectors: [{ s, at }]                               two splits, thirds of the way
 *     checkpoints: [{ at, radius }]                      every `leg` m, the last the finish (laps' own shape)
 *     grid: [{ at, heading }]                            two abreast behind the start, pole first (`slots` of them)
 *     line: [[x, y, z]]                                  a racing line: in to the apex, out wide (racingLine)
 *     bands: [{ kind, o0, o1, surface, corners? }]       one side's, mirrored; kerbs only on the corners
 *     ramps: [{ kind, s0, s1, lip, landing, band }]      band: lip speeds (m/s) that land it
 *     crossings: [{ s, clearance }]
 *   }
 *   trackSurface(plan) → (p) => z: the highest drawn surface under a probe at p (a car's ground hook), else the terrain
 *   racingLine(plan, { step?, reach?, iterations? }) → [{ s, o, x, y, z }]
 *
 * The racing line spreads each bend as wide as the road lets it (curvature equalisation, after K1999): each point moved
 * across until the curvature through it is its neighbours' mean, from coarse scales to fine, held inside the road a
 * car's width and a lane from its edges. It settles wide on the way in, the inside at the apex, wide on the way out,
 * its tightest bend wider than the road's own. (A taut string, the shortest line, hugs the inside of a long bend
 * tighter than the road; least total bending does too.) Deterministic: fixed passes in index order.
 */

const r3 = (v) => Math.round(v * 1000) / 1000;
const TAU = 2 * Math.PI;
const hd = (h) => r3(((((h + Math.PI) % TAU) + TAU) % TAU) - Math.PI);   // a heading in (−π, π]
const STEP = 5;
export const LINE_EDGE = 2.2;        // m the racing line keeps from the road's edge: half a car and a rival's lane

const frameOf = (X) => {
  const bank = (st, off) => { const o = Math.max(-X.kerb, Math.min(X.kerb, off)); return -Math.sign(st.k) * st.e * o; };
  const P = (st, off, dz = 0) => [st.x - Math.sin(st.heading) * off, st.y + Math.cos(st.heading) * off, st.z + bank(st, off) + dz];
  return { P, bank };
};

/** A racing line over the drawn road: its bends spread as wide as the road lets them. */
export function racingLine(plan, { step = 3, scales = [16, 8, 4, 2, 1], passes = 120 } = {}) {
  const a = plan.alignment, X = plan.X, { P } = frameOf(X), L = a.length, closed = a.closed;
  const n = Math.max(8, Math.round(L / step)), count = closed ? n : n + 1;
  const S = Array.from({ length: count }, (_, i) => a.at((i * L) / n));
  const lim = Math.max(0, X.road - LINE_EDGE);
  const nx = S.map((p) => -Math.sin(p.heading)), ny = S.map((p) => Math.cos(p.heading));
  const o = new Float64Array(count);
  const pin = (i) => !closed && ((i * L) / n < 15 || L - (i * L) / n < 15);   // a stage's ends on the line
  const idx = (i) => (closed ? ((i % count) + count) % count : Math.max(0, Math.min(count - 1, i)));
  const q = (i) => [S[i].x + nx[i] * o[i], S[i].y + ny[i] * o[i]];
  // signed curvature through three points (+ turning left)
  const kOf = (A, B, C) => {
    const ab = Math.hypot(B[0] - A[0], B[1] - A[1]), bc = Math.hypot(C[0] - B[0], C[1] - B[1]), ac = Math.hypot(C[0] - A[0], C[1] - A[1]);
    return ab && bc && ac ? (2 * ((B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]))) / (ab * bc * ac) : 0;
  };
  // coarse to fine: each point moved across until its curvature is its neighbours' mean (moving a point left by y
  // changes the curvature through it by −2y/h²), in index order, held inside the road
  for (const r of scales) for (let it = 0; it < passes; it++) for (let i = 0; i < count; i++) {
    if (pin(i)) continue;
    const a2 = idx(i - 2 * r), a1 = idx(i - r), b1 = idx(i + r), b2 = idx(i + 2 * r);
    if (!closed && (i - 2 * r < 0 || i + 2 * r > count - 1)) continue;
    const Qa2 = q(a2), Qa1 = q(a1), Q = q(i), Qb1 = q(b1), Qb2 = q(b2);
    const want = (kOf(Qa2, Qa1, Q) + kOf(Q, Qb1, Qb2)) / 2, now = kOf(Qa1, Q, Qb1);
    const h = (Math.hypot(Q[0] - Qa1[0], Q[1] - Qa1[1]) + Math.hypot(Qb1[0] - Q[0], Qb1[1] - Q[1])) / 2;
    o[i] = Math.max(-lim, Math.min(lim, o[i] + ((now - want) * h * h) / 2 * 0.8));
  }
  return S.map((p, i) => { const pt = P(p, o[i]); return { s: r3(p.s), o: r3(o[i]), x: r3(pt[0]), y: r3(pt[1]), z: r3(pt[2]) }; });
}

/** The ground hook a car drives on: the highest drawn surface (any pass, ramps and bank included) under the probe. */
export function trackSurface(plan) {
  const a = plan.alignment, X = plan.X, { bank } = frameOf(X), L = a.length;
  const step = 1, ns = Math.max(8, Math.round(L / step)), count = a.closed ? ns : ns + 1;
  const S = Array.from({ length: count }, (_, i) => a.at((i * L) / ns));
  const H = 12, hash = new Map();
  S.forEach((p, i) => { const k = `${Math.floor(p.x / H)},${Math.floor(p.y / H)}`; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
  const R = Math.ceil((X.outer + 2) / H);
  return (p) => {
    const [x, y] = p, top = p[2] ?? Infinity, hx = Math.floor(x / H), hy = Math.floor(y / H);
    let best = -Infinity;
    for (let u = hx - R; u <= hx + R; u++) for (let v = hy - R; v <= hy + R; v++) for (const i of hash.get(`${u},${v}`) ?? []) {
      const st = S[i], dx = x - st.x, dy = y - st.y;
      const t = dx * Math.cos(st.heading) + dy * Math.sin(st.heading), o = -dx * Math.sin(st.heading) + dy * Math.cos(st.heading);
      if (Math.abs(t) > (step / 2) * (1 + Math.abs(st.k * o)) + 1e-6 || Math.abs(o) > X.outer) continue;
      const z = a.at(st.s + t).z + bank(st, o);
      if (z <= top + 1e-6 && z > best) best = z;
    }
    return best > -Infinity ? best : plan.groundAt(x, y);
  };
}

/** The contract of a drawn track. */
export function trackContract(plan, { leg = 20, slots = 8 } = {}) {
  const a = plan.alignment, X = plan.X, { P } = frameOf(X), L = a.length, closed = a.closed, course = plan.course;
  const at = (s) => a.at(closed ? s : Math.max(0, Math.min(L, s)));
  const pt = (s, o = 0) => P(at(s), o).map(r3);
  const s0 = plan.lines.start, s1 = closed ? L : plan.lines.finish;
  // the stations, every STEP metres
  const stations = [];
  for (let s = 0; s < L + (closed ? 0 : 1e-6); s += STEP) { const p = at(s); stations.push([r3(p.s), r3(p.x), r3(p.y), r3(p.z), hd(p.heading), r3(-Math.sign(p.k) * p.e)]); }
  // checkpoints every `leg` m from the start to the finish, none on a crossing (the other pass would sweep it)
  const away = (s) => { for (const c of plan.crossings) for (const cs of c.s ?? [c.s1, c.s2]) { const q = at(cs), p = at(s); if (Math.hypot(q.x - p.x, q.y - p.y) < X.outer * 2) return false; } return true; };
  const K = Math.max(4, Math.round((s1 - s0) / leg)), gap = (s1 - s0) / K, checkpoints = [];
  for (let j = 1; j <= K; j++) {
    let s = s0 + gap * j;
    if (j < K) {
      for (let k = 0; k < 8 && !away(s); k++) s += X.outer;
      if (s > s0 + gap * (j + 1) - gap / 3) continue;          // pushed onto the next: that one stands for both
    }
    checkpoints.push({ at: pt(s), radius: r3(X.road + 1) });
  }
  // the grid: two abreast behind the start line, the pole on the left of the first row
  const grid = Array.from({ length: slots }, (_, k) => {
    const row = Math.floor(k / 2), side = k % 2 ? -1 : 1, s = s0 - (4 + 6 * row);
    return { at: pt(closed ? s : Math.max(0, s), 2 * side), heading: hd(at(s).heading) };
  });
  const sectors = [1, 2].map((j) => { const s = s0 + ((s1 - s0) * j) / 3; return { s: r3(s), at: pt(s) }; });
  const T = X.T;
  const bands = [
    { kind: 'road', o0: 0, o1: r3(X.road), surface: T.road },
    ...(T.kerb ? [{ kind: 'kerb', o0: r3(X.road), o1: r3(X.kerb), surface: T.road, corners: true }] : []),
    { kind: 'runoff', o0: r3(X.kerb), o1: r3(X.runoff), surface: T.runoffSurface, ...(T.outside !== T.runoffSurface ? { outside: T.outside } : {}) },
    ...(T.barrier ? [{ kind: 'barrier', o0: r3(X.runoff), o1: r3(X.outer), barrier: T.barrier.kind, h: T.barrier.h }] : []),
  ];
  const line = racingLine(plan).map((q) => [q.x, q.y, q.z]);
  return {
    form: plan.form, class: course.class, closed, length: r3(L), width: r3(2 * X.road), footprint: r3(2 * X.outer),
    columns: ['s', 'x', 'y', 'z', 'heading', 'bank'], stations,
    start: { s: r3(s0), at: pt(s0), heading: hd(at(s0).heading) },
    finish: { s: r3(s1 % L), at: pt(s1) },
    sectors, checkpoints, grid, line, bands,
    ramps: course.ramps.map((r) => ({ ...r, ...(r.lip ? { lip: { ...r.lip, at: pt(r.lip.s) } } : {}) })),
    crossings: plan.crossings.map((c) => ({ s: [c.s1, c.s2], at: c.at, dz: c.dz })),
  };
}
