/**
 * The LIBRARY channel: a level's books (playscape/ui/library.js) kept on the page as a shelf over the bus's flags.
 * Emitted inside the events channel only when the events carry `library`, so a world without one keeps every byte.
 *
 * L opens the shelf (Esc or L closes it; the world is held while it is open, as a menu holds it): the books held, each
 * a cover; a cover opens the book as its reader (publication/reader.js) in a frame of its own, turned with the
 * arrows; Esc closes the book, then the shelf. A word shows at the top as a book is found, with the key.
 */
import { libraryView, libraryNews } from '../../playscape/ui/library.js';

export const LIBRARY_CSS = `
.moj-lib-toast{position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:32;pointer-events:none;background:var(--moj-panel-a,rgba(12,16,26,.92));border:1px solid var(--moj-line,#2a3b58);border-radius:8px;padding:8px 14px;font:13px/1.3 system-ui,sans-serif;color:var(--moj-ink,#e8eefc);opacity:0;transition:opacity .25s}
.moj-lib-toast .k{color:var(--moj-accent,#8fa5c8);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-right:8px}
.moj-lib-toast .j{opacity:.6;margin-left:10px;font-size:11px}
.moj-lib{position:fixed;inset:0;z-index:34;display:none;align-items:center;justify-content:center;background:rgba(4,7,12,.72)}
.moj-lib-shelf{width:min(760px,calc(100vw - 32px));max-height:84vh;overflow:auto;box-sizing:border-box;background:var(--moj-panel-a,rgba(12,16,26,.96));border:1px solid var(--moj-line,#2a3b58);border-radius:12px;padding:18px 20px;color:var(--moj-ink,#e8eefc);font:14px/1.4 system-ui,sans-serif}
.moj-lib-shelf h3{margin:0 0 14px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--moj-accent,#8fa5c8)}
.moj-lib-row{display:flex;flex-wrap:wrap;gap:14px}
.moj-lib-book{all:unset;cursor:pointer;box-sizing:border-box;width:128px;height:176px;padding:14px 12px 12px 18px;border-radius:3px 6px 6px 3px;background:linear-gradient(90deg,rgba(0,0,0,.35) 0,rgba(0,0,0,0) 9px),#5a3f2c;color:#f0e2c4;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 14px rgba(0,0,0,.5),inset -2px 0 0 rgba(255,255,255,.08);font:600 14px/1.25 Georgia,serif}
.moj-lib-book[data-kind=bestiary]{background-color:#3f4a36}.moj-lib-book[data-kind=manual]{background-color:#3d4654}.moj-lib-book[data-kind=notebook]{background-color:#6a5a3c}
.moj-lib-book .t{border-top:1px solid rgba(240,226,196,.5);border-bottom:1px solid rgba(240,226,196,.5);padding:8px 0}
.moj-lib-book .d{font:400 10px/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
.moj-lib-book:focus-visible,.moj-lib-book:hover{outline:2px solid var(--moj-accent,#8fa5c8);outline-offset:3px}
.moj-lib-none{opacity:.6}
.moj-lib-read{position:absolute;inset:0;display:none;background:#17120d}
.moj-lib-read iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.moj-lib-x{all:unset;position:absolute;top:10px;right:14px;z-index:1;cursor:pointer;color:#d8c8a8;font:20px/1 system-ui,sans-serif;padding:6px 10px;border:1px solid #4b3f30;border-radius:6px;background:rgba(23,18,13,.7)}
`;

export function libraryScript() {
  return `
// THE LIBRARY: the shelf (playscape/ui/library.js), L to open, a book read as its reader
const __LV = ${libraryView.toString()};
const __LN = ${libraryNews.toString()};
const __lSt = document.createElement('style'); __lSt.textContent = ${JSON.stringify(LIBRARY_CSS)}; document.head.appendChild(__lSt);
const __lToast = document.createElement('div'); __lToast.className = 'moj-lib-toast'; document.body.appendChild(__lToast);
const __lBox = document.createElement('div'); __lBox.className = 'moj-lib';
__lBox.innerHTML = '<div class="moj-lib-shelf"><h3>library</h3><div class="moj-lib-row"></div></div><div class="moj-lib-read"><button class="moj-lib-x" aria-label="close the book">\\u00d7</button></div>';
document.body.appendChild(__lBox);
const __lRow = __lBox.querySelector('.moj-lib-row'), __lRead = __lBox.querySelector('.moj-lib-read');
let __lSeen = 0, __lOpen = false, __lBook = null, __lWords = [], __lT = 0, __lFrame = null;
function __lDraw() {
  const v = __LV(EVENTS.library, __busState.vars);
  __lRow.innerHTML = '';
  if (!v.length) { const d = document.createElement('div'); d.className = 'moj-lib-none'; d.textContent = 'nothing to read yet'; __lRow.appendChild(d); }
  for (const b of v) {
    const e = document.createElement('button'); e.className = 'moj-lib-book'; e.dataset.kind = b.kind; e.dataset.id = b.id;
    const t = document.createElement('span'); t.className = 't'; t.textContent = b.title; e.appendChild(t);
    const d = document.createElement('span'); d.className = 'd'; d.textContent = b.kind; e.appendChild(d);
    e.addEventListener('click', () => __lReadBook(b.id));
    __lRow.appendChild(e);
  }
}
function __lReadBook(id) {
  const b = id && EVENTS.library.find((x) => x.id === id);
  if (__lFrame) { __lFrame.remove(); __lFrame = null; }
  __lBook = b ? id : null; __lRead.style.display = b ? 'block' : 'none';
  if (!b) return;
  // (a frame of its own: the book's page keeps its own styles and script, and reaches nothing of the game's)
  __lFrame = document.createElement('iframe'); __lFrame.setAttribute('sandbox', 'allow-scripts'); __lFrame.title = b.title; __lFrame.srcdoc = b.page;
  __lRead.appendChild(__lFrame); __lFrame.addEventListener('load', () => { try { __lFrame.focus(); } catch (e) { /* not focusable */ } });
}
function __lShow(open) {
  if (open && window.__mojScenes && window.__mojScenes.on()) return;   // not over a scene
  __lOpen = open; __lBox.style.display = open ? 'flex' : 'none';
  if (open) __lDraw(); else __lReadBook(null);
  window.__mojMenuOpen = open; window.__mojFreeze = open;   // the shelf holds the world as a menu does
}
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyL' && !ev.repeat && !__lBook) { ev.preventDefault(); __lShow(!__lOpen); }
  else if (__lOpen && ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); if (__lBook) __lReadBook(null); else __lShow(false); }
  else if (__lBook && __lFrame && (ev.code === 'ArrowRight' || ev.code === 'ArrowLeft')) { ev.preventDefault(); __lFrame.contentWindow.postMessage({ mojReader: ev.code === 'ArrowRight' ? 'next' : 'back' }, '*'); }
}, true);
window.addEventListener('message', (ev) => { if (__lFrame && ev.source === __lFrame.contentWindow && ev.data && ev.data.mojReader === 'close') __lReadBook(null); });
__lBox.querySelector('.moj-lib-x').addEventListener('click', () => __lReadBook(null));
__lBox.addEventListener('pointerdown', (ev) => { if (ev.target === __lBox) __lShow(false); });
function __stepLibrary(dtSec) {
  const set = [];
  for (let i = __lSeen; i < __busState.log.length; i++) { const ev = __busState.log[i]; if (ev && typeof ev.type === 'string' && ev.type.indexOf('flag:') === 0) set.push(ev.type.slice(5)); }
  __lSeen = __busState.log.length;
  for (const n of __LN(EVENTS.library, set)) __lWords.push(n);
  if (__lT > 0) { __lT -= dtSec; if (__lT <= 0) __lToast.style.opacity = '0'; }
  else if (__lWords.length) {
    const n = __lWords.shift();
    __lToast.innerHTML = '';
    const k = document.createElement('span'); k.className = 'k'; k.textContent = 'found'; __lToast.appendChild(k);
    __lToast.appendChild(document.createTextNode(n.title));
    const j = document.createElement('span'); j.className = 'j'; j.textContent = 'L library'; __lToast.appendChild(j);
    __lToast.style.opacity = '1'; __lT = 3.2;
  }
  if (__lOpen && !__lBook && set.length) __lDraw();
}
window.__mojLibrary = { view: () => __LV(EVENTS.library, __busState.vars), open: () => __lShow(true), close: () => __lShow(false), read: (id) => { __lShow(true); __lReadBook(id); }, isOpen: () => __lOpen, reading: () => __lBook };`;
}
