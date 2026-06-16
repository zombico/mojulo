/**
 * cell-geometry — shape descriptors, surface discretization, and projected
 * cell assembly. The geometry-only substrate underneath imperfect-cel and
 * manga-cel (and any future renderer in this family).
 *
 * Responsibilities:
 *   - Shape factories (sphere / torus / cone / cylinder / ellipsoid /
 *     pyramid / lathe).
 *   - Per-shape surface discretization to grids of (position, normal) or
 *     to face lists for flat shapes.
 *   - Backface culling against a fixed view direction.
 *   - 2D projection via `projectTwoPoint`.
 *   - Per-cell neighbor index assembly so downstream renderers can compare
 *     adjacent cells (used by imperfect-cel for lateral light blending,
 *     and by manga-cel for tier-boundary inking).
 *
 * Non-responsibilities (handled by renderers downstream):
 *   - Lighting / shading. Cells carry a 3D `normal` and a world `centerZ`;
 *     callers compute their own Lambert + quantization on top.
 *   - Palette derivation.
 *   - SVG emit.
 *
 * Public API:
 *
 *   shapeToGeometricCells(shape) => Array<{
 *     corners,            // [[x,y], ...] 2D projected
 *     edges,              // [[p1,p2], ...] edges in cell order
 *     neighbors,          // [idx, ...] index into the returned array,
 *                         //   -1 if no visible neighbor across edge[k]
 *     silhouetteEdges,    // edges where neighbors[k] === -1
 *     normal,             // averaged 3D surface normal {x,y,z}
 *     depth,              // average projected depth
 *     centerZ,            // world-space z (for gravity-darken etc.)
 *     smooth,             // true for smooth grid cells, false for flat faces
 *   }>
 *
 *   makeSphere / makeTorus / makeCone / makeCylinder / makeEllipsoid /
 *   makePyramid / makeLathe — shape descriptor factories.
 *
 *   DEFAULT_LIGHT_DIR — shared sensible default for renderers.
 *
 *   normalize3 / cross3 / dot3 / compute2DLightDirection — math helpers
 *   reused by renderers.
 */

import { projectTwoPoint } from './pure-mandala.js';

// ─── Constants ─────────────────────────────────────────────────────────

const VIEW_DIR = { x: 0, y: -1, z: 0 };
// Cull face if normal · view > this. Permissive (above 0) keeps near-edge
// silhouette cells visible.
const CULL_THRESHOLD = 0.12;

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

export function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
export function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
export function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

function perpendicularBasis(n) {
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const uHat = normalize3(cross3(n, ref));
  const vHat = normalize3(cross3(n, uHat));
  return [uHat, vHat];
}

export const DEFAULT_LIGHT_DIR = normalize3({ x: 0.60, y: 0.30, z: 0.72 });

// ─── 2D projected light direction ──────────────────────────────────────

export function compute2DLightDirection(lightDir) {
  const ref = { x: 0, y: -10, z: 2 };
  const offset = {
    x: ref.x + lightDir.x * 4,
    y: ref.y + lightDir.y * 4,
    z: ref.z + lightDir.z * 4,
  };
  const refProj = projectTwoPoint(ref);
  const offsetProj = projectTwoPoint(offset);
  const dx = offsetProj[0] - refProj[0];
  const dy = offsetProj[1] - refProj[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
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

// ─── Cell assembly ─────────────────────────────────────────────────────

// Edge ordering convention (must match across consumers):
//   corners = [v00, v10, v11, v01]
//   edges   = [v00→v10, v10→v11, v11→v01, v01→v00]
//   neighbours[0] = (i, j-1)   shares edge v00→v10
//   neighbours[1] = (i+1, j)   shares edge v10→v11
//   neighbours[2] = (i, j+1)   shares edge v11→v01
//   neighbours[3] = (i-1, j)   shares edge v01→v00

function gridToGeometricCells(grid, wrapI, wrapJ) {
  const I = grid.length;
  const J = grid[0].length;
  const cellRows = wrapI ? I : I - 1;
  const cellCols = wrapJ ? J : J - 1;

  // Pass 1: build full cell grid (visible + invisible) so we can determine
  // neighbour visibility for silhouette/adjacency.
  const full = [];
  for (let i = 0; i < cellRows; i += 1) {
    const row = [];
    for (let j = 0; j < cellCols; j += 1) {
      const ip = wrapI ? (i + 1) % I : i + 1;
      const jp = wrapJ ? (j + 1) % J : j + 1;
      const v00 = grid[i][j];
      const v10 = grid[ip][j];
      const v11 = grid[ip][jp];
      const v01 = grid[i][jp];
      const avg = normalize3({
        x: v00.normal.x + v10.normal.x + v11.normal.x + v01.normal.x,
        y: v00.normal.y + v10.normal.y + v11.normal.y + v01.normal.y,
        z: v00.normal.z + v10.normal.z + v11.normal.z + v01.normal.z,
      });
      const camDot = dot3(avg, VIEW_DIR);
      const visible = camDot < CULL_THRESHOLD;
      const centerZ = (v00.pos.z + v10.pos.z + v11.pos.z + v01.pos.z) / 4;
      const a = projectTwoPoint(v00.pos);
      const b = projectTwoPoint(v10.pos);
      const c = projectTwoPoint(v11.pos);
      const d = projectTwoPoint(v01.pos);
      const depth = (a[2] + b[2] + c[2] + d[2]) / 4;
      row.push({ visible, normal: avg, corners: [a, b, c, d], depth, centerZ });
    }
    full.push(row);
  }

  // Pass 2: assign output indices to visible cells.
  const idxOf = new Map();
  let nextIdx = 0;
  for (let i = 0; i < cellRows; i += 1) {
    for (let j = 0; j < cellCols; j += 1) {
      if (full[i][j].visible) {
        idxOf.set(i * cellCols + j, nextIdx);
        nextIdx += 1;
      }
    }
  }

  // Pass 3: emit visible cells with neighbour indices into the output array.
  const out = [];
  for (let i = 0; i < cellRows; i += 1) {
    for (let j = 0; j < cellCols; j += 1) {
      const cell = full[i][j];
      if (!cell.visible) continue;
      const im = wrapI ? (i - 1 + cellRows) % cellRows : (i > 0 ? i - 1 : -1);
      const ipN = wrapI ? (i + 1) % cellRows : (i < cellRows - 1 ? i + 1 : -1);
      const jm = wrapJ ? (j - 1 + cellCols) % cellCols : (j > 0 ? j - 1 : -1);
      const jpN = wrapJ ? (j + 1) % cellCols : (j < cellCols - 1 ? j + 1 : -1);
      const lookup = (ni, nj) => {
        if (ni < 0 || nj < 0) return -1;
        const k = ni * cellCols + nj;
        return idxOf.has(k) ? idxOf.get(k) : -1;
      };
      const neighbors = [
        lookup(i, jm),
        lookup(ipN, j),
        lookup(i, jpN),
        lookup(im, j),
      ];
      const [a, b, c, d] = cell.corners;
      const edges = [[a, b], [b, c], [c, d], [d, a]];
      const silhouetteEdges = [];
      for (let k = 0; k < 4; k += 1) {
        if (neighbors[k] === -1) silhouetteEdges.push(edges[k]);
      }
      out.push({
        corners: cell.corners,
        edges,
        neighbors,
        silhouetteEdges,
        normal: cell.normal,
        depth: cell.depth,
        centerZ: cell.centerZ,
        smooth: true,
      });
    }
  }
  return out;
}

function facesToGeometricCells(faces) {
  // Flat faces: we do not track inter-face adjacency here. Every edge of
  // a visible flat face is treated as silhouette (no neighbor), which is
  // the right read for cel-style rendering — adjacent faces have abruptly
  // different normals and read as "ink boundaries" anyway.
  const out = [];
  for (const face of faces) {
    const camDot = dot3(face.normal, VIEW_DIR);
    if (camDot > CULL_THRESHOLD) continue;
    const projected = face.corners.map((p) => projectTwoPoint(p));
    const depth = projected.reduce((s, p) => s + p[2], 0) / projected.length;
    const centerZ = face.corners.reduce((s, p) => s + p.z, 0) / face.corners.length;
    const edges = [];
    for (let k = 0; k < projected.length; k += 1) {
      const kp = (k + 1) % projected.length;
      edges.push([projected[k], projected[kp]]);
    }
    out.push({
      corners: projected,
      edges,
      neighbors: edges.map(() => -1),
      silhouetteEdges: edges.slice(),
      normal: face.normal,
      depth,
      centerZ,
      smooth: false,
    });
  }
  return out;
}

// Returns the shape's 3D positional center (best-effort). Used by
// renderers that want to do a hemisphere cull — e.g., to drop the
// back-inner ring of a torus so its hole renders as paper instead of
// showing the back surface through the hole.
export function shapeWorldCenter(shape) {
  if (shape.kind === 'lathe') {
    return {
      x: (shape.axisFrom.x + shape.axisTo.x) / 2,
      y: (shape.axisFrom.y + shape.axisTo.y) / 2,
      z: (shape.axisFrom.z + shape.axisTo.z) / 2,
    };
  }
  if (shape.center) {
    return { x: shape.center.x, y: shape.center.y, z: shape.center.z };
  }
  return { x: 0, y: 0, z: 0 };
}

export { projectTwoPoint };

export function shapeToGeometricCells(shape) {
  switch (shape.kind) {
    case 'sphere':
      return gridToGeometricCells(
        buildSphereGrid(shape.center, shape.radius, shape.T, shape.Theta),
        false, true,
      );
    case 'torus':
      return gridToGeometricCells(
        buildTorusGrid(shape.center, shape.R, shape.r, shape.U, shape.V),
        true, true,
      );
    case 'cone':
      return gridToGeometricCells(
        buildConeGrid(shape.center, shape.radius, shape.height, shape.T, shape.Theta),
        false, true,
      );
    case 'cylinder':
      return gridToGeometricCells(
        buildCylinderGrid(shape.center, shape.radius, shape.height, shape.T, shape.Theta),
        false, true,
      );
    case 'ellipsoid':
      return gridToGeometricCells(
        buildEllipsoidGrid(shape.center, shape.scaleX, shape.scaleY, shape.scaleZ, shape.T, shape.Theta),
        false, true,
      );
    case 'lathe':
      return gridToGeometricCells(
        buildLatheGrid(shape, shape.T, shape.Theta),
        false, true,
      );
    case 'pyramid':
      return facesToGeometricCells(
        buildPyramidFaces(shape.center, shape.baseHalf, shape.height),
      );
    default:
      throw new Error(`cell-geometry: unknown shape kind "${shape.kind}"`);
  }
}
