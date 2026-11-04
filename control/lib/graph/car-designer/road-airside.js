/**
 * THE AIRSIDE GROUND CREW in the form render: the airfield's support vehicles at their classes' true numbers
 * (roads/vehicles.js), built from the hull kit (mil-hull.js) as the field's vehicles are, and drawn, worn and painted by
 * the same compiler (military.js compileMilitary, road-military.js militaryBody), so every door that draws a field
 * vehicle draws these: the preview, a level's parked vehicles, the GLB. They are classes, not replicas.
 *
 *   catering    the catering hi-loader: a cab-over cab, a ladder frame on two axles (the rear's twin tyres); the galley
 *               body on a two-stage scissor lift and its rams, its roof lamps, its ribbed sides, its service door and
 *               its rear shutter; the platform hinged at its front, folded up against it on the road and laid out over
 *               the cab, its rails up and its rubber at the door, once the body is high enough to clear it; the
 *               stabiliser jacks at the corners, down on their pads when it is raised
 *   beltLoader  the belt loader: a low chassis on small wheels, the driver's open station on the left (its seat, wheel,
 *               dash) and the engine's cover behind it; the conveyor over the right, its channel, its belt and cleats,
 *               its rollers, its rubber nose and its work lamps, a handrail along its left, carried on a strut at its
 *               tail and raised by two rams ahead
 *   stairs      the passenger stair truck: a cab-over cab, its platform over the cab on two telescoping columns, its
 *               side rails; the flight from the platform down past the chassis to its foot behind it, its treads level
 *               at every height, its stringers and handrails
 *
 * Each says how high it reaches: the galley's floor, the belt's nose, the platform (`reach`, metres from the ground). On
 * the road each is stowed; its word `raised` (airsideWords: raised, lifted, up, docked, serving) raises it to a
 * single-aisle airliner's door, and a number sets it (`pose.reach`, clamped to its range), as a turnaround does to meet
 * an aircraft's own door. The census measures each stowed.
 *
 * Its paint is the livery's (livery-cut.js): plain, the airside's white (AIRSIDE_LIVERY) with its fleet number on its
 * mark anchors; a camo on a base. What is not paint is its own: the hazard stripes on its bumpers and edges, the amber
 * beacon, rubber, aluminium treads and rails. Its tyres are smooth (an apron is concrete).
 *
 *   AIRSIDE_CLASSES                   physics class → its body kind
 *   AIRSIDE_REACH                     kind → { stowed, raised, range: [lo, hi] } (metres)
 *   AIRSIDE_LIVERY                    the plain airside livery a body wears when none is named
 *   airsideWords(words)               → { raised }
 *   reachOf(kind, { words?, pose? })  → the height it reaches, clamped to its range
 *   airsideAxles(cls)                 → the axles' stations (+y forward, the body centred)
 *   reachFront(cls, reach)            → how far ahead of its middle a lifting body meets a door (the platform's or the
 *                                       belt's nose), at that reach
 *   AIRSIDE_BODIES, AIRSIDE_KITS      the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, bend, face, place } from './mil-hull.js';
import { AIRSIDE_REACH, reachOf, C, M, paint, dark, alu, rect, xs, X, Y, Z, neg, beam, guard, hazard, beacon, lamp, cabOver } from './airside-kit.js';
import { HAUL_CLASSES, HAUL_BODIES, HAUL_KITS, haulAxles } from './road-airside-haul.js';

// (and the haulers, road-airside-haul.js: the baggage tug and its carts, the pushback tug, the refueller)
export const AIRSIDE_CLASSES = Object.freeze({ cateringTruck: 'catering', beltLoader: 'beltLoader', stairTruck: 'stairs', ...HAUL_CLASSES });

export { AIRSIDE_REACH, AIRSIDE_LIVERY, airsideWords, reachOf } from './airside-kit.js';

/** Where each axle stands (+y forward), the front first. */
export function airsideAxles(cls) {
  const v = VEHICLES[cls], kind = AIRSIDE_CLASSES[cls];
  if (kind === 'catering') { const yf = v.L / 2 - 1.3; return [yf, yf - v.wheelbase]; }
  if (kind === 'beltLoader') return [v.wheelbase / 2, -v.wheelbase / 2];
  if (kind === 'stairs') { const yf = v.L / 2 - 1.1; return [yf, yf - v.wheelbase]; }
  if (HAUL_CLASSES[cls]) return haulAxles(cls);
  throw new Error(`car-designer: '${cls}' is not an airside class (${Object.keys(AIRSIDE_CLASSES).join(', ')})`);
}

// how far ahead of its middle each meets a door, at a reach (vehicle +y): the catering platform's rubber (laid out past
// its cab), the belt's nose, the stair platform's rubber
const cateringFront = (cls) => VEHICLES[cls].L / 2 + 0.38;
/** Where a lifting body's leading edge stands at a reach (+y from its middle, metres): what a turnaround sets at a door. */
export function reachFront(cls, reach) {
  const kind = AIRSIDE_CLASSES[cls], v = VEHICLES[cls];
  if (kind === 'catering') return cateringFront(cls);
  if (kind === 'stairs') return v.L / 2;
  if (kind === 'beltLoader') { const L = beltLine(reachOf('beltLoader', { pose: { reach } }), -v.L / 2 + 0.06, BELT); return L.yTail + BELT * L.cos + 0.07; }
  throw new Error(`car-designer: a ${cls} meets no door`);
}

// ── the catering hi-loader ──────────────────────────────────────────────────────
function catering(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, [yf, yr] = airsideAxles(cls), yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const zD = reachOf('catering', { words, pose }), R = AIRSIDE_REACH.catering, up = zD > R.stowed + 0.05;
  // the frame on its axles; the axles' housings
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.42, 0.52), 0.62, 0.86), from: yT + 0.12, to: yN - 0.3, r: 0.01, seg: 1, look: dark('frame') });
  for (const y of [yf, yr]) out.push(...tube([[-0.86, y, r], [0.86, y, r]], 0.065, { sides: 10, look: M('axle', 'steel', C.steel) }));
  out.push(...tube([[0, yr - 0.2, r], [0, yr + 0.16, r]], 0.16, { sides: 12, look: M('axle', 'steel', C.steel) }));
  // the cab, over the front wheels; their guards
  const z0 = 2 * r + 0.14, z1 = 2.75, yfc = yN - 0.12, ybc = yN - 2.2, hwc = hw - 0.07;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the lift's base on the frame, the stabilisers at its corners (down on their pads when raised)
  const zL = 1.0;
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.74, 1.0), 0.86, zL), from: yT + 0.15, to: ybc - 0.12, r: 0.01, seg: 1, look: dark('lift.base') });
  for (const [x, y] of [[-1, yT + 0.35], [1, yT + 0.35], [-1, ybc - 0.3], [1, ybc - 0.3]]) {
    const foot = up ? 0.03 : 0.32;
    out.push(...tube([[x * 1.06, y, 0.92], [x * 1.06, y, foot + 0.06]], 0.05, { sides: 10, look: dark('jack') }));
    P({ axis: 'z', profile: rect(x * 1.06 - 0.1, x * 1.06 + 0.1, y - 0.1, y + 0.1), from: foot, to: foot + 0.04, r: 0.01, seg: 1, look: M('jack.pad', 'steel', C.steel) });
  }
  // the scissors: two stages, a pair of crossed arms each side, their pins; the rams under the first stage
  const zU = zD - 0.16, hs = (zU - zL) / 2, ell = 3.05, sx = Math.sqrt(Math.max(0.01, ell * ell - hs * hs)), y0 = yT + 0.55;
  for (let k = 0; k < 2; k++) {
    const za = zL + k * hs, zb2 = za + hs;
    for (const s of [-1, 1]) {
      out.push(...beam([y0, za + 0.06], [y0 + sx, zb2 - 0.06], ...xs(s, 0.78, 0.86), 0.12, dark('scissor')));
      out.push(...beam([y0 + sx, za + 0.06], [y0, zb2 - 0.06], ...xs(s, 0.88, 0.96), 0.12, dark('scissor')));
    }
    out.push(...tube([[-0.98, y0 + sx / 2, za + hs / 2], [0.98, y0 + sx / 2, za + hs / 2]], 0.04, { sides: 8, look: M('scissor.pin', 'steel', C.steel) }));
  }
  for (const s of [-1, 1]) {
    const a = [s * 0.5, ybc - 0.5, zL + 0.05], b = [s * 0.5, y0 + sx / 2, zL + hs / 2], m = [0, 1, 2].map((i) => (a[i] + b[i]) / 2);
    out.push(...tube([a, m], 0.07, { sides: 10, look: dark('ram') }), ...tube([m, b], 0.04, { sides: 8, look: M('ram.rod', 'alloy', '#c9ccce') }));
  }
  // the galley body on its underframe: a box, its corner posts, ribbed sides, its roof and its lamps
  const yB0 = yT + 0.02, yB1 = ybc - 0.25, zTop = zD + 2.28, hb = hw - 0.012;
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.8, 0.98), zD - 0.16, zD - 0.02), from: yB0 + 0.05, to: yB1 - 0.05, r: 0.01, seg: 1, look: dark('body.sill') });
  P({ axis: 'y', profile: rect(-hb + 0.04, hb - 0.04, zD - 0.04, zTop), from: yB0 + 0.04, to: yB1 - 0.04, r: 0.03, seg: 1, look: paint('body') });
  for (const [sx2, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x0 = sx2 * (hb - 0.04), y0b = sy < 0 ? yB0 + 0.04 : yB1 - 0.04;
    P({ axis: 'z', profile: rect(x0 - 0.04, x0 + 0.04, y0b - 0.04, y0b + 0.04), from: zD - 0.06, to: zTop + 0.025, r: 0.012, seg: 1, look: paint('body.post') });
  }
  for (const s of [-1, 1]) for (let y = yB0 + 0.6; y < yB1 - 0.3; y += 0.62) {
    if (s > 0 && y > yB1 - 1.45) continue;   // (the service door's panel on the right, forward)
    P({ axis: 'x', profile: rect(y - 0.025, y + 0.025, zD + 0.08, zTop - 0.1), from: s * (hb - 0.04), to: s * hb, r: 0.008, seg: 1, look: paint('body.rib') });
  }
  P({ axis: 'z', profile: rect(-hb + 0.02, hb - 0.02, yB0 + 0.02, yB1 - 0.02), from: zTop, to: zTop + 0.025, r: 0.01, seg: 1, look: paint('roof') });
  for (const [x, y, lens] of [[-hb + 0.1, yB1 - 0.08, 'marker'], [hb - 0.1, yB1 - 0.08, 'marker'], [-hb + 0.1, yB0 + 0.08, 'tail'], [hb - 0.1, yB0 + 0.08, 'tail']]) out.push(...lamp([x, y, zTop + 0.025], Z, 0.08, 0.05, lens, 'roof.lamp'));
  // (its service door on the right, forward: its shut lines, its handle; the front's double doors to the aircraft)
  const seam = M('seam', 'seal', '#151614'), xr = hb + 0.002;
  const sideStrip = (ya, yb2, za, zb) => out.push(face([[xr, ya, za], [xr, yb2, za], [xr, yb2, zb], [xr, ya, zb]], seam, X));
  sideStrip(yB1 - 1.3, yB1 - 1.288, zD + 0.08, zTop - 0.12); sideStrip(yB1 - 0.32, yB1 - 0.308, zD + 0.08, zTop - 0.12); sideStrip(yB1 - 1.3, yB1 - 0.308, zTop - 0.132, zTop - 0.12);
  out.push(...tube([[xr, yB1 - 1.18, zD + 1.05], [xr + 0.03, yB1 - 1.18, zD + 1.05], [xr + 0.03, yB1 - 1.18, zD + 1.3], [xr, yB1 - 1.18, zD + 1.3]], 0.011, { sides: 6, look: paint('door.handle') }));
  const yF = yB1 - 0.04 + 0.003, frontStrip = (xa, xb, za, zb) => out.push(face([[xa, yF, za], [xb, yF, za], [xb, yF, zb], [xa, yF, zb]], seam, Y));
  frontStrip(-0.9, 0.9, zTop - 0.2, zTop - 0.188); frontStrip(-0.906, -0.894, zD + 0.06, zTop - 0.188); frontStrip(0.894, 0.906, zD + 0.06, zTop - 0.188); frontStrip(-0.006, 0.006, zD + 0.06, zTop - 0.188);
  for (const s of [-1, 1]) out.push(...tube([[s * 0.12, yF, zD + 0.95], [s * 0.12, yF + 0.03, zD + 0.95], [s * 0.12, yF + 0.03, zD + 1.25], [s * 0.12, yF, zD + 1.25]], 0.011, { sides: 6, look: paint('door.handle') }));
  // (its rear shutter: slats, its bottom bar; its tail lamps on the frame's end, the under-run bar, striped)
  const yS = yB0 + 0.04 - 0.003;
  for (let z = zD + 0.1; z < zTop - 0.12; z += 0.09) out.push(face([[-0.95, yS, z], [0.95, yS, z], [0.95, yS, z + 0.012], [-0.95, yS, z + 0.012]], seam, neg(Y)));
  P({ axis: 'x', profile: rect(yS - 0.03, yS, zD + 0.05, zD + 0.1), from: -0.95, to: 0.95, r: 0.005, seg: 1, look: alu('shutter.bar') });
  P({ axis: 'x', profile: rect(yT, yT + 0.12, 0.42, 0.58), from: -hw + 0.12, to: hw - 0.12, r: 0.012, seg: 1, look: dark('underrun') });
  out.push(...hazard({ o: [hw - 0.14, yT, 0.43], u: neg(X), v: Z, w: 2 * hw - 0.28, h: 0.14, n: neg(Y) }));
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.3), yT + 0.12, 0.72], neg(Y), 0.22, 0.1, 'tail', 'taillamp'));
  // (the rear wheels' guards, under the body)
  for (const s of [-1, 1]) out.push(...guard(yr, r, r + 0.08, 0.15, Math.PI - 0.15, ...xs(s, 0.74, hw - 0.04), dark('guard.rear')));
  // the platform at the body's front: hinged at its floor, laid out over the cab when it clears it, folded up against
  // the body when not; its rails up when laid out, folded flat on it when not; its rubber nose and its striped edge
  // (laid out, it telescopes past the cab's bumper, so its rubber meets a door before the cab meets the aircraft)
  const open = zD - 0.1 > z1 + 0.05, D = open ? cateringFront(cls) - 0.08 - (yB1 - 0.04) : 1.25, pw = hw - 0.16, plat = [];
  plat.push(...plate({ axis: 'z', profile: rect(-pw, pw, 0.03, D), from: -0.08, to: 0, r: 0.01, seg: 1, look: alu('platform') }));
  plat.push(...plate({ axis: 'y', profile: rect(-pw, pw, -0.1, 0.02), from: D, to: D + 0.08, r: 0.02, seg: 2, look: M('platform.bumper', 'rubber', C.rubber) }));
  plat.push(...tube([[-pw, 0.02, -0.04], [pw, 0.02, -0.04]], 0.035, { sides: 8, look: M('platform.hinge', 'steel', C.steel) }));
  if (open) for (const s of [-1, 1]) plat.push(...plate({ axis: 'y', profile: rect(...xs(s, pw - 0.12, pw - 0.04), -0.16, -0.08), from: 0.1, to: D - 0.05, look: alu('platform.slide') }));
  plat.push(...hazard({ o: [pw, D - 0.1, 0.001], u: neg(X), v: Y, w: 2 * pw, h: 0.1, n: Z }));
  for (const s of [-1, 1]) {
    const x = s * (pw - 0.04), rail = open
      ? [[x, 0.05, 0], [x, 0.05, 1.05], [x, D - 0.08, 1.05], [x, D - 0.08, 0]]
      : [[x, 0.05, 0.03 + (s > 0 ? 0.04 : 0)], [x - s * 0.95, 0.05, 0.03 + (s > 0 ? 0.04 : 0)], [x - s * 0.95, D - 0.08, 0.03 + (s > 0 ? 0.04 : 0)], [x, D - 0.08, 0.03 + (s > 0 ? 0.04 : 0)]];
    plat.push(...tube(bend(rail, 0.06, 3), 0.022, { sides: 8, look: alu('platform.rail') }));
    if (open) plat.push(...tube([[x, 0.05, 0.55], [x, D - 0.08, 0.55]], 0.016, { sides: 6, look: alu('platform.rail') }));
  }
  out.push(...place(plat, open
    ? { origin: [0, yB1 - 0.04, zD], ex: X, ey: Y, ez: Z }
    : { origin: [0, yB1 + 0.07, zD + 0.02], ex: X, ey: Z, ez: neg(Y) }));
  // the anchors: the cab's, the flaps behind the rear wheels, a number high on each side of the body
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yr - r - 0.12, 0.78], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hb + 0.003), yB0 + 1.0 + 0.31, zTop - 0.42], out: sd, up: Z, h: 0.24 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.86, tub: { x: hw, y: [yT, ybc], z: [0.86, zD] } } };
}

// ── the belt loader ─────────────────────────────────────────────────────────────
const BELT = 7.45;   // (the conveyor's length, tail to nose)
// the belt's nose height → its tail's (raised too, past what the strut allows) and its tilt, its tail fixed in y
function beltLine(reach, yTail, Lb) {
  const zTail = 0.55 + Math.max(0, reach - 2.8) * 0.6, sin = Math.min(0.6, (reach - zTail) / Lb);
  return { zTail, sin, cos: Math.sqrt(1 - sin * sin), yTail };
}

function beltLoader(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, [yf, yr] = airsideAxles(cls), yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const reach = reachOf('beltLoader', { words, pose });
  // the chassis: a tub between the wheels, its skirts ahead, between and behind them, its bumpers striped
  const yc0 = -2.05, yc1 = 2.05, zc0 = 0.26, zc1 = 0.5, wx = v.track / 2 - v.wheelRadius * 0.55;
  P({ axis: 'y', profile: rect(-wx, wx, zc0, zc1), from: yc0, to: yc1, r: 0.02, seg: 1, look: paint('chassis') });
  for (const s of [-1, 1]) for (const [a, b] of [[yr + r + 0.08, yf - r - 0.08], [yf + r + 0.08, yc1], [yc0, yr - r - 0.08]]) P({ axis: 'y', profile: rect(...xs(s, wx, hw - 0.02), zc0 + 0.06, zc1), from: a, to: b, r: 0.015, seg: 1, look: paint('chassis.skirt') });
  for (const y of [yf, yr]) out.push(...tube([[-v.track / 2 + 0.12, y, r], [v.track / 2 - 0.12, y, r]], 0.045, { sides: 8, look: M('axle', 'steel', C.steel) }));
  for (const s of [-1, 1]) for (const y of [yf, yr]) out.push(...guard(y, r, r + 0.06, 0.25, Math.PI - 0.25, ...xs(s, wx, hw - 0.02), paint('guard')));
  for (const [y0, y1, n] of [[yc1 - 0.02, yc1 + 0.1, Y], [yc0 - 0.1, yc0 + 0.02, neg(Y)]]) {
    P({ axis: 'x', profile: rect(y0, y1, 0.24, 0.44), from: -hw + 0.04, to: hw - 0.04, r: 0.015, seg: 1, look: dark('bumper') });
    const yF = n[1] > 0 ? y1 : y0;
    out.push(...hazard({ o: [n[1] > 0 ? -hw + 0.06 : hw - 0.06, yF, 0.25], u: n[1] > 0 ? X : neg(X), v: Z, w: 2 * hw - 0.12, h: 0.18, n }));
  }
  // the engine's cover, left and aft; the driver's open station ahead of it: floor, seat, dash, column and wheel
  const xl0 = -hw + 0.02, xl1 = -0.2;
  P({ axis: 'z', profile: rect(xl0, xl1, yc0 + 0.05, -0.55), from: zc1, to: 1.05, r: 0.05, seg: 2, look: paint('engine.cover') });
  for (let i = 0; i < 6; i++) { const y = -1.75 + i * 0.16; P({ axis: 'x', profile: rect(y - 0.025, y + 0.025, 0.7, 0.92), from: xl0 - 0.004, to: xl0 + 0.004, look: M('louvre', 'carbon', C.black) }); }
  P({ axis: 'z', profile: rect(xl0 + 0.04, xl1, -0.5, 1.55), from: zc1, to: zc1 + 0.03, look: M('floor', 'steel', C.steel) });
  P({ axis: 'z', profile: rect(-0.82, -0.36, -0.15, 0.32), from: 0.78, to: 0.88, r: 0.04, seg: 2, look: M('seat', 'canvas', C.seat) });
  P({ axis: 'y', profile: rect(-0.82, -0.36, 0.86, 1.38), from: -0.2, to: -0.1, r: 0.04, seg: 2, look: M('seat', 'canvas', C.seat) });
  P({ axis: 'z', profile: rect(-0.66, -0.52, -0.05, 0.2), from: zc1 + 0.03, to: 0.78, r: 0.01, seg: 1, look: dark('seat.post') });
  P({ axis: 'y', profile: rect(-0.92, -0.26, zc1 + 0.03, 0.98), from: 1.3, to: 1.55, r: 0.03, seg: 2, look: paint('dash') });
  const colA = [-0.59, 1.3, 0.85], colB = [-0.59, 1.0, 1.08];
  out.push(...tube([colA, colB], 0.03, { sides: 8, look: M('column', 'carbon', C.black) }));
  out.push(...tube(Array.from({ length: 17 }, (_, k) => { const a = (2 * Math.PI * k) / 16, c = Math.cos(a) * 0.18, s = Math.sin(a) * 0.18; return [colB[0] + c, colB[1] - s * 0.6, colB[2] + s * 0.8]; }), 0.016, { sides: 6, caps: false, look: M('wheel.rim', 'rubber', C.rubber) }));
  out.push(...beacon([-0.6, yc0 + 0.3, 1.05]));
  // the conveyor over the right: built along its own line, carried to its tilt (its tail fixed, its nose at its reach)
  const Lb = BELT, xc = hw - 0.5, line = beltLine(reach, yT + 0.06, Lb), belt = [], bw = 0.4;
  for (const s of [-1, 1]) belt.push(...plate({ axis: 'y', profile: rect(...xs(s, bw, bw + 0.06), -0.22, 0.06), from: 0, to: Lb, r: 0.01, seg: 1, look: paint('conveyor.side') }));
  belt.push(...plate({ axis: 'z', profile: rect(-bw, bw, 0.03, Lb - 0.03), from: -0.02, to: 0, look: M('belt', 'rubber', C.belt) }));
  for (let y = 0.25; y < Lb - 0.1; y += 0.32) belt.push(...plate({ axis: 'y', profile: rect(-bw + 0.02, bw - 0.02, 0, 0.022), from: y - 0.012, to: y + 0.012, look: M('belt.cleat', 'rubber', C.belt) }));
  belt.push(...plate({ axis: 'z', profile: rect(-bw - 0.04, bw + 0.04, 0.06, Lb - 0.06), from: -0.22, to: -0.19, look: dark('conveyor.pan') }));
  for (const y of [0.06, Lb - 0.06]) belt.push(...tube([[-bw, y, -0.07], [bw, y, -0.07]], 0.07, { sides: 10, look: M('roller', 'steel', C.steel) }));
  belt.push(...plate({ axis: 'y', profile: rect(-bw - 0.05, bw + 0.05, -0.18, 0.05), from: Lb, to: Lb + 0.07, r: 0.02, seg: 2, look: M('conveyor.nose', 'rubber', C.rubber) }));
  for (const s of [-1, 1]) belt.push(...hazard({ o: [s * (bw + 0.06), Lb - 0.75, -0.2], u: Y, v: Z, w: 0.72, h: 0.24, n: [s, 0, 0] }));
  for (const s of [-1, 1]) belt.push(...lamp([s * (bw + 0.03), Lb - 0.12, 0.1], Z, 0.08, 0.1, 'lamp', 'worklamp'));
  // (its handrail along its left, on posts)
  const xh = -bw - 0.03, posts = [1.3, 2.7, 4.1, 5.5, Lb - 0.35];
  for (const y of posts) belt.push(...tube([[xh, y, 0.06], [xh, y, 0.5]], 0.018, { sides: 6, look: alu('conveyor.rail') }));
  belt.push(...tube([[xh, posts[0], 0.5], [xh, posts[posts.length - 1], 0.5]], 0.02, { sides: 8, look: alu('conveyor.rail') }));
  const ey = [0, line.cos, line.sin], ez = [0, -line.sin, line.cos], o = [xc, line.yTail, line.zTail];
  out.push(...place(belt, { origin: o, ex: X, ey, ez }));
  // (its strut at the tail and its two rams ahead, from the chassis to the belt's underside)
  const under = (s, x = 0) => [o[0] + x, o[1] + ey[1] * s + ez[1] * -0.2, o[2] + ey[2] * s + ez[2] * -0.2];
  const sAt = (y) => (y - line.yTail) / line.cos;
  for (const s of [-1, 1]) {
    out.push(...tube([[xc + s * 0.28, yc0 + 0.35, zc1], under(sAt(yc0 + 0.35) + 0.4, s * 0.28)], 0.045, { sides: 8, look: dark('strut') }));
    const a = [xc + s * 0.28, yc1 - 0.45, zc1], b = under(Math.min(Lb - 0.9, sAt(yc1 + 0.4)), s * 0.28), m = [0, 1, 2].map((i) => (a[i] + b[i]) / 2);
    out.push(...tube([a, m], 0.055, { sides: 10, look: dark('ram') }), ...tube([m, b], 0.03, { sides: 8, look: M('ram.rod', 'alloy', '#c9ccce') }));
  }
  const anchors = [
    { id: 'sill.L', kind: 'sill', at: [-hw + 0.1, 0.5, zc0 + 0.02], out: neg(X), up: Z },
    { id: 'mark.L', kind: 'mark', role: 'number', at: [xl0 - 0.004, -1.25, 0.82], out: neg(X), up: Z, h: 0.12 },
    { id: 'mark.R', kind: 'mark', role: 'number', at: [hw - 0.02 + 0.004, 0, 0.4], out: X, up: Z, h: 0.11 },
  ];
  return { faces: out.filter(Boolean), anchors, zones: { floor: zc1, tub: { x: hw, y: [yc0, yc1], z: [zc0, zc1] } } };
}

// ── the passenger stair truck ───────────────────────────────────────────────────
function stairs(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, [yf, yr] = airsideAxles(cls), yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const zP = reachOf('stairs', { words, pose });
  // the frame, its end short of the flight's foot; the axles
  const yRail = yT + 1.25;
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, 0.38, 0.48), 0.58, 0.8), from: yRail, to: yN - 0.3, r: 0.01, seg: 1, look: dark('frame') });
  P({ axis: 'x', profile: rect(yRail, yRail + 0.1, 0.58, 0.8), from: -0.48, to: 0.48, look: dark('frame') });
  for (const y of [yf, yr]) out.push(...tube([[-0.8, y, r], [0.8, y, r]], 0.06, { sides: 10, look: M('axle', 'steel', C.steel) }));
  // the cab and its front guards; the rear wheels' guards; a box each side behind the cab
  const z0 = 2 * r + 0.12, z1 = 2.4, yfc = yN - 0.1, ybc = yN - 1.95, hwc = hw - 0.1;
  const anchors = cabOver(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  for (const s of [-1, 1]) {
    out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
    out.push(...guard(yr, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, 0.74, hw - 0.005), paint('guard.rear')));
    P({ axis: 'z', profile: rect(...xs(s, 0.55, hw - 0.025), ybc - 0.95, ybc - 0.1), from: 0.5, to: 1.1, r: 0.03, seg: 1, look: paint('locker') });
    out.push(...lamp([s * (hw - 0.025), ybc - 0.5, 0.95], [s, 0, 0], 0.08, 0.06, 'marker', 'side.marker'));
  }
  // the platform over the cab: its deck on its frame, its rubber nose, its striped edge, its side rails
  const yP0 = ybc + 0.3, pw = 0.74, zPd = zP - 0.1;
  P({ axis: 'z', profile: rect(-pw, pw, yP0, yN - 0.08), from: zPd, to: zP, r: 0.01, seg: 1, look: alu('platform') });
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, pw - 0.08, pw), zPd - 0.12, zPd), from: yP0, to: yN - 0.08, r: 0.01, seg: 1, look: paint('platform.frame') });
  P({ axis: 'y', profile: rect(-pw, pw, zPd - 0.04, zP + 0.04), from: yN - 0.08, to: yN, r: 0.025, seg: 2, look: M('platform.bumper', 'rubber', C.rubber) });
  out.push(...hazard({ o: [-pw, yN - 0.08 - 0.002, zPd - 0.12], u: X, v: Z, w: 2 * pw, h: 0.1, n: Y }));
  const rail = 1.05;
  for (const s of [-1, 1]) {
    const x = s * (pw - 0.04);
    out.push(...tube(bend([[x, yP0 + 0.02, zP + rail], [x, yN - 0.14, zP + rail], [x, yN - 0.14, zP]], 0.06, 3), 0.024, { sides: 8, look: alu('platform.rail') }));
    out.push(...tube([[x, yP0 + 0.02, zP + 0.52], [x, yN - 0.14, zP + 0.52]], 0.016, { sides: 6, look: alu('platform.rail') }));
    out.push(...tube([[x, (yP0 + yN) / 2, zP], [x, (yP0 + yN) / 2, zP + rail]], 0.018, { sides: 6, look: alu('platform.rail') }));
  }
  // its two columns behind the cab, telescoping to its height
  for (const s of [-1, 1]) {
    const x = s * 0.5, y = yP0 + 0.12;
    out.push(...tube([[x, y, 0.8], [x, y, 2.0]], 0.075, { sides: 12, look: dark('column') }));
    out.push(...tube([[x, y, 1.95], [x, y, zPd - 0.1]], 0.055, { sides: 10, look: M('column.inner', 'alloy', '#c9ccce') }));
    P({ axis: 'z', profile: rect(x - 0.14, x + 0.14, y - 0.14, y + 0.14), from: 0.76, to: 0.82, r: 0.01, seg: 1, look: dark('column.foot') });
  }
  // the flight: from its foot behind the frame to the platform's back edge; its treads level at every height, its
  // stringers, its handrails on stanchions; the stringers' foot a crossbar, its lamps, its stripes
  const yF = yT + 0.06, zF = 0.45, n = 18, go = (yP0 - yF) / n, rise = (zP - zF) / n, tw = 0.6;
  for (let k = 0; k < n; k++) P({ axis: 'z', profile: rect(-tw, tw, yF + k * go, yF + (k + 1) * go + 0.02), from: zF + k * rise - 0.04, to: zF + k * rise, r: 0.008, seg: 1, look: alu('tread') });
  const nose = (y) => zF + ((y - yF) / (yP0 - yF)) * (zP - zF);
  for (const s of [-1, 1]) {
    out.push(...beam([yF - 0.04, zF - 0.16], [yP0, zP - 0.16], ...xs(s, tw, tw + 0.07), 0.26, paint('stringer')));
    const xh = s * (tw + 0.05), hh = 0.95;
    const sts = Array.from({ length: 6 }, (_, i) => yF + 0.15 + ((yP0 - yF - 0.3) * i) / 5);
    for (const y of sts) out.push(...tube([[xh, y, nose(y) + 0.05], [xh, y, nose(y) + hh]], 0.018, { sides: 6, look: alu('handrail') }));
    out.push(...tube([[xh, sts[0], nose(sts[0]) + hh], [xh, yP0 + 0.02, zP + rail]], 0.024, { sides: 8, look: alu('handrail') }));
    out.push(...hazard({ o: [s * (tw + 0.07), yF - 0.04, zF - 0.26], u: Y, v: Z, w: 0.6, h: 0.18, n: [s, 0, 0] }));
  }
  P({ axis: 'x', profile: rect(yF - 0.06, yF + 0.08, zF - 0.3, zF - 0.12), from: -tw - 0.07, to: tw + 0.07, r: 0.012, seg: 1, look: dark('flight.foot') });
  for (const s of [-1, 1]) out.push(...lamp([s * (tw - 0.12), yF - 0.06, zF - 0.21], neg(Y), 0.16, 0.08, 'tail', 'taillamp'));
  // the anchors: the cab's, the flaps behind the rear wheels, a number on each stringer
  anchors.push(...[-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X, ym = yF + (yP0 - yF) * 0.3;
    return [
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yr - r - 0.12, 0.72], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (tw + 0.074), ym, nose(ym) - 0.16], out: sd, up: Z, h: 0.12 },
    ];
  }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.8, tub: { x: hw, y: [yRail, ybc], z: [0.58, 1.1] } } };
}

export const AIRSIDE_BODIES = Object.freeze({ catering, beltLoader, stairs, ...HAUL_BODIES });

/** Each airside body's kit (mil-fittings.js cards on its anchors). */
export const AIRSIDE_KITS = Object.freeze({
  catering: Object.freeze([
    ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.4 }], ['sill.R', 'step', { drop: 1.4 }],
    ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }],
  ]),
  beltLoader: Object.freeze([['sill.L', 'step']]),
  stairs: Object.freeze([
    ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.2 }], ['sill.R', 'step', { drop: 1.2 }],
    ['grab.L', 'grabHandle', { width: 0.36 }], ['grab.R', 'grabHandle', { width: 0.36 }], ['flap.L', 'mudFlap', { drop: 0.55 }], ['flap.R', 'mudFlap', { drop: 0.55 }],
  ]),
  ...HAUL_KITS,
});
