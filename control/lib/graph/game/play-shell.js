/**
 * play-shell — the light game shell: one self-contained page that runs a game whose levels are worlds, for
 * quick games end to end and as the playtester of the big design loop (design_game's levels).
 *
 * `emitPlayShell(manifest, levels, { playtest?, startLevel?, stingers?, frontArt?, gameRef? })` → one dependency-free html page. It speaks the
 * same wire as the arena shell (level-contract.js) and inlines the same store kernel (store-kernel.js), so a
 * level and a save behave the same under either; what it leaves out is everything the arena grew for itself
 * (hangar picks, liveries, map carousels, difficulty, battle music, AI switches, menus).
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
import { CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_DOOR, MSG_AUDIO, MSG_PAUSE, MSG_CONTROLS, MSG_GAMEPAD } from './level-contract.js';
import { FONTS, FONT_IDS, STYLE_TOKENS, hexToRgba } from './hud-widgets.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';
import { FRONT_CSS, frontConfig, playFrontRuntime } from './play-front.js';
import { readScreen } from './screen.js';
import { shellLanguage, pickLanguage } from './game-languages.js';

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

export function emitPlayShell(manifest, levels = [], { playtest = false, startLevel = null, stingers = null, frontArt = null, gameRef = null } = {}) {
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
  // LANGUAGES (game-languages.js): the player's language picked on the page among the game's, the shell's words and the
  // game's own in each, each level asked for in it (`gameRef`: the game the World route reads the table from). The table
  // rides cfg.lang alone, not the manifest. Absent: no key, no code
  const lang = manifest.languages ? shellLanguage(manifest, gameRef) : null;
  const cfg = {
    manifest: lang ? { ...manifest, languages: undefined } : manifest,
    levels: levelTable,
    ...(lang ? { lang } : {}),
    ...(links ? { links } : {}),
    theme: Object.keys(levelTheme).length ? levelTheme : null,
    playtest: !!playtest,
    startLevel,
    ...(manifest.run ? { run: { length: manifest.run.length } } : {}),
    // the result's stingers (music.victory / music.defeat, resolved to srcs): absent, no key
    ...(stingers && (stingers.victory || stingers.defeat) ? { stingers: { victory: stingers.victory || null, defeat: stingers.defeat || null } } : {}),
    wire: { version: CONTRACT_VERSION, ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, audio: MSG_AUDIO, pause: MSG_PAUSE, controls: MSG_CONTROLS, gamepad: MSG_GAMEPAD, ...(links ? { door: MSG_DOOR } : {}) },
    pauseButtons: PAUSE_BUTTONS,
    // THE FRONT (play-front.js): a title over a cover, the start menu, options, credits, the end; absent, no key
    ...(manifest.front ? { front: frontConfig(manifest.front, frontArt, { levels: levelTable.length, run: !!manifest.run }) } : {}),
  };
  const front = !!cfg.front;
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
  #pause{position:fixed;inset:0;z-index:7;display:none;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bg) 72%,transparent);backdrop-filter:blur(6px)}
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
  ${FRONT_CSS}` : ''}
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
const __mojFront = (${playFrontRuntime.toString()});` : ''}${lang ? `
const __mojPick = (${pickLanguage.toString()});` : ''}
const K = (${buildGameStoreKernel.toString()})();
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
  // every word the shell shows goes through T: the shell's own (a template, its {slots} filled) and the game's (its
  // title, its levels' names), looked up in the player's language when the game has languages (cfg.lang), else as written
  let words = null;
  function T(s, args) {
    let out = (words && typeof s === 'string' && words[s]) || s;
    if (args) out = String(out).replace(/\{(\w+)\}/g, (m, k) => (k in args ? String(args[k]) : m));
    return out;
  }
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
  function freshStore() { state = K.createStore(SCHEMA); runLog = []; }
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
  const isOpen = (lv) => PLAYTEST || (MAP ? !!K.reachable(SCHEMA, state, LEVELS)[lv.ref] : K.evalGate(SCHEMA, state, lv.gate));
  const needs = (g) => (g.completed ? T('clear {level} first', { level: levelTitle(g.completed) }) : g.has ? (g.count > 1 ? T('needs {count} × {item}', { count: g.count, item: T(g.has) }) : T('needs a {item}', { item: T(g.has) })) : T('locked'));
  const sliceKind = (name) => (SCHEMA.slices.find((s) => s.name === name) || {}).kind;
  const levelTitle = (ref) => T((LEVELS.find((l) => l.ref === ref) || {}).title || ref);

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
    body.appendChild(el('button', { cls: 'link', text: 'reset store', on: () => { freshStore(); persist(); lastErrors = null; renderDebug(); if (screen !== 'level') home(); } }));
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
  const home = () => (front ? front.title() : RUN ? renderRunTitle() : LEVELS.length > 1 ? renderLevels() : renderTitle());
  // where the result and the pause send the player back to: the front's title, else the levels or the title
  const homeWord = () => (front ? T('title') : LEVELS.length > 1 ? T('levels') : T('title'));
  const quitWord = () => (front ? T('quit to title') : LEVELS.length > 1 ? T('quit to levels') : T('quit to title'));

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
  function startRun() {
    const n = num(RUNS_KEY) + 1;
    keep(RUNS_KEY, n);
    run = { n, order: roll(n), at: 0 };
    launch(run.order[0]);
  }
  function renderRunTitle() {
    show('title');
    const deep = num(DEEP_KEY), runs = num(RUNS_KEY);
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, [
      PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null,
      el('h1', { text: T(M.title) }),
      el('div', { cls: 'muted', text: T('a run: {length} of {levels} levels, drawn anew each time; fall, and it ends', { length: RUN.length, levels: LEVELS.length }) }),
      runs ? el('div', { cls: 'badge', text: runs === 1 ? T('deepest: {deep} of {length} · {runs} run', { deep, length: RUN.length, runs }) : T('deepest: {deep} of {length} · {runs} runs', { deep, length: RUN.length, runs }) }) : null,
      el('div', { cls: 'row' }, [el('button', { cls: 'primary big', text: runs ? T('new run') : T('start a run'), on: startRun })]),
      !PLAYTEST && runLog.length ? resetLink() : null,
      langLink(),
    ]));
  }
  // a level of the run ended: on to the next, or the run's end
  function runOutcome(env, applied) {
    if (env.result === 'success') run.at += 1;
    const deep = num(DEEP_KEY), won = run.at >= run.order.length;
    if (run.at > deep) keep(DEEP_KEY, run.at);
    if (env.result === 'success' && !won) { toast(T('cleared {at} of {of}', { at: run.at, of: run.order.length })); launch(run.order[run.at]); return; }
    const r = run, gains = applied ? gainsOf(env.events || []) : [];
    run = null; session = null;
    show('result');
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, [
      el('div', { cls: 'result-mark' + (won ? '' : ' fail'), text: won ? T('run complete') : T('run over') }),
      el('h1', { text: T('run {n}: {at} of {of}', { n: r.n, at: r.at, of: r.order.length }) }),
      el('div', { cls: 'muted', text: r.at > deep ? T('the deepest yet') : T('deepest: {deep}', { deep: Math.max(deep, r.at) }) }),
      gains.length ? el('ul', { cls: 'gains' }, gains.map((g) => el('li', { text: g }))) : null,
      env.stats && Array.isArray(env.stats.kept) && env.stats.kept.length ? keptList(r.order[Math.min(r.at, r.order.length - 1)], env) : null,
      el('div', { cls: 'row' }, [el('button', { cls: 'primary', text: T('new run'), on: startRun }), el('button', { text: T('title'), on: home }), front && cfg.front.credits ? el('button', { text: T('credits'), on: () => front.rollFromRun() }) : null]),
    ]));
  }

  function renderTitle() {
    show('title');
    const first = LEVELS[0];
    const kids = [
      PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null,
      el('h1', { text: T(M.title) }),
      LEVELS.length > 1 ? el('div', { cls: 'muted', text: T('{n} levels', { n: LEVELS.length }) }) : (cleared(first.ref) ? el('div', { cls: 'badge', text: T('cleared') }) : null),
      el('div', { cls: 'row' }, [el('button', { cls: 'primary big', text: T('play'), on: () => (LEVELS.length > 1 ? renderLevels() : launch(first)) })]),
      !PLAYTEST && runLog.length ? resetLink() : null,
      langLink(),
    ];
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, kids));
  }

  function resetLink() {
    let armed = false;
    const b = el('button', { cls: 'link', text: T('reset progress') });
    b.addEventListener('click', () => {
      if (!armed) { armed = true; b.textContent = T('tap again to reset'); return; }
      freshStore(); persist(); home();
    });
    return b;
  }

  function renderLevels() {
    show('levels');
    const s = el('div', { cls: 'screen' }, [
      el('div', { cls: 'center screen' }, [PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null, el('h1', { text: T(M.title) })]),
    ]);
    const lastAt = MAP && runLog.length ? runLog[runLog.length - 1].levelRef : null;
    LEVELS.forEach((lv, i) => {
      const open = isOpen(lv);
      const gated = lv.gate && !K.evalGate(SCHEMA, state, lv.gate);
      const lock = open ? null : (gated ? needs(lv.gate) : T('not found yet'));
      // a map's rows say where their exits lead, and what locks them
      const ways = MAP && open && lv.exits ? lv.exits.map((x) => '→ ' + levelTitle(x.to) + (x.gate && !K.evalGate(SCHEMA, state, x.gate) ? ' (' + needs(x.gate) + ')' : '')).join('  ·  ') : null;
      s.appendChild(el('div', { cls: 'card' }, [
        el('div', { cls: 'muted', text: String(i + 1) }),
        el('div', { cls: 'grow' }, [el('div', { cls: 'name', text: T(lv.title) }), lock ? el('div', { cls: 'muted', text: lock }) : null, ways ? el('div', { cls: 'muted', text: ways }) : null]),
        lastAt === lv.ref ? el('span', { cls: 'badge', text: T('last here') }) : null,
        cleared(lv.ref) ? el('span', { cls: 'badge', text: T('cleared') }) : null,
        el('button', { cls: open ? 'primary' : '', text: T('play'), disabled: open ? null : 'disabled', on: () => { if (open) launch(lv); } }),
      ]));
    });
    if (!PLAYTEST && runLog.length) s.appendChild(el('div', { cls: 'row' }, [resetLink()]));
    if (LANG && !front) s.appendChild(el('div', { cls: 'row' }, [langLink()]));
    if (front) s.appendChild(el('div', { cls: 'row' }, [el('button', { cls: 'link', text: T('title'), on: home })]));
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

  let veilCap = 0, ctlRows = null;
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
  function launch(lv, arrive, carry) {
    if (stingerEl) stingerEl.pause();
    if (STINGERS) { warmStinger(STINGERS.victory); warmStinger(STINGERS.defeat); }
    launches += 1;
    const params = carry || paramsFor(lv);
    if (arrive) params.arrive = arrive;
    session = { level: lv, params, seed: (run ? run.n * 100 + run.at + 1 : PLAYTEST ? launches : runLog.length + 1), ended: false };
    lastParams = session.params; lastErrors = null;
    ctlRows = null;
    show('level');
    $('veilText').textContent = T(lv.title);
    veil.style.display = 'flex';
    clearTimeout(veilCap);
    veilCap = setTimeout(() => { veil.style.display = 'none'; }, 45000);   // a level without the bridge still shows
    frame.src = LANG ? langSrc(lv.src) : lv.src;
  }
  function post(msg) { try { if (frame.contentWindow) frame.contentWindow.postMessage(msg, '*'); } catch (e) { /* opaque frame */ } }
  const pushPrefs = () => {
    post({ moj: W.audio, on: settings.sfxOn, volume: 1 });
    post({ moj: W.gamepad, on: true, deadZone: 0.15, lookScale: 18, invertY: false });
  };
  frame.addEventListener('load', pushPrefs);

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || !session || e.source !== frame.contentWindow) return;
    if (d.moj === W.controls) { ctlRows = Array.isArray(d.rows) && d.rows.length ? d.rows : null; if (paused) renderPause(); return; }
    if (d.moj === W.ready) {
      clearTimeout(veilCap); veil.style.display = 'none';
      if (d.contractVersion !== W.version) { toast(T('This level speaks a newer contract (v{v}); re-make the game.', { v: d.contractVersion })); return; }
      post({ moj: W.init, contractVersion: W.version, params: session.params, seed: session.seed, theme: cfg.theme });
      pushPrefs();
      return;
    }
    // a door crossed (a building whose scene changes at its door): what the session gathered applies, and the level
    // the door opens into loads, entered by its own door
    if (W.door && d.moj === W.door && !session.ended) {
      const r = K.applyTransit(SCHEMA, state, session.level.contract, d.envelope || {});
      if (!r.ok) { lastErrors = r.errors; toast(T('The door could not be taken; nothing changed.')); return; }
      state = r.state;
      if ((d.envelope && d.envelope.events || []).length) runLog.push(d.envelope);
      persist();
      const to = (cfg.links[session.level.ref] || {})[d.door], lv = to && LEVELS.find((l) => l.ref === to.ref);
      if (!lv) { toast(T('That door leads nowhere.')); return; }
      if (!PLAYTEST && lv.gate && !K.evalGate(SCHEMA, state, lv.gate)) { toast(T('{level} is locked.', { level: T(lv.title) })); return; }
      const carry = JSON.parse(JSON.stringify(session.params || {}));
      carry.__entry = { door: to.door, from: session.level.ref };
      launch(lv, null, carry);
      return;
    }
    if (d.moj === W.outcome && !session.ended) {
      session.ended = true;
      // THE END: a game with a final level (M.final) is cleared by its first win alone
      const before = (front || M.final) && allCleared();
      const env = d.envelope || {};
      lastEnvelope = env;
      const r = K.applyOutcome(SCHEMA, state, session.level.contract, env);
      if (!r.ok) { lastErrors = r.errors; toast(T('The level sent an outcome the game could not apply; nothing changed.')); }
      else {
        state = r.state;
        if (env.result === 'success' && progression && !state[progression].completed[session.level.ref]) {
          const pr = K.applyEvents(SCHEMA, state, [{ type: 'promote', slice: progression, ref: session.level.ref, result: 'success' }]);
          if (pr.ok) state = pr.state;
        }
        runLog.push(env);
        persist();
      }
      // a RUN: on to its next level, or its end
      if (run) { const sess = session; setTimeout(() => { if (session === sess) runOutcome(env, r.ok); }, 1400); return; }
      // the game first completed: the end, not on through the level's exit
      const fin = (front || M.final) && !before && r.ok && env.result === 'success' && allCleared();
      // TRAVEL (a map game): a success through an open exit goes straight on to the level it leads to
      const to = !(fin && M.final) && r.ok && env.result === 'success' && env.exit ? K.travel(SCHEMA, state, LEVELS, session.level.ref, env.exit) : null;
      const onward = to && LEVELS.find((l) => l.ref === to);
      if (onward) { toast(T(session.level.title) + ' → ' + T(onward.title)); launch(onward, session.level.ref); return; }
      if (STINGERS && r.ok) playStinger(env.result === 'success' ? STINGERS.victory : env.result === 'fail' ? STINGERS.defeat : null);
      const sess = session;
      // the last level first cleared: the front's end (its card, then the roll) in place of the result
      // the level shows its own end card first; the result follows it
      setTimeout(() => { if (session !== sess) return; if (fin && front && front.end()) { session = null; return; } renderResult(sess.level, env, r.ok, fin); }, env.stats ? 2400 : 1600);
    }
  });

  // ---- pause ----
  let paused = false;
  function setPaused(on) {
    paused = on;
    pauseEl.style.display = on ? 'flex' : 'none';
    if (screen === 'level') post({ moj: W.pause, on });
    if (on) renderPause();
  }
  function renderPause(view) {
    pauseEl.textContent = '';
    const s = el('div', { cls: 'screen' });
    if (view === 'controls') {
      const dl = el('dl', { cls: 'keys' });
      const rows = ctlRows || [[T('W A S D / arrows'), T('move')], [T('mouse'), T('look')], [T('Space'), T('jump')]];
      for (const r of rows) { dl.appendChild(el('dt', { text: keyName(T(r[0])) })); dl.appendChild(el('dd', { text: T(r[1]) })); }
      s.appendChild(el('h2', { text: T('controls') }));
      s.appendChild(dl);
      s.appendChild(el('button', { text: T('back'), on: () => renderPause() }));
    } else {
      s.appendChild(el('h2', { text: T('paused') }));
      s.appendChild(el('button', { cls: 'primary', text: T('resume'), on: () => setPaused(false) }));
      s.appendChild(el('button', { text: T('restart'), on: () => launch(session.level) }));
      s.appendChild(el('button', { text: T('controls'), on: () => renderPause('controls') }));
      s.appendChild(el('button', { text: settings.sfxOn ? T('sound: on') : T('sound: off'), on: () => { settings.sfxOn = !settings.sfxOn; saveSettings(); pushPrefs(); renderPause(); } }));
      s.appendChild(el('button', { cls: 'link', text: quitWord(), on: () => { session = null; home(); } }));
    }
    pauseEl.appendChild(s);
  }
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  let padPrev = false;
  (function padPoll() {
    requestAnimationFrame(padPoll);
    if (screen !== 'level' || !navigator.getGamepads) { padPrev = false; return; }
    let dn = false;
    const ps = navigator.getGamepads();
    for (let i = 0; i < ps.length && !dn; i++) { const p = ps[i]; if (p && p.connected) dn = cfg.pauseButtons.some((b) => p.buttons[b] && p.buttons[b].pressed); }
    if (dn && !padPrev) setPaused(!paused);
    padPrev = dn;
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
      out.push(T('{delta} {item}', { delta: (net[k] > 0 ? '+' : '−') + Math.abs(net[k]), item: T(item) }) + (named ? ' · ' + sl : ''));
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
    if (ev.type === 'grant') return T('{delta} {item}', { delta: '+' + n, item: T(ev.item) });
    if (ev.type === 'consume') return T('{delta} {item}', { delta: '−' + n, item: T(ev.item) });
    if (ev.type === 'setStat') return T(ev.stat) + (ev.delta !== undefined ? (ev.delta >= 0 ? ' +' : ' ') + ev.delta : ' ' + ev.value);
    if (ev.type === 'levelUp') return T('level up');
    if (ev.type === 'setFlag') return typeof ev.key === 'string' ? ev.key.replace(/[-_:]+/g, ' ') : T('flag set');
    if (ev.type === 'recruit') return T('{who} joined', { who: T((ev.member && ev.member.name) || ev.id || T('someone')) });
    if (ev.type === 'dismiss') return T('{who} left', { who: T(ev.id || T('someone')) });
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
      // the label as the level keeps it (the best is remembered by it), shown in the player's language
      const said = { label: T(k.label), value: fmt(k, v) };
      return el('li', { text: better && prior !== null ? T('{label} {value} · new best!', said) : !better && prior !== null ? T('{label} {value} · best {best}', { ...said, best: fmt(k, prior) }) : T('{label} {value}', said) });
    }));
  }
  function renderResult(lv, env, applied, done) {
    session = null;
    show('result');
    const res = env.result === 'success' ? T('cleared') : env.result === 'fail' ? T('failed') : T('left');
    const idx = LEVELS.indexOf(lv), next = MAP ? null : LEVELS[idx + 1];   // a map goes on by its exits, not by order
    const shut = MAP && env.result === 'success' && env.exit ? (lv.exits || []).find((x) => x.id === env.exit) : null;
    const gains = applied ? gainsOf(env.events || []) : [];
    const kids = [
      el('div', { cls: 'result-mark' + (env.result === 'success' ? '' : ' fail'), text: res }),
      el('h1', { text: T(lv.title) }),
      gains.length ? el('ul', { cls: 'gains' }, gains.map((g) => el('li', { text: g }))) : null,
      applied ? null : el('div', { cls: 'muted', text: T('The level\'s outcome could not be applied, so nothing was saved from this run.') }),
      done && M.final ? el('div', { cls: 'badge', text: T('the game is complete') }) : null,
      shut && shut.gate ? el('div', { cls: 'muted', text: T('The way to {level} is shut: {needs}.', { level: levelTitle(shut.to), needs: needs(shut.gate) }) }) : null,
      env.stats && Array.isArray(env.stats.rows) && env.stats.rows.length ? statsTable(env.stats) : null,
      env.stats && Array.isArray(env.stats.kept) && env.stats.kept.length ? keptList(lv, env) : null,
      el('div', { cls: 'row' }, [
        env.result === 'success' && next && isOpen(next) ? el('button', { cls: 'primary', text: T('next: {level}', { level: T(next.title) }), on: () => launch(next) }) : null,
        el('button', { cls: env.result === 'success' && next ? '' : 'primary', text: env.result === 'success' ? T('play again') : T('try again'), on: () => launch(lv) }),
        el('button', { text: homeWord(), on: home }),
      ]),
    ];
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, kids));
  }

  // ---- the LANGUAGE (cfg.lang, a game with languages: game-languages.js shellLanguage) ----
  // picked once among the game's, the player's browser's first that it offers, then kept with the settings; the page set
  // in it (its tag, direction and script typesetting), the shell's words and the game's looked up in its table, and each
  // level asked for in it (the World route serves the level's words localized). Absent: none of this runs.
  const LANG = cfg.lang || null;
  let lang = null, langCss = null, keyMap = null, realKeys = null;
  // a key's letter as the player's keyboard has it: the board itself where the browser says (navigator.keyboard), else
  // the layout the language's players mostly have (ZQSD on AZERTY); a prompt's letters are QWERTY places
  const keyName = (s) => (realKeys || keyMap ? String(s).replace(/\b[A-Z]\b/g, (c) => { const k = realKeys ? realKeys.get('Key' + c) : null; return k ? k.toUpperCase() : (keyMap && keyMap[c]) || c; }) : s);
  if (LANG && navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { realKeys = m; }).catch(() => {});
  function setLanguage(tag) {
    lang = tag;
    words = LANG.t[tag] || null;
    keyMap = LANG.keys[tag] || null;
    document.documentElement.lang = tag;
    if (LANG.rtl.indexOf(tag) >= 0) document.documentElement.dir = 'rtl'; else document.documentElement.removeAttribute('dir');
    if (!langCss) { langCss = document.createElement('style'); document.head.appendChild(langCss); }
    langCss.textContent = LANG.css[tag] || '';
    document.title = T(M.title);
  }
  function chooseLanguage(tag) { settings.lang = tag; saveSettings(); setLanguage(tag); }
  const langName = (tag) => LANG.names[tag] || tag;
  // the language's own name on the link, never translated: someone lost in a language finds theirs by its name
  const langLink = () => (LANG && !front ? el('button', { cls: 'link', text: T('language') + ': ' + langName(lang), on: renderLanguages }) : null);
  function renderLanguages() {
    const back = screen;
    show('languages');
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, [el('h2', { text: T('language') })].concat(LANG.locales.map((tag) => el('button', {
      cls: tag === lang ? 'primary' : '', lang: tag, text: langName(tag), on: () => { chooseLanguage(tag); home(); },
    })), [el('button', { cls: 'link', text: T('back'), on: () => (back === 'levels' ? renderLevels() : home()) })])));
  }
  const langSrc = (src) => src + (src.indexOf('?') >= 0 ? '&' : '?') + 'lang=' + encodeURIComponent(lang) + (LANG.game ? '&game=' + encodeURIComponent(LANG.game) : '');
  // ?lang=<tag> opens the game in that language (a shared link, a localizer's check) without keeping it as the player's
  const asked = LANG ? /(?:^|[?&])lang=([^&#]+)/.exec(location.search.slice(1)) : null, askedTag = asked ? decodeURIComponent(asked[1]) : null;
  if (LANG) setLanguage(LANG.locales.indexOf(askedTag) >= 0 ? askedTag : LANG.locales.indexOf(settings.lang) >= 0 ? settings.lang : __mojPick(LANG.locales, navigator.languages || [navigator.language], LANG.fallback));

  // ---- the front (play-front.js), when the game has one: it reads the shell through this, and only this ----
  const allCleared = () => !!progression && (M.final ? cleared(M.final) : LEVELS.every((l) => cleared(l.ref)));
  const front = cfg.front && typeof __mojFront === 'function' ? __mojFront(cfg, {
    el, app, show, home, launch, startRun, renderLevels, cleared, isOpen, saveSettings, pushPrefs,
    levels: LEVELS, run: !!RUN, playtest: PLAYTEST, title: M.title,
    progress: () => (runLog.length ? runLog[runLog.length - 1].levelRef || null : null),
    settings: () => settings,
    reset: () => { freshStore(); persist(); },
    T,
    ...(LANG ? { lang: { list: LANG.locales.map((tag) => ({ tag, name: langName(tag) })), current: () => lang, choose: chooseLanguage } } : {}),
  }) : null;

  // ---- go ----
  const start = cfg.startLevel ? LEVELS.find((l) => l.ref === cfg.startLevel) : null;
  if (start) launch(start); else home();
}
