// The fall's leaf piles (leaf-piles.js): each tree's leaves heaped by the wind against its trunk, against the rock
// downwind and loose past its crown. Held on a flat land with a straight walk (the shape and its laws), then through the
// form render's packing and page (drawn in the tree's own leaves, and nothing of it on a page with none).
import { describe, expect, it } from 'vitest';
import { leafPiles, LEAF_PILES } from './leaf-piles.js';
import { formFloraScript } from '../scene/channels/form-flora.js';
import { leafPilesRead } from '../form/flora-read.js';

// a flat land, its walk the line x = 0 a metre either side; a tree at x = 8, a rock downwind of it (the wind east)
const SITE = { ground: () => 0, trailDist: (x) => Math.abs(x), halfWAt: () => 1 };
const TREE = { x: 8, y: 10, r: 0.25, crown: 2.5 }, ROCK = { x: 12, y: 10.3, r: 0.9, h: 1.2 };
const lay = (over = {}) => leafPiles(SITE, { autumn: 0.85, wind: 0, trees: [TREE], rocks: [ROCK], seed: 3, ...over });
const mid = (p) => { const cs = p.faces.flatMap((f) => f.corners); return [0, 1].map((k) => cs.reduce((a, c) => a + c[k], 0) / cs.length); };

describe('the fall\'s leaf piles', () => {
  it('bank against what stands in the wind on its windward side: the trunk\'s, the rock\'s downwind; a loose heap downwind past the crown', () => {
    const L = lay(), role = (r) => L.piles.find((p) => p.role === r);
    expect(mid(role('foot'))[0]).toBeLessThan(TREE.x);
    expect(mid(role('bank'))[0]).toBeLessThan(ROCK.x);
    expect(mid(role('bank'))[0]).toBeGreaterThan(TREE.x);
    // (turned with the wind: blowing north, the foot lies south of the trunk)
    expect(mid(lay({ wind: 90, rocks: [] }).piles.find((p) => p.role === 'foot'))[1]).toBeLessThan(TREE.y);
    // (in open ground: where the rock's bank lies, a heap blown there is that bank)
    const heaps = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => lay({ seed, rocks: [] }).piles.find((p) => p.role === 'heap')).filter(Boolean);
    expect(heaps.length).toBeGreaterThan(0);
    for (const h of heaps) expect(h.at[0]).toBeGreaterThan(TREE.x + TREE.crown);
  });

  it('is laid in sheets, the pile no steeper than dry leaves stand and a sheet\'s edge than matted ones, keeps off the walk and out of the rocks, and is read where it is seen', () => {
    const L = lay();
    expect(L.laws.filter((r) => !r.ok)).toEqual([]);
    for (const p of L.piles) {
      expect(Math.max(...p.faces.map((f) => (Math.acos(f.normal[2]) * 180) / Math.PI))).toBeLessThanOrEqual(LEAF_PILES.edge + 2);
      // (in sheets: more than one, and their creases marked)
      expect(p.sheets).toBeGreaterThan(1);
      expect(Math.max(...p.faces.flatMap((f) => f.crease))).toBeGreaterThan(0.5);
      expect(Math.min(...p.faces.flatMap((f) => f.corners).map((c) => Math.abs(c[0])))).toBeGreaterThan(1);
    }
    // (a tree by the walk with the wind blowing onto it: its foot pile would lie on the walk, so none is laid)
    expect(lay({ trees: [{ ...TREE, x: 1.6 }], rocks: [] }).piles.filter((p) => p.role === 'foot')).toEqual([]);
    // (a bank leans only on its own rock; a heap never on one)
    const B = L.piles.find((p) => p.role === 'bank');
    expect(B.H).toBeLessThanOrEqual(ROCK.h * LEAF_PILES.lean + 1e-9);
    expect(lay({ autumn: 0.05, read: { least: 0.6 } }).piles).toEqual([]);
  });

  it('rises the further into the fall, and is the same every time', () => {
    const H = (autumn) => lay({ autumn }).piles.find((p) => p.role === 'foot').H;
    expect(H(0.4)).toBeLessThan(H(1));
    expect(JSON.stringify(lay())).toBe(JSON.stringify(lay()));
  });
});

describe('the leaf piles on the page', () => {
  // two trees packed as the form's flora packs them (13 floats a tree): a maple that turns, a pine that keeps its needles
  const tree = (x, ti) => [x, 10, 0, 1, 0, 0.5, 0.2, 0.05, 1, 1, 1, ti, 0];
  const flora = { n: 2, templates: [{ kind: 'tree', name: 'maple', litter: 'lobed' }, { kind: 'tree', name: 'pine', litter: 'needle' }],
    trees: Buffer.from(Float32Array.from([...tree(8, 0), ...tree(20, 1)]).buffer).toString('base64'), autumn: 0.85 };
  const L = lay();
  const corners = (p) => p.faces.map((f) => f.corners.map((c, k) => [...c, f.crease[k]]));
  const piles = [...L.piles.map((p) => ({ tree: [8, 10], faces: corners(p) })), { tree: [20, 10], faces: corners(L.piles[0]) }];

  it('are packed beside the tree whose leaves they hold, a turning tree\'s alone, welded into one surface each', () => {
    const P = leafPilesRead(flora, piles);
    expect(P.n).toBe(L.piles.length);
    const V = new Float32Array(Buffer.from(P.verts, 'base64').buffer.slice(0));
    for (let v = 3; v < V.length; v += 5) expect(V[v]).toBe(0);
    // (welded: fewer corners than the faces carry)
    expect(V.length / 5).toBeLessThan(L.piles.reduce((a, p) => a + p.faces.reduce((b, f) => b + f.corners.length, 0), 0));
    expect(leafPilesRead(flora, [])).toBe(null);
  });

  it('are drawn only on a page whose fall laid them: a page without them carries none of their code', () => {
    const P = leafPilesRead(flora, piles);
    expect(formFloraScript({ ...flora, piles: P })).toContain('form-leaf-piles');
    // (and the page's code parses: a shader string's lines are escaped, not broken)
    expect(() => new Function(formFloraScript({ ...flora, piles: P }))).not.toThrow();
    expect(formFloraScript(flora)).not.toContain('form-leaf-piles');
  });
});

describe('the leaf piles on a stage', () => {
  it('are laid when the fall is asked and the form render reads it; none in summer, none on the painted land', async () => {
    const { assembleStageScene } = await import('./stage.js');
    const M = (autumn) => ({ kind: 'stage', trail: {}, seed: 3, geocube: { from: 'island-noon', biocube: { from: 'meadow', ...(autumn ? { flora: { autumn } } : {}) }, wind: { dir: 0 } } });
    const fall = assembleStageScene(M(0.85), { form: true });
    expect(fall._leafPiles.length).toBeGreaterThan(0);
    expect(fall.leafPiles).toMatchObject({ autumn: 0.85, piles: fall._leafPiles.length, laws: [] });
    expect(assembleStageScene(M(0), { form: true })._leafPiles).toBeUndefined();
    expect(assembleStageScene(M(0.85), {})._leafPiles).toBeUndefined();
  }, 120_000);
});
