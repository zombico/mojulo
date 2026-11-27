// THE CAVE'S CAST RIG (color-theorist/cave-rig.js): the cast rig solved from a place's own fire and rock, with no sky:
// its key the fire's (warm, from where it is thrown), its fill the rock's cold light, its laws holding a body's form and
// value as under a sun, and its rim the walls' bounce at the place's own light (never lifted with a dark body).
import { describe, it, expect } from 'vitest';
import { caveRig, readCave, CAVE_RIM } from './cave-rig.js';
import { LAIR } from '../gameworld/lair.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('a cave lights its bodies by its own fire', () => {
  it('its key the fire (warm, its level, from where it is thrown), its fill the rock (cold), the floor its bounce', () => {
    const R = caveRig(LAIR.cast);
    expect(R.from).toEqual({ cave: true });
    expect(R.key.linear[0]).toBeGreaterThan(R.key.linear[2]);
    expect(lum(R.key.linear)).toBeCloseTo(LAIR.cast.key, 2);
    const n = Math.hypot(...LAIR.cast.toLight);
    R.key.toLight.forEach((v, k) => expect(v).toBeCloseTo(LAIR.cast.toLight[k] / n, 3));
    expect(R.hemi.sky[2]).toBeGreaterThan(R.hemi.sky[0]);
    expect(lum(R.hemi.ground)).toBeLessThan(lum(R.hemi.sky));
    expect(R.rim.power).toBe(CAVE_RIM.power);
    expect(JSON.stringify(caveRig(LAIR.cast))).toBe(JSON.stringify(R));
  });
  it('the rig\'s laws hold a body in it; a dark one is lifted, its rim not with it', () => {
    const mid = caveRig(LAIR.cast, { palette: { Top: '#8a7a6a', Bottom: '#8a7a6a' } });
    for (const l of mid.reads) expect(l.ok, `${l.law}: ${l.note}`).toBe(true);
    const dark = caveRig(LAIR.cast, { palette: { Top: '#3a2a24', Bottom: '#3a2a24' } });
    expect(dark.key.gain).toBeGreaterThan(mid.key.gain);
    expect(dark.reads.find((l) => l.law === 'value').ok).toBe(true);
    // (its rim as bright as the place's light: no brighter than the light it would have unlifted)
    expect(lum(dark.rim.linear)).toBeLessThan(lum(mid.rim.linear) * 1.5);
  });
  it('its words are checked', () => {
    expect(() => readCave({ ...LAIR.cast, fire: 'orange' })).toThrow(/fire/);
    expect(() => readCave({ ...LAIR.cast, sun: 1 })).toThrow(/sun/);
    expect(() => readCave({ ...LAIR.cast, toLight: [0, 0, 0] })).toThrow(/toLight/);
    expect(() => readCave({ ...LAIR.cast, rim: 2 })).toThrow(/rim/);
    expect(readCave(LAIR.cast)).toBe(LAIR.cast);
  });
});
