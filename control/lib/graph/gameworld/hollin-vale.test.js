import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel } from './world.js';
import { HOLLIN_VALE } from './examples.js';
import { REFERENCES } from './advice.js';
import { townLanguage } from '../era/out-town.js';
import { ANCHOR_IDS } from '../era/out-anchor-structure.js';
import { fortOfLanguage, composeFort } from '../era/out-fortress.js';

// the reference party RPG (examples.js HOLLIN_VALE): the book decides its buildings, its art direction and its fights,
// and its hub is the walled town every way leads back to
describe('Hollin Vale, the reference party RPG', () => {
  it('is a reference design_game makes on request, and reads as a world', () => {
    expect(REFERENCES['hollin-vale']).toBe(HOLLIN_VALE);
    const G = readGameworld(HOLLIN_VALE);
    expect(G.hub).toBe('hollin');
    expect(G.topology).toBe('interconnected');
    expect(G.battles.looks.bandit.people).toBe('lupine');
    expect(G.characters.folk).toBeTruthy();
  });

  it('names no authored language: each civilization\'s builders are written as their elements, and its fort as its own', () => {
    for (const C of Object.values(HOLLIN_VALE.civilizations)) {
      expect(typeof C.anchor).toBe('object');
      expect(ANCHOR_IDS).not.toContain(C.anchor.id);
      expect(C.fort === undefined || typeof C.fort === 'object').toBe(true);
    }
    const W = HOLLIN_VALE.civilizations['barrow-wardens'];
    expect(() => composeFort(W.fort)).not.toThrow();
  });

  it('its hub is the walled street in its builders\' language, the shop walked into, the walls derived from the houses', () => {
    const L = resolveLevel(HOLLIN_VALE, 'hollin');
    expect(L.street).toMatchObject({ walls: true, inside: true, walk: ['shop'], street: true });
    expect(L.street.anchor.id).toBe('hollin-house');
    // (rendered walls under a hipped tile roof: a loopholed, plastered parapet and square towers under hipped roofs)
    const F = composeFort(fortOfLanguage(townLanguage({}, L.street.anchor), 1));
    expect(F.parapet.form).toBe('loophole');
    expect(F.tower).toMatchObject({ plan: 'square', crown: 'hip' });
    // the hill fort is the older people's, in theirs
    expect(resolveLevel(HOLLIN_VALE, 'harrow-top').town.castle.fort.read).toMatch(/unmortared/);
  });
});
