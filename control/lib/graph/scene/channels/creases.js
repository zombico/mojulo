// In-page script: CREASES (opt-in payload `creases`) — the vgl rule as a screen-space pass. A pixel is inked where the
// surfaces round it RISE above its own plane and physically touch it (a concave crease: a wall's foot, a tier on the one
// below, a column on its plinth); never where they fall away (a convex edge) or jump nearer (a silhouette in front), so
// it draws no outline and casts no halo. The baked forms of the rule (landmarks' inkConcaveSeams, scene-css3d's
// bakeCreaseSeams) read axis-aligned box massings only; this reads whatever the depth shows.
//
//   • ONE PREPASS, mask and depth together: every visible solid is drawn with an override material into a float target,
//     r = its linear view depth, g = 1 when the mesh is marked angular (`userData.crease`, set by the emitter on groups,
//     their textured sub-meshes and instanced repeats unless every face is `organic`), 0 otherwise. Linear depth, not
//     the depth buffer: at a city's distances the perspective buffer's steps fake tilts on flat faces. Ink hulls, lines,
//     points, sprites, every fullscreen quad, what writes no depth of its own (a sky dome) and non-angular translucent
//     meshes are hidden for it; a water sheet is drawn (unmarked: never inked), so the bed under it is hidden as the
//     eye sees it.
//   • THE INK: a fullscreen pass (into its own target) per pixel rebuilds the position from
//     the view depth, the face normal from the steadier neighbour on each axis, and samples a disc twice — a small one
//     of constant pixel radius (the line) and one of constant WORLD radius projected (the wash). Each sample's rise above
//     the plane is weighted by a falloff kernel, by how surely it touches the pixel (reach), by depth (not a surface in
//     front) and by the mask, with a floor under ~5° (a flat face's numeric noise); a soft response blends the band out.
//     Samples sit on texel centres, so the position rebuilt matches the depth read. Where the wash's reach spans only a
//     few pixels (a far facade's window reveals are then sub-pixel) the ink fades out instead of hatching them. The
//     samples are jittered by a 4x4 Bayer offset, and THE COMPOSITE (a fullscreen quad in the scene, premultiplied,
//     under fog and the effects layers) averages each pixel's 4x4 on the same surface, so the jitter cancels: the
//     band blends instead of stippling where only a few samples find the rising face. The scene's fog takes the ink
//     as it takes the surface under it, so a far line goes into the haze with the form it draws.
//
// THREE CLASSES in the mask (`userData.crease` on a mesh, the emitter's): angular (1: what is built), land (0.5: ground,
// cliff and rock a builder marks `organic: 'land'`) and organic (0, unmarked: a tree, a figure, a car). A crease needs an
// angular side: an angular pixel takes ink from an angular or a land partner, a land pixel from an angular one only, so
// a building is grounded on the land and the land's own folds stay clean; an organic pixel is never inked, nor is it
// anyone's partner (a tree, and the ground at its foot, are left alone).
//
// THE OUTLINE (opt-in `outline`, the cel register's): a line round every silhouette, on any surface, drawn where a
// pixel's ring of neighbours finds the sky or a surface well behind it; crisp, in its own ink, over the creases.
//
// A non-perspective camera hides the quad. `__mojCreases` is the live handle (set(on), tint(hex)).
// Absent `creases` ⇒ no block, no prepass, no marks: the page is byte-identical.
import { occlusionKernel } from '../live-light.js';

/** the defaults: a warm umber ink, the line's and the wash's strength, the wash's reach in metres */
export const CREASE_DEFAULTS = Object.freeze({ ink: '#2b2116', line: 0.85, wash: 0.6, reach: 2 });
const CREASE_KEYS = Object.keys(CREASE_DEFAULTS);
const HEX = /^#[0-9a-fA-F]{6}$/;

/** an outline's defaults: a near-black ink, 1.5 css pixels */
export const OUTLINE_DEFAULTS = Object.freeze({ ink: '#16130f', width: 1.5 });

/** `creases` → null (absent / false) or the resolved terms; anything malformed throws, naming the setting. */
export function readCreases(c) {
  if (c === undefined || c === null || c === false) return null;
  if (c !== true && (typeof c !== 'object' || Array.isArray(c))) throw new Error('creases is true or { ink, line, wash, reach, outline }');
  const o = c === true ? {} : c;
  for (const k of Object.keys(o)) if (![...CREASE_KEYS, 'outline'].includes(k)) throw new Error(`creases.${k} is not a setting (creases: ${CREASE_KEYS.join(', ')}, outline)`);
  const { outline, ...terms } = o;
  const out = { ...CREASE_DEFAULTS, ...terms };
  if (outline !== undefined && outline !== false) {
    if (outline !== true && (typeof outline !== 'object' || Array.isArray(outline))) throw new Error('creases.outline is true or { ink, width }');
    const ol = { ...OUTLINE_DEFAULTS, ...(outline === true ? {} : outline) };
    for (const k of Object.keys(ol)) if (!['ink', 'width'].includes(k)) throw new Error(`creases.outline.${k} is not a setting (outline: ink, width)`);
    if (!HEX.test(ol.ink)) throw new Error('creases.outline.ink is a #rrggbb colour');
    if (!(typeof ol.width === 'number' && ol.width >= 0.5 && ol.width <= 6)) throw new Error('creases.outline.width is the line\'s width in css pixels, 0.5 to 6');
    out.outline = ol;
  }
  if (!HEX.test(out.ink)) throw new Error('creases.ink is a #rrggbb colour');
  for (const k of ['line', 'wash']) if (!(typeof out[k] === 'number' && out[k] >= 0 && out[k] <= 1)) throw new Error(`creases.${k} is a strength, 0 (none) to 1`);
  if (!(typeof out.reach === 'number' && out.reach >= 0.1 && out.reach <= 20)) throw new Error('creases.reach is the wash\'s reach in metres, 0.1 to 20');
  return out;
}

const srgb = (hex) => [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1e4) / 1e4);

const CREASE_FRAG = `uniform sampler2D uZM; uniform vec2 uRes; uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform float uFov;
uniform float uLineW; uniform float uLineA; uniform float uWashR; uniform float uWashA; uniform float uOutW; uniform float uOutA;
float zAt(vec2 px) { return texture2D(uZM, px / uRes).r; }
float mAt(vec2 px) { return texture2D(uZM, px / uRes).g; }
vec3 posAt(vec2 px, float z) {
  vec2 uv = (px - 0.5 * uRes) / (0.5 * uRes.y); float t = tan(uFov * 0.5);
  return uCamPos + (uCamBasis * vec3(uv.x * t, uv.y * t, 1.0)) * z;
}
float rise(vec2 fc, vec3 P, vec3 N, float z, float r, float reach, float spin, const int K, float floorH, float need) {
  float s = 0.0, wsum = 0.0;
  for (int i = 0; i < 28; i++) {
    if (i >= K) break;
    float f = (float(i) + spin) / float(K);
    float rr = max(r * sqrt(f), 1.5), a = float(i) * 2.39996323 + spin * 6.2831853;
    vec2 q = floor(fc + rr * vec2(cos(a), sin(a))) + 0.5;
    float kern = 1.0 - f;
    wsum += kern;
    float zq = zAt(q);
    if (zq <= 0.0) continue;
    float wj = 1.0 - smoothstep(0.015 * z, 0.03 * z, z - zq);
    vec3 d = posAt(q, zq) - P; float L = length(d);
    if (L < 1e-6) continue;
    float wr = 1.0 - smoothstep(0.55 * reach, reach, L);
    s += kern * wj * wr * step(need, mAt(q)) * max((dot(d, N) - floorH) / L - 0.09, 0.0) / 0.91;
  }
  return wsum > 0.0 ? s / wsum : 0.0;
}
// the outline's coverage: the share of a ring of neighbours that is sky or a surface well behind this one. On land the
// sky does not count: the land meets the sky where the world ends (a seabed's edge under its water), not at a form
float outline(vec2 fc, float z, float sky) {
  float far = 0.0;
  for (int i = 0; i < 12; i++) {
    float a = 6.2831853 * (float(i) + 0.5) / 12.0;
    float zq = zAt(floor(fc + uOutW * vec2(cos(a), sin(a))) + 0.5);
    far += zq <= 0.0 ? sky : (zq - z > 0.04 * z ? 1.0 : 0.0);
  }
  return smoothstep(0.05, 0.3, far / 12.0);
}
void main() {
  vec2 fc = gl_FragCoord.xy;
  float z = zAt(fc), m = mAt(fc);
  if (z <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float ol = uOutA > 0.0 ? uOutA * outline(fc, z, m > 0.25 && m < 0.75 ? 0.0 : 1.0) : 0.0;
  // the creases: an organic pixel takes none, and a register that draws only the outline asks for none
  if (m < 0.25 || uLineA + uWashA <= 0.0) { gl_FragColor = vec4(0.0, ol, 0.0, 1.0); return; }
  // its partners: an angular pixel's are angular or land, a land pixel's angular only
  float need = m > 0.75 ? 0.25 : 0.75;
  vec3 P = posAt(fc, z);
  const float H = 2.0;
  float zr = zAt(fc + vec2(H, 0.0)), zl = zAt(fc - vec2(H, 0.0)), zu = zAt(fc + vec2(0.0, H)), zd = zAt(fc - vec2(0.0, H));
  bool useR = zr > 0.0 && (zl <= 0.0 || abs(zr - z) < abs(zl - z));
  bool useU = zu > 0.0 && (zd <= 0.0 || abs(zu - z) < abs(zd - z));
  vec3 dx = useR ? posAt(fc + vec2(H, 0.0), zr) - P : P - posAt(fc - vec2(H, 0.0), zl);
  vec3 dy = useU ? posAt(fc + vec2(0.0, H), zu) - P : P - posAt(fc - vec2(0.0, H), zd);
  vec3 N = normalize(cross(dx, dy));
  if (dot(N, uCamPos - P) < 0.0) N = -N;
  float focal = 0.5 * uRes.y / tan(uFov * 0.5);
  // a 4x4 Bayer offset, so the composite's 4x4 average holds each offset once and the jitter cancels
  vec2 b0 = mod(floor(fc), 2.0), b1 = mod(floor(fc * 0.5), 2.0);
  float spin = (4.0 * mod(b0.x * 2.0 + b0.y * 3.0, 4.0) + mod(b1.x * 2.0 + b1.y * 3.0, 4.0) + 0.5) / 16.0;
  // the visual domain: where the wash's reach spans only a few pixels the forms it would describe are sub-pixel (a far
  // facade's window reveals), so the ink fades out rather than hatch them
  float reachPx = uWashR * focal / z;
  float lod = smoothstep(1.2 * uLineW, 3.2 * uLineW, reachPx);
  if (lod <= 0.0) { gl_FragColor = vec4(0.0, ol, 0.0, 1.0); return; }
  // a step under two pixels' worth of world off the plane is no crease (a panel a hair proud of its wall, layers that
  // alternate pixel by pixel at a grazing angle): only what rises past it counts
  float floorH = 2.0 * z / focal;
  float core = 1.0 - exp(-10.0 * rise(fc, P, N, z, uLineW, 3.0 * uLineW * z / focal, spin, 10, floorH, need));
  float rw = clamp(reachPx, uLineW * 2.0, 48.0 * uLineW / 2.5);
  float wash = 1.0 - exp(-9.0 * rise(fc, P, N, z, rw, 1.6 * rw * z / focal, spin, 28, floorH, need));
  float al = lod * (1.0 - (1.0 - core * uLineA) * (1.0 - wash * uWashA));
  gl_FragColor = vec4(al, ol, 0.0, 1.0);
}`;

// the composite: the creases' coverage averaged over the 4x4 round each pixel (its Bayer tile), counting only neighbours
// on the same surface (depth within 2 %), on an angular or land pixel; the outline's read as drawn (crisp) and laid over
// it in its own ink; premultiplied
const CREASE_COMPOSITE = `uniform sampler2D uZM; uniform sampler2D uInkT; uniform vec2 uRes; uniform vec3 uInk; uniform vec3 uOutInk; uniform vec3 uFog;
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec4 zm = texture2D(uZM, fc / uRes);
  if (zm.r <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // the scene's fog takes the ink as it takes the surface under it (three's: exp2 by density, or linear near..far)
  float fogK = uFog.x > 1.5 ? 1.0 - smoothstep(uFog.y, uFog.z, zm.r) : uFog.x > 0.5 ? exp(-uFog.y * uFog.y * zm.r * zm.r) : 1.0;
  float ol = fogK * texture2D(uInkT, fc / uRes).g;
  if (zm.g < 0.25) { gl_FragColor = vec4(uOutInk * ol, ol); return; }
  float s = 0.0, w = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 q = floor(fc) + vec2(float(i) - 1.5, float(j) - 1.5);
    float zq = texture2D(uZM, q / uRes).r;
    float wq = (zq > 0.0 && abs(zq - zm.r) < 0.02 * zm.r) ? 1.0 : 0.0;
    s += wq * texture2D(uInkT, q / uRes).r; w += wq;
  }
  float al = w > 0.0 ? fogK * s / w : 0.0;
  gl_FragColor = vec4(uOutInk * ol + uInk * al * (1.0 - ol), ol + al * (1.0 - ol));
}`;


// THE OCCLUSION (opt-in `occlusion`, scene/live-light.js readOcclusion): live contact occlusion on the same prepass. With
// it on, the prepass draws into TWO targets in its one render (WebGL2 multiple render targets): the depth and mask as
// above, and the face's view-space normal (from the depth's own derivatives: the merged fills carry no normal). A pass at
// half the resolution samples a hemisphere round each pixel's normal (`samples` offsets, a golden spiral rising from the
// rim, nearer the earlier, turned per pixel by the creases' 4x4 Bayer spin) out to `reach` metres: a sample is occluded
// where the depth there stands in front of it, weighed down where that surface is far off the pixel's (no halo round a
// silhouette). Its composite (a fullscreen quad in the scene, under the creases' and the fog) averages each pixel's 4x4
// half-resolution neighbours on the same surface (depth within 3 %), which cancels the spin and blurs without bleeding
// across an edge, and darkens by `strength`, faded by the fog as the creases are. One prepass for both: a world with
// creases pays nothing more for it. A CUTOUT (an alpha-tested map: a leaf card, a grass clump) cuts its holes in the
// prepass too, through an override that samples its map's alpha and discards below its alphaTest (one per class and
// map, made the first time it is met); drawn with the plain override, its transparent texels stood as a full rectangle
// and laid a square halo of occlusion round every clump. `__mojOcclusion` is the live handle (set(on)); `__mojLight` counts the prepass's
// calls (`prepassCalls`), its renders (`prepasses`) and the occlusion passes (`aoPasses`). Static occlusion stays baked.
// live-light.js occlusionAt is this pass in JS, pinned on stubs.

const OCC_FRAG = `uniform sampler2D uZM; uniform sampler2D uN; uniform vec2 uRes; uniform float uFov; uniform float uReach; uniform vec3 uKern[KERN];
float zAt(vec2 px) { return texture2D(uZM, px / uRes).r; }
void main() {
  vec2 hp = floor(gl_FragCoord.xy), fc = hp * 2.0 + 0.5;
  float z = zAt(fc);
  if (z <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float t = tan(uFov * 0.5);
  vec2 uv = (fc - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 P = vec3(uv * t * z, z), N = normalize(texture2D(uN, fc / uRes).xyz);
  vec2 b0 = mod(hp, 2.0), b1 = mod(floor(hp * 0.5), 2.0);
  float spin = (4.0 * mod(b0.x * 2.0 + b0.y * 3.0, 4.0) + mod(b1.x * 2.0 + b1.y * 3.0, 4.0) + 0.5) / 16.0;
  vec3 up = abs(N.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 T0 = normalize(cross(up, N)), B0 = cross(N, T0);
  float a = spin * 6.2831853;
  vec3 T = T0 * cos(a) + B0 * sin(a), B = cross(N, T);
  float occ = 0.0;
  for (int i = 0; i < KERN; i++) {
    vec3 k = uKern[i];
    vec3 S = P + (T * k.x + B * k.y + N * k.z) * uReach;
    if (S.z <= 1e-3) continue;
    vec2 q = floor(0.5 * uRes + (S.xy / (S.z * t)) * 0.5 * uRes.y) + 0.5;
    if (q.x < 0.0 || q.y < 0.0 || q.x > uRes.x || q.y > uRes.y) continue;
    float zq = zAt(q);
    if (zq <= 0.0) continue;
    float range = smoothstep(0.0, 1.0, uReach / max(abs(z - zq), 1e-6));
    occ += (zq < S.z - 0.02 * uReach ? 1.0 : 0.0) * range;
  }
  gl_FragColor = vec4(occ / float(KERN), z, 0.0, 1.0);
}`;

const OCC_COMPOSITE = `uniform sampler2D uZM; uniform sampler2D uAO; uniform vec2 uRes; uniform vec2 uHalf; uniform vec3 uFog; uniform float uStrength;
void main() {
  vec2 fc = gl_FragCoord.xy;
  float z = texture2D(uZM, fc / uRes).r;
  if (z <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float fogK = uFog.x > 1.5 ? 1.0 - smoothstep(uFog.y, uFog.z, z) : uFog.x > 0.5 ? exp(-uFog.y * uFog.y * z * z) : 1.0;
  vec2 h = floor(fc * 0.5);
  float s = 0.0, w = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec4 ao = texture2D(uAO, (h + vec2(float(i) - 1.0, float(j) - 1.0) + 0.5) / uHalf);
    float wq = (ao.g > 0.0 && abs(ao.g - z) < 0.03 * z) ? 1.0 : 0.0;
    s += wq * ao.r; w += wq;
  }
  float al = w > 0.0 ? clamp(uStrength * fogK * s / w, 0.0, 1.0) : 0.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, al);
}`;

/**
 * The prepass block with OCCLUSION on (`occ`: readOcclusion's terms), the creases' with it when `cfg` is set (null: the
 * occlusion alone). One prepass into two targets; the ink pass when creases are on, the occlusion pass, their composites.
 */
function prepassWithOcclusion(cfg, occ, metersPerUnit, aoHalf = false) {
  const unit = Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1;
  // THE HALF TIER (aoHalf, scene/live-light.js TIER_TERMS): the occlusion at half the cost. Alone, the prepass at half the
  // frame and its pass at half that (a quarter); beside the creases (whose ink wants the whole frame) the prepass whole
  // and the occlusion pass at a quarter. The composite reads the frame's pixel in the prepass by its share of the frame,
  // and its 4x4 occlusion texels at a quarter. As built (aoHalf false), every string below is the full tier's
  const pre = aoHalf && !cfg, step = aoHalf && cfg ? 4 : 2;
  const fragOcc = step === 4 ? OCC_FRAG.replace('fc = hp * 2.0 + 0.5;', 'fc = hp * 4.0 + 1.5;') : OCC_FRAG;
  const compOcc = aoHalf ? OCC_COMPOSITE.replace('vec2 h = floor(fc * 0.5);', 'vec2 h = floor(fc * 0.25);') : OCC_COMPOSITE;
  const reachUnits = cfg ? Math.round((cfg.reach / unit) * 1e4) / 1e4 : 0;
  const occReach = Math.round((occ.reach / unit) * 1e4) / 1e4;
  const kern = occlusionKernel(occ.samples);
  return `
// --- ${cfg ? 'creases and occlusion' : 'occlusion'} (opt-in ${cfg ? "'creases' + " : ''}'occlusion'): one prepass into two targets (depth and mask, normal)${cfg ? ', the vgl rule over the depth' : ''}, contact occlusion at ${aoHalf ? 'a quarter of the frame (the half tier)' : 'half resolution'} ---
const __crRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, count: 2 });
const __crVS = 'varying float vZ;\\nvarying vec3 vVP;\\n#include <common>\\n#include <skinning_pars_vertex>\\nvoid main() {\\n#include <skinbase_vertex>\\n#include <begin_vertex>\\n#include <skinning_vertex>\\n#include <project_vertex>\\nvZ = -mvPosition.z;\\nvVP = vec3(mvPosition.xy, -mvPosition.z);\\n}';
// (the second target: the face's normal in the creases' view frame, x right, y up, z forward; turned to the camera)
const __crFS = 'layout(location = 0) out highp vec4 oZM;\\nlayout(location = 1) out highp vec4 oN;\\nuniform float uM; varying float vZ; varying vec3 vVP;\\nvoid main() { vec3 n = normalize(cross(dFdx(vVP), dFdy(vVP))); if (dot(n, vVP) > 0.0) n = -n; oZM = vec4(vZ, uM, 0.0, 1.0); oN = vec4(n, 1.0); }';
const __crMask = (m) => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: __crVS, fragmentShader: __crFS, uniforms: { uM: { value: m } }, side: THREE.DoubleSide });
${cfg ? 'const __crA = __crMask(1), __crL = __crMask(0.5), __crB = __crMask(0);   // angular, land, organic' : 'const __crB = __crMask(0);   // (no creases: one class)'}
// a cutout's override: the class's, its holes cut where its map's alpha falls under its alphaTest
const __crVSC = __crVS.replace('varying float vZ;', 'varying float vZ;\\nvarying vec2 vCutUv;\\nuniform mat3 uCutT;').replace('vZ = -mvPosition.z;', 'vZ = -mvPosition.z;\\nvCutUv = (uCutT * vec3(uv, 1.0)).xy;');
const __crFSC = __crFS.replace('varying float vZ;', 'varying float vZ; varying vec2 vCutUv; uniform sampler2D uCut; uniform float uCutA;').replace('void main() {', 'void main() { if (texture(uCut, vCutUv).a < uCutA) discard;');
const __crCuts = new Map();
const __crCut = (cls, m) => {
  const k = cls.uniforms.uM.value + '|' + m.map.id + '|' + m.alphaTest;
  let c = __crCuts.get(k);
  if (!c) { c = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: __crVSC, fragmentShader: __crFSC, uniforms: { uM: { value: cls.uniforms.uM.value }, uCut: { value: m.map }, uCutA: { value: m.alphaTest }, uCutT: { value: m.map.matrix } }, side: THREE.DoubleSide }); __crCuts.set(k, c); }
  return c;
};
// a material that moves its vertices (the wind, a spray's growth) names its own (\`userData.prepass(vs)\` → { vertexShader,
// uniforms }): the class's fragment over that vertex shader, so the prepass sees it where the frame draws it
const __crMoves = new Map();
const __crMoved = (cls, m) => {
  const k = cls.uniforms.uM.value + '|' + m.uuid;
  let c = __crMoves.get(k);
  if (!c) { const P = m.userData.prepass(cls.vertexShader); c = new THREE.ShaderMaterial({ glslVersion: cls.glslVersion, vertexShader: P.vertexShader, fragmentShader: cls.fragmentShader, uniforms: Object.assign({}, P.uniforms, { uM: cls.uniforms.uM }), side: THREE.DoubleSide }); __crMoves.set(k, c); }
  return c;
};
const __crVSQ = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';${cfg ? `
const __crInkRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const __crU = { uZM: { value: __crRT.textures[0] }, uRes: { value: new THREE.Vector2() }, uCamPos: { value: new THREE.Vector3() }, uCamBasis: { value: new THREE.Matrix3() }, uFov: { value: 1 },
  uLineW: { value: 2.5 }, uLineA: { value: ${cfg.line} }, uWashR: { value: ${reachUnits} }, uWashA: { value: ${cfg.wash} },
  uOutW: { value: 1.5 }, uOutA: { value: ${cfg.outline ? 1 : 0} } };
const __crInkScene = new THREE.Scene();
const __crInkQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __crU, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(CREASE_FRAG)}, depthTest: false, depthWrite: false }));
__crInkQuad.frustumCulled = false; __crInkScene.add(__crInkQuad);
const __crCU = { uZM: __crU.uZM, uInkT: { value: __crInkRT.texture }, uRes: __crU.uRes, uInk: { value: new THREE.Vector3(${srgb(cfg.ink).join(', ')}) }, uOutInk: { value: new THREE.Vector3(${srgb(cfg.outline ? cfg.outline.ink : cfg.ink).join(', ')}) }, uFog: { value: new THREE.Vector3() } };
const __crQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __crCU, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(CREASE_COMPOSITE)}, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
__crQuad.frustumCulled = false; __crQuad.renderOrder = 99999;   // under fog (100000) and the effects layers
scene.add(__crQuad);` : ''}
// the occlusion: its half-resolution pass into its own target (r: occlusion, g: the depth it was read at), its composite
const __aoRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const __aoU = { uZM: { value: __crRT.textures[0] }, uN: { value: __crRT.textures[1] }, uRes: { value: new THREE.Vector2() }, uFov: { value: 1 }, uReach: { value: ${occReach} },
  uKern: { value: ${JSON.stringify(kern)}.map((k) => new THREE.Vector3(k[0], k[1], k[2])) } };
const __aoScene = new THREE.Scene();
const __aoPassQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __aoU, defines: { KERN: ${kern.length} }, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(fragOcc)}, depthTest: false, depthWrite: false }));
__aoPassQuad.frustumCulled = false; __aoScene.add(__aoPassQuad);
const __aoCU = { uZM: __aoU.uZM, uAO: { value: __aoRT.texture }, uRes: ${pre ? '{ value: new THREE.Vector2() }' : '__aoU.uRes'}, uHalf: { value: new THREE.Vector2() }, uFog: { value: new THREE.Vector3() }, uStrength: { value: ${occ.strength} } };
const __aoQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __aoCU, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(compOcc)}, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
__aoQuad.frustumCulled = false; __aoQuad.renderOrder = 99998;   // under the creases' ink, the fog and the effects layers
scene.add(__aoQuad);
const __crFw = new THREE.Vector3(), __crRi = new THREE.Vector3(), __crUp = new THREE.Vector3(), __crSz = new THREE.Vector2(), __crCc = new THREE.Color();${cfg ? `
const __mojCreases = window.__mojCreases = { on: true, set(on) { this.on = !!on; }, tint(hex) { const c = new THREE.Color(hex); __crCU.uInk.value.set(c.r, c.g, c.b); } };` : ''}
const __mojOcclusion = window.__mojOcclusion = { on: true, set(on) { this.on = !!on; } };
// (its own name for the shared probe: the live light's script declares __mojLight on the same page)
const __crLight = window.__mojLight = Object.assign(window.__mojLight || {}, { prepassCalls: 0, prepasses: 0, aoPasses: 0 });
// the prepass, before every frame's render: solids drawn with the override materials into both targets at once
const __creasePrepass = () => {
  __crLight.prepassCalls++;
  const __persp = !!camera.isPerspectiveCamera;${cfg ? `
  __crQuad.visible = __mojCreases.on && __persp;` : ''}
  __aoQuad.visible = __mojOcclusion.on && __persp;
  if (${cfg ? '!__crQuad.visible && ' : ''}!__aoQuad.visible) return;
  renderer.getSize(__crSz); const __dpr = renderer.getPixelRatio();
  const __w = Math.max(1, Math.round(__crSz.x * __dpr${pre ? ' * 0.5' : ''})), __h = Math.max(1, Math.round(__crSz.y * __dpr${pre ? ' * 0.5' : ''}));
  if (__crRT.width !== __w || __crRT.height !== __h) { __crRT.setSize(__w, __h);${cfg ? ' __crInkRT.setSize(__w, __h);' : ''} __aoRT.setSize(Math.max(1, __w >> ${step === 4 ? 2 : 1}), Math.max(1, __h >> ${step === 4 ? 2 : 1})); }
  const __sw = [];
  scene.traverseVisible((o) => {
    if (o === scene) return;
    const m = o.material;
    const solid = (o.isMesh || o.isInstancedMesh) && !o.userData.ink && m && (Array.isArray(m) || (m.depthTest !== false && m.depthWrite !== false && (!m.transparent || (o.userData.crease && m.opacity > 0.5))));
    const water = !solid && o.isMesh && m && m.transparent && o.geometry && o.geometry.getAttribute('color') && o.geometry.getAttribute('color').itemSize === 4;
    if (solid || water) { __sw.push([o, m]); const __cls = ${cfg ? "o.userData.crease === 1 ? __crA : o.userData.crease === 0.5 ? __crL : __crB" : '__crB'}; o.material = !Array.isArray(m) && m.userData && m.userData.prepass ? __crMoved(__cls, m) : !Array.isArray(m) && m.alphaTest > 0 && m.map ? __crCut(__cls, m) : __cls; }
    else if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { __sw.push([o, null]); o.visible = false; }
  });
  // (the shadow maps are the frame's, not the prepass's: three skips them here)
  const __bg = scene.background, __ca = renderer.getClearAlpha(), __sm = renderer.shadowMap.autoUpdate; renderer.getClearColor(__crCc);
  scene.background = null; renderer.setClearColor(0x000000, 0); renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(__crRT); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null); __crLight.prepasses++;
  renderer.setClearColor(__crCc, __ca); scene.background = __bg; renderer.shadowMap.autoUpdate = __sm;
  for (const [o, m] of __sw) { if (m) o.material = m; else o.visible = true; }
  const __fg = scene.fog, __fv = [__fg && __fg.isFogExp2 ? 1 : __fg && __fg.isFog ? 2 : 0, __fg ? (__fg.isFogExp2 ? __fg.density : __fg.near) : 0, __fg && __fg.isFog ? __fg.far : 0];${cfg ? `
  if (__crQuad.visible) {
    camera.getWorldDirection(__crFw); __crRi.crossVectors(__crFw, camera.up).normalize(); __crUp.crossVectors(__crRi, __crFw).normalize();
    __crU.uCamBasis.value.set(__crRi.x, __crUp.x, __crFw.x, __crRi.y, __crUp.y, __crFw.y, __crRi.z, __crUp.z, __crFw.z);
    __crU.uCamPos.value.copy(camera.position); __crU.uFov.value = camera.fov * Math.PI / 180;
    __crCU.uFog.value.set(__fv[0], __fv[1], __fv[2]);
    __crU.uRes.value.set(__w, __h); __crU.uLineW.value = 1.25 * __dpr; __crU.uOutW.value = ${cfg.outline ? cfg.outline.width : 1.5} * __dpr;
    // the ink pass: coverage into its own target, read back by the composite quad in the scene
    renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(__crInkRT); renderer.clear(); renderer.render(__crInkScene, camera); renderer.setRenderTarget(null);
    renderer.setClearColor(__crCc, __ca);
  }` : ''}
  if (__aoQuad.visible) {
    __aoU.uRes.value.set(__w, __h);${pre ? ' __aoCU.uRes.value.set(Math.max(1, Math.round(__crSz.x * __dpr)), Math.max(1, Math.round(__crSz.y * __dpr)));' : ''} __aoU.uFov.value = camera.fov * Math.PI / 180; __aoCU.uHalf.value.set(__aoRT.width, __aoRT.height); __aoCU.uFog.value.set(__fv[0], __fv[1], __fv[2]);
    // the occlusion pass: half the resolution, into its own target, read back (blurred on the surface) by its composite
    renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(__aoRT); renderer.clear(); renderer.render(__aoScene, camera); renderer.setRenderTarget(null); __crLight.aoPasses++;
    renderer.setClearColor(__crCc, __ca);
  }
};
`;
}

/**
 * The crease block. `cfg`: readCreases' terms (null with occlusion alone); `metersPerUnit` sizes the wash's reach in
 * world units (absent: 1); `occlusion` (readOcclusion's terms, scene/live-light.js) puts the occlusion on the same
 * prepass. Without it the block is the creases' alone, as it always was.
 */
export function creasesChannelScript(cfg, { metersPerUnit = null, occlusion = null, aoHalf = false } = {}) {
  if (occlusion) return prepassWithOcclusion(cfg, occlusion, metersPerUnit, aoHalf);
  const reachUnits = Math.round((cfg.reach / (Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1)) * 1e4) / 1e4;
  return `
// --- creases (opt-in 'creases'): the vgl rule over the scene's depth, angular surfaces only; the outline when asked ---
const __crRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const __crVS = 'varying float vZ;\\n#include <common>\\n#include <skinning_pars_vertex>\\nvoid main() {\\n#include <skinbase_vertex>\\n#include <begin_vertex>\\n#include <skinning_vertex>\\n#include <project_vertex>\\nvZ = -mvPosition.z;\\n}';
const __crMask = (m) => new THREE.ShaderMaterial({ vertexShader: __crVS, fragmentShader: 'uniform float uM; varying float vZ; void main() { gl_FragColor = vec4(vZ, uM, 0.0, 1.0); }', uniforms: { uM: { value: m } }, side: THREE.DoubleSide });
const __crA = __crMask(1), __crL = __crMask(0.5), __crB = __crMask(0);   // angular, land, organic
// a material that moves its vertices (the wind, a spray's growth) names its own (\`userData.prepass(vs)\` → { vertexShader,
// uniforms }): the class's fragment over that vertex shader, so the prepass sees it where the frame draws it
const __crMoves = new Map();
const __crMoved = (cls, m) => {
  const k = cls.uniforms.uM.value + '|' + m.uuid;
  let c = __crMoves.get(k);
  if (!c) { const P = m.userData.prepass(cls.vertexShader); c = new THREE.ShaderMaterial({ glslVersion: cls.glslVersion, vertexShader: P.vertexShader, fragmentShader: cls.fragmentShader, uniforms: Object.assign({}, P.uniforms, { uM: cls.uniforms.uM }), side: THREE.DoubleSide }); __crMoves.set(k, c); }
  return c;
};
const __crInkRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const __crVSQ = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
const __crU = { uZM: { value: __crRT.texture }, uRes: { value: new THREE.Vector2() }, uCamPos: { value: new THREE.Vector3() }, uCamBasis: { value: new THREE.Matrix3() }, uFov: { value: 1 },
  uLineW: { value: 2.5 }, uLineA: { value: ${cfg.line} }, uWashR: { value: ${reachUnits} }, uWashA: { value: ${cfg.wash} },
  uOutW: { value: 1.5 }, uOutA: { value: ${cfg.outline ? 1 : 0} } };
const __crInkScene = new THREE.Scene();
const __crInkQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __crU, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(CREASE_FRAG)}, depthTest: false, depthWrite: false }));
__crInkQuad.frustumCulled = false; __crInkScene.add(__crInkQuad);
const __crCU = { uZM: __crU.uZM, uInkT: { value: __crInkRT.texture }, uRes: __crU.uRes, uInk: { value: new THREE.Vector3(${srgb(cfg.ink).join(', ')}) }, uOutInk: { value: new THREE.Vector3(${srgb(cfg.outline ? cfg.outline.ink : cfg.ink).join(', ')}) }, uFog: { value: new THREE.Vector3() } };
const __crQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __crCU, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(CREASE_COMPOSITE)}, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
__crQuad.frustumCulled = false; __crQuad.renderOrder = 99999;   // under fog (100000) and the effects layers
scene.add(__crQuad);
const __crFw = new THREE.Vector3(), __crRi = new THREE.Vector3(), __crUp = new THREE.Vector3(), __crSz = new THREE.Vector2(), __crCc = new THREE.Color();
const __mojCreases = window.__mojCreases = { on: true, set(on) { this.on = !!on; }, tint(hex) { const c = new THREE.Color(hex); __crCU.uInk.value.set(c.r, c.g, c.b); } };
// the mask-and-depth prepass, before every frame's render: solids drawn with the override materials into __crRT
const __creasePrepass = () => {
  __crQuad.visible = __mojCreases.on && !!camera.isPerspectiveCamera;
  if (!__crQuad.visible) return;
  renderer.getSize(__crSz); const __dpr = renderer.getPixelRatio();
  const __w = Math.max(1, Math.round(__crSz.x * __dpr)), __h = Math.max(1, Math.round(__crSz.y * __dpr));
  if (__crRT.width !== __w || __crRT.height !== __h) { __crRT.setSize(__w, __h); __crInkRT.setSize(__w, __h); }
  const __sw = [];
  scene.traverseVisible((o) => {
    if (o === scene) return;
    const m = o.material;
    // a solid writes depth in the frame itself (a sky dome does not: it is the background, not a surface behind)
    const solid = (o.isMesh || o.isInstancedMesh) && !o.userData.ink && m && (Array.isArray(m) || (m.depthTest !== false && m.depthWrite !== false && (!m.transparent || (o.userData.crease && m.opacity > 0.5))));
    // a water sheet (channels/water.js: translucent, per-vertex alpha in RGBA colours) is a surface to the eye: it hides
    // the bed under it, and is never inked
    const water = !solid && o.isMesh && m && m.transparent && o.geometry && o.geometry.getAttribute('color') && o.geometry.getAttribute('color').itemSize === 4;
    if (solid || water) { __sw.push([o, m]); const __cls = o.userData.crease === 1 ? __crA : o.userData.crease === 0.5 ? __crL : __crB; o.material = !Array.isArray(m) && m.userData && m.userData.prepass ? __crMoved(__cls, m) : __cls; }
    else if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { __sw.push([o, null]); o.visible = false; }
  });
  const __bg = scene.background, __ca = renderer.getClearAlpha(); renderer.getClearColor(__crCc);
  scene.background = null; renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(__crRT); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
  renderer.setClearColor(__crCc, __ca); scene.background = __bg;
  for (const [o, m] of __sw) { if (m) o.material = m; else o.visible = true; }
  camera.getWorldDirection(__crFw); __crRi.crossVectors(__crFw, camera.up).normalize(); __crUp.crossVectors(__crRi, __crFw).normalize();
  __crU.uCamBasis.value.set(__crRi.x, __crUp.x, __crFw.x, __crRi.y, __crUp.y, __crFw.y, __crRi.z, __crUp.z, __crFw.z);
  __crU.uCamPos.value.copy(camera.position); __crU.uFov.value = camera.fov * Math.PI / 180;
  const __fg = scene.fog; __crCU.uFog.value.set(__fg && __fg.isFogExp2 ? 1 : __fg && __fg.isFog ? 2 : 0, __fg ? (__fg.isFogExp2 ? __fg.density : __fg.near) : 0, __fg && __fg.isFog ? __fg.far : 0);
  __crU.uRes.value.set(__w, __h); __crU.uLineW.value = 1.25 * __dpr; __crU.uOutW.value = ${cfg.outline ? cfg.outline.width : 1.5} * __dpr;
  // the ink pass: coverage into its own target, read back by the composite quad in the scene
  renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(__crInkRT); renderer.clear(); renderer.render(__crInkScene, camera); renderer.setRenderTarget(null);
  renderer.setClearColor(__crCc, __ca);
};
`;
}
