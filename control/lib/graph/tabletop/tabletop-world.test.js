import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { responseDuel } from './fixtures/duel.js';
import { CHESS } from './games/chess.js';

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
const life = (S) => S.pools.map((p) => p.life);
const stats = (K, S, id) => T.derive(K, S, id).stats;
// a crafted position: each seat's hand and field made of new objects (a field object entered in order, ready)
const put = (S, side, zone, list) => list.map((kind) => { S.pieces.push({ kind, side, at: -1, moved: 0, zone, t: S.pieces.length }); return S.pieces.length - 1; });
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

describe('world effects', () => {
  it('a game with none takes the shared definition; one with a static ability gathers them', () => {
    expect(at(CHESS).K.statics).toBe(false);
    expect(at(responseDuel()).K.statics).toBe(true);
  });

  it('an aura covers its controller\'s other summons while it is in play, and nothing else', () => {
    const { K, S } = at(responseDuel());
    const s = table(K, S, { hands: [['bolt', 'bolt'], []], fields: [['captain', 'brute'], ['brute']] });
    const [captain, brute] = s.zones[0].field, foe = s.zones[1].field[0];
    expect(stats(K, s, brute)).toEqual({ power: 4, guard: 3 });
    expect(stats(K, s, captain)).toEqual({ power: 2, guard: 2 });
    expect(stats(K, s, foe)).toEqual({ power: 3, guard: 3 });
    // the captain killed: the brute is itself again
    const after = named(K, s, `cast bolt @captain#${captain}`);
    expect(after.zones[0].field).toEqual([brute]);
    expect(stats(K, after, brute)).toEqual({ power: 3, guard: 3 });
  });

  it('an aura on the foe\'s summons; damage never below nothing', () => {
    const { K, S } = at(responseDuel());
    const s = table(K, S, { fields: [['scout'], ['fog']] });
    const scout = s.zones[0].field[0];
    expect(stats(K, s, scout).power).toBe(0);
    expect(life(named(K, s, `use scout#${scout}`))).toEqual([20, 20]);
  });

  it('a cost cut covers the hand, never below nothing, and only what it names', () => {
    const { K, S } = at(responseDuel());
    const s = table(K, S, { hands: [['brute', 'scout', 'blast'], []], fields: [['mentor'], []] });
    const [brute, scout, blast] = s.zones[0].hand;
    expect(T.derive(K, s, brute).cost).toEqual({ energy: 2 });
    expect(T.derive(K, s, scout).cost).toEqual({ energy: 0 });
    expect(T.derive(K, s, blast).cost).toEqual({ energy: 3 });
    const poor = clone(s);
    poor.pools[0].energy = 2;
    expect(names(K, poor)).toContain('cast brute');
  });

  it('set comes before add whatever their times; within a kind the later wins; removing abilities stops a strike', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['curse'], []], fields: [[], ['captain', 'brute']] });
    const brute = s.zones[1].field[1];
    s = named(K, s, `cast curse @brute#${brute}`);
    // the curse (later) sets power 0; the captain's aura (earlier) still adds 1 after it
    expect(stats(K, s, brute).power).toBe(1);
    expect(T.derive(K, s, brute).abilities).toEqual([]);
    const two = clone(s);
    two.pieces[brute].mods = [{ t: 9, set: { stats: { power: 2 } } }, { t: 5, set: { stats: { power: 7 } } }];
    expect(stats(K, two, brute).power).toBe(2 + 1);
  });

  it('the game\'s own world effect covers every side', () => {
    const G = responseDuel();
    G.world = [{ affects: { side: 'any', summon: true }, mod: { add: { stats: { guard: 1 } } } }];
    const { K, S } = at(G);
    const s = table(K, S, { fields: [['scout'], ['scout']] });
    expect(s.zones.map((Z) => stats(K, s, Z.field[0]).guard)).toEqual([2, 2]);
  });
});

describe('boosts, counters, ready', () => {
  it('a boost until the turn ends lasts the turn, and goes', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['rally'], []], fields: [['brute'], []] });
    const brute = s.zones[0].field[0];
    s = named(K, s, 'cast rally');
    expect(stats(K, s, brute)).toEqual({ power: 5, guard: 4 });
    s = named(K, s, `use brute#${brute}`);
    expect(life(s)).toEqual([20, 15]);
    s = named(K, s, 'end');
    expect(stats(K, s, brute)).toEqual({ power: 3, guard: 3 });
    expect(s.pieces[brute].mods).toBeUndefined();
  });

  it('counters last until the object leaves play', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['growth', 'growth', 'ruin'], []], fields: [['scout'], []] });
    const scout = s.zones[0].field[0];
    s = named(K, named(K, s, `cast growth @scout#${scout}`), `cast growth @scout#${scout}`);
    expect(stats(K, s, scout)).toEqual({ power: 3, guard: 3 });
    s = clone(named(K, named(K, s, 'end'), 'end'));
    expect(stats(K, s, scout)).toEqual({ power: 3, guard: 3 });
    // energy enough for the ruin (the turn's own allowance is still small)
    s.pools[0].energy = 9;
    s = named(K, s, `cast ruin @scout#${scout}`);
    expect(s.pieces[scout]).toMatchObject({ zone: 'discard' });
    expect(s.pieces[scout].counters).toBeUndefined();
  });

  it('a wand enters with its charges, each use spends one, and with none left it cannot be used', () => {
    const { K, S } = at(responseDuel());
    let s = named(K, table(K, S, { hands: [['wand'], []] }), 'cast wand');
    const wand = s.zones[0].field[0];
    expect(s.pieces[wand].counters).toEqual({ charge: 3 });
    for (let i = 0; i < 3; i++) {
      s = named(K, named(K, s, 'end'), 'end');
      s = named(K, s, `use wand#${wand} @plum`);
    }
    expect(s.pieces[wand].counters).toBeUndefined();
    expect(life(s)).toEqual([20, 14]);
    s = named(K, named(K, s, 'end'), 'end');
    expect(names(K, s).some((n) => n.startsWith(`use wand#${wand}`))).toBe(false);
  });

  it('ready: a summon that struck strikes again', () => {
    const { K, S } = at(responseDuel());
    let s = table(K, S, { hands: [['rouse'], []], fields: [['brute'], []] });
    const brute = s.zones[0].field[0];
    s = named(K, s, `use brute#${brute}`);
    s = named(K, s, `cast rouse @brute#${brute}`);
    s = named(K, s, `use brute#${brute}`);
    expect(life(s)).toEqual([20, 14]);
  });

  it('a step may empty a pool', () => {
    const G = responseDuel();
    G.round.turn[2].steps.push({ empty: 'energy' });
    const { K, S } = at(G);
    expect(named(K, S, 'end').pools[0].energy).toBe(0);
  });
});

describe('utilization of ready objects, and the computer', () => {
  it('a striker used is spent; one left ready while it could strike is idle', () => {
    const { K, S } = at(responseDuel());
    const s = table(K, S, { fields: [['brute', 'scout'], []], energy: [0, 0] });
    const [brute] = s.zones[0].field;
    const t = named(K, named(K, s, `use brute#${brute}`), 'end');
    expect(t.use[0]).toEqual({ ready: [1, 1] });
  });

  it('plays the rally before striking, and weighs an aura by what it does to others', () => {
    const { K, S } = at(responseDuel());
    const s = table(K, S, { hands: [['rally'], []], fields: [['brute', 'scout'], []], energy: [2, 0] });
    expect(M.think(K, s, { ...M.LEVELS.hard, seed: 1 }).move.name).toBe('cast rally');
  });
});
