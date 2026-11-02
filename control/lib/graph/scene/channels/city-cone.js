// In-page rule (part of the near repeats, scene-three.js `__nearRepeat`): THE CITY ON THE VIEW CONE, the urban pizza
// viewer. A geocity's street (its trees and its kit: lamps, signals, benches, scaffolding) is repeats drawn near the
// camera in tiles, each its own InstancedMesh that three already culls by the frustum. Without a cone each tile is shown
// within a RING round the eye (the repeat's `near`); a repeat that carries `cone` is shown by the cone's rule instead,
// measured from the eye to the nearest point of the tile's box:
//
//   in    the near level of a pair (a street tree's L1): shown while the tile is inside the cone's reach
//   out   its far twin (the same trees at L0, on the same tiles): shown past the reach, within the ring. The two are
//         complementary by construction (one distance, one reach), so no tree is drawn twice and none goes missing
//   kit   a thing that is only itself (a lamp, a bench): shown while its template's height covers `kitPx` pixels at the
//         tile's nearest point, within the ring
//   air   with the page's air (channels/atmosphere.js), a tile whose top lies under an optical depth of `fogTau` (a
//         contrast of e^-6, a quarter of a percent) is not drawn at all: the fog has already taken it
//
// Every rule stays within the ring a tile without the cone keeps (its centre within `near` and three quarters of a tile,
// over the ground), so a high camera sees the street it saw. The pair's tiles are `tile` metres; the kit keeps the ring's.
//
// The reach and a pixel's size at a metre are the view cone's (`window.__mojCone`, set before the render list each frame);
// a page without one falls back to `reach` metres and `px`. Absent any repeat with `cone`, not one byte of this is emitted.
export const CITY_CONE = Object.freeze({ tile: 48, kitPx: 2, fogTau: 6, reach: 40, px: 0.0015 });

/** The tile record's extra fields, in `__nearRepeat`'s scope (r, T, ids, the box it gathered): its rule, its box over
 *  the instances' feet to their tops, and its height. */
export const CITY_CONE_TILE = "c: r.cone, b: [x0, y0, z0, x1, y1, z1 + h], h";

/** The near tiles' visibility each frame, a cone's rule for a tile that carries one and the ring for the rest (in the
 *  page's scope: `__nearTiles`, cam, p = cam.position). */
export function cityConeRule() {
  return `const CC = ${JSON.stringify(CITY_CONE)}, K = window.__mojCone, A = window.__mojAir, reach = K ? K.reach : CC.reach, px = K ? K.px : CC.px;
  for (const n of __nearTiles) {
    if (!n.c) { n.im.visible = (n.x - p.x) * (n.x - p.x) + (n.y - p.y) * (n.y - p.y) < n.r * n.r; continue; }
    const b = n.b, qx = Math.min(Math.max(p.x, b[0]), b[3]) - p.x, qy = Math.min(Math.max(p.y, b[1]), b[4]) - p.y, qz = Math.min(Math.max(p.z, b[2]), b[5]) - p.z;
    const d = Math.hypot(qx, qy, qz);
    const ring = (n.x - p.x) * (n.x - p.x) + (n.y - p.y) * (n.y - p.y) < n.r * n.r;
    let v = ring && (n.c === 'in' ? d < reach : n.c === 'out' ? d >= reach : d < n.h / (CC.kitPx * px));
    // (the air: the tile's top, the least fogged of it where the air lies low)
    if (v && A && A.depth) v = A.depth(p.z, qx, qy, b[5] - p.z) < CC.fogTau;
    n.im.visible = v;
  }`;
}
