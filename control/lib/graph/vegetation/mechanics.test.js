/**
 * vegetation/mechanics — the stem from the cell wall up. Claims under test: Greenhill's constant comes out of the
 * Bessel zero, not a table; the elastica reduces to the small-deflection cantilever; a lignified wall at a low
 * microfibril angle gives wood-range stiffness at wood density; lignin's lock-in grows with the angle; the extension–
 * twist coupling carries the helix's hand and peaks near 10° (so bamboo's missing chirality is not the wall's doing).
 */
import { describe, expect, it } from 'vitest';

import { greenhillConstant, elastica, tissueModulus, wallModulus, twistCoupling, bendingNumber, stemModulus } from './mechanics.js';

describe('vegetation mechanics', () => {
  it('computes Greenhill qL³/EI = 7.8373 from the first zero of J₋₁/₃', () => {
    expect(greenhillConstant().qL3overEI).toBeCloseTo(7.8373, 3);
  });

  it('reduces the elastica to the small-deflection cantilever (drop → B/8)', () => {
    const B = 0.01; expect(elastica({ B }).drop / (B / 8)).toBeCloseTo(1, 2);
  });

  it('gives wood-range stiffness for a lignified wall at MFA 10° and density 500 (8–16 GPa)', () => {
    const E = tissueModulus({ mfaDeg: 10, lignin: 1, density: 500 });
    expect(E).toBeGreaterThan(8); expect(E).toBeLessThan(16);
  });

  it('locks the helix harder the steeper it is', () => {
    const lock = (a) => wallModulus({ mfaDeg: a, lignin: 1 }) / wallModulus({ mfaDeg: a, lignin: 0 });
    expect(lock(40)).toBeGreaterThan(lock(20)); expect(lock(20)).toBeGreaterThan(lock(5));
  });

  it('carries the helix hand in the twist coupling, which peaks near 10°', () => {
    expect(twistCoupling({ mfaDeg: 20, lignin: 1, hand: 1 })).toBeCloseTo(-twistCoupling({ mfaDeg: 20, lignin: 1, hand: -1 }), 9);
    const at = (a) => twistCoupling({ mfaDeg: a, lignin: 1 });
    expect(at(10)).toBeGreaterThan(at(5)); expect(at(10)).toBeGreaterThan(at(20));
  });

  it('scales droop by the bending number: geometric scaling raises B, elastic scaling (L ∝ d^2/3) keeps it', () => {
    const E = stemModulus(1), rho = 600; const B0 = bendingNumber({ E, rho, L: 1, d: 0.02 });
    expect(bendingNumber({ E, rho, L: 2, d: 0.04 }) / B0).toBeCloseTo(2, 6);
    expect(bendingNumber({ E, rho, L: 8 ** (2 / 3) * 1, d: 0.02 * 8 }) / B0).toBeCloseTo(1, 6);
  });
});
