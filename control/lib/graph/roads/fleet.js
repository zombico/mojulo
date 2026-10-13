/**
 * fleet — highway vehicles at TRUE DIMENSIONS, in metres, for the roadway world (R5).
 *
 * The city's swept hulls are props sized by a scale factor, with toy proportions; stretching them
 * per axis would squash their wheels. So each class here is LOFTED from its real numbers: length,
 * width, height, wheelbase, track, wheel radius, and a side profile (hood, glasshouse, deck) given
 * as fractions of length. Low-poly on purpose: the bar is that silhouette, glasshouse, lamps and
 * round wheels read correctly at 5–150 m, not interiors.
 *
 * A vehicle is PARTS, each an instanced template: `paint` (tinted per instance: the livery),
 * `trim` (glass, tyres, lamps, black plastics: never tinted), and for a tractor-trailer a
 * separately tinted `trailer`. Templates face +x, centred on the footprint, wheels on z = 0, and
 * are pre-shaded for heading 0 and heading π (the World bakes light into vertex colour).
 */

import { face, faceOut } from './road-faces.js';

// L × W × H, wheelbase, track, wheel radius (m) — the plan's reference sheet. Profile stations are
// fractions of L from the front: nose, windscreen base (hood end), roof start, roof end, deck start.
export const FLEET = {
  compact:   { L: 4.55, W: 1.80, H: 1.42, wb: 2.73, track: 1.55, r: 0.315, kind: 'car', profile: { hood: 0.29, roofA: 0.45, roofB: 0.74, deck: 0.86, zHood: 0.78, zDeck: 0.98, zBelt: 0.92 } },
  midsize:   { L: 4.89, W: 1.84, H: 1.44, wb: 2.83, track: 1.59, r: 0.33, kind: 'car', profile: { hood: 0.28, roofA: 0.44, roofB: 0.72, deck: 0.85, zHood: 0.80, zDeck: 1.00, zBelt: 0.94 } },
  crossover: { L: 4.60, W: 1.86, H: 1.69, wb: 2.69, track: 1.60, r: 0.36, kind: 'car', profile: { hood: 0.25, roofA: 0.40, roofB: 0.86, deck: 0.97, zHood: 0.98, zDeck: 1.30, zBelt: 1.08 } },
  pickup:    { L: 5.89, W: 2.03, H: 1.96, wb: 3.68, track: 1.74, r: 0.42, kind: 'pickup', profile: { hood: 0.24, roofA: 0.33, roofB: 0.55, deck: 0.60, zHood: 1.25, zDeck: 1.30, zBelt: 1.30 } },
  van:       { L: 5.95, W: 2.02, H: 2.55, wb: 3.66, track: 1.72, r: 0.38, kind: 'box', profile: { hood: 0.12, roofA: 0.22, roofB: 1.0, deck: 1.0, zHood: 1.15, zDeck: 2.55, zBelt: 1.30 } },
  bus:       { L: 12.2, W: 2.59, H: 3.20, wb: 6.2, track: 2.10, r: 0.50, kind: 'bus', profile: { hood: 0.0, roofA: 0.02, roofB: 1.0, deck: 1.0, zHood: 1.0, zDeck: 3.2, zBelt: 1.25 } },
  straightTruck: { L: 9.2, W: 2.59, H: 3.90, wb: 5.4, track: 2.0, r: 0.50, kind: 'straight', cab: 2.4, cabH: 2.95 },
  tractorTrailer: { L: 22.5, W: 2.59, H: 4.10, wb: 5.9, track: 2.0, r: 0.52, kind: 'semi', trailerL: 16.15, kingpin: 7.35, cabH: 3.95 },
};
// the Pearson corridor's mix (trucks ≈ 12 %, the plan's [E] band); weights, not shares
export const FLEET_MIX = { midsize: 28, compact: 20, crossover: 26, pickup: 8, van: 4, bus: 1, straightTruck: 3, tractorTrailer: 10 };
export const PAINTS = [
  [0.93, 0.93, 0.92], [0.93, 0.93, 0.92], [0.76, 0.77, 0.79], [0.76, 0.77, 0.79], [0.45, 0.46, 0.48],
  [0.13, 0.13, 0.14], [0.13, 0.13, 0.14], [0.17, 0.25, 0.46], [0.55, 0.09, 0.07], [0.30, 0.33, 0.30],
];
export const TRAILER_PAINTS = [[0.95, 0.95, 0.94], [0.95, 0.95, 0.94], [0.95, 0.95, 0.94], [0.95, 0.95, 0.94], [0.95, 0.95, 0.94], [0.84, 0.84, 0.83], [0.84, 0.84, 0.83], [0.66, 0.67, 0.68], [0.62, 0.12, 0.10], [0.20, 0.30, 0.52]];

const T = { paint: '#e9e9e9', glass: '#1e2630', tyre: '#1b1c1e', hub: '#8e9296', lamp: '#e9edf0', tail: '#9a1a17', plastic: '#2a2c2f', chrome: '#b9bcbf', box: '#eeeeec', frame: '#26282a' };

// ── primitives in the template frame (+x forward, +y left, z up), rotated for the heading ──────────
function makeFrame(yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return (x, y, z) => [x * c - y * s, x * s + y * c, z];
}
/** A convex prism across y: side polygon `poly` [[x, z]…] (CCW seen from +y), from y0 to y1. */
function prism(out, R, poly, y0, y1, hex) {
  const mid = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);
  const inside = R(mid[0], (y0 + y1) / 2, mid[1]);
  out.push(faceOut(poly.map(([x, z]) => R(x, y1, z)), hex, inside));
  out.push(faceOut(poly.map(([x, z]) => R(x, y0, z)).reverse(), hex, inside));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const q = [R(a[0], y0, a[1]), R(b[0], y0, b[1]), R(b[0], y1, b[1]), R(a[0], y1, a[1])];
    out.push(sideFace(q, hex, inside));
  }
}
/** A face oriented away from `inside` in 3D (tops and bottoms included). */
function sideFace(q, hex, inside) {
  const c = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
  const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const flip = n[0] * (c[0] - inside[0]) + n[1] * (c[1] - inside[1]) + n[2] * (c[2] - inside[2]) < 0;
  return face(flip ? q.slice().reverse() : q, hex, { keepWinding: true });
}
function box(out, R, x0, x1, y0, y1, z0, z1, hex) {
  prism(out, R, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, hex);
}
/** A wheel: a 12-sided cylinder along y, tyre + a lighter hub disc on the outer face (`hub`: its share of the radius and
 *  its fill, a style's; the fleet's own by default). */
function wheel(trim, R, x, y, r, w, side, hubStyle = null) {
  const n = 12, poly = [];
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 2 * Math.PI; poly.push([x + r * Math.cos(a), r + r * Math.sin(a)]); }
  const y0 = y - w / 2, y1 = y + w / 2;
  prism(trim, R, poly, y0, y1, T.tyre);
  const k = hubStyle?.ratio ?? 0.58, hub = poly.map(([px, pz]) => [x + (px - x) * k, r + (pz - r) * k]);
  const yo = side > 0 ? y1 + 0.005 : y0 - 0.005;
  trim.push(faceOut(hub.map(([px, pz]) => R(px, yo, pz)), hubStyle?.hex ?? T.hub, R(x, y, r)));
}

/**
 * A car-like body lofted through side-profile stations. Each station is a hexagonal section:
 * rocker at `z0`, body width to the belt, then the glasshouse leaning in to the roof width. Where
 * the roof is below the belt (hood, deck) the section is a box. Wheel arches lift the rocker.
 */
function loftBody(paint, trim, R, spec) {
  const { L, W, H, wb, r, profile: p } = spec;
  const x = (f) => L / 2 - f * L;                        // fraction from the front → template x
  const roofW = W * 0.78, zR = 0.24 + 0.0 * H;
  const archX = [wb / 2, -wb / 2], archR = r * 1.12;
  // station list (front → back) with top z
  const top = [
    [0.0, p.zHood - 0.12], [0.03, p.zHood - 0.02], [p.hood, p.zHood + 0.06], [p.roofA, H], [p.roofB, H], [p.deck, p.zDeck], [0.985, p.zDeck - 0.04], [1.0, p.zDeck - 0.16],
  ];
  const xs = new Set(top.map(([f]) => f));
  for (const ax of archX) for (const dx of [-archR, -archR * 0.5, 0, archR * 0.5, archR]) { const f = (L / 2 - (ax + dx)) / L; if (f > 0.005 && f < 0.995) xs.add(f); }
  const fs = [...xs].sort((a, b) => a - b);
  const topAt = (f) => { for (let i = 0; i < top.length - 1; i++) if (f >= top[i][0] && f <= top[i + 1][0]) { const t = (f - top[i][0]) / (top[i + 1][0] - top[i][0] || 1); return top[i][1] + (top[i + 1][1] - top[i][1]) * t; } return top[top.length - 1][1]; };
  const rockerAt = (f) => {
    const xx = x(f);
    for (const ax of archX) { const d = Math.abs(xx - ax); if (d < archR) return Math.max(zR, r + Math.sqrt(archR * archR - d * d) * 0.92); }
    return zR;
  };
  const section = (f) => {
    const zt = topAt(f), z0 = rockerAt(f), belt = Math.min(p.zBelt, zt);
    const end = f < 0.02 || f > 0.98 ? 0.94 : 1;         // round the nose and tail in plan
    const hw = W / 2 * end, rw = zt > belt + 0.05 ? roofW / 2 * end : hw;
    return { xx: x(f), z0, belt, zt, pts: [[-hw, z0], [hw, z0], [hw, belt], [rw, zt], [-rw, zt], [-hw, belt]] };
  };
  const S = fs.map(section);
  const inside = R(0, 0, H * 0.5);
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6;
      const q = [R(a.xx, a.pts[k][0], a.pts[k][1]), R(a.xx, a.pts[k2][0], a.pts[k2][1]), R(b.xx, b.pts[k2][0], b.pts[k2][1]), R(b.xx, b.pts[k][0], b.pts[k][1])];
      // k: 0 bottom, 1 right side (y+), 2 right glass, 3 roof, 4 left glass, 5 left side
      const glassSide = (k === 2 || k === 4) && a.zt > a.belt + 0.05 && b.zt > b.belt + 0.05;
      // the windscreen and rear glass are the ROOF band where the top is sloping
      const slope = Math.abs(a.zt - b.zt) / Math.abs(a.xx - b.xx);
      const glassRoof = k === 3 && slope > 0.35 && Math.min(a.zt, b.zt) > p.zBelt - 0.02;
      if (k === 0) { trim.push(sideFace(q, T.plastic, inside)); continue; }
      (glassSide || glassRoof ? trim : paint).push(sideFace(q, glassSide || glassRoof ? T.glass : T.paint, inside));
    }
  }
  // end caps: grille/bumper front, tail back
  for (const [sec, sgn] of [[S[0], 1], [S[S.length - 1], -1]]) {
    const poly = sec.pts.map(([y, z]) => R(sec.xx, y, z));
    paint.push(faceOut(sgn > 0 ? poly : poly.slice().reverse(), T.paint, inside));
    // lamps: two quads on the cap, just proud of it (a style's `lamps`: 'round' octagons, 'bar' one strip across)
    const zl = sec.belt - 0.14, hw = W / 2 * 0.94, xo = sec.xx + sgn * 0.01, lampHex = sgn > 0 ? T.lamp : T.tail, back = R(sec.xx - sgn, 0, zl);
    if (spec.lamps === 'bar') trim.push(faceOut([R(xo, -(hw - 0.08), zl + 0.03), R(xo, hw - 0.08, zl + 0.03), R(xo, hw - 0.08, zl + 0.1), R(xo, -(hw - 0.08), zl + 0.1)], lampHex, back));
    else for (const sy of [-1, 1]) {
      const y0 = sy * (hw - 0.08), y1 = sy * (hw - 0.42);
      if (spec.lamps === 'round') {
        const cy = (y0 + y1) / 2, cz = zl + 0.07, rr = 0.11;
        trim.push(faceOut(Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * 2 * Math.PI; return R(xo, cy + rr * Math.cos(a), cz + rr * Math.sin(a)); }), lampHex, back));
      } else trim.push(faceOut([R(xo, y0, zl), R(xo, y1, zl), R(xo, y1, zl + 0.13), R(xo, y0, zl + 0.13)], lampHex, back));
    }
    if (sgn > 0) trim.push(faceOut([R(sec.xx + 0.012, -hw * 0.45, zR + 0.12), R(sec.xx + 0.012, hw * 0.45, zR + 0.12), R(sec.xx + 0.012, hw * 0.45, zl - 0.04), R(sec.xx + 0.012, -hw * 0.45, zl - 0.04)], T.plastic, R(sec.xx - 1, 0, zl)));
  }
}

function wheelsFor(trim, R, spec, axles, sink = null) {
  for (const [i, ax] of axles.entries()) for (const side of [-1, 1]) wheel(sink ? sink(i, side, ax) : trim, R, ax, side * (spec.track / 2), spec.r, spec.tyreW || 0.24, side, spec.hub);
}

/** Build one class at a yaw → { paint, trim, trailer? } face lists. `opts.spec` builds a compiled spec in place of the
 *  class's row (car-designer/realistic.js: the class's true numbers, a body family's profile, a style's lamps and hubs);
 *  `opts.wheels(axle, side, x)` → the face list each wheel goes to (its own bone), in place of the trim. */
export function buildVehicle(cls, yaw = 0, opts = {}) {
  const spec = opts.spec ?? FLEET[cls];
  if (!spec) throw new Error(`fleet: unknown class ${cls}`);
  const sink = opts.wheels ?? null;
  const R = makeFrame(yaw), paint = [], trim = [], trailer = [];
  const { L, W, r, wb } = spec;
  if (spec.kind === 'car' || spec.kind === 'box' || spec.kind === 'bus') {
    loftBody(paint, trim, R, spec);
    wheelsFor(trim, R, spec, [wb / 2 + (spec.kind === 'bus' ? 1.2 : 0), -wb / 2 + (spec.kind === 'bus' ? 1.2 : 0)], sink);
    if (spec.kind === 'bus') {                                     // a window band down both sides
      for (const sy of [-1, 1]) trim.push(faceOut([R(L / 2 - 1.3, sy * (W / 2 + 0.01), 1.55), R(-L / 2 + 0.6, sy * (W / 2 + 0.01), 1.55), R(-L / 2 + 0.6, sy * (W / 2 + 0.01), 2.75), R(L / 2 - 1.3, sy * (W / 2 + 0.01), 2.75)], T.glass, R(0, 0, 1.6)));
    }
  } else if (spec.kind === 'pickup') {
    loftBody(paint, trim, R, spec);
    // the bed: open box behind the cab (the loft's deck is the bed floor line); walls to 1.30 m
    const xb0 = L / 2 - spec.profile.deck * L, xb1 = -L / 2, zf = 0.95, zw = spec.profile.zDeck;
    for (const sy of [-1, 1]) box(paint, R, xb1, xb0, sy > 0 ? W / 2 - 0.08 : -W / 2, sy > 0 ? W / 2 : -W / 2 + 0.08, zf, zw, T.paint);
    box(paint, R, xb1, xb1 + 0.08, -W / 2, W / 2, zf, zw, T.paint);
    box(trim, R, xb1 + 0.08, xb0, -W / 2 + 0.08, W / 2 - 0.08, zf - 0.02, zf, T.plastic);
    wheelsFor(trim, R, spec, [wb / 2 + 0.25, -wb / 2 + 0.25], sink);
  } else if (spec.kind === 'straight') {
    const xc0 = L / 2, xc1 = L / 2 - spec.cab;
    prism(paint, R, [[xc1, 0.55], [xc0, 0.55], [xc0, 1.55], [xc0 - 0.45, spec.cabH], [xc1, spec.cabH]], -W / 2 + 0.05, W / 2 - 0.05, T.paint);
    for (const sy of [-1, 1]) trim.push(faceOut([R(xc0 - 0.5, sy * (W / 2 - 0.04), 1.75), R(xc1 + 0.3, sy * (W / 2 - 0.04), 1.75), R(xc1 + 0.3, sy * (W / 2 - 0.04), spec.cabH - 0.35), R(xc0 - 0.62, sy * (W / 2 - 0.04), spec.cabH - 0.35)], T.glass, R(xc1 + 1, 0, 2)));
    trim.push(faceOut([R(xc0 + 0.01, -W / 2 + 0.2, 1.7), R(xc0 - 0.4, -W / 2 + 0.2, spec.cabH - 0.3), R(xc0 - 0.4, W / 2 - 0.2, spec.cabH - 0.3), R(xc0 + 0.01, W / 2 - 0.2, 1.7)], T.glass, R(xc1, 0, 2)));
    box(trailer, R, -L / 2, xc1 - 0.15, -W / 2, W / 2, 1.05, spec.H, T.box);
    box(trim, R, -L / 2 + 0.3, xc0 - 0.2, -0.45, 0.45, 0.62, 1.05, T.frame);
    wheelsFor(trim, R, spec, [xc0 - 1.2, xc0 - 1.2 - wb], sink);
  } else if (spec.kind === 'semi') {
    // tractor: conventional North American — long hood, cab + sleeper; fifth wheel at the kingpin
    const xt0 = L / 2, hoodL = 2.0, cabL = 3.4, xs = xt0 - hoodL - cabL;
    prism(paint, R, [[xt0 - hoodL, 0.75], [xt0, 0.75], [xt0, 1.75], [xt0 - 0.35, 2.05], [xt0 - hoodL, 2.15]], -1.05, 1.05, T.paint);
    prism(paint, R, [[xs, 0.95], [xt0 - hoodL, 0.95], [xt0 - hoodL, 2.15], [xt0 - hoodL - 0.55, 3.05], [xs + 0.3, spec.cabH], [xs, spec.cabH]], -W / 2 + 0.06, W / 2 - 0.06, T.paint);
    trim.push(faceOut([R(xt0 - hoodL + 0.02, -1.1, 2.2), R(xt0 - hoodL - 0.5, -1.1, 2.98), R(xt0 - hoodL - 0.5, 1.1, 2.98), R(xt0 - hoodL + 0.02, 1.1, 2.2)], T.glass, R(xs, 0, 2)));
    for (const sy of [-1, 1]) trim.push(faceOut([R(xt0 - hoodL - 0.1, sy * (W / 2 - 0.05), 2.2), R(xt0 - hoodL - 1.3, sy * (W / 2 - 0.05), 2.2), R(xt0 - hoodL - 1.3, sy * (W / 2 - 0.05), 2.95), R(xt0 - hoodL - 0.62, sy * (W / 2 - 0.05), 2.95)], T.glass, R(xs + 1, 0, 2)));
    trim.push(faceOut([R(xt0 + 0.01, -0.75, 0.95), R(xt0 + 0.01, 0.75, 0.95), R(xt0 + 0.01, 0.75, 1.65), R(xt0 + 0.01, -0.75, 1.65)], T.chrome, R(xt0 - 1, 0, 1.2)));
    for (const sy of [-1, 1]) box(trim, R, xs + 0.3, xs + 1.8, sy > 0 ? 0.62 : -1.2, sy > 0 ? 1.2 : -0.62, 0.55, 1.05, T.chrome);   // fuel tanks
    const xk = L / 2 - spec.kingpin;                                  // kingpin over the drive tandem
    box(trim, R, xk - 1.4, xt0 - 0.2, -0.5, 0.5, 0.75, 1.1, T.frame);
    wheelsFor(trim, R, spec, [xt0 - 1.1, xk + 0.65, xk - 0.65], sink);
    // 53 ft trailer: floor 1.25 m, roof at H, tandem at the rear, landing gear, side skirt
    const xr0 = xk + 1.0, xr1 = xr0 - spec.trailerL;
    box(trailer, R, xr1, xr0, -W / 2, W / 2, 1.25, spec.H, T.box);
    for (const sy of [-1, 1]) box(trim, R, xr1 + 5.0, xk - 2.0, sy > 0 ? W / 2 - 0.05 : -W / 2, sy > 0 ? W / 2 - 0.02 : -W / 2 + 0.03, 0.35, 1.25, T.plastic);
    box(trim, R, xr1 + 0.05, xr1 + 0.2, -W / 2 + 0.2, W / 2 - 0.2, 0.45, 0.6, T.frame);            // underride guard
    for (const sy of [-1, 1]) box(trim, R, xk - 1.9, xk - 1.75, sy * 0.95 - 0.07, sy * 0.95 + 0.07, 0.1, 1.25, T.frame);   // landing gear
    for (const sy of [-1, 1]) trim.push(faceOut([R(xr1 - 0.01, sy * 0.95, 0.95), R(xr1 - 0.01, sy * 1.15, 0.95), R(xr1 - 0.01, sy * 1.15, 1.1), R(xr1 - 0.01, sy * 0.95, 1.1)], T.tail, R(xr1 + 1, 0, 1)));
    wheelsFor(trim, R, { ...spec, r: 0.51 }, [xr1 + 1.9, xr1 + 3.15], sink);
  }
  return { paint, trim, trailer };
}

/** Measured footprint of a built class at yaw 0 (the census's per-instance check reads this). */
export function vehicleBounds(cls) {
  const { paint, trim, trailer } = buildVehicle(cls, 0);
  const ps = [...paint, ...trim, ...trailer].flatMap((f) => f.corners);
  const ext = (k) => Math.max(...ps.map((p) => p[k])) - Math.min(...ps.map((p) => p[k]));
  return { L: ext(0), W: ext(1), H: Math.max(...ps.map((p) => p[2])) };
}
