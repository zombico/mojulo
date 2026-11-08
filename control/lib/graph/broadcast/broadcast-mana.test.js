import { describe, it, expect } from 'vitest';
import { manaThemeOfBroadcast } from './broadcast-mana.js';
import { broadcastData, BROADCAST_PACKAGES, BROADCAST_PACKAGE_IDS } from './broadcast-package.js';
import { readTheme, themeAdvice } from '../../mana-ui/theme.js';

// One production: the menus around a sport wear its coverage's look and its kits. One package per procedure, chosen in
// code: a slanted slab, a material (the table's), a flat one with no metal.
const pick = (pred) => BROADCAST_PACKAGE_IDS.find((id) => pred(BROADCAST_PACKAGES[id]));

describe('the broadcast as a mana-ui theme', () => {
  it('the card\'s words reach the theme: a slant cuts, fills, leans and wipes, a material is textured and keeps its case, no rim no frame', () => {
    const slab = readTheme(manaThemeOfBroadcast(broadcastData(pick((P) => P.slant > 0))));
    expect([slab.corner, slab.focus, slab.transition]).toEqual(['cut', 'fill', 'wipe']);
    expect(slab.slant).not.toBe('none');                                 // the plate's lean leans the menus too
    expect(readTheme(manaThemeOfBroadcast(broadcastData(pick((P) => !P.slant)))).slant).toBe('none');
    const wood = readTheme(manaThemeOfBroadcast(broadcastData(pick((P) => P.grain))));
    expect([wood.plate, wood.case, wood.type.body]).toEqual(['textured', 'none', 'serif']);
    expect(readTheme(manaThemeOfBroadcast(broadcastData(pick((P) => !P.rim)))).frame).toBe('none');
  });
  it('the sides are the coverage\'s kits, already kept apart; its ink reads on its glass', () => {
    const id = BROADCAST_PACKAGE_IDS[0], data = broadcastData({ package: id, sides: ['#d7263d', '#d7263e'] }, { count: 2 });
    const T = readTheme(manaThemeOfBroadcast(data));
    expect(T.sides.slice(0, 2)).toEqual(data.colors.map((c) => c.base));
    expect(T.sides[0]).not.toBe(T.sides[1]);   // the clash the package separated stays separated
    expect(themeAdvice(manaThemeOfBroadcast(data)).map((a) => a.law)).not.toContain('ink-reads');
    expect(() => manaThemeOfBroadcast({})).toThrow(/broadcast's data/);
  });
});
