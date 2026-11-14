/**
 * play-shell — the light game shell: one self-contained page that runs a game whose levels are worlds, for
 * quick games end to end and as the playtester of the big design loop (design_game's levels).
 *
 * `emitPlayShell(manifest, levels, { playtest?, startLevel?, stingers? })` → one dependency-free html page. It speaks the
 * same wire as the arena shell (level-contract.js) and inlines the same store kernel (store-kernel.js), so a
 * level and a save behave the same under either; what it leaves out is everything the arena grew for itself
 * (hangar picks, liveries, map carousels, difficulty, battle music, AI switches, menus).
 *
 * THE FLOW (flow.js) says what plays when: the game's own `flow`, else the one its front, levels and run make
 * (defaultFlow), inlined with its kernel and run by the page's flow runner. Every screen's buttons and every level's end
 * are events the flow steps on; the level's sidecars (game-shown, game-card-done) say when its first frame is drawn (the
 * veil lifts) and when its end card is read (the flow goes on), a level from before them given the time it always had.
 *
 * The screens: title → levels (only when the game has more than one) → playing → result. A map game (levels with
 * `exits`) travels: a level left through an open exit goes straight on to the level it leads to, told where it came
 * from (`params.arrive`); its list shows what has been found, where each exit leads and what locks it.
 *   - No setup screen. A level's consumed slices ride whole; a pick ({ max }) takes the first `max` members.
 *   - Playing: the level in a full-page frame, a loading veil until the level says it is ready, a ☰ pause
 *     (and the gamepad's start button) with resume, restart, the level's own controls legend, sound, quit.
 *   - Result: cleared / failed / left in plain words, what the run gained (events read as words), the level's
 *     stats table when its envelope carries one, then next / again / home.
 *   - The raw store, params and envelopes live in a debug drawer only: open in a playtest, absent in a game
 *     (`?debug=1` opens it there too).
 *
 * Playtest (`playtest: true`, the /play route): the store is in memory (nothing is saved), gates are open, the
 * drawer is open and can reset the store; `startLevel` launches straight into one level.
 *
 * The page's code is `playShellRuntime`, inlined by `toString()` beside the kernel (the store kernel's emit
 * discipline): real, parseable JavaScript, never a string template. Seeds are deterministic (the session's
 * count of launches + 1); no Math.random, no clock.
 */

import { buildGameStoreKernel } from './store-kernel.js';
import { CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_DOOR, MSG_AUDIO, MSG_PAUSE, MSG_CONTROLS, MSG_GAMEPAD, MSG_SEATS, MSG_SHOWN, MSG_CARD_DONE, MSG_SCENE_END } from './level-contract.js';
import { FONTS, FONT_IDS, STYLE_TOKENS, hexToRgba } from './hud-widgets.js';
import { THEMES } from '../../mana-ui/theme.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';
import { FRONT_CSS, frontConfig, playFrontRuntime } from './play-front.js';
import { readScreen } from './screen.js';
import { buildFlowKernel, defaultFlow } from './flow.js';
import { playCineRuntime } from './play-cine.js';
import { shellManaConfig, shellManaCss, shellManaScript } from './play-shell-mana.js';

const CTL = buildControlsKernel();
const PAUSE_BUTTONS = CTL.resolve(SCHEMES.shell, { gamepad: DEVICES.gamepad }).bind.gamepad.pause.map((c) => DEVICES.gamepad.buttons[c]);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// JSON inside <script>: a `</script>` in a title must not close the tag
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
// the shell made for a screen (screen.js): the safe area (the notch's, the home bar's) held clear by the menus and the
// fixed chrome, buttons no smaller than a thumb, the level's frame standing on the black of its bars; upright, the
// front's title and menu stand in the thumbs' reach at the foot of the screen, its cover above them
const SCREEN_CSS = `:root{--safe-t:env(safe-area-inset-top,0px);--safe-r:env(safe-area-inset-right,0px);--safe-b:env(safe-area-inset-bottom,0px);--safe-l:env(safe-area-inset-left,0px)}
  html,body{height:100dvh;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}
  body{touch-action:manipulation}
  button{min-height:44px}
  button.link{min-height:44px}
  #app{min-height:100dvh;padding:calc(32px + var(--safe-t)) calc(16px + var(--safe-r)) calc(32px + var(--safe-b)) calc(16px + var(--safe-l))}
  #pauseBtn{top:calc(12px + var(--safe-t));right:calc(12px + var(--safe-r));min-width:44px}
  #playtag{top:calc(12px + var(--safe-t));left:calc(12px + var(--safe-l))}
  #toast{bottom:calc(22px + var(--safe-b))}
  #debug{right:calc(12px + var(--safe-r));bottom:calc(12px + var(--safe-b))}
  html[data-screen] #front .fx-skip{right:calc(16px + var(--safe-r));bottom:calc(14px + var(--safe-b))}
  html[data-orientation=portrait] #front .fx-stage.cover{left:0;top:calc(6vh + var(--safe-t));transform:none;width:100vw}
  html[data-orientation=portrait] #front .fx-zone{position:fixed;left:50%!important;top:auto!important;bottom:calc(8vh + var(--safe-b));width:min(320px,calc(100vw - 32px))!important;height:auto!important;transform:translateX(-50%)}
  html[data-orientation=portrait] #front .fx-col:not(.fx-hide){left:50%;right:auto;top:auto;bottom:calc(8vh + var(--safe-b));transform:translateX(-50%);align-items:center;text-align:center;width:calc(100vw - 32px)}
  html[data-orientation=portrait] #front .fx-menu{width:100%;min-width:0}`;

const safeColor = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback);

export function emitPlayShell(manifest, levels = [], { playtest = false, startLevel = null, stingers = null, frontArt = null } = {}) {
  if (!manifest || manifest.kind !== 'game') throw new Error("emitPlayShell needs a validated game manifest (kind: 'game')");
  const byRef = new Map(levels.map((l) => [l.ref, l]));
  for (const lv of manifest.levels) {
    if (!byRef.has(lv.ref)) throw new Error(`emitPlayShell: manifest level '${lv.ref}' has no matching entry in levels[] (need its contract + src)`);
    if (!byRef.get(lv.ref).contract) throw new Error(`emitPlayShell: level '${lv.ref}' is missing its contract`);
  }
  if (startLevel !== null && !byRef.has(startLevel)) {
    throw new Error(`emitPlayShell: '${startLevel}' is not a level of this game (levels: ${manifest.levels.map((l) => l.ref).join(', ')})`);
  }
  const levelTable = manifest.levels.map((lv) => {
    const l = byRef.get(lv.ref);
    return { ref: lv.ref, title: lv.title || l.title || lv.ref, gate: lv.gate || null, src: l.src || `levels/${lv.ref}.html`, contract: l.contract, ...(Array.isArray(lv.exits) ? { exits: lv.exits } : {}) };
  });

  // the theme: the same tokens as the arena shell and the levels' HUD; sanitized here so a hand-poked row cannot
  // inject into the CSS context
  const theme = manifest.theme || {};
  // (a bare HUD look, the world's `hud`, mana-ui/theme.js: no menu button under a mouse, the pause on Esc; a finger keeps it)
  const bareHud = typeof manifest.hud === 'string' && THEMES[manifest.hud]?.hud === 'bare';
  const c = {
    bg: safeColor(theme.bg, '#0e1116'),
    ink: safeColor(theme.ink, '#e8edf4'),
    accent: safeColor(theme.accent, '#5fb0ff'),
    accent2: safeColor(theme.accent2, '#e8b96a'),
    line: safeColor(theme.line, '#2a303b'),
  };
  const panel = hexToRgba(safeColor(theme.panel, '#161a22'), 0.86);
  const font = FONT_IDS.includes(theme.font) ? FONTS[theme.font] : 'system-ui,-apple-system,"Segoe UI",sans-serif';
  const levelTheme = {};
  for (const k of STYLE_TOKENS) { const v = safeColor(theme[k], null); if (v) levelTheme[k] = v; }
  if (FONT_IDS.includes(theme.font)) levelTheme.font = theme.font;

  // DOOR LINKS (game-manifest.js links): a door end of one level → the level and door it opens into, both ways. Absent:
  // no key, and the page is as it was
  const links = Array.isArray(manifest.links) && manifest.links.length
    ? manifest.links.reduce((m, lk) => { (m[lk.from.ref] ||= {})[lk.from.door] = lk.to; (m[lk.to.ref] ||= {})[lk.to.door] = lk.from; return m; }, {})
    : null;
  const cfg = {
    manifest,
    levels: levelTable,
    ...(links ? { links } : {}),
    theme: Object.keys(levelTheme).length ? levelTheme : null,
    playtest: !!playtest,
    startLevel,
    ...(manifest.run ? { run: { length: manifest.run.length } } : {}),
    // the result's stingers (music.victory / music.defeat, resolved to srcs): absent, no key
    ...(stingers && (stingers.victory || stingers.defeat) ? { stingers: { victory: stingers.victory || null, defeat: stingers.defeat || null } } : {}),
    wire: { version: CONTRACT_VERSION, ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, audio: MSG_AUDIO, pause: MSG_PAUSE, controls: MSG_CONTROLS, gamepad: MSG_GAMEPAD, seats: MSG_SEATS, shown: MSG_SHOWN, cardDone: MSG_CARD_DONE, sceneEnd: MSG_SCENE_END, ...(links ? { door: MSG_DOOR } : {}) },
    pauseButtons: PAUSE_BUTTONS,
    // THE FRONT (play-front.js): a title over a cover, the start menu, options, credits, the end; absent, no key
    ...(manifest.front ? { front: frontConfig(manifest.front, frontArt, { levels: levelTable.length, run: !!manifest.run }) } : {}),
    // THE FLOW (flow.js): what plays when, the game's own, else the one its front, levels and run make
    flow: manifest.flow || defaultFlow({ levels: levelTable, links: manifest.links, run: manifest.run, final: manifest.final, front: manifest.front }),
    // THE SCREENS IN MANA-UI (play-shell-mana.js): the game's ui, its look resolved; absent, no key and none of it inlined
    ...(manifest.ui ? { mana: shellManaConfig(manifest.ui) } : {}),
  };
  // (with mana-ui the front's words are drawn by it: the front's own sheet and code stay out)
  const mana = !!cfg.mana, front = !!cfg.front && !mana;
  // A CUTSCENE PLAYED AS A VIDEO (flow.js: a cinematic's `film` or `video`, play-cine.js): its player is inlined only in
  // a game whose flow has one. Absent: not a byte of it
  const cine = Object.values(cfg.flow.steps || {}).some((s) => s && s.kind === 'cinematic' && (s.film !== undefined || s.video !== undefined));
  // THE SCREEN (screen.js): the game is made for a phone, a tablet or a monitor; its levels hold the frame, and the shell
  // fills the device to its edges with its chrome clear of the notch and the home bar, its buttons a thumb's size.
  // Absent: no attribute, no rule, the page as it was
  const screen = manifest.screen != null ? readScreen(manifest.screen) : null;

  return `<!doctype html>
<html lang="en"${screen ? ` data-screen="${screen.pole}" data-orientation="${screen.orientation}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1${screen ? ', viewport-fit=cover' : ''}">
<title>${esc(manifest.title)}${playtest ? ' · playtest' : ''}</title>
<style>
  :root{--bg:${c.bg};--ink:${c.ink};--accent:${c.accent};--accent2:${c.accent2};--line:${c.line};--panel:${panel};--dim:color-mix(in srgb,var(--ink) 58%,transparent)}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--ink);font:15px/1.45 ${font};-webkit-font-smoothing:antialiased}
  button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:10px 18px}
  button:hover:not(:disabled){border-color:var(--accent)}
  button:disabled{opacity:.45;cursor:default}
  button.primary{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:600}
  button.primary:hover{filter:brightness(1.08)}
  button.link{background:none;border:none;color:var(--dim);padding:6px 8px;font-size:13px}
  button.link:hover{color:var(--ink)}
  #app{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
  .screen{width:100%;max-width:560px;display:flex;flex-direction:column;gap:14px;align-items:stretch}
  .center{align-items:center;text-align:center}
  h1{font-size:clamp(30px,6vw,46px);line-height:1.1;margin:0;letter-spacing:-.01em}
  h2{font-size:22px;margin:0}
  .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
  .muted{color:var(--dim);font-size:14px}
  .big{font-size:17px;padding:13px 34px;border-radius:12px}
  .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
  .card{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
  .card .grow{flex:1;min-width:0}
  .card .name{font-weight:600}
  .badge{font-size:12px;color:var(--accent2)}
  .result-mark{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
  .result-mark.fail{color:var(--accent2)}
  .gains{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .gains li{border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:14px;background:var(--panel)}
  table{border-collapse:collapse;width:100%;font-size:14px}
  th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right}
  th:first-child,td:first-child{text-align:left}
  th{font-weight:500;color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
  tr.me td{color:var(--accent)}
  #frame{position:fixed;inset:0;width:100%;height:100%;border:0;display:none;background:#000}
  #veil{position:fixed;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:var(--bg);z-index:5}
  #veil .bar{width:180px;height:3px;border-radius:2px;background:var(--line);overflow:hidden}
  #veil .bar i{display:block;height:100%;width:40%;background:var(--accent);animation:slide 1.1s ease-in-out infinite}
  @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
  #pauseBtn{position:fixed;top:12px;right:12px;z-index:6;display:none;padding:6px 12px;background:var(--panel);border-radius:8px}
${bareHud ? '  @media (hover:hover) and (pointer:fine){#pauseBtn{display:none!important}}\n' : ''}  #pause{position:fixed;inset:0;z-index:7;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bg) 72%,transparent);backdrop-filter:blur(6px)}
  #pause .screen{max-width:340px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px}
  dl.keys{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0;font-size:14px}
  dl.keys dt{color:var(--accent);white-space:nowrap}
  dl.keys dd{margin:0}
  #toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9;display:none;max-width:90vw;padding:10px 16px;border-radius:10px;background:var(--panel);border:1px solid var(--accent2);font-size:14px}
  #playtag{position:fixed;top:12px;left:12px;z-index:8;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent2);border:1px solid var(--accent2);border-radius:6px;padding:3px 8px;background:var(--panel);display:none}
  #debug{position:fixed;right:12px;bottom:12px;z-index:8;max-width:min(440px,calc(100vw - 24px));display:none}
  #debug summary{cursor:pointer;font-size:12px;color:var(--dim);text-align:right;list-style:none}
  #debug .body{margin-top:6px;max-height:56vh;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px;font:12px/1.4 ui-monospace,Menlo,monospace}
  #debug pre{margin:4px 0 10px;white-space:pre-wrap;word-break:break-word}
  #debug h4{margin:0;font:600 11px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.1em;color:var(--dim)}${screen ? `
  ${SCREEN_CSS}` : ''}${front ? `
  ${FRONT_CSS}` : ''}${mana ? `
  ${shellManaCss(manifest.ui)}` : ''}
</style></head>
<body>
<main id="app"></main>${front ? `
<div id="front"></div>` : ''}
<iframe id="frame" title="level" allow="gamepad; fullscreen; autoplay"></iframe>
<div id="veil"><div class="muted" id="veilText">loading</div><div class="bar"><i></i></div></div>
<button id="pauseBtn" aria-label="pause">☰</button>
<div id="pause"></div>
<div id="playtag">playtest · nothing is saved</div>
<details id="debug"><summary>debug</summary><div class="body" id="debugBody"></div></details>
<div id="toast" role="status"></div>
<script>${front ? `
const __mojFront = (${playFrontRuntime.toString()});` : ''}${mana ? `
${shellManaScript()}` : ''}${cine ? `
const __mojCine = (${playCineRuntime.toString()});` : ''}
const K = (${buildGameStoreKernel.toString()})();
const __mojFlowK = (${buildFlowKernel.toString()})();
(${playShellRuntime.toString()})(${scriptJson(cfg)}, K);
</script>
</body></html>`;
}

/**
 * The page's code, inlined whole (never called in node). `cfg` is the emit's config, `K` the store kernel.
 * Everything visible is built with textContent: titles and item names never become markup.
 */
export function playShellRuntime(cfg, K) {
  const M = cfg.manifest, LEVELS = cfg.levels, W = cfg.wire, SCHEMA = M.store;
  const PLAYTEST = cfg.playtest;
  const DEBUG = PLAYTEST || /(^|[?&])debug=1(&|$)/.test(location.search.slice(1));
  const $ = (id) => document.getElementById(id);
  const app = $('app'), frame = $('frame'), veil = $('veil'), pauseBtn = $('pauseBtn'), pauseEl = $('pause');
  // THE FLOW (flow.js): what plays when. Every screen's buttons and every level's end are events the flow steps on;
  // `at` is the step the game is on and the level last played
  const FK = __mojFlowK, FLOW = cfg.flow;
  // (a game whose flow plays a video has its player inlined, play-cine.js; any other has none)
  const CINE = typeof __mojCine === 'function' ? __mojCine({ go: (e) => go(e), show: (n) => show(n), app, here: () => at }) : null;
  let at = { step: null, level: null }, holdTimer = 0, holdUntil = null, idleTimer = 0, idleAfter = 0, lastOutcome = null, waitCard = null;

  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) for (const k in props) {
      if (props[k] === null || props[k] === undefined) continue;
      if (k === 'text') n.textContent = props[k];
      else if (k === 'on') n.addEventListener('click', props[k]);
      else if (k === 'cls') n.className = props[k];
      else n.setAttribute(k, props[k]);
    }
    for (const kid of kids || []) if (kid) n.appendChild(kid);
    return n;
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.display = 'none'; }, 5200);
  }

  // ---- the store: a save in localStorage for a game, memory for a playtest ----
  const SAVE_KEY = 'moj-play:' + M.title;
  const SET_KEY = SAVE_KEY + ':settings';
  const mem = {};
  let storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  if (!PLAYTEST) {
    try { localStorage.setItem(SAVE_KEY + ':probe', '1'); localStorage.removeItem(SAVE_KEY + ':probe'); storage = localStorage; }
    catch (e) { /* file:// or blocked storage: this session only */ }
  }
  let settings = { sfxOn: true };
  try { const s = JSON.parse(storage.getItem(SET_KEY) || 'null'); if (s && typeof s === 'object') settings = Object.assign(settings, s); } catch (e) { /* fresh prefs */ }
  const saveSettings = () => { try { storage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) { /* session only */ } };

  let state, runLog;
  // the flow's steps this save has entered (its cinematics: an opening plays on a first boot, the flow's `unseen`), kept
  // beside the save and cleared with it
  const SEEN_KEY = SAVE_KEY + ':seen';
  let seenSteps = {};
  try { const v = JSON.parse(storage.getItem(SEEN_KEY) || 'null'); if (v && typeof v === 'object') seenSteps = v; } catch (e) { /* none seen */ }
  function freshStore() { state = K.createStore(SCHEMA); runLog = []; }
  // a reset (the player's, the drawer's): the store anew, and what the flow has shown forgotten with it (a first boot's
  // fresh store keeps it: a player who has seen the opening and not yet finished a level has no save, and has seen it)
  function resetStore() { freshStore(); seenSteps = {}; try { storage.removeItem(SEEN_KEY); } catch (e) { /* session only */ } }
  (function boot() {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const p = K.parseSave(raw);
      if (p.ok) { state = p.save.storeState; runLog = p.save.runLog; return; }
    }
    freshStore();
  })();
  const persist = () => { try { storage.setItem(SAVE_KEY, K.makeSave(state, runLog)); } catch (e) { /* session only */ } };

  const progression = (SCHEMA.slices.filter((s) => s.kind === 'progression')[0] || {}).name;
  const cleared = (ref) => !!(progression && state[progression].completed[ref]);
  // a map game (levels with exits): a level is open once found through an open exit; a list game reads its gates.
  // A playtest opens every level to pick from; travel inside the game still follows the game's own exits and keys.
  const MAP = K.isMap(LEVELS);
  // ---- the atlas (a megaworld): where the player is, kept in the store; found by having been, never by completing ----
  const ATLAS = M.atlas || null;
  const atlas = () => (ATLAS && state[ATLAS.slice] ? state[ATLAS.slice].flags : {});
  const setAtlas = (flags) => { const r = K.applyEvents(SCHEMA, state, Object.keys(flags).map((key) => ({ type: 'setFlag', slice: ATLAS.slice, key, value: flags[key] }))); if (r.ok) state = r.state; };
  const atlasFound = () => {
    const F = atlas(), found = {};
    if (LEVELS.length) found[LEVELS[0].ref] = true;
    LEVELS.forEach((lv) => { if (F['been:' + lv.ref]) { found[lv.ref] = true; (lv.exits || []).forEach((x) => { if (K.evalGate(SCHEMA, state, x.gate)) found[x.to] = true; }); } });
    return found;
  };
  const isOpen = (lv) => PLAYTEST || (ATLAS ? !!atlasFound()[lv.ref] && K.evalGate(SCHEMA, state, lv.gate) : MAP ? !!K.reachable(SCHEMA, state, LEVELS)[lv.ref] : K.evalGate(SCHEMA, state, lv.gate));
  const needs = (g) => (g.completed ? 'clear ' + levelTitle(g.completed) + ' first' : g.has ? 'needs ' + (g.count > 1 ? g.count + ' × ' : 'a ') + g.has : 'locked');
  const sliceKind = (name) => (SCHEMA.slices.find((s) => s.name === name) || {}).kind;
  const levelTitle = (ref) => (LEVELS.find((l) => l.ref === ref) || {}).title || ref;

  // ---- debug drawer: the raw store, what was sent, what came back ----
  let lastParams = null, lastEnvelope = null, lastErrors = null;
  function renderDebug() {
    if (!DEBUG) return;
    const d = $('debug');
    d.style.display = 'block';
    if (PLAYTEST) d.open = true;
    const body = $('debugBody');
    body.textContent = '';
    const block = (title, v) => { body.appendChild(el('h4', { text: title })); body.appendChild(el('pre', { text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) })); };
    if (lastErrors) block('rejected outcome', lastErrors.join('\n'));
    if (lastEnvelope) block('last envelope', lastEnvelope);
    if (lastParams) block('last params', lastParams);
    block('store', state);
    block('run log', runLog.length + ' session' + (runLog.length === 1 ? '' : 's'));
    body.appendChild(el('button', { cls: 'link', text: 'reset store', on: () => { resetStore(); persist(); lastErrors = null; renderDebug(); if (screen !== 'level') home(); } }));
  }
  if (PLAYTEST) $('playtag').style.display = 'block';

  // ---- screens ----
  let screen = 'title', session = null, launches = 0;
  function show(s) {
    screen = s;
    const playing = s === 'level';
    frame.style.display = playing ? 'block' : 'none';
    pauseBtn.style.display = playing ? 'block' : 'none';
    app.style.display = playing ? 'none' : 'flex';
    if (front && s !== 'title') $('front').style.display = 'none';
    if (!playing) { setPaused(false); frame.removeAttribute('src'); veil.style.display = 'none'; }
    renderDebug();
  }
  // home: the flow's (its `home`, else the first screen past an attract): where quitting and resetting go
  const home = () => enter({ step: FK.homeOf(FLOW), level: at.level });
  // what the result and the pause call home: the front's title, else the levels or the title
  // (said from the flow's home: the screen quitting goes to, whoever draws it)
  const homeWord = () => { const h = FLOW.steps[FK.homeOf(FLOW)]; return h && h.screen === 'levels' ? 'levels' : 'title'; };

  // ---- RUNS (manifest.run): each run draws `length` of the levels in an order rolled from its number; a clear goes on
  // to the next, a death ends the run; the store carries over from run to run; the deepest run is kept ----
  const RUN = cfg.run || null, RUNS_KEY = SAVE_KEY + ':runs', DEEP_KEY = SAVE_KEY + ':deepest';
  let run = null;
  const num = (k) => { try { return Number(storage.getItem(k)) || 0; } catch (e) { return 0; } };
  const keep = (k, v) => { try { storage.setItem(k, String(v)); } catch (e) { /* this session only */ } };
  function roll(n) {
    let a = (n * 2654435761) >>> 0;
    const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pool = LEVELS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    return pool.slice(0, RUN.length);
  }
  // a new run (the flow's $run): its number kept, its order rolled from it; its first level
  function newRun() {
    const n = num(RUNS_KEY) + 1;
    keep(RUNS_KEY, n);
    run = { n, order: roll(n), at: 0 };
    return run.order[0] ? run.order[0].ref : null;
  }
  function renderRunTitle() {
    show('title');
    const deep = num(DEEP_KEY), runs = num(RUNS_KEY);
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, [
      PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null,
      el('h1', { text: M.title }),
      el('div', { cls: 'muted', text: 'a run: ' + RUN.length + ' of ' + LEVELS.length + ' levels, drawn anew each time; fall, and it ends' }),
      runs ? el('div', { cls: 'badge', text: 'deepest: ' + deep + ' of ' + RUN.length + ' · ' + runs + ' run' + (runs === 1 ? '' : 's') }) : null,
      el('div', { cls: 'row' }, [el('button', { cls: 'primary big', text: runs ? 'new run' : 'start a run', on: () => go('play') })]),
      !PLAYTEST && runLog.length ? resetLink() : null,
    ]));
  }
  // a run's end: how deep it went, what it gained; a new run, the title, the credits
  function renderRunResult() {
    if (!run || !lastOutcome) { home(); return; }
    const env = lastOutcome.env, deep = lastOutcome.deep, won = run.at >= run.order.length;
    const r = run, gains = lastOutcome.ok ? gainsOf(env.events || []) : [];
    run = null; session = null;
    show('result');
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, [
      el('div', { cls: 'result-mark' + (won ? '' : ' fail'), text: won ? 'run complete' : 'run over' }),
      el('h1', { text: 'run ' + r.n + ': ' + r.at + ' of ' + r.order.length }),
      el('div', { cls: 'muted', text: r.at > deep ? 'the deepest yet' : 'deepest: ' + Math.max(deep, r.at) }),
      gains.length ? el('ul', { cls: 'gains' }, gains.map((g) => el('li', { text: g }))) : null,
      env.stats && Array.isArray(env.stats.kept) && env.stats.kept.length ? keptList(r.order[Math.min(r.at, r.order.length - 1)], env) : null,
      el('div', { cls: 'row' }, [el('button', { cls: 'primary', text: 'new run', on: () => go('again') }), el('button', { text: 'title', on: () => go('home') }), onOf('credits') ? el('button', { text: 'credits', on: () => go('credits') }) : null]),
    ]));
  }

  function renderTitle() {
    show('title');
    const first = LEVELS[0];
    const kids = [
      PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null,
      el('h1', { text: M.title }),
      LEVELS.length > 1 ? el('div', { cls: 'muted', text: LEVELS.length + ' levels' }) : (cleared(first.ref) ? el('div', { cls: 'badge', text: 'cleared' }) : null),
      el('div', { cls: 'row' }, [el('button', { cls: 'primary big', text: 'play', on: () => go('play') })]),
      !PLAYTEST && runLog.length ? resetLink() : null,
    ];
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, kids));
  }

  function resetLink() {
    let armed = false;
    const b = el('button', { cls: 'link', text: 'reset progress' });
    b.addEventListener('click', () => {
      if (!armed) { armed = true; b.textContent = 'tap again to reset'; return; }
      resetStore(); persist(); home();
    });
    return b;
  }

  // THE TRAVEL SCREEN (a megaworld): the zones on their rings, the first ring outermost and the core at the centre, the
  // ways between them; a zone found travelled to by a touch, one not yet found a dim mark
  function atlasMap() {
    const S = 320, c = S / 2, rings = ATLAS.rings, n = rings.length, at = atlas().at, box = document.createElement('div'), out = [];
    const attr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const radius = (i) => (n === 1 ? 0.7 : 1 - i / (n - 1) + (i === n - 1 && rings[i].length > 1 ? 0.3 : 0)) * (c - 34);
    const place = {};
    rings.forEach((r, i) => r.forEach((ref, j) => { const a = -Math.PI / 2 + (2 * Math.PI * j) / r.length + i * 0.35, R = radius(i); place[ref] = [c + R * Math.cos(a), c + R * Math.sin(a)]; }));
    rings.forEach((r, i) => { if (radius(i) > 0) out.push('<circle cx="' + c + '" cy="' + c + '" r="' + radius(i) + '" fill="none" stroke="var(--line)" stroke-dasharray="2 5"/>'); });
    LEVELS.forEach((lv) => (lv.exits || []).forEach((x) => { const p = place[lv.ref], q = place[x.to]; if (p && q) out.push('<line x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '" stroke="' + (K.evalGate(SCHEMA, state, x.gate) ? 'var(--dim)' : 'var(--line)') + '"/>'); }));
    LEVELS.forEach((lv) => {
      const p = place[lv.ref]; if (!p) return;
      const open = isOpen(lv), here = lv.ref === at;
      out.push('<g data-zone="' + attr(lv.ref) + '" aria-label="' + attr(lv.title) + '"' + (open ? ' role="button" style="cursor:pointer"' : '') + '><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (here ? 11 : 8) + '" fill="' + (open ? 'var(--accent)' : 'var(--panel)') + '" stroke="' + (here ? 'var(--ink)' : 'var(--line)') + '" stroke-width="' + (here ? 2 : 1) + '"/><text x="' + p[0] + '" y="' + (p[1] + 24) + '" text-anchor="middle" font-size="11" fill="' + (open ? 'var(--ink)' : 'var(--dim)') + '">' + attr(open ? lv.title : '?') + '</text></g>');
    });
    box.innerHTML = '<svg class="atlas" viewBox="0 0 ' + S + ' ' + S + '" style="display:block;width:min(100%,360px);margin:0 auto 12px">' + out.join('') + '</svg>';
    box.querySelectorAll('g[role=button]').forEach((g) => g.addEventListener('click', () => launch(LEVELS.find((l) => l.ref === g.getAttribute('data-zone')))));
    return box.firstChild;
  }

  function renderLevels() {
    show('levels');
    const s = el('div', { cls: 'screen' }, [
      el('div', { cls: 'center screen' }, [PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null, el('h1', { text: M.title })]),
    ]);
    const lastAt = ATLAS ? atlas().at || null : MAP && runLog.length ? runLog[runLog.length - 1].levelRef : null;
    if (ATLAS) s.appendChild(atlasMap());
    LEVELS.forEach((lv, i) => {
      const open = isOpen(lv);
      const gated = lv.gate && !K.evalGate(SCHEMA, state, lv.gate);
      const lock = open ? null : (gated ? needs(lv.gate) : 'not found yet');
      // a map's rows say where their exits lead, and what locks them
      const ways = MAP && open && lv.exits ? lv.exits.map((x) => '→ ' + levelTitle(x.to) + (x.gate && !K.evalGate(SCHEMA, state, x.gate) ? ' (' + needs(x.gate) + ')' : '')).join('  ·  ') : null;
      s.appendChild(el('div', { cls: 'card' }, [
        el('div', { cls: 'muted', text: String(i + 1) }),
        el('div', { cls: 'grow' }, [el('div', { cls: 'name', text: lv.title }), lock ? el('div', { cls: 'muted', text: lock }) : null, ways ? el('div', { cls: 'muted', text: ways }) : null]),
        lastAt === lv.ref ? el('span', { cls: 'badge', text: ATLAS ? 'you are here' : 'last here' }) : null,
        cleared(lv.ref) ? el('span', { cls: 'badge', text: 'cleared' }) : null,
        el('button', { cls: open ? 'primary' : '', text: 'play', disabled: open ? null : 'disabled', on: () => { if (open) go('pick', { picked: lv.ref }); } }),
      ]));
    });
    if (!PLAYTEST && runLog.length) s.appendChild(el('div', { cls: 'row' }, [resetLink()]));
    if (onOf('back')) s.appendChild(el('div', { cls: 'row' }, [el('button', { cls: 'link', text: 'title', on: () => go('back') })]));
    app.textContent = '';
    app.appendChild(s);
  }

  // ---- a level: what it consumes rides whole; a pick takes the first `max` members ----
  function paramsFor(lv) {
    const params = {};
    for (const c of lv.contract.consumes || []) {
      const slice = state[c.slice];
      if (!c.pick) { params[c.slice] = clone(slice); continue; }
      if (sliceKind(c.slice) === 'inventory') {
        const items = {};
        Object.keys(slice.items).slice(0, c.pick.max).forEach((id) => { items[id] = slice.items[id]; });
        params[c.slice] = { items };
      } else {
        const roster = {};
        Object.keys(slice.roster).slice(0, c.pick.max).forEach((id) => { roster[id] = clone(slice.roster[id]); });
        params[c.slice] = { roster };
      }
    }
    return params;
  }

  let veilCap = 0, veilHint = 0, ctlRows = null;
  // `arrive`: the level a map game's travel came from (the level moves the player to that end of itself); `carry`: the
  // params a door brings in (the session's, and the door it enters by), in place of the level's own
  // outcome STINGERS (music.victory / music.defeat): played once when a level ends, the level's own sound muted under
  // them; fetched once per session (the render is deterministic), cut short by the next launch
  const STINGERS = cfg.stingers || null, stingerBlob = {};
  let stingerEl = null;
  const warmStinger = (src) => { if (src && !stingerBlob[src]) stingerBlob[src] = fetch(src).then((r) => r.blob()).then((b) => URL.createObjectURL(b)).catch(() => null); };
  function playStinger(src) {
    if (!src || !settings.sfxOn) return;
    post({ moj: W.audio, on: false, volume: 1 });
    warmStinger(src);
    stingerBlob[src].then((url) => { if (!url) return; stingerEl = stingerEl || new Audio(); stingerEl.src = url; stingerEl.volume = 0.6; stingerEl.play().catch(() => {}); });
  }
  // `stage`: a cinematic the flow plays on the level's page ({ scene, skip? }, params.__stage): the level plays it, held,
  // and says when it ends
  function launch(lv, arrive, carry, stage) {
    if (stingerEl) stingerEl.pause();
    if (STINGERS) { warmStinger(STINGERS.victory); warmStinger(STINGERS.defeat); }
    launches += 1;
    // (a megaworld: the map loaded is the current map; resumed, it is arrived at by the way it was last come in by)
    if (ATLAS) { const F = atlas(); if (!arrive && !carry && F.at === lv.ref && F.from) arrive = F.from; setAtlas({ at: lv.ref, from: arrive || '', ['been:' + lv.ref]: true }); persist(); }
    const params = carry || paramsFor(lv);
    if (arrive) params.arrive = arrive;
    if (stage) params.__stage = stage;
    session = { level: lv, params, seed: (run ? run.n * 100 + run.at + 1 : PLAYTEST ? launches : runLog.length + 1), ended: false };
    lastParams = session.params; lastErrors = null;
    ctlRows = null;
    show('level');
    // the veil while it loads: mana-ui's loading screen when the game draws its screens with it
    if (MANA) MANA.loading(lv.title);
    else { $('veilText').textContent = lv.title; veil.style.display = 'flex'; }
    clearTimeout(veilCap);
    // (a big map is baked before a byte of it arrives, for minutes: the veil holds, and says so, until the frame has loaded;
    // a level without the bridge still shows, a while after it has)
    clearTimeout(veilHint);
    veilHint = setTimeout(() => { $('veilText').textContent = lv.title + ' · being built for the first time: a big map can take a few minutes'; }, 8000);
    veilCap = setTimeout(() => { veil.style.display = 'none'; if (MANA) MANA.loaded(); }, 600000);
    frame.src = lv.src;
  }
  function post(msg) { try { if (frame.contentWindow) frame.contentWindow.postMessage(msg, '*'); } catch (e) { /* opaque frame */ } }
  const pushPrefs = () => {
    post({ moj: W.audio, on: settings.sfxOn, volume: 1 });
    post({ moj: W.gamepad, on: true, deadZone: 0.15, lookScale: 18, invertY: false });
  };
  frame.addEventListener('load', pushPrefs);
  frame.addEventListener('load', () => { if (veil.style.display === 'none') return; clearTimeout(veilCap); clearTimeout(veilHint); $('veilText').textContent = session ? session.level.title : ''; veilCap = setTimeout(() => { veil.style.display = 'none'; if (MANA) MANA.loaded(); }, 45000); });

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || !session || e.source !== frame.contentWindow) return;
    if (d.moj === W.seats) { seatList = Array.isArray(d.seats) ? d.seats : []; if (paused) renderPause(); return; }
    if (d.moj === W.controls) { ctlRows = Array.isArray(d.rows) && d.rows.length ? d.rows : null; if (paused) renderPause(); return; }
    // the level's first frame drawn: the veil lifts (a level from before game-shown lifts it a moment after it is ready)
    if (d.moj === W.shown) { clearTimeout(veilCap); veil.style.display = 'none'; if (MANA) MANA.loaded(); signal('shown'); return; }
    // the scene the flow staged here has ended (or the level had none, or it never started): the flow goes on, the page
    // kept when the cinematic hands its stage on to the level
    if (d.moj === W.sceneEnd) { const cs = FLOW.steps[at.step]; if (cs && cs.kind === 'cinematic' && d.scene === cs.scene) go('next', { keepPage: !!cs.keep }); return; }
    // the level's own end card read (or put away): the flow goes on
    if (d.moj === W.cardDone) { if (waitCard) { const f = waitCard; waitCard = null; f(); } signal('card-done'); return; }
    if (d.moj === W.ready) {
      clearTimeout(veilCap); clearTimeout(veilHint); veilCap = setTimeout(() => { veil.style.display = 'none'; if (MANA) MANA.loaded(); }, 1200);
      if (d.contractVersion !== W.version) { clearTimeout(veilCap); veil.style.display = 'none'; if (MANA) MANA.loaded(); toast('This level speaks a newer contract (v' + d.contractVersion + '); re-make the game.'); return; }
      post({ moj: W.init, contractVersion: W.version, params: session.params, seed: session.seed, theme: cfg.theme });
      pushPrefs();
      return;
    }
    // a door crossed (a building whose scene changes at its door): what the session gathered applies, and the level
    // the door opens into loads, entered by its own door
    if (W.door && d.moj === W.door && !session.ended) {
      const r = K.applyTransit(SCHEMA, state, session.level.contract, d.envelope || {});
      if (!r.ok) { lastErrors = r.errors; toast('The door could not be taken; nothing changed.'); return; }
      state = r.state;
      if ((d.envelope && d.envelope.events || []).length) runLog.push(d.envelope);
      persist();
      const to = (cfg.links[session.level.ref] || {})[d.door], lv = to && LEVELS.find((l) => l.ref === to.ref);
      if (!lv) { toast('That door leads nowhere.'); return; }
      if (!PLAYTEST && lv.gate && !K.evalGate(SCHEMA, state, lv.gate)) { toast(lv.title + ' is locked.'); return; }
      // (the store as the door left it, what the session gathered included: never what the session started with)
      const carry = paramsFor(lv);
      carry.__entry = { door: to.door, from: session.level.ref };
      if (!go('door', { doorTo: lv.ref, carry })) toast('That door leads nowhere.');
      return;
    }
    if (d.moj === W.outcome && !session.ended) {
      session.ended = true;
      // THE END: a game with a final level (M.final) is cleared by its first win alone
      const before = (cfg.front || M.final) && allCleared();
      const env = d.envelope || {};
      lastEnvelope = env;
      const r = K.applyOutcome(SCHEMA, state, session.level.contract, env);
      if (!r.ok) { lastErrors = r.errors; toast('The level sent an outcome the game could not apply; nothing changed.'); }
      else {
        state = r.state;
        // (a megaworld: leaving a map by a way is travel, never its completion)
        if (env.result === 'success' && progression && !(ATLAS && env.exit) && !state[progression].completed[session.level.ref]) {
          const pr = K.applyEvents(SCHEMA, state, [{ type: 'promote', slice: progression, ref: session.level.ref, result: 'success' }]);
          if (pr.ok) state = pr.state;
        }
        runLog.push(env);
        persist();
      }
      // the flow steps on the level's end: won, lost or left
      const event = env.result === 'success' ? 'won' : env.result === 'fail' ? 'lost' : 'left';
      // a RUN: a clear goes on to its next level, else the run's end (how deep it went, kept)
      if (run) {
        if (env.result === 'success') run.at += 1;
        const deep = num(DEEP_KEY);
        if (run.at > deep) keep(DEEP_KEY, run.at);
        lastOutcome = { lv: session.level, env, ok: r.ok, deep };
        if (env.result === 'success' && run.at < run.order.length) toast('cleared ' + run.at + ' of ' + run.order.length);
        const sess = session;
        setTimeout(() => { if (session === sess) go(event); }, 1400);
        return;
      }
      // the game first completed (the flow's `complete`): the end, not on through the level's exit
      const fin = (cfg.front || M.final) && !before && r.ok && env.result === 'success' && allCleared();
      // TRAVEL (a map game, the flow's $travel): a success through an open exit goes on to the level it leads to
      const travelTo = !(fin && M.final) && r.ok && env.result === 'success' && env.exit ? K.travel(SCHEMA, state, LEVELS, session.level.ref, env.exit) : null;
      lastOutcome = { lv: session.level, env, ok: r.ok, fin };
      const more = { complete: !!fin, travelTo, from: session.level.ref };
      const next = FK.stepFlow(FLOW, at.step, event, flowCtx(Object.assign({}, more, { level: at.level })));
      // straight on to a level (travel): at once
      if (next && FLOW.steps[next.step].kind === 'level') { enter(next, more); return; }
      if (STINGERS && r.ok) playStinger(env.result === 'success' ? STINGERS.victory : env.result === 'fail' ? STINGERS.defeat : null);
      // on to a screen: once the level's own end card has been read (the level says so; a level from before game-card-done
      // is given the time it always had)
      const sess = session, onward = () => { if (session !== sess) return; if (next) enter(next, more); else home(); };
      waitCard = onward;
      setTimeout(() => { if (waitCard === onward) { waitCard = null; onward(); } }, env.stats ? 2400 : 1600);
    }
  });

  // ---- pause ----
  // OWNED (docs/local-multiplayer-principles.md): the controller whose start opened the pause owns it; another's start
  // does nothing until it closes. With seats (the level's game-seats) the panel names the owner's seat in its colour.
  let paused = false, pauseBy = null, seatList = [];
  function setPaused(on, by) {
    paused = on;
    pauseBy = on ? by || null : null;
    pauseEl.style.display = on ? 'flex' : 'none';
    if (screen === 'level') post({ moj: W.pause, on });
    if (on) renderPause();
  }
  function renderPause(view) {
    pauseEl.textContent = '';
    const s = el('div', { cls: 'screen' });
    if (view === 'controls') {
      const dl = el('dl', { cls: 'keys' });
      const rows = ctlRows || [['W A S D / arrows', 'move'], ['mouse', 'look'], ['Space', 'jump']];
      for (const r of rows) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); }
      s.appendChild(el('h2', { text: 'controls' }));
      s.appendChild(dl);
      s.appendChild(el('button', { text: 'back', on: () => renderPause() }));
    } else {
      const owner = pauseBy && seatList.find((x) => x.controller === pauseBy);
      const h = el('h2', { text: owner ? 'paused · ' + owner.label : 'paused' });
      if (owner) h.style.color = owner.color;
      s.appendChild(h);
      s.appendChild(el('button', { cls: 'primary', text: 'resume', on: () => setPaused(false) }));
      s.appendChild(el('button', { text: 'restart', on: () => launch(session.level) }));
      s.appendChild(el('button', { text: 'controls', on: () => renderPause('controls') }));
      s.appendChild(el('button', { text: 'sound: ' + (settings.sfxOn ? 'on' : 'off'), on: () => { settings.sfxOn = !settings.sfxOn; saveSettings(); pushPrefs(); renderPause(); } }));
      s.appendChild(el('button', { cls: 'link', text: 'quit to ' + homeWord(), on: () => { session = null; home(); } }));
    }
    pauseEl.appendChild(s);
  }
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  // each pad's start on its own press edge: any pad opens the pause, only the one that opened it closes it
  const padPrev = {};
  (function padPoll() {
    requestAnimationFrame(padPoll);
    const cine = FLOW.steps[at.step] && FLOW.steps[at.step].kind === 'cinematic';   // a cinematic has no pause
    if (screen !== 'level' || cine || !navigator.getGamepads) { for (const k in padPrev) delete padPrev[k]; return; }
    const ps = navigator.getGamepads();
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p || !p.connected) continue;
      const id = 'pad:' + p.index, dn = cfg.pauseButtons.some((b) => p.buttons[b] && p.buttons[b].pressed);
      if (dn && !padPrev[id]) {
        if (!paused) setPaused(true, id);
        else if (!pauseBy || pauseBy === id) setPaused(false);
      }
      padPrev[id] = dn;
    }
  })();

  // ---- result ----
  // what a level's envelope gained, in words: each item's net change a slice (a sword taken and then worn is +1 in the
  // gear, nothing in the bag), the slice named when several are touched; the world's own memory (a chest's count, a
  // broken block: flags keyed <level>|… or broke:…) kept quietly
  function gainsOf(events) {
    const net = {}, order = [], out = [];
    for (const ev of events) {
      if (ev.type !== 'grant' && ev.type !== 'consume') continue;
      const k = ev.slice + '\u0001' + ev.item;
      if (!(k in net)) { net[k] = 0; order.push(k); }
      net[k] += (ev.type === 'grant' ? 1 : -1) * (ev.count === undefined ? 1 : ev.count);
    }
    const slices = {};
    for (const k of order) if (net[k]) slices[k.split('\u0001')[0]] = 1;
    const named = Object.keys(slices).length > 1;
    for (const k of order) {
      if (!net[k]) continue;
      const [sl, item] = k.split('\u0001');
      out.push((net[k] > 0 ? '+' : '−') + Math.abs(net[k]) + ' ' + item + (named ? ' · ' + sl : ''));
    }
    for (const ev of events) {
      if (ev.type === 'grant' || ev.type === 'consume') continue;
      if (ev.type === 'setFlag' && typeof ev.key === 'string' && (ev.key.indexOf('|') >= 0 || ev.key.indexOf('broke:') === 0)) continue;
      const w = eventWords(ev);
      if (w) out.push(w);
    }
    return out;
  }
  function eventWords(ev) {
    const n = ev.count === undefined ? 1 : ev.count;
    if (ev.type === 'grant') return '+' + n + ' ' + ev.item;
    if (ev.type === 'consume') return '−' + n + ' ' + ev.item;
    if (ev.type === 'setStat') return ev.stat + (ev.delta !== undefined ? (ev.delta >= 0 ? ' +' : ' ') + ev.delta : ' ' + ev.value);
    if (ev.type === 'levelUp') return 'level up';
    if (ev.type === 'setFlag') return typeof ev.key === 'string' ? ev.key.replace(/[-_:]+/g, ' ') : 'flag set';
    if (ev.type === 'recruit') return ((ev.member && ev.member.name) || ev.id || 'someone') + ' joined';
    if (ev.type === 'dismiss') return (ev.id || 'someone') + ' left';
    return null;   // promote: the result already says it
  }
  function statsTable(stats) {
    const rows = stats.rows;
    const cols = [];
    for (const r of rows) for (const k in r) if (k !== 'id' && k !== 'name' && cols.indexOf(k) < 0) cols.push(k);
    const head = el('tr', null, [el('th', { text: '' })].concat(cols.map((k) => el('th', { text: k }))));
    const body = rows.map((r) => {
      const tr = el('tr', null, [el('td', { text: r.name || r.id })].concat(cols.map((k) => el('td', { text: r[k] === undefined ? '' : (typeof r[k] === 'number' && !Number.isInteger(r[k]) ? r[k].toFixed(2) : String(r[k])) }))));
      if (stats.pilot && r.id === stats.pilot) tr.className = 'me';
      return tr;
    });
    return el('table', null, [el('thead', null, [head]), el('tbody', null, body)]);
  }
  // the KEPT numbers (a level's game.keep, sent as stats.kept): each beside the best this save has seen, and a new best
  // remembered. A low best (a time) counts only a cleared run; a high one (a score) any run.
  function keptList(lv, env) {
    const fmt = (k, v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)) + (k.unit || '');
    return el('ul', { cls: 'gains' }, env.stats.kept.map((k) => {
      const key = SAVE_KEY + ':best:' + lv.ref + ':' + k.label, v = Number(k.value);
      let prior = null;
      try { const s = storage.getItem(key); prior = s === null ? null : Number(s); } catch (e) { /* no memory */ }
      const counts = Number.isFinite(v) && (k.best === 'high' || env.result === 'success');
      const better = counts && (prior === null || (k.best === 'high' ? v > prior : v < prior));
      if (better) { try { storage.setItem(key, String(v)); } catch (e) { /* session only */ } }
      const tail = better ? (prior === null ? '' : ' · new best!') : prior !== null ? ' · best ' + fmt(k, prior) : '';
      return el('li', { text: k.label + ' ' + fmt(k, v) + tail });
    }));
  }
  function renderResult(lv, env, applied, done) {
    session = null;
    show('result');
    const res = env.result === 'success' ? 'cleared' : env.result === 'fail' ? 'failed' : 'left';
    const idx = LEVELS.indexOf(lv), next = MAP ? null : LEVELS[idx + 1];   // a map goes on by its exits, not by order
    const shut = MAP && env.result === 'success' && env.exit ? (lv.exits || []).find((x) => x.id === env.exit) : null;
    const gains = applied ? gainsOf(env.events || []) : [];
    const kids = [
      el('div', { cls: 'result-mark' + (env.result === 'success' ? '' : ' fail'), text: res }),
      el('h1', { text: lv.title }),
      gains.length ? el('ul', { cls: 'gains' }, gains.map((g) => el('li', { text: g }))) : null,
      applied ? null : el('div', { cls: 'muted', text: 'The level\'s outcome could not be applied, so nothing was saved from this run.' }),
      done && M.final ? el('div', { cls: 'badge', text: 'the game is complete' }) : null,
      shut && shut.gate ? el('div', { cls: 'muted', text: 'The way to ' + levelTitle(shut.to) + ' is shut: ' + needs(shut.gate) + '.' }) : null,
      env.stats && Array.isArray(env.stats.rows) && env.stats.rows.length ? statsTable(env.stats) : null,
      env.stats && Array.isArray(env.stats.kept) && env.stats.kept.length ? keptList(lv, env) : null,
      el('div', { cls: 'row' }, [
        env.result === 'success' && next && isOpen(next) && onOf('next') ? el('button', { cls: 'primary', text: 'next: ' + next.title, on: () => go('next') }) : null,
        onOf('again') ? el('button', { cls: env.result === 'success' && next ? '' : 'primary', text: env.result === 'success' ? 'play again' : 'try again', on: () => go('again') }) : null,
        onOf('home') ? el('button', { text: homeWord(), on: () => go('home') }) : null,
      ]),
    ];
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, kids));
  }

  // ---- the front (play-front.js), when the game has one: it reads the shell through this, and only this ----
  const allCleared = () => !!progression && (M.final ? cleared(M.final) : LEVELS.every((l) => cleared(l.ref)));
  const front = cfg.front && typeof __mojFront === 'function' ? __mojFront(cfg, {
    el, app, show, saveSettings, pushPrefs, continueTo, go, poke, has: onOf,
    playtest: PLAYTEST, title: M.title,
    progress: () => (ATLAS ? atlas().at || null : runLog.length ? runLog[runLog.length - 1].levelRef || null : null),
    ...(ATLAS ? { current: () => LEVELS.find((l) => l.ref === atlas().at) || null } : {}),
    settings: () => settings,
    reset: () => { resetStore(); persist(); },
  }) : null;

  // ---- the screens in mana-ui (play-shell-mana.js), when the game has a ui: the same flow, drawn by the game UI runtime ----
  // a result as data: its outcome, what it gained and kept, what next (the steps the flow has a way on from)
  function resultInfo() {
    const o = lastOutcome;
    if (!o) return null;
    const lv = o.lv, env = o.env, won = env.result === 'success', next = MAP ? null : LEVELS[LEVELS.indexOf(lv) + 1];
    const items = [];
    if (won && next && isOpen(next) && onOf('next')) items.push({ label: 'next: ' + next.title, then: { emit: 'next' } });
    if (onOf('again')) items.push({ label: won ? 'play again' : 'try again', then: { emit: 'again' } });
    if (onOf('home')) items.push({ label: homeWord(), then: { emit: 'home' } });
    const kept = env.stats && Array.isArray(env.stats.kept) ? env.stats.kept.map((k) => ({ label: k.label, value: String(k.value) + (k.unit || '') })) : [];
    return { outcome: (won ? 'cleared' : env.result === 'fail' ? 'failed' : 'left') + ' · ' + lv.title, stats: (o.ok ? gainsOf(env.events || []) : []).map((g) => ({ label: g, value: '' })).concat(kept), rank: o.fin && M.final ? 'complete' : '', items };
  }
  // a run's end as data (the run is over once it is said)
  function runInfo() {
    if (!run || !lastOutcome) return null;
    const r = run, deep = lastOutcome.deep, won = r.at >= r.order.length, gains = lastOutcome.ok ? gainsOf(lastOutcome.env.events || []) : [];
    run = null; session = null;
    const items = [{ label: 'new run', then: { emit: 'again' } }, { label: 'title', then: { emit: 'home' } }].concat(onOf('credits') ? [{ label: 'credits', then: { emit: 'credits' } }] : []);
    return { outcome: won ? 'run complete' : 'run over', stats: [{ label: 'run ' + r.n, value: r.at + ' of ' + r.order.length }, { label: r.at > deep ? 'the deepest yet' : 'deepest', value: String(Math.max(deep, r.at)) }].concat(gains.map((g) => ({ label: g, value: '' }))), rank: '', items };
  }
  const MANA = cfg.mana && typeof __mojMana === 'function' ? __mojMana(cfg, {
    go, onOf, show, app, continueTo, saveSettings, pushPrefs, title: M.title, front: cfg.front || null,
    progress: () => (runLog.length ? runLog[runLog.length - 1].levelRef || null : null),
    settings: () => settings,
    reset: () => { resetStore(); persist(); },
    levels: () => LEVELS.map((lv) => ({ ref: lv.ref, title: lv.title, open: isOpen(lv), cleared: cleared(lv.ref), lock: isOpen(lv) ? null : lv.gate && !K.evalGate(SCHEMA, state, lv.gate) ? needs(lv.gate) : 'not found yet' })),
    result: resultInfo, run: runInfo,
  }) : null;

  // ---- the flow runner ----
  // what each special lands on, from what the shell knows (flow.js FLOW_SPECIALS), and the guard it keeps
  function flowCtx(more) {
    return Object.assign({
      resolve: (sp, c) => {
        const i = c.level ? LEVELS.findIndex((l) => l.ref === c.level) : -1;
        if (sp === '$first') return LEVELS[0] ? LEVELS[0].ref : null;
        if (sp === '$again') return c.level || null;
        if (sp === '$next') { const nx = MAP || i < 0 ? null : LEVELS[i + 1]; return nx && isOpen(nx) ? nx.ref : null; }
        if (sp === '$continue') { const lv = continueTo(); return lv ? lv.ref : null; }
        if (sp === '$picked') return c.picked || null;
        if (sp === '$travel') return c.travelTo || null;
        if (sp === '$door') return c.doorTo || null;
        if (sp === '$run') return RUN ? newRun() : null;
        if (sp === '$run-next') return run && run.at < run.order.length ? run.order[run.at].ref : null;
        return null;
      },
      guard: (g, c, to) => (g === 'complete' ? !!c.complete : g === 'unseen' ? !seenSteps[to] : false),
    }, more || {});
  }
  // continue: the open level after the last one played, else the first open one not cleared
  function continueTo() {
    // (a megaworld: continue is the current map, where the player is)
    if (ATLAS) return LEVELS.find((l) => l.ref === atlas().at) || null;
    const last = runLog.length ? runLog[runLog.length - 1].levelRef || null : null;
    if (!last) return null;
    const i = LEVELS.findIndex((l) => l.ref === last);
    const firstUncleared = LEVELS.find((l) => isOpen(l) && !cleared(l.ref)) || null;
    return LEVELS.slice(i + 1).find((l) => isOpen(l) && !cleared(l.ref)) || firstUncleared || LEVELS[i] || null;
  }
  // does the step the game is on take this event (a screen draws only the buttons its step leads somewhere from)
  function onOf(event) { const s = FLOW.steps[at.step]; return !!(s && ((s.on && s.on[event] !== undefined) || (!s.on && s.next !== undefined))); }
  // an event on the step the game is on: where it leads is entered (false: it leads nowhere)
  function go(event, more) {
    const m = more || {}, next = FK.stepFlow(FLOW, at.step, event, flowCtx(Object.assign({}, m, { level: at.level })));
    if (!next) return false;
    enter(next, m);
    return true;
  }
  // an event a hold waits for (the level's first frame, its card read)
  function signal(name) { if (holdUntil && holdUntil === name) { holdUntil = null; go('next'); } }
  // the player is here: a screen left alone goes on by its idle
  function poke() { if (idleAfter) { clearTimeout(idleTimer); idleTimer = setTimeout(() => go('idle'), idleAfter * 1000); } }
  window.addEventListener('keydown', poke);
  window.addEventListener('pointerdown', poke);
  // a step entered: a level plays, a screen is drawn, a hold waits, a cinematic plays on its stage
  function enter(next, more) {
    const m = more || {}, s = FLOW.steps[next.step];
    if (CINE) next = CINE.arrive(next, s, at);
    at = next;
    clearTimeout(holdTimer); clearTimeout(idleTimer); holdUntil = null; idleAfter = 0;
    if (s.kind === 'level') {
      const lv = LEVELS.find((l) => l.ref === next.level);
      if (!lv) { toast('No level ' + next.level + '.'); return; }
      // a cinematic kept its stage: the level it played on goes on, the same page, the player's now
      if (m.keepPage && session && session.level.ref === lv.ref) { pauseBtn.style.display = 'block'; return; }
      // travel says where it came from, and arrives at that end of the level; a door carries what it brought
      if (m.travelTo === lv.ref && m.from) toast(levelTitle(m.from) + ' → ' + lv.title);
      launch(lv, m.travelTo === lv.ref ? m.from : null, m.doorTo === lv.ref ? m.carry : null);
      return;
    }
    if (s.kind === 'screen') { drawScreen(s.screen); if (s.idle) { idleAfter = s.idle.after; poke(); } return; }
    if (s.kind === 'hold') { if (s.for) holdTimer = setTimeout(() => { if (at === next) go('next'); }, s.for * 1000); else holdUntil = s.until; return; }
    // a cinematic: seen from now on (an opening plays on a first boot)
    seenSteps[next.step] = 1;
    try { storage.setItem(SEEN_KEY, JSON.stringify(seenSteps)); } catch (e) { /* session only */ }
    // a cutscene played as a video (play-cine.js): over the game, on no level's page
    if (CINE && CINE.play(next, s)) return;
    // played on its stage, the level's page, with no pause button (Esc and a held key are the scene's skip);
    // the level says when it ends. A level that never answers (a page from before stages) is given two minutes
    const stage = LEVELS.find((l) => l.ref === s.stage);
    if (!stage) { holdTimer = setTimeout(() => { if (at === next) go('next'); }, 0); return; }
    launch(stage, null, null, { scene: s.scene, ...(s.skip === false ? { skip: false } : {}) });
    pauseBtn.style.display = 'none';
    holdTimer = setTimeout(() => { if (at === next) go('next', { keepPage: !!s.keep }); }, 120000);
  }
  function drawScreen(name) {
    session = null;
    if (MANA && MANA.draw(name)) return;
    if (name === 'attract') return front ? front.attract() : renderPress();
    if (name === 'title') return front ? front.title() : RUN ? renderRunTitle() : renderTitle();
    if (name === 'levels') return renderLevels();
    if (name === 'options') return front ? front.options() : renderOptions();
    if (name === 'credits') return front && cfg.front.credits ? front.roll() : renderCredits();
    if (name === 'end') { if (!(front && front.end())) renderEnd(); return; }
    if (name === 'result') return lastOutcome ? renderResult(lastOutcome.lv, lastOutcome.env, lastOutcome.ok, lastOutcome.fin) : home();
    if (name === 'run-result') return renderRunResult();
  }
  // the screens a flow may name that a game without a front has none of: plain, and each its one way on
  const plain = (kids) => { show('title'); app.textContent = ''; app.appendChild(el('div', { cls: 'screen center' }, kids)); };
  function renderPress() { plain([el('h1', { text: M.title }), el('button', { cls: 'primary big', text: 'press start', on: () => go('press') })]); }
  function renderOptions() {
    plain([el('h2', { text: 'options' }), el('button', { text: 'sound: ' + (settings.sfxOn ? 'on' : 'off'), on: () => { settings.sfxOn = !settings.sfxOn; saveSettings(); pushPrefs(); renderOptions(); } }), el('button', { cls: 'primary', text: 'back', on: () => go('back') })]);
  }
  function renderCredits() { plain([el('h1', { text: M.title }), el('div', { cls: 'muted', text: 'made with mojulo · github.com/zombico/mojulo' }), el('button', { cls: 'primary', text: 'done', on: () => go('done') })]); }
  function renderEnd() { plain([el('div', { cls: 'result-mark', text: 'game complete' }), el('h1', { text: M.title }), el('button', { cls: 'primary', text: 'done', on: () => go('done') })]); }

  // ---- go: the flow's start, or a playtest's level straight away ----
  const start = cfg.startLevel ? LEVELS.find((l) => l.ref === cfg.startLevel) : null;
  if (start) { const st = FK.levelStep(FLOW, start.ref); if (st) enter(st); else launch(start); }
  else enter(FK.startOf(FLOW, flowCtx({ level: null })));
}
