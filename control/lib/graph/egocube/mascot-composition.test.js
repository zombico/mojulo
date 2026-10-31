import { describe, it, expect } from 'vitest';
import { animalCard } from './mascot-animals.js';
import { auditAnimalComposition } from './mascot-composition.js';

describe('animal mascot composition audits', () => {
  it('preserves an identity-led fox with a broad tail counterweight', () => {
    const audit = auditAnimalComposition(animalCard('fox'));
    expect(audit.focus).toBe('ears');
    expect(audit.suggestions.join(' ')).toMatch(/tail mass/);
  });
  it('lets the panda coat own the focal contrast', () => {
    const audit = auditAnimalComposition(animalCard('giantPanda'));
    expect(audit.focus).toBe('coat');
    expect(audit.suggestions.join(' ')).toMatch(/light\/dark/);
  });
  it('reserves face space for owl eyes', () => {
    const audit = auditAnimalComposition(animalCard('greatHornedOwl'));
    expect(audit.focus).toBe('eyes');
    expect(audit.suggestions.join(' ')).toMatch(/negative space/);
  });
  it('keeps lion mane as one primary mass', () => {
    const audit = auditAnimalComposition(animalCard('lion'));
    expect(audit.suggestions.join(' ')).toMatch(/framing mass/);
  });
  it('rejects malformed cards and stays deterministic', () => {
    expect(() => auditAnimalComposition(null)).toThrow(TypeError);
    const card = animalCard('elephant');
    expect(auditAnimalComposition(card)).toEqual(auditAnimalComposition(card));
  });
});
