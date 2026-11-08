import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { manaCss, GREYBOX_VARS } from './css.js';
import * as THEME_MODULE from './theme.js';
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
  it('a slant is a word: tabs, bars, banners, keys and buttons lean, a window never does; words lean no further than an italic', () => {
    expect(themeCss({ slant: 'hard' })).toContain(`--mana-slant:${SLANTS.hard}`);
    expect(themeCss({ slant: 'hard' })).toContain(`--mana-slant-words:${SLANTS.light}`);
    const lean = sheet.split('\n').find((l) => l.includes('{transform:skewX(var(--mana-slant))}'));
    const words = sheet.split('\n').find((l) => l.includes('{transform:skewX(var(--mana-slant-words))}'));
    for (const c of ['banner', 'track']) expect(lean, c).toContain(`.mana-${c}`);
    for (const c of ['tablabel', 'key', 'button']) expect(words, c).toContain(`.mana-${c}`);
    expect(lean + words).not.toContain('.mana-window');
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
    // a load's activity mark is a signal, not an ornament: it moves in every theme (a load must never look frozen), and
    // less motion breathes it instead of turning it
    const signal = (l) => /\.mana-spin|\.mana-sweep/.test(l);
    for (const l of loops) {
      const secs = Number(l.match(/animation:\S+ ([\d.]+)s/)[1]);
      expect(1 / secs, l.slice(0, 80)).toBeLessThan(3);
      if (!signal(l)) expect(l, 'a loop the greybox and less motion hold').toContain('animation-play-state:var(--mana-loop)');
    }
    expect(sheet).toContain('.r[data-motion=reduced] .mana-spin,.r[data-motion=reduced] .mana-track[data-known=no] .mana-sweep{animation:mana-pulse');
    expect(sheet).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.r \.mana-spin,[^{]*\{animation:mana-pulse/);
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

describe('mana-ui: the snap', () => {
  it('the item the cursor lands on snaps in from the way it went; a screen opening starts still', () => {
    const log = [], rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'list', props: { rows: ['a', 'b', 'c'] } }, { use: 'slider', props: { label: 'Vol', value: 3 } }]) } }, { read: () => undefined, cues: 'full', act: (e) => log.push(e) });
    expect(rt.view()).not.toContain('data-nav');
    rt.press('down');
    expect(rt.view()).toMatch(/class="mana-root" data-nav="down"/);
    rt.press('up');
    expect(rt.view()).toContain('data-nav="up"');
    rt.press('down'); rt.press('down'); rt.press('down'); rt.press('left');
    expect(log.filter((e) => e.sound)).toEqual(expect.arrayContaining([{ sound: 'move', way: 'down' }, { sound: 'move', way: 'up' }, { sound: 'change', step: -1 }]));
    expect(sheet).toContain('.r[data-nav=down]{--mana-snap-from:0 calc(-1 * var(--mana-snap))}');
    expect(sheet).toMatch(/@keyframes mana-pick\{from\{translate:var\(--mana-snap-from\)/);
  });
  it('how far it snaps and how far the focus stands out are the motion\'s; the greybox and less motion keep it still', () => {
    expect(GREYBOX_VARS.snap).toBe('0px');
    expect(GREYBOX_VARS.nudge).toBe('0px');
    expect(themeCss({ motion: 'snap' })).toMatch(/--mana-snap:calc\(18 \* var\(--mana-du\)\);--mana-nudge:/);
    expect(sheet).toMatch(/\.r\[data-motion=reduced\]\{[^}]*--mana-snap:0px!important;--mana-nudge:0px!important/);
  });
});

describe('mana-ui: the stage and the party language', () => {
  it('a stage is another layer behind everything a screen holds, over its scrim, sweeping in', () => {
    expect(sheet).toMatch(/\.r \.mana-screen::after\{content:"";position:absolute;inset:0;z-index:-1;[^}]*background:var\(--mana-stage\);animation:mana-stage/);
    expect(GREYBOX_VARS.stage).toBe('none');
    expect(themeCss({ stage: 'band' })).toMatch(/--mana-stage:linear-gradient\(-14deg/);
  });
  it('every variation of the party language keeps its principles and changes its dials', () => {
    const { THEME_FAMILIES } = THEME_MODULE;
    const party = THEME_FAMILIES.party.map((id) => readTheme(id));
    for (const T of party) {
      expect(T.slant, `${T.name} leans`).not.toBe('none');
      expect(T.backing, `${T.name} stacks its planes`).not.toBe('none');
      expect(T.breakout, `${T.name} breaks out of the box`).not.toBe('none');
      expect(T.stage, `${T.name} has a shape behind`).not.toBe('none');
      expect(T.material, `${T.name} has a print texture`).not.toBe('none');
      expect(['snap', 'stepped'], `${T.name} slams`).toContain(T.motion);
      expect(T.corner === 'cut' || T.corner === 'round', `${T.name} a hard or a pop edge`).toBe(true);
    }
    // the dials differ: no two variations share their accent, their stage and their voice all at once
    const sig = party.map((T) => `${T.tokens.accent}|${T.stage}|${T.sounds}`);
    expect(new Set(sig).size).toBe(party.length);
  });
});

describe('mana-ui: appearing, leaving, shuffling', () => {
  const listed = (st) => manaUi.runtime({ hud: { use: 'hud', children: [{ use: 'region', children: [{ use: 'feed', props: { rows: [] } }] }] }, start: 'a', screens: { a: screen([{ use: 'list', props: { rows: { bind: 'rows' } } }]) } }, { read: (p) => st[p], cues: 'full', act: (e) => st.log.push(e) });
  it('rows that came, went or moved past each other are marked and heard once, however many', () => {
    const st = { rows: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id })), log: [] }, rt = listed(st);
    expect(rt.view()).toContain('data-id="a"');
    st.rows = [st.rows[1], st.rows[0], st.rows[2], st.rows[3]]; rt.tick();          // a and b trade places
    expect(rt.view()).toMatch(/data-id="b"[^>]*data-moved="up"/);
    expect(rt.view()).toMatch(/data-id="a"[^>]*data-moved="down"/);
    st.rows = [{ id: 'z', label: 'z' }, ...st.rows]; rt.tick();                       // one comes in on top: nothing moved past
    expect(rt.view()).not.toContain('data-moved');
    st.rows = st.rows.slice(0, 2); rt.tick();                                          // three go
    expect(st.log.filter((e) => e.sound)).toEqual([{ sound: 'shuffle', count: 2 }, { sound: 'appear', count: 1 }, { sound: 'vanish', count: 3 }]);
  });
  it('a screen opening is heard as it lands, with the rows it fills with; the screen a runtime starts on is not', () => {
    const log = [], rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'button', props: { label: 'Go' }, on: { accept: { open: 'b' } } }]), b: screen([{ use: 'list', props: { rows: ['x', 'y', 'z'] } }]) } }, { read: () => undefined, cues: 'full', act: (e) => log.push(e) });
    expect(log).toEqual([]);
    rt.press('accept');
    expect(log.filter((e) => e.sound)).toEqual([{ sound: 'accept' }, { sound: 'open', rows: 3 }]);
  });
  it('the frame builds, its rows fill it after the lead in reading order, the title slams first; parts come from the screen\'s side', () => {
    expect(sheet).toMatch(/animation-delay:calc\(var\(--mana-lead\) \+ var\(--mana-i,0\) \* var\(--mana-stagger\)\)/);
    expect(sheet).toContain('.r .mana-screen[data-place=left]{--mana-enter:calc(-3 * var(--mana-travel)) 0}');
    expect(sheet).toMatch(/@keyframes mana-rise\{from\{opacity:0;translate:var\(--mana-enter\)\}\}/);
    expect(sheet).toMatch(/\.r \.mana-screen>\.mana-title\{animation:mana-slam/);
    expect(GREYBOX_VARS.lead).toBe('0ms');
  });
  it('what leaves goes faster than it came, accelerating away, never bouncing', () => {
    for (const sel of ['.mana-screen[data-leaving]', '.mana-toast[data-leaving]', '.mana-banner[data-leaving]']) {
      const r = sheet.split('\n').find((l) => l.startsWith(`.r ${sel}{`));
      expect(r, sel).toMatch(/calc\(var\(--mana-dur\) \* \.7\) var\(--mana-out\) both/);
    }
    for (const w of Object.keys(THEME_MODULE.MOTIONS)) expect(THEME_MODULE.MOTIONS[w].out, w).not.toMatch(/1\.[0-9]+\s*,\s*[\d.]+\)$/);   // no overshoot on an exit
  });
  it('the view keeps a screen that leaves until its exit has played, out of the way of what is drawn next', async () => {
    const { JSDOM } = await import('jsdom');
    const w = new JSDOM('<div id="m"></div>', { pretendToBeVisual: true }).window;
    const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
    globalThis.document = w.document; globalThis.getComputedStyle = w.getComputedStyle.bind(w);
    try {
      const rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'button', props: { label: 'Go' }, on: { accept: { open: 'b' } } }]), b: screen([{ use: 'button', props: { label: 'x' } }]) } }, { read: () => undefined });
      const el = w.document.getElementById('m'), view = manaUi.mount(el, rt);
      rt.press('accept'); view.paint();
      const screens = () => [...el.querySelectorAll('.mana-screen')];
      expect(screens().map((n) => [n.getAttribute('data-key'), n.hasAttribute('data-leaving')])).toEqual([['b', false], ['a', true]]);
      rt.press('back'); view.paint();                                               // b leaves too; a comes back, drawn fresh
      expect(screens().filter((n) => !n.hasAttribute('data-leaving')).map((n) => n.getAttribute('data-key'))).toEqual(['a']);
      await new Promise((r) => setTimeout(r, 950));
      expect(screens().map((n) => n.getAttribute('data-key'))).toEqual(['a']);       // the exits have played and gone
    } finally { globalThis.document = saved.document; globalThis.getComputedStyle = saved.getComputedStyle; }
  });
});

describe('mana-ui: a press is seen', () => {
  const spec = { start: 'a', screens: { a: screen([{ use: 'list', props: { rows: [{ label: 'Go' }, { label: 'Locked', disabled: true }, { label: 'Stay' }] }, on: { accept: { emit: 'go' } } }]) } };
  it('confirm marks what was pressed, again on a second press; deny marks a disabled row; moving away clears it', () => {
    const rt = manaUi.runtime(spec, { read: () => undefined, act: () => {} });
    rt.press('accept');
    expect(rt.view()).toMatch(/data-k="0" data-press="accept-a"/);
    rt.press('accept');
    expect(rt.view()).toMatch(/data-k="0" data-press="accept-b"/);   // a new name: it plays again
    rt.press('down'); rt.press('accept');
    expect(rt.view()).toMatch(/data-k="1" data-press="deny-[ab]"/);
    rt.press('down');
    expect(rt.view()).not.toContain('data-press');
    expect(sheet).toMatch(/\.r \[data-press=accept-a\]\{animation:mana-confirm-a /);
    expect(sheet).toMatch(/\.r\[data-flash=reduced\] \[data-press=accept-a\]\{animation:mana-press-a /);   // the ring, no fill
    expect(sheet).toContain('@keyframes mana-deny-a{0%,100%{translate:0 0}15%{translate:calc(-.8 * var(--mana-travel)) 0;');
  });
  it('a confirm that opens another screen is still seen, on the screen that leaves', async () => {
    const { JSDOM } = await import('jsdom');
    const w = new JSDOM('<div id="m"></div>').window, saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
    globalThis.document = w.document; globalThis.getComputedStyle = w.getComputedStyle.bind(w);
    try {
      const rt = manaUi.runtime({ start: 'a', screens: { a: screen([{ use: 'button', props: { label: 'Go' }, on: { accept: { open: 'b' } } }]), b: screen([{ use: 'button', props: { label: 'x' } }]) } }, { read: () => undefined });
      const el = w.document.getElementById('m'), view = manaUi.mount(el, rt);
      rt.press('accept'); view.paint();
      const gone = el.querySelector('.mana-screen[data-leaving]');
      expect(gone.querySelector('[data-press]').getAttribute('data-press')).toBe('accept-a');
    } finally { globalThis.document = saved.document; globalThis.getComputedStyle = saved.getComputedStyle; }
  });
});

describe('mana-ui: fades and the pause\'s veil', () => {
  it('a fade dips the stage to black and back; a blur blurs it through; neither under less flash', () => {
    expect(sheet).toMatch(/@keyframes mana-tx-fade\{0%\{opacity:0\}42%,58%\{opacity:1\}100%\{opacity:0\}\}/);
    expect(sheet).toContain('@keyframes mana-tx-blur{0%{opacity:1;backdrop-filter:blur(0px)}50%{opacity:1;backdrop-filter:blur(14px)}');
    expect(themeCss({ transition: 'blur' })).toContain('.mana-transition{background:transparent}');
  });
  it('a pause dims, blurs or frosts what it covers, under its scrim; the greybox covers it with the scrim alone', () => {
    expect(sheet).toContain('.r .mana-screen[data-layer=modal]{backdrop-filter:var(--mana-veil);-webkit-backdrop-filter:var(--mana-veil)}');
    expect(GREYBOX_VARS.veil).toBe('none');
    expect(themeCss({ backdrop: 'frost' })).toMatch(/--mana-veil:blur\(18px\)/);
    expect(() => readTheme({ backdrop: 'smoke' })).toThrow(/backdrop is one of: none, dim, blur, frost/);
  });
});
