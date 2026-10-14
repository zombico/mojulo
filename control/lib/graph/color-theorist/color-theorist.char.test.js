import { describe, it, expect } from 'vitest';
import { solvePalette, fingerprint } from './solve.js';

// CHARACTERIZATION PIN: a recipe stores a palette SPEC and the build solves it on every read, so what a spec solves to
// is a compatibility promise over every stored world, game and cover. A change here is legitimate only when the step
// says emission changes (and then every stored palette re-colours: say so in the changelog).
const PINS = [
  [{ seed: 1 }, 'pal-30efa0b4', '027d8491'],
  [{ seed: 2024, heat: -0.6, weight: 0.5, activity: 0.2, scheme: 'split-complementary' }, 'pal-af51cd4a', 'b8928906'],
  [{ seed: 7, scheme: 'mono-accent', key: 'high', hue: 'rust', lock: { accent: '#c0392b' } }, 'pal-bb23c282', 'f59a8196'],
];

describe('the solver is pinned', () => {
  it.each(PINS)('%j solves to its pinned contract', (spec, id, print) => {
    const K = solvePalette(spec);
    expect(K.id).toBe(id);
    expect(fingerprint(K)).toBe(print);
  });
});
