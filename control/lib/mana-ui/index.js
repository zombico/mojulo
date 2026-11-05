/**
 * MANA-UI — the game UI runtime (internal name). Playscape says what a game's UI is; this runs it, once for every game.
 * The folder imports nothing outside itself (boundary.test.js), so a backend for an engine can read the same spec, and
 * the folder can leave for a package of its own unchanged. Design: docs/mana-ui.md.
 *
 *   kernel.js        the runtime (buildManaUi: components, props and bindings, the stack, focus, seats, effects, the
 *                    DOM backend)
 *   css.js           the structure, its look in `--mana-*` variables whose defaults are the greybox (values only)
 *   theme.js         the style layer: a theme of closed words and colours (and fonts you own) over the greybox
 *   idioms*.js       the shared screens and HUD parts as compositions; samples.js the sample state they bind into
 *   board.js         the wireframe board: every idiom live on the sample state
 *
 *   manaUiPage(spec, { state?, title?, open?, theme?, host?, glyphs? })  → a self-contained page that runs a spec over a plain state object
 *     (a `set` writes the state, every other effect is logged), for the eyes gate and the headless driver
 *     (`window.__manaUi`: the runtime; `window.__manaLog`: the effects it emitted)
 */
import { manaUi, manaUiSource } from './kernel.js';
import { manaCss } from './css.js';
import { themeCss } from './theme.js';
import { withIdioms } from './idioms.js';
import { PREVIEW_KEYS } from './board.js';

export { manaUi, manaUiSource, buildManaUi } from './kernel.js';
export { manaCss, FRAME_CSS, GREYBOX_VARS } from './css.js';
export { THEMES, THEME_IDS, THEME_WORDS, FACE_STACKS, readTheme, themeCss, themeAdvice, contrast } from './theme.js';
export { IDIOMS, IDIOM_IDS, SCREEN_IDIOMS, HUD_IDIOM_IDS, withIdioms, coverageOverlap } from './idioms.js';
export { SAMPLE_STATE } from './samples.js';
export { manaUiBoard, boardFrames, BOARD_HUDS, PREVIEW_KEYS } from './board.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A self-contained page: the spec (with the idioms) run over `state`. Throws, teaching, on a bad spec. */
export function manaUiPage(spec, { state = {}, title = 'mana-ui', open = null, theme = 'greybox', host = null, glyphs = null } = {}) {
  const full = withIdioms(spec);
  manaUi.readSpec(full);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
html,body{margin:0;height:100%;background:#ececec}
.log{position:fixed;left:8px;bottom:8px;font:11px/1.3 ui-monospace,monospace;color:#555;z-index:50;white-space:pre}
${manaCss()}
${themeCss(theme)}
</style></head><body><div id="mana"></div><div class="log" id="log"></div><script>
const manaUi = ${manaUiSource()};
const STATE = window.__manaState = ${json(state)}, LOG = window.__manaLog = [];
const host = {
  read: (p) => manaUi.readPath(STATE, p),
  // the game's clock (a preview's is the page's; a game hands its own, held while it is)
  now: () => performance.now() / 1000,
  act: (e, from) => {
    if (typeof e.set === 'string') { const k = e.set.split('.'), last = k.pop(); let o = STATE; for (const x of k) o = o[x] = o[x] || {}; o[last] = e.to; }
    LOG.push({ e, from }); document.getElementById('log').textContent = LOG.slice(-4).map((x) => (x.from.screen || '-') + ' ' + JSON.stringify(x.e)).join('\\n');
  },
};
const rt = window.__manaUi = manaUi.runtime(${json(full)}, host);
${glyphs ? `rt.glyphs(${json(glyphs)});` : ''}
${open ? `rt.open(${json(open)});` : ''}
const view = window.__manaMount = manaUi.mount(document.getElementById('mana'), rt, { auto: true });
// the input owner: the controls layer's host when given (controls/mana-host.js), else the preview's stand-in keys
${host ? `window.__manaHost = (${host.source}).connect(rt, view, { keys: ${json(host.controls.keys)}, pad: ${json(host.controls.pad)}, padLayout: (${host.controls.padLayoutSource}) });` : `const PREVIEW = ${json(PREVIEW_KEYS)};
window.addEventListener('keydown', (ev) => { const a = PREVIEW[ev.code]; if (!a || !rt.state().screen) return; ev.preventDefault(); rt.input('keys'); rt.press(a); view.paint(); });`}
</script></body></html>`;
}
