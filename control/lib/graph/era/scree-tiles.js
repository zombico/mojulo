/**
 * SCREE TILES — a scree's stones thinning out: a cutout of the scree tile itself (matte-paint/dressed.js `scree`) that
 * keeps a share of its stones, whole, each by its own dice, shaded as the tile shades it, clear between them. Laid over
 * turf (or a trail's verge) with the same world-locked uv as the scree beside it, so a stone kept lies exactly where the
 * scree draws it: the scree's edge is its stones growing fewer, the ground showing through, the way a trail's border
 * takes its sand (era/sand-tiles.js).
 *
 *   screeKey(screeDetailKey, level) → `scree:<detail key>~<level, hundredths>`: the stones whose dice fall under
 *                                     `level` kept
 *   screeTexels(key)                → { W, H, rgb (as the detail tile shows), a (0 | 255) } | null
 *
 * Pure: the scree tile's own field. A tile is painted once a key.
 */
import { detailShown, detailSpec } from '../matte-paint/detail.js';
import { screeDice } from '../matte-paint/dressed.js';
import { encodePngRgba, registerTextureResolver } from '../landscape/surface-textures.js';

export const screeKey = (detailKey, level) => `scree:${detailKey}~${Math.round(level * 100)}`;

const PAINTED = new Map();
export function screeTexels(key) {
  const m = /^scree:(.+?)~(\d+)$/.exec(key);
  const S = m ? detailSpec(m[1]) : null;
  if (!S || S.cfg.cut !== 'scree') return null;
  const T = detailShown(m[1]), level = +m[2] / 100, dice = screeDice(S.cfg, { size: T.W, seed: S.seed }), a = new Uint8Array(T.W * T.H);
  for (let k = 0; k < a.length; k++) a[k] = dice[k] >= 0 && dice[k] < level ? 255 : 0;
  return { W: T.W, H: T.H, rgb: T.rgb, a };
}
registerTextureResolver('scree:', (key) => {
  if (PAINTED.has(key)) return PAINTED.get(key);
  const T = screeTexels(key);
  if (!T) return null;
  const rgba = Buffer.alloc(T.W * T.H * 4);
  for (let i = 0; i < T.W * T.H; i++) { rgba[i * 4] = T.rgb[i * 3]; rgba[i * 4 + 1] = T.rgb[i * 3 + 1]; rgba[i * 4 + 2] = T.rgb[i * 3 + 2]; rgba[i * 4 + 3] = T.a[i]; }
  const url = `data:image/png;base64,${encodePngRgba(rgba, T.W, T.H).toString('base64')}`;
  if (PAINTED.size >= 24) PAINTED.clear();
  PAINTED.set(key, url);
  return url;
});
