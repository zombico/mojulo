/**
 * The light world's shader: each pixel's ray traced back from the eye through the Schwarzschild spacetime with
 * geodesic.js `traceRay`'s own scheme, step for step (Synge's eye correction, velocity Verlet with a step ∝ r, the
 * same horizon and escape radius, the disk's first crossing and its g factor). The scheme's numbers come from
 * LIGHT_SCHEME and the model's from uniforms, so nothing here is a hand-typed twin of a JS constant; the conformance
 * gate holds the two together (shader.js, conformance.js).
 *
 * The model is what a ray does (captured, escaped and where to, or the disk ring it meets and its g). How that is
 * coloured is dress: the disk's temperatures stretched into visible colours, the sky a grid or stars, the exposure.
 *
 * Frame: z-up, the disk in z = 0, one scene unit = one Schwarzschild radius.
 */

import { LIGHT_SCHEME } from './geodesic.js';
import { shaderPage } from '../shader.js';

const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

export function lightShader({ inner = 0, outer = 0, sky = 'grid', hottest = 9000, exposure = 1 }) {
  const glsl = `
const int MAX_STEPS = ${LIGHT_SCHEME.maxSteps};
const float K_STEP = ${f(LIGHT_SCHEME.k)};
const float HORIZON = ${f(LIGHT_SCHEME.horizon)};

// Synge: a still eye at radius D sees angle α; the coordinate ray leaves at sin α_c = sin α / √(1 − 1/D)
vec3 eyeToCoordinate(vec3 ro, vec3 rd) {
  float D = length(ro); vec3 rh = ro / D;
  float cr = -dot(rd, rh);
  vec3 tang = rd + rh * cr; float st = length(tang);
  if (st < 1e-9) return rd;
  float sa = min(1.0, st / sqrt(1.0 - 1.0 / D));
  float ca = (cr >= 0.0 ? 1.0 : -1.0) * sqrt(max(0.0, 1.0 - sa * sa));
  return rh * (-ca) + tang * (sa / st);
}
float diskG(float r, float lambda, float D) {
  float omega = sqrt(0.5 / (r * r * r));
  return sqrt(1.0 - 1.5 / r) / (sqrt(1.0 - 1.0 / D) * (1.0 - omega * lambda));
}
// fate: 0 escaped (dir), 1 captured, 2 unfinished; hit: x = 1 if the disk was met, y = its radius, z = g
void trace(vec3 ro, vec3 rd, out float fate, out vec3 dir, out vec3 hit) {
  float D = length(ro);
  float far = max(max(400.0, 4.0 * D), 4.0 * uOuter);
  vec3 x = ro, v = eyeToCoordinate(ro, rd);
  vec3 Lv = cross(x, v); float h2 = dot(Lv, Lv), lambda = -Lv.z;
  float r = length(x);
  vec3 a = x * (-1.5 * h2 / (r * r * r * r * r));
  fate = 2.0; dir = vec3(0.0); hit = vec3(0.0);
  for (int i = 0; i < MAX_STEPS; i++) {
    r = length(x);
    if (r < HORIZON) { fate = 1.0; return; }
    if (r > far && dot(x, v) > 0.0) { fate = 0.0; dir = normalize(v); return; }
    float dl = K_STEP * r;
    vec3 vh = v + a * (0.5 * dl);
    vec3 xn = x + vh * dl;
    float rn = length(xn);
    vec3 an = xn * (-1.5 * h2 / (rn * rn * rn * rn * rn));
    vec3 vn = vh + an * (0.5 * dl);
    if (uOuter > 0.0 && hit.x < 0.5 && (x.z > 0.0) != (xn.z > 0.0)) {
      float q = x.z / (x.z - xn.z);
      vec3 p = x + (xn - x) * q;
      float rho = length(p.xy);
      if (rho >= uInner && rho <= uOuter) hit = vec3(1.0, rho, diskG(rho, lambda, D));
    }
    x = xn; v = vn; a = an;
  }
}

// ── the dress: how a ray's fate is coloured ──
vec3 blackbody(float T) {   // an approximate blackbody colour, T in kelvin (Tanner Helland's fit)
  float t = clamp(T, 1000.0, 40000.0) / 100.0;
  float rr = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
  float gg = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0) : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float bb = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962541, 0.0, 1.0));
  return vec3(rr, gg, bb);
}
float profile(float r) { return pow(r, -0.75) * pow(max(0.0, 1.0 - sqrt(uInner / r)), 0.25); }
vec3 skyColour(vec3 d) {
  ${sky === 'plain' ? 'return vec3(0.6, 0.65, 0.75);' : sky === 'stars' ? `
  vec3 c = vec3(0.01, 0.012, 0.02);
  vec3 cell = floor(d * 180.0);
  float s = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  if (s > 0.992) c += vec3(0.9, 0.92, 1.0) * (s - 0.992) * 125.0;
  return c;` : `
  float lat = asin(clamp(d.z, -1.0, 1.0)), lon = atan(d.y, d.x);
  float gs = 0.2617994;   // 15°
  float gl = min(abs(fract(lat / gs + 0.5) - 0.5), abs(fract(lon / gs + 0.5) - 0.5));
  vec3 base = mix(vec3(0.03, 0.035, 0.06), vec3(0.06, 0.05, 0.08), 0.5 + 0.5 * d.z);
  return base + vec3(0.28, 0.32, 0.42) * smoothstep(0.06, 0.0, gl);`}
}
vec4 sciImage(vec3 ro, vec3 rd) {
  float fate; vec3 dir, hit;
  trace(ro, rd, fate, dir, hit);
  if (hit.x > 0.5) {
    float rel = profile(hit.y) / profile(uPeakR);               // the ring's temperature against the hottest
    float Tseen = uHottest * rel * hit.z;                        // what the eye receives is shifted by g
    float I = uExposure * pow(rel * hit.z, 4.0);                 // and its brightness by g⁴ (with T⁴)
    vec3 c = blackbody(Tseen) * (I / (1.0 + I));             // tone-mapped (Reinhard): the beaming's contrast survives
    return vec4(c, 1.0);
  }
  if (fate > 0.5) return vec4(0.0, 0.0, 0.0, 1.0);
  return vec4(skyColour(dir), 1.0);
}
// the model quantity, for the conformance gate: a.w = 0 → (fate, dir); a.w = 1 → (met, radius, g, fate)
vec4 sciValue(vec4 a, vec4 b) {
  float fate; vec3 dir, hit;
  trace(a.xyz, normalize(b.xyz), fate, dir, hit);
  if (a.w < 0.5) return vec4(fate, dir);
  return vec4(hit, fate);
}
`;
  // the hottest ring of the thin profile: r = (49/36)·inner
  const peak = inner > 0 ? (49 / 36) * inner : 1;
  return shaderPage({ glsl, uniforms: { uInner: inner, uOuter: outer, uPeakR: peak, uHottest: hottest, uExposure: exposure } });
}
