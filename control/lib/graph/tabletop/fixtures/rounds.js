/**
 * TEST FIXTURES, not games in the book: round paradigms written out from the tabletop kernel's rounds, each named by
 * its principle. No board: phases, workers, pools and cards are the table.
 *
 *   workerGame({ players?, seed? })    worker placement: two workers each (up to four), eight rounds; a space holds
 *                                      one worker (the field two), gives resources, points for resources, a worker or
 *                                      the first seat; each worker eats one food a round or costs three points;
 *                                      leftover wood and stone score a little (2 players)
 *   auctionGame({ players?, seed? })   sealed bids: a lot a round, everyone bids coins at once, the highest pays and
 *                                      takes it (a tie to the first in order, the first seat passing on each round,
 *                                      nobody on all zeros); two coins each round;
 *                                      lots score their points, suits held, and coins left (2 players)
 *   passDraftGame({ players?, seed? }) drafting by passing: each round a hand dealt to everyone, a card picked at once
 *                                      from each, the hands passed on; suits, shapes and gems score (2 players)
 */

const SEATS = [
  { id: 'teal', colour: '#2a8c86' }, { id: 'plum', colour: '#7b3f73' },
  { id: 'gold', colour: '#e0b23a' }, { id: 'rust', colour: '#b5532f' },
];

export function workerGame({ players = 2, seed = 1 } = {}) {
  return {
    title: 'Worker placement',
    seed,
    players: SEATS.slice(0, players),
    pieces: { worker: { name: 'worker', shape: 'meeple', glyph: '' } },
    round: {
      rounds: 8,
      pools: { food: 2, wood: 0, stone: 0 },
      workers: { kind: 'worker', n: 2, max: 4 },
      spaces: {
        forest: { name: 'forest', gives: [{ get: { wood: 2 } }] },
        quarry: { name: 'quarry', gives: [{ get: { stone: 1 } }] },
        field: { name: 'field', holds: 2, gives: [{ get: { food: 2 } }] },
        market: { name: 'market', gives: [{ get: { wood: 1, food: 1 } }] },
        hall: { name: 'hall', gives: [{ first: true }, { get: { food: 1 } }] },
        hut: { name: 'hut', cost: { wood: 2, food: 1 }, gives: [{ worker: 1 }] },
        shrine: { name: 'shrine', cost: { wood: 1, stone: 1 }, gives: [{ points: 3 }] },
        tower: { name: 'tower', cost: { wood: 1, stone: 2 }, gives: [{ points: 5 }] },
      },
      phases: [
        { id: 'work', who: 'turns', move: 'place' },
        { id: 'feed', who: 'auto', steps: [{ upkeep: { per: 'worker', pay: { food: 1 }, short: -3 } }] },
        { id: 'home', who: 'auto', steps: [{ ready: true }] },
      ],
      score: [{ points: true }, { pools: { wood: 3, stone: 2 } }],
    },
  };
}

const SUITS = { sun: '#e0a03a', moon: '#8a93c9', star: '#d8c24a', wave: '#3f86b5', leaf: '#5c9446' };

export function auctionGame({ players = 2, seed = 1 } = {}) {
  const types = {}, deck = {};
  Object.keys(SUITS).forEach((suit) => [1, 2, 3].forEach((v) => {
    const id = `${suit}-${v}`;
    types[id] = { name: `${suit} ${v}`, points: v, tags: { suit }, colour: SUITS[suit] };
    deck[id] = 1;
  }));
  return {
    title: 'Sealed bids',
    seed,
    players: SEATS.slice(0, players),
    pieces: {},
    piles: { types },
    round: {
      rounds: 12,
      pools: { coin: 4 },
      deck,
      each: [{ get: { coin: 2 } }],
      bid: 'coin',
      first: 'rotate',
      phases: [
        { id: 'lot', who: 'auto', steps: [{ reveal: 1 }] },
        { id: 'bid', who: 'together', move: 'bid' },
        { id: 'clear', who: 'auto', steps: [{ clear: 'lots' }] },
      ],
      score: [
        { points: true },
        { distinct: { tag: 'suit', table: [0, 0, 1, 3, 6, 10] } },
        { same: { tag: 'suit', table: [0, 0, 1, 4] } },
        { pools: { coin: 3 } },
      ],
    },
  };
}

const PASS_SUITS = { sun: '#e0a03a', moon: '#8a93c9', star: '#d8c24a', leaf: '#5c9446', wave: '#3f86b5' };
const SHAPES = ['ring', 'knot', 'spire'];

export function passDraftGame({ players = 2, seed = 1 } = {}) {
  const types = {}, deck = {};
  Object.keys(PASS_SUITS).forEach((suit, i) => SHAPES.forEach((shape, j) => {
    const id = `${suit}-${shape}`, gems = (i + j) % 3;
    types[id] = { name: `${suit} ${shape}`, tags: { suit, shape, ...(gems ? { gems } : {}) }, colour: PASS_SUITS[suit] };
    deck[id] = players > 2 ? 3 : 2;
  }));
  return {
    title: 'Drafting by passing',
    seed,
    players: SEATS.slice(0, players),
    pieces: {},
    piles: { types },
    round: {
      rounds: 3,
      first: 'rotate',
      deck,
      phases: [
        { id: 'deal', who: 'auto', steps: [{ deal: players > 2 ? 3 : 5 }] },
        { id: 'pick', who: 'together', move: 'pick', give: 'next' },
      ],
      score: [
        { distinct: { tag: 'suit', table: [0, 1, 3, 6, 10, 15] } },
        { same: { tag: 'shape', table: [0, 0, 2, 4, 7, 10, 13] } },
        { sum: { tag: 'gems' } },
      ],
    },
  };
}
