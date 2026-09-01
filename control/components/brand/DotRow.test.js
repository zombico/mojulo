import { describe, it, expect } from 'vitest';

/**
 * The dot readout's arithmetic, extracted the way the component computes it.
 * The rule under test is the one the component exists to keep: a row must never
 * be able to sit permanently full, and "a few" must never look like "none".
 */
function dots(part, whole, cells = 10) {
  const ratio = whole > 0 ? Math.max(0, Math.min(1, part / whole)) : 0;
  const exact = ratio * cells;
  const on = part > 0 ? Math.max(1, Math.floor(exact)) : 0;
  const half = on < cells && exact - Math.floor(exact) > 0.25 ? 1 : 0;
  return { on, half };
}

describe('dot row proportions', () => {
  it('reads empty as empty', () => {
    expect(dots(0, 100)).toEqual({ on: 0, half: 0 });
  });

  it('lights one dot for a real but tiny part', () => {
    // 3 of 1550 rounds to nothing. It is still not nothing, and a shelf with
    // three things on it must not look like an empty shelf.
    expect(dots(3, 1550).on).toBe(1);
  });

  it('fills only at the whole', () => {
    expect(dots(1550, 1550)).toEqual({ on: 10, half: 0 });
    expect(dots(1549, 1550).on).toBeLessThan(10);
  });

  it('separates shelves that a raw-count row would flatten', () => {
    // The bug this component was rewritten to fix: scenes 335, models 1144 and
    // characters 71 all saturated a one-dot-per-unit row. As shares of the same
    // zone they must be visibly different.
    const zone = 1550;
    const scenes = dots(335, zone).on;
    const models = dots(1144, zone).on;
    const characters = dots(71, zone).on;
    expect(new Set([scenes, models, characters]).size).toBe(3);
    expect(models).toBeGreaterThan(scenes);
    expect(scenes).toBeGreaterThan(characters);
  });

  it('half-lights a real remainder', () => {
    expect(dots(1.6, 10).half).toBe(1);   // 1.6 of 10 cells
    expect(dots(1, 10).half).toBe(0);
  });

  it('never overflows its cells', () => {
    const { on, half } = dots(9999, 10);
    expect(on).toBe(10);
    expect(on + half).toBeLessThanOrEqual(10);
  });

  it('survives a missing whole rather than dividing by zero', () => {
    // An incoherent row (a part with no whole) shows "something is here"
    // rather than an empty shelf that is not empty. Nothing at all still
    // reads as nothing.
    expect(dots(5, 0)).toEqual({ on: 1, half: 0 });
    expect(dots(0, 0)).toEqual({ on: 0, half: 0 });
  });
});
