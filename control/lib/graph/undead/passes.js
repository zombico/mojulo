/**
 * THE UNDEAD'S BONES AND REST: what the undead library lays on a body (the tiered hero's: ./tiered.js, ./hero-bones.js,
 * ./tiered-layers.js), in template metres at 2 m tall (× the body's k).
 *
 *   BONE, boneLimb(s, { k, g, Bw })   a limb part as its bone: a shaft with knobbed ends (the foot's, the hand's and the
 *                       finger's their own), by the bone library's names (thigh, shin, meta, toes, upperArm, foreArm,
 *                       hand, finger)
 *   RIBS               the ribs' heights and widths on the 2 m template
 *   vertebrae(J, { k, g, s })   the vertebrae along a column's joints (spine0, spine1, spine2, neckBase, neckTop)
 *   limbColumn({ name, A, B, n, body, ridge, back, bone, group, k, s })   the same segments laid along a limb
 *   posture(card, rand)  → { lean, crouch, jaw, arms: { R, L }, head }: the rest a card stands in
 *
 * Pure: the dice are the caller's (`rand`, a seeded stream).
 */
const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const sideOf = (rand) => (rand() < 0.5 ? 'R' : 'L');

// ── the skeleton's frame ──
// (template metres at 2 m tall, × k for the body's height and × the card's bone weights; the frame's shapes are a
// skeleton's read at play distance, not an anatomy plate)
const BONE = { femur: [0.05, 0.026, 0.044], tibia: [0.044, 0.022, 0.034], meta: [0.03, 0.018], toes: [0.024, 0.012], humerus: [0.04, 0.02, 0.032], radius: [0.032, 0.016, 0.026], hand: [0.03, 0.016], finger: [0.011, 0.009] };
export const RIBS = [{ z: 1.47, w: 0.72 }, { z: 1.415, w: 0.86 }, { z: 1.36, w: 0.93 }, { z: 1.305, w: 0.95 }, { z: 1.25, w: 0.9 }, { z: 1.2, w: 0.78 }];

/** A limb part as its bone (a shaft with knobbed ends; the foot's, the hand's and the finger's their own), or null when
 * `s` is no limb part: the skeleton's limbs, and a flesh body's part bared to the bone (./bared.js). `rMid` is
 * undefined on the parts without one (the caller drops the key). */
export function boneLimb(s, { k, g, Bw = { shaft: 1, ends: 1 } }) {
  const R = (r) => r3(r * k * g), end = (x) => R(x * Bw.ends), shaft = (x) => R(x * Bw.shaft);
  const knee = (s, [a, m, b]) => ({ ...s, rA: end(a), rB: end(b ?? a), rMid: shaft(m), mid: 0.5, over: [0.35, 0.35] });
  if (/^thigh/.test(s.name)) return knee(s, BONE.femur);
  if (/^shin/.test(s.name)) return knee(s, BONE.tibia);
  if (/^upperArm/.test(s.name)) return knee(s, BONE.humerus);
  if (/^foreArm/.test(s.name)) return knee(s, BONE.radius);
  if (/^meta/.test(s.name)) return { ...s, rA: end(BONE.meta[0]), rB: [end(BONE.meta[0] * 1.3), end(BONE.meta[1])], rMid: undefined };
  if (/^toes/.test(s.name)) return { ...s, rA: [end(BONE.toes[0] * 1.4), end(BONE.toes[1])], rB: [end(BONE.toes[0]), end(BONE.toes[1] * 0.8)], rMid: undefined };
  if (/^hand/.test(s.name)) return { ...s, rA: [end(BONE.hand[0]), end(BONE.hand[1])], rB: [end(BONE.hand[0] * 1.3), end(BONE.hand[1] * 0.8)], rMid: undefined };
  if (/^finger/.test(s.name)) return { ...s, rA: end(BONE.finger[0]), rB: end(BONE.finger[1]), rMid: undefined };
  return null;
}

// ── the spine's vertebrae ──
// each run of the column: its joints up the core, how many vertebrae, the body's [half width, half height share of
// the spacing, half depth], the spinous process's [length back, drop, radius] (template metres), the bone it rides
const COLUMN = [
  { id: 'lumbar', path: ['spine0', 'spine1'], n: 5, body: [0.026, 0.33, 0.017], process: [0.034, 0.004, 0.007], bone: (i) => (i < 2 ? 'pelvis' : 'torso'), group: 'Torso' },
  { id: 'thoracic', path: ['spine1', 'spine2', 'neckBase'], n: 12, body: [0.017, 0.32, 0.013], process: [0.04, 0.022, 0.005], bone: () => 'torso', group: 'Torso' },
  { id: 'cervical', path: ['neckBase', 'neckTop'], n: 6, body: [0.014, 0.3, 0.011], process: [0.024, 0.006, 0.005], bone: () => 'neck', group: 'Neck' },
];
/** The vertebrae along the core's joints: each a short plate (thin up the column, broad across) at its place by arc
 * length, its back drawn out to the spinous process, pointing back off the column (`frame: 'up'` keeps a level run tall).
 * The run's first starts half a step in, so the runs meet without a vertebra shared. */
export function vertebrae(J, { k, g, s = 1 }) {
  const len = (v) => Math.hypot(...v), unit = (v) => mul(v, 1 / (len(v) || 1));
  return COLUMN.flatMap(({ id, path, n, body: [w, hs, d], process: [pl, pd, pr], bone, group }) => {
    const pts = path.map((j) => J[j]), seg = pts.slice(1).map((p, i) => len(sub(p, pts[i]))), L = seg.reduce((a, b) => a + b, 0), step = L / n;
    const at = (t) => { let u = t; for (let i = 0; i < seg.length; i++) { if (u <= seg[i] || i === seg.length - 1) { const f = u / seg[i]; return { c: add(pts[i], mul(sub(pts[i + 1], pts[i]), f)), up: unit(sub(pts[i + 1], pts[i])) }; } u -= seg[i]; } };
    return Array.from({ length: n }, (_, i) => {
      const { c, up } = at((i + 0.5) * step);
      // back: −y square to the column; the body's height a share of the step, so a disc of core shows between
      const back = unit(sub([0, -1, 0], mul(up, -up[1]))), h = step * hs, W = w * k * g * s, D = d * k * s;
      const P = (v) => v.map(r3), tip = add(add(c, mul(back, D + pl * k * s)), mul(up, -pd * k));
      return { name: `${id}${i}`, kind: 'loft', frame: 'up', stations: [
        { at: P(add(c, mul(back, -D))), r: [r3(W * 0.9), r3(h)] }, { at: P(add(c, mul(back, D * 0.4))), r: [r3(W), r3(h)] },
        { at: P(add(c, mul(back, D * 1.3))), r: [r3(W * 0.55), r3(h * 0.8)] }, { at: P(tip), r: [r3(pr * k * s * 0.7), r3(pr * k * s)] },
      ], group, tint: '#cccccc', mirror: 'plane', bind: { bone: bone(i) } };
    });
  });
}

/** A COLUMN of segments laid along a limb as the spine's vertebrae are along the back (the attack skeleton's limbs):
 * `n` segments from A to B, each a short plate (thin along the limb, broad across) drawn out to a ridge in `back`'s
 * direction (a unit vector across the limb), the segment's height a share `hs` of the step so the core shows between.
 * body [half width, height share, half depth], ridge [length, drop along the limb, radius] in template metres × k × s;
 * `name` the parts' stem (`${name}${i}R`, mirrored by name), `bone` the bone they ride. */
export function limbColumn({ name, A, B, n, body: [w, hs, d], ridge: [pl, pd, pr], back, bone, group, k, s = 1 }) {
  const L = Math.hypot(...sub(B, A)), up = mul(sub(B, A), 1 / (L || 1)), step = L / n, P = (v) => v.map(r3);
  const bk = (() => { const v = sub(back, mul(up, back[0] * up[0] + back[1] * up[1] + back[2] * up[2])), m = Math.hypot(...v) || 1; return mul(v, 1 / m); })();
  return Array.from({ length: n }, (_, i) => {
    const c = add(A, mul(up, (i + 0.5) * step)), h = step * hs, W = w * k * s, D = d * k * s, tip = add(add(c, mul(bk, D + pl * k * s)), mul(up, pd * k));
    return { name: `${name}${i}R`, kind: 'loft', frame: 'up', stations: [
      { at: P(add(c, mul(bk, -D))), r: [r3(W * 0.9), r3(h)] }, { at: P(add(c, mul(bk, D * 0.4))), r: [r3(W), r3(h)] },
      { at: P(add(c, mul(bk, D * 1.3))), r: [r3(W * 0.55), r3(h * 0.8)] }, { at: P(tip), r: [r3(pr * k * s * 0.7), r3(pr * k * s)] },
    ], group, tint: '#cccccc', mirror: 'name', bind: { bone } };
  });
}

// ── the rest the body stands in ──
const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => r3(x / n)); };
const HANG = [0.2, 0.28, -0.94], OUT = [0.12, 0.99, 0.06];
const armAt = (reach, sx) => { const v = HANG.map((h, i) => h + (OUT[i] - h) * reach); return { x: r3(v[0] * sx), y: r3(v[1]), z: r3(v[2]) }; };

export function posture(card, rand) {
  const reach = card.arms?.reach ?? 0, lead = sideOf(rand);
  // (a reaching zombie leads with one arm: the other comes up only part way)
  const R = armAt(lead === 'R' ? reach : reach * 0.6, 1), L = armAt(lead === 'L' ? reach : reach * 0.6, -1);
  const h = card.head ?? { drop: 0, tilt: 0 }, tilt = h.tilt * (rand() < 0.5 ? 1 : -1);
  const head = norm([tilt * 0.35, 0.95, -h.drop * 0.9]);
  return { lean: card.lean ?? 0, crouch: card.crouch ?? 0, jaw: card.jaw ?? 0, arms: { R, L }, head: { x: head[0], y: head[1], z: head[2] } };
}
