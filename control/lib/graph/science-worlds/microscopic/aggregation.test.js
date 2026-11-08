import { describe, it, expect } from 'vitest';
import { solveMicroscopic } from './solve.js';
import { MICROSCOPIC_LAW } from './laws.js';

// Aggregation: one case per mode (nucleated growth's S-curve and its lag against concentration; coalescence against
// Smoluchowski), the books, the refusals, the absent-channel rule. Small pools, so each run is quick.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const ex = MICROSCOPIC_LAW.aggregation.example;
const pool = (count, law) => ({ ...ex, species: [{ ...ex.species[0], count }], laws: [{ law: 'brownian' }, law ?? ex.laws[1]] });

describe('science worlds: aggregation', () => {
  it('adds nothing to a model with no aggregation law', () => {
    const r = solveMicroscopic({ model: MICROSCOPIC_LAW.reaction.example });
    expect(r.aggregation).toBeUndefined();
    expect(r.series.aggregation).toBeUndefined();
  });

  it('draws an S-curve whose lag shortens as the monomer gets richer, losing no monomer', () => {
    const lean = solveMicroscopic({ model: pool(60) }), rich = solveMicroscopic({ model: pool(240) });
    const f = rich.series.aggregation.fraction;
    expect(f[0]).toBe(0);
    expect(f.at(-1)).toBeGreaterThan(0.5);
    // slow to start: the first tenth of the run aggregates less than its share of the whole
    expect(f[Math.round(f.length / 10)]).toBeLessThan(f.at(-1) / 10);
    expect(rich.aggregation.lag.value).toBeLessThan(lean.aggregation.lag.value ?? Infinity);
    expect(gateOf(rich, 'mass-conserved').ok).toBe(true);
  });

  it('merges clusters as Smoluchowski\'s constant kernel says', () => {
    const r = solveMicroscopic({ model: pool(120, { law: 'aggregation', of: 'monomer', mode: 'coalescence', kernel: '2e5 /M/s' }) });
    expect(gateOf(r, 'closed-form:smoluchowski').ok).toBe(true);
    expect(r.aggregation.clusters.end).toBeLessThan(r.aggregation.clusters.start);
  });

  it('is the same run for the same seed, and refuses a mixed mode or a reacting species', () => {
    expect(solveMicroscopic({ model: pool(120) }).series.aggregation).toEqual(solveMicroscopic({ model: pool(120) }).series.aggregation);
    expect(() => solveMicroscopic({ model: pool(120, { law: 'aggregation', of: 'monomer', mode: 'coalescence', kernel: '1e6 /M/s', grow: '1 /M/s' }) })).toThrow(/other mode/);
    const both = pool(120);
    both.species = [...both.species, { id: 'other', radius: '2 nm', count: 10 }];
    both.laws = [...both.laws, { law: 'reaction', from: ['monomer'], to: ['other'], rate: '1 /s' }];
    expect(() => solveMicroscopic({ model: both })).toThrow(/no reaction may also use it/);
  });
});
