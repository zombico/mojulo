/**
 * con-wheeled — the builders of the machines on wheels: a site tyre on its rim, the frames a loader bends between at its
 * hitch, a skid steer's chassis, a loader's lift arms and its bellcrank, a loader's bucket. Each drawn in its body's
 * frame, as every part on the shelf is (con-parts.js says the contract).
 *
 * Pure: no clock, no dice.
 */
import { add, box, extrudeWorld, loftWorld, mul, panel as rawPanel, roundRect, spin, sub, tone, tube, unit } from './con-common.js';

// (an outline wound anticlockwise about the way it is extruded, as con-parts.js winds them)
const area = (o) => o.reduce((s, p, i) => { const q = o[(i + 1) % o.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const wound = (o, sign) => (area(o) * sign < 0 ? o.slice().reverse() : o);
const panel = (id, x0, x1, outline, tint) => rawPanel(id, x0, x1, wound(outline, Math.sign(x1 - x0) || 1), tint);
function plan(id, z0, z1, raw, tint) {
  const outline = wound(raw, Math.sign(z1 - z0) || 1);
  const xc = outline.reduce((s, p) => s + p[0], 0) / outline.length, yc = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  return extrudeWorld(id, [xc, yc, z0], [xc, yc, z1], outline.map(([x, y]) => [x - xc, y - yc, 0]), tint);
}
const boss = (id, p, x0, x1, r, tint) => spin(id, [x0, p[1], p[2]], [x1, p[1], p[2]], [[0, r], [1, r]], tint, 16);
function beam(id, a, b, w, h, w1, h1, tint, r = 0.04) {
  const ax = sub(b, a);
  return loftWorld(id, a, b, [{ t: 0, points: roundRect(ax, w, h, r, 2) }, { t: 1, points: roundRect(ax, w1, h1, r, 2) }], tint);
}

// ── a site tyre on its rim: its casing turned about x, its lugs round its tread ─────────────────────────────────
export function wheel(row, C) {
  const { r, width: w, rim, lugs } = row.dims, lathes = [], extrudes = [], rubber = C.rubber;
  const sh = Math.min(0.35 * w, 0.4 * (r - rim));
  lathes.push(spin('casing', [-w / 2, 0, 0], [w / 2, 0, 0], [[0, rim + 0.02], [0.03, r - sh], [0.15, r - 0.02], [0.85, r - 0.02], [0.97, r - sh], [1, rim + 0.02]], rubber, 28));
  lathes.push(spin('rim', [-w / 2 + 0.04, 0, 0], [w / 2 - 0.04, 0, 0], [[0, rim], [0.1, rim - 0.03], [0.5, rim * 0.55], [0.9, rim - 0.03], [1, rim]], C.paint, 24));
  lathes.push(spin('hub', [-w / 2 + 0.02, 0, 0], [-w / 2 + 0.12, 0, 0], [[0, rim * 0.35], [1, rim * 0.4]], tone(C.trim, 0.2), 16));
  // the lugs: bars across the tread, each side's leaning the other way (a chevron, as a site tyre's)
  for (let k = 0; k < lugs; k++) {
    const a = (2 * Math.PI * k) / lugs, u = [0, Math.cos(a), Math.sin(a)], t = [0, -Math.sin(a), Math.cos(a)];
    for (const s of [1, -1]) {
      // (a lug as wide as a third of the tread's round between two, as deep as a twentieth of the tyre's radius)
      const c = add(mul(u, r - 0.03), [s * w * 0.25, 0, 0]), lean = mul(t, s * w * 0.06), wl = (Math.PI * r) / lugs * 0.9;
      extrudes.push(extrudeWorld(`lug_${k}_${s > 0 ? 'r' : 'l'}`, c, add(c, mul(u, 0.03 + r * 0.045)), [add([-w * 0.23, 0, 0], mul(lean, -1)), add([w * 0.23, 0, 0], lean), add(add([w * 0.23, 0, 0], lean), mul(t, wl)), add(add([-w * 0.23, 0, 0], mul(lean, -1)), mul(t, wl))], rubber));
    }
  }
  return { lathes, extrudes, hardpoints: { hub: [0, 0, 0] } };
}

// ── a loader's rear frame: the engine and its hood, the counterweight's grille, the cab's deck, the hitch ────────
export function loaderRear(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], lofts = [], sweeps = [], body = C.paint, dark = C.trim;
  const hb = physics.wheelbase / 2, tw = physics.track / 2, ax = [0, -hb, physics.wheelRadius];
  // the frame from the hitch back over the rear axle, its axle and its hubs
  extrudes.push(box('frame', [0, -0.25, 0.85], [0, d.tail + 0.2, 0.85], 1.0, 0.5, dark));
  lathes.push(spin('axle', [-tw + 0.3, ax[1], ax[2]], [tw - 0.3, ax[1], ax[2]], [[0, 0.13], [0.15, 0.16], [0.4, 0.2], [0.6, 0.2], [0.85, 0.16], [1, 0.13]], tone(dark, 0.1), 18));
  // the engine's hood from behind the cab to the tail, its grille, the counterweight under it
  extrudes.push(plan('hood', 1.1, d.hoodTop, [[-0.62, d.cab[1] - 0.95], [0.62, d.cab[1] - 0.95], [0.62, d.tail + 0.45], [-0.62, d.tail + 0.45]], body));
  extrudes.push(plan('hood_cap', d.hoodTop, d.hoodTop + 0.05, [[-0.55, d.cab[1] - 1.0], [0.55, d.cab[1] - 1.0], [0.55, d.tail + 0.5], [-0.55, d.tail + 0.5]], tone(body, -0.06)));
  extrudes.push(plan('counterweight', 0.55, 1.35, [[-1.0, d.tail], [1.0, d.tail], [1.0, d.tail + 0.5], [-1.0, d.tail + 0.5]], body));
  extrudes.push(box('grille', [0, d.tail - 0.01, 1.7], [0, d.tail + 0.03, 1.7], 1.0, 0.65, dark));
  lathes.push(spin('stack', [0.35, d.tail + 1.2, d.hoodTop], [0.35, d.tail + 1.2, d.hoodTop + 0.5], [[0, 0.065], [1, 0.07]], tone(dark, 0.2), 14));
  // the cab's deck and the fenders over the rear wheels, the steps
  extrudes.push(plan('deck', 1.05, 1.15, [[-1.2, d.cab[1] - 0.7], [1.2, d.cab[1] - 0.7], [1.2, -0.25], [-1.2, -0.25]], dark));
  for (const s of [1, -1]) {
    extrudes.push(box(`fender_${s > 0 ? 'r' : 'l'}`, [s * tw, ax[1] - physics.wheelRadius - 0.1, ax[2] + physics.wheelRadius + 0.08], [s * tw, ax[1] + physics.wheelRadius + 0.1, ax[2] + physics.wheelRadius + 0.08], 0.7, 0.05, body));
    sweeps.push(tube(`rail_${s > 0 ? 'r' : 'l'}`, [[s * 1.15, d.cab[1] - 0.6, 1.15], [s * 1.15, d.cab[1] - 0.6, 1.9], [s * 1.15, d.tail + 1.0, 1.9]], 0.018, C.light, 8));
  }
  // the hitch's upper and lower plates (the front frame's pins between them), the steer rams' bases
  for (const z of [0.55, 1.15]) extrudes.push(box(`hitch_${z < 1 ? 'lo' : 'hi'}`, [0, -0.35, z], [0, 0.12, z], 0.6, 0.06, dark));
  const S = d.steerRam;
  for (const s of [1, -1]) lathes.push(boss(`steer_pin_${s > 0 ? 'r' : 'l'}`, [s * S[0], S[1], S[2]], s * (S[0] - 0.08), s * (S[0] + 0.08), 0.05, tone(dark, 0.2)));
  return { extrudes, lathes, lofts, sweeps, hardpoints: { hitch: [0, 0, 0], cab: d.cab, 'steerRam.r': S, 'steerRam.l': [-S[0], S[1], S[2]], 'wheel.r': [tw, ax[1], ax[2]], 'wheel.l': [-tw, ax[1], ax[2]] } };
}

// ── a loader's front frame: its towers the lift arms hinge on, its axle, the lift rams' bases ───────────────────
export function loaderFront(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim;
  const hb = physics.wheelbase / 2, tw = physics.track / 2, ax = [0, hb, physics.wheelRadius];
  extrudes.push(box('frame', [0, 0.12, 0.8], [0, hb + 0.5, 0.8], 0.9, 0.45, dark));
  lathes.push(spin('axle', [-tw + 0.3, ax[1], ax[2]], [tw - 0.3, ax[1], ax[2]], [[0, 0.13], [0.15, 0.16], [0.4, 0.2], [0.6, 0.2], [0.85, 0.16], [1, 0.13]], tone(dark, 0.1), 18));
  const A = d.armPivot, L = d.liftRam;
  for (const s of [1, -1]) {
    // the towers either side, up to the arms' pins; the lift rams' lugs low on their fronts
    extrudes.push(panel(`tower_${s > 0 ? 'r' : 'l'}`, s * (A[0] - 0.07), s * (A[0] + 0.07), [[0.12, 0.6], [hb + 0.35, 0.6], [hb + 0.1, 1.1], [A[1] + 0.2, A[2] + 0.15], [A[1] - 0.2, A[2] + 0.15], [0.12, 1.15]], body));
    lathes.push(boss(`arm_pin_${s > 0 ? 'r' : 'l'}`, A, s * (A[0] - 0.1), s * (A[0] + 0.1), 0.09, tone(dark, 0.2)));
    lathes.push(boss(`lift_pin_${s > 0 ? 'r' : 'l'}`, [s * L[0], L[1], L[2]], s * (L[0] - 0.08), s * (L[0] + 0.08), 0.06, tone(dark, 0.2)));
    extrudes.push(box(`fender_${s > 0 ? 'r' : 'l'}`, [s * tw, ax[1] - physics.wheelRadius - 0.05, ax[2] + physics.wheelRadius + 0.06], [s * tw, ax[1] + physics.wheelRadius * 0.6, ax[2] + physics.wheelRadius + 0.06], 0.65, 0.04, body));
  }
  const S = d.steerEye;
  for (const s of [1, -1]) lathes.push(boss(`steer_eye_${s > 0 ? 'r' : 'l'}`, [s * S[0], S[1], S[2]], s * (S[0] - 0.08), s * (S[0] + 0.08), 0.05, tone(dark, 0.2)));
  return { extrudes, lathes, hardpoints: { armPivot: [0, A[1], A[2]], 'liftRam.r': L, 'liftRam.l': [-L[0], L[1], L[2]], 'steerEye.r': S, 'steerEye.l': [-S[0], S[1], S[2]], 'wheel.r': [tw, ax[1], ax[2]], 'wheel.l': [-tw, ax[1], ax[2]] } };
}

// ── a skid steer's chassis: its tub, the engine aft, the towers its arms pivot on, its axles' cases ─────────────
export function skidChassis(row, C, { physics }) {
  const d = row.dims, extrudes = [], lathes = [], body = C.paint, dark = C.trim;
  const hb = physics.wheelbase / 2, tw = physics.track / 2, z = physics.wheelRadius;
  extrudes.push(plan('tub', 0.22, 0.75, [[-tw + 0.28, -hb - 0.55], [tw - 0.28, -hb - 0.55], [tw - 0.28, hb + 0.25], [-tw + 0.28, hb + 0.25]], dark));
  extrudes.push(plan('hood', 0.75, 1.15, [[-tw + 0.32, -hb - 0.55], [tw - 0.32, -hb - 0.55], [tw - 0.32, -hb + 0.1], [-tw + 0.32, -hb + 0.1]], body));
  extrudes.push(box('grille', [0, -hb - 0.56, 0.95], [0, -hb - 0.53, 0.95], 0.8, 0.3, dark));
  const A = d.armPivot, L = d.liftRam;
  for (const s of [1, -1]) {
    // the chain cases along each side (the wheels' axles through them), the towers at the back up to the arms' pins
    extrudes.push(box(`case_${s > 0 ? 'r' : 'l'}`, [s * (tw - 0.3), -hb - 0.3, z], [s * (tw - 0.3), hb + 0.3, z], 0.18, 0.32, dark));
    extrudes.push(panel(`tower_${s > 0 ? 'r' : 'l'}`, s * (A[0] - 0.12), s * (A[0] - 0.02), [[-hb - 0.55, 0.6], [-hb + 0.3, 0.6], [A[1] + 0.12, A[2] + 0.1], [A[1] - 0.15, A[2] + 0.12]], body));
    lathes.push(boss(`arm_pin_${s > 0 ? 'r' : 'l'}`, A, s * (A[0] - 0.14), s * (A[0] + 0.02), 0.06, tone(dark, 0.2)));
    lathes.push(boss(`lift_pin_${s > 0 ? 'r' : 'l'}`, [s * L[0], L[1], L[2]], s * (L[0] - 0.1), s * (L[0] + 0.02), 0.05, tone(dark, 0.2)));
  }
  return { extrudes, lathes, hardpoints: { cab: d.cab, armPivot: [0, A[1], A[2]], 'liftRam.r': L, 'liftRam.l': [-L[0], L[1], L[2]], 'wheelF.r': [tw, hb, z], 'wheelF.l': [-tw, hb, z], 'wheelR.r': [tw, -hb, z], 'wheelR.l': [-tw, -hb, z], tracks: [0, 0, 0] } };
}

// ── a loader's lift arms: two arms from their pins to the bucket's, their cross tube, the rams' eyes ───────────
export function liftArms(row, C) {
  const d = row.dims, extrudes = [], lathes = [], lofts = [], body = C.paint, dark = C.trim, T = [0, d.length, 0];
  const K = d.knee, xw = d.spread;
  for (const s of [1, -1]) {
    lofts.push(beam(`arm_${s > 0 ? 'r' : 'l'}`, [s * xw, 0, 0], [s * xw, K[0], K[1]], d.w, d.h, d.w, d.h * 1.1, body));
    lofts.push(beam(`arm_fore_${s > 0 ? 'r' : 'l'}`, [s * xw, K[0], K[1]], [s * xw, T[1], 0], d.w, d.h * 1.1, d.w, d.h * 0.8, body));
    lathes.push(boss(`pivot_${s > 0 ? 'r' : 'l'}`, [0, 0, 0], s * (xw - 0.08), s * (xw + 0.08), 0.1, tone(body, -0.15)));
    lathes.push(boss(`tip_${s > 0 ? 'r' : 'l'}`, T, s * (xw - 0.08), s * (xw + 0.08), 0.09, tone(body, -0.15)));
    const E = d.ramEye;
    lathes.push(boss(`eye_${s > 0 ? 'r' : 'l'}`, [s * E[0], E[1], E[2]], s * (E[0] - 0.1), s * (E[0] + 0.03), 0.06, tone(dark, 0.2)));
  }
  // the cross tube between the arms, the bellcrank's pin (or the tilt rams' lugs) on it
  const X = d.cross;
  lathes.push(boss('cross', X, -xw, xw, 0.13, body));
  const hp = { tip: T, 'ramEye.r': d.ramEye, 'ramEye.l': [-d.ramEye[0], d.ramEye[1], d.ramEye[2]] };
  if (d.crank) {
    extrudes.push(panel('crank_lug', -0.16, 0.16, [[X[1] - 0.25, X[2]], [X[1] + 0.25, X[2]], [d.crank[1] + 0.08, d.crank[2]], [d.crank[1] - 0.08, d.crank[2]]], body));
    lathes.push(boss('crank_pin', d.crank, -0.16, 0.16, 0.07, tone(dark, 0.2)));
    extrudes.push(panel('tilt_lug', -0.09, 0.09, [[X[1] - 0.35, X[2] - 0.05], [X[1] - 0.05, X[2] - 0.05], [d.tiltRam[1] + 0.06, d.tiltRam[2]], [d.tiltRam[1] - 0.06, d.tiltRam[2]]], body));
    lathes.push(boss('tilt_pin', d.tiltRam, -0.1, 0.1, 0.06, tone(dark, 0.2)));
    Object.assign(hp, { crank: d.crank, tiltRam: d.tiltRam });
  }
  if (d.tiltRams) {
    const Tr = d.tiltRams;
    for (const s of [1, -1]) lathes.push(boss(`tilt_pin_${s > 0 ? 'r' : 'l'}`, [s * Tr[0], Tr[1], Tr[2]], s * (Tr[0] - 0.08), s * (Tr[0] + 0.08), 0.05, tone(dark, 0.2)));
    Object.assign(hp, { 'tiltRam.r': Tr, 'tiltRam.l': [-Tr[0], Tr[1], Tr[2]] });
  }
  return { extrudes, lathes, lofts, hardpoints: hp };
}

// ── a Z-bar's bellcrank: two plates about its pin, its upper pin (the tilt ram's) and its lower (the tilt link's) ─
export function bellcrank(row, C) {
  const d = row.dims, U = d.upper, Lo = d.lower, extrudes = [], lathes = [], steel = C.paint;
  for (const s of [1, -1]) extrudes.push(panel(`plate_${s > 0 ? 'r' : 'l'}`, s * 0.1, s * 0.14, [[U[1] - 0.08, U[2]], [U[1] + 0.08, U[2]], [0.12, 0], [Lo[1] + 0.08, Lo[2]], [Lo[1] - 0.08, Lo[2]], [-0.12, 0]], steel));
  for (const [id, p] of [['pin', [0, 0, 0]], ['upper', U], ['lower', Lo]]) lathes.push(boss(id, p, -0.15, 0.15, 0.065, tone(C.trim, 0.2)));
  return { extrudes, lathes, hardpoints: { pin: [0, 0, 0], upper: U, lower: Lo } };
}

// ── a loader's (or a skid steer's) bucket: its back and floor, its sides, its cutting edge, its ears ────────────
export function loaderBucket(row, C) {
  const d = row.dims, P = d.profile, w = d.width, extrudes = [], lathes = [], body = C.paint, wear = tone(C.trim, 0.25);
  for (const s of [1, -1]) extrudes.push(panel(`side_${s > 0 ? 'r' : 'l'}`, s * (w / 2 - 0.03), s * (w / 2), P, body));
  // the wrapper from the cutting edge round the floor and up the back (the mouth, from the top lip to the edge, open)
  for (let i = 1; i + 1 < P.length; i++) {
    const A = [0, P[i][0], P[i][1]], B = [0, P[i + 1][0], P[i + 1][1]], t = unit(sub(B, A)), n = [0, t[2], -t[1]];
    extrudes.push(box(`wrap_${i}`, add(sub(A, mul(t, 0.01)), mul(n, -0.015)), add(add(B, mul(t, 0.01)), mul(n, -0.015)), w - 0.06, 0.03, body, n));
  }
  const E = [0, P[1][0], P[1][1]];
  extrudes.push(box('edge', add(E, [-w / 2 + 0.03, 0, 0]), add(E, [w / 2 - 0.03, 0, 0]), 0.1, 0.04, wear, [0, 0, 1]));
  // the ears at the back: its pins and its link's
  const Lk = d.link;
  for (const s of [1, -1]) {
    extrudes.push(panel(`ear_${s > 0 ? 'r' : 'l'}`, s * (d.ears - 0.03), s * (d.ears + 0.03), [[-0.12, -0.12], [0.18, -0.08], [Lk[1] + 0.1, Lk[2] + 0.1], [Lk[1] - 0.1, Lk[2] + 0.1]], tone(body, -0.1)));
    lathes.push(boss(`pin_${s > 0 ? 'r' : 'l'}`, [0, 0, 0], s * (d.ears - 0.06), s * (d.ears + 0.06), 0.07, tone(C.trim, 0.2)));
  }
  lathes.push(boss('link_pin', Lk, -d.linkW, d.linkW, 0.065, tone(C.trim, 0.2)));
  return { extrudes, lathes, hardpoints: { pin: [0, 0, 0], link: [0, Lk[1], Lk[2]], 'link.r': [d.linkW, Lk[1], Lk[2]], 'link.l': [-d.linkW, Lk[1], Lk[2]], edge: E }, outline: P.map(([y, z]) => [0, y, z]) };
}

export { tube };
