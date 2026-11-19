import { describe, it, expect } from 'vitest';
import { westernPerformanceTrack, JAW_TALK } from './western-read.js';
import { perform } from './perform.js';
import { westernKnots, WESTERN_FACE_TARGETS } from '../polygonizer/western-face-rig.js';

// The landmark head says a line: its face's targets from the take read as anime reads it, its mouth its jaw bone. One
// take carries every concept: the jaw opens on the words and shuts between them, the expression reaches the brows, the
// track is keyed as the anime face's is.

describe('a take on the landmark head', () => {
  const take = perform({ beats: [{ at: 0.12, say: 'The road is shut, since the spring.', face: 'worried' }], seconds: 2.6 });
  const T = westernPerformanceTrack(take, westernKnots(null));

  it('the jaw opens on the words and shuts between them, never past a talking jaw', () => {
    expect(T.jaw.t).toEqual(T.t);
    expect(Math.max(...T.jaw.d)).toBeGreaterThan(JAW_TALK * 0.3);
    expect(Math.max(...T.jaw.d)).toBeLessThanOrEqual(JAW_TALK);
    expect(T.jaw.d[0]).toBe(0);
    expect(new Set(T.jaw.d).size).toBeGreaterThan(3);
  });

  it('the expression reaches the face\'s targets, keyed from 0 to the take\'s end on its frames', () => {
    expect(T.w[0]).toHaveLength(WESTERN_FACE_TARGETS.length);
    const worried = WESTERN_FACE_TARGETS.indexOf('browWorried');
    expect(Math.max(...T.w.map((w) => w[worried]))).toBeGreaterThan(0.2);
    expect(T.t[0]).toBe(0);
    expect(T.t.at(-1)).toBe(2.6);
    expect(T.interp).toBe('STEP');
  });
});
