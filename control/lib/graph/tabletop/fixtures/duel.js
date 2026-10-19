/**
 * A TEST FIXTURE, not a game in the book: a response duel written out from the tabletop kernel's turns, chain and
 * triggers, named by its principle. Two players at twenty life; each turn its player readies its summons, gains one
 * more energy (up to eight; what was left is gone) and draws; then casts summons and spells and strikes with ready
 * summons, while the other answers with fast cards and fast abilities on the chain. Summons enter exhausted. A player
 * at no life loses; after twenty-five rounds the most life wins.
 *
 *   responseDuel({ seed? })
 */

const SEATS = [{ id: 'teal', colour: '#2a8c86' }, { id: 'plum', colour: '#7b3f73' }];
const strike = { act: { exhaust: true }, do: [{ damage: 'power', to: 'foe' }] };
const e = (n) => ({ energy: n });

const CARDS = {
  scout: { name: 'scout', cost: e(1), summon: true, stats: { power: 1, guard: 1 }, abilities: [strike], colour: '#9aa36b' },
  warden: { name: 'warden', cost: e(2), summon: true, stats: { power: 1, guard: 4 }, abilities: [strike], colour: '#7f8a9a' },
  brute: { name: 'brute', cost: e(3), summon: true, stats: { power: 3, guard: 3 }, abilities: [strike], colour: '#a8674a' },
  giant: { name: 'giant', cost: e(5), summon: true, stats: { power: 5, guard: 5 }, abilities: [strike], colour: '#7a4a3a' },
  healer: { name: 'healer', cost: e(2), summon: true, stats: { power: 0, guard: 2 }, abilities: [{ when: 'turn', do: [{ get: { life: 2 } }] }], colour: '#8fbf8f' },
  sparker: { name: 'sparker', cost: e(2), summon: true, stats: { power: 1, guard: 1 }, abilities: [strike, { when: 'enters', do: [{ damage: 1, to: 'foe' }] }], colour: '#d9a441' },
  martyr: { name: 'martyr', cost: e(2), summon: true, stats: { power: 1, guard: 2 }, abilities: [strike, { when: 'dies', do: [{ draw: 1 }] }], colour: '#a58fb5' },
  watcher: { name: 'watcher', cost: e(3), summon: true, stats: { power: 2, guard: 3 }, abilities: [strike, { when: 'foe-casts', do: [{ damage: 1, to: 'foe' }] }], colour: '#6b8fb5' },
  sniper: { name: 'sniper', cost: e(3), summon: true, stats: { power: 1, guard: 2 }, abilities: [{ act: { exhaust: true }, do: [{ damage: 1, to: 'target', of: 'summon' }], fast: true }], colour: '#5f7f6f' },
  bolt: { name: 'bolt', cost: e(1), fast: true, do: [{ damage: 2, to: 'target', of: 'any' }], colour: '#e0603a' },
  blast: { name: 'blast', cost: e(3), do: [{ damage: 4, to: 'target', of: 'any' }], colour: '#c43a2a' },
  snare: { name: 'snare', cost: e(2), fast: true, do: [{ exhaust: true, to: 'target', of: 'foe-summon' }], colour: '#7a9a5a' },
  ruin: { name: 'ruin', cost: e(4), do: [{ destroy: true, to: 'target', of: 'summon' }], colour: '#3a3030' },
  insight: { name: 'insight', cost: e(2), do: [{ draw: 2 }], colour: '#5a7ac4' },
  mend: { name: 'mend', cost: e(1), fast: true, do: [{ get: { life: 3 } }], colour: '#e8c8c8' },
  deny: { name: 'deny', cost: e(2), fast: true, do: [{ counter: true }], colour: '#4a5a8a' },
  quake: { name: 'quake', cost: e(4), do: [{ damage: 2, to: 'foe-summons' }], colour: '#8a6a4a' },
};
const DECK = { scout: 3, warden: 2, brute: 3, giant: 2, healer: 1, sparker: 2, martyr: 2, watcher: 1, sniper: 2, bolt: 3, blast: 2, snare: 2, ruin: 1, insight: 2, mend: 1, deny: 2, quake: 1 };

export function responseDuel({ seed = 1 } = {}) {
  return {
    title: 'Response duel',
    seed,
    players: SEATS,
    pieces: {},
    piles: { types: CARDS },
    round: {
      rounds: 25,
      pools: { life: 20, energy: 0 },
      decks: DECK,
      hand: 4,
      lose: { pool: 'life', at: 0 },
      turn: [
        { id: 'start', who: 'auto', steps: [{ ready: 'mine' }, { refill: { pool: 'energy', grow: 1, max: 8 } }, { draw: 1 }] },
        { id: 'main', who: 'active' },
        { id: 'end', who: 'auto', steps: [{ mend: true }] },
      ],
      score: [{ pools: { life: 1 } }],
    },
  };
}
