/**
 * A geocube's micro worlds: `show: 'town'` (a few houses of a street on a short trail, the dummy walking it and up to
 * each door) and `show: 'city'` (a city plan on the smallest board, painted by the cube, the dummy round one block at a
 * person's height), so a cube's architecture is reviewed at eye height.
 */
import { describe, expect, it } from 'vitest';

import { assembleGeocubeScene, MICRO_TOWN } from './geocube.js';
import { geocubeCity, MICRO_CITY } from './geocube-city.js';
import { assembleStageScene } from './stage.js';
import { assembleCityScene } from '../city/plan/scene.js';
import { dummyWalker } from '../local-meru/dummy.js';
import { CITY_METERS_PER_UNIT } from '../city/fractal-city.js';

const town = (m) => assembleGeocubeScene({ kind: 'geocube', cube: 'gothic-night', show: 'town', ...m }, {}, assembleStageScene);

describe('the micro-town', () => {
  it('stands a hamlet\'s houses on a short trail; the walk runs the street and steps up to every door', () => {
    const P = town({ seed: 3 }), houses = P.anchors.filter((a) => a.kind === 'house');
    expect(houses.length).toBe(MICRO_TOWN.houses);
    expect(P.faces.some((f) => String(f.group).startsWith('town:'))).toBe(true);
    expect(P.geocube.town).toEqual({ settlement: 'micro', anchor: 'tiered', houses: MICRO_TOWN.houses });
    for (const h of houses) {
      const near = Math.min(...P.route.map((p) => Math.hypot(p[0] - h.at[0], p[1] - h.at[1])));
      expect(near).toBeLessThan(2);
      // the spur stops before the door, outside the house
      const f = [h.at[0] + h.N[0] * 1.5, h.at[1] + h.N[1] * 1.5], { min, max } = h.box;
      expect(f[0] > min[0] && f[0] < max[0] && f[1] > min[1] && f[1] < max[1]).toBe(false);
    }
    // the same seed lays the same street
    expect(JSON.stringify(town({ seed: 3 }).route)).toBe(JSON.stringify(P.route));
  });

  it('takes the domain\'s street and land; seed is the trail\'s and the town\'s alone', () => {
    const P = assembleGeocubeScene({ kind: 'geocube', cube: 'limestone-crags', domain: 'harbour-town', show: 'town', seed: 3 }, {}, assembleStageScene);
    expect(P.geocube.town.settlement).toBe('harbour');
    expect(P.geocube.domain).toMatchObject({ name: 'harbour-town', terrain: 'cove' });
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'gothic-night', show: 'land', seed: 3 }, {}, assembleStageScene)).toThrow(/seed is the trail's and the town's/);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'gothic-night', show: 'city' }, {}, assembleStageScene)).toThrow(/the kind's micro-city/);
  });
});

describe('the micro-city', () => {
  it('lays the smallest city in the cube\'s builders\' language, painted by the cube; it is lit by the cube, never an hour', () => {
    const { city, anchor } = geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', seed: 3 });
    expect(city).toMatchObject({ kind: 'city', seed: 3, board: MICRO_CITY.board, paint: { geocube: 'gothic-night' }, cars: false, people: 0 });
    expect(anchor).toBe('tiered');
    expect(geocubeCity({ kind: 'geocube', cube: 'limestone-crags', show: 'city', domain: 'harbour-town' }).pick.name).toBe('harbour-town');
    expect(() => geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', hour: 'dusk' })).toThrow(/a city is lit by its cube's look/);
    expect(() => geocubeCity({ kind: 'geocube', cube: { from: 'limestone-crags' }, show: 'city', domain: 'temple-hall' })).toThrow(/the domain is inside/);
  });

  it('walks the sidewalk round one block, closed, at a person\'s height; a city without a route is as it was', () => {
    const { city } = geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', seed: 3 });
    const P = assembleCityScene(city, { route: true });
    expect(P.route.length).toBe(5);
    expect(P.route[0]).toEqual(P.route[4]);
    expect(assembleCityScene(city).route).toBeUndefined();
    const w = dummyWalker(P.route, { scale: 1 / CITY_METERS_PER_UNIT });
    expect(w.path).toEqual(P.route);
    expect(w.scale).toBeCloseTo(1 / CITY_METERS_PER_UNIT, 9);
    // a trail's open route is walked out and back, unscaled, as before
    expect(dummyWalker([[0, 0, 0], [1, 0, 0]])).toEqual({ figure: 'dummy', path: [[0, 0, 0], [1, 0, 0], [0, 0, 0]], style: 'bumble', speed: 1.4, follow: true });
  });
});
