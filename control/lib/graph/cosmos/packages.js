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
  'strategy-board': { name: 'The strategy board: spots over the ground and the tactical camera that plays them', effort: 'L' },
  shot: { name: 'The 3D shot and banter: a directed camera, subjects, a text box, two speakers', effort: 'L' },
  seats: { name: 'The seats kernel: a controller bound to each player, who join and leave', effort: 'M' },
  'battle-city': { name: 'Battle city: a contest kernel over the movement stack (a meet and a match), the court, the team, the ball and the hit', effort: 'L' },
  // the comic hero pack (10-25): the first pack of game cubes; its gaps, priced so the sweep ranks them
  'comic-look': { name: 'The comic look: a geocube look on the cel register with an ink outline, by day and by night', effort: 'M' },
  'comic-blows': { name: 'Comic blows: knockback, a thrown body or prop, the hero\'s storeys-high leap', effort: 'M' },
  'comic-street': { name: 'The breakable street: props that shatter under a blow or a thrown body', effort: 'M' },
  cape: { name: 'The cape: a garment that trails the gait and lifts in a leap', effort: 'M' },
  'comic-panel': { name: 'The comic panel: a beat held as a still with a border, a caption and an onomatopoeia', effort: 'S' },
});
