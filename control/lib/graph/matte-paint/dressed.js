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
 * `face` (default 'wall'): a 'floor' is lit from nearly overhead (a floor has no up), each slab dished a little where it
 * is walked and polished on its crests, the dirt in its joints: floor blocks, a runner, a path.
 *
 * `cut` (default 'ashlar'): the coursed blocks above, for a wall. A PILLAR is never coursed like a wall: 'fluted' is one
 * shaft cut into vertical channels between narrow fillets (`flutes` a repeat), 'shaft' a plain monolith with its grain
 * running up it; both weathered in streaks running down, their arrises chipped here and there, lit from the upper left
 * (a flute varies across the shaft, so light from straight above would not find it) with the channels' hollows deep.
 *
 * `cut: 'render'`: a WALL OF LIME RENDER over the ashlar (the Dust map): the render a smooth coat proud of the stone,
 * trowelled and blotched with damp, fallen away in patches (`loss`, 0–1, the grit's by default) to the coursed blocks
 * behind it; each patch's edge a broken lip that casts its shadow onto the stone, the stone in the hollow dirtier than
 * the coat. `render` is the coat's colour (the stone's, lifted, by default).
 *
 * A ROOF and a TIMBER WALL, for a town's houses: `cut: 'tile'` clay tiles in courses (`rows` a repeat, `cols` tiles a
 * course), each course's lower edge lapping proud over the one below it and casting its shadow down onto it, each tile
 * rolled across like a pantile, its edge ragged, its tone its own, lichen at grit; `cut: 'slate'` thin flat slates the
 * same way, half-bonded course to course, each laid a little askew; `cut: 'boards'` vertical boards (`cols` a repeat)
 * with gaps between them, a grain running up each, knots, and the weather streaked down. Tile space is the roof's: v up
 * the slope, so the light from above (up the slope) finds each lap's edge.
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
export const DRESSED_DEFAULTS = Object.freeze({ cut: 'ashlar', face: 'wall', flutes: 12, rows: 4, cols: 2, joint: 0.012, recess: 0.008, tool: 'tooled', chamfer: 0.02, pillow: 0.003, spall: 0.5, pit: 0.3, vary: 30, grit: 0.5, metres: 2 });
const LIGHT = { az: 90, el: 40, ambient: 0.36, wrap: 0.2, reach: 0.05, soft: 0.002, floor: 0.35, radius: 0.012, cavity: 0.4, edge: 0.1, tile: true };
// a FLOOR has no up: lit from nearly overhead, read by its hollows (the joints, the pits, the worn dips) and its crests
const FLOOR_LIGHT = { az: 90, el: 78, ambient: 0.4, wrap: 0.3, reach: 0.03, soft: 0.003, floor: 0.45, radius: 0.015, cavity: 0.55, edge: 0.16, tile: true };

/** A ramp of five stops round a colour, dark to light (the material). */
const rampOf = (c) => [0.42, 0.68, 0.9, 1.08, 1.22].map((k) => c.map((v) => clamp(v * k, 0, 255)));
const rampAt = (R, t) => { const x = clamp(t, 0, 1) * (R.length - 1), i = Math.min(R.length - 2, Math.floor(x)), f = x - i; return R[i].map((v, k) => v + (R[i + 1][k] - v) * f); };

export function dressedTile(cfgIn, { size = 512, seed = 1 } = {}) {
  const cut = cfgIn.cut ?? 'ashlar';
  if (cut === 'fluted' || cut === 'shaft') return shaftTile({ ...DRESSED_DEFAULTS, ...cfgIn }, size, seed);
  if (cut === 'tile' || cut === 'slate') return roofTile({ ...DRESSED_DEFAULTS, ...cfgIn }, size, seed);
  if (cut === 'boards') return boardsTile({ ...DRESSED_DEFAULTS, ...cfgIn }, size, seed);
  const c = { ...DRESSED_DEFAULTS, ...cfgIn }, W = size, H = size, M = c.metres, px = M / size, g = c.grit;
  const { height, owner, lx, ly, blocks } = ashlarField(c, W, H, seed);
  if (cut === 'render') return renderTile(c, { W, H, px, height, owner, lx, ly, blocks }, seed);
  const floor = c.face === 'floor';
  // (a floor is worn where it is walked: each slab's face dished a little and polished on its crests)
  if (floor) for (let k = 0; k < W * H; k++) if (owner[k] >= 0) { const B = blocks[owner[k]], u = lx[k] / B.w - 0.5, v = ly[k] / B.h - 0.5; height[k] -= 0.003 * (0.4 + g) * (1 - 4 * (u * u + v * v)); }
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, floor ? FLOOR_LIGHT : LIGHT);
  const stone = rampOf(c.stone), mortar = rampOf(c.mortar), rgb = Buffer.alloc(W * H * 3);
  for (let k = 0; k < W * H; k++) {
    const col = ashlarColour(c, k, lit, owner, blocks, lx, ly, stone, mortar, floor);
    rgb[k * 3] = Math.round(col[0]); rgb[k * 3 + 1] = Math.round(col[1]); rgb[k * 3 + 2] = Math.round(col[2]);
  }
  return { rgb, W, H };
}

// a block's own tone, a mottle across its face at two scales, the weather darker toward its foot, dirt in the hollows
function ashlarColour(c, k, lit, owner, blocks, lx, ly, stone, mortar, floor) {
  const v = lit.value[k], o = owner[k], g = c.grit;
  if (o < 0) return rampAt(mortar, 0.3 + (v - 1) * 0.7);
  const B = blocks[o], mot = 0.07 * fractal2(lx[k] / 0.4, ly[k] / 0.4, { seed: B.seed + 3, octaves: 3 })[0] + 0.035 * gnoise2(lx[k] / 0.06, ly[k] / 0.06, B.seed + 5);
  const foot = floor ? -0.04 * lit.convex[k] : 0.06 * (0.3 + g) * clamp(ly[k] / B.h, 0, 1) ** 2;
  return rampAt(stone, 0.55 + (v - 1) * 1.25 + B.tone + mot - foot - 0.3 * lit.cavity[k] * (0.4 + 0.6 * g));
}

/** The coursed blocks' relief, laid whole and wrapped: → { height, owner (a texel's block, −1 the mortar), lx, ly, blocks }. */
function ashlarField(c, W, H, seed) {
  const M = c.metres, px = M / W, ppm = W / M, g = c.grit;
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
  return { height, owner, lx, ly, blocks };
}

/** Lime render over the ashlar, fallen away in patches to it (`cut: 'render'`). */
function renderTile(c, F, seed) {
  const { W, H, px, height, owner, lx, ly, blocks } = F, M = c.metres, g = c.grit;
  const loss = c.loss ?? clamp(0.12 + 0.5 * g, 0, 1), coat = c.render ?? c.stone.map((v) => clamp(v * 1.12 + 14, 0, 255));
  // where the coat has gone: broad patches (wider than tall, as render falls in sheets), their edges broken finer
  const T = 0.5 - 0.62 * loss, thick = 0.012 + 0.006 * g, on = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    const L = 0.8 * sfbm(x, y, M, 0.7, 0.45, 4, seed + 51) + 0.2 * sfbm(x, y, M, 0.07, 0.07, 2, seed + 53);
    // the coat's cover: whole well below the threshold, gone above it, its lip a few centimetres (it thins, then breaks)
    const w = clamp((T - L * 2.2) / 0.06, 0, 1);
    on[k] = w;
    if (w > 0) {
      // the coat: proud of the stone, trowelled in soft swells, a fine grain; at its lip it thins to a broken edge
      const z = thick * (0.35 + 0.65 * w) + 0.0022 * sfbm(x, y, M, 0.3, 0.3, 3, seed + 55) + 0.0004 * sfbm(x, y, M, 0.015, 0.015, 2, seed + 57);
      height[k] = Math.max(height[k], z * (w > 0.02 ? 1 : 0));
    }
  }
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, LIGHT);
  const stone = rampOf(c.stone), mortar = rampOf(c.mortar), plaster = rampOf(coat), rgb = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    let col;
    if (on[k] > 0.02) {
      // the coat: damp blotches and a fine mottle, dirt where it is hollow, a little dark at its broken lip
      // (and streaks of weather run down it from above, long and narrow)
      const damp = 0.14 * sfbm(x, y, M, 0.5, 0.8, 3, seed + 61) + 0.04 * sfbm(x, y, M, 0.05, 0.05, 2, seed + 63), streak = Math.max(0, sfbm(x, y, M, 0.12, 1, 2, seed + 65) - 0.1) * (0.08 + 0.12 * g);
      col = rampAt(plaster, 0.6 + (lit.value[k] - 1) * 1.1 + damp - streak - 0.25 * lit.cavity[k] * (0.4 + 0.6 * g) - 0.1 * (1 - on[k]));
    } else {
      // the stone behind it: the ashlar's own colour, dirtier for having been under the coat
      col = ashlarColour(c, k, lit, owner, blocks, lx, ly, stone, mortar, false).map((v) => v * (0.88 - 0.06 * g));
    }
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
// the same, each octave's lattice slid by whole cells of its own (still periodic), so the octaves do not all peak at the
// repeat's origin (pfbm's octaves share it: a field thresholded hard shows them lined up there)
function sfbm(x, y, M, cellX, cellY, oct, seed) {
  let s = 0, a = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    const nu = Math.max(1, Math.round(M / cellX)) << o, nv = Math.max(1, Math.round(M / cellY)) << o;
    const du = Math.floor(hash01(o, 3, seed) * nu), dv = Math.floor(hash01(o, 5, seed) * nv);
    s += a * pnoise((x / M) * nu + du + 0.37, (y / M) * nv + dv + 0.61, nu, nv, seed + o * 31); n += a; a *= 0.5;
  }
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

/** A roof's repeat: tiles or slates in lapped courses. */
function roofTile(c, size, seed) {
  const W = size, H = size, M = c.metres, px = M / size, g = c.grit, slate = c.cut === 'slate';
  const hc = M / c.rows, tw = M / c.cols, lap = slate ? 0.007 : 0.016, roll = slate ? 0 : 0.028, gap = slate ? 0.005 : 0.003;
  const height = new Float32Array(W * H), tone = new Float32Array(W * H), edge = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i, r = Math.floor(y / hc);
    // the course: half-bonded for slate, the tiles' columns kept for pantiles (a few centimetres' slip)
    const shift = slate ? (r % 2) * tw / 2 : (hash01(r % c.rows, 1, seed) - 0.5) * 0.15 * tw;
    const xi = x + shift, col = ((Math.floor(xi / tw) % c.cols) + c.cols) % c.cols, fx = xi / tw - Math.floor(xi / tw);
    // the lower edge ragged a little, each tile its own; fy from 0 at the course's top (under the one above) to 1 at its edge
    const rag = (hash01(r % c.rows, col, seed + 3) - 0.5) * 0.12 * hc + (slate ? 0.004 * pnoise(fx * 3, r, 3, c.rows, seed + 5) : 0);
    const fy = clamp((y - r * hc) / (hc + rag), 0, 1);
    let z = lap * fy ** 0.75 + roll * Math.cos(Math.PI * (2 * fx - 1)) * 0.5;
    // a slate laid a little askew; the joint between two tiles a dark slot
    if (slate) z += 0.0025 * (hash01(r % c.rows, col, seed + 7) - 0.5) * (fx - 0.5) * 2;
    const dj = Math.min(fx, 1 - fx) * tw;
    if (dj < gap) z -= 0.004 * (1 - dj / gap);
    height[k] = z; tone[k] = (hash01(r % c.rows, col, seed + 9) - 0.5) * 2 * c.vary / 255; edge[k] = fy;
  }
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, LIGHT);
  const body = rampOf(c.stone), rgb = Buffer.alloc(W * H * 3), lichen = [176, 178, 120];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    const mot = 0.06 * sfbm(x, y, M, 0.3, 0.3, 3, seed + 11) + 0.03 * sfbm(x, y, M, 0.04, 0.04, 2, seed + 13);
    // the weather darker toward each course's exposed foot, lichen in spots at grit
    let col = rampAt(body, 0.56 + (lit.value[k] - 1) * 1.3 + tone[k] + mot - 0.05 * edge[k] * (0.3 + g) - 0.3 * lit.cavity[k] * (0.4 + 0.6 * g));
    // (lichen a fine speckle, gathered toward each course's exposed foot where the wet sits: a blotch thresholded broad
    // reads as camouflage)
    const L = 0.6 * sfbm(x, y, M, 0.025, 0.025, 2, seed + 15) + 0.4 * sfbm(x, y, M, 0.2, 0.2, 2, seed + 17), at = 0.52 - 0.22 * g - 0.12 * edge[k];
    if (L > at) col = col.map((v, q) => v + (lichen[q] - v) * clamp((L - at) * 4, 0, 0.3));
    rgb[k * 3] = Math.round(col[0]); rgb[k * 3 + 1] = Math.round(col[1]); rgb[k * 3 + 2] = Math.round(col[2]);
  }
  return { rgb, W, H };
}

/** A timber wall's repeat: vertical boards, their gaps, grain, knots and weather. */
function boardsTile(c, size, seed) {
  const W = size, H = size, M = c.metres, px = M / size, g = c.grit, bw = M / c.cols, gap = 0.007;
  const height = new Float32Array(W * H), tone = new Float32Array(W * H), knot = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i, b = Math.floor(x / bw) % c.cols, fx = x / bw - Math.floor(x / bw), dj = Math.min(fx, 1 - fx) * bw;
    // the board: its face a little cupped, the grain in fine ridges running up it, the gap between boards a slot
    let z = 0.0015 * Math.cos(Math.PI * (2 * fx - 1)) + 0.0006 * (0.4 + g) * sfbm(x, y, M, 0.006, 0.4, 3, seed + 21 + b);
    if (dj < gap) z -= 0.006 * (1 - dj / gap);
    // knots: a few to a board, on a wrapped grid of cells up it
    const cy = Math.floor(y / 0.5), nc = Math.max(1, Math.round(M / 0.5)), h = hash01(b, ((cy % nc) + nc) % nc, seed + 23);
    if (h < 0.35) { const kx = (0.25 + 0.5 * hash01(b, cy, seed + 25)) * bw, ky = (cy + 0.2 + 0.6 * hash01(b, cy, seed + 27)) * 0.5, d = Math.hypot((fx * bw - kx) * 2.2, y - ky); if (d < 0.03) { z -= 0.0012 * (1 - d / 0.03); knot[k] = 1 - d / 0.03; } }
    height[k] = z; tone[k] = (hash01(b, 3, seed + 29) - 0.5) * 2 * c.vary / 255;
  }
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, SHAFT_LIGHT);
  const wood = rampOf(c.stone), rgb = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    const grain = 0.05 * sfbm(x, y, M, 0.01, 0.6, 2, seed + 31), streak = Math.max(0, sfbm(x, y, M, 0.15, 1.2, 2, seed + 33) - 0.1) * (0.1 + 0.15 * g);
    const col = rampAt(wood, 0.55 + (lit.value[k] - 1) * 1.2 + tone[k] + grain - streak - 0.25 * knot[k] - 0.3 * lit.cavity[k] * (0.4 + 0.6 * g));
    rgb[k * 3] = Math.round(col[0]); rgb[k * 3 + 1] = Math.round(col[1]); rgb[k * 3 + 2] = Math.round(col[2]);
  }
  return { rgb, W, H };
}
