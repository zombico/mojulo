/**
 * lightning-storm-view — a volumetric storm-cloud deck threaded with lightning, composed from two
 * reusable primitives: the fbm cloud (from star-birth-view's envelope) and an ELECTRIC-ARC primitive
 * (vrArc) — a jagged, bowed channel between two endpoints with a leader-progress input so a strike can
 * draw itself across an arc and then vanish.
 *
 * Rides the same emission/absorption raymarch path as star-birth-view. The clouds are dense
 * (extinction), so they OCCLUDE bolts behind them; each strike also lights the cloud around it
 * (the scattering that reads as sheet lightning). Two scenarios switch the strike geometry:
 *   'cloud-to-ground' — jagged bolts plunge from the deck toward the ground.
 *   'cloud-to-cloud'  — long horizontal arcs leap between cloud cells (they bow/wander with length).
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'lightning-storm-view', scenario?, exposure?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera). No walk, no /scene form.
 */

import { buildVolumeFrag } from '../../effects/volume-raymarch.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

const STORM_GLOBALS = `
uniform float uRmax;
uniform float uExposure;
uniform float uMode;     // 0 = cloud-to-ground, 1 = cloud-to-cloud

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

vec3 vrHash33(vec3 p){ return vec3(vrHash13(p), vrHash13(p + 19.1), vrHash13(p + 43.7)); }

// electric-arc primitive: a jagged, bowed channel from A to B. Returns the channel glow at p.
// prog = how far the leader has drawn (0..1); width = half-width. Longer arcs bow/wander more.
float vrArc(vec3 p, vec3 A, vec3 B, float seed, float prog, float width, float t){
  vec3 AB = B - A; float L2 = max(dot(AB, AB), 1e-3);
  float s = clamp(dot(p - A, AB) / L2, 0.0, 1.0);
  vec3 dirn = AB * inversesqrt(L2);
  vec3 ref = abs(dirn.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 e1 = normalize(cross(dirn, ref));
  vec3 e2 = cross(dirn, e1);
  float bow = 4.0 * s * (1.0 - s);
  float k1 = sin(s * 13.0 + seed * 6.0 + t * 2.0);
  float k2 = sin(s * 31.0 + seed * 11.0 - t * 3.0);
  float k3 = cos(s * 23.0 - seed * 4.0 + t * 2.5);
  float wob = 0.5 + 0.07 * sqrt(L2);                       // longer arcs wander & bow more
  float ox = bow * wob * (sin(seed * 5.0) + 0.5 * k1 + 0.25 * k2);
  float oz = bow * wob * (cos(seed * 3.0) + 0.5 * k3 + 0.22 * k2);
  vec3 C = A + AB * s + e1 * ox + e2 * oz;
  float dist = length(p - C);
  float tip = smoothstep(prog, prog - 0.05, s);            // nothing rendered ahead of the leader
  float w = width * (0.7 + 0.6 * (1.0 - s));
  return exp(-(dist * dist) / (2.0 * w * w)) * tip;
}

vec3 lsBg(vec3 rd){
  return mix(vec3(0.045, 0.030, 0.075), vec3(0.045, 0.050, 0.115), clamp(rd.y * 0.6 + 0.45, 0.0, 1.0));
}

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float t = uTime;

  // storm cloud deck: volumetric fbm clouds in a height band.
  vec3 q = p * 0.05 + vec3(t * 0.012, 0.0, t * 0.004);
  float bse = sbFbm(q);
  float dens = sbFbm(q * 2.4 + bse * 0.8);
  float band = smoothstep(1.0, 7.0, p.y) * (1.0 - smoothstep(15.0, 24.0, p.y));
  float cloud = max(dens - 0.42, 0.0) * band * 2.6;

  // lightning: discrete strikes from the electric-arc primitive. Each picks a fresh path each cycle;
  // the leader travels A->B (prog), the return stroke flashes, then it vanishes. It also lights the cloud.
  float boltGlow = 0.0, litAmt = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float period = 2.6 + fi * 0.9;
    float tt = (t + fi * 1.7) / period;
    float ci = floor(tt), ph = fract(tt);
    float prog = smoothstep(0.0, 0.14, ph);
    float ret  = exp(-max(ph - 0.14, 0.0) * 15.0);
    float life = 1.0 - smoothstep(0.25, 0.42, ph);
    float flick = 0.6 + 0.4 * sin(ph * 90.0 + ci + fi);
    float amp = (0.22 * prog + ret) * life * flick;
    if (amp < 0.002) continue;
    vec3 hA = vrHash33(vec3(ci, fi, 3.0));
    vec3 hB = vrHash33(vec3(ci, fi, 9.0));
    vec3 A, B;
    if (uMode < 0.5) {
      A = vec3((hA.x - 0.5) * 30.0, 8.0 + hA.y * 7.0, (hA.z - 0.5) * 30.0);          // in the deck
      B = A + vec3((hB.x - 0.5) * 26.0, -(7.0 + hB.y * 11.0), (hB.z - 0.5) * 26.0);  // arc down to ground
    } else {
      A = vec3((hA.x - 0.5) * 34.0, 9.0 + hA.y * 6.0, (hA.z - 0.5) * 34.0);          // one cloud cell
      B = A + vec3((hB.x - 0.5) * 44.0, (hB.y - 0.5) * 5.0, (hB.z - 0.5) * 44.0);    // arc across to another
    }
    boltGlow += vrArc(p, A, B, hA.x + fi, prog, 0.55, t) * amp;
    vec3 AB = B - A; float s = clamp(dot(p - A, AB) / max(dot(AB, AB), 1e-3), 0.0, 1.0);
    litAmt += amp * exp(-length(p - (A + AB * s)) * 0.05);
  }

  vec3 cloudDark = vec3(0.07, 0.06, 0.15);     // deep indigo deck in shadow
  vec3 cloudLit  = vec3(0.58, 0.56, 1.0);      // cool violet where a strike lights it
  vec3 boltCol   = vec3(0.74, 0.78, 1.0);      // blue-violet halo (core saturates to white)
  vec3 cloudCol = mix(cloudDark, cloudLit, clamp(litAmt * 0.9, 0.0, 1.0));

  emis  = cloudCol * cloud * 0.6;
  emis += boltCol * boltGlow * 7.0;

  ext = vec3(cloud * 1.4);                     // clouds are dense -> they occlude bolts behind them
}
`;

export const LIGHTNING_STORM_FRAG = buildVolumeFrag({
  uniforms: [], // all declared in STORM_GLOBALS
  globals: STORM_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 112,
  tonemap: 'aces',
  exposureUniform: 'uExposure',
  jitter: true,
  gamma: 2.2,
  background: 'lsBg',
});

const RMAX = 30;

const SCENARIOS = {
  'cloud-to-ground': { mode: 0, exposure: 1.9, fov: 42, camera: [0.001, 4, 22], target: [0, 8, 0] },
  'cloud-to-cloud':  { mode: 1, exposure: 1.9, fov: 42, camera: [0.001, 5, 26], target: [0, 11, 0] },
};

export const LIGHTNING_STORM_SCENARIOS = Object.keys(SCENARIOS);

export function planLightningStormScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'cloud-to-ground';
  const s = SCENARIOS[scenario];
  const exposure = clampNum(recipe.exposure, 0.4, 4, s.exposure);

  return {
    raymarch: {
      frag: LIGHTNING_STORM_FRAG,
      customUniforms: {
        uRmax: RMAX,
        uExposure: exposure,
        uMode: s.mode,
      },
      cameraStart: s.camera, target: s.target, fov: s.fov,
      readout: scenario === 'cloud-to-cloud'
        ? [
            'Cloud-to-cloud lightning',
            'horizontal arcs leap between cloud cells within the deck',
            'each strike appears, the leader travels across, then it vanishes',
            'longer arcs bow and wander more; the cloud lights up around them',
          ]
        : [
            'Cloud-to-ground lightning',
            'a volumetric cloud deck (fbm) over jagged lightning channels',
            'strikes appear, the leader travels along an arc, then they vanish',
            'each flash lights the cloud; dense cloud occludes bolts behind it',
          ],
    },
    stats: { scenario, exposure, render: 'volumetric storm deck + electric-arc strikes (ray-marched)' },
  };
}

export function assembleLightningStormScene(recipe = {}, { title } = {}) {
  const plan = planLightningStormScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05060f';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} lightning`,
    bg,
  };
}
