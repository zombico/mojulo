import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { responseDuel } from './fixtures/duel.js';
import { lineGame } from './fixtures/placement.js';
import { tabletopPageHtml } from './tabletop-page.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const names = (K, S) => T.legal(K, S).map((m) => m.name);
const named = (K, S, name) => {
  const m = T.legal(K, S).find((x) => x.name === name);
  if (!m) throw new Error(`no move ${name} among ${names(K, S).join(' | ')}`);
  return T.apply(K, S, m);
};
const kinds = (S, ids) => T.kindsOf(S, ids);
const life = (S) => S.pools.map((p) => p.life);
// a crafted position: a seat's hand, or its field, made of new objects; energy to spend
const put = (S, side, zone, list, extra) => list.map((kind) => { S.pieces.push({ kind, side, at: -1, moved: 0, zone, ...(extra || {}) }); return S.pieces.length - 1; });
function table(K, S, { hands = [[], []], fields = [[], []], energy = [9, 9] } = {}) {
  const s = clone(S);
  for (let p = 0; p < 2; p++) {
    for (const id of s.zones[p].hand) { s.pieces[id].zone = 'deck'; s.zones[p].deck.push(id); }
    s.zones[p].hand = put(s, p, 'hand', hands[p]);
    s.zones[p].field = put(s, p, 'field', fields[p]);
    s.pools[p].energy = energy[p];
  }
  return s;
}

describe('turns: a player\'s own turn as phases', () => {
  it('each seat in order: ready, a pool that grows and refills, a draw; then its main phase; a round when all have', () => {
    const { K, S } = at(responseDuel());
    expect([S.round, S.active, S.side, T.phaseNow(K, S).id]).toEqual([0, 0, 0, 'main']);
    expect(S.pools.map((p) => p.energy)).toEqual([1, 0]);
    expect(S.zones.map((Z) => Z.hand.length)).toEqual([5, 4]);
    const plum = named(K, S, 'end');
    expect([plum.round, plum.active, plum.side, T.phaseNow(K, plum).id]).toEqual([0, 1, 1, 'main']);
    expect(plum.pools.map((p) => p.energy)).toEqual([1, 1]);
    const next = named(K, plum, 'end');
    expect([next.round, next.active]).toEqual([1, 0]);
    expect(next.pools[0].energy).toBe(2);
  });

  it('a summon enters exhausted and strikes from its next turn, its power taken from the foe\'s life', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['brute'], []] });
    s = named(K, s, 'cast brute');
    const brute = s.zones[0].field[0];
    expect(s.pieces[brute]).toMatchObject({ kind: 'brute', zone: 'field', ready: false });
    expect(names(K, s)).not.toContain(`use brute#${brute}`);
    s = named(K, named(K, s, 'end'), 'end');
    s = named(K, s, `use brute#${brute}`);
    expect(life(s)).toEqual([20, 17]);
    expect(s.pieces[brute].ready).toBe(false);
  });
});

describe('turns: the chain and the initiative', () => {
  it('a player with no stop is never asked: the spell resolves at once', () => {
    const { K, S } = at(responseDuel());
    const s = named(K, table(K, S, { hands: [['blast'], ['brute']] }), 'cast blast @plum');
    expect(s.links).toEqual([]);
    expect(life(s)).toEqual([20, 16]);
    expect(s.side).toBe(0);
  });

  it('a player holding a stop gets the window; a counter cancels the spell beneath it', () => {
    const { K, S } = at(responseDuel());
    let s = named(K, table(K, S, { hands: [['blast'], ['deny']] }), 'cast blast @plum');
    expect(s.side).toBe(1);
    expect(names(K, s).sort()).toEqual(['cast deny', 'pass']);
    s = named(K, s, 'cast deny');
    expect(s.links).toEqual([]);
    expect(life(s)).toEqual([20, 20]);
    expect(kinds(s, s.zones[0].discard)).toEqual(['blast']);
    expect(kinds(s, s.zones[1].discard)).toEqual(['deny']);
    // passing instead lets it resolve
    const passed = named(K, named(K, table(K, S, { hands: [['blast'], ['deny']] }), 'cast blast @plum'), 'pass');
    expect(life(passed)).toEqual([20, 16]);
  });

  it('last in, first out: a strike answered by killing its striker still lands (it was the striker as it was)', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [[], ['bolt']], fields: [['scout'], []] });
    const scout = s.zones[0].field[0];
    s = named(K, s, `use scout#${scout}`);
    expect(s.side).toBe(1);
    s = named(K, s, `cast bolt @scout#${scout}`);
    expect(s.zones[0].field).toEqual([]);
    expect(kinds(s, s.zones[0].discard)).toEqual(['scout']);
    expect(life(s)).toEqual([20, 19]);
  });

  it('a target gone by resolution is skipped', () => {
    const { K, S } = at(responseDuel());
    // teal bolts the plum martyr; plum answers by bolting its own martyr first
    let s = table(K, S, { hands: [['bolt'], ['bolt']], fields: [[], ['martyr']] });
    const martyr = s.zones[1].field[0];
    s = named(K, s, `cast bolt @martyr#${martyr}`);
    s = named(K, s, `cast bolt @martyr#${martyr}`);
    expect(s.zones[1].field).toEqual([]);
    expect(s.links).toEqual([]);
    expect(life(s)).toEqual([20, 20]);
  });
});

describe('turns: triggers and checks', () => {
  it('enters, dies, at the turn\'s start, when a foe casts', () => {
    const { K, S } = at(responseDuel());
    // a sparker entering hurts the foe; plum's watcher answers every cast of teal's
    const s = named(K, table(K, S, { hands: [['sparker'], []], fields: [[], ['martyr', 'watcher']] }), 'cast sparker');
    expect(life(s)).toEqual([19, 19]);
    // a martyr dying draws its controller a card
    let d = table(K, S, { hands: [['bolt'], []], fields: [[], ['martyr', 'watcher']] });
    const martyr = d.zones[1].field[0], hand = d.zones[1].hand.length;
    d = named(K, d, `cast bolt @martyr#${martyr}`);
    expect(life(d)).toEqual([19, 20]);
    expect(d.zones[1].hand.length).toBe(hand + 1);
    // with a bolt still in hand, teal may answer the watcher's trigger: the window is its
    const w = named(K, table(K, S, { hands: [['sparker', 'bolt'], []], fields: [[], ['watcher']] }), 'cast sparker');
    expect(w.side).toBe(0);
    expect(names(K, w)).toContain('pass');
    // a healer heals at its controller's turn start
    let h = table(K, S, { fields: [['healer'], []] });
    h.pools[0].life = 10;
    h = named(K, named(K, h, 'end'), 'end');
    expect(h.pools[0].life).toBe(12);
  });

  it('damage reaching guard kills; damage is mended at the turn\'s end; a player at no life loses', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['bolt', 'bolt'], []], fields: [[], ['brute']] });
    const brute = s.zones[1].field[0];
    s = named(K, s, `cast bolt @brute#${brute}`);
    expect(s.pieces[brute].damage).toBe(2);
    expect(named(K, s, 'end').pieces[brute].damage).toBeUndefined();
    s = named(K, s, `cast bolt @brute#${brute}`);
    expect(s.zones[1].field).toEqual([]);
    const lethal = table(K, S, { hands: [['blast'], []] });
    lethal.pools[1].life = 4;
    expect(named(K, lethal, 'cast blast @plum').over).toMatchObject({ winner: 0, reason: 'lose' });
  });

  it('a loop is a draw: past the turn\'s cap of actions', () => {
    const G = responseDuel();
    G.round.cap = 2;
    const { K, S } = at(G);
    let s = table(K, S, { hands: [['scout', 'scout', 'scout'], []] });
    s = named(K, named(K, s, 'cast scout'), 'cast scout');
    expect(s.over).toBe(null);
    expect(named(K, s, 'cast scout').over).toEqual({ winner: null, reason: 'loop' });
  });
});

describe('turns: hidden hands, utilization', () => {
  it('a view keeps the viewer\'s hand and deals the other\'s hand again from its hand and deck', () => {
    const { K, S } = at(responseDuel({ seed: 3 }));
    const V = T.view(K, S, 0, 9);
    expect(kinds(V, V.zones[0].hand)).toEqual(kinds(S, S.zones[0].hand));
    const pool = (X) => kinds(X, X.zones[1].hand.concat(X.zones[1].deck)).sort();
    expect(pool(V)).toEqual(pool(S));
    expect(kinds(V, V.zones[1].hand)).not.toEqual(kinds(S, S.zones[1].hand));
  });

  it('energy spent counts; energy left at the turn\'s end while a card could be paid for is idle', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['scout', 'brute'], []], energy: [4, 0] });
    s = named(K, named(K, s, 'cast scout'), 'end');
    expect(s.use[0]).toEqual({ energy: [1, 3] });
    // nothing left to pay for: not idle
    let t = table(K, S, { hands: [['giant'], []], energy: [2, 0] });
    t = named(K, t, 'end');
    expect(t.use[0]).toEqual({});
  });
});

describe('turns: the computer', () => {
  it('counters a blast aimed at it when it can, and strikes rather than ending its turn', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['blast'], ['deny']] });
    s = named(K, s, 'cast blast @plum');
    expect(M.think(K, s, { ...M.LEVELS.hard, seed: 1 }).move.name).toBe('cast deny');
    const r = table(K, S, { fields: [['brute'], []] });
    expect(M.think(K, r, { ...M.LEVELS.hard, seed: 1 }).move.name).toMatch(/^use brute/);
  });

  it('beats a player choosing at random, and the same seed plays the same game', () => {
    const run = () => {
      const { K, S } = at(responseDuel({ seed: 2 }));
      let s = S, n = 0, x = 7;
      const line = [];
      while (!s.over && n < 3000) {
        const L = T.legal(K, s);
        x = (x * 1103515245 + 12345) % 2147483648;
        const m = s.side === 1 ? M.think(K, s, { ...M.LEVELS.fair, seed: n }).move : L[Math.floor((x / 2147483648) * L.length)];
        line.push(m.name);
        s = T.apply(K, s, m);
        n += 1;
      }
      return { over: s.over, line };
    };
    const a = run();
    expect(a.over.winner).toBe(1);
    expect(run().line).toEqual(a.line);
  });

  it('Monte Carlo search, for any game: finds the drop that wins, and the same seed searches the same way', () => {
    const { K, S } = at(lineGame());
    const s = ['disc@A1', 'disc@A2', 'disc@B1', 'disc@B2', 'disc@C1', 'disc@C2'].reduce((x, n) => named(K, x, n), S);
    const o = { search: 'mcts', seed: 3, mcts: { playouts: 120, horizon: 12 } };
    const a = M.think(K, s, o);
    expect(a.move.name).toBe('disc@D1');
    expect(M.think(K, s, o)).toEqual(a);
  });

  it('the page carries the duel', () => {
    const html = tabletopPageHtml(responseDuel());
    expect(html).toContain('function tabletopRoundClient(D, T, M, TV)');
    expect(tabletopPageHtml(responseDuel())).toBe(html);
  });
});

describe('the closures', () => {
  // each is one closure emitted into a page: two declarations of a name at its top level silently become one
  it('declare each name once at their top level', async () => {
    const { buildTabletop: k } = await import('./tabletop-kernel.js');
    const { buildTabletopMind: m } = await import('./tabletop-mind.js');
    for (const src of [k.toString(), m.toString()]) {
      const top = [...src.matchAll(/^ {2}(?:function\s+(\w+)|const\s+(\w+)\s*=)/gm)].map((x) => x[1] || x[2]);
      const twice = top.filter((n, i) => top.indexOf(n) !== i);
      expect(twice).toEqual([]);
    }
  });
});
