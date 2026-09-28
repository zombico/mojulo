/**
 * vegetation/bamboo — a jointed culm as a lathe. Claims under test, each against the literature docs/vegetation.md
 * cites: Moso's internode profile (longest near #18 of ~50, 35 ± 10 cm, short basal internodes); the elongation wave
 * set to the measured peak (114.5 cm/day) predicts a season of 30–60 days; the hollow culm stands ~1.7× a solid rod of
 * the same mass and the graded wall beats a uniform one; the safety factor is lowest just after elongation; Moso stands
 * upright under its foliage while a leaning Bambusa droops; node bands are drawn only where they span 3 px; branch
 * buds alternate sides; groves land in the measured densities, running near random and clumping clustered; growth is
 * deterministic.
 */
import { describe, expect, it } from 'vitest';

import { G } from './mechanics.js';
import { ritzBuckling } from './palm.js';
import { elongation, growCulm, culmLadder, culmRings, runningGrove, clumpGrove, clarkEvans, ageTint, maturity } from './bamboo.js';

const DEG = Math.PI / 180;
/** Ritz safety of a culm, with the branch and leaf weight spread over the internode below its node. */
function safety(c, which = 'EI') {
  const at = (zz) => { let i = 0; while (i < c.N - 1 && c.z[i + 1] < zz) i++; return i; };
  return ritzBuckling({ H: c.z[c.N], EI: (zz) => c.sec[at(zz)][which], q: (zz) => { const i = at(zz); return (c.sec[i].q + c.nodeMass[i + 1] / Math.max(0.03, c.L[i])) * G; } });
}

describe('bamboo', () => {
  it('grows Moso internodes short–long–short, the longest near #18 of ~50', () => {
    const e = elongation('moso'); const mx = Math.max(...e.L);
    expect(e.L.length).toBe(50); expect(e.maxFrac).toBeGreaterThan(0.28); expect(e.maxFrac).toBeLessThan(0.45);
    expect(mx).toBeGreaterThan(0.25); expect(mx).toBeLessThan(0.47); expect(e.L[0] / mx).toBeLessThan(0.15); expect(e.L.at(-1)).toBeLessThan(mx);
  });

  it('predicts the elongation season from a wave set to the measured peak', () => {
    const e = elongation('moso');
    expect(e.peakRate).toBeGreaterThan(0.8); expect(e.peakRate).toBeLessThan(1.3);
    expect(e.daysTo95).toBeGreaterThan(30); expect(e.daysTo95).toBeLessThan(60);
  });

  it('stands on its hollow, graded wall', () => {
    const c = growCulm('moso', { seed: 2, age: 4 });
    const S = safety(c), Su = safety(c, 'EIuniform'), Ss = safety(c, 'EIsolid');
    expect(S).toBeGreaterThan(1.5); expect(S).toBeLessThan(4);
    expect(Su).toBeLessThan(S); expect(Ss).toBeLessThan(1);
    const ratio = Math.cbrt(S / Ss); expect(ratio).toBeGreaterThan(1.4); expect(ratio).toBeLessThan(1.9);
  });

  it('is least safe just after elongation: stiffness comes in months, weight over years', () => {
    const young = safety(growCulm('moso', { seed: 2, age: 0.05 })), year = safety(growCulm('moso', { seed: 2, age: 1 })), old = safety(growCulm('moso', { seed: 2, age: 4 }));
    expect(young).toBeLessThan(year); expect(Math.abs(old - year) / year).toBeLessThan(0.05);
    expect(maturity('moso', 0).dry).toBeCloseTo(0.26, 2); expect(maturity('moso', 6).dry).toBeCloseTo(0.63, 1);
  });

  it('keeps Moso upright under its foliage and droops a leaning Bambusa', () => {
    const moso = growCulm('moso', { seed: 2, age: 4 }); const bare = growCulm('vulgaris', { seed: 2, age: 4, leaves: false }), vul = growCulm('vulgaris', { seed: 2, age: 4 });
    expect(moso.tipAngle).toBeLessThan(10); expect(vul.tipAngle).toBeGreaterThan(30); expect(vul.tipAngle).toBeGreaterThan(bare.tipAngle + 15);
  });

  it('draws node bands only where they span 3 px, and costs rings by level', () => {
    const c = growCulm('moso', { seed: 2, age: 4 }); const lad = culmLadder(c);
    const banded = c.L.filter((l) => l >= lad.bandMin).length;
    expect(lad.rings.L2).toBeLessThanOrEqual(2 * banded + 3); expect(lad.rings.L3).toBeGreaterThan(lad.rings.L2); expect(lad.rings.L2).toBeGreaterThan(lad.rings.L1);
    for (const L of ['L3', 'L2', 'L1']) { const lower = { L3: 'L2', L2: 'L1', L1: 'L0' }[L]; expect(lad.culm[L].length).toBeGreaterThan(lad.culm[lower].length); }
    // first-year culms wear the wax ring; the rest a darker node band
    const wax = culmRings(c, { mode: 'band', bandMin: lad.bandMin, wax: true }).map((r) => r.col), plain = culmRings(c, { mode: 'band', bandMin: lad.bandMin }).map((r) => r.col);
    expect(JSON.stringify(wax)).not.toBe(JSON.stringify(plain)); expect(ageTint('moso', 0.5)).toEqual([1, 1, 1]);
  });

  it('alternates branch buds by 180° (distichous), drifting a few degrees a node', () => {
    const c = growCulm('moso', { seed: 2, age: 4 }); const firsts = c.plan.filter((p, i, a) => i === 0 || a[i - 1].k !== p.k);
    for (let i = 1; i < firsts.length; i++) { const d = Math.abs(((firsts[i].bud - firsts[i - 1].bud) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); expect(Math.abs(d - Math.PI)).toBeLessThan(6 * DEG); }
  });

  it('lands groves in the measured densities: running near random, clumping clustered', () => {
    const run = runningGrove({ W: 100, D: 70, seed: 3 }), clump = clumpGrove({ W: 100, D: 70, seed: 5 });
    const r = clarkEvans(run.culms, run), c = clarkEvans(clump.culms, clump);
    expect(r.perHa).toBeGreaterThan(1200); expect(r.perHa).toBeLessThan(11000); expect(r.R).toBeGreaterThan(0.9); expect(r.R).toBeLessThan(1.6);
    expect(c.R).toBeLessThan(0.6);
    const per = {}; for (const x of clump.culms) per[x.clump] = (per[x.clump] || 0) + 1; const sizes = Object.values(per).sort((a, b) => a - b);
    expect(sizes[Math.floor(sizes.length / 2)]).toBeGreaterThan(40); expect(sizes[Math.floor(sizes.length / 2)]).toBeLessThan(96);
  });

  it('is deterministic', () => {
    const a = growCulm('moso', { seed: 9, age: 2 }), b = growCulm('moso', { seed: 9, age: 2 });
    expect(JSON.stringify(a.P)).toBe(JSON.stringify(b.P)); expect(JSON.stringify(a.leaves)).toBe(JSON.stringify(b.leaves));
    expect(JSON.stringify(runningGrove({ seed: 8, years: 10 }).culms)).toBe(JSON.stringify(runningGrove({ seed: 8, years: 10 }).culms));
  });
});
