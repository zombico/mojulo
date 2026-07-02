/**
 * fusion-view — NUCLEAR FUSION (D–T), ray-marched. The release-mechanism counterpart of fission-view:
 * where fission splits a heavy nucleus, fusion MERGES two light ones. Deuterium (²H) and tritium (³H)
 * overcome the Coulomb barrier, fuse into an excited ⁵He* compound nucleus, which immediately ejects a
 * fast neutron (14.1 MeV — carrying ~80% of the energy) while the He-4 alpha recoils the other way:
 *
 *     ²H + ³H  →  ⁴He + n  + 17.6 MeV
 *
 * Roadmap Category-3 "topology change" (a MERGE — the inverse of the fission split), reusing the volume-
 * raymarch scaffold (volume-raymarch.js) and the shared SDF snippets (sdf-glsl.js). The whole event lives
 * in ONE time-dependent density field, so it is self-contained in the volume shader:
 *   • approach — smin(ellipsoid_D, ellipsoid_T) with the separation SHRINKING as ξ advances (they close
 *                in fast — fusion needs the kinetic energy to beat the Coulomb barrier),
 *   • fusion   — the nuclei touch and merge into one hot compound blob (a white-hot flash),
 *   • products — the He-4 alpha drifts off slowly one way; a fast neutron spark shoots off the other
 *                (momentum conservation: the light neutron is 4× faster than the recoiling alpha).
 *
 * Frame: the reaction axis is +x; ξ loops off uTime so the event replays. Orbit-only object study (drag
 * to orbit). Stored manifest IS the recipe:
 *   { kind:'fusion-view', density?, viewBox?, scene?:{ bg? }, title? }
 */

import { buildVolumeFrag } from '@/lib/graph/effects/volume-raymarch';
import { SDF_GLSL } from '@/lib/graph/effects/sdf-glsl';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── the time-dependent D–T fusion field (the only per-view GLSL; the scaffold does the march) ──
const FUSION_GLOBALS = `
uniform float uRmax; uniform float uDens;
const float P_FUSE = 8.0;          // loop period (seconds)
const float XI_FUSE = 0.40;        // fission coordinate at which the two nuclei merge

// returns vec2( sdf , heat ): the deforming nucleus distance field + fusion heat at point p and time.
vec2 fusionField(vec3 p, float xi){
  float base = uRmax * 0.22;                                   // light nuclei → small; radius ∝ A^(1/3)
  float c3 = pow(3.0, 1.0 / 3.0);
  if (xi < XI_FUSE) {
    // APPROACH: deuterium (−x) and tritium (+x) close in; separation shrinks to ~0.
    float a = xi / XI_FUSE;                                    // 0 → 1
    float sep = mix(uRmax * 0.72, base * 0.28, smoothstep(0.0, 1.0, a));
    float rD = base * pow(2.0, 1.0 / 3.0) / c3;                // deuterium (2 nucleons)
    float rT = base;                                           // tritium (3 nucleons)
    float dD = sdfEllipsoid(p - vec3(-sep, 0.0, 0.0), vec3(rD));
    float dT = sdfEllipsoid(p - vec3(sep, 0.0, 0.0), vec3(rT));
    float kb = mix(base * 0.05, base * 0.95, smoothstep(0.6, 1.0, a));   // sharp pair → smooth merge as they near
    float d = sdfSmin(dD, dT, kb);
    float heat = smoothstep(0.72, 1.0, a)                      // heat builds as they compress and bind
               * exp(-(p.y * p.y + p.z * p.z) / (2.0 * pow(base * 0.5, 2.0)));
    return vec2(d, heat);
  }
  // PRODUCTS: the He-4 alpha recoils slowly along −x (the fast neutron is a spark added in volSample).
  float a = (xi - XI_FUSE) / (1.0 - XI_FUSE);                  // 0 → 1
  float rHe = base * pow(4.0, 1.0 / 3.0) / c3;                 // alpha (4 nucleons)
  vec3 cHe = vec3(-min(a * uRmax * 0.4, uRmax * 0.42), 0.0, 0.0);
  float d = sdfEllipsoid(p - cHe, vec3(rHe));
  float heat = (1.0 - smoothstep(0.0, 0.28, a))               // the fresh alpha glows, then cools
             * exp(-dot(p - cHe, p - cHe) / (2.0 * pow(rHe, 2.0)));
  return vec2(d, heat);
}

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float xi = fract(uTime / P_FUSE);
  float env = smoothstep(0.0, 0.05, xi) * (1.0 - smoothstep(0.92, 1.0, xi));   // seamless loop fade

  vec2 f = fusionField(p, xi);
  float shellW = uRmax * 0.045;
  float dens = smoothstep(shellW, -shellW, f.x) * uDens * env;

  bool products = xi >= XI_FUSE;
  vec3 coolCore = vec3(0.52, 0.66, 0.92);                      // the light reactant nuclei (D, T) — pale blue
  vec3 alphaCol = vec3(1.0, 0.72, 0.34);                       // the He-4 product — warm gold
  vec3 hot = vec3(1.0, 0.93, 0.72);                            // fusion heat — white-hot
  vec3 tint = mix(products ? alphaCol : coolCore, hot, clamp(f.y, 0.0, 1.0));
  emis = tint * dens * (0.7 + min(dens, 2.0) * 0.5);
  ext  = vec3(dens * 4.0);

  // the ejected 14 MeV NEUTRON: a small fast bright spark shooting +x (4× the alpha's recoil speed).
  if (products) {
    float a = (xi - XI_FUSE) / (1.0 - XI_FUSE);
    float nfade = 1.0 - smoothstep(0.90, 1.0, xi);
    vec3 nc = vec3(min(a * uRmax * 1.6, uRmax * 0.95), 0.0, 0.0);
    float g = exp(-dot(p - nc, p - nc) / (2.0 * pow(uRmax * 0.05, 2.0)));
    emis += vec3(0.6, 0.8, 1.0) * g * 3.0 * uDens * nfade;
    ext  += vec3(g * 0.6 * uDens * nfade);
  }

  // fusion flash: a brief, compact white-hot spark at the merge point (~origin) at the instant of fusion.
  float flash = exp(-pow((xi - XI_FUSE) / 0.022, 2.0))
              * exp(-dot(p, p) / (2.0 * pow(uRmax * 0.2, 2.0)));
  emis += vec3(1.0, 0.95, 0.85) * flash * 0.9;
}
`;

export const FUSION_FRAG = buildVolumeFrag({
  uniforms: [],                       // all declared in FUSION_GLOBALS
  globals: SDF_GLSL + FUSION_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 104,
  tonemap: 'aces',
  exposureUniform: null,
  jitter: true,
  gamma: 2.2,
});

const RMAX = 10;
const CAM_DIST = 26;

const READOUT = [
  'Nuclear fusion — D–T (²H + ³H → ⁴He + n)',
  'two light nuclei overcome the Coulomb barrier and MERGE',
  'the compound nucleus ejects a fast 14 MeV neutron (the flash)',
  'the He-4 alpha recoils slowly; the light neutron flies 4× faster',
];

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planFusionScene(recipe = {}) {
  const density = clampNum(recipe.density, 1, 30, 6);
  return {
    raymarch: {
      frag: FUSION_FRAG,
      customUniforms: { uRmax: RMAX, uDens: density },
      cameraStart: [0, CAM_DIST * 0.28, CAM_DIST * 0.96], target: [0, 0, 0], fov: 44,
      readout: READOUT,
    },
    stats: { density, render: 'volumetric D–T fusion (ray-marched, time-evolving)' },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleFusionScene(recipe = {}, { title } = {}) {
  const plan = planFusionScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05060c';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || 'mojulo nuclear fusion',
    bg,
  };
}
