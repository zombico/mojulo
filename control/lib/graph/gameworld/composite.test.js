import { describe, it, expect } from 'vitest';
import { runSteps, composedStages, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { levelStep } from './chapters.js';

// The composite (runner.js composedStages): the game made of the levels the creator has accepted, one unit at a time,
// so it is always playable to its last accepted level. Absent, every level, byte for byte as before; given, those
// levels' stages alone, their gates chained over them, their links and a map's exits between them only.

const ref = 'gw';
const gameOf = (steps) => steps.find((s) => s.key === 'game');
const stageRefs = (steps, level) => steps.filter((s) => levelStep(level).test(s.key)).map((s) => s.ref);

describe('the composite', () => {
  for (const [name, world] of [['a book with its hero', MEADOWMARK_HERO], ['a world before its people', MEADOWMARK]]) {
    const ids = Object.keys(world.levels);

    it(`${name}: no composite is every level, as before`, () => {
      expect(JSON.stringify(runSteps(world, { ref, composite: undefined }))).toBe(JSON.stringify(runSteps(world, { ref })));
    });

    it(`${name}: one level accepted is a game of its stages alone, the first ungated, the rest chained`, () => {
      const all = runSteps(world, { ref });
      for (const id of ids) {
        const steps = runSteps(world, { ref, composite: [id] });
        const game = gameOf(steps).order;
        const own = stageRefs(all, id);
        expect(game.levels.map((l) => l.ref), id).toEqual(own);
        expect(game.levels[0].gate, id).toBeUndefined();
        // every gate is chained over the kept stages: none waits on a level the game does not hold
        for (const l of game.levels) if (l.gate) expect(own).toContain(l.gate.completed);
        for (const link of game.links ?? []) { expect(own).toContain(link.from.ref); expect(own).toContain(link.to.ref); }
        // its stages are still made as before (a level is its own unit's to make); only the game is the composite's
        expect(steps.filter((s) => s.key.startsWith('level-')).map((s) => s.print)).toEqual(all.filter((s) => s.key.startsWith('level-')).map((s) => s.print));
        // only its levels are walked after the game
        for (const a of steps.filter((s) => s.audit)) expect(own).toContain(a.ref);
      }
    });

    it(`${name}: every level accepted is the whole game; none accepted, no game yet`, () => {
      expect(gameOf(runSteps(world, { ref, composite: ids })).order).toEqual(gameOf(runSteps(world, { ref })).order);
      const none = runSteps(world, { ref, composite: [] });
      expect(gameOf(none)).toBeUndefined();
      expect(none.some((s) => s.audit)).toBe(false);
    });
  }

  it('a game grows as levels are accepted: its print moves, so a run remakes it', () => {
    const ids = Object.keys(MEADOWMARK_HERO.levels);
    const one = gameOf(runSteps(MEADOWMARK_HERO, { ref, composite: ids.slice(0, 1) })).print;
    const two = gameOf(runSteps(MEADOWMARK_HERO, { ref, composite: ids.slice(0, 2) })).print;
    expect(one).not.toBe(two);
    expect(gameOf(runSteps(MEADOWMARK_HERO, { ref, composite: [...ids.slice(0, 2)].reverse() })).print).toBe(two);
  });

  it('a map\'s exits lead only to kept stages', () => {
    const stages = [{ level: 'a' }, { level: 'b' }, { level: 'c' }], refs = ['ra', 'rb', 'rc'];
    const map = [{ on: [{ id: 'e', to: 'rb' }, { id: 'f', to: 'rc' }], back: [] }, { on: [], back: [{ id: 'g', to: 'ra' }] }, { on: [], back: [{ id: 'h', to: 'rb' }] }];
    const C = composedStages(stages, refs, map, ['a', 'c']);
    expect(C.refs).toEqual(['ra', 'rc']);
    expect(C.map).toEqual([{ on: [{ id: 'f', to: 'rc' }], back: [] }, { on: [], back: [] }]);
    expect(composedStages(stages, refs, map, undefined)).toEqual({ stages, refs, map });
  });
});
