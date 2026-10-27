// The biocube (biocube.js): a level's flora as data, read and checked, laid over a kit card's own trees and grass.
import { describe, expect, it } from 'vitest';
import { readBiocube, withFlora, BIOCUBE_IDS } from './biocube.js';
import { assembleStageScene } from './stage.js';
import { assembleGeocubeScene, readGeocube } from './geocube.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

const M = { kind: 'stage', kit: 'isekai-meadow' };
// (each world built once in this file and shared: the tests only read them)
const built = new Map(), once = (m, make) => { const k = JSON.stringify(m); if (!built.has(k)) built.set(k, make(m)); return built.get(k); };
const stage = (m) => once(m, (x) => assembleStageScene(x)), street = (m) => once(m, (x) => assembleGeocubeScene(x, {}, assembleStageScene));
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
  const plain = stage(M);

  it('the meadow preset is the meadow card\'s own flora: its land as it was, its grass a carpet by default', () => {
    const card = withFlora(ISEKAI_MEADOW, readBiocube('meadow'));
    expect(card.trees).toEqual(ISEKAI_MEADOW.trees);
    expect(card.grass).toEqual(ISEKAI_MEADOW.grass);
    expect(card.live).toEqual(ISEKAI_MEADOW.live);
    const P = stage({ ...M, biocube: 'meadow' });
    expect(JSON.stringify(P.faces)).toBe(JSON.stringify(plain.faces));
    expect(plain.liveGrass).toBeUndefined();
    expect(P.liveGrass.density).toBe(ISEKAI_MEADOW.live.density);
    expect(stage({ ...M, biocube: { from: 'meadow', flora: { grass: { live: null } } } }).liveGrass).toBeUndefined();
  });

  it('grows the cube\'s trees, grass and bushes: a grove denser, bare ground nothing', () => {
    const grove = stage({ ...M, biocube: 'grove' }), bare = stage({ ...M, biocube: 'bare' });
    expect(count(grove, 'isekai:wood')).toBeGreaterThan(count(plain, 'isekai:wood'));
    expect(grove.anchors.some((a) => a.kind === 'shrub')).toBe(true);
    expect(count(bare, 'isekai:wood')).toBe(0);   // (a trunk: the far layers' silhouettes are crowns alone)
    expect(count(bare, 'isekai:grass')).toBe(0);
  });

  it('brings the grass back to a polygon land, as the cube grows it: the tufts, the hats and the lips\' fringes', () => {
    const bare = stage({ ...M, shading: true }), grown = stage({ ...M, shading: true, biocube: 'meadow' });
    for (const g of ['isekai:grass', 'isekai:hat', 'isekai:lip']) { expect(count(bare, g)).toBe(0); expect(count(grown, g), g).toBeGreaterThan(0); }
    expect(grown.liveGrass).toBeDefined();
  });

  it('a cube carries its own: checked when the cube is read, grown on its streets unless the recipe names another', () => {
    expect(readGeocube('valley-morning').biocube).toBe('meadow');
    expect(() => readGeocube({ from: 'valley-morning', biocube: 'jungle' })).toThrow(/biocube/);
    const own = street({ kind: 'geocube', cube: 'valley-morning', show: 'town', walk: false });
    expect(count(own, 'isekai:grass')).toBeGreaterThan(0);
    expect(own.liveGrass).toBeDefined();
  });

  it('a geocube\'s street grows it; any other show is told where it goes', () => {
    const T = assembleGeocubeScene({ kind: 'geocube', cube: 'valley-morning', show: 'town', walk: false, biocube: 'bare' }, {}, assembleStageScene);
    expect(count(T, 'isekai:wood')).toBe(0);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'valley-morning', show: 'room', biocube: 'meadow' }, {}, assembleStageScene)).toThrow(/biocube/);
  });
});

describe('nothing grows on a path', () => {
  // (a path's top faces: the trail itself, not its blend strips; a street's road, kerbs, walks and door paths)
  const inside = (P, x, y) => { let s = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  const pathsOf = (P) => P.faces.filter((f) => /:trail$|^street:(road|walk|kerb)$/.test(f.group || '') && !/:(rim|creep)-/.test(f.texture || '') && f.normal[2] > 0.7).map((f) => f.corners.map((c) => [c[0], c[1]]));
  const onPath = (paths, x, y) => paths.some((q) => inside(q, x, y));
  const mid = (f) => [0, 1].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);
  // the tufts' roots, and every corner of every cell the live grass grows in
  const grownOn = (P) => {
    const paths = pathsOf(P), tufts = P.faces.filter((f) => f.group === 'isekai:grass' && onPath(paths, ...mid(f))).length;
    const g = P.liveGrass.grid, M = Buffer.from(g.m.__b64, 'base64'), CX = g.nx - 1;
    let cells = 0;
    for (let j = 0; j < g.ny - 1; j++) for (let i = 0; i < CX; i++) if (M[j * CX + i] & 1 && [[0, 0], [1, 0], [1, 1], [0, 1]].some(([a, b]) => onPath(paths, g.x0 + (i + a) * g.cell, g.y0 + (j + b) * g.cell))) cells++;
    return { tufts, cells };
  };

  it('a trail: its fringe beside it where it slants as where it runs straight, the carpet a whole cell clear of it', () => {
    expect(grownOn(stage({ ...M, biocube: 'meadow' }))).toEqual({ tufts: 0, cells: 0 });
  });

  it('a town\'s street: no tuft or cell on its paving or its door paths, no land left under its paving', () => {
    const T = street({ kind: 'geocube', cube: 'valley-morning', show: 'town', walk: false });
    expect(grownOn(T)).toEqual({ tufts: 0, cells: 0 });
    const paved = T.faces.filter((f) => /^street:(road|walk)$/.test(f.group) && f.normal[2] > 0.7).map((f) => f.corners.map((c) => [c[0], c[1]]));
    expect(T.faces.filter((f) => /:ground$/.test(f.group || '') && f.corners.every((c) => onPath(paved, c[0], c[1]))).length).toBe(0);
  }, 60000);

  it('moss on the rock is asked for, never a preset\'s: a share 0–1, null for none, refused past it', () => {
    expect(readBiocube('meadow').flora.moss).toBeUndefined();
    expect(readBiocube({ from: 'meadow', flora: { moss: 0.6 } }).flora.moss).toBe(0.6);
    expect(readBiocube({ from: 'meadow', flora: { moss: null } }).flora.moss).toBeUndefined();
    expect(() => readBiocube({ from: 'meadow', flora: { moss: 2 } })).toThrow(/flora\.moss/);
  });

  it('the sward is a mood\'s word: tall, short or a share of short areas; the card\'s grass is as it was', () => {
    expect(readBiocube('meadow').flora.grass.sward).toBeUndefined();
    expect(readBiocube({ from: 'meadow', flora: { grass: { sward: 'short' } } }).flora.grass.sward).toBe('short');
    expect(readBiocube({ from: 'meadow', flora: { grass: { sward: { short: 0.4 } } } }).flora.grass.sward).toEqual({ short: 0.4 });
    expect(() => readBiocube({ from: 'meadow', flora: { grass: { sward: 'mown' } } })).toThrow(/flora\.grass\.sward/);
    expect(() => readBiocube({ from: 'meadow', flora: { grass: { sward: { short: 2 } } } })).toThrow(/flora\.grass\.sward/);
    const short = readBiocube({ from: 'meadow', flora: { grass: { sward: 'short' } } });
    expect(withFlora(ISEKAI_MEADOW, short).grass).toEqual(withFlora(ISEKAI_MEADOW, readBiocube('meadow')).grass);
  });
});
