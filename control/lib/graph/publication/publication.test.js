import { describe, it, expect } from 'vitest';
import { readPublication, compilePublication, publicationBook, PUBLICATION_KINDS, PUBLICATION_KIND_IDS, BLOCKS, PANEL_LAYOUTS, styleOf } from './publication.js';
import { publicationCover, readCover, COVER_GROUNDS } from './cover.js';
import { readerHtml, READER_KEYS } from './reader.js';
import { PROPS, PROP_IDS, propForm, stillLife } from './props.js';
import { bestiaryOf, grimoireOf, ELEMENT_PROPS, DOES_PROPS } from './from-lore.js';
import { PUBLICATION_EXAMPLES } from './examples.js';
import { readPlate } from '../book/drawn-plate.js';
import { readBookStyle } from '../book/book-style.js';
import { newManual, intensifyManual } from '../lorecube/manual.js';
import { newTree, intensifyTree, DOES_IDS } from '../lorecube/tree.js';

// the smallest plate: one ball, a small picture plane
const BALL = { width: 160, height: 120, station: { distance: 2, look: [0, 0, 0.2] }, forms: [{ terms: [{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0.2], radius: 0.2 } }] }] };
const FIGURE = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
const BOOK = {
  kind: 'grimoire', title: 'The Small Book', subtitle: 'of <one> thing', by: 'a hand',
  chapters: [
    { id: 'first', title: 'First', blocks: [
      { p: 'It begins & goes on.', drop: true }, { h: 'A part' }, { note: 'Mind this.', label: 'Note' }, { margin: 'An aside.' },
      { facts: [['Weight', '3']] }, { stat: { name: 'A Thing', pairs: [['Life', 4]], note: 'small' } }, { table: { rows: [['1', 'one'], ['2', 'two']], head: 'd2', title: 'A table' } },
      { plate: BALL, caption: 'A ball.' }, { figure: FIGURE, caption: 'A ring.' }, { lines: 2 },
    ] },
    { title: 'Second', blocks: [{ entry: { n: 1, title: 'An entry', blocks: [{ p: 'Inside it.' }] } }] },
  ],
};
const compiled = compilePublication(BOOK, { res: 1 });

describe('a publication is a recipe of data', () => {
  it('is read as written, and refuses what is not one by naming what it takes', () => {
    expect(readPublication(BOOK)).toBe(BOOK);
    const bad = (over, re) => expect(() => readPublication({ ...BOOK, ...over })).toThrow(re);
    bad({ kind: 'novel' }, /kind is one of grimoire, bestiary, manual, notebook, comic/);
    bad({ reads: 'up' }, /reads is 'ltr' or 'rtl'/);
    bad({ title: '' }, /title is the book's name/);
    bad({ pages: 3 }, /pages is not part of a publication/);
    bad({ style: 'gold-leaf' }, /style: book style/);
    bad({ chapters: [] }, /chapters is a non-empty list/);
    bad({ chapters: [{ blocks: [{ poem: 'x' }] }] }, /names no block \(h, p, note/);
    bad({ chapters: [{ blocks: [{ p: 'x', span: true }] }] }, /span is not part of a p block/);
    bad({ chapters: [{ blocks: [{ plate: { forms: [] } }] }] }, /chapters\[0\]\.blocks\[0\]\.plate: forms is a non-empty list/);
    bad({ chapters: [{ blocks: [{ entry: { n: 1, title: 'a', blocks: [{ entry: { n: 2, title: 'b', blocks: [{ p: 'x' }] } }] } }] }] }, /not inside another entry/);
    bad({ chapters: [{ id: 'a', blocks: [{ p: 'x' }] }, { id: 'a', blocks: [{ p: 'x' }] }] }, /appears twice/);
    expect(Object.keys(BLOCKS)).toEqual(expect.arrayContaining(['plate', 'figure', 'entry']));
  });

  it('a figure is drawn marks alone: nothing that runs, nothing that leaves the page', () => {
    const fig = (svg) => () => readPublication({ ...BOOK, chapters: [{ blocks: [{ figure: svg }] }] });
    expect(fig(FIGURE)).not.toThrow();
    expect(fig('<div>no</div>')).toThrow(/one <svg>/);
    for (const inner of ['<script>1</script>', '<circle onclick="x()"/>', '<image href="https://a.b/c.png"/>', '<a href="javascript:x()"/>', '<foreignObject/>']) {
      expect(fig(`<svg viewBox="0 0 1 1">${inner}</svg>`)).toThrow(/script, an event handler or a link out/);
    }
    expect(fig('<svg viewBox="0 0 1 1"><use href="#a"/></svg>')).not.toThrow();
  });

  it('each kind wears a book style of its own unless the publication names one', () => {
    for (const id of PUBLICATION_KIND_IDS) expect(readBookStyle(PUBLICATION_KINDS[id].style)).toBeTruthy();
    expect(styleOf(BOOK)).toBe(PUBLICATION_KINDS.grimoire.style);
    expect(styleOf({ ...BOOK, style: 'zine' })).toBe('zine');
  });
});

describe('set once, read two ways', () => {
  it('compiles to a title page and its chapters, words escaped, each block the press\'s own', () => {
    expect(compiled.chapters.map((c) => [c.id, c.kind])).toEqual([['title', 'title'], ['first', 'flow'], ['c2', 'flow']]);
    expect(compiled.chapters[0].body).toContain('<h1>The Small Book</h1>');
    expect(compiled.chapters[0].body).toContain('of &lt;one&gt; thing');
    const body = compiled.chapters[1].body;
    expect(body).toContain('<p class="drop">It begins &amp; goes on.</p>');
    for (const mark of ['<h3>A part</h3>', 'class="box"', 'class="margin"', 'class="facts"', 'class="stat"', 'class="roll"', '<figcaption>A ball.</figcaption>', '<figcaption>A ring.</figcaption>', 'class="lines"']) expect(body).toContain(mark);
    expect(body).not.toContain('<?xml');
    expect(compiled.chapters[2].body).toContain('class="key"');
    // the plate is the kind's finish (an engraving) in the book's ink, its ids its own
    expect(body).toMatch(/id="pl1-f1"/);
    expect(body).toContain(`stroke="${readBookStyle('tome').colours.ink}"`);
  });

  it('the same pages print on the press and open in the reader; a compiled book is not set again', () => {
    const book = publicationBook(compiled), reader = readerHtml(compiled);
    for (const page of [book, reader]) {
      expect(page.startsWith('<!doctype html>')).toBe(true);
      expect(page).toContain('<figcaption>A ball.</figcaption>');
      expect(page).toContain('p.margin{');
    }
    expect(book).not.toContain('<script');
    expect(publicationBook(BOOK, { res: 1 })).toBe(book);
    expect(readerHtml(BOOK, { res: 1 })).toBe(reader);
  });

  it('the reader is one self-contained page: a chapter a new leaf, turned by its keys, closed by a word to its frame', () => {
    const reader = readerHtml(compiled);
    expect(reader).toContain('class="rd-leaves book"');
    expect(reader).toContain('break-before:column');
    expect((reader.match(/<section class="chapter/g) || []).length).toBe(3);
    expect(reader).toContain(JSON.stringify(READER_KEYS));
    expect(reader).toContain("postMessage({ mojReader: 'close' }");
    expect(reader).toContain('window.__mojReader');
    expect(reader).not.toMatch(/src="http|href="http|@import/);
  });
});

describe('the prop shelf', () => {
  // one prop a way of building it: turned on a lathe, cut into, turned in place
  const picks = [PROP_IDS.find((id) => PROPS[id].terms().some((t) => t.shape?.kind === 'lathe')), PROP_IDS.find((id) => PROPS[id].terms().some((t) => t.op === 'subtract')), PROP_IDS.find((id) => PROPS[id].terms().some((t) => t.op === 'transform'))];

  it('a prop is a form a plate reads, in its own tint or the one said, moved where it is stood', () => {
    for (const id of picks) expect(readPlate({ forms: [propForm(id)] })).toBeTruthy();
    const f = propForm(picks[0], { at: [0.3, -0.1], tint: '#112233' });
    expect(f.tint).toBe('#112233');
    expect(f.terms.at(-1)).toEqual({ op: 'transform', translate: [0.3, -0.1, 0] });
    expect(() => propForm('dragon')).toThrow(/no prop 'dragon'/);
    expect(() => propForm(picks[0], { tint: 'red' })).toThrow(/#rrggbb/);
  });

  it('a still life stands its props in a row and sets the station for what it holds', () => {
    const plate = stillLife([picks[0], [picks[1], '#445566']]);
    expect(readPlate(plate)).toBe(plate);
    expect(plate.forms.map((f) => f.tint)).toEqual([PROPS[picks[0]].tint, '#445566']);
    const tall = stillLife(['blade']), low = stillLife(['tome']);
    expect(tall.station.distance).toBeGreaterThan(low.station.distance);
    expect(() => stillLife([])).toThrow(/1 to 4 props/);
    expect(() => stillLife(['dragon'])).toThrow(/no prop/);
  });

  it('what stands for an element or a technique is on the shelf', () => {
    for (const w of [...Object.values(ELEMENT_PROPS).flat(), ...Object.values(DOES_PROPS)]) expect(PROPS[w]).toBeTruthy();
    for (const d of DOES_IDS) expect(DOES_PROPS[d]).toBeTruthy();
  });
});

describe('lore, published', () => {
  const premise = newManual({ name: 'the Marches', polarity: 'storm-three', creatures: [{ id: 'cinder-imp', element: 'fire', role: 'grunt' }, { id: 'frost-wight', element: 'ice', role: 'elite' }, { id: 'the-king', element: 'ice', role: 'boss', name: 'The King' }] });

  it('a manual is a bestiary: a chapter an element, an entry a creature; what a later pass will say is left out', () => {
    const thin = bestiaryOf(premise);
    expect(readPublication(thin)).toBe(thin);
    expect(thin).toMatchObject({ kind: 'bestiary', title: 'A Bestiary of the Marches' });
    expect(thin.chapters.map((c) => c.id)).toEqual(['of-fire', 'of-ice']);
    const entries = (P) => P.chapters.flatMap((c) => c.blocks.filter((b) => b.specimen).map((b) => b.specimen));
    expect(entries(thin).map((e) => e.name)).toEqual(['Cinder Imp', 'Frost Wight', 'The King']);
    expect(entries(thin)[1].epithet).toBe('Elite of ice');
    expect(JSON.stringify(thin)).not.toMatch(/Measure|Fears/);

    const full = bestiaryOf(intensifyManual(premise, { affinity: true, levels: true }).manual, { diagram: FIGURE, by: 'the wardens' });
    expect(readPublication(full)).toBe(full);
    expect(full.chapters[0].id).toBe('the-order');
    expect(full.by).toBe('the wardens');
    const king = entries(full).find((e) => e.name === 'The King');
    expect(king.traits).toEqual(expect.arrayContaining([['Fears', 'fire'], ['Feeds on', 'ice'], ['Met at', 'level 5']]));
    expect(king.traits.find((t) => t[0] === 'Measure')[1]).toMatch(/^life \d+, strength \d+, guard \d+, craft \d+, speed \d+$/);
    // each creature stands under its element's sign, and the book has a front
    expect(king.plate.forms).toHaveLength(1);
    expect(readCover(full.cover)).toBe(full.cover);
  });

  it('a tree is a grimoire: the school, then a chapter a tier; its costs only once it is costed', () => {
    const base = newTree({ id: 'pyre', name: 'The Pyre School', element: 'fire', techniques: [{ id: 'spark', does: 'bolt' }, { id: 'kindle', does: 'surge' }, { id: 'cauterise', does: 'mend' }] });
    const thin = grimoireOf(base);
    expect(readPublication(thin)).toBe(thin);
    expect(thin.chapters.map((c) => c.id)).toEqual(['the-school', 'tier-1']);
    expect(JSON.stringify(thin)).not.toMatch(/Costs|Come by/);

    const T = intensifyTree(base, { order: { spark: { at: 1 }, kindle: { at: 2 }, cauterise: { requires: ['spark'] } }, costs: true }).tree;
    const full = grimoireOf(T, { diagram: FIGURE });
    expect(readPublication(full)).toBe(full);
    expect(full).toMatchObject({ kind: 'grimoire', title: 'The Grimoire of the Pyre School' });
    expect(full.chapters.map((c) => c.title)).toEqual(['The school', 'The first workings', 'The second tier']);
    const text = JSON.stringify(full);
    expect(text).toContain('taught at rank 1');
    expect(text).toContain('earned after Spark');
    expect(full.chapters[0].blocks.some((b) => b.figure)).toBe(true);
  });
});

describe('a field guide\'s specimen and a comic\'s page', () => {
  const SPEC = { specimen: { name: 'Rime Mite', epithet: 'Grunt of ice', plate: BALL, traits: [['Fears', 'fire']], body: 'Met in numbers.' } };
  const wrap = (blocks, over = {}) => ({ kind: 'bestiary', title: 'B', chapters: [{ blocks }], ...over });

  it('a specimen is its picture, its number and name, its second name, its marks and a description', () => {
    const body = compilePublication(wrap([SPEC, { specimen: { name: 'A Rumour' } }]), { res: 1 }).chapters[1].body;
    expect(body).toMatch(/<article class="specimen"><div class="illustration"><svg/);
    expect(body).toContain('<p class="no">001</p><p class="label">Rime Mite</p><p class="epithet">Grunt of ice</p>');
    expect(body).toContain('<p class="description">Met in numbers.</p>');
    expect(body).toContain('<article class="specimen text-only"><p class="no">002</p>');
    expect(() => readPublication(wrap([{ specimen: { name: 'x', plate: BALL, figure: FIGURE } }]))).toThrow(/a plate or a figure, not both/);
    expect(() => readPublication(wrap([{ specimen: { name: 'x', habitat: 'fen' } }]))).toThrow(/habitat is not part of a specimen/);
  });

  it('a comic page is its layout\'s rows of panels: a picture, a caption box, balloons', () => {
    const page = { layout: 'split', panels: [{ plate: BALL, caption: 'Night.' }, { figure: FIGURE, says: [{ who: 'Ilse', text: 'Who is there?' }] }, { caption: 'No one.' }] };
    const C = compilePublication(wrap([page], { kind: 'comic', reads: 'rtl' }), { res: 1 });
    const body = C.chapters[1].body;
    expect(C.reads).toBe('rtl');
    expect(body).toMatch(/<section class="comic-page rows2"><div class="row n1"><div class="panel"><svg/);
    expect((body.match(/class="panel"/g) || []).length).toBe(3);
    expect(body).toContain('<p class="cap">Night.</p>');
    expect(body).toContain('<p class="say"><b>Ilse</b> Who is there?</p>');
    // every layout says how many panels it holds, and a page that brings another count is told
    for (const [id, rows] of Object.entries(PANEL_LAYOUTS)) expect(rows.reduce((a, n) => a + n, 0)).toBeGreaterThan(0);
    expect(() => readPublication(wrap([{ layout: 'grid', panels: [{ caption: 'one' }] }]))).toThrow(/panels is 4 panels for the 'grid' layout/);
    expect(() => readPublication(wrap([{ layout: 'spiral', panels: [{ caption: 'one' }] }]))).toThrow(/layout is one of full, halves/);
    expect(() => readPublication(wrap([{ layout: 'full', panels: [{}] }]))).toThrow(/is empty/);
    expect(() => readPublication(wrap([{ layout: 'full', panels: [{ says: [{ text: '' }] }] }]))).toThrow(/says is 1 to 3 lines/);
  });

  it('a book that reads right to left turns the other way in the reader', () => {
    const rtl = readerHtml(compilePublication(wrap([{ p: 'x' }], { kind: 'comic', reads: 'rtl' }))), ltr = readerHtml(compilePublication(wrap([{ p: 'x' }], { kind: 'comic' })));
    expect(rtl).toContain('class="rd-leaves book" data-reads="rtl"');
    expect(ltr).toContain('class="rd-leaves book">');
  });
});

describe('a cover', () => {
  const P = { kind: 'grimoire', title: 'The <Small> Book', by: 'a hand', subtitle: 'of one thing', chapters: [{ blocks: [{ p: 'x' }, { plate: BALL }] }] };

  it('is drawn only when asked: its ground its kind\'s cloth, its words set as type, its picture a plate', () => {
    expect(publicationCover(P)).toBeNull();
    const own = publicationCover({ ...P, cover: true }, { res: 1 });
    expect(own.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(own).toContain(`fill="${COVER_GROUNDS.grimoire.bg}"`);
    expect(own).toContain('The &lt;Small&gt;');
    expect(own).toMatch(/<text [^>]*fill="#[0-9a-f]{6}"[^>]*><tspan/);
    expect(own).toMatch(/<svg x="\d+" y="\d+" width="\d+" height="\d+" viewBox=/);   // the book's first plate, set in
    expect(own).not.toMatch(/<script|href=|NaN/);
    expect(publicationCover({ ...P, cover: true }, { res: 1 })).toBe(own);
    const props = publicationCover({ ...P, cover: { props: ['tome'], palette: { bg: '#102030' } } }, { res: 1, id: 'a' });
    expect(props).toContain('fill="#102030"');
    expect(props).toMatch(/id="a-f1"/);
    // nothing to draw: the cover's own ground
    expect(publicationCover({ ...P, chapters: [{ blocks: [{ p: 'x' }] }], cover: true })).not.toMatch(/<svg x=/);
  });

  it('refuses what is not a cover, naming what it takes; a publication with one shows it on its first page', () => {
    expect(() => readCover({ props: ['tome'], plate: BALL })).toThrow(/props .* or a plate of its own, not both/);
    expect(() => readCover({ props: ['dragon'] })).toThrow(/cover props: no prop 'dragon'/);
    expect(() => readCover({ archetype: 'origami' })).toThrow(/archetype is one of/);
    expect(() => readCover({ palette: { bg: 'red' } })).toThrow(/#rrggbb/);
    expect(() => readPublication({ ...P, cover: { spine: 1 } })).toThrow(/cover has no 'spine'/);
    const front = compilePublication({ ...P, cover: true }, { res: 1 }).chapters[0].body;
    expect(front.startsWith('<figure class="cover"><svg')).toBe(true);
    expect(compilePublication(P, { res: 1 }).chapters[0].body.startsWith('<h1>')).toBe(true);
  });
});

describe('the examples', () => {
  it('each is a publication', () => {
    for (const P of Object.values(PUBLICATION_EXAMPLES)) expect(readPublication(P)).toBe(P);
  });
});
