/**
 * aurora — the recipe book's Tier-2 pilot builder: the aurora borealis as a
 * volume-raymarched curtain shell over a dark night Earth, folded along the
 * auroral oval around the magnetic pole.
 *
 * The physics kept honest:
 *   • solar-wind electrons spiral DOWN FIELD LINES into an OVAL around the
 *     magnetic pole (not the pole itself) — quiet oval ~20° colatitude,
 *     widening and brightening equatorward as activity (Kp) rises;
 *   • the vertical colour ladder is real emission physics: green 557.7 nm
 *     atomic oxygen at ~100–150 km, red 630.0 nm oxygen above ~200 km,
 *     blue/purple molecular nitrogen fringing the lower edge;
 *   • curtains are field-aligned SHEETS — thin along the line of sight,
 *     folded and drifting along the oval.
 *
 * Tier-2 discipline: still PURE (no imports, no dice, byte-identical output
 * for a given recipe) — but the GLSL scaffold is INJECTED: `ctx.toolkit`
 * carries mojulo's volume-raymarch composer (`effects.buildVolumeFrag`).
 * This builder is the contract's first consumer: it feature-checks the
 * toolkit and throws a teaching error when run without it (a Tier-2 kind
 * renders only inside mojulo; its tests mock the toolkit).
 *
 * Stored manifest IS the recipe:
 *   { kind:'aurora-view', scenario?, activity?, viewBox?, scene?:{ bg? }, title? }
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

export const kind = {
  id: 'aurora',
  manifestKind: 'aurora-view',
  family: 'science',
  title: 'mojulo aurora',
};

// ── scenario presets: geomagnetic activity levels (Kp-flavoured) ──
// oval = colatitude of the oval centre (radians from the magnetic pole);
// width = oval thickness; fold = curtain fold frequency along the oval.
const SCENARIOS = {
  quiet: { activity: 0.35, oval: 0.34, width: 0.070, fold: 10.0, label: 'quiet arc (Kp 1–2)' },
  active: { activity: 0.65, oval: 0.42, width: 0.105, fold: 14.0, label: 'active curtains (Kp 4–5)' },
  storm: { activity: 1.0, oval: 0.52, width: 0.160, fold: 18.0, label: 'geomagnetic storm (Kp 7+)' },
};
export const AURORA_SCENARIOS = Object.keys(SCENARIOS);

const R_GROUND = 24;      // night-Earth radius (render units)
const R_MAX = 44;         // bounding sphere for the march
const CAM_DIST = 66;

// ── the transfer function (the only per-view GLSL; the injected scaffold does
// ray-vs-bounds + march + tonemap + stars + the ground occluder) ──
const AURORA_GLOBALS = `
uniform float uRmax; uniform float uRground; uniform float uActivity;
uniform float uOval; uniform float uOvalW; uniform float uFold;

const float H0 = 2.0;    // curtain base altitude above ground (≈100 km)
const float H1 = 10.0;   // curtain top (≈300 km)

// value noise over the shared vrHash13 (deterministic, tileable enough here).
float auNoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = vrHash13(i),                  b = vrHash13(i + vec3(1., 0., 0.));
  float c = vrHash13(i + vec3(0., 1., 0.)), d = vrHash13(i + vec3(1., 1., 0.));
  float e = vrHash13(i + vec3(0., 0., 1.)), g = vrHash13(i + vec3(1., 0., 1.));
  float h = vrHash13(i + vec3(0., 1., 1.)), k = vrHash13(i + vec3(1., 1., 1.));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
             mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}

// the dark night side of Earth the march terminates on: near-black ocean blue,
// a faint speckle of city light, a soft blue limb where the ray grazes.
vec3 auroraGround(vec3 p, vec3 rd){
  vec3 n = normalize(p);
  float city = smoothstep(0.985, 1.0, vrHash13(floor(n * 90.0))) * 0.35;
  float limb = pow(1.0 - abs(dot(n, -rd)), 3.0);
  return vec3(0.010, 0.016, 0.034) + vec3(0.9, 0.75, 0.45) * city + vec3(0.10, 0.16, 0.30) * limb * 0.35;
}

// emission + extinction at p — the aurora is almost purely emissive.
void volSample(vec3 p, out vec3 emis, out vec3 ext){
  emis = vec3(0.0); ext = vec3(0.0);
  float r = length(p);
  float hRaw = r - uRground;
  if (hRaw < H0 || hRaw > H1) return;
  float h = (hRaw - H0) / (H1 - H0);                       // 0 at curtain base → 1 at top

  vec3 n = p / r;
  float colat = acos(clamp(n.y, -1.0, 1.0));               // angle from the magnetic pole (+y)
  float az = atan(n.z, n.x);

  // the OVAL: a gaussian band around uOval colatitude, its centre wobbling
  // slowly with azimuth + time so arcs surge and recede.
  float wob = (auNoise(vec3(az * 1.6, uTime * 0.05, 3.7)) - 0.5) * 0.10 * (0.5 + uActivity);
  float band = exp(-pow((colat - (uOval + wob)) / uOvalW, 2.0));

  // CURTAIN FOLDS along the oval: thin sheets via a folded sine over azimuth,
  // drifting with time; activity sharpens and multiplies the folds.
  float s = az * uFold + 5.0 * auNoise(vec3(az * 0.9, 11.0, uTime * 0.06));
  float sheet = pow(abs(sin(s)), mix(6.0, 2.5, uActivity));

  // vertical RAYS: streaks running up the field lines.
  float rays = 0.72 + 0.28 * auNoise(vec3(az * 40.0, h * 2.0 - uTime * 0.25, 7.0));

  // altitude brightness: sharp base, long fade to the top.
  float prof = smoothstep(0.0, 0.12, h) * exp(-2.1 * h);

  float I = band * sheet * rays * prof * (0.55 + 1.45 * uActivity);

  // the emission ladder: green O(557.7) low → red O(630.0) high, N2 purple fringe at the base.
  vec3 green = vec3(0.10, 0.95, 0.35), red = vec3(0.85, 0.16, 0.30), purple = vec3(0.42, 0.20, 0.85);
  vec3 col = mix(green, red, smoothstep(0.42, 1.0, h));
  col += purple * smoothstep(0.10, 0.0, h) * 0.55 * uActivity;

  emis = col * I * 1.6;
  ext = vec3(0.010) * I;                                   // barely absorbing — curtains glow, not shade
}
`;

/**
 * Resolve a recipe into the raymarcher payload. Pure given the same toolkit —
 * the frag is a deterministic function of the recipe. Throws a teaching error
 * when the injected toolkit is absent (Tier-2 renders only inside mojulo).
 * @returns {{ raymarch, stats }}
 */
export function plan(recipe = {}, { toolkit } = {}) {
  if (!toolkit || !toolkit.effects || typeof toolkit.effects.buildVolumeFrag !== 'function') {
    throw new Error(
      "aurora is a Tier-2 builder: it needs the injected effects toolkit (ctx.toolkit.effects.buildVolumeFrag). "
      + 'It renders only inside mojulo; tests should pass a mock toolkit.',
    );
  }
  const preset = SCENARIOS[recipe.scenario] ? recipe.scenario : 'active';
  const s = SCENARIOS[preset];
  const activity = clampNum(recipe.activity, 0, 1, s.activity);

  // NOTE: every uniform is declared INSIDE the globals (the fission-view
  // convention) — declaring them in opts.uniforms too would emit duplicate
  // GLSL declarations and fail the shader compile.
  const frag = toolkit.effects.buildVolumeFrag({
    globals: AURORA_GLOBALS,
    steps: 128,
    occluder: { radiusUniform: 'uRground', groundFn: 'auroraGround' },
  });

  const readout = [
    'Aurora — solar-wind electrons spiral down field lines into the polar OVAL',
    `${s.label} · oval ≈ ${(s.oval * 57.296).toFixed(0)}° from the magnetic pole`,
    'green 557.7 nm O at 100–150 km · red 630.0 nm O above 200 km · N₂ purple below',
    'higher activity → the oval widens equatorward and the curtains multiply',
  ];

  return {
    raymarch: {
      frag,
      customUniforms: { uRmax: R_MAX, uRground: R_GROUND, uActivity: activity, uOval: s.oval, uOvalW: s.width, uFold: s.fold },
      cameraStart: [0, CAM_DIST * 0.42, CAM_DIST * 0.88], target: [0, 10, 0], fov: 46,
      readout,
    },
    stats: { scenario: preset, activity: +activity.toFixed(2), ovalColatDeg: +(s.oval * 57.296).toFixed(0), render: 'volumetric auroral-oval curtains (ray-marched, time-evolving)' },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — emitThreeWorld
 * early-returns to the raymarch emitter when it sees `raymarch`.
 */
export function assemble(recipe = {}, { title, toolkit } = {}) {
  const p = plan(recipe, { toolkit });
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#02030a';
  return {
    raymarch: p.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `${kind.title} (${p.stats.scenario})`,
    bg,
  };
}
