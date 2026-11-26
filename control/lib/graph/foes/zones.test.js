import { describe, expect, it } from 'vitest';

import { STRIKE_ZONES, zoneOf, zoneAim, zoneBand } from './zones.js';
import { HERO } from './vocab.js';
import { swingClipKeys } from '../polygonizer/hero-swing.js';
import { aimSwingKeys } from '../polygonizer/hero-swing-body.js';

describe('the strike zone: where on the hero a foe\'s blow goes, by how tall it stands', () => {
  it('a body well under the hero goes for the legs, one its height the body, one well over it from above', () => {
    expect(zoneOf(HERO.height * 0.6)).toBe('legs');
    expect(zoneOf(HERO.height)).toBe('body');
    expect(zoneOf(HERO.height * 1.5)).toBe('high');
    expect(zoneBand('legs')[1]).toBeLessThan(zoneBand('body')[1]);
  });

  it('the legs are cut from one side then the other, stepping in, as a string', () => {
    const W = STRIKE_ZONES.legs.words;
    expect(W.left).not.toBe(W.right);
    expect(STRIKE_ZONES.legs.moves).toMatchObject({ combo: true });
    expect(STRIKE_ZONES.legs.moves.lunge).toBeGreaterThan(0);
  });

  it('a shorter body drops its arm less to reach the same legs; the aimed swing strikes at that angle, its shape kept', () => {
    const small = zoneAim(HERO.height * 0.55, HERO, 'legs'), mid = zoneAim(HERO.height * 0.75, HERO, 'legs');
    expect(small.drop).toBeLessThan(mid.drop);
    const keys = swingClipKeys('forehand', 'normal'), aimed = aimSwingKeys(keys, { pitch: 90 - mid.drop, sink: mid.sink, bend: mid.bend });
    const n = keys.length;
    expect(aimed[n - 3].shR.pitch).toBeCloseTo(90 - mid.drop, 6);
    expect(aimed[n - 3].shR.yaw).toBe(keys[n - 3].shR.yaw);
    expect(aimed[n - 3].crouch).toBeGreaterThan(keys[n - 3].crouch);
    expect(aimed[0]).toBe(keys[0]);
    expect(aimSwingKeys(keys, null)).toBe(keys);
  });
});
