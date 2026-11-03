/**
 * THE CITY'S EMERGENCY VEHICLES in the form render: a fire engine and two ambulances at their classes' true numbers
 * (roads/vehicles.js), in the hull kit's language (mil-hull.js, airside-kit.js, civic-kit.js), drawn, worn and painted
 * as the rest of the city's are (road-civic.js). Classes, not replicas, and in no service's livery.
 *
 *   fireEngine  the pumper: a cab-over crew cab, its raised roof white over the crew, its light bar; the pump panel
 *               behind the cab (its gauges, its discharges and their caps, its intake), the body of roll-up lockers down
 *               both sides, over and behind the rear wheels, its rub rail and its reflective band; the hose bed on top at
 *               the rear, its hose laid in it; an extension ladder racked on the roof; the tailboard and its grab bars,
 *               its chevrons and lamps; the bumper's siren
 *   ambulance   the box ambulance: a bonneted van cab and the patient module behind and over it (its front overhang
 *               over the cab's roof and its light bar, its corner lights), a side door on the right and its window, the
 *               rear doors and theirs, a side window on the left, its red band, its chevrons on the doors, the rear step
 *   paramedic   the paramedic van: a high-roofed panel van, one shell from its bumper to its tail (its bonnet, its raked
 *               screen, its high roof), its doors, the sliding door on the right, its rear doors; its light bar and the
 *               corner lights at the roof's rear, a high-visibility chequer down its sides and across its doors
 *
 *   emergencyAxles(cls, kind)         → the axles' stations (+y forward, the body centred)
 *   EMERGENCY_BODIES, EMERGENCY_KITS  the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face } from './mil-hull.js';
import { CC, own, chassis, crewCab, conventionalCab, lightBar, lockers, stripes, chequer, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C } from './civic-kit.js';

/** Where each axle stands (+y forward), the front first. */
export function emergencyAxles(cls, kind) {
  const v = VEHICLES[cls];
  if (kind === 'fireEngine') { const yf = v.L / 2 - 1.65; return [yf, yf - v.wheelbase]; }
  if (kind === 'ambulance') { const yf = v.L / 2 - 0.95; return [yf, yf - v.wheelbase]; }
  if (kind === 'paramedic') { const yf = v.L / 2 - 0.9; return [yf, yf - v.wheelbase]; }
  throw new Error(`car-designer: '${cls}' is not one of the city's emergency vehicles`);
}

const sideAnchors = (s, { flap, mark }) => {
  const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
  return [
    { id: `flap.${L}`, kind: 'flap', at: flap, out: neg(Y), up: Z },
    { id: `mark.${L}`, kind: 'mark', role: 'number', at: mark, out: sd, up: Z, h: 0.2 },
  ];
};

// ── the fire engine: a pumper ───────────────────────────────────────────────────
function fireEngine(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = emergencyAxles(cls, 'fireEngine'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN, r, hw, zf: 0.98, sideRails: false });
  // the crew cab over the front wheels, its raised roof white over the crew, its light bar across its front
  const z0 = 2 * r + 0.14, z1 = 2.85, yfc = yN - 0.12, ybc = yN - 3.25, hwc = hw - 0.05, yR = ybc + 1.55;
  const anchors = crewCab(out, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1, yR, raise: 0.25, roof: own('cab.roof', CC.white, 'milPaint') });
  out.push(...lightBar([0, yfc - 0.45, z1], { width: 1.8, colours: [CC.red, CC.lens] }));
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.38, hwc - 0.02), paint('guard')));
  out.push(...band([-hwc - 0.004, yfc - 0.2, z0 + 0.12], neg(Y), Z, yfc - ybc - 0.3, 0.1, neg(X), own('cab.band', CC.reflWhite)), ...band([hwc + 0.004, ybc + 0.1, z0 + 0.12], Y, Z, yfc - ybc - 0.3, 0.1, X, own('cab.band', CC.reflWhite)));
  // (its siren on the bumper)
  P({ axis: 'y', profile: rect(-0.5, -0.2, 0.36, 0.48), from: yN - 0.02, to: yN, look: M('siren', 'carbon', C.black) });
  // the pump panel behind the cab: its panel each side, its gauges, its discharges and their caps, the intake
  const hb = hw - 0.02, yP0 = ybc - 0.1, yP1 = yP0 - 1.0, yB1 = yT + 0.28, zb0 = 1.05, zb1 = 2.95;
  // (the pump's compartment set in from the body's sides, so its outlets and their caps stand within its width)
  const hp = hb - 0.2;
  P({ axis: 'y', profile: rect(-hb, hb, zb0, zb1), from: yB1, to: yP1, r: 0.04, seg: 2, look: paint('body') });
  P({ axis: 'y', profile: rect(-hp, hp, zb0, zb1), from: yP1 - 0.01, to: yP0, r: 0.03, seg: 2, look: paint('pump.house') });
  P({ axis: 'z', profile: rect(-hb, hb, yP1 - 0.01, yP0), from: zb1 - 0.04, to: zb1, r: 0.01, seg: 1, look: paint('pump.roof') });
  for (const s of [-1, 1]) {
    const x = s * (hp + 0.004), n = [s, 0, 0];
    out.push(face([[x, yP1 + 0.05, zb0 + 0.25], [x, yP0 - 0.05, zb0 + 0.25], [x, yP0 - 0.05, zb1 - 0.15], [x, yP1 + 0.05, zb1 - 0.15]], M('pump.panel', 'alloy', CC.chrome), n));
    for (let i = 0; i < 4; i++) out.push(...tube([[x, yP0 - 0.18 - i * 0.2, 2.45], [x + s * 0.02, yP0 - 0.18 - i * 0.2, 2.45]], 0.06, { sides: 12, look: M('pump.gauge', 'carbon', '#f2f2ee') }));
    for (const [y, z] of [[yP0 - 0.25, 1.55], [yP1 + 0.25, 1.55], [(yP0 + yP1) / 2, 1.95]]) {
      out.push(...tube([[x, y, z], [x + s * 0.12, y, z]], 0.05, { sides: 10, look: M('pump.discharge', 'alloy', CC.chrome) }));
      out.push(...tube([[x + s * 0.12, y, z], [x + s * 0.15, y, z]], 0.065, { sides: 10, look: M('pump.cap', 'alloy', '#d4a63a') }));
    }
    P({ axis: 'z', profile: rect(...xs(s, hp, hb), yP1, yP0 - 0.02), from: zb0 + 0.1, to: zb0 + 0.14, r: 0.005, seg: 1, look: alu('pump.step') });
    // (the lockers: forward of the rear wheel, over it, behind it; the rub rail under them; the reflective band)
    const yw0 = yr + r + 0.12, yw1 = yr - r - 0.12;
    lockers(out, { s, y0: yw0, y1: yP1 - 0.05, z0: zb0 + 0.12, z1: zb1 - 0.12, x: hb, n: 2 });
    lockers(out, { s, y0: yw1, y1: yw0, z0: 2 * r + 0.2, z1: zb1 - 0.12, x: hb, n: 1 });
    lockers(out, { s, y0: yB1 + 0.08, y1: yw1, z0: zb0 + 0.12, z1: zb1 - 0.12, x: hb, n: 1 });
    out.push(...tube([[s * (hb - 0.005), yB1 + 0.05, zb0 + 0.04], [s * (hb - 0.005), yP1 - 0.05, zb0 + 0.04]], 0.02, { sides: 6, look: alu('rubrail') }));
    out.push(...band([s * (hb + 0.004), s > 0 ? yB1 + 0.05 : yP1 - 0.05, zb0 + 0.07], s > 0 ? Y : neg(Y), Z, yP1 - yB1 - 0.1, 0.035, n, own('body.band', CC.reflWhite)));
    out.push(...guard(yr, r, r + 0.08, 0.15, Math.PI - 0.15, ...xs(s, 0.76, hb - 0.02), dark('guard.rear')));
  }
  // the hose bed on top at the rear, its hose laid in it; the extension ladder racked on the roof, forward of it
  const yH0 = yB1 + 0.05, yH1 = yH0 + 2.6;
  for (const s of [-1, 1]) P({ axis: 'x', profile: rect(yH0, yH1, zb1, zb1 + 0.18), from: s * (hb - 0.05), to: s * hb, r: 0.01, seg: 1, look: paint('hosebed.side') });
  for (let k = 0; k < 5; k++) { const x = -hb + 0.25 + k * ((2 * hb - 0.5) / 4); P({ axis: 'y', profile: rect(x - 0.18, x + 0.18, zb1, zb1 + 0.16), from: yH0 + 0.05, to: yH1 - 0.05, r: 0.05, seg: 2, look: M('hose', 'canvas', k % 2 ? '#c9b78a' : '#d9cba2') }); }
  const yL0 = yH1 + 0.15, yL1 = yP0 - 0.15, xl = [0.45, 0.95], zl = zb1 + 0.2;
  for (const x of xl) out.push(...tube([[x, yL0, zl], [x, yL1, zl]], 0.025, { sides: 6, look: alu('ladder') }));
  for (let y = yL0 + 0.15; y < yL1; y += 0.3) out.push(...tube([[xl[0], y, zl], [xl[1], y, zl]], 0.015, { sides: 6, look: alu('ladder') }));
  for (const y of [yL0 + 0.3, yL1 - 0.3]) out.push(...tube([[0.7, y, zb1], [0.7, y, zl - 0.03]], 0.02, { sides: 6, look: dark('ladder.rack') }));
  // the rear: its face's chevrons and lamps, the tailboard and its grab bars
  out.push(...stripes({ o: [-hb + 0.1, yB1 - 0.004, zb0 + 0.15], u: X, v: Z, w: 2 * hb - 0.2, h: 0.6, n: neg(Y), colours: [CC.reflRed, CC.yellow], mirror: true }));
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hb - 0.14), yB1 - 0.004, zb0 + 0.95], neg(Y), 0.16, 0.22, 'tail', 'taillamp'));
    out.push(...lamp([s * (hb - 0.14), yB1 - 0.004, zb1 - 0.12], neg(Y), 0.14, 0.1, 'marker', 'beacon.rear'));
    out.push(...tube([[s * (hb - 0.06), yB1 - 0.06, 1.3], [s * (hb - 0.06), yB1 - 0.06, 2.5]], 0.02, { sides: 6, look: alu('grab.rear') }));
  }
  P({ axis: 'z', profile: rect(-hb + 0.05, hb - 0.05, yT + 0.02, yB1), from: 0.62, to: 0.68, r: 0.01, seg: 1, look: alu('tailboard') });
  anchors.push(...[-1, 1].flatMap((s) => sideAnchors(s, { flap: [s * v.track / 2, yr - r - 0.12, 0.8], mark: [s * (hwc + 0.004), ybc + 0.75, z0 + 0.65] })));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.98, tub: { x: hw, y: [yT, ybc], z: [0.6, 1.1] } } };
}

// ── the box ambulance ───────────────────────────────────────────────────────────
function ambulance(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = emergencyAxles(cls, 'ambulance'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  chassis(out, { axles, yT, yN: yf + 0.7, r, hw: 1.0, zf: 0.78, sideRails: false, rails: [0.36, 0.44], axleHalf: 0.78 });
  // the van cab and its bonnet
  const yG = yf + 0.78, yw = yG - 0.9, yb = yw - 1.45, z0 = 0.86, zB = 1.32, z1 = 2.32, hwc = 1.0;
  const anchors = conventionalCab(out, { yb, yw, yG, yN, hw: hwc, hb: 0.82, z0, zB, z1, yf, r });
  // the patient module behind and over the cab: its box, its overhang over the cab's roof, its light bar, its corners'
  // lights, its doors and windows, its band, its chevrons, its step
  const hb = hw - 0.04, yM0 = yb - 0.06, yM1 = yT + 0.12, zm0 = 0.82, zm1 = v.H - 0.02;
  P({ axis: 'y', profile: rect(-hb, hb, zm0, zm1), from: yM1, to: yM0, r: 0.08, seg: 2, look: paint('module') });
  P({ axis: 'y', profile: rect(-hb + 0.04, hb - 0.04, z1 + 0.04, zm1), from: yM0 - 0.02, to: yb + 0.42, r: 0.08, seg: 2, look: paint('module.cap') });
  out.push(...lightBar([0, yb + 0.25, zm1 - 0.12], { width: 1.5, colours: [CC.red, CC.blue], depth: 0.26 }));
  for (const s of [-1, 1]) {
    const x = s * (hb + 0.004), n = [s, 0, 0];
    out.push(...lamp([s * (hb - 0.12), yb + 0.42, zm1 - 0.18], Y, 0.18, 0.12, 'tail', 'corner.lamp'));
    out.push(...lamp([x, yM1 + 0.2, zm1 - 0.18], n, 0.18, 0.12, 'tail', 'corner.lamp'));
    out.push(...lamp([x, yM0 - 0.2, zm1 - 0.18], n, 0.18, 0.12, 'tail', 'corner.lamp'));
    out.push(...band([x, s > 0 ? yM1 + 0.05 : yM0 - 0.05, 1.32], s > 0 ? Y : neg(Y), Z, yM0 - yM1 - 0.1, 0.24, n, own('module.band', CC.reflRed, 'milPaint')));
    // (a side door on the right, its window; a small window on the left)
    if (s > 0) {
      const ya = yM0 - 1.25, yb2 = yM0 - 0.35, seam = M('seam', 'seal', '#151614');
      for (const [a, b2, za, zb] of [[ya, ya + 0.012, zm0 + 0.12, 2.35], [yb2 - 0.012, yb2, zm0 + 0.12, 2.35], [ya, yb2, 2.338, 2.35]]) out.push(face([[x, a, za], [x, b2, za], [x, b2, zb], [x, a, zb]], seam, n));
      out.push(face([[x + s * 0.002, ya + 0.12, 1.75], [x + s * 0.002, yb2 - 0.12, 1.75], [x + s * 0.002, yb2 - 0.12, 2.2], [x + s * 0.002, ya + 0.12, 2.2]], M('glass', 'glass', C.glass), n));
      out.push(...tube([[x + s * 0.02, ya + 0.15, 1.45], [x + s * 0.02, ya + 0.4, 1.45]], 0.012, { sides: 6, look: M('door.handle', 'alloy', CC.chrome) }));
    } else out.push(face([[x, yM0 - 1.1, 1.8], [x, yM0 - 0.4, 1.8], [x, yM0 - 0.4, 2.25], [x, yM0 - 1.1, 2.25]], M('glass', 'glass', C.glass), n));
  }
  // (the rear doors: their seam down the middle, their windows, the chevrons below, the lamps, the step)
  const yr0 = yM1 - 0.004, seam = M('seam', 'seal', '#151614');
  out.push(face([[-0.006, yr0, zm0 + 0.1], [0.006, yr0, zm0 + 0.1], [0.006, yr0, zm1 - 0.25], [-0.006, yr0, zm1 - 0.25]], seam, neg(Y)));
  for (const s of [-1, 1]) {
    const [a, b2] = xs(s, 0.12, hb - 0.2);
    out.push(face([[a, yr0 - 0.002, 1.85], [b2, yr0 - 0.002, 1.85], [b2, yr0 - 0.002, 2.4], [a, yr0 - 0.002, 2.4]], M('glass', 'glass', C.glass), neg(Y)));
    out.push(...lamp([s * (hb - 0.1), yr0, 1.2], neg(Y), 0.14, 0.24, 'tail', 'taillamp'));
    out.push(...lamp([s * (hb - 0.12), yr0, zm1 - 0.15], neg(Y), 0.16, 0.12, 'tail', 'corner.lamp'));
  }
  out.push(...stripes({ o: [-hb + 0.2, yr0 - 0.002, 1.0], u: X, v: Z, w: 2 * hb - 0.4, h: 0.7, n: neg(Y), colours: [CC.reflRed, CC.yellow], mirror: true }));
  P({ axis: 'z', profile: rect(-0.8, 0.8, yT + 0.01, yM1 + 0.05), from: 0.5, to: 0.56, r: 0.01, seg: 1, look: alu('rear.step') });
  for (const s of [-1, 1]) out.push(...guard(yr, r, r + 0.07, 0.15, Math.PI - 0.15, ...xs(s, 0.62, hb - 0.03), dark('guard.rear')));
  anchors.push(...[-1, 1].flatMap((s) => sideAnchors(s, { flap: [s * v.track / 2, yr - r - 0.1, 0.65], mark: [s * (hb + 0.006), (yM0 + yM1) / 2 - 0.5, 1.15] })));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.78, tub: { x: hw, y: [yT, yb], z: [0.5, 0.9] } } };
}

// ── the paramedic van ───────────────────────────────────────────────────────────
function paramedic(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = emergencyAxles(cls, 'paramedic'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), H = v.H;
  chassis(out, { axles, yT, yN: yf + 0.6, r, hw, zf: 0.6, sideRails: false, rails: [0.34, 0.42], axleHalf: 0.72 });
  // the shell: its lower body (bumper to belt) and its upper (the screen raked back to the high roof)
  const yC = yN - 0.95, yS = yN - 1.62, yRf = yN - 1.95, zBelt = 1.28;
  P({ axis: 'x', profile: [[yT, 0.45], [yN - 0.06, 0.45], [yN - 0.06, 0.95], [yN - 0.3, 1.18], [yC, zBelt + 0.02], [yT, zBelt + 0.02]], from: -hw, to: hw, r: 0.1, seg: 2, look: paint('body') });
  P({ axis: 'x', profile: [[yT, zBelt - 0.02], [yC, zBelt - 0.02], [yS, 2.2], [yRf, H - 0.03], [yT + 0.08, H], [yT, H - 0.12]], from: -hw + 0.03, to: hw - 0.03, r: 0.1, seg: 2, look: paint('body.upper') });
  // (its screen on the rake, its wipers; its bumpers, grille and lamps)
  const nS = (() => { const d = [yS - yC, 2.2 - zBelt], l = Math.hypot(...d); return [0, -d[1] / l, d[0] / l].map((c) => -c); })();
  const onRake = (t, x) => [x, yC + (yS - yC) * t, zBelt + (2.2 - zBelt) * t].map((c, i) => c + nS[i] * 0.004);
  out.push(face([onRake(0.08, -hw + 0.12), onRake(0.08, hw - 0.12), onRake(0.95, hw - 0.12), onRake(0.95, -hw + 0.12)], M('glass', 'glass', C.glass), nS));
  for (const s of [-1, 1]) out.push(...tube([onRake(0.1, s * 0.1), onRake(0.35, s * 0.55)], 0.008, { sides: 6, look: M('wiper', 'carbon', C.black) }));
  P({ axis: 'x', profile: rect(yN - 0.14, yN, 0.42, 0.72), from: -hw - 0.0, to: hw - 0.0, r: 0.04, seg: 2, look: M('bumper', 'carbon', C.black) });
  P({ axis: 'x', profile: rect(yT, yT + 0.12, 0.42, 0.68), from: -hw, to: hw, r: 0.04, seg: 2, look: M('bumper', 'carbon', C.black) });
  P({ axis: 'y', profile: rect(-0.45, 0.45, 0.78, 0.98), from: yN - 0.08, to: yN - 0.05, look: M('grille', 'carbon', C.black) });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.25), yN - 0.12, 1.0], Y, 0.3, 0.14, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hw - 0.15), yT, 1.05], neg(Y), 0.12, 0.3, 'tail', 'taillamp'));
  }
  // (its doors: the cab's each side, its glass; the sliding door on the right; the rear doors and their glass)
  const seam = M('seam', 'seal', '#151614');
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.003), n = [s, 0, 0], strip = (a, b2, za, zb) => out.push(face([[x, a, za], [x, b2, za], [x, b2, zb], [x, a, zb]], seam, n));
    const yd0 = yC - 0.05, yd1 = yC - 1.0;
    strip(yd1, yd1 + 0.012, 0.5, 2.2); strip(yd0 - 0.012, yd0, 0.5, zBelt);
    out.push(face([[x, yd1 + 0.08, zBelt + 0.05], [x, yd0 - 0.1, zBelt + 0.05], [x, yS + 0.2, 2.08], [x, yd1 + 0.08, 2.08]].map((p) => [p[0] - s * 0.031, p[1], p[2]]), M('glass', 'glass', C.glass), n));
    if (s > 0) { const ya = yd1 - 1.2; strip(ya, ya + 0.012, 0.5, 2.3); out.push(face([[x - 0.031, ya + 0.12, 1.6], [x - 0.031, yd1 - 0.1, 1.6], [x - 0.031, yd1 - 0.1, 2.1], [x - 0.031, ya + 0.12, 2.1]], M('glass', 'glass', C.glass), n)); }
    out.push(...chequer({ o: [x, s > 0 ? yT + 0.1 : yC - 0.1, 0.85], u: s > 0 ? Y : neg(Y), v: Z, w: yC - yT - 0.2, h: 0.36, n }));
    out.push(...band([x - s * 0.031, s > 0 ? yT + 0.1 : yC - 0.6, 2.3], s > 0 ? Y : neg(Y), Z, yC - yT - 0.7, 0.12, n, own('body.band', CC.hivis, 'milPaint')));
  }
  out.push(face([[-0.006, yT - 0.004, 0.7], [0.006, yT - 0.004, 0.7], [0.006, yT - 0.004, H - 0.2], [-0.006, yT - 0.004, H - 0.2]], seam, neg(Y)));
  for (const s of [-1, 1]) { const [a, b2] = xs(s, 0.1, hw - 0.18); out.push(face([[a, yT - 0.006, 1.7], [b2, yT - 0.006, 1.7], [b2, yT - 0.006, 2.3], [a, yT - 0.006, 2.3]], M('glass', 'glass', C.glass), neg(Y))); }
  out.push(...chequer({ o: [hw - 0.08, yT - 0.006, 0.85], u: neg(X), v: Z, w: 2 * hw - 0.16, h: 0.36, n: neg(Y) }));
  // (its light bar over the screen, its lights at the roof's rear corners)
  out.push(...lightBar([0, yRf - 0.35, H - 0.17], { width: 1.4, colours: [CC.blue, CC.blue], depth: 0.26 }));
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.15), yT - 0.006, H - 0.2], neg(Y), 0.18, 0.1, 'tail', 'corner.lamp'));
  for (const s of [-1, 1]) for (const y of [yf, yr]) out.push(...guard(y, r, r + 0.06, 0.1, Math.PI - 0.1, ...xs(s, hw - 0.3, hw - 0.02), dark('arch')));
  const anchors = [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * (hw - 0.03), yC - 0.15, zBelt + 0.15], out: sd, up: Z },
      { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yr - r - 0.08, 0.55], out: neg(Y), up: Z },
      { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.004 - 0.031), yr + 0.9, 2.0], out: sd, up: Z, h: 0.18 },
    ];
  });
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.6, tub: { x: hw, y: [yT, yC], z: [0.45, 0.9] } } };
}

export const EMERGENCY_BODIES = Object.freeze({ fireEngine, ambulance, paramedic });

const TRUCK = [
  ['post.L', 'mirror'], ['post.R', 'mirror'], ['sill.L', 'step', { drop: 1.3 }], ['sill.R', 'step', { drop: 1.3 }],
  ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['flap.L', 'mudFlap', { drop: 0.6 }], ['flap.R', 'mudFlap', { drop: 0.6 }],
];
/** Each emergency body's kit (mil-fittings.js cards on its anchors). */
export const EMERGENCY_KITS = Object.freeze({
  fireEngine: Object.freeze([...TRUCK]),
  ambulance: Object.freeze([['post.L', 'mirror'], ['post.R', 'mirror'], ['flap.L', 'mudFlap', { drop: 0.45 }], ['flap.R', 'mudFlap', { drop: 0.45 }]]),
  paramedic: Object.freeze([['post.L', 'mirror'], ['post.R', 'mirror']]),
});
