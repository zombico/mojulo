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
 *   cargo      the six-wheeled cargo truck: a ladder frame on three axles and their leaf springs; a heavy bumper with a
 *              winch behind it; a long bonnet louvred at its sides, its grille behind a tube guard; flat fenders with round
 *              lamps on their noses; a steel cab (its doors' shut lines, framed glass, the wipers parked, a roof hatch, a
 *              small rear window) and an exhaust stack up its back corner; a bed of plank drop sides between stakes, a
 *              headboard and a chained tailgate; five bows and the canvas tilt over them, sagging between them, roped
 *              and tied along its foot, its rear flap rolled and strapped. Its kit: the spare behind the cab, a saddle tank
 *              and a stowage box on the rails, two cans and the tools on the bed's sides, the whip, the grab bars and
 *              steps at the doors, mud flaps behind each axle group, D-rings, the pintle, mirrors on both posts
 *
 *   carrier    the eight-wheeled armoured carrier, its hull three slabs (mil-hull.js): a narrow lower hull between the
 *              wheels on a shallow V belly; the troop compartment over it, its sponsons out over the wheels, an upright
 *              band for the bins and its sides raked in to the roof; ahead of it, a step lower, the driver's and the
 *              engine's roof and the glacis down to the nose. Four axles in two pairs on their arms and dampers; the
 *              rear ramp and the door in it; the driver's hatch and its blocks, the commander's cupola ringed with
 *              blocks, two troop hatches and their stops, a hatch in each side; an empty mount ring; bins along the
 *              sponsons; the engine's grille deck, the exhaust's shield, the tow cable, the glacis's bolted plate and its
 *              guarded lamps. Its kit: cans by the ramp, the tools, two whips, grab bars, steps, mud flaps, shackles,
 *              the pintle, mirrors, a rolled tarp
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
 *                                     weld, the frame's dark steel, a vision block's glass
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic (the seed's dice choose among the kit: a can's tone, a whip's length, whether it carries a tarp).
 */
import { VEHICLES } from '../roads/vehicles.js';
import { ROAD_MATERIALS, smoothForm } from './road-form.js';
import { plate, tube, bend, bolts, weld, flatNormals, face, slab, place } from './mil-hull.js';
import { fit } from './mil-fittings.js';
import { runningGear, linkFaces, TRACK_DEPTH } from './mil-track.js';
import { readLivery, paintLivery, stencilMarks, liveryBase } from './livery-cut.js';
import { mulberry32 } from '../vegetation/grow.js';

export const MILITARY_CLASSES = Object.freeze({ utility4x4: 'utility', cargo6x6: 'cargo', apc8x8: 'carrier', lightTank: 'lightTank', trackedCarrier: 'trackedCarrier' });

/** A field vehicle's size for its surface: its camo's blotches and its mud's heights by it (a wheel's radius over a
 *  4x4's; a tracked class by its wheeled peer's, its road wheels being small). */
export const sizeOf = (cls) => (VEHICLES[cls].running === 'track' ? 0.6 : VEHICLES[cls].wheelRadius) / 0.41;

export const MIL_MATERIALS = Object.freeze({
  ...ROAD_MATERIALS,
  // (a field vehicle's paint is flat: no clearcoat, a broad soft highlight; canvas drinks the light; the bare steel a
  // chip or a rubbed edge shows; a weld's rough bead; the frame's and the axles' dark steel)
  milPaint: Object.freeze({ metalness: 0.05, roughness: 0.72 }),
  canvas: Object.freeze({ metalness: 0, roughness: 0.95 }),
  worn: Object.freeze({ metalness: 0.85, roughness: 0.42 }),
  weld: Object.freeze({ metalness: 0.1, roughness: 0.86 }),
  steel: Object.freeze({ metalness: 0.6, roughness: 0.55 }),
  // (a vision block's armoured glass: dark, deep, a hard small highlight)
  vision: Object.freeze({ metalness: 0.3, roughness: 0.08 }),
  // (caked mud: the wear's, mil-wear.js)
  mud: Object.freeze({ metalness: 0, roughness: 0.96 }),
});

// the colours, unlit (the page lights them): olive drab, its frame a shade down, the canvas, the black parts
const C = Object.freeze({
  olive: '#4b5320', frame: '#363b1a', canvas: '#5f5b43', black: '#1b1c19', rubber: '#1a1b1d', glass: '#24302f',
  lamp: '#e9edf0', tail: '#9a1a17', amber: '#c9902a', gauge: '#101112', steel: '#4a4c47', vision: '#1f3134',
  soot: '#232220',
});
const M = (part, material, albedo) => ({ part, material, albedo });
const paint = (part) => M(part, 'milPaint', C.olive);

/** Where each axle stands (+y forward), from the class's wheelbase and its overhang ahead. */
export function militaryAxles(cls) {
  const v = VEHICLES[cls];
  if (MILITARY_CLASSES[cls] === 'utility') { const yf = v.L / 2 - 0.75; return [yf, yf - v.wheelbase]; }
  // (a truck's front axle under its bonnet, its two rear axles a tandem about the wheelbase's end, 1.4 m apart)
  if (MILITARY_CLASSES[cls] === 'cargo') { const yf = v.L / 2 - 1.0, yt = yf - v.wheelbase; return [yf, yt + 0.7, yt - 0.7]; }
  // (a carrier's four axles, its wheelbase its first to its last as its sheet quotes it: two pairs, the gap between them
  // wider, its nose's overhang a little longer than its tail's)
  if (MILITARY_CLASSES[cls] === 'carrier') { const y1 = v.L / 2 - 1.45, p = 0.29 * v.wheelbase; return [y1, y1 - p, y1 - v.wheelbase + p, y1 - v.wheelbase]; }
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

// ── the six-wheeled cargo truck ─────────────────────────────────────────────────
// a canvas tilt over a bed, its section a rounded box from the bed's sides to its roof, sagging between its bows (the
// roof down, the sides in), tied along its foot; the rear flap rolled up and strapped. The canvas's faces are smoothed
// (a soft cloth); its bows are tubes under it, seen from behind
function tilt({ y0, y1, bows, z0, z1, hw, sag = 0.06, look }) {
  const rc = 0.16, seg = 3, prof = [];
  // the section, from the left foot up and over to the right foot: [x, z, side?] (side: a point the sag pulls in)
  prof.push([-hw, z0, 0], [-hw, (z0 + z1 - rc) / 2, 1], [-hw, z1 - rc, 1]);
  for (let k = 1; k < seg; k++) { const a = Math.PI - (Math.PI / 2) * (k / seg); prof.push([-hw + rc + rc * Math.cos(a), z1 - rc + rc * Math.sin(a), 2]); }
  prof.push([-hw + rc, z1, 2], [0, z1, 2], [hw - rc, z1, 2]);
  for (let k = 1; k < seg; k++) { const a = (Math.PI / 2) * (1 - k / seg); prof.push([hw - rc + rc * Math.cos(a), z1 - rc + rc * Math.sin(a), 2]); }
  prof.push([hw, z1 - rc, 1], [hw, (z0 + z1 - rc) / 2, 1], [hw, z0, 0]);
  // the stations along it: each bay between bows sampled, the sag a sine across the bay
  const st = [];
  for (let i = 0; i + 1 < bows.length; i++) for (let k = 0; k < 4; k++) { const t = k / 4; st.push({ y: bows[i] + (bows[i + 1] - bows[i]) * t, s: sag * Math.sin(Math.PI * t) }); }
  st.push({ y: bows[bows.length - 1], s: 0 });
  const at = (pt, S) => {
    const [x, z, kind] = pt, pull = kind === 2 ? S.s : kind === 1 ? S.s * 0.6 * Math.min(1, (z - z0) / 0.4) : 0;
    return kind === 2 ? [x * (1 - S.s * 0.3 / hw), S.y, z - pull] : [x - Math.sign(x) * pull, S.y, z];
  };
  const out = [];
  for (let i = 0; i + 1 < st.length; i++) for (let k = 0; k + 1 < prof.length; k++) {
    const q = [at(prof[k], st[i]), at(prof[k + 1], st[i]), at(prof[k + 1], st[i + 1]), at(prof[k], st[i + 1])];
    const mx = (prof[k][0] + prof[k + 1][0]) / 2, mz = (prof[k][1] + prof[k + 1][1]) / 2;
    const f = face(q, look, [mx, 0, mz - (z0 + z1) / 2 + 0.3]);
    if (f) out.push(f);
  }
  // the front closed: the section at the front bow, a panel (fanned from its foot's middle)
  const front = prof.map((pt) => at(pt, { y: y1, s: 0 })), base = [0, y1, z0];
  for (let k = 0; k + 1 < front.length; k++) { const f = face([base, front[k], front[k + 1]], look, [0, 1, 0]); if (f) out.push(f); }
  void y0;
  return smoothForm(out, { crease: 50 });
}

function cargo(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, [yf, ya, yb] = militaryAxles(cls), r = v.wheelRadius;
  const yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  const fr = M('frame', 'milPaint', C.frame);
  // ── the frame, its axles on leaf springs, the cross members
  const zr0 = 0.86, zr1 = 1.1;
  for (const s of [-1, 1]) { const [a, b] = xs(s, 0.44, 0.56); P({ axis: 'y', profile: rect(a, b, zr0, zr1), from: yT + 0.12, to: yN - 0.12, r: 0.012, seg: 1, look: fr }); }
  for (const y of [yN - 0.25, 1.9, 0.2, -1.8, yT + 0.2]) P({ axis: 'x', profile: rect(y - 0.06, y + 0.06, zr0 + 0.03, zr1 - 0.03), from: -0.56, to: 0.56, r: 0.01, seg: 1, look: fr });
  for (const y of [yf, ya, yb]) {
    out.push(...tube([[-0.82, y, r], [0.82, y, r]], 0.065, { sides: 10, look: M('axle', 'steel', C.steel) }));
    out.push(...tube([[0.1, y - 0.16, r], [0.1, y + 0.12, r]], 0.17, { sides: 12, look: M('axle', 'steel', C.steel) }));
    // (the leaf springs: a stack of plates, each shorter, between the axle and the rail)
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const h = 0.65 - k * 0.12, z = r + 0.07 + k * 0.035;
      P({ axis: 'y', profile: rect(s * 0.5 - 0.045, s * 0.5 + 0.045, z, z + 0.03), from: y - h, to: y + h, r: 0.006, seg: 1, look: M('spring', 'steel', C.steel) });
    }
  }
  // ── the front: a heavy bumper, its winch behind it, a grille guard over the grille, round lamps on the fenders
  const yg = yN - 0.25;
  P({ axis: 'x', profile: rect(yN - 0.18, yN, 0.78, 1.05), from: -hw + 0.08, to: hw - 0.08, r: 0.015, seg: 1, look: paint('bumper') });
  out.push(...bolts([-0.5, -0.4, 0.4, 0.5].flatMap((x) => [[x, yN, 0.86], [x, yN, 0.97]]), [0, 1, 0], { r: 0.014, h: 0.01, look: paint('bolt') }));
  out.push(...tube([[-0.36, yN - 0.32, 0.92], [0.36, yN - 0.32, 0.92]], 0.13, { sides: 14, look: M('winch', 'steel', C.steel) }));
  out.push(...tube([[-0.3, yN - 0.32, 0.92], [0.3, yN - 0.32, 0.92]], 0.15, { sides: 14, caps: false, look: M('winch.cable', 'steel', '#2f302c') }));
  P({ axis: 'y', profile: rect(-0.16, 0.16, 0.86, 0.96), from: yN, to: yN + 0.006, look: M('winch.fairlead', 'carbon', C.black) });
  // the bonnet: a long nose to the grille, louvred at its sides, hinged at its middle
  const yc = 1.75, bw = 0.64;
  P({ axis: 'x', profile: [[yc, 1.15], [yg, 1.15], [yg, 1.72], [yg - 0.1, 1.84], [yc, 1.94]], from: -bw, to: bw, r: 0.04, seg: 2, look: paint('bonnet') });
  out.push(...tube([[0, yc + 0.05, 1.955], [0, yg - 0.15, 1.85]], 0.014, { sides: 8, look: paint('bonnet.hinge') }));
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
    const z = 1.5 + k * 0.07;
    P({ axis: 'x', profile: rect(yc + 0.6, yc + 1.25, z, z + 0.03), from: s * bw, to: s * (bw + 0.006), look: M('bonnet.louvre', 'carbon', C.black) });
  }
  for (let i = 0; i < 9; i++) { const x = -0.48 + i * 0.12; P({ axis: 'y', profile: rect(x - 0.035, x + 0.035, 1.22, 1.66), from: yg - 0.004, to: yg + 0.006, r: 0.004, seg: 1, look: M('grille', 'carbon', C.black) }); }
  const yGuard = yN - 0.08;
  for (const x of [-0.55, 0, 0.55]) out.push(...tube(bend([[x, yN - 0.12, 1.05], [x, yGuard, 1.08], [x, yGuard, 1.72], [x, yg - 0.05, 1.78]], 0.05, 3), 0.022, { sides: 8, look: paint('grille.guard') }));
  out.push(...tube([[-0.6, yGuard, 1.5], [0.6, yGuard, 1.5]], 0.02, { sides: 8, look: paint('grille.guard') }));
  // the fenders: flat over the front wheels, their fronts sloped to the bumper, a flange turned down
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, bw, hw - 0.06), [fa, fb] = xs(s, hw - 0.085, hw - 0.06);
    P({ axis: 'x', profile: rect(yc - 0.05, yg - 0.2, 1.4, 1.45), from: a, to: b, r: 0.012, seg: 1, look: paint('fender') });
    P({ axis: 'x', profile: [[yg - 0.24, 1.4], [yN - 0.2, 1.1], [yN - 0.16, 1.13], [yg - 0.2, 1.45]], from: a, to: b, r: 0.01, seg: 1, look: paint('fender') });
    P({ axis: 'x', profile: rect(yc - 0.05, yg - 0.22, 1.3, 1.45), from: fa, to: fb, r: 0.008, seg: 1, look: paint('fender.flange') });
    out.push(...weld([a, yc - 0.05, 1.45], [b, yc - 0.05, 1.45], [0, 1, 1], { look: M('weld', 'weld', C.olive) }));
    // a round lamp on the fender's nose, in its guard; the blackout marker beside it
    const x = s * 0.93, y = yg - 0.32, z = 1.56;
    out.push(...tube([[x, y - 0.1, z], [x, y + 0.04, z]], 0.1, { sides: 18, look: (role) => (role === 'cap' ? M('headlamp', 'lamp', C.lamp) : paint('headlamp.bucket')) }));
    out.push(...tube([[x, y - 0.06, 1.45], [x, y - 0.06, z - 0.08]], 0.025, { sides: 8, look: paint('headlamp.stem') }));
    for (const dx of [-0.06, 0, 0.06]) out.push(...tube(bend([[x + dx, y + 0.02, z - 0.12], [x + dx, y + 0.1, z - 0.11], [x + dx, y + 0.1, z + 0.11], [x + dx, y + 0.02, z + 0.12]], 0.03, 3), 0.008, { sides: 6, look: paint('headlamp.guard') }));
    P({ axis: 'y', profile: rect(s * 0.68 - 0.04, s * 0.68 + 0.04, 1.455, 1.49), from: yg - 0.32, to: yg - 0.3, r: 0.003, seg: 1, look: (role) => (role === 'cap' ? M('marker', 'marker', C.amber) : M('marker.bezel', 'carbon', C.black)) });
  }
  // ── the cab: a steel box on the frame, its doors' shut lines, framed glass, a hatch in the roof
  const y0c = 0.35, cw = 1.1, zc0 = 1.15, zc1 = 2.78;
  P({ axis: 'x', profile: [[y0c, zc0], [yc, zc0], [yc, 2.0], [yc - 0.06, 2.68], [yc - 0.16, zc1], [y0c + 0.06, zc1], [y0c, zc1 - 0.06]], from: -cw, to: cw, r: 0.05, seg: 2, look: paint('cab') });
  // the screen: two flat panes either side of a post, in rubber
  const screenAt = (z) => yc - 0.06 * ((z - 2.0) / 0.68) + 0.004;
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.06, cw - 0.12);
    out.push(face([[a, screenAt(2.08), 2.08], [b, screenAt(2.08), 2.08], [b, screenAt(2.6), 2.6], [a, screenAt(2.6), 2.6]], M('glass', 'glass', C.glass), [0, 1, 0.1]));
    for (const [z0, z1, x0, x1] of [[2.05, 2.08, a - 0.03, b + 0.03], [2.6, 2.63, a - 0.03, b + 0.03], [2.05, 2.63, a - 0.03, a], [2.05, 2.63, b, b + 0.03]]) out.push(face([[x0, screenAt(z0) + 0.002, z0], [x1, screenAt(z0) + 0.002, z0], [x1, screenAt(z1) + 0.002, z1], [x0, screenAt(z1) + 0.002, z1]], M('glass.seal', 'rubber', C.rubber), [0, 1, 0.1]));
    // the wipers, parked at the panes' feet
    out.push(...tube([[s * 0.3, screenAt(2.1) + 0.02, 2.1], [s * 0.3 - s * 0.32, screenAt(2.16) + 0.02, 2.16]], 0.007, { sides: 6, look: M('wiper', 'carbon', C.black) }));
    // the door: its shut line, its window in rubber, its handle and hinges
    const x = s * (cw + 0.003), dy0 = y0c + 0.22, dy1 = yc - 0.12, dz0 = zc0 + 0.12, dz1 = zc1 - 0.1, n = [s, 0, 0];
    const strip = (y0, y1, z0, z1, look) => out.push(face([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], look, n));
    const seam = M('seam', 'seal', '#151614');
    strip(dy0, dy1, dz0, dz0 + 0.012, seam); strip(dy0, dy1, dz1 - 0.012, dz1, seam); strip(dy0, dy0 + 0.012, dz0, dz1, seam); strip(dy1 - 0.012, dy1, dz0, dz1, seam);
    strip(dy0 + 0.12, dy1 - 0.1, 2.05, 2.6, M('glass', 'glass', C.glass));
    for (const [y0, y1, z0, z1] of [[dy0 + 0.1, dy1 - 0.08, 2.03, 2.05], [dy0 + 0.1, dy1 - 0.08, 2.6, 2.62], [dy0 + 0.1, dy0 + 0.12, 2.03, 2.62], [dy1 - 0.1, dy1 - 0.08, 2.03, 2.62]]) strip(y0, y1, z0, z1, M('glass.seal', 'rubber', C.rubber));
    out.push(...tube(bend([[x, dy0 + 0.1, 1.92], [x + s * 0.035, dy0 + 0.1, 1.92], [x + s * 0.035, dy0 + 0.3, 1.92], [x, dy0 + 0.3, 1.92]], 0.015, 2), 0.011, { sides: 6, look: paint('door.handle') }));
    for (const z of [1.55, 2.35]) out.push(...tube([[x + s * 0.015, dy1 - 0.02, z - 0.07], [x + s * 0.015, dy1 - 0.02, z + 0.07]], 0.018, { sides: 8, look: paint('door.hinge') }));
    out.push(...weld([s * cw, y0c + 0.01, zc0 + 0.05], [s * cw, y0c + 0.01, zc1 - 0.08], [s, -1, 0], { look: M('weld', 'weld', C.olive) }));
  }
  // the roof: a round hatch ring, its lid; a small rear window
  out.push(...tube(Array.from({ length: 21 }, (_, k) => { const a = (2 * Math.PI * k) / 20; return [-0.45 + 0.32 * Math.cos(a), 1.05 + 0.32 * Math.sin(a), zc1 + 0.03]; }), 0.03, { sides: 8, caps: false, look: paint('hatch.ring') }));
  P({ axis: 'z', profile: Array.from({ length: 14 }, (_, k) => { const a = (2 * Math.PI * k) / 14; return [-0.45 + 0.29 * Math.cos(a), 1.05 + 0.29 * Math.sin(a)]; }), from: zc1, to: zc1 + 0.05, r: 0.012, seg: 1, look: paint('hatch') });
  out.push(face([[-0.4, y0c - 0.004, 2.2], [0.4, y0c - 0.004, 2.2], [0.4, y0c - 0.004, 2.5], [-0.4, y0c - 0.004, 2.5]], M('glass', 'glass', C.glass), [0, -1, 0]));
  // the exhaust: a stack up the cab's back corner, black with soot, a shield over it
  out.push(...tube([[cw - 0.12, y0c - 0.12, zr1], [cw - 0.12, y0c - 0.12, 3.0]], 0.06, { sides: 10, look: M('exhaust', 'carbon', '#232220') }));
  P({ axis: 'z', profile: [[cw - 0.21, y0c - 0.2], [cw - 0.03, y0c - 0.2], [cw - 0.03, y0c - 0.05], [cw - 0.21, y0c - 0.05]], from: 2.3, to: 2.75, r: 0.01, seg: 1, look: paint('exhaust.shield') });
  // ── the bed: a floor on its bearers, plank drop sides between stakes, a headboard, a tailgate
  // (the bed and its tilt inside the class's width: their stakes and ties stand proud of them)
  const yb0 = yT + 0.05, yb1 = -0.25, zf = 1.38, zs = 2.0, sides = paint('bed.side'), bhw = hw - 0.035;
  P({ axis: 'z', profile: rect(-bhw, bhw, yb0, yb1), from: zf - 0.05, to: zf, r: 0.01, seg: 1, look: paint('bed.floor') });
  for (let y = yb0 + 0.25; y < yb1; y += 0.75) P({ axis: 'x', profile: rect(y - 0.05, y + 0.05, zr1, zf - 0.05), from: -bhw + 0.05, to: bhw - 0.05, r: 0.008, seg: 1, look: fr });
  const planks = (z) => [zf + 0.02, zf + 0.21, zf + 0.4].map((z0) => [z0, Math.min(z, z0 + 0.17)]);
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, bhw - 0.04, bhw);
    for (const [z0, z1] of planks(zs)) P({ axis: 'x', profile: rect(yb0, yb1, z0, z1), from: a, to: b, r: 0.01, seg: 1, look: sides });
    for (let y = yb0 + 0.04; y <= yb1; y += (yb1 - yb0 - 0.08) / 4) P({ axis: 'x', profile: rect(y - 0.04, y + 0.04, zf - 0.04, zs + 0.03), from: s * (bhw + 0.004) - (s < 0 ? 0.022 : 0), to: s * (bhw + 0.004) + (s > 0 ? 0.022 : 0), r: 0.006, seg: 1, look: paint('bed.stake') });
    // the rear fenders over the tandem, under the bed
    const [c, d] = xs(s, 0.78, bhw - 0.04);
    P({ axis: 'x', profile: rect(yb - r - 0.2, ya + r + 0.2, zf - 0.09, zf - 0.06), from: c, to: d, r: 0.006, seg: 1, look: paint('fender') });
  }
  for (const [y, n] of [[yb1, 1], [yb0, -1]]) for (const [z0, z1] of planks(zs)) P({ axis: 'y', profile: rect(-bhw, bhw, z0, z1), from: y, to: y - n * 0.04, r: 0.01, seg: 1, look: paint(n > 0 ? 'bed.headboard' : 'bed.tailgate') });
  out.push(...[-0.7, 0.7].flatMap((x) => tube([[x, yb0 - 0.03, zf + 0.12], [x, yb0 - 0.03, zs - 0.08]], 0.014, { sides: 6, look: paint('tailgate.chain') })));
  // ── the tilt: bows over the bed, the canvas over them, sagging, tied at its foot; its rear flap rolled and strapped
  const bows = Array.from({ length: 5 }, (_, k) => yb0 + 0.12 + ((yb1 - 0.05 - (yb0 + 0.12)) * k) / 4);
  const zt = v.H, canvas = M('tilt', 'canvas', C.canvas);
  for (const y of bows) out.push(...tube(bend([[-bhw + 0.05, y, zs - 0.05], [-bhw + 0.05, y, zt - 0.05], [bhw - 0.05, y, zt - 0.05], [bhw - 0.05, y, zs - 0.05]], 0.14, 4), 0.022, { sides: 8, look: paint('tilt.bow') }));
  out.push(...tilt({ y0: bows[0], y1: bows[bows.length - 1], bows, z0: zs - 0.02, z1: zt, hw: bhw + 0.01, sag: 0.055, look: canvas }));
  for (const s of [-1, 1]) {
    const x = s * (bhw + 0.018);
    out.push(...tube([[x, bows[0], zs + 0.02], [x, bows[bows.length - 1], zs + 0.02]], 0.007, { sides: 5, look: M('tilt.rope', 'canvas', '#8a7f5e') }));
    for (let y = bows[0] + 0.15; y < bows[bows.length - 1]; y += 0.38) out.push(...tube(bend([[x - s * 0.02, y, zs + 0.09], [x + s * 0.01, y, zs + 0.06], [x + s * 0.01, y, zs - 0.03], [x - s * 0.02, y, zs - 0.06]], 0.015, 2), 0.006, { sides: 5, look: M('tilt.tie', 'canvas', '#8a7f5e') }));
  }
  const roll = zt - 0.28;
  out.push(...tube([[-bhw + 0.08, bows[0] - 0.08, roll], [bhw - 0.08, bows[0] - 0.08, roll]], 0.11, { sides: 14, look: M('tilt.flap', 'canvas', C.canvas) }));
  for (const x of [-0.6, 0.6]) out.push(...tube(Array.from({ length: 15 }, (_, k) => { const a = (2 * Math.PI * k) / 14; return [x, bows[0] - 0.08 + 0.118 * Math.cos(a), roll + 0.118 * Math.sin(a)]; }), 0.007, { sides: 5, caps: false, look: M('tilt.strap', 'canvas', '#4a4a32') }));
  // ── the tail: the frame's end beam, its lamps, the bolts
  P({ axis: 'x', profile: rect(yT, yT + 0.14, zr0 - 0.05, zr1), from: -0.95, to: 0.95, r: 0.012, seg: 1, look: paint('bumper') });
  for (const s of [-1, 1]) {
    P({ axis: 'y', profile: rect(s * 0.78 - 0.07, s * 0.78 + 0.07, 0.92, 1.04), from: yT - 0.016, to: yT, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('taillamp', 'tail', C.tail) : M('taillamp.bezel', 'carbon', C.black)) });
    P({ axis: 'y', profile: rect(s * 0.6 - 0.04, s * 0.6 + 0.04, 0.95, 1.0), from: yT - 0.016, to: yT, r: 0.004, seg: 1, look: (role) => (role === 'cap' ? M('marker', 'marker', C.amber) : M('marker.bezel', 'carbon', C.black)) });
  }
  // ── the anchors
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = (a) => a.map((q) => -q);
  const anchors = [
    { id: 'cab.back', kind: 'panel', at: [0.45, y0c, 1.82], out: neg(Y), up: Z },
    ...[-1, 1].flatMap((s) => {
      const L = s < 0 ? 'L' : 'R', side = s < 0 ? neg(X) : X;
      return [
        { id: `rail.${L}`, kind: 'rail', at: [s * 0.56, 1.0, zr1 - 0.02], out: side, up: Z },
        { id: `bed.${L}`, kind: 'flank', at: [s * (hw - 0.01), yb1 - 0.55, s < 0 ? zf + 0.33 : zf + 0.08], out: side, up: Z },
        { id: `cab.flank.${L}`, kind: 'flank', at: [s * cw, y0c + 0.12, 2.45], out: side, up: Z },
        { id: `grab.${L}`, kind: 'flank', at: [s * cw, y0c + 0.12, 1.9], out: side, up: Z },
        { id: `sill.${L}`, kind: 'sill', at: [s * cw, (y0c + yc) / 2, 0.82], out: side, up: Z },
        { id: `flap.F${L}`, kind: 'flap', at: [s * v.track / 2, yf - r - 0.14, 1.38], out: neg(Y), up: Z },
        { id: `flap.R${L}`, kind: 'flap', at: [s * v.track / 2, yb - r - 0.14, zf - 0.1], out: neg(Y), up: Z },
        { id: `bumper.F${L}`, kind: 'bumper', at: [s * 0.78, yN, 0.92], out: Y, up: Z },
        { id: `post.${L}`, kind: 'post', at: [s * cw, yc - 0.05, 2.5], out: side, up: Z },
        { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (cw + 0.003), (y0c + yc) / 2, 1.55], out: side, up: Z, h: 0.13 },
        { id: `mark.bonnet.${L}`, kind: 'mark', role: 'emblem', at: [s * bw, yc + 0.35, 1.7], out: side, up: Z, h: 0.09 },
      ];
    }),
    { id: 'bumper.RC', kind: 'bumper', at: [0, yT, 0.98], out: neg(Y), up: Z },
    { id: 'mark.bumper', kind: 'mark', role: 'number', at: [0.3, yN, 0.9], out: Y, up: Z, h: 0.1 },
    { id: 'mark.rear', kind: 'mark', role: 'emblem', at: [0, yb0 - 0.04, zf + 0.3], out: neg(Y), up: Z, h: 0.12 },
  ];
  return { faces: out.filter(Boolean), anchors, zones: { floor: zr1, tub: { x: hw, y: [yb0, yb1], z: [zf, zs] } } };
}

// ── the eight-wheeled armoured carrier ──────────────────────────────────────────
function carrier(cls) {
  const v = VEHICLES[cls], hw = v.W / 2, axles = militaryAxles(cls), r = v.wheelRadius;
  // (its rear plate short of the tail: the ramp, its hinges and its handle stand proud of it, inside the class's length)
  const yN = v.L / 2, yT = -v.L / 2 + 0.08, out = [];
  const P = (o) => out.push(...plate(o));
  // the hull's numbers: its belly, the sponsons' underside over the wheels, the band the bins hang on, the troop roof and
  // the lower roof ahead of it (the driver and the engine), the step between them, the glacis's top and the nose
  const zB = 0.45, zS = 1.3, zK = 1.62, zR = 2.2, zF = 1.95, xS = 1.34, xR = 1.12, xL = 0.88, yStep = 0.95, yG = 2.6, zN = 1.36;
  const xAt = (z) => xS - ((xS - xR) * (z - zK)) / (zR - zK);
  const glacisZ = (y) => zF - ((zF - zN) * (y - yG)) / (yN - yG);
  // (the hull is olive armour; its face named by where it looks)
  const armour = (name, hide) => (t) => {
    if (hide && hide(t)) return null;
    const n = t.n, part = n[2] < -0.5 ? 'hull.belly' : n[2] > 0.9 ? `${name}.roof` : n[1] > 0.3 && n[2] > 0.3 ? 'hull.glacis' : n[1] < -0.9 ? 'hull.rear' : name;
    return paint(part);
  };
  // ── the lower hull between the wheels: a shallow V belly, its nose plate raked back under the glacis
  out.push(...slab({
    front: [[0, zB], [0.6, 0.52], [xL, 0.82], [xL, zS], [-xL, zS], [-xL, 0.82], [-0.6, 0.52]],
    side: [[yT, zS], [yT, 0.6], [yT + 0.3, zB], [yN - 0.7, zB], [yN, 1.15], [yN, zS]],
    plan: [[-xL, yT], [xL, yT], [xL, yN - 0.5], [0.72, yN], [-0.72, yN], [-xL, yN - 0.5]],
    chamfer: 0.025, look: armour('hull.lower', (t) => t.view === 'front' && t.n[2] > 0.99),
  }));
  // ── the troop compartment: sponsons over the wheels, a band upright for the bins, its sides raked in to the roof
  const section = (zTop) => [[-xS, zS], [xS, zS], [xS, zK], [xAt(zTop), zTop], [-xAt(zTop), zTop], [-xS, zK]];
  out.push(...slab({ front: section(zR), side: [[yT, zS], [yT, 2.02], [yT + 0.18, zR], [yStep, zR], [yStep, zS]], chamfer: 0.03, look: armour('hull.upper') }));
  // ── ahead of it, lower: the driver's and the engine's roof, the glacis down to the nose, the nose's corners cut
  out.push(...slab({
    front: section(zF), side: [[yStep - 0.05, zS], [yStep - 0.05, zF], [yG, zF], [yN, zN], [yN, zS]],
    plan: [[-xS, yStep - 0.05], [xS, yStep - 0.05], [xS, yN - 0.7], [xS - 0.24, yN], [-xS + 0.24, yN], [-xS, yN - 0.7]],
    chamfer: 0.03, look: armour('hull.front', (t) => t.view === 'side' && t.n[1] < -0.99),
  }));
  out.push(...weld([-xAt(zF) + 0.03, yStep + 0.004, zF], [xAt(zF) - 0.03, yStep + 0.004, zF], [0, 1, 1], { look: M('weld', 'weld', C.olive) }));
  out.push(...weld([-xAt(zF) + 0.03, yG, zF + 0.002], [xAt(zF) - 0.03, yG, zF + 0.002], [0, 0.3, 1], { look: M('weld', 'weld', C.olive) }));
  for (const s of [-1, 1]) out.push(...weld([s * xS, yT + 0.02, zS + 0.02], [s * xS, yT + 0.02, zK], [s, -1, 0], { look: M('weld', 'weld', C.olive) }));
  // ── the running gear between the wheels: each hub's arms to the hull, its damper up to the sponson
  for (const y of axles) for (const s of [-1, 1]) {
    const steel = M('suspension', 'steel', C.steel), xh = s * (v.track / 2 - 0.2);
    out.push(...tube([[s * (xL - 0.02), y, r], [xh, y, r]], 0.06, { sides: 8, look: steel }));
    for (const [z, dz] of [[0.5, 0.24], [0.8, 0.2]]) out.push(...tube([[s * xL, y - dz, z], [xh, y, z - 0.03], [s * xL, y + dz, z]], 0.032, { sides: 6, look: steel }));
    out.push(...tube([[xh, y - 0.17, 0.66], [s * (xL + 0.03), y - 0.32, zS]], 0.045, { sides: 8, look: M('damper', 'carbon', C.black) }));
  }
  // ── the bins along the sponsons: three runs a side, their lids sloped, a lip, two latches each
  const bins = [[yT + 0.3, -1.55], [-1.35, 0.8], [1.0, yN - 0.98]];
  for (const s of [-1, 1]) for (const [y0, y1] of bins) {
    P({ axis: 'y', profile: [[s * (xS - 0.02), zS + 0.04], [s * hw, zS + 0.04], [s * hw, 1.6], [s * (xS - 0.02), zK + 0.02]], from: y0, to: y1, r: 0.012, seg: 1, look: paint('bin') });
    out.push(face([[s * (hw + 0.002), y0 + 0.02, 1.552], [s * (hw + 0.002), y1 - 0.02, 1.552], [s * (hw + 0.002), y1 - 0.02, 1.562], [s * (hw + 0.002), y0 + 0.02, 1.562]], M('seam', 'seal', '#151614'), [s, 0, 0]));
    for (const y of [y0 + (y1 - y0) * 0.25, y0 + (y1 - y0) * 0.75]) P({ axis: 'x', profile: rect(y - 0.03, y + 0.03, 1.47, 1.58), from: s * hw, to: s * (hw + 0.01), r: 0.003, seg: 1, look: M('bin.latch', 'steel', C.steel) });
  }
  // ── the rear: the ramp on its hinges, the door in it with its block and handle; the tail lamps in their guards
  const yr = yT - 0.04;
  P({ axis: 'y', profile: rect(-0.72, 0.72, 0.72, 1.97), from: yr, to: yT + 0.01, r: 0.015, seg: 1, look: paint('ramp') });
  for (const x of [-0.55, 0, 0.55]) out.push(...tube([[x - 0.11, yT - 0.05, 0.74], [x + 0.11, yT - 0.05, 0.74]], 0.035, { sides: 10, look: paint('ramp.hinge') }));
  out.push(...bolts([-0.6, -0.3, 0, 0.3, 0.6].map((x) => [x, yr, 1.92]), [0, -1, 0], { r: 0.012, h: 0.008, look: paint('bolt') }));
  const seam = M('seam', 'seal', '#151614'), back = (x0, x1, z0, z1, look, d = 0.002) => out.push(face([[x0, yr - d, z0], [x1, yr - d, z0], [x1, yr - d, z1], [x0, yr - d, z1]], look, [0, -1, 0]));
  back(0.02, 0.56, 0.84, 0.852, seam); back(0.02, 0.56, 1.848, 1.86, seam); back(0.02, 0.032, 0.84, 1.86, seam); back(0.548, 0.56, 0.84, 1.86, seam);
  P({ axis: 'y', profile: rect(0.16, 0.42, 1.52, 1.68), from: yr - 0.03, to: yr, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) });
  out.push(...tube(bend([[0.48, yr, 1.22], [0.48, yr - 0.045, 1.22], [0.48, yr - 0.045, 1.4], [0.48, yr, 1.4]], 0.015, 2), 0.012, { sides: 6, look: paint('door.handle') }));
  for (const s of [-1, 1]) {
    const x = s * 1.0;
    P({ axis: 'y', profile: rect(x - 0.07, x + 0.07, 1.89, 1.97), from: yT - 0.016, to: yT, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('taillamp', 'tail', C.tail) : M('taillamp.bezel', 'carbon', C.black)) });
    out.push(...tube(bend([[x - 0.1, yT, 1.93], [x - 0.1, yT - 0.07, 1.93], [x + 0.1, yT - 0.07, 1.93], [x + 0.1, yT, 1.93]], 0.03, 2), 0.008, { sides: 6, look: paint('taillamp.guard') }));
  }
  // ── the troop roof: the empty mount ring, the commander's cupola and its blocks, two hatches, the grab rails
  const disc = (cx, cy, rr, k = 20) => Array.from({ length: k }, (_, i) => [cx + rr * Math.cos((2 * Math.PI * i) / k), cy + rr * Math.sin((2 * Math.PI * i) / k)]);
  const yM = -0.55;
  P({ axis: 'z', profile: disc(0, yM, 0.66, 28), from: zR - 0.02, to: zR + 0.1, r: 0.02, seg: 1, look: paint('mount.ring') });
  P({ axis: 'z', profile: disc(0, yM, 0.52, 24), from: zR + 0.1, to: zR + 0.104, look: M('mount.well', 'carbon', '#121310') });
  out.push(...bolts(disc(0, yM, 0.59, 18).map(([x, y]) => [x, y, zR + 0.1]), [0, 0, 1], { r: 0.014, h: 0.01, look: paint('bolt') }));
  const [cx, cy] = [-0.62, 0.45];
  P({ axis: 'z', profile: disc(cx, cy, 0.34, 18), from: zR - 0.02, to: 2.5, r: 0.015, seg: 1, look: paint('cupola') });
  P({ axis: 'z', profile: disc(cx, cy + 0.02, 0.3, 18), from: 2.5, to: 2.58, r: 0.015, seg: 1, look: paint('cupola.hatch') });
  out.push(...tube(bend([[cx - 0.1, cy - 0.05, 2.578], [cx - 0.1, cy - 0.05, 2.588], [cx + 0.1, cy - 0.05, 2.588], [cx + 0.1, cy - 0.05, 2.578]], 0.008, 2), 0.012, { sides: 6, look: paint('cupola.handle') }));
  P({ axis: 'x', profile: rect(cy - 0.36, cy - 0.27, 2.47, 2.56), from: cx - 0.12, to: cx + 0.12, r: 0.01, seg: 1, look: paint('cupola.hinge') });
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + ((k - 2.5) * Math.PI) / 4.2, ox = Math.cos(a), oy = Math.sin(a);
    const block = plate({ axis: 'y', profile: rect(-0.065, 0.065, 2.34, 2.45), from: 0, to: 0.05, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) });
    out.push(...place(block.filter((f) => f.outNormal[1] > -0.5), { origin: [cx + 0.325 * ox, cy + 0.325 * oy, 0], ex: [oy, -ox, 0], ey: [ox, oy, 0], ez: [0, 0, 1] }));
  }
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.12, 0.92);
    P({ axis: 'z', profile: rect(a, b, -3.2, -2.2), from: zR - 0.01, to: zR + 0.035, r: 0.012, seg: 1, look: paint('hatch') });
    for (const y of [-3.0, -2.4]) out.push(...tube([[s * 0.95, y - 0.09, zR + 0.03], [s * 0.95, y + 0.09, zR + 0.03]], 0.026, { sides: 8, look: paint('hatch.hinge') }));
    out.push(...tube(bend([[s * 0.4, -2.36, zR + 0.035], [s * 0.4, -2.36, zR + 0.075], [s * 0.4, -2.56, zR + 0.075], [s * 0.4, -2.56, zR + 0.035]], 0.015, 2), 0.011, { sides: 6, look: paint('hatch.handle') }));
    // (the stop an open lid rests on, its rubber pad)
    out.push(...tube([[s * 1.02, -2.7, zR], [s * 1.02, -2.7, zR + 0.12]], 0.018, { sides: 8, look: paint('hatch.stop') }));
    out.push(...tube([[s * 1.02, -2.7, zR + 0.12], [s * 1.02, -2.7, zR + 0.15]], 0.03, { sides: 8, look: M('hatch.stop.pad', 'rubber', C.rubber) }));
    out.push(...tube(bend([[s * 1.0, -1.9, zR], [s * 1.0, -1.9, zR + 0.08], [s * 1.0, -0.3, zR + 0.08], [s * 1.0, -0.3, zR]], 0.04, 3), 0.014, { sides: 8, look: paint('grab') }));
    out.push(...tube([[s * 1.0, -1.1, zR], [s * 1.0, -1.1, zR + 0.08]], 0.014, { sides: 8, look: paint('grab') }));
  }
  // ── the lower roof: the driver's hatch and its three blocks over the glacis; the engine's grille deck, bolted
  const [dx, dy] = [-0.68, 1.95];
  P({ axis: 'z', profile: rect(dx - 0.28, dx + 0.28, dy - 0.27, dy + 0.27), from: zF - 0.01, to: zF + 0.04, r: 0.015, seg: 1, look: paint('hatch.driver') });
  P({ axis: 'x', profile: rect(dy - 0.33, dy - 0.25, zF + 0.01, zF + 0.07), from: dx - 0.16, to: dx + 0.16, r: 0.01, seg: 1, look: paint('hatch.hinge') });
  for (const x of [dx - 0.2, dx, dx + 0.2]) {
    P({ axis: 'z', profile: rect(x - 0.075, x + 0.075, yG - 0.2, yG - 0.08), from: zF - 0.01, to: zF + 0.085, r: 0.008, seg: 1, look: M('vision.frame', 'carbon', C.black) });
    out.push(face([[x - 0.06, yG - 0.078, zF + 0.02], [x + 0.06, yG - 0.078, zF + 0.02], [x + 0.06, yG - 0.078, zF + 0.07], [x - 0.06, yG - 0.078, zF + 0.07]], M('vision', 'vision', C.vision), [0, 1, 0]));
  }
  const [g0, g1, e0, e1] = [0.12, 1.02, 1.15, 2.42];
  P({ axis: 'z', profile: rect(g0, g1, e0, e1), from: zF - 0.01, to: zF + 0.02, r: 0.01, seg: 1, look: paint('engine.deck') });
  for (let y = e0 + 0.09; y < e1 - 0.05; y += 0.105) P({ axis: 'x', profile: rect(y - 0.032, y + 0.032, zF + 0.02, zF + 0.034), from: g0 + 0.06, to: g1 - 0.06, r: 0.004, seg: 1, look: M('engine.grille', 'carbon', C.black) });
  out.push(...bolts([...[e0 + 0.03, e1 - 0.03].flatMap((y) => [0.2, 0.4, 0.6, 0.8, 0.95].map((x) => [x, y, zF + 0.02])), ...[g0 + 0.03, g1 - 0.03].flatMap((x) => [1.5, 1.8, 2.1].map((y) => [x, y, zF + 0.02]))], [0, 0, 1], { r: 0.011, h: 0.007, look: paint('bolt') }));
  // ── the glacis: an access plate bolted on, the lamps on their stems in wire guards, the blackout markers
  const gn = (() => { const d = Math.hypot(zF - zN, yN - yG); return [0, (zF - zN) / d, (yN - yG) / d]; })(), gu = [0, -gn[2], gn[1]];
  const onGlacis = (fs, y, x = 0) => place(fs, { origin: [x, y, glacisZ(y)], ex: [1, 0, 0], ey: gn, ez: gu });
  out.push(...onGlacis([...plate({ axis: 'y', profile: rect(-0.42, 0.42, -0.24, 0.24), from: 0, to: 0.014, r: 0.008, seg: 1, look: paint('glacis.plate') }),
    ...bolts([-0.36, -0.12, 0.12, 0.36].flatMap((x) => [[x, 0.014, -0.19], [x, 0.014, 0.19]]), [0, 1, 0], { r: 0.012, h: 0.008, look: paint('bolt') })], 3.2));
  for (const s of [-1, 1]) {
    const x = s * 0.86, y = 3.5, z = glacisZ(y) + 0.13;
    out.push(...tube([[x, y - 0.1, z], [x, y + 0.04, z]], 0.085, { sides: 16, look: (role) => (role === 'cap' ? M('headlamp', 'lamp', C.lamp) : paint('headlamp.bucket')) }));
    out.push(...tube([[x, y - 0.04, glacisZ(y - 0.04) - 0.01], [x, y - 0.04, z - 0.07]], 0.022, { sides: 8, look: paint('headlamp.stem') }));
    for (const ddx of [-0.055, 0, 0.055]) out.push(...tube(bend([[x + ddx, y + 0.02, z - 0.1], [x + ddx, y + 0.1, z - 0.095], [x + ddx, y + 0.1, z + 0.095], [x + ddx, y + 0.02, z + 0.1]], 0.025, 3), 0.007, { sides: 6, look: paint('headlamp.guard') }));
    out.push(...onGlacis(plate({ axis: 'y', profile: rect(-0.04, 0.04, -0.025, 0.025), from: 0, to: 0.02, r: 0.004, seg: 1, look: (role) => (role === 'cap' ? M('marker', 'marker', C.amber) : M('marker.bezel', 'carbon', C.black)) }), 3.5, s * 0.6));
  }
  // ── on the raked sides: a hatch each with its block and hinges, the exhaust's sooty shield on the right, the tow cable
  const slope = (s) => { const d = Math.hypot(zR - zK, xS - xR); return { n: [s * (zR - zK) / d, 0, (xS - xR) / d], u: [-s * (xS - xR) / d, 0, (zR - zK) / d], L: d }; };
  const onSlope = (fs, s, y, t) => { const { n, u } = slope(s); return place(fs, { origin: [s * xAt(zK + t * (zR - zK)), y, zK + t * (zR - zK)], ex: [0, -s, 0], ey: n, ez: u }); };
  for (const s of [-1, 1]) {
    const L = slope(s).L, hatch = [];
    hatch.push(...plate({ axis: 'y', profile: rect(-0.3, 0.3, 0.08, L - 0.1), from: 0, to: 0.025, r: 0.01, seg: 1, look: paint('hatch.side') }));
    for (const x of [-0.18, 0.18]) hatch.push(...tube([[x - 0.07, 0.03, L - 0.08], [x + 0.07, 0.03, L - 0.08]], 0.022, { sides: 8, look: paint('hatch.hinge') }));
    hatch.push(...plate({ axis: 'y', profile: rect(-0.1, 0.1, 0.3, 0.38), from: 0.025, to: 0.05, r: 0.005, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) }));
    hatch.push(...tube(bend([[-0.2, 0.025, 0.14], [-0.2, 0.06, 0.14], [0.0, 0.06, 0.14], [0.0, 0.025, 0.14]], 0.015, 2), 0.011, { sides: 6, look: paint('hatch.handle') }));
    out.push(...onSlope(hatch, s, -0.45, 0));
  }
  {
    const shield = [...plate({ axis: 'y', profile: rect(-0.32, 0.32, 0.1, 0.42), from: 0, to: 0.06, r: 0.01, seg: 1, look: M('exhaust.shield', 'carbon', C.soot) })];
    for (let x = -0.26; x <= 0.27; x += 0.065) shield.push(...plate({ axis: 'x', profile: rect(0.06, 0.068, 0.14, 0.38), from: x - 0.012, to: x + 0.012, look: M('exhaust.slot', 'carbon', '#0e0e0d') }));
    out.push(...onSlope(shield, 1, 1.65, 0));
    // (the tow cable: a loop along the left side aft, its eyes clamped at one end)
    const c = [], q = (x, z) => [x, 0.028, z];
    c.push(...tube(bend([q(-0.95, 0.42), q(0.85, 0.42), q(0.95, 0.31), q(0.85, 0.2), q(-0.95, 0.2)], 0.06, 3), 0.018, { sides: 7, look: M('tow.cable', 'steel', '#3a3b37') }));
    for (const z of [0.2, 0.42]) c.push(...tube(Array.from({ length: 11 }, (_, k) => { const a = (2 * Math.PI * k) / 10; return [-1.0 + 0.05 * Math.cos(a), 0.028, z + 0.05 * Math.sin(a)]; }), 0.012, { sides: 6, caps: false, look: M('tow.eye', 'steel', '#3a3b37') }));
    for (const x of [-0.6, 0.0, 0.55]) c.push(...plate({ axis: 'x', profile: rect(0, 0.05, 0.15, 0.47), from: x - 0.02, to: x + 0.02, r: 0.004, seg: 1, look: paint('tow.clamp') }));
    out.push(...onSlope(c, -1, -2.3, 0));
  }
  // ── the anchors
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = (a) => a.map((q) => -q);
  const onSlopeAnchor = (id, kind, s, y, t) => { const { n, u } = slope(s); return { id, kind, at: [s * xAt(zK + t * (zR - zK)), y, zK + t * (zR - zK)], out: n, up: u }; };
  const yl = axles[axles.length - 1];
  const anchors = [
    ...[-1, 1].flatMap((s) => {
      const L = s < 0 ? 'L' : 'R', side = s < 0 ? neg(X) : X;
      return [
        { id: `rear.${L}`, kind: 'panel', at: [s * 1.0, yT, zS + 0.03], out: neg(Y), up: Z },
        { id: `antenna.${L}`, kind: 'panel', at: [s * xS, yT + 0.15, 1.48], out: side, up: Z },
        onSlopeAnchor(`grab.${L}`, 'flank', s, 2.45, 0.55),
        { id: `sill.${L}`, kind: 'sill', at: [s * xS, yN - 0.8, 1.04], out: side, up: Z },
        { id: `flap.${L}`, kind: 'flap', at: [s * v.track / 2, yl - r - 0.12, zS], out: neg(Y), up: Z },
        { id: `bumper.F${L}`, kind: 'bumper', at: [s * 0.52, yN, 1.22], out: Y, up: Z },
        { id: `bumper.R${L}`, kind: 'bumper', at: [s * 0.8, yT, 0.9], out: neg(Y), up: Z },
        { id: `post.${L}`, kind: 'post', at: [s * xS, yN - 0.88, 1.5], out: side, up: Z },
        { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.003), 2.0, 1.47], out: side, up: Z, h: 0.13 },
      ];
    }),
    onSlopeAnchor('slope.R', 'flank', 1, -2.3, 0.45),
    { id: 'bumper.RC', kind: 'bumper', at: [0, yT, 0.66], out: neg(Y), up: Z },
    { id: 'top', kind: 'top', at: [0, yT + 0.32, zR], out: Z, up: neg(Y) },
    { id: 'mark.rear', kind: 'mark', role: 'number', at: [-0.38, yr - 0.003, 1.62], out: neg(Y), up: Z, h: 0.12 },
    { id: 'mark.glacis', kind: 'mark', role: 'emblem', at: [0.0, 2.85, glacisZ(2.85) + 0.003], out: gn, up: gu, h: 0.12 },
  ];
  return { faces: out.filter(Boolean), anchors, zones: { floor: zS - 0.05 } };
}

// ── the light tank: its hull on its running gear (its turret its own, a bone) ─────────────────────────────────────
/** A tracked class's running gear stations (mil-track.js): its road wheels over the track's length on the ground, the
 *  sprocket aft and the idler forward inside the hull, the return rollers between. */
export function trackedGear(cls) {
  const v = VEHICLES[cls], r = v.wheelRadius, n = 5, half = v.wheelbase / 2, yN = v.L / 2, yT = -v.L / 2;
  // (a tank's sprocket aft by its engine; a carrier's forward by its engine, its ramp aft over the idler)
  const fore = MILITARY_CLASSES[cls] === 'trackedCarrier';
  const drive = { z: 0.62, r: 0.3 }, idle = { z: 0.5, r: 0.27 };
  return {
    x: v.track / 2, width: 0.42, hullX: 0.86,
    sprocket: { y: fore ? yN - 0.48 : yT + 0.5, ...drive }, idler: { y: fore ? yT + 0.48 : yN - 0.5, ...idle },
    wheels: Array.from({ length: n }, (_, k) => ({ y: half - (2 * half * k) / (n - 1), r })),
    rollers: [half * 0.75, 0, -half * 0.75].map((y) => ({ y, z: 2 * r + TRACK_DEPTH + 0.09, r: 0.08 })),
  };
}

/** A tracked body's words from its brief (the sheet's unread words): its gun long or short, its skirts and its basket
 *  on or off ("a short gun, no skirts"); a word not said is left to the dice. */
export function trackedWords(words = []) {
  const W = words.map((w) => String(w).toLowerCase()), out = {};
  const said = (stems) => W.findIndex((w) => stems.includes(w));
  const denied = (i) => i > 0 && ['no', 'without', 'unskirted'].includes(W[i - 1]);
  const gun = said(['short', 'stubby']), long = said(['long']);
  if (gun >= 0) out.gun = 'short'; else if (long >= 0) out.gun = 'long';
  const sk = said(['skirts', 'skirt', 'skirted']);
  if (sk >= 0) out.skirts = !denied(sk);
  if (said(['unskirted', 'bare']) >= 0) out.skirts = false;
  const bk = said(['basket']);
  if (bk >= 0) out.basket = !denied(bk);
  return out;
}

// the fenders over the tracks, their fronts bent down; the skirts hung from their edges; the bins along them
function trackedFenders(out, { hw, x0, zF, yN, yT, skirted, bins, front = 0.3 }) {
  const P = (o) => out.push(...plate(o));
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, x0 - 0.02, hw - 0.012);
    P({ axis: 'y', profile: rect(a, b, zF - 0.015, zF + 0.005), from: yT + 0.1, to: yN - front, r: 0.005, seg: 1, look: paint('fender') });
    P({ axis: 'x', profile: [[yN - front, zF - 0.015], [yN, zF - 0.14], [yN, zF - 0.12], [yN - front, zF + 0.005]], from: a, to: b, r: 0.004, seg: 1, look: paint('fender') });
    out.push(...bolts([yT + 0.4, (yT + 0.4) / 2, 0, (yN - 0.5) / 2, yN - 0.5].map((y) => [s * (hw - 0.03), y, zF + 0.005]), [0, 0, 1], { r: 0.011, h: 0.007, look: paint('bolt') }));
    if (skirted) {
      const segs = 4, y0 = yT + 0.35, y1 = yN - 0.45, step = (y1 - y0) / segs, [c, d] = xs(s, hw - 0.012, hw);
      for (let k = 0; k < segs; k++) {
        const ya = y0 + k * step + 0.012, yb = y0 + (k + 1) * step - 0.012;
        P({ axis: 'x', profile: [[ya, 0.6], [yb, 0.6], [yb, zF - 0.01], [ya, zF - 0.01]], from: c, to: d, r: 0.006, seg: 1, look: paint('skirt') });
        out.push(...bolts([ya + 0.08, (ya + yb) / 2, yb - 0.08].map((y) => [s * hw, y, zF - 0.05]), [s, 0, 0], { r: 0.012, h: 0.008, look: paint('bolt') }));
      }
    }
    // the bins along the fender, their lids lipped and latched
    for (const [ya, yb] of bins) {
      const [e, f] = xs(s, x0 + 0.03, hw - 0.03);
      P({ axis: 'y', profile: rect(e, f, zF + 0.005, zF + 0.31), from: ya, to: yb, r: 0.012, seg: 1, look: paint('bin') });
      P({ axis: 'y', profile: rect(e - 0.01, f + 0.01, zF + 0.3, zF + 0.335), from: ya - 0.01, to: yb + 0.01, r: 0.01, seg: 1, look: paint('bin.lid') });
      for (const y of [ya + (yb - ya) * 0.25, ya + (yb - ya) * 0.75]) P({ axis: 'x', profile: rect(y - 0.03, y + 0.03, zF + 0.2, zF + 0.32), from: s * (hw - 0.03), to: s * (hw - 0.02), r: 0.003, seg: 1, look: M('bin.latch', 'steel', C.steel) });
    }
  }
}

function lightTank(cls, { seed = 1, words = [] } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, gear = trackedGear(cls), rnd = mulberry32((seed * 7919 + 101) >>> 0);
  const yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  // the hull's numbers: its belly, the fenders over the tracks, the roof; the superstructure's side at its foot and at
  // its roof; the glacis from the nose up to the roof; the rear plate
  const zB = 0.42, zF = 1.0, zR = 1.55, xL = gear.hullX, x0 = 1.1, x1 = 1.04, yG = 1.75, zN = 1.06, yR = yT + 0.18;
  const glacisZ = (y) => zR - ((zR - zN) * (y - yG)) / (yN - 0.05 - yG);
  const armour = (name, hide) => (t) => {
    if (hide && hide(t)) return null;
    // (a tank's glacis is shallow: it faces forward before it faces up)
    const n = t.n, part = n[2] < -0.5 ? 'hull.belly' : n[1] > 0.3 && n[2] > 0.3 ? 'hull.glacis' : n[2] > 0.9 ? `${name}.roof` : n[1] < -0.9 ? 'hull.rear' : name;
    return paint(part);
  };
  const weldOn = (a, b, n) => out.push(...weld(a, b, n, { look: M('weld', 'weld', C.olive) }));
  // ── the lower hull between the tracks: a flat belly, the lower glacis raked back to the nose
  out.push(...slab({
    front: [[-xL, zB], [xL, zB], [xL, zF], [-xL, zF]],
    side: [[yR, zF], [yR, 0.62], [yR + 0.3, zB], [yN - 0.8, zB], [yN - 0.05, zF - 0.04], [yN - 0.05, zF]],
    chamfer: 0.025, look: armour('hull.lower', (t) => t.view === 'front' && t.n[2] > 0.99),
  }));
  // ── the superstructure over it: its sides raked in a little, the long shallow glacis, the rear plate raked
  out.push(...slab({
    front: [[-x0, zF], [x0, zF], [x1, zR], [-x1, zR]],
    side: [[yR, zF], [yR + 0.07, zR - 0.1], [yR + 0.2, zR], [yG, zR], [yN - 0.05, zN], [yN - 0.05, zF]],
    plan: [[-x0, yR], [x0, yR], [x0, yN - 0.4], [x0 - 0.2, yN - 0.05], [-x0 + 0.2, yN - 0.05], [-x0, yN - 0.4]],
    chamfer: 0.03, look: armour('hull.upper', (t) => t.view === 'front' && t.n[2] < -0.99),
  }));
  weldOn([-x1 + 0.05, yG, zR + 0.002], [x1 - 0.05, yG, zR + 0.002], [0, 0.3, 1]);
  weldOn([-x0 + 0.21, yN - 0.05, zF + 0.01], [x0 - 0.21, yN - 0.05, zF + 0.01], [0, 1, 0.2]);
  // ── the fenders over the tracks, their fronts bent down; the skirts hung from their edges (most carry them)
  // (its variations: what its brief says, else the dice: most are skirted, most carry the long gun and a basket)
  const said = trackedWords(words), dice = [rnd(), rnd()];
  const skirted = said.skirts ?? dice[0] < 0.6, longGun = (said.gun ?? (dice[1] < 0.7 ? 'long' : 'short')) === 'long', basketed = said.basket ?? true;
  trackedFenders(out, { hw, x0, zF, yN, yT, skirted, bins: [[-2.0, -0.5], [-0.3, 1.0]] });
  // ── the turret's ring, bolted: the turret stands on it (its own bone)
  const ring = (cx, cy, rr, k) => Array.from({ length: k }, (_, i) => [cx + rr * Math.cos((2 * Math.PI * i) / k), cy + rr * Math.sin((2 * Math.PI * i) / k)]);
  const yM = 0.05;
  P({ axis: 'z', profile: ring(0, yM, 0.98, 32), from: zR - 0.01, to: zR + 0.05, r: 0.015, seg: 1, look: paint('turret.ring') });
  out.push(...bolts(ring(0, yM, 0.93, 24).map(([x, y]) => [x, y, zR + 0.05]), [0, 0, 1], { r: 0.012, h: 0.008, look: paint('bolt') }));
  // ── the driver's hatch forward on the left, its blocks looking over the glacis
  const [dx, dy] = [-0.55, 1.33];
  P({ axis: 'z', profile: ring(dx, dy, 0.27, 16), from: zR - 0.01, to: zR + 0.04, r: 0.012, seg: 1, look: paint('hatch.driver') });
  P({ axis: 'x', profile: rect(dy - 0.33, dy - 0.24, zR, zR + 0.07), from: dx - 0.12, to: dx + 0.12, r: 0.01, seg: 1, look: paint('hatch.hinge') });
  for (const x of [dx - 0.2, dx, dx + 0.2]) {
    P({ axis: 'z', profile: rect(x - 0.07, x + 0.07, yG - 0.15, yG - 0.04), from: zR - 0.01, to: zR + 0.08, r: 0.008, seg: 1, look: M('vision.frame', 'carbon', C.black) });
    out.push(face([[x - 0.055, yG - 0.038, zR + 0.015], [x + 0.055, yG - 0.038, zR + 0.015], [x + 0.055, yG - 0.038, zR + 0.065], [x - 0.055, yG - 0.038, zR + 0.065]], M('vision', 'vision', C.vision), [0, 1, 0]));
  }
  // ── the engine deck aft: two grilles in their frames, an access plate bolted, the lifting eyes
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.06, 0.92), [ya, yb] = [yT + 0.35, -1.15];
    P({ axis: 'z', profile: rect(a, b, ya, yb), from: zR - 0.01, to: zR + 0.02, r: 0.01, seg: 1, look: paint('engine.deck') });
    for (let y = ya + 0.08; y < yb - 0.04; y += 0.1) P({ axis: 'x', profile: rect(y - 0.03, y + 0.03, zR + 0.02, zR + 0.033), from: a + 0.05, to: b - 0.05, r: 0.004, seg: 1, look: M('engine.grille', 'carbon', C.black) });
    out.push(...tube(bend([[s * 0.98, yT + 0.4, zR], [s * 0.98, yT + 0.4, zR + 0.07], [s * 0.98, yT + 0.55, zR + 0.07], [s * 0.98, yT + 0.55, zR]], 0.02, 2), 0.014, { sides: 6, look: paint('lifting.eye') }));
  }
  P({ axis: 'z', profile: rect(-0.6, 0.6, -1.08, -0.98), from: zR - 0.01, to: zR + 0.012, r: 0.006, seg: 1, look: paint('access.plate') });
  // ── the glacis: spare track links bolted across it, the lamps on their stems in guards, the blackout markers
  const gn = (() => { const d = Math.hypot(zR - zN, yN - 0.05 - yG); return [0, (zR - zN) / d, (yN - 0.05 - yG) / d]; })(), gu = [0, -gn[2], gn[1]];
  const onGlacis = (fs, y, x = 0) => place(fs, { origin: [x, y, glacisZ(y)], ex: [1, 0, 0], ey: gn, ez: gu });
  const spare = [];
  for (let k = 0; k < 5; k++) spare.push(...place(linkFaces(0.42, 0.15), { origin: [-0.32 + k * 0.16, 0, 0], ex: [0, -1, 0], ey: [1, 0, 0], ez: [0, 0, 1] }).map((f) => ({ ...f, part: f.part.replace('track.', 'spare.') })));
  spare.push(...plate({ axis: 'x', profile: rect(-0.24, -0.2, 0, 0.07), from: -0.42, to: 0.42, r: 0.006, seg: 1, look: paint('spare.rack') }));
  // (the links lie on the glacis, their grousers out: the frame's y up the glacis is the link's across)
  out.push(...onGlacis(place(spare, { origin: [0, 0, 0.075], ex: [1, 0, 0], ey: [0, 0, -1], ez: [0, 1, 0] }), 2.55));
  for (const s of [-1, 1]) {
    const x = s * 0.88, y = yN - 0.32, z = glacisZ(y) + 0.13;
    out.push(...tube([[x, y - 0.1, z], [x, y + 0.04, z]], 0.08, { sides: 16, look: (role) => (role === 'cap' ? M('headlamp', 'lamp', C.lamp) : paint('headlamp.bucket')) }));
    out.push(...tube([[x, y - 0.04, glacisZ(y - 0.04) - 0.01], [x, y - 0.04, z - 0.065]], 0.02, { sides: 8, look: paint('headlamp.stem') }));
    for (const ddx of [-0.05, 0, 0.05]) out.push(...tube(bend([[x + ddx, y + 0.02, z - 0.095], [x + ddx, y + 0.1, z - 0.09], [x + ddx, y + 0.1, z + 0.09], [x + ddx, y + 0.02, z + 0.095]], 0.025, 3), 0.007, { sides: 6, look: paint('headlamp.guard') }));
    out.push(...onGlacis(plate({ axis: 'y', profile: rect(-0.04, 0.04, -0.022, 0.022), from: 0, to: 0.02, r: 0.004, seg: 1, look: (role) => (role === 'cap' ? M('marker', 'marker', C.amber) : M('marker.bezel', 'carbon', C.black)) }), yN - 0.25, s * 0.62));
  }
  // ── the rear: the exhausts' sooted boxes, the tail lamps in their guards
  const yRp = (z) => yR + (0.07 * (z - zF)) / (zR - 0.1 - zF);
  for (const s of [-1, 1]) {
    const x = s * 0.45, z0 = 1.12, z1 = 1.4;
    P({ axis: 'z', profile: rect(x - 0.17, x + 0.17, yRp(z0) - 0.17, yRp(z0) + 0.01), from: z0, to: z1, r: 0.012, seg: 1, look: M('exhaust', 'carbon', C.soot) });
    for (let z = z0 + 0.04; z < z1 - 0.02; z += 0.045) P({ axis: 'z', profile: rect(x - 0.14, x + 0.14, yRp(z0) - 0.172, yRp(z0) - 0.168), from: z, to: z + 0.018, look: M('exhaust.slot', 'carbon', '#0e0e0d') });
    const xl = s * 0.88, zl = 1.2, yl = yRp(zl);
    P({ axis: 'y', profile: rect(xl - 0.06, xl + 0.06, zl - 0.04, zl + 0.04), from: yl - 0.016, to: yl + 0.01, r: 0.005, seg: 1, look: (role) => (role === 'cap' ? M('taillamp', 'tail', C.tail) : M('taillamp.bezel', 'carbon', C.black)) });
    out.push(...tube(bend([[xl - 0.09, yl, zl], [xl - 0.09, yl - 0.07, zl], [xl + 0.09, yl - 0.07, zl], [xl + 0.09, yl, zl]], 0.03, 2), 0.007, { sides: 6, look: paint('taillamp.guard') }));
  }
  // ── the turret: its own bone, turning on the ring; the gun rides in it (an elevation bone waits for a parented rig)
  const tz = zR + 0.05, tr = [], zT = 2.12;
  const T = (o) => tr.push(...plate(o));
  const tx = (z) => 1.0 - (0.14 * (z - tz)) / (zT - tz);
  const turretLook = (t) => paint(t.n[2] > 0.9 ? 'turret.roof' : t.n[2] < -0.5 ? 'turret.under' : t.n[1] > 0.5 ? 'turret.front' : 'turret');
  tr.push(...slab({
    front: [[-1.0, tz], [1.0, tz], [0.86, zT], [-0.86, zT]],
    side: [[yM - 1.05, tz], [yM + 1.0, tz], [yM + 1.2, 1.82], [yM + 0.95, zT], [yM - 1.12, zT], [yM - 1.3, 2.0], [yM - 1.28, 1.72]],
    plan: [[-0.55, yM + 1.2], [0.55, yM + 1.2], [1.0, yM + 0.6], [1.0, yM - 0.8], [0.8, yM - 1.3], [-0.8, yM - 1.3], [-1.0, yM - 0.8], [-1.0, yM + 0.6]],
    chamfer: 0.03, look: turretLook,
  }));
  // the mantlet and the gun: its sleeve, the barrel and its thermal sleeve's bands, the bore evacuator, the muzzle brake
  const gz = 1.86, g0 = yM + 1.3, gun = (p) => paint(p);
  T({ axis: 'x', profile: rect(yM + 1.05, g0 + 0.04, 1.7, 2.02), from: -0.34, to: 0.34, r: 0.05, seg: 2, look: paint('mantlet') });
  // (the long gun: a slender barrel, banded, its evacuator two thirds along; the short: a stubbier, wider one, its
  // evacuator near the mantlet, its brake bigger)
  const G = longGun ? { len: 3.15, r: 0.068, ev: 1.75, bands: [0.8, 1.15, 1.5, 2.25, 2.6], brake: 0.27, br: 0.105 } : { len: 2.05, r: 0.08, ev: 0.85, bands: [0.65, 1.45], brake: 0.32, br: 0.125 };
  tr.push(...tube([[0, g0, gz], [0, g0 + 0.55, gz]], 0.1, { sides: 14, look: gun('gun.sleeve') }));
  tr.push(...tube([[0, g0 + 0.55, gz], [0, g0 + G.len, gz]], G.r, { sides: 12, look: gun('gun.barrel') }));
  for (const y of G.bands) tr.push(...tube([[0, g0 + y, gz], [0, g0 + y + 0.03, gz]], G.r + 0.008, { sides: 12, look: gun('gun.band') }));
  tr.push(...tube([[0, g0 + G.ev, gz], [0, g0 + G.ev + 0.05, gz]], G.r + 0.02, { sides: 14, look: gun('gun.evacuator') }));
  tr.push(...tube([[0, g0 + G.ev + 0.05, gz], [0, g0 + G.ev + 0.37, gz]], G.r + 0.037, { sides: 14, look: gun('gun.evacuator') }));
  tr.push(...tube([[0, g0 + G.ev + 0.37, gz], [0, g0 + G.ev + 0.42, gz]], G.r + 0.02, { sides: 14, look: gun('gun.evacuator') }));
  T({ axis: 'y', profile: rect(-G.br, G.br, gz - G.br * 0.72, gz + G.br * 0.72), from: g0 + G.len, to: g0 + G.len + G.brake, r: 0.012, seg: 1, look: gun('gun.brake') });
  for (const s of [-1, 1]) for (const y of [0.05, 0.05 + G.brake * 0.42]) T({ axis: 'x', profile: rect(g0 + G.len + y, g0 + G.len + y + G.brake * 0.22, gz - G.br * 0.52, gz + G.br * 0.52), from: s * G.br, to: s * (G.br + 0.004), look: M('gun.brake.port', 'carbon', C.black) });
  tr.push(...tube([[0.24, g0 + 0.02, gz - 0.05], [0.24, g0 + 0.06, gz - 0.05]], 0.026, { sides: 8, look: (role) => (role === 'cap' ? M('gun.coax', 'carbon', C.black) : paint('mantlet')) }));
  // the commander's cupola ringed with blocks, its lid and an empty pintle mount; the loader's hatch; the gunner's sight
  const [cx, cy] = [0.45, yM - 0.42];
  T({ axis: 'z', profile: ring(cx, cy, 0.3, 18), from: zT - 0.02, to: 2.4, r: 0.015, seg: 1, look: paint('cupola') });
  T({ axis: 'z', profile: ring(cx, cy, 0.27, 18), from: 2.4, to: 2.47, r: 0.012, seg: 1, look: paint('cupola.hatch') });
  tr.push(...tube(bend([[cx - 0.09, cy, 2.468], [cx - 0.09, cy, 2.488], [cx + 0.09, cy, 2.488], [cx + 0.09, cy, 2.468]], 0.008, 2), 0.012, { sides: 6, look: paint('cupola.handle') }));
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + ((k - 2.5) * Math.PI) / 4.2, ox = Math.cos(a), oy = Math.sin(a);
    const block = plate({ axis: 'y', profile: rect(-0.055, 0.055, 2.26, 2.35), from: 0, to: 0.045, r: 0.005, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) });
    tr.push(...place(block.filter((f) => f.outNormal[1] > -0.5), { origin: [cx + 0.29 * ox, cy + 0.29 * oy, 0], ex: [oy, -ox, 0], ey: [ox, oy, 0], ez: [0, 0, 1] }));
  }
  tr.push(...tube([[cx, cy + 0.32, 2.2], [cx, cy + 0.32, 2.44]], 0.022, { sides: 8, look: paint('pintle.mount') }));
  T({ axis: 'z', profile: rect(cx - 0.05, cx + 0.05, cy + 0.27, cy + 0.38), from: 2.44, to: 2.46, r: 0.004, seg: 1, look: paint('pintle.mount') });
  T({ axis: 'z', profile: rect(-0.72, -0.18, cy - 0.26, cy + 0.26), from: zT - 0.01, to: zT + 0.035, r: 0.012, seg: 1, look: paint('hatch.loader') });
  for (const y of [cy - 0.15, cy + 0.15]) tr.push(...tube([[-0.74, y - 0.06, zT + 0.03], [-0.74, y + 0.06, zT + 0.03]], 0.022, { sides: 8, look: paint('hatch.hinge') }));
  tr.push(...tube(bend([[-0.45, cy + 0.1, zT + 0.035], [-0.45, cy + 0.1, zT + 0.075], [-0.45, cy - 0.1, zT + 0.075], [-0.45, cy - 0.1, zT + 0.035]], 0.015, 2), 0.011, { sides: 6, look: paint('hatch.handle') }));
  const sy = yM + 0.62;
  T({ axis: 'z', profile: rect(-0.55, -0.29, sy - 0.14, sy + 0.14), from: zT - 0.01, to: zT + 0.2, r: 0.015, seg: 1, look: paint('sight') });
  T({ axis: 'y', profile: rect(-0.53, -0.31, zT + 0.05, zT + 0.17), from: sy + 0.14, to: sy + 0.16, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) });
  T({ axis: 'y', profile: rect(-0.57, -0.27, zT + 0.18, zT + 0.22), from: sy + 0.12, to: sy + 0.24, r: 0.006, seg: 1, look: paint('sight.hood') });
  // the smoke dischargers: four cups a side on the cheeks, aimed out, forward and up
  for (const s of [-1, 1]) {
    const base = [s * tx(1.95), yM + 0.42, 1.95], d = [s * 0.55, 0.55, 0.62], dn = Math.hypot(...d), u = d.map((q) => q / dn);
    T({ axis: 'x', profile: rect(yM + 0.2, yM + 0.66, 1.84, 2.06), from: s * (tx(1.95) - 0.01), to: s * (tx(1.95) + 0.03), r: 0.006, seg: 1, look: paint('smoke.plate') });
    for (let k = 0; k < 4; k++) {
      const p0 = [base[0] + s * 0.02, base[1] - 0.18 + (k % 2) * 0.12 + (k > 1 ? 0.06 : 0), base[2] - 0.05 + (k > 1 ? 0.1 : 0)];
      const p1 = p0.map((q, i) => q + u[i] * 0.2);
      tr.push(...tube([p0, p1], 0.042, { sides: 10, look: (role) => (role === 'cap' ? M('smoke.cup', 'carbon', '#181816') : paint('smoke.cup')) }));
    }
  }
  // the grab rails along its sides; the basket on the bustle, its rails and its floor
  for (const s of [-1, 1]) tr.push(...tube(bend([[s * tx(1.98), yM - 0.7, 1.98], [s * (tx(1.98) + 0.06), yM - 0.7, 1.98], [s * (tx(1.98) + 0.06), yM + 0.25, 1.98], [s * tx(1.98), yM + 0.25, 1.98]], 0.03, 2), 0.013, { sides: 6, look: paint('grab') }));
  const bk = yM - 1.3, bk1 = bk - 0.36, basket = paint('basket');
  if (basketed) {
    T({ axis: 'z', profile: rect(-0.78, 0.78, bk1, bk + 0.05), from: 1.74, to: 1.76, r: 0.004, seg: 1, look: basket });
    for (const z of [1.76, 1.92, 2.08]) tr.push(...tube(bend([[-0.78, bk + 0.02, z], [-0.78, bk1, z], [0.78, bk1, z], [0.78, bk + 0.02, z]], 0.05, 2), 0.012, { sides: 6, look: basket }));
    for (const x of [-0.78, -0.39, 0, 0.39, 0.78]) tr.push(...tube([[x, bk1, 1.74], [x, bk1, 2.09]], 0.011, { sides: 6, look: basket }));
    for (const s of [-1, 1]) for (const y of [bk1 + 0.12, bk1 + 0.25]) tr.push(...tube([[s * 0.78, y, 1.74], [s * 0.78, y, 2.09]], 0.011, { sides: 6, look: basket }));
  }
  out.push(...tr.map((f) => ({ ...f, bone: 'turret' })));
  // ── the anchors
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = (a) => a.map((q) => -q);
  const xSide = (z) => x0 - ((x0 - x1) * (z - zF)) / (zR - zF);
  const anchors = [
    ...[-1, 1].flatMap((s) => {
      const L = s < 0 ? 'L' : 'R', side = s < 0 ? neg(X) : X;
      return [
        { id: `cans.${L}`, kind: 'flank', at: [s * xSide(zF), yT + 0.62, zF + 0.005], out: side, up: Z },
        { id: `tools.${L}`, kind: 'flank', at: [s * xSide(1.25), 1.75, 1.25], out: side, up: Z },
        { id: `grab.${L}`, kind: 'flank', at: [s * xSide(1.45), -0.75, 1.45], out: side, up: Z },
        { id: `antenna.${L}`, kind: 'panel', at: [s * 0.88, yRp(1.36), 1.36], out: neg(Y), up: Z },
        { id: `bumper.F${L}`, kind: 'bumper', at: [s * 0.55, yN - 0.12, 0.84], out: Y, up: Z },
        { id: `bumper.R${L}`, kind: 'bumper', at: [s * 0.62, yR, 0.8], out: neg(Y), up: Z },
        { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (xSide(1.43) + 0.003), 0.35, 1.43], out: side, up: Z, h: 0.1 },
      ];
    }),
    { id: 'bumper.RC', kind: 'bumper', at: [0, yR, 0.7], out: neg(Y), up: Z },
    { id: 'mark.rear', kind: 'mark', role: 'number', at: [0, yRp(1.22) - 0.003, 1.22], out: neg(Y), up: Z, h: 0.11 },
    { id: 'mark.glacis', kind: 'mark', role: 'emblem', at: [0, 2.15, glacisZ(2.15) + 0.003], out: gn, up: gu, h: 0.12 },
    // (on the turret: they turn with it)
    ...(basketed ? [{ id: 'basket', kind: 'top', bone: 'turret', at: [0, bk - 0.18, 1.76], out: Z, up: neg(Y) }] : []),
    ...[-1, 1].map((s) => {
      const n = [s * (zT - tz), 0, 0.14], d = Math.hypot(...n), out = n.map((q) => q / d), up = [-s * 0.14 / d, 0, (zT - tz) / d];
      return { id: `mark.turret.${s < 0 ? 'L' : 'R'}`, kind: 'mark', role: 'number', bone: 'turret', at: [s * (tx(1.82) + 0.003), yM - 0.25, 1.82], out, up, h: 0.15 };
    }),
  ];
  return { faces: out.filter(Boolean), anchors, zones: { floor: zF - 0.05 }, gear, bones: { turret: [0, yM, tz] } };
}

// ── the tracked carrier: a high troop box on the running gear, its engine forward, its ramp aft ───────────────────
function trackedCarrier(cls, { seed = 1, words = [] } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, gear = trackedGear(cls), rnd = mulberry32((seed * 7919 + 211) >>> 0);
  const yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o));
  // the hull's numbers: its belly, the fenders, the troop box's roof, its sides at their foot and at the roof, the
  // glacis from the nose up to the roof's front, the rear plate (the ramp on it)
  const zB = 0.42, zF = 1.0, zR = 2.02, xL = gear.hullX, x0 = 1.1, x1 = 1.0, yG = yN - 1.35, zN = 1.1, yR = yT + 0.1;
  const glacisZ = (y) => zR - ((zR - zN) * (y - yG)) / (yN - 0.05 - yG);
  const xSide = (z) => x0 - ((x0 - x1) * (z - zF)) / (zR - zF);
  const armour = (name, hide) => (t) => {
    if (hide && hide(t)) return null;
    const n = t.n, part = n[2] < -0.5 ? 'hull.belly' : n[1] > 0.3 && n[2] > 0.3 ? 'hull.glacis' : n[2] > 0.9 ? `${name}.roof` : n[1] < -0.9 ? 'hull.rear' : name;
    return paint(part);
  };
  const weldOn = (a, b, n) => out.push(...weld(a, b, n, { look: M('weld', 'weld', C.olive) }));
  // ── the lower hull between the tracks, and the troop box over it
  out.push(...slab({
    front: [[-xL, zB], [xL, zB], [xL, zF], [-xL, zF]],
    side: [[yR, zF], [yR, 0.6], [yR + 0.25, zB], [yN - 0.75, zB], [yN - 0.05, zF - 0.04], [yN - 0.05, zF]],
    chamfer: 0.025, look: armour('hull.lower', (t) => t.view === 'front' && t.n[2] > 0.99),
  }));
  out.push(...slab({
    front: [[-x0, zF], [x0, zF], [x1, zR], [-x1, zR]],
    side: [[yR, zF], [yR, zR - 0.06], [yR + 0.06, zR], [yG, zR], [yN - 0.05, zN], [yN - 0.05, zF]],
    plan: [[-x0, yR], [x0, yR], [x0, yN - 0.35], [x0 - 0.18, yN - 0.05], [-x0 + 0.18, yN - 0.05], [-x0, yN - 0.35]],
    chamfer: 0.03, look: armour('hull.upper', (t) => t.view === 'front' && t.n[2] < -0.99),
  }));
  weldOn([-x1 + 0.05, yG, zR + 0.002], [x1 - 0.05, yG, zR + 0.002], [0, 0.4, 1]);
  for (const s of [-1, 1]) weldOn([s * x0, yR + 0.01, zF + 0.02], [s * x1, yR + 0.01, zR - 0.08], [s, -1, 0]);
  // ── the fenders, the skirts (fewer carry them), the bins
  const said = trackedWords(words), skirted = said.skirts ?? rnd() < 0.35;
  trackedFenders(out, { hw, x0, zF, yN, yT, skirted, bins: [[-1.9, -0.6], [-0.4, 0.8]], front: 0.32 });
  // ── the glacis: the trim vane folded on it, the engine's grilles on its right, the lamps in their guards
  const gn = (() => { const d = Math.hypot(zR - zN, yN - 0.05 - yG); return [0, (zR - zN) / d, (yN - 0.05 - yG) / d]; })(), gu = [0, -gn[2], gn[1]];
  const onGlacis = (fs, y, x = 0) => place(fs, { origin: [x, y, glacisZ(y)], ex: [1, 0, 0], ey: gn, ez: gu });
  out.push(...onGlacis([...plate({ axis: 'y', profile: rect(-0.95, 0.95, -0.2, 0.2), from: 0.0, to: 0.03, r: 0.01, seg: 1, look: paint('trim.vane') }),
    ...[-0.7, 0, 0.7].flatMap((x) => tube([[x - 0.08, 0.035, -0.2], [x + 0.08, 0.035, -0.2]], 0.025, { sides: 8, look: paint('trim.hinge') })),
    ...bolts([-0.8, -0.4, 0.4, 0.8].map((x) => [x, 0.03, 0.14]), [0, 1, 0], { r: 0.012, h: 0.008, look: paint('bolt') })], yN - 0.42));
  const grille = [...plate({ axis: 'y', profile: rect(-0.42, 0.42, -0.3, 0.3), from: 0, to: 0.02, r: 0.01, seg: 1, look: paint('engine.deck') })];
  for (let z = -0.24; z < 0.26; z += 0.09) grille.push(...plate({ axis: 'z', profile: rect(-0.36, 0.36, 0.02, 0.034), from: z - 0.03, to: z + 0.03, r: 0.004, seg: 1, look: M('engine.grille', 'carbon', C.black) }));
  out.push(...onGlacis(grille, yG + 0.55, 0.48));
  for (const s of [-1, 1]) {
    const x = s * 0.88, y = yN - 0.2, z = glacisZ(y) + 0.13;
    out.push(...tube([[x, y - 0.1, z], [x, y + 0.04, z]], 0.075, { sides: 16, look: (role) => (role === 'cap' ? M('headlamp', 'lamp', C.lamp) : paint('headlamp.bucket')) }));
    out.push(...tube([[x, y - 0.04, glacisZ(y - 0.04) - 0.01], [x, y - 0.04, z - 0.06]], 0.02, { sides: 8, look: paint('headlamp.stem') }));
    for (const ddx of [-0.045, 0, 0.045]) out.push(...tube(bend([[x + ddx, y + 0.02, z - 0.09], [x + ddx, y + 0.09, z - 0.085], [x + ddx, y + 0.09, z + 0.085], [x + ddx, y + 0.02, z + 0.09]], 0.025, 3), 0.007, { sides: 6, look: paint('headlamp.guard') }));
  }
  // ── the roof: the driver's hatch and blocks forward on the left, the commander's cupola ringed by an empty mount,
  // the big troop hatch aft on its hinges
  const ring = (cx, cy, rr, k) => Array.from({ length: k }, (_, i) => [cx + rr * Math.cos((2 * Math.PI * i) / k), cy + rr * Math.sin((2 * Math.PI * i) / k)]);
  const [dx, dy] = [-0.5, yG - 0.35];
  P({ axis: 'z', profile: ring(dx, dy, 0.26, 16), from: zR - 0.01, to: zR + 0.04, r: 0.012, seg: 1, look: paint('hatch.driver') });
  for (const x of [dx - 0.18, dx, dx + 0.18]) {
    P({ axis: 'z', profile: rect(x - 0.065, x + 0.065, yG - 0.12, yG - 0.02), from: zR - 0.01, to: zR + 0.075, r: 0.008, seg: 1, look: M('vision.frame', 'carbon', C.black) });
    out.push(face([[x - 0.05, yG - 0.018, zR + 0.012], [x + 0.05, yG - 0.018, zR + 0.012], [x + 0.05, yG - 0.018, zR + 0.06], [x - 0.05, yG - 0.018, zR + 0.06]], M('vision', 'vision', C.vision), [0, 1, 0]));
  }
  const [cx, cy] = [0.42, yG - 0.55];
  P({ axis: 'z', profile: ring(cx, cy, 0.34, 18), from: zR - 0.02, to: 2.2, r: 0.015, seg: 1, look: paint('cupola') });
  P({ axis: 'z', profile: ring(cx, cy, 0.3, 18), from: 2.2, to: 2.27, r: 0.012, seg: 1, look: paint('cupola.hatch') });
  out.push(...tube(bend([[cx - 0.09, cy, 2.268], [cx - 0.09, cy, 2.288], [cx + 0.09, cy, 2.288], [cx + 0.09, cy, 2.268]], 0.008, 2), 0.012, { sides: 6, look: paint('cupola.handle') }));
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + ((k - 2) * Math.PI) / 4, ox = Math.cos(a), oy = Math.sin(a);
    const block = plate({ axis: 'y', profile: rect(-0.055, 0.055, 2.07, 2.16), from: 0, to: 0.045, r: 0.005, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) });
    out.push(...place(block.filter((f) => f.outNormal[1] > -0.5), { origin: [cx + 0.33 * ox, cy + 0.33 * oy, 0], ex: [oy, -ox, 0], ey: [ox, oy, 0], ez: [0, 0, 1] }));
  }
  // (the mount ring round the cupola, empty: a rail on its posts)
  out.push(...tube([...ring(cx, cy, 0.5, 24), ring(cx, cy, 0.5, 24)[0]].map(([x, y]) => [x, y, 2.16]), 0.022, { sides: 8, caps: false, look: paint('mount.ring') }));
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; out.push(...tube([[cx + 0.5 * Math.cos(a), cy + 0.5 * Math.sin(a), zR], [cx + 0.5 * Math.cos(a), cy + 0.5 * Math.sin(a), 2.16]], 0.02, { sides: 8, look: paint('mount.ring') })); }
  const [h0, h1] = [yR + 0.35, yR + 1.45];
  P({ axis: 'z', profile: rect(-0.68, 0.68, h0, h1), from: zR - 0.01, to: zR + 0.035, r: 0.015, seg: 1, look: paint('hatch') });
  for (const x of [-0.45, 0.45]) out.push(...tube([[x - 0.1, h0 - 0.02, zR + 0.03], [x + 0.1, h0 - 0.02, zR + 0.03]], 0.026, { sides: 8, look: paint('hatch.hinge') }));
  out.push(...tube(bend([[-0.15, h1 - 0.12, zR + 0.035], [-0.15, h1 - 0.12, zR + 0.075], [0.15, h1 - 0.12, zR + 0.075], [0.15, h1 - 0.12, zR + 0.035]], 0.015, 2), 0.011, { sides: 6, look: paint('hatch.handle') }));
  for (const s of [-1, 1]) out.push(...tube(bend([[s * 0.9, h1 + 0.1, zR], [s * 0.9, h1 + 0.1, zR + 0.08], [s * 0.9, yG - 1.0, zR + 0.08], [s * 0.9, yG - 1.0, zR]], 0.04, 3), 0.014, { sides: 8, look: paint('grab') }));
  // ── the rear: the ramp on its hinges, the door in it with its block and handle; the tail lamps in their guards; the
  // exhaust's shield on the right side forward
  const yr = yR - 0.04;
  P({ axis: 'y', profile: rect(-0.75, 0.75, 0.55, 1.9), from: yr, to: yR + 0.01, r: 0.015, seg: 1, look: paint('ramp') });
  for (const x of [-0.55, 0, 0.55]) out.push(...tube([[x - 0.11, yR - 0.05, 0.57], [x + 0.11, yR - 0.05, 0.57]], 0.035, { sides: 10, look: paint('ramp.hinge') }));
  const seam = M('seam', 'seal', '#151614'), back = (x0b, x1b, z0, z1, look) => out.push(face([[x0b, yr - 0.002, z0], [x1b, yr - 0.002, z0], [x1b, yr - 0.002, z1], [x0b, yr - 0.002, z1]], look, [0, -1, 0]));
  back(0.04, 0.58, 0.7, 0.712, seam); back(0.04, 0.58, 1.8, 1.812, seam); back(0.04, 0.052, 0.7, 1.812, seam); back(0.568, 0.58, 0.7, 1.812, seam);
  P({ axis: 'y', profile: rect(0.18, 0.44, 1.48, 1.64), from: yr - 0.03, to: yr, r: 0.006, seg: 1, look: (role) => (role === 'cap' ? M('vision', 'vision', C.vision) : M('vision.frame', 'carbon', C.black)) });
  out.push(...tube(bend([[0.5, yr, 1.15], [0.5, yr - 0.045, 1.15], [0.5, yr - 0.045, 1.33], [0.5, yr, 1.33]], 0.015, 2), 0.012, { sides: 6, look: paint('door.handle') }));
  for (const s of [-1, 1]) {
    const x = s * 0.93;
    P({ axis: 'y', profile: rect(x - 0.06, x + 0.06, 1.75, 1.83), from: yR - 0.016, to: yR, r: 0.005, seg: 1, look: (role) => (role === 'cap' ? M('taillamp', 'tail', C.tail) : M('taillamp.bezel', 'carbon', C.black)) });
    out.push(...tube(bend([[x - 0.09, yR, 1.79], [x - 0.09, yR - 0.07, 1.79], [x + 0.09, yR - 0.07, 1.79], [x + 0.09, yR, 1.79]], 0.03, 2), 0.007, { sides: 6, look: paint('taillamp.guard') }));
  }
  const ex = [...plate({ axis: 'y', profile: rect(-0.28, 0.28, -0.16, 0.16), from: 0, to: 0.06, r: 0.01, seg: 1, look: M('exhaust.shield', 'carbon', C.soot) })];
  for (let x = -0.22; x <= 0.23; x += 0.055) ex.push(...plate({ axis: 'x', profile: rect(0.06, 0.066, -0.12, 0.12), from: x - 0.012, to: x + 0.012, look: M('exhaust.slot', 'carbon', '#0e0e0d') }));
  out.push(...place(ex, { origin: [xSide(1.55), yG + 0.2, 1.55], ex: [0, -1, 0], ey: [1, 0, 0], ez: [0, 0, 1] }));
  // ── the anchors
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = (a) => a.map((q) => -q);
  const anchors = [
    ...[-1, 1].flatMap((s) => {
      const L = s < 0 ? 'L' : 'R', side = s < 0 ? neg(X) : X;
      return [
        { id: `rear.${L}`, kind: 'panel', at: [s * 0.95, yR, 1.08], out: neg(Y), up: Z },
        { id: `antenna.${L}`, kind: 'panel', at: [s * 0.95, yR, 1.95], out: neg(Y), up: Z },
        { id: `tools.${L}`, kind: 'flank', at: [s * xSide(1.45), 1.5, 1.45], out: side, up: Z },
        { id: `bumper.F${L}`, kind: 'bumper', at: [s * 0.55, yN - 0.12, 0.86], out: Y, up: Z },
        { id: `bumper.R${L}`, kind: 'bumper', at: [s * 0.8, yR, 0.62], out: neg(Y), up: Z },
        { id: `mark.${L}`, kind: 'mark', role: 'number', at: [s * (xSide(1.7) + 0.003), -0.2, 1.7], out: side, up: Z, h: 0.13 },
      ];
    }),
    { id: 'top', kind: 'top', at: [0, (h0 + h1) / 2 - 0.85, zR + 0.035], out: Z, up: neg(Y) },
    { id: 'mark.rear', kind: 'mark', role: 'number', at: [-0.38, yr - 0.003, 1.62], out: neg(Y), up: Z, h: 0.12 },
    { id: 'mark.glacis', kind: 'mark', role: 'emblem', at: [-0.45, yG + 0.55, glacisZ(yG + 0.55) + 0.003], out: gn, up: gu, h: 0.12 },
  ];
  return { faces: out.filter(Boolean), anchors, zones: { floor: zF - 0.05 }, gear };
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
  cargo: Object.freeze([
    ['cab.back', 'spareWheel'], ['rail.L', 'fuelTank', { length: 1.0, radius: 0.24 }], ['rail.R', 'stowageBox'],
    ['bed.R', 'jerryCans', { count: 2 }], ['bed.L', 'pioneerTools'], ['cab.flank.R', 'antenna', { lean: -1 }],
    ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }], ['sill.L', 'step', { drop: 1.6 }], ['sill.R', 'step', { drop: 1.6 }],
    ['flap.FL', 'mudFlap', { drop: 0.7 }], ['flap.FR', 'mudFlap', { drop: 0.7 }], ['flap.RL', 'mudFlap', { drop: 0.75 }], ['flap.RR', 'mudFlap', { drop: 0.75 }],
    ['bumper.FL', 'shackle'], ['bumper.FR', 'shackle'], ['bumper.RC', 'pintle'], ['post.L', 'mirror'], ['post.R', 'mirror'],
  ]),
  lightTank: Object.freeze([
    ['cans.L', 'jerryCans', { count: 2 }], ['tools.R', 'pioneerTools'], ['antenna.L', 'antenna', { lean: 1 }], ['antenna.R', 'antenna', { lean: -1 }],
    ['grab.L', 'grabHandle', { width: 0.36 }], ['grab.R', 'grabHandle', { width: 0.36 }],
    ['bumper.FL', 'shackle'], ['bumper.FR', 'shackle'], ['bumper.RL', 'shackle'], ['bumper.RR', 'shackle'], ['bumper.RC', 'pintle'],
    ['basket', 'tarpRoll', { maybe: 0.8, width: 1.2 }],
  ]),
  trackedCarrier: Object.freeze([
    ['rear.L', 'jerryCans'], ['rear.R', 'jerryCans'], ['tools.L', 'pioneerTools'], ['antenna.L', 'antenna', { lean: 1 }], ['antenna.R', 'antenna', { lean: -1 }],
    ['bumper.FL', 'shackle'], ['bumper.FR', 'shackle'], ['bumper.RL', 'shackle'], ['bumper.RR', 'shackle'], ['top', 'tarpRoll', { maybe: 0.5 }],
  ]),
  carrier: Object.freeze([
    ['rear.L', 'jerryCans'], ['rear.R', 'jerryCans'], ['slope.R', 'pioneerTools'],
    ['antenna.L', 'antenna', { lean: 1 }], ['antenna.R', 'antenna', { lean: -1 }], ['grab.L', 'grabHandle', { width: 0.4 }], ['grab.R', 'grabHandle', { width: 0.4 }],
    ['sill.L', 'step', { drop: 3 }], ['sill.R', 'step', { drop: 3 }], ['flap.L', 'mudFlap', { drop: 0.75 }], ['flap.R', 'mudFlap', { drop: 0.75 }],
    ['bumper.FL', 'shackle'], ['bumper.FR', 'shackle'], ['bumper.RL', 'shackle'], ['bumper.RR', 'shackle'], ['bumper.RC', 'pintle'],
    ['post.L', 'mirror'], ['post.R', 'mirror'], ['top', 'tarpRoll', { maybe: 0.6 }],
  ]),
});
const CAN_TONES = Object.freeze(['#4f5726', '#4f5726', '#8a7a55']);
// the bodies built here, by their kind
const BODIES = Object.freeze({ utility, cargo, carrier, lightTank, trackedCarrier });

/** A military class's body (its hull, every face with its corner normals: a plate's own, worked out; a fitting's flat)
 *  and its fittings, its kit's cards on its anchors, rolled from the seed; its livery (livery-cut.js) cut into the paint
 *  of both at once, so a blotch runs on from the hull onto what is fitted to it, and its stencils on its mark anchors. */
export function militaryBody(cls, { seed = 1, r, tyreW, livery, words = [] } = {}) {
  const kind = MILITARY_CLASSES[cls];
  if (!BODIES[kind]) throw new Error(`car-designer: '${cls}' is not a military class built yet (${Object.keys(MILITARY_CLASSES).join(', ')})`);
  const L = readLivery(livery);
  const { faces: own, anchors, zones, gear, bones } = BODIES[kind](cls, { seed, words }), byId = new Map(anchors.map((a) => [a.id, a]));
  // (a tracked body's running gear, each side: what stands still joins the hull, what turns its spinners, their discs in
  // the livery's base as a wheel's rim is)
  const sides = gear ? [-1, 1].map((side) => ({ side, ...runningGear({ side, ...gear, paint: L ? liveryBase(L) : C.olive }) })) : [];
  const faces = [...own, ...sides.flatMap((g) => g.faces)];
  const spinners = sides.flatMap((g) => g.spinners.map((sp) => ({ ...sp, id: `${sp.id}${g.side < 0 ? 'L' : 'R'}`, side: g.side, faces: flatNormals(sp.faces) })));
  const rnd = mulberry32((seed * 2654435761 + 31) >>> 0), v = VEHICLES[cls];
  const fittings = [];
  for (const [id, card, opts = {}] of KITS[kind]) {
    const { maybe, ...words } = opts, roll = rnd();
    if (maybe !== undefined && roll >= maybe) continue;
    // (an anchor the body did not lay this time, a basket it does not carry: nothing fitted there)
    if (!byId.has(id)) continue;
    const ctx = { r: r ?? v.wheelRadius, tyreW: tyreW ?? 0.3, paint: C.olive, seed, ...words };
    if (card === 'jerryCans') ctx.tones = Array.from({ length: ctx.count ?? 1 }, () => CAN_TONES[Math.floor(rnd() * CAN_TONES.length)]);
    if (card === 'antenna') ctx.whip = 1.3 + 0.4 * rnd();
    // (a fitting on a part that turns, a turret's basket, turns with it: its anchor's bone)
    const A = byId.get(id);
    fittings.push(...fit(A, card, ctx).map((f) => ({ ...f, fitting: card, ...(A.bone ? { bone: A.bone } : {}) })));
  }
  const all = flatNormals([...faces, ...fittings]);
  const turning = { ...(spinners.length ? { spinners } : {}), ...(bones ? { bones } : {}) };
  if (!L) return { hull: all.filter((f) => !f.fitting), fittings: all.filter((f) => f.fitting), anchors, zones, ...turning };
  // (the frame and the running gear in the livery's base, a shade down: a sand body is not carried on an olive frame)
  const shade = `#${[1, 3, 5].map((i) => Math.round(parseInt(liveryBase(L).slice(i, i + 2), 16) * 0.62).toString(16).padStart(2, '0')).join('')}`;
  const cut = paintLivery(all, L, { base: C.olive, seed, size: sizeOf(cls) }).map((f) => (f.albedo === C.frame ? { ...f, albedo: shade } : f));
  const marks = [...stencilMarks(anchors.filter((a) => !a.bone), L, { seed }).map((f) => ({ ...f, fitting: 'mark' })),
    ...stencilMarks(anchors.filter((a) => a.bone), L, { seed }).map((f) => ({ ...f, fitting: 'mark', bone: 'turret' }))];
  return { hull: cut.filter((f) => !f.fitting), fittings: flatNormals([...cut.filter((f) => f.fitting), ...marks]), anchors, zones, livery: L, ...turning };
}
