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

/**
 * @param {{ manifest: object }} sketch — a stored sketch row (manifest required)
 * @returns {Promise<string>} a self-contained SVG string
 */
export async function renderStoredSketchSvg(sketch) {
  const manifest = sketch?.manifest;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('renderStoredSketchSvg requires a sketch manifest');
  }
  if (manifest.kind === 'manji-tree') return renderManjiTreeToSvg(manifest);
  if (manifest.kind === 'painted-landscape') return renderPaintedLandscapeToSvg(manifest);
  if (manifest.kind === 'carved-solid') return renderCarvedSolidToSvg(manifest);
  if (manifest.kind === 'figure') return renderFigureToSvg(manifest);
  return renderSketchToSvg(manifest, { technical: false });
}
