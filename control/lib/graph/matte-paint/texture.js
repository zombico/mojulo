/**
 * MATTE TEXTURES as surface keys: a matte painting named by its spec, so a face carries `texture: 'matte:…'` like any
 * tile and the page's texture table resolves it (landscape/surface-textures.js `registerTextureResolver`). The key is
 * the spec's own print, so the same spec is the same key and the same bytes, and the painting is made once a process.
 *
 *   rockTileKey(spec) → 'matte:rock-<print>'   a rock face tile (tile.js), registered for the resolver
 */
import { registerTextureResolver } from '../landscape/surface-textures.js';
import { paintRockTile, readRockTile } from './tile.js';

// FNV-1a over the filled spec's JSON: the key is the numbers
const fingerprint = (v) => { let h = 2166136261; for (const c of JSON.stringify(v)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
const SPECS = new Map(), URLS = new Map();
registerTextureResolver('matte:', (key) => {
  if (URLS.has(key)) return URLS.get(key);
  const spec = SPECS.get(key);
  if (!spec) return null;
  const url = paintRockTile(spec).url;
  URLS.set(key, url);
  return url;
});

/** A rock tile's key: checked, filled, named by its numbers. */
export function rockTileKey(spec = {}) {
  const S = readRockTile(spec), key = `matte:rock-${fingerprint(S)}`;
  if (!SPECS.has(key)) SPECS.set(key, spec);
  return { key, mean: S.mean, size: [S.w, S.h] };
}
