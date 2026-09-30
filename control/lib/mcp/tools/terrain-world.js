/**
 * The `terrain` world base — reached through compose_world({ base: 'terrain' }), no tool of
 * its own. A painted landscape (inline, or a stored one by `{ ref }`), or a `world` composed from features, becomes
 * ground at real scale: the World page
 * meshes it around the camera, so the same recipe is walked, flown and seen whole. The manual is the view-vocab card
 * `terrain` (family world).
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { validateTerrainWorld } from '@/lib/graph/terrain/terrain-world';
import { validatePaintedLandscape } from '@/lib/graph/polygonizer/painted-landscape.js';

const isRef = (f) => f && typeof f.ref === 'string' && Object.keys(f).length === 1;
// FRONTAGE and ROUNDKIT: an inline terrain city is road-aware and wears the round street kit (terrain-city.js
// prepareCity's defaults). Written into the city at mint so the row itself says so, as a fractal-city mint does
// (scene-city.js), and a later change to the render default cannot move it. The render merges these same defaults
// under the city's own words, so the stamp renders the same bytes. A `{ ref }` city is its own row; a list of element
// words stays as given.
const stampCity = (c) => (c && typeof c === 'object' && !Array.isArray(c) && c.ref === undefined
  && (c.elements === undefined || (c.elements && typeof c.elements === 'object' && !Array.isArray(c.elements)))
  ? { ...c, elements: { frontage: true, roundKit: true, ...(c.elements || {}) } } : c);

export function mintTerrainWorld({ title = 'terrain world', from, world, span, relief, horizon, detail, planet, seed, spawn, lod, place, cities, ref, folderRef } = {}) {
  if ((!from || typeof from !== 'object') && (!world || typeof world !== 'object')) {
    throw new Error("terrain: give `from` — the painted landscape the world is made from (an inline recipe { heartbeat, splatch, landform?, … } or { ref: '<painted-landscape sketch>' }) — or `world` — features to compose it from ({ features: [{ feature: 'river', size: 'great' }, …] }). Manual: get_view_vocab({ id: 'terrain' }).");
  }
  const manifest = {
    kind: 'terrain',
    ...(from !== undefined ? { from } : {}),
    ...(world !== undefined ? { world } : {}),
    ...(span !== undefined ? { span } : {}),
    ...(relief !== undefined ? { relief } : {}),
    ...(horizon !== undefined ? { horizon } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...(planet !== undefined && planet !== false ? { planet } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(spawn !== undefined ? { spawn } : {}),
    ...(lod !== undefined ? { lod } : {}),
    ...(place !== undefined ? { place } : {}),
    ...(cities !== undefined ? { cities: Array.isArray(cities) ? cities.map(stampCity) : cities } : {}),
    ...(title ? { title } : {}),
  };
  const errors = validateTerrainWorld(manifest);
  // an inline scene is checked by painted-landscape's own validator here; a ref is checked where it resolves
  if (from && !isRef(from)) errors.push(...validatePaintedLandscape({ kind: 'painted-landscape', ...from }).map((e) => `terrain.from: ${e}`));
  if (errors.length) throw new Error(`Invalid terrain manifest:\n - ${errors.join('\n - ')}`);
  const sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  const enc = encodeURIComponent(sketch.ref);
  return { ok: true, ref: sketch.ref, url: `/sketches/${enc}`, worldUrl: `/api/sketches/${enc}/world` };
}
