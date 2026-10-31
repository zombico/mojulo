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
 * shirt never moved). A dome ring and its pole ride as the end ring does; its `u` just past the end */
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
      // (a dome's ring rides as its end ring does: eased toward the cap's shares, the collarbone's fifth on the arm's top,
      // its points, carried out by the deltoid, sheared into flaps and holes as the arm rose)
      for (const sl of Q.slots) { const a = blend[`${E.id}.${sl}`] ?? blend[E.id] ?? own; blend[`${id}.${sl}`] = mixW(a, a, w); }
      const x = { id, u: r6(E.u + (end === 'back' ? -1 : 1) * 0.001 * k), points }; ORIGIN.set(x, C); dome.push(x);
    }
    // (the pole at the dome's apex: a flat cap's, on its ring's centre, would fold the fan back down under the dome)
    caps[end] = add(C, up).map(r6); origins[end] = C; blend[end] = blend[E.id] ?? own;
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
export const END_TUCK = 0.0015, END_BAND = 0.018;
/** how far an end BURIED inside a shell that shows over it dives (m), over how long a run (m): it never shows */
export const BURIED_TUCK = 0.008, BURIED_BAND = 0.025;
/** which ends of a dense part (its first station's, its last's) lie inside one of `owners` (dense parts that show over
 * it): the end ring's centre within an owner's run along its axis and within its rings' reach of it */
export function endsInside(B, owners) {
  const centre = (A, x) => scl(A.slots.reduce((a, s) => add(a, x.points[s]), [0, 0, 0]), 1 / A.slots.length);
  const inside = (p) => owners.some((A) => {
    const C = A.stations.map((x) => centre(A, x)), R = A.stations.map((x, i) => A.slots.reduce((a, s) => a + len(sub(x.points[s], C[i])), 0) / A.slots.length);
    for (let i = 0; i + 1 < C.length; i++) {
      const e = sub(C[i + 1], C[i]), l2 = dot(e, e); if (l2 < 1e-12) continue;
      const t = dot(sub(p, C[i]), e) / l2; if (t < 0 || t > 1) continue;
      if (len(sub(p, add(C[i], scl(e, t)))) < R[i] + (R[i + 1] - R[i]) * t) return true;
    }
    return false;
  });
  return [inside(centre(B, B.stations[0])), inside(centre(B, B.stations[B.stations.length - 1]))];
}
/** the most the shirt carries a point (m): past every muscle's stand off the skin */
export const MOST_MOVE = 0.065;
/** the most the shirt carries a dome's point on a shell that shows (m): the deltoid's crown lifts the arm's top about 5 cm,
 * and a dome's inner ray grazing along it toward the torso had run out 10 cm in a fin */
export const DOME_MOST = 0.07;

/** a dense part DISPLACED onto the union of the skin and `masses`: each point carried out along its ring's ray to the
 * union's surface (the skin a plane through the point, square to the ray), less its `tuck` and, near its ends, its end
 * tuck (each never more than the point moved). A point no mass reaches keeps its place. `k` one blend for every level
 * and the skin (a mark's: the nipples'), its march finer. `whole`: the tuck taken whole, moved or not (adapters/loft.js UNDER) */
export function displace(P, masses, d, tuck = 0, k = null, whole = false, buried = [false, false]) {
  if (!masses.length) return { part: P, moved: 0, capped: new Set() };
  const M = unionOf(masses, d, k), kS = k ?? skinBlendOf(d), STEP = k ? 0.0005 : 0.002, REACH = k ? 0.03 : 0.16;
  const centres = P.stations.map((x) => scl(P.slots.reduce((a, s) => add(a, x.points[s]), [0, 0, 0]), 1 / P.slots.length));
  // (each ring's run from the part's nearer end, along its rings' centres)
  const run = [0]; for (let i = 1; i < centres.length; i++) run.push(run[i - 1] + len(sub(centres[i], centres[i - 1])));
  // (an end closed in a dome is no end: the dome runs on over it, and a tuck there cut a groove round the arm under it)
  const domedBack = ORIGIN.has(P.stations[0]), domedTip = ORIGIN.has(P.stations[P.stations.length - 1]);
  // (an end BURIED inside a shell that shows over it dives deeper and longer, BURIED_TUCK: at END_TUCK the thigh's top
  // lay a millimetre under the pelvis and flickered through it in strips at the hip, the pelvis's top through the torso)
  const total = run[run.length - 1], dive = (x, deep) => { const b = deep ? BURIED_BAND : END_BAND, t = deep ? BURIED_TUCK : END_TUCK; if (x >= b) return 0; const y = 1 - x / b; return t * y * y * (3 - 2 * y); };
  const endOf = (i) => Math.max(domedBack ? 0 : dive(run[i], buried[0]), domedTip ? 0 : dive(total - run[i], buried[1]));
  let moved = 0, held = false;
  const capped = new Set();
  // (a point carried out along its ray from `c` onto the union, less its tuck; unmoved where no mass reaches)
  // (a DOME's point, the shirt's own surface and none of the wearer's, takes its tuck whole: the shoulder web's dome lay on
  // the arm's, the two shells showing through each other in patches)
  const carry = (p0, c, tk, dome = false) => {
    const t0 = len(sub(p0, c)), dir = unit(sub(p0, c));
    const f = (s) => smin(s - t0, M(add(c, scl(dir, s))), kS);
    if (f(t0) >= 0) return dome && tk ? add(c, scl(dir, t0 - tk)).map(r6) : p0;
    let lo = t0, hi = t0 + STEP; while (hi < t0 + REACH && f(hi) < 0) { lo = hi; hi += STEP; }
    // (a ray that leaves no surface within its reach, one a long mass engulfs along it, or one carried past MOST_MOVE, a
    // ray that grazed along a mass, is held AT the cap: one that kept its point had sunk patches of the skin flat under
    // the muscles round them, plates, most at the form end, where the level-0 shapes stand furthest out; the posed
    // shards these rays made are kept out of a corrective by `capped`)
    // (a dome's ray, from its end ring's centre over the end, is the shirt's own and carries its point further, DOME_MOST,
    // on a shell that shows; a dome under another shell's, `whole`, carried far had swung out in flaps as the arm rose)
    const most = dome && !whole ? DOME_MOST : MOST_MOVE;
    if (f(hi) < 0 || lo - t0 > most) { held = true; moved++; return add(c, scl(dir, t0 + most - (dome ? tk : Math.min(tk, most)))).map(r6); }
    for (let it = 0; it < 30 && hi - lo > 1e-7; it++) { const m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    // (a shell that should not show tucked in by as much as it moved, up to its tuck: adapters/loft.js TUCK)
    const s = (lo + hi) / 2; moved++;
    return add(c, scl(dir, s - (dome ? tk : Math.min(tk, s - t0)))).map(r6);
  };
  const origins = P.stations.map((x, i) => ORIGIN.get(x) ?? centres[i]);
  const carried = P.stations.map((x, i) => {
    // (a dome ring casts from its end ring's centre, so its rays leave over the end, not across it)
    const dome = ORIGIN.has(x), c = origins[i], points = {}, tk = dome ? tuck : Math.max(tuck, endOf(i));
    for (const sl of P.slots) { held = false; points[sl] = carry(x.points[sl], c, tk, dome || whole); if (held) capped.add(`${x.id}.${sl}`); }
    return { ...x, points };
  });
  const stations = sloped(P, carried, origins, capped);
  // (a point carried far past its neighbours on the grid takes their mean: rays that grazed along a mass stood a column
  // of the arm's inner side out as a fin, hidden in the torso at rest, swung out as the arm rose)
  const smoothed = unfinned(P, stations);
  const from = ORIGIN.get(P) ?? {}, caps = P.caps ? Object.fromEntries(Object.entries(P.caps).map(([k, q]) => [k, from[k] ? carry(q, from[k], tuck, true) : q])) : P.caps;
  return { part: { ...P, stations: smoothed, ...(caps ? { caps } : {}) }, moved, capped };
}

/** the steepest the shirt's skin climbs from one grid point to the next (its move's rise over their distance): a mass
 * meeting the skin square on, or a ray slanting past a mass's edge, left a step of centimetres between two neighbours
 * (34 mm over one slot on the back at the form end, read as plates); a lower point is raised along its ray to the ramp */
export const SLOPE = 0.8;
/** a displaced grid's steps eased to SLOPE: each point's move along its ray raised (never lowered) to its neighbours'
 * less SLOPE times their distance, swept until it holds; a point `capped` (its ray grazed a mass) raises none */
function sloped(P, S, C, capped) {
  const n = P.slots.length, rows = S.length;
  const dir = P.stations.map((x, i) => P.slots.map((sl) => unit(sub(x.points[sl], C[i]))));
  const m = S.map((x, i) => P.slots.map((sl, j) => dot(sub(x.points[sl], P.stations[i].points[sl]), dir[i][j])));
  const src = P.stations.map((x) => P.slots.map((sl) => !capped.has(`${x.id}.${sl}`)));
  const dist = (i, j, a, b) => len(sub(P.stations[i].points[P.slots[j]], P.stations[a].points[P.slots[b]]));
  const up = new Set();
  for (let pass = 0, changed = true; changed && pass < 16; pass++) {
    changed = false;
    const order = pass % 2 ? [...Array(rows).keys()].reverse() : [...Array(rows).keys()];
    for (const i of order) for (let jj = 0; jj < n; jj++) {
      const j = pass % 2 ? n - 1 - jj : jj;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, (j + 1) % n], [i, (j + n - 1) % n]]) {
        if (a < 0 || a >= rows || !src[a][b]) continue;
        const v = m[a][b] - SLOPE * dist(i, j, a, b);
        if (v > m[i][j] + 1e-6) { m[i][j] = v; up.add(i * n + j); changed = true; }
      }
    }
  }
  if (!up.size) return S;
  return S.map((x, i) => ({ ...x, points: Object.fromEntries(P.slots.map((sl, j) => [sl, up.has(i * n + j) ? add(P.stations[i].points[sl], scl(dir[i][j], m[i][j])).map(r6) : x.points[sl]])) }));
}

/** the least a hidden shell lies under the one that shows over it (m), past their tucks' difference */
export const UNDER_GAP = 0.002;
/** how near the shell over it (m, along the ray from its axis, on the flat body) a hidden shell's point keeps its ORDER */
export const KEEP_NEAR = 0.02;
/** a displaced part `B` (from its flat dense `B0`) KEPT IN ORDER with the shells that show over it (`owners`: [{ A0, A,
 * gap }], each's flat dense and displaced): each point of B that lay within KEEP_NEAR of an owner's skin on the flat body
 * keeps its offset along the owner's normal from the same place on the owner (its nearest face and the place in it), as
 * the shirt carried the owner, less `gap`; eased to its own displacement as it lay further off, or off the face's edge.
 * Two shells the shirt carried onto one surface from two axes had flickered through each other (the thigh's top in strips
 * over the pelvis at the hip, a jagged waist); the flat body's own order keeps the line where one passes out of the other
 * (the pelvis's brief over the thigh) where it was, and a hidden shell its gap under the other */
export function keptInOrder(B0, B, owners) {
  const O = owners.map(({ A0, A, gap }) => {
    const n = A0.slots.length, T = [];
    for (let i = 0; i + 1 < A0.stations.length; i++) for (let j = 0; j < n; j++) {
      const k = [[i, j], [i, (j + 1) % n], [i + 1, (j + 1) % n], [i + 1, j]];
      T.push([k[0], k[1], k[2]], [k[0], k[2], k[3]]);
    }
    const at = (P, [i, j]) => P.stations[i].points[P.slots[j]];
    // (the faces' winding read outward from the shell's middle ring's centre)
    const mid = A0.stations[Math.floor(A0.stations.length / 2)], mc = scl(A0.slots.reduce((a, s) => add(a, mid.points[s]), [0, 0, 0]), 1 / n);
    let sgn = 0;
    for (let j = 0; j < n; j++) { const t = T[2 * (Math.floor(A0.stations.length / 2) * n + j)]; if (!t) break; const [a, b, c] = t.map((v) => at(A0, v)); sgn += dot(cross(sub(b, a), sub(c, a)), sub(a, mc)); }
    const out = sgn < 0 ? -1 : 1;
    // (a grid of the faces by their centres, 4 cm cells)
    const cell = 0.04, grid = new Map(), key = (p) => p.map((v) => Math.floor(v / cell)).join(',');
    T.forEach((t, f) => { const c = scl(t.reduce((a, v) => add(a, at(A0, v)), [0, 0, 0]), 1 / 3), k = key(c); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(f); });
    return { A0, A, gap, T, at, out, grid, cell };
  });
  // (the nearest place on a triangle to p: its barycentrics, clamped onto the triangle)
  const nearest = (p, a, b, c) => {
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return [1, 0, 0];
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return [0, 1, 0];
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [1 - v, v, 0]; }
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return [0, 0, 1];
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [1 - w, 0, w]; }
    const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + d5 - d6); return [0, 1 - w, w]; }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [1 - v - w, v, w];
  };
  const mix = (a, b, c, [u, v, w]) => [0, 1, 2].map((k) => a[k] * u + b[k] * v + c[k] * w);
  const ease = (x) => (x <= 0 ? 1 : x >= 1 ? 0 : 1 - x * x * (3 - 2 * x));
  let changed = false;
  const stations = B.stations.map((x, bi) => {
    if (ORIGIN.has(B0.stations[bi])) return x;
    const points = {};
    for (const sl of B.slots) {
      const p0 = B0.stations[bi].points[sl];
      let p = x.points[sl];
      for (const { A0, A, gap, T, at, out, grid, cell } of O) {
        const g = p0.map((v) => Math.floor(v / cell));
        let best = null;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          for (const f of grid.get(`${g[0] + dx},${g[1] + dy},${g[2] + dz}`) ?? []) {
            const [a, b, c] = T[f].map((v) => at(A0, v)), w = nearest(p0, a, b, c), q = mix(a, b, c, w), dd = len(sub(p0, q));
            if (!best || dd < best.dd) best = { f, w, q, dd };
          }
        }
        if (!best || best.dd >= KEEP_NEAR) continue;
        const [a0, b0, c0] = T[best.f].map((v) => at(A0, v)), n0 = scl(unit(cross(sub(b0, a0), sub(c0, a0))), out);
        const d0 = dot(sub(p0, best.q), n0), off = len(sub(sub(p0, best.q), scl(n0, d0)));
        const wt = ease(Math.abs(d0) / KEEP_NEAR * 2 - 1) * ease(off / 0.01);
        if (wt <= 0) continue;
        const [a1, b1, c1] = T[best.f].map((v) => at(A, v)), n1 = scl(unit(cross(sub(b1, a1), sub(c1, a1))), out);
        const target = add(mix(a1, b1, c1, best.w), scl(n1, Math.min(d0, 0) - gap));
        p = [0, 1, 2].map((k) => r6(p[k] + (target[k] - p[k]) * wt)); changed = true;
        break;
      }
      points[sl] = p;
    }
    return { ...x, points };
  });
  return changed ? { ...B, stations } : B;
}

/** the points of a dense part's DOMES (densify's rings closing an end), as `<station>.<slot>` */
export const domeKeys = (P) => new Set(P.stations.filter((x) => ORIGIN.has(x)).flatMap((x) => P.slots.map((sl) => `${x.id}.${sl}`)));

/** a displaced grid with its FINS taken out: each point's move (from `P`'s point to `S`'s) set to its grid neighbours'
 * mean where it is more than twice their median and FIN more, twice over; a point that did not move stays exactly */
export const FIN = 0.004;
function unfinned(P, S) {
  const n = P.slots.length, rows = S.length;
  let D = S.map((x, i) => P.slots.map((sl) => sub(x.points[sl], P.stations[i].points[sl])));
  for (let pass = 0; pass < 2; pass++) {
    D = D.map((row, i) => row.map((o, j) => {
      const lo = len(o); if (lo < 1e-9) return o;
      const nb = [[i - 1, j], [i + 1, j], [i, (j + 1) % n], [i, (j + n - 1) % n]].filter(([a]) => a >= 0 && a < rows).map(([a, b]) => D[a][b]);
      const m = nb.map(len).sort((a, b) => a - b)[Math.floor(nb.length / 2)];
      return lo > 2 * m + FIN ? scl(nb.reduce((a, q) => add(a, q), [0, 0, 0]), 1 / nb.length) : o;
    }));
  }
  return S.map((x, i) => ({ ...x, points: Object.fromEntries(P.slots.map((sl, j) => [sl, len(D[i][j]) < 1e-9 ? P.stations[i].points[sl] : add(P.stations[i].points[sl], D[i][j]).map(r6)])) }));
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

/** the NIPPLES seated on a displaced trunk part (the right; the left its mirror): where a ray forward from `on` (its
 * `x` of the half biacromial out, `t` up the torso bone) leaves it, the areola and the papilla (principles.js NIPPLE) laid square to its skin, each standing proud of it */
export function nipplesOn(P, F, on, N) {
  // (on the mid-clavicular line: `x` of the half biacromial out, the ray cast straight forward from there; an `az` from
  // the axis landed them by the sternum, 7 cm apart)
  const rad = (deg) => (deg * Math.PI) / 180, z = F.trunk.z0 + on.t * F.trunk.T;
  const o = on.x !== undefined ? [on.x * F.W, 0, z] : [0, 0, z], dir = on.x !== undefined ? [0, 1, 0] : [dmath.sin(rad(on.az)), dmath.cos(rad(on.az)), 0];
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

/** the most a corrective moves a point (m): past it a ray found another surface, not the muscle's squash or a revert
 * (the move caps, MOST_MOVE and DOME_MOST, hold the rays themselves) */
export const ACT_MOST = 0.08;
/** how far past twice its neighbours' median a corrective's point may move before it takes their mean (m) */
export const SPIKE = 0.004;

/** a corrective's offsets, a side each: { R, L } by point id: each point of `active` less the same point of `rest` (a
 * part, its stations' slots and its caps) on the right (`name`), and their mirror on the left (`L`: the left part's
 * name, or a midline part's own, its slots swapped); a point that did not move, or moved past ACT_MOST, or one `capped`
 * (its `<station>.<slot>`: held at the move's cap at rest or active, its ray grazing a mass) is left out */
export function offsetsOf(name, rest, active, L, capped = null) {
  const R = {}, Lf = {}, put = (id, idL, o) => { const l = len(o); if (l > 1e-6 && l <= ACT_MOST && !capped?.has(id.slice(name.length + 1))) { R[id] = o.map(r6); Lf[idL] = [-o[0], o[1], o[2]].map(r6); } };
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
