import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ensureBookLoaded, _resetBookLoader } from './loader';
import { bookViewKinds, bookWorldKind, isBookRenderKind, bookWarnings, bookLoaded, bookCards } from './registry';
import { readBookCards, bookDirs } from './cards';
import { ensureCookbook, saveRecipeEntry } from './cookbook';
import { getViewVocabCatalog, _resetViewVocabCache } from '../view-vocab/loader';
import { getSolidVocabCatalog, _resetSolidVocabCache } from '../../solid-vocab/loader';
import { getMotionVocabCatalog, _resetMotionVocabCache } from '../../motion-vocab/loader';
import { getBeatsVocabCatalog, _resetBeatsVocabCache } from '../../beats/beats-vocab/loader';

const FIX = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const BOOK = join(FIX, 'book');
const FUTURE = join(FIX, 'book-future');

function resetCaches() {
  _resetBookLoader();
  _resetViewVocabCache();
  _resetSolidVocabCache();
  _resetMotionVocabCache();
  _resetBeatsVocabCache();
}

const savedEnv = { book: process.env.MOJULO_RECIPE_BOOK, cookbook: process.env.MOJULO_COOKBOOK };
beforeEach(() => {
  delete process.env.MOJULO_RECIPE_BOOK;
  // Isolate from any REAL cookbook beside the repo-dev data dir.
  process.env.MOJULO_COOKBOOK = '/nonexistent-cookbook';
  resetCaches();
});
afterEach(() => {
  if (savedEnv.book === undefined) delete process.env.MOJULO_RECIPE_BOOK;
  else process.env.MOJULO_RECIPE_BOOK = savedEnv.book;
  if (savedEnv.cookbook === undefined) delete process.env.MOJULO_COOKBOOK;
  else process.env.MOJULO_COOKBOOK = savedEnv.cookbook;
  resetCaches();
});

describe('recipe-book loader', () => {
  it('no book attached → empty loaded snapshot, no warnings, today\'s behavior', async () => {
    const res = await ensureBookLoaded();
    expect(res.kinds).toBe(0);
    expect(bookLoaded()).toBe(true);
    expect(bookViewKinds().size).toBe(0);
    expect(isBookRenderKind('anything-view')).toBe(false);
  });

  it('missing dir → warned, empty snapshot', async () => {
    const res = await ensureBookLoaded({ dir: '/nonexistent-recipe-book' });
    expect(res.kinds).toBe(0);
    expect(res.warnings.join(' ')).toMatch(/no manifest\.json/);
  });

  it('loads a Door-2 builder: kind registered, world row resolves, render kind set', async () => {
    await ensureBookLoaded({ dir: BOOK });
    const bk = bookViewKinds().get('test-orb');
    expect(bk).toBeTruthy();
    expect(bk.manifestKind).toBe('test-orb-view');
    expect(bk.family).toBe('science');
    expect(typeof bk.plan).toBe('function');

    const row = bookWorldKind('test-orb-view');
    expect(row).toBeTruthy();
    const payload = row.resolve({ kind: 'test-orb-view' }, { title: 'T' });
    expect(payload.title).toBe('T');
    expect(payload.faces.length).toBe(1);
    expect(isBookRenderKind('test-orb-view')).toBe(true);
  });

  it('a manifestKind colliding with a core world kind is skipped — core wins', async () => {
    await ensureBookLoaded({ dir: BOOK });
    expect(bookViewKinds().has('collide')).toBe(false);
    expect(bookWarnings().join(' ')).toMatch(/saturn-view.*core wins/);
    // the core saturn-view row is untouched (loader never mutates WORLD_KINDS)
    expect(bookWorldKind('saturn-view')).toBe(null);
  });

  it('a book requiring a future mojulo loads NOTHING and says the clone is ahead', async () => {
    const res = await ensureBookLoaded({ dir: FUTURE });
    expect(res.kinds).toBe(0);
    expect(res.warnings.join(' ')).toMatch(/clone is ahead/);
  });

  it('cards ride the snapshot and the sync reader', async () => {
    await ensureBookLoaded({ dir: BOOK });
    const ids = bookCards().map((c) => c.id);
    expect(ids).toContain('test-orb');
    expect(ids).toContain('fixture-preset');
    expect(bookCards().every((c) => c.source === 'recipe-book')).toBe(true);
  });
});

describe('view-vocab catalog merge', () => {
  it('book cards join the catalog; id collisions keep the CORE card', () => {
    process.env.MOJULO_RECIPE_BOOK = BOOK;
    const catalog = getViewVocabCatalog();
    // book-only card merged in
    expect(catalog.get('test-orb')?.source).toBe('recipe-book');
    expect(catalog.get('fixture-preset')?.entryType).toBe('recipe');
    // the fixture's 'saturn' card must NOT shadow the core card
    const saturn = catalog.get('saturn');
    expect(saturn).toBeTruthy();
    expect(saturn.source).toBeUndefined();
    expect(saturn.body).not.toMatch(/core wins/i);
  });

  it('absent a book the catalog is exactly the core set', () => {
    const withBook = (() => {
      process.env.MOJULO_RECIPE_BOOK = BOOK;
      const c = getViewVocabCatalog().size;
      _resetBookLoader(); _resetViewVocabCache();
      return c;
    })();
    delete process.env.MOJULO_RECIPE_BOOK;
    const core = getViewVocabCatalog();
    expect(core.has('test-orb')).toBe(false);
    expect(withBook).toBeGreaterThan(core.size);
  });
});

describe('multi-family card routing (Phase 4)', () => {
  it('beats / solid / motion book cards route to their own catalogs by `entry`', () => {
    process.env.MOJULO_RECIPE_BOOK = BOOK;
    const beats = getBeatsVocabCatalog();
    expect(beats.get('fixture-loop')?.source).toBe('recipe-book');
    expect(beats.get('fixture-loop')?.body).toMatch(/ambient-loop preset fixture/);
    const solids = getSolidVocabCatalog();
    expect(solids.get('fixture-gem')?.source).toBe('recipe-book');
    expect(solids.get('fixture-gem')?.family).toBe('object');
    const motion = getMotionVocabCatalog();
    expect(motion.get('fixture-spin')?.source).toBe('recipe-book');
    // family omitted on the card → defaulted
    expect(motion.get('fixture-spin')?.family).toBe('motion');
    // ...and none of them leak into the view catalog
    const views = getViewVocabCatalog();
    expect(views.has('fixture-loop')).toBe(false);
    expect(views.has('fixture-gem')).toBe(false);
    expect(views.has('fixture-spin')).toBe(false);
  });

  it('id collisions with a core card keep the CORE card, per family', () => {
    process.env.MOJULO_RECIPE_BOOK = BOOK;
    const ambient = getBeatsVocabCatalog().get('beats-ambient');
    expect(ambient).toBeTruthy();
    expect(ambient.source).toBeUndefined();
    expect(ambient.body).not.toMatch(/core wins/i);
  });

  it('dedupe is scoped per catalog: a view card and a beats card may share an id', () => {
    process.env.MOJULO_RECIPE_BOOK = BOOK;
    const viewTwin = getViewVocabCatalog().get('fixture-preset');
    const beatsTwin = getBeatsVocabCatalog().get('fixture-preset');
    expect(viewTwin?.entry).toBe('create_view');
    expect(beatsTwin?.entry).toBe('create_beats');
    expect(beatsTwin?.body).toMatch(/beats twin/);
  });

  it('an unroutable `entry` reaches no catalog; a non-solid family is skipped by the solid merge', () => {
    process.env.MOJULO_RECIPE_BOOK = BOOK;
    expect(readBookCards().some((c) => c.id === 'fixture-unroutable')).toBe(false);
    expect(getViewVocabCatalog().has('fixture-unroutable')).toBe(false);
    expect(getSolidVocabCatalog().has('fixture-bad-family')).toBe(false);
  });

  it('absent a book the beats / solid / motion catalogs are exactly the core sets', () => {
    expect(getBeatsVocabCatalog().has('fixture-loop')).toBe(false);
    expect(getSolidVocabCatalog().has('fixture-gem')).toBe(false);
    expect(getMotionVocabCatalog().has('fixture-spin')).toBe(false);
  });

  it('builder lane guard: a builder declaring a non-view entry tool is skipped with a warning', async () => {
    const res = await ensureBookLoaded({ dir: BOOK });
    expect(res.warnings.join(' ')).toMatch(/beats-builder.*no Door-2 lane/);
    expect(bookViewKinds().has('beats-builder')).toBe(false);
  });
});

describe('cookbook (Phase 5)', () => {
  let tmp;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'mojulo-cookbook-')); process.env.MOJULO_COOKBOOK = tmp; });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('ensureCookbook is idempotent and writes the manifest skeleton', () => {
    const first = ensureCookbook();
    expect(first.created).toBe(true);
    const again = ensureCookbook();
    expect(again.created).toBe(false);
    const manifest = JSON.parse(readFileSync(join(tmp, 'manifest.json'), 'utf8'));
    expect(manifest.book).toBe('cookbook');
    expect(manifest.entries).toEqual([]);
    expect(manifest.requiresMojulo).toMatch(/^>=\d+\.\d+\.\d+$/);
  });

  it('saveRecipeEntry writes card + recipe + manifest row and appears in the ordered dirs', () => {
    saveRecipeEntry({
      id: 'my-preset', chapter: 'science',
      cardText: '---\n{"id":"my-preset","name":"Mine","family":"science","entry":"create_view","summary":"s","when":"w"}\n---\n\nBody.\n',
      recipe: { entry: 'create_view', kind: 'saturn', params: {} },
    });
    const manifest = JSON.parse(readFileSync(join(tmp, 'manifest.json'), 'utf8'));
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.chapters).toContain('science');
    expect(JSON.parse(readFileSync(join(tmp, 'chapters/science/my-preset/recipe.json'), 'utf8')).kind).toBe('saturn');
    expect(bookDirs()[0]).toEqual({ dir: tmp, source: 'cookbook' });
    // duplicate id refuses
    expect(() => saveRecipeEntry({ id: 'my-preset', chapter: 'science', cardText: 'x', recipe: {} }))
      .toThrow(/already has an entry/);
  });

  it('cookbook cards take precedence over the upstream book on id collision', () => {
    process.env.MOJULO_RECIPE_BOOK = BOOK;
    ensureCookbook();
    // same id as an upstream fixture card
    saveRecipeEntry({
      id: 'fixture-preset', chapter: 'science',
      cardText: '---\n{"id":"fixture-preset","name":"Cook version","family":"science","entry":"create_view","summary":"s","when":"w"}\n---\n\nCOOKBOOK BODY.\n',
      recipe: { entry: 'create_view', kind: 'saturn', params: {} },
    });
    const cards = readBookCards({ entries: ['create_view'] });
    const hit = cards.find((c) => c.id === 'fixture-preset');
    expect(hit.source).toBe('cookbook');
    expect(hit.body).toMatch(/COOKBOOK BODY/);
  });

  it('Door-1-only guard: a builder entry in the cookbook is skipped with a warning', async () => {
    ensureCookbook();
    const manifestPath = join(tmp, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.entries.push({ type: 'builder', chapter: 'science', dir: 'evil', id: 'evil' });
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const res = await ensureBookLoaded();
    expect(res.warnings.join(' ')).toMatch(/cookbook entry 'evil' is a builder.*Door-1 only/);
    expect(bookViewKinds().has('evil')).toBe(false);
  });
});
