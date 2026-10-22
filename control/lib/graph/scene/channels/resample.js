/**
 * THE RESAMPLER — a painted detail tile (matte-paint/detail.js) read again as the page draws it, so a wall, a road or a
 * city seen at scale does not repeat: no AI, no new texels, the same tile read at seeded shifts, deterministic. Each
 * tile's plan says how it may be read (matte-paint/detail.js resamplePlan), from how it was built:
 *
 *   courses   bands a few courses deep, each read at its own shift: down by whole bond periods, so every cut falls on a
 *             bed joint and the bond holds across it, along by whole units (or any amount when the head joints are free)
 *   strips    upright strips a few boards wide, each read at a shift along by whole boards and up by any amount
 *   grid      cells of whole slabs or panels, each read at a shift of whole units both ways: every cut a joint
 *   hex       three readings at seeded shifts blended on a hexagonal grid, sharpened, and the blend's contrast held round
 *             the tile's own mean (it is a detail: its mean is known), so it neither repeats nor washes out; a reading
 *             shifts down by whole courses when coursed work lies under it (a render over its stone)
 *
 * and a broad wash of tone over all of it (`macro`), value noise at a few repeats, so a street is not one swatch. Every
 * reading takes its gradients from the unshifted uv, so no cut draws a mip seam. The dice are an integer hash of the
 * cell and the plan's seed: the same world draws the same everywhere.
 *
 *   resampleScript(plans, steps)   the page's patch for { textureKey: plan }: the textured meshes whose key has a plan
 *                           read their map through it. `steps` (a gen-7 world's relief, channels/relief-steps.js): each
 *                           texel's value over the tile's mean cut into the relief's steps, its colour the step's (a
 *                           plan of kind 'plain' reads its tile once, to be stepped). Absent plans, the page emits
 *                           nothing of it.
 */
import { safeJson } from '../emit-util.js';
import { STEPS_GLSL, stepsUniforms } from './relief-steps.js';

const KIND = { courses: 0, strips: 1, grid: 2, hex: 3, plain: 4 };

const GLSL = `
uniform vec4 uRsA;   // kind, stepU, stepV, bandV
uniform vec4 uRsB;   // bandU, hex cell, hex sharpness, the tile's mean
uniform vec4 uRsC;   // macro amplitude, macro scale (repeats), seed
uint rsH(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rsR(ivec2 c, uint s) { return float(rsH(uint(c.x) * 73856093u ^ uint(c.y) * 19349663u ^ s * 83492791u) & 0xffffffu) / 16777216.0; }
float rsNoise(vec2 q, uint s) {
  ivec2 i = ivec2(floor(q)); vec2 f = fract(q); f = f * f * (3.0 - 2.0 * f);
  float a = rsR(i, s), b = rsR(i + ivec2(1, 0), s), c = rsR(i + ivec2(0, 1), s), d = rsR(i + ivec2(1, 1), s);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
vec4 rsRead(sampler2D m, vec2 uv, float blur) {
  vec2 dx = dFdx(uv) * blur, dy = dFdy(uv) * blur;
  uint s = uint(uRsC.z);
  vec4 c;
  if (uRsA.x > 3.5) c = textureGrad(m, uv, dx, dy);
  else if (uRsA.x > 2.5) {
    // hex: three readings at the corners of the triangle the point lies in, sharpened, contrast held round the mean
    vec2 p = uv / uRsB.y, sk = vec2(p.x - 0.57735027 * p.y, 1.15470054 * p.y);
    ivec2 b = ivec2(floor(sk)); vec2 f = fract(sk); float z = 1.0 - f.x - f.y;
    ivec2 v1, v2, v3; vec3 w;
    if (z > 0.0) { w = vec3(z, f.y, f.x); v1 = b; v2 = b + ivec2(0, 1); v3 = b + ivec2(1, 0); }
    else { w = vec3(-z, 1.0 - f.y, 1.0 - f.x); v1 = b + ivec2(1, 1); v2 = b + ivec2(1, 0); v3 = b + ivec2(0, 1); }
    w = pow(max(w, vec3(1e-4)), vec3(uRsB.z)); w /= (w.x + w.y + w.z);
    // (a reading shifts down by whole courses when the work under it is coursed: stepV)
    #define RS_OFF(v) vec2(rsR(v, s), uRsA.z > 0.0 ? floor(rsR(v, s + 1u) / uRsA.z) * uRsA.z : rsR(v, s + 1u))
    vec4 c1 = textureGrad(m, uv + RS_OFF(v1), dx, dy);
    vec4 c2 = textureGrad(m, uv + RS_OFF(v2), dx, dy);
    vec4 c3 = textureGrad(m, uv + RS_OFF(v3), dx, dy);
    vec4 mu = vec4(vec3(uRsB.w), 1.0);
    c = mu + ((c1 - mu) * w.x + (c2 - mu) * w.y + (c3 - mu) * w.z) / sqrt(dot(w, w));
  } else {
    // a lattice: cells cut along the work's own joints (courses: down; strips: along; grid: both), each read shifted by
    // whole units of the work (a step of 0: any shift)
    ivec2 cell = ivec2(uRsB.x > 0.0 ? floor(uv.x / uRsB.x) : 0.0, uRsA.w > 0.0 ? floor(uv.y / uRsA.w) : 0.0);
    float hu = rsR(cell, s), hv = rsR(cell, s + 7u);
    vec2 off = vec2(uRsA.y > 0.0 ? floor(hu / uRsA.y) * uRsA.y : hu, uRsA.z > 0.0 ? floor(hv / uRsA.z) * uRsA.z : hv);
    c = textureGrad(m, uv + off, dx, dy);
  }
  // the broad wash: a street's walls a little apart in tone, never one swatch
  float k = 1.0 + uRsC.x * (2.0 * rsNoise(uv / uRsC.y, s + 13u) - 1.0);
  return vec4(c.rgb * k, c.a);
}
`;

export function resampleScript(plans, steps = null) {
  const P = Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, [
    KIND[p.kind], p.stepU ?? 0, p.stepV ?? 0, p.bandV ?? 0, p.bandU ?? 0, p.cell ?? 1, p.sharp ?? 6, p.mean ?? 0.8, p.macro?.amp ?? 0, p.macro?.scale ?? 6, p.seed ?? 1,
  ]]));
  return `
// --- the resampler: painted detail tiles read again at seeded shifts, so they do not repeat at scale ---
const __RESAMPLE = ${safeJson(P)}, __RS_GLSL = ${safeJson(steps ? GLSL + STEPS_GLSL : GLSL)};
const __resample = (mat, q) => {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRsA = { value: new THREE.Vector4(q[0], q[1], q[2], q[3]) };
    sh.uniforms.uRsB = { value: new THREE.Vector4(q[4], q[5], q[6], q[7]) };
    sh.uniforms.uRsC = { value: new THREE.Vector4(q[8], q[9], q[10], 0) };${steps ? `
    Object.assign(sh.uniforms, ${stepsUniforms(steps)});` : ''}
    // (at this point the shader's chunks are still includes: the map's own is replaced whole)
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', __RS_GLSL + '\\nvoid main() {').replace('#include <map_fragment>', ${steps ? `'#ifdef USE_MAP\\n  vec4 rsT = rsRead( map, vMapUv, 1.0 ), rsS = rsRead( map, vMapUv, 3.0 );\\n  diffuseColor *= vec4( relStep( dot( rsS.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) / uRsB.w ) * uRsB.w, rsT.a );\\n#endif'` : `'#ifdef USE_MAP\\n  diffuseColor *= rsRead( map, vMapUv, 1.0 );\\n#endif'`});
  };
  mat.customProgramCacheKey = () => '${steps ? 'resample-stepped' : 'resample'}';
  mat.needsUpdate = true;
};
`;
}
