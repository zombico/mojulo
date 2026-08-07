/**
 * figure-spine — the spinal deformation layer.
 *
 * Half B of figure-spine-articulation.plan.md. The flesh
 * (`buildProtoform`, figure-proto.js) is built in the NEUTRAL straight-spine
 * frame; this warps the upper body onto a CURVED spine so the trunk arches /
 * slumps / side-bends / twists instead of staying rigid. It is a layer over the
 * pure body stacks — the same shape as the garment layer (figure-garments.js):
 * `warpStacks(buildProtoform(...), spineDeformer(spine))`.
 *
 * Mechanism (a height-parametrized warp field):
 *   - S0 = the neutral spine centreline (base nodes + lordosis/kyphosis apices).
 *   - S1 = the bent centreline (the same nodes posed by `articulate({spine})`).
 *   - every vertex is parametrised by arc-height u along S0, expressed in S0's
 *     local frame (side/fwd/tangent), and re-placed at S1(u)'s frame.
 * Lower-body vertices sit at u≈0 (pelvis) where S1≡S0 → unchanged; the upper body
 * bends progressively. Neutral spine → S1≡S0 → identity (canonical preserved).
 */
import { articulate, basePositions } from './figure-vajra.js';

const FIGURE_SCALE = 12;   // buildProtoform world scale (STAND × 12); the warp runs in that space

const len = (a) => Math.hypot(a.x, a.y, a.z);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
function rotAxis(v, k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), kxv = cross(k, v), kv = dot(k, v);
  return { x: v.x * c + kxv.x * s + k.x * kv * (1 - c), y: v.y * c + kxv.y * s + k.y * kv * (1 - c), z: v.z * c + kxv.z * s + k.z * kv * (1 - c) };
}

// ── Control points: the four spine manji nodes + the channel apex bows
// (lordosis/kyphosis) inserted in each segment's LOCAL forward direction, so the
// natural S-bow rides the curve when it bends. Returns bottom→top control points.
const APEX = { lumbar: 0.052, thoracic: -0.034, cervical: 0.020 };   // local-fwd bow per segment (STAND)
function controlPoints(n) {
  const seg = (a, b, bow) => {
    const T = norm(sub(b, a));
    const side = norm(cross({ x: 0, y: 1, z: 0 }, T));         // lateral
    const fwd = norm(cross(T, side.x || side.y || side.z ? side : { x: 1, y: 0, z: 0 }));  // sagittal fwd ⟂ T
    return add(mul(add(a, b), 0.5), mul(fwd, bow));            // midpoint nudged along local fwd
  };
  return [
    n.pelvisHub,
    seg(n.pelvisHub, n.navel, APEX.lumbar),
    n.navel,
    seg(n.navel, n.neckHub, APEX.thoracic),
    n.neckHub,
    seg(n.neckHub, n.headTop, APEX.cervical),
    n.headTop,
  ];
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
}

// Sample a Catmull-Rom through the control points with rotation-minimizing frames
// (parallel transport), arc-length tabulated → a `frame(u)` sampler over u∈[0,1].
function buildCurve(pts, N = 16) {
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const S = [];
  for (let i = 0; i < pts.length - 1; i++) for (let s = 0; s < N; s++) S.push(catmull(P[i], P[i + 1], P[i + 2], P[i + 3], s / N));
  S.push(pts[pts.length - 1]);
  const cum = [0];
  for (let i = 1; i < S.length; i++) cum[i] = cum[i - 1] + len(sub(S[i], S[i - 1]));
  const total = cum[cum.length - 1] || 1;
  const tang = S.map((_, i) => norm(sub(S[Math.min(S.length - 1, i + 1)], S[Math.max(0, i - 1)])));
  let side = norm(cross({ x: 0, y: 1, z: 0 }, tang[0])); if (len(side) < 1e-6) side = { x: 1, y: 0, z: 0 };
  const frames = [{ side, fwd: norm(cross(tang[0], side)), T: tang[0] }];
  for (let i = 1; i < S.length; i++) {
    const T0 = tang[i - 1], T1 = tang[i], ax = cross(T0, T1), sinA = len(ax);
    let s = frames[i - 1].side;
    if (sinA > 1e-8) s = rotAxis(s, mul(ax, 1 / sinA), Math.atan2(sinA, dot(T0, T1)));
    s = norm(s);
    frames.push({ side: s, fwd: norm(cross(T1, s)), T: T1 });
  }
  const at = (u) => {
    const target = Math.max(0, Math.min(1, u)) * total;
    let i = 1; while (i < cum.length - 1 && cum[i] < target) i++;
    const f = (cum[i] - cum[i - 1]) > 1e-9 ? (target - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
    const p = add(S[i - 1], mul(sub(S[i], S[i - 1]), f));
    return { p, fr: frames[i] };
  };
  return { at, z0: pts[0].z, zTop: pts[pts.length - 1].z };
}

/**
 * Build the {S0 (neutral), S1 (bent)} spine curves for a spine drive, in
 * buildProtoform world space. spine = { sagittal, lateral, axial } (∈ [−1,1]).
 */
export function spineDeformer(spine = {}) {
  return spineDeformerFromNodes(basePositions(), articulate({ spine }));   // only the spine pass moves the nodes
}

/**
 * Build the {S0 (rest), S1 (posed)} spine curves from explicit armature node
 * sets. Use this when the posed spine comes from the full articulate + balance
 * pass (so the trunk flesh follows the same bent, balanced spine the limbs do).
 */
export function spineDeformerFromNodes(restNodes, posedNodes) {
  const scale = (n) => mul(n, FIGURE_SCALE);
  const pick = (m) => ({ pelvisHub: scale(m.pelvisHub), navel: scale(m.navel), neckHub: scale(m.neckHub), headTop: scale(m.headTop) });
  return { S0: buildCurve(controlPoints(pick(restNodes))), S1: buildCurve(controlPoints(pick(posedNodes))) };
}

// Re-place a point that sits at arc-height `u` along S0 into S1's frame at `u`:
// the rigid S0-frame→S1-frame transform about the curve point. The deformation
// vs. rigid-limb distinction below is purely which `u` each vertex uses.
function warpAtU(q, S0, S1, u) {
  const a = S0.at(u), b = S1.at(u);
  const d = sub(q, a.p);
  const off = { s: dot(d, a.fr.side), f: dot(d, a.fr.fwd), t: dot(d, a.fr.T) };
  return add(b.p, add(add(mul(b.fr.side, off.s), mul(b.fr.fwd, off.f)), mul(b.fr.T, off.t)));
}
// DEFORMATION warp: each vertex rides the spine at its OWN height → the trunk
// arches/twists smoothly along the curve. Right for trunk-surface flesh.
function warpPoint(q, S0, S1) {
  return warpAtU(q, S0, S1, (q.z - S0.z0) / (S0.zTop - S0.z0));
}

// The arm hangs off a single vertebra (the shoulder girdle, ~neckHub height); it
// is a rigid pendant, not trunk surface. The arc-height u of its anchor — so the
// whole arm shares ONE frame and rides the shoulder as a rigid limb.
const SHOULDER_ANCHOR_U = (() => {
  const b = basePositions();
  return (b.neckHub.z - b.pelvisHub.z) / (b.headTop.z - b.pelvisHub.z);
})();
// Stacks that branch off the shoulder girdle: carry them rigidly at the shoulder
// frame instead of warping per-height (which would shear the limb off the body).
export const RIGID_ARM_STACKS = ['deltoidL', 'deltoidR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'elbowCapL', 'elbowCapR', 'handL', 'handR'];
export function spineArmAnchors() {
  const m = {};
  for (const id of RIGID_ARM_STACKS) m[id] = SHOULDER_ANCHOR_U;
  return m;
}

/**
 * Warp body/garment ring-stacks from the straight rest spine (S0) onto the posed
 * spine (S1). Three behaviours, by stack id:
 *
 *   - DEFORM (default): each vertex rides the spine at its own arc-height u → the
 *     trunk surface arches/twists/side-bends smoothly along the curve.
 *   - RIGID (`anchors[id] = u`): the whole stack shares ONE frame at arc-height u →
 *     the arms ride the shoulder girdle as a rigid limb instead of shearing off
 *     (figure-spine-articulation.plan.md, half B follow-ups).
 *   - PASS-THROUGH (`skip.has(id)`): returned unchanged → the grounded legs/feet,
 *     built already in their final balanced/IK-solved place, are not re-warped.
 *
 * Identity when S1≡S0 (neutral rest). Each ring's center is warped too so the
 * renderer's inside-point/back-face logic stays correct.
 * @param {Array<{id,rings,hex?}>} stacks  buildProtoform / buildGarment output
 * @param {{anchors?: Object<string,number>, skip?: Set<string>}} [opts]
 */
export function warpStacks(stacks, { S0, S1 }, { anchors = null, skip = null } = {}) {
  return stacks.map((st) => {
    if (skip && skip.has(st.id)) return st;
    const au = anchors ? anchors[st.id] : undefined;
    const warp = au == null ? (q) => warpPoint(q, S0, S1) : (q) => warpAtU(q, S0, S1, au);
    return {
      ...st,
      rings: st.rings.map((rg) => ({ center: warp(rg.center), polyline: rg.polyline.map(warp) })),
    };
  });
}
