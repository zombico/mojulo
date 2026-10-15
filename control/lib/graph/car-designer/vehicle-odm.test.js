import { describe, expect, it } from 'vitest';
import { solveSupercarDesign, SUPERCAR_ARCHETYPES, SUPERCAR_LANGUAGES } from './vehicle-odm.js';

describe('vehicle ODM architectural solve', () => {
  it('is deterministic across identical briefs', () => {
    const q = { seed: 91, architecture: 'midEngine', language: 'trackSpecial' };
    expect(solveSupercarDesign(q)).toEqual(solveSupercarDesign(q));
  });
  it('produces different seed-driven variants', () => {
    expect(solveSupercarDesign({ seed: 91 }).frame).not.toEqual(solveSupercarDesign({ seed: 92 }).frame);
  });
  it('solves all architecture/language combinations within laws', () => {
    for (const architecture of Object.keys(SUPERCAR_ARCHETYPES))
      for (const language of Object.keys(SUPERCAR_LANGUAGES)) {
        const s = solveSupercarDesign({ architecture, language });
        expect(s.valid).toBe(true);
        expect(s.laws.every((l) => l.pass)).toBe(true);
        expect(s.topology.stations.map((x) => x.t)).toEqual([...s.topology.stations.map((x) => x.t)].sort((a, b) => a - b));
        expect(Object.keys(s.topology.anchors)).toContain('wheelFL');
      }
  });
  it('respects explicit proportions without altering the seed contract', () => {
    const dimensions = { length: 4.7, width: 2.06, height: 1.16, wheelbaseRatio: 0.62 };
    const a = solveSupercarDesign({ seed: 7, dimensions });
    expect(a.frame.L).toBe(4.7);
    expect(a.frame.W).toBe(2.06);
    expect(a.frame.wheelbase).toBeCloseTo(4.7 * 0.62, 3);
    expect(a.valid).toBe(true);
  });
  it('rejects invalid vocabulary and physical bounds', () => {
    expect(() => solveSupercarDesign({ architecture: 'hovercraft' })).toThrow(/unknown/);
    expect(() => solveSupercarDesign({ dimensions: { length: 12 } })).toThrow(/length must/);
    expect(() => solveSupercarDesign({ dimensions: { length: NaN } })).toThrow(/length must/);
    expect(() => solveSupercarDesign({ dimensions: { magic: 1 } })).toThrow(/unknown dimension/);
  });
});
