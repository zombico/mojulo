/**
 * Relief on a local meru's plain (`relief`), and through a geocube's outside: opt-in, the seam left as the trail's,
 * the land given shape its light can read (crease and ridge), and grain carried in the vertex colour.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru } from './plan.js';
import { assembleStageScene } from '../era/stage.js';
import { readGeocube, lowerGeocube } from '../era/geocube.js';

// the geocube's own outside: two bases on a geology island, the polygon land (each build is seconds)
const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const build = (relief) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: { geology: true, walk: 'base' }, shading: true, ...(relief === undefined ? {} : { relief }) } }, {});
const plain = build(), rolling = build('rolling');
const ground = (p) => p.faces.filter((f) => f.group === 'isekai:ground');
const lum = (h) => [1, 3, 5].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0) / 765;

describe('local meru: relief', () => {
  it('reads a card or a document, and refuses a bad one', () => {
    expect(readLocalMeru({ relief: 'craggy' }).relief).toMatchObject({ id: 'craggy', flavour: 'ridged' });
    expect(readLocalMeru({}).relief).toBeUndefined();
    expect(readLocalMeru({ relief: false }).relief).toBeUndefined();
    expect(() => readLocalMeru({ relief: 'lumpy' })).toThrow(/relief: 'lumpy' is not a relief card/);
  });

  it('is absent unless asked: no relief, no stamp', () => {
    expect(plain.localMeru.relief).toBeUndefined();
    expect(rolling.localMeru.relief).toBe('rolling');
  });

  it('lifts an island\'s plain, never sinks it, and leaves the seam where the walker starts', () => {
    // an island whose ways up are drawn (walk 'all'): the relief stays on the plain. The plain stands at 0, the
    // spawn's foot; an island's hollow would drown the grass in beach, so every corner of it is raised or left
    const isle = (relief) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: true, ...(relief ? { relief } : {}) } }, {});
    const flat = isle(), lifted = isle('rolling');
    const at = new Map(ground(flat).flatMap((f) => f.corners.filter((c) => c[2] < 0.3).map((c) => [`${c[0]},${c[1]}`, c[2]])));
    const moved = ground(lifted).flatMap((f) => f.corners).filter((c) => at.has(`${c[0]},${c[1]}`)).map((c) => c[2] - at.get(`${c[0]},${c[1]}`));
    expect(moved.filter((d) => d > 0.05).length).toBeGreaterThan(200);
    expect(Math.min(...moved)).toBeGreaterThan(-1e-9);
    expect(lifted.walk.spawn).toEqual(flat.walk.spawn);
  });

  it('runs up the mountain only where the island draws it as land (walk base)', () => {
    // the geocube's island: no shelf cut into a flank, so the raised land takes the relief, hollows and all
    const high = (p) => p.faces.filter((f) => f.group === 'isekai:cliff' || f.group === 'isekai:ground').flatMap((f) => f.corners).filter((c) => c[2] > 2).map((c) => c[2].toFixed(3)).sort().join();
    expect(high(rolling)).not.toBe(high(plain));
  });

  it('gives the light more to read: more light across each quad of the plain', () => {
    // a plain with no island under it (the island's grass is a thin rim); the plain past the mounds' near side
    const level = (relief) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, shading: true, ...(relief ? { relief } : {}) } }, {});
    const across = (p) => { const g = ground(p).filter((f) => f.corners.every((c) => c[1] > 14)); return g.reduce((a, f) => { const l = f.cornerFills.map(lum); return a + Math.max(...l) - Math.min(...l); }, 0) / g.length; };
    const flat = across(level());
    expect(across(level('rolling'))).toBeGreaterThan(flat * 1.2);
    expect(across(level('craggy'))).toBeGreaterThan(flat * 2);
  });

  it('carries grain in the vertex colour, and none when grain is 0', () => {
    const still = build({ from: 'rolling', grain: 0 });
    // the same geometry: only the colour differs
    expect(ground(still).map((f) => f.corners)).toEqual(ground(rolling).map((f) => f.corners));
    const fills = (p) => ground(p).flatMap((f) => f.cornerFills);
    expect(fills(still)).not.toEqual(fills(rolling));
  });
});

describe('geocube: relief on the outside', () => {
  it('lowers outside.relief into the meru, and a terrain may change it', () => {
    const cube = readGeocube({ from: 'gothic-night', outside: { ...readGeocube('gothic-night').outside, relief: 'eroded', terrains: { dunes: { relief: 'dune' }, flat: { relief: false } } } });
    expect(lowerGeocube(cube, 'outside').meru.relief).toBe('eroded');
    expect(lowerGeocube(cube, 'outside', 'dunes').meru.relief).toBe('dune');
    expect(lowerGeocube(cube, 'outside', 'flat').meru).not.toHaveProperty('relief');
    expect(lowerGeocube(readGeocube('gothic-night'), 'outside').meru).not.toHaveProperty('relief');
  });
  it('refuses a bad relief as the cube\'s own words', () => {
    const base = readGeocube('gothic-night').outside;
    expect(() => readGeocube({ from: 'gothic-night', outside: { ...base, relief: 'lumpy' } })).toThrow(/geocube: outside.relief: 'lumpy' is not a relief card/);
    expect(() => readGeocube({ from: 'gothic-night', outside: { ...base, terrains: { hills: { relief: { from: 'rolling', gain: 2 } } } } })).toThrow(/outside.terrains.hills.relief: gain/);
  });
});
