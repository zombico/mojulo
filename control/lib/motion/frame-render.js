/**
 * Motion — the frame source. Deterministically re-renders a subject manifest
 * once per camera, through the engine's real pinhole renderer, and normalizes
 * each render into a reusable frame body + viewBox.
 *
 * This is the seam every 0609 spike opened by hand: call
 * `renderManjiTreeToSvg(manifest)` with the camera swapped per frame, strip the
 * outer <svg>/background/<text> so the geometry can be re-wrapped under a shared
 * frame, and record each frame's natural viewBox. The geometry math is the
 * engine's; this module only choreographs the per-frame calls and the framing.
 */

import { renderManjiTreeToSvg } from '../graph/polygonizer/manji-svg.js';

const BG_FILL = '#fafaf6';

/**
 * Strip a full engine SVG down to its body (the geometry), dropping the outer
 * <svg> tags, the background rect, and any <text> debug labels — so it can be
 * re-wrapped under a shared frame viewBox. Mirrors the stripper duplicated
 * across every motion spike.
 */
export function stripSvgBody(svg, { bgFill = BG_FILL } = {}) {
  const bgRe = new RegExp(`fill="${bgFill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
  return svg
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (/^<svg/.test(t) || /^<\/svg>/.test(t)) return false;
      if (bgRe.test(t)) return false;
      if (/^<text/.test(t)) return false;
      return true;
    })
    .join('\n');
}

function extractViewBox(svg) {
  const m = svg.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  return m[1].split(/\s+/).map(Number);
}

/**
 * Render N frames of a subject by swapping `camera` per frame. Returns the
 * stripped body + natural viewBox for each. `resolveProgramRef` is threaded
 * through for figure/program subjects (Phase 1 camera motions don't need it,
 * but the seam is the same).
 */
export function renderSubjectFrames({ manifest, cameras, resolveProgramRef, bgFill = BG_FILL }) {
  const options = resolveProgramRef ? { resolveProgramRef } : {};
  return cameras.map((camera) => {
    const svg = renderManjiTreeToSvg({ ...manifest, camera }, options);
    return { body: stripSvgBody(svg, { bgFill }), vb: extractViewBox(svg) };
  });
}

/**
 * Compute a union viewBox over per-frame viewBoxes (with padding). Used by
 * orbit/turntable so the centred subject stays locked while the camera circles.
 */
export function unionViewBox(vbs, pad = 10) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const vb of vbs) {
    if (!vb) continue;
    minX = Math.min(minX, vb[0]);
    minY = Math.min(minY, vb[1]);
    maxX = Math.max(maxX, vb[0] + vb[2]);
    maxY = Math.max(maxY, vb[1] + vb[3]);
  }
  return [
    Math.round(minX - pad),
    Math.round(minY - pad),
    Math.round(maxX - minX + 2 * pad),
    Math.round(maxY - minY + 2 * pad),
  ];
}

/** Choose the shared viewBox for a set of rendered frames given the strategy. */
export function chooseViewBox({ strategy, fixedViewBox, frames }) {
  if (strategy === 'fixed' && fixedViewBox) {
    return [0, 0, fixedViewBox.width, fixedViewBox.height];
  }
  return unionViewBox(frames.map((f) => f.vb));
}

/** Build one self-contained still SVG (a single frame) at a shared viewBox. */
export function stillFrameSvg({ body, viewBox, width, bgFill = BG_FILL }) {
  const [x, y, w, h] = viewBox;
  const outW = width || Math.min(900, w);
  const outH = Math.round((outW * h) / w);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${outW}" height="${outH}">`,
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgFill}" />`,
    body,
    '</svg>',
    '',
  ].join('\n');
}
