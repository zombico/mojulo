// SPIKE sakura hero: a cherry grove in bloom built from the ground up, the way the lignification spike built its hero oak.
// Not a terrain World page: a small standalone scene, one avenue of cherries, lit and drawn for the close look.
//   · the trees are GROWN (vegetation/grow.js, the `cherry` species: Rauh made decurrent, two years of spurs), K variants;
//   · a tree near the eye keeps every axis (bark quads on the trunk and limbs, the ladder's L3) and its leaves become what
//     a Somei-yoshino carries in bloom instead: flowering spurs along its young shoots and older twigs, an umbel of three
//     to five flowers on each (blossom.mjs, a flower from its parts, fractal-edged petals), nodding outward;
//   · each tree takes its level by distance, the pool's rule: the flowers are drawn whole within a few metres of the eye,
//     past that as their footprints (one lit disc a flower, facing the eye; facing the sun in the shadow pass), and past
//     the middle distance the tree is the pool's L1 (the crown's clusters recoloured in bloom);
//   · the lawn is the production lawn tuft (vegetation/grass.js);
//   · one wind (vegetation/wind.js windField, inlined): it sways each tree at its own first frequency, flutters the
//     flowers, combs the lawn, and carries the petals (debrisKernel), released from the hero trees' own flowers;
//   · the light: a low sun with soft shadows, sky light, petals lit as thin sheets (light through them when backlit),
//     the frame drawn in HDR through bloom, ACES and a sun halo.
//   node scripts/spikes/sakura/hero-grove.mjs /absolute/out.html [speed m/s = 6] [petals = 6000] [variants = 4]
import { writeFileSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { grow, measure, ARCHITECTURES, mulberry32, vec, rot } = await import('../../../lib/graph/vegetation/grow.js');
const { SPECIES } = await import('../../../lib/graph/vegetation/species.js');
const { ladder } = await import('../../../lib/graph/vegetation/ladder.js');
const { barkTile } = await import('../../../lib/graph/vegetation/tiles.js');
const { grassTuft, GRASSES } = await import('../../../lib/graph/vegetation/grass.js');
const { windField, debrisKernel, WIND_TAKERS } = await import('../../../lib/graph/vegetation/wind.js');
const { inlineImportmap } = await import('../../../lib/graph/scene/emit-util.js');
const { flowerGeometry, PEDICEL } = await import('./blossom.mjs');
const { add, sub, mul, cross, unit } = vec;

const [out = 'scripts/spikes/sakura/hero-grove.html', speedArg = '6', petalsArg = '6000', variantsArg = '4'] = process.argv.slice(2);
const K = Number(variantsArg), DEG = Math.PI / 180, t0 = performance.now();
const S = SPECIES.cherry, B = S.bloom;
const hashSeed = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const lin = (c) => c.map((v) => Math.pow(Math.max(0, Math.min(1, v / 255)), 2.2));
const b64 = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64');

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
  return { plain: { pos: b64(plain.pos), nrm: b64(plain.nrm), col: b64(plain.col) }, bark: { pos: b64(bark.pos), nrm: b64(bark.nrm), uv: b64(bark.uv) } };
}
function packBlobs(tris, shrink = 1) {
  const leaf = tris.filter((t) => t.kind === 'leaf'); if (leaf.length % 20) throw new Error('blobs are 20 faces each');
  const pos = [], nrm = [], col = [];
  for (let g = 0; g < leaf.length; g += 20) {
    const grp = leaf.slice(g, g + 20); let c = [0, 0, 0]; for (const t of grp) for (const v of t.p) c = add(c, mul(v, 1 / 60));
    for (const t of grp) { const cl = lin(t.c); for (const v of t.p) { const d = sub(v, c); pos.push(...add(c, mul(d, shrink))); nrm.push(...unit(d)); col.push(...cl); } }
  }
  return { pos: b64(pos), nrm: b64(nrm), col: b64(col) };
}

// ── the tree's hand: the growth engine's shoots run straight between buds; a cherry's do not. After growth, each
// internode's offset from its parent is turned (positions rebuilt from the base, so every axis stays joined):
//   · twist: about the vertical, by `twist` more each internode along its axis, the same hand on every axis (the trunk a
//     third of it): the limbs sweep round the trunk one way, the spiral the wall's helix leaves in the form;
//   · helix: a lean of `helix` toward a bearing that turns by `turn` each internode, the same hand: an upright axis
//     (the leader, which turning about the vertical cannot touch) winds up in a loose corkscrew instead of a rod;
//   · zig: sideways, alternating node to node, on shoots under 1.5 cm (a Prunus shoot's zig-zag; on a limb it is an elbow);
//   · arch: down, growing with the square of the way along the axis (a long limb bows out and over at its end).
const FORM = { hand: 1, twist: 6 * DEG, helix: 9 * DEG, turn: 55 * DEG, zig: 9 * DEG, arch: 26 * DEG };
function curl(p, F = FORM) {
  const N = p.nodes, k = new Int32Array(N.length), last = new Map(), pos = N.map((n) => n.pos);
  for (const n of N) { if (n.parent < 0) continue; const q = N[n.parent]; k[n.id] = q.axis === n.axis && q.parent >= 0 ? k[q.id] + 1 : 0; last.set(n.axis, Math.max(last.get(n.axis) || 0, k[n.id])); }
  const out = N.map((n) => ({ ...n }));
  for (const n of N) {
    if (n.parent < 0) continue;
    let v = sub(n.pos, N[n.parent].pos); const f = k[n.id] / ((last.get(n.axis) || 0) + 1);
    v = rot(v, [0, 0, 1], F.hand * F.twist * k[n.id] * (n.order === 0 ? 0.33 : 1));
    const h = unit(cross(v, [0, 0, 1])), w = unit(cross(h, v));
    const b = F.hand * F.turn * k[n.id] + n.axis * 2.4, q = [Math.cos(b), Math.sin(b), 0], tilt = cross(v, q);
    if (Math.hypot(...tilt) > 1e-6) v = rot(v, unit(tilt), F.helix * (n.order === 0 ? 1 : 0.6));
    if (Math.hypot(...cross(v, [0, 0, 1])) > 1e-6) { if (n.r < 0.015) v = rot(v, w, F.zig * (k[n.id] % 2 ? 1 : -1)); if (n.order >= 1) v = rot(v, h, -F.arch * f * f); }
    out[n.id].pos = add(out[n.parent].pos, v); out[n.id].dir = unit(v);
  }
  return { ...p, nodes: out };
}

// the curled skeleton is still a polyline of 20–30 cm internodes, and a limb shows its turns as elbows: every internode
// gets a node at its Catmull–Rom midpoint (through its axis' neighbours), in place in the node order, so the axes, the
// ladder and the pool read it unchanged
function subdivide(p) {
  const N = p.nodes, next = new Map();
  for (const n of N) if (n.parent >= 0 && !n.died && N[n.parent].axis === n.axis && !next.has(n.parent)) next.set(n.parent, n.id);
  const out = [], id = new Int32Array(N.length);
  for (const n of N) {
    if (n.parent < 0) { id[n.id] = out.length; out.push({ ...n, id: out.length }); continue; }
    const q = N[n.parent], g = q.parent >= 0 && N[q.parent].axis === q.axis ? N[q.parent].pos : q.pos, c = next.has(n.id) ? N[next.get(n.id)].pos : n.pos;
    const m = [0, 1, 2].map((i) => (-g[i] + 9 * q.pos[i] + 9 * n.pos[i] - c[i]) / 16);
    const mid = { ...n, id: out.length, parent: id[q.id], pos: m, len: n.len / 2, leaves: 0, r: (n.r + q.r) / 2 };
    out.push(mid); id[n.id] = out.length; out.push({ ...n, id: out.length, parent: mid.id, len: n.len / 2 });
  }
  const children = new Map(); for (const n of out) if (n.parent >= 0) { if (!children.has(n.parent)) children.set(n.parent, []); children.get(n.parent).push(n.id); }
  return { ...p, nodes: out, children };
}

// ── the flowers of a grown tree: umbels at the ends of its shoots ─────────────────────────────────────────────────
// Every live axis ends in a bunch: a cluster of umbels round its tip, then spurs thinning back along it over its last
// TIP_L metres (closest together at the tip), and nothing on the older wood behind. An umbel is three to five flowers
// on pedicels that splay out from the spur and nod. Record: centre (3), facing (3), twist, petal length (m), exposure.
const PETAL = 0.016, TIP_L = 0.38, SPUR_GAP = 0.03;
function flowersOf(p, seed) {
  const rnd = mulberry32(seed), out = [], N = p.nodes;
  const umbel = (spur, side, e) => {
    const k = 3 + Math.floor(rnd() * 3);
    for (let q = 0; q < k; q++) {
      const r = unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      const dir = unit(add(add(mul(side, 0.75), mul(r, 0.65)), [0, 0, -0.2 + 0.35 * rnd()]));
      const size = PETAL * (0.85 + 0.3 * rnd()), c = add(spur, mul(dir, PEDICEL * size));
      out.push(...c, ...dir, 2 * Math.PI * rnd(), size, e);
    }
  };
  // each axis' live nodes in order, and how far each lies back from the axis' tip
  const axes = new Map();
  for (const n of N) { if (n.died || n.parent < 0) continue; if (!axes.has(n.axis)) axes.set(n.axis, []); axes.get(n.axis).push(n); }
  for (const list of axes.values()) {
    let back = 0; const tip = list[list.length - 1];
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i], par = N[n.parent], seg = sub(n.pos, par.pos), L = Math.hypot(...seg);
      if (back > TIP_L) break;
      const d = unit(seg), u = unit(cross(Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], d)), w = cross(d, u), e = Math.min(1, p.exposure(n.pos));
      const m = Math.floor((L / SPUR_GAP) * Math.max(0, 1 - back / TIP_L) * 1.6 + rnd());
      for (let j = 0; j < m; j++) {
        const t = 1 - Math.sqrt(rnd()) * Math.min(1, (TIP_L - back) / L), phi = 2 * Math.PI * rnd();
        let side = unit(add(mul(u, Math.cos(phi)), mul(w, Math.sin(phi)))); if (side[2] < -0.4) side = mul(side, -1);
        umbel(add(add(par.pos, mul(seg, Math.max(0, t))), mul(side, n.r + 0.006)), side, e);
      }
      back += L;
    }
    // the bunch at the tip itself
    const e = Math.min(1, p.exposure(tip.pos)), td = unit(sub(tip.pos, N[tip.parent].pos));
    for (let j = 0; j < 3; j++) umbel(add(tip.pos, mul(td, 0.01)), unit(add(td, mul(unit([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), 0.9))), e);
  }
  return out;
}

// ── grow the variants ────────────────────────────────────────────────────────────────────────────────────────────
const arch = { ...ARCHITECTURES[S.arch], ...S.over, leafLife: S.leafLife };
const tile = barkTile(S.bark), bark = { minR: 0.03, tile: tile.metres, color: tile.mean, key: tile.key };
const variants = [];
for (let k = 0; k < K; k++) {
  const sd = hashSeed(`hanami::cherry::${k}`) % 100000, p = subdivide(curl(grow(arch, { years: S.years, seed: sd }))), H = measure(p).height;
  const lad = ladder(p, H, { leafScale: S.leafScale, bark, fill: B.fill });
  const fl = flowersOf(p, sd ^ 0x9e3779b9);
  const L2 = bloomTris(lad.L2), L1 = bloomTris(lad.L1);
  variants.push({ H, hero: { wood: packWood(bloomTris(lad.L3.filter((t) => t.kind !== 'leaf'))), flowers: b64(fl), nFlowers: fl.length / 9 },
    L2: { wood: packWood(L2), blobs: packBlobs(L2) }, L1: { wood: packWood(L1), blobs: packBlobs(L1) },
    tris: { L3wood: lad.L3.filter((t) => t.kind !== 'leaf').length, L2: lad.L2.length, L1: lad.L1.length } });
  console.log(`variant ${k}: ${H.toFixed(2)} m, ${fl.length / 9} flowers, tris ${JSON.stringify(variants.at(-1).tris)}`);
}

// ── the grove: an avenue along x, rows of cherries either side ─────────────────────────────────────────────────────
const trees = [], rr = mulberry32(77);
for (const side of [-1, 1]) for (let row = 0; row < 6; row++) {
  const y0 = side * (4.4 + row * 6.0);
  for (let x = -42 + (row % 2) * 3.1; x <= 42; x += 6.2) {
    if (rr() < 0.08 * row) continue;
    const px = x + 1.1 * (rr() - 0.5), py = y0 + 1.1 * (rr() - 0.5), v = Math.floor(rr() * K), s = 0.92 + 0.3 * rr(), yaw = 2 * Math.PI * rr();
    trees.push([px, py, groundAt(px, py) - 0.04, yaw, s, v]);
  }
}

// ── the flower at its levels, one petal for the wind, a lawn tuft ─────────────────────────────────────────────────
const fg = (o) => { const g = flowerGeometry(o); return { pos: b64(g.pos), nrm: b64(g.nrm), col: b64(g.col.map((v) => Math.pow(v, 2.2))), part: b64(g.part), tris: g.pos.length / 9 }; };
const flowerLevels = [fg({ seed: 11, depth: 3 }), fg({ seed: 12, depth: 1 }), fg({ seed: 13, mid: true })];
const petal = fg({ seed: 15, depth: 2, single: true });
const tuft = (level) => {
  const tris = grassTuft('lawn', { seed: 3, level }), g = { pos: [], nrm: [], col: [] };
  for (const t of tris) { let n = t.n || unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0]))); if (n[2] < 0) n = mul(n, -1); for (const v of t.p) { g.pos.push(...v); g.nrm.push(...n); g.col.push(...lin(t.c)); } }
  return { pos: b64(g.pos), nrm: b64(g.nrm), col: b64(g.col), tris: tris.length };
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
};
const page = readFileSync(new URL('./hero-grove.page.js', import.meta.url), 'utf8');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cherry grove, hero</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#cfd9e6;font:13px/1.35 system-ui,sans-serif}#ui{position:fixed;left:12px;top:12px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 24px)}#ui button{border:0;border-radius:6px;padding:6px 10px;background:rgba(20,24,30,.55);color:#fff;cursor:pointer}#ui button:hover{background:rgba(20,24,30,.8)}#hud{position:fixed;right:12px;bottom:10px;color:#fff;text-shadow:0 1px 2px #0008;font-variant-numeric:tabular-nums}</style>
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
