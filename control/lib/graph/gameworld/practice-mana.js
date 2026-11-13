/**
 * THE PRACTICE DOOR'S MENU ON MANA-UI — the work room's and the game room's choices and readout drawn by the game UI
 * runtime (control/lib/mana-ui/), driven by the controls layer (controls/mana-host.js), so one input paradigm runs the
 * room: the keys, every pad layout and a finger pick the same rows, and what each control is called is the controls
 * kernel's, never a page's own words. It is the game shell's pause, kept on the page: the pilot scheme's `pause`
 * (controls/schemes.js) opens it, the scene is held on the shell's own sidecar (level-contract.js MSG_PAUSE: the sim and
 * its clocks frozen, the live control rows answered), and the foes are woken on the shell's AI switch (MSG_AI, the
 * path the pilot's own `aiToggle` takes).
 *
 *   the screens  pause (resume, how to play, the room, set up, controls: mana-ui's pause-menu), how to play (the
 *                tutorial in tabs: the goal, the keys, the work, the floor: what the page no longer says on the screen),
 *                the room (its readout in tabs: the shift or the brief, what was measured, the laws, the place), set up (the movement, the worker,
 *                the dress and the area as cyclers, the foes as a switch; the room reopened with them), controls (the
 *                live rows the scene answers with: only the controls this world answers to)
 *   the brief    open as the page loads, over the held room: the danger room's briefing; resume plays
 *
 *   practiceManaSpec({ foes? }) → the spec (validated by mana-ui's readSpec)
 *   practiceMana({ title, how?, about, choices, foes?, query? }) → cfg: { spec, glyphs, controls, open, state, query }
 *     how      [{ label, lines: [text | { action | glyph, text }] }]   the tutorial's tabs (a key line a prompt: the
 *              glyph of the device in hand)
 *     about    [{ label, lines: [text] }]   the readout's tabs
 *     choices  [{ id: 'feel' | 'cast' | 'dress' | 'area', label, options: [{ id, name }], now: id }]
 *     foes     true where the room has foes to wake (a switch, still at first)
 *     query    the page's own query ({ book, room, … }): set up reopens the room with it and the choices; absent (a page
 *              saved to disk), set up says it cannot
 *   practiceManaHtml(cfg) → the sheet and the script laid into a page (the kernel, the host, the runtime)
 *   theme    the look (a preset, a card resolved, a theme object): the shift family's card for the room's trade
 *            (playscape/ui/theme-cards/shift-*.json), drawn on the menu and on the play around it (playCss)
 *   playCss(theme) → the HUD's counters, its hint line, the use prompt and the page's margin in the theme's look
 *   practiceLegend(words) → the hint bar's line, each action named by its key as the pilot scheme binds it
 *   keyOf(action | [actions]) → an action's key as the pilot scheme binds it
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme, FACE_STACKS } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';
import { MSG_PAUSE, MSG_CONTROLS, MSG_AI } from '../game/level-contract.js';

const K = buildControlsKernel();
const B = (p) => ({ bind: `pr.${p}` });
const I = (f) => ({ item: f });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });
const back = { use: 'button', props: { label: { word: 'back' } }, on: { accept: { back: true } } };

/** An action's key as the pilot scheme binds it (a list: the keys joined, W A S D); a word no action owns as itself. */
export function keyOf(a) {
  const g = manaGlyphs().keys;
  return Array.isArray(a) ? a.map((x) => g[x] ?? x).join(' ') : g[a] ?? a;
}
/** The hint bar's line: [action, what it does] pairs, each action named by its key. */
export function practiceLegend(words) {
  return words.map(([a, what]) => `${keyOf(a)}  ${what}`).join(' · ');
}

/** The menu's screens (see the header). */
export function practiceManaSpec({ foes = false } = {}) {
  const screens = {
    pause: { use: 'pause-menu', props: { title: B('title'), items: B('menu') } },
    // how to play: the tutorial, the keys and the work in a few lines a tab (what the page used to say on the screen)
    how: { use: 'screen', props: { title: 'How to play', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
      // (a line with a key is a prompt: the key of the device in hand, a cap, beside what it does)
      { use: 'tabs', props: { pages: B('how'), page: { use: 'each', props: { rows: I('lines'), row: { use: 'stack', children: [
        { use: 'prompt', props: { action: I('action'), glyph: I('glyph'), label: I('text') }, when: I('key') },
        { use: 'text', props: { value: I('text') }, unless: I('key') },
      ] } } } } },
      back,
    ] }] }] },
    about: { use: 'screen', props: { title: 'The room', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'tabs', props: { pages: B('about'), page: { use: 'each', props: { rows: I('lines'), row: txt(I('text')) } } } },
      back,
    ] }] }] },
    setup: { use: 'screen', props: { title: 'Set up', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'each', props: { rows: B('fields'), row: { use: 'field', props: { kind: I('kind'), label: I('label'), value: { bind: I('var') }, options: I('options') } } } },
      { use: 'stack', props: { dir: 'row' }, children: [
        { use: 'button', props: { label: 'Reopen the room', disabled: B('fixed'), why: B('why') }, on: { accept: { emit: 'practice:apply' } } },
        back,
      ] },
    ] }] }] },
    controls: { use: 'screen', props: { title: 'Controls', place: 'center' }, children: [{ use: 'window', children: [{ use: 'stack', children: [
      { use: 'each', props: { rows: B('controls'), row: { use: 'stack', props: { dir: 'row', align: 'apart' }, children: [txt(I('label')), txt(I('keys'), 'label')] } } },
      back,
    ] }] }] },
  };
  void foes;
  const full = withIdioms({ screens });
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => k === 'pause-menu'));
  manaUi.readSpec(full);
  return full;
}

// the pilot's pause, as the page opens the menu with it: its key codes, and its pad button on the standard mapping
function openControls() {
  const B0 = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad });
  const keys = Object.entries(K.codeMap(B0, 'keyboard')).filter(([, a]) => a === 'pause').map(([c]) => c);
  const pad = (B0.bind.gamepad.pause || []).map((b) => DEVICES.gamepad.buttons[b]).filter((i) => i !== undefined);
  return { keys, pad };
}

// a tab's lines: words, or { action | glyph, text } (a key and what it does, drawn as a prompt)
const tabs = (list) => list.map((t) => ({ label: t.label, lines: t.lines.map((l) => (typeof l === 'string' ? { text: l } : { ...l, key: true })) }));

/** The menu's config for the page (see the header). */
export function practiceMana({ title, how = [], about = [], choices = [], foes = false, query = null, theme = 'greybox' } = {}) {
  const fields = choices.map((c) => ({ kind: 'cycler', label: c.label, var: `pr.pick.${c.id}`, options: c.options.map((o) => o.name) }));
  if (foes) fields.push({ kind: 'toggle', label: 'Foes awake', var: 'pr.foes' });
  const state = { pr: {
    title, how: tabs(how), about: tabs(about),
    menu: [{ label: 'Resume', then: { close: true } }, ...(how.length ? [{ label: 'How to play', then: { open: 'how' } }] : []), { label: 'The room', then: { open: 'about' } }, { label: 'Set up', then: { open: 'setup' } }, { label: 'Controls', then: { open: 'controls' } }],
    fields, pick: Object.fromEntries(choices.map((c) => [c.id, (c.options.find((o) => o.id === c.now) ?? c.options[0])?.name ?? ''])), foes: 0, controls: [],
    fixed: !query, why: query ? '' : 'this page was saved from the studio: open it there to choose again',
  } };
  const C = manaControls();
  const ids = Object.fromEntries(choices.map((c) => [c.id, Object.fromEntries(c.options.map((o) => [o.name, o.id]))]));
  return { theme: readTheme(theme), spec: practiceManaSpec({ foes }), glyphs: manaGlyphs(), controls: { keys: C.keys, pad: C.pad }, open: openControls(), state, ids, query, foes: !!foes,
    msg: { pause: MSG_PAUSE, controls: MSG_CONTROLS, ai: MSG_AI } };
}

/**
 * The play around the menu in the menu's look: the HUD's counters and its hint line as the theme's tickets (its plate,
 * its ink, its heavy line, a slab of the accent offset under each, its rounded face), the use prompt a ticket with its
 * key a cap, and the page's margin the plate's colour. The scene viewer's own orbit hint (a viewer's, not a game's) is
 * hidden. Only the HUD's own hooks are styled (events.js HUD_CSS's classes, its `--moj-*` tokens), never its structure.
 */
export function playCss(theme) {
  const T = readTheme(theme), k = T.tokens, face = FACE_STACKS[T.type.body] ?? FACE_STACKS.system;
  const disp = FACE_STACKS[T.type.display] ?? face, r = { round: 14, soft: 8, cut: 0, square: 0 }[T.corner] ?? 8;
  const w = { heavy: 3, double: 3, bevel: 2, rule: 2 }[T.frame] ?? 1, slab = T.backing === 'none' ? 'none' : `4px 4px 0 ${k.accent}`;
  const cut = '';   // (a cut corner is drawn square here: a clip would cut the slab off with it)
  return [
    `:root{--moj-ink:${k.ink};--moj-panel:${k.panel};--moj-panel-a:${k.panel};--moj-line:${k.line};--moj-accent:${k.accent};--moj-accent2:${k.accent2};--moj-font:${face}}`,
    `html,body{background:${k.panel}}#wrap .hint{display:none}`,
    `.moj-w{border:${w}px solid ${k.line};border-radius:${r}px;box-shadow:${slab};color:${k.ink};font-family:${face};${cut}}`,
    `.moj-w-counter .moj-val{font-family:${disp};color:${k.ink}}.moj-w-counter .moj-lbl{opacity:.75;letter-spacing:1.5px}`,
    `.moj-w-bar .moj-track{background:rgba(0,0,0,.08);border:2px solid ${k.line};height:10px}.moj-w-bar .moj-fill{background:${k.accent2}}`,
    `.moj-w-text{font-size:13px;font-weight:600;box-shadow:none;border-width:2px}`,
    // (the hint, now only the menu's key, in the corner: the bottom's middle is the hero's gauge and the use prompt)
    '.moj-hud-bottom{left:auto;right:16px;transform:none;align-items:flex-end}',
    `.moj-reach{background:${k.panel};color:${k.ink};border:${w}px solid ${k.line};border-radius:${r}px;box-shadow:${slab};font:700 15px ${face};padding:7px 14px;${cut}}`,
    `.moj-reach b{background:${k.ink};color:${k.panel};border:0;border-radius:${Math.min(r, 6)}px;padding:1px 7px}`,
  ].join('\n');
}

/** The sheet and the script a practice page lays in (the kernel, the host and the runtime inlined). */
export function practiceManaHtml(cfg) {
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  const { theme, ...page } = cfg;
  return `<style>${manaCss()}\n${themeCss(theme)}\n${playCss(theme)}</style>
<script>
const __manaUi = ${manaUiSource()};
const __manaHostK = ${manaHostSource()};
const __manaPadLayout = (${padLayoutSource()});
(${practiceManaRuntime.toString()})(${json(page)});
</script>`;
}

/**
 * The page's code (inlined with toString(); it references only the kernel, the host and the pad reader inlined beside
 * it). The menu is the scene's pause: open, the scene is held on its sidecar and answers with its live control rows;
 * the stack emptied, it plays on.
 */
export function practiceManaRuntime(cfg) {
  const S = JSON.parse(JSON.stringify(cfg.state)), P = S.pr;
  const root = document.createElement('div');
  root.id = 'mana';
  document.body.appendChild(root);
  const rt = __manaUi.runtime(cfg.spec, { read: (p) => __manaUi.readPath(S, p), act, now: () => performance.now() / 1000, cues: 'silent' });
  rt.glyphs(cfg.glyphs);
  const view = __manaUi.mount(root, rt, { auto: true });
  __manaHostK.connect(rt, view, { keys: cfg.controls.keys, pad: cfg.controls.pad, padLayout: __manaPadLayout });
  window.__mojPracticeUi = rt; window.__mojPracticeState = S;   // for a headless driver
  let up = false, shut = false;   // shut: a screen just closed by this very press (the back that left it is no pause)
  const hold = (on) => { try { window.postMessage({ moj: cfg.msg.pause, on }, '*'); } catch (e) { /* no scene */ } };
  const world = () => (window.__mojCtrl && window.__mojCtrl.world) || null;
  function open() {
    if (up) return;
    up = true;
    const W = world();
    if (cfg.foes && W) P.foes = W.aiEnabled !== false ? 1 : 0;
    rt.open('pause');
    hold(true);
    view.paint();
  }
  function act(e) {
    if (e.emit === 'mana:closed') { up = false; shut = true; setTimeout(() => { shut = false; }, 0); hold(false); return; }
    if (e.emit === 'practice:apply') {
      if (!cfg.query) return;
      const q = new URLSearchParams(cfg.query);
      for (const id of Object.keys(cfg.ids)) { const v = cfg.ids[id][P.pick[id]]; if (v != null) q.set(id, v); }
      location.search = '?' + q.toString();
      return;
    }
    if (typeof e.set === 'string' && e.set.indexOf('pr.pick.') === 0) { P.pick[e.set.slice(8)] = e.to; view.paint(); return; }
    if (e.set === 'pr.foes') { P.foes = e.to ? 1 : 0; try { window.postMessage({ moj: cfg.msg.ai, on: !!e.to }, '*'); } catch (err) { /* no scene */ } view.paint(); }
  }
  // the scene's answer to the hold: the controls this world answers to, read off its live bindings
  addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.moj === cfg.msg.controls && Array.isArray(d.rows)) { P.controls = d.rows.map((r) => ({ keys: String(r[0]), label: String(r[1]) })); view.paint(); }
  });
  // the pilot's pause opens it (its keys, its pad button), only while no screen is up: up, the host has the input
  addEventListener('keydown', (e) => { if (!up && !shut && !e.defaultPrevented && !window.__mojMenuOpen && cfg.open.keys.indexOf(e.code) >= 0) { e.preventDefault(); open(); } }, true);
  const was = {};
  (function poll() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    for (const g of pads) {
      if (!g) continue;
      const on = cfg.open.pad.some((i) => g.buttons[i] && g.buttons[i].pressed);
      if (on && !was[g.index] && !up && !shut && !window.__mojMenuOpen) open();
      was[g.index] = on;
    }
    requestAnimationFrame(poll);
  })();
  // the briefing: open over the held room once the scene stands; the foes still until woken
  (function ready() {
    if (!world()) { requestAnimationFrame(ready); return; }
    if (cfg.foes) { try { window.postMessage({ moj: cfg.msg.ai, on: false }, '*'); } catch (e) { /* no scene */ } }
    open();
  })();
}
