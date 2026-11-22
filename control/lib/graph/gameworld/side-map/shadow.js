/**
 * THE SIDE MAP'S SHADOWS (docs/side-map-principles.md "The look"): what stands in the map throws a hard shadow onto
 * what the camera sees behind and under it, as a run and gun's stages are drawn: a ledge's, a pillar's, a prop's, a
 * crate's, each a crisp darker copy of itself on the back wall and on the floor's top. Cel, not soft: one edge, one tone.
 *
 *   the LIGHT      a drop shadow's own direction (DIR, toward the light): from the key's side (scene.js's key comes up the
 *                  lane's start and from above, era/geocube-side.js `key`) but shallower than its fall, so a shadow lands
 *                  beside what throws it and stays in the frame (the key's steep fall would drop a prop's shadow behind
 *                  the floor it stands on)
 *   the CASTERS    boxes: the layout's solids (the lane's slabs, ±`half` across), the icing's things at the back depth
 *                  (doodads.js), the crates (crates.js)
 *   the RECEIVERS  the back wall (a plane at its x) and the floors' tops (a plane at their z), each a rectangle: a shadow
 *                  is the caster's corners projected along the light onto the plane, their hull, cut to the rectangle
 *
 *   SHADOW                                  the numbers
 *   shadowCasters(layout, { doodads?, crates?, half }) → [box { x0, x1, s0, s1, z0, z1, of }]
 *   shadowOn(receiver, casters) → [[ [x, s, z], … ]]   receiver { axis: 'x' | 'z', at, s0, s1, a0, a1, own? } (`a` the
 *                  rectangle's other side: z on the back wall, x on a top; `own` a caster that never shadows it, its slab)
 *
 * Pure and deterministic: the same map, the same shadows.
 */
export const SHADOW = Object.freeze({ dir: Object.freeze([1, -0.4, 0.55]), cast: 0.55, lift: 0.006, min: 0.02 });

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The boxes that throw a shadow. */
export function shadowCasters(layout, { doodads = [], crates = [], half = 1.5 } = {}) {
  const out = [];
  for (const r of layout.solids) out.push({ x0: -half, x1: half, s0: r.s0, s1: r.s1, z0: r.z0, z1: r.z1, of: 'solid' });
  for (const d of doodads) if (d.depth === 'back') out.push({ x0: d.x0, x1: d.x1, s0: d.s - d.w / 2, s1: d.s + d.w / 2, z0: d.z, z1: d.top, of: 'doodad' });
  for (const c of crates) out.push({ x0: -0.45, x1: 0.45, s0: c.s0, s1: c.s1, z0: c.z0, z1: c.z1, of: 'crate' });
  return out;
}

// the convex hull of 2D points (monotone chain), counter-clockwise
function hull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-12) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 1e-12) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// a convex polygon cut to the rectangle [u0, u1] × [v0, v1] (Sutherland-Hodgman, an edge at a time)
function clip(poly, u0, u1, v0, v1) {
  const edges = [[(p) => p[0] - u0], [(p) => u1 - p[0]], [(p) => p[1] - v0], [(p) => v1 - p[1]]];
  let out = poly;
  for (const [f] of edges) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    if (!out.length) return [];
  }
  return out;
}

/** The shadows the casters throw on one receiver, each a polygon of 3D corners on its plane (counter-clockwise seen from
 * the light's side). A caster behind the plane, or the receiver's own slab, throws none. */
export function shadowOn(R, casters) {
  const D = SHADOW.dir, out = [];
  // (on the back wall the plane is x = at, its rectangle in (s, z); on a top, z = at, in (s, x))
  const onX = R.axis === 'x';
  for (const b of casters) {
    if (b === R.own) continue;
    if (onX ? b.x1 <= R.at + 1e-3 : b.z0 < R.at - 1e-3) continue;
    const pts = [];
    for (const x of [b.x0, b.x1]) for (const s of [b.s0, b.s1]) for (const z of [b.z0, b.z1]) {
      // along the light away from it, to the plane
      const t = onX ? (x - R.at) / D[0] : (z - R.at) / D[2];
      if (t < -1e-6) continue;
      const P = [x - D[0] * t, s - D[1] * t, z - D[2] * t];
      pts.push(onX ? [P[1], P[2]] : [P[1], P[0]]);
    }
    if (pts.length < 3) continue;
    const poly = clip(hull(pts), R.s0, R.s1, R.a0, R.a1);
    if (poly.length < 3) continue;
    // (a sliver too thin to see is none)
    const us = poly.map((p) => p[0]), vs = poly.map((p) => p[1]);
    if (Math.max(...us) - Math.min(...us) < SHADOW.min || Math.max(...vs) - Math.min(...vs) < SHADOW.min) continue;
    out.push(poly.map(([u, v]) => (onX ? [r4(R.at + SHADOW.lift), r4(u), r4(v)] : [r4(v), r4(u), r4(R.at + SHADOW.lift)])));
  }
  return out;
}
