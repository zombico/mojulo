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
 *   MISSIONS               the missions, in order: { id, name, brief, sortie, design? }
 *   MISSION_DESIGNS        a mission designed whole (campaign/mission.js: its place, its theatre, its cast, its goals and
 *                          its briefing's steps), drawn as a holo briefing (campaign/briefing-page.js) for the person to
 *                          approve; a design's status `approved` is what lays its level from it (compileMission), a draft
 *                          leaves the mission's sortie as it was
 *   REBEL_STORM_LOOK       the look its menus and HUD are drawn in by mana-ui (the orbit card, nothing across the view)
 *   rebelStormStart(world) → { world }: the rail's starter, its opening tour under what the creator wrote
 *
 * Pure: the same campaign lays the same missions.
 */

import { readMission, compileMission } from '../campaign/mission.js';

export const REBEL_STORM = Object.freeze({ airframe: 'strikeFoil', side: 'rebels' });
// (orbit's dark glass and cyan edges, without its grid drawn across the picture: over a cockpit the grid lies on the view
// out of the canopy)
export const REBEL_STORM_LOOK = Object.freeze({ from: 'orbit', overlay: 'none' });

/**
 * The missions designed whole. Mission 1, Patrol, at Vigil Station over Kessa's fourth moon: the patrol the old sortie
 * flew, now with the station it screens, a corvette laid up at it, and the frigate whose interceptors come after the
 * patrol, told on the holo table step by step. Approved by the person on its briefing (eyes gate, theirs): its level is
 * compiled from it. Mission 2, Convoy, is designed on beacons (places the pilot is sent to, and what happens there),
 * waiting for approval.
 */
export const MISSION_DESIGNS = Object.freeze({
  'mission-1': Object.freeze({
    id: 'mission-1', name: 'Patrol', status: 'approved',
    place: { system: 'Kessa', cluster: 'Varn', station: 'Vigil', moon: 4, star: 'orange' },
    theatre: {
      field: 6000,
      moon: { kind: 'arctic', bearing: 38, elevation: 14, size: 'near' },
      station: { kind: 'outpost', at: [-300, -1100, -150], side: 'friend' },
      rocks: 'sparse',
      // (Nav 1 dead ahead: off the pilot's line the patrol turns on the wingmen first and loses to them, so a pilot who
      // flies nothing wins it: the flight proof's still pilot, design_game's run)
      nav: { nav1: { name: 'Nav 1', at: [0, 1700, 60] }, jump: { name: 'Jump point', at: [900, 2650, 260] } },
    },
    cast: [
      { id: 'red', name: 'Red', side: 'friend', craft: 'strikeFoil', count: 3, at: 'start', pilot: true },
      { id: 'kestrel', name: 'Kestrel', side: 'friend', capital: 'corvette', at: [-720, -880, -110], heading: 20 },
      { id: 'fighter', name: 'Fighter', side: 'foe', craft: 'twinPanel', count: 4, at: 'nav1' },
      { id: 'dominion', name: 'Dominion', side: 'foe', capital: 'frigate', at: [1450, 2800, 200], heading: -150 },
      { id: 'interceptor', name: 'Interceptor', side: 'foe', craft: 'daggerInterceptor', count: 3, hull: 4, at: 'jump', arrive: { down: 'fighter', after: 3, say: 'Interceptors launching from the Dominion' } },
    ],
    goals: [{ destroy: ['fighter', 'interceptor'], say: 'The patrol is broken' }],
    steps: [
      { title: 'Vigil Station', say: 'Vigil Station screens the moon\'s ice mines. The corvette Kestrel is laid up at her for repairs and cannot fight: tonight the screen is you.', show: ['station', 'kestrel'] },
      { title: 'Red Flight', say: 'You fly Red 1, with Red 2 and Red 3 on your wing. Patrol out from the station to Nav 1.', show: ['red', 'nav1'], routes: [['start', 'nav1']] },
      { title: 'The patrol', say: 'Four fighters are inbound on Nav 1, probing the screen. Break them up before they can report the Kestrel.', show: ['fighter', 'nav1', 'red'], routes: [['fighter', 'station']] },
      { title: 'The Dominion', say: 'A frigate, the Dominion, holds at the jump point. Her guns outreach yours: do not close with her.', show: ['dominion', 'jump'] },
      { title: 'Interceptors', say: 'Once her patrol is down, the Dominion will launch interceptors. Meet them before they reach Vigil.', show: ['interceptor', 'dominion', 'station'], routes: [['jump', 'station']] },
      { title: 'Your orders', say: 'Destroy the patrol, then the interceptors. Keep clear of the Dominion. Red Flight, launch when ready.', show: ['red', 'fighter', 'interceptor'] },
    ],
  }),
  // Mission 2, Convoy, redesigned on beacons: the convoy comes out of hyperspace only when Red Flight reaches the
  // rendezvous, raiders follow, then bombers; the approach beacon lights once the bombers are down. A draft.
  'mission-2': Object.freeze({
    id: 'mission-2', name: 'Convoy', status: 'draft',
    place: { system: 'Kessa', cluster: 'Varn', station: 'Harrow', moon: 2, star: 'orange' },
    theatre: {
      field: 6000,
      moon: { kind: 'barren', bearing: -55, elevation: 10, size: 'near' },
      station: { kind: 'outpost', at: [-250, -1300, -80], side: 'friend' },
      rocks: 'sparse',
      nav: { rv: { name: 'Rendezvous', at: [0, 1600, 40] } },
    },
    cast: [
      { id: 'red', name: 'Red', side: 'friend', craft: 'strikeFoil', count: 2, at: 'start', pilot: true },
      { id: 'convoy', name: 'Transport', side: 'friend', craft: 'starliner', count: 2, hull: 24, hold: true, at: 'rv', arrive: { reach: 'rendezvous', say: 'Convoy dropping out of hyperspace' } },
      { id: 'raider', name: 'Raider', side: 'foe', craft: 'twinPanel', count: 3, at: [800, 2600, 100], arrive: { reach: 'rendezvous', after: 12, say: 'Raiders inbound on the convoy' } },
      { id: 'bomber', name: 'Bomber', side: 'foe', craft: 'twinPodBomber', count: 3, hull: 5, at: [-900, 2900, 150], arrive: { down: 'raider', after: 4, say: 'Bombers jumping in' } },
    ],
    beacons: [
      { id: 'rendezvous', name: 'Rendezvous', at: 'rv', say: 'Red Flight at the rendezvous' },
      { id: 'home', name: 'Harrow approach', at: [-200, -500, 0], lit: { down: 'bomber' }, say: 'Convoy is clear. Bringing it home.' },
    ],
    goals: [{ protect: 'convoy', say: 'The convoy is lost' }, { destroy: ['raider', 'bomber'], say: 'The lane is clear' }, { reach: 'home', say: 'Convoy is home' }],
    steps: [
      { title: 'Harrow Station', say: 'Harrow Station is short of everything. Two transports are coming in through the cluster to resupply her.', show: ['station'] },
      { title: 'The rendezvous', say: 'Red Flight flies out to the rendezvous beacon. The convoy drops out of hyperspace when you get there, not before.', show: ['red', 'rendezvous'], routes: [['start', 'rendezvous']] },
      { title: 'The convoy', say: 'Two transports, holding at the rendezvous until the lane is clear. They are unarmed: you are all they have.', show: ['convoy', 'rendezvous'] },
      { title: 'Raiders', say: 'Raiders will be waiting for them, about ten seconds after the convoy arrives.', show: ['raider', 'convoy'], routes: [['raider', 'convoy']] },
      { title: 'Bombers', say: 'When the raiders go down, their bombers come next. Bombers kill transports: take them first.', show: ['bomber', 'convoy'], routes: [['bomber', 'convoy']] },
      { title: 'Harrow approach', say: 'With the bombers down, the approach beacon lights. Fly to it and the convoy follows you in.', show: ['home', 'station'], routes: [['rendezvous', 'home']] },
      { title: 'Your orders', say: 'Keep both transports alive. Destroy the raiders and the bombers. Then the approach beacon.', show: ['red', 'convoy', 'raider', 'bomber', 'home'] },
    ],
  }),
});

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

/** A mission as a gameworld level: a sector of space flown from the cockpit, its goal the sortie; a mission whose design
 *  the person approved is compiled from it (campaign/mission.js) and briefed on the holo table as its level loads
 *  (`airspace.briefing`), a draft's level stays its sortie's. */
export function missionLevel(M) {
  const D = MISSION_DESIGNS[M.id];
  if (D && D.status === 'approved') return compileMission(readMission(D), { airframe: REBEL_STORM.airframe, design: JSON.parse(JSON.stringify(D)) }).level;
  return { name: M.name, airspace: { ...JSON.parse(JSON.stringify(SECTOR)), airframe: REBEL_STORM.airframe, cockpit: true }, goal: { flight: { sortie: JSON.parse(JSON.stringify(M.sortie)) } } };
}

/** The rail's starter: its opening tour, under what the creator wrote (every key they wrote wins). */
export function rebelStormStart(world, { missions = MISSIONS.length } = {}) {
  const levels = Object.fromEntries(MISSIONS.slice(0, missions).map((M) => [M.id, missionLevel(M)]));
  // (its menus, its pause and its HUD drawn by mana-ui in the campaign's look; the creator's own `ui` wins)
  return { world: { mode: 'autonomous', style: { kit: 'trail-valley' }, ui: { theme: { ...REBEL_STORM_LOOK } }, start: MISSIONS[0].id, ...world, levels } };
}
