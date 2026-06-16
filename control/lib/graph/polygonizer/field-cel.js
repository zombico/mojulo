/**
 * field-cel — stylized SVG rendering primitive for "realistic" rendered
 * lighting on blob forms, lathed surfaces, and character/organic shapes.
 *
 * Sibling of imperfect-cel. Same shape descriptors and projection layer,
 * different rendering pipeline:
 *
 *   1. Each surface is discretized into a 2D grid of (position, normal) —
 *      analytic normals where the surface is parametric (lathes use exact
 *      profile + harmonic derivatives), face normals for flat shapes.
 *   2. Per-VERTEX Lambert shading (not per-cell averaged), so adjacent
 *      grid cells share brightness at their shared edge.
 *   3. Per-cell quantization across a 5-tier deep palette (0.30 → 1.55
 *      of the shape's base hex). Each cell emits a single polygon.
 *   4. Within-band ±8% gradient between the dim corner and bright corner
 *      of each cell. Cells with all 4 corners in the same band become
 *      flat fills.
 *   5. Contour darkening: cells with any neighbour that is off-grid or
 *      culled (i.e., cells lying on the shape's silhouette) get an
 *      extra Lambert subtracted before quantization, producing a
 *      darker band of cells hugging the form's contour. No silhouette
 *      strokes are emitted.
 *   6. Gravity-darkening on lower cells so each form's bottom rim
 *      accumulates contact shadow.
 *
 * When to use field-cel vs imperfect-cel:
 *
 *   - field-cel: blob forms, lathed objects, characters and organic
 *     shapes that should read as volumetrically-lit. Smooth tonal
 *     continuity across cells, deep tonal range, soft contour. Closer
 *     to a "painted from observation" look.
 *   - imperfect-cel: illustrated / hand-cel'd surfaces where the visible
 *     S-curve bisection across each cell is part of the character.
 *     Closer to anime cel-shading.
 *
 * Public API:
 *
 *   renderFieldCel(shapes, opts?) => svg string
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

import { projectTwoPoint } from './pure-mandala.js';

// ─── Constants ─────────────────────────────────────────────────────────

export const DEFAULT_LIGHT_DIR = normalize3({ x: 0.60, y: 0.30, z: 0.72 });
const VIEW_DIR = { x: 0, y: -1, z: 0 };

// 5-tier brightness quantization thresholds (on lambert ∈ [0, 1]).
const QUANT_THRESHOLDS = [0.20, 0.40, 0.60, 0.80];

// Deep palette: 0.30 → 1.55 of base. Wider tonal range than imperfect-cel
// (which uses 0.55 → 1.50) — gives shadow side genuine darkness while
// keeping each shape recognizable in its own hue family.
const PALETTE_FACTORS = [0.30, 0.55, 0.85, 1.15, 1.55];

// Within-band gradient span. ±8% subtle stretch between dim and bright
// corners of each cell, so corners aren't all identical even when the
// band is uniform. Tight enough to preserve band identity.
const WITHIN_BAND_FACTOR_LOW = 0.92;
const WITHIN_BAND_FACTOR_HIGH = 1.08;

// Contour darkening: cells lying on the shape's silhouette (any
// neighbour is off-grid or culled) get this subtracted from each
// corner's Lambert before quantization. Produces a darker band of
// cells hugging the form's outline — replaces the explicit silhouette
// stroke that imperfect-cel uses.
const CONTOUR_DARKEN_AMOUNT = 0.18;

// Cull face if normal · view > this. Permissive (above 0) keeps near-edge
// silhouette cells visible.
const CULL_THRESHOLD = 0.12;

// Gravity-darkening tunables.
const GRAVITY_DARKEN_HEIGHT = 5.0;
const GRAVITY_DARKEN_AMOUNT = 0.20;
const LAMBERT_GAIN = 0.78;

// Default per-shape subdivision densities.
const DEFAULT_SUBDIV = {
  sphere:    { axial: 18, radial: 36 },
  torus:     { major: 40, minor: 20 },
  cone:      { axial: 18, radial: 36 },
  cylinder:  { axial: 14, radial: 32 },
  ellipsoid: { axial: 18, radial: 36 },
  lathe:     { axial: 20, radial: 40 },
};

// ─── Math helpers ──────────────────────────────────────────────────────

function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

function perpendicularBasis(n) {
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const uHat = normalize3(cross3(n, ref));
  const vHat = normalize3(cross3(n, uHat));
  return [uHat, vHat];
}

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
function gravityLambertOffset(z, sceneBaseZ = 0) {
  const h = z - sceneBaseZ;
  let amount;
  if (h >= GRAVITY_DARKEN_HEIGHT) amount = 0;
  else if (h <= 0) amount = GRAVITY_DARKEN_AMOUNT;
  else amount = (1 - h / GRAVITY_DARKEN_HEIGHT) * GRAVITY_DARKEN_AMOUNT;
  return amount / LAMBERT_GAIN;
}
function withinBandColor(palL, t) {
  const f = WITHIN_BAND_FACTOR_LOW + (WITHIN_BAND_FACTOR_HIGH - WITHIN_BAND_FACTOR_LOW) * t;
  return rgbStr(clampColor(palL.map((c) => c * f)));
}

// ─── Shape grid builders ───────────────────────────────────────────────

function buildSphereGrid(center, radius, T, ThetaCount) {
  const grid = [];
  for (let i = 0; i <= T; i += 1) {
    const t = i / T;
    const phi = Math.PI * t;
    const sphi = Math.sin(phi);
    const cphi = Math.cos(phi);
    const row = [];
    for (let j = 0; j < ThetaCount; j += 1) {
      const theta = (j / ThetaCount) * 2 * Math.PI;
      const cth = Math.cos(theta);
      const sth = Math.sin(theta);
      const pos = {
        x: center.x + radius * sphi * cth,
        y: center.y + radius * sphi * sth,
        z: center.z + radius * cphi,
      };
      const normal = normalize3({ x: sphi * cth, y: sphi * sth, z: cphi });
      row.push({ pos, normal });
    }
    grid.push(row);
  }
  return grid;
}

function buildTorusGrid(center, R, r, U, V) {
  const grid = [];
  for (let i = 0; i < U; i += 1) {
    const u = (i / U) * 2 * Math.PI;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const row = [];
    for (let j = 0; j < V; j += 1) {
      const v = (j / V) * 2 * Math.PI;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      const ringR = R + r * cv;
      const pos = {
        x: center.x + ringR * cu,
        y: center.y + ringR * su,
        z: center.z + r * sv,
      };
      const normal = normalize3({ x: cv * cu, y: cv * su, z: sv });
      row.push({ pos, normal });
    }
    grid.push(row);
  }
  return grid;
}

function buildConeGrid(center, radius, height, T, ThetaCount) {
  const grid = [];
  const slantLen = Math.hypot(radius, height);
  const slantH = radius / slantLen;
  const slantV = height / slantLen;
  for (let i = 0; i <= T; i += 1) {
    const t = i / T;
    const r = radius * t;
    const z = center.z + height * (1 - t);
    const row = [];
    for (let j = 0; j < ThetaCount; j += 1) {
      const theta = (j / ThetaCount) * 2 * Math.PI;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      const pos = { x: center.x + r * cs, y: center.y + r * sn, z };
      const normal = normalize3({ x: cs * slantV, y: sn * slantV, z: slantH });
      row.push({ pos, normal });
    }
    grid.push(row);
  }
  return grid;
}

function buildCylinderGrid(center, radius, height, T, ThetaCount) {
  const grid = [];
  for (let i = 0; i <= T; i += 1) {
    const t = i / T;
    const z = center.z + height * (0.5 - t);
    const row = [];
    for (let j = 0; j < ThetaCount; j += 1) {
      const theta = (j / ThetaCount) * 2 * Math.PI;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      const pos = { x: center.x + radius * cs, y: center.y + radius * sn, z };
      const normal = { x: cs, y: sn, z: 0 };
      row.push({ pos, normal });
    }
    grid.push(row);
  }
  return grid;
}

function buildEllipsoidGrid(center, scaleX, scaleY, scaleZ, T, ThetaCount) {
  const grid = [];
  for (let i = 0; i <= T; i += 1) {
    const t = i / T;
    const phi = Math.PI * t;
    const sphi = Math.sin(phi);
    const cphi = Math.cos(phi);
    const row = [];
    for (let j = 0; j < ThetaCount; j += 1) {
      const theta = (j / ThetaCount) * 2 * Math.PI;
      const cth = Math.cos(theta);
      const sth = Math.sin(theta);
      const pos = {
        x: center.x + scaleX * sphi * cth,
        y: center.y + scaleY * sphi * sth,
        z: center.z + scaleZ * cphi,
      };
      const normal = normalize3({
        x: (sphi * cth) / scaleX,
        y: (sphi * sth) / scaleY,
        z: cphi / scaleZ,
      });
      row.push({ pos, normal });
    }
    grid.push(row);
  }
  return grid;
}

function buildPyramidFaces(center, baseHalf, height) {
  const bh = baseHalf;
  const apex = { x: center.x, y: center.y, z: center.z + height };
  const c00 = { x: center.x - bh, y: center.y - bh, z: center.z };
  const c10 = { x: center.x + bh, y: center.y - bh, z: center.z };
  const c11 = { x: center.x + bh, y: center.y + bh, z: center.z };
  const c01 = { x: center.x - bh, y: center.y + bh, z: center.z };
  const faces = [
    { corners: [c11, c01, apex] },
    { corners: [c10, c11, apex] },
    { corners: [c00, c10, apex] },
    { corners: [c01, c00, apex] },
    { corners: [c00, c10, c11, c01] },
  ];
  for (const f of faces) {
    const cs = f.corners;
    if (cs.length === 3) {
      const e1 = { x: cs[1].x - cs[0].x, y: cs[1].y - cs[0].y, z: cs[1].z - cs[0].z };
      const e2 = { x: cs[2].x - cs[0].x, y: cs[2].y - cs[0].y, z: cs[2].z - cs[0].z };
      f.normal = normalize3(cross3(e1, e2));
    } else {
      const e1 = { x: cs[2].x - cs[0].x, y: cs[2].y - cs[0].y, z: cs[2].z - cs[0].z };
      const e2 = { x: cs[1].x - cs[0].x, y: cs[1].y - cs[0].y, z: cs[1].z - cs[0].z };
      f.normal = normalize3(cross3(e1, e2));
    }
  }
  return faces;
}

// Analytic lathe grid — exact normals from profile + harmonic derivatives.
function buildLatheGrid(spec, Tcount, ThetaCount) {
  const axisFrom = spec.axisFrom;
  const axisTo = spec.axisTo;
  const dirX = axisTo.x - axisFrom.x;
  const dirY = axisTo.y - axisFrom.y;
  const dirZ = axisTo.z - axisFrom.z;
  const axisLen = Math.hypot(dirX, dirY, dirZ);
  const axisDir = { x: dirX / axisLen, y: dirY / axisLen, z: dirZ / axisLen };
  const [uHat, vHat] = perpendicularBasis(axisDir);

  const profile = [...spec.profile].sort((a, b) => a.t - b.t);
  function R(t) {
    if (t <= profile[0].t) return profile[0].radius;
    if (t >= profile[profile.length - 1].t) return profile[profile.length - 1].radius;
    for (let k = 0; k + 1 < profile.length; k += 1) {
      const a = profile[k], b = profile[k + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        if (span < 1e-12) return a.radius;
        return a.radius + ((t - a.t) / span) * (b.radius - a.radius);
      }
    }
    return profile[profile.length - 1].radius;
  }
  function dRdt(t) {
    if (t <= profile[0].t || t >= profile[profile.length - 1].t) return 0;
    for (let k = 0; k + 1 < profile.length; k += 1) {
      const a = profile[k], b = profile[k + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        if (span < 1e-12) return 0;
        return (b.radius - a.radius) / span;
      }
    }
    return 0;
  }

  const harmonics = Array.isArray(spec.harmonics) ? spec.harmonics : [];
  function H(theta) {
    let h = 0;
    for (const w of harmonics) {
      const n = Number.isFinite(w?.n) ? w.n : 0;
      const amp = Number.isFinite(w?.amplitude) ? w.amplitude : 0;
      const ph = Number.isFinite(w?.phase) ? w.phase : 0;
      if (n === 0 || amp === 0) continue;
      h += amp * Math.cos(n * theta + ph);
    }
    return h;
  }
  function dHdtheta(theta) {
    let dh = 0;
    for (const w of harmonics) {
      const n = Number.isFinite(w?.n) ? w.n : 0;
      const amp = Number.isFinite(w?.amplitude) ? w.amplitude : 0;
      const ph = Number.isFinite(w?.phase) ? w.phase : 0;
      if (n === 0 || amp === 0) continue;
      dh += -n * amp * Math.sin(n * theta + ph);
    }
    return dh;
  }

  const grid = [];
  for (let i = 0; i <= Tcount; i += 1) {
    const t = i / Tcount;
    const center = { x: axisFrom.x + t * dirX, y: axisFrom.y + t * dirY, z: axisFrom.z + t * dirZ };
    const baseR = R(t);
    const baseDR = dRdt(t);
    const row = [];
    for (let j = 0; j < ThetaCount; j += 1) {
      const theta = (j / ThetaCount) * 2 * Math.PI;
      const cs = Math.cos(theta);
      const sn = Math.sin(theta);
      const r = baseR + H(theta);
      const radial = {
        x: cs * uHat.x + sn * vHat.x,
        y: cs * uHat.y + sn * vHat.y,
        z: cs * uHat.z + sn * vHat.z,
      };
      const angular = {
        x: -sn * uHat.x + cs * vHat.x,
        y: -sn * uHat.y + cs * vHat.y,
        z: -sn * uHat.z + cs * vHat.z,
      };
      const pos = {
        x: center.x + r * radial.x,
        y: center.y + r * radial.y,
        z: center.z + r * radial.z,
      };
      const dPdt = {
        x: dirX + baseDR * radial.x,
        y: dirY + baseDR * radial.y,
        z: dirZ + baseDR * radial.z,
      };
      const dPdth = {
        x: r * angular.x + dHdtheta(theta) * radial.x,
        y: r * angular.y + dHdtheta(theta) * radial.y,
        z: r * angular.z + dHdtheta(theta) * radial.z,
      };
      const normal = normalize3(cross3(dPdt, dPdth));
      row.push({ pos, normal });
    }
    grid.push(row);
  }
  return grid;
}

// ─── Public shape descriptor factories ─────────────────────────────────

function pickSubdiv(provided, defaults) {
  return { ...defaults, ...(provided || {}) };
}

export function makeSphere({ center, radius, baseColor, subdivisions }) {
  const sub = pickSubdiv(subdivisions, DEFAULT_SUBDIV.sphere);
  return { kind: 'sphere', center, radius, baseColor, T: sub.axial, Theta: sub.radial };
}
export function makeTorus({ center, R, r, baseColor, subdivisions }) {
  const sub = pickSubdiv(subdivisions, DEFAULT_SUBDIV.torus);
  return { kind: 'torus', center, R, r, baseColor, U: sub.major, V: sub.minor };
}
export function makeCone({ center, radius, height, baseColor, subdivisions }) {
  const sub = pickSubdiv(subdivisions, DEFAULT_SUBDIV.cone);
  return { kind: 'cone', center, radius, height, baseColor, T: sub.axial, Theta: sub.radial };
}
export function makeCylinder({ center, radius, height, baseColor, subdivisions }) {
  const sub = pickSubdiv(subdivisions, DEFAULT_SUBDIV.cylinder);
  return { kind: 'cylinder', center, radius, height, baseColor, T: sub.axial, Theta: sub.radial };
}
export function makeEllipsoid({ center, scaleX, scaleY, scaleZ, baseColor, subdivisions }) {
  const sub = pickSubdiv(subdivisions, DEFAULT_SUBDIV.ellipsoid);
  return { kind: 'ellipsoid', center, scaleX, scaleY, scaleZ, baseColor, T: sub.axial, Theta: sub.radial };
}
export function makePyramid({ center, baseHalf, height, baseColor }) {
  return { kind: 'pyramid', center, baseHalf, height, baseColor };
}
export function makeLathe({ axisFrom, axisTo, profile, harmonics, baseColor, subdivisions }) {
  const sub = pickSubdiv(subdivisions, DEFAULT_SUBDIV.lathe);
  return {
    kind: 'lathe',
    axisFrom, axisTo, profile,
    harmonics: harmonics || [],
    baseColor,
    T: sub.axial, Theta: sub.radial,
  };
}

// ─── Cell construction ────────────────────────────────────────────────

function cellsFromGrid(grid, paletteRGB, wrapI, wrapJ, lightDir, useGravity) {
  const I = grid.length;
  const J = grid[0].length;
  const cellRows = wrapI ? I : I - 1;
  const cellCols = wrapJ ? J : J - 1;

  // Per-vertex Lambert. Adjacent cells will share these at their shared
  // grid edge → continuous shading across cell boundaries.
  const vLam = [];
  for (let i = 0; i < I; i += 1) {
    const row = [];
    for (let j = 0; j < J; j += 1) {
      const v = grid[i][j];
      const lambert = Math.max(0, dot3(v.normal, lightDir));
      const grav = useGravity ? gravityLambertOffset(v.pos.z) : 0;
      row.push(Math.max(0, lambert - grav));
    }
    vLam.push(row);
  }

  // Pre-emit cells: project + visibility cull.
  const cells = [];
  for (let i = 0; i < cellRows; i += 1) {
    const row = [];
    for (let j = 0; j < cellCols; j += 1) {
      const ip = wrapI ? (i + 1) % I : i + 1;
      const jp = wrapJ ? (j + 1) % J : j + 1;
      const v00 = grid[i][j];
      const v10 = grid[ip][j];
      const v11 = grid[ip][jp];
      const v01 = grid[i][jp];
      const avgNormal = normalize3({
        x: v00.normal.x + v10.normal.x + v11.normal.x + v01.normal.x,
        y: v00.normal.y + v10.normal.y + v11.normal.y + v01.normal.y,
        z: v00.normal.z + v10.normal.z + v11.normal.z + v01.normal.z,
      });
      const visible = dot3(avgNormal, VIEW_DIR) < CULL_THRESHOLD;
      const a = projectTwoPoint(v00.pos);
      const b = projectTwoPoint(v10.pos);
      const c = projectTwoPoint(v11.pos);
      const d = projectTwoPoint(v01.pos);
      const depth = (a[2] + b[2] + c[2] + d[2]) / 4;
      const cornerLam = [vLam[i][j], vLam[ip][j], vLam[ip][jp], vLam[i][jp]];
      row.push({ visible, corners: [a, b, c, d], depth, cornerLam });
    }
    cells.push(row);
  }

  // Identify contour cells (any neighbour null or culled) and apply
  // contour darkening before emitting.
  const out = [];
  for (let i = 0; i < cellRows; i += 1) {
    for (let j = 0; j < cellCols; j += 1) {
      const cell = cells[i][j];
      if (!cell.visible) continue;
      const im = wrapI ? (i - 1 + cellRows) % cellRows : (i > 0 ? i - 1 : -1);
      const ip2 = wrapI ? (i + 1) % cellRows : (i < cellRows - 1 ? i + 1 : -1);
      const jm = wrapJ ? (j - 1 + cellCols) % cellCols : (j > 0 ? j - 1 : -1);
      const jp2 = wrapJ ? (j + 1) % cellCols : (j < cellCols - 1 ? j + 1 : -1);
      const nbW = jm >= 0 ? cells[i][jm] : null;
      const nbE = jp2 >= 0 ? cells[i][jp2] : null;
      const nbN = im >= 0 ? cells[im][j] : null;
      const nbS = ip2 >= 0 ? cells[ip2][j] : null;
      const isContour =
        (nbW === null || !nbW.visible)
        || (nbE === null || !nbE.visible)
        || (nbN === null || !nbN.visible)
        || (nbS === null || !nbS.visible);
      const cornerLam = isContour
        ? cell.cornerLam.map((l) => Math.max(0, l - CONTOUR_DARKEN_AMOUNT))
        : cell.cornerLam;
      const cornerLev = cornerLam.map((l) => quantizeBrightness(l));
      out.push({
        smooth: true,
        corners: cell.corners,
        depth: cell.depth,
        cornerLam,
        cornerLev,
        paletteRGB,
      });
    }
  }
  return out;
}

function cellsFromFaces(faces, paletteRGB, lightDir, useGravity) {
  const out = [];
  for (const face of faces) {
    const camDot = dot3(face.normal, VIEW_DIR);
    if (camDot > CULL_THRESHOLD) continue;
    const lambert = Math.max(0, dot3(face.normal, lightDir));
    const centerZ = face.corners.reduce((s, p) => s + p.z, 0) / face.corners.length;
    const grav = useGravity ? gravityLambertOffset(centerZ) : 0;
    const level = quantizeBrightness(Math.max(0, lambert - grav));
    const projected = face.corners.map((p) => projectTwoPoint(p));
    const depth = projected.reduce((s, p) => s + p[2], 0) / projected.length;
    out.push({
      smooth: false,
      corners: projected,
      depth,
      fill: rgbStr(paletteRGB[level]),
    });
  }
  return out;
}

// ─── Scene assembly ────────────────────────────────────────────────────

function shapeToCells(shape, lightDir, useGravity) {
  const palette = genPaletteRGB(shape.baseColor);
  switch (shape.kind) {
    case 'sphere':
      return cellsFromGrid(buildSphereGrid(shape.center, shape.radius, shape.T, shape.Theta),
        palette, false, true, lightDir, useGravity);
    case 'torus':
      return cellsFromGrid(buildTorusGrid(shape.center, shape.R, shape.r, shape.U, shape.V),
        palette, true, true, lightDir, useGravity);
    case 'cone':
      return cellsFromGrid(buildConeGrid(shape.center, shape.radius, shape.height, shape.T, shape.Theta),
        palette, false, true, lightDir, useGravity);
    case 'cylinder':
      return cellsFromGrid(buildCylinderGrid(shape.center, shape.radius, shape.height, shape.T, shape.Theta),
        palette, false, true, lightDir, useGravity);
    case 'ellipsoid':
      return cellsFromGrid(buildEllipsoidGrid(shape.center, shape.scaleX, shape.scaleY, shape.scaleZ, shape.T, shape.Theta),
        palette, false, true, lightDir, useGravity);
    case 'lathe':
      return cellsFromGrid(buildLatheGrid(shape, shape.T, shape.Theta),
        palette, false, true, lightDir, useGravity);
    case 'pyramid':
      return cellsFromFaces(buildPyramidFaces(shape.center, shape.baseHalf, shape.height),
        palette, lightDir, useGravity);
    default:
      throw new Error(`field-cel: unknown shape kind "${shape.kind}"`);
  }
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

function emitCell(cell, defs, body, gradCounterRef) {
  if (!cell.smooth) {
    const pts = cell.corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    body.push(`<polygon points="${pts}" fill="${cell.fill}" stroke="${cell.fill}" stroke-width="0.4" />`);
    return;
  }
  let minI = 0;
  let maxI = 0;
  for (let i = 1; i < 4; i += 1) {
    if (cell.cornerLam[i] < cell.cornerLam[minI]) minI = i;
    if (cell.cornerLam[i] > cell.cornerLam[maxI]) maxI = i;
  }
  const cornerColor = (i) => {
    const L = cell.cornerLev[i];
    const palL = cell.paletteRGB[L];
    const tLow = L === 0 ? 0 : QUANT_THRESHOLDS[L - 1];
    const tHigh = L >= QUANT_THRESHOLDS.length ? 1 : QUANT_THRESHOLDS[L];
    const span = tHigh - tLow || 1;
    const t = Math.max(0, Math.min(1, (cell.cornerLam[i] - tLow) / span));
    return withinBandColor(palL, t);
  };
  const minColor = cornerColor(minI);
  const maxColor = cornerColor(maxI);
  const pts = cell.corners.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  if (minColor === maxColor) {
    body.push(`<polygon points="${pts}" fill="${minColor}" stroke="${minColor}" stroke-width="0.4" />`);
    return;
  }
  const minPt = cell.corners[minI];
  const maxPt = cell.corners[maxI];
  const gid = `fc${gradCounterRef.n}`;
  gradCounterRef.n += 1;
  defs.push(
    `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" `
    + `x1="${minPt[0].toFixed(2)}" y1="${minPt[1].toFixed(2)}" `
    + `x2="${maxPt[0].toFixed(2)}" y2="${maxPt[1].toFixed(2)}">`
    + `<stop offset="0" stop-color="${minColor}" />`
    + `<stop offset="1" stop-color="${maxColor}" />`
    + `</linearGradient>`,
  );
  body.push(`<polygon points="${pts}" fill="url(#${gid})" stroke="url(#${gid})" stroke-width="0.4" />`);
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
export function renderFieldCel(shapes, opts = {}) {
  const lightDir = opts.lightDir || DEFAULT_LIGHT_DIR;
  const useGravity = opts.gravityDarken !== false;
  const background = opts.background || '#fafaf6';

  const allCells = [];
  for (const shape of shapes) {
    const cells = shapeToCells(shape, lightDir, useGravity);
    for (const c of cells) allCells.push(c);
  }
  allCells.sort((a, b) => b.depth - a.depth);
  const vp = computeViewport(allCells);

  const defs = [];
  const body = [];
  body.push(`<rect x="${vp.vbX}" y="${vp.vbY}" width="${vp.vbW}" height="${vp.vbH}" fill="${background}" />`);
  const gradCounterRef = { n: 0 };

  for (const cell of allCells) {
    emitCell(cell, defs, body, gradCounterRef);
  }

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vp.vbX} ${vp.vbY} ${vp.vbW} ${vp.vbH}" width="${vp.svgW}" height="${vp.svgH}">`);
  if (defs.length > 0) parts.push(`<defs>${defs.join('')}</defs>`);
  for (const b of body) parts.push(b);
  parts.push('</svg>');
  return parts.join('\n');
}
