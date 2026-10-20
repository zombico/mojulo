/** body-relational-field.js — the form field's distances and its queries: an egg's and a round cone's signed distance, the skin
 * wave (log-sum-exp), the build's frame on the rig (bodyFrame), the body's field (bodyField) and a limb's (limbField),
 * and the two ways onto a field, a ray's first crossing outward (crossing) and Newton's projection (project). Pure and
 * deterministic (dmath). */
import * as dmath from '../../util/dmath.js';
import { BREAST_FIELD, breastHeight } from './breast-field.js';
import { add, sub, scl, dot, cross, len, unit } from './body-relational-vec.js';
import { BODY_BUILDS, thick } from './body-relational-builds.js';

/** an ellipsoid's signed distance (the bound Inigo Quilez's k0·(k0 − 1)/k1: exact on the surface, close near it) */
// (written out without arrays, the same arithmetic in the same order as the vector helpers': the field is evaluated
// millions of times a slice, and the allocations were most of its cost)
export function sdEgg(p, e) {
  const c = e.c, A = e.ax, r = e.r, d0 = p[0] - c[0], d1 = p[1] - c[1], d2 = p[2] - c[2];
  const q0 = (d0 * A[0][0] + d1 * A[0][1] + d2 * A[0][2]) / r[0], q1 = (d0 * A[1][0] + d1 * A[1][1] + d2 * A[1][2]) / r[1], q2 = (d0 * A[2][0] + d1 * A[2][1] + d2 * A[2][2]) / r[2];
  const k0 = Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2), u0 = q0 / r[0], u1 = q1 / r[1], u2 = q2 / r[2], k1 = Math.sqrt(u0 * u0 + u1 * u1 + u2 * u2);
  return k1 > 1e-12 ? (k0 * (k0 - 1)) / k1 : -Math.min(...r);
}
/** a round cone's signed distance (the hull of two spheres; vajra.js's, on arrays) */
export function sdCone(p, a, b, r1, r2) {
  // (without arrays, as sdEgg: the same arithmetic in the same order)
  const b0 = b[0] - a[0], b1 = b[1] - a[1], b2 = b[2] - a[2], l2 = b0 * b0 + b1 * b1 + b2 * b2, rr = r1 - r2, a2 = l2 - rr * rr;
  if (l2 < 1e-12 || a2 <= 1e-12) return Math.min(len(sub(p, a)) - r1, len(sub(p, b)) - r2);
  const il2 = 1 / l2, p0 = p[0] - a[0], p1 = p[1] - a[1], p2 = p[2] - a[2], y = p0 * b0 + p1 * b1 + p2 * b2, z = y - l2;
  const x0 = p0 * l2 - b0 * y, x1 = p1 * l2 - b1 * y, x3 = p2 * l2 - b2 * y;
  const x2 = x0 * x0 + x1 * x1 + x3 * x3, y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
/** a mass's signed distance, unclipped (an egg or a round cone, as the fields build them) */
export const sdPrim = (p, q) => (p.cone ? sdConeOf(p, q) : sdEgg(q, p));
/** a round cone's distance, `squash`ed front to back (its section an ellipse, depth `squash` of its width: the seat's
 * taper, as wide as the waist and no deeper than the belly; the stretched distance scaled back, a bound) */
export function sdConeOf(p, q) {
  if (!p.squash) return sdCone(q, p.cone[0], p.cone[1], p.r[0], p.r[1]);
  const cy = (p.cone[0][1] + p.cone[1][1]) / 2;
  return sdCone([q[0], cy + (q[1] - cy) / p.squash, q[2]], p.cone[0], p.cone[1], p.r[0], p.r[1]) * p.squash;
}
/** the skin wave: −k · ln Σ e^(−dᵢ/k) (the union's surface, each mass a bump in it; shifted by the least for range) */
export function lse(ds, k) {
  let m = Infinity; for (const d of ds) if (d < m) m = d;
  let s = 0; for (const d of ds) s += dmath.exp(-(d - m) / k);
  return m - k * dmath.log(s);
}
export const smaxp = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };

/** the build's measures from the rest joints: the half biacromial W, the navel joint's height z0 and the torso bone's
 * length T; a height t up the torso bone is `zOf(t)`, z0 + t T, but under the ribs a build with a `lower` frame lays its
 * heights on the anatomy's own landmarks: the rig's navel joint is a joint of the spine at the ribs' lower edge, not the
 * navel, and the hip's joint is the leg's. Three knots, by t: `top` (above it z0 + t T, the chest as built), `navel` (the
 * navel's dimple, set `at` of the way from the hip's joint to the shoulder's, the body's own ratio) and `hip` (the hip's
 * joint's height as the build was laid out, set `lift` T over the joint); straight between the knots, and under the
 * hip's knot the build's own spacing. So the lower trunk rides the hip's joint wherever the leg puts it. `slope(t)` is
 * how much a height is stretched there (a mass's height scales with it), `tOf` the inverse */
export function bodyFrame(R, build = null) {
  // (W the body's own breadth: the half biacromial the build's tune left, by its `frame`, so a tune that brings the
  // arms in, `shoulders`, moves them over a body that stays; `Sx` where the shoulder's joint now stands, of W, which the
  // masses the arm hangs from (`joint`: the girdle, the collarbone, the trapezius's fall, the armpit) are drawn in by)
  const J = R.joints, W = (J.shoulderR[0] / (build?.tune?.shoulders ?? 1)) * (build?.frame ?? 1), Sx = J.shoulderR[0] / W, z0 = J.navel[2], T = J.neckHub[2] - J.navel[2], lin = (t) => z0 + t * T;
  const Lw = build?.lower;
  let zOf = lin, tOf = (z) => (z - z0) / T;
  if (Lw) {
    const hz = J.hipR[2], kt = [Lw.hip, Lw.navel, Lw.top], kz = [hz + Lw.lift * T, hz + Lw.at * (J.shoulderR[2] - hz), lin(Lw.top)];
    if (!(kz[0] < kz[1] && kz[1] < kz[2])) throw new Error(`body-relational: the lower frame's knots are out of order (${kz.map((z) => z.toFixed(3)).join(', ')})`);
    const seg = (x, xs, ys) => { const i = x <= xs[1] ? 0 : 1; return ys[i] + ((x - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]); };
    zOf = (t) => (t >= Lw.top ? lin(t) : t <= Lw.hip ? kz[0] + (t - Lw.hip) * T : seg(t, kt, kz));
    tOf = (z) => (z >= kz[2] ? (z - z0) / T : z <= kz[0] ? Lw.hip + (z - kz[0]) / T : seg(z, kz, kt));
  }
  const slope = (t) => (zOf(t + 0.01) - zOf(t - 0.01)) / (0.02 * T);
  return { W, Sx, z0, T, zOf, tOf, slope, at: ([x, y, t]) => [x * W, y * W, zOf(t)] };
}

/** the fat's share between the legs: none at the midline under the hip's joint, whole a hand's breadth out (the
 * layer on both inner thighs fused them, and the crotch, the lowest skin on the midline, fell to the knees). One
 * function of the world, read by the body's field and the thigh's alike, so their skins agree across the hip */
const crotchEase = (R, W) => {
  const hz = R.joints.hipR?.[2]; if (hz === undefined) return () => 1;
  const sm = (v) => { const y = Math.max(0, Math.min(1, v)); return y * y * (3 - 2 * y); };
  return (q) => 1 - sm((hz - 0.2 * W - q[2]) / (0.3 * W)) * (1 - sm(Math.abs(q[0]) / (0.45 * W)));
};

/** the field: { sd(p), base(p), masses } for a build on a rig's rest */
export function bodyField(R, build, { extra = [] } = {}) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  const F = bodyFrame(R, B), W = F.W;
  const frameOf = (along, n) => { const u = unit(sub(along, scl(n, dot(along, n)))), v = cross(n, u); return [u, v, n]; };
  // (a radius `i` stretched by the frame's `slope`, as far as it runs up the body, `up` of it)
  const tall = (r, i, up, sl) => r.map((x, j) => (j === i ? x * (1 + (sl - 1) * up) : x));
  const prim = (m) => {
    const at = m.joint ? ([x, y, t]) => F.at([x * F.Sx, y, t]) : F.at;
    if (m.cone) return { cone: [at(m.cone[0]), at(m.cone[1])], r: m.r.map((x) => x * W), ...(m.squash ? { squash: m.squash } : {}) };
    // an egg without a fibre lies on the world's axes (r: x, y, z); with one, r is along, across, depth (depth forward);
    // its height stretched as the frame stretches it there
    const ax = m.along ? frameOf(unit(m.along), [0, 1, 0]) : [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    return { egg: true, c: at(m.egg), ax, r: tall(m.r, m.along ? 0 : 2, m.along ? Math.abs(unit(m.along)[2]) : 1, F.slope(m.egg[2])).map((x) => x * W) };
  };
  const mirror = (p) => (p.cone ? { ...p, cone: p.cone.map(([x, y, z]) => [-x, y, z]) } : { ...p, c: [-p.c[0], p.c[1], p.c[2]], ax: p.ax.map(([x, y, z]) => [-x, y, z]) });
  const sides = (m, p) => (m.mid || (p.cone ? p.cone.every((q) => q[0] === 0) : p.c[0] === 0) ? [p] : [p, mirror(p)]);
  // (a mass with `clip` is cut smoothly under a cone round the trunk's axis, rising outward from (rho, z) at `slope`:
  // what a neighbour's field owns under it stays out of this one, and the cut faces outward, so a ray from the axis
  // leaves through it once; a level cut left a flat underside the rays grazed)
  const sdOf = (p, q) => {
    const d = p.cone ? sdConeOf(p, q) : sdEgg(q, p); if (!p.clip) return d;
    // (or cut under a level, `below`: the thigh's root, owned by the pelvis above the hip's handover)
    const c = p.clip, cut = c.below !== undefined ? c.below - q[2] : (c.slope * (Math.hypot(q[0], q[1]) - c.rho) - (q[2] - c.z)) / Math.hypot(1, c.slope);
    return smaxp(d, cut, c.k);
  };
  const baseP = B.base.flatMap((m) => sides(m, { ...prim(m), id: m.id })), kB = B.kBase * W, kM = B.kMuscle * W;
  // (the sums read into buffers kept between calls, not arrays made for each: the same values, in the same order)
  const bufB = new Array(baseP.length), base = (q) => { for (let i = 0; i < baseP.length; i++) bufB[i] = sdOf(baseP[i], q); return lse(bufB, kB); };
  const grad = (fn, q) => { const e = 1e-4; return unit([fn(add(q, [e, 0, 0])) - fn(sub(q, [e, 0, 0])), fn(add(q, [0, e, 0])) - fn(sub(q, [0, e, 0])), fn(add(q, [0, 0, e])) - fn(sub(q, [0, 0, e]))]); };
  // a point seated on the base: cast from the trunk's axis at height t toward the face, the base's first crossing
  const seat = (on) => {
    const z = F.zOf(on.t), o = [0, 0, z];
    const dir = on.az !== undefined ? [dmath.sin((on.az * Math.PI) / 180), dmath.cos((on.az * Math.PI) / 180), 0] : [0, on.face === 'back' ? -1 : 1, 0];
    const from = on.az !== undefined ? o : [on.x * W, 0, z];
    const s = crossing(base, from, dir, 0.6) ?? from;
    return { s, n: grad(base, s) };
  };
  const muscles = B.muscles.flatMap((m) => {
    const k = m.k ? { k: m.k * W } : {};
    if (m.cone || m.egg) return sides(m, { ...prim(m), id: m.id, ...k });
    const { s, n } = seat(m.on), r = tall(m.r, 0, Math.abs(unit(m.along)[2]), F.slope(m.on.t)).map((x) => x * W);
    const ax = frameOf(unit(m.along), n);
    return sides(m, { egg: true, c: add(s, scl(n, m.proud * W - r[2])), ax, r, id: m.id, ...k });
  });
  // masses another field owns and this one shares (the arm's deltoid heads: the shoulder's cap, so both shells agree)
  muscles.push(...extra.flatMap((p) => [p, mirror(p)]));
  const dimples = (B.dimples || []).flatMap((d) => { const { s } = seat(d.on); return [{ id: d.id, c: s, r: d.r * W, k: d.k * W }]; });
  // a mass with its own blend `k` (tighter: a border the eye reads, the pectoral's lower edge) joins after the rest
  const soft = muscles.filter((p) => !p.k), sharp = muscles.filter((p) => p.k);
  // THE BUST (`bust`): the summed skin pushed out by the breast's FIELD (breast-field.js: the footprint, the poles'
  // profiles, the cleft; gated on the field itself), the apex `t` up the torso bone and the field's cleft off the
  // midline, `rb` its radius (W). It rides on what is under it, the pectoral's slope its upper pole; the pair is the
  // greater of the two heights, so they meet in the field's own valley; on the front only
  const bustH = B.bust ? (() => {
    const Fb = { ...BREAST_FIELD, ...(B.bust.field || {}) }, rb = B.bust.rb * W, za = F.zOf(B.bust.t), cx = -Fb.cleft * rb, y0 = B.bust.front * W, k = (B.bust.fold || 0) * rb, keep = Fb.proj * rb / (Fb.proj * rb - k / 2);
    return (q) => {
      const v = (q[2] - za) / rb, f = Math.max(0, Math.min(1, (q[1] - y0) / (0.2 * W))), fr = f * f * (3 - 2 * f); if (!fr) return 0;
      // (the pair's crossing a smooth max: the hard one creased the cleft's floor, and its rings boxed there)
      const h = fr * rb * smaxp(breastHeight((q[0] - cx) / rb, v, Fb), breastHeight((-q[0] - cx) / rb, v, Fb), 0.15);
      // (the fold filleted, `fold` bust radii: the field's lower pole meets the chest in a wall, a corner no grid follows,
      // and the rings crossing its curve on the slant shaded it in stair-steps; under `k` the height eases in from flat,
      // the whole scaled back so the apex keeps its projection)
      return (h < k ? (h * h) / (2 * k) : h - k / 2) * keep;
    };
  })() : null;
  // THE SPINE'S CURVE (`spine`): the back's surface carried forward at the lumbar curve and back at the thoracic, by a
  // warp of the field over the back half only (the front, the belly and the chest, as built): each curve a bump at `t`
  // up the torso bone, `depth` in W (+ forward), `w` its half reach in t. The trunk stood as a straight column in profile
  const curve = (B.spine || []).map((c) => ({ z: F.zOf(c.t), h: (F.zOf(c.t + c.w) - F.zOf(c.t - c.w)) / 2, d: c.depth * W }));
  const bend = curve.length ? (q) => {
    const back = Math.max(0, Math.min(1, -q[1] / (0.3 * W))); if (!back) return q;
    let dy = 0; for (const c of curve) { const x = (q[2] - c.z) / c.h; if (Math.abs(x) < 1) dy += c.d * (1 - x * x) * (1 - x * x); }
    return [q[0], q[1] - dy * back * back * (3 - 2 * back), q[2]];
  } : (q) => q;
  // THE WAIST (`waist`): the trunk drawn in across, `pinch` of its width at `t` up the torso bone, eased out over `w` (in
  // t) either side, its depth as built (a woman's waist is narrower than a man's against her hips seen from the front, not
  // shallower); absent, the trunk as built
  const pinch = B.waist ? { z: F.zOf(B.waist.t), h: (F.zOf(B.waist.t + B.waist.w) - F.zOf(B.waist.t - B.waist.w)) / 2, p: B.waist.pinch } : null;
  const warp = pinch ? (q0) => {
    const q = bend(q0), x = (q[2] - pinch.z) / pinch.h; if (Math.abs(x) >= 1) return q;
    return [q[0] / (1 - pinch.p * (1 - x * x) * (1 - x * x)), q[1], q[2]];
  } : bend;
  // THE FAT (a physique's `fat`, W): one layer over the whole skin, eased out up the neck to none at the head's base,
  // where the head meets it
  const J = R.joints, nz0 = J.neckHub?.[2], nz1 = J.headBase?.[2], between = crotchEase(R, W);
  const fatAt = !B.fat ? () => 0 : nz1 > nz0 ? (q) => { const x = Math.max(0, Math.min(1, (nz1 - q[2]) / (nz1 - nz0))); return B.fat * W * x * x * (3 - 2 * x) * between(q); } : (q) => B.fat * W * between(q);
  const bufM = new Array(soft.length + 1), buf2 = [0, 0];
  const sd = (q0) => {
    const q = warp(q0);
    bufM[0] = base(q); for (let i = 0; i < soft.length; i++) bufM[i + 1] = sdOf(soft[i], q);
    let d = lse(bufM, kM);
    for (const p of sharp) { buf2[0] = d; buf2[1] = sdOf(p, q); d = lse(buf2, p.k); }
    if (bustH) d -= bustH(q);
    for (const h of dimples) d = smaxp(d, -(len(sub(q, h.c)) - h.r), h.k);
    return d - fatAt(q0);
  };
  // a field of some masses alone (by id): a part whose rings run inside another's (the neck's root in the torso) reads
  // only its own, or its rays catch the shoulder's
  const only = (ids) => { const sel = [...baseP, ...muscles].filter((p) => ids.includes(p.id)); return (q) => lse(sel.map((p) => sdOf(p, q)), kM) - fatAt(q); };
  return { build: B, frame: F, base, sd, only, fat: fatAt, bust: bustH, masses: { base: baseP, muscles, dimples } };
}

/** the first crossing outward (inside → outside) of a field along a ray, within `reach` metres; null when none */
// (the march's samples are `step` apart, but one is read only where the field has not already settled it: a sample `f`
// leaves the skin at least |f| / `LIP` away, LIP a bound on the field's slope, so the samples nearer are skipped, their
// sign known; the same samples decide, so the same crossing is found. At 2 the shank's masses broke it, a few rays
// finding a later crossing; at 4, the bound here, the slices came out as they had reading every sample)
const LIP = 4;
export function crossing(fn, o, dir, reach, step = 0.0015) {
  let t0 = 0, f0 = fn(o);
  const at = (t) => [o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t];
  if (f0 > 0) {   // the start outside: find the field first, then leave it
    let safe = f0 / LIP;
    for (let t = step; t <= reach; t += step) { if (t < safe) continue; const f = fn(at(t)); if (f <= 0) { t0 = t; f0 = f; break; } safe = t + f / LIP; }
    if (f0 > 0) return null;
  }
  let safe = t0 - f0 / LIP;
  for (let t = t0 + step; t <= reach; t += step) {
    if (t < safe) continue;
    const f = fn(at(t)); safe = t - f / LIP;
    if (f > 0) {
      // the crossing within the step, by false position (Illinois: the stale end's value halved, so it never stalls),
      // the field's values steering each cut: to a nanometre in a handful of reads, where halving took thirty
      let a = t - step, b = t, fa = fn(at(a)), fb = f, side = 0;
      for (let i = 0; i < 30 && b - a > 1e-9; i++) {
        const m = fa < 0 && fb > 0 ? (a * fb - b * fa) / (fb - fa) : (a + b) / 2, fm = fn(at(m));
        if (fm > 0) { b = m; fb = fm; if (side === 1) fa /= 2; side = 1; } else { a = m; fa = fm; if (side === -1) fb /= 2; side = -1; }
        if (Math.abs(fm) < 1e-12) return at(m);
      }
      return at((a + b) / 2);
    }
  }
  return null;
}

/** a point carried onto a field's zero set down its gradient (Newton on the distance; steps capped) */
// (Newton's steps down the field's gradient, read centred at each step, six reads; or, `forward` (the relaxing's, from
// a point a step off the skin), read forward from the value, three: the relaxing took a third of a slice. From a point
// far off the skin, the ray's fallback, or where two walls stand close (the pelvis at the crotch's level), centred: the
// cheaper read's error settled those on another stretch of the skin, millimetres away)
export function project(fn, p, iters = 24, forward = false) {
  let q = p;
  for (let i = 0; i < iters; i++) {
    const d = fn(q); if (Math.abs(d) < 1e-6) break;
    const e = 1e-4, g = forward
      ? [(fn([q[0] + e, q[1], q[2]]) - d) / e, (fn([q[0], q[1] + e, q[2]]) - d) / e, (fn([q[0], q[1], q[2] + e]) - d) / e]
      : [fn(add(q, [e, 0, 0])) - fn(sub(q, [e, 0, 0])), fn(add(q, [0, e, 0])) - fn(sub(q, [0, e, 0])), fn(add(q, [0, 0, e])) - fn(sub(q, [0, 0, e]))].map((x) => x / (2 * e));
    const gg = dot(g, g); if (gg < 1e-12) return null;
    const step = scl(g, -d / gg), l = len(step); q = add(q, l > 0.01 ? scl(step, 0.01 / l) : step);
  }
  return Math.abs(fn(q)) < 1e-4 ? q : null;
}

/** a limb's field for a build: its masses in the bone's frame (s along it from its head joint, az round it from the
 * front toward the outside, off from its axis; r along, round, out; all in W), summed with the build's `kLimb` */
export function limbField(R, build, limb, extra = []) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build, Lb = B.limbs[limb], F = bodyFrame(R, B), W = F.W, J = R.joints;
  const h = J[Lb.from], tl = J[Lb.to], ax = unit(sub(tl, h)), L = len(sub(tl, h));
  // (az 0 the world's forward laid square to the bone; a limb near level, the foot, names its own `front`, the up)
  const fr = Lb.front ? unit(sub(Lb.front, scl(ax, dot(Lb.front, ax)))) : unit(sub([0, 1, 0], scl(ax, ax[1]))), out = unit(cross(ax, fr));
  const dirAt = (az) => add(scl(fr, dmath.cos((az * Math.PI) / 180)), scl(out, dmath.sin((az * Math.PI) / 180)));
  const at = (s, az = 0, off = 0) => add(add(h, scl(ax, s * L)), scl(dirAt(az), off * W));
  const prims = (Lb.thick ? thick(Lb.masses, Lb.thick) : Lb.masses).flatMap((m) => {
    // a CHAIN: round cones bead to bead, each bead [s, az, off, r] (a mass that spirals round the bone)
    if (m.chain) return m.chain.slice(1).map((b, i) => { const a = m.chain[i]; return { id: `${m.id}${i}`, cone: [at(a[0], a[1], a[2]), at(b[0], b[1], b[2])], r: [a[3] * W, b[3] * W] }; });
    if (m.cone) return { id: m.id, cone: [at(m.cone[0], m.az, m.off?.[0] ?? 0), at(m.cone[1], m.az, m.off?.[1] ?? 0)], r: m.r.map((x) => x * W) };
    const rad = dirAt(m.az ?? 0), tan = unit(cross(ax, rad));
    return { id: m.id, egg: true, c: at(m.s, m.az, m.off ?? 0), ax: [ax, tan, rad], r: m.r.map((x) => x * W) };
  });
  const all = [...prims, ...extra], k = B.kLimb * W;
  const sdOf = (p, q) => (p.cone ? sdCone(q, p.cone[0], p.cone[1], p.r[0], p.r[1]) : sdEgg(q, p));
  // (a physique's fat, `fat`: [at the head joint, at the tail], W, straight between by where a point lies along the bone)
  const between = crotchEase(R, W), fat = !Lb.fat ? () => 0 : (q) => { const s = Math.max(0, Math.min(1, dot(sub(q, h), ax) / L)); return (Lb.fat[0] + (Lb.fat[1] - Lb.fat[0]) * s) * W * between(q); };
  return { sd: (q) => lse(all.map((p) => sdOf(p, q)), k) - fat(q), prims, fat };
}

