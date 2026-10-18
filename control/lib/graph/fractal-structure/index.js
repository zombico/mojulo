/**
 * fractal-structure — towers grown from four words: a PLAN (the mandala, top-down: plan.js), a RISE (how the plan
 * shrinks, turns and is banded as it climbs), a CROWN (the ribbed disc, dome or finial that closes it) and an ECHO
 * (the whole again, smaller, against its own flanks, to a depth: a tower of towers). The principles are the North and
 * South Indian temple builders' (the turning square, the stellate plan, the stepped circle, the offset faces, the
 * parabolic curvature, the amalaka, the miniature spires), lifted off the temple to make a world's landmarks quickly.
 *
 *   structureFaces(list, { light }) → { faces, colliders, stats }   every structure in a world's `structures` list
 *   validateStructures(list)        → string[]                      the teaching errors, empty when all read
 *   readStructure(spec, at)         → the resolved words (read.js)
 *
 * Pure and deterministic: no dice but `preset: 'auto'`'s seeded streams. Manual: the `structures` view-vocab card.
 */
import { readStructure, validateStructures } from './read.js';
import { growStructure, MAX_FACES } from './grow.js';
import { grownFaces, grownColliders } from './faces.js';
import { makeLight } from '../polygonizer/vexar.js';

// a high sun from the south-west with a soft fill opposite, so the shadowed faces of a fluted plan still read
export const STRUCTURE_LIGHT = makeLight({ direction: [0.45, 0.35, -0.82], ambient: 0.5, diffuse: 0.55, fill: { diffuse: 0.16 } });

export { readStructure, validateStructures, MAX_FACES };
export { PRESETS, PRESET_IDS } from './presets.js';
export { PLAN_FORMS, planRing } from './plan.js';

export function structureFaces(list, { light = STRUCTURE_LIGHT, maxFaces = MAX_FACES } = {}) {
  if (!Array.isArray(list)) throw new Error('structures: a list of { preset?, at: [x, y, z?], size?, … }');
  const faces = [], colliders = [], stats = [];
  list.forEach((spec, i) => {
    const S = readStructure(spec, `structures[${i}]`);
    const grown = growStructure(S, { maxFaces });
    const own = grownFaces(S, grown, light);
    for (const f of own) faces.push(f);
    for (const c of grownColliders(S, grown)) colliders.push(c);
    stats.push({ id: S.id, preset: S.preset, faces: own.length, stacks: grown.stacks.length, echo: { asked: grown.asked, grown: grown.depth, ...(grown.trimmed ? { trimmed: true } : {}) } });
  });
  return { faces, colliders, stats };
}
