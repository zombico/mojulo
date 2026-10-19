import { describe, it, expect } from 'vitest';
import { resolveMutagen, oozeFauna } from './index.js';
import { oozeSetting, settingToon, dressPush, RAMP_VALUE } from './setting.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';
import { speciesParams } from '../fauna/species.js';
import { PER_RIG } from '../fauna/test-cases.js';

// A made-up world, so the law is read on ramps the test controls: a warm earth, a dusk violet, a grey.
const RAMPS = [
  { name: 'timber', stops: ['#3a2a1e', '#6a4a30', '#9a7048', '#caa070'] },
  { name: 'dusk', stops: ['#2a1e3e', '#4e3a6e', '#7a64a0'] },
  { name: 'stone', stops: ['#3c3c3e', '#77777a', '#b4b4b6'] },
];
const W = { tradition: 'anime', ramps: RAMPS };
const stopOf = (hex) => RAMPS.some((r) => r.stops.includes(hex));

describe('mutagen: an oozed creature in its game\'s look', () => {
  it('absent ⇒ the oozes as they were, byte for byte, and no light', () => {
    const id = PER_RIG[0], P = speciesParams(id);
    expect(JSON.stringify(oozeFauna(P, resolveMutagen(['herobot'], { key: id, setting: null }))))
      .toBe(JSON.stringify(oozeFauna(P, resolveMutagen(['herobot'], { key: id }))));
    expect(oozeSetting(undefined)).toBeNull();
    expect(settingToon(null)).toBeNull();
    expect(dressPush({ armor: { color: '#6a4a30' } }, { tradition: 'western' })).toEqual({ armor: { color: '#6a4a30' } });
  });

  it('the tradition is the light: anime the character light, western the studio\'s; a word it does not know is refused', () => {
    expect(settingToon(oozeSetting({ tradition: 'anime' }))).toEqual({ light: true });
    expect(settingToon(oozeSetting({ tradition: 'western' }))).toBeNull();
    expect(() => oozeSetting({ tradition: 'noir' })).toThrow(/anime/);
  });

  it('a made colour takes a stop of its hue and value; the accent, a glow, a metal and the animal\'s own stay theirs', () => {
    const led = [], out = dressPush({
      armor: { color: '#5a4030' },                        // a dark warm armour → the timber ramp
      piece: { color: '#e8301c' },                        // a signal red: no ramp is that vivid → its own
      groups: { Visor: { color: '#ffd23a', glow: true }, Plate: { color: '#7a7a80', material: 'chrome' } },
      tints: [{ color: '#20a0ff', amount: 0.5 }],         // a tint is the animal transformed → its own
    }, W, led);
    expect(stopOf(out.armor.color)).toBe(true);
    expect(Math.abs(hexLch(out.armor.color)[0] - hexLch('#5a4030')[0])).toBeLessThanOrEqual(RAMP_VALUE);
    expect(out.piece.color).toBe('#e8301c');
    expect(out.groups.Visor.color).toBe('#ffd23a');
    expect(out.groups.Plate.color).toBe('#7a7a80');
    expect(out.tints[0].color).toBe('#20a0ff');
    expect(led.map((r) => r.at)).toEqual(['armor.color']);
  });

  it('two made colours a value apart never share a stop: the seam stays a line on its armour', () => {
    const out = dressPush({ armor: { color: '#3e2c22' }, marks: [{ on: 'torso', kind: 'band', group: 'Seam', color: '#1a120c' }, { on: 'legs', kind: 'band', group: 'Seam', color: '#3e2c22' }] }, W);
    expect(stopOf(out.armor.color)).toBe(true);
    expect(out.marks[1].color).toBe(out.armor.color);   // the same colour takes the same stop
    expect(out.marks[0].color).not.toBe(out.armor.color);
  });

  it('on a species: the oozes\' made colours dressed, the motif last, and the report says each move', () => {
    const id = PER_RIG[0], r = {}, plan = oozeFauna(speciesParams(id), resolveMutagen(['herobot'], { key: id, setting: W }), r);
    expect(r.setting.tradition).toBe('anime');
    expect(r.setting.dressed.length).toBeGreaterThan(0);
    for (const { to } of r.setting.dressed) expect(stopOf(to)).toBe(true);
    expect(plan.palette.Armor).toBe(r.setting.dressed.find((d) => d.at === 'armor.color').to);
  });
});
