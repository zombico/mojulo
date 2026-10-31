/**
 * hero-aura — SHOWCASE POSES ("aura farming"): the standing poses a character strikes to be looked at, and the short
 * performance that lands each one. A pose is said in DESIGN WORDS, never keyed angle by angle, and solved on the rig:
 *
 *   • THE FEET (FOOTINGS: together, abreast, wide, broad, contra, cross, kneeIn, step, crane; or each foot's own place)
 *     and the WEIGHT between them decide the base; the core is carried over it (the rig's `shift`) until the centre of
 *     mass stands at the weight's share of the way from the left foot's contact to the right's (on one foot: over it).
 *     The legs reach their feet: the hips sink until they do. `turn` turns the whole figure (the feet with it) away
 *     from the viewer; `chest` twists the spine back (to its cap), `bend` / `curl` / `hinge` shape the trunk.
 *   • THE EYES (`look`): the neck and head turn and pitch until the face looks where the pose says (the viewer by
 *     default), within the neck's and head's limits; `head` { tilt, pitch } is laid on after (+ tilt to the right
 *     shoulder, + pitch chin up).
 *   • THE HANDS, each where the pose puts it: AT a landmark of the body (the face's eyes, mouth, chin, brow, temples,
 *     ears, crown, nape; the trunk's chest, heart, waist, hip, pocket; the other arm's biceps or elbow) — a trunk or limb
 *     landmark lies on the body's own SURFACE (a radial profile of the skinned mesh about each bone: auraBody), so a
 *     hand on the hip rests on the hip, not in it — or AIMED from the shoulder (`aim` a direction, `reach` a share of the
 *     arm). `by` names the part of the hand that goes there (the palm, the wrist, the knuckles, the index's tip, the V's
 *     fork, the fist's face, the thumb); `palm` and `fingers` say where the palm faces and the fingers point (the wrist
 *     solved for them, inside its range); `shape` the hand's word (SHAPES); `elbow` the way the elbow bends.
 *   • THE PERFORMANCE: the pose is reached through BEATS (each the pose words changed from the one before), from the
 *     stand: a foot that moves STEPS (lifted, carried, set down, the weight over the other first); the last beat is the
 *     HIT, held to the end. A beat may carry the face (the anime channels).
 *
 * Every pose is right-handed; `<name>Left` is its exact mirror. Each gives its clip, its held pose, the face track and
 * its CHECKS (the machine gate): the balance, the legs' reach, the knees over the toes, each hand on its place and
 * facing its way, nothing of a hand or forearm inside the body (a hand resting ON the body excused to its resting
 * depth), the forearms clear of each other, the gaze, and over the clip the planted feet and the fastest hand.
 * Pure and deterministic.
 */
import { rigNodesAt, boneFrames, HAND_POSES } from './station-loft-rig.js';
import { keyedClip, mirrored } from './hero-jump.js';
import { elbowsDown } from './hero-elbow.js';
import { reachArm, comOf, hull, margin } from './hero-stance.js';
import { CANON_HEIGHT } from './hero-canon.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), dist = (a, b) => len(sub(a, b)), unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const angle = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => +x.toFixed(1), r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const mtv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
const yawV = (v, a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const liteOf = (R) => ({ ...R, rides: {}, chains: {}, folds: undefined });

const TWIST_CAP = 35, GLANCE = 75, NECK_TURN = 35, HEAD_TURN = 45, HEAD_PITCH = 40;
const REACH = 0.997;                          // a standing leg's most hip-to-hock reach, a share of femur + tibia (a knee
                                              // all but straight: a showcase stands tall)
const WRIST = { flex: 70, deviation: 30, twist: 90 };   // the wrist's range (hero-gesture RANGE)
const STEP_MOVE = 0.025;                      // a foot moving further than this between beats (× stature) steps

// ─── the hand words ───────────────────────────────────────────────────────────────────────────────────────────────────
/** the hand's shapes: degrees of curl per digit over the relaxed rest (the rig's own words, and the showcase's) */
export const SHAPES = Object.freeze({
  ...HAND_POSES,
  flat: Object.freeze({ thumb: 4, index: -6, middle: -6, ring: -6, little: -6 }),         // a blade: the fingers straight, together
  vee: Object.freeze({ thumb: 40, index: -8, middle: -8, ring: 80, little: 74 }),          // the V: index and middle up, the thumb over the others
  thumb: Object.freeze({ thumb: -18, index: 86, middle: 82, ring: 78, little: 72 }),       // a thumb up: the fist, the thumb out
  claw: Object.freeze({ thumb: 12, index: 38, middle: 36, ring: 38, little: 42 }),         // the splayed, bent fingers of a menacing hand
  gun: Object.freeze({ thumb: -16, index: -8, middle: 82, ring: 76, little: 70 }),         // the finger gun: index out, thumb up
  pinch: Object.freeze({ thumb: 34, index: 46, middle: -4, ring: 10, little: 16 }),        // the thumb meeting the index, the rest loose
  cup: Object.freeze({ thumb: 10, index: 24, middle: 26, ring: 28, little: 30 }),          // a loose cupped hand (a hand at the mouth)
});
export const SHAPE_NAMES = Object.freeze(Object.keys(SHAPES));

// ─── the feet ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The footings: each foot's ball off its rest place, metres at the canonical stature (`out` away from the midline,
 * `fwd` toward the viewer), its toe turned `splay` degrees outward, its heel raised `heel` degrees, a `lift`ed leg
 * ({ hip, knee } degrees: off the floor); `weight` the share on the right foot (0 all on the left, 1 all on the right);
 * `sink` the hips lowered, metres.
 */
export const FOOTINGS = Object.freeze({
  together: { L: { out: -0.016, splay: 4 }, R: { out: -0.016, splay: 4 }, weight: 0.5 },
  abreast: { L: { splay: 8 }, R: { splay: 8 }, weight: 0.5 },
  wide: { L: { out: 0.1, splay: 14 }, R: { out: 0.1, splay: 14 }, weight: 0.5 },
  broad: { L: { out: 0.24, splay: 32 }, R: { out: 0.24, splay: 32 }, weight: 0.5, sink: 0.07 },
  squat: { L: { out: 0.3, splay: 40 }, R: { out: 0.3, splay: 40 }, weight: 0.5, sink: 0.2 },
  // contrapposto: the weight on the left, the right foot a little forward and out, its knee easing
  contra: { L: { out: -0.01, splay: 10 }, R: { out: 0.05, fwd: 0.1, splay: 26 }, weight: 0.18 },
  // the right foot crossed over in front of the left, on its ball
  cross: { L: { out: 0.01, fwd: -0.02, splay: 14 }, R: { out: -0.1, fwd: 0.12, splay: -8, heel: 16 }, weight: 0.35 },
  // the right knee bent in before the left, its foot on the toes (a magical girl's)
  kneeIn: { L: { out: 0.01, splay: 12 }, R: { out: -0.05, fwd: 0.07, splay: -14, heel: 46 }, weight: 0.12 },
  // a step toward the viewer with the right, the left turned out behind
  step: { L: { out: 0.02, fwd: -0.14, splay: 34 }, R: { out: 0.03, fwd: 0.2, splay: 6 }, weight: 0.45 },
  // the right leg drawn up, the left alone on the floor
  crane: { L: { out: -0.02, splay: 10 }, R: { lift: { hip: 78, knee: 96, yaw: -8 } }, weight: 0 },
});
export const FOOTING_NAMES = Object.freeze(Object.keys(FOOTINGS));

// ─── the body: its surface about each bone, and the face's landmarks ──────────────────────────────────────────────────
const PROFILE_BONES = ['pelvis', 'lumbar', 'torso', 'neck', 'head', 'bustL', 'bustR', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'thighL', 'thighR'];
const NT = 8, NA = 16, T0 = -0.1, T1 = 1.1;
const NOT_BODY = /^(hair|hand|thumb|index|middle|ring|little|iris|pupil|lash|lid)/;
/** the radii (m, canonical stature) a body without a mesh is drawn with: each bone a round capsule */
const ROUND = { pelvis: 0.14, lumbar: 0.11, torso: 0.12, neck: 0.05, head: 0.11, upperArmL: 0.05, upperArmR: 0.05, foreArmL: 0.035, foreArmR: 0.035, thighL: 0.11, thighR: 0.11 };
/** the face's landmarks on the canonical anime head, metres off the head's base (x right, y front, z up) */
const FACE = { eyeR: [0.043, 0.101, 0.071], eyeL: [-0.043, 0.101, 0.071], nose: [0, 0.118, 0.029], mouth: [0, 0.108, -0.006], chin: [0, 0.094, -0.04], brow: [0, 0.1, 0.11], templeR: [0.085, 0.06, 0.09], templeL: [-0.085, 0.06, 0.09], earR: [0.102, 0.024, 0.048], earL: [-0.102, 0.024, 0.048], crown: [0, 0, 0.21], nape: [0, -0.075, 0.0], backHead: [0, -0.11, 0.07] };
const HEAD_LEN = 0.127;   // the canonical anime head's base → top

function boneAxes(R, id) {
  const b = R.bones[R.boneIndex[id]], a = R.joints[b.head], z = R.joints[b.tail], ax = sub(z, a), L = len(ax), u = mul(ax, 1 / L);
  const e1 = unit(sub([0, 1, 0], mul(u, u[1]))); let e2 = sub(sub([1, 0, 0], mul(u, u[0])), mul(e1, e1[0])); e2 = unit(e2);
  return { a, u, L, e1, e2 };
}
/**
 * The body a pose rests on: per bone its surface as a radial profile (NT steps along the bone × NA round it, each the
 * most the skinned vertices it carries stand off its axis; the hair, the hands and the eyes left out), and the face's
 * landmarks from the head's own parts. Without a mesh: round capsules and the canonical face scaled to the head.
 */
export function auraBody(R, mesh = null, skin = null) {
  const prof = {};
  for (const id of PROFILE_BONES) {
    if (R.boneIndex[id] === undefined) continue; const A = boneAxes(R, id); const bins = Array.from({ length: NT * NA }, () => []);
    if (mesh) mesh.vertices.forEach((v, i) => {
      if (skin.dominant[i] !== R.boneIndex[id] || NOT_BODY.test(mesh.provenance[i].part)) return;
      const d0 = sub(v, A.a), t = dot(d0, A.u) / A.L, d = sub(d0, mul(A.u, t * A.L));
      const ti = clamp(Math.floor(((t - T0) / (T1 - T0)) * NT), 0, NT - 1), ai = ((Math.round((Math.atan2(dot(d, A.e2), dot(d, A.e1)) / (2 * Math.PI)) * NA) % NA) + NA) % NA;
      bins[ti * NA + ai].push(len(d));
    });
    const s = heightOf(R) / CANON_HEIGHT;
    let r = bins.map((b) => (b.length ? b.sort((x, y) => x - y)[Math.floor(0.95 * (b.length - 1))] : null));
    if (r.every((x) => x === null)) { if (mesh || !ROUND[id]) continue; r = r.map(() => ROUND[id] * s); }
    for (let pass = 0; pass < 2 * (NT + NA) && r.some((x) => x === null); pass++) r = r.map((x, k) => { if (x !== null) return x; const ti = Math.floor(k / NA), ai = k % NA; const nb = [[ti, ai - 1], [ti, ai + 1], [ti - 1, ai], [ti + 1, ai]].filter(([i]) => i >= 0 && i < NT).map(([i, j]) => r[i * NA + ((j + NA) % NA)]).filter((y) => y !== null); return nb.length ? nb.reduce((p, q) => p + q, 0) / nb.length : null; });
    prof[id] = { ...A, r };
  }
  const hb = R.joints.headBase, hs = (R.joints.headTop[2] - hb[2]) / HEAD_LEN;
  const face = Object.fromEntries(Object.entries(FACE).map(([k, v]) => [k, add(hb, mul(v, hs))]));
  if (mesh) {
    const by = {}; mesh.vertices.forEach((v, i) => { const p = mesh.provenance[i].part; (by[p] ||= []).push(v); });
    const c = (a) => mul(a.reduce((p, q) => add(p, q), [0, 0, 0]), 1 / a.length);
    if (by.irisR && by.irisL) { face.eyeR = c(by.irisR); face.eyeL = c(by.irisL); }
    if (by.noseLine) { const n = c(by.noseLine); face.nose = n; face.mouth = add(n, [0, -0.01 * hs, -0.035 * hs]); face.chin = add(n, [0, -0.024 * hs, -0.069 * hs]); }
    if (by.browR && by.browL) face.brow = mul(add(c(by.browR), c(by.browL)), 0.5);
    if (by.earR && by.earL) { face.earR = c(by.earR); face.earL = c(by.earL); }
  }
  return { prof, face, s: heightOf(R) / CANON_HEIGHT };
}
const heightOf = (R) => R.joints.headTop?.[2] ?? CANON_HEIGHT;
const bodyCache = new WeakMap();
const bodyFor = (R, body) => body ?? (bodyCache.get(R) || (bodyCache.set(R, auraBody(R)), bodyCache.get(R)));

/** a profile's radius at (t, θ) (bilinear over its bins) */
function radiusAt(P, t, th) {
  const x = clamp(((t - T0) / (T1 - T0)) * NT - 0.5, 0, NT - 1), y = ((th / (2 * Math.PI)) * NA + NA) % NA;
  const i0 = Math.floor(x), i1 = Math.min(NT - 1, i0 + 1), fx = x - i0, j0 = Math.floor(y) % NA, j1 = (j0 + 1) % NA, fy = y - Math.floor(y);
  const g = (i, j) => P.r[i * NA + j];
  return lerp(lerp(g(i0, j0), g(i0, j1), fy), lerp(g(i1, j0), g(i1, j1), fy), fx);
}
/** how deep a posed point lies inside a bone's surface (m; − outside), the bone posed by its frame */
function depthIn(P, F, p) {
  const q = add(F.restHead, mtv(F.m, sub(p, F.head))); const d0 = sub(q, P.a), t = dot(d0, P.u) / P.L, d = sub(d0, mul(P.u, t * P.L));
  const r = radiusAt(P, clamp(t, 0, 1), Math.atan2(dot(d, P.e2), dot(d, P.e1)));
  const over = t < 0 ? -t * P.L : t > 1 ? (t - 1) * P.L : 0;
  return r - Math.hypot(len(d), over);
}
/** the way out of a posed bone's surface at a point (world): straight away from its axis */
function outOf(P, F, p) {
  const q = add(F.restHead, mtv(F.m, sub(p, F.head))); const d0 = sub(q, P.a), t = clamp(dot(d0, P.u) / P.L, 0, 1);
  return unit(mv(F.m, sub(q, add(P.a, mul(P.u, t * P.L)))));
}
/** a point on a posed bone's surface at (t, θ degrees: 0 its front, + toward the figure's right) and its outward normal */
function surfaceAt(P, F, t, thDeg) {
  const th = rad(thDeg), dir = add(mul(P.e1, Math.cos(th)), mul(P.e2, Math.sin(th)));
  const q = add(add(P.a, mul(P.u, t * P.L)), mul(dir, radiusAt(P, t, th)));
  return { p: add(F.head, mv(F.m, sub(q, F.restHead))), n: unit(mv(F.m, dir)) };
}

/** the trunk's and the limbs' landmarks: [bone, t along it, θ round it (+ toward the figure's right; a `<S>` mark's
 * angle is its side's: negated on the left)] */
const SURFACE = {
  chest: ['torso', 0.5, 0], heart: ['torso', 0.5, -26], solar: ['torso', 0.12, 0], belly: ['lumbar', 0.5, 0],
  waist: ['lumbar', 0.62, 100], hip: ['pelvis', 0.4, 78], pocket: ['thigh', 0.14, 26], collar: ['torso', 0.92, 40],
  biceps: ['upperArm', 0.5, 80], bicepsFront: ['upperArm', 0.45, 20], elbow: ['foreArm', 0.04, 180], forearm: ['foreArm', 0.5, 0],
};
const HEAD_MARKS = new Set(Object.keys(FACE));

// ─── the solve ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** the feet of a state: each ball (toe base) on the floor, the splays, heels, a lifted leg, the weight, the sink */
function footing(W, R, s) {
  const F = typeof W.feet === 'string' ? FOOTINGS[W.feet] : W.feet ?? FOOTINGS.abreast;
  if (!F) throw new Error(`hero-aura: no footing '${W.feet}' (have ${FOOTING_NAMES.join(', ')})`);
  const turn = W.turn ?? 0, out = {};
  for (const S of ['L', 'R']) {
    const f = F[S] ?? {}, L = R.legs[S], side = S === 'R' ? 1 : -1, rest = R.joints[L.toeBase];
    const ball = yawV([rest[0] + side * (f.out ?? 0) * s, rest[1] + (f.fwd ?? 0) * s, 0], turn);
    // splay<S> turns the toe outward; the figure's turn (counter-clockwise) adds on the left, takes off on the right
    out[S] = { ball: [ball[0], ball[1]], splay: (f.splay ?? 0) + side * -turn, heel: f.heel ?? 0, lift: f.lift ?? null };
  }
  return { ...out, weight: W.weight ?? F.weight ?? 0.5, sink: (W.sink ?? F.sink ?? 0) * s };
}

/** a direction word in the world (the viewer at +y): resolved for a hand on side S in the posed context */
function dirOf(w, S, C) {
  if (Array.isArray(w)) return unit(w.reduce((p, x) => add(p, typeof x === 'number' ? [0, 0, 0] : dirOf(x, S, C)), [0, 0, 0]));
  if (isObj(w) && 'x' in w) return unit([w.x ?? 0, w.y ?? 0, w.z ?? 0]);
  const side = S === 'R' ? 1 : -1, f = C.facing;
  switch (w) {
    case 'viewer': return [0, 1, 0]; case 'away': return [0, -1, 0]; case 'up': return [0, 0, 1]; case 'down': return [0, 0, -1];
    case 'fwd': return yawV([0, 1, 0], f); case 'back': return yawV([0, -1, 0], f);
    case 'out': return yawV([side, 0, 0], f); case 'in': return yawV([-side, 0, 0], f);
    case 'right': return yawV([1, 0, 0], f); case 'left': return yawV([-1, 0, 0], f);
    case 'face': return unit(sub(C.headC, C.handAt ?? C.n[`wrist${S}`]));
    case 'surface': return mul(C.normal ?? [0, 0, 1], -1); case 'normal': return C.normal ?? [0, 0, 1];
    case 'headFwd': return C.headFwd; case 'headUp': return C.headUp; case 'headOut': return mul(C.headRight, side);
    case 'aim': return C.aim ?? [0, 1, 0];
    default: throw new Error(`hero-aura: no direction '${w}'`);
  }
}

/** the hand's frame: along it to the middle knuckle (u), across toward the thumb (v), out of the palm */
function handFrame(n, S) {
  const u = unit(sub(n[`middleMcp${S}`], n[`wrist${S}`])), v0 = sub(n[`indexMcp${S}`], n[`littleMcp${S}`]), v = unit(sub(v0, mul(u, dot(v0, u))));
  return { u, v, palm: S === 'R' ? cross(v, u) : cross(u, v) };
}
/** the points of the hand a pose places */
function handPoint(n, S, by) {
  const H = handFrame(n, S), mid = (...ks) => mul(ks.reduce((p, k) => add(p, n[`${k}${S}`]), [0, 0, 0]), 1 / ks.length);
  switch (by ?? 'palm') {
    case 'wrist': return n[`wrist${S}`];
    case 'palm': return add(lerp3(n[`wrist${S}`], n[`middleMcp${S}`], 0.55), mul(H.palm, 0.012));
    case 'back': return add(lerp3(n[`wrist${S}`], n[`middleMcp${S}`], 0.55), mul(H.palm, -0.014));
    case 'knuckles': return n[`middleMcp${S}`];
    case 'fist': return mid('indexPip', 'middlePip', 'ringPip');
    case 'tip': return n[`indexTip${S}`];
    case 'vee': return mid('indexTip', 'middleTip');
    case 'thumb': return n[`thumbTip${S}`];
    case 'fingers': return mid('indexDip', 'middleDip', 'ringDip');
    default: throw new Error(`hero-aura: no hand point '${by}'`);
  }
}

/** the hand frame (u, palm) in the forearm's rest frame for wrist angles: measured once per rig and angle */
const frameCache = new WeakMap();
function wristFrame(R, S, w) {
  let c = frameCache.get(R); if (!c) frameCache.set(R, (c = new Map()));
  const k = `${S}${w[0]},${w[1]},${w[2]}`; let f = c.get(k);
  if (!f) { const n = rigNodesAt(R, { [`wrist${S}`]: { flex: w[0], deviation: w[1], twist: w[2] } }).nodes; const H = handFrame(n, S); f = { u: H.u, palm: H.palm }; c.set(k, f); }
  return f;
}
/** the wrist that points the fingers and turns the palm where asked (either may be left out), the forearm posed by M */
function solveWrist(R, S, M, want, seed = null) {
  if (!want.u && !want.palm) return null;
  const cost = (w) => { const f = wristFrame(R, S, w); let c = 0; if (want.u) c += angle(mv(M, f.u), want.u) ** 2; if (want.palm) c += angle(mv(M, f.palm), want.palm) ** 2; return c + 0.002 * (w[0] ** 2 + w[1] ** 2 + w[2] ** 2); };
  // seeded (the arm's last pass): refined from there only, so the hand never flips across the wrist's range between passes
  let best = seed ? { x: [seed.flex, seed.deviation, seed.twist], c: cost([seed.flex, seed.deviation, seed.twist]) } : null;
  if (!seed) for (let a = -70; a <= 70; a += 14) for (let b = -30; b <= 30; b += 10) for (let t = -90; t <= 90; t += 15) { const c = cost([a, b, t]); if (!best || c < best.c) best = { x: [a, b, t], c }; }
  const lim = [WRIST.flex, WRIST.deviation, WRIST.twist];
  for (const st of [6, 3, 1]) { let moved = true; while (moved) { moved = false; for (let i = 0; i < 3; i++) for (const sg of [1, -1]) { const x = [...best.x]; x[i] = clamp(x[i] + sg * st, -lim[i], lim[i]); const c = cost(x); if (c < best.c - 1e-9) { best = { x, c }; moved = true; } } } }
  return { flex: best.x[0], deviation: best.x[1], twist: best.x[2] };
}

const POLES = { down: [0.25, 0, -1], out: [1, -0.15, -0.35], back: [0.35, -1, -0.3], fwd: [0.2, 1, -0.4], up: [0.4, 0, 1], in: [-0.6, 0.3, -0.6], outUp: [1, 0, 0.4] };

/**
 * A state solved on the rig: the trunk, the feet, the balance, the gaze, then each hand (its goal from its landmark on
 * the posed body, the arm reaching it seeded from the last state's, the wrist turning the hand, the hand's point
 * brought onto the goal), then the balance again with the arms. → { key (a keyedClip key without t), pose, goals,
 * want, contact, foot }.
 */
function solveState(W, R, B, prev) {
  const s = B.s, ft = footing(W, R, s), lite = liteOf(R);
  const facing = (W.turn ?? 0) + (W.facing ?? 0);
  let pose = {
    facing, hinge: W.hinge ?? 0, splayL: ft.L.splay, splayR: ft.R.splay, heelL: -ft.L.heel, heelR: -ft.R.heel,
    spine: { sagittal: W.curl ?? 0, lateral: W.bend ?? 0, axial: clamp((W.chest ?? 0) / TWIST_CAP, -1, 1) },
    ...(W.shoulders ? { shoulders: W.shoulders } : {}),
  };
  for (const S of ['L', 'R']) if (ft[S].lift) pose[`hip${S}`] = { pitch: ft[S].lift.hip, yaw: (S === 'R' ? 1 : -1) * (ft[S].lift.yaw ?? 0), roll: 0 }, pose[`knee${S}`] = ft[S].lift.knee;
  const planted = ['L', 'R'].filter((S) => !ft[S].lift);
  const feetOf = () => Object.fromEntries(planted.map((S) => [S, [ft[S].ball[0], ft[S].ball[1], R.joints[R.legs[S].toeBase][2]]]));
  let shift = { x: 0, y: 0 }, sink = ft.sink, arms = {};
  const full = (extra = {}) => elbowsDown(R, { ...pose, ...arms, ...extra, shift, sink, support: 'none', feet: feetOf() });
  // the legs reach: the sink deepened until both planted legs reach their feet
  const reachOK = (n) => planted.every((S) => { const L = R.legs[S], J = R.joints; const reach = REACH * (dist(J[L.knee], J[L.hip]) + dist(J[L.hock], J[L.knee])); const a = rad(ft[S].heel); const hv0 = sub(J[L.hock], J[L.toeBase]); const hv = [hv0[0], hv0[1] * Math.cos(a) - hv0[2] * Math.sin(a), hv0[1] * Math.sin(a) + hv0[2] * Math.cos(a)]; return dist(add([ft[S].ball[0], ft[S].ball[1], J[L.toeBase][2]], hv), n[L.hip]) <= reach; });
  const settleSink = () => { for (let i = 0; i < 60; i++) { const n = rigNodesAt(lite, { ...full(), support: 'none', feet: {} }).nodes; if (reachOK(n)) return; sink += 0.004 * s; } };
  // the balance: the core carried until the centre of mass stands at the weight's share between the feet's contacts
  const contactC = (n, S) => { const L = R.legs[S], a = n[L.toeBase], b = ft[S].heel > 5 ? n[L.toeTip] : n[L.hock]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const balance = () => {
    for (let i = 0; i < 6; i++) {
      settleSink(); const n = rigNodesAt(R, full()).nodes; const c = comOf(n);
      const want = planted.length === 2 ? (() => { const a = contactC(n, 'L'), b = contactC(n, 'R'); return [lerp(a[0], b[0], ft.weight), lerp(a[1], b[1], ft.weight)]; })() : contactC(n, planted[0]);
      shift = { x: shift.x + want[0] - c[0], y: shift.y + want[1] - c[1] };
    }
    settleSink();
  };
  // the gaze: the neck and head turned and pitched until the face looks where asked; the tilt and pitch laid on after
  const look = W.look ?? 'viewer';
  const lookDir = look === 'viewer' ? [0, 1, 0] : isObj(look) ? yawV([0, Math.cos(rad(look.pitch ?? 0)), Math.sin(rad(look.pitch ?? 0))], look.turn ?? 0) : dirOf(look, 'R', { facing });
  let seen = lookDir;
  const gaze = () => {
    let turnT = 0, pitch = 0;
    for (let i = 0; i < 5; i++) {
      const hw = turnT <= GLANCE && turnT >= -GLANCE ? { glance: turnT } : { neck: { turn: Math.sign(turnT) * NECK_TURN }, head: { turn: Math.sign(turnT) * Math.min(HEAD_TURN, Math.abs(turnT) - NECK_TURN) } };
      pose = { ...pose, glance: undefined, neck: undefined, ...hw, head: { ...(hw.head ?? {}), pitch: clamp(pitch, -HEAD_PITCH, HEAD_PITCH) } };
      const n = rigNodesAt(R, full()).nodes; const F = boneFrames(R, R.joints, n)[R.boneIndex.head]; const f = [F.m[0][1], F.m[1][1], F.m[2][1]];
      const dy = deg(Math.atan2(lookDir[1], lookDir[0]) - Math.atan2(f[1], f[0])); turnT = clamp(turnT + (((dy + 540) % 360) - 180), -(NECK_TURN + HEAD_TURN), NECK_TURN + HEAD_TURN);
      pitch += deg(Math.asin(clamp(lookDir[2], -1, 1)) - Math.asin(clamp(f[2], -1, 1)));
    }
    pose = { ...pose, head: { ...pose.head, pitch: clamp((pose.head.pitch ?? 0) + (W.head?.pitch ?? 0), -HEAD_PITCH, HEAD_PITCH), yaw: W.head?.tilt ?? 0 } };
    if (W.head?.pitch) { const e = Math.asin(clamp(lookDir[2], -1, 1)) + rad(W.head.pitch), az = Math.atan2(lookDir[1], lookDir[0]); seen = [Math.cos(e) * Math.cos(az), Math.cos(e) * Math.sin(az), Math.sin(e)]; } else seen = lookDir;
    for (const k of ['glance', 'neck']) if (pose[k] === undefined) delete pose[k];
  };
  balance(); gaze();
  // the hands
  const hands = W.hands ?? {}, goals = {}, want = {}, contact = {}, tuck = {};
  const ctxOf = (n) => { const F = boneFrames(R, R.joints, n), hF = F[R.boneIndex.head]; const col = (k) => [hF.m[0][k], hF.m[1][k], hF.m[2][k]]; return { n, F, facing, headC: add(hF.head, mv(hF.m, sub(lerp3(R.joints.headBase, R.joints.headTop, 0.45), hF.restHead))), headFwd: col(1), headUp: col(2), headRight: col(0) }; };
  const markOf = (at, C, h = {}) => {
    if (HEAD_MARKS.has(at)) {
      const hF = C.F[R.boneIndex.head], p = add(hF.head, mv(hF.m, sub(B.face[at], hF.restHead)));
      const nrm = /^(temple|ear)R/.test(at) ? C.headRight : /^(temple|ear)L/.test(at) ? mul(C.headRight, -1) : at === 'crown' ? C.headUp : /^(nape|backHead)$/.test(at) ? mul(C.headFwd, -1) : C.headFwd;
      return { p, n: nrm, bone: 'head' };
    }
    const m = /^(\w+?)([LR])?$/.exec(at); const base = m[1], S = m[2]; const def = SURFACE[base] ?? SURFACE[at];
    if (!def) throw new Error(`hero-aura: no landmark '${at}' (have ${[...HEAD_MARKS, ...Object.keys(SURFACE).map((k) => `${k}[L|R]`)].join(', ')})`);
    const bone = ['upperArm', 'foreArm', 'thigh'].includes(def[0]) ? `${def[0]}${S ?? 'R'}` : def[0];
    const P = B.prof[bone]; if (!P) throw new Error(`hero-aura: the body has no '${bone}' to rest on`);
    const th = (S === 'L' ? -1 : 1) * (h.round ?? def[2]);
    return { ...surfaceAt(P, C.F[R.boneIndex[bone]], h.along ?? def[1], th), bone };
  };
  const goalOf = (S, h, C) => {
    const side = S === 'R' ? 1 : -1, off = h.off ? yawV([side * (h.off[0] ?? 0) * s, (h.off[1] ?? 0) * s, (h.off[2] ?? 0) * s], facing) : [0, 0, 0];
    if (h.aim) { const d = dirOf(h.aim, S, C), sh = C.n[`shoulder${S}`]; const J = R.joints, arm = dist(J[`shoulder${S}`], J[`elbow${S}`]) + dist(J[`elbow${S}`], J[`wrist${S}`]); return { g: add(add(sh, mul(d, (h.reach ?? 0.95) * arm)), off), aim: d, normal: null, bone: null }; }
    const M = markOf(h.at, C, h); const gap = (h.gap ?? (M.bone === 'head' ? 0.01 : 0.004)) * s;
    return { g: add(add(M.p, mul(M.n, gap)), off), normal: M.n, bone: M.bone };
  };
  // the arms in order: one whose landmark lies on the other arm after it (the other arm placed first)
  const order = ['R', 'L'].filter((S) => hands[S]).sort((a, b) => (/(biceps|elbow|forearm)/.test(hands[a].at ?? '') ? 1 : 0) - (/(biceps|elbow|forearm)/.test(hands[b].at ?? '') ? 1 : 0));
  const passes = order.some((S) => /(biceps|elbow|forearm)/.test(hands[S].at ?? '')) ? 3 : 1;
  for (const S of ['L', 'R']) if (!hands[S]) arms = { ...arms, ...restArm(S, W, prev) };
  const solveArms = () => {
    for (let pass = 0; pass < passes; pass++) for (const S of order) {
      const h = hands[S], side = S === 'R' ? 1 : -1;
      const pole = h.elbow ? yawV(Array.isArray(h.elbow) ? [side * h.elbow[0], h.elbow[1], h.elbow[2]] : [side * POLES[h.elbow][0], POLES[h.elbow][1], POLES[h.elbow][2]], facing) : null;
      const shape = typeof h.shape === 'string' ? SHAPES[h.shape] : h.shape ?? SHAPES.relaxed; if (!shape) throw new Error(`hero-aura: no hand shape '${h.shape}' (have ${SHAPE_NAMES.join(', ')})`);
      arms[`fingers${S}`] = { ...shape };
      let seed = arms[`sh${S}`] && (pass > 0 || prev) ? { sh: arms[`sh${S}`], elbow: arms[`elbow${S}`] } : prev?.arms?.[S] ?? null;
      const bodyLess = () => { const b = full(); delete b[`sh${S}`]; delete b[`elbow${S}`]; return b; };
      for (let it = 0; it < 5; it++) {
        // the wrist sent where the hand's point (as the hand now sits on its wrist) lands on the goal
        const n = rigNodesAt(R, full()).nodes, G = goalOf(S, h, ctxOf(n)), off = sub(handPoint(n, S, h.by), n[`wrist${S}`]), wg = sub(G.g, off);
        // seeded from where the arm was (no flip between beats) unless a fresh search reaches clearly better
        let a = seed ? reachArm(R, bodyLess(), S, wg, seed, pole ? { pole } : {}) : null;
        if (!a || (a.err > 0.01 && it === 0)) { const c = reachArm(R, bodyLess(), S, wg, null, pole ? { pole } : {}); if (!a || c.err < a.err - 0.005) a = c; }
        arms[`sh${S}`] = a.sh; arms[`elbow${S}`] = a.elbow; seed = { sh: a.sh, elbow: a.elbow };
        // the wrist: the hand turned to its words, in the forearm's posed frame
        const n2 = rigNodesAt(R, full()).nodes, C2 = { ...ctxOf(n2), normal: G.normal, aim: G.aim, handAt: G.g };
        const wnt = { u: h.fingers ? dirOf(h.fingers, S, C2) : null, palm: h.palm ? dirOf(h.palm, S, C2) : null };
        const w = solveWrist(R, S, boneFrames(R, R.joints, n2)[R.boneIndex[`foreArm${S}`]].m, wnt, it > 0 ? arms[`wrist${S}`] : null); if (w) arms[`wrist${S}`] = w; else delete arms[`wrist${S}`];
        want[S] = wnt; goals[S] = G.g; contact[S] = [...(G.bone && h.touch !== false ? [G.bone] : []), ...(h.rests ?? [])]; tuck[S] = h.tuck ?? 0;
        const n3 = rigNodesAt(R, full()).nodes; if (dist(handPoint(n3, S, h.by), goalOf(S, h, ctxOf(n3)).g) < 0.003) break;
      }
      // the POLISH: the arm moved on the hand's own point (the wrist as it is), then the wrist re-turned from there
      for (let round = 0; round < 2; round++) {
        const G = goalOf(S, h, ctxOf(rigNodesAt(R, full()).nodes));
        const cost = (x) => dist(handPoint(rigNodesAt(R, full({ [`sh${S}`]: { pitch: x[0], yaw: x[1], roll: x[2] }, [`elbow${S}`]: x[3] })).nodes, S, h.by), G.g);
        const sh = arms[`sh${S}`]; let best = { x: [sh.pitch, sh.yaw, sh.roll ?? 0, arms[`elbow${S}`]] }; best.c = cost(best.x);
        if (best.c < 0.003) break;
        for (const st of [4, 2, 1, 0.5]) { let moved = true; while (moved) { moved = false; for (let i = 0; i < 4; i++) for (const sg of [1, -1]) { const x = [...best.x]; x[i] += sg * st; x[3] = clamp(x[3], 0, 150); const c = cost(x); if (c < best.c - 1e-6) { best = { x, c }; moved = true; } } } }
        arms[`sh${S}`] = { pitch: r1(best.x[0]), yaw: r1(best.x[1]), roll: r1(best.x[2]) }; arms[`elbow${S}`] = r1(best.x[3]);
        const n2 = rigNodesAt(R, full()).nodes, C2 = { ...ctxOf(n2), normal: G.normal, aim: G.aim, handAt: G.g };
        const wnt = { u: h.fingers ? dirOf(h.fingers, S, C2) : null, palm: h.palm ? dirOf(h.palm, S, C2) : null };
        const w = solveWrist(R, S, boneFrames(R, R.joints, n2)[R.boneIndex[`foreArm${S}`]].m, wnt, arms[`wrist${S}`] ?? null); if (w) arms[`wrist${S}`] = w;
        want[S] = wnt; goals[S] = G.g;
      }
    }
  };
  solveArms(); balance(); gaze(); solveArms();
  const key = {
    pose: { ...pose, ...arms, shift: { x: r4(shift.x), y: r4(shift.y) } }, sink: r4(sink),
    ...Object.fromEntries(['L', 'R'].flatMap((S) => { const L = R.legs[S], rest = R.joints[L.toeBase], sg = Math.sign(R.joints[L.hip][0]); return [[`out${S}`, r4((ft[S].ball[0] - rest[0]) * sg)], [`foot${S}`, r4(ft[S].ball[1] - rest[1])], [`heel${S}`, ft[S].heel], [`ground${S}`, ft[S].lift ? 0 : 1]]; })),
  };
  for (const S of ['L', 'R']) { delete key.pose[`heel${S}`]; }
  return { key, goals, want, contact, tuck, by: Object.fromEntries(Object.entries(hands).map(([S, h]) => [S, h.by ?? 'palm'])), feet: ft, lookDir: seen, arms: Object.fromEntries(['L', 'R'].filter((S) => arms[`sh${S}`]).map((S) => [S, { sh: arms[`sh${S}`], elbow: arms[`elbow${S}`] }])) };
}
/** a hand the state leaves out hangs at the side, a little off the thigh (or keeps the last state's place: `keep`) */
function restArm(S, W, prev) {
  if (W.hands?.[S] === undefined && prev?.key?.pose?.[`sh${S}`] && W.keep !== false) { const p = prev.key.pose; return { [`sh${S}`]: p[`sh${S}`], [`elbow${S}`]: p[`elbow${S}`], ...(p[`wrist${S}`] ? { [`wrist${S}`]: p[`wrist${S}`] } : {}), [`fingers${S}`]: p[`fingers${S}`] }; }
  return { [`sh${S}`]: { pitch: -4, yaw: S === 'R' ? 6 : -6, roll: 0 }, [`elbow${S}`]: 12, [`fingers${S}`]: { ...SHAPES.relaxed } };
}

// ─── the poses ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The showcase poses, every one right-handed (its `Left` the mirror). `beats` in order, each { at (a share of the
 * clip), ...words changed from the beat before }; the last is the hit, held to the end. `family` sorts them: `aura`
 * (the haughty and the cool), `jojo` (the bizarre: the poses of JoJo's Bizarre Adventure's cast), `squad` (the
 * team-roll-call: super sentai, the Ginyu Force), `meme`. `after` names what the pose is after (never the drawing).
 * The words of a beat:
 *   feet (FOOTINGS or { L, R, weight, sink }), weight, sink, turn (the figure, degrees + to its left), facing (the
 *   body over its feet), chest (the spine's twist, degrees + left), bend (the spine aside, + right, −1 … 1), curl (+
 *   forward, − arched), hinge (degrees, at the hips), look ('viewer' | a direction | { turn, pitch }), head { tilt,
 *   pitch }, hands { R, L } each { at | aim, reach, by, off [out, fwd, up] (m), gap, shape, palm, fingers, elbow },
 *   face (the anime channels: blink, smile, open, brow).
 */
/** the hand words a pose reuses: a hand on its hip (palm on the waist, fingers forward and down, elbow out), a fist on
 * it, a hand in its pocket (its wrist and forearm against the hip it hangs by: a rounded flank meets them), a fist
 * chambered at the hip */
const ONHIP = (S) => ({ at: `waist${S}`, along: 0.8, round: 90, by: 'palm', gap: 0.02, shape: 'flat', palm: 'surface', fingers: ['fwd', 'down'], elbow: 'out', rests: ['pelvis'] });
const FISTHIP = (S) => ({ at: `waist${S}`, by: 'fist', shape: 'fist', elbow: 'out', gap: 0.025 });
const POCKET = (S) => ({ at: `pocket${S}`, by: 'fingers', gap: -0.01, tuck: 0.045, shape: 'relaxed', palm: 'surface', rests: ['pelvis'] });
const CHAMBER = (S) => ({ at: `hip${S}`, off: [0.02, 0.1, 0.05], by: 'fist', shape: 'fist', palm: 'up', elbow: 'back', touch: false, rests: ['pelvis', 'lumbar'] });
export const AURAS = Object.freeze({
  // ── AURA: the haughty, the stoic, the cool ──
  hairToss: {
    family: 'aura', after: 'the haughty young lady: a hand lifting the hair off the shoulder and flicking it back, chin up, looking down the nose', seconds: 1.8,
    beats: [
      { at: 0.28, name: 'lift', feet: 'contra', head: { tilt: 6, pitch: -4 }, hands: { R: { at: 'collarR', off: [0.02, 0.06, 0.03], by: 'fingers', shape: 'cup', palm: 'up', elbow: 'out', touch: false, rests: ['torso', 'bustR'] }, L: ONHIP('L') }, face: { blink: 0.2 } },
      { at: 0.5, name: 'flick', bend: -0.12, chest: -8, head: { tilt: -10, pitch: 14 }, hands: { R: { at: 'earR', off: [0.07, -0.02, 0.06], by: 'fingers', shape: 'open', palm: 'back', elbow: 'out', touch: false } } },
      { at: 0.66, name: 'haughty', look: { turn: -18, pitch: -6 }, hands: { R: { at: 'earR', off: [0.12, 0.02, 0.1], by: 'palm', shape: 'open', palm: 'up', elbow: 'down', touch: false } }, face: { blink: 0.45, smile: 0.35, brow: 0.3 } },
    ],
    gaze: 14,
  },
  ojouLaugh: {
    family: 'aura', after: 'the ojou-sama laugh: the back of a hand at the mouth, the fingers up, the chin raised, the other hand on the hip', seconds: 1.5,
    beats: [
      { at: 0.4, name: 'raise', feet: 'contra', hands: { L: ONHIP('L'), R: { at: 'chin', off: [0.07, 0.1, -0.06], by: 'palm', shape: 'flat', palm: 'fwd', elbow: 'down', touch: false } } },
      { at: 0.58, name: 'ohoho', bend: -0.1, head: { tilt: -6, pitch: 18 }, hands: { R: { at: 'mouth', off: [0.05, 0.05, 0.0], by: 'back', shape: 'cup', fingers: ['up', 'in'], elbow: 'down', touch: false } }, face: { blink: 0.6, smile: 0.9, open: 0.5, brow: 0.3 } },
    ],
    gaze: 20,
  },
  fistCrush: {
    family: 'aura', after: 'the threat: the head tilted, an open hand held out palm up, then crushed into a fist and pumped down', seconds: 2,
    beats: [
      { at: 0.32, name: 'offer', feet: 'abreast', head: { tilt: 16 }, hands: { R: { aim: ['viewer', 'down'], reach: 0.72, by: 'palm', shape: 'open', palm: 'up', fingers: 'viewer', elbow: 'down' } }, face: { smile: 0.35, blink: 0.25 } },
      { at: 0.55, name: 'crush', hands: { R: { aim: ['viewer', 'down'], reach: 0.7, by: 'palm', shape: 'fist', palm: 'up', fingers: 'viewer', elbow: 'down' } }, face: { smile: 0.1, brow: -0.6 } },
      { at: 0.7, name: 'pump', curl: 0.08, head: { tilt: 8, pitch: -6 }, hands: { R: { at: 'chest', off: [0.2, 0.12, -0.1], by: 'fist', shape: 'fist', palm: 'in', elbow: 'back', touch: false } }, face: { smile: 0.5, brow: -0.7 } },
    ],
  },
  crossedArms: {
    family: 'aura', after: 'the stoic rival: legs together, arms folded, chin up', seconds: 1.6,
    beats: [
      { at: 0.3, name: 'gather', feet: 'together', hands: { R: { at: 'belly', off: [-0.02, 0.14, 0.04], by: 'palm', shape: 'relaxed', touch: false }, L: { at: 'belly', off: [-0.02, 0.1, 0.0], by: 'palm', shape: 'relaxed', touch: false } } },
      // the right forearm stacked in front of the left: its hand round the left upper arm, the left hand tucked under the right's
      { at: 0.62, name: 'fold', head: { pitch: 8 }, hands: {
        R: { at: 'solar', off: [-0.16, 0.15, 0.065], by: 'palm', shape: 'grip', palm: 'in', elbow: 'out', touch: false, rests: ['upperArmL', 'foreArmL'] },
        L: { at: 'solar', off: [-0.14, 0.09, -0.015], by: 'palm', shape: 'flat', palm: 'in', elbow: 'out', touch: false, rests: ['upperArmR', 'lumbar', 'torso'] } }, face: { blink: 0.3, brow: -0.2 } },
    ],
  },
  heroHips: {
    family: 'aura', after: 'the hero at rest: feet wide, fists on the hips, chest out, chin up', seconds: 1.4,
    beats: [{ at: 0.6, name: 'stand', feet: 'wide', curl: -0.18, head: { pitch: 10 }, hands: { R: FISTHIP('R'), L: FISTHIP('L') }, face: { smile: 0.6 } }],
  },
  niceGuy: {
    family: 'aura', after: 'the nice-guy pose: a thumb up at you at the shoulder\'s height, a big grin, the other fist on the hip', seconds: 1.3,
    beats: [
      { at: 0.35, name: 'set', feet: 'step', turn: -15, hands: { L: FISTHIP('L') } },
      { at: 0.55, name: 'thumb', head: { tilt: 8 }, hands: { R: { aim: ['viewer', 'out'], reach: 0.88, by: 'fist', shape: 'thumb', palm: 'in', fingers: 'viewer', elbow: 'down' } }, face: { smile: 1, blink: 0.2 } },
    ],
  },
  pocketsCool: {
    family: 'aura', after: 'the cool one: hands in the pockets, the weight back on one leg, the head tilted, half-lidded', seconds: 1.4,
    beats: [{ at: 0.6, name: 'slouch', feet: 'contra', curl: 0.1, bend: -0.08, head: { tilt: -12, pitch: -6 }, look: { turn: 12 }, hands: { R: POCKET('R'), L: POCKET('L') }, face: { blink: 0.45 } }],
    gaze: 14,
  },
  glassesPush: {
    family: 'aura', after: 'the strategist: a finger pushing the glasses up the nose, the other arm across holding the elbow', seconds: 1.4,
    beats: [
      { at: 0.35, name: 'fold', feet: 'together', head: { pitch: -10 }, hands: { L: { at: 'solar', off: [-0.1, 0.13, -0.06], by: 'palm', shape: 'grip', palm: 'up', elbow: 'down', touch: false, rests: ['foreArmR', 'upperArmR', 'torso', 'lumbar'] } } },
      { at: 0.58, name: 'push', hands: { R: { at: 'nose', off: [-0.01, 0.025, 0.035], by: 'tip', shape: 'point', palm: 'face', fingers: 'up', elbow: 'down', touch: false, rests: ['head', 'torso', 'bustR'] } }, face: { blink: 0.35, brow: -0.2 } },
    ],
    gaze: 14,
  },
  fingerGuns: {
    family: 'aura', after: 'finger guns: both hands cocked at you, leaning back, a wink', seconds: 1.2,
    beats: [{ at: 0.55, name: 'bang', feet: 'step', curl: -0.12, head: { tilt: 10 }, hands: { R: { aim: ['viewer', 'down', 'out'], reach: 0.85, by: 'fist', shape: 'gun', palm: 'in', fingers: 'viewer', elbow: 'down' }, L: { aim: ['viewer', 'down', 'out'], reach: 0.8, by: 'fist', shape: 'gun', palm: 'in', fingers: 'viewer', elbow: 'down' } }, face: { smile: 0.9, blink: 0.15 } }],
  },
  fistToSky: {
    family: 'aura', after: 'the last stand with no regrets: a fist raised straight to the sky, feet planted wide, looking up', seconds: 1.6,
    beats: [
      { at: 0.35, name: 'brace', feet: 'wide', sink: 0.02, hands: { R: { at: 'chest', off: [0.12, 0.12, -0.05], by: 'fist', shape: 'fist', palm: 'in', elbow: 'down', touch: false } } },
      { at: 0.6, name: 'raise', curl: -0.1, look: { pitch: 24 }, hands: { R: { aim: 'up', reach: 0.98, by: 'wrist', shape: 'fist', palm: 'fwd', elbow: 'back' } }, face: { blink: 0.3, brow: -0.3 } },
    ],
    gaze: 14,
  },
  peaceWink: {
    family: 'aura', after: 'the V by the eye: a peace sign framing the eye, the hip popped, the head tilted, a grin', seconds: 1.2,
    beats: [{ at: 0.55, name: 'peace', feet: 'contra', bend: -0.1, head: { tilt: 14 }, hands: { R: { at: 'eyeR', off: [0.03, 0.06, -0.01], by: 'vee', shape: 'vee', fingers: ['in', 'up'], palm: 'fwd', elbow: 'down', touch: false }, L: ONHIP('L') }, face: { smile: 0.9, blink: 0.1 } }],
    gaze: 16,
  },
  // ── JOJO: after the bizarre poses of JoJo's Bizarre Adventure ──
  dioBack: {
    family: 'jojo', after: "Dio's turned back: the back to you, the body arched, the head turned back over the shoulder, a clawed hand raised by the face", seconds: 1.8,
    beats: [
      { at: 0.4, name: 'turn', feet: 'wide', turn: 150, chest: 18, look: 'viewer' },
      { at: 0.62, name: 'menace', curl: -0.12, bend: 0.12, head: { tilt: 10, pitch: 6 }, hands: { R: { at: 'brow', off: [0.06, 0.08, 0.0], by: 'palm', shape: 'claw', elbow: 'out', touch: false }, L: { aim: ['down', 'out', 'back'], reach: 0.94, by: 'wrist', shape: 'claw', palm: 'back', elbow: 'back' } }, face: { brow: -0.6, smile: 0.4, blink: 0.2 } },
    ],
    // (the back turned 150°, the chest 18° back: the neck and head at their limits bring the face round to a profile
    // over the shoulder, never square to you)
    gaze: 72,
  },
  jotaroPoint: {
    family: 'jojo', after: "Jotaro's accusing point: side-on, the arm straight at you, the other hand in a pocket", seconds: 1.4,
    beats: [
      { at: 0.35, name: 'turn', feet: 'step', turn: -35, chest: 10, hands: { L: POCKET('L') } },
      { at: 0.55, name: 'point', head: { pitch: -8 }, hands: { R: { aim: 'viewer', reach: 0.97, by: 'wrist', shape: 'point', fingers: 'viewer', palm: 'in', elbow: 'down' } }, face: { brow: -0.5 } },
    ],
  },
  killerQueen: {
    family: 'jojo', after: "Kira's finger up, finger down: one index raised beside the face, the other arm across the body pointing at the floor, the legs crossed", seconds: 1.6,
    beats: [
      { at: 0.4, name: 'cross', feet: 'cross', chest: 14, bend: 0.12 },
      { at: 0.62, name: 'touch', head: { tilt: -12, pitch: -8 }, hands: { R: { aim: ['up', 'fwd', 'in'], reach: 0.62, by: 'tip', shape: 'point', fingers: 'up', elbow: 'down' }, L: { aim: ['down', 'in', 'fwd'], reach: 0.92, by: 'wrist', shape: 'point', fingers: ['down', 'in'], palm: 'back', elbow: 'out' } }, face: { brow: -0.4, blink: 0.25 } },
    ],
    gaze: 16,
  },
  josuke: {
    family: 'jojo', after: "Josuke's pompadour pose: a hand smoothing the side of the hair, the other on the hip, the hips cocked, a grin", seconds: 1.5,
    beats: [{ at: 0.6, name: 'smooth', feet: 'contra', chest: -16, bend: 0.14, head: { tilt: 10, pitch: 6 }, hands: { R: { at: 'templeR', off: [0.04, 0.0, 0.07], by: 'palm', gap: 0.02, shape: 'flat', palm: 'surface', elbow: 'out', touch: false, rests: ['head'] }, L: ONHIP('L') }, face: { smile: 0.5 } }],
    gaze: 16,
  },
  giorno: {
    family: 'jojo', after: "Giorno's resolve: a flat hand over the heart, the other held out palm up, the legs crossed, the head tilted", seconds: 1.6,
    beats: [{ at: 0.6, name: 'resolve', feet: 'cross', chest: 10, head: { tilt: -10, pitch: -4 }, hands: { R: { at: 'heart', by: 'palm', gap: 0.026, shape: 'flat', palm: 'surface', fingers: ['in', 'up'], elbow: 'down', rests: ['bustL', 'bustR'] }, L: { aim: ['viewer', 'down'], reach: 0.85, by: 'palm', shape: 'open', palm: 'up', elbow: 'down' } }, face: { blink: 0.3, brow: -0.2 } }],
    gaze: 14,
  },
  josephPoint: {
    family: 'jojo', after: "Joseph's \"your next line is…\": leaning in, a finger aimed at your face, the other hand on the hip, grinning", seconds: 1.3,
    beats: [{ at: 0.55, name: 'nextLine', feet: 'step', hinge: 10, chest: -10, hands: { R: { aim: { x: 0, y: 1, z: 0.3 }, reach: 0.95, by: 'wrist', shape: 'point', fingers: { x: 0, y: 1, z: 0.25 }, palm: 'in', elbow: 'down' }, L: ONHIP('L') }, face: { smile: 0.8, open: 0.3 } }],
  },
  jonathanArch: {
    family: 'jojo', after: "Jonathan's arch: the back bent, an arm thrown up behind the head, the other hand on the hip, the chest to the sky", seconds: 1.7,
    beats: [
      { at: 0.4, name: 'step', feet: 'step', chest: 18 },
      { at: 0.64, name: 'arch', curl: -0.35, bend: -0.1, head: { pitch: 16 }, hands: { R: { at: 'earR', off: [0.03, -0.05, 0.05], by: 'palm', shape: 'flat', palm: 'surface', elbow: 'up', touch: false, rests: ['head', 'neck'] }, L: ONHIP('L') }, face: { brow: 0.2, blink: 0.3 } },
    ],
    gaze: 24,
  },
  // ── SQUAD: the team roll call ──
  sentaiRoll: {
    family: 'squad', after: 'the super sentai roll call: feet broad, a fist thrust up and out, the other chambered at the hip', seconds: 1.6,
    beats: [
      { at: 0.35, name: 'chamber', feet: 'broad', hands: { R: CHAMBER('R'), L: CHAMBER('L') }, face: { brow: -0.5 } },
      { at: 0.55, name: 'call', chest: 10, hands: { R: { aim: ['up', 'out', 'fwd'], reach: 0.97, by: 'wrist', shape: 'fist', palm: 'fwd', elbow: 'down' } }, face: { open: 0.5, brow: -0.6 } },
    ],
  },
  henshin: {
    family: 'squad', after: "the masked rider's transformation: the arm swept across the body to the far side at shoulder height, the other fist at the hip", seconds: 1.8,
    beats: [
      { at: 0.3, name: 'out', feet: 'broad', hands: { R: { aim: ['out', 'up'], reach: 0.96, by: 'wrist', shape: 'flat', palm: 'fwd', elbow: 'down' }, L: CHAMBER('L') }, face: { brow: -0.5 } },
      { at: 0.6, name: 'sweep', chest: 24, hands: { R: { aim: ['in', 'fwd', 'up'], reach: 0.8, by: 'wrist', shape: 'flat', palm: 'fwd', fingers: ['in', 'up'], elbow: 'down' } } },
    ],
  },
  ginyu: {
    family: 'squad', after: "the captain's pose of the Ginyu Force: one knee drawn up, both arms spread up and out, the hands open", seconds: 1.6,
    beats: [
      { at: 0.35, name: 'spread', feet: 'abreast', hands: { R: { aim: ['out', 'up'], reach: 0.85, by: 'wrist', shape: 'open', palm: 'viewer', elbow: 'down' }, L: { aim: ['out', 'up'], reach: 0.85, by: 'wrist', shape: 'open', palm: 'viewer', elbow: 'down' } } },
      { at: 0.6, name: 'crane', feet: 'crane', bend: -0.06, face: { open: 0.5, brow: -0.3 } },
    ],
  },
  recoome: {
    family: 'squad', after: 'the ultra fighting pose: a deep wide squat, both arms flexed up beside the head', seconds: 1.6,
    beats: [{ at: 0.6, name: 'flex', feet: 'squat', hands: { R: { at: 'templeR', off: [0.22, 0.02, 0.02], by: 'fist', shape: 'fist', palm: 'in', elbow: 'out', touch: false }, L: { at: 'templeL', off: [0.22, 0.02, 0.02], by: 'fist', shape: 'fist', palm: 'in', elbow: 'out', touch: false } }, face: { open: 0.4, brow: -0.6 } }],
  },
  // ── MEME ──
  tPose: {
    family: 'meme', after: 'asserting dominance: the bind pose struck on purpose, arms rising stiff to the sides', seconds: 2.2,
    beats: [
      { at: 0.25, name: 'still', feet: 'together' },
      { at: 0.85, name: 'T', hands: { R: { aim: 'out', reach: 0.99, by: 'wrist', shape: 'flat', palm: 'down', fingers: 'out', elbow: 'back' }, L: { aim: 'out', reach: 0.99, by: 'wrist', shape: 'flat', palm: 'down', fingers: 'out', elbow: 'back' } } },
    ],
  },
});
export const AURA_NAMES = Object.freeze(Object.keys(AURAS).flatMap((n) => [n, `${n}Left`]));

// ─── the performance and the checks ───────────────────────────────────────────────────────────────────────────────────
const flatOf = (o, pre = '', out = {}) => { for (const [k, v] of Object.entries(o || {})) { if (isObj(v)) flatOf(v, `${pre}${k}.`, out); else if (Number.isFinite(v)) out[`${pre}${k}`] = v; } return out; };
const unflatOf = (m) => { const o = {}; for (const [p, v] of Object.entries(m)) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c = c[k] || (c[k] = {}); }); c[ks[ks.length - 1]] = v; } return o; };
const blendPose = (a, b, t) => { const fa = flatOf(a), fb = flatOf(b); return unflatOf(Object.fromEntries([...new Set([...Object.keys(fa), ...Object.keys(fb)])].map((k) => [k, lerp(fa[k] ?? 0, fb[k] ?? 0, t)]))); };
const STAND = { pose: {}, sink: 0, outL: 0, outR: 0, footL: 0, footR: 0, heelL: 0, heelR: 0, groundL: 1, groundR: 1 };

/**
 * The keys between two solved keys: a foot that moves (or comes down, or lifts) STEPS — the weight carried over the other
 * foot, the foot lifted on a bent leg, carried, set down — one foot after the other; a lifted leg (a crane) rises last.
 */
function stepsBetween(A, B, tA, tB, R) {
  const s = heightOf(R) / CANON_HEIGHT, moved = ['L', 'R'].filter((S) => B[`ground${S}`] && (!A[`ground${S}`] || Math.hypot(B[`out${S}`] - A[`out${S}`], B[`foot${S}`] - A[`foot${S}`]) > STEP_MOVE * s || Math.abs((B.pose[`splay${S}`] ?? 0) - (A.pose[`splay${S}`] ?? 0)) > 25));
  if (!moved.length) return [];
  const out = [], n = moved.length, dt = (tB - tA) / n;
  let cur = A;
  moved.forEach((S, i) => {
    const t0 = tA + dt * i, O = S === 'R' ? 'L' : 'R', k = (i + 1) / (n + 1);
    // the foot lifts with the leg bent: the hip forward, the knee twice it, the other foot bearing the weight
    const mid = blendPose(cur.pose, B.pose, 0.5);
    const lifted = { ...cur, pose: { ...mid, [`hip${S}`]: { pitch: 22, yaw: 0, roll: 0 }, [`knee${S}`]: 44, shift: { x: lerp(cur.pose.shift?.x ?? 0, (O === 'L' ? -1 : 1) * 0.07 * s, 0.85), y: lerp(cur.pose.shift?.y ?? 0, B.pose.shift?.y ?? 0, 0.5) } }, [`ground${S}`]: 0, [`out${S}`]: (cur[`out${S}`] + B[`out${S}`]) / 2, [`foot${S}`]: (cur[`foot${S}`] + B[`foot${S}`]) / 2, [`heel${S}`]: 0, sink: Math.max(cur.sink, B.sink) * 0.7 + 0.01 * s };
    out.push({ ...lifted, t: t0 + dt * 0.45 });
    const down = { ...lifted, pose: blendPose(cur.pose, B.pose, k), [`ground${S}`]: 1, [`out${S}`]: B[`out${S}`], [`foot${S}`]: B[`foot${S}`], [`heel${S}`]: B[`heel${S}`], sink: lerp(cur.sink, B.sink, k) };
    if (i < n - 1) out.push({ ...down, t: t0 + dt * 0.95 });
    cur = down;
  });
  return out;
}

/**
 * Solve a showcase pose on a rig: { name, family, after, seconds, keys, clip, hold, face, faces (the track), beats,
 * goals, checks }. `body` (auraBody with the hero's mesh) gives the surfaces the hands rest on; without it, round
 * capsules and the canonical face.
 */
export function heroAura(name, R, { body = null, seconds } = {}) {
  const own = typeof name === 'object' && name; const left = !own && /Left$/.test(name) && AURAS[name.slice(0, -4)];
  const P = own || AURAS[left ? name.slice(0, -4) : name]; if (!P) throw new Error(`hero-aura: no pose '${name}' (have ${AURA_NAMES.join(', ')})`);
  const B = bodyFor(R, body);
  // each beat's words: the one before's, changed by its own (the hands per side: a side named is replaced)
  const words = []; let W = {};
  for (const b of P.beats) { const { at, ...w } = b; W = { ...W, ...w, hands: { ...(W.hands ?? {}), ...(w.hands ?? {}) }, head: w.head ?? W.head, face: { ...(W.face ?? {}), ...(w.face ?? {}) } }; for (const S of ['L', 'R']) if (W.hands[S] === null) delete W.hands[S]; words.push({ at, W }); }
  const solved = []; let prev = null;
  for (const { at, W: w } of words) { prev = solveState(w, R, B, prev); solved.push({ at, ...prev }); }
  // the timeline: the stand, the steps between, each beat, held from the hit to the end
  const keys = [{ t: 0, ...STAND }]; let last = keys[0];
  for (const st of solved) { keys.push(...stepsBetween(last, st.key, last.t, st.at, R)); const k = { t: st.at, ...st.key }; keys.push(k); last = k; }
  keys.push({ ...last, t: 1 });
  const T = seconds ?? P.seconds ?? 2;
  // VIA keys: where a hand or forearm passes through the body between beats, a key carries that arm out round it (the
  // wrist sent off the surface along the way out, the arm reaching there from where it was), until the path is clear
  const passR = Object.fromEntries(['L', 'R'].map((S) => [S, [...new Set(solved.flatMap((st) => st.contact[S] ?? []))]]));
  for (let round = 0; round < 10; round++) {
    const c0 = keyedClip({ seconds: T, keys }, R); let worst = null;
    for (let i = 1; i < 80; i++) { const t = i / 80; if (keys.some((k) => !k.via && Math.abs(k.t - t) < 0.006)) continue; const m = rigNodesAt(R, c0.fn(t)).nodes; const q = clearOf(R, B, m, boneFrames(R, R.joints, m), passR); if (q.worst && (!worst || q.worst.d > worst.d)) worst = { ...q.worst, t, m, facing: c0.fn(t).facing ?? 0 }; }
    if (!worst || worst.d < 0.012 * B.s) break;
    // (a via key already there is moved on itself; else a new one is laid between its neighbours)
    const here = keys.findIndex((k) => k.via && Math.abs(k.t - worst.t) < 0.006);
    const j = here >= 0 ? here + 1 : keys.findIndex((k) => k.t > worst.t), k0 = here >= 0 ? keys[here] : keys[j - 1], k1 = keys[j], f = here >= 0 ? 0 : (worst.t - k0.t) / (k1.t - k0.t), S = worst.S;
    const via = { ...k0, ...Object.fromEntries(Object.keys(k0).filter((k) => typeof k0[k] === 'number' && typeof k1[k] === 'number').map((k) => [k, lerp(k0[k], k1[k], f)])), pose: blendPose(k0.pose, k1.pose, f), t: worst.t };
    for (const g of ['groundL', 'groundR']) via[g] = Math.min(k0[g], k1[g]) < 1 ? lerp(k0[g], k1[g], f) : 1;
    // (out of the bone, and round the front of the body: a hand crossing the trunk or the thighs swings in front of them)
    const F = boneFrames(R, R.joints, worst.m)[R.boneIndex[worst.id]], fwd = yawV([0, 1, 0], worst.facing ?? 0);
    const out = unit(add(outOf(B.prof[worst.id], F, worst.p), /^(upperArm|foreArm)/.test(worst.id) ? [0, 0, 0] : fwd));
    const goal = add(worst.m[`wrist${S}`], mul(out, worst.d + 0.04 * B.s));
    const body = c0.fn(worst.t); delete body[`sh${S}`]; delete body[`elbow${S}`];
    const a = reachArm(R, body, S, goal, via.pose[`sh${S}`] ? { sh: via.pose[`sh${S}`], elbow: via.pose[`elbow${S}`] } : null);
    via.pose = { ...via.pose, [`sh${S}`]: a.sh, [`elbow${S}`]: a.elbow }; via.via = true; via.t = here >= 0 ? keys[here].t : worst.t;
    if (here >= 0) keys[here] = via; else keys.splice(j, 0, via);
  }
  const facesR = [{ t: 0, face: faceOf({}) }, ...solved.map((st, i) => ({ t: r3(st.at * T), face: faceOf(words[i].W.face) }))];
  const K = left ? mirrored(keys) : keys;
  const clip = keyedClip({ seconds: T, keys: K }, R);
  const hold = clip.fn(1), fin = solved[solved.length - 1];
  const mirrorP = (p) => [-p[0], p[1], p[2]], swap = (o) => Object.fromEntries(Object.entries(o).map(([S, v]) => [S === 'R' ? 'L' : 'R', v]));
  const mirrorBone = (b) => (b ? b.replace(/([LR])$/, (x) => (x === 'L' ? 'R' : 'L')) : b);
  const goals = left ? swap(Object.fromEntries(Object.entries(fin.goals).map(([S, g]) => [S, mirrorP(g)]))) : fin.goals;
  const want = left ? swap(Object.fromEntries(Object.entries(fin.want).map(([S, w]) => [S, { u: w.u && mirrorP(w.u), palm: w.palm && mirrorP(w.palm) }]))) : fin.want;
  const tuck = left ? swap(fin.tuck) : fin.tuck;
  const contact = left ? swap(Object.fromEntries(Object.entries(fin.contact).map(([S, b]) => [S, b.map(mirrorBone)]))) : fin.contact;
  const by = left ? swap(fin.by) : fin.by;
  const passing = left ? swap(Object.fromEntries(Object.entries(passR).map(([S, b]) => [S, b.map(mirrorBone)]))) : passR;
  const lifted = ['L', 'R'].filter((S) => !(left ? fin.key[`ground${S === 'L' ? 'R' : 'L'}`] : fin.key[`ground${S}`]));
  const lookDir = left ? mirrorP(fin.lookDir) : fin.lookDir;
  const checks = auraChecks(R, B, hold, { goals, want, contact, passing, tuck, by, lifted, lookDir, clip, T, gazeTol: P.gaze ?? 12 });
  return { name: own ? 'own' : name, family: P.family ?? 'aura', after: P.after ?? null, seconds: T, keys: K, clip, hold, face: facesR[facesR.length - 1].face, faces: facesR, beats: solved.map((st, i) => ({ t: r3(st.at * T), name: P.beats[i].name ?? `beat${i + 1}` })), goals, checks };
}
const faceOf = (f) => ({ blink: 0, smile: 0, open: 0, brow: 0, ...(f || {}) });

/** the samples of a hand and forearm the clearance reads: [point, its own radius] */
function armSamples(n, S, s) {
  return [[lerp3(n[`elbow${S}`], n[`wrist${S}`], 0.5), 0.028 * s], [n[`wrist${S}`], 0.02 * s], [lerp3(n[`wrist${S}`], n[`middleMcp${S}`], 0.55), 0.014 * s], [n[`middleMcp${S}`], 0.01 * s], [n[`indexTip${S}`], 0.006 * s], [n[`middleTip${S}`], 0.006 * s], [n[`thumbTip${S}`], 0.006 * s]];
}

/**
 * The machine gate on a held showcase pose and its clip: balance (m: the centre of mass inside the planted feet's
 * footprint), reach (each planted leg's hip-to-hock share of its length), knees (flexion, degrees), hands (m: each
 * hand's point off its goal), aim ({ fingers, palm } degrees off their words), clear (m: the deepest a hand or forearm
 * lies inside the body — a resting hand against what it rests on excused to REST_DEPTH), arms (m: the forearms' gap,
 * − crossing through), gaze (degrees off the look), plant (m: a planted toe's most drift while it bears), speed (m/s:
 * the fastest hand), laws.
 */
export const REST_DEPTH = 0.03, CLEAR_DEPTH = 0.018;
export function auraChecks(R, B, hold, { goals, want, contact, passing = contact, tuck = {}, by, lifted = [], lookDir = [0, 1, 0], clip = null, T = 1, gazeTol = 12 }) {
  const s = B.s, n = rigNodesAt(R, hold).nodes, F = boneFrames(R, R.joints, n);
  const planted = ['L', 'R'].filter((S) => !lifted.includes(S));
  // (each planted foot's sole: its centre line widened by half a foot's breadth each side, so one foot is an area)
  const pts = planted.flatMap((S) => { const L = R.legs[S], line = [n[L.toeBase], n[L.toeTip], ...((hold[`heel${S}`] ?? 0) < -5 ? [] : [n[L.hock]])], a = sub(n[L.toeTip], n[L.hock]), w = mul(unit([-a[1], a[0], 0]), 0.04 * s); return line.flatMap((p) => [add(p, w), sub(p, w)]); });
  const balance = r4(margin(hull(pts.map((p) => [p[0], p[1]])), comOf(n)));
  const reach = Object.fromEntries(planted.map((S) => { const L = R.legs[S], J = R.joints; return [S, r3(dist(n[L.hip], n[L.hock]) / (dist(J[L.knee], J[L.hip]) + dist(J[L.hock], J[L.knee])))]; }));
  const knees = Object.fromEntries(['L', 'R'].map((S) => { const L = R.legs[S]; return [S, r1(180 - angle(sub(n[L.hip], n[L.knee]), sub(n[L.hock], n[L.knee])))]; }));
  const hands = Object.fromEntries(Object.entries(goals).map(([S, g]) => [S, r4(dist(handPoint(n, S, by[S]), g))]));
  const aim = Object.fromEntries(Object.entries(want).map(([S, w]) => { const H = handFrame(n, S); return [S, { fingers: w.u ? r1(angle(H.u, w.u)) : null, palm: w.palm ? r1(angle(H.palm, w.palm)) : null }]; }));
  // the clearance: each hand's and forearm's samples against every bone of the body but its own arm's
  const { clear, clearAt, rest } = clearOf(R, B, n, F, contact);
  const forearms = segGap(lerp3(n.elbowR, n.wristR, 0.25), lerp3(n.elbowR, n.wristR, 0.75), lerp3(n.elbowL, n.wristL, 0.25), lerp3(n.elbowL, n.wristL, 0.75)) - 0.055 * s;
  const hF = F[R.boneIndex.head], gaze = r1(angle([hF.m[0][1], hF.m[1][1], hF.m[2][1]], lookDir));
  // over the clip: the planted toes hold, the fastest hand
  let plant = 0, speed = 0, pass = -Infinity, passAt = null;
  if (clip) {
    const M = 120; let last = null; const down = {};
    for (let i = 0; i <= M; i++) {
      const p = clip.fn(i / M), m = rigNodesAt(R, p).nodes;
      if (last) for (const S of ['L', 'R']) {
        speed = Math.max(speed, dist(m[`wrist${S}`], last.m[`wrist${S}`]) / (T / M));
        // a toe on the floor (within a millimetre) both samples running is planted: it must not slide
        // (settled: down for the two samples before as well, so a toe's last millimetres of touching down are not read)
        const L = R.legs[S], fl = R.joints[L.toeBase][2], on = m[L.toeBase][2] - fl < 0.001; down[S] = on ? (down[S] ?? 0) + 1 : 0;
        if (down[S] >= 3) plant = Math.max(plant, Math.hypot(m[L.toeBase][0] - last.m[L.toeBase][0], m[L.toeBase][1] - last.m[L.toeBase][1]));
      }
      if (i % 3 === 0) { const q = clearOf(R, B, m, boneFrames(R, R.joints, m), passing); if (q.clear > pass) { pass = q.clear; passAt = `${q.clearAt} at ${r3((i / M) * T)} s`; } }
      last = { p, m };
    }
  }
  const laws = {
    balance: balance > 0.004, reach: Object.values(reach).every((v) => v <= REACH + 1e-3), knees: Object.values(knees).every((k) => k <= 150),
    hands: Object.values(hands).every((d) => d < 0.025 * s), aim: Object.values(aim).every((a) => (a.fingers ?? 0) <= 25 && (a.palm ?? 0) <= 30),
    // (CLEAR_DEPTH: a dressed body's clothes thicken its surface a few millimetres past a bare cast's)
    clear: clear < CLEAR_DEPTH * s, rest: Object.entries(rest).every(([S, d]) => d < (REST_DEPTH + (tuck[S] ?? 0)) * s + CLEAR_DEPTH * s), plant: plant < 0.003, arms: forearms > -0.01 * s, gaze: gaze <= gazeTol, speed: speed <= 14, ...(clip ? { pass: pass < 0.03 * s } : {}),
  };
  return { balance, reach, knees, hands, aim, clear: r4(clear), clearAt, rest: Object.fromEntries(Object.entries(rest).map(([S, d]) => [S, r4(d)])), arms: r4(forearms), gaze, plant: r4(plant), speed: r1(speed), ...(clip ? { pass: r4(pass), passAt } : {}), laws };
}
/** the deepest any hand or forearm sample lies in the body (each arm's own bones left out; what a hand rests on — its
 * `contact` bones and their neighbours — read apart, as that hand's resting depth) */
function clearOf(R, B, n, F, contact) {
  let clear = -Infinity, clearAt = null, worst = null; const rest = {};
  for (const S of ['L', 'R']) for (const [p, r] of armSamples(n, S, B.s)) for (const [id, P] of Object.entries(B.prof)) {
    if (id === `upperArm${S}` || id === `foreArm${S}`) continue;
    const d = depthIn(P, F[R.boneIndex[id]], p) + r;
    if ((contact[S] ?? []).some((b) => b === id || (b === 'head' && id === 'neck') || adjacent(b, id))) { rest[S] = Math.max(rest[S] ?? -Infinity, d); continue; }
    if (d > clear) { clear = d; clearAt = `${S} in ${id}`; worst = { S, p, id, d }; }
  }
  return { clear, clearAt, rest, worst };
}
const adjacent = (a, b) => { const G = [['torso', 'lumbar', 'bustL', 'bustR', 'neck'], ['lumbar', 'pelvis', 'torso'], ['pelvis', 'lumbar', 'thighL', 'thighR'], ['thighR', 'pelvis'], ['thighL', 'pelvis'], ['upperArmL', 'torso'], ['upperArmR', 'torso'], ['head', 'neck']]; return G.some((g) => g[0] === a && g.includes(b)); };
/** the least distance between two segments */
function segGap(p1, q1, p2, q2) {
  let best = Infinity; for (let i = 0; i <= 20; i++) { const a = lerp3(p1, q1, i / 20); const ab = sub(q2, p2), t = clamp(dot(sub(a, p2), ab) / dot(ab, ab), 0, 1); best = Math.min(best, dist(a, add(p2, mul(ab, t)))); }
  return best;
}
