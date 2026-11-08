import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { manaCss, GREYBOX_VARS, TYPE, PULSE } from './css.js';
import { readTheme, themeCss, themeAdvice, DISTANCES, HALOS, THEMES, THEME_IDS } from './theme.js';
import { IDIOMS, withIdioms } from './idioms.js';
import { SAMPLE_STATE } from './samples.js';
import { manaUiPage } from './index.js';

// A GAME'S FRAME, NOT A PAGE (docs/game-ui-research.md): the screen sized by the stage and the distance, the type in few
// levels with big jumps, text over the world with a halo, the legend a bar at the foot, the UI's sounds as effects, the
// focus a shape, and a press-start that takes any button. One case per procedure, the smallest spec that shows it.
const sheet = manaCss('.r');
const rule = (sel) => sheet.split('\n').find((l) => l.startsWith(`.r ${sel}{`)) || '';
const screen = (children, props = {}) => ({ use: 'screen', props, children });
const run = (spec, host = {}) => manaUi.runtime(spec, { read: () => undefined, ...host });
const list = (rows, extra = {}) => ({ use: 'list', props: { rows }, on: { accept: { emit: 'picked' } }, ...extra });

describe('mana-ui: the frame', () => {
  // XAG 101's body minimum at 1080p: a PC at a desk, a console on a sofa (to verify against the primary page)
  const FLOOR = { desk: 18, couch: 26 };
  it('no text is under the floor for the distance the player sits at', () => {
    const least = Math.min(...Object.values(TYPE));
    for (const d of Object.keys(FLOOR)) expect(least * Number(DISTANCES[d].k), `${d}: ${least}×${DISTANCES[d].k}`).toBeGreaterThanOrEqual(FLOOR[d] - 0.05);
    expect(DISTANCES.hand.u).toMatch(/px$/);   // a phone sizes in CSS px, not by its height
    expect(parseFloat(DISTANCES.hand.min)).toBeGreaterThan(parseFloat(DISTANCES.desk.min));
  });
  it('every role is sized by the stage and the distance, floored, and scaled by the player\'s text size', () => {
    for (const role of ['label', 'caption', 'display']) {
      const r = rule(`.mana-text[data-role=${role}]`) || sheet.split('\n').find((l) => l.includes(`.mana-text[data-role=${role}]`));
      expect(r, role).toMatch(new RegExp(`font-size:calc\\(max\\(var\\(--mana-min\\), ${TYPE[role]} \\* var\\(--mana-du\\)\\) \\* var\\(--mana-scale\\) \\* var\\(--mana-text\\)\\)`));
    }
    expect(GREYBOX_VARS.u).toBe('calc(100cqh / 1080)');
    expect(GREYBOX_VARS.du).toBe('calc(var(--mana-u) * var(--mana-k))');
  });
  it('the ramp has few levels and big jumps; a heading is the ink, not a grey eyebrow', () => {
    expect(new Set(Object.values(TYPE)).size).toBeLessThanOrEqual(4);
    expect(TYPE.title / TYPE.body).toBeGreaterThanOrEqual(2);
    expect(TYPE.display / TYPE.body).toBeGreaterThanOrEqual(3.5);
    expect(rule('.mana-heading')).toContain('color:var(--mana-ink)');
  });
  it('a screen and the HUD\'s places sit in the title-safe frame (90%), a device\'s own inset when larger', () => {
    expect(Number(GREYBOX_VARS.safe)).toBe(0.05);
    expect(rule('.mana-screen')).toContain('padding:max(env(safe-area-inset-top,0px),calc(var(--mana-safe) * 100cqh))');
    expect(sheet).toContain('[data-at=top-left]{top:calc(var(--mana-safe) * 100cqh);left:calc(var(--mana-safe) * 100cqw)}');
  });
  it('a distance is a theme word: the couch scales the frame, an unknown one is named', () => {
    expect(themeCss({ distance: 'couch' })).toContain(`--mana-k:${DISTANCES.couch.k}`);
    expect(() => readTheme({ distance: 'sofa' })).toThrow(/distance is one of: desk, couch, hand/);
  });
  it('the player\'s text size and the subtitles\' plate are the root\'s own, and bad ones are named', () => {
    const rt = run({ start: 'a', screens: { a: screen([list(['x'])]) } });
    rt.textScale(1.5); rt.subtitlePlate(0.4);
    expect(rt.view()).toMatch(/class="mana-root"[^>]*style="--mana-text:1.5;--mana-sub-plate:0.4"/);
    expect(() => rt.textScale(3)).toThrow(/1, 1.25, 1.5, 1.75, 2/);
    expect(() => rt.subtitlePlate(2)).toThrow(/0 to 1/);
    rt.textScale(1); rt.subtitlePlate(null);
    expect(rt.view()).not.toContain('style="--mana');
  });
});

describe('mana-ui: text over the world', () => {
  it('text with no window behind it keeps the halo; inside a window it needs none', () => {
    expect(sheet).toMatch(/\.r \.mana-window\[data-variant=ghost\][^{]*\{text-shadow:var\(--mana-halo\)\}/);
    expect(sheet).toMatch(/\.r \.mana-window:not\(\[data-variant=ghost\]\)[^{]*\{text-shadow:none\}/);
    expect(GREYBOX_VARS.halo).toBe(HALOS.outline);
    expect(HALOS.outline).toContain('var(--mana-panel)');   // the panel's colour: it reads over any scene
  });
  it('a halo is a word; a plate puts the panel behind a ghost window instead', () => {
    expect(themeCss({ halo: 'glow' })).toContain(`--mana-halo:${HALOS.glow}`);
    expect(themeCss({ halo: 'plate' })).toMatch(/\.mana-window\[data-variant=ghost\]\{background:rgba\(/);
    expect(() => readTheme({ halo: 'neon' })).toThrow(/halo is one of/);
  });
  it('the subtitles sit on their own plate, its opacity the player\'s', () => {
    const I = IDIOMS.subtitles, rt = manaUi.runtime(withIdioms({ hud: { use: 'hud', children: [{ use: 'subtitles', props: I.example }] }, screens: {} }), { read: (p) => manaUi.readPath(SAMPLE_STATE, p) });
    expect(rt.view()).toContain('data-variant="subtitles"');
    expect(sheet).toContain('calc(var(--mana-sub-plate) * 100%)');
  });
});

describe('mana-ui: the legend bar', () => {
  it('a screen that names no legend gets one from what it holds; back only where back leaves something', () => {
    const over = run({ start: 'a', screens: { a: screen([list(['x', 'y'])], { layer: 'overlay' }) } });
    over.glyphs({ keys: { accept: 'Enter', back: 'Esc' } }); over.input('keys');
    expect(over.view()).toMatch(/<div class="mana-legend"><span class="mana-hint"><span class="mana-key">Enter<\/span><span>Select<\/span><\/span><\/div><\/section>/);
    const modal = run({ start: 'a', screens: { a: screen([{ use: 'tabs', children: [{ use: 'tab', props: { label: 'A' }, children: [{ use: 'toggle', props: { label: 'Sound', value: true } }] }] }]) } });
    expect(modal.view()).toMatch(/>left<\/span><span class="mana-key">right<\/span><span>Change<.*>tabPrev<.*>Tabs<.*>back<\/span><span>Back</);
  });
  it('a screen\'s own legend is the bar, none draws none, and a finger needs none', () => {
    const own = run({ start: 'a', screens: { a: screen([list(['x']), { use: 'legend', props: { rows: [{ action: 'accept', label: 'pick' }] } }]) } });
    expect(own.view().match(/class="mana-legend"/g)).toHaveLength(1);
    expect(run({ start: 'a', screens: { a: screen([list(['x'])], { legend: 'none' }) } }).view()).not.toContain('mana-legend');
    const touch = run({ start: 'a', screens: { a: screen([list(['x'])]) } });
    touch.input('touch');
    expect(touch.view()).not.toContain('mana-legend');
    expect(rule('.mana-screen>.mana-legend')).toMatch(/position:absolute;right:.*bottom:/);
  });
});

describe('mana-ui: the UI\'s sounds', () => {
  const spec = { start: 'a', screens: {
    a: screen([list([{ label: 'On' }, { label: 'Off', disabled: true }]), { use: 'toggle', props: { label: 'Music', value: false } }, { use: 'button', props: { label: 'More' }, on: { accept: { open: 'b' } } }]),
    b: screen([list(['x'])]),
  } };
  const heard = (cues, ...actions) => { const log = [], rt = run(spec, { cues, act: (e) => log.push(e) }); actions.forEach((a) => rt.press(a)); return log.filter((e) => e.sound).map((e) => e.sound); };
  it('silent, the default, sends none; ticks the cursor\'s; full every state change, as effects', () => {
    expect(heard(undefined, 'down', 'accept', 'down', 'accept')).toEqual([]);
    expect(heard('full', 'down', 'accept', 'down', 'accept', 'down', 'accept', 'back')).toEqual(['move', 'deny', 'move', 'change', 'move', 'accept', 'open', 'back']);
    expect(heard('ticks', 'down', 'accept', 'down', 'accept', 'down', 'accept', 'back')).toEqual(['move', 'move', 'move', 'accept', 'back']);
    expect(() => run(spec, { cues: 'loud' })).toThrow(/host.cues is one of: silent, ticks, full/);
  });
  it('a theme says which, and the page hands it to its host', () => {
    expect(readTheme('greybox').cues).toBe('silent');
    const loud = THEME_IDS.find((id) => readTheme(id).cues === 'full');
    expect(manaUiPage({ start: 'a', screens: { a: screen([list(['x'])]) } }, { theme: loud })).toContain('cues: "full"');
  });
});

describe('mana-ui: the focus and press start', () => {
  it('the greybox\'s focus is the ▶ (a shape); a theme\'s other focus word takes it and its room away', () => {
    expect(GREYBOX_VARS.cursor).toBe('"\\25B6"');
    expect(rule('[data-st=focus]::before')).toContain('content:var(--mana-cursor)');
    const ring = themeCss({ focus: 'ring' });
    expect(ring).toContain('--mana-cursor:none;--mana-mark:0');
    expect(ring).toContain('[data-st=focus]{outline:2px solid');
    expect(themeCss({ focus: 'bar' })).toMatch(/\[data-st=focus\]\{[^}]*linear-gradient\(90deg/);
    expect(themeAdvice('greybox')).toEqual([]);
  });
  it('press start takes any face or shoulder button, the seat that pressed in the effect; the d-pad moves, back leaves', () => {
    const I = IDIOMS['attract-screen'], log = [];
    const rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'attract-screen', props: I.example } } }), { read: (p) => manaUi.readPath(SAMPLE_STATE, p), act: (e) => log.push(e) });
    rt.press('down'); rt.press('left');
    expect(log).toEqual([]);
    rt.press('tabNext', 0);
    expect(log).toEqual([{ emit: 'start', seat: 0 }]);
    expect(rt.view()).toContain('data-press="any"');
    rt.press('back');
    expect(rt.state().screen).toBe(null);
  });
  it('the prompt breathes well under the 3 flashes a second XAG 118 allows, and holds still under less motion', () => {
    expect(1 / PULSE).toBeLessThan(3);
    expect(sheet).toMatch(/\[data-press=any\] \.mana-button\{[^}]*animation:mana-pulse [\d.]+s[^}]*animation-play-state:var\(--mana-loop\)/);
    expect(GREYBOX_VARS.loop).toBe('paused');
  });
  it('the title is key art behind, the menu in the left third, the version in a corner', () => {
    const I = IDIOMS['title-screen'], rt = manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'title-screen', props: I.example } } }), { read: (p) => manaUi.readPath(SAMPLE_STATE, p) });
    const html = rt.view();
    expect(html).toContain('data-place="left"');
    expect(html).toContain('data-ratio="backdrop"');
    expect(html).toContain('class="mana-list" data-variant="menu"');
    expect(html).toMatch(/class="mana-region" data-at="bottom-left"/);
    expect(THEMES.greybox.focus).toBe('marker');
  });
});
