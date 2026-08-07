/**
 * create_wavepacket_view — mint a QUANTUM WAVEPACKET: a volumetric `|ψ(x,t)|²` probability cloud that
 * EVOLVES IN TIME, ray-marched (the sibling of the static atom-view orbital cloud, but the field moves).
 * Volume + time — impossible as a surface, and the clearest way to SEE quantum behaviour.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE (a
 * scenario + optional density); the substrate stores ONLY the recipe (`kind: 'wavepacket-view'`, no
 * geometry) and regenerates the shader on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planWavepacketScene, WAVEPACKET_SCENARIOS } from '@/lib/graph/views/science/wavepacket-view';

export function mintWavepacketView({ title, scenario, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'wavepacket-view',
    scenario: WAVEPACKET_SCENARIOS.includes(scenario) ? scenario : 'free',
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planWavepacketScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} wavepacket`,
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
    stats: { scenario: plan.stats.scenario, density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createWavepacketViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_wavepacket_view requires a recipe object');
  }
  const { title, scenario, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintWavepacketView({ title, scenario, density, viewBox, scene, ref, folderRef });
}
