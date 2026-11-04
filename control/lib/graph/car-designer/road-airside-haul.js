/**
 * THE AIRSIDE'S HAULERS in the form render: what tows, pushes and fuels on an apron, at their classes' true numbers
 * (roads/vehicles.js), in the hull kit's language (mil-hull.js, airside-kit.js), drawn, worn and painted as the rest of
 * the ground crew are (road-airside.js). Classes, not replicas.
 *
 *   baggageTug   the baggage tug: a low tow tractor, its bonnet over the front wheels, its ballast and bumpers striped;
 *                the driver's seat over the rear axle under a roof on four posts, a screen ahead; the hitch's jaw and pin
 *                at its tail
 *   baggageCart  a baggage cart: a bed on four small wheels, the front pair on a turntable its drawbar steers; corner
 *                posts and a canopy, canvas curtains down its sides, folded as they hang; reflectors at its corners
 *   pushbackTug  the towbarless pushback tug: a low U, its two beams either side of the cradle the nose wheel is driven
 *                into, the engine's deck and the sunk cab across its front; the cradle's plate, its clamps, its pusher and
 *                its ramp; `coupled` (pushbackWords) lifts the cradle and closes the clamps (the reach: the cradle's top)
 *   fuelTruck    the refueller: a cab-over cab on three axles, an elliptical tank on its saddles (dished heads, its
 *                walkway, manholes and vents, the rails folded down for the road, a ladder at its tail); the hose cabinet
 *                behind it, its reel and nozzle; lockers and pipework under the tank; placards
 *
 *   HAUL_CLASSES                      physics class → its body kind
 *   haulAxles(cls)                    → the axles' stations (+y forward, the body centred)
 *   pushbackWords(words)              → { coupled }
 *   HAUL_BODIES, HAUL_KITS            the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, bend, face, place } from './mil-hull.js';
import { AIRSIDE_REACH, C, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, hazard, beacon, lamp, cabOver } from './airside-kit.js';

export const HAUL_CLASSES = Object.freeze({ baggageTug: 'baggageTug', baggageCart: 'baggageCart', pushbackTug: 'pushbackTug', fuelTruck: 'fuelTruck' });

/** Where each axle stands (+y forward), the front first: a refueller's tandem two, 1.3 m apart about its wheelbase's end. */
export function haulAxles(cls) {
  const v = VEHICLES[cls], kind = HAUL_CLASSES[cls];
  if (kind === 'baggageTug') { const yf = v.L / 2 - 0.675; return [yf, yf - v.wheelbase]; }
  if (kind === 'baggageCart') { const yf = v.L / 2 - 1.4; return [yf, yf - v.wheelbase]; }
  if (kind === 'pushbackTug') { const yf = v.L / 2 - 1.4; return [yf, yf - v.wheelbase]; }
  if (kind === 'fuelTruck') { const yf = v.L / 2 - 1.35, yt = yf - v.wheelbase; return [yf, yt + 0.65, yt - 0.65]; }
  throw new Error(`car-designer: '${cls}' is not an airside hauler (${Object.keys(HAUL_CLASSES).join(', ')})`);
}

/** A pushback tug's words: `coupled` (coupled, hooked, clamped, towing, pushing) lifts its cradle and closes its clamps. */
export function pushbackWords(words = []) {
  const W = words.map((w) => String(w).toLowerCase());
  return { coupled: W.some((w) => ['coupled', 'hooked', 'clamped', 'towing', 'pushing', 'raised', 'docked'].includes(w)) };
}

const TYRE = 0.3;   // (a field tyre's width at these radii: military.js tyreWidth)

// ── the baggage tug ─────────────────────────────────────────────────────────────
function baggageTug(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, [yf, yr] = haulAxles(cls), yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const xw = v.track / 2 - TYRE / 2 - 0.02;   // (inside the wheels)
  // the frame low between the wheels, its floor, the side steps between the wheels, their guards
  P({ axis: 'y', profile: rect(-xw, xw, 0.14, 0.42), from: yT + 0.2, to: yN - 0.1, r: 0.02, seg: 1, look: dark('frame') });
  P({ axis: 'z', profile: rect(-xw, xw, yT + 0.3, 0.25), from: 0.42, to: 0.47, look: alu('floor') });
  for (const s of [-1, 1]) {
    P({ axis: 'z', profile: rect(...xs(s, xw, hw - 0.02), yr + r + 0.06, yf - r - 0.06), from: 0.3, to: 0.36, r: 0.01, seg: 1, look: alu('step') });
    for (const y of [yf, yr]) out.push(...guard(y, r, r + 0.05, 0.15, Math.PI - 0.15, ...xs(s, xw, hw - 0.01), paint('guard')));
  }
  // the bonnet over the front wheels, its louvres and lamps; the ballast under it; the bumper, striped
  P({ axis: 'x', profile: [[0.25, 0.64], [yN - 0.06, 0.64], [yN - 0.06, 0.88], [yN - 0.18, 0.98], [0.25, 0.98]], from: -hw + 0.03, to: hw - 0.03, r: 0.04, seg: 2, look: paint('bonnet') });
  P({ axis: 'y', profile: rect(-xw + 0.02, xw - 0.02, 0.18, 0.66), from: yf - r, to: yN - 0.08, r: 0.02, seg: 1, look: dark('ballast') });
  for (let i = 0; i < 5; i++) { const z = 0.7 + i * 0.035; P({ axis: 'y', profile: rect(-0.3, 0.3, z - 0.01, z + 0.01), from: yN - 0.064, to: yN - 0.056, look: M('grille', 'carbon', C.black) }); }
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.17), yN - 0.06, 0.8], Y, 0.16, 0.1, 'lamp', 'headlamp'));
  P({ axis: 'x', profile: rect(yN - 0.1, yN, 0.2, 0.42), from: -hw + 0.02, to: hw - 0.02, r: 0.015, seg: 1, look: dark('bumper') });
  out.push(...hazard({ o: [-hw + 0.04, yN, 0.21], u: X, v: Z, w: 2 * hw - 0.08, h: 0.2, n: Y, pitch: 0.1 }));
  // the driver's place: the dash on the bonnet's back, the column and wheel, the seat on its box over the rear axle
  P({ axis: 'y', profile: rect(-0.5, 0.5, 0.98, 1.1), from: 0.2, to: 0.3, r: 0.02, seg: 1, look: paint('dash') });
  out.push(...tube([[0, 0.24, 0.96], [0, 0.04, 1.16]], 0.025, { sides: 8, look: M('column', 'carbon', C.black) }));
  out.push(...tube(Array.from({ length: 17 }, (_, k) => { const a = (2 * Math.PI * k) / 16; return [0.17 * Math.cos(a), 0.04 - 0.17 * Math.sin(a) * 0.6, 1.16 + 0.17 * Math.sin(a) * 0.8]; }), 0.014, { sides: 6, caps: false, look: M('wheel.rim', 'rubber', C.rubber) }));
  P({ axis: 'z', profile: rect(-0.36, 0.36, yr - 0.22, yr + 0.38), from: 0.47, to: 0.76, r: 0.03, seg: 1, look: paint('seat.box') });
  P({ axis: 'z', profile: rect(-0.3, 0.3, yr - 0.15, yr + 0.32), from: 0.76, to: 0.86, r: 0.04, seg: 2, look: M('seat', 'canvas', C.seat) });
  P({ axis: 'y', profile: rect(-0.3, 0.3, 0.86, 1.32), from: yr - 0.22, to: yr - 0.13, r: 0.04, seg: 2, look: M('seat', 'canvas', C.seat) });
  // the roof on its four posts, the screen between the front two
  const zr = v.H - 0.21, yp0 = 0.27, yp1 = yT + 0.3, xp = hw - 0.06;
  for (const s of [-1, 1]) {
    out.push(...tube([[s * xp, yp0, 0.98], [s * xp, yp0, zr]], 0.03, { sides: 8, look: dark('post') }));
    out.push(...tube([[s * xp, yp1, 0.47], [s * xp, yp1, zr]], 0.03, { sides: 8, look: dark('post') }));
  }
  P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, yp1 - 0.1, yp0 + 0.12), from: zr, to: zr + 0.05, r: 0.02, seg: 1, look: paint('roof') });
  out.push(face([[-xp + 0.04, yp0, 1.0], [xp - 0.04, yp0, 1.0], [xp - 0.04, yp0, zr - 0.06], [-xp + 0.04, yp0, zr - 0.06]], M('glass', 'glass', C.glass), Y));
  out.push(...tube([[-xp, yp0 + 0.01, zr - 0.04], [xp, yp0 + 0.01, zr - 0.04]], 0.02, { sides: 6, look: dark('screen.frame') }));
  out.push(...beacon([0, (yp0 + yp1) / 2, zr + 0.05]));
  // its tail: the ballast plate, striped, its lamps; the hitch's jaw and its pin
  P({ axis: 'x', profile: rect(yT + 0.14, yT + 0.26, 0.14, 0.62), from: -hw + 0.03, to: hw - 0.03, r: 0.015, seg: 1, look: dark('tail') });
  out.push(...hazard({ o: [hw - 0.05, yT + 0.14, 0.15], u: neg(X), v: Z, w: 2 * hw - 0.1, h: 0.2, n: neg(Y), pitch: 0.1 }));
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.14), yT + 0.14, 0.52], neg(Y), 0.12, 0.08, 'tail', 'taillamp'));
  for (const z of [0.38, 0.5]) P({ axis: 'z', profile: rect(-0.09, 0.09, yT, yT + 0.15), from: z, to: z + 0.03, r: 0.01, seg: 1, look: M('hitch', 'steel', C.steel) });
  out.push(...tube([[0, yT + 0.06, 0.34], [0, yT + 0.06, 0.6]], 0.02, { sides: 8, look: M('hitch.pin', 'steel', C.steel) }));
  const anchors = [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * xp, yp0, zr - 0.35], out: sd, up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hw - 0.03 + 0.004), 0.85, 0.81], out: sd, up: Z, h: 0.1 },
    ];
  });
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.47, tub: { x: hw, y: [yT, yN], z: [0.14, 0.47] } } };
}

// ── the baggage cart ────────────────────────────────────────────────────────────
function baggageCart(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, [yf, yr] = haulAxles(cls), yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const yb1 = yf + 0.5, zd = 2 * r + 0.08, zc = v.H - 0.06;
  // the bed on its frame, the turntable under its front, the axles, the drawbar to its eye
  P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, zd, zd + 0.07), from: yT + 0.02, to: yb1, r: 0.012, seg: 1, look: paint('bed') });
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.32, 0.4), zd - 0.12, zd), from: yT + 0.1, to: yb1 - 0.05, look: dark('frame') });
  for (const y of [yf, yr]) out.push(...tube([[-v.track / 2 + 0.1, y, r], [v.track / 2 - 0.1, y, r]], 0.035, { sides: 8, look: M('axle', 'steel', C.steel) }));
  out.push(...tube(Array.from({ length: 25 }, (_, k) => { const a = (2 * Math.PI * k) / 24; return [0.36 * Math.cos(a), yf + 0.36 * Math.sin(a), zd - 0.06]; }), 0.025, { sides: 6, caps: false, look: dark('turntable') }));
  out.push(...tube(bend([[-0.3, yf + 0.1, r + 0.02], [0, yN - 0.12, 0.42], [0.3, yf + 0.1, r + 0.02]], 0.1, 3), 0.03, { sides: 8, look: dark('drawbar') }));
  out.push(...tube(Array.from({ length: 17 }, (_, k) => { const a = (2 * Math.PI * k) / 16; return [0.07 * Math.cos(a), yN - 0.07 + 0.07 * Math.sin(a), 0.42]; }), 0.016, { sides: 6, caps: false, look: M('drawbar.eye', 'steel', C.steel) }));
  // its posts and canopy; the end bars; the curtains down its sides, folded as they hang
  const xp = hw - 0.04, ys = [yT + 0.06, yb1 - 0.04];
  for (const s of [-1, 1]) for (const y of ys) P({ axis: 'z', profile: rect(s * xp - 0.03, s * xp + 0.03, y - 0.03, y + 0.03), from: zd + 0.07, to: zc, r: 0.008, seg: 1, look: paint('post') });
  P({ axis: 'z', profile: rect(-hw, hw, yT, yb1 + 0.02), from: zc, to: v.H, r: 0.025, seg: 2, look: paint('canopy') });
  for (const y of ys) for (const z of [zd + 0.5, zd + 1.0]) out.push(...tube([[-xp, y, z], [xp, y, z]], 0.018, { sides: 6, look: paint('end.bar') }));
  const curtain = M('curtain', 'canvas', '#2f3a52'), folds = 12;
  for (const s of [-1, 1]) for (let k = 0; k < folds; k++) {
    const y0 = ys[0] + 0.04 + ((ys[1] - ys[0] - 0.08) * k) / folds, y1 = ys[0] + 0.04 + ((ys[1] - ys[0] - 0.08) * (k + 1)) / folds, ym = (y0 + y1) / 2;
    const x0 = s * (xp + 0.01), xm = s * (xp - 0.02), za = zd + 0.18, zb = zc - 0.02;
    out.push(face([[x0, y0, za], [xm, ym, za], [xm, ym, zb], [x0, y0, zb]], curtain, [s, -0.3, 0]));
    out.push(face([[xm, ym, za], [x0, y1, za], [x0, y1, zb], [xm, ym, zb]], curtain, [s, 0.3, 0]));
  }
  for (const s of [-1, 1]) for (const [y, n, lens] of [[yT + 0.02, neg(Y), 'tail'], [yb1, Y, 'marker']]) out.push(...lamp([s * (hw - 0.1), y, zd + 0.035], n, 0.08, 0.05, lens, 'reflector'));
  const anchors = [-1, 1].map((s) => ({ id: `mark.${s < 0 ? 'L' : 'R'}`, kind: 'mark', role: 'number', at: [s * (hw - 0.02 + 0.004), (yT + yb1) / 2, zd + 0.035], out: s < 0 ? neg(X) : X, up: Z, h: 0.05 }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: zd, tub: { x: hw, y: [yT, yb1], z: [zd, zd + 0.07] } } };
}

// ── the towbarless pushback tug ─────────────────────────────────────────────────
function pushbackTug(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, [yf, yr] = haulAxles(cls), yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const zb0 = 0.32, zb1 = 1.15, xi = 0.82, yU = 0.95, gap = r + 0.12;
  const R = AIRSIDE_REACH.pushbackTug, want = Number.isFinite(pose?.reach) ? pose.reach : pushbackWords(words).coupled ? R.raised : R.stowed;
  const zCr = Math.min(R.range[1], Math.max(R.range[0], want)), shut = zCr > R.stowed + 0.08;
  // its two beams either side of the U, each its wheel's well and its guard; the front block across, its wells
  const block = (x0, x1, y0, y1, part) => { if (y1 - y0 > 0.02) P({ axis: 'y', profile: rect(x0, x1, zb0, zb1), from: y0, to: y1, r: 0.04, seg: 2, look: paint(part) }); };
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, xi, hw - 0.01);
    block(a, b, yT + 0.02, yr - gap, 'beam'); block(a, b, yr + gap, yU, 'beam');
    block(a, b, yU, yf - gap, 'body'); block(a, b, yf + gap, yN - 0.12, 'body');
    for (const y of [yf, yr]) {
      P({ axis: 'y', profile: rect(a, b, r + 0.08, zb1), from: y - gap, to: y + gap, r: 0.03, seg: 1, look: paint(y === yr ? 'beam' : 'body') });
      out.push(...guard(y, r, r + 0.03, 0.1, Math.PI - 0.1, ...xs(s, v.track / 2 - TYRE / 2 - 0.02, hw - 0.01), dark('well')));
    }
    out.push(...hazard({ o: [s > 0 ? hw - 0.02 : -xi, yT + 0.02, zb0 + 0.04], u: s > 0 ? neg(X) : neg(X), v: Z, w: hw - 0.02 - xi, h: zb1 - zb0 - 0.08, n: neg(Y), pitch: 0.14 }));
    out.push(...lamp([s * (hw - 0.2), yT + 0.02, zb1 - 0.12], neg(Y), 0.14, 0.08, 'tail', 'taillamp'));
    out.push(...lamp([s * (xi + 0.12), yT + 0.02, zb1 - 0.12], neg(Y), 0.12, 0.08, 'lamp', 'worklamp'));
  }
  P({ axis: 'y', profile: rect(-xi - 0.02, xi + 0.02, zb0, zb1), from: yU, to: yN - 0.12, r: 0.04, seg: 2, look: paint('body') });
  // the bumper across its face, striped; its lamps
  P({ axis: 'x', profile: rect(yN - 0.14, yN, 0.3, 0.62), from: -hw + 0.04, to: hw - 0.04, r: 0.02, seg: 1, look: dark('bumper') });
  out.push(...hazard({ o: [-hw + 0.06, yN, 0.31], u: X, v: Z, w: 2 * hw - 0.12, h: 0.3, n: Y, pitch: 0.15 }));
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.3), yN - 0.12, 0.9], Y, 0.22, 0.12, 'lamp', 'headlamp'));
  // the engine's deck on the right, louvred; the sunk cab on the left: its glass all round, its roof, the beacon
  for (let i = 0; i < 9; i++) { const y = 1.45 + i * 0.17; P({ axis: 'z', profile: rect(0.15, hw - 0.2, y - 0.04, y + 0.04), from: zb1 - 0.004, to: zb1 + 0.004, look: M('louvre', 'carbon', C.black) }); }
  const cx0 = -hw + 0.05, cx1 = -0.2, cy0 = 1.3, cy1 = yN - 0.2, zr = v.H - 0.21;
  P({ axis: 'x', profile: [[cy0, zb1], [cy1, zb1], [cy1 - 0.08, zr], [cy0, zr]], from: cx0, to: cx1, r: 0.04, seg: 2, look: paint('cab') });
  const g = M('glass', 'glass', C.glass), zg0 = zb1 + 0.1, zg1 = zr - 0.08, at = (y) => cy1 - 0.08 * ((y - zb1) / (zr - zb1));
  out.push(face([[cx0 + 0.06, at(zg0) + 0.004, zg0], [cx1 - 0.06, at(zg0) + 0.004, zg0], [cx1 - 0.06, at(zg1) + 0.004, zg1], [cx0 + 0.06, at(zg1) + 0.004, zg1]], g, [0, 1, 0.12]));
  for (const [x, n] of [[cx0 - 0.003, neg(X)], [cx1 + 0.003, X]]) out.push(face([[x, cy0 + 0.08, zg0], [x, cy1 - 0.16, zg0], [x, cy1 - 0.16, zg1], [x, cy0 + 0.08, zg1]], g, n));
  out.push(face([[cx0 + 0.06, cy0 - 0.003, zg0], [cx1 - 0.06, cy0 - 0.003, zg0], [cx1 - 0.06, cy0 - 0.003, zg1], [cx0 + 0.06, cy0 - 0.003, zg1]], g, neg(Y)));
  P({ axis: 'z', profile: rect(cx0 - 0.02, cx1 + 0.02, cy0 - 0.03, cy1 + 0.02), from: zr, to: zr + 0.05, r: 0.02, seg: 1, look: paint('roof') });
  out.push(...beacon([(cx0 + cx1) / 2, cy0 + 0.35, zr + 0.05]));
  // the cradle in the U: its plate, its ramp to the ground behind (up when it carries a wheel), its clamps either side,
  // its pusher ahead; lifted and closed when coupled
  const yc0 = yT + 0.7, yc1 = yU - 0.15, xc = xi - 0.1, cl = shut ? 0.38 : xc - 0.1;
  P({ axis: 'z', profile: rect(-xc, xc, yc0, yc1), from: zCr - 0.1, to: zCr, r: 0.015, seg: 1, look: dark('cradle') });
  const ramp = shut ? [[yc0, zCr], [yc0 - 0.55, zCr + 0.12]] : [[yc0, zCr], [yT + 0.08, 0.03]];
  P({ axis: 'x', profile: [[ramp[0][0], ramp[0][1]], [ramp[1][0], ramp[1][1]], [ramp[1][0], ramp[1][1] - 0.05], [ramp[0][0], ramp[0][1] - 0.06]], from: -xc + 0.05, to: xc - 0.05, look: dark('cradle.ramp') });
  for (const s of [-1, 1]) {
    P({ axis: 'x', profile: rect(yc1 - 1.0, yc1 - 0.15, zCr, zCr + 0.45), from: s * cl, to: s * (cl + 0.07), r: 0.012, seg: 1, look: dark('cradle.clamp') });
    out.push(...tube([[s * (xi - 0.01), yc1 - 0.6, zCr + 0.3], [s * (cl + 0.07), yc1 - 0.6, zCr + 0.3]], 0.04, { sides: 8, look: M('ram.rod', 'alloy', '#c9ccce') }));
  }
  P({ axis: 'y', profile: rect(-0.45, 0.45, zCr, zCr + 0.5), from: yc1 - 0.12, to: yc1, r: 0.02, seg: 1, look: dark('cradle.pusher') });
  P({ axis: 'y', profile: rect(-0.42, 0.42, zCr + 0.05, zCr + 0.45), from: yc1 - 0.16, to: yc1 - 0.12, look: M('cradle.pad', 'rubber', C.rubber) });
  const anchors = [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [{ id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hw - 0.01 + 0.004), (yr + gap + yU) / 2, (zb0 + zb1) / 2], out: sd, up: Z, h: 0.16 }];
  });
  anchors.push({ id: 'sill.L', kind: 'sill', at: [-hw + 0.1, yf + gap + 0.18, zb0 - 0.02], out: neg(X), up: Z });
  return { faces: out.filter(Boolean), anchors, zones: { floor: zb0, tub: { x: hw, y: [yT, yN], z: [zb0, zb1] } } };
}

// ── the refueller ───────────────────────────────────────────────────────────────
// an elliptical tank along y: half width a, half height b, its centre at height zc, its dished heads `head` deep
function ellipseTank(y0, y1, zc, a, b, head, look, n = 28) {
  const out = [], ring = (s) => Array.from({ length: n }, (_, k) => { const t = (2 * Math.PI * k) / n; return [a * s * Math.cos(t), zc + b * s * Math.sin(t), t]; });
  const nrm = (t, ny) => { const q = [Math.cos(t) / a, ny, Math.sin(t) / b], l = Math.hypot(...q); return q.map((c) => c / l); };
  const strip = (ya, sa, nya, yb, sb, nyb) => {
    const A = ring(sa), B = ring(sb);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, c = [[A[k][0], ya, A[k][1]], [A[k2][0], ya, A[k2][1]], [B[k2][0], yb, B[k2][1]], [B[k][0], yb, B[k][1]]];
      const ns = [nrm(A[k][2], nya), nrm(A[k2][2], nya), nrm(B[k2][2], nyb), nrm(B[k][2], nyb)];
      out.push(face(c, look, ns.reduce((s, q) => [s[0] + q[0], s[1] + q[1], s[2] + q[2]], [0, 0, 0]), ns));
    }
  };
  strip(y0, 1, 0, y1, 1, 0);
  // the heads: the knuckle and the dish, closed by a flat crown
  const steps = [[0, 1, 0], [0.35, 0.97, 0.6], [0.7, 0.85, 1.6], [1, 0.55, 3.5]];
  for (const [end, sg] of [[y1, 1], [y0, -1]]) {
    for (let i = 0; i + 1 < steps.length; i++) strip(end + sg * head * steps[i][0], steps[i][1], sg * steps[i][2] / (a + b), end + sg * head * steps[i + 1][0], steps[i + 1][1], sg * steps[i + 1][2] / (a + b));
    const R = ring(steps[steps.length - 1][1]).map(([x, z]) => [x, end + sg * head, z]);
    out.push(face(R, look, [0, sg, 0]));
  }
  return out.filter(Boolean);
}

function fuelTruck(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = haulAxles(cls), [yf] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  // the frame on its three axles
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.42, 0.52), 0.66, 0.92), from: yT + 0.15, to: yN - 0.3, r: 0.01, seg: 1, look: dark('frame') });
  for (const y of axles) out.push(...tube([[-0.86, y, r], [0.86, y, r]], 0.065, { sides: 10, look: M('axle', 'steel', C.steel) }));
  // the cab
  const z0 = 2 * r + 0.14, z1 = 2.9, yfc = yN - 0.12, ybc = yN - 2.3, hwc = hw - 0.07;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the tank on its saddles: elliptical, dished at both ends; its walkway, manholes and vents, the rails folded down,
  // the ladder at its tail
  const a = hw - 0.04, b = 0.84, zc = 1.24 + b, t0 = yT + 1.45, t1 = ybc - 0.42, head = 0.24;
  out.push(...ellipseTank(t0, t1, zc, a, b, head, paint('tank')));
  for (const y of [t0 + 0.35, (t0 + t1) / 2, t1 - 0.35]) P({ axis: 'y', profile: [[-0.9, 0.92], [0.9, 0.92], [0.7, 1.42], [-0.7, 1.42]], from: y - 0.08, to: y + 0.08, r: 0.01, seg: 1, look: dark('saddle') });
  const zt = zc + b;
  P({ axis: 'z', profile: rect(-0.3, 0.3, t0 + 0.2, t1 - 0.2), from: zt - 0.01, to: zt + 0.03, r: 0.008, seg: 1, look: alu('walkway') });
  for (const y of [t0 + 0.9, (t0 + t1) / 2, t1 - 0.9]) {
    out.push(...tube([[0, y, zt], [0, y, zt + 0.1]], 0.27, { sides: 16, look: alu('manhole') }));
    out.push(...tube([[0.16, y + 0.32, zt + 0.02], [0.16, y + 0.32, zt + 0.14]], 0.035, { sides: 8, look: alu('vent') }));
  }
  for (const s of [-1, 1]) {
    out.push(...tube([[s * 0.36, t0 + 0.3, zt + 0.06], [s * 0.36, t1 - 0.3, zt + 0.06]], 0.022, { sides: 6, look: alu('rail.folded') }));
    for (const y of [t0 + 0.3, (t0 + t1) / 2, t1 - 0.3]) out.push(...tube([[s * 0.36, y, zt + 0.06], [s * 0.36 - s * 0.0, y + 0.0, zt + 0.02]], 0.018, { sides: 6, look: alu('rail.folded') }));
  }
  const yl = t0 - head - 0.12;
  for (const x of [0.35, 0.75]) out.push(...tube([[x, yl, 1.0], [x, yl, zt - 0.05]], 0.02, { sides: 6, look: alu('ladder') }));
  for (let z = 1.15; z < zt - 0.1; z += 0.3) out.push(...tube([[0.35, yl, z], [0.75, yl, z]], 0.014, { sides: 6, look: alu('ladder') }));
  // the hose cabinet at its tail: its sides, its roof, its reel and the hose on it, the nozzle hung; its placards
  const yk0 = yT + 0.04, yk1 = t0 - head - 0.3, zk0 = 0.72, zk1 = 2.25;
  for (const s of [-1, 1]) P({ axis: 'x', profile: rect(yk0, yk1, zk0, zk1), from: s * (hw - 0.06), to: s * (hw - 0.01), r: 0.01, seg: 1, look: paint('cabinet') });
  P({ axis: 'z', profile: rect(-hw + 0.01, hw - 0.01, yk0, yk1), from: zk1, to: zk1 + 0.05, r: 0.015, seg: 1, look: paint('cabinet.roof') });
  P({ axis: 'z', profile: rect(-hw + 0.01, hw - 0.01, yk0, yk1), from: zk0 - 0.05, to: zk0, look: dark('cabinet.floor') });
  const yReel = (yk0 + yk1) / 2, zReel = 1.55;
  out.push(...tube([[-0.75, yReel, zReel], [0.75, yReel, zReel]], 0.18, { sides: 14, look: M('reel', 'steel', C.steel) }));
  for (const x of [-0.78, 0.78]) out.push(...tube([[x - 0.02, yReel, zReel], [x + 0.02, yReel, zReel]], 0.48, { sides: 20, look: paint('reel.flange') }));
  for (let k = 0; k < 6; k++) { const x = -0.6 + k * 0.24; out.push(...tube(Array.from({ length: 21 }, (_, i) => { const t = (2 * Math.PI * i) / 20; return [x, yReel + 0.34 * Math.cos(t), zReel + 0.34 * Math.sin(t)]; }), 0.05, { sides: 8, caps: false, look: M('hose', 'rubber', C.rubber) })); }
  out.push(...tube(bend([[0.66, yReel - 0.34, zReel], [0.66, yk0 + 0.06, zReel - 0.3], [0.66, yk0 + 0.06, 0.95]], 0.1, 3), 0.045, { sides: 8, look: M('hose', 'rubber', C.rubber) }));
  out.push(...tube([[0.66, yk0 + 0.06, 0.95], [0.66, yk0 + 0.06, 0.8]], 0.07, { sides: 10, look: M('nozzle', 'alloy', '#b9bcbf') }));
  P({ axis: 'y', profile: rect(-0.95, -0.35, zk1 - 0.6, zk1 - 0.15), from: yk0 + 0.1, to: yk0 + 0.12, look: M('meter', 'carbon', C.black) });
  for (const [o, n, u] of [[[-0.2, yk0, zk1 - 0.5], neg(Y), neg(X)], ...[-1, 1].map((s) => [[s * (a + 0.004), (t0 + t1) / 2 - 1.2, zc - 0.15], [s, 0, 0], s > 0 ? Y : neg(Y)])]) {
    const c = (du, dv) => [o[0] + u[0] * du, o[1] + u[1] * du, o[2] + dv];
    out.push(face([c(-0.2, -0.15), c(0.2, -0.15), c(0.2, 0.15), c(-0.2, 0.15)], M('placard', 'sign', '#d9781f'), n));
    out.push(face([c(-0.2, -0.012), c(0.2, -0.012), c(0.2, 0.012), c(-0.2, 0.012)].map((p) => p.map((q, i) => q + n[i] * 0.002)), M('placard.line', 'sign', C.black), n));
  }
  // under the tank: lockers between the axles, the pipe along the right; the under-run bar at its tail, striped; lamps
  for (const s of [-1, 1]) P({ axis: 'z', profile: rect(...xs(s, 0.6, hw - 0.04), axles[1] + r + 0.15, yf - r - 0.15), from: 0.62, to: 1.18, r: 0.02, seg: 1, look: paint('locker') });
  out.push(...tube([[0.72, yk1, 0.82], [0.72, axles[1] + r + 0.1, 0.82]], 0.05, { sides: 8, look: alu('pipe') }));
  P({ axis: 'x', profile: rect(yT, yT + 0.12, 0.42, 0.58), from: -hw + 0.12, to: hw - 0.12, r: 0.012, seg: 1, look: dark('underrun') });
  out.push(...hazard({ o: [hw - 0.14, yT, 0.43], u: neg(X), v: Z, w: 2 * hw - 0.28, h: 0.14, n: neg(Y) }));
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.25), yk0, 0.66], neg(Y), 0.2, 0.1, 'tail', 'taillamp'));
    for (const y of [t0 + 1.0, t1 - 1.0]) out.push(...lamp([s * (hw - 0.04), y, 1.12], [s, 0, 0], 0.08, 0.05, 'marker', 'side.marker'));
    out.push(...guard(axles[1], r, r + 0.08, 0.1, 0.9, ...xs(s, 0.74, hw - 0.04), dark('guard.rear')));
    out.push(...guard(axles[2], r, r + 0.08, Math.PI - 0.9, Math.PI - 0.1, ...xs(s, 0.74, hw - 0.04), dark('guard.rear')));
  }
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, axles[2] - r - 0.12, 0.82], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (a + 0.004), (t0 + t1) / 2 + 0.6, zc - 0.15], out: sd, up: Z, h: 0.26 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.92, tub: { x: hw, y: [yT, ybc], z: [0.66, 1.24] } } };
}

export const HAUL_BODIES = Object.freeze({ baggageTug, baggageCart, pushbackTug, fuelTruck });

/** Each hauler's kit (mil-fittings.js cards on its anchors). */
export const HAUL_KITS = Object.freeze({
  baggageTug: Object.freeze([['post.L', 'mirror'], ['post.R', 'mirror']]),
  baggageCart: Object.freeze([]),
  pushbackTug: Object.freeze([['sill.L', 'step', { drop: 1.2 }]]),
  fuelTruck: Object.freeze([
    ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.4 }], ['sill.R', 'step', { drop: 1.4 }],
    ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }],
  ]),
});
