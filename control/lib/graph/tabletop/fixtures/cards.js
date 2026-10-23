/**
 * TEST FIXTURES, not games in the book: card paradigms written out from the tabletop kernel's cards, each named by its
 * principle. No board: piles, hands and a market are the table.
 *
 *   deckGame({ players?, seed? })    deck building: each starts with seven one-coin treasures and three one-point acres,
 *                                    draws five, plays treasures and actions, buys from the supply into the discard;
 *                                    it ends when the six-point acres are gone or any three piles are; the most points
 *                                    wins (2 players)
 *   draftGame({ players?, seed? })   drafting and set collection: a row of five face up, refilled from a deck; a turn
 *                                    takes one to the tableau; at the end each different suit held scores up the table
 *                                    1 3 6 10 15, each shape held two or more times scores, the gems add, the most
 *                                    stars earn 5 (2 players)
 */

const SEATS = [
  { id: 'teal', colour: '#2a8c86' }, { id: 'plum', colour: '#7b3f73' },
  { id: 'gold', colour: '#e0b23a' }, { id: 'rust', colour: '#b5532f' },
];

export function deckGame({ players = 2, seed = 1 } = {}) {
  const piles = players > 2 ? 12 : 8;
  return {
    title: 'Deck building',
    seed,
    players: SEATS.slice(0, players),
    pieces: {},
    piles: {
      types: {
        coin1: { name: 'one coin', cost: 0, coin: 1, treasure: true, colour: '#c9a94a' },
        coin2: { name: 'two coins', cost: 3, coin: 2, treasure: true, colour: '#b9b9c4' },
        coin3: { name: 'three coins', cost: 6, coin: 3, treasure: true, colour: '#e8c54a' },
        acre1: { name: 'small acre', cost: 2, points: 1, colour: '#7fae5a' },
        acre3: { name: 'field', cost: 5, points: 3, colour: '#5c9446' },
        acre6: { name: 'estate', cost: 8, points: 6, colour: '#3f7a34' },
        'draw-three': { name: 'study', cost: 4, play: [{ draw: 3 }], colour: '#6f8fbf' },
        'draw-one-act-two': { name: 'bustle', cost: 3, play: [{ draw: 1 }, { actions: 2 }], colour: '#8fa6c9' },
        'coin-two-buy': { name: 'stall', cost: 5, play: [{ coin: 2 }, { buys: 1 }], colour: '#c98f5a' },
        'trash-four': { name: 'cull', cost: 2, play: [{ trash: 4 }], colour: '#9a6b6b' },
        'gain-four': { name: 'yard', cost: 4, play: [{ gain: 4 }], colour: '#8a9a6b' },
      },
      supply: {
        coin1: 40, coin2: 30, coin3: 20, acre1: piles, acre3: piles, acre6: piles,
        'draw-three': 10, 'draw-one-act-two': 10, 'coin-two-buy': 10, 'trash-four': 10, 'gain-four': 10,
      },
      start: { deck: { coin1: 7, acre1: 3 } },
      draw: 5,
      score: [{ points: true }],
      end: { pile: 'acre6', piles: 3 },
    },
  };
}

const SUITS = { sun: '#e0a03a', moon: '#8a93c9', star: '#d8c24a', leaf: '#5c9446', wave: '#3f86b5' };
const SHAPES = ['ring', 'knot', 'spire'];

export function draftGame({ players = 2, seed = 1 } = {}) {
  const types = {}, deck = {};
  Object.keys(SUITS).forEach((suit, i) => SHAPES.forEach((shape, j) => {
    const id = `${suit}-${shape}`, gems = (i + j) % 3;
    types[id] = { name: `${suit} ${shape}`, tags: { suit, shape, ...(gems ? { gems } : {}) }, colour: SUITS[suit] };
    deck[id] = players > 2 ? 3 : 2;
  }));
  return {
    title: 'Drafting',
    seed,
    players: SEATS.slice(0, players),
    pieces: {},
    piles: {
      types,
      take: 'draft',
      market: { deck, row: 5 },
      score: [
        { distinct: { tag: 'suit', table: [0, 1, 3, 6, 10, 15] } },
        { same: { tag: 'shape', table: [0, 0, 2, 4, 7, 10, 13] } },
        { sum: { tag: 'gems' } },
        { most: { tag: 'suit', value: 'star', bonus: 5 } },
      ],
      end: { market: true },
    },
  };
}
