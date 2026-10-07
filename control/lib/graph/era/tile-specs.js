/**
 * TILE SPECS — a recipe's own surface tiles. Where a kit names a preset tile family ('stone-wall-bluestone'), a recipe
 * may instead carry the numbers the tile is painted from:
 *
 *   tiles: { wall: { gen: 'stone-brick', stone: [182, 170, 148], mortar: [96, 90, 80], rows: 5, cols: 3, bevel: 0.24 } }
 *
 * The RAILS below are each generator's settings and the range each may take: a spec outside them is refused with the
 * range it broke. A spec is normalized (known keys only, in a fixed order) and its family is NAMED FROM ITS NUMBERS
 * (`gen:<generator>-<hash>`), so the same numbers are always the same four tiles, rebuilt from the recipe on every
 * read. Nothing is kept outside the recipe: edit a number with update_sketch and the tiles follow.
 */
import { defineGeneratedFamily, ROCK_STYLES, rockDnaOf, BRICK_BONDS, FRIEZE_PATTERNS } from '../landscape/surface-textures.js';

const int = (lo, hi) => ({ lo, hi, int: true });
const num = (lo, hi) => ({ lo, hi });
const RGB = { rgb: true };

/** Each generator's settings: `rgb` a colour, `lo..hi` a number (integers where `int`), `of` one of a list. */
export const TILE_RAILS = Object.freeze({
  'stone-brick': { required: ['stone', 'mortar'], keys: {
    stone: RGB, mortar: RGB, bond: { of: BRICK_BONDS }, rows: int(3, 12), cols: int(2, 12), radius: num(0, 1), shadow: num(0, 1), mortarThick: num(0.04, 0.18), vary: num(4, 44), grain: num(2, 20),
    bevel: num(0, 0.4), accent: num(0, 0.3), accentDark: num(0, 60), accentLight: num(0, 50), jointDepth: num(0, 1), grime: num(0, 1),
    chips: num(0, 1), seed: int(1, 99999) } },
  flagstone: { required: ['stone', 'mortar'], keys: {
    stone: RGB, mortar: RGB, gravel: RGB, cells: int(3, 8), mortarThick: num(0.02, 0.1), wobble: num(0, 4), vary: num(4, 40),
    grain: num(2, 24), lost: num(0, 0.2), cracked: num(0, 0.5), seed: int(1, 99999) } },
  // plain-sawn boards: earlywood↔latewood rings (ringFreq/streakFreq integers keep the tile seamless); a low warp and
  // cathedral with close early/late colours give quiet straight grain, high ones the wavy figure
  wood: { required: ['early', 'late'], keys: {
    early: RGB, late: RGB, ringFreq: int(2, 16), ringWarp: num(0, 1), ringSharp: num(0.3, 3), cathedral: num(0, 1), streakFreq: int(8, 96),
    streakAmt: num(0, 0.4), mottle: num(0, 14), period: int(1, 6), seed: int(1, 99999) } },
  // a carved band (a motif): `pattern` the figure, `ground` and `figure` its colours, `relief` how deep it reads
  frieze: { required: ['pattern', 'ground', 'figure'], keys: { pattern: { of: FRIEZE_PATTERNS }, ground: RGB, figure: RGB, relief: num(0, 1), seed: int(1, 99999) } },
  rock: { required: ['base'], keys: {
    style: { of: ROCK_STYLES }, base: RGB, amp: num(10, 120), crackFreq: num(2, 20), crackWidth: num(0.005, 0.1), crackDepth: num(0, 0.8),
    bands: int(0, 16), bandAmp: num(0, 30), speckle: num(0, 0.4), seed: int(1, 99999) } },
});
/** How a tile lies on its face (not a painting setting): metres per repeat. */
const PLACEMENT = { scale: num(0.25, 8) };

function check(v, rail, at) {
  if (rail.rgb) {
    if (!Array.isArray(v) || v.length !== 3 || !v.every((c) => Number.isInteger(c) && c >= 0 && c <= 255)) throw new Error(`${at}: a colour is [r, g, b], each an integer 0–255`);
    return v.slice();
  }
  if (rail.of) { if (!rail.of.includes(v)) throw new Error(`${at}: one of ${rail.of.join(', ')}`); return v; }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < rail.lo || v > rail.hi || (rail.int && !Number.isInteger(v))) {
    throw new Error(`${at}: ${rail.int ? 'an integer' : 'a number'} from ${rail.lo} to ${rail.hi}`);
  }
  return v;
}

/** A spec → `{ gen, params, scale? }`, its params in the rail's own order; refuses anything outside the rails. */
export function normalizeTileSpec(spec, at = 'tiles') {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`${at}: a tile spec is { gen, … } (gens: ${Object.keys(TILE_RAILS).join(', ')})`);
  const R = TILE_RAILS[spec.gen];
  if (!R) throw new Error(`${at}.gen: one of ${Object.keys(TILE_RAILS).join(', ')}`);
  for (const k of Object.keys(spec)) if (k !== 'gen' && !R.keys[k] && !PLACEMENT[k]) throw new Error(`${at}.${k}: not a ${spec.gen} setting (settings: ${[...Object.keys(R.keys), ...Object.keys(PLACEMENT)].join(', ')})`);
  for (const k of R.required) if (spec[k] === undefined) throw new Error(`${at}.${k}: required for ${spec.gen}`);
  const params = {};
  for (const [k, rail] of Object.entries(R.keys)) if (spec[k] !== undefined) params[k] = check(spec[k], rail, `${at}.${k}`);
  return { gen: spec.gen, params, ...(spec.scale !== undefined ? { scale: check(spec.scale, PLACEMENT.scale, `${at}.scale`) } : {}) };
}

// a wood spec's unset settings: quiet, straight, close-ringed grain (a recipe raises warp and cathedral for figure)
const WOOD_DNA = { ringFreq: 9, ringWarp: 0.15, ringSharp: 1.4, cathedral: 0.06, streakFreq: 64, streakAmt: 0.1, mottle: 4, period: 3 };

// FNV-1a over the normalized spec: the family's name is its numbers
const hash = (s) => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

/** Register the spec's four variants and return the family name they share. */
export function tileFamilyOf(spec, at) {
  const { gen, params } = normalizeTileSpec(spec, at);
  const name = `gen:${gen}-${hash(JSON.stringify([gen, params]))}`;
  const cfg = gen === 'rock' ? { ...rockDnaOf(params.style), ...params } : gen === 'wood' ? { ...WOOD_DNA, ...params } : params;
  defineGeneratedFamily(name, gen, cfg);
  return name;
}

/**
 * PROPORTION RAILS — the stone a room kit is built of, by the numbers: bay spacing, plinth, cornice, pilasters, ribs,
 * doorways, the nave's columns, arcade and vault. A recipe's `proportions: { column: { r: 0.42, sides: 8 } }` sets
 * any of them inside its range, over the kit's own; a kit without the part refuses it with the parts it has.
 */
export const PROPORTION_RAILS = Object.freeze({
  bay: num(3, 7),
  plinth: { h: num(0.25, 1.1), out: num(0.06, 0.35) },
  cornice: { h: num(0.2, 0.8), out: num(0.1, 0.5) },
  pilaster: { w: num(0.4, 1.1), out: num(0.12, 0.45) },
  rib: { w: num(0.25, 0.7), drop: num(0.15, 0.7) },
  door: { width: num(1.4, 3), height: num(2.4, 4.6), frame: num(0.2, 0.55) },
  torch: { every: int(1, 4) },
  column: { r: num(0.2, 0.55), sides: int(6, 16), baseH: num(0.3, 0.9) },
  arcade: { rise: num(0.6, 1.6), depth: num(0.25, 0.7) },
  vault: { rise: num(0.35, 0.9) },
});

/** A recipe's proportions over a kit: each part the kit has, each number inside its rail. Returns the kit's new numbers. */
export function proportionsOver(kit, kitId, P, allowed = Object.keys(PROPORTION_RAILS), at = 'stage: proportions') {
  if (!P || typeof P !== 'object' || Array.isArray(P)) throw new Error(`${at}: { <part>: { <number> } } (parts: ${Object.keys(PROPORTION_RAILS).join(', ')})`);
  const out = {};
  for (const [part, v] of Object.entries(P)) {
    const rail = PROPORTION_RAILS[part];
    if (!rail) throw new Error(`${at}.${part}: not a proportion (parts: ${Object.keys(PROPORTION_RAILS).join(', ')})`);
    if (kit[part] === undefined || !allowed.includes(part)) throw new Error(`${at}.${part}: kit '${kitId}' has no ${part} (its parts: ${allowed.join(', ') || 'none'})`);
    if (rail.lo !== undefined) { out[part] = check(v, rail, `${at}.${part}`); continue; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${at}.${part}: { ${Object.keys(rail).join(', ')} }`);
    const merged = { ...kit[part] };
    for (const [k, x] of Object.entries(v)) {
      if (!rail[k]) throw new Error(`${at}.${part}.${k}: not a ${part} number (numbers: ${Object.keys(rail).join(', ')})`);
      merged[k] = check(x, rail[k], `${at}.${part}.${k}`);
    }
    out[part] = merged;
  }
  return out;
}
