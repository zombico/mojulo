/**
 * WORK PACKAGES: a set of registry values one change fills, so the sweep can price a change rather than a value. A
 * value names its package with `pkg`; a value without one is its own package. `effort` is a rough size, S / M / L,
 * weighed 1 / 3 / 8 when the sweep ranks lifts per unit of work. A value with no effort is unsized: the facet's owner
 * has not priced it, and the ranking lists it last.
 */
export const EFFORT_WEIGHT = Object.freeze({ S: 1, M: 3, L: 8 });

export const PACKAGES = Object.freeze({
  'mind-lift': { name: 'Lift the arena brain into a general mind', effort: 'M' },
  quests: { name: 'Quests and choices: ordered steps, a giver, a journal, the player\'s answers', effort: 'M' },
  shot: { name: 'The 3D shot and banter: a directed camera, subjects, a text box, two speakers', effort: 'L' },
});
