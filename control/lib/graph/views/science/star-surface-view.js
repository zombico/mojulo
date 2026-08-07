/**
 * star-surface-view — a star's SURFACE (the photosphere), the missing sibling to mojulo's raymarched
 * gas stars (star-birth / plasma-globe / fusion). Those are glowing volumes; this is the star as a
 * SOLID body whose appearance is generated from a TEMPERATURE FIELD — which is what a real star's look
 * physically IS: blackbody radiation off a ~5772 K surface, mottled by convection and cool spots.
 *
 * Born from the heat-sphere-view spike, which proved the one capability this needs: a scalar field
 * painted as colour on a static sphere, recomputed each frame (the render channel). The star pushes that
 * further — the field varies over the whole sphere (θ,φ), not just the pole angle, and the colour is
 * VIEW-DEPENDENT (limb darkening). See star-surface-view.plan.md.
 *
 * The temperature field, evaluated live in the `starSurfaces` render channel:
 *   T = Tbase + granulation(Worley convection cells, boiling) + spots(cool patches in active bands)
 * then mapped to colour by the PLANCK blackbody locus (Kelvin → true RGB) and dimmed by limb darkening.
 * Colour physics is honest; the granulation is a phenomenological cell model, not magnetoconvection.
 *
 * One idea, four hats (the star's class ⇒ its surface temperature, which the Planck map turns into the
 * star's TRUE colour — so these are physically distinct stars, not a palette swap):
 *   • sun        — a G star, ~5772 K, warm white, crisp granulation, a few spots in the active bands
 *   • red-dwarf  — an M star, ~3200 K, deep orange, big lazy granules, heavily spotted
 *   • blue-giant — an O/B star, ~25000 K, blue-white, faint fine granulation, spotless
 *   • spotted    — a cool, magnetically active star (~4800 K) blotched with large starspots
 *
 * Corona / prominences are NOT this channel — they're a raymarch overlay composited on top (follow-on).
 *
 * Stored manifest IS the recipe:
 *   { kind:'star-surface-view', scenario?, scale?, viewBox?, scene?:{ bg? }, title? }
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const DEG = Math.PI / 180;

// deterministic PRNG (mulberry32) so a scenario's spots are fixed — same recipe ⇒ identical output.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// scatter `count` cool spots into the ±[latMin,latMax]° active bands; each is an angular umbra radius
// (deg) with a warmer penumbra ring 1.7× wider. dTumbra is how many K below Tbase the umbra sits.
function makeSpots(rng, count, latMin, latMax, rhoMin, rhoMax, dTumbra) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const hemi = rng() < 0.5 ? 1 : -1;
    const lat = (latMin + rng() * (latMax - latMin)) * DEG * hemi;
    const lon = rng() * 2 * Math.PI;
    const rho = (rhoMin + rng() * (rhoMax - rhoMin)) * DEG, penu = rho * 1.7;
    const cl = Math.cos(lat);
    spots.push({
      c: [+(cl * Math.cos(lon)).toFixed(6), +(cl * Math.sin(lon)).toFixed(6), +Math.sin(lat).toFixed(6)],
      cosUmbra: +Math.cos(rho).toFixed(6), cosPenu: +Math.cos(penu).toFixed(6),
      dTumbra, dTpenu: Math.round(dTumbra * 0.45),
    });
  }
  return spots;
}

// each scenario: the surface temperature + the granulation feel + the spot population. granFreq is
// cells across the sphere (cool stars → fewer, bigger granules); granBoil is how fast they churn.
const SCENARIOS = {
  sun: {
    Tbase: 5772, granAmp: 380, granFreq: 15, granBoil: 0.08, laneW: 0.14, granBias: 0.34,
    spots: (r) => makeSpots(r, 6, 12, 30, 3.5, 7, -1750), seed: 0x5c0a,
    // DECLARED artistic choice: the true 5772 K photosphere is near-white, but people picture the Sun
    // yellow — so we grade the disc toward the familiar warm gold. The other stars keep neutral tint.
    tint: [1.0, 0.89, 0.46],
    title: 'the Sun — a G star (~5772 K)', blurb: 'the familiar golden-yellow Sun (a warm artistic grade over the true near-white photosphere), crisp granulation, sunspots in the ±15–30° active bands',
  },
  'red-dwarf': {
    Tbase: 3200, granAmp: 520, granFreq: 8, granBoil: 0.045, laneW: 0.17, granBias: 0.32,
    spots: (r) => makeSpots(r, 11, 8, 45, 6, 13, -900), seed: 0x9d17,
    title: 'a red dwarf — an M star (~3200 K)', blurb: 'deep orange, big lazy convection cells, heavily starspotted — cool stars are magnetically busy',
  },
  'blue-giant': {
    Tbase: 25000, granAmp: 160, granFreq: 22, granBoil: 0.14, laneW: 0.1, granBias: 0.4,
    spots: () => [], seed: 0x0b17,
    title: 'a blue giant — an O/B star (~25000 K)', blurb: 'blue-white and fierce, only faint fine granulation, effectively spotless',
  },
  spotted: {
    Tbase: 4800, granAmp: 430, granFreq: 12, granBoil: 0.06, laneW: 0.15, granBias: 0.33,
    spots: (r) => makeSpots(r, 16, 5, 55, 8, 18, -1400), seed: 0x5907,
    title: 'a spotted star (~4800 K)', blurb: 'a cool, magnetically active star blotched with large starspots across a wide latitude range',
  },
};
export const STAR_SURFACE_SCENARIOS = Object.keys(SCENARIOS);

const LIMB = [0.3, 0.93, -0.23];   // I(μ)/I(1) limb-darkening polynomial (empirical solar)

/**
 * Resolve a recipe → { starSurfaces, bounds, stats, fields }. Pure, deterministic.
 */
export function planStarSurfaceScene(recipe = {}) {
  const scen = STAR_SURFACE_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'sun';
  const s = SCENARIOS[scen];
  const R = 12;
  const spots = s.spots(mulberry32(s.seed));

  const star = {
    radius: R, nlat: 104, nlon: 156,
    Tbase: s.Tbase, granAmp: s.granAmp, granFreq: s.granFreq, granBoil: s.granBoil, laneW: s.laneW, granBias: s.granBias,
    spots, omegaEq: 0.045, diffRot: 0.3,   // equator ~30% faster than poles (solar-like shear)
    limb: LIMB, brightness: 1.0, tint: s.tint || [1, 1, 1],
  };

  return {
    starSurfaces: [star],
    fields: [readout([
      `Star surface — ${s.title}`,
      s.blurb,
      'colour = Planck blackbody of the live temperature (granulation + spots), dimmed by limb darkening at the edge',
      'honest colour physics + ingredients; the granulation is a convection-cell model, not an MHD simulation',
    ])],
    bounds: { center: [0, 0, 0], radius: R },
    stats: { scenario: scen, Tbase: s.Tbase, spots: spots.length, granuleCells: s.granFreq },
  };
}

const readout = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });

/**
 * Resolve a recipe → the emitThreeWorld payload — a 3/4 orbit camera on a self-luminous star.
 */
export function assembleStarSurfaceScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planStarSurfaceScene(recipe);
  const starSurfaces = plan.starSurfaces.map((st) => ({ ...st, radius: st.radius * scale }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 2.5, -d * 2.9, d * 1.8], lookAt: [0, 0, 0], horizontalFov: 44 } },
    { name: 'equator', worldFraming: { cameraPosition: [d * 3.9, -d * 0.2, 0], lookAt: [0, 0, 0], horizontalFov: 42 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05060a';
  return {
    faces: [],
    starSurfaces,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1080, height: 880 },
    title: title || recipe.title || `mojulo star · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
