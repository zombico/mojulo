// The refacade kit: the face primitives the metro landmark / sacred builders compose from.
//
// Same face contract as the stock builders (index.js makeFaceKit): a quad `{ corners, fill,
// doubleSided }`, a triangle as a quad with a `clip` polygon, so the CSS-3D page, the World and
// the GLB all draw it. Two differences, both for the read:
//   - light comes from the TRUE outward normal. Every primitive knows the inside of the solid it
//     skins (a point, or the axis of a lathe), so a wall turned from the key goes dark instead of
//     being flipped toward the camera, and the mass reads as a mass from every side. The normal
//     rides on the face as `outNormal` (the GLB winding fix reads it).
//   - the primitives are architectural: lathe, prism, box, and a wall frame with recessed and
//     proud panels and arch-headed openings, so a builder spends its lines on the building.
// Deterministic geometry only: no rng, no Date. Everything is a pure function of its arguments.
import { litFactor, scaleHex, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';

export const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  centroid: (pts) => { const s = [0, 0, 0]; for (const p of pts) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return [s[0] / pts.length, s[1] / pts.length, s[2] / pts.length]; },
};
const { sub, add, mul, dot, cross, len, norm, centroid } = v3;

/** Mix two hex colours in sRGB (t = 0 → a, 1 → b). */
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/**
 * makeKit({ faces, L, camHint }) → the primitives, each pushing lit faces into `faces`.
 * `out` arguments orient a face: a point INSIDE the solid (the normal is flipped away from it),
 * a vector `{ dir: [x,y,z] }` (the normal is flipped toward it), or null (toward camHint, the
 * stock rule, for thin plates seen from both sides).
 */
export function makeKit({ faces, L, camHint = [-7, 31, 9] }) {
  const orient = (pts, out) => {
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    if (len(n) < 1e-9 || !Number.isFinite(n[0])) n = [0, 0, 1];
    const c = centroid(pts);
    if (out && out.dir) { if (dot(n, out.dir) < 0) n = mul(n, -1); }
    else if (out) { if (dot(n, sub(c, out)) < 0) n = mul(n, -1); }
    else if (dot(n, sub(camHint, c)) < 0) n = mul(n, -1);
    return n;
  };
  const shade = (tint, n) => scaleHex(tint, litFactor(n, L));

  /** A planar quad (4 corners in order). */
  function quad(pts, tint, out = null) {
    const n = orient(pts, out);
    faces.push({ corners: pts, fill: shade(tint, n), doubleSided: true, outNormal: n });
  }
  /** A triangle, as the stock kit draws it: a quad over (A, B) with its far edge clipped to T. */
  function tri(A, B, T, tint, out = null) {
    const Uw = sub(B, A), ub = norm(Uw), AT = sub(T, A), Vw = sub(AT, mul(ub, dot(AT, ub)));
    if (len(Vw) < 1e-6 || len(Uw) < 1e-6) return;
    const n = orient([A, B, T], out);
    faces.push({
      corners: [A, B, add(B, Vw), add(A, Vw)],
      fill: shade(tint, n),
      doubleSided: true,
      outNormal: n,
      clip: `polygon(0% 0%, 100% 0%, ${(dot(AT, ub) / len(Uw) * 100).toFixed(1)}% 100%)`,
    });
  }
  /** A convex planar polygon (fan from its centroid; a quad goes straight through). */
  function poly(pts, tint, out = null) {
    if (pts.length === 3) return tri(pts[0], pts[1], pts[2], tint, out);
    if (pts.length === 4) return quad(pts, tint, out);
    const c = centroid(pts);
    for (let i = 0; i < pts.length; i++) tri(pts[i], pts[(i + 1) % pts.length], c, tint, out);
  }

  /** An axis-aligned box. `tint` is a hex or { side, top, bottom }; `bottom` only draws when set. */
  function box(x0, y0, z0, x1, y1, z1, tint) {
    const t = typeof tint === 'string' ? { side: tint, top: scaleHex(tint, 1.04) } : tint;
    const inside = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const side = t.side, P = (x, y, z) => [x, y, z];
    quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], t.front || side, inside);
    quad([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], t.right || side, inside);
    quad([P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1)], t.back || side, inside);
    quad([P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1)], t.left || side, inside);
    if (t.top) quad([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], t.top, inside);
    if (t.bottom) quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], t.bottom, inside);
  }

  /** Extrude a convex-or-not 2D outline [[x,y]...] from z0 to z1; `cap` tints the top (convex only). */
  function prism(outline, z0, z1, tint, { cap = null, bottom = null, inside = null } = {}) {
    const ctr = inside || [...centroid(outline.map(([x, y]) => [x, y, 0])).slice(0, 2), (z0 + z1) / 2];
    for (let i = 0; i < outline.length; i++) {
      const [ax, ay] = outline[i], [bx, by] = outline[(i + 1) % outline.length];
      const pts = [[ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1]];
      // outward = away from the outline's centre, measured in plan at this edge
      const m = [(ax + bx) / 2, (ay + by) / 2, (z0 + z1) / 2];
      quad(pts, typeof tint === 'function' ? tint(i) : tint, [ctr[0], ctr[1], m[2]]);
    }
    if (cap) poly(outline.map(([x, y]) => [x, y, z1]), cap, { dir: [0, 0, 1] });
    if (bottom) poly(outline.map(([x, y]) => [x, y, z0]), bottom, { dir: [0, 0, -1] });
  }

  /**
   * A surface of revolution about (cx, cy): `profile` [[r, z], …] bottom → top, `n` segments.
   * `tint` is a hex, or (segment i, band k) → hex for banding / ribbing. A profile point with r = 0
   * closes the solid there (triangles). `a0`/`a1` sweep a part-revolution (radians).
   */
  function lathe(cx, cy, profile, n, tint, { a0 = 0, a1 = Math.PI * 2, capTop = null, capBottom = null } = {}) {
    const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-9;
    const P = (r, z, i) => { const a = a0 + (a1 - a0) * (i / n); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; };
    for (let k = 0; k < profile.length - 1; k++) {
      const [r0, z0] = profile[k], [r1, z1] = profile[k + 1];
      const axisIn = [cx, cy, (z0 + z1) / 2];
      for (let i = 0; i < n; i++) {
        const t = typeof tint === 'function' ? tint(i, k) : tint;
        if (!t) continue;
        const A = P(r0, z0, i), B = P(r0, z0, i + 1), C = P(r1, z1, i + 1), D = P(r1, z1, i);
        // outward: away from the axis, and for a near-flat band, away from the profile's own side
        const out = Math.abs(r1 - r0) > Math.abs(z1 - z0) * 4 ? { dir: [0, 0, r1 < r0 ? 1 : -1] } : axisIn;
        if (r0 < 1e-9) tri(D, C, A, t, out);
        else if (r1 < 1e-9) tri(A, B, D, t, out);
        else quad([A, B, C, D], t, out);
      }
    }
    const disc = (r, z, t, up) => {
      if (!t || r < 1e-9) return;
      const ring = Array.from({ length: n + (full ? 0 : 1) }, (_, i) => P(r, z, i));
      if (!full) ring.push([cx, cy, z]);
      poly(ring, t, { dir: [0, 0, up ? 1 : -1] });
    };
    disc(profile[profile.length - 1][0], profile[profile.length - 1][1], capTop, true);
    disc(profile[0][0], profile[0][1], capBottom, false);
  }

  /** A round shaft with an optional base torus-step and capital block (classical order, low-poly). */
  function column(cx, cy, r, z0, z1, tint, { n = 8, base = true, capital = true, entasis = 0.12, capTint = null } = {}) {
    const h = z1 - z0, bz = base ? h * 0.05 : 0, cz = capital ? h * 0.07 : 0;
    if (base) box(cx - r * 1.35, cy - r * 1.35, z0, cx + r * 1.35, cy + r * 1.35, z0 + bz, tint);
    lathe(cx, cy, [[r, z0 + bz], [r * (1 - entasis * 0.3), z0 + bz + (h - bz - cz) * 0.55], [r * (1 - entasis), z1 - cz]], n, tint);
    if (capital) {
      lathe(cx, cy, [[r * (1 - entasis), z1 - cz], [r * 1.25, z1 - cz * 0.35]], n, capTint || tint);
      box(cx - r * 1.4, cy - r * 1.4, z1 - cz * 0.35, cx + r * 1.4, cy + r * 1.4, z1, capTint || tint);
    }
  }

  /**
   * A wall frame: an origin on the wall plane, `u` along the wall (horizontal), `v` up, and `n` the
   * outward normal (unit vectors). Returns helpers that address the wall in (s, t) metres-along /
   * up, with depth d along n (negative = recessed into the wall).
   */
  function wall(origin, u, v, n) {
    const at = (s, t, d = 0) => add(add(add(origin, mul(u, s)), mul(v, t)), mul(n, d));
    const out = { dir: n };
    /** A flat rectangle on (or proud of / sunk into) the wall. */
    const rect = (s0, t0, s1, t1, tint, d = 0) => quad([at(s0, t0, d), at(s1, t0, d), at(s1, t1, d), at(s0, t1, d)], tint, out);
    /** A panel standing proud of the wall by `d` (> 0), with its four returns: pilasters, piers, string courses. */
    const proud = (s0, t0, s1, t1, d, tint, returnTint = null) => {
      const rt = returnTint || scaleHex(tint, 0.92);
      rect(s0, t0, s1, t1, tint, d);
      quad([at(s0, t1, 0), at(s1, t1, 0), at(s1, t1, d), at(s0, t1, d)], scaleHex(tint, 1.06), { dir: v });           // top
      quad([at(s0, t0, 0), at(s1, t0, 0), at(s1, t0, d), at(s0, t0, d)], rt, { dir: mul(v, -1) });                    // soffit
      quad([at(s0, t0, 0), at(s0, t1, 0), at(s0, t1, d), at(s0, t0, d)], rt, { dir: mul(u, -1) });                    // left return
      quad([at(s1, t0, 0), at(s1, t1, 0), at(s1, t1, d), at(s1, t0, d)], rt, { dir: u });                             // right return
    };
    // OPENINGS. A primitive's wall is a solid face, so a hole cut behind it would be hidden: an
    // opening is PAINTED on the wall (a dark plane a hair proud of it) and given depth the way a
    // drawing gives it — a shadow band down the head and one jamb (`depth` wide), a lit sill, and an
    // optional proud surround (`frame` wide, standing `frame * 0.5` off the wall).
    const EPS = 0.012;
    /** A rectangular opening (window, door, niche). */
    const recess = (s0, t0, s1, t1, depth, tint, revealTint, { frame = 0 } = {}) => {
      const dd = Math.min(Math.abs(depth), (s1 - s0) * 0.3, (t1 - t0) * 0.3), sh = scaleHex(tint, 0.55);
      rect(s0, t0, s1, t1, tint, EPS);
      rect(s0, t1 - dd, s1, t1, sh, EPS * 1.5);                                  // head shadow
      rect(s0, t0, s0 + dd * 0.8, t1 - dd, sh, EPS * 1.5);                       // jamb shadow
      if (revealTint) proud(s0 - dd * 0.2, t0 - dd * 0.35, s1 + dd * 0.2, t0, dd * 0.6, revealTint);   // sill
      if (frame > 0) {
        const f = frame, fd = frame * 0.5, ft = revealTint || scaleHex(tint, 2.2);
        proud(s0 - f, t1, s1 + f, t1 + f, fd, ft);
        proud(s0 - f, t0, s0, t1, fd, ft);
        proud(s1, t0, s1 + f, t1, fd, ft);
      }
    };
    /**
     * An arch-headed opening: jambs from t0 to the springing line tS, then a round head (`rise`
     * flattens it; `pointed: true` strikes a Gothic point). Painted like `recess`, with a shadow
     * band under the head and an optional proud archivolt (`frame`). `seg` segments in the head.
     */
    const arch = (s0, s1, t0, tS, depth, tint, revealTint, { seg = 8, rise = null, pointed = false, frame = 0 } = {}) => {
      const w = s1 - s0, r = w / 2, sc = (s0 + s1) / 2, h = rise ?? (pointed ? w * 0.87 : r);
      const dd = Math.min(Math.abs(depth), w * 0.3), sh = scaleHex(tint, 0.55);
      const head = (i, inset = 0) => {
        const k = i / seg;
        if (!pointed) { const a = Math.PI * k; return [sc - Math.cos(a) * (r - inset), tS + Math.sin(a) * (h - inset * (h / r))]; }
        // two arcs of radius w, struck from the opposite springing points, meet at the apex
        const half = k <= 0.5, q = half ? k * 2 : (1 - k) * 2, ang = q * (Math.PI / 3);
        const ox = half ? s1 : s0, dir = half ? -1 : 1, R = w - inset;
        return [ox + dir * Math.cos(ang) * R, tS + Math.sin(ang) * R * (h / (w * Math.sin(Math.PI / 3)))];
      };
      rect(s0, t0, s1, tS, tint, EPS);
      rect(s0, t0, s0 + dd * 0.8, tS, sh, EPS * 1.5);                            // jamb shadow
      const top = [sc, tS];
      for (let i = 0; i < seg; i++) {
        const A = head(i), B = head(i + 1), Ai = head(i, dd), Bi = head(i + 1, dd);
        tri(at(A[0], A[1], EPS), at(B[0], B[1], EPS), at(top[0], top[1], EPS), tint, out);
        quad([at(A[0], A[1], EPS * 1.5), at(B[0], B[1], EPS * 1.5), at(Bi[0], Bi[1], EPS * 1.5), at(Ai[0], Ai[1], EPS * 1.5)], sh, out);   // soffit shadow
        if (frame > 0) {
          const Ao = head(i, -frame), Bo = head(i + 1, -frame), fd = frame * 0.5, ft = revealTint || scaleHex(tint, 2.2);
          quad([at(A[0], A[1], fd), at(B[0], B[1], fd), at(Bo[0], Bo[1], fd), at(Ao[0], Ao[1], fd)], ft, out);
        }
      }
      if (revealTint) proud(s0 - dd * 0.2, t0 - dd * 0.35, s1 + dd * 0.2, t0, dd * 0.6, revealTint);
      if (frame > 0) { const fd = frame * 0.5, ft = revealTint || scaleHex(tint, 2.2); proud(s0 - frame, t0, s0, tS, fd, ft); proud(s1, t0, s1 + frame, tS, fd, ft); }
    };
    return { at, rect, proud, recess, arch, u, v, n };
  }

  /** The four walls of an axis-aligned block as wall frames (s runs left → right seen from outside). */
  function blockWalls(x0, y0, x1, y1, z0) {
    return {
      south: wall([x0, y0, z0], [1, 0, 0], [0, 0, 1], [0, -1, 0]),
      east: wall([x1, y0, z0], [0, 1, 0], [0, 0, 1], [1, 0, 0]),
      north: wall([x1, y1, z0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]),
      west: wall([x0, y1, z0], [0, -1, 0], [0, 0, 1], [-1, 0, 0]),
      len: { south: x1 - x0, east: y1 - y0, north: x1 - x0, west: y1 - y0 },
    };
  }

  /** A pitched (gable) roof over an axis-aligned rect, ridge along `axis` ('x' | 'y'). */
  function gable(x0, y0, x1, y1, zEave, zRidge, roofTint, gableTint, axis = 'x', overhang = 0) {
    const o = overhang;
    if (axis === 'x') {
      const ym = (y0 + y1) / 2;
      quad([[x0 - o, y0 - o, zEave], [x1 + o, y0 - o, zEave], [x1 + o, ym, zRidge], [x0 - o, ym, zRidge]], roofTint, [(x0 + x1) / 2, ym, zEave]);
      quad([[x1 + o, y1 + o, zEave], [x0 - o, y1 + o, zEave], [x0 - o, ym, zRidge], [x1 + o, ym, zRidge]], roofTint, [(x0 + x1) / 2, ym, zEave]);
      tri([x0, y0, zEave], [x0, y1, zEave], [x0, ym, zRidge], gableTint, { dir: [-1, 0, 0] });
      tri([x1, y0, zEave], [x1, y1, zEave], [x1, ym, zRidge], gableTint, { dir: [1, 0, 0] });
    } else {
      const xm = (x0 + x1) / 2;
      quad([[x0 - o, y0 - o, zEave], [x0 - o, y1 + o, zEave], [xm, y1 + o, zRidge], [xm, y0 - o, zRidge]], roofTint, [xm, (y0 + y1) / 2, zEave]);
      quad([[x1 + o, y1 + o, zEave], [x1 + o, y0 - o, zEave], [xm, y0 - o, zRidge], [xm, y1 + o, zRidge]], roofTint, [xm, (y0 + y1) / 2, zEave]);
      tri([x0, y0, zEave], [x1, y0, zEave], [xm, y0, zRidge], gableTint, { dir: [0, -1, 0] });
      tri([x0, y1, zEave], [x1, y1, zEave], [xm, y1, zRidge], gableTint, { dir: [0, 1, 0] });
    }
  }

  return { faces, quad, tri, poly, box, prism, lathe, column, wall, blockWalls, gable, shade };
}

/** Rotate a local-frame builder into place: returns (lx, ly) → [x, y] about (cx, cy) by `yaw`. */
export function planFrame(cx, cy, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return (lx, ly) => [cx + lx * c - ly * s, cy + lx * s + ly * c];
}

/**
 * Re-mesh a dense face soup (a polygonised figure: tens of thousands of faces) to a landmark's
 * budget by vertex clustering: a grid of `g` cells per unit; every face keeps its corners' cluster
 * means; collapsed and repeated faces drop; a quad that folds past a quarter cell splits in two.
 * Normals are re-found (a figure mesher's winding is mixed): each face turns away from the centroid
 * of the clustered vertices around it. `tagOf(face)` labels each output face (a material slot).
 * Returns [{ pts, n, tag }]. Pure.
 */
export function decimateFaces(src, g, tagOf = () => 'body') {
  const kOf = (p) => `${Math.floor(p[0] * g)},${Math.floor(p[1] * g)},${Math.floor(p[2] * g)}`;
  const acc = new Map();
  for (const f of src) for (const p of f.corners) { const k = kOf(p), a = acc.get(k) || [0, 0, 0, 0]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; acc.set(k, a); }
  const rep = new Map(); for (const [k, a] of acc) rep.set(k, [a[0] / a[3], a[1] / a[3], a[2] / a[3]]);
  const seen = new Set(), out = [];
  for (const f of src) {
    const ks = [];
    for (const p of f.corners) { const k = kOf(p); if (ks[ks.length - 1] !== k) ks.push(k); }
    if (ks.length > 1 && ks[0] === ks[ks.length - 1]) ks.pop();
    if (new Set(ks).size !== ks.length || ks.length < 3) continue;
    const sk = [...ks].sort().join('|');
    if (seen.has(sk)) continue;
    seen.add(sk);
    const pts = ks.map((k) => rep.get(k)), tag = tagOf(f);
    if (pts.length === 4) {
      const n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))), off = Math.abs(dot(n, sub(pts[3], pts[0])));
      if (off > 0.25 / g) { out.push({ pts: [pts[0], pts[1], pts[2]], tag }, { pts: [pts[0], pts[2], pts[3]], tag }); continue; }
    }
    out.push({ pts, tag });
  }
  const cell = 2 / g, grid = new Map(), gk = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  for (const p of rep.values()) { const k = gk(p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  const R2 = (2.2 / g) ** 2;
  for (const f of out) {
    const c = centroid(f.pts), [ix, iy, iz] = [Math.floor(c[0] / cell), Math.floor(c[1] / cell), Math.floor(c[2] / cell)];
    const m = [0, 0, 0]; let cnt = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const p of grid.get(`${ix + dx},${iy + dy},${iz + dz}`) || []) { const d = sub(p, c); if (dot(d, d) < R2) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; cnt++; } }
    }
    let n = norm(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0])));
    const away = cnt ? sub(c, mul(m, 1 / cnt)) : [c[0], c[1], 0];
    if (dot(n, away) < 0) n = mul(n, -1);
    f.n = n;
  }
  return out;
}
