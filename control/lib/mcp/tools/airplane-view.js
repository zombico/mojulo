/**
 * create_view kind 'airplane' — mint a FIXED-WING FLIGHT depictor: a complete airline hop
 * (takeoff roll → climb → cruise → 3° approach → flare → touchdown) or an engines-out
 * glide, integrated by physics/airplane.js on the four real forces and flown by the airport
 * primitive's own plane body in the traversable three.js World, with a flight-deck HUD.
 *
 * Same fractal-generation philosophy as the other science views: a tiny RECIPE is stored
 * (`kind: 'airplane-view'`, no geometry) and the flight re-integrates on render — same
 * recipe, same flight. Honest read-back via measure_view.
 *
 * Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planAirplaneScene, AIRPLANE_MISSIONS, AIRPLANE_BODIES } from '@/lib/graph/views/science/airplane-view';

export function mintAirplaneView({ title, mission, plane, aircraft, guidance, playback, trace, strobe, strobeEvery, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'airplane-view',
    mission: AIRPLANE_MISSIONS.includes(mission) ? mission : 'hop',
    ...(AIRPLANE_BODIES.includes(plane) ? { plane } : {}),
    ...(aircraft === 'a320' || (aircraft && typeof aircraft === 'object') ? { aircraft } : {}),
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

  // Resolve once to validate the recipe flies + return the flight digest (no geometry stored).
  const plan = planAirplaneScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.mission} — airplane flight`,
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
      mission: plan.stats.mission, plane: plan.stats.plane, flightTime: plan.stats.T,
      groundRoll: plan.stats.groundRoll, touchdownSink: plan.stats.touchdownSink,
      rangeKm: plan.stats.rangeKm, glideRatio: plan.stats.glideRatio,
      faces: plan.faces.length,
    },
  };
}

export async function createAirplaneViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_view kind airplane requires a recipe object');
  }
  const { title, mission, plane, aircraft, guidance, playback, trace, strobe, strobeEvery, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintAirplaneView({ title, mission, plane, aircraft, guidance, playback, trace, strobe, strobeEvery, scale, viewBox, scene, ref, folderRef });
}
