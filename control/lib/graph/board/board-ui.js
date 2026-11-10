/**
 * THE BOARD'S UI — a tactics board's and a tower defence's parts drawn by the game UI runtime (control/lib/mana-ui/,
 * internal name mana-ui): opt in by a board's `ui` ({ theme?, languages?, language? }). The board page (board-page.js)
 * still plays the battle and says what may be done; this draws what it wrote as text panels (the turn order, the unit
 * in focus, the action menu, an attack's forecast, the readout, the end's word, the numbers over a blow; a defence's
 * wave, purse, lives and towers) and takes keys and a pad through the controls layer: the `board` scheme for the
 * cursor and the view, the `menu` scheme while the action menu is up. A board without `ui` carries none of this.
 *
 * A skirmish (`rts`) is drawn too (its purse, what is selected, its command card, its lobby and its results); its
 * orders stay on its own keys and the pointer, so the board scheme is not connected for it.
 *
 *   readBoardUi(ui, where?)          → errors[] (teaching)
 *   boardUiData(ui, { colours })     → D.ui: { spec, css, glyphs, menu: { keys, pad }, board: { keys, pad } } (the
 *                                      theme's sides the board's own side colours, so a chip and a token agree)
 *   boardUiKit()                     → the page's code beside the board page: the kernel, the controls host, the pad reader
 *   boardManaPage(api, kit)          → (inlined) { step(dt), pop(at, text, kind) }; api is the board page's:
 *     { ui, get() → what stands now, intent(action), refresh() (the readout said again), project(point) → [x, y] | null }
 *     get(): { mode, cursor, n, readout, banner, menu: { items: [{ label, ok, go }], back } | null,
 *              turns() → [{ name, cpu, side }], unit() → { name, side, hp, hpMax, mp, mpMax, move, jump, spd, marks } | null,
 *              forecast() → the mind's forecast | null, sides: [side…], td: a defence's hand | null, rts: a skirmish's | null }
 */
import { manaUi, manaUiSource, withIdioms, manaCss, themeCss, readTheme, THEMES } from '../../mana-ui/index.js';
import { manaControls, manaGlyphs, manaHostSource, padLayoutSource } from '../controls/mana-controls.js';
import { SCHEMES } from '../controls/schemes.js';
import { THEME_CARD_IDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['theme', 'languages', 'language'];
const USED = ['turn-order', 'damage-numbers', 'wave-status', 'resource-bar', 'skirmish-lobby', 'skirmish-results'];
const SCOPE = '#mana-board .mana-root';
const B = (p) => ({ bind: `t.${p}` });
const I = (f) => ({ item: f });
const themeOf = (v) => (typeof v === 'string' && !THEMES[v] && THEME_CARD_IDS.includes(v) ? cardTheme(v) : v);
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });

/** A board's `ui`: every fault said. */
export function readBoardUi(ui, where = 'board.ui') {
  if (!isObj(ui)) return [`${where} is { theme?, languages?, language? }: the look the board's parts are drawn in by the game UI runtime`];
  const errors = [];
  for (const k of Object.keys(ui)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not part of a board's ui (${KEYS.join(', ')})`);
  if (ui.theme !== undefined) { try { readTheme(themeOf(ui.theme)); } catch (e) { errors.push(`${where}.theme: ${e.message}`); } }
  if (ui.languages !== undefined || ui.language !== undefined) {
    try { manaUi.readSpec({ screens: {}, languages: ui.languages, language: ui.language }); } catch (e) { errors.push(`${where}: ${e.message}`); }
  }
  return errors;
}

/** The spec a board runs: the battle's parts and a defence's over the board, and the action menu. */
export function boardUiSpec(ui = {}) {
  const hud = { use: 'hud', children: [
    { use: 'turn-order', props: { turns: B('turns'), at: 'top-left' }, when: B('fight') },
    // the unit in focus: who it is, what it has left, how far it goes, what is on it
    { use: 'region', props: { at: 'top-right' }, when: B('unit.on'), children: [{ use: 'stack', props: { gap: 'tight' }, children: [
      { use: 'stack', props: { dir: 'row', gap: 'normal', align: 'center' }, children: [{ use: 'badge', props: { value: B('unit.name'), side: B('unit.side'), variant: 'strong' } }, txt(B('unit.team'), 'caption')] },
      { use: 'bar', props: { label: { word: 'hp' }, value: B('unit.hp'), max: B('unit.hpMax'), variant: 'hp' } },
      { use: 'bar', props: { label: { word: 'mp' }, value: B('unit.mp'), max: B('unit.mpMax'), variant: 'mp' }, when: B('unit.casts') },
      { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [{ use: 'stat', props: { label: { word: 'move' }, value: B('unit.move') } }, { use: 'stat', props: { label: { word: 'jump' }, value: B('unit.jump') } }, { use: 'stat', props: { label: { word: 'speed' }, value: B('unit.spd') } }] },
      { use: 'statuses', props: { rows: B('unit.marks') } },
    ] }] },
    // what an act will do before it is made, target by target
    { use: 'region', props: { at: 'right' }, when: B('aimed'), children: [{ use: 'stack', props: { gap: 'tight' }, children: [txt({ word: 'forecast' }, 'heading'),
      { use: 'table', props: { columns: [{ key: 'name', label: '' }, { key: 'now', label: { word: 'hp' }, align: 'right' }, { key: 'after', label: { word: 'after' }, align: 'right' }, { key: 'odds', label: { word: 'odds' }, align: 'right' }, { key: 'more', label: '' }], rows: B('forecast') } }] }] },
    // where the cursor is and what is there; what the controls do now
    { use: 'region', props: { at: 'bottom-left' }, children: [{ use: 'stack', props: { gap: 'tight' }, children: [{ use: 'each', props: { rows: B('readout'), row: txt(I('text'), 'label') } }, { use: 'legend', props: { rows: B('legend') } }] }] },
    // a defence: the wave, the lives and the purse; the towers on their digits and what else the hand can do
    { use: 'wave-status', props: { wave: B('td.wave'), lives: B('td.lives'), livesMax: B('td.livesMax'), money: B('td.gold') }, when: B('defence') },
    { use: 'region', props: { at: 'bottom' }, when: B('defence'), children: [{ use: 'stack', props: { gap: 'tight', align: 'center' }, children: [txt(B('td.when'), 'label'),
      { use: 'each', props: { dir: 'row', rows: B('td.hand'), row: { use: 'stack', props: { gap: 'tight', align: 'center' }, children: [{ use: 'slot', props: { name: I('name'), key: I('key'), count: I('count'), active: I('active'), disabled: I('disabled'), why: I('why') }, on: { accept: I('then') } }, txt(I('name'), 'caption')] } } }] }] },
    // a skirmish: the purse along the top, the clock and what the next click does, what is selected, its orders
    { use: 'resource-bar', props: { resources: B('rts.purse') }, when: B('skirmish') },
    { use: 'region', props: { at: 'top-left' }, when: B('skirmish'), children: [{ use: 'stack', props: { gap: 'tight' }, children: [txt(B('rts.clock'), 'numeral'), txt(B('rts.hint'), 'label')] }] },
    { use: 'region', props: { at: 'left' }, when: B('rts.picked'), children: [{ use: 'stack', props: { gap: 'tight' }, children: [
      { use: 'stack', props: { dir: 'row', gap: 'loose', align: 'center' }, children: [txt(B('rts.title'), 'heading'), txt(B('rts.hp'), 'numeral')] },
      { use: 'each', props: { rows: B('rts.lines'), row: txt(I('text'), 'label') } },
      { use: 'each', props: { dir: 'row', rows: B('rts.tiles'), row: { use: 'stack', props: { gap: 'tight' }, children: [{ use: 'button', props: { label: I('name') }, on: { accept: I('then') } }, { use: 'bar', props: { value: I('k'), max: 1, variant: 'hp', size: 'thin', figures: false } }] } } },
    ] }] },
    { use: 'region', props: { at: 'bottom-right' }, when: B('rts.ordered'), children: [{ use: 'each', props: { dir: 'row', rows: B('rts.orders'), row: { use: 'stack', props: { gap: 'tight', align: 'center' }, children: [
      { use: 'slot', props: { name: I('label'), key: I('key'), active: I('armed'), disabled: I('disabled'), why: I('why') }, on: { accept: I('then') } }, txt(I('label'), 'caption')] } } }] },
    { use: 'region', props: { at: 'center' }, when: B('ended'), children: [{ use: 'banner', props: { value: B('banner.value'), sub: B('banner.sub') } }] },
    { use: 'damage-numbers', props: { pops: B('pops') } },
  ] };
  const screens = {
    // the unit's turn: what it may do, beside the board (back: the menu before it, when there is one)
    // a match set up before it starts, and its end
    lobby: { use: 'skirmish-lobby', props: { title: { word: 'setUp' }, rows: B('rts.setup'), then: { emit: 'rts', call: 'start' } } },
    results: { use: 'skirmish-results', props: { outcome: B('rts.end.outcome'), sub: B('rts.end.sub'), rows: B('rts.end.rows'), series: B('rts.end.series'), items: B('rts.end.items') } },
    act: { use: 'screen', props: { layer: 'overlay', place: 'right' }, on: { back: { emit: 'back' } }, children: [{ use: 'window', props: { title: B('menuTitle') }, children: [{ use: 'list', id: 'act', props: { rows: B('menu') }, on: { accept: I('then') } }] }] },
  };
  const languages = { ...(ui.languages || {}) };
  languages.en = { jump: 'Jump', after: 'After', odds: 'Odds', ...(languages.en || {}) };
  const full = withIdioms({ hud, screens, languages, ...(ui.language ? { language: ui.language } : {}) });
  full.defs = Object.fromEntries(Object.entries(full.defs || {}).filter(([k]) => USED.includes(k)));
  manaUi.readSpec(full);
  return full;
}

/** What the page takes for its `ui`: the spec, the sheet and the theme (scoped to the board's own root), the controls. */
export function boardUiData(ui = {}, { colours = {} } = {}) {
  const base = themeOf(ui.theme === undefined ? 'tactician' : ui.theme), sides = Object.values(colours).slice(0, 8);
  // the action menu opens every turn: nothing covers the board as it comes and goes
  const theme = { from: base, transition: 'none', backdrop: 'none', ...(sides.length ? { sides } : {}) };
  readTheme(theme);
  const menu = manaControls(), board = manaControls({ scheme: SCHEMES.board, accept: [] });
  return { spec: boardUiSpec(ui), css: `${manaCss(SCOPE)}\n${themeCss(theme, SCOPE)}`, glyphs: manaGlyphs([SCHEMES.menu, SCHEMES.board]), menu: { keys: menu.keys, pad: menu.pad }, board: { keys: board.keys, pad: board.pad } };
}

/** The runtime, the controls host and the pad reader, as the page takes them beside the board page. */
export const boardUiKit = () => `{ manaUi: ${manaUiSource()}, hostK: ${manaHostSource()}, padLayout: (${padLayoutSource()}) }`;

/**
 * The page's code (inlined with toString(); references nothing but its arguments and the DOM): one runtime over the
 * board, what it reads rebuilt only when what the board page stands at has changed.
 */
export function boardManaPage(api, kit) {
  const cfg = api.ui, manaUi = kit.manaUi;
  const st = document.createElement('style');
  st.textContent = cfg.css;
  document.head.appendChild(st);
  const root = document.createElement('div');
  root.id = 'mana-board';
  document.body.appendChild(root);
  const t = { skirmish: false, rts: { picked: false, ordered: false }, fight: false, turns: [], unit: { on: false }, aimed: false, forecast: [], readout: [], legend: [], defence: false, td: { hand: [] }, ended: false, banner: {}, pops: [], menu: [], menuTitle: '' };
  const state = { t };
  let runs = [], keyed = {}, shown = null, was = '', pops = [], popN = 0, clock = 0, seen = null, phase = null;
  state.pick = {};
  const rt = manaUi.runtime(cfg.spec, { read: (p) => manaUi.readPath(state, p), act, now: () => clock, cues: 'silent' });
  rt.glyphs(cfg.glyphs);
  const view = manaUi.mount(root, rt, { auto: true });
  window.__mojBoardUi = { rt, state };   // the runtime and what it reads, for a headless driver

  // a key pressed while the menu is up is the menu's, whatever it closes: the board never also acts on it
  let menuKey = false;
  window.addEventListener('keydown', () => { menuKey = !!rt.state().screen; }, true);
  kit.hostK.connect(rt, view, { keys: cfg.menu.keys, pad: cfg.menu.pad, padLayout: kit.padLayout });
  // the board stands where a screen would: while no screen is up it has the keys and the pads (the board scheme)
  const board = {
    state: () => ({ screen: rt.state().screen || menuKey ? null : 'board', input: rt.state().input, layout: rt.state().layout }),
    input: (mode, layout) => rt.input(mode, layout),
    typing: () => false,
    press(a) { api.intent(a); return true; },
  };
  // (a skirmish's orders stay on its own keys and the pointer: the board is not connected, the menus are)
  if (!api.orders) kit.hostK.connect(board, view, { keys: cfg.board.keys, pad: cfg.board.pad, padLayout: kit.padLayout });
  window.addEventListener('keydown', () => { menuKey = false; }, true);
  // a defence's hand on its own keys (a tower's digit; R sells, since the board scheme's S moves the cursor; N the next
  // wave; B where a tower may stand), with no screen up
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat || rt.state().screen || cfg.board.keys[ev.code]) return;
    const fn = keyed[String(ev.key || '').toUpperCase()];
    if (fn) { ev.preventDefault(); fn(); api.refresh(); }
  }, true);

  function act(e) {
    // a match's screen left by back comes up again: the match is still in that phase
    if (e.emit === 'mana:closed') { phase = null; seen = null; return; }
    if (e.emit === 'run') { const fn = runs[e.id]; if (fn) { fn(); api.refresh(); } return; }
    if (e.emit === 'back') api.intent('back');
    const R = api.get().rts;
    if (!R) return;
    if (e.emit === 'rts' && typeof R[e.call] === 'function') { R[e.call](); return; }
    // a row of the lobby turned: its option by its place among the row's
    if (typeof e.set === 'string' && e.set.indexOf('pick.') === 0) { const k = e.set.slice(5), row = (R.view().lobby || []).find((x) => x.k === k); if (row) R.set(k, row.options.indexOf(String(e.to))); }
  }

  // what the controls do now, in the glyphs of the device in hand
  const DIRS = { actions: ['up', 'down', 'left', 'right'] }, VIEW = [{ actions: ['turnLeft', 'turnRight'], label: 'turn' }, { actions: ['zoomIn', 'zoomOut'], label: 'zoom' }, { action: 'tilt', label: 'tilt' }];
  const LEGEND = {
    free: [Object.assign({ label: 'cursor' }, DIRS), { action: 'confirm', label: 'select / move' }, { action: 'back', label: 'back' }].concat(VIEW),
    move: [Object.assign({ label: 'cursor' }, DIRS), { action: 'confirm', label: 'move here' }, { action: 'back', label: 'back' }],
    aim: [Object.assign({ label: 'cursor' }, DIRS), { action: 'confirm', label: 'act here' }, { action: 'back', label: 'back' }],
    face: [Object.assign({ label: 'face that way' }, DIRS), { action: 'confirm', label: 'end the turn' }, { action: 'back', label: 'back' }],
    deploy: [Object.assign({ label: 'cursor' }, DIRS), { action: 'confirm', label: 'place here' }, { action: 'back', label: 'take the last one back' }],
    map: [Object.assign({ label: 'choose a place' }, DIRS), { action: 'confirm', label: 'go there' }].concat(VIEW),
    td: [Object.assign({ label: 'cursor' }, DIRS), { action: 'confirm', label: 'build' }],
    cpu: VIEW.slice(0, 2),
  };

  function sync(g) {
    runs = []; keyed = {};
    const keep = (fn) => { runs.push(fn); return { emit: 'run', id: runs.length - 1 }; };
    const sideOf = (s) => { const k = g.sides.indexOf(s); return k >= 0 ? k : undefined; };
    const turns = g.turns();
    t.fight = turns.length > 0;
    t.turns = turns.map((x, k) => ({ name: x.name, variant: k === 0 ? 'strong' : x.cpu ? 'muted' : 'plain', turn: k === 0, side: sideOf(x.side) }));
    const U = g.unit();
    t.unit = U ? { on: true, name: U.name, team: U.side, side: sideOf(U.side), hp: U.hp, hpMax: U.hpMax, casts: U.mpMax > 0, mp: U.mp, mpMax: U.mpMax || 1, move: U.move, jump: U.jump, spd: U.spd, marks: U.marks } : { on: false };
    const F = g.forecast();
    t.aimed = !!(F && F.length);
    t.forecast = (F || []).map((f, k) => ({ id: 'f' + k, name: f.name, now: f.hurt != null ? f.hp : '', after: f.hurt != null ? '~' + Math.max(0, f.hp - f.hurt) : f.heal != null ? '+' + f.heal : '', odds: f.hurt != null ? f.chance + '%' : '',
      more: [f.rel && f.rel !== 'front' ? f.rel : '', f.revive ? 'raise' : '', f.status ? f.status.is + ' ' + f.status.chance + '%' : '', f.buff ? f.buff.stat + (f.buff.pct > 0 ? ' ↑' : ' ↓') : ''].filter(Boolean).join(' · ') }));
    // the board page's readout, less its last line (its legend of keys: the legend here says the controls in hand)
    const lines = String(g.readout || '').split('\n').slice(0, -1);
    t.readout = (g.mode === 'aim' ? lines.slice(0, 1) : lines).filter(Boolean).map((text, k) => ({ id: 'r' + k, text }));
    t.legend = LEGEND[g.mode] || [];
    const D = g.td;
    t.defence = !!D;
    if (D) {
      const v = D.view();
      t.td = { wave: v.wave + '/' + v.of, lives: v.lives, livesMax: v.livesMax, gold: v.gold, when: v.when,
        hand: v.over ? [] : v.towers.map((w, k) => ({ id: w.id, name: w.name, key: String(k + 1), count: w.cost, active: w.active, then: keep(() => D.choose(w.id)) }))
          .concat([{ id: 'sell', name: 'Sell', key: 'R', then: keep(() => D.sell()) }, { id: 'next', name: 'Next wave', key: 'N', disabled: !v.more, why: 'No wave left to call', then: keep(() => D.call()) }, { id: 'where', name: 'Where', key: 'B', then: keep(() => D.where()) }]) };
      for (const h of t.td.hand) if (!h.disabled) keyed[h.key] = runs[h.then.id];
      if (v.over) g = Object.assign({}, g, { banner: v.over });
    }
    // a skirmish: its figures as the page made them last
    const R = g.rts, v = R && R.view();
    t.skirmish = !!v && v.phase === 'play';
    if (v) {
      const d = v.info;
      t.rts = { purse: v.purse, clock: v.clock + (v.paused ? '  paused' : '') + (v.speed !== 1 ? '  ×' + v.speed : ''), hint: v.hint || '',
        picked: !!d, title: d ? d.title : '', hp: d && d.hp ? d.hp : '', lines: d && d.lines ? d.lines.map((text, k) => ({ id: 'l' + k, text })) : [],
        tiles: d && d.tiles ? d.tiles.map((x) => ({ id: x.id, name: x.name, k: x.k, then: keep(() => R.pick(x.id)) })) : [],
        ordered: v.commands.length > 0, orders: v.commands.map((c) => ({ id: c.a, label: c.label, key: c.key, armed: c.armed, disabled: !!c.why, why: c.why || undefined, then: keep(() => R.run(c.a)) })),
        setup: (v.lobby || []).map((x) => ({ label: x.label, var: 'pick.' + x.k, options: x.options })), end: {} };
      for (const x of v.lobby || []) state.pick[x.k] = x.value;
      if (v.results) {
        const r = v.results, P = r.player, E = r.enemy, lead = (a, b, low) => (a === b ? null : (a > b) !== !!low ? 'you' : 'them');
        const line = (what, k, low) => ({ what, you: P[k], them: E[k], lead: lead(P[k], E[k], low) });
        t.rts.end = { outcome: r.won ? 'Victory' : r.draw ? 'Stalemate' : 'Defeat', sub: (r.surrender ? (r.surrender === 'player' ? 'you gave up · ' : 'they gave up · ') : '') + r.time,
          rows: [line('trained', 'trained'), line('units lost', 'lost', true), line('raised', 'built'), line('buildings lost', 'fell', true), line('mined', 'mined'), line('research', 'research'), line('apm', 'apm')],
          series: [{ label: 'you', values: P.army }, { label: 'them', values: E.army }],
          items: [{ label: 'Rematch', then: { emit: 'rts', call: 'rematch' } }, { label: 'New match', then: { emit: 'rts', call: 'lobby' } }, { label: 'Leave', then: { emit: 'rts', call: 'leave' } }] };
      }
      if (v.banner) g = Object.assign({}, g, { banner: v.banner });
      // the match's screens follow its phase
      const want = v.phase === 'lobby' ? 'lobby' : v.phase === 'results' ? 'results' : null;
      if (want !== phase) { phase = want; if (rt.state().screen) rt.close(); if (want) rt.open(want); }
    }
    const words = String(g.banner || '').split('\n');
    t.ended = !!g.banner;
    t.banner = { value: words[0] || '', sub: words.slice(1).join(' · ') };
    // the action menu: a screen while the board page is in its menu, opened again when what it lists has changed
    const M = g.mode === 'menu' && g.menu ? g.menu : null, sig = M ? M.items.map((x) => x.label + (x.ok ? '' : '!')).join('|') : null;
    if (M) { t.menuTitle = U ? U.name : ''; t.menu = M.items.map((it, k) => ({ id: 'm' + k, label: it.label, disabled: !it.ok, then: keep(() => it.go()) })); }
    if (sig !== shown) { shown = sig; if (rt.state().screen) rt.close(); if (sig) rt.open('act'); }
  }

  return {
    // a number over a blow: where it landed in the world, what it says, its kind (the tone it is told by)
    pop(at, text, kind) { pops.push({ id: 'p' + (popN++), at, value: text, kind, t: 0 }); },
    step(dt) {
      clock += dt;
      const g = api.get(), D = g.td, key = [g.mode, g.cursor, g.n, g.readout, g.banner, g.menu ? g.menu.items.map((x) => x.label + x.ok).join('|') : '', D ? JSON.stringify(D.view()) : ''].join('\u0001');
      const now = g.rts ? g.rts.view() : null;
      if (key !== was || now !== seen) { was = key; seen = now; sync(g); }
      for (const p of pops) p.t += dt;
      pops = pops.filter((p) => p.t < 1.3);
      t.pops = pops.map((p) => { const q = api.project([p.at[0], p.at[1], p.at[2]]); return q ? { id: p.id, x: q[0], y: q[1], value: p.value, kind: p.kind } : null; }).filter(Boolean);
    },
  };
}
