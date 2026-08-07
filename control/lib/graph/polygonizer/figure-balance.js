/**
 * figure-balance — the ground + balance constraint layer.
 *
 * `articulate()` is pure forward kinematics: it sets joint angles but knows
 * nothing about the floor or balance, so any pose that moves the centre of mass
 * (a tilt, a reach, a bend) just leans the rigid form and the feet float. This
 * pass locks the figure to the ground:
 *
 *   1. the support feet stay PLANTED (their ankles are fixed),
 *   2. the centre of mass is kept over the BASE OF SUPPORT (the footprint), by
 *      counter-shifting the pelvis + upper body and re-solving each support leg
 *      with 2-bone (hip→knee→ankle) IK so the feet don't move.
 *
 * The result is automatic counterpoise — tilt the torso and the hips shift the
 * other way to stay balanced — instead of a topple. It is a layer over the
 * armature (same shape as the spine deformer / garment layers): pose with FK,
 * then `groundBalance(articulate(dof))`.
 *
 * Balance is measured RELATIVE to the rest figure's COM offset, so the neutral
 * pose is reproduced exactly (no drift); only deviations are corrected.
 */
import { basePositions } from './figure-vajra.js';

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const dist = (a, b) => len(sub(a, b));
const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

// Rough segment mass fractions (biomechanical) — the mass rides each segment's
// midpoint. Trunk + head dominate; limbs taper. Used only for the COM estimate.
const MASS = [
  ['pelvisHub', 'neckHub', 0.46], ['neckHub', 'headTop', 0.08],
  ['hipL', 'kneeL', 0.10], ['hipR', 'kneeR', 0.10],
  ['kneeL', 'ankleL', 0.045], ['kneeR', 'ankleR', 0.045],
  ['shoulderL', 'elbowL', 0.027], ['shoulderR', 'elbowR', 0.027],
  ['elbowL', 'wristL', 0.022], ['elbowR', 'wristR', 0.022],
];
function comOf(p) {
  let x = 0, y = 0, M = 0;
  for (const [a, b, m] of MASS) { x += (p[a].x + p[b].x) / 2 * m; y += (p[a].y + p[b].y) / 2 * m; M += m; }
  return { x: x / M, y: y / M };
}
const footCentre = (p, feet) => {
  let x = 0, y = 0;
  for (const s of feet) { x += p['ankle' + s].x; y += p['ankle' + s].y; }
  return { x: x / feet.length, y: y / feet.length };
};

// 2-bone IK: given hip H and a FIXED ankle A, place the knee so |H→knee|=L1 and
// |knee→ankle|=L2, bending toward `pole` (the knee points that way). Law of cosines.
function ik2(H, A, L1, L2, pole) {
  const HA = sub(A, H), D = len(HA);
  const dir = D > 1e-9 ? mul(HA, 1 / D) : { x: 0, y: 0, z: -1 };
  const d = Math.min(D, (L1 + L2) * 0.999);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let pd = sub(pole, mul(dir, dot(pole, dir)));           // pole projected ⟂ to the leg axis
  pd = len(pd) > 1e-6 ? norm(pd) : { x: 0, y: 1, z: 0 };
  return add(add(H, mul(dir, a)), mul(pd, h));            // knee = along axis + perpendicular bend
}

const MOVE = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR'];
const KNEE_POLE = { x: 0, y: 1, z: 0 };   // knees point forward (+y)

/**
 * Ground + balance a posed armature. The planted `feet` stay locked; the pelvis +
 * upper body counter-shift and the support legs re-solve (2-bone IK) so the centre
 * of mass sits over the support — its FOOTPRINT, or, with `weight`, biased toward
 * one foot for a committed weighted stance / contrapposto.
 *
 * The rest balance is referenced to the NEUTRAL two-foot stance (not to whatever
 * `feet`/`weight` are chosen), so: neutral two-foot is preserved exactly, AND
 * committing to one foot (single `feet`, or `weight = ±1`) actually slides the COM
 * over that foot instead of cancelling out.
 *
 * @param {object} p0  articulate() output (the fully posed armature, incl. spine)
 * @param {{feet?: string[], weight?: number, crouch?: number, kneeOut?: number, gain?: number, iters?: number}} opts
 *   feet    — which ankles are planted (default both). One foot → a true one-leg stand.
 *   weight  — −1 = over the left foot, +1 = over the right, 0 = centred (neutral).
 *   crouch  — 0 = stand … 1 = deep squat: drop the pelvis + upper body while the feet
 *             stay planted; the knees fold via IK (a squat the fixed-hip dof can't do).
 *   kneeOut — knee tracking in the squat: + = knees splay outward (Russian/deep), −
 *             = knees drawn together, 0 = forward.
 */
export function groundBalance(p0, { feet = ['L', 'R'], weight = 0, crouch = 0, kneeOut = 0, gain = 1, iters = 6 } = {}) {
  const p = {};
  for (const k in p0) p[k] = { ...p0[k] };
  const w = Math.max(-1, Math.min(1, weight));
  const MAX_DROP = 0.30;   // deepest pelvis drop (STAND units) at crouch = 1
  // rest COM offset, always vs the neutral TWO-foot stance (see note above).
  const base = basePositions();
  const restOff = sub2(comOf(base), footCentre(base, ['L', 'R']));
  // bone lengths + planted ankles
  const Llen = {};
  for (const s of ['L', 'R']) { Llen['t' + s] = dist(base['hip' + s], base['knee' + s]); Llen['s' + s] = dist(base['knee' + s], base['ankle' + s]); }
  // Squat: drop the pelvis + upper body straight down; the feet stay planted, so
  // the knees fold via the IK below. (Done before planting so the ankles lock at
  // the floor, not the dropped height.)
  if (crouch) for (const k of MOVE) p[k].z -= Math.max(0, Math.min(1, crouch)) * MAX_DROP;
  const planted = {};
  for (const s of feet) planted[s] = { ...p['ankle' + s] };
  // knee tracking direction for the IK bend: forward, splayed out, or drawn in.
  const kneePole = (s) => (kneeOut ? { x: kneeOut * (s === 'L' ? -1 : 1), y: 1, z: 0 } : KNEE_POLE);
  // A non-support (free) leg is a RIGID pendant off the pelvis: when the body
  // counter-shifts it must carry its whole leg (knee + ankle) with the hip, or the
  // thigh shears between a moved hip and a stationary knee. Only SUPPORT legs are
  // re-solved by IK (planted foot). [no-warp invariant: structured poses move limbs
  // rigidly — the solver never stretches flesh.]
  const freeLegParts = [];
  for (const s of ['L', 'R']) if (!feet.includes(s)) freeLegParts.push('knee' + s, 'ankle' + s);
  for (let it = 0; it < iters; it++) {
    const c = comOf(p), fc = footCentre(p, feet);
    // target = support centre, slid toward the weighted foot by `w` along the stance line.
    const half = { x: (p.ankleR.x - p.ankleL.x) / 2, y: (p.ankleR.y - p.ankleL.y) / 2 };
    const tx = fc.x + w * half.x, ty = fc.y + w * half.y;
    const ex = (c.x - tx) - restOff.x, ey = (c.y - ty) - restOff.y;       // deviation from the desired balance
    if (Math.hypot(ex, ey) < 1e-4) break;
    for (const k of MOVE) { p[k].x -= ex * gain; p[k].y -= ey * gain; }   // counter-shift the body over the target
    for (const k of freeLegParts) { p[k].x -= ex * gain; p[k].y -= ey * gain; }   // free leg rides the pelvis rigidly
    for (const s of feet) p['knee' + s] = ik2(p['hip' + s], planted[s], Llen['t' + s], Llen['s' + s], kneePole(s));
    for (const s of feet) p['ankle' + s] = { ...planted[s] };             // feet stay locked
  }
  return p;
}
function sub2(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Ground VAULT — the inverted-pendulum complement to groundBalance. Where groundBalance
 * keeps a (fixed-height) figure balanced over locked feet, groundVault DERIVES the pelvis
 * HEIGHT from the planted feet: each planted foot is pinned to the ground PLANE (its FK
 * fore/aft x,y, z = floor) and the pelvis lowers just enough that the support leg reaches
 * it — so the body vaults over the planted foot (highest at mid-stance when the leg is
 * vertical, lowest when it is fore/aft). This is what `articulate` (hip pinned at rest
 * height) and groundBalance (foot locked at the floating FK height) could not do: a foot
 * that truly stays on the floor while the trunk rises and falls over it.
 *
 * `plant[L|R]` ∈ [0,1] is each foot's plantedness — 1 = pinned to the floor (stance),
 * 0 = free (swing: the leg rides the pelvis and lifts via its own FK knee). Continuous, so
 * a gait crossing through double support never snaps. Neutral stance (plant 1/1, feet under
 * the hips) is reproduced exactly.
 *
 * The vault is a full inverted pendulum, in BOTH planes — not just the sagittal height:
 *   - SAGITTAL/vertical: the pelvis drops so the (near-straight) support leg reaches its
 *     floored foot (highest at mid-stance, lowest at the fore/aft extremes).
 *   - FRONTAL/lateral + fore-aft: the body's MASS is carried over the planted support. The
 *     support base is the planted feet weighted by plantedness, so in single support it
 *     collapses onto the one stance foot and the pelvis travels over it — the real
 *     mechanical weight-shift. This is what makes a walk "hit the floor": the side-to-side
 *     comes from the COM genuinely moving over each foot in turn, NOT from a spine-sway
 *     dial faking it (`carry` = 0 restores the old sagittal-only vault). Referenced to the
 *     neutral two-foot COM so the rest stance is still reproduced exactly.
 *
 * @param {object} p0  articulate() output
 * @param {{plant?: {L:number,R:number}, gain?: number, carry?: number, iters?: number}} opts
 *   carry — 0..1, how fully the COM commits over the planted support (1 = full pendulum).
 */
export function groundVault(p0, { plant = { L: 1, R: 1 }, gain = 1, carry = 1, iters = 6 } = {}) {
  const p = {}; for (const k in p0) p[k] = { ...p0[k] };
  const base = basePositions();
  const GROUND = base.ankleL.z;                 // rest floor level (armature ankle)
  const restPelvisZ = base.pelvisHub.z;
  const L1 = {}, L2 = {};
  for (const s of ['L', 'R']) { L1[s] = dist(base['hip' + s], base['knee' + s]); L2[s] = dist(base['knee' + s], base['ankle' + s]); }
  const fkAnkle = { L: { ...p.ankleL }, R: { ...p.ankleR } };
  const fkKnee = { L: { ...p.kneeL }, R: { ...p.kneeR } };
  const wOf = (s) => Math.max(0, Math.min(1, plant[s]));
  const wL = wOf('L'), wR = wOf('R'), wSum = wL + wR;
  // COM carry is measured against the NEUTRAL two-foot stance, so plant 1/1 holds the rest
  // pose exactly and only a committed (single-ish) support actually slides the body. The
  // reference is the neutral base run through the SAME planted-leg IK (both feet floored),
  // so ik2's extension-safety clamp settles identically on both sides and doesn't read as a
  // phantom COM shift the carry would then chase — neutral stays exact.
  const settled = {}; for (const k in base) settled[k] = { ...base[k] };
  for (const s of ['L', 'R']) settled['knee' + s] = ik2(base['hip' + s], { x: base['ankle' + s].x, y: base['ankle' + s].y, z: GROUND }, L1[s], L2[s], { x: 0, y: 1, z: 0 });
  const restOff = sub2(comOf(settled), footCentre(base, ['L', 'R']));
  const fk0 = {}; for (const k of MOVE) fk0[k] = { ...p[k] };   // FK anchor for the body nodes
  const sh = { x: 0, y: 0 };                    // accumulated horizontal COM carry
  let drop = 0;
  for (let it = 0; it < iters; it++) {
    // 1) Carry the COM over the plantedness-weighted support foot/feet (horizontal plane).
    const sx = wSum > 1e-6 ? (wL * fkAnkle.L.x + wR * fkAnkle.R.x) / wSum : (fkAnkle.L.x + fkAnkle.R.x) / 2;
    const sy = wSum > 1e-6 ? (wL * fkAnkle.L.y + wR * fkAnkle.R.y) / wSum : (fkAnkle.L.y + fkAnkle.R.y) / 2;
    const c = comOf(p);
    sh.x -= ((c.x - sx) - restOff.x) * carry * gain;
    sh.y -= ((c.y - sy) - restOff.y) * carry * gain;
    // 2) Vault drop: each planted leg just reaches its floored foot, measured from the
    //    CARRIED hip (the lateral/fore-aft shift changes how far the foot is from the hip).
    drop = 0;
    for (const s of ['L', 'R']) {
      const w = wOf(s); if (w <= 0) continue;
      const hx = fk0['hip' + s].x + sh.x, hy = fk0['hip' + s].y + sh.y, legLen = L1[s] + L2[s];
      const horiz = Math.hypot(hx - fkAnkle[s].x, hy - fkAnkle[s].y);
      const reach = Math.sqrt(Math.max(0, legLen * legLen - horiz * horiz));
      drop = Math.max(drop, w * Math.max(0, restPelvisZ - (GROUND + reach)));
    }
    drop *= gain;
    // 3) Place the body (pelvis + upper + hips) at the carried + dropped position…
    for (const k of MOVE) { p[k].x = fk0[k].x + sh.x; p[k].y = fk0[k].y + sh.y; p[k].z = fk0[k].z - drop; }
    // …and solve each leg: planted → foot pinned to the floor; swing → rides the carried,
    // dropped body (its FK lift preserved). Knee re-solved by 2-bone IK so bones stay exact.
    for (const s of ['L', 'R']) {
      const w = wOf(s);
      const grounded = { x: fkAnkle[s].x, y: fkAnkle[s].y, z: GROUND };
      const ridden = { x: fkAnkle[s].x + sh.x, y: fkAnkle[s].y + sh.y, z: fkAnkle[s].z - drop };
      const target = { x: lerp(ridden.x, grounded.x, w), y: lerp(ridden.y, grounded.y, w), z: lerp(ridden.z, grounded.z, w) };
      const pole = { x: fkKnee[s].x - fkAnkle[s].x, y: 1, z: 0 };   // keep the knee tracking its FK side
      p['knee' + s] = ik2(p['hip' + s], target, L1[s], L2[s], pole);
      p['ankle' + s] = target;
    }
  }
  return p;
}
