/**
 * COLOUR DIRECTIONS — the few ways a game's colour can be ORIENTED, each a move on its palette's spec (solve.js) that an
 * art director would name in a sentence, kept as rows so the same choices are offered to every game and a choice made
 * for one is made the same way for the next. A direction never picks a hue: the palette's character (its key, its heat,
 * its scheme, its hues) stays the world's own; a direction says where the VALUE and the CHROMA are spent.
 *
 *   COLOUR_DIRECTIONS          { <id>: { name, says, why, move(spec) → spec, levels? } }
 *     quiet-land               the land grouped into three bands of value and low in chroma: colour is spent on who
 *                              walks it (the figure and ground of a game played through its cast)
 *     dusk                     a colour script, day into night across the levels (PALETTE_SCRIPTS.dusk): each place its
 *                              own light, the last the darkest (`levels`: it needs two or more to travel across)
 *     kit-card                 the land given back to its kit's card: the card's own colours, as a palette the
 *                              theorist can move (cardPaletteSpec). The one direction that names hues: they are the
 *                              card's, not a pick. `needs: 'kit'`: offered only where the world's kit has a card row
 *   directSpec(spec, id, ctx?) → the spec a direction makes of a palette's spec (its seed kept); ctx: { kit }
 *   cardPaletteSpec(kit)       → a kit card's own colours as a spec, or null; CARD_CHARACTER its rows
 *
 * Pure data and one function. The solver's output for a spec is unchanged: a direction only writes a spec.
 */
import { PALETTE_SCRIPTS } from './solve.js';
import { SWATCHES } from '../era/style/swatches.js';
import { rgbToHex } from './oklab.js';

/** THE KIT CARDS a palette can be given back to: a card's CHARACTER in the theorist's terms (read off the card once, by
 * eye: a row a card), its colours the card's own, read from its swatches where they are kept (era/style/swatches.js). */
export const CARD_CHARACTER = Object.freeze({
  'isekai-meadow': Object.freeze({ intent: 'the meadow card\'s own: lime grass under a clear blue sky, violet in the shade, a red and a gold for what matters', key: 'high', heat: 0.1, weight: -0.4, activity: 0.6, scheme: 'complementary' }),
});
// the land roles a card's swatches name, and the ramp each is read from (its middle stop: what the role is locked to)
const CARD_ROLES = Object.freeze({ ground: 'grass', foliage: 'foliage', sky: 'sky', rock: 'rock', soil: 'soil', bark: 'bark', accent: 'fruit', accent2: 'gold' });
/** A kit card's own colours as a palette spec (no seed): its character, each role locked to the card's middle stop, so
 * the solve IS the card and a shift moves it as it moves any palette. null for a kit with no row. */
export function cardPaletteSpec(kit) {
  const C = CARD_CHARACTER[kit], L = SWATCHES[kit]?.land;
  if (!C || !L) return null;
  const lock = {};
  for (const [role, ramp] of Object.entries(CARD_ROLES)) if (Array.isArray(L[ramp])) lock[role] = rgbToHex(L[ramp][Math.floor(L[ramp].length / 2)]).toLowerCase();
  return { ...C, lock };
}

/** The chroma ceiling a quiet land is held under (the spec's `activity`), and the bands its values are grouped into. */
export const QUIET = Object.freeze({ activity: -0.45, groups: 3 });

export const COLOUR_DIRECTIONS = Object.freeze({
  'quiet-land': Object.freeze({
    name: 'Quiet land, loud figures',
    says: 'the land grouped into three bands of value and taken down in chroma; colour is spent on who matters',
    why: 'a game read through its cast: the eye finds a figure by its colour when the land holds none of its own',
    move: (spec) => ({ ...spec, activity: Math.min(spec.activity ?? 0, QUIET.activity), values: { groups: QUIET.groups, ...(spec.values?.of ? { of: spec.values.of } : {}) } }),
  }),
  'kit-card': Object.freeze({
    name: 'The kit card\'s own colours',
    says: 'the land in the colours its kit\'s card was painted in, held as a palette the theorist can move place by place',
    why: 'a look that was authored whole: the card\'s grass, sky and shade are one picture, and every other place can be derived from it',
    needs: 'kit',
    move: (spec, ctx = {}) => { const card = cardPaletteSpec(ctx.kit); return card ? { ...(spec.seed !== undefined ? { seed: spec.seed } : {}), ...card } : spec; },
  }),
  dusk: Object.freeze({
    name: 'A colour script across the levels',
    says: `the same palette travels ${PALETTE_SCRIPTS.dusk.says}`,
    why: 'a journey: each place has its own light, and the last one reads as the end',
    levels: 2,
    move: (spec) => ({ ...spec, script: 'dusk' }),
  }),
});
export const COLOUR_DIRECTION_IDS = Object.freeze(Object.keys(COLOUR_DIRECTIONS));

export function directSpec(spec, id, ctx = {}) {
  const D = COLOUR_DIRECTIONS[id];
  if (!D) throw new Error(`colour direction: '${id}' is not one (${COLOUR_DIRECTION_IDS.join(', ')})`);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('colour direction: a direction moves a palette spec (an object: color-theorist/solve.js)');
  return D.move(spec, ctx);
}
