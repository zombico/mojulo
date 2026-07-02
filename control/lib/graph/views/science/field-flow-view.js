/**
 * field-flow-view — a VECTOR FIELD on the plane, the math sibling that makes vector calculus & ODEs
 * visible: a lattice of arrows (which way, how hard a particle is pushed at each point), the STREAMLINES
 * that thread them, and tracer beads that DRIFT along the flow so you watch the dynamics, not a snapshot.
 *
 * Every scenario is a LINEAR field F(x,y) = A·[x,y], which is the bridge to transform-view: the phase
 * portrait's whole character — source / sink / saddle / centre / spiral — is decided by the EIGENVALUES
 * of A (the same classifyMatrix engine). divergence = trace(A) (how much flows OUT), curl = A₂₁−A₁₂ (how
 * much it SPINS). One idea, five hats, with the saddle as the hyperbolic control:
 *   • source  — A=[[1,0],[0,1]]     eig +1,+1   arrows radiate OUT (div>0, curl 0)
 *   • sink     — A=[[-1,0],[0,-1]]   eig −1,−1   arrows flow IN; curl-free ⇒ a gradient/descent field
 *   • vortex   — A=[[0,-1],[1,0]]    eig ±i      arrows CIRCLE; nothing in/out (div 0, curl>0) — a centre
 *   • saddle   — A=[[1,0],[0,-1]]    eig +1,−1   IN one axis, OUT the other (the hyperbolic control)
 *   • spiral   — A=[[-1,-2],[2,-1]]  eig −1±2i   rotate AND decay → trajectories spiral into the origin
 *
 * Rides emitThreeWorld's FIELDS channel (static arrows + streamline polylines) + the TRACER channel (the
 * drifting particles) + a faces fixed-point marker. No new renderer primitive. Sibling of field-view.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'field-flow-view', scenario?, matrix?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

import { classifyMatrix } from '../math/transform-view.js';

const TAU = Math.PI * 2;
const EPS = 1e-9;
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));

// ── tiny face helpers (the fixed-point marker + faint axes; arrows/lines ride the fields channel) ──
const _sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const _sV = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const _cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const _len = (a) => Math.hypot(a[0], a[1], a[2]);
const _norm = (a) => { const l = _len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const _quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function _box(c, h, fill, group, alpha) {
  const v = (sx, sy, sz) => [c[0] + sx * h, c[1] + sy * h, c[2] + sz * h];
  return [
    _quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha),
    _quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),
    _quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha),
  ];
}
function _ribbon(a, b, w, fill, group, alpha) {
  const d = _sub(b, a); let p = _cross(d, [0, 0, 1]); if (_len(p) < 1e-3) p = _cross(d, [0, 1, 0]);
  p = _sV(_norm(p), w); return _quad([_add(a, p), _add(b, p), _sub(b, p), _sub(a, p)], fill, group, alpha);
}

const SCENARIOS = {
  source: { matrix: [[1, 0], [0, 1]], title: 'source — arrows radiate out', blurb: 'an unstable node: every nearby particle is pushed AWAY from the origin (divergence > 0, no spin)' },
  sink: { matrix: [[-1, 0], [0, -1]], title: 'sink — arrows flow in', blurb: 'a stable node, curl-free ⇒ a GRADIENT field: every arrow points downhill to the minimum (gradient descent)' },
  vortex: { matrix: [[0, -1], [1, 0]], title: 'vortex — arrows circle', blurb: 'a centre: pure rotation, nothing flows in or out (divergence 0, curl > 0) — orbits are closed loops' },
  saddle: { matrix: [[1, 0], [0, -1]], title: 'saddle — in one way, out the other', blurb: 'the hyperbolic control: stable along one axis, unstable along the other — most particles sweep past' },
  spiral: { matrix: [[-1, -2], [2, -1]], title: 'spiral — rotate and decay', blurb: 'complex eigenvalues with negative real part: trajectories ROTATE while DECAYING — they spiral into the origin' },
};
export const FIELD_FLOW_SCENARIOS = Object.keys(SCENARIOS);

function parseMatrix(m) {
  if (!Array.isArray(m) || m.length !== 2) return null;
  const row = (r) => Array.isArray(r) && r.length === 2 && Number.isFinite(+r[0]) && Number.isFinite(+r[1]);
  if (!row(m[0]) || !row(m[1])) return null;
  return [[+m[0][0], +m[0][1]], [+m[1][0], +m[1][1]]];
}

const U = 3.0;     // render units per field unit
const D = 4;       // field domain: [−D, D]²
const P = ([x, y]) => [x * U, y * U, 0];
const fieldAt = (A, [x, y]) => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y];
const mfmt = (M) => `[[${(+M[0][0]).toFixed(1)}, ${(+M[0][1]).toFixed(1)}], [${(+M[1][0]).toFixed(1)}, ${(+M[1][1]).toFixed(1)}]]`;

// RK4 streamline through `seed`, integrated `dir`-time (±1). Stops on leaving the (padded) domain or
// collapsing into the fixed point. Pure — the field is autonomous so the curve is deterministic.
function streamline(A, seed, dir, dt, steps) {
  const f = (p) => fieldAt(A, p);
  const pts = [seed.slice()]; let p = seed.slice();
  for (let i = 0; i < steps; i++) {
    const h = dir * dt;
    const k1 = f(p);
    const k2 = f([p[0] + 0.5 * h * k1[0], p[1] + 0.5 * h * k1[1]]);
    const k3 = f([p[0] + 0.5 * h * k2[0], p[1] + 0.5 * h * k2[1]]);
    const k4 = f([p[0] + h * k3[0], p[1] + h * k3[1]]);
    p = [p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    if (Math.abs(p[0]) > D * 1.25 || Math.abs(p[1]) > D * 1.25) break;
    if (Math.hypot(p[0], p[1]) < 0.04) { pts.push(p); break; }
    pts.push(p);
  }
  return pts;
}
// a full streamline through a seed: integrate backward then forward, concatenated in flow-time order.
function fullStreamline(A, seed, dt, steps) {
  const bwd = streamline(A, seed, -1, dt, steps).reverse();
  const fwd = streamline(A, seed, +1, dt, steps);
  return [...bwd, ...fwd.slice(1)];
}
// resample a polyline to exactly n points (so a tracer bead rides it at even speed).
function resample(pts, n) {
  if (pts.length < 2) return Array.from({ length: n }, () => pts[0] || [0, 0]);
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  const out = []; let acc = 0, j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (j < seg.length && acc + seg[j] < target) { acc += seg[j]; j++; }
    const t = seg[j] ? (target - acc) / seg[j] : 0, a = pts[j], b = pts[Math.min(j + 1, pts.length - 1)];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// flow type from A's eigenvalues (the transform-view engine) → a phase-portrait label + the marker hue.
function classifyFlow(A) {
  const info = classifyMatrix(A);
  const div = A[0][0] + A[1][1];      // trace
  const curl = A[1][0] - A[0][1];
  let type, color;
  if (info.kind === 'complex') {
    const re = info.eigen[0].lambda;
    if (Math.abs(re) < 1e-6) { type = 'centre — closed orbits'; color = '#b07cec'; }
    else if (re < 0) { type = 'spiral sink — rotate & decay'; color = '#5fb6d6'; }
    else { type = 'spiral source — rotate & grow'; color = '#e08a5a'; }
  } else {
    const ls = info.eigen.map((e) => e.lambda);
    if (ls.every((l) => l > EPS)) { type = 'unstable node (source)'; color = '#e0606a'; }
    else if (ls.every((l) => l < -EPS)) { type = 'stable node (sink)'; color = '#5fa9e0'; }
    else if (ls.some((l) => l > EPS) && ls.some((l) => l < -EPS)) { type = 'saddle (hyperbolic)'; color = '#e0b15f'; }
    else { type = 'degenerate / shear'; color = '#9aa3b8'; }
  }
  return { info, div, curl, type, color };
}

/**
 * Resolve a recipe → { faces, fields, tracers, picks, bounds, stats }. Pure, deterministic.
 */
export function planFieldFlowScene(recipe = {}) {
  const override = parseMatrix(recipe.matrix);
  const scen = FIELD_FLOW_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'spiral';
  const preset = SCENARIOS[scen];
  const A = override || preset.matrix;
  const flow = classifyFlow(A);

  // ── arrow lattice: dir = F̂, length modulated by |F| but bounded so the grid stays legible ──
  const samples = [];
  let mMax = EPS;
  const grid = [];
  for (let gx = -D; gx <= D; gx++) for (let gy = -D; gy <= D; gy++) {
    if (gx === 0 && gy === 0) continue;
    const F = fieldAt(A, [gx, gy]); const m = Math.hypot(F[0], F[1]);
    grid.push({ at: [gx, gy], F, m }); if (m > mMax) mMax = m;
  }
  for (const g of grid) {
    if (g.m < EPS) continue;
    const len = U * (0.34 + 0.46 * Math.tanh(g.m / (mMax * 0.5)));   // bounded: ~0.34U … 0.8U
    samples.push({ pos: P(g.at), dir: [g.F[0], g.F[1], 0], amp: len });
  }

  // ── streamlines through a ring of seeds (both time directions) → static field-line polylines ──
  const lines = [];
  const SEEDS = 12, rSeed = D * 0.62;
  const streams = [];
  for (let k = 0; k < SEEDS; k++) {
    const a = (k / SEEDS) * TAU;
    const sl = fullStreamline(A, [Math.cos(a) * rSeed, Math.sin(a) * rSeed], 0.035, 150);
    if (sl.length > 3) { streams.push(sl); lines.push({ pts: sl.map((p) => P(p)), color: parseInt(flow.color.slice(1), 16), opacity: 0.4 }); }
  }

  // ── tracer beads: a few particles DRIFTING along the flow (the dynamics, not a snapshot) ──
  const tracers = [];
  const beadCol = flow.color.match(/[0-9a-f]{2}/g).map((h) => parseInt(h, 16));
  for (let i = 0; i < Math.min(4, streams.length); i++) {
    const sl = streams[Math.floor((i + 0.5) * streams.length / 4)];
    tracers.push({ path: resample(sl, 40).map((p) => P(p)), color: beadCol, size: 0.5, period: 6, trail: 7, trailLag: 0.012 });
  }

  // ── faint axes + the fixed-point marker (coloured by stability) ──
  const faces = [];
  faces.push(_ribbon(P([-D * 1.2, 0]), P([D * 1.2, 0]), 0.04, '#2c374f', 'axes', 0.3));
  faces.push(_ribbon(P([0, -D * 1.2]), P([0, D * 1.2]), 0.04, '#2c374f', 'axes', 0.3));
  faces.push(..._box([0, 0, 0], 0.42, flow.color, 'fixed'));

  const e = flow.info.eigen;
  const eigStr = flow.info.kind === 'complex'
    ? `${e[0].lambda.toFixed(2)} ± ${Math.abs(e[0].imag).toFixed(2)} i`
    : e.map((x) => x.lambda.toFixed(2)).join(', ');

  const picks = [
    { name: 'fixed', kind: 'fixed-point', label: `fixed point — ${flow.type}`, fields: compactFields([['eigenvalues of A', eigStr], ['divergence (trace)', flow.div.toFixed(2)], ['curl', flow.curl.toFixed(2)]]) },
  ];

  const fields = [{
    animate: false,
    sets: [{ color: parseInt(flow.color.slice(1), 16), samples }],
    lines,
    readout: [
      `Vector field  F(x,y) = A·[x,y],  A = ${mfmt(A)}`,
      preset.blurb,
      `eigenvalues of A: ${eigStr}  →  ${flow.type}`,
      `divergence = ${flow.div.toFixed(1)} (flow out)  ·  curl = ${flow.curl.toFixed(1)} (spin)`,
      'arrows = the push at each point · lines = streamlines · the glowing beads DRIFT along the flow',
    ],
  }];

  return {
    faces, fields, tracers, picks,
    bounds: { center: [0, 0, 0], radius: U * D * 1.25 },
    stats: { scenario: override ? 'custom' : scen, matrix: A, div: flow.div, curl: flow.curl, type: flow.type, eigenvalues: e.map((x) => (Math.abs(x.imag) < EPS ? x.lambda : `${x.lambda}±${Math.abs(x.imag)}i`)) },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — top-down on the phase plane (+ a 3/4 for relief).
 */
export function assembleFieldFlowScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planFieldFlowScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const fields = plan.fields.map((fd) => ({
    ...fd,
    sets: fd.sets.map((st) => ({ ...st, samples: st.samples.map((s) => ({ ...s, pos: sc(s.pos), amp: s.amp * scale })) })),
    lines: fd.lines.map((ln) => ({ ...ln, pts: ln.pts.map(sc) })),
  }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: 'top', worldFraming: { cameraPosition: [d * 0.05, -d * 0.18, d * 2.4], lookAt: [0, 0, 0], horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [d * 0.5, -d * 1.4, d * 1.1], lookAt: [0, 0, 0], horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces,
    picks: plan.picks,
    fields,
    tracers,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1040, height: 900 },
    title: title || recipe.title || `mojulo field flow · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
