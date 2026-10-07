/**
 * The platform: called by its deck area, still, shuttling or on a rail. It answers for itself (deck, sweep, headroom,
 * landing read), its island skin holds the object laws still or moving, and it lowers to the platformer world, where
 * a rider rides a rail.
 */
import { describe, expect, it } from 'vitest';

import { resolveObject } from './index.js';
import { platformParams, deckAt, landingRead, PLATFORM_VARIANT_IDS } from './platform.js';
import { objectMeasures, objectAdvice } from './measures.js';
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';

const plat = (spec) => resolveObject({ entry: 'platform', ...spec });

describe('the area budget', () => {
  it('sizes the walkable deck top: area and aspect give width and depth', () => {
    const p = platformParams({ area: 6, aspect: 1.5 });
    expect(p.w * p.d).toBeCloseTo(6, 4);
    expect(p.w / p.d).toBeCloseTo(1.5, 4);
  });

  it('reads as a rest, a step, a tight landing or too small', () => {
    expect([9, 4, 2, 1].map(landingRead)).toEqual(['rest', 'step', 'tight', 'too small']);
    expect(plat({ area: 1.2 }).landing).toEqual({ area: 1.2, read: 'too small' });
  });

  it('refuses a budget it cannot build, naming why', () => {
    expect(() => plat({ area: 0 })).toThrow(/square metres above 0/);
    expect(() => plat({ variant: 'hover' })).toThrow(/static, shuttle, rail/);
  });
});

describe('it answers for itself', () => {
  it('a rail deck runs its points by distance, round when it loops', () => {
    const p = platformParams({ rail: [[6, 0, 0], [6, 6, 0], [0, 6, 0]], loop: true }, 'rail');   // a square loop of 24 m
    expect(deckAt(p, 0.25)).toEqual([6, 0, 0]);
    expect(deckAt(p, 0.5)).toEqual([6, 6, 0]);
    expect(deckAt(p, 1)).toEqual([0, 0, 0]);
  });

  it('its sweep holds every pose, and the headroom over it is a rider\'s height', () => {
    const o = plat({ variant: 'shuttle', area: 4, travel: [8, 0, 3] });
    for (let i = 0; i <= 10; i++) {
      const c = plat({ variant: 'shuttle', area: 4, travel: [8, 0, 3], t: i / 10 }).collider[0];
      for (let k = 0; k < 3; k++) { expect(c.min[k]).toBeGreaterThanOrEqual(o.sweep.slab.min[k] - 1e-6); expect(c.max[k]).toBeLessThanOrEqual(o.sweep.slab.max[k] + 1e-6); }
    }
    expect(o.sweep.headroom.max[2] - o.sweep.slab.max[2]).toBeCloseTo(2.1, 6);
  });

  it('lowers a still deck to a floor face and a collider, a moving one to a carrier on its rail', () => {
    const s = plat({ area: 4 }).world;
    expect(s.faces[0].group).toBe('floor');
    expect(s.colliders).toHaveLength(1);
    const m = plat({ variant: 'rail', area: 4, rail: [[6, 0, 0], [6, 6, 2]], loop: true }).world.entities[0];
    expect(m.rule).toMatchObject({ type: 'mover', loop: true, mode: 'loop' });
    expect(m.body).toMatchObject({ type: 'mesh', shape: 'box', carrier: true, carryHalf: [1, 1], deck: 0.25 });
  });
});

describe('the island skin holds the object laws', () => {
  for (const variant of PLATFORM_VARIANT_IDS) for (const area of [1, 2, 4, 9]) {
    it(`${variant}, ${area} m²`, () => {
      const o = plat({ variant, skin: 'island', area });
      expect(objectAdvice(objectMeasures(o.faces, o.frame, o.interest), o.interest)).toEqual([]);
    });
  }
  it('a still island is a prop with no accent; a moving one is used, and carries it', () => {
    expect(plat({ skin: 'island' }).interest).toBe('prop');
    expect(plat({ variant: 'shuttle', skin: 'island' }).faces.some((f) => f.group === 'obj:status')).toBe(true);
  });
});

describe('in the platformer world', () => {
  it('a rider rides a rail platform round its loop', () => {
    const o = plat({ variant: 'rail', area: 4, rail: [[6, 0, 0], [6, 6, 0], [0, 6, 0]], loop: true, at: [0, 0, 10] });
    const e = { ...o.world.entities[0], id: 'deck' };
    const w = createWorld({ entities: [e, { id: 'hero', rule: { type: 'platform', speed: 0 }, transform: { pos: [0, 0, 10] } }] });
    const ground = (pos) => { const p = w.byId.deck.transform.pos; return Math.abs(pos[0] - p[0]) <= 1 && Math.abs(pos[1] - p[1]) <= 1 ? p[2] + 0.25 : null; };
    for (let i = 0; i < 120; i++) stepWorld(w, {}, 1 / 60, { ground });
    expect(w.byId.deck.transform.pos[0]).toBeCloseTo(6, 1);   // a quarter of an 8 s loop of 24 m in 2 s: the first corner
    expect(w.byId.hero.carriedBy).toBe('deck');
    expect(Math.abs(w.byId.hero.transform.pos[0] - w.byId.deck.transform.pos[0])).toBeLessThan(0.15);
  });
});
