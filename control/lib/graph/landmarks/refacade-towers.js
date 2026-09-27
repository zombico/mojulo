// Metro refacade builders: towers. Each entry is (b, { L, camHint, cityBox }) → faces, drawn only for
// a metro box (b.metro); the stock builder draws everything else. See refacade.js.
//
// Every dimension comes from the footprint's SHORT side `S` (never from b.z1), and every top stays
// at or under the stock silhouette (LANDMARK_HEIGHTS × S). Pure functions of the box: no rng.
import { makeKit, mixHex, planFrame, v3 } from './refacade-kit.js';

const { sub, add, mul, cross, norm, len } = v3;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** Piecewise-linear lookup in [[u, v…], …] (sorted by u): returns the interpolated row after u. */
function piece(rows, u) {
  const t = clamp01(u);
  for (let i = 1; i < rows.length; i++) {
    if (t <= rows[i][0]) {
      const a = rows[i - 1], b = rows[i], k = (t - a[0]) / ((b[0] - a[0]) || 1);
      return a.map((v, j) => lerp(v, b[j], k)).slice(1);
    }
  }
  return rows[rows.length - 1].slice(1);
}

/** The box's frame: centre, short side, and a plan rotation that lays the long axis along local x. */
function frameOf(b) {
  const S = Math.min(b.w, b.d), long = Math.max(b.w, b.d);
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  const P = planFrame(cx, cy, b.w >= b.d ? 0 : Math.PI / 2);
  return { S, long, cx, cy, z0: b.z0, P };
}

/**
 * Local helpers on top of the kit. `loft` skins a stack of plan rings that wind COUNTER-CLOCKWISE
 * (each ring the same vertex count) and lights each face from its edge's outward plan normal, so
 * concave outlines (the CN Tower's Y, the Petronas star) shade correctly where a centre point fails.
 */
function towerTools(kit) {
  const { quad, tri } = kit;
  const edgeOut = (a, b) => [b[1] - a[1], -(b[0] - a[0]), 0];
  function loft(rings, tint, { skip = null } = {}) {
    for (let k = 0; k < rings.length - 1; k++) {
      const lo = rings[k], hi = rings[k + 1], n = lo.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, t = typeof tint === 'function' ? tint(i, k) : tint;
        if (!t || (skip && skip(i, k))) continue;
        const o = add(edgeOut(lo[i], lo[j]), edgeOut(hi[i], hi[j]));
        const dir = len(o) < 1e-9 ? [0, 0, 1] : o;
        const A = lo[i], B = lo[j], C = hi[j], D = hi[i];
        if (len(sub(C, D)) < 1e-9) tri(A, B, D, t, { dir });
        else if (len(sub(A, B)) < 1e-9) tri(D, C, A, t, { dir });
        else quad([A, B, C, D], t, { dir });
      }
    }
  }
  /** A flat cap over a ring (fanned; convex rings only, or a star fanned from its centre). */
  function cap(ring, tint, up = true) {
    const c = v3.centroid(ring);
    for (let i = 0; i < ring.length; i++) tri(ring[i], ring[(i + 1) % ring.length], c, tint, { dir: [0, 0, up ? 1 : -1] });
  }
  /** A square-section member A→B, `w` half-thick, each side lit from its own normal. */
  function rod(A, B, w, tint, { sides = 4 } = {}) {
    const d = norm(sub(B, A));
    const ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = norm(cross(d, ref)), e2 = norm(cross(d, e1));
    const off = Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * TAU + Math.PI / sides;
      return add(mul(e1, Math.cos(a) * w), mul(e2, Math.sin(a) * w));
    });
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides, o = norm(add(off[i], off[j]));
      quad([add(A, off[i]), add(A, off[j]), add(B, off[j]), add(B, off[i])], typeof tint === 'function' ? tint(i) : tint, { dir: o });
    }
  }
  /** A flat strip P→Q painted on a surface whose outward normal is `n`, `w` wide, `lift` proud. */
  function strip(P, Q, w, n, tint, lift = 0.004) {
    const t = mul(norm(cross(n, sub(Q, P))), w / 2), up = mul(norm(n), lift);
    quad([add(add(P, t), up), add(sub(P, t), up), add(sub(Q, t), up), add(add(Q, t), up)], tint, { dir: n });
  }
  return { loft, cap, rod, strip };
}

/** A plan ring: n points CCW about (cx, cy) at radius r(θ) (a number or a function of the angle). */
function ringAt(cx, cy, z, n, r, a0 = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * TAU, rr = typeof r === 'function' ? r(a) : r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z];
  });
}

// ─── CN Tower ─────────────────────────────────────────────────────────────────────────────────
// Real: 553 m; the Y-plan shaft (a hexagonal core with three concave-flanked legs at 120°) flares
// at the foot and thins into the main pod at ≈ 346 m (0.63 H); the SkyPod at 447 m (0.81 H); the
// concrete ends ≈ 457 m and the antenna runs to the tip.
const CN = {
  concrete: '#d6d4ce', concreteShade: '#b3afa6', glass: '#2a353e', glassLit: '#3b4c58', rim: '#e6e3dc',
  fin: '#a9a69e', antenna: '#cfd2d3', antennaBand: '#7c8488', plaza: '#a8a49a',
};

function cnTower(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), { lathe, tri } = kit, { loft } = towerTools(kit);
  const { S, cx, cy, z0 } = frameOf(b);
  const H = S * 3.72, Z = (u) => z0 + u * H;
  const legA = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6];

  // the Y outline at a level: R leg reach, rc core radius, tw leg tip half-width (all in S)
  const yRing = (z, R, rc, tw) => {
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = legA[k], u = [Math.cos(a), Math.sin(a)], t = [-u[1], u[0]];
      const P = (r, w) => [cx + (u[0] * r + t[0] * w) * S, cy + (u[1] * r + t[1] * w) * S, z];
      const root = Math.min(rc * 1.2, R * 0.8), rm = lerp(root, R, 0.55);
      pts.push(P(root, -tw * 1.3), P(rm, -tw * 1.12), P(R, -tw), P(R, tw), P(rm, tw * 1.12), P(root, tw * 1.3));
      const am = a + Math.PI / 3;
      pts.push([cx + Math.cos(am) * rc * S, cy + Math.sin(am) * rc * S, z]);
    }
    return pts;
  };
  // [u, R, rc, tw] — the flared foot, the long taper, the slim upper shaft to the SkyPod
  const SHAFT = [
    [0, 0.47, 0.11, 0.06], [0.025, 0.42, 0.105, 0.056], [0.07, 0.31, 0.1, 0.05], [0.16, 0.225, 0.1, 0.045],
    [0.3, 0.17, 0.088, 0.04], [0.45, 0.135, 0.078, 0.035], [0.585, 0.112, 0.07, 0.031],
  ];
  const UPPER = [[0.66, 0.088, 0.064, 0.028], [0.74, 0.078, 0.06, 0.026], [0.835, 0.07, 0.056, 0.024]];
  const legTint = (i) => (i % 7 >= 5 ? CN.concreteShade : CN.concrete);   // the concave flanks a shade down
  loft(SHAFT.map(([u, R, rc, tw]) => yRing(Z(u), R, rc, tw)), legTint);
  loft(UPPER.map(([u, R, rc, tw]) => yRing(Z(u), R, rc, tw)), legTint);
  // a flute down each leg face: a dark hairline groove on the tip, following the leg to the pod
  for (let k = 0; k < 3; k++) {
    const a = legA[k], u = [Math.cos(a), Math.sin(a)];
    for (let s = 0; s < SHAFT.length - 1; s++) {
      const [ua, Ra] = SHAFT[s], [ub, Rb] = SHAFT[s + 1];
      const A = [cx + u[0] * (Ra + 0.002) * S, cy + u[1] * (Ra + 0.002) * S, Z(ua)];
      const B = [cx + u[0] * (Rb + 0.002) * S, cy + u[1] * (Rb + 0.002) * S, Z(ub)];
      const t = [-u[1] * S * 0.008, u[0] * S * 0.008, 0];
      kit.quad([add(A, t), sub(A, t), sub(B, t), add(B, t)], CN.fin, { dir: [u[0], u[1], 0] });
    }
  }

  // the main pod: fin-ribbed concrete underside, the white radome ring, two glass levels, the roof
  const pz = Z(0.57), r = (v) => v * S, q = (v) => v * S * 1.18;
  lathe(cx, cy, [[q(0.085), pz], [q(0.2), pz + q(0.07)]], 24, CN.concreteShade);
  lathe(cx, cy, [[q(0.2), pz + q(0.07)], [q(0.232), pz + q(0.09)], [q(0.236), pz + q(0.115)], [q(0.222), pz + q(0.132)]], 24, CN.rim);
  lathe(cx, cy, [[q(0.222), pz + q(0.132)], [q(0.246), pz + q(0.19)]], 24, CN.glass);
  lathe(cx, cy, [[q(0.246), pz + q(0.19)], [q(0.25), pz + q(0.2)], [q(0.246), pz + q(0.21)]], 24, CN.rim);
  lathe(cx, cy, [[q(0.246), pz + q(0.21)], [q(0.226), pz + q(0.262)]], 24, CN.glassLit);
  lathe(cx, cy, [[q(0.226), pz + q(0.262)], [q(0.212), pz + q(0.28)], [q(0.09), pz + q(0.33)]], 24, CN.concrete);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + Math.PI / 12, c = Math.cos(a), s = Math.sin(a);
    const A = [cx + c * q(0.08), cy + s * q(0.08), pz - q(0.01)], B = [cx + c * q(0.215), cy + s * q(0.215), pz + q(0.072)];
    const C = [cx + c * q(0.215), cy + s * q(0.215), pz + q(0.1)];
    tri(A, B, C, CN.fin);
  }

  // the SkyPod, then the antenna mast in light steel with dark service rings
  const sz = Z(0.8);
  lathe(cx, cy, [[r(0.055), sz], [r(0.105), sz + r(0.035)]], 16, CN.concreteShade);
  lathe(cx, cy, [[r(0.105), sz + r(0.035)], [r(0.108), sz + r(0.085)]], 16, CN.glass);
  lathe(cx, cy, [[r(0.108), sz + r(0.085)], [r(0.1), sz + r(0.1)], [r(0.055), sz + r(0.125)]], 16, CN.concrete);
  const az = Z(0.835);
  lathe(cx, cy, [[r(0.05), az], [r(0.04), az + r(0.02)]], 12, CN.concrete);
  const mast = [[0.04, 0.84], [0.034, 0.885], [0.028, 0.93], [0.02, 0.965], [0.012, 0.99], [0, 1]];
  for (let i = 0; i < mast.length - 1; i++) {
    const [ra, ua] = mast[i], [rb, ub] = mast[i + 1];
    lathe(cx, cy, [[r(ra), Z(ua)], [r(rb), Z(ub)]], 10, CN.antenna);
    if (i < mast.length - 2) lathe(cx, cy, [[r(rb) * 1.25, Z(ub) - r(0.01)], [r(rb) * 1.25, Z(ub) + r(0.01)]], 10, CN.antennaBand);
  }
  return faces;
}

// ─── Washington Monument ───────────────────────────────────────────────────────────────────────
// Real: 169 m over a 16.8 m base (10 : 1), the shaft top at 152 m (0.9 H) under the pyramidion,
// the marble changing colour at ≈ 46 m (0.27 H) where building paused; 50 flags ring the base.
const WM = {
  low: '#ddd2bb', lowShade: '#c4baa5', high: '#fbf8f2', seam: '#a99f8a', window: '#2d343b',
  tip: '#9aa0a3', plaza: '#c2bfb6', walk: '#aba89f', pole: '#e8e8e4', flag: '#a9443d', canton: '#2c3c66',
};

function washingtonMonument(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), { quad, tri, lathe } = kit;
  const { S, cx, cy, z0 } = frameOf(b);
  const H = S * 6.0, shaftTop = H * 0.9, split = H * 0.27;
  const h0 = S * 0.3, h1 = h0 * 0.625, hAt = (z) => lerp(h0, h1, z / shaftTop);
  const zb = S * 0.035;                                        // the terrace the shaft stands on

  // a round plaza, the low terrace, the paved ring the flags stand on
  lathe(cx, cy, [[S * 0.49, z0], [S * 0.49, z0 + S * 0.012]], 32, WM.walk, { capTop: WM.plaza });
  kit.box(cx - S * 0.36, cy - S * 0.36, z0 + S * 0.012, cx + S * 0.36, cy + S * 0.36, z0 + zb, { side: WM.lowShade, top: WM.plaza });

  const C = (hx, hy, z) => [cx + hx, cy + hy, z0 + zb + z];
  const inside = (z) => [cx, cy, z0 + zb + z];
  const seg = (za, zc, tint) => {
    const a = hAt(za), c = hAt(zc);
    quad([C(-a, -a, za), C(a, -a, za), C(c, -c, zc), C(-c, -c, zc)], tint, inside((za + zc) / 2));
    quad([C(a, -a, za), C(a, a, za), C(c, c, zc), C(c, -c, zc)], tint, inside((za + zc) / 2));
    quad([C(a, a, za), C(-a, a, za), C(-c, c, zc), C(c, c, zc)], tint, inside((za + zc) / 2));
    quad([C(-a, a, za), C(-a, -a, za), C(-c, -c, zc), C(-c, c, zc)], tint, inside((za + zc) / 2));
  };
  seg(0, split, WM.low);
  seg(split, split + S * 0.012, WM.seam);                     // the pause line, a hair darker
  seg(split + S * 0.012, shaftTop, WM.high);

  // the pyramidion (four steep faces) and its aluminium tip
  const t = shaftTop, ap = C(0, 0, H - zb - S * 0.03);
  for (const [a, c] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) {
    tri(C(a[0] * h1, a[1] * h1, t), C(c[0] * h1, c[1] * h1, t), ap, WM.high, inside(t + S * 0.1));
  }
  lathe(cx, cy, [[S * 0.012, ap[2]], [0, z0 + H]], 6, WM.tip);

  // the observation windows: two a face, just under the shaft top
  const zw = t - S * 0.14, hw = hAt(zw), ww = h1 * 0.075;
  for (const [nx, ny] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const tx = -ny, ty = nx;
    for (const s of [-0.3, 0.3]) {
      const o = [cx + nx * (hw + S * 0.004) + tx * s * h1, cy + ny * (hw + S * 0.004) + ty * s * h1, z0 + zb + zw];
      quad([[o[0] - tx * ww, o[1] - ty * ww, o[2]], [o[0] + tx * ww, o[1] + ty * ww, o[2]], [o[0] + tx * ww, o[1] + ty * ww, o[2] + ww * 2], [o[0] - tx * ww, o[1] - ty * ww, o[2] + ww * 2]], WM.window, { dir: [nx, ny, 0] });
    }
  }

  // the ring of flags: white poles with a flag each, all flying the same way
  const NF = 24, rf = S * 0.45, pole = S * 0.34;
  for (let i = 0; i < NF; i++) {
    const a = (i / NF) * TAU, px = cx + Math.cos(a) * rf, py = cy + Math.sin(a) * rf, pz = z0 + S * 0.012;
    kit.quad([[px - S * 0.004, py, pz], [px + S * 0.004, py, pz], [px + S * 0.004, py, pz + pole], [px - S * 0.004, py, pz + pole]], WM.pole);
    const fx = S * 0.05, fz = S * 0.034, top = pz + pole - S * 0.006;
    kit.quad([[px, py, top - fz], [px + fx, py, top - fz], [px + fx, py, top], [px, py, top]], WM.flag);
    kit.quad([[px, py + 0.002, top - fz * 0.5], [px + fx * 0.42, py + 0.002, top - fz * 0.5], [px + fx * 0.42, py + 0.002, top], [px, py + 0.002, top]], WM.canton);
  }
  return faces;
}

// ─── Lattice pylons (Eiffel, Tokyo) ──────────────────────────────────────────────────────────────
// A pylon is four box-girder LEGS (each a square in plan between the `inP` and `outP` half-widths)
// that close into one square SHAFT once the gap between them shuts. Each face is a dark backing (the
// lattice seen into, in shadow) carrying its members as lit strips: the corner chords, a belt at
// every panel line, and an X in every bay — so the pattern follows the legs and the eye reads iron,
// not a solid, and not a shimmer of hairlines either.
function latticeTools(kit, tools) {
  const { quad } = kit, { strip } = tools;
  /** A lattice panel A B (bottom) C D (top), outward `out` (a point inside or {dir}). */
  function panel(A, B, C, D, out, back, member, w, { x = true, edges = true, belt = true } = {}) {
    let n = norm(cross(sub(B, A), sub(D, A)));
    if (out.dir ? v3.dot(n, out.dir) < 0 : v3.dot(n, sub(A, out)) < 0) n = mul(n, -1);
    if (back) quad([A, B, C, D], back, { dir: n });
    if (!member) return;
    const wb = len(sub(B, A)), wt = len(sub(C, D));
    const inset = (P, Q, k) => v3.lerp(P, Q, Math.min(0.45, k));
    if (edges) {
      strip(inset(A, B, w / 2 / wb), inset(D, C, w / 2 / Math.max(wt, 1e-6)), w, n, member);
      strip(inset(B, A, w / 2 / wb), inset(C, D, w / 2 / Math.max(wt, 1e-6)), w, n, member);
    }
    if (belt) strip(A, B, w, n, member, 0.006);
    if (x) {
      strip(A, C, w * 0.7, n, member, 0.005);
      strip(B, D, w * 0.7, n, member, 0.005);
    }
  }
  /**
   * The pylon. `levels` is the u list (0 → top of the lattice); legs stand while inP(u) > 0.
   * `tint(u)` → { back, member }. Z(u) → world z. Returns nothing; pushes faces.
   */
  function pylon({ cx, cy, S, Z, outP, inP, levels, tint, w }) {
    const Q = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let k = 0; k < levels.length - 1; k++) {
      const ua = levels[k], ub = levels[k + 1], um = (ua + ub) / 2, { back, member } = tint(um);
      const oa = outP(ua) * S, ob = outP(ub) * S, ia = inP(ua) * S, ib = inP(ub) * S, za = Z(ua), zb = Z(ub);
      const ww = w(um) * S;
      if (ia > 1e-6 || ib > 1e-6) {
        for (const [sx, sy] of Q) {
          const p = (x, y, z) => [cx + sx * x, cy + sy * y, z];
          const ctr = { a: [(ia + oa) / 2, (ia + oa) / 2], b: [(ib + ob) / 2, (ib + ob) / 2] };
          const inside = p((ctr.a[0] + ctr.b[0]) / 2, (ctr.a[1] + ctr.b[1]) / 2, (za + zb) / 2);
          // outer x, outer y, inner x, inner y
          panel(p(oa, ia, za), p(oa, oa, za), p(ob, ob, zb), p(ob, ib, zb), inside, back, member, ww);
          panel(p(ia, oa, za), p(oa, oa, za), p(ob, ob, zb), p(ib, ob, zb), inside, back, member, ww);
          if (ia > S * 0.01) {
            panel(p(ia, ia, za), p(ia, oa, za), p(ib, ob, zb), p(ib, ib, zb), inside, back, member, ww);
            panel(p(ia, ia, za), p(oa, ia, za), p(ob, ib, zb), p(ib, ib, zb), inside, back, member, ww);
          }
        }
      } else {
        const inside = [cx, cy, (za + zb) / 2];
        for (let i = 0; i < 4; i++) {
          const [ax, ay] = Q[i], [bx, by] = Q[(i + 1) % 4];
          panel([cx + ax * oa, cy + ay * oa, za], [cx + bx * oa, cy + by * oa, za], [cx + bx * ob, cy + by * ob, zb], [cx + ax * ob, cy + ay * ob, zb], inside, back, member, ww);
        }
      }
    }
  }
  return { panel, pylon };
}

/** A square (or chamfered, `ch` > 0) deck slab/box about (cx, cy), half-width h, z0 → z1. */
function deckBox(kit, tools, cx, cy, h, za, zb, side, top, ch = 0) {
  if (ch <= 0) return kit.box(cx - h, cy - h, za, cx + h, cy + h, zb, { side, top });
  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const c = Math.cos(a), s = Math.sin(a), t = [-s, c];
    pts.push([cx + c * h + t[0] * (h - ch), cy + s * h + t[1] * (h - ch)]);
    pts.push([cx + c * (h - ch) + t[0] * h, cy + s * (h - ch) + t[1] * h]);
  }
  kit.prism(pts.map(([x, y]) => [x, y]), za, zb, side, { cap: top });
}

// ─── Eiffel Tower ──────────────────────────────────────────────────────────────────────────────
// Real: 330 m over a 125 m square; platforms at 57 / 115 / 276 m (0.17 / 0.35 / 0.84 H); four legs
// on masonry piers curve in and close into one shaft at the second platform; the decorative arches
// under the first platform span between the legs on each face. Eiffel bronze-brown.
const EIF = {
  back: '#3f3226', member: '#86694b', memberLit: '#957757', deck: '#6f5a44', deckTop: '#8d7a62',
  frieze: '#a08567', window: '#2b2620', pier: '#bdb198', pierTop: '#cbc1aa', glass: '#3a4148',
};

function eiffelTower(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), tools = towerTools(kit), { pylon } = latticeTools(kit, tools);
  const { S, cx, cy, z0 } = frameOf(b);
  const H = S * 2.64, Z = (u) => z0 + u * H;
  const OUT = [[0, 0.47], [0.04, 0.42], [0.1, 0.36], [0.17, 0.29], [0.25, 0.215], [0.35, 0.145], [0.45, 0.1], [0.55, 0.077], [0.7, 0.052], [0.84, 0.035], [0.9, 0.028]];
  const IN = [[0, 0.265], [0.04, 0.24], [0.1, 0.205], [0.17, 0.165], [0.25, 0.1], [0.31, 0.045], [0.35, 0], [1, 0]];
  const outP = (u) => piece(OUT, u)[0], inP = (u) => Math.max(0, piece(IN, u)[0]);

  // the masonry piers under the four feet
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const a = 0.245 * S, c = 0.49 * S;
    kit.box(cx + Math.min(sx * a, sx * c), cy + Math.min(sy * a, sy * c), z0, cx + Math.max(sx * a, sx * c), cy + Math.max(sy * a, sy * c), Z(0.018), { side: EIF.pier, top: EIF.pierTop });
  }
  pylon({
    cx, cy, S, Z, outP, inP,
    levels: [0.018, 0.06, 0.11, 0.17, 0.215, 0.26, 0.305, 0.35, 0.42, 0.5, 0.58, 0.66, 0.73, 0.79, 0.84],
    tint: (u) => ({ back: EIF.back, member: u < 0.35 ? EIF.member : EIF.memberLit }),
    w: (u) => lerp(0.02, 0.009, clamp01(u / 0.84)),
  });

  // the great arches: one per face, springing from the legs up to the first platform's soffit
  const archY = 0.29 * S, us = 0.03, a0 = inP(us) * S + S * 0.01, zs = Z(us), za = Z(0.155), NA = 14, bw = S * 0.035, bd = S * 0.02;
  for (let f = 0; f < 4; f++) {
    const rot = (x, y, z) => { const c = Math.cos(f * Math.PI / 2), s = Math.sin(f * Math.PI / 2); return [cx + x * c - y * s, cy + x * s + y * c, z]; };
    const pt = (t, grow, dy) => { const a = Math.PI * t; return rot(-Math.cos(a) * (a0 + grow), -archY + dy, zs + Math.sin(a) * (za - zs + grow)); };
    const outDir = (() => { const c = Math.cos(f * Math.PI / 2), s = Math.sin(f * Math.PI / 2); return [s, -c, 0]; })();
    for (let i = 0; i < NA; i++) {
      const t0 = i / NA, t1 = (i + 1) / NA;
      kit.quad([pt(t0, 0, -bd), pt(t1, 0, -bd), pt(t1, bw, -bd), pt(t0, bw, -bd)], EIF.memberLit, { dir: outDir });
      kit.quad([pt(t0, 0, bd), pt(t1, 0, bd), pt(t1, bw, bd), pt(t0, bw, bd)], EIF.member, { dir: mul(outDir, -1) });
      const mid = pt((t0 + t1) / 2, -S, 0);                                   // the soffit faces the arch's centre
      kit.quad([pt(t0, 0, -bd), pt(t1, 0, -bd), pt(t1, 0, bd), pt(t0, 0, bd)], EIF.back, mid);
    }
  }

  // the three platforms: a deep frieze at the first, a glazed band at the second, the top cabin
  const p1 = outP(0.17) + 0.025, z1a = Z(0.155), z1b = Z(0.185);
  kit.box(cx - p1 * S, cy - p1 * S, z1a, cx + p1 * S, cy + p1 * S, z1b, { side: EIF.frieze, top: EIF.deckTop });
  const walls = kit.blockWalls(cx - p1 * S, cy - p1 * S, cx + p1 * S, cy + p1 * S, z1a);
  for (const k of ['south', 'east', 'north', 'west']) {
    const wl = walls[k], n = 11, span = walls.len[k], hz = z1b - z1a;
    for (let i = 0; i < n; i++) {
      const s0 = span * (i + 0.2) / n, s1 = span * (i + 0.8) / n;
      wl.rect(s0, hz * 0.3, s1, hz * 0.78, EIF.window, 0.01);
    }
    wl.proud(0, hz * 0.9, span, hz, S * 0.006, EIF.deckTop);
  }
  const p2 = outP(0.35) + 0.03;
  deckBox(kit, tools, cx, cy, p2 * S, Z(0.345), Z(0.37), EIF.deck, EIF.deckTop);
  const w2 = kit.blockWalls(cx - p2 * S, cy - p2 * S, cx + p2 * S, cy + p2 * S, Z(0.345));
  for (const k of ['south', 'east', 'north', 'west']) w2[k].rect(S * 0.01, (Z(0.37) - Z(0.345)) * 0.3, w2.len[k] - S * 0.01, (Z(0.37) - Z(0.345)) * 0.75, EIF.glass, 0.006);
  deckBox(kit, tools, cx, cy, (outP(0.84) + 0.015) * S, Z(0.835), Z(0.845), EIF.deck, EIF.deckTop);
  deckBox(kit, tools, cx, cy, outP(0.84) * S * 0.7, Z(0.845), Z(0.866), EIF.glass, EIF.deckTop);
  kit.lathe(cx, cy, [[outP(0.84) * S * 0.7, Z(0.866)], [outP(0.84) * S * 0.45, Z(0.885)], [S * 0.014, Z(0.9)]], 8, EIF.memberLit);
  kit.lathe(cx, cy, [[S * 0.012, Z(0.9)], [S * 0.008, Z(0.96)], [0, Z(1)]], 6, EIF.memberLit);
  return faces;
}

// ─── Tokyo Tower ───────────────────────────────────────────────────────────────────────────────
// Real: 333 m; the legs straddle FootTown (the four-storey podium) and close into one shaft about a
// fifth of the way up; the Main Deck at 150 m (0.45 H), the Top Deck at 250 m (0.75 H), the antenna
// above; painted international orange and white in bands that get closer together toward the top.
const TKY = {
  orange: '#d0532c', white: '#ebe7df', deck: '#e4e2dc', deckGlass: '#45535d', deckRoof: '#b7b8b4',
  foot: '#dcd6c8', footGlass: '#56656e', footRoof: '#a9a69c',
};
const TKY_BANDS = [0, 0.19, 0.25, 0.36, 0.42, 0.53, 0.585, 0.64, 0.69, 0.745, 0.8, 0.85, 0.895, 0.935, 0.97, 1.01];

function tokyoTower(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), tools = towerTools(kit), { pylon } = latticeTools(kit, tools);
  const { S, cx, cy, z0 } = frameOf(b);
  const H = S * 3.3, Z = (u) => z0 + u * H;
  const OUT = [[0, 0.44], [0.06, 0.36], [0.13, 0.28], [0.22, 0.2], [0.33, 0.145], [0.45, 0.105], [0.6, 0.075], [0.75, 0.052], [0.82, 0.04], [0.9, 0.026]];
  const IN = [[0, 0.3], [0.06, 0.24], [0.13, 0.155], [0.19, 0.07], [0.22, 0], [1, 0]];
  const outP = (u) => piece(OUT, u)[0], inP = (u) => Math.max(0, piece(IN, u)[0]);
  const orangeAt = (u) => { let k = 0; while (k < TKY_BANDS.length - 1 && u >= TKY_BANDS[k + 1]) k++; return k % 2 === 0; };
  const col = (u) => (orangeAt(u) ? TKY.orange : TKY.white);

  // FootTown: the four-storey podium the legs stand through
  const fz = Z(0.068), fx = 0.48 * S, fy = 0.46 * S;
  kit.box(cx - fx, cy - fy, z0, cx + fx, cy + fy, fz, { side: TKY.foot, top: TKY.footRoof });
  const fw = kit.blockWalls(cx - fx, cy - fy, cx + fx, cy + fy, z0);
  for (const k of ['south', 'east', 'north', 'west']) {
    const hz = fz - z0;
    for (let f = 0; f < 2; f++) fw[k].rect(S * 0.03, hz * (0.16 + f * 0.4), fw.len[k] - S * 0.03, hz * (0.38 + f * 0.4), TKY.footGlass, 0.008);
  }
  kit.box(cx - fx * 0.55, cy - fy * 0.6, fz, cx + fx * 0.55, cy + fy * 0.6, fz + S * 0.035, { side: TKY.foot, top: TKY.footRoof });

  // the lattice, cut at every band edge so a band never straddles two colours
  const levels = [...new Set([0, 0.04, 0.09, 0.14, 0.19, 0.22, 0.25, 0.3, 0.36, 0.42, 0.53, 0.585, 0.64, 0.69, 0.745, 0.8, 0.85, 0.9])].sort((a, c) => a - c);
  pylon({
    cx, cy, S, Z, outP, inP, levels,
    tint: (u) => ({ back: mixHex(col(u), '#2a2522', orangeAt(u) ? 0.42 : 0.26), member: col(u) }),
    w: (u) => lerp(0.018, 0.008, clamp01(u / 0.9)),
  });

  // the Main Deck (two storeys, chamfered) and the Top Deck; glass bands between white rims
  const md = (outP(0.45) + 0.075) * S;
  deckBox(kit, tools, cx, cy, md, Z(0.43), Z(0.44), TKY.deckRoof, TKY.deckRoof, md * 0.3);
  deckBox(kit, tools, cx, cy, md * 1.02, Z(0.44), Z(0.462), TKY.deckGlass, TKY.deck, md * 0.3);
  deckBox(kit, tools, cx, cy, md * 1.02, Z(0.462), Z(0.47), TKY.deck, TKY.deck, md * 0.3);
  deckBox(kit, tools, cx, cy, md * 0.96, Z(0.47), Z(0.488), TKY.deckGlass, TKY.deck, md * 0.29);
  deckBox(kit, tools, cx, cy, md * 0.96, Z(0.488), Z(0.497), TKY.deck, TKY.deckRoof, md * 0.29);
  const td = (outP(0.75) + 0.03) * S;
  deckBox(kit, tools, cx, cy, td, Z(0.735), Z(0.742), TKY.deck, TKY.deck, td * 0.3);
  deckBox(kit, tools, cx, cy, td, Z(0.742), Z(0.757), TKY.deckGlass, TKY.deck, td * 0.3);
  deckBox(kit, tools, cx, cy, td, Z(0.757), Z(0.764), TKY.deck, TKY.deckRoof, td * 0.3);

  // the antenna: a banded mast above the lattice to the tip
  const mast = [[0.9, 0.02], [0.935, 0.016], [0.97, 0.011], [1.0, 0.004]];
  for (let i = 0; i < mast.length - 1; i++) {
    const [ua, ra] = mast[i], [ub, rb] = mast[i + 1];
    kit.lathe(cx, cy, [[ra * S, Z(ua)], [rb * S, Z(ub)]], 8, col((ua + ub) / 2));
  }
  return faces;
}

// ─── Tokyo Skytree ─────────────────────────────────────────────────────────────────────────────
// Real: 634 m; the plan is a triangle at the foot that rounds into a circle by ≈ 300 m, the body a
// pale "Skytree white" diagonal steel lattice over the core; the Tembo Deck drum at 350 m (0.55 H),
// the Tembo Galleria ring at 450 m (0.71 H), then the gain tower and antenna to the tip.
const SKY = {
  white: '#eef2f3', back: '#bac4c9', backLo: '#aab4ba', glass: '#3d4c56', rim: '#f2f4f4', mast: '#d9dfe2',
  band: '#8b979d', plinth: '#9d9d98',
};

function skytree(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), { lathe } = kit, { loft, strip } = towerTools(kit);
  const { S, cx, cy, z0 } = frameOf(b);
  const H = S * 4.9, Z = (u) => z0 + u * H, N = 24;
  // the triangle (vertex = 1) blended to a circle as the body rises
  const vtx = [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6];
  const tri = (a) => {
    let best = Infinity;
    for (const v of vtx) { const en = v + Math.PI / 3; let d = Math.atan2(Math.sin(a - en), Math.cos(a - en)); best = Math.min(best, Math.abs(d)); }
    return Math.min(1, 0.5 / Math.cos(Math.min(best, Math.PI / 3)));
  };
  const BODY = [[0, 0.42], [0.04, 0.36], [0.1, 0.29], [0.17, 0.23], [0.25, 0.185], [0.33, 0.155], [0.41, 0.135], [0.49, 0.122]];
  const ringU = (u, R) => {
    const m = clamp01(u / 0.36), mm = m * m * (3 - 2 * m);
    return ringAt(cx, cy, Z(u), N, (a) => R * S * lerp(tri(a) * 1.12, 1, mm), -Math.PI / 2);
  };
  const rings = BODY.map(([u, R]) => ringU(u, R));
  // the flat triangle faces carry the lattice's darker depth; the lattice members run over them
  loft(rings, (i, k) => (k < 2 ? SKY.backLo : SKY.back));
  const nrm = (k, i) => { const j = (i + 1) % N, A = rings[k][i], B = rings[k][j]; return norm([B[1] - A[1], -(B[0] - A[0]), 0]); };
  for (let k = 0; k < rings.length - 1; k++) {
    const ww = S * lerp(0.02, 0.012, k / (rings.length - 1));
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, n = nrm(k, i), A = rings[k][i], B = rings[k][j], C = rings[k + 1][j], D = rings[k + 1][i];
      if ((i + k) % 2 === 0) strip(A, C, ww, n, SKY.white, 0.006); else strip(B, D, ww, n, SKY.white, 0.006);
      strip(A, B, ww * 0.8, n, SKY.white, 0.005);
    }
  }
  // the three foot columns at the triangle's corners, white tubes rising into the lattice
  for (const v of vtx) {
    const P = (u, R) => [cx + Math.cos(v) * R * S * 1.12 * 0.985, cy + Math.sin(v) * R * S * 1.12 * 0.985, Z(u)];
    tools_col(kit, P(0, 0.42), P(0.17, 0.23 * 0.98), S * 0.03, SKY.white);
  }
  lathe(cx, cy, [[S * 0.1, z0], [S * 0.1, z0 + S * 0.02]], 12, SKY.plinth, { capTop: SKY.plinth });

  // the Tembo Deck: a white underside, three glazed floors in two bands, a white roof ring
  const d0 = Z(0.49), r = (v) => v * S;
  lathe(cx, cy, [[r(0.12), d0], [r(0.2), d0 + r(0.07)], [r(0.215), d0 + r(0.085)]], N, SKY.rim);
  lathe(cx, cy, [[r(0.215), d0 + r(0.085)], [r(0.222), d0 + r(0.2)]], N, SKY.glass);
  lathe(cx, cy, [[r(0.222), d0 + r(0.2)], [r(0.224), d0 + r(0.215)]], N, SKY.rim);
  lathe(cx, cy, [[r(0.224), d0 + r(0.215)], [r(0.215), d0 + r(0.27)]], N, SKY.glass);
  lathe(cx, cy, [[r(0.215), d0 + r(0.27)], [r(0.205), d0 + r(0.29)], [r(0.11), d0 + r(0.32)]], N, SKY.rim);
  // the upper lattice shaft (round now) to the Galleria
  const upRings = [[0.555, 0.108], [0.62, 0.098], [0.69, 0.088]].map(([u, R]) => ringAt(cx, cy, Z(u), 16, R * S));
  loft(upRings, SKY.back);
  for (let k = 0; k < upRings.length - 1; k++) for (let i = 0; i < 16; i++) {
    const j = (i + 1) % 16, A = upRings[k][i], B = upRings[k][j], C = upRings[k + 1][j], D = upRings[k + 1][i];
    const n = norm([B[1] - A[1], -(B[0] - A[0]), 0]);
    if ((i + k) % 2 === 0) strip(A, C, S * 0.009, n, SKY.white, 0.006); else strip(B, D, S * 0.009, n, SKY.white, 0.006);
  }
  // the Tembo Galleria: a slim glazed ring with white rims
  const g0 = Z(0.69);
  lathe(cx, cy, [[r(0.088), g0], [r(0.15), g0 + r(0.04)]], N, SKY.rim);
  lathe(cx, cy, [[r(0.15), g0 + r(0.04)], [r(0.155), g0 + r(0.11)]], N, SKY.glass);
  lathe(cx, cy, [[r(0.155), g0 + r(0.11)], [r(0.145), g0 + r(0.125)], [r(0.075), g0 + r(0.15)]], N, SKY.rim);
  // the gain tower and the antenna, grey-white, banded where the equipment rings sit
  const mast = [[0.72, 0.072], [0.78, 0.064], [0.84, 0.052], [0.9, 0.04], [0.95, 0.026], [0.985, 0.012], [1, 0]];
  for (let i = 0; i < mast.length - 1; i++) {
    const [ua, ra] = mast[i], [ub, rb] = mast[i + 1];
    lathe(cx, cy, [[ra * S, Z(ua)], [rb * S, Z(ub)]], 12, i % 2 ? SKY.mast : SKY.white);
    if (i > 0 && i < 5) lathe(cx, cy, [[ra * S * 1.3, Z(ua) - r(0.012)], [ra * S * 1.3, Z(ua) + r(0.012)]], 12, SKY.band);
  }
  return faces;
}
/** A slim round column A→B (a lathe along an arbitrary axis, 6 sides). */
function tools_col(kit, A, B, rr, tint) { towerTools(kit).rod(A, B, rr, tint, { sides: 6 }); }

// ─── Empire State Building ─────────────────────────────────────────────────────────────────────
// Real: 443 m to the tip over a 129 m lot. The five-storey base fills the lot; setbacks at the 21st,
// 25th and 30th floors; the long shaft (notched corners, the windows in continuous vertical strips
// between Indiana limestone piers with metal mullions) to the 72nd; steps at the 72nd and 81st; the
// 86th-floor observatory; the Art Deco crown and the mooring mast; the antenna.
const ESB = {
  stone: '#ddd5c3', stoneTop: '#c4bcaa', window: '#6d737a', crown: '#c9ced1', crownFin: '#e3e6e7',
  mast: '#bfc5c9', mastGlass: '#46525c', antenna: '#a8adb0',
};

function empireState(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), { lathe, rod } = { ...kit, ...towerTools(kit) };
  const { S, cx, cy, z0, P } = frameOf(b);
  const H = S * 5.0, Z = (u) => z0 + u * H;
  const rect = (hx, hy) => { const a = P(-hx * S, -hy * S), c = P(hx * S, hy * S); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; };
  const pitch = S * 0.042, stripW = S * 0.015;
  // a block with its window strips: the strips run the tier's height and are spaced at one pitch
  const block = (hx, hy, ua, ub, { strips = true, top = ESB.stoneTop, side = ESB.stone, win = ESB.window, sill = 0.25 } = {}) => {
    const [x0, y0, x1, y1] = rect(hx, hy), za = Z(ua), zb = Z(ub);
    kit.box(x0, y0, za, x1, y1, zb, { side, top });
    if (!strips) return;
    const W = kit.blockWalls(x0, y0, x1, y1, za), h = zb - za, m = Math.min(S * sill * 0.1, h * 0.12);
    for (const k of ['south', 'east', 'north', 'west']) {
      const span = W.len[k], n = Math.max(1, Math.floor((span - S * 0.03) / pitch)), off = (span - (n - 1) * pitch) / 2;
      for (let i = 0; i < n; i++) W[k].rect(off + i * pitch - stripW / 2, m, off + i * pitch + stripW / 2, h - m, win, 0.012);
    }
  };
  // the base (the lot), the three low setbacks, the notched shaft, the upper steps
  block(0.65, 0.5, 0, 0.056, { top: ESB.stoneTop, sill: 0.6 });
  { const [x0, y0, x1, y1] = rect(0.65, 0.5), W = kit.blockWalls(x0, y0, x1, y1, z0), sp = W.len.south;   // the entrance
    W.south.recess(sp * 0.42, 0, sp * 0.58, (Z(0.056) - z0) * 0.8, S * 0.02, '#3b3f44', null, { frame: S * 0.015 }); }
  block(0.52, 0.42, 0.056, 0.2);
  block(0.47, 0.38, 0.2, 0.235);
  block(0.43, 0.345, 0.235, 0.28);
  block(0.37, 0.235, 0.28, 0.62);
  block(0.285, 0.3, 0.28, 0.62);
  block(0.29, 0.18, 0.62, 0.695);
  block(0.22, 0.23, 0.62, 0.695);
  block(0.2, 0.17, 0.695, 0.725, { strips: true });
  // the 86th-floor parapet, then the crown: three stepped drums dressed in aluminium fins
  const [px0, py0, px1, py1] = rect(0.205, 0.175);
  kit.box(px0, py0, Z(0.725), px1, py1, Z(0.73), { side: ESB.stone, top: ESB.stoneTop });
  const steps = [[0.15, 0.13, 0.73, 0.76], [0.12, 0.105, 0.76, 0.785], [0.09, 0.08, 0.785, 0.805]];
  for (const [hx, hy, ua, ub] of steps) {
    const [x0, y0, x1, y1] = rect(hx, hy), za = Z(ua), zb = Z(ub);
    kit.box(x0, y0, za, x1, y1, zb, { side: ESB.crown, top: ESB.stoneTop });
    const W = kit.blockWalls(x0, y0, x1, y1, za);
    for (const k of ['south', 'east', 'north', 'west']) {
      const span = W.len[k], n = 5;
      for (let i = 0; i < n; i++) W[k].proud(span * (i + 0.3) / n, 0, span * (i + 0.7) / n, zb - za + S * 0.02, S * 0.012, ESB.crownFin);
    }
  }
  // the mooring mast: glazed drum with four buttress wings, the dome cap, the antenna
  const m0 = Z(0.805), r = (v) => v * S;
  lathe(cx, cy, [[r(0.07), m0], [r(0.06), m0 + r(0.2)]], 12, ESB.mast);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    kit.quad([[cx + c * r(0.06), cy + s * r(0.06), m0], [cx + c * r(0.1), cy + s * r(0.1), m0], [cx + c * r(0.07), cy + s * r(0.07), m0 + r(0.22)], [cx + c * r(0.05), cy + s * r(0.05), m0 + r(0.22)]], ESB.crownFin);
  }
  lathe(cx, cy, [[r(0.061), m0 + r(0.07)], [r(0.058), m0 + r(0.17)]], 12, ESB.mastGlass);
  lathe(cx, cy, [[r(0.06), m0 + r(0.2)], [r(0.05), m0 + r(0.25)], [r(0.03), m0 + r(0.29)], [r(0.012), m0 + r(0.31)]], 12, ESB.mast);
  rod([cx, cy, m0 + r(0.3)], [cx, cy, Z(0.93)], r(0.011), ESB.antenna);
  rod([cx, cy, Z(0.93)], [cx, cy, Z(1)], r(0.005), ESB.antenna);
  return faces;
}

// ─── Petronas Towers ───────────────────────────────────────────────────────────────────────────
// Real: 452 m; each tower an 8-point star (two squares at 45°) with the inner corners filled by
// round lobes, clad in stainless steel and glass in horizontal ribbons; tiered setbacks from the
// 60th floor, the pinnacle; the double-deck skybridge at the 41st / 42nd (≈ 0.38 H) on its splayed
// legs; a round 44-storey bustle beside each tower.
const PET = {
  steel: '#a5aeb3', steelLit: '#dfe4e6', glass: '#56646d', bustle: '#9aa4a9', bridge: '#42505a',
  bridgeFrame: '#c8cfd2', leg: '#8e989d', podium: '#b8b3a7', pinnacle: '#d4d9db',
};

function petronas(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), { lathe } = kit, { loft, rod, cap } = towerTools(kit);
  const { S, cx, cy, z0, P } = frameOf(b);
  const H = S * 4.0, Z = (u) => z0 + u * H;
  // the star outline in plan, CCW: a point, a notch, the lobe crown, a notch — eight times
  const star = (ox, oy, R, z, scale = 1) => {
    const pts = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + Math.PI / 8, st = TAU / 8;
      for (const [f, rr] of [[0, 1], [0.2, 0.8], [0.5, 0.9], [0.8, 0.8]]) {
        const aa = a + st * f, [x, y] = P(ox + Math.cos(aa) * R * rr * S * scale, oy + Math.sin(aa) * R * rr * S * scale);
        pts.push([x, y, z]);
      }
    }
    return pts;
  };
  // [u, R]: the long shaft, then the setback tiers with their sloped skirts
  const PROFILE = [[0.02, 0.2], [0.53, 0.2], [0.545, 0.183], [0.64, 0.183], [0.655, 0.163], [0.715, 0.163], [0.728, 0.138], [0.76, 0.138], [0.772, 0.11], [0.8, 0.108], [0.83, 0.07]];
  const tower = (side) => {
    const ox = side * 0.46 * S;
    const rings = PROFILE.map(([u, R]) => star(ox, 0, R, Z(u)));
    loft(rings, (i, k) => (PROFILE[k][1] !== PROFILE[k + 1][1] ? PET.steelLit : PET.steel));
    cap(rings[rings.length - 1], PET.steelLit);
    // the ribbons: a proud stainless band at every floor-group, stepping in with the tiers
    for (let u = 0.035; u < 0.8; u += 0.028) {
      const R = piece(PROFILE, u)[0], R2 = piece(PROFILE, u + 0.009)[0];
      if (Math.abs(R - R2) > 1e-6) continue;
      loft([star(ox, 0, R, Z(u), 1.02), star(ox, 0, R, Z(u + 0.009), 1.02)], PET.steelLit);
    }
    // the pinnacle: a ringed spire, the ball, the needle
    const [px, py] = P(ox, 0), r = (v) => v * S;
    lathe(px, py, [[r(0.055), Z(0.83)], [r(0.042), Z(0.86)], [r(0.032), Z(0.89)]], 10, PET.pinnacle);
    for (const u of [0.845, 0.865, 0.885]) lathe(px, py, [[r(0.06 - (u - 0.84) * 0.9), Z(u)], [r(0.06 - (u - 0.84) * 0.9), Z(u) + r(0.012)]], 10, PET.steelLit);
    lathe(px, py, [[r(0.032), Z(0.89)], [r(0.02), Z(0.92)]], 10, PET.pinnacle);
    lathe(px, py, [[r(0.012), Z(0.92)], [r(0.026), Z(0.93)], [r(0.012), Z(0.94)]], 10, PET.steelLit);
    lathe(px, py, [[r(0.012), Z(0.94)], [0, Z(1)]], 6, PET.pinnacle);
    // the bustle: a round annex outboard and to the rear, half the tower's height
    const [bx, by] = P(ox + side * 0.14 * S, 0.19 * S);
    lathe(bx, by, [[r(0.1), z0], [r(0.1), Z(0.4)]], 16, PET.bustle);
    for (let u = 0.04; u < 0.39; u += 0.035) lathe(bx, by, [[r(0.102), Z(u)], [r(0.102), Z(u + 0.009)]], 16, PET.steelLit);
    lathe(bx, by, [[r(0.1), Z(0.4)], [r(0.085), Z(0.415)], [r(0.03), Z(0.425)]], 16, PET.steelLit);
  };
  tower(-1); tower(1);

  // the skybridge: two glazed decks in a steel frame, on its inverted-V legs
  const span = (0.46 - 0.175) * S, bz0 = Z(0.368), bz1 = Z(0.392);
  const bb = (hx, hy, za, zb, side, top) => { const a = P(-hx, -hy), c = P(hx, hy); kit.box(Math.min(a[0], c[0]), Math.min(a[1], c[1]), za, Math.max(a[0], c[0]), Math.max(a[1], c[1]), zb, { side, top }); };
  bb(span, S * 0.035, bz0, bz1, PET.bridge, PET.bridgeFrame);
  bb(span, S * 0.037, bz0 - S * 0.008, bz0, PET.bridgeFrame, PET.bridgeFrame);
  bb(span, S * 0.037, (bz0 + bz1) / 2 - S * 0.004, (bz0 + bz1) / 2 + S * 0.004, PET.bridgeFrame, PET.bridgeFrame);
  bb(span, S * 0.037, bz1, bz1 + S * 0.008, PET.bridgeFrame, PET.bridgeFrame);
  const hub = [...P(0, 0), bz0 - S * 0.01];
  for (const side of [-1, 1]) for (const dy of [-0.02, 0.02]) {
    const foot = [...P(side * (0.46 - 0.185) * S, dy * S), Z(0.27)];
    rod([...P(0, dy * S), hub[2]], foot, S * 0.009, PET.leg);
  }
  // the podium the pair stands on
  bb(0.7 * S, 0.3 * S, z0, z0 + S * 0.05, PET.podium, PET.podium);
  return faces;
}

// ─── Big Ben (the Elizabeth Tower) ────────────────────────────────────────────────────────────
// Real: 96 m on a 12 m square; Gothic Revival in golden Anston limestone, the shaft panelled in
// vertical tracery; the clock stage at ≈ 55 m with the four gilded dials (7 m); the belfry above
// with its pointed openings; the cast-iron spire with corner pinnacles, the lantern, the finial.
const BB = {
  stone: '#caa56c', stoneLit: '#d8b87f', stoneShade: '#a88657', tracery: '#dcc08b', window: '#3a3226',
  dialFrame: '#c79a3a', dial: '#ece6cf', dialRing: '#2a2c30', hand: '#1f2226', gold: '#d2a640',
  roof: '#3d4a58', roofRib: '#b99240', lantern: '#566270',
};

function bigBen(b, { L, camHint }) {
  const faces = [], kit = makeKit({ faces, L, camHint }), { tri, quad, lathe } = kit, { rod } = towerTools(kit);
  const { S, cx, cy, z0 } = frameOf(b);
  const H = S * 3.9, Z = (u) => z0 + u * H;
  const sq = (h, ua, ub, side, top) => kit.box(cx - h * S, cy - h * S, Z(ua), cx + h * S, cy + h * S, Z(ub), { side, top });
  const walls = (h, ua) => kit.blockWalls(cx - h * S, cy - h * S, cx + h * S, cy + h * S, Z(ua));
  const SIDES = ['south', 'east', 'north', 'west'];

  // plinth and the panelled shaft: corner buttresses, four tracery mullions a face, belt courses
  sq(0.27, 0, 0.02, BB.stoneShade, BB.stone);
  const hs = 0.245, s0 = 0.02, s1 = 0.535;
  sq(hs, s0, s1, BB.stone, BB.stone);
  const W = walls(hs, s0), wl = hs * 2 * S, hz = Z(s1) - Z(s0);
  for (const k of SIDES) {
    const w = W[k];
    w.proud(0, 0, S * 0.04, hz, S * 0.02, BB.stoneLit);
    w.proud(wl - S * 0.04, 0, wl, hz, S * 0.02, BB.stoneLit);
    for (const f of [0.17, 0.3, 0.5, 0.7, 0.83]) w.proud(wl * f - S * 0.009, 0, wl * f + S * 0.009, hz, S * 0.008, BB.tracery);
    const NB = 7;
    for (let i = 1; i <= NB; i++) w.proud(0, hz * i / (NB + 0.4) - S * 0.012, wl, hz * i / (NB + 0.4), S * 0.012, BB.tracery);
    for (let i = 0; i < NB; i++) {
      const t0 = hz * i / (NB + 0.4) + S * 0.05, t1 = hz * (i + 1) / (NB + 0.4) - S * 0.06;
      for (const [a, c] of [[0.34, 0.46], [0.54, 0.66]]) w.arch(wl * a, wl * c, t0, t1 - (wl * (c - a)) * 0.6, S * 0.01, BB.window, null, { seg: 4, pointed: true });
    }
  }

  // the clock stage: a wider block, a gilded square frame and the opal dial on each face
  const hc = 0.268, c0 = 0.535, c1 = 0.635;
  sq(hc, c0, c1, BB.stone, BB.stoneLit);
  sq(hc + 0.01, c0 - 0.004, c0 + 0.006, BB.tracery, BB.tracery);
  const CW = walls(hc, c0), cl = hc * 2 * S, ch = Z(c1) - Z(c0), dc = ch * 0.5, dr = S * 0.15;
  for (const k of SIDES) {
    const w = CW[k], mid = cl / 2;
    w.proud(mid - dr * 1.22, dc - dr * 1.22, mid + dr * 1.22, dc + dr * 1.22, S * 0.012, BB.dialFrame);
    const disc = (r, tint, lift) => { w.rect(mid - r, dc - r, mid + r, dc + r, tint, lift); faces[faces.length - 1].radius = '50%'; };
    disc(dr, BB.dialRing, S * 0.016);
    disc(dr * 0.9, BB.dial, S * 0.019);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, rr = dr * 0.76, tl = i % 3 === 0 ? dr * 0.13 : dr * 0.08;
      const sx = mid + Math.sin(a) * rr, sz = dc + Math.cos(a) * rr;
      const n = w.n, tip = w.at(sx + Math.sin(a) * tl, sz + Math.cos(a) * tl, S * 0.022), base = w.at(sx, sz, S * 0.022);
      towerTools(kit).strip(base, tip, S * 0.012, n, BB.hand, 0);
    }
    towerTools(kit).strip(w.at(mid, dc, S * 0.024), w.at(mid + dr * 0.35, dc + dr * 0.35, S * 0.024), S * 0.018, w.n, BB.hand, 0);
    towerTools(kit).strip(w.at(mid, dc, S * 0.025), w.at(mid - dr * 0.1, dc + dr * 0.68, S * 0.025), S * 0.012, w.n, BB.hand, 0);
  }
  // the gabled cornice above the dials, corner pinnacles on the clock stage
  const g0 = c1, g1 = c1 + 0.03;
  sq(hc + 0.008, g0, g0 + 0.008, BB.tracery, BB.stoneLit);
  for (const k of SIDES) {
    const w = CW[k];
    const A = w.at(cl * 0.22, Z(g0) - Z(c0), S * 0.006), B = w.at(cl * 0.78, Z(g0) - Z(c0), S * 0.006), T = w.at(cl * 0.5, Z(g1 + 0.02) - Z(c0), S * 0.006);
    tri(A, B, T, BB.stoneLit, { dir: w.n });
  }
  const pin = (x, y, ua, ub, r, capTint) => {
    kit.box(x - r, y - r, Z(ua), x + r, y + r, Z(ub), { side: BB.stoneLit, top: BB.stoneLit });
    lathe(x, y, [[r * 1.1, Z(ub)], [0, Z(ub) + r * 5]], 4, capTint);
  };
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pin(cx + sx * (hc - 0.02) * S, cy + sy * (hc - 0.02) * S, c1, g1 + 0.012, S * 0.028, BB.gold);

  // the belfry: pointed openings, three a face, under a cornice
  const hb = 0.228, b0 = g0 + 0.008, b1 = 0.745;
  sq(hb, b0, b1, BB.stone, BB.stoneLit);
  const BW = walls(hb, b0), bl = hb * 2 * S, bh = Z(b1) - Z(b0);
  for (const k of SIDES) {
    for (const [a, c] of [[0.14, 0.34], [0.4, 0.6], [0.66, 0.86]]) BW[k].arch(bl * a, bl * c, bh * 0.14, bh * 0.62, S * 0.02, BB.window, BB.tracery, { seg: 6, pointed: true });
  }
  sq(hb + 0.012, b1, b1 + 0.01, BB.tracery, BB.stoneLit);
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pin(cx + sx * hb * S, cy + sy * hb * S, b1 - 0.02, 0.8, S * 0.024, BB.gold);

  // the spire: the steep iron roof with gilded hips, the lantern, the upper spire, the finial
  const r0 = hb * S, rz0 = Z(b1 + 0.01), rz1 = Z(0.87), r1 = S * 0.09;
  const corner = (r, z) => [[cx - r, cy - r, z], [cx + r, cy - r, z], [cx + r, cy + r, z], [cx - r, cy + r, z]];
  const lo = corner(r0, rz0), hi = corner(r1, rz1);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad([lo[i], lo[j], hi[j], hi[i]], BB.roof, [cx, cy, (rz0 + rz1) / 2]);
    rod(lo[i], hi[i], S * 0.008, BB.roofRib);
  }
  // a row of small gilded lucarnes on each roof face
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, M = v3.lerp(v3.lerp(lo[i], lo[j], 0.5), v3.lerp(hi[i], hi[j], 0.5), 0.35);
    const o = norm([M[0] - cx, M[1] - cy, 0]), t = norm(sub(lo[j], lo[i])), s = S * 0.03;
    const A = add(add(M, mul(t, -s)), mul(o, S * 0.012)), B2 = add(add(M, mul(t, s)), mul(o, S * 0.012)), T = add(add(M, [0, 0, s * 2.2]), mul(o, S * 0.004));
    tri(A, B2, T, BB.gold, { dir: o });
  }
  kit.box(cx - r1, cy - r1, rz1, cx + r1, cy + r1, Z(0.905), { side: BB.lantern, top: BB.roof });
  const LW = kit.blockWalls(cx - r1, cy - r1, cx + r1, cy + r1, rz1), lh = Z(0.905) - rz1;
  for (const k of SIDES) for (const [a, c] of [[0.15, 0.45], [0.55, 0.85]]) LW[k].arch(2 * r1 * a, 2 * r1 * c, lh * 0.1, lh * 0.55, S * 0.01, '#1e2328', BB.roofRib, { seg: 4, pointed: true });
  const up = corner(r1 * 0.95, Z(0.905)), apex = [cx, cy, Z(0.975)];
  for (let i = 0; i < 4; i++) tri(up[i], up[(i + 1) % 4], apex, BB.roof, [cx, cy, Z(0.93)]);
  for (let i = 0; i < 4; i++) rod(up[i], apex, S * 0.006, BB.roofRib);
  lathe(cx, cy, [[S * 0.012, Z(0.965)], [S * 0.024, Z(0.982)], [S * 0.008, Z(0.99)], [0, Z(1)]], 6, BB.gold);
  return faces;
}

export const TOWERS = {
  'cn-tower': cnTower,
  'washington-monument': washingtonMonument,
  'eiffel-tower': eiffelTower,
  'tokyo-tower': tokyoTower,
  skytree,
  'empire-state-building': empireState,
  'petronas-towers': petronas,
  'big-ben': bigBen,
};
