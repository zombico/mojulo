/**
 * scad — the `scad` kind on the measured studio (the workbench's turntable, an OpenSCAD body).
 *
 * The recipe is OpenSCAD source (lib/graph/scad/scad-render.js meshes it in-process); this
 * module is only the seam that puts the resulting faces on the same studio every object kind
 * rides — measured floor, preset turntable shots, `facing`, `grid`, `movers`, the studio key,
 * toon bands — through `studioSceneFromFaces`, so /scene and /world and every export are the
 * workbench's own paths with a different mesher underneath.
 *
 * Stored manifest: { kind:'scad', source, parts?, units?, fn?, facing?, viewBox?, grid?, movers?, title? }
 */

import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { studioSceneFromFaces, WORKBENCH_LIGHT } from './workbench.js';
import { renderScadParts, shadeRecords, partBounds } from '../scad/scad-render.js';
import { solveMechanism, mechanismMovers } from '../scad/mechanism.js';
import { mergeCoplanarTriangles } from '../scad/coplanar-merge.js';
import { withBands, resolveToon } from '../polygonizer/vexar.js';

async function scadFaces(opts, light, { merge = false } = {}) {
  const r = await renderScadParts(opts);
  if (r.skipped) throw new Error(r.reason);
  return { parts: r.parts, faces: r.parts.flatMap((p) => shadeRecords(merge ? mergeCoplanarTriangles(p.records) : p.records, light)) };
}

// a `mechanism` plays through the mover channel: solved here from the recipe, never stored on it
function mechanismMoversFor(opts, parts) {
  if (!opts.mechanism || !opts.parts) return [];
  const names = Object.keys(opts.parts);
  const solved = solveMechanism(opts.mechanism, { bounds: partBounds(parts), units: opts.units || 'mm' });
  return mechanismMovers(solved, names);
}

/**
 * Assemble a `scad` manifest into the shared scene payload (faces + grounds + cameras + light).
 * `opts.light` is FLAT_LIGHT under the unshaded export; absent → the neutral studio key.
 * `opts.mergeCoplanar` folds flat triangle regions into single panels — the CSS-3D still's
 * courtesy (renderScadToHtml sets it); the World and every export keep OpenSCAD's triangles.
 */
export async function assembleScadScene(opts = {}) {
  const light = withBands(opts.light || WORKBENCH_LIGHT, resolveToon(opts.toon)?.bands);
  const { parts, faces } = await scadFaces(opts, light, { merge: opts.mergeCoplanar === true });
  const derived = mechanismMoversFor(opts, parts);
  const movers = derived.length ? [...(Array.isArray(opts.movers) ? opts.movers : []), ...derived] : opts.movers;
  return studioSceneFromFaces(faces, { ...opts, movers, title: opts.title || 'mojulo scad', light });
}

/** /scene + PNG path: CSS-3D preset-shot HTML (async — the mesher is). */
export async function renderScadToHtml(opts = {}) {
  return emitPreserve3dScene({ ...(await assembleScadScene({ ...opts, mergeCoplanar: true })), signs: opts.signs });
}
