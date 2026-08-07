/**
 * Douglas-Peucker polyline simplification.
 *
 * Recursively drops vertices whose perpendicular distance to the segment
 * spanning their neighbours falls under `tolerance` (in the input's coordinate
 * units). The map pipeline calls this BEFORE projection, so tolerance is in
 * source degrees — see project.js for how the helper converts a target
 * screen-pixel budget into a degree tolerance.
 *
 * Closed rings (first === last point) are preserved as closed; the closing
 * point is re-attached after the open-ring simplification. A ring with < 4
 * raw points (3 distinct + the closing duplicate) passes through unchanged —
 * it is already at the minimum the polygon validator accepts.
 */

function perpDistanceSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return ex * ex + ey * ey;
  }
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  const ex = p[0] - projX;
  const ey = p[1] - projY;
  return ex * ex + ey * ey;
}

function simplifyOpen(points, toleranceSq) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let maxDist = 0;
    let maxIdx = -1;
    const a = points[lo];
    const b = points[hi];
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDistanceSq(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > toleranceSq) {
      keep[maxIdx] = 1;
      stack.push([lo, maxIdx], [maxIdx, hi]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

function isClosed(points) {
  if (points.length < 2) return false;
  const a = points[0];
  const b = points[points.length - 1];
  return a[0] === b[0] && a[1] === b[1];
}

export function simplifyRing(points, tolerance) {
  if (!Array.isArray(points)) throw new Error('simplifyRing: points must be an array');
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error('simplifyRing: tolerance must be a non-negative finite number');
  }
  const closed = isClosed(points);
  const open = closed ? points.slice(0, -1) : points.slice();
  if (closed && open.length <= 3) {
    return open.concat([open[0]]);
  }
  if (!closed && open.length < 3) {
    return open;
  }
  const toleranceSq = tolerance * tolerance;
  const simplified = simplifyOpen(open, toleranceSq);
  if (closed) {
    if (simplified.length < 3) return open.concat([open[0]]);
    return simplified.concat([simplified[0]]);
  }
  return simplified;
}
