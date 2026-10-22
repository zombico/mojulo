/**
 * ISEKAI TILES — the pixel-locked surfaces of an isekai stage, registered as the `isekai:` resolver. A key is
 * `isekai:<style id>:<tile>-<band>`, `band` one of `lit` / `shade`; the tile is painted in LEVELS (0 = the window's
 * darkest stop) and every texel then takes its stop's colour, so a tile holds nothing but its ramp's stops — the pixel
 * lock (the style card's `tiles[tile]` names the ramp and each band's window of stops). Seamless both ways, 256 px.
 *
 *   cliff    strata: horizontal bands with wavering edges, each band lit along its top (the bench catching the sun)
 *            and dark along its foot (under the ledge), vertical joints in the darkest level
 *   rock     a boulder's side: broad blotches in two levels, a lit chip here and there, a few dark cracks
 *   hat      a grass cap seen from above: patches in three levels, short blade ticks lit and dark
 *   fringe   (RGBA) a ragged grass edge hanging from the top row: a solid band, then blades of many lengths
 *   blades   (RGBA) a tuft of broad blades from one crown, the tips the lightest level
 *   culm     a bamboo pole unrolled: u round it, v up one internode — vertical stripes, and the node at the foot of the
 *            tile: a dark line under a pale ring
 *   spray    (RGBA) a bamboo leaf spray: a twig from the foot of the card, lance leaves fanned from it and drooping,
 *            each lit along its upper edge
 *   petals   (RGBA) fallen sakura petals seen from above: notched petals, the base a step deeper and one edge curled into
 *            shade, heaped in drifts and strewn between them, and a few whole five-petal flowers
 *   bark     a sakura limb unrolled (u round it, v along it): plum-grey, with the horizontal LENTICEL bands of cherry
 *            bark — a pale dash over a dark line — and a few dark girdle cracks
 *   bloom    a blossom clump's skin: five-petal flowers packed edge to edge, each petal notched, the gaps between
 *            them a level down and the centres the darkest
 *   sprig    (RGBA) a cluster of flowers with a ragged edge: the cards that break a clump's
 *            silhouette into flowers
 *   rim      (RGBA) a trail's rim bleeding into the ground beside it (image y = SIZE − 1 is the trail's edge): the soil
 *            past the edge, up to one wandering boundary, frayed across it in a stipple (whole texel blocks against
 *            random thresholds), a little lit grit
 *   creep    (RGBA) the ground creeping back over a trail (image y = SIZE − 1 is the edge): the grass short of the same
 *            boundary — the rim's and the creep's noise is one field (edgeField) — and a few blades out over the soil
 *   dirt     (the realistic pole's ground, drawn under baked light) bare ground up close: two patch levels, grit, and
 *            clods, each lit on its sun side with a dark outline round its shadow side
 *   scree    the same, stonier: more and bigger clods
 *   packed   the same, trodden: a few small clods, mostly grit (a trail)
 *            (dirt, scree and packed come in VARIANTS that join: `<tile>-lit~<v>`, see `ground`)
 *   stone    the same, blocky: the realistic pole's masonry and rock
 *   plaster  the same, smooth: mostly patches, a little grit
 *   grain    boards, bark, thatch: runs along the grain, a knot or two
 *   leaf     foliage: small lumps lit up-left over the dark of the gaps
 *   fines, gravel, dust, crust, trodden   (RGBA) the realistic pole's PATCHES: a material (plaster, scree, plaster,
 *            leaf, packed) whose alpha is a block noise from ½ to 1, drawn alpha-tested against a weight by cause
 *   metal    a pressed sheet: faint patches, short scuffs, a few pits
 *   canopy   (bands b0…b3) a crown's skin: the look's LEAF DIE stamped, figure and ground swapping as the light falls
 *   leafcard (RGBA, bands) dies stood out from a crown to break its silhouette into leaf shapes
 *   rockface a rock face, realistic: a fine mottle, thin fractures lit along their upper edge, speckle
 *   strata   the same with thin bedding planes and short joints: the material pole's cliff
 *   cumulus  (RGBA) a heaped cloud on a flat base: puffs along the base, cauliflower heads on top, each lit from
 *            above in three levels with the darkest along the base
 *
 * HI-DEF (a key's `+hd` suffix: a gritty land's clouds, era/isekai.js): the same drawing in the same stops without the
 * pixel lock: its levels smoothed and painted at twice the size, each texel between its two nearest stops, a cutout's edge
 * smoothed the same way and kept whole.
 *
 * `isekaiTexture(key)` → data:image/png; `isekaiTexels(key)` → { W, H, rgb, a? } (the test reads every texel).
 * Deterministic: mulberry32 dice seeded from the key, memoized per process.
 */
import { lookOf } from './style/looks.js';
import { encodePng, encodePngRgba, registerTextureResolver } from '../landscape/surface-textures.js';
import { mulberry32 } from '../vegetation/grow.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { ISEKAI_BAMBOO } from './style/isekai-bamboo.js';
import { ISEKAI_SAKURA } from './style/isekai-sakura.js';
import { ALIEN_NIGHT } from './style/alien-night.js';
import { AIRLESS_PLAIN } from './style/airless-plain.js';
import { ISEKAI_GARDEN } from './style/isekai-garden.js';

export const ISEKAI_STYLES = Object.freeze({ 'isekai-meadow': ISEKAI_MEADOW, 'isekai-bamboo': ISEKAI_BAMBOO, 'isekai-sakura': ISEKAI_SAKURA, 'alien-night': ALIEN_NIGHT, 'airless-plain': AIRLESS_PLAIN, 'isekai-garden': ISEKAI_GARDEN });
const SIZE = 256;
const GROUNDS = new Set(['dirt', 'scree', 'packed', 'stone', 'plaster']);
// the realistic pole's PATCHES: a material whose alpha is a block noise (½…1), drawn alpha-tested against its weight
const PATCHES = new Set(['fines', 'gravel', 'dust', 'crust', 'trodden']);
const CUTOUT = new Set(['leafcard', 'fringe', 'blades', 'cumulus', 'spray', 'petals', 'sprig', 'rim', 'creep']);
// A STIPPLE: a cutout's TRANSPARENCY as whole texel blocks kept or dropped against a random threshold each (seamless:
// the block grid divides the tile), so the colours stay the ramp's stops however thin the cover. Random, not ordered:
// an ordered dither reads as a printed pattern.
const STIPPLE = 4;
function stipple(R) {
  const n = SIZE / STIPPLE, th = Array.from({ length: n * n }, () => R());
  return (x, y) => th[(Math.floor(y / STIPPLE) % n) * n + (Math.floor(x / STIPPLE) % n)];
}
const wrap = (v) => ((v % SIZE) + SIZE) % SIZE;
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// a smooth seamless value noise at `cells` per side
function noise(R, cells) {
  const g = Array.from({ length: cells * cells }, () => R());
  return (x, y) => {
    const u = (x / SIZE) * cells, v = (y / SIZE) * cells, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const at = (a, b) => g[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
    const s = (t) => t * t * (3 - 2 * t);
    return (at(i, j) * (1 - s(fu)) + at(i + 1, j) * s(fu)) * (1 - s(fv)) + (at(i, j + 1) * (1 - s(fu)) + at(i + 1, j + 1) * s(fu)) * s(fv);
  };
}

// A SAKURA PETAL into `lv` (and `a`): obovate from its base at (cx, cy) along `ang`, `len` px, the notch at its tip,
// the base a level below `l`, the edge on side `curl` a level below too (rolled into shade); wraps when `a` is null.
function petalShape(lv, a, cx, cy, ang, len, l, curl) {
  const ca = Math.cos(ang), sa = Math.sin(ang), W = len * 0.36;
  for (let s = 0; s <= len; s++) {
    const f = s / len, half = W * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + f * 0.82)), 0.6), notch = f > 0.84 ? ((f - 0.84) / 0.16) * half * 0.55 : -1;
    for (let q = -Math.ceil(half); q <= Math.ceil(half); q++) {
      if (Math.abs(q) > half || Math.abs(q) < notch) continue;
      let X = Math.round(cx + ca * s - sa * q), Y = Math.round(cy + sa * s + ca * q);
      if (!a) { X = wrap(X); Y = wrap(Y); } else if (X < 0 || X >= SIZE || Y < 0 || Y >= SIZE) continue;
      if (a) a[Y * SIZE + X] = 1;
      lv[Y * SIZE + X] = f < 0.22 || q * curl > half * 0.6 ? Math.max(0, l - 1) : l;
    }
  }
}
// a five-petal FLOWER: petals from its centre, the centre a dot of the darkest level
function flower(lv, a, cx, cy, r, a0, l, wrapIt) {
  for (let p = 0; p < 5; p++) petalShape(lv, wrapIt ? null : a, cx, cy, a0 + (p * 2 * Math.PI) / 5, r, l, p % 2 ? 1 : -1);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    let X = Math.round(cx) + dx, Y = Math.round(cy) + dy;
    if (wrapIt || !a) { X = wrap(X); Y = wrap(Y); } else if (X < 0 || X >= SIZE || Y < 0 || Y >= SIZE) continue;
    if (a) a[Y * SIZE + X] = 1; lv[Y * SIZE + X] = 0;
  }
}

// THE EDGE FIELD of a style's trail blend, shared by the rim and the creep: across the edge, s runs from −1 (the far
// side of the creep, toward the trail's middle) through 0 (the edge) to 1 (the far side of the rim, out in the grass).
// The boundary between soil and grass is one line, b(x), wandering both ways about the edge; across a narrow fray of it
// the soil gives out in a stipple. soil(x, s): is the texel soil? Same dice for both tiles, so their noise is one.
const EDGES = new Map();
function edgeField(id) {
  if (EDGES.has(id)) return EDGES.get(id);
  const R = mulberry32(seedOf(`isekai:${id}:edge`)), n1 = noise(R, 5), n2 = noise(R, 13), n3 = noise(R, 9), st = stipple(R), FRAY = 0.22;
  const at = (x) => (0.7 * n1(x, 0) + 0.3 * n2(x, 41) - 0.5) * 2.6;
  const soil = (x, s) => {
    const y = wrap(Math.round(SIZE - s * SIZE * 0.5)), d = s - at(x) - (n3(x, y) - 0.5) * 0.5;
    return 0.5 - d / FRAY > st(x, y);
  };
  const E = { at, soil }; EDGES.set(id, E); return E;
}

// each painter fills `lv` (a level per texel, 0..n-1) and, for a cutout, `a` (0 / 1)
// GROUND SEEN UP CLOSE (the realistic pole's material, drawn under baked light): texel blocks of DIRT_PX, a base in two
// patch levels, grit, and CLODS — each a lumpy disc in the base, lit along its sun side (up-left), an OUTLINE in the
// darkest level round its shadow side and a level up round the rest. `stones` scales how many and how big.
//
// VARIANTS THAT JOIN (edge-matched, as Wang tiles): a ground tile's variant `v` (0…15, `~v` on its key) names the TYPE
// (0 or 1) of each of its edges — bit 0 left, 1 right, 2 bottom, 3 top. An edge of a type is painted once, as a STRIP
// across the seam (from the dice of its side and type): it owns a thin band either side of the seam, and the clods
// centred near the seam, whole on both sides; each tile takes its half. The tile's own field (the variant's dice) is
// everything else, its clods stopping a block short of its edges, so clods lie as thick by a seam as anywhere: no
// rows. Two tiles whose touching edges are of one type meet without a seam, and the ground chooses each edge's type by
// its own dice. Variant 0 joins itself both ways: the tile on its own, wrapped.
const DIRT_PX = 4, DIRT_C = SIZE / DIRT_PX, SEAM_OWN = 2, SEAM_CLOD = 4, SEAM_HALF = 16;
const lumpy = ({ cx, cy, r, sq, wob }) => (x, y) => { const dx = x - cx, dy = (y - cy) / sq, a = Math.atan2(dy, dx); return Math.hypot(dx, dy) <= r * (1 + 0.18 * Math.sin(2 * a + wob[0]) + 0.12 * Math.sin(3 * a + wob[1])); };
const clod = (D, w, h, stones) => { const c = { cx: D() * w, cy: D() * h, r: 0.8 + D() * D() * (1.4 + 1.8 * stones), sq: 0.75 + D() * 0.5, wob: [D(), D()].map((v) => v * Math.PI * 2) }; c.R0 = Math.ceil(c.r * 1.5) + 2; return c; };
/** A patch of ground w × h blocks, levels round `base`: patches, grain, grit, clods (those `keep` passes). → { out, clod }
 *  (`clod` marks the blocks a clod drew). */
function dirtField(D, w, h, L, stones, keep = () => true) {
  const { top, base, low } = L, out = new Uint8Array(w * h), mark = new Uint8Array(w * h), patch = noise(D, 5), fine = noise(D, 16);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = patch(x * DIRT_PX, y * DIRT_PX) * 0.7 + fine(x * DIRT_PX, y * DIRT_PX) * 0.3, g = D();
    out[y * w + x] = g < 0.04 ? Math.max(0, low - 1) : g > 0.97 ? top : p < 0.36 ? low : base;
  }
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) { out[y * w + x] = v; mark[y * w + x] = 1; } }, get = (x, y) => out[y * w + x];
  // grit: single lit texel blocks, each with its shadow a block down and right; one in four catches the light whole
  for (let k = 0, n = Math.round((100 * stones * w * h) / (DIRT_C * DIRT_C)); k < n; k++) { const x = Math.floor(D() * w), y = Math.floor(D() * h), hi = D() < 0.25 ? top : Math.min(top, base + 1); if (keep({ cx: x + 1, cy: y + 1, R0: 1.5 })) { set(x, y, hi); set(x + 1, y + 1, low); } }
  for (let k = 0, n = Math.round((26 * stones * w * h) / (DIRT_C * DIRT_C)); k < n; k++) {
    const c = clod(D, w, h, stones); if (!keep(c)) continue;
    const inside = lumpy(c);
    for (let y = Math.floor(c.cy - c.R0); y <= c.cy + c.R0; y++) for (let x = Math.floor(c.cx - c.R0); x <= c.cx + c.R0; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const X = x + 0.5, Y = y + 0.5;
      // lit where the disc's edge faces the sun (a step up and left is outside it); the outline round its shadow side
      if (inside(X, Y)) set(x, y, !inside(X - 1, Y - 1) ? Math.min(top, base + 1) : (!inside(X + 1, Y + 1) ? low : base));
      else if (inside(X - 1, Y - 1) || inside(X - 1, Y) || inside(X, Y - 1)) set(x, y, 0);
      else if (inside(X + 1, Y + 1) || inside(X + 1, Y) || inside(X, Y + 1)) set(x, y, Math.min(get(x, y), Math.min(1, top)));
    }
  }
  return { out, clod: mark };
}
function ground(lv, n, R, stones, K) {
  // the levels round the window's middle: the base, a patch a level down, the lit chip a level up, grit at the top
  // and the outline at the bottom
  const C = DIRT_C, B = SEAM_HALF, top = n - 1, base = Math.floor(top / 2), L = { top, base, low: Math.max(0, base - 1) }, v = K.variant ?? 0;
  const own = dirtField(K.Rv, C, C, L, stones, (c) => Math.min(c.cx, C - c.cx, c.cy, C - c.cy) - c.R0 >= 1), cells = own.out;
  // a strip along an edge: C along × 2B across, the seam between across B − 1 and B; its clods centred within
  // SEAM_CLOD of the seam, wholly inside it and off its ends (the corners are no strip's)
  const strip = (side, type) => dirtField(mulberry32(seedOf(`${K.tileKey}|${side}${type}`)), C, 2 * B, L, stones, (c) => Math.abs(c.cy - B) <= SEAM_CLOD && Math.abs(c.cy - B) + c.R0 <= B && c.cx - c.R0 >= SEAM_OWN + 1 && c.cx + c.R0 <= C - SEAM_OWN - 1);
  const V = [strip('v', v & 1), strip('v', (v >> 1) & 1)], H = [strip('h', (v >> 2) & 1), strip('h', (v >> 3) & 1)];
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    const i = y * C + x, dl = x, dr = C - 1 - x, db = C - 1 - y, dt = y;
    // a strip's across runs as the image's x (a vertical seam: the strip transposed) or its y (a horizontal one), so a
    // clod's lit side stays up and left: past a left or a top seam this tile reads across B + d, before a right or a
    // bottom one B − 1 − d. Image y = C − 1 is the bottom edge (uv v = 0, the block's low y)
    const reads = [[V[0], (B + dl) * C + y, dl], [V[1], (B - 1 - dr) * C + y, dr], [H[1], (B + dt) * C + x, dt], [H[0], (B - 1 - db) * C + x, db]].filter(([, j]) => j >= 0 && j < 2 * B * C);
    const near = reads.filter(([, , d]) => d < SEAM_OWN);
    if (near.length > 1) { cells[i] = L.base; continue; }   // a corner: plain, the same for all four tiles
    if (near.length) { cells[i] = near[0][0].out[near[0][1]]; continue; }
    const hit = reads.find(([S, j]) => S.clod[j]);   // a seam's clod reaching in, whole on both sides
    if (hit) cells[i] = hit[0].out[hit[1]];
  }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) lv[y * SIZE + x] = cells[Math.floor(y / DIRT_PX) * C + Math.floor(x / DIRT_PX)];
}

// THE OTHER MATERIALS of the realistic pole, block-level like the ground's (levels round the window's middle, the
// light's work left to the light): GRAIN (boards, bark, thatch: dark runs along the grain, a lit run here and there,
// a knot), LEAF (foliage: small lumps lit up-left over a dark of gaps, a few holes darkest). Seamless both ways.
function blocks(lv, C, cells) { for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) lv[y * SIZE + x] = cells[Math.floor(y / DIRT_PX) * C + Math.floor(x / DIRT_PX)]; }
function grain(lv, n, R) {
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), low = Math.max(0, base - 1), cells = new Uint8Array(C * C).fill(base);
  const at = (x, y) => (((y % C) + C) % C) * C + (((x % C) + C) % C), band = noise(R, 3);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (band(0, y * DIRT_PX) < 0.35) cells[at(x, y)] = low;   // boards and bands
  for (let k = 0; k < 120; k++) { const y = Math.floor(R() * C), x0 = Math.floor(R() * C), len = 4 + Math.floor(R() * 18), lit = R() < 0.22; for (let i = 0; i < len; i++) cells[at(x0 + i, y)] = lit ? Math.min(top, base + 1) : R() < 0.15 ? 0 : low; }
  for (let k = 0; k < 4; k++) {   // knots: a dark eye, a ring a level down round it, lit along its top
    const cx = R() * C, cy = R() * C, rx = 1.5 + R() * 2, ry = 0.8 + R() * 0.8;
    for (let y = Math.floor(cy - ry * 2.5); y <= cy + ry * 2.5; y++) for (let x = Math.floor(cx - rx * 2.5); x <= cx + rx * 2.5; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d < 1) cells[at(x, y)] = 0; else if (d < 1.8) cells[at(x, y)] = y < cy ? Math.min(top, base + 1) : low;
    }
  }
  blocks(lv, C, cells);
}
// ROCK, REALISTIC (the material pole's rock face and cliff; the banded `rock` and `cliff` draw blotches and paint the
// light in, these leave the light to the light): a MOTTLE (two octaves of noise, a block's dice, three levels round the
// base), FRACTURES (thin wandering dark lines, the block above each lit: an edge catching the sun) and a speckle.
// STRATA adds thin bedding planes (a dark line, wavering, beds a level apart in tendency) and short vertical joints.
function mottle(C, R, L, broad = 0.55) {
  const big = noise(R, 4), fine = noise(R, 16), cells = new Uint8Array(C * C);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    const v = big(x * DIRT_PX, y * DIRT_PX) * broad + fine(x * DIRT_PX, y * DIRT_PX) * (0.85 - broad) + R() * 0.15;
    cells[y * C + x] = v < 0.34 ? L.low : v > 0.7 ? Math.min(L.top, L.base + 1) : L.base;
  }
  return cells;
}
function fractures(cells, C, R, L, count, len) {
  const at = (x, y) => (((Math.round(y) % C) + C) % C) * C + (((Math.round(x) % C) + C) % C);
  for (let k = 0; k < count; k++) {
    let x = R() * C, y = R() * C, a = R() * 6.28; const l = len * (0.5 + R());
    for (let t = 0; t < l; t++) { a += (R() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a); cells[at(x, y)] = 0; if (R() < 0.6) cells[at(x, y - 1)] = Math.min(L.top, L.base + 1); }
  }
}
function rockface(lv, n, R) {
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), L = { top, base, low: Math.max(0, base - 1) }, cells = mottle(C, R, L);
  fractures(cells, C, R, L, 10, 9);
  for (let k = 0; k < 90; k++) { const i = Math.floor(R() * C * C); cells[i] = R() < 0.5 ? top : L.low; }
  blocks(lv, C, cells);
}
function strata(lv, n, R) {
  // (the mottle mostly fine, so no blotch reads as a stone set in a wall; beds of uneven thickness, a plane broken
  // here and there; few joints, so beds and joints never close into bricks)
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), L = { top, base, low: Math.max(0, base - 1) }, cells = mottle(C, R, L, 0.25), wav = noise(R, 3), gap = noise(R, 6);
  const beds = []; let y = 0; while (y < C) { beds.push(y); y += 4 + Math.floor(R() * R() * 16); } beds.push(C);
  if (C - beds[beds.length - 2] < 4) beds.splice(beds.length - 2, 1);
  for (let x = 0; x < C; x++) {
    const off = Math.round((wav(x * DIRT_PX, 0) - 0.5) * 4);
    for (let yy = 0; yy < C; yy++) {
      const Y = (((yy - off) % C) + C) % C; let b = 0; while (Y >= beds[b + 1]) b++;
      if (Y === beds[b] && gap(x * DIRT_PX, b * 37) > 0.32) cells[yy * C + x] = 0;   // the bedding plane, broken here and there
      else if (b % 2 && cells[yy * C + x] === L.base && R() < 0.35) cells[yy * C + x] = L.low;   // a bed a little darker
    }
  }
  for (let k = 0; k < 5; k++) { const x = Math.floor(R() * C), b = Math.floor(R() * (beds.length - 1)); for (let yy = beds[b] + 1; yy < beds[b + 1] - Math.floor(R() * 3); yy++) cells[(((yy + Math.round((wav(x * DIRT_PX, 0) - 0.5) * 4)) % C + C) % C) * C + x] = 0; }
  fractures(cells, C, R, L, 7, 8);
  blocks(lv, C, cells);
}
// LEAF DIES (the material pole's foliage): a leaf's shape as a stamp in blocks, `len` blocks long, turned by `a`. A
// crown's skin is the die stamped by its band of light — figure and ground swap as the light falls (the illustrators'
// way): lit, a light ground with a few DARK dies; then denser; then the ground goes dark and the dies light; in the
// deepest shade a few LIGHT dies on the dark. The die is the look's (`trees.die`), so the skin follows from it.
export const LEAF_DIES = Object.freeze({
  oval: (u, v) => (u * u) / 1 + (v * v) / 0.3 <= 1 && !(u > 0.85 && Math.abs(v) > 0.12),
  lance: (u, v) => Math.abs(v) <= 0.26 * Math.sin(Math.PI * Math.max(0, Math.min(1, (u + 1) / 2))),
  cleft: (u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); return r <= 1 && r >= 0.5 && Math.abs(a) >= 0.9; },   // a C: a ring open on one side
  lobed: (u, v) => { const r = Math.hypot(u, v * 1.3), a = Math.atan2(v, u); return r <= 0.78 + 0.22 * Math.cos(3 * a); },
  needle: (u, v) => [-0.45, 0, 0.45].some((t) => Math.abs(v - u * t) <= 0.09 && u > -0.95),   // three needles fanned
});
export const LEAF_DIE_IDS = Object.freeze(Object.keys(LEAF_DIES));
function stampDie(cells, C, die, cx, cy, len, a, level, wrapIt = true, mask = null) {
  const f = LEAF_DIES[die], h = len / 2, ca = Math.cos(a), sa = Math.sin(a), R0 = Math.ceil(h) + 1;
  for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) {
    const u = (dx * ca + dy * sa) / h, v = (-dx * sa + dy * ca) / h; if (!f(u, v)) continue;
    let x = Math.round(cx + dx), y = Math.round(cy + dy);
    if (wrapIt) { x = ((x % C) + C) % C; y = ((y % C) + C) % C; } else if (x < 0 || y < 0 || x >= C || y >= C) continue;
    cells[y * C + x] = level; if (mask) mask[y * C + x] = 1;
  }
}
const BANDS = [{ ground: 'hi', dies: 'lo', cover: 0.16 }, { ground: 'hi', dies: 'lo', cover: 0.42 }, { ground: 'lo', dies: 'hi', cover: 0.42 }, { ground: 'lo', dies: 'hi', cover: 0.16 }];
function canopy(lv, n, R, K) {
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), B = BANDS[K.bandIndex ?? 1], die = K.die ?? 'oval';
  const hi = Math.min(top, base + 1), lo = Math.max(0, base - 1), g = B.ground === 'hi' ? hi : lo, d = B.dies === 'hi' ? (B.cover < 0.3 ? base : hi) : (B.cover < 0.3 ? base : lo);
  const cells = new Uint8Array(C * C).fill(g), len = die === 'needle' ? 9 : 7, per = (len * len * 0.45) / (C * C);
  for (let k = 0, N = Math.round(B.cover / per); k < N; k++) stampDie(cells, C, die, R() * C, R() * C, len * (0.8 + 0.4 * R()), R() * Math.PI * 2, d);
  // a speck of the far value here and there: the band's ground is never one flat stop
  for (let k = 0; k < 40; k++) cells[Math.floor(R() * C * C)] = B.ground === 'hi' ? base : Math.max(0, lo - 1);
  blocks(lv, C, cells);
}
// a LEAF CARD (RGBA): dies stood out from a crown's skin to break its silhouette — dense at the card's foot (image y =
// SIZE − 1, on the crown), thinning to a ragged tip; only the dies are opaque, so the edge is leaf shapes
function leafcard(lv, n, R, a, K) {
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), B = BANDS[K.bandIndex ?? 1], die = K.die ?? 'oval';
  const hi = Math.min(top, base + 1), lo = Math.max(0, base - 1), cells = new Uint8Array(C * C), mask = new Uint8Array(C * C), len = die === 'needle' ? 12 : 10;
  for (let k = 0; k < 140; k++) {
    const y = C - 1 - Math.pow(R(), 1.6) * (C - 4), w = (C / 2 - 3) * (0.35 + 0.65 * (y / C)), x = C / 2 + (R() * 2 - 1) * w;
    const up = -Math.PI / 2 + (x - C / 2) / C * 1.4 + (R() - 0.5) * 0.9, lit = R() < (B.ground === 'hi' ? 0.7 : 0.3);
    stampDie(cells, C, die, x, y, len * (0.75 + 0.5 * R()), up, lit ? hi : lo, false, mask);
  }
  blocks(lv, C, cells);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) a[y * SIZE + x] = mask[Math.floor(y / DIRT_PX) * C + Math.floor(x / DIRT_PX)];
}
// METAL: a pressed sheet — the base, faint patches, short scuffs along it (lit or dark), a few dark pits
function metal(lv, n, R) {
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), low = Math.max(0, base - 1), cells = new Uint8Array(C * C).fill(base);
  const at = (x, y) => (((y % C) + C) % C) * C + (((x % C) + C) % C), patch = noise(R, 9);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (patch(x * DIRT_PX, y * DIRT_PX) < 0.2 && R() < 0.7) cells[at(x, y)] = low;
  for (let k = 0; k < 70; k++) { const x0 = Math.floor(R() * C), y0 = Math.floor(R() * C), len = 2 + Math.floor(R() * 7), v = R() < 0.5 ? Math.min(top, base + 1) : low; for (let i = 0; i < len; i++) cells[at(x0 + i, y0 + (R() < 0.2 ? 1 : 0))] = v; }
  for (let k = 0; k < 24; k++) { const x = Math.floor(R() * C), y = Math.floor(R() * C); cells[at(x, y)] = 0; cells[at(x - 1, y - 1)] = Math.min(top, base + 1); }
  blocks(lv, C, cells);
}
function leaf(lv, n, R) {
  const C = DIRT_C, top = n - 1, base = Math.floor(top / 2), low = Math.max(0, base - 1), cells = new Uint8Array(C * C).fill(low);
  const at = (x, y) => (((y % C) + C) % C) * C + (((x % C) + C) % C);
  for (let k = 0; k < 520; k++) {
    const c = { cx: R() * C, cy: R() * C, r: 1.1 + R() * 1.6, sq: 0.7 + R() * 0.5, wob: [R(), R()].map((v) => v * Math.PI * 2) }, inside = lumpy(c), R0 = Math.ceil(c.r * 1.4) + 1;
    for (let y = Math.floor(c.cy - R0); y <= c.cy + R0; y++) for (let x = Math.floor(c.cx - R0); x <= c.cx + R0; x++) {
      const X = x + 0.5, Y = y + 0.5; if (!inside(X, Y)) continue;
      cells[at(x, y)] = !inside(X - 1, Y - 1) ? (R() < 0.1 ? top : Math.min(top, base + 1)) : !inside(X + 1, Y + 1) ? low : base;
    }
  }
  for (let k = 0; k < 60; k++) cells[at(Math.floor(R() * C), Math.floor(R() * C))] = 0;   // holes through the mass
  blocks(lv, C, cells);
}

// a patch's alpha: a block noise from just over ½ to 1, so tex.a × weight passes ½ first on its highest blocks and
// everywhere at full weight — the patch's edge a ragged pixel edge that grows with the weight
function patchAlpha(a, R) {
  const C = DIRT_C, n = noise(R, 8), jit = Array.from({ length: C * C }, () => R());
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const bx = Math.floor(x / DIRT_PX), by = Math.floor(y / DIRT_PX), v = n(bx * DIRT_PX, by * DIRT_PX) * 0.65 + jit[by * C + bx] * 0.35; a[y * SIZE + x] = Math.round(255 * (0.52 + 0.48 * v)); }
}
const PAINTERS = {
  fines(lv, n, R, a, K) { ground(lv, n, R, 0.08, K); patchAlpha(a, R); },
  gravel(lv, n, R, a, K) { ground(lv, n, R, 2.6, K); patchAlpha(a, R); },
  dust(lv, n, R, a, K) { ground(lv, n, R, 0.05, K); patchAlpha(a, R); },
  crust(lv, n, R, a) { leaf(lv, n, R); patchAlpha(a, R); },
  trodden(lv, n, R, a, K) { ground(lv, n, R, 0.3, K); patchAlpha(a, R); },
  dirt(lv, n, R, a, K) { ground(lv, n, R, 1, K); },
  scree(lv, n, R, a, K) { ground(lv, n, R, 2.2, K); },
  packed(lv, n, R, a, K) { ground(lv, n, R, 0.3, K); },
  stone(lv, n, R, a, K) { ground(lv, n, R, 1.6, K); },
  plaster(lv, n, R, a, K) { ground(lv, n, R, 0.12, K); },
  grain(lv, n, R) { grain(lv, n, R); },
  leaf(lv, n, R) { leaf(lv, n, R); },
  metal(lv, n, R) { metal(lv, n, R); },
  rockface(lv, n, R) { rockface(lv, n, R); },
  strata(lv, n, R) { strata(lv, n, R); },
  canopy(lv, n, R, a, K) { canopy(lv, n, R, K); },
  leafcard(lv, n, R, a, K) { leafcard(lv, n, R, a, K); },
  cliff(lv, n, R) {
    const top = n - 1, wav = noise(R, 4), wav2 = noise(R, 9), blot = noise(R, 5);
    // band boundaries down the tile (seamless: they divide SIZE), each wavering along x
    const edges = []; let y = 0; while (y < SIZE) { edges.push(y); y += 40 + Math.floor(R() * 34); } edges.push(SIZE);
    if (SIZE - edges[edges.length - 2] < 24) edges.splice(edges.length - 2, 1);
    const base = edges.slice(0, -1).map((_, i) => (i % 2 ? Math.max(0, top - 2) : Math.max(0, top - 1)));
    for (let x = 0; x < SIZE; x++) {
      const off = Math.round((wav(x, 0) - 0.5) * 14 + (wav2(x, 7) - 0.5) * 5);
      for (let yy = 0; yy < SIZE; yy++) {
        const Y = wrap(yy - off); let b = 0; while (Y >= edges[b + 1]) b++;
        const into = Y - edges[b], left = edges[b + 1] - Y;
        let l = base[b];
        if (blot(x, yy) > 0.66) l = Math.min(top, l + 1);
        if (into < 5 + Math.round(wav2(x, b * 31) * 4)) l = top;            // the bench's lit top
        else if (left < 4) l = 0;                                            // the shadow under the ledge
        lv[yy * SIZE + x] = l;
      }
    }
    // joints: wavering vertical cracks through one band each
    for (let k = 0; k < 14; k++) {
      let x = R() * SIZE; const b = Math.floor(R() * (edges.length - 1)), y0 = edges[b] + 5, y1 = edges[b + 1] - 3;
      for (let yy = y0; yy < y1; yy++) { x += (R() - 0.5) * 1.4; for (const dx of [0, 1]) { const X = wrap(Math.round(x) + dx); const off = Math.round((wav(X, 0) - 0.5) * 14 + (wav2(X, 7) - 0.5) * 5); lv[wrap(yy + off) * SIZE + X] = 0; } }
    }
  },
  rock(lv, n, R) {
    const top = n - 1, big = noise(R, 3), mid = noise(R, 7);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = 0.7 * big(x, y) + 0.3 * mid(x, y);
      lv[y * SIZE + x] = v > 0.55 ? top : Math.max(0, top - 1);   // two broad levels; the darkest only in the cracks
    }
    for (let k = 0; k < 9; k++) {   // cracks: short wandering dark strokes
      let x = R() * SIZE, y = R() * SIZE, a = R() * 6.28; const len = 18 + R() * 40;
      for (let t = 0; t < len; t++) { a += (R() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a); lv[wrap(Math.round(y)) * SIZE + wrap(Math.round(x))] = 0; lv[wrap(Math.round(y) + 1) * SIZE + wrap(Math.round(x))] = top; }
    }
  },
  hat(lv, n, R) {
    const top = n - 1, big = noise(R, 4), mid = noise(R, 11);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = 0.6 * big(x, y) + 0.4 * mid(x, y);
      lv[y * SIZE + x] = v > 0.62 ? top : v > 0.38 ? Math.max(0, top - 1) : Math.max(0, top - 2);
    }
    for (let k = 0; k < 900; k++) {   // blade ticks: a short stroke, lit or dark
      const x = R() * SIZE, y = R() * SIZE, a = -Math.PI / 2 + (R() - 0.5) * 1.2, len = 3 + R() * 6, l = R() < 0.55 ? top : 0;
      for (let t = 0; t < len; t++) lv[wrap(Math.round(y + Math.sin(a) * t)) * SIZE + wrap(Math.round(x + Math.cos(a) * t))] = l;
    }
  },
  // the fringe hangs from the top row (image y = 0 is the edge it hangs from)
  fringe(lv, n, R, a) {
    const top = n - 1, band = noise(R, 6);
    a.fill(0);
    for (let x = 0; x < SIZE; x++) {
      const h = 34 + Math.round(band(x, 0) * 26);
      for (let y = 0; y < h; y++) { a[y * SIZE + x] = 1; lv[y * SIZE + x] = y < 6 ? top : y > h - 7 ? 0 : Math.max(0, top - 1); }
    }
    for (let k = 0; k < 120; k++) {   // blades hanging from under the band, narrowing to a point, tips lit
      const x0 = R() * SIZE, w = 3 + R() * 6, y0 = 30 + R() * 20, len = 30 + R() * (SIZE * 0.55), bend = (R() - 0.5) * 20;
      for (let y = 0; y < len; y++) {
        const f = y / len, half = (w / 2) * (1 - f), cx = x0 + bend * f * f;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          const Y = Math.round(y0 + y); if (Y >= SIZE) continue;
          const X = wrap(x); a[Y * SIZE + X] = 1; lv[Y * SIZE + X] = f > 0.8 ? top : f < 0.3 ? 0 : Math.max(0, top - 2 + (x > cx ? 1 : 0));
        }
      }
    }
  },
  // a heaped cumulus (image y = 0 is the top): puffs whose union is the cloud, the base cut flat
  cumulus(lv, n, R, a) {
    const top = n - 1, base = SIZE * 0.9, puffs = [];
    const m = 4 + Math.floor(R() * 3);
    for (let i = 0; i < m; i++) {   // the body: along the base, biggest in the middle, heaped up
      const f = (i + 0.5) / m, r = SIZE * (0.1 + 0.14 * Math.sin(Math.PI * f)) * (0.85 + 0.3 * R());
      puffs.push([SIZE * (0.14 + 0.72 * f), base - r * 0.6, r]);
    }
    const tower = [SIZE * (0.4 + 0.2 * R()), base - SIZE * 0.42, SIZE * (0.17 + 0.05 * R())];   // the heap's crown
    puffs.push(tower);
    for (let i = 0; i < 12; i++) {   // the heads: cauliflower on the upper rim of body and crown
      const b = i < 5 ? tower : puffs[1 + Math.floor(R() * (m - 2))], ang = -Math.PI / 2 + (R() - 0.5) * 2.2, r = b[2] * (0.38 + 0.25 * R());
      puffs.push([b[0] + Math.cos(ang) * b[2] * 0.78, b[1] + Math.sin(ang) * b[2] * 0.78, r]);
    }
    a.fill(0);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (y > base) continue;
      let own = null, best = 0;
      for (const p of puffs) { const d = Math.hypot(x - p[0], y - p[1]), w = 1 - d / p[2]; if (w > best) { best = w; own = p; } }
      if (!own) continue;
      a[y * SIZE + x] = 1;
      // a crescent per puff: lit inside a circle pulled toward the light (up and a little left), shaded outside one
      // pulled away from it, so the bands curve round each puff as the era's painters drew them
      const r = own[2], lit = Math.hypot(x - (own[0] - 0.3 * r), y - (own[1] - 0.42 * r)) < 0.86 * r, dark = Math.hypot(x - (own[0] - 0.1 * r), y - (own[1] - 0.2 * r)) > 0.98 * r;
      lv[y * SIZE + x] = base - y < SIZE * 0.05 ? 0 : lit ? top : dark ? Math.max(0, top - 2) : Math.max(0, top - 1);
    }
  },
  // a bamboo pole unrolled (u round it, v up one internode; image y = 0 is the top): stripes, and the node at the foot
  culm(lv, n, R) {
    const top = n - 1, stripes = Array.from({ length: 9 }, () => [R() * SIZE, 3 + R() * 10, R() < 0.5 ? top : Math.max(0, top - 2)]);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      let l = Math.max(0, top - 1);
      for (const [cx, w, sl] of stripes) { const d = Math.min(Math.abs(x - cx), SIZE - Math.abs(x - cx)); if (d < w / 2) l = sl; }
      if (y >= SIZE - 7) l = 0;                         // the node's dark line
      else if (y >= SIZE - 22) l = top;                 // the pale ring above it
      else if (y < 10) l = Math.max(0, top - 2);        // the sheath's shadow under the next node
      lv[y * SIZE + x] = l;
    }
  },
  // a spray (image y = SIZE − 1 is the foot, where it leaves the culm): a twig up the card, lance leaves fanned and drooping
  spray(lv, n, R, a) {
    const top = n - 1; a.fill(0);
    const twig = (t) => [SIZE / 2 + Math.sin(t * 2.2) * 18, SIZE - 1 - t * SIZE * 0.82];
    for (let t = 0; t < 1; t += 0.004) { const [x, y] = twig(t); for (let dx = -1; dx <= 1; dx++) { const X = Math.round(x) + dx, Y = Math.round(y); if (X >= 0 && X < SIZE && Y >= 0) { a[Y * SIZE + X] = 1; lv[Y * SIZE + X] = 0; } } }
    for (let k = 0; k < 28; k++) {
      const t = 0.12 + 0.86 * (k / 27), [bx, by] = twig(t), side = k % 2 ? 1 : -1, ang = side * (0.5 + 0.7 * R()) + Math.PI / 2 + (R() - 0.5) * 0.3;   // out and down
      const len = SIZE * (0.24 + 0.18 * R()), w = len * (0.15 + 0.05 * R());
      for (let s = 0; s < len; s++) {
        const f = s / len, half = w * Math.sin(Math.PI * Math.min(1, f * 1.15)) * (1 - f * 0.3), droop = f * f * len * 0.35;
        const cx = bx + Math.cos(ang) * s, cy = by + Math.sin(ang) * s * 0.55 + droop;
        for (let q = -Math.ceil(half); q <= Math.ceil(half); q++) {
          const X = Math.round(cx - Math.sin(ang) * q), Y = Math.round(cy + Math.cos(ang) * q * 0.55);
          if (X < 0 || X >= SIZE || Y < 0 || Y >= SIZE) continue;
          a[Y * SIZE + X] = 1; lv[Y * SIZE + X] = q * side < -half * 0.2 ? top : Math.abs(q) < 0.7 ? Math.max(0, top - 2) : Math.max(0, top - 1);
        }
      }
    }
  },
  // fallen petals from above: drifts of notched petals, singles between them, a few whole flowers
  petals(lv, n, R, a) {
    const top = n - 1; a.fill(0);
    const drifts = Array.from({ length: 4 }, () => [30 + R() * (SIZE - 60), 30 + R() * (SIZE - 60), 26 + R() * 34]);
    for (let k = 0; k < 150; k++) {
      let x, y;
      if (k < 110) { const d = drifts[k % drifts.length], ang = R() * 6.28, r = d[2] * Math.sqrt(R()); x = d[0] + Math.cos(ang) * r; y = d[1] + Math.sin(ang) * r; }
      else { x = 10 + R() * (SIZE - 20); y = 10 + R() * (SIZE - 20); }
      petalShape(lv, a, x, y, R() * 6.28, 11 + R() * 8, R() < 0.6 ? top : Math.max(0, top - 1), R() < 0.5 ? 1 : -1);
    }
    for (let k = 0; k < 4; k++) flower(lv, a, 24 + R() * (SIZE - 48), 24 + R() * (SIZE - 48), 12 + R() * 4, R() * 6.28, top);
  },
  // cherry bark unrolled (u round the limb, v along it): a mottled ground, lenticel bands, a few girdle cracks
  bark(lv, n, R) {
    const top = n - 1, mot = noise(R, 6), mot2 = noise(R, 13);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = 0.65 * mot(x, y) + 0.35 * mot2(x, y);
      lv[y * SIZE + x] = v > 0.3 ? Math.max(0, top - 1) : 0;
    }
    for (let k = 0; k < 70; k++) {   // lenticels: a short horizontal pale dash over a dark line
      const x0 = R() * SIZE, y0 = Math.round(R() * SIZE), len = 8 + R() * 22;
      for (let t = 0; t < len; t++) { const X = wrap(Math.round(x0 + t)); lv[wrap(y0) * SIZE + X] = top; lv[wrap(y0 + 1) * SIZE + X] = top; lv[wrap(y0 + 2) * SIZE + X] = 0; }
    }
    for (let k = 0; k < 3; k++) {   // girdle cracks: a dark ring round the limb, wavering
      const y0 = R() * SIZE, wav = noise(R, 5);
      for (let x = 0; x < SIZE; x++) { const Y = wrap(Math.round(y0 + (wav(x, 0) - 0.5) * 6)); lv[Y * SIZE + x] = 0; lv[wrap(Y + 1) * SIZE + x] = 0; }
    }
  },
  // packed flowers: the gaps the middle level, each flower five notched petals, the centres the darkest
  bloom(lv, n, R) {
    const top = n - 1; lv.fill(Math.max(0, top - 1));
    const cells = 6, step = SIZE / cells;
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
      const cx = (i + 0.5 + (R() - 0.5) * 0.5 + (j % 2) * 0.5) * step, cy = (j + 0.5 + (R() - 0.5) * 0.5) * step;
      flower(lv, null, cx, cy, step * (0.5 + 0.12 * R()), R() * 6.28, R() < 0.7 ? top : Math.max(0, top - 1), true);
    }
    for (let k = 0; k < 40; k++) { const cx = R() * SIZE, cy = R() * SIZE; flower(lv, null, cx, cy, step * (0.3 + 0.1 * R()), R() * 6.28, top, true); }
  },
  // a sprig: a ragged round cluster of flowers
  sprig(lv, n, R, a) {
    const top = n - 1; a.fill(0);
    const cx = SIZE / 2, cy = SIZE * 0.44, Rr = SIZE * 0.4, fl = [];
    for (let k = 0; k < 34; k++) { const ang = R() * 6.28, r = Rr * Math.sqrt(R()) * (0.8 + 0.2 * Math.sin(ang * 3 + R())); fl.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.9, 13 + R() * 9]); }
    fl.sort((p, q) => p[1] - q[1]);   // the lower flowers over the upper ones: the cluster read from below
    for (const [x, y, r] of fl) {
      const lit = (x - cx) * -0.6 + (y - cy) * -0.8 > -Rr * 0.25;
      flower(lv, a, x, y, r, R() * 6.28, lit ? top : Math.max(0, top - 1), false);
    }
  },
  // the rim and the creep are ONE boundary seen from its two sides (edgeField): the rim draws the soil past the edge,
  // the creep the grass short of it
  rim(lv, n, R, a, K) {
    const top = n - 1, E = edgeField(K.st.id), grit = noise(R, 23); a.fill(0);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const t = (SIZE - 1 - y) / SIZE; if (!E.soil(x, t)) continue;
      a[y * SIZE + x] = 1; lv[y * SIZE + x] = grit(x, y) > 0.9 ? top : Math.max(0, top - 1);
    }
  },
  creep(lv, n, R, a, K) {
    const top = n - 1, E = edgeField(K.st.id), patch = noise(R, 12); a.fill(0);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const t = (SIZE - 1 - y) / SIZE; if (E.soil(x, -t)) continue;
      a[y * SIZE + x] = 1; lv[y * SIZE + x] = patch(x, y) > 0.8 ? top : Math.max(0, top - 1);
    }
    for (let k = 0; k < 60; k++) {   // blades from the grass out over the soil, tips lit
      const x0 = R() * SIZE, b = E.at(x0); if (b > -0.05) continue;
      const len = SIZE * (0.05 + 0.12 * R()), w = 3 + R() * 3, lean = (R() - 0.5) * 0.8, y0 = SIZE - 1 + b * SIZE;
      for (let q = 0; q < len; q++) {
        const f = q / len, half = (w / 2) * (1 - f), cx = x0 + lean * q, Y = Math.round(y0 + q); if (Y < 0 || Y >= SIZE) continue;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) { const X = wrap(x); a[Y * SIZE + X] = 1; lv[Y * SIZE + X] = f > 0.6 ? top : Math.max(0, top - 1); }
      }
    }
  },
  // a tuft: blades from a crown at the bottom centre, fanned, tips lit (image y = 0 is the top)
  blades(lv, n, R, a) {
    const top = n - 1;
    a.fill(0);
    for (let k = 0; k < 26; k++) {
      const lean = (R() - 0.5) * 1.5, h = SIZE * (0.45 + 0.53 * R()), w = 7 + R() * 9, x0 = SIZE / 2 + (R() - 0.5) * 40, curl = (R() - 0.5) * 50;
      for (let t = 0; t < h; t++) {
        const f = t / h, half = (w / 2) * (1 - f * f), cx = x0 + lean * t * 0.35 + curl * f * f, Y = SIZE - 1 - Math.round(t);
        if (Y < 0) break;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          if (x < 0 || x >= SIZE) continue;
          a[Y * SIZE + x] = 1; lv[Y * SIZE + x] = f > 0.72 ? top : f < 0.22 ? 0 : x < cx ? Math.max(0, top - 2) : Math.max(0, top - 1);
        }
      }
    }
  },
};

/** Parse `isekai:<style>:<tile>-<band>` → { st, tile, band, stops } (the stops the tile may use), or null. A band is
 *  `lit` / `shade` (the card's windows), or `s<k>` for a tile that MATCHES what it lies on (`match: true`): its body in
 *  stop k of the ramp, its flecks in the stop above. */
export function isekaiKey(key) {
  const m = /^isekai:([a-z0-9-]+):([a-z]+)-(lit|shade|s\d|b\d)(?:~(\d{1,2}))?(\+hd)?$/.exec(key || ''); if (!m) return null;
  const hd = m[5] ? { hd: true } : {};
  if (m[4] !== undefined && (!GROUNDS.has(m[2]) || Number(m[4]) > 15)) return null;
  const st = ISEKAI_STYLES[m[1]] ?? lookOf(m[1])?.card, T = st && st.tiles[m[2]];
  // (a card's tile may name another PAINTER: the material pole draws its cliff as strata, its rock as a rock face)
  if (!T || !PAINTERS[T.paint ?? m[2]]) return null;
  const ramp = st.palette[T.ramp];
  // a skin BAND (`b0`…`b3`, lit to deep shade): the tile's one window, its drawing the band's (a leaf die's skin)
  if (/^b\d$/.test(m[3])) { const b = Number(m[3].slice(1)); if (b > 3) return null; return { st, tile: m[2], painter: T.paint ?? m[2], band: m[3], bandIndex: b, die: st.trees?.die ?? 'oval', variant: 0, cutout: CUTOUT.has(m[2]), stops: T.lit.map((i) => ramp[i]), ...hd }; }
  if (/^s\d$/.test(m[3])) { const k = Number(m[3].slice(1)); if (!T.match || k >= ramp.length) return null; return { st, tile: m[2], band: m[3], cutout: CUTOUT.has(m[2]), stops: [ramp[k], ramp[k], ramp[Math.min(k + 1, ramp.length - 1)]], ...hd }; }
  return { st, tile: m[2], painter: T.paint ?? m[2], band: m[3], variant: Number(m[4] ?? 0), cutout: CUTOUT.has(m[2]), stops: T[m[3]].map((i) => ramp[i]), ...hd };
}

const TEXELS = new Map();
/** The tile's texels: { W, H, rgb (Uint8Array), a (Uint8Array 0/255) | null }. */
export function isekaiTexels(key) {
  if (TEXELS.has(key)) return TEXELS.get(key);
  const K = isekaiKey(key); if (!K) return null;
  const tileKey = key.replace(/-(lit|shade|s\d|b\d)(~\d+)?(\+hd)?$/, ''), R = mulberry32(seedOf(tileKey)), lv = new Uint8Array(SIZE * SIZE), al = K.cutout || PATCHES.has(K.tile) ? new Uint8Array(SIZE * SIZE) : null;
  // the same dice for both bands of a tile: its lit and shade tiles are one drawing in two windows of the ramp
  // (a ground tile's variant paints its interior from its own dice; its frame from the tile's)
  PAINTERS[K.painter ?? K.tile](lv, K.stops.length, R, al, { ...K, tileKey, Rv: mulberry32(seedOf(`${tileKey}~${K.variant}`)) });
  if (K.hd) { const t = hiDef(lv, al, K); TEXELS.set(key, t); return t; }
  const rgb = new Uint8Array(SIZE * SIZE * 3), a = al ? new Uint8Array(SIZE * SIZE) : null;
  for (let i = 0; i < SIZE * SIZE; i++) { const s = K.stops[Math.min(K.stops.length - 1, lv[i])]; rgb[i * 3] = s[0]; rgb[i * 3 + 1] = s[1]; rgb[i * 3 + 2] = s[2]; if (a) a[i] = K.cutout ? (al[i] ? 255 : 0) : al[i]; }
  const t = { W: SIZE, H: SIZE, rgb, a }; TEXELS.set(key, t); return t;
}

// the hi-def drawing: the levels (and a cutout's alpha) smoothed on the tile's own wrap, read at twice the size, each texel
// coloured between the two stops its level falls between; a cutout's edge where its smoothed alpha crosses a half
const HD = 2, HD_R = 1;
function hiDef(lv, al, K) {
  const N = SIZE, M = N * HD, n = K.stops.length;
  const blur = (src) => {
    const a = new Float32Array(N * N), b = new Float32Array(N * N), w = 2 * HD_R + 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let t = 0; for (let d = -HD_R; d <= HD_R; d++) t += src[y * N + ((x + d + N) % N)]; a[y * N + x] = t / w; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let t = 0; for (let d = -HD_R; d <= HD_R; d++) t += a[((y + d + N) % N) * N + x]; b[y * N + x] = t / w; }
    return b;
  };
  const L = blur(lv), A = al ? blur(Array.from(al, (v) => (K.cutout ? (v ? 1 : 0) : v / 255))) : null;
  const at = (F, u, v) => { const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, g = (x, y) => F[((y + N) % N) * N + ((x + N) % N)]; return (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy; };
  const rgb = new Uint8Array(M * M * 3), a = A ? new Uint8Array(M * M) : null;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const u = (x + 0.5) / HD - 0.5, v = (y + 0.5) / HD - 0.5, l = Math.max(0, Math.min(n - 1, at(L, u, v))), i0 = Math.floor(l), i1 = Math.min(n - 1, i0 + 1), f = l - i0, i = y * M + x;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(K.stops[i0][c] + (K.stops[i1][c] - K.stops[i0][c]) * f);
    if (a) { const q = at(A, u, v); a[i] = K.cutout ? (q >= 0.5 ? 255 : 0) : Math.round(q * 255); }
  }
  return { W: M, H: M, rgb, a };
}

const BLOCKS = new Map();
/**
 * A MATERIAL at block resolution, for drawers that are not a 3D page (the SVG plates): the painter `material` (dirt,
 * scree, packed, stone, plaster, grain, leaf) in five `stops` (the window round a face's lit stop, its middle the
 * colour), its dice from `seed`. → { W, H, rgb, url } (a PNG a texel a block, for a pattern drawn pixelated).
 */
export function materialBlocks(material, stops, seed = material, extra = {}) {
  const k = `${material}|${seed}|${extra.die ?? ''}${extra.bandIndex ?? ''}|${stops.map((c) => c.join(',')).join(';')}`;
  if (BLOCKS.has(k)) return BLOCKS.get(k);
  if (!PAINTERS[material] || stops.length !== 5) throw new Error(`materialBlocks: a material (${[...MATERIALS].join(', ')}) in five stops`);
  const tileKey = `material:${material}:${seed}`, lv = new Uint8Array(SIZE * SIZE);
  PAINTERS[material](lv, 5, mulberry32(seedOf(tileKey)), null, { tileKey, variant: 0, Rv: mulberry32(seedOf(`${tileKey}~0`)), ...extra });
  const C = DIRT_C, rgb = new Uint8Array(C * C * 3);
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const s = stops[lv[(y * DIRT_PX) * SIZE + x * DIRT_PX]]; rgb.set(s, (y * C + x) * 3); }
  const t = { W: C, H: C, rgb, url: `data:image/png;base64,${encodePng(Buffer.from(rgb), C, C).toString('base64')}` };
  BLOCKS.set(k, t); return t;
}
export const MATERIALS = Object.freeze(['dirt', 'scree', 'packed', 'stone', 'plaster', 'grain', 'leaf', 'metal', 'rockface', 'strata', 'canopy']);

const URLS = new Map();
export function isekaiTexture(key) {
  if (URLS.has(key)) return URLS.get(key);
  const t = isekaiTexels(key); if (!t) return null;
  let url;
  if (t.a) { const rgba = new Uint8Array(t.W * t.H * 4); for (let i = 0; i < t.W * t.H; i++) { rgba[i * 4] = t.rgb[i * 3]; rgba[i * 4 + 1] = t.rgb[i * 3 + 1]; rgba[i * 4 + 2] = t.rgb[i * 3 + 2]; rgba[i * 4 + 3] = t.a[i]; } url = `data:image/png;base64,${encodePngRgba(Buffer.from(rgba), t.W, t.H).toString('base64')}`; }
  else url = `data:image/png;base64,${encodePng(Buffer.from(t.rgb), t.W, t.H).toString('base64')}`;
  URLS.set(key, url); return url;
}

/** A cutout's alpha as the sun bake reads a card's ({ W, H, a }), or null. */
export function isekaiMask(key) { const t = isekaiTexels(key); return t && t.a ? { W: t.W, H: t.H, a: t.a } : null; }

registerTextureResolver('isekai:', isekaiTexture);
