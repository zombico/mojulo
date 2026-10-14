// The species a test runs, one per distinct procedure, the first of each in roster order: the concept, not the catalog
// (CLAUDE.md, test tiers). A new species is covered by the family that builds it, the rig and footfall patterns it
// moves by, and the habits its behaviors resolve from.
import { SPECIES } from './species.js';
import { locomotionFor } from './locomotion/index.js';
import { BEHAVIORS, tagsOf } from './behavior/index.js';
import { posable } from './behavior/pose.js';

/** The first species of each group `key` sorts the roster into. */
export function onePer(key) {
  const seen = new Map();
  for (const id of Object.keys(SPECIES)) { const k = key(id); if (!seen.has(k)) seen.set(k, id); }
  return [...seen.values()];
}

const family = (id) => SPECIES[id].family;

/** One species per family: each family's tables build its bodies. */
export const PER_FAMILY = onePer(family);
/** One species per rig topology: each rig is its own skin and limb chain. */
export const PER_RIG = onePer((id) => locomotionFor(family(id), id).rig);
/** One species per family and habit set: between them, every behavior strategy a body can resolve to. */
export const PER_HABIT = onePer((id) => `${family(id)}:${[...tagsOf(family(id), id)].sort()}`);

/** One `[species, gait, pattern]` per footfall, stroke or body-wave pattern: each pattern is its own solve. */
export const PER_PATTERN = (() => {
  const seen = new Map();
  for (const id of Object.keys(SPECIES)) for (const [g, { pattern }] of Object.entries(locomotionFor(family(id), id).gaits)) if (!seen.has(pattern)) seen.set(pattern, [id, g, pattern]);
  return [...seen.values()];
})();

/** One `[species, behavior]` per posed strategy (built on demand: resolving a strategy builds the skeleton). */
export function perStrategy() {
  const seen = new Map();
  for (const id of PER_HABIT) for (const b of Object.keys(BEHAVIORS)) {
    const p = posable(id, b), k = `${b}.${p.strategy}`;
    if (p.ok && !seen.has(k)) seen.set(k, [id, b]);
  }
  return [...seen.values()];
}
