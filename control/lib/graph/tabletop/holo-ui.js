/**
 * THE HOLO ARENA'S UI — the arena's overlay drawn by the game UI runtime (control/lib/mana-ui/, internal name
 * mana-ui): opt in by an arena's `ui` ({ theme?, languages?, language? }). The arena's client (holo-arena.client.js)
 * still plays the duel; what it drew on a canvas (each duelist's life points, the title, the status line, the duel's
 * words) and its picker are the runtime's parts, and the board takes keys and a pad through the controls layer's
 * `board` scheme (a cursor over the cells as the camera shows them). An arena without `ui` carries none of this.
 *
 *   readHoloUi(ui, where?)        → errors[] (teaching)
 *   holoUiData(ui, { colours })   → HOLO_ARENA.ui: { spec, css, glyphs, menu: { keys, pad }, board: { keys, pad } } (the
 *                                   theme's sides the duelists' lights)
 *   holoManaPage(cfg, kit)        → (inlined) UI:
 *     UI.show({ title, seats: [{ name, lp, max, live }], status, banner })   what stands now (drawn again when it changed)
 *     UI.ask([{ label, run }])    one question (a promotion, a drop); back puts it off
 *     UI.board({ points() → [[x, y] | null…], first() → cell, show(cell), pick(cell), back() → handled? })
 *     UI.busy()                   a question is up (the pointer waits)
 *   The kit (the runtime, the controls host, the pad reader) is the board UI's: board/board-ui.js boardUiKit.
 */
import { manaUi, withIdioms, manaCss, themeCss, readTheme, THEMES } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs } from '../controls/mana-controls.js';
import { SCHEMES } from '../controls/schemes.js';
import { THEME_CARD_IDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['theme', 'languages', 'language'];
const SCOPE = '#mana-holo .mana-root';
const B = (p) => ({ bind: `t.${p}` });
const themeOf = (v) => (typeof v === 'string' && !THEMES[v] && THEME_CARD_IDS.includes(v) ? cardTheme(v) : v);
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });

/** An arena's `ui`: every fault said. */
export function readHoloUi(ui, where = 'holo.ui') {
  if (!isObj(ui)) return [`${where} is { theme?, languages?, language? }: the look the arena's parts are drawn in by the game UI runtime`];
  const errors = [];
  for (const k of Object.keys(ui)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not part of an arena's ui (${KEYS.join(', ')})`);
  if (ui.theme !== undefined) { try { readTheme(themeOf(ui.theme)); } catch (e) { errors.push(`${where}.theme: ${e.message}`); } }
  if (ui.languages !== undefined || ui.language !== undefined) {
    try { manaUi.readSpec({ screens: {}, languages: ui.languages, language: ui.language }); } catch (e) { errors.push(`${where}: ${e.message}`); }
  }
  return errors;
}

/** The spec an arena runs: the two duelists across the top, the title between, the status at the foot, the duel's words. */
export function holoUiSpec(ui = {}) {
  // a duelist's corner: who it is (alight on its turn), its life points as a number and a bar; the second mirrors the first
  const corner = (n, dir) => ({ use: 'stack', props: { gap: 'tight' }, children: [
    { use: 'stack', props: { dir: 'row', gap: 'normal', align: dir === 'rtl' ? 'end' : 'start' }, children: dir === 'rtl'
      ? [{ use: 'text', props: { value: B(`d${n}.lp`), role: 'numeral' } }, { use: 'badge', props: { value: B(`d${n}.name`), side: n, turn: B(`d${n}.live`), variant: 'strong' } }]
      : [{ use: 'badge', props: { value: B(`d${n}.name`), side: n, turn: B(`d${n}.live`), variant: 'strong' } }, { use: 'text', props: { value: B(`d${n}.lp`), role: 'numeral' } }] },
    { use: 'bar', props: { value: B(`d${n}.lp`), max: B(`d${n}.max`), variant: 'hp', size: 'thin', figures: false, dir } },
  ] });
  const hud = { use: 'hud', children: [
    { use: 'region', props: { at: 'top' }, when: B('on'), children: [{ use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center', fill: true }, children: [corner(0, 'ltr'), txt(B('title'), 'label'), corner(1, 'rtl')] }] },
    { use: 'region', props: { at: 'bottom' }, when: B('said'), children: [txt(B('status'), 'label')] },
    { use: 'region', props: { at: 'center' }, when: B('called'), children: [{ use: 'banner', props: { value: B('banner') } }] },
  ] };
  const screens = { ask: { use: 'choice-prompt', props: { title: { word: 'choose' }, ask: '', choices: B('choices'), columns: B('columns'), cancel: { emit: 'put-off' } } } };
  const languages = { ...(ui.languages || {}) };
  languages.en = { choose: 'Choose', ...(languages.en || {}) };
  const full = withIdioms({ hud, screens, languages, ...(ui.language ? { language: ui.language } : {}) });
  full.defs = { 'choice-prompt': full.defs['choice-prompt'] };
  manaUi.readSpec(full);
  return full;
}

/** What the page takes for its `ui`: the spec, the sheet and the theme (scoped to the arena's own root), the controls. */
export function holoUiData(ui = {}, { colours = [] } = {}) {
  const theme = { from: themeOf(ui.theme === undefined ? 'modern' : ui.theme), transition: 'none', backdrop: 'none', ...(colours.length ? { sides: colours.slice(0, 8) } : {}) };
  readTheme(theme);
  const menu = manaControls(), board = manaControls({ scheme: SCHEMES.board, accept: [] });
  return { spec: holoUiSpec(ui), css: `${manaCss(SCOPE)}\n${themeCss(theme, SCOPE)}`, glyphs: manaGlyphs([SCHEMES.menu, SCHEMES.board]), menu: { keys: menu.keys, pad: menu.pad }, board: { keys: board.keys, pad: board.pad } };
}

/** The page's code (inlined with toString(); references nothing but its arguments and the DOM). */
export function holoManaPage(cfg, kit) {
  const manaUi = kit.manaUi;
  const st = document.createElement('style');
  st.textContent = cfg.css;
  document.head.appendChild(st);
  const root = document.createElement('div');
  root.id = 'mana-holo';
  document.body.appendChild(root);
  const t = { on: false, title: '', d0: {}, d1: {}, status: '', said: false, banner: '', called: false, choices: [], columns: 1 };
  const state = { t };
  let runs = [], was = '', B0 = null, cur = -1;
  const rt = manaUi.runtime(cfg.spec, { read: (p) => manaUi.readPath(state, p), act, now: () => performance.now() / 1000, cues: 'silent' });
  rt.glyphs(cfg.glyphs);
  const view = manaUi.mount(root, rt, { auto: true });
  window.__mojHoloUi = { rt, state };   // the runtime and what it reads, for a headless driver
  // a key pressed while a question is up is the question's, whatever it closes: the board never also acts on it
  let menuKey = false;
  window.addEventListener('keydown', () => { menuKey = !!rt.state().screen; }, true);
  kit.hostK.connect(rt, view, { keys: cfg.menu.keys, pad: cfg.menu.pad, padLayout: kit.padLayout });

  function act(e) {
    if (e.emit === 'run') { const fn = runs[e.id]; rt.close(); if (fn) fn(); view.paint(); return; }
    if (e.emit === 'put-off') { rt.close(); view.paint(); }
  }
  function show(m) {
    const key = JSON.stringify(m);
    if (key === was) return;
    was = key;
    const seat = (s) => (s ? { name: s.name, lp: s.lp, max: s.max, live: !!s.live } : {});
    t.on = !!(m.seats && m.seats.length); t.title = m.title || '';
    t.d0 = seat(m.seats && m.seats[0]); t.d1 = seat(m.seats && m.seats[1]);
    t.status = m.status || ''; t.said = !!m.status;
    t.banner = m.banner || ''; t.called = !!m.banner;
  }
  function ask(choices) {
    runs = choices.map((c) => c.run);
    t.choices = choices.map((c, k) => ({ id: 'c' + k, label: c.label, then: { emit: 'run', id: k } }));
    t.columns = Math.min(4, choices.length);
    if (rt.state().screen) rt.close();
    rt.open('ask'); view.paint();
  }
  // the board's cursor: the board scheme's intents over the cells as the camera shows them now
  function board(b) {
    B0 = b;
    const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const step = (dx, dy) => {
      const P = B0.points(), o = P[cur];
      let best = -1, score = Infinity;
      for (let i = 0; i < P.length; i++) {
        if (i === cur || !P[i] || !o) continue;
        const ax = (P[i][0] - o[0]) * dx + (P[i][1] - o[1]) * dy, across = Math.abs((P[i][0] - o[0]) * dy) + Math.abs((P[i][1] - o[1]) * dx);
        if (ax <= 0.004) continue;
        const sc = ax + across * 2.5;
        if (sc < score) { score = sc; best = i; }
      }
      if (best >= 0) { cur = best; B0.show(cur); }
    };
    const host = {
      state: () => ({ screen: rt.state().screen || menuKey ? null : 'board', input: rt.state().input, layout: rt.state().layout }),
      input: (mode, layout) => rt.input(mode, layout),
      typing: () => false,
      press(a) {
        if (cur < 0) { cur = B0.first(); B0.show(cur); if (DIR[a]) return true; }
        if (DIR[a]) step(DIR[a][0], DIR[a][1]);
        else if (a === 'confirm') B0.pick(cur);
        else if (a === 'back') B0.back();
        else return false;
        return true;
      },
    };
    kit.hostK.connect(host, view, { keys: cfg.board.keys, pad: cfg.board.pad, padLayout: kit.padLayout });
    window.addEventListener('keydown', () => { menuKey = false; }, true);
  }
  return { show, ask, board, busy: () => !!rt.state().screen };
}
