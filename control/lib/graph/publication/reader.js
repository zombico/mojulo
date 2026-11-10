/**
 * THE READER — a publication held open: two pages side by side (one on a narrow screen), turned with the arrows, a
 * click on either page or a swipe. One self-contained page, so it opens on its own and sits inside a game's page as a
 * frame (playscape/ui/library.js): the book a player finds is the book that prints.
 *
 * The pages are not laid out by hand or by measuring: the chapters flow through columns the size of a page, each
 * chapter starting a new one, and a turn slides the flow by a spread. So the same blocks the press prints fill the
 * reader's pages at any window size, and a plate is never cut across a turn.
 *
 *   readerHtml(P, { res? }) → html     P a publication (publication.js) or one already compiled
 *   READER_KEYS                        what turns it (a book that reads right to left turns the other way: its
 *                                      pages run leftward, and the left arrow and the left page go on)
 *   in the page: `window.__mojReader` { go(n), next(), back(), at(), count() }; Escape posts { mojReader: 'close' }
 *   to the page that frames it, and it answers { mojReader: 'next' | 'back' | 'go', n? } from that page
 *
 * Deterministic: the same publication, the same page; no clock, no fetch.
 */
import { pressCss, esc } from '../book/book-press.js';
import { readBookStyle } from '../book/book-style.js';
import { compiled, PUBLICATION_CSS } from './publication.js';

export const READER_KEYS = Object.freeze({ next: ['ArrowRight', 'PageDown', 'Space'], back: ['ArrowLeft', 'PageUp'], first: ['Home'], last: ['End'], close: ['Escape'] });

// laid after the press's own rules: the page becomes an open book on a dark table
const READER_CSS = `
html{background:#17120d;height:100%}body{height:100%;overflow:hidden;font-size:clamp(11px,1.5vmin + 4px,17px)}
.rd{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2vh}
.rd-book{--rd-h:calc(min(84vh,64vw) - 4.4em);position:relative;width:min(96vw,150vh);height:min(84vh,64vw);background:var(--paper);border-radius:.4em;padding:2.2em 2.6em;
  box-shadow:0 1.2em 3em rgba(0,0,0,.55),inset 0 0 0 1px rgba(0,0,0,.18);cursor:default;user-select:none}
.rd-book::before{content:"";position:absolute;inset:0 calc(50% - 1.6em);pointer-events:none;border-radius:0;
  background:linear-gradient(90deg,transparent,rgba(0,0,0,.13) 46%,rgba(0,0,0,.22) 50%,rgba(0,0,0,.13) 54%,transparent)}
.rd-clip{height:100%;overflow:hidden}
.rd-leaves{height:100%;columns:2;column-gap:5.2em;column-fill:auto;transition:transform .42s cubic-bezier(.3,.7,.2,1);will-change:transform}
.rd-leaves>section.chapter{background:none;width:auto;min-height:0;margin:0;padding:0;box-shadow:none;break-before:column}
.rd-leaves>section.chapter:first-child{break-before:auto}
.rd-leaves .flow{columns:auto}.rd-leaves h2{column-span:none}.rd-leaves figure.plate.span{column-span:none}
.rd-leaves .is-title{height:var(--rd-h)}.rd-leaves .title{min-height:0;height:100%}
.rd-leaves[data-reads=rtl]{direction:rtl}.rd-leaves[data-reads=rtl]>section.chapter{direction:ltr}
.rd-leaves .comic-page{height:var(--rd-h);margin:0}.rd-leaves .comic-page .row{min-height:0}.rd-leaves .comic-page .panel{min-height:0}.rd-leaves .comic-page .panel svg{max-height:100%;height:100%}.rd-leaves .specimen .illustration svg{max-height:30vh}
.rd-leaves figure.plate svg{max-height:46vh}
.rd-bar{display:flex;align-items:center;gap:1.4em;color:#b9a98c;font:12px/1 var(--mono);letter-spacing:.08em}
.rd-bar button{all:unset;cursor:pointer;padding:.5em .9em;border:1px solid #4b3f30;border-radius:.4em;color:#d8c8a8}
.rd-bar button:hover{background:#2a2118}.rd-bar button[disabled]{opacity:.3;cursor:default}
.rd-n{min-width:7em;text-align:center}
@media (max-width:760px),(max-aspect-ratio:1/1){.rd-book{--rd-h:calc(min(84vh,150vw) - 3.2em);width:min(94vw,62vh);height:min(84vh,150vw);padding:1.6em 1.8em}.rd-leaves{columns:1;column-gap:3.6em}.rd-book::before{display:none}}
@media (prefers-reduced-motion:reduce){.rd-leaves{transition:none}}
`;

// the page's whole script: how far a turn slides, how many there are, what turns it
const READER_SCRIPT = `(function () {
  var f = document.querySelector('.rd-leaves'), c = f.parentElement, n = document.querySelector('.rd-n');
  var back = document.querySelector('.rd-back'), next = document.querySelector('.rd-next'), i = 0;
  var K = __KEYS__, rtl = f.getAttribute('data-reads') === 'rtl';
  if (rtl) { var sw = K.next; K = { next: K.back.concat(['Space']), back: sw.filter(function (k) { return k !== 'Space'; }), first: K.first, last: K.last, close: K.close }; }
  function gap() { return parseFloat(getComputedStyle(f).columnGap) || 0; }
  function step() { return c.clientWidth + gap(); }
  function per() { return getComputedStyle(f).columnCount === '1' ? 1 : 2; }
  function count() { return Math.max(1, Math.ceil((f.scrollWidth + gap()) / step() - 0.02)); }   // (a last leaf alone is still a turn)
  function go(k) {
    var N = count(), p = per();
    i = Math.max(0, Math.min(N - 1, k | 0));
    f.style.transform = 'translateX(' + ((rtl ? 1 : -1) * i * step()) + 'px)';
    n.textContent = (p === 2 ? (2 * i + 1) + '\\u2013' + (2 * i + 2) : (i + 1)) + ' / ' + N * p;
    (rtl ? next : back).disabled = i === 0; (rtl ? back : next).disabled = i === N - 1;
    return i;
  }
  var R = window.__mojReader = { go: go, next: function () { return go(i + 1); }, back: function () { return go(i - 1); }, at: function () { return i; }, count: count };
  function close() { if (window.parent !== window) window.parent.postMessage({ mojReader: 'close' }, '*'); }
  addEventListener('keydown', function (e) {
    var k = e.code;
    if (K.next.indexOf(k) >= 0) { e.preventDefault(); R.next(); }
    else if (K.back.indexOf(k) >= 0) { e.preventDefault(); R.back(); }
    else if (K.first.indexOf(k) >= 0) go(0);
    else if (K.last.indexOf(k) >= 0) go(count() - 1);
    else if (K.close.indexOf(k) >= 0) close();
  });
  addEventListener('message', function (e) { var m = e.data && e.data.mojReader; if (m === 'next') R.next(); else if (m === 'back') R.back(); else if (m === 'go') go(e.data.n); });
  back.addEventListener('click', rtl ? R.next : R.back); next.addEventListener('click', rtl ? R.back : R.next);
  var book = document.querySelector('.rd-book'), x0 = null;
  book.addEventListener('click', function (e) { var r = book.getBoundingClientRect(), u = (e.clientX - r.left) / r.width; if (u > 0.6) (rtl ? R.back : R.next)(); else if (u < 0.4) (rtl ? R.next : R.back)(); });
  book.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  book.addEventListener('touchend', function (e) { if (x0 === null) return; var d = e.changedTouches[0].clientX - x0; x0 = null; if (d < -40) (rtl ? R.back : R.next)(); else if (d > 40) (rtl ? R.next : R.back)(); });
  addEventListener('resize', function () { var t = f.style.transition; f.style.transition = 'none'; go(i); f.offsetWidth; f.style.transition = t; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { go(i); });
  go(0);
})();`;

/** A publication as an open book: one self-contained page. */
export function readerHtml(P, opts) {
  const C = compiled(P, opts), S = readBookStyle(C.style);
  const body = C.chapters.map((c) => (c.kind === 'title'
    ? `<section class="chapter is-title" id="${esc(c.id)}"><div class="title">${c.body}</div></section>`
    : `<section class="chapter is-flow" id="${esc(c.id)}">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}<div class="flow">${c.body}</div></section>`)).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(C.title)}</title><meta name="generator" content="mojulo"><meta name="publication" content="${esc(C.kind)}">
<style>${pressCss(S, C.title)}${PUBLICATION_CSS}${READER_CSS}</style></head>
<body><main class="rd"><div class="rd-book"><div class="rd-clip"><div class="rd-leaves book"${C.reads === 'rtl' ? ' data-reads="rtl"' : ''}>
${body}
</div></div></div>
<nav class="rd-bar"><button class="rd-back" aria-label="turn back">‹</button><span class="rd-n"></span><button class="rd-next" aria-label="turn the page">›</button></nav></main>
<script>${READER_SCRIPT.replace('__KEYS__', JSON.stringify(READER_KEYS))}</script></body></html>
`;
}
