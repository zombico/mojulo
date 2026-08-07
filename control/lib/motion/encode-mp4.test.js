import { describe, it, expect } from 'vitest';

import { planClip } from './encode-mp4.js';

describe('planClip — resample a clip onto the output fps', () => {
  it('upsamples a slow clip, preserving real-time duration', () => {
    // 4 frames @ 8fps = 0.5s → at 12fps = 6 output frames
    const { outCount, indices } = planClip(4, 8, 12);
    expect(outCount).toBe(6);
    expect(indices).toEqual([0, 0, 1, 2, 2, 3]);
    expect(Math.max(...indices)).toBe(3); // never indexes past the source
  });

  it('stretches a very slow deck clip into many held frames', () => {
    // 3 frames @ 4fps = 0.75s → at 12fps = 9 output frames
    const { outCount, indices } = planClip(3, 4, 12);
    expect(outCount).toBe(9);
    expect(indices).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });

  it('downsamples a fast clip', () => {
    // 24 frames @ 24fps = 1s → at 12fps = 12 output frames
    const { outCount, indices } = planClip(24, 24, 12);
    expect(outCount).toBe(12);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(22);
    expect(Math.max(...indices)).toBeLessThan(24);
  });

  it('handles a fractional deck fps (still slideshow) without exploding', () => {
    // 2 slides at 0.4 fps (2.5s/slide) = 5s → at 24fps = 120 frames
    const { outCount } = planClip(2, 0.4, 24);
    expect(outCount).toBe(120);
  });

  it('clamps to at least one output frame', () => {
    const { outCount, indices } = planClip(1, 24, 12);
    expect(outCount).toBeGreaterThanOrEqual(1);
    expect(indices.every((i) => i >= 0)).toBe(true);
  });
});
