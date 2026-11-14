import { describe, it, expect } from 'vitest';
import { readTheme, themeCss, themeAdvice, contrast, THEMES, THEME_IDS, THEME_WORDS, MOTIONS } from './theme.js';
import { GREYBOX_VARS, manaCss } from './css.js';
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

describe('mana-ui themes: sides', () => {
  it('the sides are a theme\'s kits, cycled to eight; left out, the accents then the colour-blind-safe set', () => {
    expect(() => readTheme({ sides: ['red'] })).toThrow(/1 to 8 hex colours/);
    const T = readTheme({ sides: ['#d7263d', '#1f6fe0'] });
    expect(T.sides).toHaveLength(8);
    expect(T.sides[2]).toBe('#d7263d');
    expect(themeCss({ sides: ['#d7263d', '#1f6fe0'] })).toContain('--mana-side-1:#1f6fe0');
    const D = readTheme({ tokens: { ink: '#ffffff', panel: '#000000', line: '#888888', accent: '#ff0000' } });
    expect(D.sides.slice(0, 2)).toEqual([D.tokens.accent, D.tokens.accent2]);
  });
});

describe('mana-ui themes: writing and measuring', () => {
  it('the greybox theme is the sheet\'s own defaults; a preset sets the variables and adds only its own rules', () => {
    const grey = themeCss('greybox');
    for (const k of ['ink', 'mid', 'soft', 'line', 'wash', 'accent']) expect(grey).toContain(`--mana-${k}:${GREYBOX_VARS[k]}`);
    const fancy = { from: THEME_IDS.find((id) => id !== 'greybox'), focus: 'fill' };
    expect(themeCss(fancy)).toMatch(/ \[data-st=focus\]\{outline:none;background:/);
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

describe('mana-ui themes: motion and keylines', () => {
  it('every motion word sets every distance the sheet moves by; the greybox travels nowhere', () => {
    const vars = Object.keys(MOTIONS.none);
    for (const w of Object.keys(MOTIONS)) expect(Object.keys(MOTIONS[w])).toEqual(vars);
    for (const k of vars) expect(GREYBOX_VARS[k]).toBe(MOTIONS.none[k]);
    const moving = THEME_IDS.find((id) => THEMES[id].motion !== 'none');
    expect(themeCss(moving)).toContain(`--mana-travel:${MOTIONS[THEMES[moving].motion].travel}`);
  });
  it('less motion, asked by the system or by the game, zeroes the travel and keeps the fades, over any theme', () => {
    const sheet = manaCss('.r');
    expect(sheet).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.r\{--mana-travel:0px!important/);
    expect(sheet).toMatch(/\.r\[data-motion=reduced\]\{--mana-travel:0px!important/);
    expect(sheet).toMatch(/@keyframes mana-fade\{from\{opacity:0\}\}/);
    expect(sheet).toContain('.r[data-clock=held] .mana-hud');
  });
  it('a side whose kit sinks into the panel is keylined in the ink; one that stands apart is not', () => {
    const T = readTheme({ tokens: { ink: '#ffffff', panel: '#101010', line: '#888888', accent: '#ffcc00' }, sides: ['#000000', '#ff8800'] });
    const css = themeCss(T);
    expect(contrast('#000000', '#101010')).toBeLessThan(3);
    expect(css).toContain('--mana-side-0-key:#ffffff');
    expect(css).toContain('--mana-side-1-key:transparent');
  });
});

describe('the stage: more than one kind of excitement, and a show of them', () => {
  it('the exciting stages beside the burst are shapes of their own, in the theme\'s colours', () => {
    const css = (stage) => themeCss({ from: 'idol', stage }), of = (stage) => css(stage).match(/--mana-stage:([^;}]*(?:\([^)]*\)[^;}]*)*)/)[1];
    const shapes = ['chevrons', 'dots', 'confetti', 'tunnel', 'streaks', 'zigzag'].map(of);
    expect(new Set([...shapes, of('burst')]).size).toBe(7);
    for (const x of shapes) expect(x).toMatch(/gradient\(/);
    expect(THEME_WORDS.stage).toEqual(expect.arrayContaining(['burst', 'chevrons', 'dots', 'confetti', 'tunnel', 'streaks', 'zigzag']));
    // (a theme that names none of them is as it was)
    expect(themeCss('idol')).toBe(themeCss({ from: 'idol' }));
    expect(themeCss('idol')).not.toMatch(/\.mana-screen\[data-place=left\]\{--mana-stage/);
  });

  it('a list is a show: each kind of screen its own shape, round again when the list is short; the malformed teach', () => {
    const T = readTheme({ from: 'idol', stage: ['chevrons', 'dots', 'none'] });
    expect(T.stage).toEqual(['chevrons', 'dots', 'none']);
    const css = themeCss({ from: 'idol', stage: ['chevrons', 'dots', 'none'] });
    const rule = (sel) => css.split(`.mana-screen${sel}{--mana-stage:`)[1].split('}')[0];
    expect(rule('[data-place=left]')).toMatch(/-58deg/);                 // the title: chevrons
    expect(rule('[data-place=center]')).toMatch(/radial-gradient\(circle/);   // a menu: dots
    expect(rule('[data-place=full]')).toBe('none');                       // a loading screen: bare
    expect(rule(':has(.mana-banner)')).toMatch(/-58deg/);                 // a result: round again
    expect(() => readTheme({ stage: ['chevrons', 'sparkles'] })).toThrow(/or a list of them \(a show/);
    expect(() => readTheme({ stage: [] })).toThrow(/or a list of them/);
    expect(() => readTheme({ stage: 'sparkles' })).toThrow(/theme\.stage is one of: none, band, burst.*or a list of them/);
  });
});

