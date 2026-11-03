/**
 * THE MILITARY HULL KIT: the solids a field vehicle is built from in the form render (road-form.js), in the hard-surface
 * manner. A field vehicle is flat plates, bent tube and fittings bolted and welded on, so the kit draws exactly those,
 * each face with its material and its corner normals worked out, not averaged:
 *
 *   plate     a convex section extruded along an axis, every edge rounded by `r` (the Minkowski sum of a smaller prism
 *             and a sphere, `seg` steps a quarter turn). Its flat faces keep their own normal to the corner, and its
 *             rounds turn through the exact normals, so a big flat panel reads flat and its edge catches a line of
 *             light, the way a real plate's rolled edge does. A rounded face is tagged `edge: true` (what the wear
 *             reads, the chips and the polish)
 *   tube      a polyline swept by a circle (`sides`), its bends rounded (`bend`), radial normals, its ends capped: the
 *             roll bar, a grab handle, a guard, a whip's mount
 *   bolts     hex heads on a surface, `h` proud
 *   weld      a bead along a seam: two faces a step, rippled as a run of tacks is, on the surface it joins
 *   slab      armour: a convex solid cut by the planes of its outline seen from the front, the side and above (the
 *             intersection of the three prisms), each face flat, every edge sharper than `crease` chamfered, `chamfer`
 *             taken off each face it joins (a narrow flat face, tagged `edge: true`, that catches a line of light as a cut plate's edge does)
 *
 *   plate({ axis, profile, from, to, r?, seg?, look })      → faces
 *   tube(points, radius, { sides?, look, caps?, smooth? })  → faces
 *   bend(points, radius, steps?)                            → the polyline with each inner corner rounded
 *   bolts(points, n, { r?, h?, look })                      → faces
 *   weld(a, b, n, { w?, h?, step?, look })                  → faces
 *   slab({ front, side, plan?, chamfer?, crease?, look })   → faces; front [[x, z]…], side [[y, z]…], plan [[x, y]…],
 *                                                             each convex; look(tag) with tag { view, i, n, edge } (the
 *                                                             view and the outline's edge a face lies on; null: left off)
 *   flatNormals(faces)                                      → each face without corner normals given its own
 *   place(faces, { origin, ex, ey, ez })                    → faces built in a local frame, in vehicle space
 *
 * A look is { part, material, albedo } or a function (role: 'face' | 'edge' | 'cap') → a look (null: left off).
 * axis 'x': the profile is [y, z], extruded across; 'y': [x, z], extruded along; 'z': [x, y] (a plan), extruded up.
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const d = len(a) || 1; return [a[0] / d, a[1] / d, a[2] / d]; };
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const P6 = (p) => p.map(r6);

function newell(c) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return n;
}
const lookOf = (look, role) => (typeof look === 'function' ? look(role) : look);

/** A face from its corners, turned to face `toward`; `normals` (one a corner) turned with it. Null when it has no area. */
export function face(corners, look, toward, normals = null, extra = {}) {
  if (!look) return null;
  const nn = newell(corners);
  if (len(nn) < 1e-10) return null;
  let n = unit(nn), c = corners, cn = normals;
  if (dot(n, toward) < 0) { n = n.map((v) => -v); c = corners.slice().reverse(); cn = normals ? normals.slice().reverse() : null; }
  return { corners: c.map(P6), part: look.part, material: look.material, albedo: look.albedo, outNormal: n.map(r6), ...(cn ? { cornerNormals: cn.map((v) => unit(v).map(r6)) } : {}), ...extra };
}

/** Each face that carries no corner normals given its own normal at every corner (a flat plate is flat to its edge). */
export function flatNormals(faces) {
  return faces.map((f) => (f.cornerNormals ? f : { ...f, cornerNormals: f.corners.map(() => f.outNormal) }));
}

// ── the plate ───────────────────────────────────────────────────────────────────
const AXES = Object.freeze({
  x: (u, v, w) => [w, u, v],
  y: (u, v, w) => [u, w, v],
  z: (u, v, w) => [u, v, w],
});
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
// a convex polygon offset inward by d (each edge's line moved in, neighbours intersected), or null when it turns over
function offsetIn(P, d) {
  const n = P.length, lines = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], e = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(e[0], e[1]);
    const no = [e[1] / l, -e[0] / l];   // outward, for an anticlockwise polygon
    lines.push({ no, c: no[0] * a[0] + no[1] * a[1] - d, dir: [e[0] / l, e[1] / l] });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = lines[(i - 1 + n) % n], B = lines[i], det = A.no[0] * B.no[1] - A.no[1] * B.no[0];
    if (Math.abs(det) < 1e-12) return null;
    out.push([(A.c * B.no[1] - B.c * A.no[1]) / det, (A.no[0] * B.c - B.no[0] * A.c) / det]);
  }
  // (turned over: an edge of the offset runs against its own)
  for (let i = 0; i < n; i++) {
    const a = out[i], b = out[(i + 1) % n], e = [b[0] - a[0], b[1] - a[1]];
    if (e[0] * lines[i].dir[0] + e[1] * lines[i].dir[1] < 1e-9) return null;
  }
  return { inner: out, normals: lines.map((L) => L.no) };
}

/** A convex section `profile` ([[u, v]…], either winding) extruded along `axis` from `from` to `to`, its every edge
 *  rounded by `r` in `seg` steps a quarter turn (r 0: sharp). */
export function plate({ axis = 'x', profile, from, to, r = 0, seg = 2, look }) {
  const X = AXES[axis];
  if (!X) throw new Error(`mil-hull: a plate's axis is x, y or z (got ${axis})`);
  let P = profile.map((p) => [p[0], p[1]]);
  if (area2(P) < 0) P = P.reverse();
  const [w0, w1] = from < to ? [from, to] : [to, from];
  // (the round no bigger than the plate allows: half its length, and an inner section that does not turn over)
  let rr = Math.max(0, Math.min(r, (w1 - w0) / 2 - 1e-5)), off = null;
  for (let k = 0; k < 12; k++) { off = rr > 0 ? offsetIn(P, rr) : { inner: P, normals: offsetIn(P, 0)?.normals }; if (off && off.normals && Math.abs(area2(off.inner)) > 1e-10) break; rr *= 0.6; off = null; }
  if (!off) { rr = 0; off = { inner: P, normals: offsetIn(P, 0).normals }; }
  const I = off.inner, N = off.normals, n = I.length, steps = rr > 0 ? seg : 0;
  // each corner's arc of directions, from the edge before's normal to its own (anticlockwise)
  const arcs = [];
  for (let i = 0; i < n; i++) {
    const a0 = Math.atan2(N[(i - 1 + n) % n][1], N[(i - 1 + n) % n][0]);
    let da = Math.atan2(N[i][1], N[i][0]) - a0;
    while (da < 0) da += 2 * Math.PI;
    while (da >= 2 * Math.PI) da -= 2 * Math.PI;
    const m = steps ? Math.max(1, Math.ceil((da / (Math.PI / 2)) * steps - 1e-9)) : 0;
    for (let j = 0; j <= m; j++) arcs.push({ i, j, m, t: a0 + (m ? (da * j) / m : 0) });
  }
  // the rings along the axis: the far cap's (rho 0) out to the full section and back
  const rings = [];
  const ringAt = (w, rho, axial) => arcs.map((a) => {
    const d = [Math.cos(a.t), Math.sin(a.t)];
    return { p: X(I[a.i][0] + rho * d[0], I[a.i][1] + rho * d[1], w), n: X(d[0] * (rr ? rho / rr : 1), d[1] * (rr ? rho / rr : 1), axial) };
  });
  if (steps) {
    for (let k = 0; k <= steps; k++) { const f = (Math.PI / 2) * (k / steps); rings.push({ ring: ringAt(w0 + rr * (1 - Math.cos(f)), rr * Math.sin(f), -Math.cos(f)), full: k === steps }); }
    for (let k = steps; k >= 0; k--) { const f = (Math.PI / 2) * (k / steps); rings.push({ ring: ringAt(w1 - rr * (1 - Math.cos(f)), rr * Math.sin(f), Math.cos(f)), full: k === steps }); }
  } else {
    rings.push({ ring: ringAt(w0, 0, 0), full: true }, { ring: ringAt(w1, 0, 0), full: true });
  }
  const mid = X(I.reduce((s, p) => s + p[0], 0) / n, I.reduce((s, p) => s + p[1], 0) / n, (w0 + w1) / 2);
  const out = [], M = arcs.length;
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1], side = A.full && B.full;
    for (let t = 0; t < M; t++) {
      const t2 = (t + 1) % M, straight = arcs[t].i !== arcs[t2].i || arcs[t].m === 0;
      // (the corners, coincident ones dropped: the cap's ring closes the round to its section)
      const raw = [A.ring[t], A.ring[t2], B.ring[t2], B.ring[t]], q = [];
      for (const c of raw) if (!q.some((o) => len(sub(o.p, c.p)) < 1e-7)) q.push(c);
      if (q.length < 3) continue;
      const role = side && straight ? 'face' : 'edge', L = lookOf(look, role);
      if (!L) continue;
      const toward = q.reduce((s, c) => add(s, c.n), [0, 0, 0]);
      // (a flat side keeps its flat normal; a round turns through its own)
      const normals = role === 'face' ? null : q.map((c) => c.n);
      const f = face(q.map((c) => c.p), L, len(toward) > 1e-9 ? toward : sub(q[0].p, mid), normals, role === 'edge' ? { edge: true } : {});
      if (f) out.push(f);
    }
  }
  for (const [w, s] of [[w0, -1], [w1, 1]]) {
    const L = lookOf(look, 'cap'), f = L && face(I.map((p) => X(p[0], p[1], w)), L, X(0, 0, s));
    if (f) out.push(f);
  }
  return out;
}

// ── the tube ────────────────────────────────────────────────────────────────────
/** A polyline with each inner corner rounded: an arc (`steps` points) of `radius` where it turns. */
export function bend(points, radius, steps = 4) {
  if (points.length < 3) return points.map((p) => [...p]);
  const out = [[...points[0]]];
  for (let i = 1; i + 1 < points.length; i++) {
    const p = points[i], a = unit(sub(points[i - 1], p)), b = unit(sub(points[i + 1], p));
    const half = Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / 2;
    if (half > Math.PI / 2 - 1e-3) { out.push([...p]); continue; }
    // (the arc's tangent points along each leg, no further than half the shorter leg)
    const d = Math.min(radius / Math.tan(half), len(sub(points[i - 1], p)) / 2, len(sub(points[i + 1], p)) / 2);
    const s = add(p, mul(a, d)), e = add(p, mul(b, d));
    for (let k = 0; k <= steps; k++) { const t = k / steps, u = 1 - t; out.push(add(add(mul(s, u * u), mul(p, 2 * u * t)), mul(e, t * t))); }
  }
  out.push([...points[points.length - 1]]);
  return out;
}

/** A tube along `points`, radius `radius`: its rings carried along the path without twisting, its normals radial (or
 *  each face its own, `smooth: false`: a hex bolt's flats), its ends capped. */
export function tube(points, radius, { sides = 8, look, caps = true, smooth = true } = {}) {
  const pts = points.filter((p, i) => i === 0 || len(sub(p, points[i - 1])) > 1e-6);
  if (pts.length < 2) return [];
  const tan = pts.map((p, i) => unit(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)])));
  // the first ring's basis: any direction across the path, then carried ring to ring (parallel transport)
  let u = Math.abs(tan[0][2]) < 0.9 ? unit(cross(tan[0], [0, 0, 1])) : unit(cross(tan[0], [1, 0, 0]));
  const rings = [];
  for (let i = 0; i < pts.length; i++) {
    if (i) { const t = tan[i]; u = unit(sub(u, mul(t, dot(u, t)))); }
    const v = cross(tan[i], u);
    rings.push(Array.from({ length: sides }, (_, k) => { const a = (2 * Math.PI * k) / sides, d = add(mul(u, Math.cos(a)), mul(v, Math.sin(a))); return { p: add(pts[i], mul(d, radius)), n: d }; }));
  }
  const out = [], L = lookOf(look, 'face');
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides, q = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]];
    const toward = q.reduce((s, c) => add(s, c.n), [0, 0, 0]);
    const f = face(q.map((c) => c.p), L, toward, smooth ? q.map((c) => c.n) : null);
    if (f) out.push(f);
  }
  if (caps) {
    const C = lookOf(look, 'cap') ?? L;
    for (const [ring, t] of [[rings[0], mul(tan[0], -1)], [rings[rings.length - 1], tan[tan.length - 1]]]) { const f = face(ring.map((c) => c.p), C, t); if (f) out.push(f); }
  }
  return out;
}

/** Hex heads on a surface whose normal is `n`, `h` proud, at each point. */
export function bolts(points, n, { r = 0.011, h = 0.007, look } = {}) {
  const nn = unit(n);
  return points.flatMap((p) => tube([p, add(p, mul(nn, h))], r, { sides: 6, look, smooth: false }));
}

/** A weld bead from a to b, on a surface (or a corner) whose normal is n: a ridge `w` wide and `h` high, rippled each
 *  `step` as a run of tacks is. */
export function weld(a, b, n, { w = 0.014, h = 0.006, step = 0.035, look } = {}) {
  const d = sub(b, a), l = len(d);
  if (l < 1e-6) return [];
  const dir = mul(d, 1 / l), nn = unit(sub(n, mul(dir, dot(n, dir)))), s = unit(cross(dir, nn));
  const m = Math.max(1, Math.round(l / step)), out = [], L = lookOf(look, 'face');
  const at = (k) => add(a, mul(dir, (l * k) / m)), H = (k) => (k % 2 ? h * 0.62 : h);
  for (let k = 0; k < m; k++) {
    const c0 = at(k), c1 = at(k + 1), t0 = add(c0, mul(nn, H(k))), t1 = add(c1, mul(nn, H(k + 1)));
    for (const sg of [-1, 1]) {
      const e0 = add(c0, mul(s, (sg * w) / 2)), e1 = add(c1, mul(s, (sg * w) / 2));
      const f = face([e0, e1, t1, t0], L, add(mul(nn, 0.6), mul(s, sg)));
      if (f) out.push(f);
    }
  }
  return out;
}

/** Faces built in a local frame carried into vehicle space: a corner [x, y, z] to origin + x·ex + y·ey + z·ez, its
 *  normals turned by the same basis (orthonormal and right-handed, so a face keeps its winding). */
export function place(faces, { origin, ex, ey, ez }) {
  const at = (p) => P6([origin[0] + p[0] * ex[0] + p[1] * ey[0] + p[2] * ez[0], origin[1] + p[0] * ex[1] + p[1] * ey[1] + p[2] * ez[1], origin[2] + p[0] * ex[2] + p[1] * ey[2] + p[2] * ez[2]]);
  const turn = (n) => unit([n[0] * ex[0] + n[1] * ey[0] + n[2] * ez[0], n[0] * ex[1] + n[1] * ey[1] + n[2] * ez[1], n[0] * ex[2] + n[1] * ey[2] + n[2] * ez[2]]).map(r6);
  return faces.map((f) => ({ ...f, corners: f.corners.map(at), outNormal: turn(f.outNormal), ...(f.cornerNormals ? { cornerNormals: f.cornerNormals.map(turn) } : {}) }));
}

// ── the slab ────────────────────────────────────────────────────────────────────
// each view's outline edge as a plane in vehicle space (n·p ≤ c inside)
const VIEW = Object.freeze({
  front: (u, v) => [u, 0, v],
  side: (u, v) => [0, u, v],
  plan: (u, v) => [u, v, 0],
});
function viewPlanes(view, outline) {
  let P = outline.map((p) => [p[0], p[1]]);
  if (area2(P) < 0) P = P.reverse();
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nu = (b[1] - a[1]) / l, nv = -(b[0] - a[0]) / l;
    return { n: VIEW[view](nu, nv), c: nu * a[0] + nv * a[1], tag: { view, i } };
  });
}
const SLAB_EPS = 1e-9;
// a convex solid (its faces' polygons) cut by a plane, the cut capped
function clipSolid(solid, pl) {
  if (!solid.some((f) => f.pts.some((p) => dot(pl.n, p) - pl.c > SLAB_EPS))) return solid;
  const out = [], cut = [];
  for (const f of solid) {
    const P = f.pts, q = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], da = dot(pl.n, a) - pl.c, db = dot(pl.n, b) - pl.c;
      if (da <= SLAB_EPS) q.push(a);
      if (Math.abs(da) <= SLAB_EPS) cut.push(a);
      if ((da < -SLAB_EPS && db > SLAB_EPS) || (da > SLAB_EPS && db < -SLAB_EPS)) { const p = add(a, mul(sub(b, a), da / (da - db))); q.push(p); cut.push(p); }
    }
    if (q.length >= 3) out.push({ ...f, pts: q });
  }
  const pts = [];
  for (const p of cut) if (!pts.some((o) => len(sub(o, p)) < 1e-7)) pts.push(p);
  if (pts.length >= 3) {
    const mid = mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
    const u = unit(sub(pts[0], mid)), w = cross(pl.n, u);
    pts.sort((a, b) => Math.atan2(dot(sub(a, mid), w), dot(sub(a, mid), u)) - Math.atan2(dot(sub(b, mid), w), dot(sub(b, mid), u)));
    out.push({ pts, n: pl.n, tag: pl.tag });
  }
  return out;
}
const solidOf = (planes) => {
  const B = 100, box = [];
  for (const [i, s] of [[0, -1], [0, 1], [1, -1], [1, 1], [2, -1], [2, 1]]) {
    const n = [0, 0, 0]; n[i] = s;
    const j = (i + 1) % 3, k = (i + 2) % 3, pts = [[-B, -B], [B, -B], [B, B], [-B, B]].map(([a, b]) => { const p = [0, 0, 0]; p[i] = s * B; p[j] = a; p[k] = b; return p; });
    box.push({ pts, n, tag: { view: 'box', i: box.length } });
  }
  return planes.reduce(clipSolid, box);
};

/** Armour: the convex solid inside its outline from the front ([x, z]), the side ([y, z]) and above ([x, y], optional),
 *  its edges sharper than `crease` degrees chamfered `chamfer` wide. */
export function slab({ front, side, plan, chamfer = 0.02, crease = 12, look }) {
  const planes = [...viewPlanes('front', front), ...viewPlanes('side', side), ...(plan ? viewPlanes('plan', plan) : [])];
  let solid = solidOf(planes);
  // (a face left off is inside another solid: its edges are not chamfered, nothing there to catch the light)
  const shown = (f) => f.tag.view !== 'box' && !!lookOf(look, { ...f.tag, n: f.n, edge: false });
  if (chamfer > 0) {
    // (each edge two faces share, by its ends; a chamfer's plane across their bisector, cut so it takes `chamfer` off each
    // face: a sharp edge's chamfer is broad, a shallow crease's a sliver)
    const key = (p) => p.map((q) => Math.round(q * 1e5)).join(',');
    const edges = new Map();
    solid.forEach((f, fi) => f.pts.forEach((a, i) => { const b = f.pts[(i + 1) % f.pts.length], k = [key(a), key(b)].sort().join('|'); if (!edges.has(k)) edges.set(k, { a, fs: [] }); edges.get(k).fs.push(fi); }));
    const cuts = [];
    for (const { a, fs } of edges.values()) {
      if (fs.length !== 2 || !shown(solid[fs[0]]) || !shown(solid[fs[1]])) continue;
      const n1 = solid[fs[0]].n, n2 = solid[fs[1]].n, th = Math.acos(Math.max(-1, Math.min(1, dot(n1, n2))));
      if (th < (crease * Math.PI) / 180) continue;
      const n = unit(add(n1, n2)), d = chamfer * Math.sin(th / 2);
      cuts.push({ n, c: dot(n, a) - d, tag: { view: 'chamfer', edge: true } });
    }
    solid = cuts.reduce(clipSolid, solid);
  }
  const out = [];
  for (const f of solid) {
    if (f.tag.view === 'box') continue;
    const L = lookOf(look, { ...f.tag, n: f.n, edge: f.tag.view === 'chamfer' });
    const g = L && face(f.pts, L, f.n, null, f.tag.view === 'chamfer' ? { edge: true } : {});
    if (g) out.push(g);
  }
  return out;
}
