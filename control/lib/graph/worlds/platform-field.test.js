import { describe, expect, it } from 'vitest';

import { platformField } from './platform-field.js';
import { createWorld, stepWorld } from './controllable-world.js';

// platformField authors platformer level geometry: walkable island tops + matching AABB colliders +
// mover carriers, so the walkable surface and its collision box can never drift (platformer.plan.md P1).

describe('platformField', () => {
  it('emits a walkable top face + a matching AABB collider per static island', () => {
    const f = platformField({ islands: [{ at: [0, 0, 0], size: [4, 6] }, { at: [10, 0, 2], size: 2 }] });
    expect(f.faces).toHaveLength(2);
    expect(f.colliders).toHaveLength(2);
    // island 0: top quad at z=0, 4x6 footprint; collider box spans the thickness below the top.
    expect(f.faces[0].group).toBe('floor');
    expect(f.faces[0].corners).toHaveLength(4);
    expect(f.faces[0].corners.every((c) => c[2] === 0)).toBe(true);
    expect(f.colliders[0]).toEqual({ min: [-2, -3, -1.5], max: [2, 3, 0] });
    // island 1: scalar size 2 → 1x1 half-extents at z=2.
    expect(f.colliders[1]).toEqual({ min: [9, -1, 0.5], max: [11, 1, 2] });
  });

  it('emits a mover carrier entity per moving platform (typed body so it survives normalize)', () => {
    const f = platformField({ movers: [{ from: [0, 0, 5], to: [8, 0, 5], size: [3, 3], period: 6 }] });
    expect(f.entities).toHaveLength(1);
    const e = f.entities[0];
    expect(e.rule.type).toBe('mover');
    expect(e.rule.period).toBe(6);
    expect(e.body.type).toBe('platform');       // required — a typeless body is dropped by normalizeEntity
    expect(e.body.carrier).toBe(true);
    expect(e.body.carryHalf).toEqual([1.5, 1.5]);
    expect(e.transform.pos).toEqual([0, 0, 5]);
  });

  it('passes hazards / spawn / exit through for the game channel', () => {
    const f = platformField({
      hazards: [{ at: [4, 0, 0], radius: 1.2, damage: 20 }],
      spawn: [0, 0, 1], exit: [20, 0, 4],
    });
    expect(f.hazards).toEqual([{ at: [4, 0, 0], radius: 1.2, damage: 20 }]);
    expect(f.spawn).toEqual([0, 0, 1]);
    expect(f.exit).toEqual([20, 0, 4]);
  });

  it('its mover carrier actually carries a rider in the engine (end-to-end)', () => {
    const f = platformField({ movers: [{ id: 'lift', from: [0, 0, 10], to: [10, 0, 10], size: [3, 3], period: 4 }] });
    const w = createWorld({ entities: [...f.entities, { id: 'hero', rule: { type: 'platform', speed: 0 }, transform: { pos: [0, 0, 10] } }] });
    const ground = (pos) => {
      const p = w.byId.lift.transform.pos;
      return (Math.abs(pos[0] - p[0]) <= 1.5 && Math.abs(pos[1] - p[1]) <= 1.5) ? 10 : null;
    };
    for (let i = 0; i < 60; i++) stepWorld(w, {}, 1 / 60, { ground });
    expect(w.byId.lift.transform.pos[0]).toBeGreaterThan(0.2);
    expect(Math.abs(w.byId.hero.transform.pos[0] - w.byId.lift.transform.pos[0])).toBeLessThan(0.15);
    expect(w.byId.hero.carriedBy).toBe('lift');
  });

  it('throws a teaching error on a malformed island / mover', () => {
    expect(() => platformField({ islands: [{ size: 4 }] })).toThrow(/needs an at/);
    expect(() => platformField({ movers: [{ from: [0, 0, 0] }] })).toThrow(/needs from.*and to/);
  });
});
