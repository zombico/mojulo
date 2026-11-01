/**
 * BARK AS MATERIAL (gen-7): the bark's fracture model (vegetation/bark.js: a brittle skin cracking on a growing trunk,
 * its ridges, plates and fissures, leaning with the spiral grain) read into the material a renderer lights, where the
 * gen-6 tile (vegetation/tiles.js barkTile) bakes one light into it: its own colour under no light, the relief's normal,
 * the fissures' occlusion, and the relief itself, for parallax (the page marches the view into it). One tile per bark
 * preset, periodic both ways (BARK_TILE_M a side), as the tree's wood carries its coordinates in tiles
 * (form/tree-form.js).
 *
 *   barkMaterial(bark, { size? }) → { key, W, H, metres, depth, baseColor, normal, orm, height }
 *     baseColor, normal, orm: RGB buffers (form/relief-material.js); height: RGB, the relief over its depth (0 a fissure's
 *     floor, 255 a ridge's crest); depth: the relief's range in metres (the parallax's)
 * Deterministic; cached per preset and size.
 */
import { growBark, BARKS } from '../vegetation/bark.js';
import { BARK_TILE_M } from '../vegetation/tiles.js';
import { reliefMaterial } from './relief-material.js';

/** The bark's roughness: dry, fibrous, a little polished on its crests (relief-material's crest polish). */
export const BARK_ROUGH = 0.9;
const CACHE = new Map();

export function barkMaterial(bark, { size = 256 } = {}) {
  const key = `${bark}:${size}`; if (CACHE.has(key)) return CACHE.get(key);
  if (!BARKS[bark]) throw new Error(`bark-material: unknown bark '${bark}' (one of ${Object.keys(BARKS).join(', ')})`);
  // (grown as the gen-6 tile is: a 90-year trunk of 0.4 m radius at constant ring area, over the tile's sector)
  const rHist = [...Array(90)].map((_, y) => Math.sqrt(((y + 1) * 0.4 ** 2) / 90));
  const grown = growBark(rHist, bark, { rows: size, height: BARK_TILE_M, seed: 5, sector: BARK_TILE_M / (2 * Math.PI * rHist[89]) });
  const map = grown.render(size / BARK_TILE_M), { W, H } = map, n = W * H;
  let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { lo = Math.min(lo, map.height[i]); hi = Math.max(hi, map.height[i]); }
  const depth = Math.max(1e-6, hi - lo), cavity = new Float32Array(n), convex = new Float32Array(n), height = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const t = (map.height[i] - lo) / depth;
    cavity[i] = Math.pow(1 - t, 2); convex[i] = Math.max(0, (t - 0.75) / 0.25);
    height[i * 3] = height[i * 3 + 1] = height[i * 3 + 2] = Math.round(t * 255);
  }
  const M = reliefMaterial({ W, H, px: BARK_TILE_M / W, height: map.height, tile: true }, { base: Buffer.from(map.color), cavity, convex, rough: BARK_ROUGH });
  const out = { key: `bark7-${bark}`, W, H, metres: BARK_TILE_M, depth: Math.round(depth * 1e5) / 1e5, baseColor: M.baseColor, normal: M.normal, orm: M.orm, height };
  CACHE.set(key, out); return out;
}
