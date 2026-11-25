import { describe, it, expect } from 'vitest';
import { ACES, readAce, acePhase } from './aces.js';
import { assembleFrame } from './assemble.js';

// THE ACES (aces.js): a named frame a path ladders up to. One case per concept, one ace chosen in code (a new ace runs
// through the same reader): its row reads (its build a lawful frame, its phases falling from 1), the phase is chosen by
// the armour's share, and a fault is named.
const id = Object.keys(ACES)[0];
describe('the aces', () => {
  it('reads an ace: a lawful build, its phases falling from 1, a phase by its armour\'s share', () => {
    const A = readAce(id);
    expect(assembleFrame(A.build).laws.filter((l) => !l.ok)).toEqual([]);
    expect(acePhase(A, 1)).toBe(A.phases[0]);
    expect(acePhase(A, 0.01)).toBe(A.phases.at(-1));
    expect(() => readAce('nobody')).toThrow(/is an ace: /);
  });
});
