/** musculature/passes.js — THE PASSES that put the muscle shirt on a body, in their order:
 *
 *   1. DENSIFY   each body part (a closed loft) re-sampled at the shirt's grain on its own SMOOTH cage (Catmull-Rom
 *                round each ring and along the part), its bind's shares carried as the form field's re-sampling carries
 *                them (body-relational-resample.js resamplePart); a right limb's left partner its mirror.
 *   2. SEAT      each mass of the card placed by the wearer's joints (a trunk mass by its height up the torso bone and
 *                its azimuth; a limb's by its share down the bone and its azimuth round it) on the dense skin, where a ray
 *                from the axis leaves it, standing `proud` of it, its depth along the skin's normal there.
 *   3. ARTICULATE the definition dial read per level (principles.js articulation): grown, buried, sunk.
 *   4. DISPLACE  each dense point carried out along its ring's ray (from the ring's centre through the point) to the
 *                smooth union of the skin and the masses its part wears: the skin a plane through the point, the masses
 *                summed group by group, finest level first (principles.js smin). Past every mass's reach the union is
 *                the skin itself, and the point keeps its place.
 *
 * Pure and deterministic: no dice; the trigonometry is dmath's. */
import * as dmath from '../../util/dmath.js';
import { sdEgg } from '../polygonizer/body-relational-field.js';
import { resamplePart, mirrorPart, swapRL, mixW } from '../polygonizer/body-relational-resample.js';
import { articulation, blendOf, skinBlendOf, smin, ACTIVITY } from './principles.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : [0, 0, 1]; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const at = (j) => (Array.isArray(j) ? j : j.at);

/** a part's bind as an object (`'shoulderFoldR'` is { bone: 'shoulderFoldR' }) */
const bindOf = (P) => (typeof P.bind === 'string' ? { ...P, bind: { bone: P.bind } } : P);

// ─── 1. DENSIFY ────────────────────────────────────────────────────────────────────────────────────────────────────

/** uniform Catmull-Rom between p1 and p2 at t */
const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
};
/** the part's SMOOTH cage: (u, q) → the point at u along the part (its stations' own u) and q round it (0 … 1, the
 * authored slots at q = k / n), Catmull-Rom round each ring (closed) and along the part (its end stations continued) */
export function smoothCage(P) {
  const st = P.stations.map((x, i) => ({ u: x.u ?? i, pts: P.slots.map((s) => x.points[s]) })), n = P.slots.length, last = st.length - 1;
  const ringAt = (s, q) => { const f = q * n, k = Math.floor(f), t = f - k, P0 = s.pts; return cr(P0[(k + n - 1) % n], P0[k % n], P0[(k + 1) % n], P0[(k + 2) % n], t); };
  return (u, q) => {
    let i = 0; while (i < last - 1 && st[i + 1].u < u) i++;
    const a = st[i], b = st[i + 1], t = b.u > a.u ? Math.max(0, Math.min(1, (u - a.u) / (b.u - a.u))) : 0;
    const pa = ringAt(a, q), pb = ringAt(b, q);
    // (past an end, the end continued straight: its mirror through the end station)
    const p0 = i > 0 ? ringAt(st[i - 1], q) : sub(scl(pa, 2), pb), p3 = i + 2 <= last ? ringAt(st[i + 2], q) : sub(scl(pb, 2), pa);
    return cr(p0, pa, pb, p3, t);
  };
}

/** the shirt's ring counts for a part at `grain` metres: round its middle ring, and along it by its stations' centres */
export function grainOf(P, grain, { maxAround = 96, maxRings = 120 } = {}) {
  const centre = (x) => scl(P.slots.reduce((a, s) => add(a, x.points[s]), [0, 0, 0]), 1 / P.slots.length);
  const mid = P.stations[Math.floor(P.stations.length / 2)], n = P.slots.length;
  let per = 0; for (let k = 0; k < n; k++) per += len(sub(mid.points[P.slots[(k + 1) % n]], mid.points[P.slots[k]]));
  let run = 0; for (let i = 1; i < P.stations.length; i++) run += len(sub(centre(P.stations[i]), centre(P.stations[i - 1])));
  const even = (x) => 2 * Math.round(x / 2);
  return { around: Math.max(n, Math.min(maxAround, even(per / grain))), rings: Math.max(P.stations.length, Math.min(maxRings, Math.round(run / grain) + 1)) };
}

/** how far round its quarter a dome's rings run (radians): the last bit to the pole is the cap's fan, since the compiler
 * winds a shell by its first band (station-loft.js loft), which a ring collapsed onto the pole cannot answer */
const DOME_REACH = (70 * Math.PI) / 180;
/** a dome's least rise past its end ring (of the ring's radius): a flat cap's */
const DOME_RISE = 0.5;

/** where a dense part's DOME rings and poles cast from (displace): the end ring's centre, by station and by cap */
const ORIGIN = new WeakMap();

/** a part DENSIFIED: `around` × `rings` on its smooth cage, its bind's shares, slots' addresses and bands as
 * resamplePart carries them (cast onto no field: its rays keep the cage, whose points are then the smooth cage's); and
 * each end the adapter names (`domes`: an end that shows, the shoulder's top) CLOSED IN A DOME of rings toward its pole (a quarter ellipse from the end ring to the pole, run to
 * DOME_REACH), so the
 * shirt can be worn over an end as over the sides (the shoulder's drum and the arm's top had ended in flat fans the
 * shirt never moved). A dome ring's shares ease from the end ring's to the pole's; its `u` just past the end */
export function densify(P0, { around, rings, grain = 0.011, domes = [] }) {
  const P = bindOf(P0), Q = resamplePart(P, () => 1, { around, rings }), cage = smoothCage(P);
  let stations = Q.stations.map((x) => ({ ...x, points: Object.fromEntries(Q.slots.map((sl, j) => [sl, cage(x.u, j / around).map(r6)])) }));
  const blend = { ...Q.bind.blend, ...smoothShares(P, Q, around) }, own = { [Q.bind.bone]: 1 }, origins = {}, caps = { ...Q.caps };
  const centre = (x) => scl(Q.slots.reduce((a, sl) => add(a, x.points[sl]), [0, 0, 0]), 1 / Q.slots.length);
  for (const end of domes) {
    const pole = Q.caps?.[end]; if (!pole) continue;
    const E = end === 'back' ? stations[0] : stations[stations.length - 1], C = centre(E), rise = sub(pole, C);
    const rad = Q.slots.reduce((a, sl) => a + len(sub(E.points[sl], C)), 0) / Q.slots.length;
    // (the dome rises along the part's axis, to the pole's height or, a flat cap's pole on its ring's centre, DOME_RISE
    // of the ring's radius; a pole off the axis, leaning the dome over, folded its front: the cap's fan carries the rest)
    const N = centre(end === 'back' ? stations[1] : stations[stations.length - 2]), out = unit(sub(C, N));
    const up = scl(out, Math.max(dot(rise, out), DOME_RISE * rad));
    const K = Math.max(2, Math.min(10, Math.round(((len(rise) + rad) * Math.PI) / 4 / grain)));
    const dome = [];
    for (let k = 1; k <= K; k++) {
      const th = (k / K) * DOME_REACH, co = dmath.cos(th), si = dmath.sin(th), id = `${E.id}_${end}${k}`, w = k / (K + 1);
      const points = Object.fromEntries(Q.slots.map((sl) => [sl, add(C, add(scl(sub(E.points[sl], C), co), scl(up, si))).map(r6)]));
      for (const sl of Q.slots) { const a = blend[`${E.id}.${sl}`] ?? blend[E.id] ?? own; blend[`${id}.${sl}`] = mixW(a, blend[end] ?? own, w); }
      const x = { id, u: r6(E.u + (end === 'back' ? -1 : 1) * 0.001 * k), points }; ORIGIN.set(x, C); dome.push(x);
    }
    // (the pole at the dome's apex: a flat cap's, on its ring's centre, would fold the fan back down under the dome)
    caps[end] = add(C, up).map(r6); origins[end] = C;
    stations = end === 'back' ? [...dome.reverse(), ...stations] : [...stations, ...dome];
  }
  const out = { ...Q, stations, ...(Q.caps ? { caps } : {}), bind: { ...Q.bind, blend } };
  ORIGIN.set(out, origins);
  return out;
}

/** a part's per-slot shares (an authored bind naming slots, `<station>.<slot>`) carried onto the dense grid BETWEEN
 * the authored slots and stations (bilinear), where resamplePart takes the nearest authored slot's: round the shoulder
 * the anime body binds slot by slot, and a step in the shares between two dense neighbours tore the skin into shards
 * as the arm rose. A part with a hard zone, or none named by slot, keeps resamplePart's */
function smoothShares(P, Q, around) {
  const b = P.bind; if (b.zone > 0 || !Object.keys(b.blend || {}).some((k) => k.includes('.'))) return {};
  const st = P.stations.map((x, i) => ({ id: x.id, u: x.u ?? i })), SL = P.slots, n0 = SL.length, own = { [b.bone]: 1 };
  const share = (a, k) => b.blend[`${a.id}.${SL[k % n0]}`] ?? b.blend[a.id] ?? own;
  const out = {};
  for (const x of Q.stations) {
    let i = 0; while (i < st.length - 2 && st[i + 1].u < x.u) i++;
    const a = st[i], c = st[i + 1], tu = c.u > a.u ? Math.max(0, Math.min(1, (x.u - a.u) / (c.u - a.u))) : 0;
    Q.slots.forEach((sl, j) => {
      const f = (j / around) * n0, k = Math.floor(f), tf = f - k;
      const w = mixW(mixW(share(a, k), share(a, k + 1), tf), mixW(share(c, k), share(c, k + 1), tf), tu);
      if (!(Object.keys(w).length === 1 && w[b.bone] === 1)) out[`${x.id}.${sl}`] = w;
    });
  }
  return out;
}

// ─── 2. SEAT ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** the first crossing of a ray (origin `o`, unit `d`) with a dense part's skin, outward: { p, n, t } or null */
export function rayHit(P, o, d) {
  const n = P.slots.length; let best = null;
  for (let i = 0; i + 1 < P.stations.length; i++) {
    const A = P.stations[i].points, B = P.stations[i + 1].points;
    for (let j = 0; j < n; j++) {
      const a = A[P.slots[j]], b = A[P.slots[(j + 1) % n]], c = B[P.slots[(j + 1) % n]], e = B[P.slots[j]];
      for (const [v0, v1, v2] of [[a, b, c], [a, c, e]]) {
        // (Möller–Trumbore)
        const e1 = sub(v1, v0), e2 = sub(v2, v0), h = cross(d, e2), det = dot(e1, h); if (Math.abs(det) < 1e-14) continue;
        const f = 1 / det, s = sub(o, v0), u = f * dot(s, h); if (u < 0 || u > 1) continue;
        const qv = cross(s, e1), v = f * dot(d, qv); if (v < 0 || u + v > 1) continue;
        const t = f * dot(e2, qv); if (!(t > 1e-6) || (best && t >= best.t)) continue;
        let nn = unit(cross(e1, e2)); if (dot(nn, d) < 0) nn = scl(nn, -1);
        best = { p: add(o, scl(d, t)), n: nn, t };
      }
    }
  }
  return best;
}

/** the wearer's frames: the trunk (its axis, the torso bone's height T over the navel, W the half biacromial) and each
 * right limb (its bone, the world's forward laid square to it, the outside) */
export function frames(R) {
  const J = R.joints, navel = at(J.navel), neck = at(J.neckHub), W = Math.abs(at(J.shoulderR)[0]);
  const LIMBS = { upperArm: ['shoulderR', 'elbowR'], foreArm: ['elbowR', 'wristR'], thigh: ['hipR', 'kneeR'], shank: ['kneeR', 'ankleR'] };
  const limb = Object.fromEntries(Object.entries(LIMBS).filter(([, [a, b]]) => J[a] && J[b]).map(([k, [a, b]]) => {
    const h = at(J[a]), tl = at(J[b]), ax = unit(sub(tl, h)), fr = unit(sub([0, 1, 0], scl(ax, ax[1]))), out = unit(cross(ax, fr));
    return [k, { h, ax, fr, out, L: len(sub(tl, h)) }];
  }));
  return { W, trunk: { z0: navel[2], T: neck[2] - navel[2] }, limb };
}

/** a mass of the card seated on the wearer, articulated at definition `d` (its group's `finest` level): an egg
 * { id, c, ax, r, level, group } in metres, or null when its ray finds no skin (named in the report) */
export function seatMass(m, g, F, dense, d, finest) {
  const W = F.W, rad = (deg) => (deg * Math.PI) / 180;
  let o, dir, along;
  if (g.frame === 'trunk') {
    o = [0, 0, F.trunk.z0 + m.on.t * F.trunk.T];
    const ce = m.on.el ? dmath.cos(rad(m.on.el)) : 1;
    dir = [dmath.sin(rad(m.on.az)) * ce, dmath.cos(rad(m.on.az)) * ce, m.on.el ? dmath.sin(rad(m.on.el)) : 0];
    along = m.along ? unit(m.along) : [0, 0, 1];
  } else {
    const L = F.limb[g.frame]; if (!L) return null;
    o = add(L.h, scl(L.ax, m.on.s * L.L));
    const ce = m.on.el ? dmath.cos(rad(m.on.el)) : 1;
    dir = add(scl(add(scl(L.fr, dmath.cos(rad(m.on.az))), scl(L.out, dmath.sin(rad(m.on.az)))), ce), m.on.el ? scl(L.ax, -dmath.sin(rad(m.on.el))) : [0, 0, 0]);
    along = L.ax;
  }
  // the skin under the mass: the first of its group's parts its ray leaves
  let hit = null;
  for (const pn of g.parts) { const P = dense[pn] ?? dense[`${pn}R`]; if (!P) continue; hit = rayHit(P, o, dir); if (hit) break; }
  if (!hit) return null;
  const n = hit.n, A = articulation(m.level, d, finest);
  // the fibre laid into the skin's tangent plane, and turned `spin` degrees about the normal
  let a = unit(sub(along, scl(n, dot(along, n)))); if (m.spin) { const s = rad(m.spin), b = cross(n, a); a = unit(add(scl(a, dmath.cos(s)), scl(b, dmath.sin(s)))); }
  const b = cross(n, a), r = m.r.map((x) => x * W * A.grow), proud = m.proud * W * A.proud;
  // the mass stands `proud` of the skin, sunk under its children as they rise and buried while its level has not come
  const depth = proud - r[2] - A.bury * (r[2] + proud) - A.sink * r[2];
  return { id: m.id, group: g.id, level: m.level, c: add(hit.p, scl(n, depth)), ax: [a, b, n], r, proud, bone: g.frame === 'trunk' ? 0 : F.limb[g.frame].L };
}

/** a seated egg mirrored across x = 0 (the left side's) */
const mirrorEgg = (e) => ({ ...e, id: `${e.id}L`, c: [-e.c[0], e.c[1], e.c[2]], ax: e.ax.map(([x, y, z]) => [-x, y, z]) });

// ─── 4. DISPLACE ───────────────────────────────────────────────────────────────────────────────────────────────────

/** the union of a set of seated masses at definition `d`: each group summed finest level first (a level's masses by
 * its blend, then with the finer levels' union by the same), the groups by level 0's */
export function unionOf(masses, d, k = null) {
  // (a level none of a group's masses seated on is empty, never a hole: Array.from, since map skips one)
  const groups = new Map();
  for (const e of masses) { let g = groups.get(e.group); if (!g) groups.set(e.group, g = []); (g[e.level] ??= []).push(e); }
  const k0 = k ?? blendOf(0, d), G = [...groups.values()].map((levels) => Array.from(levels, (es, l) => ({ es: es ?? [], k: k ?? blendOf(l, d) })));
  return (q) => {
    let all = Infinity;
    for (const levels of G) {
      let acc = Infinity;
      for (let l = levels.length - 1; l >= 0; l--) {
        const { es, k } = levels[l]; let s = acc;
        for (const e of es) s = smin(s, sdEgg(q, e), k);
        acc = s;
      }
      all = smin(all, acc, k0);
    }
    return all;
  };
}

/** how far a shell's ENDS dive under their neighbours (metres), over how long a run from each end (metres): the shell
 * that shows along an overlap would otherwise end on the muscle in a rim a few millimetres proud of the one it overlaps
 * (the torso's over the pelvis, the arm's over the elbow's bridge), a step at every joint */
export const END_TUCK = 0.004, END_BAND = 0.018;
/** the most the shirt carries a point (m): past every muscle's stand off the skin */
export const MOST_MOVE = 0.045;

/** a dense part DISPLACED onto the union of the skin and `masses`: each point carried out along its ring's ray to the
 * union's surface (the skin a plane through the point, square to the ray), less its `tuck` and, near its ends, its end
 * tuck (each never more than the point moved). A point no mass reaches keeps its place. `k` one blend for every level
 * and the skin (a mark's: the nipples'), its march finer. `whole`: the tuck taken whole, moved or not (adapters/loft.js UNDER) */
export function displace(P, masses, d, tuck = 0, k = null, whole = false) {
  if (!masses.length) return { part: P, moved: 0 };
  const M = unionOf(masses, d, k), kS = k ?? skinBlendOf(d), STEP = k ? 0.0005 : 0.002, REACH = k ? 0.03 : 0.16;
  const centres = P.stations.map((x) => scl(P.slots.reduce((a, s) => add(a, x.points[s]), [0, 0, 0]), 1 / P.slots.length));
  // (each ring's run from the part's nearer end, along its rings' centres)
  const run = [0]; for (let i = 1; i < centres.length; i++) run.push(run[i - 1] + len(sub(centres[i], centres[i - 1])));
  // (an end closed in a dome is no end: the dome runs on over it, and a tuck there cut a groove round the arm under it)
  const domedBack = ORIGIN.has(P.stations[0]), domedTip = ORIGIN.has(P.stations[P.stations.length - 1]);
  const total = run[run.length - 1], endOf = (i) => { const x = Math.min(domedBack ? Infinity : run[i], domedTip ? Infinity : total - run[i]) / END_BAND; if (x >= 1) return 0; const y = 1 - x; return END_TUCK * y * y * (3 - 2 * y); };
  let moved = 0;
  // (a point carried out along its ray from `c` onto the union, less its tuck; unmoved where no mass reaches)
  // (a DOME's point, the shirt's own surface and none of the wearer's, takes its tuck whole: the shoulder web's dome lay on
  // the arm's, the two shells showing through each other in patches)
  const carry = (p0, c, tk, dome = false) => {
    const t0 = len(sub(p0, c)), dir = unit(sub(p0, c));
    const f = (s) => smin(s - t0, M(add(c, scl(dir, s))), kS);
    if (f(t0) >= 0) return dome && tk ? add(c, scl(dir, t0 - tk)).map(r6) : p0;
    let lo = t0, hi = t0 + STEP; while (hi < t0 + REACH && f(hi) < 0) { lo = hi; hi += STEP; }
    // (a ray that leaves no surface within its reach, one a long mass engulfs along it, keeps its point; and so does one
    // carried past MOST_MOVE, a ray that grazed along a mass: hidden in another shell at rest, posed it stood out in shards)
    // (a dome's ray, from its end ring's centre over the end, is the shirt's own and carries its point as far as its muscle,
    // on a shell that shows; a dome under another shell's, `whole`, carried far had swung out in flaps as the arm rose)
    if (f(hi) < 0 || (!(dome && !whole) && lo - t0 > MOST_MOVE)) return p0;
    for (let it = 0; it < 30 && hi - lo > 1e-7; it++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    // (a shell that should not show tucked in by as much as it moved, up to its tuck: adapters/loft.js TUCK)
    const s = (lo + hi) / 2; moved++;
    return add(c, scl(dir, s - (dome ? tk : Math.min(tk, s - t0)))).map(r6);
  };
  const stations = P.stations.map((x, i) => {
    // (a dome ring casts from its end ring's centre, so its rays leave over the end, not across it)
    const dome = ORIGIN.has(x), c = ORIGIN.get(x) ?? centres[i], points = {}, tk = dome ? tuck : Math.max(tuck, endOf(i));
    for (const sl of P.slots) points[sl] = carry(x.points[sl], c, tk, dome || whole);
    return { ...x, points };
  });
  const from = ORIGIN.get(P) ?? {}, caps = P.caps ? Object.fromEntries(Object.entries(P.caps).map(([k, q]) => [k, from[k] ? carry(q, from[k], tuck, true) : q])) : P.caps;
  return { part: { ...P, stations, ...(caps ? { caps } : {}) }, moved };
}
/** a midline part made exactly symmetric: each left slot the mirror of its right partner, the midline slots on x = 0 */
export function symmetrize(P) {
  const stations = P.stations.map((x) => ({ ...x, points: Object.fromEntries(P.slots.map((sl) => {
    const p = x.points[sl];
    if (/L$/.test(sl)) { const q = x.points[swapRL(sl)]; return [sl, [r6(-q[0]), q[1], q[2]]]; }
    return [sl, /R$/.test(sl) ? p : [0, p[1], p[2]]];
  })) }));
  return { ...P, stations };
}

export { mirrorPart, mirrorEgg };

// ─── 5. THE HANDS ──────────────────────────────────────────────────────────────────────────────────────────────────

/** a part's widest ring's girth (its own rings, not a dome's) */
export function girthOf(P) {
  let best = 0;
  for (const x of P.stations) {
    if (/_(back|tip)\d+$/.test(x.id)) continue;
    let g = 0; for (let k = 0; k < P.slots.length; k++) g += len(sub(x.points[P.slots[(k + 1) % P.slots.length]], x.points[P.slots[k]]));
    if (g > best) best = g;
  }
  return best;
}

/** the recipe's hands scaled `f` about each wrist: the parts `partsOf(S)` names (their stations and caps) and the joints
 * `jointsOf(S)` names, so the fingers still turn in their knuckles; a part `ramp` names eased from 1 at its back to `f`
 * (the form field's physique `hands`, body-relational.js) */
export const handsScaled = (parts, rig, f, partsOf, jointsOf, ramp = () => false) => scaledAbout(parts, rig, f, (S) => rig.joints[`wrist${S}`] && at(rig.joints[`wrist${S}`]), partsOf, jointsOf, ramp);

/** the recipe's feet scaled `f` about the ground under each ankle (the lowest point of the side's foot parts, under the
 * ankle joint), so the sole stays on it and the foot grows forward, back and up */
export function feetScaled(parts, rig, f, partsOf, jointsOf) {
  const ground = (S) => {
    const a = rig.joints[`ankle${S}`]; if (!a) return null;
    let z = Infinity; const re = partsOf(S);
    for (const [k, P] of Object.entries(parts)) if (re.test(k)) for (const x of P.stations) for (const p of Object.values(x.points)) if (p[2] < z) z = p[2];
    return Number.isFinite(z) ? [at(a)[0], at(a)[1], z] : null;
  };
  return scaledAbout(parts, rig, f, ground, partsOf, jointsOf);
}

/** parts and joints scaled `f` about each side's centre `centreOf(S)`: the parts `partsOf(S)` names (their stations and
 * caps; one `ramp` names eased from 1 at its back to `f`) and the joints `jointsOf(S)` names */
export function scaledAbout(parts, rig, f, centreOf, partsOf, jointsOf, ramp = () => false) {
  if (f === 1) return { parts, rig };
  const P = { ...parts }, joints = { ...rig.joints };
  for (const S of ['R', 'L']) {
    const c = centreOf(S); if (!c) continue;
    const re = partsOf(S), rj = jointsOf(S), toAt = (g) => (p) => add(c, scl(sub(p, c), g)).map(r6);
    for (const [k, Pt] of Object.entries(parts)) if (re.test(k)) {
      // (a bridge from the forearm, `ramp`, grows from none at its forearm end to the hand's at its hand end: grown whole, it
      // stood over the forearm's slim end as a cuff)
      const n = Pt.stations.length, by = (i) => (ramp(k) ? 1 + ((f - 1) * i) / (n - 1) : f);
      P[k] = { ...Pt, stations: Pt.stations.map((x, i) => ({ ...x, points: Object.fromEntries(Object.entries(x.points).map(([sl, p]) => [sl, toAt(by(i))(p)])) })), ...(Pt.caps ? { caps: Object.fromEntries(Object.entries(Pt.caps).map(([q, p]) => [q, toAt(q === 'back' ? by(0) : by(n - 1))(p)])) } : {}) };
    }
    for (const j of Object.keys(joints)) if (rj.test(j)) { const v = joints[j]; joints[j] = Array.isArray(v) ? toAt(f)(v) : { ...v, at: toAt(f)(v.at) }; }
  }
  return { parts: P, rig: { ...rig, joints } };
}

// ─── 6. MARKS ON THE SKIN ──────────────────────────────────────────────────────────────────────────────────────────

/** the NIPPLES seated on a displaced trunk part (the right; the left its mirror): where a ray from the trunk's axis at
 * `on` leaves it, the areola and the papilla (principles.js NIPPLE) laid square to its skin, each standing proud of it */
export function nipplesOn(P, F, on, N) {
  const rad = (deg) => (deg * Math.PI) / 180, o = [0, 0, F.trunk.z0 + on.t * F.trunk.T], dir = [dmath.sin(rad(on.az)), dmath.cos(rad(on.az)), 0];
  const hit = rayHit(P, o, dir); if (!hit) return [];
  const n = hit.n, a = unit(sub([0, 0, 1], scl(n, n[2]))), b = cross(n, a);
  const egg = (id, m) => { const r = m.r.map((x) => x * F.W); return { id, group: 'nipple', level: 0, c: add(hit.p, scl(n, m.proud * F.W - r[2])), ax: [a, b, n], r }; };
  const R = [egg('areola', N.areola), egg('papilla', N.papilla)];
  return [...R, ...R.map(mirrorEgg)];
}

// ─── 7. SQUASH AND STRETCH ─────────────────────────────────────────────────────────────────────────────────────────

/** a seated mass IN ACTIVITY (principles.js ACTIVITY[role], at the joint's full drive): its radii along, across and
 * deep scaled, standing prouder or nearer the bone on the skin it was seated on, and slid toward its origin along its
 * fibre (`slide` of its bone) */
export function activeMass(e, role) {
  const A = ACTIVITY[role], [a, , n] = e.ax, r = [e.r[0] * A.along, e.r[1] * A.across, e.r[2] * A.depth];
  const lift = e.proud * (A.proud - 1) - (r[2] - e.r[2]), slide = -A.slide * (e.bone ?? 0);
  return { ...e, r, c: add(add(e.c, scl(n, lift)), scl(a, slide)) };
}

/** the most a corrective moves a point (m): past it a ray found another surface, not the muscle's squash */
export const ACT_MOST = 0.04;
/** how far past twice its neighbours' median a corrective's point may move before it takes their mean (m) */
export const SPIKE = 0.004;

/** a corrective's offsets, a side each: { R, L } by point id: each point of `active` less the same point of `rest` (a
 * part, its stations' slots and its caps) on the right (`name`), and their mirror on the left (`L`: the left part's
 * name, or a midline part's own, its slots swapped); a point that did not move, or moved past ACT_MOST, is left out */
export function offsetsOf(name, rest, active, L) {
  const R = {}, Lf = {}, put = (id, idL, o) => { const l = len(o); if (l > 1e-6 && l <= ACT_MOST) { R[id] = o.map(r6); Lf[idL] = [-o[0], o[1], o[2]].map(r6); } };
  // (a point moved far past its neighbours on the grid, a ray that found another surface, takes their mean: more than
  // twice their median, and SPIKE more)
  const n = rest.slots.length, O = rest.stations.map((x, i) => rest.slots.map((sl) => sub(active.stations[i].points[sl], x.points[sl])));
  const near = (i, j) => [[i - 1, j], [i + 1, j], [i, (j + 1) % n], [i, (j + n - 1) % n]].filter(([a]) => a >= 0 && a < O.length).map(([a, b]) => O[a][b]);
  const F = O.map((row, i) => row.map((o, j) => {
    const nb = near(i, j), m = nb.map(len).sort((a, b) => a - b)[Math.floor(nb.length / 2)];
    return len(o) > 2 * m + SPIKE ? scl(nb.reduce((a, q) => add(a, q), [0, 0, 0]), 1 / nb.length) : o;
  }));
  rest.stations.forEach((x, i) => rest.slots.forEach((sl, j) => put(`${name}/${x.id}.${sl}`, `${L}/${x.id}.${swapRL(sl)}`, F[i][j])));
  for (const k of Object.keys(rest.caps ?? {})) put(`${name}/${k}`, `${L}/${k}`, sub(active.caps[k], rest.caps[k]));
  return { R, L: Lf };
}
