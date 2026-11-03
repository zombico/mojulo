import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel } from './world.js';
import { gameStages, stageEnds } from './levels.js';
import { quickWorld } from './quick.js';
import { runSteps } from './runner.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

// a level that is a town (geotown/): walked from its streets, drawn on its cube in the seventh generation
const TOWN = { pattern: 'old-town', streetscape: 'old-centre', segment: 'main-street' };
const WORLD = { id: 'town-walk', name: 'Town walk', seed: 3, levels: { town: { name: 'The old town', geotown: TOWN } } };

describe('a geotown level', () => {
  it('reads as the town alone, on its cube, read in the seventh generation unless the cube names its era', () => {
    const R = resolveLevel(readGameworld(WORLD), 'town');
    expect(R.geotown).toMatchObject({ spec: TOWN, cube: { from: 'valley-morning', era: 'gen-7' } });
    expect(resolveLevel(readGameworld({ ...WORLD, style: { geocube: { from: 'upland-morning', era: 'gen-6' } } }), 'town').geotown.cube.era).toBe('gen-6');
    expect(() => readGameworld({ ...WORLD, levels: { town: { geotown: TOWN, walk: { nodes: { a: { trail: true } } } } } })).toThrow(/the town alone/);
    expect(() => readGameworld({ ...WORLD, levels: { town: { geotown: { pattern: 'no-such-town' } } } })).toThrow(/geotown/);
  });

  it('is one stage, set down on the town\'s walk and ended across its first block, on its own ground', () => {
    const S = gameStages(WORLD);
    expect(S.map((s) => s.section)).toEqual(['geotown']);
    expect(S[0].manifest).toMatchObject({ kind: 'geocube', show: 'geotown', geotown: TOWN });
    const E = stageEnds(S[0].manifest);
    expect(E.planar).toBe(true);
    expect(Math.hypot(E.exit[0] - E.spawn[0], E.exit[1] - E.spawn[1])).toBeGreaterThan(10);
    // (both on the town's ground, never a roof: the ground there is where they stand)
    for (const p of [E.spawn, E.exit]) expect(E.ground(p[0], p[1])).toBeCloseTo(p[2], 2);
    expect(E.beats.length).toBeGreaterThan(0);
  }, 120_000);

  it('a quick game walks it: its hero made, the level piloted by it to the far side, the game; refused beside another ground', async () => {
    const W = quickWorld({ id: 'old-town-walk', name: 'Old town walk', seed: 3, quick: { goal: 'reach', geotown: TOWN, hero: { form: 'realistic', cast: 'male' }, camera: 'third-person' } });
    const S = runSteps(W, { ref: 'gw' });
    expect(S.map((s) => s.key)).toEqual(['hero', 'level-run-0', 'game']);
    const m = S[1].order.manifest;
    expect(m).toMatchObject({ kind: 'geocube', show: 'geotown', cube: { era: 'gen-7' } });
    expect(m.entities.some((e) => e.pilotable)).toBe(true);
    expect(m.game.mechanics.map((x) => x.kind)).toContain('reach-exit');
    expect(() => quickWorld({ id: 'x', quick: { goal: 'reach', geotown: TOWN, building: { use: 'tavern' } } })).toThrow(/the town alone/);
    expect(() => quickWorld({ id: 'x', quick: { goal: 'race', geotown: TOWN } })).toThrow(/reach, collect or survive/);
    // the page draws the town under the level's pilot and game, no stand-in walking it
    // (its hero's sketch is a run's: the page is read here without the figure it would wear)
    const { figures: _f, ...bare } = m;
    const { payload } = await resolveWorldScene({ ref: 'gw-level', title: 'Old town walk', manifest: { ...bare, entities: m.entities.map(({ figure: _g, ...e }) => e) } });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect((payload.walkers ?? []).length).toBe(0);
  }, 300_000);
});
