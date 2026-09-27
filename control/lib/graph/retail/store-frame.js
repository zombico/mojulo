// The unit frame — every card authors in it, every builder builds in it.
//
// LOCAL frame (feet): x = lateral (0 at the LEFT jamb as you walk in, +x = your right hand),
// y = depth (0 at the storefront glass, +y = into the store), z = up. A fixture's customer
// face is −y (toward the door); a wall-backed fixture backs +y.
//
// The world placement is a PROPER rotation (det +1) + translation, so a unit whose front
// faces the concourse on any side (mall bay E/W/N/S, or a standalone shop's street) runs the
// same card through the same builders. Light is rotated INTO the local frame before baking,
// so faces are shaded as they will sit in the world.

import { makeLight } from '../polygonizer/vexar.js';

export const WORLD_LIGHT_DIR = [0.34, 0.42, -0.84];

// the inward depth direction for each storefront side (the side the glass is on)
const INWARD = { S: [0, 1], N: [0, -1], W: [1, 0], E: [-1, 0] };

/**
 * rect = the unit's INTERIOR sales-floor rect in world {x0,x1,y0,y1}; front = the side the glass
 * is on. Returns the frame: size, local→world point, world AABB of a local rect, face transform.
 */
export function unitFrame(rect, front = 'S') {
  const d = INWARD[front];
  if (!d) throw new Error(`unitFrame: unknown front '${front}'`);
  const r = [d[1], -d[0]];                       // right hand when facing d
  const wx = rect.x1 - rect.x0, wy = rect.y1 - rect.y0;
  const W = Math.abs(r[0]) ? wx : wy;            // lateral extent
  const D = Math.abs(d[0]) ? wx : wy;            // depth extent
  // origin = the front-left corner (lateral 0, depth 0)
  const ox = r[0] < 0 || d[0] < 0 ? rect.x1 : rect.x0;
  const oy = r[1] < 0 || d[1] < 0 ? rect.y1 : rect.y0;
  const toWorld = (lx, ly) => [ox + lx * r[0] + ly * d[0], oy + lx * r[1] + ly * d[1]];
  const vec = (vx, vy) => [vx * r[0] + vy * d[0], vx * r[1] + vy * d[1]];
  const toLocal = (x, y) => { const px = x - ox, py = y - oy; return [px * r[0] + py * r[1], px * d[0] + py * d[1]]; };
  const aabb = (l) => {                          // local {x0,x1,y0,y1} → world AABB
    const a = toWorld(l.x0, l.y0), b = toWorld(l.x1, l.y1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };
  };
  const xf = (f) => {
    const out = { ...f, corners: f.corners.map((c) => { const [x, y] = toWorld(c[0], c[1]); return [x, y, c[2]]; }) };
    if (f.normal) { const [nx, ny] = vec(f.normal[0], f.normal[1]); out.normal = [nx, ny, f.normal[2]]; }
    return out;
  };
  const lw = WORLD_LIGHT_DIR;
  const localLight = makeLight({ direction: [lw[0] * r[0] + lw[1] * r[1], lw[0] * d[0] + lw[1] * d[1], lw[2]], ambient: 0.54, diffuse: 0.5 });
  // normalized (depth, lateral) — the card's addressing — to local feet
  const at = (depth, lateral) => [lateral * W, depth * D];
  return { front, rect, W, D, inward: d, right: r, toWorld, toLocal, aabb, xf, localLight, at };
}
