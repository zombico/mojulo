import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { tabletopGame } from './tabletop.js';
import { CHESS } from './games/chess.js';
import { deckGame } from './fixtures/cards.js';
import { tileGame } from './fixtures/tiles.js';
import { islandEconomy } from './fixtures/island-economy.js';

const T = buildTabletop();
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('objects: one table, one namespace', () => {
  it('every mode keeps its things as objects: board pieces, cards in zones, laid tiles and claims', () => {
    const chess = at(CHESS);
    expect(chess.S.pieces).toHaveLength(32);
    expect(chess.S.pieces[chess.S.board[0]]).toMatchObject({ side: 0, at: 0 });
    const deck = at(deckGame());
    for (const [s, Z] of deck.S.zones.entries()) for (const z of ['deck', 'hand']) for (const id of Z[z]) expect(deck.S.pieces[id]).toMatchObject({ side: s, at: -1, zone: z });
    const tiles = at(tileGame());
    const start = tiles.S.tiles.findIndex((x) => x !== null);
    expect(tiles.S.pieces[tiles.S.tiles[start]]).toMatchObject({ kind: 'wall-cap-path', side: -1, at: start, rot: 0 });
  });

  it('pieces, card types, tile types and the economy\'s cards share one namespace: a name used twice is refused', () => {
    const { K } = at(islandEconomy({ seed: 1, players: 3 }));
    expect(K.defs.settlement.family).toBe('piece');
    expect(K.defs.knight.family).toBe('card');
    const G = deckGame();
    G.pieces = { coin1: { glyph: '' } };
    expect(() => tabletopGame(G)).toThrow(/names both a piece and a card/);
  });
});

describe('objects: characteristics derived', () => {
  it('an object with no counters and no modifiers is its definition itself, shared', () => {
    const { K, S } = at(deckGame());
    const id = S.zones[0].hand[0];
    expect(T.derive(K, S, id)).toBe(K.defs[S.pieces[id].kind]);
  });

  it('modifiers apply set, then add, then counters, then grant and remove, by timestamp within each', () => {
    const { K, S } = at(deckGame());
    const s = clone(S);
    const id = s.zones[0].hand[0];
    // this compile's own definition, given stats
    K.defs[s.pieces[id].kind].stats = { power: 1, guard: 1 };
    // written out of order: the add (t 1) before the set (t 2) in time, the set still first by kind
    s.pieces[id].mods = [
      { t: 2, set: { stats: { power: 3 }, cost: 4 }, grant: [{ fly: true }] },
      { t: 1, add: { stats: { power: 2 }, cost: -1 } },
      { t: 3, remove: [{ fly: true }], grant: [{ swim: true }] },
    ];
    s.pieces[id].counters = { power: 1, charge: 2 };
    const c = T.derive(K, s, id);
    // set 3, add 2, the power counter 1; a counter not named after a stat changes no stat
    expect(c.stats).toEqual({ power: 6, guard: 1 });
    expect(c.cost).toBe(3);
    expect(c.abilities).toEqual([{ swim: true }]);
    // the definition is untouched
    expect(K.defs[s.pieces[id].kind].stats).toEqual({ power: 1, guard: 1 });
    s.pieces[id].mods.push({ t: 4, remove: 'all' });
    expect(T.derive(K, s, id).abilities).toEqual([]);
  });

  it('a card leaving play keeps no counters, exhaustion or modifiers', () => {
    const { K, S } = at(deckGame());
    let s = clone(S);
    const coin = s.zones[0].hand.find((id) => s.pieces[id].kind === 'coin1');
    s = T.apply(K, s, T.legal(K, s).find((m) => m.name === 'play coin1'));
    const played = s.zones[0].play[0];
    expect(played).toBe(coin);
    Object.assign(s.pieces[played], { ready: false, counters: { charge: 1 }, mods: [{ t: 1, add: { coin: 1 } }] });
    s = T.apply(K, s, T.legal(K, s).find((m) => m.type === 'end'));
    const o = s.pieces[played];
    expect(['discard', 'deck', 'hand']).toContain(o.zone);
    expect(o).not.toHaveProperty('ready');
    expect(o).not.toHaveProperty('counters');
    expect(o).not.toHaveProperty('mods');
  });

  it('a modifier is read where the rules read the card: a treasure given a coin plays for it', () => {
    const { K, S } = at(deckGame());
    const s = clone(S);
    const id = s.zones[0].hand.find((x) => s.pieces[x].kind === 'coin1');
    s.zones[0].hand = [id];
    s.pieces[id].mods = [{ t: 1, add: { coin: 2 } }];
    const m = T.legal(K, s).find((x) => x.name === 'play coin1');
    expect(m.id).toBe(id);
    expect(T.apply(K, s, m).act.coins).toBe(3);
  });
});
