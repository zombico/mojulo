/**
 * vegetation — trees: growth, the level-of-detail ladder, the wood field and bark. Claims under test: growth is
 * deterministic; lignin and cambium are separate dials (no cambium, no thickening); the pipe model makes Leonardo's
 * rule emergent (area-preserving branching, Δ near 2 to 3); the ladder cuts by the pipe model, each level cheaper
 * than the one above; wood is a formation-time field whose level sets at the stump count the years; bark is fracture
 * (beech keeps up and stays smooth, oak cracks at a spacing set by its thickness and runs along the stem, sweet
 * chestnut's cracks lean with its spiral grain).
 */
import { describe, expect, it } from 'vitest';

import { grow, measure } from './grow.js';
import { ladder } from './ladder.js';
import { woodField } from './wood.js';
import { growBark, barkStats } from './bark.js';

describe('trees', () => {
  const fir = grow('massart', { years: 10, seed: 3 });

  it('grows deterministically', () => {
    const again = grow('massart', { years: 10, seed: 3 });
    expect(JSON.stringify(again.nodes.map((n) => n.pos))).toBe(JSON.stringify(fir.nodes.map((n) => n.pos)));
  });

  it('keeps lignin and cambium separate: no cambium, no thickening', () => {
    const base = (p) => { const n = p.nodes.find((q) => q.axis === 0 && q.parent >= 0); return Math.sqrt(n.area.at(-1) / Math.PI); };
    const monocot = grow('massart', { years: 10, seed: 3, cambium: 0 });
    expect(base(monocot)).toBeLessThan(base(fir) * 0.3);
  });

  it('makes Leonardo emergent from the pipe model', () => {
    const d = measure(fir).leonardo.median; expect(d).toBeGreaterThan(1.8); expect(d).toBeLessThan(3.2);
  });

  it('cuts its ladder by the pipe model, each level cheaper', () => {
    const H = measure(fir).height ?? Math.max(...fir.nodes.map((n) => n.pos[2])); const L = ladder(fir, H);
    expect(L.L3.length).toBeGreaterThan(L.L2.length); expect(L.L2.length).toBeGreaterThan(L.L1.length); expect(L.L1.length).toBeGreaterThan(L.L0.length);
    expect(L.L0.length).toBeLessThan(1000);
  });

  it('counts the years in the wood field at the stump', () => {
    const f = woodField(fir); const rings = new Set();
    for (let x = 0.0005; x < 0.031; x += 0.0002) { const s = f.t([x, 0, 0.3]); if (s.t !== null && Number.isFinite(s.t)) rings.add(Math.floor(s.t)); }
    expect(rings.size).toBe(10);
    expect(f.t([0.001, 0, 0.3]).t).toBeLessThan(f.t([0.025, 0, 0.3]).t);
  });

  it('breaks bark as fracture: smooth beech, oak by its thickness and along the stem, chestnut with the grain', () => {
    const rHist = [...Array(90)].map((_, y) => Math.sqrt(((y + 1) * 0.4 ** 2) / 90));   // constant ring area to 0.4 m at 90
    const s = (sp) => barkStats(growBark(rHist, sp, { rows: 160, height: 0.6, seed: 5 }));
    const beech = s('beech'), oak = s('oak'), chestnut = s('chestnut');
    expect(beech.cracks).toBe(0);
    expect(oak.plateOverThickness).toBeGreaterThan(0.3); expect(oak.plateOverThickness).toBeLessThan(1.5); expect(Math.abs(oak.medianAngle)).toBeLessThan(5);
    expect(chestnut.medianAngle).toBeGreaterThan(25);
  });
});
