/**
 * THE ROAD WHEEL in the form render (road-form.js): a realistic loft's wheel lathed and given depth, in place of the
 * fleet's prism and painted disc. The wheel a road car has, in the supercar wheel's manner (vehicle-odm-surface.js), at a
 * road tyre's proportions:
 *
 *   tyre      lathed: the bead at the rim, a sidewall bulging past it, a rounded shoulder, a tread crowned across
 *   rim       a lip proud at the bead, a barrel recessed behind it (dark: the inside of the wheel), the face its style's:
 *               fiveSpokeAlloy   five spokes, each a solid (its face and its two flanks back into the dish)
 *               wireVintage      many thin spokes to a bright centre
 *               steelie          a pressed dish with a ring of vents and a small cap
 *               heavyDuty        a deep dish, its hub proud, a ring of studs
 *               (none named)     six spokes, a road car's default
 *   brake     a disc behind the face, seen between the spokes
 *   well      on the body, not the turning wheel: the arch's liner, a dark half-ring over the tyre, so the arch reads as
 *             a wheel well and not a gap to the sky; and the brake's caliper on the disc's trailing upper quarter
 *
 *   roadWheel({ hub, r, width, style?, n?, rim? }) → form faces { corners, part, material, albedo, outNormal }, the wheel's
 *   wheelWell({ hub, r, width })                 → the arch liner's and the caliper's form faces (the body's)
 *
 * Vehicle space (+y forward, x across, z up): the wheel turns about x, its outer face toward the side its hub is on.
 * Sizes in metres. Pure and deterministic.
 */

// the colours each part is drawn in (no light in them: the page lights them)
const HEX = Object.freeze({ tread: '#1b1c1f', sidewall: '#232427', barrel: '#33363b', brake: '#6c7075', well: '#121315', cap: '#2c2f33' });
// a style's face: its colour, how many spokes (0: a dish), their share of the arc at the hub and at the rim, the dish's
// depth (a share of the half width the face sits back from the bead), and what it carries
export const WHEEL_STYLES = Object.freeze({
  fiveSpokeAlloy: Object.freeze({ hex: '#c3c7cb', spokes: 5, hubArc: 0.34, rimArc: 0.16, dish: 0.12, material: 'alloy' }),
  wireVintage: Object.freeze({ hex: '#d9dcde', spokes: 24, hubArc: 0.05, rimArc: 0.035, dish: 0.25, material: 'alloy', bright: true }),
  steelie: Object.freeze({ hex: '#9ea2a6', spokes: 0, dish: 0.22, vents: 8, material: 'paint' }),
  heavyDuty: Object.freeze({ hex: '#7d8186', spokes: 0, dish: 0.45, studs: 10, material: 'paint' }),
  road: Object.freeze({ hex: '#b8bcc1', spokes: 6, hubArc: 0.3, rimArc: 0.14, dish: 0.16, material: 'alloy' }),
});

const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
// a face, its normal the polygon's own (Newell's, over every corner: a repeated corner cannot zero it) turned toward
// `toward` (a direction it should face)
function newell(c) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}
function face(corners, part, material, albedo, toward) {
  let n = unit(newell(corners));
  if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) { n = n.map((v) => -v); corners = corners.slice().reverse(); }
  return { corners, part, material, albedo, outNormal: n };
}

// the frame a wheel is drawn in: `ax` metres out from the hub along the axle (outward positive), at radius `rho`, angle t
function frame(hub) {
  const out = Math.sign(hub[0]) || 1;
  const P = (ax, rho, t) => [hub[0] + out * ax, hub[1] + rho * Math.cos(t), hub[2] + rho * Math.sin(t)];
  const radial = (t) => [0, Math.cos(t), Math.sin(t)];
  return { out, P, radial, axial: [out, 0, 0] };
}

/** A road car's wheel, lathed. `width` the tyre's, `r` its radius; the rim's share of the radius is a road tyre's. */
export function roadWheel({ hub, r, width, style = null, n = 32, rim: rimShare = null }) {
  // (a style is a name here, or a style's own record: the car shelf's wheels, car-shelf/car-wheels.js; `rim` the rim's
  // share of the radius, a low-profile tyre's larger)
  const S = style && typeof style === 'object' ? style : WHEEL_STYLES[style] ?? WHEEL_STYLES.road, { P, radial, axial } = frame(hub), hw = width / 2;
  const rim = rimShare ?? (r > 0.45 ? 0.6 : 0.64), faces = [], q = (a, b, c, d) => [a, b, c, d];
  const at = (j) => (2 * Math.PI * j) / n;
  // the tyre: bead to bead over the tread, [axial share of the half width, radius share]
  const side = rim + 0.45 * (1 - rim);
  const prof = [[1, rim], [1.07, side], [1, 0.94], [0.82, 0.99], [0.4, 1], [-0.4, 1], [-0.82, 0.99], [-1, 0.94], [-1.07, side], [-1, rim]];
  for (let j = 0; j < n; j++) {
    const a = at(j), b = at(j + 1), mid = (a + b) / 2;
    for (let k = 0; k < prof.length - 1; k++) {
      const [x0, r0] = prof[k], [x1, r1] = prof[k + 1], wall = k < 2 || k > prof.length - 4;
      // (each band faces out of the tyre: its own normal, turned toward the lathe's outside at its middle)
      const toward = [axial[0] * ((x0 + x1) / 2) * 1.5, ...radial(mid).slice(1).map((v) => v * ((r0 + r1) / 2))];
      faces.push(face(q(P(x0 * hw, r0 * r, a), P(x0 * hw, r0 * r, b), P(x1 * hw, r1 * r, b), P(x1 * hw, r1 * r, a)), wall ? 'sidewall' : 'tyre', 'rubber', wall ? HEX.sidewall : HEX.tread, toward));
    }
    // the rim's lip at the bead, the barrel recessed behind it, the brake disc behind the face
    const lip = rim * r, inner = (rim - 0.05) * r, face0 = hw * (0.92 - S.dish);
    faces.push(face(q(P(hw * 0.98, lip, a), P(hw * 0.98, lip, b), P(hw * 0.9, inner, b), P(hw * 0.9, inner, a)), 'rim.lip', S.material, S.hex, axial));
    faces.push(face(q(P(hw * 0.9, inner, a), P(hw * 0.9, inner, b), P(-hw * 0.6, inner, b), P(-hw * 0.6, inner, a)), 'rim.barrel', 'carbon', HEX.barrel, radial(mid).map((v) => -v)));
    faces.push(face(q(P(-hw * 0.2, 0.2 * r, a), P(-hw * 0.2, 0.2 * r, b), P(-hw * 0.2, (rim - 0.1) * r, b), P(-hw * 0.2, (rim - 0.1) * r, a)), 'wheel.brake', 'brake', HEX.brake, axial));
    // (the barrel closed behind: a sightline past the disc's edge would otherwise run out of the wheel to the ground)
    faces.push(face([P(-hw * 0.6, 0, a), P(-hw * 0.6, inner, a), P(-hw * 0.6, inner, b)], 'rim.back', 'carbon', HEX.well, axial));
    // a dish face (the steelie's and the heavy wheel's): the face as one pressed plate
    if (!S.spokes) faces.push(face(q(P(face0, 0.2 * r, a), P(face0, 0.2 * r, b), P(hw * 0.88, inner, b), P(hw * 0.88, inner, a)), 'wheel.face', S.material, S.hex, axial));
  }
  // the spokes: each a solid from the hub to the rim, its face and its two flanks back into the wheel
  for (let s = 0; s < S.spokes; s++) {
    const c = (2 * Math.PI * s) / S.spokes + Math.PI / 2, h0 = (Math.PI * S.hubArc) / S.spokes, h1 = (Math.PI * S.rimArc) / S.spokes;
    const front = [P(hw * 0.92, 0.18 * r, c - h0), P(hw * 0.92, 0.18 * r, c + h0), P(hw * (0.88 - S.dish), (rim - 0.04) * r, c + h1), P(hw * (0.88 - S.dish), (rim - 0.04) * r, c - h1)];
    const back = front.map((p) => [p[0] - Math.sign(p[0] - hub[0] || 1) * hw * 0.35, p[1], p[2]]);
    faces.push(face(front, 'wheel.spoke', S.material, S.hex, axial));
    for (const [i, j, t] of [[0, 3, c - Math.PI / 2], [1, 2, c + Math.PI / 2]]) faces.push(face(q(front[i], front[j], back[j], back[i]), 'wheel.spoke', S.material, S.hex, radial(t)));
  }
  // the vents round a steelie's dish, the studs round a heavy wheel's hub: small dark and bright marks just proud
  for (let v = 0; v < (S.vents ?? 0); v++) {
    const c = (2 * Math.PI * v) / S.vents, rr = 0.42 * r, w = 0.05 * r, x = hw * (0.92 - S.dish * 0.5) + 0.004;
    faces.push(face(q(P(x, rr - w, c - 0.12), P(x, rr - w, c + 0.12), P(x, rr + w, c + 0.12), P(x, rr + w, c - 0.12)), 'wheel.vent', 'carbon', HEX.barrel, axial));
  }
  for (let v = 0; v < (S.studs ?? 0); v++) {
    const c = (2 * Math.PI * v) / S.studs, rr = 0.26 * r, w = 0.022 * r, x = hw * 0.95 + 0.01;
    faces.push(face(q(P(x, rr - w, c - 0.06), P(x, rr - w, c + 0.06), P(x, rr + w, c + 0.06), P(x, rr + w, c - 0.06)), 'wheel.stud', 'alloy', '#c9ccd0', axial));
  }
  // the centre: a cap over the hub (bright on a wire wheel)
  const capX = S.spokes ? hw * 0.95 : hw * (0.92 - S.dish) + 0.006, m = 12;
  faces.push(face(Array.from({ length: m }, (_, i) => P(capX, 0.19 * r, (2 * Math.PI * i) / m)), 'wheel.hub', S.bright ? 'alloy' : S.material, S.bright ? '#e4e6e8' : S.spokes ? HEX.cap : S.hex, axial));
  return faces;
}

/** What a wheel turns inside, on the body (it never turns with the wheel): the arch's liner, a dark half-ring above the
 *  tyre facing it, and the brake's caliper gripping the disc's trailing upper quarter, seen between the spokes. */
export function wheelWell({ hub, r, width, n = 16 }) {
  const { P, axial, radial } = frame(hub), hw = width / 2, rr = r * 1.06, faces = [], rim = r > 0.45 ? 0.6 : 0.64;
  for (let j = 0; j < n; j++) {
    const a = Math.PI * (0.08 + (0.84 * j) / n), b = Math.PI * (0.08 + (0.84 * (j + 1)) / n), mid = (a + b) / 2;
    faces.push(face([P(hw * 0.8, rr, a), P(hw * 0.8, rr, b), P(-hw - 0.14, rr, b), P(-hw - 0.14, rr, a)], 'wheel.well', 'seal', HEX.well, [0, -Math.cos(mid), -Math.sin(mid)]));
  }
  // the caliper: a block on the disc's rear upper quarter (the wheel's local angle: +y forward, so π·0.7 is up and back)
  const c0 = Math.PI * 0.62, c1 = Math.PI * 0.82, r0 = (rim - 0.2) * r, r1 = (rim - 0.07) * r, x0 = -hw * 0.05, x1 = -hw * 0.38;
  faces.push(face([P(x0, r0, c0), P(x0, r0, c1), P(x0, r1, c1), P(x0, r1, c0)], 'wheel.caliper', 'brake', '#4a4e54', axial));
  faces.push(face([P(x0, r1, c0), P(x0, r1, c1), P(x1, r1, c1), P(x1, r1, c0)], 'wheel.caliper', 'brake', '#4a4e54', radial(Math.PI * 0.72)));
  return faces;
}
