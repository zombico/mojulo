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
 *   asks       what the hero's KIT asks of a place it fights in (kitAsks), each move's ask with its reason; absent where
 *              the kit asks nothing (a world with no kit has the brief it had)
 *
 *   roomNeeds(G) → { size, run, jump, cover, pillars, platforms, lift, foes, work, camera, fights, why, asks? }
 *   kitAsks(G, { jump, foes }) → { <ask>: { by: [move ids], why, …its numbers } }: what each move asks of the space
 *     ring     { r }           open floor: the longest ground string's travel, the blade's reach, room for the pack
 *     air      { headroom }    a launcher's apex over a standing foe, the hero's jump where it strings in the air
 *     run-up   { length, width }   a dashing blow's travel and a foe's depth past it
 *     perch    { h }           a shooter above the blade's reach from the floor: the sidearm's to answer
 *     gap      { span }        an air dash's carry: a deck that far from a perch reaches it through the air
 *     lock     { range }       the lock's range: nothing tall between the ring and where foes come in
 *
 * Pure.
 */
import { feelCard, readFeel } from '../gameworld/feel/lower.js';
import { POLES } from '../gameworld/feel/cards.js';
import { arsenalOfGame } from '../gameworld/arsenal.js';
import { arsenalFor } from '../gameworld/combos.js';
import { workOf, tunedShift } from '../gameworld/work-room.js';

export const CROSSING = 4;
export const PLATFORM_MAX = 1.6;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;

// a standing body's height, the blade's reach from the feet, a foe's depth (metres)
const BODY_H = 1.8, REACH = 2.2, DEPTH = 1.5;
const kitOf = (G) => arsenalOfGame(G ?? {})?.arsenal ?? (G?.feel != null ? arsenalFor(G.feel)?.arsenal : null) ?? null;

/** What the hero's kit asks of a place it fights in (see the header): each ask named by the moves that ask it. */
export function kitAsks(G, { jump = 0.9, foes = 3 } = {}) {
  const A = kitOf(G), feel = G?.feel ?? null, card = feel ? feelCard(feel) : null, asks = {};
  if (A && Array.isArray(A.weapons)) {
    const moves = A.weapons.flatMap((W) => Object.entries(W.moves ?? {}).map(([id, m]) => ({ id, W, ...m })));
    const strings = A.weapons.flatMap((W) => (W.combos ?? []).map((c) => ({ ...c, W })));
    // the ring: the longest ground string's travel (its steps and lunges, never a dash), the blade's reach, the pack
    const travelOf = (c) => c.moves.reduce((s, id) => { const t = c.W.moves?.[id]?.travel; return s + (t && t.kind !== 'dash' ? t.m ?? 0 : 0); }, 0);
    const ground = strings.filter((c) => !c.air);
    if (ground.length) {
      const long = ground.reduce((a, b) => (travelOf(b) > travelOf(a) ? b : a));
      asks.ring = { r: r1(clamp(REACH + travelOf(long) + 0.4 * Math.max(1, foes), 3, 8)), by: [long.id], why: `the ${long.name ?? long.id}'s travel, the blade's reach and room for ${Math.max(1, foes)} round the hero` };
    }
    // the air: a launcher's apex over a standing foe, and the hero's own jump where a string is made in the air
    const launchers = moves.filter((m) => m.launch > 0);
    if (launchers.length) {
      const top = launchers.reduce((a, b) => (b.launch > a.launch ? b : a)), g = A.juggle?.g ?? 20, apex = (top.launch * top.launch) / (2 * g);
      const airs = strings.filter((c) => c.air);
      asks.air = { headroom: r1(apex + BODY_H + (airs.length ? jump : 0) + 0.5), by: [top.id, ...airs.map((c) => c.id)], why: `the ${top.id} throws a foe ${r1(apex)} m up${airs.length ? ', and a string is made in the air beside it' : ''}` };
    }
    // the run-up: the longest dashing blow, carried into a foe
    const dashes = moves.filter((m) => m.travel?.kind === 'dash');
    if (dashes.length) {
      const far = dashes.reduce((a, b) => (b.travel.m > a.travel.m ? b : a));
      asks['run-up'] = { length: r1(far.travel.m + DEPTH), width: 1.8, by: [far.id], why: `the ${far.id} carries ${far.travel.m} m into a foe` };
    }
    // the perch: a sidearm is answered by a foe the blade cannot reach from the floor
    if (Array.isArray(A.ranged) && A.ranged.length) asks.perch = { h: r1(Math.max(REACH + 0.2, jump + 0.9)), by: A.ranged.map((x) => x.id), why: `the ${A.ranged[0].name ?? A.ranged[0].id} answer a shooter the blade cannot reach from the floor` };
  }
  if (card) {
    const air = card.dash?.air;
    if (air && air.count > 0 && Number.isFinite(air.speed) && Number.isFinite(air.frames)) asks.gap = { span: r1((air.speed * air.frames) / 60), by: ['air-dash'], why: `an air dash carries ${r1((air.speed * air.frames) / 60)} m: a deck that far from a perch reaches it` };
    if (asks.ring && Number.isFinite(card.lock?.range)) asks.lock = { range: card.lock.range, by: ['lock'], why: 'the lock holds a foe the hero can see: nothing tall between the ring and where foes come in' };
  }
  return asks;
}

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
  const asks = fights && !work ? kitAsks(G, { jump, foes }) : {};
  return { size, run, jump, cover, pillars, platforms, lift, foes, work, camera: G?.camera ?? null, fights, why, ...(Object.keys(asks).length ? { asks } : {}) };
}
