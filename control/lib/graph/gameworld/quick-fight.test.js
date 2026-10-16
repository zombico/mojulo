import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick } from './quick.js';
import { runSteps } from './runner.js';

describe('quick: the fight goal', () => {
  // two fighters designed by the character loop (a sheet each) and one character already made
  const quick = { goal: 'fight', roster: ['hero', { id: 'bear', role: 'frontline', build: 'brute', style: 'grappler' }, { id: 'mira', hero: { ref: 'mira-ref' }, style: 'rushdown' }], rounds: 1, timer: 60 };

  it('runs each sheet into a character, then the arenas and the game, every fighter named by its character', () => {
    const world = quickWorld({ id: 'dojo-fight', quick });
    expect(world.camera).toBe('side');
    const steps = runSteps(world, { ref: 'gw_fight' });
    expect(steps.map((s) => s.key)).toEqual(['fighter-fighter-1-sheet', 'fighter-fighter-1', 'fighter-bear-sheet', 'fighter-bear', 'level-arena-plaza', 'level-arena-nave', 'game']);
    const [sheet, made] = steps;
    expect(sheet.order.manifest).toEqual({ kind: 'egocube', roll: { facets: { archetype: 'hero' }, seed: expect.any(Number) } });
    expect(made.order).toMatchObject({ egocube: sheet.ref, title: expect.stringMatching(/^dojo-fight · The (Hero|Bully)$/) });
    const roster = [{ id: 'fighter-1', hero: { ref: made.ref } }, { id: 'bear', hero: { ref: steps[3].ref }, style: 'grappler' }, { id: 'mira', hero: { ref: 'mira-ref' }, style: 'rushdown' }];
    expect(steps[4].order.manifest).toMatchObject({ kind: 'stage', kit: 'island-plaza', versus: { roster, rules: { rounds: 1, timer: 60 } } });
    const game = steps[6].order;
    expect(game).toMatchObject({ kind: 'game', engine: 'versus', title: 'dojo-fight', roster, rules: { rounds: 1, timer: 60 } });
    expect(game.arenas).toEqual([{ ref: steps[4].ref, name: 'Plaza' }, { ref: steps[5].ref, name: 'Nave' }]);
    // the same world runs the same steps (the sheets' seeds are the world's)
    expect(runSteps(world, { ref: 'gw_fight' })).toEqual(steps);
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

  it('refuses a sheet whose people is below the hero door, until the creature bodies come', () => {
    const world = quickWorld({ id: 'cats', quick: { goal: 'fight', roster: [{ facets: { ancestry: 'feline', humanity: 0.2 } }] } });
    expect(() => runSteps(world, { ref: 'gw_cats' })).toThrow(/rolls a feline body below the hero door/);
  });
});
