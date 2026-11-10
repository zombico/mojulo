/**
 * THE CITY'S DELIVERY FLEET in the form render: the mail, the courier's parcels and the small trucks that bring the
 * shops their goods, at their classes' true numbers (roads/vehicles.js), in the hull kit's language (mil-hull.js,
 * airside-kit.js, civic-kit.js), drawn, worn and painted as the rest of the city's are (road-civic.js). Classes, not
 * replicas, and in no carrier's livery.
 *
 *   mailTruck   the postal delivery van: short and tall, its bonnet short under an upright screen, driven from the
 *               right; the cargo box under one roof with the cab, its kerbside sliding door, its rear up-and-over door;
 *               its band and pinstripe. Delivering (`delivering`, open) slides its door back
 *   courierVan  the courier's high-roofed panel van: its bonnet, its raked screen, its high roof; blind behind its cab
 *               doors, a sliding door each side, the rear doors; its bands. Delivering slides its right door back
 *   stepVan     the walk-in step van: one tall box from its drooped nose to its tail, its corners rounded, its big
 *               screen in two panes; a doorway at the front of each side over its step, the roll-up door at its rear.
 *               Delivering (`delivering`, unloading, open) opens its doorways and rolls its rear door up (the reach: the
 *               rear door's foot)
 *   lightTruck  the light box truck: a narrow cab-over cab on two axles, the box wider and taller behind it, its corner
 *               posts and its band; the tail lift at its rear, folded up against its doors on the road. Unloading
 *               (`unloading`, delivering) lays the lift out and lowers it to the kerb (the reach: the platform's
 *               height; folded at the floor's). Refrigerated (`refrigerated`, reefer, chilled) carries a fridge unit
 *               on the box's front over the cab
 *   keiTruck    the kei truck: a micro cab-over cab over its front wheels on two small axles, an aluminium box behind
 *               it; `flatbed` (drop side, pickup) gives it a bed with drop sides and a guard behind the cab instead
 *
 *   deliveryAxles(cls, kind)          → the axles' stations (+y forward, the body centred)
 *   deliveryWords(words)              → { reefer, flatbed }
 *   DELIVERY_BODIES, DELIVERY_KITS    the builders and each kind's kit ([anchor, card, words?], mil-fittings.js)
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0. Pure and
 * deterministic.
 */
import { VEHICLES } from '../roads/vehicles.js';
import { plate, tube, face } from './mil-hull.js';
import { CC, own, chassis, cabOver, civicWords, reachOf, without, stripes, band, M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, C } from './civic-kit.js';

/** Where each axle stands (+y forward), the front first. */
export function deliveryAxles(cls, kind) {
  const v = VEHICLES[cls], two = (ahead) => { const yf = v.L / 2 - ahead; return [yf, yf - v.wheelbase]; };
  if (kind === 'mailTruck') return two(0.75);
  if (kind === 'courierVan') return two(0.88);
  if (kind === 'stepVan') return two(1.0);
  if (kind === 'lightTruck') return two(1.15);
  if (kind === 'keiTruck') return two(0.55);
  throw new Error(`car-designer: '${cls}' is not one of the city's delivery fleet`);
}

/** A delivery body's own words: a fridge unit on a box truck, a kei truck's drop-side bed. */
export function deliveryWords(words = []) {
  const W = words.map((w) => String(w).toLowerCase());
  return { reefer: W.some((w) => ['refrigerated', 'reefer', 'chilled', 'cold', 'fridge', 'frozen'].includes(w)), flatbed: W.some((w) => ['flatbed', 'drop side', 'dropside', 'pickup', 'bed', 'open'].includes(w)) };
}

const seam = M('seam', 'seal', '#151614'), glass = M('glass', 'glass', C.glass), black = (part) => M(part, 'carbon', C.black);
const sideFace = (out, s, x, [y0, y1], [z0, z1], look) => out.push(face([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], look, [s, 0, 0]));
// (a rectangle's outline as seams on a side at x)
const outline = (out, s, x, [y0, y1], [z0, z1]) => {
  for (const [a, b, c, d] of [[y0, y0 + 0.012, z0, z1], [y1 - 0.012, y1, z0, z1], [y0, y1, z0, z0 + 0.012], [y0, y1, z1 - 0.012, z1]]) sideFace(out, s, x, [a, b], [c, d], seam);
};
// (a pane on a rake between two points of a side profile, [y, z], across x0..x1, a hair proud)
function rakeGlass(out, a, b, x0, x1, t0 = 0.08, t1 = 0.92, look = glass) {
  // (outward: ahead of a profile rising from its front foot back to its top)
  const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), n = [0, d[1] / l, -d[0] / l];
  const at = (t, x) => [x, a[0] + d[0] * t + n[1] * 0.004, a[1] + d[1] * t + n[2] * 0.004];
  out.push(face([at(t0, x0), at(t0, x1), at(t1, x1), at(t1, x0)], look, n));
  return n;
}
// (a sliding door at a side: shut, its outline and its window; slid back, its panel proud and behind, the doorway dark)
function slider(out, { s, x, y: [y0, y1], z: [z0, z1], win, open }) {
  if (!open) { outline(out, s, x, [y0, y1], [z0, z1]); if (win) sideFace(out, s, x + s * 0.001, [y0 + 0.1, y1 - 0.1], win, glass); return; }
  sideFace(out, s, x + s * 0.002, [y0, y1], [z0, z1], M('doorway', 'seal', '#141516'));
  const w = y1 - y0;
  out.push(...plate({ axis: 'x', profile: rect(y0 - w + 0.05, y0 + 0.05, z0, z1), from: s * (x + 0.01), to: s * (x + 0.05), r: 0.01, seg: 1, look: paint('door.slid') }));
  for (const z of [z0 + 0.02, z1 - 0.02]) out.push(...tube([[s * (x + 0.02), y0 - w, z], [s * (x + 0.02), y1, z]], 0.012, { sides: 6, look: alu('door.rail') }));
}
const sideMarks = (s, { flap, mark, post, h = 0.2 }) => {
  const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
  return [
    ...(post ? [{ id: `post.${L}`, kind: 'post', at: post, out: sd, up: Z }] : []),
    { id: `flap.${L}`, kind: 'flap', at: flap, out: neg(Y), up: Z },
    { id: `mark.${L}`, kind: 'mark', role: 'number', at: mark, out: sd, up: Z, h },
  ];
};
// (a van's nose: its bumpers front and back, its grille, its headlamps and tail lamps, its arches)
function vanEnds(out, { yN, yT, hw, axles, r, zLamp = 1.0, lampW = 0.28 }) {
  const P = (o) => out.push(...plate(o));
  P({ axis: 'x', profile: rect(yN - 0.14, yN, 0.4, 0.7), from: -hw, to: hw, r: 0.04, seg: 2, look: black('bumper') });
  P({ axis: 'x', profile: rect(yT, yT + 0.12, 0.4, 0.66), from: -hw, to: hw, r: 0.04, seg: 2, look: black('bumper') });
  P({ axis: 'y', profile: rect(-0.42, 0.42, 0.76, 0.96), from: yN - 0.08, to: yN - 0.05, look: black('grille') });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.24), yN - 0.11, zLamp], Y, lampW, 0.14, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hw - 0.12), yT, 1.0], neg(Y), 0.12, 0.3, 'tail', 'taillamp'));
    for (const y of axles) out.push(...guard(y, r, r + 0.06, 0.1, Math.PI - 0.1, ...xs(s, hw - 0.3, hw - 0.02), dark('arch')));
  }
}

// ── the postal delivery van ─────────────────────────────────────────────────────
function mailTruck(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, H = v.H, axles = deliveryAxles(cls, 'mailTruck'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), open = civicWords('mailTruck', words).deployed;
  chassis(out, { axles, yT, yN: yf + 0.4, r, hw, zf: 0.5, sideRails: false, rails: [0.32, 0.4], axleHalf: 0.7 });
  // (its lower body to the belt, its short bonnet; its upper, the upright screen and one roof over cab and box)
  const yC = yN - 0.9, zBelt = 1.18, yS = yC - 0.15;
  P({ axis: 'x', profile: [[yT, 0.42], [yN - 0.05, 0.42], [yN - 0.05, 0.85], [yN - 0.28, 1.1], [yC, zBelt + 0.02], [yT, zBelt + 0.02]], from: -hw, to: hw, r: 0.08, seg: 2, look: paint('body') });
  P({ axis: 'x', profile: [[yT, zBelt - 0.02], [yC, zBelt - 0.02], [yS, 2.12], [yC - 0.5, H - 0.01], [yT + 0.06, H], [yT, H - 0.08]], from: -hw + 0.02, to: hw - 0.02, r: 0.08, seg: 2, look: paint('body.upper') });
  rakeGlass(out, [yC, zBelt], [yS, 2.12], -hw + 0.12, hw - 0.12, 0.12, 0.92);
  vanEnds(out, { yN, yT, hw, axles, r, zLamp: 0.95, lampW: 0.22 });
  // (its doors: the cab's on the left, its kerbside slider on the right; the box blind behind; the rear's up-and-over)
  const yd = [yC - 1.0, yC - 0.08];
  outline(out, -1, -hw - 0.002, yd, [0.5, 2.05]);
  sideFace(out, -1, -hw + 0.015, [yd[0] + 0.1, yd[1] - 0.1], [zBelt + 0.08, 1.95], glass);
  slider(out, { s: 1, x: hw - 0.018, y: yd, z: [0.5, 2.1], win: [zBelt + 0.08, 1.95], open });
  sideFace(out, -1, -hw + 0.015, [yC - 0.05, yC + 0.02], [zBelt + 0.05, 1.9], black('pillar'));
  out.push(face([[-hw + 0.12, yT - 0.003, 0.55], [hw - 0.12, yT - 0.003, 0.55], [hw - 0.12, yT - 0.003, H - 0.12], [-hw + 0.12, yT - 0.003, H - 0.12]], paint('door.rear'), neg(Y)));
  for (let z = 0.75; z < H - 0.2; z += 0.3) out.push(face([[-hw + 0.13, yT - 0.006, z], [hw - 0.13, yT - 0.006, z], [hw - 0.13, yT - 0.006, z + 0.012], [-hw + 0.13, yT - 0.006, z + 0.012]], seam, neg(Y)));
  for (const s of [-1, 1]) {
    out.push(...band([s * (hw + 0.001), s > 0 ? yT + 0.1 : yN - 0.35, 0.78], s > 0 ? Y : neg(Y), Z, v.L - 0.45, 0.18, [s, 0, 0], own('body.band', '#24539a', 'milPaint')));
    out.push(...band([s * (hw - 0.018), s > 0 ? yT + 0.1 : yC - 0.1, zBelt + 0.02], s > 0 ? Y : neg(Y), Z, yC - yT - 0.2, 0.04, [s, 0, 0], own('body.stripe', CC.reflRed, 'milPaint')));
  }
  const anchors = [-1, 1].flatMap((s) => sideMarks(s, { post: [s * hw, yC - 0.05, zBelt + 0.2], flap: [s * v.track / 2, yr - r - 0.08, 0.55], mark: [s * (hw - 0.016), yT + 1.0, 1.75], h: 0.16 }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.5, tub: { x: hw, y: [yT, yC], z: [0.42, 0.8] } } };
}

// ── the courier's van ───────────────────────────────────────────────────────────
function courierVan(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, H = v.H, axles = deliveryAxles(cls, 'courierVan'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), open = civicWords('courierVan', words).deployed;
  chassis(out, { axles, yT, yN: yf + 0.6, r, hw, zf: 0.6, sideRails: false, rails: [0.34, 0.42], axleHalf: 0.72 });
  const yC = yN - 0.95, yS = yN - 1.62, yRf = yN - 1.95, zBelt = 1.28;
  P({ axis: 'x', profile: [[yT, 0.45], [yN - 0.06, 0.45], [yN - 0.06, 0.95], [yN - 0.3, 1.18], [yC, zBelt + 0.02], [yT, zBelt + 0.02]], from: -hw, to: hw, r: 0.1, seg: 2, look: paint('body') });
  P({ axis: 'x', profile: [[yT, zBelt - 0.02], [yC, zBelt - 0.02], [yS, 2.2], [yRf, H - 0.03], [yT + 0.08, H], [yT, H - 0.12]], from: -hw + 0.03, to: hw - 0.03, r: 0.1, seg: 2, look: paint('body.upper') });
  rakeGlass(out, [yC, zBelt], [yS, 2.2], -hw + 0.12, hw - 0.12);
  vanEnds(out, { yN, yT, hw, axles, r });
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.003), yd0 = yC - 0.05, yd1 = yC - 1.0;
    outline(out, s, x, [yd1, yd0], [0.5, 2.2]);
    sideFace(out, s, x - s * 0.031, [yd1 + 0.08, yS + 0.2], [zBelt + 0.05, 2.08], glass);
    // (its sliding door behind the cab's, the right one slid back when delivering)
    slider(out, { s, x: s * (hw - 0.028), y: [yd1 - 1.25, yd1 - 0.05], z: [0.5, 2.3], open: open && s > 0 });
    out.push(...band([s * (hw - 0.028), s > 0 ? yT + 0.1 : yd1 - 1.35, 1.95], s > 0 ? Y : neg(Y), Z, yd1 - 1.35 - yT - 0.1, 0.1, [s, 0, 0], own('body.band', CC.amber, 'milPaint')));
    out.push(...band([s * (hw + 0.001), s > 0 ? yT + 0.1 : yC - 0.1, 0.62], s > 0 ? Y : neg(Y), Z, yC - yT - 0.2, 0.06, [s, 0, 0], own('body.band', CC.amber, 'milPaint')));
  }
  out.push(face([[-0.006, yT - 0.004, 0.7], [0.006, yT - 0.004, 0.7], [0.006, yT - 0.004, H - 0.2], [-0.006, yT - 0.004, H - 0.2]], seam, neg(Y)));
  const anchors = [-1, 1].flatMap((s) => sideMarks(s, { post: [s * (hw - 0.03), yC - 0.15, zBelt + 0.15], flap: [s * v.track / 2, yr - r - 0.08, 0.55], mark: [s * (hw - 0.026), yr + 0.95, 1.7], h: 0.18 }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.6, tub: { x: hw, y: [yT, yC], z: [0.45, 0.9] } } };
}

// ── the walk-in step van ────────────────────────────────────────────────────────
function stepVan(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, H = v.H, axles = deliveryAxles(cls, 'stepVan'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), zr = reachOf('stepVan', { words, pose }), open = zr > 0.8;
  chassis(out, { axles, yT, yN: yf + 0.6, r, hw, zf: 0.7, sideRails: false, rails: [0.4, 0.5], axleHalf: 0.8 });
  // (its drooped nose; its box from the screen's foot to its tail, corners rounded; the screen in two panes)
  const yF = yN - 0.55, zF = 1.32, yS = yN - 0.72, zS = 2.7;
  P({ axis: 'x', profile: [[yT, 0.55], [yN - 0.05, 0.55], [yN - 0.05, 1.0], [yF, zF], [yT, zF]], from: -hw + 0.02, to: hw - 0.02, r: 0.1, seg: 2, look: paint('nose') });
  P({ axis: 'x', profile: [[yT, zF - 0.02], [yF, zF - 0.02], [yS, zS], [yN - 0.95, H], [yT, H]], from: -hw, to: hw, r: 0.14, seg: 2, look: paint('box') });
  for (const sx of [-1, 1]) rakeGlass(out, [yF, zF], [yS, zS], ...xs(sx, 0.04, hw - 0.14), 0.06, 0.9);
  rakeGlass(out, [yF, zF], [yS, zS], -0.04, 0.04, 0.06, 0.9, black('pillar'));
  vanEnds(out, { yN, yT, hw, axles, r, zLamp: 0.9, lampW: 0.24 });
  // (its doorways at the front of each side, over their steps: shut, their outlines and glass; open, dark)
  const yd = [yN - 1.75, yN - 0.85];
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.003);
    if (open) sideFace(out, s, x, yd, [0.58, 2.55], M('doorway', 'seal', '#141516'));
    else { outline(out, s, x, yd, [0.58, 2.55]); sideFace(out, s, x + s * 0.001, [yd[0] + 0.08, yd[1] - 0.08], [1.5, 2.4], glass); }
    P({ axis: 'z', profile: rect(...xs(s, hw - 0.4, hw - 0.02), yd[0] + 0.05, yd[1] - 0.05), from: 0.36, to: 0.4, r: 0.008, seg: 1, look: alu('step') });
    out.push(...band([s * (hw + 0.002), s > 0 ? yT + 0.1 : yd[0] - 0.1, 0.95], s > 0 ? Y : neg(Y), Z, yd[0] - yT - 0.2, 0.22, [s, 0, 0], own('body.band', '#24539a', 'milPaint')));
    for (const y of [yN - 1.0, yT + 0.15]) out.push(...lamp([s * (hw - 0.1), y, H - 0.004], Z, 0.08, 0.05, 'marker', 'roof.marker'));
  }
  // (the rear's roll-up door: its slats from its foot to the head, its housing; the box dark under it when it is up)
  const yR = yT - 0.004, zD = Math.max(0.75, zr), zHead = H - 0.2;
  if (zD > 0.8) out.push(face([[-hw + 0.12, yR + 0.002, 0.75], [hw - 0.12, yR + 0.002, 0.75], [hw - 0.12, yR + 0.002, zD], [-hw + 0.12, yR + 0.002, zD]], M('doorway', 'seal', '#141516'), neg(Y)));
  if (zHead - zD > 0.05) out.push(...plate({ axis: 'y', profile: rect(-hw + 0.12, hw - 0.12, zD, zHead), from: yT - 0.02, to: yT, look: paint('door.rear') }));
  for (let z = zD + 0.12; z < zHead - 0.04; z += 0.12) out.push(face([[-hw + 0.13, yT - 0.023, z], [hw - 0.13, yT - 0.023, z], [hw - 0.13, yT - 0.023, z + 0.01], [-hw + 0.13, yT - 0.023, z + 0.01]], seam, neg(Y)));
  out.push(...stripes({ o: [-hw + 0.1, yT - 0.006, 0.42], u: X, v: Z, w: 2 * hw - 0.2, h: 0.2, n: neg(Y), colours: [CC.reflRed, CC.reflWhite] }));
  const anchors = [-1, 1].flatMap((s) => sideMarks(s, { post: [s * hw, yN - 0.8, 2.2], flap: [s * v.track / 2, yr - r - 0.08, 0.6], mark: [s * (hw + 0.004), yT + 1.6, 2.2], h: 0.24 }));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.7, tub: { x: hw, y: [yT, yN - 0.9], z: [0.5, 0.8] } } };
}

// ── the light box truck ─────────────────────────────────────────────────────────
function lightTruck(cls, { words = [], pose = {} } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = deliveryAxles(cls, 'lightTruck'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), { reefer } = deliveryWords(words);
  chassis(out, { axles, yT, yN, r, hw: 1.0, zf: 0.82, sideRails: false, rails: [0.36, 0.44], axleHalf: 0.78 });
  // the narrow cab over its front wheels, its guards, its beacon off
  const z0 = 2 * r + 0.14, z1 = 2.45, yfc = yN - 0.12, ybc = yN - 1.75, hwc = 1.0, cab = [];
  const anchors = cabOver(cab, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  out.push(...without(cab, ['beacon', 'beacon.base']));
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.09, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.36, hwc - 0.02), paint('guard')));
  // the box, wider and taller than the cab: its panels, corner posts, rub rail, band, its doors' seam at the rear
  const hb = hw - 0.01, yB0 = ybc - 0.1, yB1 = yT + 0.1, zb0 = 1.05, zb1 = v.H;
  P({ axis: 'y', profile: rect(-hb + 0.02, hb - 0.02, zb0, zb1 - 0.02), from: yB1, to: yB0, r: 0.02, seg: 1, look: own('box', '#f1f1ec', 'milPaint') });
  for (const [sx, y] of [[-1, yB0], [1, yB0], [-1, yB1], [1, yB1]]) P({ axis: 'z', profile: rect(...xs(sx, hb - 0.07, hb), y - 0.04, y + 0.04), from: zb0, to: zb1, r: 0.01, seg: 1, look: alu('box.post') });
  for (const s of [-1, 1]) {
    out.push(...band([s * (hb - 0.018), s > 0 ? yB1 + 0.1 : yB0 - 0.1, zb0 + 0.25], s > 0 ? Y : neg(Y), Z, yB0 - yB1 - 0.2, 0.2, [s, 0, 0], own('box.band', CC.reflRed, 'milPaint')));
    out.push(...tube([[s * (hb - 0.03), yB1 + 0.05, zb0 + 0.06], [s * (hb - 0.03), yB0 - 0.05, zb0 + 0.06]], 0.025, { sides: 6, look: alu('box.rubrail') }));
    out.push(...lamp([s * (hb - 0.12), yB1 - 0.004, zb0 + 0.25], neg(Y), 0.12, 0.25, 'tail', 'taillamp'));
    out.push(...guard(yr, r, r + 0.08, 0.15, Math.PI - 0.15, ...xs(s, 0.6, hb - 0.03), dark('guard.rear')));
  }
  out.push(face([[-0.006, yB1 - 0.003, zb0 + 0.05], [0.006, yB1 - 0.003, zb0 + 0.05], [0.006, yB1 - 0.003, zb1 - 0.1], [-0.006, yB1 - 0.003, zb1 - 0.1]], seam, neg(Y)));
  // (a fridge unit on the box's front over the cab, when it is refrigerated)
  if (reefer) {
    P({ axis: 'y', profile: rect(-0.75, 0.75, z1 + 0.12, zb1 - 0.12), from: yB0, to: yB0 + 0.32, r: 0.04, seg: 2, look: own('reefer', '#c9ccd0', 'plate') });
    for (const x of [-0.35, 0.35]) out.push(...tube([[x, yB0 + 0.32, (z1 + zb1) / 2], [x, yB0 + 0.335, (z1 + zb1) / 2]], 0.24, { sides: 16, look: black('reefer.fan') }));
  }
  // the tail lift: folded up against the doors on the road; laid out at the floor and lowered to the kerb, its posts
  const zr = reachOf('lightTruck', { words, pose }), folded = zr >= 1.05 - 1e-6, yH = yT + 0.06, len = 1.5, ht = 0.06;
  if (folded) P({ axis: 'y', profile: rect(-hb + 0.08, hb - 0.08, zb0, zb0 + len), from: yT, to: yH, r: 0.01, seg: 1, look: alu('taillift') });
  else P({ axis: 'z', profile: rect(-hb + 0.08, hb - 0.08, yH - len, yH), from: zr, to: zr + ht, r: 0.01, seg: 1, look: alu('taillift') });
  for (const s of [-1, 1]) {
    const x = s * (hb - 0.12), zp = folded ? zb0 : zr;
    out.push(...tube([[x, yH - 0.02, 0.45], [x, yH - 0.02, Math.max(0.5, zb0 - 0.05)]], 0.05, { sides: 8, look: dark('taillift.post') }));
    out.push(...tube([[x, yH - 0.02, zb0 - 0.1], [x, yH - 0.06, zp + 0.03]], 0.035, { sides: 8, look: M('taillift.arm', 'alloy', CC.chrome) }));
  }
  anchors.push(...[-1, 1].flatMap((s) => sideMarks(s, { flap: [s * v.track / 2, yr - r - 0.1, 0.65], mark: [s * (hb - 0.016), (yB0 + yB1) / 2, 2.55], h: 0.26 })));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.82, tub: { x: hw, y: [yT, ybc], z: [0.5, 0.9] } } };
}

// ── the kei truck ───────────────────────────────────────────────────────────────
function keiTruck(cls, { words = [] } = {}) {
  const v = VEHICLES[cls], hw = v.W / 2, r = v.wheelRadius, axles = deliveryAxles(cls, 'keiTruck'), [yf, yr] = axles, yN = v.L / 2, yT = -v.L / 2, out = [];
  const P = (o) => out.push(...plate(o)), { flatbed } = deliveryWords(words);
  chassis(out, { axles, yT, yN, r, hw, zf: 0.62, sideRails: false, rails: [0.28, 0.35], axleHalf: 0.56 });
  // the micro cab over its front wheels, its beacon off
  const z0 = 0.72, z1 = 1.78, yfc = yN - 0.08, ybc = yN - 1.15, hwc = hw - 0.05, cab = [];
  const anchors = cabOver(cab, { yb: ybc, yf: yfc, yN, hw: hwc, z0, z1 });
  // (its beacon off, and its wipers its own: a truck's are longer than its screen is wide)
  out.push(...without(cab, ['beacon', 'beacon.base', 'wiper']));
  for (const s of [-1, 1]) out.push(...tube([[s * 0.1, yfc + 0.03, z0 + 0.45], [s * 0.45, yfc + 0.03, z0 + 0.48]], 0.008, { sides: 6, look: black('wiper') }));
  for (const s of [-1, 1]) out.push(...guard(yf, r, r + 0.06, 0.2, Math.PI - 0.2, ...xs(s, hwc - 0.26, hwc - 0.02), paint('guard')));
  const yB0 = ybc - 0.08, yB1 = yT + 0.03, zb0 = 0.68;
  P({ axis: 'z', profile: rect(-hw + 0.02, hw - 0.02, yB1, yB0), from: zb0 - 0.06, to: zb0, r: 0.01, seg: 1, look: dark('bed') });
  if (flatbed) {
    // (a bed: its drop sides on their hinges, its tailgate, a mesh guard behind the cab)
    for (const s of [-1, 1]) P({ axis: 'x', profile: rect(yB1, yB0, zb0, zb0 + 0.3), from: s * (hw - 0.05), to: s * (hw - 0.01), r: 0.008, seg: 1, look: paint('dropside') });
    P({ axis: 'y', profile: rect(-hw + 0.02, hw - 0.02, zb0, zb0 + 0.3), from: yB1, to: yB1 + 0.04, r: 0.008, seg: 1, look: paint('tailgate') });
    P({ axis: 'y', profile: rect(-hw + 0.04, hw - 0.04, zb0, z1 - 0.05), from: yB0 - 0.04, to: yB0, r: 0.01, seg: 1, look: dark('guard.frame') });
    for (let x = -hw + 0.15; x < hw - 0.1; x += 0.12) out.push(...tube([[x, yB0 - 0.06, zb0 + 0.3], [x, yB0 - 0.06, z1 - 0.1]], 0.008, { sides: 4, look: dark('guard.mesh') }));
  } else {
    // (its aluminium box: its ribs, its rear doors' seam, its lamps)
    P({ axis: 'y', profile: rect(-hw + 0.01, hw - 0.01, zb0, v.H), from: yB1, to: yB0, r: 0.02, seg: 1, look: own('box', CC.chrome, 'steel') });
    for (const s of [-1, 1]) for (let y = yB1 + 0.25; y < yB0 - 0.1; y += 0.4) P({ axis: 'x', profile: rect(y - 0.02, y + 0.02, zb0 + 0.05, v.H - 0.05), from: s * (hw - 0.01), to: s * hw, look: own('box.rib', '#b5b9bc', 'steel') });
    out.push(face([[-0.005, yB1 - 0.003, zb0 + 0.05], [0.005, yB1 - 0.003, zb0 + 0.05], [0.005, yB1 - 0.003, v.H - 0.05], [-0.005, yB1 - 0.003, v.H - 0.05]], seam, neg(Y)));
  }
  for (const s of [-1, 1]) out.push(...lamp([s * (hw - 0.12), yT + 0.02, 0.55], neg(Y), 0.12, 0.12, 'tail', 'taillamp'));
  anchors.push(...[-1, 1].map((s) => sideMarks(s, { flap: [s * v.track / 2, yr - r - 0.06, 0.45], mark: [0, 0, 0] })[0]));
  return { faces: out.filter(Boolean), anchors, zones: { floor: 0.62, tub: { x: hw, y: [yT, ybc], z: [0.35, 0.65] } } };
}

export const DELIVERY_BODIES = Object.freeze({ mailTruck, courierVan, stepVan, lightTruck, keiTruck });

const MIRRORS = [['post.L', 'mirror'], ['post.R', 'mirror']];
/** Each delivery body's kit (mil-fittings.js cards on its anchors). */
export const DELIVERY_KITS = Object.freeze({
  mailTruck: Object.freeze([...MIRRORS]), courierVan: Object.freeze([...MIRRORS]), stepVan: Object.freeze([...MIRRORS]),
  lightTruck: Object.freeze([...MIRRORS, ['sill.L', 'step', { drop: 1.0 }], ['sill.R', 'step', { drop: 1.0 }], ['flap.L', 'mudFlap', { drop: 0.5 }], ['flap.R', 'mudFlap', { drop: 0.5 }]]),
  keiTruck: Object.freeze([...MIRRORS]),
});
