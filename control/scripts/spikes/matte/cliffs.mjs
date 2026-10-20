#!/usr/bin/env node
/**
 * SPIKE: cliffs GENERATED the way cliffs are made, not painted as noise over a wall. The first formations pass layered
 * relief terms on a flat face and read as masonry; a real face is what is left after rock with a structure wore back:
 *   structure  beds of their own hardness and thickness (lenses that pinch out, a dip, a fold), joints that cut a unit of
 *              beds (wandering, some only part of it), and joints parallel to the face, the planes blocks come away on
 *   erosion    a soft bed wears back by its own unevenness; a hard block holds an overhang over it up to what its strength
 *              and thickness allow, then falls, one slab of its face-parallel joints at a time (the block above it, now
 *              undercut, in turn): the staircase scars, the roofs, the proud ledges. Some blocks fall on their own
 *   masses     the face's own relief over metres: buttresses, and gullies down the major joints
 *   weather    the edges round; fresh scars are warm and clean, old faces grey with lichen; water collects on the ledges
 *              and runs down the face below in dark streaks; green hangs over the ledges and fills the wet recesses
 * One law, a few rocks: each formation is a table of numbers (no code of its own), and each seed a different cliff of it.
 *
 *   cd control && node scripts/spikes/matte/cliffs.mjs → ../lite-template/integration/1020/spike-output/matte/cliffs.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { fractal2, gnoise2, smoothstep, terrace } = await import('../../../lib/graph/noise/noise.js');
const { hash01, dice } = await import('../../../lib/graph/matte-paint/relief.js');
const { lightRelief } = await import('../../../lib/graph/matte-paint/light.js');
const { rampAt } = await import('../../../lib/graph/matte-paint/paint.js');
const { encodePngRgba } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * FORMATIONS: numbers only.
 *   beds      thin/thick [m, m] log-uniform, thickShare; hard [thin, thick] mean hardness 0..1, hardSpread; lens (share of
 *             the thinner neighbour a boundary wanders), lensScale m; dip °; fold [amp m, length m]; recess m (a soft bed's
 *             wear at hardness 0); parting m (the bedding plane's groove)
 *   joints    spacing [m, m]; unitBeds [n, n] (the beds a joint set cuts through); run (least share of its unit a joint
 *             cuts); wander m; width m; depth m
 *   slab      [m, m] the face-parallel joints' spacing (how far a block steps back when it falls)
 *   hold      m of overhang a fully hard, 1 m thick bed carries;  fall: a block's own chance to fall
 *   masses    { scale, amp } m;  gullies { spacing [m, m], width m, depth m } down the major joints
 *   round     m, the edges' weathered radius;  warp { amp, scale } m, how ragged an edge runs
 *   tilt      a block face's own lean (m per m);  rough { amp, scale };  frac { cell [m, m], depth, octaves, ledge, step }:
 *             the face broken small, terraced noise long along the beds (ledges) and long up the joints (steps);
 *   angular   how far a scar's outline steps along the joints' frame (0: a smooth outline);
 *   minor     { cell, depth } short cracks; laminae m (fine bedding); cross ° (cross-bedding in thick beds)
 *   colour    ramp (hard), soft (soft beds), fresh (a new scar), tint (a bed's own shift), lichen, streak { amount,
 *             run m, top }, green { amount, hang m, recess, ramp }
 */
const FORMATIONS = {
  flagstone: {
    title: 'flagstone and shale (sea cliff)',
    beds: { thin: [0.08, 0.5], thick: [0.6, 1.6], thickShare: 0.2, hard: [0.45, 0.85], hardSpread: 0.35, lens: 0.45, lensScale: 6, dip: 1.5, fold: [0.6, 40], recess: 0.35, parting: 0.02 },
    joints: { spacing: [2, 7], unitBeds: [6, 20], run: 0.45, wander: 0.2, width: 0.05, depth: 0.08 },
    slab: [0.25, 0.7], hold: 0.35, fall: 0.12,
    masses: { scale: 9, amp: 1.2 }, gullies: { spacing: [9, 18], width: 1.6, depth: 1.2 },
    round: 0.04, warp: { amp: 0.05, scale: 0.35 }, tilt: 0.02, rough: { amp: 0.004, scale: 0.12 },
    frac: { cell: [0.8, 0.4], depth: 0.05, octaves: 4, tilt: 0.25, ledge: 1.2, step: 0.3 }, jitter: 0.04, minor: { cell: [0.5, 0.8], depth: 0.012 }, laminae: 0.03, cross: 0,
    colour: {
      ramp: ['#24272a', '#454a4e', '#6c7074', '#999c9c', '#c6c6c0'], soft: ['#202224', '#3a3d40', '#5a5d60', '#7e8182', '#a4a4a0'],
      fresh: ['#2c2a26', '#57524a', '#837b6e', '#aea594', '#d4ccb8'], freshShare: 0.35, tint: 0.07, lichen: 0.3,
      streak: { amount: 0.18, run: 3, top: 0.2 }, green: { amount: 0.35, hang: 0.2, recess: 0.04, ramp: ['#25321a', '#3f5626', '#5d7a34', '#83a04a', '#adc06a'] },
    },
  },
  limestone: {
    title: 'massive limestone (blockfall, black streaks)',
    beds: { thin: [0.3, 1], thick: [2.5, 7], thickShare: 0.55, hard: [0.6, 0.95], hardSpread: 0.15, lens: 0.3, lensScale: 9, dip: 3, fold: [1.2, 60], recess: 0.5, parting: 0.04 },
    joints: { spacing: [1.8, 7], unitBeds: [3, 8], run: 0.4, wander: 0.3, width: 0.15, depth: 0.3 },
    slab: [0.4, 1.4], hold: 1.0, fall: 0.3,
    masses: { scale: 8, amp: 2.2 }, gullies: { spacing: [9, 16], width: 2.4, depth: 1.8 },
    round: 0.09, warp: { amp: 0.12, scale: 0.6 }, tilt: 0.025, rough: { amp: 0.006, scale: 0.2 },
    frac: { cell: [1.6, 1.1], depth: 0.12, octaves: 5, tilt: 0.3 }, jitter: 0.2, minor: { cell: [0.8, 1.2], depth: 0.02 }, laminae: 0, cross: 0,
    colour: {
      ramp: ['#353330', '#625d55', '#928b7f', '#bdb5a5', '#ddd6c6'], soft: ['#2c2a26', '#4c4740', '#6e675c', '#918878', '#b2a894'],
      fresh: ['#4a2c18', '#8c5630', '#c07c48', '#dca470', '#f0c896'], freshShare: 0.5, tint: 0.05, lichen: 0.45,
      streak: { amount: 0.35, run: 9, top: 0.5 }, green: null,
    },
  },
  sandstone: {
    title: 'cross-bedded sandstone (desert, varnish)',
    beds: { thin: [0.2, 0.8], thick: [1.5, 4], thickShare: 0.5, hard: [0.5, 0.75], hardSpread: 0.2, lens: 0.6, lensScale: 7, dip: 0, fold: [0.4, 30], recess: 0.45, parting: 0.03 },
    joints: { spacing: [3, 9], unitBeds: [2, 6], run: 0.7, wander: 0.25, width: 0.1, depth: 0.25 },
    slab: [0.3, 1.0], hold: 1.0, fall: 0.15,
    masses: { scale: 10, amp: 1.8 }, gullies: { spacing: [10, 18], width: 2.2, depth: 1.4 },
    round: 0.16, warp: { amp: 0.1, scale: 0.8 }, tilt: 0.015, rough: { amp: 0.004, scale: 0.1 },
    frac: { cell: [1.4, 0.8], depth: 0.07, octaves: 4, tilt: 0.2 }, jitter: 0.15, minor: { cell: [1, 1.4], depth: 0.008 }, laminae: 0.025, cross: 24,
    colour: {
      ramp: ['#3e1c10', '#7a3a1e', '#ac5a30', '#cf8450', '#e8b080'], soft: ['#3a1e14', '#6a3622', '#94523a', '#b8745a', '#d69a7e'],
      fresh: ['#4c2814', '#9a5226', '#d27c40', '#eca468', '#f8cc98'], freshShare: 0.3, tint: 0.06, lichen: 0.05,
      streak: { amount: 0.3, run: 14, top: 0.8 }, green: null,
    },
  },
  granite: {
    title: 'jointed granite (sheeting, rounded blocks)',
    beds: { thin: [2.5, 5], thick: [5, 12], thickShare: 0.5, hard: [0.9, 1], hardSpread: 0.05, lens: 0.5, lensScale: 12, dip: 6, fold: [2, 50], recess: 0, parting: 0.05 },
    joints: { spacing: [2.5, 8], unitBeds: [2, 5], run: 0.7, wander: 0.5, width: 0.35, depth: 0.45 },
    slab: [0.5, 1.5], hold: 1.6, fall: 0.25, angular: 0,
    masses: { scale: 9, amp: 1.6 }, gullies: null,
    round: 0.22, warp: { amp: 0.15, scale: 1.0 }, tilt: 0.04, rough: { amp: 0.004, scale: 0.05 },
    frac: { cell: [2.2, 1.8], depth: 0.05, octaves: 4, tilt: 0.25, ledge: 0.35, step: 0.8 }, jitter: 0.3, minor: { cell: [1.2, 1.2], depth: 0.012 }, laminae: 0, cross: 0,
    colour: {
      ramp: ['#2c2a2a', '#565252', '#857e7c', '#b1aaa6', '#d8d2cc'], soft: ['#2c2a2a', '#565252', '#857e7c', '#b1aaa6', '#d8d2cc'],
      fresh: ['#3a2c28', '#6e5650', '#a08478', '#c8ae9e', '#e6d4c6'], freshShare: 0.3, tint: 0.03, lichen: 0.6, speckle: 0.12,
      streak: { amount: 0.35, run: 8, top: 0.5 }, green: { amount: 0.25, hang: 0.08, recess: 0, ramp: ['#2a3020', '#46502e', '#66703e', '#8a9258', '#b0b47a'] },
    },
  },
};

/**
 * THE STRUCTURE of one cliff w × h m (independent of any resolution, so a whole view and a close crop are one cliff):
 * its beds, the joints cutting each, and each block's retreat after erosion.
 */
function structure(F, w, h, seed) {
  const R = dice(seed * 911 + 5), beds = [];
  let y = 0, unit = 0, left = 0;
  while (y < h + 2) {
    const thick = R() < F.beds.thickShare, [a, b] = thick ? F.beds.thick : F.beds.thin, t = a * Math.pow(b / a, R());
    if (left <= 0) { unit++; left = F.joints.unitBeds[0] + Math.floor(R() * (F.joints.unitBeds[1] - F.joints.unitBeds[0] + 1)); }
    const H = clamp(F.beds.hard[thick ? 1 : 0] + (R() - 0.5) * 2 * F.beds.hardSpread, 0, 1);
    beds.push({ y0: y, y1: y + t, t, H, unit, tint: R() - 0.5, id: beds.length }); y += t; left--;
  }
  const n = beds.length;
  // the joints: each unit its own set across the face; each joint cuts a contiguous run of its unit's beds
  const cuts = beds.map(() => []); let jid = 0;
  for (let u = 1; u <= unit; u++) {
    const ub = beds.filter((B) => B.unit === u).map((B) => B.id);
    let x = -R() * F.joints.spacing[1];
    while (x < w + F.joints.spacing[1]) {
      const span = Math.max(1, Math.round(ub.length * (F.joints.run + (1 - F.joints.run) * R()))), from = ub[0] + Math.floor(R() * (ub.length - span + 1));
      for (let b = from; b < from + span; b++) cuts[b].push({ x, id: jid });
      jid++; x += lerp(F.joints.spacing[0], F.joints.spacing[1], R());
    }
  }
  for (const c of cuts) c.sort((p, q) => p.x - q.x);
  // each bed's blocks between its joints: [{ xa, xb, r (retreat m), fresh, falls }]
  const blocks = cuts.map((c) => { const out = []; for (let k = 0; k <= c.length; k++) out.push({ xa: k ? c[k - 1].x : -1e3, xb: k < c.length ? c[k].x : 1e3 }); return out; });
  const blockAt = (b, x) => { const c = cuts[b]; let lo = 0, hi = c.length; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m].x <= x) lo = m + 1; else hi = m; } return lo; };
  const wear = (b, x) => 0.5 + 0.5 * (fractal2(x / 4, b * 1.37, { seed: seed + 33, octaves: 2 })[0] + 1);
  const soft = (b, x) => F.beds.recess * (1 - beds[b].H) * wear(b, x);
  // erosion, from the foot up: a block is undercut by the bed below it; it holds what it can, then sheds slabs
  for (let b = n - 1; b >= 0; b--) {
    const B = beds[b];
    for (const K of blocks[b]) {
      const xa = Math.max(-1, K.xa), xb = Math.min(w + 1, K.xb), r1 = R(), r2 = R(), r3 = R(), r4 = R();
      let under = 0;
      if (b < n - 1) for (let x = xa; x <= xb; x += 0.25) { const Kb = blocks[b + 1][blockAt(b + 1, x)]; under = Math.max(under, Kb.r + 0.6 * Kb.own + soft(b + 1, x)); }
      const hold = F.hold * B.H * Math.sqrt(B.t) * (0.5 + r1), slab = lerp(F.slab[0], F.slab[1], r2);
      const forced = under > hold ? Math.ceil((under - hold) / slab) : 0;
      // a block's own fall breaks out only part of it, an irregular scar (the rock breaks through itself as well as on
      // its joints); a forced one takes what overhangs, the whole block
      const own = r3 < F.fall * (1.3 - B.H) ? 1 + Math.floor(r4 * 2.5) : 0, falls = forced + own;
      K.r = forced * slab + soft(b, (xa + xb) / 2) * 0.4 + F.jitter * R(); K.own = own * slab; K.falls = falls; K.slab = slab; K.blob = 0.3 * (R() - 0.3);
      K.fresh = falls > 0 && hash01(b, Math.round(K.xa * 10), seed + 61) < F.colour.freshShare;
      K.gx = hash01(b, Math.round(K.xa * 10), seed + 63) - 0.5; K.gy = hash01(b, Math.round(K.xa * 10), seed + 65) - 0.5;
    }
  }
  // gullies down the major joints: a few across the face, each wandering
  const gullies = [];
  if (F.gullies) { const G = dice(seed * 313 + 1); let x = G() * F.gullies.spacing[1]; while (x < w + 4) { gullies.push({ x, depth: F.gullies.depth * (0.5 + G()), width: F.gullies.width * (0.6 + 0.8 * G()), id: gullies.length }); x += lerp(F.gullies.spacing[0], F.gullies.spacing[1], G()); } }
  return { beds, cuts, blocks, blockAt, soft, gullies, w, h, seed };
}

/** A bed boundary's height at x: its nominal place, the dip, a gentle fold and the lens wander (by the thinner bed). */
function boundaries(S, F, x) {
  const { beds, seed } = S, n = beds.length, yb = new Float64Array(n + 1), dip = Math.tan((F.beds.dip * Math.PI) / 180);
  const fold = F.beds.fold[0] * Math.sin((x / F.beds.fold[1]) * 6.2832 + seed);
  for (let b = 0; b <= n; b++) {
    const y0 = b < n ? beds[b].y0 : beds[n - 1].y1, th = Math.min(b ? beds[b - 1].t : 9, b < n ? beds[b].t : 9);
    yb[b] = y0 + x * dip + fold + F.beds.lens * th * fractal2(x / F.beds.lensScale, b * 0.37, { seed: seed + 3, octaves: 2 })[0];
    if (b && yb[b] < yb[b - 1]) yb[b] = yb[b - 1];   // a bed pinches out, never crosses
  }
  return yb;
}

/** A box blur, three passes ≈ a Gaussian: the edges' weathered rounding. */
function round3(src, W, H, r) {
  let a = src; const n = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let j = 0; j < H; j++) { const o = j * W; let s = 0; for (let i = -r; i <= r; i++) s += a[o + clamp(i, 0, W - 1)]; for (let i = 0; i < W; i++) { tmp[o + i] = s / n; s += a[o + clamp(i + r + 1, 0, W - 1)] - a[o + clamp(i - r, 0, W - 1)]; } }
    for (let i = 0; i < W; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[clamp(j, 0, H - 1) * W + i]; for (let j = 0; j < H; j++) { out[j * W + i] = s / n; s += tmp[clamp(j + r + 1, 0, H - 1) * W + i] - tmp[clamp(j - r, 0, H - 1) * W + i]; } }
    a = out;
  }
  return a;
}

/** The nearest short crack: cracks sit one per cell (some cells none), mostly along the joints' bearing. */
function crack(x, y, cw, ch, seed) {
  const ci = Math.floor(x / cw), cj = Math.floor(y / ch); let best = 9;
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    if (hash01(i, j, seed) > 0.55) continue;
    const px = (i + hash01(i, j, seed + 1)) * cw, py = (j + hash01(i, j, seed + 2)) * ch, flat = hash01(i, j, seed + 3) < 0.3;
    const a = (flat ? 0 : Math.PI / 2) + (hash01(i, j, seed + 4) - 0.5) * 0.7, len = (0.3 + 0.7 * hash01(i, j, seed + 5)) * Math.max(cw, ch) * 0.5;
    const ux = Math.cos(a), uy = Math.sin(a), dx = x - px, dy = y - py, s = clamp(dx * ux + dy * uy, -len, len);
    const d = Math.hypot(dx - s * ux, dy - s * uy) + 0.004 * Math.abs(s) / len * 3;
    if (d < best) best = d;
  }
  return best;
}

function paint(S, F, { ppm, x0 = 0, y0 = 0, cw = S.w, ch = S.h }) {
  const { beds, cuts, blocks, soft, gullies, seed } = S, n = beds.length;
  const W = Math.round(cw * ppm), H = Math.round(ch * ppm), px = 1 / ppm;
  // the visual domain: a layer is drawn once its feature spans a few pixels, and not before
  const lod = (size) => smoothstep(1.5, 4, size * ppm);
  const L = { joint: lod(F.joints.width), part: lod(Math.max(0.02, F.beds.parting * 2)), minor: lod(0.03), lam: F.laminae ? lod(F.laminae) : 0, rough: lod(F.rough.scale * 0.5) };
  const zs = new Float32Array(W * H), info = new Array(W * H);
  const cols = []; for (let i = 0; i < W; i++) cols.push(boundaries(S, F, x0 + (i + 0.5) * px));
  const jx = (J, y) => J.x + F.joints.wander * (gnoise2(y / 2.5, J.id * 0.71, seed + 7) + 0.12 * gnoise2(y / 0.6, J.id * 0.71, seed + 8));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) * px, y = y0 + (j + 0.5) * px, k = j * W + i, yb = cols[i];
    // a ragged edge: the structure is looked up a little off the pixel
    const xw = x + F.warp.amp * (gnoise2(x / F.warp.scale, y / F.warp.scale, seed + 41) + 0.4 * gnoise2(x / (F.warp.scale * 0.3), y / (F.warp.scale * 0.3), seed + 42));
    const yw = y + F.warp.amp * 0.6 * (gnoise2(x / F.warp.scale, y / F.warp.scale, seed + 43) + 0.4 * gnoise2(x / (F.warp.scale * 0.3), y / (F.warp.scale * 0.3), seed + 44));
    let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (yb[m + 1] <= yw) lo = m + 1; else hi = m; }
    const b = Math.min(lo, n - 1), B = beds[b], top = yb[b], bot = yb[b + 1], tall = Math.max(1e-4, bot - top), t = clamp((yw - top) / tall, 0, 1);
    // its block: how many of the bed's joints lie left of it, each joint at its own wander
    const c = cuts[b]; let kk = 0, jl = -1e3, jr = 1e3;
    for (let q = 0; q < c.length; q++) { const xq = jx(c[q], y); if (xq <= xw) { kk = q + 1; jl = xq; } else { jr = xq; break; } }
    const K = blocks[b][kk];
    // the masses and the gullies down the major joints
    let z = fractal2(x / S.massScale, y / (S.massScale * 1.5), { seed: seed + 5, octaves: 2 })[0] * F.masses.amp;
    for (const G of gullies) { const gx = G.x + 0.5 * gnoise2(y / 12, G.id, seed + 51) + 0.15 * gnoise2(y / 2, G.id, seed + 53); const d = Math.abs(xw - gx) / G.width; if (d < 1) z -= G.depth * (1 - d) * (1 - d * 0.5) * (0.5 + 0.5 * smoothstep(-0.5, 0.3, gnoise2(y / 9, G.id + 9, seed + 52))); }
    z -= K.r;
    // its own scar: a blob of the block, torn at its edge
    let scar = 0;
    if (K.own) { const sz = Math.min(4, Math.max(0.8, (Math.min(K.xb, 1e2) - Math.max(K.xa, -1e2)) * 0.5)), bq = (F.angular ?? 1) * 0.22 * (hash01(Math.floor(xw / 0.9 + 0.4 * gnoise2(y / 1.5, x / 1.5, seed + 58)), Math.floor(yw / 0.6 + 0.3 * gnoise2(x / 1.5, y / 1.5, seed + 60)), seed + 59) - 0.5), bl = fractal2(x / sz, y / sz, { seed: seed + 57 + (b % 7), octaves: 2 })[0] + K.blob + bq; scar = smoothstep(-0.015, 0.015, bl); z -= K.own * scar; }
    // a soft bed worn back in a round hollow under the hard bed above it
    // (a bed a pixel or two thick cannot be drawn: its hollow fades to its mean, a band of tone instead of a hairline)
    const see = smoothstep(1.5, 5, tall * ppm);
    if (B.H < 0.75) z -= soft(b, x) * (see * Math.pow(Math.sin(Math.PI * t), 0.5) + (1 - see) * 0.75) * 0.6;
    // a block face's own lean (it came away on its own joint plane)
    const xc = (Math.max(K.xa, x0 - 5) + Math.min(K.xb, x0 + cw + 5)) / 2;
    z += F.tilt * (K.gx * (x - xc) + K.gy * (t - 0.5) * tall);
    // the joint, weathered open into a rounded groove (its crack drawn sharp after the rounding)
    const dJ = Math.min(xw - jl, jr - xw);
    z -= F.joints.depth * Math.pow(1 - smoothstep(0, F.joints.width, dJ), 2) * (0.5 + 0.5 * smoothstep(-0.5, 0.5, gnoise2(y / 1.5, b, seed + 9)));
    zs[k] = z;
    info[k] = { scar, b, B, K, t, tall, dJ: Math.min(xw - jl, jr - xw), dB: Math.min(t, 1 - t) * tall, x, y };
  }
  // the edges round, to the formation's weathered radius (once it spans a pixel)
  const rr = Math.round(F.round * ppm / 1.7), z1 = rr >= 1 ? round3(zs, W, H, rr) : zs, height = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) {
    const I = info[k], { x, y, B } = I;
    let z = z1[k];
    // the joint and the bedding plane: an open crack, its lips worn into a V
    z -= L.joint * 0.03 * (1 - smoothstep(0, 0.012, I.dJ));
    // the face broken at every scale into small ledges and step-backs: anisotropic noise cut into terraces, long along the
    // beds (ledges, lit on top and shadowed under) and long up the joints (steps), an octave at a time, each once it can
    // be seen. Terraces of a smooth field have open, irregular outlines: never a closed network of cells
    // (how broken varies over the face: zones of smooth fracture plane and zones of rubbly rock; a fresh scar is smooth)
    const broken = (0.3 + 0.7 * smoothstep(-0.35, 0.35, fractal2(x / 5, y / 7, { seed: seed + 99, octaves: 2 })[0])) * (1 - 0.6 * I.scar);
    for (let o = 0, sx = F.frac.cell[0], sy = F.frac.cell[1], dd = F.frac.depth * broken; o < F.frac.octaves; o++, sx *= 0.45, sy *= 0.45, dd *= 0.5) {
      const lo = lod(Math.min(sx, sy) * 0.3); if (lo <= 0) break;
      const h1 = fractal2(x / (sx * 2.2), y / (sy * 0.7), { seed: seed + 101 + o, octaves: 3 })[0], h2 = fractal2(x / (sx * 0.6), y / (sy * 2.4), { seed: seed + 111 + o, octaves: 3 })[0];
      z += lo * dd * ((F.frac.ledge ?? 1) * terrace(h1 * 3, 1, 0.25) / 3 + (F.frac.step ?? 0.6) * terrace(h2 * 3, 1, 0.3) / 3) * 2;
    }
    z -= L.part * smoothstep(1.5, 5, I.tall * ppm) * F.beds.parting * (1 - smoothstep(0, F.beds.parting * 1.5, I.dB)) * smoothstep(-0.3, 0.3, gnoise2(x / 2.5, I.b * 0.53, seed + 11));
    // the face itself: a broad undulation, scallops where a flake came off, short cracks, the fine bedding, the grain
    z += 0.3 * F.frac.depth * fractal2(x / 0.9, y / 0.9, { seed: seed + 13, octaves: 2 })[0];
    if (B.H > 0.5) {
      const cd = crack(x, y, F.minor.cell[0], F.minor.cell[1], seed + 21);
      z -= L.minor * F.minor.depth * (1 - smoothstep(0, 0.012, cd));
    }
    if (F.laminae) {
      // cross-bedding: in a thick bed the laminae lean, each set its own way
      const cross = F.cross && I.tall > 1 ? Math.tan((F.cross * Math.PI) / 180) * (hash01(I.b, Math.floor(x / 5), seed + 71) < 0.5 ? 1 : -1) : 0;
      const ly = I.t * I.tall + cross * (x % 5) + 0.3 * F.laminae * gnoise2(x / 1.5, y, seed + 31);
      z -= L.lam * F.laminae * 0.06 * Math.pow(0.5 + 0.5 * Math.sin((ly / F.laminae) * 6.2832), 3);
    }
    z += L.rough * F.rough.amp * fractal2(x / F.rough.scale, y / F.rough.scale, { seed: seed + 17, octaves: 3 })[0];
    height[k] = z;
  }
  const inside = new Float32Array(W * H).fill(1);
  const lit = lightRelief({ W, H, px, height, inside }, { az: 125, el: 28, ambient: 0.28, wrap: 0.1, reach: Math.max(1.5, 30 * px), soft: Math.max(0.03, 4 * px), floor: 0.22, radius: Math.max(0.1, 5 * px), cavity: 0, edge: 0 });
  // occlusion by scale: a hollow darkens by how deep it sits under its surroundings (two radii, metres not a fixed mm)
  const occ = new Float32Array(W * H);
  for (const [rad, depth, amt] of [[0.15, 0.06, 0.25], [0.8, 0.4, 0.3]]) { const r = Math.round(rad * ppm / 1.7); if (r < 1) continue; const m = round3(height, W, H, r); for (let k = 0; k < W * H; k++) occ[k] += amt * smoothstep(0, depth, m[k] - height[k]); }
  // water: down each column from the top, gathered on every ledge (the face stepping out below), spilling down the face
  // under it and fading as it runs; it runs in narrow streaks
  const C = F.colour, wet = new Float32Array(W * H), ledge = new Float32Array(W * H);
  for (let i = 0; i < W; i++) {
    let wv = C.streak.top * smoothstep(-0.1, 0.5, fractal2((x0 + (i + 0.5) * px) / 2.5, 0.5, { seed: seed + 98, octaves: 3 })[0]), since = 9, lip = 0;
    for (let j = 0; j < H; j++) {
      const k = j * W + i, step = j < H - 1 ? (height[k + W] - height[k]) / px : 0;
      const src = clamp((step - 2.5) / 5, 0, 1), drip = clamp((-step - 1.5) / 4, 0, 1);
      wv = wv * Math.exp(-px / C.streak.run) + 0.4 * src + 0.15 * drip;
      if (src > 0.5) { lip = since < 0.05 ? Math.max(lip, src) : src; since = 0; } else since += px;
      wet[k] = wv; ledge[k] = lip * smoothstep(C.green ? C.green.hang : 0.1, 0, since);
    }
  }
  const ramp = C.ramp.map(hex), softR = C.soft.map(hex), fresh = C.fresh.map(hex), green = C.green ? C.green.ramp.map(hex) : null, out = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    const I = info[k], { x, y, B, K } = I, v = lit.value[k] * (1 - Math.min(0.5, occ[k]));
    let tt = 0.5 + (v - 1) * 1.05 + B.tint * C.tint * 2;
    // the stone's own mottle, at three scales, each once it can be seen
    tt += 0.05 * fractal2(x / 1.2, y / 1.6, { seed: seed + 95, octaves: 2 })[0] + 0.045 * lod(0.15) * fractal2(x / 0.15, y / 0.2, { seed: seed + 96, octaves: 2 })[0] + 0.04 * lod(0.02) * (hash01(Math.floor(x * 50), Math.floor(y * 50), seed + 97) - 0.5);
    // a bed's rock: the soft beds another stone, darker
    const hardness = smoothstep(0.35, 0.8, B.H);
    let col = mix(rampAt(softR, tt), rampAt(ramp, tt), hardness);
    // a fresh scar: clean and warm, its edge torn (old rock still clings at the margins)
    const fm = K.fresh ? I.scar * smoothstep(0.1, 0.5, I.scar + 0.3 * fractal2(x / 0.5, y / 0.5, { seed: seed + 81, octaves: 3 })[0]) : 0;
    col = mix(col, rampAt(fresh, tt + 0.04), fm * 0.7);
    // the old face: weathered in soft broad washes (never block by block), and lichen in patches
    const age = 1 - fm, wash = fractal2(x / 6, y / 10, { seed: seed + 83, octaves: 3 })[0];
    col = mix(col, rampAt(fresh, tt), clamp(0.25 + 0.6 * wash, 0, 0.5) * age * 0.5);
    if (C.lichen) {
      const ln = fractal2(x / 0.3, y / 0.3, { seed: seed + 85, octaves: 3 })[0] + 0.25 * fractal2(x / 3, y / 3, { seed: seed + 86, octaves: 2 })[0];
      // crusts in broad soft patches, pale and dark (never dots)
      const lm = smoothstep(0.0, 0.5, ln) * age * C.lichen * lod(0.12);
      col = mix(col, mix([92, 94, 84], [200, 198, 182], smoothstep(-0.2, 0.4, fractal2(x / 1.5, y / 1.5, { seed: seed + 88, octaves: 2 })[0])), lm * 0.35);
    }
    if (C.speckle) { const s = hash01(Math.floor(x * 120), Math.floor(y * 120), seed + 87); if (s < 0.08) col = mix(col, s < 0.03 ? [40, 38, 38] : [210, 180, 170], C.speckle * 3 * lod(0.02)); }
    // streaks: dark where the water runs, narrow and long
    const sm = smoothstep(-0.1, 0.5, fractal2(x / 0.5, y / 9, { seed: seed + 89, octaves: 4 })[0] + 0.5 * fractal2(x / 4, y / 20, { seed: seed + 90, octaves: 2 })[0]);
    col = col.map((c) => c * (1 - clamp(wet[k] * sm * C.streak.amount, 0, 0.6)));
    // green: hanging over the ledges, and in the wet soft recesses
    if (green) {
      const gn = fractal2(x / 0.4, y / 0.4, { seed: seed + 91, octaves: 3 })[0];
      const g = Math.max(ledge[k] * smoothstep(-0.3, 0.2, gn), (1 - hardness) * C.green.recess * smoothstep(0.0, 0.4, gn + 0.4 * Math.sin(Math.PI * I.t) - 0.2)) * C.green.amount;
      col = mix(col, rampAt(green, 0.45 + (v - 1) * 0.9 + 0.15 * gn), clamp(g, 0, 1));
    }
    out[k * 4] = clamp(Math.round(col[0]), 0, 255); out[k * 4 + 1] = clamp(Math.round(col[1]), 0, 255); out[k * 4 + 2] = clamp(Math.round(col[2]), 0, 255); out[k * 4 + 3] = 255;
  }
  return `data:image/png;base64,${encodePngRgba(out, W, H).toString('base64')}`;
}

const only = process.argv[2];
const rows = [];
for (const [id, F] of Object.entries(FORMATIONS)) {
  if (only && id !== only) continue;
  const t0 = Date.now(), cells = [];
  for (const seed of [3, 11]) {
    const S = structure(F, 24, 30, seed); S.massScale = F.masses.scale;
    cells.push({ src: paint(S, F, { ppm: 14 }), cap: `${id} · seed ${seed} · 24 × 30 m` });
    if (seed === 3) cells.push({ src: paint(S, F, { ppm: 72, x0: 9, y0: 13, cw: 5, ch: 6 }), cap: 'the same cliff, a 5 × 6 m crop' });
  }
  rows.push({ id, title: F.title, cells, ms: Date.now() - t0 });
  console.log(`${id} ${Date.now() - t0} ms`);
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}img{display:block;height:400px}h3{margin:6px 0;font-weight:500}</style>
<div>cliffs generated by erosion: beds of their own hardness, joints through units, blocks that fall when undercut, weathering</div>
${rows.map((r) => `<h3>${r.title}</h3><div class=r>${r.cells.map((c) => `<figure style="margin:0"><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
const name = only ? `cliffs-${only}` : 'cliffs';
mkdirSync(path.join(outDir, 'cliffs'), { recursive: true });
for (const r of rows) r.cells.forEach((c, i) => writeFileSync(path.join(outDir, 'cliffs', `${r.id}-${i}.png`), Buffer.from(c.src.split(',')[1], 'base64')));
writeFileSync(path.join(outDir, `${name}.html`), page);
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await browser.newPage(); await p.setViewport({ width: 1180, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 500)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await browser.close(); }
