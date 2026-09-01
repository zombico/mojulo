/**
 * The PHOTOGRAPHIC camera model for the `scene` reference target.
 *
 * Two-point perspective is a DRAWING construction — an artist's device for
 * erecting a box on paper from two chosen edge families. A photograph has no
 * such thing. It has a HORIZON (the eye level, where the ground plane's points
 * at infinity land) and as many vanishing points as the scene happens to
 * contain. Asking a reader to "find the two dominant sets of parallel edges"
 * imposes the drawing onto the photo, and it degenerates outright on the single
 * most common architectural photograph there is — the frontal street canyon,
 * where BOTH façade rows converge on ONE point and there is no second family to
 * find. (The old lowering mirrored `frontRight` about "the station point midway
 * between the two VPs", which is undefined when the two coincide.)
 *
 * So this model is photograph-first:
 *
 *     HORIZON  +  one PRINCIPAL RECESSION  +  a SCALE ANCHOR
 *
 * That is enough to map every image row to a depth on the ground plane, which
 * is the entire basis of the area budget: on a ground plane depth goes as
 * 1/(y - horizon), so EQUAL PIXEL BANDS ARE WILDLY UNEQUAL WORLD AREA. The
 * sliver of roadway next to the vanishing point can hold more street than the
 * whole nearest quarter of the frame. A reader eyeballing "about fifteen
 * buildings down there" cannot know that; a depth mapping makes it arithmetic.
 *
 * Two-point remains supported and is strictly DOWNSTREAM — a second recession
 * direction is useful for placing a box inside the frame, and is never required
 * to measure the ground.
 *
 * Pure functions: no DB, no render, no image.
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPair = (v) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

export const CAMERA_FORMS = ['one-point', 'two-point'];

/**
 * insights.camera + insights.roomBasis -> a normalized photographic camera.
 *
 * Returns { form, horizonY, vp, vpLeft, vpRight, nearRow, nearDepth, grounded,
 *           nearWidthPx, worldWidth }. Throws with a readable message rather
 * than silently defaulting — a confidently wrong camera poisons every number
 * downstream of it.
 */
export function resolveSceneCamera(insights = {}) {
  const cam = insights.camera || {};
  const rb = insights.roomBasis || {};
  const errs = [];

  const vpOne = isPair(cam.vanishingPoint) ? cam.vanishingPoint : null;
  const vps = cam.vanishingPoints || {};
  const vpL = isPair(vps.left) ? vps.left : null;
  const vpR = isPair(vps.right) ? vps.right : null;

  // FORM is declared, or inferred from what was actually measured. A single
  // vanishing point is the photographic default, not a fallback.
  let form = typeof cam.form === 'string' ? cam.form : null;
  if (form && !CAMERA_FORMS.includes(form)) {
    errs.push(`camera.form must be one of ${CAMERA_FORMS.join(' | ')} (got '${form}').`);
    form = null;
  }
  if (!form) form = vpL && vpR ? 'two-point' : 'one-point';

  if (form === 'one-point' && !vpOne && !vpL && !vpR) {
    errs.push('one-point needs `camera.vanishingPoint: [x,y]` — the single point the receding lines converge on (down the street / down the room).');
  }
  if (form === 'two-point' && !(vpL && vpR)) {
    errs.push('two-point needs BOTH `camera.vanishingPoints.left` and `.right`. If only one set of edges recedes, this is a one-point photograph — say so with camera.form:"one-point" and one `vanishingPoint`.');
  }
  // Two VPs at the same place is a one-point photo wearing a drawing's clothes.
  if (form === 'two-point' && vpL && vpR && Math.abs(vpL[0] - vpR[0]) < 1e-6) {
    errs.push('two-point declared, but the two vanishing points coincide — that IS one-point. Set camera.form:"one-point" with a single `vanishingPoint`.');
  }

  const vp = vpOne || (vpL && vpR ? [(vpL[0] + vpR[0]) / 2, (vpL[1] + vpR[1]) / 2] : vpL || vpR);
  const horizonY = isNum(cam.horizonY) ? cam.horizonY : (vp ? vp[1] : null);
  if (!isNum(horizonY)) {
    errs.push('`camera.horizonY` is required (or a vanishing point to take it from) — the eye-level row is what every depth is measured against.');
  }

  // The NEAR ROW anchors the depth scale: one image row whose ground depth we
  // call 1 (or a real distance, when the operator grounds it).
  const frontLeft = isPair(rb.frontLeft) ? rb.frontLeft : null;
  const frontRight = isPair(rb.frontRight) ? rb.frontRight : null;
  let nearRow = isNum(rb.nearRow) ? rb.nearRow : null;
  if (nearRow == null && frontLeft) nearRow = frontRight ? (frontLeft[1] + frontRight[1]) / 2 : frontLeft[1];
  if (!isNum(nearRow)) {
    errs.push('`roomBasis.frontLeft` (or `roomBasis.nearRow`) is required — the near edge of the ground you can see. Depth is measured from it.');
  } else if (isNum(horizonY) && nearRow <= horizonY) {
    errs.push(`roomBasis near row (${nearRow}) must be BELOW the horizon (${horizonY}) in image coordinates — ground you can see is under the eye line.`);
  }

  // SCALE ANCHOR. Absent, everything is relative and says so.
  const anchor = rb.scaleAnchor || null;
  let nearDepth = 1;
  let grounded = false;
  let worldWidth = null;
  const nearWidthPx = frontLeft && frontRight ? Math.abs(frontRight[0] - frontLeft[0]) : (isNum(rb.nearWidthPx) ? rb.nearWidthPx : null);
  if (anchor && typeof anchor === 'object') {
    if (anchor.kind === 'width' && isNum(anchor.world) && anchor.world > 0) {
      // A known across-frame width at the near edge (street width, room width).
      // It fixes the WORLD scale; the depth unit follows from the same ratio.
      worldWidth = anchor.world;
      grounded = true;
      const px = isNum(anchor.pixels) ? anchor.pixels : nearWidthPx;
      if (!isNum(px) || px <= 0) errs.push('scaleAnchor kind "width" needs `pixels` (or readable roomBasis.frontLeft/frontRight) alongside `world`.');
      else nearDepth = (anchor.world / px) * (nearRow - horizonY);
    } else if (anchor.kind === 'depth' && isNum(anchor.world) && anchor.world > 0) {
      nearDepth = anchor.world;         // the near edge is this far from the camera
      grounded = true;
    } else if (anchor.kind) {
      errs.push(`scaleAnchor.kind '${anchor.kind}' is not one of: width (a known across-frame width) | depth (a known distance to the near edge). Omit it and the read stays RELATIVE — honest, and usually enough.`);
    }
  }

  if (errs.length) {
    throw new Error(`scene camera invalid:\n - ${errs.join('\n - ')}`);
  }

  return {
    form, horizonY, vp,
    ...(vpL ? { vpLeft: vpL } : {}), ...(vpR ? { vpRight: vpR } : {}),
    nearRow, nearDepth, grounded,
    ...(nearWidthPx ? { nearWidthPx } : {}),
    ...(worldWidth ? { worldWidth } : {}),
    ...(frontLeft ? { frontLeft } : {}), ...(frontRight ? { frontRight } : {}),
  };
}

/**
 * Ground depth at an image row. The one equation the whole budget rests on:
 * on a ground plane, depth is inversely proportional to the row's distance
 * below the horizon. Rows at or above the horizon are at infinity — null, not
 * a huge number, so a caller cannot quietly integrate over it.
 */
export function depthAtRow(cam, y) {
  const below = y - cam.horizonY;
  if (below <= 1e-9) return null;
  return cam.nearDepth * (cam.nearRow - cam.horizonY) / below;
}

/** The inverse: the image row a given ground depth lands on. */
export function rowAtDepth(cam, d) {
  if (!isNum(d) || d <= 0) return null;
  return cam.horizonY + cam.nearDepth * (cam.nearRow - cam.horizonY) / d;
}

/**
 * How many pixels one world HEIGHT unit subtends at a given depth. A photo's
 * vertical scale is depth-dependent — the old `roomBasis.verticalUnit` was a
 * single number, which is only true for the one row it was measured at.
 */
export function verticalUnitAt(cam, d, verticalUnitNear) {
  if (!isNum(verticalUnitNear) || !isNum(d) || d <= 0) return null;
  return verticalUnitNear * cam.nearDepth / d;
}

/**
 * Ground area of the strip between two image rows, for a corridor of constant
 * world width. Area is linear in DEPTH, so the whole non-linearity lives in
 * depthAtRow — which is exactly why pixel-uniform bands mislead so badly.
 */
export function bandArea(cam, yNear, yFar, worldWidth) {
  const dN = depthAtRow(cam, yNear);
  const dF = depthAtRow(cam, yFar);
  if (dN == null || dF == null) return null;
  const w = isNum(worldWidth) ? worldWidth : (cam.worldWidth || 1);
  return Math.abs(dF - dN) * w;
}

/**
 * Partition the visible ground into `count` bands of EQUAL AREA, and report
 * what each costs in pixels. With a constant-width corridor, equal area means
 * equal depth, so the rows fall out of rowAtDepth — and the pixel shares come
 * out radically uneven. That table IS the budget annotation: it tells a reader
 * that the 4%-of-frame sliver by the vanishing point is a full fifth of the
 * street, before they start counting buildings into it.
 *
 * `farRow` is where the readable ground stops (the horizon itself is infinitely
 * far, so a photograph never shows the whole plane). Required, and deliberately
 * not defaulted — guessing it silently sets every band width.
 */
export function equalAreaBands(cam, { count = 5, farRow, worldWidth } = {}) {
  if (!isNum(farRow)) throw new Error('equalAreaBands needs `farRow` — the last image row whose ground you can actually read. The horizon is at infinity; a photo never shows the whole plane, so where the read stops is a DECLARATION, not a default.');
  const dNear = depthAtRow(cam, cam.nearRow);
  const dFar = depthAtRow(cam, farRow);
  if (dNear == null || dFar == null || dFar <= dNear) {
    throw new Error(`farRow (${farRow}) must sit between the horizon (${cam.horizonY}) and the near row (${cam.nearRow}).`);
  }
  const n = Math.max(1, Math.floor(count));
  const step = (dFar - dNear) / n;
  const pxSpan = Math.abs(cam.nearRow - farRow) || 1;
  const w = isNum(worldWidth) ? worldWidth : (cam.worldWidth || 1);

  const bands = [];
  for (let i = 0; i < n; i += 1) {
    const d0 = dNear + step * i;
    const d1 = dNear + step * (i + 1);
    const y0 = rowAtDepth(cam, d0);
    const y1 = rowAtDepth(cam, d1);
    bands.push({
      index: i,
      depthFrom: +d0.toFixed(3), depthTo: +d1.toFixed(3),
      rowFrom: +y0.toFixed(1), rowTo: +y1.toFixed(1),
      area: +(step * w).toFixed(3),
      areaShare: +(1 / n).toFixed(4),
      pixelShare: +(Math.abs(y0 - y1) / pxSpan).toFixed(4),
    });
  }
  return bands;
}

/**
 * The headline number for a reader: how much MORE ground a far band holds per
 * pixel than the nearest one. On a typical street photo this runs to one or two
 * orders of magnitude, and it is the single fact that stops a scene read from
 * stuffing a sliver with a city block.
 */
export function foreshorteningRatio(bands = []) {
  if (bands.length < 2) return null;
  const near = bands[0];
  const far = bands[bands.length - 1];
  if (!far.pixelShare || !near.pixelShare) return null;
  return +((far.areaShare / far.pixelShare) / (near.areaShare / near.pixelShare)).toFixed(1);
}
