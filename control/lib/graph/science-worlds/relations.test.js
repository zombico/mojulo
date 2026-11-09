import { describe, it, expect } from 'vitest';
import { RELATION, RELATIONS, readRelations, handoffCurve } from './relations.js';
import { solveClassical } from './classical/solve.js';
import { MATTER } from '../rupa/matter.js';
import { assembleClassicalScene } from './classical/world.js';

// The handoff between scales: the relation rows (their forms and their citations), a classical liquid whose state is read
// from a microscopic run, the gates that carry the lower rung's verdict, and the refusals.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const micro = (extra = {}) => ({
  box: { size: ['1 µm', '1 µm', '1 µm'] }, represents: 5, species: [{ id: 'protein', radius: '2 nm', count: 120 }],
  laws: [{ law: 'aggregation', of: 'protein', nucleus: 2, nucleate: 2000, grow: '2e6 /M/s' }], duration: '30 s', ...extra,
});
const bead = (gelling) => ({
  bodies: [{ id: 'bead', matter: 'glass', radius: '50 µm', at: [0, 0, 0] }],
  laws: [{ law: 'gravity-uniform' }, { law: 'buoyancy', medium: 'water', surface: 1 }, { law: 'gelling', medium: 'water', ...gelling }], duration: 30,
});
const handed = { from: { microscopic: micro(), observe: 'aggregated' }, relations: [{ relation: 'percolation', top: '20 Pa', onset: 0.2 }, { relation: 'krieger-dougherty', phi: 0.3 }] };

describe('science worlds: the handoff between scales', () => {
  it('keeps every relation a cited row with its form, and computes what its row says', () => {
    for (const r of RELATIONS) { expect(r.citation.length).toBeGreaterThan(20); expect(r.formula).toBeTruthy(); }
    expect(RELATION.percolation.apply(0.1, { top: 10, onset: 0.2 })).toBe(0);
    expect(RELATION.percolation.apply(1, { top: 10, onset: 0.2 })).toBeCloseTo(10, 12);
    expect(RELATION['krieger-dougherty'].apply(0, { phi: 0.3 }, 1e-3)).toBe(1e-3);
    // Einstein's dilute limit: η ≈ η₀·(1 + 2.5·φ)
    expect(RELATION['krieger-dougherty'].apply(1, { phi: 0.001 }, 1)).toBeCloseTo(1 + 2.5 * 0.001, 4);
  });

  it('turns a share into a curve, keeping the medium\'s own where no row sets it', () => {
    const rel = readRelations([{ relation: 'percolation', top: 50 }], 'r');
    const c = handoffCurve({ t: [0, 1, 2], values: [0, 0.5, 1] }, rel, MATTER.water);
    expect(c.eta).toEqual([MATTER.water.viscosity, MATTER.water.viscosity, MATTER.water.viscosity]);
    expect(c.tau[2]).toBeCloseTo(50, 12);
  });

  it('holds a bead once the share a protein assembles makes a gel that carries it, and the lower rung\'s checks ride up', () => {
    const r = solveClassical({ model: bead(handed) });
    expect(gateOf(r, 'handoff-held').ok).toBe(true);
    expect(gateOf(r, 'stokes-regime').ok).toBe(true);
    expect(r.gel.bodies.bead.held.from).toBeGreaterThan(0);
    // held only past the gel point: before the share passes onset, the water has no yield
    const k = r.series.share.findIndex((f) => f > 0.2);
    expect(r.series.yield.slice(0, k).every((y) => y === 0)).toBe(true);
    expect(r.gel.from.relations.map((x) => x.relation)).toEqual(['percolation', 'krieger-dougherty']);
    expect(r.model.laws[2].from).toEqual({ scale: 'microscopic', observe: 'aggregated', of: 'protein' });
  });

  it('says what was read on the page, row by row with its source', () => {
    const page = assembleClassicalScene({ kind: 'classical-view', model: bead(handed) });
    const sec = page.science.honesty.sections.find((s) => s.head === 'Read from another scale');
    expect(sec.items.length).toBe(3);
    expect(sec.items[1].note).toMatch(/de Gennes/);
  });

  it('advises when a body falls too fast for Stokes\'s drag', () => {
    const r = solveClassical({ model: { ...bead({}), bodies: [{ id: 'ball', matter: 'steel', radius: '2 mm', at: [0, 0, 0] }], duration: 2 } });
    expect(gateOf(r, 'stokes-regime').ok).toBe(false);
  });

  it('refuses a handoff without relations, both a curve and a handoff, a lower rung with nothing to read, and a row outside its range', () => {
    expect(() => solveClassical({ model: bead({ from: handed.from }) })).toThrow(/needs the relations/);
    expect(() => solveClassical({ model: bead({ ...handed, curve: [{ at: 1, yield: 1 }] }) })).toThrow(/not both/);
    expect(() => solveClassical({ model: bead({ ...handed, from: { microscopic: { ...micro(), laws: [{ law: 'brownian' }] } } }) })).toThrow(/no aggregation law/);
    expect(() => readRelations([{ relation: 'krieger-dougherty', phi: 0.7 }], 'r')).toThrow(/0.64/);
    expect(() => readRelations([{ relation: 'percolation', top: 1 }, { relation: 'percolation', top: 2 }], 'r')).toThrow(/two relations set the yield/);
  });
});
