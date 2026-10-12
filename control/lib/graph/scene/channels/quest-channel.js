/**
 * The QUEST channel: a level's quests (playscape/ui/quests.js) kept on the page as a journal over the bus's flags.
 * Emitted inside the events channel only when the events carry `quests`, so a world without them keeps every byte.
 *
 * J opens the journal (Esc or J closes it; the player's input is held while it is open, as a menu's is); a word shows
 * at the top as a quest begins (with the key), a step is done, a quest ends, from the flags set in this level (what was
 * carried in is already known, so it says nothing).
 */
import { questView, questNews } from '../../playscape/ui/quests.js';

export const QUEST_CSS = `
.moj-quest-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:32;pointer-events:none;background:var(--moj-panel-a,rgba(12,16,26,.92));border:1px solid var(--moj-line,#2a3b58);border-radius:8px;padding:8px 14px;color:var(--moj-ink,#dfe8f8);font:13px/1.4 var(--moj-font,system-ui);opacity:0;transition:opacity .3s;max-width:calc(100vw - 32px);box-sizing:border-box}
.moj-quest-toast .k{color:var(--moj-accent,#8fa5c8);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-right:8px}
.moj-quest-book{position:fixed;inset:0;z-index:33;display:none;align-items:center;justify-content:center;background:rgba(4,7,12,.6)}
.moj-quest-page{width:min(520px,calc(100vw - 32px));max-height:80vh;overflow:auto;box-sizing:border-box;background:var(--moj-panel-a,rgba(12,16,26,.96));border:1px solid var(--moj-line,#2a3b58);border-radius:12px;padding:18px 20px;color:var(--moj-ink,#dfe8f8);font:14px/1.5 var(--moj-font,system-ui)}
.moj-quest-page h3{margin:0 0 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--moj-accent,#8fa5c8)}
.moj-quest-q{margin:0 0 12px}.moj-quest-q .n{font-weight:600}.moj-quest-q.done .n{opacity:.6}
.moj-quest-s{margin:2px 0 0 14px}.moj-quest-s.done{opacity:.55;text-decoration:line-through}
.moj-quest-none{opacity:.6}
.moj-quest-toast .j{opacity:.6;margin-left:10px;font-size:11px}
`;

export function questScript() {
  return `
// QUESTS: the journal (playscape/ui/quests.js), J to open, a word as one moves on
const __QV = ${questView.toString()};
const __QN = ${questNews.toString()};
const __qSt = document.createElement('style'); __qSt.textContent = ${JSON.stringify(QUEST_CSS)}; document.head.appendChild(__qSt);
const __qToast = document.createElement('div'); __qToast.className = 'moj-quest-toast'; document.body.appendChild(__qToast);
const __qBook = document.createElement('div'); __qBook.className = 'moj-quest-book'; __qBook.innerHTML = '<div class="moj-quest-page"><h3>journal</h3><div class="moj-quest-list"></div></div>'; document.body.appendChild(__qBook);
const __qList = __qBook.querySelector('.moj-quest-list');
let __qSeen = 0, __qOpen = false, __qWords = [], __qT = 0;
const __qWord = { begun: 'new quest', step: 'done', done: 'quest complete' };
function __qDraw() {
  const v = __QV(EVENTS.quests, __busState.vars);
  __qList.innerHTML = '';
  if (!v.length) { const d = document.createElement('div'); d.className = 'moj-quest-none'; d.textContent = 'nothing yet'; __qList.appendChild(d); }
  for (const q of v) {
    const d = document.createElement('div'); d.className = 'moj-quest-q' + (q.state === 'done' ? ' done' : '');
    const n = document.createElement('div'); n.className = 'n'; n.textContent = q.name + (q.state === 'done' ? ' \\u2713' : ''); d.appendChild(n);
    for (const s of q.steps) { const e = document.createElement('div'); e.className = 'moj-quest-s' + (s.done ? ' done' : ''); e.textContent = s.text; d.appendChild(e); }
    __qList.appendChild(d);
  }
}
function __qShow(open) {
  if (open && window.__mojScenes && window.__mojScenes.on()) return;   // not over a scene
  __qOpen = open; __qBook.style.display = open ? 'flex' : 'none';
  if (open) __qDraw();
  window.__mojMenuOpen = open;
}
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyJ' && !ev.repeat) { ev.preventDefault(); __qShow(!__qOpen); }
  else if (__qOpen && ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); __qShow(false); }
}, true);
__qBook.addEventListener('pointerdown', (ev) => { if (ev.target === __qBook) __qShow(false); });
function __stepQuests(dtSec) {
  const set = [];
  for (let i = __qSeen; i < __busState.log.length; i++) { const ev = __busState.log[i]; if (ev && typeof ev.type === 'string' && ev.type.indexOf('flag:') === 0) set.push(ev.type.slice(5)); }
  __qSeen = __busState.log.length;
  for (const n of __QN(EVENTS.quests, set)) __qWords.push(n);
  if (__qT > 0) { __qT -= dtSec; if (__qT <= 0) __qToast.style.opacity = '0'; }
  else if (__qWords.length) {
    const n = __qWords.shift();
    __qToast.innerHTML = '';
    const k = document.createElement('span'); k.className = 'k'; k.textContent = __qWord[n.kind]; __qToast.appendChild(k);
    __qToast.appendChild(document.createTextNode(n.kind === 'step' ? n.name + ': ' + n.text : n.name));
    if (n.kind === 'begun') { const j = document.createElement('span'); j.className = 'j'; j.textContent = 'J journal'; __qToast.appendChild(j); }
    __qToast.style.opacity = '1'; __qT = 3.2;
  }
  if (__qOpen && set.length) __qDraw();
}
window.__mojQuests = { view: () => __QV(EVENTS.quests, __busState.vars), open: () => __qShow(true), close: () => __qShow(false), isOpen: () => __qOpen };`;
}
