/**
 * DRESSED STONE — a room's wall tile painted by the matte painter: ashlar, courses of big blocks in a running bond, each
 * block a face of its own (relief.js: its form pillowed and chamfered, its face tooled or pitched, spalls at its arrises,
 * pits), set in recessed mortar, lit from ABOVE (a wall's light is the sky's and the lamps', never from the side; light.js,
 * its mean held at 1 so the room's vertex light still does the large shading), and painted: each block its own tone, a
 * mottle across its face, dirt in the hollows. No line is drawn; every joint and chip is relief the light finds.
 *
 *   dressedTile(cfg, { size, seed }) → { rgb, W, H }   one repeat of the tile, `size` texels a side (rgb: a Buffer)
 *
 * cfg (era/tile-specs.js holds the rails): { stone, mortar ([r, g, b]), rows (courses a repeat), cols (blocks a course),
 * joint (m), recess (m), tool ('tooled' | 'pitched' | 'none'), chamfer (m), pillow (m), spall (0–1), pit (0–1),
 * vary (a block's tone, 0–40), grit (0–1), metres (the repeat's size: it is painted at the metres it is laid at) }.
 *
 * `cut` (default 'ashlar'): the coursed blocks above, for a wall. A PILLAR is never coursed like a wall: 'fluted' is one
 * shaft cut into vertical channels between narrow fillets (`flutes` a repeat), 'shaft' a plain monolith with its grain
 * running up it; both weathered in streaks running down, their arrises chipped here and there, lit from the upper left
 * (a flute varies across the shaft, so light from straight above would not find it) with the channels' hollows deep.
 *
 * SEAMLESS by construction: whole courses and whole blocks a repeat (a course's breaks wrap round its length), every
 * block painted in its own coordinates and laid whole, wrapping round the edge it crosses, and the light's march and
 * cavity wrapped (light.js `tile`). Pure: the seed's dice only; the same cfg and seed paint the same bytes.
 */
import { reliefField, hash01 } from './relief.js';
import { lightRelief } from './light.js';
import { gnoise2, fractal2 } from '../noise/noise.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// (a pitched face is not the painter's faceted tool here: cells with visible borders read as crazy paving, and terraces
// as contour rings; it is a rock face bulged and lumped, billowed noise in the block's own frame, to a dressed margin)
const TOOL = { tooled: { kind: 'tooled', spacing: 0.012, angle: 70, amp: 0.0007 } };
export const DRESSED_DEFAULTS = Object.freeze({ cut: 'ashlar', flutes: 12, rows: 4, cols: 2, joint: 0.012, recess: 0.008, tool: 'tooled', chamfer: 0.02, pillow: 0.003, spall: 0.5, pit: 0.3, vary: 30, grit: 0.5, metres: 2 });
const LIGHT = { az: 90, el: 40, ambient: 0.36, wrap: 0.2, reach: 0.05, soft: 0.002, floor: 0.35, radius: 0.012, cavity: 0.4, edge: 0.1, tile: true };

/** A ramp of five stops round a colour, dark to light (the material). */
const rampOf = (c) => [0.42, 0.68, 0.9, 1.08, 1.22].map((k) => c.map((v) => clamp(v * k, 0, 255)));
const rampAt = (R, t) => { const x = clamp(t, 0, 1) * (R.length - 1), i = Math.min(R.length - 2, Math.floor(x)), f = x - i; return R[i].map((v, k) => v + (R[i + 1][k] - v) * f); };

export function dressedTile(cfgIn, { size = 512, seed = 1 } = {}) {
  if ((cfgIn.cut ?? 'ashlar') !== 'ashlar') return shaftTile({ ...DRESSED_DEFAULTS, ...cfgIn }, size, seed);
  const c = { ...DRESSED_DEFAULTS, ...cfgIn }, W = size, H = size, M = c.metres, px = M / size, ppm = size / M, g = c.grit;
  const height = new Float32Array(W * H).fill(-c.recess), owner = new Int32Array(W * H).fill(-1), lx = new Float32Array(W * H), ly = new Float32Array(W * H);
  const relief = {
    form: { chamfer: c.chamfer, depth: Math.min(0.03, c.chamfer * 0.6), pillow: c.pillow, rag: 0.004 + 0.006 * g },
    rough: { amp: 0.003, scale: 0.25, grain: 0.0005 },
    tool: c.tool === 'tooled' ? TOOL.tooled : false,
    spall: c.spall > 0 ? { count: Math.max(1, Math.round(5 * c.spall)), size: 0.16, depth: 0.016, cut: 0.012 } : false,
    groove: g > 0.7 ? { count: 1, width: 0.006, depth: 0.002, branch: 0.2 } : false,
    pit: c.pit > 0 ? { size: 0.008, density: c.pit * 0.6, depth: 0.22 } : false,
  };
  const hc = M / c.rows, blocks = [];
  // each course its own breaks: `cols` blocks, their lengths jittered, the course slid along (it wraps round the repeat)
  for (let r = 0; r < c.rows; r++) {
    const slide = (r % 2 ? 0.5 : 0) * (M / c.cols) + (hash01(r, 1, seed) - 0.5) * 0.3 * (M / c.cols);
    const cuts = Array.from({ length: c.cols }, (_, k) => (k + (c.cols > 1 ? 0.28 * (hash01(r, k + 2, seed) - 0.5) : 0)) * (M / c.cols) + slide);
    for (let k = 0; k < c.cols; k++) {
      const x0 = cuts[k], x1 = k + 1 < c.cols ? cuts[k + 1] : cuts[0] + M;
      blocks.push({ id: blocks.length, x0: x0 + c.joint / 2, y0: r * hc + c.joint / 2, w: x1 - x0 - c.joint, h: hc - c.joint, tone: (hash01(r, k, seed + 7) - 0.5) * 2 * c.vary / 255, seed: seed * 101 + r * 13 + k + 1 });
    }
  }
  // each block painted in its own frame and laid whole, wrapping round the repeat's edges
  for (const B of blocks) {
    const F = reliefField({ outline: { shape: 'block', w: B.w, h: B.h, round: 0.004 }, ppm, relief, grit: g, seed: B.seed });
    const i0 = Math.round(B.x0 * ppm), j0 = Math.round(B.y0 * ppm);
    for (let j = 0; j < F.H; j++) for (let i = 0; i < F.W; i++) {
      const s = j * F.W + i;
      if (F.inside[s] <= 0) continue;
      const k = (((j0 + j) % H) + H) % H * W + (((i0 + i) % W) + W) % W;
      let z = F.height[s];
      const x = (i + 0.5) * px, y = (j + 0.5) * px;
      // a pitched (rock-faced) block: its face bulged and lumped, fading to the dressed margin
      if (c.tool === 'pitched') {
        const m = clamp(F.inside[s] / 0.04, 0, 1), lump = fractal2(x / 0.14, y / 0.11, { seed: B.seed + 21, octaves: 3, flavour: 'billow' })[0];
        z += m * (0.005 + 0.009 * g) * (0.8 + lump) + m * 0.006 * Math.sin(Math.PI * clamp(y / B.h, 0, 1)) * Math.sin(Math.PI * clamp(x / B.w, 0, 1));
      }
      height[k] = z; owner[k] = B.id; lx[k] = x; ly[k] = y;
    }
  }
  // the mortar: a rough bed, sunk; (texel dice wrap with the tile)
  for (let k = 0; k < W * H; k++) if (owner[k] < 0) height[k] = -c.recess + 0.0015 * (hash01(k % W, Math.floor(k / W), seed + 11) - 0.5);
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, LIGHT);
  const stone = rampOf(c.stone), mortar = rampOf(c.mortar), rgb = Buffer.alloc(W * H * 3);
  for (let k = 0; k < W * H; k++) {
    const v = lit.value[k], o = owner[k];
    let col;
    if (o >= 0) {
      // a block's own tone, a mottle across its face at two scales, the weather darker toward its foot, dirt in the hollows
      const B = blocks[o], mot = 0.07 * fractal2(lx[k] / 0.4, ly[k] / 0.4, { seed: B.seed + 3, octaves: 3 })[0] + 0.035 * gnoise2(lx[k] / 0.06, ly[k] / 0.06, B.seed + 5);
      const foot = 0.06 * (0.3 + g) * clamp(ly[k] / B.h, 0, 1) ** 2;
      col = rampAt(stone, 0.55 + (v - 1) * 1.25 + B.tone + mot - foot - 0.3 * lit.cavity[k] * (0.4 + 0.6 * g));
    } else col = rampAt(mortar, 0.3 + (v - 1) * 0.7);
    rgb[k * 3] = Math.round(col[0]); rgb[k * 3 + 1] = Math.round(col[1]); rgb[k * 3 + 2] = Math.round(col[2]);
  }
  return { rgb, W, H };
}

// periodic value noise: a lattice of `n` cells a repeat on each axis, wrapped, so a tile built of it has no seam
function pnoise(u, v, nu, nv, seed) {
  const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
  const h = (a, b) => hash01(((a % nu) + nu) % nu, ((b % nv) + nv) % nv, seed);
  const a = h(i, j) + (h(i + 1, j) - h(i, j)) * su, b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * su;
  return (a + (b - a) * sv) * 2 - 1;
}
// octaves of it, each cell count a whole multiple of the last, so every octave wraps with the repeat
function pfbm(x, y, M, cellX, cellY, oct, seed) {
  let s = 0, a = 1, n = 0;
  for (let o = 0; o < oct; o++) { const nu = Math.max(1, Math.round(M / cellX)) << o, nv = Math.max(1, Math.round(M / cellY)) << o; s += a * pnoise((x / M) * nu, (y / M) * nv, nu, nv, seed + o * 31); n += a; a *= 0.5; }
  return s / n;
}
const SHAFT_LIGHT = { az: 110, el: 62, ambient: 0.42, wrap: 0.4, reach: 0.03, soft: 0.003, floor: 0.5, radius: 0.02, cavity: 0.6, edge: 0.14, tile: true };

/** A pillar's repeat: a fluted or plain shaft, no course anywhere on it. */
function shaftTile(c, size, seed) {
  const W = size, H = size, M = c.metres, px = M / size, g = c.grit, fluted = c.cut === 'fluted';
  const pitch = M / c.flutes, fillet = 0.2 * pitch, cw = pitch - fillet, depth = 0.38 * (cw / 2);
  const height = new Float32Array(W * H), arris = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    let z = 0, ar = 0;
    if (fluted) {
      // a channel: a shallow arc across its width; a fillet between, flat, its two edges the arrises
      const fi = Math.floor(x / pitch), t = x - fi * pitch;
      if (t < cw) { const d = (t - cw / 2) / (cw / 2); z = -depth * Math.sqrt(Math.max(0, 1 - d * d)); ar = 1 - clamp(Math.min(t, cw - t) / (0.12 * cw), 0, 1); }
      // the arris chipped here and there along its length (a hand's breadth at a time)
      if (ar > 0) { const nick = hash01(fi, Math.floor(y / 0.09), seed + 41); if (nick < 0.12 * (0.3 + g)) z -= 0.004 * ar * (0.5 + nick * 4); }
    }
    // the stone's own unevenness, and its grain running up the shaft
    z += 0.0025 * pfbm(x, y, M, 0.25, 0.25, 3, seed + 3) + 0.0004 * (0.3 + g) * pfbm(x, y, M, 0.01, 0.12, 2, seed + 5);
    // pits, a few, on a wrapped grid of cells
    const ci = Math.floor(x / 0.03), cj = Math.floor(y / 0.03), nc = Math.round(M / 0.03), ph = hash01(((ci % nc) + nc) % nc, ((cj % nc) + nc) % nc, seed + 7);
    if (ph < c.pit * 0.12) { const dx = (x / 0.03 - ci - 0.5), dy = (y / 0.03 - cj - 0.5), r = Math.hypot(dx, dy); if (r < 0.3) z -= 0.0015 * (1 - r / 0.3); }
    height[k] = z; arris[k] = ar;
  }
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, SHAFT_LIGHT);
  const stone = rampOf(c.stone), rgb = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    // the weather: streaks running down the shaft (long in y, narrow in x), a broad mottle, dirt in the hollows
    const streak = Math.max(0, pfbm(x, y, M, 0.18, 1.5, 2, seed + 11) - 0.15) * (0.1 + 0.12 * g), mot = 0.08 * pfbm(x, y, M, 0.35, 0.35, 4, seed + 13) + 0.03 * pfbm(x, y, M, 0.05, 0.05, 2, seed + 17);
    const col = rampAt(stone, 0.56 + (lit.value[k] - 1) * 1.2 + mot - streak - 0.25 * lit.cavity[k] * (0.4 + 0.6 * g) + 0.05 * arris[k]);
    rgb[k * 3] = Math.round(col[0]); rgb[k * 3 + 1] = Math.round(col[1]); rgb[k * 3 + 2] = Math.round(col[2]);
  }
  return { rgb, W, H };
}
