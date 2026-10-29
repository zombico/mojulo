// construction/circulation — the concerns a building's paths keep, as one set of laws, and the numbers each kind of
// building keeps them by. The house flow (`mint_building`: polygonizer/floorplan-design.js) and the game's stage
// (era/storeys.js, era/program-core.js) are two builders; what they keep is the same list, the numbers are not: a house
// keeps a body's and its furniture's minima, as a tradition's codes do; a game keeps its walker's and its camera's.
//
//   CIRCULATION   the laws, by name: what each keeps
//   DESIGN_RULES  the traditions' livable numbers (feet), as the house flow reads them (floorplan-design.js `designRules`)
//   STAIR_PROFILES  the stage's stairs (metres): `keep` (a keep's or a tower's steep straight flight: the stage's own
//                 since the first storeys, kept as it was) and `game` (a building's in a game: a switchback, shallow
//                 enough for the walker's step and the camera, room at its foot and head)
//   stairProfile(name) → the profile, or throws naming the profiles
//
// Pure data: no geometry here, and nothing that refuses; each builder measures and says.

/** The laws: each a concern a building's paths keep, whatever numbers keep it. */
export const CIRCULATION = Object.freeze({
  passage: 'the free width a walkway keeps between walls, furniture and fixtures',
  door: 'a doorway\'s clear width',
  'door-approach': 'the floor kept free in front of a doorway on each side, to come through it',
  'stair-width': 'a flight\'s clear width between its balustrades',
  riser: 'a step\'s rise, at most',
  going: 'a step\'s going (its tread, nosing to nosing), at least',
  landing: 'a half landing\'s depth along the climb, at least a flight\'s width',
  'stair-foot': 'the clear floor before a stair\'s first step, where it is come to square',
  'stair-head': 'the clear floor past a stair\'s last step, where it is left',
  'stair-door': 'how far a doorway keeps from a stair\'s foot and head, so no one steps through a door onto a flight',
  headroom: 'the clear height over a flight and its landings',
  guard: 'a rail round a hole in a floor and along a flight\'s open sides, its height',
  well: 'the gap between a switchback\'s two flights',
});

const IN = 1 / 12, MM = 1 / 304.8;
/** The numbers each tradition builds to (feet): the passage a walkway keeps, a door's clear width, a stair's width,
 * its highest riser and its shallowest going. */
export const DESIGN_RULES = Object.freeze({
  'north-american': { passage: 36 * IN, door: 30 * IN, stair: { width: 36 * IN, riser: 7.75 * IN, going: 10 * IN }, units: 'in' },
  british: { passage: 900 * MM, door: 775 * MM, stair: { width: 800 * MM, riser: 220 * MM, going: 220 * MM }, units: 'mm' },
  japanese: { passage: 780 * MM, door: 700 * MM, stair: { width: 750 * MM, riser: 230 * MM, going: 150 * MM }, units: 'mm' },
  metric: { passage: 900 * MM, door: 800 * MM, stair: { width: 800 * MM, riser: 200 * MM, going: 230 * MM }, units: 'mm' },
});

/**
 * The stage's stairs, metres. `shape` straight (one flight) or switchback (two side by side, a half landing between);
 * `riser` at most and `going`; `width` a flight's; `in` its set-in from the wall; `foot` and `head` the clear floor
 * before its first step and past its last; `body` the walker's half width kept off a room's walls; `door` how deep a
 * doorway's own clear floor runs into a room (none of a stair stands in it); `guard` the rails ({ h, t }); a switchback's
 * `landing` depth and `well`.
 *   keep  a keep's or a tower's: a hand over a foot, one steep flight (era/storeys.js since its first storeys)
 *   game  a building's in a game: about 34°, a flight wide enough for two abreast and a camera behind, a switchback (a
 *         storey's rise in two short flights, the landing a turn to look back from), two metres of floor at each end and
 *         a metre and a half more between any doorway and either
 */
export const STAIR_PROFILES = Object.freeze({
  keep: Object.freeze({ shape: 'straight', riser: 0.3, going: 0.3, width: 1.6, in: 0.6, foot: 0.6, head: 1.2, body: 0.45, door: 1.2, guard: Object.freeze({ h: 1, t: 0.15 }) }),
  game: Object.freeze({ shape: 'switchback', riser: 0.2, going: 0.3, width: 2, in: 0.6, foot: 2, head: 2, body: 0.45, door: 2.7, guard: Object.freeze({ h: 1.1, t: 0.15 }), landing: 2, well: 0.4 }),
});
export const STAIR_PROFILE_IDS = Object.freeze(Object.keys(STAIR_PROFILES));

export function stairProfile(name = 'keep') {
  const p = STAIR_PROFILES[name];
  if (!p) throw new Error(`stage: stair '${name}' is not a stair profile (${STAIR_PROFILE_IDS.join(', ')})`);
  return p;
}
