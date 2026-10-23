/**
 * EFFECT RIM — the characters lit at their edges by the effects round them: a beam's head going by, a charge at the
 * hand, a blast beside them. A way an effect is expressed on the bodies it plays among, not on the world (that is the
 * effect light's, effect-light.js). The page reads the effect light's lights of the frame (its __fxlU uniforms, the
 * same strongest few), and every character's meshes carry a coat that adds, at each point, every light's colour times
 * its strength falling off as the effect light's (k / (d² + r²)), on the side of the body that faces it, at the
 * silhouette only (a fresnel): the rim of a body standing in the glow of its own attack.
 *
 *   rim: { k, p, band }   (a composed style floor's, juice-style.js: the look's rim at the game type's strength)
 *     k     how strong (× the light's own)
 *     p     how narrow (the fresnel's power: high is a thin line)
 *     band  0 a soft rim (it fades in from the middle); above 0 a CEL band: flat, hard-edged, where the fresnel passes it
 *
 *   rimScript(rim)   the page's block: __stepRim() (every character's meshes coated as they come; the lights are the
 *                    effect light's, so it rides after __stepFxLight)
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

/** The page's block. Needs the effect light's gather (__fxlU), emitted before it. */
export function rimScript(rim) {
  return `
// --- effect rim: the characters lit at their edges by the frame's effect lights (scene/effect-rim.js) ---
const __rimU = { uRmK: { value: ${+rim.k} }, uRmP: { value: ${+rim.p} }, uRmBand: { value: ${+rim.band || 0} } };
const __rimMat = (() => {
  // (a character's faces carry no normals: each face's own is taken from its world position's derivatives, so the rim
  // follows the body as its rig moves it; it lies on the body by a polygon offset)
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.userData.__fire = true; m.userData.__fxl = true;   // its own light: neither the fire channel nor the effect light lights it
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, __fxlU, __rimU);
    sh.vertexShader = 'varying vec3 vRmW;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\nvRmW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = __fxlFS.replace('varying vec3 vFxW;', '') + 'uniform float uRmK; uniform float uRmP; uniform float uRmBand; varying vec3 vRmW;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', \`#include <dithering_fragment>
  { vec3 V = normalize(cameraPosition - vRmW), N = normalize(cross(dFdx(vRmW), dFdy(vRmW))); if (dot(N, V) < 0.0) N = -N;
    float f = pow(1.0 - abs(dot(N, V)), uRmP);
    if (uRmBand > 0.0) f = step(uRmBand, f);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < ${FX_LIGHT.max}; i++) { vec4 P = uFxP[i]; if (P.w <= 0.0) continue; vec3 L = P.xyz - vRmW; float d2 = dot(L, L); float face = max(0.0, dot(N, L * inversesqrt(max(d2, 1e-6))));
      if (uRmBand > 0.0) face = step(0.15, face);
      acc += uFxC[i].rgb * P.w / (d2 + uFxC[i].w) * face; }
    gl_FragColor = vec4(min(acc * f * uRmK, vec3(1.6)), 1.0); }\`);
  };
  return m;
})();
const __rimDone = new WeakSet();
let __rimSeen = -1;
function __stepRim() {
  const B = window.__mojCtrl && window.__mojCtrl.bodies; if (!B) return;
  let n = 0; for (const id in B) if (B[id]) B[id].traverse(() => { n++; });
  if (n === __rimSeen) return; __rimSeen = n;
  // every character's meshes as they come (not its ink, its status coats or its own rim)
  for (const id in B) if (B[id]) B[id].traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || __rimDone.has(o) || (o.userData && (o.userData.ink || o.userData.coat || o.userData.rim))) return;
    __rimDone.add(o); const c = new THREE.Mesh(o.geometry, __rimMat); c.userData.rim = true; c.raycast = function () {}; c.renderOrder = 5; o.add(c); __rimDone.add(c);
  });
}
window.__mojRim = { coated: () => __rimSeen };`;
}
