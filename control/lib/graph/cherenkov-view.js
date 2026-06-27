/**
 * cherenkov-view — CHERENKOV RADIATION, the blue glow of a reactor pool, ray-marched. A genuine
 * LIGHT-TRANSPORT subject (the black-hole lane of the roadmap, not the topology lane of fission/fusion):
 * a charged particle moving through water FASTER than light-in-water (c/n, n≈1.33) drags a luminous
 * shock cone behind it — the optical analog of a sonic boom — and the emission is blue/UV-weighted
 * (Frank–Tamm, intensity ∝ 1/λ²). It is an emission–absorption VOLUME in a medium, so it reuses the
 * volume-raymarch scaffold (volume-raymarch.js) directly; the per-view transfer function is the only GLSL.
 *
 * Two closed-form scenarios share the scaffold (selected by uScenario, à la wavepacket-view):
 *   • pool — a reactor core submerged in water: the iconic eerie blue glow, brightest at the fuel and
 *            fading into the water, with a few energetic particle streaks rising. (the recognizable photo)
 *   • cone — the bare shock cone: a single relativistic particle moving +x, trailing a luminous Cherenkov
 *            cone whose half-angle obeys cos θc = 1/(βn) ≈ 0.76 → θc ≈ 41°. (the light-transport physics)
 *
 * Frame: orbit-only object study (drag to orbit); the glow animates on its own. Stored manifest IS the
 * recipe: { kind:'cherenkov-view', scenario?, density?, viewBox?, scene?:{ bg? }, title? }
 */

import { buildVolumeFrag } from '@/lib/graph/volume-raymarch';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── the Cherenkov emission field (the only per-view GLSL; the scaffold does ray-vs-bounds + the march) ──
const CHERENKOV_GLOBALS = `
uniform float uRmax; uniform float uDens; uniform int uScenario;
const float N_WATER = 1.33;                                   // refractive index of water
float chHash(float x){ return fract(sin(x * 127.1) * 43758.5453); }

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float t = uTime;
  vec3 blue = vec3(0.28, 0.55, 1.0);                          // Cherenkov blue (1/λ² → blue/UV weighted)
  float dens = 0.0;

  if (uScenario == 1) {
    // CONE: a relativistic particle moving +x trails a Cherenkov shock cone (apex at the particle).
    float beta = 0.99;
    float cosC = 1.0 / (beta * N_WATER);                      // cos θc = 1/(βn) — the cone half-angle
    float xc = mix(-uRmax * 0.85, uRmax * 0.85, fract(t / 6.0));
    vec3 A = vec3(xc, 0.0, 0.0), d = vec3(1.0, 0.0, 0.0);
    vec3 r = p - A; float rl = length(r);
    if (rl > 0.001) {
      float back = dot(r / rl, -d);                           // cos of the angle from the backward axis
      if (back > 0.0) {
        float band = exp(-pow((back - cosC) / 0.05, 2.0));    // luminous ON the cone surface
        float trail = exp(-rl / (uRmax * 0.7));               // fades with distance behind the particle
        dens += band * trail * 1.3;
      }
      dens += exp(-rl * rl / (2.0 * pow(uRmax * 0.03, 2.0))) * 2.2;   // the bright particle itself
    }
  } else {
    // POOL: a submerged reactor core — glow brightest at the fuel, fading into the water, plus a few
    // energetic charged-particle streaks rising through the pool (β·n > 1 in the active region).
    float rc = length(p);
    dens += exp(-rc / (uRmax * 0.18)) * 0.7;                  // the core glow — a bright knot at the fuel, fading into dark water
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float ph = fract(t / 4.5 + chHash(fi) * 1.7);
      vec3 s = vec3((chHash(fi + 3.0) * 2.0 - 1.0) * uRmax * 0.36,
                    mix(-uRmax * 0.30, uRmax * 0.95, ph),
                    (chHash(fi + 7.0) * 2.0 - 1.0) * uRmax * 0.36);
      dens += exp(-dot(p - s, p - s) / (2.0 * pow(uRmax * 0.045, 2.0))) * 1.0 * (1.0 - ph * 0.7);   // rising particle streaks
    }
  }

  // LINEAR emission — keep the BLUE ratio (a super-linear push clips all three channels → washed-out white).
  emis = blue * dens * uDens * 0.7;
  ext  = vec3(dens) * vec3(1.6, 1.1, 0.7) * 1.6;             // water reddens/darkens with depth → the glow deep-blue
}
`;

export const CHERENKOV_FRAG = buildVolumeFrag({
  uniforms: [],                       // all declared in CHERENKOV_GLOBALS
  globals: CHERENKOV_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 110,
  tonemap: 'aces',                    // ACES toe keeps the dark water black, shoulder rolls off the bright core
  exposureUniform: null,
  jitter: true,
  gamma: 2.2,
});

const RMAX = 10;
const CAM_DIST = 31;

const SCENARIOS = {
  pool: {
    idx: 0, dens: 4,
    readout: ['Cherenkov radiation — a reactor pool', 'charged particles outrun light-in-water (v > c/n)',
      'the medium glows BLUE (Frank–Tamm: intensity ∝ 1/λ²)', 'brightest at the fuel; energetic particles streak upward'],
  },
  cone: {
    idx: 1, dens: 5,
    readout: ['Cherenkov radiation — the shock cone', 'a relativistic particle moving faster than c/n',
      'trails a light cone: cos θc = 1/(βn) ≈ 0.76 (θc ≈ 41°)', 'the optical analog of a sonic boom'],
  },
};

export const CHERENKOV_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planCherenkovScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'pool';
  const s = SCENARIOS[scenario];
  const density = clampNum(recipe.density, 1, 30, s.dens);
  return {
    raymarch: {
      frag: CHERENKOV_FRAG,
      customUniforms: { uRmax: RMAX, uDens: density, uScenario: s.idx },
      cameraStart: [0, CAM_DIST * 0.22, CAM_DIST * 0.98], target: [0, 0, 0], fov: 44,
      readout: s.readout,
    },
    stats: { scenario, density, render: 'volumetric Cherenkov emission (ray-marched, time-evolving)' },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleCherenkovScene(recipe = {}, { title } = {}) {
  const plan = planCherenkovScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#02040a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} Cherenkov glow`,
    bg,
  };
}
