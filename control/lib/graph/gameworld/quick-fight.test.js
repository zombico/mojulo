import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick } from './quick.js';
import { runSteps } from './runner.js';
import { settingOfGame } from './cast-setting.js';
import { readGameworld } from './world.js';

describe('quick: the fight goal', () => {
  // two fighters designed by the character loop (a sheet each) and one character already made
  const quick = { goal: 'fight', roster: ['hero', { id: 'bear', role: 'frontline', build: 'brute', style: 'grappler' }, { id: 'mira', hero: { ref: 'mira-ref' }, style: 'rushdown' }], rounds: 1, timer: 60 };

  it('runs each sheet into a character, then the arenas and the game, every fighter named by its character', () => {
    const world = quickWorld({ id: 'dojo-fight', quick });
    expect(world.camera).toBe('side');
    const steps = runSteps(world, { ref: 'gw_fight' });
    // (a fight made now strikes its own way, `strikes: 'own'`, and opens in the ring: the set that shows its fighters)
    expect(steps.map((s) => s.key)).toEqual(['fighter-fighter-1-sheet', 'fighter-fighter-1', 'fighter-bear-sheet', 'fighter-bear', 'level-arena-ring', 'level-arena-plaza', 'level-arena-nave', 'game']);
    const [sheet, made] = steps;
    // each sheet rolled in the game's setting (cast-setting.js), as every other quick goal's people are
    expect(sheet.order.manifest).toEqual({ kind: 'egocube', roll: { facets: { archetype: 'hero' }, seed: expect.any(Number), setting: settingOfGame(readGameworld(world), world.quick) } });
    expect(made.order).toMatchObject({ egocube: sheet.ref, title: expect.stringMatching(/^dojo-fight · The (Hero|Bully)$/) });
    const roster = [{ id: 'fighter-1', hero: { ref: made.ref } }, { id: 'bear', hero: { ref: steps[3].ref }, style: 'grappler' }, { id: 'mira', hero: { ref: 'mira-ref' }, style: 'rushdown' }];
    expect(steps[4].order.manifest).toMatchObject({ kind: 'stage', kit: 'gothic-nave', versus: { roster, rules: { rounds: 1, timer: 60 }, set: 'ring' } });
    expect(steps[5].order.manifest).toMatchObject({ kind: 'stage', kit: 'island-plaza', versus: { roster, rules: { rounds: 1, timer: 60 } } });
    const game = steps[7].order;
    expect(game).toMatchObject({ kind: 'game', engine: 'versus', title: 'dojo-fight', roster, rules: { rounds: 1, timer: 60 } });
    expect(game.arenas).toEqual([{ ref: steps[4].ref, name: 'Ring' }, { ref: steps[5].ref, name: 'Plaza' }, { ref: steps[6].ref, name: 'Nave' }]);
    // the same world runs the same steps (the sheets' seeds are the world's)
    expect(runSteps(world, { ref: 'gw_fight' })).toEqual(steps);
  });

  it('an arena that names a level is laid on that level by its lane; one that also says stage words is refused', () => {
    const world = quickWorld({ id: 'grey-fight', quick: { ...quick, arenas: [{ id: 'turned', level: { kind: 'greybox', preset: 'turned' } }, { id: 'nave', kit: 'gothic-nave' }] } });
    const steps = runSteps(world, { ref: 'gw_grey' }), arenas = steps.filter((s) => s.key.startsWith('level-arena-'));
    // (the level's own recipe, the fight's lane on it; the stage beside it as it always was)
    expect(arenas[0].order.manifest).toMatchObject({ kind: 'greybox', versus: { lane: { heading: 35 }, rules: { rounds: 1, timer: 60 } } });
    expect(arenas[0].order.manifest.versus.roster).toHaveLength(3);
    expect(arenas[1].order.manifest).toMatchObject({ kind: 'stage', kit: 'gothic-nave' });
    expect(arenas[1].order.manifest.versus).not.toHaveProperty('lane');
    expect(() => readQuick({ ...quick, arenas: [{ id: 'x', kit: 'gothic-nave', level: { kind: 'greybox', preset: 'flat' } }] })).toThrow(/kit beside level/);
    expect(() => readQuick({ ...quick, arenas: [{ id: 'x', level: { kind: 'greybox', preset: 'cliff' } }] })).toThrow(/preset/);
  });

  it('a fight made now: a boxer strikes with its character\'s own punches, in the game and its arenas, every other style its own moves; one minted before as it did', () => {
    const boxer = { id: 'joe', tradition: 'boxing' };
    const world = quickWorld({ id: 'own', quick: { goal: 'fight', roster: [boxer, 'hero', { id: 'mira', hero: { ref: 'mira-ref' }, moves: { 'stand.L': 'jab' } }] } });
    expect(world.quick.strikes).toBe('own');
    const steps = runSteps(world, { ref: 'gw_own' }), game = steps.at(-1).order, arena = steps.find((x) => x.key.startsWith('level-arena-')).order.manifest;
    // (the boxer its own; a fighter of another style keeps that style's moves, played on its own body all the same)
    expect(game.roster.map((e) => e.moves)).toEqual(['hero', undefined, { 'stand.L': 'jab' }]);
    expect(arena.versus.roster.map((e) => e.moves)).toEqual(['hero', undefined, { 'stand.L': 'jab' }]);
    // (the keyed moves when asked; and a fight stored before the word, which carries none)
    const keyed = runSteps(quickWorld({ id: 'keyed', quick: { goal: 'fight', strikes: 'tradition', roster: [boxer] } }), { ref: 'gw_keyed' }).at(-1).order;
    expect(keyed.roster[0].moves).toBeUndefined();
    const { strikes: _s, ...before } = world.quick;
    const old = runSteps({ ...world, quick: { ...before, roster: [boxer] } }, { ref: 'gw_before' });
    expect(old.at(-1).order.roster[0].moves).toBeUndefined();
    expect(old.filter((x) => x.key.startsWith('level-arena-')).map((x) => x.key)).toEqual(['level-arena-plaza', 'level-arena-nave']);
    expect(() => readQuick({ goal: 'fight', strikes: 'mine' })).toThrow(/strikes is 'own'/);
    expect(() => readQuick({ goal: 'reach', strikes: 'own' })).toThrow(/fight goal/);
  });

  it('with no roster, four sheets: one per style', () => {
    const steps = runSteps(quickWorld({ id: 'four', quick: { goal: 'fight' } }), { ref: 'gw_four' });
    const sheets = steps.filter((s) => s.key.endsWith('-sheet'));
    expect(sheets.map((s) => s.order.manifest.roll.facets.role)).toEqual(['frontline', 'flanker', 'caster', 'support']);
    expect(steps.at(-1).order.roster).toHaveLength(4);
  });

  it('teaches what a fight takes: characters, on arenas', () => {
    expect(() => readQuick({ goal: 'fight', hero: { cast: 'male' } })).toThrow(/a fight takes/);
    expect(() => readQuick({ goal: 'fight', roster: [{ id: 'x', archetype: 'tank' }] })).toThrow(/roster\[0\].*archetype is one of/);
    expect(() => readQuick({ goal: 'fight', roster: ['grappler'] })).toThrow(/roster\[0\].*a fight style: say who the fighter is/);
    expect(() => readQuick({ goal: 'fight', roster: [{ style: 'zoner', weapon: 'cannon' }] })).toThrow(/roster\[0\].*weapon/);
    expect(() => readQuick({ goal: 'fight', camera: 'top-down' })).toThrow(/side/);
    expect(() => readQuick({ goal: 'reach', rounds: 2 })).toThrow(/fight goal/);
    expect(() => readQuick({ goal: 'fight', arenas: [{ id: 'x', kit: 'moon' }] })).toThrow(/arenas\[0\].*kit/);
    expect(() => readQuick({ goal: 'fight', arenas: false })).toThrow(/fought on its arenas/);
    expect(() => readQuick({ goal: 'fight', stages: [] })).toThrow(/fought on its arenas/);
  });

  it('fields a beast-kin below the hero door: its sheet made into a character as a person\'s is (the tiered body, beast/)', () => {
    const world = quickWorld({ id: 'cats', quick: { goal: 'fight', roster: [{ facets: { ancestry: 'feline', humanity: 0.2 } }] } });
    const steps = runSteps(world, { ref: 'gw_cats' }), sheet = steps.find((s) => /-sheet$/.test(s.key)), made = steps[steps.indexOf(sheet) + 1];
    expect(sheet.order.manifest.roll.facets).toMatchObject({ ancestry: 'feline' });
    expect(made.order).toEqual({ egocube: sheet.ref, title: made.order.title });
  });
});
