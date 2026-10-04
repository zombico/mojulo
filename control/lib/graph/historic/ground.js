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

/** Surfaces, and how many metres one tile covers. */
export const GROUND_SURFACES = { mud: 4, rubble: 3, brick: 2.4, 'dry-earth': 6, 'cone-mosaic': 1.6 };   // the mosaic's cones are drawn large: a big read, not a count
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
  mudbrick: [2.4, 2.2],      // sun-dried brick in mud mortar, a herringbone band of plano-convex bricks
  'baked-brick': [2.4, 1.8], // fired brick laid in bitumen: dark joints, a tone to each brick
  'mud-plaster': [4, 9],     // mud render over brick: mottle, rain streaks, a spall, a worn foot (taller than a house, so the foot shows once)
  'lime-plaster': [4, 4],    // gypsum / lime whitewash: a faint mottle and hairline cracks
};

const DARK = [52, 34, 18], LIGHT = [255, 246, 226];
// an overlay pixel: k > 0 lightens, k < 0 darkens (alpha |k|)
function overlay(size) {
  const [W, H] = size, a = new Float64Array(W * H);
  const add = (x, y, k) => { const i = ((((y | 0) % H) + H) % H) * W + ((((x | 0) % W) + W) % W); a[i] += k; };
  return { W, H, a, add };
}
// soft courses of brick: `rows` courses, `per` bricks a course, joints `joint` px wide, each brick a tone
function courses(o, rng, { rows, per, joint, jointK, toneK, herring = [], wear }) {
  const { W, H } = o, ch = H / rows, bw = W / per;
  const tone = Array.from({ length: rows * per * 2 }, () => (rng() - 0.5) * 2 * toneK);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.floor(y / ch), ly = y - r * ch;
    let k;
    if (herring.includes(r)) {
      // a herringbone course: plano-convex bricks set on edge, leaning one way then the other
      const seg = Math.floor(x / (ch * 0.9)), lean = (Math.floor(seg / 3) % 2 ? 1 : -1), t = ((x + lean * ly + 1000 * ch) % (ch * 0.45));
      k = ly < joint || t < joint * 0.8 ? -jointK : tone[(r * per + seg) % tone.length] * 0.8;
    } else {
      const sx = x + (r % 2 ? bw / 2 : 0), i = Math.floor(sx / bw), lx = sx - i * bw;
      k = ly < joint || lx < joint ? -jointK : tone[r * per + (i % per)];
      const e = Math.min(ly - joint, lx - joint, ch - ly, bw - lx);
      if (k !== -jointK && e < joint) k -= jointK * 0.25;   // a worn arris
    }
    o.a[y * W + x] += k * (wear ? wear(x, y) : 1);
  }
}

const SKIN_BAKERS = {
  mudbrick(o, rng) {
    const n = noise(o.W, 6, rng), m = noise(o.W, 24, rng);
    courses(o, rng, { rows: 20, per: 6, joint: 2.2, jointK: 0.3, toneK: 0.07, herring: [9, 10], wear: (x, y) => 0.7 + n(x, y * o.W / o.H) * 0.6 });
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (n(x, y * o.W / o.H) - 0.5) * 0.14 + (m(x, y * o.W / o.H) - 0.5) * 0.06; }
  },
  'baked-brick'(o, rng) {
    const m = noise(o.W, 20, rng);
    courses(o, rng, { rows: 18, per: 7, joint: 2.6, jointK: 0.55, toneK: 0.13 });
    for (let i = 0; i < o.a.length; i++) { const x = i % o.W, y = (i / o.W) | 0; o.a[i] += (m(x, y * o.W / o.H) - 0.5) * 0.08; }
    // a few stamped bricks: the king's name pressed in a panel
    for (let s = 0; s < 3; s++) { const cx = rng() * o.W, cy = Math.floor(rng() * 18) * (o.H / 18) + o.H / 36; for (let y = -3; y <= 3; y++) for (let x = -7; x <= 7; x++) o.add(cx + x, cy + y, Math.abs(x) === 7 || Math.abs(y) === 3 ? -0.18 : -0.06); }
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
 * The overlay PNG for a skin. `turn`: 0 as drawn (x along the wall, y down), 1 flipped (y up),
 * 2 transposed (x down the wall), 3 transposed and flipped — a face's u/v may run either way.
 */
export function skinTile(skin, turn = 0) {
  const key = `${skin}|${turn}`;
  if (!skinCache.has(key)) {
    const bake = SKIN_BAKERS[skin];
    if (!bake) throw new Error(`unknown wall skin '${skin}'`);
    const [mw, mh] = WALL_SKINS[skin], W = 320, H = Math.round((W * mh) / mw);
    let seed = 0; for (const c of skin) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    const o = overlay([W, H]); bake(o, rngOf(seed));
    const tr = turn >= 2, flip = turn % 2 === 1, OW = tr ? H : W, OH = tr ? W : H;
    const px = Buffer.alloc(OW * OH * 4);
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
      let sx = tr ? y : x, sy = tr ? x : y;
      if (flip) sy = H - 1 - sy;
      const k = Math.max(-0.85, Math.min(0.85, o.a[sy * W + sx])), col = k < 0 ? DARK : LIGHT, i = (y * OW + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = clamp(Math.abs(k) * 255);
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
export function skinFace(f, skin, { us, mpu }) {
  const c = f.corners;
  if (!WALL_SKINS[skin] || c.length !== 4 || typeof f.fill !== 'string' || f.bg) return f;
  const U = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], V = [c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]];
  const nz = Math.abs(U[0] * V[1] - U[1] * V[0]) / (Math.hypot(...U) * Math.hypot(...V) || 1);
  if (nz > 0.6) return f;   // a roof, a tread: not a wall face
  const [mw, mh] = WALL_SKINS[skin], tw = mw / mpu, th = mh / mpu;
  const tr = Math.abs(U[2]) > Math.abs(V[2]), up = (tr ? U[2] : V[2]) > 0, H = tr ? V : U;
  const hl = Math.hypot(H[0], H[1]) || 1, run = (c[0][0] * H[0] + c[0][1] * H[1]) / hl;
  const mod = (v, m) => ((v % m) + m) % m;
  const along = -mod(run, tw) * us, high = -(up ? mod(c[0][2], th) : mod(-c[0][2], th)) * us;
  const [ox, oy, sw, sh] = tr ? [high, along, th * us, tw * us] : [along, high, tw * us, th * us];
  const key = `historic-skin-${skin}-${(tr ? 2 : 0) + (up ? 1 : 0)}`;
  return { ...f, skin: key, bg: `var(--${key}) ${ox.toFixed(2)}px ${oy.toFixed(2)}px / ${sw.toFixed(2)}px ${sh.toFixed(2)}px repeat, ${f.fill}` };
}
