/**
 * MANA-UI's WIREFRAME BOARD — every idiom drawn in greybox on the sample state, one 16:9 frame each, live: click a frame
 * to drive it (arrows or WASD, Enter, Escape, [ ] for tabs; a second seat on I J K L, U to pick, O for back), and the
 * effects it emits are logged under it. The HUD frames layer the in-game parts over a play field, with a pause menu
 * that opens on Enter. One self-contained page: the kernel inlined, no request leaves it.
 *
 *   BOARD_HUDS            the HUD frames: name → the HUD idioms it layers
 *   manaUiBoard({ state?, title? })  → the page
 */
import { manaUiSource, manaUi } from './kernel.js';
import { manaCss, FRAME_CSS } from './css.js';
import { IDIOMS, SCREEN_IDIOMS, withIdioms } from './idioms.js';
import { SAMPLE_STATE } from './samples.js';

export const BOARD_HUDS = Object.freeze({
  'action HUD': ['vitals', 'objective-tracker', 'minimap-corner', 'ammo-counter', 'interact-prompt', 'event-feed', 'crosshair', 'enemy-plates', 'damage-numbers'],
  'boss fight HUD': ['boss-bar', 'party-strip', 'target-frame', 'score-timer', 'moment-banner', 'enemy-plates'],
  'explore HUD': ['vitals', 'compass-strip', 'minimap-corner', 'objective-tracker', 'interact-prompt'],
});

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
    frames.push({ name: id, group: ['party-screen', 'skill-tree', 'level-up', 'loadout-screen', 'inventory-screen', 'shop-screen', 'quest-log', 'dialogue-box'].includes(id) ? 'RPG' : 'Front and menus', about: I.about, reads: I.reads, emits: I.emits, spec: withIdioms({ screens: { s: use(id) }, start: 's' }) });
  }
  for (const f of frames) manaUi.readSpec(f.spec);
  return frames;
}

/** The board page. */
export function manaUiBoard({ state = SAMPLE_STATE, title = 'mana-ui · greybox board' } = {}) {
  const frames = boardFrames(), groups = [...new Set(frames.map((f) => f.group))];
  const body = groups.map((g) => `<h2 class="sec">${esc(g)}</h2><div class="grid">${frames.map((f, i) => (f.group !== g ? '' : `<figure><div class="mana-frame"><div class="mana-stage" id="f${i}"></div></div><figcaption><b>${esc(f.name)}</b> ${esc(f.about)}<br><span>reads</span> ${esc(f.reads)}<br><span>emits</span> ${esc(f.emits)}<pre id="log${i}"></pre></figcaption></figure>`)).join('')}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
html,body{margin:0;background:#fff;color:#111;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:20px 24px 4px}h1{margin:0;font-size:20px}header p{margin:4px 0 0;color:#555;max-width:900px}
h2.sec{margin:22px 24px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;border-bottom:1px solid #111;padding-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:22px;padding:0 24px 12px}
figure{margin:0}figcaption{margin-top:6px;font-size:12px;color:#333}figcaption span{display:inline-block;width:44px;color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
pre{margin:4px 0 0;font:10px/1.3 ui-monospace,monospace;color:#555;white-space:pre-wrap;min-height:13px}
${manaCss('.mana-stage .mana-root')}
${FRAME_CSS}
</style></head><body><header><h1>${esc(title)}</h1><p>Every idiom drawn in greybox over one sample state: the structure, the data it reads and the effects it emits, before any style. Click a frame to drive it: arrows or WASD, Enter, Escape, [ and ] for tabs; a second seat on I J K L, U, O.</p></header>${body}
<script>
const manaUi = ${manaUiSource()};
const DEFS = ${json(frames[0].spec.defs)};
const FRAMES = ${json(frames.map((f) => ({ spec: { ...f.spec, defs: undefined }, hud: !!f.hud })))};
const STATE = ${json(state)};
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
  const rt = manaUi.runtime({ ...F.spec, defs: DEFS }, host), m = manaUi.mount(el, rt, { keyboard: false });
  runs.push({ rt, m, F });
  // the click that makes a frame live only does that: it never also presses what it lands on
  el.parentNode.addEventListener('click', (ev) => {
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
  R.m.key(ev);
});
// each frame a 1280×720 screen, scaled to its box
const fit = () => document.querySelectorAll('.mana-stage').forEach((st) => { st.style.transform = 'scale(' + st.parentNode.clientWidth / 1280 + ')'; });
fit(); window.addEventListener('resize', fit);
window.__manaBoard = runs.map((r) => r.rt);
</script></body></html>`;
}
