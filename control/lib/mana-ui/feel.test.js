import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { manaCss, GREYBOX_VARS } from './css.js';
import { readTheme, themeCss, SLANTS, TRANSITIONS } from './theme.js';
import { IDIOMS, withIdioms } from './idioms.js';
import { SAMPLE_STATE } from './samples.js';

// HOW A GAME'S UI FEELS (docs/game-ui-research.md, its P1): the lean most schools share, a cover between screens,
// numbers that count on the game's clock and a skip that lands them, toasts in two tiers, blows that pop over the
// world, a rank stamped on, and the player's own channels (less motion, less flash) apart. One case per procedure.
const sheet = manaCss('.r');
const screen = (children, props = {}) => ({ use: 'screen', props, children });
const sample = (p) => manaUi.readPath(SAMPLE_STATE, p);

describe('mana-ui: the lean', () => {
  it('a slant is a word: tabs, bars, banners, keys and buttons lean, a window never does', () => {
    expect(themeCss({ slant: 'hard' })).toContain(`--mana-slant:${SLANTS.hard}`);
    const lean = sheet.split('\n').find((l) => l.includes('{transform:skewX(var(--mana-slant))}'));
    for (const c of ['tablabel', 'banner', 'key', 'button', 'track']) expect(lean, c).toContain(`.mana-${c}`);
    expect(lean).not.toContain('.mana-window');
    expect(sheet).toContain('.mana-bar[data-dir=rtl] .mana-track{transform:scaleX(-1) skewX(var(--mana-slant))}');
    expect(GREYBOX_VARS.slant).toBe('0deg');
  });
  it('the motion that runs on a leaning part moves by its own properties, so the lean stays through it', () => {
    for (const k of ['rise', 'slide', 'slam', 'pop', 'pick', 'gain', 'ring', 'hit', 'stamp']) {
      const kf = sheet.split('\n').find((l) => l.startsWith(`@keyframes mana-${k}{`));
      expect(kf, k).toBeTruthy();
      expect(kf, k).not.toContain('transform:');
    }
  });
});

describe('mana-ui: one screen giving way to the next', () => {
  const spec = { start: 'a', screens: { a: screen([{ use: 'button', props: { label: 'On' }, on: { accept: { open: 'b' } } }]), b: screen([{ use: 'button', props: { label: 'x' } }]) } };
  it('a cover is drawn over the stage as a screen opens or leaves, a new key each time; none as the runtime starts', () => {
    const rt = manaUi.runtime(spec, { read: () => undefined });
    expect(rt.view()).not.toContain('mana-transition');
    rt.press('accept');
    expect(rt.view()).toMatch(/<div class="mana-transition" data-key="tx1" data-way="in"><\/div><\/div>$/);
    rt.press('back');
    expect(rt.view()).toContain('data-key="tx2" data-way="out"');
  });
  it('the theme\'s transition animates it; the greybox, less motion and less flash draw nothing', () => {
    expect(themeCss({ transition: 'iris' })).toContain(`--mana-tx:${TRANSITIONS.iris.tx}`);
    expect(GREYBOX_VARS.tx).toBe('none');
    expect(sheet).toMatch(/\.r\[data-motion=reduced\]\{[^}]*--mana-tx:none!important/);
    expect(sheet).toMatch(/\.r\[data-flash=reduced\]\{[^}]*--mana-tx:none!important/);
    for (const w of Object.values(TRANSITIONS).map((x) => x.tx).filter((x) => x !== 'none')) expect(sheet, w).toContain(`@keyframes ${w}{`);
    const rt = manaUi.runtime(spec, { read: () => undefined });
    rt.reduceFlash(true);
    expect(rt.view()).toContain('data-flash="reduced"');
  });
});

describe('mana-ui: numbers that count', () => {
  const hudOf = (...parts) => ({ use: 'hud', children: [{ use: 'region', props: { at: 'top-left' }, children: parts }] });
  it('a changed number counts to its new value on the game\'s clock, its tick heard; without a clock it lands at once', () => {
    let t = 0;
    const st = { gold: 10 }, log = [];
    const rt = manaUi.runtime({ hud: hudOf({ use: 'counter', props: { label: 'Gold', value: { bind: 'gold' } } }), screens: {} }, { read: (p) => st[p], now: () => t, countUp: 1, cues: 'full', act: (e) => log.push(e) });
    st.gold = 110; rt.tick();
    expect(rt.view()).toMatch(/data-ch="up" data-key="ch1">10<s/);
    t = 0.5; expect(rt.tick()).toBe(true);
    const mid = Number(rt.view().match(/data-key="ch1">(\d+)</)[1]);
    expect(mid).toBeGreaterThan(10); expect(mid).toBeLessThan(110);
    t = 1.1; rt.tick();
    expect(rt.view()).toContain('data-key="ch1">110<');
    expect(rt.tick()).toBe(false);                                      // landed: nothing left to draw
    expect(log.filter((e) => e.sound === 'tick').length).toBeGreaterThan(0);
    const still = { gold: 1 }, at = manaUi.runtime({ hud: hudOf({ use: 'counter', props: { label: 'Gold', value: { bind: 'gold' } } }), screens: {} }, { read: (p) => still[p], countUp: 1 });
    still.gold = 9; at.tick();
    expect(at.view()).toContain('data-key="ch1">9<');
    expect(() => manaUi.runtime({ screens: {} }, { countUp: -1 })).toThrow(/countUp is the seconds/);
  });
  it('a results board\'s rows count up from zero one after another; accept lands them all and does nothing else', () => {
    let t = 0;
    const log = [], I = IDIOMS['results-screen'];
    const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'results-screen', props: I.example } } }), { read: sample, now: () => t, countUp: 1, cues: 'full', act: (e) => log.push(e) });
    t = 0.4; rt.tick();
    const nums = () => [...rt.view().matchAll(/class="mana-stat"><span class="mana-label">[^<]+<\/span><span class="mana-num">([^<]+)</g)].map((m) => m[1]);
    const [, foes, dmg] = nums();
    expect(Number(foes)).toBeLessThan(23);
    expect(Number(dmg)).toBe(0);                                          // the next row has not begun
    rt.press('accept');
    expect(nums().slice(1, 3)).toEqual(['23', '140']);
    expect(log.map((e) => e.sound || e.emit)).toEqual(expect.arrayContaining(['skip']));
    expect(log.some((e) => e.emit)).toBe(false);                          // the skip took the press
    rt.press('accept');
    expect(log.some((e) => e.emit === 'continue')).toBe(true);
    expect(rt.view()).toContain('data-variant="stamp"');
    expect(rt.view()).toContain('class="mana-banner"');
  });
});

describe('mana-ui: passing words', () => {
  it('a feed merges a line said again in a row', () => {
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', children: [{ use: 'feed', props: { rows: ['Picked up a tonic', 'Picked up a tonic', 'Picked up a tonic', 'Saw a wolf'] } }] }] }, screens: {} }, {});
    expect(rt.view()).toContain('Picked up a tonic<b class="mana-times"> ×3</b></div><div class="mana-line">Saw a wolf');
  });
  it('a rare toast is held longer, wears its tier and has its own sound; a toast shows its icon', () => {
    let t = 0;
    const st = { rows: [] }, log = [];
    const rt = manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', children: [{ use: 'moments', props: { rows: { bind: 'rows' }, as: 'toast', hold: 2, read: 1 } }] }] }, screens: {} }, { read: (p) => st[p], now: () => t, cues: 'full', act: (e) => log.push(e) });
    st.rows = [{ id: 'a', text: 'Untouchable', tier: 'rare', icon: 'Shield' }]; rt.tick();
    expect(rt.view()).toMatch(/class="mana-toast" data-key="m1" data-tier="rare" data-weight="1"><span class="mana-icon" data-size="l">S<\/span>/);
    t = 2.5; rt.tick();
    expect(rt.view()).toContain('Untouchable');                          // a plain one would be gone at 2
    t = 3.3; rt.tick();
    expect(rt.view()).not.toContain('Untouchable');
    st.rows = [...st.rows, { id: 'b', text: 'First Blood' }]; rt.tick();
    expect(log.map((e) => e.sound)).toEqual(['rare', 'toast']);
  });
});

describe('mana-ui: blows over the world', () => {
  it('damage numbers are bare with the halo, toned by their kind, a crit larger, popping and rising', () => {
    const I = IDIOMS['damage-numbers'], rt = manaUi.runtime(withIdioms({ hud: { use: 'hud', children: [{ use: 'damage-numbers', props: I.example }] }, screens: {} }), { read: sample });
    const html = rt.view();
    expect(html).toContain('class="mana-anchors" data-variant="bare"');
    const kinds = new Set(SAMPLE_STATE.pops.map((p) => p.kind));
    for (const k of kinds) expect(html).toContain(`data-tone="${k}"`);
    expect(sheet).toMatch(/\[data-variant=bare\] \.mana-anchor>\*\{[^}]*text-shadow:var\(--mana-halo\)/);
    expect(sheet).toMatch(/\[data-role=numeral\]\[data-tone=crit\]\{font-size:/);
  });
});

describe('mana-ui: the player\'s channels and the flash guard', () => {
  it('every animation that repeats breathes at under 3 a second (XAG 118), and repeats only where the theme moves', () => {
    const loops = sheet.split('\n').filter((l) => /animation:[^;}]*infinite/.test(l));
    expect(loops.length).toBeGreaterThan(0);
    for (const l of loops) {
      const secs = Number(l.match(/animation:\S+ ([\d.]+)s/)[1]);
      expect(1 / secs, l.slice(0, 80)).toBeLessThan(3);
      expect(l, 'a loop the greybox and less motion hold').toContain('animation-play-state:var(--mana-loop)');
    }
  });
  it('less flash is the player\'s own, apart from less motion: no cover, no sheen, a change pops without flashing', () => {
    expect(sheet).toMatch(/\.r\[data-flash=reduced\]\{--mana-sheen:0!important/);
    expect(sheet).toMatch(/\.r\[data-flash=reduced\] \[data-ch\]\{animation:mana-pop /);
    const rt = manaUi.runtime({ screens: {} }, {});
    rt.reduceFlash(true); rt.reduceMotion(false);
    expect(rt.state()).toMatchObject({ reducedFlash: true, reducedMotion: false });
  });
  it('a label is the ink at a lower weight; grey is for what cannot be used, and a caption', () => {
    const label = sheet.split('\n').find((l) => l.startsWith('.r .mana-text[data-role=label]'));
    expect(label).toContain('color:var(--mana-ink)');
    expect(sheet).toMatch(/\.r \[data-st=disabled\]\{color:var\(--mana-mid\)/);
    expect(readTheme('modern').focus).toBe('bar');
  });
});
