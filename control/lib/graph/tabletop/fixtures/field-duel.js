/**
 * A TEST FIXTURE, not a game in the book: a summoning duel on a board, written out from the tabletop kernel's turns,
 * chain and lattice, named by its principle. Two players at ten life face each other across a five by five board.
 * A summon is cast onto an empty cell of its controller's home row and moves by the rules of the piece it names (a
 * footman steps any way along the lines, an outrider leaps as a knight, a lancer charges forward two); a ready summon
 * goes or attacks once a turn, an attack answered on the chain before its blows land; a summon standing on the far
 * row strikes the foe for its power. A player at no life loses; after thirty rounds the most life wins.
 *
 *   fieldDuel({ seed? })
 */

const SEATS = [{ id: 'teal', colour: '#2a8c86', facing: 'N' }, { id: 'plum', colour: '#7b3f73', facing: 'S' }];
const e = (n) => ({ energy: n });
const strikeFar = { act: { exhaust: true, at: { row: 'last' } }, do: [{ damage: 'power', to: 'foe' }] };

const PIECES = {
  foot: { name: 'foot', rules: [{ vec: 'N', sym: 'rotate' }], shape: 'pawn', glyph: '' },
  leaper: { name: 'leaper', rules: [{ vec: [1, 2] }], shape: 'knight', glyph: '' },
  charger: { name: 'charger', rules: [{ vec: 'N', range: 2, pass: 'empty', sym: 'none' }, { vec: 'E', sym: 'mirror' }], shape: 'rook', glyph: '' },
};
const CARDS = {
  pikeman: { name: 'pikeman', cost: e(1), summon: true, piece: 'foot', stats: { power: 1, guard: 2 }, abilities: [strikeFar], colour: '#9aa36b' },
  outrider: { name: 'outrider', cost: e(2), summon: true, piece: 'leaper', stats: { power: 2, guard: 1 }, abilities: [strikeFar], colour: '#a8674a' },
  lancer: { name: 'lancer', cost: e(3), summon: true, piece: 'charger', stats: { power: 3, guard: 3 }, abilities: [strikeFar], colour: '#7a4a3a' },
  sentinel: { name: 'sentinel', cost: e(2), summon: true, piece: 'foot', stats: { power: 0, guard: 4 }, colour: '#7f8a9a' },
  captain: { name: 'captain', cost: e(3), summon: true, piece: 'foot', stats: { power: 2, guard: 2 }, abilities: [strikeFar, { static: { affects: { side: 'mine', summon: true }, mod: { add: { stats: { power: 1 } } } } }], colour: '#b58a3a' },
  bolt: { name: 'bolt', cost: e(1), fast: true, glyph: '⚡', do: [{ damage: 2, to: 'target', of: 'summon' }], colour: '#e0603a' },
  mend: { name: 'mend', cost: e(1), fast: true, glyph: '✚', do: [{ get: { life: 3 } }], colour: '#e8c8c8' },
  rally: { name: 'rally', cost: e(2), glyph: '⚑', do: [{ boost: { add: { stats: { power: 1, guard: 1 } } }, to: 'my-summons', until: 'turn' }], colour: '#d98a3a' },
  deny: { name: 'deny', cost: e(2), fast: true, glyph: '⊘', do: [{ counter: true }], colour: '#4a5a8a' },
  snare: { name: 'snare', cost: e(1), fast: true, glyph: '⌇', do: [{ exhaust: true, to: 'target', of: 'foe-summon' }], colour: '#7a9a5a' },
};
const DECK = { pikeman: 4, outrider: 3, lancer: 2, sentinel: 2, captain: 1, bolt: 3, mend: 1, rally: 1, deny: 1, snare: 2 };

export function fieldDuel({ seed = 1 } = {}) {
  return {
    title: 'Field duel',
    seed,
    board: { shape: 'square', cols: 5, rows: 5 },
    players: SEATS,
    pieces: PIECES,
    piles: { types: CARDS },
    round: {
      rounds: 30,
      pools: { life: 10, energy: 0 },
      decks: DECK,
      hand: 4,
      home: 1,
      lose: { pool: 'life', at: 0 },
      turn: [
        { id: 'start', who: 'auto', steps: [{ ready: 'mine' }, { refill: { pool: 'energy', grow: 1, max: 6 } }, { draw: 1 }] },
        { id: 'main', who: 'active' },
        { id: 'end', who: 'auto', steps: [{ mend: true }] },
      ],
      score: [{ pools: { life: 1 } }],
    },
  };
}
