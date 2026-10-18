/**
 * The land's crystals (`crystals`): read and refused as words, carried through a geocube's outside, and placed on one
 * small island as real gems: out of the cliff faces (no print: no floor under them) or in the hollows, clear of the
 * walks, the seam and the sea, the same stones on every read.
 */
import { describe, expect, it } from 'vitest';

import { readCrystals, crystalSites } from './crystals.js';
import { readLocalMeru } from './plan.js';
import { assembleStageScene } from '../era/stage.js';
import { readGeocube, lowerGeocube } from '../era/geocube.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const ISLE = { geology: true, walk: 'base' };
const build = (meru) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: ISLE, shading: { valley: 0.7 }, ...meru } }, {});
const gems = (p) => p.faces.filter((f) => f.crystal);
const stones = (p) => new Set(gems(p).map((f) => f.crystal.stone));

describe('crystals: the words', () => {
  it('reads a gem\'s name or its words, and refuses bad ones', () => {
    expect(readCrystals('amethyst')).toEqual({ gem: 'amethyst', where: 'crags', count: 8, size: 2.4, glow: 0, seed: 0 });
    expect(readCrystals({ gem: 'quartz', where: 'hollows', count: 3 })).toMatchObject({ where: 'hollows', count: 3 });
    expect(readCrystals(undefined)).toBeNull();
    expect(() => readCrystals('jade')).toThrow(/crystals.gem is one of/);
    expect(() => readCrystals({ gem: 'ruby', where: 'sky' })).toThrow(/crystals.where is 'crags'/);
    expect(() => readCrystals({ gem: 'ruby', count: 40 })).toThrow(/crystals.count/);
    expect(() => readCrystals({ gem: 'ruby', hue: 1 })).toThrow(/crystals.hue is not a setting/);
    expect(readLocalMeru({}).crystals).toBeUndefined();
  });

  it('rides a geocube\'s outside to the meru, and the cube refuses bad ones as its own', () => {
    const low = lowerGeocube(readGeocube({ from: 'valley-morning', outside: { crystals: { gem: 'sapphire', glow: 0.5 } } }), 'outside');
    expect(low.meru.crystals).toEqual({ gem: 'sapphire', glow: 0.5 });
    expect(lowerGeocube(readGeocube('valley-morning'), 'outside').meru).not.toHaveProperty('crystals');
    expect(() => readGeocube({ from: 'valley-morning', outside: { crystals: 'jade' } })).toThrow(/geocube: outside.crystals.gem is one of/);
  });
});

describe('crystals: on the land', () => {
  const crags = build({ crystals: { gem: 'amethyst', count: 4 } });

  it('grows clusters out of the cliff faces, over the sea and clear of the walks, throwing no print', () => {
    const G = gems(crags);
    expect(stones(crags).size).toBeGreaterThan(8);
    expect(G.every((f) => f.crystal.gem === 'amethyst' && f.crystal.print === false && f.group === 'meru:crystals')).toBe(true);
    expect(crags.localMeru.crystals).toMatchObject({ gem: 'amethyst', where: 'crags' });
    // each cluster grows from a cliff face: its stones' bases lie near one
    const cliffs = crags.faces.filter((f) => f.group === 'isekai:cliff').map((f) => f.corners[0]);
    const bases = [...new Map(G.map((f) => [f.crystal.stone, f.crystal.base])).values()];
    expect(bases.every((b) => cliffs.some((c) => Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]) < 3))).toBe(true);
  });

  it('is the same stones on every read, another draw with another seed', () => {
    const again = build({ crystals: { gem: 'amethyst', count: 4 } });
    expect(JSON.stringify(gems(again))).toBe(JSON.stringify(gems(crags)));
    const other = build({ crystals: { gem: 'amethyst', count: 4, seed: 3 } });
    expect(JSON.stringify(gems(other))).not.toBe(JSON.stringify(gems(crags)));
  });

  it('sits in the hollows as a floor\'s druse, throwing its print', () => {
    const H = gems(build({ crystals: { gem: 'quartz', where: 'hollows', count: 3 } }));
    expect(H.length).toBeGreaterThan(0);
    expect(H.some((f) => f.crystal.print === false)).toBe(false);
  });

  it('keeps clusters apart and off what it is told to avoid', () => {
    const faces = [0, 3, 6, 30].map((x) => ({ cel: 'cliff', corners: [[x, 0, 5], [x + 1, 0, 5], [x + 1, 0, 6], [x, 0, 6]], outNormal: [0, -1, 0] }));
    const C = readCrystals({ gem: 'ruby', size: 1, count: 8 });
    const sites = crystalSites(C, faces, { avoid: [[30.5, 0]] });
    expect(sites.length).toBeLessThan(3);
    expect(sites.every((s) => s.q[0] < 20)).toBe(true);
    expect(crystalSites(C, faces, { keep: () => false })).toEqual([]);
  });
});
