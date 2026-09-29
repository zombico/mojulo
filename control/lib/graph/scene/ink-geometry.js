/**
 * ink-geometry — the toon-ink BUILDERS as plain node-side functions (shader-look plan phase 3).
 *
 * The World page's toon-ink channel (channels/toon-ink.js) computes an inverted-hull silhouette and
 * crease lines in-page, from strings it emits. This module is the same construction as importable code,
 * for the paths that must BAKE the outline into real geometry — the GLB export's `toon.bake` — so an
 * engine import gets the outline with no shader at all. Semantics mirror the channel line for line:
 *
 *   • welded outward normals: per-vertex normals summed over the same quantized position (quantum above
 *     the emitter's ~1e-3 decollide nudge), normalized — the shell stays continuous across the soup.
 *   • per-triangle winding is REWRITTEN to agree with the outward geometric normal; degenerate twins
 *     (a cap quad's repeated centre corner) drop out of the hull and the edge census.
 *   • crease census over the winding-fixed triangles: an edge whose two faces meet past `crease`
 *     degrees, plus every open boundary, becomes a line segment.
 *
 * Two bake-time differences from the live channel, both because engines have no vertex-shader push and
 * no polygon offset here: the hull is pushed by a FIXED `width` at bake (the live-width dial stays a
 * World-page affordance), and the line segments are lifted `lineLift` along the welded normal so they
 * clear the fill without the channel's polygonOffset trick. The baked hull's winding is FLIPPED so a
 * single-sided material culls its camera-facing side — the glTF equivalent of the channel's BackSide.
 *
 * A third, for the HAIR (the draw layers, channels/draw-layers.js): the World page draws a hair hull only
 * where the stencil says the nearest fill is not hair, so no line runs between two locks. A baked hull is
 * plain geometry an engine draws in its own pass, with no stencil to read — the bake cannot say "not over
 * hair". What it can do is leave out the hull of the hair that lies INSIDE another hair part (inkBuried:
 * a lock's root sunk into the cap, a section pressed into the one under it), whose inflated shell pokes
 * out of the other part as a ring or a band of ink; inkBake's `skip` drops those triangles' hull. A lock
 * standing off another lock still draws its line over it in an engine: that is the difference.
 *
 * Pure and deterministic: functions of the input soup alone.
 */

const hyp = Math.hypot;

/** centroid of a position soup [x,y,z, x,y,z, …] */
export function inkCentroid(pos) {
  let x = 0, y = 0, z = 0; const n = pos.length / 3 || 1;
  for (let i = 0; i < pos.length; i += 3) { x += pos[i]; y += pos[i + 1]; z += pos[i + 2]; }
  return [x / n, y / n, z / n];
}

/** winding-derived flat normals per corner; with `center`, oriented away from it (the rig-part fallback) */
export function inkGeoNormals(pos, center) {
  const out = new Float32Array(pos.length);
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2];
    const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2];
    let gx = ay * bz - az * by, gy = az * bx - ax * bz, gz = ax * by - ay * bx;
    const l = hyp(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
    if (center) {
      const cx = (pos[t] + pos[t + 3] + pos[t + 6]) / 3 - center[0], cy = (pos[t + 1] + pos[t + 4] + pos[t + 7]) / 3 - center[1], cz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3 - center[2];
      if (gx * cx + gy * cy + gz * cz < 0) { gx = -gx; gy = -gy; gz = -gz; }
    }
    for (let k = 0; k < 9; k += 3) { out[t + k] = gx; out[t + k + 1] = gy; out[t + k + 2] = gz; }
  }
  return out;
}

const posKey = (pos, i, q) => `${Math.round(pos[i] / q)},${Math.round(pos[i + 1] / q)},${Math.round(pos[i + 2] / q)}`;

/** welded outward normal per vertex: the soup's normals summed per quantized position, normalized */
export function inkWeldNormals(pos, nrm, q) {
  const acc = new Map(), n = pos.length / 3, out = new Float32Array(pos.length);
  for (let i = 0; i < n; i++) {
    const k = posKey(pos, i * 3, q); let a = acc.get(k); if (!a) { a = [0, 0, 0]; acc.set(k, a); }
    a[0] += nrm[i * 3]; a[1] += nrm[i * 3 + 1]; a[2] += nrm[i * 3 + 2];
  }
  for (let i = 0; i < n; i++) {
    const a = acc.get(posKey(pos, i * 3, q)); const l = hyp(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  return out;
}

/**
 * Bake the ink pair for one soup. → { hullPos, linePos, hullSrc, lineSrc }
 *   hullPos — the winding-fixed triangles, every vertex pushed `width` along its welded normal, then the
 *             winding FLIPPED (single-sided material ⇒ the shell shows only past the silhouette).
 *   linePos — crease + open-boundary segments (pairs of points), lifted `lineLift` along the weld;
 *             EMPTY under `lines: false` (the silhouette-only ink: the channel's cfg of the same name).
 *   hullSrc/lineSrc — for every emitted corner/point, the SOURCE corner index (pos index / 3), so a
 *             skinned caller can carry joints/weights through the reorder.
 * `skip` (a flag per source triangle, e.g. inkBuried's): a flagged triangle gives no hull (it still welds and
 * still counts in the crease census, so its neighbours' shell and lines are the ones without it).
 */
export function inkBake(pos, nrm, { width = 0, crease = 35, q = 1e-3, lineLift = null, lines = true, skip = null } = {}) {
  const wn = inkWeldNormals(pos, nrm, q);
  const lift = lineLift == null ? width * 0.35 : lineLift;
  const cosCrease = Math.cos((crease * Math.PI) / 180);
  const edges = new Map(); const segs = [];
  const hull = []; const hullSrc = [];
  for (let t = 0; t < pos.length; t += 9) {
    const ax = pos[t + 3] - pos[t], ay = pos[t + 4] - pos[t + 1], az = pos[t + 5] - pos[t + 2];
    const bx = pos[t + 6] - pos[t], by = pos[t + 7] - pos[t + 1], bz = pos[t + 8] - pos[t + 2];
    let gx = ay * bz - az * by, gy = az * bx - ax * bz, gz = ax * by - ay * bx;
    const gl = hyp(gx, gy, gz);
    if (gl < q * q) continue;   // degenerate twin: no hull, no edges
    gx /= gl; gy /= gl; gz /= gl;
    const d = gx * (wn[t] + wn[t + 3] + wn[t + 6]) + gy * (wn[t + 1] + wn[t + 4] + wn[t + 7]) + gz * (wn[t + 2] + wn[t + 5] + wn[t + 8]);
    if (d < 0) { gx = -gx; gy = -gy; gz = -gz; }
    // channel order [0,3,6]/[0,6,3] makes winding AGREE with outward; the bake flips it (BackSide)
    const order = d < 0 ? [0, 3, 6] : [0, 6, 3];
    if (!(skip && skip[t / 9])) for (let k = 0; k < 3; k++) {
      const s = t + order[k];
      hull.push(pos[s] + wn[s] * width, pos[s + 1] + wn[s + 1] * width, pos[s + 2] + wn[s + 2] * width);
      hullSrc.push(s / 3);
    }
    for (let k = 0; k < 3; k++) {
      const a = t + k * 3, b = t + ((k + 1) % 3) * 3, ka = posKey(pos, a, q), kb = posKey(pos, b, q);
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const seen = edges.get(key);
      if (!seen) { edges.set(key, { a, b, n: [gx, gy, gz], count: 1 }); continue; }
      seen.count++;
      if (seen.count === 2 && seen.n[0] * gx + seen.n[1] * gy + seen.n[2] * gz < cosCrease) segs.push(seen.a, seen.b);
    }
  }
  for (const e of edges.values()) if (e.count === 1) segs.push(e.a, e.b);   // open boundary → contour
  if (lines === false) segs.length = 0;   // the silhouette alone: the census draws nothing
  const linePos = new Float32Array(segs.length * 3); const lineSrc = new Int32Array(segs.length);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    linePos[i * 3] = pos[s] + wn[s] * lift; linePos[i * 3 + 1] = pos[s + 1] + wn[s + 1] * lift; linePos[i * 3 + 2] = pos[s + 2] + wn[s + 2] * lift;
    lineSrc[i] = s / 3;
  }
  return { hullPos: Float32Array.from(hull), linePos, hullSrc: Int32Array.from(hullSrc), lineSrc };
}

/**
 * The HAIR the baked hull leaves out (the stand-in for the World page's stencil rule; see the header): per triangle of
 * a soup, 1 when its centroid lies strictly inside a CLOSED part of the same soup other than its own — a lock's root
 * sunk into the cap, a section pressed into the one under it — else 0. A part is a connected piece of the soup, its
 * triangles joined by EXACT shared corners (a layered part is conforming: its triangles share their corner coordinates
 * bit for bit, so no weld quantum can join two parts that merely come close); a piece with an edge not used exactly
 * twice is open and never contains anything. Inside is the parity of a fixed skew ray's crossings of the part's
 * triangles, tried only where the part's box holds the centroid and on the triangles the ray can reach. Pure;
 * deterministic. → Uint8Array (one per triangle).
 */
export function inkBuried(pos) {
  const nt = Math.floor(pos.length / 9), out = new Uint8Array(nt);
  const up = Int32Array.from({ length: nt }, (_, i) => i);
  const find = (x) => { while (up[x] !== x) { up[x] = up[up[x]]; x = up[x]; } return x; };
  const corner = (i) => `${pos[i]},${pos[i + 1]},${pos[i + 2]}`;
  const keys = [], owner = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const key = corner(t * 9 + k * 3); keys.push(key);
    const o = owner.get(key);
    if (o === undefined) owner.set(key, t); else { const a = find(o), b = find(t); if (a !== b) up[Math.max(a, b)] = Math.min(a, b); }
  }
  const parts = new Map(), partOf = new Int32Array(nt);
  for (let t = 0; t < nt; t++) {
    const r = find(t); partOf[t] = r; let P = parts.get(r);
    if (!P) parts.set(r, P = { tris: [], lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], edges: new Map() });
    P.tris.push(t);
    for (let k = 0; k < 3; k++) {
      const i = t * 9 + k * 3; for (let c = 0; c < 3; c++) { if (pos[i + c] < P.lo[c]) P.lo[c] = pos[i + c]; if (pos[i + c] > P.hi[c]) P.hi[c] = pos[i + c]; }
      const a = keys[t * 3 + k], b = keys[t * 3 + (k + 1) % 3], e = a < b ? `${a}|${b}` : `${b}|${a}`;
      P.edges.set(e, (P.edges.get(e) || 0) + 1);
    }
  }
  const closed = [...parts.entries()].filter(([, P]) => [...P.edges.values()].every((n) => n === 2)).map(([r, P]) => ({ r, tris: P.tris, lo: P.lo, hi: P.hi }));
  if (closed.length === 0) return out;
  const D0 = 0.5773, D1 = 0.5801, D2 = 0.5746;   // a skew ray: no lattice direction, so a hit on an edge or a vertex is unlikely
  // each triangle's box top: the ray runs toward +x, +y and +z, so a triangle lying wholly below the centroid on one
  // axis (by more than a margin far past the arithmetic's rounding) is never crossed at s > 0 and is not tried
  const mx = new Float64Array(nt), my = new Float64Array(nt), mz = new Float64Array(nt), MARGIN = 1e-7;
  for (let t = 0; t < nt; t++) { const i = t * 9; mx[t] = Math.max(pos[i], pos[i + 3], pos[i + 6]); my[t] = Math.max(pos[i + 1], pos[i + 4], pos[i + 7]); mz[t] = Math.max(pos[i + 2], pos[i + 5], pos[i + 8]); }
  const crosses = (ox, oy, oz, t) => {   // Möller–Trumbore, the ray o + s·D for s > 0 (scalars: nothing allocated per test)
    const i = t * 9, e1x = pos[i + 3] - pos[i], e1y = pos[i + 4] - pos[i + 1], e1z = pos[i + 5] - pos[i + 2], e2x = pos[i + 6] - pos[i], e2y = pos[i + 7] - pos[i + 1], e2z = pos[i + 8] - pos[i + 2];
    const px = D1 * e2z - D2 * e2y, py = D2 * e2x - D0 * e2z, pz = D0 * e2y - D1 * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-18) return false;
    const inv = 1 / det, tx = ox - pos[i], ty = oy - pos[i + 1], tz = oz - pos[i + 2], u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (D0 * qx + D1 * qy + D2 * qz) * inv;
    if (v < 0 || u + v > 1) return false;
    return (e2x * qx + e2y * qy + e2z * qz) * inv > 0;
  };
  for (let t = 0; t < nt; t++) {
    const i = t * 9, cx = (pos[i] + pos[i + 3] + pos[i + 6]) / 3, cy = (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3, cz = (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
    const lx = cx - MARGIN, ly = cy - MARGIN, lz = cz - MARGIN;
    for (const P of closed) {
      if (P.r === partOf[t] || cx < P.lo[0] || cx > P.hi[0] || cy < P.lo[1] || cy > P.hi[1] || cz < P.lo[2] || cz > P.hi[2]) continue;
      let n = 0; for (const u of P.tris) if (mx[u] >= lx && my[u] >= ly && mz[u] >= lz && crosses(cx, cy, cz, u)) n++;
      if (n % 2) { out[t] = 1; break; }
    }
  }
  return out;
}
