/**
 * create_view kind 'hydro' — mint one arc of the MULTI-ARC hydroelectric-power explainer in the
 * traversable three.js World: the dam (stored head, P = ρgh, the Torricelli outlet), the penstock
 * (PE → KE, Bernoulli), the Pelton turbine (momentum → torque → spin), the generator (Faraday's
 * ε = −dΦ/dt), or the whole plant chain in one world. All arcs quote the SAME numbers from one pure
 * energy chain (physics/hydro.js), so the story stays consistent across mints.
 *
 * Same philosophy as the other science views: the operator passes a tiny RECIPE (an arc + head +
 * flow); the substrate stores ONLY the recipe (`kind: 'hydro-view'`, no geometry) and regenerates
 * the world on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planHydroScene, HYDRO_SCENARIOS } from '@/lib/graph/views/science/hydro-view';

export function mintHydroView({ title, scenario, head, flow, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'hydro-view',
    scenario: HYDRO_SCENARIOS.includes(scenario) ? scenario : 'dam',
    ...(Number.isFinite(+head) ? { head: +head } : {}),
    ...(Number.isFinite(+flow) ? { flow: +flow } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planHydroScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `hydro — ${manifest.scenario}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  const s = plan.stats;
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: {
      scenario: s.scenario, head: s.head, flow: s.flow,
      jetV: +s.jetV.toFixed(1), rpm: Math.round(s.rpm), f: +s.f.toFixed(1), poles: s.poles,
      powerMW: { hydraulic: +s.powerMW.hydraulic.toFixed(1), mech: +s.powerMW.mech.toFixed(1), elec: +s.powerMW.elec.toFixed(1) },
      homes: s.homes,
    },
  };
}

export async function createHydroViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_view kind hydro requires a recipe object');
  }
  const { title, scenario, head, flow, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintHydroView({ title, scenario, head, flow, scale, viewBox, scene, ref, folderRef });
}
