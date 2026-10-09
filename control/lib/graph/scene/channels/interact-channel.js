import { safeJson } from '../emit-util.js';
import { menuHtml } from '../../playscape/ui/menus.js';
import { buildControlsKernel } from '../../controls/controls-kernel.js';
import { SCHEMES } from '../../controls/schemes.js';
import { DEVICES } from '../../controls/devices.js';

/**
 * interact-channel — the page's side of a play block's interaction, riding the events channel (its bus state, input
 * queue and frame step): the MENUS overlay (playscape/ui/menus.js) and the REACH of usable places (a cue's
 * `when: { use: <place> }`). Each block is emitted only when the world has menus / a usable place.
 *
 *   MENU_CSS, REACH_CSS     the overlays' sheets (the board's specimens use MENU_CSS too)
 *   menuScript(menus)       the open menu (the last whose ui-menu-<id> var is 1), drawn from the board's own markup,
 *                           driven by the `menu` control scheme: keys (codeMap, plus the pilot's interact as accept) and
 *                           the gamepad (per printed layout: confirm / cancel where the pad puts them). While a menu is
 *                           up, window.__mojMenuOpen tells the pilot runtime to take no input.
 *   reachScript(uses)       which usable zone the walker stands in (window.__mojReach), the prompt beside the live key,
 *                           and the interact press (__mojCtrl.interacts) turned into use-<place> on the bus
 */

// A play block's menus over the play: centred, solid, taking the pointer; the guide's register and border dress them
// through the same .moj-w rules as every widget.
export const MENU_CSS = [
  '.moj-menu-hud{display:flex;align-items:center;justify-content:center;z-index:13}',
  '.moj-w-menu{white-space:normal;display:flex;flex-direction:column;gap:7px;width:300px;text-align:left;font-weight:500;padding:12px 14px;pointer-events:auto;background:var(--moj-panel)}',
  '.moj-w-menu .pu-mt{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.75}.moj-w-menu .pu-who{font-weight:700}',
  '.moj-w-menu .pu-ch{display:block;padding:1px 0 1px 14px;position:relative;cursor:pointer}.moj-w-menu .pu-ch.on{color:var(--moj-accent)}',
  '.moj-w-menu .pu-ch.on::before{content:"▸";position:absolute;left:0}.moj-w-menu .pu-foot{display:flex;gap:14px;font-size:12px;opacity:.75;border-top:1px solid var(--moj-line);padding-top:5px}',
  '.moj-w-menu .pu-tab{border-collapse:collapse;font-size:13px}.moj-w-menu .pu-tab td{padding:1px 8px 1px 0}.moj-w-menu .pu-num{text-align:right;font-variant-numeric:tabular-nums}',
  '.moj-w-menu .pu-map{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}.moj-w-menu .pu-map i{height:22px;border:1px solid var(--moj-line)}.moj-w-menu .pu-map i.here{background:var(--moj-accent)}',
].join('');

// the reach prompt: low centre, above the legend row; the HUD tokens when the world has them, a plain plate when not
export const REACH_CSS = '.moj-reach{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);z-index:12;pointer-events:none;display:none;padding:5px 12px;font:600 13px var(--moj-font,system-ui,sans-serif);color:var(--moj-ink,#e9e4da);background:var(--moj-panel,rgba(10,14,22,.82));border:1px solid var(--moj-line,#3a4252);border-radius:6px}.moj-reach b{display:inline-block;min-width:18px;margin-right:8px;padding:0 5px;border:1px solid currentColor;border-radius:4px;text-align:center}';

const K = buildControlsKernel();
const LAYOUTS = Object.keys(DEVICES.gamepad.layouts);

// the menu scheme, resolved at build: key code → action (the pilot's interact accepts too: the key that opened a
// menu picks in it), and per pad layout the buttons and half axes → action
function menuControls() {
  const keys = K.codeMap(K.resolve(SCHEMES.menu, { keyboard: DEVICES.keyboard }), 'keyboard');
  const it = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad });
  for (const c of it.bind.keyboard.interact) if (!keys[c]) keys[c] = 'accept';
  const pad = {};
  for (const L of LAYOUTS) {
    const B = K.resolve(SCHEMES.menu, { gamepad: DEVICES.gamepad }, null, { layout: L }).bind.gamepad, P = { b: {}, a: [] };
    const put = (c, id) => {
      const m = /^([a-zA-Z]+)([+-])$/.exec(c);
      if (m && DEVICES.gamepad.axes[m[1]] !== undefined) P.a.push([DEVICES.gamepad.axes[m[1]], m[2] === '-' ? -1 : 1, id]);
      else if (DEVICES.gamepad.buttons[c] !== undefined && P.b[DEVICES.gamepad.buttons[c]] === undefined) P.b[DEVICES.gamepad.buttons[c]] = id;
    };
    for (const id of Object.keys(B)) for (const c of B[id]) put(c, id);
    for (const c of K.resolve(SCHEMES.pilot, { gamepad: DEVICES.gamepad }, null, { layout: L }).bind.gamepad.interact) put(c, 'accept');
    pad[L] = P;
  }
  return { keys, pad };
}

export function menuScript(menus) {
  const { keys, pad } = menuControls();
  return `
const __MENUS = ${safeJson(menus)};
${menuHtml.toString()}
// the menu control scheme (controls/schemes.js), resolved: key code → action; per pad layout, button / half axis → action
const __MKEYS = ${safeJson(keys)};
const __MPAD = ${safeJson(pad)};
const __mPadLayout = ${K.padLayout.toString()};
const __menuHud = document.createElement('div'); __menuHud.className = 'moj-hud moj-menu-hud'; wrap.appendChild(__menuHud);
let __menuOpen = null, __menuF = 0, __menuPg = 0, __menuShown = '', __mpPrev = {};
// only an actual change touches the DOM: a per-frame rewrite would swap the choice under the pointer between press and release, and no click would land
function __menuDraw() { const h = __menuOpen ? menuHtml(__menuOpen, __menuF, __menuPg).replace(/\\{([^}]+)\\}/g, (_, k) => String(__busState.vars[k] != null ? __busState.vars[k] : 0)) : ''; if (h !== __menuShown) { __menuShown = h; __menuHud.innerHTML = h; } }
function __menuCount(m) { return m.picks ? m.picks.length : m.kind === 'save' ? Math.min(m.slots, 4) : m.kind === 'shop' ? m.stock.length : m.kind === 'chest' ? m.holds.length : m.kind === 'list' ? m.rows.length : 0; }
function __menuClose() { if (__menuOpen) __inputQueue.push({ type: 'menu-close:' + __menuOpen.id }); }
function __menuAct() {
  const m = __menuOpen; if (!m) return;
  if (m.kind === 'read' && __menuPg + 1 < m.pages.length) { __menuPg++; __menuDraw(); return; }
  if (m.picks && m.picks.length) __inputQueue.push({ type: 'menu-pick:' + m.id + ':' + __menuF }); else __menuClose();
}
function __menuDo(a) {
  const n = __menuCount(__menuOpen);
  if ((a === 'up' || a === 'left') && n) { __menuF = (__menuF + n - 1) % n; __menuDraw(); }
  else if ((a === 'down' || a === 'right') && n) { __menuF = (__menuF + 1) % n; __menuDraw(); }
  else if (a === 'accept') __menuAct();
  else if (a === 'back') __menuClose();
}
window.addEventListener('keydown', (ev) => {
  if (!__menuOpen) return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  if (ev.repeat) return;
  const a = __MKEYS[ev.code]; if (a) __menuDo(a);
}, true);
__menuHud.addEventListener('click', (ev) => { const p = ev.target.closest('[data-pick]'); if (!p || !__menuOpen) return; __menuF = Number(p.getAttribute('data-pick')); __menuAct(); });
// the pad: the first connected one, read in its own printed layout; an action fires on the press edge
function __menuPadNow() {
  const ps = navigator.getGamepads ? navigator.getGamepads() : [];
  let g = null; for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { g = ps[i]; break; }
  const now = {}; if (!g) return now;
  const P = __MPAD[__mPadLayout(g.id)] || __MPAD.xbox;
  for (const i in P.b) { const b = g.buttons[i]; if (b && (b.pressed || b.value > 0.5)) now[P.b[i]] = 1; }
  for (const [ax, s, a] of P.a) if ((g.axes[ax] || 0) * s > 0.6) now[a] = 1;
  return now;
}
function __syncMenus() {
  let open = null;
  for (const m of __MENUS) if (__busState.vars[m.var] === 1) open = m;
  if (open !== __menuOpen) { __menuOpen = open; __menuF = 0; __menuPg = 0; __mpPrev = __menuPadNow(); }   // what is held as it opens doesn't act in it
  else if (open) { const now = __menuPadNow(); for (const a in now) if (!__mpPrev[a]) __menuDo(a); __mpPrev = now; }
  window.__mojMenuOpen = !!__menuOpen;
  __menuDraw();
}
window.__mojMenus = { open: () => (__menuOpen ? __menuOpen.id : null), act: __menuAct, close: __menuClose, do: __menuDo };`;
}

/** The usable places of a world's zone sources: zone → { id, prompt }. */
export const usesOf = (sources) => Object.fromEntries((sources || []).filter((s) => s && s.type === 'zone' && s.use).map((s) => [s.zone, { id: s.use, prompt: s.prompt || '' }]));

export function reachScript(uses) {
  return `
// REACH: the usable places (a cue's use) the walker stands in, the last entered on top; the prompt shows the live
// interact key (__mojCtrl.label) and the place's word; the interact press sends use-<place> into the bus
const __USES = ${safeJson(uses)};
const __reachEl = document.createElement('div'); __reachEl.className = 'moj-reach'; wrap.appendChild(__reachEl);
const __reachSt = document.createElement('style'); __reachSt.textContent = ${JSON.stringify(REACH_CSS)}; document.head.appendChild(__reachSt);
let __reach = [], __itPrev = null, __reachShown = '';
window.__mojUses = true;
function __stepReach(zoneEvents, incoming) {
  for (const ev of zoneEvents) {
    if (!__USES[ev.zone]) continue;
    __reach = __reach.filter((z) => z !== ev.zone);
    if (ev.type === 'enter') __reach.push(ev.zone);
  }
  const top = __reach.length ? __USES[__reach[__reach.length - 1]] : null;
  window.__mojReach = top ? top.id : null;
  const n = window.__mojCtrl && window.__mojCtrl.interacts ? window.__mojCtrl.interacts() : 0;
  if (__itPrev !== null && n !== __itPrev && top && !window.__mojMenuOpen) incoming.push({ type: 'use-' + top.id });
  __itPrev = n;
  const key = top && window.__mojCtrl && window.__mojCtrl.label ? window.__mojCtrl.label('interact') : '';
  const h = top && !window.__mojMenuOpen ? '<b>' + key.replace(/[<&]/g, '') + '</b>' + (top.prompt || 'use').replace(/[<&]/g, '') : '';
  if (h !== __reachShown) { __reachShown = h; __reachEl.innerHTML = h; __reachEl.style.display = h ? 'block' : 'none'; }
}`;
}
