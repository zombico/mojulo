// The scroll stage's interior (scroll-stage/interior.js). The concepts: an interior is read and taught; it lays its
// sections end to end from its mouth, in steps, its floor and ceiling lines through the steps' middles, so a change of
// height is a ramp;
// a mouth closes from near the frame's edges, a duct is narrow and bends, shutters stand bulkheads from the ceiling and
// the floor in turn, a core is wide; the guns stand on the walls facing the open; the open follows the camera's middle
// as the track moves across; it holds its laws, and a plan that breaks one is told; the same stage the same walls; a
// stage carries it as numbers.
import { describe, it, expect } from 'vitest';
import { SECTIONS, SECTION_IDS, PASSAGE, readInterior, planInterior, interiorLaws, openAt } from './interior.js';
import { scrollStageOf, readScrollStage } from './stage-scene.js';
import { stageManifest, STAGE_IDS } from './stages.js';

const G = scrollStageOf(stageManifest(STAGE_IDS[0])), { cam, ship } = G, C = cam.screen.across, A = cam.screen.along;
const ALL = { at: 1, sections: SECTION_IDS.map((kind) => ({ kind })) };
const flat = [{ by: [40 * A, 0], pace: 0.1 * A }];
const plan = (spec = ALL, track = flat) => planInterior(spec, { cam, track, start: [0, 0], seed: 3 });
const lawsOf = (P) => interiorLaws(P, { cam, ship, pace: 0.1 * A });
const of = (P, kind) => P.profile.filter((p) => P.sections[p.section].kind === kind);

describe('the scroll stage\'s interior', () => {
  it('is read and taught', () => {
    expect(readInterior(ALL)).toEqual([]);
    expect(readInterior({ at: 1, sections: [{ kind: 'vault' }] }).join()).toMatch(/is a section \(mouth, hall/);
    expect(readInterior({ sections: [{ kind: 'hall' }] }).join()).toMatch(/at is screens along/);
    expect(readInterior({ at: 1, look: 'castle', sections: [{ kind: 'hall', length: 40 }] }).join()).toMatch(/look is station \| facility.*length is screens/);
    expect(readScrollStage({ interior: { at: 1, sections: [] } }).join()).toMatch(/interior\.sections is a list/);
  });

  it('lays its sections end to end from its mouth, in steps; its floor and ceiling lines through the steps\' middles', () => {
    const P = plan();
    expect(P.u0).toBe(Math.round(A * 1000) / 1000);
    expect(P.sections.map((s) => s.kind)).toEqual(SECTION_IDS);
    for (let k = 1; k < P.sections.length; k++) expect(P.sections[k].u0).toBe(P.sections[k - 1].u1);
    expect(P.u1).toBe(P.sections.at(-1).u1);
    expect(P.edges[0].u).toBe(P.u0); expect(P.edges.at(-1).u).toBe(P.u1);
    expect(P.edges).toHaveLength(P.profile.length + 2);
    for (const p of P.profile) { const o = openAt(P, (p.u0 + p.u1) / 2); expect(o[0]).toBeCloseTo(p.lo, 2); expect(o[1]).toBeCloseTo(p.hi, 2); }
    expect(openAt(P, P.u0 - 1)).toBeNull();
    expect(P.reach).toBeGreaterThan(C * 0.99);
  });

  it('a change of height is a ramp, never a stair: between two knots the open moves on a line', () => {
    const P = plan(), k = P.edges.findIndex((q, i) => i > 0 && Math.abs(q.lo - P.edges[i - 1].lo) > 1);
    const a = P.edges[k - 1], b = P.edges[k], m = openAt(P, (a.u + b.u) / 2);
    expect(m[0]).toBeCloseTo((a.lo + b.lo) / 2, 6);
    expect(m[0]).not.toBeCloseTo(a.lo, 3);
  });

  it('each section by its row: a mouth closing, a duct narrow and bending, bulkheads in turn, a core wide', () => {
    const P = plan(), gap = (p) => (p.hi - p.lo) / C;
    const mouth = of(P, 'mouth');
    expect(gap(mouth[0])).toBeGreaterThan(gap(mouth.at(-1)));
    expect(Math.max(...of(P, 'duct').map(gap))).toBeLessThanOrEqual(SECTIONS.duct.gap[1] + 1e-6);
    expect(new Set(of(P, 'duct').map((p) => p.lo)).size).toBeGreaterThan(1);
    const bh = P.walls.filter((w) => w.role === 'bulkhead');
    expect(bh.length).toBeGreaterThan(1);
    for (let k = 1; k < bh.length; k++) expect(bh[k].from).not.toBe(bh[k - 1].from);
    for (const w of bh) { const o = openAt(P, (w.u0 + w.u1) / 2); expect(w.from === 'ceiling' ? w.v1 > o[1] : w.v0 < o[0]).toBe(true); }
    expect(Math.min(...of(P, 'core').map(gap))).toBeGreaterThan(Math.max(...of(P, 'hall').map(gap)));
  });

  it('the guns stand on the walls, facing the open', () => {
    const P = plan();
    expect(P.mounts.length).toBeGreaterThan(0);
    for (const M of P.mounts) {
      const o = openAt(P, M.u);
      expect(M.v).toBeCloseTo(M.side === 'floor' ? o[0] : o[1], 6);
    }
    expect(new Set(P.mounts.map((M) => M.side)).size).toBe(2);
  });

  it('the open follows the camera\'s middle as the track moves across', () => {
    const up = [{ by: [40 * A, 4 * C], pace: 0.1 * A }], P0 = plan(ALL, flat), P1 = plan(ALL, up);
    const k = P0.profile.length - 1, rise = (u) => (4 * C * u) / (40 * A);
    expect(P1.profile[k].lo - P0.profile[k].lo).toBeCloseTo(rise((P0.profile[k].u0 + P0.profile[k].u1) / 2), 1);
  });

  it('holds its laws; a plan that breaks one is told', () => {
    expect(lawsOf(plan()).filter((l) => !l.holds)).toEqual([]);
    const P = plan(), bad = { ...P, edges: P.edges.map((q, k) => (k === 20 ? { ...q, hi: q.lo + PASSAGE * ship.breadth * 0.5 } : q)) };
    const L = lawsOf(bad);
    expect(L.find((l) => l.id === 'passage').holds).toBe(false);
    expect(L.find((l) => l.id === 'continuity').holds).toBe(false);
    const jump = { ...P, edges: P.edges.map((q, k) => (k === 30 ? { ...q, lo: q.lo + C * 0.4, hi: q.hi + C * 0.4 } : q)) };
    expect(lawsOf(jump).find((l) => l.id === 'climb').holds).toBe(false);
    expect(lawsOf(jump).find((l) => l.id === 'on-screen').holds).toBe(false);
  });

  it('the same stage the same walls; another seed others', () => {
    expect(JSON.stringify(plan())).toBe(JSON.stringify(plan()));
    expect(JSON.stringify(planInterior({ ...ALL, seed: 9 }, { cam, track: flat }).walls)).not.toBe(JSON.stringify(plan().walls));
  });

  it('a stage carries it as numbers', () => {
    const M = stageManifest(STAGE_IDS[0]), S = scrollStageOf({ ...M, scroll: { ...M.scroll, interior: { at: 2, sections: [{ kind: 'hall' }] } } });
    expect(S.interior.sections).toEqual([{ kind: 'hall', u0: S.interior.u0, u1: S.interior.u1 }]);
    expect(G.interior).toBeNull();
  });
});
