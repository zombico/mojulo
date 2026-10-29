/**
 * THE TABLE PAGE — a table game played in text on one self-contained page: the kernel's own closure
 * (table-rpg-kernel.js `buildTableRpg.toString()`, the same code Node plays), the module as data, a transcript, the
 * moves that can be made now as buttons, and a line to type into. The page wears the game book's look and faces
 * (book/book-style.js), so the book and the table it is played at read as one thing.
 *
 * The command list is the save: kept in the viewer's own browser (localStorage, a convenience that may be missing), the
 * game replayed from its opening on load, die for die. Play state never leaves the page.
 *
 *   tableRpgPageHtml(module, { title?, style?, bookHref? }) → html   module: readModule's (its card and its personas
 *     in it); style: the book style whose look and faces the page wears; bookHref: a link to the game book
 */
import { buildTableRpg } from './table-rpg-kernel.js';
import { readBookStyle } from '../book/book-style.js';
import { fontFaceCss } from '../image-outcomes/fonts/font-shelf.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// data in a script: its closing tag and the line separators JSON leaves raw cannot end the script early
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const strHash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };

const CLIENT = `
(function () {
  var T = buildTableRpg(), M = JSON.parse(document.getElementById('module').textContent), K = T.compile(M);
  var KEY = 'mojulo-table:' + document.body.dataset.game, saved = [];
  try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { saved = []; }
  var log = document.getElementById('log'), moves = document.getElementById('moves'), form = document.getElementById('cmd'), input = form.querySelector('input');
  var S, done = [];
  // the transcript's plain-text marks (** a place **, == the title ==) become the page's own type
  function say(lines, cls) {
    lines.forEach(function (t) {
      var p = document.createElement('p'), m;
      if (cls) p.className = cls;
      else if ((m = /^== (.*) ==$/.exec(t))) { p.className = 'title'; t = m[1]; }
      else if ((m = /^\\*\\* (.*?) \\*\\*(.*)$/.exec(t))) { p.className = 'place'; t = m[1] + m[2]; }
      else if (/→/.test(t)) p.className = 'roll';
      p.textContent = t; log.appendChild(p);
    });
  }
  function keep() { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} }
  function offer() {
    moves.textContent = '';
    T.legal(K, S).filter(function (m) { return !m.template; }).forEach(function (m) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = m.name; b.onclick = function () { play(m.name); }; moves.appendChild(b);
    });
    if (S.over) { var e = document.createElement('p'); e.className = 'over'; e.textContent = S.over.won ? 'The tale is won.' : 'The tale ends.'; moves.appendChild(e); }
  }
  function play(text, quiet) {
    var r = T.act(K, S, text);
    if (r.S !== S) { done.push(text); keep(); }
    if (!quiet) { say(['> ' + text], 'you'); say(r.lines); }
    S = r.S; if (!quiet) { offer(); log.lastElementChild && log.lastElementChild.scrollIntoView({ block: 'end' }); }
    return r.lines;
  }
  function begin() {
    log.textContent = ''; done = [];
    var o = T.start(K); S = o.S; say(o.lines);
    saved.forEach(function (c) { say(['> ' + c], 'you'); say(play(c, true)); });
    offer();
  }
  form.onsubmit = function (e) { e.preventDefault(); var t = input.value.trim(); if (t) play(t); input.value = ''; };
  document.getElementById('again').onclick = function () { saved = []; try { localStorage.removeItem(KEY); } catch (e) {} begin(); };
  begin();
  window.__mojTable = { act: function (t) { return play(t); }, state: function () { return S; } };
})();`;

export function tableRpgPageHtml(module, { title, style = 'tome', bookHref } = {}) {
  const S = readBookStyle(style), C = S.colours;
  const name = title ?? module.title ?? 'A table game';
  const faces = [...new Set([S.faces.text, S.faces.mono])].map((k) => fontFaceCss(k, ['regular', 'italic'])).join('');
  const data = json(module);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}</title><meta name="generator" content="mojulo">
<style>${faces}
:root{--paper:${C.paper};--tint:${C.tint};--ink:${C.ink};--muted:${C.muted};--rule:${C.rule};--accent:${C.accent};--text:${S.stacks.text};--mono:${S.stacks.mono}}
*{box-sizing:border-box}html,body{margin:0;background:var(--tint);color:var(--ink)}
main{max-width:46rem;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;background:var(--paper);padding:1rem 1.25rem}
header{display:flex;align-items:baseline;gap:1rem;border-bottom:1px solid var(--rule);padding-bottom:.4rem}
h1{font:400 1.6rem var(--text);margin:0;flex:1}header a,header button{font:.85rem var(--mono);color:var(--accent);background:none;border:0;cursor:pointer;text-decoration:underline}
#log{flex:1;overflow:auto;padding:.6rem 0;font:1.02rem/1.45 var(--text)}
#log p{margin:.15rem 0}#log .you{font-family:var(--mono);color:var(--accent);margin-top:.7rem}#log .roll{font-family:var(--mono);font-size:.9rem;color:var(--muted)}
#log .place{font-weight:700;margin-top:.5rem}#log .title{display:none}#moves .over{font-style:italic;color:var(--accent)}
#moves{display:flex;flex-wrap:wrap;gap:.35rem;padding:.5rem 0;border-top:1px solid var(--rule)}
#moves button{font:.85rem var(--mono);color:var(--ink);background:var(--tint);border:1px solid var(--rule);border-radius:.3rem;padding:.25rem .5rem;cursor:pointer}
#moves button:hover{border-color:var(--accent)}
form{display:flex;gap:.5rem}form input{flex:1;font:1rem var(--mono);padding:.45rem .6rem;border:1px solid var(--rule);border-radius:.3rem;background:var(--paper);color:var(--ink)}
form button{font:1rem var(--mono);padding:.45rem .9rem;border:0;border-radius:.3rem;background:var(--accent);color:var(--paper);cursor:pointer}
.hint{font:.8rem var(--mono);color:var(--muted);margin:.4rem 0 0}
</style></head>
<body data-game="${strHash(data)}"><main>
<header><h1>${esc(name)}</h1>${bookHref ? `<a href="${esc(bookHref)}">the book</a>` : ''}<button type="button" id="again">start again</button></header>
<section id="log" aria-live="polite"></section>
<div id="moves"></div>
<form id="cmd"><input aria-label="a move" autocomplete="off" placeholder="type a move: look, go nave, check stealth hard, roll 2d6, ask is it safe likely"><button>Go</button></form>
<p class="hint">Every die is rolled in the open. Your moves are kept in this browser: come back and the game is where you left it.</p>
</main>
<script type="application/json" id="module">${data}</script>
<script>var buildTableRpg = (${buildTableRpg.toString()});
${CLIENT}</script>
</body></html>
`;
}
