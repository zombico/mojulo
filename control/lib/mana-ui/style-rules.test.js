import { describe, it, expect } from 'vitest';
import { manaUi } from './kernel.js';
import { manaCss, GREYBOX_VARS } from './css.js';
import { themeCss, THEME_IDS } from './theme.js';

// ONE STYLE FOR A GAME: every component, the live game's as much as the menus', is drawn by the one sheet and dressed
// by the one theme. So a new component cannot ship without its rule, cannot bring a colour of its own, and cannot read a
// variable a theme does not set: the HUD can never drift into a second look.
const sheet = manaCss('.r');
// a component drawn as another's markup (a field draws as the input its kind names)
const DRAWN_AS = { field: 'toggle | cycler | slider | keybind' };
// variables whose value a theme leaves alone on purpose (the cinema bars are black in every look)
const FIXED = ['shade'];

describe('mana-ui: one style for a game', () => {
  it('every component has its rule in the sheet', () => {
    for (const id of manaUi.COMPONENT_IDS) {
      if (DRAWN_AS[id]) continue;
      expect(new RegExp(`\\.mana-${id}(?![\\w-])`).test(sheet), `.mana-${id} has no rule in css.js`).toBe(true);
    }
  });
  it('the sheet\'s rules carry no colour of their own: every colour is a variable', () => {
    const [vars, ...rules] = sheet.split('\n');
    expect(vars).toContain('--mana-ink:');
    for (const r of rules) expect(r, `a colour written into a rule: ${r.slice(0, 90)}`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
  it('every variable the sheet reads has its greybox value', () => {
    const read = new Set([...sheet.matchAll(/var\(--mana-([a-z0-9-]+)/g)].map((m) => m[1]));
    for (const k of read) expect(Object.keys(GREYBOX_VARS), `--mana-${k} has no greybox default`).toContain(k);
  });
  it('a theme sets every colour the sheet reads (but the fixed ones)', () => {
    const colour = Object.keys(GREYBOX_VARS).filter((k) => /^#|^rgba?\(/.test(GREYBOX_VARS[k]) && !FIXED.includes(k));
    const css = themeCss(THEME_IDS.find((id) => id !== 'greybox'));
    for (const k of colour) expect(css, `a theme leaves --mana-${k} at its greybox grey`).toContain(`--mana-${k}:`);
  });
});
