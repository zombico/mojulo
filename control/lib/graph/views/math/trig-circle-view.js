/**
 * trig-circle-view — the UNIT CIRCLE, the one machine all of trigonometry comes from. A point rides
 * around the circle; its HEIGHT is sin θ, its WIDTH is cos θ. To the right, the angle is unwrapped into
 * the WAVE: plot the height against the angle and the sine curve falls out. The single highest-leverage
 * picture in high-school trig — "the circle becomes the wave."
 *
 * One idea, three hats:
 *   • sine    — height of the point → the sine wave; the vertical red leg
 *   • cosine  — width of the point → the cosine wave; the horizontal green leg
 *   • tangent — extend the radius to the vertical tangent line at x = R; its intercept is tan θ
 *
 * Built as baked `faces` (circle, the right-triangle legs, the unwrapped wave) + TRACER beads that ride
 * the circle and the wave in sync. No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'trig-circle-view', scenario?, angle?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));

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
  sine: { fn: Math.sin, label: 'sine', blurb: 'the HEIGHT of the rotating point is sin θ — unwrap the angle and that height traces the sine wave', col: '#ff6a6a' },
  cosine: { fn: Math.cos, label: 'cosine', blurb: 'the WIDTH of the rotating point is cos θ — unwrapped, it traces the cosine wave (sine shifted by 90°)', col: '#6ad29a' },
  tangent: { fn: Math.tan, label: 'tangent', blurb: 'extend the radius to the vertical tangent line at x = R: the height where it hits is tan θ = sin θ / cos θ', col: '#e6b94e' },
};
export const TRIG_SCENARIOS = Object.keys(SCENARIOS);

const R = 8;            // circle radius (render units)
const GAP = 3.2;        // gap from circle to the start of the wave
const WX = R * 0.62;    // angle → x scale for the wave
const ZCLIP = R * 1.8;  // clip tan
const NWAVE = 240;
const TURNS = 1.0;      // wave length in turns

const COL = { circle: '#46557a', axis: '#2c374f', radius: '#e6c45a', sinLeg: '#ff6a6a', cosLeg: '#6ad29a', wave: '#f3f6fb', point: '#ffe08a', tangent: '#e6b94e' };

/**
 * Resolve a recipe → { faces, tracers, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planTrigCircleScene(recipe = {}) {
  const scen = TRIG_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'sine';
  const s = SCENARIOS[scen];
  const t0 = clampNum(recipe.angle, 0.05, TAU - 0.05, 0.9);   // the marker angle θ₀
  const onCirc = (t) => [R * Math.cos(t), 0, R * Math.sin(t)];
  const waveX = (t) => R + GAP + t * WX;
  const clipZ = (z) => Math.max(-ZCLIP, Math.min(ZCLIP, z));

  const faces = [];
  // circle outline + axes.
  const N = 96; const cp = Array.from({ length: N }, (_, k) => onCirc((k / N) * TAU));
  for (let i = 0; i < N; i++) faces.push(ribbon(cp[i], cp[(i + 1) % N], 0.1, COL.circle, 'circle', 0.85));
  faces.push(ribbon([-R * 1.2, 0, 0], [waveX(TURNS * TAU) + 1, 0, 0], 0.04, COL.axis, 'axes', 0.6));
  faces.push(ribbon([0, 0, -R * 1.2], [0, 0, R * 1.2], 0.04, COL.axis, 'axes', 0.6));

  // the right-triangle construction at θ₀: radius (hyp = 1), cos leg (green), sin leg (red).
  const P = onCirc(t0), cosX = R * Math.cos(t0), sinZ = R * Math.sin(t0);
  faces.push(ribbon([0, 0, 0], P, 0.06, COL.radius, 'radius', 0.95));
  faces.push(ribbon([0, 0, 0], [cosX, 0, 0], 0.07, COL.cosLeg, 'cosleg', 0.95));        // cos θ
  faces.push(ribbon([cosX, 0, 0], P, 0.07, COL.sinLeg, 'sinleg', 0.95));                // sin θ
  faces.push(...box(P, 0.32, COL.point, 'point'));

  // tangent-scenario extra: the vertical tangent line at x = R and the radius extended to it.
  if (scen === 'tangent') {
    const tanZ = clipZ(R * Math.tan(t0));
    faces.push(ribbon([R, 0, -ZCLIP], [R, 0, ZCLIP], 0.04, '#5b6b8e', 'tanline', 0.5));
    faces.push(ribbon([0, 0, 0], [R, 0, R * Math.tan(t0)], 0.05, COL.tangent, 'tanray', 0.85));
    faces.push(...box([R, 0, tanZ], 0.28, COL.tangent, 'tanpoint'));
  }

  // the UNWRAPPED wave: plot f(θ) vs θ to the right.
  let prev = null, prevIn = false;
  for (let i = 0; i <= NWAVE; i++) {
    const t = (i / NWAVE) * TURNS * TAU, z = R * s.fn(t), inside = Math.abs(z) <= ZCLIP * 1.001;
    const pt = [waveX(t), 0, clipZ(z)];
    if (prev && inside && prevIn) faces.push(ribbon(prev, pt, 0.14, COL.wave, 'wave', 0.95));
    prev = pt; prevIn = inside;
  }
  // connector: carry the point's value across to the wave at θ₀ (same height).
  const wv0 = clipZ(R * s.fn(t0));
  faces.push(ribbon([scen === 'cosine' ? cosX : (scen === 'tangent' ? R : cosX), 0, wv0], [waveX(t0), 0, wv0], 0.03, '#8794ad', 'connector', 0.5));
  faces.push(...box([waveX(t0), 0, wv0], 0.3, COL.point, 'wavepoint'));

  // tracers: a bead on the circle and a synced bead on the wave (same θ over one turn).
  const STEP = 60;
  const circPath = Array.from({ length: STEP + 1 }, (_, k) => onCirc((k / STEP) * TURNS * TAU));
  const wavePath = Array.from({ length: STEP + 1 }, (_, k) => { const t = (k / STEP) * TURNS * TAU; return [waveX(t), 0, clipZ(R * s.fn(t))]; });
  const tracers = [
    { path: circPath, color: [255, 224, 138], size: 0.45, period: 7, trail: 7, trailLag: 0.01 },
    { path: wavePath, color: [243, 246, 251], size: 0.45, period: 7, trail: 7, trailLag: 0.01 },
  ];

  const deg = (t0 * 180 / Math.PI).toFixed(0);
  const val = s.fn(t0);
  const picks = [
    { name: 'point', kind: 'angle', label: `θ = ${deg}°`, fields: compactFields([['cos θ', Math.cos(t0).toFixed(3)], ['sin θ', Math.sin(t0).toFixed(3)], ['tan θ', Math.tan(t0).toFixed(3)]]) },
    { name: 'wavepoint', kind: 'value', label: `${s.label} ${deg}° = ${val.toFixed(3)}`, fields: compactFields([['it is', 'the point’s ' + (scen === 'cosine' ? 'width' : scen === 'tangent' ? 'tangent-line intercept' : 'height')], ['identity', 'sin²θ + cos²θ = 1']]) },
  ];

  return {
    faces, tracers, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Unit circle → ${s.label}`,
      s.blurb,
      `at θ = ${deg}°:  cos θ = ${Math.cos(t0).toFixed(2)},  sin θ = ${Math.sin(t0).toFixed(2)}  (radius = 1)`,
      'gold bead rides the circle · white bead rides the wave — same height, in step',
    ] }],
    bounds: { center: [(waveX(TURNS * TAU) - R) / 2, 0, 0], radius: (waveX(TURNS * TAU) + R * 1.4) / 2 },
    stats: { scenario: scen, angleDeg: +deg, cos: +Math.cos(t0).toFixed(3), sin: +Math.sin(t0).toFixed(3) },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a front camera looking at the x–z plane.
 */
export function assembleTrigCircleScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planTrigCircleScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = plan.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  // frame from the actual geometry (circle + wave span, in the x–z plane).
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const ctr = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2], d = 0.5 * Math.hypot(mx[0] - mn[0], mx[2] - mn[2]);

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.0, ctr[2]], lookAt: ctr, horizontalFov: 48 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.3, -d * 1.6, ctr[2] + d * 0.5], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces, picks: plan.picks, tracers, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1200, height: 720 },
    title: title || recipe.title || `mojulo unit circle · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
