// The printer in a real browser (an e2e suite: skipped when no browser is installed): a game book printed to PDF has
// the pages its style sets, a one-sheet format prints one page, and the vendored faces travel embedded in the file.
// MOJULO_SHOTS=<dir> keeps the PDFs.
import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { printPdf } from './book-pdf.js';
import { resolveChromium } from '../scene/chromium.js';
import { tableRpgBook } from '../table-rpg/table-rpg-book.js';
import { readModule } from '../table-rpg/table-rpg-module.js';
import { SUNKEN_CHAPEL } from '../table-rpg/fixtures/sunken-chapel.js';
import { BOOK_STYLES, BOOK_FORMATS } from './book-style.js';
import { FONT_SHELF } from '../image-outcomes/fonts/font-shelf.js';

const SHOTS = process.env.MOJULO_SHOTS || null;
let browser = false;
beforeAll(async () => { try { await resolveChromium({ allowFetch: false }); browser = true; } catch { browser = false; } }, 60000);

const pages = (pdf) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe('the printer: a game book as a PDF', () => {
  it('a book prints its pages; a one-sheet format prints one; the faces are embedded', async () => {
    if (!browser) return;
    const { K } = readModule(SUNKEN_CHAPEL);
    const onePage = Object.keys(BOOK_STYLES).find((s) => BOOK_FORMATS[BOOK_STYLES[s].format].onePage);
    for (const style of ['tome', onePage]) {
      const pdf = await printPdf(tableRpgBook(K, { style }).html, { allowFetch: false });
      if (SHOTS) writeFileSync(join(SHOTS, `book-${style}.pdf`), pdf);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      if (style === onePage) expect(pages(pdf)).toBe(1);
      else expect(pages(pdf)).toBeGreaterThan(K.party.length + 3);
      const text = FONT_SHELF[BOOK_STYLES[style].faces.text].family.replace(/\s+/g, '');
      expect(pdf.toString('latin1')).toMatch(new RegExp(`/BaseFont\\s*/[A-Z]{6}\\+${text}`));
    }
  }, 120000);
});
