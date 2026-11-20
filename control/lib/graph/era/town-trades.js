/**
 * A TOWN'S TRADES: what a lot is kept for beyond its shape (a JRPG's inn, its temple, its smithy). A street's `enter` may
 * name one where it names a use (era/stage-buildings.js streetLots): the first lot it may stand on (`on`, in order), its
 * door and its inside the trade's program (era/programs.js), its keeper the trade's (folk/roles.js ROOTS). The lot keeps
 * its shape, so the street is drawn as it was; only who keeps it and what is inside change. A new trade is a row.
 *
 *   TOWN_TRADES[id] = { reads, on: [lot uses, in order], inside: program use }
 *   usedAs(lot)     → the program a lot is walked as: its trade's inside, else its own use
 *
 * Pure and import-free.
 */
export const TOWN_TRADES = Object.freeze({
  inn: Object.freeze({ reads: 'a house letting beds over a taproom: the party rests here', on: Object.freeze(['shop', 'dwelling']), inside: 'tavern' }),
  temple: Object.freeze({ reads: 'the town\'s temple: a nave, its sanctuary, the priest who tends it', on: Object.freeze(['hall', 'tower', 'dwelling']), inside: 'temple' }),
  smithy: Object.freeze({ reads: 'a forge behind a wide door: the smith at the work floor', on: Object.freeze(['workshop', 'barn']), inside: 'workshop' }),
});
export const TOWN_TRADE_IDS = Object.freeze(Object.keys(TOWN_TRADES));

export const usedAs = (lot) => (lot && lot.trade && TOWN_TRADES[lot.trade] ? TOWN_TRADES[lot.trade].inside : lot.use);
