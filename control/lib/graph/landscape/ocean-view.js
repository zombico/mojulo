/**
 * ocean-view — an animated OCEAN SURFACE in the traversable three.js World. The first science view
 * that needs a new renderer primitive: the tracer/mover/field channels move discrete sprites/bodies/
 * arrows, but an ocean is a continuous SURFACE that deforms over time. So this rides emitThreeWorld's
 * surface channel — a grid mesh displaced every frame by a "waveform sequence" (a sum of moving wave
 * trains), i.e. real GERSTNER wave synthesis.
 *
 * A realistic sea is a superposition of sinusoidal wave trains. Each component carries a direction,
 * amplitude, wavenumber k = 2π/λ, angular frequency ω, phase and steepness Q. The surface height is
 * Σ A·sin θ, with the Gerstner horizontal pull Σ Q·A·D·cos θ that sharpens crests and broadens
 * troughs. Accurate physics kept: deep-water dispersion ω = √(g·k) — longer waves travel faster. A
 * red buoy rides the surface and traces the circular orbital motion of the water (the Gerstner
 * signature, and a callback to the buoyancy scenario).
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'ocean-view', scenario?, amplitude?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const GOLDEN = 2.399963229728653;   // golden angle (rad) — deterministic phase spread, no Math.random
const G_EFF = 2.2;                  // effective gravity → watchable dispersion speed (ω = √(g·k))
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// deep-sea palette (0..1 rgb): trough → surface → foam crest.
const DEEP = [0.04, 0.12, 0.26], SURF = [0.10, 0.34, 0.52], CREST = [0.86, 0.92, 0.96];

// ── sea-state presets: a Gerstner spectrum descriptor (the waveform sequence). ──
const SCENARIOS = {
  swell: { N: 4, lamMax: 92, lamMin: 44, A0: 2.3, ampFall: 0.72, Q: 0.32, spread: 0.5, wind: 18 },
  chop: { N: 6, lamMax: 48, lamMin: 11, A0: 1.35, ampFall: 0.74, Q: 0.78, spread: 1.15, wind: 35 },
  storm: { N: 7, lamMax: 115, lamMin: 12, A0: 3.3, ampFall: 0.75, Q: 0.82, spread: 1.3, wind: 28 },
};

export const OCEAN_SCENARIOS = Object.keys(SCENARIOS);

// build the wave spectrum: directions fanned around the wind, wavelengths geometric, ω = √(g·k),
// steepness normalised so Σ Q·k·A < 1 (otherwise Gerstner self-intersects into loops).
function buildSpectrum(s, ampScale) {
  const wind = s.wind * DEG;
  const waves = [];
  for (let i = 0; i < s.N; i++) {
    const frac = s.N > 1 ? i / (s.N - 1) : 0;
    const lam = s.lamMax * Math.pow(s.lamMin / s.lamMax, frac);
    const k = TAU / lam;
    const ang = wind + s.spread * (frac - 0.5) * 2;
    const A = s.A0 * Math.pow(s.ampFall, i) * ampScale;
    waves.push({ dx: Math.cos(ang), dy: Math.sin(ang), A, k, om: Math.sqrt(G_EFF * k), ph: (i * GOLDEN) % TAU, Q: s.Q });
  }
  // clamp total steepness to avoid looping crests.
  const sumQkA = waves.reduce((a, w) => a + w.Q * w.k * w.A, 0);
  if (sumQkA > 0.9) for (const w of waves) w.Q *= 0.9 / sumQkA;
  return waves;
}

/**
 * Resolve a recipe into the surface channel payload. Pure — no DB, no HTML. No faces (the surface is
 * generated in-script from the spectrum); same recipe → identical spectrum.
 * @returns {{ surfaces, bounds, stats }}
 */
export function planOceanScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'swell';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const amplitude = clampNum(recipe.amplitude, 0.1, 4, 1);
  const s = SCENARIOS[scenario];
  const waves = buildSpectrum(s, amplitude);
  const amax = waves.reduce((a, w) => a + w.A, 0);

  const w = 130 * scale, d = 130 * scale, nx = 76, ny = 76;
  const surface = {
    grid: { w, d, nx, ny },
    waves: waves.map((wv) => ({ ...wv, k: wv.k / scale })),   // longer world → lower spatial frequency
    amax, deep: DEEP, surf: SURF, crest: CREST,
    sun: [60 * scale, -40 * scale, 90 * scale],
    floaters: [{ x: 8 * scale, y: 6 * scale, r: 1.4 * scale, color: 0xff5a4a }, { x: -16 * scale, y: -10 * scale, r: 1.2 * scale, color: 0xffd24a }],
  };

  return {
    surfaces: [surface],
    bounds: { center: [0, 0, 0], radius: Math.hypot(w / 2, d / 2) },
    stats: { scenario, components: waves.length, amplitude, maxAmp: amax, periods: waves.map((wv) => +(TAU / wv.om).toFixed(2)) },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — an across-the-water camera (low, toward the
 * horizon) + a high camera. Deep-sea background.
 */
export function assembleOceanScene(recipe = {}, { title } = {}) {
  const plan = planOceanScene(recipe);
  const { radius } = plan.bounds;
  const d = radius;
  const cameras = [
    { name: 'across', worldFraming: { cameraPosition: [0, -d * 0.62, d * 0.2], lookAt: [0, d * 0.25, 0], horizontalFov: 58 } },
    { name: 'high', worldFraming: { cameraPosition: [0, -d * 0.42, d * 0.7], lookAt: [0, 0, 0], horizontalFov: 52 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a1a2e';
  return {
    faces: [],
    surfaces: plan.surfaces,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} ocean`,
    bg,
    glow: false,
  };
}
