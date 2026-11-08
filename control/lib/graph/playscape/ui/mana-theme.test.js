import { describe, it, expect } from 'vitest';
import { manaThemeOfGuide, shelfFaces } from './mana-theme.js';
import { rollGuide } from './direction.js';
import { BORDER_FLAVORS } from './borders.js';
import { readTheme, themeCss } from '../../../mana-ui/theme.js';
import { FONT_SHELF } from '../../image-outcomes/fonts/font-shelf.js';

// The bridge: a world's UI guide reaches mana-ui as a theme, every value from the guide (one flavor per procedure:
// one whose elements become ornaments, one whose elements become words; a guide with no flavor at all).
const guide = (ask) => rollGuide({}, ask, 7);
const flavorWith = (pred) => Object.keys(BORDER_FLAVORS).find((f) => pred(BORDER_FLAVORS[f].elements));

describe('the guide as a mana-ui theme', () => {
  it('a flavor\'s tint and elements reach the theme: ornaments as ornaments, the rest as the words they mean', () => {
    const orn = flavorWith((e) => e.includes('brackets')), g = guide({ border: orn }), T = readTheme(manaThemeOfGuide(g));
    expect(T.tokens.accent).toBe(g.tokens.accent);
    expect(T.tokens.panel).toBe(g.tokens.panel);
    expect(T.ornaments).toContain('brackets');
    expect(T.focus).toBe('bracket');
    const worded = flavorWith((e) => e.includes('gradient') || e.includes('double')), W = readTheme(manaThemeOfGuide(guide({ border: worded })));
    if (BORDER_FLAVORS[worded].elements.includes('gradient')) expect(W.plate).toBe('gradient');
    if (BORDER_FLAVORS[worded].elements.includes('double')) expect(W.frame).toBe('double');
  });
  it('without a flavor, the register\'s dials and the stop say the frame, plate, motion, corner and case', () => {
    const g = guide({ register: 'console' }), T = readTheme(manaThemeOfGuide(g));
    expect(T.case).toBe('upper');
    expect(T.corner).toBe('square');
    expect(T.ornaments).toEqual([]);
    expect(readTheme(manaThemeOfGuide(guide({ register: 'modern' }))).corner).toBe('round');
  });
  it('the register\'s sound dial says which of the UI\'s sounds a game hears', () => {
    const loud = guide({ register: 'console' }), calm = guide({ register: 'modern' });
    expect(readTheme(manaThemeOfGuide(loud)).cues).toBe(loud.dials.sound === 'cues' ? 'full' : 'silent');
    expect(readTheme(manaThemeOfGuide(calm)).cues).toBe(calm.dials.sound === 'cues' ? 'full' : 'silent');
    expect(new Set([loud.dials.sound, calm.dials.sound]).size).toBe(2);
  });
  it('a font shelf face becomes a face the theme owns, inlined: the page loads nothing', () => {
    const key = Object.keys(FONT_SHELF).find((k) => shelfFaces(k).length);
    const theme = manaThemeOfGuide(guide({}), { faces: { display: key } }), T = readTheme(theme);
    expect(T.type.display).toBe(FONT_SHELF[key].family);
    expect(themeCss(theme)).toContain(`@font-face{font-family:'${FONT_SHELF[key].family}'`);
    expect(themeCss(theme)).not.toMatch(/url\(https?:/);
    expect(() => shelfFaces('no-such-face')).toThrow(/font shelf/);
  });
});
