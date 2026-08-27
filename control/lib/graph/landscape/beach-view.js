/**
 * beach-view — an animated SHORELINE in the traversable three.js World: the sea rolling in and lapping
 * onto a sloped sand beach. The sibling of ocean-view — it rides the SAME surface channel (a grid mesh
 * deformed every frame by a Gerstner "waveform sequence"), but the wave trains all travel toward +y
 * (the shore) and the surface carries a `shore` descriptor so the swell SHOALS: its height + slope
 * taper to zero as the bed rises to the waterline, the shallows lighten, and a foam swash line laps up
 * the sand and retreats. Where ocean-view is open deep water, this is water MEETING land.
 *
 * The wave engine is the double-slit's / ocean's surface channel unchanged — this view adds only the
 * shore coupling (in surface.js) and a static sand WEDGE (plain faces): a bed that is submerged
 * offshore, crosses the still waterline at y = edgeY, and rises to a dry dune. Wet sand near the
 * waterline reads darker than the dry berm above it; a low sun bakes a flat Lambert shade per facet.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'beach-view', scenario?, amplitude?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const GOLDEN = 2.399963229728653;   // golden angle (rad) — deterministic phase spread, no Math.random
const G_EFF = 2.4;                  // effective gravity → watchable dispersion speed (ω = √(g·k))
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// tropical-water palette (0..1 rgb): trough → surface → foam crest, plus turquoise shallows.
const DEEP = [0.10, 0.40, 0.52], SURF = [0.22, 0.64, 0.70], CREST = [0.95, 0.98, 0.99], SHALLOW = [0.55, 0.88, 0.82];
// sand (0..1 rgb): dry berm above, wet strand near the waterline.
const DRY_SAND = [0.86, 0.77, 0.58], WET_SAND = [0.50, 0.42, 0.31];

// ── domain (render units) — x is ACROSS-shore, y is the propagation axis (waves travel +y). ──
const WX = 130, DY = 118, NX = 84, NY = 92;    // water grid
const EDGE = DY / 2;                            // still waterline sits at the far edge of the water grid
const TOE = 22, BEACH = 60, TOE_DEPTH = 12, DUNE_H = 15;   // sand wedge: submerged toe → dry dune
const SX = 52, SY = 44;                         // sand grid resolution
const SUN = [70, -55, 85];                      // sun grazing enough that wave slopes catch light/shade

// sea-state presets: a Gerstner spectrum fanned tightly around the +y (onshore) heading. Wavelengths
// are kept SHORT relative to the ~150-unit domain so several crests march shoreward at once — the
// "rippling to the shore" read (long open-ocean swells would fill the domain with one broad heave).
const SCENARIOS = {
  calm: { N: 5, lamMax: 44, lamMin: 15, A0: 1.5, ampFall: 0.78, Q: 0.42, spread: 0.35 },
  swell: { N: 6, lamMax: 60, lamMin: 18, A0: 2.2, ampFall: 0.78, Q: 0.52, spread: 0.50 },
  surf: { N: 7, lamMax: 82, lamMin: 13, A0: 3.2, ampFall: 0.80, Q: 0.70, spread: 0.72 },
};

export const BEACH_SCENARIOS = Object.keys(SCENARIOS);

// build the onshore wave spectrum: directions fanned around +y, wavelengths geometric, ω = √(g·k),
// steepness clamped so Σ Q·k·A < 1 (else Gerstner self-intersects into loops).
function buildSpectrum(s, ampScale) {
  const base = Math.PI / 2;   // +y = toward the shore
  const waves = [];
  for (let i = 0; i < s.N; i++) {
    const frac = s.N > 1 ? i / (s.N - 1) : 0;
    const lam = s.lamMax * Math.pow(s.lamMin / s.lamMax, frac);
    const k = TAU / lam;
    const ang = base + s.spread * (frac - 0.5);
    const A = s.A0 * Math.pow(s.ampFall, i) * ampScale;
    waves.push({ dx: Math.cos(ang), dy: Math.sin(ang), A, k, om: Math.sqrt(G_EFF * k), ph: (i * GOLDEN) % TAU, Q: s.Q });
  }
  const sumQkA = waves.reduce((a, w) => a + w.Q * w.k * w.A, 0);
  if (sumQkA > 0.9) for (const w of waves) w.Q *= 0.9 / sumQkA;
  return waves;
}

const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// bed height under the sand: submerged toe rising linearly to 0 at the waterline, then a smooth dune.
function bedZ(y) {
  if (y <= EDGE) return (y - EDGE) * (TOE_DEPTH / TOE);
  const u = Math.min(1, (y - EDGE) / BEACH);
  return DUNE_H * (u * u * (3 - 2 * u));
}

// the static sand WEDGE — a grid of flat-shaded quads. Wet near/below the waterline, dry up the berm;
// each facet Lambert-lit by the low sun so the slope reads. Gentle seeded ripple keeps it from looking
// like a ramp (deterministic — a fixed trig field, no dice).
function buildSand(scale) {
  const s = scale;
  const sun = norm3(SUN);
  const x0 = -(WX / 2 + 8) * s, x1 = (WX / 2 + 8) * s;
  const y0 = (EDGE - TOE) * s, y1 = (EDGE + BEACH) * s;
  const ripple = (x, y) => (0.55 * Math.sin(x * 0.22 + y * 0.05) + 0.4 * Math.sin(y * 0.4 + 1.3)) * s;
  const zAt = (x, y) => bedZ(y / s) * s + ripple(x, y);
  const faces = [];
  for (let j = 0; j < SY; j++) {
    for (let i = 0; i < SX; i++) {
      const xa = x0 + (x1 - x0) * (i / SX), xb = x0 + (x1 - x0) * ((i + 1) / SX);
      const ya = y0 + (y1 - y0) * (j / SY), yb = y0 + (y1 - y0) * ((j + 1) / SY);
      const p00 = [xa, ya, zAt(xa, ya)], p10 = [xb, ya, zAt(xb, ya)], p11 = [xb, yb, zAt(xb, yb)], p01 = [xa, yb, zAt(xa, yb)];
      const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
      const shade = 0.34 + 0.66 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
      const zc = (p00[2] + p10[2] + p11[2] + p01[2]) / 4;
      const wet = zc < 0 ? 1 : Math.max(0, 1 - zc / (5 * s));   // submerged → wet, up to +5 units dry
      const base = [WET_SAND[0] + (DRY_SAND[0] - WET_SAND[0]) * (1 - wet), WET_SAND[1] + (DRY_SAND[1] - WET_SAND[1]) * (1 - wet), WET_SAND[2] + (DRY_SAND[2] - WET_SAND[2]) * (1 - wet)];
      faces.push({ corners: [p00, p10, p11, p01], fill: hex([base[0] * shade, base[1] * shade, base[2] * shade]), group: 'sand' });
    }
  }
  return faces;
}

/**
 * Resolve a recipe into the surface channel payload + the sand wedge. Pure — no DB, no HTML. No stored
 * geometry (the water grid regenerates in-script from the spectrum); same recipe → identical scene.
 * @returns {{ surfaces, faces, bounds, stats }}
 */
export function planBeachScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'calm';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const amplitude = clampNum(recipe.amplitude, 0.1, 4, 1);
  const s = SCENARIOS[scenario];
  const waves = buildSpectrum(s, amplitude);
  const amax = waves.reduce((a, w) => a + w.A, 0);

  const w = WX * scale, d = DY * scale;
  const surface = {
    grid: { w, d, nx: NX, ny: NY },
    waves: waves.map((wv) => ({ ...wv, k: wv.k / scale })),   // longer world → lower spatial frequency
    amax, deep: DEEP, surf: SURF, crest: CREST,
    sun: [SUN[0] * scale, SUN[1] * scale, SUN[2] * scale],
    floaters: [{ x: 22 * scale, y: -34 * scale, r: 1.6 * scale, color: 0xff5a4a }],
    shore: {
      edgeY: EDGE * scale,       // still waterline (far edge of the water grid)
      surfW: 52 * scale,         // width of the surf zone over which the swell shoals + the shallows lighten
      swashRange: 12 * scale,    // how far the foam swash runs up the sand and back
      omSwash: 0.6,              // swash lap rate (period ≈ 10 s) — the "slowly rippling" beat
      foamW: 11 * scale,         // foam band width
      sink: 0.9 * scale,         // sit the flat near-shore water just under the sand so the beach wins the seam
      shallow: SHALLOW,
    },
  };

  return {
    surfaces: [surface],
    faces: buildSand(scale),
    bounds: { center: [0, 0, 0], radius: Math.hypot(w / 2, d / 2) },
    stats: { scenario, components: waves.length, amplitude, maxAmp: amax, periods: waves.map((wv) => +(TAU / wv.om).toFixed(2)) },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — a low camera on the sea side looking toward the
 * beach (watching the swell roll in) + a high aerial. Pale-sky background.
 */
export function assembleBeachScene(recipe = {}, { title } = {}) {
  const plan = planBeachScene(recipe);
  const s = clampNum(recipe.scale, 0.2, 5, 1);
  const cameras = [
    // a steep overhead look (~72°) centred on the waterline: from this angle we see the sunlit wave
    // TOPS (travelling crest bands + whitecaps), the foam swash line, and the wet→dry sand — instead of
    // the shadowed seaward wave faces a grazing camera would show as a dark band.
    { name: 'shore', worldFraming: { cameraPosition: [0, -DY * 0.02 * s, DY * 0.5 * s], lookAt: [0, EDGE * 0.62 * s, 0], horizontalFov: 60 } },
    { name: 'seaward', worldFraming: { cameraPosition: [0, (EDGE + BEACH * 0.5) * s, DY * 0.34 * s], lookAt: [0, -DY * 0.18 * s, 0], horizontalFov: 66 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#bfe0ee';
  return {
    faces: plan.faces,
    surfaces: plan.surfaces,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} beach`,
    bg,
    glow: false,
  };
}
