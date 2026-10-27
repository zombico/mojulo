/**
 * THE PRESS — one book as one self-contained page, for the screen and for print alike: the style's page set by
 * `@page` (its size, its margins, the running title and the page number in the margins), the text in the format's
 * columns, the faces the style uses inlined from the font shelf (only those: a face not used adds no byte), and the
 * blocks a book of play is made of, each kept whole across a page or column break. Pure: the same book in, the same
 * page out, no clock and no fetch, so the page prints the same in any browser and headless Chromium makes the PDF
 * (book-pdf.js).
 *
 *   bookHtml({ title, lang?, style, chapters, foot? }) → html
 *     style    a book style (book-style.js readBookStyle: a preset's key or its parts)
 *     chapters [{ id, title?, kind?: 'title' | 'flow' | 'pages', body }]   body an html string built from the blocks
 *              below; 'title' a title page, 'flow' text in the format's columns, 'pages' pages of their own (sheets);
 *              each chapter starts a page; in a one-page format (the pamphlet) every chapter flows on in the sheet's
 *              columns, the title across them
 *     foot     the running foot's words (the title when absent)
 *
 * The blocks (html strings, escaped here; `raw` html passed through as it is):
 *   esc(text)
 *   heading(text, level?)                    h2 | h3, never left at a column's foot
 *   para(text, { drop? })                     a paragraph; drop: a drop capital
 *   aside(html, { label? })                   a boxed note: the words read aloud, a referee's note
 *   keyed(n, title, html)                     a keyed entry: a room, a place, numbered as its map numbers it
 *   facts(pairs)                              [label, value] lines in small capitals
 *   statBlock(name, pairs, { note? })         a foe's numbers between two rules
 *   rollTable(die, rows, { title? })          a table to roll on: [range text, result text]
 *   grid(cells)                               [label, value] boxes in a row (an ability's score, hit points)
 *   plate(svg, { caption?, span? })           a figure; span: across every column
 *   mono(text)                                a typewriter block (the dice, a transcript)
 *   lines(n)                                  ruled lines to write on
 */
import { readBookStyle } from './book-style.js';
import { fontFaceCss } from '../image-outcomes/fonts/font-shelf.js';

export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssString = (t) => `"${String(t).replace(/["\\]/g, (c) => `\\${c}`).replace(/\n/g, ' ')}"`;

export const heading = (text, level = 2) => `<h${level}>${esc(text)}</h${level}>`;
export const para = (text, { drop = false } = {}) => `<p${drop ? ' class="drop"' : ''}>${esc(text)}</p>`;
export const aside = (html, { label } = {}) => `<aside class="box">${label ? `<b class="label">${esc(label)}</b> ` : ''}${html}</aside>`;
export const keyed = (n, title, html) => `<section class="key" id="key-${esc(n)}"><h3><span class="n">${esc(n)}</span> ${esc(title)}</h3>${html}</section>`;
export const facts = (pairs) => `<dl class="facts">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
export const statBlock = (name, pairs, { note } = {}) => `<section class="stat"><h4>${esc(name)}</h4>${note ? `<p class="note">${esc(note)}</p>` : ''}${facts(pairs)}</section>`;
export const rollTable = (die, rows, { title } = {}) => `<table class="roll">${title ? `<caption>${esc(title)}</caption>` : ''}<thead><tr><th>${esc(die)}</th><th></th></tr></thead><tbody>${rows.map(([r, t]) => `<tr><td>${esc(r)}</td><td>${esc(t)}</td></tr>`).join('')}</tbody></table>`;
export const grid = (cells) => `<div class="grid">${cells.map(([k, v, sub]) => `<div class="cell"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>${sub !== undefined ? `<span class="s">${esc(sub)}</span>` : ''}</div>`).join('')}</div>`;
export const plate = (svg, { caption, span = false } = {}) => `<figure class="plate${span ? ' span' : ''}">${svg}${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`;
export const mono = (text) => `<pre class="mono">${esc(text)}</pre>`;
export const lines = (n) => `<div class="lines">${'<i></i>'.repeat(n)}</div>`;

function css(S, foot) {
  const C = S.colours, [w, h] = S.size, cols = S.columns;
  // each face with the styles its roles set: the text its italic and bold, a title and the tables their roman
  const want = new Map();
  for (const [role, key] of Object.entries(S.faces)) for (const st of role === 'text' ? ['regular', 'italic', 'bold'] : ['regular']) (want.get(key) ?? want.set(key, new Set()).get(key)).add(st);
  const faces = [...want].map(([key, st]) => fontFaceCss(key, ['regular', 'italic', 'bold'].filter((x) => st.has(x)))).join('');
  const footer = `font:${Math.max(7, S.pt - 2)}pt ${S.stacks.display};color:${C.muted};letter-spacing:.08em`;
  return faces + `
@page{size:${w} ${h};margin:${S.margin};background:${C.paper};
  @bottom-center{content:counter(page);${footer}}
  @top-center{content:${cssString(foot)};${footer};text-transform:uppercase}}
@page:first{@bottom-center{content:none}@top-center{content:none}}
:root{--paper:${C.paper};--tint:${C.tint};--ink:${C.ink};--muted:${C.muted};--rule:${C.rule};--accent:${C.accent};
  --text:${S.stacks.text};--display:${S.stacks.display};--mono:${S.stacks.mono}}
*{box-sizing:border-box}
html{background:var(--tint)}
body{margin:0;color:var(--ink);font:${S.pt}pt/1.38 var(--text);hyphens:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.book>section.chapter{background:var(--paper);width:${w};min-height:${S.onePage ? h : 'auto'};margin:10mm auto;padding:${S.margin};box-shadow:0 1px 8px rgba(0,0,0,.25)}
@media print{html,body{background:var(--paper)}.book>section.chapter{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}
  .book>section.chapter+section.chapter{break-before:${S.onePage ? 'avoid' : 'page'}}}
${S.onePage ? `.book.one{columns:${cols};column-gap:5mm;column-rule:.4pt solid var(--rule);column-fill:auto;background:var(--paper);width:${w};min-height:${h};margin:10mm auto;padding:${S.margin};box-shadow:0 1px 8px rgba(0,0,0,.25)}
@media print{.book.one{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}
.book.one>section.chapter{display:contents}.book.one .flow{columns:auto}.book.one h2{column-span:none;font-size:${(S.pt * 1.5).toFixed(1)}pt;margin-top:.5em}
.book.one figure.plate.span{column-span:none}.book.one .is-title{column-span:all}.book.one .title{min-height:0;margin-bottom:2mm}
.book.one .is-title{display:block}` : ''}
.flow{columns:${cols};column-gap:${cols > 1 ? '6mm' : '0'};column-fill:balance${cols > 1 ? ';column-rule:.4pt solid var(--rule)' : ''}}
h1,h2,h3,h4{font-family:var(--display);font-weight:400;line-height:1.1;margin:0;break-after:avoid}
h1{font-size:${(S.pt * 3.4).toFixed(1)}pt;color:var(--ink)}
h2{font-size:${(S.pt * 1.7).toFixed(1)}pt;color:var(--accent);margin:.2em 0 .5em;border-bottom:.6pt solid var(--rule);padding-bottom:.15em;column-span:all}
h3{font-size:${(S.pt * 1.2).toFixed(1)}pt;margin:.9em 0 .25em}
h4{font-size:${(S.pt * 1.08).toFixed(1)}pt;margin:0 0 .2em}
p{margin:0 0 .5em;orphans:3;widows:3;text-align:justify}
p.drop::first-letter{float:left;font-family:var(--display);font-size:3.1em;line-height:.85;padding:.06em .08em 0 0;color:var(--accent)}
.title{display:flex;flex-direction:column;justify-content:center;min-height:${S.onePage ? '0' : `calc(${h} - 40mm)`};text-align:center}
.title h1{margin:0 0 .3em}.title .sub{font-style:italic;color:var(--muted);max-width:30em;margin:0 auto .8em}
.title p{text-align:center}.title .mark{font:${S.pt}pt var(--mono);color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
.box{display:block;background:var(--tint);border-left:2pt solid var(--accent);padding:.45em .6em;margin:.4em 0 .6em;break-inside:avoid}
.label,.facts dt,.grid .k,table.roll th{font-variant:small-caps;letter-spacing:.04em;color:var(--muted);font-weight:600}
.key{break-inside:avoid;margin:0 0 .5em}
.key h3 .n{display:inline-block;min-width:1.5em;padding:0 .3em;margin-right:.25em;text-align:center;border-radius:.6em;background:var(--ink);color:var(--paper);font:400 ${(S.pt * 0.95).toFixed(1)}pt var(--mono)}
.facts{margin:.15em 0 .4em}.facts div{display:flex;gap:.5em;align-items:baseline}.facts dt{min-width:4.5em}.facts dd{margin:0}
.stat{break-inside:avoid;border-top:1.2pt solid var(--accent);border-bottom:1.2pt solid var(--accent);padding:.35em 0 .2em;margin:.3em 0 .7em}
.stat .note{font-style:italic;color:var(--muted);margin:0 0 .2em}
table.roll{width:100%;border-collapse:collapse;margin:.3em 0 .8em;break-inside:avoid;font-size:.95em}
table.roll caption{font-family:var(--display);text-align:left;font-size:1.1em;padding-bottom:.2em}
table.roll td{padding:.15em .4em;border-top:.4pt solid var(--rule);vertical-align:top}
table.roll td:first-child{font-family:var(--mono);white-space:nowrap;width:1%;color:var(--accent)}
.grid{display:flex;flex-wrap:wrap;gap:2mm;margin:.3em 0 .6em}
.grid .cell{flex:1 1 0;min-width:0;border:.8pt solid var(--ink);border-radius:1.5mm;padding:1mm 1.5mm;text-align:center;break-inside:avoid}
.grid .k{display:block;font-size:.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.grid .v{display:block;font:700 1.7em var(--display)}.grid .s{display:block;font:.85em var(--mono);color:var(--muted)}
figure.plate{margin:.3em 0 .8em;break-inside:avoid}figure.plate.span{column-span:all}
figure.plate svg{display:block;max-width:100%;height:auto;margin:0 auto;max-height:${S.onePage ? '60mm' : `calc(${h} - 70mm)`}}
figcaption{font-size:.85em;color:var(--muted);font-style:italic;text-align:center;margin-top:.2em}
pre.mono{font:${(S.pt * 0.9).toFixed(1)}pt/1.45 var(--mono);white-space:pre-wrap;margin:.3em 0 .8em;break-inside:avoid}
.lines i{display:block;height:6.5mm;border-bottom:.5pt solid var(--rule)}
.lineup{display:flex;justify-content:center;gap:4mm;margin:6mm auto 4mm;flex-wrap:wrap}.lineup figure{margin:0;width:${S.onePage ? '22mm' : '38mm'}}
.lineup img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:1.5mm;border:.6pt solid var(--rule)}.lineup figcaption{font-style:normal;margin-top:1mm}
.sheet-head{display:flex;gap:5mm;align-items:flex-start}.sheet-head>div{flex:1;min-width:0}
.lineup.cast{column-span:all}.lineup.cast figure{width:30mm}.lineup.cast img{aspect-ratio:1}img.foe-bust{display:block;width:26mm;height:26mm;object-fit:cover;border-radius:1mm;border:.6pt solid var(--rule);margin:.4em 0 .2em}.box img.bust{float:left;width:22mm;height:22mm;object-fit:cover;border-radius:1mm;border:.6pt solid var(--rule);margin:.15em .6em .2em 0}.box:has(img.bust){display:flow-root}
.sheet-head img.bust{width:42mm;height:42mm;object-fit:cover;border-radius:1.5mm;border:.8pt solid var(--ink);flex:none}
.pages>section.page{break-before:page}.pages>section.page:first-child{break-before:avoid}
@media screen{.pages>section.page+section.page{margin-top:14mm;padding-top:10mm;border-top:1pt dashed var(--rule)}}
`;
}

export function bookHtml({ title, lang = 'en', style, chapters, foot } = {}) {
  if (!title) throw new Error('book: a book has a title');
  if (!Array.isArray(chapters) || !chapters.length) throw new Error('book: chapters are [{ id, title?, kind?, body }]');
  const S = readBookStyle(style);
  const body = chapters.map((c) => {
    const kind = c.kind ?? 'flow';
    if (!['title', 'flow', 'pages'].includes(kind)) throw new Error(`book: chapter '${c.id}' is a title, a flow or pages`);
    const head = c.title && kind !== 'title' ? heading(c.title) : '';
    const inner = kind === 'flow' ? `${head}<div class="flow">${c.body}</div>` : kind === 'title' ? `<div class="title">${c.body}</div>` : `${head}<div class="pages">${c.body}</div>`;
    return `<section class="chapter is-${kind}" id="${esc(c.id)}">${inner}</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="generator" content="mojulo"><meta name="book-style" content="${esc(`${S.style} · ${S.look} · ${S.format} · ${S.paper}`)}">
<style>${css(S, foot ?? title)}</style></head>
<body><main class="book${S.onePage ? ' one' : ''}">
${body}
</main></body></html>
`;
}
