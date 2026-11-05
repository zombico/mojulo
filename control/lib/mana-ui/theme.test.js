import { describe, it, expect } from 'vitest';
import { readTheme, themeCss, themeAdvice, contrast, THEMES, THEME_IDS } from './theme.js';
import { GREYBOX_VARS } from './css.js';
import { manaUiBoard } from './board.js';

// The style layer: a theme is closed words and colours read and checked, written as variables and a few rules over
// the greybox; its colours are measured, never refused. One case per procedure, chosen in code from the presets.
const FONT = 'data:font/ttf;base64,AAEAAAALAIAAAwAwT1MvMg==';

describe('mana-ui themes: reading teaches', () => {
  it('a look is words, never CSS: an unknown key, word, colour or family is named', () => {
    expect(() => readTheme({ css: 'a{}' })).toThrow(/a look is words, never CSS/);
    expect(() => readTheme({ frame: 'chunky' })).toThrow(/frame is one of: none, hairline/);
    expect(() => readTheme({ tokens: { ink: 'red' } })).toThrow(/is a hex colour/);
    expect(() => readTheme({ tokens: { glow: '#fff' } })).toThrow(/the tokens are ink, panel/);
    expect(() => readTheme({ ornaments: ['tendrils'] })).toThrow(/ornaments is a list of/);
    expect(() => readTheme('neon')).toThrow(/one of: greybox/);
    expect(() => readTheme({ type: { body: 'Nowhere Sans' } })).toThrow(/a stack .* or a family in theme.faces/);
  });
  it('fonts you own are bytes in the page, never a URL; a family they bring names the type', () => {
    expect(() => readTheme({ faces: [{ family: 'Mine', src: 'https://example.com/a.ttf' }] })).toThrow(/data: URL/);
    const T = readTheme({ faces: [{ family: 'Mine', src: FONT }], type: { display: 'Mine' } });
    expect(T.type.display).toBe('Mine');
    const css = themeCss({ faces: [{ family: 'Mine', src: FONT }], type: { display: 'Mine' } });
    expect(css).toContain(`@font-face{font-family:'Mine'`);
    expect(css).toContain(`--mana-display:'Mine',`);
  });
  it('new core colours re-derive the rest: a dark theme keeps none of the greybox\'s light greys', () => {
    const T = readTheme({ tokens: { ink: '#ffffff', panel: '#000000', line: '#888888', accent: '#ff0000' } });
    expect(T.tokens.wash).not.toBe(THEMES.greybox.tokens.wash);
    expect(contrast(T.tokens.mid, T.tokens.panel)).toBeGreaterThan(3);
  });
});

describe('mana-ui themes: writing and measuring', () => {
  it('the greybox theme is the sheet\'s own defaults; a preset sets the variables and adds only its own rules', () => {
    const grey = themeCss('greybox');
    for (const k of ['ink', 'mid', 'soft', 'line', 'wash', 'accent']) expect(grey).toContain(`--mana-${k}:${GREYBOX_VARS[k]}`);
    const fancy = THEME_IDS.find((id) => THEMES[id].focus === 'fill');
    expect(themeCss(fancy)).toMatch(/\[data-st=focus\]\{background:/);
    expect(themeCss(fancy)).not.toMatch(/\.mana-screen\{/);   // the structure stays the sheet's
  });
  it('colours are measured and advised, never refused', () => {
    const faint = { tokens: { ink: '#777777', panel: '#808080', line: '#808080', accent: '#7a7a7a' } };
    const laws = themeAdvice(faint).map((a) => a.law);
    expect(laws).toEqual(expect.arrayContaining(['ink-reads', 'focus-shows', 'frame-shows']));
    expect(() => themeCss(faint)).not.toThrow();
    for (const id of THEME_IDS.slice(0, 1)) expect(themeAdvice(id)).toEqual([]);
  });
  it('the board lays every theme over the same frames, and its script compiles', () => {
    const page = manaUiBoard({ theme: THEME_IDS.at(-1) });
    for (const id of THEME_IDS) expect(page).toContain(`<option value="${id}"`);
    const script = page.slice(page.lastIndexOf('<script>') + 8, page.lastIndexOf('</script>'));
    expect(() => new Function(script)).not.toThrow();
  });
});
