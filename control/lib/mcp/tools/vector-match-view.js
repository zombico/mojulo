/**
 * create_vector_match_view — mint VECTOR MATCHING (semantic nearest-neighbour search) as a traversable
 * three.js World: words as arrows on the unit sphere, a query, and its top-k nearest by cosine.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * query word + optional candidate list + topK); the substrate stores ONLY the recipe
 * (`kind: 'vector-match-view'`, no geometry) and regenerates the scene on render. Orbit-only object
 * study — returns a `worldUrl`. See vector-match-view.js.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planVectorMatchScene, VECTOR_MATCH_VOCAB } from '@/lib/graph/views/math/vector-match-view';

export function mintVectorMatchView({ title, query, candidates, topK, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'vector-match-view',
    ...(typeof query === 'string' && query.trim() ? { query: query.trim() } : {}),
    ...(Array.isArray(candidates) && candidates.length ? { candidates } : (typeof candidates === 'string' && candidates.trim() ? { candidates } : {})),
    ...(Number.isFinite(+topK) ? { topK: Math.round(+topK) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planVectorMatchScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `vector match: ${manifest.query || 'king'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: plan.stats,
  };
}

export async function createVectorMatchViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_vector_match_view requires a recipe object');
  }
  const { title, query, candidates, top_k: topK, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintVectorMatchView({ title, query, candidates, topK, scale, viewBox, scene, ref, folderRef });
}
