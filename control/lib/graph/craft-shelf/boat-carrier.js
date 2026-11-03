/**
 * boat-carrier — the builder of a carrier's flight deck on the craft shelf (boat-odm.js `boat-deck`), merged into
 * BOAT_BUILDERS: a deck laid over a hull from its plan, overhanging it, and what is painted, let into and hung under it.
 * Its catapults and wires are modelled, never worked: a deflector rises and a lift lowers as a pose. Pure.
 *
 *   flight   the deck: a slab `thickness` deep in its plan `outline` (its non-skid top over its painted edge, the gallery
 *            `gallery` deep under it closing its overhang, the hangar's openings in its side behind the lifts), the
 *            angled deck's markings (`angled`: from, angle to port, length, width; its centreline dashed, its edges), the
 *            axial deck's centreline forward (`axial`), catapult tracks (`catapults`: each its start and end in plan)
 *            with a blast deflector hinged aft of each start (`pose.deflector`, 0 flush … 1 raised), arresting wires
 *            across the landing area (`wires`: their distances along the angled deck) on their posts, deck-edge lifts
 *            outboard of its edge (`lifts`: inboard edge `x`, `y` [from, to], `width` outboard, `side` ±1; they lower
 *            `drop` with `pose.lift`), sponsons hung under its edge for weapons (`sponsons`: at, width, length,
 *            braced to the deck's underside), its parking spots (`spots`: [x, y, heading], each `spot` long and wide).
 *            Points: `mount` (the middle of its underside), `island`, `sponson_<k>` (a sponson's top), `spot_<k>`
 *            (a spot on the deck's top), and the row's `points` on its top
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { DEG, lathe, sweep, extrudeWorld, planeUV, round3, tone } from './craft-common.js';

const r3v = (v) => v.map(round3);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => a.map((v) => v * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
const E = (id, from, to, offsets, tint, extra) => extrudeWorld(id, from, to, ccw(from, to, offsets), tint, extra);
// (a box in plan: x0…x1 across, y0…y1 along, z0…z1 up)
const box = (id, [x0, x1], [y0, y1], [z0, z1], tint) => E(id, [0, 0, z0], [0, 0, z1], [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], tint);
// (the flight deck's non-skid, its paint's white and yellow, the tracks' slots and the wires' steel: the same on any
// carrier, whatever its hull's paint)
const DECK = '#4e5154', WHITE = '#e4e4de', YELLOW = '#d9b23a', SLOT = '#2b2d2f', STEEL = '#3a3c3e';

export function buildFlightDeck(row, C, opts = {}) {
  const b = row.build, pose = opts.pose || {}, T = b.thickness, zp = T + 0.02;
  const extrudes = [], sweeps = [], lathes = [], joints = [];
  const plan = b.outline.map(([x, y]) => [x, y, 0]);
  // the slab: its edge in the hull's paint, its top the non-skid; the gallery under it (`gallery` deep), the deck's
  // overhang closed down to it in the hull's paint, the hangar's openings in its side behind the lifts
  extrudes.push(E('deck_edge', [0, 0, -(b.gallery ?? 0)], [0, 0, T - 0.12], plan, C.paint));
  extrudes.push(E('deck', [0, 0, T - 0.15], [0, 0, T], plan, DECK));
  // the angled deck: its centreline dashed down its middle, its edges either side
  const A = b.angled, a = A.angle * DEG, u = [-Math.sin(a), Math.cos(a), 0], n = [Math.cos(a), Math.sin(a), 0], P0 = [A.from[0], A.from[1], zp];
  const along = (d, off = 0) => add(add(P0, mul(u, d)), mul(n, off));
  for (let d = 0, k = 0; d + 6 <= A.length; d += 14, k += 1) sweeps.push(sweep(`angled_centre_${k}`, [along(d), along(d + 7)], 0.14, WHITE, { sides: 4 }));
  for (const [s, side] of [[1, 'r'], [-1, 'l']]) sweeps.push(sweep(`angled_edge_${side}`, [along(0, s * A.width / 2), along(A.length, s * A.width / 2)], 0.14, WHITE, { sides: 4 }));
  // the axial deck's centreline forward of the angled deck
  if (b.axial) for (let y = b.axial[0], k = 0; y + 6 <= b.axial[1]; y += 14, k += 1) sweeps.push(sweep(`axial_centre_${k}`, [[0, y, zp], [0, y + 7, zp]], 0.14, YELLOW, { sides: 4 }));
  // the catapults: each a slot along its track, its shuttle at its start, a blast deflector hinged aft of it
  const lift = clamp(pose.lift, 0, 1), defl = clamp(pose.deflector, 0, 1) * (b.deflector?.angle ?? 55) * DEG;
  for (const [k, [[x0, y0], [x1, y1]]] of (b.catapults || []).entries()) {
    const len = Math.hypot(x1 - x0, y1 - y0), c = [(x1 - x0) / len, (y1 - y0) / len, 0], w = [c[1], -c[0], 0];
    extrudes.push(E(`catapult_${k}`, [x0, y0, T - 0.05], [x1, y1, T - 0.05], [mul(w, 0.35), mul(w, -0.35), add(mul(w, -0.35), [0, 0, 0.09]), add(mul(w, 0.35), [0, 0, 0.09])], SLOT));
    extrudes.push(E(`shuttle_${k}`, [x0, y0, T], [x0 + c[0] * 1.2, y0 + c[1] * 1.2, T], [mul(w, 0.3), mul(w, -0.3), add(mul(w, -0.3), [0, 0, 0.3]), add(mul(w, 0.3), [0, 0, 0.3])], STEEL));
    // (the deflector: a plate hinged across the deck at its fore edge, its aft edge rising; flush at rest)
    const D = b.deflector, H = [x0 - c[0] * D.gap, y0 - c[1] * D.gap, T], pl = add(mul(c, -Math.cos(defl)), [0, 0, Math.sin(defl)]), q = add(mul(c, Math.sin(defl)), [0, 0, Math.cos(defl)]);
    extrudes.push(E(`deflector_${k}`, add(H, mul(w, D.width / 2)), add(H, mul(w, -D.width / 2)), [[0, 0, 0], mul(pl, D.depth), add(mul(pl, D.depth), mul(q, 0.3)), mul(q, 0.3)], tone(C.paint, -0.2)));
    joints.push({ name: `deflector_${k}`, control: 'deflector', kind: 'hinge', at: r3v(H), dir: r3v(w), range: [0, D.angle ?? 55], angle: round3(defl / DEG) || 0 });
  }
  // the arresting wires across the landing area, each on its two posts
  for (const [k, d] of (b.wires || []).entries()) {
    const e0 = along(d, -(A.width / 2 - 1.5)), e1 = along(d, A.width / 2 - 1.5);
    sweeps.push(sweep(`wire_${k}`, [add(e0, [0, 0, 0.12]), add(e1, [0, 0, 0.12])], 0.04, STEEL, { sides: 6 }));
    for (const [j, e] of [e0, e1].entries()) lathes.push(lathe(`wire_post_${k}${j ? 'l' : 'r'}`, add(e, [0, 0, -0.04]), add(e, [0, 0, 0.16]), [[0, 0.18], [1, 0.14]], STEEL, { samples: 10, crossSections: 2 }));
  }
  // the deck-edge lifts: a platform outboard of the edge, flush with the deck up, lowered `drop` with the pose
  for (const [k, L] of (b.lifts || []).entries()) {
    const dz = -lift * L.drop, xs = [L.x, L.x + L.side * L.width].sort((p, q) => p - q);
    extrudes.push(box(`lift_${k}`, xs, L.y, [T - 1.0 + dz, T + dz], DECK));
    if (b.gallery) extrudes.push(box(`hangar_opening_${k}`, [L.x - 0.1, L.x + 0.08].map((v) => (L.side > 0 ? v : -v)).sort((p, q) => p - q), [L.y[0] + 1, L.y[1] - 1], [Math.max(-b.gallery + 0.6, T - L.drop - 1), T - 1.4], SLOT));
    sweeps.push(sweep(`lift_edge_${k}`, [[xs[0] + 0.3, L.y[0] + 0.3, zp + dz], [xs[1] - 0.3, L.y[0] + 0.3, zp + dz], [xs[1] - 0.3, L.y[1] - 0.3, zp + dz], [xs[0] + 0.3, L.y[1] - 0.3, zp + dz], [xs[0] + 0.3, L.y[0] + 0.3, zp + dz]], 0.12, YELLOW, { sides: 4 }));
    joints.push({ name: `lift_${k}`, control: 'lift', kind: 'slide', at: r3v([(xs[0] + xs[1]) / 2, (L.y[0] + L.y[1]) / 2, T]), dir: [0, 0, -1], range: [0, L.drop], travel: round3(lift * L.drop) });
  }
  const hardpoints = { mount: [0, 0, 0] };
  // the sponsons under its edge: a platform at the deck's underside reaching outboard, a brace under it back inboard
  for (const [k, S] of (b.sponsons || []).entries()) {
    const [x, y] = S.at, sx = Math.sign(x) || 1, xi = x - sx * S.width / 2, xo = x + sx * S.width / 2;
    extrudes.push(box(`sponson_${k}`, [xi, xo].sort((p, q) => p - q), [y - S.length / 2, y + S.length / 2], [-1.2, 0.05], C.paint));
    // (its brace: a gusset under the platform from its outboard edge down to the deck's side, inboard)
    extrudes.push(E(`sponson_brace_${k}`, [x, y - S.length / 2 + 1, 0], [x, y + S.length / 2 - 1, 0], [[sx * (S.width / 2 - 0.6), 0, -1.15], [-sx * S.width / 2, 0, -1.15], [-sx * S.width / 2, 0, -1.15 - S.width * 0.45]], tone(C.paint, -0.08)));
    hardpoints[`sponson_${k}`] = r3v([x, y, 0.05]);
  }
  hardpoints.island = r3v([b.island[0], b.island[1], T]);
  for (const [k, [x, y]] of (b.spots || []).entries()) hardpoints[`spot_${k}`] = r3v([x, y, T]);
  for (const [name, [x, y, z]] of Object.entries(b.points || {})) hardpoints[name] = r3v([x, y, T + (z ?? 0)]);
  return { extrudes, sweeps, lathes, hardpoints, joints };
}

export const CARRIER_BUILDERS = { 'boat-deck': buildFlightDeck };
