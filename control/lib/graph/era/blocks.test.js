import { describe, it, expect } from 'vitest';
import { expr, readBlock, buildBlock, blockLaws, blockPaint, PRIMITIVES, PRIMITIVE_IDS, FINISH_IDS, TECH_GROUPS } from './blocks.js';
import { STARTER_BLOCKS as L } from './tech-blocks.js';
import { STRUCTURE_KITS } from './out-structures.js';
import { outBlocksHtml } from './out-blocks-html.js';

const one = (prim, params) => ({ id: 'one', read: 'one primitive', tier: 'part', mounts: ['ground'], parts: [{ id: 'p', prim, ...params }] });

describe('blocks: the vocabulary and expressions', () => {
  it('reads numbers over params, and refuses what is not an expression', () => {
    expect(expr('h * 0.5 + 1', { h: 4 })).toBe(3);
    expect(expr('round(2 + 4 * many)', { many: 0.5 })).toBe(4);
    expect(expr('-(a - b) / 2', { a: 1, b: 5 })).toBe(2);
    expect(expr('max(1, min(3, x))', { x: 9 })).toBe(3);
    expect(() => expr('h * 2', {})).toThrow(/not a param/);
    expect(() => expr('process.exit(1)', {})).toThrow(/not an expression/);
    expect(() => expr('(1 + 2', {})).toThrow(/missing/);
  });

  it('refuses a block that is not one, naming what is wrong', () => {
    const ok = one('box', { size: [1, 1, 1] });
    expect(readBlock(ok)).toBe(ok);
    expect(() => readBlock({ ...ok, colour: 'red' })).toThrow(/'colour' is not a block setting/);
    expect(() => readBlock({ ...ok, tier: 'gadget' })).toThrow(/tier is/);
    expect(() => readBlock(one('blob', {}))).toThrow(/not a primitive/);
    expect(() => readBlock({ ...ok, parts: [{ id: 'p', prim: 'box', size: [1, 1, 1], role: 'vibes' }] })).toThrow(/not a role/);
    expect(() => readBlock({ ...ok, parts: [{ id: 'p', block: 'nowhere' }] })).toThrow(/not in the library/);
    expect(() => readBlock({ ...ok, sig: ['q'] })).toThrow(/sig names 'q'/);
    expect(() => readBlock({ ...ok, tier: 'automation' })).toThrow(/names its cycle/);
    expect(() => buildBlock(one('box', { size: [1, 1, 99] }))).toThrow(/outside the box's rail/);
    expect(() => buildBlock({ ...ok, params: { h: [1, 2] } }, { params: { h: 5 } })).toThrow(/outside its rail/);
  });
});

describe('blocks: built at a ring', () => {
  it('every primitive builds closed-looking faces with a least span', () => {
    const demo = { box: { size: [1, 2, 3] }, drum: { r: 0.5, h: 1 }, tube: { r: 0.1, from: [0, 0, 0], to: [0, 0, 2] }, cone: { r: 1, h: 2 }, dish: { r: 1, depth: 0.3 }, truss: { from: [0, 0, 0], to: [0, 0, 3], w: 0.8, member: 0.2 },
      panel: { size: [2, 1] }, wheel: { r: 0.5, w: 0.3 }, track: { len: 2, r: 0.3, w: 0.6 }, arm: { segs: [1, 1], bend: [10, 40], r: 0.2 }, fin: { l: 1, h: 1 }, lamp: { r: 0.2 }, ring: { r: 1, tube: 0.1 } };
    expect(Object.keys(demo).sort()).toEqual([...PRIMITIVE_IDS].sort());
    for (const id of PRIMITIVE_IDS) {
      const b = buildBlock(one(id, demo[id]), { ring: 'near' });
      expect(b.faces.length, id).toBeGreaterThan(3);
      expect(b.faces.every((f) => f.corners.length >= 3 && Math.abs(Math.hypot(...f.normal) - 1) < 1e-2), id).toBe(true);
      expect(b.parts[0].least, id).toBeCloseTo(PRIMITIVES[id].least(demo[id]), 3);
    }
  });

  it('what is under the eye spot goes to the tile and is not counted; a lost signature is said', () => {
    const near = buildBlock(L['comms-mast'], { seed: 2, library: L, ring: 'near' }), far = buildBlock(L['comms-mast'], { seed: 2, library: L, ring: 'far' });
    expect(far.counted).toBeLessThan(near.counted);
    expect(far.faces.filter((f) => f.tile).length).toBeGreaterThan(0);
    expect(far.parts.find((p) => p.id === 'mast').shown).toBe('tile');
    const law = blockLaws(L['comms-mast'], far).find((l) => l.law === 'reads-at-ring');
    expect(law.ok).toBe(false);
    expect(law.value).toMatch(/mast/);
  });

  it('every starter block holds its laws at its ring, from little to many, over seeds; the same seed builds the same block', () => {
    for (const B of Object.values(L)) for (const seed of [1, 4, 9]) for (const many of [0, 0.5, 1]) {
      const b = buildBlock(B, { seed, library: L, many });
      expect(blockLaws(B, b).filter((l) => !l.ok), `${B.id} ${seed} ${many}`).toEqual([]);
    }
    expect(JSON.stringify(buildBlock(L.hauler, { seed: 5, library: L }))).toBe(JSON.stringify(buildBlock(L.hauler, { seed: 5, library: L })));
    // the dial counts: more wings at many
    const n = (m) => buildBlock(L['solar-array'], { seed: 1, library: L, many: m }).parts.find((p) => p.id === 'wings').n;
    expect(n(1)).toBeGreaterThan(n(0));
  });

  it('the laws advise: two status lights, a function with nothing to show it', () => {
    const B = { id: 'loud', read: 'two lights', tier: 'tool', functions: ['move'], mounts: ['ground'], parts: [{ id: 'a', prim: 'lamp', r: 0.2, group: 'str:accent' }, { id: 'b', prim: 'lamp', r: 0.2, at: [1, 0, 0], group: 'str:accent' }] };
    const laws = blockLaws(B, buildBlock(B));
    expect(laws.find((l) => l.law === 'one-status').ok).toBe(false);
    expect(laws.find((l) => l.law === 'functions-read').value).toMatch(/move/);
  });
});

describe('blocks: paint and the sheet', () => {
  it('a finish points every technology group at one of the kit\'s ramps, in every kit', () => {
    for (const k of STRUCTURE_KITS) for (const f of FINISH_IDS) { const P = blockPaint(k, f); for (const g of Object.keys(TECH_GROUPS)) expect(P.ramps[g], `${k} ${f} ${g}`).toBeTruthy(); }
    expect(() => blockPaint('isekai-meadow', 'gold-leaf')).toThrow(/not a finish/);
  });

  it('the block index is the same page every time and shows every block', () => {
    const a = outBlocksHtml({ seed: 1 });
    expect(a).toBe(outBlocksHtml({ seed: 1 }));
    for (const id of Object.keys(L)) expect(a).toContain(`id="block-${id}"`);
    expect(a).toContain('CYCLE');
  }, 30000);
});
