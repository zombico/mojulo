// The SPECIES roster: every family's species (families/*.js), each built into a ring plan by build.js. Shipped in
// core so every surface (desktop, the work box, any host) mints the same animals.
import { FAMILIES, FAMILY_SPECIES } from './families.js';
import { buildFauna, mergeParams } from './build.js';

export const SPECIES = FAMILY_SPECIES;

/** The resolved parameters of a species (its family's tables with the species' numbers over them). */
export function speciesParams(id) {
  const s = SPECIES[id]; if (!s) return null;
  const f = FAMILIES[s.family]; if (!f) throw new Error(`species '${id}': unknown family '${s.family}'`);
  return mergeParams(f, s);
}

/** A species' ring plan, freshly built (a new object on every call). */
export function speciesPlan(id) {
  const p = speciesParams(id); return p ? buildFauna(p) : null;
}

/** How a species stands, said plainly: from its pose and its legs (a fish swims, a snake has none, a bird stands on two). */
export function stanceOf(id) {
  const p = speciesParams(id); if (!p) return null;
  if (p.pose === 'swim') return 'swims';
  if (!(p.legs || []).length) return 'legless';
  if (p.family === 'avian') return 'two legs (a bird)';
  if (p.family === 'macropod') return 'upright on its hind legs and tail';
  if (p.family === 'chiropteran') return 'crawling on folded wings';
  return 'four legs';
}
