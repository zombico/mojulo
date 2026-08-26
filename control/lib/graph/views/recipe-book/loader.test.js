import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBookLoaded, _resetBookLoader } from './loader';
import { bookViewKinds, bookWorldKind, isBookRenderKind, bookWarnings, bookLoaded, bookCards } from './registry';
import { readBookCards } from './cards';
import { parseCard, getViewVocabCatalog, _resetViewVocabCache } from '../view-vocab/loader';

const FIX = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const BOOK = join(FIX, 'book');
const FUTURE = join(FIX, 'book-future');

const savedEnv = process.env.MOJULO_RECIPE_BOOK;
beforeEach(() => {
  delete process.env.MOJULO_RECIPE_BOOK;
  _resetBookLoader();
  _resetViewVocabCache();
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.MOJULO_RECIPE_BOOK;
  else process.env.MOJULO_RECIPE_BOOK = savedEnv;
  _resetBookLoader();
  _resetViewVocabCache();
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
    await ensureBookLoaded({ dir: BOOK, cardParse: parseCard });
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
    await ensureBookLoaded({ dir: BOOK, cardParse: parseCard });
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
    await ensureBookLoaded({ dir: BOOK, cardParse: parseCard });
    const ids = bookCards().map((c) => c.id);
    expect(ids).toContain('test-orb');
    expect(ids).toContain('fixture-preset');
    expect(bookCards().every((c) => c.source === 'recipe-book')).toBe(true);
    expect(readBookCards({ parse: parseCard, dir: BOOK }).length).toBe(bookCards().length);
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
