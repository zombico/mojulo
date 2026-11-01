/**
 * OUTDOOR STAIR — the way up the land beside a building set into its slope (era/stage-buildings.js `embed`): a flight
 * of steps between cheek walls from the level ground before its walkout to the level ground behind it, and the paths of
 * slabs that lead to its doors. In the building's plan (metres, z from its floor, its front −y), so the building turns
 * it with itself.
 *
 *   STAIR                              the flight's numbers: its width, its going, its most riser, its cheeks
 *   planStair({ x0, x1, y0, yu, rise, side }) → { side, x: [a, b], foot, head, n, h, lo, hi } | null
 *       the flight up the strip beside the building on `side` (+1 its +x side, −1 its −x): from `lo` (the walkout's
 *       ground, −0.12) to `hi` (the upper ground, `rise` − 0.12), its head LANDING short of the back wall it climbs to
 *       (`yu`), its foot no nearer the front (`y0`) than a landing; null when the side is too short to hold it
 *   stairFaces(S) → { faces: [{ corners, group, n }], colliders: [{ min, max }] }   treads, risers and the cheeks (each
 *       a wall the flight's height plus a parapet, its top sloped with the flight), the cheeks the colliders
 *   slabPath(from, to, zAt, width?) → [{ corners }]   a path of slabs on the land between two points (plan or world)
 *
 * Pure.
 */

export const STAIR = Object.freeze({ width: 1.6, going: 0.3, riser: 0.18, off: 1.0, landing: 1.6, cheek: 0.25, parapet: 0.9, below: 0.5 });

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const P = (p) => p.map(r5);

export function planStair({ x0, x1, y0, yu, rise, side }) {
  const S = STAIR, lo = -0.12, hi = r5(rise - 0.12), n = Math.max(1, Math.ceil((hi - lo) / S.riser - 1e-9)), h = r5((hi - lo) / n), run = n * S.going;
  const head = yu - S.landing, foot = head - run;
  if (foot < y0 + S.landing) return null;
  const a = side > 0 ? x1 + S.off : x0 - S.off - S.width, b = a + S.width;
  return { side, x: [r5(a), r5(b)], foot: r5(foot), head: r5(head), n, h, lo, hi };
}

export function stairFaces(St) {
  const S = STAIR, [a, b] = St.x, faces = [], colliders = [];
  // (each face wound so its normal points along `n`)
  const push = (corners, group, n) => {
    const [p0, p1] = corners, e1 = [0, 1, 2].map((i) => p1[i] - p0[i]), e2 = [0, 1, 2].map((i) => corners[corners.length - 1][i] - p0[i]);
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    faces.push({ corners: (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0 ? corners.slice().reverse() : corners).map(P), group, n });
  };
  for (let k = 0; k < St.n; k++) {
    const y = St.foot + k * S.going, z0 = St.lo + k * St.h, z1 = z0 + St.h;
    push([[a, y, z0], [b, y, z0], [b, y, z1], [a, y, z1]], 'stair', [0, -1, 0]);
    push([[a, y, z1], [b, y, z1], [b, y + S.going, z1], [a, y + S.going, z1]], 'stair', [0, 0, 1]);
  }
  // the cheeks: a wall each side the flight's height plus a parapet, its top sloped with the flight, down into the land
  const c = S.cheek, ya = St.foot - 0.3, yb = St.head + 0.3, zb = St.lo - S.below, topA = St.lo + S.parapet, topB = St.hi + S.parapet;
  for (const [u0, u1] of [[a - c, a], [b, b + c]]) {
    push([[u0, ya, zb], [u0, yb, zb], [u0, yb, topB], [u0, ya, topA]], 'cheek', [-1, 0, 0]);
    push([[u1, yb, zb], [u1, ya, zb], [u1, ya, topA], [u1, yb, topB]], 'cheek', [1, 0, 0]);
    push([[u0, ya, topA], [u0, yb, topB], [u1, yb, topB], [u1, ya, topA]], 'cheek', [0, -0.95, 0.3]);
    push([[u0, ya, zb], [u0, ya, topA], [u1, ya, topA], [u1, ya, zb]], 'cheek', [0, -1, 0]);
    push([[u1, yb, zb], [u1, yb, topB], [u0, yb, topB], [u0, yb, zb]], 'cheek', [0, 1, 0]);
    colliders.push({ min: P([u0, ya, zb]), max: P([u1, yb, topB]) });
  }
  return { faces, colliders };
}

export function slabPath(from, to, zAt, width = 1.2) {
  const run = Math.hypot(to[0] - from[0], to[1] - from[1]), out = [];
  if (run < 0.3) return out;
  const u = [(to[0] - from[0]) / run, (to[1] - from[1]) / run], w = [-u[1] * width / 2, u[0] * width / 2], n = Math.max(1, Math.round(run / 0.75));
  for (let k = 0; k < n; k++) {
    const s0 = (k / n) * run + 0.06, s1 = ((k + 1) / n) * run - 0.06, pa = [from[0] + u[0] * s0, from[1] + u[1] * s0], pb = [from[0] + u[0] * s1, from[1] + u[1] * s1];
    out.push({ corners: [[pa[0] - w[0], pa[1] - w[1]], [pb[0] - w[0], pb[1] - w[1]], [pb[0] + w[0], pb[1] + w[1]], [pa[0] + w[0], pa[1] + w[1]]].map(([x, y]) => P([x, y, zAt(x, y) + 0.04])) });
  }
  return out;
}
