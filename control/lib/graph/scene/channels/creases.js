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
//     points, sprites, every fullscreen quad and non-angular translucent meshes are hidden for it.
//   • THE INK: a fullscreen pass (into its own target) per pixel rebuilds the position from
//     the view depth, the face normal from the steadier neighbour on each axis, and samples a disc twice — a small one
//     of constant pixel radius (the line) and one of constant WORLD radius projected (the wash). Each sample's rise above
//     the plane is weighted by a falloff kernel, by how surely it touches the pixel (reach), by depth (not a surface in
//     front) and by the mask, with a floor under ~5° (a flat face's numeric noise); a soft response blends the band out.
//     Samples sit on texel centres, so the position rebuilt matches the depth read. Where the wash's reach spans only a
//     few pixels (a far facade's window reveals are then sub-pixel) the ink fades out instead of hatching them. The
//     samples are jittered by a 4x4 Bayer offset, and THE COMPOSITE (a fullscreen quad in the scene, premultiplied,
//     under fog and the effects layers) averages each pixel's 4x4 on the same surface, so the jitter cancels: the
//     band blends instead of stippling where only a few samples find the rising face.
//
// Only an angular pixel takes ink, and only an angular sample counts as its partner: a tree is never inked, nor the ground
// at its foot. A non-perspective camera hides the quad. `__mojCreases` is the live handle (set(on), tint(hex)).
// Absent `creases` ⇒ no block, no prepass, no marks: the page is byte-identical.

/** the defaults: a warm umber ink, the line's and the wash's strength, the wash's reach in metres */
export const CREASE_DEFAULTS = Object.freeze({ ink: '#2b2116', line: 0.85, wash: 0.6, reach: 2 });
const CREASE_KEYS = Object.keys(CREASE_DEFAULTS);
const HEX = /^#[0-9a-fA-F]{6}$/;

/** `creases` → null (absent / false) or the resolved terms; anything malformed throws, naming the setting. */
export function readCreases(c) {
  if (c === undefined || c === null || c === false) return null;
  if (c !== true && (typeof c !== 'object' || Array.isArray(c))) throw new Error('creases is true or { ink, line, wash, reach }');
  const o = c === true ? {} : c;
  for (const k of Object.keys(o)) if (!CREASE_KEYS.includes(k)) throw new Error(`creases.${k} is not a setting (creases: ${CREASE_KEYS.join(', ')})`);
  const out = { ...CREASE_DEFAULTS, ...o };
  if (!HEX.test(out.ink)) throw new Error('creases.ink is a #rrggbb colour');
  for (const k of ['line', 'wash']) if (!(typeof out[k] === 'number' && out[k] >= 0 && out[k] <= 1)) throw new Error(`creases.${k} is a strength, 0 (none) to 1`);
  if (!(typeof out.reach === 'number' && out.reach >= 0.1 && out.reach <= 20)) throw new Error('creases.reach is the wash\'s reach in metres, 0.1 to 20');
  return out;
}

const srgb = (hex) => [1, 3, 5].map((i) => Math.round((parseInt(hex.slice(i, i + 2), 16) / 255) * 1e4) / 1e4);

const CREASE_FRAG = `uniform sampler2D uZM; uniform vec2 uRes; uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform float uFov;
uniform float uLineW; uniform float uLineA; uniform float uWashR; uniform float uWashA;
float zAt(vec2 px) { return texture2D(uZM, px / uRes).r; }
float mAt(vec2 px) { return texture2D(uZM, px / uRes).g; }
vec3 posAt(vec2 px, float z) {
  vec2 uv = (px - 0.5 * uRes) / (0.5 * uRes.y); float t = tan(uFov * 0.5);
  return uCamPos + (uCamBasis * vec3(uv.x * t, uv.y * t, 1.0)) * z;
}
float rise(vec2 fc, vec3 P, vec3 N, float z, float r, float reach, float spin, const int K, float step) {
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
    s += kern * wj * wr * mAt(q) * max((dot(d, N) - step) / L - 0.09, 0.0) / 0.91;
  }
  return wsum > 0.0 ? s / wsum : 0.0;
}
void main() {
  vec2 fc = gl_FragCoord.xy;
  float z = zAt(fc);
  if (z <= 0.0 || mAt(fc) < 0.5) { gl_FragColor = vec4(0.0); return; }
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
  if (lod <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // a step under two pixels' worth of world off the plane is no crease (a panel a hair proud of its wall, layers that
  // alternate pixel by pixel at a grazing angle): only what rises past it counts
  float step = 2.0 * z / focal;
  float core = 1.0 - exp(-10.0 * rise(fc, P, N, z, uLineW, 3.0 * uLineW * z / focal, spin, 10, step));
  float rw = clamp(reachPx, uLineW * 2.0, 48.0 * uLineW / 2.5);
  float wash = 1.0 - exp(-9.0 * rise(fc, P, N, z, rw, 1.6 * rw * z / focal, spin, 28, step));
  float al = lod * (1.0 - (1.0 - core * uLineA) * (1.0 - wash * uWashA));
  gl_FragColor = vec4(al, 0.0, 0.0, 1.0);
}`;

// the composite: the ink pass's coverage averaged over the 4x4 round each pixel (its Bayer tile), counting only
// neighbours on the same surface (depth within 2 %) and only on an angular pixel; tinted and laid over premultiplied
const CREASE_COMPOSITE = `uniform sampler2D uZM; uniform sampler2D uInkT; uniform vec2 uRes; uniform vec3 uInk;
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec4 zm = texture2D(uZM, fc / uRes);
  if (zm.r <= 0.0 || zm.g < 0.5) { gl_FragColor = vec4(0.0); return; }
  float s = 0.0, w = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 q = floor(fc) + vec2(float(i) - 1.5, float(j) - 1.5);
    float zq = texture2D(uZM, q / uRes).r;
    float wq = (zq > 0.0 && abs(zq - zm.r) < 0.02 * zm.r) ? 1.0 : 0.0;
    s += wq * texture2D(uInkT, q / uRes).r; w += wq;
  }
  float al = w > 0.0 ? s / w : 0.0;
  gl_FragColor = vec4(uInk * al, al);
}`;

/**
 * The crease block. `cfg`: readCreases' terms; `metersPerUnit` sizes the wash's reach in world units (absent: 1).
 */
export function creasesChannelScript(cfg, { metersPerUnit = null } = {}) {
  const reachUnits = Math.round((cfg.reach / (Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1)) * 1e4) / 1e4;
  return `
// --- creases (opt-in 'creases'): the vgl rule over the scene's depth; angular surfaces only ---
const __crRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
const __crVS = 'varying float vZ;\\n#include <common>\\n#include <skinning_pars_vertex>\\nvoid main() {\\n#include <skinbase_vertex>\\n#include <begin_vertex>\\n#include <skinning_vertex>\\n#include <project_vertex>\\nvZ = -mvPosition.z;\\n}';
const __crMask = (m) => new THREE.ShaderMaterial({ vertexShader: __crVS, fragmentShader: 'uniform float uM; varying float vZ; void main() { gl_FragColor = vec4(vZ, uM, 0.0, 1.0); }', uniforms: { uM: { value: m } }, side: THREE.DoubleSide });
const __crA = __crMask(1), __crB = __crMask(0);
const __crInkRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const __crVSQ = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
const __crU = { uZM: { value: __crRT.texture }, uRes: { value: new THREE.Vector2() }, uCamPos: { value: new THREE.Vector3() }, uCamBasis: { value: new THREE.Matrix3() }, uFov: { value: 1 },
  uLineW: { value: 2.5 }, uLineA: { value: ${cfg.line} }, uWashR: { value: ${reachUnits} }, uWashA: { value: ${cfg.wash} } };
const __crInkScene = new THREE.Scene();
const __crInkQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: __crU, vertexShader: __crVSQ, fragmentShader: ${JSON.stringify(CREASE_FRAG)}, depthTest: false, depthWrite: false }));
__crInkQuad.frustumCulled = false; __crInkScene.add(__crInkQuad);
const __crCU = { uZM: __crU.uZM, uInkT: { value: __crInkRT.texture }, uRes: __crU.uRes, uInk: { value: new THREE.Vector3(${srgb(cfg.ink).join(', ')}) } };
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
    const solid = (o.isMesh || o.isInstancedMesh) && !o.userData.ink && m && (Array.isArray(m) || (m.depthTest !== false && (!m.transparent || (o.userData.crease && m.opacity > 0.5))));
    if (solid) { __sw.push([o, m]); o.material = o.userData.crease ? __crA : __crB; }
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
  __crU.uRes.value.set(__w, __h); __crU.uLineW.value = 1.25 * __dpr;
  // the ink pass: coverage into its own target, read back by the composite quad in the scene
  renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(__crInkRT); renderer.clear(); renderer.render(__crInkScene, camera); renderer.setRenderTarget(null);
  renderer.setClearColor(__crCc, __ca);
};
`;
}
