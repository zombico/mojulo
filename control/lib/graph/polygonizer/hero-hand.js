/**
 * hero-hand — the structured hero's HAND: a palm and five digits in place of the mitten, and the rig that bends them.
 *
 *   • the palm is a `rings` part named `hand<S>` (the part the gear, the clearance and the dress already read), eight
 *     points a ring: the back (dorsal) flat across, the front (palmar) with the thumb's pad (thenar) and the little
 *     finger's (hypothenar) either side of a hollow, its last ring on the knuckle arc (highest at the middle finger).
 *   • each digit is a `rings` part (`thumb`, `index`, `middle`, `ring`, `little`), six points a ring: a ring inside the
 *     palm, one at each joint, one at the pad, a cap at the tip. Lengths are the measured phalanx ratios (proximal :
 *     middle : distal ≈ 1 : 0.6 : 0.45), the middle finger about the palm's length, the knuckles on an arc, the fingers
 *     fanned a little; the thumb leaves the palm low on the radial side, angled out and turned to face the fingers.
 *   • the REST hand is relaxed: each digit curled by its rest curl (deepening toward the little finger, the cascade), so a
 *     stand that names no fingers reads natural and the rest pose stays the identity. The curl is the rig's own rule
 *     (CURL_LINKS: the knuckle, the middle joint and the last joint at ⅔ of the middle's), applied here to the joints and
 *     the rings alike, a joint's ring turned by half its joint's angle (the bisector), as the skin bends it.
 *   • the hand hangs facing the thigh: palm medial, thumb forward (the across axis is the forearm's forward
 *     perpendicular, as figure-proto.js builds its hand).
 *   • the rig: a joint per knuckle, middle joint, last joint and tip (the thumb from its carpometacarpal), hinge joints
 *     on the hinge axes (a bone's `aux`, so its frame keeps its roll exactly: one for the four fingers, which bend about
 *     one axis across the palm, two for the thumb, its root's and its knuckle's), fifteen bones a hand named
 *     for the VRM / Godot humanoid set (`thumb1-3`, `index1-3`, …), and the rig's `hands` block: the wrist's axes
 *     (flex: + extension; deviation: + radial; twist: + pronation), each digit's hinge axis (+ closing) and links, and
 *     the hand words (HAND_POSES).
 *
 * Every length is metres at `extremities` 1 (the anime casts' smaller hands scale it), every width also by the girth.
 * The streamlined core keeps its mitten (hero-form.js). Pure and deterministic.
 */
import { r6 } from './station-loft-plan.js';
import { HAND_POSES } from './station-loft-rig.js';
import * as dmath from '../../util/dmath.js';

const add = (a, b) => a.map((x, i) => x + b[i]); const sub = (a, b) => a.map((x, i) => x - b[i]); const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => mul(v, 1 / dmath.hypot(...v));
const R = (v) => v.map(r6);
const mirrorX = (v) => [-v[0] + 0, v[1], v[2]];
/** p turned about the line through `pivot` along unit `k` by `deg` (the rig's own rotation, station-loft-rig.js) */
const rotLine = (p, pivot, k, deg) => { const a = deg * Math.PI / 180, c = dmath.cos(a), s = dmath.sin(a); const v = sub(p, pivot), kv = cross(k, v), d = dot(k, v); return add(pivot, add(add(mul(v, c), mul(kv, s)), mul(k, d * (1 - c)))); };
/** the axis that turns `dir` toward `toward` for a positive angle */
const axisToward = (dir, toward) => unit(cross(dir, sub(toward, mul(dir, dot(toward, dir)))));

export const DIGITS = ['thumb', 'index', 'middle', 'ring', 'little'];
/** each link's share of a digit's curl: the knuckle, the middle joint, the last joint at ⅔ of the middle's (Rijpkema &
 * Girard's coupling); the thumb's carpometacarpal turns least */
export const CURL_LINKS = Object.freeze({ finger: Object.freeze([0.95, 1.1, 0.73]), thumb: Object.freeze([0.7, 0.8, 0.8]) });

/**
 * THE HAND'S FORM per body, in the hand's own frame (u along the hand from the wrist, v across toward the thumb, w out
 * of the palm), metres at `extremities` 1:
 *   palm      its rings: u (a share of the palm's length, the wrist to the middle knuckle), the half width, the back's and
 *             the front's half depths; `thenar` / `hypothenar` push the front's radial / ulnar points out of the palm (m);
 *             the last ring on the knuckle arc, its ulnar end `arc[0]` and its radial end `arc[1]` short of the middle (m)
 *   fingers   per digit: the knuckle's u (a share of the palm), its v (m), the fan (deg, + toward the thumb), the three
 *             phalanges (m), the radii at the knuckle, the middle joint, the last joint and the pad (m; the depth `deep`
 *             of the width), and the rest curl (deg, the cascade)
 *   thumb     the carpometacarpal's u (share), v, w (m); the metacarpal's direction (u, v, w); the three bones (m); the
 *             radii at its root, the knuckle, the last joint and the pad; the rest curl; `flexTo`: the direction its
 *             joints close it toward (u, v, w); `oppose`: the axis its root turns about to sweep it across the palm
 * The female's palm is narrower for its length and her fingers taper more; the length is the cast's (`extremities`).
 */
export const HAND_FORM = Object.freeze({
  male: Object.freeze({
    palm: Object.freeze({ rings: [[-0.08, 0.026, 0.017, 0.017], [0.18, 0.031, 0.015, 0.017], [0.55, 0.037, 0.012, 0.012], [0.93, 0.04, 0.011, 0.011]], thenar: [0.004, 0.008], hypothenar: 0.005, arc: [0.012, 0.005], tip: 0.06 }),
    fingers: Object.freeze({
      index: { u: 0.97, v: 0.027, fan: 1, len: [0.032, 0.02, 0.016], r: [0.0106, 0.0095, 0.0081, 0.0079], rest: 10 },
      middle: { u: 1, v: 0.009, fan: 0, len: [0.038, 0.024, 0.018], r: [0.011, 0.0099, 0.0084, 0.0081], rest: 15 },
      ring: { u: 0.97, v: -0.009, fan: -1, len: [0.034, 0.022, 0.017], r: [0.0103, 0.0092, 0.0078, 0.0076], rest: 21 },
      little: { u: 0.89, v: -0.026, fan: -3, len: [0.026, 0.016, 0.014], r: [0.009, 0.008, 0.0069, 0.0068], rest: 28 },
    }),
    deep: 0.86,
    thumb: Object.freeze({ u: 0.2, v: 0.019, w: 0.011, dir: [0.9, 0.36, 0.2], len: [0.045, 0.032, 0.027], r: [0.014, 0.0123, 0.011, 0.0108], rest: 8, flexTo: [0.15, -0.95, 0.25], oppose: [-0.1, -0.1, -0.99] }),
  }),
  female: Object.freeze({
    palm: Object.freeze({ rings: [[-0.08, 0.023, 0.015, 0.015], [0.18, 0.027, 0.013, 0.015], [0.55, 0.033, 0.0105, 0.0105], [0.93, 0.036, 0.0095, 0.0095]], thenar: [0.0035, 0.007], hypothenar: 0.0045, arc: [0.012, 0.005], tip: 0.06 }),
    fingers: Object.freeze({
      index: { u: 0.97, v: 0.024, fan: 1, len: [0.032, 0.02, 0.016], r: [0.0094, 0.0083, 0.0068, 0.0064], rest: 10 },
      middle: { u: 1, v: 0.008, fan: 0, len: [0.038, 0.024, 0.018], r: [0.0097, 0.0086, 0.0072, 0.0067], rest: 15 },
      ring: { u: 0.97, v: -0.008, fan: -1, len: [0.034, 0.022, 0.017], r: [0.0091, 0.008, 0.0066, 0.0062], rest: 21 },
      little: { u: 0.89, v: -0.023, fan: -3, len: [0.026, 0.016, 0.014], r: [0.0078, 0.0069, 0.0059, 0.0055], rest: 28 },
    }),
    deep: 0.84,
    thumb: Object.freeze({ u: 0.2, v: 0.017, w: 0.01, dir: [0.9, 0.36, 0.2], len: [0.043, 0.031, 0.026], r: [0.0123, 0.0108, 0.0094, 0.0091], rest: 8, flexTo: [0.15, -0.95, 0.25], oppose: [-0.1, -0.1, -0.99] }),
  }),
});

/** each digit ring's share of its three links (the knuckle's, the middle joint's, the last joint's bone), as the binds
 * weigh it: the ring in the palm the hand's, a joint's ring half and half */
const FINGER_SHARE = [[0, 0, 0], [0.5, 0, 0], [1, 0.5, 0], [1, 1, 0.5], [1, 1, 1]];
const THUMB_SHARE = [[0, 0, 0], [0.4, 0, 0], [1, 0.5, 0], [1, 1, 0.5], [1, 1, 1]];

/** The hand words (`fingers<S>`): the rig's own (station-loft-rig.js HAND_POSES), tuned on this hand */
export { HAND_POSES };

/**
 * The right hand of the structured hero: `wrist`, `elbow` (rest, m), `len` the palm's length (the wrist to the middle
 * knuckle: the hand bone's tail, `knuckles`), `X` the cast's extremities, `girth` the plan's radial scale, `female`.
 * Returns { segments, joints, bones, hands, wrist }: the six rings parts (mirrored by name), the rig joints and bones
 * (`$S`), the rig's `hands` block for both sides, and the hand's section at the wrist (the forearm's last ring).
 */
export function heroHand({ wrist, elbow, len, X = 1, girth = 1, female = false }) {
  const F = HAND_FORM[female ? 'female' : 'male'];
  const A = unit(sub(wrist, elbow)), V = unit(sub([0, 1, 0], mul(A, A[1]))), N = unit(cross(V, A));   // along, across (toward the thumb), out of the palm
  const at = (u, v, w) => add(wrist, add(add(mul(A, u), mul(V, v)), mul(N, w)));
  const dirOf = (u, v, w) => unit(add(add(mul(A, u), mul(V, v)), mul(N, w)));
  const x = X, gx = X * girth;
  // a ring of `n` points round `c` across `d`: `f` its first point's direction (the back of the hand), the half width
  // `hw` toward cross(f, d) (the thumb's side), the back's and the front's half depths; slot order is the family's
  const ringAt = (c, d, f, hw, hb, hf, slots, e = 2.4, push = {}) => {
    const s = cross(f, d), n = slots.length, pw = (t) => Math.sign(t) * dmath.pow(Math.abs(t), 2 / e);
    return Object.fromEntries(slots.map((sl, k) => { const t = 2 * Math.PI * k / n, ct = dmath.cos(t), st = dmath.sin(t); const p = add(c, add(mul(f, (ct >= 0 ? hb : hf) * pw(ct)), mul(s, hw * pw(st)))); return [sl, R(push[sl] ? add(p, push[sl]) : p)]; }));
  };

  // ── the palm: the back of the hand is −N; its rings' radial side (cross(−N, A) = V) carries the R slots ──
  const P = F.palm, back = mul(N, -1);
  const ring8 = ['front', 'frontR', 'sideR', 'backR', 'back', 'backL', 'sideL', 'frontL'];
  const palmStations = P.rings.map(([u, hw, hb, hf], i) => {
    const last = i === P.rings.length - 1;
    const push = {
      ...(i === 1 || i === 2 ? { backR: mul(N, P.thenar[i - 1] * gx), backL: mul(N, (i === 1 ? P.hypothenar : P.hypothenar * 0.6) * gx) } : {}),
    };
    // the wrist's two rings round (e 2: the forearm's oval runs on into them), the palm's flatter across (e 2.6)
    const pts = ringAt(at(u * len, 0, 0), A, back, hw * gx, hb * gx, hf * gx, ring8, i < 2 ? 2 : 2.6, push);
    // the knuckle arc: the last ring's ends fall short of the middle knuckle, the little finger's more
    if (last) for (const sl of ring8) { const v = dot(sub(pts[sl], wrist), V), side = v < 0 ? P.arc[0] * x * Math.min(1, -v / (hw * gx)) : P.arc[1] * x * Math.min(1, v / (hw * gx)); pts[sl] = R(sub(pts[sl], mul(A, side))); }
    return { id: `st${i}`, points: pts };
  });
  const palm = { name: 'handR', kind: 'rings', slots: 'ring8', stations: palmStations, caps: { back: R(at(-0.2 * len, 0, 0)), tip: R(at((1 + P.tip) * len - 0.004 * x, 0, -0.002 * x)) }, group: 'Skin', mirror: 'name',
    bind: { bone: 'handR', blend: { back: { foreArmR: 1 }, st0: { foreArmR: 0.5, handR: 0.5 } } } };

  // ── the digits: straight in the hand's frame, then curled by the rest curl as the rig curls them ──
  const limb6 = ['front', 'frontR', 'backR', 'back', 'backL', 'frontL'];
  const segments = [palm], joints = {}, bones = [], digits = {};
  const J = (name, p) => { joints[`${name}$S`] = { at: R(p), rides: 'foreArm$S' }; };
  // the four fingers bend about one axis, across the palm (their fan is a few degrees): one hinge joint serves them all
  const fingerAxis = axisToward(A, N);
  J('fingerAxis', add(at(len, 0, 0), mul(fingerAxis, 0.01 * x)));
  for (const d of DIGITS) {
    const thumb = d === 'thumb', G = thumb ? F.thumb : F.fingers[d];
    let base, dir, flexTo;
    if (thumb) { base = at(G.u * len, G.v * gx, G.w * gx); dir = dirOf(...G.dir); flexTo = dirOf(...G.flexTo); }
    else { const fan = G.fan * Math.PI / 180; base = at(G.u * len, G.v * gx, 0); dir = unit(add(mul(A, dmath.cos(fan)), mul(V, dmath.sin(fan)))); flexTo = N; }
    // each link's hinge: a finger's three about one axis (its tip toward the palm); the thumb's root sweeps it across the
    // palm (opposition, about `oppose`), its two joints flex it about its own axis
    const axis = thumb ? axisToward(dir, flexTo) : fingerAxis;
    let ax = [axis, axis, axis];
    if (thumb) { let k1 = dirOf(...G.oppose); const tipAt = add(base, mul(dir, 0.1)); if (dot(cross(k1, sub(tipAt, base)), V) > 0) k1 = mul(k1, -1); ax = [k1, axis, axis]; }
    // the digit's back: the hand's back for a finger; for the thumb, its nail side (turned toward the fingers)
    const f0 = unit(thumb ? sub(V, mul(dir, dot(V, dir))) : sub(back, mul(dir, dot(back, dir))));
    const L = G.len.map((l) => l * x), r = G.r.map((q) => q * gx), deep = F.deep;
    // joints along the straight digit: the root (a knuckle, or the thumb's carpometacarpal), two joints, the tip
    const js = [base, add(base, mul(dir, L[0])), add(base, mul(dir, L[0] + L[1])), add(base, mul(dir, L[0] + L[1] + L[2]))];
    // rings: inside the palm, at the root, the two joints, the pad; the tip cap beyond the pad
    const pad = add(js[2], mul(dir, 0.72 * L[2]));   // near the tip, so the tip is round, not a point
    const st = [
      { c: add(base, mul(dir, -(thumb ? 0.012 : 0.014) * x)), r: r[0] * (thumb ? 1.1 : 1.04) },
      { c: thumb ? add(base, mul(dir, 0.45 * L[0])) : js[0], r: r[0] },
      { c: js[1], r: r[1] }, { c: js[2], r: r[2] }, { c: pad, r: r[3] },
    ];
    const names = thumb ? ['thumbCmc', 'thumbMcp', 'thumbIp', 'thumbTip'] : [`${d}Mcp`, `${d}Pip`, `${d}Dip`, `${d}Tip`];
    // the rest curl, link by link: a point past a link's pivot turns by the whole angle, a ring by its skin's share of
    // the link's bone (SHARE: the binds below), so a joint's ring stands on the bisector
    const W = thumb ? CURL_LINKS.thumb : CURL_LINKS.finger, SHARE = thumb ? THUMB_SHARE : FINGER_SHARE;
    let jp = js.map((p) => [...p]), rings = st.map((s) => ({ ...s, pts: ringAt(s.c, dir, f0, s.r, s.r * deep, s.r * deep, limb6, 2) })), tipCap = add(js[3], mul(f0, -0.15 * r[3]));
    // the hinge joints (a bone's aux, on the axis its own link turns about): the root's, and the thumb's knuckle's
    const hinge = add(js[0], mul(ax[0], 0.01 * x)); let knuckle = thumb ? add(js[1], mul(ax[1], 0.01 * x)) : null;
    for (let k = 0; k < 3; k++) {
      const a = G.rest * W[k], p = [...jp[k]];
      jp = jp.map((q, i) => (i > k ? rotLine(q, p, ax[k], a) : q));
      tipCap = rotLine(tipCap, p, ax[k], a);
      if (knuckle && k === 0) knuckle = rotLine(knuckle, p, ax[k], a);
      for (let n = k + 1; n < 3; n++) if (ax[n] !== ax[k]) ax[n] = rotLine(ax[n], [0, 0, 0], ax[k], a);   // the later hinges ride this turn
      rings = rings.map((g, i) => { const share = SHARE[i][k]; if (!share) return g; return { ...g, pts: Object.fromEntries(Object.entries(g.pts).map(([sl, q]) => [sl, R(rotLine(q, p, ax[k], a * share))])) }; });
    }
    names.forEach((n, i) => J(n, jp[i]));
    if (thumb) J('thumbAxis', hinge);
    if (knuckle) J('thumbHinge', knuckle);
    const bn = (i) => `${d}${i}R`;
    const blend = thumb
      ? { back: { handR: 1 }, st0: { handR: 1 }, st1: { handR: 0.6, [bn(1)]: 0.4 }, st2: { [bn(1)]: 0.5, [bn(2)]: 0.5 }, st3: { [bn(2)]: 0.5, [bn(3)]: 0.5 }, st4: { [bn(3)]: 1 }, tip: { [bn(3)]: 1 } }
      : { back: { handR: 1 }, st0: { handR: 1 }, st1: { handR: 0.5, [bn(1)]: 0.5 }, st2: { [bn(1)]: 0.5, [bn(2)]: 0.5 }, st3: { [bn(2)]: 0.5, [bn(3)]: 0.5 }, st4: { [bn(3)]: 1 }, tip: { [bn(3)]: 1 } };
    segments.push({ name: `${d}R`, kind: 'rings', slots: 'limb6', stations: rings.map((g, i) => ({ id: `st${i}`, points: g.pts })), caps: { back: R(add(st[0].c, mul(dir, -0.4 * r[0]))), tip: R(tipCap) }, group: 'Skin', mirror: 'name', bind: { bone: bn(1), blend } });
    for (let i = 0; i < 3; i++) bones.push({ id: `${d}${i + 1}$S`, head: `${names[i]}$S`, tail: `${names[i + 1]}$S`, aux: thumb ? (i ? ['thumbMcp$S', 'thumbHinge$S'] : ['thumbCmc$S', 'thumbAxis$S']) : ['knuckles$S', 'fingerAxis$S'] });
    digits[d] = { axis, tip: names[3], links: [0, 1, 2].map((k) => ({ pivot: names[k], ...(thumb && k === 0 ? { joints: [...names.slice(1), 'thumbHinge'] } : {}), weight: W[k], ...(ax[k] !== axis ? { axis: R(ax[k]) } : {}) })) };
  }
  // the hand's joints (every one rides the forearm, turned by the hand words first), its axes, both sides
  const axes = { flex: axisToward(A, back), deviation: axisToward(A, V), twist: unit(cross(V, N)) };
  const side = (S) => {
    const ax = (k) => R(S === 'R' ? k : mul(mirrorX(k), -1));   // a mirrored rotation turns the other way: the axis flips too
    // the hand's joints are the forearm's riders, the hand words the rig's own (HAND_POSES): neither is stored
    return { carrier: `foreArm${S}`, wrist: `wrist${S}`, axes: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, ax(v)])),
      digits: Object.fromEntries(Object.entries(digits).map(([d, g]) => [d, { axis: ax(g.axis), tip: `${g.tip}${S}`, links: g.links.map((l) => ({ pivot: `${l.pivot}${S}`, ...(l.joints ? { joints: l.joints.map((j) => `${j}${S}`) } : {}), weight: l.weight, ...(l.axis ? { axis: ax(l.axis) } : {}) })) }])) };
  };
  // the hand's section at the wrist joint (its first two rings met there): the forearm's last ring takes it, [through the
  // hand, across it] in a limb ring's [R side, front] (at rest the hand's across is the front), so the forearm tapers into
  // the hand with no step
  const [r0, r1] = P.rings, t = -r0[0] / (r1[0] - r0[0]), mix = (k) => r0[k] + (r1[k] - r0[k]) * t;
  const section = [r6(((mix(2) + mix(3)) / 2) * gx), r6(mix(1) * gx)];
  return { segments, joints, bones, hands: { R: side('R'), L: side('L') }, wrist: section };
}
