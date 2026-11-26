/**
 * deskwork card — an office shift as a SHOVELS & BUCKETS card (worksim/card.js), so its tickets come as a work sim's
 * orders do and its difficulty is tuned by the work sim's solver, never by hand. A ticket is an order; its steps are
 * stations whose seconds are what a player takes over them (a question to work out is shovel work; a folder, a cover
 * sheet or an address picked is bucket work); switching tabs is the travel. The three kinds of ticket are the orders:
 *
 *   invoice    extract (shovel: read the invoice, work out its total or its PO) → file (bucket: the folder the
 *              policies say)
 *   decision   recommend (shovel: the vendor that meets every constraint of the request)
 *   tps        tally (shovel: the week's count) → cover (bucket: the sheet the latest memo names) → send (bucket: where
 *              the policies route it)
 *
 * RANK is the challenge (worksim/solve.js targetOf): a Temp is measured as a beginner (an even beat, time to spare), a
 * Vice President of Associates as an advanced player (rushes, little more time than it takes). More rank, more work.
 * Every kind of ticket comes at every rank (the solver's beat and rushes kept, its mix not), and a ticket's patience
 * eases from PATIENCE's most to its least as the rank climbs.
 *
 *   OFFICE                      the card
 *   challengeOf(rank)           → 0 … 1
 *   deskSchedule(rank, seed)    → [{ at, kind, patience }]: one shift's tickets (deskwork/core.js newGame's schedule)
 *   deskSchedules(seed)         → a schedule for each rank (deskwork/core.js RANKS): what a level's desk carries, the
 *                                 page picking by the player's rank
 *
 * Node only (the solver and the simulator are not inlined into a page; their output is).
 */
import { solve } from '../worksim/solve.js';
import { arrivalsOf } from '../worksim/sim.js';
import { RANKS, TIME } from './core.js';

export const OFFICE = Object.freeze({
  id: 'office', name: 'An office shift',
  why: 'working out an invoice, a recommendation or a tally is shovel work, filing and routing bucket work; switching tabs is the walk between stations',
  crew: { workers: 1, travel: 1 },
  stations: {
    extract: { verb: 'shovel', takes: { invoice: 1 }, gives: { data: 1 }, work: 8 },
    file: { verb: 'bucket', takes: { data: 1 }, gives: { filed: 1 }, work: 3 },
    recommend: { verb: 'shovel', takes: { memo: 1 }, gives: { recommendation: 1 }, work: 12 },
    tally: { verb: 'shovel', takes: { events: 1 }, gives: { tally: 1 }, work: 8 },
    cover: { verb: 'bucket', takes: { tally: 1, 'cover-sheet': 1 }, gives: { covered: 1 }, work: 3 },
    send: { verb: 'bucket', takes: { covered: 1 }, gives: { report: 1 }, work: 2 },
  },
  demand: {
    mode: 'orders', every: 20, patience: 60, serve: 0.5,
    orders: [{ name: 'invoice', wants: { filed: 1 }, weight: 3 }, { name: 'decision', wants: { recommendation: 1 }, weight: 2 }, { name: 'tps', wants: { report: 1 }, weight: 2 }],
  },
  session: TIME,
});

// the seconds a ticket waits, at the least and the most (a shift is TIME)
export const PATIENCE = Object.freeze([40, 90]);
export const challengeOf = (rank) => Math.max(0, Math.min(1, (rank | 0) / (RANKS.length - 1)));

const MEMO = new Map();
/** One shift's tickets at a rank: the card solved to the rank's challenge, its arrivals on the seed. */
export function deskSchedule(rank, seed = 1) {
  const key = `${rank}|${seed}`;
  if (MEMO.has(key)) return MEMO.get(key);
  const { card } = solve(JSON.parse(JSON.stringify(OFFICE)), challengeOf(rank), { seeds: [1, 2], rounds: 4 });
  // (its beat and its rushes as solved; every kind of ticket at every rank, the three tasks being the job; a ticket's
  // patience by the rank, from PATIENCE's most to its least, so more rank is never more time)
  const dealt = { ...card, demand: { ...card.demand, orders: OFFICE.demand.orders.map((o) => ({ ...o })) } };
  const names = dealt.demand.orders.map((o) => o.name), patience = Math.round(PATIENCE[1] + (PATIENCE[0] - PATIENCE[1]) * challengeOf(rank));
  const out = arrivalsOf(dealt, seed).map((a) => ({ at: Math.round(a.at * 10) / 10, kind: names[a.order], patience }));
  MEMO.set(key, out);
  return out;
}

export const deskSchedules = (seed = 1) => RANKS.map((_, r) => deskSchedule(r, seed));
