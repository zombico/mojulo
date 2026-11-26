// A SWING AIMED AT A HEIGHT (world-kinds.js aimedKeys): the strike's pitch searched until the weapon's tip stands at the
// zone's middle (foes/zones.js). A pitch whose pose the rig cannot stand (a tall body's planted foot out of its leg's
// reach) is past what the arm reaches: the search draws in, never throws.
import { describe, expect, it } from 'vitest';
import { aimedKeys } from './world-kinds.js';

// (stub keys: the pitch itself; the tip rises as the pitch does, a metre a 100 degrees, from 0.2 m)
const keysAt = (aim) => [{ pitch: aim.pitch ?? 60 }];
const tip = (most = Infinity) => (ks) => { if (ks[0].pitch > most) throw new Error('leg R cannot reach its planted toe'); return 0.2 + ks[0].pitch / 100; };

describe('a swing aimed at a height', () => {
  it('finds the pitch that puts the tip at the height', () => {
    expect(aimedKeys(keysAt, { height: 0.8 }, tip())[0].pitch).toBeCloseTo(60, 0);
  });

  it('a pose the rig cannot stand is out of reach: the search draws in to the last it can, never throws', () => {
    const high = aimedKeys(keysAt, { height: 1.5 }, tip(95));
    expect(high[0].pitch).toBeLessThanOrEqual(95);
    expect(high[0].pitch).toBeGreaterThan(70);
    expect(aimedKeys(keysAt, { height: 0.8 }, tip(95))[0].pitch).toBeCloseTo(60, 0);
  });
});
