import { describe, it, expect } from 'vitest';
import { floraRead, speciesFor, FLORA_SPECIES, FLORA_DEFAULT, FLORA_STRIDE, FLORA_HIDES } from './flora-read.js';
import { LEAF_FORM_IDS } from '../era/leaf-forms.js';
import { formLandScript } from '../scene/channels/form-land.js';

const colours = { foliage: '#4a983a', grass: '#7cbf48', stone: '#e2cba0', floor: '#c4875a', accent: '#3a80d0' };
const bases = { foliage: [0.11, 0.33, 0.07], floor: [0.4, 0.2, 0.1] };
// (a conifer kind: grown by rule, quick; the broadleaves' grower is the slow path, read through speciesFor alone)
const needled = Object.keys(FLORA_SPECIES).find((f) => FLORA_SPECIES[f] === 'pine');
const tree = (x, y, h, kind, cluster = 0) => ({ x, y, z: 0, h, kind, cluster });
const plants = (over = {}) => ({ form: 'blob', kinds: [needled, { form: needled, leaf: 2 }], bushKinds: null, trees: [tree(0, 0, 9, 0), tree(10, 2, 11, 0), tree(4, 9, 10, 1)], bushes: [], shrubs: [], ...over });
const unpack = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };

describe('the form render\'s plants', () => {
  it('grows a species for every leaf form, and a level naming no kinds its clusters among the defaults', () => {
    for (const f of LEAF_FORM_IDS) expect(FLORA_SPECIES[f]).toBeTruthy();
    const seen = new Set(Array.from({ length: 24 }, (_, c) => speciesFor({ cluster: c }, null)));
    expect([...seen].sort()).toEqual([...FLORA_DEFAULT].sort());
    expect(speciesFor({ cluster: 3 }, { form: needled })).toBe('pine');
  });

  it('is a copy of one template a species, each plant where it stood, scaled to its height', () => {
    const F = floraRead(plants(), { kinds: plants().kinds, colours, bases }), P = unpack(F.trees);
    expect(F.templates.length).toBe(1);
    expect(F.n).toBe(3);
    expect(P.length).toBe(3 * FLORA_STRIDE);
    for (const [i, t] of plants().trees.entries()) {
      expect(P[i * FLORA_STRIDE]).toBeCloseTo(t.x, 4);
      expect(P[i * FLORA_STRIDE + 3] * F.templates[0].height).toBeCloseTo(t.h, 3);
    }
    expect(Object.keys(F.barks)).toEqual([F.templates[0].bark]);
    expect(JSON.stringify(floraRead(plants(), { kinds: plants().kinds, colours, bases }))).toBe(JSON.stringify(F));
  });

  it('colours a kind\'s crown by its pick from the theorist\'s offer, the rest the cube\'s foliage', () => {
    const F = floraRead(plants(), { kinds: plants().kinds, colours, bases }), P = unpack(F.trees), leaf = (i) => [5, 6, 7].map((k) => P[i * FLORA_STRIDE + k]);
    expect(leaf(0).map((v) => +v.toFixed(3))).toEqual(bases.foliage.map((v) => +v.toFixed(3)));
    expect(leaf(2)).not.toEqual(leaf(0));
  });

  it('keeps a bamboo or blossom card\'s own look, and reads nothing where nothing grows', () => {
    expect(floraRead(plants({ form: 'bamboo' }), { colours, bases })).toBeNull();
    expect(floraRead(plants({ form: 'blossom' }), { colours, bases })).toBeNull();
    expect(floraRead(plants({ trees: [] }), { colours, bases })).toBeNull();
    expect(FLORA_HIDES).toContain('flora:bush');
  });

  it('adds nothing to the land\'s page without plants, and grows them inside it with', () => {
    const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };
    expect(formLandScript(land)).toBe(formLandScript(land, null));
    const F = floraRead(plants(), { kinds: plants().kinds, colours, bases }), page = formLandScript(land, F);
    expect(page).toContain('the plants (gen-7');
    expect(page).toContain("if (R.key === 'crown' || R.key === 'wood') continue;");
    expect(formLandScript(land)).not.toContain('the plants (gen-7');
  });
});
