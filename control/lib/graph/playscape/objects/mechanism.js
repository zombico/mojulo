/**
 * mechanism — how a game object's moving parts move, apart from how they look. Three joints cover doors, gates, lids,
 * drawers, levers and lifts:
 *
 *   hinge   turns about a vertical edge (`pivot`, the u of the edge), a quarter turn toward the front (`toward`: +1 or -1)
 *   slide   runs along the wall by `travel` metres (`dir`: -1 left, +1 right)
 *   lift    rises by `travel` metres
 *
 * A LEAF is a box in the opening's own frame (u across from the opening's middle, n out of the wall toward the front,
 * z up from the sill), closed at t = 0 and fully moved at t = 1. Everything else follows from the leaves and t, so an
 * engine, a level or a rule can ask the object what it needs without knowing what it is:
 *
 *   poseLeaf(leaf, t)            → { c, yaw, half }      the leaf's box at t
 *   leafTransform(leaf, t)       → (p) => p'             moves a point built on the closed leaf to where it is at t
 *   collider(leaves, t)          → [{ min, max, of }]    what blocks, at t
 *   sweep(leaves)                → [{ min, max, of }]    the space each leaf passes through on its way (keep it clear)
 *   clearance(leaves, opening, t, walker) → { width, height, passable }   what a walker can get through, at t
 *
 * All in the opening's frame; toWorld(frame) maps them out. Pure; rounded like the faces.
 */

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);

/** The leaf's box at t: centre, yaw about z (radians) and half sizes along its own width, thickness and height. */
export function poseLeaf(leaf, t) {
  const [u0, u1] = leaf.span, [z0, z1] = leaf.rise, w = u1 - u0, h = z1 - z0, half = [w / 2, leaf.thick / 2, h / 2];
  const c = [(u0 + u1) / 2, 0, (z0 + z1) / 2], J = leaf.joint;
  if (J.type === 'hinge') {
    const a = J.toward * (J.pivot <= c[0] ? 1 : -1) * J.angle * t;   // the left edge turns +, the right edge −, toward the front
    const du = c[0] - J.pivot, ca = Math.cos(a), sa = Math.sin(a);
    return { c: [J.pivot + du * ca, du * sa, c[2]], yaw: a, half };
  }
  if (J.type === 'slide') return { c: [c[0] + J.dir * J.travel * t, 0, c[2]], yaw: 0, half };
  if (J.type === 'lift') return { c: [c[0], 0, c[2] + J.travel * t], yaw: 0, half };
  throw new Error(`mechanism: unknown joint '${J.type}' (hinge, slide, lift)`);
}

/** A function moving a point built on the closed leaf to where the leaf is at t. */
export function leafTransform(leaf, t) {
  const J = leaf.joint;
  if (J.type === 'hinge') {
    const { yaw } = poseLeaf(leaf, t), ca = Math.cos(yaw), sa = Math.sin(yaw);
    return (p) => P([J.pivot + (p[0] - J.pivot) * ca - p[1] * sa, (p[0] - J.pivot) * sa + p[1] * ca, p[2]]);
  }
  if (J.type === 'slide') return (p) => P([p[0] + J.dir * J.travel * t, p[1], p[2]]);
  return (p) => P([p[0], p[1], p[2] + J.travel * t]);
}

/** The axis-aligned box around a posed leaf. */
function aabb({ c, yaw, half }) {
  const ca = Math.abs(Math.cos(yaw)), sa = Math.abs(Math.sin(yaw));
  const eu = half[0] * ca + half[1] * sa, en = half[0] * sa + half[1] * ca;
  return { min: P([c[0] - eu, c[1] - en, c[2] - half[2]]), max: P([c[0] + eu, c[1] + en, c[2] + half[2]]) };
}

export const collider = (leaves, t) => leaves.map((L) => ({ ...aabb(poseLeaf(L, t)), of: L.id }));

/** The space each leaf passes through from closed to fully moved: the box around its poses along the way. */
export function sweep(leaves, steps = 16) {
  return leaves.map((L) => {
    const bs = Array.from({ length: steps + 1 }, (_, i) => aabb(poseLeaf(L, i / steps)));
    return { min: P([0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k])))), max: P([0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k])))), of: L.id };
  });
}

/**
 * What a walker can get through the opening at t: the widest free run across the opening, below the walker's height,
 * within `depth` metres either side of the wall; and the free height over it. A leaf standing open against the jamb
 * takes its thickness off the width, as a real door does.
 */
export function clearance(leaves, { width: W, height: H }, t, { width: ww = 0.6, height: wh = 1.8, depth = 0.6 } = {}) {
  const boxes = collider(leaves, t).filter((b) => b.min[1] < depth && b.max[1] > -depth);
  const low = boxes.filter((b) => b.min[2] < Math.min(wh, H));
  const cuts = low.map((b) => [Math.max(-W / 2, b.min[0]), Math.min(W / 2, b.max[0])]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let best = 0, run = [0, 0], from = -W / 2;
  const take = (a) => { if (a - from > best) { best = a - from; run = [from, a]; } };
  for (const [a, b] of cuts) { take(a); from = Math.max(from, b); }
  take(W / 2);
  // the free height over that run: up to the lowest leaf bottom standing over it (a raised gate), else the opening's
  const over = boxes.filter((b) => b.min[0] < run[1] && b.max[0] > run[0]).map((b) => b.min[2]);
  const height = best > 0 ? Math.min(H, ...over) : 0;
  return { width: r5(Math.max(0, best)), height: r5(height), passable: best >= ww && height >= Math.min(wh, H) };
}

/** Map a point from the opening's frame ({ at, N, U }) to the world. */
export const toWorld = ({ at, N, U }) => (p) => P([0, 1, 2].map((k) => at[k] + U[k] * p[0] + N[k] * p[1] + (k === 2 ? p[2] : 0)));
