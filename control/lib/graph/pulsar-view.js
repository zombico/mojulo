/**
 * pulsar-view — a rotating, magnetised neutron star, distilled from star-birth-view's volumetric
 * language into a compact remnant.
 *
 * A pulsar is the neutron-star primitive (a tiny, savagely bright point) plus twin LIGHTHOUSE BEAMS
 * along a magnetic axis that is TILTED from the spin axis, so the beams sweep as the star rotates.
 * It rides the same per-pixel emission/absorption raymarch path as star-birth-view: the beams and
 * synchrotron nebula are luminous participating media, not meshes. The "pulse" is real geometry —
 * each time a beam crosses our sightline (mhat · view), the beams brighten.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'pulsar-view', scenario?, inclination?, exposure?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera around the pulsar). No walk, no /scene form.
 */

import { buildVolumeFrag } from './volume-raymarch.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const DEG = Math.PI / 180;

const PULSAR_GLOBALS = `
uniform float uRmax;
uniform float uExposure;
uniform float uObliquity;   // magnetic-axis tilt from the spin axis (radians)
uniform float uSpin;        // lighthouse rotation rate

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
  for (int i = 0; i < 3; i++) { s += a * sbNoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float r = length(p);
  vec3 dir = p / max(r, 1e-4);

  // spin: the magnetic axis is tilted from the spin (y) axis and rotates fast.
  float spin = uTime * uSpin;
  float chi = uObliquity;
  vec3 mhat = vec3(sin(chi) * cos(spin), cos(chi), sin(chi) * sin(spin));

  // neutron star: a tiny, savagely bright blue-white point.
  float ns = exp(-(r * r) / (2.0 * 0.05 * 0.05));

  // twin lighthouse beams along +/- mhat (a tight double cone).
  float md = dot(dir, mhat);
  float beamCone = pow(max(abs(md), 0.0), 36.0);
  float beamFall = exp(-r * 0.22) * smoothstep(uRmax, 0.4, r);
  float beamPack = 0.6 + 0.4 * sin(r * 3.0 - uTime * 9.0);
  float beam = beamCone * beamFall * beamPack;

  // pulse: brighten as a beam sweeps across our sightline (the observed pulse).
  float toCam = dot(mhat, normalize(uCamPos));
  float pulse = pow(abs(toCam), 6.0);

  // magnetospheric haze hugging the star.
  float magneto = exp(-r * 1.5) * (1.0 - 0.5 * beamCone);

  // faint synchrotron nebula (reused fbm cloud primitive).
  float ang = uTime * 0.03;
  float ca = cos(ang), sa = sin(ang);
  vec3 pn = vec3(ca * p.x - sa * p.z, p.y, sa * p.x + ca * p.z);
  float neb = exp(-r * 0.16) * smoothstep(uRmax, uRmax * 0.4, r) * pow(sbFbm(pn * 0.5 + 1.7), 2.0);

  vec3 nsBlue  = vec3(0.80, 0.90, 1.0);
  vec3 beamCol = vec3(0.55, 0.78, 1.0);
  vec3 magCol  = vec3(0.35, 0.55, 1.0);
  vec3 nebCol  = vec3(0.40, 0.66, 1.0);

  emis  = nsBlue * ns * 42.0;
  emis += beamCol * beam * (3.0 + 10.0 * pulse);
  emis += magCol * magneto * 0.5;
  emis += nebCol * neb * 0.55;

  ext = neb * vec3(0.55, 0.48, 0.70) * 0.45;   // the nebula faintly self-occludes
}
`;

export const PULSAR_FRAG = buildVolumeFrag({
  uniforms: [], // all declared in PULSAR_GLOBALS
  globals: PULSAR_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 72,
  tonemap: 'aces',
  exposureUniform: 'uExposure',
  jitter: true,
  gamma: 2.2,
});

const CAM_DIST = 17;
const RMAX = 9;

const SCENARIOS = {
  oblique:    { inclination: 62, obliquity: 0.60, spin: 2.2, exposure: 1.9, fov: 42 },
  orthogonal: { inclination: 74, obliquity: 1.45, spin: 2.0, exposure: 1.9, fov: 42 },
  aligned:    { inclination: 35, obliquity: 0.18, spin: 2.6, exposure: 2.0, fov: 42 },
};

export const PULSAR_SCENARIOS = Object.keys(SCENARIOS);

export function planPulsarScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'oblique';
  const s = SCENARIOS[scenario];
  const incl = clampNum(recipe.inclination, 0, 88, s.inclination);
  const exposure = clampNum(recipe.exposure, 0.4, 4, s.exposure);
  const el = (90 - incl) * DEG;
  const cameraStart = [0.001, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el)];

  return {
    raymarch: {
      frag: PULSAR_FRAG,
      customUniforms: {
        uRmax: RMAX,
        uExposure: exposure,
        uObliquity: s.obliquity,
        uSpin: s.spin,
      },
      cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: [
        'Pulsar — a magnetised, spinning neutron star',
        'twin beams stream from the magnetic poles',
        'the magnetic axis is tilted from the spin axis, so the beams sweep like a lighthouse',
        'each sweep across our sightline is one observed pulse',
        'embedded in a faint synchrotron nebula',
      ],
    },
    stats: { scenario, inclination: incl, exposure, render: 'rotating-neutron-star volumetric beams (ray-marched)' },
  };
}

export function assemblePulsarScene(recipe = {}, { title } = {}) {
  const plan = planPulsarScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#01020a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} pulsar`,
    bg,
  };
}
