/**
 * create_view kind 'rocket' — mint a Falcon-9-class LAUNCH + RETURN depictor: a full booster
 * mission (liftoff → gravity turn → Max-Q → MECO → separation → boostback/entry/landing
 * burns → touchdown) integrated by physics/rocket.js and walked by pose movers in the
 * traversable three.js World, with a live mission HUD in real SI units.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny
 * RECIPE (a scenario + a few physical params); the substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'rocket-view'`, no geometry) and re-integrates the mission on
 * render — same recipe, same flight. Honest read-back via measure_view.
 *
 * Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planRocketScene, ROCKET_SCENARIOS } from '@/lib/graph/views/science/rocket-view';

export function mintRocketView({ title, scenario, payload, vehicle, guidance, playback, trace, strobe, strobeEvery, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'rocket-view',
    scenario: ROCKET_SCENARIOS.includes(scenario) ? scenario : 'rtls',
    ...(Number.isFinite(+payload) && +payload >= 0 ? { payload: +payload } : {}),
    ...(vehicle === 'falcon9' || (vehicle && typeof vehicle === 'object') ? { vehicle } : {}),
    ...(guidance && typeof guidance === 'object' ? { guidance } : {}),
    ...(Number.isFinite(+playback) ? { playback: +playback } : {}),
    ...(trace === false ? { trace: false } : {}),
    ...(strobe === false ? { strobe: false } : {}),
    ...(Number.isFinite(+strobeEvery) ? { strobeEvery: +strobeEvery } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe integrates + return the mission digest (no geometry
  // is persisted — only the recipe above is stored; the flight is regenerated on render).
  const plan = planRocketScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — rocket mission`,
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
    stats: {
      scenario: plan.stats.scenario, payload: plan.stats.payload, flightTime: plan.stats.T,
      mecoV: plan.stats.mecoV, apogeeKm: plan.stats.apogeeKm,
      touchdownV: plan.stats.touchdownV, touchdownX: plan.stats.touchdownX,
      faces: plan.faces.length,
    },
  };
}

export async function createRocketViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_view kind rocket requires a recipe object');
  }
  const { title, scenario, payload, vehicle, guidance, playback, trace, strobe, strobeEvery, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintRocketView({ title, scenario, payload, vehicle, guidance, playback, trace, strobe, strobeEvery, scale, viewBox, scene, ref, folderRef });
}
