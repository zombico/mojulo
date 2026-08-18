/**
 * create_mechanics_view — mint a classical-Newtonian MECHANICS depictor: a solid object MOVING
 * along its real trajectory in the traversable three.js World, with live velocity/acceleration
 * vectors and a numeric readout.
 *
 * Same fractal-generation philosophy as create_atom_view / create_cellular_view: the operator passes
 * a tiny RECIPE (a scenario + a few physical params); the substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'mechanics-view'`, no geometry) and regenerates the simulation on render.
 * The body shape is OUTPUT through the workbench monomer machinery; the motion rides emitThreeWorld's
 * mover channel — the trajectory is sampled at equal TIME steps, so the body visibly accelerates.
 *
 * Orbit-only object study (like atom-view / cellular-view) — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planMechanicsScene, MECHANICS_SCENARIOS } from '@/lib/graph/views/science/mechanics-view';

export function mintMechanicsView({ title, scenario, v0, angle, g, mu, length, height, mass, k, amplitude, radius, m1, m2, u1, u2, e, compare, g2, mass2, efficiency, armEffort, armLoad, leverClass, rWheel, rAxle, ropes, pulleyType, thickness, pitch, crankRadius, rodLength, flywheelR, rpm, curl, spin, stage, goalDist, diameter, density, scale, vectors, trace, strobe, strobeEvery, energy, forces, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'mechanics-view',
    scenario: MECHANICS_SCENARIOS.includes(scenario) ? scenario : 'projectile',
    ...(Number.isFinite(+v0) ? { v0: +v0 } : {}),
    ...(Number.isFinite(+angle) ? { angle: +angle } : {}),
    ...(Number.isFinite(+g) ? { g: +g } : {}),
    ...(Number.isFinite(+mu) ? { mu: +mu } : {}),
    ...(Number.isFinite(+length) ? { length: +length } : {}),
    ...(Number.isFinite(+height) ? { height: +height } : {}),
    ...(Number.isFinite(+mass) ? { mass: +mass } : {}),
    ...(Number.isFinite(+k) ? { k: +k } : {}),
    ...(Number.isFinite(+amplitude) ? { amplitude: +amplitude } : {}),
    ...(Number.isFinite(+radius) ? { radius: +radius } : {}),
    ...(Number.isFinite(+m1) ? { m1: +m1 } : {}),
    ...(Number.isFinite(+m2) ? { m2: +m2 } : {}),
    ...(Number.isFinite(+u1) ? { u1: +u1 } : {}),
    ...(Number.isFinite(+u2) ? { u2: +u2 } : {}),
    ...(Number.isFinite(+e) ? { e: +e } : {}),
    ...(compare === 'gravity' || compare === 'mass' || compare === 'air' ? { compare } : {}),
    ...(Number.isFinite(+g2) ? { g2: +g2 } : {}),
    ...(Number.isFinite(+mass2) ? { mass2: +mass2 } : {}),
    ...(Number.isFinite(+efficiency) ? { efficiency: +efficiency } : {}),   // simple-machine params
    ...(Number.isFinite(+armEffort) ? { armEffort: +armEffort } : {}),
    ...(Number.isFinite(+armLoad) ? { armLoad: +armLoad } : {}),
    ...([1, 2, 3].includes(+leverClass) ? { leverClass: +leverClass } : {}),
    ...(Number.isFinite(+rWheel) ? { rWheel: +rWheel } : {}),
    ...(Number.isFinite(+rAxle) ? { rAxle: +rAxle } : {}),
    ...(Number.isFinite(+ropes) ? { ropes: +ropes } : {}),
    ...(['fixed', 'movable', 'compound'].includes(pulleyType) ? { pulleyType } : {}),
    ...(Number.isFinite(+thickness) ? { thickness: +thickness } : {}),
    ...(Number.isFinite(+pitch) ? { pitch: +pitch } : {}),
    ...(Number.isFinite(+crankRadius) ? { crankRadius: +crankRadius } : {}),   // engine params
    ...(Number.isFinite(+rodLength) ? { rodLength: +rodLength } : {}),
    ...(Number.isFinite(+flywheelR) ? { flywheelR: +flywheelR } : {}),
    ...(Number.isFinite(+rpm) ? { rpm: +rpm } : {}),
    ...(Number.isFinite(+curl) ? { curl: +curl } : {}),                     // flight params
    ...(Number.isFinite(+spin) ? { spin: +spin } : {}),
    ...(stage === 'goal' || stage === 'range' ? { stage } : {}),
    ...(Number.isFinite(+goalDist) ? { goalDist: +goalDist } : {}),
    ...(Number.isFinite(+diameter) ? { diameter: +diameter } : {}),
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(vectors === false ? { vectors: false } : {}),
    ...(trace === false ? { trace: false } : {}),
    ...(strobe === false ? { strobe: false } : {}),
    ...(Number.isFinite(+strobeEvery) ? { strobeEvery: +strobeEvery } : {}),
    ...(energy === false ? { energy: false } : {}),
    ...(forces === true ? { forces: true } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a kinematics readout (no geometry is
  // persisted — only the recipe above is stored).
  const plan = planMechanicsScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — mechanics`,
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
    stats: { scenario: plan.stats.scenario, g: plan.stats.g, flightTime: +plan.stats.T.toFixed(3), loop: plan.stats.loop, faces: plan.faces.length },
  };
}

export async function createMechanicsViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_mechanics_view requires a recipe object');
  }
  const { title, scenario, v0, angle, g, mu, length, height, mass, k, amplitude, radius, m1, m2, u1, u2, e, compare, g2, mass2, efficiency, armEffort, armLoad, leverClass, rWheel, rAxle, ropes, pulleyType, thickness, pitch, crankRadius, rodLength, flywheelR, rpm, curl, spin, stage, goalDist, diameter, density, scale, vectors, trace, strobe, strobeEvery, energy, forces, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintMechanicsView({ title, scenario, v0, angle, g, mu, length, height, mass, k, amplitude, radius, m1, m2, u1, u2, e, compare, g2, mass2, efficiency, armEffort, armLoad, leverClass, rWheel, rAxle, ropes, pulleyType, thickness, pitch, crankRadius, rodLength, flywheelR, rpm, curl, spin, stage, goalDist, diameter, density, scale, vectors, trace, strobe, strobeEvery, energy, forces, viewBox, scene, ref, folderRef });
}
