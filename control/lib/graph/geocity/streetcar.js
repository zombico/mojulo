/**
 * A STREETCAR standing at its stop (geocity/scene.js puts one on each track of a streetcar line where it crosses the
 * subway): the city metro's own streetcar (vehicles/vehicles-css3d.js `vehicleFaces({ type: 'streetcar' })`, the car
 * fractal-city's tram corridors run), at the metro's scale (city/fractal-city.js CITY_METERS_PER_UNIT), set on its track
 * and on the street's ground under each of its corners.
 *
 *   streetcarFaces({ axis, at, s0, dir, z }) → [{ corners, fill, doubleSided, group }]
 *     axis   'ns' | 'ew': the street it runs on; at its track's line across (world x for 'ns', y for 'ew')
 *     s0     where its front stands along the street (its stop), dir +1 | -1 the way it runs
 *     z      (x, y) → the street's ground
 *   STREETCAR  { length, height } (m)
 *
 * Metres, z up. Pure.
 */
import { vehicleFaces } from '../vehicles/vehicles-css3d.js';
import { CITY_METERS_PER_UNIT } from '../city/fractal-city.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// (the car laid along +x at the origin, once: its faces' corners in the metro's units)
let CAR = null;
const car = () => (CAR ??= vehicleFaces({ type: 'streetcar', cx: 0, cy: 0, heading: 0, scale: 1 }));
const span = (i) => { const v = car().flatMap((f) => f.corners.map((c) => c[i])); return [Math.min(...v), Math.max(...v)]; };
export const STREETCAR = Object.freeze({ get length() { const [a, b] = span(0); return r3((b - a) * CITY_METERS_PER_UNIT); }, get height() { return r3(span(2)[1] * CITY_METERS_PER_UNIT); } });

export function streetcarFaces({ axis, at, s0, dir, z }) {
  const U = CITY_METERS_PER_UNIT, [x0, x1] = span(0), half = ((x1 - x0) / 2) * U, mid = s0 - dir * half;
  // (its +x along the way it runs, its +y to its left)
  const place = ([u, v, h]) => {
    const along = mid + dir * u * U, across = at + (axis === 'ns' ? -1 : 1) * dir * v * U, [x, y] = axis === 'ns' ? [across, along] : [along, across];
    return [r3(x), r3(y), r3(z(x, y) + h * U)];
  };
  return car().map((f) => ({ ...f, corners: f.corners.map(place), group: 'geocity:streetcar' }));
}
