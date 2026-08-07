/**
 * conics-view — where the CONIC SECTIONS come from: slice a double cone with a plane and the cut is a
 * circle, an ellipse, a parabola, or a hyperbola — which one depends only on how steeply the plane is
 * tilted relative to the cone. The genuinely hard-to-picture fact in high-school geometry, made a thing
 * you can orbit: the translucent cone, the cutting plane, and the bright intersection curve.
 *
 * The cone has half-angle α (from its axis). A plane whose normal is tilted γ from the axis cuts:
 *   • circle    — γ = 0   (plane ⟂ axis)              the cut closes into a circle
 *   • ellipse   — 0 < γ < 90°−α                        a shallow tilt → a closed ellipse
 *   • parabola  — γ = 90°−α  (plane ∥ a generator)     the cut opens — exactly one branch to infinity
 *   • hyperbola — γ > 90°−α   (plane steep)            the plane catches BOTH nappes → two branches
 *
 * The intersection is exact: along each generator (angle φ) the plane meets the cone at one height
 * z(φ) = d / (T·sinγ·cosφ + cosγ), T = tanα; where the denominator → 0 the curve runs to infinity (the
 * open arms of the parabola / hyperbola). Built as baked `faces` (translucent cone + plane, bright
 * conic ribbon). No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'conics-view', scenario?, scale?, viewBox?, scene?:{ bg? }, title? }
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
function ribbon3(a, b, w, fill, group, alpha) {
  // a tube-ish ribbon that keeps width when viewed from any angle: offset along two perps.
  const d = _sub(b, a); let p = _cross(d, [0, 1, 0]); if (_len(p) < 1e-4) p = _cross(d, [1, 0, 0]);
  p = _sV(_norm(p), w); return quad([_add(a, p), _add(b, p), _sub(b, p), _sub(a, p)], fill, group, alpha);
}

const DEG = Math.PI / 180;
const ALPHA = 28 * DEG;              // cone half-angle
const T = Math.tan(ALPHA);
const ZMAX = 6;                      // clip the cone / conic to |z| ≤ ZMAX

const SCENARIOS = {
  circle: { gamma: 0, z0: 3.4, title: 'circle', blurb: 'plane perpendicular to the axis (γ = 0°) — the cut closes into a perfect circle' },
  ellipse: { gamma: 24 * DEG, z0: 3.2, title: 'ellipse', blurb: 'a gentle tilt (γ < 90°−α) — the cut is still closed, but stretched into an ellipse' },
  parabola: { gamma: (90 - 28) * DEG, z0: 2.2, title: 'parabola', blurb: 'plane exactly parallel to a side of the cone (γ = 90°−α) — the cut OPENS: one arm to infinity' },
  hyperbola: { gamma: 76 * DEG, z0: 1.4, title: 'hyperbola', blurb: 'a steep tilt (γ > 90°−α) — the plane catches BOTH nappes, so the cut is two open branches' },
};
export const CONICS_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe → { faces, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planConicsScene(recipe = {}) {
  const scen = CONICS_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'ellipse';
  const s = SCENARIOS[scen];
  const g = s.gamma;
  // plane: n·P = d, normal tilted γ from the z-axis in the x–z plane; passes through (0,0,z0).
  const n = [Math.sin(g), 0, Math.cos(g)], d = Math.cos(g) * s.z0;
  const denom = (phi) => T * Math.sin(g) * Math.cos(phi) + Math.cos(g);   // z(φ) = d / denom(φ)

  const faces = [];

  // ── the double cone (translucent), built as rings; quads between consecutive rings ──
  const NPHI = 60, NZ = 14;
  const ring = (z) => { const r = Math.abs(z) * T; return Array.from({ length: NPHI + 1 }, (_, k) => { const a = (k / NPHI) * TAU; return [r * Math.cos(a), r * Math.sin(a), z]; }); };
  const coneCol = '#3a4f78';
  for (const sgn of [1, -1]) {
    for (let i = 0; i < NZ; i++) {
      const za = sgn * (0.02 + (ZMAX - 0.02) * (i / NZ)), zb = sgn * (0.02 + (ZMAX - 0.02) * ((i + 1) / NZ));
      const ra = ring(za), rb = ring(zb);
      for (let k = 0; k < NPHI; k++) faces.push(quad([ra[k], ra[k + 1], rb[k + 1], rb[k]], coneCol, 'cone', 0.16));
    }
  }

  // ── the cutting plane (translucent patch) ──
  const u = _norm([Math.cos(g), 0, -Math.sin(g)]), v = [0, 1, 0], P0 = _sV(n, d), W = ZMAX * 1.15;
  faces.push(quad([_add(_add(P0, _sV(u, -W)), _sV(v, -W)), _add(_add(P0, _sV(u, W)), _sV(v, -W)), _add(_add(P0, _sV(u, W)), _sV(v, W)), _add(_add(P0, _sV(u, -W)), _sV(v, W))], '#b0683c', 'plane', 0.2));

  // ── the intersection conic (bright ribbon) — exact, broken where it runs to infinity ──
  const M = 360;
  let prev = null, prevOk = false;
  const conicCol = '#ffd86a';
  for (let i = 0; i <= M; i++) {
    const phi = (i / M) * TAU, de = denom(phi), z = d / de;
    const ok = Math.abs(de) > 0.06 && Math.abs(z) <= ZMAX;
    const pt = ok ? [z * T * Math.cos(phi), z * T * Math.sin(phi), z] : null;
    if (pt && prev && prevOk) faces.push(ribbon3(prev, pt, 0.11, conicCol, 'conic', 1));
    prev = pt; prevOk = ok;
  }

  // apex marker.
  faces.push(quad([[-0.25, 0, 0.25], [0.25, 0, 0.25], [0.25, 0, -0.25], [-0.25, 0, -0.25]], '#cdd7ea', 'apex', 1));

  const picks = [
    { name: 'conic', kind: 'conic', label: `${s.title} — a conic section`, fields: compactFields([['cone half-angle α', `${(ALPHA / DEG).toFixed(0)}°`], ['plane tilt γ', `${(g / DEG).toFixed(0)}°`], ['rule', `γ ${scen === 'circle' ? '= 0' : scen === 'ellipse' ? '< 90°−α' : scen === 'parabola' ? '= 90°−α' : '> 90°−α'} → ${s.title}`]]) },
  ];

  return {
    faces, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Conic sections — ${s.title}`,
      s.blurb,
      `cone half-angle α = ${(ALPHA / DEG).toFixed(0)}° · plane tilt γ = ${(g / DEG).toFixed(0)}° (90°−α = ${(90 - ALPHA / DEG).toFixed(0)}°)`,
      'same cone, one tilting plane — the bright curve is the slice (gold)',
    ] }],
    bounds: { center: [0, 0, 0], radius: ZMAX * 1.25 },
    stats: { scenario: scen, alphaDeg: +(ALPHA / DEG).toFixed(1), gammaDeg: +(g / DEG).toFixed(1) },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a 3/4 view that catches the cone, plane, and slice.
 */
export function assembleConicsScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planConicsScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 1.5, -d * 1.3, d * 0.5], lookAt: [0, 0, 0], horizontalFov: 50 } },
    { name: 'side', worldFraming: { cameraPosition: [d * 2.0, 0, d * 0.2], lookAt: [0, 0, 0], horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#080b14';
  return {
    faces, picks: plan.picks, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1040, height: 940 },
    title: title || recipe.title || `mojulo conics · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
