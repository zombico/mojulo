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
 * MODERN materials, the industrial class (machine-made, cement-bound, regular; weathered by rain streaks, stains and
 * efflorescence, never by loss): `cut: 'brick'` wire-cut brick in an exact stretcher bond (`rows` courses and `cols`
 * bricks a repeat), crisp, thin struck joints, a burnt brick here and there, a white bloom low at grit; `'concrete'`
 * board-formed concrete cast in form panels (`cols` × `rows` a repeat), each board's grain pressed into it, the panels'
 * joints standing as thin fins, tie holes in rows, bug holes, a dark streak run down below each tie hole; `'precast'`
 * large panels (`cols` × `rows`) with chamfered edges and dark sealant joints, a sandblasted face, dirt washed down from
 * each joint; `'stucco'` a smooth floated coat over the wall, its control joints a groove at the repeat's edge, hairline
 * cracks at grit, a patchy repaint and the weather streaked down; `'pavement'` (a floor) concrete slabs scored into
 * squares (`cols` a repeat), a broom finish across them, a crack or two, chips at their arrises, spots and stains;
 * `'asphalt'` (a floor) a road's dense aggregate in its binder, patched where it was dug (squares a shade apart, their
 * edges proud), its cracks sealed in tar, an oil stain here and there. And an ANCIENT road: `'setts'` (a floor) small
 * stones in courses (`rows` × `cols` a repeat, their lengths their own), crowned and worn smooth on top, set in sand.
 *
 * The NATURAL class, the land a town stands in (era/gritty-land.js): `cut: 'turf'` (a floor) a sward from above, blades
 * in every direction standing in tussocks, bare earth worn through in patches at grit; `'leaves'` a crown's skin, leaves
 * laid over one another, domed, grooved down the midrib, the dark between them; `'bark'` (u round a trunk, v up it)
 * rounded plates between furrows running up and forking; `'path'` (a floor) packed earth, crumbs, pebbles pressed into
 * it, worn hollows; `'verge'` a path's edge laid across it (v from the path's side to the land's): earth and pebbles
 * giving way to turf. Each is painted in its stone's
 * ramp alone (a grey, laid as a detail, rides on the face's own colour).
 *
 * SEAMLESS by construction: whole courses and whole blocks a repeat (a course's breaks wrap round its length), every
 * block painted in its own coordinates and laid whole, wrapping round the edge it crosses, and the light's march and
 * cavity wrapped (light.js `tile`). Pure: the seed's dice only; the same cfg and seed paint the same bytes.
 */
import { reliefField, hash01 } from './relief.js';
import { lightRelief } from './light.js';
import { gnoise2, fractal2 } from '../noise/noise.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
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
  if (MODERN[cut]) return MODERN[cut]({ ...DRESSED_DEFAULTS, ...cfgIn }, size, seed);
  if (NATURAL[cut]) return NATURAL[cut]({ ...DRESSED_DEFAULTS, ...cfgIn }, size, seed);
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

// ── the modern class ────────────────────────────────────────────────────────────────────────────────────────────────
// a texel loop with its own height and paint passes: `shape(x, y, k)` sets the height (and any per-texel facts), `colour`
// paints from the lit value; lit by `light`
function paintedTile(c, size, light, shape, colour) {
  const W = size, H = size, M = c.metres, px = M / size, height = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) height[j * W + i] = shape((i + 0.5) * px, (j + 0.5) * px, j * W + i);
  const lit = lightRelief({ W, H, px, height, inside: new Float32Array(W * H).fill(1) }, light), rgb = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, col = colour((i + 0.5) * px, (j + 0.5) * px, k, lit);
    rgb[k * 3] = Math.round(clamp(col[0], 0, 255)); rgb[k * 3 + 1] = Math.round(clamp(col[1], 0, 255)); rgb[k * 3 + 2] = Math.round(clamp(col[2], 0, 255));
  }
  return { rgb, W, H };
}
// a wrapped grid's cell dice (cells of about `cell` metres, snapped to a whole number round a repeat of M, so the grid
// wraps with it)
const snapCell = (M, cell) => M / Math.max(1, Math.round(M / cell));
const cellHash = (x, y, M, cell, seed) => { const n = Math.max(1, Math.round(M / cell)), cs = M / n, i = Math.floor(x / cs), j = Math.floor(y / cs); return hash01(((i % n) + n) % n, ((j % n) + n) % n, seed); };
const white = [236, 234, 226];

const MODERN = {
  // a road's asphalt: aggregate in its binder, repairs patched in squares, cracks sealed in tar, oil stains
  asphalt(c, size, seed) {
    const M = c.metres, g = c.grit, body = rampOf(c.stone), tar = [24, 24, 26], patch = new Float32Array(size * size), seal = new Float32Array(size * size), oil = new Float32Array(size * size);
    return paintedTile(c, size, FLOOR_LIGHT, (x, y, k) => {
      // the aggregate: a stone in most cells of a fine wrapped grid, its crown standing out of the binder
      const ac = snapCell(M, 0.007), h = cellHash(x, y, M, ac, seed + 3), ax = (Math.floor(x / ac) + 0.3 + 0.4 * h) * ac, ay = (Math.floor(y / ac) + 0.3 + 0.4 * cellHash(x, y, M, ac, seed + 4)) * ac, d = Math.hypot(x - ax, y - ay) / (0.5 * ac);
      let z = (h < 0.8 ? 0.0012 * clamp(1 - d * d, 0, 1) : 0) + 0.0005 * sfbm(x, y, M, 0.5, 0.5, 2, seed + 5);
      // a repair: a square cut and filled a shade apart in a few cells of a coarse grid, its edge a hair proud
      const pc = M / 2, ph = cellHash(x, y, M, pc, seed + 7), fx = x / pc - Math.floor(x / pc), fy = y / pc - Math.floor(y / pc);
      const inP = ph < 0.25 + 0.3 * g && fx > 0.15 && fx < 0.15 + 0.5 * (0.6 + ph) && fy > 0.2 && fy < 0.75;
      patch[k] = inP ? (ph < 0.15 ? -1 : 1) : 0;
      if (inP && Math.min(fx - 0.15, 0.15 + 0.5 * (0.6 + ph) - fx, fy - 0.2, 0.75 - fy) * pc < 0.01) z += 0.0015;
      // a crack sealed in tar: the long wandering contour of a broad field, a band of sealant over it
      const cl = Math.abs(sfbm(x, y, M, 2, 2, 2, seed + 11));
      seal[k] = g > 0.2 ? 1 - smoothstep(0.004, 0.012, cl) : 0;
      oil[k] = clamp((sfbm(x, y, M, 0.7, 0.9, 3, seed + 13) - 0.35) * 3, 0, 1);
      return z + 0.0006 * seal[k];
    }, (x, y, k, lit) => {
      let col = rampAt(body, 0.55 + (lit.value[k] - 1) * 1.3 + 0.06 * patch[k] + 0.03 * sfbm(x, y, M, 0.2, 0.2, 2, seed + 15) - 0.12 * oil[k] * (0.4 + g) - 0.25 * lit.cavity[k]);
      if (seal[k] > 0) col = col.map((v, q) => v + (tar[q] - v) * 0.8 * seal[k]);
      return col;
    });
  },
  // an ancient road's setts: small stones in courses, each its own length, crowned and worn smooth, set in sand
  setts(c, size, seed) {
    const M = c.metres, g = c.grit, hc = M / c.rows, body = rampOf(c.stone), sand = rampOf(c.mortar), jt = 0.012, tone = new Float32Array(size * size), joint = new Uint8Array(size * size);
    // each course's cuts: `cols` setts, their lengths jittered, the course slid (they wrap round the repeat)
    const cuts = Array.from({ length: c.rows }, (_, r) => { const w = M / c.cols, slide = hash01(r, 1, seed) * w; return Array.from({ length: c.cols }, (_, q) => slide + (q + 0.3 * (hash01(r, q + 2, seed) - 0.5)) * w); });
    return paintedTile(c, size, FLOOR_LIGHT, (x, y, k) => {
      const r = Math.floor(y / hc) % c.rows, C = cuts[r], fy = y / hc - Math.floor(y / hc);
      let q = -1, a = 0, b = 0;
      for (let i = 0; i < c.cols; i++) { const lo = C[i], hi = i + 1 < c.cols ? C[i + 1] : C[0] + M; for (const off of [0, -M, M]) if (x >= lo + off && x < hi + off) { q = i; a = lo + off; b = hi + off; } }
      const fx = (x - a) / (b - a || 1), dx = Math.min(x - a, b - x), dy = Math.min(fy, 1 - fy) * hc;
      tone[k] = (hash01(r, q, seed + 5) - 0.5) * 2 * c.vary / 255;
      if (Math.min(dx, dy) < jt / 2) { joint[k] = 1; return -0.01; }
      // crowned: highest in its middle, worn flat on top and polished there
      const u = 2 * fx - 1, v = 2 * fy - 1, crown = (1 - u * u * u * u) * (1 - v * v * v * v);
      return -0.006 + 0.008 * crown + 0.0005 * sfbm(x, y, M, 0.03, 0.03, 2, seed + 7);
    }, (x, y, k, lit) => {
      if (joint[k]) return rampAt(sand, 0.4 + (lit.value[k] - 1) * 0.8);
      return rampAt(body, 0.55 + (lit.value[k] - 1) * 1.25 + tone[k] + 0.06 * lit.convex[k] * (0.4 + g) + 0.03 * sfbm(x, y, M, 0.05, 0.05, 2, seed + 9) - 0.3 * lit.cavity[k]);
    });
  },
  // wire-cut brick: an exact half bond, crisp arrises, thin struck joints, its tone a little each, a burnt one now and then
  brick(c, size, seed) {
    const M = c.metres, g = c.grit, hc = M / c.rows, bw = M / c.cols, jt = 0.009, tone = new Float32Array(size * size), mort = new Uint8Array(size * size);
    const body = rampOf(c.stone), mortar = rampOf(c.mortar);
    return paintedTile(c, size, LIGHT, (x, y, k) => {
      const r = Math.floor(y / hc), xi = x + (r % 2) * bw / 2, b = ((Math.floor(xi / bw) % c.cols) + c.cols) % c.cols;
      const fx = xi / bw - Math.floor(xi / bw), fy = y / hc - r, dx = Math.min(fx, 1 - fx) * bw, dy = Math.min(fy, 1 - fy) * hc, d = Math.min(dx, dy);
      const h = hash01(r % c.rows, b, seed + 3);
      tone[k] = (h - 0.5) * 2 * c.vary / 255 - (h > 0.94 ? 0.12 : 0);
      if (d < jt / 2) { mort[k] = 1; return -0.004 + 0.002 * (d / (jt / 2)) ** 2; }
      // (an arris eased a millimetre or two; the face's fine sand)
      return -0.001 * clamp(1 - (d - jt / 2) / 0.004, 0, 1) + 0.00025 * sfbm(x, y, M, 0.004, 0.004, 2, seed + 5);
    }, (x, y, k, lit) => {
      if (mort[k]) return rampAt(mortar, 0.62 + (lit.value[k] - 1) * 0.8);
      let col = rampAt(body, 0.56 + (lit.value[k] - 1) * 1.2 + tone[k] + 0.03 * sfbm(x, y, M, 0.05, 0.05, 2, seed + 7) - 0.2 * lit.cavity[k]);
      // efflorescence: a white bloom low on the wall at grit
      const bloom = clamp((sfbm(x, y, M, 0.3, 0.2, 3, seed + 9) - 0.25) * 3, 0, 1) * clamp(y / M - 0.55, 0, 1) * g;
      return col.map((v, q) => v + (white[q] - v) * 0.5 * bloom);
    });
  },
  // board-formed concrete: form panels, the boards' grain pressed in, tie holes in rows, bug holes, a streak under each hole
  concrete(c, size, seed) {
    const M = c.metres, g = c.grit, pw = M / c.cols, ph = M / c.rows, board = 0.15, tieX = pw / 4, tieY = ph / 4;
    const body = rampOf(c.stone), panelTone = new Float32Array(size * size), streak = new Float32Array(size * size);
    return paintedTile(c, size, LIGHT, (x, y, k) => {
      const pi = Math.floor(x / pw), pj = Math.floor(y / ph), fx = x - pi * pw, fy = y - pj * ph;
      panelTone[k] = (hash01(pi % c.cols, pj % c.rows, seed + 3) - 0.5) * 2 * c.vary / 255;
      // the boards: their grain along them, each a hair proud or shy of the next
      const bi = Math.floor(y / board), lip = (hash01(bi % Math.round(M / board), pi % c.cols, seed + 5) - 0.5) * 0.0012;
      let z = lip + 0.0005 * sfbm(x, y, M, 0.35, 0.008, 3, seed + 7 + (bi % 4)) + 0.0002 * sfbm(x, y, M, 0.01, 0.01, 2, seed + 9);
      // the panel joint stands as a thin fin where the forms met
      if (Math.min(fx, pw - fx) < 0.006 || Math.min(fy, ph - fy) < 0.006) z += 0.0025;
      // the tie holes, in rows; a streak run down below each
      const tx = Math.round(fx / tieX - 0.5) + 0.5, ty = Math.round(fy / tieY - 0.5) + 0.5, dx = fx - tx * tieX, dy = fy - ty * tieY, rr = Math.hypot(dx, dy);
      if (rr < 0.014) z -= 0.008 * (1 - (rr / 0.014) ** 2);
      streak[k] = Math.abs(dx) < 0.012 && dy > 0 && dy < 0.35 * tieY * (0.6 + g) ? (1 - Math.abs(dx) / 0.012) * (1 - dy / (0.35 * tieY * (0.6 + g))) : 0;
      // bug holes: the air the pour trapped against the form
      if (cellHash(x, y, M, 0.018, seed + 11) < 0.035) { const bc = snapCell(M, 0.018), cx = (Math.floor(x / bc) + 0.5) * bc, cy = (Math.floor(y / bc) + 0.5) * bc, d = Math.hypot(x - cx, y - cy); if (d < 0.004) z -= 0.002 * (1 - d / 0.004); }
      return z;
    }, (x, y, k, lit) => {
      const mot = 0.05 * sfbm(x, y, M, 0.5, 0.5, 3, seed + 13) + 0.025 * sfbm(x, y, M, 0.04, 0.04, 2, seed + 15);
      const rain = Math.max(0, sfbm(x, y, M, 0.2, 1.4, 2, seed + 17) - 0.1) * (0.08 + 0.15 * g);
      return rampAt(body, 0.58 + (lit.value[k] - 1) * 1.15 + panelTone[k] + mot - rain - (0.08 + 0.1 * g) * streak[k] - 0.28 * lit.cavity[k]);
    });
  },
  // precast panels: chamfered, a sandblasted face, dark sealant joints, the dirt washed down from each joint
  precast(c, size, seed) {
    const M = c.metres, g = c.grit, pw = M / c.cols, ph = M / c.rows, jt = 0.016, body = rampOf(c.stone), seal = [52, 52, 54];
    const tone = new Float32Array(size * size), joint = new Uint8Array(size * size), below = new Float32Array(size * size);
    return paintedTile(c, size, LIGHT, (x, y, k) => {
      const pi = Math.floor(x / pw), pj = Math.floor(y / ph), fx = x - pi * pw, fy = y - pj * ph, d = Math.min(fx, pw - fx, fy, ph - fy);
      tone[k] = (hash01(pi % c.cols, pj % c.rows, seed + 3) - 0.5) * 2 * c.vary / 255; below[k] = fy / ph;
      if (d < jt / 2) { joint[k] = 1; return -0.012; }
      return -0.006 * clamp(1 - (d - jt / 2) / 0.012, 0, 1) + 0.0003 * sfbm(x, y, M, 0.005, 0.005, 2, seed + 5) + 0.0006 * sfbm(x, y, M, 0.6, 0.6, 2, seed + 7);
    }, (x, y, k, lit) => {
      if (joint[k]) return seal.map((v) => v * (0.8 + 0.4 * lit.value[k]));
      // (the joint above each panel feeds a wash of dirt down its face, heaviest just under it)
      const wash = Math.max(0, sfbm(x, y, M, 0.15, 1, 2, seed + 9) + 0.2) * (1 - below[k]) ** 2 * (0.06 + 0.14 * g);
      return rampAt(body, 0.6 + (lit.value[k] - 1) * 1.1 + tone[k] + 0.03 * sfbm(x, y, M, 0.3, 0.3, 3, seed + 11) - wash - 0.25 * lit.cavity[k]);
    });
  },
  // stucco: a floated coat, its control joint a groove at the repeat's edge, hairline cracks, a patchy repaint, the rain
  stucco(c, size, seed) {
    const M = c.metres, g = c.grit, coat = rampOf(c.render ?? c.stone), crack = new Float32Array(size * size);
    return paintedTile(c, size, LIGHT, (x, y, k) => {
      let z = 0.0014 * sfbm(x, y, M, 0.45, 0.3, 3, seed + 3) + 0.0003 * sfbm(x, y, M, 0.004, 0.004, 2, seed + 5);
      if (Math.min(x, M - x) < 0.007 || Math.min(y, M - y) < 0.007) z -= 0.004;
      // hairline cracks: a ridge of noise thin as a line, kept where a broader mask says the coat has moved
      const line = Math.abs(sfbm(x, y, M, 0.75, 0.75, 2, seed + 7)), keep = sfbm(x, y, M, 1, 1, 2, seed + 9) > 0.45 - 0.3 * g;
      crack[k] = keep ? 1 - smoothstep(0.0015, 0.005, line) : 0;
      return z - 0.0006 * crack[k];
    }, (x, y, k, lit) => {
      // (a repaint's patches soft-edged and faint: a hard edge thresholded broad reads as camouflage)
      const repaint = 0.03 * clamp(sfbm(x, y, M, 0.8, 0.6, 2, seed + 11) * 2.5, -1, 1);
      const rain = Math.max(0, sfbm(x, y, M, 0.15, 1.2, 2, seed + 13) - 0.05) * (0.06 + 0.16 * g);
      return rampAt(coat, 0.62 + (lit.value[k] - 1) * 1.1 + repaint + 0.02 * sfbm(x, y, M, 0.05, 0.05, 2, seed + 15) - rain - 0.18 * crack[k] - 0.25 * lit.cavity[k]);
    });
  },
  // a concrete sidewalk: slabs scored into squares, a broom finish across them, a crack or two, chipped arrises, stains
  pavement(c, size, seed) {
    const M = c.metres, g = c.grit, sw = M / c.cols, body = rampOf(c.stone), stain = new Float32Array(size * size), crack = new Float32Array(size * size);
    return paintedTile(c, size, FLOOR_LIGHT, (x, y, k) => {
      const fx = x / sw - Math.floor(x / sw), fy = y / sw - Math.floor(y / sw), d = Math.min(fx, 1 - fx, fy, 1 - fy) * sw;
      // the broom: fine striations across the walk (along x), each slab's own
      let z = 0.0002 * Math.sin((y / snapCell(M, 0.003)) * Math.PI * 2 + 3 * sfbm(x, y, M, 0.08, 0.5, 2, seed + 3)) + 0.0003 * sfbm(x, y, M, 0.3, 0.3, 2, seed + 5);
      if (d < 0.006) z -= 0.004 * (1 - d / 0.006);
      // a chip out of an arris here and there; a crack or two across a slab
      if (d < 0.02 && cellHash(x, y, M, 0.08, seed + 7) < 0.15 * (0.3 + g)) z -= 0.003;
      // (a crack runs across a slab along a line, wobbling a little: in a few slabs, each its own angle; the noise's own
      // zero-crossings would loop)
      const si = Math.floor(x / sw), sj = Math.floor(y / sw), nS = c.cols, sh = (q) => hash01(((si % nS) + nS) % nS, ((sj % nS) + nS) % nS, seed + q);
      if (sh(11) < 0.15 + 0.35 * g) {
        const a = sh(12) * Math.PI, nx = Math.cos(a), ny = Math.sin(a), cx = (si + 0.3 + 0.4 * sh(13)) * sw, cy = (sj + 0.3 + 0.4 * sh(14)) * sw;
        const t = (x - cx) * -ny + (y - cy) * nx, dist = Math.abs((x - cx) * nx + (y - cy) * ny + 0.006 * gnoise2(t / 0.07, sh(15) * 97, seed + 16));
        // (a crack ends at the slab's joint: it is not drawn in the joint's groove)
        crack[k] = d < 0.006 ? 0 : 1 - smoothstep(0.0012, 0.004, dist);
      } else crack[k] = 0;
      // the spots and stains a walk collects: round spots on a wrapped grid, broad damp patches at grit
      const sc = snapCell(M, 0.05), scx = (Math.floor(x / sc) + 0.5) * sc, scy = (Math.floor(y / sc) + 0.5) * sc, sr = Math.hypot(x - scx, y - scy) / (0.35 * sc);
      stain[k] = (cellHash(x, y, M, sc, seed + 13) < 0.04 * (0.4 + g) ? clamp(1 - sr, 0, 1) : 0) * 0.6 + clamp((sfbm(x, y, M, 0.6, 0.6, 3, seed + 15) - 0.3) * 2, 0, 1) * 0.5 * g;
      return z - 0.002 * crack[k];
    }, (x, y, k, lit) => {
      const tone = (cellHash(x, y, M, sw, seed + 17) - 0.5) * 2 * c.vary / 255;
      return rampAt(body, 0.6 + (lit.value[k] - 1) * 1.1 + tone + 0.03 * sfbm(x, y, M, 0.1, 0.1, 2, seed + 19) - 0.18 * stain[k] - 0.3 * crack[k] - 0.3 * lit.cavity[k]);
    });
  },
};

// ── the natural class ───────────────────────────────────────────────────────────────────────────────────────────────
// the land a gritty cube's buildings stand in (era/gritty-land.js), painted as its stone is: no colour of its own (its
// ramp a grey's, so laid as a detail it rides on the face's own colour), every mark relief the light finds
const TURF_LIGHT = { az: 90, el: 56, ambient: 0.38, wrap: 0.25, reach: 0.03, soft: 0.002, floor: 0.4, radius: 0.014, cavity: 0.6, edge: 0.14, tile: true };
const LEAF_LIGHT = { az: 95, el: 50, ambient: 0.34, wrap: 0.3, reach: 0.05, soft: 0.003, floor: 0.32, radius: 0.02, cavity: 0.7, edge: 0.16, tile: true };
// the strokes of a wrapped grid's cells (cells of `cell`, snapped round M) that cover (x, y): `each(cx, cy, h)` for each
// of `per` marks a cell in the 3 × 3 cells round it, h(q) the mark's own dice
function marksNear(x, y, M, cell, per, seed, each) {
  const n = Math.max(1, Math.round(M / cell)), cs = M / n, ci = Math.floor(x / cs), cj = Math.floor(y / cs);
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const I = ci + di, J = cj + dj, wi = ((I % n) + n) % n, wj = ((J % n) + n) % n;
    for (let q = 0; q < per; q++) { const h = (r) => hash01(wi * per + q, wj, seed + r * 7); each((I + h(1)) * cs, (J + h(2)) * cs, h, cs); }
  }
}
// a stone's distance from its middle, 1 at its outline: a stone, not a drop (a few facets of its own, turned, a little long)
function stoneDist(x, y, cx, cy, r, h) {
  const a = Math.atan2(y - cy, x - cx), n = 5 + Math.floor(3 * h(8)), seg = (2 * Math.PI) / n, w = ((((a + h(9) * 6.283) % seg) + seg) % seg) - seg / 2;
  return Math.hypot((x - cx) * (1 - 0.3 * h(5)), y - cy) / (r * (Math.cos(Math.PI / n) / Math.cos(w)));
}
const NATURAL = {
  // a sward from above: blades in every direction, each a tapered ridge, standing in tussocks; bare earth where a broad
  // patch is worn through (more of it with grit), a shade down and smooth but for its crumbs
  turf(c, size, seed) {
    const M = c.metres, g = c.grit, body = rampOf(c.stone), bare = new Float32Array(size * size);
    return paintedTile(c, size, TURF_LIGHT, (x, y, k) => {
      const b = clamp((-0.3 + 0.3 * g - sfbm(x, y, M, 0.7, 0.7, 3, seed + 5)) / 0.08, 0, 1);
      let z = 0;
      marksNear(x, y, M, 0.035, 3, seed + 11, (cx, cy, h, cs) => {
        const a = h(3) * Math.PI, ux = Math.cos(a), uy = Math.sin(a), L = cs * (1.6 + 1.2 * h(4)), wd = cs * 0.13, dx = x - cx, dy = y - cy;
        const t = clamp(dx * ux + dy * uy, -L / 2, L / 2), d = Math.hypot(dx - t * ux, dy - t * uy);
        if (d < wd) { const v = 0.005 * (0.55 + 0.45 * h(5)) * (1 - (2 * t / L) ** 2) * Math.sqrt(1 - d / wd); if (v > z) z = v; }
      });
      bare[k] = b;
      return z * (1 - b) + 0.007 * sfbm(x, y, M, 0.25, 0.25, 3, seed + 3) * (1 - 0.6 * b) + 0.0006 * sfbm(x, y, M, 0.015, 0.015, 2, seed + 13) * b;
    }, (x, y, k, lit) => rampAt(body, 0.56 + (lit.value[k] - 1) * 1.3 + 0.06 * sfbm(x, y, M, 0.45, 0.45, 3, seed + 17) - 0.35 * lit.cavity[k] * (0.6 + 0.4 * g) - 0.06 * bare[k]));
  },
  // a crown's skin: leaves laid over one another, each pointed at both ends, domed across, a groove down its midrib, its
  // tip dipped; gathered into MASSES (the broad shape a crown reads by from afar), thin and dark between them
  leaves(c, size, seed) {
    const M = c.metres, g = c.grit, body = rampOf(c.stone), tone = new Float32Array(size * size), gap = new Float32Array(size * size), mass = new Float32Array(size * size);
    return paintedTile(c, size, LEAF_LIGHT, (x, y, k) => {
      const m = smoothstep(-0.35, 0.3, sfbm(x, y, M, 0.75, 0.75, 2, seed + 7));
      let best = -1, z = 0, tn = 0;
      marksNear(x, y, M, 0.15, 4, seed + 11, (cx, cy, h, cs) => {
        // (fewer leaves between the masses: a leaf there only if its dice clear the mass's thinning)
        const layer = h(6); if (layer <= best || h(7) > 0.35 + 0.65 * m) return;
        const a = h(3) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a), L = cs * (0.75 + 0.45 * h(4)), W = L * 0.4, dx = x - cx, dy = y - cy;
        const s = (dx * ux + dy * uy) / (L / 2), w = (W / 2) * Math.max(0, 1 - s * s) ** 0.75, b = -dx * uy + dy * ux;
        if (Math.abs(s) >= 1 || Math.abs(b) >= w) return;
        const q = b / w;
        best = layer; tn = (h(5) - 0.5) * 2 * c.vary / 255;
        z = 0.006 * layer + 0.004 * (1 - q * q) * (1 - s * s) - 0.0012 * Math.exp(-(q * q) / 0.012) - 0.002 * Math.max(0, s);
      });
      gap[k] = best < 0 ? 1 : 0; tone[k] = tn; mass[k] = m;
      // (a mass bulges toward the light: its leaves stand on it)
      return (best < 0 ? -0.014 + 0.002 * sfbm(x, y, M, 0.08, 0.08, 2, seed + 3) : z) + 0.03 * m;
    }, (x, y, k, lit) => rampAt(body, 0.58 + (lit.value[k] - 1) * 1.3 + tone[k] + 0.04 * sfbm(x, y, M, 0.5, 0.5, 2, seed + 17)
      - 0.4 * lit.cavity[k] * (0.6 + 0.4 * g) - 0.35 * gap[k] - (0.12 + 0.2 * g) * (1 - mass[k])));
  },
  // a path's packed earth from above: fine crumbs, pebbles pressed into it (their crowns proud and worn), shallow hollows
  // where feet fall, a crack or two at grit
  path(c, size, seed) {
    const M = c.metres, g = c.grit, body = rampOf(c.stone), peb = new Float32Array(size * size);
    return paintedTile(c, size, TURF_LIGHT, (x, y, k) => {
      let z = -0.004 * Math.max(0, sfbm(x, y, M, 0.5, 0.35, 2, seed + 3)) + 0.0007 * sfbm(x, y, M, 0.012, 0.012, 2, seed + 5), p = 0;
      marksNear(x, y, M, 0.09, 1, seed + 11, (cx, cy, h, cs) => {
        if (h(3) > 0.12 + 0.2 * g) return;
        const d = stoneDist(x, y, cx, cy, cs * (0.08 + 0.14 * h(4)), h);
        if (d < 1) { const v = 0.003 * (0.5 + h(6)) * Math.min(1, (1 - d) * 3); if (v > p) p = v; }
      });
      const cr = g > 0.5 ? Math.max(0, 1 - Math.abs(sfbm(x, y, M, 0.3, 0.3, 2, seed + 7)) / 0.02) * smoothstep(0.1, 0.4, sfbm(x, y, M, 0.8, 0.8, 1, seed + 9)) : 0;
      peb[k] = p > 0 ? 1 : 0;
      return z + p - 0.002 * cr;
    }, (x, y, k, lit) => rampAt(body, 0.56 + (lit.value[k] - 1) * 1.2 + 0.05 * sfbm(x, y, M, 0.4, 0.4, 3, seed + 13) + 0.06 * peb[k] - 0.35 * lit.cavity[k] * (0.6 + 0.4 * g)));
  },
  // the VERGE, a path's edge laid across it (v from 0 at the path's side to 1 at the land's): earth, crumbs and pebbles
  // at the path, giving way to turf, the blades thickening outward and leaning over the earth they have not taken
  verge(c, size, seed) {
    const M = c.metres, g = c.grit, body = rampOf(c.stone), peb = new Float32Array(size * size);
    return paintedTile(c, size, TURF_LIGHT, (x, y, k) => {
      const t = y / M, take = smoothstep(0.08, 0.75, t + 0.25 * sfbm(x, y, M, 0.25, 0.5, 2, seed + 3));
      let z = 0, p = 0;
      marksNear(x, y, M, 0.035, 3, seed + 11, (cx, cy, h, cs) => {
        if (h(7) > take) return;
        const a = (0.5 + 0.35 * (h(3) - 0.5)) * Math.PI, ux = Math.cos(a), uy = Math.sin(a), L = cs * (1.6 + 1.2 * h(4)), wd = cs * 0.13, dx = x - cx, dy = y - cy;
        const q = clamp(dx * ux + dy * uy, -L / 2, L / 2), d = Math.hypot(dx - q * ux, dy - q * uy);
        if (d < wd) { const v = 0.005 * (0.55 + 0.45 * h(5)) * (1 - (2 * q / L) ** 2) * Math.sqrt(1 - d / wd); if (v > z) z = v; }
      });
      marksNear(x, y, M, 0.08, 1, seed + 21, (cx, cy, h, cs) => {
        if (h(3) > (1 - take) * (0.35 + 0.3 * g)) return;
        const d = stoneDist(x, y, cx, cy, cs * (0.08 + 0.14 * h(4)), h);
        if (d < 1) { const v = 0.003 * (0.5 + h(6)) * Math.min(1, (1 - d) * 3); if (v > p) p = v; }
      });
      peb[k] = p > 0 ? 1 : 0;
      return z * take + p + 0.0006 * sfbm(x, y, M, 0.012, 0.012, 2, seed + 5) * (1 - take) + 0.005 * sfbm(x, y, M, 0.25, 0.25, 3, seed + 9) * take;
    }, (x, y, k, lit) => rampAt(body, 0.56 + (lit.value[k] - 1) * 1.3 + 0.05 * sfbm(x, y, M, 0.45, 0.45, 3, seed + 17) + 0.06 * peb[k] - 0.35 * lit.cavity[k] * (0.6 + 0.4 * g)));
  },
  // a trunk's bark, u round it and v up it: plates between furrows that run up the trunk and fork, each plate a rounded
  // ridge, its face scaled fine (rougher with grit)
  bark(c, size, seed) {
    const M = c.metres, g = c.grit, body = rampOf(c.stone);
    return paintedTile(c, size, SHAFT_LIGHT, (x, y, k) => {
      // (each plate a rounded ridge rising out of the furrows either side of it)
      const r = smoothstep(0.03, 0.42, Math.abs(sfbm(x, y, M, 0.04, 0.3, 3, seed + 3)));
      return 0.012 * Math.sqrt(r) + (0.0015 + 0.0015 * g) * sfbm(x, y, M, 0.02, 0.05, 3, seed + 9) * r;
    }, (x, y, k, lit) => rampAt(body, 0.56 + (lit.value[k] - 1) * 1.25 + 0.05 * sfbm(x, y, M, 0.2, 0.6, 2, seed + 11) - 0.4 * lit.cavity[k] * (0.6 + 0.4 * g)));
  },
};
