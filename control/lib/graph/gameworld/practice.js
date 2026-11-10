/**
 * THE PRACTICE DOOR — which practice rooms a game has, chosen by how it plays: the feel chapter's prototypes, each a
 * greybox on the runtime the game ships, built from the world alone before any level (the run's hero and foes where made,
 * stand-ins where not).
 *
 *   practice   the action room (practice-room.js): the arsenal's swings, strings, weapons, guard and parry on a foe that
 *              falls and comes back; a feel template that fights hand to hand, or any world with an arsenal
 *   platform   the platform room (platform-room.js): steps, a gap, the double jump's ledge, the wall kick's chimney, foes to
 *              stomp; a template of the platformer's (its base feel, or a wall or a stomp among its moves)
 *   mount      the mount lane (mount-lane.js): the gaits, the jump's clearance, the fences, the turn; a world with `mounts`
 *   range      the firing range (combat/range.js): the world's guns (loadout.js loadoutOf: a quick shooter's kit, the
 *              hero's carried gun, else its template's loadout) measured and played from the eye, before any level
 *   artillery  the artillery range (combat/artillery.js): the big gun on its base; a template that owns a frame
 *              (TEMPLATE_FRAMES: Mech Battle Kai's transforming biped, walking on the walker's gait, folding into its
 *              wheeled form) fires its own mounts there
 *
 * The gun rooms are a shooter's paradigm, not the melee room's: their own controls (the sights, reload, switch, a knife
 * on V; walk, transform, drive and lay the gun), their own measures and their own pages.
 * A template whose game fights on another runtime has no action room, and the door says where its practice is
 * (practice-room.js FIGHTS_ELSEWHERE: the fighting game's own lab, the RPG's battles). The brawler's yard (brawl/
 * brawl-practice.js) joins once a world can be a brawler.
 *
 *   practiceFor(G) → { rooms: [<id>], why?: words when there is none, elsewhere?: words for a template practised elsewhere }
 *   practiceRoomOf(G, id, opts) → the room's pure build (its `manifest` and what its page says; a gun room's `spec`)
 *   rangeFor(G), artilleryFor(G) → a gun room's spec (rangeOf's, artilleryOf's), or null
 *   TEMPLATE_FRAMES  { <template>: { frame, why } }: the templates whose hero is a frame of the mecha shelf
 *   mountSuggestion(G) → { suggest: 2, why } for a world whose feel template rides and that writes no mounts; else null
 *   PRACTICE_ROOMS   { <id>: { name, about } }
 *
 * Pure.
 */
import { POLES } from './feel/cards.js';
import { readFeel } from './feel/lower.js';
import { practiceRoom, roomEligible, FIGHTS_ELSEWHERE } from './practice-room.js';
import { platformRoom } from './platform-room.js';
import { mountLane } from './mount-lane.js';
import { loadoutOf } from './loadout.js';

export const PRACTICE_ROOMS = Object.freeze({
  practice: { name: 'The practice room', about: 'the arsenal\'s swings, strings, weapons, guard and parry on a foe that falls and comes back' },
  platform: { name: 'The platform room', about: 'the jump, the double jump, the wall kick and the stomp on a greybox course' },
  mount: { name: 'The mount lane', about: 'the horse\'s gaits, its jump\'s clearance, the fences and the turn' },
  range: { name: 'The firing range', about: 'the game\'s guns from the eye: rounds and seconds to drop a body at 5, 15 and 30 m, cone and climb, marks by matter, switching' },
  artillery: { name: 'The artillery range', about: 'the big gun on its base: its rounds into stands of matter at the bands, laid by hand; a frame walks, transforms and drives' },
});
/** The templates that own a frame of the mecha shelf: their hero is the machine, its bipedal motion the walker's gait
 * (mecha-shelf/mecha-gait.js) and its transform the walker's own (walker and its wheeled form). */
export const TEMPLATE_FRAMES = Object.freeze({
  'mech-battle-kai': Object.freeze({ frame: 'rover walker', why: 'a ridden biped on four wheels, armed: it walks on its gait, or folds its legs and rolls as an armoured car' }),
});
// (the templates whose games ride: the action-adventure's horse; a template that rides suggests mounts)
const RIDERS = Object.freeze(['fable-of-artesia']);
const poleOf = (G) => (G?.feel != null ? readFeel(G.feel).pole : null);
const platforms = (pole) => !!pole && (POLES[pole].base === 'platformer' || POLES[pole].demo.includes('wall') || POLES[pole].demo.includes('stomp'));

/** The artillery range's spec for a world whose template owns a frame, or null. */
export function artilleryFor(G) {
  const pole = poleOf(G), F = pole ? TEMPLATE_FRAMES[pole] : null;
  return F ? { base: { frame: F.frame }, name: G?.name ?? G?.id ?? POLES[pole].name } : null;
}
/** The firing range's spec for a world that carries guns (loadout.js), or null. */
export function rangeFor(G) {
  const L = loadoutOf(G);
  return L ? { weapons: L.weapons, ...(L.skins ? { skins: L.skins } : {}), name: G?.name ?? G?.id ?? 'game' } : null;
}

/** Which rooms a world has (see the header). */
export function practiceFor(G) {
  const pole = poleOf(G), rooms = [];
  if (!roomEligible(G)) rooms.push('practice');
  if (platforms(pole)) rooms.push('platform');
  if (G?.mounts != null && G.mounts !== false) rooms.push('mount');
  if (rangeFor(G)) rooms.push('range');
  if (artilleryFor(G)) rooms.push('artillery');
  const elsewhere = pole && FIGHTS_ELSEWHERE[pole] ? FIGHTS_ELSEWHERE[pole] : null;
  if (rooms.length) return { rooms, ...(elsewhere ? { elsewhere } : {}) };
  return { rooms, why: elsewhere ?? (pole ? `its feel's template (${POLES[pole].name}) has no practice room yet: it neither fights hand to hand, platforms nor carries a gun, and the world rides no horse` : 'this world writes no feel and rides no horse: a feel (feel: \'<template>\') or mounts open a room') };
}

/** One room's pure build. */
export function practiceRoomOf(G, id, opts = {}) {
  if (!PRACTICE_ROOMS[id]) throw new Error(`practice: room is ${Object.keys(PRACTICE_ROOMS).join(', ')}`);
  const { rooms, why } = practiceFor(G);
  if (!rooms.includes(id)) throw new Error(`practice: this world has no ${PRACTICE_ROOMS[id].name.replace(/^The /, '').toLowerCase()}${rooms.length ? ` (it has ${rooms.join(', ')})` : `: ${why}`}`);
  // (a gun room's build is its spec: the range's measures and the frame's assembly are its page's, a few seconds each)
  return id === 'practice' ? practiceRoom(G, opts) : id === 'platform' ? platformRoom(G, opts) : id === 'mount' ? mountLane(G, opts)
    : id === 'range' ? { spec: rangeFor(G) } : { spec: artilleryFor(G) };
}

/** What `mounts: 2` would lay for a world whose feel template rides and that writes no mounts, or null. */
export function mountSuggestion(G) {
  const pole = poleOf(G);
  if (!pole || !RIDERS.includes(pole) || G.mounts !== undefined) return null;
  return { suggest: 2, why: `its feel's template (${POLES[pole].name}) rides: two horses beside each walking level's spawn, and the mount lane to tune the ride` };
}
