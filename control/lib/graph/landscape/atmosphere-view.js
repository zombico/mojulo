/**
 * atmosphere-view — ATMOSPHERIC SCATTERING: why the sky is blue and sunsets are red, derived the
 * textbook-correct way — a single-scattering VOLUME integral of sunlight along the view ray (Nishita /
 * Bruneton / ScratchaPixel). Roadmap Tier-1 #4 — "transformative + visually gorgeous + reusable as a
 * sky." Light-transport, not a gradient: the blue zenith, the reddened horizon/terminator, the bright
 * forward-scattering halo around the sun, and the backlit limb glow all emerge from the physics.
 *
 * The honest mechanism (the part a mesh/gradient cannot do): light from the sun is scattered toward the
 * eye by air molecules. Rayleigh scattering ∝ λ⁻⁴, so BLUE is scattered ~5× more than red → a blue sky;
 * looking along a long slant path (horizon / terminator) the blue is scattered OUT before it reaches
 * you, leaving RED → sunsets. Mie scattering off aerosols is ~grey and strongly forward → the white
 * halo hugging the sun.
 *
 * This is the SECOND consumer of the reusable volume-raymarch scaffold (volume-raymarch.js), and the
 * one that earned its two opt-in generalizations:
 *   • `rayDirArg` — the in-scattering depends on the view↔sun angle (the phase functions), so the
 *     transfer function needs the ray direction.
 *   • `occluder`  — the planet is a SOLID body that stops the ray; without it the stars would shine
 *     through the globe. The scaffold's `trans` already carries VIEW transmittance, so per-sample
 *     emission only needs in-scattered light × SUN transmittance — the single-scattering integral.
 *
 * Frame: the planet is centred at the origin (orbit it like the other object studies); the sun is a
 * direction. Orbit-only object study. Stored manifest IS the recipe:
 *   { kind:'atmosphere-view', scenario?, brightness?, viewBox?, scene?:{ bg? }, title? }
 */

import { buildVolumeFrag } from '@/lib/graph/effects/volume-raymarch';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const norm3 = ([x, y, z]) => { const m = Math.hypot(x, y, z) || 1; return [x / m, y / m, z / m]; };

// planet + atmosphere radii (unit-ish so the orbit camera stays inside OrbitControls' distance clamp).
// The atmosphere shell is drawn THICKER than Earth's real ~1.6% for visual clarity + march resolution —
// an "artistic but structurally honest" choice (the physics/colour is exact; the shell is exaggerated).
const RG = 6.0;          // ground / planet surface
const RT = 6.3;          // top of atmosphere
const CAM_DIST = 16;

// ── the atmospheric single-scattering transfer function (the per-view GLSL; the scaffold marches it) ──
const ATMO_GLOBALS = `
const float PI = 3.14159265;
const vec3  bR = vec3(1.55, 3.64, 6.27);   // Rayleigh scattering coeff (λ⁻⁴: blue ≫ red), artistically scaled
const float bM = 5.0;                       // Mie scattering coeff (aerosol haze, ~grey)
const float HR = 0.08;                      // Rayleigh scale height (relative to the unit planet)
const float HM = 0.02;                      // Mie scale height (haze hugs the surface)
const float gM = 0.76;                       // Mie anisotropy → the forward halo around the sun

// optical-depth densities from p toward the sun (secondary light march). vec2(odR, odM); .x < 0 ⇒ shadow.
vec2 sunOpticalDepth(vec3 p){
  vec2 tg = vrSphereT(p, uSunDir, uRg);
  if (tg.y > 0.0 && tg.x > 0.0) return vec2(-1.0);          // planet between p and the sun → in shadow
  vec2 ta = vrSphereT(p, uSunDir, uRt);
  float far = max(ta.y, 0.0);
  const int LN = 6;
  float ds = far / float(LN), odR = 0.0, odM = 0.0;
  for (int i = 0; i < LN; i++){
    vec3 q = p + uSunDir * (ds * (float(i) + 0.5));
    float h = max(length(q) - uRg, 0.0);
    odR += exp(-h / HR) * ds; odM += exp(-h / HM) * ds;
  }
  return vec2(odR, odM);
}

// the volume sample: ext = extinction at p; emis = in-scattered sunlight at p (attenuated to the sun).
// The scaffold's own view-transmittance then attenuates this from p back to the camera → the full integral.
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  float h = max(length(p) - uRg, 0.0);
  float rhoR = exp(-h / HR), rhoM = exp(-h / HM);
  ext = bR * rhoR + vec3(bM * 1.1) * rhoM;                  // Mie extinction ≈ 1.1× its scattering
  vec2 od = sunOpticalDepth(p);
  if (od.x < 0.0) { emis = vec3(0.0); return; }             // shadowed → no in-scattering here
  vec3 Tsun = exp(-(bR * od.x + vec3(bM * 1.1) * od.y));     // sun → p transmittance (reddens near grazing)
  float mu = dot(rd, uSunDir);
  float pR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);           // Rayleigh phase
  float g2 = gM * gM;
  float pM = 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) /
             ((2.0 + g2) * pow(1.0 + g2 - 2.0 * gM * mu, 1.5));   // Cornette–Shanks (Henyey–Greenstein) Mie phase
  emis = uSunI * Tsun * (bR * rhoR * pR + vec3(bM) * rhoM * pM);
}

// planet surface (the occluder): Lambert day/night, reddened by the sun's transmittance to that point.
// The atmosphere integrated IN FRONT of it (aerial perspective) is added by the scaffold's trans*emis.
vec3 groundColor(vec3 p, vec3 rd){
  vec3 n = normalize(p);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec2 od = sunOpticalDepth(p + n * 0.002);
  vec3 Tsun = od.x < 0.0 ? vec3(0.0) : exp(-(bR * od.x + vec3(bM * 1.1) * od.y));
  vec3 albedo = vec3(0.07, 0.10, 0.14);                    // dark blue-grey (ocean/land average)
  return albedo * (uSunI * 0.05) * ndl * Tsun + albedo * 0.015;
}

// background: the sun's disk where the ray escapes to space, over the faint starfield.
vec3 skybg(vec3 rd){
  float mu = dot(rd, uSunDir);
  float disk = smoothstep(0.9994, 0.99975, mu);
  return vrStars(rd) + vec3(1.0, 0.96, 0.9) * disk * uSunI * 0.5;
}
`;

export const ATMOSPHERE_FRAG = buildVolumeFrag({
  uniforms: ['uniform float uRg;', 'uniform float uRt;', 'uniform vec3 uSunDir;', 'uniform float uSunI;'],
  globals: ATMO_GLOBALS,
  boundsRadius: 'uRt',
  steps: 56,
  tonemap: 'aces',                 // filmic — rolls off the bright sun/horizon without clipping
  jitter: true,
  gamma: 2.2,
  background: 'skybg',
  rayDirArg: true,                 // in-scattering depends on the view↔sun angle (phase functions)
  occluder: { radiusUniform: 'uRg', groundFn: 'groundColor' },   // the planet is solid
});

// scenarios = sun direction (relative to the +z-facing camera) + intensity. The single biggest "look" knob.
const SCENARIOS = {
  day: {
    sun: [0.35, 0.25, 1.0], sunI: 20, fov: 40,
    readout: ['Atmospheric scattering — the blue marble', 'sun behind the camera → the full lit day disk',
      'Rayleigh ∝ λ⁻⁴ scatters blue ~5× more than red → blue sky', 'single-scattering volume integral, not a gradient'],
  },
  sunset: {
    sun: [1.0, 0.12, 0.18], sunI: 22, fov: 40,
    readout: ['Atmospheric scattering — the terminator', 'sun to the side → day/night line across the disk',
      'long slant path scatters blue OUT → the limb reddens (sunset)', 'forward Mie halo brightens toward the sun'],
  },
  limb: {
    sun: [0.0, 0.10, -1.0], sunI: 26, fov: 38,
    readout: ['Atmospheric scattering — the backlit limb', 'sun behind the planet → the night side, ringed by airglow',
      'the thin blue line seen from orbit (sunrise from the ISS)', 'Rayleigh blue on the limb, red where the path grazes deepest'],
  },
};

export const ATMOSPHERE_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planAtmosphereScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'day';
  const s = SCENARIOS[scenario];
  const sunI = clampNum(recipe.brightness, 4, 60, s.sunI);
  const cameraStart = [0, CAM_DIST * 0.18, CAM_DIST * 0.985];
  return {
    raymarch: {
      frag: ATMOSPHERE_FRAG,
      customUniforms: { uRg: RG, uRt: RT, uSunDir: norm3(s.sun), uSunI: sunI },
      cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: s.readout,
    },
    stats: { scenario, sunI, render: 'single-scattering atmosphere (ray-marched)' },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleAtmosphereScene(recipe = {}, { title } = {}) {
  const plan = planAtmosphereScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#01030a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} atmosphere`,
    bg,
  };
}
