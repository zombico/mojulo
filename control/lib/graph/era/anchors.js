/**
 * ANCHORS — a built stage, addressable. The plan knows its rooms, the doorways between them and where every thing
 * stands; the faces don't. This keeps that knowledge on the payload, so an idiom, an exporter or an engine can name
 * "the doorway between the nave and the crypt", "coffin 2", "the set piece's lid":
 *
 *   rooms:     [{ id, box: { min, max }, h, doorways: [anchor ids], open? }]   the interior, floor to wall top
 *   anchors:   [{ id, kind, room, at, N?, box?, node?, … }]                    every addressable place and thing
 *   colliders: [{ min, max, of }]                                             axis-aligned hulls an engine walks against
 *
 * Anchor kinds: `doorway` (between two rooms: `between`, width, height, a `trigger` box through the wall), `door` (a
 * recipe end: `to`, `locked`, `trigger`, `spawn`), `item`, `set-piece` (its `form`: tomb, open-tomb, altar, well),
 * `part` (a piece of another anchor that moves on its own: `of`, `name`), `doodad` (a large thing), `prop` (a small
 * one), `torch`, `niche`, `accent-wall`. Ids are short and stable for a recipe: a room's own id; `doorway-<a>-<b>`;
 * a thing's form and its count in placement order (`coffin-2`); `torch-3`; `niche-12`.
 *
 * A face carrying `node` belongs to that anchor: the GLB gives it its own node by that name (scene-gltf.js), so an
 * engine can hide, move or open it. The World page groups by `group` alone and never reads `node`: the page's bytes
 * do not change. Pure; positions rounded like the faces.
 */
import { P, r5 } from './geom.js';

/** The interior of each room (the box inset by half a wall), floor to wall top, and the doorways that open from it. */
export function stageRooms(plan) {
  return plan.rooms.map((r) => ({
    id: r.id, box: { min: P([r.x0, r.y0, 0]), max: P([r.x1, r.y1, r.h]) }, h: r.h,
    doorways: plan.links.filter((l) => l.from === r.id || l.to === r.id).map(doorwayId),
    ...(r.open.length ? { open: [...r.open] } : {}),
  }));
}

const doorwayId = (l) => `doorway-${l.from}-${l.to}`;

/** The room a point stands in (the first whose interior holds it, a wall's half thickness of slack), else null. */
export function roomAt(plan, p) {
  const s = plan.kit.wall / 2 + 0.05;
  const r = plan.rooms.find((q) => p[0] >= q.x0 - s && p[0] <= q.x1 + s && p[1] >= q.y0 - s && p[1] <= q.y1 + s);
  return r ? r.id : null;
}

/** One doorway anchor per link: its sill's middle, its normal from `from` into `to`, and a trigger box through the
 *  wall reaching a step into each room. */
export function doorwayAnchors(plan) {
  const t = plan.kit.wall / 2, reach = 0.6;
  return plan.links.map((l) => {
    const alongX = l.wall.endsWith('y'), mid = (l.lo + l.hi) / 2, sg = l.wall.startsWith('+') ? 1 : -1;
    const at = alongX ? [mid, l.at, 0] : [l.at, mid, 0], N = alongX ? [0, sg, 0] : [sg, 0, 0];
    const lo = alongX ? [l.lo, l.at - t - reach, 0] : [l.at - t - reach, l.lo, 0], hi = alongX ? [l.hi, l.at + t + reach, l.top] : [l.at + t + reach, l.hi, l.top];
    return { id: doorwayId(l), kind: 'doorway', room: l.from, between: [l.from, l.to], at: P(at), N, width: r5(l.hi - l.lo), height: r5(l.top), trigger: { min: P(lo), max: P(hi) } };
  });
}

/** The bounds of the faces carrying each `node`: { id: { min, max } }. */
export function nodeBounds(faces) {
  const b = new Map();
  for (const f of faces) {
    if (!f || typeof f.node !== 'string') continue;
    let q = b.get(f.node);
    if (!q) b.set(f.node, (q = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < q.min[k]) q.min[k] = c[k]; if (c[k] > q.max[k]) q.max[k] = c[k]; }
  }
  return Object.fromEntries([...b].map(([k, q]) => [k, { min: P(q.min), max: P(q.max) }]));
}

/**
 * The colliders: every closed wall of every room as slabs a wall thick, cut where its doorways open (a lintel kept
 * over each), the pilasters standing proud of them, and a hull round each solid anchor (the set piece and its parts,
 * the doodads, an item's plinth), from the floor up. The floor is the engines' own ground plane (engine-score.js
 * `ground`), never a collider.
 */
export function stageColliders(plan, geom, anchors) {
  const t = plan.kit.wall / 2, out = [], seen = new Set();
  const push = (min, max, of) => {
    const c = { min: P(min), max: P(max), of }, k = `${c.min.join()}|${c.max.join()}`;
    if (c.max[0] - c.min[0] < 1e-3 || c.max[1] - c.min[1] < 1e-3 || c.max[2] - c.min[2] < 1e-3 || seen.has(k)) return;
    seen.add(k); out.push(c);
  };
  for (const r of plan.rooms) {
    const [bx0, by0, bx1, by1] = r.box;
    for (const side of ['-y', '+x', '+y', '-x']) {
      if (r.open.includes(side)) continue;
      const alongX = side.endsWith('y'), c = side === '-y' ? by0 : side === '+y' ? by1 : side === '-x' ? bx0 : bx1;
      const a0 = (alongX ? bx0 : by0) - t, a1 = (alongX ? bx1 : by1) + t;
      const slab = (u0, u1, z0, z1) => push(alongX ? [u0, c - t, z0] : [c - t, u0, z0], alongX ? [u1, c + t, z1] : [c + t, u1, z1], `wall:${r.id}:${side}`);
      let u = a0;
      for (const op of r.openings[side]) {
        slab(u, op.lo, 0, r.h);
        slab(op.lo, op.hi, op.top, r.h);   // the lintel (an arched head's crown: the way through stays clear)
        u = op.hi;
      }
      slab(u, a1, 0, r.h);
    }
  }
  const pw = plan.kit.pilaster ? plan.kit.pilaster.w / 2 : 0, po = plan.kit.pilaster ? plan.kit.pilaster.out : 0;
  for (const p of geom.pilasters || []) {
    const a = [p.F.o[0] + p.F.U[0] * (p.u - pw), p.F.o[1] + p.F.U[1] * (p.u - pw)], b = [p.F.o[0] + p.F.U[0] * (p.u + pw) + p.F.N[0] * po, p.F.o[1] + p.F.U[1] * (p.u + pw) + p.F.N[1] * po];
    push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), 0], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), p.top], `pilaster:${p.room}`);
  }
  for (const a of anchors) if (a.solid && a.box) push([a.box.min[0], a.box.min[1], 0], a.box.max, a.id);
  return out;
}
