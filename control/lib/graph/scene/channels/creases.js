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

/**
 * The crease block. `cfg`: readCreases' terms; `metersPerUnit` sizes the wash's reach in world units (absent: 1).
 */
export function creasesChannelScript(cfg, { metersPerUnit = null } = {}) {
  const reachUnits = Math.round((cfg.reach / (Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1)) * 1e4) / 1e4;
  return `
// --- creases (opt-in 'creases'): the vgl rule over the scene's depth, angular surfaces only; the outline when asked ---
const __crRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const __crVS = 'varying float vZ;\\n#include <common>\\n#include <skinning_pars_vertex>\\nvoid main() {\\n#include <skinbase_vertex>\\n#include <begin_vertex>\\n#include <skinning_vertex>\\n#include <project_vertex>\\nvZ = -mvPosition.z;\\n}';
const __crMask = (m) => new THREE.ShaderMaterial({ vertexShader: __crVS, fragmentShader: 'uniform float uM; varying float vZ; void main() { gl_FragColor = vec4(vZ, uM, 0.0, 1.0); }', uniforms: { uM: { value: m } }, side: THREE.DoubleSide });
const __crA = __crMask(1), __crL = __crMask(0.5), __crB = __crMask(0);   // angular, land, organic
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
    if (solid || water) { __sw.push([o, m]); o.material = o.userData.crease === 1 ? __crA : o.userData.crease === 0.5 ? __crL : __crB; }
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
