/**
 * The QUEST channel: a level's quests (playscape/ui/quests.js) kept on the page as a journal over the bus's flags.
 * Emitted inside the events channel only when the events carry `quests`, so a world without them keeps every byte.
 *
 * J opens the journal (Esc or J closes it; the player's input is held while it is open, as a menu's is); a word shows
 * at the top as a quest begins (with the key), a step is done, a quest ends, from the flags set in this level (what was
 * carried in is already known, so it says nothing).
 */
import { questView, questNews } from '../../playscape/ui/quests.js';
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { withIdioms } from '../../../mana-ui/idioms.js';

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

// ON MANA-UI (`mana`: the theme the level's HUD wears, a level with a mana HUD): the same journal and the same words,
// drawn by the game UI runtime in the game's look: the journal its `quest-log` screen (the quests beside the one in
// focus, its steps ticked), the words its `quest-toasts` (one at a time, by weight: a quest ended over a step). J opens
// and closes it, the arrows move its focus, Esc closes; the world is held while it is open, as before.
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
export const questManaSpec = () => withIdioms({
  screens: { journal: { use: 'quest-log', props: { title: 'Journal', quests: { bind: 'quests' } } } },
  hud: { use: 'hud', children: [{ use: 'quest-toasts', props: { toasts: { bind: 'questToasts' } } }] },
});
const QM_CSS = '.moj-qm{position:absolute;inset:0;pointer-events:none;z-index:33}.moj-qm .mana-root{background:none}.moj-qm.open{pointer-events:auto}';
/** The page's side (inlined by toString): the runtime mounted over the scene, its state the page writes. */
export function questManaPage(ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-qm'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { quests: [], questToasts: [] };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  // (its legend says the keys that work it)
  rt.glyphs({ keys: { back: 'J', accept: 'Enter', up: '↑', down: '↓' } }); rt.input('keys');
  ui.mount(root, rt, { auto: true });
  let open = false, nth = 0;
  const WORD = { begun: 'New quest', step: 'Done', done: 'Quest complete' }, WEIGHT = { begun: 'normal', step: 'minor', done: 'major' };
  return {
    state: S, rt,
    set(view) { const rows = view.map((q) => ({ id: q.id, name: q.name, state: q.state === 'done' ? 'done' : 'active', about: '', steps: q.steps.map((x) => ({ text: x.text, done: !!x.done })) })); if (JSON.stringify(rows) !== JSON.stringify(S.quests)) S.quests = rows; },
    say(n) { S.questToasts = S.questToasts.concat([{ id: 'q' + (++nth), text: n.kind === 'step' ? n.name + ': ' + n.text : n.name, sub: WORD[n.kind] + (n.kind === 'begun' ? ' · J journal' : ''), weight: WEIGHT[n.kind] }]).slice(-6); },
    show(on) { if (on === open) return; open = on; root.classList.toggle('open', on); if (on) rt.open('journal'); else rt.close(); },
    isOpen: () => open,
    press(action) { rt.press(action); },
  };
}

export function questScript({ mana = null, shared = null } = {}) {
  if (mana) {
    const spec = questManaSpec();
    manaUi.readSpec(spec);
    return `
// QUESTS on mana-ui: the journal (playscape/ui/quests.js) its quest-log screen, its words its quest toasts; J to open
const __QV = ${questView.toString()};
const __QN = ${questNews.toString()};
const __qm = (${questManaPage.toString()})(${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? QM_CSS : `${manaCss()}\n${themeCss(mana === true ? 'greybox' : mana)}\n${QM_CSS}`)});
let __qSeen = 0;
function __qShow(open) {
  if (open && ((window.__mojScenes && window.__mojScenes.on()) || window.__mojManaOpen)) return;   // not over a scene, nor over another mana screen (the map, the bag)
  if (open) __qm.set(__QV(EVENTS.quests, __busState.vars));
  __qm.show(open);
  window.__mojManaOpen = open ? 'journal' : null; window.__mojMenuOpen = open; window.__mojFreeze = open;   // the journal freezes the world as a menu does
}
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'KeyJ' && !ev.repeat) { ev.preventDefault(); __qShow(!__qm.isOpen()); }
  else if (__qm.isOpen() && ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); __qShow(false); }
  else if (__qm.isOpen() && (ev.code === 'ArrowUp' || ev.code === 'KeyW')) { ev.preventDefault(); ev.stopImmediatePropagation(); __qm.press('up'); }
  else if (__qm.isOpen() && (ev.code === 'ArrowDown' || ev.code === 'KeyS')) { ev.preventDefault(); ev.stopImmediatePropagation(); __qm.press('down'); }
}, true);
function __stepQuests() {
  const set = [];
  for (let i = __qSeen; i < __busState.log.length; i++) { const ev = __busState.log[i]; if (ev && typeof ev.type === 'string' && ev.type.indexOf('flag:') === 0) set.push(ev.type.slice(5)); }
  __qSeen = __busState.log.length;
  for (const n of __QN(EVENTS.quests, set)) __qm.say(n);
  if (set.length) __qm.set(__QV(EVENTS.quests, __busState.vars));
}
window.__mojQuests = { view: () => __QV(EVENTS.quests, __busState.vars), open: () => __qShow(true), close: () => __qShow(false), isOpen: () => __qm.isOpen(), mana: __qm };`;
  }
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
  window.__mojMenuOpen = open; window.__mojFreeze = open;   // the journal freezes the world as a menu does
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
