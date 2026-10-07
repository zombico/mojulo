import { describe, it, expect } from 'vitest';
import { FLORA_FORMS, FLORA_FORM_IDS, FLORA_LEVELS, designFlora, floraLaws } from './out-flora.js';

// every form, every variant, every reveal ring, 150 seeds: the read laws hold (dominant, stands, value-split, budget)
describe('the flora index, swept', () => {
  for (const id of FLORA_FORM_IDS) it(`${id}: every variant at every ring keeps the read laws`, () => {
    const bad = [];
    for (const v of Object.keys(FLORA_FORMS[id].variants)) for (const level of Object.keys(FLORA_LEVELS)) for (let s = 1; s <= 150; s++)
      for (const l of floraLaws(designFlora(id, v, s, { level }))) bad.push(`${v}/${level}/${s} ${l.line}`);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
