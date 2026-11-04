/**
 * boat-sub — a submarine's hull on the craft shelf (boat-odm.js `boat-hull`, family 'round'), reached through the hull's
 * builder: a body of revolution and what stands on it and turns behind it. Its torpedoes and missiles are modelled,
 * never fired: their doors and hatches are drawn shut. Pure.
 *
 *   round    the hull: a body of revolution about its axis (`body`: its radius along its length s, 0 the stern … 1 the
 *            bow, as knots; the axis `axis` above the keel's lowest point), its casing along its top (`casing`: from,
 *            to, width, the deck's height over the axis), hatches on it, the torpedo tubes' doors on its bow (`tubes`:
 *            their place s, their count each side), a row of missile hatches (`missiles`: from, to, count); its sail (fin)
 *            on the casing (`sail`: at, chord, thickness, height, its fairwater planes `planes` and its masts `masts`);
 *            its stern planes and rudders (`stern`: `form` '+' or 'x', the fins' leading edge `at`, their span and
 *            chord, the moving flap's share and throw); its screw (`screw`: blades, diameter, skew, pitch).
 *            Poses: `planes` (−1 … 1 its planes' rise), `yaw` (−1 … 1 its rudders), `prop` (degrees its screw turns),
 *            `masts` (0 housed … 1 raised). Points: `mount` (the keel's lowest point amidships), `sailTop`, `casing`
 *            (the casing's deck amidships)
 *
 * Its hydrostatics are its sections (boat-parts.js `hullSection`: a circle at each station), so it floats surfaced at
 * the waterline its weight sets; the water it floods to dive is the rest of its envelope (index.js `afloat.ballast`).
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { DEG, lathe, extrudeWorld, loftWorld, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => a.map((v) => v * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const E = (id, from, to, offsets, tint, extra) => extrudeWorld(id, from, to, ccw(from, to, offsets), tint, extra);
// (a symmetric foil's section in the plane of `c` (its chord, nose first) and `n` (its thickness): nose at the origin)
const foil = (c, n, chord, thick, k = 9) => {
  const xs = Array.from({ length: k }, (_, i) => (1 - Math.cos((Math.PI * i) / (k - 1))) / 2);
  const yt = (x) => 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4) + 0.004 * x;
  const top = xs.map((x) => add(mul(c, x * chord), mul(n, yt(x) * chord))), bot = xs.slice(1, -1).reverse().map((x) => add(mul(c, x * chord), mul(n, -yt(x) * chord)));
  return [...top, ...bot];
};
// (a vector turned about the unit axis k by a: Rodrigues)
const turn = (v, k, a) => {
  const c = Math.cos(a), s = Math.sin(a), d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c));
};
const DARK = '#141516';

/** The hull's radius at s (0 the stern … 1 the bow), from its `body` knots (piecewise smooth, never below zero). */
export function bodyRadius(row, s, curveAt) {
  return Math.max(0, curveAt(row.build.body.radius, s));
}

export function buildRoundHull(row, C, opts = {}, curveAt) {
  const b = row.build, pose = opts.pose || {}, L = row.dims.length, A = b.body.axis, rAt = (s) => bodyRadius(row, s, curveAt), yAt = (s) => -L / 2 + s * L;
  const lathes = [], lofts = [], extrudes = [];
  // the hull: its body of revolution, its stations closer toward its ends where it curves
  const S = Array.from({ length: 49 }, (_, k) => { const u = k / 48; return u < 0.5 ? 0.5 * (2 * u) ** 1.6 : 1 - 0.5 * (2 - 2 * u) ** 1.6; });
  lathes.push(lathe('hull', [0, yAt(0), A], [0, yAt(1), A], S.map((s) => [s, rAt(s)]), C.paint, { samples: 40, crossSections: 49 }));
  // the casing: a flat deck along its top, its sides falling into the hull
  const K = b.casing, top = A + K.top, hw = K.width / 2;
  const cs = Array.from({ length: 13 }, (_, k) => K.from + ((K.to - K.from) * k) / 12);
  lofts.push(loftWorld('casing', [0, yAt(K.from), 0], [0, yAt(K.to), 0], cs.map((s) => {
    const r = rAt(s), w = Math.min(hw, r * 0.55), zb = A + Math.sqrt(Math.max(0, r * r - w * w)) - 0.25, zt = Math.min(top, A + r + (top - A - rAt(0.5)));
    return { t: (s - K.from) / (K.to - K.from), points: [[w, 0, zb], [w, 0, zt], [-w, 0, zt], [-w, 0, zb]] };
  }), tone(C.paint, 0.04)));
  for (const [k, s] of (K.hatches || []).entries()) lathes.push(lathe(`hatch_${k}`, [0, yAt(s), top - 0.05], [0, yAt(s), top + 0.06], [[0, 0.5], [1, 0.46]], tone(C.paint, -0.12), { samples: 16, crossSections: 2 }));
  // the missile hatches: a row of pairs along the casing's top, shut
  if (b.missiles) for (let k = 0; k < b.missiles.count; k += 1) {
    const s = b.missiles.from + ((b.missiles.to - b.missiles.from) * (k + 0.5)) / b.missiles.count;
    for (const sx of [1, -1]) lathes.push(lathe(`missile_hatch_${k}${sx > 0 ? 'r' : 'l'}`, [sx * hw * 0.5, yAt(s), top - 0.05], [sx * hw * 0.5, yAt(s), top + 0.08], [[0, b.missiles.radius], [1, b.missiles.radius * 0.94]], tone(C.paint, -0.1), { samples: 18, crossSections: 2 }));
  }
  // the torpedo tubes' doors on the bow, either side below the axis, flush with the hull
  if (b.tubes) for (const sx of [1, -1]) for (let k = 0; k < b.tubes.count; k += 1) {
    const s = b.tubes.at, r = rAt(s), a = (-12 - 22 * k) * DEG, n = [sx * Math.cos(a), 0, Math.sin(a)], c = add([0, yAt(s), A], mul(n, r));
    extrudes.push(E(`tube_door_${sx > 0 ? 'r' : 'l'}${k}`, add(c, mul(n, -0.1)), add(c, mul(n, 0.03)), Array.from({ length: 10 }, (_, i) => { const q = (2 * Math.PI * i) / 10; return add([0, 0.42 * Math.cos(q), 0], mul([-n[2] * sx, 0, Math.abs(n[0])], 0.36 * Math.sin(q))); }), DARK));
  }
  // the sail on the casing: a streamlined fin, tapering a little to its top
  const V = b.sail, ys = yAt(V.at), zs0 = A + rAt(V.at) - 0.6, zs1 = top + V.height, chord = V.chord;
  const plan = (k) => foil([0, -1, 0], [1, 0, 0], chord * k, V.thickness / chord).map((p) => add(p, [0, chord * k / 2, 0]));
  lofts.push(loftWorld('sail', [0, ys, zs0], [0, ys, zs1], [[0, 1], [1, V.taper ?? 0.92]].map(([t, k]) => ({ t, points: plan(k) })), C.paint));
  lathes.push(lathe('sail_cap', [0, ys, zs1 - 0.02], [0, ys, zs1 + 0.06], [[0, 0.5], [1, 0.4]], tone(C.paint, -0.1), { samples: 12, crossSections: 2 }));
  const joints = [];
  // its fairwater planes out of the sail's sides, turning about their span (`pose.planes`)
  const rise = clamp(pose.planes, -1, 1) * (V.planes.throw ?? 20) * DEG;
  for (const sx of [1, -1]) {
    const yq = ys + chord / 2 - V.planes.at * chord, zq = top + V.height * V.planes.height, root = [sx * (V.thickness / 2 - 0.25), yq, zq], tip = [sx * (V.thickness / 2 + V.planes.span), yq, zq];
    const cdir = turn([0, -1, 0], [1, 0, 0], rise), ndir = turn([0, 0, 1], [1, 0, 0], rise);
    extrudes.push(E(`sail_plane_${sx > 0 ? 'r' : 'l'}`, root, tip, foil(cdir, ndir, V.planes.chord, 0.14).map((p) => add(p, mul(cdir, -V.planes.chord * 0.3))), C.paint));
  }
  joints.push({ name: 'planes', control: 'planes', kind: 'hinge', at: r3v([0, ys + chord / 2 - V.planes.at * chord, top + V.height * V.planes.height]), dir: [1, 0, 0], range: [-(V.planes.throw ?? 20), V.planes.throw ?? 20], angle: round3(rise / DEG) || 0 });
  // its masts in the sail's top: housed in it, raised (`pose.masts`)
  const up = clamp(pose.masts, 0, 1);
  for (const [k, M] of (V.masts || []).entries()) {
    const p = [M.x ?? 0, ys + chord / 2 - M.at * chord, zs1], h = 0.3 + up * M.height;
    lathes.push(lathe(`mast_${k}`, add(p, [0, 0, -0.3]), add(p, [0, 0, h]), M.head ? [[0, M.radius], [0.85, M.radius], [0.88, M.head], [1, M.head * 0.8]] : [[0, M.radius], [1, M.radius * 0.85]], tone(C.paint, -0.15), { samples: 12, crossSections: M.head ? 4 : 2 }));
  }
  if (V.masts?.length) joints.push({ name: 'masts', control: 'masts', kind: 'slide', at: r3v([0, ys, zs1]), dir: [0, 0, 1], range: [0, Math.max(...V.masts.map((M) => M.height))], travel: round3(up * Math.max(...V.masts.map((M) => M.height))) });
  // the stern's planes and rudders: four fins about the stern cone, each a fixed fin and its moving flap
  const T = b.stern, yr1 = yAt(T.at), rr = rAt(T.at - T.chord / L) - 0.1, rt = rr + T.span, fc = T.chord * (1 - T.flap);
  const yaw = clamp(pose.yaw, -1, 1) * T.throw * DEG, pitch = clamp(pose.planes, -1, 1) * T.throw * DEG;
  const angles = T.form === 'x' ? [45, 135, 225, 315] : [0, 90, 180, 270];
  for (const [k, deg] of angles.entries()) {
    const a = deg * DEG, rad = [Math.cos(a), 0, Math.sin(a)], tan = [-Math.sin(a), 0, Math.cos(a)];
    // (each flap turned about its own span by the share of the yaw and the rise its fin carries: a rudder all the
    // yaw, a plane all the rise, an X's fin some of each, so every trailing edge moves the same way)
    const d = yaw * tan[0] + pitch * tan[2], nose = [0, yr1, A], hinge = add(nose, [0, -fc, 0]);
    extrudes.push(E(`stern_fin_${k}`, add(nose, mul(rad, rr)), add(nose, mul(rad, rt)), foil([0, -1, 0], tan, T.chord, 0.12).filter((p) => -p[1] <= fc + 1e-9), C.paint));
    const fdir = turn([0, -1, 0], rad, d), fn = turn(tan, rad, d);
    extrudes.push(E(`stern_flap_${k}`, add(hinge, mul(rad, rr)), add(hinge, mul(rad, rt)), [mul(tan, 0.16), mul(tan, -0.16), add(mul(fdir, T.chord - fc), mul(fn, -0.02)), add(mul(fdir, T.chord - fc), mul(fn, 0.02))], tone(C.paint, -0.05)));
  }
  joints.push({ name: 'rudders', control: 'yaw', kind: 'hinge', at: r3v([0, yr1 - fc, A]), dir: [0, 0, 1], range: [-T.throw, T.throw], angle: round3(yaw / DEG) || 0 });
  // the screw on the stern's tip: its hub and its skewed blades about the axis (`pose.prop`)
  const Q = b.screw, R = Q.diameter / 2, yp = yAt(0) - 0.4, spin = ((Number(pose.prop) || 0) % 360) * DEG;
  lathes.push(lathe('screw_hub', [0, yp - 1.0, A], [0, yp + 0.8, A], [[0, 0.15], [0.35, 0.55], [1, rAt(0) * 0.95]], C.paint, { samples: 20, crossSections: 4 }));
  const fwd = [0, 1, 0], r0 = 0.45, F = [0, 0.35, 0.7, 1];
  // (a blade's sections in its own frame, its tip `Rt` out: [tangential, axial] offsets of its foil at f, set back along
  // its turn the further out it is (its skew))
  const sectionAt = (f, Rt) => {
    const r = r0 + f * (Rt - r0), beta = Math.atan(Q.pitch * R * 2 / (2 * Math.PI * r)), c = R * (0.3 + 0.22 * Math.sin(Math.PI * Math.min(f, 0.8))), tk = c * (0.1 - 0.065 * f);
    const cd = [Math.cos(beta), Math.sin(beta)], nd = [-Math.sin(beta), Math.cos(beta)], sk = -Q.skew * R * f * f;
    return { r, pts: Array.from({ length: 10 }, (_, i) => { const q = (2 * Math.PI * i) / 10, a = sk + (c / 2) * Math.cos(q), n = (tk / 2) * Math.sin(q); return [cd[0] * a + nd[0] * n, cd[1] * a + nd[1] * n]; }) };
  };
  // (its tip set in so that no part of a skewed blade reaches past the screw's diameter)
  const reach = (Rt) => Math.max(...F.map((f) => { const S = sectionAt(f, Rt); return Math.max(...S.pts.map(([t]) => Math.hypot(S.r, t))); }));
  let lo = r0 + 0.1, hi = R;
  for (let i = 0; i < 30; i += 1) { const m = (lo + hi) / 2; if (reach(m) > R) hi = m; else lo = m; }
  const Rt = round3(lo);
  for (let k = 0; k < Q.blades; k += 1) {
    const phi = (2 * Math.PI * k) / Q.blades + spin, rhat = [Math.cos(phi), 0, Math.sin(phi)], tan = [-Math.sin(phi), 0, Math.cos(phi)];
    const station = (f) => sectionAt(f, Rt).pts.map(([t, a]) => add(mul(tan, t), mul(fwd, a)));
    const hub = [0, yp, A];
    lofts.push(loftWorld(`screw_blade_${k}`, add(hub, mul(rhat, r0)), add(hub, mul(rhat, Rt)), F.map((f) => ({ t: f, points: station(f) })), tone(C.paint, -0.05), { interp: 'smooth', segments: 3 }));
  }
  const hardpoints = { mount: [0, 0, 0], sailTop: r3v([0, ys, zs1]), casing: r3v([0, 0, top]) };
  for (const [name, s] of Object.entries(b.points || {})) hardpoints[name] = r3v([0, yAt(s), top]);
  return { lathes, lofts, extrudes, hardpoints, joints };
}
