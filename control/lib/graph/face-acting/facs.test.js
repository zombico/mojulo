// facs: the face's controls as FACS action units, ARKit's 52 read through them, the emotion prototypes, and a state
// turned into the realistic head's actions, what it cannot make said as gaps.
import { describe, expect, it } from 'vitest';
import { FACS_UNITS, ARKIT_SHAPES, EMOTION_PROTOTYPES, INTENSITY, auOf, facsActions } from './facs.js';
import { ACTIONS } from '../polygonizer/head-relational.js';

describe('the FACS vocabulary', () => {
  it('reads ARKit\'s 52 through the action units, each AU named in the table (the gaze, the tongue and speech FACS keeps apart)', () => {
    expect(Object.keys(ARKIT_SHAPES)).toHaveLength(52);
    for (const code of Object.values(ARKIT_SHAPES)) if (code.startsWith('AU')) expect(auOf(code)).not.toBeNull();
    // (and a sided unit's ARKit pair is its Left then its Right)
    const sided = Object.values(FACS_UNITS).find((u) => u.sided && u.arkit.length === 2);
    expect(sided.arkit[0]).toMatch(/Left$/); expect(sided.arkit[1]).toMatch(/Right$/);
  });
  it('names an action the head has, for every unit it says the head makes', () => {
    for (const u of Object.values(FACS_UNITS)) if (u.action) for (const a of [u.action].flat()) expect(Object.hasOwn(ACTIONS, a)).toBe(true);
    for (const u of Object.values(FACS_UNITS)) if (u.lips) for (const a of Object.values(u.lips)) expect(Object.hasOwn(ACTIONS, a)).toBe(true);
  });
  it('builds the emotion prototypes from units in the table, at FACS intensities', () => {
    for (const st of Object.values(EMOTION_PROTOTYPES)) for (const [k, v] of Object.entries(st)) {
      expect(auOf(k)).not.toBeNull();
      expect(Object.values(INTENSITY)).toContain(v);
    }
  });
});

describe('a FACS state on the realistic head', () => {
  const made = Object.entries(FACS_UNITS).find(([, u]) => u.action && u.sided && Object.hasOwn(ACTIONS, `${u.action}L`));
  // (a unit the head moves whole, one FACS does not split by side: a side alone of it is no action of the head's)
  const wholeOnly = Object.entries(FACS_UNITS).find(([, u]) => u.action && !u.sided && !Object.hasOwn(ACTIONS, `${u.action}R`));
  const gap = Object.entries(FACS_UNITS).find(([, u]) => !u.action);
  it('makes a unit by its action and a side by the side\'s (the head sums them per side), clamped', () => {
    const [au, u] = made;
    expect(facsActions({ [au]: 0.5 }).actions).toEqual({ [u.action]: 0.5 });
    expect(facsActions({ [`${au}L`]: 0.4 }).actions).toEqual({ [`${u.action}L`]: 0.4 });
    expect(facsActions({ [au]: 0.3, [`${au}L`]: 0.4 }).actions).toEqual({ [u.action]: 0.3, [`${u.action}L`]: 0.4 });
    expect(facsActions({ [au]: 2 }).actions[u.action]).toBe(1);
  });
  it('says what it cannot make, never another unit in its place: a missing unit, and a side the head moves only whole', () => {
    const [au] = gap;
    expect(facsActions({ [au]: 0.6 })).toEqual({ actions: {}, gaps: { [au]: 0.6 } });
    const [au2] = wholeOnly;
    expect(facsActions({ [`${au2}R`]: 0.4 })).toEqual({ actions: {}, gaps: { [`${au2}R`]: 0.4 } });
  });
  it('makes a unit split by lip by its lip\'s action, the whole unit by both (the f\'s lower lip under the teeth)', () => {
    const [au, u] = Object.entries(FACS_UNITS).find(([, x]) => x.lips);
    expect(facsActions({ [`${au}B`]: 0.7 }).actions).toEqual({ [u.lips.B]: 0.7 });
    expect(facsActions({ [au]: 0.5 }).actions).toEqual(Object.fromEntries(Object.values(u.lips).map((a) => [a, 0.5])));
    // (a lip is no split of a unit that is not split by lip)
    expect(() => facsActions({ AU12B: 1 })).toThrow(/not an action unit/);
  });
  it('refuses a key that is no action unit', () => {
    expect(() => facsActions({ smile: 1 })).toThrow(/not an action unit/);
    expect(facsActions({ AU12: 0 })).toEqual({ actions: {}, gaps: {} });
  });
});
