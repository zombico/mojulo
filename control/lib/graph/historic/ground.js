/**
 * historic/ground — what the town stands on, read at street level. A historic town's ground is not
 * one flat colour: alleys are beaten mud, the main streets are packed with rubble and potsherds,
 * sacred and wet ground (the precinct, the quays, a good court) is laid in baked brick, and outside
 * the wall the earth dries and cracks. Each surface is a small seamless tile, baked in the culture's
 * colours (seeded, deterministic), tiled by world position so neighbouring strips meet without seams.
 *
 * Emission: the CSS 3D page embeds each tile ONCE as a CSS custom property and every ground face
 * references it (a data URL per face would multiply the page size by the lane count); the WebGL
 * World gets the same tile through the surface-texture resolver (`historic-<surface>-<hex>` keys).
 */
import zlib from 'node:zlib';
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';
import { relief, ell, quad, PIG, sceneRegister, smitingScene, columnScene, caption } from './skin-art.js';

/** Surfaces, and how many metres one tile covers. */
export const GROUND_SURFACES = { mud: 4, rubble: 3, brick: 2.4, 'dry-earth': 6, 'cone-mosaic': 1.6, flagstone: 6 };   // the mosaic's cones are drawn large: a big read, not a count
// the fields: ard furrows ~0.4 m apart, rows of shoots on them, stubble after the sickle, standing barley
Object.assign(GROUND_SURFACES, { furrows: 3, sown: 3, stubble: 3, barley: 2, 'drying-bricks': 3 });
// a skin, not a ground: the cone mosaic of Uruk — clay cones pressed head-out into the wall, their
// heads dipped red, black or left white, set in zigzags and lozenges. Its tile ignores the base colour.

function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// seamless value noise: a wrapped lattice, smooth-interpolated
function noise(size, cells, rng) {
  const g = Array.from({ length: cells * cells }, () => rng());
  const at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / size) * cells, fy = (y / size) * cells, i = Math.floor(fx), j = Math.floor(fy), u = s(fx - i), v = s(fy - j);
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  };
}
// stamp a soft disc (a pebble, a sherd, a puddle) with wrap-around
function stamp(px, size, cx, cy, r, col, a) {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
    const d = Math.hypot(x, y) / r; if (d > 1) continue;
    const k = a * (d < 0.7 ? 1 : (1 - d) / 0.3), i = ((((cy + y) % size) + size) % size) * size + ((((cx + x) % size) + size) % size);
    for (let c = 0; c < 3; c++) px[i * 3 + c] = px[i * 3 + c] * (1 - k) + col[c] * k;
  }
}

const BAKERS = {
  // beaten mud: a low mottle, footworn paler patches, scattered grit and the odd sherd
  mud(base, size, rng) {
    const px = new Float64Array(size * size * 3), n1 = noise(size, 4, rng), n2 = noise(size, 16, rng);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const v = 1 + (n1(x, y) - 0.5) * 0.16 + (n2(x, y) - 0.5) * 0.08 + (rng() - 0.5) * 0.05;
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = base[c] * v;
    }
    for (let k = 0; k < size * 0.9; k++) stamp(px, size, Math.floor(rng() * size), Math.floor(rng() * size), 0.8 + rng() * 1.2, base.map((v) => v * (rng() < 0.5 ? 0.72 : 1.18)), 0.6);
    for (let k = 0; k < 3; k++) stamp(px, size, Math.floor(rng() * size), Math.floor(rng() * size), 2 + rng() * 2, [176, 96, 64], 0.55);   // potsherds
    return px;
  },
  // packed rubble: a crowd of rounded stones and sherds in a darker earth bed
  rubble(base, size, rng) {
    const px = new Float64Array(size * size * 3), bed = base.map((v) => v * 0.7), n = noise(size, 8, rng);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = bed[c] * (0.92 + n(x, y) * 0.16);
    for (let k = 0; k < size * 1.4; k++) {
      const r = (1.6 + rng() * rng() * 7) * (size / 256), tone = 0.82 + rng() * 0.4, warm = rng() < 0.05;
      const col = warm ? [182, 104, 70] : base.map((v) => v * tone);
      const cx = Math.floor(rng() * size), cy = Math.floor(rng() * size);
      stamp(px, size, cx + 1, cy + 2, r, bed.map((v) => v * 0.55), 0.55);   // its shadow
      stamp(px, size, cx, cy, r, col, 0.95);
    }
    return px;
  },
  // baked brick paving: square bricks laid in courses, mud joints a shade darker than the brick, each
  // brick its own tone and worn at its edges, a few cracked or sunk
  brick(base, size, rng) {
    const px = new Float64Array(size * size * 3), per = 8, b = size / per, joint = Math.max(1.5, b * 0.08), n = noise(size, 10, rng), m = noise(size, 32, rng);
    const tones = Array.from({ length: per * per }, () => 0.86 + rng() * 0.22 + (rng() < 0.08 ? -0.12 : 0));
    const mortar = base.map((v) => v * 0.74);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const j = Math.floor(y / b), sx = x + (j % 2 ? b / 2 : 0), i = Math.floor(sx / b) % per, lx = sx - Math.floor(sx / b) * b, ly = y - j * b;   // running bond
      const inJoint = lx < joint || ly < joint, wear = 0.93 + n(x, y) * 0.1 + (m(x, y) - 0.5) * 0.06;
      const edge = Math.min(lx - joint, ly - joint, b - lx, b - ly) < joint * 1.2 ? 0.95 : 1;
      const col = inJoint ? mortar.map((v) => v * (0.95 + m(x, y) * 0.1)) : base.map((v) => v * tones[j * per + i] * wear * edge);
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = col[c];
    }
    return px;
  },
  // cone mosaic: cone heads in a grid, red / black / white — a black zigzag band over a row of red
  // lozenges with black hearts, on white; the pattern the sheet shows, drawn bold enough to read
  'cone-mosaic'(base, size, rng) {
    const px = new Float64Array(size * size * 3), per = 12, b = size / per, R = [184, 67, 47], K = [43, 39, 36], Wt = [239, 233, 220];
    for (let i = 0; i < px.length; i += 3) { px[i] = 96; px[i + 1] = 84; px[i + 2] = 72; }   // the mud the cones sit in
    for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
      const u = i % 6, v = j % 12, zig = v < 4 && Math.abs(u - 3) === 3 - v % 4 + (v >= 4 ? 0 : 0);
      const lz = v >= 5 && v <= 11 ? Math.abs(u - 3) + Math.abs(v - 8) : 99;
      const col = zig ? K : lz <= 1 ? K : lz <= 3 ? R : v === 4 ? R : Wt;
      const cx = Math.floor(i * b + b / 2), cy = Math.floor(j * b + b / 2);
      stamp(px, size, cx, cy, b * 0.48, col.map((c) => c * (0.93 + rng() * 0.12)), 1);
    }
    return px;
  },
  // stone flags: big sandstone slabs of uneven length in rows, fine joints, each slab its own tone
  flagstone(base, size, rng) {
    const px = new Float64Array(size * size * 3), rows = 5, rh = size / rows, n = noise(size, 12, rng), mortar = base.map((v) => v * 0.78);
    const cuts = Array.from({ length: rows }, () => { const c = [], o = rng() * size; let x = 0; while (x < size - size * 0.12) { c.push((x + o) % size); x += size * (0.18 + rng() * 0.22); } return c.sort((a, b) => a - b); });
    const tone = Array.from({ length: rows * 12 }, () => 0.9 + rng() * 0.16);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = Math.floor(y / rh), ly = y - r * rh, cs = cuts[r];
      let bi = cs.length - 1; for (let q = 0; q < cs.length; q++) if (x >= cs[q]) bi = q;
      const joint = ly < 1.4 || cs.some((c) => Math.abs(x - c) < 1.2);
      const col = joint ? mortar : base.map((v) => v * tone[r * 12 + bi] * (0.95 + n(x, y) * 0.08));
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = col[c];
    }
    return px;
  },
  // ard furrows: ridges running down the tile (along a field's length), each a lit crest and a shaded
  // trough, clods turned up along them; `shoots` sets a row of green on each crest (a sown field)
  furrows(base, size, rng, shoots = 0) {
    const px = new Float64Array(size * size * 3), per = 8, b = size / per, n = noise(size, 6, rng), m = noise(size, 24, rng);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x % b) / b, ridge = 0.8 + 0.34 * Math.sin(u * Math.PI) - (u > 0.82 ? 0.12 : 0), v = ridge * (0.92 + n(x, y) * 0.12 + (m(x, y) - 0.5) * 0.08);
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = base[c] * v;
    }
    for (let k = 0; k < size * 1.2; k++) { const i = Math.floor(rng() * per), cx = Math.floor(i * b + b * (0.3 + rng() * 0.4)), cy = Math.floor(rng() * size); stamp(px, size, cx + 1, cy + 1, 0.8 + rng() * 1.6, base.map((v) => v * 0.62), 0.6); stamp(px, size, cx, cy, 0.8 + rng() * 1.6, base.map((v) => v * 1.12), 0.8); }
    if (shoots) for (let i = 0; i < per; i++) for (let y = 0; y < size; y += 2 + Math.floor(rng() * 3)) stamp(px, size, Math.floor(i * b + b * 0.5 + (rng() - 0.5) * 3), y, 1.1 + rng() * shoots, [92 + rng() * 30, 128 + rng() * 34, 58 + rng() * 18], 0.9);
    return px;
  },
  sown(base, size, rng) { return BAKERS.furrows(base, size, rng, 1.4); },
  // stubble: cut straw stalks in rows on pale earth, loose straw and the odd fallen ear between them
  stubble(base, size, rng) {
    const px = new Float64Array(size * size * 3), n = noise(size, 6, rng), rows = 12, b = size / rows;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = 0.9 + n(x, y) * 0.16; for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = base[c] * v; }
    for (let i = 0; i < rows; i++) for (let y = 0; y < size; y += 2) { const x = Math.floor(i * b + b / 2 + (rng() - 0.5) * b * 0.5); stamp(px, size, x + 1, y + 1, 0.9, base.map((v) => v * 0.6), 0.5); stamp(px, size, x, y, 0.9, [214, 190, 120], 0.8); }
    for (let k = 0; k < size * 0.5; k++) { const x0 = rng() * size, y0 = rng() * size, a = rng() * 6.283, len = 4 + rng() * 9; for (let t = 0; t < len; t++) stamp(px, size, Math.floor(x0 + Math.cos(a) * t), Math.floor(y0 + Math.sin(a) * t), 0.6, [226, 204, 140], 0.7); }
    return px;
  },
  // standing barley from above and aslant: a dense crowd of ears, gold with darker beards, lit and
  // shaded where the stand bends in the wind
  barley(base, size, rng) {
    const px = new Float64Array(size * size * 3), n = noise(size, 4, rng), m = noise(size, 14, rng);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = 0.78 + n(x, y) * 0.22 + (m(x, y) - 0.5) * 0.1; for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = base[c] * v * 0.85; }
    for (let k = 0; k < size * 7; k++) {
      const cx = Math.floor(rng() * size), cy = Math.floor(rng() * size), tone = 0.95 + rng() * 0.3, lean = (n(cx, cy) - 0.5) * 2;
      for (let t = 0; t < 5; t++) stamp(px, size, Math.round(cx + lean * t * 0.6), cy - t, 0.9, base.map((v) => v * tone), 0.85);
      stamp(px, size, Math.round(cx + lean * 3.6), cy - 6, 0.7, base.map((v) => v * 0.7), 0.6);   // the beard
    }
    return px;
  },
  // a moulding field: fresh bricks laid flat in long rows on sanded earth to dry, a hand's gap between
  // them and a walkway between rows; the drier ones paler; here and there one turned on its edge
  'drying-bricks'(base, size, rng) {
    const px = new Float64Array(size * size * 3), n = noise(size, 6, rng), sand = base.map((v) => v * 1.1);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = 0.94 + n(x, y) * 0.1; for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = sand[c] * v; }
    const rows = 3, rh = size / rows, bw = size / 14, bd = rh * 0.3, clay = base.map((v) => v * 0.74);
    for (let j = 0; j < rows; j++) for (let k = 0; k < 2; k++) for (let i = 0; i < 14; i++) {
      const x0 = Math.floor(i * bw + bw * 0.12), y0 = Math.floor(j * rh + rh * 0.08 + k * (bd + rh * 0.04)), dry = 0.9 + rng() * 0.24, edge = rng() < 0.06;
      const w = edge ? Math.floor(bw * 0.3) : Math.floor(bw * 0.76), d = Math.floor(bd);
      for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
        const lit = y < 2 || x < 1 ? 1.1 : y > d - 3 ? 0.78 : 1, i3 = (((y0 + y) % size) * size + ((x0 + x) % size)) * 3;
        for (let c = 0; c < 3; c++) px[i3 + c] = clay[c] * dry * lit * (0.97 + rng() * 0.06);
      }
      for (let x = 0; x < w; x++) { const i3 = (((y0 + d) % size) * size + ((x0 + x) % size)) * 3; for (let c = 0; c < 3; c++) px[i3 + c] *= 0.72; }   // its shadow
    }
    return px;
  },
  // dry earth: a sun-baked crust broken by a polygon crack network
  'dry-earth'(base, size, rng) {
    const px = new Float64Array(size * size * 3), n = noise(size, 5, rng), seeds = Array.from({ length: 22 }, () => [rng() * size, rng() * size]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let d1 = Infinity, d2 = Infinity;
      for (const [sx, sy] of seeds) for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const d = Math.hypot(x - sx - ox, y - sy - oy);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const crack = d2 - d1 < 1.4 ? 0.62 : 1, v = (0.94 + n(x, y) * 0.12) * crack;
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = base[c] * v;
    }
    return px;
  },
};

const cache = new Map();
/** The PNG data URL for a surface in a base colour (memoised; deterministic). */
export function groundTile(surface, baseHex, size = 256) {
  const key = `${surface}|${baseHex}|${size}`;
  if (!cache.has(key)) {
    const bake = BAKERS[surface];
    if (!bake) throw new Error(`unknown ground surface '${surface}'`);
    let seed = 0; for (const c of key) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    const px = bake(hexRgb(baseHex), size, rngOf(seed));
    const rgb = Buffer.alloc(size * size * 3);
    for (let i = 0; i < px.length; i++) rgb[i] = clamp(px[i]);
    cache.set(key, `data:image/png;base64,${encodePng(rgb, size, size).toString('base64')}`);
  }
  return cache.get(key);
}

/** The texture key a ground face carries (CSS var name and World resolver key in one). */
export const groundKey = (surface, baseHex) => `historic-${surface}-${baseHex.slice(1)}`;
registerTextureResolver('historic-', (key) => {
  const m = /^historic-(.+)-([0-9a-f]{6})$/.exec(key);
  return m && BAKERS[m[1]] ? groundTile(m[1], `#${m[2]}`) : null;
});

/**
 * A ground rect (scene units) → a face painting its surface by world position. `us` is the scene's
 * px per unit, `mpu` metres per unit. The background refers to the page-level CSS variable.
 */
export function groundTileFace(g, surface, baseHex, fill, { us, mpu }) {
  const key = groundKey(surface, baseHex), tileU = GROUND_SURFACES[surface] / mpu, tilePx = tileU * us;
  const off = (v) => (-(((v % tileU) + tileU) % tileU) * us).toFixed(2);
  const corners = [[g.x, g.y, g.z], [g.x + g.w, g.y, g.z], [g.x + g.w, g.y + g.d, g.z], [g.x, g.y + g.d, g.z]];
  return {
    corners, fill, doubleSided: true,
    bg: `var(--${key}) ${off(g.x)}px ${off(g.y)}px / ${tilePx.toFixed(2)}px ${tilePx.toFixed(2)}px repeat`,
    texture: key, uv: corners.map((c) => [c[0] / tileU, c[1] / tileU]),
  };
}

/** The page-level CSS defining every ground tile the faces reference. */
export function groundTileCss(faces) {
  const keys = [...new Set(faces.filter((f) => f.texture && f.texture.startsWith('historic-')).map((f) => f.texture))].sort();
  const skins = [...new Set(faces.filter((f) => f.skin).map((f) => f.skin))].sort();
  if (!keys.length && !skins.length) return '';
  const defs = keys.map((k) => { const m = /^historic-(.+)-([0-9a-f]{6})$/.exec(k); return `--${k}:url('${groundTile(m[1], `#${m[2]}`)}')`; });
  for (const k of skins) { const m = /^historic-skin-(.+)-(\d)$/.exec(k); defs.push(`--${k}:url('${skinTile(m[1], +m[2])}')`); }
  return `  :root{${defs.join(';')}}\n`;
}

// ── wall skins: what a wall is made of, read on its face ──
//
// A skin is a TRANSPARENT overlay tile — joints, course lines, mottle, rain streaks, spalls — laid OVER
// the face's own lit colour (so the sun and shade stay the mass's, and one tile serves every tint). It
// is drawn in metres like the ground; bricks are not counted, they are suggested (a big read).

/** Skins, and the tile they repeat at: [width, height] in metres. */
export const WALL_SKINS = {
  mudbrick: [2.4, 2.4],      // sun-dried brick in mud mortar, reed-mat layers every eighth course, a herringbone course
  'baked-brick': [2.4, 1.8], // fired brick laid in bitumen: dark joints, a tone to each brick, a stamped course
  'mud-plaster': [4, 9],     // mud render over brick: mottle, rain streaks, a spall, a worn foot (taller than a house, so the foot shows once)
  'lime-plaster': [4, 4],    // gypsum / lime whitewash: a faint mottle and hairline cracks
  'gypsum-wash': [4, 4],     // the Egyptian whitewash: gypsum (lime is Ptolemaic) — the same faint mottle and cracks
  'nile-brick': [2.4, 2.4],  // Egyptian mud brick: big dark Nile-mud bricks in plain courses, a header course now and then
  sandstone: [6, 4],         // ashlar: courses of uneven height, blocks of uneven length, fine joints, bedding streaks
  'painted-relief': [16, 3.2], // a temple wall: one register of ritual scenes, carved in sunk relief and painted (repeated up the wall)
  'painted-bands': [2.4, 3], // a column shaft: drum joints, bands of colour, a row of cartouches, the king before Amun
  'pylon-relief': [26, 24],  // a pylon tower's face: ONE colossal scene — the king smiting his enemies before the god — under text columns
  'tura-casing': [8, 6],     // fine white Tura limestone, dressed smooth: hairline joints, a faint sheen and mottle (a pyramid's casing new)
  'giza-core': [6, 4],       // the local yellow limestone in rough courses: big blocks, wide joints, chipped faces
  granite: [5, 4],           // Aswan red granite, dressed: big blocks, fine joints, the stone's speckle
  'granite-rough': [5, 4],   // red granite left undressed: each block's face still bulging (Menkaure's lower casing)
  bedrock: [10, 8],          // the plateau's own rock carved in place: strata of harder and softer beds, the soft ones weathered back
};
/** Tile widths in px where 320 is too coarse for the figures drawn on them. */
const SKIN_PX = { 'painted-relief': 640, 'pylon-relief': 520 };
/** Skins whose tile is one register: a face fits a whole number of them, from its foot to its top. */
const SKIN_FIT = new Set(['painted-relief']);
/** Skins drawn facing +x (into the temple): a face whose run points away from `toward` wears them mirrored. */
const SKIN_DIRECTED = new Set(['painted-relief', 'pylon-relief']);

const DARK = [52, 34, 18], LIGHT = [255, 246, 226];
// an overlay pixel: k > 0 lightens, k < 0 darkens (alpha |k|)
function overlay(size) {
  const [W, H] = size, a = new Float64Array(W * H), pc = new Float64Array(W * H * 3), pa = new Float64Array(W * H);
  const idx = (x, y) => ((((y | 0) % H) + H) % H) * W + ((((x | 0) % W) + W) % W);
  const add = (x, y, k) => { a[idx(x, y)] += k; };
  // paint: a pigment laid over the relief (a coloured skin), alpha-composited; later strokes on top
  const paint = (x, y, col, al) => { const i = idx(x, y), keep = 1 - al; for (let c = 0; c < 3; c++) pc[i * 3 + c] = pc[i * 3 + c] * pa[i] * keep / Math.max(1e-6, al + pa[i] * keep) + col[c] * al / Math.max(1e-6, al + pa[i] * keep); pa[i] = al + pa[i] * keep; };
  return { W, H, a, pc, pa, add, paint };
}
// soft courses of brick: `rows` courses, `per` bricks a course, joints `joint` px wide, each brick a tone
function courses(o, rng, { rows, per, joint, jointK, toneK, herring = [], mats = [], relief = 0, wear }) {
  const { W, H } = o, ch = H / rows, bw = W / per;
  const tone = Array.from({ length: rows * per * 2 }, () => { const t = (rng() - 0.5) * 2 * toneK; return rng() < 0.06 ? t - toneK * 1.2 : t; });   // the odd over-fired or wet-struck brick
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.floor(y / ch), ly = y - r * ch;
    let k;
    if (mats.includes(r)) {
      // a layer of reed matting laid between courses (Ur, the ziggurat core): a dark band, its woven
      // strands showing as short diagonals, pressed thin at its edges
      const weave = ((x + ((Math.floor(x / (ch * 0.8)) % 2) ? ly : -ly) * 1.6 + 1000 * ch) % (ch * 0.5)) < ch * 0.18;
      k = -jointK * 1.15 + (weave ? 0.1 : 0) + (ly < ch * 0.18 || ly > ch * 0.82 ? -0.08 : 0);
    } else if (herring.includes(r)) {
      // a herringbone course: plano-convex bricks set on edge, leaning one way then the other
      const seg = Math.floor(x / (ch * 0.9)), lean = (Math.floor(seg / 3) % 2 ? 1 : -1), t = ((x + lean * ly + 1000 * ch) % (ch * 0.45));
      k = ly < joint || t < joint * 0.8 ? -jointK : tone[(r * per + seg) % tone.length] * 0.8;
    } else {
      const sx = x + (r % 2 ? bw / 2 : 0), i = Math.floor(sx / bw), lx = sx - i * bw;
      k = ly < joint || lx < joint ? -jointK : tone[r * per + (i % per)];
      const e = Math.min(ly - joint, lx - joint, ch - ly, bw - lx);
      if (k !== -jointK && e < joint) k -= jointK * 0.25;   // a worn arris
      // relief: each brick catches the light along its upper arris and shades its own lower edge,
      // so the coursing reads as horizontal ridges, not a printed grid
      if (relief && k !== -jointK) k += ly < joint * 2.2 ? relief : ly > ch - joint * 2.2 ? -relief : 0;
    }
    o.a[y * W + x] += k * (wear ? wear(x, y) : 1);
  }
}

/**
 * Ashlar as the New Kingdom laid it (not the uniform courses of the 25th Dynasty on): courses of uneven height (summing to the tile), each split into blocks of uneven length at
 * offsets that wrap, so the tile repeats seamlessly; fine joints, a tone to each block, bedding streaks.
 */
function ashlar(o, rng, { course = [0.12, 0.2], block = [0.18, 0.42], jointK = 0.24, toneK = 0.07, streak = 0.05 } = {}) {
  const { W, H } = o, rows = [];
  let y = 0;
  while (y < H) { let h = Math.round(H * (course[0] + rng() * (course[1] - course[0]))); if (H - (y + h) < H * course[0]) h = H - y; rows.push([y, h]); y += h; }
  const n = noise(W, 12, rng);
  for (const [y0, h] of rows) {
    const cuts = []; let x = rng() * W;
    for (let t = 0; t < 40; t++) { cuts.push(((x % W) + W) % W); x += W * (block[0] + rng() * (block[1] - block[0])); if (x - cuts[0] > W - W * block[0] * 0.6) break; }
    cuts.sort((a, b) => a - b);
    const tone = cuts.map(() => (rng() - 0.5) * 2 * toneK);
    for (let yy = y0; yy < y0 + h; yy++) for (let xx = 0; xx < W; xx++) {
      let bi = cuts.length - 1; for (let q = 0; q < cuts.length; q++) if (xx >= cuts[q]) bi = q;
      const nearCut = cuts.some((c) => Math.abs(xx - c) < 1.2 || Math.abs(xx - c - W) < 1.2 || Math.abs(xx - c + W) < 1.2);
      let k = yy - y0 < 1.3 || nearCut ? -jointK : tone[bi] + (Math.sin((yy - y0) * 0.9 + bi) > 0.93 ? -streak : 0) + (n(xx, yy) - 0.5) * 0.06;
      if (yy - y0 >= 1.3 && yy - y0 < 2.6 && !nearCut) k += 0.05;   // each block's upper arris catches the light
      o.a[yy * W + xx] += k;
    }
  }
}

const SKIN_BAKERS = {
  // bare sun-dried brick: bold courses with relief, a reed-mat layer every eighth course, one
  // herringbone course of plano-convex bricks between the mats
  mudbrick(o, rng) {
    const n = noise(o.W, 6, rng), m = noise(o.W, 24, rng);
    courses(o, rng, { rows: 24, per: 6, joint: 2.2, jointK: 0.4, toneK: 0.15, mats: [7, 15, 23], herring: [11], relief: 0.1, wear: (x, y) => 0.75 + n(x, y) * 0.5 });
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (n(x, y) - 0.5) * 0.16 + (m(x, y) - 0.5) * 0.06; }
  },
  // baked brick in bitumen: near-black joints, a strong tone to each brick, a stamped course
  'baked-brick'(o, rng) {
    const m = noise(o.W, 20, rng);
    courses(o, rng, { rows: 20, per: 7, joint: 2.6, jointK: 0.6, toneK: 0.2, relief: 0.08 });
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (m(x, y) - 0.5) * 0.08; }
    // a course of stamped bricks: the king's name pressed in a panel on every other brick
    const ch = o.H / 20, bw = o.W / 7;
    for (let i = 0; i < 7; i += 2) { const cx = i * bw + bw * 0.5 + (9 % 2 ? bw / 2 : 0), cy = 9 * ch + ch / 2; for (let y = -3; y <= 3; y++) for (let x = -8; x <= 8; x++) o.add(cx + x, cy + y, Math.abs(x) === 8 || Math.abs(y) === 3 ? -0.22 : -0.07); }
  },
  // Egyptian mud brick: Nile-mud bricks bigger and darker than Sumer's, plain running courses, a
  // header course every so often, no reed mats
  'nile-brick'(o, rng) {
    const n = noise(o.W, 6, rng), m = noise(o.W, 24, rng);
    courses(o, rng, { rows: 18, per: 6, joint: 2.2, jointK: 0.36, toneK: 0.12, relief: 0.09, wear: (x, y) => 0.8 + n(x, y) * 0.4 });
    const ch = o.H / 18;
    for (const r of [5, 14]) for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y++) for (let x = 0; x < o.W; x++) if (((x + 1000) % Math.round(o.W / 14)) < 1.6) o.add(x, y, -0.3);   // header courses: short brick ends
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (n(x, y) - 0.5) * 0.14 + (m(x, y) - 0.5) * 0.05; }
  },
  sandstone(o, rng) { ashlar(o, rng); },
  'gypsum-wash'(o, rng) { SKIN_BAKERS['lime-plaster'](o, rng); },
  // a temple wall: ONE register of scenes (./skin-art.js) on sandstone ashlar, between a ground line and
  // a border, carved in sunk relief and painted, the paint weathered. A wall wears as many registers as
  // fit its height (`SKIN_FIT`), every scene facing into the temple (`SKIN_DIRECTED`).
  'painted-relief'(o, rng) {
    ashlar(o, rng, { course: [0.12, 0.2], block: [0.04, 0.09], jointK: 0.16, toneK: 0.05 });
    const { W, H } = o, base = H - 4;
    for (let x = 0; x < W; x++) { for (let y = base; y < H - 1; y++) o.add(x, y, -0.35); for (let y = 0; y < 2; y++) o.add(x, y, -0.25); }
    sceneRegister(o, rng, { base, top: 3, al: 0.6 });
  },
  // a pylon tower: the colossal scene the temple shows the town (./skin-art.js `smitingScene`) under
  // columns of text, facing the gate
  'pylon-relief'(o, rng) {
    ashlar(o, rng, { course: [0.04, 0.08], block: [0.05, 0.12], jointK: 0.14, toneK: 0.05 });
    const { W, H } = o, base = H * 0.93, top = H * 0.03, text = H * 0.22;
    for (let x = 0; x < W; x++) { for (let y = 0; y < top; y++) o.paint(x, y, PIG.blue, 0.5); for (let y = Math.floor(base); y < Math.floor(base + 3); y++) o.add(x, y, -0.4); }
    const cw = W / 34; for (let i = 0; i < 34; i++) caption(o, i * cw, top + 2, text, cw, i < 17 ? 1 : -1, rng, 0.5);
    smitingScene(o, rng, { base: base - 1, textTop: text + 6, al: 0.6 });
  },
  // a column shaft: drum joints, a yellow band of cartouches between blue and red rings, and low on the
  // shaft the king offering to Amun
  'painted-bands'(o, rng) {
    const { W, H } = o, n = noise(W, 8, rng);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o.a[y * W + x] += (y % Math.round(H / 3.3) < 1.4 ? -0.24 : 0) + (n(x, y) - 0.5) * 0.06;
    const band = (y0, h, col, al) => { for (let y = Math.floor(y0); y < Math.floor(y0 + h); y++) for (let x = 0; x < W; x++) o.paint(x, y, col, al); };
    const y = H * 0.12;
    band(y, H * 0.03, PIG.blue, 0.55); band(y + H * 0.03, H * 0.015, PIG.red, 0.55); band(y + H * 0.045, H * 0.2, PIG.yellow, 0.32); band(y + H * 0.245, H * 0.03, PIG.blue, 0.55);
    for (let i = 0; i < 4; i++) { const cx = (i + 0.5) * W / 4; caption(o, cx - W / 18, y + H * 0.055, y + H * 0.235, W / 9, 1, rng, 0.45, { cart: true }); }
    columnScene(o, rng, { base: H * 0.95, top: y + H * 0.31, al: 0.55 });
  },
  // Tura casing: blocks of a metre or so, their joints barely a hairline; a soft mottle and a sheen
  'tura-casing'(o, rng) {
    ashlar(o, rng, { course: [0.13, 0.19], block: [0.1, 0.2], jointK: 0.07, toneK: 0.025, streak: 0 });
    const n = noise(o.W, 5, rng);
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (n(x, y) - 0.5) * 0.06 + 0.03; }
  },
  // the local limestone, rough: wide dark joints, a tone to each block, pitted faces
  'giza-core'(o, rng) {
    ashlar(o, rng, { course: [0.16, 0.26], block: [0.14, 0.3], jointK: 0.32, toneK: 0.1, streak: 0.06 });
    for (let k = 0; k < o.a.length / 40; k++) o.add(rng() * o.W, rng() * o.H, -0.12 - rng() * 0.12);
  },
  // granite: dressed blocks, and the speckle of its crystals (dark mica, pale feldspar)
  granite(o, rng) {
    ashlar(o, rng, { course: [0.2, 0.32], block: [0.2, 0.42], jointK: 0.2, toneK: 0.05, streak: 0 });
    for (let i = 0; i < o.a.length; i++) { const r = rng(); o.a[i] += r < 0.08 ? -0.22 : r > 0.94 ? 0.16 : 0; }
  },
  // undressed granite: the same blocks, each face bulging — light on its upper part, shade toward its foot
  'granite-rough'(o, rng) {
    const { W, H } = o, rows = 4, ch = H / rows;
    for (let r = 0; r < rows; r++) {
      const cuts = [0]; while (cuts.at(-1) < W) cuts.push(cuts.at(-1) + W * (0.18 + rng() * 0.2));
      cuts[cuts.length - 1] = W;
      for (let i = 0; i < cuts.length - 1; i++) for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y++) for (let x = Math.floor(cuts[i]); x < cuts[i + 1]; x++) {
        const u = (x - cuts[i]) / (cuts[i + 1] - cuts[i]), v = (y - r * ch) / ch, edge = Math.min(u, 1 - u, v, 1 - v);
        o.a[y * W + x] += edge < 0.04 ? -0.32 : (0.5 - v) * 0.22 - (1 - Math.min(1, edge * 6)) * 0.12;
      }
    }
    for (let i = 0; i < o.a.length; i++) { const r = rng(); o.a[i] += r < 0.08 ? -0.2 : r > 0.94 ? 0.14 : 0; }
  },
  // bedrock: horizontal beds of uneven thickness, the soft ones weathered back into dark grooves, a
  // crack running down through them now and then
  bedrock(o, rng) {
    const { W, H } = o, n = noise(W, 8, rng);
    let y = 0;
    while (y < H) {
      const h = Math.max(4, Math.round(H * (0.05 + rng() * 0.12))), soft = rng() < 0.45, tone = (rng() - 0.5) * 0.16;
      for (let yy = y; yy < Math.min(H, y + h); yy++) for (let x = 0; x < W; x++) {
        const t = (yy - y) / h;
        o.a[yy * W + x] += tone + (n(x, yy) - 0.5) * 0.1 + (soft ? -0.16 + (t > 0.7 ? -0.12 : 0) : (t < 0.12 ? 0.1 : 0));
      }
      y += h;
    }
    for (let k = 0; k < 5; k++) { let x = rng() * W; for (let yy = 0; yy < H; yy++) { o.add(x, yy, -0.25); x += (rng() - 0.5) * 1.6; } }
  },
  'mud-plaster'(o, rng) {
    const n = noise(o.W, 5, rng), m = noise(o.W, 22, rng);
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (n(x, y) - 0.5) * 0.18 + (m(x, y) - 0.5) * 0.07 + (rng() - 0.5) * 0.04; }
    // the brick under the render ghosts through as faint courses, plainer up high; near the foot of the
    // wall (the tile is pinned to world height, its bottom metre at ground level) rising damp and
    // splash have worn the render thin and the courses show
    const mh = WALL_SKINS['mud-plaster'][1], ch = o.H / (mh / 0.12), bw = ch * 3.2, ft = 1 - 1.1 / mh;   // 0.12 m courses; the worn foot is the bottom 1.1 m
    for (let y = 0; y < o.H; y++) for (let x = 0; x < o.W; x++) {
      const r = Math.floor(y / ch), ly = y - r * ch, lx = (x + (r % 2) * bw / 2) % bw;
      const foot = Math.min(1, Math.max(0, (y / o.H - ft) / (0.5 / mh))), patch = foot * (0.45 + 0.8 * n(x, y + 7));
      o.a[y * o.W + x] -= patch * 0.16;   // a broad wash too: joints alone average away when the wall is far
      if (ly >= 1.3 && lx >= 1.3) continue;
      o.a[y * o.W + x] -= 0.035 + patch * 0.26;
    }
    for (let y = Math.floor(o.H * (1 - 0.6 / mh)); y < o.H; y++) for (let x = 0; x < o.W; x++) o.a[y * o.W + x] -= 0.07 * ((y / o.H - (1 - 0.6 / mh)) / (0.6 / mh)) * (0.6 + m(x, y));   // the damp line
    // rain streaks: thin runs down from the wall head, fading
    for (let s = 0; s < 26; s++) { const x0 = rng() * o.W, len = o.H * (0.2 + rng() * 0.6), w = 1 + rng() * 2.5, y0 = rng() * o.H; for (let y = 0; y < len; y++) for (let dx = 0; dx < w; dx++) o.add(x0 + dx + Math.sin(y * 0.05) * 1.5, y0 + y, -0.09 * (1 - y / len)); }
    // spalls: render fallen away in a ragged, wide patch — the courses faint inside it, a shadow only
    // under the plaster's broken upper edge (it overhangs the bare brick), no outline elsewhere
    const rag = noise(o.W, 40, rng);
    for (let s = 0; s < 2; s++) {
      const cx = rng() * o.W, cy = o.H * (0.35 + rng() * 0.4), rx = 26 + rng() * 22, ry = 10 + rng() * 8;
      for (let y = -ry * 1.6; y <= ry * 1.6; y++) for (let x = -rx * 1.6; x <= rx * 1.6; x++) {
        const px = cx + x, py = cy + y, d = Math.hypot(x / rx, y / ry) / (0.55 + 0.6 * n(px, py) + 0.35 * rag(px, py));
        if (d > 1) continue;
        const joint = ((py % ch) + ch) % ch < 1.3 || ((((px + (Math.floor(py / ch) % 2) * ch * 1.5) % (ch * 3)) + ch * 3) % (ch * 3)) < 1.3;
        const lip = y < 0 && d > 0.78 ? -0.2 : 0;
        o.add(px, py, lip + (joint ? -0.22 : -0.07) * (1 - d * 0.4));
      }
    }
  },
  'lime-plaster'(o, rng) {
    const n = noise(o.W, 4, rng), m = noise(o.W, 18, rng);
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (n(x, y) - 0.5) * 0.12 + (m(x, y) - 0.5) * 0.05 + (rng() - 0.5) * 0.025; }
    // brushed coats: faint horizontal sweeps of the float
    for (let s = 0; s < 40; s++) { const x0 = rng() * o.W, y0 = rng() * o.H, len = 20 + rng() * 60, k = (rng() - 0.5) * 0.08; for (let x = 0; x < len; x++) for (let dy = 0; dy < 3; dy++) o.add(x0 + x, y0 + dy + Math.sin(x * 0.08) * 2, k * Math.sin((x / len) * Math.PI)); }
    // hairline cracks: random walks
    for (let s = 0; s < 4; s++) { let x = rng() * o.W, y = rng() * o.H, ang = rng() * Math.PI * 2; for (let t = 0; t < 70; t++) { o.add(x, y, -0.22); ang += (rng() - 0.5) * 0.8; x += Math.cos(ang); y += Math.sin(ang); } }
  },
};

// RGBA PNG (colour type 6): the skins are overlays
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngChunk(type, data) { const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function encodeRgba(rgba, W, H) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) { raw[y * (1 + W * 4)] = 0; rgba.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

const skinCache = new Map();
/**
 * A skin as an opaque texture for the WebGL World, where it is multiplied by the face's lit colour:
 * the overlay laid on a pale neutral (light marks have headroom above it, dark marks pull down).
 */
const NEUTRAL = 228;
function skinWorldTile(skin) {
  const key = `${skin}|world`;
  if (!skinCache.has(key)) {
    const b = Buffer.from(skinTile(skin, 0).split(',')[1], 'base64'), W = b.readUInt32BE(16), Hh = b.readUInt32BE(20);
    let i = 8; const idat = [];
    while (i < b.length) { const L = b.readUInt32BE(i), ty = b.toString('ascii', i + 4, i + 8); if (ty === 'IDAT') idat.push(b.subarray(i + 8, i + 8 + L)); i += 12 + L; }
    const raw = zlib.inflateSync(Buffer.concat(idat)), rgb = Buffer.alloc(W * Hh * 3);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const q = y * (1 + W * 4) + 1 + x * 4, a = raw[q + 3] / 255;
      for (let ch = 0; ch < 3; ch++) rgb[(y * W + x) * 3 + ch] = clamp(NEUTRAL * (1 - a) + raw[q + ch] * a);
    }
    skinCache.set(key, `data:image/png;base64,${encodePng(rgb, W, Hh).toString('base64')}`);
  }
  return skinCache.get(key);
}
registerTextureResolver('hskin-', (key) => (WALL_SKINS[key.slice(6)] ? skinWorldTile(key.slice(6)) : null));
/**
 * The overlay PNG for a skin. `turn`: 0 as drawn (x along the wall, y down), 1 flipped (y up),
 * 2 transposed (x down the wall), 3 transposed and flipped — a face's u/v may run either way; plus 4
 * mirrored along the wall (a directed skin on a wall that runs the other way).
 */
export function skinTile(skin, turn = 0) {
  const key = `${skin}|${turn}`;
  if (!skinCache.has(key)) {
    const bake = SKIN_BAKERS[skin];
    if (!bake) throw new Error(`unknown wall skin '${skin}'`);
    const [mw, mh] = WALL_SKINS[skin], W = SKIN_PX[skin] || 320, H = Math.round((W * mh) / mw);
    let seed = 0; for (const c of skin) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    const o = overlay([W, H]); bake(o, rngOf(seed));
    const tr = (turn & 2) !== 0, flip = (turn & 1) !== 0, mirror = (turn & 4) !== 0, OW = tr ? H : W, OH = tr ? W : H;
    const px = Buffer.alloc(OW * OH * 4);
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
      let sx = tr ? y : x, sy = tr ? x : y;
      if (flip) sy = H - 1 - sy;
      if (mirror) sx = W - 1 - sx;
      const j = sy * W + sx, k = Math.max(-0.85, Math.min(0.85, o.a[j])), col = k < 0 ? DARK : LIGHT, i = (y * OW + x) * 4;
      // the relief's light and shade, then its paint over it (alpha "over")
      const ab = Math.abs(k), p = o.pa[j], al = p + ab * (1 - p);
      for (let c = 0; c < 3; c++) px[i + c] = clamp(al > 0 ? (o.pc[j * 3 + c] * p + col[c] * ab * (1 - p)) / al : col[c]);
      px[i + 3] = clamp(al * 255);
    }
    skinCache.set(key, `data:image/png;base64,${encodeRgba(px, OW, OH).toString('base64')}`);
  }
  return skinCache.get(key);
}

/**
 * Lay a skin on a lit face (scene units): its fill stays underneath, the overlay above, the tile
 * pinned to world height and to the run of the wall so neighbouring faces' courses line up.
 * Upright quads only (a triangle is painted by gradient, a mask would stall the page).
 */
export function skinFace(f, skin, { us, mpu, toward }) {
  const c = f.corners;
  if (!WALL_SKINS[skin] || c.length !== 4 || typeof f.fill !== 'string' || f.bg) return f;
  const U = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], V = [c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]];
  const nz = Math.abs(U[0] * V[1] - U[1] * V[0]) / (Math.hypot(...U) * Math.hypot(...V) || 1);
  if (nz > 0.6) return f;   // a roof, a tread: not a wall face
  const [mw, mh] = WALL_SKINS[skin], tw = mw / mpu;
  let th = mh / mpu, z0 = 0;
  // a register skin fits the face: as many whole registers as its height holds, counted from its foot
  if (SKIN_FIT.has(skin)) { const zs = c.map((p) => p[2]), fh = Math.max(...zs) - Math.min(...zs); if (fh > th * 0.5) { th = fh / Math.max(1, Math.round(fh / th)); z0 = Math.min(...zs); } }
  const tr = Math.abs(U[2]) > Math.abs(V[2]), up = (tr ? U[2] : V[2]) > 0, H = tr ? V : U;
  const hl = Math.hypot(H[0], H[1]) || 1, runOf = (p) => (p[0] * H[0] + p[1] * H[1]) / hl, run = runOf(c[0]);
  // a scene skin is centred on its face (a pylon tower shows its one scene whole); courses keep to the world grid
  const runs = c.map(runOf), anchor = SKIN_DIRECTED.has(skin) ? (Math.min(...runs) + Math.max(...runs) - tw) / 2 : 0;
  // a directed skin faces into the temple: mirror it where the wall's run points away from `toward`
  const mx = c.reduce((a, p) => a + p[0], 0) / 4, my = c.reduce((a, p) => a + p[1], 0) / 4;
  const mirror = !!toward && SKIN_DIRECTED.has(skin) && (toward[0] - mx) * H[0] + (toward[1] - my) * H[1] < 0;
  const mod = (v, m) => ((v % m) + m) % m;
  const along = -mod(run - anchor, tw) * us, high = -(up ? mod(c[0][2] - z0, th) : mod(-(c[0][2] - z0), th)) * us;
  const [ox, oy, sw, sh] = tr ? [high, along, th * us, tw * us] : [along, high, tw * us, th * us];
  const key = `historic-skin-${skin}-${(tr ? 2 : 0) + (up ? 1 : 0) + (mirror ? 4 : 0)}`;
  // the WebGL World: the same skin as an opaque texture multiplied by the face's lit colour, mapped
  // by world position (u along the wall's run, v up the wall) so the courses line up there too
  const uv = c.map((p) => [((mirror ? -1 : 1) * (runOf(p) - anchor)) / tw, (p[2] - z0) / th]);
  return { ...f, skin: key, bg: `var(--${key}) ${ox.toFixed(2)}px ${oy.toFixed(2)}px / ${sw.toFixed(2)}px ${sh.toFixed(2)}px repeat, ${f.fill}`, texture: `hskin-${skin}`, uv, textureLit: true };
}
