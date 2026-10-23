/**
 * EFFECT RIM — the characters lit at their edges by the effects round them: a beam's head going by, a charge at the
 * hand, a blast beside them. A way an effect is expressed on the bodies it plays among, not on the world (that is the
 * effect light's, effect-light.js). Each character wears a FIELD: a smooth shell a little off its body (its faces' corners
 * welded where they meet, their normals averaged, so the shell is smooth over the whole model whatever its faces are,
 * and pushed out along them by the look's gap), its back faces only (an inverted hull: one field round the whole model,
 * not round each of its pieces), drawn purely by its fresnel: bright at the silhouette, nothing face on,
 * in the colour of the effect lights that reach it (the effect light's lights of the frame, falling off as they do,
 * k / (d² + r²)). The gap shows the field.
 *
 *   rim: { k, p, band, gap }   (a composed style floor's, juice-style.js: the look's rim at the game type's strength)
 *     k     how strong (× the light's own)
 *     p     how narrow (the fresnel's power: high is a thin line)
 *     band  0 a soft rim (it fades in toward the silhouette); above 0 a CEL band: flat, hard-edged, where the fresnel passes
 *     gap   metres the field stands off the body
 *
 *   rimScript(rim)    the page's block: __stepRim() (every character fielded as it comes, its body marking the stencil the
 *                     fields keep out of; the fields follow their bodies
 *                     only while an effect light is live; the lights are the effect light's, so it rides after
 *                     __stepFxLight)
 *   rimWanted(events) whether a world's events will rim its characters (the page then exposes their bodies)
 */
import { FX_LIGHT } from './effect-light.js';
import { juiceFloor } from './juice-style.js';

/** Whether a world's events will rim its characters: a composed style floor whose rim is on, on a world whose cues reach
 *  its cast (the page then exposes the characters' bodies for it). */
export function rimWanted(events) {
  const s = events && events.cast === true && events.fxStyle;
  if (!s || typeof s !== 'object') return false;
  try { return juiceFloor(s).rim.k > 0; } catch { return false; }
}
/** Whether a world's events will draw on its characters at all (their rim, or a weapon's swing trail: trail-channel.js):
 *  the page exposes the characters' bodies for them. */
export function bodiesWanted(events) {
  const s = events && events.cast === true && events.fxStyle;
  if (!s || typeof s !== 'object') return false;
  try { const F = juiceFloor(s); return F.rim.k > 0 || F.trail.life > 0; } catch { return false; }
}

/** The page's block. Needs the effect light's gather (__fxlU), emitted before it. */
export function rimScript(rim) {
  return `
// --- effect rim: the characters wear a field lit at its silhouette by the frame's effect lights (scene/effect-rim.js) ---
const __rimU = { uRmK: { value: ${+rim.k} }, uRmP: { value: ${+rim.p} }, uRmBand: { value: ${+rim.band || 0} } };
const __RIM_GAP = ${+rim.gap || 0};
const __rimMat = (() => {
  // the shell's back faces only (an inverted hull): inside the body's silhouette they lie behind the body and are hidden,
  // outside it they are one field round the whole model (not an outline round each of its pieces)
  // and only where no character is drawn (the stencil its bodies mark): the field shows outside the whole silhouette,
  // never over the body, however its pieces lie on each other
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp });
  m.userData.__fire = true; m.userData.__fxl = true;   // its own light: neither the fire channel nor the effect light lights it
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, __fxlU, __rimU);
    sh.vertexShader = 'varying vec3 vRmN;\\nvarying vec3 vRmW;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\nvRmN = normalize(mat3(modelMatrix) * normal);\\nvRmW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = __fxlFS.replace('varying vec3 vFxW;', '') + 'uniform float uRmK; uniform float uRmP; uniform float uRmBand; varying vec3 vRmN; varying vec3 vRmW;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', \`#include <dithering_fragment>
  { vec3 N = normalize(vRmN), V = normalize(cameraPosition - vRmW);
    float f = pow(1.0 - abs(dot(N, V)), uRmP);
    if (uRmBand > 0.0) f = step(uRmBand, f);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < ${FX_LIGHT.max}; i++) { vec4 P = uFxP[i]; if (P.w <= 0.0) continue; vec3 L = P.xyz - vRmW; acc += uFxC[i].rgb * P.w / (dot(L, L) + uFxC[i].w); }
    gl_FragColor = vec4(min(acc * f * uRmK, vec3(1.6)), 1.0); }\`);
  };
  return m;
})();
// a body mesh's field: its corners welded where they meet (once: they move together as the rig moves them), its faces'
// normals averaged over each weld each frame, the shell pushed out along them by the gap
function __rimField(o) {
  const src = o.geometry, P = src.attributes.position, n = P.count, idx = src.index ? src.index.array : null, weld = new Int32Array(n), keys = new Map();
  for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 2000) + ',' + Math.round(P.getY(i) * 2000) + ',' + Math.round(P.getZ(i) * 2000); let w = keys.get(k); if (w === undefined) { w = keys.size; keys.set(k, w); } weld[i] = w; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); if (idx) g.setIndex(src.index);
  const f = new THREE.Mesh(g, __rimMat); f.userData.rim = true; f.raycast = function () {}; f.frustumCulled = false; f.renderOrder = 5; f.visible = false; o.add(f);
  return { o, f, weld, acc: new Float32Array(keys.size * 3), tri: idx ? idx.length / 3 : n / 3, idx };
}
function __rimFollow(F) {
  const p = F.o.geometry.attributes.position.array, A = F.acc, W = F.weld, idx = F.idx; A.fill(0);
  for (let t = 0; t < F.tri; t++) {
    const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;   // area-weighted
    for (const v of [a, b, c]) { const w = W[v] * 3; A[w] += nx; A[w + 1] += ny; A[w + 2] += nz; }
  }
  const pos = F.f.geometry.attributes.position.array, nor = F.f.geometry.attributes.normal.array;
  for (let i = 0; i < W.length; i++) {
    const w = W[i] * 3, l = Math.hypot(A[w], A[w + 1], A[w + 2]) || 1, x = A[w] / l, y = A[w + 1] / l, z = A[w + 2] / l;
    nor[i * 3] = x; nor[i * 3 + 1] = y; nor[i * 3 + 2] = z;
    pos[i * 3] = p[i * 3] + x * __RIM_GAP; pos[i * 3 + 1] = p[i * 3 + 1] + y * __RIM_GAP; pos[i * 3 + 2] = p[i * 3 + 2] + z * __RIM_GAP;
  }
  F.f.geometry.attributes.position.needsUpdate = true; F.f.geometry.attributes.normal.needsUpdate = true;
}
const __rimFields = [], __rimDone = new WeakSet();
let __rimSeen = -1;
function __stepRim() {
  const B = window.__mojCtrl && window.__mojCtrl.bodies; if (!B) return;
  let n = 0; for (const id in B) if (B[id]) B[id].traverse(() => { n++; });
  if (n !== __rimSeen) {
    __rimSeen = n;
    // every character's meshes as they come (not its ink, its status coats or its own field)
    for (const id in B) if (B[id]) B[id].traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || __rimDone.has(o) || (o.userData && (o.userData.ink || o.userData.coat || o.userData.rim))) return;
      __rimDone.add(o); const F = __rimField(o); __rimDone.add(F.f); __rimFields.push(F);
      // the body marks where it is drawn (the stencil the fields keep out of); its colour is untouched
      for (const bm of Array.isArray(o.material) ? o.material : [o.material]) if (bm && !bm.stencilWrite) Object.assign(bm, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    });
  }
  // the fields follow their bodies only while an effect light is live (none: nothing to draw, nothing to do)
  const lit = __fxlU.uFxP.value.some((v) => v.w > 0);
  for (const F of __rimFields) { const show = lit && F.o.visible && !!F.o.parent; F.f.visible = show; if (show) __rimFollow(F); }
}
window.__mojRim = { fields: () => __rimFields.length };`;
}
