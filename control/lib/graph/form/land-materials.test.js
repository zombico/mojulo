import { describe, it, expect } from 'vitest';
import { MATERIAL_SETS, MATERIAL_LAYERS, readMaterials } from './land-materials.js';

// THE LAND'S MATERIALS (land-materials.js): the natural layers dressed as a works'. One case per concept: a set reads
// whole, a document changes a layer over its set, and what it does not know is refused, teaching.
describe('the land\'s materials', () => {
  it('reads a set whole, each layer its cut, its tile, its colour and how metal it is', () => {
    const id = Object.keys(MATERIAL_SETS)[0], M = readMaterials(id);
    for (const k of MATERIAL_LAYERS) expect(M[k]).toMatchObject({ cut: expect.any(String), metres: expect.any(Number), role: expect.any(String), metal: expect.any(Number) });
    expect(readMaterials(undefined)).toBeNull();
  });

  it('changes a layer over its set, and refuses what it does not know', () => {
    const id = Object.keys(MATERIAL_SETS)[0], M = readMaterials({ from: id, soil: { cut: 'epoxy' } });
    expect(M.soil.cut).toBe('epoxy');
    expect(M.soil.metres).toBe(MATERIAL_SETS[id].soil.metres);
    expect(() => readMaterials('glass')).toThrow(/not a set/);
    expect(() => readMaterials({ roof: {} })).toThrow(/not a layer/);
    expect(() => readMaterials({ rock: { cut: 'velvet' } })).toThrow(/cut is one of/);
    expect(() => readMaterials({ rock: { metal: 2 } })).toThrow(/metal is 0..1/);
  });
});
