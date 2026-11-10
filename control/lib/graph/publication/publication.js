/**
 * THE PUBLICATION — a book the studio makes for a game and its world: a grimoire, a bestiary, a manual, a notebook.
 * One recipe of data (never html), read three ways:
 *
 *   publicationBook(P)     the press's page (book/book-press.js): reads on a screen, prints as a book, PDF by book-pdf.js
 *   readerHtml(P)          the same pages as a book held open: a spread at a time, turned (reader.js). Self-contained,
 *                          so a game shows it inside its own page (playscape/ui/library.js, `play.library`)
 *   compilePublication(P)  → { title, kind, style, chapters: [{ id, title?, kind, body }] } the blocks set once, for
 *                          both: a plate is drawn once however many ways the book is read
 *
 *   P: { kind, title, subtitle?, by?, style?, cover?, reads?, chapters: [{ id?, title?, blocks: [block] }] }
 *     cover   its front (cover.js): true, or { props, plate, tagline, archetype, palette }; shown on its first page and
 *             on a level's shelf
 *     reads   'ltr' (the default) or 'rtl': which way its pages turn (a manga reads right to left)
 *     kind    PUBLICATION_KINDS: what it is and how it looks unless `style` (a book style, book/book-style.js) says
 *     blocks, one key each (BLOCKS):
 *       { h }                      a heading inside the chapter
 *       { p, drop? }               a paragraph; drop: a drop capital
 *       { note, label? }           a boxed note
 *       { margin }                 a marginal remark, in the hand of whoever kept the book
 *       { facts: [[label, value]] }
 *       { stat: { name, pairs: [[label, value]], note? } }       a creature's or a thing's numbers between two rules
 *       { table: { rows: [[left, right]], head?, title? } }
 *       { entry: { n, title, blocks } }                          a numbered entry, kept whole
 *       { plate: <drawn plate spec>, caption?, span? }           an illustration drawn from forms (book/drawn-plate.js)
 *       { figure: '<svg …>', caption?, span? }                   a figure another tool made (a lorecube diagram, a map)
 *       { specimen: { name, epithet?, plate? | figure?, traits?: [[label, value]], body? } }   a field guide's entry: its
 *                                                                picture, its name, its second name, its marks, a description
 *       { panels: [{ plate? | figure?, caption?, says?: [{ who?, text }] }], layout? }   one page of a comic: its panels in
 *                                                                a PANEL_LAYOUTS grid, each a picture, a caption box, balloons
 *       { lines: n }                                             ruled lines to write on
 *
 *   readPublication(P)     → P, or throws naming what it takes
 *
 * Words are escaped; a figure's SVG is the one thing passed through, and it is refused if it carries script, an
 * event handler or a link out. Pure and deterministic: the same recipe, the same pages.
 */
import { bookHtml, esc, heading, para, aside, facts, statBlock, rollTable, keyed, plate as pressPlate, lines } from '../book/book-press.js';
import { readBookStyle } from '../book/book-style.js';
import { drawnPlate, readPlate } from '../book/drawn-plate.js';
import { readCover, publicationCover } from './cover.js';

/** What a publication is, and the book style it wears unless it names its own. */
export const PUBLICATION_KINDS = Object.freeze({
  grimoire: { reads: 'a book of a school\'s workings: what each technique does, how it is come by, what it costs', style: 'tome', finish: 'engraving' },
  bestiary: { reads: 'a book of a region\'s creatures: each with its nature, its numbers and what it fears', style: 'tome', finish: 'engraving' },
  manual: { reads: 'how a thing is used or done, in steps: a field manual, a handbook', style: 'dossier', finish: 'woodcut' },
  notebook: { reads: 'one person\'s working pages: studies, notes in the margin, drawings with their construction left in', style: { style: 'tome', format: 'digest' }, finish: 'wash' },
  comic: { reads: 'a story told in panels, a page at a time: a prologue, a legend, an issue found in the world', style: { style: 'zine', look: 'paper' }, finish: 'woodcut' },
});
export const PUBLICATION_KIND_IDS = Object.freeze(Object.keys(PUBLICATION_KINDS));

export const BLOCKS = Object.freeze({
  h: 'a heading', p: 'a paragraph', note: 'a boxed note', margin: 'a marginal remark', facts: '[[label, value]]', stat: '{ name, pairs, note? }',
  table: '{ rows: [[left, right]], head?, title? }', entry: '{ n, title, blocks }', plate: 'a drawn plate spec', figure: 'an <svg> another tool made',
  specimen: '{ name, epithet?, plate? | figure?, traits?, body? }', panels: '[{ plate? | figure?, caption?, says? }], a comic\'s page', lines: 'ruled lines, a count',
});
/** How a comic page's panels are laid: how many across each row holds. */
export const PANEL_LAYOUTS = Object.freeze({ full: [1], halves: [1, 1], thirds: [1, 1, 1], strip: [3], split: [1, 2], grid: [2, 2], splash: [1, 3] });
export const PANEL_LAYOUT_IDS = Object.freeze(Object.keys(PANEL_LAYOUTS));
const BLOCK_EXTRAS = { p: ['drop'], note: ['label'], plate: ['caption', 'span'], figure: ['caption', 'span'], panels: ['layout'] };

const fail = (m) => new Error(`publication: ${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (v) => typeof v === 'string' && v.trim().length > 0;
const pairs = (v) => Array.isArray(v) && v.length > 0 && v.every((r) => Array.isArray(r) && r.length === 2 && r.every((c) => typeof c === 'string' || Number.isFinite(c)));
const ID = /^[a-z][a-z0-9-]{0,39}$/;

/** A figure's SVG, as another tool made it: one <svg> element, nothing that runs and nothing that leaves the page. */
const bare = (svg) => (typeof svg === 'string' ? svg.replace(/^\s*<\?xml[^>]*\?>\s*/, '').trim() : svg);
function readFigure(raw, at) {
  const svg = bare(raw);
  if (typeof svg !== 'string' || !/^<svg[\s>]/.test(svg) || !/<\/svg>$/.test(svg)) throw fail(`${at}.figure is one <svg>…</svg> another tool made (a diagram, a map); a drawing of forms is a { plate }`);
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|(?:href|src)\s*=\s*["'](?!#)/i.test(svg)) throw fail(`${at}.figure carries script, an event handler or a link out: a figure is drawn marks alone`);
  return svg;
}

function readBlocks(blocks, at, depth = 0) {
  if (!Array.isArray(blocks) || !blocks.length) throw fail(`${at} is a non-empty list of blocks (${Object.keys(BLOCKS).join(', ')})`);
  blocks.forEach((b, i) => {
    const here = `${at}[${i}]`;
    if (!isObj(b)) throw fail(`${here} is a block: one of ${Object.keys(BLOCKS).join(', ')}`);
    const kind = Object.keys(b).find((k) => BLOCKS[k]);
    if (!kind) throw fail(`${here} names no block (${Object.keys(BLOCKS).join(', ')})`);
    for (const k of Object.keys(b)) if (k !== kind && !(BLOCK_EXTRAS[kind] || []).includes(k)) throw fail(`${here}.${k} is not part of a ${kind} block${BLOCK_EXTRAS[kind] ? ` (${BLOCK_EXTRAS[kind].join(', ')})` : ''}`);
    const v = b[kind];
    if (['h', 'p', 'note', 'margin'].includes(kind) && !words(v)) throw fail(`${here}.${kind} is words`);
    if (kind === 'facts' && !pairs(v)) throw fail(`${here}.facts is [[label, value], …]`);
    if (kind === 'stat' && !(isObj(v) && words(v.name) && pairs(v.pairs))) throw fail(`${here}.stat is { name, pairs: [[label, value], …], note? }`);
    if (kind === 'table' && !(isObj(v) && pairs(v.rows))) throw fail(`${here}.table is { rows: [[left, right], …], head?, title? }`);
    if (kind === 'entry') {
      if (depth) throw fail(`${here}.entry stands in a chapter, not inside another entry`);
      if (!(isObj(v) && (words(v.n) || Number.isFinite(v.n)) && words(v.title))) throw fail(`${here}.entry is { n, title, blocks }`);
      readBlocks(v.blocks, `${here}.entry.blocks`, 1);
    }
    if (kind === 'plate') { try { readPlate(v); } catch (e) { throw fail(`${here}.${e.message}`); } }
    if (kind === 'figure') readFigure(v, here);
    if (kind === 'specimen') {
      if (!(isObj(v) && words(v.name))) throw fail(`${here}.specimen is { name, epithet?, plate? | figure?, traits?, body? }`);
      for (const k of Object.keys(v)) if (!['name', 'epithet', 'plate', 'figure', 'traits', 'body'].includes(k)) throw fail(`${here}.specimen.${k} is not part of a specimen (name, epithet, plate, figure, traits, body)`);
      if (v.plate !== undefined && v.figure !== undefined) throw fail(`${here}.specimen takes a plate or a figure, not both`);
      if (v.plate !== undefined) { try { readPlate(v.plate); } catch (e) { throw fail(`${here}.specimen.${e.message}`); } }
      if (v.figure !== undefined) readFigure(v.figure, `${here}.specimen`);
      for (const k of ['epithet', 'body']) if (v[k] !== undefined && !words(v[k])) throw fail(`${here}.specimen.${k} is words`);
      if (v.traits !== undefined && !pairs(v.traits)) throw fail(`${here}.specimen.traits is [[label, value], …]`);
    }
    if (kind === 'panels') {
      const rows = PANEL_LAYOUTS[b.layout ?? 'halves'];
      if (!rows) throw fail(`${here}.layout is one of ${PANEL_LAYOUT_IDS.join(', ')} (${PANEL_LAYOUT_IDS.map((k) => `${k} ${PANEL_LAYOUTS[k].join('+')}`).join(', ')} panels a row)`);
      const want = rows.reduce((a, n) => a + n, 0);
      if (!Array.isArray(v) || v.length !== want) throw fail(`${here}.panels is ${want} panel${want > 1 ? 's' : ''} for the '${b.layout ?? 'halves'}' layout: [{ plate? | figure?, caption?, says? }]`);
      v.forEach((pn, j) => {
        const pat = `${here}.panels[${j}]`;
        if (!isObj(pn)) throw fail(`${pat} is { plate? | figure?, caption?, says?: [{ who?, text }] }`);
        for (const k of Object.keys(pn)) if (!['plate', 'figure', 'caption', 'says'].includes(k)) throw fail(`${pat}.${k} is not part of a panel (plate, figure, caption, says)`);
        if (pn.plate !== undefined && pn.figure !== undefined) throw fail(`${pat} takes a plate or a figure, not both`);
        if (pn.plate === undefined && pn.figure === undefined && pn.caption === undefined && pn.says === undefined) throw fail(`${pat} is empty: give it a picture, a caption or a line`);
        if (pn.plate !== undefined) { try { readPlate(pn.plate); } catch (e) { throw fail(`${pat}.${e.message}`); } }
        if (pn.figure !== undefined) readFigure(pn.figure, pat);
        if (pn.caption !== undefined && !words(pn.caption)) throw fail(`${pat}.caption is words`);
        if (pn.says !== undefined && !(Array.isArray(pn.says) && pn.says.length >= 1 && pn.says.length <= 3 && pn.says.every((s) => isObj(s) && words(s.text) && (s.who === undefined || words(s.who))))) throw fail(`${pat}.says is 1 to 3 lines: [{ who?, text }]`);
      });
    }
    if (kind === 'lines' && !(Number.isInteger(v) && v >= 1 && v <= 40)) throw fail(`${here}.lines is 1 to 40 ruled lines`);
  });
}

/** A publication, checked. Returns it as written. */
export function readPublication(P) {
  if (!isObj(P)) throw fail('a publication is { kind, title, chapters: [{ title?, blocks }] }');
  if (!PUBLICATION_KINDS[P.kind]) throw fail(`kind is one of ${PUBLICATION_KIND_IDS.join(', ')}`);
  if (!words(P.title)) throw fail('title is the book\'s name, in words');
  for (const k of ['subtitle', 'by']) if (P[k] !== undefined && !words(P[k])) throw fail(`${k} is words`);
  for (const k of Object.keys(P)) if (!['kind', 'title', 'subtitle', 'by', 'style', 'cover', 'reads', 'chapters'].includes(k)) throw fail(`${k} is not part of a publication (kind, title, subtitle, by, style, cover, reads, chapters)`);
  readCover(P.cover);
  if (P.reads !== undefined && !['ltr', 'rtl'].includes(P.reads)) throw fail("reads is 'ltr' or 'rtl': which way its pages turn");
  if (P.style !== undefined) { try { readBookStyle(P.style); } catch (e) { throw fail(`style: ${e.message}`); } }
  if (!Array.isArray(P.chapters) || !P.chapters.length) throw fail('chapters is a non-empty list of { id?, title?, blocks }');
  const seen = new Set();
  P.chapters.forEach((c, i) => {
    if (!isObj(c)) throw fail(`chapters[${i}] is { id?, title?, blocks }`);
    if (c.id !== undefined && (typeof c.id !== 'string' || !ID.test(c.id))) throw fail(`chapters[${i}].id is a lowercase id`);
    const id = c.id ?? `c${i + 1}`;
    if (seen.has(id)) throw fail(`chapters[${i}].id '${id}' appears twice`);
    seen.add(id);
    if (c.title !== undefined && !words(c.title)) throw fail(`chapters[${i}].title is words`);
    readBlocks(c.blocks, `chapters[${i}].blocks`);
  });
  return P;
}

/** The style a publication wears: its own, else its kind's. */
export const styleOf = (P) => P.style ?? PUBLICATION_KINDS[P.kind].style;

function setBlocks(blocks, ctx) {
  return blocks.map((b) => {
    if (b.h !== undefined) return heading(b.h, 3);
    if (b.p !== undefined) return para(b.p, { drop: !!b.drop });
    if (b.note !== undefined) return aside(`<span>${esc(b.note)}</span>`, { label: b.label });
    if (b.margin !== undefined) return `<p class="margin">${esc(b.margin)}</p>`;
    if (b.facts !== undefined) return facts(b.facts);
    if (b.stat !== undefined) return statBlock(b.stat.name, b.stat.pairs, { note: b.stat.note });
    if (b.table !== undefined) return rollTable(b.table.head ?? '', b.table.rows, { title: b.table.title });
    if (b.entry !== undefined) return keyed(b.entry.n, b.entry.title, setBlocks(b.entry.blocks, ctx));
    if (b.plate !== undefined) return drawnPlate({ finish: ctx.finish, ...b.plate }, { style: ctx.style, caption: b.caption, span: !!b.span, id: `pl${++ctx.plates}`, ...(ctx.res ? { res: ctx.res } : {}) });
    if (b.figure !== undefined) return pressPlate(bare(b.figure), { caption: b.caption, span: !!b.span });
    const picture = (x) => (x.plate !== undefined
      ? drawnPlate({ finish: ctx.finish, ...x.plate }, { style: ctx.style, id: `pl${++ctx.plates}`, ...(ctx.res ? { res: ctx.res } : {}) }).replace(/^<figure class="plate">/, '').replace(/<\/figure>$/, '')
      : x.figure !== undefined ? bare(x.figure) : '');
    if (b.specimen !== undefined) {
      const s = b.specimen, pic = picture(s);
      return `<article class="specimen${pic ? '' : ' text-only'}">${pic ? `<div class="illustration">${pic}</div>` : ''}<p class="no">${String(++ctx.specimens).padStart(3, '0')}</p><p class="label">${esc(s.name)}</p>`
        + `${s.epithet ? `<p class="epithet">${esc(s.epithet)}</p>` : ''}${s.traits ? facts(s.traits) : ''}${s.body ? `<p class="description">${esc(s.body)}</p>` : ''}</article>`;
    }
    if (b.panels !== undefined) {
      const rows = PANEL_LAYOUTS[b.layout ?? 'halves'];
      let k = 0;
      const row = (n) => `<div class="row n${n}">${b.panels.slice(k, (k += n)).map((pn) => `<div class="panel">${picture(pn)}${pn.caption ? `<p class="cap">${esc(pn.caption)}</p>` : ''}`
        + `${pn.says ? `<div class="says">${pn.says.map((l) => `<p class="say">${l.who ? `<b>${esc(l.who)}</b> ` : ''}${esc(l.text)}</p>`).join('')}</div>` : ''}</div>`).join('')}</div>`;
      return `<section class="comic-page rows${rows.length}">${rows.map(row).join('')}</section>`;
    }
    return lines(b.lines);
  }).join('');
}

/**
 * The publication with its blocks set: `{ title, kind, style, chapters }`, the chapters the press's own (a title
 * page first). `res`: the plates' samples per unit (drawn-plate.js), for a quick proof.
 */
export function compilePublication(P, { res } = {}) {
  readPublication(P);
  const style = styleOf(P), ctx = { style, finish: PUBLICATION_KINDS[P.kind].finish, plates: 0, specimens: 0, res };
  const cover = publicationCover(P, { faces: readBookStyle(style).stacks });
  const front = cover ? `<figure class="cover">${cover}</figure>` : `<h1>${esc(P.title)}</h1>${P.subtitle ? `<p class="sub">${esc(P.subtitle)}</p>` : ''}${P.by ? `<p class="mark">${esc(P.by)}</p>` : ''}`;
  return {
    title: P.title, kind: P.kind, style, ...(P.reads === 'rtl' ? { reads: 'rtl' } : {}),
    chapters: [
      { id: 'title', kind: 'title', body: front },
      ...P.chapters.map((c, i) => ({ id: c.id ?? `c${i + 1}`, ...(c.title ? { title: c.title } : {}), kind: 'flow', body: setBlocks(c.blocks, ctx) })),
    ],
  };
}

const isCompiled = (v) => isObj(v) && Array.isArray(v.chapters) && v.chapters[0]?.kind === 'title' && typeof v.chapters[0].body === 'string';
export const compiled = (P, opts) => (isCompiled(P) ? P : compilePublication(P, opts));

/** The marginal hand, the one rule a publication adds to the press's. */
export const PUBLICATION_CSS = [
  'p.margin{font-style:italic;color:var(--muted);font-size:.9em;text-align:left;border-left:.6pt solid var(--rule);padding-left:.6em;margin:.2em 0 .6em 1.2em;break-inside:avoid}',
  // the cover on the first page
  'figure.cover{margin:0 auto;height:100%;display:flex;align-items:center;justify-content:center}figure.cover svg{display:block;max-width:100%;max-height:100%;height:auto;width:auto;box-shadow:0 2px 10px rgba(0,0,0,.35)}',
  '@media print{figure.cover svg{max-height:230mm}}',
  // a field guide's specimen: the picture, its number and name, its second name, its marks, a description
  '.specimen{break-inside:avoid;margin:.2em 0 1em;padding:0 0 .6em;border-bottom:.6pt solid var(--rule)}',
  '.specimen .illustration{background:var(--tint);border:.6pt solid var(--rule);border-radius:1mm;padding:.5em;margin:0 0 .5em}.specimen .illustration svg{display:block;max-width:100%;height:auto;max-height:15em;margin:0 auto}',
  '.specimen .no{font:.8em var(--mono);color:var(--accent);letter-spacing:.12em;margin:0;text-align:left}.specimen .label{font:1.35em/1.1 var(--display);margin:0;text-align:left}',
  '.specimen .epithet{font-style:italic;color:var(--muted);margin:.1em 0 .4em;text-align:left}.specimen .description{margin:.3em 0 0}',
  // a comic's page: rows of panels, a caption box at a panel's head, balloons at its foot
  '.comic-page{break-inside:avoid;display:flex;flex-direction:column;gap:.5em;margin:0 0 .8em}.comic-page .row{display:grid;gap:.5em;flex:1}.comic-page .row.n2{grid-template-columns:1fr 1fr}.comic-page .row.n3{grid-template-columns:1fr 1fr 1fr}',
  '.comic-page .panel{position:relative;border:1.6pt solid var(--ink);background:var(--paper);min-height:7em;display:flex;flex-direction:column;justify-content:center;overflow:hidden}',
  '.comic-page .panel svg{display:block;width:100%;height:auto;max-height:17em}',
  '.comic-page .cap{position:absolute;top:0;left:0;max-width:86%;margin:0;padding:.2em .5em;background:var(--tint);border-right:1.2pt solid var(--ink);border-bottom:1.2pt solid var(--ink);font:.82em/1.25 var(--mono);text-align:left;text-transform:uppercase;letter-spacing:.03em}',
  '.comic-page .panel:not(:has(svg)) .cap{position:static;max-width:none;border:0;background:none;text-align:center;font-size:.95em;padding:.8em}',
  '.comic-page .says{position:absolute;right:.4em;bottom:.4em;max-width:78%;display:flex;flex-direction:column;gap:.25em;align-items:flex-end}',
  '.comic-page .say{margin:0;padding:.25em .7em;background:#fff;color:#111;border:1.2pt solid var(--ink);border-radius:1.1em;font:.86em/1.25 var(--text);text-align:left}.comic-page .say b{font-variant:small-caps;letter-spacing:.04em}',
].join('');

/** The publication on the press: one self-contained page that reads on a screen and prints as a book. */
export function publicationBook(P, opts) {
  const C = compiled(P, opts);
  return bookHtml({ title: C.title, style: C.style, chapters: C.chapters }).replace('</style>', `${PUBLICATION_CSS}</style>`);
}
