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
 *
 * A template whose game fights on another runtime has no action room, and the door says where its practice is
 * (practice-room.js FIGHTS_ELSEWHERE: the fighting game's own lab, the RPG's battles). The brawler's yard (brawl/
 * brawl-practice.js) joins once a world can be a brawler.
 *
 *   practiceFor(G) → { rooms: [<id>], why?: words when there is none, elsewhere?: words for a template practised elsewhere }
 *   practiceRoomOf(G, id, opts) → the room's pure build (its `manifest` and what its page says)
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

export const PRACTICE_ROOMS = Object.freeze({
  practice: { name: 'The practice room', about: 'the arsenal\'s swings, strings, weapons, guard and parry on a foe that falls and comes back' },
  platform: { name: 'The platform room', about: 'the jump, the double jump, the wall kick and the stomp on a greybox course' },
  mount: { name: 'The mount lane', about: 'the horse\'s gaits, its jump\'s clearance, the fences and the turn' },
});
// (the templates whose games ride: the action-adventure's horse; a template that rides suggests mounts)
const RIDERS = Object.freeze(['fable-of-artesia']);
const poleOf = (G) => (G?.feel != null ? readFeel(G.feel).pole : null);
const platforms = (pole) => !!pole && (POLES[pole].base === 'platformer' || POLES[pole].demo.includes('wall') || POLES[pole].demo.includes('stomp'));

/** Which rooms a world has (see the header). */
export function practiceFor(G) {
  const pole = poleOf(G), rooms = [];
  if (!roomEligible(G)) rooms.push('practice');
  if (platforms(pole)) rooms.push('platform');
  if (G?.mounts != null && G.mounts !== false) rooms.push('mount');
  const elsewhere = pole && FIGHTS_ELSEWHERE[pole] ? FIGHTS_ELSEWHERE[pole] : null;
  if (rooms.length) return { rooms, ...(elsewhere ? { elsewhere } : {}) };
  return { rooms, why: elsewhere ?? (pole ? `its feel's template (${POLES[pole].name}) has no practice room yet: it neither fights hand to hand nor platforms, and the world rides no horse` : 'this world writes no feel and rides no horse: a feel (feel: \'<template>\') or mounts open a room') };
}

/** One room's pure build. */
export function practiceRoomOf(G, id, opts = {}) {
  if (!PRACTICE_ROOMS[id]) throw new Error(`practice: room is ${Object.keys(PRACTICE_ROOMS).join(', ')}`);
  const { rooms, why } = practiceFor(G);
  if (!rooms.includes(id)) throw new Error(`practice: this world has no ${PRACTICE_ROOMS[id].name.replace(/^The /, '').toLowerCase()}${rooms.length ? ` (it has ${rooms.join(', ')})` : `: ${why}`}`);
  return id === 'practice' ? practiceRoom(G, opts) : id === 'platform' ? platformRoom(G, opts) : mountLane(G, opts);
}

/** What `mounts: 2` would lay for a world whose feel template rides and that writes no mounts, or null. */
export function mountSuggestion(G) {
  const pole = poleOf(G);
  if (!pole || !RIDERS.includes(pole) || G.mounts !== undefined) return null;
  return { suggest: 2, why: `its feel's template (${POLES[pole].name}) rides: two horses beside each walking level's spawn, and the mount lane to tune the ride` };
}
