/**
 * THE STREETS' PROFILE — uphill and downhill streets laid as a hill town lays them, not draped on the land. Each street is
 * a PROFILE along its line: its CROSSINGS held level at the land's height there (a cross street meets it on the flat),
 * each block between two crossings GRADED on one ramp (cut and filled from the land: the hummock between levelled out),
 * its ends eased in vertical curves, so a street reads as climbing one rise after another. A stretch steeper than a street
 * may be walked (WALKABLE) is flagged as stairs: said in the readout, for the stair street to be built there.
 *
 * The streets' ground is then the profiles FILLED over each cell of the grid (a Coons patch between the four street lines
 * round it): on every street's line it is that street's profile, at every crossing its level, between them a smooth
 * surface, level across a street's width and over each crossing corner to corner. Past the outermost streets, each runs on level to the frame's edge.
 *
 *   PROFILE                       the profile's numbers: the ramp's eased ends (`curve`, m), the walkable grade
 *   profileStreets({ S, X, Y, SX, SY, frame }, opts?) → { S (the profiled ground, (x, y) → m), range, streets: [{ id,
 *                                 axis, at, nodes: [z…], stretches: [{ from, to, rise, grade, stairs? }] }] }
 *                                 S the land's streets' ground (geotownLand's), X and Y the lines' places, SX and SY their
 *                                 sections (`half`: half the right-of-way, the crossing's reach); opts { walkable?, curve? }
 * Pure.
 */
const r3 = (v) => Math.round(v * 1000) / 1000;

export const PROFILE = Object.freeze({ curve: 8, walkable: 0.2 });

// the ramp's share of its rise at u (0…1 along it): a constant grade, its two ends eased in vertical curves of share c
function ramp(u, c) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const g = 1 / (1 - c);   // (the grade over the middle, the ends' quadratic curves carrying it in and out)
  if (u < c) return (g * u * u) / (2 * c);
  if (u > 1 - c) return 1 - (g * (1 - u) * (1 - u)) / (2 * c);
  return g * (u - c / 2);
}

// one street's profile along its line: each block a ramp between the edges of its two crossings, level over each
// crossing and on to the frame's ends → { at: (t) → z, stretches } (a stretch's grade its ramp's middle, its steepest)
function lineProfile(places, halves, zs, { curve, walkable }) {
  const n = places.length, ramps = [];
  for (let k = 0; k + 1 < n; k++) {
    const a = places[k] + halves[k], b = places[k + 1] - halves[k + 1], run = Math.max(1e-6, b - a), rise = zs[k + 1] - zs[k];
    const c = Math.min(0.45, curve / run), grade = Math.abs(rise) / run / (1 - c);
    ramps.push({ a, b, c, from: r3(a), to: r3(b), rise: r3(rise), grade: r3(grade), ...(grade > walkable ? { stairs: true } : {}) });
  }
  const at = (t) => {
    for (let k = 0; k < ramps.length; k++) { const R = ramps[k]; if (t <= R.a) return zs[k]; if (t <= R.b) return zs[k] + (zs[k + 1] - zs[k]) * ramp((t - R.a) / (R.b - R.a), R.c); }
    return zs[n - 1];
  };
  return { at, stretches: ramps.map(({ a: _a, b: _b, c: _c, ...s }) => s) };
}

export function profileStreets({ S, X, Y, SX, SY, frame }, opts = {}) {
  const O = { ...PROFILE, ...opts };
  // the crossings' heights: the land's streets' ground where two lines cross
  const node = X.map((x) => Y.map((y) => S(x, y)));
  const hx = SX.map((s) => s.half), hy = SY.map((s) => s.half);
  // each north-south street (a column k) along y, each east-west one (a row j) along x
  const ns = X.map((x, k) => lineProfile(Y, hy, node[k], O));
  const ew = Y.map((y, j) => lineProfile(X, hx, X.map((_, k) => node[k][j]), O));
  // the cell a coordinate falls in along one axis (−1 before the first line, n−1 past the last) and its share across it:
  // 0 over the first line's crossing, 1 over the next's, eased between (so a crossing is level corner to corner, not only
  // along its two streets, and the block's surface leaves it with no crease)
  const cell = (L, H, v) => {
    if (v <= L[0]) return [-1, 0];
    if (v >= L[L.length - 1]) return [L.length - 1, 0];
    let i = 0; while (v > L[i + 1]) i++;
    const a = L[i] + H[i], b = L[i + 1] - H[i + 1], run = Math.max(1e-6, b - a);
    return [i, ramp((v - a) / run, Math.min(0.45, O.curve / run))];
  };
  const Sp = (x, y) => {
    const [i, u] = cell(X, hx, x), [j, v] = cell(Y, hy, y);
    // (past the outermost lines: the nearest line's profile run on level, out to the frame's edge)
    if (i < 0 || i >= X.length - 1) { const k = i < 0 ? 0 : X.length - 1; if (j < 0 || j >= Y.length - 1) return node[k][j < 0 ? 0 : Y.length - 1]; return ns[k].at(y); }
    if (j < 0 || j >= Y.length - 1) { const jj = j < 0 ? 0 : Y.length - 1; return ew[jj].at(x); }
    // THE COONS PATCH: the four lines round the cell, less their corners counted twice
    const W = ns[i].at(y), E = ns[i + 1].at(y), Sb = ew[j].at(x), N = ew[j + 1].at(x);
    const c00 = node[i][j], c10 = node[i + 1][j], c01 = node[i][j + 1], c11 = node[i + 1][j + 1];
    return (1 - u) * W + u * E + (1 - v) * Sb + v * N - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c10 + (1 - u) * v * c01 + u * v * c11);
  };
  let lo = Infinity, hi = -Infinity;
  for (const row of node) for (const z of row) { if (z < lo) lo = z; if (z > hi) hi = z; }
  return {
    S: Sp, range: [r3(lo), r3(hi)],
    streets: [...X.map((x, k) => ({ id: `ns-${k}`, axis: 'y', at: r3(x), nodes: node[k].map(r3), stretches: ns[k].stretches })),
      ...Y.map((y, j) => ({ id: `ew-${j}`, axis: 'x', at: r3(y), nodes: X.map((_, k) => r3(node[k][j])), stretches: ew[j].stretches }))],
  };
}
