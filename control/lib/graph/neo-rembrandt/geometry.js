export function centroid(points) {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) {
    const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}

export function bbox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function normalize([x, y]) {
  const len = Math.hypot(x, y);
  if (len < 1e-9) return [0, -1];
  return [x / len, y / len];
}

export function scaleToward(points, center, factor) {
  const [cx, cy] = center;
  return points.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor]);
}

export function dot([ax, ay], [bx, by]) {
  return ax * bx + ay * by;
}

export function clipHalfPlane(points, normal, offset, keepPositive = true) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const out = [];
  const inside = (p) => {
    const d = dot(normal, p) - offset;
    return keepPositive ? d >= -1e-9 : d <= 1e-9;
  };

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const aIn = inside(a);
    const bIn = inside(b);
    if (aIn && bIn) out.push(b);
    else if (aIn && !bIn) out.push(intersection(a, b, normal, offset));
    else if (!aIn && bIn) {
      out.push(intersection(a, b, normal, offset));
      out.push(b);
    }
  }
  return dedupe(out);
}

export function clipBand(points, normal, centerPoint, halfWidth) {
  const center = dot(normal, centerPoint);
  const low = clipHalfPlane(points, normal, center - halfWidth, true);
  return clipHalfPlane(low, normal, center + halfWidth, false);
}

export function bottomPoint(points) {
  return points.reduce((best, p) => (p[1] > best[1] ? p : best), points[0]);
}

function intersection(a, b, normal, offset) {
  const da = dot(normal, a) - offset;
  const db = dot(normal, b) - offset;
  const t = da / (da - db);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function dedupe(points) {
  const out = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev[0] - p[0], prev[1] - p[1]) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-6) out.pop();
  }
  return out;
}
