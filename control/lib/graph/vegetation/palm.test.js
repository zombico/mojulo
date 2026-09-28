/**
 * vegetation/palm — lignification without a cambium. Claims under test: the Ritz solver reproduces Greenhill for a
 * uniform column; sustained lignification (stiffness by internode age) keeps a coconut standing past the height at
 * which the same stem with its stiffness frozen young buckles (18 m frozen against 27 m sustained on literature
 * stiffness); with no reaction wood a seedling's lean stays in the trunk while the crown turns up, and a dicot's
 * reaction wood would straighten it; the leaf-base spirals are consecutive Fibonacci numbers that mirror with the
 * hand; a tree fern grows on the same model (a thin trunk under a crown of fronds); growth is deterministic.
 */
import { describe, expect, it } from 'vitest';

import { G } from './mechanics.js';
import { PALMS, growPalm, ritzBuckling, E_of, rAt, parastichies, palmLadder } from './palm.js';

const DEG = Math.PI / 180;
const leanAt = (p, s0 = 1.5) => Math.acos(Math.min(1, (p.nodes.find((q) => q.s > s0) || p.nodes[0]).dir[2])) / DEG;

describe('palm', () => {
  it('reproduces Greenhill for a uniform column (Ritz)', () => {
    expect(ritzBuckling({ H: 10, EI: () => 1, q: () => 1 }) * 1000).toBeCloseTo(7.8373, 1);
  });

  it('stands taller on sustained lignification than with its stiffness frozen young', () => {
    const sp = { ...PALMS.coconut }; const crown = (sp.frondsPerYear * sp.frondLife * sp.frondMass + sp.nutMass) * G;
    const rho = (age) => sp.rho.rho0 + (sp.rho.rhoInf - sp.rho.rho0) * (1 - Math.exp(-Math.max(0, age) / sp.E.tau));
    const safety = (A, sustained) => {
      const H = sp.rate * (A - sp.estYears); const ageAt = (z) => A - (sp.estYears + z / sp.rate);
      const I = (z) => (Math.PI * rAt(sp, z) ** 4) / 4, Ar = (z) => Math.PI * rAt(sp, z) ** 2;
      return ritzBuckling({ H, P: crown, EI: (z) => (sustained ? E_of(sp, ageAt(z)) : sp.E.E0) * 1e9 * I(z), q: (z) => (sustained ? rho(ageAt(z)) : sp.rho.rho0) * Ar(z) * G });
    };
    const firstBelow = (sustained) => { for (let A = sp.estYears + 2; A <= 90; A += 2) if (safety(A, sustained) < 1) return sp.rate * (A - sp.estYears); return Infinity; };
    const frozen = firstBelow(false), sustained = firstBelow(true);
    expect(frozen).toBeGreaterThan(14); expect(frozen).toBeLessThan(22);
    expect(sustained).toBeGreaterThan(frozen + 5);
  });

  it('keeps a lean in the trunk and turns the crown up; reaction wood would straighten it', () => {
    const palm = growPalm('coconut', { years: 30, seed: 4, lean: 28, leanAz: 0 });
    const dicot = growPalm('coconut', { years: 30, seed: 4, lean: 28, leanAz: 0, reaction: true });
    const top = Math.acos(Math.min(1, palm.nodes.at(-1).dir[2])) / DEG;
    expect(leanAt(palm)).toBeGreaterThan(15); expect(top).toBeLessThan(6);
    expect(leanAt(dicot)).toBeLessThan(leanAt(palm) - 5);
  });

  it('shows its phyllotaxis as consecutive Fibonacci parastichies that mirror with the hand', () => {
    const fib = [1, 2, 3, 5, 8, 13, 21, 34];
    for (const key of Object.keys(PALMS)) {
      const r = parastichies(growPalm(key, { years: 40, seed: 2 })), l = parastichies(growPalm(key, { years: 40, seed: 2, hand: -1 }));
      const [a, b] = r.numbers; expect(fib.indexOf(b)).toBe(fib.indexOf(a) + 1);
      for (const n of r.numbers) expect(r.hands[n]).toBe(-l.hands[n]);
    }
  });

  it('grows a tree fern on the same model: a thin trunk under a crown of arching fronds', () => {
    const p = growPalm('treefern', { years: 50, seed: 3 }), H = p.nodes.at(-1).pos[2];
    expect(H).toBeGreaterThan(4); expect(H).toBeLessThan(9);
    expect(rAt(PALMS.treefern, 2)).toBeLessThan(0.7 * rAt(PALMS.coconut, 2));
    expect(p.fronds.filter((f) => !f.dead).length).toBeGreaterThan(12);
    const lad = palmLadder(p); expect(lad.L2.length).toBeGreaterThan(lad.L1.length); expect(lad.L1.length).toBeGreaterThan(lad.L0.length);
  });
  it('is deterministic, and its ladder falls from leaflets to a frond star', () => {
    const a = growPalm('date', { years: 25, seed: 7 }), b = growPalm('date', { years: 25, seed: 7 });
    expect(JSON.stringify(a.nodes)).toBe(JSON.stringify(b.nodes));
    const lad = palmLadder(a); expect(lad.L3.length).toBeGreaterThan(lad.L2.length); expect(lad.L2.length).toBeGreaterThan(lad.L1.length); expect(lad.L1.length).toBeGreaterThan(lad.L0.length);
  });
});
