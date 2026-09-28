// vegetation/tiles — the surface a grown plant wears in the World:
//   · bark from the fracture model (bark.js), one tile per bark preset, periodic in both directions, so it runs up and
//     round a trunk without a seam; a trunk's quads carry uv in metres over the tile's size (a tile grows in 30–120 ms);
//   · a palm's trunk from its own phyllotaxis (palm.js trunkSurface: scar rings, the leaf-base lattice), unrolled over
//     the whole trunk as one texture per grown palm, since its zones (boots near the crown, bare below) do not repeat.
// Deterministic; the bark tiles are cached in-process (a palm's texture is cached with its growth, by the pool).
import { growBark, shadeBark, BARKS } from './bark.js';
import { trunkSurface, rAt } from './palm.js';
import { encodePng } from '../landscape/surface-textures.js';

/** The metres of bark one tile covers, up and round. */
export const BARK_TILE_M = 0.6;
const CACHE = new Map();

/**
 * The bark tile of a preset (`oak`, `beech`, `pine`, `chestnut`): { key, url, mean, metres }. `mean` is the tile's mean
 * colour, the plain colour a consumer without textures draws the bark in. The bark is grown on a 90-year trunk of
 * 0.4 m radius at constant ring area (Pressler, below the crown), over a sector of the tile's width.
 */
export function barkTile(bark) {
  if (CACHE.has(bark)) return CACHE.get(bark);
  if (!BARKS[bark]) throw new Error(`unknown bark '${bark}' (one of ${Object.keys(BARKS).join(', ')})`);
  const rHist = [...Array(90)].map((_, y) => Math.sqrt(((y + 1) * 0.4 ** 2) / 90));
  const grown = growBark(rHist, bark, { rows: 256, height: BARK_TILE_M, seed: 5, sector: BARK_TILE_M / (2 * Math.PI * rHist[89]) });
  const map = grown.render(256 / BARK_TILE_M); const rgb = shadeBark(map);
  const sum = [0, 0, 0]; for (let i = 0; i < rgb.length; i += 3) for (let k = 0; k < 3; k++) sum[k] += rgb[i + k];
  const n = rgb.length / 3; const mean = sum.map((v) => Math.round(v / n));
  const tile = { key: `bark-${bark}`, url: `data:image/png;base64,${encodePng(rgb, map.W, map.H).toString('base64')}`, mean, metres: BARK_TILE_M };
  CACHE.set(bark, tile); return tile;
}

/**
 * A palm's trunk unrolled: u round it (the phyllotactic azimuth), v up it (arc length over the trunk's length), about
 * `pxPerM` pixels a metre, relief-shaded by the surface's height (light from the upper left, as for bark). →
 * { key, url, mean, length }: `length` is the trunk's arc length the texture spans (v = s / length).
 */
export function palmTrunkTexture(palm, key, { pxPerM = 90 } = {}) {
  const surf = trunkSurface(palm); const length = palm.nodes[palm.nodes.length - 1].s; const R = rAt(palm.sp, 0);
  const W = Math.max(48, Math.min(192, Math.round(2 * Math.PI * R * pxPerM))), px = Math.min(pxPerM, 4096 / length), H = Math.max(64, Math.round(length * px));
  const rgb = new Uint8Array(W * H * 3), hgt = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const sv = length * (1 - (j + 0.5) / H);                            // row 0 is the top of the image: v = 1
    for (let i = 0; i < W; i++) { const r = surf((2 * Math.PI * (i + 0.5)) / W, sv); hgt[j * W + i] = r.height; for (let k = 0; k < 3; k++) rgb[(j * W + i) * 3 + k] = r.color[k]; }
  }
  const out = Buffer.alloc(W * H * 3); const Lx = -0.5, Ly = 0.6, Lz = 0.62, Ll = Math.hypot(Lx, Ly, Lz); const sum = [0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const hx = (hgt[j * W + ((i + 1) % W)] - hgt[j * W + ((i - 1 + W) % W)]) * px * 0.5, hy = (hgt[Math.max(0, j - 1) * W + i] - hgt[Math.min(H - 1, j + 1) * W + i]) * px * 0.5;
    const l = Math.hypot(hx, hy, 1); const d = (-hx * Lx - hy * Ly + Lz) / (l * Ll); const sh = 0.5 + 0.62 * Math.max(0, d);
    for (let k = 0; k < 3; k++) { const v = Math.min(255, rgb[(j * W + i) * 3 + k] * sh); out[(j * W + i) * 3 + k] = v; sum[k] += v; }
  }
  return { key, url: `data:image/png;base64,${encodePng(out, W, H).toString('base64')}`, mean: sum.map((v) => Math.round(v / (W * H))), length };
}
