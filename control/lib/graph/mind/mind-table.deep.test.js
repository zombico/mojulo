// The generated mind table is the live solve, mind for mind and species for species, key order included. A failure
// means the vocabulary, the strategies, the presets or the fauna tags moved: run `node scripts/gen-mind-table.mjs`.
import { describe, it, expect } from 'vitest';
import { SPECIES } from '../fauna/species.js';
import { liveMindTable } from './table.js';
import { MIND_TABLE } from './mind-table.js';

describe('MIND_TABLE', () => {
  it('equals the live solve', () => {
    const live = liveMindTable();
    expect(Object.keys(MIND_TABLE.fauna).sort()).toEqual(Object.keys(SPECIES).sort());
    expect(JSON.stringify(MIND_TABLE)).toBe(JSON.stringify(live));
  }, 120_000);
});
