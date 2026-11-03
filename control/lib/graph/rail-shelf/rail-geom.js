/**
 * rail-geom — the rail shelf's geometry and finish, shared by its compilers (cab-surface.js, bogie-surface.js): faces
 * whose normals are turned out and whose corners are wound to them, boxes, prisms, discs and solids of revolution, the
 * materials a part is made of and the finish that smooths a material's corners within its creases. Pure.
 */
import { VEHICLE_MATERIALS } from '../car-designer/vehicle-surface-finish.js';

export const RAIL_MATERIALS = Object.freeze({ ...VEHICLE_MATERIALS, sign: Object.freeze({ metalness: 0, roughness: 0.35, emissive: '#ffb23e', emissiveIntensity: 0.9 }) });
export const r4 = (x) => Math.round(x * 10000) / 10000 + 0;
export const P3 = (p) => p.map(r4);
export const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map((v) => v * k);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i += 1) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; };
// (a face, its repeated corners dropped, its normal turned out from `from`: a point inside the thing it is part of)
export function face(corners, part, from, normal) {
  const c = corners.map(P3).filter((p, i, a) => i === 0 || p.some((v, k) => v !== a[i - 1][k]));
  if (c.length > 2 && c[0].every((v, k) => v === c.at(-1)[k])) c.pop();
  if (c.length < 3) return null;
  let n = normal ? unit(normal) : unit(newell(c));
  if (!normal && Math.hypot(...newell(c)) < 1e-9) return null;
  const mid = [0, 1, 2].map((k) => c.reduce((t, p) => t + p[k], 0) / c.length);
  if (!normal && dot(n, sub(mid, from)) < 0) n = mul(n, -1);
  // (corners wound to the normal: counter-clockwise seen from outside)
  if (dot(unit(newell(c)), n) < 0) c.reverse();
  return { corners: c, part, outNormal: n.map(r4) };
}
// (a box: its six faces turned out from its centre)
export function box(out, [x0, x1], [y0, y1], [z0, z1], part) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const v = (i, j, k) => [[x0, x1][i], [y0, y1][j], [z0, z1][k]];
  for (const q of [[v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)], [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)],
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)], [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)]]) {
    const f = face(q, part, c); if (f) out.push(f);
  }
}
// (a prism along an axis: its n-gon ends and its sides, turned out from its axis)
export function cylinder(out, a, b, r, n, part, { caps = true } = {}) {
  const ax = unit(sub(b, a)), t1 = unit(Math.abs(ax[2]) < 0.9 ? cross(ax, [0, 0, 1]) : cross(ax, [1, 0, 0])), t2 = cross(ax, t1);
  const ring = (c) => Array.from({ length: n }, (_, i) => { const q = (2 * Math.PI * i) / n; return add(c, add(mul(t1, r * Math.cos(q)), mul(t2, r * Math.sin(q)))); });
  const A = ring(a), B = ring(b), mid = mul(add(a, b), 0.5);
  for (let i = 0; i < n; i += 1) { const j = (i + 1) % n, f = face([A[i], A[j], B[j], B[i]], part, mid); if (f) out.push(f); }
  if (caps) { const fa = face(A, part, mid), fb = face(B, part, mid); if (fa) out.push(fa); if (fb) out.push(fb); }
}
// (a disc lying on a surface at p, its normal n, `off` proud of it)
export function disc(out, p, n, r, part, off, k = 12) {
  const t1 = unit(cross(n, [0, 0, 1])), t2 = cross(t1, n), c = add(p, mul(n, off));
  const f = face(Array.from({ length: k }, (_, i) => { const q = (2 * Math.PI * i) / k; return add(c, add(mul(t1, r * Math.cos(q)), mul(t2, r * Math.sin(q)))); }), part, null, n);
  if (f) out.push(f);
}

/**
 * A solid of revolution about an axis along x (at y0, z0), or the vertical (`axis: 'z'` through `at`): its profile [[x, r]…]
 * (x along the axis, r out from it), a
 * closed polygon, revolved in n steps from the angle a0; `sx` mirrors it across x = 0 (a left wheel); each edge its
 * part (`partOf(i)`), each face its normal from its edge's own outward normal.
 */
export function revolve(out, profile, { y0 = 0, z0 = 0, sx = 1, n = 16, a0 = 0, partOf, axis = 'x', at: centre = [0, 0] }) {
  let P = profile;
  const area = P.reduce((t, p, i) => { const q = P[(i + 1) % P.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0);
  const flip = area < 0;
  if (flip) P = P.slice().reverse();
  // (about x through (y0, z0); or, `axis: 'z'`, about the vertical through `at`, the profile's x its height)
  const Zx = axis === 'z', at = (x, r, a) => (Zx ? [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), x] : [sx * x, y0 + r * Math.cos(a), z0 + r * Math.sin(a)]);
  for (let i = 0; i < P.length; i += 1) {
    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], er = b[1] - a[1], l = Math.hypot(ex, er) || 1, nx = er / l, nr = -ex / l;
    if (Math.max(a[1], b[1]) < 1e-6) continue;
    const part = partOf(flip ? P.length - 1 - ((i + 1) % P.length) : i);
    for (let j = 0; j < n; j += 1) {
      const t0 = a0 + (2 * Math.PI * j) / n, t1 = a0 + (2 * Math.PI * (j + 1)) / n, tm = (t0 + t1) / 2;
      const f = face([at(a[0], a[1], t0), at(b[0], b[1], t0), at(b[0], b[1], t1), at(a[0], a[1], t1)], part, null, Zx ? [nr * Math.cos(tm), nr * Math.sin(tm), nx] : [sx * nx, nr * Math.cos(tm), nr * Math.sin(tm)]);
      if (f) out.push(f);
    }
  }
}

// a part's material (the vehicle ODM's where it names one, the rail shelf's own over it)
const OWN = { sign: 'sign', coupler: 'alloy', buffer: 'alloy', anticlimber: 'alloy', pilot: 'carbon', wiper: 'carbon', 'body.mask': 'carbon', 'glass.frame': 'seal', pillar: 'carbon',
  wheel: 'alloy', axle: 'alloy', gangway: 'rubber', underframe: 'seal', grille: 'carbon', seam: 'seal', 'lamp.bezel': 'carbon', headlamp: 'lamp', taillamp: 'tail',
  'wheel.tread': 'alloy', 'wheel.mark': 'paint', 'brake.disc': 'brake', 'bogie.air': 'rubber', 'bogie.chevron': 'rubber', damper: 'paint',
  'panto.arm': 'alloy', 'panto.rod': 'alloy', 'panto.frame': 'alloy', 'panto.head': 'alloy', 'panto.horn': 'alloy', 'panto.strip': 'carbon', 'panto.drive': 'seal', 'panto.wheel': 'alloy', 'panto.insulator': 'paint',
  'catenary.wire': 'alloy', 'catenary.messenger': 'alloy', 'catenary.arm': 'alloy', 'catenary.mast': 'seal', 'catenary.insulator': 'paint' };
export function railMaterial(part) {
  if (OWN[part]) return OWN[part];
  if (/^bogie\./.test(part)) return 'seal';
  if (/^glass\./.test(part)) return 'glass';
  return 'paint';
}
function shade(hex, n) {
  const k = 0.64 + 0.42 * Math.max(0, dot(n, [0.35, 0.25, 0.902]));
  return '#' + hex.slice(1).match(/../g).map((h) => Math.min(255, Math.round(parseInt(h, 16) * k)).toString(16).padStart(2, '0')).join('');
}
/** Crease-aware corner normals within a material, its baked fallback colour; the paint it is given kept as `albedo`. */
export function finishRailFaces(faces) {
  const mats = faces.map((f) => railMaterial(f.part)), verts = new Map(), key = (i, p) => `${mats[i]}:${p.join(',')}`;
  faces.forEach((f, i) => { for (const p of f.corners) { const k = key(i, p); if (!verts.has(k)) verts.set(k, []); verts.get(k).push(i); } });
  const crease = Math.cos((40 * Math.PI) / 180);
  return faces.map((f, i) => {
    const cn = f.corners.map((p) => unit(verts.get(key(i, p)).filter((j) => dot(faces[i].outNormal, faces[j].outNormal) > crease).reduce((s, j) => add(s, faces[j].outNormal), [0, 0, 0])).map(r4));
    const lit = ['lamp', 'tail', 'sign'].includes(mats[i]);
    return { ...f, albedo: f.fill, material: mats[i], cornerNormals: cn, fill: lit ? f.fill : shade(f.fill, f.outNormal), cornerFills: cn.map((n) => (lit ? f.fill : shade(f.fill, n))) };
  });
}

