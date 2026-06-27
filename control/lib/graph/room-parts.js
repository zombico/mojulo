/**
 * room-parts — parameterized constructors for the everyday parts that recur across room-furniture
 * families: legs, slabs (seats / cushions / shelves / tops), and (as the lighting and storage
 * families land) shades and drawers.
 *
 * Each helper returns ONE workbench monomer spec (a `lathe` / `extrude` object in the same shape
 * `workbench.js` lowers) in the room's world coordinate frame — z UP, real-world `units`. They carry
 * no geometry; the object is regenerated deterministically on render. An asset builder composes a
 * handful of these into a `{ lathes, extrudes, sweeps }` manifest (see room-assets.js).
 *
 * Authoring note: this library is grown asset-by-asset, not speculatively. `buildLeg` + `buildSlab`
 * are exercised today by the couch and the dining chair (seating family). `buildShade` (lathe) and
 * `buildDrawer` (extrude-shell) join when the lighting and storage families are authored — see the
 * build order in room-assets.plan.md. Add a part here the moment a SECOND asset needs it.
 *
 * Design: control/lib/graph/room-assets.plan.md (Open question 2 — the shared part library).
 */

/**
 * A tapered turned leg — a `lathe` from a (possibly splayed) foot up to a seat/top point. The radius
 * tapers from `footRadius` at the foot to `topRadius` where it meets the body. Splay the foot by
 * passing a `foot` offset from the `top` xy; a vertical leg shares the same xy on both ends.
 *
 * @param {object} a
 * @param {[number,number,number]} a.top   where the leg meets the body (its upper axis point).
 * @param {[number,number,number]} a.foot  where the leg touches the floor (its lower axis point).
 * @param {number} a.topRadius   radius at the top (at the body).
 * @param {number} a.footRadius  radius at the foot (on the floor).
 * @param {number} [a.samples=8]        revolution facets.
 * @param {number} [a.crossSections=3]  segments along the axis.
 * @param {string} [a.tint]             albedo.
 * @returns {object} a lathe monomer spec.
 */
export function buildLeg({ top, foot, topRadius, footRadius, samples = 8, crossSections = 3, tint } = {}) {
  return {
    axisFrom: { x: foot[0], y: foot[1], z: foot[2] },
    axisTo: { x: top[0], y: top[1], z: top[2] },
    profile: [{ t: 0, radius: footRadius }, { t: 1, radius: topRadius }],
    samples,
    crossSections,
    tint,
  };
}

/**
 * A rounded-rectangular slab — a vertical (or raked) `extrude` of a `w × d` rounded rect from `z0`
 * to `z1`. The workhorse for seats, cushions, shelves, table tops, and back panels. Rake it by
 * giving `to` an xy offset from the slab's footprint centre (`x`,`y`): the prism leans toward `to`.
 *
 * @param {object} a
 * @param {number} a.x  footprint centre x.
 * @param {number} a.y  footprint centre y.
 * @param {number} a.z0 bottom z (axisFrom).
 * @param {number} a.z1 top z (axisTo) — must differ from z0.
 * @param {number} a.w  width (along x for a vertical slab).
 * @param {number} a.d  depth (along y for a vertical slab).
 * @param {number} [a.r=0]             corner radius of the rounded rect.
 * @param {[number,number]} [a.to]     optional top-centre xy (for a raked slab); defaults to (x,y).
 * @param {string} [a.tint]            albedo.
 * @param {number} [a.cornerSamples=6] arc segments per rounded corner.
 * @returns {object} an extrude monomer spec.
 */
export function buildSlab({ x, y, z0, z1, w, d, r = 0, to, tint, cornerSamples = 6 } = {}) {
  const top = Array.isArray(to) ? to : [x, y];
  return {
    axisFrom: { x, y, z: z0 },
    axisTo: { x: top[0], y: top[1], z: z1 },
    profile: { rect: { w: Math.max(0.05, w), h: Math.max(0.05, d), r } },
    tint,
    cornerSamples,
  };
}
