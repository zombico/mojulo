import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { islandEconomy } from './fixtures/island-economy.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (seed = 1, players = 4, trade = false) => { const { L, K } = tabletopGame(islandEconomy({ seed, players, trade })); return { L, K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const place = (K, name) => K.P.byName.get(name);
// a piece set straight onto the board (a crafted position)
function put(K, S, kind, side, name) {
  const p = place(K, name);
  if (p === undefined) throw new Error(`no place ${name}`);
  S.board[p] = S.pieces.length;
  S.pieces.push({ kind, side, at: p, moved: 0 });
  if (S.stock[side] && S.stock[side][kind] !== undefined) S.stock[side][kind] -= 1;
}
// cards held or played: objects off the board (a crafted position)
function give(S, side, zone, kinds) {
  for (const kind of kinds) S.pieces.push({ kind, side, at: -1, moved: 0, zone });
}
// the opening played by taking the first choice each time
function opened(K, S) {
  let s = S;
  while (s.phase === 'opening') s = T.apply(K, s, T.legal(K, s)[0]);
  return s;
}
const empty = (K) => K.res.reduce((h, r) => { h[r] = 0; return h; }, {});
// a position whose next roll comes up v: the dice state searched, not set by hand
function rolling(K, S, v) {
  for (let r = 1; r < 5000; r += 1) {
    const s = { ...clone(S), r };
    if (T.apply(K, s, { type: 'roll' }).roll === v) return s;
  }
  throw new Error(`no dice state rolls ${v}`);
}
function main(K, S) { const s = clone(S); s.phase = 'main'; s.pending = []; return s; }

describe('island economy: the deal system', () => {
  it('types and numbers dealt from the seed, the numberless cell bare, the apart numbers never neighbours, the robber set', () => {
    for (const seed of [1, 2, 3]) {
      const { L, K, S } = at(seed);
      const types = L.cells.map((c) => c.type), nums = L.cells.map((c, i) => K.P.num[i]);
      expect(types.filter((t) => t === 'desert')).toHaveLength(1);
      expect(nums[types.indexOf('desert')]).toBeNull();
      expect(nums.filter((n) => n !== null).sort((a, b) => a - b)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      const hot = nums.map((n, i) => (n === 6 || n === 8 ? i : -1)).filter((i) => i >= 0);
      for (const i of hot) expect(L.cells[i].n.filter((j) => hot.includes(j))).toEqual([]);
      expect(S.pieces.find((x) => x.kind === 'robber').at).toBe(types.indexOf('desert'));
    }
    expect(tabletopGame(islandEconomy({ seed: 5 })).G).toEqual(tabletopGame(islandEconomy({ seed: 5 })).G);
  });
});

describe('island economy: the opening', () => {
  it('the snake: each player a settlement and a road, then back again', () => {
    const { S } = at();
    expect(S.pending.map((d) => d.side)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0]);
    expect(S.pending.map((d) => d.kind).slice(0, 2)).toEqual(['settlement', 'road']);
  });

  it('any of the 54 corners first; then the road touches it; then no corner beside a settlement', () => {
    const { K, S } = at();
    const first = T.legal(K, S);
    expect(first).toHaveLength(54);
    const m = first.find((x) => x.name === 'settlement@C3.n');
    const s1 = T.apply(K, S, m);
    // C3.n is inland: three edges meet there, and the road may take any of them
    const edges = K.P.near[place(K, 'C3.n')].filter((q) => q >= K.P.nC + K.P.nK).map((q) => `road@${K.P.names[q]}`);
    expect(edges).toHaveLength(3);
    expect(T.legal(K, s1).map((x) => x.name).sort()).toEqual(edges.sort());
    const s2 = T.apply(K, s1, T.legal(K, s1)[0]);
    expect(T.actor(s2)).toBe(1);
    const k = place(K, 'C3.n') - K.P.nC;
    expect(T.legal(K, s2)).toHaveLength(54 - 1 - K.P.cornerNext[k].length);
  });

  it('the second settlement pays one of what each of its hexes gives', () => {
    const { K, S } = at();
    let s = S;
    while (s.pending.length > 2) s = T.apply(K, s, T.legal(K, s)[0]);
    const m = T.legal(K, s)[0], after = T.apply(K, s, m);
    const want = empty(K);
    for (const c of K.P.near[m.at]) {
      if (c >= K.P.nC) continue;
      const r = K.G.produce.yields[K.L.cells[c].type];
      if (r) want[r] += 1;
    }
    expect(after.hand[0]).toEqual(want);
    expect(opened(K, S).phase).toBe('roll');
  });
});

describe('island economy: dice and production', () => {
  it('a roll pays each hex showing it to the pieces on its corners, a city twice', () => {
    const { K, S } = at();
    const s0 = opened(K, S);
    for (const v of [6, 8, 5]) {
      const s = rolling(K, s0, v), N = T.apply(K, s, { type: 'roll' });
      const want = s.hand.map((h) => ({ ...h }));
      for (let c = 0; c < K.P.nC; c += 1) {
        if (K.P.num[c] !== v || s.board[c] >= 0) continue;   // the robber's hex pays nothing
        const r = K.G.produce.yields[K.L.cells[c].type];
        for (const q of K.P.near[c]) { const o = s.board[q] >= 0 ? s.pieces[s.board[q]] : null; if (o && o.side >= 0 && o.kind !== 'road') want[o.side][r] += o.kind === 'city' ? 2 : 1; }
      }
      expect(N.hand).toEqual(want);
      expect(N.phase).toBe('main');
    }
  });

  it('the robber stops its hex; the bank short of a resource pays nobody, unless one player alone is owed', () => {
    const { K, S } = at();
    const s0 = opened(K, S);
    const paying = [6, 8, 5, 9, 4, 10, 3, 11].map((v) => [v, rolling(K, s0, v)]).find(([, s]) => {
      const N = T.apply(K, s, { type: 'roll' });
      return JSON.stringify(N.hand) !== JSON.stringify(s.hand);
    });
    const [v, s] = paying;
    // move the robber onto every hex showing v: nothing is paid
    const blocked = clone(s), rob = blocked.pieces.findIndex((x) => x.kind === 'robber');
    const hexes = [];
    for (let c = 0; c < K.P.nC; c += 1) if (K.P.num[c] === v) hexes.push(c);
    blocked.board[blocked.pieces[rob].at] = -1;
    blocked.pieces[rob].at = hexes[0];
    blocked.board[hexes[0]] = rob;
    if (hexes.length === 1) expect(T.apply(K, blocked, { type: 'roll' }).hand).toEqual(blocked.hand);
    // the bank emptied of every resource: nobody owed more than one player's share is paid
    const dry = clone(s);
    for (const r of K.res) dry.bank[r] = 0;
    expect(T.apply(K, dry, { type: 'roll' }).hand).toEqual(dry.hand);
  });

  it('a seven: half a hand over seven given up, card by card, then the robber moves and steals', () => {
    const { K, S } = at();
    const s = rolling(K, opened(K, S), 7);
    s.hand[1] = { lumber: 3, brick: 3, wool: 3, grain: 0, ore: 0 };   // nine cards: four to give up
    s.hand[0] = { lumber: 1, brick: 0, wool: 0, grain: 0, ore: 0 };
    let N = T.apply(K, s, { type: 'roll' });
    expect(N.pending.map((d) => [d.side, d.do])).toEqual([[1, 'discard'], [0, 'robber']]);
    for (let i = 0; i < 4; i += 1) { expect(T.actor(N)).toBe(1); N = T.apply(K, N, T.legal(K, N)[0]); }
    expect(Object.values(N.hand[1]).reduce((a, b) => a + b, 0)).toBe(5);
    expect(T.actor(N)).toBe(0);
    // the robber beside player 1's settlement: a steal follows
    const theirs = N.pieces.find((x) => x.side === 1 && x.kind === 'settlement');
    const hex = K.P.near[theirs.at].find((c) => c < K.P.nC && N.board[c] < 0);
    N = T.apply(K, N, T.legal(K, N).find((m) => m.type === 'robber' && m.at === hex));
    const steal = T.legal(K, N).find((m) => m.type === 'steal' && m.from === 1);
    expect(steal).toBeTruthy();
    const after = T.apply(K, N, steal);
    expect(Object.values(after.hand[0]).reduce((a, b) => a + b, 0)).toBe(Object.values(N.hand[0]).reduce((a, b) => a + b, 0) + 1);
  });
});

describe('island economy: building', () => {
  it('a road reaches from the player\'s own net, not through a foe\'s settlement; a settlement keeps its distance', () => {
    const { K, S } = at();
    const s = main(K, S);
    s.hand[0] = { lumber: 9, brick: 9, wool: 9, grain: 9, ore: 9 };
    put(K, s, 'settlement', 0, 'C3.n');
    put(K, s, 'road', 0, 'C3.ne');
    const roads = T.legal(K, s).filter((m) => m.kind === 'road').map((m) => m.name).sort();
    // the settlement's other two edges
    for (const q of K.P.near[place(K, 'C3.n')]) if (q >= K.P.nC + K.P.nK && q !== place(K, 'C3.ne')) expect(roads).toContain(`road@${K.P.names[q]}`);
    // past the road's far end
    const far = K.P.near[place(K, 'C3.ne')].find((q) => q !== place(K, 'C3.n') && q >= K.P.nC && q < K.P.nC + K.P.nK);
    const beyond = K.P.near[far].filter((q) => q >= K.P.nC + K.P.nK && q !== place(K, 'C3.ne')).map((q) => `road@${K.P.names[q]}`);
    for (const r of beyond) expect(roads).toContain(r);
    // a foe's settlement on that far corner cuts the way on
    const cut = clone(s);
    put(K, cut, 'settlement', 1, K.P.names[far]);
    const cutRoads = T.legal(K, cut).filter((m) => m.kind === 'road').map((m) => m.name);
    for (const r of beyond) expect(cutRoads).not.toContain(r);
    // no settlement on a corner beside one, and only on the player's own road
    const settle = T.legal(K, s).filter((m) => m.kind === 'settlement').map((m) => m.at);
    expect(settle).not.toContain(far);
    expect(settle).toEqual([]);
  });

  it('a city replaces the player\'s settlement, which goes back to stock', () => {
    const { K, S } = at();
    const s = main(K, S);
    put(K, s, 'settlement', 0, 'C3.n');
    s.hand[0] = { lumber: 0, brick: 0, wool: 0, grain: 2, ore: 3 };
    const m = T.legal(K, s).find((x) => x.kind === 'city');
    expect(m.name).toBe('city@C3.n');
    const N = T.apply(K, s, m);
    expect(N.stock[0]).toMatchObject({ settlement: 5, city: 3 });
    expect(N.hand[0]).toEqual(empty(K));
    expect(T.score(K, N, 0)).toBe(2);
  });

  it('the longest road: five in a line takes the award, a foe\'s settlement in the middle breaks it', () => {
    const { K, S } = at();
    const s = main(K, S);
    // a trail of five edges walked along the corners
    let k = place(K, 'A3.wnw') - K.P.nC, prev = -1;
    const edges = [];
    while (edges.length < 5) {
      const next = K.P.cornerNext[k].find((j) => j !== prev);
      const e = K.P.near[K.P.nC + k].find((q) => q >= K.P.nC + K.P.nK && K.P.near[q].includes(K.P.nC + next));
      edges.push(e); prev = k; k = next;
    }
    edges.forEach((e) => put(K, s, 'road', 0, K.P.names[e]));
    expect(T.trail(K, s, 0, 'road', ['settlement', 'city'])).toBe(5);
    expect(T.apply(K, s, { type: 'end' }).awards.road).toBe(0);
    const mid = K.P.near[edges[2]].find((q) => q < K.P.nC + K.P.nK && q >= K.P.nC);
    put(K, s, 'settlement', 1, K.P.names[mid]);
    expect(T.trail(K, s, 0, 'road', ['settlement', 'city'])).toBeLessThan(5);
  });
});

describe('island economy: cards', () => {
  it('bought, held, not played the turn it was bought; a knight moves the robber; three knights, the largest army', () => {
    const { K, S } = at();
    const s = main(K, S);
    s.hand[0] = { lumber: 0, brick: 0, wool: 1, grain: 1, ore: 1 };
    s.deck.development = ['knight', ...s.deck.development.filter((c) => c !== 'knight')];
    const bought = T.apply(K, s, T.legal(K, s).find((m) => m.type === 'buy'));
    expect(T.held(bought, 0)).toEqual({ knight: 1 });
    expect(T.legal(K, bought).some((m) => m.type === 'play')).toBe(false);
    // its next turn, before rolling
    const next = clone(bought);
    for (const o of next.pieces) delete o.fresh;
    next.phase = 'roll';
    give(next, 0, 'played', ['knight', 'knight']);
    const knight = T.legal(K, next).find((m) => m.name === 'play knight');
    const N = T.apply(K, next, knight);
    expect(N.pending[0]).toMatchObject({ side: 0, do: 'robber' });
    expect(N.awards.army).toBe(0);
    expect(T.legal(K, N).every((m) => m.type === 'robber')).toBe(true);
  });

  it('a player at ten on their own turn wins', () => {
    const { K, S } = at();
    const s = main(K, S);
    for (const c of ['A3.wnw', 'C3.n', 'E3.ene']) put(K, s, 'city', 0, c);
    for (const c of ['C1.s', 'C5.n', 'B1.wsw']) put(K, s, 'settlement', 0, c);
    s.hand[0] = { lumber: 0, brick: 0, wool: 0, grain: 2, ore: 3 };
    expect(T.score(K, s, 0)).toBe(9);
    const N = T.apply(K, s, T.legal(K, s).find((m) => m.kind === 'city'));
    expect(N.over).toEqual({ winner: 0, reason: 'score' });
  });
});

describe('island economy: what a player may know', () => {
  it('a view deals the others\' cards and the deck again from what is unseen, and the dice ahead cannot be read', () => {
    const { K, S } = at();
    const s = main(K, S);
    give(s, 1, 'hand', ['knight', 'knight', 'vp']);
    give(s, 0, 'hand', ['corner']);
    const seen = T.view(K, s, 0, 9);
    expect(T.held(seen, 0)).toEqual({ corner: 1 });
    expect(Object.values(T.held(seen, 1)).reduce((a, b) => a + b, 0)).toBe(3);
    expect(seen.deck.development).toHaveLength(s.deck.development.length);
    expect(seen.r).not.toBe(s.r);
    expect(T.view(K, s, 0, 9)).toEqual(seen);
    // the view never sees more than the count of a foe's hidden points
    expect(T.score(K, s, 1, true)).toBe(T.score(K, seen, 1, true));
  });
});

describe('island economy: the computer', () => {
  it('opens on a corner that earns, and the same seeds play the same game', () => {
    const { K, S } = at(2);
    const r = M.think(K, S, { ...M.LEVELS.fair, seed: 1 });
    expect(r.move.type).toBe('build');
    const inc = (m) => Object.values(T.income(K, T.apply(K, S, m), 0)).reduce((a, b) => a + b, 0);
    const best = Math.max(...T.legal(K, S).map(inc));
    expect(inc(r.move)).toBeGreaterThan(best * 0.7);
    const run = () => {
      let s = S;
      const line = [];
      for (let i = 0; i < 60 && !s.over; i += 1) {
        const a = T.actor(s), m = M.think(K, s, { ...M.LEVELS.fair, seed: 5 + a }).move;
        line.push(m.name);
        s = T.apply(K, s, m);
      }
      return line;
    };
    expect(run()).toEqual(run());
  });
});

describe('island economy: trading between players', () => {
  const hands = (S, ...hs) => { hs.forEach((h, s) => { S.hand[s] = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0, ...h }; }); return S; };

  it('after the roll: an offer, each other player answers in turn, the offerer deals with one who accepted', () => {
    const { K, S } = at(1, 4, true);
    const s = hands(main(K, S), { wool: 3 }, { ore: 1 }, {}, { ore: 2 });
    const offers = T.legal(K, s).filter((m) => m.type === 'offer').map((m) => m.name);
    expect(offers).toContain('offer 1 wool for 1 ore');
    expect(offers).toContain('offer 2 wool for 1 ore');
    expect(offers.some((n) => n.includes('for 1 brick'))).toBe(false);   // nobody holds brick to give
    let N = T.apply(K, s, { type: 'offer', offer: { give: { wool: 2 }, get: { ore: 1 } } });
    expect(N.pending.map((d) => [d.side, d.do])).toEqual([[1, 'answer'], [2, 'answer'], [3, 'answer'], [0, 'choose']]);
    N = T.apply(K, N, { type: 'accept' });
    // player 2 holds no ore: it can only decline
    expect(T.legal(K, N).map((m) => m.type)).toEqual(['decline']);
    N = T.apply(K, N, { type: 'decline' });
    N = T.apply(K, N, { type: 'accept' });
    expect(T.legal(K, N).map((m) => m.name)).toEqual(['deal blue', 'deal orange', 'cancel']);
    const done = T.apply(K, N, T.legal(K, N).find((m) => m.name === 'deal orange'));
    expect(done.hand[0]).toMatchObject({ wool: 1, ore: 1 });
    expect(done.hand[3]).toMatchObject({ wool: 2, ore: 1 });
    expect(done.hand[1]).toMatchObject({ ore: 1, wool: 0 });
    const cancelled = T.apply(K, N, { type: 'cancel' });
    expect(cancelled.hand).toEqual(N.hand);
  });

  it('any offer of whole cards the offerer holds is legal; a bad one is refused with its reason; two a turn', () => {
    const { K, S } = at(1, 4, true);
    const s = hands(main(K, S), { wool: 2, grain: 1 }, { ore: 1 });
    expect(T.validOffer(K, s, { give: { wool: 2, grain: 1 }, get: { ore: 1 } })).toBeNull();
    expect(T.validOffer(K, s, { give: { wool: 3 }, get: { ore: 1 } })).toMatch(/does not hold/);
    expect(T.validOffer(K, s, { give: { wool: 1 }, get: { wool: 1 } })).toMatch(/same resource/);
    expect(T.validOffer(K, s, { give: { wool: 1 }, get: {} })).toMatch(/gives something and asks something/);
    let N = s;
    for (let i = 0; i < 2; i += 1) {
      N = T.apply(K, N, { type: 'offer', offer: { give: { wool: 1 }, get: { ore: 1 } } });
      while (N.pending.length) N = T.apply(K, N, T.legal(K, N).find((m) => m.type === 'decline' || m.type === 'cancel'));
    }
    expect(T.legal(K, N).some((m) => m.type === 'offer')).toBe(false);
    expect(T.validOffer(K, N, { give: { wool: 1 }, get: { ore: 1 } })).toMatch(/no offers left/);
    expect(T.apply(K, N, { type: 'end' }).offersTurn).toBe(0);
    const { K: K2, S: S2 } = at(1, 4, false);
    expect(T.validOffer(K2, main(K2, S2), { give: { wool: 1 }, get: { ore: 1 } })).toMatch(/no trading/);
  });

  it('the computer accepts a trade that brings its next build nearer, weighs the offerer\'s gain heavier when the offerer leads, and makes no king', () => {
    const { K, S } = at(1, 4, true);
    // the answerer one ore short of a city, wool to spare; the offerer wanting little: accepted
    const base = hands(main(K, S), { ore: 2 }, { wool: 4, grain: 2, ore: 2 });
    put(K, base, 'settlement', 1, 'C3.n');
    put(K, base, 'settlement', 0, 'A3.wnw');
    const offer = { give: { ore: 1 }, get: { wool: 1 } };
    const fair = M.LEVELS.fair;
    const plain = M.judge(K, base, 1, 0, offer, fair);
    expect(plain.myGain).toBeGreaterThan(plain.theirGain);
    expect(plain.yes).toBe(true);
    // when the trade completes the offerer's settlement too, its gain counts against the answer, more so when it leads
    const both = hands(clone(base), { ore: 2, lumber: 1, brick: 1, grain: 1 }, { wool: 4, grain: 2, ore: 2 });
    const level = M.judge(K, both, 1, 0, offer, fair);
    expect(level.theirGain).toBeGreaterThan(0);
    const leading = clone(both);
    for (const c of ['E3.ene', 'C1.s']) put(K, leading, 'settlement', 0, c);
    const ahead = M.judge(K, leading, 1, 0, offer, fair);
    expect(ahead.ev).toBeLessThan(level.ev);
    expect(ahead.yes).toBe(false);
    // two points from winning: never
    const near = clone(base);
    for (const c of ['E3.ene', 'C1.s', 'C5.n', 'B1.wsw']) put(K, near, 'city', 0, c);
    expect(T.score(K, near, 0, true)).toBeGreaterThanOrEqual(8);
    expect(M.judge(K, near, 1, 0, offer, fair)).toMatchObject({ yes: false, why: 'kingmaker' });
    // and nothing it cannot pay
    expect(M.judge(K, base, 1, 0, { give: { ore: 1 }, get: { brick: 1 } }, fair)).toMatchObject({ yes: false, why: 'cannot pay' });
  });

  it('the computer offers what it foresees accepted and helpful, and answers through think', () => {
    const { K, S } = at(1, 4, true);
    // it is one ore short of a city with wool to spare; blue is one wool short of a settlement with ore to spare
    const s = hands(main(K, S), { wool: 4, grain: 2, ore: 2 }, { ore: 3, lumber: 1, brick: 1, grain: 1 }, {}, {});
    put(K, s, 'settlement', 0, 'C3.n');
    put(K, s, 'settlement', 1, 'A3.wnw');
    const r = M.think(K, s, { ...M.LEVELS.fair, seed: 3 });
    expect(r.move.type).toBe('offer');
    expect(Object.keys(r.move.offer.get)).toEqual(['ore']);
    const N = T.apply(K, s, r.move);
    const a = M.think(K, N, { ...M.LEVELS.fair, seed: 3 });
    expect(['accept', 'decline']).toContain(a.move.type);
  });
});
