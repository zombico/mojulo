/**
 * THE CITY'S AERIAL LIFTS in the form render: a fire service's ladder truck and a utility's bucket truck, at their
 * classes' true numbers (roads/vehicles.js), in the hull kit's language (mil-hull.js, airside-kit.js, civic-kit.js), drawn,
 * worn and painted as the rest of the city's are (road-civic.js). Classes, not replicas.
 *
 *   ladder   the rear-mount aerial ladder truck: a cab-over crew cab on three axles, lockers down its body; the turntable
 *            over its tandem, its trunnion plates, its operator's console, the elevation rams; the ladder, four truss
 *            sections nested (each its chords, rails, rungs, posts and diagonals), bedded forward over the cab on its
 *            rest; four outriggers. Raised (`raised`, extended, up), it lifts and extends to a tip height (the reach),
 *            slewed by `pose.slew` (degrees, + to the right), its outriggers down on their pads
 *   bucket   the utility bucket truck: a bonneted cab on two axles, a service body of compartments either side of its
 *            bed; the pedestal and turret at its tail, the lower boom and the insulated upper boom folded over it, the
 *            bucket at its tip held level; two outriggers. Raised (`raised`, working, up), the lower boom rises, the
 *            upper unfolds and then extends, the bucket's floor at the reach
 *
 *   liftAxles(cls, kind)              → the axles' stations (+y forward, the body centred)
 *   ladderPose(reach), bucketPose(reach) → the ladder's elevation and length, the booms' angles and extension, solved
 *                                       for a reach (metres from the ground)
 *   LIFT_BODIES, LIFT_KITS            the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face, place } from './mil-hull.js';
import { CC, own, chassis, crewCab, conventionalCab, lightBar, lockers, stripes, outrigger, reachOf, CIVIC_REACH, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C } from './civic-kit.js';

/** Where each axle stands (+y forward), the front first: a ladder truck's tandem 1.4 m apart about its wheelbase's end. */
export function liftAxles(cls, kind) {
  const v = VEHICLES[cls];
  if (kind === 'ladder') { const yf = v.L / 2 - 1.65, yt = yf - v.wheelbase; return [yf, yt + 0.7, yt - 0.7]; }
  if (kind === 'bucket') { const yf = v.L / 2 - 1.1; return [yf, yf - v.wheelbase]; }
  throw new Error(`car-designer: '${cls}' is not one of the city's aerial lifts`);
}

// ── the ladder truck ────────────────────────────────────────────────────────────
// the ladder: its pivot's height, its four sections (each its length, its width and its depth), how far each runs out of
// the one under it, the heel behind the pivot, the elevations it works through
const LADDER = { zp: 2.98, heel: 0.6, length: 7.4, sections: [[1.0, 0.7], [0.88, 0.62], [0.76, 0.54], [0.64, 0.46]], run: 6.6, lift: (70 * Math.PI) / 180, top: (75 * Math.PI) / 180 };
// (the fly section's far end along the ladder from its pivot: each section 5 cm further out and 12 cm shorter than the one
// under it)
const tipOf = (ext) => LADDER.length - LADDER.heel - 0.07 * (LADDER.sections.length - 1) + ext * (LADDER.sections.length - 1);
/** The ladder's elevation (radians) and its extension (metres each section runs out) for a tip at `reach`. */
export function ladderPose(reach) {
  const { zp, run, lift, top } = LADDER, l0 = tipOf(0), h = reach - zp;
  if (h <= 0) return { elevation: 0, extend: 0 };
  if (h <= l0 * Math.sin(lift)) return { elevation: Math.asin(h / l0), extend: 0 };
  const lmax = tipOf(run);
  if (h <= lmax * Math.sin(lift)) return { elevation: lift, extend: (h / Math.sin(lift) - l0) / (LADDER.sections.length - 1) };
  return { elevation: Math.min(top, Math.asin(Math.min(1, h / lmax))), extend: run };
}
function ladderTruss(out, k, { u0, w, h, len, look }) {
  const t = (a, b, rr) => out.push(...tube([a, b], rr, { sides: 6, look }));
  const hw = w / 2, u1 = u0 + len;
  for (const s of [-1, 1]) { t([s * hw, u0, 0], [s * hw, u1, 0], 0.035 - k * 0.004); t([s * hw, u0, h], [s * hw, u1, h], 0.025 - k * 0.003); }
  for (let u = u0 + 0.15; u < u1 - 0.05; u += 0.36) t([-hw, u, 0], [hw, u, 0], 0.016);
  const posts = 6;
  for (let i = 0; i <= posts; i++) {
    const u = u0 + 0.1 + ((len - 0.2) * i) / posts;
    for (const s of [-1, 1]) {
      t([s * hw, u, 0], [s * hw, u, h], 0.014);
      if (i < posts) t([s * hw, u, 0], [s * hw, u + (len - 0.2) / posts, h], 0.012);
    }
  }
}
function ladder(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = liftAxles(cls, 'ladder'), [yf] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN, r, hw, zf: 0.98, sideRails: false });
  const z0 = 2 * r + 0.14, z1 = 2.72, yfc = yN - 0.12, ybc = yN - 3.25, hwc = hw - 0.05;
  const anchors = crewCab(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1, yR: ybc + 1.4, raise: 0.05, roof: own('cab.roof', CC.white, 'milPaint') });
  out.push(...lightBar([0, yfc - 0.45, z1], { width: 1.8, colours: [CC.red, CC.lens] }));
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.38, hwc - 0.02), paint('guard')));
  // the body: its lockers each side, over the tandem's guards; the torque box under the turntable
  const hb = hw - 0.02, yB0 = ybc - 0.1, yB1 = yT + 0.25, zb0 = 1.05, zb1 = 2.25, yTT = (axles[1] + axles[2]) / 2, yw0 = axles[1] + r + 0.12, yw1 = axles[2] - r - 0.12;
  P({ axis: 'y', profile: rect(-hb, hb, zb0, zb1), from: yB1, to: yB0, r: 0.04, seg: 2, look: paint('body') });
  for (const s of [-1, 1]) {
    lockers(out, { s, y0: yw0, y1: yB0 - 0.05, z0: zb0 + 0.1, z1: zb1 - 0.1, x: hb, n: 3 });
    lockers(out, { s, y0: yw1, y1: yw0, z0: 2 * r + 0.25, z1: zb1 - 0.1, x: hb, n: 1 });
    lockers(out, { s, y0: yB1 + 0.08, y1: yw1, z0: zb0 + 0.1, z1: zb1 - 0.1, x: hb, n: 1 });
    out.push(...lamp([s * (hb - 0.14), yB1 - 0.004, zb0 + 0.45], neg(Y), 0.16, 0.2, 'tail', 'taillamp'));
  }
  out.push(...stripes({ o: [-hb + 0.1, yB1 - 0.004, zb0 + 0.6], u: X, v: Z, w: 2 * hb - 0.2, h: 0.5, n: neg(Y), colours: [CC.reflRed, CC.yellow], mirror: true }));
  // the outriggers: behind the cab and at the tail, down when raised
  const R = CIVIC_REACH.ladder, zr = reachOf('ladder', { words, pose }), up = zr > R.stowed + 0.05;
  for (const y of [yB0 - 0.35, yB1 + 0.5]) for (const s of [-1, 1]) outrigger(out, { s, y, hw, deployed: up, z: 0.95 });
  // the turntable over the tandem, its trunnion plates, its console; the ladder's rest over the cab
  out.push(...tube([[0, yTT, zb1], [0, yTT, zb1 + 0.16]], 1.0, { sides: 24, look: dark('turntable') }));
  const { elevation: th, extend } = ladderPose(zr), slew = ((Number(pose?.slew) || 0) * Math.PI) / 180;
  const f = [Math.sin(slew), Math.cos(slew), 0], c = [Math.cos(slew), -Math.sin(slew), 0], pivot = [0, yTT, LADDER.zp];
  const tt = [];
  for (const s of [-1, 1]) tt.push(...plate({ axis: 'x', profile: [[-0.9, zb1 + 0.16], [0.5, zb1 + 0.16], [0.25, LADDER.zp + 0.25], [-0.3, LADDER.zp + 0.25]], from: s * 0.58, to: s * 0.66, r: 0.01, seg: 1, look: paint('trunnion') }));
  tt.push(...tube([[-0.7, 0, LADDER.zp], [0.7, 0, LADDER.zp]], 0.07, { sides: 10, look: M('trunnion.pin', 'steel', C.steel) }));
  tt.push(...plate({ axis: 'z', profile: rect(0.62, 1.0, -0.55, -0.15), from: zb1 + 0.16, to: zb1 + 1.2, r: 0.03, seg: 1, look: paint('console') }));
  tt.push(...plate({ axis: 'y', profile: rect(0.66, 0.96, zb1 + 0.9, zb1 + 1.15), from: -0.15, to: -0.13, look: M('console.panel', 'carbon', C.black) }));
  // (the tt parts in a frame about the turntable's centre, turned by the slew)
  const ttPlaced = place(tt.filter(Boolean), { origin: [0, yTT, 0], ex: c, ey: f, ez: Z });
  out.push(...ttPlaced);
  P({ axis: 'y', profile: rect(-0.4, 0.4, z1 + 0.05, LADDER.zp - 0.02), from: ybc + 0.35, to: ybc + 0.5, r: 0.02, seg: 1, look: dark('ladder.rest') });
  // the ladder in its own frame (x across, y along from the pivot, z up from its chords), elevated and slewed
  const L = [], a = [f[0] * Math.cos(th), f[1] * Math.cos(th), Math.sin(th)], b = [-f[0] * Math.sin(th), -f[1] * Math.sin(th), Math.cos(th)];
  LADDER.sections.forEach(([w, h], k) => ladderTruss(L, k, { u0: -LADDER.heel + 0.05 * k + extend * k, w, h: h - 0.04 * k, len: LADDER.length - 0.12 * k, look: k === LADDER.sections.length - 1 ? alu('ladder.fly') : alu(`ladder.section${k + 1}`) }));
  const uTip = tipOf(extend), wT = LADDER.sections.at(-1)[0];
  L.push(...tube([[-wT / 2, uTip, 0], [wT / 2, uTip, 0]], 0.03, { sides: 8, look: M('ladder.tip', 'plate', CC.yellow) }));
  // (the elevation rams: from the turntable's front up to the base section's underside)
  const ramFoot = [0, 1.5, zb1 + 0.25 - LADDER.zp], ramEye = 2.4;
  for (const s of [-1, 1]) {
    const eye = [s * 0.32, ramEye, -0.06], footL = [s * 0.32, ramFoot[1] * Math.cos(-th) + ramFoot[2] * Math.sin(th), -ramFoot[1] * Math.sin(th) + ramFoot[2] * Math.cos(th)];
    const m = [0, 1, 2].map((i) => (eye[i] + footL[i]) / 2);
    L.push(...tube([footL, m], 0.08, { sides: 10, look: dark('ladder.ram') }), ...tube([m, eye], 0.05, { sides: 10, look: M('ladder.ram.rod', 'alloy', CC.chrome) }));
  }
  out.push(...place(L, { origin: pivot, ex: c, ey: a, ez: b }));
  anchors.push(...[-1, 1].flatMap((s) => {
    const Ls = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${Ls}`, kind: 'flap', at: [s * v.track / 2, axles[2] - r - 0.12, 0.8], out: neg(Y), up: Z },
      { id: `mark.${Ls}`, kind: 'mark', role: 'number', at: [s * (hwc + 0.004), ybc + 0.75, z0 + 0.2], out: sd, up: Z, h: 0.2 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.98, tub: { x: hw, y: [yT, ybc], z: [0.6, 1.1] } } };
}

// ── the bucket truck ────────────────────────────────────────────────────────────
// the booms: the pivot over the pedestal, the lower boom's length, the upper's and how far it telescopes, the bucket's
// hang below the upper boom's tip, the lower boom's working angle
const BOOM = { zp: 2.3, a: 4.0, b: 4.3, ext: 3.0, hang: 0.98, lift: (75 * Math.PI) / 180, up: 0.32 };
const boomAt = (t) => {
  const s = Math.max(0, Math.min(3, t));
  const alpha = BOOM.lift * Math.min(1, s), phi = Math.PI - (Math.PI / 2) * Math.max(0, Math.min(1, s - 1)), ext = BOOM.ext * Math.max(0, s - 2);
  // (the knee where the lower boom ends; the upper boom from a pin a hand above it, its tip, the bucket's floor)
  const knee = [BOOM.a * Math.cos(alpha), BOOM.zp + BOOM.a * Math.sin(alpha)], pin = [knee[0] - BOOM.up * Math.sin(alpha), knee[1] + BOOM.up * Math.cos(alpha)];
  const L = BOOM.b + ext, tip = [pin[0] + L * Math.cos(phi), pin[1] + L * Math.sin(phi)];
  return { alpha, phi, ext, knee, pin, tip, floor: tip[1] - BOOM.hang };
};
/** The booms solved for a bucket floor at `reach`: the lower boom raised first, the upper unfolded, then telescoped. */
export function bucketPose(reach) {
  if (reach <= boomAt(0).floor) return boomAt(0);
  if (reach >= boomAt(3).floor) return boomAt(3);
  let lo = 0, hi = 3;
  for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (boomAt(m).floor < reach) lo = m; else hi = m; }
  return boomAt((lo + hi) / 2);
}
function bucket(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], r = v.wheelRadius, axles = liftAxles(cls, 'bucket'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), hw = v.W / 2;
  chassis(out, { axles, yT, yN: yf + 1.0, r, hw, zf: 1.0, sideRails: false });
  const yG = yf + 0.95, yw = yG - 1.6, yb = yw - 1.75, z0 = 1.1, zB = 1.85, z1 = 2.9;
  const anchors = conventionalCab(out, { yb, yw, yG, yN, hw: 1.16, hb: 0.74, z0, zB, z1, yf, r });
  out.push(...lightBar([0, yb + 0.4, z1], { width: 1.2, colours: [CC.amber, CC.amber], depth: 0.24 }));
  // the service body: compartments either side of its bed, their doors' seams and handles, its rear lamps
  const yS0 = yb - 0.1, yS1 = yT + 0.1, zs0 = 1.02, zs1 = 1.95, xi = 0.72, seam = M('seam', 'seal', '#151614');
  P({ axis: 'z', profile: rect(-xi, xi, yS1, yS0), from: zs0, to: zs0 + 0.12, r: 0.01, seg: 1, look: dark('bed') });
  for (const s of [-1, 1]) {
    P({ axis: 'y', profile: rect(...xs(s, xi, hw - 0.01), zs0, zs1), from: yS1, to: yS0, r: 0.03, seg: 2, look: paint('compartment') });
    const n = [s, 0, 0], x = s * (hw - 0.006);
    const cuts = [yS0 - 0.05, (yS0 + yr + r) / 2, yr + r + 0.08, yr - r - 0.08, yS1 + 0.05];
    for (const y of cuts) out.push(face([[x, y - 0.006, zs0 + 0.06], [x, y + 0.006, zs0 + 0.06], [x, y + 0.006, zs1 - 0.06], [x, y - 0.006, zs1 - 0.06]], seam, n));
    for (let i = 0; i + 1 < cuts.length; i++) if (i !== 2) out.push(...tube([[x, (cuts[i] + cuts[i + 1]) / 2 - 0.08, zs1 - 0.25], [x, (cuts[i] + cuts[i + 1]) / 2 + 0.08, zs1 - 0.25]], 0.01, { sides: 6, look: M('door.handle', 'alloy', CC.chrome) }));
    out.push(...lamp([s * (hw - 0.14), yS1 - 0.004, zs0 + 0.25], neg(Y), 0.14, 0.2, 'tail', 'taillamp'));
    out.push(...guard(yr, r, r + 0.08, 0.15, Math.PI - 0.15, ...xs(s, 0.7, xi), dark('guard.rear')));
  }
  out.push(...stripes({ o: [-hw + 0.08, yS1 - 0.004, zs0 + 0.4], u: X, v: Z, w: 2 * hw - 0.16, h: 0.4, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], mirror: true }));
  // the outriggers behind the rear axle, down when raised; the pedestal and the turret at the tail
  const R = CIVIC_REACH.bucket, zr = reachOf('bucket', { words, pose }), raised = zr > R.stowed + 0.05;
  const yP = yT + 1.4;
  for (const s of [-1, 1]) outrigger(out, { s, y: yr - r - 0.35, hw, deployed: raised, z: 0.95 });
  P({ axis: 'z', profile: rect(-0.38, 0.38, yP - 0.38, yP + 0.38), from: zs0 + 0.12, to: BOOM.zp - 0.3, r: 0.03, seg: 1, look: dark('pedestal') });
  out.push(...tube([[0, yP, BOOM.zp - 0.3], [0, yP, BOOM.zp - 0.18]], 0.48, { sides: 20, look: dark('turret') }));
  for (const s of [-1, 1]) P({ axis: 'x', profile: [[yP - 0.35, BOOM.zp - 0.18], [yP + 0.35, BOOM.zp - 0.18], [yP + 0.15, BOOM.zp + 0.12], [yP - 0.15, BOOM.zp + 0.12]], from: s * 0.2, to: s * 0.27, r: 0.01, seg: 1, look: paint('turret.plate') });
  // the booms solved for the reach (in the truck's side plane: y along, z up), the bucket held level at the upper's tip
  const B = bucketPose(zr), Py = yP, at = ([u, z], x = 0) => [x, Py + u, z];
  const boxAlong = (a, b2, w, d, look) => {
    const dy = b2[0] - a[0], dz = b2[1] - a[1], l = Math.hypot(dy, dz), ey = [0, dy / l, dz / l], ez = [0, -dz / l, dy / l];
    return place(plate({ axis: 'y', profile: rect(-w / 2, w / 2, -d / 2, d / 2), from: 0, to: l, r: 0.02, seg: 1, look }), { origin: at(a), ex: X, ey, ez });
  };
  out.push(...boxAlong([0, BOOM.zp], B.knee, 0.3, 0.32, paint('boom.lower')));
  out.push(...tube([at([0, BOOM.zp], -0.3), at([0, BOOM.zp], 0.3)], 0.06, { sides: 10, look: M('boom.pin', 'steel', C.steel) }));
  out.push(...tube([at(B.knee, -0.22), at(B.knee, 0.22)], 0.07, { sides: 10, look: M('boom.pin', 'steel', C.steel) }));
  out.push(...boxAlong(B.knee, B.pin, 0.22, 0.2, dark('boom.knee')));
  const tipBase = [B.pin[0] + BOOM.b * Math.cos(B.phi) * 0.98, B.pin[1] + BOOM.b * Math.sin(B.phi) * 0.98];
  out.push(...boxAlong(B.pin, tipBase, 0.26, 0.26, own('boom.upper', CC.white, 'plate')));
  if (B.ext > 0.01) out.push(...boxAlong([B.pin[0] + BOOM.b * Math.cos(B.phi) * 0.9, B.pin[1] + BOOM.b * Math.sin(B.phi) * 0.9], B.tip, 0.2, 0.2, own('boom.fly', CC.yellow, 'plate')));
  // (the lower boom's ram from the turret to its underside)
  const ramEnd = [B.knee[0] * 0.45 + 0.12 * Math.sin(B.alpha), BOOM.zp + (B.knee[1] - BOOM.zp) * 0.45 - 0.12 * Math.cos(B.alpha)];
  out.push(...tube([at([0.32, BOOM.zp - 0.15]), at(ramEnd)], 0.06, { sides: 10, look: dark('boom.ram') }));
  // (the bucket: hung from the tip, level, its floor at the reach; its rim, its liner, its controls)
  const bw = 0.76, bl = 0.76, bh = 1.05, bc = at([B.tip[0] + (B.phi > Math.PI * 0.75 ? -0.5 : 0.5), B.floor]);
  P({ axis: 'z', profile: rect(-bw / 2, bw / 2, bc[1] - bl / 2, bc[1] + bl / 2), from: B.floor, to: B.floor + bh, r: 0.06, seg: 2, look: own('bucket', CC.yellow, 'plate') });
  P({ axis: 'z', profile: rect(-bw / 2 - 0.02, bw / 2 + 0.02, bc[1] - bl / 2 - 0.02, bc[1] + bl / 2 + 0.02), from: B.floor + bh - 0.04, to: B.floor + bh, r: 0.01, seg: 1, look: M('bucket.rim', 'carbon', C.black) });
  P({ axis: 'z', profile: rect(-bw / 2 + 0.05, bw / 2 - 0.05, bc[1] - bl / 2 + 0.05, bc[1] + bl / 2 - 0.05), from: B.floor + bh - 0.005, to: B.floor + bh + 0.002, look: M('bucket.liner', 'seal', '#2a2b2c') });
  out.push(...tube([at(B.tip), [0, bc[1] + (B.phi > Math.PI * 0.75 ? bl / 2 : -bl / 2), B.floor + bh * 0.8]], 0.04, { sides: 8, look: dark('bucket.hanger') }));
  P({ axis: 'z', profile: rect(bw / 2 - 0.02, bw / 2 + 0.06, bc[1] - 0.15, bc[1] + 0.15), from: B.floor + bh - 0.35, to: B.floor + bh, r: 0.01, seg: 1, look: M('bucket.controls', 'carbon', C.black) });
  // (the boom's rest over the bed, where the folded booms lie)
  P({ axis: 'y', profile: rect(-0.25, 0.25, zs0 + 0.12, BOOM.zp - 0.17), from: yb - 0.45, to: yb - 0.35, r: 0.02, seg: 1, look: dark('boom.rest') });
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yr - r - 0.1, 0.75], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hw - 0.002), (yS0 + yr) / 2, 1.62], out: sd, up: Z, h: 0.2 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 1.0, tub: { x: hw, y: [yT, yb], z: [0.6, 1.1] } } };
}

export const LIFT_BODIES = Object.freeze({ ladder, bucket });

const TRUCK = [
  ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.3 }], ['sill.R', 'step', { drop: 1.3 }],
  ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }],
];
/** Each lift's kit (mil-fittings.js cards on its anchors). */
export const LIFT_KITS = Object.freeze({ ladder: Object.freeze([...TRUCK]), bucket: Object.freeze([...TRUCK]) });
