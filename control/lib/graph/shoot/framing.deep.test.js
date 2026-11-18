// the sweep over the framing words' whole range: every size from every angle and side reads back as the size asked
// for (a tilt the size cannot hold is eased toward level and said so), the figure in the frame
import { describe, it, expect } from 'vitest';
import { solveFraming, ANGLES, SIDES } from './framing.js';
import { SIZES } from './frame.js';

const fig = { pos: [3, 2, 0], heading: 0.7, height: 1.75 };

describe('framing by words, swept', () => {
  it('every size × angle × side reads as its size, in the frame', () => {
    const misses = [];
    for (const z of SIZES) for (const a of ANGLES) for (const s of SIDES) {
      const r = solveFraming({ size: z.id, angle: a.id, side: s.id }, fig).read;
      if (r.size !== z.id || !r.in_frame) misses.push(`${z.id}/${a.id}/${s.id} → ${r.size}${r.in_frame ? '' : ' (out of frame)'}`);
    }
    expect(misses).toEqual([]);
  });
});
