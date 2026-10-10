// The generated behavior table is the live solve, species for species, key order included (the DOES line reads it in
// order). A failure means a species, a skeleton or the resolver moved: run `node scripts/gen-fauna-does.mjs`.
import { describe, it, expect } from 'vitest';
import { SPECIES } from '../species.js';
import { liveDoes } from '../entries.js';
import { DOES_TABLE } from './does-table.js';

describe('DOES_TABLE', () => {
  it('holds every species and only those', () => {
    expect(Object.keys(DOES_TABLE).sort()).toEqual(Object.keys(SPECIES).sort());
  });
  it('equals the live solve', () => {
    for (const id of Object.keys(SPECIES)) expect(JSON.stringify(DOES_TABLE[id]), id).toBe(JSON.stringify(liveDoes(id)));
  }, 120_000);
});
