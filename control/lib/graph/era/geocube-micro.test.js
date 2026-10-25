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

// (each world built once in this file and shared: the tests only read them)
const built = new Map(), once = (k, make) => (built.has(k) ? built.get(k) : built.set(k, make()).get(k));
const cube = (m) => once(JSON.stringify(m), () => assembleGeocubeScene(m, {}, assembleStageScene));
const town = (m) => cube({ kind: 'geocube', cube: 'gothic-night', show: 'town', ...m });

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
    // (the same seed laying the same street is stage-buildings.test.js's)
    // seen first for its architecture: from the road before the first house, at a person's eye over the paving, then
    // down the street from its walk
    expect(P.cameras.slice(0, 2).map((c) => c.name)).toEqual(['house', 'street']);
    const [cx, cy, cz] = P.cameras[0].worldFraming.cameraPosition, under = P.faces.filter((f) => f.group === 'street:road' && f.corners.some((c) => Math.hypot(c[0] - cx, c[1] - cy) < 1.2));
    expect(under.length).toBeGreaterThan(0);
    expect(cz - Math.max(...under.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(1.7, 0);
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
  const gothicCity = () => once('gothic-city', () => assembleCityScene(geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', seed: 3 }).city, { route: true }));
  it('lays the smallest city in the cube\'s builders\' language, painted by the cube', () => {
    const { city, anchor } = geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', seed: 3 });
    expect(city).toMatchObject({ kind: 'city', seed: 3, board: MICRO_CITY.board, paint: { geocube: 'gothic-night', amount: 1 }, cars: false, people: 0 });
    expect(anchor).toBe('tiered');
    expect(geocubeCity({ kind: 'geocube', cube: 'limestone-crags', show: 'city', domain: 'harbour-town' }).pick.name).toBe('harbour-town');
    expect(() => geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', weather: 'rain' })).toThrow(/takes its sky as clouds/);
    expect(() => geocubeCity({ kind: 'geocube', cube: { from: 'limestone-crags' }, show: 'city', domain: 'temple-hall' })).toThrow(/the domain is inside/);
  });

  it('is lit at the cube\'s hour under its clouds, as its land is: past dusk the moon, the stars and the windows; without, as it was', () => {
    const at = (more) => assembleCityScene(geocubeCity({ kind: 'geocube', cube: 'valley-morning', show: 'city', seed: 3, ...more }).city, { route: true });
    const plain = geocubeCity({ kind: 'geocube', cube: 'valley-morning', show: 'city', seed: 3 }).city;
    expect(plain.paint).toEqual({ geocube: 'valley-morning', amount: 1 });
    const day = at({}), noon = at({ hour: 'noon' }), night = at({ hour: 'night', clouds: 'fair' });
    // (at its reference's own hour the city is lit as it was; a night is darker, its windows lit, its sky starred)
    expect(noon.light).toEqual(day.light);
    expect(night.sky.stars).toBeGreaterThan(0); expect(night.sky.moon).toBeDefined(); expect(night.sky.clouds.src).toMatch(/^data:image\/png/);
    expect(night.faces.length).toBeGreaterThan(day.faces.length);
    expect(day.sky.clouds).toBeUndefined();
  });

  it('is seen first from its sidewalk, a person\'s eye looking down the block', async () => {
    const { withSidewalkCamera } = await import('./geocube-city.js');
    const P = withSidewalkCamera(gothicCity(), { metersPerUnit: CITY_METERS_PER_UNIT });
    expect(P.cameras[0].name).toBe('sidewalk');
    expect(P.cameras[0].worldFraming.cameraPosition[2] * CITY_METERS_PER_UNIT).toBeCloseTo(1.7, 2);
  });

  it('walks the sidewalk round one block, closed, at a person\'s height; a city without a route is as it was', () => {
    const { city } = geocubeCity({ kind: 'geocube', cube: 'gothic-night', show: 'city', seed: 3 });
    const P = gothicCity();
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

describe('the cube paints its architecture', () => {
  const walls = (cube) => {
    const P = town({ cube, seed: 3 });
    return [...new Set(P.faces.filter((f) => f.group === 'town:roof').map((f) => f.fill))].sort();
  };
  it('a street\'s houses take the cube\'s colours: two cubes on one base kit paint their roofs apart', () => {
    expect(walls('gothic-night')).not.toEqual(walls('island-noon'));
  });
  it('a street with no paint, or one re-pointed at ramps its kit lacks, is the kit\'s own as before', () => {
    const plain = { kind: 'stage', seed: 3, kit: 'isekai-meadow', trail: { run: 12 }, town: { houses: 2, enter: 0, recipe: MICRO_TOWN.town } };
    const a = assembleStageScene(plain), b = assembleStageScene({ ...plain, town: { ...plain.town, paint: { 'str:tile': 'cube-roof' } } });
    expect(JSON.stringify(b.faces)).toBe(JSON.stringify(a.faces));
  });
});
