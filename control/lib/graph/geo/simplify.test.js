import { describe, expect, it } from 'vitest';
import { simplifyRing } from './simplify.js';

describe('simplifyRing', () => {
  it('removes a near-collinear interior point', () => {
    const ring = [
      [0, 0],
      [10, 0.01],
      [20, 0],
    ];
    const out = simplifyRing(ring, 0.5);
    expect(out).toEqual([
      [0, 0],
      [20, 0],
    ]);
  });

  it('keeps points outside the tolerance', () => {
    const ring = [
      [0, 0],
      [10, 5],
      [20, 0],
    ];
    const out = simplifyRing(ring, 0.5);
    expect(out).toHaveLength(3);
  });

  it('preserves a closed ring as closed', () => {
    const ring = [
      [0, 0],
      [10, 0.01],
      [20, 0],
      [20, 10],
      [0, 10],
      [0, 0],
    ];
    const out = simplifyRing(ring, 0.5);
    expect(out[0]).toEqual(out[out.length - 1]);
    expect(out.length).toBeLessThan(ring.length);
  });

  it('leaves small rings (<=3 distinct points) untouched', () => {
    const ring = [
      [0, 0],
      [10, 0],
      [5, 10],
      [0, 0],
    ];
    expect(simplifyRing(ring, 100)).toEqual(ring);
  });

  it('rejects negative tolerance', () => {
    expect(() => simplifyRing([[0, 0], [1, 1]], -0.1)).toThrow();
  });
});
