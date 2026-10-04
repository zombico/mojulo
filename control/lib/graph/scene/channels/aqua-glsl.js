import { safeJson } from '../emit-util.js';

// The water look on the World page: one GLSL library and one in-page patcher shared by the liquid sheet
// (channels/water.js) and the aqua surfaces (channels/surface.js). The look's numbers come from
// materials/aqua-look.js; this file is only what the GPU does with them. World space is z-up.
//
//   detail ripples  two domain-warped value-noise fBm layers drifting across each other; their slope tilts the
//                   normal. Each octave fades as it drops below a pixel (its mean is already the flat water),
//                   so far water calms instead of shimmering.
//   reflection      Schlick Fresnel with F0 = 0.02 (n = 1.333), mixing the body toward an analytic sky (zenith →
//                   horizon, a dim ground below) sampled along the reflected ray.
//   sun glint       GGX, roughness raised by the pixel footprint × ripple frequency (Toksvig in spirit).
//   froth           Worley F2 − F1 = the bright rims between bubbles; a foam amount thresholds it, so light foam
//                   is lace, heavy foam is a white mat with bubble holes. Foam is diffuse: it cancels reflection.
export const AQUA_GLSL = `
uniform float uAqTime; uniform vec3 uAqZen; uniform vec3 uAqHor; uniform vec3 uAqGnd; uniform vec3 uAqSun; uniform vec3 uAqSunCol;
uniform float uAqRough; uniform float uAqNScale; uniform float uAqNAmp; uniform float uAqNSpeed; uniform vec2 uAqFlow;
uniform float uAqFroth; uniform float uAqRefl; uniform vec3 uAqFoamCol; uniform float uAqSide;
varying vec3 vAqWp; varying vec3 vAqN; varying float vAqFoam;
#ifdef AQ_FLOW
varying vec2 vAqUV; varying vec2 vAqT;
#endif
float aqHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 aqHash2(vec2 p) { return vec2(aqHash(p), aqHash(p + 19.19)); }
float aqNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(aqHash(i), aqHash(i + vec2(1.0, 0.0)), w.x), mix(aqHash(i + vec2(0.0, 1.0)), aqHash(i + vec2(1.0, 1.0)), w.x), w.y); }
// fBm in ripple units; fq = the pixel footprint in the same units, fading octaves finer than ~2 px
float aqFbm(vec2 p, float fq) { float s = 0.0, a = 0.5, f = 1.0; mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { s += a * (aqNoise(p * f) - 0.5) * clamp(1.6 - 2.0 * fq * f, 0.0, 1.0); p = R * p + 7.3; f *= 2.03; a *= 0.5; }
  return s; }
// the ripple height field: two layers, the second domain-warped by the first. Still water (uAqSide 1) drifts the
// layers across each other so nothing reads as a current; flowing water (uAqSide 0) pushes both downstream at
// different speeds, so the surface streams forward instead of wandering sideways.
float aqRipple(vec2 q, float fq) { float t = uAqTime * uAqNSpeed * uAqNScale; vec2 side = vec2(-uAqFlow.y, uAqFlow.x);
  float a = aqFbm(q - uAqFlow * t, fq);
  return a + 0.7 * aqFbm(q * 1.7 - mix(uAqFlow * 1.6, -side * 0.6, uAqSide) * t + 1.3 * a + 11.0, fq * 1.7); }
vec2 aqSlope(vec2 p, float fp) { vec2 q = p * uAqNScale; float fq = fp * uAqNScale, e = 0.08;
  float h = aqRipple(q, fq); return vec2(aqRipple(q + vec2(e, 0.0), fq) - h, aqRipple(q + vec2(0.0, e), fq) - h) / e; }
vec3 aqSky(vec3 d) { float h = d.z;
  return h > 0.0 ? mix(uAqHor, uAqZen, pow(h, 0.55)) : mix(uAqGnd, uAqHor * 0.7, exp(10.0 * h)); }
vec2 aqWorley(vec2 p) { vec2 i = floor(p), f = fract(p); float a = 8.0, b = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = aqHash2(i + g);
    o = 0.5 + 0.42 * sin(uAqTime * 0.9 + 6.2832 * o); float d = length(g + o - f); if (d < a) { b = a; a = d; } else if (d < b) b = d; }
  return vec2(a, b); }
float aqFroth(vec2 p, float foam, float fp) { if (foam <= 0.02) return 0.0;
  vec2 q = p * uAqNScale * uAqFroth; float fq = fp * uAqNScale * uAqFroth;
  vec2 drift = uAqFlow * uAqTime * uAqNSpeed * uAqNScale * uAqFroth * 0.5;
  // the foam mat: the amount, broken into ragged patches by low-frequency noise (foam tears into islands and streaks)
  float rag = aqFbm(q * 0.35 - drift * 0.35, fq * 0.35);
  float cover = smoothstep(0.42, 0.62, foam + 0.9 * rag);
  // bubbles: Worley cells are the bubbles, their rims the bright film between them. Thin foam is mostly holes
  // (a lace of rims), thick foam closes up into a white mat with only a few dark bubbles left.
  vec2 w1 = aqWorley(q - drift), w2 = aqWorley(q * 2.6 + 5.1 - drift * 1.3);
  float aa1 = clamp(1.4 - 2.0 * fq, 0.0, 1.0), aa2 = clamp(1.4 - 5.2 * fq, 0.0, 1.0);
  float r = mix(0.5, 0.08, clamp(foam, 0.0, 1.0));                      // bubble radius shrinks as foam thickens
  float hole1 = 1.0 - smoothstep(r - 0.08, r + 0.08, w1.x), hole2 = 1.0 - smoothstep(r - 0.1, r + 0.1, w2.x);
  float holes = max(hole1 * aa1, hole2 * 0.7 * aa2);
  holes = mix(0.35 * (1.0 - foam), holes, max(aa1, 0.0));                // sub-pixel bubbles read as their mean
  return cover * (1.0 - 0.6 * holes); }
vec3 aqShade(vec3 base, vec3 N, vec3 V, float fp, float froth, out float F) {
  float nv = clamp(dot(N, V), 0.0, 1.0);
  F = clamp((0.02 + 0.98 * pow(1.0 - nv, 5.0)) * uAqRefl, 0.0, 1.0) * (1.0 - froth);
  vec3 R = reflect(-V, N); R.z = abs(R.z) * 0.85 + 0.15 * max(R.z, 0.0);   // a ripple can't reflect the ground it hides
  vec3 c = mix(base, aqSky(normalize(R)), F);
  vec3 L = normalize(uAqSun), H = normalize(L + V);
  float a = clamp(uAqRough + 0.6 * fp * uAqNScale, 0.01, 0.6), a2 = a * a * a * a;
  float nh = max(dot(N, H), 0.0), dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * dd * dd), Fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
  c += uAqSunCol * min(D * Fh * 0.25 * max(dot(N, L), 0.0), 12.0) * (1.0 - froth);
  return c; }
`;

const AQUA_MAIN = `{
  vec3 aqNg = normalize(vAqN); vec3 aqV = normalize(cameraPosition - vAqWp); if (dot(aqNg, aqV) < 0.0) aqNg = -aqNg;
  vec3 aqAn = abs(aqNg); float aqFp = max(length(fwidth(vAqWp)), 1e-5);
#ifdef AQ_FLOW
  // a river samples in its own frame — (across, along) the centreline — stretched along the current, so ripples
  // and foam streak parallel to the banks (lanes along the current) and travel downstream; the slope maps back to world through the local tangent
  vec2 aqP = vec2(vAqUV.x, vAqUV.y * 0.15);
  vec2 aqS = aqSlope(aqP, aqFp);
  vec2 aqT = normalize(vAqT), aqL = vec2(-aqT.y, aqT.x);
  vec3 aqG = vec3(aqS.x * aqL + aqS.y * 0.15 * aqT, 0.0);
#else
  vec2 aqP = aqAn.z >= max(aqAn.x, aqAn.y) ? vAqWp.xy : (aqAn.x >= aqAn.y ? vAqWp.yz : vAqWp.xz);
  vec2 aqS = aqSlope(aqP, aqFp);
  vec3 aqG = aqAn.z >= max(aqAn.x, aqAn.y) ? vec3(aqS, 0.0) : (aqAn.x >= aqAn.y ? vec3(0.0, aqS) : vec3(aqS.x, 0.0, aqS.y));
#endif
  vec3 aqN = normalize(aqNg - uAqNAmp * (aqG - aqNg * dot(aqNg, aqG)));
  float aqFr = aqFroth(aqP, vAqFoam, aqFp), aqF;
  // aerated water: bubbles under the surface lighten it toward a milky tint around the foam
  vec3 aqBase = mix(gl_FragColor.rgb, mix(gl_FragColor.rgb, uAqFoamCol, 0.45), clamp(vAqFoam, 0.0, 1.0) * 0.5);
  aqBase = mix(aqBase, uAqFoamCol, aqFr);
  gl_FragColor.rgb = aqShade(aqBase, aqN, aqV, aqFp, aqFr, aqF);
  gl_FragColor.a = mix(gl_FragColor.a, 1.0, max(aqF, aqFr));
}
#include <tonemapping_fragment>`;

/**
 * In-page: defines `__aqPatch(material, look, { sun, sunCol, foamCol, up, flowUV })` once. `flowUV` = the geometry carries `aAqUV` (across, along a river's centreline) and `aAqT` (the downstream tangent),
 * and ripples follow it. `up` = the geometry carries
 * no normal attribute (a flat sheet: the normal is +z); otherwise the mesh's own normal is used and a per-vertex
 * `aAqFoam` attribute is read. Returns the uniforms so the caller can drive `uAqTime`. `var` so a page with both
 * a liquid sheet and an aqua surface can carry the definer twice without a redeclaration error.
 */
export function aquaPatchScript() {
  return `
// --- aqua look (water shading: detail ripples, Fresnel sky reflection, sun glint, froth) ---
var __aqGlsl = ${safeJson(AQUA_GLSL)};
var __aqMain = ${safeJson(AQUA_MAIN)};
var __aqPatch = function (mat, AQ, o) {
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const U = { uAqTime: { value: 0 }, uAqZen: { value: v3(AQ.zen) }, uAqHor: { value: v3(AQ.hor) }, uAqGnd: { value: v3(AQ.gnd) },
    uAqSun: { value: v3(o.sun).normalize() }, uAqSunCol: { value: v3(o.sunCol || [1, 0.95, 0.86]) }, uAqRough: { value: AQ.rough },
    uAqNScale: { value: AQ.nScale }, uAqNAmp: { value: AQ.nAmp }, uAqNSpeed: { value: AQ.nSpeed }, uAqFlow: { value: new THREE.Vector2(AQ.flow[0], AQ.flow[1]) },
    uAqFroth: { value: AQ.froth }, uAqRefl: { value: AQ.refl }, uAqSide: { value: o.flowUV ? 0 : 1 }, uAqFoamCol: { value: v3(o.foamCol || [0.9, 0.94, 0.96]) } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, rnd) => {
    if (prev) prev(sh, rnd);
    Object.assign(sh.uniforms, U);
    const fl = o.flowUV ? 'attribute vec2 aAqUV;\\nattribute vec2 aAqT;\\nvarying vec2 vAqUV;\\nvarying vec2 vAqT;\\n' : '';
    sh.vertexShader = 'varying vec3 vAqWp;\\nvarying vec3 vAqN;\\nvarying float vAqFoam;\\n' + fl + (o.up ? '' : 'attribute float aAqFoam;\\n') + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\\nvAqWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\\n' + (o.flowUV ? 'vAqUV = aAqUV;\\nvAqT = aAqT;\\n' : '') + (o.up ? 'vAqN = vec3(0.0, 0.0, 1.0);\\nvAqFoam = 0.0;' : 'vAqN = normalize(mat3(modelMatrix) * objectNormal);\\nvAqFoam = aAqFoam;'));
    sh.fragmentShader = (o.flowUV ? '#define AQ_FLOW\\n' : '') + __aqGlsl + sh.fragmentShader.replace('#include <tonemapping_fragment>', __aqMain);
  };
  mat.customProgramCacheKey = () => 'aqua' + (o.up ? 'Up' : 'Foam') + (o.flowUV ? 'Flow' : '');
  mat.needsUpdate = true;
  return U;
};`;
}
