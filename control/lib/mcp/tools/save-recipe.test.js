import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

// reindex-on-save embeds through the real model — mock it out (its own suite
// covers it); save_recipe only needs it callable.
vi.mock('@/lib/db/repositories/embeddings', () => ({ reindexAll: vi.fn(async () => ({})) }));

let tmp, saveRecipeHandler, deriveViewKind, SketchRepository, _resetBookLoader, _resetViewVocabCache, getViewVocabCatalog;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'mojulo-save-recipe-'));
  process.env.SQLITE_PATH = join(tmp, 'test.db');
  process.env.MOJULO_COOKBOOK = join(tmp, 'cookbook');
  delete process.env.MOJULO_RECIPE_BOOK;
  ({ saveRecipeHandler, deriveViewKind } = await import('@/lib/mcp/tools/save-recipe'));
  ({ SketchRepository } = await import('@/lib/db/repositories/sketches'));
  ({ _resetBookLoader } = await import('@/lib/graph/views/recipe-book/loader'));
  ({ _resetViewVocabCache, getViewVocabCatalog } = await import('@/lib/graph/views/view-vocab/loader'));
});
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });
beforeEach(() => { _resetBookLoader(); _resetViewVocabCache(); });

describe('deriveViewKind', () => {
  it('maps <kind>-view manifests, bare-kind manifests, and rejects the rest', () => {
    expect(deriveViewKind('saturn-view')).toEqual({ kind: 'saturn', family: 'science' });
    expect(deriveViewKind('trig-circle-view')).toEqual({ kind: 'trig-circle', family: 'math' });
    expect(deriveViewKind('dna-process')).toEqual({ kind: 'dna-process', family: 'bio' });
    expect(deriveViewKind('fractal-city')).toBe(null);
    expect(deriveViewKind('nope-view')).toBe(null);
  });
});

describe('save_recipe handler', () => {
  it('teaches on missing/invalid inputs', async () => {
    await expect(saveRecipeHandler({})).rejects.toThrow(/requires `ref`/);
    await expect(saveRecipeHandler({ ref: 'x', id: 'Bad_Id', when: 'w' })).rejects.toThrow(/kebab-case/);
    await expect(saveRecipeHandler({ ref: 'x', id: 'good-id' })).rejects.toThrow(/requires `when`.*conversation/s);
    await expect(saveRecipeHandler({ ref: 'nope', id: 'good-id', when: 'w' })).rejects.toThrow(/not found/);
  });

  it('refuses non-view kinds with the v1-scope message', async () => {
    SketchRepository.create({ title: 'a city', manifest: { kind: 'fractal-city' }, ref: 'city-1' });
    await expect(saveRecipeHandler({ ref: 'city-1', id: 'my-city', when: 'w' }))
      .rejects.toThrow(/not a create_view kind.*v1/s);
  });

  it('refuses catalog id collisions', async () => {
    SketchRepository.create({ title: 's', manifest: { kind: 'saturn-view', scenario: 'classic' }, ref: 'sat-1' });
    await expect(saveRecipeHandler({ ref: 'sat-1', id: 'saturn', when: 'w' }))
      .rejects.toThrow(/already exists in the catalog/);
  });

  it('saves: files + manifest + catalog visibility + recall pointers', async () => {
    SketchRepository.create({
      title: 'Tilted rings',
      manifest: { kind: 'saturn-view', scenario: 'classic', inclination: 12 },
      ref: 'sat-2',
    });
    const res = await saveRecipeHandler({
      ref: 'sat-2', id: 'tilted-rings', when: 'the tilted saturn I use for my tuesday class',
      notes: 'Inclination 12 reads best on the projector.',
    });
    expect(res.ok).toBe(true);
    expect(res.kind).toBe('saturn');
    expect(res.chapter).toBe('science');
    expect(res.recall.get_view_vocab).toEqual({ id: 'tilted-rings' });

    const entryDir = join(process.env.MOJULO_COOKBOOK, 'chapters/science/tilted-rings');
    expect(existsSync(join(entryDir, 'card.md'))).toBe(true);
    const recipe = JSON.parse(readFileSync(join(entryDir, 'recipe.json'), 'utf8'));
    expect(recipe).toEqual({
      entry: 'create_view', kind: 'saturn',
      params: { scenario: 'classic', inclination: 12 },
      title: 'Tilted rings',
    });

    // visible in the merged catalog immediately (reindex is mocked; the
    // catalog path is the live one)
    const card = getViewVocabCatalog().get('tilted-rings');
    expect(card?.source).toBe('cookbook');
    expect(card.when).toMatch(/tuesday class/);
    expect(card.body).toMatch(/Inclination 12 reads best/);
    // a second save under the same id now collides via the catalog
    await expect(saveRecipeHandler({ ref: 'sat-2', id: 'tilted-rings', when: 'w' }))
      .rejects.toThrow(/already exists/);
  });
});
