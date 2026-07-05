import { describe, expect, it } from 'vitest';

import { eulerTrailStatus, searchAllTrails, planKoenigsberg, assembleKoenigsbergScene, KOENIGSBERG_VARIANTS } from './koenigsberg.js';

describe('Königsberg — the theorem (parity argument)', () => {
  it('the historic seven bridges leave all four shores odd → no Eulerian trail', () => {
    const status = eulerTrailStatus(KOENIGSBERG_VARIANTS.historic.bridges);
    expect(status.degrees).toEqual({ A: 3, B: 3, C: 5, D: 3 });
    expect(status.oddCount).toBe(4);
    expect(status.exists).toBe(false);
  });

  it('the Euler variant (drop one bridge) leaves exactly two odd shores → a trail exists', () => {
    const status = eulerTrailStatus(KOENIGSBERG_VARIANTS.euler.bridges);
    expect(status.oddCount).toBe(2);
    expect(status.exists).toBe(true);
    expect(status.startNodes).toEqual(['A', 'B']);
  });
});

describe('Königsberg — the brute force agrees with the theorem', () => {
  it('exhaustive consumable-edge DFS finds NO complete trail on the historic bridges', () => {
    const search = searchAllTrails(KOENIGSBERG_VARIANTS.historic.bridges);
    expect(search.completes).toBe(false);
    expect(search.maxCrossings).toBeLessThan(7);              // every attempt strands early
    expect(search.certificate).toMatchObject({ kind: 'euler-trail-counterexample', claim: 'no walk crosses all bridges exactly once' });
    expect(search.certificate.bridgesLeft).toBeGreaterThan(0);
  });

  it('exhaustive DFS DOES complete on the Euler variant — a witnessing trail of all 6 bridges', () => {
    const search = searchAllTrails(KOENIGSBERG_VARIANTS.euler.bridges);
    expect(search.completes).toBe(true);
    expect(search.completingTrail).toHaveLength(6);
    expect(new Set(search.completingTrail).size).toBe(6);     // each bridge exactly once
  });
});

describe('Königsberg — walkable geometry', () => {
  it('is deterministic and carries the theorem + certificate as a sidecar', () => {
    const m = { kind: 'koenigsberg', structure: { variant: 'historic' } };
    expect(JSON.stringify(planKoenigsberg(m))).toBe(JSON.stringify(planKoenigsberg(m)));
    const scene = assembleKoenigsbergScene(m, { title: 'test bridges' });
    expect(scene.faces.length).toBeGreaterThan(0);
    expect(scene.koenigsbergPlan.theorem.exists).toBe(false);
    expect(scene.koenigsbergPlan.search.completes).toBe(false);
    expect(scene.koenigsbergPlan.bridges).toHaveLength(7);
  });
});
