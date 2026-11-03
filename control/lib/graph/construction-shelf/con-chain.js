/**
 * con-chain — the kinematic chain at assembly level: a machine's bodies placed on their parents' joints, each inheriting
 * its joint's angle, the rams and the links between them solved, never posed.
 *
 * A layout entry is one of:
 *   { id, sku }                                    the root body, in the machine's frame
 *   { id, sku, on: 'parent.hp' }                   fixed to its parent at the parent's hardpoint
 *   { id, sku, on: 'parent.hp', joint: 'name' }    on a joint at that hardpoint: its frame turned by the joint's value
 *   { id, sku, ram: ['a.hp', 'b.hp'], pair? }      a ram between two bodies: its barrel from a toward b, its rod from b
 *                                                  toward a; `pair` one each side (`hp.r`, `hp.l`)
 *   { id, sku, link: ['a.hp', 'b.hp'], pair? }     a rigid link between two points: from a toward b
 * A point is 'body.hp' (a body's hardpoint, `hp.r` / `hp.l` on a pair's side when it has one), or '@joint' (the point a
 * joint's linkage solves: an excavator's H-link pin).
 *
 * The joints (the archetype's `joints`): { name: { kind: 'slew' | 'hinge', ram?, linkage? } }.
 *   slew    about the parent's +z at the hardpoint, + anticlockwise from above (to the left)
 *   hinge   about the parent's +x at the hardpoint, + lifting (+y toward +z)
 *   ram     the ram entry that drives it: the joint's RANGE is where the ram's length lies between its closed length
 *           and its closed length plus its stroke (derived, never stated); a joint with no ram turns freely (a slew)
 *   near    the angle the joint works about (degrees): of the runs its ram reaches, the one there (a ram reaches again
 *           with its body turned the wrong way round)
 *   linkage { ground: 'parent.hp', coupler: 'child.hp', a: 'link id', b: 'link id', side: ±1 }: a four-bar the joint
 *           closes, its two links `a` long from the ground point and `b` long from the coupler, meeting at the joint's
 *           point (on the `side` of the line from ground to coupler, about +x); the ram drives that point
 *
 *   rangeOf(arch, name, ctx)  → [lo, hi] degrees, cached by the archetype's key
 *   framesOf(arch, joints, ctx) → { id: { R, t } }: the bodies alone at joint values (what the envelope samples)
 *   solveChain(arch, pose, ctx) → { frames: { id: { R, t } }, joints: { name: degrees }, points: { '@name': [x,y,z] },
 *                                   struts: [{ id, item, kind: 'barrel' | 'rod' | 'link', frame, length }], clamped }
 * `ctx` reads the built parts: { hp(body, name, side?) → [x,y,z] in the body's frame, row(sku) → its ODM row }.
 *
 * Pure and deterministic.
 */
import { DEG, IDENTITY, about, aimFrame, apply, compose } from './con-common.js';

const split = (ref) => { const i = ref.indexOf('.'); return i < 0 ? [ref, null] : [ref.slice(0, i), ref.slice(i + 1)]; };

/** A joint's own frame at its value (degrees), set at the hardpoint `at` of its parent. */
function jointFrame(kind, at, value) {
  const R = kind === 'slew' ? about([0, 0, 1], value * DEG) : kind === 'hinge' ? about([1, 0, 0], value * DEG) : null;
  if (!R) throw new Error(`construction chain: a joint is a slew or a hinge (got '${kind}')`);
  return { R, t: [...at] };
}

/** Two circles in the (y, z) plane: centre a radius ra, centre b radius rb → the meeting point on the side of a→b. */
function meet(a, ra, b, rb, side) {
  const dy = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dy, dz);
  if (d < 1e-9 || d > ra + rb || d < Math.abs(ra - rb)) return null;
  const x = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const uy = dy / d, uz = dz / d, my = a[0] + uy * x, mz = a[1] + uz * x;
  // (the side about +x: the left normal of a→b, (−uz, uy), is +1)
  return [my - side * uz * h, mz + side * uy * h];
}

/** The entry of a body by id, its joint at its parent. */
const entryOf = (arch, id) => arch.layout.find((e) => e.id === id);

/**
 * The frames of a joint's parent and child, the joint at `value`, in the PARENT's frame: what a ram across the joint
 * and its linkage read (they lie on those two bodies alone).
 */
function local(arch, name, value, ctx) {
  const child = arch.layout.find((e) => e.joint === name);
  if (!child) throw new Error(`construction chain: no body sits on joint '${name}'`);
  const [parent, hp] = split(child.on), J = arch.joints[name];
  const frames = { [parent]: IDENTITY, [child.id]: jointFrame(J.kind, ctx.hp(parent, hp), value) };
  const P = (ref, side) => {
    const [b, h] = split(ref);
    if (!frames[b]) throw new Error(`construction chain: joint '${name}' reads '${ref}', which is on neither of its bodies`);
    return apply(frames[b], ctx.hp(b, h, side));
  };
  let H = null;
  if (J.linkage) {
    const L = J.linkage, g = P(L.ground), c = P(L.coupler);
    const la = ctx.row(entryOf(arch, L.a).sku).dims.length, lb = ctx.row(entryOf(arch, L.b).sku).dims.length;
    const m = meet([g[1], g[2]], la, [c[1], c[2]], lb, L.side ?? 1);
    if (m) H = [0, m[0], m[1]];
  }
  return { frames, P, H, parent, child: child.id };
}

/** A ram's pin-to-pin length across its joint at `value`, or null where its linkage cannot close. */
function ramLength(arch, name, value, ctx) {
  const J = arch.joints[name], ram = entryOf(arch, J.ram), q = local(arch, name, value, ctx);
  if (J.linkage && !q.H) return null;
  const end = (ref) => (ref.startsWith('@') ? q.H : q.P(ref, ram.pair ? 'r' : undefined));
  const a = end(ram.ram[0]), b = end(ram.ram[1]);
  // (a pair's two rams lie alike: the right one's length is both's)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const RANGES = new Map();
/** A ram-driven joint's range: where its ram's length lies within its stroke, the longest such run, its ends refined. */
export function rangeOf(arch, name, ctx, key = arch.key) {
  const k = `${key}|${name}`;
  if (RANGES.has(k)) return RANGES.get(k);
  const J = arch.joints[name];
  if (!J.ram) { RANGES.set(k, null); return null; }
  const row = ctx.row(entryOf(arch, J.ram).sku), lo = row.dims.closed, hi = row.dims.closed + row.dims.stroke;
  const ok = (v) => { const l = ramLength(arch, name, v, ctx); return l !== null && l >= lo && l <= hi; };
  // (the runs where the ram reaches; the one the joint works near, else the longest: a ram can reach again with its
  // body turned the wrong way round, a boom pointing back over the cab)
  const runs = [];
  let run = null;
  for (let v = -180; v <= 180; v += 0.5) {
    if (ok(v)) run = run ? [run[0], v] : [v, v];
    else if (run) { runs.push(run); run = null; }
  }
  if (run) runs.push(run);
  const gap = (r) => (J.near === undefined ? 0 : J.near < r[0] ? r[0] - J.near : J.near > r[1] ? J.near - r[1] : 0);
  const best = runs.sort((a, b) => gap(a) - gap(b) || (b[1] - b[0]) - (a[1] - a[0]))[0] ?? null;
  if (!best) throw new Error(`construction chain: the ${J.ram} cannot drive joint '${name}' anywhere (closed ${lo} m, stroke ${row.dims.stroke} m)`);
  const edge = (inside, outside) => { for (let i = 0; i < 40; i++) { const m = (inside + outside) / 2; if (ok(m)) inside = m; else outside = m; } return inside; };
  // (its ends rounded inward: a joint at its range's end is always within its ram's stroke)
  const out = [Math.ceil(edge(best[0], best[0] - 0.5) * 100) / 100, Math.floor(edge(best[1], best[1] + 0.5) * 100) / 100];
  RANGES.set(k, out);
  return out;
}

/** Every body's frame at joint values (degrees, unclamped): the chain's bodies alone, no linkage, no strut. */
export function framesOf(arch, joints, ctx) {
  const frames = {};
  for (const e of arch.layout) {
    if (e.ram || e.link) continue;
    if (!e.on) { frames[e.id] = IDENTITY; continue; }
    const [parent, hp] = split(e.on);
    if (!frames[parent]) throw new Error(`construction chain: '${e.id}' sits on '${parent}', which comes after it in the layout`);
    const at = ctx.hp(parent, hp);
    frames[e.id] = compose(frames[parent], e.joint ? jointFrame(arch.joints[e.joint].kind, at, joints[e.joint] ?? 0) : { R: IDENTITY.R, t: at });
  }
  return frames;
}

/** The chain at a pose: every body's frame, every joint's value (clamped into its range), the struts' frames. */
export function solveChain(arch, pose, ctx) {
  const joints = {}, clamped = [];
  for (const name of Object.keys(arch.joints)) {
    const r = rangeOf(arch, name, ctx);
    let v = Number.isFinite(pose[name]) ? pose[name] : r ? (r[0] + r[1]) / 2 : 0;
    if (r && (v < r[0] || v > r[1])) { clamped.push(name); v = Math.max(r[0], Math.min(r[1], v)); }
    joints[name] = Math.round(v * 100) / 100;
  }
  const frames = framesOf(arch, joints, ctx);
  const P = (ref, side) => {
    if (ref.startsWith('@')) return points[ref];
    const [b, h] = split(ref);
    if (!frames[b]) throw new Error(`construction chain: no body '${b}' (reading '${ref}')`);
    return apply(frames[b], ctx.hp(b, h, side));
  };
  // the linkages' points, in the machine's frame (each solved in its joint's parent's frame, then carried out)
  const points = {};
  for (const [name, J] of Object.entries(arch.joints)) {
    if (!J.linkage) continue;
    const q = local(arch, name, joints[name], ctx);
    if (!q.H) throw new Error(`construction chain: joint '${name}' at ${joints[name]}° cannot close its linkage`);
    points[`@${name}`] = apply(frames[q.parent], q.H);
  }
  // the struts: a ram's barrel and rod, a link, each a rigid body aimed between its two points
  const struts = [];
  for (const e of arch.layout) {
    if (!e.ram && !e.link) continue;
    const [ra, rb] = e.ram ?? e.link;
    for (const side of e.pair ? ['r', 'l'] : [null]) {
      const item = side ? `${e.id}-${side}` : e.id;
      // (a pair's side on a linkage point: the point carried across to that side's own x)
      const pt = (ref) => {
        if (!ref.startsWith('@')) return P(ref, side ?? undefined);
        const p = points[ref];
        if (!side) return p;
        const other = ref === ra ? rb : ra, o = P(other, side);
        const xs = apply({ R: frames[split(other)[0]].R, t: [0, 0, 0] }, [1, 0, 0]);
        const dx = (o[0] - p[0]) * xs[0] + (o[1] - p[1]) * xs[1] + (o[2] - p[2]) * xs[2];
        return [p[0] + xs[0] * dx, p[1] + xs[1] * dx, p[2] + xs[2] * dx];
      };
      const a = pt(ra), b = pt(rb), across = apply({ R: frames[split(ra.startsWith('@') ? rb : ra)[0]].R, t: [0, 0, 0] }, [1, 0, 0]);
      if (e.ram) {
        const f = aimFrame(a, b, across), g = aimFrame(b, a, across);
        struts.push({ id: e.id, item: `${item}`, kind: 'barrel', frame: f, length: f.length, side });
        struts.push({ id: e.id, item: `${item}.rod`, kind: 'rod', frame: g, length: g.length, side });
      } else {
        const f = aimFrame(a, b, across);
        struts.push({ id: e.id, item, kind: 'link', frame: f, length: f.length, side });
      }
    }
  }
  return { frames, joints, points, struts, clamped };
}
