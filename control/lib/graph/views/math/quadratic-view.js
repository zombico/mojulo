/**
 * quadratic-view — the PARABOLA y = ax² + bx + c, its ROOTS (where it crosses the x-axis), its VERTEX,
 * and the DISCRIMINANT Δ = b²−4ac that decides how many real roots there are. The degenerate-control
 * story of high-school algebra: as Δ passes through zero the two roots MERGE into one, then VANISH as the
 * parabola lifts clear of the axis.
 *
 * One idea, four hats:
 *   • two    — Δ > 0: two real roots (the parabola cuts the axis twice)
 *   • double — Δ = 0: one repeated root (the vertex just touches the axis)  ← the knife-edge
 *   • none   — Δ < 0: no real roots (the parabola floats above the axis)
 *   • down   — a < 0: opens downward, two roots (a flips the bowl)
 *
 * Built as baked `faces` (the parabola, axis, root + vertex markers) + a TRACER bead riding the curve.
 * Roots/vertex/Δ are exact (quadratic formula). No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'quadratic-view', scenario?, a?, b?, c?, scale?, viewBox?, scene?:{ bg? }, title? }
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
  two: { a: 1, b: -1, c: -2, title: 'two real roots (Δ > 0)' },
  double: { a: 1, b: -2, c: 1, title: 'a double root (Δ = 0)' },
  none: { a: 1, b: 0, c: 1.6, title: 'no real roots (Δ < 0)' },
  down: { a: -1, b: 0, c: 2, title: 'opens down (a < 0)' },
};
export const QUADRATIC_SCENARIOS = Object.keys(SCENARIOS);

const U = 2.6;          // render units per unit
const ZCLIP = 4.4;
const NS = 200;

const COL = { axis: '#46557a', curve: '#7bd6e8', root: '#ff6a6a', vertex: '#ffd36a', none: '#8aa0c8' };

/**
 * Resolve a recipe → { faces, tracers, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planQuadraticScene(recipe = {}) {
  const scen = QUADRATIC_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'two';
  const p = SCENARIOS[scen];
  const a = clampNum(recipe.a, -4, 4, p.a) || p.a, b = clampNum(recipe.b, -8, 8, p.b), c = clampNum(recipe.c, -8, 8, p.c);
  const f = (x) => a * x * x + b * x + c;
  const disc = b * b - 4 * a * c;
  const vx = -b / (2 * a), vy = c - (b * b) / (4 * a);
  const roots = disc > 1e-9 ? [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)] : (Math.abs(disc) <= 1e-9 ? [vx] : []);

  // frame: centre on the vertex, wide enough to show the roots.
  const span = Math.max(2.6, (roots.length ? Math.abs(roots[roots.length - 1] - vx) : 1.6) + 1.6);
  const x0 = vx - span, x1 = vx + span;
  const P2 = (x, y) => [x * U, 0, Math.max(-ZCLIP, Math.min(ZCLIP, y)) * U];

  const faces = [];
  faces.push(ribbon(P2(x0, 0), P2(x1, 0), 0.04, COL.axis, 'axis', 0.7));     // x-axis (where roots live)
  faces.push(ribbon(P2(vx, -ZCLIP), P2(vx, ZCLIP), 0.02, COL.axis, 'axisV', 0.35));  // axis of symmetry

  // the parabola.
  let prev = null;
  for (let i = 0; i <= NS; i++) { const x = lerp(x0, x1, i / NS), pt = P2(x, f(x)); if (prev) faces.push(ribbon(prev, pt, 0.1, COL.curve, 'curve', 0.95)); prev = pt; }

  // vertex marker.
  faces.push(...box(P2(vx, vy), 0.26, COL.vertex, 'vertex'));
  // root markers (on the x-axis).
  roots.forEach((r, i) => faces.push(...box(P2(r, 0), 0.3, COL.root, `root:${i}`)));

  const tracers = [{ path: Array.from({ length: 80 }, (_, k) => P2(lerp(x0, x1, k / 79), f(lerp(x0, x1, k / 79)))), color: [123, 214, 232], size: 0.42, period: 7, trail: 7, trailLag: 0.011 }];

  const rootStr = roots.length === 2 ? `${roots[0].toFixed(2)}, ${roots[1].toFixed(2)}` : roots.length === 1 ? `${roots[0].toFixed(2)} (double)` : 'none (complex)';
  const picks = [
    { name: 'vertex', kind: 'vertex', label: `vertex (${vx.toFixed(2)}, ${vy.toFixed(2)})`, fields: compactFields([['axis of symmetry', `x = ${vx.toFixed(2)}`], ['opens', a > 0 ? 'up (a > 0)' : 'down (a < 0)']]) },
    { name: roots.length ? 'root:0' : 'vertex', kind: 'roots', label: `Δ = b²−4ac = ${disc.toFixed(2)} → ${roots.length === 2 ? 'two roots' : roots.length === 1 ? 'one (double) root' : 'no real roots'}`, fields: compactFields([['roots', rootStr], ['formula', 'x = (−b ± √Δ) / 2a'], ['rule', 'Δ>0 two · Δ=0 one · Δ<0 none']]) },
  ];

  return {
    faces, tracers, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Quadratic  y = ${a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)}  —  ${p.title}`,
      `discriminant Δ = b²−4ac = ${disc.toFixed(1)}  →  ${roots.length === 2 ? 'TWO real roots' : roots.length === 1 ? 'ONE (double) root' : 'NO real roots'}`,
      `roots (red): ${rootStr}  ·  vertex (gold): (${vx.toFixed(2)}, ${vy.toFixed(2)})`,
      'as Δ → 0 the two roots merge; Δ < 0 and the parabola lifts off the axis (no real roots)',
    ] }],
    bounds: { center: [vx * U, 0, 0], radius: Math.max(span, ZCLIP) * U * 1.1 },
    stats: { scenario: scen, a, b, c, disc: +disc.toFixed(3), roots: roots.map((r) => +r.toFixed(3)), vertex: [+vx.toFixed(3), +vy.toFixed(3)] },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — front-on view of the parabola.
 */
export function assembleQuadraticScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planQuadraticScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const ctr = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2], d = 0.55 * Math.hypot(mx[0] - mn[0], mx[2] - mn[2]);

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.1, ctr[2]], lookAt: ctr, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.35, -d * 1.6, ctr[2] + d * 0.5], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces, picks: plan.picks, tracers, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 820 },
    title: title || recipe.title || `mojulo quadratic · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
