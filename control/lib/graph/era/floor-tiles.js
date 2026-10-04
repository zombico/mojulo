/**
 * PAINTED TILES — the stage's own painted surfaces (RGB, seamless both ways): the blend layer's second tiles (the era
 * painted its ground as a soil tile and a moss tile, faded one over the other per vertex), floors in shapes the kit's
 * flagstone grid can't make, and a painted vault.
 *
 *   floor:moss   cushion moss: packed clumps, each lit on its upper-left and dark at its rim, bright fronds speckling
 *                the tops, dark hollows between; seamless both ways
 *   floor:grime  old wet grime on stone: dark mottled stains with tide-lines, a pale mineral bloom at their edges, grit
 *   floor:hex    hexagonal stone tiles on a wrapped lattice: each its own tone, bevelled dark at the joint, a few cracked
 *   floor:incertum  opus incertum: irregular flags, no two alike (a wrapped Voronoi of jittered seeds, its joints
 *                wandering), each its own tone and wear, dark mortar, grit
 *   vault:stars  a vault's plastered web painted night-blue with gilt six-point stars, flaked to pale plaster in damp
 *                patches
 *
 * `floorTexture(key)` → data:image/png (registered as the `floor:` and `vault:` resolvers). Deterministic: mulberry32
 * from the key.
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
  grime(rgb, R) {
    const put = (x, y, c, k = 1) => { const xi = ((x % SIZE) + SIZE) % SIZE, yi = ((y % SIZE) + SIZE) % SIZE, o = (yi * SIZE + xi) * 3; for (let q = 0; q < 3; q++) rgb[o + q] = clamp(c[q] * k); };
    for (let i = 0; i < SIZE * SIZE; i++) { const v = 0.85 + 0.25 * R(); rgb[i * 3] = 46 * v; rgb[i * 3 + 1] = 44 * v; rgb[i * 3 + 2] = 40 * v; }
    for (let i = 0; i < 70; i++) {   // stains: each darker at its heart, a tide-line and a pale bloom at its rim
      const cx = R() * SIZE, cy = R() * SIZE, r = 6 + 26 * R() * R();
      for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        const d = Math.hypot((x - cx) / r, (y - cy) / (r * 0.8)) + 0.07 * Math.sin(Math.atan2(y - cy, x - cx) * 3 + i) + 0.05 * Math.sin(Math.atan2(y - cy, x - cx) * 7 + 2 * i);
        if (d > 1.12) continue;
        const o = ((((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)) * 3;
        const k = d > 1 ? 1.35 : d > 0.92 ? 0.62 : 0.8 + 0.12 * d;
        put(x, y, [rgb[o], rgb[o + 1], rgb[o + 2]], k);
      }
    }
    for (let i = 0; i < 3000; i++) put((R() * SIZE) | 0, (R() * SIZE) | 0, R() < 0.5 ? [24, 22, 20] : [84, 80, 72]);   // grit
  },
  hex(rgb, R) { cells(rgb, R, hexSeeds(), { tones: [[150, 140, 124], [134, 126, 114], [164, 152, 132], [122, 118, 110]], joint: 2.2, bevel: 7, crack: 0.12 }); },
  incertum(rgb, R) {
    // jittered seeds: a coarse grid shaken hard, so stones vary in size and shape (non-congruent), then wrapped
    const pts = []; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) pts.push([(i + 0.15 + 0.7 * R()) * SIZE / 5, (j + 0.15 + 0.7 * R()) * SIZE / 5]);
    cells(rgb, R, pts, { tones: [[142, 132, 116], [126, 120, 110], [156, 144, 126], [116, 110, 102], [136, 128, 120]], joint: 2.8, bevel: 6, crack: 0.08, wobble: 4 });
  },
  stars(rgb, R) {
    const put = (x, y, c) => { const xi = ((x % SIZE) + SIZE) % SIZE, yi = ((y % SIZE) + SIZE) % SIZE, o = (yi * SIZE + xi) * 3; for (let q = 0; q < 3; q++) rgb[o + q] = clamp(c[q]); };
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const m = 0.88 + 0.1 * wrapNoise(x, y, 32, 11) + 0.06 * R();
      // flaking where damp has lifted the paint: pale plaster shows through in patches
      const flake = wrapNoise(x, y, 64, 13) > 0.8 && wrapNoise(x, y, 16, 17) > 0.5;
      const c = flake ? [118, 116, 108] : [30, 40, 82];
      for (let q = 0; q < 3; q++) rgb[(y * SIZE + x) * 3 + q] = clamp(c[q] * m);
    }
    // gilt six-point stars on a staggered grid, each a little off its place and its size
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const cx = (i + (j % 2) * 0.5 + 0.2 * (R() - 0.5)) * SIZE / 8, cy = (j + 0.2 * (R() - 0.5)) * SIZE / 8, r = 5 + 2.5 * R();
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const a = Math.atan2(y, x), d = Math.hypot(x, y), edge = r * (0.45 + 0.55 * Math.pow(Math.abs(Math.cos(3 * a)), 6));
        if (d <= edge) put(Math.round(cx + x), Math.round(cy + y), d < r * 0.3 ? [238, 206, 120] : [196, 156, 70]);
      }
    }
  },
};

/** Smooth value noise on a `period`-pixel lattice that wraps at the tile's edge. */
function wrapNoise(x, y, period, seed) {
  const n = SIZE / period, h = (i, j) => { let v = Math.imul(((i % n) + n) % n, 374761393) ^ Math.imul(((j % n) + n) % n, 668265263) ^ Math.imul(seed, 2246822519); v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const fx = x / period, fy = y / period, ix = Math.floor(fx), iy = Math.floor(fy), ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
  return h(ix, iy) * (1 - sx) * (1 - sy) + h(ix + 1, iy) * sx * (1 - sy) + h(ix, iy + 1) * (1 - sx) * sy + h(ix + 1, iy + 1) * sx * sy;
}
/** The hex lattice's centres: 4 across, 6 rows, odd rows offset half a cell; it wraps, so the cells are hexagons. */
function hexSeeds() { const pts = []; for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) pts.push([(i + (j % 2) * 0.5) * SIZE / 4, (j + 0.5) * SIZE / 6]); return pts; }
/**
 * Stones as the Voronoi cells of `pts` on the wrapped tile: a stone is the pixels nearest its seed, the joint where the
 * nearest and next-nearest are within `joint` px of equal; each stone its own tone, darker toward its joint (`bevel`
 * px), a share `crack` cracked across. `wobble` px of noise bends the joints so they wander.
 */
function cells(rgb, R, pts, { tones, joint, bevel, crack, wobble = 0 }) {
  const tone = pts.map(() => { const m = 0.88 + 0.24 * R(); return tones[(R() * tones.length) | 0].map((v) => v * m); });   // one value per stone: its hue stays the family's
  const cracked = pts.map(() => (R() < crack ? [R() * Math.PI, R() * 2 - 1] : null));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const wx = x + (wobble ? (wrapNoise(x, y, 16, 21) - 0.5) * 2 * wobble : 0), wy = y + (wobble ? (wrapNoise(x, y, 16, 23) - 0.5) * 2 * wobble : 0);
    let d1 = Infinity, d2 = Infinity, k1 = 0, v1 = null;
    pts.forEach((p, k) => {
      let dx = Math.abs(wx - p[0]) % SIZE, dy = Math.abs(wy - p[1]) % SIZE; dx = Math.min(dx, SIZE - dx); dy = Math.min(dy, SIZE - dy);
      const d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; k1 = k; v1 = [wx - p[0], wy - p[1]]; } else if (d < d2) d2 = d;
    });
    const gap = (d2 - d1) / 2, o = (y * SIZE + x) * 3;
    if (gap < joint) { const m = 0.85 + 0.3 * R(); rgb[o] = clamp(40 * m); rgb[o + 1] = clamp(37 * m); rgb[o + 2] = clamp(34 * m); continue; }
    let k = (0.78 + 0.22 * Math.min(1, (gap - joint) / bevel)) * (0.93 + 0.14 * R());
    const c = cracked[k1];
    if (c) { const dd = Math.abs(Math.cos(c[0]) * v1[1] - Math.sin(c[0]) * v1[0] - c[1] * 6 + 3 * Math.sin(v1[0] * 0.2)); if (dd < 0.9) k *= 0.45; }
    for (let q = 0; q < 3; q++) rgb[o + q] = clamp(tone[k1][q] * k);
  }
}

export const FLOOR_KEYS = Object.freeze(Object.keys(PAINTERS).map((k) => (k === 'stars' ? `vault:${k}` : `floor:${k}`)));
const built = {};
export function floorTexture(key) {
  if (built[key]) return built[key];
  const paint = PAINTERS[key.slice(key.indexOf(':') + 1)]; if (!paint) return null;
  let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rgb = Buffer.alloc(SIZE * SIZE * 3); paint(rgb, mulberry32(h >>> 0));
  return (built[key] = `data:image/png;base64,${encodePng(rgb, SIZE, SIZE).toString('base64')}`);
}

registerTextureResolver('floor:', floorTexture);
registerTextureResolver('vault:', floorTexture);
