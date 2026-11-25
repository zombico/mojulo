// The pods (scroll-stage/pods.js): Blaze Gunner's arsenal as data. The concepts: the shipped arsenal holds its laws (no
// pod better than another on every measure, every pod worth taking over the base gun, a short reach paying for its risk,
// the base gun never empty), and a law loses where a row breaks it; a pod is measured by what it hits; it is lowered to
// metres by the ship's length and the screen, only the pods named carried.
import { describe, it, expect } from 'vitest';
import { PODS, POD_IDS, BASE_GUN, SLOTS, podMeasures, arsenalLaws, lowerArsenal } from './pods.js';

const kindOf = (k) => POD_IDS.find((id) => PODS[id].fire.kind === k);

describe('the pods', () => {
  it('the shipped arsenal holds its laws', () => {
    for (const l of arsenalLaws()) expect(l.holds, l.says).toBe(true);
  });

  it('a law loses where a row breaks it: a pod better on every measure, a melee pod that does not pay', () => {
    const shots = kindOf('shots'), sweep = kindOf('sweep');
    const best = { ...PODS[shots], fire: { ...PODS[shots].fire, cadence: 0.001, shots: PODS[shots].fire.shots.map((s) => ({ ...s, life: 9, r: 5, pierce: 9, home: 9, burst: { r: 9, dmg: 9, time: 1 } })) } };
    expect(arsenalLaws({ ...PODS, best }).find((l) => l.id === 'no-best-pod').holds).toBe(false);
    const soft = { ...PODS[sweep], fire: { ...PODS[sweep].fire, dmg: 0.1 } };
    expect(arsenalLaws({ ...PODS, [sweep]: soft }).find((l) => l.id === 'short-reach-pays').holds).toBe(false);
  });

  it('a pod is measured by what it hits: a beam passes through, a homing dart finds, a burst splashes, a blade is melee', () => {
    expect(podMeasures(PODS[kindOf('beam')]).pierce).toBe(1);
    expect(podMeasures(PODS[kindOf('sweep')]).melee).toBe(true);
    const seek = POD_IDS.find((id) => PODS[id].fire.shots?.some((s) => s.home)), splash = POD_IDS.find((id) => PODS[id].fire.shots?.some((s) => s.burst));
    expect(podMeasures(PODS[seek]).seek).toBe(1);
    expect(podMeasures(PODS[splash]).splash).toBeGreaterThan(0);
    expect(podMeasures(BASE_GUN)).toMatchObject({ pierce: 0, seek: 0, splash: 0 });
  });

  it('is lowered to metres by the ship\'s length and the screen, only the pods named carried', () => {
    const shots = kindOf('shots'), A = lowerArsenal([shots], { L: 10, S: 80 }), P = PODS[shots].fire.shots[0];
    expect(Object.keys(A.pods)).toEqual([shots]);
    expect(A.pods[shots].fire.shots[0].r).toBeCloseTo(P.r * 10, 6);
    expect(A.pods[shots].fire.shots[0].speed).toBeCloseTo(P.speed * 80, 6);
    expect(A.pods[shots].ammo).toBe(PODS[shots].ammo);
    expect(A.base.fire.kind).toBe('shots');
    expect(A.slots).toBe(SLOTS);
    expect(() => lowerArsenal(['railgun'], { L: 10, S: 80 })).toThrow(/not a pod/);
  });
});
