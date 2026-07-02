/**
 * Procedural SURFACE textures for any box-world face — repeating tiles the World renderer
 * (scene-three) draws MULTIPLY-lit (texel * bakedLight) via the `textureLit` face flag, and
 * the CSS-3D path ignores (it keeps painting `fill`). Not road-specific: any face producer
 * (roads, floors, building cladding, furniture, slabs) can opt a face into a surface by
 * setting `texture: '<key>'` + `uv` + `textureLit: true`.
 *
 * Each tile is generated procedurally and encoded to a `data:image/png` URL, so no binary
 * asset is committed and the emitted World stays self-contained (the data URL rides the
 * existing payload.textures → emitThreeWorld TEXTURES[key] path, same as the curtainwall
 * reveal wallpaper). Memoized: each tile is built once per process.
 *
 * Two texture FAMILIES, differing in how UV should be mapped (see SURFACE_TILING):
 *   • 'repeat'  — isotropic grain (asphalt, gravel): randomness hides tile seams, so tile it
 *     SMALL via world-XY UV (roads do `uv = corner.xy / tileScale`).
 *   • 'slab'    — structured/veined (marble): large directional features expose repetition, so
 *     map ONE tile across the whole face (uv 0→1 per slab), not a small repeat.
 *
 * Server-only (node:zlib). scene-css3d is not bundled client-side (sketch-manifest, the one
 * client touchpoint, imports nothing from here). See the multiply-lit-texture spike:
 * lite-template/integration/0620/spike-output/multiply-lit-texture/SPIKE-RESULT.md.
 */
import zlib from 'node:zlib';

// ── minimal dependency-free PNG encoder (truecolour RGB) ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgb, W, H) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;   // 8-bit, colour type 2 (RGB)
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const o = y * (1 + W * 3);
    raw[o] = 0;                                  // filter: none
    rgb.copy(raw, o + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── asphalt: charcoal base + dense crushed aggregate, seamless under RepeatWrapping ──
function asphaltPng({ size = 128, seed = 1357 } = {}) {
  const W = size, H = size;
  let s = seed >>> 0;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {            // base charcoal with constant fine noise
    const n = (30 + rand() * 24) | 0;
    rgb[i * 3] = n; rgb[i * 3 + 1] = n; rgb[i * 3 + 2] = n;
  }
  const put = (x, y, v) => {                    // modulo writes → tile wraps on both axes
    const xi = ((x % W) + W) % W, yi = ((y % H) + H) % H, o = (yi * W + xi) * 3;
    rgb[o] = v; rgb[o + 1] = v; rgb[o + 2] = v;
  };
  const grains = Math.round(W * H * 1.1);
  for (let i = 0; i < grains; i++) {
    const cx = (rand() * W) | 0, cy = (rand() * H) | 0, r = rand() * 1.2 + 0.4, v = rand();
    let c;
    if (v < 0.55) c = 18 + v * 44;             // dark pits
    else if (v < 0.9) c = 50 + (v - 0.55) * 115;   // mid aggregate
    else c = 100 + (v - 0.9) * 850;            // bright quartz flecks (sparse)
    c = Math.min(210, c) | 0;
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      if (dx * dx + dy * dy <= r * r) put(cx + dx, cy + dy, c);
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// ── tileable value noise (periodic → seamless under RepeatWrapping) ──
// Lattice wraps at `period` cells so the tile edges match. fBm sums octaves whose periods
// double (period, 2·period, …) — all divide the tile, so the sum stays seamless.
function makeNoise(seed) {
  const S = seed >>> 0;
  const hash = (ix, iy, p) => {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(p, 2147483647) + S) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const wrap = (a, p) => ((a % p) + p) % p;
  const vnoise = (x, y, p) => {                // x,y in [0,1); p lattice cells across the tile
    const fx = x * p, fy = y * p, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = smooth(fx - ix), ty = smooth(fy - iy);
    const x0 = wrap(ix, p), x1 = wrap(ix + 1, p), y0 = wrap(iy, p), y1 = wrap(iy + 1, p);
    const a = hash(x0, y0, p), b = hash(x1, y0, p), c = hash(x0, y1, p), d = hash(x1, y1, p);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  const fbm = (x, y, base, octaves) => {
    let sum = 0, amp = 0.5, p = base, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += amp * vnoise(x, y, p); norm += amp; amp *= 0.5; p *= 2; }
    return sum / norm;
  };
  // ANISOTROPIC: separate lattice periods per axis (px, py both integers → still seamless).
  // Wood grain needs fine detail ACROSS the grain (high px) stretched ALONG it (low py).
  const vnoiseA = (x, y, px, py) => {
    const fx = x * px, fy = y * py, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = smooth(fx - ix), ty = smooth(fy - iy), pp = px + py;
    const x0 = wrap(ix, px), x1 = wrap(ix + 1, px), y0 = wrap(iy, py), y1 = wrap(iy + 1, py);
    const a = hash(x0, y0, pp), b = hash(x1, y0, pp), c = hash(x0, y1, pp), d = hash(x1, y1, pp);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  const fbmA = (x, y, bpx, bpy, octaves) => {
    let sum = 0, amp = 0.5, px = bpx, py = bpy, norm = 0;
    for (let o = 0; o < octaves; o++) { sum += amp * vnoiseA(x, y, px, py); norm += amp; amp *= 0.5; px *= 2; py *= 2; }
    return sum / norm;
  };
  return { fbm, fbmA };
}

// ── marble: domain-warped ridged veins over a base, with subtle mottle ──
// cfg.base/vein/vein2 are [r,g,b] 0..255. Veins = ridged sine of a warped coordinate (thin
// bright seams); a second finer crossing set + low-freq mottle break the regularity.
function marblePng(cfg, { size = 256, seed = 99 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  const period = cfg.period ?? 3;
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const warp = n.fbm(u, v, period, 5);
      const warp2 = n.fbm(u + 0.37, v + 0.61, period, 5);
      const t1 = (u * cfg.dirX + v * cfg.dirY) * cfg.freq + warp * cfg.warp;
      let vein = Math.pow(1 - Math.abs(Math.sin(t1 * Math.PI)), cfg.sharp);
      const t2 = (u * cfg.dirY - v * cfg.dirX) * cfg.freq * 2.3 + warp2 * cfg.warp * 0.7;
      const vein2 = Math.pow(1 - Math.abs(Math.sin(t2 * Math.PI)), cfg.sharp * 1.7) * (cfg.secondary ?? 0.4);
      const mott = (warp - 0.5) * (cfg.mottle ?? 12);
      const o = (y * W + x) * 3;
      const k1 = Math.min(1, vein), k2 = Math.min(1, vein2);
      for (let ch = 0; ch < 3; ch++) {
        let c = cfg.base[ch] + mott;             // mottled base
        c = mix(c, cfg.vein[ch], k1);            // primary veins
        c = mix(c, (cfg.vein2 || cfg.vein)[ch], k2);   // secondary veins
        rgb[o + ch] = Math.max(0, Math.min(255, c)) | 0;
      }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

const MARBLE = {
  'marble-carrara': { base: [231, 232, 230], vein: [150, 160, 172], vein2: [196, 201, 207], freq: 3.2, warp: 1.0, sharp: 6, secondary: 0.45, mottle: 12, dirX: 1, dirY: 0.32, period: 3, seed: 71 },
  'marble-calacatta': { base: [243, 238, 229], vein: [176, 142, 78], vein2: [150, 156, 162], freq: 2.5, warp: 1.15, sharp: 5, secondary: 0.5, mottle: 14, dirX: 1, dirY: 0.5, period: 3, seed: 12 },
  'marble-verde': { base: [29, 56, 46], vein: [205, 226, 213], vein2: [120, 168, 142], freq: 4.0, warp: 1.25, sharp: 7, secondary: 0.5, mottle: 10, dirX: 0.85, dirY: 1, period: 4, seed: 33 },
  'marble-nero': { base: [22, 21, 19], vein: [232, 229, 221], vein2: [120, 118, 110], freq: 2.7, warp: 1.0, sharp: 5, secondary: 0.4, mottle: 8, dirX: 1, dirY: 0.7, period: 3, seed: 54 },
};

// ── wood: earlywood↔latewood cathedral RINGS across the grain + fine streaks ALONG it ──
// Grain runs along +v. Rings = ridged sine of (u·ringFreq + warp + arc(v)); the arc gives the
// cathedral figure. Streaks use anisotropic noise (high px across grain, low py along it).
// ringFreq + streakFreq must be INTEGERS so the tile stays seamless under RepeatWrapping.
function woodPng(cfg, { size = 256, seed = 7 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  const P = cfg.period ?? 3, mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const warp = n.fbm(u, v, P, 5);
      const g = u * cfg.ringFreq + warp * cfg.ringWarp + Math.sin(v * Math.PI * 2) * cfg.cathedral;
      const ring = Math.pow(Math.abs(Math.sin(g * Math.PI)), cfg.ringSharp);
      const streak = n.fbmA(u, v, cfg.streakFreq, Math.max(1, Math.round(cfg.streakFreq * 0.1)), 4);
      const mott = (warp - 0.5) * (cfg.mottle ?? 6);
      const o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        let c = mix(cfg.early[ch], cfg.late[ch], ring);   // earlywood → latewood bands
        c *= 1 - (streak - 0.5) * cfg.streakAmt;           // fine grain streaks
        c += mott;
        rgb[o + ch] = Math.max(0, Math.min(255, c)) | 0;
      }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// ── asphalt 3-tab shingle: horizontal courses, half-offset tabs, butt-edge shadow ──
// N. American "staple-gun" roof. Tiled SMALL (repeat family): `rows` courses stacked up the
// tile, each course split into `tabs` shingles by thin vertical keyways. Alternate courses
// shift half a tab (running-bond) — a 2-course vertical period, so the tile stays seamless
// (rows even). A darker band along each course's BUTT edge reads as the overlap shadow line.
// Grain = per-texel granular noise over a per-tab tint jitter (weathering). cfg.base/butt/key
// are [r,g,b]; `rows`,`tabs` integers.
function shinglePng(cfg, { size = 256, seed = 41 } = {}) {
  const W = size, H = size, rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rows = cfg.rows ?? 8, tabs = cfg.tabs ?? 6;
  const courseH = H / rows, tabW = W / tabs;
  // per-(course,tab) weathering tint jitter, precomputed so a tab is internally consistent
  const jitter = [];
  for (let r = 0; r < rows; r++) { jitter[r] = []; for (let t = 0; t < tabs + 1; t++) jitter[r][t] = (rand() - 0.5) * 2 * (cfg.weather ?? 26); }
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    const row = Math.min(rows - 1, (y / courseH) | 0);
    const fy = y / courseH - row;                       // 0 (butt/bottom) .. 1 (top, overlapped)
    const offset = (row % 2) * 0.5;                     // running-bond half-tab shift
    for (let x = 0; x < W; x++) {
      const xs = x / tabW + offset;
      const tab = ((xs | 0) % tabs + tabs) % tabs;
      const fx = xs - Math.floor(xs);                   // 0..1 within a tab
      const jit = jitter[row][tab];
      const o = (y * W + x) * 3;
      // butt-edge shadow: a dark band low in the course (where the course above laps over).
      const butt = fy < (cfg.shadowBand ?? 0.16) ? 1 - fy / (cfg.shadowBand ?? 0.16) : 0;
      // keyway: thin dark vertical slot between tabs.
      const key = (fx < (cfg.keyway ?? 0.05) || fx > 1 - (cfg.keyway ?? 0.05)) ? 1 : 0;
      const grain = (rand() - 0.5) * (cfg.grain ?? 22);
      for (let ch = 0; ch < 3; ch++) {
        let c = cfg.base[ch] + jit + grain;
        c = mix(c, cfg.butt[ch], butt * 0.85);          // overlap shadow line
        c = mix(c, cfg.key[ch], key);                   // keyway slot
        rgb[o + ch] = Math.max(0, Math.min(255, c)) | 0;
      }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

const SHINGLE = {
  'shingle-weathered': { base: [86, 90, 92], butt: [44, 47, 50], key: [30, 32, 34], rows: 8, tabs: 6, weather: 24, grain: 20, shadowBand: 0.18, keyway: 0.045, seed: 41 },
  'shingle-brown':     { base: [96, 78, 58], butt: [52, 41, 30], key: [34, 27, 20], rows: 8, tabs: 6, weather: 26, grain: 22, shadowBand: 0.18, keyway: 0.045, seed: 77 },
  'shingle-green':     { base: [68, 82, 66], butt: [36, 46, 36], key: [26, 33, 26], rows: 8, tabs: 6, weather: 22, grain: 20, shadowBand: 0.18, keyway: 0.045, seed: 53 },
};

// ── clay barrel / pantile: vertical barrels (down-slope) + course overlap shadows ──
// Asian / Central-American terracotta. Barrels run along +v (down the slope when UV's v is the
// slope axis): a sinusoidal crown→valley shade across u gives the rounded ridges; `barrels`
// integer → seamless in u. Across v, every course laps the one below — a periodic dark overlap
// line (`courses` integer → seamless in v) plus a slight per-course hue drift (kiln variation).
// cfg.crown/valley/shadow are [r,g,b]; `barrels`,`courses` integers.
function clayTilePng(cfg, { size = 256, seed = 19 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  const barrels = cfg.barrels ?? 6, courses = cfg.courses ?? 5;
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const cf = v * courses, course = cf | 0, fc = cf - course;   // 0 (top, overlapped) .. 1 (butt)
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const bf = u * barrels, fb = bf - Math.floor(bf);          // 0..1 across one barrel
      // rounded barrel: cosine crown (bright at center, dark in the valley between barrels)
      const round = Math.cos((fb - 0.5) * Math.PI);              // 1 crown .. ~0 valley
      const valley = Math.pow(1 - round, 1.6);                   // dark seam between barrels
      // course overlap shadow: dark band where this course's head is lapped by the one above
      const lap = fc < (cfg.lapBand ?? 0.2) ? 1 - fc / (cfg.lapBand ?? 0.2) : 0;
      const kiln = (n.fbm(u, v, 3, 4) - 0.5) * (cfg.kiln ?? 22);
      const o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) {
        let c = mix(cfg.valley[ch], cfg.crown[ch], round) + kiln;  // barrel cross-shade
        c = mix(c, cfg.valley[ch], valley * 0.5);                  // deepen the seam
        c = mix(c, cfg.shadow[ch], lap * 0.8);                     // course overlap shadow
        rgb[o + ch] = Math.max(0, Math.min(255, c)) | 0;
      }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

const CLAY = {
  'clay-terracotta': { crown: [196, 104, 64], valley: [120, 56, 38], shadow: [78, 36, 26], barrels: 6, courses: 5, kiln: 24, lapBand: 0.22, seed: 19 },
  'clay-sand':       { crown: [206, 158, 108], valley: [138, 98, 64], shadow: [96, 66, 44], barrels: 6, courses: 5, kiln: 22, lapBand: 0.22, seed: 63 },
  'clay-slate':      { crown: [110, 116, 120], valley: [62, 68, 74], shadow: [40, 44, 50], barrels: 6, courses: 5, kiln: 18, lapBand: 0.22, seed: 88 },
};

const WOOD = {
  'wood-oak': { early: [183, 143, 96], late: [138, 99, 60], ringFreq: 6, ringWarp: 0.5, ringSharp: 0.7, cathedral: 0.55, streakFreq: 48, streakAmt: 0.16, mottle: 8, period: 3, seed: 21 },
  'wood-walnut': { early: [104, 74, 52], late: [58, 39, 27], ringFreq: 5, ringWarp: 0.55, ringSharp: 0.7, cathedral: 0.6, streakFreq: 44, streakAmt: 0.2, mottle: 6, period: 3, seed: 8 },
  'wood-birch': { early: [224, 206, 172], late: [197, 174, 135], ringFreq: 7, ringWarp: 0.4, ringSharp: 0.8, cathedral: 0.4, streakFreq: 52, streakAmt: 0.12, mottle: 6, period: 3, seed: 14 },
  'wood-cherry': { early: [157, 92, 63], late: [115, 59, 41], ringFreq: 6, ringWarp: 0.5, ringSharp: 0.7, cathedral: 0.5, streakFreq: 46, streakAmt: 0.16, mottle: 7, period: 3, seed: 30 },
};

// ── grass: OMNIDIRECTIONAL blade mat (flat, isotropic → 'repeat' family) ──
// A patchy green base (fbm clumps of dark↔mid) overlaid with thousands of tiny blade STROKES
// at random orientations and shades (dark/mid/light green, sparse near-black for the soil gaps
// between blades, optional dry tips). No direction → reads the same from any rotation, and the
// modulo-wrapped strokes keep the small tile seamless under RepeatWrapping. cfg colours [r,g,b].
function grassPng(cfg, { size = 128, seed = 5 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const lerp = (a, b, t) => a + (b - a) * t;
  // patchy base: large clumps (lighter/darker turf) so it isn't a flat green field
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = Math.min(1, Math.max(0, n.fbm(x / W, y / H, 4, 4) * 0.85 + n.fbm(x / W + 0.3, y / H + 0.7, 8, 3) * 0.35));
      const o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) rgb[o + ch] = lerp(cfg.dark[ch], cfg.mid[ch], t) | 0;
    }
  }
  const put = (x, y, col) => { const xi = ((x % W) + W) % W, yi = ((y % H) + H) % H, o = (yi * W + xi) * 3; rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2]; };
  const blades = Math.round(W * H * 1.15);
  for (let i = 0; i < blades; i++) {
    const cx = rand() * W, cy = rand() * H, ang = rand() * Math.PI * 2, len = 1.3 + rand() * 3.2;
    const v = rand();
    let col;
    if (v < 0.10) col = cfg.black;                              // soil gap / deep shadow
    else if (v < 0.48) col = cfg.mid;
    else if (v < 0.84) col = cfg.light;
    else if (v < 0.84 + (cfg.dryMix ?? 0.05)) col = cfg.dry;    // dry/yellowed tip
    else col = cfg.dark;
    const dx = Math.cos(ang), dy = Math.sin(ang), steps = Math.ceil(len);
    for (let t = 0; t <= steps; t++) put(Math.round(cx + dx * t), Math.round(cy + dy * t), col);
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

const GRASS = {
  'grass-lawn':   { dark: [26, 50, 20], mid: [50, 88, 34], light: [104, 150, 60], dry: [132, 150, 66], black: [10, 16, 7], dryMix: 0.06, seed: 91 },
  'grass-dry':    { dark: [62, 68, 32], mid: [98, 102, 48], light: [150, 150, 80], dry: [172, 160, 92], black: [26, 28, 14], dryMix: 0.42, seed: 24 },
  'grass-meadow': { dark: [30, 58, 24], mid: [58, 96, 40], light: [120, 162, 72], dry: [158, 156, 84], black: [12, 18, 9], dryMix: 0.18, seed: 47 },
};

// ── brick: running-bond courses with mortar joints (head + bed) + per-brick value jitter ──
// Authored NEUTRAL (light field, mid joints) so a face's `fill` tint colours it under multiply-
// light — one pattern serves red/buff/grey brick by the wall's tint. cfg.brick/mortar [r,g,b].
function brickPng(cfg, { size = 256, seed = 11 } = {}) {
  const W = size, H = size, rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1; const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rows = cfg.rows ?? 8, cols = cfg.cols ?? 4, mt = cfg.mortarThick ?? 0.11;
  const courseH = H / rows, brickW = W / cols;
  const jit = []; for (let r = 0; r < rows; r++) { jit[r] = []; for (let c = 0; c < cols + 1; c++) jit[r][c] = (rand() - 0.5) * 2 * (cfg.vary ?? 14); }
  for (let y = 0; y < H; y++) {
    const rf = y / courseH, row = rf | 0, fy = rf - row, offset = (row % 2) * 0.5;   // running bond half-brick shift
    for (let x = 0; x < W; x++) {
      const xf = x / brickW + offset, col = ((xf | 0) % cols + cols) % cols, fx = xf - Math.floor(xf);
      const mortar = fy < mt || fx < mt * 0.5 || fx > 1 - mt * 0.5;                  // bed joint + head joints
      const grain = (rand() - 0.5) * (cfg.grain ?? 9), o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) rgb[o + ch] = Math.max(0, Math.min(255, (mortar ? cfg.mortar[ch] : cfg.brick[ch] + jit[row][col] + grain))) | 0;
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// ── ceramic TILE: a grid of glossy tiles with grout joints, a soft bevel, per-tile tone
// variation and a top-down sheen (subway-station cladding). 'repeat' family — tile small. ──
function tilePng(cfg, { size = 256, seed = 41 } = {}) {
  const W = size, H = size, rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1; const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rows = cfg.rows ?? 6, cols = cfg.cols ?? 6, gw = cfg.groutW ?? 0.06, bevel = cfg.bevel ?? 0.16, bond = cfg.bond ?? 0;
  const tileH = H / rows, tileW = W / cols;
  const jit = []; for (let r = 0; r < rows; r++) { jit[r] = []; for (let c = 0; c < cols; c++) jit[r][c] = (rand() - 0.5) * 2 * (cfg.vary ?? 7); }
  for (let y = 0; y < H; y++) {
    const rf = y / tileH, row = rf | 0, fy = rf - row, off = bond ? (row % 2) * bond : 0;   // running-bond half-tile offset
    for (let x = 0; x < W; x++) {
      const cf = x / tileW + off, col = (((cf | 0) % cols) + cols) % cols, fx = cf - Math.floor(cf), o = (y * W + x) * 3;
      if (fx < gw || fx > 1 - gw || fy < gw || fy > 1 - gw) { for (let ch = 0; ch < 3; ch++) rgb[o + ch] = cfg.groutCol[ch]; continue; }
      const ex = Math.min(fx - gw, 1 - gw - fx) / bevel, ey = Math.min(fy - gw, 1 - gw - fy) / bevel;
      const bev = 0.84 + 0.16 * Math.min(1, Math.min(ex, ey));   // edge darker, centre full
      const gloss = 1.06 - fy * 0.14;                            // top sheen → bottom dimmer
      for (let ch = 0; ch < 3; ch++) rgb[o + ch] = Math.max(0, Math.min(255, (cfg.tile[ch] + jit[row][col]) * bev * gloss)) | 0;
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// neutral, tint-driven ceramic tiles (the wall/column `fill` supplies the colour cast).
const TILE = {
  'tile-white': { tile: [236, 238, 238], groutCol: [120, 124, 128], rows: 6, cols: 6, groutW: 0.055, bevel: 0.18, vary: 5, seed: 41 },
  'tile-cream': { tile: [228, 219, 201], groutCol: [150, 139, 122], rows: 6, cols: 6, groutW: 0.06, bevel: 0.18, vary: 7, seed: 42 },
  // classic running-bond rectangular "subway tile" (wide tiles, offset courses) — a different
  // pattern from the square pillar tiles above.
  'tile-subway': { tile: [225, 223, 215], groutCol: [138, 133, 122], rows: 5, cols: 3, groutW: 0.05, bevel: 0.22, vary: 5, bond: 0.5, seed: 44 },
};

// ── clapboard / lap siding: horizontal boards, each with a shadow lip at its lower lap edge ──
function clapboardPng(cfg, { size = 256, seed = 7 } = {}) {
  const W = size, H = size, rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1; const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const boards = cfg.boards ?? 7, boardH = H / boards, lapBand = cfg.lapBand ?? 0.14;
  const jit = []; for (let b = 0; b < boards + 1; b++) jit[b] = (rand() - 0.5) * 2 * (cfg.vary ?? 8);
  const mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < H; y++) {
    const bf = y / boardH, b = bf | 0, fy = bf - b;                                  // 0 board top .. 1 lap edge
    const shade = 1 - fy * 0.18, lap = fy > 1 - lapBand ? (fy - (1 - lapBand)) / lapBand : 0;
    for (let x = 0; x < W; x++) {
      const grain = (rand() - 0.5) * (cfg.grain ?? 5), o = (y * W + x) * 3;
      for (let ch = 0; ch < 3; ch++) { let c = cfg.board[ch] * shade + jit[b] + grain; c = mix(c, cfg.shadow[ch], lap * 0.75); rgb[o + ch] = Math.max(0, Math.min(255, c)) | 0; }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// ── stucco / plaster: fine isotropic mottle, very low contrast ──
function stuccoPng(cfg, { size = 128, seed = 3 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = n.fbm(x / W, y / H, 6, 4), o = (y * W + x) * 3;
    for (let ch = 0; ch < 3; ch++) rgb[o + ch] = Math.max(0, Math.min(255, cfg.base[ch] + (t - 0.5) * (cfg.vary ?? 18))) | 0;
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// neutral, tint-driven facade textures (one per family; the wall's `fill` supplies the colour).
const MASONRY = {
  brick:     { brick: [210, 204, 196], mortar: [166, 160, 150], rows: 8, cols: 4, mortarThick: 0.12, vary: 14, grain: 9, seed: 11 },
  clapboard: { board: [216, 212, 204], shadow: [150, 146, 138], boards: 7, lapBand: 0.16, vary: 8, grain: 5, seed: 7 },
  stucco:    { base: [212, 206, 196], vary: 16, seed: 3 },
};

// ── rock / cave wall: fbm mottle + a ridged crack network, authored LUMINANCE-led
// (a near-neutral rock value modulated to mid-grey) so it multiplies cleanly over a
// face's lit rock `fill` — the pattern is in value, the colour comes from the fill.
// One flexible generator; the variations are config (cracks, ridging, strata, speckle,
// moss). Seamless: every field is makeNoise fbm, which wraps on the tile. Family is
// 'repeat' (isotropic-ish), so cave faces tile it small via local UV.
function rockPng(cfg, { size = 256, seed = 1 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  const base = cfg.base ?? [178, 172, 162], MID = 178;
  const baseFreq = cfg.baseFreq ?? 5, oct = cfg.octaves ?? 5, amp = cfg.amp ?? 70;
  const ridged = cfg.ridged ?? 0, ax = cfg.anisoX ?? 0, ay = cfg.anisoY ?? 0;
  const crackFreq = cfg.crackFreq ?? 7, crackW = cfg.crackWidth ?? 0.05, crackD = cfg.crackDepth ?? 0.55;
  const speckle = cfg.speckle ?? 0, speckleHi = cfg.speckleHi ?? 1.5, speckleLo = cfg.speckleLo ?? 0.55;   // crystalline grains (feldspar/mica)
  const moss = cfg.moss ?? null, mossFreq = cfg.mossFreq ?? 4, mossAmt = cfg.mossAmt ?? 0;
  const bands = cfg.bands ?? 0, bandAmp = cfg.bandAmp ?? 0;       // horizontal sediment/cleavage layers (integer count → seamless)
  let s = (Math.imul(seed, 2654435761) >>> 0) || 1; const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, o = (y * W + x) * 3;
    let t = ax ? n.fbmA(u, v, ax, ay, oct) : n.fbm(u, v, baseFreq, oct);
    if (ridged) { const r = 1 - Math.abs(2 * t - 1); t = t * (1 - ridged) + r * ridged; }
    let L = MID + (t - 0.5) * amp;                                   // rock value around mid-grey
    if (bands) { const warp = (n.fbm(u, v * 0.5, 3, 3) - 0.5) * 0.1; L += Math.sin((v + warp) * bands * Math.PI * 2) * bandAmp; }   // stacked layers
    const cf = n.fbm(u + 4.2, v + 2.7, crackFreq, 4), cr = 1 - Math.abs(2 * cf - 1);   // ridged crack field → fissure lines
    if (cr > 1 - crackW) L *= (1 - crackD * ((cr - (1 - crackW)) / crackW));           // darken in the fissure
    let col = [base[0] * L / MID, base[1] * L / MID, base[2] * L / MID];
    if (speckle && rand() < speckle) { const g = rand() < 0.5 ? speckleLo : speckleHi; col = col.map((c) => c * g); }   // crystalline grains
    if (moss && mossAmt) { const m = n.fbm(u + 7.7, v + 5.3, mossFreq, 3), mm = Math.max(0, (m - (1 - mossAmt)) / mossAmt); if (mm > 0) col = col.map((c, ch) => c * (1 - mm * 0.8) + moss[ch] * mm * 0.9); }
    rgb[o] = Math.max(0, Math.min(255, col[0])) | 0; rgb[o + 1] = Math.max(0, Math.min(255, col[1])) | 0; rgb[o + 2] = Math.max(0, Math.min(255, col[2])) | 0;
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

const ROCK = {
  'rock-cave':    { base: [176, 168, 156], baseFreq: 5, amp: 64, crackFreq: 7, crackWidth: 0.05, crackDepth: 0.5, seed: 41 },   // baseline cavern rock
  'rock-craggy':  { base: [168, 158, 146], baseFreq: 4, amp: 94, ridged: 0.7, crackFreq: 6, crackWidth: 0.07, crackDepth: 0.66, seed: 17 },   // sharp ridged crags, high contrast
  'rock-strata':  { base: [184, 171, 152], anisoX: 2, anisoY: 20, amp: 30, bands: 7, bandAmp: 40, crackFreq: 12, crackWidth: 0.025, crackDepth: 0.4, seed: 63 },   // sedimentary horizontal layers
  'rock-granite': { base: [172, 170, 168], baseFreq: 6, amp: 40, crackFreq: 9, crackWidth: 0.025, crackDepth: 0.3, speckle: 0.22, seed: 8 },   // speckled granite
  'rock-breccia': { base: [180, 169, 153], baseFreq: 4, amp: 50, crackFreq: 4, crackWidth: 0.13, crackDepth: 0.64, seed: 5 },   // chunky cobble/breccia (wide crack net = stone gaps)
  'rock-mossy':   { base: [150, 150, 138], baseFreq: 5, amp: 58, crackFreq: 7, crackWidth: 0.05, crackDepth: 0.5, moss: [70, 96, 54], mossFreq: 3, mossAmt: 0.5, seed: 29 },   // damp rock with moss
};

// Dressed stone (slate, granite) — coloured stones for floors / castle interiors. Carry
// their own characteristic COLOUR, so apply over a neutral/light face fill (not the warm
// cave fill) to keep the hue. Same rockPng generator; slate = low-contrast cool cleavage,
// granite = speckled crystal.
// Slate + granite are PALETTE-PARAMETERIZED like stone-wall: one structural DNA per stone
// (cleavage for slate, crystal speckle for granite), and COLOUR (base, + the odd per-tone
// tweak) as a parameter → a stone in many tones from one structure. ROCK_DNA is exported
// and defineRockTile(name, { style, base }) mints custom tones at runtime.
const ROCK_DNA = {
  cave:    { baseFreq: 5, amp: 64, crackFreq: 7, crackWidth: 0.05, crackDepth: 0.5 },
  slate:   { baseFreq: 5, amp: 24, bands: 9, bandAmp: 14, crackFreq: 14, crackWidth: 0.02, crackDepth: 0.45 },
  granite: { baseFreq: 6, amp: 34, speckle: 0.26, speckleHi: 1.7, speckleLo: 0.5, crackFreq: 10, crackWidth: 0.02, crackDepth: 0.28 },
};
const SLATE_TONES = {                                                 // smooth slate, fine cleavage
  'slate':        { base: [138, 148, 160], seed: 71 },               // blue-grey
  'slate-purple': { base: [150, 132, 150], seed: 73 },               // plum
  'slate-green':  { base: [126, 146, 130], seed: 75 },               // sea-green
};
const GRANITE_TONES = {                                               // speckled crystal
  'granite-pink':  { base: [190, 152, 142], seed: 13 },              // warm feldspar
  'granite-grey':  { base: [158, 156, 152], seed: 17 },              // classic salt-and-pepper
  'granite-black': { base: [74, 74, 80], speckleHi: 3.2, speckleLo: 0.6, seed: 22 },   // gabbro: dark w/ bright flecks
};
const SLATE = Object.fromEntries(Object.entries(SLATE_TONES).map(([k, t]) => [k, { ...ROCK_DNA.slate, ...t }]));
const GRANITE = Object.fromEntries(Object.entries(GRANITE_TONES).map(([k, t]) => [k, { ...ROCK_DNA.granite, ...t }]));
// riven (rough split-face) slate is a STRUCTURAL variant, kept standalone (its own DNA).
const SLATE_RIVEN = { 'slate-riven': { base: [128, 130, 126], baseFreq: 4, amp: 50, ridged: 0.4, bands: 6, bandAmp: 22, crackFreq: 8, crackWidth: 0.05, crackDepth: 0.55, seed: 88 } };

// ── stone-brick masonry (castle walls + hallways): running-bond dressed stone with
// recessed mortar joints, per-stone value jitter, fbm grain, and a top-lit/bottom-
// shadowed bevel so each block reads as carved. Designed as a FAMILY (see STONE_WALL):
// every variant shares the SAME course grid + mortar + palette + scale, varying only the
// seed (per-stone values + grain). Mixing variants across a wall therefore keeps courses
// continuous (it reads as one wall) while no patch repeats — harmony without spam.
function stoneBrickPng(cfg, { size = 256, seed = 1 } = {}) {
  const W = size, H = size, n = makeNoise(seed * 7 + 1), rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1; const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rows = cfg.rows ?? 6, cols = cfg.cols ?? 4, mt = cfg.mortarThick ?? 0.1;       // rows even → running bond wraps across stacked tiles
  const stone = cfg.stone ?? [150, 145, 135], mortar = cfg.mortar ?? [92, 88, 80];
  const vary = cfg.vary ?? 26, grain = cfg.grain ?? 10, bevel = cfg.bevel ?? 0.18;
  const courseH = H / rows, brickW = W / cols;
  // per-stone value: jitter + occasional weathered ACCENT (darker/lighter standout
  // stones) so each seed gets distinctive blocks → mixing the family visibly varies.
  const accent = cfg.accent ?? 0.14, accentDark = cfg.accentDark ?? 40, accentLight = cfg.accentLight ?? 26;
  const jit = []; for (let r = 0; r < rows; r++) { jit[r] = []; for (let c = 0; c < cols + 1; c++) { let j = (rand() - 0.5) * 2 * vary; const a = rand(); if (a < accent) j -= accentDark; else if (a > 1 - accent * 0.6) j += accentLight; jit[r][c] = j; } }
  const clamp = (v) => Math.max(0, Math.min(255, v)) | 0;
  for (let y = 0; y < H; y++) {
    const rf = y / courseH, row = rf | 0, fy = rf - row, offset = (row % 2) * 0.5;     // running bond half-shift
    for (let x = 0; x < W; x++) {
      const xf = x / brickW + offset, col = (((xf | 0) % cols) + cols) % cols, fx = xf - Math.floor(xf), o = (y * W + x) * 3;
      const joint = fy < mt || fy > 1 - mt || fx < mt * 0.5 || fx > 1 - mt * 0.5;       // bed + head joints
      if (joint) {
        const mn = (n.fbm(x / W, y / H, 8, 3) - 0.5) * 10;
        for (let ch = 0; ch < 3; ch++) rgb[o + ch] = clamp(mortar[ch] + mn);
      } else {
        const g = (n.fbm(x / W + col * 0.13, y / H + row * 0.17, 10, 4) - 0.5) * grain * 2;
        const bev = (0.5 - fy) * bevel * 120;                                            // lighter top, darker bottom → carved relief
        for (let ch = 0; ch < 3; ch++) rgb[o + ch] = clamp(stone[ch] + jit[row][col] + g + bev);
      }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

// The stone-wall FAMILY is PALETTE-PARAMETERIZED. Structural DNA (grid / mortar geometry
// / wear / scale) is shared so every family stays harmonious; the PALETTE (stone + mortar
// colour) is a parameter, so the same masonry is grey, sandstone, bluestone, red — not
// tied to one stone. Each palette expands to N seeded variants (mix them per the family
// rule). Mint more at runtime with defineStoneWallFamily(name, { stone, mortar }).
const STONE_WALL_DNA = { rows: 6, cols: 4, mortarThick: 0.1, vary: 28, grain: 11, bevel: 0.2, accent: 0.14, accentDark: 40, accentLight: 26 };
const STONE_WALL_SEEDS = [['a', 13], ['b', 47], ['c', 88], ['d', 124]];
const STONE_PALETTES = {
  'stone-wall':           { stone: [152, 146, 134], mortar: [90, 86, 78] },    // neutral grey-tan
  'stone-wall-sandstone': { stone: [198, 168, 126], mortar: [150, 126, 92] },  // warm tan
  'stone-wall-bluestone': { stone: [118, 128, 140], mortar: [70, 78, 88] },    // cool grey-blue
  'stone-wall-redrock':   { stone: [176, 114, 88],  mortar: [120, 78, 60] },   // red sandstone
};
const stoneWallVariants = (name, palette, dna = STONE_WALL_DNA) => STONE_WALL_SEEDS.map(([suf, seed]) => [`${name}-${suf}`, { ...dna, ...palette, seed }]);
const STONE_WALL = Object.fromEntries(Object.entries(STONE_PALETTES).flatMap(([name, palette]) => stoneWallVariants(name, palette)));

// ── wood-panel paneling (interior walls / wainscot): vertical tongue-and-groove boards.
// DIRECTIONAL — grain runs UP the board (along the tile's +v), so a wall must map the
// tile's vertical to world-up. Each board carries its own cathedral grain phase + tone
// jitter so neighbours differ; grooves (a dark reveal + bevel) separate them and sit on
// the tile edges so it tiles horizontally with the seam hidden in a groove. Built as a
// palette FAMILY parameterized by wood SPECIES (early/late wood colour).
function woodPanelPng(cfg, { size = 256, seed = 7 } = {}) {
  const W = size, H = size, n = makeNoise(seed), rgb = Buffer.alloc(W * H * 3);
  let s = (seed >>> 0) || 1; const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const boards = cfg.boards ?? 4, boardW = W / boards;
  const early = cfg.early, late = cfg.late;
  const groove = cfg.groove ?? 0.05, grooveDark = cfg.grooveDark ?? 0.5, bevel = cfg.bevel ?? 18, vary = cfg.vary ?? 12;
  const ringFreq = cfg.ringFreq ?? 7, ringWarp = cfg.ringWarp ?? 0.5, ringSharp = cfg.ringSharp ?? 0.7, cathedral = cfg.cathedral ?? 0.5;
  const streakFreq = cfg.streakFreq ?? 48, streakAmt = cfg.streakAmt ?? 0.16, mottle = cfg.mottle ?? 7;
  const jit = [], phase = []; for (let b = 0; b < boards; b++) { jit[b] = (rand() - 0.5) * 2 * vary; phase[b] = rand() * 10; }
  const mix = (a, b, t) => a + (b - a) * t, clamp = (v) => Math.max(0, Math.min(255, v)) | 0;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const b = Math.min(boards - 1, (x / boardW) | 0), fx = (x - b * boardW) / boardW, o = (y * W + x) * 3;
      const warp = n.fbm(fx * 0.5 + phase[b], v, Math.max(2, Math.round(ringFreq * 0.5)), 5);
      const g = fx * ringFreq + warp * ringWarp + Math.sin(v * Math.PI * 2 + phase[b]) * cathedral;   // cathedral grain up the board
      const ring = Math.pow(Math.abs(Math.sin(g * Math.PI)), ringSharp);
      const streak = n.fbmA(fx + phase[b], v, streakFreq, Math.max(1, Math.round(streakFreq * 0.1)), 4);
      const mott = (warp - 0.5) * mottle;
      const edge = Math.min(fx, 1 - fx);
      let shade = 1, add = 0;
      if (edge < groove) shade = 1 - grooveDark * (1 - edge / groove);      // groove reveal (V valley to the edge)
      else add = (0.5 - fx) * bevel;                                        // soft bevel: left lit, right shadowed
      for (let ch = 0; ch < 3; ch++) {
        let c = mix(early[ch], late[ch], ring);
        c *= 1 - (streak - 0.5) * streakAmt;
        c += mott + jit[b];
        rgb[o + ch] = clamp(c * shade + add);
      }
    }
  }
  return `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
}

const WOOD_PANEL_DNA = { boards: 4, groove: 0.05, grooveDark: 0.5, bevel: 18, ringFreq: 7, ringWarp: 0.5, ringSharp: 0.7, cathedral: 0.5, streakFreq: 48, streakAmt: 0.16, mottle: 7, vary: 12 };
const WOOD_PANEL_SPECIES = {
  'wood-panel-oak':      { early: [183, 143, 96], late: [138, 99, 60] },    // golden oak
  'wood-panel-walnut':   { early: [104, 74, 52], late: [58, 39, 27] },      // dark walnut
  'wood-panel-pine':     { early: [214, 186, 138], late: [178, 148, 102] }, // pale pine
  'wood-panel-mahogany': { early: [150, 80, 58], late: [104, 52, 38] },     // red mahogany
};
const WOOD_PANEL_SEEDS = [['a', 5], ['b', 19], ['c', 41]];
const woodPanelVariants = (name, species, dna = WOOD_PANEL_DNA) => WOOD_PANEL_SEEDS.map(([suf, seed]) => [`${name}-${suf}`, { ...dna, ...species, seed }]);
const WOOD_PANEL = Object.fromEntries(Object.entries(WOOD_PANEL_SPECIES).flatMap(([name, sp]) => woodPanelVariants(name, sp)));

// key → lazy, memoized generator. Extend with new surfaces (concrete, gravel...) here.
const GENERATORS = {
  brick: () => brickPng(MASONRY.brick, { size: 256, seed: MASONRY.brick.seed }),
  clapboard: () => clapboardPng(MASONRY.clapboard, { size: 256, seed: MASONRY.clapboard.seed }),
  stucco: () => stuccoPng(MASONRY.stucco, { size: 128, seed: MASONRY.stucco.seed }),
  asphalt: () => asphaltPng({ size: 128, seed: 20620 }),
  ...Object.fromEntries(Object.entries(TILE).map(([k, cfg]) => [k, () => tilePng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(MARBLE).map(([k, cfg]) => [k, () => marblePng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(WOOD).map(([k, cfg]) => [k, () => woodPng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(SHINGLE).map(([k, cfg]) => [k, () => shinglePng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(CLAY).map(([k, cfg]) => [k, () => clayTilePng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(GRASS).map(([k, cfg]) => [k, () => grassPng(cfg, { size: 128, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(ROCK).map(([k, cfg]) => [k, () => rockPng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(SLATE).map(([k, cfg]) => [k, () => rockPng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(SLATE_RIVEN).map(([k, cfg]) => [k, () => rockPng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(GRANITE).map(([k, cfg]) => [k, () => rockPng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(STONE_WALL).map(([k, cfg]) => [k, () => stoneBrickPng(cfg, { size: 256, seed: cfg.seed })])),
  ...Object.fromEntries(Object.entries(WOOD_PANEL).map(([k, cfg]) => [k, () => woodPanelPng(cfg, { size: 256, seed: cfg.seed })])),
};

// UV family per key: 'repeat' → tile small via world-XY; 'slab' → map one tile 0→1 per face.
// Wood is directional, so it's 'slab' (grain runs along the face's +v); a plank-floor variant
// that repeats along its length would be added as its own 'repeat'-family key later.
export const SURFACE_TILING = {
  asphalt: 'repeat',
  brick: 'repeat', clapboard: 'repeat', stucco: 'repeat',   // tint-driven facade textures, small world-XY/local repeat
  ...Object.fromEntries(Object.keys(TILE).map((k) => [k, 'repeat'])),   // ceramic tiles, small local repeat (face-authored uv)
  ...Object.fromEntries(Object.keys(MARBLE).map((k) => [k, 'slab'])),
  ...Object.fromEntries(Object.keys(WOOD).map((k) => [k, 'slab'])),
  // Roof tiles tile SMALL across the slope. They're directional (shingle courses horizontal,
  // clay barrels down-slope), so the roof builder authors per-face `uv` in a local slope basis
  // rather than relying on world-XY projection — but the family is still 'repeat'.
  ...Object.fromEntries(Object.keys(SHINGLE).map((k) => [k, 'repeat'])),
  ...Object.fromEntries(Object.keys(CLAY).map((k) => [k, 'repeat'])),
  // Grass is omnidirectional/isotropic — small world-XY repeat, exactly like asphalt.
  ...Object.fromEntries(Object.keys(GRASS).map((k) => [k, 'repeat'])),
  // Rock/cave tiles are isotropic-ish (cracks every which way) — small repeat over the
  // cave faces' local UV. Strata is directional but still seamless, so it stays 'repeat'.
  ...Object.fromEntries(Object.keys(ROCK).map((k) => [k, 'repeat'])),
  ...Object.fromEntries(Object.keys(SLATE).map((k) => [k, 'repeat'])),
  ...Object.fromEntries(Object.keys(SLATE_RIVEN).map((k) => [k, 'repeat'])),
  ...Object.fromEntries(Object.keys(GRANITE).map((k) => [k, 'repeat'])),
  ...Object.fromEntries(Object.keys(STONE_WALL).map((k) => [k, 'repeat'])),
  // Wood paneling is a DIRECTIONAL repeat (boards run vertically); the wall builder must
  // author per-face UV with the tile's +v along world-up, like the roof tiles do.
  ...Object.fromEntries(Object.keys(WOOD_PANEL).map((k) => [k, 'repeat'])),
};

/**
 * Texture FAMILIES — sets of tiles sharing DNA (palette / scale / joint structure) meant
 * to be MIXED across a surface instead of spamming one tile, so a wall stays harmonious
 * (continuous courses, common palette) yet non-repeating. Rotate variants per face/patch
 * via pickFamilyTile.
 */
export const TEXTURE_FAMILIES = {
  ...Object.fromEntries(Object.keys(STONE_PALETTES).map((name) => [name, STONE_WALL_SEEDS.map(([suf]) => `${name}-${suf}`)])),
  ...Object.fromEntries(Object.keys(WOOD_PANEL_SPECIES).map((name) => [name, WOOD_PANEL_SEEDS.map(([suf]) => `${name}-${suf}`)])),
  'slate-blend': Object.keys(SLATE),   // variegated slate (grey/purple/green) — a real roofing blend
};

/** The rock structural styles available to defineRockTile. */
export const ROCK_STYLES = Object.keys(ROCK_DNA);

// Runtime-registered generators (e.g. custom stone-wall palettes minted via
// defineStoneWallFamily). surfaceTexture() consults this after the built-in GENERATORS.
const RUNTIME_GEN = {};

/**
 * Mint a NEW stone-wall family in any palette at runtime — recolour without editing this
 * file. Registers `${name}-a..d` tiles (shared DNA, your stone+mortar colours), marks them
 * 'repeat', and adds the family to TEXTURE_FAMILIES. Returns the new tile keys.
 *   defineStoneWallFamily('stone-wall-obsidian', { stone:[60,58,66], mortar:[34,32,38] })
 *   pickFamilyTile('stone-wall-obsidian', i)
 * `opts` may also override DNA (rows, cols, vary, grain, bevel, accent…).
 */
export function defineStoneWallFamily(name, { stone, mortar, ...opts } = {}) {
  if (!Array.isArray(stone) || !Array.isArray(mortar)) throw new Error('defineStoneWallFamily requires { stone:[r,g,b], mortar:[r,g,b] }');
  const variants = stoneWallVariants(name, { stone, mortar }, { ...STONE_WALL_DNA, ...opts });
  for (const [k, cfg] of variants) { RUNTIME_GEN[k] = () => stoneBrickPng(cfg, { size: 256, seed: cfg.seed }); SURFACE_TILING[k] = 'repeat'; }
  TEXTURE_FAMILIES[name] = variants.map(([k]) => k);
  return TEXTURE_FAMILIES[name].slice();
}

/**
 * Mint a single rock tile in a custom TONE at runtime — recolour any rock style without
 * editing this file. `style` picks the structural DNA (ROCK_STYLES: 'cave'|'slate'|
 * 'granite'); `base` is the [r,g,b] tone; `opts` overrides DNA (amp, bands, speckle…).
 *   defineRockTile('slate-rust', { style:'slate', base:[150,120,98] })
 */
export function defineRockTile(name, { style = 'cave', base, ...opts } = {}) {
  if (!Array.isArray(base)) throw new Error('defineRockTile requires { base:[r,g,b] }');
  const cfg = { ...(ROCK_DNA[style] || ROCK_DNA.cave), ...opts, base, seed: opts.seed ?? 1 };
  RUNTIME_GEN[name] = () => rockPng(cfg, { size: 256, seed: cfg.seed });
  SURFACE_TILING[name] = 'repeat';
  return name;
}

/**
 * Mint a NEW wood-panel family in a custom SPECIES at runtime — recolour the paneling
 * (a stain / different timber) without editing this file. `early`/`late` are the wood's
 * earlywood/latewood [r,g,b]; `opts` overrides DNA (boards, groove, cathedral, vary…).
 *   defineWoodPanelFamily('wood-panel-ebony', { early:[60,52,46], late:[30,26,24] })
 */
export function defineWoodPanelFamily(name, { early, late, ...opts } = {}) {
  if (!Array.isArray(early) || !Array.isArray(late)) throw new Error('defineWoodPanelFamily requires { early:[r,g,b], late:[r,g,b] }');
  const variants = woodPanelVariants(name, { early, late }, { ...WOOD_PANEL_DNA, ...opts });
  for (const [k, cfg] of variants) { RUNTIME_GEN[k] = () => woodPanelPng(cfg, { size: 256, seed: cfg.seed }); SURFACE_TILING[k] = 'repeat'; }
  TEXTURE_FAMILIES[name] = variants.map(([k]) => k);
  return TEXTURE_FAMILIES[name].slice();
}

/** The tile keys in a family (or [] for unknown). */
export function familyKeys(family) { return TEXTURE_FAMILIES[family] ? TEXTURE_FAMILIES[family].slice() : []; }

/** Pick a family tile by index (cycles), for stable per-face/patch variation:
 *  `pickFamilyTile('stone-wall', faceIndex)`. Returns null for an unknown/empty family. */
export function pickFamilyTile(family, index = 0) {
  const keys = TEXTURE_FAMILIES[family];
  if (!keys || !keys.length) return null;
  return keys[((index % keys.length) + keys.length) % keys.length];
}
const cache = {};

/**
 * Resolve a surface-texture key to its `data:image/png` URL (memoized), or null for an
 * unknown key. Used by assembleBoxCityScene to populate the payload `textures` map when a
 * ribbon/face opts into a surface via `texture: '<key>'`.
 */
export function surfaceTexture(key) {
  const gen = key && (GENERATORS[key] || RUNTIME_GEN[key]);
  if (!gen) return null;
  if (!cache[key]) cache[key] = gen();
  return cache[key];
}

/** Keys with a registered generator (so callers can validate an opt-in). */
export const SURFACE_TEXTURE_KEYS = Object.keys(GENERATORS);

/**
 * Scan a baked face list for `texture` opt-ins and resolve each to its data-URL, building
 * the `{ key: dataURL }` map a scene attaches as `payload.textures` for emitThreeWorld.
 * Any face producer (subway pillars, mezzanine marble floor, …) just sets `texture:'<key>'`.
 */
export function collectFaceTextures(faces = [], into = {}) {
  for (const f of faces) {
    if (f && f.texture && !into[f.texture]) {
      const url = surfaceTexture(f.texture);
      if (url) into[f.texture] = url;
    }
  }
  return into;
}
