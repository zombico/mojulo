// The biocube (biocube.js): a level's flora as data, read and checked, laid over a kit card's own trees and grass.
import { describe, expect, it } from 'vitest';
import { readBiocube, withFlora, BIOCUBE_IDS } from './biocube.js';
import { assembleStageScene } from './stage.js';
import { assembleGeocubeScene } from './geocube.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

const M = { kind: 'stage', kit: 'isekai-meadow' };
const count = (P, g) => P.faces.filter((f) => f.group === g).length;

describe('reading a biocube', () => {
  it('reads every preset, a preset with changes block by block, and a whole document', () => {
    for (const id of BIOCUBE_IDS) expect(readBiocube(id).id).toBe(id);
    const B = readBiocube({ from: 'meadow', flora: { trees: { clusters: 8 }, grass: null } });
    expect(B.flora.trees).toEqual({ ...readBiocube('meadow').flora.trees, clusters: 8 });
    expect(B.flora.grass).toBeNull();
    expect(readBiocube({ flora: { trees: { clusters: 2, perCluster: [1, 2], spread: 3, heights: [5, 8], clearTrail: 3, clearCliff: 4 } } }).flora.grass).toBeNull();
  });

  it('says what is wrong, in the card\'s own words', () => {
    expect(() => readBiocube('jungle')).toThrow(/not a biocube/);
    expect(() => readBiocube({ from: 'meadow', flora: { trees: { clusters: -1 } } })).toThrow(/trees\.clusters/);
    expect(() => readBiocube({ from: 'meadow', flora: { grass: { kinds: { meadow: 'moss' } } } })).toThrow(/grass\.kinds\.meadow/);
    expect(() => readBiocube({ from: 'meadow', flora: { shrubs: { count: 200 } } })).toThrow(/shrubs/);
    expect(() => readBiocube({ from: 'meadow', flora: { flowers: { share: 0.2, mix: { orchid: 1 } } } })).toThrow(/flowers\.mix/);
    expect(() => readBiocube({ from: 'meadow', fauna: {} })).toThrow(/fauna/);
  });
});

describe('the flora on a stage', () => {
  const plain = assembleStageScene(M);

  it('the meadow preset is the meadow card\'s own flora: its stage as it was', () => {
    const card = withFlora(ISEKAI_MEADOW, readBiocube('meadow'));
    expect(card.trees).toEqual(ISEKAI_MEADOW.trees);
    expect(card.grass).toEqual(ISEKAI_MEADOW.grass);
    expect(JSON.stringify(assembleStageScene({ ...M, biocube: 'meadow' }))).toBe(JSON.stringify(plain));
  });

  it('grows the cube\'s trees, grass and bushes: a grove denser, bare ground nothing', () => {
    const grove = assembleStageScene({ ...M, biocube: 'grove' }), bare = assembleStageScene({ ...M, biocube: 'bare' });
    expect(count(grove, 'isekai:wood')).toBeGreaterThan(count(plain, 'isekai:wood'));
    expect(grove.anchors.some((a) => a.kind === 'shrub')).toBe(true);
    expect(count(bare, 'isekai:wood')).toBe(0);   // (a trunk: the far layers' silhouettes are crowns alone)
    expect(count(bare, 'isekai:grass')).toBe(0);
  });

  it('brings the grass back to a polygon land, as the cube grows it', () => {
    expect(count(assembleStageScene({ ...M, shading: true }), 'isekai:grass')).toBe(0);
    expect(count(assembleStageScene({ ...M, shading: true, biocube: 'meadow' }), 'isekai:grass')).toBeGreaterThan(0);
  });

  it('a geocube\'s street grows it; any other show is told where it goes', () => {
    const T = assembleGeocubeScene({ kind: 'geocube', cube: 'valley-morning', show: 'town', walk: false, biocube: 'bare' }, {}, assembleStageScene);
    expect(count(T, 'isekai:wood')).toBe(0);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'valley-morning', show: 'room', biocube: 'meadow' }, {}, assembleStageScene)).toThrow(/biocube/);
  });
});
