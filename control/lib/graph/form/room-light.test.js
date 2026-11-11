// The light a room's palette asks for (room-light.js): its surfaces' colours at arm's length from its median lamp are
// targets, and the bases and the lamps' light are solved so the renderer shows them there.
import { describe, expect, it } from 'vitest';
import { solveRoomLight, falloff, referenceLamp, ROOM_LIGHT, CONTRAST_MOST } from './room-light.js';
import { seen, luminance, BASE_MAX } from '../color-theorist/light.js';

const LAMPS = [{ color: '#ffa850', intensity: 1.7, radius: 7.5 }, { color: '#ffa850', intensity: 1.2, radius: 6 }, { color: '#a8c8ff', intensity: 2.4, radius: 9 }];
const TARGETS = { brick: '#8a4a36', stone: '#8c867a', marble: '#ada296' };

describe('a room\'s light solved from its palette', () => {
  const S = solveRoomLight({ targets: TARGETS, ambient: [0.28, 0.32, 0.43], lights: LAMPS });

  it('under a light of the solved level and no hue, each surface shows its target at the reference', () => {
    const ref = referenceLamp(LAMPS), i = LAMPS.indexOf(ref), y = (c) => luminance(c), keyY = y(S.keys[i]) * falloff(ROOM_LIGHT.at, ref.radius);
    expect(ref.intensity).toBe(1.7);
    for (const [role, hex] of Object.entries(TARGETS)) {
      const got = seen(S.bases[role], { ambient: [1, 1, 1].map(() => y(S.ambient)), sun: [keyY, keyY, keyY] }, 1), want = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
      [1, 3, 5].forEach((k, c) => expect(Math.abs(parseInt(got.slice(k, k + 2), 16) - want[c]), role).toBeLessThanOrEqual(3));
    }
  });

  it('each lamp brings its own hue, the ambient its own: a warm torch warms, a cold lamp cools', () => {
    expect(S.keys[0][0]).toBeGreaterThan(S.keys[0][2]);
    expect(S.keys[2][2]).toBeGreaterThan(S.keys[2][0]);
    expect(S.ambient[2]).toBeGreaterThan(S.ambient[0]);
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

  it('a room whose median lamp is a small signal light is still solved: the reference is a lamp that reaches it', () => {
    const lamps = [...Array.from({ length: 5 }, (_, k) => ({ at: [k, 0, 1], color: '#40ff80', intensity: 0.3, radius: 1.5 })), { at: [0, 0, 5], color: '#dde8ff', intensity: 1.15, radius: 9 }, { at: [4, 0, 5], color: '#dde8ff', intensity: 1.15, radius: 9 }];
    const ref = referenceLamp(lamps);
    expect(falloff(ROOM_LIGHT.at, ref.radius)).toBeGreaterThan(0);
    const S = solveRoomLight({ targets: { wall: '#8090a0', floor: '#c0c8d0' }, ambient: [0.2, 0.22, 0.28], lights: lamps });
    for (const k of S.keys) for (const v of k) expect(Number.isFinite(v)).toBe(true);
  });
});
