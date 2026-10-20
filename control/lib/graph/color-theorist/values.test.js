import { describe, it, expect } from 'vitest';
import { lchOf } from './oklab.js';
import { readPaletteSpec, solvePalette, PALETTE_VALUES } from './solve.js';

// VALUE GROUPS: a spec's `values` puts the land in two or three bands of lightness (a painter's masses), checked by the
// `value-groups` law, which a spec without them never reads.
const L = (hex) => lchOf(hex.match(/\w\w/g).map((h) => parseInt(h, 16)))[0];
const mid = (ramp) => ramp[Math.floor(ramp.length / 2)];
const law = (K, id) => K.checks.find((c) => c.law === id);

describe('value groups', () => {
  it('a spec without them is checked as it always was: no value-groups law', () => {
    expect(law(solvePalette({ seed: 5 }), 'value-groups')).toBeUndefined();
  });

  it.each([2, 3])('%i groups: every grouped role in its band, the groups apart, in any key', (groups) => {
    for (const key of ['high', 'low']) {
      const K = solvePalette({ seed: 4, heat: 0.3, key, values: { groups } }), check = law(K, 'value-groups');
      expect(check.ok, `${key}: ${check.value}`).toBe(true);
      expect(K.read.values).toBe(groups);
      // ordered: every dark-group middle under every light-group middle
      const of = PALETTE_VALUES[groups].of, at = (g) => Object.keys(of).filter((r) => of[r] === g).map((r) => L(mid(K.roles[r])));
      expect(Math.max(...at('dark'))).toBeLessThan(Math.min(...at('light')));
    }
  });

  it('a role named into another group goes there', () => {
    const K = solvePalette({ seed: 4, values: { groups: 2, of: { rock: 'light' } } }), dark = solvePalette({ seed: 4, values: { groups: 2 } });
    expect(L(mid(K.roles.rock))).toBeGreaterThan(L(mid(dark.roles.rock)) + 0.2);
    expect(law(K, 'value-groups').ok).toBe(true);
  });

  it('a lock that drags a role out of its group is what the law reports', () => {
    const K = solvePalette({ seed: 4, values: { groups: 2 }, lock: { rock: '#e8e4dc' } }), check = law(K, 'value-groups');
    expect(check.ok).toBe(false);
    expect(check.value).toMatch(/rock/);
  });

  it('the spec is checked: a count, groups by name, roles a group takes', () => {
    expect(() => readPaletteSpec({ values: { groups: 4 } })).toThrow(/groups: 2 \| 3/);
    expect(() => readPaletteSpec({ values: { groups: 2, of: { rock: 'mid' } } })).toThrow(/dark, light/);
    expect(() => readPaletteSpec({ values: { groups: 3, of: { accent: 'dark' } } })).toThrow(/not a role a group takes/);
    expect(readPaletteSpec({ values: { groups: 3, of: { rock: 'mid' } } })).toEqual({ values: { groups: 3, of: { rock: 'mid' } } });
  });
});
