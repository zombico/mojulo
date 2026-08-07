import { describe, it, expect } from 'vitest';

import { MAP_THEMES, getMapTheme, DEFAULT_THEME, MAP_PALETTE } from './palette.js';
import { PRESENTATION_THEME_NAMES } from '../../visual-language/themes.js';

const REQUIRED_KEYS = [
  'outerFill', 'outerStroke', 'outerStrokeWidth',
  'holeFill', 'holeStroke', 'holeStrokeWidth',
  'label', 'legendBg', 'legendStroke', 'legendLabel', 'title', 'subtitle', 'footer',
];

describe('map palette themes', () => {
  it('every theme is fully specified', () => {
    for (const [name, t] of Object.entries(MAP_THEMES)) {
      for (const k of REQUIRED_KEYS) {
        expect(t[k], `${name}.${k}`).toBeDefined();
      }
    }
  });

  it('token names align with the presentation vocabulary (a subset, no drift)', () => {
    // A shared token (paper, blueprint, …) must name the same look across
    // domains; the only way to guarantee that is to keep map names inside the
    // presentation set. New map themes must reuse a presentation name.
    for (const name of Object.keys(MAP_THEMES)) {
      expect(PRESENTATION_THEME_NAMES, `map theme '${name}'`).toContain(name);
    }
  });

  it('getMapTheme resolves, defaults to dark, and rejects unknown tokens', () => {
    expect(getMapTheme()).toBe(MAP_THEMES[DEFAULT_THEME]);
    expect(getMapTheme('paper')).toBe(MAP_THEMES.paper);
    expect(MAP_PALETTE).toBe(MAP_THEMES.dark);
    expect(() => getMapTheme('neon')).toThrow(/unknown theme/);
  });

  it('light is cool and paper is warm (the alignment fix)', () => {
    // Regression guard: `light` used to be the warm cream now called `paper`.
    expect(MAP_THEMES.light.outerFill).not.toBe(MAP_THEMES.paper.outerFill);
    expect(MAP_THEMES.paper.outerFill).toBe('#f3efe6'); // the cream preserved under its right name
  });
});
