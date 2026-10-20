import { describe, it, expect } from 'vitest';
import { quickWorld, goalMechanics } from './quick.js';
import { runSteps, readGameworld } from './index.js';
import { RUNNER_CAMERA } from './levels.js';
import { composeMechanics, lowerMechanic } from '../game/mechanics.js';
import { listensForHits } from '../playscape/ui/cast.js';

const dash = (quick = {}) => quickWorld({ id: 'dash', quick: { goal: 'runner', ...quick } });
const level = (S) => S.find((s) => s.key.startsWith('level-')).order.manifest;

describe('a runner game: one level that is the run, a hero to run it', () => {
  it('the quick goal makes a hero, the run (its seed the level\'s) and the game; the chase camera looks well ahead', () => {
    const S = runSteps(dash(), { ref: 'gw' });
    expect(S.map((s) => s.key)).toEqual(['hero', 'level-run-0', 'game']);
    const m = level(S);
    expect(Number.isInteger(m.runner.seed)).toBe(true);
    expect(m.camera).toEqual({ rule: 'follow', target: 'hero', ...RUNNER_CAMERA });
    expect(m.entities[0].rule.type).toBe('platform');
    expect(m.game.mechanics).toEqual([{ kind: 'runner' }]);
    const game = S.find((s) => s.key === 'game').order;
    expect(() => composeMechanics(m.game.mechanics, { storeSchema: game.store, player: 'hero' })).not.toThrow();
    // the same world, the same run
    expect(level(runSteps(dash(), { ref: 'gw' })).runner).toEqual(m.runner);
  });

  it('a distance wins it; the runner\'s own settings ride on the level', () => {
    const m = level(runSteps(dash({ distance: 500, runner: { lanes: 4, speed: 11 } }), { ref: 'gw' }));
    expect(m.game.mechanics).toEqual([{ kind: 'runner', distance: 500 }]);
    expect(m.runner).toMatchObject({ lanes: 4, speed: 11 });
    expect(goalMechanics({ goal: 'runner' }, {})).toEqual([{ kind: 'runner' }]);
  });

  it('refuses what a run is not', () => {
    expect(() => dash({ hero: false })).toThrow(/runner runs a hero/);
    expect(() => dash({ camera: 'top-down' })).toThrow(/followed from behind/);
    expect(() => dash({ distance: 5 })).toThrow(/distance is the metres/);
    expect(() => dash({ climb: true })).toThrow(/climb: a runner is the run alone/);
    expect(() => quickWorld({ id: 'x', quick: { goal: 'reach', distance: 100 } })).toThrow(/belong to the runner goal/);
    expect(() => readGameworld({ id: 'w', levels: { a: { runner: true, walk: { nodes: { t: { trail: {} } } } } } })).toThrow(/a runner level is the run alone/);
    expect(() => readGameworld({ id: 'w', levels: { a: { runner: { lanes: 9 } } } })).toThrow(/levels\.a\.runner\.lanes/);
  });
});

describe('the run mechanic: scored off the runner\'s bus', () => {
  const lower = (p) => lowerMechanic('runner', p, { i: 0, player: 'hero' });
  it('endless: the crash ends it, the score its result; with a distance the distance wins and the crash fails', () => {
    expect(lower({}).on).toEqual({ 'runner:crash': { end: 'success' } });
    expect(lower({ distance: 300 }).on).toEqual({ 'run-won': { end: 'success' }, 'runner:crash': { end: 'fail' } });
    expect(lower({ distance: 300 }).world.watches).toEqual([{ type: 'run-won', when: { var: 'distance', gte: 300 } }]);
    expect(lower({}).keep.map((k) => k.var)).toEqual(['score', 'distance']);
    expect(() => lower({ distance: 3 })).toThrow(/distance is the metres/);
  });
  it('the page reads the runner\'s facts when the level listens for them', () => {
    expect(listensForHits({ reactions: lower({}).world.reactions })).toBe(true);
    expect(listensForHits({ reactions: [{ on: 'enter' }] })).toBe(false);
  });
});
