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
 *   directSpec(spec, id)       → the spec a direction makes of a palette's spec (its seed and character kept)
 *
 * Pure data and one function. The solver's output for a spec is unchanged: a direction only writes a spec.
 */
import { PALETTE_SCRIPTS } from './solve.js';

/** The chroma ceiling a quiet land is held under (the spec's `activity`), and the bands its values are grouped into. */
export const QUIET = Object.freeze({ activity: -0.45, groups: 3 });

export const COLOUR_DIRECTIONS = Object.freeze({
  'quiet-land': Object.freeze({
    name: 'Quiet land, loud figures',
    says: 'the land grouped into three bands of value and taken down in chroma; colour is spent on who matters',
    why: 'a game read through its cast: the eye finds a figure by its colour when the land holds none of its own',
    move: (spec) => ({ ...spec, activity: Math.min(spec.activity ?? 0, QUIET.activity), values: { groups: QUIET.groups, ...(spec.values?.of ? { of: spec.values.of } : {}) } }),
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

export function directSpec(spec, id) {
  const D = COLOUR_DIRECTIONS[id];
  if (!D) throw new Error(`colour direction: '${id}' is not one (${COLOUR_DIRECTION_IDS.join(', ')})`);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('colour direction: a direction moves a palette spec (an object: color-theorist/solve.js)');
  return D.move(spec);
}
