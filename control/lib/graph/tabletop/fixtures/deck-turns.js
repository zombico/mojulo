/**
 * A TEST FIXTURE, not a game in the book: the deck-building game of fixtures/cards.js re-expressed on the turn engine,
 * to show the engine says what the card mode says. Built from that game's own cards, not written again: a treasure is
 * a card cast for nothing whose effect gives coins; an action costs one of the turn's actions and gives cards, coins,
 * actions or buys; a card's buying price is its cost in coins; points cards are never cast and score where they lie.
 * Each turn sets one action, one buy and no coins; cast cards wait in play; cleanup discards the hand and what was
 * played and draws five, the discard reshuffled into the deck when it runs out; the supply's piles end it, and every
 * card a player owns scores. The cards that trash or gain (a choice of several cards) are left out.
 *
 *   deckTurns({ players?, seed? })
 */

import { deckGame } from './cards.js';

const skipped = (t) => (t.play || []).some((e) => e.trash || e.gain);

export function deckTurns({ players = 2, seed = 1 } = {}) {
  const D = deckGame({ players, seed }), C = D.piles, types = {}, supply = {};
  for (const [id, t] of Object.entries(C.types)) {
    if (skipped(t)) continue;
    const effects = [];
    if (t.coin) effects.push({ get: { coin: t.coin } });
    for (const e of t.play || []) {
      if (e.draw) effects.push({ draw: e.draw });
      if (e.coin) effects.push({ get: { coin: e.coin } });
      if (e.actions) effects.push({ get: { actions: e.actions } });
      if (e.buys) effects.push({ get: { buys: e.buys } });
    }
    types[id] = {
      name: t.name, colour: t.colour, price: { coin: t.cost || 0 },
      ...(t.points ? { points: t.points } : {}),
      ...(effects.length ? { do: effects, cost: t.treasure ? {} : { actions: 1 } } : {}),
    };
    if (C.supply[id] !== undefined) supply[id] = C.supply[id];
  }
  return {
    title: 'Deck building, on turns',
    seed,
    players: D.players,
    pieces: {},
    piles: { types },
    round: {
      rounds: 200,
      pools: { coin: 0, actions: 0, buys: 0 },
      decks: C.start.deck,
      hand: C.draw,
      supply,
      buy: 'buys',
      played: true,
      reshuffle: true,
      end: C.end,
      count: 'owned',
      turn: [
        { id: 'start', who: 'auto', steps: [{ refill: { pool: 'actions', to: C.actions || 1 } }, { refill: { pool: 'buys', to: C.buys || 1 } }, { refill: { pool: 'coin', to: 0 } }] },
        { id: 'main', who: 'active' },
        { id: 'cleanup', who: 'auto', steps: [{ discard: ['hand', 'play'] }, { draw: C.draw }] },
      ],
      score: [{ points: true }],
    },
  };
}
