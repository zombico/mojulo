/**
 * plasma-globe-view — a Tesla-style plasma globe: a high-voltage electrode in low-pressure gas, with
 * discrete jagged arcs leaping to the surrounding glass.
 *
 * Built from the same volumetric raymarch path as star-birth-view, but the transfer function is
 * EMISSIVE-ONLY (ext = 0): plasma glows, it does not occlude. Each arc is a jagged radial channel
 * rendered by distance-to-centreline (not a noise cloud), coloured by a two-gas excitation gradient —
 * neon red near the hot electrode fading to argon/xenon violet-blue at the glass, the way real
 * gas-discharge emission spectra read.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'plasma-globe-view', scenario?, inclination?, exposure?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera around the globe). No walk, no /scene form.
 */

import { buildVolumeFrag } from './volume-raymarch.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const DEG = Math.PI / 180;

const PLASMA_GLOBALS = `
uniform float uRmax;
uniform float uExposure;
uniform float uGas;     // 0 = neon/argon (pink->violet), 1 = xenon (pink->blue-white)

vec3 pgBg(vec3 rd){ return vec3(0.012, 0.010, 0.022); }   // dark room behind the globe

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float r = length(p);
  float t = uTime;
  float Rg = uRmax * 0.96;
  float u = clamp(r / Rg, 0.0, 1.0);
  float win = sin(3.14159265 * u);                 // each arc is pinned at the electrode (u=0) and glass (u=1)

  // central electrode: a bright hot point + soft glow.
  float electrode = exp(-(r * r) / (2.0 * 0.18 * 0.18)) * (0.9 + 0.1 * sin(t * 30.0));
  float eGlow = exp(-r * 1.5);

  // discrete jagged arcs: glow = distance from the sample to each radial bolt centreline.
  float glow = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float seed = fi * 7.13;
    float az = seed + t * (0.25 + 0.05 * fi);
    float el = 1.2 + 0.9 * sin(seed * 1.7 + t * 0.2);
    vec3 a = vec3(sin(el) * cos(az), cos(el), sin(el) * sin(az));   // glass anchor, drifting
    vec3 ref = abs(a.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 e1 = normalize(cross(a, ref));
    vec3 e2 = cross(a, e1);
    float jx = sin(u * 9.0 + seed + t * 3.0) * 0.6 + sin(u * 21.0 + seed * 2.0 - t * 6.0) * 0.32;
    float jy = cos(u * 11.0 + seed * 1.7 + t * 2.3) * 0.6 + cos(u * 25.0 - seed + t * 5.0) * 0.32;
    vec3 C = a * (u * Rg) + (e1 * jx + e2 * jy) * (1.3 * win);      // jagged centreline at this radius
    float dist = length(p - C);
    float w = 0.16 + 0.05 * u;                                     // channel half-width, thicker near the glass
    float flick = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (6.0 + fi) + seed * 3.0));  // arcs dance / drop out
    glow += exp(-(dist * dist) / (2.0 * w * w)) * flick;
  }

  float gd = (r - Rg) / 0.5;
  float rim = exp(-gd * gd) * 0.10;

  // two-gas fill: neon emits red where the current is hot near the electrode; argon/xenon emit
  // violet-blue out toward the glass — the excitation gradient along each channel.
  vec3 cNeon  = vec3(1.0, 0.28, 0.34);
  vec3 cArgon = mix(vec3(0.40, 0.46, 1.0), vec3(0.55, 0.72, 1.0), uGas);   // argon -> xenon tip
  vec3 cHot   = vec3(1.0, 0.92, 1.0);
  vec3 cElec  = vec3(1.0, 0.82, 0.80);
  vec3 cGlass = vec3(0.45, 0.52, 1.0);
  vec3 gasCol = mix(cNeon, cArgon, smoothstep(0.12, 0.9, u));      // red root -> blue tip
  vec3 arcCol = mix(gasCol, cHot, smoothstep(0.5, 1.1, glow));     // bright centres flash white-hot

  emis  = cElec * electrode * 26.0;
  emis += cElec * eGlow * 0.7;
  emis += arcCol * glow * 2.8;
  emis += cGlass * rim;

  ext = vec3(0.0);   // plasma is emissive; the glass barely absorbs
}
`;

export const PLASMA_GLOBE_FRAG = buildVolumeFrag({
  uniforms: [], // all declared in PLASMA_GLOBALS
  globals: PLASMA_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 96,
  tonemap: 'aces',
  exposureUniform: 'uExposure',
  jitter: true,
  gamma: 2.2,
  background: 'pgBg',
});

const CAM_DIST = 19;
const RMAX = 9;

const SCENARIOS = {
  'neon-argon': { inclination: 32, gas: 0.0, exposure: 1.9, fov: 42 },
  argon:        { inclination: 28, gas: 0.4, exposure: 1.85, fov: 42 },
  xenon:        { inclination: 36, gas: 1.0, exposure: 1.95, fov: 42 },
};

export const PLASMA_GLOBE_SCENARIOS = Object.keys(SCENARIOS);

export function planPlasmaGlobeScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'neon-argon';
  const s = SCENARIOS[scenario];
  const incl = clampNum(recipe.inclination, 0, 88, s.inclination);
  const exposure = clampNum(recipe.exposure, 0.4, 4, s.exposure);
  const el = (90 - incl) * DEG;
  const cameraStart = [0.001, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el)];

  return {
    raymarch: {
      frag: PLASMA_GLOBE_FRAG,
      customUniforms: {
        uRmax: RMAX,
        uExposure: exposure,
        uGas: s.gas,
      },
      cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: [
        'Plasma globe — a high-voltage electrode in low-pressure gas',
        'discrete arcs leap from the central electrode to the glass',
        'each is a jagged radial channel (distance-to-bolt, not a cloud)',
        'gas-discharge spectra: neon red at the hot root, argon/xenon blue at the glass',
      ],
    },
    stats: { scenario, inclination: incl, exposure, render: 'emissive plasma-globe arcs (ray-marched)' },
  };
}

export function assemblePlasmaGlobeScene(recipe = {}, { title } = {}) {
  const plan = planPlasmaGlobeScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#020208';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} plasma globe`,
    bg,
  };
}
