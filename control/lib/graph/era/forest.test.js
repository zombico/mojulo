// A forest's trees (era/isekai.js, era/nature.js): a gritty crown hollowed of what its lobes bury, clumps arranged as an
// ikebana triad, and every tree in one band by the trail — the hero whole, the stock stamped from templates, the far a
// shell. Absent `compose` and `bands`, the trees are as they were.
import { describe, expect, it } from 'vitest';
import { hollowed, TREE_BANDS, ISEKAI_STYLES } from './isekai.js';
import { treeItems, CLUMP } from './nature.js';
import { readBiocube, withFlora, BIOCUBE_IDS } from './biocube.js';
import { outTrailSite } from './out-trail.js';
import { assembleStageScene } from './stage.js';
import { blobTris } from '../vegetation/tree-mesh.js';
import { LEAF_SPECIES, LEAF_FORMS } from './leaf-forms.js';
import { readGeocube } from './geocube.js';

const lobe = (at, r, id) => {
  const tris = blobTris(at, [r, r, r], null, { detail: 0 }).map((t) => t.p);
  return { L: { at, r, tris, id }, faces: tris.map((cs) => ({ corners: cs, normal: [0, 0, 1], group: 'isekai:crown', _lobe: id })) };
};

describe('a hollowed crown', () => {
  it('leaves out only what another lobe buries, keeping everything else', () => {
    const big = lobe([0, 0, 0], 2, 0), small = lobe([0.2, 0, 0.1], 0.5, 1), apart = lobe([10, 0, 0], 1, 2), half = lobe([2, 0, 0], 1, 3);
    const trunk = { corners: [[0, 0, -3], [0.1, 0, -3], [0.1, 0, 0]], normal: [0, -1, 0], group: 'isekai:wood' };
    const out = hollowed([trunk, ...big.faces, ...small.faces, ...apart.faces, ...half.faces], [big.L, small.L, apart.L, half.L]);
    const kept = (L) => out.filter((f) => L.faces.some((g) => g.corners === f.corners)).length;
    expect(kept(small)).toBe(0);
    expect(kept(apart)).toBe(apart.faces.length);
    expect(kept(big)).toBe(big.faces.length);
    expect(kept(half)).toBeGreaterThan(0);
    expect(kept(half)).toBeLessThan(half.faces.length);
    expect(out).toContain(trunk);
    expect(out.every((f) => f._lobe === undefined)).toBe(true);
  });
});

describe('a forest\'s clumps and bands', () => {
  const st = withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube('forest')), site = outTrailSite(st, {}, 1), trees = treeItems(st, site, 1);
  const front = (t) => Math.abs(site.trailX(t.y) - t.x);

  it('arranges each clump: the tallest at the back, the principals stepping scalene, the trail\'s side open', () => {
    expect(BIOCUBE_IDS).toContain('forest');
    const clumps = new Map();
    for (const t of trees) (clumps.get(t.cluster) ?? clumps.set(t.cluster, []).get(t.cluster)).push(t);
    let triads = 0;
    for (const C of clumps.values()) {
      const [shin, soe, hikae] = ['shin', 'soe', 'hikae'].map((r) => C.find((t) => t.role === r));
      if (!(shin && soe && hikae)) continue;
      triads++;
      expect(shin.h).toBeGreaterThan(soe.h);
      expect(soe.h).toBeGreaterThan(hikae.h);
      expect(C.filter((t) => t.role === 'filler').every((t) => t.h < hikae.h + 1e-6)).toBe(true);
      expect(front(shin)).toBeGreaterThan(Math.min(front(soe), front(hikae)));
    }
    expect(triads).toBeGreaterThan(0);
    expect(CLUMP.steps).toEqual([1, 0.75, 0.56]);
  });

  it('builds each tree by its band: none of the templates on the map, the stock stamped, the shade a tint', () => {
    const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: 'forest' }, {});
    expect(P.repeats?.length).toBeGreaterThan(0);
    expect(P.faces.every((f) => f.corners[0][0] > TREE_BANDS.off / 2)).toBe(true);
    for (const r of P.repeats) {
      expect(r.template.every((f) => f.corners.every((c) => Math.hypot(c[0], c[1]) < 20))).toBe(true);
      for (const t of r.transforms) {
        expect(t.scale).toBeGreaterThan(0);
        if (t.tint) expect(t.tint.every((v) => v >= TREE_BANDS.shade - 1e-6 && v <= 1)).toBe(true);
      }
    }
    // (the stock is the trees between the bands; the rest are built)
    const d = (t) => site.trailDist(t.x, t.y) - site.halfWAt(t.y);
    const stock = trees.filter((t) => !t.hero && d(t) >= TREE_BANDS.hero && d(t) <= TREE_BANDS.far).length;
    expect(P.repeats.reduce((a, r) => a + r.transforms.length, 0)).toBe(stock);
    // (gritty: the stock's templates chipped; a far tree its core alone, no chip within its crown)
    expect(P.repeats.every((r) => r.template.some((f) => f.group === 'isekai:chips'))).toBe(true);
    const far = trees.filter((t) => !t.hero && d(t) > TREE_BANDS.far), chips = P.faces.filter((f) => f.group === 'isekai:chips');
    expect(far.length).toBeGreaterThan(0);
    expect(far.every((t) => !chips.some((f) => Math.hypot(f.corners[0][0] - t.x, f.corners[0][1] - t.y) < t.h * 0.12))).toBe(true);
  }, 60000);

  it('reads its bands and composition, and refuses what is not one', () => {
    expect(() => readBiocube({ from: 'grove', flora: { trees: { bands: { hero: 20, far: 10 } } } })).toThrow(/nearer/);
    expect(() => readBiocube({ from: 'grove', flora: { trees: { compose: 'grid' } } })).toThrow(/ikebana/);
    expect(readBiocube({ from: 'grove', flora: { trees: { bands: { hero: 5 }, compose: 'ikebana' } } }).flora.trees.bands).toEqual({ hero: 5 });
    // (a forest's clumps scattered again: compose false)
    expect(readBiocube({ from: 'forest', flora: { trees: { compose: false } } }).flora.trees.compose).toBe(false);
  });
});

describe('a forest grown as its species (leaf-forms.js)', () => {
  const species = ['oak', 'willow'], M = { kind: 'stage', kit: 'isekai-meadow', trail: {}, biocube: { from: 'forest', flora: { trees: { species } } } };
  const site = outTrailSite(withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube('forest')), {}, 1);

  it('grows each clump one species on a gritty land: a template for each species and variant, its crown lobes and chips', () => {
    const P = assembleStageScene({ ...M, shading: { grit: 0.7 } }, {});
    expect(P.repeats.length).toBe(species.length * TREE_BANDS.stock);
    // (every stock tree stamped once, from a template of its own species)
    const trees = treeItems(withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube(M.biocube)), site, 1), d = (t) => site.trailDist(t.x, t.y) - site.halfWAt(t.y);
    expect(P.repeats.reduce((a, r) => a + r.transforms.length, 0)).toBe(trees.filter((t) => !t.hero && d(t) >= TREE_BANDS.hero && d(t) <= TREE_BANDS.far).length);
    expect(P.repeats.every((r) => r.template.some((f) => f.group === 'isekai:chips') && r.template.some((f) => f.group === 'isekai:core'))).toBe(true);
    // (a willow's lobes hang: some core long and upright in the level, as no ball is)
    const tall = (f) => Math.abs(f.normal[2]) < 0.2;
    expect(P.faces.filter((f) => f.group === 'isekai:core').some(tall)).toBe(true);
  }, 90000);

  it('a quiet land keeps the balls; it reads its species by name and refuses what is not one', () => {
    const quiet = { ...M, shading: true }, plain = { ...quiet, biocube: 'forest' };
    expect(JSON.stringify(assembleStageScene(quiet, {}))).toBe(JSON.stringify(assembleStageScene(plain, {})));
    expect(readBiocube(M.biocube).flora.trees.species).toEqual(species);
    expect(Object.values(LEAF_SPECIES).every((f) => LEAF_FORMS[f])).toBe(true);
    expect(readBiocube({ from: 'forest', flora: { trees: { species: ['plate', 'pine'] } } }).flora.trees.species).toEqual(['plate', 'pine']);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { species: ['baobab'] } } })).toThrow(/oak, beech, willow, pine, schefflera/);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { species: ['oak', 'oak'] } } })).toThrow(/none twice/);
    // (a cube carries the species it wants in its own biocube)
    expect(readGeocube({ from: 'limestone-crags', biocube: { from: 'forest', flora: { trees: { species: ['beech', 'pine'] } } } }).biocube.flora.trees.species).toEqual(['beech', 'pine']);
  }, 90000);
});
