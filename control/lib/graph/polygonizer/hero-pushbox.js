/**
 * hero-pushbox — TWO BODIES KEPT APART, a fighting game's pushbox in the round: each fighter's body as a few CAPSULES on
 * its skeleton (the trunk, the head, each thigh, shin and upper arm; never the forearms and the hands, the gloves meant
 * to meet: a punch lands on them), and the least a fighter must be pushed back along the line between them so that no capsule of
 * one passes into a capsule of the other. Seen in a bout: a fighter folding over a body blow put his head into his
 * attacker's shoulder.
 *
 *   PUSH_CHAINS                         the capsules by the skeleton's joints: { id, from, to, along? } — a capsule
 *                                       from one joint to another, or (`along`) from a joint on past it, the head's
 *   capsulesOf(joints, radii)           → [{ id, a, b, r }]   `joints` { <name>: [x, y, z] } posed, `radii` { <id>: m }
 *   capsuleRadii(points, owner, joints) → { <id>: m }   each capsule's radius read off a mesh at rest: the 80th
 *                                       percentile of its points' distances to its segment (`owner(i)` a point's capsule)
 *   overlap(A, B)                       → metres the deepest pair passes into each other (0 apart)
 *   pushApart(A, B, dir, { gap, most }) → metres to move B along `dir` (a unit, B away from A) so the two keep `gap`
 *                                       apart; 0 when they already do
 *
 * No imports: a page or an engine's runtime loads it as it is. Pure and deterministic.
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** the body's capsules by joint (the skeleton's bones, each from its head): the trunk from the pelvis to the neck, the
 * head on past the neck's top by the head's length, each thigh from the hip to the knee, each shin from the knee to the
 * ankle, each upper arm from the shoulder to the elbow (the shoulder a folding body's head meets); never the forearms
 * and the hands */
export const PUSH_CHAINS = Object.freeze([
  Object.freeze({ id: 'trunk', from: 'pelvis', to: 'neck' }),
  Object.freeze({ id: 'head', from: 'head', along: ['neck', 'head'], length: 0.17 }),
  Object.freeze({ id: 'thighR', from: 'thighR', to: 'shankR' }), Object.freeze({ id: 'thighL', from: 'thighL', to: 'shankL' }),
  Object.freeze({ id: 'shinR', from: 'shankR', to: 'footR' }), Object.freeze({ id: 'shinL', from: 'shankL', to: 'footL' }),
  Object.freeze({ id: 'upperArmR', from: 'upperArmR', to: 'foreArmR' }), Object.freeze({ id: 'upperArmL', from: 'upperArmL', to: 'foreArmL' }),
]);

/** the capsules of a posed skeleton: each chain's segment, its radius from `radii` (a chain with no joints is left out) */
export function capsulesOf(joints, radii) {
  const out = [];
  for (const C of PUSH_CHAINS) {
    const a = joints[C.from]; if (!a || radii[C.id] === undefined) continue;
    let b = C.to ? joints[C.to] : null;
    if (C.along) { const p = joints[C.along[0]], q = joints[C.along[1]]; if (!p || !q) continue; const d = sub(q, p), l = len(d) || 1; b = add(a, mul(d, C.length / l)); }
    if (!b) continue;
    out.push({ id: C.id, a, b, r: radii[C.id] });
  }
  return out;
}

/** the nearest two segments come (metres) */
export function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a < 1e-12 && e < 1e-12) return len(r);
  if (a < 1e-12) { s = 0; t = clamp01(f / e); }
  else {
    const c = dot(d1, r);
    if (e < 1e-12) { t = 0; s = clamp01(-c / a); }
    else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-12 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  return len(sub(add(p1, mul(d1, s)), add(p2, mul(d2, t))));
}
/** a point's distance to a segment */
const toSeg = (p, a, b) => { const ab = sub(b, a), t = clamp01(dot(sub(p, a), ab) / (dot(ab, ab) || 1)); return len(sub(p, add(a, mul(ab, t)))); };

/** each capsule's radius off a mesh at rest: the 80th percentile of the distances of the points it owns to its segment */
export function capsuleRadii(points, owner, joints, { share = 0.8 } = {}) {
  const caps = capsulesOf(joints, Object.fromEntries(PUSH_CHAINS.map((C) => [C.id, 0]))), by = Object.fromEntries(caps.map((c) => [c.id, []]));
  for (let i = 0; i < points.length; i++) { const id = owner(i); const c = id && caps.find((x) => x.id === id); if (c) by[id].push(toSeg(points[i], c.a, c.b)); }
  return Object.fromEntries(Object.entries(by).filter(([, d]) => d.length).map(([id, d]) => { d.sort((x, y) => x - y); return [id, Math.round(d[Math.min(d.length - 1, Math.floor(share * d.length))] * 1e4) / 1e4]; }));
}

/** how deep the deepest pair of two bodies' capsules passes into each other (metres; 0 when every pair is apart) */
export function overlap(A, B, gap = 0) {
  let worst = 0;
  for (const p of A) for (const q of B) worst = Math.max(worst, p.r + q.r + gap - segSeg(p.a, p.b, q.a, q.b));
  return worst;
}
/** the least distance B moves along `dir` (a unit, away from A) so that no pair is nearer than `gap`: bisection on the
 * shift, the overlap falling as B backs off; at most `most` metres */
export function pushApart(A, B, dir, { gap = 0.005, most = 1 } = {}) {
  const moved = (s) => B.map((c) => ({ ...c, a: add(c.a, mul(dir, s)), b: add(c.b, mul(dir, s)) }));
  if (overlap(A, B, gap) <= 0) return 0;
  let lo = 0, hi = most;
  if (overlap(A, moved(hi), gap) > 0) return most;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (overlap(A, moved(m), gap) > 0) lo = m; else hi = m; }
  return Math.round(hi * 1e4) / 1e4;
}
