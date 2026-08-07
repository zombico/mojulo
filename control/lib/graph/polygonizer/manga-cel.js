/**
 * manga-cel — minimalist B&W rendering of 3D shape descriptors.
 *
 * Shares the geometry substrate (cell-geometry.js) with imperfect-cel,
 * but renders to ink-on-paper: tonal grayscale fills per cell, dark
 * silhouette strokes around the form's outer rim.
 *
 * The visual language:
 *   - Cells are filled with a per-tier grayscale tone (Lambert-
 *     quantized). The tier on the light side of a transition gets the
 *     lighter tone (or paper); the shadow side gets a darker gray.
 *     With `tiers === 2` that's just two tones: paper + a single
 *     shadow gray. With `tiers === 3` three tones. The tier transition
 *     reads as a tonal gradient — not an ink mark.
 *   - The shape's outer rim is inked as a chained `<polyline>` so the
 *     stroke flows continuously around the cull boundary.
 *   - With `tiers === 1` all cells share the single (lightest) tone
 *     and only the silhouette is drawn — pure outline mode.
 *   - Optional `contourLines: true` adds smooth Catmull-Rom Bezier
 *     paths along tier boundaries on top of the tonal fills, for a
 *     traditional comic/manga look (line + tone).
 *
 * Hole topology (`frontOnly` opt): for shapes like the torus whose back
 * surface is visible *through* the front (e.g., the back-inner ring
 * seen through the hole), the back surface' polygons depth-sort behind
 * the front polygons but don't get occluded in the 2D hole region. The
 * `frontOnly` opt drops cells whose 3D position is behind the shape's
 * positional center — for a torus this strips the back-inner ring and
 * the hole renders as paper.
 *
 * Public API:
 *
 *   renderMangaCel(shapes, opts?) => svg string
 *
 * Shape factories and DEFAULT_LIGHT_DIR are re-exported from
 * cell-geometry.js for ergonomics.
 */

import {
  shapeToGeometricCells,
  shapeWorldCenter,
  projectTwoPoint,
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

// ─── Defaults ──────────────────────────────────────────────────────────

const DEFAULTS = {
  tiers: 2,
  background: '#ffffff',
  fill: '#ffffff',              // lightest tier (also the paper)
  strokeColor: '#1a1a1a',
  silhouetteWidth: 1.4,
  // Tonal palette: array of N color strings, one per tier, from darkest
  // to lightest. If null, derived from `fill` by linear interpolation
  // toward `toneDarkness` * fill.
  tones: null,
  toneDarkness: 0.7,           // darkest tier = fill scaled by this factor
  // Optional contour overlay (off by default — tonal fills carry the
  // tier transition on their own).
  contourLines: false,
  contourColor: '#555555',
  contourWidth: 0.6,
  smoothContours: true,
  frontOnly: false,
};

// Endpoint-matching precision for chaining edges into polylines. 4 dp on
// projected coordinates is well within projectTwoPoint's determinism for
// shared-grid-vertex projections.
const ENDPOINT_KEY_PRECISION = 4;

// ─── Lambert quantization ──────────────────────────────────────────────

function lambert(normal, lightDir) {
  return Math.max(0, dot3(normal, lightDir));
}

function quantize(value, tiers) {
  if (tiers <= 1) return 0;
  const t = Math.max(0, Math.min(0.9999, value));
  return Math.floor(t * tiers);
}

// ─── Tonal palette ─────────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}
function rgbStr([r, g, b]) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// Build a tonal palette of N colors interpolated between `fill * darkness`
// (darkest tier) and `fill` (lightest tier).
function generateTones(tiers, fillHex, darkness) {
  const light = hexToRgb(fillHex);
  const dark = light.map((c) => c * darkness);
  if (tiers <= 1) return [rgbStr(light)];
  const out = [];
  for (let i = 0; i < tiers; i += 1) {
    const t = i / (tiers - 1);
    const r = dark[0] + (light[0] - dark[0]) * t;
    const g = dark[1] + (light[1] - dark[1]) * t;
    const b = dark[2] + (light[2] - dark[2]) * t;
    out.push(rgbStr([r, g, b]));
  }
  return out;
}

// ─── Viewport ──────────────────────────────────────────────────────────

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

// ─── Edge chaining ─────────────────────────────────────────────────────

// Returns a list of polylines (each: array of [x, y] points). Edges
// sharing endpoints are concatenated; zero-length edges (polar
// degeneracies) are filtered to avoid fragmenting the chain.
function chainEdges(rawEdges) {
  if (rawEdges.length === 0) return [];
  const ptKey = (p) => `${p[0].toFixed(ENDPOINT_KEY_PRECISION)},${p[1].toFixed(ENDPOINT_KEY_PRECISION)}`;

  const edges = [];
  for (const e of rawEdges) {
    if (ptKey(e[0]) === ptKey(e[1])) continue;
    edges.push(e);
  }
  if (edges.length === 0) return [];

  const adj = new Map();
  for (let i = 0; i < edges.length; i += 1) {
    const [a, b] = edges[i];
    const ka = ptKey(a);
    const kb = ptKey(b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push({ edgeIdx: i, other: b });
    adj.get(kb).push({ edgeIdx: i, other: a });
  }

  const remaining = new Set(edges.map((_, i) => i));
  const findNext = (from) => {
    const k = ptKey(from);
    const conns = adj.get(k);
    if (!conns) return null;
    for (const c of conns) {
      if (remaining.has(c.edgeIdx)) return c;
    }
    return null;
  };

  const polylines = [];
  while (remaining.size > 0) {
    const startIdx = remaining.values().next().value;
    remaining.delete(startIdx);
    const [a, b] = edges[startIdx];
    const pts = [a, b];

    let cur = b;
    while (true) {
      const next = findNext(cur);
      if (!next) break;
      remaining.delete(next.edgeIdx);
      pts.push(next.other);
      cur = next.other;
    }
    cur = a;
    while (true) {
      const next = findNext(cur);
      if (!next) break;
      remaining.delete(next.edgeIdx);
      pts.unshift(next.other);
      cur = next.other;
    }
    polylines.push(pts);
  }
  return polylines;
}

// ─── Polyline → SVG ────────────────────────────────────────────────────

function polylineToSvg(points, stroke, width) {
  const pts = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return (
    `<polyline points="${pts}" fill="none" ` +
    `stroke="${stroke}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-linejoin="round" />`
  );
}

// Catmull-Rom-to-cubic-Bezier smoothing. Produces a C1-continuous curve
// passing through every original polyline vertex. For a chain that loops
// back to its start, the path closes (Z) and wraps the spline tangents.
function smoothPolylineToPath(points, stroke, width) {
  const n = points.length;
  if (n < 2) return null;
  if (n === 2) {
    return polylineToSvg(points, stroke, width);
  }
  const eps = 0.005;
  const closed = (
    Math.abs(points[0][0] - points[n - 1][0]) < eps &&
    Math.abs(points[0][1] - points[n - 1][1]) < eps
  );
  // Logical vertex count and wrap helper. For closed loops we treat the
  // duplicate end vertex as the same as index 0.
  const N = closed ? n - 1 : n;
  const at = (i) => {
    if (closed) return points[((i % N) + N) % N];
    return points[Math.max(0, Math.min(N - 1, i))];
  };
  const fmt = (x) => x.toFixed(2);

  let d = `M ${fmt(at(0)[0])} ${fmt(at(0)[1])}`;
  const segCount = closed ? N : N - 1;
  for (let i = 0; i < segCount; i += 1) {
    const prev = at(i - 1);
    const curr = at(i);
    const next = at(i + 1);
    const aft  = at(i + 2);
    const c1x = curr[0] + (next[0] - prev[0]) / 6;
    const c1y = curr[1] + (next[1] - prev[1]) / 6;
    const c2x = next[0] - (aft[0]  - curr[0]) / 6;
    const c2y = next[1] - (aft[1]  - curr[1]) / 6;
    d += ` C ${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(next[0])} ${fmt(next[1])}`;
  }
  if (closed) d += ' Z';
  return (
    `<path d="${d}" fill="none" ` +
    `stroke="${stroke}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-linejoin="round" />`
  );
}

// ─── Scene assembly ────────────────────────────────────────────────────

function buildShapeCells(shape, lightDir, tiers, frontOnly) {
  let cells = shapeToGeometricCells(shape);

  if (frontOnly && cells.length > 0) {
    const ctr = shapeWorldCenter(shape);
    const ctrDepth = projectTwoPoint(ctr)[2];
    // Tolerance: half the depth range; conservative, keeps rim cells
    // whose depth is approximately at the centroid.
    let dMin = Infinity, dMax = -Infinity;
    for (const c of cells) {
      if (c.depth < dMin) dMin = c.depth;
      if (c.depth > dMax) dMax = c.depth;
    }
    const range = Math.max(1e-9, dMax - dMin);
    const tol = range * 0.02;
    const cutoff = ctrDepth + tol;
    // Filter cells and rebuild neighbor indices into the new array.
    const keep = cells.map((c) => c.depth <= cutoff);
    const newIdx = new Map();
    let next = 0;
    for (let i = 0; i < cells.length; i += 1) {
      if (keep[i]) { newIdx.set(i, next); next += 1; }
    }
    const remapped = [];
    for (let i = 0; i < cells.length; i += 1) {
      if (!keep[i]) continue;
      const c = cells[i];
      const newNeighbors = c.neighbors.map((nbIdx) => {
        if (nbIdx < 0) return -1;
        return newIdx.has(nbIdx) ? newIdx.get(nbIdx) : -1;
      });
      const silhouetteEdges = [];
      for (let k = 0; k < c.edges.length; k += 1) {
        if (newNeighbors[k] === -1) silhouetteEdges.push(c.edges[k]);
      }
      remapped.push({
        corners: c.corners,
        edges: c.edges,
        neighbors: newNeighbors,
        silhouetteEdges,
        normal: c.normal,
        depth: c.depth,
        centerZ: c.centerZ,
        smooth: c.smooth,
      });
    }
    cells = remapped;
  }

  for (const c of cells) {
    c.level = quantize(lambert(c.normal, lightDir), tiers);
  }
  return cells;
}

function shapeMaxDepth(cells) {
  let m = -Infinity;
  for (const c of cells) if (c.depth > m) m = c.depth;
  return m;
}

/**
 * Render an array of shape descriptors as a B&W manga-cel SVG.
 *
 * @param {Array} shapes
 * @param {Object} [opts]
 * @param {{x,y,z}} [opts.lightDir]      — defaults to DEFAULT_LIGHT_DIR
 * @param {number}  [opts.tiers]         — Lambert tiers (default 2)
 * @param {string}  [opts.background]    — paper color (default '#ffffff')
 * @param {string}  [opts.fill]          — cell fill (default '#ffffff')
 * @param {string}  [opts.strokeColor]   — silhouette ink color
 * @param {string}  [opts.contourColor]  — tier-boundary ink color (lighter)
 * @param {number}  [opts.silhouetteWidth] — outer rim stroke width
 * @param {number}  [opts.contourWidth]    — tier-boundary stroke width
 * @param {boolean} [opts.frontOnly]    — drop cells behind the shape's
 *                                         positional center (default false)
 * @param {boolean} [opts.smoothContours] — Catmull-Rom-smooth the tier
 *                                          contours into bezier paths
 *                                          (default true). Silhouette is
 *                                          always rendered as polyline.
 */
export function renderMangaCel(shapes, opts = {}) {
  const lightDir = opts.lightDir || DEFAULT_LIGHT_DIR;
  const tiers = Number.isFinite(opts.tiers) && opts.tiers >= 1 ? Math.floor(opts.tiers) : DEFAULTS.tiers;
  const background = opts.background || DEFAULTS.background;
  const fill = opts.fill || DEFAULTS.fill;
  const stroke = opts.strokeColor || DEFAULTS.strokeColor;
  const contourColor = opts.contourColor || DEFAULTS.contourColor;
  const silhouetteW = Number.isFinite(opts.silhouetteWidth) ? opts.silhouetteWidth : DEFAULTS.silhouetteWidth;
  const contourW = Number.isFinite(opts.contourWidth) ? opts.contourWidth : DEFAULTS.contourWidth;
  const frontOnly = opts.frontOnly === true;
  const smoothContours = opts.smoothContours !== false;
  const contourLines = opts.contourLines === true;
  const toneDarkness = Number.isFinite(opts.toneDarkness) ? opts.toneDarkness : DEFAULTS.toneDarkness;
  const tones = Array.isArray(opts.tones) && opts.tones.length >= tiers
    ? opts.tones.slice(0, tiers)
    : generateTones(tiers, fill, toneDarkness);

  const perShape = shapes.map((shape) => ({
    cells: buildShapeCells(shape, lightDir, tiers, frontOnly),
  }));

  const allCells = [];
  for (const s of perShape) for (const c of s.cells) allCells.push(c);
  const vp = computeViewport(allCells);

  const drawOrder = perShape
    .map((s, i) => ({ shapeIdx: i, maxDepth: shapeMaxDepth(s.cells) }))
    .sort((a, b) => b.maxDepth - a.maxDepth)
    .map((e) => e.shapeIdx);

  const body = [];
  body.push(`<rect x="${vp.vbX}" y="${vp.vbY}" width="${vp.vbW}" height="${vp.vbH}" fill="${background}" />`);

  for (const sIdx of drawOrder) {
    const cells = perShape[sIdx].cells;
    if (cells.length === 0) continue;
    const sorted = cells.slice().sort((a, b) => b.depth - a.depth);

    for (const cell of sorted) {
      const pts = cell.corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
      const tone = tones[cell.level];
      // Stroke = own tone so adjacent same-tier cells tile seamlessly;
      // adjacent different-tier cells get a soft 0.4-unit transition zone
      // that reads as a tonal step rather than an inked edge.
      body.push(`<polygon points="${pts}" fill="${tone}" stroke="${tone}" stroke-width="0.4" />`);
    }

    // Silhouette: polylines, sharp corners preserved.
    const silhouetteEdges = [];
    for (const cell of cells) {
      for (const e of cell.silhouetteEdges) silhouetteEdges.push(e);
    }
    for (const chain of chainEdges(silhouetteEdges)) {
      body.push(polylineToSvg(chain, stroke, silhouetteW));
    }

    // Tier contour overlay (opt-in). Smoothed bezier paths along tier
    // boundaries on top of the tonal fills. Off by default — the tonal
    // step alone carries the brightness transition.
    if (tiers >= 2 && contourLines) {
      const contourEdges = [];
      for (const cell of cells) {
        for (let k = 0; k < cell.neighbors.length; k += 1) {
          const nbIdx = cell.neighbors[k];
          if (nbIdx < 0) continue;
          const nb = cells[nbIdx];
          if (cell.level <= nb.level) continue;
          contourEdges.push(cell.edges[k]);
        }
      }
      for (const chain of chainEdges(contourEdges)) {
        const svg = smoothContours
          ? smoothPolylineToPath(chain, contourColor, contourW)
          : polylineToSvg(chain, contourColor, contourW);
        if (svg) body.push(svg);
      }
    }
  }

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vp.vbX} ${vp.vbY} ${vp.vbW} ${vp.vbH}" width="${vp.svgW}" height="${vp.svgH}">`);
  for (const b of body) parts.push(b);
  parts.push('</svg>');
  return parts.join('\n');
}
