// The light a room's palette asks for (room-light.js): its surfaces' colours at arm's length from its median lamp are
// targets, and the bases and the lamps' light are solved so the renderer shows them there.
import { describe, expect, it } from 'vitest';
import { solveRoomLight, falloff, referenceLamp, ROOM_LIGHT, CONTRAST_MOST } from './room-light.js';
import { seen, luminance, BASE_MAX } from '../color-theorist/light.js';

const LAMPS = [{ color: '#ffa850', intensity: 1.7, radius: 7.5 }, { color: '#ffa850', intensity: 1.2, radius: 6 }, { color: '#e8f0ff', intensity: 2.4, radius: 9 }];
const TARGETS = { brick: '#8a4a36', stone: '#8c867a', marble: '#b89a7c' };

describe('a room\'s light solved from its palette', () => {
  const S = solveRoomLight({ targets: TARGETS, ambient: [0.28, 0.32, 0.43], lights: LAMPS });

  it('each surface shows its target at the reference, square to the median lamp', () => {
    const ref = referenceLamp(LAMPS), i = LAMPS.indexOf(ref), sun = S.keys[i].map((v) => v * falloff(ROOM_LIGHT.at, ref.radius));
    expect(ref.intensity).toBe(1.7);
    for (const [role, hex] of Object.entries(TARGETS)) {
      const got = seen(S.bases[role], { ambient: S.ambient, sun }, 1), want = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
      [1, 3, 5].forEach((k, c) => expect(Math.abs(parseInt(got.slice(k, k + 2), 16) - want[c]), role).toBeLessThanOrEqual(3));
    }
  });

  it('the brightest base is as bright as a material may be; a lamp\'s light is in its intensity\'s share', () => {
    expect(S.unreached).toEqual({});
    expect(Math.max(...Object.values(S.bases).map(luminance))).toBeCloseTo(BASE_MAX, 3);
    expect(luminance(S.keys[2]) / luminance(S.keys[0])).toBeCloseTo(2.4 / 1.7, 1);
    expect(S.contrast).toBeGreaterThan(0);
    expect(S.contrast).toBeLessThanOrEqual(CONTRAST_MOST);
  });

  it('the falloff is whole inside near, nothing at the radius, and falls between', () => {
    expect(falloff(0.5, 7)).toBe(falloff(ROOM_LIGHT.near, 7));
    expect(falloff(7, 7)).toBe(0);
    expect(falloff(3, 7)).toBeLessThan(falloff(2, 7));
  });
});
