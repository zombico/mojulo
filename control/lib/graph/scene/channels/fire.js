import { safeJson } from '../emit-util.js';
import { fireKernel, fireLightRGB, firePropParts, FIRE_KIND_LIGHT, FIRE_PROP_COLORS } from '../../fire/fire.js';

// In-page script: the FIRE channel (opt-in `fire` on any world; fire/fire.js). Only emitted with `fire`.
//   · the kernel (fireKernel, inlined) gives every fire's flamelets, embers and smoke as functions of time; the air
//     is the terrain's wind field when the world has one, else still. It is read at the page's step time, which
//     runs with the wind's own clock live (so the flames lean in the gusts the grass bends in) and is pinned by a
//     capture frame (so a fire is the same at the same t);
//   · a flamelet is drawn as light: a ray marched through a box around its spine (glowing soot yellow to orange as
//     it cools toward the tip, a blue sheet at a laminar flame's base, a surface wrinkled by eddies rising with the
//     gas), tonemapped in its own shader because the World page has no HDR pass; the box's faces are depth-tested,
//     so walls hide fires behind them; a soft halo stands in for bloom;
//   · each fire stands on its own prop (a candle, a torch on a bracket, a brazier on legs, a ring of stones and logs)
//     with glowing coals;
//   · the fire LIGHTS the world: every basic material on the page is patched (as terrain chunks stream in too) with
//     the eight fires nearest the eye: a fire the world's bake already holds (a dungeon's) flickers the light there,
//     one it does not (a campfire on a terrain) adds its light, falling off as an extended source's, 1/(d² + r²).
//   · `unit` (metres per scene unit; a world built in its own units, its air still): the fires are given and burn in
//     metres — the kernel's buoyancy, smoke and sparks are physical — and what they hand the page is scaled into the
//     world's units, their light by 1/unit² so it falls off over the same metres. Absent ⇒ none of this is emitted.
export function fireChannelScript(cfg) {
  const u = Number.isFinite(cfg.unit) && cfg.unit > 0 && cfg.unit !== 1 ? cfg.unit : 0, k = u ? 1 / u : 1;
  const props = cfg.sources.map(firePropParts).map((parts) => (u ? parts.map((p) => ({ ...p, ...(p.a ? { a: p.a.map((v) => v * k), b: p.b.map((v) => v * k), r0: p.r0 * k, r1: p.r1 * k } : {}), ...(p.at ? { at: p.at.map((v) => v * k) } : {}), ...(p.r ? { r: p.r * k } : {}) })) : parts));
  return `
// --- fire (opt-in \`fire\`) ---
const FIRE = ${safeJson(cfg)}, FIRE_KIND_LIGHT = ${safeJson(FIRE_KIND_LIGHT)}, FIRE_PROPS = ${safeJson(props)};
${u ? `// the fires burn in metres; the page is in the world's units (k = 1/unit)
function __fireUnit(K, k) {
  const sc = (a) => a && a.map((v) => v * k), si = (s) => ({ ...s, at: sc(s.at), D: s.D * k, L: s.L * k, light: s.light * k * k });
  const srcs = Array.from({ length: K.N }, (_, i) => si(K.src(i)));
  return { ...K, src: (i) => srcs[i], centre: (i, t) => sc(K.centre(i, t)),
    flames: (i, t) => K.flames(i, t).map((f) => f && { pts: f.pts.map((v) => v * k), rad: f.rad.map((v) => v * k), L: f.L * k }),
    embers: (i, t) => K.embers(i, t).map((v, j) => (j % 7 === 6 ? v : v * k)),
    smoke: (i, t) => K.smoke(i, t).map((v, j) => (j % 5 === 4 ? v : v * k)),
    burn: (i, t) => { const b = K.burn(i, t); return b && b.map((v, j) => (j === 4 || j === 5 || j === 7 ? v : v * k)); } };
}
` : ''}const __fireTW = FIRE.terrainAir ? window.__mojTerrain : null;
const __fireWind = __fireTW && __fireTW.wind ? __fireTW.wind : null;
// a grass fire spreads in the wind's mean, over the terrain's ground, and stops at its water
if (__fireWind && FIRE.spread) FIRE.wind = { speed: __fireWind.cfg.speed, dir: __fireWind.cfg.dir };
const __fireWorld = __fireTW ? { groundAt: (x, y) => __fireTW.kernel.groundAt(x, y), burnable: (x, y) => !(__fireTW.cfg.water && __fireTW.kernel.groundAt(x, y) < __fireTW.cfg.water.z) } : null;
const __fireK = ${u ? '__fireUnit(' : ''}(${fireKernel.toString()})(FIRE, __fireWind ? (x, y, z, t) => __fireWind.field.at(x, y, 1.2, t) : null, __fireWorld)${u ? `, ${k})` : ''};
// every fire the kernel draws: the standing ones (FIRE.sources, with their props) and the grass fires' fronts
const __fireN = __fireK.N, __FNP = __fireK.NP, __fireAll = Array.from({ length: __fireN }, (_, i) => __fireK.src(i));
// a fire's light: its kind's warm yellow, or as much of its colorant's lines as the flame is coloured (fire.js fireLightRGB)
const __fireCols = __fireAll.map((s) => (${fireLightRGB.toString()})(s));

// the light: every MeshBasicMaterial learns the fires (chained onto any patch it already carries)
const __fireU = { uFireP: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uFireC: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uFireR: { value: new Array(8).fill(1) }, uFireAmb: { value: 0.12 }, uFireDay: { value: FIRE.day || 0 }, uBurnA: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, uBurnB: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) } };
const __fireVS = 'varying vec3 vFireW;\\n';
const __fireFS = 'uniform vec4 uFireP[8]; uniform vec4 uFireC[8]; uniform float uFireR[8]; uniform float uFireAmb; uniform float uFireDay; uniform vec4 uBurnA[4]; uniform vec4 uBurnB[4]; varying vec3 vFireW;\\n';
const __fireLight = \`
  float fS = uFireAmb, fN = uFireAmb; vec3 fAdd = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 P = uFireP[i]; vec4 C = uFireC[i]; if (P.w == 0.0) continue;
    vec3 d = vFireW - P.xyz; float e = abs(P.w) / (dot(d, d) + uFireR[i]);
    #ifdef FIRE_PROP
    fAdd += C.rgb * e * C.w;
    #else
    if (P.w < 0.0) { fS += e; fN += e * C.w; } else fAdd += C.rgb * e * C.w;
    #endif
  }
  #ifdef FIRE_PROP
  // a prop by its fire: lit, not burnt out; by day the sun lights it and the fire barely adds
  outgoingLight = outgoingLight * (mix(0.06, 0.85, uFireDay) + mix(1.8, 0.2, uFireDay) * (1.0 - exp(-0.5 * fAdd)));
  #else
  // a grass fire's ground: black and ashen behind its front, a band of embers glowing where it has just passed
  for (int i = 0; i < 4; i++) {
    vec4 A = uBurnA[i], B = uBurnB[i]; if (A.z <= 0.0) continue;
    vec2 q = vFireW.xy - A.xy; float u = (q.x * B.x + q.y * B.y) / A.z, v = (-q.x * B.y + q.y * B.x) / A.w, e = sqrt(u * u + v * v);
    if (e < 1.0) {
      float inward = (1.0 - e) * min(A.z, A.w), glow = (1.0 - smoothstep(0.0, B.z, inward)) * B.w;
      float sp = fract(sin(dot(floor(vFireW.xy * 6.0), vec2(12.9898, 78.233))) * 43758.5453);
      outgoingLight = mix(outgoingLight, vec3(0.035, 0.03, 0.028) + 0.05 * sp, smoothstep(0.0, 0.3, inward));
      outgoingLight += vec3(1.0, 0.28, 0.04) * glow * smoothstep(0.55, 1.0, sp) * 1.4;
    }
  }
  float fLum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
  // the surface's hue at a plausible albedo, lit by the fire; a fire is a thousandth of the sun, so by day it adds little
  outgoingLight = outgoingLight * (fN / fS) + outgoingLight * min(3.0, 0.32 / max(fLum, 0.03)) * min(fAdd, 3.0) * mix(1.0, 0.04, uFireDay);
  #endif
\`;
function __firePatch(m) {
  if (!m || !m.isMeshBasicMaterial || m.userData.__fire) return;
  m.userData.__fire = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    Object.assign(sh.uniforms, __fireU);
    sh.vertexShader = __fireVS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  #ifdef USE_INSTANCING\\n  vFireW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\\n  #else\\n  vFireW = (modelMatrix * vec4(transformed, 1.0)).xyz;\\n  #endif');
    sh.fragmentShader = __fireFS + sh.fragmentShader.replace('#include <opaque_fragment>', __fireLight + '\\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|fire'; };
  m.needsUpdate = true;
}
const __firePatchAll = () => scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(__firePatch); });

// the props each fire stands on (lit by the fires as props: they carry no bake)
const __fireProps = new THREE.Group(); scene.add(__fireProps);
const __propMat = (hex) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) }); m.defines = { FIRE_PROP: '' }; __firePatch(m); return m; };
const __fireCoal = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const __fireCoals = [];
const __fireM = Object.fromEntries(Object.entries(${safeJson(FIRE_PROP_COLORS)}).map(([k, hex]) => [k, __propMat(hex)]));
function __fireCyl(r0, r1, a, b, mat, seg = 10, open = false) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d.length(), seg, 1, open), mat);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); __fireProps.add(m); return m;
}
// each fire's prop, from its parts (fire.js firePropParts: the Blender pack builds the same)
FIRE_PROPS.forEach((parts, i) => {
  for (const p of parts) {
    if (p.shape === 'cyl') __fireCyl(p.r0, p.r1, p.a, p.b, __fireM[p.mat], p.seg, !!p.open);
    else if (p.shape === 'stone') { const st = new THREE.Mesh(new THREE.IcosahedronGeometry(p.r, 0), __fireM[p.mat]); st.scale.set(...p.scale); st.rotation.z = p.rotZ; st.position.set(...p.at); __fireProps.add(st); }
    else if (p.shape === 'coal') { const c = new THREE.Mesh(new THREE.CircleGeometry(p.r, 20), __fireCoal.clone()); c.position.set(...p.at); c.material.color.setRGB(0.9, 0.25, 0.04); __fireProps.add(c); __fireCoals.push({ m: c, i }); }
  }
});

// the flames: one marched box per flamelet
// the page may draw with a logarithmic depth buffer: its own shaders write depth the same way, or walls would hide them
const __fireLDV = '#include <common>\\n#include <logdepthbuf_pars_vertex>\\n', __fireLDF = '#include <logdepthbuf_pars_fragment>\\n';
const __fireFlameVS = __fireLDV + 'varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;\\n#include <logdepthbuf_vertex>\\n}';
const __fireFlameFS = __fireLDF + \`
uniform vec3 uSpine[\${__FNP}]; uniform float uRad[\${__FNP}]; uniform vec3 uBoxMin, uBoxMax; uniform float uTime, uGain, uSoot, uEdge, uLam, uRise, uLineK, uBall; uniform vec3 uLine;
varying vec3 vWorld;
float fh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fn3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh3(i), fh3(i + vec3(1, 0, 0)), f.x), mix(fh3(i + vec3(0, 1, 0)), fh3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(fh3(i + vec3(0, 0, 1)), fh3(i + vec3(1, 0, 1)), f.x), mix(fh3(i + vec3(0, 1, 1)), fh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
vec3 sootColor(float T) { vec3 a = vec3(1.0, 0.1, 0.01), b = vec3(1.0, 0.34, 0.05), c = vec3(1.0, 0.62, 0.26); return T < 0.5 ? mix(a, b, 2.0 * T) : mix(b, c, 2.0 * T - 1.0); }
void main() {
  #include <logdepthbuf_fragment>
  vec3 ro = cameraPosition, rd = normalize(vWorld - ro);
  vec3 inv = 1.0 / rd, t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv, a3 = min(t0, t1), b3 = max(t0, t1);
  float tn = max(max(a3.x, a3.y), max(a3.z, 0.0)), tf = min(min(b3.x, b3.y), b3.z);
  if (tf <= tn) discard;
  const int STEPS = 30; float dt = (tf - tn) / float(STEPS);
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float Rm = max(uRad[2], 1e-4); vec3 acc = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (tn + (float(i) + j) * dt);
    float best = 1e9, bs = 0.0;
    for (int k = 0; k < \${__FNP - 1}; k++) {
      vec3 a = uSpine[k], ab = uSpine[k + 1] - a; float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-14), 0.0, 1.0); vec3 q = p - a - ab * h; float d2 = dot(q, q);
      if (d2 < best) { best = d2; bs = (float(k) + h) / \${(__FNP - 1).toFixed(1)}; }
    }
    float fi = bs * \${(__FNP - 1).toFixed(1)}; int i0 = int(min(floor(fi), \${(__FNP - 2).toFixed(1)}));
    float R = max(mix(uRad[i0], uRad[i0 + 1], fi - float(i0)), 1e-4), r = sqrt(best) / R;
    if (r > 1.8) continue;
    vec3 np = p / Rm * vec3(1.6, 1.6, 0.8) - vec3(0.0, 0.0, uTime * uRise / Rm * 0.8);
    float n = 0.62 * fn3(np) + 0.38 * fn3(np * 2.07 + 7.1);
    float dd = r + uEdge * (n - 0.5) * (0.4 + 1.6 * bs);
    float inside = 1.0 - smoothstep(0.55, 1.0, dd);
    // a standing flame glows from a little above its base; a fireball is brightest where it is, dimming down its tail
    float zone = mix(smoothstep(0.03, 0.25 + 0.1 * uLam, bs), 1.0, uBall) * (1.0 - smoothstep(mix(0.78, 0.55, uBall), 1.0, bs + 0.25 * uEdge * (n - 0.5)));
    float core = uLam * (1.0 - smoothstep(0.0, 0.62, dd)) * (1.0 - smoothstep(0.12, 0.5, bs));
    float soot = inside * zone * (1.0 - 0.85 * core) * uSoot;
    float T = clamp(1.05 - 0.85 * smoothstep(0.35, 1.0, bs) - 0.4 * dd * dd, 0.0, 1.0);
    vec3 sc = sootColor(T) * (0.25 + 0.75 * T * T);
    float sheet = exp(-pow((dd - 0.9) / 0.12, 2.0)) * (1.0 - smoothstep(0.04, 0.3, bs)) * (0.12 + 0.5 * uLam);
    // a colorant's lines: its atoms excited where the flame is hot, brightest in the body, fading to the tip
    float lines = inside * smoothstep(0.02, 0.2, bs) * (1.0 - smoothstep(0.75, 1.02, bs + 0.25 * uEdge * (n - 0.5))) * (0.45 + 0.55 * T) * uLineK;
    acc += (soot * sc + lines * uLine * 0.45 + sheet * (1.0 - 0.7 * uLineK) * vec3(0.08, 0.18, 1.0) * 0.4) * dt / Rm;
  }
  vec3 c = 1.0 - exp(-acc * uGain);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}\`;
// a fire of many flamelets is tonemapped in parts that overlap: its gain falls with their number (a grass fire's stand
// side by side along its front, and keep theirs). By day the eye is set for the sun, and a flame reads dimmer.
const __fireBoxGeo = new THREE.BoxGeometry(1, 1, 1), __fireFlames = [];
__fireAll.forEach((s, i) => {
  for (let k = 0; k < s.n; k++) {
    const U = { uSpine: { value: Array.from({ length: __FNP }, () => new THREE.Vector3()) }, uRad: { value: new Array(__FNP).fill(0) }, uBoxMin: { value: new THREE.Vector3() }, uBoxMax: { value: new THREE.Vector3() },
      uTime: { value: 0 }, uGain: { value: (s.lam ? 1.4 : s.path ? 0.3 : s.kind === 'grass' ? 0.55 : 0.85 / (1 + 0.3 * (s.n - 1))) * (1 - 0.45 * (FIRE.day || 0)) }, uSoot: { value: s.soot }, uEdge: { value: s.lam ? 0.08 : 0.45 }, uLam: { value: s.lam ? 1 : 0 }, uRise: { value: Math.sqrt(9.81 * s.L) }, uLineK: { value: s.lineK || 0 }, uLine: { value: new THREE.Vector3(...(s.line || [1, 1, 1])) }, uBall: { value: s.path ? 1 : 0 } };
    const m = new THREE.Mesh(__fireBoxGeo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: __fireFlameVS, fragmentShader: __fireFlameFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.frustumCulled = false; m.renderOrder = 7; scene.add(m); __fireFlames.push({ m, U, i, k });
  }
});

// halos (the page has no bloom), embers and smoke
const __fireHaloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,190,120,0.9)'); gr.addColorStop(0.25, 'rgba(255,140,60,0.35)'); gr.addColorStop(1, 'rgba(255,100,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const __fireHalos = __fireAll.map((s, i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: __fireHaloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); if (s.line) { const c = __fireCols[i], m = Math.max(...c); sp.material.color.setRGB(c[0] / m, (c[1] / m) * 1.6, (c[2] / m) * 2.5); } sp.renderOrder = 8; scene.add(sp); return sp; });
const __fireSmokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const __fireQuads = (cap, mat) => {
  const g = new THREE.BufferGeometry(), idx = new Uint32Array(cap * 6);
  for (let i = 0; i < cap; i++) idx.set([4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3], 6 * i);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 12), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 16), 4)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cap * 8), 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; scene.add(m); return { g, m, cap };
};
const __fireEmb = __fireQuads(Math.max(1, __fireAll.reduce((n, s) => n + s.embers * (s.path ? 6 : 3), 0)), new THREE.ShaderMaterial({ vertexShader: __fireLDV + 'attribute vec4 color; varying vec4 vC; varying vec2 vUv; void main() { vC = color; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\\n#include <logdepthbuf_vertex>\\n}', fragmentShader: __fireLDF + 'varying vec4 vC; varying vec2 vUv; void main() {\\n#include <logdepthbuf_fragment>\\n float e = 1.0 - abs(vUv.x); gl_FragColor = vec4(vC.rgb * e * e, 1.0); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
const __fireSmk = __fireQuads(Math.max(1, __fireAll.reduce((n, s) => n + Math.ceil(s.smoke * 4.5) + 2, 0)), new THREE.ShaderMaterial({ uniforms: { tMap: { value: __fireSmokeTex } }, vertexShader: __fireLDV + 'attribute vec4 color; varying vec4 vC; varying vec2 vUv; void main() { vC = color; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\\n#include <logdepthbuf_vertex>\\n}', fragmentShader: __fireLDF + 'uniform sampler2D tMap; varying vec4 vC; varying vec2 vUv; void main() {\\n#include <logdepthbuf_fragment>\\n gl_FragColor = vec4(vC.rgb, vC.a * texture2D(tMap, vUv).a); }', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
__fireEmb.m.renderOrder = 9; __fireSmk.m.renderOrder = 6;

const __fv = new THREE.Vector3(), __fr = new THREE.Vector3(), __fu = new THREE.Vector3(), __fside = new THREE.Vector3(), __fsph = new THREE.Sphere(), __ffr = new THREE.Frustum(), __fpm = new THREE.Matrix4();
let __firePatchT = -1;
window.__mojFire = { cfg: FIRE, kernel: __fireK, camera, flames: __fireFlames, props: __fireProps, uniforms: __fireU, patchAll: __firePatchAll };
const stepFire = (ms) => {
  // the page's step time: a capture frame pins it, so a fire is the same at the same t; live it runs with the wind's
  // own clock, so the flames lean in the gusts the grass bends in
  const T = ms / 1000;
  if (!(ms - __firePatchT < 500 && __firePatchT >= 0)) { __firePatchT = ms; __firePatchAll(); }   // terrain chunks stream in
  camera.updateMatrixWorld();   // a capture frame steps before it renders: the eye may have just moved
  __fpm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); __ffr.setFromProjectionMatrix(__fpm);
  const cam = camera.position;
  // the eight fires nearest the eye light the world
  // where each fire is now (a fireball moves, and is nowhere between casts), how hard it burns
  const where = __fireAll.map((s, i) => __fireK.centre(i, T)), kk = __fireAll.map((s, i) => (where[i] ? __fireK.intensity(i, T) : 0));
  const order = __fireAll.map((s, i) => [i, where[i] ? Math.hypot(where[i][0] - cam.x, where[i][1] - cam.y, where[i][2] - cam.z) - Math.sqrt(s.light) * 3 : 1e9]).sort((a, b) => a[1] - b[1]);
  const flick = new Float64Array(__fireN), live = new Uint8Array(__fireN);
  for (let r = 0; r < order.length; r++) {
    const i = order[r][0], s = __fireAll[i], c = where[i]; if (!c) continue;
    const d = Math.hypot(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z);
    const bn = s.kind === 'grass' ? __fireK.burn(i, T) : null;   // a grass fire is seen if any of its front is
    if (bn) __fsph.set(__fv.set(bn[0], bn[1], c[2] + 0.5 * s.L), Math.max(bn[2], bn[3]) + s.L + 2);
    else __fsph.set(__fv.set(c[0], c[1], c[2] + 0.5 * s.L), (s.L + s.D) * Math.max(1, Math.sqrt(kk[i])) + (s.path ? s.L : 0));
    live[i] = d < 90 * Math.sqrt(s.L) && __ffr.intersectsSphere(__fsph) ? 1 : 0;
    if (r < 8 || live[i]) flick[i] = __fireK.light(i, T) * FIRE.light;
  }
  for (let r = 0; r < 8; r++) {
    const P = __fireU.uFireP.value[r], C = __fireU.uFireC.value[r];
    if (r >= order.length || !where[order[r][0]]) { P.w = 0; continue; }
    const i = order[r][0], s = __fireAll[i], col = __fireCols[i], c = where[i];
    P.set(c[0], c[1], c[2] + (s.path ? 0 : 0.4 * s.L), (s.baked ? -1 : 1) * s.light * FIRE.light); C.set(col[0], col[1], col[2], flick[i] / FIRE.light || 0);
    __fireU.uFireR.value[r] = (0.7 * s.L + 0.3 * s.D) ** 2 + 0.01;
  }
  // the grass fires' burnt ground
  for (let j = 0; j < 4; j++) {
    const A = __fireU.uBurnA.value[j], B = __fireU.uBurnB.value[j], b = __fireK.NS + j < __fireN ? __fireK.burn(__fireK.NS + j, T) : null;
    if (b) { A.set(b[0], b[1], b[2], b[3]); B.set(b[4], b[5], b[6], b[7]); } else A.z = 0;
  }
  __fr.setFromMatrixColumn(camera.matrixWorld, 0);
  for (const F of __fireFlames) {
    const s = __fireAll[F.i];
    if (!live[F.i]) { F.m.visible = false; continue; }
    F.m.visible = true;
  }
  const lists = new Map();
  for (const F of __fireFlames) {
    if (!F.m.visible) continue;
    if (!lists.has(F.i)) lists.set(F.i, __fireK.flames(F.i, T));
    const f = lists.get(F.i)[F.k]; if (!f) { F.m.visible = false; continue; }
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let k = 0; k < __FNP; k++) {
      const r = 1.8 * f.rad[k] + 0.002; F.U.uSpine.value[k].set(f.pts[3 * k], f.pts[3 * k + 1], f.pts[3 * k + 2]); F.U.uRad.value[k] = f.rad[k];
      for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], f.pts[3 * k + c] - r); mx[c] = Math.max(mx[c], f.pts[3 * k + c] + r); }
    }
    F.U.uBoxMin.value.set(mn[0], mn[1], mn[2]); F.U.uBoxMax.value.set(mx[0], mx[1], mx[2]); F.U.uTime.value = T;
    F.m.position.set((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2); F.m.scale.set(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]); F.m.updateMatrixWorld();
    // from inside a flame's box its front faces are behind the eye: draw its back faces, over everything
    const inside = cam.x > mn[0] && cam.x < mx[0] && cam.y > mn[1] && cam.y < mx[1] && cam.z > mn[2] && cam.z < mx[2];
    F.m.material.side = inside ? THREE.BackSide : THREE.FrontSide; F.m.material.depthTest = !inside;
  }
  __fireAll.forEach((s, i) => {
    const h = __fireHalos[i]; h.visible = !!live[i]; if (!live[i]) return;
    const k = flick[i] / Math.max(FIRE.light, 1e-6), c = where[i]; h.position.set(c[0], c[1], c[2] + (s.path ? 0 : 0.45 * s.L)); h.scale.setScalar((2.2 * s.L + 1.2 * s.D) * (0.9 + 0.1 * k)); h.material.opacity = Math.min(1, 0.55 * k) * (1 - 0.7 * (FIRE.day || 0));
  });
  // coals glow with the fire, and keep a dull glow when it has died back
  for (const c of __fireCoals) { const k = live[c.i] ? 0.3 + 0.7 * Math.min(2, flick[c.i] / Math.max(FIRE.light, 1e-6)) : 0.3 + 0.7 * Math.min(1, kk[c.i]); const dd = 1 - 0.6 * (FIRE.day || 0); c.m.material.color.setRGB(0.62 * k * dd, 0.13 * k * dd, 0.02 * dd); }
  // embers: streaks a few millimetres wide, at least a pixel
  { const P = __fireEmb.g.attributes.position.array, C = __fireEmb.g.attributes.color.array, U = __fireEmb.g.attributes.uv.array; let n = 0;
    const px = 2 * Math.tan((camera.fov * Math.PI) / 360) / renderer.domElement.height;
    for (let i = 0; i < __fireN && n < __fireEmb.cap; i++) {
      if (!live[i] && !__fireAll[i].path) continue;   // a fireball's sparks and smoke outlive its flight
      const e = __fireK.embers(i, T);
      for (let o = 0; o + 6 < e.length && n < __fireEmb.cap; o += 7) {
        __fv.set(e[o], e[o + 1], e[o + 2]); __fu.set(e[o + 3], e[o + 4], e[o + 5]);
        __fside.subVectors(__fv, __fu).cross(__fu.clone().sub(cam)); if (__fside.lengthSq() < 1e-14) __fside.copy(__fr);
        const w = Math.max(0.003, 0.8 * px * __fv.distanceTo(cam)); __fside.setLength(w);
        P.set([__fu.x - __fside.x, __fu.y - __fside.y, __fu.z - __fside.z, __fu.x + __fside.x, __fu.y + __fside.y, __fu.z + __fside.z, __fv.x - __fside.x, __fv.y - __fside.y, __fv.z - __fside.z, __fv.x + __fside.x, __fv.y + __fside.y, __fv.z + __fside.z], 12 * n);
        // a charcoal ember glows orange to yellow; one carrying a colorant (a firework's star) burns in its colour
        const k = e[o + 6], L = __fireAll[i].line, q = L ? 0.6 * __fireAll[i].lineK : 0, c = [(1 - q + q * (L ? L[0] : 0)) * k, ((0.3 + 0.5 * k) * (1 - q) + q * (L ? L[1] : 0)) * k, (0.06 * k * (1 - q) + q * (L ? L[2] : 0)) * k, 1];
        for (let j = 0; j < 4; j++) C.set(c, 16 * n + 4 * j);
        U.set([-1, 0, 1, 0, -1, 1, 1, 1], 8 * n); n++;
      }
    }
    __fireEmb.g.setDrawRange(0, n * 6); __fireEmb.g.attributes.position.needsUpdate = __fireEmb.g.attributes.color.needsUpdate = __fireEmb.g.attributes.uv.needsUpdate = true; }
  // smoke: soft puffs facing the eye, grey, warmed by the fire beneath
  { const P = __fireSmk.g.attributes.position.array, C = __fireSmk.g.attributes.color.array, U = __fireSmk.g.attributes.uv.array; let n = 0;
    __fu.setFromMatrixColumn(camera.matrixWorld, 1);
    for (let i = 0; i < __fireN && n < __fireSmk.cap; i++) {
      if (!live[i] && !__fireAll[i].path) continue;
      const s = __fireAll[i], sm = __fireK.smoke(i, T), col = __fireCols[i], k = flick[i] / Math.max(FIRE.light, 1e-6), g0 = 0.1 + 0.42 * (FIRE.day || 0);   // smoke is grey by day, dark by night
      const sc = s.smokeColor ? s.smokeColor.map((v) => v * (0.3 + 0.7 * (FIRE.day || 0)) + 0.04) : null;   // a signal smoke is its dye's colour, lit as the day is
      for (let o = 0; o + 4 < sm.length && n < __fireSmk.cap; o += 5) {
        const r = sm[o + 3], cx = sm[o], cy = sm[o + 1], cz = sm[o + 2], c0 = where[i] || s.at, warm = Math.min(1, (s.light * k) / ((cz - c0[2]) ** 2 + 0.5) * 0.08);
        for (let j = 0; j < 4; j++) { const sx = j % 2 ? 1 : -1, sy = j < 2 ? -1 : 1; P.set([cx + r * (sx * __fr.x + sy * __fu.x), cy + r * (sx * __fr.y + sy * __fu.y), cz + r * (sx * __fr.z + sy * __fu.z)], 12 * n + 3 * j); C.set(sc ? [sc[0] + col[0] * warm, sc[1] + col[1] * warm, sc[2] + col[2] * warm, Math.min(1, sm[o + 4] * 1.1)] : [g0 + col[0] * warm, g0 + col[1] * warm, g0 * 1.04 + col[2] * warm, sm[o + 4] * 0.55], 16 * n + 4 * j); }
        U.set([0, 0, 1, 0, 0, 1, 1, 1], 8 * n); n++;
      }
    }
    __fireSmk.g.setDrawRange(0, n * 6); __fireSmk.g.attributes.position.needsUpdate = __fireSmk.g.attributes.color.needsUpdate = __fireSmk.g.attributes.uv.needsUpdate = true; }
};
`;
}
