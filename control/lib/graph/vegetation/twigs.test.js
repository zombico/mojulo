// A crown's leaves as BUNDLES (vegetation/twigs.js): each leaf a few triangles of its outline, a hand of them through a
// clump's room, each leaf its own finger pointed out of the crown and turned its own way; the crown's clumps fewer and aimed (form/tree-form.js crossClumps), a
// grown tree's stem bare and its spread its own (growUp); far off, every clump in place with half its leaves. Drawn to its
// twigs (`twigs`), every cross on a shoot whose twig is drawn.
import { describe, it, expect } from 'vitest';
import { LEAF_TRIS, MAPLE_TRIS, CROSS, leafCross, leafShape } from './twigs.js';
import { SPECIES } from './species.js';
import { treeForm, crossClumps, TREE_FORM, SHOOTS } from '../form/tree-form.js';

const span = (tris) => Math.max(...tris.flatMap((t) => t.p.flatMap((q) => q.map(Math.abs))));
// (one broadleaf a leaf outline, picked from the catalog: the procedure each runs through)
const byShape = Object.fromEntries(Object.keys(SPECIES).filter((s) => SPECIES[s].kind === 'tree').map((s) => [leafShape(s), s]));

describe('the leaves as a few triangles', () => {
  it('draws every outline in a handful of triangles, the maple the operator\'s four', () => {
    expect(LEAF_TRIS.palmate).toHaveLength(MAPLE_TRIS.length);
    expect(MAPLE_TRIS).toHaveLength(4);
    expect(LEAF_TRIS.lobed).toHaveLength(4);
    expect(LEAF_TRIS.lance).toHaveLength(3);
    for (const T of Object.values(LEAF_TRIS)) expect(T.length).toBeLessThanOrEqual(6);
  });

  it('every triangle of a leaf faces the same way: its overlapping pieces never show a back beside a front (no flicker)', () => {
    for (const T of Object.values(LEAF_TRIS)) for (const [a, b, c] of T) expect((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])).toBeGreaterThan(0);
  });

  it('a bundle is a hand of its outline, one card a leaf, the same each time, inside the clump\'s room; half the leaves far off', () => {
    for (const shape of ['palmate', 'lobed', 'lance']) {
      const sp = byShape[shape]; if (!sp) continue;
      const B = { ...CROSS.bundle, ...(CROSS.byShape[shape] || {}) }, A = leafCross(sp, { seed: 3 });
      expect(A).toEqual(leafCross(sp, { seed: 3 }));
      expect(A.tris.length).toBe(B.count * LEAF_TRIS[shape].length);
      const half = Math.round(B.count / 2), far = leafCross(sp, { seed: 3, bundle: { count: half } });
      expect(far.tris.length).toBe(half * LEAF_TRIS[shape].length);
      // (no leaf strays past the room: its spread and a leaf's length)
      const R = span(leafCross(sp, { seed: 3, bundle: { count: 1, spread: 0, depth: 0 } }).tris);
      expect(span(A.tris)).toBeLessThan(R * 8);
    }
  });
});

describe('a hand of leaves', () => {
  it('every leaf a finger: its tip out of the crown, within the hand\'s opening, its face turned out of the crown, no two leaves one plane', () => {
    const sp = byShape.palmate ?? 'oak', shape = leafShape(sp), per = LEAF_TRIS[shape].length, T = leafCross(sp, { seed: 4 }).tris, B = { ...CROSS.bundle, ...(CROSS.byShape[shape] || {}) };
    const sub = (a, b) => a.map((v, i) => v - b[i]), nrmOf = (t) => { const u = sub(t.p[1], t.p[0]), v = sub(t.p[2], t.p[0]), c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...c); return c.map((x) => x / l); };
    const faces = [];
    for (let k = 0; k < T.length; k += per) {
      const n = nrmOf(T[k]); faces.push(n);
      // (its face out of the crown, double-sided: the larger of its two sides' share of +z, a third of it at least)
      expect(Math.abs(n[2])).toBeGreaterThan(0.3);
    }
    // (each its own way: no two leaves' faces within a degree of each other)
    let same = 0; for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) if (Math.abs(faces[i].reduce((a, v, q) => a + v * faces[j][q], 0)) > Math.cos(Math.PI / 180)) same++;
    expect(same).toBe(0);
    expect(B.out[1]).toBeLessThan(90);
  });
});

describe('a crown of crosses', () => {
  const sp = byShape.palmate ?? 'oak';
  const T = treeForm(sp, { seed: 5 }), C = crossClumps(T);

  it('a grown tree: no leaf on its bare stem; its crosses at its branch tips, fewer than its clumps, no mass beneath them', () => {
    expect(Math.min(...T.clumps.map((c) => c.p[2]))).toBeGreaterThan(TREE_FORM.lift * T.height * 0.9);
    expect(C.length).toBeLessThan(T.clumps.length);
    for (const c of C) expect(T.tips.some((t) => t.p.every((v, k) => v === c.p[k]))).toBe(true);
  });

  it('every cross upright on its slot, its card facing out of the crown', () => {
    for (const c of C) {
      expect(Math.abs(c.o[0] * c.d[0] + c.o[1] * c.d[1] + c.o[2] * c.d[2])).toBeLessThan(3e-3);
      if (Math.hypot(c.o[0], c.o[1]) > 0.3) expect(c.d[2]).toBeGreaterThan(0.5);
    }
  });

  it('drawn to its twigs, every cross sits on its drawn wood, no leaf mass where no branch is', () => {
    const W = treeForm(sp, { seed: 5, twigs: true }), V = W.wood.pos, X = crossClumps(W);
    expect(W.wood.idx.length).toBeGreaterThan(T.wood.idx.length);
    const near = (p) => { let m = Infinity; for (let i = 0; i < V.length; i += 3) m = Math.min(m, Math.hypot(V[i] - p[0], V[i + 1] - p[1], V[i + 2] - p[2])); return m; };
    for (const c of X.filter((c) => !c.w)) expect(near(c.p)).toBeLessThan(SHOOTS.ring);
  });

  it('each tree its own spread and lean by its seed', () => {
    const reach = (F) => Math.max(...F.clumps.map((c) => Math.hypot(c.p[0], c.p[1])));
    const r = [5, 6, 7, 8].map((seed) => reach(treeForm(sp, { seed })));
    expect(Math.max(...r) - Math.min(...r)).toBeGreaterThan(0.2);
  });
});
