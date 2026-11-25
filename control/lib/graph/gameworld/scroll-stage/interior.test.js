// The scroll stage's interior (scroll-stage/interior.js). The concepts: an interior is read and taught; it lays its
// sections end to end from its mouth, in steps, the open between a ceiling box and a floor box reaching past the frame;
// a mouth closes from near the frame's edges, a duct is narrow and bends, shutters stand bulkheads from the ceiling and
// the floor in turn, a core is wide; the guns stand on the walls facing the open; the open follows the camera's middle
// as the track moves across; it holds its laws, and a plan that breaks one is told; the same stage the same walls; a
// stage carries it as numbers.
import { describe, it, expect } from 'vitest';
import { SECTIONS, SECTION_IDS, PASSAGE, readInterior, planInterior, interiorLaws } from './interior.js';
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

  it('lays its sections end to end from its mouth, in steps, the open between a ceiling and a floor reaching past the frame', () => {
    const P = plan();
    expect(P.u0).toBe(Math.round(A * 1000) / 1000);
    expect(P.sections.map((s) => s.kind)).toEqual(SECTION_IDS);
    for (let k = 1; k < P.sections.length; k++) expect(P.sections[k].u0).toBe(P.sections[k - 1].u1);
    expect(P.u1).toBe(P.sections.at(-1).u1);
    for (const p of P.profile) {
      expect(p.hi).toBeGreaterThan(p.lo);
      const c = (p.u0 + p.u1) / 2, over = P.walls.find((w) => w.role === 'ceiling' && w.u0 <= c && c <= w.u1), under = P.walls.find((w) => w.role === 'floor' && w.u0 <= c && c <= w.u1);
      expect(over.v0).toBe(p.hi); expect(under.v1).toBe(p.lo);
      expect(over.v1 - p.mid).toBeGreaterThan(C / 2); expect(p.mid - under.v0).toBeGreaterThan(C / 2);
    }
  });

  it('each section by its row: a mouth closing, a duct narrow and bending, bulkheads in turn, a core wide', () => {
    const P = plan(), gap = (p) => (p.hi - p.lo) / C;
    const mouth = of(P, 'mouth');
    expect(gap(mouth[0])).toBeGreaterThan(gap(mouth.at(-1)));
    expect(Math.max(...of(P, 'duct').map(gap))).toBeLessThanOrEqual(SECTIONS.duct.gap[1] + 1e-6);
    expect(new Set(of(P, 'duct').map((p) => p.lo)).size).toBeGreaterThan(1);
    const bh = P.walls.filter((w) => w.role === 'bulkhead');
    expect(bh.length).toBeGreaterThan(1);
    const fromTop = bh.map((w) => { const p = P.profile.find((q) => q.u0 <= w.u0 && w.u0 <= q.u1); return w.v1 === p.hi; });
    for (let k = 1; k < fromTop.length; k++) expect(fromTop[k]).not.toBe(fromTop[k - 1]);
    expect(Math.min(...of(P, 'core').map(gap))).toBeGreaterThan(Math.max(...of(P, 'hall').map(gap)));
  });

  it('the guns stand on the walls, facing the open', () => {
    const P = plan();
    expect(P.mounts.length).toBeGreaterThan(0);
    for (const M of P.mounts) {
      const p = P.profile.find((q) => q.u0 <= M.u && M.u <= q.u1);
      expect(M.v).toBe(M.side === 'floor' ? p.lo : p.hi);
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
    const P = plan(), bad = { ...P, profile: P.profile.map((p, k) => (k === 20 ? { ...p, hi: p.lo + PASSAGE * ship.breadth * 0.5 } : p)) };
    const L = lawsOf(bad);
    expect(L.find((l) => l.id === 'passage').holds).toBe(false);
    expect(L.find((l) => l.id === 'continuity').holds).toBe(false);
    const jump = { ...P, profile: P.profile.map((p, k) => (k === 30 ? { ...p, lo: p.lo + C * 0.4, hi: p.hi + C * 0.4 } : p)) };
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
