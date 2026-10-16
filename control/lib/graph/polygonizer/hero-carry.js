// hero-carry — CARRYING THINGS: a firearm, an object or a sword held by the hero, in a mode (relax, aim), the thing
// placed first by what it is for and the body solved to serve it (hero-grip's way), and the EFFORT the hold costs read
// off the body, which the body then answers.
//
//   • THE THING (CARRIED): proxy geometry in its own frame (centimetres; +z its long or forward axis, +y up, +x then the
//     thing's left), its mass (a word: a box is light or heavy by the same hold), its centre of mass, and its STATIONS:
//     where a hand closes ({ at, c, a }: the fist's centre, the line through the fist out of its index side, the hand's
//     long axis, wrist to knuckles), where it rests on the body (a butt in the shoulder pocket, a sack or a barrel on the
//     shoulder top), where it is sighted (the rear sight and the sight line's height). Swords stay gear builds and their
//     hands close as hero-grip's do (gear's rest hold).
//   • THE PLACE, by the mode: RELAX is the cheapest way to have it at hand — hung from a straight arm under gravity (the
//     thing's centre of mass under the fist, the arm out until it clears the thigh), rested on the shoulder with a hand
//     steadying it, hugged at the belly, slung low-ready (the butt in the shoulder pocket, the muzzle down); AIM places a
//     firearm by its sight line, from the dominant eye to the mark: a long gun's butt in the shoulder pocket with the
//     head brought down onto the stock until the eye sits on the sight line (the cheek weld: the neck and the head's
//     pitch, tilt and turn and the butt's slide in the pocket, solved together), a pistol's sights on the line at the
//     arms' reach (two hands, the support hand wrapped over the strong one, or one), two pistols each pointed at the
//     mark. Each hand then closes on its station (hero-grip holdArm: the wrist in its range, the elbow down, the arm
//     clear of the trunk).
//   • PERCEIVED EFFORT (effortOf): the static moments the hold asks of each shoulder, elbow and wrist and of the low back
//     (L5/S1) — the arms' own segments (de Leva 1996) and the thing's weight, shared between its supports by the lever
//     rule (a single hand also carries the thing's couple about its fist) — over adult strengths (population means after
//     Chaffin, Andersson & Martin, Occupational Biomechanics; female upper limb ≈ 0.6 of male), scaled by the body's
//     mass (BMI 22 at its height). The limiting joint's share of its maximum (%MVC) reads as Borg's CR10 (≈ 10 × %MVC for
//     a held isometric effort) and as an endurance time (Rohmert's curve: unlimited under 15 % MVC).
//   • THE BODY ANSWERS: a hold that `eases` pulls the thing in toward the trunk as the effort rises (a heavy box hugged
//     at the belly, a light one carried out); the trunk leans until the body and the thing together keep the stance's
//     own centre of mass (back for a front load, away from a side load); the free arm swings out against a one-sided
//     load; the knees soften by the load's share of the body's mass; RELAX picks, of its candidate holds, the one that
//     costs least (a heavy gun or blade goes on the shoulder). WEIGHTLESS (the anime) perceives nothing: no answer, the
//     preferred hold, the effort still measured.
// Everything right-handed (the dominant hand and eye); pure and deterministic.
import { rigNodesAt, boneFrames, HAND_POSES } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { heroStance, comOf, hull, margin } from './hero-stance.js';
import { holdArm, humeralTurn, armClear, wristFor, anatomicalForearm, WRIST_EASE, WRIST_RANGE, HUMERAL_RANGE, landmark, mountOf, stationsOf, liteOf } from './hero-grip.js';
import { gearMounts, CANON_HEIGHT } from './hero-gear.js';
import { FIREARM_SHAPES, METAL, CARD, LEATHER, CANVAS, BRASS, GLASS, HANDLE } from '../equipment/firearm-shapes.js';

// ─── vectors, frames ──────────────────────────────────────────────────────────────────────────────────────────────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const T = (m) => [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]);
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const fromColumns = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const angle = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
const turnBetween = (a, b) => { const r = mm(T(a), b); return deg(Math.acos(Math.max(-1, Math.min(1, (r[0][0] + r[1][1] + r[2][2] - 1) / 2)))); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => +x.toFixed(1), r2 = (x) => +x.toFixed(2), r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
/** a direction in the target's frame ({ fwd, up, side }) in the rig's: +y the target, +x the right */
const dirOf = (v) => unit([v.side || 0, v.fwd || 0, v.up || 0]);
/** a frame turning rest vectors (a0 exactly, b0 as near as square allows) onto posed (a1, b1) */
const alignFrame = (a0, b0, a1, b1) => { const basis = (a, b) => { const x = unit(a), z = unit(cross(x, b)); return fromColumns(x, cross(z, x), z); }; return mm(basis(a1, b1), T(basis(a0, b0))); };
const G = 9.81;

// ─── the things ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The firearms' boxes live in equipment/firearm-shapes.js (the gear kernel builds the same ones).
export const CARRIED = Object.freeze({
  ...FIREARM_SHAPES,
  box: { class: 'object', kg: 6, com: [0, 0, 0], depth: 15,
    boxes: [[[-20, -15, -15], [20, 15, 15], CARD]],
    stations: { strong: { at: [-22.5, -8, -5], c: [0, 0.8, 0.6], a: [0, -0.6, 0.8] }, support: { at: [22.5, -8, -5], c: [0, 0.8, 0.6], a: [0, -0.6, 0.8] } } },
  suitcase: { class: 'object', kg: 8, com: [0, 0, 0],
    boxes: [[[-7.5, -18, -25], [7.5, 18, 25], LEATHER], [[-1.2, 18, -6], [1.2, 21.5, 6], METAL]],
    stations: { strong: HANDLE([0, 20, 0]) } },
  lantern: { class: 'object', kg: 1.2, com: [0, -4, 0],
    boxes: [[[-7, -13, -7], [7, 5, 7], GLASS], [[-5, 5, -5], [5, 8, 5], BRASS], [[-7.5, -14, -7.5], [7.5, -13, 7.5], BRASS], [[-0.6, 8, -0.6], [0.6, 16, 0.6], BRASS]],
    stations: { strong: HANDLE([0, 15, 0]), out: { at: [0, 15, 0], c: [1, 0, 0], a: [0, 0, 1] } } },
  sack: { class: 'object', kg: 20, com: [0, 0, 0],
    boxes: [[[-13, -9, -30], [13, 9, 30], CANVAS]],
    stations: { strong: { at: [-8, 6, 27], c: [1, 0, 0], a: [0, -0.5, 0.86], roll: [-180, 150] }, rest: { at: [8, -9, 0] } } },
  sword: { class: 'blade', gear: { item: 'sword', style: 'eastern' }, kg: 1.1 },
  greatsword: { class: 'blade', gear: { item: 'greatsword', style: 'historical' }, kg: 2.4 },
});
export const CARRIED_NAMES = Object.freeze(Object.keys(CARRIED));

// ─── the holds ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** the stances a hold stands in (hero-stance words; `left` their mirror: a right-handed shooter's left foot leads) */
const STANCE_WORDS = Object.freeze({
  stand: { family: 'square', spread: 0.22, line: 0, toes: { L: 8, R: -8 }, sink: 0.012, lean: 0, weight: 0.5, heel: 0, chest: 0,
    hands: { R: { at: 'navel', fwd: 0.05, up: -0.2, side: 0.22 }, L: { at: 'navel', fwd: 0.05, up: -0.2, side: -0.22 } }, serves: ['carry'] },
  isosceles: { family: 'square', spread: 0.32, line: 22, toes: { L: 12, R: 2 }, sink: 0.03, lean: 10, weight: 0.55, heel: 0, chest: 0.5,
    hands: { R: { at: 'chest', fwd: 0.3, up: 0, side: 0.02, line: true }, L: { at: 'chest', fwd: 0.3, up: 0, side: -0.02, line: true } }, serves: ['pistol'], left: true },
  rifle: { family: 'bladed', spread: 0.36, line: 45, toes: { L: 42, R: 8 }, sink: 0.035, lean: 8, weight: 0.55, heel: 0, chest: 0.5,
    hands: { R: { at: 'chest', fwd: 0.35, up: 0, side: 0, line: true }, L: { at: 'chest', fwd: 0.2, up: 0.05, side: 0.1, line: true } }, serves: ['rifle'], left: true },
  bladed: { family: 'bladed', spread: 0.38, line: 70, toes: { L: 60, R: 4 }, sink: 0.035, lean: 4, weight: 0.5, heel: 0, chest: 0.2,
    hands: { R: { at: 'chest', fwd: 0.4, up: 0, side: 0, line: true }, L: { at: 'navel', fwd: 0, up: -0.15, side: -0.2 } }, serves: ['one-hand pistol'] },
});
/**
 * The holds, right-handed. `item` a CARRIED name; `mode` relax | aim; `hands` 1 (the strong hand) | 2 (strong and
 * support on one thing) | 'dual' (one each); `stance` a STANCE_WORDS name. The place:
 *   hang                 hung from the straight strong arm, its centre of mass under the fist, out until it clears the thigh
 *   at { at, fwd, up, side, line } and anchor (a station)   the anchor station on a landmark (hero-grip's), `aim` its +z,
 *                        `up` its +y (`edge` its +x for a blade), `ease` the `fwd` the effort pulls in to
 *   rest { on, q }       the thing's point q (a station or item cm) on the shoulder top, the strong hand where it falls
 *   sight 'shoulder'     a long gun: the sight line from the dominant eye to the mark, the butt in the shoulder pocket,
 *                        the head onto the stock;  'reach': a pistol's sights on the line at `reach` of the arm
 *   point                each of two pistols pointed at the mark from `reach` of each arm
 *   cost                 a style penalty (CR10 points) relax adds when it chooses (a hold slower to bring up)
 */
const MARK = { at: 'eyes', far: 10 };
export const HOLDS = Object.freeze({
  pistolSide: { item: 'pistol', mode: 'relax', hands: 1, stance: 'stand', hang: true, aim: { fwd: 0.25, up: -1 }, up: { up: 1 }, cost: 0 },
  pistolLowReady: { item: 'pistol', mode: 'relax', hands: 2, stance: 'isosceles', extend: { dir: { fwd: 0.72, up: -0.69 }, reach: 0.93, side: 0.02 }, aim: { fwd: 0.72, up: -0.69 }, up: { up: 1 }, cost: 0.3 },
  pistolIsosceles: { item: 'pistol', mode: 'aim', hands: 2, stance: 'isosceles', sight: 'reach', reach: 0.97, mark: MARK },
  pistolOneHand: { item: 'pistol', mode: 'aim', hands: 1, stance: 'bladed', sight: 'reach', reach: 0.985, mark: MARK },
  pistolDual: { item: 'pistol', mode: 'aim', hands: 'dual', stance: 'isosceles', point: true, reach: 0.95, mark: MARK },
  ...Object.fromEntries(['carbine', 'shotgun', 'lmg'].flatMap((g) => [
    ...(g === 'lmg' ? [['lmgSide', { item: g, mode: 'relax', hands: 1, stance: 'stand', hang: true, grip: 'handle', aim: { fwd: 1 }, up: { up: 1 }, cost: 0.6 }]]
      : [[`${g}LowReady`, { item: g, mode: 'relax', hands: 2, stance: 'rifle', anchor: 'butt', at: { at: 'pocket' }, aim: { fwd: 0.82, up: -0.57 }, up: { up: 1 }, cost: 0 }]]),
    ...(g === 'lmg' ? [] : [[`${g}Trail`, { item: g, mode: 'relax', hands: 1, stance: 'stand', hang: true, grip: 'balance', aim: { fwd: 1 }, up: { up: 1 }, cost: 0.8 }]]),
    [`${g}Aim`, { item: g, mode: 'aim', hands: 2, stance: 'rifle', sight: 'shoulder', mark: MARK }],
  ])),
  boxFront: { item: 'box', mode: 'relax', hands: 2, stance: 'stand', anchor: 'centre', at: { at: 'belly', fwd: 0.4, up: 0.02, side: 0 }, ease: { min: 'touch' }, aim: { fwd: 1 }, up: { up: 1 }, touch: true, cost: 0 },
  suitcaseSide: { item: 'suitcase', mode: 'relax', hands: 1, stance: 'stand', hang: true, aim: { fwd: 1 }, up: { up: 1 }, cost: 0 },
  lanternSide: { item: 'lantern', mode: 'relax', hands: 1, stance: 'stand', hang: true, aim: { fwd: 1 }, up: { up: 1 }, cost: 0 },
  lanternOut: { item: 'lantern', mode: 'aim', hands: 1, stance: 'stand', anchor: 'out', grip: 'out', at: { at: 'chest', fwd: 0.46, up: -0.02, side: 0.14 }, ease: { min: 0.32 }, aim: { fwd: 1 }, up: { up: 1 } },
  sackShoulder: { item: 'sack', mode: 'relax', hands: 1, stance: 'stand', rest: { on: 'shoulderR', q: 'rest' }, aim: { fwd: 1 }, up: { up: 1, side: 0.1 }, touch: true, cost: 0 },
  swordSide: { item: 'sword', mode: 'relax', hands: 1, stance: 'stand', hang: true, cost: 0 },
  greatswordSide: { item: 'greatsword', mode: 'relax', hands: 1, stance: 'stand', hang: true, cost: 0 },
  // a long blade's point planted before the feet, the fist on top of the hilt (the blade out of its little-finger side):
  // the floor takes the weight (a sword too short to plant from a standing hand has no such rest)
  greatswordPlanted: { item: 'greatsword', mode: 'relax', hands: 1, stance: 'stand', bladeGrip: 'reverseHammer', rest: { on: 'floor', q: 'tip', fwd: 0.4, side: 0.2 }, aim: { fwd: 0.1, up: -1, side: 0.1 }, edge: { fwd: 1 }, spin: [-90, 90], cost: 0.5 },
});
export const HOLD_NAMES = Object.freeze(Object.keys(HOLDS));

// ─── the body's numbers ───────────────────────────────────────────────────────────────────────────────────────────────
const BMI = 22;
/** de Leva (1996): segment mass (share of the body) and centre (share from the proximal joint) */
const SEGMENTS = Object.freeze({
  male: { upperArm: [0.0271, 0.577], foreArm: [0.0162, 0.457], hand: [0.0061, 0.79], head: [0.0694, 0.5], trunk: [0.3229, 0.62] },
  female: { upperArm: [0.0255, 0.575], foreArm: [0.0138, 0.456], hand: [0.0056, 0.747], head: [0.0668, 0.5], trunk: [0.301, 0.62] },
});
/** the strongest static moment a joint holds (N·m) for a body of `per` kg: adult population means (Chaffin, Andersson &
 * Martin; 3DSSPP), shoulder flexion, elbow flexion, wrist flexion and deviation, the low back's extension */
export const STRENGTH = Object.freeze({
  male: { per: 75, shoulder: 60, elbow: 70, wrist: 12, back: 230 },
  female: { per: 60, shoulder: 35, elbow: 40, wrist: 7.5, back: 150 },
});
/** Borg CR10's anchors */
const CR10 = [[0, 'nothing'], [0.5, 'extremely weak'], [1, 'very weak'], [2, 'weak'], [3, 'moderate'], [4, 'somewhat strong'], [5, 'strong'], [7, 'very strong'], [10, 'extremely strong']];
const cr10Word = (v) => CR10.reduce((w, [k, s]) => (v >= k - 1e-9 ? s : w), 'nothing');
/** Rohmert (1960): how long a static hold at a share f of the maximum lasts (minutes); unlimited under 15 % */
export const endurance = (f) => (f <= 0.15 ? Infinity : r1(Math.max(0, -1.5 + 2.1 / f - 0.6 / f ** 2 + 0.1 / f ** 3)));
const castOf = (R, cast) => cast ?? (R.joints.bustRootR ? 'female' : 'male');
const heightOf = (R) => R.joints.headTop?.[2] ?? CANON_HEIGHT;
const bodyKg = (R) => BMI * heightOf(R) ** 2;

/** the low back's pivot (L5/S1): a share up the trunk from the hips' hub */
const lowBack = (n) => add(n.pelvisHub, mul(sub(n.neckHub, n.pelvisHub), 0.12));

/**
 * The effort a posed body spends holding its loads: `n` the posed joints, `loads` [{ kg, com (world), supports: [{ kind:
 * 'hand', side, at } | { kind: 'rest', at }] }]. Each load's weight is shared among its supports by the lever rule
 * (vertical forces keeping its moments: two supports along their line, three or more by least squares); a lone hand also
 * carries its couple. → { joints: { shoulderR, elbowR, wristR, …, back: { moment (N·m), mvc (share) } }, limit (the
 * joint), mvc, cr10, word, endurance (minutes) }.
 */
export function effortOf(R, n, loads, { cast } = {}) {
  const sex = castOf(R, cast), S = SEGMENTS[sex], ST = STRENGTH[sex], M = bodyKg(R), sc = M / ST.per;
  const w = (kg) => [0, 0, -kg * G];
  const torque = (pivot, pts) => pts.reduce((m, [p, F]) => add(m, cross(sub(p, pivot), F)), [0, 0, 0]);
  // each hand's force (and, alone, the thing's whole weight at its centre) and each rest's
  const handF = { L: [], R: [] }, restF = [];
  for (const ld of loads) {
    const sup = ld.supports, W = w(ld.kg);
    if (sup.length === 1) { const s = sup[0]; if (s.kind === 'hand') handF[s.side].push([ld.com, W]); else restF.push([ld.com, W]); continue; }
    const share = shares(sup.map((s) => s.at), ld.com);
    sup.forEach((s, i) => { const F = mul(W, share[i]); if (s.kind === 'hand') handF[s.side].push([s.at, F]); else restF.push([s.at, F]); });
  }
  const joints = {};
  for (const side of ['L', 'R']) {
    const sh = n[`shoulder${side}`], el = n[`elbow${side}`], wr = n[`wrist${side}`], kn = n[`knuckles${side}`];
    const segs = { upper: [add(sh, mul(sub(el, sh), S.upperArm[1])), w(M * S.upperArm[0])], fore: [add(el, mul(sub(wr, el), S.foreArm[1])), w(M * S.foreArm[0])], hand: [add(wr, mul(sub(kn, wr), S.hand[1])), w(M * S.hand[0])] };
    const hand = [segs.hand, ...handF[side]];
    joints[`wrist${side}`] = len(torque(wr, hand)) ; joints[`elbow${side}`] = len(torque(el, [segs.fore, ...hand])); joints[`shoulder${side}`] = len(torque(sh, [segs.upper, segs.fore, ...hand]));
  }
  // the low back: the trunk above it, the head, both arms, every load
  const L5 = lowBack(n), arms = ['L', 'R'].flatMap((s) => { const sh = n[`shoulder${s}`], el = n[`elbow${s}`], wr = n[`wrist${s}`]; return [[add(sh, mul(sub(el, sh), S.upperArm[1])), w(M * S.upperArm[0])], [add(el, mul(sub(wr, el), S.foreArm[1])), w(M * (S.foreArm[0] + S.hand[0]))]]; });
  const trunk = [add(L5, mul(sub(n.neckHub, L5), S.trunk[1])), w(M * S.trunk[0])], head = [add(n.headBase, mul(sub(n.headTop, n.headBase), S.head[1])), w(M * S.head[0])];
  joints.back = len(torque(L5, [trunk, head, ...arms, ...loads.map((ld) => [ld.com, w(ld.kg)])]));
  const cap = (j) => sc * ST[j.replace(/[LR]$/, '')];
  const out = Object.fromEntries(Object.entries(joints).map(([j, m]) => [j, { moment: r2(m), mvc: r3(m / cap(j)) }]));
  const [limit, top] = Object.entries(out).reduce((b, e) => (e[1].mvc > b[1].mvc ? e : b));
  const cr10 = r1(Math.min(10, 10 * top.mvc));
  return { joints: out, limit, mvc: top.mvc, cr10, word: cr10Word(cr10), endurance: endurance(top.mvc), bodyKg: r1(M), cast: sex };
}
/** vertical forces at points p keeping a weight at c: shares summing to 1 whose moments balance (least norm) */
function shares(ps, c) {
  const n = ps.length;
  if (n === 2) { const ab = sub(ps[1], ps[0]); const h = [ab[0], ab[1], 0], L2 = dot(h, h); if (L2 < 1e-10) return [0.5, 0.5]; const t = clamp(dot(sub(c, ps[0]), h) / L2, -3, 4); return [1 - t, t]; }
  // three or more: minimise Σs² subject to Σs = 1, Σs·(p − c)ₓ = 0, Σs·(p − c)ᵧ = 0 (the normal equations of the constraints)
  const A = [ps.map(() => 1), ps.map((p) => p[0] - c[0]), ps.map((p) => p[1] - c[1])], b = [1, 0, 0];
  const AAt = A.map((r) => A.map((q) => r.reduce((s, v, i) => s + v * q[i], 0))); for (let i = 0; i < 3; i++) AAt[i][i] += 1e-9;
  const y = solve3(AAt, b); return ps.map((_, i) => A[0][i] * y[0] + A[1][i] * y[1] + A[2][i] * y[2]);
}
const solve3 = (A, b) => { const M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < 3; i++) { let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; for (let k = 0; k < 3; k++) if (k !== i) { const q = M[k][i] / (M[i][i] || 1e-12); for (let l = i; l < 4; l++) M[k][l] -= q * M[i][l]; } } return M.map((r, i) => r[3] / (r[i] || 1e-12)); };

// ─── the hand on a station ────────────────────────────────────────────────────────────────────────────────────────────
const RIGS = new WeakMap();
/** per side the hand at rest: its long axis a0, the fingers' perpendicular f0 (out of the index side), the fist's centre h */
function handsAtRest(R) {
  let H = RIGS.get(R); if (H) return H;
  H = {};
  for (const side of ['L', 'R']) {
    const J = R.joints, a0 = unit(sub(J[`knuckles${side}`], J[`wrist${side}`]));
    const f0 = unit(sub([0, 1, 0], mul(a0, a0[1])));
    const g = gearMounts({ head: 'anime', gear: { [side === 'R' ? 'right' : 'left']: { item: 'dagger' } } }, R)[0];
    H[side] = { a0, f0, h: g.t, wrist: J[`wrist${side}`] };
  }
  RIGS.set(R, H); return H;
}
/** a thing in the world: rotation W (its frame → the rig's), origin O (its point 0, metres), scale k (cm → m) */
const worldOf = (F, q) => add(F.O, mv(F.W, mul(q, F.k)));
/** the hand frame and wrist a station wants on a placed thing (a proxy station: its line through the fist and its long axis
 * turned onto the hand's own at rest; a blade: gear's hold) */
function stationWant(R, F, st, side) {
  const H = handsAtRest(R)[side];
  let m, P;
  if (st.M) { m = mm(F.W, T(st.M)); P = worldOf(F, st.at); return { m, P, wrist: sub(P, mv(m, sub(st.t, H.wrist))) }; }
  const c = unit(st.c), a = unit(st.a), th = rad(90 - angle(c, a));
  const c0 = unit(add(mul(H.f0, Math.cos(th)), mul(H.a0, Math.sin(th))));
  m = alignFrame(c0, H.a0, mv(F.W, c), mv(F.W, a)); P = worldOf(F, st.at);
  return { m, P, wrist: sub(P, mv(m, sub(H.h, H.wrist))) };
}
/** a frame from its +z (aim) and its +y (up) or +x (edge) words */
function frameOf(z, { up, edge }) {
  if (edge) { let x = dirOf(edge); x = unit(sub(x, mul(z, dot(x, z)))); return fromColumns(x, cross(z, x), z); }
  let y = dirOf(up ?? { up: 1 }); y = sub(y, mul(z, dot(y, z))); if (len(y) < 1e-6) y = cross(z, [1, 0, 0]); y = unit(y);
  return fromColumns(cross(y, z), y, z);
}

// ─── the body's landmarks ─────────────────────────────────────────────────────────────────────────────────────────────
const scaleOf = (R) => heightOf(R) / CANON_HEIGHT;
/** the dominant (right) eye's pupil, carried by the head (measured on the anime heads: 4.3 cm off the midline, 10 cm
 * before the neck's top, 0.55 of the head's height up it) */
function eyeOf(R, n, frames) {
  const J = R.joints, hb = R.boneIndex.head, fr = frames[hb];
  const hH = J.headTop[2] - J.headBase[2], s = hH / 0.13;
  const rest = add(J.headBase, [0.043 * s, 0.102 * s, 0.55 * hH]);
  return add(fr.head, mv(fr.m, sub(rest, fr.restHead)));
}
/** the shoulder pocket (where a butt sits: inside the shoulder joint, below and before it), and the shoulder's top */
const pocketOf = (R, n) => add(n.shoulderR, mul([-0.04, 0.035, -0.035], scaleOf(R)));
const shoulderTop = (R, n, side) => add(n[`shoulder${side}`], mul([side === 'R' ? -0.03 : 0.03, 0, 0.06], scaleOf(R)));
const placeOf = (R, n, h) => { if (h.at === 'pocket') return pocketOf(R, n); const lm = landmark(n, h.at); return [(h.line ? 0 : lm[0]) + (h.side || 0), lm[1] + (h.fwd || 0), lm[2] + (h.up || 0)]; };
const markOf = (n, p) => { const lm = landmark(n, p.at); return [0, n.pelvisHub[1] + p.far, lm[2]]; };

// ─── the thing's model on a rig ───────────────────────────────────────────────────────────────────────────────────────
/** the thing as the solver reads it: k, its stations (a blade's from gear), its centre of mass and its mass */
function modelOf(R, name, kg, bladeGrip = 'hammer') {
  const C = CARRIED[name]; if (!C) throw new Error(`hero-carry: nothing called '${name}' (have ${CARRIED_NAMES.join(', ')})`);
  const k = 0.01 * scaleOf(R);
  if (C.class !== 'blade') return { name, C, k, kg: kg ?? C.kg, com: C.com, stations: C.stations };
  // a blade: gear's mount on the right hand, its stations along +z (grip's), its centre at the balance
  const G = mountOf(R, C.gear, 'R', bladeGrip), st = stationsOf(G, R, 1);
  return { name, C, k: G.k, kg: kg ?? C.kg * (G.trace.dials?.mass ?? 1), com: [0, 0, st.balance], G, st, stations: { strong: { M: G.M, t: G.t, at: [0, 0, st.upper] } } };
}
const stationQ = (Mo, s) => (Array.isArray(s) ? s : typeof s === 'number' ? [0, 0, Mo.st.guard + s * (Mo.st.tip[2] - Mo.st.guard)] : s === 'tip' && Mo.st ? Mo.st.tip : Mo.stations[s]?.at ?? (s === 'centre' ? [0, 0, 0] : null));

// ─── the solve ────────────────────────────────────────────────────────────────────────────────────────────────────────
const ARM_KEYS = ['shL', 'shR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'fingersL', 'fingersR'];
const without = (pose, keys) => Object.fromEntries(Object.entries(pose).filter(([k]) => !keys.includes(k)));
const FREE_ARM = (yaw) => ({ shL: { pitch: 4, yaw: r1(yaw), roll: 0 }, elbowL: 12, fingersL: { ...HAND_POSES.relaxed } });
/** the effort (CR10) at which a hold starts to pull its thing in, and at which it holds it closest */
const EASE = [1.5, 5];
const PALM = Object.freeze({ thumb: 12, index: 22, middle: 22, ring: 22, little: 22 });

/** a placed thing spun d degrees about its own +z through its rest point (a rested thing keeps its contact) */
function spun(placed, d, Mo, H) {
  if (!d) return placed;
  return { ...placed, things: placed.things.map((t) => {
    const pivot = t.rest ?? worldOf(t.F, [0, 0, 0]), z = [t.F.W[0][2], t.F.W[1][2], t.F.W[2][2]];
    const Rz = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => turnAbout(e, z, d)); const Rm = T(Rz);
    return { ...t, F: { ...t.F, W: mm(Rm, t.F.W), O: add(pivot, mv(Rm, sub(t.F.O, pivot))) } };
  }) };
}
/** the things a hold places on a posed body: [{ F, side?, Mo }] and the head's turn for a cheek weld */
function place(H, R, Mo, body, ease) {
  const lite = liteOf(R), n = rigNodesAt(lite, elbowsDown(R, body)).nodes, k = Mo.k;
  const frameAt = (W, q, P) => ({ W, k, O: sub(P, mv(W, mul(q, k))) });
  if (H.hang) {
    // the strong arm hanging straight: the fist under the shoulder at the rest arm's drop, the thing upright under it (a
    // blade at gear's rest), out until the thing clears the thigh by a centimetre
    const hr = handsAtRest(R).R, drop = mul(sub(hr.h, R.joints.shoulderR), 0.985);   // a relaxed elbow, a little bent
    const W = Mo.G ? Mo.G.M : frameOf(dirOf(H.aim), H);
    const q = Mo.stations[H.grip ?? 'strong'].at; let out = 0, F;
    for (let it = 0; it < 30; it++) {
      const P = add(n.shoulderR, add(drop, [out, 0, 0])); F = frameAt(W, q, P);
      const inner = Math.min(...corners(Mo).map((c) => { const p = worldOf(F, c); return thighGap(R, n, p); }));
      if (inner >= 0.01 || Mo.G) break; out += 0.01 - inner + 0.002;
    }
    return { things: [{ F, Mo }], n };
  }
  if (H.rest) {
    // the thing's point q on the shoulder's top, its frame as the words say; the strong hand where the thing puts it
    // (or on the floor before the feet: a planted point)
    const W = Mo.G ? frameOf(dirOf(H.aim), { edge: H.edge }) : frameOf(dirOf(H.aim), H);
    const on = H.rest.on === 'floor' ? [H.rest.side ?? 0, n.pelvisHub[1] + (H.rest.fwd ?? 0.3), 0.002] : shoulderTop(R, n, 'R');
    return { things: [{ F: frameAt(W, stationQ(Mo, H.rest.q), on), Mo, rest: on, ...(H.rest.on === 'floor' ? { ground: true } : {}) }], n };
  }
  if (H.sight === 'reach' || H.point) {
    const frames = boneFrames(R, R.joints, rigNodesAt(R, elbowsDown(R, body)).nodes), E = eyeOf(R, n, frames), mark = markOf(n, H.mark);
    const armTo = (side) => { const J = R.joints; return dist(J[`shoulder${side}`], J[`elbow${side}`]) + dist(J[`elbow${side}`], J[`wrist${side}`]) + dist(J[`wrist${side}`], handsAtRest(R)[side].h); };
    if (H.point) {
      // two pistols, each from its arm's reach toward the mark
      return { things: ['R', 'L'].map((side) => { const sh = n[`shoulder${side}`], d = unit(sub(mark, sh)), P = add(sh, mul(d, H.reach * armTo(side))); const W = frameOf(unit(sub(mark, P)), { up: { up: 1 } }); const q = Mo.stations.strong.at; return { F: frameAt(side === 'R' ? W : W, q, P), Mo, side }; }), n };
    }
    // the sights on the eye's line to the mark, as far out as the strong arm reaches `reach` of itself
    const d = unit(sub(mark, E)), W = frameOf(d, { up: { up: 1 } }), rear = [0, Mo.C.sight.y, Mo.C.sight.rear];
    const at = (t) => frameAt(W, rear, add(E, mul(d, t)));
    let lo = 0.15, hi = 1.2;
    for (let i = 0; i < 40; i++) { const t = (lo + hi) / 2; if (dist(worldOf(at(t), Mo.stations.strong.at), n.shoulderR) < H.reach * armTo('R')) lo = t; else hi = t; }
    return { things: [{ F: at((lo + hi) / 2), Mo }], n };
  }
  if (H.sight === 'shoulder') return weld(H, R, Mo, body);
  if (H.extend) {
    // the arms out along a line from the shoulders' height on the body's middle (or the strong shoulder), the strong
    // fist `reach` of the arm along it
    const J = R.joints, arm = dist(J.shoulderR, J.elbowR) + dist(J.elbowR, J.wristR) + dist(J.wristR, handsAtRest(R).R.h), d = dirOf(H.extend.dir);
    const P = add([H.extend.side ?? n.shoulderR[0], n.shoulderR[1], n.shoulderR[2]], mul(d, H.extend.reach * arm));
    return { things: [{ F: frameAt(frameOf(dirOf(H.aim), H), Mo.stations.strong.at, P), Mo }], n };
  }
  // a landmark place: the anchor station there (the effort's ease pulls `fwd` in)
  const at = ease !== undefined ? { ...H.at, fwd: ease } : H.at;
  const W = frameOf(dirOf(H.aim), H), q = stationQ(Mo, H.anchor);
  const P = placeOf(R, n, at);
  return { things: [{ F: frameAt(W, q, P), Mo, ...(H.anchor === 'butt' ? { butt: P } : {}) }], n };
}
/** the thing's corners (cm) */
const corners = (Mo) => (Mo.C.boxes ?? []).flatMap(([lo, hi]) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]));
/** a point's gap to the right thigh (its hip → knee capsule), metres */
const thighGap = (R, n, p) => { const a = n.hipR, b = n.kneeR, ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1); return dist(p, add(a, mul(ab, t))) - 0.075 * scaleOf(R); };

/**
 * THE CHEEK WELD: a long gun aimed from the shoulder. The butt sits in the shoulder pocket (sliding up to a few
 * centimetres up it and in toward the collarbone), the gun's line the dominant eye's line to the mark, and the head comes
 * down and over onto the stock until the eye sits on the sight line behind the rear sight: the neck's pitch, the head's
 * pitch, tilt and turn and the butt's place in the pocket solved together (Levenberg–Marquardt), each kept small.
 */
function weld(H, R, Mo, body) {
  const s = scaleOf(R), sightRear = [0, Mo.C.sight.y, Mo.C.sight.rear], butt = Mo.stations.butt.at;
  const head0 = body.head || {}, neck0 = body.neck || {};
  const poseOf = (x) => ({ ...body, neck: { ...neck0, pitch: (neck0.pitch || 0) + x[0] }, head: { ...head0, pitch: (head0.pitch || 0) + x[1], yaw: (head0.yaw || 0) + x[2], turn: (head0.turn || 0) + x[3] } });
  const at = (x) => {
    const pose = elbowsDown(R, poseOf(x)), n = rigNodesAt(R, pose).nodes, frames = boneFrames(R, R.joints, n), E = eyeOf(R, n, frames);
    const mark = markOf(n, H.mark), d = unit(sub(mark, E)), W = frameOf(d, { up: { up: 1 } });
    const B = add(pocketOf(R, n), [-x[5], 0, x[4]]), F = { W, k: Mo.k, O: sub(B, mv(W, mul(butt, Mo.k))) };
    return { n, E, d, F, B };
  };
  // the support hand must reach its station's nearest end (the gun sits where both hands can hold it)
  const sup = Mo.stations.support, J = R.joints, armL = 0.97 * (dist(J.shoulderL, J.elbowL) + dist(J.elbowL, J.wristL) + dist(J.wristL, handsAtRest(R).L.h));
  const resid = (x) => { const { E, d, F, n } = at(x); const S = worldOf(F, sightRear), v = sub(E, S), along = dot(v, d), perp = sub(v, mul(d, along));
    const relief = Math.max(0, along + 0.05 * s, -0.16 * s - along);
    const reach = sup ? Math.max(0, dist(worldOf(F, [sup.at[0], sup.at[1], sup.slide ? sup.slide[0] : sup.at[2]]), n.shoulderL) - armL) : 0;
    return [...mul(perp, 1000), relief * 300, reach * 1000, x[0] / 30, x[1] / 30, x[2] / 30, x[3] / 30, x[4] * 5, x[5] * 40]; };
  const lo = [-50, -45, -10, -30, -0.03 * s, 0], hi = [12, 20, 35, 30, 0.14 * s, 0.04 * s];
  // several starts (the head down and over, or the butt up the pocket first: a shooter raises the gun to the eye before
  // craning the neck): the closest weld kept
  const cost = (x) => resid(x).reduce((t, v) => t + v * v, 0);
  const x = [[-8, -5, 10, 0, 0.02 * s, 0], [-20, -15, 20, 0, 0.06 * s, 0.02 * s], [-25, -5, 10, 0, 0.12 * s, 0.03 * s], [-35, -15, 5, 10, 0.1 * s, 0.01 * s]].map((x0) => lmSolve(resid, x0, lo, hi, 120)).reduce((a, b) => (cost(b) < cost(a) ? b : a));
  const { F, n, B } = at(x);
  return { things: [{ F, Mo, butt: B }], n, head: { neck: poseOf(x).neck, head: poseOf(x).head }, weld: x };
}
/** Levenberg–Marquardt (hero-grip's), bounded */
function lmSolve(f, x0, lo, hi, iters = 60) {
  const cl = (x) => x.map((v, i) => clamp(v, lo[i], hi[i]));
  let x = cl(x0), r = f(x), c = r.reduce((a, v) => a + v * v, 0), lam = 1e-3; const N = x.length;
  for (let it = 0; it < iters; it++) {
    const J = []; for (let j = 0; j < N; j++) { const h = (hi[j] - lo[j]) * 1e-3, xp = [...x]; xp[j] += h; const rp = f(cl(xp)); J.push(rp.map((v, i) => (v - r[i]) / h)); }
    const A = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => J[i].reduce((a, v, k) => a + v * J[j][k], 0))), g = J.map((Ji) => Ji.reduce((a, v, k) => a + v * r[k], 0));
    let moved = false;
    for (let t = 0; t < 8 && !moved; t++) {
      const M = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (A[i][i] + 1e-9) : 0))), b = g.map((v) => -v);
      for (let i = 0; i < N; i++) { let p = i; for (let k = i + 1; k < N; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let k = i + 1; k < N; k++) { const q = M[k][i] / (M[i][i] || 1e-12); for (let l = i; l < N; l++) M[k][l] -= q * M[i][l]; b[k] -= q * b[i]; } }
      const dx = Array(N).fill(0); for (let i = N - 1; i >= 0; i--) { let v = b[i]; for (let l = i + 1; l < N; l++) v -= M[i][l] * dx[l]; dx[i] = v / (M[i][i] || 1e-12); }
      const xn = cl(x.map((v, i) => v + dx[i])), rn = f(xn), cn = rn.reduce((a, v) => a + v * v, 0);
      if (cn < c) { x = xn; r = rn; c = cn; lam = Math.max(1e-7, lam / 3); moved = true; } else lam *= 4;
    }
    if (!moved) break;
  }
  return x;
}

/** how hard a carry's arm solve holds the wrist inside its anatomical range: a degree past it weighs as 2 cm of the
 * fist off its station (a wall; hero-grip's guards weigh it as a millimetre) */
const RANGE_WEIGHT = 20;
/** and the arm off the trunk: a centimetre pressed in weighs as a degree past the wrist's range */
const CLEAR_WEIGHT = 2000;
/** an arm's solve as one score: the fist on its station first, then the wrist's ease, then the elbow's lift */
const armScore = (a) => 1e4 * Math.max(0, a.err - 0.002) + 100 * Math.hypot(...Object.entries(WRIST_RANGE).map(([k, [lo, hi]]) => Math.max(0, lo - a.anatomy[k], a.anatomy[k] - hi))) + a.stray + 10 * a.lift;
/** the turns a roll range is searched at (every 30°, its ends included) */
const spins = ([lo, hi]) => { const out = []; for (let d = lo; d < hi; d += 30) out.push(d); out.push(hi); return out; };
/** v turned about the unit axis k by d degrees (Rodrigues) */
const turnAbout = (v, k0, d) => { const k = unit(k0), a = rad(d), c = Math.cos(a), sn = Math.sin(a); return add(add(mul(v, c), mul(cross(k, v), sn)), mul(k, dot(k, v) * (1 - c))); };
/** the hands on the things: which hand closes on which station */
function handsOf(H, things) {
  if (H.hands === 'dual') return things.map((t) => ({ side: t.side, thing: t, station: 'strong' }));
  return [{ side: 'R', thing: things[0], station: H.grip ?? 'strong' }, ...(H.hands === 2 ? [{ side: 'L', thing: things[0], station: 'support' }] : [])];
}
/** a mirrored station for the left hand of a dual pair: the same thing in the left hand (its x reflected) */
const leftStation = (st) => (st.M ? st : { at: [-st.at[0], st.at[1], st.at[2]], c: [-st.c[0], st.c[1], st.c[2]], a: [-st.a[0], st.a[1], st.a[2]] });

/** the fingers a station takes: a palm on a flat face, a grip round anything else */
const fingersOf = (Mo, st) => (Mo.C.class === 'object' && !st.c?.every((v, i) => v === [0, 0, 1][i]) ? PALM : HAND_POSES.grip);
/** the arms on a placed hold: the pose and each hand's solve */
function armsOn(H, R, Mo, body, placed, skilled) {
  const arms = {}, holds = {}, want = {};
  for (const h of handsOf(H, placed.things)) {
    let st = h.thing.Mo.stations[h.station]; if (h.side === 'L' && H.hands === 'dual') st = leftStation(st);
    // a hand that may slide along its station (a long gun's handguard) closes where its arm holds it best: the fist on
    // it, then the wrist at ease and the elbow least lifted
    // and one that closes round a round part (a handguard) turns about it to where the wrist sits easiest
    const tryAll = (cands) => { let b = null; for (const s1 of cands) { const w = stationWant(R, h.thing.F, s1, h.side), a = holdArm(R, body, h.side, w.wrist, w.m, { skilled, range: RANGE_WEIGHT, clear: CLEAR_WEIGHT }); const score = armScore(a); if (!b || score < b.score) b = { w, a, st: s1, score }; } return b; };
    // (searched in turn: where along it, how far round it, then each again finer)
    const slideTo = (b, us) => tryAll(us.map((u) => ({ ...b.st, at: [st.at[0], st.at[1], st.slide[0] + u * (st.slide[1] - st.slide[0])] })));
    const rollBy = (b, ds) => tryAll(ds.map((d) => ({ ...b.st, a: turnAbout(b.st.a, st.c, d) })));
    let best = tryAll([st]);
    if (st.slide) best = slideTo(best, [0, 0.2, 0.4, 0.6, 0.8, 1]);
    if (st.roll) { best = tryAll(spins(st.roll).map((d) => ({ ...best.st, a: turnAbout(st.a, st.c, d) }))); best = rollBy(best, [-20, -10, 0, 10, 20]); }
    if (st.slide) { const u0 = (best.st.at[2] - st.slide[0]) / (st.slide[1] - st.slide[0]); best = slideTo(best, [-0.1, -0.05, 0, 0.05, 0.1].map((d) => clamp(u0 + d, 0, 1))); }
    // a hand that cannot close there takes the station's fallback (a short arm's grip on the magazine)
    if (st.alt && best.a.err > 0.004) { const A = st.alt; let b2 = tryAll(spins(A.roll).map((d) => ({ ...A, a: turnAbout(A.a, A.c, d) }))); b2 = tryAll([-20, -10, 0, 10, 20].map((d) => ({ ...b2.st, a: turnAbout(b2.st.a, A.c, d) }))); if (b2.score < best.score) best = b2; }
    st = best.st; const w = best.w, a = best.a; want[h.side] = w; holds[h.side] = a; h.thing.at = { ...(h.thing.at || {}), [h.side]: st.at };
    Object.assign(arms, { [`sh${h.side}`]: a.sh, [`elbow${h.side}`]: a.elbow, [`wrist${h.side}`]: a.wrist, [`fingers${h.side}`]: { ...fingersOf(Mo, st) } });
  }
  return { arms, holds, want };
}

/** the loads a placed hold puts on the body: each thing's weight at its centre, held by its hands and its rest */
function loadsOf(H, R, n, placed, Mo, kgScale) {
  return placed.things.map((t) => {
    const hands = handsOf(H, placed.things).filter((h) => h.thing === t).map((h) => {
      const st = h.side === 'L' && H.hands === 'dual' ? leftStation(t.Mo.stations[h.station]) : t.Mo.stations[h.station];
      return { kind: 'hand', side: h.side, at: worldOf(t.F, t.at?.[h.side] ?? st.at) };
    });
    const rest = t.rest ? [{ kind: 'rest', at: t.rest }] : t.butt ? [{ kind: 'rest', at: t.butt }] : [];
    return { kg: Mo.kg * kgScale, com: worldOf(t.F, Mo.com), supports: [...hands, ...rest] };
  });
}

/** the body's centre of mass (comOf's segments, the hands' too) with its loads, in the ground plane */
function comWith(R, n, loads) {
  const M = bodyKg(R), c = comOf(n); let x = c[0] * M, y = c[1] * M, kg = M;
  for (const ld of loads) { x += ld.com[0] * ld.kg; y += ld.com[1] * ld.kg; kg += ld.kg; }
  return [x / kg, y / kg];
}

/**
 * A hold solved on a rig. `name` a HOLDS name or hold words; `kg` the thing's mass (else its own); `regime` 'skilled'
 * (the default: the body answers the effort) | 'weightless' (perceived effort nothing: the preferred hold, unanswered).
 * → { name, item, mode, hands, regime, kg, pose (the held rig pose), things: [{ F (W, O, k), item, side? }], effort,
 * answer ({ ease, lean, sideLean, sink, freeArm }), checks }.
 */
export function heroHold(name, R, { kg, regime = 'skilled', cast } = {}) {
  const H = typeof name === 'object' ? name : HOLDS[name]; if (!H) throw new Error(`hero-carry: no hold '${name}' (have ${HOLD_NAMES.join(', ')})`);
  const Mo = modelOf(R, H.item, kg, H.bladeGrip), skilled = regime !== 'weightless';
  const SW = STANCE_WORDS[H.stance]; const stance = heroStance(SW, R, { left: !!SW.left });
  const share = Mo.kg / bodyKg(R);
  const legLen = R.joints.hipR[2] - R.joints[R.legs.R.toeBase][2];
  let body = without(stance.hold, ARM_KEYS);
  // the free arm: hanging, swung out against a one-sided load
  const oneSided = H.hands === 1;
  const freeYaw = oneSided && skilled ? clamp(160 * share, 0, 35) : 3;
  if (oneSided) body = { ...body, ...FREE_ARM(freeYaw) };
  // the knees soften by the load's share of the body's mass
  const sink = skilled ? Math.min(0.06, 0.25 * share) * legLen : 0;
  if (sink) body = { ...body, sink: (body.sink || 0) + sink };
  // the ease: the place's `fwd` pulled in toward the trunk as the effort rises (from the preferred to `min`: a number, or
  // `touch`, the thing's back against the belly)
  const pref = H.at?.fwd;
  const easeMin = !H.ease ? null : H.ease.min === 'touch' ? (0.115 * scaleOf(R) + Mo.k * (Mo.C.depth ?? 0) + 0.004) : H.ease.min;
  let easeTo;
  // a thing resting on the shoulder may spin about its own length (a gun on its side, a blade on its flat or its back):
  // it spins to where the holding arm is easiest, kept once found
  let spin = 0;
  const solveOnce = (b, e, sp) => { const placed = spun(place(H, R, Mo, b, e), sp, Mo, H); const bb = placed.head ? { ...b, ...placed.head } : b; const A = armsOn(H, R, Mo, bb, placed, skilled); return { placed, body: bb, ...A, spin: sp, pose: elbowsDown(R, { ...bb, ...A.arms }) }; };
  const solveAt = (b, e, search = false) => {
    if (!search || !H.spin) return solveOnce(b, e, spin);
    let best = null; for (const sp of spins(H.spin)) { const x = solveOnce(b, e, sp), sc = Object.values(x.holds).reduce((t, a) => t + armScore(a), 0); if (!best || sc < best.sc) best = { x, sc }; }
    spin = best.x.spin; return best.x;
  };
  let S = solveAt(body, pref, true);
  const effortAt = (sol) => { const n = rigNodesAt(R, sol.pose).nodes; return effortOf(R, n, loadsOf(H, R, n, sol.placed, Mo, 1), { cast }); };
  if (skilled && H.ease) {
    const e0 = effortAt(S); easeTo = r3(pref + (easeMin - pref) * clamp((e0.cr10 - EASE[0]) / (EASE[1] - EASE[0]), 0, 1));
    if (Math.abs(easeTo - pref) > 1e-3) S = solveAt(body, easeTo);
  }
  // THE ANSWER TO THE WEIGHT: the load must not move the body's centre off its base, so the body and its load together
  // stand where the body alone stood over its feet. The trunk takes what it can (bent back from a front load, away from
  // a side one, inside SAG and LAT of the spine's range; an aim never leans back: it leans into the gun), the ankles the
  // rest (the whole body swaying back over feet set that much forward). While the trunk bends the load follows as it is held: hung or rested things re-hang from the
  // shoulder, a gripped or aimed one rides the hand.
  let lean = 0, sideLean = 0, shift = [0, 0];
  const n0 = rigNodesAt(R, S.pose).nodes, rel0 = sub2(comOf(n0), baseOf(R, n0));
  const follows = !(H.sight || H.point);
  const relAt = (b) => { const n = rigNodesAt(R, b).nodes; const pl = follows ? spun(place(H, R, Mo, b, easeTo ?? pref), spin, Mo, H) : carriedThings(R, S, b); return sub2(comWith(R, n, loadsOf(H, R, n, pl, Mo, 1)), baseOf(R, n)); };
  if (skilled) {
    for (let it = 0; it < 3; it++) {
      const e = sub2(relAt(withSpine(S.pose, lean, sideLean)), rel0), h = 0.05;
      const dy = (relAt(withSpine(S.pose, lean + h, sideLean))[1] - relAt(withSpine(S.pose, lean, sideLean))[1]) / h;
      const dx = (relAt(withSpine(S.pose, lean, sideLean + h))[0] - relAt(withSpine(S.pose, lean, sideLean))[0]) / h;
      lean = clamp(lean - e[1] / (Math.abs(dy) > 1e-4 ? dy : 0.1), H.mode === 'aim' ? 0 : SAG[0], SAG[1]); sideLean = clamp(sideLean - e[0] / (Math.abs(dx) > 1e-4 ? dx : 0.1), LAT[0], LAT[1]);
    }
    for (let it = 0; it < 2; it++) { const e = sub2(relAt(withFeet(withSpine(S.pose, lean, sideLean), shift)), rel0); shift = clampShift([shift[0] + e[0], shift[1] + e[1]]); }
    if (Math.abs(lean) > 1e-3 || Math.abs(sideLean) > 1e-3 || Math.hypot(...shift) > 1e-4) S = solveAt(withFeet(withSpine(body, lean, sideLean), shift), H.ease ? easeTo : pref);
    // the arms settled on the leaned body: the feet take the last of it (they move nothing above the hips)
    for (let it = 0; it < 2; it++) { const e = sub2(relAt(S.pose), rel0), to = clampShift([shift[0] + e[0], shift[1] + e[1]]); S = { ...S, pose: withFeet(S.pose, sub2(to, shift)) }; shift = to; }
  }
  const n = rigNodesAt(R, S.pose).nodes, frames = boneFrames(R, R.joints, n);
  const loads = loadsOf(H, R, n, S.placed, Mo, 1);
  const effort = effortOf(R, n, loads, { cast });
  const things = S.placed.things.map((t) => ({ item: H.item, F: t.F, ...(t.side ? { side: t.side } : {}), ride: rideOf(R, frames, t, H) }));
  return { name: typeof name === 'string' ? name : 'own', item: H.item, mode: H.mode, hands: H.hands, regime, kg: r2(Mo.kg), pose: S.pose, things, effort,
    perceived: skilled ? effort.cr10 : 0,
    answer: { ...(S.placed.weld ? { weld: { neckPitch: r1(S.placed.weld[0]), headPitch: r1(S.placed.weld[1]), headTilt: r1(S.placed.weld[2]), headTurn: r1(S.placed.weld[3]), buttUp: r3(S.placed.weld[4]), buttIn: r3(S.placed.weld[5]) } } : {}), ease: H.ease ? { from: pref, to: easeTo ?? pref } : null, lean: r3(lean), sideLean: r3(sideLean), sway: [r4(-shift[0]), r4(-shift[1])], sink: r4(sink), freeArm: oneSided ? r1(freeYaw) : null },
    checks: holdChecks(R, S, H, Mo, { n, frames, loads, rel0, skilled }) };
}
/** how far the trunk answers a load (shares of the spine's range): back and forward, either side */
const SAG = [-0.25, 0.15], LAT = [-0.25, 0.25];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
/** the base: the middle of the feet's balls */
const baseOf = (R, n) => [(n[R.legs.L.toeBase][0] + n[R.legs.R.toeBase][0]) / 2, (n[R.legs.L.toeBase][1] + n[R.legs.R.toeBase][1]) / 2];
/** the feet set off by (dx, dy) under the body: the body swaying the other way over them */
const SWAY = 0.08;
const clampShift = ([x, y]) => [clamp(x, -SWAY, SWAY), clamp(y, -SWAY, SWAY)];
const withFeet = (pose, [dx, dy]) => (pose.feet ? { ...pose, feet: Object.fromEntries(Object.entries(pose.feet).map(([k, p]) => [k, [p[0] + dx, p[1] + dy, p[2]]])) } : pose);
/** the spine bent back (− sagittal) and aside (+ to the right) on top of a pose's own */
const withSpine = (pose, sag, lat) => { const sp = pose.spine || { sagittal: 0, lateral: 0, axial: 0 }; return { ...pose, spine: { sagittal: clamp((sp.sagittal || 0) + sag, -1, 1), lateral: clamp((sp.lateral || 0) + lat, -1, 1), axial: sp.axial || 0 } }; };
/** the things carried rigid on the strong hand into another pose (the lean's search: the arms' angles kept) */
function carriedThings(R, S, pose) {
  const n0 = rigNodesAt(R, S.pose).nodes, f0 = boneFrames(R, R.joints, n0), n1 = rigNodesAt(R, pose).nodes, f1 = boneFrames(R, R.joints, n1);
  return { ...S.placed, things: S.placed.things.map((t) => {
    const side = t.side ?? 'R', b = R.boneIndex[`hand${side}`], A = f0[b], B = f1[b], Rm = mm(B.m, T(A.m));
    return { ...t, F: { ...t.F, W: mm(Rm, t.F.W), O: add(B.head, mv(Rm, sub(t.F.O, A.head))) }, ...(t.rest ? { rest: add(B.head, mv(Rm, sub(t.rest, A.head))) } : {}), ...(t.butt ? { butt: add(B.head, mv(Rm, sub(t.butt, A.head))) } : {}) };
  }) };
}
/** how a thing rides its hand's bone (for a clip): its frame in the bone's rest frame — W at rest = Hm, O at rest = Ho */
function rideOf(R, frames, t, H) {
  const side = t.side ?? 'R', bi = R.boneIndex[`hand${side}`], f = frames[bi];
  const W = mm(T(f.m), t.F.W), O = add(f.restHead, mv(T(f.m), sub(t.F.O, f.head)));
  return { bone: `hand${side}`, boneIndex: bi, W, O, k: t.F.k };
}

// ─── the checks ───────────────────────────────────────────────────────────────────────────────────────────────────────
const CAPSULES = [['pelvisHub', 'neckHub', 0.12, 'trunk'], ['headBase', 'headTop', 0.1, 'head'], ['shoulderL', 'elbowL', 0.045, 'arm'], ['shoulderR', 'elbowR', 0.045, 'arm'],
  ['elbowL', 'wristL', 0.035, 'arm'], ['elbowR', 'wristR', 0.035, 'arm'], ['hipL', 'kneeL', 0.07, 'leg'], ['hipR', 'kneeR', 0.07, 'leg'], ['kneeL', 'ankleL', 0.05, 'leg'], ['kneeR', 'ankleR', 0.05, 'leg']];
const segDist = (p, a, b) => { const ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / (dot(ab, ab) || 1), 0, 1); return dist(p, add(a, mul(ab, t))); };
/** points over a thing's surface (its boxes' corners, edge middles and face centres; a blade's line) */
function surface(Mo) {
  if (Mo.G) return Array.from({ length: 25 }, (_, i) => [0, 0, Mo.st.guard + (i / 24) * (Mo.st.tip[2] - Mo.st.guard)]);
  return Mo.C.boxes.flatMap(([lo, hi]) => { const v = []; for (const i of [0, 0.5, 1]) for (const j of [0, 0.5, 1]) for (const k of [0, 0.5, 1]) v.push([lo[0] + (hi[0] - lo[0]) * i, lo[1] + (hi[1] - lo[1]) * j, lo[2] + (hi[2] - lo[2]) * k]); return v; });
}

/**
 * The machine gate on a held hold: per hand { at (m, the fist off its station), turn (degrees off the frame wanted),
 * wrist, stray, inRange, humerus, armClear }; clearance (m, the thing's nearest approach to the body's capsules; a hold
 * that touches — hugged, rested — excuses the trunk and the shoulder's arm); aim (a sighted hold: eye (m, the eye off the
 * sight line), mark (degrees the sight line misses the mark), butt (m, off the pocket)); balance (m, the centre of mass
 * with the load inside the footprint); held (m, how far the body and load's centre stands off the stance's own); laws.
 */
function holdChecks(R, S, H, Mo, { n, frames, loads, rel0, skilled }) {
  const hands = {};
  for (const [side, w] of Object.entries(S.want)) {
    const f = frames[R.boneIndex[`hand${side}`]], hr = handsAtRest(R)[side];
    const t = Mo.G ? Mo.G.t : hr.h, at = add(f.head, mv(f.m, sub(t, hr.wrist)));
    const an = wristFor(R, side, anatomicalForearm(R, n, side), f.m), wr = { flex: r1(an.flex), deviation: r1(an.deviation), twist: r1(an.twist) };
    const stray = Math.hypot(...Object.entries(WRIST_EASE).map(([k, [lo, hi]]) => Math.max(0, lo - wr[k], wr[k] - hi)));
    const out = Math.hypot(...Object.entries(WRIST_RANGE).map(([k, [lo, hi]]) => Math.max(0, lo - wr[k], wr[k] - hi)));
    const hum = humeralTurn(n, side);
    hands[side] = { at: r4(dist(at, w.P)), turn: r1(turnBetween(f.m, w.m)), wrist: wr, stray: r1(stray), inRange: out < 0.5, humerus: r1(hum), elbowOk: hum >= HUMERAL_RANGE[0] - 0.5 && hum <= HUMERAL_RANGE[1] + 0.5, armClear: r4(armClear(R, n, side)) };
  }
  const hS = scaleOf(R); let clearance = Infinity, touching = Infinity;
  const holding = new Set(Object.keys(S.want));
  for (const t of S.placed.things) for (const q of surface(Mo)) {
    const p = worldOf(t.F, q);
    for (const [a, b, r, kind] of CAPSULES) {
      // the hand that holds it, and its forearm, are where it is: not a collision
      if (kind === 'arm' && holding.has(a.slice(-1)) && /^(elbow|wrist)/.test(a)) continue;
      const d = segDist(p, n[a], n[b]) - r * hS;
      // a hugged thing may press the trunk, a rested one the shoulder and the head beside it, a butt the shoulder and the
      // chest round its pocket and a cheek weld the head on the stock
      const nearButt = t.butt && dist(p, t.butt) < 0.25 * hS;   // the stock lies along the shoulder and the chest
      if (H.sight === 'shoulder' && kind === 'head') continue;   // the cheek on the comb: by design
      // the butt plate is in the pocket, where the shoulder meets the chest (inside the capsules that stand for them)
      if (t.butt && dist(p, t.butt) < 0.1 * hS) continue;
      if (H.touch || t.rest || nearButt) { if (kind === 'trunk' || ((t.rest || nearButt) && kind === 'arm') || (t.rest && kind === 'head')) { touching = Math.min(touching, d); continue; } }
      clearance = Math.min(clearance, d);
    }
  }
  let aim = null;
  if (H.sight || H.point) {
    const E = eyeOf(R, n, frames), mark = markOf(n, H.mark);
    aim = { things: S.placed.things.map((t) => {
      if (H.point) { const g = worldOf(t.F, Mo.C.muzzle), back = worldOf(t.F, [0, Mo.C.muzzle[1], 0]); return { mark: r1(angle(sub(g, back), sub(mark, g))) }; }
      const a = worldOf(t.F, [0, Mo.C.sight.y, Mo.C.sight.rear]), b = worldOf(t.F, [0, Mo.C.sight.y, Mo.C.sight.front]), d = unit(sub(b, a)), v = sub(E, a);
      return { eye: r4(len(sub(v, mul(d, dot(v, d))))), mark: r1(angle(d, sub(mark, a))), relief: r3(-dot(v, d)), ...(t.butt ? { butt: r4(dist(worldOf(t.F, Mo.stations.butt.at), pocketOf(R, n))) } : {}) };
    }) };
  }
  const pts = []; for (const s of ['L', 'R']) { const L = R.legs[s]; pts.push(n[L.toeBase], n[L.toeTip]); if (n[L.hock][2] - R.joints[L.hock][2] < 0.02) pts.push(n[L.hock]); }
  const c = comWith(R, n, loads), balance = r4(margin(hull(pts.map((p) => [p[0], p[1]])), c)), rel = sub2(c, baseOf(R, n)), held = r4(Math.hypot(rel[0] - rel0[0], rel[1] - rel0[1]));
  const H2 = Object.values(hands);
  const laws = {
    hands: H2.every((h) => h.at < 0.006 && h.turn < 2), wrist: H2.every((h) => h.inRange), elbow: H2.every((h) => h.elbowOk),
    apart: H2.every((h) => h.armClear > -0.003), clear: clearance > 0.003, ...(touching < Infinity ? { touch: touching > -0.02 } : {}),
    balance: balance > 0.003, ...(skilled ? { held: held < 0.01 } : {}),
    ...(aim ? { aim: aim.things.every((a) => a.mark < 1 && (a.eye === undefined || a.eye < 0.005) && (a.butt === undefined || a.butt < 0.09)) } : {}),
  };
  return { hands, clearance: r4(clearance), ...(touching < Infinity ? { touching: r4(touching) } : {}), aim, balance, held, laws };
}

// ─── the modes ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Carry a thing in a mode: `item` a CARRIED name, `mode` relax | aim, `hands` 1 | 2 | 'dual' (else the first hold the mode
 * has). RELAX solves each candidate hold and keeps the one whose perceived effort plus its style cost is least
 * (`candidates` says what each cost); AIM solves the first hold with the hand config asked. Swords aim with their guards
 * (hero-grip). → heroHold's result, with `candidates` for relax.
 */
export function heroCarry(item, mode, R, { hands, kg, regime = 'skilled', cast } = {}) {
  if (!CARRIED[item]) throw new Error(`hero-carry: nothing called '${item}' (have ${CARRIED_NAMES.join(', ')})`);
  const names = HOLD_NAMES.filter((h) => HOLDS[h].item === item && HOLDS[h].mode === mode && (hands === undefined || HOLDS[h].hands === hands));
  if (!names.length) throw new Error(`hero-carry: no ${mode} hold for '${item}'${hands !== undefined ? ` with hands ${hands}` : ''}`);
  if (mode !== 'relax') return heroHold(names[0], R, { kg, regime, cast });
  const tries = names.map((h) => heroHold(h, R, { kg, regime, cast }));
  const score = (t) => (regime === 'weightless' ? 0 : t.effort.cr10) + (HOLDS[t.name].cost ?? 0);
  const best = tries.reduce((a, b) => (score(b) < score(a) ? b : a));
  return { ...best, candidates: tries.map((t) => ({ name: t.name, cr10: t.effort.cr10, cost: HOLDS[t.name].cost ?? 0, score: r2(score(t)) })) };
}

/** the triangles of a held thing (rig frame) for a card: [{ p: [a, b, c], colour }] — posed by `frames` when given (the
 * thing riding its hand's bone), else as held */
export function carryTriangles(hold, R, frames = null) {
  const out = [];
  for (const t of hold.things) {
    const Mo = modelOf(R, t.item, hold.kg, HOLDS[hold.name]?.bladeGrip); if (Mo.G) continue;   // a blade draws as gear (gearFaces)
    let F = t.F;
    if (frames) { const f = frames[t.ride.boneIndex]; F = { W: mm(f.m, t.ride.W), k: t.ride.k, O: add(f.head, mv(f.m, sub(t.ride.O, f.restHead))) }; }
    for (const [lo, hi, colour] of Mo.C.boxes) {
      const v = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => worldOf(F, [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]));
      for (const [a, b, c, d] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) { out.push({ p: [v[a], v[b], v[c]], colour }); out.push({ p: [v[a], v[c], v[d]], colour }); }
    }
  }
  return out;
}
/** a blade hold's gear mount (hero-gear's shape: for gearFaces), its item at the fist's station */
export function carryMounts(hold, R) {
  return hold.things.filter((t) => CARRIED[t.item].class === 'blade').map((t) => { const Mo = modelOf(R, t.item, hold.kg, HOLDS[hold.name]?.bladeGrip); return { ...Mo.G, o: [0, 0, Mo.st.upper] }; });
}
