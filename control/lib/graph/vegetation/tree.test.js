/**
 * vegetation — trees: growth, the level-of-detail ladder, the wood field and bark. Claims under test: growth is
 * deterministic; lignin and cambium are separate dials (no cambium, no thickening); the pipe model makes Leonardo's
 * rule emergent (area-preserving branching, Δ near 2 to 3); a stand lifts and narrows the crown; an evergreen keeps
 * the leaves of past years; the ladder cuts by the
 * pipe model, each level cheaper
 * than the one above; wood is a formation-time field whose level sets at the stump count the years; bark is fracture
 * (beech keeps up and stays smooth, oak cracks at a spacing set by its thickness and runs along the stem, sweet
 * chestnut's cracks lean with its spiral grain).
 */
import { describe, expect, it } from 'vitest';

import { grow, measure, ARCHITECTURES } from './grow.js';
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

  it('grown in a stand, lifts and narrows its crown (its low branches starve under the neighbours and are shed)', () => {
    const pct = (a, q) => { const x = [...a].sort((u, v) => u - v); return x[Math.floor(q * (x.length - 1))]; };
    const form = (p) => { const H = measure(p).height, leafy = p.nodes.filter((n) => !n.died && n.leaves > 0); return { base: pct(leafy.map((n) => n.pos[2]), 0.1) / H, radius: pct(leafy.map((n) => Math.hypot(n.pos[0], n.pos[1])), 0.9) / H }; };
    const open = form(fir), stand = form(grow('massart', { years: 10, seed: 3, stand: 0.5 }));
    expect(stand.base).toBeGreaterThan(open.base + 0.15); expect(stand.radius).toBeLessThan(0.8 * open.radius);
    expect(JSON.stringify(grow('massart', { years: 10, seed: 3, stand: 0 }).nodes.map((n) => n.pos))).toBe(JSON.stringify(fir.nodes.map((n) => n.pos)));   // absent, as before
  });

  it('as an evergreen keeps its leaves on the shoots of past years; deciduous, only on this year\'s', () => {
    const leafyBorn = (p) => p.nodes.filter((n) => !n.died && n.leaves > 0).map((n) => n.born);
    const dec = grow('leeuwenberg', { years: 12, seed: 4 }), ev = grow({ ...ARCHITECTURES.leeuwenberg, leafLife: 3 }, { years: 12, seed: 4 });
    expect(Math.min(...leafyBorn(dec))).toBe(Math.max(...leafyBorn(dec)));
    expect(Math.max(...leafyBorn(ev)) - Math.min(...leafyBorn(ev))).toBe(2);
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
