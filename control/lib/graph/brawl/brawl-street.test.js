// A STREET FOUGHT DOWN (brawl-street.js, brawl-street-read.js): a world's `brawl.street` read, its screen a mana-ui
// spec, and what the street says of itself as it is played on the brawl's own sim: the player's health, the held
// screens beaten, the crowd left, the boss's bar, the two ends.
import { describe, it, expect } from 'vitest';
import { streetSpec, streetScreenOf, readStreet } from './brawl-street.js';
import { streetRead, streetRank } from './brawl-street-read.js';
import { brawlPreset, brawlLevel } from './brawl-levels.js';
import { brawlYardData, BRAWL_ROSTER } from './brawl-page.js';
import { streetOf, stepStreet, CROWD_TYPE_IDS } from './brawl-crowd.js';
import { solveFighter } from '../versus/versus-solver.js';
import { CPU_LEVELS } from '../versus/versus-cpu.js';
import { manaUi } from '../../mana-ui/index.js';

const BELT = brawlPreset('street').belt, T = CROWD_TYPE_IDS[0];
const held = BELT.screens.map((s, i) => (s.gate || s.boss ? i : -1)).filter((i) => i >= 0), bossAt = BELT.screens.findIndex((s) => s.boss);
const boss = { recipe: { ...solveFighter({ id: 'boss', archetype: 'grappler' }).recipe, archetype: 'grappler', name: 'Big Rig' }, plays: ['chain'], cpu: Object.keys(CPU_LEVELS)[0], hp: 150 };
const WAVES = held.map((screen) => (screen === bossAt ? { screen, crowd: [], boss } : { screen, crowd: [{ type: T, n: 2 }] }));
const STREET = { players: [0], waves: WAVES };
const me = BRAWL_ROSTER[0];
const mk = () => streetOf({ belt: BELT, players: [{ recipe: me.recipe, style: me.style }], waves: WAVES });

describe('a world\'s street, read', () => {
  it('settles who plays and its waves; a fault is said before the page', () => {
    expect(readStreet(STREET, BELT)).toMatchObject({ players: [0], things: [] });
    expect(() => readStreet({ players: [0] }, BELT)).toThrow(/waves/);
    expect(() => readStreet({ ...STREET, dummies: [] }, BELT)).toThrow(/dummies/);
    expect(() => readStreet({ waves: [{ screen: 0, crowd: [{ type: T, n: 1 }] }] }, BELT)).toThrow(/not held/);
  });
  it('a level is a yard or a street, and carries the street on its brawl block', () => {
    const M = brawlLevel({ kind: 'greybox', preset: 'street' }, { street: STREET });
    expect(M.brawl.street).toEqual(STREET);
    expect(() => brawlLevel({ kind: 'greybox', preset: 'street' }, { street: STREET, practice: {} })).toThrow(/not both/);
  });
  it('the page\'s data: the street in the yard\'s place, no dummies, the street\'s screen', () => {
    const D = brawlYardData({ belt: BELT, street: STREET });
    expect(D.street.waves).toEqual(WAVES);
    expect(D.dummies).toEqual([]);
    expect(Object.keys(D.yard.spec.screens).sort()).toEqual(['lost', 'moves', 'won']);
    // (its crowd's faces: a type, the boss or the rest → a roster index, checked against the roster)
    expect(brawlYardData({ belt: BELT, street: { ...STREET, cast: { '*': 1, boss: 2 } } }).street.cast).toEqual({ '*': [1], boss: [2] });
    expect(brawlYardData({ belt: BELT, street: { ...STREET, cast: { '*': [1, 2, 0] } } }).street.cast).toEqual({ '*': [1, 2, 0] });
    expect(() => brawlYardData({ belt: BELT, street: { ...STREET, cast: { boss: 99 } } })).toThrow(/roster index/);
    expect(() => readStreet({ ...STREET, cast: { boss: 'big' } }, BELT)).toThrow(/cast/);
    // (a practice yard's data is what it was: no street on it)
    expect(brawlYardData({ belt: brawlPreset('yard').belt, practice: {} }).street).toBeUndefined();
  });
});

describe('a street of the geotown', () => {
  const M = brawlLevel({ kind: 'town' }, { street: STREET });
  it('is the town\'s own recipe with the belt down its main street, between its cross streets', () => {
    expect(M).toMatchObject({ kind: 'geocube', show: 'geotown', geotown: { segment: 'main-street', hills: false } });
    const B = M.brawl.belt;
    expect(B.heading).toBe(0);
    expect(B.screens.some((s) => s.gate)).toBe(true);
    expect(B.depth[0]).toBeLessThan(0);                      // (the camera's side, toward the margin)
    expect(B.depth[1]).toBeGreaterThan(0);                   // (the far side, toward the shops)
  });
  it('a street longer than its block is refused, and says how long the block is', () => {
    expect(() => brawlLevel({ kind: 'town', screens: Array.from({ length: 8 }, () => ({ length: 16, gate: true })) })).toThrow(/between its cross streets/);
  });
  it('is seeded: the same words lay the same street', () => {
    expect(JSON.stringify(brawlLevel({ kind: 'town' }).brawl.belt)).toBe(JSON.stringify(brawlLevel({ kind: 'town' }).brawl.belt));
  });
});

describe('its screen', () => {
  it('is a spec the runtime reads, in the brawler\'s look, and draws on its state', () => {
    expect(() => manaUi.readSpec(streetSpec())).not.toThrow();
    expect(streetScreenOf().css).toContain('.mana-');
    const state = { brawl: { street: { hp: 400, hpMax: 1000, name: 'Kai', cleared: 1, of: 3, left: 4, boss: { on: false, name: '', hp: 0, hpMax: 1 }, moments: [], time: '0:31', moves: [] } } };
    const rt = manaUi.runtime(streetSpec(), { read: (p) => manaUi.readPath(state, p), act() {}, now: () => 1 });
    expect(rt.view()).toContain('Kai');
    expect(rt.view()).not.toContain('Big Rig');
    state.brawl.street.boss = { on: true, name: 'Big Rig', hp: 90, hpMax: 150 };
    rt.tick();                                            // (a value it read changed: drawn again)
    expect(rt.view()).toContain('Big Rig');
    rt.open('won');
    expect(rt.view()).toContain('Street cleared');
  });
});

describe('what a street says of itself', () => {
  it('at its start: full health, nothing beaten, no one on it, neither end', () => {
    const S = mk(), hp0 = S.s.bodies.map((b) => b.hp), R = streetRead(S, hp0);
    expect(R).toMatchObject({ hp: hp0[0], hpMax: hp0[0], cleared: 0, of: held.length, left: 0, won: false, lost: false });
    expect(R.boss.on).toBe(false);
  });
  it('every held screen beaten is the win; every player down the loss', () => {
    const S = mk(), hp0 = S.s.bodies.map((b) => b.hp);
    expect(streetRead({ ...S, s: { ...S.s, cleared: held } }, hp0)).toMatchObject({ won: true, cleared: held.length });
    expect(streetRead({ ...S, s: { ...S.s, bodies: S.s.bodies.map((b, i) => (i ? b : { ...b, ko: 1, hp: 0 })) } }, hp0)).toMatchObject({ lost: true, hp: 0 });
  });
  it('ranks a street by the health it is cleared with', () => {
    expect([1, 0.75, 0.6, 0.3, 0.1].map(streetRank)).toEqual(['S', 'S', 'A', 'B', 'C']);
    const S = mk(), hp0 = S.s.bodies.map((b) => b.hp);
    expect(streetRead(S, hp0).rank).toBe('S');
  });
  it('walked down on its own sim, the first held screen\'s crowd comes on and is counted', () => {
    let S = mk(); const hp0 = S.s.bodies.map((b) => b.hp);
    let seen = 0;
    for (let f = 0; f < 60 * 20 && !seen; f++) { S = stepStreet(S, [{ x: 1, z: 0 }]); seen = streetRead(S, hp0).left; }
    expect(seen).toBeGreaterThan(0);
  });
});
