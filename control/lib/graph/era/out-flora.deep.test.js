import { describe, it, expect } from 'vitest';
import { FLORA_FORMS, FLORA_FORM_IDS, FLORA_LEVELS, designFlora, floraLaws } from './out-flora.js';

// every form, variant and reveal ring, plain and under incongruity at both ends of interest, 60 seeds: the read laws
// hold (dominant, stands, value-split, budget, stable, one-leads)
describe('the flora index, swept', () => {
  for (const id of FLORA_FORM_IDS) it(`${id}: every variant at every ring keeps the read laws`, () => {
    const bad = [];
    for (const inc of [null, { vertical: 1 }, { horizontal: 1 }, { vertical: 1, horizontal: 1 }, { vertical: 0.5, horizontal: 0.5 }])
      for (const interest of inc ? ['filler', 'focus'] : ['prop'])
        for (const v of Object.keys(FLORA_FORMS[id].variants)) for (const level of Object.keys(FLORA_LEVELS)) for (let s = 1; s <= 60; s++)
          for (const l of floraLaws(designFlora(id, v, s, { level, incongruity: inc, interest }))) bad.push(`${v}/${level}/${s} ${JSON.stringify(inc)} ${interest} ${l.line}`);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
