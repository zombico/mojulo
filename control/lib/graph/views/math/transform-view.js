/**
 * transform-view — a LINEAR MAP A: ℝ² → ℝ² shown the only honest way: as the DEFORMATION of space.
 *
 * A faint reference grid stays put; the bright image grid, the basis vectors î/ĵ, the unit square and
 * the unit circle all ride the map. Eigenvectors appear as the INVARIANT rays (a vector on them only
 * stretches by λ, never turns); the determinant is the SIGNED AREA of the unit square's image; the
 * unit circle becomes the SVD ellipse whose semi-axes are the singular values.
 *
 * HONESTY NOTE — the inversion vs the science views: those are "honest structure, compressed SCALE."
 * Math has no scale to compress, so the object is rendered EXACT — closed-form eigen/det/SVD. The only
 * stylization is presentational (we lay the map flat on z=0 so one orbit reads it).
 *
 * Discrete grid + arrows + ranking → meshes + the tracer channel (NOT raymarch). Sibling to
 * vector-match-view; faces/picks/tracers/readout through emitThreeWorld.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'transform-view', scenario?, matrix?, animate?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const readoutField = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });

// 3-D vector ops (everything lives on the z=0 plane, but the World is 3-D).
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scaleV = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sample = (a, b, n) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; });

const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function boxFaces(center, half, fill, group, alpha) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  return [
    quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha),
    quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),
    quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),
    quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha),
  ];
}
// a thin flat ribbon between two 3-D points (a grid line / vector shaft), offset along a perpendicular.
function segRibbon(a, b, w, fill, group, alpha) {
  const d = sub(b, a);
  let perp = cross(d, [0, 0, 1]);
  if (len(perp) < 1e-3) perp = cross(d, [0, 1, 0]);
  perp = scaleV(normalize(perp), w);
  return quad([add(a, perp), add(b, perp), sub(b, perp), sub(a, perp)], fill, group, alpha);
}
// an arrow: a shaft ribbon + a box arrowhead at the tip.
function arrow(from, to, w, fill, group, alpha) {
  return [segRibbon(from, to, w, fill, group, alpha), ...boxFaces(to, [w * 2.1, w * 2.1, w * 2.1], fill, group, alpha)];
}
// a closed polyline (circle/ellipse loop) as ribbons.
function loop(pts, w, fill, group, alpha) {
  const faces = [];
  for (let i = 0; i < pts.length; i++) faces.push(segRibbon(pts[i], pts[(i + 1) % pts.length], w, fill, group, alpha));
  return faces;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE MATH ENGINE. classifyMatrix(M) for a 2×2 M=[[a,b],[c,d]] — pure, closed form, deterministic.
// det, trace, real/complex eigenpairs (characteristic quadratic), singular values (eig of MᵀM), rank.
// This is the whole math core; everything below is rendering of what it returns.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const EPS = 1e-9;

// eigenvector for a REAL eigenvalue l of M=[[a,b],[c,d]]: a unit solution of (A − lI)v = 0.
function eigenReal(M, l) {
  const [[a, b], [c, d]] = M;
  let v;
  if (Math.abs(b) > EPS) v = [b, l - a];          // row (a−l)v₀ + b v₁ = 0
  else if (Math.abs(c) > EPS) v = [l - d, c];     // row c v₀ + (d−l)v₁ = 0
  else v = (Math.abs(a - l) < EPS) ? [1, 0] : [0, 1]; // diagonal: the axis whose entry equals l
  const n = Math.hypot(v[0], v[1]) || 1;
  return { lambda: l, imag: 0, vector: [v[0] / n, v[1] / n] };
}

export function classifyMatrix(M) {
  const [[a, b], [c, d]] = M;
  const det = a * d - b * c;
  const trace = a + d;
  const disc = trace * trace - 4 * det;           // characteristic-quadratic discriminant

  let eigen, kind;
  if (disc > EPS) {                                // two distinct REAL eigenvalues
    const s = Math.sqrt(disc);
    eigen = [eigenReal(M, (trace + s) / 2), eigenReal(M, (trace - s) / 2)];
    kind = 'real-distinct';
  } else if (disc < -EPS) {                        // COMPLEX conjugate pair → no real invariant axis
    const im = Math.sqrt(-disc) / 2;
    eigen = [{ lambda: trace / 2, imag: im, vector: null }, { lambda: trace / 2, imag: -im, vector: null }];
    kind = 'complex';
  } else {                                         // repeated real eigenvalue
    const l = trace / 2;
    const diagonalizable = Math.abs(b) < EPS && Math.abs(c) < EPS;  // M = lI ⇒ every vector is an eigenvector
    eigen = diagonalizable
      ? [{ lambda: l, imag: 0, vector: [1, 0] }, { lambda: l, imag: 0, vector: [0, 1] }]
      : [eigenReal(M, l)];                          // DEFECTIVE: only one independent eigenvector
    kind = diagonalizable ? 'real-repeated' : 'defective';
  }

  // singular values: σ = √(eigenvalues of MᵀM). trace(MᵀM)=Σmᵢⱼ², det(MᵀM)=det². σ₁·σ₂ = |det|.
  const T = a * a + b * b + c * c + d * d, sDisc = Math.max(0, T * T - 4 * det * det), sRoot = Math.sqrt(sDisc);
  const s1 = Math.sqrt(Math.max(0, (T + sRoot) / 2)), s2 = Math.sqrt(Math.max(0, (T - sRoot) / 2));
  const rank = Math.abs(det) > EPS ? 2 : (T > EPS ? 1 : 0);

  return { matrix: M, det, trace, disc, kind, eigen, singular: [s1, s2], rank };
}

// ── scenario presets — one idea worn several ways, with degenerate controls (rotation, projection) ──
const ROT = (deg) => { const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return [[c, -s], [s, c]]; };
const SCENARIOS = {
  eigenbasis: { matrix: [[2, 1], [1, 2]], title: 'eigenbasis — two invariant axes', blurb: 'a symmetric map: two real eigenvectors that only stretch (λ = 3 and 1)' },
  scale: { matrix: [[2, 0], [0, 0.5]], title: 'scale — determinant is area', blurb: 'a diagonal map: axes are the eigenvectors; image-square area = λ₁·λ₂ = det' },
  shear: { matrix: [[1, 1], [0, 1]], title: 'shear — defective (one axis)', blurb: 'det = 1 (area kept); ONE repeated eigenvalue, only ONE eigen-direction' },
  rotation: { matrix: ROT(35), title: 'rotation — no real eigenvector', blurb: 'orthogonal, det = +1, COMPLEX eigenvalues e^±iθ: every vector turns, no invariant axis' },
  projection: { matrix: [[1, 0], [0, 0]], title: 'projection — det 0, space collapses', blurb: 'rank 1: the plane collapses onto a line, the circle to a segment, σ₂ = 0' },
};
export const TRANSFORM_SCENARIOS = Object.keys(SCENARIOS);

function parseMatrix(m) {
  if (!Array.isArray(m) || m.length !== 2) return null;
  const row = (r) => Array.isArray(r) && r.length === 2 && Number.isFinite(+r[0]) && Number.isFinite(+r[1]);
  if (!row(m[0]) || !row(m[1])) return null;
  return [[+m[0][0], +m[0][1]], [+m[1][0], +m[1][1]]];
}

const U = 3.4;          // render units per grid step
const GRID = 4;         // grid extent: −GRID … GRID
const P = ([x, y]) => [x * U, y * U, 0];
const applyM = (M, [x, y]) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
const mfmt = (M) => `[[${(+M[0][0]).toFixed(2)}, ${(+M[0][1]).toFixed(2)}], [${(+M[1][0]).toFixed(2)}, ${(+M[1][1]).toFixed(2)}]]`;
const vfmt = (v) => `[${v[0].toFixed(2)}, ${v[1].toFixed(2)}]`;

const COL = {
  refGrid: '#2f3b58', imgGrid: '#5bc8e0', refBasis: '#7d869c',
  iHat: '#ff6a6a', jHat: '#6ad29a', detPos: '#3a7d68', detNeg: '#8a3b3b',
  refCircle: '#3a4560', ellipse: '#e6b94e', eig: '#b07cec', origin: '#9aa3b8',
};

/**
 * Resolve a recipe → { faces, picks, tracers, fields, bounds, stats }. Pure, deterministic.
 */
export function planTransformScene(recipe = {}) {
  const override = parseMatrix(recipe.matrix);
  const scen = TRANSFORM_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'eigenbasis';
  const preset = SCENARIOS[scen];
  const M = override || preset.matrix;
  const info = classifyMatrix(M);

  // LIVE morph (default): the image groups are emitted at their REFERENCE (undeformed) positions and the
  // deform channel carries them identity → A on screen — so you watch space FLOW into the map (and the
  // eigen-rays visibly hold their line). `animate:false` bakes the final A statically instead. IT() is
  // the per-point image transform: identity when morphing (the channel applies A), A when baked.
  const live = recipe.animate !== false;
  const IT = (p) => (live ? p : applyM(M, p));
  const morphGroups = [];

  const faces = [], picks = [], tracers = [];

  // ── reference grid (faint, what space looks like BEFORE) + image grid (bright, AFTER) ──
  const gline = (p, q, fill, group, alpha, w) => faces.push(segRibbon(P(p), P(q), w, fill, group, alpha));
  for (let i = -GRID; i <= GRID; i++) {
    gline([i, -GRID], [i, GRID], COL.refGrid, 'grid:ref', 0.5, 0.05);
    gline([-GRID, i], [GRID, i], COL.refGrid, 'grid:ref', 0.5, 0.05);
  }
  morphGroups.push('grid:img');
  for (let i = -GRID; i <= GRID; i++) {
    const a = IT([i, -GRID]), b = IT([i, GRID]);
    const c = IT([-GRID, i]), d = IT([GRID, i]);
    faces.push(segRibbon(P(a), P(b), 0.06, COL.imgGrid, 'grid:img', 0.55));
    faces.push(segRibbon(P(c), P(d), 0.06, COL.imgGrid, 'grid:img', 0.55));
  }

  // ── unit square → image parallelogram (filled): signed area = det; warm hue if orientation flips ──
  morphGroups.push('det');
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map((p) => IT(p));
  const detFill = info.det < 0 ? COL.detNeg : COL.detPos;
  faces.push(quad(sq.map(P), detFill, 'det', 0.34));
  faces.push(...loop([[0, 0], [1, 0], [1, 1], [0, 1]].map(P), 0.04, COL.refBasis, 'unit', 0.4)); // ref unit square

  // ── unit circle → SVD ellipse (semi-axes = singular values) ──
  morphGroups.push('svd');
  const N = 64;
  const refCirc = Array.from({ length: N }, (_, k) => { const t = (k / N) * TAU; return [Math.cos(t), Math.sin(t)]; });
  faces.push(...loop(refCirc.map(P), 0.035, COL.refCircle, 'circ:ref', 0.3));
  faces.push(...loop(refCirc.map((p) => P(IT(p))), 0.07, COL.ellipse, 'svd', 0.85));

  // ── basis vectors: original î/ĵ faint, image columns bright (tips = the COLUMNS of A) ──
  morphGroups.push('i:img', 'j:img');
  faces.push(...arrow(P([0, 0]), P([1, 0]), 0.05, COL.refBasis, 'i:ref', 0.4));
  faces.push(...arrow(P([0, 0]), P([0, 1]), 0.05, COL.refBasis, 'j:ref', 0.4));
  const Ai = IT([1, 0]), Aj = IT([0, 1]);
  faces.push(...arrow(P([0, 0]), P(Ai), 0.11, COL.iHat, 'i:img'));
  faces.push(...arrow(P([0, 0]), P(Aj), 0.11, COL.jHat, 'j:img'));
  if (!live) {   // mid-morph the channel owns these positions; static beads would fight it
    tracers.push({ path: sample(P([0, 0]), P(Ai), 12), color: [255, 106, 106], size: 0.55, period: 4, trail: 6, trailLag: 0.014 });
    tracers.push({ path: sample(P([0, 0]), P(Aj), 12), color: [106, 210, 154], size: 0.55, period: 4, trail: 6, trailLag: 0.014 });
  }

  // ── eigen-rays: invariant lines (real eigenvalues only). A bead rides out to λ·v, staying on its line.
  // The ray is emitted along v; under the morph A maps that line to ITSELF (A·v = λv), so it visibly
  // holds while the grid bends — the whole point. The bead sits at v (→ λv) so the channel carries it. ──
  const realEig = info.eigen.filter((e) => e.vector && Math.abs(e.imag) < EPS);
  realEig.forEach((e, idx) => {
    const v = [e.vector[0], e.vector[1]], far = GRID * 1.15;
    morphGroups.push(`eig:${idx}`);
    faces.push(segRibbon(P([-v[0] * far, -v[1] * far]), P([v[0] * far, v[1] * far]), 0.05, COL.eig, `eig:${idx}`, 0.45));
    const bead = live ? v : [v[0] * e.lambda, v[1] * e.lambda];   // channel scales v→λv when morphing
    faces.push(...boxFaces(P(bead), [0.4, 0.4, 0.4], COL.eig, `eig:${idx}`, 0.95));
    if (!live) tracers.push({ path: sample(P([0, 0]), P([v[0] * e.lambda, v[1] * e.lambda]), 10), color: [176, 124, 236], size: 0.6, period: 5, trail: 7, trailLag: 0.013 });
  });

  // origin.
  faces.push(...boxFaces([0, 0, 0], [0.5, 0.5, 0.5], COL.origin, 'origin'));

  // ── picks (popups) ──
  picks.push({ name: 'origin', kind: 'space', label: 'the map fixes the origin', fields: compactFields([['A·0', '0 — linear maps keep the origin'], ['columns', 'where î and ĵ land = the columns of A']]) });
  picks.push({ name: 'grid:img', kind: 'matrix', label: `A = ${mfmt(M)}`, fields: compactFields([['det', info.det.toFixed(3)], ['trace', info.trace.toFixed(3)], ['rank', String(info.rank)], ['type', info.kind]]) });
  picks.push({ name: 'det', kind: 'det', label: `signed area = det = ${info.det.toFixed(3)}`, fields: compactFields([['> 0', 'orientation preserved'], ['< 0', 'orientation REVERSED (plane flipped)'], ['= 0', 'singular — not invertible'], ['here', info.det < 0 ? 'reversed' : info.det > EPS ? 'preserved' : 'singular']]) });
  picks.push({ name: 'svd', kind: 'svd', label: `circle → ellipse · σ = ${info.singular[0].toFixed(2)}, ${info.singular[1].toFixed(2)}`, fields: compactFields([['σ₁', info.singular[0].toFixed(3) + ' (max stretch)'], ['σ₂', info.singular[1].toFixed(3) + (info.singular[1] < EPS ? ' — collapse' : ' (min stretch)')], ['σ₁·σ₂', '= |det| = ' + Math.abs(info.det).toFixed(3)]]) });
  if (info.kind === 'complex') {
    picks.push({ name: 'eig:none', kind: 'eigen', label: 'no real eigenvector', fields: compactFields([['eigenvalues', `${info.trace / 2 === 0 ? '' : (info.trace / 2).toFixed(2) + ' '}± ${(Math.sqrt(-info.disc) / 2).toFixed(2)} i`], ['meaning', 'every vector rotates — no invariant axis in ℝ²']]) });
  } else {
    realEig.forEach((e, idx) => picks.push({ name: `eig:${idx}`, kind: 'eigen', label: `eigenvalue λ = ${e.lambda.toFixed(3)}`, fields: compactFields([['eigenvector', vfmt(e.vector)], ['on this line', `a vector only stretches by ${e.lambda.toFixed(2)}× — it never turns`], ...(info.kind === 'defective' ? [['note', 'DEFECTIVE: this is the only eigen-direction']] : [])]) }));
  }

  const fields = [readoutField([
    `Linear map  A = ${mfmt(M)}`,
    preset.blurb,
    `det = ${info.det.toFixed(2)} (area scale${info.det < 0 ? ', orientation flipped' : ''})  ·  trace = ${info.trace.toFixed(2)}  ·  rank ${info.rank}`,
    info.kind === 'complex'
      ? `eigenvalues ${(info.trace / 2).toFixed(2)} ± ${(Math.sqrt(-info.disc) / 2).toFixed(2)} i — complex, NO real invariant axis`
      : `eigenvalues ${realEig.map((e) => e.lambda.toFixed(2)).join(', ')} — invariant axes (purple) only stretch`,
    'faint grid = before · bright grid = after · red/green arrows = where î, ĵ land (the columns of A)',
    'the map is EXACT — only laying it flat on the plane is stylization',
  ])];

  return {
    faces, picks, tracers, fields,
    morph: live ? M : null,        // the 2×2 the deform channel carries the image groups to (identity → A)
    morphGroups: live ? morphGroups : [],
    bounds: { center: [0, 0, 0], radius: U * GRID * 1.5 },
    stats: { scenario: override ? 'custom' : scen, matrix: M, det: info.det, trace: info.trace, rank: info.rank, kind: info.kind, animate: live, eigenvalues: info.eigen.map((e) => (Math.abs(e.imag) < EPS ? e.lambda : `${e.lambda}±${Math.abs(e.imag)}i`)), singular: info.singular },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — orbiting the deformed plane.
 */
export function assembleTransformScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planTransformScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 0.45, -d * 1.4, d * 1.5], lookAt: [0, 0, 0], horizontalFov: 46 } },
    { name: 'top', worldFraming: { cameraPosition: [0, -d * 0.18, d * 2.6], lookAt: [0, 0, 0], horizontalFov: 44 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  // morph: carry every image group identity → A on the deform channel (pivot at the origin, which is
  // scale-invariant, so the same `to` matrix works regardless of render scale). Plays once, holds at A.
  const deforms = plan.morph
    ? plan.morphGroups.map((g) => ({ group: g, mode: 'morph', to: plan.morph, period: 2.6, hold: 1.6, loop: false, pivot: [0, 0, 0] }))
    : null;
  return {
    faces,
    picks: plan.picks,
    tracers,
    fields: plan.fields,
    ...(deforms ? { deforms } : {}),
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1040, height: 900 },
    title: title || recipe.title || `mojulo transform · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
