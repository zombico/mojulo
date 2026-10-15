import { describe, it, expect } from 'vitest';
import { quickWorld, readQuick } from './quick.js';
import { runSteps } from './runner.js';
import { versusGameData } from '../versus/versus-page.js';

describe('quick: the fight goal', () => {
  const quick = { goal: 'fight', roster: [{ id: 'ryu-ish', archetype: 'all-rounder' }, { id: 'bear', archetype: 'grappler', signature: ['heavy'] }], rounds: 1, timer: 60 };

  it('runs to one game row: the versus manifest, its roster solved where it plays', () => {
    const world = quickWorld({ id: 'dojo-fight', quick });
    expect(world.camera).toBe('side');
    const steps = runSteps(world, { ref: 'gw_fight' });
    expect(steps.map((s) => s.key)).toEqual(['game']);
    const game = steps[0].order;
    expect(game).toMatchObject({ kind: 'game', engine: 'versus', title: 'dojo-fight', rules: { rounds: 1, timer: 60 } });
    const data = versusGameData(game);
    expect(data.roster.map((r) => r.id)).toEqual(['ryu-ish', 'bear']);
    expect(data.roster[1].recipe.hp).toBe(1200);
    expect(data.rules).toEqual({ rounds: 1, timer: 60 });
  });

  it('teaches what a fight takes', () => {
    expect(() => readQuick({ goal: 'fight', hero: { cast: 'male' } })).toThrow(/a fight takes/);
    expect(() => readQuick({ goal: 'fight', roster: [{ id: 'x', archetype: 'tank' }] })).toThrow(/roster\[0\].*archetype/);
    expect(() => readQuick({ goal: 'fight', camera: 'top-down' })).toThrow(/side/);
    expect(() => readQuick({ goal: 'reach', rounds: 2 })).toThrow(/fight goal/);
  });
});
