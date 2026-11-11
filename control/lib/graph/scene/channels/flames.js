import { safeJson } from '../emit-util.js';

// In-page script: LIVE FLAMES, the cheap kind (a room's torches in the form render, era/stage.js). The sixth generation
// draws a torch's flame as two crossed polygons; the fire channel (channels/fire.js) draws real fire, a ray marched
// through every flamelet with embers and smoke and every material on the page patched for its light, which a room of
// torches does not need. This is between them: every flame on the page is one instanced quad turned to the eye about
// the upright, its shape and colour a formula of the clock in its fragment (a teardrop that sways more toward its tip,
// eddies rising through it, white at its root to orange at its tip), added over the frame. One draw call for all of
// them, no state, no render target; the light they give is the bake's, as it was. Under a world's bloom (`hot`) a
// flame is drawn past white and the bloom draws its glow.
// Absent ⇒ NOT emitted. `window.__mojFlames` is the probe: { n, at: null | seconds (a pinned time) }.

/** A flame's measures: how fast its eddies climb (flame heights a second), how far its tip sways (of its width), and how
 *  far past its paint it is drawn under the bloom (linear light). */
export const FLAME = Object.freeze({ climb: 2.2, sway: 0.5, hot: 5 });

const FLAME_FRAG = `#include <logdepthbuf_pars_fragment>
uniform float uT, uHot;
varying vec2 vQ; varying float vSeed; varying vec3 vTint;
float fh( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float fn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( fh( i ), fh( i + vec2( 1.0, 0.0 ) ), f.x ), mix( fh( i + vec2( 0.0, 1.0 ) ), fh( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
void main() {
#include <logdepthbuf_fragment>
  float v = vQ.y, t = uT + vSeed * 7.0;
  float n1 = fn( vec2( vQ.x * 2.2 + vSeed * 13.0, v * 2.4 - t * ${FLAME.climb.toFixed(2)} ) ), n2 = fn( vec2( vQ.x * 5.0 + vSeed * 29.0, v * 5.5 - t * ${(FLAME.climb * 1.7).toFixed(2)} ) );
  float x = vQ.x - ( n1 - 0.5 ) * ${FLAME.sway.toFixed(2)} * v * 2.0;
  float w = 1.3 * pow( max( v, 0.0 ), 0.35 ) * pow( max( 1.0 - v, 0.0 ), 0.9 ) * ( 0.9 + 0.1 * sin( t * 9.0 ) );
  float d = abs( x ) / max( w, 1e-3 ) + ( n2 - 0.5 ) * 0.55;
  float body = 1.0 - smoothstep( 0.45, 1.0, d ), core = 1.0 - smoothstep( 0.0, 0.7, d + v * 0.95 );
  vec3 col = mix( vec3( 1.0, 0.32, 0.04 ), vec3( 1.0, 0.72, 0.22 ), smoothstep( 0.0, 0.6, body * ( 1.0 - v * 0.7 ) ) );
  col = mix( col, vec3( 1.0, 0.96, 0.84 ), core ) * mix( vec3( 1.0 ), vTint, 0.35 );
  float a = body * ( 1.0 - 0.55 * v * v );
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( col * a * uHot, a );
}
`;
const FLAME_VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aAt; attribute vec3 aDim; attribute vec3 aTint;
varying vec2 vQ; varying float vSeed; varying vec3 vTint;
void main() {
  vQ = vec2( position.x * 2.0, position.y ); vSeed = aDim.z; vTint = aTint;
  vec3 to = cameraPosition - aAt, right = normalize( vec3( - to.y, to.x, 0.0 ) + vec3( 1e-6, 0.0, 0.0 ) );
  vec3 p = aAt + right * position.x * aDim.x + vec3( 0.0, 0.0, 1.0 ) * position.y * aDim.y;
  gl_Position = projectionMatrix * viewMatrix * vec4( p, 1.0 );
#include <logdepthbuf_vertex>
}
`;

/** `flames`: [{ at: [x, y, z] (its root), w, h (metres), color?: [r, g, b] 0..1, seed? }]; `hot` under a world's bloom. */
export function flamesScript(flames, { hot = false } = {}) {
  const F = (Array.isArray(flames) ? flames : []).filter((f) => f && Array.isArray(f.at) && f.w > 0 && f.h > 0);
  if (!F.length) return '';
  return `
// --- live flames: every flame one instanced quad, its shape a formula of the clock (channels/flames.js) ---
(function () {
  const FL = ${safeJson(F.map((f, i) => ({ at: f.at, w: f.w, h: f.h, c: Array.isArray(f.color) ? f.color : [1, 0.8, 0.5], s: Number.isFinite(f.seed) ? f.seed : (i * 0.618034) % 1 })))};
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const at = new Float32Array(FL.length * 3), dim = new Float32Array(FL.length * 3), tint = new Float32Array(FL.length * 3);
  FL.forEach((f, i) => { at.set(f.at, 3 * i); dim.set([f.w, f.h, f.s], 3 * i); tint.set(f.c, 3 * i); });
  g.setAttribute('aAt', new THREE.InstancedBufferAttribute(at, 3)); g.setAttribute('aDim', new THREE.InstancedBufferAttribute(dim, 3)); g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  g.instanceCount = FL.length;
  const U = { uT: { value: 0 }, uHot: { value: ${hot ? FLAME.hot : 1} } };
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: ${JSON.stringify(FLAME_VERT)}, fragmentShader: ${JSON.stringify(FLAME_FRAG)},
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  m.frustumCulled = false; m.renderOrder = 7; m.raycast = function () {}; scene.add(m);
  const probe = window.__mojFlames = { n: FL.length, at: null };
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) { if (prev) prev.call(this, r, s, cam, rt); U.uT.value = probe.at != null ? probe.at : (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000; };
})();`;
}
