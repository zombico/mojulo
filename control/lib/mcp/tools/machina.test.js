// verify_machina: the verdict, and the manual its description and errors point at (the `machina` solid-vocab card).
import { describe, it, expect } from 'vitest';
import { verifyMachinaHandler } from './machina.js';
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';

const CRATES = {
  title: 'Crates to the mezzanine',
  demand: { count: 40, unitMass: { value: 25, unit: 'kg' }, distance: { value: 3, unit: 'm' }, time: { value: 1, unit: 'h' } },
  mechanism: [{ type: 'pulley', segments: 4, eta: 0.85 }],
  capacities: [{ type: 'force', rating: { value: 250, unit: 'N' } }, { type: 'rate', power: { value: 150, unit: 'W' } }],
};

describe('verify_machina', () => {
  it("answers the card's worked example as the card says it does", () => {
    const r = verifyMachinaHandler(CRATES);
    expect(r.feasible).toBe(true);
    expect(r.binding).toEqual([]);
    expect(r.report).toMatch(/net advantage\s+3\.4 : 1/);
    expect(r.report).toMatch(/effort needed\s+72 N/);
    const card = getSolidVocabCatalog().get('machina');
    expect(card.entry).toBe('verify_machina');
    expect(card.body).toContain("mechanism: [{ type: 'pulley', segments: 4, eta: 0.85 }]");
    expect(card.body).toContain('3.4 : 1 net advantage, 72 N of effort');
  });

  it('names every failing limit, and a machine parameter the listed schema no longer spells out still reaches the solver', () => {
    const r = verifyMachinaHandler({
      demand: { ...CRATES.demand, time: { value: 1, unit: 'min' } },
      mechanism: [{ type: 'lever', effortArm: 2, loadArm: 1 }],
      capacities: [{ type: 'force', rating: { value: 10, unit: 'N' } }, { type: 'rate', power: { value: 5, unit: 'W' } }],
    });
    expect(r.feasible).toBe(false);
    expect(r.binding).toEqual(['force (effort)', 'rate']);
    expect(r.report).toMatch(/2\.0 : 1/);
  });

  it('a malformed recipe is sent to the manual', () => {
    expect(() => verifyMachinaHandler({})).toThrow(/demand.*get_solid_vocab\(\{ id: 'machina' \}\)/);
    expect(() => verifyMachinaHandler({ demand: CRATES.demand, mechanism: [] })).toThrow(/mechanism.*get_solid_vocab\(\{ id: 'machina' \}\)/);
  });
});
