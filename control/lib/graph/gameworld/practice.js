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
 *   room       the game room (game-room.js): one room composed for the game out of room primitives (gameroom/), the
 *              practice room that becomes the game's own; a world that fights hand to hand, works a shift or has foes
 *              (a shooter and a platformer have their own rooms)
 *   work       the work room (work-room.js): a work shift's card on greybox counters, played by a hero and a movement
 *              chosen from the presets (the world's hero or a stand-in; a feel template); a quick work game
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
 *   rangeMeasured(G)  → { carried, lost, worst? } the firing range's laws (combat/measure.js combatLaws) on the world's
 *                    guns, before any level; null without a range. The shooter's machine gate beside the feel's:
 *                    advice, never a refusal. A few seconds a gun, so kept by the guns it was measured on
 *   TEMPLATE_FRAMES  { <template>: { frame, why } }: the templates whose hero is a frame of the mecha shelf
 *   mountSuggestion(G) → { suggest: 2, why } for a world whose feel template rides and that writes no mounts; else null
 *   PRACTICE_ROOMS   { <id>: { name, about } }
 *
 * Pure.
 */
import { POLES } from './feel/cards.js';
import { readFeel } from './feel/lower.js';
import { practiceRoom, roomEligible, FIGHTS_ELSEWHERE } from './practice-room.js';
import { variesHits } from './sound-sheet.js';
import { platformRoom } from './platform-room.js';
import { mountLane } from './mount-lane.js';
import { loadoutOf } from './loadout.js';
import { rangeBody } from './combat/range.js';
import { measureCombat, combatLaws } from './combat/measure.js';
import { workRoom, workOf } from './work-room.js';
import { gameRoom, gameRoomOf } from './game-room.js';

export const PRACTICE_ROOMS = Object.freeze({
  practice: { name: 'The practice room', about: 'the arsenal\'s swings, strings, weapons, guard and parry on a foe that falls and comes back' },
  platform: { name: 'The platform room', about: 'the jump, the double jump, the wall kick and the stomp on a greybox course' },
  mount: { name: 'The mount lane', about: 'the horse\'s gaits, its jump\'s clearance, the fences and the turn' },
  range: { name: 'The firing range', about: 'the game\'s guns from the eye: rounds and seconds to drop a body at 5, 15 and 30 m, cone and climb, marks by matter, switching' },
  artillery: { name: 'The artillery range', about: 'the big gun on its base: its rounds into stands of matter at the bands, laid by hand; a frame walks, transforms and drives' },
  room: { name: 'The game room', about: 'one room composed for the game: its needs read from the world, laid from room primitives (cover, screens, decks, counters), held to the room laws, played by its hero with its foes on their spots' },
  work: { name: 'The work room', about: 'the shift on greybox counters: crates, stations worked by standing at them, shelves, the hand-in, by a hero and a movement chosen from the presets' },
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
  return L ? { weapons: L.weapons, ...(L.skins ? { skins: L.skins } : {}), name: G?.name ?? G?.id ?? 'game', ...(variesHits(G) ? { vary: true } : {}) } : null;
}

// the range's measures by the guns they were taken on (the same guns measure the same: a pure function, kept); a few
// worlds at a time, the oldest let go
const RANGE_KEPT = new Map(), RANGE_KEEP = 16;
/** The firing range's laws on a world's guns (see the header), or null. */
export function rangeMeasured(G) {
  const spec = rangeFor(G);
  if (!spec) return null;
  const key = JSON.stringify({ weapons: spec.weapons, skins: spec.skins ?? null });
  if (RANGE_KEPT.has(key)) return RANGE_KEPT.get(key);
  // (the guns alone: the range's body is a stand-in person, so its run is not the world's feel and is not held to it)
  const { pilot, foe } = rangeBody({ weapons: spec.weapons, ...(spec.skins ? { skins: spec.skins } : {}), quiet: true });
  const laws = combatLaws(measureCombat(pilot, foe, { camera: 'first-person' }));
  const lost = laws.filter((l) => !l.ok).map((l) => l.name);
  const out = { carried: laws.length - lost.length, lost: lost.length, ...(lost.length ? { worst: lost.slice(0, 3) } : {}) };
  RANGE_KEPT.set(key, out);
  if (RANGE_KEPT.size > RANGE_KEEP) RANGE_KEPT.delete(RANGE_KEPT.keys().next().value);
  return out;
}

/** Which rooms a world has (see the header). */
export function practiceFor(G) {
  const pole = poleOf(G), rooms = [];
  if (!roomEligible(G)) rooms.push('practice');
  if (platforms(pole)) rooms.push('platform');
  if (G?.mounts != null && G.mounts !== false) rooms.push('mount');
  if (rangeFor(G)) rooms.push('range');
  if (artilleryFor(G)) rooms.push('artillery');
  if (workOf(G)) rooms.push('work');
  if (gameRoomOf(G)) rooms.push('room');
  const elsewhere = pole && FIGHTS_ELSEWHERE[pole] ? FIGHTS_ELSEWHERE[pole] : null;
  if (rooms.length) return { rooms, ...(elsewhere ? { elsewhere } : {}) };
  return { rooms, why: elsewhere ?? (pole ? `its feel's template (${POLES[pole].name}) has no practice room yet: it neither fights hand to hand, platforms nor carries a gun, and the world rides no horse` : 'this world writes no feel, rides no horse and works no shift: a feel (feel: \'<template>\'), mounts or a work goal open a room') };
}

/** One room's pure build. */
export function practiceRoomOf(G, id, opts = {}) {
  if (!PRACTICE_ROOMS[id]) throw new Error(`practice: room is ${Object.keys(PRACTICE_ROOMS).join(', ')}`);
  const { rooms, why } = practiceFor(G);
  if (!rooms.includes(id)) throw new Error(`practice: this world has no ${PRACTICE_ROOMS[id].name.replace(/^The /, '').toLowerCase()}${rooms.length ? ` (it has ${rooms.join(', ')})` : `: ${why}`}`);
  // (a gun room's build is its spec: the range's measures and the frame's assembly are its page's, a few seconds each)
  return id === 'practice' ? practiceRoom(G, opts) : id === 'platform' ? platformRoom(G, opts) : id === 'mount' ? mountLane(G, opts)
    : id === 'range' ? { spec: rangeFor(G) } : id === 'work' ? workRoom(G, opts) : id === 'room' ? gameRoom(G, opts) : { spec: artilleryFor(G) };
}

/** What `mounts: 2` would lay for a world whose feel template rides and that writes no mounts, or null. */
export function mountSuggestion(G) {
  const pole = poleOf(G);
  if (!pole || !RIDERS.includes(pole) || G.mounts !== undefined) return null;
  return { suggest: 2, why: `its feel's template (${POLES[pole].name}) rides: two horses beside each walking level's spawn, and the mount lane to tune the ride` };
}
