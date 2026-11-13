/**
 * THE ROOM BRIEF — what one room must hold for a game, read from the world before anything is laid. The room is solved
 * from the game, then dressed: these are the game's numbers, not a style.
 *
 *   size       the room's side in metres: a crossing of about CROSSING seconds at the hero's run (a quick hero gets a
 *              bigger room, a slow one a smaller), never smaller than the work it holds
 *   cover      low cover to stand: a hand-to-hand fighter a little (to round and break a chase)
 *   pillars    columns: a chase turned, a line of approach broken
 *   platforms  raised decks: as many as the hero's jump makes worth having (a vantage, room for the air)
 *
 * Shooters and platformers are left out: the firing range and the platform room are their practice; the game room is
 * the room of the games that have none of their own (a fight hand to hand, a shift, a cast of foes).
 *   lift       a platform's height: what the hero's jump clears with room to spare, at most PLATFORM_MAX
 *   foes       how many stand in it: the world's count, or a few where it fights
 *   work       the shift where the world works one (work-room.js workOf): its card tuned for one player (tunedShift)
 *   camera     the world's own (overhead keeps the room low and open)
 *   why        each need's reason, in words
 *
 *   roomNeeds(G) → { size, run, jump, cover, pillars, platforms, lift, foes, work, camera, fights, why }
 *
 * Pure.
 */
import { feelCard, readFeel } from '../gameworld/feel/lower.js';
import { POLES } from '../gameworld/feel/cards.js';
import { arsenalOfGame } from '../gameworld/arsenal.js';
import { workOf, tunedShift } from '../gameworld/work-room.js';

export const CROSSING = 4;
export const PLATFORM_MAX = 1.6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;

export function roomNeeds(G) {
  const feel = G?.feel ?? null, card = feel ? feelCard(feel) : null, pole = feel ? readFeel(feel).pole : null;
  const run = card ? card.ground.run : 4.5, jump = card ? card.jump.height : 0.9;
  const fights = !!(pole && POLES[pole].demo.includes('attack')) || !!arsenalOfGame(G ?? {});
  // a shift: its card tuned for the one player a room holds (the work room's own tuning)
  const asked = workOf(G), shift = asked ? tunedShift(asked.card, asked.challenge) : null;
  const work = shift ? { card: shift.card, challenge: asked.challenge, solved: { target: shift.target.name, verdict: shift.verdict } } : null;
  const why = {};
  const size = clamp(2 * Math.round((run * CROSSING) / 2), 14, 32);
  why.size = `a crossing of about ${CROSSING} s at a run of ${run} m/s`;
  const cover = fights ? 2 : 0;
  why.cover = fights ? 'a little cover to round and break a chase' : 'nothing here fights';
  const pillars = fights ? 2 : 0;
  why.pillars = pillars ? 'a chase to turn, an approach to break' : 'nothing to turn'; 
  const lift = r1(clamp(jump * 0.8, 0.5, PLATFORM_MAX));
  const platforms = fights && jump >= 1.2 ? 2 : 0;
  why.platforms = platforms ? `a jump of ${jump} m makes a deck of ${lift} m worth climbing: a vantage, room for the air` : `the floor is the room`;
  const foes = Number.isInteger(G?.quick?.foes) ? G.quick.foes : fights ? 3 : 0;
  why.foes = foes ? `${foes} to fight` : 'no foes';
  return { size, run, jump, cover, pillars, platforms, lift, foes, work, camera: G?.camera ?? null, fights, why };
}
