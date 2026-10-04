import { safeJson } from '../emit-util.js';

// In-page script: the terrain world's WIND (opt-in: the terrain channel's `wind`, vegetation/wind.js). It runs before the
// plants' and the grass' scripts and registers window.__mojTerrain.wind; they ask it for a material per template, a
// clone of their own whose vertex shader bends each instance in the wind. Nothing else on the page moves: everything
// that is not a plant takes no wind (flaccidity 0), and a kind whose flaccidity is 0 keeps its own material.
//   · the field: two octaves of a seeded 64×64 value noise (one channel the gust, one the veer), drifting against each
//     other so a gust reshapes as it travels, read in coordinates carried downwind at the mean speed.
//   · per vertex, at the instance's root: the drag |u|^(1+V)·u sampled at `lags` past times and weighted by the plant's
//     damped response at its own first frequency (unit DC gain), × φ × sail; then the elastica's change of shape for
//     that load (the bend table, a 3D texture over load, arc and B) at the vertex's height up the plant, plus a quiver
//     out of phase with its neighbours. The plant is one cantilever its own height: a tuft, a tree.
//   · the clock is window.__mojClock when a capture pins it, so a baked frame is reproducible.
// Absent `wind` ⇒ NOT emitted, and the plants' and grass' scripts are emitted without their wind hooks.
// `cfg`: { speed, dir, gust, scale, evolve, veer, seed, z0, lags, grass: [taker], plants: [taker], bend: { NR, NS, NB,
//          R_MAX, B_MAX, data } }; taker: { B, sail, vogel, zeta, flutter, phi }
const GLSL = `
uniform float uWindT; uniform vec4 uWindA; uniform vec4 uWindB; uniform vec4 uBendK; uniform vec4 uTaker; uniform vec4 uTaker2;
uniform sampler2D uWindNoise; uniform highp sampler3D uWindBend;
vec2 mojWindAt(vec2 p, float z, float t) {
  vec2 d = uWindA.yz; float sp = uWindA.x, e = t / uWindB.y;
  vec2 q = vec2((dot(p, d) - sp * t) / (2.0 * uWindB.x), (d.x * p.y - d.y * p.x) / uWindB.x);
  vec2 n = 0.7 * (texture(uWindNoise, (q + vec2(0.37, -0.23) * e) / 64.0).rg * 2.0 - 1.0)
         + 0.3 * (texture(uWindNoise, (q * 2.03 + vec2(-0.51, 0.61) * e + 0.5) / 64.0).rg * 2.0 - 1.0);
  float prof = log((max(z, 0.0) + uWindB.w) / uWindB.w) / log((2.0 + uWindB.w) / uWindB.w);
  float s = sp * prof * max(0.0, 1.0 + 2.0 * uWindA.w * n.x), th = uWindB.z * uWindA.w * n.y, c = cos(th), si = sin(th);
  return s * vec2(d.x * c - d.y * si, d.x * si + d.y * c);
}
vec3 mojWind(vec3 root, float sc, vec3 local) {
  float H = max(uTaker2.y * sc, 0.05), s = clamp(local.z / uTaker2.y, 0.0, 1.0);
  float B = uTaker.x, zeta = uTaker.w, w0 = 6.2831853 * 0.5596 * sqrt(9.81 / (max(B, 1e-3) * H));
  float wd = w0 * sqrt(1.0 - zeta * zeta), W = min(4.0 / (zeta * w0), 4.0);
  vec2 R = vec2(0.0); float sum = 0.0;
  for (int j = 0; j < WIND_M; j++) {
    float tau = (float(j) + 0.5) * W / float(WIND_M), h = exp(-zeta * w0 * tau) * sin(wd * tau);
    vec2 u = mojWindAt(root.xy, 0.5 * H, uWindT - tau); float m = length(u);
    R += h * pow(max(m, 1e-4), 1.0 + uTaker.z) * u; sum += h;
  }
  R *= uTaker2.x * uTaker.y / sum;
  float r = length(R); if (r < 1e-5) return vec3(0.0);
  vec2 d = R / r;
  vec3 tc = vec3((clamp(log(1.0 + r) / uBendK.x, 0.0, 1.0) * float(WIND_NR - 1) + 0.5) / float(WIND_NR),
                 (s * float(WIND_NS - 1) + 0.5) / float(WIND_NS),
                 (clamp(log(1.0 + B) / uBendK.y, 0.0, 1.0) * float(WIND_NB - 1) + 0.5) / float(WIND_NB));
  vec2 dv = texture(uWindBend, tc).rg * H;
  float ph = dot(local, vec3(13.1, 7.7, 5.3)) * 3.0;
  float fl = uTaker2.z * min(1.0, r) * s * s * sin(uWindT * (7.0 + 4.0 * fract(ph * 0.159)) + ph);
  return vec3(d * (dv.x + fl) + vec2(-d.y, d.x) * 0.6 * fl, dv.y);
}
`;
const PROJECT = `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
	mvPosition.xyz += mojWind( instanceMatrix[ 3 ].xyz, length( instanceMatrix[ 2 ].xyz ), transformed );
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`;

export function terrainWindScript(cfg) {
  return `
// --- terrain wind (opt-in): one gust field; grass and plants bend in it as far as their flaccidity lets them ---
const WIND = ${safeJson(cfg)};
(function () {
  const TW = window.__mojTerrain; if (!TW) return;
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  // the gust field's noise, seeded (mulberry32): R the gust, G the veer
  let a = WIND.seed | 0; const rnd = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = 64, nz = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++) { nz[4 * i] = Math.floor(rnd() * 256); nz[4 * i + 1] = Math.floor(rnd() * 256); nz[4 * i + 3] = 255; }
  const noise = new THREE.DataTexture(nz, N, N, THREE.RGBAFormat); noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = noise.minFilter = THREE.LinearFilter; noise.needsUpdate = true;
  const BT = WIND.bend, f32 = dec(BT.data), half = new Uint16Array(f32.length); for (let i = 0; i < f32.length; i++) half[i] = THREE.DataUtils.toHalfFloat(f32[i]);
  const bend = new THREE.Data3DTexture(half, BT.NR, BT.NS, BT.NB); bend.format = THREE.RGFormat; bend.type = THREE.HalfFloatType; bend.magFilter = bend.minFilter = THREE.LinearFilter; bend.wrapS = bend.wrapT = bend.wrapR = THREE.ClampToEdgeWrapping; bend.unpackAlignment = 1; bend.needsUpdate = true;
  const U = { uWindT: { value: 0 }, uWindA: { value: new THREE.Vector4(WIND.speed, Math.cos(WIND.dir), Math.sin(WIND.dir), WIND.gust) }, uWindB: { value: new THREE.Vector4(WIND.scale, WIND.evolve, WIND.veer, WIND.z0) },
    uBendK: { value: new THREE.Vector4(Math.log1p(BT.R_MAX), Math.log1p(BT.B_MAX), 0, 0) }, uWindNoise: { value: noise }, uWindBend: { value: bend } };
  const GLSL = ${safeJson(GLSL)}, PROJECT = ${safeJson(PROJECT)}, DEFS = '#define WIND_M ' + WIND.lags + '\\n#define WIND_NR ' + BT.NR + '\\n#define WIND_NS ' + BT.NS + '\\n#define WIND_NB ' + BT.NB + '\\n';
  const made = new Map();
  // a material that bends in the wind: \`base\` cloned for a plant of \`taker\` whose template is \`H\` tall (its own units)
  function material(base, taker, H) {
    if (!taker || !(taker.phi > 0) || !(WIND.speed > 0)) return base;
    const key = base.uuid + '|' + JSON.stringify(taker) + '|' + H; let m = made.get(key); if (m) return m;
    m = base.clone();
    const own = { uTaker: { value: new THREE.Vector4(taker.B, taker.sail, taker.vogel, taker.zeta) }, uTaker2: { value: new THREE.Vector4(taker.phi, H, taker.flutter, 0) } };
    m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U, own); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + DEFS + GLSL).replace('#include <project_vertex>', PROJECT); };
    m.customProgramCacheKey = () => 'mojulo-wind';
    made.set(key, m); return m;
  }
  (function tick() { U.uWindT.value = (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000; requestAnimationFrame(tick); })();
  TW.wind = { cfg: WIND, uniforms: U, material, materials: made };
})();
`;
}
