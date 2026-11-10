import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { manaUi } from '../../mana-ui/index.js';
import { manaHost } from '../controls/mana-host.js';
import { readBoardUi, boardUiSpec, boardUiData, boardManaPage } from './board-ui.js';
import { assembleBoardScene } from './board-scene.js';
import { boardChannelScript } from '../scene/channels/board.js';

// The board's UI, each concept once: a board's `ui` is read and taught; without it the board's block carries no byte
// of the runtime; with it the page's parts are rebuilt from what the board page stands at (the turn order, the unit,
// the action menu as a screen, a forecast, the end's word, a number over a blow, a defence's hand), and the controls
// are intents (the board scheme to the board, the menu scheme to the menu, a key the menu took never also the board's).

const flat = { seed: 'flat', relief: 0, cols: 6, rows: 6 };
const fight = (more = {}) => ({ board: flat, battle: { seed: 'b', players: ['party'], party: [{ id: 'ayla', class: 'fighter', at: 'B1' }], foes: [{ id: 'g1', foe: 'goblin', at: 'B5' }] }, ...more });

describe('a board\'s ui: read and taught', () => {
  it('names what a ui may say, and a look that does not exist is refused where the board is made', () => {
    expect(readBoardUi({})).toEqual([]);
    expect(readBoardUi({ theme: 'grim', languages: { ja: { jump: '跳躍' } }, language: 'ja' })).toEqual([]);
    expect(readBoardUi({ css: 'x' })[0]).toMatch(/not part of a board's ui \(theme, languages, language\)/);
    expect(() => assembleBoardScene(fight({ ui: { theme: 'velvet' } }))).toThrow(/ui\.theme/);
    expect(Object.keys(boardUiSpec({}).defs).sort()).toEqual(['damage-numbers', 'turn-order', 'wave-status']);
  });
  it('the look is a tactician\'s when the game names none, its sides the board\'s own, scoped to the board\'s root', () => {
    const D = boardUiData({}, { colours: { party: '#4aa3ff', foe: '#ff5a4a' } });
    expect(D.css).toContain('#mana-board .mana-root');
    expect(D.css).toMatch(/--mana-side-0:\s*#4aa3ff/);
    expect(D.css).toMatch(/--mana-side-1:\s*#ff5a4a/);
    expect(Object.keys(D.board.keys)).toContain('KeyQ');     // the board scheme: the view turns
    expect(D.glyphs.keys.confirm).toBeTruthy();              // and its controls are named in the legend
  });
});

describe('a board\'s ui: absence adds nothing', () => {
  it('a board without ui carries no runtime; a battle or a defence with it carries the runtime and its page; a skirmish keeps its own panels', () => {
    const block = (m) => boardChannelScript(assembleBoardScene(m).board);
    expect(block(fight())).not.toMatch(/buildManaUi|boardManaPage|buildManaHost/);
    for (const m of [fight({ ui: {} }), { board: flat, td: {}, ui: {} }]) {
      const b = block(m);
      expect(b).toMatch(/function buildManaUi\(\)/);
      expect(b).toMatch(/function boardManaPage\(api, kit\)/);
      expect(block(m)).toBe(b);
    }
    expect(assembleBoardScene({ board: { ...flat, cols: 12, rows: 10 }, rts: {}, ui: {} }).board.ui).toBeUndefined();
  });
});

describe('a board\'s ui: what the board page stands at, drawn', () => {
  const page = (g0) => {
    const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
    const G = globalThis, saved = { window: G.window, document: G.document };
    G.window = dom.window; G.document = dom.window.document;
    const did = [];
    let g = g0;
    const ui = boardManaPage({ ui: boardUiData({}, { colours: { party: '#4aa3ff', foe: '#ff5a4a' } }), get: () => g, intent: (a) => did.push(a), refresh: () => did.push('refresh'), project: (p) => [p[0], p[1]] }, { manaUi, hostK: manaHost, padLayout: () => 'xbox' });
    const key = (code, k) => dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, key: k || code, bubbles: true, cancelable: true }));
    const U = () => window.__mojBoardUi;
    return { ui, did, key, U, set(n) { g = n; ui.step(0.016); }, done() { G.window = saved.window; G.document = saved.document; } };
  };
  const base = (over = {}) => ({ mode: 'free', cursor: 3, n: 1, readout: 'D1  h 0 (0.0 m)  ground\nthe old legend of keys', banner: '', menu: null, sides: ['party', 'foe'], td: null, turns: () => [], unit: () => null, forecast: () => null, ...over });
  it('a battle: the order, the unit in focus, the readout less the old legend, and the action menu as a screen', () => {
    const picked = [];
    const menu = { items: [{ label: 'Move', ok: true, go: () => picked.push('move') }, { label: 'Act', ok: false, go: () => picked.push('act') }, { label: 'Wait', ok: true, go: () => picked.push('wait') }], back: null };
    const P = page(base());
    try {
      P.set(base({ mode: 'menu', menu, turns: () => [{ name: 'Ayla', cpu: false, side: 'party' }, { name: 'Goblin', cpu: true, side: 'foe' }],
        unit: () => ({ name: 'Ayla', side: 'party', hp: 30, hpMax: 34, mp: 0, mpMax: 0, move: 4, jump: 2, spd: 7, marks: ['poisoned'] }) }));
      const { rt, state } = P.U(), html = rt.view();
      expect(rt.state().screen).toBe('act');
      expect(state.t.turns.map((x) => [x.name, x.variant, x.side])).toEqual([['Ayla', 'strong', 0], ['Goblin', 'muted', 1]]);
      expect(state.t.readout.map((r) => r.text)).toEqual(['D1  h 0 (0.0 m)  ground']);
      expect(html).toContain('poisoned');
      expect(state.t.unit.casts).toBe(false);                 // no magic: no bar for it
      P.key('ArrowDown'); P.key('Enter');                     // Act cannot be done: pressing it does nothing
      expect(picked).toEqual([]);
      P.key('ArrowDown'); P.key('Enter');
      expect(picked).toEqual(['wait']);
      expect(P.did.filter((a) => a !== 'refresh')).toEqual([]);   // the menu's keys were never the board's
      P.key('Escape');
      expect(P.did.filter((a) => a !== 'refresh')).toEqual(['back']);   // back from the menu is the board page's to answer
      P.set(base({ mode: 'move' }));
      expect(rt.state().screen).toBe(null);
      P.key('ArrowUp'); P.key('KeyQ'); P.key('Enter');
      expect(P.did.filter((a) => a !== 'refresh').slice(1)).toEqual(['up', 'turnLeft', 'confirm']);
    } finally { P.done(); }
  });
  it('an aim\'s forecast is a table; the end is a banner; a blow\'s number stands where it landed and is gone once it has risen', () => {
    const P = page(base());
    try {
      P.set(base({ mode: 'aim', readout: 'B3  h 1\nGoblin 22 → ~9  85%\nlegend', forecast: () => [{ name: 'Goblin', hp: 22, hurt: 13, chance: 85, rel: 'back' }] }));
      const { state } = P.U();
      expect(state.t.forecast).toEqual([{ id: 'f0', name: 'Goblin', now: 22, after: '~9', odds: '85%', more: 'back' }]);
      expect(state.t.readout.map((r) => r.text)).toEqual(['B3  h 1']);   // the forecast is said once, in its table
      P.ui.pop([0.4, 0.5, 0], '13', 'hit');
      P.ui.step(0.1);
      expect(state.t.pops).toEqual([{ id: 'p0', x: 0.4, y: 0.5, value: '13', kind: 'hit' }]);
      P.ui.step(1.3);
      expect(state.t.pops).toEqual([]);
      P.set(base({ mode: 'over', banner: 'Victory\n7 xp · 8 gold' }));
      expect(state.t.banner).toEqual({ value: 'Victory', sub: '7 xp · 8 gold' });
    } finally { P.done(); }
  });
  it('a defence: the wave, the lives and the purse; each tower on its digit, sell, the next wave and where on their keys', () => {
    const did = [];
    const view = { wave: 1, of: 5, more: true, when: 'next in 4 s', gold: 40, lives: 9, livesMax: 10, foes: 0, towers: [{ id: 'arrow', name: 'Arrow tower', cost: 10, active: true }, { id: 'cannon', name: 'Cannon', cost: 18, active: false }], over: '' };
    const td = { view: () => view, choose: (k) => did.push('choose ' + k), sell: () => did.push('sell'), call: () => did.push('call'), where: () => did.push('where') };
    const P = page(base({ mode: 'td', td }));
    try {
      P.ui.step(0.016);
      const { state } = P.U();
      expect(state.t.td.wave).toBe('1/5');
      expect(state.t.td.hand.map((h) => h.key + ' ' + h.name + (h.active ? ' *' : ''))).toEqual(['1 Arrow tower *', '2 Cannon', 'R Sell', 'N Next wave', 'B Where']);
      P.key('Digit2', '2'); P.key('KeyR', 'r'); P.key('KeyN', 'n');
      expect(did).toEqual(['choose cannon', 'sell', 'call']);
      P.key('KeyS', 's');                                     // S is the board scheme's cursor, never the sale
      expect(did).toEqual(['choose cannon', 'sell', 'call']);
      expect(P.did.filter((a) => a !== 'refresh')).toEqual(['down']);
    } finally { P.done(); }
  });
});
