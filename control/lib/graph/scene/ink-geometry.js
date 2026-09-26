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
 *   linePos — crease + open-boundary segments (pairs of points), lifted `lineLift` along the weld.
 *   hullSrc/lineSrc — for every emitted corner/point, the SOURCE corner index (pos index / 3), so a
 *             skinned caller can carry joints/weights through the reorder.
 */
export function inkBake(pos, nrm, { width = 0, crease = 35, q = 1e-3, lineLift = null } = {}) {
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
    for (let k = 0; k < 3; k++) {
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
  const linePos = new Float32Array(segs.length * 3); const lineSrc = new Int32Array(segs.length);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    linePos[i * 3] = pos[s] + wn[s] * lift; linePos[i * 3 + 1] = pos[s + 1] + wn[s + 1] * lift; linePos[i * 3 + 2] = pos[s + 2] + wn[s + 2] * lift;
    lineSrc[i] = s / 3;
  }
  return { hullPos: Float32Array.from(hull), linePos, hullSrc: Int32Array.from(hullSrc), lineSrc };
}
