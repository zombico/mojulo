/**
 * THE FIELD'S VEHICLES in the form render (road-form.js): a military class's realistic body, built from the hull kit
 * (mil-hull.js) at its class's true numbers (roads/vehicles.js), in place of a road loft. A field vehicle is made, not
 * styled: flat plates with rolled edges, bent tube, a frame you can see under it, every part where it would be for the
 * job it does. Its look is its surface (camo, wear and grime come after the body) and the light of where it stands.
 *
 *   utility    the light utility 4x4: a ladder frame and its axles; a flat bonnet on a piano hinge, held by rubber
 *              latches, its face a slotted grille between round lamps in wire guards over blackout markers; flat
 *              fenders over open wheels; a cowl, and a split windscreen in its frame, the wipers hung from the top; an
 *              open tub whose sides and doorways are rimmed by a rolled edge, its rear wheels in wheelhouses, a rear
 *              panel with its lamps; canvas seats, a dash and its gauges, the wheel on its column; a roll bar braced to
 *              the rear; welds at the tub's corners and the fenders' roots, bolts and rivets along the beams and plates
 *              Its kit (KITS): the spare on the bonnet, a jerry can racked each side of the rear panel, a shovel and an
 *              axe along the left flank, the whip at the right rear, grab bars, steps under the doorways, mud flaps, red
 *              D-rings on the front bumper and the pintle behind, a mirror on the screen post, a rolled tarp on the rear
 *              panel (most carry one), a saddle tank under the right doorway
 *
 *   MILITARY_CLASSES                  physics class → its body (the classes built here; the others wait, sheet.js
 *                                     UNBUILT)
 *   militaryAxles(cls)                → the axles' stations along the body (+y forward, the body centred)
 *   militaryBody(cls, { seed?, r?, tyreW?, livery? }) → { hull, fittings, anchors, livery? }: form faces { corners, part,
 *                                     material, albedo,
 *                                     outNormal, cornerNormals, edge?, fitting? }, the hull at the class's size and the
 *                                     fittings its kit sets on its anchors (KITS, mil-fittings.js cards), rolled from the
 *                                     seed; its livery (livery-cut.js: mono or a camo, its stencils) cut into the paint
 *   KITS                              each body's kit: [anchor, card, { maybe?, …the card's words }]
 *   MIL_MATERIALS                     the road car's slots and the field's own: its matte paint, canvas, bare steel,
 *                                     weld, the frame's dark steel
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic (the seed's dice choose among the kit: a can's tone, a whip's length, whether it carries a tarp).
 */
import { VEHICLES } from '../roads/vehicles.js';
import { ROAD_MATERIALS } from './road-form.js';
import { plate, tube, bend, bolts, weld, flatNormals } from './mil-hull.js';
import { fit } from './mil-fittings.js';
import { readLivery, paintLivery, stencilMarks, liveryBase } from './livery-cut.js';
import { mulberry32 } from '../vegetation/grow.js';

export const MILITARY_CLASSES = Object.freeze({ utility4x4: 'utility' });

export const MIL_MATERIALS = Object.freeze({
  ...ROAD_MATERIALS,
  // (a field vehicle's paint is flat: no clearcoat, a broad soft highlight; canvas drinks the light; the bare steel a
  // chip or a rubbed edge shows; a weld's rough bead; the frame's and the axles' dark steel)
  milPaint: Object.freeze({ metalness: 0.05, roughness: 0.72 }),
  canvas: Object.freeze({ metalness: 0, roughness: 0.95 }),
  worn: Object.freeze({ metalness: 0.85, roughness: 0.42 }),
  weld: Object.freeze({ metalness: 0.1, roughness: 0.86 }),
  steel: Object.freeze({ metalness: 0.6, roughness: 0.55 }),
  // (caked mud: the wear's, mil-wear.js)
  mud: Object.freeze({ metalness: 0, roughness: 0.96 }),
});

// the colours, unlit (the page lights them): olive drab, its frame a shade down, the canvas, the black parts
const C = Object.freeze({
  olive: '#4b5320', frame: '#363b1a', canvas: '#5f5b43', black: '#1b1c19', rubber: '#1a1b1d', glass: '#24302f',
  lamp: '#e9edf0', tail: '#9a1a17', amber: '#c9902a', gauge: '#101112', steel: '#4a4c47',
});
const M = (part, material, albedo) => ({ part, material, albedo });
const paint = (part) => M(part, 'milPaint', C.olive);

/** Where each axle stands (+y forward), from the class's wheelbase and its overhang ahead. */
export function militaryAxles(cls) {
  const v = VEHICLES[cls];
  if (MILITARY_CLASSES[cls] === 'utility') { const yf = v.L / 2 - 0.75; return [yf, yf - v.wheelbase]; }
  throw new Error(`car-designer: '${cls}' is not a military class built yet (${Object.keys(MILITARY_CLASSES).join(', ')})`);
}

// a mirrored pair: what f(s) builds for s = −1 (left) and s = +1 (right)
const pair = (f) => [...f(-1), ...f(1)];
// a span of x for one side: from a to b on the right, mirrored on the left
const xs = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// ── the light utility 4x4 ───────────────────────────────────────────────────────
function utility(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, [yf, yr] = militaryAxles(cls), r = v.wheelRadius;
  // (the tub's rear panel stands short of the tail: the cans and the pintle hang behind it, inside the class's length)
  const yN = v.L / 2, yT = -v.L / 2, yR = yT + 0.2, out = [];
  const P = (o) => out.push(...plate(o));
  // ── the frame and the running gear, seen from low
  for (const s of [-1, 1]) { const [a, b] = xs(s, 0.38, 0.48); P({ axis: 'y', profile: rect(a, b, 0.4, 0.56), from: yT + 0.18, to: yN - 0.2, r: 0.01, seg: 1, look: M('frame', 'milPaint', C.frame) }); }
  for (const y of [yN - 0.26, yT + 0.25]) P({ axis: 'x', profile: rect(y - 0.05, y + 0.05, 0.42, 0.54), from: -0.48, to: 0.48, r: 0.008, seg: 1, look: M('frame', 'milPaint', C.frame) });
  for (const y of [yf, yr]) {
    out.push(...tube([[-0.66, y, r], [0.66, y, r]], 0.05, { sides: 10, look: M('axle', 'steel', C.steel) }));
    out.push(...tube([[0.08, y - 0.13, r], [0.08, y + 0.09, r]], 0.12, { sides: 12, look: M('axle', 'steel', C.steel) }));
  }
  // ── the bumpers: steel channel beams, bolted to the frame
  P({ axis: 'x', profile: rect(yN - 0.14, yN, 0.48, 0.66), from: -hw, to: hw, r: 0.012, seg: 1, look: paint('bumper') });
  out.push(...bolts([-0.46, -0.4, 0.4, 0.46].flatMap((x) => [[x, yN, 0.53], [x, yN, 0.61]]), [0, 1, 0], { look: paint('bolt') }));
  P({ axis: 'x', profile: rect(yR - 0.11, yR - 0.03, 0.48, 0.62), from: -0.72, to: 0.72, r: 0.012, seg: 1, look: paint('bumper') });
  // ── the bonnet: a flat plate on a piano hinge at the cowl, its rubber latches at the sides
  // (as wide as the engine between the front tyres: the fenders cover the wheels)
  const yb = yN - 0.14, yc = 0.64, bw = v.track / 2 - v.wheelRadius * 0.42;
  P({ axis: 'x', profile: [[yc, 0.74], [yb, 0.74], [yb, 1.03], [yb - 0.06, 1.07], [yc, 1.13]], from: -bw, to: bw, r: 0.03, seg: 2, look: paint('bonnet') });
  out.push(...tube([[-bw + 0.04, yc + 0.02, 1.135], [bw - 0.04, yc + 0.02, 1.135]], 0.012, { sides: 8, look: paint('bonnet.hinge') }));
  for (const s of [-1, 1]) {
    P({ axis: 'x', profile: rect(yb - 0.3, yb - 0.25, 0.9, 1.06), from: s * bw, to: s * (bw + 0.013), r: 0.004, seg: 1, look: M('bonnet.latch', 'rubber', C.rubber) });
    out.push(...tube([[s * (bw + 0.008), yb - 0.275, 0.9], [s * (bw + 0.02), yb - 0.275, 0.86], [s * (bw + 0.02), yb - 0.275, 0.82]], 0.008, { sides: 6, look: M('bonnet.latch', 'steel', C.steel) }));
  }
  // ── the face: a slotted grille between round lamps in wire guards, the blackout markers under them
  for (let i = 0; i < 7; i++) { const x = -0.3 + i * 0.1; P({ axis: 'y', profile: rect(x - 0.026, x + 0.026, 0.8, 0.99), from: yb - 0.004, to: yb + 0.004, r: 0.003, seg: 1, look: M('grille', 'carbon', C.black) }); }
  for (const s of [-1, 1]) {
    const x = s * (bw - 0.14), z = 0.9;
    out.push(...tube([[x, yb - 0.01, z], [x, yb + 0.045, z]], 0.088, { sides: 18, look: (role) => (role === 'cap' ? M('headlamp', 'lamp', C.lamp) : paint('headlamp.bucket')) }));
    for (const dx of [-0.05, 0, 0.05]) out.push(...tube(bend([[x + dx, yb + 0.005, z - 0.11], [x + dx, yb + 0.09, z - 0.1], [x + dx, yb + 0.09, z + 0.1], [x + dx, yb + 0.005, z + 0.11]], 0.025, 3), 0.007, { sides: 6, look: paint('headlamp.guard') }));
    P({ axis: 'y', profile: rect(x - 0.045, x + 0.045, 0.765, 0.795), from: yb, to: yb + 0.016, r: 0.003, seg: 1, look: (role) => (role === 'cap' ? M('marker', 'marker', C.amber) : M('marker.bezel', 'carbon', C.black)) });
  }
  // ── the fenders: flat plates over open wheels, a lip down at the front; welded to the cowl
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, bw, hw);
    P({ axis: 'x', profile: rect(yc - 0.02, yb, 0.95, 0.99), from: a, to: b, r: 0.012, seg: 1, look: paint('fender') });
    P({ axis: 'x', profile: [[yb - 0.04, 0.95], [yN - 0.04, 0.8], [yN - 0.01, 0.82], [yb, 0.99]], from: a, to: b, r: 0.008, seg: 1, look: paint('fender') });
    out.push(...weld([a + 0.01, yc, 0.99], [b - 0.01, yc, 0.99], [0, 1, 1], { look: M('weld', 'weld', C.olive) }));
    // (its outer edge turned down: a flange that gives the plate its depth)
    const [fa, fb] = xs(s, hw - 0.022, hw);
    P({ axis: 'x', profile: rect(yc - 0.02, yb - 0.02, 0.89, 0.99), from: fa, to: fb, r: 0.008, seg: 1, look: paint('fender.flange') });
  }
  // ── the cowl, the dash behind it and its gauges, the wheel on its column (the driver sits on the left)
  const yd = 0.36;
  P({ axis: 'x', profile: [[yd, 0.62], [yc, 0.62], [yc, 1.14], [yd, 1.17]], from: -hw, to: hw, r: 0.02, seg: 2, look: paint('cowl') });
  for (const [x, rr] of [[-0.5, 0.05], [-0.36, 0.05], [-0.22, 0.035], [0.12, 0.035]]) out.push(...tube([[x, yd + 0.004, 1.05], [x, yd - 0.012, 1.05]], rr, { sides: 12, look: (role) => (role === 'cap' ? M('gauge', 'glass', C.gauge) : M('gauge.bezel', 'carbon', C.black)) }));
  const col0 = [-0.42, yd - 0.01, 0.98], col1 = [-0.42, yd - 0.3, 1.16], dir = [0, -0.3, 0.18], dl = Math.hypot(dir[1], dir[2]);
  out.push(...tube([col0, col1], 0.022, { sides: 8, look: M('steering.column', 'carbon', C.black) }));
  {
    // the rim: a ring square to the column, round its end; three spokes in to the boss
    const t = [0, dir[1] / dl, dir[2] / dl], w = [0, t[2], -t[1]], R = 0.19;
    const at = (a) => [col1[0] + R * Math.cos(a), col1[1] + R * Math.sin(a) * w[1], col1[2] + R * Math.sin(a) * w[2]];
    out.push(...tube(Array.from({ length: 25 }, (_, k) => at((2 * Math.PI * k) / 24)), 0.016, { sides: 8, caps: false, look: M('steering.rim', 'carbon', C.black) }));
    for (const a of [Math.PI / 2, Math.PI * (7 / 6), Math.PI * (11 / 6)]) out.push(...tube([col1, at(a)], 0.01, { sides: 6, look: M('steering.spoke', 'carbon', C.black) }));
  }
  // ── the windscreen: a split pane in its frame, raked a little back; the wipers hung from its top
  const S0 = [yd + 0.04, 1.17], S1 = [yd - 0.04, 1.66], wx = 0.8;
  const along = [S1[0] - S0[0], S1[1] - S0[1]], al = Math.hypot(...along), au = [along[0] / al, along[1] / al], an = [au[1], -au[0]];
  const strip = (t0, t1, d0, d1) => [[S0[0] + au[0] * t0 + an[0] * d0, S0[1] + au[1] * t0 + an[1] * d0], [S0[0] + au[0] * t1 + an[0] * d0, S0[1] + au[1] * t1 + an[1] * d0], [S0[0] + au[0] * t1 + an[0] * d1, S0[1] + au[1] * t1 + an[1] * d1], [S0[0] + au[0] * t0 + an[0] * d1, S0[1] + au[1] * t0 + an[1] * d1]];
  const fr = 0.045;
  P({ axis: 'x', profile: strip(0, fr, -0.02, 0.02), from: -wx, to: wx, r: 0.008, seg: 1, look: paint('screen.frame') });
  P({ axis: 'x', profile: strip(al - fr, al, -0.02, 0.02), from: -wx, to: wx, r: 0.008, seg: 1, look: paint('screen.frame') });
  for (const s of [-1, 1]) P({ axis: 'x', profile: strip(0, al, -0.02, 0.02), from: s * wx, to: s * (wx - fr), r: 0.008, seg: 1, look: paint('screen.frame') });
  P({ axis: 'x', profile: strip(fr, al - fr, -0.015, 0.015), from: -0.018, to: 0.018, r: 0.005, seg: 1, look: paint('screen.frame') });
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.018, wx - fr);
    P({ axis: 'x', profile: strip(fr, al - fr, -0.004, 0.004), from: a, to: b, look: M('glass', 'glass', C.glass) });
    // (a wiper: its arm from the top bar, its blade down the pane)
    const x = s * 0.4, top = [S0[0] + au[0] * (al - fr) + an[0] * 0.03, S0[1] + au[1] * (al - fr) + an[1] * 0.03], low = [S0[0] + au[0] * (al - 0.32) + an[0] * 0.012, S0[1] + au[1] * (al - 0.32) + an[1] * 0.012];
    out.push(...tube([[x, top[0], top[1]], [x, low[0], low[1]]], 0.006, { sides: 6, look: M('wiper', 'carbon', C.black) }));
    // (the frame's hinge knuckle at its foot, where it folds flat onto the bonnet)
    out.push(...tube([[s * (wx - 0.04), S0[0], S0[1] + 0.01], [s * (wx + 0.02), S0[0], S0[1] + 0.01]], 0.018, { sides: 8, look: paint('screen.hinge') }));
  }
  // ── the tub: its floor, its sides open at the doorways, the rear panel, the wheelhouses; a rolled rim round its top
  const zF = 0.62, zB = 1.1, dA = 0.33, dB = -0.3, aA = yr + 0.5, aB = yr - 0.5, zA = 0.95;
  P({ axis: 'z', profile: rect(-hw + 0.03, hw - 0.03, yR + 0.02, yd), from: zF - 0.03, to: zF, look: paint('tub.floor') });
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, hw - 0.03, hw), side = (y0, y1, z0, z1) => P({ axis: 'x', profile: rect(y0, y1, z0, z1), from: a, to: b, r: 0.012, seg: 1, look: paint('tub.side') });
    side(dB, dA, zF, 0.8);
    side(aA, dB, zF, zB);
    side(aB, aA, zA, zB);
    side(yR, aB, zF, zB);
    // the wheelhouse inside the tub, over the rear wheel
    const [c, d] = xs(s, 0.6, hw - 0.03);
    P({ axis: 'x', profile: rect(aB, aA, zA - 0.03, zA + 0.02), from: c, to: d, r: 0.01, seg: 1, look: paint('tub.wheelhouse') });
    P({ axis: 'x', profile: rect(aB, aA, zF, zA + 0.02), from: s * 0.6, to: s * 0.63, r: 0.008, seg: 1, look: paint('tub.wheelhouse') });
    // the rolled rim: down the cowl's edge, along the doorway's sill, up and back along the side, round to the rear
    const xr = s * (hw - 0.012);
    out.push(...tube(bend([[xr, dA + 0.02, 1.15], [xr, dA, 0.8], [xr, dB, 0.8], [xr, dB - 0.04, zB], [xr, yR + 0.02, zB], [s * (bw + 0.05), yR + 0.02, zB]], 0.07, 4), 0.016, { sides: 8, look: paint('tub.rim') }));
    // (and round the rear wheel's opening)
    out.push(...tube(bend([[xr, aA, zF + 0.01], [xr, aA, zA], [xr, aB, zA], [xr, aB, zF + 0.01]], 0.09, 4), 0.014, { sides: 8, look: paint('tub.rim') }));
    // the rivets along the side's foot, the weld up the rear corner
    const row = (y0, y1, step = 0.1) => { const n = Math.max(1, Math.round((y1 - y0) / step)); return Array.from({ length: n + 1 }, (_, i) => [s * hw, y0 + ((y1 - y0) * i) / n, zF + 0.045]); };
    out.push(...bolts([...row(dB + 0.05, dA - 0.05), ...row(aA + 0.05, dB - 0.05), ...row(yR + 0.06, aB - 0.05)], [s, 0, 0], { r: 0.008, h: 0.004, look: paint('rivet') }));
    out.push(...weld([s * (hw - 0.006), yR + 0.006, zF + 0.03], [s * (hw - 0.006), yR + 0.006, zB - 0.02], [s, -1, 0], { look: M('weld', 'weld', C.olive) }));
  }
  P({ axis: 'y', profile: rect(-hw, hw, zF, zB), from: yR - 0.03, to: yR, r: 0.012, seg: 1, look: paint('tub.rear') });
  for (const s of [-1, 1]) {
    P({ axis: 'y', profile: rect(s * 0.8 - 0.055, s * 0.8 + 0.055, 0.78, 0.88), from: yR - 0.045, to: yR - 0.03, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('taillamp', 'tail', C.tail) : M('taillamp.bezel', 'carbon', C.black)) });
    P({ axis: 'y', profile: rect(s * 0.8 - 0.035, s * 0.8 + 0.035, 0.73, 0.76), from: yR - 0.045, to: yR - 0.03, r: 0.004, seg: 1, look: (role) => (role === 'cap' ? M('marker', 'marker', C.amber) : M('marker.bezel', 'carbon', C.black)) });
  }
  out.push(...bolts([-0.6, -0.2, 0.2, 0.6].map((x) => [x, yR - 0.03, zB - 0.05]), [0, -1, 0], { r: 0.009, h: 0.005, look: paint('bolt') }));
  // ── the seats: two canvas buckets ahead, a bench behind across the wheelhouses
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.16, 0.68);
    P({ axis: 'x', profile: rect(-0.58, -0.08, 0.8, 0.93), from: a, to: b, r: 0.035, seg: 2, look: M('seat', 'canvas', C.canvas) });
    P({ axis: 'x', profile: [[-0.66, 0.9], [-0.55, 0.9], [-0.5, 1.4], [-0.61, 1.42]], from: a + 0.02, to: b - 0.02, r: 0.03, seg: 2, look: M('seat', 'canvas', C.canvas) });
    out.push(...tube([[s * 0.42, -0.33, zF], [s * 0.42, -0.33, 0.8]], 0.02, { sides: 6, look: M('seat.frame', 'steel', C.steel) }));
  }
  P({ axis: 'x', profile: rect(aB + 0.05, aA - 0.05, zA + 0.02, zA + 0.12), from: -0.58, to: 0.58, r: 0.035, seg: 2, look: M('seat', 'canvas', C.canvas) });
  P({ axis: 'x', profile: [[yR + 0.03, zA + 0.08], [yR + 0.13, zA + 0.08], [yR + 0.16, zB + 0.28], [yR + 0.06, zB + 0.3]], from: -0.58, to: 0.58, r: 0.03, seg: 2, look: M('seat', 'canvas', C.canvas) });
  // ── the roll bar: a hoop behind the front seats, braced back to the rear corners, its feet bolted down
  const yh = -0.72, zt = v.H - 0.03, xh = hw - 0.05;
  out.push(...tube(bend([[-xh, yh, zB], [-xh, yh, zt], [xh, yh, zt], [xh, yh, zB]], 0.14, 5), 0.03, { sides: 10, look: paint('rollbar') }));
  for (const s of [-1, 1]) {
    out.push(...tube([[s * xh, yh - 0.02, zt - 0.1], [s * xh, yR + 0.08, zB + 0.02]], 0.026, { sides: 10, look: paint('rollbar') }));
    for (const y of [yh, yR + 0.08]) {
      P({ axis: 'z', profile: rect(s * xh - 0.05, s * xh + 0.05, y - 0.05, y + 0.05), from: zB - 0.005, to: zB + 0.012, r: 0.004, seg: 1, look: paint('rollbar.foot') });
      out.push(...bolts([[-0.032, -0.032], [0.032, -0.032], [0.032, 0.032], [-0.032, 0.032]].map(([dx, dy]) => [s * xh + dx, y + dy, zB + 0.012]), [0, 0, 1], { r: 0.008, h: 0.006, look: paint('bolt') }));
    }
  }
  // ── the anchors its fittings are set on (mil-fittings.js): where a field vehicle carries what it carries
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = (a) => a.map((q) => -q);
  const bonnetZ = (y) => 1.13 - ((y - yc) / (yb - 0.06 - yc)) * 0.06;
  const postT = 0.6, post = [S0[0] + au[0] * al * postT, S0[1] + au[1] * al * postT];
  const anchors = [
    { id: 'bonnet', kind: 'bonnet', at: [0, 1.3, bonnetZ(1.3)], out: Z, up: Y },
    ...[-1, 1].flatMap((s) => {
      const L = s < 0 ? 'L' : 'R', side = s < 0 ? neg(X) : X;
      return [
        { id: `rear.${L}`, kind: 'panel', at: [s * 0.5, yR - 0.03, zF + 0.04], out: neg(Y), up: Z },
        { id: `flank.${L}`, kind: 'flank', at: [s * hw, s < 0 ? yr + 0.05 : yR + 0.15, s < 0 ? 1.03 : 0.98], out: side, up: Z },
        { id: `grab.${L}`, kind: 'flank', at: [s * hw, (aA + dB) / 2, 0.98], out: side, up: Z },
        { id: `sill.${L}`, kind: 'sill', at: [s * hw, (dA + dB) / 2, 0.55], out: side, up: Z },
        { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yR + 0.12, zF], out: neg(Y), up: Z },
        { id: `bumper.F${L}`, kind: 'bumper', at: [s * 0.62, yN, 0.57], out: Y, up: Z },
        { id: `bumper.R${L}`, kind: 'bumper', at: [s * 0.55, yR - 0.11, 0.55], out: neg(Y), up: Z },
        { id: `post.${L}`, kind: 'post', at: [s * wx, post[0], post[1]], out: side, up: Z },
        { id: `rail.${L}`, kind: 'rail', at: [s * 0.48, 0, 0.56], out: side, up: Z },
      ];
    }),
    { id: 'bumper.RC', kind: 'bumper', at: [0, yR - 0.11, 0.55], out: neg(Y), up: Z },
    { id: 'top', kind: 'top', at: [0, yR - 0.015, zB], out: Z, up: neg(Y) },
    // (where its livery's stencils go, livery-cut.js: a number each side and on the bumper, the emblem behind and on the
    // bonnet's sides)
    ...[-1, 1].flatMap((s) => [
      { id: `mark.${s < 0 ? 'L' : 'R'}`, kind: 'mark', role: 'number', at: [s * hw, (aA + dB) / 2, 0.8], out: s < 0 ? neg(X) : X, up: Z, h: 0.1 },
      { id: `mark.bonnet.${s < 0 ? 'L' : 'R'}`, kind: 'mark', role: 'emblem', at: [s * bw, yb - 0.55, 1.05], out: s < 0 ? neg(X) : X, up: Z, h: 0.07 },
    ]),
    { id: 'mark.bumper', kind: 'mark', role: 'number', at: [-0.2, yN, 0.57], out: Y, up: Z, h: 0.08 },
    { id: 'mark.rear', kind: 'mark', role: 'emblem', at: [0, yR - 0.03, 0.9], out: neg(Y), up: Z, h: 0.09 },
  ];
  // (its zones, for the wear's grounding: mil-wear.js)
  return { faces: out, anchors, zones: { floor: zF, tub: { x: hw, y: [yR, dA], z: [zF, zB] } } };
}

/** What each class carries, anchor by anchor (mil-fittings.js cards); `maybe` a share of the vehicles that carry it,
 *  rolled from the seed, and `opts` the card's own words. */
export const KITS = Object.freeze({
  utility: Object.freeze([
    ['bonnet', 'spareWheel'], ['rear.L', 'jerryCans'], ['rear.R', 'jerryCans'], ['flank.L', 'pioneerTools'],
    ['flank.R', 'antenna', { lean: -1 }], ['grab.L', 'grabHandle'], ['grab.R', 'grabHandle'], ['sill.L', 'step'], ['sill.R', 'step'],
    ['flap.L', 'mudFlap'], ['flap.R', 'mudFlap'], ['bumper.FL', 'shackle'], ['bumper.FR', 'shackle'], ['bumper.RC', 'pintle'],
    ['post.L', 'mirror'], ['top', 'tarpRoll', { maybe: 0.7 }], ['rail.R', 'fuelTank'],
  ]),
});
const CAN_TONES = Object.freeze(['#4f5726', '#4f5726', '#8a7a55']);

/** A military class's body (its hull, every face with its corner normals: a plate's own, worked out; a fitting's flat)
 *  and its fittings, its kit's cards on its anchors, rolled from the seed; its livery (livery-cut.js) cut into the paint
 *  of both at once, so a blotch runs on from the hull onto what is fitted to it, and its stencils on its mark anchors. */
export function militaryBody(cls, { seed = 1, r, tyreW, livery } = {}) {
  const kind = MILITARY_CLASSES[cls];
  if (kind !== 'utility') throw new Error(`car-designer: '${cls}' is not a military class built yet (${Object.keys(MILITARY_CLASSES).join(', ')})`);
  const L = readLivery(livery);
  const { faces, anchors, zones } = utility(cls), byId = new Map(anchors.map((a) => [a.id, a]));
  const rnd = mulberry32((seed * 2654435761 + 31) >>> 0), v = VEHICLES[cls];
  const fittings = [];
  for (const [id, card, opts = {}] of KITS[kind]) {
    const { maybe, ...words } = opts, roll = rnd();
    if (maybe !== undefined && roll >= maybe) continue;
    const ctx = { r: r ?? v.wheelRadius, tyreW: tyreW ?? 0.3, paint: C.olive, seed, ...words };
    if (card === 'jerryCans') ctx.tones = [CAN_TONES[Math.floor(rnd() * CAN_TONES.length)]];
    if (card === 'antenna') ctx.whip = 1.3 + 0.4 * rnd();
    fittings.push(...fit(byId.get(id), card, ctx).map((f) => ({ ...f, fitting: card })));
  }
  const all = flatNormals([...faces, ...fittings]);
  if (!L) return { hull: all.filter((f) => !f.fitting), fittings: all.filter((f) => f.fitting), anchors, zones };
  // (the frame and the running gear in the livery's base, a shade down: a sand body is not carried on an olive frame)
  const shade = `#${[1, 3, 5].map((i) => Math.round(parseInt(liveryBase(L).slice(i, i + 2), 16) * 0.62).toString(16).padStart(2, '0')).join('')}`;
  const cut = paintLivery(all, L, { base: C.olive, seed }).map((f) => (f.albedo === C.frame ? { ...f, albedo: shade } : f));
  const marks = stencilMarks(anchors, L, { seed }).map((f) => ({ ...f, fitting: 'mark' }));
  return { hull: cut.filter((f) => !f.fitting), fittings: flatNormals([...cut.filter((f) => f.fitting), ...marks]), anchors, zones, livery: L };
}
