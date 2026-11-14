/**
 * THE FARM KIT: what the farm's machines share (road-farm.js), in the hull kit's language (mil-hull.js) and the civic
 * kit's (civic-kit.js, whose lamps, guards, hinges and beacons they reuse): the glasshouse cab a tractor, a combine and a
 * sprayer are driven from, a truss (a sprayer's boom, a reel's arm), louvred panels, work lamps and the three-point hitch.
 * Classes, not replicas: no maker's colours as a scheme, no badge.
 *
 *   FC                                 the farm's own colours (a rim's cream, the glass's frame, a tank's poly, …)
 *   glassCab(out, { … })               → a four-post cab: its posts, a pane each side and its raked screen, the roof and
 *                                        its overhang, its work lamps and beacon; its anchors (mirrors, grab, number)
 *   truss(out, a, b, { … })            → a lattice beam from a to b: two chords and their lacing
 *   louvres(out, { … })                → a panel's slots on a side
 *   hitch(out, { … })                  → a tractor's three-point hitch: its lower links, its top link, its lift arms
 *                                        and rods, its drawbar, its power take-off
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres. Pure and deterministic.
 */
import { plate, tube, face } from './mil-hull.js';
import { CC, own, M, paint, dark, alu, rect, xs, X, Y, Z, neg, lamp, guard, C, hinge } from './civic-kit.js';
import { beacon } from './airside-kit.js';

// the farm's own colours, unlit: what a livery leaves alone
export const FC = Object.freeze({
  rim: '#d6cfb9', frame: '#202224', poly: '#e9e8e1', steel: '#5a5d5f', reel: '#c9a227', knife: '#9aa0a3', grain: '#c99a3b',
  lamp: '#eef1f3', seat: '#2b2c2e',
});
const glass = M('glass', 'glass', C.glass), black = (part) => M(part, 'carbon', C.black);

/** A four-post cab: from its screen's foot at `yF` back to `yB`, `hw` its half width, its floor `z0`, its roof's foot
 *  `z1`; its screen raked back by `rake` (metres over its height), a pane on each side (its door the left), its rear; the
 *  roof over it, `over` proud all round, its work lamps at its corners, a beacon on top; its anchors. */
export function glassCab(out, { yF, yB, hw, z0, z1, rake = 0.15, over = 0.12, roof = paint('cab.roof'), lamps = true }) {
  const P = (o) => out.push(...plate(o)), zg = z0 + 0.12, post = (x, y0, y1) => out.push(...tube([[x, y0, z0], [x, y1, z1]], 0.035, { sides: 8, look: paint('cab.post') }));
  // (the floor's pan, the posts at its corners, the frame round its roof's foot and its floor)
  P({ axis: 'z', profile: rect(-hw, hw, yB, yF), from: z0 - 0.08, to: z0, r: 0.01, seg: 1, look: dark('cab.floor') });
  for (const s of [-1, 1]) { post(s * hw, yF, yF - rake); post(s * hw, yB, yB); }
  for (const [y0, y1, z] of [[yB, yF, z0], [yB, yF - rake, z1]]) for (const s of [-1, 1]) out.push(...tube([[s * hw, y0, z], [s * hw, y1, z]], 0.025, { sides: 6, look: paint('cab.rail') }));
  // (the glass: the screen raked between its posts, each side's pane between its posts, the rear's; a hair inside)
  const scr = [[-hw + 0.04, yF - 0.004, zg], [hw - 0.04, yF - 0.004, zg], [hw - 0.04, yF - rake - 0.004, z1 - 0.04], [-hw + 0.04, yF - rake - 0.004, z1 - 0.04]];
  out.push(face(scr, glass, [0, 1, rake / (z1 - z0)]));
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.004);
    out.push(face([[x, yB + 0.04, zg], [x, yF - 0.04, zg], [x, yF - rake - 0.04, z1 - 0.04], [x, yB + 0.04, z1 - 0.04]], glass, [s, 0, 0]));
  }
  out.push(face([[-hw + 0.04, yB + 0.004, zg], [hw - 0.04, yB + 0.004, zg], [hw - 0.04, yB + 0.004, z1 - 0.04], [-hw + 0.04, yB + 0.004, z1 - 0.04]], glass, neg(Y)));
  // (inside: the seat and the wheel on its column, seen through the glass)
  const ym = (yF + yB) / 2;
  P({ axis: 'x', profile: [[ym - 0.25, z0], [ym + 0.15, z0], [ym + 0.15, z0 + 0.5], [ym - 0.2, z0 + 0.5], [ym - 0.3, z0 + 1.05], [ym - 0.38, z0 + 1.05]], from: -0.25, to: 0.25, r: 0.04, seg: 1, look: M('seat', 'canvas', FC.seat) });
  out.push(...tube([[0, ym + 0.35, z0 + 0.3], [0, ym + 0.45, z0 + 0.8]], 0.03, { sides: 6, look: black('column') }), ...tube([[-0.18, ym + 0.45, z0 + 0.82], [0.18, ym + 0.45, z0 + 0.82]], 0.02, { sides: 6, look: black('wheel') }));
  // (the roof over it, proud all round, its foot a band; its work lamps along its front, its beacon)
  P({ axis: 'x', profile: [[yB - over, z1], [yF - rake + over, z1], [yF - rake + over + 0.06, z1 + 0.1], [yF - rake + over - 0.05, z1 + 0.2], [yB - over + 0.05, z1 + 0.2]], from: -hw - over, to: hw + over, r: 0.04, seg: 2, look: roof });
  if (lamps) for (const s of [-1, 1]) for (const x of [hw - 0.08, hw - 0.38]) out.push(...lamp([s * x, yF - rake + over + 0.06, z1 + 0.06], Y, 0.16, 0.08, 'lamp', 'worklamp'));
  out.push(...beacon([-hw + 0.25, yB + 0.2, z1 + 0.2]));
  return [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * hw, yF - rake * 0.7, z1 - 0.3], out: sd, up: Z },
      { id: `grab.${L}`, kind: 'flank', at: [s * hw, yB + 0.1, z0 + 0.6], out: sd, up: Z },
    ];
  });
}

/** A lattice beam from a to b (vehicle space), `h` deep (its chords one over the other, `up` the way), its lacing a zigzag
 *  each `pitch`: what a sprayer's boom and a reel's arm are made of. */
export function truss(out, a, b, { h = 0.35, up = Z, pitch = 0.6, r = 0.035, look = paint('boom') }) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d), n = Math.max(1, Math.round(l / pitch));
  const top = (t) => [a[0] + d[0] * t + up[0] * h, a[1] + d[1] * t + up[1] * h, a[2] + d[2] * t + up[2] * h];
  const bot = (t) => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  out.push(...tube([bot(0), bot(1)], r, { sides: 6, look }), ...tube([top(0), top(1)], r * 0.8, { sides: 6, look }));
  for (let k = 0; k < n; k++) out.push(...tube([k % 2 ? top(k / n) : bot(k / n), k % 2 ? bot((k + 1) / n) : top((k + 1) / n)], r * 0.55, { sides: 5, look }));
  out.push(...tube([bot(1), top(1)], r * 0.6, { sides: 5, look }));
}

/** A panel's louvres on a side at x (side s): slots from y0 to y1 between z0 and z1, each `pitch` apart. */
export function louvres(out, { s, x, y0, y1, z0, z1, pitch = 0.07 }) {
  for (let z = z0; z < z1; z += pitch) out.push(face([[x + s * 0.004, y0, z], [x + s * 0.004, y1, z], [x + s * 0.004, y1, z + 0.025], [x + s * 0.004, y0, z + 0.025]], M('louvre', 'seal', '#141516'), [s, 0, 0]));
}

/** A tractor's three-point hitch behind its rear axle at `y` (its tail `yT`): two lower links, the top link, the lift
 *  arms and their rods, the drawbar under them, the power take-off's stub; `drop` lowers the links' ends (an implement
 *  at work). → the hitch points { lower: [[x, y, z]…], top: [x, y, z] } an implement hangs on. */
export function hitch(out, { y, yT, zAxle, drop = 0 }) {
  const steel = dark('hitch'), lowerEnd = (s) => [s * 0.43, yT + 0.005, 0.45 - drop], topEnd = [0, yT + 0.12, 1.15 - drop * 0.6];
  for (const s of [-1, 1]) {
    out.push(...tube([[s * 0.38, y - 0.25, zAxle - 0.35], lowerEnd(s)], 0.045, { sides: 8, look: steel }));
    out.push(...tube([[s * 0.32, y - 0.1, zAxle + 0.38], [s * 0.36, y - 0.72, zAxle + 0.34 - drop * 0.3]], 0.05, { sides: 8, look: steel }));
    out.push(...tube([[s * 0.36, y - 0.7, zAxle + 0.3 - drop * 0.3], [s * 0.42, (y - 0.25 + yT) / 2, (zAxle - 0.35 + 0.45 - drop) / 2]], 0.025, { sides: 6, look: steel }));
  }
  out.push(...tube([[0, y - 0.35, zAxle + 0.25], topEnd], 0.04, { sides: 8, look: M('hitch.toplink', 'steel', FC.steel) }));
  out.push(...plate({ axis: 'y', profile: rect(-0.12, 0.12, 0.42, 0.5), from: yT + 0.25, to: y - 0.2, r: 0.01, seg: 1, look: steel }));
  out.push(...tube([[0, y - 0.3, zAxle - 0.18], [0, y - 0.55, zAxle - 0.18]], 0.035, { sides: 10, look: M('pto', 'steel', FC.knife) }));
  return { lower: [lowerEnd(-1), lowerEnd(1)], top: topEnd };
}

export { CC, own, M, paint, dark, alu, rect, xs, X, Y, Z, neg, lamp, guard, C, hinge, beacon, glass, black };
