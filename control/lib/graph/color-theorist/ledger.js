/**
 * THE NOVELTY LEDGER — where a palette's seed is rolled, the roll looks away from what was made lately. The solver
 * stays a function of its spec alone (its output is a compatibility promise); what sees history is only the choice of
 * seed, and only the seed is stored, so a row re-renders the same forever.
 *
 *   novelSeed(spec, { recent?, tries?, roll? }) → a seed: of `tries` rolled, the one whose palette sits farthest from
 *                                                 the nearest recent one (the first rolled when nothing is recent)
 *   nearestRecent(contract, recent?)           → { id, distance } of the recent palette nearest it, or null
 *   recentPalettes()                           → the recent palettes' signatures, from the registered source
 *   setPaletteSource(fn)                       → fn() answers the palette specs of the rows written last (the MCP
 *                                                 layer registers it: lib/graph never reads the database)
 *   palettesIn(manifest)                       → every palette spec a recipe stores, wherever it stores one
 *   signatureOf(contract), paletteDistance(a, b)
 *   rollSeed()                                 → a seed from the system's dice (authoring time only)
 */
import { randomInt } from 'node:crypto';
import { readPaletteSpec, solvePalette } from './solve.js';
import { hexToRgb, rgbToOklab } from './oklab.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const rollSeed = () => randomInt(1, 2 ** 31 - 1);
const TRIES = 8;

// what a palette looks like from across the room: the colours that cover a world, by how much of it they cover
const SIGNATURE = [['sky', 4, 3], ['ground', 2, 3], ['foliage', 2, 2], ['rock', 2, 1], ['made', 2, 1], ['accent', 2, 1.5]];
/** A palette's signature: OKLab points with weights (its sky's light end, its ground, foliage, rock, made and accent
 * middles, its HUD's bg). */
export function signatureOf(K) {
  const pts = SIGNATURE.map(([role, i, w]) => ({ lab: rgbToOklab(hexToRgb(K.roles[role][i])), w }));
  pts.push({ lab: rgbToOklab(hexToRgb(K.ui.bg)), w: 1 });
  return { id: K.id, pts };
}
/** How far apart two signatures are: the weighted mean OKLab distance of their points (0 the same; ~0.1 strangers). */
export function paletteDistance(a, b) {
  let s = 0, W = 0;
  a.pts.forEach((p, i) => { const q = b.pts[i].lab; s += p.w * Math.hypot(p.lab[0] - q[0], p.lab[1] - q[1], p.lab[2] - q[2]); W += p.w; });
  return s / W;
}

/** Every palette spec a recipe stores (a gameworld's style, a room's or a terrain's or a stage's palette, a stage's art
 * and tone, a look's), seeded and readable; anything else is passed over. */
export function palettesIn(m) {
  if (!isObj(m)) return [];
  const found = [m.style?.palette, isObj(m.palette) && m.palette.from !== undefined ? m.palette.from : m.palette, m.art?.palette?.from, m.tone?.from, m.look?.palette];
  const out = [];
  for (const v of found) {
    if (!isObj(v) || !Number.isInteger(v.seed)) continue;
    try { const s = readPaletteSpec(v); if (s && s !== 'auto') out.push(s); } catch { /* not a spec: a kit's own palette, a cover's colours */ }
  }
  return out;
}

let SOURCE = null;
/** Who answers the recent rows' palette specs (null: nothing is recent). */
export function setPaletteSource(fn) { SOURCE = typeof fn === 'function' ? fn : null; }
/** The recent palettes, as signatures (read fresh each roll: a seed is rolled rarely, and the rows are the truth). */
export function recentPalettes() {
  if (!SOURCE) return [];
  let specs = [];
  try { specs = SOURCE() ?? []; } catch { return []; }
  const seen = new Set(), out = [];
  for (const spec of specs) {
    let K;
    try { K = solvePalette(spec); } catch { continue; }
    if (seen.has(K.id)) continue;
    seen.add(K.id);
    out.push(signatureOf(K));
  }
  return out;
}

/** The recent palette nearest this one (itself, at 0, when it was written lately). */
export function nearestRecent(K, recent = recentPalettes()) {
  const me = signatureOf(K);
  let best = null;
  for (const r of recent) { const d = paletteDistance(me, r); if (!best || d < best.distance) best = { id: r.id, distance: Math.round(d * 1000) / 1000 }; }
  return best;
}

/** A seed for this spec that looks away from the recent palettes: of `tries` rolled, the farthest from its nearest. */
export function novelSeed(spec = {}, { recent = recentPalettes(), tries = TRIES, roll = rollSeed } = {}) {
  const first = roll();
  if (!recent.length) return first;
  let best = null;
  for (let i = 0; i < tries; i += 1) {
    const seed = i ? roll() : first, me = signatureOf(solvePalette({ ...spec, seed }));
    const near = Math.min(...recent.map((r) => paletteDistance(me, r)));
    if (!best || near > best.near) best = { seed, near };
  }
  return best.seed;
}
