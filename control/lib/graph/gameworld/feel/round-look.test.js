// The round's look (gameworld/feel/round-look.js): a buster's round as the anime register draws a charged shot. The
// concepts: the core white and the hue in the falloff (the ramp white, then the hue saturated, then the hue deep, one
// hue); the accent far round the wheel from the round's own; a charge level more of everything (rings, sparks, streaks,
// stretch, tail, halo), the tap no rings; the colour leads (another colour, another hue, the same shape); a lowered
// buster's looks one a level, the tap's first.
import { describe, it, expect } from 'vitest';
import { roundLook, roundLooks, ROUND_LOOK } from './round-look.js';
import { feelRule } from './lower.js';

const hue = (h) => { const n = parseInt(h.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, M = Math.max(r, g, b), d = M - Math.min(r, g, b); if (!d) return null; return ((M === r ? 60 * (((g - b) / d) % 6) : M === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)) + 360) % 360; };
const sat = (h) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255], M = Math.max(...c); return M ? (M - Math.min(...c)) / M : 0; };
const val = (h) => { const n = parseInt(h.slice(1), 16); return Math.max(n >> 16, (n >> 8) & 255, n & 255) / 255; };
const apart = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

describe('the round\'s look', () => {
  it('a white core, the hue in the falloff, one hue', () => {
    const L = roundLook({ color: 0x5dff7a, size: 0.15 }, 1);
    expect(L.ramp[0]).toBe('#ffffff');
    expect(apart(hue(L.ramp[1]), hue(L.ramp[2]))).toBeLessThan(2);
    expect(sat(L.ramp[1])).toBeGreaterThanOrEqual(ROUND_LOOK.chroma - 0.01);
    expect(val(L.ramp[2])).toBeLessThan(val(L.ramp[1]));
  });
  it('the accent far round the wheel', () => {
    const L = roundLook({ color: 0xffd23a, size: 0.4 }, 2);
    expect(apart(hue(L.accent), hue(L.ramp[1]))).toBeGreaterThanOrEqual(90);
  });
  it('a charge level more of everything, the tap no rings', () => {
    const [t, a, b] = [0, 1, 2].map((k) => roundLook({ color: 0xffd23a, size: 0.2 }, k));
    expect(t.rings).toBe(0);
    for (const key of ['rings', 'sparks', 'streaks', 'stretch', 'tail', 'halo']) { expect(a[key]).toBeGreaterThan(t[key]); expect(b[key]).toBeGreaterThan(a[key]); }
  });
  it('the colour leads: another colour, another hue, the same shape', () => {
    const a = roundLook({ color: 0xff3060, size: 0.2 }, 1), b = roundLook({ color: 0x3080ff, size: 0.2 }, 1);
    expect(apart(hue(a.ramp[1]), hue(b.ramp[1]))).toBeGreaterThan(90);
    expect({ ...a, color: 0, ramp: 0, accent: 0 }).toEqual({ ...b, color: 0, ramp: 0, accent: 0 });
  });
  it('a lowered buster\'s looks, one a level, the tap\'s first', () => {
    const B = feelRule({ pole: 'galaxy-boy', takes: true }).buster;
    const looks = roundLooks(B);
    expect(looks.length).toBe(1 + B.levels.length);
    expect(looks[0].rings).toBe(0);
    expect(looks[looks.length - 1].size).toBe(B.levels[B.levels.length - 1].size);
  });
});
