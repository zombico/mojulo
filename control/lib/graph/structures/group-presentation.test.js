import { describe, expect, it } from 'vitest';

import { buildGroup, GROUP_FAMILIES } from './group-presentation.js';

// Independently re-verify the GROUP AXIOMS on the built table (not just its shape): closure,
// associativity, identity, inverses. If the permutation-closure engine is right, every family
// satisfies all four — this is the oracle the geography step is allowed to trust.
function isValidGroup(g) {
  for (let a = 0; a < g.order; a++) {
    if (g.mul(a, g.identity) !== a || g.mul(g.identity, a) !== a) return false;   // identity
    if (g.mul(a, g.inv(a)) !== g.identity || g.mul(g.inv(a), a) !== g.identity) return false;  // inverse
    for (let b = 0; b < g.order; b++) {
      if (g.mul(a, b) < 0 || g.mul(a, b) >= g.order) return false;                // closure
      for (let c = 0; c < g.order; c++) {
        if (g.mul(g.mul(a, b), c) !== g.mul(a, g.mul(b, c))) return false;        // associativity
      }
    }
  }
  return true;
}

describe('buildGroup — the four families are genuine groups', () => {
  const cases = [
    { spec: { family: 'cyclic', n: 6 }, order: 6, title: 'ℤ/6' },
    { spec: { family: 'dihedral', n: 4 }, order: 8, title: 'D₄' },
    { spec: { family: 'symmetric', n: 3 }, order: 6, title: 'S₃' },
    { spec: { family: 'quaternion' }, order: 8, title: 'Q₈' },
  ];
  for (const { spec, order, title } of cases) {
    it(`${title} closes to order ${order} and satisfies the group axioms`, () => {
      const g = buildGroup(spec);
      expect(g.order).toBe(order);
      expect(g.title).toBe(title);
      expect(g.identity).toBe(0);
      expect(isValidGroup(g)).toBe(true);
    });
  }
});

describe('buildGroup — determinism & words', () => {
  it('is deterministic — same spec yields identical element words', () => {
    const a = buildGroup({ family: 'dihedral', n: 4 });
    const b = buildGroup({ family: 'dihedral', n: 4 });
    expect(a.elements.map((e) => e.word.join(''))).toEqual(b.elements.map((e) => e.word.join('')));
  });

  it('identity is the empty word labelled e', () => {
    const g = buildGroup({ family: 'quaternion' });
    expect(g.elements[0].word).toEqual([]);
    expect(g.elements[0].label).toBe('e');
  });

  it('every element word actually spells that element', () => {
    for (const family of GROUP_FAMILIES) {
      const g = buildGroup({ family, n: 4 });
      for (const el of g.elements) {
        let cur = g.identity;
        for (const gen of el.word) cur = g.step(cur, gen);
        expect(cur).toBe(el.index);
      }
    }
  });
});

describe('buildGroup — the defining relations hold', () => {
  it('D₄: r⁴ = e, s² = e, and srs = r⁻¹ (the theorem the town will make walkable)', () => {
    const g = buildGroup({ family: 'dihedral', n: 4 });
    const e = g.identity;
    const r = g.step(e, 'r');
    let r4 = e; for (let i = 0; i < 4; i++) r4 = g.step(r4, 'r');
    expect(r4).toBe(e);
    expect(g.step(g.step(e, 's'), 's')).toBe(e);
    const srs = g.step(g.step(g.step(e, 's'), 'r'), 's');
    expect(srs).toBe(g.inv(r));
  });

  it('Q₈: i² = j² (both equal the unique order-2 element −1)', () => {
    const g = buildGroup({ family: 'quaternion' });
    const iSq = g.step(g.step(g.identity, 'i'), 'i');
    const jSq = g.step(g.step(g.identity, 'j'), 'j');
    expect(iSq).toBe(jSq);
    expect(iSq).not.toBe(g.identity);
    expect(g.mul(iSq, iSq)).toBe(g.identity);
  });
});
