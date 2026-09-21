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
import { renderScadFaces } from '../scad/scad-render.js';
import { withBands, resolveToon } from '../polygonizer/vexar.js';

/**
 * Assemble a `scad` manifest into the shared scene payload (faces + grounds + cameras + light).
 * `opts.light` is FLAT_LIGHT under the unshaded export; absent → the neutral studio key.
 */
export async function assembleScadScene(opts = {}) {
  const light = withBands(opts.light || WORKBENCH_LIGHT, resolveToon(opts.toon)?.bands);
  const faces = await renderScadFaces(opts, light);
  return studioSceneFromFaces(faces, { ...opts, title: opts.title || 'mojulo scad', light });
}

/** /scene + PNG path: CSS-3D preset-shot HTML (async — the mesher is). */
export async function renderScadToHtml(opts = {}) {
  return emitPreserve3dScene({ ...(await assembleScadScene(opts)), signs: opts.signs });
}
