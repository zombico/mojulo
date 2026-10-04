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
//   clarity         a depth pass of the scene without its water gives each water pixel the length of its view ray
//                   through the water; Beer–Lambert T = exp(−σ·d) lets that share of the bed show through and fills
//                   the rest with the water's own colour, so shallows are clear and deeps opaque wherever the bed is.
//   shore foam      where that water is thin (against a beach, a bank, a pier or a buoy) it froths, in bands that
//                   lap toward the edge. No bed behind the water (open sea) ⇒ T = 0: the old opaque look.
export const AQUA_GLSL = `
uniform float uAqTime; uniform vec3 uAqZen; uniform vec3 uAqHor; uniform vec3 uAqGnd; uniform vec3 uAqSun; uniform vec3 uAqSunCol;
uniform float uAqRough; uniform float uAqNScale; uniform float uAqNAmp; uniform float uAqNSpeed; uniform vec2 uAqFlow;
uniform float uAqFroth; uniform float uAqRefl; uniform vec3 uAqFoamCol; uniform float uAqSide;
uniform vec3 uAqSigma; uniform float uAqShore; uniform vec3 uAqTint; uniform sampler2D uAqDepth; uniform vec2 uAqRes; uniform float uAqLogF; uniform float uAqHasDepth;
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
// the light the surface sends back on its own: the sky by Fresnel (F, R) and the sun glint (Sp); foam cancels both
void aqLight(vec3 N, vec3 V, float fp, float froth, out float F, out vec3 R, out vec3 Sp) {
  float nv = clamp(dot(N, V), 0.0, 1.0);
  F = clamp((0.02 + 0.98 * pow(1.0 - nv, 5.0)) * uAqRefl, 0.0, 1.0) * (1.0 - froth);
  vec3 r = reflect(-V, N); r.z = abs(r.z) * 0.85 + 0.15 * max(r.z, 0.0);   // a ripple can't reflect the ground it hides
  R = aqSky(normalize(r));
  vec3 L = normalize(uAqSun), H = normalize(L + V);
  float a = clamp(uAqRough + 0.6 * fp * uAqNScale, 0.01, 0.6), a2 = a * a * a * a;
  float nh = max(dot(N, H), 0.0), dd = nh * nh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * dd * dd), Fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
  Sp = uAqSunCol * min(D * Fh * 0.25 * max(dot(N, L), 0.0), 12.0) * (1.0 - froth); }
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
  // water thickness: the depth pass (log depth → view distance) behind this pixel, minus the water's own distance,
  // along the view ray (aqD) and straight down (aqH). -1 = no depth pass on this page.
  float aqD = -1.0, aqH = 1e4;
  if (uAqHasDepth > 0.5) {
    float aqDz = texture2D(uAqDepth, gl_FragCoord.xy / uAqRes).x;
    vec4 aqVp = viewMatrix * vec4(vAqWp, 1.0); float aqWz = max(-aqVp.z, 1e-4);
    float aqSz = aqDz >= 0.99999 ? 1e7 : exp2(aqDz * uAqLogF) - 1.0;
    aqD = max(aqSz - aqWz, 0.0) * length(aqVp.xyz) / aqWz;
    aqH = aqD * abs(dot(aqV, aqNg));
  }
  float aqShoreF = 0.0;
  if (aqD >= 0.0 && uAqShore > 0.0) { float aqS1 = 1.0 - smoothstep(0.0, uAqShore, aqH);
    aqShoreF = aqS1 * (0.5 + 0.22 * sin(aqH / uAqShore * 7.0 - uAqTime * 2.2)); }
  float aqFoam = max(vAqFoam, aqShoreF);
  float aqFr = aqFroth(aqP, aqFoam, aqFp), aqF; vec3 aqR, aqSp;
  // aerated water: bubbles under the surface lighten it toward a milky tint around the foam
  vec3 aqBody = mix(gl_FragColor.rgb, mix(gl_FragColor.rgb, uAqFoamCol, 0.45), clamp(aqFoam, 0.0, 1.0) * 0.5);
  aqLight(aqN, aqV, aqFp, aqFr, aqF, aqR, aqSp);
  if (aqD >= 0.0) {
    // Beer–Lambert: the bed survives T of the way (red first to go); the water's own colour fills the rest. Written as
    // one alpha over what's already drawn: out = F·R + Sp + (1−F)·[(1−fr)·(T·bed + (1−T)·body) + fr·foam]
    vec3 aqTv = exp(-uAqSigma * aqD); float aqT = dot(aqTv, vec3(0.3, 0.45, 0.25));
    // the water's own colour: thin water scatters its clear tint (turquoise over sand), thick water its body colour;
    // and the red the bed loses first comes back as that tint, so the shallows read blue-green, not grey
    aqBody = mix(aqBody, uAqTint * (0.55 + 0.45 * max(dot(normalize(uAqSun), aqNg), 0.0)), aqT * (1.0 - aqT) * 3.2 + 0.25 * aqT);
    float aqA = 1.0 - (1.0 - aqF) * (1.0 - aqFr) * aqT;
    vec3 aqOut = aqF * aqR + aqSp + (1.0 - aqF) * ((1.0 - aqFr) * (1.0 - aqT) * aqBody + aqFr * uAqFoamCol);
    gl_FragColor = vec4(aqOut / max(aqA, 1e-3), aqA);
  } else {
    gl_FragColor = vec4(mix(mix(aqBody, uAqFoamCol, aqFr), aqR, aqF) + aqSp, mix(gl_FragColor.a, 1.0, max(aqF, aqFr)));
  }
}
#include <tonemapping_fragment>`;

/**
 * In-page: defines `__aqPatch(material, look, { sun, sunCol, foamCol, up, flowUV })` once. `flowUV` = the geometry carries `aAqUV` (across, along a river's centreline) and `aAqT` (the downstream tangent),
 * and ripples follow it. `up` = the geometry carries
 * no normal attribute (a flat sheet: the normal is +z); otherwise the mesh's own normal is used and a per-vertex
 * `aAqFoam` attribute is read. The caller registers the water mesh in `__aqShared.meshes` (hidden from the depth
 * pass). Returns the uniforms so the caller can drive `uAqTime`. `var` so a page with both
 * a liquid sheet and an aqua surface can carry the definer twice without a redeclaration error.
 */
export function aquaPatchScript() {
  return `
// --- aqua look (water shading: detail ripples, Fresnel sky reflection, sun glint, froth) ---
var __aqGlsl = ${safeJson(AQUA_GLSL)};
var __aqMain = ${safeJson(AQUA_MAIN)};
// the depth pass: when a page has water, every on-screen render first draws the scene WITHOUT its water into a
// depth texture (log depth, as the page renders), which the water reads to know how thick it is. Hooked once.
var __aqShared = window.__aqShared || (window.__aqShared = { uAqDepth: { value: null }, uAqRes: { value: new THREE.Vector2(1, 1) }, uAqLogF: { value: 1 }, uAqHasDepth: { value: 0 }, meshes: [] });
if (!window.__aqHooked) {
  window.__aqHooked = true;
  const dt = new THREE.DepthTexture(), rt = new THREE.WebGLRenderTarget(1, 1, { depthTexture: dt }), sz = new THREE.Vector2(), raw = renderer.render.bind(renderer);
  __aqShared.uAqDepth.value = dt;
  renderer.render = (s, c) => {
    if (s === scene && c && c.isPerspectiveCamera && renderer.getRenderTarget() === null && __aqShared.meshes.length) {
      renderer.getDrawingBufferSize(sz);
      if (rt.width !== sz.x || rt.height !== sz.y) rt.setSize(sz.x, sz.y);
      const vis = __aqShared.meshes.map((m) => m.visible);
      for (const m of __aqShared.meshes) m.visible = false;
      renderer.setRenderTarget(rt); raw(s, c); renderer.setRenderTarget(null);
      __aqShared.meshes.forEach((m, i) => { m.visible = vis[i]; });
      __aqShared.uAqRes.value.copy(sz); __aqShared.uAqLogF.value = Math.log2(c.far + 1); __aqShared.uAqHasDepth.value = 1;
    }
    raw(s, c);
  };
}
var __aqPatch = function (mat, AQ, o) {
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const U = { uAqTime: { value: 0 }, uAqZen: { value: v3(AQ.zen) }, uAqHor: { value: v3(AQ.hor) }, uAqGnd: { value: v3(AQ.gnd) },
    uAqSun: { value: v3(o.sun).normalize() }, uAqSunCol: { value: v3(o.sunCol || [1, 0.95, 0.86]) }, uAqRough: { value: AQ.rough },
    uAqNScale: { value: AQ.nScale }, uAqNAmp: { value: AQ.nAmp }, uAqNSpeed: { value: AQ.nSpeed }, uAqFlow: { value: new THREE.Vector2(AQ.flow[0], AQ.flow[1]) },
    uAqFroth: { value: AQ.froth }, uAqRefl: { value: AQ.refl }, uAqSide: { value: o.flowUV ? 0 : 1 }, uAqSigma: { value: v3(AQ.sigma) }, uAqTint: { value: v3(AQ.tint) }, uAqShore: { value: AQ.shore }, uAqFoamCol: { value: v3(o.foamCol || [0.9, 0.94, 0.96]) } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, rnd) => {
    if (prev) prev(sh, rnd);
    Object.assign(sh.uniforms, U, { uAqDepth: __aqShared.uAqDepth, uAqRes: __aqShared.uAqRes, uAqLogF: __aqShared.uAqLogF, uAqHasDepth: __aqShared.uAqHasDepth });
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
