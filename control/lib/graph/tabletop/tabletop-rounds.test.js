import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { workerGame, auctionGame, passDraftGame } from './fixtures/rounds.js';
import { deckGame } from './fixtures/cards.js';
import { tabletopPageHtml } from './tabletop-page.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const named = (K, S, name) => {
  const m = T.legal(K, S).find((x) => x.name === name);
  if (!m) throw new Error(`no move ${name} among ${T.legal(K, S).map((x) => x.name).join(' ')}`);
  return T.apply(K, S, m);
};
const phaseOf = (K, S) => K.G.round.phases[S.phase].id;
const workers = (S, side) => S.pieces.filter((o) => o.side === side && o.kind === 'worker');

describe('rounds: phases taken in turns', () => {
  it('a round starts at its first phase with the first player; workers take turns; a full space is closed', () => {
    const { K, S } = at(workerGame());
    expect([S.round, phaseOf(K, S), S.side]).toEqual([0, 'work', 0]);
    expect(workers(S, 0).every((o) => o.zone === 'home' && o.ready !== false)).toBe(true);
    let s = named(K, S, 'place forest');
    expect(s.pools[0].wood).toBe(2);
    expect(s.side).toBe(1);
    expect(T.legal(K, s).map((m) => m.name)).not.toContain('place forest');
    // the field holds two
    s = named(K, named(K, s, 'place field'), 'place field');
    expect(T.legal(K, s).map((m) => m.name)).not.toContain('place field');
    // a space that costs what the player has not got is not offered
    expect(T.legal(K, s).map((m) => m.name)).not.toContain('place tower');
  });

  it('when nobody can place, the auto phases run (upkeep, then home) and the next round begins', () => {
    const { K, S } = at(workerGame());
    // teal two at the field (+4 food), plum at the forest and the market
    const s = ['place field', 'place forest', 'place field', 'place market'].reduce((x, n) => named(K, x, n), S);
    expect(s.round).toBe(1);
    expect(phaseOf(K, s)).toBe('work');
    // teal: 2 + 4 food, two eaten; plum: 2 + 1 food, two eaten
    expect(s.pools[0].food).toBe(4);
    expect(s.pools[1].food).toBe(1);
    expect(workers(s, 0).every((o) => o.zone === 'home' && o.ready !== false)).toBe(true);
  });

  it('a worker short of food costs points; the first seat taken plays first next round; a worker gained is ready next round', () => {
    const { K, S } = at(workerGame());
    let s = clone(S);
    s.pools[0] = { food: 1, wood: 2, stone: 0 };
    s = ['place hut', 'place hall', 'place forest', 'place quarry'].reduce((x, n) => named(K, x, n), s);
    // teal paid the hut's food: none left to eat, three workers short; plum ate 2 of its 3
    expect(workers(s, 0)).toHaveLength(3);
    expect(s.score[0]).toBe(-9);
    expect(s.score[1]).toBe(0);
    expect(s.first).toBe(1);
    expect(s.side).toBe(1);
    expect(workers(s, 0).every((o) => o.ready !== false)).toBe(true);
  });
});

describe('rounds: choices made together', () => {
  it('a bid is sealed: the view of the player choosing after hides it; the highest pays and takes the lot', () => {
    const { K, S } = at(auctionGame());
    expect(phaseOf(K, S)).toBe('bid');
    expect(S.lots).toHaveLength(1);
    expect(S.pools.map((p) => p.coin)).toEqual([6, 6]);
    const lot = S.lots[0];
    const s = named(K, S, 'bid 3');
    expect(s.side).toBe(1);
    expect(T.view(K, s, 1, 9).sealed[0]).toEqual({ sealed: true });
    expect(T.view(K, s, 0, 9).sealed[0]).toEqual({ n: 3 });
    const done = named(K, s, 'bid 2');
    expect(done.zones[0].tableau).toEqual([lot]);
    expect(done.pools.map((p) => p.coin)).toEqual([3 + 2, 6 + 2]);
    expect(done.round).toBe(1);
    // the first seat passes on: plum bids first in the second round
    expect([done.first, done.side]).toEqual([1, 1]);
  });

  it('a tie goes to the first in order from the first player; all zeros, the lot goes to nobody', () => {
    const { K, S } = at(auctionGame());
    const tie = named(K, named(K, S, 'bid 2'), 'bid 2');
    expect(tie.zones.map((Z) => Z.tableau.length)).toEqual([1, 0]);
    const none = named(K, named(K, S, 'bid 0'), 'bid 0');
    expect(none.zones.map((Z) => Z.tableau.length)).toEqual([0, 0]);
    expect(none.pieces[S.lots[0]].zone).toBe('gone');
  });

  it('picks are sealed, revealed together, and the hands passed on until they are empty; the rounds end the game', () => {
    const { K, S } = at(passDraftGame());
    expect(S.zones.map((Z) => Z.hand.length)).toEqual([5, 5]);
    const plumHand = S.zones[1].hand.slice();
    const a = T.legal(K, S)[0];
    const s1 = T.apply(K, S, a);
    expect(s1.zones[0].tableau).toEqual([]);
    const s2 = T.apply(K, s1, T.legal(K, s1)[0]);
    expect(s2.zones.map((Z) => Z.tableau.length)).toEqual([1, 1]);
    // teal now holds what is left of plum's hand
    expect(s2.zones[0].hand.every((id) => plumHand.indexOf(id) >= 0)).toBe(true);
    let s = s2;
    while (!s.over) s = T.apply(K, s, T.legal(K, s)[0]);
    expect(s.zones.map((Z) => Z.tableau.length)).toEqual([15, 15]);
    expect(s.over.scores).toEqual(T.roundScores(K, s));
  });
});

describe('utilization', () => {
  it('a deck turn: actions, buys and coins spent are counted; ended with something to buy, the rest is idle', () => {
    const { K, S } = at(deckGame());
    let s = clone(S);
    // play every treasure, buy a small acre, end with coins left and a buy that could still be made
    let m;
    while ((m = T.legal(K, s).find((x) => x.type === 'play'))) s = T.apply(K, s, m);
    const coins = s.act.coins;
    s = clone(s);
    s.act.buys = 2;
    s = named(K, s, 'buy coin1');
    s = named(K, s, 'end');
    expect(s.use[0]).toEqual({ buys: [1, 1], coins: [0, coins] });
    expect(T.utilization(K, s, 0)).toEqual({ pools: { buys: 0.5, coins: 0 }, share: 0.25 });
    // an action left with no action card to play it on is not idle
    expect(s.use[0].actions).toBeUndefined();
    expect(T.utilization(K, s, 1)).toBe(null);
  });

  it('workers left home while a space was open are idle, where passing is allowed', () => {
    const G = workerGame();
    G.round.phases[0].pass = true;
    const { K, S } = at(G);
    const s = named(K, named(K, S, 'place forest'), 'pass');
    expect(s.use[1]).toEqual({ workers: [0, 2] });
    expect(s.use[0]).toEqual({ workers: [1, 0] });
  });

  it('the dial: an easier computer leaves more of its turns unused, and loses to a harder one', () => {
    const game = (levels) => {
      const { K, S } = at(deckGame({ seed: 3 }));
      let s = S, n = 0;
      while (!s.over && n < 3000) { s = T.apply(K, s, M.think(K, s, { ...M.LEVELS[levels[s.side]], seed: n }).move); n += 1; }
      return { over: s.over, use: [0, 1].map((x) => T.utilization(K, s, x).share) };
    };
    const g = game(['hard', 'easy']);
    expect(g.over.winner).toBe(0);
    expect(g.use[0]).toBeGreaterThan(g.use[1] + 0.1);
  });
});

describe('rounds: the computer', () => {
  it('beats a player choosing at random in each round paradigm, and the same seed plays the same game', () => {
    const run = (G) => {
      const { K, S } = at(G);
      let s = S, n = 0, x = 7;
      const line = [];
      while (!s.over && n < 2000) {
        const L = T.legal(K, s);
        x = (x * 1103515245 + 12345) % 2147483648;
        const m = s.side === 1 ? M.think(K, s, { ...M.LEVELS.fair, seed: n }).move : L[Math.floor((x / 2147483648) * L.length)];
        line.push(m.name);
        s = T.apply(K, s, m);
        n += 1;
      }
      return { over: s.over, line };
    };
    for (const G of [workerGame({ seed: 2 }), auctionGame({ seed: 2 }), passDraftGame({ seed: 2 })]) {
      const a = run(G);
      expect(a.over.winner).toBe(1);
      expect(run(G).line).toEqual(a.line);
    }
  });

  it('bids on a lot that makes it a set', () => {
    const { K, S } = at(auctionGame());
    const s = clone(S);
    const want = s.lots[0];
    // plum holds the lot's two suit-mates: the lot makes plum a set of three
    const suit = K.defs[s.pieces[want].kind].tags.suit, same = Object.keys(K.defs).filter((k) => K.defs[k].tags && K.defs[k].tags.suit === suit && k !== s.pieces[want].kind);
    for (const k of same) { s.pieces.push({ kind: k, side: 1, at: -1, moved: 0, zone: 'tableau' }); s.zones[1].tableau.push(s.pieces.length - 1); }
    const plum = clone(s);
    plum.side = 1;
    plum.sealed[0] = { n: 0 };
    expect(M.think(K, plum, { ...M.LEVELS.hard, seed: 1 }).move.n).toBeGreaterThan(0);
  });

  it('the page carries a round game and draws the same twice', () => {
    for (const G of [workerGame(), auctionGame(), passDraftGame()]) {
      const html = tabletopPageHtml(G);
      expect(html).toContain('function tabletopRoundClient(D, T, M)');
      expect(html.match(/<\/script>/g)).toHaveLength(1);
      expect(tabletopPageHtml(G)).toBe(html);
    }
  });
});
