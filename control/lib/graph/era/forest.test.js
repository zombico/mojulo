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
import { floraColours, floraRamps, FLORA_OFFER } from './flora-colours.js';
import { deltaE, lchOf } from '../color-theorist/oklab.js';
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

describe('a forest grown as its tree kinds (leaf-forms.js, flora-colours.js)', () => {
  const kinds = ['weep', { form: 'plate', scale: 1.3, trunk: 0.6, leaf: 2, bark: 2 }], M = { kind: 'stage', kit: 'isekai-meadow', trail: {}, biocube: { from: 'forest', flora: { trees: { kinds } } } };
  const site = outTrailSite(withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube('forest')), {}, 1);

  it('grows each clump one kind on a gritty land: a template for each kind and variant, its crown lobes and chips', () => {
    const P = assembleStageScene({ ...M, shading: { grit: 0.7 } }, {});
    expect(P.repeats.length).toBe(kinds.length * TREE_BANDS.stock);
    // (every stock tree stamped once, from a template of its own kind)
    const trees = treeItems(withFlora(ISEKAI_STYLES['isekai-meadow'], readBiocube(M.biocube)), site, 1), d = (t) => site.trailDist(t.x, t.y) - site.halfWAt(t.y);
    expect(P.repeats.reduce((a, r) => a + r.transforms.length, 0)).toBe(trees.filter((t) => !t.hero && d(t) >= TREE_BANDS.hero && d(t) <= TREE_BANDS.far).length);
    expect(P.repeats.every((r) => r.template.some((f) => f.group === 'isekai:chips') && r.template.some((f) => f.group === 'isekai:core'))).toBe(true);
    // (the weep's lobes hang: some core long and upright, as no ball is; the plate's crown in the young leaf it picked)
    expect(P.faces.filter((f) => f.group === 'isekai:core').some((f) => Math.abs(f.normal[2]) < 0.2)).toBe(true);
    const young = floraRamps(ISEKAI_STYLES['isekai-meadow'].palette)['foliage-2'].map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''));
    const all = [...P.faces, ...P.repeats.flatMap((r) => r.template)];
    expect(all.some((f) => f.group === 'isekai:core' && young.includes(f.fill))).toBe(true);
    // (no face carries the lock's working key out)
    expect(all.some((f) => f._ramp !== undefined)).toBe(false);
  }, 90000);

  it('a quiet land keeps the balls; it reads its kinds and refuses what is not one', () => {
    const quiet = { ...M, shading: true }, plain = { ...quiet, biocube: 'forest' };
    expect(JSON.stringify(assembleStageScene(quiet, {}))).toBe(JSON.stringify(assembleStageScene(plain, {})));
    expect(readBiocube(M.biocube).flora.trees.kinds).toEqual(kinds);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { kinds: ['oak'] } } })).toThrow(/spray, plate, weep, tuft, whorl/);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { kinds: [{ form: 'weep', leaf: 7 }] } } })).toThrow(/leaf/);
    expect(() => readBiocube({ from: 'forest', flora: { trees: { kinds: [{ form: 'weep', colour: 'red' }] } } })).toThrow(/colour is not a setting/);
    // (a cube carries the kinds it wants in its own biocube)
    expect(readGeocube({ from: 'limestone-crags', biocube: { from: 'forest', flora: { trees: { kinds: ['plate', { form: 'tuft', bark: 3 }] } } } }).biocube.flora.trees.kinds).toHaveLength(2);
  }, 90000);
});

describe('the theorist\'s offer to the trees (flora-colours.js)', () => {
  it('offers foliage apart from the grass and each other, and barks from the world\'s soil and rock', () => {
    const pal = ISEKAI_STYLES['isekai-meadow'].palette, mid = (r) => r[Math.floor(r.length / 2)];
    const O = floraColours({ foliage: mid(pal.foliage), grass: mid(pal.grass), rock: mid(pal.rock), soil: mid(pal.soil) });
    expect(O.leaves).toHaveLength(FLORA_OFFER);
    expect(O.barks).toHaveLength(FLORA_OFFER);
    const all = [mid(pal.grass), mid(pal.foliage), ...O.leaves];
    for (let i = 2; i < all.length; i++) for (let j = 0; j < i; j++) expect(deltaE(all[i], all[j])).toBeGreaterThan(0.04);
    // (deep under the world's foliage, young over it; the pale bark lighter than the warm and the dark)
    const L = (c) => lchOf(c)[0];
    expect(L(O.leaves[0])).toBeLessThan(L(mid(pal.foliage)));
    expect(L(O.leaves[1])).toBeGreaterThan(L(mid(pal.foliage)));
    expect(L(O.barks[1])).toBeGreaterThan(Math.max(L(O.barks[0]), L(O.barks[2])));
    const R = floraRamps(pal);
    expect(Object.keys(R).sort()).toEqual(['bark-1', 'bark-2', 'bark-3', 'foliage-1', 'foliage-2', 'foliage-3']);
    expect(R['foliage-1']).toHaveLength(pal.foliage.length);
  });
});
