/**
 * Polygomer world — a `manji-tree` polygomer as a turnable 3D model in worlds.
 *
 * A manji-tree bonds lathe monomers via SLOTS (endpoint paths), so unlike a
 * workbench polygomer (absolute axes) its lathes must be resolved to world
 * coordinates first. Once resolved, they lower through the SAME
 * `lowerObjectFaces` → `studioSceneFromFaces` seam every baked-face world rides
 * (turntable cameras + `.glb` export via facesToGlb, unlit COLOR_0 faces).
 *
 * When a skin is bound (skin_polygomer stored the input painted skin), we bake
 * it onto the 3D faces: each face samples the skin at its projected screen
 * centroid (the shared camera IS the registration) for ALBEDO, times the
 * face's Lambert factor for FORM — the unlit .glb then carries the painted look
 * in its vertex colours. The recipe stays sovereign; the skin is a bound render.
 */

import { walkManjiTree3D } from '../polygonizer/manji-program.js';
import { applyLatheDetail } from '../polygonizer/lathe.js';
import { buildEndpointResolver } from '../polygonizer/line-between.js';
import {
  parseViewBox, rasterSampler, analyzeSkin, bakeSkinOntoFaces as bakeSkinOntoFacesCore,
} from '../polygonizer/skin-projection.js';
import { renderManjiTreeToSvg } from '../polygonizer/manji-svg.js';
import { lowerObjectFaces, studioSceneFromFaces, WORKBENCH_LIGHT } from './workbench.js';

/**
 * Resolve a manji-tree polygomer's slot-bonded lathes to absolute-coordinate
 * lathes. The model-level `detail` dial applies here, after resolution, so the
 * live World, the .glb export, and the skin bake all see the same face counts
 * as the SVG scaffold (manji-svg applies the same dial).
 */
export function resolveManjiTreeLathes(manifest) {
  const emitted = walkManjiTree3D(manifest.tree || {}, () => null, { fields: manifest.fields || null });
  const resolve = buildEndpointResolver(emitted);
  const lathes = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  const resolvePoint = (v, selfId) => (typeof v === 'string' ? resolve(v, selfId) : v);
  const out = lathes.map((spec) => ({
    ...spec,
    axisFrom: resolvePoint(spec.axisFrom),
    axisTo: resolvePoint(spec.axisTo),
  }));
  // in-tree leaf lathes (kind:'lathe' children) — carry their own resolved endpoints
  for (const node of emitted) {
    if (node?.leafMark?.kind === 'lathe') {
      const { spec, selfId } = node.leafMark;
      out.push({ ...spec, axisFrom: resolvePoint(spec.axisFrom, selfId), axisTo: resolvePoint(spec.axisTo, selfId) });
    }
  }
  return applyLatheDetail(out, manifest.detail);
}

/**
 * Bake a skin onto baked world faces — the generic core lives in
 * skin-projection.js (shared with the workbench/assembler skin seam); this
 * wrapper keeps the polygomer-world calling convention (WORKBENCH_LIGHT
 * default) for existing consumers.
 */
export function bakeSkinOntoFaces(faces, opts = {}) {
  return bakeSkinOntoFacesCore(faces, { light: WORKBENCH_LIGHT, ...opts });
}

/**
 * Assemble a manji-tree polygomer into a turnable world scene payload.
 * @param {object} manifest  a manji-tree manifest
 * @param {object} opts  { title, skin?: { data,width,height,channels } }
 */
export function assembleManjiTreeWorld(manifest, opts = {}) {
  // FLAT_LIGHT under unshaded export (opts.light); absent → WORKBENCH_LIGHT (byte-identical).
  const light = opts.light || WORKBENCH_LIGHT;
  const lathes = resolveManjiTreeLathes(manifest);
  let faces = lowerObjectFaces({ lathes }, light);
  if (opts.skin && faces.length) {
    const viewBox = parseViewBox(renderManjiTreeToSvg(manifest, { control: true }));
    const { background, fallback } = analyzeSkin(opts.skin);
    const sampler = rasterSampler({ ...opts.skin, background, fallback });
    faces = bakeSkinOntoFaces(faces, {
      sampler, viewBox, camera: manifest.camera || {}, roomBasis: manifest.roomBasis || {}, light,
    });
  }
  return studioSceneFromFaces(faces, { title: opts.title, units: manifest.units });
}
