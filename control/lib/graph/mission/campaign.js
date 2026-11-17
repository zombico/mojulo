/**
 * A CAMPAIGN'S OPENING MISSION — the first level of a shooter's campaign as its makers have long laid it: not one map but
 * a run of places, each a beat of one loop, each a level of its own so that falling in one sends a body back to its
 * start and no further (a leg is a checkpoint). Read off the opening missions of the genre's campaigns, the loop is:
 *
 *   an order is given · a body moves to it · a fight · the way on opens · the game is kept
 *
 * and round it, in order, seven BEATS. Each is built from what the world already has: a mission's sections
 * (sections.js: one task each, the way on sealed until it is met), the ground the arena's laws grow or read
 * (arena-map/: a grown map, a town's street, a building, an industrial yard), and the level played as a turn
 * (game/turn.js: its briefing before, its debrief after, a scene at its start or its end where the story has one).
 *
 *   BEATS                      the seven, each what it is for and what builds it
 *   OPENING                    the legs of the default opening mission: each its beats, its place, its sections
 *   openingMission(G, { id?, name?, building? }) → { legs: [{ id, level, name, beats, place, says }], levels: { <id>:
 *                              level spec }, patch: [{ op: 'set', path, value }] } the legs as a world's levels, in the
 *                              order they are played (a linear world's levels unlock each other in that order)
 *
 * Every leg is fought with a squadmate at the pilot's shoulder (`mission.squad`), as the genre's openings are: someone
 * who knows the way goes with you.
 *
 * A leg with a place the world cannot build is left out and said (`building`: the core building the kit's band asks
 * for, gameworld/mission-building.js; none, no leg indoors). Pure.
 */
export const BEATS = Object.freeze({
  'cold-open': Object.freeze({ says: 'where you are and who is speaking: control held, then given', built: 'the turn\'s start scene where the story has one; else the leg\'s briefing' }),
  'kit-check': Object.freeze({ says: 'the body and the kit in a safe place: look, walk, take the rounds; nobody fires back', built: 'the staging section' }),
  insertion: Object.freeze({ says: 'the safe place ends: a way out, and the next place is not safe', built: 'the leg\'s way out and the next leg\'s start' }),
  'first-contact': Object.freeze({ says: 'few foes, on your terms: cover before you, the fight at the near band', built: 'the contact section' }),
  push: Object.freeze({ says: 'bounds up a street or through rooms: move, clear, move; harder as it goes', built: 'the lane section on a street; a building\'s rooms' }),
  'set-piece': Object.freeze({ says: 'one place held against waves on a clock: everything at once', built: 'the holdout section' }),
  'run-out': Object.freeze({ says: 'the way out, and the breath after', built: 'the extract section; the turn\'s debrief' }),
});
export const BEAT_IDS = Object.freeze(Object.keys(BEATS));

/** The default opening mission's legs (see the header). `level`: the leg as a world's level, less its name. */
export const OPENING = Object.freeze([
  Object.freeze({ id: 'yard', name: 'The staging yard', beats: ['cold-open', 'kit-check', 'first-contact', 'insertion'], place: 'three rooms in a row, grown under the arena\'s laws', says: 'gear up, then the first of them',
    level: () => ({ mission: { sections: ['staging', 'contact', 'extract'], map: 'three-rooms', squad: 1 } }) }),
  Object.freeze({ id: 'street', name: 'The street', beats: ['push'], place: 'a town\'s main street, cut and grown', says: 'push up the street to the works',
    level: () => ({ mission: { sections: ['lane', 'extract'], map: { town: { segment: 'main-street' } }, squad: 1 } }) }),
  Object.freeze({ id: 'inside', name: 'The building', beats: ['push'], place: 'a building designed as a fighting map', says: 'clear it, room by room', needs: 'building',
    level: ({ building }) => ({ building: { use: building, fight: true }, mission: { squad: 1 } }) }),
  Object.freeze({ id: 'works', name: 'The works', beats: ['first-contact', 'push', 'set-piece', 'run-out'], place: 'an industrial yard, a tower in it', says: 'take the works, hold the yard, then get out',
    // (an industrial level's yard is its map and its design places the phases: its mission is the whole one, resupply first)
    level: () => ({ industrial: true, mission: { squad: 1 } }) }),
]);

/** The opening mission as a world's levels (see the header). */
export function openingMission(G = null, { id = 'm1', name = 'Opening mission', building = null } = {}) {
  const legs = OPENING.filter((L) => !L.needs || (L.needs === 'building' && building)), left = OPENING.filter((L) => !legs.includes(L)).map((L) => ({ id: L.id, why: `no ${L.needs} this world's kit asks for` }));
  const out = legs.map((L, k) => ({ id: L.id, level: `${id}-${k + 1}-${L.id}`, name: `${name} · ${k + 1}/${legs.length} · ${L.name}`, beats: L.beats.slice(), place: L.place, says: L.says, spec: L.level({ building }) }));
  const levels = Object.fromEntries(out.map((L) => [L.level, { name: L.name, ...L.spec }]));
  return { legs: out.map(({ spec: _s, ...L }) => L), ...(left.length ? { left } : {}), levels, patch: out.map((L) => ({ op: 'set', path: `/levels/${L.level}`, value: levels[L.level] })) };
}
