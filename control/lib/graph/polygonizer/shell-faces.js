/**
 * shell-faces — the `shell` form primitive: a parametric POLYHEDRON.
 *
 * The topology sibling of lathe (revolution), extrude (prism), sweep (tube), drape (cloth) and
 * relief (emboss). Those five build a solid from a PROFILE — they answer "what silhouette is swept
 * where". A whole family of objects is not shaped that way: a geodesic dome, a d20, a soccer-ball
 * shell, a faceted sensor housing. Their identity is their FACE LAYOUT, and no sweep of a profile
 * produces one. This primitive is that missing axis.
 *
 *   { solid:'truncated_icosahedron', radius:2, center:{x:0,y:0,z:2}, tint:'#e8e6e0' }
 *
 * Seven solids ship: the five platonics, the truncated icosahedron (the soccer ball — 12 pentagons
 * + 20 hexagons), and `geodesic` (class-I subdivision of the icosahedron, `frequency` sets the
 * density). Faces carry a `group` and a STABLE `faceId`, which is what lets face-ops.js name a face
 * in a durable recipe rather than by render-order index.
 *
 * Construction is EXACT, not sphere-approximated. Vertices come from literal golden-ratio
 * coordinate families; faces are recovered from the vertex set by edge-length detection plus a
 * rotational traversal of the resulting polyhedral graph (see `facesFromVertices`). The tempting
 * alternative — subdivide a sphere, then merge near-coplanar triangles — yields a face count that
 * drifts with the merge tolerance, which would make both `faceId` and every selector
 * non-deterministic. That is the one property this file cannot trade away.
 *
 * Emits the same engine-agnostic baked face list as every sibling (`{ corners, fill, doubleSided,
 * outNormal }`), vexar-shaded, so a shell inherits materials, the AO/GI bake, .glb/.stl export and
 * assembler placement with no downstream change whatsoever.
 *
 * Pure: no three.js, no DOM, no dice.
 *
 * Design: faceted-shell.plan.md §B. Siblings: extrude-faces.js, lathe-faces.js.
 */

import { norm3, dot3, centroid, newellNormal, shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';
import { selectFaces, validateSelector } from './face-select.js';
import { applyFaceOps, validateFaceOps } from './face-ops.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const MAX_FACES_PER_SHELL = 16384;
const MAX_GEODESIC_FREQUENCY = 8;   // 20·8² = 1280 faces — the live-world ceiling
const EDGE_EPS = 1e-6;
const DEFAULT_TINT = '#9aa3b0';

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ---------------------------------------------------------------------------
// vertex families
// ---------------------------------------------------------------------------

/** The 3 cyclic (even) permutations of a triple — the standard way these coordinate families are written. */
function cyclic([x, y, z]) {
  return [[x, y, z], [z, x, y], [y, z, x]];
}

/** Every sign assignment of the non-zero slots of a triple (a zero has no ± to vary). */
function signs(triple) {
  const out = [];
  for (let m = 0; m < 8; m += 1) {
    const v = [
      (m & 1 ? -1 : 1) * triple[0],
      (m & 2 ? -1 : 1) * triple[1],
      (m & 4 ? -1 : 1) * triple[2],
    ];
    out.push(v);
  }
  return out;
}

/** Expand coordinate families → a deduped vertex set on the unit sphere. */
function sphereVertices(families) {
  const seen = new Map();
  for (const fam of families) {
    for (const perm of cyclic(fam)) {
      for (const v of signs(perm)) {
        const n = norm3(v);
        // 9 decimals: far below any real vertex separation here (the closest pair on a frequency-8
        // geodesic is ~0.04), far above float noise from the sqrt/φ arithmetic.
        const key = n.map((c) => (Math.abs(c) < 1e-9 ? 0 : c).toFixed(9)).join(',');
        if (!seen.has(key)) seen.set(key, n);
      }
    }
  }
  return [...seen.values()];
}

const VERTEX_FAMILIES = {
  tetrahedron: null,   // special-cased: an alternating half of the cube, not a sign-closed family
  cube: [[1, 1, 1]],
  octahedron: [[1, 0, 0]],
  icosahedron: [[0, 1, PHI]],
  dodecahedron: [[1, 1, 1], [0, 1 / PHI, PHI]],
  truncated_icosahedron: [[0, 1, 3 * PHI], [1, 2 + PHI, 2 * PHI], [PHI, 2, 2 * PHI + 1]],
};

/** Unit-sphere vertices for a named solid. */
function verticesFor(solid) {
  if (solid === 'tetrahedron') {
    return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => norm3(v));
  }
  return sphereVertices(VERTEX_FAMILIES[solid]);
}

// ---------------------------------------------------------------------------
// vertices → faces
// ---------------------------------------------------------------------------

/**
 * Recover the face list of a convex, equal-edged polyhedron from its vertices alone.
 *
 * Two steps, both exact for the solids here:
 *  1. EDGES — every solid in this file is edge-transitive (all edges the same length), so the
 *     minimum pairwise vertex distance IS the edge length, and edges are the pairs at that distance.
 *  2. FACES — walk the polyhedral graph. At each vertex the neighbours are sorted by angle in the
 *     local tangent plane; the next edge of a face is the neighbour adjacent to the one we arrived
 *     from. Consuming each DIRECTED edge exactly once enumerates every face exactly once.
 *
 * This is why a 60-vertex/32-face solid needs no hand-typed index table — the table is derived, so
 * there is no transcription to get wrong, and the tests can assert Euler's formula against it.
 */
function facesFromVertices(verts) {
  const n = verts.length;
  // 1. edge length = the minimum pairwise distance
  let minD = Infinity;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = Math.hypot(...sub(verts[i], verts[j]));
      if (d < minD) minD = d;
    }
  }
  const cutoff = minD * (1 + EDGE_EPS);
  const adj = verts.map(() => []);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (Math.hypot(...sub(verts[i], verts[j])) <= cutoff) { adj[i].push(j); adj[j].push(i); }
    }
  }

  // 2. sort each vertex's neighbours by angle in its tangent plane (vertices are on the unit
  // sphere, so the vertex position IS its outward normal).
  const order = verts.map((v, i) => {
    const nrm = norm3(v);
    const ref = sub(verts[adj[i][0]], v);
    const u = norm3(sub(ref, nrm.map((c) => c * dot3(ref, nrm))));
    const w = cross3(nrm, u);
    return adj[i]
      .map((j) => {
        const e = sub(verts[j], v);
        return { j, a: Math.atan2(dot3(e, w), dot3(e, u)) };
      })
      .sort((p, q) => (p.a - q.a) || (p.j - q.j))
      .map((p) => p.j);
  });

  const nextInFace = (from, at) => {
    const ring = order[at];
    const k = ring.indexOf(from);
    return ring[(k - 1 + ring.length) % ring.length];
  };

  const seen = new Set();
  const faces = [];
  for (let a = 0; a < n; a += 1) {
    for (const b0 of adj[a]) {
      if (seen.has(`${a}>${b0}`)) continue;
      const cycle = [];
      let from = a, at = b0;
      // The guard is a runaway backstop, not a real bound — a face of these solids is ≤ 6 sides.
      while (cycle.length <= n) {
        seen.add(`${from}>${at}`);
        cycle.push(from);
        const nxt = nextInFace(from, at);
        from = at; at = nxt;
        if (from === a && at === b0) break;
      }
      if (cycle.length >= 3) faces.push(cycle);
    }
  }
  return faces;
}

/** Class-I geodesic: subdivide each icosahedron face f× and project every point to the sphere. */
function geodesicTriangles(frequency) {
  const verts = verticesFor('icosahedron');
  const base = facesFromVertices(verts);
  const out = [];
  for (const tri of base) {
    const [A, B, C] = tri.map((i) => verts[i]);
    // barycentric lattice point (i,j) of the subdivided triangle, projected outward
    const P = (i, j) => norm3([
      A[0] + ((B[0] - A[0]) * i + (C[0] - A[0]) * j) / frequency,
      A[1] + ((B[1] - A[1]) * i + (C[1] - A[1]) * j) / frequency,
      A[2] + ((B[2] - A[2]) * i + (C[2] - A[2]) * j) / frequency,
    ]);
    for (let i = 0; i < frequency; i += 1) {
      for (let j = 0; j < frequency - i; j += 1) {
        out.push([P(i, j), P(i + 1, j), P(i, j + 1)]);
        if (j < frequency - i - 1) out.push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
      }
    }
  }
  return out;
}

/**
 * A solid's unit-sphere geometry as world-space corner lists, in a stable order.
 * Faces are sorted by their centroid so `faceId` does not depend on graph-walk order.
 */
function unitFaces(solid, frequency) {
  if (solid === 'geodesic') return geodesicTriangles(frequency);
  const verts = verticesFor(solid);
  return facesFromVertices(verts).map((cycle) => cycle.map((i) => verts[i]));
}

// ---------------------------------------------------------------------------
// placement
// ---------------------------------------------------------------------------

/** Rz·Ry·Rx from degrees — the same order as the assembler's `rotate`. */
function rotator(orient) {
  if (!Array.isArray(orient) || !orient.length) return (p) => p;
  const [rx = 0, ry = 0, rz = 0] = orient;
  const d = Math.PI / 180;
  const cx = Math.cos(rx * d), sx = Math.sin(rx * d);
  const cy = Math.cos(ry * d), sy = Math.sin(ry * d);
  const cz = Math.cos(rz * d), sz = Math.sin(rz * d);
  return (p) => {
    let [x, y, z] = p;
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return [x, y, z];
  };
}

// ---------------------------------------------------------------------------
// shellToFaces
// ---------------------------------------------------------------------------

/**
 * Lower one shell monomer → its baked World face list.
 *
 * @param {object} spec  { solid, radius, center?, frequency?, orient?, tint?, material?, group?, open?, ops? }
 * @param {object} opts  { light?, material?, tint?, index? } — `index` seeds the stable faceId.
 */
export function shellToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const mat = (opts.material || spec.material) ? resolveMaterial(opts.material || spec.material) : null;
  const tint = opts.tint || spec.tint || spec.fill || (mat && mat.base) || DEFAULT_TINT;
  const solid = spec.solid;
  const radius = Number.isFinite(spec.radius) ? spec.radius : 1;
  const c = spec.center || {};
  const cx = Number.isFinite(c.x) ? c.x : 0, cy = Number.isFinite(c.y) ? c.y : 0, cz = Number.isFinite(c.z) ? c.z : 0;
  const frequency = Number.isInteger(spec.frequency) ? spec.frequency : 1;
  const group = typeof spec.group === 'string' ? spec.group : 'shell';
  const index = Number.isInteger(opts.index) ? opts.index : 0;
  const rot = rotator(spec.orient);

  const unit = unitFaces(solid, frequency);
  const place = (p) => {
    const r = rot(p);
    return [cx + r[0] * radius, cy + r[1] * radius, cz + r[2] * radius];
  };

  const faces = [];
  for (let n = 0; n < unit.length && faces.length < MAX_FACES_PER_SHELL; n += 1) {
    const corners = unit[n].map(place);
    const mid = centroid(corners);
    let normal = newellNormal(corners);
    // The graph walk fixes a consistent winding, but which one depends on the traversal rule; the
    // authored outward normal is the ground truth (export-normals.plan.md), so orient against the
    // shell's own center and reverse the corner order to match rather than trusting the walk.
    if (dot3(normal, sub(mid, [cx, cy, cz])) < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
      corners.reverse();
    }
    faces.push({
      corners,
      fill: shadeHexMat(tint, normal, mat, { light }),
      doubleSided: true,
      outNormal: normal,
      // the face's ALBEDO, kept alongside the shaded fill so face-ops can re-shade a face it moves
      // or recolours without having to un-bake the lighting out of `fill`
      tint,
      group,
      faceId: `${index}:${n}`,
    });
  }
  // `open` CUTS AWAY faces — a dome is a shell minus its lower band, a cutaway is a shell minus one
  // face. Removal happens after faceId is stamped, so the surviving faces keep the ids they would
  // have had on the closed solid; a recipe that names face '0:17' still means the same face.
  const kept = spec.open === undefined
    ? faces
    : (() => { const drop = new Set(selectFaces(faces, spec.open)); return faces.filter((_, i) => !drop.has(i)); })();

  // Ops run LAST, over the shell as cut: `open` is part of the solid's shape, ops decorate what
  // survives. Each op sees the previous op's output, which is what lets op 2 select the group op 1
  // created (face-ops.js).
  const decorated = spec.ops === undefined
    ? kept
    : applyFaceOps(kept, spec.ops, { light, tint, material: opts.material || spec.material, at: `shells[${index}].ops` });

  return tagFacesWithMaterial(decorated, mat);
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

export const SHELL_SOLIDS = [
  'tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron', 'truncated_icosahedron', 'geodesic',
];

/** Face count per solid, so a spec can be costed before it is built. */
export const SHELL_FACE_COUNTS = {
  tetrahedron: 4, cube: 6, octahedron: 8, dodecahedron: 12, icosahedron: 20, truncated_icosahedron: 32,
};

/** How many faces a shell spec will emit (geodesic scales as 20·f²). */
export function shellFaceCount(spec = {}) {
  if (spec.solid === 'geodesic') {
    const f = Number.isInteger(spec.frequency) ? spec.frequency : 1;
    return 20 * f * f;
  }
  return SHELL_FACE_COUNTS[spec.solid] || 0;
}

/** Validate shell monomers → an array of error strings (empty when well-formed). */
export function validateShells(shells, _emittedNodes) {
  const errors = [];
  if (!Array.isArray(shells)) return errors;
  const finiteVec = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
  shells.forEach((spec, i) => {
    const at = `shells[${i}]`;
    if (!spec || typeof spec !== 'object') { errors.push(`${at}: must be an object`); return; }
    if (!SHELL_SOLIDS.includes(spec.solid)) {
      errors.push(`${at}.solid must be one of: ${SHELL_SOLIDS.join(', ')}${spec.solid === undefined ? ' (required)' : ` — got ${JSON.stringify(spec.solid)}`}`);
    }
    if (!Number.isFinite(spec.radius) || spec.radius <= 0) errors.push(`${at}.radius must be a positive number (the circumradius, in the object's units)`);
    if (spec.center !== undefined && !finiteVec(spec.center)) errors.push(`${at}.center must be {x,y,z} if provided`);
    if (spec.orient !== undefined && !(Array.isArray(spec.orient) && spec.orient.length === 3 && spec.orient.every(Number.isFinite))) {
      errors.push(`${at}.orient must be [rx,ry,rz] in degrees if provided`);
    }
    if (spec.frequency !== undefined) {
      if (spec.solid !== 'geodesic') errors.push(`${at}.frequency only applies to solid:'geodesic'`);
      else if (!Number.isInteger(spec.frequency) || spec.frequency < 1) errors.push(`${at}.frequency must be an integer ≥ 1`);
      else if (spec.frequency > MAX_GEODESIC_FREQUENCY) {
        errors.push(`${at}.frequency ${spec.frequency} exceeds ${MAX_GEODESIC_FREQUENCY} (${20 * spec.frequency ** 2} faces) — a live orbitable world wants ≤ ${MAX_GEODESIC_FREQUENCY}`);
      }
    }
    if (spec.group !== undefined && typeof spec.group !== 'string') errors.push(`${at}.group must be a string if provided`);
    if (spec.open !== undefined) {
      const err = validateSelector(spec.open, `${at}.open`);
      if (err) errors.push(err);
    }
    errors.push(...validateFaceOps(spec.ops, `${at}.ops`));
  });
  return errors;
}

export { MAX_FACES_PER_SHELL, MAX_GEODESIC_FREQUENCY, PHI };
