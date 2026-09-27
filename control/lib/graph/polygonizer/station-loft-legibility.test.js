// station-loft-legibility.test.js — the character height from which a detail reads: "protect the read at 128, 256 and
// 512 px" as a number. Families, the majority rule, and that the numbers move the way a word says they should.
import { describe, it, expect } from 'vitest';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';
import { layeredLegibility, familyOf, CHARACTER_HEIGHTS } from './station-loft-legibility.js';

const ledger = (opts) => layeredLegibility(compileLayered(expandPlan(humanoidPlan(opts))));
const from = (L, family) => L.families.find((f) => f.family === family)?.readsFrom;

describe('families', () => {
  it('drop sides and indices; an adornment keeps its signature apart', () => {
    expect(familyOf('tile.quiltFront.torso.R.2.1')).toBe('tile.quiltFront');
    expect(familyOf('tile.foreArmR.L.3.0')).toBe('tile.foreArm');
    expect(familyOf('crease.upperArmR-foreArmR.upperArmR.Rf')).toBe('crease.upperArm-foreArm');
    expect(familyOf('adorn.belt.sig0')).toBe('adorn.belt.sig'); expect(familyOf('adorn.belt')).toBe('adorn.belt');
    expect(familyOf('pupilL')).toBe('pupil'); expect(familyOf('stud.torso.3')).toBe('stud.torso');
  });
});

describe('the read at the viewing height', () => {
  const L = ledger({ preset: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger' });
  it('deterministic, and every family has a height or says it never reads', () => {
    expect(JSON.stringify(ledger({ preset: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger' }))).toBe(JSON.stringify(L));
    for (const f of L.families) expect(f.readsFrom === null || CHARACTER_HEIGHTS.includes(f.readsFrom)).toBe(true);
  });
  it('the hierarchy the art direction asks for: masses and the focal accent first, the face last', () => {
    for (const f of ['adorn.pauldron', 'adorn.pauldron.sig', 'adorn.belt', 'hairCap']) expect(from(L, f), f).toBe(64);
    expect(from(L, 'tile.quiltFront')).toBeLessThanOrEqual(128); expect(from(L, 'crease.upperArm-foreArm')).toBeLessThanOrEqual(128);
    expect(from(L, 'pupil')).toBeGreaterThan(256); expect(L.shimmers).toEqual(expect.arrayContaining(['pupil', 'mouth']));
    expect(L.shimmers).not.toContain('adorn.pauldron.sig');
  });
  it('a face word moves the read: larger eyes bring the pupil down to a game-sized hero', () => {
    const big = ledger({ preset: 'female', register: 'round', hair: 'bob', face: { eyeSize: 1.5 } }), as = ledger({ preset: 'female', register: 'round', hair: 'bob' });
    expect(from(big, 'pupil')).toBeLessThan(from(as, 'pupil')); expect(from(big, 'pupil')).toBe(256);
  });
});
