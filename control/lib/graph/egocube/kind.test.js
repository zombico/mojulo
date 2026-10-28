// kind.test.js — the Egocube as a kind: a sheet rolled where it is written and kept by value, its nodes, the create call
// each node lowers to, and the lineup preview.
process.env.SQLITE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { readEgocubeKind, rollStored, egocubeNodes, egocubeCreate, egocubePrint, assembleEgocubeScene, LINEUP_GAP } from './kind.js';
import { rollEgocube } from './egocube.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { moveSetOf, creatureMovesOf, beastGaitsOf, READY_OF_ROLE, ATTACK_OF_ROLE, WIN_OF_ARCHETYPE } from './moves.js';
import { MOTION_GAITS } from '../polygonizer/hero-motion.js';
import { ROLES, ARCHETYPE_IDS } from './facets.js';

const THREAD = { kind: 'egocube', roll: { seed: 3, years: 11, facets: { pole: 'female' }, chapters: [{ chapter: 'time', years: 5 }, { chapter: 'time', years: 10 }] } };

describe('the egocube kind', () => {
  it('reads its words and refuses the rest by name', () => {
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { seed: 1 }, colour: 'red' })).toThrow(/'colour' is not part of an egocube/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { seed: 1, mood: 'x' } })).toThrow(/roll\.mood is not a roll word/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: { chapters: [] } })).toThrow(/give roll\.years/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: {}, dress: 'fancy' })).toThrow(/dress is 'designed' or 'kit'/);
  });

  it('rolls where it is written and keeps the sheet while the roll stands; a new roll rolls anew', () => {
    const one = rollStored({ kind: 'egocube', roll: { seed: 5 } });
    expect(one.sheet).toEqual(rollEgocube({ seed: 5 }));
    // a stored sheet is kept by value, even if the tables that rolled it later read otherwise
    const kept = rollStored({ kind: 'egocube', roll: { seed: 5 } }, { ...one, sheet: { ...one.sheet, kept: true } });
    expect(kept.sheet.kept).toBe(true);
    expect(rollStored({ kind: 'egocube', roll: { seed: 6 } }, one).sheet.seed).toBe(6);
    const T = rollStored(THREAD);
    expect(T.sheet).toBeUndefined();
    expect(egocubeNodes(T).map((n) => [n.years, n.band])).toEqual([[11, 'child'], [16, 'youth'], [26, 'adult']]);
    expect(egocubePrint(T)).toBe(egocubePrint(rollStored(THREAD)));
  });

  it('lowers a node to the create_character call its people take', () => {
    const T = rollStored(THREAD);
    const child = egocubeCreate(T), adult = egocubeCreate(T, { years: 26 });
    expect(child.create).toMatchObject({ as: 'hero', spec: { cast: { pole: 'female', build: 'child' } } });
    expect(adult.node).toEqual({ years: 26, band: 'adult' });
    expect(adult.create.spec.outfit).toMatchObject({ type: 'outfit' });   // designed by default
    expect(egocubeCreate(T, { years: 26, dress: 'kit' }).create.spec.outfit).toBeUndefined();
    expect(() => egocubeCreate(T, { years: 30 })).toThrow(/no node at 30 years \(the thread has 11, 16, 26\)/);
  });

  it('previews the character at each age, side by side, every camera holding the lineup', async () => {
    const scene = await assembleEgocubeScene(THREAD, { title: 'Wren' }, (m, c) => WORLD_KINDS.layered.resolve(m, c));
    const xs = scene.faces.filter((f) => !f.studio).flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2 * LINEUP_GAP - 0.2);
    expect(scene.figures).toBeUndefined();
    const front = scene.cameras.find((c) => c.name === 'front').worldFraming;
    const dist = Math.hypot(...front.cameraPosition.map((v, i) => v - front.lookAt[i]));
    expect(2 * dist * Math.tan((front.horizontalFov * Math.PI) / 360)).toBeGreaterThanOrEqual(Math.max(...xs) - Math.min(...xs));
  }, 300_000);

  it('previews a mascot output as its model sheet\'s turnaround: one character, four turns', async () => {
    const cube = { kind: 'egocube', roll: { brief: 'a weary paladin', seed: 3 }, output: 'mascot' };
    const scene = await assembleEgocubeScene(cube, { title: 'Paladin' }, (m, c) => WORLD_KINDS.layered.resolve(m, c));
    const body = scene.faces.filter((f) => !f.studio);
    expect(body.length % 4).toBe(0);
    // the four copies stand apart, and the last is turned to show its back (its front faces away from +y)
    const quarter = body.length / 4, ys = (i) => body.slice(i * quarter, (i + 1) * quarter).flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.max(...ys(0))).toBeCloseTo(-Math.min(...ys(3)), 2);
  }, 300_000);
});

describe('a cast as a cube (cast.js)', () => {
  const CAST = { kind: 'egocube', cast: { seed: 4, cast: { rival: { relation: 'rival', body: 'person' }, red: { relation: 'party', body: 'beast', species: 'wolf' } } } };

  it('is one roll or one cast, rolled where it is written and kept while the request stands', () => {
    expect(() => readEgocubeKind({ ...CAST, roll: { seed: 1 } })).toThrow(/one roll or one cast/);
    expect(() => readEgocubeKind({ kind: 'egocube', roll: {}, castSheet: {} })).toThrow(/castSheet is a cast's/);
    expect(() => readEgocubeKind({ kind: 'egocube', cast: { cast: { x: { relation: 'nemesis' } } } })).toThrow(/relation is one of/);
    const S = rollStored(CAST);
    expect(egocubeNodes(S).map((n) => [n.path, n.band])).toEqual([['hero', S.castSheet.members.hero.sheet.facets.age], ['hero/rival', S.castSheet.members['hero/rival'].sheet.facets.age], ['hero/red', 'beast']]);
    expect(rollStored(CAST, { ...S, castSheet: { ...S.castSheet, kept: true } }).castSheet.kept).toBe(true);
    expect(egocubePrint(S)).not.toBe(egocubePrint(rollStored({ ...CAST, cast: { ...CAST.cast, seed: 5 } })));
  });

  it('a beast\'s ooze rides to the animal door: the species made a game creature; none, the spec as it was', () => {
    const S = rollStored({ ...CAST, cast: { ...CAST.cast, cast: { ...CAST.cast.cast, red: { ...CAST.cast.cast.red, ooze: ['dire', { id: 'frost', strength: 0.5 }] } } } });
    expect(egocubeCreate(S, { member: 'hero/red' }).create.spec).toMatchObject({ species: 'wolf', ooze: ['dire', { id: 'frost', strength: 0.5 }] });
    expect(egocubeCreate(rollStored(CAST), { member: 'hero/red' }).create.spec).not.toHaveProperty('ooze');
  });

  it('lowers each member to its door, and refuses years on a cast and a member on one character', () => {
    const S = rollStored(CAST);
    expect(egocubeCreate(S).node.path).toBe('hero');
    expect(egocubeCreate(S, { member: 'hero/red' }).create).toEqual({ as: 'animal', spec: { species: 'wolf', motion: ['walk', 'trot', 'flinch', 'fall', 'rise'] }, title: 'hero/red · wolf' });
    expect(egocubeCreate(S, { member: 'hero/rival' }).member).toEqual({ path: 'hero/rival', relation: 'rival', body: 'person' });
    // a member on the hero door is made with its moves; every word is one the hero door takes
    const rival = egocubeCreate(S, { member: 'hero/rival' });
    expect(rival.moves).toEqual(moveSetOf(S.castSheet.members['hero/rival'].sheet.facets).moves);
    for (const w of Object.keys(rival.create.spec.motion)) expect(MOTION_GAITS[w], w).toBeTruthy();
    expect(egocubeCreate(rollStored(THREAD)).create.spec.motion).toBeUndefined();   // one character alone: as it was
    expect(() => egocubeCreate(S, { years: 20 })).toThrow(/made by path/);
    expect(() => egocubeCreate(rollStored(THREAD), { member: 'hero' })).toThrow(/this cube is one character/);
  });

  it('previews the cast standing in a line, the beast among them', async () => {
    const people = await assembleEgocubeScene({ ...CAST, cast: { seed: 4, cast: { rival: CAST.cast.cast.rival } } }, { title: 'Cast' }, (m, c) => WORLD_KINDS.layered.resolve(m, c));
    const all = await assembleEgocubeScene(CAST, { title: 'Cast' }, (m, c) => WORLD_KINDS.layered.resolve(m, c), (m, c) => WORLD_KINDS.animal.resolve(m, c));
    const span = (S) => { const xs = S.faces.filter((f) => !f.studio).flatMap((f) => f.corners.map((c) => c[0])); return Math.max(...xs) - Math.min(...xs); };
    expect(span(all)).toBeGreaterThan(span(people) + LINEUP_GAP / 2);
  }, 300_000);
});

describe('a cast member\'s moves (moves.js)', () => {
  it('reads its role and archetype into motion words the hero door takes; a non-combatant only takes a hit and wins', () => {
    for (const w of [...Object.values(READY_OF_ROLE), ...Object.values(ATTACK_OF_ROLE), ...Object.values(WIN_OF_ARCHETYPE), 'hitHigh', 'stagger', 'knockedOut']) expect(MOTION_GAITS[w], w).toBeTruthy();
    expect(Object.keys(WIN_OF_ARCHETYPE)).toEqual(ARCHETYPE_IDS);
    expect(Object.keys(READY_OF_ROLE).every((r) => ROLES[r])).toBe(true);
    expect(moveSetOf({ role: 'frontline', archetype: 'hero' }).moves).toEqual({ ready: 'guard', attack: 'cross', react: ['hitHigh', 'stagger', 'knockedOut'], win: 'fistToSky' });
    expect(moveSetOf({ role: 'non-combatant', archetype: 'ruler' }).motion).toEqual({ hitHigh: true, crossedArms: true });
  });

  it('a member below the hero door walks and jogs and keeps the moves its rig solves; a beast its two gaits', () => {
    expect(creatureMovesOf({ role: 'frontline', archetype: 'hero' }).motion).toEqual({ walk: true, jog: true, guard: true, cross: true, hitHigh: true, stagger: true, knockedOut: true });
    expect(creatureMovesOf({ role: 'caster', archetype: 'magician' }).moves).toEqual({ ready: 'centre', react: ['hitHigh', 'stagger', 'knockedOut'] });   // a showcase pose is a person's
    const S = rollStored({ kind: 'egocube', cast: { seed: 2, cast: { kin: { relation: 'party', body: 'beastkin', facets: { ancestry: 'lupine', humanity: 0.2 } } } } });
    const kin = egocubeCreate(S, { member: 'hero/kin' });
    expect(kin.create.as).toBe('creature');
    expect(Object.keys(kin.create.spec.plan.locomotion)).toEqual(expect.arrayContaining(['walk', 'jog', 'hitHigh', 'knockedOut']));
    expect(beastGaitsOf('wolf')).toEqual(['walk', 'trot']);
    expect(beastGaitsOf('baldEagle')).toEqual(['walk', 'hop']);   // a flier crosses the field on its feet
  });
});
