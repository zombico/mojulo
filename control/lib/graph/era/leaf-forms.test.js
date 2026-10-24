// Leaf forms (leaf-forms.js): a crown grown as leaf branches, each ending in a lobe shaped and turned by its form, cored
// and chipped as the painted crown is; the same seed the same tree.
import { describe, expect, it } from 'vitest';
import { LEAF_FORMS, LEAF_FORM_IDS, leafForm, formCore, formChips } from './leaf-forms.js';
import { hollowed } from './isekai.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

const h = 9, Rc = 3, c = [0, 0, 5.6], tree = { base: [0, 0, 0], h, c, Rc, seed: 7 }, crown = { c, Rc, squash: 0.82 }, ramp = ISEKAI_MEADOW.palette.foliage;
const toSun = [0.35, -0.8, 0.6].map((v, _, a) => v / Math.hypot(...a));
const flat = (L) => Math.min(...L.axes) / Math.max(...L.axes);

describe('a crown grown as leaf branches', () => {
  it('shapes each form\'s lobes as its leaves hang: a plate flat and level, a weep long and hanging, a whorl\'s spokes level', () => {
    const lobes = (f) => leafForm(f, tree).lobes;
    expect(lobes('plate').every((L) => flat(L) < 0.3 && Math.abs(L.frame[2][2]) > 0.95)).toBe(true);
    expect(lobes('weep').every((L) => L.long[2] < -0.9 && flat(L) < 0.3)).toBe(true);
    expect(lobes('whorl').filter((L) => flat(L) < 0.4).every((L) => Math.abs(L.long[2]) < 0.4)).toBe(true);
    // (every form reaches out of the trunk on limbs, its lobes round the crown, none of them a ball)
    for (const f of LEAF_FORM_IDS) {
      const T = leafForm(f, tree);
      expect(T.limbs.length).toBeGreaterThanOrEqual(LEAF_FORMS[f].limbs[0]);
      expect(T.lobes.every((L) => Math.hypot(L.at[0] - c[0], L.at[1] - c[1], L.at[2] - c[2]) < 2 * Rc)).toBe(true);
      expect(T.lobes.some((L) => flat(L) < 0.8)).toBe(true);
    }
    expect(() => leafForm('fern', tree)).toThrow(/spray, plate, weep, tuft, whorl/);
  });

  it('cores and chips its lobes: hollowed where they cross, no chip buried in another lobe, a far core coarser', () => {
    const T = leafForm('spray', tree), K = formCore(T.lobes, { crown, ramp, toSun });
    expect(K.faces.every((f) => f.group === 'isekai:core')).toBe(true);
    expect(hollowed(K.faces, K.lobes).length).toBeLessThan(K.faces.length);
    expect(formCore(T.lobes, { crown, ramp, detail: 0 }).faces.length * 4).toBe(K.faces.length);
    const chips = formChips(T.lobes, { crown, ramp, toSun, seed: 3, grain: LEAF_FORMS.spray.grain });
    expect(chips.length).toBeGreaterThan(T.lobes.length * 10);
    expect(new Set(chips.map((f) => f.fill)).size).toBeGreaterThanOrEqual(3);   // (low, mid and high stops)
    // (the same seed, the same tree)
    expect(JSON.stringify(formChips(leafForm('spray', tree).lobes, { crown, ramp, toSun, seed: 3, grain: 0.8 }))).toBe(JSON.stringify(chips));
  });

  it('grains a chip along its lobe: a weep\'s chips hang lengthwise', () => {
    const T = leafForm('weep', tree), long = (f) => { const [a, , b] = [f.corners[0], 0, f.corners[f.corners.length / 2]]; const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; return Math.abs(d[2]) / Math.hypot(...d); };
    const grained = formChips(T.lobes, { crown, ramp, toSun, seed: 3, grain: 0.9 }), loose = formChips(T.lobes, { crown, ramp, toSun, seed: 3, grain: 0 });
    const mean = (fs) => fs.reduce((a, f) => a + long(f), 0) / fs.length;
    expect(mean(grained)).toBeGreaterThan(mean(loose) + 0.15);
  });
});
