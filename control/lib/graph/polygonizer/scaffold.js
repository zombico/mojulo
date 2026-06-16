/**
 * Solved-scaffold builder for the polygonizer two-turn (plan-then-skin)
 * protocol. Takes the planning-only manifest emitted by turn 1, runs the
 * marks-independent validators + consensus 5a authorship-preview gate, and
 * returns a "solved scaffold" — the resolved constellation grid, drafting
 * table, mandala patterns, and pinned anchors — that turn 2 sees as
 * known-good context when emitting marks.
 *
 * Returns `{ ok: false, errors }` when planning failed (turn-1 repair signal),
 * or `{ ok: true, scaffold, authorshipPreview }` when planning resolved.
 *
 * Marks-dependent validators (`validateBlockingReality`,
 * `validateElementCorrespondence`, `validateConstructionReferences`) are
 * deliberately NOT run here — they belong to turn 2.
 */

import { validateConstellationGrid, withConstellationGrid } from './constellation.js';
import { runAuthorshipPreview } from '../rendrant/authorship-preview.js';

function validateVehicleMandalaPlan(vehiclePlan) {
  const out = [];
  if (!vehiclePlan || typeof vehiclePlan !== 'object' || Array.isArray(vehiclePlan)) {
    return out;
  }
  if (!Array.isArray(vehiclePlan.surfaces) || vehiclePlan.surfaces.length === 0) {
    out.push('vehicleMandalaPlan.surfaces must be a non-empty array');
  }
  if (!Array.isArray(vehiclePlan.allocations) || vehiclePlan.allocations.length === 0) {
    out.push('vehicleMandalaPlan.allocations must be a non-empty array');
  }

  const diagnostics = vehiclePlan.diagnostics;
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) {
    out.push('vehicleMandalaPlan.diagnostics is required');
    return out;
  }
  if (Number(diagnostics.collisionCount || 0) > 0) {
    out.push('vehicleMandalaPlan must have zero collisions before skin turn');
  }
  if (Number(diagnostics.unplacedCount || 0) > 0) {
    out.push('vehicleMandalaPlan must place all requested concepts before skin turn');
  }
  if (diagnostics.readable === false) {
    out.push('vehicleMandalaPlan must be readable before skin turn');
  }
  return out;
}

export function buildSolvedScaffold(planningManifest) {
  if (!planningManifest || typeof planningManifest !== 'object' || Array.isArray(planningManifest)) {
    return { ok: false, errors: ['manifest must be a JSON object'], authorshipPreview: null };
  }

  const errors = [];
  if (!planningManifest.polygonizer || typeof planningManifest.polygonizer !== 'object' || Array.isArray(planningManifest.polygonizer)) {
    errors.push('manifest.polygonizer is required for planning turn');
  }
  if (!planningManifest.viewBox || !Number.isFinite(Number(planningManifest.viewBox?.width)) || !Number.isFinite(Number(planningManifest.viewBox?.height))) {
    errors.push('manifest.viewBox must declare finite width and height in planning turn');
  }

  const manifestWithConstellation = withConstellationGrid(planningManifest);

  const perspective = manifestWithConstellation.scene?.perspective;
  if (perspective?.mode === 'one-point' && !manifestWithConstellation.polygonizer?.draftingTable) {
    errors.push('one-point perspective requires polygonizer.draftingTable in planning turn');
  }

  errors.push(...validateConstellationGrid(manifestWithConstellation));
  errors.push(...validateVehicleMandalaPlan(manifestWithConstellation.polygonizer?.vehicleMandalaPlan));

  const authorshipPreview = runAuthorshipPreview(manifestWithConstellation);
  if (authorshipPreview.verdict === 'blocked') {
    for (const check of authorshipPreview.checks) {
      if (check.ok === false && check.gating === true) {
        errors.push(`authorship preview [${check.role}]: ${check.reason}`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, authorshipPreview };
  }

  const scaffold = {
    viewBox: manifestWithConstellation.viewBox || null,
    scene: manifestWithConstellation.scene || null,
    depiction: manifestWithConstellation.depiction || null,
    constellation: manifestWithConstellation.polygonizer?.constellation || null,
    draftingTable: manifestWithConstellation.polygonizer?.draftingTable || null,
    mandalaPatternLayer: manifestWithConstellation.polygonizer?.mandalaPatternLayer || null,
    hallMandala: manifestWithConstellation.polygonizer?.hallMandala || null,
    meru: manifestWithConstellation.polygonizer?.meru || null,
    shotGlyphs: Array.isArray(manifestWithConstellation.polygonizer?.shotGlyphs)
      ? manifestWithConstellation.polygonizer.shotGlyphs
      : (manifestWithConstellation.polygonizer?.shotGlyph ? [manifestWithConstellation.polygonizer.shotGlyph] : []),
    pinnedElements: Array.isArray(manifestWithConstellation.polygonizer?.twoPointCamera?.projectedPins)
      ? manifestWithConstellation.polygonizer.twoPointCamera.projectedPins
      : [],
    elements: Array.isArray(manifestWithConstellation.polygonizer?.elements)
      ? manifestWithConstellation.polygonizer.elements
      : [],
    spatialPlanning: manifestWithConstellation.polygonizer?.spatialPlanning
      || manifestWithConstellation.polygonizer?.rendrantPipeline
      || null,
    vehicleMandalaPlan: manifestWithConstellation.polygonizer?.vehicleMandalaPlan || null,
  };

  return { ok: true, scaffold, authorshipPreview };
}
