/**
 * brawl playthrough — a street played by a scripted player on the room the page steps (brawl-practice.js streetRoomOf:
 * the same sim, the same readers, the same stakes), so whether a street can be won is measured, not assumed. The
 * machine gate behind a street level; nobody has looked: the eyes gate stays the operator's.
 *
 * THE PLAYERS (buttons only, never outcome: what a person at the stick could do, read from what is on the street):
 *   basic   walks on down the street until a foe stands; then steps onto the nearest one's line across the street,
 *           closes to its reach and presses attack at a person's pace (a press, a few frames held, a few let go), the
 *           reader's buffer and chain taking them; on a run & gun it lines up and holds fire down the street. No strong
 *           blow, no special, no jump, no roll, no grenade: the floor of play, not its ceiling
 *   still   holds nothing: a street a player who does nothing wins has no fight on it
 * Every seat is played the same way (a street's players are one to four).
 *
 *   PLAYERS                       the players' ids
 *   playStreet(yard, { player?, seconds? }) → { player, outcome: 'won' | 'lost' | null, won, frames, seconds, falls,
 *                                 stakes, stops: { cleared, of }, boss: null | { name, down }, struck, landed, reason }
 *     yard   the page's brawl data (brawl-page.js brawlYardData: its belt, roster, players, street, stakes, range)
 *   streetSummary(R)              → one line a report reads
 *
 * Deterministic: the sim's fixed step, the player a pure function of what it sees.
 */
import { streetRoomOf, stepYard } from './brawl-practice.js';

export const PLAYERS = Object.freeze(['basic', 'still']);
// a person's pace: a press held four frames, let go six
const HOLD = 4, EVERY = 10;
// (how near its line a body must be before it swings, mm across the street; the reach it closes to, mm along it)
const ON_LINE = 150, CLOSE = 750, GUN_LINE = 220;

/** The room a level's page builds from its brawl data, as the client builds it (brawl-yard.client.js build). */
function roomOf(yard) {
  if (!yard?.street) throw new Error('brawl: a playthrough plays a street (the level\'s brawl has none)');
  const range = yard.range ? { range: { guns: yard.range.guns, grenades: yard.range.grenades } } : {};
  return streetRoomOf({ belt: yard.belt, players: yard.players.map((i) => ({ recipe: yard.roster[i].recipe, style: yard.roster[i].style })), waves: yard.street.waves, things: yard.things, stakes: yard.stakes || 3, ...range, ...(yard.tune ? { tune: yard.tune } : {}) });
}

/** One seat's buttons this frame, from what it sees. */
function basicButtons(room, i, f) {
  const me = room.s.bodies[i];
  if (me.ko) return {};
  const foes = room.s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko);
  if (!foes.length) return { x: 1 };
  // (the nearest standing foe, across the street first: a blow or a round lands only on its line)
  const t = foes.reduce((a, b) => (Math.abs(b.x - me.x) + 2 * Math.abs(b.z - me.z) < Math.abs(a.x - me.x) + 2 * Math.abs(a.z - me.z) ? b : a));
  const dz = t.z - me.z, dx = t.x - me.x;
  if (room.yard.range) return Math.abs(dz) > GUN_LINE ? { z: Math.sign(dz) } : { a: true, h: true, x: Math.sign(dx) || 1 };
  if (Math.abs(dz) > ON_LINE) return { z: Math.sign(dz), ...(Math.abs(dx) > CLOSE ? { x: Math.sign(dx) } : {}) };
  if (Math.abs(dx) > CLOSE) return { x: Math.sign(dx) };
  // (in reach and on its line: facing it, a press at a person's pace)
  return { x: Math.sign(dx) || me.face, ...((f + i * 3) % EVERY < HOLD ? { a: true } : {}) };
}

/** A street played to its end, or to the clock. */
export function playStreet(yard, { player = 'basic', seconds = 240 } = {}) {
  if (!PLAYERS.includes(player)) throw new Error(`brawl: a playthrough's player is one of ${PLAYERS.join(', ')}`);
  let room = roomOf(yard);
  const P = room.yard.players, limit = Math.round(seconds * 60);
  let struck = 0, landed = 0, cleared = 0, boss = null;
  for (let f = 0; f < limit && !room.yard.over; f++) {
    const buttons = Array.from({ length: P }, (_, i) => (player === 'still' ? {} : basicButtons(room, i, f)));
    room = stepYard(room, buttons);
    for (const e of room.s.events) {
      if (e.t === 'hit' && e.d !== undefined && e.d < P) struck++;
      if (e.t === 'hit' && e.p !== undefined && e.p < P) landed++;
      if (e.t === 'cleared') cleared++;
      if (e.t === 'boss') boss = { name: e.name, down: false };
      if (e.t === 'stageClear' && boss) boss.down = true;
    }
  }
  const over = room.yard.over, of = room.mind.waves.length;
  return {
    player, outcome: over, won: over === 'won', frames: room.s.f, seconds: Math.round(room.s.f / 6) / 10, falls: room.yard.falls, stakes: room.yard.stakes,
    stops: { cleared, of }, boss, struck, landed,
    reason: over === 'won' ? 'the last wave fell' : over === 'lost' ? `fell ${room.yard.falls} times, the last one allowed` : `the clock ran out at stop ${Math.min(of, room.mind.wave + 1)} of ${of}`,
  };
}

/** One line a report reads. */
export function streetSummary(R) {
  return `${R.player}: ${R.won ? 'won' : R.outcome === 'lost' ? 'lost' : 'not ended'} in ${R.seconds} s (${R.reason}); ${R.stops.cleared} of ${R.stops.of} stops cleared, ${R.falls} of ${R.stakes} falls, ${R.landed} blows landed, ${R.struck} taken${R.boss ? `; boss ${R.boss.name} ${R.boss.down ? 'down' : 'standing'}` : ''}`;
}
