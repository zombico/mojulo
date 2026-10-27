import { describe, it, expect } from 'vitest';
import { bushForm, bushBlossom, bushBerries, BUSH_HABITS, BUSH_FORM, BUSH_ADORN, ADORN } from './bush-form.js';
import { leafClump, leafSpray, leafHolds, needleHabit } from '../vegetation/sprays.js';
import { LEAF_FORM_IDS } from '../era/leaf-forms.js';

// one form per distinct procedure: an envelope laid over (with stems), the arches, the rings from the ground
const byShape = (shape) => Object.keys(BUSH_HABITS).find((f) => BUSH_HABITS[f].shape === shape);
const CASES = ['dome', 'fountain', 'rosette'].map(byShape);

describe('a bush read as form', () => {
  it('has a habit for every leaf form a bush kind names', () => {
    expect(Object.keys(BUSH_HABITS).sort()).toEqual([...LEAF_FORM_IDS].sort());
  });

  it('is deterministic from its seed, and another seed another bush', () => {
    for (const f of CASES) {
      expect(JSON.stringify(bushForm(f, { seed: 4 }))).toBe(JSON.stringify(bushForm(f, { seed: 4 })));
      expect(JSON.stringify(bushForm(f, { seed: 4 }).clumps)).not.toBe(JSON.stringify(bushForm(f, { seed: 5 }).clumps));
    }
  });

  it('lays its clumps within its outline, facing out of it, and a spray near each inside it', () => {
    for (const f of CASES) {
      const B = bushForm(f, { seed: 2, height: 1.2 });
      expect(B.clumps.length).toBeGreaterThan(5);
      for (const c of B.clumps) {
        expect(Math.hypot(c.p[0], c.p[1])).toBeLessThanOrEqual(B.radius * 1.1);
        expect(c.p[2]).toBeGreaterThanOrEqual(0);
        expect(c.p[2]).toBeLessThanOrEqual(B.height * 1.15);
        expect(Math.hypot(...c.o)).toBeCloseTo(1, 3);
        // (out of the bush: never facing in toward its axis)
        expect(c.o[0] * c.p[0] + c.o[1] * c.p[1] + c.o[2] * Math.max(0.05, c.p[2])).toBeGreaterThan(-1e-6);
      }
      expect(B.sites.length).toBeLessThanOrEqual(B.clumps.length * BUSH_FORM.sprays);
      expect(B.sites.length).toBeGreaterThanOrEqual(B.clumps.length);
    }
  });

  it('is a crown with no trunk: its stems rise from the foot, thin, and a rosette has none', () => {
    const dome = bushForm(byShape('dome'), { seed: 3, height: 1.2 }), { pos } = dome.wood;
    expect(dome.wood.idx.length).toBeGreaterThan(0);
    let low = Infinity; for (let i = 2; i < pos.length; i += 3) low = Math.min(low, pos[i]);
    expect(low).toBeLessThan(0.05);
    expect(bushForm(byShape('rosette'), { seed: 3 }).wood.idx.length).toBe(0);
  });

  it('is economical: its clumps a small share of a tree\'s, its sprays coming in close', () => {
    for (const f of Object.keys(BUSH_HABITS).filter((f, i, a) => a.findIndex((g) => BUSH_HABITS[g].shape === BUSH_HABITS[f].shape) === i)) {
      const B = bushForm(f, { seed: 1, height: 1.2 }), tris = B.clumps.length * leafClump(B.leaf, { seed: 1 }).tris.length;
      expect(tris).toBeLessThan(2500);
      expect(B.detail[1]).toBeLessThan(10);
    }
  });

  it('carries its habit\'s leaf: needles, their pads turned out of the bush (never lying level), a broad leaf as clumps', () => {
    const needled = Object.keys(BUSH_HABITS).find((f) => needleHabit(BUSH_HABITS[f].leaf) && needleHabit(BUSH_HABITS[f].leaf) !== 'pine');
    const B = bushForm(needled, { seed: 1 });
    expect(B.needles).toBe(BUSH_HABITS[needled].leaf.needle);
    expect(B.pad).toBe(false);
    expect('needles' in bushForm(byShape('dome'), { seed: 1 })).toBe(false);
    expect(() => bushForm('nope')).toThrow(/bush habit/);
  });
});

describe('a bush in its season', () => {
  const f = byShape('dome');
  it('is green unless it is asked: the same bush, nothing added', () => {
    const G = bushForm(f, { seed: 6 });
    expect('blooms' in G).toBe(false);
    expect(JSON.stringify(bushForm(f, { seed: 6, adorn: 'bloom' }).clumps)).toBe(JSON.stringify(G.clumps));
    expect(() => bushForm(f, { adorn: 'snow' })).toThrow(/adorn/);
  });

  it('blooms on its outside, facing out, up to its cap', () => {
    const B = bushForm(f, { seed: 6, adorn: 'bloom', height: 1.2 });
    expect(B.blooms.length).toBeGreaterThan(10);
    expect(B.blooms.length).toBeLessThanOrEqual(ADORN.cap[0]);
    expect(B.look).toEqual(BUSH_ADORN[f].bloom);
    for (const b of B.blooms) expect(b.o[0] * b.p[0] + b.o[1] * b.p[1] + b.o[2] * Math.max(0.05, b.p[2])).toBeGreaterThan(0);
    // (a blossom read at a walker's distance: larger than the habit's own)
    const span = Math.max(...bushBlossom(B.look).flatMap((t) => t.p.map((q) => Math.hypot(q[0], q[1]))));
    expect(span).toBeCloseTo(B.look.r * ADORN.size, 3);
  });

  it('fruits under its outer, lower leaves: clusters hanging, not on top', () => {
    const B = bushForm(f, { seed: 6, adorn: 'fruit', height: 1.2 });
    expect(B.berries.length).toBeGreaterThan(3);
    expect(B.berries.length).toBeLessThanOrEqual(ADORN.cap[1]);
    for (const b of B.berries) { expect(b.p[2]).toBeLessThan(B.height); expect(b.n).toBeGreaterThanOrEqual(ADORN.berries[0]); }
    // (a cluster hangs from its stalk's top: every berry below it)
    for (const t of bushBerries(B.look, 4, 1)) for (const q of t.p) expect(q[2]).toBeLessThanOrEqual(1e-9);
  });
});

describe('the sprays take a leaf where they take a species', () => {
  it('a broad leaf and a needle at a bush\'s scale', () => {
    const leaf = BUSH_HABITS[byShape('dome')].leaf, S = leafSpray(leaf, { seed: 1 }), C = leafClump(leaf, { seed: 1 });
    expect(S.leaves).toBeGreaterThan(0);
    // (a smaller leaf than any tree's: the clump spans a hand, not an arm)
    const span = (T) => { let m = 0; for (const t of T.tris) for (const p of t.p) m = Math.max(m, Math.hypot(...p)); return m; };
    expect(span(C)).toBeLessThan(0.3);
    const needle = Object.values(BUSH_HABITS).find((h) => h.leaf.needle).leaf;
    expect(span(leafClump(needle, { seed: 1 }))).toBeLessThan(span(leafClump({ needle: needle.needle }, { seed: 1 })));
    expect(leafHolds(leaf).clump).toBeGreaterThan(leafHolds(leaf).spray);
  });
});
