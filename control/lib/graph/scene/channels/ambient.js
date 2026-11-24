import { safeJson } from '../emit-util.js';

// In-page script: the BACKDROP'S AMBIENT MOTION (docs/side-scroll-backgrounds.md "Motion"): what moves behind the play
// moves slowly, a little, and never in step. A render group named in `ambient.groups` is patched in its own vertex
// shader: each vertex is carried by a sine of the clock (`amp` metres along x, y and z over `period` seconds), its phase
// spread along the place by where the vertex stands (`spread` radians a metre), so a row of clouds drifts as a row and a
// row of crowns bobs one after another rather than together. A group may also breathe in brightness (`depth` of its
// colour over `beat` seconds): a smooth twinkle (stars, a lamp's breath), or, with a `duty`, a blink (a beacon on a mast,
// lit for that share of its beat). The baked light does not move with it. The clock is window.__mojClock when a capture
// pins it, so a baked frame is reproducible.
// Absent `ambient` (or no groups) ⇒ NOT emitted.
// `cfg`: { groups: { [group]: { amp?: [x, y, z], period?, spread?, depth?, beat?, duty? } } }

/** The channel's measures: the slowest and fastest a backdrop may move (seconds a cycle) and the most it may travel. */
export const AMBIENT = Object.freeze({ minPeriod: 1.2, maxAmp: 40 });

const GLSL = `
uniform float uAmbT; uniform vec4 uAmbA; uniform vec4 uAmbB;
varying float vAmbP;
`;
const FRAG_PARS = `
uniform float uAmbT; uniform vec4 uAmbB;
varying float vAmbP;
`;
// the vertex: its phase from where it stands, its offset a sine of the clock
const BEGIN = `#include <begin_vertex>
vAmbP = dot( position, vec3( 0.37, 1.0, 0.61 ) ) * uAmbB.x;
if ( uAmbA.w > 0.0 ) transformed += vec3( uAmbA.xyz ) * sin( 6.2831853 * uAmbT / uAmbA.w + vAmbP );
`;
// the colour: a twinkle (duty 0) or a blink (lit for `duty` of its beat), `depth` of it at most
const COLOR = `#include <color_fragment>
if ( uAmbB.y > 0.0 && uAmbB.z > 0.0 ) {
  float ph = fract( uAmbT / uAmbB.z + vAmbP * 0.159155 );
  float on = uAmbB.w > 0.0 ? step( ph, uAmbB.w ) : 0.5 + 0.5 * sin( 6.2831853 * ph );
  diffuseColor.rgb *= 1.0 - uAmbB.y * ( 1.0 - on );
}
`;

/** The groups read: each one's motion clamped to the channel's measures; a group that asks for nothing is dropped. */
export function readAmbient(cfg) {
  const out = {};
  for (const [g, G] of Object.entries((cfg && cfg.groups) || {})) {
    if (!G || typeof G !== 'object') continue;
    const amp = Array.isArray(G.amp) && G.amp.length === 3 ? G.amp.map((v) => Math.max(-AMBIENT.maxAmp, Math.min(AMBIENT.maxAmp, Number(v) || 0))) : [0, 0, 0];
    const period = Number.isFinite(G.period) ? Math.max(AMBIENT.minPeriod, G.period) : 0;
    const depth = Number.isFinite(G.depth) ? Math.max(0, Math.min(1, G.depth)) : 0, beat = Number.isFinite(G.beat) ? Math.max(0.2, G.beat) : 0;
    const duty = Number.isFinite(G.duty) ? Math.max(0, Math.min(1, G.duty)) : 0, spread = Number.isFinite(G.spread) ? G.spread : 0;
    const moves = period > 0 && amp.some((v) => v !== 0), breathes = depth > 0 && beat > 0;
    if (moves || breathes) out[g] = { a: [...amp, moves ? period : 0], b: [spread, breathes ? depth : 0, breathes ? beat : 0, duty] };
  }
  return out;
}

export function ambientScript(cfg) {
  const groups = readAmbient(cfg);
  if (!Object.keys(groups).length) return '';
  return `
// --- the backdrop's ambient motion (channels/ambient.js): slow, small, never in step ---
(function () {
  const AMB = ${safeJson(groups)};
  const T = { value: 0 };
  const GLSL = ${safeJson(GLSL)}, FRAG = ${safeJson(FRAG_PARS)}, BEGIN = ${safeJson(BEGIN)}, COLOR = ${safeJson(COLOR)};
  scene.traverse((o) => {
    const G = o.isMesh && AMB[o.userData.g]; if (!G || !o.material) return;
    const mat = o.material, prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    const own = { uAmbT: T, uAmbA: { value: new THREE.Vector4(G.a[0], G.a[1], G.a[2], G.a[3]) }, uAmbB: { value: new THREE.Vector4(G.b[0], G.b[1], G.b[2], G.b[3]) } };
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      Object.assign(sh.uniforms, own);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + GLSL).replace('#include <begin_vertex>', BEGIN);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\n' + FRAG).replace('#include <color_fragment>', COLOR);
    };
    mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|mojulo-ambient'; };
    mat.needsUpdate = true; o.frustumCulled = false;
  });
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  (function tick() { T.value = clock(); requestAnimationFrame(tick); })();
  window.__mojAmbient = { groups: Object.keys(AMB), t: () => T.value };
})();
`;
}
