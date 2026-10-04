import { safeJson } from '../emit-util.js';
import { windField, debrisKernel } from '../../vegetation/wind.js';

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
//   · debris (`debris`, optional): fallen leaves and dust around the camera, stepped at 60 Hz on the CPU by the same
//     field (windField and debrisKernel, inlined from vegetation/wind.js): they lie still until a gust passes their
//     lift, tumble downwind and settle. Leaves are one InstancedMesh of small quads, dust one Points cloud of what is aloft.
//   · the clock is window.__mojClock when a capture pins it, so a baked frame is reproducible.
// Absent `wind` ⇒ NOT emitted, and the plants' and grass' scripts are emitted without their wind hooks.
// `cfg`: { speed, dir, gust, scale, evolve, veer, seed, z0, lags, grass: [taker], plants: [taker], bend: { NR, NS, NB,
//          R_MAX, B_MAX, data }, debris?: { leaves, dust, radius, phi } }; taker: { B, sail, vogel, zeta, flutter, phi }
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

// the debris' page code: the kernel inlined, a fixed 60 Hz step on the wind's clock, leaves as tumbling quads, dust aloft as points
const debrisPage = `  const DB = (${debrisKernel.toString()})({ ...WIND.debris, seed: WIND.seed }, WF.at, (x, y) => { const g = TW.kernel.groundAt(x, y), w = TW.cfg.water; return w && g < w.z ? w.z : g; });
  DB.place(camera.position.x, camera.position.y);
  const leafGeo = new THREE.PlaneGeometry(0.1, 0.065);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), Math.max(1, WIND.debris.leaves)); leaves.count = WIND.debris.leaves; leaves.frustumCulled = false; leaves.userData.g = 'debris';
  // fallen leaves read against the grass: ochre, amber, rust
  const LEAF = [[0.78, 0.45, 0.1], [0.85, 0.66, 0.18], [0.62, 0.28, 0.08], [0.7, 0.62, 0.22], [0.5, 0.36, 0.14]].map((c) => new THREE.Color(c[0], c[1], c[2]));
  for (let i = 0; i < WIND.debris.leaves; i++) leaves.setColorAt(i, LEAF[i % LEAF.length]);
  scene.add(leaves);
  const dustPos = new Float32Array(3 * Math.max(1, WIND.debris.dust)), dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xcdb990, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false })); dust.frustumCulled = false; dust.userData.g = 'debris'; scene.add(dust);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  let simT = null; const DT = 1 / 60;
  function stepDebris(t) {
    if (simT === null || t < simT || t - simT > 1) simT = t;   // first frame, a pinned clock moved back, or a long stall: carry on from now
    let k = 0; while (simT + DT <= t && k++ < 4) { simT += DT; DB.step(DT, simT, camera.position.x, camera.position.y); }
    for (let i = 0; i < WIND.debris.leaves; i++) {
      const s = DB.spin[i], aloft = DB.vx[i] || DB.vy[i] || DB.vz[i];
      E.set(aloft ? s * 1.3 : 0, aloft ? s * 0.7 : 0, s); Q.setFromEuler(E); M4.compose(P3.set(DB.x[i], DB.y[i], DB.z[i] + 0.01), Q, ONE); leaves.setMatrixAt(i, M4);
    }
    leaves.instanceMatrix.needsUpdate = true;
    let m = 0; for (let i = WIND.debris.leaves; i < DB.n; i++) if (DB.vz[i] || DB.vx[i] || DB.vy[i]) { dustPos[3 * m] = DB.x[i]; dustPos[3 * m + 1] = DB.y[i]; dustPos[3 * m + 2] = DB.z[i]; m++; }
    dustGeo.setDrawRange(0, m); dustGeo.attributes.position.needsUpdate = true;
  }
`;

export function terrainWindScript(cfg) {
  return `
// --- terrain wind (opt-in): one gust field; grass and plants bend in it as far as their flaccidity lets them ---
const WIND = ${safeJson(cfg)};
(function () {
  const TW = window.__mojTerrain; if (!TW) return;
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  // the gust field (vegetation/wind.js windField): its seeded noise is the shader's texture and the debris' own read
  const WF = (${windField.toString()})(WIND), N = WF.N;
  const noise = new THREE.DataTexture(WF.noise, N, N, THREE.RGBAFormat); noise.wrapS = noise.wrapT = THREE.RepeatWrapping; noise.magFilter = noise.minFilter = THREE.LinearFilter; noise.needsUpdate = true;
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
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
${cfg.debris ? debrisPage : ''}  (function tick() { U.uWindT.value = clock();${cfg.debris ? ' stepDebris(U.uWindT.value);' : ''} requestAnimationFrame(tick); })();
  TW.wind = { cfg: WIND, uniforms: U, material, materials: made, field: WF${cfg.debris ? ', debris: DB' : ''} };
})();
`;
}
