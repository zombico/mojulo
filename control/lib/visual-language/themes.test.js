import { describe, it, expect } from 'vitest';

import {
  PRESENTATION_THEMES, PRESENTATION_THEME_NAMES, resolvePresentationTheme,
  presentationDocVars, presentationSketchTheme, DEFAULT_CHROME,
  FIGURE_SETUPS, FIGURE_SETUP_NAMES, resolveFigureSetup,
} from './themes.js';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const CHROME_KEYS = ['pageBg', 'ink', 'mutedInk', 'panelBg', 'panelBorder', 'accent', 'stageBg'];

describe('presentation themes', () => {
  it('every theme is complete and well-formed', () => {
    for (const name of PRESENTATION_THEME_NAMES) {
      const t = PRESENTATION_THEMES[name];
      expect(typeof t.label, name).toBe('string');
      expect(typeof t.description, name).toBe('string');
      expect(['dark', 'light'], name).toContain(t.surface);
      expect(t.vars && typeof t.vars === 'object', `${name}.vars`).toBe(true);
      expect(t.bg, `${name}.bg`).toMatch(HEX);
      for (const k of CHROME_KEYS) expect(t.chrome[k], `${name}.chrome.${k}`).toMatch(HEX);
      // any var override must point at a real color/keyword, never undefined
      for (const [k, v] of Object.entries(t.vars)) {
        expect(typeof v === 'string' && v.length > 0, `${name}.vars.${k}`).toBe(true);
      }
    }
  });

  it('doc vars cover both template kinds; sketch theme mirrors surface', () => {
    const t = PRESENTATION_THEMES.paper;
    expect(presentationDocVars(t, 'slide_deck')['--visual-bg']).toBe(t.bg);
    expect(presentationDocVars(t, 'essay')['--bg']).toBe(t.chrome.pageBg);
    expect(presentationSketchTheme(t)).toEqual({ surface: t.surface, vars: t.vars });
  });

  it('resolver: null passes through, unknown throws, DEFAULT_CHROME is dark', () => {
    expect(resolvePresentationTheme(null)).toBeNull();
    expect(resolvePresentationTheme('terminal')).toBe(PRESENTATION_THEMES.terminal);
    expect(() => resolvePresentationTheme('chartreuse')).toThrow(/unknown presentation theme/);
    expect(DEFAULT_CHROME).toBe(PRESENTATION_THEMES.dark.chrome);
  });
});

describe('figure setups', () => {
  it('every setup is complete and mode-consistent', () => {
    for (const name of FIGURE_SETUP_NAMES) {
      const s = FIGURE_SETUPS[name];
      expect(typeof s.label, name).toBe('string');
      expect(typeof s.description, name).toBe('string');
      expect(['filled', 'wire'], name).toContain(s.mode);
      expect(s.bg, `${name}.bg`).toMatch(HEX);
      if (s.mode === 'filled') {
        expect(s.fleshHex, `${name}.fleshHex`).toMatch(HEX);
        expect(s.light?.direction?.length, `${name}.light`).toBe(3);
      } else {
        expect(s.wireStroke, `${name}.wireStroke`).toMatch(HEX);
      }
    }
  });

  it('resolver: null passes through, unknown throws', () => {
    expect(resolveFigureSetup(null)).toBeNull();
    expect(resolveFigureSetup('blueprint-wire')).toBe(FIGURE_SETUPS['blueprint-wire']);
    expect(() => resolveFigureSetup('noir')).toThrow(/unknown figure setup/);
  });
});
