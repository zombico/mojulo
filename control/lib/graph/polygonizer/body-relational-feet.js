/** body-relational-feet.js — THE FEET on the form field: the foot and the toes (a build's limbs marked `foot`) on one field
 * with the shank's own skin, the sole cut flat on the ground; the foot re-sampled as a SOCK (its rings level round the
 * ankle, turning down the instep to stand square to the foot, the heel the bend's outside), the toes in planes along
 * the toe line; bound across the ankle as the shank's last skin is. Pure and deterministic (dmath, through the field). */
import * as dmath from '../../util/dmath.js';
import { add, sub, scl, dot, cross, len, unit, r6 } from './body-relational-vec.js';
import { sdPrim, lse, smaxp, crossing } from './body-relational-field.js';
import { ringSlots, resamplePart, mixW } from './body-relational-resample.js';

const sm = (v) => { const y = Math.max(0, Math.min(1, v)); return y * y * (3 - 2 * y); };
// (the handovers' inset and its band, the chain's: one crossing at the level or the plane, each skin faded in from it)
const TUCK = 0.003, BAND = 0.01;
/** the feet's measures on a rig: the GROUND (the authored shoe's lowest point: its sole, where the gaits plant it) and the
 * HANDOVER level (`0.25 W` over the ankle's joint: under it the foot's skin shows, over it the shank's) */
export function feetFrame(R, recipe, W) {
  let ground = Infinity;
  for (const k of ['footR', 'toesR']) for (const s of recipe.parts[k]?.stations || []) for (const p of Object.values(s.points)) ground = Math.min(ground, p[2]);
  return { ground, zc: R.joints.ankleR[2] + 0.25 * W };
}

/** the foot's and the toes' fields (`limbs.foot.sd`, `limbs.toes.sd`): the union of their masses (the toes' blend
 * tighter, `k`) with the shank's skin (`limbs.shank.sd`, so the ankle flows out of the shank's last skin with no step),
 * the masses cut over the handover level (the shank's skin alone over it); handed over at the level as `chain` hands
 * the knee over (over it the foot set `TUCK` inside, under it grown `TUCK` out over the shank's last rings, which run on
 * inside it), the foot and the toes at the plane through the toe base square to the foot's bone; and the sole flat on
 * the ground, its rim rounded */
export function feetFields(R, B, limbs, frame, W) {
  if (!limbs.foot || !limbs.shank) return;
  const J = R.joints, { ground, zc } = frame, sh = limbs.shank.sd, kL = B.kLimb * W, kF = B.limbs.foot.k * W, kT = (B.limbs.toes?.k ?? B.limbs.foot.k) * W;
  // (THE TREAD: the masses set level so their lowest sinks `0.04 W` into the ground (past the rim's rounding, `0.03 W`), which the sole's cut flattens to a
  // pad; laid out on the bone alone, a build's foot on another's rig stood off the ground on a rounded sole)
  const low = (p) => (p.cone ? Math.min(p.cone[0][2] - p.r[0], p.cone[1][2] - p.r[1]) : p.c[2] - Math.sqrt(p.ax.reduce((t, a, i) => t + (a[2] * p.r[i]) ** 2, 0)));
  const all = [...limbs.foot.prims, ...(limbs.toes?.prims || [])], dz = ground - 0.04 * W - Math.min(...all.map(low));
  const lift = (p) => (p.cone ? { ...p, cone: p.cone.map((c) => [c[0], c[1], c[2] + dz]) } : { ...p, c: [p.c[0], p.c[1], p.c[2] + dz] });
  const cutAt = (p) => (q) => smaxp(sdPrim(p, q), q[2] - zc, 0.004);
  const fp = limbs.foot.prims.map(lift).map(cutAt), tp = (limbs.toes?.prims || []).map(lift).map(cutAt);
  const bf = new Array(fp.length), bt = new Array(tp.length), b2 = [0, 0];
  const union = (q) => {
    for (let i = 0; i < fp.length; i++) bf[i] = fp[i](q);
    let m = lse(bf, kF);
    if (tp.length) { for (let i = 0; i < tp.length; i++) bt[i] = tp[i](q); b2[0] = m; b2[1] = lse(bt, kT); m = lse(b2, kF); }
    b2[0] = sh(q); b2[1] = m; return lse(b2, kL);
  };
  const hv = (z) => TUCK * sm((z - zc) / BAND) - TUCK * sm((zc - z) / BAND);
  const tb = J.toeBaseR, n = unit(sub(tb, J.ankleR)), past = (q) => dot(sub(q, tb), n);
  // (and the LID, the foot's field cut a little over the sock's top ring: a ray of a ring that turns down the instep,
  // run up inside the leg, left it high on the shin in a fin)
  const lid = zc + BAND + 0.008, sole = (v, q) => smaxp(smaxp(v, q[2] - lid, 0.004), ground - q[2], 0.03 * W);
  limbs.foot.sd = (q) => sole(union(q) + hv(q[2]) + (limbs.toes ? TUCK * sm(past(q) / BAND) : 0), q);
  if (limbs.toes) limbs.toes.sd = (q) => sole(union(q) + hv(q[2]) + TUCK * sm(-past(q) / BAND), q);
}

/** a ring of the cage: 32 points a hand's breadth round `c` in the plane of `X` (the R side) and `V` (the front slot);
 * only their directions from `c` count (each output ring is its cage ring: the rays from `c` through them) */
const ring = (c, X, V) => Object.fromEntries(ringSlots(32).map((sl, j) => { const t = (2 * Math.PI * j) / 32; return [sl, add(c, add(scl(V, 0.1 * dmath.cos(t)), scl(X, 0.1 * dmath.sin(t))))]; }));
const cageOf = (P, rings) => ({ ...P, slots: ringSlots(32), stations: rings.map((g, i) => ({ id: `st${i}`, u: i, points: ring(...g) })), caps: { back: [0, 0, 0], tip: [0, 0, 0] }, bind: { bone: P.bind.bone } });

/** a foot part re-sampled. THE FOOT a sock: its spine down the ankle from over the handover level (inside the shank) to a
 * quarter circle (radius 0.27 W, its centre over the instep, outside the skin, so no two rings' planes meet inside
 * the foot) and on level to past the toe base (inside the toes); each ring square to the spine, its front slot the
 * leg's front turning to the foot's top, its rays from the spine. The heel is the bend's outside. THE TOES in planes
 * along the toe line (`slant` degrees out of square, the big toe's tip ahead of the little toe's), each ring's rays from
 * the middle of the skin it cuts, from inside the foot to the big toe's tip, closer toward the tips; the tip's pole on
 * the skin. Then the bind */
export function footPart(P, sd, { R, B, limb, frame, W, shank, shankSd }) {
  const Lb = B.limbs[limb], J = R.joints, a0 = J.ankleR, up = [0, 0, 1], F = unit([J.toeBaseR[0] - a0[0], J.toeBaseR[1] - a0[1], 0]), X = unit(cross(F, up));
  const { ground, zc } = frame, plane = dot(sub(J.toeBaseR, a0), F), n = Lb.rings, at = (y, z) => [a0[0] + F[0] * y, a0[1] + F[1] * y, z];
  let out;
  if (limb === 'foot') {
    // (the forefoot's middle height at the toe base: the spine's level run)
    let lo = null, hi = null; for (let z = ground; z < zc; z += 0.001) { if (sd(at(plane, z)) < 0) { lo ??= z; hi = z; } }
    const z0 = (lo + hi) / 2, Rb = 0.27 * W, top = zc + BAND + 0.002, zB = z0 + Rb, yEnd = plane + 0.02;
    const runs = [top - zB, (Math.PI / 2) * Rb, yEnd - Rb], L = runs[0] + runs[1] + runs[2];
    const spine = (d) => {
      if (d <= runs[0]) return { c: at(0, top - d), t: [0, 0, -1] };
      if (d <= runs[0] + runs[1]) { const f = (d - runs[0]) / Rb, c = dmath.cos(f), s = dmath.sin(f); return { c: at(Rb - Rb * c, zB - Rb * s), t: unit(add(scl(F, s), [0, 0, -c])) }; }
      return { c: at(Rb + d - runs[0] - runs[1], z0), t: F };
    };
    // (a ring whose spine point the skin does not hold, past the toe base where the foot is set inside the toes, casts
    // from the nearest point straight over or under it that it does: cast from outside, its rays found the shin)
    const inside = (c) => { if (sd(c) < 0) return c; for (let h = 0.001; h < 0.03; h += 0.001) for (const q of [[c[0], c[1], c[2] - h], [c[0], c[1], c[2] + h]]) if (sd(q) < -0.002) return q; return c; };
    out = resamplePart(cageOf(P, Array.from({ length: n }, (_, i) => { const { c, t } = spine((L * i) / (n - 1)); return [c, X, unit(cross(X, t))]; })), sd, { around: Lb.around, rings: n, relax: 10, origin: inside });
    const ends = [out.stations[0], out.stations.at(-1)].map((s) => { const p = out.slots.map((sl) => s.points[sl]), c = scl(p.reduce((a, q) => add(a, q), [0, 0, 0]), 1 / p.length); return [c, p.reduce((a, q) => a + len(sub(q, c)), 0) / p.length]; });
    out.caps = { back: add(ends[0][0], [0, 0, ends[0][1] / 3]).map(r6), tip: add(ends[1][0], scl(F, ends[1][1] / 3)).map(r6) };
  } else {
    const a = ((Lb.slant ?? 0) * Math.PI) / 180, N = add(scl(F, dmath.cos(a)), scl(X, dmath.sin(a))), Xs = unit(cross(N, up)), o = J.toeBaseR;
    // a section at `d` along N from the toe base: its inside points on a 1.5 mm grid, their centroid (or the inside point
    // nearest it)
    const section = (d) => {
      const c0 = add(o, scl(N, d)), ins = [];
      for (let x = -0.3 * W; x <= 0.3 * W; x += 0.0015) for (let z = ground; z <= ground + 0.3 * W; z += 0.0015) { const q = add([c0[0], c0[1], 0], add(scl(Xs, x), [0, 0, z])); if (sd(q) < 0) ins.push(q); }
      if (!ins.length) return null;
      const c = scl(ins.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / ins.length);
      return sd(c) < 0 ? c : ins.reduce((b, q) => (len(sub(q, c)) < len(sub(b, c)) ? q : b), ins[0]);
    };
    let dTip = dot(sub(J.toeTipR, o), N); while (section(dTip + 0.001)) dTip += 0.001; while (!section(dTip)) dTip -= 0.001;
    const d0 = -0.035 * (W / 0.2), ds = Array.from({ length: n }, (_, i) => d0 + ((dTip - 0.0015 - d0) * i) / (n - 1));
    out = resamplePart(cageOf(P, ds.map((d) => [section(d), Xs, up])), sd, { around: Lb.around, rings: n, relax: 3 });
    const ends = [out.stations[0], out.stations.at(-1)].map((s) => { const p = out.slots.map((sl) => s.points[sl]), c = scl(p.reduce((q, x) => add(q, x), [0, 0, 0]), 1 / p.length); return [c, p.reduce((q, x) => q + len(sub(x, c)), 0) / p.length]; });
    const pole = crossing(sd, ends[1][0], N, 0.05);
    out.caps = { back: sub(ends[0][0], scl(N, ends[0][1] / 3)).map(r6), tip: (pole ?? add(ends[1][0], scl(N, ends[1][1] / 3))).map(r6) };
  }
  // (each ring's `u` the authored part's span shared over the rings, as a re-sampled limb's is: an address made for the
  // authored foot, a sabaton's window, lands on the same share of this one)
  out = { ...out, stations: out.stations.map((st, i, all) => ({ ...st, u: r6(((P.stations.length - 1) * i) / (all.length - 1)) })) };
  return bindFoot(out, { limb, frame, W, shank, shankSd });
}

/** the foot's bind: a point on the ankle's column (within `0.08 W` of the shank's own skin, which runs on inside it to
 * the shank's last ring) or over the handover level carries the shank's own share at its height (its re-sampled rings',
 * between the two round it), eased to the foot's bone away from both (the heel's back, the sole, the instep), so the two
 * skins move as one where they lie together; the toes their own bone (the toe base's hinge band is formSlice's) */
function bindFoot(P, { limb, frame, W, shank, shankSd }) {
  if (limb !== 'foot' || !shank) return P;
  const sb = shank.bind, own = { [sb.bone]: 1 }, cz = (s) => shank.slots.reduce((a, sl) => a + s.points[sl][2], 0) / shank.slots.length;
  const rings = shank.stations.map((s) => ({ z: cz(s), w: sb.blend?.[s.id] || own })).sort((a, b) => a.z - b.z);
  const shankAt = (z) => {
    if (z <= rings[0].z) return rings[0].w;
    for (let i = 0; i < rings.length - 1; i++) if (z <= rings[i + 1].z) return mixW(rings[i].w, rings[i + 1].w, (z - rings[i].z) / (rings[i + 1].z - rings[i].z));
    return rings.at(-1).w;
  };
  const ha = 0.15 * W, hd = 0.08 * W, { zc } = frame, blend = {}, bone = P.bind.bone;
  const at = (key, p) => {
    const s = Math.max(sm((p[2] - zc + ha) / ha), shankSd ? sm(1 - Math.max(0, shankSd(p) - TUCK) / hd) : 0); if (s <= 0) return;
    const w = mixW({ [bone]: 1 }, shankAt(p[2]), s); if (!(Object.keys(w).length === 1 && w[bone] === 1)) blend[key] = w;
  };
  for (const st of P.stations) for (const sl of P.slots) at(`${st.id}.${sl}`, st.points[sl]);
  for (const [k, q] of Object.entries(P.caps || {})) at(k, q);
  return { ...P, bind: { ...P.bind, blend } };
}
