import { safeJson } from '../emit-util.js';
import { terrainWindScript, WIND_AT_GLSL } from './terrain-wind.js';
import { grassContact } from '../../vegetation/grass-contact.js';

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
//     light rolling across the field.
//   · CONTACT (`contact`, vegetation/grass-contact.js): what touches the grass is a LOAD on the blade, added to the wind's
//     before the bend table, so a pressed blade keeps its length and a foot and a gust add up. A bed round the camera
//     holds how far each cell's blades lie and which way; the walker (while its feet are in the grass), the page's
//     walkers and physics spheres stamp it, and it recovers with a half-life. A landing (or __mojStageGrass.impact) runs a
//     ring of load out through the field, a closed form of the clock, and leaves a crater. A laid blade turns a stop up
//     the ramp laid away from the eye and down laid toward it: the mowing stripe. Absent ⇒ the grass stands untouched.
//   · THE MATERIAL POLE (`real`, era/style/pole.js): the ramp read smooth between its stops, darkened into the canopy at
//     the root, a share of tufts gone to straw at the tips, the sun through a blade seen against it. Absent ⇒ the lock.
//   · the cards: the static blade cards (their textured meshes, tagged with their group) discard inside the field, by the
//     same distance from the eye the field thins by.
//   · CROWNS: the trees' crown and wood meshes bend in the same gust field, weighted by height above the ground.
//   · PETALS (`petals`, a sakura's): a notched, cupped petal mesh, pixel-locked as the blades are (its ramp coordinate
//     base to tip, its window of the blossom ramp per instance). FALLING: let go from under a crown, tumbling, carried
//     downwind by the mean wind and nudged by the gust where it is, lying where it lands for `rest` s, then let go again
//     — a closed form of the clock, so a pinned frame is reproducible; lit while it faces the sun, shade edge-on. The
//     CARPET (`carpet`): petals lying round the walker from the builder's petal grid, thinned with distance as the
//     field, lifted and skipped by gusts in the vertex shader; the static litter dissolves inside it.
//   · the clock is window.__mojClock when a capture pins it (the wind's), so a baked frame is reproducible.
// Absent `liveGrass` ⇒ NOT emitted.
// the contact's GLSL (with `contact`): the bed's load and the impacts' rings at a blade's root, set once per vertex into
// mojCL and added to the wind's load before the bend table (so a pressed blade keeps its length); vLay is how far it lies
const CONTACT_VDECL = "uniform sampler2D uBed; uniform vec4 uBedG; uniform vec4 uImp[__IMPN]; uniform vec4 uWave; uniform float uCT; uniform vec2 uFlat; vec2 mojCL = vec2(0.0); varying float vLay;\n"
  + 'vec2 mojContact(vec2 p) { vec2 L = vec2(0.0), uv = (p - uBedG.xy) / uBedG.z;'
  + ' if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) L += (texture(uBed, uv).gb * 255.0 - 127.0) / 127.0 * uFlat.x;'
  + ' for (int i = 0; i < __IMPN; i++) { vec4 I = uImp[i]; float tau = uCT - I.z; if (I.w <= 0.0 || tau < 0.0) continue; vec2 d = p - I.xy; float r = length(d); if (r < 1e-3) continue;'
  + ' float u = (r - uWave.x * tau) / uWave.y; L += d / r * (uWave.w * I.w * exp(-tau / uWave.z) * exp(-u * u) / sqrt(1.0 + r)); }'
  + ' return L; }\n';
// per instance: the contact's load, how far the tuft lies, and its laid blades' turn of a stop toward the eye or away
// (a blade laid away from the eye shows its length to the sky, laid toward it its ends: the mowing stripe)
const CONTACT_BEGIN = '{ mojCL = mojContact(instanceMatrix[3].xy); float cl = length(mojCL); vLay = clamp(cl / uFlat.y, 0.0, 1.0); vec2 vd = instanceMatrix[3].xy - cameraPosition.xy;'
  + ' if (cl > 1e-4 && length(vd) > 1e-3) vShift += vLay * dot(mojCL / cl, normalize(vd)); }\n';
// the material pole's fragment: the ramp read smooth between its stops, the canopy's occlusion at the root (opened where the
// grass is laid), a `dry` share of tufts gone to straw at the tips, the sun through a blade seen against it, and a laid
// blade turned up to the sky
const REAL_VDECL = 'varying vec3 vMojW; varying float vDry;\n';
const REAL_FDECL = 'uniform vec3 uSun; uniform vec3 uSunCol; uniform vec4 uReal; varying vec3 vMojW; varying float vDry;\n';
const REAL_FRAG = 'float mojC = clamp(mojW.x + vRamp * (mojW.y - mojW.x) + vShift, 0.0, uRampN - 1.0), mojF = floor(mojC), mojL = __LAY;\n'
  + 'vec3 mojCol = mix(texture2D(uRamp, vec2((mojF + 0.5) / uRampN, 0.5)).rgb, texture2D(uRamp, vec2((min(mojF + 1.0, uRampN - 1.0) + 0.5) / uRampN, 0.5)).rgb, mojC - mojF);\n'
  + 'mojCol *= mix(uReal.x, 1.0, mix(smoothstep(0.0, 0.75, vRamp), 1.0, 0.6 * mojL));\n'
  + '{ float g = dot(mojCol, vec3(0.2126, 0.7152, 0.0722)); mojCol = mix(mojCol, g * vec3(1.35, 1.15, 0.6), 0.65 * step(vDry, uReal.z) * smoothstep(0.25, 1.0, vRamp)); }\n'
  + '{ vec3 V = normalize(vMojW - cameraPosition); mojCol += mojCol * uSunCol * (1.5 * uReal.y * pow(max(0.0, dot(V, uSun)), 3.0) * smoothstep(0.2, 1.0, vRamp) * step(uReal.w - 0.5, vWin.y)); }\n'
  + 'mojCol *= 1.0 + 0.25 * mojL;\nvec4 diffuseColor = vec4(mojCol, opacity);';

const FIELD = (o) => `
(function () {
  const TW = window.__mojTerrain, LG = __LG; if (!TW || !TW.wind) return;
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  const G = LG.grid, M = TW.stageMask, CX = G.nx - 1;
  const cellAt = (x, y) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((y - G.y0) / G.cell); return i < 0 || j < 0 || i >= CX || j >= G.ny - 1 ? 0 : M[j * CX + i]; };
  // the ramp, as LINEAR floats (the page encodes to sRGB on output, so a stop comes back as itself)
  const N = LG.ramp.length, lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const rd = new Float32Array(N * 4); LG.ramp.forEach((c, i) => { rd[i * 4] = lin(c[0]); rd[i * 4 + 1] = lin(c[1]); rd[i * 4 + 2] = lin(c[2]); rd[i * 4 + 3] = 1; });
  const rampTex = new THREE.DataTexture(rd, N, 1, THREE.RGBAFormat, THREE.FloatType); rampTex.magFilter = rampTex.minFilter = THREE.NearestFilter; rampTex.needsUpdate = true;
  const U = { uRamp: { value: rampTex }, uRampN: { value: N }, uSheen: { value: LG.sheen } };${o.contact ? `
  // CONTACT: the bed round the camera (an RGBA8 texture, linear) and the impacts ringing, from the kernel the tests run
  const CT = LG.contact, bed = (__GC)(CT), bedPx = bed.pack(new Uint8Array(bed.N * bed.N * 4));
  const bedTex = new THREE.DataTexture(bedPx, bed.N, bed.N, THREE.RGBAFormat); bedTex.magFilter = bedTex.minFilter = THREE.LinearFilter; bedTex.needsUpdate = true;
  Object.assign(U, { uBed: { value: bedTex }, uBedG: { value: new THREE.Vector4(0, 0, bed.N * bed.cell, bed.N) }, uImp: { value: Array.from({ length: CT.impacts }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uWave: { value: new THREE.Vector4(CT.wave.speed, CT.wave.width, CT.wave.decay, CT.wave.gain) }, uCT: { value: 0 }, uFlat: { value: new THREE.Vector2(CT.flat * CT.press, CT.flat) } });` : ''}${o.real ? `
  const R = LG.real, sc = R.sunColor.map(lin);
  Object.assign(U, { uSun: { value: new THREE.Vector3(R.sun[0], R.sun[1], R.sun[2]).normalize() }, uSunCol: { value: new THREE.Vector3(sc[0], sc[1], sc[2]) }, uReal: { value: new THREE.Vector4(R.ao, R.back, R.dry, LG.win.lit[1]) } });` : ''}
  const VDECL = 'attribute float aRamp; attribute vec2 iWin; varying float vRamp; varying vec2 vWin; varying float vShift; uniform float uSheen;\\n'${o.contact ? ` + ${JSON.stringify(CONTACT_VDECL)}.split('__IMPN').join(String(LG.contact.impacts))` : ''}${o.real ? ` + ${JSON.stringify(REAL_VDECL)}` : ''};
  const FDECL = 'uniform sampler2D uRamp; uniform float uRampN; varying float vRamp; varying vec2 vWin; varying float vShift;\\n'${o.contact ? ` + 'varying float vLay;\\n'` : ''}${o.real ? ` + ${JSON.stringify(REAL_FDECL)}` : ''};
  // the patch the wind's material applies over its own (userData.mojPatch): the ramp coordinate, the sheen${o.contact ? ', the contact' : ''}
  function patchFor(fl = null) {
    return (sh) => {
      Object.assign(sh.uniforms, U, fl || {});
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\n' + VDECL${o.flowers ? " + (fl ? 'attribute float aSeg; attribute vec4 iFlo; varying float vSeg; varying vec4 vFlo;\\n' : '')" : ''})
        .replace('#include <begin_vertex>', '#include <begin_vertex>\\nvRamp = aRamp; vWin = iWin; vShift = 0.0;\\n#ifdef USE_INSTANCING\\n{ vec2 gu = mojWindAt(instanceMatrix[3].xy, 2.0, uWindT); vShift = uSheen * clamp(length(gu) / max(uWindA.x, 0.01) - 1.0, -1.0, 1.0) * smoothstep(0.35, 1.0, aRamp); }\\n'${o.contact ? ` + ${JSON.stringify(CONTACT_BEGIN)}` : ''}${o.real ? ` + 'vDry = fract(sin(dot(instanceMatrix[3].xy, vec2(12.9898, 78.233))) * 43758.5453);\\n'` : ''}${o.flowers ? ` + (fl ? 'vSeg = aSeg; vFlo = iFlo;${o.real ? ' vDry = 1.0;' : ''}\\n' : '')` : ''} + '#endif')${o.contact ? `
        .replace('float r = length(R);', 'R += mojCL; float r = length(R);')` : ''}${o.real ? `
        .replace('mvPosition = modelViewMatrix * mvPosition;', 'vMojW = (modelMatrix * mvPosition).xyz;\\nmvPosition = modelViewMatrix * mvPosition;')` : ''};
      // the window a fragment reads: a blade's (lit or shade), or a flower's part's (its stem the blade's, its petal, its eye)
      const W = ${o.flowers ? "fl ? 'varying float vSeg; varying vec4 vFlo;\\n' : ''" : "''"}, mojW = ${o.flowers ? "fl ? 'vec2 mojW = vSeg < 0.5 ? vWin : (vSeg < 1.5 ? vFlo.xy : vFlo.zw);\\n' : " : ''}'vec2 mojW = vWin;\\n';
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\n' + FDECL + W)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', mojW + ${o.real ? `${JSON.stringify(REAL_FRAG.replace('__LAY', o.contact ? 'vLay' : '0.0'))}` : `'float mojI = clamp(floor(mojW.x + vRamp * (mojW.y - mojW.x) + 0.5 + vShift), 0.0, uRampN - 1.0);\\nvec4 diffuseColor = vec4(texture2D(uRamp, vec2((mojI + 0.5) / uRampN, 0.5)).rgb, opacity);'`});
    };
  }
  const TPL = LG.templates.map((t) => {
    const q = dec(t.q), P = new Float32Array(q.length), R = new Float32Array(q.length / 3);
    for (let i = 0; i < q.length; i++) { const k = i % 3; P[i] = t.lo[k] + (q[i] + 32768) * t.sc[k]; }
    for (let i = 0; i < R.length; i++) R[i] = Math.max(0, Math.min(1, P[i * 3 + 2] / t.H));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aRamp', new THREE.BufferAttribute(R, 1)); g.computeBoundingSphere();
    const base = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); base.userData.mojPatch = patchFor(t.H); base.userData.mojKey = '|stage-grass|' + t.H.toFixed(4);
    return { g, mat: TW.wind.material(base, LG.taker, t.H), tris: t.tris, im: null, cap: 0, n: 0, list: [] };
  });${o.flowers ? `
  // THE FLOWERS: a share of the tufts carries wildflowers (vegetation/wildflowers.js), drawn on the tuft's own root and
  // scale and bent by the same load, so a flower moves with its grass; each vertex carries its part (stem, petal, eye) and
  // its coordinate up that part's window, the instance its kind's petal and eye windows in the flowers' ramp
  const FL = LG.flowers, FN = FL.ramp.length, fd = new Float32Array(FN * 4); FL.ramp.forEach((c, i) => { fd[i * 4] = lin(c[0]); fd[i * 4 + 1] = lin(c[1]); fd[i * 4 + 2] = lin(c[2]); fd[i * 4 + 3] = 1; });
  const flowerTex = new THREE.DataTexture(fd, FN, 1, THREE.RGBAFormat, THREE.FloatType); flowerTex.magFilter = flowerTex.minFilter = THREE.NearestFilter; flowerTex.needsUpdate = true;
  const FU = { uRamp: { value: flowerTex }, uRampN: { value: FN } };
  const FT = FL.templates.map((t) => {
    const q = dec(t.q), P = new Float32Array(q.length), sg = dec(t.seg), vv = dec(t.v), R = new Float32Array(vv.length), SG = new Float32Array(sg.length);
    for (let i = 0; i < q.length; i++) { const k = i % 3; P[i] = t.lo[k] + (q[i] + 32768) * t.sc[k]; }
    for (let i = 0; i < vv.length; i++) { R[i] = vv[i] / 255; SG[i] = sg[i]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aRamp', new THREE.BufferAttribute(R, 1)); g.setAttribute('aSeg', new THREE.BufferAttribute(SG, 1)); g.computeBoundingSphere();
    const base = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); base.userData.mojPatch = patchFor(FU); base.userData.mojKey = '|stage-flower';
    return { g, mat: TW.wind.material(base, LG.taker, 1), tris: t.tris, im: null, cap: 0, n: 0, list: [], flower: true };
  });
  const FW = FL.kinds.reduce((s, K) => s + K.weight, 0);
  // a tuft's bloom roll → its kind (by weight) and variant, or -1 for none
  const kindOf = (r) => { if (r >= FL.share) return -1; let u = (r / FL.share) * FW; for (let i = 0; i < FL.kinds.length; i++) { u -= FL.kinds[i].weight; if (u < 0) return i; } return FL.kinds.length - 1; };` : ''}
  // the tufts of a tile: [x, y, z, h, pick, lit, lean, az${o.flowers ? ', bloom' : ''}] each, from the mask and a seeded hash
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
        out.push(x, y, TW.kernel.groundAt(x, y), h, hash(i, j, S + 19 + q * 7), (cellAt(x, y) & 2) ? 1 : 0, 8 * hash(i, j, S + 23 + q * 7), 360 * hash(i, j, S + 29 + q * 7)${o.flowers ? ', hash(i, j, S + 31 + q * 7)' : ''});
      }
    }
    return out;
  }
  const PER = ${o.flowers ? 9 : 8}, tiles = new Map(), stat = { tiles: 0, live: 0, tris: 0, k: 1 };
  function ensure(t, need) {
    if (need <= t.cap) return; if (t.im) { scene.remove(t.im); t.im.dispose(); }
    t.cap = Math.max(need, Math.ceil(t.cap * 1.5), 64); t.im = new THREE.InstancedMesh(t.g, t.mat, t.cap); t.im.count = 0; t.im.frustumCulled = false; t.im.userData.g = 'live-grass';
    t.win = new THREE.InstancedBufferAttribute(new Float32Array(2 * t.cap), 2); t.g.setAttribute('iWin', t.win);${o.flowers ? `
    if (t.flower) { t.flo = new THREE.InstancedBufferAttribute(new Float32Array(4 * t.cap), 4); t.g.setAttribute('iFlo', t.flo); t.im.userData.g = 'live-flowers'; }` : ''} scene.add(t.im);
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
        all.push({ x, y, z, s, w, v: Math.min(LG.variants.length - 1, Math.floor(a[q + 4] * LG.variants.length)), lit: a[q + 5], lean: a[q + 6], az: a[q + 7], px: (LG.size * s * f) / d${o.flowers ? ', fk: kindOf(a[q + 8])' : ''} });
      }
    }
    const lv = (e, k) => (e.px * k >= LG.px.L2 ? 'L2' : e.px * k >= LG.px.L1 ? 'L1' : 'L0'), cost = (k) => { let n = 0; for (const e of all) n += TPL[LG.variants[e.v][lv(e, k)]].tris; return n; };
    let k = 1; if (cost(1) > LG.drawTris) { let lo = 0.01, hi = 1; for (let it = 0; it < 14; it++) { const mid = Math.sqrt(lo * hi); if (cost(mid) > LG.drawTris) hi = mid; else lo = mid; } k = lo; }
    for (const e of all) { const t = TPL[LG.variants[e.v][lv(e, k)]]; t.list[t.n++] = e; }
    for (const t of TPL) {
      ensure(t, t.n); if (!t.im) continue;
      for (let i = 0; i < t.n; i++) {
        const e = t.list[i], az = (e.az * Math.PI) / 180; AX.set(-Math.sin(az), Math.cos(az), 0); Q.setFromAxisAngle(AX, (e.lean * Math.PI) / 180);
        M4.compose(PV.set(e.x, e.y, e.z - 0.03), Q, SV.set(e.s * e.w, e.s * e.w, e.s)); t.im.setMatrixAt(i, M4);
        const W = e.lit ? LG.win.lit : LG.win.shade; t.win.setXY(i, W[0], W[1]);
      }
      t.im.count = t.n; t.im.instanceMatrix.needsUpdate = true; t.win.needsUpdate = true;
    }${o.flowers ? `
    // the flowers ride their tufts: the same matrix, the tuft's level
    for (const t of FT) t.n = 0;
    let blooms = 0;
    for (const e of all) { if (e.fk < 0) continue; const K = FL.kinds[e.fk], vs = K.variants[Math.min(K.variants.length - 1, Math.floor(((e.az / 360) * 7.31) % 1 * K.variants.length))], t = FT[vs[lv(e, k)]]; t.list[t.n++] = e; blooms++; }
    for (const t of FT) {
      ensure(t, t.n); if (!t.im) continue;
      for (let i = 0; i < t.n; i++) {
        const e = t.list[i], K = FL.kinds[e.fk], az = (e.az * Math.PI) / 180; AX.set(-Math.sin(az), Math.cos(az), 0); Q.setFromAxisAngle(AX, (e.lean * Math.PI) / 180);
        M4.compose(PV.set(e.x, e.y, e.z - 0.03), Q, SV.set(e.s * e.w, e.s * e.w, e.s)); t.im.setMatrixAt(i, M4);
        const W = e.lit ? LG.win.lit : LG.win.shade, Pw = e.lit ? K.petal.lit : K.petal.shade, Ew = e.lit ? K.eye.lit : K.eye.shade;
        t.win.setXY(i, W[0], W[1]); t.flo.setXYZW(i, Pw[0], Pw[1], Ew[0], Ew[1]);
      }
      t.im.count = t.n; t.im.instanceMatrix.needsUpdate = true; t.win.needsUpdate = true; t.flo.needsUpdate = true;
    }
    stat.blooms = blooms;` : ''}
    stat.live = all.length; stat.k = k;
  }
  let at = [1e12, 1e12, 1e12];
  function tick() {
    const c = camera.position;${o.contact ? ' touch();' : ''}
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
${o.contact ? `  // the BODIES in the grass, every frame: the walker (only while its feet are in the grass: an eye up in the air presses
  // nothing), the page's walkers and its physics spheres, and what the page presses itself; each stamps the bed where
  // it stands, and one that lands from a fall makes an impact
  const clockS = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000, TALL = LG.height[1] + 0.1, seen = new Map(), extra = [];
  let lastT = null;
  function body(key, x, y, z, r, t, dt) {
    let b = seen.get(key); const g = TW.kernel.groundAt(x, y), inGrass = z - g < TALL;
    if (!b || Math.hypot(x - b.x, y - b.y, z - b.z) > 3) { seen.set(key, { x, y, z, vx: 0, vy: 0, vz: 0 }); if (inGrass) bed.stamp(x, y, r, 0, 0, 1); return; }
    if (dt > 0) { const vz = (z - b.z) / dt, e = bed.landing(b.vz, vz); if (e && inGrass) { bed.impact(x, y, e, t); stat.impacts++; } b.vx = (x - b.x) / dt; b.vy = (y - b.y) / dt; b.vz = vz; }
    b.x = x; b.y = y; b.z = z; if (inGrass) bed.stamp(x, y, r, b.vx, b.vy, 1);
  }
  function touch() {
    const t = clockS(), dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, t - lastT)), c = camera.position; lastT = t;
    bed.recover(dt); bed.follow(c.x, c.y);
    body('eye', c.x, c.y, c.z - CT.eye, CT.body, t, dt);
    const W = window.__mojWalkers; if (Array.isArray(W)) W.forEach((w, i) => { const q = w && w.pos; if (q && (q[0] || q[1])) body('w' + i, q[0], q[1], q[2], 0.35, t, dt); });
    const S = window.__mojSim && window.__mojSim.meshes; if (S) for (const k in S) { const m = S[k]; if (!m || !m.geometry) continue; if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const r = m.geometry.boundingSphere.radius * m.scale.x; body('s' + k, m.position.x, m.position.y, m.position.z - r, Math.max(0.2, 1.2 * r), t, dt); }
    for (const p of extra.splice(0)) bed.stamp(p[0], p[1], p[2], p[3], p[4], p[5]);
    const o = bed.origin(); U.uBedG.value.x = o[0]; U.uBedG.value.y = o[1]; U.uCT.value = t;
    const I = bed.ringing(t); U.uImp.value.forEach((v, i) => { const q = I[i]; if (q) v.set(q[0], q[1], q[2], q[3]); else v.set(0, 0, 0, 0); });
    if (bed.live || stat.wasLive) { bed.pack(bedPx); bedTex.needsUpdate = true; } stat.wasLive = bed.live; stat.ringing = I.length;
  }
  stat.impacts = 0;
  // for the page's own gameplay: an impact of strength e (1 a jump's landing) at (x, y), and a press (radius r, laid k
  // 0..1, moving vx, vy) for one frame
  const impact = (x, y, e = 1) => { bed.impact(x, y, e, clockS()); stat.impacts++; }, press = (x, y, r = 0.5, k = 1, vx = 0, vy = 0) => { extra.push([x, y, r, vx, vy, k]); };
  window.__mojStageGrass = { tiles, stat, templates: TPL, bed, impact, press };
` : `  window.__mojStageGrass = { tiles, stat, templates: TPL };
`}  tick();
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

const PETALS = `
(function () {
  const TW = window.__mojTerrain, LG = __LG, PT = LG.petals; if (!TW || !TW.wind || !PT) return;
  const hash = (i, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(s, 668265263); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  // THE PETAL: a notched blade one unit long (y, base at 0), cupped across (z) and its tip curled up; aRamp runs base 0 to
  // tip 1, so the base takes the deeper stops of its window and the tip the palest
  const V = [[0, 0], [-0.3, 0.28], [0.3, 0.28], [-0.42, 0.6], [0.42, 0.6], [-0.36, 0.85], [0.36, 0.85], [-0.17, 1], [0.17, 1], [0, 0.88]];
  const F = [[0, 2, 1], [1, 2, 4], [1, 4, 3], [3, 4, 6], [3, 6, 5], [5, 6, 9], [5, 9, 7], [9, 6, 8]];
  const pos = new Float32Array(F.length * 9), ramp = new Float32Array(F.length * 3);
  F.forEach((f, k) => f.forEach((v, q) => { const [x, y] = V[v]; pos.set([x, y - 0.5, 0.5 * x * x + 0.12 * y * y], (k * 3 + q) * 3); ramp[k * 3 + q] = y; }));
  const geo = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRamp', new THREE.BufferAttribute(ramp, 1)); return g; };
  // the blossom ramp as linear stops, nearest-filtered: the petal shows nothing but the palette's stops (the grass's lock)
  const N = PT.ramp.length, lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const rd = new Float32Array(N * 4); PT.ramp.forEach((c, i) => { rd.set([lin(c[0]), lin(c[1]), lin(c[2]), 1], i * 4); });
  const rampTex = new THREE.DataTexture(rd, N, 1, THREE.RGBAFormat, THREE.FloatType); rampTex.magFilter = rampTex.minFilter = THREE.NearestFilter; rampTex.needsUpdate = true;
  const PROJECT = 'vec4 mvPosition = vec4(transformed, 1.0);\\n#ifdef USE_INSTANCING\\nmvPosition = instanceMatrix * mvPosition;\\n#endif\\n__STIR\\nmvPosition = modelViewMatrix * mvPosition;\\ngl_Position = projectionMatrix * mvPosition;';
  function material(stir, U) {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { uRamp: { value: rampTex }, uRampN: { value: N } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nattribute float aRamp; attribute vec2 iWin; varying float vRamp; varying vec2 vWin;\\n' + (stir ? stir.decl : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>\\nvRamp = aRamp; vWin = iWin;').replace('#include <project_vertex>', PROJECT.replace('__STIR', stir ? stir.body : ''));
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\nuniform sampler2D uRamp; uniform float uRampN; varying float vRamp; varying vec2 vWin;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'float mojI = clamp(floor(vWin.x + vRamp * (vWin.y - vWin.x) + 0.5), 0.0, uRampN - 1.0);\\nvec4 diffuseColor = vec4(texture2D(uRamp, vec2((mojI + 0.5) / uRampN, 0.5)).rgb, opacity);');
    };
    m.customProgramCacheKey = () => 'mojulo-petal' + (stir ? '-stir' : ''); return m;
  }
  const W = TW.wind.cfg, dir = [Math.cos(W.dir), Math.sin(W.dir)], WF = TW.wind.field, SUN = PT.sun;
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), NV = new THREE.Vector3();
  const LIE = 0.06;   // a lying petal's height over the landform: over the trail's ribbon, which stands 5 cm up

  // FALLING: let go from under each crown, falling and tumbling, carried downwind and nudged by the gust where it is,
  // lying where it lands for \`rest\` s, then let go again — a closed form of the clock. The window by its face to the sun:
  // a petal turned to it is lit, edge-on it is shade, so a tumbling petal flickers
  const NF = PT.sources.length * PT.per, fg = geo(), fwin = new THREE.InstancedBufferAttribute(new Float32Array(NF * 2), 2); fg.setAttribute('iWin', fwin);
  const fall = new THREE.InstancedMesh(fg, material(null, {}), NF); fall.frustumCulled = false; fall.userData.g = 'petals'; scene.add(fall);
  const P = Array.from({ length: NF }, (_, i) => {
    const src = PT.sources[Math.floor(i / PT.per)], a = 6.2832 * hash(i, 3), r = src[3] * Math.sqrt(hash(i, 5)) * 0.9;
    const x = src[0] + Math.cos(a) * r, y = src[1] + Math.sin(a) * r, z = src[2] - src[3] * (0.1 + 0.4 * hash(i, 7)), g = TW.kernel.groundAt(x, y);
    const fl = Math.max(0.5, (z - g) / (PT.fall * (0.8 + 0.4 * hash(i, 9)))), T = fl + PT.rest;
    return { x, y, z, g, fall: fl, T, ph: T * hash(i, 11), spin: 2 + 4 * hash(i, 13), s: PT.size * (0.8 + 0.4 * hash(i, 15)), yaw: 6.2832 * hash(i, 17) };
  });
  (function tick() {
    const t = clock();
    for (let i = 0; i < NF; i++) {
      const q = P[i], age = (t + q.ph) % q.T, f = Math.min(age, q.fall), carry = W.speed * PT.drift * f;
      let x = q.x + dir[0] * carry + PT.flutter * Math.sin(f * q.spin + i), y = q.y + dir[1] * carry + PT.flutter * Math.cos(f * q.spin * 0.7 + i);
      const u = WF.at(x, y, 2, t); x += u[0] * 0.12 * f; y += u[1] * 0.12 * f;
      const landed = age >= q.fall, z = landed ? TW.kernel.groundAt(x, y) + LIE : q.z - (q.z - q.g) * (f / q.fall);
      E.set(landed ? 0.2 : f * q.spin, landed ? 0 : f * q.spin * 0.6, q.yaw + f * q.spin * 0.3); Q.setFromEuler(E);
      M4.compose(PV.set(x, y, z), Q, SV.set(q.s * 0.85, q.s, q.s)); fall.setMatrixAt(i, M4);
      NV.set(0, 0, 1).applyQuaternion(Q); const lit = Math.abs(NV.x * SUN[0] + NV.y * SUN[1] + NV.z * SUN[2]) > 0.35, Wn = lit ? PT.win.lit : PT.win.shade; fwin.setXY(i, Wn[0], Wn[1]);
    }
    fall.instanceMatrix.needsUpdate = true; fwin.needsUpdate = true; requestAnimationFrame(tick);
  })();

  // THE CARPET: petals lying round the walker, out to \`radius\`, in tiles from the builder's grid (density by the crowns
  // over a cell, heaped in piles, the window by the sun on it; in a cell a \`heap\` share gathers round one centre, each a
  // hair above the last; where grass stands, a \`caught\` share rests up to \`rest\` m up in it); past
  // \`near\` they thin as (near/d)², the survivors widened; over the last
  // fifth they shrink out while the static litter dithers in. A gust over the mean by \`lift\` raises a petal and skips
  // it downwind, in the vertex shader, from the same gust field as the grass.
  const C = PT.carpet; let carpet = null;
  if (C) {
    const G = LG.grid, CX = G.nx - 1, Mk = dec(C.m), S = LG.seed | 0, RAD = C.radius, NEAR = C.near, TILE = C.tile, GM = TW.stageMask;
    const cellAt = (x, y) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((y - G.y0) / G.cell); return i < 0 || j < 0 || i >= CX || j >= G.ny - 1 ? 0 : GM[j * CX + i]; };
    const hash2 = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const U = Object.assign({}, TW.wind.uniforms, { uLift: { value: C.lift } });
    const stir = { decl: 'uniform float uWindT; uniform vec4 uWindA; uniform vec4 uWindB; uniform sampler2D uWindNoise; uniform float uLift;\\n' + __WIND_AT,
      body: '#ifdef USE_INSTANCING\\n{ vec3 r = instanceMatrix[3].xyz; vec2 u = mojWindAt(r.xy, 2.0, uWindT); float e = smoothstep(uLift, uLift + 0.5, length(u) / max(uWindA.x, 0.01) - 1.0);'
        + ' float ph = fract(sin(dot(r.xy, vec2(12.9898, 78.233))) * 43758.5453), hop = e * (0.5 + 0.5 * sin(uWindT * (5.0 + 4.0 * ph) + ph * 6.2832));'
        + ' mvPosition.xy += normalize(u + 1e-4) * e * (0.12 + 0.18 * ph); mvPosition.z += hop * 0.1 + (mvPosition.z - r.z) * 2.0 * hop; }\\n#endif' };
    const mat = material(stir, U), tiles = new Map(), stat = { tiles: 0, live: 0 };
    let im = null, win = null, cap = 0;
    const ensure = (need) => {
      if (need <= cap) return; if (im) { scene.remove(im); im.dispose(); }
      cap = Math.max(need, Math.ceil(cap * 1.5), 256); const g = geo(); win = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2); g.setAttribute('iWin', win);
      im = new THREE.InstancedMesh(g, mat, cap); im.count = 0; im.frustumCulled = false; im.userData.g = 'petal-carpet'; scene.add(im);
    };
    // the petals of a tile: [x, y, z, size, yaw, tilt, lit, rank] each
    const inTile = (ti, tj) => {
      const out = [], c = G.cell, i0 = Math.floor((ti * TILE - G.x0) / c), j0 = Math.floor((tj * TILE - G.y0) / c), n = Math.round(TILE / c);
      for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) {
        if (i < 0 || j < 0 || i >= CX || j >= G.ny - 1) continue; const m = Mk[j * CX + i], d = m & 63; if (!d) continue;
        const k = Math.floor(C.density * c * c * (d / 63) + hash2(i, j, S + 401));
        const hx = G.x0 + (i + 0.2 + 0.6 * hash2(i, j, S + 419)) * c, hy = G.y0 + (j + 0.2 + 0.6 * hash2(i, j, S + 421)) * c;   // the cell's heap
        for (let q = 0; q < k; q++) {
          let x = G.x0 + (i + hash2(i, j, S + 403 + q * 7)) * c, y = G.y0 + (j + hash2(i, j, S + 405 + q * 7)) * c;
          if (hash2(i, j, S + 423 + q * 7) < C.heap[0]) { const a = 6.2832 * hash2(i, j, S + 425 + q * 7), r = C.heap[1] * Math.sqrt(hash2(i, j, S + 427 + q * 7)) * Math.sqrt(hash2(i, j, S + 429 + q * 7)); x = hx + Math.cos(a) * r; y = hy + Math.sin(a) * r; }
          const caught = (cellAt(x, y) & 1) && hash2(i, j, S + 415 + q * 7) < C.caught ? C.rest * hash2(i, j, S + 417 + q * 7) : 0;   // caught in the grass
          out.push(x, y, TW.kernel.groundAt(x, y) + LIE + caught + q * 0.0015, C.size[0] + (C.size[1] - C.size[0]) * hash2(i, j, S + 407 + q * 7), 6.2832 * hash2(i, j, S + 409 + q * 7), (hash2(i, j, S + 411 + q * 7) - 0.5) * 0.6, m & 64 ? 1 : 0, hash2(i, j, S + 413 + q * 7));
        }
      }
      return out;
    };
    const assign = () => {
      const c = camera.position, all = [];
      for (const a of tiles.values()) for (let q = 0; q < a.length; q += 8) {
        const d = Math.hypot(a[q] - c.x, a[q + 1] - c.y, a[q + 2] - c.z); if (d > RAD) continue;
        const keep = d <= NEAR ? 1 : Math.max(0.05, (NEAR / d) ** 2); if (a[q + 7] >= keep) continue;
        const fade = d > 0.8 * RAD ? Math.max(0, (RAD - d) / (0.2 * RAD)) : 1, s = a[q + 3] * fade * Math.min(1.8, 1 / Math.sqrt(keep)); if (s > 1e-3) all.push(q, a, s);
      }
      ensure(all.length / 3);
      for (let k = 0, i = 0; k < all.length; k += 3, i++) {
        const q = all[k], a = all[k + 1], s = all[k + 2]; E.set(a[q + 5], a[q + 5] * 0.5, a[q + 4]); Q.setFromEuler(E);
        M4.compose(PV.set(a[q], a[q + 1], a[q + 2]), Q, SV.set(s * 0.85, s, s)); im.setMatrixAt(i, M4);
        const Wn = a[q + 6] ? PT.win.lit : PT.win.shade; win.setXY(i, Wn[0], Wn[1]);
      }
      im.count = all.length / 3; im.instanceMatrix.needsUpdate = true; win.needsUpdate = true; stat.live = im.count;
    };
    let at = [1e12, 1e12, 1e12];
    (function tick() {
      const c = camera.position;
      if (Math.hypot(c.x - at[0], c.y - at[1], c.z - at[2]) > 0.5) {
        at = [c.x, c.y, c.z]; const r = RAD + TILE, need = new Set();
        for (let j = Math.floor((c.y - r) / TILE); j <= Math.floor((c.y + r) / TILE); j++) for (let i = Math.floor((c.x - r) / TILE); i <= Math.floor((c.x + r) / TILE); i++) {
          const key = i + ':' + j; need.add(key); if (!tiles.has(key)) tiles.set(key, inTile(i, j));
        }
        for (const key of [...tiles.keys()]) if (!need.has(key)) tiles.delete(key);
        stat.tiles = tiles.size; assign();
      }
      requestAnimationFrame(tick);
    })();
    // the static litter dissolves inside the carpet (dithered across its last fifth)
    const CU = { uCam: { value: camera.position }, uFade: { value: new THREE.Vector2(0.8 * RAD, RAD) } };
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.g !== 'isekai:petals' || !o.material || !o.material.map) return;
      const mat2 = o.material.clone(); mat2.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, CU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec3 vMojW;').replace('#include <begin_vertex>', '#include <begin_vertex>\\nvMojW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\nvarying vec3 vMojW; uniform vec3 uCam; uniform vec2 uFade;')
          .replace('void main() {', 'void main() {\\n  { float d = distance(vMojW, uCam), f = clamp((d - uFade.x) / (uFade.y - uFade.x), 0.0, 1.0); if (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) >= f) discard; }');
      };
      mat2.customProgramCacheKey = () => 'mojulo-petal-litter'; o.material = mat2;
    });
    carpet = { tiles, stat, mesh: () => im };
  }
  window.__mojStagePetals = { n: NF, fall, carpet };
})();
`;

/** `cfg`: { grid: { x0, y0, cell, nx, ny, zlo, zsc, z (Int16 b64), m (Uint8 b64) }, ramp, win: { lit, shade }, templates:
 *  [{ lo, sc, q, H, tris }], variants: [{ L2, L1, L0 }], size, radius, near, tile, density, height, px, drawTris, seed,
 *  sheen, contact?: { …GRASS_CONTACT_DEFAULTS, eye }, real?: { ao, back, dry, sun, sunColor }, taker, cards: [group],
 *  crowns: { groups, phi, reach, flutter, from, full } | null, wind } */
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
${terrainWindScript(wind)}${FIELD({ contact: !!cfg.contact, real: !!cfg.real, flowers: !!cfg.flowers }).replace('__LG', 'window.__mojStageLG').replace('(__GC)', () => `(${grassContact.toString()})`)}${CROWNS.replace('__LG', 'window.__mojStageLG').replace('__WIND_AT', safeJson(WIND_AT_GLSL))}${cfg.petals ? PETALS.replace('__LG', 'window.__mojStageLG').replace('__WIND_AT', safeJson(WIND_AT_GLSL)) : ''}`;
}
