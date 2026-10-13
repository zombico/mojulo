/**
 * cuts — how a blow breaks what it breaks: its CUT, the one word every attack carries (a swing, a round, a burst, an
 * explosion, a beam, a power). A cut is a pattern (how the thing comes apart: cleave's slice, grid or voronoi, or
 * dismantle's severed joints) and a style (how the cut looks while it happens: interceptors.js's blade, laser, anime,
 * impact), with cleave's count or cell. The same cut plays its marks on any blow that lands, breaking or not: the hit's
 * look; the pieces follow only when something breaks.
 *
 *   CUT_PATTERNS                 cleave's patterns and 'dismantle'
 *   CUT_PRESETS                  named cuts: slash, cleave, chip, shatter, blast, burn, dice, sever
 *   readCut(v, where)            → a checked cut: a preset's name, or { pattern, style, count?, cell? } (a preset's
 *                                  fields filled in under the ones given when it names one with `is`)
 *   SOURCE_CUTS                  the cut a blow deals by what dealt it: a swing, the back cleave, a round, a burst, an
 *                                  explosion; a beam by its kind (BEAM_CUTS)
 *   ELEMENT_CUTS                 the cut an element's look deals (playscape/elements LOOKS): fire burns, ice shatters,
 *                                  wind slashes, shock cleaves, dusty severs; the rest keep the source's
 *   cutOf({ thing?, blow?, element?, source, kind? }) → the cut: the thing's own (glass shatters whatever hits it), the
 *                                  blow's own, its element's, else its source's (and a beam's, its kind's)
 *
 * Tables, not code: a new element or source is a row. Pure.
 */
import { CLEAVE_PATTERNS } from './cleave.js';
import { CUT_STYLE_IDS } from './interceptors.js';

export const CUT_PATTERNS = Object.freeze([...CLEAVE_PATTERNS, 'dismantle']);

export const CUT_PRESETS = Object.freeze({
  slash: Object.freeze({ pattern: 'slice', count: 1, style: 'blade' }),     // a sword's stroke: one clean cut
  cleave: Object.freeze({ pattern: 'slice', count: 2, style: 'anime' }),    // the heavy swing: two cuts, the beat, the flash
  chip: Object.freeze({ pattern: 'voronoi', count: 3, style: 'impact' }),   // a round: a few pieces knocked off
  shatter: Object.freeze({ pattern: 'voronoi', count: 7, style: 'impact' }), // glass, ice: many shards from the hit
  blast: Object.freeze({ pattern: 'voronoi', count: 10, style: 'impact' }), // a burst: torn apart from where it went off
  burn: Object.freeze({ pattern: 'slice', count: 1, style: 'laser' }),      // a laser, fire: the score glows and cools
  dice: Object.freeze({ pattern: 'grid', count: 8, style: 'blade' }),       // a flurry: cut into blocks
  sever: Object.freeze({ pattern: 'dismantle', style: 'impact' }),          // joints give, nothing is cut
});
export const CUT_PRESET_IDS = Object.freeze(Object.keys(CUT_PRESETS));

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function readCut(v, where = 'cut') {
  if (typeof v === 'string') {
    if (!CUT_PRESETS[v]) throw new Error(`${where} is a cut's name (${CUT_PRESET_IDS.join(', ')}) or { pattern, style, count?, cell? }`);
    return { ...CUT_PRESETS[v] };
  }
  if (!isObj(v)) throw new Error(`${where} is a cut's name (${CUT_PRESET_IDS.join(', ')}) or { pattern, style, count?, cell? }`);
  for (const k of Object.keys(v)) if (!['is', 'pattern', 'style', 'count', 'cell'].includes(k)) throw new Error(`${where}.${k} is not part of a cut (is, pattern, style, count, cell)`);
  const base = v.is !== undefined ? readCut(v.is, `${where}.is`) : {};
  const out = { ...base, ...Object.fromEntries(['pattern', 'style', 'count', 'cell'].filter((k) => v[k] !== undefined).map((k) => [k, v[k]])) };
  if (!CUT_PATTERNS.includes(out.pattern)) throw new Error(`${where}.pattern is one of ${CUT_PATTERNS.join(', ')}`);
  if (!CUT_STYLE_IDS.includes(out.style)) throw new Error(`${where}.style is one of ${CUT_STYLE_IDS.join(', ')}`);
  if (out.count !== undefined && !(Number.isInteger(out.count) && out.count >= 1 && out.count <= 64)) throw new Error(`${where}.count is a whole number, 1 to 64`);
  if (out.cell !== undefined && !(Number.isFinite(out.cell) && out.cell > 0)) throw new Error(`${where}.cell is metres above 0`);
  if (out.pattern === 'slice' && out.count > 3) throw new Error(`${where}.count is 1 to 3 for a slice (cleave cuts at most three planes)`);
  return out;
}

// what dealt the blow → its cut
export const SOURCE_CUTS = Object.freeze({ swing: 'slash', back: 'cleave', round: 'chip', burst: 'blast', explosion: 'blast', beam: 'shatter', power: 'shatter', call: 'chip' });
// a beam by its kind (playscape/elements/beams.js BEAMS)
export const BEAM_CUTS = Object.freeze({ orb: 'shatter', serpent: 'slash', ray: 'burn', nova: 'blast', barrage: 'chip', braid: 'slash', laser: 'burn' });
// an element's look (playscape/elements LOOKS) → its cut; a look not here keeps the source's
export const ELEMENT_CUTS = Object.freeze({ fire: 'burn', blaze: 'burn', embers: 'burn', ice: 'shatter', frost: 'shatter', snow: 'shatter', wind: 'slash', shock: 'cleave', dusty: 'sever' });

export function cutOf({ thing, blow, element, source, kind } = {}) {
  if (thing !== undefined && thing !== null) return readCut(thing, 'thing.cut');
  if (blow !== undefined && blow !== null) return readCut(blow, 'blow.cut');
  if (element && ELEMENT_CUTS[element]) return readCut(ELEMENT_CUTS[element]);
  if (source === 'beam' && kind && BEAM_CUTS[kind]) return readCut(BEAM_CUTS[kind]);
  return readCut(SOURCE_CUTS[source] || 'chip');
}
