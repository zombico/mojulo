import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { deckGame, draftGame } from './fixtures/cards.js';
import { tabletopPageHtml } from './tabletop-page.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const sorted = (a) => a.slice().sort();
const named = (K, S, name) => {
  const m = T.legal(K, S).find((x) => x.name === name);
  if (!m) throw new Error(`no move ${name} among ${T.legal(K, S).map((x) => x.name).join(' ')}`);
  return T.apply(K, S, m);
};
// a deck-game position with the hand set by hand (the rest of the starting cards the deck)
const holding = (K, S, hand, deck) => {
  const N = clone(S);
  N.zones[N.side].hand = hand;
  if (deck) N.zones[N.side].deck = deck;
  return N;
};

describe('cards: a deck, a hand, a discard', () => {
  it('each starts with its deck, five in hand; no board is needed', () => {
    const { K, S } = at(deckGame());
    for (const Z of S.zones) {
      expect(Z.hand).toHaveLength(5);
      expect(sorted(Z.deck.concat(Z.hand))).toEqual(sorted([...Array(7).fill('coin1'), ...Array(3).fill('acre1')]));
    }
    expect(S.supply.acre6).toBe(8);
    expect(K.L.cells).toHaveLength(1);
  });

  it('a treasure plays for its coins, an action for one of the turn\'s actions; a buy spends coins and a buy', () => {
    const { K, S } = at(deckGame());
    let s = holding(K, S, ['coin1', 'coin1', 'coin1', 'draw-three', 'draw-one-act-two']);
    s = named(K, s, 'play coin1');
    s = named(K, s, 'play coin1');
    expect(s.act.coins).toBe(2);
    s = named(K, s, 'play draw-three');
    expect(s.act.actions).toBe(0);
    expect(s.zones[0].hand).toHaveLength(2 + 3);
    // no action left: the other action card cannot be played
    expect(T.legal(K, s).map((m) => m.name)).not.toContain('play draw-one-act-two');
    expect(T.legal(K, s).map((m) => m.name)).not.toContain('buy acre6');
    s = named(K, s, 'buy acre1');
    expect(s.act).toMatchObject({ coins: 0, buys: 0 });
    expect(s.zones[0].discard).toEqual(['acre1']);
    expect(s.supply.acre1).toBe(7);
    expect(T.legal(K, s).filter((m) => m.type === 'buy')).toEqual([]);
  });

  it('a turn ends: hand and play to the discard, five drawn, the turn\'s actions back; an empty deck shuffles the discard', () => {
    const { K, S } = at(deckGame());
    // two in the deck, eight in the discard: the new hand takes the two, then shuffles the discard for three more
    const s = clone(S);
    const Z = s.zones[0];
    Z.discard = Z.deck.splice(0, 3);
    s.act.coins = 4;
    const n = named(K, s, 'end');
    const Y = n.zones[0];
    expect(Y.hand).toHaveLength(5);
    expect(Y.play).toEqual([]);
    expect(Y.deck.length + Y.hand.length + Y.discard.length).toBe(10);
    expect(Y.discard).toEqual([]);
    expect(n.side).toBe(1);
    expect(n.act).toEqual({ actions: 1, buys: 1, coins: 0 });
  });
});

describe('cards: effects owed', () => {
  it('trash: up to n from the hand, one at a time, stopped by done', () => {
    const { K, S } = at(deckGame());
    let s = holding(K, S, ['trash-four', 'acre1', 'acre1', 'coin1', 'coin1']);
    s = named(K, s, 'play trash-four');
    expect(sorted(T.legal(K, s).map((m) => m.name))).toEqual(['done', 'trash acre1', 'trash coin1']);
    s = named(K, s, 'trash acre1');
    s = named(K, s, 'trash acre1');
    expect(s.trash).toEqual(['acre1', 'acre1']);
    s = named(K, s, 'done');
    expect(s.pending).toEqual([]);
    expect(s.zones[0].hand).toEqual(['coin1', 'coin1']);
    expect(T.legal(K, s).map((m) => m.type)).toContain('play');
  });

  it('gain: a card from the supply costing up to n, to the discard; a second buy from a card that adds one', () => {
    const { K, S } = at(deckGame());
    let s = holding(K, S, ['gain-four', 'coin-two-buy', 'coin1']);
    s = named(K, s, 'play gain-four');
    const offered = T.legal(K, s).map((m) => m.card);
    expect(offered.every((id) => (K.card.types[id].cost || 0) <= 4)).toBe(true);
    expect(offered).toContain('draw-three');
    s = named(K, s, 'gain draw-three');
    expect(s.zones[0].discard).toEqual(['draw-three']);
    expect(s.supply['draw-three']).toBe(9);
    // its action spent: the other action waits for another turn
    expect(T.legal(K, s).map((m) => m.name)).not.toContain('play coin-two-buy');
    s = clone(s);
    s.act.actions = 1;
    s = named(K, named(K, s, 'play coin-two-buy'), 'play coin1');
    expect(s.act).toMatchObject({ coins: 3, buys: 2 });
    s = named(K, named(K, s, 'buy acre1'), 'buy coin1');
    expect(s.act.buys).toBe(0);
  });
});

describe('cards: the end and the scorers', () => {
  it('ends as a turn ends, when its pile is gone or enough piles are, the most points winning', () => {
    const { K, S } = at(deckGame());
    const s = clone(S);
    s.supply.acre6 = 1;
    s.act.coins = 8;
    const bought = named(K, s, 'buy acre6');
    expect(bought.over).toBe(null);
    const over = named(K, bought, 'end').over;
    expect(over).toEqual({ winner: 0, reason: 'score', scores: [3 + 6, 3] });
    const three = clone(S);
    three.supply['trash-four'] = 0; three.supply['gain-four'] = 0; three.supply.coin3 = 0;
    expect(named(K, three, 'end').over.reason).toBe('score');
  });

  it('distinct, same, sum and most: each counted over what a seat holds, the most shared on a tie', () => {
    const { K, S } = at(draftGame());
    const s = clone(S);
    // teal: three suits (6, one a star), knots twice (2); plum: one suit (1), a star; the most stars a tie, five shared as two each
    s.zones[0].tableau = ['sun-knot', 'moon-knot', 'star-ring'];
    s.zones[1].tableau = ['star-spire'];
    const gems = (ids) => ids.reduce((a, id) => a + (K.card.types[id].tags.gems || 0), 0);
    expect(T.cardScores(K, s)).toEqual([
      6 + 2 + gems(s.zones[0].tableau) + 2,
      1 + gems(s.zones[1].tableau) + 2,
    ]);
  });
});

describe('cards: the draft', () => {
  it('a turn takes one from the row to the tableau, the row refilled from its deck, until both are empty', () => {
    const { K, S } = at(draftGame());
    expect(S.market.row).toHaveLength(5);
    expect(S.zones[0].hand).toEqual([]);
    const id = S.market.row[2], next = S.market.deck[S.market.deck.length - 1];
    const s = named(K, S, `take ${id}@2`);
    expect(s.zones[0].tableau).toEqual([id]);
    expect(s.market.row[2]).toBe(next);
    expect(s.side).toBe(1);
    let t = S;
    while (!t.over) t = T.apply(K, t, T.legal(K, t)[0]);
    expect(t.zones[0].tableau.length + t.zones[1].tableau.length).toBe(30);
    expect(t.over.scores).toEqual(T.cardScores(K, t));
  });
});

describe('cards: what is hidden, the computer', () => {
  it('a view keeps the seat\'s own hand; deck order and the others\' hands are dealt again from what they could be', () => {
    const { K, S } = at(deckGame({ seed: 5 }));
    const V = T.view(K, S, 0, 9);
    expect(V.zones[0].hand).toEqual(S.zones[0].hand);
    expect(sorted(V.zones[0].deck)).toEqual(sorted(S.zones[0].deck));
    const pool = (Z) => sorted(Z.deck.concat(Z.hand));
    expect(pool(V.zones[1])).toEqual(pool(S.zones[1]));
    expect(V.zones[1].hand).toHaveLength(5);
  });

  it('the computer beats a player choosing at random, in both games, and the same seed plays the same game', () => {
    const run = (G, mindSide) => {
      const { K, S } = at(G);
      let s = S, n = 0, x = 7;
      const line = [];
      while (!s.over && n < 2000) {
        const L = T.legal(K, s);
        x = (x * 1103515245 + 12345) % 2147483648;
        const m = s.side === mindSide ? M.think(K, s, { ...M.LEVELS.fair, seed: n }).move : L[Math.floor((x / 2147483648) * L.length)];
        line.push(m.name);
        s = T.apply(K, s, m);
        n += 1;
      }
      return { over: s.over, line };
    };
    for (const G of [deckGame({ seed: 2 }), draftGame({ seed: 2 })]) {
      const a = run(G, 1);
      expect(a.over.winner).toBe(1);
      expect(run(G, 1).line).toEqual(a.line);
    }
  });

  it('the page carries the card game and draws the same twice', () => {
    const html = tabletopPageHtml(deckGame());
    expect(html).toContain('function tabletopCardClient(D, T, M)');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(tabletopPageHtml(deckGame())).toBe(html);
    expect(tabletopPageHtml(draftGame())).toContain('function tabletopCardClient(D, T, M)');
  });
});
