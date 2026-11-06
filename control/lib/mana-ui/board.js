/**
 * MANA-UI's WIREFRAME BOARD — every idiom drawn in greybox on the sample state, one 16:9 frame each, live: click a frame
 * to drive it (arrows or WASD, Enter, Escape, [ ] for tabs; a second seat on I J K L, U to pick, O for back), and the
 * effects it emits are logged under it. The HUD frames layer the in-game parts over a play field, with a pause menu
 * that opens on Enter. The phone's frames (390 × 844) are driven by a finger: tap, drag a slider, swipe a carousel or
 * the tabs; their HUD's buttons are taps. A switcher lays each theme (theme.js) over the same frames, with what its colours read like
 * (themeAdvice): the greybox first, the styles a layer over it. One self-contained page: the kernel inlined, no
 * request leaves it.
 *
 *   BOARD_HUDS            the HUD frames: name → the HUD idioms it layers
 *   manaUiBoard({ state?, title?, theme?, themes?, host?, glyphs? })  → the page (themes: name → theme, the presets
 *                         by default; host: the controls layer's input owner, { source, controls: { keys, pad,
 *                         padLayoutSource } } from controls/mana-controls.js (manaHostSource, manaControls): then the live
 *                         frame is driven through the control schemes, pads too; glyphs: what its legends print. With
 *                         no host the board drives its frames with PREVIEW_KEYS, a stand-in of its own, never mana-ui's)
 *   PREVIEW_KEYS          the stand-in: arrows / WASD, Enter, Escape, [ ] (the menu scheme's defaults, for a preview)
 */
import { manaUiSource, manaUi } from './kernel.js';
import { manaCss, FRAME_CSS } from './css.js';
import { THEMES, themeCss, themeAdvice, readTheme } from './theme.js';
import { IDIOMS, SCREEN_IDIOMS, withIdioms } from './idioms.js';
import { SAMPLE_STATE } from './samples.js';

// a phone's frames (390 × 844, driven by a finger): its HUD and the screens a phone game needs most
export const BOARD_PHONE = Object.freeze({ hud: ['vitals', 'minimap-corner', 'phone-buttons', 'ability-bar', 'touch-controls'], screens: ['action-sheet', 'options-screen', 'inventory-screen', 'party-screen', 'character-select', 'match-results'] });
export const BOARD_HUDS = Object.freeze({
  'action HUD': ['vitals', 'objective-tracker', 'minimap-corner', 'ammo-counter', 'interact-prompt', 'event-feed', 'crosshair', 'enemy-plates', 'damage-numbers'],
  'boss fight HUD': ['boss-bar', 'party-strip', 'target-frame', 'score-timer', 'moment-banner', 'enemy-plates'],
  'explore HUD': ['vitals', 'compass-strip', 'minimap-corner', 'objective-tracker', 'interact-prompt'],
  'fighting HUD': ['versus-bars', 'super-meters', 'combo-counter'],
  'racing HUD': ['race-standing', 'speedometer', 'minimap-corner', 'offscreen-markers'],
  'shooter HUD': ['crosshair', 'damage-direction', 'offscreen-markers', 'lock-on', 'ammo-counter', 'event-feed', 'score-timer'],
  'action RPG HUD': ['vitals', 'ability-bar', 'enemy-plates', 'damage-numbers', 'quest-toasts', 'world-labels'],
  'survival HUD': ['vitals', 'hotbar', 'world-labels', 'interact-prompt'],
  'strategy HUD': ['resource-bar', 'unit-card', 'combat-forecast', 'minimap-corner'],
  'tower defence HUD': ['wave-status', 'world-labels', 'event-feed'],
  'match broadcast': ['score-bug', 'lower-third', 'event-feed'],
  'cutscene': ['cinema-bars', 'subtitles'],
  'stealth HUD': ['stealth-meter', 'enemy-plates', 'minimap-corner', 'interact-prompt'],
});

// a screen idiom's board section, by its shelf (the HUD frames come first, as 'In game')
const GROUPS = { front: 'Front and menus', rpg: 'RPG', live: 'In play' };
// a preview's stand-in for the controls layer: the menu scheme's default keys, used only when no host is given
export const PREVIEW_KEYS = Object.freeze({ ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Enter: 'accept', Space: 'accept', Escape: 'back', Backspace: 'back', BracketRight: 'tabNext', BracketLeft: 'tabPrev' });
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const use = (id) => ({ use: id, props: IDIOMS[id].example });

/** The frames: each { name, about, reads, emits, spec } (a spec the kernel reads, with the idioms among its defs). */
export function boardFrames() {
  const frames = [];
  for (const [name, parts] of Object.entries(BOARD_HUDS)) {
    frames.push({ name, group: 'In game', about: parts.join(' · '), reads: 'the sample state', emits: 'Enter opens the pause menu over it', spec: withIdioms({ hud: { use: 'hud', children: parts.map(use) }, screens: { pause: use('pause-menu') } }), hud: true });
  }
  for (const id of SCREEN_IDIOMS) {
    const I = IDIOMS[id];
    frames.push({ name: id, group: GROUPS[I.shelf] || 'Front and menus', about: I.about, reads: I.reads, emits: I.emits, spec: withIdioms({ screens: { s: use(id) }, start: 's' }) });
  }
  frames.push({ name: 'HUD · phone', group: 'Phone', device: 'phone', input: 'touch', about: BOARD_PHONE.hud.join(' · '), reads: 'the sample state', emits: 'tap ❚❚ for the pause (an action sheet)', spec: withIdioms({ hud: { use: 'hud', children: BOARD_PHONE.hud.map(use) }, screens: { pause: use('action-sheet') } }), hud: true });
  for (const id of BOARD_PHONE.screens) frames.push({ name: `${id} · phone`, group: 'Phone', device: 'phone', input: 'touch', about: IDIOMS[id].about, reads: IDIOMS[id].reads, emits: IDIOMS[id].emits, spec: withIdioms({ screens: { s: use(id) }, start: 's' }) });
  for (const f of frames) manaUi.readSpec(f.spec);
  return frames;
}

/** The board page. */
export function manaUiBoard({ state = SAMPLE_STATE, title = 'mana-ui · board', theme = 'greybox', themes = THEMES, host = null, glyphs = null } = {}) {
  const frames = boardFrames(), groups = [...new Set(frames.map((f) => f.group))], scope = '.mana-stage .mana-root';
  const looks = Object.entries(themes).map(([id, t]) => ({ id, name: readTheme(t).name, css: themeCss(t, scope), advice: themeAdvice(t).map((a) => `${a.law}: ${a.advice}`) }));
  if (!looks.some((l) => l.id === theme)) throw new Error(`board theme '${theme}' is one of: ${looks.map((l) => l.id).join(', ')}`);
  const body = groups.map((g) => `<h2 class="sec">${esc(g)}</h2><div class="grid">${frames.map((f, i) => (f.group !== g ? '' : `<figure><div class="mana-frame"${f.device ? ` data-device="${f.device}"` : ''}><div class="mana-stage"${f.device ? ` data-device="${f.device}"` : ''} id="f${i}"></div></div><figcaption><b>${esc(f.name)}</b> ${esc(f.about)}<br><span>reads</span> ${esc(f.reads)}<br><span>emits</span> ${esc(f.emits)}<pre id="log${i}"></pre></figcaption></figure>`)).join('')}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
html,body{margin:0;background:#fff;color:#111;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:20px 24px 4px}h1{margin:0;font-size:20px}header p{margin:4px 0 0;color:#555;max-width:900px}
header label{font-size:12px;margin-right:6px}header select{font:13px system-ui;padding:2px 6px}#advice{font-size:11px;color:#8a4b00;margin-top:4px;white-space:pre-wrap}
h2.sec{margin:22px 24px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;border-bottom:1px solid #111;padding-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:22px;padding:0 24px 12px}
figure{margin:0}figcaption{margin-top:6px;font-size:12px;color:#333}figcaption span{display:inline-block;width:44px;color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
pre{margin:4px 0 0;font:10px/1.3 ui-monospace,monospace;color:#555;white-space:pre-wrap;min-height:13px}
${manaCss('.mana-stage .mana-root')}
${FRAME_CSS}
</style><style id="mana-theme"></style></head><body><header><h1>${esc(title)}</h1><p>Every idiom over one sample state: the structure, the data it reads and the effects it emits, in greybox; a theme is a layer over it. Click a frame to drive it: arrows or WASD, Enter, Escape, [ and ] for tabs; a second seat on I J K L, U, O.</p>
<p><label for="look">Theme</label><select id="look">${looks.map((l) => `<option value="${esc(l.id)}"${l.id === theme ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select></p><div id="advice"></div></header>${body}
<script>
const manaUi = ${manaUiSource()};
const DEFS = ${json(frames[0].spec.defs)};
const FRAMES = ${json(frames.map((f) => ({ spec: { ...f.spec, defs: undefined }, hud: !!f.hud, input: f.input || null })))};
const STATE = ${json(state)};
const LOOKS = ${json(looks)};
const look = (id) => { const L = LOOKS.find((x) => x.id === id) || LOOKS[0]; document.getElementById('mana-theme').textContent = L.css; document.getElementById('advice').textContent = L.advice.join('\\n'); };
document.getElementById('look').addEventListener('change', (ev) => look(ev.target.value));
look(${json(theme)});
// the page's input owner: the controls layer's host when given, else the preview's stand-in keys
const HOST = ${host ? `{ api: ${host.source}, controls: { keys: ${json(host.controls.keys)}, pad: ${json(host.controls.pad)}, padLayout: (${host.controls.padLayoutSource}) } }` : 'null'};
const PREVIEW = ${json(PREVIEW_KEYS)};
const GLYPHS = ${json(glyphs)};
const runs = [];
let live = null;
FRAMES.forEach((F, i) => {
  const S = JSON.parse(JSON.stringify(STATE)), log = [], el = document.getElementById('f' + i), out = document.getElementById('log' + i);
  const host = {
    read: (p) => manaUi.readPath(S, p),
    act: (e, from) => {
      if (typeof e.set === 'string') { const k = e.set.split('.'), last = k.pop(); let o = S; for (const x of k) o = o[x] = o[x] || {}; o[last] = e.to; }
      log.push((from.seat ? 'P' + (from.seat + 1) + ' ' : '') + JSON.stringify(e)); out.textContent = log.slice(-3).join('\\n');
    },
  };
  const rt = manaUi.runtime({ ...F.spec, defs: DEFS }, host);
  if (F.input) rt.input(F.input);
  if (GLYPHS) rt.glyphs(GLYPHS);
  const m = manaUi.mount(el, rt);
  const h = HOST ? HOST.api.connect(rt, m, { ...HOST.controls, listen: false, loop: false }) : null;
  runs.push({ rt, m, h, F });
  // the click that makes a frame live only does that: it never also presses what it lands on
  el.parentNode.addEventListener('pointerdown', (ev) => {
    if (live === i) return;
    ev.stopPropagation();
    if (live !== null) document.getElementById('f' + live).parentNode.dataset.live = 'no';
    live = i; el.parentNode.dataset.live = 'yes';
  }, true);
});
const P2 = { KeyI: 'up', KeyK: 'down', KeyJ: 'left', KeyL: 'right', KeyU: 'accept', KeyO: 'back' };
window.addEventListener('keydown', (ev) => {
  if (live === null) return;
  const R = runs[live];
  if (R.F.hud && !R.rt.state().screen && (ev.code === 'Enter' || ev.code === 'Escape')) { ev.preventDefault(); R.rt.open('pause'); R.m.paint(); return; }
  if (P2[ev.code]) { ev.preventDefault(); R.rt.press(P2[ev.code], 1); R.m.paint(); return; }
  if (R.h) { R.h.key(ev); return; }
  const a = PREVIEW[ev.code];
  if (a && R.rt.state().screen) { ev.preventDefault(); R.rt.input('keys'); R.rt.press(a); R.m.paint(); }
});
// each frame a 1280×720 screen, scaled to its box
const fit = () => document.querySelectorAll('.mana-stage').forEach((st) => { st.style.transform = 'scale(' + st.parentNode.clientWidth / st.offsetWidth + ')'; });
fit(); window.addEventListener('resize', fit);
// the host's pads drive the live frame only
if (HOST) { const loop = () => { if (live !== null) runs[live].h.poll(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
window.__manaBoard = runs.map((r) => r.rt);
window.__manaMounts = runs.map((r) => r.m);
</script></body></html>`;
}
