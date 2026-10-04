/**
 * GOTHIC — the curved vocabulary that keeps a sixth-gen level from reading as voxels: pointed arches with real depth,
 * engaged columns, and a tall pointed barrel vault with ribs. Low segment counts (the era's budget), but no element is
 * a bare box: every opening has a reveal, a soffit and a moulded ring, every column is a polygon of `sides`, and the
 * ceiling is a vault, not a lid.
 *
 *   pointedArch(a, b, zs, H, seg)   → the curve from springing (a, zs) over the apex to (b, zs), as [u, z] points
 *   archBay(out, F, bay, kit, …)     → one wall bay: a blind arcade arch below, a string course, a lancet above
 *   engagedColumn(out, F, u, …)       → a half-column on the wall at u: base, shaft, capital
 *   naveVault(out, r, axis, kit, …)  → the vault over a room, transverse ribs at each bay, a ridge rib, lunettes
 *   portal(out, F, …)                → a great door in stepped orders under a hood moulding: a nave's scale break
 *   oculus(out, F, …)                → a round window with its reveal and ring
 *
 * Every face is a textured quad (geom.js `quad`/`panel`), lit and dirtied by the stage like the rest of the shell.
 */
import { add, mul, P, onWall, panel, quad, wallBox } from './geom.js';

const Z = [0, 0, 1];
const norm2 = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/**
 * A two-centred pointed arch over [a, b] springing at zs with rise H (H ≥ half-span; equilateral when H ≈ 0.866·span).
 * Each half is an arc of radius R = (h² + H²)/(2h) struck from a centre on the springing line. H ≤ 0 gives a flat head. → seg+1 points, left to
 * right, each `{ u, z, n:[nu, nz] }` with n pointing to its arc's centre (into the opening).
 */
export function pointedArch(a, b, zs, H, seg = 8) {
  if (!(H > 0)) return [{ u: a, z: zs, n: [0, -1] }, { u: b, z: zs, n: [0, -1] }];   // a flat head (a lintel)
  const h = (b - a) / 2, mid = (a + b) / 2, rise = Math.max(H, h * 1.001), R = (h * h + rise * rise) / (2 * h);
  const tMax = Math.acos((R - h) / R), half = seg / 2, pts = [];
  for (let i = 0; i <= seg; i++) {
    const left = i <= half, k = left ? i / half : (seg - i) / half, t = k * tMax;
    // left half: centre at (mid + (R − h), zs); right half mirrored
    const cu = left ? mid + (R - h) : mid - (R - h), sgn = left ? -1 : 1;
    const u = cu + sgn * R * Math.cos(t), z = zs + R * Math.sin(t);
    pts.push({ u, z, n: norm2(cu - u, zs - z) });
  }
  pts[half] = { u: mid, z: zs + rise, n: [0, -1] };
  return pts;
}

/** A point on the wall in (u, z), pushed `off` into the room (negative = into the wall). */
const W = (F, u, z, off = 0) => onWall(F, u, off, z);
const wallN = (F, nu, nz, nOff = 0) => P(add(add(mul(F.U, nu), mul(Z, nz)), mul(F.N, nOff)));

/**
 * An arched OPENING in the wall plane over [a, b], straight jambs from z0 to the springing zs, the pointed head above.
 * Emits: the wall around it from u0..u1 between z0..z1 (jambs, spandrels, the band above the apex), the recess back at
 * `depth` into the wall (or `glass` there), the reveals and the soffit through that depth, and a moulded ring (an
 * archivolt) `ring` wide standing `ringOut` proud. Wall faces are split for light at `cell`.
 */
export function archedOpening(out, F, { u0, u1, z0, z1, a, b, zs, H, seg: segIn = 8, depth, ring, ringOut }, surf, { glass = null } = {}) {
  const flat = !(H > 0), pts = pointedArch(a, b, zs, H, segIn), seg = pts.length - 1;
  const apex = flat ? zs : zs + Math.max(H, (b - a) / 2 * 1.001);
  const wallS = surf.wall, trimS = surf.trim, cell = wallS.cell;
  // the wall around the opening: two jambs to the apex, vertical strips from the curve up to the apex line, the band above
  panel(out, W(F, u0, z0), F.U, a - u0, Z, apex - z0, F.N, wallS, cell);
  panel(out, W(F, b, z0), F.U, u1 - b, Z, apex - z0, F.N, wallS, cell);
  for (let i = 0; i < seg; i++) {
    const p = pts[i], q = pts[i + 1];
    quad(out, [W(F, p.u, p.z), W(F, q.u, q.z), W(F, q.u, apex), W(F, p.u, apex)], F.N, wallS, F.U, Z);
  }
  panel(out, W(F, u0, apex), F.U, u1 - u0, Z, z1 - apex, F.N, wallS, cell);
  // the recess: its back (stone, or glass), the two reveals, the soffit following the curve
  const back = (u, z) => W(F, u, z, -depth);
  const backFace = glass ? { ...glass } : null;
  const pushBack = (cs) => (backFace ? out.push({ corners: cs.map(P), normal: F.N, outNormal: F.N, ...backFace }) : quad(out, cs, F.N, wallS, F.U, Z));
  pushBack([back(a, z0), back(b, z0), back(b, zs), back(a, zs)]);
  for (let i = 0; i < seg; i++) {   // under the head: strips from the springing line up to the curve
    const p = pts[i], q = pts[i + 1];
    pushBack([back(p.u, zs), back(q.u, zs), back(q.u, q.z), back(p.u, p.z)]);
  }
  quad(out, [W(F, a, z0), W(F, a, zs), back(a, zs), back(a, z0)], P(F.U), trimS, F.N, Z);
  quad(out, [W(F, b, z0), W(F, b, zs), back(b, zs), back(b, z0)], P(mul(F.U, -1)), trimS, F.N, Z);
  for (let i = 0; i < seg; i++) {
    const p = pts[i], q = pts[i + 1], n = wallN(F, (p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2);
    quad(out, [W(F, p.u, p.z), W(F, q.u, q.z), back(q.u, q.z), back(p.u, p.z)], n, trimS, F.U, Z);
  }
  // the archivolt: a ring around the head and down the jambs, proud, with a chamfered inner edge
  if (ring > 0) {
    const outer = flat ? pointedArch(a - ring, b + ring, zs + ring, 0) : pointedArch(a - ring, b + ring, zs, Math.max(H, (b - a) / 2 * 1.001) + ring, seg);
    for (let i = 0; i < seg; i++) {
      const p = pts[i], q = pts[i + 1], po = outer[i], qo = outer[i + 1];
      quad(out, [W(F, p.u, p.z, ringOut * 0.5), W(F, q.u, q.z, ringOut * 0.5), W(F, qo.u, qo.z, ringOut), W(F, po.u, po.z, ringOut)], wallN(F, 0, 0, 1), trimS, F.U, Z);
      quad(out, [W(F, p.u, p.z), W(F, q.u, q.z), W(F, q.u, q.z, ringOut * 0.5), W(F, p.u, p.z, ringOut * 0.5)], wallN(F, (p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2, 0.5), trimS, F.U, Z);
      quad(out, [W(F, po.u, po.z), W(F, qo.u, qo.z), W(F, qo.u, qo.z, ringOut), W(F, po.u, po.z, ringOut)], wallN(F, -(p.n[0] + q.n[0]) / 2, -(p.n[1] + q.n[1]) / 2), trimS, F.U, Z);
    }
    for (const [x0, x1] of [[a - ring, a], [b, b + ring]]) wallBox(out, F, x0, x1, z0, zs, ringOut, trimS, trimS.cell);
  }
  return apex;
}

/**
 * An ENGAGED COLUMN on wall F at u: a square base block (it bridges the gutter), a `sides`-gon half-shaft standing
 * `embed` into the wall, a flared capital up to `top`. Lathed: each station is a radius at a height.
 */
export function engagedColumn(out, F, u, { r, embed, sides, z0, top, baseH, gutterDepth }, trimS) {
  // the base block: from the gutter floor to the shaft's foot, wide enough to read as a plinth
  wallBox(out, F, u - r - 0.12, u + r + 0.12, -gutterDepth, z0, embed + r + 0.12, trimS, trimS.cell);
  const stations = [[r + 0.08, z0], [r + 0.08, z0 + baseH * 0.5], [r, z0 + baseH], [r, top - 0.55], [r + 0.06, top - 0.45], [r + 0.16, top - 0.15], [r + 0.16, top]];
  // the shaft's centre stands `embed` off the wall, so the polygon wraps past a half until it meets the wall plane
  const half = Math.ceil(sides / 2), th = Math.acos(Math.max(-1, Math.min(1, -embed / r)));
  const angle = (k) => -th + (2 * th * k) / half;
  const ring = (rad, z, k) => { const t = angle(k); return W(F, u + Math.sin(t) * rad, z, Math.max(0, embed + Math.cos(t) * rad)); };
  for (let s = 0; s + 1 < stations.length; s++) {
    const [ra, za] = stations[s], [rb, zb] = stations[s + 1];
    // split tall spans so light has corners on the shaft
    const rows = Math.max(1, Math.ceil((zb - za) / trimS.cell));
    for (let j = 0; j < rows; j++) {
      const z0r = za + ((zb - za) * j) / rows, z1r = za + ((zb - za) * (j + 1)) / rows;
      const r0 = ra + ((rb - ra) * j) / rows, r1 = ra + ((rb - ra) * (j + 1)) / rows;
      for (let k = 0; k < half; k++) {
        const tm = angle(k + 0.5), n = P(add(mul(F.U, Math.sin(tm)), mul(F.N, Math.cos(tm))));
        const ua = (angle(k) * r) / trimS.scale, ub = (angle(k + 1) * r) / trimS.scale;
        quad(out, [ring(r0, z0r, k), ring(r0, z0r, k + 1), ring(r1, z1r, k + 1), ring(r1, z1r, k)], n, trimS, F.U, Z,
          [[z0r / trimS.scale, ua], [z0r / trimS.scale, ub], [z1r / trimS.scale, ub], [z1r / trimS.scale, ua]]);   // turned: the stone's bands run up the shaft
      }
    }
  }
  // the capital's top: an abacus slab the rib springs from
  wallBox(out, F, u - r - 0.2, u + r + 0.2, top, top + 0.18, embed + r + 0.2, trimS, trimS.cell);
}

/**
 * The VAULT over room r: a pointed barrel across the short span (`across` axis) running along the long one, springing
 * at r.h. Transverse ribs at each bay line, a ridge rib along the apex; `ends` lists the end walls ('-y'/'+y' or
 * '-x'/'+x') that get a lunette (the wall filled up to the vault). Returns the section for callers that need it.
 */
export function naveVault(out, r, { rise, seg, bay, rib, ends = [] }, surf) {
  const alongY = (r.y1 - r.y0) >= (r.x1 - r.x0);
  const c0 = alongY ? r.x0 : r.y0, c1 = alongY ? r.x1 : r.y1, l0 = alongY ? r.y0 : r.x0, l1 = alongY ? r.y1 : r.x1;
  const span = c1 - c0, H = Math.max(rise * span, span / 2 * 1.02);
  const sec = pointedArch(c0, c1, r.h, H, seg);
  const at = (c, z, l) => (alongY ? [c, l, z] : [l, c, z]);
  const n3 = (n) => (alongY ? [n[0], 0, n[1]] : [0, n[0], n[1]]);
  // arc length along the section for the tile's u
  const arc = [0]; for (let i = 1; i < sec.length; i++) arc.push(arc[i - 1] + Math.hypot(sec[i].u - sec[i - 1].u, sec[i].z - sec[i - 1].z));
  const cs = surf.ceiling, ts = surf.trim;
  const nL = Math.max(1, Math.ceil((l1 - l0) / cs.cell));
  for (let i = 0; i < seg; i++) {
    const p = sec[i], q = sec[i + 1], n = n3(norm2((p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2));
    for (let j = 0; j < nL; j++) {
      const la = l0 + ((l1 - l0) * j) / nL, lb = l0 + ((l1 - l0) * (j + 1)) / nL;
      const ua = arc[i] / cs.scale, ub = arc[i + 1] / cs.scale, va = la / cs.scale, vb = lb / cs.scale;
      quad(out, [at(p.u, p.z, la), at(q.u, q.z, la), at(q.u, q.z, lb), at(p.u, p.z, lb)], n, cs, null, null, [[ua, va], [ub, va], [ub, vb], [ua, vb]]);
    }
  }
  // ribs: a band `rib.w` wide hanging `rib.drop` below the vault, at each interior bay line, and one along the ridge
  const nBays = Math.max(1, Math.round((l1 - l0) / bay));
  const ribAt = (L) => {
    for (let i = 0; i < seg; i++) {
      const p = sec[i], q = sec[i + 1], np = p.n, nq = q.n;
      const pi = [p.u + np[0] * rib.drop, p.z + np[1] * rib.drop], qi = [q.u + nq[0] * rib.drop, q.z + nq[1] * rib.drop];
      const la = L - rib.w / 2, lb = L + rib.w / 2, n = n3(norm2((np[0] + nq[0]) / 2, (np[1] + nq[1]) / 2));
      quad(out, [at(pi[0], pi[1], la), at(qi[0], qi[1], la), at(qi[0], qi[1], lb), at(pi[0], pi[1], lb)], n, ts, alongY ? [1, 0, 0] : [0, 1, 0], Z);
      const side = alongY ? [0, -1, 0] : [-1, 0, 0];
      quad(out, [at(p.u, p.z, la), at(q.u, q.z, la), at(qi[0], qi[1], la), at(pi[0], pi[1], la)], side, ts, alongY ? [1, 0, 0] : [0, 1, 0], Z);
      quad(out, [at(p.u, p.z, lb), at(q.u, q.z, lb), at(qi[0], qi[1], lb), at(pi[0], pi[1], lb)], mul(side, -1), ts, alongY ? [1, 0, 0] : [0, 1, 0], Z);
    }
  };
  for (let k = 1; k < nBays; k++) ribAt(l0 + ((l1 - l0) * k) / nBays);
  const apex = sec[seg / 2], rw = rib.w * 0.4, rz = apex.z - rib.drop * 0.6;
  for (let j = 0; j < nL; j++) {
    const la = l0 + ((l1 - l0) * j) / nL, lb = l0 + ((l1 - l0) * (j + 1)) / nL;
    quad(out, [at(apex.u - rw, rz, la), at(apex.u + rw, rz, la), at(apex.u + rw, rz, lb), at(apex.u - rw, rz, lb)], [0, 0, -1], ts, alongY ? [1, 0, 0] : [0, 1, 0], alongY ? [0, 1, 0] : [1, 0, 0]);
  }
  // lunettes: the end wall filled from the springing line up under the vault, in rows so light lands on it
  for (const end of ends) {
    const L = (end === '-y' || end === '-x') ? l0 : l1, n = alongY ? [0, end === '-y' ? 1 : -1, 0] : [end === '-x' ? 1 : -1, 0, 0];
    for (let i = 0; i < seg; i++) {
      const p = sec[i], q = sec[i + 1], rows = Math.max(1, Math.ceil((Math.max(p.z, q.z) - r.h) / surf.wall.cell));
      for (let j = 0; j < rows; j++) {
        const f0 = j / rows, f1 = (j + 1) / rows, zp0 = r.h + (p.z - r.h) * f0, zp1 = r.h + (p.z - r.h) * f1, zq0 = r.h + (q.z - r.h) * f0, zq1 = r.h + (q.z - r.h) * f1;
        quad(out, [at(p.u, zp0, L), at(q.u, zq0, L), at(q.u, zq1, L), at(p.u, zp1, L)], n, surf.wall, alongY ? [1, 0, 0] : [0, 1, 0], Z);
      }
    }
  }
  return { sec, alongY, H };
}

/**
 * A GREAT PORTAL in wall F over [a, b]: the scale break at a nave's focus. Its arch springs at zs with rise H and
 * steps back in `orders`: each order is a reveal and soffit `depth` deep, then a flat step `step` wide facing the room,
 * so the opening narrows and recedes like a cathedral's west door. A hood moulding stands proud round the outer order;
 * the door leaf (`door` surface) fills the innermost order, banded with iron (`iron` tint). Emits the wall round the
 * portal over [u0, u1] × [z0, z1] too. → the apex height.
 */
export function portal(out, F, { u0, u1, z0, z1, a, b, zs, H, seg = 10, orders = 3, step = 0.3, depth = 0.35, hood = 0.3, hoodOut = 0.18, bands = 3 }, surf) {
  const wallS = surf.wall, trimS = surf.trim, doorS = surf.door;
  const outline = (i) => pointedArch(a + i * step, b - i * step, zs, H - i * step, seg);
  const O0 = outline(0), apex = O0[seg / 2].z;
  // the wall round the outer order (jambs, the strips over the curve, the band above)
  panel(out, W(F, u0, z0), F.U, a - u0, Z, apex - z0, F.N, wallS, wallS.cell);
  panel(out, W(F, b, z0), F.U, u1 - b, Z, apex - z0, F.N, wallS, wallS.cell);
  for (let i = 0; i < seg; i++) { const p = O0[i], q = O0[i + 1]; quad(out, [W(F, p.u, p.z), W(F, q.u, q.z), W(F, q.u, apex), W(F, p.u, apex)], F.N, wallS, F.U, Z); }
  if (z1 > apex) panel(out, W(F, u0, apex), F.U, u1 - u0, Z, z1 - apex, F.N, wallS, wallS.cell);
  // each order: the reveal and soffit along its outline from its depth to the next, then the step face to the next outline
  for (let o = 0; o < orders; o++) {
    const O = outline(o), N1 = outline(o + 1), d0 = -o * depth, d1 = -(o + 1) * depth;
    const jamb = (u, sgn) => quad(out, [W(F, u, z0, d0), W(F, u, zs, d0), W(F, u, zs, d1), W(F, u, z0, d1)], P(mul(F.U, sgn)), trimS, F.N, Z);
    jamb(O[0].u, 1); jamb(O[seg].u, -1);
    for (let i = 0; i < seg; i++) {
      const p = O[i], q = O[i + 1], n = wallN(F, (p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2);
      quad(out, [W(F, p.u, p.z, d0), W(F, q.u, q.z, d0), W(F, q.u, q.z, d1), W(F, p.u, p.z, d1)], n, trimS, F.U, Z);
    }
    // the step: the band between this outline and the next, facing the room, down both jambs and round the head
    quad(out, [W(F, O[0].u, z0, d1), W(F, N1[0].u, z0, d1), W(F, N1[0].u, zs, d1), W(F, O[0].u, zs, d1)], F.N, trimS, F.U, Z);
    quad(out, [W(F, N1[seg].u, z0, d1), W(F, O[seg].u, z0, d1), W(F, O[seg].u, zs, d1), W(F, N1[seg].u, zs, d1)], F.N, trimS, F.U, Z);
    for (let i = 0; i < seg; i++) quad(out, [W(F, O[i].u, O[i].z, d1), W(F, O[i + 1].u, O[i + 1].z, d1), W(F, N1[i + 1].u, N1[i + 1].z, d1), W(F, N1[i].u, N1[i].z, d1)], F.N, trimS, F.U, Z);
  }
  // the door leaf in the innermost outline, a little behind its step; iron bands across it
  const I = outline(orders), dd = -orders * depth - 0.06, back = (u, z) => W(F, u, z, dd);
  quad(out, [back(I[0].u, z0), back(I[seg].u, z0), back(I[seg].u, zs), back(I[0].u, zs)], F.N, doorS, F.U, Z);
  for (let i = 0; i < seg; i++) quad(out, [back(I[i].u, zs), back(I[i + 1].u, zs), back(I[i + 1].u, I[i + 1].z), back(I[i].u, I[i].z)], F.N, doorS, F.U, Z);
  const mid = (I[0].u + I[seg].u) / 2;
  const iron = { ...doorS, key: null, tint: surf.iron, group: 'stage:iron' };
  wallBox(out, F, mid - 0.05, mid + 0.05, z0, I[seg / 2].z - 0.3, dd + 0.05, iron, 1, true);   // the meeting stile
  for (let k = 1; k <= bands; k++) {
    const z = z0 + ((zs - z0) * k) / (bands + 0.6);
    wallBox(out, F, I[0].u, I[seg].u, z, z + 0.12, dd + 0.05, iron, 1, true);
  }
  // the hood moulding round the outer order, standing proud
  const Ho = pointedArch(a - hood, b + hood, zs, H + hood, seg);
  for (let i = 0; i < seg; i++) {
    const p = O0[i], q = O0[i + 1], po = Ho[i], qo = Ho[i + 1];
    quad(out, [W(F, p.u, p.z, hoodOut), W(F, q.u, q.z, hoodOut), W(F, qo.u, qo.z, hoodOut), W(F, po.u, po.z, hoodOut)], F.N, trimS, F.U, Z);
    quad(out, [W(F, p.u, p.z), W(F, q.u, q.z), W(F, q.u, q.z, hoodOut), W(F, p.u, p.z, hoodOut)], wallN(F, (p.n[0] + q.n[0]) / 2, (p.n[1] + q.n[1]) / 2, 0.4), trimS, F.U, Z);
    quad(out, [W(F, po.u, po.z, hoodOut), W(F, qo.u, qo.z, hoodOut), W(F, qo.u, qo.z), W(F, po.u, po.z)], wallN(F, -(p.n[0] + q.n[0]) / 2, -(p.n[1] + q.n[1]) / 2, 0.4), trimS, F.U, Z);
  }
  for (const [x0, x1] of [[a - hood, a], [b, b + hood]]) wallBox(out, F, x0, x1, z0, zs, hoodOut, trimS, trimS.cell);
  return apex;
}

/** An OCULUS: a round window of `sides` in wall F centred at (u, z), radius R, its glass `depth` back and a ring
 *  `ring` wide standing `ringOut` proud. The wall round it (a square u±S, z±S) is emitted too. */
export function oculus(out, F, { u, z, R, S, sides = 12, depth = 0.4, ring = 0.2, ringOut = 0.12 }, surf, glass) {
  const wallS = surf.wall, trimS = surf.trim;
  const pt = (k, r, off = 0) => { const t = (2 * Math.PI * k) / sides; return W(F, u + Math.cos(t) * r, z + Math.sin(t) * r, off); };
  const corner = (k) => { const t = (2 * Math.PI * k) / sides, c = Math.cos(t), s = Math.sin(t), m = Math.max(Math.abs(c), Math.abs(s)); return W(F, u + (c / m) * S, z + (s / m) * S); };
  for (let k = 0; k < sides; k++) {
    quad(out, [pt(k, R), pt(k + 1, R), corner(k + 1), corner(k)], F.N, wallS, F.U, Z);                              // the wall round it
    const tm = (2 * Math.PI * (k + 0.5)) / sides, n = wallN(F, -Math.cos(tm), -Math.sin(tm));
    quad(out, [pt(k, R), pt(k + 1, R), pt(k + 1, R, -depth), pt(k, R, -depth)], n, trimS, F.U, Z);                // the reveal
    quad(out, [pt(k, R, ringOut), pt(k + 1, R, ringOut), pt(k + 1, R + ring, ringOut), pt(k, R + ring, ringOut)], F.N, trimS, F.U, Z);   // the ring's face
    quad(out, [pt(k, R), pt(k + 1, R), pt(k + 1, R, ringOut), pt(k, R, ringOut)], n, trimS, F.U, Z);
    out.push({ corners: [W(F, u, z, -depth), pt(k, R, -depth), pt(k + 1, R, -depth), W(F, u, z, -depth)].map(P), normal: F.N, outNormal: F.N, ...glass });
  }
}
