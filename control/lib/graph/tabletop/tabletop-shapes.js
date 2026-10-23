/**
 * MEEPLE SHAPES — a piece given a body: not only a cube or a flat token but a cut-out with thickness (a meeple, a house,
 * a horse's head), a turned profile (a pawn, a queen, a checker), a box (a cube, a road), or a group of those. A piece's
 * `shape` in a game is a name from the shelf below or one written out, in cell units (1 = a cell's width), standing on
 * its place with z up and facing its player's way.
 *
 *   shape: <name> | { form: 'extrude', profile: [[x, z]…] (counter-clockwise), depth }
 *                 | { form: 'lathe', profile: [[r, z]…] (bottom to top), sides? }
 *                 | { form: 'box', size: [w, d, h] }
 *                 | { form: 'group', parts: [{ shape, at?: [x, y, z] }] }
 *   SHAPES                     the shelf: meeple, house, city, tower, barn, ship, cube, bar, disc, stack, pawn, rook,
 *                              knight, bishop, queen, king, robber
 *   shapeOf(ref) → shape       a name resolved, a written shape checked
 *   shapeFaces(shape) → [{ c0, u, v, clip?, normal }]   the body as planar panels in its own frame (cell units): each a
 *                              rectangle from c0 along u and v, clipped to its true outline where that is not the
 *                              rectangle (a cut-out's face, a lathe's flat cap); a lathe's tapering band is the rectangle
 *                              of its mean width, unmasked, so a full set stays cheap to draw
 *   shapeIcon(shape) → [[x, z]…][]   the side silhouette, for a plan drawn from above as a diagram draws its pieces
 *
 * Pure and deterministic.
 */

const TAU = Math.PI * 2;
const r6 = (x) => (Math.round(x * 1e6) / 1e6) || 0;

export const SHAPES = {
  // cut-outs: [x, z] counter-clockwise, standing on z = 0
  meeple: { form: 'extrude', depth: 0.16, profile: [[-0.24, 0], [-0.08, 0], [0, 0.13], [0.08, 0], [0.24, 0], [0.14, 0.21], [0.25, 0.26], [0.25, 0.32], [0.08, 0.35], [0.1, 0.4], [0.08, 0.47], [0, 0.5], [-0.08, 0.47], [-0.1, 0.4], [-0.08, 0.35], [-0.25, 0.32], [-0.25, 0.26], [-0.14, 0.21]] },
  house: { form: 'extrude', depth: 0.26, profile: [[-0.16, 0], [0.16, 0], [0.16, 0.18], [0, 0.32], [-0.16, 0.18]] },
  city: { form: 'extrude', depth: 0.28, profile: [[-0.22, 0], [0.22, 0], [0.22, 0.2], [0.1, 0.3], [-0.02, 0.2], [-0.02, 0.36], [-0.12, 0.44], [-0.22, 0.36]] },
  tower: { form: 'extrude', depth: 0.2, profile: [[-0.1, 0], [0.1, 0], [0.1, 0.44], [0.06, 0.44], [0.06, 0.5], [0.02, 0.5], [0.02, 0.44], [-0.02, 0.44], [-0.02, 0.5], [-0.06, 0.5], [-0.06, 0.44], [-0.1, 0.44]] },
  barn: { form: 'extrude', depth: 0.3, profile: [[-0.2, 0], [0.2, 0], [0.2, 0.16], [0.12, 0.28], [-0.12, 0.28], [-0.2, 0.16]] },
  ship: { form: 'extrude', depth: 0.12, profile: [[-0.18, 0], [0.18, 0], [0.26, 0.1], [0.02, 0.1], [0.02, 0.42], [-0.16, 0.14], [0, 0.14], [0, 0.1], [-0.26, 0.1]] },
  // boxes: [w, d, h]
  cube: { form: 'box', size: [0.2, 0.2, 0.2] },
  bar: { form: 'box', size: [0.62, 0.1, 0.1] },
  // turned: [r, z] from the base up
  disc: { form: 'lathe', sides: 10, profile: [[0.36, 0], [0.36, 0.1], [0.3, 0.12], [0, 0.12]] },
  stack: { form: 'lathe', sides: 10, profile: [[0.36, 0], [0.36, 0.1], [0.32, 0.11], [0.36, 0.12], [0.36, 0.22], [0.3, 0.24], [0, 0.24]] },
  pawn: { form: 'lathe', sides: 6, profile: [[0.2, 0], [0.2, 0.05], [0.13, 0.09], [0.08, 0.2], [0.13, 0.25], [0.07, 0.28], [0.1, 0.34], [0.09, 0.42], [0.04, 0.47], [0, 0.48]] },
  rook: { form: 'lathe', sides: 6, profile: [[0.22, 0], [0.22, 0.05], [0.15, 0.1], [0.12, 0.42], [0.18, 0.45], [0.18, 0.58], [0.12, 0.58], [0.12, 0.54], [0, 0.54]] },
  bishop: { form: 'lathe', sides: 6, profile: [[0.21, 0], [0.21, 0.05], [0.13, 0.1], [0.07, 0.38], [0.14, 0.42], [0.07, 0.45], [0.11, 0.56], [0.08, 0.66], [0.03, 0.7], [0, 0.71]] },
  queen: { form: 'lathe', sides: 6, profile: [[0.23, 0], [0.23, 0.05], [0.14, 0.1], [0.07, 0.46], [0.15, 0.51], [0.08, 0.54], [0.15, 0.7], [0.09, 0.74], [0.05, 0.78], [0, 0.8]] },
  king: { form: 'group', parts: [
    { shape: { form: 'lathe', sides: 6, profile: [[0.23, 0], [0.23, 0.05], [0.14, 0.1], [0.08, 0.5], [0.16, 0.55], [0.08, 0.58], [0.14, 0.74], [0.1, 0.78], [0, 0.78]] } },
    { shape: { form: 'extrude', depth: 0.04, profile: [[-0.02, 0], [0.02, 0], [0.02, 0.05], [0.06, 0.05], [0.06, 0.08], [0.02, 0.08], [0.02, 0.13], [-0.02, 0.13], [-0.02, 0.08], [-0.06, 0.08], [-0.06, 0.05], [-0.02, 0.05]] }, at: [0, 0, 0.77] },
  ] },
  knight: { form: 'group', parts: [
    { shape: { form: 'lathe', sides: 6, profile: [[0.21, 0], [0.21, 0.05], [0.14, 0.1], [0, 0.1]] } },
    { shape: { form: 'extrude', depth: 0.14, profile: [[-0.13, 0], [0.15, 0], [0.11, 0.12], [0.2, 0.25], [0.22, 0.34], [0.14, 0.4], [0.04, 0.55], [-0.02, 0.5], [-0.07, 0.55], [-0.14, 0.43], [-0.17, 0.26]] }, at: [0, 0, 0.09] },
  ] },
  robber: { form: 'lathe', sides: 8, profile: [[0.14, 0], [0.12, 0.18], [0.08, 0.3], [0.11, 0.36], [0.08, 0.44], [0, 0.46]] },
};

function no(msg) { throw new Error(`shape: ${msg}`); }
const isPairs = (p) => Array.isArray(p) && p.length >= 2 && p.every((q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite));

export function shapeOf(ref) {
  if (typeof ref === 'string') {
    if (!SHAPES[ref]) no(`no shape '${ref}' on the shelf (${Object.keys(SHAPES).join(', ')}); or write one out`);
    return SHAPES[ref];
  }
  if (!ref || typeof ref !== 'object') no('a shape is a name or { form, … }');
  if (ref.form === 'extrude') { if (!isPairs(ref.profile) || ref.profile.length < 3 || !(ref.depth > 0)) no('extrude is { profile: [[x, z]…] (3 or more), depth > 0 }'); }
  else if (ref.form === 'lathe') { if (!isPairs(ref.profile) || ref.profile.some(([r]) => r < 0)) no('lathe is { profile: [[r, z]…] (r 0 or more), sides? }'); }
  else if (ref.form === 'box') { if (!Array.isArray(ref.size) || ref.size.length !== 3 || !ref.size.every((x) => x > 0)) no('box is { size: [w, d, h] }'); }
  else if (ref.form === 'group') { if (!Array.isArray(ref.parts) || !ref.parts.length) no('group is { parts: [{ shape, at? }] }'); ref.parts.forEach((p) => shapeOf(p.shape)); }
  else no(`form is extrude, lathe, box or group, not '${ref.form}'`);
  return ref;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
const round = (p) => p.map(r6);

// A planar polygon as one panel: its frame the rectangle round it in its own plane (along `along` from its first point),
// clipped to it unless it is that rectangle.
function panel(points, normal, along) {
  // the plane's own normal (Newell), turned to the side the hint faces
  let w = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    w = add(w, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
  }
  if (len(w) < 1e-12) return null;
  const n = dot(w, normal) < 0 ? unit(mul(w, -1)) : unit(w);
  const along0 = along ? sub(along[1], along[0]) : sub(points[1], points[0]);
  const u0 = unit(sub(along0, mul(n, dot(along0, n))));
  const v0 = unit(cross(n, u0));
  const s = points.map((p) => dot(p, u0)), t = points.map((p) => dot(p, v0));
  const s0 = Math.min(...s), s1 = Math.max(...s), t0 = Math.min(...t), t1 = Math.max(...t);
  if (s1 - s0 < 1e-9 || t1 - t0 < 1e-9) return null;
  const base = mul(n, dot(points[0], n));
  const c0 = add(add(base, mul(u0, s0)), mul(v0, t0));
  const u = mul(u0, s1 - s0), v = mul(v0, t1 - t0);
  const pct = points.map((p, i) => [(s[i] - s0) / (s1 - s0), (t[i] - t0) / (t1 - t0)]);
  const corner = (a, b) => pct.some(([x, y]) => Math.abs(x - a) < 1e-6 && Math.abs(y - b) < 1e-6);
  const rect = points.length === 4 && corner(0, 0) && corner(1, 0) && corner(1, 1) && corner(0, 1);
  const clip = rect ? null : `polygon(${pct.map(([x, y]) => `${r6(x * 100)}% ${r6(y * 100)}%`).join(',')})`;
  return { c0: round(c0), u: round(u), v: round(v), normal: round(n), ...(clip ? { clip } : {}) };
}

function extrudeFaces({ profile, depth }) {
  const out = [], h = depth / 2, P = profile;
  const front = P.map(([x, z]) => [x, -h, z]), back = P.map(([x, z]) => [x, h, z]);
  out.push(panel(front, [0, -1, 0], [[0, 0, 0], [1, 0, 0]]));
  out.push(panel(back, [0, 1, 0], [[0, 0, 0], [-1, 0, 0]]));
  for (let i = 0; i < P.length; i++) {
    const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % P.length];
    if (Math.hypot(x1 - x0, z1 - z0) < 1e-9) continue;
    const n = [z1 - z0, 0, -(x1 - x0)];
    out.push(panel([[x0, -h, z0], [x1, -h, z1], [x1, h, z1], [x0, h, z0]], n));
  }
  return out;
}

function latheFaces({ profile, sides = 8 }) {
  const out = [], ring = (r, z) => Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * TAU + Math.PI / sides;
    return [r * Math.cos(a), r * Math.sin(a), z];
  });
  for (let i = 0; i + 1 < profile.length; i++) {
    const [ra, za] = profile[i], [rb, zb] = profile[i + 1];
    if (ra < 1e-9 && rb < 1e-9) continue;
    const A = ring(ra, za), B = ring(rb, zb);
    // a flat cap closing at the axis: one polygon, not a fan of slices
    if (Math.abs(za - zb) < 1e-9 && (rb < 1e-9 || ra < 1e-9)) {
      const rim = rb < 1e-9 ? A : B;
      out.push(panel(rim, ra > rb ? [0, 0, 1] : [0, 0, -1], [rim[0], rim[1]]));
      continue;
    }
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides, mid = (k + 0.5) / sides * TAU + Math.PI / sides;
      if (Math.abs(za - zb) < 1e-9) {
        // a flat ring between two radii (a shoulder, a top): its normal up or down
        const up = ra > rb ? [0, 0, 1] : [0, 0, -1];
        const quad = rb < 1e-9 ? [A[k], A[k1], B[k]] : [A[k], A[k1], B[k1], B[k]];
        out.push(panel(quad, up, [A[k], A[k1]]));
        continue;
      }
      // a tapering band as the rectangle of its mean width along its own axis: no mask, so a set of turned pieces stays
      // on the compositor's fast path (a mask on every band of thirty-two pieces does not); the taper reads the same
      const radial = [Math.cos(mid), Math.sin(mid), 0];
      const am = mul(add(A[k], A[k1]), 0.5), bm = mul(add(B[k], B[k1]), 0.5);
      // a little wider than the mean, so neighbouring bands overlap and no seam shows the board through
      const width = 1.06 * (len(sub(A[k1], A[k])) + len(sub(B[k1], B[k]))) / 2;
      const u0 = unit(sub(ra >= rb ? A[k1] : B[k1], ra >= rb ? A[k] : B[k])), v = sub(bm, am);
      let n = unit(cross(u0, v));
      if (dot(n, radial) < 0) n = mul(n, -1);
      out.push({ c0: round(sub(am, mul(u0, width / 2))), u: round(mul(u0, width)), v: round(v), normal: round(n) });
    }
  }
  return out;
}

function boxFaces({ size: [w, d, hgt] }) {
  const x = w / 2, y = d / 2;
  const q = (pts, n) => panel(pts, n);
  return [
    q([[-x, -y, hgt], [x, -y, hgt], [x, y, hgt], [-x, y, hgt]], [0, 0, 1]),
    q([[-x, -y, 0], [x, -y, 0], [x, -y, hgt], [-x, -y, hgt]], [0, -1, 0]),
    q([[x, y, 0], [-x, y, 0], [-x, y, hgt], [x, y, hgt]], [0, 1, 0]),
    q([[x, -y, 0], [x, y, 0], [x, y, hgt], [x, -y, hgt]], [1, 0, 0]),
    q([[-x, y, 0], [-x, -y, 0], [-x, -y, hgt], [-x, y, hgt]], [-1, 0, 0]),
  ];
}

export function shapeFaces(ref) {
  const S = shapeOf(ref);
  let faces;
  if (S.form === 'extrude') faces = extrudeFaces(S);
  else if (S.form === 'lathe') faces = latheFaces(S);
  else if (S.form === 'box') faces = boxFaces(S);
  else faces = S.parts.flatMap((p) => shapeFaces(p.shape).map((f) => ({ ...f, c0: round(add(f.c0, p.at || [0, 0, 0])) })));
  return faces.filter(Boolean);
}

export function shapeIcon(ref) {
  const S = shapeOf(ref);
  if (S.form === 'extrude') return [S.profile.map(([x, z]) => [r6(x), r6(z)])];
  if (S.form === 'lathe') {
    const right = S.profile.map(([r, z]) => [r6(r), r6(z)]), left = S.profile.slice().reverse().map(([r, z]) => [r6(-r), r6(z)]);
    return [right.concat(left)];
  }
  if (S.form === 'box') { const [w, , h] = S.size; return [[[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]]]; }
  return S.parts.flatMap((p) => shapeIcon(p.shape).map((poly) => poly.map(([x, z]) => [r6(x + (p.at ? p.at[0] : 0)), r6(z + (p.at ? p.at[2] : 0))])));
}
