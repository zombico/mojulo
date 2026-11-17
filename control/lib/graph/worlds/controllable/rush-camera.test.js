// THE RUSH (rules-basic.js, the follow camera's `rush`): the chase stands further back and looks wider the faster its
// target goes, eased; absent, the chase is as it was and no field of view is said.
import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../controllable-world.js';
import { resolveWorldAudio } from '../../beats/beats-world.js';

const world = (rush) => createWorld({
  entities: [{ id: 'hero', pilotable: true, rule: { type: 'basic', speed: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }],
  camera: { rule: 'follow', target: 'hero', dist: 6, height: 3, ...(rush !== undefined ? { rush } : {}) },
});
// the target carried east at `v` m/s for `n` steps: how far behind it the camera ends, and the field of view it asks
const chase = (rush, v, n = 240) => {
  const w = world(rush), h = w.byId.hero;
  for (let i = 0; i < n; i++) { h.transform.pos = [h.transform.pos[0] + v / 60, 0, 0]; stepWorld(w, {}, 1 / 60, { ground: () => 0 }); }
  const c = w.camera;
  return { back: h.transform.pos[0] - c.transform.pos[0], fovK: c.fovK, k: c.rushK };
};

describe('the follow camera\'s rush', () => {
  it('stands further back and looks wider the faster its target goes, and not at a walk', () => {
    const slow = chase(true, 5), fast = chase(true, 40), mid = chase(true, 26);
    expect(slow.fovK).toBeCloseTo(1, 3);
    expect(fast.fovK).toBeGreaterThan(1.2);
    expect(mid.fovK).toBeGreaterThan(slow.fovK);
    expect(mid.fovK).toBeLessThan(fast.fovK);
    expect(fast.k).toBeGreaterThan(0.9);
    // (further back than the same chase without it, at the same speed)
    expect(fast.back).toBeGreaterThan(chase(undefined, 40).back + 1.5);
  });
  it('eases in, and without the word the chase says no field of view', () => {
    expect(chase(true, 40, 6).k).toBeLessThan(0.4);
    const plain = chase(undefined, 40);
    expect(plain.fovK).toBeUndefined();
    expect(plain.k).toBeUndefined();
  });
  it('the wind of that speed is an audio setting: defaults, its own numbers, refused past them', () => {
    expect(resolveWorldAudio({ rush: true }).rush).toEqual({ level: 0.5, at: 10, full: 40 });
    expect(resolveWorldAudio({ rush: { level: 0.3, full: 60 } }).rush).toEqual({ level: 0.3, at: 10, full: 60 });
    expect(resolveWorldAudio({ wind: true }).rush).toBeUndefined();
    expect(() => resolveWorldAudio({ rush: { loud: 1 } })).toThrow(/rush/);
  });
});
