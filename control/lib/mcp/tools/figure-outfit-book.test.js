// create_figure `outfit` with the recipe book attached (outfit.plan.md P4 + P5): a named outfit
// and its book garments resolve BY VALUE at mint, the stored recipe never depends on the book
// again, and a bare `garment` figure is untouched. Same in-memory isolation as figure.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_COOKBOOK = '/nonexistent-cookbook';

import { describe, it, expect, beforeAll } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFigureHandler } from './figure';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { ensureBookLoaded, _resetBookLoader } from '@/lib/graph/views/recipe-book/loader';
import { bookWardrobe } from '@/lib/graph/views/recipe-book/registry';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';

const BOOK = join(dirname(fileURLToPath(import.meta.url)), '../../graph/views/recipe-book/__fixtures__/book');

beforeAll(async () => { _resetBookLoader(); await ensureBookLoaded({ dir: BOOK }); });

describe('create_figure outfit (book attached)', () => {
  it('mints a named outfit: book names resolved by value with `from`, a pattern readout and the sheet URL, no `garment` key', async () => {
    const out = await createFigureHandler({ title: 'Outfit subject', ref: 'outfit-subject', proto: { sex: 'female' }, outfit: 'shift-and-trousers' });
    expect(out.ok).toBe(true);
    expect(out.patternSvgUrl).toBe('/api/sketches/outfit-subject/pattern.svg?inline=1');
    expect(out.pattern.map((g) => g.id)).toEqual(['straightTrousers', 'shiftDress']);
    const stored = SketchRepository.getByRef('outfit-subject').manifest;
    expect(stored.garment).toBeUndefined();
    expect(stored.outfit.from).toBe('book:shift-and-trousers');
    expect(stored.outfit.layers[0].from).toBe('book:straight-trousers');
    expect(stored.outfit.layers[0].garment.id).toBe('straightTrousers');
    expect(stored.outfit.layers[1].from).toBe('book:shift-dress');
    expect(stored.outfit.layers[1].dials).toEqual({ hem: 'hip' });
    expect(JSON.stringify(stored.outfit)).not.toMatch(/"shift-dress"|"straight-trousers"/);   // no bare book name survives
  });

  it('a minted outfit figure keeps rendering when the book changes (resolved by value)', async () => {
    const sketch = SketchRepository.getByRef('outfit-subject');
    const before = await renderStoredSketchSvg(sketch);
    const w = bookWardrobe();
    const saved = new Map(w);
    try {
      w.clear();
      expect(await renderStoredSketchSvg(SketchRepository.getByRef('outfit-subject'))).toBe(before);
    } finally { for (const [k, v] of saved) w.set(k, v); }
  });

  it('accepts { fit, layers } mixing core keys, book garments with dials, and inline specs', async () => {
    const out = await createFigureHandler({
      title: 'Mixed outfit', ref: 'outfit-mixed', proto: { sex: 'male' },
      outfit: { fit: 'relaxed', layers: ['tee', { garment: 'a-line-skirt', dials: { length: 'midi' }, cloth: '#112233' }] },
    });
    expect(out.ok).toBe(true);
    const stored = SketchRepository.getByRef('outfit-mixed').manifest;
    expect(stored.outfit.layers[0]).toBe('tee');
    expect(stored.outfit.layers[1].from).toBe('book:a-line-skirt');
    expect(out.pattern[0].id).toBe('aLineSkirt');
  });

  it('refuses outfit + garment together, an unknown outfit (listing the book), and dials on a shell', async () => {
    await expect(createFigureHandler({ title: 'x', outfit: 'shift-and-trousers', garment: 'tee' })).rejects.toThrow(/one or the other/);
    await expect(createFigureHandler({ title: 'x', outfit: 'gala' })).rejects.toThrow(/the book has: shift-and-trousers/);
    await expect(createFigureHandler({ title: 'x', outfit: { layers: [{ garment: 'tee', dials: { hem: 'hip' } }] } })).rejects.toThrow(/offset shell/);
    await expect(createFigureHandler({ title: 'x', outfit: { layers: ['toga'] } })).rejects.toThrow(/or a book garment \(/);
  });

  it('a plain `garment` figure is untouched by the outfit door', async () => {
    const out = await createFigureHandler({ title: 'Plain', ref: 'outfit-plain', garment: ['tee', 'trousers'] });
    expect(out.ok).toBe(true);
    expect(out.pattern).toBeUndefined();
    expect(out.patternSvgUrl).toBeUndefined();
    expect(SketchRepository.getByRef('outfit-plain').manifest.outfit).toBeUndefined();
  });
});
