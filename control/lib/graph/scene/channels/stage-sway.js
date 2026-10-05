import { safeJson } from '../emit-util.js';
import { windField } from '../../vegetation/wind.js';
import { WIND_AT_GLSL } from './terrain-wind.js';

// In-page script: a stage's CLOTH in the wind (opt-in: a stage manifest's `wind`, era/stage.js). The hung cards (washing,
// awnings, banners, ivy) are pinned along one edge and swing in the terrain's gust field (vegetation/wind.js windField,
// the same GLSL): each vertex reads the wind where it hangs and swings out of the card's plane like a pendulum `reach`
// metres long, to the angle whose tangent is the push across it over the cloth's weight (φ·u|u|/80: a damp sheet of washing
// stands out at 45° in about 9 m/s); a ripple runs along the cloth as the wind passes over it.
// The bake does not move with it: the light and the sun's shadow stay where the cloth hangs at rest (the era's way).
//   · the pin: uv v is 0 at a card's foot and 1 at its head; `pin: 'top'` holds the head (washing, a banner), `'bottom'`
//     the foot (flowers in a box); `free` is the share of the card that hangs loose from the pin (an awning's valance
//     is its last quarter: the slope above it is stretched on its frame). Weight down the free length is w^1.4, so
//     the hem moves most.
//   · the clock is window.__mojClock when a capture pins it, so a baked frame is reproducible.
// Absent `sway` ⇒ NOT emitted (and the textured meshes are not tagged with their group).
// `cfg`: { wind: { speed, dir (rad), gust, scale, evolve, veer (rad), seed, z0 }, groups: { [group]: { phi, reach, flutter, pin, free? } } }
const GLSL = `
uniform float uWindT; uniform vec4 uWindA; uniform vec4 uWindB; uniform sampler2D uWindNoise; uniform vec4 uSway;
` + WIND_AT_GLSL + `vec3 mojSway(vec3 p, vec2 uv, vec3 n) {
  float w = pow(clamp((uSway.w < 0.0 ? uv.y : 1.0 - uv.y) / abs(uSway.w), 0.0, 1.0), 1.4);
  vec2 nh = n.xy; float l = length(nh); if (l < 1e-3 || w <= 0.0) return vec3(0.0); nh /= l;
  vec2 u = mojWindAt(p.xy, p.z, uWindT); float m = length(u), un = dot(u, nh);
  float th = atan(uSway.x * un * abs(un) / 80.0), fl = uSway.z * min(1.0, m / 4.0) * sin(uWindT * 11.0 + dot(p.xy, vec2(1.7, 2.3)) * 3.0 - uv.y * 4.0);
  return vec3(nh * w * (uSway.y * sin(th) + fl), sign(uSway.w) * w * uSway.y * (1.0 - cos(th)));
}
`;
const PROJECT = `
transformed += mojSway( transformed, uv, normal );
vec4 mvPosition = vec4( transformed, 1.0 );
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

export function stageSwayScript(cfg) {
  return `
// --- stage sway (opt-in): hung cloth pinned at one edge swings in the wind's gust field ---
(function () {
  const SWAY = ${safeJson(cfg)}, W = SWAY.wind;
  const WF = (${windField.toString()})(W), N = WF.N;
  const noise = new THREE.DataTexture(WF.noise, N, N, THREE.RGBAFormat); noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = noise.minFilter = THREE.LinearFilter; noise.needsUpdate = true;
  const U = { uWindT: { value: 0 }, uWindA: { value: new THREE.Vector4(W.speed, Math.cos(W.dir), Math.sin(W.dir), W.gust) }, uWindB: { value: new THREE.Vector4(W.scale, W.evolve, W.veer, W.z0) }, uWindNoise: { value: noise } };
  const GLSL = ${safeJson(GLSL)}, PROJECT = ${safeJson(PROJECT)};
  scene.traverse((o) => {
    const G = o.isMesh && SWAY.groups[o.userData.g]; if (!G || !o.geometry.attributes.uv) return;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    const own = { uSway: { value: new THREE.Vector4(G.phi, G.reach, G.flutter, (G.pin === 'bottom' ? -1 : 1) * (G.free || 1)) } };
    o.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, own);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + GLSL).replace('#include <project_vertex>', PROJECT);
    };
    o.material.customProgramCacheKey = () => 'mojulo-sway';
    o.material.needsUpdate = true; o.frustumCulled = false;
  });
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  (function tick() { U.uWindT.value = clock(); requestAnimationFrame(tick); })();
})();
`;
}
