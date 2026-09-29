import { safeJson } from '../emit-util.js';

// In-page script: the terrain world's GRASS (opt-in: the terrain channel's `grass`, terrain/terrain-grass.js). Like the
// plants' script, the page carries the grass kernel's source and a few grown tufts a kind, and stands the tufts itself,
// tile by tile around the camera, from the same ground kernel. Grass is a near field, and it keeps its illusion the way
// Fox Engine (MGSV) and Ghost of Tsushima do: thinning by size with distance, and dissolving into the ground.
//   · size bands: a tuft's `near` grows with its height (a fescue tuft thins from 6 m, elephant grass from 36 m); within it
//     every tuft stands; past it a tuft stands while its stable rank is under (near/d)², so a patch of screen keeps about
//     the same tufts, and the survivors widen by 1/√keep, at most 1.8×. Over the last quarter of its threshold a tuft
//     shrinks toward nothing, and at the radius all do: nothing pops.
//   · the ground tint: with distance a tuft's colour is drawn toward the ground's colour under its root (instance colour
//     × the ratio of the ground's to the template's mean), so the far survivors are the meadow, not dots on it. Near, the
//     clump's own shade (the kernel's tint, 0–9) is kept.
//   · a clump's lean (the kernel's lean and az) tilts the tuft whole: the light is baked, and the leans are small.
//   · each tuft's level comes from its size on screen (L2, L1, L0, else LF, at `px`); past `drawTris` triangles in all,
//     every size is scaled by the largest k that fits.
// Registers as window.__mojTerrain.grass. Absent `grass` ⇒ NOT emitted.
// `cfg`: { kernel: source text, V, species: [{ name, variants: [{ h, t: { LF, L0, L1, L2 } }] }], templates: [{ lo, sc, q,
//          col, tris }], radius, near, tile, px: { L2, L1, L0 }, cap, drawTris, budgetMs }
export function terrainGrassScript(cfg) {
  const { kernel, ...rest } = cfg;
  return `
{
// --- terrain grass (opt-in): the recipe's grass, clumped and decimated around the camera ---
const GRASS = ${safeJson(rest)};
const __gKernel = (${kernel});
(function () {
  const TW = window.__mojTerrain; if (!TW) return;
  const GK = __gKernel(GRASS.V, TW.kernel), PER = 9, SP = GRASS.species, PX = GRASS.px, TILE = GRASS.tile, RAD = GRASS.radius, NEAR = GRASS.near;
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const MESH = new Map();
  function meshOf(id) {
    let m = MESH.get(id); if (m) return m; const t = GRASS.templates[id], q = dec(t.q), c8 = dec(t.col);
    const P = new Float32Array(q.length); for (let i = 0; i < q.length; i++) { const k = i % 3; P[i] = t.lo[k] + (q[i] + 32768) * t.sc[k]; }
    const C = new Float32Array(c8.length); for (let i = 0; i < c8.length; i++) C[i] = LIN[c8[i]];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere();
    const mean = [0, 0, 0]; for (let i = 0; i < C.length; i++) mean[i % 3] += C[i]; for (let k = 0; k < 3; k++) mean[k] = Math.max(1e-4, (3 * mean[k]) / C.length);
    m = { geo: g, im: null, cap: 0, n: 0, list: [], mean }; MESH.set(id, m); return m;
  }
  function ensure(m, need) {
    if (need <= m.cap) return; if (m.im) { scene.remove(m.im); m.im.dispose(); }
    m.cap = Math.max(need, Math.ceil(m.cap * 1.5), 32); m.im = new THREE.InstancedMesh(m.geo, mat, m.cap); m.im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3 * m.cap).fill(1), 3); m.im.count = 0; m.im.frustumCulled = false; m.im.userData.g = 'grass'; scene.add(m.im);
  }
  const tiles = new Map(), stat = { tiles: 0, live: 0, dropped: 0, levels: { LF: 0, L0: 0, L1: 0, L2: 0 }, buildMs: 0, assignMs: 0 };
  TW.grass = { tiles, meshes: MESH, stat, kernel: GK };
  const eyeAlt = () => Math.max(0, camera.position.z - TW.kernel.groundAt(camera.position.x, camera.position.y));
  function wanted() {
    const c = camera.position, rh = Math.sqrt(Math.max(0, RAD * RAD - eyeAlt() ** 2)), out = [];
    for (let j = Math.floor((c.y - rh) / TILE); j <= Math.floor((c.y + rh) / TILE); j++) for (let i = Math.floor((c.x - rh) / TILE); i <= Math.floor((c.x + rh) / TILE); i++) {
      const dx = Math.max(0, Math.abs((i + 0.5) * TILE - c.x) - TILE / 2), dy = Math.max(0, Math.abs((j + 0.5) * TILE - c.y) - TILE / 2), d = Math.sqrt(dx * dx + dy * dy);
      if (d <= rh) out.push([i, j, d]);
    }
    return out.sort((a, b) => a[2] - b[2]);
  }
  // the ground's colour (linear) under each tuft of a tile, read once when the tile is built
  const groundCol = (a) => { const out = new Float32Array((a.length / PER) * 3); for (let q = 0, o = 0; q < a.length; q += PER, o += 3) { const n = TW.kernel.normalAt(a[q], a[q + 1], 1.5), c = TW.kernel.colorAt(a[q], a[q + 1], a[q + 2], n, undefined, 0); out[o] = __tLin(c[0]); out[o + 1] = __tLin(c[1]); out[o + 2] = __tLin(c[2]); } return out; };
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), AX = new THREE.Vector3(), PV = new THREE.Vector3(), SV = new THREE.Vector3(), COL = new THREE.Color(), trisOf = (e, lv) => GRASS.templates[e.v.t[lv]].tris;
  function assign() {
    const t0 = performance.now(), c = camera.position, f = window.innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const m of MESH.values()) m.n = 0; for (const k in stat.levels) stat.levels[k] = 0;
    const all = []; let dropped = 0;
    for (const tl of [...tiles.values()].sort((a, b) => a.d - b.d)) {
      const a = tl.a; if (all.length + a.length / PER > GRASS.cap) break;
      for (let q = 0; q < a.length; q += PER) {
        const x = a[q], y = a[q + 1], z = a[q + 2], h = a[q + 3], pick = a[q + 5], d = Math.hypot(x - c.x, y - c.y, z + h / 2 - c.z); if (d > RAD) continue;
        // size bands, then a stable rank (independent of the variant's pick) against the share this distance keeps
        const near = NEAR * Math.min(3, Math.max(0.5, h / 0.6)), keep = d <= near ? 1 : Math.max(0.04, (near / d) ** 2), rank = (pick * 9.7361 + 0.1307) % 1;
        if (rank >= keep) { dropped++; continue; }
        const sp = SP[a[q + 4]], v = sp.variants[Math.min(sp.variants.length - 1, Math.floor(pick * sp.variants.length))];
        const grow = smooth(0, 0.25 * keep, keep - rank), fade = d > 0.8 * RAD ? Math.max(0, (RAD - d) / (0.2 * RAD)) : 1;
        const s = (h / v.h) * fade * grow, w = Math.min(1.8, 1 / Math.sqrt(keep)); if (s <= 1e-3) continue;
        const o = (q / PER) * 3, gc = tl.g; const tint = 0.9 + 0.022 * a[q + 6], toGround = 0.85 * smooth(0.5 * near, RAD, d);
        all.push({ x, y, z, s, w, v, lean: a[q + 7], az: a[q + 8], tint, toGround, g: [gc[o], gc[o + 1], gc[o + 2]], px: (v.h * s * f) / d, lv: 'LF' });
      }
    }
    const lvOf = (e, k) => { const px = e.px * k; return px >= PX.L2 ? 'L2' : px >= PX.L1 ? 'L1' : px >= PX.L0 ? 'L0' : 'LF'; };
    const cost = (k) => { let n = 0; for (const e of all) n += trisOf(e, lvOf(e, k)); return n; };
    let k = 1; if (cost(1) > GRASS.drawTris) { let lo = 0.01, hi = 1; for (let it = 0; it < 14; it++) { const mid = Math.sqrt(lo * hi); if (cost(mid) > GRASS.drawTris) hi = mid; else lo = mid; } k = lo; }
    let tris = 0; for (const e of all) { e.lv = lvOf(e, k); tris += trisOf(e, e.lv); }
    for (const e of all) { const m = meshOf(e.v.t[e.lv]); m.list[m.n++] = e; stat.levels[e.lv]++; }
    for (const m of MESH.values()) {
      ensure(m, m.n); const im = m.im;
      for (let i = 0; i < m.n; i++) {
        const e = m.list[i], az = (e.az * Math.PI) / 180; AX.set(-Math.sin(az), Math.cos(az), 0); Q.setFromAxisAngle(AX, (e.lean * Math.PI) / 180);
        M4.compose(PV.set(e.x, e.y, e.z - 0.03), Q, SV.set(e.s * e.w, e.s * e.w, e.s)); im.setMatrixAt(i, M4);
        const mix = (k) => e.tint + (e.g[k] / m.mean[k] - e.tint) * e.toGround; im.setColorAt(i, COL.setRGB(mix(0), mix(1), mix(2)));
      }
      im.count = m.n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    }
    stat.k = k; stat.live = all.length; stat.dropped = dropped; stat.tris = tris; stat.templates = MESH.size; stat.assignMs = performance.now() - t0;
  }
  let plan = null, planAt = [1e12, 1e12, 1e12], assignedAt = [1e12, 1e12, 1e12], lastAssign = -1e9, groundBuilt = -1, waited = 0;
  function tick() {
    const now = performance.now(), c = camera.position;
    if (!plan || Math.hypot(c.x - planAt[0], c.y - planAt[1], c.z - planAt[2]) > TILE / 4) { plan = wanted(); planAt = [c.x, c.y, c.z]; }
    let built = 0; const gb = TW.stat.built, groundBusy = gb !== groundBuilt && waited < 3; groundBuilt = gb; waited = groundBusy ? waited + 1 : 0;
    if (!groundBusy) for (const [i, j] of plan) {
      if (performance.now() - now > GRASS.budgetMs) break; const key = i + ':' + j; if (tiles.has(key)) continue;
      const t0 = performance.now(); const a = GK.plantsIn(i * TILE, j * TILE, TILE); tiles.set(key, { i, j, d: 0, a, g: groundCol(a) }); stat.buildMs += performance.now() - t0; built++;
    }
    for (const [key, tl] of tiles) {
      const dx = Math.max(0, Math.abs((tl.i + 0.5) * TILE - c.x) - TILE / 2), dy = Math.max(0, Math.abs((tl.j + 0.5) * TILE - c.y) - TILE / 2); tl.d = Math.sqrt(dx * dx + dy * dy);
      if (tl.d > RAD + 2 * TILE) tiles.delete(key);
    }
    stat.tiles = tiles.size;
    if (built || (Math.hypot(c.x - assignedAt[0], c.y - assignedAt[1], c.z - assignedAt[2]) > 2 && now - lastAssign > 200)) { assign(); lastAssign = now; assignedAt = [c.x, c.y, c.z]; }
    requestAnimationFrame(tick);
  }
  tick();
})();
}
`;
}
