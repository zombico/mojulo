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
 *   { id, sku, on: 'parent.hp', rocker: 'name' }   a rocker (a loader's bellcrank) on a pin of its parent, its angle
 *                                                  solved by the joint `name`'s rocker linkage, never posed
 * A jointed entry may say `scale`: it moves that share of its joint's value (a telescopic boom's inner section, a mast's
 * stage, each a share of the extension).
 * A point is 'body.hp' (a body's hardpoint, `hp.r` / `hp.l` on a pair's side when it has one), or '@joint' (the point a
 * joint's linkage solves: an excavator's H-link pin).
 *
 * The joints (the archetype's `joints`): { name: { kind: 'slew' | 'hinge' | 'slide', ram?, linkage?, near? } }.
 *   slew    about the parent's +z at the hardpoint, + anticlockwise from above (to the left): an upper, a hitch
 *   hinge   about the parent's +x at the hardpoint, + lifting (+y toward +z)
 *   slide   along the parent's +y (or the joint's `axis`) from the hardpoint, in metres: a telescope, a mast; without a
 *           ram its range runs as far as the first of its stages runs out (each its row's `dims.travel` over its scale)
 *   ram     the ram entry that drives it: the joint's RANGE is where the ram's length lies between its closed length
 *           and its closed length plus its stroke (derived, never stated); a joint with no ram turns freely (a slew)
 *   near    the angle the joint works about (degrees): of the runs its ram reaches, the one there (a ram reaches again
 *           with its body turned the wrong way round)
 *   linkage { ground: 'parent.hp', coupler: 'child.hp', a: 'link id', b: 'link id', side: ±1 }: a four-bar the joint
 *           closes, its two links `a` long from the ground point and `b` long from the coupler, meeting at the joint's
 *           point (on the `side` of the line from ground to coupler, about +x); the ram drives that point
 *           { kind: 'rocker', link: 'link id', lower: 'rocker.hp', coupler: 'child.hp', side: ±1 }: a Z-bar: the rocker
 *           turns about its pin until its `lower` pin is the link's length from the coupler; the ram drives the rocker
 *   A pair's rams must all lie within their stroke: the range is where every side's does.
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

/** A ram's barrel and rod lengths: the barrel the closed length less its eye's, the rod the stroke and its piston's
 *  length (so at full stroke the piston is still in the barrel, and at closed the rod's end is clear of the base). A
 *  short ram's eye and piston are short with it: a fifth of its length at most, its piston no longer than leaves its
 *  rod's end 5 cm clear of the base. A telescopic ram's stages overlap each other and its barrel and rod alike at full
 *  stroke (`overlap`), each slid out its share between there and closed. */
export const ramParts = (d) => ((d.stages ?? 2) > 2
  // (a telescopic ram, a tipper's hoist: its stages each as long as its closed length allows, nested in the barrel
  // from 10 cm past its base, its rod from 15 cm)
  ? { barrel: d.closed - Math.min(0.12, d.closed * 0.2), stage: d.closed - 0.15, rod: d.closed - 0.15 }
  : { barrel: d.closed - Math.min(0.12, d.closed * 0.2), rod: d.stroke + Math.min(0.2, d.closed - d.stroke - 0.05) });
/** How far a telescopic ram's stages and rod overlap the tube outside them at full stroke, the same for each. */
export const overlap = (d) => { const L = ramParts(d), n = d.stages ?? 2; return (L.barrel + (n - 2) * L.stage + L.rod - d.closed - d.stroke) / (n - 1); };

const split = (ref) => { const i = ref.indexOf('.'); return i < 0 ? [ref, null] : [ref.slice(0, i), ref.slice(i + 1)]; };

/** A joint's own frame at its value (degrees; a slide's metres), set at the hardpoint `at` of its parent: a slew about
 *  +z (turned its `zero` more: a backhoe's swing frame faces aft), a hinge about its `axis` (+x; a stabiliser's +y), a
 *  slide along its `axis` (+y). */
function jointFrame(J, at, value) {
  const kind = J.kind;
  if (kind === 'slide') { const axis = J.axis ?? [0, 1, 0]; return { R: IDENTITY.R, t: [at[0] + axis[0] * value, at[1] + axis[1] * value, at[2] + axis[2] * value] }; }
  const R = kind === 'slew' ? about([0, 0, 1], (value + (J.zero ?? 0)) * DEG) : kind === 'hinge' ? about(J.axis ?? [1, 0, 0], value * DEG) : null;
  if (!R) throw new Error(`construction chain: a joint is a slew, a hinge or a slide (got '${kind}')`);
  return { R, t: [...at] };
}
/** A point in the machine's frame → a frame's own. */
const unapply = (T, p) => { const d = [p[0] - T.t[0], p[1] - T.t[1], p[2] - T.t[2]]; return [0, 1, 2].map((k) => T.R[0][k] * d[0] + T.R[1][k] * d[1] + T.R[2][k] * d[2]); };

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
 * A rocker's frame: turned on its parent's pin until its `lower` pin lies the link's length from the coupler (both
 * read in the parent's frame), or null where the linkage cannot close.
 */
function rockerFrame(arch, e, frames, ctx) {
  const J = arch.joints[e.rocker], L = J.linkage, [parent, hp] = split(e.on), [cb, ch] = split(L.coupler);
  if (!frames[parent] || !frames[cb]) throw new Error(`construction chain: the rocker '${e.id}' comes before its parent or its coupler`);
  const K = ctx.hp(parent, hp), B = unapply(frames[parent], apply(frames[cb], ctx.hp(cb, ch)));
  const low = ctx.hp(e.id, split(L.lower)[1]), r0 = Math.hypot(low[1], low[2]), a0 = Math.atan2(low[2], low[1]);
  const m = meet([K[1], K[2]], r0, [B[1], B[2]], ctx.row(entryOf(arch, L.link).sku).dims.length, L.side ?? 1);
  if (!m) return null;
  const phi = (Math.atan2(m[1] - K[2], m[0] - K[1]) - a0) / DEG;
  return compose(frames[parent], jointFrame({ kind: 'hinge' }, K, phi));
}

const RIGID = new Map();
/** Every body fixed to `body` (no joint between them, either way), in its frame: a ram may be based on the hull a
 *  dozer's blade does not hang from, the hull fixed to the tracks it does. */
function rigidWith(arch, body, ctx) {
  const k = `${arch.key}|${body}`;
  if (RIGID.has(k)) return RIGID.get(k);
  const fixed = (e) => e.on && !e.joint && !e.rocker && !e.ram && !e.link;
  const group = new Set([body]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of arch.layout.filter(fixed)) {
      const p = split(e.on)[0];
      if (group.has(p) !== group.has(e.id)) { group.add(p); group.add(e.id); grew = true; }
    }
  }
  const F = framesOf(arch, {}, ctx), B = F[body], out = {};
  for (const id of group) {
    const T = F[id], d = [T.t[0] - B.t[0], T.t[1] - B.t[1], T.t[2] - B.t[2]];
    const Rt = [0, 1, 2].map((i) => [0, 1, 2].map((j) => B.R[0][i] * T.R[0][j] + B.R[1][i] * T.R[1][j] + B.R[2][i] * T.R[2][j]));
    out[id] = { R: Rt, t: [0, 1, 2].map((i) => B.R[0][i] * d[0] + B.R[1][i] * d[1] + B.R[2][i] * d[2]) };
  }
  RIGID.set(k, out);
  return out;
}

/**
 * The frames of a joint's parent and child, the joint at `value`, in the PARENT's frame: what a ram across the joint
 * and its linkage read (they lie on those two bodies alone).
 */
function local(arch, name, value, ctx) {
  const child = arch.layout.find((e) => e.joint === name);
  if (!child) throw new Error(`construction chain: no body sits on joint '${name}'`);
  const [parent, hp] = split(child.on), J = arch.joints[name];
  const frames = { ...rigidWith(arch, parent, ctx) };
  // (every body on the joint: a pair of stabiliser legs turns on one)
  for (const c of arch.layout.filter((e) => e.joint === name && split(e.on)[0] === parent)) frames[c.id] = jointFrame(J, ctx.hp(parent, split(c.on)[1]), value * (c.scale ?? 1));
  // (a rocker the joint turns: solved on its pin from the child's coupler)
  for (const r of arch.layout.filter((x) => x.rocker === name)) {
    const f = rockerFrame(arch, r, frames, ctx);
    if (!f) return null;
    frames[r.id] = f;
  }
  const P = (ref, side) => {
    const [b, h] = split(ref);
    if (!frames[b]) throw new Error(`construction chain: joint '${name}' reads '${ref}', which is on neither of its bodies nor fixed to its parent`);
    return apply(frames[b], ctx.hp(b, h, side));
  };
  let H = null;
  if (J.linkage && J.linkage.kind !== 'rocker') {
    const L = J.linkage, g = P(L.ground), c = P(L.coupler);
    const la = ctx.row(entryOf(arch, L.a).sku).dims.length, lb = ctx.row(entryOf(arch, L.b).sku).dims.length;
    const m = meet([g[1], g[2]], la, [c[1], c[2]], lb, L.side ?? 1);
    if (m) H = [0, m[0], m[1]];
  }
  return { frames, P, H, parent, child: child.id };
}

/** A ram's pin-to-pin lengths across its joint at `value` (each side's, for a pair), or null where its linkage cannot
 *  close. */
function ramLengths(arch, name, value, ctx) {
  const J = arch.joints[name], ram = entryOf(arch, J.ram), q = local(arch, name, value, ctx);
  if (!q || (J.linkage && J.linkage.kind !== 'rocker' && !q.H)) return null;
  return (ram.pair ? ['r', 'l'] : [undefined]).map((side) => {
    const end = (ref) => (ref.startsWith('@') ? q.H : q.P(ref, side));
    const a = end(ram.ram[0]), b = end(ram.ram[1]);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  });
}

const RANGES = new Map();
/** A ram-driven joint's range: where its ram's length lies within its stroke, the longest such run, its ends refined. */
export function rangeOf(arch, name, ctx, key = arch.key) {
  const k = `${key}|${name}`;
  if (RANGES.has(k)) return RANGES.get(k);
  const J = arch.joints[name];
  // (a slide with no ram travels as far as its body does; a slew with none turns freely)
  if (!J.ram) {
    // (a slide's stages each travel their own; the joint as far as the first of them runs out)
    const stages = J.kind === 'slide' ? arch.layout.filter((e) => e.joint === name) : [];
    const out = stages.length ? [0, Math.round(Math.min(...stages.map((e) => ctx.row(e.sku).dims.travel / (e.scale ?? 1))) * 100) / 100] : null;
    RANGES.set(k, out);
    return out;
  }
  const row = ctx.row(entryOf(arch, J.ram).sku), lo = row.dims.closed, hi = row.dims.closed + row.dims.stroke;
  const ok = (v) => { const ls = ramLengths(arch, name, v, ctx); return ls !== null && ls.every((l) => l >= lo && l <= hi); };
  // (a hinge's turn is scanned in half degrees over the circle, a slide's travel in centimetres over its reach)
  const [from, to, step] = J.kind === 'slide' ? [0, J.max ?? 20, 0.01] : [-180, 180, 0.5];
  // (the runs where the ram reaches; the one the joint works near, else the longest: a ram can reach again with its
  // body turned the wrong way round, a boom pointing back over the cab)
  const runs = [];
  let run = null;
  for (let i = 0, v = from; v <= to + 1e-9; i++, v = from + i * step) {
    if (ok(v)) run = run ? [run[0], v] : [v, v];
    else if (run) { runs.push(run); run = null; }
  }
  if (run) runs.push(run);
  const gap = (r) => (J.near === undefined ? 0 : J.near < r[0] ? r[0] - J.near : J.near > r[1] ? J.near - r[1] : 0);
  const best = runs.sort((a, b) => gap(a) - gap(b) || (b[1] - b[0]) - (a[1] - a[0]))[0] ?? null;
  if (!best) throw new Error(`construction chain: the ${J.ram} cannot drive joint '${name}' anywhere (closed ${lo} m, stroke ${row.dims.stroke} m)`);
  const edge = (inside, outside) => { for (let i = 0; i < 40; i++) { const m = (inside + outside) / 2; if (ok(m)) inside = m; else outside = m; } return inside; };
  // (its ends rounded inward: a joint at its range's end is always within its ram's stroke)
  const out = [Math.ceil(edge(best[0], best[0] - step) * 100) / 100, Math.floor(edge(best[1], best[1] + step) * 100) / 100];
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
    if (e.rocker) {
      const f = rockerFrame(arch, e, frames, ctx);
      if (!f) throw new Error(`construction chain: the rocker '${e.id}' cannot close its linkage at ${e.rocker} ${joints[e.rocker]}`);
      frames[e.id] = f;
      continue;
    }
    const at = ctx.hp(parent, hp), J = e.joint ? arch.joints[e.joint] : null;
    frames[e.id] = compose(frames[parent], J ? jointFrame(J, at, (joints[e.joint] ?? 0) * (e.scale ?? 1)) : { R: IDENTITY.R, t: at });
  }
  return frames;
}

/** The chain at a pose: every body's frame, every joint's value (clamped into its range), the struts' frames. */
export function solveChain(arch, pose, ctx) {
  const joints = {}, clamped = [];
  for (const name of Object.keys(arch.joints)) {
    const r = rangeOf(arch, name, ctx);
    let v = Number.isFinite(pose[name]) ? pose[name] : r ? (r[0] + r[1]) / 2 : 0;
    // (a value a rounding past its range's end is its end, not clamped)
    if (r && (v < r[0] - 1e-9 || v > r[1] + 1e-9)) clamped.push(name);
    if (r) v = Math.max(r[0], Math.min(r[1], v));
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
    if (!J.linkage || J.linkage.kind === 'rocker') continue;
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
        // (a telescopic ram's stages between its barrel and its rod, each slid out its share of the extension: from 10 cm
        // past its base closed to where each overlaps the tube outside it as much as the next at full stroke)
        const d = ctx.row(ctx.entry(e.id).sku).dims, n = d.stages ?? 2, P = n > 2 ? ramParts(d) : null, o = n > 2 ? overlap(d) : 0;
        for (let k = 1; k <= n - 2; k++) {
          const off = 0.1 + ((f.length - d.closed) / d.stroke) * (P.barrel - o + (k - 1) * (P.stage - o) - 0.1), ax = [f.R[0][1], f.R[1][1], f.R[2][1]];
          struts.push({ id: e.id, item: `${item}.s${k}`, kind: 'stage', part: `stage${k}`, frame: { R: f.R, t: f.t.map((v, i) => v + ax[i] * off) }, length: f.length, side });
        }
        struts.push({ id: e.id, item: `${item}.rod`, kind: 'rod', frame: g, length: g.length, side });
      } else {
        const f = aimFrame(a, b, across);
        struts.push({ id: e.id, item, kind: 'link', frame: f, length: f.length, side });
      }
    }
  }
  return { frames, joints, points, struts, clamped };
}
