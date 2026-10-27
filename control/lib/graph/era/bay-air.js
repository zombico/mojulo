/**
 * A BAY'S AIR (era/bay.js): the ducts, their hangers and the terminals that let the air in and out, built as relief
 * (stepped cones, angled blades, a sleeve where a duct passes a web), never painted. Sizes are the construction
 * catalog's (construction/catalog.js `duct:*`, `diffuser:*`, `grille:*`, `louvre:*`, `hanger:*`, read into metres by
 * style/bay-kits.js as `B.air`).
 *
 *   ductRun(out, a, b, D, sf, ring)   a straight run from a to b (world points, level): round (`D.r`) as a tube with a band
 *                                     at each joint, rectangular (`D.w` × `D.h`) as a box with a flange round each joint
 *   rod(out, p, zTop, sf)              a hanger rod from p up to zTop
 *   drum(out, c, axis, A, sf, dark)    a drum louvre centred at c, its axis level along `axis`: a cylinder, its end caps,
 *                                     the blades across its underside the dark between them
 *   squareDiffuser(out, c, z, A, sf, dark)   a 4-way ceiling diffuser flush under z: a face plate, rings of cones stepping
 *                                     down to a centre plate, the dark of the neck between them
 *   louvred(out, o, U, V, N, w, h, G, sf, dark)   a grille or a louvre: a frame w × h in the plane (U across, V up, N out
 *                                     of it) at o (its lower left), its blades at `G.pitch` tilted `G.angle` down and out,
 *                                     the dark behind
 *
 * Pure: no dice.
 */
import { P, r5, box, quad } from './geom.js';
import { tubeAB } from './lab.js';

const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const bbox = (out, p, q, sf) => box(out, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], sf, sf.cell ?? 1);

export function ductRun(out, a, b, D, sf, ring = sf) {
  const d = sub(b, a), len = Math.hypot(...d), u = norm(d), side = norm(cross([0, 0, 1], u));
  if (len < 0.2) return 0;
  const n = Math.max(1, Math.round(len / D.length));
  if (D.shape === 'round') {
    tubeAB(out, a, b, D.r, 12, sf);
    // (a spiral duct's joint: a coupling a hair proud, at each length)
    for (let k = 1; k < n; k++) { const c = add(a, mul(u, (len * k) / n)); tubeAB(out, add(c, mul(u, -D.joint / 2)), add(c, mul(u, D.joint / 2)), D.r + 0.008, 12, ring); }
  } else {
    const hw = D.w / 2, hh = D.h / 2, corner = (p, s, z) => add(add(p, mul(side, s)), [0, 0, z]);
    bbox(out, corner(a, -hw, -hh), corner(b, hw, hh), sf);
    // (a flange frame round each joint, standing out of the duct's faces)
    for (let k = 1; k < n; k++) {
      const c = add(a, mul(u, (len * k) / n)), f = D.flange, t = 0.02, p0 = add(c, mul(u, -t)), p1 = add(c, mul(u, t));
      bbox(out, corner(p0, -hw - f, hh), corner(p1, hw + f, hh + f), ring); bbox(out, corner(p0, -hw - f, -hh - f), corner(p1, hw + f, -hh), ring);
      bbox(out, corner(p0, -hw - f, -hh), corner(p1, -hw, hh), ring); bbox(out, corner(p0, hw, -hh), corner(p1, hw + f, hh), ring);
    }
  }
  return n;
}

export function rod(out, p, zTop, sf, r = 0.006) {
  if (zTop - p[2] > 0.02) tubeAB(out, p, [p[0], p[1], zTop], r, 5, sf);
}

// a disc of `sides` (each a triangle, written as a quad with its last corner doubled, as the mesh and the bake take)
function disc(out, c, n, e1, e2, r, sides, sf) {
  for (let k = 0; k < sides; k++) {
    const t0 = (2 * Math.PI * k) / sides, t1 = (2 * Math.PI * (k + 1)) / sides, at = (t) => add(c, add(mul(e1, Math.cos(t) * r), mul(e2, Math.sin(t) * r)));
    const cs = [c, at(t0), at(t1), at(t1)];
    out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), texture: sf.key, textureLit: true, uv: cs.map((p) => [r5((p[0] + p[1]) / sf.scale), r5(p[2] / sf.scale)]), tint: sf.tint, group: sf.group });
  }
}

export function drum(out, c, axis, A, sf, dark) {
  const u = norm(axis), e1 = norm(cross(u, [0, 0, 1])), e2 = cross(e1, u), a = add(c, mul(u, -A.length / 2)), b = add(c, mul(u, A.length / 2));
  tubeAB(out, a, b, A.r, 12, sf);
  disc(out, a, mul(u, -1), e1, e2, A.r, 10, sf); disc(out, b, u, e2, e1, A.r, 10, sf);
  // the blades: slots across the drum's underside, the dark between them, each slot's lip a blade standing a hair out
  const nb = Math.max(2, Math.floor((A.length - 0.06) / A.pitch));
  for (let k = 0; k < nb; k++) {
    const t = -A.length / 2 + 0.03 + (k + 0.5) * ((A.length - 0.06) / nb), q = (ang, dt) => add(add(c, mul(u, t + dt)), add(mul(e1, Math.cos(ang) * (A.r + 0.002)), mul(e2, Math.sin(ang) * (A.r + 0.002))));
    const lo = -Math.PI / 2 - 0.9, hi = -Math.PI / 2 + 0.9, w = A.pitch * 0.32;
    quad(out, [q(lo, -w), q(lo, w), q(hi, w), q(hi, -w)], mul(e2, -1), dark, null, null, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
}

export function squareDiffuser(out, c, z, A, sf, dark) {
  const half = A.size / 2, step = 0.014;
  // the face plate's border and the neck's dark over the cones
  for (const [x0, y0, x1, y1] of [[-half, -half, half, -half + 0.03], [-half, half - 0.03, half, half], [-half, -half + 0.03, -half + 0.03, half - 0.03], [half - 0.03, -half + 0.03, half, half - 0.03]]) bbox(out, [c[0] + x0, c[1] + y0, z - 0.012], [c[0] + x1, c[1] + y1, z], sf);
  quad(out, [[c[0] - half + 0.03, c[1] - half + 0.03, z - 0.002], [c[0] + half - 0.03, c[1] - half + 0.03, z - 0.002], [c[0] + half - 0.03, c[1] + half - 0.03, z - 0.002], [c[0] - half + 0.03, c[1] + half - 0.03, z - 0.002]], [0, 0, -1], dark, null, null, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // each ring a cone's band, sloping down and in, a slot of the dark left round it
  const R = A.rings, edge = half - 0.03;
  for (let k = 0; k < R; k++) {
    const o = edge * (1 - k / (R + 0.6)) - 0.012, i = o - (edge / (R + 0.6)) * 0.62, zo = z - 0.014 - k * step, zi = zo - step * 0.8;
    const sides = [[[-o, -o], [o, -o], [i, -i], [-i, -i], [0, -1]], [[o, -o], [o, o], [i, i], [i, -i], [1, 0]], [[o, o], [-o, o], [-i, i], [i, i], [0, 1]], [[-o, o], [-o, -o], [-i, -i], [-i, i], [-1, 0]]];
    for (const [p0, p1, p2, p3, [nx, ny]] of sides) {
      const cs = [[c[0] + p0[0], c[1] + p0[1], zo], [c[0] + p1[0], c[1] + p1[1], zo], [c[0] + p2[0], c[1] + p2[1], zi], [c[0] + p3[0], c[1] + p3[1], zi]];
      quad(out, cs, norm([nx * 0.45, ny * 0.45, -1]), sf, null, null, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  const ci = edge * (1 - R / (R + 0.6)) - 0.012, zc = z - 0.014 - R * step;
  quad(out, [[c[0] - ci, c[1] - ci, zc], [c[0] + ci, c[1] - ci, zc], [c[0] + ci, c[1] + ci, zc], [c[0] - ci, c[1] + ci, zc]], [0, 0, -1], sf, null, null, [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

export function louvred(out, o, U, V, N, w, h, G, sf, dark) {
  const f = Math.min(0.04, w * 0.08), at = (x, y, n = 0) => add(add(add(o, mul(U, x)), mul(V, y)), mul(N, n)), depth = G.depth ?? 0.03;
  // the frame: four bars standing out of the plane
  const bar = (x0, y0, x1, y1) => { const p = at(x0, y0, 0), q = at(x1, y1, depth); bbox(out, p, q, sf); };
  bar(0, 0, w, f); bar(0, h - f, w, h); bar(0, f, f, h - f); bar(w - f, f, w, h - f);
  quad(out, [at(f, f, 0.002), at(w - f, f, 0.002), at(w - f, h - f, 0.002), at(f, h - f, 0.002)], N, dark, null, null, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // the blades: each tilted down and out by G.angle, spanning the frame's clear width, one every G.pitch
  const ang = (G.angle * Math.PI) / 180, nb = Math.max(1, Math.floor((h - 2 * f) / G.pitch)), bl = Math.min(depth * 0.95 / Math.sin(ang), G.pitch * 1.25);
  const dir = add(mul(V, -Math.cos(ang)), mul(N, Math.sin(ang))), bn = norm(add(mul(V, Math.sin(ang)), mul(N, Math.cos(ang))));
  for (let k = 0; k < nb; k++) {
    const y = f + (k + 1) * ((h - 2 * f) / (nb + 0.0001)), top = at(f, y, 0.004), top2 = at(w - f, y, 0.004);
    quad(out, [top, top2, add(top2, mul(dir, bl)), add(top, mul(dir, bl))], bn, sf, null, null, [[0, 0], [(w - 2 * f) / sf.scale, 0], [(w - 2 * f) / sf.scale, bl / sf.scale], [0, bl / sf.scale]]);
  }
}
