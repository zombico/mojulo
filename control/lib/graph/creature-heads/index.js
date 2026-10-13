/**
 * THE CREATURE HEAD LIBRARY: detailed heads as plan data (schema `layered-head-v1`, interpreted by
 * polygonizer/station-loft-head.js `headFromPlan`), one JSON file each under heads/, worn by a ring plan through
 * `heads: [{ name, plan, expression, on }]`. A head is a card, not code: a new species' head is a new file, usually
 * re-drawn from the nearest one (the wolf is the bear's mammal skull with a stop and a long muzzle), so its regions,
 * skin maps and expressions keep their addresses.
 *
 *   HEAD_LIBRARY      id → { file, reads, family, head (the creature loop's THESIS head word), serves, from? }
 *   headPlan(id, { palette? })   a fresh copy of the head plan; `palette` (group → '#rrggbb') over the head's own,
 *                                which is a neutral reading of the species (a character's colours are its own)
 *   headFor(lineage)  the library head that serves a people, or null
 *
 * `serves` names the egocube lineages (egocube/ancestry.js) a head is drawn for; `provisional` ones borrow the nearest
 * head until their own is drawn (a feline wears the wolf's skull for now), and say so.
 */
import { readFileSync } from 'node:fs';

export const HEAD_LIBRARY = Object.freeze({
  dragon: { file: 'dragon.head.json', reads: 'a dragon: a long snout, teeth showing, a forked tongue, swept horns, a crest', family: 'reptile', head: 'long snout', serves: ['draconic'] },
  bear: { file: 'bear.head.json', reads: 'a bear: a broad skull, small round ears, a heavy muzzle, a cheek ruff', family: 'mammal', head: 'short muzzle', serves: ['ursine'] },
  wolf: { file: 'wolf.head.json', reads: 'a wolf: a narrow skull, a stop at the brow, a long muzzle, tall pointed ears', family: 'mammal', head: 'long muzzle', serves: ['lupine'], provisional: ['feline'], from: 'bear' },
});
export const HEAD_IDS = Object.freeze(Object.keys(HEAD_LIBRARY));

const cache = new Map();
const HEX = /^#[0-9a-f]{6}$/i;

export function headPlan(id, { palette } = {}) {
  const entry = HEAD_LIBRARY[id];
  if (!entry) throw new Error(`creature heads: unknown head '${id}' (have ${HEAD_IDS.join(', ')})`);
  if (!cache.has(id)) cache.set(id, readFileSync(new URL(`./heads/${entry.file}`, import.meta.url), 'utf8'));
  const plan = JSON.parse(cache.get(id));
  if (palette) {
    for (const [g, v] of Object.entries(palette)) if (!HEX.test(v)) throw new Error(`creature heads: palette.${g} must be a "#rrggbb" colour`);
    plan.palette = { ...plan.palette, ...palette };
  }
  return plan;
}

/** The library head for a lineage: { id, provisional } or null. */
export function headFor(lineage) {
  for (const [id, e] of Object.entries(HEAD_LIBRARY)) if (e.serves.includes(lineage)) return { id, provisional: false };
  for (const [id, e] of Object.entries(HEAD_LIBRARY)) if (e.provisional?.includes(lineage)) return { id, provisional: true };
  return null;
}
