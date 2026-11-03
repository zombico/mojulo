import { describe, it, expect } from 'vitest';
import { runSteps, MEADOWMARK } from './index.js';
import { gameStages, climbLadders, climbRoute, stageEnds } from './levels.js';

// A climb's level, as the hero plays it and as the audit walks it: the ladder its climb names laid as the surface the
// platform rule takes hold of (playscape's ladder), and the way up its builder laid (its flights by height, then the
// climb), so the walk reaches the top where a walk straight to the exit stood under it. One climb stage and one trail
// stage, chosen from the book's stages by what they lay.

const AUTO = { ...MEADOWMARK, mode: 'autonomous', review: undefined };
const stages = gameStages(AUTO);
const climb = stages.find((s) => s.manifest?.meru);
const trail = stages.find((s) => s.manifest?.trail && !s.manifest?.meru);
const steps = runSteps(AUTO, { ref: 'gw' });
const orderOf = (stage) => steps.find((s) => s.key === `level-${stage.level}-${stage.index}`).order;

describe('a climb\'s level', () => {
  it('lays a climbable surface for each climb its stage names, after its other entities; a trail lays none', () => {
    const ladders = climbLadders(climb.manifest);
    expect(ladders.length).toBeGreaterThan(0);
    for (const L of ladders) {
      expect(L).toMatchObject({ id: expect.stringMatching(/^ladder-/), rule: { type: 'climbable', speed: expect.any(Number) }, body: { type: 'none' } });
      // it mounts the tier above (a lip to step onto), its foot on the tier below
      expect(Array.isArray(L.rule.top)).toBe(true);
      expect(L.rule.length).toBeGreaterThan(0.6);
    }
    const E = orderOf(climb).manifest.entities;
    expect(E.slice(-ladders.length)).toEqual(ladders);
    expect(E[0].id).not.toMatch(/^ladder-/);
    // a stage with no climb: no ladder, its level as it was
    expect(climbLadders(trail.manifest)).toEqual([]);
    expect(orderOf(trail).manifest.entities.some((e) => String(e.id).startsWith('ladder-'))).toBe(false);
  });

  it('is walked up its own way: flights by height, then the climb to the top its exit stands on', () => {
    const R = climbRoute(climb.manifest);
    const legs = R.filter((x) => x.climb), points = R.filter((x) => Array.isArray(x));
    expect(points.length).toBeGreaterThan(1);
    expect(legs.length).toBe(climbLadders(climb.manifest).length);
    // the climb is the last thing climbed, and its top is the level's exit
    expect(R.at(-1).climb).toBeTruthy();
    expect(R.at(-1).climb.top).toBeCloseTo(stageEnds(climb.manifest).exit[2], 1);
    expect(R.at(-1).climb.seconds).toBeGreaterThan(3);
    // a trail lays no rising route (its exit is on the ground: the straight walk)
    expect(climbRoute(trail.manifest).filter((x) => x.climb)).toEqual([]);
    // pure: the same stage, the same route
    expect(climbRoute(structuredClone(climb.manifest))).toEqual(R);
  });
});
