// SPIKE sakura hero: the page. windField, debrisKernel and groundAt are inlined above this by hero-grove.mjs.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const D = JSON.parse(document.getElementById('grove-data').textContent);
const bytes = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const f32 = (s) => new Float32Array(bytes(s).buffer);
// the generator's compact encodings: 16-bit positions over their range, 8-bit normals, 8-bit sRGB colour, 8-bit flags
function dec(x) {
  if (typeof x === 'string') return f32(x);
  const u = bytes(x.b);
  if (x.e === 'q16') { const q = new Uint16Array(u.buffer), o = new Float32Array(q.length); for (let i = 0; i < q.length; i++) { const k = i % x.d; o[i] = x.min[k] + ((x.max[k] - x.min[k]) * q[i]) / 65535; } return o; }
  if (x.e === 'i8') { const q = new Int8Array(u.buffer), o = new Float32Array(q.length); for (let i = 0; i < q.length; i++) o[i] = q[i] / 127; return o; }
  if (x.e === 'u8g') { const o = new Float32Array(u.length); for (let i = 0; i < u.length; i++) o[i] = Math.pow(u[i] / 255, 2.2); return o; }
  const o = new Float32Array(u.length); for (let i = 0; i < u.length; i++) o[i] = u[i] / 255; return o;
}
const SUN = new THREE.Vector3(...D.sun).normalize(), SUN_COL = new THREE.Color(1.0, 0.84, 0.68), SKY_COL = new THREE.Color(0.46, 0.6, 0.88), HAZE = new THREE.Color(0.66, 0.74, 0.86);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(HAZE, 0.0065);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.02, 900); camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;

// ── light: a low warm sun with soft shadows that follow the eye, and the sky ─────────────────────────────────────────
const sun = new THREE.DirectionalLight(SUN_COL, 3.6); sun.castShadow = true;
sun.shadow.mapSize.set(3072, 3072); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(SKY_COL, new THREE.Color(0.3, 0.34, 0.2), 0.95));
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: SUN }, uHor: { value: new THREE.Color(0.66, 0.74, 0.86) }, uZen: { value: new THREE.Color(0.2, 0.4, 0.8) }, uDisc: { value: 1 }, uGlowCol: { value: new THREE.Color(1.0, 0.82, 0.62) } },
  vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
  fragmentShader: `uniform vec3 uSun; uniform vec3 uHor; uniform vec3 uZen; uniform float uDisc; uniform vec3 uGlowCol; varying vec3 vD;
    void main() { vec3 d = normalize(vD); float h = max(d.z, 0.0), s = max(dot(d, uSun), 0.0);
      vec3 c = mix(uHor, uZen, pow(h, 0.5));
      c += uDisc * (uGlowCol * (0.35 * pow(s, 8.0) + 0.9 * pow(s, 64.0)) + vec3(1.0, 0.95, 0.85) * 22.0 * smoothstep(0.9993, 0.9997, s));
      gl_FragColor = vec4(c, 1.0); }` }));
sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);

// ── wind: one field; each tree sways at its own first frequency (a damped oscillator toward the elastica's small-load
// tip deflection δ/H = B·R/8 under R = φ·sail·|u|^(1+V)·u), flowers flutter with the local gust, the lawn combs ────────
const WF = windField(D.wind), TK = D.taker;
const noiseTex = new THREE.DataTexture(WF.noise, WF.N, WF.N, THREE.RGBAFormat); noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.magFilter = noiseTex.minFilter = THREE.LinearFilter; noiseTex.needsUpdate = true;
const trees = D.trees.map((t, i) => { const v = D.variants[t[5]], H = v.H * t[4]; return { i, x: t[0], y: t[1], z: t[2], yaw: t[3], s: t[4], v: t[5], level: t[6], H, w0: 2 * Math.PI * 0.5596 * Math.sqrt(9.81 / (TK.B * H)), dx: 0, dy: 0, vx: 0, vy: 0, um: 0 }; });
const NT = trees.length, SWAY = new Float32Array(4 * 256);
const U = { uStage: { value: new THREE.Vector3(1, 0, 0) }, uEye: { value: new THREE.Vector3() }, uNear: { value: 4.5 }, uT: { value: 0 }, uSway: { value: SWAY }, uSunView: { value: new THREE.Vector3() }, uSunCol: { value: SUN_COL },
  uWindA: { value: new THREE.Vector4(D.wind.speed, Math.cos(D.wind.dir), Math.sin(D.wind.dir), D.wind.gust) }, uWindB: { value: new THREE.Vector4(D.wind.scale, D.wind.evolve, D.wind.veer, D.wind.z0) }, uNoise: { value: noiseTex } };
function swayStep(dt, t) {
  for (const tr of trees) {
    const u = WF.at(tr.x, tr.y, 0.6 * tr.H, t), m = Math.hypot(u[0], u[1]), k = TK.phi * TK.sail * Math.pow(Math.max(m, 1e-4), TK.vogel) * m;
    const tx = tr.H * TK.B * k * u[0] / 8, ty = tr.H * TK.B * k * u[1] / 8, w = tr.w0, z = TK.zeta;
    tr.vx += dt * (w * w * (tx - tr.dx) - 2 * z * w * tr.vx); tr.vy += dt * (w * w * (ty - tr.dy) - 2 * z * w * tr.vy);
    tr.dx += dt * tr.vx; tr.dy += dt * tr.vy; tr.um += (m - tr.um) * Math.min(1, dt * 4);
    SWAY[4 * tr.i] = tr.dx; SWAY[4 * tr.i + 1] = tr.dy; SWAY[4 * tr.i + 2] = tr.um; SWAY[4 * tr.i + 3] = tr.H;
  }
}

// a material patched for the grove: the sway after instancing (world space), and a petal's light through it
const WIND_GLSL = `uniform float uT; uniform vec4 uSway[256]; uniform vec4 uWindA; uniform vec4 uWindB; uniform sampler2D uNoise;
vec2 windAt(vec2 p, float z, float t) {
  vec2 d = uWindA.yz; float sp = uWindA.x, e = t / uWindB.y;
  vec2 q = vec2((dot(p, d) - sp * t) / (2.0 * uWindB.x), (d.x * p.y - d.y * p.x) / uWindB.x);
  vec2 n = 0.7 * (texture2D(uNoise, (q + vec2(0.37, -0.23) * e) / 64.0).rg * 2.0 - 1.0) + 0.3 * (texture2D(uNoise, (q * 2.03 + vec2(-0.51, 0.61) * e + 0.5) / 64.0).rg * 2.0 - 1.0);
  float prof = log((max(z, 0.0) + uWindB.w) / uWindB.w) / log((2.0 + uWindB.w) / uWindB.w);
  float s = sp * prof * max(0.0, 1.0 + 2.0 * uWindA.w * n.x), th = uWindB.z * uWindA.w * n.y, c = cos(th), si = sin(th);
  return s * vec2(d.x * c - d.y * si, d.x * si + d.y * c);
}
vec3 treeSway(float tree, float s) { vec4 S = uSway[int(tree + 0.5)]; float f = s * s * (6.0 - 4.0 * s + s * s) / 3.0; return vec3(S.xy * f, 0.0); }
uniform vec3 uStage; attribute float aR; attribute vec3 aBase; varying float vOpen;
uniform vec3 uEye; uniform float uNear; attribute float aTree; attribute float aS; attribute float aTone; attribute float aPart; attribute float aSize; attribute vec2 aCorner; varying float vPart; varying float vTone; varying vec2 vCorner;
// a flower's footprint: its disc faces the camera of the pass (the eye, or the sun for its shadow), hidden near the eye
// where the flower itself is drawn, but never in the shadow pass: every flower's shadow is its disc's (within 28 m:
// past that the shadow map's texels are larger than a flower)
vec4 discView(vec4 w, float keep, float near) { float dc = distance(w.xyz, uEye); float r = dc < near || (near == 0.0 && dc > 28.0) ? 0.0 : keep * aSize * length(instanceMatrix[0].xyz) * 1.25 * (1.0 + 0.8 * smoothstep(15.0, 45.0, dc)); vec4 mv = modelViewMatrix * w; mv.xy += aCorner * r; vCorner = aCorner; return mv; }`;
// the season (uStage: open, fallen, leafed, each 0..1, from the dial): a flower opens from a bud at its own time (aR, its
// own dice) and is gone once the fall passes its dice; leaves grow from their bases; the far crowns' clusters shrink
// as the petals go
const STAGE_FLOWER = `float gone = step(aR, uStage.y); float op = clamp((uStage.x - 0.3 * aR) / 0.7, 0.0, 1.0); vOpen = op;
  if (aPart > 0.5) { float rr = length(L0.xy); L0.xy *= mix(0.22, 1.0, op); L0.z += (1.0 - op) * rr * 0.85; }
  L0 *= mix(0.55, 1.0, op) * (1.0 - gone);`;
function projectBody(mode, depth = false) {
  return `
      vec3 L0 = transformed; vOpen = 1.0;
      ${mode === 'flower' ? STAGE_FLOWER : ''}
      ${mode === 'leaf' ? 'L0 = aBase + (L0 - aBase) * uStage.z;' : ''}
      ${mode === 'blob' ? 'L0 = aBase + (L0 - aBase) * (1.0 - uStage.y) * mix(0.55, 1.0, uStage.x);' : ''}
      vec4 mvPosition = vec4(L0, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      ${mode === 'tree' || mode === 'blob' || mode === 'leaf' ? 'mvPosition.xyz += treeSway(aTree, clamp(transformed.z / uH, 0.0, 1.0));' : ''}
      ${mode === 'flower' ? `mvPosition.xyz += treeSway(aTree, aS);${depth ? '' : ` { vec4 S = uSway[int(aTree + 0.5)];
        float ph = dot(instanceMatrix[3].xyz, vec3(17.3, 11.1, 23.7)); float a = 0.0035 * min(1.0, S.z / 5.0) * (0.4 + aS);
        mvPosition.xyz += a * vec3(sin(uT * 9.0 + ph), cos(uT * 7.3 + 1.3 * ph), 0.6 * sin(uT * 11.0 + ph)); }`}` : ''}
      ${mode === 'grass' && !depth ? `{ float s = clamp(transformed.z / uH, 0.0, 1.0); vec2 u = windAt(instanceMatrix[3].xy, 0.3, uT); float m = length(u);
        float ph = dot(instanceMatrix[3].xy, vec2(3.1, 4.7)); vec2 dd = m > 1e-3 ? u / m : vec2(0.0);
        float b = uH * length(instanceMatrix[2].xyz) * min(0.7, 0.012 * m * m) + 0.012 * min(1.0, m / 4.0) * sin(uT * 6.0 + ph);
        mvPosition.xyz += vec3(dd * b * s * s, -0.4 * b * s * s * s); }` : ''}
      ${mode === 'disc' ? `{ float op = clamp((uStage.x - 0.3 * aR) / 0.7, 0.0, 1.0); vOpen = op; mvPosition.xyz += treeSway(aTree, aS); mvPosition = discView(mvPosition, (1.0 - step(aR, uStage.y)) * mix(0.45, 1.0, op), ${depth ? '0.0' : 'uNear'}); }` : 'mvPosition = modelViewMatrix * mvPosition;'}
      gl_Position = projectionMatrix * mvPosition;`;
}
function groveMaterial(opts, { mode, H = 1, petal = false }) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide }, opts));
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uH: { value: H } });
    sh.vertexShader = 'uniform float uH;\n' + WIND_GLSL + '\n' + sh.vertexShader.replace('#include <project_vertex>', projectBody(mode)).replace('#include <color_vertex>', '#include <color_vertex>\n  vPart = aPart; vTone = aTone;');
    sh.fragmentShader = 'uniform vec3 uSunView; uniform vec3 uSunCol; varying float vPart; varying float vTone; varying vec2 vCorner; varying float vOpen;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${mode === 'flower' || mode === 'disc' ? 'diffuseColor.rgb *= mix(vec3(1.0, 0.86, 0.9), vec3(1.0), clamp(0.35 + 0.65 * vTone, 0.0, 1.0));' : ''}
        ${mode === 'flower' ? 'diffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.9, 0.42, 0.56), vec3(1.0), vOpen), vPart);' : mode === 'disc' ? 'diffuseColor.rgb *= mix(vec3(0.9, 0.42, 0.56), vec3(1.0), vOpen);' : ''}
        ${mode === 'disc' ? `{ float rr = length(vCorner), th = atan(vCorner.y, vCorner.x); if (rr > 0.72 + 0.28 * abs(cos(2.5 * th))) discard;
          diffuseColor.rgb *= mix(vec3(0.95, 0.62, 0.66), vec3(1.0), smoothstep(0.08, 0.4, rr)); }` : ''}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        ${petal ? `{ vec3 Vd = normalize(vViewPosition); float ndl = dot(normal, uSunView);
          float through = max(-ndl, 0.0), back = pow(max(dot(-Vd, uSunView), 0.0), 4.0), part = ${mode === 'blob' ? '0.55' : 'vPart'};
          reflectedLight.directDiffuse += part * diffuseColor.rgb * vec3(1.0, 0.82, 0.88) * uSunCol * (0.55 * through + 2.6 * back * (0.3 + 0.7 * through)); }` : ''}`);
  };
  m.customProgramCacheKey = () => `grove-${mode}-${petal}-${H}`;
  return m;
}
// the shadows move with the sway too (only the trees' own: flowers flutter too little to see in a shadow)
function depthFor(mode, H) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uH: { value: H } });
    sh.vertexShader = 'uniform float uH;\n' + WIND_GLSL + '\n' + sh.vertexShader.replace('#include <project_vertex>', projectBody(mode, true));
    if (mode === 'disc') sh.fragmentShader = 'varying vec2 vCorner;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (dot(vCorner, vCorner) > 0.7) discard;');
  };
  m.customProgramCacheKey = () => `grove-depth-${mode}-${H}`;
  return m;
}

const geo = (g, extra = {}) => {
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(dec(g.pos), 3)); G.setAttribute('normal', new THREE.BufferAttribute(dec(g.nrm), 3));
  if (g.col) G.setAttribute('color', new THREE.BufferAttribute(dec(g.col), 3)); if (g.uv) G.setAttribute('uv', new THREE.BufferAttribute(dec(g.uv), 2)); if (g.base) G.setAttribute('aBase', new THREE.BufferAttribute(dec(g.base), 3));
  const n = G.attributes.position.count; G.setAttribute('aPart', new THREE.BufferAttribute(g.part ? dec(g.part) : new Float32Array(n), 1));
  for (const [k, v] of Object.entries(extra)) G.setAttribute(k, v); G.computeBoundingSphere(); return G;
};
const barkTex = new THREE.TextureLoader().load(D.bark.url); barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping; barkTex.colorSpace = THREE.SRGBColorSpace; barkTex.anisotropy = 8;
function barkMaterial(H) {
  const m = groveMaterial({ map: barkTex, color: new THREE.Color(0.8, 0.66, 0.64), roughness: 0.55 }, { mode: 'tree', H });
  const inner = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => { inner(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    { float band = floor(vMapUv.y * 26.0), cell = fract(sin(band * 91.7 + floor(vMapUv.x * 7.0 + band * 0.37) * 13.1) * 43758.5);
      float len = smoothstep(0.55, 0.95, sin(fract(vMapUv.y * 26.0) * 3.14159)) * step(0.45, cell);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.45, 0.42), 0.55 * len); }`); };
  m.customProgramCacheKey = () => `grove-bark-${H}`;
  return m;
}

// ── the trees: per variant and level, one InstancedMesh each; each tree takes its level by its distance from the eye,
// as the pool picks a level by projected size. Near: every axis (L3 wood) and its flowers, drawn whole within uNear of
// the eye and as their footprints past it; middle: the pool's L2 wood and the footprints; far: the pool's L1 (the
// crown's clusters in bloom) ─────────────────────────────────────────────────────────────────────────────────────────
const stats = {}, HERO_M = 14, L2_M = 46;
for (const tr of trees) tr.M = new THREE.Matrix4().compose(new THREE.Vector3(tr.x, tr.y, tr.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tr.yaw), new THREE.Vector3(tr.s, tr.s, tr.s)).elements;
function instancedSet(G, mat, cap, H, mode = 'tree') {
  const aTree = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1); G.setAttribute('aTree', aTree);
  const im = new THREE.InstancedMesh(G, mat, cap); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.customDepthMaterial = depthFor(mode, H); im.frustumCulled = false; scene.add(im);
  return { im, aTree };
}
// each flower's own dice (when it opens, when it falls), the same whole or as a disc
const flowerDice = (q) => (((q + 1) * 2654435761) >>> 0) / 4294967296;
// a variant's flowers as footprints: four corners a flower at its centre, facing the way it faces (for its light)
function discGeometry(v) {
  const a = f32(v.hero.flowers), n = a.length / 9, H = v.H, A = (k) => new Float32Array(n * 4 * k);
  const pos = A(3), nrm = A(3), col = A(3), corner = A(2), size = A(1), tone = A(1), hs = A(1), dice = A(1), part = A(1).fill(1), idx = new Uint32Array(n * 6), C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let q = 0; q < n; q++) {
    const i = 9 * q;
    for (let k = 0; k < 4; k++) { const o = 4 * q + k; pos.set(a.subarray(i, i + 3), 3 * o); nrm.set(a.subarray(i + 3, i + 6), 3 * o); col.set([0.97, 0.7, 0.78], 3 * o); corner.set(C[k], 2 * o); size[o] = a[i + 7]; tone[o] = a[i + 8]; hs[o] = Math.min(1, a[i + 2] / H); dice[o] = flowerDice(q); }
    idx.set([4 * q, 4 * q + 1, 4 * q + 2, 4 * q, 4 * q + 2, 4 * q + 3], 6 * q);
  }
  const G = new THREE.BufferGeometry(); const at = (k, arr, w) => G.setAttribute(k, new THREE.BufferAttribute(arr, w));
  at('position', pos, 3); at('normal', nrm, 3); at('color', col, 3); at('aCorner', corner, 2); at('aSize', size, 1); at('aTone', tone, 1); at('aS', hs, 1); at('aR', dice, 1); at('aPart', part, 1); G.setIndex(new THREE.BufferAttribute(idx, 1));
  G.computeBoundingSphere(); return G;
}
const SETS = D.variants.map((v, k) => {
  const H = v.H, cap = trees.filter((t) => t.v === k).length;
  const wood = (W) => [instancedSet(geo(W.bark), barkMaterial(H), cap, H), instancedSet(geo(W.plain), groveMaterial({ vertexColors: true, roughness: 0.85 }, { mode: 'tree', H }), cap, H)];
  const discs = () => instancedSet(discGeometry(v), groveMaterial({ vertexColors: true, roughness: 0.6 }, { mode: 'disc', H, petal: true }), cap, H, 'disc');
  const leaves = (L) => instancedSet(geo(L), groveMaterial({ vertexColors: true, roughness: 0.75 }, { mode: 'leaf', H }), cap, H, 'leaf');
  return { hero: [...wood(v.hero.wood), discs(), leaves(v.hero.leaves)], L2: [...wood(v.L2.wood), discs(), leaves(v.L2.leaves)], L1: [...wood(v.L1.wood), instancedSet(geo(v.L1.blobs), groveMaterial({ vertexColors: true, roughness: 0.7 }, { mode: 'blob', H, petal: true }), cap, H, 'blob'), leaves(v.L1.leaves)] };
});
function assignLevels() {
  const e = camera.position;
  for (const S of SETS) for (const lv of Object.values(S)) for (const x of lv) x.im.count = 0;
  for (const tr of trees) {
    const d = Math.hypot(tr.x - e.x, tr.y - e.y, tr.z + 0.5 * tr.H - e.z);
    tr.d = d; tr.level = d < HERO_M ? 'hero' : d < L2_M ? 'L2' : 'L1';
    for (const x of SETS[tr.v][tr.level]) { const j = x.im.count++; x.im.instanceMatrix.array.set(tr.M, 16 * j); x.aTree.array[j] = tr.i; }
  }
  for (const S of SETS) for (const lv of Object.values(S)) for (const x of lv) { x.im.instanceMatrix.needsUpdate = true; x.aTree.needsUpdate = true; }
}

// ── the flowers near the eye, whole, in world space (made the first time a tree comes near), at their own levels by
// distance: the whole fractal edge where a flower is over ~60 px (TIER_M[0]), one level of it over ~20 px, then plain
// outlines out to uNear ─────────────────────────────────────────────────────────────────────────────────────────────
const FLW = 19, tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), ZA = new THREE.Vector3(0, 0, 1);
function flowersOf(tr) {
  if (tr.fl) return tr.fl;
  const a = f32(D.variants[tr.v].hero.flowers), n = a.length / 9, out = new Float32Array(n * FLW), c = Math.cos(tr.yaw), s = Math.sin(tr.yaw);
  for (let q = 0; q < n; q++) {
    const i = 9 * q, lx = a[i] * tr.s, ly = a[i + 1] * tr.s, lz = a[i + 2] * tr.s, sz = a[i + 7] * tr.s;
    tmpV.set(c * a[i + 3] - s * a[i + 4], s * a[i + 3] + c * a[i + 4], a[i + 5]).normalize();
    tmpQ.setFromUnitVectors(ZA, tmpV).multiply(tmpQ2.setFromAxisAngle(ZA, a[i + 6]));
    tmpM.compose(tmpV.set(tr.x + c * lx - s * ly, tr.y + s * lx + c * ly, tr.z + lz), tmpQ, new THREE.Vector3(sz, sz, sz));
    out.set(tmpM.elements, q * FLW); out[q * FLW + 16] = Math.min(1, lz / tr.H); out[q * FLW + 17] = a[i + 8]; out[q * FLW + 18] = flowerDice(q);
  }
  return (tr.fl = out);
}
const flowerMat = groveMaterial({ vertexColors: true, roughness: 0.6 }, { mode: 'flower', petal: true });
const TIER_M = [0.55, 1.6, U.uNear.value], CAP = 120000;
const tiers = D.flowerLevels.map((g, k) => {
  const G = geo(g), aTree = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1), aS = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1), aTone = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1), aR = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  G.setAttribute('aTree', aTree); G.setAttribute('aS', aS); G.setAttribute('aTone', aTone); G.setAttribute('aR', aR);
  const im = new THREE.InstancedMesh(G, flowerMat, CAP); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; scene.add(im);
  return { im, aTree, aS, aTone, aR, tris: g.tris, max: TIER_M[k] };
});
const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere();
let flowersNear = 0;
function bucketFlowers() {
  camera.updateMatrixWorld(); assignLevels(); U.uEye.value.copy(camera.position);
  pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
  for (const t of tiers) t.im.count = 0;
  const e = camera.position, near2 = U.uNear.value ** 2; flowersNear = 0;
  for (const tr of trees) {
    if (tr.d - 0.8 * tr.H > U.uNear.value) continue;
    const fl = flowersOf(tr);
    for (let o = 0; o < fl.length; o += FLW) {
      const dx = fl[o + 12] - e.x, dy = fl[o + 13] - e.y, dz = fl[o + 14] - e.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= near2 || fl[o + 18] < U.uStage.value.y) continue;
      sph.center.set(fl[o + 12], fl[o + 13], fl[o + 14]); sph.radius = 0.1; if (d2 > 1 && !frustum.intersectsSphere(sph)) continue;
      let k = 0; while (d2 > tiers[k].max * tiers[k].max) k++;
      const t = tiers[k]; if (t.im.count >= CAP) continue;
      const j = t.im.count++; flowersNear++; t.im.instanceMatrix.array.set(fl.subarray(o, o + 16), 16 * j); t.aTree.array[j] = tr.i; t.aS.array[j] = fl[o + 16]; t.aTone.array[j] = fl[o + 17]; t.aR.array[j] = fl[o + 18];
    }
  }
  for (const t of tiers) { t.im.instanceMatrix.needsUpdate = true; t.aTree.needsUpdate = t.aS.needsUpdate = t.aTone.needsUpdate = t.aR.needsUpdate = true; }
}

// ── the petal carpet: where petals lie, on a 0.5 m grid over the grove. What fell before the eye arrived is laid from the
// trees (under each crown, carried downwind by about how far a petal drifts falling from it, deeper in the ground's
// hollows and along the path's edges, where the grass stops them); what falls now is added where each petal lands ─────
const CG = 256, CS = 0.5, CO = -64, carpetPre = new Float32Array(CG * CG), carpetLive = new Float32Array(CG * CG), carpetBytes = new Uint8Array(CG * CG);
const carpetTex = new THREE.DataTexture(carpetBytes, CG, CG, THREE.RedFormat, THREE.UnsignedByteType); carpetTex.magFilter = carpetTex.minFilter = THREE.LinearFilter; carpetTex.needsUpdate = true;
{
  const wd = [Math.cos(D.wind.dir), Math.sin(D.wind.dir)];
  for (const t of trees) {
    const drift = 0.35 * t.H * D.wind.speed / 6, cx = t.x + wd[0] * drift, cy = t.y + wd[1] * drift, sg = 0.5 * t.H;
    const i0 = Math.max(0, Math.floor((cx - 3 * sg - CO) / CS)), i1 = Math.min(CG - 1, Math.ceil((cx + 3 * sg - CO) / CS)), j0 = Math.max(0, Math.floor((cy - 3 * sg - CO) / CS)), j1 = Math.min(CG - 1, Math.ceil((cy + 3 * sg - CO) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = CO + (i + 0.5) * CS, y = CO + (j + 0.5) * CS; carpetPre[j * CG + i] += 0.75 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sg * sg)); }
  }
  for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) {
    const x = CO + (i + 0.5) * CS, y = CO + (j + 0.5) * CS, k = j * CG + i, h = 1.2;
    const lap = (groundAt(x + h, y) + groundAt(x - h, y) + groundAt(x, y + h) + groundAt(x, y - h) - 4 * groundAt(x, y)) / (h * h);
    const edge = Math.exp(-(((Math.abs(y + 0.25 * Math.sin(x * 0.08)) - 1.45) / 0.25) ** 2));
    carpetPre[k] *= Math.max(0.3, 1 + 40 * lap) * (1 + 1.2 * edge);
  }
}
let carpetAmt = 0;
function carpetUpload(dt) {
  const decay = Math.exp(-dt / 900);
  for (let k = 0; k < carpetBytes.length; k++) { carpetLive[k] *= decay; carpetBytes[k] = Math.min(255, Math.round(255 * Math.min(1, carpetPre[k] * carpetAmt + carpetLive[k]))); }
  carpetTex.needsUpdate = true;
}
function deposit(x, y) { const i = Math.floor((x - CO) / CS), j = Math.floor((y - CO) / CS); if (i >= 0 && j >= 0 && i < CG && j < CG) carpetLive[j * CG + i] += 0.025; }
const UG = { uCarpet: { value: carpetTex }, uPetalCol: { value: new THREE.Color(0.96, 0.76, 0.82) } };

// ── the ground: undulating lawn, a path of packed earth down the avenue, the carpet of petals ─────────────────────────
{
  const G = new THREE.PlaneGeometry(220, 220, 330, 330), P = G.attributes.position, col = new Float32Array(P.count * 3);
  const lin = (r, g, b) => [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
  const lawnA = lin(0.36, 0.5, 0.2), lawnB = lin(0.48, 0.58, 0.26), path = lin(0.66, 0.58, 0.46);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i); P.setZ(i, groundAt(x, y));
    const n = 0.5 + 0.5 * Math.sin(x * 0.37 + Math.cos(y * 0.29) * 2.1) * Math.cos(y * 0.23 - x * 0.11);
    let c = lawnA.map((v, k) => v + (lawnB[k] - v) * n);
    const pth = 1 - Math.min(1, Math.max(0, (Math.abs(y + 0.25 * Math.sin(x * 0.08)) - 1.25) / 0.5));
    c = c.map((v, k) => v + (path[k] - v) * pth * (0.85 + 0.15 * n));
    col.set(c, 3 * i);
  }
  G.computeVertexNormals(); G.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const gm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  // the carpet: each 3.5 cm cell holds a petal or not, with the odds the grid gives; past a few pixels a cell is its odds
  gm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, UG);
    sh.vertexShader = 'varying vec2 vXY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vXY = position.xy;');
    sh.fragmentShader = 'uniform sampler2D uCarpet; uniform vec3 uPetalCol; varying vec2 vXY;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { float c = texture2D(uCarpet, (vXY + 64.0) / 128.0).r; vec2 cell = floor(vXY * 28.0);
        float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453), h2 = fract(h * 91.7), px = length(fwidth(vXY)) * 28.0;
        vec2 f = fract(vXY * 28.0) - 0.5 - 0.12 * vec2(h2 - 0.5, h - 0.5); float a = 6.2832 * h2; f = mat2(cos(a), -sin(a), sin(a), cos(a)) * f;
        float petal = step((f.x * f.x) / 0.18 + (f.y * f.y) / 0.08, 1.0);
        float cover = mix(step(1.0 - min(1.0, 1.6 * c), h) * petal, 0.6 * c, clamp(px - 0.5, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPetalCol * (0.9 + 0.2 * h), 0.9 * cover); }`);
  };
  const m = new THREE.Mesh(G, gm); m.receiveShadow = true; scene.add(m);
}
// the lawn: production lawn tufts (L1 along the avenue, L0 beyond), none on the path
{
  const r = (() => { let a = 99; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), mat = groveMaterial({ vertexColors: true, roughness: 0.9 }, { mode: 'grass', H: 1 });
  const lists = { near: [], far: [] };
  for (let k = 0; k < 42000; k++) {
    const x = (r() - 0.5) * 90, y = (r() - 0.5) * 64; if (Math.abs(y + 0.25 * Math.sin(x * 0.08)) < 1.5) continue;
    const h = D.lawn.H * (0.8 + 0.8 * r()); M.compose(new THREE.Vector3(x, y, groundAt(x, y) - 0.005), Q.setFromAxisAngle(Z, 6.283 * r()), new THREE.Vector3(h * 1.4, h * 1.4, h));
    (Math.abs(y) < 9 && Math.abs(x) < 22 ? lists.near : lists.far).push(M.clone());
  }
  for (const [lv, list] of Object.entries(lists)) {
    const G = geo(D.lawn[lv]), im = new THREE.InstancedMesh(G, mat, list.length); list.forEach((m, k) => im.setMatrixAt(k, m));
    G.setAttribute('aTree', new THREE.InstancedBufferAttribute(new Float32Array(list.length), 1));
    im.receiveShadow = true; im.frustumCulled = false; scene.add(im); stats[`lawn-${lv}`] = list.length;
  }
}

// ── petals in the wind: the debris kernel, its sources the hero trees' own flowers near the eye ────────────────────
const DB = debrisKernel(D.debris, WF.at, groundAt), NP = DB.n;
const petalIM = (() => { const G = geo(D.petalGeo); G.setAttribute('aTree', new THREE.InstancedBufferAttribute(new Float32Array(NP), 1)); G.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(NP), 1));
  const aTone = new THREE.InstancedBufferAttribute(new Float32Array(NP).fill(1), 1); G.setAttribute('aTone', aTone);
  const im = new THREE.InstancedMesh(G, groveMaterial({ vertexColors: true, roughness: 0.6 }, { mode: 'petal', petal: true }), NP); im.count = 0; im.frustumCulled = false; im.castShadow = true; scene.add(im); return im; })();
function sourcesNear(x, y) { const out = []; for (const tr of trees) { if ((tr.x - x) ** 2 + (tr.y - y) ** 2 > 22 * 22) continue; const fl = flowersOf(tr); for (let o = 0; o < fl.length; o += 4 * FLW) out.push([fl[o + 12], fl[o + 13], fl[o + 14], 0.08, 0.05]); } return out; }
const PM = new THREE.Matrix4(), PQ = new THREE.Quaternion(), PE = new THREE.Euler(), PP = new THREE.Vector3(), PS = new THREE.Vector3();
const wasDown = new Uint8Array(NP);
function drawPetals() {
  let j = 0;
  for (let i = 0; i < NP; i++) {
    if (DB.held[i]) { wasDown[i] = 0; continue; }
    const sp = DB.spin[i], onGround = DB.z[i] <= DB.gz[i] + 1e-6;
    if (onGround && !wasDown[i]) deposit(DB.x[i], DB.y[i]); wasDown[i] = onGround ? 1 : 0;
    PE.set(onGround ? 0.08 * Math.sin(i) : sp * 1.3 + i, onGround ? 0.08 * Math.cos(i) : sp * 0.9, sp * 0.7 + i * 2.4); PQ.setFromEuler(PE);
    const sz = D.petal * (0.85 + 0.3 * ((i * 0.618) % 1)); PM.compose(PP.set(DB.x[i], DB.y[i], DB.z[i] + (onGround ? 0.004 : 0)), PQ, PS.set(sz, sz, sz));
    petalIM.setMatrixAt(j++, PM);
  }
  petalIM.count = j; petalIM.instanceMatrix.needsUpdate = true; return j;
}

// ── the lighting pass: HDR, bloom, a sun halo, ACES, a touch of grade and vignette ──────────────────────────────────
const POST = (() => {
  const mk = (w, h, ms) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: ms || 0, depthBuffer: !!ms });
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
  const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const sm = (fs, u, extra) => new THREE.ShaderMaterial(Object.assign({ uniforms: u, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false }, extra || {}));
  const bright = sm('uniform sampler2D tSrc; uniform float uThr; varying vec2 vUv; void main() { vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.8, l), 1.0); }', { tSrc: { value: null }, uThr: { value: 1.0 } });
  const down = sm('uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv; void main() { vec2 t = uTexel; vec3 c = 0.5 * texture2D(tSrc, vUv).rgb + 0.125 * (texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture2D(tSrc, vUv + t).rgb); gl_FragColor = vec4(c, 1.0); }', { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = sm(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv; void main() { vec2 t = uTexel; vec3 c = 4.0 * texture2D(tSrc, vUv).rgb;
    c += 2.0 * (texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, t.y)).rgb);
    c += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb; gl_FragColor = vec4(c / 16.0, 1.0); }`,
  { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
  const comp = sm(`uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uExposure; uniform float uBloom; uniform vec2 uSunUV; uniform float uSunVis; uniform float uAspect; uniform float uHalo; varying vec2 vUv;
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec3 c = texture2D(tScene, vUv).rgb + uBloom * texture2D(tBloom, vUv).rgb;
      vec2 d = (vUv - uSunUV) * vec2(uAspect, 1.0); float r = length(d);
      c += uHalo * uSunVis * (0.5 * exp(-r * r * 70.0) + 0.16 * exp(-r * 4.5)) * vec3(1.0, 0.84, 0.68);
      c = aces(c * uExposure);
      c = pow(c, vec3(0.97, 1.0, 1.04));
      c *= mix(0.78, 1.0, smoothstep(1.25, 0.35, length((vUv - 0.5) * vec2(uAspect, 1.0))));
      c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      gl_FragColor = vec4(c, 1.0); }`, { tScene: { value: null }, tBloom: { value: null }, uExposure: { value: 0.85 }, uBloom: { value: 0.55 }, uSunUV: { value: new THREE.Vector2() }, uSunVis: { value: 0 }, uHalo: { value: 1 }, uAspect: { value: 1 } });
  let W = 0, H = 0, rt = null, mips = []; const size = new THREE.Vector2(), sp = new THREE.Vector3();
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qs, qc); };
  return {
    comp,
    render() {
      renderer.getDrawingBufferSize(size); if (!size.x || !size.y) return;
      if (size.x !== W || size.y !== H) { W = size.x; H = size.y; if (rt) { rt.dispose(); mips.forEach((m) => m.dispose()); } rt = mk(W, H, 4); mips = []; let mw = W >> 1, mh = H >> 1; for (let i = 0; i < 6 && mw > 8 && mh > 8; i++) { mips.push(mk(mw, mh)); mw >>= 1; mh >>= 1; } }
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      bright.uniforms.tSrc.value = rt.texture; pass(bright, mips[0]);
      for (let i = 1; i < mips.length; i++) { down.uniforms.tSrc.value = mips[i - 1].texture; down.uniforms.uTexel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height); pass(down, mips[i]); }
      for (let i = mips.length - 1; i > 0; i--) { up.uniforms.tSrc.value = mips[i].texture; up.uniforms.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height); pass(up, mips[i - 1]); }
      sp.copy(camera.position).addScaledVector(SUN, 100).project(camera);
      comp.uniforms.uSunUV.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5); comp.uniforms.uSunVis.value = sp.z < 1 && Math.abs(sp.x) < 1.4 && Math.abs(sp.y) < 1.4 ? 1 : 0;
      comp.uniforms.uAspect.value = W / H; comp.uniforms.tScene.value = rt.texture; comp.uniforms.tBloom.value = mips[0].texture; pass(comp, null);
    },
  };
})();

// ── lighting moods ─────────────────────────────────────────────────────────────────────────────────────────────────
const hemi = scene.children.find((o) => o.isHemisphereLight);
const MOODS = {
  afternoon: { sun: D.sun, col: [1.0, 0.84, 0.68], I: 3.6, sky: [0.46, 0.6, 0.88], gnd: [0.3, 0.34, 0.2], hemi: 0.95, haze: [0.66, 0.74, 0.86], fog: 0.0065, hor: [0.66, 0.74, 0.86], zen: [0.2, 0.4, 0.8], disc: 1, exposure: 0.85, bloom: 0.55, halo: 1, shadow: 1 },
  'golden hour': { sun: [-0.76, 0.62, 0.17], col: [1.0, 0.6, 0.32], I: 4.4, sky: [0.5, 0.5, 0.68], gnd: [0.32, 0.28, 0.16], hemi: 0.55, haze: [0.86, 0.68, 0.54], fog: 0.0085, hor: [0.98, 0.66, 0.42], zen: [0.26, 0.34, 0.62], disc: 1.3, exposure: 0.95, bloom: 0.85, halo: 1.6, shadow: 1 },
  overcast: { sun: [-0.3, 0.2, 0.93], col: [0.95, 0.96, 1.0], I: 0.8, sky: [0.82, 0.84, 0.88], gnd: [0.36, 0.38, 0.3], hemi: 2.6, haze: [0.8, 0.82, 0.84], fog: 0.013, hor: [0.84, 0.86, 0.88], zen: [0.66, 0.69, 0.74], disc: 0, exposure: 1.0, bloom: 0.25, halo: 0, shadow: 0.3 },
};
function setMood(name) {
  const M = MOODS[name]; SUN.set(...M.sun).normalize(); SUN_COL.setRGB(...M.col); sun.color.copy(SUN_COL); sun.intensity = M.I; sun.shadow.intensity = M.shadow;
  hemi.color.setRGB(...M.sky); hemi.groundColor.setRGB(...M.gnd); hemi.intensity = M.hemi; scene.fog.color.setRGB(...M.haze); scene.fog.density = M.fog;
  Object.assign(sky.material.uniforms, { uHor: { value: new THREE.Color(...M.hor) }, uZen: { value: new THREE.Color(...M.zen) }, uDisc: { value: M.disc }, uGlowCol: { value: new THREE.Color(...M.col) } });
  POST.comp.uniforms.uExposure.value = M.exposure; POST.comp.uniforms.uBloom.value = M.bloom; POST.comp.uniforms.uHalo.value = M.halo; UG.uPetalCol.value.setRGB(0.96, 0.76, 0.82);
}

// ── the season: one dial from bud to leaf ──────────────────────────────────────────────────────────────────────────
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let season = D.season;
const stageName = (s) => (s < 0.18 ? 'buds' : s < 0.32 ? 'opening' : s < 0.55 ? 'full bloom' : s < 0.82 ? 'petal fall' : 'leaf-out');
function setSeason(v) {
  season = v; const open = sstep(0.02, 0.3, v), fall = sstep(0.55, 0.85, v), leaf = sstep(0.62, 1.0, v);
  U.uStage.value.set(open, fall, leaf);
  carpetAmt = (0.25 * sstep(0.3, 0.55, v) + 0.75 * fall) * (1 - 0.6 * sstep(0.88, 1, v));
  UG.uPetalCol.value.setRGB(0.96, 0.76, 0.82).lerp(new THREE.Color(0.55, 0.45, 0.38), 0.7 * sstep(0.85, 1, v));
}

// ── bookmarks ──────────────────────────────────────────────────────────────────────────────────────────────────────
const heroes = [...trees].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
const h0 = heroes[0], sunH = () => new THREE.Vector2(SUN.x, SUN.y).normalize();
const closeF = (() => { const fl = flowersOf(h0); let best = null, bd = -1; for (let o = 0; o < fl.length; o += FLW) { const hs = fl[o + 16]; if (hs < 0.35 || hs > 0.6) continue; const r = Math.hypot(fl[o + 12] - h0.x, fl[o + 13] - h0.y); if (r > bd) { bd = r; best = o; } }
  return best === null ? null : { p: [fl[best + 12], fl[best + 13], fl[best + 14]], d: [fl[best + 8], fl[best + 9], fl[best + 10]].map((v) => v / Math.hypot(fl[best + 8], fl[best + 9], fl[best + 10])) }; })();
const BOOK = {
  'the avenue': [[-15, -0.2, 1.65], [12, 0.4, 2.6]],
  'under the canopy': [[h0.x + 0.9, h0.y - Math.sign(h0.y) * 0.6, h0.z + 1.4], [h0.x - 0.4, h0.y + Math.sign(h0.y) * 0.5, h0.z + 0.62 * h0.H]],
  'blossom close': closeF ? [[closeF.p[0] + 0.45 * closeF.d[0] + 0.08, closeF.p[1] + 0.45 * closeF.d[1] + 0.05, closeF.p[2] + 0.45 * Math.max(0.2, closeF.d[2]) + 0.06], [...closeF.p]] : [[0, 0, 2], [0, 4, 2]],
  'into the sun': () => { const q = sunH(); return [[h0.x - q.x * 3.6, h0.y - q.y * 3.6, h0.z + 1.2], [h0.x + q.x, h0.y + q.y, h0.z + 0.7 * h0.H]]; },
  'from the lawn': [[2, -15, 2.4], [0, 2, 2.6]],
};
const ui = document.getElementById('ui');
const go = (k) => { const [p, l] = typeof BOOK[k] === 'function' ? BOOK[k]() : BOOK[k]; camera.position.set(...p); controls.target.set(...l); controls.update(); bucketFlowers(); };
for (const k of Object.keys(BOOK)) { const b = document.createElement('button'); b.textContent = k; b.onclick = () => go(k); ui.appendChild(b); }
{
  const lab = document.createElement('label'), sel = document.createElement('select'); lab.append('light', sel);
  for (const k of Object.keys(MOODS)) sel.append(new Option(k, k, false, k === D.mood)); sel.onchange = () => setMood(sel.value); ui.appendChild(lab);
  const sl = document.createElement('label'), r = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 1, step: 0.01, value: D.season }), nm = document.createElement('span');
  sl.append('season', r, nm); nm.textContent = stageName(D.season); r.oninput = () => { setSeason(+r.value); nm.textContent = stageName(+r.value); bucketFlowers(); }; ui.appendChild(sl);
}
setMood(D.mood); setSeason(D.season); carpetUpload(0);
go('the avenue');
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ── the frame ──────────────────────────────────────────────────────────────────────────────────────────────────────
const clock = () => (typeof window.__mojClock === 'function' ? window.__mojClock() : performance.now() / 1000);
let srcs = [], lastC = clock(), simT = clock(), lastB = 0, swayT = simT, aloft = 0; const DT = 1 / 60, hud = document.getElementById('hud');
const sunView = new THREE.Vector3(); let frameNo = 0;
function frame() {
  const t = clock(); U.uT.value = t;
  let k = 0; while (swayT + DT <= t && k++ < 6) { swayT += DT; swayStep(DT, swayT); } if (k >= 6) swayT = t;
  if (t - lastB > 0.3) {
    const dt = lastB ? t - lastB : 0.3; lastB = t; bucketFlowers();
    // petals come only from open flowers still on the tree; while they fall, a share of the held ones lets go each tick
    const st = U.uStage.value, live = st.x > 0.6 && st.y < 0.98; srcs = live ? sourcesNear(camera.position.x, camera.position.y) : []; DB.setSources(srcs);
    if (srcs.length && st.y > 0.02) { let want = Math.round(dt * 900 * 4 * st.y * (1 - st.y)); for (let i = 0; i < NP && want > 0; i++) if (DB.held[i] && ((i * 0.6180339) % 1) < 0.5 + 0.5 * st.y) { const c = srcs[(i * 7919 + Math.floor(t * 13)) % srcs.length]; DB.held[i] = 0; DB.x[i] = c[0]; DB.y[i] = c[1]; DB.z[i] = c[2]; DB.gz[i] = groundAt(c[0], c[1]); DB.vx[i] = 0; DB.vy[i] = 0; DB.vz[i] = 0; want--; } }
    if (t - lastC > 0.5) { carpetUpload(t - lastC); lastC = t; }
  }
  k = 0; while (simT + DT <= t && k++ < 4) { simT += DT; DB.step(DT, simT, camera.position.x, camera.position.y); } if (k >= 4) simT = t;
  aloft = drawPetals();
  controls.update();
  const c = controls.target; sun.position.set(Math.round(c.x / 4) * 4 + SUN.x * 60, Math.round(c.y / 4) * 4 + SUN.y * 60, SUN.z * 60); sun.target.position.set(Math.round(c.x / 4) * 4, Math.round(c.y / 4) * 4, 0); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position);
  camera.updateMatrixWorld(); U.uSunView.value.copy(sunView.copy(SUN).transformDirection(camera.matrixWorldInverse));
  // the shadows every other frame: the sun stands still and a tree sways slowly against a shadow's softness
  if ((frameNo++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
  POST.render();
}
function loop() { frame(); requestAnimationFrame(loop); }
loop();
let fps = 0, n = 0, t0 = performance.now();
setInterval(() => { const now = performance.now(); fps = (n * 1000) / (now - t0); n = 0; t0 = now; hud.textContent = `${fps.toFixed(0)} fps · ${stageName(season)} · ${flowersNear.toLocaleString()} flowers whole, ${trees.filter((t) => t.level !== 'L1').reduce((a, t) => a + D.variants[t.v].hero.nFlowers, 0).toLocaleString()} as discs · ${aloft.toLocaleString()} petals loose · wind ${D.wind.speed} m/s`; }, 1000);
(function count() { n++; requestAnimationFrame(count); })();
// timing hook: frames rendered back to back, so a hidden pane's throttled rAF does not decide the number
window.__grove = { trees, tiers, SETS, BOOK, go, renderer, timing(N = 20) { const gl = renderer.getContext(); frame(); gl.finish(); const a = performance.now(); for (let i = 0; i < N; i++) frame(); gl.finish(); const ms = (performance.now() - a) / N;
  const tierTris = tiers.reduce((s, t) => s + t.im.count * t.tris, 0); return { frameMs: +ms.toFixed(1), flowersDrawn: tiers.map((t) => t.im.count), flowerTris: tierTris, calls: renderer.info.render.calls, frameTris: renderer.info.render.triangles }; } };
