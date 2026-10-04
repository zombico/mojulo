/**
 * FLOOR TILES — the jungle floor's second tile, for the two-tile vertex blend (the World page's blend layer, faces with
 * `blend: true`): the era painted its ground as a soil tile and a moss tile, faded one over the other per vertex.
 *
 *   floor:moss   cushion moss: packed clumps, each lit on its upper-left and dark at its rim, bright fronds speckling
 *                the tops, dark hollows between; seamless both ways
 *
 * `floorTexture(key)` → data:image/png (registered as the `floor:` resolver). Deterministic: mulberry32 from the key.
 */
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';
import { mulberry32 } from '../vegetation/grow.js';

const SIZE = 256;
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

const PAINTERS = {
  moss(rgb, R) {
    const put = (x, y, c, k = 1) => { const xi = ((x % SIZE) + SIZE) % SIZE, yi = ((y % SIZE) + SIZE) % SIZE, o = (yi * SIZE + xi) * 3; for (let q = 0; q < 3; q++) rgb[o + q] = clamp(c[q] * k); };
    for (let i = 0; i < SIZE * SIZE; i++) { const v = 0.8 + 0.3 * R(); rgb[i * 3] = 40 * v; rgb[i * 3 + 1] = 52 * v; rgb[i * 3 + 2] = 24 * v; }   // the dark hollows
    const TONES = [[78, 104, 40], [92, 118, 44], [70, 96, 46], [104, 124, 52], [86, 100, 38]];
    for (let i = 0; i < 520; i++) {   // the cushions, back to front: each a dome lit from the upper left
      const cx = R() * SIZE, cy = R() * SIZE, r = 3 + 9 * R() * R(), col = TONES[(R() * TONES.length) | 0];
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = (x - cx) / r, dy = (y - cy) / r, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
        const lit = 0.72 + 0.42 * Math.max(0, -0.6 * dx - 0.6 * dy + 0.5 * Math.sqrt(1 - d2)) - 0.25 * d2 * d2;
        put(x, y, col, lit * (0.92 + 0.16 * R()));
      }
    }
    for (let i = 0; i < 2600; i++) { const x = (R() * SIZE) | 0, y = (R() * SIZE) | 0; put(x, y, [132, 152, 66], 0.9 + 0.3 * R()); }   // frond tips catching light
  },
};

export const FLOOR_KEYS = Object.freeze(Object.keys(PAINTERS).map((k) => `floor:${k}`));
const built = {};
export function floorTexture(key) {
  if (built[key]) return built[key];
  const paint = PAINTERS[key.slice(6)]; if (!paint) return null;
  let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rgb = Buffer.alloc(SIZE * SIZE * 3); paint(rgb, mulberry32(h >>> 0));
  return (built[key] = `data:image/png;base64,${encodePng(rgb, SIZE, SIZE).toString('base64')}`);
}

registerTextureResolver('floor:', floorTexture);
