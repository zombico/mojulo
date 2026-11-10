import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { manaUi } from '../../mana-ui/index.js';
import { manaHost } from '../controls/mana-host.js';
import { readHoloUi, holoUiSpec, holoUiData, holoManaPage } from './holo-ui.js';
import { holoArenaData, readHolo } from './holo-arena.js';
import { holoChannelScript } from '../scene/channels/holo.js';

// The arena's UI, each concept once: an arena's `ui` is read and taught; without it the block carries no byte of the
// runtime; with it the overlay's words are parts (the two duelists mirrored, the status, the duel's word), a promotion
// is one question, and the board's cursor is the board scheme's intents over the cells as the camera shows them.

describe('an arena\'s ui: read and taught', () => {
  it('names what a ui may say; the look is glass when the game names none, its sides the duelists\' lights', () => {
    expect(readHoloUi({})).toEqual([]);
    expect(readHoloUi({ font: 'x' })[0]).toMatch(/not part of an arena's ui \(theme, languages, language\)/);
    expect(() => readHolo({ game: 'checkers', ui: { theme: 'velvet' } })).toThrow(/ui\.theme/);
    const D = holoUiData({}, { colours: ['#36d6ff', '#ff4f7a'] });
    expect(D.css).toContain('#mana-holo .mana-root');
    expect(D.css).toMatch(/--mana-side-1:\s*#ff4f7a/);
    expect(Object.keys(holoUiSpec({}).defs)).toEqual(['choice-prompt']);
  });
  it('an arena without ui carries no runtime; with it, the runtime and its page, the same every time', () => {
    const block = (v) => holoChannelScript(holoArenaData(v));
    expect(block({ game: 'checkers' })).not.toMatch(/buildManaUi|holoManaPage|HOLO_UI = /);
    const b = block({ game: 'checkers', ui: {} });
    expect(b).toMatch(/function buildManaUi\(\)/);
    expect(b).toMatch(/const HOLO_UI = \(function holoManaPage\(cfg, kit\)/);
    expect(block({ game: 'checkers', ui: {} })).toBe(b);
  });
});

describe('an arena\'s ui: the overlay as parts', () => {
  const page = () => {
    const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
    const G = globalThis, saved = { window: G.window, document: G.document };
    G.window = dom.window; G.document = dom.window.document;
    const UI = holoManaPage(holoUiData({}, { colours: ['#36d6ff', '#ff4f7a'] }), { manaUi, hostK: manaHost, padLayout: () => 'xbox' });
    const key = (code) => dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
    return { UI, key, U: () => window.__mojHoloUi, done() { G.window = saved.window; G.document = saved.document; } };
  };
  it('the two duelists across the top, the one to play alight; the status; the duel\'s word while it is said', () => {
    const P = page();
    try {
      P.UI.show({ title: 'Checkers', seats: [{ name: 'YOU', lp: 4000, max: 4000, live: true }, { name: 'CPU', lp: 2500, max: 4000, live: false }], status: 'YOU: your move', banner: 'DUEL!' });
      const { rt, state } = P.U();
      rt.tick();
      const html = rt.view();
      expect(state.t.d1).toEqual({ name: 'CPU', lp: 2500, max: 4000, live: false });
      expect(html).toMatch(/data-turn="[^"]+"[^>]*><i class="mana-chip" data-side="0"><\/i>YOU/);
      expect(html).toContain('YOU: your move');
      expect(html).toContain('DUEL!');
      P.UI.show({ title: 'Checkers', seats: [], status: '', banner: '' });
      rt.tick();
      expect(rt.view()).not.toContain('DUEL!');
    } finally { P.done(); }
  });
  it('a promotion is one question, put off by back; the cursor steps over the cells as they stand on the screen', () => {
    const P = page(), did = [];
    try {
      const pts = [[0.4, 0.6], [0.5, 0.6], [0.4, 0.5], null];
      P.UI.board({ points: () => pts, first: () => 0, show: (i) => did.push('at ' + i), pick: (i) => did.push('pick ' + i), back: () => { did.push('back'); return true; } });
      P.key('ArrowRight');                                    // the first press shows the cursor where a piece can move from
      P.key('ArrowRight'); P.key('ArrowUp'); P.key('Enter'); P.key('Escape');
      expect(did).toEqual(['at 0', 'at 1', 'at 2', 'pick 2', 'back']);
      P.UI.ask([{ label: 'Queen', run: () => did.push('queen') }, { label: 'Knight', run: () => did.push('knight') }]);
      expect(P.UI.busy()).toBe(true);
      P.key('ArrowRight'); P.key('Enter');
      expect(did.slice(5)).toEqual(['knight']);               // the question's keys were never the board's
      expect(P.UI.busy()).toBe(false);
      P.UI.ask([{ label: 'Queen', run: () => did.push('queen') }]);
      P.key('Escape');
      expect(P.UI.busy()).toBe(false);
      expect(did.slice(6)).toEqual([]);
    } finally { P.done(); }
  });
});
