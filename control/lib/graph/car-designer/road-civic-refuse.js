/**
 * THE CITY'S REFUSE FLEET in the form render: the garbage truck's other models, each read by its silhouette, at their
 * classes' true numbers (roads/vehicles.js), in the hull kit's language (mil-hull.js, airside-kit.js, civic-kit.js),
 * drawn, worn and painted as the rest of the city's are (road-civic.js; the rear loader is road-civic-works.js). Classes,
 * not replicas.
 *
 *   frontLoader  the front-loading refuse truck: a cab-over cab well ahead of its set-back front axle, on three axles;
 *                its body ribbed, its hopper open in its roof behind the cab, its ejector's tailgate; the two arms from
 *                the body's front corners arched over the cab to the forks ahead of its bumper, their cross tube and
 *                rams. Lifting (`lifting`, tipping, emptying) swings the arms up and back over the cab, the forks with
 *                them (the reach: the forks' lowest point)
 *   sideLoader   the automated side loader: a low-entry cab-over cab on three axles; the hopper behind it, low, its
 *                mouth open on the right, the body stepping up tall behind it; the arm on the right under the hopper, a
 *                boom that reaches out to the kerb and a gripper that climbs its track, a wheelie bin in its hands when
 *                working, tipped over the hopper at the top. Lifting (`lifting`, collecting, emptying) runs it out and
 *                up (the reach: the gripper's foot)
 *   rollOff      the roll-off truck: a bonneted cab on three axles; the hook arm along its frame and the hook tower
 *                behind the cab; the open-topped container on its rails, ribbed, its rollers at its tail, its hook bar
 *                at its front. Tipping (`tipping`, dumping, unloading) swings the arm and the container about the rear
 *                pivot (the reach: the container's front bottom edge)
 *   skipLoader   the skip loader: a cab-over cab on two axles, its bed; the two portal arms pivoted at its tail, their
 *                cross beam and the chains from it to the skip's lugs; the skip on its bed, tapered, its lugs; the
 *                stabiliser legs at the tail. Unloading (`unloading`, dropping, down) swings the arms back over the
 *                tail and sets the skip down behind it (the reach: the skip's bottom), the legs down
 *
 *   refuseAxles(cls, kind)            → the axles' stations (+y forward, the body centred)
 *   frontArmAt, gripperAt, rollAt, skipAt (reach) → each one's angle or place solved for a reach
 *   REFUSE_BODIES, REFUSE_KITS        the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face, place } from './mil-hull.js';
import { CC, own, reachOf, chassis, hinge, stripes, band, conventionalCab, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, cabOver, C } from './civic-kit.js';

/** Where each axle stands (+y forward), the front first: a tandem 1.36 m apart about its wheelbase's end. */
export function refuseAxles(cls, kind) {
  const v = VEHICLES[cls], tandem = (yf) => { const yt = yf - v.wheelbase; return [yf, yt + 0.68, yt - 0.68]; };
  if (kind === 'frontLoader') return tandem(v.L / 2 - 2.3);
  if (kind === 'sideLoader') return tandem(v.L / 2 - 1.35);
  if (kind === 'rollOff') return tandem(v.L / 2 - 1.1);
  if (kind === 'skipLoader') { const yf = v.L / 2 - 1.3; return [yf, yf - v.wheelbase]; }
  throw new Error(`car-designer: '${cls}' is not one of the city's refuse fleet`);
}

// (a solver: the angle in [lo, hi] at which f, monotone over it, meets a target)
function solve(f, target, lo, hi) {
  const up = f(hi) > f(lo);
  for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if ((f(m) < target) === up) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// (the yz-plane turn of a point about a pivot: positive lifts its +y side)
const turn = ([y, z], [py, pz], a) => [py + (y - py) * Math.cos(a) - (z - pz) * Math.sin(a), pz + (y - py) * Math.sin(a) + (z - pz) * Math.cos(a)];
const anchorsOf = (s, { flap, mark, h = 0.26 }) => {
  const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
  return [{ id: `flap.${L}`, kind: 'flap', at: flap, out: neg(Y), up: Z }, { id: `mark.${L}`, kind: 'mark', role: 'number', at: mark, out: sd, up: Z, h }];
};

// ── the front loader ────────────────────────────────────────────────────────────
// its arms in their own closed frame: the pivot on the body's front corner, the elbow over the cab, the forks' pin ahead
// of the bumper, the forks' tips at the nose (each [y, z] from the class's nose, yN)
const FRONT = { pivot: [-3.75, 3.25], elbow: [-2.3, 3.84], pin: [-0.75, 1.55], forks: 0.75, fork: [0.08, 0.06] };
const forkLow = (yN, a) => {
  const pv = [yN + FRONT.pivot[0], FRONT.pivot[1]], p0 = turn([yN + FRONT.pin[0], FRONT.pin[1]], pv, a), p1 = turn([yN + FRONT.pin[0] + FRONT.forks, FRONT.pin[1]], pv, a);
  return Math.min(p0[1], p1[1]) - FRONT.fork[1] / 2;
};
/** The arms' angle (radians, up and back over the cab) that sets the forks' lowest point at `reach`. */
export function frontArmAt(cls, reach) {
  const yN = VEHICLES[cls].L / 2;
  if (reach <= forkLow(yN, 0) + 1e-9) return 0;
  return solve((a) => forkLow(yN, a), reach, 0, 1.75);
}
function frontLoader(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = refuseAxles(cls, 'frontLoader'), [yf] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), yB = yN - 0.95;
  chassis(out, { axles, yT, yN: yB, r, hw, zf: 0.94 });
  // the cab well ahead of its axle, its guards
  // (the cab narrower than the arms' span, so they pass outside it)
  const z0 = 2 * r + 0.14, z1 = 2.95, yfc = yB - 0.12, ybc = yB - 2.3, hwc = hw - 0.2;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN: yB, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the body: its section, its ribs, its band; the hopper open in its roof behind the cab; the ejector's tailgate
  const hb = hw - 0.13, yB0 = ybc - 0.15, yB1 = yT + 0.05, zb0 = 1.08, zt = 3.45;
  P({ axis: 'y', profile: [[-hb, zb0], [hb, zb0], [hb, zt - 0.2], [hb - 0.2, zt], [-hb + 0.2, zt], [-hb, zt - 0.2]], from: yB1 + 0.1, to: yB0, r: 0.05, seg: 2, look: paint('body') });
  out.push(face([[-hb + 0.25, yB0 - 0.2, zt + 0.004], [hb - 0.25, yB0 - 0.2, zt + 0.004], [hb - 0.25, yB0 - 1.4, zt + 0.004], [-hb + 0.25, yB0 - 1.4, zt + 0.004]], M('hopper', 'seal', '#121314'), Z));
  for (const s of [-1, 1]) {
    out.push(...tube([[s * (hb - 0.22), yB0 - 0.18, zt + 0.05], [s * (hb - 0.22), yB0 - 1.42, zt + 0.05]], 0.03, { sides: 6, look: dark('hopper.lip') }));
    for (let y = yB0 - 1.7; y > yB1 + 0.4; y -= 0.95) P({ axis: 'x', profile: rect(y - 0.035, y + 0.035, zb0 + 0.1, zt - 0.25), from: s * hb, to: s * (hb + 0.028), r: 0.008, seg: 1, look: paint('body.rib') });
    out.push(...band([s * (hb + 0.001), s > 0 ? yB1 + 0.15 : yB0 - 0.05, 1.5], s > 0 ? Y : neg(Y), Z, yB0 - yB1 - 0.2, 0.24, [s, 0, 0], own('body.band', CC.green, 'milPaint')));
    out.push(...lamp([s * (hb - 0.12), yB1 + 0.04, 1.35], neg(Y), 0.14, 0.2, 'tail', 'taillamp'));
  }
  P({ axis: 'x', profile: rect(yB1, yB1 + 0.1, zb0 + 0.04, zt - 0.05), from: -hb + 0.02, to: hb - 0.02, r: 0.03, seg: 2, look: paint('tailgate') });
  out.push(...stripes({ o: [-hb + 0.1, yB1 - 0.002, zb0 + 0.12], u: X, v: Z, w: 2 * hb - 0.2, h: 0.55, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], mirror: true }));
  // the arms: each a bent box from the body's front corner over the cab to the forks' pin, the forks, the cross tube, a
  // ram each side from the body to the arm; swung up by the reach
  const arm = [], pv = [yN + FRONT.pivot[0], FRONT.pivot[1]], el = [yN + FRONT.elbow[0], FRONT.elbow[1]], pin = [yN + FRONT.pin[0], FRONT.pin[1]];
  const seg = (a, b, x0, x1, t, look) => { const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), n = [(-d[1] / l) * t / 2, (d[0] / l) * t / 2]; return plate({ axis: 'x', profile: [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], from: x0, to: x1, r: 0.01, seg: 1, look }); };
  for (const s of [-1, 1]) {
    const [x0, x1] = xs(s, hw - 0.12, hw - 0.01);
    arm.push(...seg(pv, el, x0, x1, 0.2, paint('arm')), ...seg(el, pin, x0, x1, 0.18, paint('arm')));
    arm.push(...plate({ axis: 'x', profile: rect(pin[0] - 0.02, pin[0] + FRONT.forks, pin[1] - FRONT.fork[1] / 2, pin[1] + FRONT.fork[1] / 2), from: s * 0.5, to: s * 0.62, r: 0.008, seg: 1, look: dark('fork') }));
  }
  arm.push(...tube([[-(hw - 0.06), pin[0], pin[1]], [hw - 0.06, pin[0], pin[1]]], 0.06, { sides: 10, look: dark('arm.cross') }));
  const angle = frontArmAt(cls, reachOf('frontLoader', { words, pose }));
  out.push(...hinge(arm.filter(Boolean), { pivot: pv, angle }));
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.065), foot = [pv[0] - 0.9, 1.7], eye = turn([pv[0] + 0.55, pv[1] + 0.22], pv, angle), m = [(foot[0] + eye[0]) / 2, (foot[1] + eye[1]) / 2];
    out.push(...tube([[x, ...foot], [x, ...m]], 0.07, { sides: 10, look: dark('arm.ram') }), ...tube([[x, ...m], [x, ...eye]], 0.045, { sides: 8, look: M('arm.rod', 'alloy', CC.chrome) }));
    out.push(...tube([[x, pv[0], pv[1]], [s * (hw - 0.14), pv[0], pv[1]]], 0.09, { sides: 10, look: M('arm.pin', 'steel', C.steel) }));
  }
  anchors.push(...[-1, 1].flatMap((s) => anchorsOf(s, { flap: [s * v.track / 2, axles[2] - r - 0.12, 0.8], mark: [s * (hb + 0.03), (yB0 + yB1) / 2, 2.6] })));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.94, tub: { x: hw, y: [yT, ybc], z: [0.6, 1.1] } } };
}

// ── the automated side loader ───────────────────────────────────────────────────
// the gripper's track: out at the kerb low, in over the hopper high; the bin it carries tipped by its height
const SIDE = { low: 0.72, high: 3.1, out: 1.05 };
/** Where the gripper stands for a reach: its foot's height, how far out past the body it runs, how far the bin is tipped. */
export function gripperAt(cls, reach) {
  const v = VEHICLES[cls], z = Math.max(SIDE.low, Math.min(SIDE.high + 0.5, reach)), t = (z - SIDE.low) / (SIDE.high - SIDE.low);
  if (reach <= SIDE.low + 1e-9) return { z: SIDE.low, x: v.W / 2 - 0.2, tip: 0, carrying: false };
  // (out to the kerb first, then in as it climbs; the bin tipped through its last third)
  const outBy = t < 0.25 ? SIDE.out : SIDE.out * Math.max(0, 1 - (t - 0.25) / 0.6);
  return { z, x: v.W / 2 - 0.2 + outBy, tip: Math.max(0, Math.min(1, (t - 0.6) / 0.4)) * (2.2), carrying: true };
}
function wheelieBin(out, at, tip) {
  // (a wheelie bin in its own frame: its foot at the origin, its back to −x; turned over toward −x by `tip` about y)
  const b = [], w = 0.58, d = 0.72, h = 1.05;
  b.push(...plate({ axis: 'z', profile: [[-d / 2, -w / 2], [d / 2 - 0.05, -w / 2], [d / 2, w / 2], [-d / 2, w / 2]].map(([x, y]) => [x, y]), from: 0.06, to: h, r: 0.03, seg: 1, look: own('bin', CC.green) }));
  b.push(...plate({ axis: 'z', profile: rect(-d / 2 - 0.02, d / 2 + 0.03, -w / 2 - 0.02, w / 2 + 0.02), from: h, to: h + 0.04, r: 0.015, seg: 1, look: own('bin.lid', '#25643a') }));
  for (const s of [-1, 1]) b.push(...tube([[-d / 2 + 0.05, s * (w / 2 - 0.04), 0.1], [-d / 2 + 0.05, s * (w / 2 - 0.04) + s * 0.06, 0.1]], 0.1, { sides: 10, look: M('bin.wheel', 'rubber', C.rubber) }));
  const c = Math.cos(tip), sn = Math.sin(tip);
  out.push(...place(b.filter(Boolean), { origin: at, ex: [c, 0, sn], ey: [0, 1, 0], ez: [-sn, 0, c] }));
}
function sideLoader(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = refuseAxles(cls, 'sideLoader'), [yf] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN, r, hw, zf: 0.9, sideRails: false });
  // the low-entry cab
  const z0 = 1.0, z1 = 2.72, yfc = yN - 0.12, ybc = yN - 2.2, hwc = hw - 0.07;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the hopper behind the cab, low, its mouth open on the right; the body stepping up tall behind it
  const hb = hw - 0.03, yH0 = ybc - 0.12, yH1 = yH0 - 1.55, zb0 = 1.02, zh = 2.55, zt = v.H - 0.02;
  P({ axis: 'y', profile: [[-hb, zb0], [hb, zb0], [hb, zh - 0.35], [hb - 0.35, zh], [-hb, zh]], from: yH1, to: yH0, r: 0.04, seg: 2, look: paint('hopper') });
  out.push(face([[hb - 0.33, yH0 - 0.1, zh + 0.004], [hb - 0.33, yH1 + 0.1, zh + 0.004], [-hb + 0.2, yH1 + 0.1, zh + 0.004], [-hb + 0.2, yH0 - 0.1, zh + 0.004]], M('hopper.mouth', 'seal', '#121314'), Z));
  P({ axis: 'y', profile: [[-hb, zb0], [hb, zb0], [hb, zt - 0.2], [hb - 0.2, zt], [-hb + 0.2, zt], [-hb, zt - 0.2]], from: yT + 0.12, to: yH1, r: 0.05, seg: 2, look: paint('body') });
  P({ axis: 'x', profile: [[yH1 - 0.02, zh], [yH1 + 0.35, zh], [yH1 - 0.02, zt - 0.25]], from: -hb + 0.05, to: hb - 0.05, r: 0.02, seg: 1, look: paint('body.step') });
  for (const s of [-1, 1]) {
    for (let y = yH1 - 0.6; y > yT + 0.4; y -= 0.9) P({ axis: 'x', profile: rect(y - 0.035, y + 0.035, zb0 + 0.1, zt - 0.25), from: s * hb, to: s * (hw - 0.002), r: 0.008, seg: 1, look: paint('body.rib') });
    out.push(...band([s * (hb + 0.001), s > 0 ? yT + 0.2 : yH1 - 0.05, 1.45], s > 0 ? Y : neg(Y), Z, yH1 - yT - 0.25, 0.24, [s, 0, 0], own('body.band', CC.white, 'milPaint')));
    out.push(...lamp([s * (hb - 0.12), yT + 0.1, 1.35], neg(Y), 0.14, 0.2, 'tail', 'taillamp'));
  }
  P({ axis: 'x', profile: rect(yT + 0.02, yT + 0.12, zb0 + 0.05, zt - 0.1), from: -hb + 0.03, to: hb - 0.03, r: 0.03, seg: 2, look: paint('tailgate') });
  out.push(...stripes({ o: [-hb + 0.1, yT + 0.018, zb0 + 0.12], u: X, v: Z, w: 2 * hb - 0.2, h: 0.55, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], mirror: true }));
  // the arm under the hopper on the right: the boom's housing, the boom run out to the gripper's track, the track, the
  // gripper's paddles; a bin in its hands when working
  const G = gripperAt(cls, reachOf('sideLoader', { words, pose })), ym = (yH0 + yH1) / 2;
  P({ axis: 'x', profile: rect(ym - 0.35, ym + 0.35, 0.62, 0.95), from: 0.2, to: hw - 0.05, r: 0.02, seg: 1, look: dark('arm.housing') });
  P({ axis: 'x', profile: rect(ym - 0.22, ym + 0.22, 0.68, 0.88), from: hw - 0.05, to: G.x, r: 0.015, seg: 1, look: alu('arm.boom') });
  const xt = G.x, ztop = Math.max(G.z + 0.6, 1.4);
  for (const dy of [-0.18, 0.18]) out.push(...tube([[xt, ym + dy, 0.85], [xt, ym + dy, ztop]], 0.04, { sides: 8, look: dark('arm.track') }));
  for (const dy of [-0.32, 0.32]) P({ axis: 'z', profile: rect(xt - 0.02, xt + 0.2, ym + dy - 0.03, ym + dy + 0.03), from: G.z, to: G.z + 0.45, r: 0.01, seg: 1, look: M('gripper', 'carbon', C.black) });
  out.push(...tube([[xt, ym - 0.36, G.z + 0.2], [xt, ym + 0.36, G.z + 0.2]], 0.035, { sides: 8, look: dark('gripper.bar') }));
  if (G.carrying) wheelieBin(out, [xt + 0.36, ym, G.z - 0.08], G.tip);
  anchors.push(...[-1, 1].flatMap((s) => anchorsOf(s, { flap: [s * v.track / 2, axles[2] - r - 0.12, 0.8], mark: [s * hw, (yH1 + yT) / 2, 2.6] })));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.9, tub: { x: hw, y: [yT, ybc], z: [0.5, 1.0] } } };
}

const P0 = (out, o) => out.push(...plate(o));

// ── the roll-off truck ──────────────────────────────────────────────────────────
// the container and the arm turn together about the pivot at the frame's tail
const ROLL = { pivot: [0.35, 1.15], z0: 1.25, max: 0.85 };
const ROLL_NOSE = 0.27;
const rollLow = (cls, a) => { const v = VEHICLES[cls], yT = -v.L / 2, pv = [yT + ROLL.pivot[0], ROLL.pivot[1]]; return turn([ROLL_NOSE, ROLL.z0], pv, a)[1]; };
/** The container's angle (radians) whose front bottom edge stands at `reach`. */
export function rollAt(cls, reach) {
  if (reach <= ROLL.z0 + 1e-9) return 0;
  return solve((a) => rollLow(cls, a), reach, 0, ROLL.max);
}
function rollOff(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = refuseAxles(cls, 'rollOff'), [yf] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN: yf + 1.0, r, hw, zf: 1.02 });
  // the bonneted cab, its amber beacon behind
  const yG = yN - 0.15, yw = yG - 1.7, yb = yw - 1.9, z0 = 1.12, zB = 1.95, z1 = 2.98;
  const anchors = conventionalCab(out, { yb, yw, yG, yN, hw: 1.2, hb: 0.76, z0, zB, z1, yf, r });
  out.push(...tube([[0, yb + 0.35, z1], [0, yb + 0.35, z1 + 0.05]], 0.075, { sides: 12, look: M('beacon.base', 'carbon', C.black) }), ...tube([[0, yb + 0.35, z1 + 0.05], [0, yb + 0.35, z1 + 0.16]], 0.065, { sides: 12, look: M('beacon', 'marker', CC.amber) }));
  // the rails on the frame, the rear rollers
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.5, 0.62), 1.02, 1.14), from: yT + 0.2, to: yb - 0.2, r: 0.01, seg: 1, look: dark('rail') });
  out.push(...tube([[-0.9, yT + 0.25, 1.0], [0.9, yT + 0.25, 1.0]], 0.12, { sides: 12, look: M('roller', 'steel', C.steel) }));
  // the arm and the container in their own frame, turned together about the pivot by the reach
  const box = [], yC1 = yT + 0.1, yC0 = ROLL_NOSE + 0.35, ct = 2.95, cz = ROLL.z0, hc = hw - 0.03;
  // (the container: its floor's skids, its walls tapering to its nose's sloped foot, its top rail, its ribs, its hook
  // bar at the top front, its doors' hinges at the tail, its inside dark from above)
  P0(box, { axis: 'x', profile: [[yC1 + 0.05, cz], [yC0 - 0.35, cz], [yC0, cz + 0.4], [yC0, ct], [yC1 + 0.05, ct]], from: -hc, to: hc, r: 0.03, seg: 1, look: own('container', '#c25a1c', 'milPaint') });
  box.push(face([[-hc + 0.08, yC0 - 0.08, ct + 0.003], [hc - 0.08, yC0 - 0.08, ct + 0.003], [hc - 0.08, yC1 + 0.12, ct + 0.003], [-hc + 0.08, yC1 + 0.12, ct + 0.003]], M('container.inside', 'seal', '#2c2620'), Z));
  for (const s of [-1, 1]) {
    for (let y = yC0 - 0.5; y > yC1 + 0.3; y -= 0.75) P0(box, { axis: 'x', profile: rect(y - 0.04, y + 0.04, cz + 0.1, ct - 0.08), from: s * hc, to: s * (hw - 0.002), r: 0.008, seg: 1, look: own('container.rib', '#a94c17', 'milPaint') });
    box.push(...tube([[s * (hw - 0.03), yC1 + 0.1, ct - 0.03], [s * (hw - 0.03), yC0 - 0.05, ct - 0.03]], 0.03, { sides: 8, look: own('container.rail', '#a94c17', 'milPaint') }));
    for (const z of [cz + 0.4, ct - 0.4]) box.push(...tube([[s * (hc - 0.08), yC1 + 0.04, z], [s * (hc - 0.08), yC1 + 0.04, z + 0.2]], 0.035, { sides: 8, look: dark('container.hinge') }));
    P0(box, { axis: 'y', profile: rect(...xs(s, 0.55, 0.62), cz - 0.1, cz), from: yC1 + 0.1, to: yC0 - 0.3, r: 0.01, seg: 1, look: dark('container.skid') });
  }
  box.push(...tube([[-0.55, yC0 + 0.06, ct - 0.25], [0.55, yC0 + 0.06, ct - 0.25]], 0.04, { sides: 8, look: dark('container.hookbar') }));
  // (its nose's foot: the edge the reach is measured on)
  P0(box, { axis: 'x', profile: [[ROLL_NOSE, cz], [ROLL_NOSE + 0.05, cz], [ROLL_NOSE + 0.05, cz + 0.05], [ROLL_NOSE, cz + 0.05]], from: -hc + 0.02, to: hc - 0.02, look: dark('container.nose') });
  // (the hook arm: along the frame from the pivot to the tower, the tower up to the hook)
  const yTw = yC0 + 0.22;
  P0(box, { axis: 'z', profile: rect(-0.32, 0.32, yT + 0.3, yTw), from: 1.05, to: 1.2, r: 0.01, seg: 1, look: dark('hookarm') });
  P0(box, { axis: 'z', profile: rect(-0.25, 0.25, yTw - 0.12, yTw + 0.12), from: 1.2, to: ct - 0.2, r: 0.02, seg: 1, look: paint('hookarm.tower') });
  box.push(...tube([[0, yTw - 0.05, ct - 0.25], [0, yC0 + 0.1, ct - 0.25]], 0.05, { sides: 8, look: M('hook', 'steel', C.steel) }));
  const pv = [yT + ROLL.pivot[0], ROLL.pivot[1]], angle = rollAt(cls, reachOf('rollOff', { words, pose }));
  out.push(...hinge(box.filter(Boolean), { pivot: pv, angle }));
  // (the arm's rams from the frame to the arm, their rods long by the angle)
  for (const s of [-1, 1]) {
    const foot = [yb - 0.9, 0.85], eye = turn([yb - 2.1, 1.12], pv, angle), m = [(foot[0] + eye[0]) / 2, (foot[1] + eye[1]) / 2];
    out.push(...tube([[s * 0.36, ...foot], [s * 0.36, ...m]], 0.08, { sides: 10, look: dark('hookarm.ram') }), ...tube([[s * 0.36, ...m], [s * 0.36, ...eye]], 0.05, { sides: 8, look: M('hookarm.rod', 'alloy', CC.chrome) }));
  }
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.2), yT + 0.02, 0.62], neg(Y), 0.16, 0.12, 'tail', 'taillamp'));
  anchors.push(...[-1, 1].map((s) => anchorsOf(s, { flap: [s * v.track / 2, axles[2] - r - 0.12, 0.85], mark: [0, 0, 0] })[0]));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 1.02, tub: { x: hw, y: [yT, yb], z: [0.6, 1.1] } } };
}

// ── the skip loader ─────────────────────────────────────────────────────────────
// the portal arms: their pivot at the tail, their length, their angle carrying (from +y, up), the skip's size and the
// chains' drop from the cross beam to its lugs
const SKIP = { pivot: [0.55, 1.25], arm: 2.7, carry: (62 * Math.PI) / 180, back: (158 * Math.PI) / 180, h: 1.3, len: 3.0, top: 1.9, base: 1.45 };
const skipTip = (cls, a) => { const v = VEHICLES[cls], yT = -v.L / 2; return [yT + SKIP.pivot[0] + SKIP.arm * Math.cos(a), SKIP.pivot[1] + SKIP.arm * Math.sin(a)]; };
const chainOf = (cls) => skipTip(cls, SKIP.carry)[1] - (1.15 + SKIP.h);
/** The arms' angle and the skip's place for a reach (its bottom's height): carried on the bed, else swung back over the
 *  tail and hung from the beam, set on the ground when its chains reach it. */
export function skipAt(cls, reach) {
  if (reach >= 1.15 - 1e-9) { const t = skipTip(cls, SKIP.carry); return { angle: SKIP.carry, tip: t, bottom: 1.15, y: t[0] }; }
  const bottomAt = (a) => Math.max(0, skipTip(cls, a)[1] - chainOf(cls) - SKIP.h);
  const a = reach <= 1e-9 ? SKIP.back : solve(bottomAt, reach, Math.PI / 2 + 0.2, SKIP.back);
  const t = skipTip(cls, a);
  return { angle: a, tip: t, bottom: bottomAt(a), y: t[0] };
}
function skipLoader(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = refuseAxles(cls, 'skipLoader'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN, r, hw, zf: 0.95, sideRails: false });
  const z0 = 2 * r + 0.14, z1 = 2.82, yfc = yN - 0.12, ybc = yN - 2.0, hwc = hw - 0.07;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) {
    out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
    out.push(...guard(yr, r, r + 0.08, 0.15, Math.PI - 0.15, ...xs(s, 0.74, hw - 0.04), dark('guard.rear')));
  }
  // the bed and its headboard behind the cab
  P({ axis: 'z', profile: rect(-hw + 0.06, hw - 0.06, yT + 0.1, ybc - 0.15), from: 1.05, to: 1.15, r: 0.01, seg: 1, look: dark('bed') });
  P({ axis: 'y', profile: rect(-hw + 0.1, hw - 0.1, 1.15, 2.3), from: ybc - 0.3, to: ybc - 0.18, r: 0.02, seg: 1, look: paint('headboard') });
  // the arms, the cross beam, the chains and the skip, placed by the reach; the stabilisers down when it is lowered
  const S = skipAt(cls, reachOf('skipLoader', { words, pose })), pv = [yT + SKIP.pivot[0], SKIP.pivot[1]], down = S.bottom < 1.15 - 1e-6;
  for (const s of [-1, 1]) {
    const x0 = s * (hw - 0.15), x1 = s * (hw - 0.006), d = [S.tip[0] - pv[0], S.tip[1] - pv[1]], l = Math.hypot(...d), n = [(-d[1] / l) * 0.12, (d[0] / l) * 0.12];
    P({ axis: 'x', profile: [[pv[0] + n[0], pv[1] + n[1]], [S.tip[0] + n[0], S.tip[1] + n[1]], [S.tip[0] - n[0], S.tip[1] - n[1]], [pv[0] - n[0], pv[1] - n[1]]], from: Math.min(x0, x1), to: Math.max(x0, x1), r: 0.015, seg: 1, look: paint('arm') });
    out.push(...tube([[s * (hw - 0.2), pv[0], pv[1]], [s * (hw - 0.02), pv[0], pv[1]]], 0.09, { sides: 10, look: M('arm.pin', 'steel', C.steel) }));
    const foot = [pv[0] + 1.2, 1.0], eye = [pv[0] + d[0] * 0.5, pv[1] + d[1] * 0.5], m = [(foot[0] + eye[0]) / 2, (foot[1] + eye[1]) / 2];
    out.push(...tube([[s * (hw - 0.3), ...foot], [s * (hw - 0.3), ...m]], 0.075, { sides: 10, look: dark('arm.ram') }), ...tube([[s * (hw - 0.3), ...m], [s * (hw - 0.3), ...eye]], 0.045, { sides: 8, look: M('arm.rod', 'alloy', CC.chrome) }));
    const yl = yT + 0.3;
    out.push(...tube([[s * (hw - 0.25), yl, 0.95], [s * (hw - 0.25), yl, down ? 0.06 : 0.5]], 0.06, { sides: 10, look: dark('stabiliser') }));
    P({ axis: 'z', profile: rect(s * (hw - 0.25) - 0.15, s * (hw - 0.25) + 0.15, yl - 0.15, yl + 0.15), from: down ? 0 : 0.44, to: (down ? 0 : 0.44) + 0.05, r: 0.01, seg: 1, look: M('stabiliser.pad', 'steel', C.steel) });
  }
  out.push(...tube([[-(hw - 0.02), ...S.tip], [hw - 0.02, ...S.tip]], 0.08, { sides: 10, look: dark('arm.beam') }));
  const ys = S.y, zb = S.bottom, zt2 = zb + SKIP.h, hl = SKIP.len / 2;
  // (the skip: tapered from its base to its top, its lugs at its ends' middles, its inside dark from above)
  P({ axis: 'x', profile: [[ys - SKIP.base / 2 * 1.1, zb], [ys + SKIP.base / 2 * 1.1, zb], [ys + hl, zt2], [ys - hl, zt2]], from: -0.85, to: 0.85, r: 0.02, seg: 1, look: own('skip', '#e3a21a', 'milPaint') });
  out.push(face([[-0.78, ys - hl + 0.08, zt2 + 0.003], [0.78, ys - hl + 0.08, zt2 + 0.003], [0.78, ys + hl - 0.08, zt2 + 0.003], [-0.78, ys + hl - 0.08, zt2 + 0.003]], M('skip.inside', 'seal', '#2c2620'), Z));
  for (const s of [-1, 1]) {
    const lug = [s * 0.9, ys, zb + SKIP.h * 0.7];
    out.push(...tube([[s * 0.85, ys, lug[2]], lug], 0.05, { sides: 8, look: dark('skip.lug') }));
    out.push(...tube([lug, [s * (hw - 0.1), S.tip[0], S.tip[1]]], 0.018, { sides: 5, look: M('chain', 'steel', C.steel) }));
  }
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.2), yT + 0.02, 0.7], neg(Y), 0.16, 0.12, 'tail', 'taillamp'));
  anchors.push(...[-1, 1].map((s) => anchorsOf(s, { flap: [s * v.track / 2, yr - r - 0.1, 0.8], mark: [0, 0, 0] })[0]));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.95, tub: { x: hw, y: [yT, ybc], z: [0.6, 1.1] } } };
}

export const REFUSE_BODIES = Object.freeze({ frontLoader, sideLoader, rollOff, skipLoader });

const CAB = [
  ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.3 }], ['sill.R', 'step', { drop: 1.3 }],
  ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }],
];
/** Each refuse body's kit (mil-fittings.js cards on its anchors). */
export const REFUSE_KITS = Object.freeze({ frontLoader: Object.freeze([...CAB]), sideLoader: Object.freeze([...CAB]), rollOff: Object.freeze([...CAB]), skipLoader: Object.freeze([...CAB]) });
