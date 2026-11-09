import { describe, it, expect } from 'vitest';
import { ORDNANCE, ORDNANCE_NAMES, ordnanceWeapon, measureOrdnance, ordnanceLaws } from './ordnance.js';

// THE ORDNANCE (ordnance.js): a gun's rounds by what they do, their flight measured on the runtime from a turret and
// held to their laws. One case per procedure, chosen from the table: a direct round (its bands, its drop, its drag),
// the indirect shell (its high arc onto a far hill); and between direct rounds, the faster laid lower and sooner.
const direct = ORDNANCE_NAMES.filter((n) => !ORDNANCE[n].indirect).sort((a, b) => ORDNANCE[b].v0 - ORDNANCE[a].v0);
const fast = direct[0], slow = direct.at(-1), high = ORDNANCE_NAMES.find((n) => ORDNANCE[n].indirect);

describe('the ordnance', () => {
  const M = { [fast]: measureOrdnance(fast), [slow]: measureOrdnance(slow), [high]: measureOrdnance(high, { mount: 'howitzer' }) };
  for (const n of [fast, high]) {
    it(`${n}: every law holds on its flight`, () => {
      expect(ordnanceLaws(M[n], M).filter((l) => !l.ok).map((l) => `${l.name} ${JSON.stringify(l.info)}`)).toEqual([]);
    });
  }
  it('between the direct rounds, at the far band the faster is laid lower and arrives sooner', () => {
    const L = ordnanceLaws(M[fast], { [fast]: M[fast], [slow]: M[slow] }).find((l) => /faster round/.test(l.name));
    expect(L.ok).toBe(true);
  });
  it('a round onto the runtime: a travelling round at its muzzle velocity, its drag, its cone, a magazine of one', () => {
    const w = ordnanceWeapon(fast, { reload: 4 }), O = ORDNANCE[fast];
    expect(w).toMatchObject({ fireClass: 'lob', projectileSpeed: O.v0, projectileDrag: O.drag, projectileGravity: 9.81, magazine: 1, reload: 4, fuse: O.fuse });
    expect(w.spread.base).toBeCloseTo(O.dispersion * 360 / 6400, 9);
    expect(ordnanceWeapon(high).splashRadius).toBeGreaterThan(ordnanceWeapon(fast).splashRadius);
    expect(() => ordnanceWeapon('nuke')).toThrow(/one of/);
  });
});
