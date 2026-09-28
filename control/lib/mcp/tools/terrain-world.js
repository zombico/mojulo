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
    ...(cities !== undefined ? { cities } : {}),
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
