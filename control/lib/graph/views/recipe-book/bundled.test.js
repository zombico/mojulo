// The recipe book bundled at control/book (3.1.0): every install carries it, an agent box included,
// with no clone and no env var. vitest.setup.js turns it off for the rest of the suite; these cases
// turn it back on. The validator gate is the one the standalone book repo ran over itself.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBookLoaded, _resetBookLoader } from './loader';
import { bookViewKinds, isBookRenderKind, bookWardrobe, bookCards } from './registry';
import { bookDirs, bundledBookDir } from './cards';
import { validateBook, formatReport } from '../../../../book/tools/validate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLED = join(HERE, '../../../../book');
const FIXTURE_BOOK = join(HERE, '__fixtures__/book');

const saved = {
  bundled: process.env.MOJULO_BUNDLED_BOOK,
  book: process.env.MOJULO_RECIPE_BOOK,
  cookbook: process.env.MOJULO_COOKBOOK,
};
const restore = (key, value) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };

beforeEach(() => {
  delete process.env.MOJULO_BUNDLED_BOOK;   // the shipped default: control/book
  delete process.env.MOJULO_RECIPE_BOOK;
  process.env.MOJULO_COOKBOOK = '/nonexistent-cookbook';
  _resetBookLoader();
});
afterEach(() => {
  restore('MOJULO_BUNDLED_BOOK', saved.bundled);
  restore('MOJULO_RECIPE_BOOK', saved.book);
  restore('MOJULO_COOKBOOK', saved.cookbook);
  _resetBookLoader();
});

describe('the bundled recipe book', () => {
  it('passes its own validator', async () => {
    const result = await validateBook(BUNDLED);
    expect(result.errors, `\n${formatReport(result, BUNDLED)}`).toHaveLength(0);
    expect(result.stats.entries).toBeGreaterThan(0);
  });

  it('attaches by default, with no env var', async () => {
    expect(bundledBookDir()).toBe(BUNDLED);
    expect(bookDirs()).toEqual([{ dir: BUNDLED, source: 'bundled' }]);
    const res = await ensureBookLoaded();
    expect(res.warnings).toEqual([]);
    expect(bookViewKinds().has('aurora')).toBe(true);
    expect(bookViewKinds().has('foucault-pendulum')).toBe(true);
    expect(isBookRenderKind(bookViewKinds().get('aurora').manifestKind)).toBe(true);
    expect(bookWardrobe().get('business-suit')?.source).toBe('bundled');
    expect(bookCards().some((c) => c.id === 'saturn-grand-tour' && c.source === 'bundled')).toBe(true);
  });

  it('MOJULO_BUNDLED_BOOK=off leaves it unattached', async () => {
    process.env.MOJULO_BUNDLED_BOOK = 'off';
    expect(bookDirs()).toEqual([]);
    const res = await ensureBookLoaded();
    expect(res.kinds).toBe(0);
  });

  it('an attached clone still loads, ahead of the bundled book, and warns it is deprecated', async () => {
    process.env.MOJULO_RECIPE_BOOK = FIXTURE_BOOK;
    expect(bookDirs().map((d) => d.source)).toEqual(['recipe-book', 'bundled']);
    const res = await ensureBookLoaded();
    expect(res.warnings.join(' ')).toMatch(/MOJULO_RECIPE_BOOK is deprecated/);
    // the fixture's own a-line-skirt wins over the bundled one of the same id
    expect(bookWardrobe().get('a-line-skirt')?.source).toBe('recipe-book');
    expect(bookViewKinds().has('aurora')).toBe(true);
  });

  it('a clone pointed at the bundled book itself is attached once', () => {
    process.env.MOJULO_RECIPE_BOOK = BUNDLED;
    expect(bookDirs()).toEqual([{ dir: BUNDLED, source: 'recipe-book' }]);
  });
});
