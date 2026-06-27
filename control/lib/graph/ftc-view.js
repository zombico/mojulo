/**
 * ftc-view — the FUNDAMENTAL THEOREM OF CALCULUS, the deep link between the two halves of calculus, in
 * two stacked panels. TOP: a function f(t) with the AREA from 0 to x shaded. BOTTOM: the area-so-far
 * function A(x) = ∫₀ˣ f. The punchline: the RATE the area grows = the HEIGHT of f at x = the SLOPE of A
 * at x. So A′(x) = f(x): differentiating the area gives back the function. The red height bar up top and
 * the gold tangent slope down below are the SAME number — that equality is the theorem.
 *
 * One idea, four hats (the integrand f):
 *   • constant — f = 1     → area grows steadily → A = x (a straight line, constant slope)
 *   • linear    — f = t     → area is a triangle → A = x²/2 (slope rises as f rises)
 *   • sine      — f = sin t → A = 1 − cos t  (where f dips below 0, the area — and A — go DOWN)
 *   • square    — f = t²    → A = x³/3
 *
 * Built as baked `faces` (the curve, the shaded area, the A-curve, the height bar + tangent) + TRACER
 * beads riding f and A in sync. No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'ftc-view', scenario?, at?, scale?, viewBox?, scene?:{ bg? }, title? }
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
  constant: { f: () => 1, F: (x) => x, dom: [0, 3.2], at: 1.9, title: 'f(t) = 1', Alabel: 'A(x) = x' },
  linear: { f: (t) => t, F: (x) => x * x / 2, dom: [0, 3.0], at: 1.9, title: 'f(t) = t', Alabel: 'A(x) = x²/2' },
  sine: { f: (t) => Math.sin(t), F: (x) => 1 - Math.cos(x), dom: [0, Math.PI * 1.5], at: 2.0, title: 'f(t) = sin t', Alabel: 'A(x) = 1 − cos x' },
  square: { f: (t) => t * t, F: (x) => x * x * x / 3, dom: [0, 2.2], at: 1.5, title: 'f(t) = t²', Alabel: 'A(x) = x³/3' },
};
export const FTC_SCENARIOS = Object.keys(SCENARIOS);

const XS = 5.2;         // render units per x unit
const FS = 2.6;         // render units per f unit (top panel)
const AS = 1.9;         // render units per A unit (bottom panel)
const TOPZ = 4.0;       // top panel baseline z
const BOTZ = -5.0;      // bottom panel baseline z
const NS = 200;

const COL = { axis: '#2c374f', curve: '#7bd6e8', area: '#2f6f6a', sweep: '#e6c45a', height: '#ff6a6a', acurve: '#f3f6fb', tangent: '#ffd36a', run: '#6ad29a' };

/**
 * Resolve a recipe → { faces, tracers, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planFtcScene(recipe = {}) {
  const scen = FTC_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'linear';
  const s = SCENARIOS[scen];
  const [x0, x1] = s.dom;
  const x = clampNum(recipe.at, x0 + 0.2, x1 - 0.05, s.at);
  const TX = (t) => t * XS;
  const topAt = (t) => [TX(t), 0, TOPZ + s.f(t) * FS];
  const botAt = (t) => [TX(t), 0, BOTZ + s.F(t) * AS];

  const faces = [];
  // panel baselines / axes.
  faces.push(ribbon([TX(x0), 0, TOPZ], [TX(x1), 0, TOPZ], 0.03, COL.axis, 'axes', 0.6));
  faces.push(ribbon([TX(x0), 0, BOTZ], [TX(x1), 0, BOTZ], 0.03, COL.axis, 'axes', 0.6));

  // TOP: the area from 0 to x, shaded as vertical strips up to f(t).
  const STRIPS = 64;
  for (let i = 0; i < STRIPS; i++) {
    const ta = lerp(x0, x, i / STRIPS), tb = lerp(x0, x, (i + 1) / STRIPS);
    faces.push(quad([[TX(ta), 0, TOPZ], [TX(tb), 0, TOPZ], [TX(tb), 0, TOPZ + s.f(tb) * FS], [TX(ta), 0, TOPZ + s.f(ta) * FS]], COL.area, 'area', 0.6));
  }
  // TOP: the curve f(t).
  let prev = null;
  for (let i = 0; i <= NS; i++) { const t = lerp(x0, x1, i / NS), pt = topAt(t); if (prev) faces.push(ribbon(prev, pt, 0.08, COL.curve, 'fcurve', 0.95)); prev = pt; }
  // TOP: the height bar f(x) (red) — the RATE the area is growing right now.
  faces.push(ribbon([TX(x), 0, TOPZ], [TX(x), 0, TOPZ + s.f(x) * FS], 0.09, COL.height, 'height', 1));
  faces.push(...box(topAt(x), 0.22, '#ffd0d0', 'fpoint'));

  // BOTTOM: the area-so-far curve A(x).
  prev = null;
  for (let i = 0; i <= NS; i++) { const t = lerp(x0, x1, i / NS), pt = botAt(t); if (prev) faces.push(ribbon(prev, pt, 0.08, COL.acurve, 'acurve', 0.95)); prev = pt; }
  // BOTTOM: the point at (x, A(x)) and the TANGENT there — its slope is f(x).
  const Ax = s.F(x), m = s.f(x);                         // A′(x) = f(x), the theorem
  const ext = 0.9;
  const bp = botAt(x);
  // tangent in render space: rise = AS·f(x)·Δt, run = XS·Δt → drawn from the point.
  const tA = [TX(x - ext), BOTZ + (Ax - m * ext) * AS], tB = [TX(x + ext), BOTZ + (Ax + m * ext) * AS];
  faces.push(ribbon([tA[0], 0, tA[1]], [tB[0], 0, tB[1]], 0.08, COL.tangent, 'tangent', 1));
  faces.push(...box(bp, 0.26, '#ffe08a', 'apoint'));

  // the sweep line linking the two panels at x.
  faces.push(ribbon([TX(x), 0, TOPZ + s.f(x) * FS], [TX(x), 0, BOTZ + Ax * AS], 0.03, COL.sweep, 'sweep', 0.5));

  // synced beads riding f and A.
  const fP = Array.from({ length: 80 }, (_, k) => topAt(lerp(x0, x1, k / 79)));
  const aP = Array.from({ length: 80 }, (_, k) => botAt(lerp(x0, x1, k / 79)));
  const tracers = [
    { path: fP, color: [123, 214, 232], size: 0.4, period: 8, trail: 7, trailLag: 0.01 },
    { path: aP, color: [243, 246, 251], size: 0.4, period: 8, trail: 7, trailLag: 0.01 },
  ];

  const picks = [
    { name: 'height', kind: 'rate', label: `f(${x.toFixed(1)}) = ${m.toFixed(2)} — the rate the area grows`, fields: compactFields([['this height', m.toFixed(3)], ['equals', 'the slope of A below']]) },
    { name: 'tangent', kind: 'slope', label: `A′(${x.toFixed(1)}) = ${m.toFixed(2)} — the slope of the area function`, fields: compactFields([['area so far', `A(${x.toFixed(1)}) = ${Ax.toFixed(3)}`], ['slope', m.toFixed(3)], ['theorem', 'A′(x) = f(x)']]) },
  ];

  return {
    faces, tracers, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Fundamental Theorem — ${s.title},  ${s.Alabel}`,
      'TOP: the shaded area from 0 to x · BOTTOM: that area plotted as A(x)',
      `the red height f(${x.toFixed(1)}) = ${m.toFixed(2)} is exactly the slope of the gold tangent below`,
      'so A′(x) = f(x): differentiating the area gives the function back',
    ] }],
    bounds: { center: [TX((x0 + x1) / 2), 0, (TOPZ + BOTZ) / 2], radius: Math.max(TX(x1 - x0) / 2, (TOPZ - BOTZ) / 2) * 1.15 },
    stats: { scenario: scen, at: +x.toFixed(2), fAt: +m.toFixed(3), areaAt: +Ax.toFixed(3) },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a front camera on the two stacked panels.
 */
export function assembleFtcScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planFtcScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const ctr = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2], d = 0.55 * Math.hypot(mx[0] - mn[0], mx[2] - mn[2]);

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.0, ctr[2]], lookAt: ctr, horizontalFov: 48 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.3, -d * 1.6, ctr[2] + d * 0.4], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces, picks: plan.picks, tracers, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 920 },
    title: title || recipe.title || `mojulo FTC · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
