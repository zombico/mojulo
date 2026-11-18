// In-page script: THE SHOT LIGHT on a side map's page (worlds/controllable/shot-light.js): the map's light is baked into
// its faces (gameworld/side-map/light.js), and what shines in a fight is laid over that bake while it lasts: a buster's
// rounds in their level's colours, a foe's shots in theirs, a burst as it goes off, a muzzle's flash, the hero's charge
// at its chest. Appended after the controllable channel's own script (it wraps stepControllable) on a page whose camera
// is the side map's only, so every other page keeps every byte.
//
//   THE LIGHTS  read off the world each frame (shotLights, the same source the tests run), the strongest few near the
//               pilot, into shared uniforms
//   THE MAP     every baked face of it (the scene's solids drawn as three's MeshBasicMaterial: the baked groups and
//               their textured faces, the doodads among them) adds, over its baked colour, each light's falloff (the
//               square of what is left of its reach) by how the face turns to it (half-Lambert: a top under a round
//               most, a wall beside it, a face turned away a little), in the surface's own hue (its baked colour over
//               its brightest channel, toward white): no shadows, a light reaches what is near it
//
// `window.__mojCtrl.shotLight()` says the lights laid this frame and how many materials carry them (a page's check).
import { shotLights } from '../../../worlds/controllable/shot-light.js';

export const SHOT_LIGHT_K = 6;

export function shotLightScript() {
  const K = SHOT_LIGHT_K;
  return `
// ── THE SHOT LIGHT ──
const __shotLights = ${shotLights.toString()};
const __SL = { last: [], patched: 0, U: { uSlN: { value: 0 }, uSlP: { value: Array.from({ length: ${K} }, () => new THREE.Vector3()) }, uSlC: { value: Array.from({ length: ${K} }, () => new THREE.Vector3()) }, uSlR: { value: new Array(${K}).fill(1) } } };
(function __slPatch() {
  const list = typeof solids !== 'undefined' ? solids : [];
  for (const m of list) {
    const mat = m && m.material;
    if (!mat || !mat.isMeshBasicMaterial || mat.__shotLight) continue;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      Object.assign(sh.uniforms, __SL.U);
      sh.vertexShader = 'varying vec3 vSlW;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  { vec4 slw = vec4( transformed, 1.0 );\\n#ifdef USE_INSTANCING\\n  slw = instanceMatrix * slw;\\n#endif\\n  vSlW = ( modelMatrix * slw ).xyz; }');
      sh.fragmentShader = 'varying vec3 vSlW;\\nuniform int uSlN;\\nuniform vec3 uSlP[${K}];\\nuniform vec3 uSlC[${K}];\\nuniform float uSlR[${K}];\\n'
        + 'vec3 slGlow( vec3 c ) {\\n  if ( uSlN == 0 ) return vec3( 0.0 );\\n  vec3 N = normalize( cross( dFdx( vSlW ), dFdy( vSlW ) ) ), g = vec3( 0.0 );\\n'
        + '  for ( int k = 0; k < ${K}; k++ ) { if ( k >= uSlN ) break; vec3 d = uSlP[ k ] - vSlW; float r = length( d ), f = clamp( 1.0 - r / uSlR[ k ], 0.0, 1.0 ); g += uSlC[ k ] * ( f * f * ( 0.5 + 0.5 * dot( N, d / max( r, 1e-3 ) ) ) ); }\\n'
        + '  return ( 0.3 + 0.7 * c / max( max( c.r, c.g ), max( c.b, 0.03 ) ) ) * g;\\n}\\n'
        + sh.fragmentShader.replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', 'vec3 outgoingLight = reflectedLight.indirectDiffuse + slGlow( diffuseColor.rgb );');
    };
    mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|shot-light'; };
    mat.__shotLight = true; mat.needsUpdate = true; __SL.patched++;
  }
})();
// (the lights' colours are sRGB; the bake's colours on the page are linear)
const __slLin = (v) => Math.pow(v, 2.2);
function __slFrame() {
  const p = __world.pilotId && __world.byId ? __world.byId[__world.pilotId] : null;
  const L = __shotLights(__world, { k: ${K}, focus: p && p.transform ? p.transform.pos : null }), U = __SL.U;
  L.forEach((l, k) => { U.uSlP.value[k].set(l.pos[0], l.pos[1], l.pos[2]); U.uSlC.value[k].set(__slLin(l.color[0]) * l.power, __slLin(l.color[1]) * l.power, __slLin(l.color[2]) * l.power); U.uSlR.value[k] = l.reach; });
  U.uSlN.value = L.length; __SL.last = L;
}
const __slStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __slStep0(dt, inputOverride); __slFrame(); };
window.__mojCtrl.shotLight = () => ({ lights: __SL.last, patched: __SL.patched });
`;
}
