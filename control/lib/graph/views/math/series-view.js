/**
 * series-view — APPROXIMATION made visible: a true curve y = f(x) and a family of partial sums that
 * hug it ever more closely as terms accrete. This is analysis — Taylor & Fourier series, convergence,
 * and the interval where it all holds. Drawn as ribbons in the x–z plane (orbit-able), the true curve
 * bright, the partial sums cool → warm by term count so "more terms ⇒ closer" reads at a glance.
 *
 * One idea, five hats, with the geometric series as the divergence control:
 *   • taylor-sin  — sin x ≈ x − x³/3! + x⁵/5! − …  (a polynomial chasing a wave; good near 0, drifts far out)
 *   • taylor-exp  — eˣ ≈ 1 + x + x²/2! + …          (converges everywhere, fast)
 *   • geometric   — 1/(1−x) = 1 + x + x² + …         (CONVERGES only for |x| < 1 — the control: it DIVERGES outside)
 *   • fourier-square — a square wave from odd sines   (smooth waves building a JUMP — the Gibbs overshoot)
 *   • fourier-saw    — a sawtooth from Σ sin(kx)/k    (a ramp + a cliff from pure tones)
 *
 * Built as baked `faces` (curve ribbons) + a tracer bead riding the true curve. No new renderer
 * primitive. Sibling of transform-view / field-flow-view / surface-view.
 *
 * Stored manifest IS the recipe:
 *   { kind:'series-view', scenario?, terms?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
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

const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

// each scenario: the true function `f`, a partial-sum `S(n,x)` (n TERMS), the term counts to draw, the
// x-domain, and a one-line teaching blurb. partial sums are exact (no fudge) so convergence is honest.
const SCENARIOS = {
  'taylor-sin': {
    f: Math.sin, S: (n, x) => { let s = 0; for (let k = 0; k < n; k++) s += (k % 2 ? -1 : 1) * x ** (2 * k + 1) / fact(2 * k + 1); return s; },
    terms: [1, 2, 3, 5], dom: [-7, 7], title: 'Taylor: sin x', blurb: 'a polynomial chasing a wave — each odd power buys a wider stretch of agreement, but it always drifts off far out',
  },
  'taylor-exp': {
    f: Math.exp, S: (n, x) => { let s = 0; for (let k = 0; k < n; k++) s += x ** k / fact(k); return s; },
    terms: [1, 2, 3, 5], dom: [-3, 3], title: 'Taylor: eˣ', blurb: 'converges everywhere and fast: a handful of terms already hugs the exponential across the frame',
  },
  geometric: {
    f: (x) => 1 / (1 - x), S: (n, x) => { let s = 0; for (let k = 0; k < n; k++) s += x ** k; return s; },
    terms: [2, 4, 8, 16], dom: [-1.35, 0.92], title: 'Geometric: 1/(1−x)', blurb: 'the CONTROL: 1 + x + x² + … equals 1/(1−x) only for |x| < 1 — past x = 1 every partial sum DIVERGES',
  },
  'fourier-square': {
    f: (x) => (Math.sin(x) >= 0 ? 1 : -1), S: (n, x) => { let s = 0; for (let k = 1; k <= n; k++) { const m = 2 * k - 1; s += Math.sin(m * x) / m; } return (4 / Math.PI) * s; },
    terms: [1, 3, 6, 14], dom: [-7, 7], title: 'Fourier: square wave', blurb: 'smooth sine waves building a sharp JUMP — note the stubborn overshoot at each edge (the Gibbs phenomenon)',
  },
  'fourier-saw': {
    f: (x) => { let t = ((x + Math.PI) % TAU + TAU) % TAU - Math.PI; return t / Math.PI; }, S: (n, x) => { let s = 0; for (let k = 1; k <= n; k++) s += (k % 2 ? 1 : -1) * Math.sin(k * x) / k; return (2 / Math.PI) * s; },
    terms: [2, 4, 8, 16], dom: [-7, 7], title: 'Fourier: sawtooth', blurb: 'a ramp-and-cliff built from pure tones Σ sin(kx)/k — more harmonics sharpen the ramp and the drop',
  },
};
export const SERIES_SCENARIOS = Object.keys(SCENARIOS);

const U = 1.7;          // render units per x unit
const ZCLIP = 3.2;      // clip |f| to this (partial sums blow up outside convergence)
const SAMP = 360;

/**
 * Resolve a recipe → { faces, tracers, picks, bounds, stats }. Pure, deterministic.
 */
export function planSeriesScene(recipe = {}) {
  const scen = SERIES_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'taylor-sin';
  const s = SCENARIOS[scen];
  const [x0, x1] = s.dom;
  const P = (x, z) => [x * U, 0, Math.max(-ZCLIP, Math.min(ZCLIP, z)) * U];

  // sample a curve fn(x) across the domain → a ribbon (broken where it leaves the clip window).
  const curveRibbons = (fn, w, fill, group, alpha) => {
    const faces = []; let prev = null, prevInside = false;
    for (let i = 0; i <= SAMP; i++) {
      const x = lerp(x0, x1, i / SAMP), z = fn(x), inside = Math.abs(z) <= ZCLIP * 1.001;
      const pt = P(x, z);
      if (prev && inside && prevInside) faces.push(ribbon(prev, pt, w, fill, group, alpha));   // break the line where it leaves the window
      prev = pt; prevInside = inside;
    }
    return faces;
  };

  const faces = [];
  // faint axes (x across, y/vertical = z).
  faces.push(ribbon(P(x0, 0), P(x1, 0), 0.02, '#36425e', 'axes', 0.4));
  faces.push(ribbon(P(0, -ZCLIP), P(0, ZCLIP), 0.02, '#36425e', 'axes', 0.4));

  // partial sums, cool (few terms) → warm (many terms); each its own group for a pick.
  const COOL = [88, 132, 210], WARM = [230, 150, 70];
  const picks = [];
  s.terms.forEach((n, idx) => {
    const t = s.terms.length > 1 ? idx / (s.terms.length - 1) : 1;
    const col = hex(lerp3(COOL, WARM, t));
    faces.push(...curveRibbons((x) => s.S(n, x), 0.05 + 0.02 * t, col, `approx:${n}`, 0.85));
    picks.push({ name: `approx:${n}`, kind: 'approx', label: `${n}-term partial sum`, fields: compactFields([['terms', String(n)], ['colour', t < 0.5 ? 'cooler = fewer terms' : 'warmer = more terms']]) });
  });

  // the true curve — bright, thick, drawn last (on top).
  faces.push(...curveRibbons(s.f, 0.11, '#f3f6fb', 'true', 0.95));

  // a bead riding the true curve, so the eye has the target to compare the sums against.
  const truePath = [];
  for (let i = 0; i <= 120; i++) { const x = lerp(x0, x1, i / 120), z = s.f(x); if (Math.abs(z) <= ZCLIP) truePath.push(P(x, z)); }
  const tracers = [{ path: truePath, color: [243, 246, 251], size: 0.5, period: 6, trail: 8, trailLag: 0.012 }];

  picks.push({ name: 'true', kind: 'true', label: `the true function · ${s.title}`, fields: compactFields([['series', scen.startsWith('taylor') ? 'Taylor (powers of x)' : scen === 'geometric' ? 'geometric (powers of x)' : 'Fourier (sines)'], ['idea', 'each term nudges the sum closer']]) });

  return {
    faces, tracers, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Series approximation — ${s.title}`,
      s.blurb,
      `partial sums shown: ${s.terms.join(', ')} terms (cool → warm) · white = the true function`,
      scen === 'geometric' ? 'watch the sums peel away past x = 1 — outside the interval of convergence they explode' : 'more terms ⇒ the sum hugs the true curve over a wider stretch',
    ] }],
    bounds: { center: [((x0 + x1) / 2) * U, 0, 0], radius: Math.max((x1 - x0) / 2, ZCLIP) * U * 1.2 },
    stats: { scenario: scen, terms: s.terms, domain: s.dom, family: scen.split('-')[0] },
  };
}

// ── the exact read-back channel (measure_view, tier 'exact'). One series per drawn term
// count: samples of the true f(x), the partial sum Sₙ(x), and the pointwise error, plus
// max/mean absolute error over the rendered domain. Everything evaluated directly from the
// scenario's exact f and S — so convergence RATES are measurable (Taylor error collapsing
// with n, the geometric control exploding outside |x| < 1, the Gibbs overshoot refusing
// to shrink at a Fourier jump). Errors are computed over the domain AS RENDERED, which for
// the geometric scenario deliberately includes territory outside the interval of
// convergence — the divergence is the lesson, not an artifact. ──
export function sampleSeriesExact(recipe = {}, { every = 1 } = {}) {
  const scen = SERIES_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'taylor-sin';
  const s = SCENARIOS[scen];
  const [x0, x1] = s.dom;
  const step = Math.max(1, Math.round(clampNum(every, 1, SAMP, 1)));
  const series = s.terms.map((n) => {
    const samples = [];
    let maxAbsError = 0, sumAbs = 0;
    for (let i = 0; i <= SAMP; i += step) {
      const x = lerp(x0, x1, i / SAMP);
      const fx = s.f(x), snx = s.S(n, x), err = snx - fx;
      maxAbsError = Math.max(maxAbsError, Math.abs(err));
      sumAbs += Math.abs(err);
      samples.push({ x: +x.toFixed(9), fx: +fx.toFixed(9), snx: +snx.toFixed(9), err: +err.toFixed(9) });
    }
    return {
      n, samples, count: samples.length,
      maxAbsError: +maxAbsError.toFixed(9),
      meanAbsError: +(sumAbs / samples.length).toFixed(9),
    };
  });
  return {
    scenario: scen, label: s.title, domain: [x0, x1], family: scen.split('-')[0],
    units: { x: 'dimensionless', fx: 'dimensionless', snx: 'dimensionless', err: 'dimensionless' },
    series,
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a near-front camera on the x–z plane (+ a 3/4).
 */
export function assembleSeriesScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planSeriesScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const ctr = sc(plan.bounds.center), d = plan.bounds.radius * scale;

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.3, d * 0.15], lookAt: ctr, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.4, -d * 1.7, d * 0.8], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces,
    picks: plan.picks,
    tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 760 },
    title: title || recipe.title || `mojulo series · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
