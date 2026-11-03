/**
 * THE CITY'S WORKS in the form render: the trucks that keep its streets, at their classes' true numbers (roads/vehicles.js),
 * in the hull kit's language (mil-hull.js, airside-kit.js, civic-kit.js), drawn, worn and painted as the field's and the
 * airside's are (road-military.js). Classes, not replicas.
 *
 *   refuse    the rear-loading refuse truck: a cab-over cab on three axles; the compaction body, ribbed, its band and
 *             number; the tailgate hinged at the body's top rear, its hopper and loading sill, its packer rams, its bin
 *             lifter and its lamps and chevrons; the crew's riding steps and grab bars. Tipping (`tipping`, dumping,
 *             emptying: CIVIC_WORDS) swings the tailgate up about its hinge (the reach: its lower edge's height)
 *   plough    the plough truck and gritter: a bonneted cab on two axles, its amber light bar, its plough lamps raised
 *             on stalks over the blade; the blade ahead, a curved mouldboard angled to throw right, its cutting edge, its
 *             ribs, its markers, on its push frame and lift ram; the V-box spreader behind the cab, its stiffeners and
 *             grate, its chute and spinner. Ploughing (`plowing`, lowered, down) sets the blade on the road (the reach:
 *             its cutting edge's height)
 *   sweeper   the street sweeper: a cab-over cab on two axles; the hopper body and its rear door, its fan's grille;
 *             the pickup head under it between the axles and its duct; two gutter brooms ahead of it, each a core and
 *             its bristles splayed to the road, on their arms. Sweeping (`sweeping`, working) lowers the brooms and the
 *             head and swings the brooms out (the reach: the bristles' tips)
 *
 *   worksAxles(cls)                   → the axles' stations (+y forward, the body centred)
 *   WORKS_BODIES, WORKS_KITS          the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *   tailgateAt(reach)                 → the refuse body's tailgate angle (radians) for a lower edge at that height
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, bend, face, place } from './mil-hull.js';
import { CC, own, reachOf, chassis, hinge, stripes, band, lightBar, conventionalCab, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, cabOver, C } from './civic-kit.js';

/** Where each axle stands (+y forward), the front first: a refuse truck's tandem 1.36 m apart about its wheelbase's end. */
export function worksAxles(cls, kind) {
  const v = VEHICLES[cls];
  if (kind === 'refuse') { const yf = v.L / 2 - 1.45, yt = yf - v.wheelbase; return [yf, yt + 0.68, yt - 0.68]; }
  if (kind === 'plough') { const yf = v.L / 2 - 2.7; return [yf, yf - v.wheelbase]; }
  if (kind === 'sweeper') { const yf = v.L / 2 - 1.25; return [yf, yf - v.wheelbase]; }
  throw new Error(`car-designer: '${cls}' is not one of the city's works`);
}

// ── the refuse truck ────────────────────────────────────────────────────────────
// (its tailgate in its own closed frame: its side profile [y, z] from the hinge's plane back to the tail, hinged at the
// body's top rear)
const TAIL = (yH, yT) => [[yH, 3.55], [yH - 1.25, 3.3], [yT + 0.02, 2.2], [yT + 0.02, 1.05], [yT + 0.45, 0.85], [yH, 0.85]];
const HINGE = (yH) => [yH - 0.05, 3.42];
const lowest = (pts, [py, pz], a) => Math.min(...pts.map(([y, z]) => pz + (y - py) * Math.sin(a) + (z - pz) * Math.cos(a)));
/** The tailgate's angle (radians, negative: its tail swung up) whose lower edge stands at `reach`. */
export function tailgateAt(cls, reach) {
  const v = VEHICLES[cls], yT = -v.L / 2, yH = yT + 2.15, pts = TAIL(yH, yT), pv = HINGE(yH);
  let lo = -1.3, hi = 0;
  if (lowest(pts, pv, hi) >= reach) return 0;
  for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (lowest(pts, pv, m) >= reach) lo = m; else hi = m; }
  return lo;
}
function refuse(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = worksAxles(cls, 'refuse'), [yf] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN, r, hw, zf: 0.94 });
  // the cab over the front wheels, their guards
  const z0 = 2 * r + 0.14, z1 = 2.95, yfc = yN - 0.12, ybc = yN - 2.25, hwc = hw - 0.07;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the compaction body: its section rounded at the roof's edges, ribbed down its sides, its band, its subframe
  const hb = hw - 0.03, yB0 = ybc - 0.15, yH = yT + 2.15, zb0 = 1.08;
  P({ axis: 'y', profile: [[-hb, zb0], [hb, zb0], [hb, 3.25], [hb - 0.25, 3.6], [-hb + 0.25, 3.6], [-hb, 3.25]], from: yH, to: yB0, r: 0.05, seg: 2, look: paint('body') });
  for (const s of [-1, 1]) {
    P({ axis: 'y', profile: rect(...xs(s, 0.4, 0.6), 0.94, zb0), from: yH + 0.1, to: yB0 - 0.1, r: 0.01, seg: 1, look: dark('subframe') });
    for (let y = yB0 - 0.5; y > yH + 0.3; y -= 0.92) P({ axis: 'x', profile: rect(y - 0.035, y + 0.035, zb0 + 0.1, 3.18), from: s * hb, to: s * (hw - 0.002), r: 0.008, seg: 1, look: paint('body.rib') });
    out.push(...band([s * (hb + 0.001), s > 0 ? yH + 0.05 : yB0 - 0.05, 1.5], s > 0 ? Y : neg(Y), Z, yB0 - yH - 0.1, 0.26, [s, 0, 0], own('body.band', CC.green, 'milPaint')));
  }
  // the tailgate in its closed frame: its shell, the hopper's mouth and its sill, the packer's rams on its sides, the
  // bin lifter under the sill, its lamps and chevrons, its grab bars; swung up about its hinge by the reach
  const tg = [], T = TAIL(yH, yT), ht = hb - 0.08, Tp = (o) => tg.push(...plate(o));
  Tp({ axis: 'x', profile: T, from: -ht, to: ht, r: 0.05, seg: 2, look: paint('tailgate') });
  tg.push(face([[-ht + 0.22, yT + 0.016, 1.16], [ht - 0.22, yT + 0.016, 1.16], [ht - 0.22, yT + 0.016, 2.12], [-ht + 0.22, yT + 0.016, 2.12]], M('hopper', 'seal', '#121314'), neg(Y)));
  Tp({ axis: 'x', profile: [[yT + 0.02, 1.02], [yT + 0.5, 0.82], [yT + 0.5, 0.88], [yT + 0.06, 1.08]], from: -ht + 0.1, to: ht - 0.1, r: 0.01, seg: 1, look: alu('hopper.sill') });
  for (const s of [-1, 1]) {
    const x = s * (ht + 0.05);
    tg.push(...tube([[x, yH - 0.35, 3.15], [x, yH - 1.1, 2.4]], 0.06, { sides: 10, look: dark('packer.ram') }), ...tube([[x, yH - 1.1, 2.4], [x, yT + 0.5, 1.45]], 0.035, { sides: 8, look: M('packer.rod', 'alloy', CC.chrome) }));
    // (the bin lifter's arm from the sill down to its comb, its lamp, the chevrons beside the hopper, a grab bar)
    tg.push(...tube([[s * 0.55, yT + 0.35, 0.86], [s * 0.55, yT + 0.08, 0.55]], 0.04, { sides: 8, look: dark('lifter') }));
    tg.push(...lamp([s * (ht - 0.11), yT + 0.02, 1.32], neg(Y), 0.14, 0.2, 'tail', 'taillamp'));
    tg.push(...lamp([s * (ht - 0.11), yT + 0.02, 2.02], neg(Y), 0.12, 0.1, 'marker', 'beacon.rear'));
    tg.push(...stripes({ o: [s > 0 ? ht - 0.2 : -ht + 0.02, yT + 0.02, 1.45], u: X, v: Z, w: 0.18, h: 0.45, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], pitch: 0.12 }));
    tg.push(...tube([[s * (ht - 0.03), yT + 0.1, 1.3], [s * (ht - 0.03), yT + 0.1, 2.05]], 0.018, { sides: 6, look: alu('grab.rear') }));
  }
  tg.push(...plate({ axis: 'x', profile: rect(yT + 0.03, yT + 0.12, 0.5, 0.6), from: -0.62, to: 0.62, r: 0.01, seg: 1, look: dark('lifter.comb') }));
  // (the body's open end behind the tailgate: dark, seen when it is tipped)
  out.push(face([[-hb + 0.1, yH - 0.004, zb0 + 0.1], [hb - 0.1, yH - 0.004, zb0 + 0.1], [hb - 0.1, yH - 0.004, 3.45], [-hb + 0.1, yH - 0.004, 3.45]], M('body.mouth', 'seal', '#121314'), neg(Y)));
  const angle = tailgateAt(cls, reachOf('refuse', { words, pose }));
  out.push(...hinge(tg, { pivot: HINGE(yH), angle }));
  // the crew's riding steps at the rear corners and the grab bars over them; the cab's amber light bar behind its beacon
  for (const s of [-1, 1]) {
    P({ axis: 'z', profile: rect(...xs(s, hw - 0.42, hw - 0.04), yH - 0.75, yH - 0.35), from: 0.44, to: 0.48, r: 0.008, seg: 1, look: alu('riding.step') });
    for (const y of [yH - 0.7, yH - 0.4]) out.push(...tube([[s * 0.56, y, 0.7], [s * (hw - 0.3), y, 0.47]], 0.022, { sides: 6, look: dark('riding.step.arm') }));
    out.push(...tube([[s * (hw - 0.05), yH - 0.12, 1.1], [s * (hw - 0.05), yH - 0.12, 2.3]], 0.02, { sides: 6, look: alu('grab.step') }));
    out.push(...lamp([s * (hw - 0.024), (yB0 + yH) / 2, 1.2], [s, 0, 0], 0.08, 0.05, 'marker', 'side.marker'));
  }
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, axles[2] - r - 0.12, 0.8], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hb + 0.004), (yB0 + yH) / 2, 2.55], out: sd, up: Z, h: 0.3 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.94, tub: { x: hw, y: [yT, ybc], z: [0.6, 1.1] } } };
}

// ── the plough truck and gritter ────────────────────────────────────────────────
// the blade in its own frame: x along it (its left end −x), y forward (its face concave ahead), z up from its foot
const BLADE = { half: 1.65, R: 0.6, yc: 0.3, zc: 0.6, a0: -80, a1: 85, angle: (25 * Math.PI) / 180 };
const bladePoint = (deg) => { const t = (deg * Math.PI) / 180; return [BLADE.yc - BLADE.R * Math.cos(t), BLADE.zc + BLADE.R * Math.sin(t)]; };
function plough(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], r = v.wheelRadius, axles = worksAxles(cls, 'plough'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), hw = 1.24, zf = 1.06;
  chassis(out, { axles, yT, yN: yf + 1.25, r, hw, zf });
  // the cab behind its bonnet; its amber light bar; its plough lamps up on stalks to see over the blade
  const yG = yf + 0.95, yw = yG - 1.65, yb = yw - 2.05, z0 = zf + 0.1, zB = 1.95, z1 = 3.08;
  const anchors = conventionalCab(out, { yb, yw, yG, yN: yG + 0.15, hw, hb: 0.74, z0, zB, z1, yf, r });
  out.push(...lightBar([0, yb + 0.45, z1], { width: 1.3, colours: [CC.amber, CC.amber], depth: 0.26 }));
  for (const s of [-1, 1]) {
    const x = s * 1.0, y = yG - 0.25;
    out.push(...tube([[x, y, zB - 0.05], [x, y, 2.3]], 0.025, { sides: 8, look: dark('ploughlamp.stalk') }));
    out.push(...lamp([x, y + 0.06, 2.38], Y, 0.22, 0.14, 'lamp', 'ploughlamp'));
  }
  // the spreader behind the cab: its V-box, its stiffeners and grate, the chain under it, its chute and spinner
  const yS0 = yb - 0.15, yS1 = yT + 0.45, zs0 = zf + 0.08, zs1 = 2.72;
  P({ axis: 'y', profile: [[-0.55, zs0], [0.55, zs0], [1.2, zs1], [-1.2, zs1]], from: yS1, to: yS0, r: 0.02, seg: 1, look: paint('spreader') });
  for (const s of [-1, 1]) {
    for (let y = yS0 - 0.35; y > yS1 + 0.2; y -= 0.6) out.push(...tube([[s * 0.6, y, zs0 + 0.08], [s * 1.2, y, zs1 - 0.02]], 0.025, { sides: 6, look: paint('spreader.rib') }));
    out.push(...tube([[s * 1.2, yS1, zs1], [s * 1.2, yS0, zs1]], 0.035, { sides: 8, look: paint('spreader.lip') }));
    out.push(...lamp([s * 1.1, yS1 - 0.004, zs1 - 0.15], neg(Y), 0.12, 0.12, 'marker', 'beacon.rear'));
  }
  for (let y = yS0 - 0.4; y > yS1 + 0.2; y -= 0.45) out.push(...tube([[-1.15, y, zs1 + 0.01], [1.15, y, zs1 + 0.01]], 0.015, { sides: 6, look: dark('spreader.grate') }));
  P({ axis: 'z', profile: rect(-0.22, 0.22, yT + 0.2, yS1 + 0.1), from: 0.95, to: zs0 + 0.05, r: 0.01, seg: 1, look: paint('chute') });
  out.push(...tube([[0, yT + 0.4, 0.62], [0, yT + 0.4, 0.68]], 0.34, { sides: 16, look: dark('spinner') }));
  for (let k = 0; k < 4; k++) { const t = (k * Math.PI) / 2; out.push(...tube([[0, yT + 0.4, 0.69], [0.3 * Math.cos(t), yT + 0.4 + 0.3 * Math.sin(t), 0.69]], 0.015, { sides: 4, look: dark('spinner.fin') })); }
  out.push(...tube([[0, yT + 0.4, 0.68], [0, yT + 0.4, 0.95]], 0.08, { sides: 10, look: dark('spinner.motor') }));
  for (const s of [-1, 1]) out.push(...lamp([s * 0.95, yT + 0.16, 0.7], neg(Y), 0.16, 0.12, 'tail', 'taillamp'));
  // the blade: the mouldboard in strips round its curve, its cutting edge, its ribs and its markers, placed ahead and
  // angled; lowered to the road by the reach
  const zb = reachOf('plough', { words, pose }), c = Math.cos(BLADE.angle), sn = Math.sin(BLADE.angle);
  const ex = [c, -sn, 0], ey = [sn, c, 0], reachAhead = BLADE.half * sn + BLADE.yc + 0.06, origin = [0, yN - reachAhead, zb];
  const bl = [], n = 10, t = 0.018;
  for (let k = 0; k < n; k++) {
    const a = bladePoint(BLADE.a0 + ((BLADE.a1 - BLADE.a0) * k) / n), b = bladePoint(BLADE.a0 + ((BLADE.a1 - BLADE.a0) * (k + 1)) / n);
    const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), nn = [d[1] / l * t, -d[0] / l * t];
    bl.push(...plate({ axis: 'x', profile: [a, b, [b[0] - nn[0], b[1] - nn[1]], [a[0] - nn[0], a[1] - nn[1]]], from: -BLADE.half, to: BLADE.half, look: paint('blade') }));
  }
  const foot = bladePoint(BLADE.a0);
  bl.push(...plate({ axis: 'x', profile: [[foot[0] + 0.01, 0], [foot[0] - 0.03, 0], [foot[0] - 0.04, 0.13], [foot[0], 0.13]], from: -BLADE.half, to: BLADE.half, look: M('blade.edge', 'steel', C.steel) }));
  // (its ribs behind it: a strip a segment of its curve, a hand deep behind its back)
  for (let k = 0; k < 5; k++) {
    const x = -BLADE.half + 0.2 + (k * (2 * BLADE.half - 0.4)) / 4;
    for (let j = 1; j < n - 1; j++) {
      const a = bladePoint(BLADE.a0 + ((BLADE.a1 - BLADE.a0) * j) / n), b = bladePoint(BLADE.a0 + ((BLADE.a1 - BLADE.a0) * (j + 1)) / n);
      bl.push(...plate({ axis: 'x', profile: [[a[0] - t, a[1]], [b[0] - t, b[1]], [b[0] - 0.11, b[1]], [a[0] - 0.11, a[1]]], from: x - 0.02, to: x + 0.02, look: dark('blade.rib') }));
    }
  }
  for (const s of [-1, 1]) {
    const top = bladePoint(BLADE.a1);
    bl.push(...tube([[s * (BLADE.half - 0.05), top[0] - 0.1, top[1] - 0.05], [s * (BLADE.half - 0.05), top[0] - 0.1, top[1] + 0.75]], 0.012, { sides: 6, look: M('blade.marker', 'plate', CC.orange) }));
  }
  // (set so its leading end's foremost point is the class's nose)
  const placed0 = place(bl, { origin, ex, ey, ez: Z }), ahead = yN - Math.max(...placed0.flatMap((f) => f.corners.map((p) => p[1])));
  origin[1] += ahead;
  out.push(...placed0.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y + ahead, z]) })));
  // (its push frame on the truck's bumper: the mount, the A-frame out to the blade's back, the lift ram over it)
  const yM = yG + 0.15, back = (x, z) => [origin[0] + ex[0] * x + ey[0] * (BLADE.yc - BLADE.R - 0.1), origin[1] + ex[1] * x + ey[1] * (BLADE.yc - BLADE.R - 0.1), zb + z];
  P({ axis: 'y', profile: rect(-0.62, 0.62, 0.42, 0.98), from: yM, to: yM + 0.14, r: 0.01, seg: 1, look: dark('plough.mount') });
  for (const s of [-1, 1]) out.push(...tube([[s * 0.5, yM + 0.14, 0.55], back(s * 0.45, 0.45)], 0.05, { sides: 8, look: dark('plough.frame') }));
  out.push(...tube([[0, yM + 0.14, 0.95], back(0, 0.72)], 0.045, { sides: 8, look: dark('plough.ram') }));
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yr - r - 0.12, 0.8], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (0.875 + 0.004), (yS0 + yS1) / 2, (zs0 + zs1) / 2], out: [s * 0.923, 0, -0.385], up: [s * 0.385, 0, 0.923], h: 0.25 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: zf, tub: { x: hw, y: [yT, yb], z: [0.6, 1.2] } } };
}

// ── the street sweeper ──────────────────────────────────────────────────────────
function sweeper(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = worksAxles(cls, 'sweeper'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN, r, hw, zf: 0.9 });
  const z0 = 2 * r + 0.14, z1 = 2.7, yfc = yN - 0.12, ybc = yN - 1.95, hwc = hw - 0.07;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the hopper body and its rear door, its band, its fan's grille on the right, its water filler
  const hb = hw - 0.02, yB0 = ybc - 0.15, yB1 = yT + 0.12, zb0 = 1.0;
  P({ axis: 'y', profile: [[-hb, zb0], [hb, zb0], [hb, 2.8], [hb - 0.15, 3.0], [-hb + 0.15, 3.0], [-hb, 2.8]], from: yB1, to: yB0, r: 0.05, seg: 2, look: paint('body') });
  P({ axis: 'x', profile: rect(yT + 0.02, yB1, zb0 + 0.05, 2.85), from: -hb + 0.05, to: hb - 0.05, r: 0.03, seg: 2, look: paint('hopper.door') });
  for (const s of [-1, 1]) {
    out.push(...band([s * (hb + 0.001), s > 0 ? yB1 + 0.05 : yB0 - 0.05, 1.45], s > 0 ? Y : neg(Y), Z, yB0 - yB1 - 0.1, 0.22, [s, 0, 0], own('body.band', CC.orange, 'milPaint')));
    out.push(...lamp([s * (hb - 0.15), yT + 0.02, 1.35], neg(Y), 0.14, 0.18, 'tail', 'taillamp'));
    out.push(...lamp([s * (hb - 0.15), yT + 0.02, 2.65], neg(Y), 0.12, 0.12, 'marker', 'beacon.rear'));
  }
  out.push(...stripes({ o: [-hb + 0.1, yT + 0.02, 1.55], u: X, v: Z, w: 2 * hb - 0.2, h: 0.5, n: neg(Y), colours: [CC.reflRed, CC.yellow], mirror: true }));
  out.push(...tube([[hb + 0.002, yB0 - 0.9, 2.1], [hb + 0.012, yB0 - 0.9, 2.1]], 0.34, { sides: 16, look: M('fan.grille', 'carbon', C.black) }));
  // the pickup head between the axles and its duct up into the hopper; the gutter brooms ahead of it on their arms,
  // lowered and swung out to sweep
  const zr = reachOf('sweeper', { words, pose }), working = zr < 0.08, yP0 = yr + r + 0.3, yP1 = yP0 + 1.25;
  P({ axis: 'z', profile: rect(-0.95, 0.95, yP0, yP1), from: zr + 0.04, to: zr + 0.3, r: 0.03, seg: 1, look: dark('pickup') });
  for (const s of [-1, 1]) P({ axis: 'z', profile: rect(...xs(s, 0.85, 0.98), yP0 + 0.1, yP1 - 0.1), from: zr + 0.01, to: zr + 0.06, r: 0.01, seg: 1, look: M('pickup.skid', 'steel', C.steel) });
  out.push(...tube([[0.55, (yP0 + yP1) / 2, zr + 0.3], [0.55, (yP0 + yP1) / 2, zb0]], 0.13, { sides: 12, look: M('duct', 'rubber', C.rubber) }));
  const yBr = yP1 + 0.55, R0 = 0.28, R1 = 0.46, n = 24;
  for (const s of [-1, 1]) {
    const xc = s * (hw - 0.48 + (working ? 0.28 : 0)), zc = zr + 0.13;
    out.push(...tube([[xc, yBr, zc], [xc, yBr, zc + 0.07]], R0, { sides: 16, look: dark('broom.core') }));
    for (let k = 0; k < n; k++) {
      const t = (2 * Math.PI * k) / n;
      out.push(...tube([[xc + R0 * Math.cos(t), yBr + R0 * Math.sin(t), zc + 0.01], [xc + R1 * Math.cos(t), yBr + R1 * Math.sin(t), zr + 0.005]], 0.012, { sides: 4, look: M('broom.bristle', 'rubber', '#2b2a27') }));
    }
    out.push(...tube([[xc, yBr, zc + 0.07], [xc, yBr, zc + 0.24]], 0.07, { sides: 10, look: dark('broom.motor') }));
    out.push(...tube(bend([[s * 0.5, yBr + 0.55, 0.78], [s * 0.6, yBr + 0.2, 0.62], [xc, yBr, zc + 0.24]], 0.08, 2), 0.035, { sides: 8, look: dark('broom.arm') }));
  }
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yr - r - 0.12, 0.78], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hb + 0.004), (yB0 + yB1) / 2 - 0.3, 2.35], out: sd, up: Z, h: 0.26 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.9, tub: { x: hw, y: [yT, ybc], z: [0.5, 1.0] } } };
}

export const WORKS_BODIES = Object.freeze({ refuse, plough, sweeper });

const CAB = [
  ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.3 }], ['sill.R', 'step', { drop: 1.3 }],
  ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }],
];
/** Each works body's kit (mil-fittings.js cards on its anchors). */
export const WORKS_KITS = Object.freeze({ refuse: Object.freeze([...CAB]), plough: Object.freeze([...CAB]), sweeper: Object.freeze([...CAB]) });
