import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from './world-scene.js';

import { CITY_METERS_PER_UNIT } from '../city/fractal-city.js';

// `metersPerUnit` (unreal-demo D2, city human scale): the fractal city is authored at a town
// scale (STOREY_H 0.82 units) and DECLARES its unit (CITY_METERS_PER_UNIT); a recipe may override
// it; any other kind may declare one on the recipe. The exporters' root scale + the engine score
// follow; the web render never reads it.
const city = (extra = {}) => ({ ref: 'sk_mpu_city', manifest: { kind: 'fractal-city', seed: 5, depth: 1, region: { x: 0, y: 0, w: 20, d: 14 }, ...extra } });
const controllable = (extra = {}) => ({ ref: 'sk_mpu_ctrl', manifest: { kind: 'controllable', faces: [{ corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], fill: '#555555', doubleSided: true }], ...extra } });

describe('resolveWorldScene — metersPerUnit', () => {
  it('the city declares its own unit by default; a recipe override wins; an invalid override falls back', async () => {
    expect(CITY_METERS_PER_UNIT).toBe(3.66);
    expect((await resolveWorldScene(city())).payload.metersPerUnit).toBe(CITY_METERS_PER_UNIT);
    expect((await resolveWorldScene(city({ metersPerUnit: 4 }))).payload.metersPerUnit).toBe(4);
    expect((await resolveWorldScene(city({ metersPerUnit: 0 }))).payload.metersPerUnit).toBe(CITY_METERS_PER_UNIT);
    expect((await resolveWorldScene(city({ metersPerUnit: 'big' }))).payload.metersPerUnit).toBe(CITY_METERS_PER_UNIT);
  });
  it('a kind with no unit of its own takes a positive recipe declaration and is unset otherwise', async () => {
    expect((await resolveWorldScene(controllable({ metersPerUnit: 2 }))).payload.metersPerUnit).toBe(2);
    expect((await resolveWorldScene(controllable())).payload.metersPerUnit).toBeUndefined();
    expect((await resolveWorldScene(controllable({ metersPerUnit: 0 }))).payload.metersPerUnit).toBeUndefined();
  });
  it('does not change the faces', async () => {
    const a = (await resolveWorldScene(city())).payload.faces;
    const b = (await resolveWorldScene(city({ metersPerUnit: 4 }))).payload.faces;
    expect(b).toEqual(a);
  });
});
