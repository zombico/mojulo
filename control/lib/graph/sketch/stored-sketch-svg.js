/**
 * Stored sketch → SVG string (the kind dispatch shared by the /svg download route
 * and the PNG rasterizer). Each non-diagram illustration kind has its own SVG
 * emitter; everything else is a CreationMap diagram. Keeping the branch in one
 * place means the baked PNG of an SVG/diagram sketch is rasterized from the exact
 * same SVG the /svg endpoint serves.
 */

import { renderSketchToSvg } from '@/lib/graph/sketch/sketch-svg';
import { renderManjiTreeToSvg } from '@/lib/graph/polygonizer/manji-svg';
import { renderPaintedLandscapeToSvg } from '@/lib/graph/polygonizer/painted-landscape';
import { renderCarvedSolidToSvg } from '@/lib/graph/effects/carved-solid';
import { renderFigureToSvg } from '@/lib/graph/polygonizer/figure-render';
import { renderScaffoldSvg } from '@/lib/graph/image-outcomes/scaffold';
import { isImageOutcomesKind } from '@/lib/graph/image-outcomes/manifest';
import { renderCoverSvg } from '@/lib/graph/image-outcomes/cover-preview';
import { renderFacesScaffoldSvg } from '@/lib/graph/polygonizer/faces-scaffold-svg';
import { lowerObjectFaces, WORKBENCH_LIGHT } from '@/lib/graph/worlds/workbench';
import { lowerAssemblerFaces } from '@/lib/graph/worlds/workbench-assembler';

/**
 * @param {{ manifest: object }} sketch — a stored sketch row (manifest required)
 * @param {object} [options]
 * @param {string} [options.panelId] — sequential-art only: crop the scaffold
 *   to one panel's viewBox (the per-panel render payload). Errors on any
 *   other kind so a stray `?panel=` can't silently serve the wrong image.
 * @param {boolean} [options.control] — image-outcomes only: the ControlNet
 *   scaffold variant (geometry only, no labels/dashed boxes). Errors on
 *   other kinds like panelId.
 * @returns {Promise<string>} a self-contained SVG string
 */
export async function renderStoredSketchSvg(sketch, { panelId, control } = {}) {
  const manifest = sketch?.manifest;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('renderStoredSketchSvg requires a sketch manifest');
  }
  // `control` also applies to manji-tree polygomers: the filled (vexar-lit)
  // variant used as a ControlNet scaffold for the skin worker — a wireframe
  // ring-stack fragments a diffusion skin; a filled silhouette reads as one
  // form (docs/local-image-worker.md, the polygomer skin seam).
  if (panelId && !isImageOutcomesKind(manifest.kind)) {
    throw new Error(`panel crops only apply to image-outcomes scaffolds (kind is '${manifest.kind}')`);
  }
  if (
    control && !isImageOutcomesKind(manifest.kind)
    && !['manji-tree', 'figure', 'workbench', 'assembler'].includes(manifest.kind)
  ) {
    throw new Error(`control scaffolds apply to image-outcomes scaffolds, manji-tree/workbench/assembler polygomers, or figures (kind is '${manifest.kind}')`);
  }
  if (manifest.kind === 'manji-tree') return renderManjiTreeToSvg(manifest, control ? { control: true } : {});
  // Workbench/assembler control scaffolds: the baked face list projected
  // through the SAME projectTwoPoint camera the world skin bake uses, so the
  // painted skin registers to both the 2D reskin and the 3D bake.
  if (control && (manifest.kind === 'workbench' || manifest.kind === 'assembler')) {
    const faces = manifest.kind === 'workbench'
      ? lowerObjectFaces(manifest, WORKBENCH_LIGHT)
      : lowerAssemblerFaces(manifest);
    return renderFacesScaffoldSvg(faces, {
      camera: manifest.camera || {}, roomBasis: manifest.roomBasis || {}, light: WORKBENCH_LIGHT,
    });
  }
  if (manifest.kind === 'painted-landscape') return renderPaintedLandscapeToSvg(manifest);
  if (manifest.kind === 'carved-solid') return renderCarvedSolidToSvg(manifest);
  // A cover's deterministic SVG face (illustration placeholder + title + subtext
  // + metadata); the raster composite with painted layers is /cover.png.
  if (manifest.kind === 'cover') return renderCoverSvg(manifest);
  // A figure's control scaffold carries per-face data-shade (the skin seam).
  if (manifest.kind === 'figure') return renderFigureToSvg(manifest, null, control ? { control: true } : {});
  // Image-outcomes kinds render their deterministic director scaffold —
  // the same SVG that conditions external image generation
  // (image-outcomes.plan.md).
  if (isImageOutcomesKind(manifest.kind)) {
    return renderScaffoldSvg(manifest, { ...(panelId ? { panelId } : {}), ...(control ? { control: true } : {}) });
  }
  return renderSketchToSvg(manifest, { technical: false });
}
