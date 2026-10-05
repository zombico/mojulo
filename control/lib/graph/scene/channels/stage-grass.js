import { safeJson } from '../emit-util.js';
import { terrainWindScript, WIND_AT_GLSL } from './terrain-wind.js';

// In-page script: a stage's LIVE GRASS (opt-in: an isekai recipe's `wind`, era/isekai.js). The static blade cards are
// the floor; this stands grown blades (vegetation/grass.js, the stylized meadow) round the walker and moves them.
//   · the ground: the stage ships its landform grid (heights), a mask (bit 0: grass may stand in the cell — not on the
//     trail, a rock, a trunk, the cliff or the apron; bit 1: the sun reaches it) — and registers a minimal
//     window.__mojTerrain (a ground lookup) so the terrain's wind script (channels/terrain-wind.js) runs on a stage
//   · the field: tiles of `tile` m round the camera out to `radius`; in each mask cell tufts stand by a seeded hash at
//     `density` a square metre. Past `near` they thin as (near/d)², the survivors widened; over the last fifth of the
//     radius they shrink out while the static cards dither in. Levels L2/L1/L0 by size on screen, under `drawTris`.
//   · THE PIXEL LOCK, IN THE SHADER: a vertex's ramp coordinate is its height up the tuft; an instance carries its window
//     of the grass ramp's stops (lit or shade, from the mask); the fragment takes the stop at lo + coord × (hi − lo),
//     from a nearest-filtered ramp texture, so only the palette's stops reach the screen, through every bend.
//   · SHEEN: where the gust at a tuft's root runs above the mean, its upper blades step up the ramp: a gust is a band of
//     light rolling across the field. PARTING: blades within `part.r` of the walker bend away from it, the tips most.
//   · the cards: the static blade cards (their textured meshes, tagged with their group) discard inside the field, by the
//     same distance from the eye the field thins by.
//   · CROWNS: the trees' crown and wood meshes bend in the same gust field, weighted by height above the ground.
//   · the clock is window.__mojClock when a capture pins it (the wind's), so a baked frame is reproducible.
// Absent `liveGrass` ⇒ NOT emitted.
const FIELD = `
(function () {
  const TW = window.__mojTerrain, LG = __LG; if (!TW || !TW.wind) return;
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  const G = LG.grid, M = TW.stageMask, CX = G.nx - 1;
  const cellAt = (x, y) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((y - G.y0) / G.cell); return i < 0 || j < 0 || i >= CX || j >= G.ny - 1 ? 0 : M[j * CX + i]; };
  // the ramp, as LINEAR floats (the page encodes to sRGB on output, so a stop comes back as itself)
  const N = LG.ramp.length, lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const rd = new Float32Array(N * 4); LG.ramp.forEach((c, i) => { rd[i * 4] = lin(c[0]); rd[i * 4 + 1] = lin(c[1]); rd[i * 4 + 2] = lin(c[2]); rd[i * 4 + 3] = 1; });
  const rampTex = new THREE.DataTexture(rd, N, 1, THREE.RGBAFormat, THREE.FloatType); rampTex.magFilter = rampTex.minFilter = THREE.NearestFilter; rampTex.needsUpdate = true;
  const U = { uRamp: { value: rampTex }, uRampN: { value: N }, uPart: { value: new THREE.Vector4(0, 0, LG.part.k, LG.part.r) }, uSheen: { value: LG.sheen } };
  const VDECL = 'attribute float aRamp; attribute vec2 iWin; varying float vRamp; varying vec2 vWin; varying float vShift; uniform vec4 uPart; uniform float uSheen;\\n'
    + 'vec3 mojPart(vec3 root, vec3 local, float sc, float H) { vec2 d = root.xy - uPart.xy; float r = length(d); if (r > uPart.w || r < 1e-4) return vec3(0.0);'
    + ' float s = clamp(local.z / H, 0.0, 1.0), k = uPart.z * (1.0 - r / uPart.w) * s * s * sc; return vec3(d / r * k, -0.5 * k * s); }\\n';
  const FDECL = 'uniform sampler2D uRamp; uniform float uRampN; varying float vRamp; varying vec2 vWin; varying float vShift;\\n';
  // the patch the wind's material applies over its own (userData.mojPatch): the ramp coordinate, the sheen, the parting
  function patchFor(H) {
    return (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + VDECL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\\nvRamp = aRamp; vWin = iWin; vShift = 0.0;\\n#ifdef USE_INSTANCING\\n{ vec2 gu = mojWindAt(instanceMatrix[3].xy, 2.0, uWindT); vShift = uSheen * clamp(length(gu) / max(uWindA.x, 0.01) - 1.0, -1.0, 1.0) * smoothstep(0.35, 1.0, aRamp); }\\n#endif')
        .replace('mvPosition = modelViewMatrix * mvPosition;', 'mvPosition.xyz += mojPart(instanceMatrix[3].xyz, transformed, length(instanceMatrix[2].xyz), ' + H.toFixed(4) + ');\\nmvPosition = modelViewMatrix * mvPosition;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\n' + FDECL)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'float mojI = clamp(floor(vWin.x + vRamp * (vWin.y - vWin.x) + 0.5 + vShift), 0.0, uRampN - 1.0);\\nvec4 diffuseColor = vec4(texture2D(uRamp, vec2((mojI + 0.5) / uRampN, 0.5)).rgb, opacity);');
    };
  }
  const TPL = LG.templates.map((t) => {
    const q = dec(t.q), P = new Float32Array(q.length), R = new Float32Array(q.length / 3);
    for (let i = 0; i < q.length; i++) { const k = i % 3; P[i] = t.lo[k] + (q[i] + 32768) * t.sc[k]; }
    for (let i = 0; i < R.length; i++) R[i] = Math.max(0, Math.min(1, P[i * 3 + 2] / t.H));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aRamp', new THREE.BufferAttribute(R, 1)); g.computeBoundingSphere();
    const base = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); base.userData.mojPatch = patchFor(t.H); base.userData.mojKey = '|stage-grass|' + t.H.toFixed(4);
    return { g, mat: TW.wind.material(base, LG.taker, t.H), tris: t.tris, im: null, cap: 0, n: 0, list: [] };
  });
  // the tufts of a tile: [x, y, z, h, pick, lit, lean, az] each, from the mask and a seeded hash
  const hash = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const TILE = LG.tile, RAD = LG.radius, NEAR = LG.near, S = LG.seed | 0;
  function tuftsIn(ti, tj) {
    const out = [], c = G.cell, i0 = Math.floor((ti * TILE - G.x0) / c), j0 = Math.floor((tj * TILE - G.y0) / c), n = Math.round(TILE / c), per = LG.density * c * c;
    for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) {
      if (i < 0 || j < 0 || i >= CX || j >= G.ny - 1) continue; const m = M[j * CX + i]; if (!(m & 1)) continue;
      const k = Math.floor(per + hash(i, j, S));
      for (let q = 0; q < k; q++) {
        const x = G.x0 + (i + hash(i, j, S + 11 + q * 7)) * c, y = G.y0 + (j + hash(i, j, S + 13 + q * 7)) * c;
        const h = LG.height[0] + (LG.height[1] - LG.height[0]) * hash(i, j, S + 17 + q * 7);
        out.push(x, y, TW.kernel.groundAt(x, y), h, hash(i, j, S + 19 + q * 7), (cellAt(x, y) & 2) ? 1 : 0, 8 * hash(i, j, S + 23 + q * 7), 360 * hash(i, j, S + 29 + q * 7));
      }
    }
    return out;
  }
  const PER = 8, tiles = new Map(), stat = { tiles: 0, live: 0, tris: 0, k: 1 };
  function ensure(t, need) {
    if (need <= t.cap) return; if (t.im) { scene.remove(t.im); t.im.dispose(); }
    t.cap = Math.max(need, Math.ceil(t.cap * 1.5), 64); t.im = new THREE.InstancedMesh(t.g, t.mat, t.cap); t.im.count = 0; t.im.frustumCulled = false; t.im.userData.g = 'live-grass';
    t.win = new THREE.InstancedBufferAttribute(new Float32Array(2 * t.cap), 2); t.g.setAttribute('iWin', t.win); scene.add(t.im);
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), AX = new THREE.Vector3(), PV = new THREE.Vector3(), SV = new THREE.Vector3();
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  function assign() {
    const c = camera.position, f = window.innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360)), all = [];
    for (const t of TPL) t.n = 0;
    for (const tl of tiles.values()) {
      const a = tl.a;
      for (let q = 0; q < a.length; q += PER) {
        const x = a[q], y = a[q + 1], z = a[q + 2], h = a[q + 3], d = Math.hypot(x - c.x, y - c.y, z + h / 2 - c.z); if (d > RAD) continue;
        const keep = d <= NEAR ? 1 : Math.max(0.05, (NEAR / d) ** 2), rank = (a[q + 4] * 9.7361 + 0.1307) % 1; if (rank >= keep) continue;
        const fade = d > 0.8 * RAD ? Math.max(0, (RAD - d) / (0.2 * RAD)) : 1, s = h * fade * smooth(0, 0.25 * keep, keep - rank), w = Math.min(1.8, 1 / Math.sqrt(keep));
        if (s <= 1e-3) continue;
        all.push({ x, y, z, s, w, v: Math.min(LG.variants.length - 1, Math.floor(a[q + 4] * LG.variants.length)), lit: a[q + 5], lean: a[q + 6], az: a[q + 7], px: (LG.size * s * f) / d });
      }
    }
    const lv = (e, k) => (e.px * k >= LG.px.L2 ? 'L2' : e.px * k >= LG.px.L1 ? 'L1' : 'L0'), cost = (k) => { let n = 0; for (const e of all) n += TPL[LG.variants[e.v][lv(e, k)]].tris; return n; };
    let k = 1; if (cost(1) > LG.drawTris) { let lo = 0.01, hi = 1; for (let it = 0; it < 14; it++) { const mid = Math.sqrt(lo * hi); if (cost(mid) > LG.drawTris) hi = mid; else lo = mid; } k = lo; }
    for (const e of all) { const t = TPL[LG.variants[e.v][lv(e, k)]]; t.list[t.n++] = e; }
    for (const t of TPL) {
      ensure(t, t.n);
      for (let i = 0; i < t.n; i++) {
        const e = t.list[i], az = (e.az * Math.PI) / 180; AX.set(-Math.sin(az), Math.cos(az), 0); Q.setFromAxisAngle(AX, (e.lean * Math.PI) / 180);
        M4.compose(PV.set(e.x, e.y, e.z - 0.03), Q, SV.set(e.s * e.w, e.s * e.w, e.s)); t.im.setMatrixAt(i, M4);
        const W = e.lit ? LG.win.lit : LG.win.shade; t.win.setXY(i, W[0], W[1]);
      }
      t.im.count = t.n; t.im.instanceMatrix.needsUpdate = true; t.win.needsUpdate = true;
    }
    stat.live = all.length; stat.k = k;
  }
  let at = [1e12, 1e12, 1e12];
  function tick() {
    const c = camera.position; U.uPart.value.x = c.x; U.uPart.value.y = c.y;
    if (Math.hypot(c.x - at[0], c.y - at[1], c.z - at[2]) > 0.75) {
      at = [c.x, c.y, c.z];
      const r = RAD + TILE, need = new Set();
      for (let j = Math.floor((c.y - r) / TILE); j <= Math.floor((c.y + r) / TILE); j++) for (let i = Math.floor((c.x - r) / TILE); i <= Math.floor((c.x + r) / TILE); i++) {
        const key = i + ':' + j; need.add(key); if (!tiles.has(key)) tiles.set(key, { a: tuftsIn(i, j) });
      }
      for (const key of [...tiles.keys()]) if (!need.has(key)) tiles.delete(key);
      stat.tiles = tiles.size; assign();
    }
    requestAnimationFrame(tick);
  }
  // the static cards dissolve inside the field (dithered across its last fifth)
  const CU = { uCam: { value: camera.position }, uFade: { value: new THREE.Vector2(0.8 * RAD, RAD) } };
  scene.traverse((o) => {
    if (!o.isMesh || !LG.cards.includes(o.userData.g) || !o.material || !o.material.map) return;
    const mat = o.material.clone(); mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, CU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec3 vMojW;').replace('#include <begin_vertex>', '#include <begin_vertex>\\nvMojW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\nvarying vec3 vMojW; uniform vec3 uCam; uniform vec2 uFade;')
        .replace('void main() {', 'void main() {\\n  { float d = distance(vMojW, uCam), f = clamp((d - uFade.x) / (uFade.y - uFade.x), 0.0, 1.0); if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) >= f) discard; }');
    };
    mat.customProgramCacheKey = () => 'mojulo-grass-cards'; o.material = mat;
  });
  window.__mojStageGrass = { tiles, stat, templates: TPL };
  tick();
})();
`;

const CROWNS = `
(function () {
  const TW = window.__mojTerrain, LG = __LG, CR = LG.crowns; if (!TW || !TW.wind || !CR) return;
  const G = LG.grid, Z = TW.stageHeights, gd = new Float32Array(G.nx * G.ny); for (let i = 0; i < gd.length; i++) gd[i] = Z[i];
  const ground = new THREE.DataTexture(gd, G.nx, G.ny, THREE.RedFormat, THREE.FloatType); ground.magFilter = ground.minFilter = THREE.NearestFilter; ground.needsUpdate = true;
  const U = Object.assign({}, TW.wind.uniforms, { uGround: { value: ground }, uGridG: { value: new THREE.Vector4(G.x0, G.y0, (G.nx - 1) * G.cell, (G.ny - 1) * G.cell) },
    uCrown: { value: new THREE.Vector4(CR.phi, CR.reach, CR.flutter, 0) }, uCrownZ: { value: new THREE.Vector2(CR.from, CR.full) } });
  const GLSL = 'uniform float uWindT; uniform vec4 uWindA; uniform vec4 uWindB; uniform sampler2D uWindNoise; uniform sampler2D uGround; uniform vec4 uGridG; uniform vec4 uCrown; uniform vec2 uCrownZ;\\n' + __WIND_AT
    + 'vec3 mojCrown(vec3 p) { float g = texture2D(uGround, clamp((p.xy - uGridG.xy) / uGridG.zw, 0.0, 1.0)).r; float w = smoothstep(uCrownZ.x, uCrownZ.y, p.z - g); if (w <= 0.0) return vec3(0.0);'
    + ' vec2 u = mojWindAt(p.xy, p.z - g, uWindT); float m = length(u); vec2 push = u * m * uCrown.x / 80.0;'
    + ' float fl = uCrown.z * min(1.0, m / 4.0) * sin(uWindT * 2.3 + dot(p, vec3(0.7, 1.1, 0.5)));'
    + ' return vec3((push * uCrown.y + vec2(fl, -fl)) * w, -0.15 * length(push) * uCrown.y * w); }\\n';
  scene.traverse((o) => {
    if (!o.isMesh || !CR.groups.includes(o.userData.g) || !o.material) return;
    const mat = o.material.clone(); mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + GLSL).replace('#include <begin_vertex>', '#include <begin_vertex>\\ntransformed += mojCrown((modelMatrix * vec4(transformed, 1.0)).xyz);');
    };
    mat.customProgramCacheKey = () => 'mojulo-crown-sway'; o.material = mat;
  });
})();
`;

/** `cfg`: { grid: { x0, y0, cell, nx, ny, zlo, zsc, z (Int16 b64), m (Uint8 b64) }, ramp, win: { lit, shade }, templates:
 *  [{ lo, sc, q, H, tris }], variants: [{ L2, L1, L0 }], size, radius, near, tile, density, height, px, drawTris, seed,
 *  sheen, part: { r, k }, taker, cards: [group], crowns: { groups, phi, reach, flutter, from, full } | null, wind } */
export function stageGrassScript(cfg) {
  const { wind, ...rest } = cfg, lg = safeJson(rest);
  return `
// --- stage live grass (opt-in): the stage's ground for the wind, then the field, then the crowns ---
(function () {
  const LG = ${lg};
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  const G = LG.grid, Zq = dec(G.z), Z = new Float32Array(Zq.length); for (let i = 0; i < Zq.length; i++) Z[i] = G.zlo + (Zq[i] + 32768) * G.zsc;
  const node = (i, j) => Z[Math.max(0, Math.min(G.ny - 1, j)) * G.nx + Math.max(0, Math.min(G.nx - 1, i))];
  function groundAt(x, y) {
    const u = Math.max(0, Math.min(G.nx - 1.0001, (x - G.x0) / G.cell)), v = Math.max(0, Math.min(G.ny - 1.0001, (y - G.y0) / G.cell)), i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    return (node(i, j) * (1 - fu) + node(i + 1, j) * fu) * (1 - fv) + (node(i, j + 1) * (1 - fu) + node(i + 1, j + 1) * fu) * fv;
  }
  window.__mojTerrain = window.__mojTerrain || { kernel: { groundAt }, cfg: {}, stat: {} };
  window.__mojTerrain.stageHeights = Z; window.__mojTerrain.stageMask = dec(G.m); window.__mojStageLG = LG;
})();
${terrainWindScript(wind)}${FIELD.replace('__LG', 'window.__mojStageLG')}${CROWNS.replace('__LG', 'window.__mojStageLG').replace('__WIND_AT', safeJson(WIND_AT_GLSL))}`;
}
