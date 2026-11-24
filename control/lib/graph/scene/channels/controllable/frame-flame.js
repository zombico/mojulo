// In-page script: AN ASSAULT FRAME'S THRUST — the booster's bells and its verniers burning as layered fire, a figure's
// `thrusters` of kind `flame` (assault-frame/figure.js). Opt-in: a page whose figures carry none emits not one byte of it.
//
//   THE LAYERS   three nested open cones out of each mouth, each its own fire shader (scrolling noise along the plume,
//                soft at its rim, gone toward its tip), each burning in its own stretch of the plume (its band), drawn
//                additive so they burn through one another where they meet:
//                  core    white-hot to pale cyan, short and tight, the shock diamonds (bright bands down its length)
//                          standing in it when it is driven hard
//                  sheath  the exhaust's own colour (the palette's: an electric blue), longer, its noise quicker
//                  tail    amber to a deep red at its end, the longest and the widest, licking and slow
//                and a flare on the mouth, the glow round the bell, swelling with the burn
//   THE BURN     the entity's `thrust` (0 off, 1 full: the frame rule sets it, a quick boost the most): the plume's length,
//                its width and its brightness follow it; a main bell burns longer than a vernier
//
// The page's thruster pass (controllable/index.js __updateThrusters) drives each jet by `thrust`; this is its `flame`
// kind's mesh and its update.

export const FLAME_LAYERS = Object.freeze({
  core: Object.freeze({ len: 0.55, rad: 0.5, band: Object.freeze([-1, 0.75]), hot: '#ffffff', cool: '#9fe8ff', speed: 9, grain: 3.2, alpha: 1.1, diamonds: 1 }),
  sheath: Object.freeze({ len: 0.9, rad: 1.0, band: Object.freeze([0.05, 0.8]), hot: null, cool: null, speed: 6.5, grain: 2.4, alpha: 0.75, diamonds: 0 }),
  tail: Object.freeze({ len: 1.35, rad: 1.5, band: Object.freeze([0.3, 1.2]), hot: '#ffa040', cool: '#b01e14', speed: 3.6, grain: 1.8, alpha: 0.6, diamonds: 0 }),
});

// (a page with a logarithmic depth buffer, a flight's long view, writes its depth so: the flame keeps its depth with it, or
// every fragment of it would be tested away behind the world)
const FLAME_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uLen;
varying float vAlong; varying float vAround; varying vec3 vN; varying vec3 vView;
void main() {
  vAlong = clamp(position.y / uLen, 0.0, 1.0); vAround = atan(position.z, position.x);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const FLAME_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uBand0; uniform float uBand1;
uniform vec3 uHot; uniform vec3 uCool; uniform float uTime; uniform float uAmt; uniform float uSpeed; uniform float uGrain; uniform float uAlpha; uniform float uDiamonds; uniform float uSeed;
varying float vAlong; varying float vAround; varying vec3 vN; varying vec3 vView;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fb(vec2 p) { return 0.55 * vn(p) + 0.3 * vn(p * 2.1 + 7.3) + 0.15 * vn(p * 4.3 + 19.1); }
void main() {
  #include <logdepthbuf_fragment>
  float t = vAlong;
  // (the fire's grain, carried down the plume as it burns; wrapped round the cone)
  vec2 q = vec2(cos(vAround) * 1.3 + uSeed, sin(vAround) * 1.3 + t * uGrain * 2.0 - uTime * uSpeed);
  float n = fb(q * uGrain);
  // (soft at its rim, seen edge-on; gone toward its tip, the tip eaten ragged by the noise)
  // (seen down its axis a cone's sides face away from the eye: never let that put it out, a plume seen from behind burns)
  float rim = mix(0.55, 1.0, pow(abs(dot(normalize(vN), normalize(vView))), 0.8));
  float body = 1.0 - smoothstep(0.25 + 0.55 * n, 1.0, t);
  // (each layer burns in its own stretch of the plume, uBand0..uBand1 of its length: the core at the mouth, the tail
  // past it, so the colours lie one after another down the plume and do not all add to white)
  float band = smoothstep(uBand0 - 0.12, uBand0 + 0.12, t) * (1.0 - smoothstep(uBand1 - 0.2, uBand1 + 0.1, t));
  float a = body * band * rim * (0.3 + 1.0 * n) * uAlpha * uAmt;
  // (the shock diamonds: bright bands standing down a hard-driven core)
  if (uDiamonds > 0.5) a *= 0.75 + 0.6 * smoothstep(0.55, 1.0, sin(t * 34.0 - 1.2)) * smoothstep(0.35, 0.9, uAmt);
  if (a < 0.004) discard;
  vec3 c = mix(uHot, uCool, smoothstep(0.0, 0.85, t + 0.25 * (n - 0.5)));
  gl_FragColor = vec4(c * (0.8 + 0.5 * n), a);
}`;

/** The page's block: the flame kind's mesh (`__flameJet`) and its update (`__flameStep`), inlined when a figure has one. */
export function frameFlameScript() {
  return `
// AN ASSAULT FRAME'S THRUST (scene/channels/controllable/frame-flame.js): each mouth three nested cones of fire, a white-hot
// core with its shock diamonds, a sheath of the exhaust's colour, an amber tail going red, and a flare on the mouth
const __FLAME = ${JSON.stringify(FLAME_LAYERS)};
let __flameTex = null;
function __flameJet(th, holder, len, rad) {
  if (!__flameTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); __flameTex = new THREE.CanvasTexture(cv);
  }
  const own = new THREE.Color(th.color || '#4aa8ff'), seed = (th.local[0] * 7.1 + th.local[1] * 3.3 + th.local[2] * 1.7) % 10;
  const layers = [];
  for (const k of ['tail', 'sheath', 'core']) {
    const L = __FLAME[k], l = len * L.len, r = rad * L.rad, geo = new THREE.ConeGeometry(r, l, 18, 6, true);
    geo.translate(0, l / 2, 0);
    const hot = L.hot ? new THREE.Color(L.hot) : own.clone().lerp(new THREE.Color(0xffffff), 0.35), cool = L.cool ? new THREE.Color(L.cool) : own.clone().multiplyScalar(0.7);
    const U = { uBand0: { value: L.band[0] }, uBand1: { value: L.band[1] }, uLen: { value: l }, uHot: { value: hot }, uCool: { value: cool }, uTime: { value: 0 }, uAmt: { value: 0 }, uSpeed: { value: L.speed }, uGrain: { value: L.grain }, uAlpha: { value: L.alpha }, uDiamonds: { value: L.diamonds }, uSeed: { value: seed } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: ${JSON.stringify(FLAME_VERT)}, fragmentShader: ${JSON.stringify(FLAME_FRAG)}, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.raycast = function () {}; m.frustumCulled = false; m.renderOrder = 6; holder.add(m);
    layers.push({ k, m, U });
  }
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: __flameTex, color: own.clone().lerp(new THREE.Color(0xffffff), 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flare.raycast = function () {}; flare.frustumCulled = false; holder.parent.add(flare);
  return { holder, layers, flare, kind: 'flame', rad, main: th.role !== 'vernier' };
}
function __flameStep(j, amt, i) {
  const t = __world.time, fl = 0.9 + 0.1 * Math.sin(t * 41 + i * 1.9) + 0.05 * Math.sin(t * 97 + i * 0.7);
  // (the plume's length with the burn: a vernier's shorter; its width a little with it)
  const L = (0.2 + 0.8 * amt) * fl * (j.main ? 1 : 0.7), W = 0.75 + 0.35 * amt;
  j.holder.scale.set(W, L, W);
  for (const y of j.layers) { y.U.uTime.value = t; y.U.uAmt.value = Math.min(1.2, (y.k === 'tail' ? 0.6 + 0.6 * amt : 0.35 + 0.8 * amt) * (0.9 + 0.1 * fl)); }
  const fs = j.rad * (1.3 + 1.6 * amt) * fl;
  j.flare.visible = true; j.flare.scale.set(fs, fs, 1); j.flare.material.opacity = 0.2 + 0.4 * amt;
}
`;
}
