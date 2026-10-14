// hero-rest — AT REST: sitting and lying, solved from what the body rests on. A rest pose is said by its CONTACTS, and
// the solver places the body so they hold:
//
//   • SEATED (a chair, a couch, the floor): the sit bones (the ischial tuberosities: under and a little behind the hip
//     joints) on the seat; a pose that rests its back on the backrest RECLINES the whole trunk about the hips until the
//     upper back meets it (a slouch slides the sit bones forward first, so the pelvis rolls back and the lumbar rounds);
//     the feet where the pose puts them (flat on the floor under the knees, out in front, crossed at the ankles, tucked
//     under the opposite knee, on the opposite thigh in the lotus, flat by the seat with the knee up), each leg reaching
//     its foot by the rig's leg solve, the knee carried round by the foot's turn (`splay`); the hands on what they rest on
//     (the thighs, the lap, the knees, an armrest, the backrest's top, the floor behind, a forearm over a raised knee).
//   • LYING: the body turned onto its back or its side (and a little toward the front), let down until its lowest flesh
//     meets the floor (hero-jump's fleshOf: the trunk's, the head's, the limbs' radii); the limbs reach the floor where
//     the pose lays them. A body KNOCKED OUT holds nothing up: every limb lies on the floor.
//
// Furniture is drawn as boxes (SEATS: a chair at popliteal height, about a quarter of the stature — Pheasant,
// Bodyspace; a couch lower, deeper and reclined further). Each pose gives its pose, its props, the face it wears (the
// anime face's channels) and its CHECKS (the machine gate): every contact held, nothing through the floor or the seat,
// the knees and hips inside their range, an unsupported seated body balanced over its sit bones and feet, a knocked-out
// body resting every limb; and the effort the posture costs (hero-carry effortOf: an upright back costs more than a
// slouch). Pure and deterministic.
import { rigNodesAt, HAND_POSES } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { reachArm, comOf, hull, margin } from './hero-stance.js';
import { fleshOf } from './hero-jump.js';
import { effortOf } from './hero-carry.js';
import { CANON_HEIGHT } from './hero-canon.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), dist = (a, b) => len(sub(a, b)), unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const angle = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => +x.toFixed(1), r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
export const heightOf = (R) => R.joints.headTop?.[2] ?? CANON_HEIGHT;
export const floorOf = (R) => Math.min(...Object.values(R.legs).flatMap((L) => [R.joints[L.toeBase][2], R.joints[L.toeTip][2]]));

// ─── the furniture ────────────────────────────────────────────────────────────────────────────────────────────────────
/** the seats, as shares of the figure's stature (a chair's seat at the popliteal height, ~0.26 H) and metres scaled by
 * it: `height` of the seat, `depth`, `sink` (a cushion's give under the sit bones), the backrest's `recline` (degrees
 * back from upright) and `tall`, a couch's armrests (`arm` high, `armOut` from the middle) */
export const SEATS = Object.freeze({
  chair: { height: 0.26, depth: 0.27, sink: 0.005, recline: 8, tall: 0.3, width: 0.27 },
  couch: { height: 0.24, depth: 0.36, sink: 0.035, recline: 22, tall: 0.24, width: 1.1, arm: 0.33, armOut: 0.24 },
  floor: { height: 0, depth: 0, sink: 0 },
});
const WOOD = '#8a6a44', FABRIC = '#6d7f8f', CUSHION = '#7f93a3';

// ─── the poses ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The rest poses. Seated ones: `seat` (a SEATS name); `sit` how far the sit bones sit forward of the backrest's foot
 * (a share of the stature); `recline` degrees the trunk lies back from upright (`'back'`: until the upper back meets the
 * backrest); `spine` its rounding (+) or arching (−), `lean` aside; `feet` per side { at: under | out | cross | tuck |
 * lotus | up | fold, … }; `hands` per side a rest (thigh | lap | knee | armrest | backTop | floorBehind | overKnee |
 * belly); `head` { pitch, turn, tilt }; `face` the anime channels. Lying ones: `turn` { pitch, roll } (pitch −90 on the
 * back; roll 90 on the right side), `hips`/`knees` per side or `feet` targets, `hands`, `limp` (every limb on the floor).
 */
export const RESTS = Object.freeze({
  chairUpright: { family: 'seated', seat: 'chair', sit: 0.075, recline: 0, spine: -0.1, feet: { R: { at: 'under', apart: 0.07 }, L: { at: 'under', apart: 0.07 } }, hands: { R: 'thigh', L: 'thigh' }, head: { pitch: 0 } },
  chairSlouch: { family: 'seated', seat: 'chair', sit: 0.15, recline: 'back', spine: 0.7, feet: { R: { at: 'out', fwd: 0.22, apart: 0.12 }, L: { at: 'out', fwd: 0.18, apart: 0.1 } }, hands: { R: 'lap', L: 'lap' }, head: { pitch: -18 }, face: { blink: 0.5 } },
  couchSit: { family: 'seated', seat: 'couch', sit: 0.08, recline: 'back', spine: 0.15, feet: { R: { at: 'under', fwd: 0.05, apart: 0.08 }, L: { at: 'under', fwd: 0.03, apart: 0.08 } }, hands: { R: 'armrest', L: 'lap' }, head: { pitch: -8 }, face: 'smile' },
  couchLounge: { family: 'seated', seat: 'couch', sit: 0.17, recline: 'back', spine: 0.45, feet: { R: { at: 'cross', fwd: 0.36 }, L: { at: 'cross', fwd: 0.34 } }, hands: { R: 'backTop', L: 'backTop' }, head: { pitch: -14, tilt: 6 }, face: { blink: 0.18, smile: 0.4 } },
  crossLegged: { family: 'seated', seat: 'floor', recline: 0, spine: 0, feet: { R: { at: 'tuck' }, L: { at: 'tuck' } }, hands: { R: 'knee', L: 'knee' }, head: { pitch: 0 } },
  // APPROXIMATE on this rig: each foot rests into the other shin, not up on the thigh (see the seated solve)
  lotus: { family: 'seated', seat: 'floor', approx: 'lotus', recline: 0, spine: -0.1, feet: { R: { at: 'lotus' }, L: { at: 'lotus' } }, hands: { R: 'knee', L: 'knee' }, head: { pitch: 0 }, face: { blink: 1 } },
  kneeUp: { family: 'seated', seat: 'floor', recline: 12, spine: 0.2, feet: { R: { at: 'up' }, L: { at: 'fold' } }, hands: { R: 'overKnee', L: 'floorBehind' }, head: { pitch: -4, turn: 10 } },
  lieBack: { family: 'lying', turn: { pitch: -90 }, legs: { R: { up: true }, L: { flat: 0.08 } }, hands: { R: 'belly', L: 'belly' }, head: {}, face: { blink: 1 } },
  lieSide: { family: 'lying', turn: { roll: 90 }, legs: { R: { hip: 55, knee: 80 }, L: { hip: 40, knee: 65, fwd: 0.06 } }, hands: { R: 'pillow', L: 'front' }, head: { pitch: -6 }, face: { blink: 1 } },
  knockedOut: { family: 'lying', turn: { pitch: -90 }, legs: { R: { flat: 0.24, splay: 35 }, L: { flat: 0.2, splay: 30 } }, hands: { R: 'flung', L: 'flungLow' }, head: { turn: 40 }, limp: true, face: { blink: 1, open: 0.35, brow: -0.3 } },
  // the classic: on his side at the bottom of a crater, curled, knees drawn up, an arm bent before the face
  yamcha: { family: 'lying', turn: { roll: 90, pitch: 25 }, legs: { R: { hip: 70, knee: 100 }, L: { hip: 80, knee: 95, fwd: 0.05 } }, hands: { R: 'faceFloor', L: 'floorFront' }, head: { pitch: -25 }, limp: true, crater: true, face: { blink: 1, open: 0.3, brow: -0.5 } },
});
export const REST_NAMES = Object.freeze(Object.keys(RESTS));

// ─── the body's measures ──────────────────────────────────────────────────────────────────────────────────────────────
/** the sit bones' contact (the skin under the ischial tuberosities) off the pelvis hub, at rest: below and behind the
 * hip joints */
export const ischOf = (R) => { const s = heightOf(R) / CANON_HEIGHT; return [0, -0.035 * s, -0.1 * s]; };
/** a foot target pulled in to what the leg reaches from its hip (97 % of thigh, shin and the hock-to-ball drop) */
export function inReach(R, S, hip, toe, splay = 0, M = null) {
  // (the leg reaches the hock: the ball's place plus the foot turned by its splay, and by the whole-body turn when the
  // target is a world one)
  const L = R.legs[S], J = R.joints, max = 0.97 * (dist(J[L.hip], J[L.knee]) + dist(J[L.knee], J[L.hock]));
  const a = rad(splay * (J[L.hip][0] < 0 ? 1 : -1)), o = sub(J[L.hock], J[L.toeBase]);
  let off = [o[0] * Math.cos(a) - o[1] * Math.sin(a), o[0] * Math.sin(a) + o[1] * Math.cos(a), o[2]]; if (M) off = mv(M, off);
  const hockAt = (t) => add(lerp3(hip, toe, t), off);
  if (dist(hip, hockAt(1)) <= max) return toe;
  let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (dist(hip, hockAt(m)) <= max) lo = m; else hi = m; }
  return lerp3(hip, toe, lo);
}
const thighLen = (R, S) => dist(R.joints[R.legs[S].hip], R.joints[R.legs[S].knee]);
const shinLen = (R, S) => dist(R.joints[R.legs[S].knee], R.joints[R.legs[S].hock]);
/** the whole-body turn (hero-jump's `body`): roll about y then pitch about x, as the rig applies it */
export function turnOf(t) {
  const rot = (v) => { let q = v; if (t.roll) { const a = rad(t.roll), c = Math.cos(a), s = Math.sin(a); q = [q[0] * c + q[2] * s, q[1], -q[0] * s + q[2] * c]; } if (t.pitch) { const a = rad(-t.pitch), c = Math.cos(a), s = Math.sin(a); q = [q[0], q[1] * c - q[2] * s, q[1] * s + q[2] * c]; } return q; };
  const cols = [rot([1, 0, 0]), rot([0, 1, 0]), rot([0, 0, 1])];
  return { M: [0, 1, 2].map((r) => cols.map((c) => c[r])), apply: rot };
}
const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

/** a world point into the upright frame the legs are solved in (before the whole-body turn about `at` and its lift) */
const toUpright = (T, at, up, p) => add(at, mtv(T.M, sub(sub(p, [0, 0, up]), at)));
const fromUpright = (T, at, up, p) => add(add(at, mv(T.M, sub(p, at))), [0, 0, up]);

// ─── a free leg's words ───────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A leg NOT planted (folded on the floor, lying, on the other thigh): the hip's pitch, yaw and roll and the knee searched
 * (a grid, then coordinate steps) so the leg meets `cost(nodes)` — its ankle and knee where the pose lays them — inside
 * the rig's own ranges (the joint words are the rig's, clamped by its limits); `seat` carries a thigh's flexion past
 * the swivel's cone (the rig's seated word), shared by both legs.
 */
function legWords(R, pose, S, cost, { yaw = [-90, 90] } = {}) {
  const at = (x) => ({ ...pose, [`hip${S}`]: { pitch: x[0], yaw: x[1], roll: x[2] }, [`knee${S}`]: x[3] });
  const f = (x) => cost(rigNodesAt(R, at(x)).nodes, x);
  let best = null;
  for (let p = -30; p <= 55; p += 17) for (let y = yaw[0]; y <= yaw[1]; y += 15) for (let r = -45; r <= 45; r += 15) for (let k = 0; k <= 150; k += 25) { const x = [p, y, r, k], c = f(x); if (!best || c < best.c) best = { x, c }; }
  const LO = [-30, yaw[0], -45, 0], HI = [55, yaw[1], 45, 155];
  for (const step of [8, 4, 2, 1, 0.5]) {
    let moved = true;
    while (moved) { moved = false; for (let i = 0; i < 4; i++) for (const sg of [1, -1]) { const x = [...best.x]; x[i] = clamp(x[i] + sg * step, LO[i], HI[i]); const c = f(x); if (c < best.c - 1e-12) { best = { x, c }; moved = true; } } }
  }
  return { [`hip${S}`]: { pitch: r1(best.x[0]), yaw: r1(best.x[1]), roll: r1(best.x[2]) }, [`knee${S}`]: r1(best.x[3]), cost: best.c };
}
const sq = (v) => v * v;
/** a hand laid flat on the floor: the wrist bent (flex, deviation) until the knuckles lie at the wrist's height, a
 * finger's breadth over the floor */
export function flatHand(R, pose, S, floor, s) {
  const f = (x) => { const n = rigNodesAt(R, { ...pose, [`wrist${S}`]: { flex: x[0], deviation: x[1], twist: 0 } }).nodes; return sq(n[`knuckles${S}`][2] - floor - 0.018 * s) + 0.25 * sq(n[`knuckles${S}`][2] - n[`wrist${S}`][2]) + 1e-6 * (x[0] * x[0] + x[1] * x[1]); };
  let best = null; for (let a = -70; a <= 70; a += 10) for (let b = -30; b <= 20; b += 10) { const c = f([a, b]); if (!best || c < best.c) best = { x: [a, b], c }; }
  for (const st of [4, 2, 1]) { let moved = true; while (moved) { moved = false; for (let i = 0; i < 2; i++) for (const sg of [1, -1]) { const x = [...best.x]; x[i] = clamp(x[i] + sg * st, i ? -30 : -70, i ? 20 : 70); const c = f(x); if (c < best.c - 1e-12) { best = { x, c }; moved = true; } } } }
  return { [`wrist${S}`]: { flex: r1(best.x[0]), deviation: r1(best.x[1]), twist: 0 } };
}
const FLOOR_HANDS = new Set(['floorBehind', 'flung', 'flungLow', 'faceFloor', 'floorFront', 'front']);
/** a leg's joints kept above the floor (their flesh on it at most): a heavy penalty below */
const floorGuard = (R, n, S, floor, s) => { const L = R.legs[S]; let c = 0; for (const k of [L.knee, L.hock, L.toeBase, L.toeTip]) c += 400 * sq(Math.min(0, n[k][2] - fleshAt(k, R, s) - floor)); return c; };

// ─── the solve ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A rest pose on a rig: `name` a RESTS name or rest words. → { name, family, pose, seat (its geometry, world), props
 * (boxes to draw), face, contacts, effort, checks }.
 */
export function heroRest(name, R) {
  const P = typeof name === 'object' ? name : RESTS[name]; if (!P) throw new Error(`hero-rest: no rest pose '${name}' (have ${REST_NAMES.join(', ')})`);
  const out = P.family === 'lying' ? lying(P, R) : seated(P, R);
  const n = rigNodesAt(R, out.pose).nodes;
  // the effort the posture costs: what the body holds up itself (lying, the floor holds it all; a back on a backrest is
  // held by it, so only the arms count)
  let effort = null;
  if (P.family !== 'lying') {
    const e = effortOf(R, n, []), j = Object.fromEntries(Object.entries(e.joints).filter(([k]) => !(P.recline === 'back' && k === 'back')));
    const [limit, top] = Object.entries(j).reduce((b, x) => (x[1].mvc > b[1].mvc ? x : b));
    const cr10 = r1(Math.min(10, 10 * top.mvc));
    effort = { ...e, joints: j, limit, mvc: top.mvc, cr10, supported: P.recline === 'back' ? 'back' : null };
  }
  return { name: typeof name === 'string' ? name : 'own', family: P.family, ...(P.approx ? { approx: P.approx } : {}), pose: out.pose, seat: out.seat ?? null, props: out.props, face: faceOf(P.face), contacts: out.contacts, effort, checks: restChecks(R, P, out, n) };
}
const FACE_WORDS = { smile: { smile: 0.6, blink: 0.12 } };
const faceOf = (f) => ({ blink: 0, smile: 0, open: 0, brow: 0, ...(typeof f === 'string' ? FACE_WORDS[f] : f || {}) });

/** the seat's geometry in the world: the seat's top (z), its back edge (y, where the backrest stands), front, the
 * backrest's plane (a point and its forward normal) */
export function seatOf(P, R) {
  const H = heightOf(R), s = H / CANON_HEIGHT, S = SEATS[P.seat], floor = floorOf(R);
  const z = floor + S.height * H - S.sink, yb = -0.2 * s;
  const rc = rad(S.recline ?? 0);
  return { kind: P.seat, z, top: floor + S.height * H, yb, front: yb + S.depth * H, floor, s, S,
    back: S.recline !== undefined ? { at: [0, yb, floor + S.height * H], n: [0, Math.cos(rc), Math.sin(rc)], up: [0, -Math.sin(rc), Math.cos(rc)], tall: S.tall * H } : null };
}

/** the posture words a rest pose sets on the trunk and the head */
function trunkWords(P) {
  const h = P.head || {};
  return { spine: { sagittal: P.spine ?? 0, lateral: P.lean ?? 0, axial: 0 }, head: { pitch: h.pitch ?? 0, ...(h.turn ? { turn: h.turn } : {}), ...(h.tilt ? { yaw: h.tilt } : {}) } };
}

function seated(P, R) {
  const G = seatOf(P, R), s = G.s, J = R.joints, isch = ischOf(R);
  const contact = [0, G.yb + (P.sit ?? 0.08) * heightOf(R), G.z];
  // the body for a recline: the pelvis set so the sit bones land on the contact, the whole figure turned back about it
  const baseAt = (theta) => {
    const T = turnOf({ pitch: -theta }), at = sub(contact, T.apply(isch));
    return { T, at, pose: { support: 'none', sink: J.pelvisHub[2] - at[2], shift: { x: 0, y: at[1] }, body: { pitch: -theta, at, up: 0 }, ...trunkWords(P) } };
  };
  // the upper back's surface (a third of the way down from the neck's base, a trunk's depth behind its line)
  const backPoint = (n) => sub(lerp3(n.neckHub, n.navel, 0.35), mul(frontOf(n), 0.105 * s));
  let theta = typeof P.recline === 'number' ? P.recline : 0;
  if (P.recline === 'back') {
    // bisect the recline until the upper back meets the backrest
    let lo = -10, hi = 70;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, b = baseAt(m), n = rigNodesAt(R, b.pose).nodes; const d = dot(sub(backPoint(n), G.back.at), G.back.n); if (d > 0) lo = m; else hi = m; }
    theta = (lo + hi) / 2;
  }
  const B = baseAt(theta);
  let pose = B.pose;
  // the feet (world), then into the upright frame the legs are solved in
  const n0 = rigNodesAt(R, pose).nodes;
  const feet = {}, splay = {}, contacts = { sitBones: contact };
  for (const S of ['R', 'L']) {
    const F = P.feet[S], L = R.legs[S], side = S === 'R' ? 1 : -1, toeH = J[L.toeBase][2] - G.floor;
    const hip = n0[L.hip], tl = thighLen(R, S), ankleToToe = J[L.toeBase][1] - J[L.hock][1];
    let toe, sp = 0;
    if (F.at === 'under' || F.at === 'out') {
      // the thigh along the seat, the shin down from the knee (or out ahead of it)
      const kneeY = hip[1] + Math.cos(rad(theta)) * tl * 0.98;
      toe = [side * (F.apart ?? 0.08) * s + (F.at === 'out' ? side * 0.02 : 0), kneeY + ankleToToe + (F.fwd ?? 0) * s, G.floor + toeH];
      sp = F.at === 'out' ? 8 : 4;
    } else if (F.at === 'cross') {
      // out ahead, crossed at the ankles (the right over the left)
      const kneeY = hip[1] + tl;
      toe = [-side * 0.03 * s, kneeY + ankleToToe + (F.fwd ?? 0.3) * s, G.floor + toeH + (S === 'R' ? 0.06 * s : 0)];
      sp = -6;
    } else if (F.at === 'tuck' || F.at === 'lotus') {
      // the knees out (the foot's turn carries the knee's pole out), each foot on the floor under the other knee, or on
      // the other thigh near its knee (the knee falling between the hip and the foot: just off the floor)
      const kneeOf = (sd) => add(n0[R.legs[sd === 1 ? 'R' : 'L'].hip], mul(unit([sd * Math.sin(rad(52)), Math.cos(rad(52)), -0.12]), tl));
      const far = kneeOf(-side), farHip = n0[R.legs[S === 'R' ? 'L' : 'R'].hip];
      // (the shins cross a little past the middle: the far knee is further than a shin reaches)
      // a lotus foot sits up on the other leg: this rig's hip turns out 45° (figure-vajra LIMITS.hipRoll) and its leg
      // solve bends the knee toward a level pole, so a foot raised onto the far THIGH lifts the knee off the floor; the
      // foot rests on the far SHIN instead, the knees down (LOTUS_REACH says how near that comes to the thigh)
      toe = [-side * 0.09 * s, n0.pelvisHub[1] + (S === 'R' ? 0.3 : 0.24) * s, G.floor + toeH + (F.at === 'lotus' ? (S === 'R' ? 0.09 : 0.06) : (S === 'R' ? 0.035 : 0.06)) * s];
      if (F.at === 'lotus') contacts.lotus = { ...(contacts.lotus || {}), [S]: toe };
      sp = 74;
    } else if (F.at === 'fold') {
      // a leg folded flat: the foot planted before the pelvis, turned right out so the knee lies out to the side
      toe = [side * 0.02 * s, n0.pelvisHub[1] + 0.3 * s, G.floor + toeH + 0.075 * s];
      sp = 82;
    } else if (F.at === 'up') {
      // the knee up, the foot flat by the seat
      toe = [side * 0.11 * s, hip[1] + 0.32 * s, G.floor + toeH];
      sp = 6;
    }
    feet[S] = toe ? inReach(R, S, hip, toe, sp, B.T.M) : toe; splay[S] = sp;
  }
  // the folded legs: each searched for its ankle and knee (the knees out and down on the floor; a lotus foot on the other
  // thigh near its crease, a tucked one under the other knee, a folded one before the pelvis), the thighs carried past the
  // swivel's cone by the shared `seat`
  const folded = ['R', 'L'].filter((S) => !feet[S]);
  if (folded.length) {
    const knee = (n, S) => n[R.legs[S].knee], ankle = (n, S) => n[R.legs[S].hock];
    const kneeFloor = G.floor + 0.05 * s, floor0 = G.floor;
    const want = (S, n) => {
      const F = P.feet[S], side = S === 'R' ? 1 : -1, O = S === 'R' ? 'L' : 'R', hip = n[R.legs[S].hip];
      const k = knee(n, S), a = ankle(n, S);
      let c = 20 * sq(Math.max(0, k[2] - kneeFloor)) + 2 * sq(Math.min(0, k[2] - kneeFloor)) + sq(Math.max(0, 0.22 * s - side * (k[0] - n.pelvisHub[0]))) + floorGuard(R, n, S, floor0, s);
      if (F.at === 'lotus') { const t = add(lerp3(n[R.legs[O].hip], n[R.legs[O].knee], 0.25), [0, 0, 0.06 * s]); c += 4 * sq(dist(a, t)); }
      // (the shins crossed before the pelvis: the rig's hip turns out 45°, so a foot reaches the middle, not under the
      // far knee)
      else if (F.at === 'tuck') { const t = [-side * 0.04 * s, hip[1] + 0.26 * s + (S === 'R' ? 0.05 * s : 0), G.floor + 0.04 * s + (S === 'R' ? 0.04 * s : 0)]; c += 4 * sq(dist(a, t)); }
      else { const t = [side * 0.02 * s, hip[1] + 0.3 * s, G.floor + 0.055 * s]; c += 4 * sq(dist(a, t)); }
      return c;
    };
    let bestSeat = null;
    for (const seat of [0, 20, 40, 60]) {
      let p = { ...pose, seat };
      for (let it = 0; it < (folded.length > 1 ? 2 : 1); it++) for (const S of folded) { const w = legWords(R, p, S, (n) => want(S, n)); const { cost: _c, ...words } = w; p = { ...p, ...words }; }
      const n = rigNodesAt(R, p).nodes, c = folded.reduce((t, S) => t + want(S, n), 0);
      if (!bestSeat || c < bestSeat.c) bestSeat = { p, c };
    }
    pose = bestSeat.p;
    const n = rigNodesAt(R, pose).nodes; contacts.knees = Object.fromEntries(folded.map((S) => [S, knee(n, S)]));
  }
  const planted = ['R', 'L'].filter((S) => feet[S]);
  if (planted.length) pose = { ...pose, feet: Object.fromEntries(planted.map((S) => [S, toUpright(B.T, B.at, 0, feet[S])])), ...Object.fromEntries(planted.map((S) => [`splay${S}`, splay[S]])) };
  // a planted foot turns with the reclined body: its heel word turns it back flat on the floor (whichever way flattens it)
  if (planted.length && Math.abs(theta) > 0.5) {
    for (const S of planted) {
      const ankleZ = (h) => { try { const n = rigNodesAt(R, { ...pose, [`heel${S}`]: h }).nodes; return Math.abs(n[R.legs[S].hock][2] - J[R.legs[S].hock][2]); } catch { return Infinity; } };
      const h = [theta, -theta, 0].reduce((a, b) => (ankleZ(b) < ankleZ(a) ? b : a));
      if (h) pose = { ...pose, [`heel${S}`]: r1(h) };
    }
  }
  contacts.feet = Object.fromEntries(planted.map((S) => [S, feet[S]]));
  // the hands on their rests
  pose = handsOn(P, R, pose, G, contacts);
  return { pose, seat: G, props: propsOf(G, R), contacts, theta };
}
/** the body's forward (the chest's facing) on a posed body */
export const frontOf = (n) => { const lat = sub(n.shoulderR, n.shoulderL), up = sub(n.neckHub, n.pelvisHub); return unit([lat[1] * up[2] - lat[2] * up[1], lat[2] * up[0] - lat[0] * up[2], lat[0] * up[1] - lat[1] * up[0]].map((v) => -v)); };

/** each hand to its rest, the arm reaching it elbows down (hero-stance reachArm) */
function handsOn(P, R, pose, G, contacts) {
  const s = heightOf(R) / CANON_HEIGHT;
  const n = rigNodesAt(R, pose).nodes; const goals = {};
  const f = frontOf(n), up = unit(sub(n.neckHub, n.pelvisHub));
  for (const S of ['R', 'L']) {
    const w = P.hands?.[S]; if (!w) continue;
    const L = R.legs[S], side = S === 'R' ? 1 : -1, other = R.legs[S === 'R' ? 'L' : 'R'];
    const thigh = (Lg, t) => add(lerp3(n[Lg.hip], n[Lg.knee], t), [0, 0, 0.065 * s]);
    let g;
    if (w === 'thigh') g = thigh(L, 0.62);
    else if (w === 'lap') g = add(lerp3(thigh(L, 0.4), thigh(other, 0.4), 0.35), [0, 0, 0.01]);
    else if (w === 'knee') g = add(lerp3(n[L.hip], n[L.knee], 0.72), [0, 0, 0.065 * s]);
    else if (w === 'armrest') g = [side * (G.S.armOut * heightOf(R) - 0.02), n.pelvisHub[1] + 0.06 * s, G.floor + G.S.arm * heightOf(R) + 0.035 * s];
    else if (w === 'backTop') { const h = Math.min(n[`shoulder${S}`][2] - G.back.at[2], G.back.tall * G.back.up[2] + 0.02 * s), t = h / G.back.up[2]; g = add(add(G.back.at, mul(G.back.up, t)), add(mul(G.back.n, 0.03 * s), [n[`shoulder${S}`][0] + side * 0.4 * s, 0, 0])); }
    else if (w === 'floorBehind') g = [side * 0.21 * s, n.pelvisHub[1] - 0.1 * s, G.floor + 0.045 * s];
    else if (w === 'overKnee') g = add(n[L.knee], add(mul(f, 0.1 * s), [side * 0.02 * s, 0, -0.04 * s]));
    else if (w === 'belly') g = add(lerp3(n.pelvisHub, n.navel, 0.7), add(mul(f, 0.12 * s), [side * 0.05 * s, 0, 0]));
    else throw new Error(`hero-rest: no hand rest '${w}'`);
    goals[S] = g;
  }
  let p = pose;
  // (an arm draped along a backrest bends its elbow out and back along it, not down)
  for (const [S, g] of Object.entries(goals)) { const a = reachArm(R, p, S, g, null, P.hands[S] === 'backTop' ? { pole: [S === 'R' ? 1 : -1, -0.4, -0.3] } : {}); p = { ...p, [`sh${S}`]: a.sh, [`elbow${S}`]: a.elbow, [`fingers${S}`]: { ...HAND_POSES.relaxed } }; }
  contacts.hands = goals;
  p = elbowsDown(R, p);
  for (const S of Object.keys(goals)) if (FLOOR_HANDS.has(P.hands[S])) p = { ...p, ...flatHand(R, p, S, G.floor, s) };
  return p;
}

function lying(P, R) {
  const J = R.joints, s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R), T = turnOf(P.turn), at = [...J.pelvisHub];
  const trunk = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'hipL', 'hipR'];
  // the legs in the upright frame: hip and knee words (a bent leg), or a foot on the floor (world)
  const legPose = {};
  for (const S of ['R', 'L']) {
    const Lw = P.legs[S]; if (Lw.hip !== undefined) { legPose[`hip${S}`] = { pitch: Math.min(55, Lw.hip) }; legPose[`knee${S}`] = Lw.knee; if (Lw.hip > 55) legPose.seat = Math.min(60, Lw.hip - 55); }
  }
  const base = { support: 'none', ...trunkWords(P), ...legPose };
  // let down: the trunk's lowest flesh on the floor
  const upOf = (pose) => { const n = rigNodesAt(R, { ...pose, body: { ...P.turn, at, up: 0 } }).nodes; return floor - Math.min(...trunk.map((k) => n[k][2] - fleshOf(k, R))); };
  const up = upOf(base);
  let pose = { ...base, body: { ...P.turn, at, up } };
  // the legs laid on the floor where the pose puts them (searched: a free leg's foot follows its shin, so a knee drawn up
  // sets its sole down), or bent by their own words (a curl)
  const n0 = rigNodesAt(R, pose).nodes;
  const contacts = {}, along = unit(sub(n0.pelvisHub, n0.neckHub)), lat = unit(sub(n0.hipR, n0.hipL));
  const onFloorAt = (k, n) => n[k][2] - fleshAt(k, R, s) - floor;
  const legGoals = {};
  for (const S of ['R', 'L']) {
    const Lw = P.legs[S], L = R.legs[S], side = S === 'R' ? 1 : -1;
    if (Lw.hip !== undefined) {
      // a curled leg: near its words, kept off the floor, a limp one let down onto it
      const w = legWords(R, pose, S, (n, x) => 0.002 * (sq(x[0] - Math.min(55, Lw.hip)) + sq(x[3] - Lw.knee)) + floorGuard(R, n, S, floor, s) + (P.limp ? 2 * sq(Math.max(0, Math.min(onFloorAt(L.knee, n), onFloorAt(L.hock, n)))) : 0));
      const { cost: _c, ...words } = w; pose = { ...pose, ...words }; continue;
    }
    const hip = n0[L.hip], legLen = thighLen(R, S) + shinLen(R, S);
    const ankleAt = Lw.up ? add(add(hip, mul(along, 0.62 * legLen)), mul(lat, side * 0.05 * s)) : add(add(hip, mul(along, 0.93 * legLen)), mul(lat, side * (Lw.flat ?? 0.1) * s));
    legGoals[S] = [ankleAt[0], ankleAt[1], floor + 0.035 * s];
    const w = legWords(R, pose, S, (n) => 4 * sq(dist(n[L.hock], legGoals[S])) + (Lw.up ? 0 : 2 * sq(Math.max(0, onFloorAt(L.knee, n)))) + floorGuard(R, n, S, floor, s));
    const { cost: _c, ...words } = w; pose = { ...pose, ...words };
  }
  contacts.ankles = legGoals;
  // the hands: each on the floor or the body where the pose lays it
  const n1 = rigNodesAt(R, pose).nodes, F = frontOf(n1), headUp = unit(sub(n1.headTop, n1.neckHub));
  const onFloor = (p) => [p[0], p[1], floor + 0.04 * s];
  const goals = {};
  for (const S of ['R', 'L']) {
    const w = P.hands?.[S]; if (!w) continue;
    const sh = n1[`shoulder${S}`], side = S === 'R' ? 1 : -1, lat = unit(sub(n1.shoulderR, n1.shoulderL));
    let g;
    if (w === 'belly') g = add(lerp3(n1.pelvisHub, n1.navel, 0.75), add(mul(F, 0.12 * s), mul(lat, side * 0.05 * s)));
    else if (w === 'flung') g = onFloor(add(sh, add(mul(lat, side * 0.42 * s), mul(headUp, 0.25 * s))));
    else if (w === 'flungLow') g = onFloor(add(sh, add(mul(lat, side * 0.4 * s), mul(headUp, -0.2 * s))));
    else if (w === 'pillow') g = add(n1.headBase, add(mul(F, 0.07 * s), mul(headUp, 0.04 * s)));
    else if (w === 'front') g = add(onFloor(add(lerp3(n1.navel, n1.pelvisHub, 0.4), mul(F, 0.2 * s))), [0, 0, 0.03 * s]);
    else if (w === 'faceFloor') g = onFloor(add(n1.headBase, add(mul(F, 0.14 * s), mul(headUp, 0.08 * s))));
    else if (w === 'floorFront') g = onFloor(add(lerp3(n1.navel, n1.neckHub, 0.3), mul(F, 0.17 * s)));
    else throw new Error(`hero-rest: no hand rest '${w}'`);
    goals[S] = g;
  }
  // (a lying arm bends its elbow away from the floor, or out along it when the arm lies on it: never down through it)
  const poleOf = (S, w) => { const side = S === 'R' ? 1 : -1, lat = unit(sub(n1.shoulderR, n1.shoulderL)); return /^flung|belly/.test(w) ? mul(lat, side) : w === 'faceFloor' ? add(F, [0, 0, 0.6]) : w === 'floorFront' ? add(F, [0, 0, -0.5]) : [0, 0, 1]; };
  for (const [S, g] of Object.entries(goals)) { const a = reachArm(R, pose, S, g, null, { pole: poleOf(S, P.hands[S]) }); pose = { ...pose, [`sh${S}`]: a.sh, [`elbow${S}`]: a.elbow, [`fingers${S}`]: { ...HAND_POSES.relaxed } }; }
  pose = elbowsDown(R, pose);
  for (const S of Object.keys(goals)) if (FLOOR_HANDS.has(P.hands[S])) pose = { ...pose, ...flatHand(R, pose, S, floor, s) };
  contacts.hands = goals;
  const props = P.crater ? craterOf(rigNodesAt(R, pose).nodes, floor, s) : [];
  return { pose, contacts, props, floor };
}

// ─── the props ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** boxes [lo, hi, colour] (world, or in a frame turned `tilt` degrees back about x through `pivot`) */
function propsOf(G, R) {
  if (G.kind === 'floor') return [];
  const H = heightOf(R), s = G.s, S = G.S, w = S.width * H, out = [];
  // (a couch runs off to the left of the seat the body takes, by its right armrest)
  const x0 = G.kind === 'couch' ? S.armOut * H - w / 2 : 0;
  const box = (lo, hi, colour, tilt = 0, pivot = null) => out.push({ lo, hi, colour, tilt, pivot });
  const z0 = G.floor, zt = G.top, th = G.kind === 'couch' ? 0.1 * H : 0.025 * s;
  box([x0 - w / 2, G.yb, zt - th], [x0 + w / 2, G.front, zt], G.kind === 'couch' ? CUSHION : WOOD);
  if (G.kind === 'chair') for (const [x, y] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) { const px = x * (w / 2 - 0.02 * s), py = y ? G.front - 0.02 * s : G.yb + 0.02 * s; box([px - 0.015 * s, py - 0.015 * s, z0], [px + 0.015 * s, py + 0.015 * s, zt - th], WOOD); }
  else box([x0 - w / 2, G.yb, z0], [x0 + w / 2, G.front, zt - th], FABRIC);
  // the backrest, leaning back about its foot
  box([x0 - w / 2, G.yb - (G.kind === 'couch' ? 0.12 * H : 0.02 * s), zt], [x0 + w / 2, G.yb, zt + S.tall * H], G.kind === 'couch' ? FABRIC : WOOD, S.recline, [0, G.yb, zt]);
  if (G.kind === 'couch') for (const xa of [x0 + w / 2, x0 - w / 2 - 0.12 * H]) box([xa, G.yb - 0.12 * H, z0], [xa + 0.12 * H, G.front, z0 + S.arm * H], FABRIC);
  return out;
}
/** a shallow crater round where the body lies: a ring of rubble boxes */
function craterOf(n, floor, s) {
  const c = lerp3(n.pelvisHub, n.neckHub, 0.3), out = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI, r = 0.85 * s, x = c[0] + r * Math.cos(a), y = c[1] + r * Math.sin(a), h = (0.06 + 0.05 * ((i * 7) % 3)) * s; out.push({ lo: [x - 0.12 * s, y - 0.12 * s, floor - 0.01], hi: [x + 0.12 * s, y + 0.12 * s, floor + h], colour: i % 2 ? '#7d6b55' : '#8e7b62', tilt: 0, pivot: null }); }
  return out;
}
/** a prop's triangles: [{ p, colour }] */
export function restTriangles(rest) {
  const out = [];
  for (const b of rest.props) {
    const { lo, hi } = b; const turn = (p) => { if (!b.tilt) return p; const a = rad(b.tilt), c = Math.cos(a), sn = Math.sin(a), q = sub(p, b.pivot); return add(b.pivot, [q[0], q[1] * c - q[2] * sn, q[1] * sn + q[2] * c]); };
    const v = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => turn([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]));
    for (const [a, bb, c, d] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) { out.push({ p: [v[a], v[bb], v[c]], colour: b.colour }); out.push({ p: [v[a], v[c], v[d]], colour: b.colour }); }
  }
  return out;
}

// ─── the checks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** how near (m) a lotus foot must rest on the other leg (its shin or thigh, the flesh round it) */
export const LOTUS_REACH = 0.06;
export const BODY_JOINTS = ['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'knucklesL', 'knucklesR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeBaseL', 'toeBaseR', 'toeTipL', 'toeTipR'];
/** the flesh round a joint (hero-jump's, an ankle's and a hand's own radius rather than their standing heights) */
export const fleshAt = (k, R, s) => (/^ankle/.test(k) ? 0.03 * s : /^wrist/.test(k) ? 0.025 * s : /^knuckles/.test(k) ? 0.015 * s : fleshOf(k, R));
/**
 * The machine gate on a rest pose: contacts (m: the sit bones off the seat, the upper back off the backrest, each foot
 * and hand off its rest); floor (m: the lowest flesh below the floor, + clear); knees (degrees of flexion) and hips (the
 * thigh's angle off the trunk's line down, and how far it is turned out); balance (m: an upright seated body's centre
 * of mass inside its sit bones and feet); rests (a limp body: each limb's lowest flesh off the floor); laws.
 */
function restChecks(R, P, out, n) {
  const s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R), contacts = {};
  const sitPts = () => { const T = n.$body?.M; const c = add(n.pelvisHub, T ? mv(T, ischOf(R)) : ischOf(R)); return c; };
  if (P.family === 'seated') {
    const G = out.seat; contacts.sitBones = r4(Math.abs(sitPts()[2] - G.z));
    if (P.recline === 'back') { const f = frontOf(n), c = sub(lerp3(n.neckHub, n.navel, 0.35), mul(f, 0.105 * s)); contacts.back = r4(Math.abs(dot(sub(c, G.back.at), G.back.n))); }
  }
  contacts.feet = Object.fromEntries(Object.entries(out.contacts.feet || {}).map(([S, p]) => [S, r4(dist(n[R.legs[S].toeBase], p))]));
  if (out.contacts.ankles) contacts.ankles = Object.fromEntries(Object.entries(out.contacts.ankles).map(([S, p]) => [S, r4(dist(n[R.legs[S].hock], p))]));
  if (P.feet?.R?.at === 'lotus') contacts.lotus = Object.fromEntries(['R', 'L'].map((S) => { const O = R.legs[S === 'R' ? 'L' : 'R'], a = n[R.legs[S].hock]; const seg = (p0, p1, r) => { const ab = sub(p1, p0), t = clamp(dot(sub(a, p0), ab) / dot(ab, ab), 0, 1); return dist(a, add(p0, mul(ab, t))) - r; }; return [S, r4(Math.min(seg(n[O.hip], n[O.knee], 0.07 * s), seg(n[O.knee], n[O.hock], 0.05 * s)))]; }));
  if (out.contacts.knees) contacts.kneesDown = Object.fromEntries(Object.keys(out.contacts.knees).map((S) => [S, r4(n[R.legs[S].knee][2] - fleshAt(R.legs[S].knee, R, s) - floor)]));
  contacts.hands = Object.fromEntries(Object.entries(out.contacts.hands || {}).map(([S, p]) => [S, r4(dist(n[`wrist${S}`], p))]));
  // the body's own joints with the flesh round each (a seated pelvis's floor is its sit bones, checked as a contact)
  let low = Infinity, lowAt = null;
  for (const k of BODY_JOINTS) { if (!n[k] || (k === 'pelvisHub' && P.family === 'seated')) continue; const d = n[k][2] - fleshAt(k, R, s) - floor; if (d < low) { low = d; lowAt = k; } }
  const knees = {}, hips = {};
  for (const S of ['R', 'L']) {
    const L = R.legs[S]; knees[S] = r1(180 - angle(sub(n[L.hip], n[L.knee]), sub(n[L.hock], n[L.knee])));
    const trunkDown = sub(n.pelvisHub, n.neckHub), thigh = sub(n[L.knee], n[L.hip]);
    hips[S] = r1(angle(trunkDown, thigh));
  }
  let balance = null;
  if (P.family === 'seated' && P.recline !== 'back') {
    const c = comOf(n), T = n.$body?.M, isch = (x) => add(add(n.pelvisHub, [x, 0, 0]), T ? mv(T, ischOf(R)) : ischOf(R));
    const pts = [isch(0.06 * s), isch(-0.06 * s)];
    for (const S of ['R', 'L']) { const L = R.legs[S]; for (const k of [L.toeBase, L.toeTip, L.hock, L.knee]) if (n[k][2] - fleshAt(k, R, s) - floor < 0.06) pts.push(n[k]); }
    for (const S of ['R', 'L']) if (out.contacts.hands?.[S] && n[`wrist${S}`][2] - floor < 0.06) pts.push(n[`wrist${S}`]);
    balance = r4(margin(hull(pts.map((p) => [p[0], p[1]])), c));
  }
  let rests = null;
  if (P.limp) rests = Object.fromEntries(['R', 'L'].flatMap((S) => [[`arm${S}`, r4(Math.min(...[`elbow${S}`, `wrist${S}`].map((k) => n[k][2] - fleshOf(k, R) - floor)))], [`leg${S}`, r4(Math.min(...[R.legs[S].knee, R.legs[S].hock].map((k) => n[k][2] - fleshOf(k, R) - floor)))]]));
  const laws = {
    ...(contacts.sitBones !== undefined ? { seated: contacts.sitBones < 0.012 } : {}),
    ...(contacts.back !== undefined ? { back: contacts.back < 0.012 } : {}),
    feet: Object.values(contacts.feet).every((d) => d < 0.015), hands: Object.values(contacts.hands).every((d) => d < 0.03),
    ...(contacts.ankles ? { ankles: Object.values(contacts.ankles).every((d) => d < 0.04) } : {}),
    // (a lotus foot rests on the other leg: see the seated solve for why on its shin)
    ...(contacts.lotus ? { lotus: Object.values(contacts.lotus).every((d) => d > -0.02 && d < LOTUS_REACH) } : {}),
    ...(contacts.kneesDown ? { kneesDown: Object.values(contacts.kneesDown).every((d) => d < 0.06) } : {}),
    floor: low > -0.015, knees: Object.values(knees).every((k) => k <= 162), hips: Object.values(hips).every((h) => h <= 140),
    ...(balance !== null ? { balance: balance > 0.005 } : {}),
    ...(rests ? { limp: Object.values(rests).every((d) => d < 0.06) } : {}),
  };
  return { contacts, floor: r4(low), floorAt: lowAt, knees, hips, balance, rests, laws };
}
