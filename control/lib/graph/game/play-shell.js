/**
 * play-shell — the light game shell: one self-contained page that runs a game whose levels are worlds, for
 * quick games end to end and as the playtester of the big design loop (design_game's levels).
 *
 * `emitPlayShell(manifest, levels, { playtest?, startLevel? })` → one dependency-free html page. It speaks the
 * same wire as the arena shell (level-contract.js) and inlines the same store kernel (store-kernel.js), so a
 * level and a save behave the same under either; what it leaves out is everything the arena grew for itself
 * (hangar picks, liveries, map carousels, difficulty, battle music, AI switches, menus).
 *
 * The screens: title → levels (only when the game has more than one) → playing → result.
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
import { CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_AUDIO, MSG_PAUSE, MSG_CONTROLS, MSG_GAMEPAD } from './level-contract.js';
import { FONTS, FONT_IDS, STYLE_TOKENS, hexToRgba } from './hud-widgets.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';

const CTL = buildControlsKernel();
const PAUSE_BUTTONS = CTL.resolve(SCHEMES.shell, { gamepad: DEVICES.gamepad }).bind.gamepad.pause.map((c) => DEVICES.gamepad.buttons[c]);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// JSON inside <script>: a `</script>` in a title must not close the tag
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const safeColor = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback);

export function emitPlayShell(manifest, levels = [], { playtest = false, startLevel = null } = {}) {
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
    return { ref: lv.ref, title: lv.title || l.title || lv.ref, gate: lv.gate || null, src: l.src || `levels/${lv.ref}.html`, contract: l.contract };
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

  const cfg = {
    manifest,
    levels: levelTable,
    theme: Object.keys(levelTheme).length ? levelTheme : null,
    playtest: !!playtest,
    startLevel,
    wire: { version: CONTRACT_VERSION, ready: MSG_READY, init: MSG_INIT, outcome: MSG_OUTCOME, audio: MSG_AUDIO, pause: MSG_PAUSE, controls: MSG_CONTROLS, gamepad: MSG_GAMEPAD },
    pauseButtons: PAUSE_BUTTONS,
  };

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
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
  #debug h4{margin:0;font:600 11px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.1em;color:var(--dim)}
</style></head>
<body>
<main id="app"></main>
<iframe id="frame" title="level" allow="gamepad; fullscreen; autoplay"></iframe>
<div id="veil"><div class="muted" id="veilText">loading</div><div class="bar"><i></i></div></div>
<button id="pauseBtn" aria-label="pause">☰</button>
<div id="pause"></div>
<div id="playtag">playtest · nothing is saved</div>
<details id="debug"><summary>debug</summary><div class="body" id="debugBody"></div></details>
<div id="toast" role="status"></div>
<script>
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
  const isOpen = (lv) => PLAYTEST || K.evalGate(SCHEMA, state, lv.gate);
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
    if (!playing) { setPaused(false); frame.removeAttribute('src'); veil.style.display = 'none'; }
    renderDebug();
  }
  const home = () => (LEVELS.length > 1 ? renderLevels() : renderTitle());

  function renderTitle() {
    show('title');
    const first = LEVELS[0];
    const kids = [
      PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null,
      el('h1', { text: M.title }),
      LEVELS.length > 1 ? el('div', { cls: 'muted', text: LEVELS.length + ' levels' }) : (cleared(first.ref) ? el('div', { cls: 'badge', text: 'cleared' }) : null),
      el('div', { cls: 'row' }, [el('button', { cls: 'primary big', text: 'play', on: () => (LEVELS.length > 1 ? renderLevels() : launch(first)) })]),
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
      freshStore(); persist(); home();
    });
    return b;
  }

  function renderLevels() {
    show('levels');
    const s = el('div', { cls: 'screen' }, [
      el('div', { cls: 'center screen' }, [PLAYTEST ? el('div', { cls: 'eyebrow', text: 'playtest' }) : null, el('h1', { text: M.title })]),
    ]);
    LEVELS.forEach((lv, i) => {
      const open = isOpen(lv);
      const lock = !open ? (lv.gate && lv.gate.completed ? 'clear ' + levelTitle(lv.gate.completed) + ' first' : 'locked') : null;
      s.appendChild(el('div', { cls: 'card' }, [
        el('div', { cls: 'muted', text: String(i + 1) }),
        el('div', { cls: 'grow' }, [el('div', { cls: 'name', text: lv.title }), lock ? el('div', { cls: 'muted', text: lock }) : null]),
        cleared(lv.ref) ? el('span', { cls: 'badge', text: 'cleared' }) : null,
        el('button', { cls: open ? 'primary' : '', text: 'play', disabled: open ? null : 'disabled', on: () => { if (open) launch(lv); } }),
      ]));
    });
    if (!PLAYTEST && runLog.length) s.appendChild(el('div', { cls: 'row' }, [resetLink()]));
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
  function launch(lv) {
    launches += 1;
    session = { level: lv, params: paramsFor(lv), seed: (PLAYTEST ? launches : runLog.length + 1), ended: false };
    lastParams = session.params; lastErrors = null;
    ctlRows = null;
    show('level');
    $('veilText').textContent = lv.title;
    veil.style.display = 'flex';
    clearTimeout(veilCap);
    veilCap = setTimeout(() => { veil.style.display = 'none'; }, 45000);   // a level without the bridge still shows
    frame.src = lv.src;
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
      if (d.contractVersion !== W.version) { toast('This level speaks a newer contract (v' + d.contractVersion + '); re-make the game.'); return; }
      post({ moj: W.init, contractVersion: W.version, params: session.params, seed: session.seed, theme: cfg.theme });
      pushPrefs();
      return;
    }
    if (d.moj === W.outcome && !session.ended) {
      session.ended = true;
      const env = d.envelope || {};
      lastEnvelope = env;
      const r = K.applyOutcome(SCHEMA, state, session.level.contract, env);
      if (!r.ok) { lastErrors = r.errors; toast('The level sent an outcome the game could not apply; nothing changed.'); }
      else {
        state = r.state;
        if (env.result === 'success' && progression && !state[progression].completed[session.level.ref]) {
          const pr = K.applyEvents(SCHEMA, state, [{ type: 'promote', slice: progression, ref: session.level.ref, result: 'success' }]);
          if (pr.ok) state = pr.state;
        }
        runLog.push(env);
        persist();
      }
      const sess = session;
      // the level shows its own end card first; the result follows it
      setTimeout(() => { if (session === sess) renderResult(sess.level, env, r.ok); }, env.stats ? 2400 : 1600);
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
      const rows = ctlRows || [['W A S D / arrows', 'move'], ['mouse', 'look'], ['Space', 'jump']];
      for (const r of rows) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); }
      s.appendChild(el('h2', { text: 'controls' }));
      s.appendChild(dl);
      s.appendChild(el('button', { text: 'back', on: () => renderPause() }));
    } else {
      s.appendChild(el('h2', { text: 'paused' }));
      s.appendChild(el('button', { cls: 'primary', text: 'resume', on: () => setPaused(false) }));
      s.appendChild(el('button', { text: 'restart', on: () => launch(session.level) }));
      s.appendChild(el('button', { text: 'controls', on: () => renderPause('controls') }));
      s.appendChild(el('button', { text: 'sound: ' + (settings.sfxOn ? 'on' : 'off'), on: () => { settings.sfxOn = !settings.sfxOn; saveSettings(); pushPrefs(); renderPause(); } }));
      s.appendChild(el('button', { cls: 'link', text: 'quit to ' + (LEVELS.length > 1 ? 'levels' : 'title'), on: () => { session = null; home(); } }));
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
  function eventWords(ev) {
    const n = ev.count === undefined ? 1 : ev.count;
    if (ev.type === 'grant') return '+' + n + ' ' + ev.item;
    if (ev.type === 'consume') return '−' + n + ' ' + ev.item;
    if (ev.type === 'setStat') return ev.stat + (ev.delta !== undefined ? (ev.delta >= 0 ? ' +' : ' ') + ev.delta : ' ' + ev.value);
    if (ev.type === 'levelUp') return 'level up';
    if (ev.type === 'setFlag') return ev.flag || 'flag set';
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
  function renderResult(lv, env, applied) {
    session = null;
    show('result');
    const res = env.result === 'success' ? 'cleared' : env.result === 'fail' ? 'failed' : 'left';
    const idx = LEVELS.indexOf(lv), next = LEVELS[idx + 1];
    const gains = applied ? (env.events || []).map(eventWords).filter(Boolean) : [];
    const kids = [
      el('div', { cls: 'result-mark' + (env.result === 'success' ? '' : ' fail'), text: res }),
      el('h1', { text: lv.title }),
      gains.length ? el('ul', { cls: 'gains' }, gains.map((g) => el('li', { text: g }))) : null,
      applied ? null : el('div', { cls: 'muted', text: 'The level\'s outcome could not be applied, so nothing was saved from this run.' }),
      env.stats && Array.isArray(env.stats.rows) && env.stats.rows.length ? statsTable(env.stats) : null,
      el('div', { cls: 'row' }, [
        env.result === 'success' && next && isOpen(next) ? el('button', { cls: 'primary', text: 'next: ' + next.title, on: () => launch(next) }) : null,
        el('button', { cls: env.result === 'success' && next ? '' : 'primary', text: env.result === 'success' ? 'play again' : 'try again', on: () => launch(lv) }),
        el('button', { text: LEVELS.length > 1 ? 'levels' : 'title', on: home }),
      ]),
    ];
    app.textContent = '';
    app.appendChild(el('div', { cls: 'screen center' }, kids));
  }

  // ---- go ----
  const start = cfg.startLevel ? LEVELS.find((l) => l.ref === cfg.startLevel) : null;
  if (start) launch(start); else home();
}
