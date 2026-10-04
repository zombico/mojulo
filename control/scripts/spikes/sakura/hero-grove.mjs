// SPIKE sakura hero: a cherry grove in bloom built from the ground up, the way the lignification spike built its hero oak.
// Not a terrain World page: a small standalone scene, one avenue of cherries, lit and drawn for the close look.
//   · the trees are GROWN (vegetation/grow.js, the `cherry` species: Rauh made decurrent, two years of spurs, a hand that
//     sweeps its limbs one way round and winds its leader, smoothed between nodes), K variants;
//   · a tree near the eye keeps every axis (bark quads on the trunk and limbs, the ladder's L3) and its leaves become what
//     a Somei-yoshino carries in bloom instead: flowering spurs along its young shoots and older twigs, an umbel of three
//     to five flowers on each (vegetation/blossom.js, a flower from its parts, fractal-edged petals), nodding outward;
//   · each tree takes its level by distance, the pool's rule: the flowers are drawn whole within a few metres of the eye,
//     past that as their footprints (one lit disc a flower, facing the eye; facing the sun in the shadow pass), and past
//     the middle distance the tree is the pool's L1 (the crown's clusters recoloured in bloom);
//   · the lawn is the production lawn tuft (vegetation/grass.js);
//   · one wind (vegetation/wind.js windField, inlined): it sways each tree at its own first frequency, flutters the
//     flowers, combs the lawn, and carries the petals (debrisKernel), released from the hero trees' own flowers;
//   · the light: a low sun with soft shadows, sky light, petals lit as thin sheets (light through them when backlit),
//     the frame drawn in HDR through bloom, ACES and a sun halo.
//   node scripts/spikes/sakura/hero-grove.mjs /absolute/out.html [speed m/s = 6] [petals = 6000]
import { writeFileSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { grow, measure, ARCHITECTURES, mulberry32, vec } = await import('../../../lib/graph/vegetation/grow.js');
const { SPECIES } = await import('../../../lib/graph/vegetation/species.js');
const { ladder } = await import('../../../lib/graph/vegetation/ladder.js');
const { leafTris } = await import('../../../lib/graph/vegetation/tree-mesh.js');
const { barkTile } = await import('../../../lib/graph/vegetation/tiles.js');
const { grassTuft, GRASSES } = await import('../../../lib/graph/vegetation/grass.js');
const { windField, debrisKernel, WIND_TAKERS } = await import('../../../lib/graph/vegetation/wind.js');
const { inlineImportmap } = await import('../../../lib/graph/scene/emit-util.js');
const { flowerGeometry, bloomFlowers, BLOOM_DEFAULTS } = await import('../../../lib/graph/vegetation/blossom.js');
const PETAL = BLOOM_DEFAULTS.petal;
const { add, sub, mul, cross, unit } = vec;

const [out = 'scripts/spikes/sakura/hero-grove.html', speedArg = '6', petalsArg = '6000'] = process.argv.slice(2);
// the grove's trees are not one tree scaled: each variant is grown to its own age, some in the open and some in a
// stand (the neighbours' shade starves the low limbs and the crown lifts), so height, girth and the clear trunk below
// the first limb come out of growth. Measured on the cherry: 7 y ≈ 4 m, dbh 5 cm; 21 y ≈ 6 m, dbh 20+ cm; an open-grown
// tree forks at about half a metre, one in a stand at 1–2.5 m. `w`: how often it is planted.
const AGES = [{ years: 7, stand: 0, w: 1 }, { years: 10, stand: 0, w: 2 }, { years: 12, stand: 0.15, w: 2 }, { years: 14, stand: 0.35, w: 2 }, { years: 17, stand: 0.35, w: 1.5 }, { years: 21, stand: 0, w: 1 }];
const K = AGES.length, DEG = Math.PI / 180, t0 = performance.now();
const S = SPECIES.cherry, B = S.bloom;
const hashSeed = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const lin = (c) => c.map((v) => Math.pow(Math.max(0, Math.min(1, v / 255)), 2.2));
const b64 = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64');
// compact encodings (the page decodes them): positions and uv as 16 bits over their own range, normals as 8-bit
// signed, colour as 8 bits in sRGB (decoded back to linear), flags as 8 bits
const enc = {
  q16(a, d) { a = Float32Array.from(a); const min = [...Array(d)].map(() => Infinity), max = min.map(() => -Infinity); for (let i = 0; i < a.length; i++) { const k = i % d; min[k] = Math.min(min[k], a[i]); max[k] = Math.max(max[k], a[i]); }
    const q = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) { const k = i % d, r = max[k] - min[k] || 1; q[i] = Math.round(((a[i] - min[k]) / r) * 65535); }
    return { e: 'q16', d, min, max, b: Buffer.from(q.buffer).toString('base64') }; },
  i8(a) { return { e: 'i8', b: Buffer.from(Int8Array.from(a, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 127)).buffer).toString('base64') }; },
  u8g(a) { return { e: 'u8g', b: Buffer.from(Uint8Array.from(a, (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255))).toString('base64') }; },
  u8(a) { return { e: 'u8', b: Buffer.from(Uint8Array.from(a, (v) => Math.round(Math.max(0, Math.min(1, v)) * 255))).toString('base64') }; },
};
const mesh = (g) => ({ pos: enc.q16(g.pos, 3), nrm: enc.i8(g.nrm), ...(g.col ? { col: enc.u8g(g.col) } : {}), ...(g.uv ? { uv: enc.q16(g.uv, 2) } : {}), ...(g.base ? { base: enc.q16(g.base, 3) } : {}), ...(g.part ? { part: enc.u8(g.part) } : {}) });

// ── the ground, shared with the page ─────────────────────────────────────────────────────────────────────────────
const groundAt = (x, y) => 0.22 * Math.sin(0.06 * x + 0.6) * Math.cos(0.045 * y) + 0.07 * Math.sin(0.21 * x - 0.15 * y) + 0.004 * y * Math.abs(y) / 6;

// ── bloom: the ladder's leaf faces recoloured between the blossom's tones by their own baked tone (as pool.js does) ──
const bloomTris = (tris, deeper = 0) => tris.map((t, i) => {
  if (t.kind !== 'leaf') return t.c[1] > t.c[0] ? { ...t, c: [0.55 * t.c[0] + 40, 0.45 * t.c[1] + 26, 0.5 * t.c[2] + 30] } : t;
  const lum = (t.c[0] * 0.3 + t.c[1] * 0.59 + t.c[2] * 0.11) / 160, j = ((i * 2654435761) >>> 0) / 4294967296 - 0.5, k = Math.max(0, Math.min(1, lum + 0.35 * j - deeper));
  return { ...t, c: k < 0.5 ? B.deep.map((v, n) => v + (B.petal[n] - v) * 2 * k) : B.petal.map((v, n) => v + (B.lit[n] - v) * (2 * k - 1)) };
});

// ── packing: triangles → flat arrays (linear colour). Bark quads carry uv and smooth outward normals; a blob's
// normals point out from its own centre (20 faces a blob); a twig's are its face's ─────────────────────────────────
function packWood(tris) {
  const plain = { pos: [], nrm: [], col: [] }, bark = { pos: [], nrm: [], uv: [] }, acc = new Map(), key = (p) => p.map((v) => Math.round(v * 1e4)).join(',');
  for (const t of tris) if (t.q) for (const v of t.q) { const k = key(v), a = acc.get(k) || [0, 0, 0]; acc.set(k, add(a, t.n)); }
  for (const t of tris) {
    if (t.q) { for (const i of [0, 1, 2, 0, 2, 3]) { bark.pos.push(...t.q[i]); bark.nrm.push(...unit(acc.get(key(t.q[i])))); bark.uv.push(...t.uv[i]); } continue; }
    if (t.kind === 'leaf') continue;
    const n = unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))), c = lin(t.c);
    for (const v of t.p) { plain.pos.push(...v); plain.nrm.push(...n); plain.col.push(...c); }
  }
  return { plain: mesh(plain), bark: mesh(bark) };
}
function packBlobs(tris, shrink = 1) {
  const leaf = tris.filter((t) => t.kind === 'leaf'); if (leaf.length % 20) throw new Error('blobs are 20 faces each');
  const pos = [], nrm = [], col = [], base = [];
  for (let g = 0; g < leaf.length; g += 20) {
    const grp = leaf.slice(g, g + 20); let c = [0, 0, 0]; for (const t of grp) for (const v of t.p) c = add(c, mul(v, 1 / 60));
    for (const t of grp) { const cl = lin(t.c); for (const v of t.p) { const d = sub(v, c); pos.push(...add(c, mul(d, shrink))); nrm.push(...unit(d)); col.push(...cl); base.push(...c); } }
  }
  return mesh({ pos, nrm, col, base });
}
// leaves at their own size (about 9 cm; the ladder's are drawn larger, for a crown seen whole) for the leaf-out: each
// grows from its base, its first corner; young cherry leaves are bronze-green
function packLeaves(tris) {
  const pos = [], nrm = [], col = [], base = [];
  for (const t of tris) { if (t.kind !== 'leaf') continue; let n = unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))); if (n[2] < 0) n = mul(n, -1); const c = lin(mix3(t.c, [150, 120, 70], 0.25)); for (const v of t.p) { pos.push(...v); nrm.push(...n); col.push(...c); base.push(...t.p[0]); } }
  return mesh({ pos, nrm, col, base });
}
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ── grow the variants ────────────────────────────────────────────────────────────────────────────────────────────
const arch = { ...ARCHITECTURES[S.arch], ...S.over, leafLife: S.leafLife };
const tile = barkTile(S.bark), bark = { minR: 0.03, tile: tile.metres, color: tile.mean, key: tile.key };
const variants = [];
for (let k = 0; k < K; k++) {
  const sd = hashSeed(`hanami::cherry::${k}`) % 100000, p = grow(arch, { years: AGES[k].years, seed: sd, stand: AGES[k].stand }), m = measure(p), H = m.height;
  const lad = ladder(p, H, { leafScale: S.leafScale, bark, fill: B.fill });
  const fl = bloomFlowers(p, { seed: sd ^ 0x9e3779b9 });
  const L2 = bloomTris(lad.L2), L1 = bloomTris(lad.L1);
  variants.push({ H, hero: { wood: packWood(bloomTris(lad.L3.filter((t) => t.kind !== 'leaf'))), leaves: packLeaves(leafTris(p, { scale: 0.85 })), flowers: Buffer.from(fl.buffer).toString('base64'), nFlowers: fl.length / 9 },
    L2: { wood: packWood(L2), leaves: packBlobs(lad.L2) }, L1: { wood: packWood(L1), blobs: packBlobs(L1), leaves: packBlobs(lad.L1) },
    tris: { L3wood: lad.L3.filter((t) => t.kind !== 'leaf').length, L2: lad.L2.length, L1: lad.L1.length } });
  console.log(`variant ${k}: ${AGES[k].years} y${AGES[k].stand ? ` in a stand ${AGES[k].stand}` : ''}, ${H.toFixed(2)} m, dbh ${(m.dbh * 100).toFixed(1)} cm, ${fl.length / 9} flowers, tris ${JSON.stringify(variants.at(-1).tris)}`);
}

// ── the grove: an avenue along x, rows of cherries either side ─────────────────────────────────────────────────────
const trees = [], rr = mulberry32(77), WSUM = AGES.reduce((a, g) => a + g.w, 0);
const pickAge = (u) => { let t = u * WSUM; for (let k = 0; k < K; k++) { t -= AGES[k].w; if (t < 0) return k; } return K - 1; };
for (const side of [-1, 1]) for (let row = 0; row < 6; row++) {
  const y0 = side * (4.4 + row * 6.0);
  for (let x = -42 + (row % 2) * 3.1; x <= 42; x += 6.2) {
    if (rr() < 0.08 * row) continue;
    const px = x + 1.1 * (rr() - 0.5), py = y0 + 1.1 * (rr() - 0.5), v = pickAge(rr()), s = 0.93 + 0.14 * rr(), yaw = 2 * Math.PI * rr();
    trees.push([px, py, groundAt(px, py) - 0.04, yaw, s, v]);
  }
}

// ── the flower at its levels, one petal for the wind, a lawn tuft ─────────────────────────────────────────────────
const fg = (o) => { const g = flowerGeometry(o); return { ...mesh({ pos: g.pos, nrm: g.nrm, col: g.col.map((v) => Math.pow(v, 2.2)), part: g.part }), tris: g.pos.length / 9 }; };
const flowerLevels = [fg({ seed: 11, depth: 3 }), fg({ seed: 12, depth: 1 }), fg({ seed: 13, mid: true })];
const petal = fg({ seed: 15, depth: 2, single: true });
const tuft = (level) => {
  const tris = grassTuft('lawn', { seed: 3, level }), g = { pos: [], nrm: [], col: [] };
  for (const t of tris) { let n = t.n || unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))); if (n[2] < 0) n = mul(n, -1); for (const v of t.p) { g.pos.push(...v); g.nrm.push(...n); g.col.push(...lin(t.c)); } }
  return { ...mesh(g), tris: tris.length };
};
const lawnNear = tuft('L1'), lawnFar = tuft('L0');

const T = WIND_TAKERS.tree, speed = Number(speedArg);
const data = {
  sun: unit([-0.62, 0.5, 0.36]), bark: { url: tile.url, metres: tile.metres },
  variants, trees, petal: PETAL,
  flowerLevels, petalGeo: petal, lawn: { near: lawnNear, far: lawnFar, H: GRASSES.lawn.H },
  wind: { speed, dir: 20 * DEG, gust: 0.7, scale: 10, evolve: 6, veer: 20 * DEG, seed: 7, z0: 0.05 },
  taker: { B: T.B, sail: T.sail, vogel: T.vogel, zeta: T.zeta, phi: 1 },
  debris: { seed: 7, phi: 1, leaves: 0, dust: 0, petals: Number(petalsArg), radius: 24 },
  season: Number(process.env.SEASON || 0.42), mood: process.env.MOOD || 'afternoon',
};
const page = readFileSync(new URL('./hero-grove.page.js', import.meta.url), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cherry grove, hero</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#cfd9e6;font:13px/1.35 system-ui,sans-serif}#ui{position:fixed;left:12px;top:12px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 24px)}#ui button{border:0;border-radius:6px;padding:6px 10px;background:rgba(20,24,30,.55);color:#fff;cursor:pointer}#ui button:hover{background:rgba(20,24,30,.8)}#ui select,#ui input{accent-color:#e89ab0}#ui label{display:flex;align-items:center;gap:6px;border-radius:6px;padding:4px 10px;background:rgba(20,24,30,.55);color:#fff}#ui select{border:0;border-radius:4px;background:#fff2;color:#fff}#ui select option{color:#000}#hud{position:fixed;right:12px;bottom:10px;color:#fff;text-shadow:0 1px 2px #0008;font-variant-numeric:tabular-nums}</style>
<script>addEventListener('error', (e) => { const d = document.getElementById('err') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'err' })); d.style.cssText = 'position:fixed;left:12px;bottom:30px;color:#b00;background:#fff;padding:6px;white-space:pre-wrap;max-width:90%'; d.textContent += (e.message || e) + ' @' + e.lineno + '\\n'; });</script>
<script type="importmap">${inlineImportmap()}</script></head><body><div id="ui"></div><div id="hud"></div>
<script type="application/json" id="grove-data">${JSON.stringify(data)}</script>
<script type="module">
const windField = ${windField.toString()};
const debrisKernel = ${debrisKernel.toString()};
const groundAt = ${groundAt.toString()};
${page}
</script></body></html>`;
writeFileSync(out, html);
console.log(`${trees.length} trees; ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB; flower tris by level ${flowerLevels.map((f) => f.tris).join('/')}, petal ${petal.tris}, lawn tuft ${lawnNear.tris}/${lawnFar.tris}; ${Math.round(performance.now() - t0)} ms → ${out}`);
