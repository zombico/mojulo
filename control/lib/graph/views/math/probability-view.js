/**
 * probability-view — a GALTON BOARD: balls drop through a triangle of pegs, bounce left/right at each
 * row, and pile into bins that form a BELL CURVE. The Central Limit Theorem made visceral — a sum of
 * many independent coin-flips is binomial, and the binomial → the normal. The bars are the EXACT
 * binomial distribution C(n,k)·pᵏ(1−p)ⁿ⁻ᵏ; a smooth Gaussian is overlaid so you see the bars approach it.
 *
 * One idea, four hats, with `few` (see the discrete coefficients) and `skew` (p≠½) as the contrasts:
 *   • few     — 6 rows: a chunky histogram where you can read C(6,k) = 1,6,15,20,15,6,1 directly
 *   • classic  — 12 rows, fair: the clean symmetric bell (the flagship)
 *   • tall     — 20 rows: finer bins, visibly smoother — closer to the continuous normal
 *   • skew     — 14 rows, biased pegs (p = 0.66): the bell SHIFTS right and goes asymmetric (binomial, p≠½)
 *
 * Built as baked `faces` (pegs, bars, the Gaussian overlay) + the TRACER channel (balls zig-zagging down,
 * deterministic pseudo-random so the render is reproducible). No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'probability-view', scenario?, rows?, p?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

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
// an upright bar in the x–z plane (a histogram column).
const bar = (cx, w, z0, z1, fill, group) => quad([[cx - w, 0, z0], [cx + w, 0, z0], [cx + w, 0, z1], [cx - w, 0, z1]], fill, group);
function dot(c, h, fill, group) {
  const v = (sx, sz) => [c[0] + sx * h, 0, c[2] + sz * h];
  return quad([v(-1, -1), v(1, -1), v(1, 1), v(-1, 1)], fill, group);
}

// exact log binomial coefficient (stable for the row counts we use) → pmf without overflow.
function binomPmf(n, p) {
  const logf = (m) => { let s = 0; for (let i = 2; i <= m; i++) s += Math.log(i); return s; };
  const out = [];
  for (let k = 0; k <= n; k++) {
    const logC = logf(n) - logf(k) - logf(n - k);
    out.push(Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p)));
  }
  return out;
}
// deterministic pseudo-random in [0,1) from two ints (GLSL-style hash — no Math.random, reproducible).
const hash01 = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

const SCENARIOS = {
  few: { rows: 6, p: 0.5, title: '6 rows — read the coefficients', blurb: 'a chunky histogram: the bins are exactly C(6,k) = 1, 6, 15, 20, 15, 6, 1 — the binomial, before it looks "normal"' },
  classic: { rows: 12, p: 0.5, title: '12 rows — the bell', blurb: 'twelve fair left/right flips per ball: the counts trace a clean symmetric bell (binomial → normal)' },
  tall: { rows: 20, p: 0.5, title: '20 rows — toward the normal', blurb: 'more rows ⇒ finer bins and a smoother bell — the binomial visibly approaching the continuous Gaussian' },
  skew: { rows: 14, p: 0.66, title: '14 rows — biased pegs', blurb: 'the pegs lean right (p = 0.66): the bell SHIFTS toward higher bins and goes asymmetric (binomial with p ≠ ½)' },
};
export const PROBABILITY_SCENARIOS = Object.keys(SCENARIOS);

const SP = 1.15;        // peg / bin spacing
const BAR_MAX = 7.0;    // render height of the tallest bar
const ROW_H = 0.95;     // vertical gap between peg rows

/**
 * Resolve a recipe → { faces, tracers, picks, bounds, stats }. Pure, deterministic.
 */
export function planProbabilityScene(recipe = {}) {
  const scen = PROBABILITY_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'classic';
  const s = SCENARIOS[scen];
  const n = Math.round(clampNum(recipe.rows, 3, 24, s.rows));
  const p = clampNum(recipe.p, 0.1, 0.9, s.p);

  const pmf = binomPmf(n, p);
  const maxPmf = Math.max(...pmf);
  const binX = (k) => (k - n / 2) * SP;            // bin k centre, x
  const pegFloor = BAR_MAX + 0.9;                  // bars live below this; pegs above
  const faces = [];

  // ── histogram bars: height ∝ the exact binomial pmf; coloured by height (the bell) ──
  const LOW = [70, 96, 150], HIGH = [232, 196, 96];
  for (let k = 0; k <= n; k++) {
    const h = BAR_MAX * (pmf[k] / maxPmf);
    faces.push(bar(binX(k), SP * 0.42, 0, h, hex(lerp3(LOW, HIGH, pmf[k] / maxPmf)), `bin:${k}`));
  }

  // ── pegs: a triangle, row r has r+1 pegs ──
  for (let r = 0; r < n; r++) {
    const z = pegFloor + r * ROW_H;
    for (let j = 0; j <= r; j++) faces.push(dot([(j - r / 2) * SP, 0, z], 0.12, '#7e8aa6', 'pegs'));
  }

  // ── the continuous Gaussian the bars approach: mean np, variance np(1−p), scaled to the peak bar ──
  const mu = n * p, sigma = Math.sqrt(n * p * (1 - p));
  const gAt = (kf) => Math.exp(-((kf - mu) ** 2) / (2 * sigma * sigma));   // peak 1 at kf = mu
  let prevG = null;
  for (let i = 0; i <= 120; i++) {
    const kf = lerp(-0.5, n + 0.5, i / 120), gz = BAR_MAX * gAt(kf);        // peaks at BAR_MAX, matching the tallest bar
    const pt = [binX(kf), 0, gz];
    if (prevG) faces.push(ribbon(prevG, pt, 0.06, '#f0d27a', 'gaussian', 0.95));
    prevG = pt;
  }

  // ── falling balls: deterministic zig-zag down the pegs (the random walk that sums to a bin) ──
  const tracers = [];
  const NBALL = 7;
  for (let b = 0; b < NBALL; b++) {
    const path = [[0, 0, pegFloor + (n - 1) * ROW_H + 1.1]];
    let x = 0, rights = 0;
    for (let r = n - 1; r >= 0; r--) {
      const goRight = hash01(b + 1, r + 1) < p; if (goRight) rights++;
      x += (goRight ? 0.5 : -0.5) * SP;
      path.push([x, 0, pegFloor + r * ROW_H]);
    }
    path.push([binX(rights), 0, BAR_MAX * (pmf[Math.max(0, Math.min(n, rights))] / maxPmf) + 0.4]);
    tracers.push({ path, color: [122 + b * 14, 200 - b * 8, 232], size: 0.42, period: 5 + b * 0.4, trail: 6, trailLag: 0.012 });
  }

  // faint baseline.
  faces.push(ribbon([binX(0) - SP, 0, 0], [binX(n) + SP, 0, 0], 0.03, '#33405e', 'axes', 0.4));

  const picks = [
    { name: 'bin:' + Math.round(mu), kind: 'bin', label: `peak bin ≈ ${Math.round(mu)} (mean = np = ${mu.toFixed(1)})`, fields: compactFields([['distribution', 'binomial C(n,k)·pᵏ(1−p)ⁿ⁻ᵏ'], ['rows n', String(n)], ['p (go right)', p.toFixed(2)], ['σ', `√(np(1−p)) = ${sigma.toFixed(2)}`]]) },
  ];

  return {
    faces, tracers, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Galton board — ${s.title}`,
      s.blurb,
      `each ball makes ${n} left/right choices (p = ${p.toFixed(2)} right) → it lands in bin = #rights`,
      'the bars are the exact binomial · the gold curve is the Gaussian they approach (the CLT)',
    ] }],
    bounds: { center: [0, 0, (pegFloor + (n - 1) * ROW_H) / 2], radius: Math.max((n / 2 + 1) * SP, (pegFloor + n * ROW_H) / 2) * 1.15 },
    stats: { scenario: scen, rows: n, p, mean: +mu.toFixed(2), sigma: +sigma.toFixed(2), peakBin: Math.round(mu) },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a front camera on the board (+ a 3/4).
 */
export function assembleProbabilityScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planProbabilityScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const ctr = sc(plan.bounds.center), d = plan.bounds.radius * scale;

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.5, ctr[2]], lookAt: ctr, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.5, -d * 1.9, ctr[2] + d * 0.3], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces,
    picks: plan.picks,
    tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1040, height: 900 },
    title: title || recipe.title || `mojulo galton · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
