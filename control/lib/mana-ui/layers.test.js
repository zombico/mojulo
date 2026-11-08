import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { manaCss, GREYBOX_VARS } from './css.js';
import { readTheme, themeCss, themeAdvice, contrast, THEME_WORDS, LAYER_WORDS, FIELD } from './theme.js';

// A GAME'S UI SITS ON A THING THAT SITS ON A THING: a window's layers under what it holds (its plate, what the plate sits
// on, a crest over its edge), the plate's material, words breaking out of the box, a filter over the stage. Each a theme
// word, so a look is still words and never a node's style. One case per procedure.
const sheet = manaCss('.r');
const screen = (children, props = {}) => ({ use: 'screen', props, children });
const view = (children, props) => manaUi.runtime({ start: 'a', screens: { a: screen(children, props) } }, {}).view();

describe('mana-ui: a window in layers', () => {
  it('a window draws its layers under what it holds; a ghost window, words over the world, has none', () => {
    expect(view([{ use: 'window', props: { title: 'Bag' }, children: [{ use: 'text', props: { value: 'x' } }] }])).toContain('<div class="mana-window" data-variant="plain"><i aria-hidden="true" class="mana-layers"><b></b></i><h3 class="mana-heading">Bag</h3>');
    expect(view([{ use: 'window', props: { variant: 'ghost' }, children: [{ use: 'text', props: { value: 'x' } }] }])).not.toContain('mana-layers');
  });
  it('the greybox draws no layers: the window keeps its own plate', () => {
    expect(sheet).toContain('.r .mana-layers{display:none;');
    expect(themeCss('greybox')).not.toContain('>.mana-layers{display:block}');
  });
  it('a backing or a crest moves the plate into the layers, the thing it sits on under it, the crest over its edge', () => {
    const css = themeCss({ backing: 'stack', crest: 'victorian' });
    expect(css).toMatch(/\.mana-window:not\(\[data-variant=ghost\]\)\{background:transparent;border-color:transparent;isolation:isolate\}/);
    expect(css).toMatch(/>\.mana-layers::before\{[^}]*rotate:-2.2deg/);
    expect(css).toMatch(/>\.mana-layers>b\{left:50%;top:calc\(-40/);
    // a window sized by what it holds lets its layers past its box; one filling a pane keeps its clip
    expect(css).toContain('.mana-window:not([data-variant=ghost]){overflow:visible}');
    expect(css).toMatch(/\.mana-split,\.mana-each\) \.mana-window:not\(\[data-variant=ghost\]\)\{overflow:clip;overflow-clip-margin:\d+px\}/);
    // a cut corner cuts the plate, never the slab under it or the crest over it
    expect(themeCss({ backing: 'offset', corner: 'cut' })).toMatch(/>\.mana-layers::after,[^{]*\{clip-path:polygon/);
  });
  it('a sub-panel sits on its panel: no backing or crest of its own', () => {
    expect(sheet).toContain('.r .mana-window .mana-window>.mana-layers::before,.r .mana-window .mana-window>.mana-layers>b{display:none}');
  });
});

describe('mana-ui: the plate\'s material', () => {
  it('a material is laid in the plate, wherever a plate is, drawn in the page and the same every time', () => {
    const a = themeCss({ material: 'parchment' }), b = themeCss({ material: 'parchment' });
    expect(a).toBe(b);
    const plate = a.match(/--mana-plate:([^;]*(?:url\([^)]*\)[^;]*)*);--mana-motion/)[1];
    expect(plate).toContain('data:image/svg+xml,');
    expect(plate).toContain('feTurbulence');
    expect(a).not.toMatch(/url\(["']?https?:/);
    expect(themeCss({ material: 'grid' })).toMatch(/--mana-plate:linear-gradient\(rgba/);
  });
  it('a sheet that changes its colour is measured as the sheet it lays; glass with no halo is advised', () => {
    const faint = { tokens: { ink: '#8a7a60', panel: '#fafafa', line: '#111111', accent: '#111111' }, material: 'parchment' };
    expect(themeAdvice(faint).some((x) => x.at === 'material: parchment / ink')).toBe(true);
    expect(themeAdvice({ material: 'glass', halo: 'none' }).map((x) => x.law)).toContain('glass-reads');
    expect(themeAdvice('greybox')).toEqual([]);
  });
});

describe('mana-ui: words breaking out of the box', () => {
  it('a heading as a tab across its window\'s edge; a sub-panel\'s stays put', () => {
    const css = themeCss({ breakout: 'tab' });
    expect(css).toMatch(/>\.mana-heading\{position:absolute;top:0;[^}]*translate:0 -55%/);
    expect(css).toContain('.mana-window .mana-window>.mana-heading{position:static;');
  });
  it('a title and a display echoed huge and hollow behind themselves, read on the element itself', () => {
    expect(view([{ use: 'text', props: { value: 'Victory', role: 'display' } }], { title: 'Results' })).toMatch(/<h2 class="mana-title" data-echo="Results">.*data-echo="Victory"/);
    expect(themeCss({ breakout: 'echo' })).toContain('::before{content:attr(data-echo)}');
    expect(themeCss('greybox')).not.toContain('attr(data-echo)');
    expect(sheet).toMatch(/\.mana-text\[data-role=display\]\)::before\{content:none;/);
  });
});

describe('mana-ui: a filter over the stage', () => {
  it('an overlay is drawn over the picture only while the UI is up, never over the words, and never moves', () => {
    const rule = sheet.split('\n').find((l) => l.includes(':not([data-open=none]))::before{'));
    expect(rule).toContain('.r:is([data-hud=yes],:not([data-open=none]))::before{content:"";position:absolute;inset:0;z-index:0');
    expect(rule).not.toContain('animation');
    // over a screen's scrim, key art and stage, under what it holds (its parts are positioned, so they paint over it)
    expect(sheet).toContain('.r .mana-screen::before{content:"";position:absolute;inset:0;pointer-events:none;background:var(--mana-overlay)}');
    expect(sheet).toContain('.r .mana-screen>:where(*){position:relative}');
    expect(GREYBOX_VARS.overlay).toBe('none');
    expect(themeCss({ overlay: 'crt' })).toMatch(/--mana-overlay:repeating-linear-gradient\(0deg/);
  });
  it('every layer word teaches what exists', () => {
    for (const w of LAYER_WORDS) {
      expect(THEME_WORDS[w][0]).toBe('none');
      expect(() => readTheme({ [w]: 'gilded' })).toThrow(new RegExp(`theme.${w} is one of: none,`));
    }
  });
});

// RESTRAINT WHERE THE WORDS ARE: a look has many ways to show itself, but where the words are it holds back. The texture
// is loud at a window's rim and quiet under its words; a filter covers the picture, never the words; words on a fill take
// the ink that reads; words lean no further than an italic; a window with no plate keeps its words' halo.
describe('mana-ui: restraint where the words are', () => {
  it('a material\'s texture is quiet under the words and whole at the rim, which fades out before they begin', () => {
    const css = themeCss({ material: 'grid' }), plate = css.match(/--mana-plate:([^;]+)/)[1];
    const alphas = (x) => [...x.matchAll(/rgba\([\d,]+,([\d.]+)\)/g)].map((m) => +m[1]);
    const rim = css.split('\n').find((l) => l.includes('.mana-window:not([data-variant=ghost])::after{'));
    expect(Math.max(...alphas(plate))).toBeCloseTo(Math.max(...alphas(rim)) * FIELD, 3);   // the same texture, quieter
    expect(rim).toMatch(/z-index:-1;.*mask:linear-gradient\(90deg,#000,transparent/);       // under the words, at the edges
    expect(css).toContain('.mana-window:not([data-variant=ghost]){isolation:isolate}');      // over the plate, under its words
    expect(css).toContain('.mana-window .mana-window::after{content:none}');               // a sub-panel is all words
    expect(themeCss({ ornaments: ['scanlines'] })).toMatch(/::after\{[^}]*repeating-linear-gradient\(0deg[^}]*mask:/);
    expect(themeCss('greybox')).not.toContain('mask:');                                     // no texture, no rim
  });
  it('words on a fill take whichever of the ink and the panel reads on it', () => {
    const k = { ink: '#111111', panel: '#ffffff', line: '#111111', accent: '#ffd400' };      // a light accent on a light panel
    const css = themeCss({ tokens: k, focus: 'fill', breakout: 'tab' });
    expect(css).toContain('[data-st=focus]{outline:none;background:#ffd400;border-color:#ffd400;color:#111111}');
    expect(css).toMatch(/>\.mana-heading\{[^}]*background:#ffd400;color:#111111/);
    expect(themeAdvice({ tokens: k, focus: 'fill' }).some((a) => a.law === 'focus-reads')).toBe(false);
    const dull = { ...k, ink: '#9a9a9a', panel: '#b0b0b0', accent: '#a5a5a5' };              // nothing reads: it is said
    expect(themeAdvice({ tokens: dull, focus: 'bar' }).map((a) => a.law)).toContain('focus-reads');
    expect(contrast('#111111', '#ffd400')).toBeGreaterThan(4.5);
  });
  it('over a stage, words with no window sit on a band of the panel, and a button on the screen is filled', () => {
    const css = themeCss({ stage: 'burst' });
    expect(css).toMatch(/\.mana-screen :is\(\.mana-window\[data-variant=ghost\],\.mana-screen>\.mana-stack:has\(>:is\(\.mana-bar,\.mana-list,[^)]*\)\)\)\{background:linear-gradient\(90deg/);
    expect(css).toMatch(/\.mana-screen>\.mana-button:not\(\[data-st=focus\]\)\{background:rgba/);
    expect(themeCss({ stage: 'none' })).not.toContain('.mana-screen>.mana-button:not(');
    expect(themeCss({ stage: 'burst', halo: 'plate' })).not.toMatch(/:is\(\.mana-window\[data-variant=ghost\],/);  // the plate already does
  });
  it('in a pane that fills the screen, a picture gives up its height before the words beside it', () => {
    expect(sheet).toMatch(/\.mana-screen\[data-place=full\] \.mana-window>\.mana-stack>\.mana-image\{flex:1 1 0;min-height:[^;]+;aspect-ratio:auto\}/);
  });
  it('a window with no plate keeps its words\' halo', () => {
    expect(themeCss({ plate: 'clear' })).toContain('.mana-window:not([data-variant=ghost]){text-shadow:var(--mana-halo)}');
    expect(themeCss({ plate: 'solid' })).not.toContain('{text-shadow:var(--mana-halo)}');
  });
});
