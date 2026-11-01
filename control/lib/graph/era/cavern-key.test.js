// The cavern's colour key (era/cavern-key.js): the colour theorist's offer to a cave. The laws: the register names the
// family and the world turns it inside it (each register by its own turn: torch the soil, fluorescent the sky, bio the
// accent); the shade the temperature opposite the key's; the formations paler than the wall; the set's accent far from the
// key; daylight lamps nothing, its key the world's sky; the same palette the same key.

import { describe, it, expect } from 'vitest';
import { cavernKey, warmth, CAVE_KEYS } from './cavern-key.js';
import { CAVE_LIGHTS } from './cave.js';
import { lchOf, hueGap } from '../color-theorist/oklab.js';

// a world's ramps as a stage carries them (rgb 0…255, the middle stop its key colour)
const ramp = (c) => [c.map((v) => v * 0.7), c, c.map((v) => Math.min(255, v * 1.2))];
const world = (o = {}) => ({ rock: ramp([150, 146, 140]), soil: ramp([190, 150, 100]), sky: ramp([120, 176, 236]), fruit: ramp([200, 58, 56]), gold: ramp([226, 186, 44]), violet: ramp([140, 104, 206]), ...o });
const hueOf = (c) => lchOf(c.map((v) => v * 255))[2];

describe('the cavern\'s colour key', () => {
  it('lights each register in its own family, the shade the temperature opposite the key\'s', () => {
    for (const light of Object.keys(CAVE_KEYS)) {
      const K = cavernKey(world(), light);
      expect(K.laws.every((l) => l.ok)).toBe(true);
      expect(hueGap(hueOf(K.light), hueOf(CAVE_LIGHTS[light].colour))).toBeLessThanOrEqual(CAVE_KEYS[light].span + 1);
      expect(Math.max(...K.light)).toBeCloseTo(1, 3);
      expect(Math.sign(warmth(K.light))).toBe(-Math.sign(warmth(K.shade)));
    }
    expect(warmth(cavernKey(world(), 'torch').light)).toBeGreaterThan(0);
    expect(warmth(cavernKey(world(), 'torch').shade)).toBeLessThan(0);
  });

  it('is turned by the world, never out of its family', () => {
    // (a torch over red earth burns redder than over yellow; however red the earth, no further than its span)
    const red = cavernKey(world({ soil: ramp([180, 70, 50]) }), 'torch'), yellow = cavernKey(world({ soil: ramp([200, 180, 80]) }), 'torch');
    expect(hueOf(red.light)).toBeLessThan(hueOf(yellow.light));
    for (const K of [red, yellow]) expect(K.laws.find((l) => l.id === 'family').ok).toBe(true);
    // (a grey sky turns a tube nowhere)
    expect(cavernKey(world({ sky: ramp([150, 150, 150]) }), 'fluorescent').light).toEqual(cavernKey(world({ sky: ramp([160, 160, 160]) }), 'fluorescent').light);
  });

  it('lifts its formations off the wall, and paints its set in an accent far from its light', () => {
    const K = cavernKey(world(), 'torch'), [Lr] = lchOf(world().rock[1]), [Lf] = lchOf(K.formation.map((v) => v * 255));
    expect(Lf).toBeGreaterThan(Lr + 0.05);
    expect(hueGap(lchOf(K.light.map((v) => v * 255))[2], lchOf([1, 3, 5].map((i) => parseInt(K.accent.slice(i, i + 2), 16)))[2])).toBeGreaterThanOrEqual(60);
    expect(Object.values(K.made).every((h) => /^#[0-9a-f]{6}$/.test(h))).toBe(true);
  });

  it('lamps nothing by daylight, its key the world\'s sky; the same world the same key', () => {
    const K = cavernKey(world(), 'daylight');
    expect(K.light).toBeNull();
    expect(K.fixture).toBeNull();
    expect(hueGap(hueOf(K.crack), lchOf(world().sky[1])[2])).toBeLessThan(15);
    expect(cavernKey(world(), 'bio')).toEqual(cavernKey(world(), 'bio'));
  });
});
