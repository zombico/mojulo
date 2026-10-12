import { describe, it, expect } from 'vitest';
import { quickWorld, goalMechanics, farmCast, shootCast } from './quick.js';
import { resolveLevel, readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { concernLaws, SPACING, DRIVABLE, beatPosts, coverBlocks } from './lay-concerns.js';

// THE CONCERNS LAID: the world is laid for what game it is, before any goal reads it. The ground first (a field made
// level beside the start; a vehicle's ground eased), then the stage (the field where the plots go; a race's checkpoints
// spaced; cover by the fighting posts), and the laws measure what was laid.

const quick = (q, extra = {}) => quickWorld({ id: 'w', quick: { ...q }, ...extra });
const order = (W, q, extra) => {
  const G = readGameworld(W), s = gameStages(W)[0];
  return stageLevelOrder(G, s, { ref: 'x', goal: (ends) => goalMechanics(q, ends), ...(extra ? { extra } : {}) });
};

describe('the ground laid for the game', () => {
  it('a farm\'s field is flattened beside the start, after the creator\'s own edits; its stage carries where', () => {
    const W = quick({ goal: 'farm' });
    const R = resolveLevel(W, 'run');
    expect(R.laid).toEqual(['fields']);
    expect(R.level.ground.edits).toEqual([{ op: 'flatten', at: expect.stringMatching(/^[A-Z]2:[A-Z]3$/), id: 'intent-fields' }]);
    const own = quick({ goal: 'farm' }), ownEdit = { op: 'raise', at: 'A9', height: 2 };
    own.levels.run.ground = { edits: [ownEdit] };
    expect(resolveLevel(own, 'run').level.ground.edits[0]).toEqual(ownEdit);
    expect(gameStages(W)[0].field).toEqual(R.field);
  });
  it('a car\'s ground is eased under the level\'s own dials', () => {
    const W = quick({ goal: 'race', ride: 'car' });
    expect(resolveLevel(W, 'run').level.ground.tune).toEqual(DRIVABLE);
    W.levels.run.ground = { tune: { amplitude: 5 } };
    expect(resolveLevel(W, 'run').level.ground.tune.amplitude).toBe(5);
  });
  it('a world whose game lays nothing on the ground is as it was', () => {
    for (const W of [quick({ goal: 'reach' }), quick({ goal: 'shoot' }), quickWorld({ id: 'w', quick: { goal: 'collect' } })]) {
      const R = resolveLevel(W, 'run');
      expect(R.laid).toBeUndefined();
      expect(R.level.ground).toBeUndefined();
    }
  });
});

describe('the stage laid for the game, and its laws', () => {
  it('the farm\'s plots lie on the field the ground was made level for: the law holds', () => {
    const q = { goal: 'farm' }, W = quick(q), L = order(W, q, (ends) => farmCast(q, ends, 'fig'));
    expect(L.laws).toEqual([{ concern: 'fields', law: 'plots-level', holds: true, says: expect.any(String) }]);
    const crops = L.args.manifest.game.mechanics.find((m) => m.kind === 'crops');
    const field = resolveLevel(W, 'run').field, mid = crops.plots.reduce((a, p) => [a[0] + p.at[0] / crops.plots.length, a[1] + p.at[1] / crops.plots.length], [0, 0]);
    expect(Math.hypot(mid[0] - field[0], mid[1] - field[1])).toBeLessThan(4);
  });
  it('a race\'s checkpoints keep their spacing; with a car, its grade is drivable', () => {
    const q = { goal: 'race', ride: 'car' }, L = order(quick(q), q);
    const laws = Object.fromEntries(L.laws.map((l) => [l.law, l.holds]));
    expect(laws).toEqual({ 'checkpoints-spaced': true, 'grade-drivable': true });
  });
  it('a shooter\'s foes each have cover by them, from the world\'s cover concern', () => {
    const q = { goal: 'shoot', foes: 3 }, L = order(quick(q), q, (ends) => shootCast(q, ends, 'fig'));
    expect(L.laws).toEqual([{ concern: 'cover', law: 'cover-by-every-post', holds: true, says: 'cover by all 3 posts' }]);
    expect(L.args.manifest.blocks.filter((b) => b.form === 'wall').length).toBe(6);
  });
  it('a ranged game without a shooter\'s goal gets cover at its beats too (raised by the value, not the goal)', () => {
    const W = quick({ goal: 'reach' }, { intent: { cube: { power: { combat: ['ranged'] } } } });
    const L = order(W, { goal: 'reach' });
    expect(L.args.manifest.blocks.length).toBeGreaterThan(0);
    expect(L.laws[0]).toMatchObject({ concern: 'cover', holds: true });
  });
  it('the laws break on a level laid against them, and say where', () => {
    const ends = { spawn: [0, 0, 0], exit: [0, 60, 0], beats: [{ beat: 'reveal', at: [0, 20, 0] }, { beat: 'pocket', at: [0, 40, 12] }], ground: () => 0 };
    const posts = beatPosts(ends);
    expect(concernLaws(['cover'], { ends, blocks: [], posts })[0]).toMatchObject({ holds: false, says: 'no cover within 4.5 m of post-1, post-2' });
    expect(concernLaws(['cover'], { ends, blocks: coverBlocks(posts, ends), posts })[0].holds).toBe(true);
    const laps = { kind: 'laps', checkpoints: [{ at: [0, 5, 0] }, { at: [0, 60, 0] }] };
    expect(concernLaws(['circuit'], { ends, mechanics: [laps] })[0]).toMatchObject({ holds: false, says: `the shortest leg is 5.0 m (${SPACING} wanted)` });
    expect(concernLaws(['drivable'], { ends })[0]).toMatchObject({ holds: false, says: 'the steepest leg climbs 60% (25% at most)' });
    expect(concernLaws(['fields'], { ends, mechanics: [{ kind: 'crops', plots: [{ at: [0, 0, 0] }, { at: [2, 0, 1.2] }] }] })[0].holds).toBe(false);
  });
});
