// vegetation/ladder — the level-of-detail ladder of one grown plant (pool.js places it).
//
// The rock's octaves become the tree's branch ORDERS, cut by the pipe model: an axis is drawn only while its
// diameter would cover a pixel at the level's distance. Foliage below the cut collapses into clusters, and past the
// leaf size a crown is a turbid medium whose tone is Beer–Lambert (the growth engine's own shadow grid), so a
// cluster's colour is the mean exposure of the leaves it replaces.
//   L3 hero : every axis, every leaf (quads)                            — near, one or two per scene
//   L2 near : axes ≥ d2, ≤ 6 sides; leaves → voxel clusters of c2       — ~a tenth of the faces
//   L1 mid  : axes ≥ d1, 4 sides; leaves → clusters of c1
//   L0 far  : the trunk to the crown + a few crown lobes (c0)           — ~a hundred faces, the rock's "block"
import { axisChains, tubeTris, barkQuads, woodTone, leafTris, blobTris, defaultSides, TONES } from './tree-mesh.js';
import { mix } from './util.js';

function leafyNodes(plant) { return plant.nodes.filter((n) => !n.died && n.leaves > 0); }
/** Voxel-cluster the leaves at cell size c → blobs (centroid, spread radii, Beer–Lambert tone). */
export function clusterBlobs(plant, c, { detail = 0, minR = 0.6, tint = null, leafScale = 1 } = {}) {
  const cells = new Map();
  for (const n of leafyNodes(plant)) {
    const k = `${Math.floor(n.pos[0] / c)},${Math.floor(n.pos[1] / c)},${Math.floor(n.pos[2] / c)}`;
    if (!cells.has(k)) cells.set(k, { s: [0, 0, 0], ss: [0, 0, 0], w: 0, e: 0 });
    const g = cells.get(k); const w = n.leaves; for (let i = 0; i < 3; i++) { g.s[i] += n.pos[i] * w; g.ss[i] += n.pos[i] * n.pos[i] * w; } g.w += w; g.e += plant.exposure(n.pos) * w;
  }
  const tris = []; const needles = !!plant.arch.needles; const size = plant.arch.leafSize;
  for (const g of [...cells.values()].sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1] || a.s[2] - b.s[2])) {
    const m = g.s.map((x) => x / g.w); const sd = g.ss.map((x, i) => Math.sqrt(Math.max(0, x / g.w - m[i] * m[i])));
    // coverage-preserving: the blob covers what its leaves would cover, by Beer–Lambert over the cluster's extent
    // (LAI = leaf area over the extent's footprint, G = 0.5), so a sparse crown stays sparse and a dense one solid
    const ext = sd.map((x) => Math.max(0.6 * size * leafScale, 1.6 * x + 0.5 * size * leafScale));
    const leafArea = g.w * 0.45 * (size * leafScale) ** 2 * (needles ? 2.5 : 1);
    const lai = leafArea / (Math.PI * ext[0] * ext[1] + 1e-9); const cover = 1 - Math.exp(-0.5 * lai);
    ext[2] = Math.max(ext[2], 0.55 * Math.max(ext[0], ext[1]));          // a cluster is a puff, not a pancake
    // an opaque blob cannot be 30% covered, so it shrinks part-way (cover^0.35 sits between area-preserving 0.5 and
    // none) — the eye tolerates a slightly fuller crown far off better than a sparser one
    const r = ext.map((x) => Math.max(minR * size, x * Math.pow(cover, 0.35)));
    const e = g.e / g.w; const tone = 0.3 + 0.7 * e;
    const col = tint || (needles ? mix(TONES.needle, TONES.needleLit, tone - 0.25) : mix(TONES.leaf, TONES.leafLit, tone - 0.1));
    for (const t of blobTris(m, r, col, { detail })) tris.push(t);
  }
  return tris;
}
/** One level: tubes above the diameter cut, clusters for the rest of the foliage. */
export function level(plant, { dCut = 0, sidesMax = 10, cell = 0, leaves = 'quads', detail = 0, trunkOnlyBelow = null, leafScale = 1, bark = null } = {}) {
  const chains = axisChains(plant); const col = woodTone(plant); const tris = [];
  const sidesFor = (r) => Math.min(sidesMax, defaultSides(r));
  for (const ch of chains) {
    if (ch.dMax < dCut) continue;
    if (trunkOnlyBelow !== null && ch.order > 0) continue;
    let chain = ch;
    if (trunkOnlyBelow !== null) { const k = ch.pts.findIndex((p) => p[2] > trunkOnlyBelow); if (k > 1) chain = { ...ch, pts: ch.pts.slice(0, k + 1), rs: ch.rs.slice(0, k + 1), nodes: ch.nodes.slice(0, k), continues: true }; }
    // a thick axis wears the bark tile (bark: { minR, tile, color, key }); the rest are plain tubes in their wood tone
    if (bark && trunkOnlyBelow === null && ch.dMax >= 2 * bark.minR) { for (const t of barkQuads(chain, { sidesFor, tile: bark.tile, color: bark.color, key: bark.key })) tris.push(t); continue; }
    for (const t of tubeTris(chain, { sidesFor, colorFor: col })) tris.push(t);
  }
  if (leaves === 'quads') for (const t of leafTris(plant, { scale: leafScale })) tris.push(t);
  else if (leaves === 'clusters') for (const t of clusterBlobs(plant, cell, { detail, leafScale })) tris.push(t);
  return tris;
}
/**
 * The ladder for a plant of height H. Thresholds scale with H so every species gets the same pixel logic. With `bark`
 * ({ minR, tile, color, key }), the near levels (L3, L2) draw axes thicker than 2·minR as bark quads carrying the tile's uv;
 * the far levels keep plain tubes, where a tile would shimmer.
 */
export function ladder(plant, H, { leafScale = 1, bark = null } = {}) {
  const crownBase = Math.min(...leafyNodes(plant).map((n) => n.pos[2]));
  return {
    L3: level(plant, { leafScale, bark }),
    L2: level(plant, { dCut: H / 420, sidesMax: 6, cell: H / 11, leaves: 'clusters', detail: 0, leafScale, bark }),
    L1: level(plant, { dCut: H / 180, sidesMax: 4, cell: H / 5, leaves: 'clusters', detail: 0, leafScale }),
    L0: level(plant, { dCut: H / 60, sidesMax: 4, cell: H / 2.4, leaves: 'clusters', detail: 0, leafScale, trunkOnlyBelow: crownBase + 0.25 * (H - crownBase) }),
  };
}
