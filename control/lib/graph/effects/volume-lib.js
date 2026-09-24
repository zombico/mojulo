/**
 * volume-lib — shared GLSL for LIT volumes on the raymarch effects spine (docs/raymarch-effects-layer.md).
 *
 * Lifted from the 2026-09-17 smoke-and-cloud spike, where every lit variant (fog, deck, burst smoke)
 * turned out to need the same four things on top of buildVolumeFrag's march: a noise that is not
 * piecewise-constant cubes, a Worley field for round puff edges, a phase function, and a sun
 * light-march for self-shadowing. Each block is a pure string; concatenate them into a
 * `buildVolumeFrag` `globals` (or any overlay frag) in the order noise → phase → sun → light.
 * Names are prefixed `sv` so they never collide with a consumer's globals or with buildVolumeFrag's
 * `vr*` helpers; the noise block carries its own hash, so it works in frags that are not built by
 * buildVolumeFrag at all (the cloud deck's plane shader).
 *
 * ENERGY RULES (the spike learned these by clipping — the overlay path has NO tonemap):
 *   • The phase is normalised so isotropic == 1 (`svHG × 4π`), and `svPhase` CAPS the forward peak
 *     (`VOLUME_ENERGY.phaseCap`). Keep g ≤ 0.45 for fog, ≤ 0.65 for clouds.
 *   • Sun colour × peak must stay ≲ 2, or a backlit view clips white.
 *   • Light-march only where density > eps; taps widen geometrically (5 taps, ×1.6 is enough).
 *   • Worley inside the light march is the cost cliff: give the march a cheaper shadow density
 *     (`shadowFn`) — fbm only, or `svWorley8` — and keep the 27-tap Worley for the primary shape.
 */

/** JS-side constants for consumers that want to respect the same limits. */
export const VOLUME_ENERGY = Object.freeze({ gFogMax: 0.45, gCloudMax: 0.65, phaseCap: 2.0 });

const f = (x) => (+x).toFixed(4);
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

/**
 * Noise + shape fields. Self-contained (own hash).
 *   svNoise   — trilinear value noise (the one change that removes effects-fog's cubes).
 *   svFbm     — 4 octaves of svNoise.
 *   svWorley  — F1 cellular distance, 3×3×3 taps: 0 at feature points, ~1 between; (1 − w) is a puff.
 *   svWorley8 — the 2×2×2 (8-tap) cheap twin for inner loops.
 */
export const VOLUME_NOISE_GLSL = `
#define SV_PI 3.14159265
float svHash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 svHash33(vec3 p){ return vec3(svHash13(p), svHash13(p + 19.1), svHash13(p + 43.7)); }
float svNoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = svHash13(i), n100 = svHash13(i + vec3(1,0,0)), n010 = svHash13(i + vec3(0,1,0)), n110 = svHash13(i + vec3(1,1,0));
  float n001 = svHash13(i + vec3(0,0,1)), n101 = svHash13(i + vec3(1,0,1)), n011 = svHash13(i + vec3(0,1,1)), n111 = svHash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float svFbm(vec3 p){ float v = 0.0, a = 0.55; for (int i = 0; i < 4; i++){ v += a * svNoise(p); p = p * 2.02 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return v; }
float svWorley(vec3 p){
  vec3 i = floor(p), f = fract(p); float d = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 o = svHash33(i + g); vec3 r = g + o - f; d = min(d, dot(r, r));
  }
  return sqrt(d);
}
float svWorley8(vec3 p){
  vec3 i = floor(p), f = fract(p); float d = 1.0;
  for (int x = 0; x <= 1; x++) for (int y = 0; y <= 1; y++) for (int z = 0; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 o = svHash33(i + g); vec3 r = g + o - f; d = min(d, dot(r, r));
  }
  return sqrt(d);
}
`;

/**
 * Phase functions.
 *   svHG(mu, g)                         — Henyey–Greenstein, unnormalised (integrates to 1 over the sphere).
 *   svPhase(mu, gFwd, gBack, wBack, cap) — dual-lobe HG × 4π (isotropic == 1), forward peak clamped to `cap`.
 */
export const VOLUME_PHASE_GLSL = `
float svHG(float mu, float g){ float g2 = g * g; return (1.0 - g2) / (4.0 * SV_PI * pow(1.0 + g2 - 2.0 * g * mu, 1.5)); }
float svPhase(float mu, float gFwd, float gBack, float wBack, float cap){
  return min(mix(svHG(mu, gFwd), svHG(mu, gBack), wBack) * 4.0 * SV_PI, cap);
}
`;

/**
 * Sun + ambient constants in the consumer's frame (the sun vector is NOT re-oriented: pass it in the
 * same up-axis the density uses).
 * @param {object} [opts]
 * @param {number[]} [opts.sun=[0.35,-0.25,0.75]]  direction TOWARD the sun (normalised here).
 * @param {number[]} [opts.sunCol=[1.00,0.94,0.84]] · [opts.sunScale=1.0] sun radiance colour × scale.
 * @param {number[]} [opts.skyCol=[0.52,0.64,0.86]] · [opts.gndCol=[0.30,0.28,0.25]] ambient poles.
 */
export function volumeSunGLSL({ sun = [0.35, -0.25, 0.75], sunCol = [1.00, 0.94, 0.84], sunScale = 1.0, skyCol = [0.52, 0.64, 0.86], gndCol = [0.30, 0.28, 0.25] } = {}) {
  const len = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const s = sun.map((c) => c / len);
  return `
const vec3 SV_SUN = ${v3(s)};
const vec3 SV_SUNCOL = ${v3(sunCol)} * ${f(sunScale)};
const vec3 SV_SKYCOL = ${v3(skyCol)};
const vec3 SV_GNDCOL = ${v3(gndCol)};
`;
}

/**
 * The sun light-march + in-scattered radiance. Needs VOLUME_NOISE_GLSL, VOLUME_PHASE_GLSL,
 * volumeSunGLSL() and `float <shadowFn>(vec3)` concatenated BEFORE it.
 *   svShadow(p, sigma)  — Beer's law along `taps` widening taps toward SV_SUN → transmittance.
 *   svLight(p, rd, d, sigma, hNorm, ambAmt, powderK)
 *                       — SV_SUNCOL × shadow × phase × powder + mix(SV_GNDCOL, SV_SKYCOL, hNorm) × ambAmt.
 * @param {object} [opts]
 * @param {string} [opts.shadowFn='density']  the density the march samples (use a cheap twin).
 * @param {number} [opts.taps=5] · [opts.step0=0.8] · [opts.grow=1.6]   the march's tap schedule.
 * @param {number} [opts.gFwd=0.55] · [opts.gBack=-0.18] · [opts.wBack=0.32]  dual-lobe HG.
 * @param {number} [opts.phaseCap=VOLUME_ENERGY.phaseCap]
 */
export function volumeLightGLSL({ shadowFn = 'density', taps = 5, step0 = 0.8, grow = 1.6, gFwd = 0.55, gBack = -0.18, wBack = 0.32, phaseCap = VOLUME_ENERGY.phaseCap } = {}) {
  const n = Math.max(1, Math.floor(taps));
  return `
float svShadow(vec3 p, float sigma){
  float od = 0.0, ds = ${f(step0)}; vec3 q = p;
  for (int i = 0; i < ${n}; i++){ q += SV_SUN * ds; od += ${shadowFn}(q) * ds; ds *= ${f(grow)}; }
  return exp(-od * sigma);
}
vec3 svLight(vec3 p, vec3 rd, float d, float sigma, float hNorm, float ambAmt, float powderK){
  float mu = dot(rd, SV_SUN);
  float phase = svPhase(mu, ${f(gFwd)}, ${f(gBack)}, ${f(wBack)}, ${f(phaseCap)});
  float powder = powderK > 0.0 ? mix(1.0, 1.0 - exp(-d * sigma * powderK), clamp(0.5 + 0.5 * mu, 0.0, 1.0)) : 1.0;
  vec3 sun = SV_SUNCOL * svShadow(p, sigma) * phase * powder;
  vec3 amb = mix(SV_GNDCOL, SV_SKYCOL, clamp(hNorm, 0.0, 1.0)) * ambAmt;
  return sun + amb;
}
`;
}
