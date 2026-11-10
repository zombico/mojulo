import { describe, it, expect } from 'vitest';
import { MOUNTS, MOUNT_NAMES, mountOf, measureMount, mountLaws } from './mount.js';

// THE MOUNTS (mount.js): the turret's numbers by what carries it, measured on the runtime and held to their laws. One
// case per procedure, chosen from the table by what it is: a stabilized mount that turns all round, and a hand-laid one
// whose aim is carried and whose arc is limited.
const stabilized = MOUNT_NAMES.find((n) => MOUNTS[n].mount.stabilized && !Number.isFinite(MOUNTS[n].mount.traverse.min));
const laid = MOUNT_NAMES.find((n) => !MOUNTS[n].mount.stabilized && Number.isFinite(MOUNTS[n].mount.traverse.min));

describe('the mounts', () => {
  for (const n of [stabilized, laid]) {
    it(`${n}: every law holds on its measures`, () => {
      const t = mountOf(n), m = measureMount(t);
      expect(mountLaws(m, t).filter((l) => !l.ok).map((l) => `${l.name} ${JSON.stringify(l.info)}`)).toEqual([]);
    });
  }
  it('a stabilized mount holds its world aim on a turning base where a laid one is carried; the laid one lags a quick hand', () => {
    const a = measureMount(mountOf(stabilized)), b = measureMount(mountOf(laid));
    expect(a.hold.drift).toBeLessThan(0.5);
    expect(b.hold.drift).toBeGreaterThan(50);
    expect(b.lag.deg).toBeGreaterThan(a.lag.deg);
    expect(b.traverse.arcEndToEnd).toBeGreaterThan(0);
  });
  it('a mount by its class, its fields laid over; an unknown class named', () => {
    const t = mountOf(stabilized, { mount: { traverse: { rate: 10 } }, gun: { barrel: 7 } });
    expect(t.mount.traverse).toEqual({ ...MOUNTS[stabilized].mount.traverse, rate: 10 });
    expect(t.mount.elevation).toEqual(MOUNTS[stabilized].mount.elevation);
    expect(t.gun.barrel).toBe(7);
    expect(() => mountOf('catapult')).toThrow(/one of/);
  });
});
