/**
 * create_transformer_view — mint the TRANSFORMER's attention mechanic as a traversable three.js World.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * token sequence + an attention pattern + a focus token); the substrate stores ONLY the recipe
 * (`kind: 'transformer-view'`, no geometry) and regenerates the scene on render. Orbit-only object
 * study — returns a `worldUrl`. See transformer-view.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planTransformerScene, TRANSFORMER_SCENARIOS, TRANSFORMER_PATTERNS } from '@/lib/graph/views/math/transformer-view';

export function mintTransformerView({ title, scenario, sequence, pattern, focus, layers, focusLayer, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'transformer-view',
    scenario: TRANSFORMER_SCENARIOS.includes(scenario) ? scenario : 'attention',
    ...(typeof sequence === 'string' && sequence.trim() ? { sequence: sequence.trim() } : {}),
    ...(TRANSFORMER_PATTERNS.includes(pattern) ? { pattern } : {}),
    ...(Number.isFinite(+focus) ? { focus: Math.round(+focus) } : {}),
    ...(Number.isFinite(+layers) ? { layers: Math.round(+layers) } : {}),
    ...(Number.isFinite(+focusLayer) ? { focusLayer: Math.round(+focusLayer) } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planTransformerScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `attention: ${manifest.sequence || 'the cat sat on the mat'}`,
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

export async function createTransformerViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_transformer_view requires a recipe object');
  }
  const { title, scenario, sequence, pattern, focus, layers, focus_layer: focusLayer, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintTransformerView({ title, scenario, sequence, pattern, focus, layers, focusLayer, scale, viewBox, scene, ref, folderRef });
}
