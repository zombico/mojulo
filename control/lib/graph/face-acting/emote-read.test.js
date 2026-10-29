// emote-read: the machine read of a held face on a mesh, on a small synthetic face (a mirrored grid of vertices, a
// symmetric target and a sided pair): the move per side, the asymmetry against the face's own mirror, whether it shows.
import { describe, it, expect } from 'vitest';
import { faceRead, heldWeights, regionReads, SHOWS } from './emote-read.js';

// (a 9 × 9 patch either side of x = 0, a metre's millimetres apart; `lift` raises both sides, `sneer` the figure's left)
const P = [], N = 9;
for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) for (const s of [-1, 1]) P.push(s * (0.002 + a * 0.002), b * 0.002, 0.1);
const positions = Float32Array.from(P), n = positions.length / 3;
const lift = new Float32Array(n * 3), sneer = new Float32Array(n * 3), sneerR = new Float32Array(n * 3), look = new Float32Array(n * 3);
for (let i = 0; i < n; i++) { lift[i * 3 + 1] = 0.002; (positions[i * 3] < 0 ? sneer : sneerR)[i * 3 + 1] = 0.003; look[i * 3] = 0.004; }
const mesh = { positions, deltas: { lift, sneerLeft: sneer, sneerRight: sneerR, eyeLookInLeft: look }, left: -1 };

describe('emote-read: does the face\'s unevenness show', () => {
  it('reads a symmetric hold as moving both sides alike, its asymmetry nil, and the look targets as no expression', () => {
    const R = faceRead(mesh, { lift: 1, eyeLookInLeft: 1 });
    expect(R.L.max).toBeCloseTo(2, 1);
    expect(R.R.max).toBeCloseTo(2, 1);
    expect(R.asymmetry.max).toBeLessThan(0.01);
    expect(R.shows).toBe(false);
  });

  it('reads a side alone as asymmetry on the figure\'s left, and a faint one as not showing', () => {
    const R = faceRead(mesh, { lift: 1, sneerLeft: 1 });
    expect(R.L.max).toBeCloseTo(5, 1);
    expect(R.R.max).toBeCloseTo(2, 1);
    expect(R.asymmetry.max).toBeCloseTo(3, 1);
    expect(R.shows).toBe(true);
    expect(faceRead(mesh, { lift: 1, sneerLeft: (SHOWS / 3) * 0.5 }).shows).toBe(false);
    // (both sides alike: nought, however much it moves)
    expect(faceRead(mesh, { sneerLeft: 0.8, sneerRight: 0.8 }).asymmetry.max).toBe(0);
  });

  it('says where the unevenness is: a region\'s read takes its own targets alone', () => {
    const M = { ...mesh, deltas: { browOuterLeft: sneer, browOuterRight: sneerR, smile: lift } };
    const R = regionReads(M, { browOuterLeft: 1, smile: 1 });
    expect(R.brows.asymmetry.max).toBeCloseTo(3, 1);
    expect(R.mouth.asymmetry.max).toBeLessThan(0.01);
    expect(R.lids.moved).toBe(0);
  });

  it('holds a clip by its median key, so a blink through it is not the face', () => {
    const w = [[0, 0.2], [0, 0.2], [1, 0.2], [0, 0.2], [0, 0.25]];
    expect(heldWeights(['blink', 'smile'], w)).toEqual({ blink: 0, smile: 0.2 });
  });
});
