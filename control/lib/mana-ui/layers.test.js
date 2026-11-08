import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { manaCss, GREYBOX_VARS } from './css.js';
import { readTheme, themeCss, themeAdvice, THEME_WORDS, LAYER_WORDS } from './theme.js';

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
  it('an overlay is drawn over the whole stage only while the UI is up, and never moves', () => {
    const rule = sheet.split('\n').find((l) => l.includes('::after{content:"";position:absolute;inset:0;z-index:10'));
    expect(rule).toContain('.r:is([data-hud=yes],:not([data-open=none]))::after');
    expect(rule).not.toContain('animation');
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
