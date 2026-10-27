import { describe, it, expect } from 'vitest';
import { readBookStyle, BOOK_STYLES, BOOK_FORMATS, PAPERS } from './book-style.js';
import { bookHtml, keyed, statBlock, rollTable, plate, esc } from './book-press.js';
import { FONT_SHELF, fontFaceCss } from '../image-outcomes/fonts/font-shelf.js';
import { PRESENTATION_THEMES } from '../../visual-language/themes.js';

const one = (style, body = keyed(1, 'The Porch', '<p>A broken arch.</p>')) => bookHtml({ title: 'A Book', style, chapters: [{ id: 'a', kind: 'title', body: '<h1>A Book</h1>' }, { id: 'b', title: 'Rooms', body }] });
const faceRules = (html) => [...html.matchAll(/@font-face\{font-family:'([^']+)';font-style:(\w+);font-weight:(\d+)/g)].map((m) => `${m[1]}/${m[2]}/${m[3]}`);

describe('book styles: a look, a format and faces, by key', () => {
  it('a preset resolves to its parts; a part named over a preset replaces only that part', () => {
    const tome = readBookStyle('tome');
    expect(tome).toMatchObject({ look: BOOK_STYLES.tome.look, format: 'manual', paper: 'letter', columns: 2, faces: BOOK_STYLES.tome.faces });
    expect(tome.colours.paper).toBe(PRESENTATION_THEMES[tome.look].chrome.panelBg);
    const a4 = readBookStyle({ style: 'tome', paper: 'a4', look: 'newsprint' });
    expect(a4).toMatchObject({ format: 'manual', paper: 'a4', look: 'newsprint', size: [...PAPERS.a4] });
    expect(readBookStyle({ style: 'zine', palette: { accent: '#0055AA' } }).colours.accent).toBe('#0055aa');
  });

  it('each format sets its page: a landscape one turns the paper', () => {
    for (const [id, F] of Object.entries(BOOK_FORMATS)) {
      const S = readBookStyle({ format: id });
      const [w, h] = PAPERS[F.paper];
      expect(S.size).toEqual(F.landscape ? [h, w] : [w, h]);
      expect(S.columns).toBe(F.columns);
    }
  });

  it('a dark look is advised against for print, never refused; what is not a style is refused, teaching', () => {
    expect(readBookStyle('screen').findings[0].text).toMatch(/screen look/);
    expect(readBookStyle('tome').findings).toEqual([]);
    expect(() => readBookStyle('glossy')).toThrow(/no style 'glossy' \(tome, zine/);
    expect(() => readBookStyle({ look: 'neon' })).toThrow(/no look 'neon'/);
    expect(() => readBookStyle({ format: 'scroll' })).toThrow(/no format 'scroll'/);
    expect(() => readBookStyle({ faces: { text: 'comic-sans' } })).toThrow(/no face 'comic-sans'/);
    expect(() => readBookStyle({ faces: { caption: 'inter' } })).toThrow(/not a face's role/);
    expect(() => readBookStyle({ palette: { ink: 'black' } })).toThrow(/hex colour/);
  });
});

describe('the press: one book, one self-contained page', () => {
  it('is pure, and sets its paper, columns and running foot by @page', () => {
    expect(one('tome')).toBe(one('tome'));
    const html = one('tome');
    expect(html).toMatch(/@page\{size:8\.5in 11in;margin:15mm 14mm 17mm/);
    expect(html).toMatch(/@bottom-center\{content:counter\(page\)/);
    expect(html).toMatch(/@top-center\{content:"A Book"/);
    expect(html).toMatch(/\.flow\{columns:2;/);
    expect(html).not.toMatch(/<script|https?:\/\/(?!www\.w3\.org)/);
  });

  it('inlines only the faces the style uses, and only the styles each role sets', () => {
    const tome = readBookStyle('tome'), html = one('tome');
    const text = FONT_SHELF[tome.faces.text].family, display = FONT_SHELF[tome.faces.display].family;
    expect(faceRules(html)).toEqual(expect.arrayContaining([`${text}/normal/400`, `${text}/italic/400`, `${text}/normal/700`, `${display}/normal/400`]));
    expect(faceRules(html)).not.toContain(`${display}/italic/400`);
    for (const k of Object.keys(FONT_SHELF)) if (!Object.values(tome.faces).includes(k)) expect(html).not.toContain(`font-family:'${FONT_SHELF[k].family}';`);
    // one face for every role: one face's bytes, once
    const dossier = one('dossier');
    expect(faceRules(dossier).filter((r) => r.endsWith('normal/400'))).toHaveLength(1);
    expect(dossier.length).toBeLessThan(html.length);
  });

  it('a face not vendored inlines nothing, and the stack falls back to the host', () => {
    const missing = Object.keys(FONT_SHELF).find((k) => fontFaceCss(k) === '');
    if (!missing) return;   // every face on the shelf is vendored
    const html = one({ faces: { display: missing } });
    expect(faceRules(html).some((r) => r.startsWith(FONT_SHELF[missing].family))).toBe(false);
    expect(html).toContain(`--display:'${FONT_SHELF[missing].family}',`);
  });

  it('the blocks: a keyed entry, a stat block and a roll table kept whole; text escaped', () => {
    const html = one('zine', keyed(3, 'The <Vestry>', '') + statBlock('Ghoul', [['HP', 13]]) + rollTable('1d6', [['1', 'Rats & worse']]) + plate('<svg></svg>', { caption: 'Map', span: true }));
    expect(html).toContain('<section class="key" id="key-3"><h3><span class="n">3</span> The &lt;Vestry&gt;</h3>');
    expect(html).toMatch(/\.key\{break-inside:avoid/);
    expect(html).toMatch(/\.stat\{break-inside:avoid/);
    expect(html).toContain('<td>Rats &amp; worse</td>');
    expect(html).toContain('<figure class="plate span"><svg></svg><figcaption>Map</figcaption></figure>');
    expect(esc('"a"')).toBe('&quot;a&quot;');
  });

  it('a one-page format flows every chapter on in one sheet\'s columns', () => {
    const html = one('pamphlet');
    expect(html).toContain('<main class="book one">');
    expect(html).toMatch(/\.book\.one\{columns:3;/);
    expect(one('tome')).toContain('<main class="book">');
  });

  it('refuses a book with no title or no chapters', () => {
    expect(() => bookHtml({ style: 'tome', chapters: [{ id: 'a', body: '' }] })).toThrow(/a book has a title/);
    expect(() => bookHtml({ title: 'x', style: 'tome', chapters: [] })).toThrow(/chapters/);
    expect(() => bookHtml({ title: 'x', style: 'tome', chapters: [{ id: 'a', kind: 'scroll', body: '' }] })).toThrow(/a title, a flow or pages/);
  });
});
