/**
 * heat-sphere-view — the HEAT EQUATION on a sphere, made a thing you can watch. The top pole is held
 * hot (red), the bottom pole cold (blue); temperature DIFFUSES across the surface until the whole ball
 * settles to one lukewarm shade. The one idea intro-PDE students never get to SEE: heat spreads, sharp
 * differences smear out, and it does so at a rate set by curvature — high-frequency lumps vanish first,
 * the broadest imbalance lingers longest.
 *
 * Exact, no fudge. On a sphere the Laplacian's axisymmetric eigenfunctions are the Legendre polynomials
 * Pₗ(cosθ) with eigenvalue −l(l+1), so ANY pole-to-pole profile evolves in closed form:
 *
 *     T(θ, t) = Σₗ aₗ · Pₗ(cosθ) · e^(−l(l+1)·κ·t)          aₗ = (2l+1)/2 · ∫₋₁¹ T₀(x) Pₗ(x) dx
 *
 * The coefficients aₗ are baked once (numeric projection of the scenario's initial profile onto the
 * Legendre basis); the browser replays the modal decay live — each mode dies at its own e^(−l(l+1)κt)
 * rate, which is WHY the fine bands wash out in a blink and the single hot-top/cold-bottom split is the
 * last thing standing. Time loops: sharp split → smooth → reset.
 *
 * One idea, four hats (the initial temperature profile T₀ over the pole angle):
 *   • poles   — hot top hemisphere / cold bottom, a sharp equatorial jump (a₀=0 → equalises to neutral)
 *   • cap     — one hot polar spot on a cold ball — a hot point bleeding outward
 *   • dipole  — a hot cap and a cold cap with a neutral band between (a steady thermal dipole relaxing)
 *   • banded  — alternating hot/cold rings — the high modes; they blur away almost at once
 *
 * Rendered through the opt-in `heatSpheres` render channel (a UV-sphere mesh recoloured per frame by the
 * modal sum) — no baked geometry stored. Sibling of surface-view / ocean-view. Orbit-only object study.
 *
 * Stored manifest IS the recipe:
 *   { kind:'heat-sphere-view', scenario?, kappa?, scale?, viewBox?, scene?:{ bg? }, title? }
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));

// diverging cool→warm colormap (Moreland-style): cold blue ↔ neutral ↔ hot red. Reads as temperature
// at a glance. Emitted to the channel; the per-frame recolour lerps through it in-script.
const COLD = [59, 108, 232];   // blue  (T = −1)
const MID = [232, 232, 236];  // pale neutral (T = 0)
const HOT = [214, 44, 52];    // red   (T = +1)

// each scenario is just an initial temperature profile T₀(x), x = cos θ ∈ [−1, 1] (x=+1 top pole,
// x=−1 bottom pole). Everything else — the Legendre coefficients, the equilibrium — falls out of it.
const SCENARIOS = {
  poles: {
    T0: (x) => (x >= 0 ? 1 : -1),
    title: 'hot top pole, cold bottom pole',
    blurb: 'a sharp equatorial jump between a hot upper hemisphere and a cold lower one — the a₀ term is zero, so it equalises to a neutral middle',
    equilibrium: 'neutral (the hot and cold exactly cancel)',
  },
  cap: {
    T0: (x) => (x >= 0.62 ? 1 : -1),
    title: 'a hot polar cap on a cold ball',
    blurb: 'heat concentrated in a small cap around the top pole bleeds outward and thins as it spreads over the whole surface',
    equilibrium: 'cool (a little heat shared over a lot of sphere)',
  },
  dipole: {
    T0: (x) => (x >= 0.5 ? 1 : x <= -0.5 ? -1 : 0),
    title: 'a hot cap and a cold cap, neutral between',
    blurb: 'a thermal dipole: opposing caps at the poles with a neutral band between them, relaxing as the caps feed the band',
    equilibrium: 'neutral (symmetric caps cancel)',
  },
  banded: {
    T0: (x) => (Math.cos(3 * Math.acos(Math.max(-1, Math.min(1, x)))) >= 0 ? 1 : -1),
    title: 'alternating hot / cold rings',
    blurb: 'fine latitude bands are built from high Legendre modes, which decay as e^(−l(l+1)κt) — they blur away almost instantly, the lesson of the whole view',
    equilibrium: 'neutral (the rings average out)',
  },
};
export const HEAT_SPHERE_SCENARIOS = Object.keys(SCENARIOS);

const LMAX = 26;       // Legendre modes kept — enough for a crisp step, cheap to replay
const NQUAD = 6000;    // midpoint samples for the coefficient projection integral

// project T₀ onto the Legendre basis: aₗ = (2l+1)/2 · ∫₋₁¹ T₀(x) Pₗ(x) dx, by midpoint quadrature.
// Pₗ(x) via the standard recurrence l·Pₗ = (2l−1)·x·Pₗ₋₁ − (l−1)·Pₗ₋₂. Exact math, computed once.
function legendreCoeffs(T0) {
  const a = new Array(LMAX + 1).fill(0);
  const dx = 2 / NQUAD;
  for (let s = 0; s < NQUAD; s++) {
    const x = -1 + (s + 0.5) * dx;
    const w = T0(x) * dx;
    let pm2 = 1, pm1 = x;
    a[0] += w * pm2;
    if (LMAX >= 1) a[1] += w * pm1;
    for (let l = 2; l <= LMAX; l++) {
      const p = ((2 * l - 1) * x * pm1 - (l - 1) * pm2) / l;
      a[l] += w * p;
      pm2 = pm1; pm1 = p;
    }
  }
  for (let l = 0; l <= LMAX; l++) a[l] *= (2 * l + 1) / 2;
  return a.map((v) => +v.toFixed(6));
}

/**
 * Resolve a recipe → { heatSpheres, bounds, stats, fields, picks }. Pure, deterministic.
 */
export function planHeatSphereScene(recipe = {}) {
  const scen = HEAT_SPHERE_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'poles';
  const s = SCENARIOS[scen];
  const kappa = clampNum(recipe.kappa, 0.2, 4, 1);

  const R = 12;                              // sphere radius (render units)
  const coeffs = legendreCoeffs(s.T0);
  // tSpan: diffusion time reached at the end of the loop, sized so the last-surviving (l=1) mode has
  // faded to ~5% — i.e. e^(−2·κ·tSpan) ≈ 0.05 ⇒ κ·tSpan ≈ 1.5. Below that the ball still reads split.
  const tSpan = 1.5 / kappa;

  const sphere = {
    radius: R, nlat: 96, nlon: 128,
    coeffs, kappa, tSpan,
    loopMs: 9000, holdFrac: 0.16,           // sweep 0→tSpan, then hold near-uniform, then reset
    cold: COLD, mid: MID, hot: HOT,
    sun: [R * 1.6, -R * 1.2, R * 2.0],
  };

  const picks = [
    { name: 'top', kind: 'pole', label: 'top pole — hot (red)', fields: compactFields([['T', s.T0(1) >= 0 ? '+1 (hot)' : '−1 (cold)'], ['θ', '0']]) },
    { name: 'bottom', kind: 'pole', label: 'bottom pole — cold (blue)', fields: compactFields([['T', s.T0(-1) >= 0 ? '+1 (hot)' : '−1 (cold)'], ['θ', 'π']]) },
  ];

  return {
    heatSpheres: [sphere],
    picks,
    fields: [readout([
      `Heat on a sphere — ${s.title}`,
      s.blurb,
      'T(θ,t) = Σ aₗ Pₗ(cosθ) e^(−l(l+1)κt) — each mode decays at its own rate; the finest bands die first',
      `κ = ${kappa} · equilibrium: ${s.equilibrium} · colour = temperature (blue cold → red hot)`,
    ])],
    bounds: { center: [0, 0, 0], radius: R },
    stats: { scenario: scen, kappa, modes: LMAX, a0: coeffs[0], a1: coeffs[1] },
  };
}

const readout = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });

/**
 * Resolve a recipe → the emitThreeWorld payload — a 3/4 orbit camera + a pole-on top camera.
 */
export function assembleHeatSphereScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planHeatSphereScene(recipe);
  const heatSpheres = plan.heatSpheres.map((hs) => ({
    ...hs, radius: hs.radius * scale, sun: hs.sun.map((c) => c * scale),
  }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 2.5, -d * 2.9, d * 1.8], lookAt: [0, 0, 0], horizontalFov: 44 } },
    { name: 'pole', worldFraming: { cameraPosition: [d * 0.2, -d * 0.35, d * 4.0], lookAt: [0, 0, 0], horizontalFov: 40 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0d14';
  return {
    faces: [],
    heatSpheres,
    picks: plan.picks,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1080, height: 880 },
    title: title || recipe.title || `mojulo heat sphere · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
