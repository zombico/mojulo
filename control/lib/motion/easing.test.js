import { describe, it, expect } from 'vitest';
import { drag, dragCyclic, smooth } from './easing.js';

describe('motion/easing — drag (follow-through)', () => {
  it('an underdamped step LAGS, OVERSHOOTS, then SETTLES on the driver', () => {
    // step from 0 to 1 held; underdamped (c < 2√k).
    const step = [0, ...Array(40).fill(1)];
    const out = drag(step, 0.4, 0.4);
    expect(out[1]).toBeLessThan(1);                       // lags behind the step
    expect(Math.max(...out)).toBeGreaterThan(1);          // overshoots past it
    expect(out[out.length - 1]).toBeCloseTo(1, 2);        // settles on the driver
  });
  it('a flat (already-settled) series is unchanged', () => {
    const flat = Array(10).fill(3);
    expect(drag(flat, 0.5, 0.5).every((x) => Math.abs(x - 3) < 1e-9)).toBe(true);
  });
  it('dragCyclic returns a series the same length as the input (one steady cycle)', () => {
    const s = Array.from({ length: 12 }, (_, i) => smooth(i / 11));
    expect(dragCyclic(s, 0.4, 0.4, 3)).toHaveLength(12);
  });
});
