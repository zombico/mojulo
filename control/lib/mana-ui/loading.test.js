import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { IDIOMS, withIdioms } from './idioms.js';
import { manaCss } from './css.js';

// LOADING, THE UNGLAMOROUS RULES: the progress never goes back and says when it is not known; something always moves; a
// load that stalls says it is still going; tips turn, on the clock and by hand; a quick load never flashes its screen, a
// slow one stays long enough to be read; a press made before the player could see the prompt is not an answer; a failure
// says so and offers a way on; back does nothing unless the game gives the load a way out. All on the game's clock.
const load = (state, props = {}) => {
  let t = 0;
  const st = { load: { place: 'Vale', ...state } }, log = [];
  const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'loading-screen', props: { ...IDIOMS['loading-screen'].example, ...props } } } }), { read: (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), st), act: (e) => log.push(e), now: () => t, cues: 'full' });
  rt.input('keys');
  return { st, log, rt, at: (s) => { t = s; rt.tick(); }, html: () => rt.view() };
};
const loader = (html) => html.match(/<div[^>]*class="mana-loader"[^>]*>/)[0];
const emitted = (log, name) => log.filter((e) => e.emit === name).length;

describe('mana-ui: a load is honest', () => {
  it('the progress never goes back; not known, it sweeps and claims no number; ready, it is whole', () => {
    const L = load({ progress: 40 });
    expect(loader(L.html())).toContain('aria-valuenow="40"');
    L.st.load.progress = 25; L.at(1);
    expect(loader(L.html())).toContain('aria-valuenow="40"');            // a step that starts over does not pull it back
    const U = load({ progress: null });
    expect(U.html()).toContain('data-known="no"');
    expect(U.html()).toContain('class="mana-sweep"');
    expect(loader(U.html())).not.toContain('aria-valuenow');
    U.st.load.ready = true; U.at(1);
    expect(loader(U.html())).toContain('aria-valuenow="100"');
  });
  it('something moves while it loads, and once nothing has moved for a while it says it is still loading', () => {
    const L = load({ progress: 10 });
    expect(L.html()).toContain('class="mana-spin"');
    expect(loader(L.html())).toContain('aria-busy="true"');
    L.at(9.9);
    expect(L.html()).not.toContain('Still loading');
    L.at(10);
    expect(L.html()).toContain('Still loading');
    L.st.load.progress = 20; L.at(10.5);
    expect(L.html()).not.toContain('Still loading');                     // it moved: the line goes
    L.st.load.ready = true; L.at(11);
    expect(L.html()).not.toContain('class="mana-spin"');
  });
  it('tips turn on the clock and by hand, each once before any comes again, and the legend says so', () => {
    const tips = ['a', 'b', 'c', 'd', 'e'], tipOf = (h) => h.match(/class="mana-tip"[^>]*><b>Tip<\/b> (\w)/)[1];
    const L = load({ progress: 10, tips });
    expect(tipOf(L.html())).toBe('a');
    L.at(8);
    expect(tipOf(L.html())).toBe('b');
    L.rt.press('left');
    expect(tipOf(L.html())).toBe('a');
    expect(L.log).toContainEqual({ sound: 'change', step: -1 });
    expect(L.html()).toMatch(/<span class="mana-hint">.*<span>Tips<\/span>/);
    const M = load({ progress: 10, tips }), seen = [];
    for (let i = 0; i < 5; i++) { seen.push(tipOf(M.html())); M.rt.press('right'); }
    expect(new Set(seen).size).toBe(5);
    const mixed = manaUi.runtime({ start: 's', screens: { s: { use: 'screen', children: [{ use: 'loader', props: { tips, seed: 3 } }] } } }, {}).view();
    expect(tipOf(mixed)).not.toBe('a');                                   // a seed mixes the order, with no dice
  });
});

describe('mana-ui: a load goes on at the right moment', () => {
  it('auto: a quick load never shows (it goes at once), a slow one stays long enough to be seen', () => {
    const Q = load({ progress: 10 }, { auto: true });
    expect(loader(Q.html())).toContain('data-grace="yes"');
    expect(manaCss('.r')).toContain('.r .mana-screen:has(.mana-loader[data-grace=yes])>*{visibility:hidden}');   // only the cover
    Q.st.load.ready = true; Q.at(0.1);
    expect(emitted(Q.log, 'enter')).toBe(1);
    const S = load({ progress: 10 }, { auto: true });
    S.at(0.5); S.st.load.ready = true; S.at(0.6);
    expect(emitted(S.log, 'enter')).toBe(0);
    S.at(1);
    expect(emitted(S.log, 'enter')).toBe(1);
    S.at(2);
    expect(emitted(S.log, 'enter')).toBe(1);                              // once
  });
  it('press: a press made in the moment it went ready is not an answer; one after it is', () => {
    const L = load({ progress: 90 });
    L.at(2); L.st.load.ready = true; L.at(2.1);
    expect(L.log).toContainEqual({ sound: 'appear' });
    L.rt.press('accept');
    expect(emitted(L.log, 'enter')).toBe(0);
    L.at(2.5); L.rt.press('accept');
    expect(emitted(L.log, 'enter')).toBe(1);
  });
  it('back does nothing, and says nothing, unless the game gives the load a way out', () => {
    const L = load({ progress: 10 });
    L.rt.press('back');
    expect(L.rt.state().screen).toBe('s');
    expect(L.log.filter((e) => e.sound === 'back')).toEqual([]);
    expect(L.html()).not.toMatch(/<span>Back<\/span>/);
    const C = load({ progress: 10 }, { cancel: { emit: 'cancel' } });
    C.rt.press('back');
    expect(emitted(C.log, 'cancel')).toBe(1);
  });
  it('a failure says so in its words, offers retry and the title, and a retry starts the progress over', () => {
    const L = load({ progress: 60 });
    L.st.load.error = 'The save could not be read.'; L.at(1);
    expect(loader(L.html())).toContain('data-state="failed"');
    expect(L.html()).toContain('data-tone="harm">The save could not be read.');
    expect(L.html()).not.toContain('class="mana-spin"');
    expect(L.log).toContainEqual({ sound: 'deny' });
    L.rt.press('accept');
    expect(emitted(L.log, 'retry')).toBe(1);
    L.st.load.error = null; L.st.load.progress = 5; L.at(2);
    expect(loader(L.html())).toContain('aria-valuenow="5"');
  });
});
