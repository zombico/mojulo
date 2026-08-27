import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

// reindex-on-save embeds through the real model — mock it out (its own suite
// covers it); save_recipe only needs it callable.
vi.mock('@/lib/db/repositories/embeddings', () => ({ reindexAll: vi.fn(async () => ({})) }));

let tmp, saveRecipeHandler, deriveViewKind, deriveRecipeLane, SketchRepository,
  _resetBookLoader, _resetViewVocabCache, getViewVocabCatalog,
  _resetBeatsVocabCache, getBeatsVocabCatalog;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'mojulo-save-recipe-'));
  process.env.SQLITE_PATH = join(tmp, 'test.db');
  process.env.MOJULO_COOKBOOK = join(tmp, 'cookbook');
  delete process.env.MOJULO_RECIPE_BOOK;
  ({ saveRecipeHandler, deriveViewKind, deriveRecipeLane } = await import('@/lib/mcp/tools/save-recipe'));
  ({ SketchRepository } = await import('@/lib/db/repositories/sketches'));
  ({ _resetBookLoader } = await import('@/lib/graph/views/recipe-book/loader'));
  ({ _resetViewVocabCache, getViewVocabCatalog } = await import('@/lib/graph/views/view-vocab/loader'));
  ({ _resetBeatsVocabCache, getBeatsVocabCatalog } = await import('@/lib/graph/beats/beats-vocab/loader'));
});
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });
beforeEach(() => { _resetBookLoader(); _resetViewVocabCache(); _resetBeatsVocabCache(); });

describe('deriveViewKind', () => {
  it('maps <kind>-view manifests, bare-kind manifests, and rejects the rest', () => {
    expect(deriveViewKind('saturn-view')).toEqual({ kind: 'saturn', family: 'science' });
    expect(deriveViewKind('trig-circle-view')).toEqual({ kind: 'trig-circle', family: 'math' });
    expect(deriveViewKind('dna-process')).toEqual({ kind: 'dna-process', family: 'bio' });
    expect(deriveViewKind('fractal-city')).toBe(null);
    expect(deriveViewKind('nope-view')).toBe(null);
  });
});

describe('deriveRecipeLane', () => {
  it('routes view kinds to the view lane and beats kinds to the beats lane', () => {
    const view = deriveRecipeLane('saturn-view');
    expect(view).toMatchObject({ entry: 'create_view', kind: 'saturn', chapter: 'science', family: 'science', vocabKind: 'view_vocab', reader: 'get_view_vocab' });
    const beats = deriveRecipeLane('beats-ambient');
    expect(beats).toMatchObject({ entry: 'create_beats', kind: 'beats-ambient', chapter: 'beats', family: null, vocabKind: 'beats_vocab', reader: 'get_beats_vocab' });
    expect(deriveRecipeLane('fractal-city')).toBe(null);
  });
});

describe('save_recipe handler', () => {
  it('teaches on missing/invalid inputs', async () => {
    await expect(saveRecipeHandler({})).rejects.toThrow(/requires `ref`/);
    await expect(saveRecipeHandler({ ref: 'x', id: 'Bad_Id', when: 'w' })).rejects.toThrow(/kebab-case/);
    await expect(saveRecipeHandler({ ref: 'x', id: 'good-id' })).rejects.toThrow(/requires `when`.*conversation/s);
    await expect(saveRecipeHandler({ ref: 'nope', id: 'good-id', when: 'w' })).rejects.toThrow(/not found/);
  });

  it('refuses kinds outside the save lanes with the scope message', async () => {
    SketchRepository.create({ title: 'a city', manifest: { kind: 'fractal-city' }, ref: 'city-1' });
    await expect(saveRecipeHandler({ ref: 'city-1', id: 'my-city', when: 'w' }))
      .rejects.toThrow(/not a keepable recipe kind.*create_view and create_beats/s);
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

  it('saves a beats recipe through the beats lane: chapter, entry, catalog, recall', async () => {
    SketchRepository.create({
      title: 'Dusk loop',
      manifest: { kind: 'beats-ambient', seed: 7, mood: 'dusk', minutes: 2 },
      ref: 'loop-1',
    });
    const res = await saveRecipeHandler({
      ref: 'loop-1', id: 'dusk-loop', when: 'the slow dusk ambience for the reading room world',
      notes: 'Seed 7 keeps the low swell under the narration.',
    });
    expect(res.ok).toBe(true);
    expect(res.kind).toBe('beats-ambient');
    expect(res.chapter).toBe('beats');
    expect(res.recall.get_beats_vocab).toEqual({ id: 'dusk-loop' });
    expect(res.recall.semantic_search.kinds).toEqual(['beats_vocab']);

    const entryDir = join(process.env.MOJULO_COOKBOOK, 'chapters/beats/dusk-loop');
    const recipe = JSON.parse(readFileSync(join(entryDir, 'recipe.json'), 'utf8'));
    expect(recipe).toEqual({
      entry: 'create_beats', kind: 'beats-ambient',
      params: { seed: 7, mood: 'dusk', minutes: 2 },
      title: 'Dusk loop',
    });
    // the card omits `family` (beats cards carry none) and routes by entry
    const cardRaw = readFileSync(join(entryDir, 'card.md'), 'utf8');
    expect(cardRaw).not.toMatch(/"family"/);
    expect(cardRaw).toMatch(/"entry": "create_beats"/);

    // visible in the merged BEATS catalog immediately, not the view catalog
    const card = getBeatsVocabCatalog().get('dusk-loop');
    expect(card?.source).toBe('cookbook');
    expect(card.when).toMatch(/reading room/);
    expect(card.body).toMatch(/low swell under the narration/);
    expect(getViewVocabCatalog().has('dusk-loop')).toBe(false);
  });
});
