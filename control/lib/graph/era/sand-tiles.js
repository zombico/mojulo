/**
 * SAND TILES — the dirt worked into a laid road at its edge, as a cutout over it: opaque in the road tile's own joints
 * (its darker texels: the cracks between its stones) and in broken patches of sand that grow with `level`, clear over
 * the stones' faces, so the road shows through beneath the sand. Painted from the road's own detail tile (same texels,
 * same size, laid with the same world-locked uv), so the sand lies exactly in its cracks. White: the face's colour (the
 * dirt's) multiplies it.
 *
 *   sandKey(roadKey, level)   → `sand:<road key>~<level, hundredths>` (level 0: the cracks alone; 1: all sand)
 *   sandTexels(key)           → { W, H, a } (alpha 0 | 255) | null
 *
 * Pure: the road tile's texels and hashed dice. A tile is painted once a key.
 */
import { detailTexels } from '../matte-paint/detail.js';
import { encodePngRgba, registerTextureResolver } from '../landscape/surface-textures.js';

export const sandKey = (roadKey, level) => `sand:${roadKey}~${Math.round(level * 100)}`;

// wrapped value noise on a tile: `n` cells a side, smooth between them
function wrapNoise(W, n, seed) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) { let h = Math.imul(i + 1, 0x27d4eb2d) ^ Math.imul(seed, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 13; g[i] = (h >>> 0) / 4294967296; }
  const at = (x, y) => {
    const u = (x / W) * n, v = (y / W) * n, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, s = (t) => t * t * (3 - 2 * t);
    const q = (a, b) => g[(((b % n) + n) % n) * n + (((a % n) + n) % n)];
    const a = q(i, j) + (q(i + 1, j) - q(i, j)) * s(fu), b = q(i, j + 1) + (q(i + 1, j + 1) - q(i, j + 1)) * s(fu);
    return a + (b - a) * s(fv);
  };
  return at;
}

const PAINTED = new Map();
export function sandTexels(key) {
  const m = /^sand:(.+)~(\d+)$/.exec(key);
  if (!m) return null;
  const T = detailTexels(m[1]);
  if (!T) return null;
  const level = +m[2] / 100, n = T.W * T.H, lum = new Float32Array(n);
  let mean = 0;
  for (let k = 0; k < n; k++) { lum[k] = 0.2126 * T.rgb[k * 3] + 0.7152 * T.rgb[k * 3 + 1] + 0.0722 * T.rgb[k * 3 + 2]; mean += lum[k] / n; }
  const big = wrapNoise(T.W, 6, 211), small = wrapNoise(T.W, 24, 223), a = new Uint8Array(n);
  for (let y = 0; y < T.H; y++) for (let x = 0; x < T.W; x++) {
    const k = y * T.W + x, crack = lum[k] < mean * 0.82, patch = 0.65 * big(x, y) + 0.35 * small(x, y) > 0.85 - level * 0.75;
    a[k] = crack || (level > 0 && patch) ? 255 : 0;
  }
  return { W: T.W, H: T.H, a };
}
registerTextureResolver('sand:', (key) => {
  if (PAINTED.has(key)) return PAINTED.get(key);
  const T = sandTexels(key);
  if (!T) return null;
  const rgba = Buffer.alloc(T.W * T.H * 4, 255);
  for (let i = 0; i < T.W * T.H; i++) rgba[i * 4 + 3] = T.a[i];
  const url = `data:image/png;base64,${encodePngRgba(rgba, T.W, T.H).toString('base64')}`;
  if (PAINTED.size >= 24) PAINTED.clear();
  PAINTED.set(key, url);
  return url;
});
