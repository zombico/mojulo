// In-page script: THE SHOT LIGHT on a side map's page (worlds/controllable/shot-light.js): the map's light is baked into
// its faces (gameworld/side-map/light.js), and what shines in a fight is laid over that bake while it lasts: a buster's
// rounds in their level's colours, a foe's shots in theirs, a burst as it goes off, a muzzle's flash, the hero's charge
// at its chest, and what a shot breaks or destroys as it comes apart (its pieces lit by it as they fly). Appended after the controllable channel's own script (it wraps stepControllable) on a page whose camera
// is the side map's only, so every other page keeps every byte.
//
//   THE LIGHTS  read off the world each frame (shotLights, the same source the tests run), the strongest few near the
//               pilot, into shared uniforms
//   THE MATTER  every opaque thing drawn as three's MeshBasicMaterial (the map's baked groups and their textured faces,
//               the doodads among them; the bodies; and, found every few frames as they come, what breaks: a block's
//               chunks (rupa), a destroyed body's pieces (dismantle, a cleave)), never a glow (an additive one) adds, over its baked colour, each light's falloff (the
//               square of what is left of its reach): a little by how the face turns to it (half-Lambert), and most at
//               its edges, a face turned from the eye (a top seen edge-on, a slice's end) taking it as a rim; in the
//               surface's own hue (its baked colour over its brightest channel, toward white), the whole capped
//               (SHOT_LIGHT_CAP): spill, not flood; no shadows, a light reaches what is near it
//   A CEL BODY  (index.js __toonMat, its material marked cel) takes the shot as it takes any light, in a step: a hard band
//               in the shot's colour where a part turns toward it, within its reach (SHOT_LIGHT_CEL)
//
// `window.__mojCtrl.shotLight()` says the lights laid this frame and how many materials carry them (a page's check).
import { shotLights } from '../../../worlds/controllable/shot-light.js';

export const SHOT_LIGHT_K = 6;
/** The most the shot light adds to a face (linear): the world keeps its key under any number of shots. */
export const SHOT_LIGHT_CAP = 0.09;
/** The shot on a cel body (a hard RIM, not a pool): the face's N·L toward the shot past `step`, turned from the eye past
 * `edge` (1 − |N·V|: the silhouette's band), within `reach` of the
 * light's reach, its colour × `gain`, held under `cap` (linear): a rim in the round's colour on the side it comes from. */
export const SHOT_LIGHT_CEL = Object.freeze({ step: 0.35, reach: 0.7, gain: 0.9, cap: 0.5, edge: 0.45 });

export function shotLightScript() {
  const K = SHOT_LIGHT_K, CAP = SHOT_LIGHT_CAP, { step: CEL_STEP, reach: CEL_REACH, gain: CEL_GAIN, cap: CEL_CAP, edge: CEL_EDGE } = SHOT_LIGHT_CEL;
  return `
// ── THE SHOT LIGHT ──
const __shotLights = ${shotLights.toString()};
const __SL = { last: [], patched: 0, U: { uSlN: { value: 0 }, uSlP: { value: Array.from({ length: ${K} }, () => new THREE.Vector3()) }, uSlC: { value: Array.from({ length: ${K} }, () => new THREE.Vector3()) }, uSlR: { value: new Array(${K}).fill(1) }, uSlB: { value: new Array(${K}).fill(1) } } };
// (a material lit by the shot light: three's MeshBasicMaterial, opaque matter, never a glow: what adds light is left as it is)
function __slPatch(mat) {
    if (!mat || !mat.isMeshBasicMaterial || mat.__shotLight || mat.blending === THREE.AdditiveBlending) return;
    // (a cel body's part, index.js __toonMat: lit as cel, a hard band on its side toward the shot, on its own smooth normal)
    // (cel only where its own toon patch is on it: a copy of one, a wreck's piece cloned from a cel part, keeps the mark in
    // its userData but not the patch, so it has no toon normal to read and is lit as matter)
    const cel = !!(mat.userData && mat.userData.cel) && Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile');
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      Object.assign(sh.uniforms, __SL.U);
      sh.vertexShader = 'varying vec3 vSlW;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  { vec4 slw = vec4( transformed, 1.0 );\\n#ifdef USE_INSTANCING\\n  slw = instanceMatrix * slw;\\n#endif\\n  vSlW = ( modelMatrix * slw ).xyz; }');
      sh.fragmentShader = 'varying vec3 vSlW;\\nuniform int uSlN;\\nuniform vec3 uSlP[${K}];\\nuniform vec3 uSlC[${K}];\\nuniform float uSlR[${K}];\\nuniform float uSlB[${K}];\\n'
        + 'vec3 slGlow( vec3 c ) {\\n  if ( uSlN == 0 ) return vec3( 0.0 );\\n  vec3 N = normalize( cross( dFdx( vSlW ), dFdy( vSlW ) ) ), g = vec3( 0.0 );\\n'
        + '  vec3 V = normalize( cameraPosition - vSlW ); float rim = clamp( 1.0 - abs( dot( N, V ) ), 0.0, 1.0 ); rim *= rim;\\n'
        + '  for ( int k = 0; k < ${K}; k++ ) { if ( k >= uSlN ) break; vec3 d = uSlP[ k ] - vSlW; float r = length( d ), f = clamp( 1.0 - r / uSlR[ k ], 0.0, 1.0 ), nl = dot( N, d / max( r, 1e-3 ) ); g += uSlC[ k ] * ( f * f * ( 0.35 * ( 0.5 + 0.5 * nl ) + 1.2 * rim * clamp( nl + 0.4, 0.0, 1.0 ) ) ); }\\n'
        + '  return min( ( 0.3 + 0.7 * c / max( max( c.r, c.g ), max( c.b, 0.03 ) ) ) * g, vec3( ${CAP} ) );\\n}\\n'
        // (the cel rim reads the toon patch's own normal, declared in its header: set just before main, after every one)
        + sh.fragmentShader.replace('void main() {', (cel ? CEL_GLOW : '') + 'void main() {').replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', 'vec3 outgoingLight = reflectedLight.indirectDiffuse + ' + (cel ? 'slCel( diffuseColor.rgb )' : 'slGlow( diffuseColor.rgb )') + ';');
    };
    mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + (cel ? '|shot-light-cel' : '|shot-light'); };
    mat.__shotLight = true; mat.needsUpdate = true; __SL.patched++;
}
// (every such material in the scene, and again every few frames for what comes into it: a block's chunks as it breaks
// (rupa), a destroyed body's pieces (dismantle, a cleave), the bodies themselves)
// THE SHOT ON A CEL BODY (only a light that lights bodies: a boss's tell, bodies false, is the map's alone): no soft pool but a hard rim, the shot's colour where the part turns toward it past the step and
// away from the eye (its silhouette's edge), within its reach, as a cel body takes any light: in steps (vToonN, its own)
const CEL_GLOW = 'vec3 slCel( vec3 c ) {\\n  if ( uSlN == 0 ) return vec3( 0.0 );\\n  vec3 N = normalize( vToonN ) * ( gl_FrontFacing ? 1.0 : -1.0 ), g = vec3( 0.0 );\\n'
  + '  vec3 V = normalize( cameraPosition - vSlW ); float edge = smoothstep( ${CEL_EDGE} - 0.04, ${CEL_EDGE} + 0.04, 1.0 - abs( dot( N, V ) ) );\\n'
  + '  for ( int k = 0; k < ${K}; k++ ) { if ( k >= uSlN ) break; vec3 d = uSlP[ k ] - vSlW; float r = length( d ), nl = dot( N, d / max( r, 1e-3 ) ); g += uSlB[ k ] * uSlC[ k ] * ( step( r, uSlR[ k ] * ${CEL_REACH} ) * smoothstep( ${CEL_STEP} - 0.03, ${CEL_STEP} + 0.03, nl ) * edge ); }\\n'
  + '  return min( ( 0.35 + 0.65 * c / max( max( c.r, c.g ), max( c.b, 0.03 ) ) ) * g * ${CEL_GAIN}, vec3( ${CEL_CAP} ) );\\n}\\n';
const __slSweep = () => scene.traverse((o) => { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(__slPatch); });
__slSweep();
let __slTick = 0;
// (the lights' colours are sRGB; the bake's colours on the page are linear)
const __slLin = (v) => Math.pow(v, 2.2);
function __slFrame() {
  const p = __world.pilotId && __world.byId ? __world.byId[__world.pilotId] : null;
  const L = __shotLights(__world, { k: ${K}, focus: p && p.transform ? p.transform.pos : null }), U = __SL.U;
  L.forEach((l, k) => { U.uSlP.value[k].set(l.pos[0], l.pos[1], l.pos[2]); U.uSlC.value[k].set(__slLin(l.color[0]) * l.power, __slLin(l.color[1]) * l.power, __slLin(l.color[2]) * l.power); U.uSlR.value[k] = l.reach; U.uSlB.value[k] = l.bodies === false ? 0 : 1; });
  U.uSlN.value = L.length; __SL.last = L;
}
const __slStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __slStep0(dt, inputOverride); if (++__slTick % 6 === 0) __slSweep(); __slFrame(); };
window.__mojCtrl.shotLight = () => ({ lights: __SL.last, patched: __SL.patched });
`;
}
