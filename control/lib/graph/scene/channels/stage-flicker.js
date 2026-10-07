import { safeJson } from '../emit-util.js';

// In-page script: a stage's FLICKERING LAMPS (a decayed lab's dying troffers: era/lab.js, era/decay.js). The lamps'
// light is baked into the vertex colours at `base` (1 = baked on, 0 = baked off); each frame the page sets how much of
// it each lamp gives now, and every lit mesh's vertex colour is scaled by the change near it: a vertex's share of a
// lamp's light falls off as the bake's does ((1 − d / radius)², flat inside 1.1 m), so its pool on the floor and the
// walls dims and comes back with it, and its own diffuser goes dark.
//   · modes: 'stutter' — on, with bursts of rapid off-on (a tube failing); 'spark' — off, with now and then a flash
//     (one hanging by a chain, shorting); 'pulse' — a slow breath (an emergency lamp's)
//   · the clock is window.__mojClock when a capture pins it, so a baked frame is reproducible.
// Absent `flicker` ⇒ NOT emitted.
// `cfg`: { lamps: [{ at: [x, y, z], radius, share, base, mode, seed }] } — at most 8 (the nearest the stage chose).
const N = 8;
const VERT = `
uniform vec4 uFlkP[${N}]; uniform vec4 uFlkK[${N}];
vec3 mojFlicker(vec3 p) {
  float m = 1.0;
  for (int i = 0; i < ${N}; i++) {
    if (uFlkP[i].w <= 0.0) continue;
    float d = distance(p, uFlkP[i].xyz), f = 1.0 - max(d, 1.1) / uFlkP[i].w;
    float w = d < 0.9 ? 1.0 : uFlkK[i].y * f * f * step(0.0, f);   // the lamp itself (its whole tube) goes with it
    m += (uFlkK[i].x - uFlkK[i].z) * w;
  }
  return vec3(max(m, 0.0));
}
`;

export function stageFlickerScript(cfg) {
  return `
// --- stage flicker: dying lamps, their baked light dimmed and restored in the page ---
(function () {
  const FLK = ${safeJson(cfg)}, L = FLK.lamps.slice(0, ${N});
  const P = Array.from({ length: ${N} }, (_, i) => new THREE.Vector4(...(L[i] ? [...L[i].at, L[i].radius] : [0, 0, 0, 0])));
  const K = Array.from({ length: ${N} }, (_, i) => new THREE.Vector4(L[i] ? L[i].base : 0, L[i] ? L[i].share : 0, L[i] ? L[i].base : 0, 0));
  const U = { uFlkP: { value: P }, uFlkK: { value: K } };
  const VERT = ${safeJson(VERT)};
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.vertexColors || o.material.isShaderMaterial) return;
    const prev = o.material.onBeforeCompile, prevKey = o.material.customProgramCacheKey && o.material.customProgramCacheKey.call(o.material);
    o.material.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(o.material, sh, r);
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + VERT).replace('#include <color_vertex>', '#include <color_vertex>\\n\\tvColor.rgb *= mojFlicker( position );');
    };
    o.material.customProgramCacheKey = () => 'mojulo-flicker|' + (prevKey || '');
    o.material.needsUpdate = true;
  });
  // the lamps' states, from the clock alone: a hash of the moment, per lamp
  const hh = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function level(l, t) {
    if (l.mode === 'pulse') return 0.75 + 0.25 * Math.sin(t * 2.1 + l.seed);
    const burst = hh(Math.floor(t * 0.8 + l.seed * 0.37), l.seed) < (l.mode === 'spark' ? 0.18 : 0.42);
    if (!burst) return l.mode === 'spark' ? 0 : 1;
    const q = hh(Math.floor(t * 17), l.seed * 7 + 1);
    return l.mode === 'spark' ? (q < 0.35 ? 1.2 : 0) : (q < 0.55 ? 0.06 : 1);
  }
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  (function tick() { const t = clock(); L.forEach((l, i) => { K[i].x = level(l, t); }); requestAnimationFrame(tick); })();
})();
`;
}
