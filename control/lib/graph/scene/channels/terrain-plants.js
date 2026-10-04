import { safeJson } from '../emit-util.js';

// In-page script: the terrain world's PLANTS (opt-in: the terrain channel's `plants`, terrain-plants.js). The page carries
// the plant kernel's source (vegetation-kernel.js) and inputs, and a few grown templates per species, not the plants: it
// places them itself, tile by tile around the camera, from the same ground kernel the terrain channel meshes with, so
// the page and the server stand the same plants in the same places.
//   · Tiles of `tile` metres within `radius` of the camera (less the eye's height), nearest first, within `budgetMs` a
//     frame, in frames where the ground built nothing (the ground refines first; at most three frames' wait); far
//     tiles are dropped.
//   · Each plant picks its variant as the pool does (a tree by its pick, one grown at several ages by its height in its
//     species' range, a palm or a culm by its height, a first-year culm
//     its wax variant, a culm leaning out of its clump the variant leaning its way) and its level by its size on screen:
//     L2 ≥ px.L2, L1 ≥ px.L1, L0 ≥ px.L0, else the far level LF. Past `drawTris` triangles in all, every size is scaled by
//     the largest k that fits (the boundaries move outward together); past that, the farthest go. A culm's age rides as
//     its instance tint.
//   · A template's meshes are made when a plant first needs it: one InstancedMesh for its plain faces and one per texture
//     (bark, a palm's trunk) drawn texel × baked light, sharing the instances. At most `cap` plants are live, the
//     nearest tiles first. Plants are not walk colliders.
//   · A tree in bloom (a variant with `fl`, cfg `discs`) at L1 or L2 is its bare wood (template B1, B2) and its flowers, one disc
//     each (four corners at its centre, offset facing the eye after instancing and after the wind bends it, the five
//     lobes cut in the fragment, never over about ten pixels across, so a flower at the eye is not a coin; its colour lit when the pool was grown), up to `discs` flowers, the largest on screen
//     first; past that the tree keeps its clusters. Absent `discs` ⇒ none of that is emitted.
// Absent `plants` ⇒ NOT emitted. `wind` (the terrain has a wind channel): every part of a template (its plain faces, its
// bark) bends in window.__mojTerrain.wind by its species' kind, as one cantilever its variant's height; absent ⇒ none of that is emitted.
// `cfg`: { kernel: source text, V, species: [{ name, kind, variants: [{ h, wax?, lean?, az?, t: { LF, L0, L1?, L2? } }],
//          tint? }], templates: [{ lo, sc, q, col, tris, tex?: [{ key, q, col, uv, lit }] }], textures, levels, radius, tile,
//          px: { L2, L1, L0 }, cap, drawTris, budgetMs }
export function terrainPlantsScript(cfg, wind = false) {
  const { kernel, ...rest } = cfg; const D = !!cfg.discs, AGES = cfg.species.some((sp) => sp.byH);
  return `
// --- terrain plants (opt-in): the recipe's plants, placed and levelled around the camera ---
const PLANTS = ${safeJson(rest)};
const __pKernel = (${kernel});
(function () {
  const TW = window.__mojTerrain; if (!TW) return;
  const PK = __pKernel(PLANTS.V, TW.kernel), PER = 9, SP = PLANTS.species, PX = PLANTS.px, TILE = PLANTS.tile, RAD = PLANTS.radius;
  const dec = (v) => { const s = atob(v.__b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new self[v.t](u.buffer); };
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const unq = (t, q) => { const out = new Float32Array(q.length); for (let i = 0; i < q.length; i++) { const k = i % 3; out[i] = t.lo[k] + (q[i] + 32768) * t.sc[k]; } return out; };
  const texCache = {};
  const texOf = (key) => { if (texCache[key]) return texCache[key]; const url = PLANTS.textures[key]; if (!url) return null; const tx = new THREE.TextureLoader().load(url); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; return (texCache[key] = tx); };
  const geoOf = (t, q, col, uv) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(unq(t, dec(q)), 3));
    const c8 = dec(col), c = new Float32Array(c8.length); for (let i = 0; i < c8.length; i++) c[i] = LIN[c8[i]]; g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(dec(uv), 2)); g.computeBoundingSphere(); return g;
  };
  const matPlain = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const MESH = new Map();                                   // template id → { parts, im, cap, n, list }${wind ? "\n  const OF = []; SP.forEach((sp, si) => sp.variants.forEach((v) => Object.values(v.t).forEach((id) => { OF[id] = [si, v.h]; })));   // template → [species, height], for the wind" : ''}
  function meshOf(id) {
    let m = MESH.get(id); if (m) return m;
    const t = PLANTS.templates[id]; const parts = [{ geo: geoOf(t, t.q, t.col), mat: matPlain }];
    for (const x of (t.tex || [])) { const tx = texOf(x.key); if (tx) parts.push({ geo: geoOf(t, x.q, x.col, x.uv), mat: new THREE.MeshBasicMaterial({ map: tx, vertexColors: !!x.lit, side: THREE.DoubleSide }) }); }
${wind ? "    if (TW.wind && OF[id]) for (const p of parts) p.mat = TW.wind.material(p.mat, TW.wind.cfg.plants[OF[id][0]], OF[id][1]);\n" : ''}    m = { parts, im: [], cap: 0, n: 0, list: [] }; MESH.set(id, m); return m;
  }${D ? `
  // the flowers of a tree in bloom as discs: one mesh a variant, its instances the trees drawn with it
  const DISC = new Map();
  const DISC_PATCH = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nattribute vec2 aCorner; attribute float aSize; varying vec2 vCorner;')
      .replace('mvPosition = modelViewMatrix * mvPosition;', 'mvPosition = modelViewMatrix * mvPosition;\\n#ifdef USE_INSTANCING\\n{ float dc = -mvPosition.z; mvPosition.xy += aCorner * min(aSize * length(instanceMatrix[0].xyz) * 1.25 * (1.0 + 0.8 * smoothstep(15.0, 45.0, dc)), 0.012 * dc); vCorner = aCorner; }\\n#endif');
    sh.fragmentShader = 'varying vec2 vCorner;\\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\\n{ float rr = length(vCorner), th = atan(vCorner.y, vCorner.x); if (rr > 0.72 + 0.28 * abs(cos(2.5 * th))) discard; }');
  };
  const PLAIN_PROJECT = 'vec4 mvPosition = vec4( transformed, 1.0 );\\n#ifdef USE_INSTANCING\\n\\tmvPosition = instanceMatrix * mvPosition;\\n#endif\\nmvPosition = modelViewMatrix * mvPosition;\\ngl_Position = projectionMatrix * mvPosition;\\n';
  // at L1 a flower is under a pixel: every third one, √3 the size, covers as much
  function discOf(v, si, stride) {
    const key = v.t.LF + ':' + stride; let m = DISC.get(key); if (m) return m;
    const F = v.fl, n = Math.ceil(F.n / stride), grow = Math.sqrt(stride), q = dec(F.q), sz = dec(F.s), c8 = dec(F.c), pos = new Float32Array(12 * n), col = new Float32Array(12 * n), cor = new Float32Array(8 * n), siz = new Float32Array(4 * n), idx = new Uint32Array(6 * n), C = [-1, -1, 1, -1, 1, 1, -1, 1];
    for (let i = 0; i < n; i++) {
      const f = i * stride, x = F.lo[0] + (q[3 * f] + 32768) * F.sc[0], y = F.lo[1] + (q[3 * f + 1] + 32768) * F.sc[1], z = F.lo[2] + (q[3 * f + 2] + 32768) * F.sc[2], r = grow * (sz[f] / 255) * F.smax;
      for (let k = 0; k < 4; k++) { const o = 4 * i + k; pos[3 * o] = x; pos[3 * o + 1] = y; pos[3 * o + 2] = z; col[3 * o] = LIN[c8[3 * f]]; col[3 * o + 1] = LIN[c8[3 * f + 1]]; col[3 * o + 2] = LIN[c8[3 * f + 2]]; cor[2 * o] = C[2 * k]; cor[2 * o + 1] = C[2 * k + 1]; siz[o] = r; }
      idx.set([4 * i, 4 * i + 1, 4 * i + 2, 4 * i, 4 * i + 2, 4 * i + 3], 6 * i);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2)); g.setAttribute('aSize', new THREE.BufferAttribute(siz, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    let mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }); mat.userData.mojPatch = DISC_PATCH; mat.userData.mojKey = '-disc';
    mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', PLAIN_PROJECT); DISC_PATCH(sh); }; mat.customProgramCacheKey = () => 'mojulo-disc';${wind ? "\n    if (TW.wind) mat = TW.wind.material(mat, TW.wind.cfg.plants[si], v.h);" : ''}
    m = { parts: [{ geo: g, mat }], im: [], cap: 0, n: 0, list: [], flowers: n }; DISC.set(key, m); return m;
  }` : ''}
  function ensure(m, need) {
    if (need <= m.cap) return;
    for (const im of m.im) { scene.remove(im); im.dispose(); }
    const cap = Math.max(need, Math.ceil(m.cap * 1.5), 16);
    m.im = m.parts.map((p) => { const im = new THREE.InstancedMesh(p.geo, p.mat, cap); im.count = 0; im.frustumCulled = false; im.userData.g = 'plants'; scene.add(im); return im; }); m.cap = cap;
  }
  function variantOf(sp, h, pick, age, lean, az) {
    const VS = sp.variants;
${AGES ? `    if (sp.byH) { const t = (h - sp.byH[0]) / (sp.byH[1] - sp.byH[0]) + 0.3 * (pick - 0.5), v = VS[sp.rank[Math.max(0, Math.min(VS.length - 1, Math.floor(t * VS.length)))]]; return [v, h / v.h]; }
` : ''}    if (sp.kind === 'tree' || sp.kind === 'tuft') { const v = VS[Math.min(VS.length - 1, Math.floor(pick * VS.length))]; return [v, h / v.h]; }
    const young = age >= 0 && age < 1, leaning = sp.kind === 'culm' && !young && lean > 9 && VS.some((v) => v.lean);
    let best = null, bs = Infinity;
    for (const v of VS) {
      if (sp.kind === 'culm' && (!!v.wax !== young || !!v.lean !== leaning)) continue;
      const d = Math.abs(Math.log(h / v.h)) + (leaning ? Math.abs(((az - v.az + 540) % 360) - 180) / 30 + Math.abs(lean - v.lean) / 6 : 0);
      if (d < bs) { bs = d; best = v; }
    }
    if (!best) best = VS[0]; return [best, Math.max(0.92, Math.min(1.08, h / best.h))];
  }
  const tiles = new Map(), stat = { tiles: 0, live: 0, levels: { LF: 0, L0: 0, L1: 0, L2: 0 }, buildMs: 0, assignMs: 0, templates: 0 };
  TW.plants = { tiles, meshes: MESH, stat, kernel: PK };
  const eyeAlt = () => Math.max(0, camera.position.z - TW.kernel.groundAt(camera.position.x, camera.position.y));
  function wanted() {
    const c = camera.position, rh = Math.sqrt(Math.max(0, RAD * RAD - eyeAlt() ** 2)), out = [];
    for (let j = Math.floor((c.y - rh) / TILE); j <= Math.floor((c.y + rh) / TILE); j++) for (let i = Math.floor((c.x - rh) / TILE); i <= Math.floor((c.x + rh) / TILE); i++) {
      const dx = Math.max(0, Math.abs((i + 0.5) * TILE - c.x) - TILE / 2), dy = Math.max(0, Math.abs((j + 0.5) * TILE - c.y) - TILE / 2), d = Math.sqrt(dx * dx + dy * dy);
      if (d <= rh) out.push([i, j, d]);
    }
    return out.sort((a, b) => a[2] - b[2]);
  }
  const M4 = new THREE.Matrix4(), COL = new THREE.Color();
  const trisOf = (v, lv) => PLANTS.templates[v.t[lv]].tris;
  function assign() {
    const t0 = performance.now(), c = camera.position, f = window.innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const m of MESH.values()) m.n = 0; for (const k in stat.levels) stat.levels[k] = 0;
    // every plant in reach: its variant, scale, size on screen and level
    const all = []; let tris = 0;
    const order = [...tiles.values()].sort((a, b) => a.d - b.d);
    for (const tl of order) {
      const a = tl.a; if (all.length + a.length / PER > PLANTS.cap) break;
      for (let q = 0; q < a.length; q += PER) {
        const x = a[q], y = a[q + 1], z = a[q + 2], h = a[q + 3], sp = SP[a[q + 4]];
        const d = Math.hypot(x - c.x, y - c.y, z + h / 2 - c.z); if (d > RAD) continue;
        const vs = variantOf(sp, h, a[q + 5], a[q + 6], a[q + 7], a[q + 8]), v = vs[0], s = vs[1], px = (v.h * s * f) / d;
        all.push({ x, y, z, s, v, px, lv: 'LF',${D ? ' si: a[q + 4],' : ''} tint: sp.tint && a[q + 6] >= 1 ? sp.tint[Math.min(9, a[q + 6])] : null });
      }
    }
    // the levels by size on screen, every size scaled by k: the largest k whose plants fit the draw budget, so the
    // ladder's boundaries move outward together and the nearest plants keep the most detail
    const lvOf = (e, k) => { const px = e.px * k, t = e.v.t; return px >= PX.L2 && t.L2 !== undefined ? 'L2' : px >= PX.L1 && t.L1 !== undefined ? 'L1' : px >= PX.L0 ? 'L0' : 'LF'; };
    const cost = (k) => { let n = 0; for (const e of all) n += trisOf(e.v, lvOf(e, k)); return n; };
    let k = 1;
    if (cost(1) > PLANTS.drawTris) { let lo = 0.01, hi = 1; for (let it = 0; it < 14; it++) { const mid = Math.sqrt(lo * hi); if (cost(mid) > PLANTS.drawTris) hi = mid; else lo = mid; } k = lo; }
    for (const e of all) { e.lv = lvOf(e, k); tris += trisOf(e.v, e.lv); }
    // still over with everything far: the farthest go
    if (tris > PLANTS.drawTris) { all.sort((a, b) => b.px - a.px); while (all.length && tris > PLANTS.drawTris) { const e = all.pop(); tris -= trisOf(e.v, e.lv); } }
    stat.k = k;${D ? `
    // trees in bloom at L1 and L2: their flowers as discs, the largest on screen first, while the flowers fit
    for (const m of DISC.values()) m.n = 0; let discLeft = PLANTS.discs; stat.discs = 0;
    for (const e of all.filter((e) => (e.lv === 'L2' || e.lv === 'L1') && e.v.fl).sort((a, b) => b.px - a.px)) { const cost = Math.ceil(e.v.fl.n / (e.lv === 'L2' ? 1 : 3)); if (cost > discLeft) break; discLeft -= cost; stat.discs += cost; e.disc = true; }` : ''}
    for (const e of all) { const m = meshOf(${D ? "e.disc ? e.v.t['B' + e.lv[1]] : " : ''}e.v.t[e.lv]); m.list[m.n++] = e; stat.levels[e.lv]++;${D ? ' if (e.disc) { const dm = discOf(e.v, e.si, e.lv === "L2" ? 1 : 3); dm.list[dm.n++] = e; }' : ''} }
    for (const m of ${D ? '[...MESH.values(), ...DISC.values()]' : 'MESH.values()'}) {
      ensure(m, m.n);
      for (let p = 0; p < m.im.length; p++) {
        const im = m.im[p];
        for (let i = 0; i < m.n; i++) { const e = m.list[i]; M4.makeScale(e.s, e.s, e.s).setPosition(e.x, e.y, e.z - 0.05); im.setMatrixAt(i, M4); if (p === 0 && e.tint) im.setColorAt(i, COL.setRGB(e.tint[0], e.tint[1], e.tint[2])); else if (p === 0 && im.instanceColor) im.setColorAt(i, COL.setRGB(1, 1, 1)); }
        im.count = m.n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
    stat.live = all.length; stat.tris = tris; stat.templates = MESH.size; stat.assignMs = performance.now() - t0;
  }
  let plan = null, planAt = [1e12, 1e12, 1e12], assignedAt = [1e12, 1e12, 1e12], lastAssign = -1e9, groundBuilt = -1, waited = 0;
  function tick() {
    const now = performance.now(), c = camera.position;
    if (!plan || Math.hypot(c.x - planAt[0], c.y - planAt[1], c.z - planAt[2]) > TILE / 4) { plan = wanted(); planAt = [c.x, c.y, c.z]; }
    // the ground refines first: a frame it built in, the plants wait, but never more than three frames running
    let built = 0; const gb = TW.stat.built, groundBusy = gb !== groundBuilt && waited < 3; groundBuilt = gb; waited = groundBusy ? waited + 1 : 0;
    if (!groundBusy) for (const [i, j] of plan) {
      if (performance.now() - now > PLANTS.budgetMs) break; const k = i + ':' + j; if (tiles.has(k)) continue;
      const t0 = performance.now(); tiles.set(k, { i, j, d: 0, a: PK.plantsIn(i * TILE, j * TILE, TILE) }); stat.buildMs += performance.now() - t0; built++;
    }
    for (const [k, tl] of tiles) {
      const dx = Math.max(0, Math.abs((tl.i + 0.5) * TILE - c.x) - TILE / 2), dy = Math.max(0, Math.abs((tl.j + 0.5) * TILE - c.y) - TILE / 2); tl.d = Math.sqrt(dx * dx + dy * dy);
      if (tl.d > RAD + 2 * TILE) tiles.delete(k);
    }
    stat.tiles = tiles.size;
    if (built || (Math.hypot(c.x - assignedAt[0], c.y - assignedAt[1], c.z - assignedAt[2]) > 5 && now - lastAssign > 250)) { assign(); lastAssign = now; assignedAt = [c.x, c.y, c.z]; }
    requestAnimationFrame(tick);
  }
  tick();
})();
`;
}
