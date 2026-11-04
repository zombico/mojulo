// The riding postures: every machine names one, every card a lean range the rig can hold; a posture refused naming
// them. The solve itself needs the realistic hero's rig (half a minute to build): cycle-rider.deep.test.js.
import { describe, it, expect } from 'vitest';
import { CYCLE_ARCHETYPES } from './index.js';
import { POSTURES, POSTURE_IDS, postureCard, postureOf, readRiderHero } from './cycle-rider.js';

describe('the riding postures', () => {
  it('every machine is ridden in a posture the shelf has', () => {
    for (const id of Object.keys(CYCLE_ARCHETYPES)) expect(POSTURE_IDS, id).toContain(postureOf(id));
  });
  it('every card leans within what the trunk holds over the hips (0 to 80 degrees)', () => {
    for (const [id, c] of Object.entries(POSTURES)) {
      expect(c.hinge[0], id).toBeGreaterThanOrEqual(0);
      expect(c.hinge[1], id).toBeLessThanOrEqual(80);
      expect(c.hinge[0], id).toBeLessThan(c.hinge[1]);
    }
  });
  it('names the postures, and rides only the realistic hero', () => {
    expect(() => postureCard('sidesaddle')).toThrow(/expected one of: upright/);
    expect(readRiderHero(true)).toEqual({ form: 'realistic' });
    expect(() => readRiderHero({ form: 'tiered' })).toThrow(/realistic hero/);
  });
});
