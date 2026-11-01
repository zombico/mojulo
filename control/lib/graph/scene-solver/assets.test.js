/**
 * The scene solver's assets (scene-solver/assets.js): every asset its registry holds has a card, a card speaks only its
 * family's words, what the code knows is read from the code, and an asset no gen-7 scene reaches is a named gap.
 */
import { describe, expect, it } from 'vitest';

import { ASSET_FAMILIES, ASSET_CARDS, assetCard, reachOf, gaps, checkCard } from './assets.js';
import { FLORA_SPECIES, FLORA_DEFAULT, AUTUMN } from '../form/flora-read.js';
import { SPECIES } from '../vegetation/species.js';
import { WEEDS } from '../vegetation/wildflowers.js';

describe('scene solver assets', () => {
  it('every asset a registry holds has its card, and no card names an asset that is not there', () => {
    for (const [f, F] of Object.entries(ASSET_FAMILIES)) expect(Object.keys(ASSET_CARDS[f]).sort(), f).toEqual([...new Set(F.source())].sort());
  });

  it('a card speaks its family\'s words: a climate, a canopy, a stand outside them is refused', () => {
    const ok = { climates: ['temperate'], canopy: 'dense', stands: 'grove', words: ['oak'] };
    expect(checkCard('species', ok)).toBe(ok);
    expect(() => checkCard('species', { ...ok, climates: ['martian'] })).toThrow(/climate/);
    expect(() => checkCard('species', { ...ok, canopy: 'thick' })).toThrow(/canopy/);
    expect(() => checkCard('species', { ...ok, words: [] })).toThrow(/words/);
    expect(() => checkCard('planet', ok)).toThrow(/family/);
  });

  it('reads what the code knows: a tree\'s heights, its evergreen leaf, its fall colour, how a scene reaches it', () => {
    // (one species the form render grows for a leaf form, and one it grows by default)
    const byForm = Object.values(FLORA_SPECIES)[0], A = assetCard('species', byForm);
    expect(A.heights).toEqual(SPECIES[byForm].heights);
    expect(A.reach.via).toBe('flora.trees.kinds');
    expect(A.reach.form).toBe(Object.keys(FLORA_SPECIES).find((f) => FLORA_SPECIES[f] === byForm));
    const byDefault = FLORA_DEFAULT.find((s) => !Object.values(FLORA_SPECIES).includes(s));
    expect(assetCard('species', byDefault).reach).toEqual({ via: 'default' });
    const conifer = Object.keys(SPECIES).find((s) => SPECIES[s].kind === 'conifer');
    expect(assetCard('species', conifer).evergreen).toBe(true);
    const turns = Object.keys(AUTUMN.colours)[0];
    expect(assetCard('species', turns).autumn).toBe(true);
    expect(assetCard('flower', WEEDS[1]).weed).toBe(true);
  });

  it('names the gaps: an asset a registry holds that no gen-7 scene reaches yet', () => {
    const palm = Object.keys(SPECIES).find((s) => SPECIES[s].kind === 'palm');
    expect(reachOf('species', palm)).toBeNull();
    expect(gaps()).toContainEqual({ family: 'species', id: palm });
    expect(gaps().some((g) => g.family === 'grass')).toBe(false);
  });
});
