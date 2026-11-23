/**
 * REBEL STORM / RISE OF EMPIRE — the cockpit space-combat rail's starter: a war flown mission by mission from a
 * starfighter's cockpit, in the register of the 90s space-combat sims (combat first, the campaign linear). One rail, two
 * campaigns from the two sides of one war: Rebel Storm the rebels', Rise of Empire the empire's (to come, on the same
 * words). Each mission a level: its airspace a sector of space, flown from the cockpit (airspace `cockpit: true`), its
 * goal a sortie (flight-sortie.js): flight groups and the goals over them.
 *
 *   mission-1  Patrol      Red flight meets a patrol of fighters; interceptors jump in once they are down
 *   mission-2  Convoy      transports wait at a rendezvous; raiders come, then bombers jump in on them
 *   mission-3  Strike      gunboats under an interceptor screen, destroyed before they get away
 *
 * The player flies the strike foil, its wingmen beside it; the empire's craft are the shelf's twin-panel fighter, its
 * dagger interceptor, its twin-pod bomber and its heavy fighter.
 *
 *   REBEL_STORM            the side's craft
 *   MISSIONS               the missions, in order: { id, name, brief, sortie }
 *   rebelStormStart(world) → { world }: the rail's starter, its opening tour under what the creator wrote
 *
 * Pure: the same campaign lays the same missions.
 */

export const REBEL_STORM = Object.freeze({ airframe: 'strikeFoil', side: 'rebels' });

const SECTOR = Object.freeze({ map: Object.freeze({ craft: 'fighter', field: 6000 }), space: Object.freeze({ asteroids: 'sparse' }) });

export const MISSIONS = Object.freeze([
  Object.freeze({
    id: 'mission-1', name: 'Patrol',
    brief: 'Red flight on patrol at the edge of the sector. A patrol of fighters is inbound: break it up. Expect more.',
    sortie: {
      groups: [
        { id: 'red', name: 'Red', side: 'friend', count: 2 },
        { id: 'fighter', name: 'Fighter', side: 'foe', craft: 'twinPanel', count: 4 },
        { id: 'interceptor', name: 'Interceptor', side: 'foe', craft: 'daggerInterceptor', count: 3, hull: 4, arrive: { down: 'fighter', after: 3, say: 'Interceptors jumping in' } },
      ],
      goals: [{ destroy: ['fighter', 'interceptor'], say: 'The patrol is broken' }],
    },
  }),
  Object.freeze({
    id: 'mission-2', name: 'Convoy',
    brief: 'Two transports wait at the rendezvous. Raiders will come for them, and bombers after. The transports must not be lost.',
    sortie: {
      groups: [
        { id: 'convoy', name: 'Transport', side: 'friend', craft: 'starliner', count: 2, hull: 24, hold: true, at: { ahead: 300, side: 0, up: 0 } },
        { id: 'red', name: 'Red', side: 'friend', count: 1 },
        { id: 'raider', name: 'Raider', side: 'foe', craft: 'twinPanel', count: 3 },
        { id: 'bomber', name: 'Bomber', side: 'foe', craft: 'twinPodBomber', count: 3, hull: 5, arrive: { after: 25, say: 'Bombers jumping in on the convoy' }, at: { ahead: 900, side: 200, up: 80 } },
      ],
      goals: [{ protect: 'convoy', say: 'The convoy is lost' }, { destroy: 'bomber', say: 'The bombers are down' }],
    },
  }),
  Object.freeze({
    id: 'mission-3', name: 'Strike',
    brief: 'Two gunboats are running for the jump point under an interceptor screen. Get through the screen and stop them.',
    sortie: {
      groups: [
        { id: 'red', name: 'Red', side: 'friend', count: 2 },
        { id: 'gunboat', name: 'Gunboat', side: 'foe', craft: 'heavyFighter', count: 2, hull: 8, shields: true, at: { ahead: 2200, side: 0, up: 0 } },
        { id: 'screen', name: 'Interceptor', side: 'foe', craft: 'daggerInterceptor', count: 3, at: { ahead: 1400, side: 0, up: 40 } },
      ],
      goals: [{ destroy: 'gunboat', say: 'Both gunboats destroyed' }],
    },
  }),
]);

/** A mission as a gameworld level: a sector of space flown from the cockpit, its goal the sortie. */
export function missionLevel(M) {
  return { name: M.name, airspace: { ...JSON.parse(JSON.stringify(SECTOR)), airframe: REBEL_STORM.airframe, cockpit: true }, goal: { flight: { sortie: JSON.parse(JSON.stringify(M.sortie)) } } };
}

/** The rail's starter: its opening tour, under what the creator wrote (every key they wrote wins). */
export function rebelStormStart(world, { missions = MISSIONS.length } = {}) {
  const levels = Object.fromEntries(MISSIONS.slice(0, missions).map((M) => [M.id, missionLevel(M)]));
  return { world: { mode: 'autonomous', style: { kit: 'trail-valley' }, start: MISSIONS[0].id, ...world, levels } };
}
