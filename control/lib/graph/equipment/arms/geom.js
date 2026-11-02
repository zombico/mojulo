// equipment/arms/geom — the few shapes a modern or a future arm is made of, as workbench monomer specs (centimetres).
//
//   slab      a part drawn as its OUTLINE in one plane and pushed through the other axis, its edges chamfered: the
//             core between the chamfers carries the outline, each face a tapered ring from the outline to the outline
//             inset by the chamfer (the edge that catches the key light, arms law 2). Planes:
//               side   the outline in [z, y] (along the bore, up), pushed across x — a receiver, a grip, a stock
//               plan   the outline in [z, x] (along the item, across), pushed up y; a knife's flat (x toward the edge)
//               front  the outline in [x, y], pushed along z — a handguard's section, a rail
//   grind     a blade: the outline at the middle plane, ground toward the spine at each face (a flat grind), with a
//             secondary bevel of its own role along the edge (arms law 8)
//   tube      a lathe along z (a barrel, a can, a cylinder), its sides set by its radius
//   box       an axis-aligned box (a rib, a serration, a pin), optionally its edges chamfered
//
// Rings: an outline is a list of 2D points in the plane's own order; the helpers take it to the extrude's (u, v)
// frame (polygonizer/extrude-faces.js perpBasis: along x, u = y and v = z; along y, u = −x and v = z; along z, u = x
// and v = y), wind it counter-clockwise there, and inset it along each vertex's bisector (the miter capped).
// Pure: numbers rounded to the hundredth of a millimetre, no dice.
import * as dmath from '../../../util/dmath.js';
import { mat } from '../shapes.js';

export const r4 = (v) => Math.round(v * 1e4) / 1e4;
const pt = (x, y, z) => ({ x: r4(x), y: r4(y), z: r4(z) });
const area = (ring) => { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

/** an outline in a plane's own order → [u, v] in the extrude's frame */
const TO_UV = Object.freeze({
  side: ([z, y]) => [y, z],
  plan: ([z, x]) => [-x, z],
  front: ([x, y]) => [x, y],
});
const AXIS = Object.freeze({ side: 'x', plan: 'y', front: 'z' });
const at = (axis, w) => (axis === 'x' ? pt(w, 0, 0) : axis === 'y' ? pt(0, w, 0) : pt(0, 0, w));

/** The ring wound counter-clockwise (with its weights carried in the same order). */
function ccw(ring, wts) {
  if (area(ring) >= 0) return { ring, wts };
  return { ring: [...ring].reverse(), wts: wts ? [...wts].reverse() : null };
}

/**
 * The ring inset by d along each vertex's bisector (a counter-clockwise ring), a vertex's weight scaling its d (0 holds
 * it). The miter is capped at 2.5 d so a sharp corner pulls in no further than a blunt one would.
 */
export function insetRing(ring, d, wts = null) {
  const n = ring.length;
  const inward = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dmath.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  return ring.map((p, i) => {
    const w = wts ? wts[i] : 1; if (!w) return p;
    const a = inward(ring[(i - 1 + n) % n], p), b = inward(p, ring[(i + 1) % n]);
    let mx = a[0] + b[0], my = a[1] + b[1]; const ml = dmath.hypot(mx, my);
    if (ml < 1e-6) { mx = a[0]; my = a[1]; } else { mx /= ml; my /= ml; }
    const c = mx * a[0] + my * a[1]; const len = Math.min(2.5, 1 / Math.max(0.2, c)) * d * w;
    return [p[0] + mx * len, p[1] + my * len];
  });
}

const prof = (ring) => ({ points: ring.map(([u, v]) => [r4(u), r4(v)]) });

/**
 * A chamfered slab: `ring` in the plane's order, pushed from w0 to w1 along the plane's axis, each face chamfered by
 * `chamfer` (0: a plain prism). `wts` hold a vertex's inset (0: an edge that meets another part flush). → extrudes.
 */
export function slab({ ring, plane = 'side', w0, w1, chamfer = 0, role, group, wts = null }) {
  const axis = AXIS[plane], uv = ring.map(TO_UV[plane]);
  const { ring: R, wts: W } = ccw(uv, wts);
  const m = mat(role), T = w1 - w0, c = Math.min(chamfer, T * 0.34);
  if (!(c > 0.004)) return [{ group, profile: prof(R), axisFrom: at(axis, w0), axisTo: at(axis, w1), ...m }];
  const I = insetRing(R, c, W);
  return [
    { group, profile: prof(I), endProfile: prof(R), axisFrom: at(axis, w0), axisTo: at(axis, w0 + c), ...m },
    { group, profile: prof(R), axisFrom: at(axis, w0 + c), axisTo: at(axis, w1 - c), ...m },
    { group, profile: prof(R), endProfile: prof(I), axisFrom: at(axis, w1 - c), axisTo: at(axis, w1), ...m },
  ];
}

/** A slab centred on the plane: half-width hw each side of it. */
export const slabC = (o) => slab({ ...o, w0: -o.hw, w1: o.hw });

/**
 * A ground blade in the plan plane ([z, x], x toward the edge), centred on y = 0, `T` thick at the spine. `spine` and
 * `edge` are polylines of PAIRED stations from the heel to the tip (the same count, the tip their shared last point);
 * `edgeW` / `spineW` per station (0: unground, a ricasso or a spine flat; 1: ground; a ground spine is a false edge).
 * A ground edge point moves toward its spine station by `grind` of the way at the faces (a flat grind), a ground spine
 * point half as far toward its edge station; the secondary bevel (`bevel` of the half-thickness, its own role) runs
 * from the middle outline out to the outline ground a seventh of the way. → extrudes.
 */
export function grind({ spine, edge, spineW = null, edgeW = null, T, grind: g = 0.6, bevel = 0.22, role, edgeRole, group }) {
  const n = spine.length;
  const sw = spineW ?? spine.map(() => 0), ew = edgeW ?? edge.map(() => 1);
  const ground = (k) => {
    const s = spine.map((p, i) => { const w = sw[i] * k * 0.5; return [p[0] + (edge[i][0] - p[0]) * w, p[1] + (edge[i][1] - p[1]) * w]; });
    const e = edge.map((p, i) => { const w = ew[i] * k; return [p[0] + (spine[i][0] - p[0]) * w, p[1] + (spine[i][1] - p[1]) * w]; });
    // the outline: the spine from the heel to the tip, then the edge back from before the tip to the heel
    return [...s, ...e.slice(0, n - 1).reverse()];
  };
  const mid = ground(0), b = ground(g * 0.14), face = ground(g);
  const hb = (T / 2) * bevel, ht = T / 2;
  const uv = (r) => r.map(TO_UV.plan);
  const flip = area(uv(mid)) < 0, orient = (r) => (flip ? [...uv(r)].reverse() : uv(r));
  const em = mat(edgeRole ?? role), bm = mat(role), out = [];
  // every slab runs toward +y (the extrude's frame turns with its axis: a slab run toward −y would mirror the outline)
  const run = (g0, w0, r0, w1, r1, m) => out.push({ group: g0, profile: prof(orient(r0)), endProfile: prof(orient(r1)), axisFrom: at('y', w0), axisTo: at('y', w1), ...m });
  run(`${group}-edge`, 0, mid, hb, b, em); run(group, hb, b, ht, face, bm);
  run(`${group}-edge`, -hb, b, 0, mid, em); run(group, -ht, face, -hb, b, bm);
  return out;
}

/** A lathe along z from z0 to z1 at (x, y): `profile` [[t, r], …] (t 0..1), its sides `samples`. → a lathe. */
export function tube({ z0, z1, x = 0, y = 0, profile, samples = 16, role, group, harmonics = null, axis = 'z' }) {
  const from = axis === 'z' ? pt(x, y, z0) : axis === 'x' ? pt(z0, y, x) : pt(x, z0, y);
  const to = axis === 'z' ? pt(x, y, z1) : axis === 'x' ? pt(z1, y, x) : pt(x, z1, y);
  return { group, axisFrom: from, axisTo: to, profile: profile.map(([t, r]) => ({ t: r4(t), radius: r4(r) })), samples, crossSections: Math.max(2, profile.length - 1), ...(harmonics ? { harmonics } : {}), ...mat(role) };
}

/** An axis-aligned box [lo, hi] (cm), its edges chamfered by `chamfer` round its z axis. → extrudes. */
export function box({ lo, hi, role, group, chamfer = 0 }) {
  const w = hi[0] - lo[0], h = hi[1] - lo[1], cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  const c = Math.min(chamfer, w * 0.3, h * 0.3);
  const ring = c > 0.004
    ? [[w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c], [-w / 2 + c, -h / 2], [w / 2 - c, -h / 2]]
    : [[w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]];
  return { group, profile: prof(ring.map(([u, v]) => [u + cx, v + cy])), axisFrom: pt(0, 0, lo[2]), axisTo: pt(0, 0, hi[2]), ...mat(role) };
}

/** A circle's points (n of them) about [cz, cy] of radius r, from angle a0 to a1 (radians, 0 = +z, π/2 = +y). */
export function arc(c, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([c[0] + r * dmath.cos(a), c[1] + r * dmath.sin(a)]); }
  return out;
}

/** A band of width `w` along a polyline (both sides), as one closed outline: a trigger guard, a skeleton stock. */
export function band(line, w) {
  const L = [], R = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i], a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dmath.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    L.push([p[0] + (nx * w) / 2, p[1] + (ny * w) / 2]); R.push([p[0] - (nx * w) / 2, p[1] - (ny * w) / 2]);
  }
  return [...L, ...R.reverse()];
}
