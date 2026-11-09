import { describe, it, expect } from 'vitest';
import { farRange, RANGE } from './far-range.js';

// THE FAR RANGE: real mountains round a glyph map read in the form render, rising out of its rim with no seam, its peaks
// growing outward, the form's far land (`isekai:ridge`), the same map the same range.
const rim = { deep: 70, rise: 18 }, box = [0, -96, 144, 0], at = () => 2;

describe('the far range', () => {
  it('rises out of the rim\'s outer edge at its height, its peaks growing outward, the far land\'s group', () => {
    const F = farRange({ box, at, seed: 3, rim });
    expect(F.every((f) => f.group === 'isekai:ridge' && f.normal[2] >= 0)).toBe(true);
    // (the first ring: the rim's top, 2 m of land + the rim's rise − its seat)
    const first = F.slice(0, F.length / (RANGE.rings.length - 1));
    for (const f of first) for (const c of f.corners.slice(0, 2)) expect(c[2]).toBeCloseTo(2 - 0.15 + rim.rise, 5);
    // (the farthest ring stands well over the first: mountains, never a flat plain)
    const z = (f) => f.corners[2][2], last = F.slice(-first.length);
    expect(Math.max(...last.map(z))).toBeGreaterThan(2 + rim.rise + RANGE.lift + RANGE.peak * 0.3);
  });

  it('is the same range for the same map, another for another seed', () => {
    expect(JSON.stringify(farRange({ box, at, seed: 3, rim }))).toBe(JSON.stringify(farRange({ box, at, seed: 3, rim })));
    expect(JSON.stringify(farRange({ box, at, seed: 4, rim }))).not.toBe(JSON.stringify(farRange({ box, at, seed: 3, rim })));
  });
});
