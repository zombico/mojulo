// A STREET FOUGHT DOWN (brawl-street.js, brawl-street-read.js): a world's `brawl.street` read, its screen a mana-ui
// spec, and what the street says of itself as it is played on the brawl's own sim: the player's health, the held
// screens beaten, the crowd left, the boss's bar, the two ends.
import { describe, it, expect } from 'vitest';
import { CROWD_RULES as RULES_OF_CROWD } from './brawl-crowd.js';
import { SEATS, seatState, streetSpec, streetScreenOf, readStreet } from './brawl-street.js';
import { streetRead, streetRank, streetSession, STREET_DIFFICULTY } from './brawl-street-read.js';
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
    // (a wave on an open screen is fought on the move: read as any other)
    expect(readStreet({ waves: [{ screen: 0, crowd: [{ type: T, n: 1 }] }] }, BELT).waves).toHaveLength(1);
    // (how it is played: the brawler's kit unless it says the run & gun's, with its guns and grenades)
    expect(readStreet(STREET, BELT).play).toBeUndefined();
    expect(readStreet({ ...STREET, play: 'gun' }, BELT)).toMatchObject({ play: 'gun', guns: ['machine-gun'], grenades: 3 });
    expect(() => readStreet({ ...STREET, play: 'kart' }, BELT)).toThrow(/play is/);
    expect(() => readStreet({ ...STREET, guns: ['spread'] }, BELT)).toThrow(/played gun/);
    expect(() => readStreet({ ...STREET, play: 'gun', guns: ['peashooter'] }, BELT)).toThrow(/guns\[0\]/);
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
    const state = { brawl: { street: { p1: { ...seatState(), on: true, name: 'Kai', hp: 400, hpMax: 1000 }, p2: { ...seatState(), open: true }, p3: seatState(), p4: seatState(), hp: 400, hpMax: 1000, cleared: 1, of: 3, left: 4, boss: { on: false, name: '', hp: 0, hpMax: 1 }, moments: [], time: '0:31', moves: [] } } };
    const rt = manaUi.runtime(streetSpec(), { read: (p) => manaUi.readPath(state, p), act() {}, now: () => 1 });
    expect(rt.view()).toContain('Kai');
    // (THE SEATS: four across the top sharing its width; one taken, one open and saying how to sit down, two the game
    // has not, their quarters kept)
    const top = rt.view().split('data-at="bottom')[0];
    expect(top).toContain('data-fill="yes"');
    expect(top).toContain('1P');
    expect(top).toContain('Press start');
    expect(top.match(/Press start/g)).toHaveLength(1);
    expect(top).not.toContain('3P');
    expect(SEATS).toHaveLength(4);
    // (a brawl's seat shows no gun and no box: one shade across the top, its health a strip in cells in its own colour,
    // no figures; a run & gun's its gun as its wireframe, its rounds as the figure and a belt, low said, its grenades as
    // pips; the sidearm endless)
    expect(top).not.toContain('mana-magazine');
    expect(top).not.toContain('class="mana-window"');
    expect(top).toContain('data-variant="scrim"');
    expect(top).toMatch(/class="mana-bar" data-figures="no"[^>]*data-side="0"[^>]*data-variant="hp"/);
    const gs = { brawl: { street: { ...state.brawl.street, p1: { ...state.brawl.street.p1, gunId: 'machine-gun', rounds: 30, size: 200, grenades: 2, grenadesMax: 3 } } } };
    const gv = manaUi.runtime(streetSpec('gun'), { read: (p) => manaUi.readPath(gs, p), act() {}, now: () => 1 }).view().split('data-at="bottom')[0];
    expect(gv).toContain('data-gun="machine-gun" data-low="yes"');
    expect(gv).toContain('>Low ammo<');
    expect(gv).toContain('●●○');
    gs.brawl.street.p1 = { ...gs.brawl.street.p1, gunId: 'sidearm', rounds: 0, size: 0, endless: true };
    const side = manaUi.runtime(streetSpec('gun'), { read: (p) => manaUi.readPath(gs, p), act() {}, now: () => 1 }).view();
    expect(side).toContain('>∞<');
    expect(side).not.toContain('Reload');
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

describe('a street\'s session: what a game\'s turn hands it', () => {
  const roster = [{ id: 'fighter-1' }, { id: 'fighter-2' }, { id: 'crowd-1' }];
  it('who plays is the roster entry picked, by its id; several are a seat each; none picked, as the street is written', () => {
    expect(streetSession({ __picks: { fighter: 'fighter-2' } }, roster, [0]).players).toEqual([1]);
    expect(streetSession({ __picks: { fighter: ['fighter-2', 'fighter-1'] } }, roster, [0]).players).toEqual([1, 0]);
    expect(streetSession({ __picks: { fighter: 'nobody' } }, roster, [0]).players).toEqual([0]);
    expect(streetSession({}, roster, [0])).toEqual({ players: [0], difficulty: null });
    expect(streetSession(undefined, roster, [0, 1])).toEqual({ players: [0, 1], difficulty: null });
  });
  it('how hard is the engine\'s tier, a row each: a crowd\'s rules over the street\'s, gentler below, the crowd\'s own pace at the top', () => {
    expect(streetSession({ difficulty: 'max' }, roster, [0]).difficulty).toBe('max');
    expect(streetSession({ difficulty: 'nightmare' }, roster, [0]).difficulty).toBeNull();
    // (each tier's breath between a body's attacks no shorter than the tier above's: measured, brawl-measure.js)
    expect(STREET_DIFFICULTY.easy.crowd.cool[0]).toBeGreaterThan(STREET_DIFFICULTY.medium.crowd.cool[0]);
    expect(STREET_DIFFICULTY.max.crowd.cool).toBeUndefined();
    const keys = Object.keys(typeof RULES_OF_CROWD === 'undefined' ? { tokens: 1, cool: 1, limit: 1 } : RULES_OF_CROWD);
    for (const T of Object.values(STREET_DIFFICULTY)) for (const k of Object.keys(T.crowd)) expect(keys).toContain(k);
    expect(STREET_DIFFICULTY.easy.crowd.tokens).toBeLessThan(STREET_DIFFICULTY.max.crowd.tokens);
  });
});
