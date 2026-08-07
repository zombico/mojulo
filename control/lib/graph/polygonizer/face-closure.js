/**
 * face-closure — a watertightness lint for baked workbench face lists.
 *
 * The workbench primitives are SURFACE modelers: each *ToFaces (lathe/extrude/sweep/relief)
 * emits a shell — a skin of quads — never a filled volume. A shell is watertight only if every
 * opening is capped, and caps are optional (`caps:false`), radius-gated (an end below
 * CAP_MIN_RADIUS gets none), or intentionally absent (an extrude shell's `openFace`, a drape
 * sheet). Nothing downstream checks closure, so a dropped cap ships as a SILENT hole: the object
 * "3D-prints with no surface" and you see straight through it. Because every face is
 * `doubleSided`, that gap is a real missing surface, not a culled back-face — which is exactly
 * why it is invisible until a render catches it from the wrong angle.
 *
 * findOpenBoundaries walks a face list, welds vertices by position, and counts how many faces use
 * each undirected edge. On a closed manifold every edge is shared by exactly two faces; an edge
 * used once is a BOUNDARY edge — it traces the rim of a hole. Boundary edges are grouped into
 * connected loops and measured, so the mint can warn "this monomer is an open shell" WITH the size
 * of the hole, instead of the operator discovering it in a render→view loop.
 *
 * Pure geometry: no three.js, no DOM, unit-testable in node. Sibling of the *ToFaces bakers it
 * audits (lathe-faces.js, extrude-faces.js, sweep-faces.js, relief-faces.js).
 */

// Mirrors lathe-faces.CAP_MIN_RADIUS: an end ring narrower than this is treated as a self-closing
// pole (R→0) and legitimately gets no cap. A boundary loop this small is that pole, not a hole.
const POLE_RADIUS = 0.08;

// A boundary loop narrower than this (world units) reads as a seam / pole / weld artifact, not a
// "you can see through it" hole — below the size any operator would notice as a missing surface.
// The significant-hole floor is max(this, a small fraction of the object) so it also scales up on
// large parts (a 12cm gap in a 200cm wall matters; a 0.3cm one does not).
const MIN_VISIBLE_HOLE = 0.4;

/** Axis-aligned extent of a face list → a weld tolerance that scales with the chosen units. */
function weldEpsilon(faces) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    for (const c of f.corners) {
      for (let k = 0; k < 3; k += 1) {
        if (c[k] < min[k]) min[k] = c[k];
        if (c[k] > max[k]) max[k] = c[k];
      }
    }
  }
  const diag = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  // Loose enough to absorb float error on points meant to coincide (ring seam ends, cap centres),
  // tight enough to stay well under the smallest real feature (a pole ring at POLE_RADIUS).
  return { eps: Math.max(1e-5, diag * 1e-5), diag };
}

/** Bounding-box diameter + centre of a set of welded vertices (by position key). */
function loopSpan(vertexKeys, pos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const k of vertexKeys) {
    const p = pos.get(k);
    for (let i = 0; i < 3; i += 1) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  return {
    diameter: Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
  };
}

/** Group boundary edges into connected components (holes), each measured + sorted widest-first. */
function groupLoops(boundary, pos) {
  const adj = new Map(); // vertex key → incident boundary edges
  for (const e of boundary) {
    for (const v of [e.a, e.b]) {
      if (!adj.has(v)) adj.set(v, []);
      adj.get(v).push(e);
    }
  }
  const seen = new Set();
  const loops = [];
  for (const start of boundary) {
    if (seen.has(start)) continue;
    const stack = [start];
    const verts = new Set();
    let edgeCount = 0;
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      edgeCount += 1;
      for (const v of [cur.a, cur.b]) {
        verts.add(v);
        for (const ne of adj.get(v)) if (!seen.has(ne)) stack.push(ne);
      }
    }
    const { diameter, center } = loopSpan([...verts], pos);
    loops.push({ edgeCount, diameter, center });
  }
  loops.sort((a, b) => b.diameter - a.diameter);
  return loops;
}

/**
 * findOpenBoundaries(faces) → { closed, boundaryEdgeCount, loops, diag }.
 *
 * `closed` is true when every welded edge is shared by exactly two faces (watertight). Otherwise
 * `loops` lists each open rim (a hole) with its `diameter` (world units) + `center`, widest first.
 * Degenerate edges (a fan-cap's repeated centre corner, a collapsed cell) are skipped, so they
 * never masquerade as boundaries.
 */
export function findOpenBoundaries(faces) {
  const list = Array.isArray(faces) ? faces.filter((f) => f && Array.isArray(f.corners) && f.corners.length >= 3) : [];
  if (!list.length) return { closed: true, boundaryEdgeCount: 0, loops: [], diag: 0 };
  const { eps, diag } = weldEpsilon(list);
  const pos = new Map(); // key → representative [x,y,z]
  const keyOf = (v) => {
    const k = `${Math.round(v[0] / eps)},${Math.round(v[1] / eps)},${Math.round(v[2] / eps)}`;
    if (!pos.has(k)) pos.set(k, v);
    return k;
  };
  const edges = new Map(); // "a|b" (sorted keys) → { count, a, b }
  for (const f of list) {
    const ks = f.corners.map(keyOf);
    const n = ks.length;
    for (let i = 0; i < n; i += 1) {
      const a = ks[i];
      const b = ks[(i + 1) % n];
      if (a === b) continue; // degenerate edge (zero length after welding)
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      const e = edges.get(ek);
      if (e) e.count += 1;
      else edges.set(ek, { count: 1, a, b });
    }
  }
  const boundary = [];
  for (const e of edges.values()) if (e.count === 1) boundary.push(e);
  if (!boundary.length) return { closed: true, boundaryEdgeCount: 0, loops: [], diag };
  return { closed: false, boundaryEdgeCount: boundary.length, loops: groupLoops(boundary, pos), diag };
}

/**
 * auditClosure(faces, opts) → { closed, holes, boundaryEdgeCount }.
 *
 * The mint-facing verdict: filters findOpenBoundaries' raw rims down to SIGNIFICANT holes — a rim
 * wider than a self-closing pole and than a small fraction of the object — so a spindle tapering to
 * a sub-threshold tip (a legitimate uncapped R→0 end) is not mistaken for a defect.
 *
 * @param {object} opts.intendClosed  when false (a drape sheet, an open-face shell) the surface is
 *   meant to be open — returns `{ closed:true, holes:[] }` without flagging anything.
 * @param {number} opts.threshold  override the significant-hole floor (world units).
 */
export function auditClosure(faces, { intendClosed = true, threshold } = {}) {
  if (!intendClosed) return { closed: true, holes: [], boundaryEdgeCount: 0 };
  const r = findOpenBoundaries(faces);
  if (r.closed) return { closed: true, holes: [], boundaryEdgeCount: 0 };
  const floor = Number.isFinite(threshold) ? threshold : Math.max(MIN_VISIBLE_HOLE, (r.diag || 1) * 0.06);
  const holes = r.loops.filter((l) => l.diameter >= floor);
  return { closed: holes.length === 0, holes, boundaryEdgeCount: r.boundaryEdgeCount };
}

export { POLE_RADIUS };
