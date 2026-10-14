/**
 * finishes/patterns — floor patterns and wallpapers as procedural tiles, in any colours. A pattern's texture key
 * carries everything it is drawn from, `finish:<pattern>:<hex>:<hex>[:<hex>]`, so a house can wear a herringbone in its
 * own oak and a botanical paper in its own greens without a tile per combination being registered or stored. The
 * tiles ride the surface-texture path (landscape/surface-textures.js): drawn multiply-lit in the World, as the albedo in
 * the GLB. Deterministic: a tile is a pure function of its key.
 *
 * Each pattern names the size of floor or wall its tile covers (`tileFt`), which is how a face maps its uv.
 */
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';

const N = 256;
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
// integer hash → [0, 1)
function hash(...v) {
  let h = 0x811c9dc5;
  for (const x of v) { h ^= (x | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
const fract = (v) => v - Math.floor(v);
const mod = (a, n) => ((a % n) + n) % n;
// wood grain along a plank: fine streaks and a little figure, by the plank's own seed
const grain = (along, across, seed) => 0.92 + 0.08 * Math.sin(across * 37 + seed * 11 + Math.sin(along * 3 + seed) * 2) + 0.03 * Math.sin(along * 0.7 + seed * 5);

// ── floors ──────────────────────────────────────────────────────────────────────────────────────────────────────
// c[0] the wood or the main tile, c[1] the second (a seam, a grout or the other tile), c[2] a third where one is drawn

function planks(cols, rows) {
  return (x, y, c) => {
    const row = Math.floor(y * rows), off = hash(row, 7) * 0.9;
    const u = fract(x + off) * cols, col = Math.floor(u), id = row * 31 + col;
    const tone = 0.86 + hash(id, 3) * 0.24;
    const ly = fract(y * rows), lx = fract(u);
    const seam = ly < 0.035 || lx < 0.012 ? 0.62 : 1;
    return shade(mix(c[0], c[1], hash(id, 9) * 0.25), tone * seam * grain(u, ly, id));
  };
}

// herringbone at 45° to the walls (plank ratio k): the lattice of one plank each way, v1 = (1, 1), v2 = (k, −k), whose
// images under the 45° turn are axis-aligned, so the tile is √2·k planks wide each way and repeats seamlessly
function herringbone(k) {
  const S = Math.SQRT2 * k;
  return (x, y, c) => {
    const X = x * S, Y = y * S;
    const px = (X - Y) / Math.SQRT2, py = (X + Y) / Math.SQRT2;
    const a0 = Math.floor((px + py) / 2), b0 = Math.floor((px - py) / (2 * k));
    // an upright plank reaches k rows above its lattice point, so the search runs that far
    for (let da = -(k + 2); da <= 2; da += 1) {
      for (let db = -2; db <= 2; db += 1) {
        const a = a0 + da, b = b0 + db;
        const rx = px - (a + b * k), ry = py - (a - b * k);
        const H = rx >= 0 && rx < k && ry >= 0 && ry < 1, V = rx >= 0 && rx < 1 && ry >= 1 && ry < 1 + k;
        if (!H && !V) continue;
        const along = H ? rx : ry - 1, across = H ? ry : rx;
        const id = (mod(a, 997) * 131 + mod(b, 991)) * 2 + (H ? 0 : 1);
        const seam = across < 0.07 || across > 0.93 || along < 0.04 || along > k - 0.04 ? 0.55 : 1;
        return shade(mix(c[0], c[1], hash(id, 9) * 0.45), (0.8 + hash(id, 3) * 0.32) * seam * grain(along * 0.6, across, id));
      }
    }
    return c[1];
  };
}

// chevron: columns of planks cut at 45°, alternate columns sloping the other way, the cuts meeting in a V
function chevron(cols, rows) {
  return (x, y, c) => {
    const u = x * cols, col = Math.floor(u), lx = fract(u);
    const dir = col % 2 ? 1 : -1;
    const v = y * rows + dir * (lx - 0.5) * (rows / cols) * 2;
    const row = Math.floor(v), ly = fract(v), id = mod(row, 97) * 13 + col;
    const seam = ly < 0.05 || lx < 0.02 || lx > 0.98 ? 0.6 : 1;
    return shade(mix(c[0], c[1], hash(id, 9) * 0.25), (0.86 + hash(id, 3) * 0.24) * seam * grain(lx, ly, id));
  };
}

// basketweave parquet: squares of three strips, each square turned against its neighbours
function basketweave(n) {
  return (x, y, c) => {
    const cx = Math.floor(x * n), cy = Math.floor(y * n);
    const lx = fract(x * n), ly = fract(y * n), turn = (cx + cy) % 2;
    const across = turn ? lx : ly, along = turn ? ly : lx;
    const strip = Math.floor(across * 3), id = (cx * 7 + cy) * 3 + strip;
    const seam = fract(across * 3) < 0.06 || lx < 0.02 || ly < 0.02 ? 0.6 : 1;
    return shade(mix(c[0], c[1], hash(id, 9) * 0.25), (0.86 + hash(id, 3) * 0.24) * seam * grain(along, across, id));
  };
}

function checker(n) {
  return (x, y, c) => {
    const lx = fract(x * n), ly = fract(y * n);
    if (lx < 0.02 || ly < 0.02) return mix(c[0], c[1], 0.5);
    const base = (Math.floor(x * n) + Math.floor(y * n)) % 2 ? c[1] : c[0];
    return shade(base, 0.97 + 0.03 * hash(Math.floor(x * n), Math.floor(y * n)));
  };
}

// hexagons (pointy-topped) on a grid that repeats: `cols` across and 2·`pairs` rows down, the rows a hair stretched so
// the tile is square; a cell is its nearest centre, and the grout where two centres are nearly as near
function hexes(cols, pairs) {
  const rows = 2 * pairs, H = rows * 1.5, sx = H / (cols * Math.sqrt(3));   // horizontal spacing scaled to make it square
  return (x, y, c) => {
    const X = x * H, Y = y * H;
    let d1 = Infinity, d2 = Infinity, best = null;
    const r0 = Math.floor(Y / 1.5);
    for (let r = r0 - 1; r <= r0 + 2; r += 1) {
      const off = mod(r, 2) ? Math.sqrt(3) / 2 : 0;
      const c0 = Math.round((X / sx - off) / Math.sqrt(3));
      for (let q = c0 - 1; q <= c0 + 1; q += 1) {
        const cx = (off + q * Math.sqrt(3)) * sx, cy = r * 1.5;
        const d = Math.hypot(X - cx, Y - cy);
        if (d < d1) { d2 = d1; d1 = d; best = [mod(q, cols), mod(r, rows)]; } else if (d < d2) d2 = d;
      }
    }
    if (d2 - d1 < 0.1) return c[1];
    const pick = c[2] && hash(best[0], best[1]) < 0.12 ? c[2] : c[0];
    return shade(pick, 0.96 + 0.04 * hash(best[0], best[1], 7));
  };
}

// large slabs, one stone with a soft mottle, joined by a hairline
function slabs(n) {
  return (x, y, c) => {
    const lx = fract(x * n), ly = fract(y * n);
    if (lx < 0.006 || ly < 0.006) return mix(c[0], c[1], 0.6);
    const T = Math.PI * 2;   // whole periods across the tile, so it repeats without a seam
    const m = 0.035 * Math.sin(T * (2 * x + y) + Math.sin(T * 3 * y)) + 0.025 * Math.sin(T * (3 * y - x));
    return shade(c[0], 0.97 + m);
  };
}

function terrazzo(chips) {
  return (x, y, c) => {
    let col = c[0];
    const g = 14, cx = Math.floor(x * g), cy = Math.floor(y * g);
    for (let i = -1; i <= 1; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const gx = mod(cx + i, g), gy = mod(cy + j, g);
        for (let k = 0; k < chips; k += 1) {
          const px = (cx + i + hash(gx, gy, k, 1)) / g, py = (cy + j + hash(gx, gy, k, 2)) / g, rr = (0.08 + hash(gx, gy, k, 3) * 0.22) / g;
          if (Math.hypot(x - px, (y - py) * (1 + hash(gx, gy, k, 4))) < rr) col = hash(gx, gy, k, 5) < 0.5 ? c[1] : (c[2] || shade(c[1], 0.7));
        }
      }
    }
    return col;
  };
}

// ── wallpapers ──────────────────────────────────────────────────────────────────────────────────────────────────
// c[0] the ground, c[1] the figure, c[2] a second figure where one is drawn

const stripe = (n, share) => (x, y, c) => (fract(x * n) < share ? c[1] : c[0]);
const pinstripe = (n) => (x, y, c) => (fract(x * n) < 0.06 ? c[1] : c[0]);
const gingham = (n) => (x, y, c) => {
  const a = fract(x * n) < 0.5, b = fract(y * n) < 0.5;
  return a && b ? c[1] : a || b ? mix(c[0], c[1], 0.5) : c[0];
};
// a diamond trellis: lines at ±45° crossing on the tile's grid, a small knot where they cross
const trellis = (n) => (x, y, c) => {
  const u = fract((x + y) * n), v = fract((x - y) * n);
  const line = Math.min(u, 1 - u) < 0.035 || Math.min(v, 1 - v) < 0.035;
  const knot = Math.hypot(fract(x * n * 2 + 0.5) - 0.5, fract(y * n * 2 + 0.5) - 0.5) < 0.06 && (Math.round(x * n * 2) + Math.round(y * n * 2)) % 2 === 0;
  return knot ? (c[2] || c[1]) : line ? c[1] : c[0];
};
// fish-scale scallops: rows of arcs, each row offset by half
const scallop = (n) => (x, y, c) => {
  const row = Math.floor(y * n), ox = row % 2 ? 0.5 : 0;
  const lx = fract(x * n + ox) - 0.5, ly = fract(y * n);
  const d = Math.hypot(lx, ly - 1);
  return d > 0.47 && d < 0.53 ? c[1] : (d < 0.47 && c[2] && d > 0.38 && d < 0.42 ? c[2] : c[0]);
};
const polka = (n) => (x, y, c) => {
  const row = Math.floor(y * n), ox = row % 2 ? 0.5 : 0;
  return Math.hypot(fract(x * n + ox) - 0.5, fract(y * n) - 0.5) < 0.16 ? c[1] : c[0];
};
// grasscloth: a woven ground of horizontal fibres, slubbed
const grasscloth = () => (x, y, c) => {
  const f = Math.floor(y * 180), slub = hash(f, Math.floor(x * 9)) * 0.18;
  return shade(mix(c[0], c[1], 0.15 + slub), 0.93 + 0.07 * Math.sin(Math.PI * 2 * 9 * x + f));
};
// a botanical: leaves on curving stems, scattered on a lattice that wraps, each turned and sized by its own seed
const botanical = (n) => (x, y, c) => {
  let col = c[0];
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      const gx = Math.floor(x * n) + i, gy = Math.floor(y * n) + j;
      const kx = mod(gx, n), ky = mod(gy, n);
      for (let k = 0; k < 3; k += 1) {
        const cx = (gx + hash(kx, ky, k, 1)) / n, cy = (gy + hash(kx, ky, k, 2)) / n;
        const a = hash(kx, ky, k, 3) * Math.PI * 2, len = (0.35 + hash(kx, ky, k, 4) * 0.25) / n, wid = len * 0.32;
        const dx = x - cx, dy = y - cy, u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
        const t = u / len;
        if (t > -1 && t < 1 && Math.abs(v) < wid * Math.sqrt(1 - t * t)) col = Math.abs(v) < wid * 0.08 ? shade(c[1], 0.75) : (k === 2 && c[2] ? c[2] : c[1]);
      }
    }
  }
  return col;
};
// a damask-like medallion: a rose of petals at each lattice point, rows offset
const medallion = (n) => (x, y, c) => {
  const row = Math.floor(y * n), ox = row % 2 ? 0.5 : 0;
  const lx = fract(x * n + ox) - 0.5, ly = fract(y * n) - 0.5;
  const r = Math.hypot(lx, ly * 0.8), a = Math.atan2(ly, lx);
  const petal = 0.22 + 0.12 * Math.cos(a * 6);
  return r < petal && r > petal - 0.05 ? c[1] : r < 0.06 ? (c[2] || c[1]) : c[0];
};

// ── the tables ──────────────────────────────────────────────────────────────────────────────────────────────────

export const FLOOR_PATTERNS = Object.freeze({
  'straight-plank': { label: 'straight plank', line: 'boards laid along the room, ends staggered', tileFt: 6, draw: planks(1, 12), wood: true },
  'wide-plank': { label: 'wide plank', line: 'wide boards (9 in), long and quiet', tileFt: 9, draw: planks(1, 12), wood: true },
  herringbone: { label: 'herringbone', line: 'short planks at 45°, each end butting the next plank’s side', tileFt: 3, draw: herringbone(4), wood: true },
  chevron: { label: 'chevron', line: 'planks cut at 45° meeting in a point, an unbroken zigzag', tileFt: 3, draw: chevron(4, 8), wood: true },
  basketweave: { label: 'basketweave parquet', line: 'squares of three strips, each turned against its neighbours', tileFt: 2, draw: basketweave(4), wood: true },
  checkerboard: { label: 'checkerboard', line: 'square tiles of two colours alternating', tileFt: 2, draw: checker(2) },
  'hex-tile': { label: 'hexagon tile', line: 'small hexagons with a fine grout, the odd one in a third colour', tileFt: 1.5, draw: hexes(7, 4) },
  terrazzo: { label: 'terrazzo', line: 'a cast ground with chips of stone through it', tileFt: 3, draw: terrazzo(2) },
  'large-format': { label: 'large-format stone', line: 'big slabs with hairline joints', tileFt: 4, draw: slabs(1) },
});

export const WALLPAPERS = Object.freeze({
  stripe: { label: 'regency stripe', line: 'broad stripes of two colours', tileFt: 2, draw: stripe(4, 0.5) },
  pinstripe: { label: 'pinstripe', line: 'fine lines on a ground', tileFt: 2, draw: pinstripe(10) },
  gingham: { label: 'gingham check', line: 'a small woven check', tileFt: 1, draw: gingham(6) },
  trellis: { label: 'trellis', line: 'a diamond lattice with knots where it crosses', tileFt: 2, draw: trellis(3) },
  scallop: { label: 'scallop', line: 'rows of fish-scale arcs', tileFt: 1.5, draw: scallop(5) },
  polka: { label: 'polka dot', line: 'dots in offset rows', tileFt: 1.5, draw: polka(6) },
  grasscloth: { label: 'grasscloth', line: 'woven grass fibres, slubbed and textural', tileFt: 3, draw: grasscloth() },
  botanical: { label: 'botanical', line: 'leaves scattered on curving stems', tileFt: 2, draw: botanical(3) },
  damask: { label: 'damask medallion', line: 'a petalled medallion in offset rows', tileFt: 1.5, draw: medallion(3) },
});

const ALL = { ...FLOOR_PATTERNS, ...WALLPAPERS };
const HEX = /^#[0-9a-f]{6}$/i;

/** The texture key for a pattern in its colours. */
export function patternKey(pattern, colours) {
  return `finish:${pattern}:${colours.map((c) => c.toLowerCase()).join(':')}`;
}

/** A pattern key → its tile, a `data:image/png` URL, or null. */
export function patternTile(key) {
  const [, pattern, ...hexes] = String(key).split(':');
  const P = ALL[pattern];
  if (!P || hexes.length < 2 || hexes.some((h) => !HEX.test(h))) return null;
  const c = hexes.map(hexRgb);
  const rgb = Buffer.alloc(N * N * 3);
  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < N; i += 1) {
      const px = P.draw((i + 0.5) / N, (j + 0.5) / N, c);
      const o = (j * N + i) * 3;
      rgb[o] = clamp8(px[0]); rgb[o + 1] = clamp8(px[1]); rgb[o + 2] = clamp8(px[2]);
    }
  }
  return `data:image/png;base64,${encodePng(rgb, N, N).toString('base64')}`;
}

const CACHE = new Map();
registerTextureResolver('finish:', (key) => {
  if (!CACHE.has(key)) CACHE.set(key, patternTile(key));
  return CACHE.get(key);
});
