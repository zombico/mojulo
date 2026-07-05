/**
 * derivative-view — the DERIVATIVE as the slope of the tangent, reached as a LIMIT: a second point Q
 * slides toward a fixed point P and the SECANT line through them swings into the TANGENT. The fan of
 * secants for shrinking h converges visibly on one line, and the secant slope (Δy/Δx) converges on
 * f′(a). The single idea every intro-calculus student trips on, made a picture.
 *
 * One idea, four hats (the curve f):
 *   • parabola — f = x²   (f′ = 2x)
 *   • cubic     — f = x³   (f′ = 3x²)
 *   • sine      — f = sin x (f′ = cos x)
 *   • exp       — f = eˣ   (f′ = eˣ, slope = height)
 *
 * Built as baked `faces` (the curve, the secant fan, the tangent, a rise/run triangle) + a TRACER bead
 * riding the curve. No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'derivative-view', scenario?, at?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const lerp = (a, b, t) => a + (b - a) * t;

const _sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const _sV = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const _cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const _len = (a) => Math.hypot(a[0], a[1], a[2]);
const _norm = (a) => { const l = _len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function ribbon(a, b, w, fill, group, alpha) {
  const d = _sub(b, a); let p = _cross(d, [0, 0, 1]); if (_len(p) < 1e-3) p = _cross(d, [0, 1, 0]);
  p = _sV(_norm(p), w); return quad([_add(a, p), _add(b, p), _sub(b, p), _sub(a, p)], fill, group, alpha);
}
function box(c, h, fill, group) {
  const v = (sx, sy, sz) => [c[0] + sx * h, c[1] + sy * h, c[2] + sz * h];
  return [
    quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group),
    quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group),
    quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group),
    quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group),
    quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group),
    quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group),
  ];
}

const SCENARIOS = {
  parabola: { f: (x) => x * x, df: (x) => 2 * x, dom: [-3, 3], at: 1.1, title: 'f(x) = x²', dlabel: 'f′(x) = 2x' },
  cubic: { f: (x) => 0.34 * x * x * x, df: (x) => 1.02 * x * x, dom: [-2.6, 2.6], at: 1.0, title: 'f(x) = x³', dlabel: 'f′(x) = 3x²' },
  sine: { f: (x) => Math.sin(x), df: (x) => Math.cos(x), dom: [-Math.PI, Math.PI], at: 0.7, title: 'f(x) = sin x', dlabel: 'f′(x) = cos x' },
  exp: { f: (x) => Math.exp(x) - 1, df: (x) => Math.exp(x), dom: [-2.4, 1.8], at: 0.6, title: 'f(x) = eˣ', dlabel: 'f′(x) = eˣ (slope = height)' },
};
export const DERIVATIVE_SCENARIOS = Object.keys(SCENARIOS);

const U = 3.0;          // render units per math unit
const ZCLIP = 4.2;
const HSTEPS = [2.0, 1.2, 0.65, 0.28];   // shrinking secant gaps → the fan converging
const NSAMP = 240;

const COL = { axis: '#2c374f', curve: '#7bd6e8', tangent: '#ffd36a', point: '#ffe08a', q: '#9aa3b8', rise: '#ff6a6a', run: '#6ad29a' };

/**
 * Resolve a recipe → { faces, tracers, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planDerivativeScene(recipe = {}) {
  const scen = DERIVATIVE_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'parabola';
  const s = SCENARIOS[scen];
  const [x0, x1] = s.dom;
  const a = clampNum(recipe.at, x0 + 0.2, x1 - 0.2, s.at);
  const P2 = (x, y) => [x * U, 0, Math.max(-ZCLIP, Math.min(ZCLIP, y)) * U];
  const onCurve = (x) => P2(x, s.f(x));

  const faces = [];
  // axes.
  faces.push(ribbon(P2(x0, 0), P2(x1, 0), 0.02, COL.axis, 'axes', 0.5));
  faces.push(ribbon(P2(0, -ZCLIP), P2(0, ZCLIP), 0.02, COL.axis, 'axes', 0.5));

  // the curve.
  let prev = null;
  for (let i = 0; i <= NSAMP; i++) { const x = lerp(x0, x1, i / NSAMP), pt = onCurve(x); if (prev) faces.push(ribbon(prev, pt, 0.1, COL.curve, 'curve', 0.95)); prev = pt; }

  // the secant fan: a line through P and Q=a+h for shrinking h (faint far → bright near).
  const fa = s.f(a);
  const slopes = [];
  HSTEPS.forEach((h, idx) => {
    const xq = a + h, fq = s.f(xq), m = (fq - fa) / h; slopes.push(m);
    const t = idx / (HSTEPS.length - 1);                // 0 (far) → 1 (near)
    const ext = 0.8;                                    // extend the secant past both points
    const A = [a - ext, fa - m * ext], B = [xq + ext, fq + m * ext];
    faces.push(ribbon(P2(A[0], A[1]), P2(B[0], B[1]), 0.04 + 0.035 * t, `#b9c8e6`, `secant:${idx}`, 0.4 + 0.5 * t));
    faces.push(...box(onCurve(xq), 0.2, COL.q, `q:${idx}`));   // the sliding point Q
  });

  // the TANGENT (the limit) — brightest, and a rise/run triangle on it.
  const m0 = s.df(a), ext = 1.5;
  faces.push(ribbon(P2(a - ext, fa - m0 * ext), P2(a + ext, fa + m0 * ext), 0.07, COL.tangent, 'tangent', 0.95));
  const run = 1.2;
  faces.push(ribbon(onCurve(a), P2(a + run, fa), 0.05, COL.run, 'run', 0.9));            // Δx
  faces.push(ribbon(P2(a + run, fa), P2(a + run, fa + m0 * run), 0.05, COL.rise, 'rise', 0.9)); // Δy
  faces.push(...box(onCurve(a), 0.3, COL.point, 'point'));   // P

  const tracers = [{ path: Array.from({ length: 80 }, (_, k) => onCurve(lerp(x0, x1, k / 79))), color: [123, 214, 232], size: 0.42, period: 7, trail: 7, trailLag: 0.011 }];

  const picks = [
    { name: 'point', kind: 'point', label: `P = (${a.toFixed(2)}, ${fa.toFixed(2)})`, fields: compactFields([['tangent slope f′(a)', m0.toFixed(3)], ['rule', s.dlabel]]) },
    { name: 'tangent', kind: 'tangent', label: `slope of tangent = ${m0.toFixed(3)}`, fields: compactFields([['secant slopes →', slopes.map((m) => m.toFixed(2)).join(' → ')], ['limit', `as h→0, Δy/Δx → ${m0.toFixed(2)}`]]) },
  ];

  return {
    faces, tracers, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Derivative as a limit — ${s.title}`,
      'a second point Q slides toward P; the SECANT through them swings into the TANGENT',
      `secant slope Δy/Δx: ${slopes.map((m) => m.toFixed(2)).join(' → ')}  →  f′(${a.toFixed(1)}) = ${m0.toFixed(2)}`,
      `the tangent (gold) is the limit · rise/run = ${(m0 * run).toFixed(2)}/${run} = ${m0.toFixed(2)}  (${s.dlabel})`,
    ] }],
    bounds: { center: [a * U, 0, fa * U], radius: Math.max((x1 - x0) / 2, ZCLIP) * U * 1.15 },   // centre on P (the point of interest)
    stats: { scenario: scen, at: +a.toFixed(2), fAt: +fa.toFixed(3), slope: +m0.toFixed(3), secantSlopes: slopes.map((m) => +m.toFixed(3)) },
  };
}

// ── the exact read-back channel (measure_view, tier 'exact'). The math twin of the SI
// samplers: no units to be honest about, only "is this number the true value of the
// expression?" — and every value here is the implemented f/f′ evaluated directly, so yes.
// Returns the function pair over the domain plus the limit process itself (the secant
// slopes at the shrinking HSTEPS), which is the mathematically interesting data: the
// convergence of Δy/Δx onto f′(a). Note the sampled functions are the RENDERED ones (the
// cubic is 0.34x³ fitted to the frame) — exact with respect to the artifact, and the
// derivative identity dfx = d(fx)/dx holds exactly regardless of that scaling. ──
export function sampleDerivativeExact(recipe = {}, { every = 1 } = {}) {
  const scen = DERIVATIVE_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'parabola';
  const s = SCENARIOS[scen];
  const [x0, x1] = s.dom;
  const a = clampNum(recipe.at, x0 + 0.2, x1 - 0.2, s.at);
  const fa = s.f(a);
  const step = Math.max(1, Math.round(clampNum(every, 1, NSAMP, 1)));
  const samples = [];
  for (let i = 0; i <= NSAMP; i += step) {
    const x = lerp(x0, x1, i / NSAMP);
    samples.push({ x: +x.toFixed(9), fx: +s.f(x).toFixed(9), dfx: +s.df(x).toFixed(9) });
  }
  const secants = HSTEPS.map((h) => ({ h, slope: +(((s.f(a + h) - fa) / h)).toFixed(9) }));
  return {
    scenario: scen, label: s.title, rule: s.dlabel, domain: [x0, x1],
    at: +a.toFixed(9), fAt: +fa.toFixed(9), slope: +s.df(a).toFixed(9),
    secants,
    units: { x: 'dimensionless', fx: 'dimensionless', dfx: 'dimensionless' },
    samples, count: samples.length,
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a front camera on the x–z plane.
 */
export function assembleDerivativeScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planDerivativeScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  // centre on P (the tangent point — the thing to look at); size from the geometry extent.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const ctr = sc(plan.bounds.center), d = 0.55 * Math.hypot(mx[0] - mn[0], mx[2] - mn[2]);

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.2, ctr[2]], lookAt: ctr, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.35, -d * 1.7, ctr[2] + d * 0.6], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces, picks: plan.picks, tracers, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 760 },
    title: title || recipe.title || `mojulo derivative · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
