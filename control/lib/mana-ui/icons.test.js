import { describe, it, expect } from 'vitest';
import { ICONS, ICON_IDS, ICON_STYLES, ICON_ALIASES, iconOf, iconSvg, iconCss } from './icons.js';
import { manaUi } from './kernel.js';
import { readTheme, themeCss, THEME_WORDS } from './theme.js';

// THE PICTOGRAMS: one outline an icon, drawn in the theme's style, named by the runtime and drawn by the sheet.
describe('icons: one outline, five ways', () => {
  it('every icon is one path on the 24 grid; an alias names an icon there is; a name finds its icon', () => {
    for (const id of ICON_IDS) {
      expect(id).toMatch(/^[a-z][a-z-]*$/);
      expect(ICONS[id], id).toMatch(/^M[0-9MmLlHhVvAaCcSsZz .,-]+z$/);
      // (inside the grid: no coordinate of a move or a line far outside it)
      for (const n of ICONS[id].match(/M(-?[0-9.]+) (-?[0-9.]+)/g).flatMap((m) => m.slice(1).split(' ').map(Number))) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(24); }
    }
    for (const [word, id] of Object.entries(ICON_ALIASES)) { expect(ICONS[id], word).toBeDefined(); expect(ICONS[word], word).toBeUndefined(); }
    expect(iconOf('Coins')).toBe('coin');
    expect(iconOf('swipe up')).toBe('swipe-up');
    expect(iconOf('HP')).toBe('heart');
    expect(iconOf('Sir Reginald')).toBeNull();
  });

  it('a style is a way of drawing the same outline: each differs, each is a whole svg with no colour of its own', () => {
    const drawn = ICON_STYLES.map((st) => iconSvg('heart', st));
    expect(new Set(drawn).size).toBe(ICON_STYLES.length - 1);   // (a badge's silhouette is the solid one: its plate is the sheet's)
    for (const svg of drawn) { expect(svg).toMatch(/^<svg xmlns='http:\/\/www.w3.org\/2000\/svg' viewBox='[-0-9 ]+'><path d='M/); expect(svg).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i); }
    expect(() => iconSvg('heart', 'neon')).toThrow(/an icon style is one of: solid, line, chunky, badge, duo/);
    expect(() => iconSvg('sparkle')).toThrow(/icon 'sparkle' is one of: coin, gem/);
  });

  it('the sheet: a rule an icon (its aliases with it), a mask in the ink; none adds nothing', () => {
    expect(iconCss('none')).toBe('');
    const css = iconCss('line', '.mana-root');
    for (const id of ICON_IDS) expect(css).toContain(`[data-icon=${id}]`);
    expect(css).toMatch(/:is\(\[data-icon=coin\],\[data-icon=coins\],\[data-icon=gold\],\[data-icon=money\]\)\{--mana-icon:url\("data:image\/svg\+xml,/);
    expect(css).toContain('mask:var(--mana-icon) center/contain no-repeat');
    expect(css).toContain('background:currentColor');
    expect(css).toContain('font-size:0');   // the initials stand down
    // (a badge keeps a round plate of the accent under a smaller silhouette)
    expect(iconCss('badge')).toMatch(/background:var\(--mana-accent\);border-radius:50%/);
    expect(iconCss('badge')).toContain('inset:19%');
  });
});

describe('in the runtime and the theme', () => {
  const draw = (hud) => { const rt = manaUi.runtime({ screens: {}, hud }, { read: () => 7, act() {} }); return rt.view(); };

  it('the runtime names it and still writes the initials: an icon, a counter\'s icon, a prompt\'s glyph', () => {
    const html = draw({ use: 'hud', children: [{ use: 'region', props: { at: 'top' }, children: [
      { use: 'icon', props: { name: 'Swipe Up' } }, { use: 'counter', props: { label: '', value: 3, icon: 'coin' } }, { use: 'prompt', props: { glyph: 'tap', label: 'jump' } }, { use: 'icon', props: { name: 'Sir Reginald' } }] }] });
    expect(html).toContain('data-icon="swipe-up"');
    expect(html).toContain('data-icon="coin"');
    expect(html).toMatch(/class="mana-key" data-icon="tap"/);
    expect(html).toContain('data-icon="sir-reginald"');   // (named, and no rule finds it: its initials are what is seen)
    expect(html).toContain('>SR<');
  });

  it('a theme says the style; one that says none, and every preset, is as it was', () => {
    expect(THEME_WORDS.icons).toEqual(['none', ...ICON_STYLES]);
    expect(readTheme('idol').icons).toBe('none');
    expect(themeCss('idol')).not.toContain('--mana-icon');
    expect(readTheme({ from: 'idol', icons: 'chunky' }).icons).toBe('chunky');
    expect(themeCss({ from: 'idol', icons: 'chunky' })).toContain(iconCss('chunky', '.mana-root'));
    expect(themeCss({ from: 'idol', icons: 'none' })).toBe(themeCss('idol'));
    expect(() => readTheme({ icons: 'neon' })).toThrow(/theme\.icons is one of: none, solid, line, chunky, badge, duo/);
  });
});
