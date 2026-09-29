// construction/members — a member is a stock section run along a centreline, and a cut places that section in a log.
//
// Local frame: x runs the member's length from its `from` end (0 … L), y its width, z its depth. `up` names the world
// direction the depth faces (default: world up for a horizontal member, world +y for a vertical one), so a beam's
// depth stands vertical and a post's faces square to the plan. Every length here is metres; the frame converts the
// recipe's `unit` at its door.
//
// Stock is a section [width, depth] in the recipe's unit, or a named size: metric sawn sizes, North American nominal
// dimension lumber (a 2x4 is 38 × 89 mm, its dressed size), and Japanese sun sizes (3.5-sun = 105 mm, 4-sun = 120 mm,
// the standard post sections).
//
// A cut places the section in its log, section axes to log axes, the member's length up the log from the butt:
//   · 'boxed-heart' — the pith at the centre (the Japanese shinmochi post; it checks, which is why posts get a back
//     kerf, and why it stays straight);
//   · 'free-of-heart' — the pith just outside a corner (shinsari; a larger log, fewer checks);
//   · 'flat' — the thin axis radial, so the wide faces are tangential: the cathedral figure; it cups;
//   · 'quarter' — the wide faces radial: straight stripes, oak's ray fleck, and it stays flat;
//   · 'rift' — the wide faces at 45° to the rays: even stripes, no fleck;
//   · { offset: [a, b], angle } — the section centre `offset` metres off the pith along the log's x and y, the width
//     axis turned `angle` degrees from the log's x.
// Default: boxed-heart for a timber (thin side 75 mm or more, or at least 0.6 of the wide side), flat for a board.

const MM = 0.001;
const SUN = 0.030303;   // one sun (寸), metres

export const STOCK = Object.freeze({
  // North American dimension lumber: nominal → dressed (mm)
  '2x2': [38, 38], '2x3': [38, 64], '2x4': [38, 89], '2x6': [38, 140], '2x8': [38, 184], '2x10': [38, 235], '2x12': [38, 286],
  '4x4': [89, 89], '4x6': [89, 140], '6x6': [140, 140], '6x8': [140, 184], '8x8': [184, 184], '8x10': [184, 235],
  // Japanese post and beam sections (sun), in mm
  '3sun': [91, 91], '3.5sun': [105, 105], '4sun': [120, 120], '5sun': [150, 150],
  'nuki': [27, 105], 'kusabi': [15, 105],
});

const round = (v) => Math.round(v * 1e6) / 1e6;

/** A member's section in metres → [width, depth], or null. `unit` scales a literal pair. */
export function stockSection(stock, unitScale) {
  if (typeof stock === 'string' && STOCK[stock]) return STOCK[stock].map((v) => round(v * MM));
  if (Array.isArray(stock) && stock.length === 2 && stock.every((v) => Number.isFinite(v) && v > 0)) return stock.map((v) => round(v * unitScale));
  return null;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * The member's frame: { origin, ex, ey, ez, L } with ex along the centreline, ez the depth direction (toward `up`),
 * ey = ez × ex. `from`/`to` in metres.
 */
export function memberFrame(from, to, up) {
  const d = sub(to, from); const L = len(d); const ex = unit(d);
  let u = Array.isArray(up) ? unit(up) : (Math.abs(ex[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]);
  // depth must stand square to the length: drop the component along the axis
  u = sub(u, ex.map((v) => v * dot(u, ex)));
  if (len(u) < 1e-6) u = Math.abs(ex[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const ez = unit(u); const ey = cross(ez, ex);
  return { origin: from.slice(), ex, ey, ez, L };
}
/** Local (x, y, z) → world. */
export const toWorld = (F, p) => [0, 1, 2].map((i) => F.origin[i] + F.ex[i] * p[0] + F.ey[i] * p[1] + F.ez[i] * p[2]);
/** World → local (x, y, z). */
export const toLocal = (F, w) => { const q = sub(w, F.origin); return [dot(q, F.ex), dot(q, F.ey), dot(q, F.ez)]; };
/** A local direction → world. */
export const dirWorld = (F, v) => [0, 1, 2].map((i) => F.ex[i] * v[0] + F.ey[i] * v[1] + F.ez[i] * v[2]);

export const CUTS = Object.freeze(['boxed-heart', 'free-of-heart', 'flat', 'quarter', 'rift']);

/** Why a cut is invalid, or null. */
export function cutError(cut) {
  if (cut === undefined || CUTS.includes(cut)) return null;
  if (cut && typeof cut === 'object' && Array.isArray(cut.offset) && cut.offset.length === 2 && cut.offset.every(Number.isFinite) && (cut.angle === undefined || Number.isFinite(cut.angle))) return null;
  return `cut must be one of ${CUTS.join(', ')}, or { offset: [a, b], angle? }`;
}

/**
 * The section's placement in its log: { c: [x, y] centre in the log's cross-section (m), wy, wz: the member's y and z
 * axes as log-plane unit vectors, name }. `W`, `D` are the section's width and depth (m).
 */
export function cutPose(cut, W, D) {
  const name = cut && typeof cut === 'object' ? 'custom' : (cut || (Math.min(W, D) >= 0.075 || Math.min(W, D) / Math.max(W, D) >= 0.6 ? 'boxed-heart' : 'flat'));
  const rot = (deg) => { const a = (deg * Math.PI) / 180; return { wy: [Math.cos(a), Math.sin(a)], wz: [-Math.sin(a), Math.cos(a)] }; };
  const thinIsZ = D <= W;   // the thin axis: the wide faces are normal to it
  const T = Math.min(W, D), Wd = Math.max(W, D);
  switch (name) {
    case 'boxed-heart': return { name, c: [0, 0], ...rot(0) };
    case 'free-of-heart': { const e = 0.02; return { name, c: [W / 2 + e, D / 2 + e], ...rot(0) }; }
    case 'flat': {
      // thin axis along the log's y (radial through the pith), wide axis along x (tangential); the face nearer the
      // pith sits a quarter of the board's width out, so the cathedral shows and the heart stays out of the board
      const e = T / 2 + Math.max(0.015, 0.25 * Wd);
      return thinIsZ ? { name, c: [0, e], ...rot(0) } : { name, c: [0, e], ...rot(-90) };
    }
    case 'quarter': {
      // wide axis radial (along the log's x), from 1.5 cm off the pith outward
      const e = Wd / 2 + 0.015;
      return thinIsZ ? { name, c: [e, 0], ...rot(0) } : { name, c: [e, 0], ...rot(90) };
    }
    case 'rift': {
      const e = Wd / 2 + 0.03; const a = Math.PI / 4;
      return thinIsZ ? { name, c: [e * Math.cos(a), e * Math.sin(a)], ...rot(0) } : { name, c: [e * Math.cos(a), e * Math.sin(a)], ...rot(90) };
    }
    default: return { name, c: cut.offset.slice(), ...rot(Number.isFinite(cut.angle) ? cut.angle : 0) };
  }
}

/** The farthest section corner from the pith (m): how big the log must be under bark. */
export function poseReach(pose, W, D) {
  let r = 0;
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x = pose.c[0] + pose.wy[0] * sy * W / 2 + pose.wz[0] * sz * D / 2;
    const y = pose.c[1] + pose.wy[1] * sy * W / 2 + pose.wz[1] * sz * D / 2;
    r = Math.max(r, Math.hypot(x, y));
  }
  return r;
}

/** Member-local (x, y, z) → log coordinates, given the pose and the butt offset `z0` (the member's x = 0). */
export const localToLog = (pose, z0, p) => [
  pose.c[0] + pose.wy[0] * p[1] + pose.wz[0] * p[2],
  pose.c[1] + pose.wy[1] * p[1] + pose.wz[1] * p[2],
  z0 + p[0],
];
/** A member-local direction → a log direction (no translation). */
export const localDirToLog = (pose, v) => [pose.wy[0] * v[1] + pose.wz[0] * v[2], pose.wy[1] * v[1] + pose.wz[1] * v[2], v[0]];
