/**
 * imperfect-cel — stylized SVG rendering primitive.
 *
 * Takes 3D shape descriptors (sphere / torus / pyramid / cone / cylinder /
 * ellipsoid / lathe-spec) and renders them through a single cel-shading
 * pipeline:
 *
 *   1. Each surface is discretized into a 2D grid of (position, normal) —
 *      analytic normals where the surface is parametric (lathes use exact
 *      profile + harmonic derivatives), face normals for flat shapes.
 *      (Discretization, projection, and cull live in cell-geometry.js.)
 *   2. Quantized Lambert shading per cell across a 5-tier palette derived
 *      from each shape's base hex color.
 *   3. Sine bisection: every cell split by a cubic-bezier S-curve
 *      perpendicular to the projected light direction.
 *   4. Outward shadow gradient (palette[N] at S-curve, palette[N-1] at
 *      far edge) tilted toward the lower-right perpendicular (tilt=0.7)
 *      so the dark concentration falls naturally and lateral neighbors
 *      blend smoothly.
 *   5. Light triangle gradient: lateral blend between the two side-
 *      neighbors' light colors (correct polarity).
 *   6. Per-shape palette-derived silhouette strokes (no pure ink — every
 *      stroke stays in the shape's own hue family).
 *   7. Gravity-darkening on lower cells so each shape's bottom rim
 *      accumulates contact shadow.
 *
 * The pipeline was validated through 43 spike iterations (see
 * imperfect-cel-shape-zoo.spike.gen.test.js) on six different shape
 * types, three light angles, and the heart's multi-lathe assembly.
 *
 * Public API:
 *
 *   renderImperfectCel(shapes, opts?) => svg string
 *
 *   makeSphere({ center, radius, baseColor, subdivisions? })
 *   makeTorus({ center, R, r, baseColor, subdivisions? })
 *   makePyramid({ center, baseHalf, height, baseColor })
 *   makeCone({ center, radius, height, baseColor, subdivisions? })
 *   makeCylinder({ center, radius, height, baseColor, subdivisions? })
 *   makeEllipsoid({ center, scaleX, scaleY, scaleZ, baseColor, subdivisions? })
 *   makeLathe({ axisFrom, axisTo, profile, harmonics?, baseColor, subdivisions? })
 *
 *   DEFAULT_LIGHT_DIR
 */

import {
  shapeToGeometricCells,
  compute2DLightDirection,
  dot3,
  DEFAULT_LIGHT_DIR,
  makeSphere,
  makeTorus,
  makeCone,
  makeCylinder,
  makeEllipsoid,
  makePyramid,
  makeLathe,
} from './cell-geometry.js';

export {
  DEFAULT_LIGHT_DIR,
  makeSphere,
  makeTorus,
  makeCone,
  makeCylinder,
  makeEllipsoid,
  makePyramid,
  makeLathe,
};

// ─── Cel-shading constants ─────────────────────────────────────────────

// 5-tier brightness quantization thresholds (on lambert ∈ [0, 1]).
const QUANT_THRESHOLDS = [0.20, 0.40, 0.60, 0.80];
// Per-tier multipliers applied to the shape's base hex color to derive
// the palette: shadow → deep-shadow → mid → light → highlight.
const PALETTE_FACTORS = [0.55, 0.75, 0.95, 1.20, 1.50];
// Silhouette stroke colors per tier — extends palette beyond the 5 fills
// to provide darker/brighter rim strokes per cell's brightness level.
const SILHOUETTE_FACTORS = [
  { srcIdx: 0, factor: 0.65 },
  { srcIdx: 0, factor: 0.80 },
  { srcIdx: 1, factor: 0.85 },
  { srcIdx: 3, factor: 1.08 },
  { srcIdx: 4, factor: 1.20 },
];
const SILHOUETTE_STROKE_WIDTH = 0.95;

// Sine-bisection cubic-bezier perpendicular offset (in cell-edge fractions).
const BISECT_AMPLITUDE_FACTOR = 0.18;

// Gravity-darkening tunables.
const GRAVITY_DARKEN_HEIGHT = 5.0;
const GRAVITY_DARKEN_AMOUNT = 0.20;
const LAMBERT_GAIN = 0.78;     // for the gravity → lambert conversion

// Outward shadow gradient axis tilt: 0 = pure light direction, 1 = pure
// perpendicular. 0.7 with 'lower-right' perpendicular is the validated
// setting that breaks fish-scale patterns while keeping the dark
// concentration on the cell's bottom-right.
const OUTWARD_TILT = 0.7;

// ─── Colour helpers ────────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}
function clampColor([r, g, b]) {
  return [
    Math.max(0, Math.min(255, Math.round(r))),
    Math.max(0, Math.min(255, Math.round(g))),
    Math.max(0, Math.min(255, Math.round(b))),
  ];
}
function rgbStr([r, g, b]) { return `rgb(${r},${g},${b})`; }
function genPaletteRGB(baseHex) {
  const base = hexToRgb(baseHex);
  return PALETTE_FACTORS.map((f) => clampColor(base.map((c) => c * f)));
}
function quantizeBrightness(lambert) {
  for (let i = 0; i < QUANT_THRESHOLDS.length; i += 1) {
    if (lambert < QUANT_THRESHOLDS[i]) return i;
  }
  return QUANT_THRESHOLDS.length;
}
function silhouetteColorForLevel(level, paletteRGB) {
  const { srcIdx, factor } = SILHOUETTE_FACTORS[level];
  return clampColor(paletteRGB[srcIdx].map((c) => c * factor));
}
function gravityLambertOffset(z, sceneBaseZ = 0) {
  const h = z - sceneBaseZ;
  let amount;
  if (h >= GRAVITY_DARKEN_HEIGHT) amount = 0;
  else if (h <= 0) amount = GRAVITY_DARKEN_AMOUNT;
  else amount = (1 - h / GRAVITY_DARKEN_HEIGHT) * GRAVITY_DARKEN_AMOUNT;
  return amount / LAMBERT_GAIN;
}

// ─── Per-cell shading decoration ───────────────────────────────────────

function decorateShapeCells(shape, lightDir, useGravity) {
  const palette = genPaletteRGB(shape.baseColor);
  const geom = shapeToGeometricCells(shape);

  // Pass 1: assign per-cell level (needed before pass 2 can read
  // neighbours' levels for lateral light colors).
  for (const c of geom) {
    const lambert = Math.max(0, dot3(c.normal, lightDir));
    const grav = useGravity ? gravityLambertOffset(c.centerZ) : 0;
    c.level = quantizeBrightness(Math.max(0, lambert - grav));
  }

  // Pass 2: enrich with fill/silhouetteStroke + lateral neighbor colors.
  const out = [];
  for (const c of geom) {
    let leftCentroid = null, leftLightColor = null;
    let rightCentroid = null, rightLightColor = null;
    if (c.smooth) {
      const lIdx = c.neighbors[0];
      if (lIdx >= 0) {
        const nb = geom[lIdx];
        let cx = 0, cy = 0;
        for (const [x, y] of nb.corners) { cx += x; cy += y; }
        cx /= nb.corners.length; cy /= nb.corners.length;
        leftCentroid = { x: cx, y: cy };
        leftLightColor = rgbStr(palette[nb.level]);
      }
      const rIdx = c.neighbors[2];
      if (rIdx >= 0) {
        const nb = geom[rIdx];
        let cx = 0, cy = 0;
        for (const [x, y] of nb.corners) { cx += x; cy += y; }
        cx /= nb.corners.length; cy /= nb.corners.length;
        rightCentroid = { x: cx, y: cy };
        rightLightColor = rgbStr(palette[nb.level]);
      }
    }

    out.push({
      depth: c.depth,
      corners: c.corners,
      level: c.level,
      smooth: c.smooth,
      fill: rgbStr(palette[c.level]),
      paletteRGB: palette,
      silhouette: c.silhouetteEdges,
      silhouetteStroke: rgbStr(silhouetteColorForLevel(c.level, palette)),
      leftCentroid, leftLightColor,
      rightCentroid, rightLightColor,
    });
  }
  return out;
}

// ─── Sine bisection (S-curve cubic bezier per cell) ────────────────────

function bisectCellPaths(corners, lightDir2D, amplitude) {
  if (corners.length < 3) return null;
  let cx = 0, cy = 0;
  for (const [x, y] of corners) { cx += x; cy += y; }
  cx /= corners.length; cy /= corners.length;
  const perpX = -lightDir2D.y;
  const perpY = lightDir2D.x;
  const intersections = [];
  for (let i = 0; i < corners.length; i += 1) {
    const j = (i + 1) % corners.length;
    const p1 = corners[i];
    const p2 = corners[j];
    const ex = p2[0] - p1[0];
    const ey = p2[1] - p1[1];
    const det = perpX * (-ey) - (-ex) * perpY;
    if (Math.abs(det) < 1e-9) continue;
    const s = (perpX * (p1[1] - cy) - perpY * (p1[0] - cx)) / det;
    if (s < -1e-6 || s > 1 + 1e-6) continue;
    intersections.push({
      x: p1[0] + s * ex,
      y: p1[1] + s * ey,
      edgeIdx: i,
      sCoord: Math.max(0, Math.min(1, s)),
    });
  }
  if (intersections.length !== 2) return null;
  intersections.sort((a, b) => (a.edgeIdx - b.edgeIdx) || (a.sCoord - b.sCoord));
  const [int1, int2] = intersections;
  const polyA = [];
  let idx = (int1.edgeIdx + 1) % corners.length;
  const stop1 = (int2.edgeIdx + 1) % corners.length;
  while (idx !== stop1) { polyA.push(corners[idx]); idx = (idx + 1) % corners.length; }
  const polyB = [];
  let idx2 = (int2.edgeIdx + 1) % corners.length;
  const stop2 = (int1.edgeIdx + 1) % corners.length;
  while (idx2 !== stop2) { polyB.push(corners[idx2]); idx2 = (idx2 + 1) % corners.length; }
  let sax = 0, say = 0;
  const sourcePoly = polyA.length > 0 ? polyA : [[int1.x, int1.y], [int2.x, int2.y]];
  for (const [x, y] of sourcePoly) { sax += x; say += y; }
  sax /= sourcePoly.length; say /= sourcePoly.length;
  const sideA = (sax - cx) * lightDir2D.x + (say - cy) * lightDir2D.y;
  const lightIsA = sideA > 0;
  const lineDx = int2.x - int1.x;
  const lineDy = int2.y - int1.y;
  const lineLen = Math.hypot(lineDx, lineDy);
  if (lineLen < 1e-9) return null;
  const perpLineX = -lineDy / lineLen;
  const perpLineY = lineDx / lineLen;
  const c1X = int1.x + lineDx / 3 + perpLineX * amplitude;
  const c1Y = int1.y + lineDy / 3 + perpLineY * amplitude;
  const c2X = int1.x + 2 * lineDx / 3 - perpLineX * amplitude;
  const c2Y = int1.y + 2 * lineDy / 3 - perpLineY * amplitude;
  function pathFor(side, fromInt, toInt, controlPair) {
    let d = `M ${fromInt.x.toFixed(2)} ${fromInt.y.toFixed(2)}`;
    for (const [x, y] of side) d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    d += ` L ${toInt.x.toFixed(2)} ${toInt.y.toFixed(2)}`;
    d += ` C ${controlPair[0][0].toFixed(2)} ${controlPair[0][1].toFixed(2)}`;
    d += ` ${controlPair[1][0].toFixed(2)} ${controlPair[1][1].toFixed(2)}`;
    d += ` ${fromInt.x.toFixed(2)} ${fromInt.y.toFixed(2)} Z`;
    return d;
  }
  const pathA = pathFor(polyA, int1, int2, [[c2X, c2Y], [c1X, c1Y]]);
  const pathB = pathFor(polyB, int2, int1, [[c1X, c1Y], [c2X, c2Y]]);
  const curveMidX = (int1.x + int2.x) / 2;
  const curveMidY = (int1.y + int2.y) / 2;
  const shadowCorners = lightIsA ? polyB : polyA;
  let shadowExtent = 0;
  for (const [x, y] of shadowCorners) {
    const dx = x - curveMidX;
    const dy = y - curveMidY;
    const proj = dx * (-lightDir2D.x) + dy * (-lightDir2D.y);
    if (proj > shadowExtent) shadowExtent = proj;
  }
  const result = lightIsA
    ? { lightPath: pathA, shadowPath: pathB }
    : { lightPath: pathB, shadowPath: pathA };
  result.curveMidpoint = { x: curveMidX, y: curveMidY };
  result.shadowExtent = shadowExtent;
  return result;
}

// ─── Viewport + SVG render ─────────────────────────────────────────────

function computeViewport(cells) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of cells) {
    for (const [x, y] of cell.corners) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  }
  const PAD = 12;
  const vbX = Math.floor(minX - PAD);
  const vbY = Math.floor(minY - PAD);
  const vbW = Math.ceil((maxX - minX) + 2 * PAD);
  const vbH = Math.ceil((maxY - minY) + 2 * PAD);
  const SCALE = 9;
  return { vbX, vbY, vbW, vbH, svgW: Math.round(vbW * SCALE), svgH: Math.round(vbH * SCALE) };
}

/**
 * Render an array of shape descriptors to an SVG string.
 *
 * @param {Array} shapes — descriptors from makeSphere/makeLathe/etc.
 * @param {Object} [opts]
 * @param {{x,y,z}} [opts.lightDir]      — world-space light direction; defaults to DEFAULT_LIGHT_DIR
 * @param {boolean} [opts.gravityDarken] — accumulate contact shadow at low z; default true
 * @param {string} [opts.background]     — SVG background fill; default '#fafaf6'
 */
export function renderImperfectCel(shapes, opts = {}) {
  const lightDir = opts.lightDir || DEFAULT_LIGHT_DIR;
  const useGravity = opts.gravityDarken !== false;   // default true
  const background = opts.background || '#fafaf6';
  const lightDir2D = compute2DLightDirection(lightDir);

  const allCells = [];
  for (const shape of shapes) {
    const cells = decorateShapeCells(shape, lightDir, useGravity);
    for (const c of cells) allCells.push(c);
  }
  allCells.sort((a, b) => b.depth - a.depth);
  const vp = computeViewport(allCells);

  const defs = [];
  const body = [];
  body.push(`<rect x="${vp.vbX}" y="${vp.vbY}" width="${vp.vbW}" height="${vp.vbH}" fill="${background}" />`);
  let gradCounter = 0;

  for (const cell of allCells) {
    const pts = cell.corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    let perim = 0;
    for (let k = 0; k < cell.corners.length; k += 1) {
      const kp = (k + 1) % cell.corners.length;
      perim += Math.hypot(
        cell.corners[kp][0] - cell.corners[k][0],
        cell.corners[kp][1] - cell.corners[k][1],
      );
    }
    const avgEdge = perim / cell.corners.length;
    const amp = avgEdge * BISECT_AMPLITUDE_FACTOR;
    const split = bisectCellPaths(cell.corners, lightDir2D, amp);
    let didBisect = false;
    if (split) {
      const lightLevel = cell.level;
      const shadowLevel = Math.max(0, cell.level - 1);
      const lightColorStr = rgbStr(cell.paletteRGB[lightLevel]);
      const shadowColorStr = rgbStr(cell.paletteRGB[shadowLevel]);

      // Shadow: aligned gradient with lower-right perpendicular tilt 0.7,
      // only for smooth cells (cellsFromFaces sets smooth: false).
      let shadowFillAttr = shadowColorStr;
      let shadowStrokeAttr = ` stroke="${shadowColorStr}" stroke-width="0.4"`;
      if (cell.smooth && Number.isFinite(split.shadowExtent) && split.shadowExtent > 1e-3) {
        const gid = `sa${gradCounter++}`;
        const cm = split.curveMidpoint;
        const perpX = -lightDir2D.y;
        const perpY = lightDir2D.x;
        const rawX = -lightDir2D.x * (1 - OUTWARD_TILT) + perpX * OUTWARD_TILT;
        const rawY = -lightDir2D.y * (1 - OUTWARD_TILT) + perpY * OUTWARD_TILT;
        const axisLen = Math.hypot(rawX, rawY) || 1;
        const tiltedX = rawX / axisLen;
        const tiltedY = rawY / axisLen;
        const farX = cm.x + tiltedX * split.shadowExtent;
        const farY = cm.y + tiltedY * split.shadowExtent;
        defs.push(
          `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" ` +
          `x1="${cm.x.toFixed(2)}" y1="${cm.y.toFixed(2)}" x2="${farX.toFixed(2)}" y2="${farY.toFixed(2)}">` +
          `<stop offset="0" stop-color="${lightColorStr}" />` +
          `<stop offset="1" stop-color="${shadowColorStr}" />` +
          `</linearGradient>`,
        );
        shadowFillAttr = `url(#${gid})`;
        shadowStrokeAttr = ` stroke="url(#${gid})" stroke-width="0.4"`;
      }
      body.push(`<path d="${split.shadowPath}" fill="${shadowFillAttr}"${shadowStrokeAttr} />`);

      // Light: lateral blend with neighbours' light colors (correct polarity).
      let lightFillAttr = lightColorStr;
      let lightStrokeAttr = ` stroke="${lightColorStr}" stroke-width="0.4"`;
      if (cell.smooth && cell.leftCentroid && cell.rightCentroid && cell.leftLightColor && cell.rightLightColor) {
        const gid = `lbl${gradCounter++}`;
        defs.push(
          `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" ` +
          `x1="${cell.leftCentroid.x.toFixed(2)}" y1="${cell.leftCentroid.y.toFixed(2)}" ` +
          `x2="${cell.rightCentroid.x.toFixed(2)}" y2="${cell.rightCentroid.y.toFixed(2)}">` +
          `<stop offset="0" stop-color="${cell.leftLightColor}" />` +
          `<stop offset="1" stop-color="${cell.rightLightColor}" />` +
          `</linearGradient>`,
        );
        lightFillAttr = `url(#${gid})`;
        lightStrokeAttr = ` stroke="url(#${gid})" stroke-width="0.4"`;
      }
      body.push(`<path d="${split.lightPath}" fill="${lightFillAttr}"${lightStrokeAttr} />`);
      didBisect = true;
    }
    if (!didBisect) {
      body.push(`<polygon points="${pts}" fill="${cell.fill}" stroke="${cell.fill}" stroke-width="0.4" />`);
    }

    for (const [p1, p2] of cell.silhouette) {
      body.push(`<line x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" stroke="${cell.silhouetteStroke}" stroke-width="${SILHOUETTE_STROKE_WIDTH}" stroke-linecap="round" />`);
    }
  }

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vp.vbX} ${vp.vbY} ${vp.vbW} ${vp.vbH}" width="${vp.svgW}" height="${vp.svgH}">`);
  if (defs.length > 0) parts.push(`<defs>${defs.join('')}</defs>`);
  for (const b of body) parts.push(b);
  parts.push('</svg>');
  return parts.join('\n');
}
