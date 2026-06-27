/**
 * star-birth-view — a single-star composition distilled from galaxy-view's volumetric language.
 *
 * A forming star is not a mesh object yet: it is dusty molecular gas, a collapsing envelope, a hot
 * protostar, an accretion disk, and bipolar outflow cavities. This view rides the same per-pixel
 * emission/absorption raymarch path as galaxy-view, but folds the galaxy-scale disk into one stellar
 * nursery centred on a single protostar.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'star-birth-view', scenario?, inclination?, exposure?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera around the nursery). No walk, no /scene form.
 */

import { buildVolumeFrag } from './volume-raymarch.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const DEG = Math.PI / 180;

const STAR_BIRTH_GLOBALS = `
uniform float uRmax;
uniform float uCore;
uniform float uDisk;
uniform float uOutflow;
uniform float uCavity;
uniform float uExposure;

float sbHash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 31.32); return fract((p.x + p.y) * p.z); }
float sbNoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n000 = sbHash13(i), n100 = sbHash13(i + vec3(1,0,0));
  float n010 = sbHash13(i + vec3(0,1,0)), n110 = sbHash13(i + vec3(1,1,0));
  float n001 = sbHash13(i + vec3(0,0,1)), n101 = sbHash13(i + vec3(1,0,1));
  float n011 = sbHash13(i + vec3(0,1,1)), n111 = sbHash13(i + vec3(1,1,1));
  float nx00 = mix(n000, n100, f.x), nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x), nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}
float sbFbm(vec3 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * sbNoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float r = length(p);
  float cyl = length(p.xz);
  float h = p.y;

  vec3 warped = p + vec3(
    sbFbm(p * 0.22 + vec3(7.1, 0.0, 1.3)),
    sbFbm(p * 0.20 + vec3(2.0, 8.0, 4.0)),
    sbFbm(p * 0.23 + vec3(5.0, 1.0, 9.0))
  ) * 2.4;

  float cloudBase = exp(-r * 0.25) * smoothstep(uRmax, uRmax * 0.58, r);
  float knots = pow(sbFbm(warped * 0.62), 2.2);
  float filaments = pow(sbFbm(vec3(atan(p.z, p.x) * 1.8, r * 0.45, h * 0.34) + warped * 0.12), 3.2);
  float envelope = cloudBase * (0.18 + 1.25 * knots + 1.7 * filaments);

  // Bipolar cavities carve the dusty envelope along the spin axis; the blue scattering marks jets.
  float cone = cyl / (abs(h) + 0.34);
  float cavity = smoothstep(uCavity + 0.18, uCavity - 0.05, cone) * smoothstep(0.65, 2.8, abs(h));
  float jetCore = exp(-cone * cone * 2.8) * smoothstep(0.35, 2.0, abs(h)) * smoothstep(uRmax * 0.78, uRmax * 0.2, abs(h));

  float diskHeight = 0.12 + 0.04 * cyl;
  float disk = exp(-abs(h) / diskHeight) * exp(-cyl / 2.7) * smoothstep(0.18, 0.7, cyl) * uDisk;
  float innerDisk = exp(-abs(h) / 0.12) * exp(-cyl / 0.9) * uDisk;
  float core = exp(-(r * r) / (2.0 * uCore * uCore));
  float glow = exp(-(r * r) / (2.0 * 1.15 * 1.15));

  float dust = max(envelope * mix(1.0, 0.22, cavity), 0.0) + disk * 0.75;
  vec3 coldDust = vec3(0.55, 0.22, 0.12);
  vec3 warmDust = vec3(1.0, 0.50, 0.20);
  vec3 hotCore = vec3(1.0, 0.88, 0.58);
  vec3 jetBlue = vec3(0.42, 0.66, 1.0);
  vec3 haPink = vec3(1.0, 0.35, 0.50);

  emis  = coldDust * envelope * 0.11;
  emis += warmDust * disk * 0.42;
  emis += warmDust * innerDisk * 1.2;
  emis += hotCore * core * 7.0;
  emis += hotCore * glow * 0.35;
  emis += jetBlue * jetCore * uOutflow * 1.5;
  emis += haPink * envelope * pow(knots, 4.0) * 0.8;

  // Dust absorbs blue light more strongly, so the far-side protostar reddens through the envelope.
  ext = dust * vec3(2.15, 1.42, 0.82);
}
`;

export const STAR_BIRTH_FRAG = buildVolumeFrag({
  uniforms: [], // all declared in STAR_BIRTH_GLOBALS
  globals: STAR_BIRTH_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 132,
  tonemap: 'aces',
  exposureUniform: 'uExposure',
  jitter: true,
  gamma: 2.2,
});

const CAM_DIST = 20;
const RMAX = 9;

const SCENARIOS = {
  collapse: { inclination: 38, exposure: 1.45, core: 0.46, disk: 0.48, outflow: 0.18, cavity: 0.28, fov: 43 },
  protostar: { inclination: 55, exposure: 1.7, core: 0.34, disk: 0.95, outflow: 0.58, cavity: 0.42, fov: 42 },
  outflow: { inclination: 72, exposure: 1.9, core: 0.30, disk: 0.9, outflow: 1.0, cavity: 0.56, fov: 40 },
};

export const STAR_BIRTH_SCENARIOS = Object.keys(SCENARIOS);

export function planStarBirthScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'protostar';
  const s = SCENARIOS[scenario];
  const incl = clampNum(recipe.inclination, 0, 88, s.inclination);
  const exposure = clampNum(recipe.exposure, 0.4, 4, s.exposure);
  const el = (90 - incl) * DEG;
  const cameraStart = [0.001, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el)];

  return {
    raymarch: {
      frag: STAR_BIRTH_FRAG,
      customUniforms: {
        uRmax: RMAX,
        uCore: s.core,
        uDisk: s.disk,
        uOutflow: s.outflow,
        uCavity: s.cavity,
        uExposure: exposure,
      },
      cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: [
        'Birth of a star — collapsing molecular cloud',
        'dusty envelope: emission + extinction, not a point sprite',
        'protostar core embedded in an accretion disk',
        'bipolar outflow cavities along the spin axis',
        'blue light is absorbed first, so dust reddens the hidden core',
      ],
    },
    stats: { scenario, inclination: incl, exposure, render: 'single-star volumetric nursery (ray-marched)' },
  };
}

export function assembleStarBirthScene(recipe = {}, { title } = {}) {
  const plan = planStarBirthScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#01020a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} star birth`,
    bg,
  };
}
