/**
 * THE TABLE'S UI — a board game's page drawn by the game UI runtime (control/lib/mana-ui/, internal name mana-ui): opt
 * in by a tabletop game's `ui` ({ theme?, languages?, language? }). One spec and one host for every tabletop page: the
 * page's kernel still says what may be done; this draws what sits round the board (the prompt and its actions, the
 * log, a hand, the table's menu, one question at a time, an offer) in the table's language (mana-ui's shelf `table`),
 * and takes keys and a pad through the controls layer (the menu scheme while a screen is up, the board scheme for the
 * cursor over the board). A game without `ui` carries none of this: no kernel, no sheet, no theme, no host.
 *
 * The seats, the calls and the result stay the table's broadcast (broadcast/broadcast-dom.js): one coverage for a page.
 *
 *   readTableUi(ui, where?)            → errors[] (teaching)
 *   tableUiTheme(ui, tv, look?)        → the theme: the game's (a preset, a theme card or its own words), else the
 *                                        table's own (table-wood, or table-felt for `look: 'felt'`), its sides the
 *                                        broadcast's kits, so a seat's chip here and its plate there agree
 *   tableUiCss(ui, tv, look?)          → the sheet, the theme and the page's frame (the board in the middle of the stage)
 *   tableUiConfig(ui)                  → DATA.ui: { spec, glyphs, menu: { keys, pad }, board: { keys, pad } }
 *   tableUiScript()                    → the page's code: the kernel, the controls host, the pad reader
 *   tableUiBody(inner)                 → the page's body round what the page plays on (its board, its felt)
 *   tableMana(cfg, manaUi, hostK, padLayout) → UI   (inlined; references only its arguments and the DOM)
 *     UI.show({ prompt, actions, log?, resources?, hand?, menu, zones? })   what the table reads now. An action, a menu
 *       row, a card and a choice carry `run`, a function of the page's: the host keeps it and the row carries its id
 *       actions: [{ name, key?, count?, active?, disabled?, why?, run }]   key: the letter that does it, with no screen up
 *       zones: [{ id, title, row?, size?: s | m, cards: [{ …a card's words, disabled?, why?, run? }] }]   a table of cards (no board): one
 *         screen of grids, moved through with the cursor
 *     UI.ask({ title, text, choices: [{ label, disabled?, why?, run }], columns?, cancel? })   one question; cancel:
 *       a function when the choice may be put off (back), absent when it must be made
 *     UI.offer({ title, give, get: [{ label, key, max }], draft, valid(draft) → why | '', run(draft) })   a trade
 *     UI.cursor({ points: [[x, y]…], at?, show(i), pick(i), back() → handled? }) → { at(), set(i), points(p, at?) }
 *       the board's cursor: the board scheme's intents moved over the cells' places on the screen (a place with no
 *       point is stepped over: a board whose targets change says them again with points())
 *     UI.close() · UI.busy() → a screen is up (the board's pointer waits)
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme, THEMES } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';
import { SCHEMES } from '../controls/schemes.js';
import { THEME_CARD_IDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['theme', 'languages', 'language'];
const USED = ['action-bar', 'game-log', 'card-hand', 'pause-menu', 'choice-prompt', 'trade-offer'];
// the table's own words, in English: a game's `languages` say them over these
const WORDS = { menu: 'Menu', resume: 'Resume', newGame: 'New game', undo: 'Undo', level: 'Level', view: 'View', offer: 'Offer', table: 'The table' };
const B = (p) => ({ bind: `t.${p}` });

const themeOf = (v) => (typeof v === 'string' && !THEMES[v] && THEME_CARD_IDS.includes(v) ? cardTheme(v) : v);

/** A tabletop game's `ui`: every fault said. */
export function readTableUi(ui, where = 'tabletop.ui') {
  if (!isObj(ui)) return [`${where} is { theme?, languages?, language? }: the look the table's parts are drawn in by the game UI runtime`];
  const errors = [];
  for (const k of Object.keys(ui)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not part of a table's ui (${KEYS.join(', ')})`);
  if (ui.theme !== undefined) { try { readTheme(themeOf(ui.theme)); } catch (e) { errors.push(`${where}.theme: ${e.message}`); } }
  if (ui.languages !== undefined || ui.language !== undefined) {
    try { manaUi.readSpec({ screens: {}, languages: ui.languages, language: ui.language }); } catch (e) { errors.push(`${where}: ${e.message}`); }
  }
  return errors;
}

/** The theme a table is drawn in: the game's, else the table's own materials; its sides the broadcast's kits. */
export function tableUiTheme(ui = {}, tv = null, look = 'wood') {
  const base = themeOf(ui.theme === undefined ? (look === 'felt' ? 'table-felt' : 'table-wood') : ui.theme);
  const sides = tv && Array.isArray(tv.colors) ? tv.colors.map((c) => c.base).slice(0, 8) : null;
  const theme = sides && sides.length ? { from: base, sides } : base;
  readTheme(theme);
  return theme;
}

// the page's frame: what is played on sits in the middle of the stage, the table's parts round it (the runtime's root
// is fixed over the page; its HUD passes the pointer through to the board)
const FRAME = `
  html,body{height:100%}
  body.table-ui{margin:0;overflow:hidden}
  body.table-ui main{display:flex;flex-flow:column nowrap;align-items:center;justify-content:center;gap:10px;height:100%;padding:12px 16px;box-sizing:border-box}
  body.table-ui .tv-bug{flex:0 0 auto}
  body.table-ui .tv-stage{flex:0 0 0px;width:100%}
  body.table-ui #boards{flex:0 1 auto;min-height:0}
  body.table-ui .viewport{max-height:74vh}
  body.table-ui #plan svg{max-height:74vh;max-width:100%;height:auto}
  body.table-ui #plan svg:not([width]){width:min(92vw,100vh)}
  body.table-ui #status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  body.table-ui .in-hand{position:fixed;left:5%;bottom:22%;width:110px;height:110px;z-index:41}
  /* a table of cards: its zones clear the seats' plates above them and the log and the actions at their side */
  body.table-ui main:not(:has(#boards)){justify-content:flex-start}
  body.table-ui .mana-screen[data-key=cards]{padding-top:13vh;padding-right:27%}
  body.table-ui .mana-screen[data-key=cards] .mana-each[data-dir=row]{align-items:flex-start;gap:calc(24 * var(--mana-du))}
  body.table-ui .mana-screen[data-key=cards] .mana-cell{padding:2px;min-height:0;border-color:transparent}
  body.table-ui .cur{outline:3px dashed currentColor;outline-offset:-3px}`;

export function tableUiCss(ui = {}, tv = null, look = 'wood') {
  return `${manaCss()}\n${themeCss(tableUiTheme(ui, tv, look))}${FRAME}`;
}

/** The spec every tabletop page runs: a HUD of the table's parts over the board, and its screens. */
export function tableUiSpec(ui = {}) {
  const hud = { use: 'hud', children: [
    { use: 'region', props: { at: 'top-left' }, children: [{ use: 'button', props: { label: { word: 'menu' } }, on: { accept: { emit: 'menu' } } }] },
    { use: 'game-log', props: { rows: B('log'), visible: 8 }, when: B('logged') },
    { use: 'region', props: { at: 'bottom-left' }, when: B('held'), children: [{ use: 'each', props: { dir: 'row', rows: B('resources'), row: { use: 'counter', props: { label: { item: 'label' }, value: { item: 'value' } } } } }] },
    { use: 'card-hand', props: { cards: B('hand') }, when: B('handed') },
    { use: 'action-bar', props: { prompt: B('prompt'), actions: B('actions') } },
  ] };
  const zone = { use: 'stack', props: { gap: 'tight' }, children: [
    { use: 'text', props: { value: { item: 'title' }, role: 'heading' } },
    { use: 'grid', props: { cells: { item: 'cards' }, columns: { item: 'columns' }, empty: '—', cell: { use: 'card', props: { name: { item: 'name' }, cost: { item: 'cost' }, text: { item: 'text' }, tags: { item: 'tags' }, power: { item: 'power' }, guard: { item: 'guard' }, count: { item: 'count' }, side: { item: 'side' }, state: { item: 'state' }, face: { item: 'face' }, size: { item: 'size' } } } }, on: { accept: { item: 'then' } } },
  ] };
  const screens = {
    menu: { use: 'pause-menu', props: { title: { word: 'menu' }, items: B('menu') } },
    // one question: with no way out, back does nothing; with one, back takes it
    ask: { use: 'choice-prompt', props: { title: B('ask.title'), ask: B('ask.text'), choices: B('ask.choices'), columns: B('ask.columns'), cancel: B('ask.cancel') } },
    offer: { use: 'trade-offer', props: { title: B('offer.title'), give: B('offer.give'), get: B('offer.get'), invalid: B('offer.invalid'), why: B('offer.why'), then: { emit: 'offer' } } },
    // a table of cards: every zone a grid, the cursor crossing from one to the next; back opens the table's menu
    cards: { use: 'screen', props: { layer: 'overlay', place: 'full', legend: 'none' }, on: { back: { emit: 'menu' } }, children: [{ use: 'each', props: { rows: B('zoneRows'), row: { use: 'each', props: { dir: 'row', rows: { item: 'zones' }, row: zone } } } }] },
  };
  const languages = { ...(ui.languages || {}) };
  languages.en = { ...WORDS, ...(languages.en || {}) };
  const full = withIdioms({ hud, screens, languages, ...(ui.language ? { language: ui.language } : {}) });
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USED.includes(k)));
  manaUi.readSpec(full);
  return full;
}

export function tableUiConfig(ui = {}) {
  const menu = manaControls(), board = manaControls({ scheme: SCHEMES.board, accept: [] });
  return { spec: tableUiSpec(ui), glyphs: manaGlyphs(), menu: { keys: menu.keys, pad: menu.pad }, board: { keys: board.keys, pad: board.pad } };
}

export const tableUiScript = () => `const __manaUi = ${manaUiSource()};
const __manaHostK = ${manaHostSource()};
const __manaPadLayout = (${padLayoutSource()});
const UI = (${tableMana.toString()})(DATA.ui, __manaUi, __manaHostK, __manaPadLayout);`;

/** The body of a table's page: what is played on, the status for a reader, and the runtime's root. */
export const tableUiBody = (inner) => `<body class="table-ui"><main>${inner}</main><span id="status" aria-live="polite"></span><div id="mana"></div>`;

/**
 * The page's code (inlined with toString(); references nothing but its arguments and the DOM): one runtime over the
 * page, what it reads kept here, each row's `run` kept by its id.
 */
export function tableMana(cfg, manaUi, hostK, padLayout) {
  const t = { prompt: '', actions: [], log: [], logged: false, resources: [], held: false, hand: [], handed: false, menu: [], zones: [], zoneRows: [], ask: {}, offer: {} };
  const state = { t };
  let runs = [], shown = { runs: [] }, asked = { runs: [] }, offered = null, cur = null, keyed = {};
  const keep = (bag, fn) => { bag.push(fn); return bag.length - 1; };
  const root = document.getElementById('mana');
  const rt = manaUi.runtime(cfg.spec, { read: (p) => manaUi.readPath(state, p), act, now: () => performance.now() / 1000, cues: 'silent' });
  rt.glyphs(cfg.glyphs);
  const view = manaUi.mount(root, rt, { auto: true });
  window.__manaUi = rt; window.__tableUi = state;   // the runtime and what it reads, for a headless driver
  // a key pressed while a screen is up is that screen's, whatever it closes: the board never also acts on it (the
  // hosts listen in the capture phase in the order they connect; this one is first, the board's is last)
  let menuKey = false;
  window.addEventListener('keydown', () => { menuKey = !!rt.state().screen; }, true);
  hostK.connect(rt, view, { keys: cfg.menu.keys, pad: cfg.menu.pad, padLayout });

  // a row the table reads, its function kept: { emit: 'run', bag, id } finds it again
  const row = (bag, name, r) => { const o = {}; for (const k in r) if (k !== 'run') o[k] = r[k]; if (typeof r.run === 'function' && !r.disabled) o.then = { emit: 'run', bag: name, id: keep(bag, r.run) }; return o; };
  const bags = () => ({ shown: shown.runs, asked: asked.runs });

  function act(e) {
    if (e.emit === 'mana:closed') { if (t.zones.length && !rt.state().screen) rt.open('cards'); return; }
    if (e.emit === 'menu') { rt.open('menu'); view.paint(); return; }
    if (e.emit === 'run') {
      const fn = (bags()[e.bag] || [])[e.id];
      // a pick from a screen that is not the table of cards leaves it first (the menu, a question)
      if (e.bag === 'asked' || rt.state().screen === 'menu') { rt.close(); if (t.zones.length) rt.open('cards'); }
      if (fn) fn();
      view.paint();
      return;
    }
    if (e.emit === 'ask:cancel') { const c = asked.cancel; rt.close(); if (t.zones.length) rt.open('cards'); if (c) c(); view.paint(); return; }
    if (e.emit === 'offer' && offered) { const o = offered; rt.close(); o.run(Object.assign({}, o.draft)); view.paint(); return; }
    if (typeof e.set === 'string' && offered) {
      const k = e.set.split('.').pop();
      offered.draft[k] = e.to;
      const why = offered.valid(offered.draft) || '';
      t.offer.invalid = !!why; t.offer.why = why;
    }
  }

  function show(m) {
    shown = { runs: [] }; keyed = {};
    t.prompt = m.prompt || '';
    t.actions = (m.actions || []).map((a, i) => { const r = row(shown.runs, 'shown', a); if (!r.key && i < 9) r.key = String(i + 1); if (r.key && r.then) keyed[String(r.key).toUpperCase()] = shown.runs[r.then.id]; return r; });
    t.log = m.log || []; t.logged = t.log.length > 0;
    t.resources = m.resources || []; t.held = t.resources.length > 0;
    t.hand = (m.hand || []).map((c) => row(shown.runs, 'shown', c)); t.handed = t.hand.length > 0;
    t.menu = (m.menu || []).map((r) => row(shown.runs, 'shown', r));
    // zones that share a `row` sit side by side, each as wide as its cards
    t.zones = (m.zones || []).map((z) => ({ id: z.id, title: z.title, at: z.row || 0, columns: Math.max(1, Math.min(z.columns || 12, z.cards.length)), cards: z.cards.map((c) => Object.assign(row(shown.runs, 'shown', c), { size: z.size === 'm' ? 'm' : 's' })) }));
    t.zones = t.zones.map((z, i) => [z, i]).sort((a, b) => a[0].at - b[0].at || a[1] - b[1]).map((x) => x[0]);
    t.zoneRows = [];
    for (const z of t.zones) { const last = t.zoneRows[t.zoneRows.length - 1]; if (last && last.id === z.at) last.zones.push(z); else t.zoneRows.push({ id: z.at, zones: [z] }); }
    if (t.zones.length && !rt.state().screen) rt.open('cards');
    rt.tick(); view.paint();
  }
  function ask(q) {
    asked = { runs: [], cancel: typeof q.cancel === 'function' ? q.cancel : null };
    t.ask = { title: q.title || '', text: q.text || '', columns: q.columns || Math.min(4, q.choices.length), choices: q.choices.map((c) => row(asked.runs, 'asked', c)), cancel: asked.cancel ? { emit: 'ask:cancel' } : undefined };
    if (rt.state().screen === 'ask') rt.close();
    rt.open('ask'); view.paint();
  }
  function offer(o) {
    offered = { draft: Object.assign({}, o.draft), valid: o.valid, run: o.run };
    state.d = offered.draft;
    const rows = (list) => list.map((r) => ({ label: r.label, var: 'd.' + r.key, max: r.max }));
    const why = o.valid(offered.draft) || '';
    t.offer = { title: o.title || '', give: rows(o.give), get: rows(o.get), invalid: !!why, why };
    rt.open('offer'); view.paint();
  }

  // the board's cursor: the board scheme's intents over the cells' places on the screen. It is the controls layer's
  // host again, the board standing where a screen would: while no screen is up, the board has the keys and the pads
  function cursor(c) {
    cur = { at: c.at >= 0 ? c.at : 0, c };
    const step = (dx, dy) => {
      const P = cur.c.points, o = P[cur.at];
      let best = -1, score = Infinity;
      for (let i = 0; i < P.length; i++) {
        if (i === cur.at || !P[i] || !o) continue;
        const ax = (P[i][0] - o[0]) * dx + (P[i][1] - o[1]) * dy, across = Math.abs((P[i][0] - o[0]) * dy) + Math.abs((P[i][1] - o[1]) * dx);
        if (ax <= 0.5) continue;
        const s = ax + across * 2.5;
        if (s < score) { score = s; best = i; }
      }
      if (best >= 0) { cur.at = best; cur.c.show(best); }
    };
    const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const board = {
      state: () => ({ screen: rt.state().screen || menuKey ? null : 'board', input: rt.state().input, layout: rt.state().layout }),
      input: (mode, layout) => rt.input(mode, layout),
      typing: () => false,
      press(a) {
        if (DIR[a]) step(DIR[a][0], DIR[a][1]);
        else if (a === 'confirm') cur.c.pick(cur.at);
        else if (a === 'back') { if (!(cur.c.back && cur.c.back())) { rt.open('menu'); view.paint(); } }
        else return false;
        return true;
      },
    };
    hostK.connect(board, view, { keys: cfg.board.keys, pad: cfg.board.pad, padLayout });
    window.addEventListener('keydown', () => { menuKey = false; }, true);
    cur.c.show(cur.at);
    return { at: () => cur.at, set(i) { if (i >= 0) { cur.at = i; cur.c.show(i); } }, points(p, at) { cur.c.points = p; if (at >= 0) cur.at = at; } };
  }

  // an action's own letter, with no screen up (a table of cards is a screen: its cards are picked with the cursor)
  // (in the capture phase, as the hosts listen: a host that takes a key stops it there; a key a scheme in use owns is
  // the scheme's, never an action's)
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;
    const up = rt.state().screen;
    if (up && up !== 'cards') return;
    if ((up ? cfg.menu.keys : cur ? cfg.board.keys : {})[ev.code]) return;
    const fn = keyed[String(ev.key || '').toUpperCase()];
    if (fn) { ev.preventDefault(); fn(); view.paint(); }
  }, true);

  return { show, ask, offer, cursor, close() { rt.close(); view.paint(); }, busy: () => { const s = rt.state().screen; return !!s && s !== 'cards'; }, rt };
}
