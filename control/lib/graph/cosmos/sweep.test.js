import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../vegetation/grow.js';
import { rollCube, sweep } from './sweep.js';
import { validateCube, dryRun } from './cosmos.js';
import { FIXTURES } from './fixtures.js';

describe('rollCube', () => {
  it('rolls valid cubes, and the same seed rolls the same cube', () => {
    const a = mulberry32(7), b = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const cube = rollCube(a);
      expect(() => validateCube(cube)).not.toThrow();
      expect(rollCube(b)).toEqual(cube);
    }
  });
  it('sets nothing at density 0 and every setting at density 1', () => {
    expect(rollCube(mulberry32(1), 0)).toEqual({});
    const full = rollCube(mulberry32(1), 1);
    expect(Object.keys(full)).toEqual(['reality', 'space', 'power', 'soul', 'mind', 'time']);
  });
});

describe('sweep', () => {
  const r = sweep({ n: 200, seed: 3 });

  it('is deterministic, byte for byte', () => {
    expect(JSON.stringify(sweep({ n: 200, seed: 3 }))).toBe(JSON.stringify(r));
    expect(JSON.stringify(sweep({ n: 200, seed: 4 }))).not.toBe(JSON.stringify(r));
  });

  it('counts every rolled cube once', () => {
    expect(r.verdicts.makeable + r.verdicts.gaps + r.verdicts.blocked).toBe(200);
    expect(r.godotOk).toBeLessThanOrEqual(200);
  });

  it('reports every fixture, with its verdict as the dry run gives it', () => {
    expect(r.fixtures.map((f) => f.id)).toEqual(FIXTURES.map((f) => f.id));
    for (const f of r.fixtures) expect(f.verdict, f.id).toBe(dryRun(FIXTURES.find((x) => x.id === f.id).cube).verdict);
  });

  it('ranks unlocks by lifts, never crediting more than it touches', () => {
    for (const rows of [r.unlock.facets, r.unlock.values]) {
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].lifts).toBeGreaterThanOrEqual(rows[i].lifts);
      for (const x of rows) {
        expect(x.makeable).toBeLessThanOrEqual(x.lifts);
        expect(x.lifts).toBeLessThanOrEqual(x.touches);
      }
    }
    for (const v of r.unlock.values) expect(['absent', 'local', 'partial']).toContain(v.status);
  });

  it('recounts the facet counterfactual by hand', () => {
    // build Mind whole: count the rolled cubes it lifts, recomputed from scratch
    const rand = mulberry32(3);
    let lifts = 0;
    for (let i = 0; i < 200; i++) {
      const d = dryRun(rollCube(rand));
      const rest = (list) => list.filter((x) => x.facet !== 'mind');
      if (d.verdict === 'blocked' ? !rest(d.blocked).length : !rest(d.gaps).length && d.gaps.length) lifts++;
    }
    expect(r.unlock.facets.find((f) => f.facet === 'mind').lifts).toBe(lifts);
  });
});
