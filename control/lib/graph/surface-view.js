/**
 * surface-view — the graph of a function of two variables z = f(x,y) as a real 3-D LANDSCAPE, with a
 * ball that ROLLS DOWNHILL (gradient descent). Multivariable calculus made a place you can look at:
 * critical points become hilltops, valleys and saddles, and "optimization" becomes a ball finding the
 * bottom. The honest tie to field-flow-view: the ball follows the gradient field −∇f, whose phase
 * portrait near a minimum is a SINK and near a saddle is a SADDLE — the same five hats, one dimension up.
 *
 * One idea, five hats, with the saddle as the "critical point ≠ optimum" twist and wells/ripple as the
 * local-minima lesson (why gradient descent is hard):
 *   • bowl    — z = x²+y²: one global minimum (convex; the ball always finds it)
 *   • saddle  — z = x²−y²: ∇f = 0 at the origin but it's NEITHER a min nor a max — the ball rolls away
 *   • monkey  — z = x³−3xy²: a monkey saddle, three valleys and three ridges meeting at the origin
 *   • wells    — two Gaussian basins: gradient descent finds the NEARER one (local minima)
 *   • ripple   — a bumpy bowl: many local minima — where you start decides where you stop
 *
 * Built as baked, Lambert-shaded `faces` (relief from per-quad normals, no surface channel needed) + the
 * TRACER channel for the descending ball(s). Sibling of transform-view / field-flow-view.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'surface-view', scenario?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

import { makeLight, shadeFace } from './polygonizer/vexar.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

// face helpers (the ball uses tracers; faint axes are ribbons).
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

// every scenario is just a height function f(x,y); the descent uses a NUMERIC gradient, so adding a
// surface never means hand-deriving ∂f. seeds are the ball start points (math coords).
const SCENARIOS = {
  bowl: { f: (x, y) => 0.55 * (x * x + y * y), seeds: [[-2.7, 2.3]], lr: 0.14, crit: [0, 0],
    title: 'bowl — one global minimum', critLabel: 'global minimum', blurb: 'a convex paraboloid: ∇f points uphill everywhere, so the ball ALWAYS rolls to the single bottom' },
  saddle: { f: (x, y) => x * x - y * y, seeds: [[0.07, 0.9], [-0.07, -0.9]], lr: 0.06, crit: [0, 0],
    title: 'saddle — a critical point that is no optimum', critLabel: 'saddle point', blurb: '∇f = 0 at the origin, yet it is NEITHER a min nor a max — up along x, down along y; the ball rolls away' },
  monkey: { f: (x, y) => 0.22 * (x * x * x - 3 * x * y * y), seeds: [[0.1, 2.4], [2.1, -1.2], [-2.1, -1.2]], lr: 0.05, crit: [0, 0],
    title: 'monkey saddle — three valleys meet', critLabel: 'monkey saddle', blurb: 'z = x³ − 3xy²: three downhill valleys and three uphill ridges meet at the origin (room for the tail)' },
  wells: { f: (x, y) => -1.25 * Math.exp(-0.55 * ((x - 1.7) ** 2 + y * y)) - 0.95 * Math.exp(-0.55 * ((x + 1.7) ** 2 + y * y)),
    seeds: [[-2.7, 1.3], [2.7, -1.1]], lr: 0.5, crit: null,
    title: 'two wells — local minima', critLabel: 'minima', blurb: 'two Gaussian basins: gradient descent slides into the NEARER one — it cannot see the deeper well across the ridge' },
  ripple: { f: (x, y) => 0.9 * (Math.cos(1.5 * x) + Math.cos(1.5 * y)) + 0.13 * (x * x + y * y),
    seeds: [[-2.8, 2.6], [2.7, 2.4], [-2.6, -2.7], [2.8, -2.5]], lr: 0.16, crit: null,
    title: 'ripple — many local minima', critLabel: 'minima', blurb: 'a bumpy bowl: descent stalls in the first dimple it meets — where you START decides where you STOP' },
};
export const SURFACE_SCENARIOS = Object.keys(SCENARIOS);

const D = 3;       // domain [−D, D]²
const NCELL = 40;  // grid resolution
const U = 3.0;     // render units per unit
const LIGHT = makeLight({ direction: [0.32, -0.42, -0.84], ambient: 0.46, diffuse: 0.62 });  // from above

// diverging height palette: valley (cool) → mid → peak (warm).
const VALLEY = [44, 74, 150], MID = [56, 132, 120], PEAK = [224, 168, 90];
const heightColor = (t) => (t < 0.5 ? lerp3(VALLEY, MID, t * 2) : lerp3(MID, PEAK, (t - 0.5) * 2));

const numGrad = (f, x, y, h = 1e-3) => [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];

// gradient descent through the height field — the ball rolling downhill, in math coords.
function descend(f, seed, lr, steps = 220) {
  const pts = [seed.slice()]; let p = seed.slice();
  for (let i = 0; i < steps; i++) {
    const g = numGrad(f, p[0], p[1]);
    if (Math.hypot(g[0], g[1]) < 1e-3) break;          // settled at a critical point
    p = [p[0] - lr * g[0], p[1] - lr * g[1]];
    if (Math.abs(p[0]) > D * 1.05 || Math.abs(p[1]) > D * 1.05) break;
    pts.push(p);
  }
  return pts;
}

/**
 * Resolve a recipe → { faces, tracers, picks, bounds, stats }. Pure, deterministic.
 */
export function planSurfaceScene(recipe = {}) {
  const scen = SURFACE_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'bowl';
  const s = SCENARIOS[scen];
  const f = s.f;

  // sample the height field → normalization (z scaled to a watchable relief) + colour range.
  let zmin = Infinity, zmax = -Infinity;
  const step = (2 * D) / NCELL;
  const zAt = [];
  for (let i = 0; i <= NCELL; i++) {
    zAt.push([]);
    for (let j = 0; j <= NCELL; j++) {
      const x = -D + i * step, y = -D + j * step, z = f(x, y);
      zAt[i].push(z); if (z < zmin) zmin = z; if (z > zmax) zmax = z;
    }
  }
  const zmid = (zmin + zmax) / 2, span = Math.max(1e-3, zmax - zmin);
  const zk = (0.9 * D) / span;                 // vertical exaggeration → relief reads in one orbit
  const zAdj = (z) => (z - zmid) * zk;          // centred, scaled height (math units)
  const Pt = (x, y, z) => [x * U, y * U, zAdj(z) * U];
  const colorOf = (z) => heightColor((z - zmin) / span);

  // ── the landscape: one Lambert-shaded quad per cell (relief from the per-quad normal) ──
  const faces = [];
  for (let i = 0; i < NCELL; i++) {
    for (let j = 0; j < NCELL; j++) {
      const x0 = -D + i * step, y0 = -D + j * step, x1 = x0 + step, y1 = y0 + step;
      const corners = [Pt(x0, y0, zAt[i][j]), Pt(x1, y0, zAt[i + 1][j]), Pt(x1, y1, zAt[i + 1][j + 1]), Pt(x0, y1, zAt[i][j + 1])];
      const zAvg = (zAt[i][j] + zAt[i + 1][j] + zAt[i + 1][j + 1] + zAt[i][j + 1]) / 4;
      const { fill } = shadeFace(corners, hex(colorOf(zAvg)), { light: LIGHT, inside: [x0 * U, y0 * U, -1e4] });  // normals up
      faces.push(quad(corners, fill, 'surface'));
    }
  }

  // faint base axes (through the mid-height level), for orientation.
  faces.push(ribbon(Pt(-D, 0, zmid), Pt(D, 0, zmid), 0.03, '#33405e', 'axes', 0.25));
  faces.push(ribbon(Pt(0, -D, zmid), Pt(0, D, zmid), 0.03, '#33405e', 'axes', 0.25));

  // ── the rolling ball(s): gradient descent, one tracer bead + trail per seed ──
  const tracers = [];
  const BALL = [[255, 224, 138], [122, 214, 160], [176, 124, 236], [232, 130, 130]];
  const landings = [];
  s.seeds.forEach((seed, k) => {
    const path = descend(f, seed, s.lr);
    const lifted = path.map(([x, y]) => Pt(x, y, f(x, y)));
    tracers.push({ path: lifted, color: BALL[k % BALL.length], size: 1.0, period: 5.5, trail: 9, trailLag: 0.01 });
    landings.push(path[path.length - 1]);
  });

  // ── critical-point / minima markers ──
  const picks = [];
  if (s.crit) {
    const cz = f(s.crit[0], s.crit[1]);
    faces.push(...boxAt(Pt(s.crit[0], s.crit[1], cz), 0.34, '#f2f4f8', 'crit'));
    picks.push({ name: 'crit', kind: 'critical', label: `${s.critLabel} at the origin`, fields: compactFields([['∇f', '0 here (a flat spot)'], ['type', s.critLabel], ['note', scen === 'saddle' ? 'flat but NOT an optimum' : scen === 'monkey' ? 'three-way flat spot' : 'the bottom']]) });
  } else {
    landings.forEach((p, k) => faces.push(...boxAt(Pt(p[0], p[1], f(p[0], p[1])), 0.3, '#dfe6f2', `min:${k}`)));
    picks.push({ name: `min:0`, kind: 'minimum', label: `${landings.length} local minima reached`, fields: compactFields([['lesson', 'descent finds the nearest basin, not the global best'], ['starts', `${s.seeds.length} different — they land in different places`]]) });
  }

  return {
    faces, tracers, picks,
    fields: [readout([
      `Surface  z = f(x, y)  —  ${s.title}`,
      s.blurb,
      'colour = height (valleys cool → peaks warm) · the glowing ball rolls DOWNHILL along −∇f',
      'the ball traces gradient descent — the same −∇f flow field-flow-view draws as a sink/saddle',
    ])],
    bounds: { center: [0, 0, 0], radius: D * U * 1.5 },
    stats: { scenario: scen, critical: s.critLabel, descents: s.seeds.length, zRange: [+zmin.toFixed(2), +zmax.toFixed(2)] },
  };
}

function boxAt(c, h, fill, group) {
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
const readout = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });

/**
 * Resolve a recipe → the emitThreeWorld payload — a low 3/4 camera that catches the relief.
 */
export function assembleSurfaceScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planSurfaceScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((ff) => ({ ...ff, corners: ff.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 0.7, -d * 1.15, d * 0.85], lookAt: [0, 0, -d * 0.12], horizontalFov: 50 } },
    { name: 'top', worldFraming: { cameraPosition: [d * 0.05, -d * 0.2, d * 2.3], lookAt: [0, 0, 0], horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e16';
  return {
    faces,
    picks: plan.picks,
    tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1080, height: 880 },
    title: title || recipe.title || `mojulo surface · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
