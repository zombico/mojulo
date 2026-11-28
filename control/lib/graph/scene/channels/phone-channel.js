/**
 * The PHONE channel: the hero's phone as a screen, on mana-ui (gameworld/phone-ui.js lays it off the level's
 * mechanics). P opens it. A tab for each APP (TaskFu: subscribed to with Enter, then its tasks, each taken with Enter:
 * an event on the level's bus, so a task is a quest with its reward and no one is met), turned with Q and E. The
 * FACTION the hero is with has its BOARD as a tab: its standing, and what it posts at that standing, taken the same
 * way. The contacts' tab: the contacts met so far, and the thread of the one in focus (what they said as each job was
 * given, what is to do next, each step done, what was paid); the arrows move its focus, P or Esc shuts it; the world
 * is held while it is open, as a menu holds it. A thread is the bus's own flags (`window.__mojBus`) read in order, so
 * nothing is kept of its own; a line that is new since the phone was last open is counted, and the count shown by the
 * key (`unread()`: the guide's key bar reads it). Its look is the theme's, never its own. Emitted only for a page with
 * a phone: absent, not one byte.
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { phoneThread, phoneTasks, phoneBoard, PHONE_UI } from '../../gameworld/phone-ui.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const I = (f) => ({ item: f }), K = (p) => ({ pick: p }), B = (p) => ({ bind: `phone.${p}` });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });

/** The spec it draws: a tab for the contacts and one for each app, each the same page: its rows over what the one in
 * focus says (a contact's thread; a task's ask, its pay and its next step). Drawn as a HANDSET, not a screen: a phone held
 * at the bottom right with the city still there round it (PHONE_CSS: its body, its bar of the hour and the signal, its
 * apps as the tabs along its top), the way an open-world game hands the player a phone. */
export function phoneSpec(G) {
  return { screens: { phone: { use: 'screen', props: { title: G.title, layer: 'modal', place: 'right', legend: 'none' }, children: [
    { use: 'window', children: [{ use: 'tabs', props: { pages: B('pages'), page: { use: 'stack', props: { gap: 'normal' }, children: [
      { use: 'list', id: 'rows', props: { rows: I('rows'), empty: I('empty'), row: { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [{ use: 'icon', props: { name: I('icon') } }, txt(I('name')), { use: 'badge', props: { value: I('state') } }] } }, on: { accept: { emit: 'pick', row: I('id') } } },
      { use: 'stack', props: { gap: 'tight' }, children: [txt(K('rows.name'), 'heading'), { use: 'each', props: { rows: K('rows.lines'), row: { use: 'stack', props: { gap: 'tight' }, children: [txt(I('who'), 'caption'), txt(I('text'))] } } }] },
    ] } } }] },
    { use: 'legend', props: { rows: [...((G.apps ?? []).length || (G.factions ?? []).length ? [{ actions: ['tabPrev', 'tabNext'], label: { word: 'tabs' } }, { action: 'accept', label: 'Take' }] : []), { action: 'back', label: { word: 'back' } }] } },
  ] } } };
}
const PHONE_CSS = '.moj-phone{position:absolute;inset:0;pointer-events:none;z-index:8}.moj-phone .mana-root{background:none}.moj-phone.open{z-index:34;pointer-events:auto}'
  // THE HANDSET: the city held but not veiled; a phone's body at the bottom right, rounded, its glass the theme's panel,
  // the hour and the signal along its top, its name under them, its apps (the tabs) a row of chips, its rows and the
  // thread scrolling inside it; its keys said under it
  + '.moj-phone .mana-screen[data-place=right]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:linear-gradient(90deg,transparent 55%,rgba(0,0,0,.35))!important;justify-content:flex-end!important;padding-bottom:calc(var(--mana-safe) * 100cqh + 56px)!important}'
  + '.moj-phone .mana-screen[data-place=right]>.mana-window{position:relative;width:min(400px,86cqw)!important;min-width:0!important;height:min(640px,74cqh);overflow:hidden;border-radius:36px!important;clip-path:none!important;padding:46px 18px 18px!important;box-shadow:0 0 0 3px #1c1f24,0 0 0 5px rgba(255,255,255,.12),0 24px 60px rgba(0,0,0,.55)!important;border:0!important}'
  + '.moj-phone .mana-screen[data-place=right]>.mana-window::before{content:"\\25CF\\25CF\\25CF\\25CF  5G";position:absolute;right:22px;top:14px;font:700 11px/1 ui-monospace,monospace;letter-spacing:1px;opacity:.75}'
  + '.moj-phone .mana-screen[data-place=right]>.mana-window::after{content:"";position:absolute;left:50%;top:12px;width:92px;height:22px;transform:translateX(-50%);border-radius:12px;background:#000}'
  + '.moj-phone .mana-screen[data-place=right]>.mana-title{position:absolute;right:calc(var(--mana-safe) * 100cqw + 30px);bottom:calc(var(--mana-safe) * 100cqh + 56px + min(640px,74cqh) - 40px);z-index:2;font-size:13px!important;letter-spacing:2px;opacity:.8}'
  + '.moj-phone .mana-screen[data-place=right]>.mana-title::before{content:none!important}'
  + '.moj-phone .mana-tabs .mana-list{max-height:min(250px,30cqh);overflow:auto}'
  // (a row new to the list, a task come in or a step done, slides in from the side in the theme's motion: mana-ui's own)
  + '.moj-phone .mana-tabs .mana-list [data-fresh=yes]{animation:mana-slide calc(var(--mana-dur) * 1.6) var(--mana-ease) both}'
  + '.moj-phone .mana-screen[data-place=right]>.mana-legend{position:absolute;right:calc(var(--mana-safe) * 100cqw);bottom:calc(var(--mana-safe) * 100cqh)}';

/** The page's side (inlined by toString): the runtime mounted, the tabs read off the bus. */
export function phonePage(G, ui, spec, css, thread, tasks, board, W) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-phone'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { phone: { pages: [] } }, apps = G.apps || [];
  // (a row taken: an app subscribed to, a task taken; each an event on the level's bus, game/errand-mechanics.js lowerTask)
  function act(e) {
    if (!e || e.emit !== 'pick' || typeof e.row !== 'string' || !window.__mojBus || !window.__mojBus.press) return;
    if (e.row.indexOf('sub:') === 0) window.__mojBus.press('app:sub:' + e.row.slice(4));
    else if (e.row.indexOf('side:') === 0) window.__mojBus.press('app:leave:' + e.row.slice(5));
    else if (e.row.indexOf('task:') === 0) window.__mojBus.press('app:take:' + e.row.slice(5));
  }
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: act, now: () => performance.now() / 1000 });
  rt.glyphs({ keys: { back: 'P', tabPrev: 'Q', tabNext: 'E', accept: 'Enter' } }); rt.input('keys');
  ui.mount(root, rt, { auto: true });
  let open = false, sig = '', seen = 0, lines = 0, metN = 0;
  function read() {
    const vars = window.__mojBus && window.__mojBus.state ? window.__mojBus.state.vars || {} : {};
    const met = G.contacts.filter((c) => Number(vars[c.met]) >= 1).map((c) => {
      const t = thread(c, vars, W), job = c.jobs.filter((j) => Number(vars[j.took]) >= 1).pop();
      return { id: 'c:' + c.id, icon: 'person', name: c.name, state: job && !(job.done && Number(vars[job.done]) >= 1) ? job.name : '', lines: t.map((m) => ({ who: m.call ? m.who + ' · call' : m.who, text: m.text })) };
    });
    const pages = apps.map((a) => ({ label: a.name, empty: '', rows: tasks(a, vars, W).map((r) => Object.assign({ icon: r.id.indexOf('sub:') === 0 ? 'star' : 'box' }, r)) }));
    // (the board of the faction the hero is with, after the apps: one at a time)
    (G.factions || []).forEach((f) => { if (Number(vars[f.in]) >= 1) pages.push({ label: f.name, empty: '', rows: board(f, vars, W).map((r) => Object.assign({ icon: r.id.indexOf('side:') === 0 ? 'star' : 'box' }, r)) }); });
    // (the contacts' tab where the level has someone to meet; the apps' after it)
    if (G.contacts.length) pages.unshift({ label: 'Contacts', empty: 'No one yet. Someone with a job stands where the light is.', rows: met });
    metN = met.length;
    lines = pages.reduce((n, pg) => n + pg.rows.reduce((k, r) => k + r.lines.length, 0), 0);
    if (open) seen = lines;
    const next = JSON.stringify(pages);
    if (next === sig) return;
    sig = next; S.phone = { pages: pages };
  }
  function show(on) {
    if (on === open) return;
    if (on && ((window.__mojScenes && window.__mojScenes.on()) || window.__mojMenuOpen || window.__mojManaOpen)) return;   // not over a scene or another menu
    open = on; root.classList.toggle('open', on);
    // (with no one met yet it opens on its first app: the tab with something to take)
    if (on) { sig = ''; read(); rt.open('phone'); if (G.contacts.length && apps.length && !metN) rt.press('tabNext'); } else rt.close();
    window.__mojManaOpen = on ? 'phone' : null; window.__mojMenuOpen = on; window.__mojFreeze = on;
  }
  const MOVE = { ArrowUp: 'up', ArrowDown: 'down', KeyW: 'up', KeyS: 'down', BracketRight: 'tabNext', BracketLeft: 'tabPrev', KeyE: 'tabNext', KeyQ: 'tabPrev', Enter: 'accept', Space: 'accept' };
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyP' && !ev.repeat) { ev.preventDefault(); show(!open); return; }
    if (!open) return;
    if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); show(false); }
    else if (MOVE[ev.code]) { ev.preventDefault(); ev.stopImmediatePropagation(); rt.press(MOVE[ev.code]); }
  }, true);
  let n = 0;
  (function tick() { requestAnimationFrame(tick); if (open || (n = (n + 1) % 20) === 0) read(); })();
  return { state: S, rt, open: () => show(true), close: () => show(false), isOpen: () => open, unread: () => Math.max(0, lines - seen), read: () => { sig = ''; read(); return S.phone; } };
}

/** The page's script ('' for none). `theme`: the look the level's HUD wears. */
export function phoneScript(G, theme = null, { shared = null } = {}) {
  if (!G || !Array.isArray(G.contacts) || !(G.contacts.length || (G.apps ?? []).length || (G.factions ?? []).length)) return '';
  const spec = phoneSpec(G);
  manaUi.readSpec(spec);
  return `
// THE PHONE (scene/channels/phone-channel.js): the contacts met and their threads, on P; laid by gameworld/phone-ui.js
window.__mojPhone = (${phonePage.toString()})(${json(G)}, ${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? PHONE_CSS : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n${PHONE_CSS}`)}, ${phoneThread.toString()}, ${phoneTasks.toString()}, ${phoneBoard.toString()}, ${json(PHONE_UI)});
`;
}
