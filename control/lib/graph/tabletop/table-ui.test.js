import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { manaUi } from '../../mana-ui/index.js';
import { manaHost } from '../controls/mana-host.js';
import { readTableUi, tableUiSpec, tableUiConfig, tableUiTheme, tableUiCss, tableMana } from './table-ui.js';
import { tabletopManifestHtml, resolveTabletop } from './tabletop-manifest.js';
import { tabletopPageHtml } from './tabletop-page.js';
import { tileGame } from './fixtures/tiles.js';
import { deckGame } from './fixtures/cards.js';
import { islandEconomy } from './fixtures/island-economy.js';
import { workerGame } from './fixtures/rounds.js';
import { fieldDuel } from './fixtures/field-duel.js';

// The table's UI, each concept once: a game's `ui` is read and taught; without it a page carries no byte of the
// runtime; with it one spec draws the table's parts and one host answers them (an action, the menu, a question with
// and without a way out, a table of cards, the board's cursor). One page per way a page uses it, chosen here.

describe('a table\'s ui: read and taught', () => {
  it('names what a ui may say, and refuses a look that does not exist with the looks that do', () => {
    expect(readTableUi({})).toEqual([]);
    expect(readTableUi({ theme: 'table-felt' })).toEqual([]);
    expect(readTableUi({ theme: 'tactician', languages: { ja: { menu: 'メニュー' } }, language: 'ja' })).toEqual([]);
    expect(readTableUi({ colour: 'red' })[0]).toMatch(/not part of a table's ui \(theme, languages, language\)/);
    expect(readTableUi({ theme: 'velvet' })[0]).toMatch(/theme:/);
    expect(() => resolveTabletop({ kind: 'tabletop', game: 'chess', ui: { skin: 1 } })).toThrow(/ui\.skin: not part of a table's ui/);
  });
  it('the look is the table\'s own materials when the game names none, its sides the broadcast\'s kits', () => {
    const tv = { colors: [{ base: '#f3ede2' }, { base: '#2a2420' }] };
    expect(tableUiTheme({}, tv).sides).toEqual(['#f3ede2', '#2a2420']);
    expect(tableUiTheme({}, tv).from.name).toBe('Table Wood');
    expect(tableUiTheme({}, tv, 'felt').from.name).toBe('Table Felt');
    expect(tableUiTheme({ theme: 'tactician' }, tv).from).toBe('tactician');
    expect(tableUiCss({}, tv)).toContain('--mana-side-0:');
  });
  it('the spec reads, carries only the idioms it uses, and says its own words in the game\'s language', () => {
    const spec = tableUiSpec({ languages: { ja: { menu: 'メニュー' } }, language: 'ja' });
    expect(Object.keys(spec.defs).sort()).toEqual(['action-bar', 'card-hand', 'choice-prompt', 'game-log', 'pause-menu', 'seat-plates', 'table-results', 'trade-offer']);
    const rt = manaUi.runtime(spec, { read: () => undefined });
    expect(rt.view()).toContain('メニュー');
    expect(Object.keys(tableUiConfig({}).board.keys)).toContain('ArrowUp');
  });
});

describe('a table\'s ui: absence adds nothing', () => {
  it('a page without ui carries no runtime, no sheet and no host; with it, all three', () => {
    for (const make of [(ui) => tabletopManifestHtml({ kind: 'tabletop', game: 'chess', ...(ui ? { ui } : {}) }), (ui) => tabletopPageHtml(tileGame(), ui ? { ui } : {}), (ui) => tabletopPageHtml(deckGame(), ui ? { ui } : {}),
      (ui) => tabletopPageHtml(islandEconomy(), ui ? { ui } : {}), (ui) => tabletopPageHtml(workerGame(), ui ? { ui } : {})]) {
      const plain = make(null), drawn = make({});
      expect(plain).not.toMatch(/buildManaUi|buildManaHost|mana-root|tableMana/);
      expect(plain).toContain('const UI = null;');
      expect(drawn).toMatch(/function buildManaUi\(\)/);
      expect(drawn).toMatch(/function buildManaHost\(\)/);
      expect(drawn).toContain('<body class="table-ui">');
      expect(drawn).not.toContain('<header>');          // the header and the side panel are the runtime's parts now
      expect(drawn).not.toContain('<aside>');
      expect(drawn).not.toMatch(/function broadcastDomClient|\.tv-seat\{/);   // one coverage: the table's own parts
      expect(plain).toMatch(/function broadcastDomClient\(BC\)/);
      expect(make({})).toBe(drawn);                     // the same page every time
    }
  });
  it('a round game played on a board keeps its own panel for now, and says nothing of the runtime', () => {
    const html = tabletopPageHtml(fieldDuel(), { ui: {} });
    expect(html).toContain('<aside>');
    expect(html).not.toMatch(/buildManaUi/);
  });
});

describe('a table\'s ui: one host', () => {
  const page = () => {
    const dom = new JSDOM('<!doctype html><body><div id="mana"></div></body>', { pretendToBeVisual: true });
    const g = globalThis, saved = { window: g.window, document: g.document, performance: g.performance };
    g.window = dom.window; g.document = dom.window.document;
    const UI = tableMana(tableUiConfig({}), manaUi, manaHost, () => 'xbox');
    const key = (code, k) => dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, key: k || code, bubbles: true, cancelable: true }));
    return { UI, key, dom, done() { g.window = saved.window; g.document = saved.document; } };
  };
  it('an action is done by its tap, its own key or the digit it is given; a disabled one says why and does nothing', () => {
    const P = page(), did = [];
    try {
      P.UI.show({ prompt: 'Your move', actions: [{ name: 'Pass', key: 'P', run: () => did.push('pass') }, { name: 'Undo', disabled: true, why: 'Nothing to take back', run: () => did.push('undo') }, { name: 'End', run: () => did.push('end') }], log: [{ text: 'e4', side: 0 }] });
      const html = P.UI.rt.view();
      expect(html).toContain('Your move');
      expect(html).toContain('Nothing to take back');
      expect(html).toMatch(/1\.<\/span><i class="mana-chip" data-side="0"><\/i>e4/);
      P.key('KeyP', 'p'); P.key('Digit2', '2'); P.key('Digit3', '3');
      expect(did).toEqual(['pass', 'end']);
    } finally { P.done(); }
  });
  it('the menu opens on its button and on back from the board; a pick from it closes it and is done', () => {
    const P = page(), did = [];
    try {
      P.UI.show({ prompt: '', actions: [], menu: [{ label: 'Resume', run: () => {} }, { label: 'New game', run: () => did.push('new') }] });
      const moved = [];
      P.UI.cursor({ points: [[0, 0], [10, 0], [0, 10]], at: 0, show: (i) => moved.push(i), pick: (i) => did.push('pick' + i), back: () => false });
      P.key('ArrowRight'); P.key('Enter');
      expect(moved).toEqual([0, 1]);
      expect(did).toEqual(['pick1']);
      P.key('Escape');
      expect(P.UI.rt.state().screen).toBe('menu');
      P.key('ArrowRight');                                // the menu holds the keys: the board's cursor stays
      expect(moved).toEqual([0, 1]);
      P.key('ArrowDown'); P.key('Enter');
      expect(did).toEqual(['pick1', 'new']);
      expect(P.UI.rt.state().screen).toBe(null);
    } finally { P.done(); }
  });
  it('one question: back does nothing when it must be answered, and takes the way out when the game gives one', () => {
    const P = page(), did = [];
    try {
      P.UI.show({ prompt: '', actions: [] });
      P.UI.ask({ title: 'Promotion', text: '', choices: [{ label: 'Queen', run: () => did.push('q') }, { label: 'Knight', run: () => did.push('n') }] });
      P.key('Escape');
      expect(P.UI.rt.state().screen).toBe('ask');
      expect(P.UI.busy()).toBe(true);
      P.key('ArrowRight'); P.key('Enter');
      expect(did).toEqual(['n']);
      expect(P.UI.rt.state().screen).toBe(null);
      P.UI.ask({ title: 'Which', text: '', choices: [{ label: 'A', run: () => did.push('a') }], cancel: () => did.push('off') });
      P.key('Escape');
      expect(did).toEqual(['n', 'off']);
      expect(P.UI.rt.state().screen).toBe(null);
    } finally { P.done(); }
  });
  it('a table of cards is one screen of grids: zones that share a row sit together, a playable card is picked with the cursor', () => {
    const P = page(), did = [];
    try {
      P.UI.show({ prompt: '', actions: [], zones: [
        { id: 'supply', title: 'Supply', row: 1, cards: [{ id: 'a', name: 'Copper', state: 'playable', run: () => did.push('buy') }, { id: 'b', name: 'Estate' }] },
        { id: 'them', title: 'plum', row: 0, cards: [{ id: 'd', face: 'down', count: 'deck 5' }] },
        { id: 'mine', title: 'Your piles', row: 0, cards: [{ id: 'e', face: 'down', count: 'deck 5' }] },
      ] });
      expect(P.UI.rt.state().screen).toBe('cards');
      expect(P.UI.busy()).toBe(false);                    // the table itself is not a question
      expect(window.__tableUi.t.zoneRows.map((r) => r.zones.map((z) => z.id))).toEqual([['them', 'mine'], ['supply']]);
      P.UI.rt.focusAt(2); P.key('Enter');
      P.UI.rt.focusAt(3); P.key('Enter');                 // a card with nothing to do is not picked
      expect(did).toEqual(['buy']);
      P.key('Escape');
      expect(P.UI.rt.state().screen).toBe('menu');
    } finally { P.done(); }
  });
  it('the table\'s coverage is its own parts: the seats and the tab, a call as a moment, the end\'s places a beat later, play again', async () => {
    const P = page(), did = [];
    try {
      const TV = P.UI.tv({ colors: [{ base: '#f3ede2' }, { base: '#2a2420' }], names: null, ends: { score: 'on points' } });
      const players = [{ id: 'teal' }, { id: 'plum' }], t = () => window.__tableUi.t;
      P.UI.show({ prompt: '', actions: [] });
      TV.table({ players, me: 0, scores: [3, 5], live: 1, tab: 'turn 2' });
      expect(t().seats.map((s) => [s.name, s.side, s.turn, s.score])).toEqual([['You', 0, false, 3], ['plum', 1, true, 5]]);
      expect(P.UI.rt.view()).toContain('turn 2');
      TV.call({ text: 'Check', sub: 'You to answer', tone: 'warn' });
      expect(t().calls.map((c) => [c.text, c.weight])).toEqual([['Check', 2]]);
      expect(TV.colour(1)).toBe('#2a2420');
      TV.clocks(['4:59', '5:00']);
      expect(t().seats[0].clock).toBe('4:59');
      // the end: its word at once, the places a beat later (ties share a place), yours marked
      TV.table({ players, me: 0, scores: [7, 7], live: 0, tab: '', over: { winner: null, reason: 'score', scores: [7, 7] }, again: () => did.push('again') });
      expect(t().calls.map((c) => c.text)).toEqual(['Check', 'Draw']);
      expect(t().tab).toBe('Final');
      expect(P.UI.rt.state().screen).toBe(null);
      await new Promise((r) => setTimeout(r, 1500));
      expect(P.UI.rt.state().screen).toBe('result');
      expect(t().result.outcome).toBe('Draw');
      expect(t().result.why).toBe('on points');
      expect(t().result.places.map((r) => [r.place, r.self])).toEqual([[1, true], [1, false]]);
      P.key('ArrowDown'); P.key('Enter');
      expect(did).toEqual(['again']);
      expect(P.UI.rt.state().screen).toBe(null);
    } finally { P.done(); }
  });
});
