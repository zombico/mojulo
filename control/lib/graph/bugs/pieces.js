// PIECES: the arthropod's articulated parts are the anime hair's piece shapes (anime-form.js `piece`), lifted as
// closed ring parts. A piece is a quadratic centreline root → control → tip (the control set off the chord by `bend` ×
// its length, toward `toward`), its width along it a PROFILE of t ∈ [0, 1], `flat` its depth over its width (the thin
// side along `up`). Three shapes, one per kind of segment:
//   CARROT  a cone cut square at a wide base, tapering (`end` the share left at the tip: 0 a point): a podomere (leg
//           segment), an antenna segment, a tarsomere, a horn, a spine
//   BANANA  a flat crescent, swelling then tapering to a point: a mandible, a chela's finger, a raptorial femur
//   CHILI   a narrow stem, a quick swell, a long curved taper: a tarsal claw, a fang, a sting, a cercus, a forcipule
// ARTICULATION is the chain: each piece's root sunk `sink` × its base into the previous piece's end, the joint angle
// the turn between them (build.js: the manji chain). Pure, deterministic.
import { ringPart, sub, add, mul, dot, unit, norm } from './ring.js';
import * as dmath from '../../util/dmath.js';

const pw = (x, k) => dmath.pow(Math.max(0, x), k);
export const SHAPES = {
  carrot: (t, P) => (P.end ?? 0.6) + (1 - (P.end ?? 0.6)) * pw(1 - t, P.taper ?? 1),
  banana: (t) => pw(1 - t, 0.85) * (0.7 + 0.3 * dmath.sin(Math.PI * Math.min(1, t * 1.5))),
  chili: (t) => Math.min(1, 0.72 + 3.5 * t) * pw(1 - t, 0.8),
  // a lens bulging at `peak` (a moniliform bead, a club segment, a bulbous podomere): r0 → 1 → end
  bulb: (t, P) => { const pk = P.peak ?? 0.5, r0 = P.r0 ?? 0.7, e = P.end ?? 0.7; return t <= pk ? r0 + (1 - r0) * dmath.sin((Math.PI / 2) * (t / pk)) : e + (1 - e) * dmath.cos((Math.PI / 2) * ((t - pk) / (1 - pk))); },
};

/** ONE PIECE as a ring part. P: { shape, r (base half-width, m), flat (depth / width, 1 round), end?, taper?, bend
 * (share of length), toward ([x, y, z] the bow's side), up ([x, y, z] the thin side's normal), n (rings), group,
 * mirror } */
export function piece(name, root, tip, P) {
  const shape = SHAPES[P.shape || 'carrot']; if (!shape) throw new Error(`bug builder: piece shape '${P.shape}' is not ${Object.keys(SHAPES).join(' / ')}`);
  const chord = sub(tip, root), L = norm(chord), k = unit(chord), n = P.n ?? (P.shape === 'carrot' && !P.bend ? 3 : 6);
  let off = P.toward ? sub(P.toward, mul(k, dot(P.toward, k))) : [0, 0, 0]; off = norm(off) > 1e-9 ? unit(off) : [0, 0, 0];
  const ctrl = add(mul(add(root, tip), 0.5), mul(off, (P.bend || 0) * L));
  const at = (t) => add(add(mul(root, (1 - t) ** 2), mul(ctrl, 2 * (1 - t) * t)), mul(tip, t * t));
  const dAt = (t) => unit(add(mul(sub(ctrl, root), 2 * (1 - t)), mul(sub(tip, ctrl), 2 * t)));
  const pointed = (P.shape || 'carrot') !== 'carrot' && P.shape !== 'bulb' || (P.end ?? 0.6) < 0.08;
  const floor = 0.06, last = pointed ? 0.94 : 1, flat = P.flat ?? 1;
  const st = [];
  // a ring is never finer than 4 µm: coordinates round to the micrometre, and a finer ring collapses to a point
  for (let i = 0; i <= n; i++) { const t = (i / n) * last, w = Math.max(4e-6, P.r * Math.max(floor, shape(t, P)));
    st.push({ c: at(t), r: [w, Math.max(4e-6, w * flat)], up: P.up || [0, 0, 1], d: dAt(t) }); }
  // the cut base sits flush (a short cap); a pointed piece ends ON its tip
  return ringPart(name, st, { group: P.group, slots: P.slots || 'ring8', mirror: P.mirror ?? null, cap: [0.25, pointed ? 0 : 0.45], ...(pointed ? { tipAt: tip } : {}), up: P.up || [0, 0, 1] });
}

/** A CHAIN of pieces from `start` heading `d0`: segment i is `segs[i]` ({ len (m), r, shape, end, flat, bend, … }),
 * the heading turned before it by `turn(i, d)` (the joint). Each root sinks `sink` × its base into the previous end.
 * Returns the parts and the joint points. Antennae, a scorpion's tail, cerci, palps are chains. */
export function chain(prefix, start, d0, segs, turn, { mirror = null, group, up, sink = 0.35 } = {}) {
  const parts = [], joints = [start]; let d = unit(d0), p = start;
  segs.forEach((S, i) => { if (i) d = unit(turn(i, d)); const root = sub(p, mul(d, i ? sink * S.r : 0)), tip = add(p, mul(d, S.len));
    const u = S.up || up || (() => { let a = sub([0, 0, 1], mul(d, d[2])); if (norm(a) < 1e-6) a = sub([0, 1, 0], mul(d, d[1])); return unit(a); })();
    parts.push(piece(`${prefix}${i}${mirror === 'name' ? 'R' : ''}`, root, tip, { group, mirror, ...S, up: u })); p = tip; joints.push(tip); });
  return { parts, joints, heading: d };
}
