// create_figure inline garment specs (character-from-dream.plan.md C1 unlock):
// `garment` accepts wardrobe KEYS and INLINE piece specs (validated via
// validateGarmentSpec), mixed in one layering array — a dreamed wardrobe piece
// is authored as data and worn by any body. Same in-memory isolation as
// emote-figure.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';

import { createFigureHandler } from './figure';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { validateGarmentSpec } from '@/lib/graph/polygonizer/figure-garments';

const DREAM_PANTS = {
  id: 'dreamPants',
  color: { cloth: '#4d5442' },
  pieces: [
    { fit: 'pelvis', clearance: 0.17, basin: { uniform: true } },
    { coverage: ['legL'], fit: 'drape', anchor: 'hip', clearance: 0.32 },
    { coverage: ['legR'], fit: 'drape', anchor: 'hip', clearance: 0.32 },
  ],
  cuts: [{ kind: 'band', lo: 'waist', hi: 'top', on: 'pelvis' }],
};

describe('validateGarmentSpec', () => {
  it('accepts the wardrobe-piece shape', () => {
    expect(validateGarmentSpec(DREAM_PANTS)).toEqual([]);
  });

  it('refuses unknown fit and cut kinds, bad clearances, and missing pieces', () => {
    expect(validateGarmentSpec({ id: 'x', pieces: [{ fit: 'levitate' }] })[0]).toMatch(/fit/);
    expect(validateGarmentSpec({ id: 'x', pieces: [{ fit: 'hug', clearance: 9 }] })[0]).toMatch(/clearance/);
    expect(validateGarmentSpec({ id: 'x', pieces: [], cuts: [] })[0]).toMatch(/pieces/);
    expect(validateGarmentSpec({ id: 'x', pieces: [{ fit: 'hug' }], cuts: [{ kind: 'zigzag' }] })[0]).toMatch(/zigzag/);
    expect(validateGarmentSpec('tee')[0]).toMatch(/object/);
  });
});

describe('create_figure inline garments', () => {
  it('mints a figure layering wardrobe keys with an inline piece spec', async () => {
    const out = await createFigureHandler({
      title: 'Inline wardrobe subject',
      ref: 'inline-garment-subject',
      proto: { sex: 'female', stockiness: 1.2 },
      garment: ['tank', DREAM_PANTS, 'jacketCut'],
      animate: false,
    });
    expect(out.ok).toBe(true);
    const minted = SketchRepository.getByRef('inline-garment-subject');
    expect(minted.manifest.garment[1].id).toBe('dreamPants');
  });

  it('rejects an invalid inline spec with the validator message', async () => {
    await expect(createFigureHandler({
      title: 'Bad wardrobe',
      garment: [{ id: 'bad', pieces: [{ fit: 'levitate' }] }],
      animate: false,
    })).rejects.toThrow(/fit/);
  });

  it('still rejects unknown wardrobe keys', async () => {
    await expect(createFigureHandler({
      title: 'Bad key', garment: 'tuxedo', animate: false,
    })).rejects.toThrow(/inline spec object/);
  });
});
