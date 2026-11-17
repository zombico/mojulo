/**
 * The PHONE channel: the hero's contacts as a screen, on mana-ui (gameworld/phone-ui.js lays it off the level's
 * mechanics). P opens it: the contacts met so far, and the thread of the one in focus (what they said as each job was
 * given, what is to do next, each step done, what was paid); the arrows move its focus, P or Esc shuts it; the world
 * is held while it is open, as a menu holds it. A thread is the bus's own flags (`window.__mojBus`) read in order, so
 * nothing is kept of its own; a line that is new since the phone was last open is counted, and the count shown by the
 * key (`unread()`: the guide's key bar reads it). Its look is the theme's, never its own. Emitted only for a page with
 * a phone: absent, not one byte.
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';
import { phoneThread, PHONE_UI } from '../../gameworld/phone-ui.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const I = (f) => ({ item: f }), K = (p) => ({ pick: p }), B = (p) => ({ bind: `phone.${p}` });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });

/** The spec it draws: the contacts beside the thread of the one in focus. */
export function phoneSpec(G) {
  return { screens: { phone: { use: 'screen', props: { title: G.title, layer: 'modal', place: 'full', legend: 'none' }, children: [
    { use: 'split', children: [
      { use: 'window', props: { title: 'Contacts' }, children: [{ use: 'list', id: 'contacts', props: { rows: B('contacts'), empty: 'No one yet. Someone with a job stands where the light is.', row: { use: 'stack', props: { dir: 'row', gap: 'tight', align: 'center' }, children: [{ use: 'icon', props: { name: 'person' } }, txt(I('name')), { use: 'badge', props: { value: I('state') } }] } } }] },
      { use: 'window', children: [{ use: 'stack', props: { gap: 'normal' }, children: [txt(K('contacts.name'), 'title'), { use: 'each', props: { rows: K('contacts.thread'), row: { use: 'stack', props: { gap: 'tight' }, children: [txt(I('who'), 'label'), txt(I('text'))] } } }] }] },
    ] },
    { use: 'legend', props: { rows: [{ action: 'back', label: { word: 'back' } }] } },
  ] } } };
}
const PHONE_CSS = '.moj-phone{position:absolute;inset:0;pointer-events:none;z-index:8}.moj-phone .mana-root{background:none}.moj-phone.open{z-index:34;pointer-events:auto}';

/** The page's side (inlined by toString): the runtime mounted, the threads read off the bus. */
export function phonePage(G, ui, spec, css, thread, W) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-phone'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { phone: { contacts: [] } };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  rt.glyphs({ keys: { back: 'P' } }); rt.input('keys');
  ui.mount(root, rt, { auto: true });
  let open = false, sig = '', seen = 0, lines = 0;
  function read() {
    const vars = window.__mojBus && window.__mojBus.state ? window.__mojBus.state.vars || {} : {};
    const met = G.contacts.filter((c) => Number(vars[c.met]) >= 1).map((c) => {
      const t = thread(c, vars, W), job = c.jobs.filter((j) => Number(vars[j.took]) >= 1).pop();
      return { id: c.id, name: c.name, state: job && !(job.done && Number(vars[job.done]) >= 1) ? job.name : '', thread: t.map((m) => ({ who: m.call ? m.who + ' · call' : m.who, text: m.text })) };
    });
    lines = met.reduce((n, c) => n + c.thread.length, 0);
    if (open) seen = lines;
    const next = JSON.stringify(met);
    if (next === sig) return;
    sig = next; S.phone = { contacts: met };
  }
  function show(on) {
    if (on === open) return;
    if (on && ((window.__mojScenes && window.__mojScenes.on()) || window.__mojMenuOpen || window.__mojManaOpen)) return;   // not over a scene or another menu
    open = on; root.classList.toggle('open', on);
    if (on) { sig = ''; read(); rt.open('phone'); } else rt.close();
    window.__mojManaOpen = on ? 'phone' : null; window.__mojMenuOpen = on; window.__mojFreeze = on;
  }
  const MOVE = { ArrowUp: 'up', ArrowDown: 'down', KeyW: 'up', KeyS: 'down' };
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
  if (!G || !Array.isArray(G.contacts) || !G.contacts.length) return '';
  const spec = phoneSpec(G);
  manaUi.readSpec(spec);
  return `
// THE PHONE (scene/channels/phone-channel.js): the contacts met and their threads, on P; laid by gameworld/phone-ui.js
window.__mojPhone = (${phonePage.toString()})(${json(G)}, ${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? PHONE_CSS : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n${PHONE_CSS}`)}, ${phoneThread.toString()}, ${json(PHONE_UI)});
`;
}
