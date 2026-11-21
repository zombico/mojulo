import { describe, it, expect } from 'vitest';
import { GUNS, GUN_IDS, GUN_ALIASES, ROUNDS, ROUND_OF, gunOf, gunSvg, roundSvg, gunCss } from './guns.js';
import { manaCss } from './css.js';

// THE GUN IN HAND AT A GLANCE (guns.js): a wireframe of its side and the rounds it feeds, each a mask cut from the ink.
// One gun, one alias and one round stand for the shelf: the concept is the same for every row.
describe('mana-ui: guns', () => {
  it('a name draws its wireframe, a word for it the same one, another name none', () => {
    const [id] = GUN_IDS, alias = Object.keys(GUN_ALIASES).find((a) => GUN_ALIASES[a] === 'pistol');
    expect(gunOf(id)).toBe(id);
    expect(gunOf(alias)).toBe('pistol');
    expect(gunOf('Assault Rifle')).toBe('rifle');
    expect(gunOf('bow')).toBe(null);
    expect(() => gunSvg('bow')).toThrow(/a gun is one of/);
  });
  it('a wireframe is outlines over a faint fill of themselves and thinner inner lines, inside its grid, uncoloured', () => {
    const svg = gunSvg('rifle');
    expect(svg).toContain("viewBox='0 0 64 20'");
    expect(svg).toMatch(/fill-opacity='\.16'.*stroke-width='\.55'/);
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}/i);
    for (const s of GUNS.rifle) {
      const nums = s[0] === 'r' ? [s[1], s[2], s[1] + s[3], s[2] + s[4]] : s[1].split(/[ ,]/).map(Number);
      for (let k = 0; k < nums.length; k += 2) { expect(nums[k]).toBeGreaterThanOrEqual(0); expect(nums[k]).toBeLessThanOrEqual(64); expect(nums[k + 1]).toBeGreaterThanOrEqual(0); expect(nums[k + 1]).toBeLessThanOrEqual(20); }
    }
  });
  it('a round is filled, and spent its empty outline; a gun feeds its own, the rifle\'s otherwise', () => {
    const r = Object.keys(ROUNDS)[0];
    expect(roundSvg(r)).toContain("fill-rule='evenodd'");
    expect(roundSvg(r, true)).toContain("fill='none' stroke='black'");
    expect(ROUND_OF.shotgun).toBe('shell');
    const css = gunCss('.r');
    expect(css).toMatch(/\.r \.mana-belt\{--mana-round:url/);
    expect(css).toContain('.r .mana-magazine:is([data-gun=shotgun],[data-gun=breacher],[data-gun=combat-shotgun]) .mana-belt{--mana-round:');
    expect(css).toContain('.r .mana-magazine .mana-belt[data-round=pistol]{');
  });
  it('is in the sheet, the same every time', () => {
    expect(manaCss('.r')).toContain(gunCss('.r').split('\n')[0]);
    expect(gunCss()).toBe(gunCss());
  });
});
