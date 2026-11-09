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
 *                                 axis, at, nodes: [z…], climb?, stretches: [{ from, to, rise, grade, stairs? }] }] }
 *                                 S the land's streets' ground (geotownLand's), X and Y the lines' places, SX and SY their
 *                                 sections (`half`: half the right-of-way, the crossing's reach); opts { walkable?, curve?,
 *                                 keep?, ids?, climb? }:
 *                                 keep   the outermost line each way KEPT on S (a frame's edge, a neighbourhood's inside
 *                                        its arterials, a town's perimeter on its metro's ground): its profile S along it,
 *                                        S itself past it, never reported, so the profiled ground meets what is round it
 *                                 ids    { x: [id…], y: [id…] } the lines' names (`ns-k`, `ew-j` by default)
 *                                 climb  { <id>: grade } a street that CLIMBS: its crossings set to rise at its grade
 *                                        (rise over run; less than 0 falls) from its first, toward its north or east end,
 *                                        its cross streets graded to meet them; streets along one axis only
 *   climbLift(climb, { x: [{ id, at }…], y: […] }) → (x, y, N) → m, or null: the LIFT a climbing street gives the land, so
 *                                 its houses and lots climb with it: the land under it raised (or lowered) to its climb
 *                                 from its first line across (`N` the ground it is lifted over), eased out to nothing at
 *                                 its parallel neighbours
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
    let a = places[k] + halves[k], b = places[k + 1] - halves[k + 1];
    // (two crossings whose reaches meet: no ramp between them, its rise a step at their middle, its grade read on the run
    // between their middles)
    if (b - a < 1) { const m = (a + b) / 2; a = m - 0.5; b = m + 0.5; }
    const run = b - a, rise = zs[k + 1] - zs[k], c = Math.min(0.45, curve / run);
    const grade = run > 1 + 1e-9 ? Math.abs(rise) / run / (1 - c) : Math.abs(rise) / Math.max(1, places[k + 1] - places[k]);
    ramps.push({ a, b, c, from: r3(a), to: r3(b), rise: r3(rise), grade: r3(grade), ...(grade > walkable ? { stairs: true } : {}) });
  }
  const at = (t) => {
    for (let k = 0; k < ramps.length; k++) { const R = ramps[k]; if (t <= R.a) return zs[k]; if (t <= R.b) return zs[k] + (zs[k + 1] - zs[k]) * ramp((t - R.a) / (R.b - R.a), R.c); }
    return zs[n - 1];
  };
  return { at, stretches: ramps.map(({ a: _a, b: _b, c: _c, ...s }) => s) };
}

export function profileStreets({ S, X, Y, SX, SY, frame }, opts = {}) {
  const { keep = false, ids = null, climb = {}, ...own } = opts, O = { ...PROFILE, ...own };
  const kx = (k) => keep && (k === 0 || k === X.length - 1), ky = (j) => keep && (j === 0 || j === Y.length - 1);
  const idX = ids?.x ?? X.map((_, k) => `ns-${k}`), idY = ids?.y ?? Y.map((_, j) => `ew-${j}`);
  // the crossings' heights: the land's streets' ground where two lines cross
  const node = X.map((x) => Y.map((y) => S(x, y)));
  // (a street that climbs: its crossings off the kept lines set at its grade from its first; one axis only)
  const climbs = Object.entries(climb);
  if (climbs.some(([id]) => idX.includes(id)) && climbs.some(([id]) => idY.includes(id))) throw new Error(`profile: the climbing streets cross (${climbs.map(([id]) => id).join(', ')}); name streets along one axis`);
  for (const [id, g] of climbs) {
    const k = idX.indexOf(id), j = idY.indexOf(id);
    if (k >= 0 && !kx(k)) for (let q = 1; q < Y.length; q++) { if (!ky(q)) node[k][q] = node[k][0] + g * (Y[q] - Y[0]); }
    else if (j >= 0 && !ky(j)) for (let q = 1; q < X.length; q++) { if (!kx(q)) node[q][j] = node[0][j] + g * (X[q] - X[0]); }
    else throw new Error(`profile: '${id}' is not a street of this grid (${[...idX.filter((_, q) => !kx(q)), ...idY.filter((_, q) => !ky(q))].join(', ')})`);
  }
  const hx = SX.map((s) => s.half ?? 0), hy = SY.map((s) => s.half ?? 0);
  // each north-south street (a column k) along y, each east-west one (a row j) along x; a kept line S along it
  const kept = (f) => ({ at: f, stretches: [] });
  const ns = X.map((x, k) => (kx(k) ? kept((t) => S(x, t)) : lineProfile(Y, hy, node[k], O)));
  const ew = Y.map((y, j) => (ky(j) ? kept((t) => S(t, y)) : lineProfile(X, hx, X.map((_, k) => node[k][j]), O)));
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
    // (past the outermost lines: kept, the ground as given; else the nearest line's profile run on level, out to the
    // frame's edge)
    if (keep && (i < 0 || i >= X.length - 1 || j < 0 || j >= Y.length - 1)) return S(x, y);
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
    streets: [...X.flatMap((x, k) => (kx(k) ? [] : [{ id: idX[k], axis: 'y', at: r3(x), nodes: node[k].map(r3), ...(climb[idX[k]] !== undefined ? { climb: climb[idX[k]] } : {}), stretches: ns[k].stretches }])),
      ...Y.flatMap((y, j) => (ky(j) ? [] : [{ id: idY[j], axis: 'x', at: r3(y), nodes: X.map((_, k) => r3(node[k][j])), ...(climb[idY[j]] !== undefined ? { climb: climb[idY[j]] } : {}), stretches: ew[j].stretches }]))],
  };
}

/** The land's lift under each climbing street: to its climb along it, eased out toward its parallel neighbours. */
export function climbLift(climb, lines) {
  const parts = Object.entries(climb ?? {}).map(([id, g]) => {
    const ns = lines.x.some((l) => l.id === id), L = ns ? lines.x : lines.y, O = ns ? lines.y : lines.x, k = L.findIndex((l) => l.id === id);
    if (k < 0) return null;
    const at = L[k].at, o = O[0].at, reach = Math.min(...[L[k].at - L[k - 1]?.at, L[k + 1]?.at - L[k].at].filter((v) => Number.isFinite(v)));
    // (full under the street and its lots, out to a third of the way to its neighbour, then eased to nothing there)
    const ease = (d) => { const t = Math.max(0, Math.min(1, (d - reach * 0.35) / (reach * 0.65))); return 1 - t * t * (3 - 2 * t); };
    return (x, y, N) => {
      const w = ease(Math.abs((ns ? x : y) - at));
      if (w <= 0) return 0;
      const t = ns ? y : x, on = ns ? N(at, t) : N(t, at), z0 = ns ? N(at, o) : N(o, at);
      return (z0 + g * (t - o) - on) * w;
    };
  }).filter(Boolean);
  return parts.length ? (x, y, N) => parts.reduce((a, f) => a + f(x, y, N), 0) : null;
}
