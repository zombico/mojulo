/**
 * THE JET BRIDGE at full scale: an apron-drive passenger boarding bridge from a pier's face to an aircraft's door, in the
 * hull kit's language (car-designer/mil-hull.js), posed by the plan's stand (plan.js: its root on the pier's face, its
 * rotunda off it, the door at its sill), as the stair truck is posed to the same door.
 *
 *   link      the fixed glazed corridor from the pier's face to the rotunda, at the pier's departure level
 *   rotunda   the drum the tunnel swings about, on its column
 *   tunnel    two telescoping sections from the rotunda to the cab, the inner sliding in the outer, sloping from the
 *             departure level down (or up) to the door's sill; a window band along each side
 *   drive     the lift columns at two-thirds of the way, telescoping, on the wheeled bogie that drives it over the apron
 *   cab       the cab at the tunnel's end, turned square to the fuselage, its floor at the sill, its canopy's dark bellows
 *             reaching the skin round the door
 *
 *   jetBridge({ root, rotunda, door, deck?, side, skinGap? }) → form faces { corners, part, material, albedo, outNormal }
 *     root, rotunda   [x, y] on the ground; door [x, y, sill]; deck the departure level (m, 5.5 by default); side the
 *                     fuselage's outward normal at the door ([x, y], toward the bridge)
 *
 * World space (x, y the ground, z up), metres. Pure and deterministic.
 */
import { plate, tube, face, flatNormals } from '../car-designer/mil-hull.js';

const M = (part, material, albedo) => ({ part, material, albedo });
const C = Object.freeze({ skin: '#d6d9dc', frame: '#8f979e', glass: '#2e3c47', rubber: '#1d1e20', steel: '#5c6166', wheel: '#1a1b1d' });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const d = len(a) || 1; return [a[0] / d, a[1] / d, a[2] / d]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// a box along a 3D line from a to b, w wide (across, horizontal) and h tall (its up square to the line), its faces looked
// up by side; a box's frame: along, across, up
function beamBox(a, b, w, h, look, { glass = null } = {}) {
  const ax = unit(sub(b, a)), across = unit(cross([0, 0, 1], ax)), up = unit(cross(ax, across)), out = [];
  const P = (p, s, t) => add(add(p, mul(across, s * w / 2)), mul(up, t * h));
  const corners = (p) => [P(p, -1, 0), P(p, 1, 0), P(p, 1, 1), P(p, -1, 1)];
  const A = corners(a), B = corners(b);
  const sides = [['floor', [A[0], A[1], B[1], B[0]], mul(up, -1)], ['wall.r', [A[1], A[2], B[2], B[1]], across], ['roof', [A[2], A[3], B[3], B[2]], up], ['wall.l', [A[3], A[0], B[0], B[3]], mul(across, -1)]];
  for (const [part, cs, n] of sides) out.push(face(cs, typeof look === 'function' ? look(part) : look, n));
  // (a window band along each wall: dark glass a little proud)
  if (glass) for (const [s, n] of [[1, across], [-1, mul(across, -1)]]) {
    const q = (p, t) => add(add(add(p, mul(across, s * (w / 2 + 0.01))), mul(up, t * h)), [0, 0, 0]);
    out.push(face([q(a, 0.38), q(b, 0.38), q(b, 0.78), q(a, 0.78)].map((p, i) => add(p, mul(ax, i === 0 || i === 3 ? 0.3 : -0.3))), glass, n));
  }
  return out.filter(Boolean);
}

/** A jet bridge from a pier's face to an aircraft's door. */
export function jetBridge({ root, rotunda, door, deck = 5.5, side, skinGap = 0.25 }) {
  const out = [], skin = M('bridge', 'milPaint', C.skin), frame = M('bridge.frame', 'steel', C.frame), glass = M('bridge.glass', 'glass', C.glass);
  const R = [rotunda[0], rotunda[1], deck], D = [door[0], door[1], door[2]];
  // the fixed link from the pier's face to the rotunda, glazed, at the departure level
  out.push(...beamBox([root[0], root[1], deck], R, 3.0, 2.9, skin, { glass }));
  // the rotunda's drum on its column
  out.push(...tube([[R[0], R[1], 0], [R[0], R[1], deck - 0.2]], 0.45, { sides: 12, look: frame }));
  out.push(...tube([[R[0], R[1], deck - 0.25], [R[0], R[1], deck + 3.1]], 2.3, { sides: 16, look: (role) => (role === 'cap' ? skin : skin) }));
  // the cab square to the fuselage at the door, its floor at the sill, backed off the skin by its bellows' reach
  const n = unit([side[0], side[1], 0]), cabC = add(D, mul(n, skinGap + 1.4)), cabBack = add(D, mul(n, skinGap + 2.8));
  // the tunnel from the rotunda's rim to the cab's back: two sections, the inner within the outer
  const dir = unit(sub(cabBack, R)), start = add(R, mul([dir[0], dir[1], 0], 2.3)), span = len(sub(cabBack, start));
  const mid = add(start, mul(unit(sub(cabBack, start)), span * 0.55));
  out.push(...beamBox(start, add(mid, mul(unit(sub(cabBack, start)), 0.6)), 3.0, 2.95, skin, { glass }));
  out.push(...beamBox(mid, cabBack, 2.7, 2.7, skin, { glass }));
  // the drive: two lift columns at two-thirds of the way, telescoping down to the wheeled bogie
  const at = add(start, mul(unit(sub(cabBack, start)), span * 0.68)), across = unit(cross([0, 0, 1], unit(sub(cabBack, start))));
  for (const s of [-1, 1]) {
    const top = add(at, mul(across, s * 1.1));
    out.push(...tube([[top[0], top[1], 0.9], [top[0], top[1], top[2] - 0.05]], 0.16, { sides: 8, look: frame }));
    out.push(...tube([[top[0], top[1], 0.9], [top[0], top[1], Math.max(1.2, top[2] * 0.55)]], 0.22, { sides: 8, look: frame }));
    out.push(...tube([add([top[0], top[1], 0.45], mul(unit(sub(cabBack, start)), -0.4)), add([top[0], top[1], 0.45], mul(unit(sub(cabBack, start)), 0.4))].map((p) => p), 0.45, { sides: 14, look: M('bridge.wheel', 'rubber', C.wheel) }));
  }
  out.push(...plate({ axis: 'z', profile: [[-1.4, -0.5], [1.4, -0.5], [1.4, 0.5], [-1.4, 0.5]].map(([u, v]) => [at[0] + across[0] * u + dir[0] * v, at[1] + across[1] * u + dir[1] * v]), from: 0.75, to: 0.95, look: frame }));
  // the cab: a box square to the fuselage, its floor at the sill; its canopy's bellows from its mouth to the skin
  const cabW = 3.4, cabH = 2.8, t = unit(cross([0, 0, 1], n));
  const box = (c, hw, hd, z0, z1, look) => plate({ axis: 'z', profile: [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [c[0] + t[0] * u + n[0] * v, c[1] + t[1] * u + n[1] * v]), from: z0, to: z1, r: 0.04, seg: 1, look });
  out.push(...box(cabC, cabW / 2, 1.4, D[2] - 0.3, D[2] + cabH, skin));
  out.push(...box(add(D, mul(n, skinGap + 0.06)), cabW / 2 - 0.25, 0.32, D[2] - 0.15, D[2] + cabH - 0.2, M('bridge.bellows', 'rubber', C.rubber)));
  for (let k = 0; k < 4; k++) out.push(...box(add(D, mul(n, skinGap + 0.1 + k * 0.14)), cabW / 2 - 0.2, 0.03, D[2] - 0.1, D[2] + cabH - 0.15, M('bridge.bellows.rib', 'rubber', '#2b2c2e')));
  out.push(face([add(cabC, add(mul(t, -1.2), [0, 0, D[2] - cabC[2] + 1.0])), add(cabC, add(mul(t, 1.2), [0, 0, D[2] - cabC[2] + 1.0])), add(cabC, add(mul(t, 1.2), [0, 0, D[2] - cabC[2] + 2.2])), add(cabC, add(mul(t, -1.2), [0, 0, D[2] - cabC[2] + 2.2]))].map((p) => add(p, mul(n, 1.41))), glass, n));
  return flatNormals(out.filter(Boolean));
}
