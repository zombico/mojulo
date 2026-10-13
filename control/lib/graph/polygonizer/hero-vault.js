// hero-vault — clearing a LOW OBSTACLE out of the run (the free-run library): a box to about the hip, cleared by base
// athletics and practical parkour without breaking the gait. A clip is a ROUTE of contact STATES in the obstacle's frame
// (the near face at y = 0, the top at h over the floor, the depth d along the run), opened and closed by the gait's own
// frames — it starts on the take-off foot's touchdown in the jog or the sprint and ends on the landing foot's toe-off, so
// the run plays into it and out of it with nothing to blend.
//
//   • THE FLIGHTS are ballistic. Off the ground the centre of mass flies a parabola under g at the speed it left with (the
//     pose words turn the limbs about it; the pelvis is placed under the flying centre), so the take-off's upward speed is
//     what the air time and the heights ask, never authored.
//   • WHERE IT TAKES OFF is solved. The hands land where the arms reach at the hand-on moment, and the obstacle is where
//     that puts them (a few centimetres past the near edge; on a deep table further along); for the hurdle, the air time
//     is the least that clears the box by the margin and the box sits where the clearance is best. The take-off distance
//     is then the take-off toe to the near face.
//   • THE HEIGHTS over the top are solved. Each support state's pelvis is the least that clears the box with that state's
//     own pose (the limbs on the top excused) and the most at which its held hands still reach their points; frames
//     between that still graze the top are lifted by a smoothed envelope — a correction off the parabolas the gate holds
//     to LIFT_MAX, so it is never what carries a body over.
//   • THE CONTACTS hold. A foot on the floor or the top keeps its spot; a hand on the top keeps its point, the arm solved
//     frame by frame from where it was, the palm laid flat as it comes on; a limb eases onto a contact and off it.
//   • A KNEE DRIVEN past level is real: a hip word past the swivel's cone (HIP_CONE) is carried on by the rig's seat<S>.
//
// The moves (each from either foot — `<name>` takes off from the left, `<name>Left` from the right) and the bands the
// gate holds them in (the box's height as a share of the figure's hip height, its depth in metres; see VAULTS):
//   hurdle      a hurdler's leap over a thin box: the lead leg over straight, the trail turned out round the side
//   stepVault   the safety vault's practical form, out of the jog: a hand on the top, the same-side foot stepped up beside
//               it, the free leg swung over and down the far side
//   speedVault  the sprint's vault over a thin box: one hand touching the top, the body turned and reclined, the legs
//               together over beside the hand
//   kongVault   the sprint's vault over a table: a dive onto both hands, the knees tucked up through between them
//
// freeRun(state, obstacle, R) is the SOLVER: from the frame the runner is in (the gait and its phase), the obstacle's
// height, depth and distance, it picks the move (by band, depth and speed), the take-off foot and the strides to it (the
// next few steps stretched within ±STRETCH so the take-off toe falls on the solved spot), or says why none does.
// Pure and deterministic.
import { rigNodesAt } from './station-loft-rig.js';
import { elbowsDown, elbowDownRoll } from './hero-elbow.js';
import { reachArm } from './hero-stance.js';
import { curve, mirrored } from './hero-jump.js';
import { heroLocomotion, motionPlan } from './hero-motion.js';
import { heightOf, floorOf, BODY_JOINTS, fleshAt, flatHand } from './hero-rest.js';
import { CANON_HEIGHT } from './hero-gear.js';
import { MASS } from './figure-balance.js';
import { liteOf } from './hero-grip.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), dist = (a, b) => len(sub(a, b));
const lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const angle = (a, b) => deg(Math.acos(clamp(dot(a, b) / ((len(a) * len(b)) || 1), -1, 1)));
const r1 = (x) => +x.toFixed(1), r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
const minJerk = (m) => { const x = clamp(m, 0, 1); return x * x * x * (10 - 15 * x + 6 * x * x); };
const SIDES = ['L', 'R'];
const other = (S) => (S === 'L' ? 'R' : 'L');
const G = 9.81;
const FPS = 30, FINE = 60;          // the keys at 30 a second; solved at 60
const LAND = 0.06, LEAVE = 0.05, TOP_LAND = 0.05;   // seconds a foot eases onto a contact before it, and off one after it
const HAND_ON = 0.08, HAND_OFF = 0.06;
const REACH_AHEAD = 0.25;           // seconds before a hand's contact it counts as coming down onto the top
const SPEED_OVER = 1.5;             // a vault's fastest limb point (relative to the pelvis) may outrun the gait's own by half again
const LIFT_MAX = 0.08;              // metres the clearance lift may add at most (the law)
const ROOM = 0.2;                   // metres a hurdle leaves between each foot and the box (a foot's length)
const LIFT_SPAN = 0.06;             // seconds either side a frame's clearance lift is spread over
const SWING_EASE = 0.16;            // seconds the gait's swing leg eases to (and from) the move's at the ends
const MARGIN = 0.03;                // metres every part of the body clears the box by (its flesh round it), the contacts aside
export const STRETCH = 0.2;         // the most an approach stride is lengthened or shortened (a share: a long jumper's last strides)
export const VZ_MAX = 3.2;          // m/s: the most upward speed a running take-off gives (a high jumper's is about 4.5)

// ─── the moves ────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each is written for the LEFT foot taking off (the right leading); the right foot's is its mirror. A move's keys are its
// authored states between the gait's own: `name`, `dt` (seconds from the state before; a flight's inner states take a
// share `at` of it instead), the pose words (the rig's: hinge, spine, hips, knees, shoulders, elbows, head, facing), the
// contacts it holds (`feet` / `hands`: { side: 'floor' | 'top' } where the limb comes to rest there, 'hold' keeping it),
// `air` (the span to the next state is a flight), the pelvis height rule (`z`: 'reach' — the hands just on the top — or
// { rise } metres over the state before, or { over } that share of the leg's length over the top; never lower than the
// pose clears the box) and `v` (its run speed, a share of the gait's). `push` is the take-off's words, `rise` the first
// flight's inner states, `flight` the last flight's, `fall` its seconds, `land` the landing's words over the gait's,
// `landing` the foot that lands ('L' the take-off foot), `station` where the hand lands past the near edge (metres, or of
// the depth), `band` per gait and `depth` where the gate holds it.
const arms = (pL, eL, pR, eR, more = {}) => ({ shL: { pitch: pL, ...(more.L || {}) }, elbowL: eL, shR: { pitch: pR, ...(more.R || {}) }, elbowR: eR });
const legs = (hL, kL, hR, kR) => ({ hipL: typeof hL === 'number' ? { pitch: hL } : hL, kneeL: kL, hipR: typeof hR === 'number' ? { pitch: hR } : hR, kneeR: kR });

export const VAULTS = Object.freeze({
  // THE HURDLE: the trail (left) foot drives off, the lead knee drives up and the lead leg reaches out straight over the
  // box, the trunk diving over it, the opposite arm reaching; the trail leg comes round turned out at the side, high, and
  // through to the front as the lead foot comes down. The air time is solved for the clearance.
  hurdle: {
    from: ['jog', 'sprint'], band: { jog: [0.2, 0.75], sprint: [0.2, 0.95] }, depth: [0, 0.2], station: null,
    push: { hinge: 28, ...legs(-22, 12, 72, 70), ...arms(85, 25, -40, 80), head: { pitch: 18 }, heelL: -35 },
    flight: [
      { name: 'over', at: 0.45, words: { hinge: 40, ...legs({ pitch: 10, yaw: 60 }, 100, 85, 8), ...arms(95, 10, -45, 85), head: { pitch: 26 } } },
      { name: 'reach', at: 0.78, words: { hinge: 24, ...legs({ pitch: 48, yaw: 35 }, 105, 38, 8), ...arms(40, 50, -10, 84), head: { pitch: 16 } } },
    ],
    landing: 'R',
    land: { hipL: { pitch: 58, yaw: 12 }, kneeL: 105 },
  },
  // THE STEP VAULT: off the left foot, the right hand onto the top and the right foot beside it (a step up onto the
  // box), the left leg swinging over beside the planted foot and down the far side; the left foot lands, the right comes
  // off the top behind.
  stepVault: {
    from: ['jog'], band: { jog: [0.65, 0.9] }, depth: [0.25, 0.4], station: 0.24,
    push: { hinge: 28, ...legs(-20, 15, 75, 105), ...arms(90, 40, 70, 20), head: { pitch: 20 }, heelL: -38 },
    keys: [
      { name: 'handOn', dt: 0.15, words: { hinge: 40, ...legs(-10, 45, 95, 148), ...arms(120, 30, 62, 20), head: { pitch: 42 } }, hands: { R: 'top' }, z: 'reach', v: 0.88 },
      { name: 'rise', dt: 0.08, words: { hinge: 40, ...legs(15, 115, 70, 110), ...arms(110, 30, 45, 15), head: { pitch: 30 } }, feet: { R: 'top' }, z: { over: 0.25 }, v: 0.86 },
      { name: 'through', dt: 0.1, words: { hinge: 18, ...legs({ pitch: 85, yaw: -8 }, 110, 48, 85), ...arms(100, 30, 60, 60), head: { pitch: 12 } }, feet: { R: 'hold' }, z: { over: 0.4 }, v: 0.9 },
      { name: 'off', dt: 0.09, words: { hinge: 14, ...legs(80, 100, -15, 115), ...arms(80, 30, 25, 30), head: { pitch: 10 } }, feet: { R: 'hold' }, z: { over: 0.48 }, v: 1, air: true },
    ],
    fall: 0.32,
    flight: [{ name: 'tuckTrail', at: 0.45, words: { hinge: 16, ...legs(65, 60, 10, 115), ...arms(70, 30, 40, 40), head: { pitch: 10 } } }],
    land: { hipR: { pitch: 15 }, kneeR: 115 },
  },
  // THE SPEED VAULT: off the left foot, the right knee driving, the body turning to the right and reclining onto the
  // left hand on the top; the legs go over together beside it, the hand pushes off, the right foot lands and runs out.
  speedVault: {
    from: ['sprint'], band: { sprint: [0.45, 0.8] }, depth: [0.1, 0.3], station: 0.05,
    push: { hinge: 14, facing: -10, ...legs(-20, 15, 78, 85), ...arms(55, 20, 25, 45), head: { pitch: 14 }, heelL: -30 },
    rise: [{ name: 'tuckIn', at: 0.3, words: { hinge: 10, facing: -18, ...legs(30, 85, 88, 60), ...arms(20, 30, 45, 40), head: { pitch: 12 } }, roll: -4, pitch: -12 },
      { name: 'gather', at: 0.62, words: { hinge: 4, facing: -28, spine: { sagittal: -0.08, lateral: 0.06 }, ...legs(82, 60, 92, 35), ...arms(-10, 30, 60, 40), head: { pitch: 10 } }, roll: -12, pitch: -32 }],
    keys: [
      { name: 'handOn', dt: 0.22, words: { hinge: 0, facing: -35, spine: { sagittal: -0.12, lateral: 0.12 }, ...legs(90, 60, 92, 8), ...arms(-35, 30, 70, 40, { R: { yaw: 30 } }), head: { pitch: 6 } }, roll: -18, pitch: -30, hands: { L: 'top' }, z: 'reach', v: 0.95, air: false },
      { name: 'over', dt: 0.13, words: { hinge: -4, facing: -45, spine: { sagittal: -0.16, lateral: 0.16 }, ...legs(90, 8, 92, 6), ...arms(-60, 10, 80, 40, { R: { yaw: 35 } }), head: { pitch: 8 } }, roll: -28, pitch: -35, z: { over: 0.3 }, v: 0.92, air: true },
    ],
    fall: 0.2,
    flight: [{ name: 'unwind', at: 0.55, words: { hinge: 8, facing: -15, spine: { sagittal: -0.04, lateral: 0.04 }, ...legs(55, 60, 45, 15), ...arms(40, 30, 55, 40), head: { pitch: 10 } }, roll: -6, pitch: -4 }],
    landing: 'R',
    land: { hipL: { pitch: 50 }, kneeL: 90 },
  },
  // THE KONG VAULT: off the left foot in a dive, both hands onto the top, the knees tucked up through between the arms
  // as the hands push the body on, the right leg reaching down the far side to land and run out.
  kongVault: {
    from: ['sprint'], band: { sprint: [0.35, 0.8] }, depth: [0.5, 1.1], station: (d) => clamp(d - 0.5, 0.12, 0.6),
    push: { hinge: 22, ...legs(-22, 10, 50, 80), ...arms(100, 20, 100, 20), head: { pitch: 30 }, heelL: -35 },
    keys: [
      { name: 'handsOn', dt: 0.2, words: { hinge: 12, ...legs(-8, 35, 0, 45), ...arms(110, 35, 110, 35), head: { pitch: 45 } }, pitch: 62, hands: { L: 'top', R: 'top' }, z: 'reach', v: 0.96 },
      { name: 'press', dt: 0.04, words: { hinge: 18, ...legs(5, 80, 5, 80), ...arms(80, 15, 80, 15), head: { pitch: 40 } }, pitch: 58, hands: { L: 'hold', R: 'hold' }, z: { rise: 0.14 }, v: 0.95 },
      { name: 'pushOff', dt: 0.05, words: { hinge: 30, ...legs(40, 125, 40, 125), ...arms(40, 5, 40, 5), head: { pitch: 35 } }, pitch: 50, hands: { L: 'hold', R: 'hold' }, z: { rise: 0.04 }, v: 0.95, air: true },
    ],
    fall: 0.36,
    flight: [
      { name: 'tuck', at: 0.18, words: { hinge: 25, ...legs(62, 135, 62, 135), ...arms(10, 30, 10, 30), head: { pitch: 30 } }, pitch: 30 },
      { name: 'carry', at: 0.6, words: { hinge: 22, ...legs(62, 130, 60, 125), ...arms(50, 30, 50, 30), head: { pitch: 26 } }, pitch: 20 },
      { name: 'open', at: 0.78, words: { hinge: 26, ...legs(55, 100, 50, 60), ...arms(80, 30, 80, 30), head: { pitch: 20 } }, pitch: 2 },
      { name: 'reach', at: 0.88, words: { hinge: 20, ...legs(50, 95, 42, 18), ...arms(55, 40, 35, 60), head: { pitch: 14 } } },
    ],
    landing: 'R',
    land: { hipL: { pitch: 55 }, kneeL: 100 },
  },
});
export const VAULT_NAMES = Object.freeze(Object.keys(VAULTS).flatMap((n) => [n, `${n}Left`]));

// ─── the gait's frames ────────────────────────────────────────────────────────────────────────────────────────────────
const NON_WORDS = new Set(['support', 'sink', 'shift', 'body', 'feet', 'lift', 'plant', 'crouch', 'heelLift']);
const wordsOf = (pose) => Object.fromEntries(Object.entries(pose).filter(([k]) => !NON_WORDS.has(k)));
const gaitCache = new WeakMap();
/** the gait (walk | jog | sprint) baked on the rig: its clip, cycle seconds, ground speed and each foot's stance */
function gaitOn(R, from) {
  const memo = gaitCache.get(R) || {}; if (memo[from]) return memo[from];
  const G0 = motionPlan({ [from]: true })?.[from]; if (!G0?.spec) throw new Error(`hero-vault: no gait '${from}' (walk, jog, sprint)`);
  const loco = heroLocomotion(G0.spec, R, { tilt: G0.tilt ?? 0 });
  const out = { name: from, loco, seconds: G0.seconds, v: loco.travel / G0.seconds, stance: loco.stance };
  memo[from] = out; gaitCache.set(R, memo); return out;
}
const inStance = (st, phase) => { const u = (((phase - st.t0) % 1) + 1) % 1; return u <= st.span + 1e-9; };
/** a gait frame as a state: the words (the arms' elbow-down roll taken back out: every frame is rolled as it plays), the
 * pelvis and the planted toes (rig frame, the clip in place) */
function gaitFrame(R, g, phase) {
  const ph = ((phase % 1) + 1) % 1, pose = g.loco.fn(ph), n = rigNodesAt(R, pose).nodes, words = wordsOf(pose);
  for (const S of SIDES) { const sh = words[`sh${S}`]; if (sh && Number.isFinite(sh.pitch)) words[`sh${S}`] = { ...sh, roll: (sh.roll || 0) - elbowDownRoll(R, S, sh.pitch) }; }
  const on = (S) => g.stance[S] && inStance(g.stance[S], ph);
  const feet = Object.fromEntries(SIDES.filter(on).map((S) => [S, n[R.legs[S].toeBase]]));
  // (a swing foot is the gait's target too — its leg solved to it — kept relative to the pelvis, so the clip meets the
  // gait's own leg at its ends and eases from it)
  const swing = Object.fromEntries(SIDES.filter((S) => !on(S) && pose.feet?.[S]).map((S) => [S, sub(pose.feet[S], n.pelvisHub)]));
  const h = 1e-3, z = (p) => rigNodesAt(R, g.loco.fn((((p % 1) + 1) % 1))).nodes.pelvisHub[2];
  return { words, W: n.pelvisHub, feet, swing, vz: (z(ph + h) - z(ph - h)) / (2 * h * g.seconds), phase: ph };
}

// ─── placing a pose ───────────────────────────────────────────────────────────────────────────────────────────────────
/** the whole-figure turn (hero-rest turnOf's: `roll` to the right, then `pitch` forward) as a matrix */
function turnM({ pitch = 0, roll = 0 }) {
  const rot = (v) => { let q = v; if (roll) { const a = rad(roll), c = Math.cos(a), s = Math.sin(a); q = [q[0] * c + q[2] * s, q[1], -q[0] * s + q[2] * c]; } if (pitch) { const a = rad(-pitch), c = Math.cos(a), s = Math.sin(a); q = [q[0], q[1] * c - q[2] * s, q[1] * s + q[2] * c]; } return q; };
  const cols = [rot([1, 0, 0]), rot([0, 1, 0]), rot([0, 0, 1])]; return [0, 1, 2].map((r) => cols.map((c) => c[r]));
}
const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
/** a toe target pulled in to what the leg reaches from its hip (hero-rise's) */
function reachToe(R, S, hip, toe, pose) {
  const J = R.joints, L = R.legs[S], max = 0.995 * (dist(J[L.hip], J[L.knee]) + dist(J[L.knee], J[L.hock]));
  const h = rad(pose[`heel${S}`] || 0); let o = sub(J[L.hock], J[L.toeBase]);
  o = [o[0], o[1] * Math.cos(h) - o[2] * Math.sin(h), o[1] * Math.sin(h) + o[2] * Math.cos(h)];
  const hockAt = (t) => add(lerp3(hip, toe, t), o);
  if (dist(hip, hockAt(1)) <= max) return toe;
  let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (dist(hip, hockAt(m)) <= max) lo = m; else hi = m; }
  return lerp3(hip, toe, lo);
}
/** a hip word past the swivel's cone (HIP_CONE) carried on by the rig's seat<S> for that leg (a knee driven up past level) */
export const HIP_CONE = 62;
function deepHips(words) {
  let out = words;
  for (const S of SIDES) { const h = words[`hip${S}`]; if (h && h.pitch > HIP_CONE) { if (out === words) out = { ...words }; out[`hip${S}`] = { ...h, pitch: HIP_CONE }; out[`seat${S}`] = Math.min(60, h.pitch - HIP_CONE); } }
  return out;
}
/** the pelvis's place under the words alone (the words may carry it: a gait's sway) */
const baseCache = new WeakMap();
function baseOf(R, words) { return rigNodesAt(liteOf(R), { ...words, support: 'none' }).nodes.pelvisHub; }
/**
 * A pose from a placement: the words, the pelvis at `W` (world), the figure turned (`pitch`, `roll`) about it, each
 * planted toe at its world spot — carried into the upright frame the legs are solved in, inside the leg's reach.
 */
function placeAt(R, { words: w0, W, pitch = 0, roll = 0, feet = {} }) {
  const words = deepHips(w0), b = baseOf(R, words), dz = W[2] - b[2], sink = Math.max(0, -dz), up = Math.max(0, dz), at = [W[0], W[1], b[2] - sink];
  const turned = Math.abs(pitch) > 1e-9 || Math.abs(roll) > 1e-9 || up > 1e-9;
  const pose = { ...words, support: 'none', sink, shift: { x: W[0] - b[0], y: W[1] - b[1] }, ...(turned ? { body: { pitch, roll, at, up } } : {}) };
  const planted = SIDES.filter((S) => feet[S]); if (!planted.length) return pose;
  const M = turnM({ pitch, roll }), toUp = (p) => add(at, mtv(M, sub(sub(p, [0, 0, up]), at)));
  const free = rigNodesAt(R, pose).nodes, upright = free.$body?.unrot ?? free;
  return { ...pose, feet: Object.fromEntries(planted.map((S) => [S, reachToe(R, S, upright[R.legs[S].hip], toUp(feet[S]), pose)])) };
}
/** the centre of mass (figure-balance's segment masses on the rig's joints) */
function com3(n) { let x = 0, y = 0, z = 0, M = 0; for (const [a, b, m] of MASS) { if (!n[a] || !n[b]) continue; x += ((n[a][0] + n[b][0]) / 2) * m; y += ((n[a][1] + n[b][1]) / 2) * m; z += ((n[a][2] + n[b][2]) / 2) * m; M += m; } return [x / M, y / M, z / M]; }
/** the centre of mass's offset from the pelvis for words and a turn */
const comOff = (R, words, pitch, roll) => { const n = rigNodesAt(liteOf(R), placeAt(R, { words, W: [0, 0, 1], pitch, roll })).nodes; return sub(com3(n), [0, 0, 1]); };

// ─── the box ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** the obstacle: { y0 (its near face), h (its top over the floor), d (its depth), w (its width) } → the box (world) */
const boxOf = (O, floor) => ({ lo: [-O.w / 2, O.y0, floor], hi: [O.w / 2, O.y0 + O.d, floor + O.h] });
const onTop = (B, p, pad = 0) => p[0] > B.lo[0] - pad && p[0] < B.hi[0] + pad && p[1] > B.lo[1] - pad && p[1] < B.hi[1] + pad;
/** the body's sample points with the flesh round them: the joints and points along the limbs and the trunk */
const LIMBS = [['pelvisHub', 'neckHub', 0.11], ['neckHub', 'headTop', 0.08], ['shoulderL', 'elbowL', 0.045], ['shoulderR', 'elbowR', 0.045], ['elbowL', 'wristL', 0.035], ['elbowR', 'wristR', 0.035], ['hipL', 'kneeL', 0.065], ['hipR', 'kneeR', 0.065], ['kneeL', 'ankleL', 0.045], ['kneeR', 'ankleR', 0.045], ['ankleL', 'toeTipL', 0.025], ['ankleR', 'toeTipR', 0.025]];
function samplesOf(R, n, s) {
  const out = BODY_JOINTS.filter((k) => n[k]).map((k) => ({ k, p: n[k], r: fleshAt(k, R, s) }));
  for (const [a, b, r] of LIMBS) for (const u of [0.25, 0.5, 0.75]) out.push({ k: `${a}-${b}`, p: lerp3(n[a], n[b], u), r: r * s });
  return out;
}
/** the most a body's flesh goes into the box (metres; − is clear by that much) over the samples not excused */
function intoBox(pts, B, excuse = () => false) {
  let worst = -Infinity, at = null;
  for (const q of pts) {
    if (excuse(q.k)) continue;
    const { p, r } = q;
    // (a point over the footprint must clear the top; one beside it, the faces)
    const dx = Math.max(B.lo[0] - p[0], p[0] - B.hi[0]), dy = Math.max(B.lo[1] - p[1], p[1] - B.hi[1]), dz = p[2] - B.hi[2];
    const out = Math.max(dx, dy, dz);   // > 0: outside the box by that much along the nearest face
    const d = r - out; if (d > worst) { worst = d; at = q.k; }
  }
  return { into: worst, at };
}

// ─── the route ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The states of a move on a rig for an obstacle { h, d, w }, taking off from `foot` out of the gait `from`. Solved in
 * time order: the gait's touchdown and toe-off, the authored states placed by their contacts (the hands just on the top
 * at a hand-on; the box put where that hand is), the flights between by the centre of mass's parabola, the gait's
 * touchdown and toe-off on the landing foot. For the hurdle the air time is a parameter (`air`).
 */
function route(R, V, g, foot, O, { air = 0.4 } = {}) {
  const s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R), J = R.joints, lead = other(foot);
  const mir = foot === 'R';   // the moves are written for the left foot
  const W_ = (w) => (mir ? mirrored(w) : w);
  const sd = (S) => (mir ? other(S) : S);                     // a written side → this clip's
  const sideMap = (o) => Object.fromEntries(Object.entries(o || {}).map(([S, v]) => [sd(S), v]));
  const turnOf = (k) => ({ pitch: k.pitch ?? 0, roll: (mir ? -1 : 1) * (k.roll ?? 0) });
  const landing = sd(V.landing ?? 'L') === foot ? foot : lead;   // the foot that lands (the hurdle's lead, the step's take-off)
  const cyc = g.seconds, v = g.v;
  // THE PLANT: the gait at the take-off foot's touchdown, the toe at y = 0
  const f0 = gaitFrame(R, g, g.stance[foot].t0), Y0 = -f0.feet[foot][1];
  const at = (f, Y) => ({ W: add(f.W, [0, Y, 0]), feet: Object.fromEntries(Object.entries(f.feet).map(([S, p]) => [S, add(p, [0, Y, 0])])) });
  const plant = { name: 'plant', t: 0, words: f0.words, ...at(f0, Y0), swing: f0.swing, pitch: 0, roll: 0, hands: {}, vy: v, vz: f0.vz, gait: true };
  plant.feet = { [foot]: plant.feet[foot] };
  // THE PUSH: the take-off foot's toe-off (the gait's stance time), the drive's words
  const tPush = g.stance[foot].span * cyc;
  const fPush = gaitFrame(R, g, g.stance[foot].t0 + g.stance[foot].span);
  const push = { name: 'push', t: tPush, words: { ...fPush.words, ...W_(V.push) }, W: [fPush.W[0], plant.W[1] + v * tPush, fPush.W[2]], pitch: 0, roll: 0, feet: { [foot]: plant.feet[foot] }, hands: {}, vy: v, air: true };
  const states = [plant, push];
  let box = null;
  const nodesOf = (st) => rigNodesAt(R, elbowsDown(R, placeAt(R, st))).nodes;
  // a flight from state a (leaving) of T seconds to a state b whose own height and offset are given: b's pelvis, and the
  // take-off speeds; the inner states placed on the parabola
  const flyTo = (a, b, T, inner = []) => {
    const ca = add(a.W, comOff(R, a.words, a.pitch, a.roll)), ob = comOff(R, b.words, b.pitch, b.roll);
    const vy = a.vy;
    const cbz = b.W[2] + ob[2];
    const vz0 = (cbz - ca[2] + (G * T * T) / 2) / T;
    const cAt = (u) => [ca[0] + (b.W[0] + ob[0] - ca[0]) * u, ca[1] + vy * T * u, ca[2] + vz0 * T * u - (G * (T * u) ** 2) / 2];
    b.W = sub(cAt(1), ob); b.t = a.t + T; b.vy = vy; b.vz = vz0 - G * T;
    a.vz = vz0; a.fly = { T, ca, vz0, vy, to: b.name };
    const mids = inner.map((k) => { const u = k.at, st = { name: k.name, t: a.t + u * T, words: { ...a.words, ...W_(k.words) }, ...turnOf(k), feet: {}, hands: {}, inFlight: true }; st.W = sub(cAt(u), comOff(R, st.words, st.pitch, st.roll)); return st; });
    return mids;
  };
  // the hands' places at a state: each wrist where the arm words put it, then the pelvis set so the lowest of them is on
  // the top (its flesh on it)
  const reachZ = (st, hands) => { const n = rigNodesAt(liteOf(R), elbowsDown(R, placeAt(R, { ...st, feet: {} }))).nodes; const low = Math.min(...hands.map((S) => n[`wrist${S}`][2] - st.W[2])); return { low, n }; };
  // the least pelvis height at which a state's own pose clears the box by the margin (its hands on the top and its feet
  // there excused)
  let lastClear = null;
  const clearZ = (st, B, hs, fs) => {
    lastClear = null;
    const ex = (k) => hs.some((S) => /^(wrist|knuckles|elbow[LR]-wrist)/.test(k) && k.includes(S)) || fs.some((S) => (/^(toe|ankle)/.test(k) && k.endsWith(S)) || k === `knee${S}-ankle${S}`);
    // (the planted feet held where they are: a leg on the top reaches down to it)
    const feetOf = Object.fromEntries(fs.filter((S) => st.feet?.[S]).map((S) => [S, st.feet[S]]));
    const into = (z) => intoBox(samplesOf(R, rigNodesAt(R, elbowsDown(R, placeAt(R, { ...st, W: [st.W[0], st.W[1], z], feet: feetOf }))).nodes, s), B, ex).into + MARGIN;
    let lo = B.hi[2] - 0.3, hi = B.hi[2] + 1.5 * s; if (into(lo) <= 0) return lo;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (into(m) > 0) lo = m; else hi = m; }
    lastClear = intoBox(samplesOf(R, rigNodesAt(R, elbowsDown(R, placeAt(R, { ...st, W: [st.W[0], st.W[1], lo], feet: feetOf }))).nodes, s), B, ex).at;
    return hi;
  };
  // the most pelvis height at which the held hands still reach their points (the shoulder an arm's length over them)
  const armLen = (S) => 0.985 * (dist(J[`shoulder${S}`], J[`elbow${S}`]) + dist(J[`elbow${S}`], J[`wrist${S}`]));
  const reachCap = (st, pts) => {
    const Ss = Object.keys(pts); if (!Ss.length) return Infinity;
    const ok = (z) => { const n = rigNodesAt(liteOf(R), elbowsDown(R, placeAt(R, { ...st, W: [st.W[0], st.W[1], z], feet: {} }))).nodes; return Ss.every((S) => dist(n[`shoulder${S}`], pts[S]) <= armLen(S)); };
    // (reachable only in a window of heights: found from the state's own height, or the highest of a scan, then up)
    let lo = ok(st.W[2]) ? st.W[2] : null;
    if (lo === null) for (let z = floor + 3 * s; z >= floor; z -= 0.02 * s) if (ok(z)) { lo = z; break; }
    if (lo === null) return -Infinity;
    let hi = lo + 0.02 * s; while (ok(hi) && hi < floor + 3 * s) { lo = hi; hi += 0.02 * s; }
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return lo;
  };
  let prev = push;
  if (V.keys) {
    for (const k of V.keys) {
      const st = { name: k.name, words: { ...prev.words, ...W_(k.words) }, ...turnOf(k), feet: {}, hands: {}, vy: v * (k.v ?? 1) };
      // contacts carried on
      for (const [S0, c] of Object.entries(k.feet || {})) { const S = sd(S0); if (c === 'hold') st.feet[S] = prev.feet[S]; }
      for (const [S0, c] of Object.entries(k.hands || {})) { const S = sd(S0); if (c === 'hold') st.hands[S] = prev.hands[S]; }
      const newHands = Object.entries(k.hands || {}).filter(([, c]) => c === 'top').map(([S0]) => sd(S0));
      const top = floor + O.h, legLen = J.pelvisHub[2] - floor;
      if (k.z === 'reach') {
        // a hand-on out of a flight: the pelvis that puts the hands on the top (a palm's thickness over it), the box under
        // the hand (`station` past its near edge), then the pelvis raised as far as the pose needs to clear the box; the
        // flight to it
        const { low } = reachZ({ ...st, W: [0, 0, 1] }, newHands);
        st.W = [prev.W[0], 0, top + 0.025 * s - low];
        flyTo(prev, st, k.dt);
        let n = nodesOf(st);
        const first = prev === push;
        if (!box) { const hy = Math.min(...newHands.map((S) => n[`wrist${S}`][1])); box = boxOf({ ...O, y0: hy - (typeof V.station === 'function' ? V.station(O.d / s) : V.station) * s }, floor); }
        const footOn = Object.entries(k.feet || {}).filter(([, c]) => c === 'top').map(([S0]) => sd(S0));
        const hp = Object.fromEntries(newHands.map((S) => [S, [n[`wrist${S}`][0], n[`wrist${S}`][1], top + 0.025 * s]]));
        for (const S of footOn) { const toe = n[R.legs[S].toeBase]; st.feet[S] = [toe[0], Math.max(toe[1], box.lo[1] + 0.1 * s), top + (J[R.legs[S].toeBase][2] - floor)]; }
        const zc0 = clearZ(st, box, newHands, footOn), cap = reachCap(st, hp), zc = Math.min(zc0, cap); if (zc > st.W[2]) { st.W = [st.W[0], st.W[1], zc]; flyTo(prev, st, k.dt); }
        if (first && V.rise) states.push(...flyTo(prev, st, k.dt, V.rise));
        st.fit = { clear: zc0 - top, cap: cap - top, z: st.W[2] - top, by: lastClear };
        Object.assign(st.hands, hp);
      } else {
        // (`over`: the pelvis that share of the leg's length over the top; `rise`: metres over the state before) — and
        // never lower than the pose needs to clear the box
        st.t = prev.t + k.dt; st.W = [prev.W[0], prev.W[1] + ((prev.vy + st.vy) / 2) * k.dt, k.z?.over !== undefined ? top + k.z.over * legLen : prev.W[2] + (k.z?.rise ?? 0) * s];
        if (box) {
          const zc0 = clearZ(st, box, Object.keys(st.hands), Object.entries(k.feet || {}).filter(([, c]) => c === 'top' || c === 'hold').map(([S0]) => sd(S0))), cap = reachCap(st, st.hands);
          st.W = [st.W[0], st.W[1], cap > -Infinity ? Math.min(Math.max(st.W[2], zc0), cap) : Math.max(st.W[2], zc0)];
          st.fit = { clear: zc0 - top, cap: cap - top, z: st.W[2] - top, by: lastClear };
        }
      }
      for (const [S0, c] of Object.entries(k.feet || {})) {
        const S = sd(S0); if ((c !== 'top' && c !== 'floor') || st.feet[S]) continue;
        const n = nodesOf(st), toe = n[R.legs[S].toeBase];
        // (a foot put on the top lands on it: a hand's breadth in from the near edge at the least)
        st.feet[S] = [toe[0], c === 'top' && box ? Math.max(toe[1], box.lo[1] + 0.1 * s) : toe[1], (c === 'top' ? floor + O.h : floor) + (J[R.legs[S].toeBase][2] - floor)];
      }
      if (k.air) st.air = true;
      states.push(st); prev = st;
    }
  }
  // THE LANDING: the gait at the landing foot's touchdown (the other leg as the move carries it through), flown to from
  // the last state; the gait's toe-off on it after
  const fLand = gaitFrame(R, g, g.stance[landing].t0);
  const landSt = { name: 'land', words: { ...fLand.words, ...W_(V.land || {}) }, W: [...fLand.W], pitch: 0, roll: 0, feet: {}, hands: {}, gait: true };
  const T2 = V.keys ? (V.fall ?? 0.24) : air;
  const mids = flyTo(prev, landSt, T2, V.flight || []);
  const dY = landSt.W[1] - fLand.W[1];
  landSt.feet = { [landing]: add(fLand.feet[landing], [0, dY, 0]) };
  const tOff = g.stance[landing].span * cyc, fExit = gaitFrame(R, g, g.stance[landing].t0 + g.stance[landing].span);
  const exit = { name: 'exit', t: landSt.t + tOff, words: fExit.words, W: add(fExit.W, [0, dY + v * tOff, 0]), swing: fExit.swing, pitch: 0, roll: 0, feet: { [landing]: landSt.feet[landing] }, hands: {}, vy: v, vz: fExit.vz, gait: true };
  landSt.vy = v;   // (the landing takes the run back at its speed)
  states.push(...mids, landSt, exit);
  states.sort((a, b) => a.t - b.t);
  return { states, box, landing, lead, foot, s, floor, v };
}

// ─── the player ───────────────────────────────────────────────────────────────────────────────────────────────────────
function flatten(o, pre = '', out = {}) { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, `${pre}${k}.`, out); else if (Number.isFinite(v)) out[`${pre}${k}`] = v; } return out; }
function unflatten(m) { const o = {}; for (const [p, v] of Object.entries(m)) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c = c[k] || (c[k] = {}); }); c[ks[ks.length - 1]] = v; } return o; }
/** a Hermite cubic on [ta, tb] through (pa, va) and (pb, vb) */
const hermite = (ta, pa, va, tb, pb, vb) => (t) => { const h = tb - ta || 1, x = (t - ta) / h, x2 = x * x, x3 = x2 * x; return (2 * x3 - 3 * x2 + 1) * pa + (x3 - 2 * x2 + x) * h * va + (-2 * x3 + 3 * x2) * pb + (x3 - x2) * h * vb; };

/**
 * The states played: a frame (world, the obstacle's frame) at any time. The words and the turn flow through every state;
 * the pelvis flies the centre of mass's parabola through a flight and a Hermite cubic through a contact span; the feet
 * hold, leave and land; the hands hold the top (the arm solved from the frame before, the palm flat), easing on and off.
 */
function play(R, rt) {
  const { states, box, s, floor } = rt;
  // a state holding a hand takes the arm that reaches it (so the words flow through the hold, and a hand easing off it
  // leaves from where it is)
  for (const st of states) for (const [S, p] of Object.entries(st.hands || {})) {
    if (!p || st.inFlight) continue;
    const body = placeAt(R, { ...st, feet: st.feet }), A = reachArm(R, body, S, p, { sh: { pitch: 0, yaw: 0, roll: 0, ...(st.words[`sh${S}`] || {}) }, elbow: st.words[`elbow${S}`] ?? 0 });
    st.words = { ...st.words, [`sh${S}`]: A.sh, [`elbow${S}`]: A.elbow };
  }
  const flat = states.map((st) => flatten(st.words)), paths = [...new Set(flat.flatMap((f) => Object.keys(f)))];
  const C = Object.fromEntries(paths.map((p) => [p, curve(states.map((st, i) => ({ t: st.t, v: flat[i][p] ?? 0 })))]));
  const CP = curve(states.map((st) => ({ t: st.t, v: st.pitch ?? 0 }))), CR = curve(states.map((st) => ({ t: st.t, v: st.roll ?? 0 })));
  // the contact spans' pelvis: between the states not in a flight, a Hermite on each axis with the states' speeds
  const anchors = states.filter((st) => !st.inFlight);
  const vzOf = (i) => { const st = anchors[i]; if (Number.isFinite(st.vz)) return st.vz; const a = anchors[Math.max(0, i - 1)], b = anchors[Math.min(anchors.length - 1, i + 1)]; return (b.W[2] - a.W[2]) / ((b.t - a.t) || 1); };
  const segW = anchors.slice(0, -1).map((a, i) => { const b = anchors[i + 1]; return a.fly ? null : [0, 1, 2].map((k) => hermite(a.t, a.W[k], k === 1 ? a.vy : k === 0 ? 0 : vzOf(i), b.t, b.W[k], k === 1 ? b.vy : k === 0 ? 0 : vzOf(i + 1))); });
  const T1 = states[states.length - 1].t;
  const contactOf = (key, S, t) => {
    // the contact through t: { p, w } — its point and how fully it bears (easing on before it, off after)
    let i = 0; while (i < anchors.length - 2 && anchors[i + 1].t <= t) i++;
    const a = anchors[i], b = anchors[i + 1], pa = a[key][S], pb = b[key][S];
    // (a foot stepping onto the top eases onto it once the hips are over it: a leg reaching up level flips its knee)
    const [on, off] = key === 'feet' ? [pb && pb[2] > floor + 0.05 ? TOP_LAND : LAND, LEAVE] : [HAND_ON, HAND_OFF];
    if (pa && pb) return { p: pa, w: 1, held: dist(pa, pb) < 1e-6 };
    if (pa && !pb) return { p: pa, w: 1 - minJerk((t - a.t) / off), held: false };
    if (!pa && pb) return { p: pb, w: minJerk((t - (b.t - on)) / on), held: false };
    return null;
  };
  const first = states[0], last = states[states.length - 1];
  const swingOf = (S, t) => {
    if (first.swing?.[S] && t < first.t + SWING_EASE) return { rel: first.swing[S], w: 1 - minJerk((t - first.t) / SWING_EASE) };
    if (last.swing?.[S] && t > last.t - SWING_EASE) return { rel: last.swing[S], w: minJerk((t - (last.t - SWING_EASE)) / SWING_EASE) };
    return null;
  };
  let lastArms = {};
  const frameAt = (time, lift = 0) => {
    const t = clamp(time, 0, T1);
    const words = unflatten(Object.fromEntries(paths.map((p) => [p, C[p](t)])));
    const pitch = CP(t), roll = CR(t);
    let i = 0; while (i < anchors.length - 2 && anchors[i + 1].t <= t) i++;
    const a = anchors[i];
    let W;
    if (a.fly) { const F = a.fly, u = t - a.t, c = [F.ca[0], F.ca[1] + F.vy * u, F.ca[2] + F.vz0 * u - (G * u * u) / 2]; W = sub(c, comOff(R, words, pitch, roll)); }
    else W = segW[i].map((f) => f(t));
    if (lift) W = [W[0], W[1], W[2] + lift];
    // the feet
    const free = rigNodesAt(R, elbowsDown(R, placeAt(R, { words, W, pitch, roll }))).nodes;
    const feet = {}, ground = {}, onTop = {};
    for (const S of SIDES) {
      const c = contactOf('feet', S, t); ground[S] = c ? c.w : 0;
      if (!c || c.w <= 1e-4) {
        // a swing foot at the gait's ends: the gait's own target, easing to the free leg over SWING_EASE
        const sw = swingOf(S, t); if (sw) feet[S] = lerp3(free[R.legs[S].toeBase], add(W, sw.rel), sw.w);
        continue;
      }
      const toe = free[R.legs[S].toeBase], p = lerp3(toe, c.p, c.w); feet[S] = [p[0], p[1], Math.max(p[2], c.p[2])];
      onTop[S] = c.p[2] > floor + 0.05;
    }
    let pose = elbowsDown(R, placeAt(R, { words, W, pitch, roll, feet }));
    // the hands
    const hands = {};
    for (const S of SIDES) {
      const c = contactOf('hands', S, t); if (!c || c.w <= 1e-4) { delete lastArms[S]; continue; }
      const seed = lastArms[S] ?? { sh: { pitch: 0, yaw: 0, roll: 0, ...(words[`sh${S}`] || {}) }, elbow: words[`elbow${S}`] ?? 0 };
      const body = { ...placeAt(R, { words, W, pitch, roll, feet }) };
      const A = reachArm(R, body, S, c.p, seed); lastArms[S] = A;
      const mixed = { sh: Object.fromEntries(['pitch', 'yaw', 'roll'].map((q) => [q, lerp(words[`sh${S}`]?.[q] ?? 0, A.sh[q] ?? 0, c.w)])), elbow: lerp(words[`elbow${S}`] ?? 0, A.elbow, c.w) };
      pose = { ...pose, ...elbowsDown(R, { [`sh${S}`]: mixed.sh }), [`elbow${S}`]: mixed.elbow };
      // (the palm laid flat on the top as the hand comes onto it, the wrist eased from its own words)
      const flat = flatHand(R, pose, S, c.p[2] - 0.025 * s, s)[`wrist${S}`], own = words[`wrist${S}`] || {};
      pose = { ...pose, [`wrist${S}`]: Object.fromEntries(['flex', 'deviation', 'twist'].map((q) => [q, lerp(own[q] ?? 0, flat[q] ?? 0, c.w)])) };
      hands[S] = c.w;
    }
    // (a hand whose next contact is the top, coming down onto it)
    const soon = anchors.filter((x) => x.t > t + 1e-9 && x.t < t + REACH_AHEAD), reaching = Object.fromEntries(SIDES.filter((S) => !(hands[S] > 0.02) && soon.some((x) => x.hands?.[S])).map((S) => [S, true]));
    return { pose, t, ground, hands, onTop, reaching, W };
  };
  return { frameAt, T: T1, reset: () => { lastArms = {}; } };
}

// ─── the clip ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** a solved route played into frames (world) */
function bake(R, rt) {
  const P = play(R, rt), N = Math.max(2, Math.ceil(P.T * FINE));
  let frames = Array.from({ length: N + 1 }, (_, i) => P.frameAt((i / N) * P.T));
  let lifted = 0;
  if (rt.box) {
    // THE CLEARANCE LIFT: what each frame needs over the box (its flesh by the margin, the limbs bearing on the top
    // excused), as its upper envelope over ±LIFT_SPAN, blurred, and never while a foot bears on the floor — added to the
    // pelvis and the frames played again (the hands re-reached on their points)
    const need = frames.map((f) => underTop(samplesOf(R, rigNodesAt(R, f.pose).nodes, rt.s), rt.box, excuser(f)));
    if (Math.max(...need) > 1e-4) {
      const W = Math.round(LIFT_SPAN * FINE), dil = need.map((_, i) => Math.max(...need.slice(Math.max(0, i - W), i + W + 1)));
      const sg = W / 2, ker = Array.from({ length: 2 * W + 1 }, (_, j) => Math.exp(-((j - W) ** 2) / (2 * sg * sg)));
      const env = dil.map((_, i) => { let a = 0, w = 0; for (let j = -W; j <= W; j++) { const k = clamp(i + j, 0, N); a += dil[k] * ker[j + W]; w += ker[j + W]; } return a / w; });
      const onFloor = frames.map((f) => Math.max(0, ...SIDES.map((S) => (f.onTop[S] ? 0 : f.ground[S]))));
      const held = frames.map((f) => Math.max(0, ...SIDES.map((S) => f.hands[S] || 0)));
      const lift = env.map((x, i) => Math.max(need[i], x) * (1 - onFloor[i]) * (1 - held[i]));
      lifted = Math.max(...lift);
      P.reset(); frames = Array.from({ length: N + 1 }, (_, i) => P.frameAt((i / N) * P.T, lift[i]));
    }
  }
  return { frames, T: P.T, N, lifted };
}
/** what a body needs to rise to clear the top (metres): each sample over the footprint (widened by its flesh and the
 * margin) under the top by its flesh and the margin */
function underTop(pts, B, excuse = () => false) {
  let need = 0;
  for (const q of pts) { if (excuse(q.k)) continue; const { p, r } = q, pad = r + MARGIN; if (p[0] > B.lo[0] - pad && p[0] < B.hi[0] + pad && p[1] > B.lo[1] - pad && p[1] < B.hi[1] + pad) need = Math.max(need, B.hi[2] + pad - p[2]); }
  return need;
}
/** the limbs a frame excuses from the box: a hand on the top, a foot on the top */
const excuser = (f) => (k) => SIDES.some((S) => ((f.hands[S] > 0 || f.reaching?.[S]) && /^(wrist|knuckles|elbow[LR]-wrist)/.test(k) && k.includes(S)) || (f.onTop[S] && ((/^(toe|ankle)/.test(k) && k.endsWith(S)) || k === `knee${S}-ankle${S}`)));
/** the clip's clearance over the box: the most the flesh goes into it over every frame (the contact limbs excused while
 * they bear on it), and where */
function clearanceOf(R, rt, frames) {
  let worst = { into: -Infinity, at: null, i: -1 };
  frames.forEach((f, i) => {
    const n = rigNodesAt(R, f.pose).nodes, pts = samplesOf(R, n, rt.s);
    const c = intoBox(pts, rt.box, excuser(f)); if (c.into > worst.into) worst = { ...c, i };
  });
  return worst;
}

/**
 * A move over an obstacle on a rig. `name` a VAULT_NAMES name (`…Left`: the right foot takes off, the mirror); `h`, `d`,
 * `w` the box (metres: its top over the floor, its depth along the run, its width); `from` the gait it is taken out of.
 * → { name, move, from, foot (taking off), landing, seconds, keys (30 a second), fn(t) (t 0 … 1: the clip in place, as
 * the gaits are), root ({ y(t), z(t) } world metres of the pelvis: the engine carries the character along y), entry
 * ({ phase: the gait's phase at the first frame, foot, takeoff: metres from the take-off toe to the near face }), exit
 * ({ phase, foot, landing: metres past the far face }), air ([{ from, to, vz }]: the flights), beats ({ name, t }),
 * box, props, checks }.
 */
export function heroVault(name, R, { h, d = 0.3, w = 1.5, from, seconds } = {}) {
  const left = /Left$/.test(name), base = left ? name.slice(0, -4) : name, V = VAULTS[base];
  if (!V) throw new Error(`hero-vault: no move '${name}' (have ${VAULT_NAMES.join(', ')})`);
  if (!(Number.isFinite(h) && h > 0)) throw new Error('hero-vault: h (the obstacle\'s height, metres) is required');
  const gait = from ?? V.from[0]; if (!V.from.includes(gait)) throw new Error(`hero-vault: ${base} is taken out of ${V.from.join(' or ')} (not ${gait})`);
  const g = gaitOn(R, gait), foot = left ? 'R' : 'L', O = { h, d, w };
  let rt, baked;
  if (V.keys) { rt = route(R, V, g, foot, O); baked = bake(R, rt); }
  else {
    // THE HURDLE's air: the least that clears the box by the margin, the box placed where it clears best
    // (cleared with a foot's length of room before the box and after it: the landing past the far face)
    const tryAir = (air) => { const r = route(R, V, g, foot, O, { air }); const b = bake(R, r), P = placeBox(R, r, b.frames, O); return { r, b, ...P, into: P.clears && P.room >= ROOM * r.s ? P.into : Math.max(P.into, 0) }; };
    let lo = 0.18, hi = 0.75, best = tryAir(hi);
    if (best.into > -MARGIN) { rt = { ...best.r, box: best.box }; baked = best.b; }
    else {
      for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2, x = tryAir(m); if (x.into <= -MARGIN) { hi = m; best = x; } else lo = m; }
      rt = { ...best.r, box: best.box }; baked = best.b;
    }
  }
  return clipOf(R, name, base, V, g, rt, baked, { seconds });
}
/** the hurdle's box: slid along the run to where the body clears it most */
function placeBox(R, rt, frames, O) {
  const pts = frames.map((f) => rigNodesAt(R, f.pose).nodes).map((n) => samplesOf(R, n, rt.s));
  // (between the feet: past the take-off toe, short of the landing one, by a foot's length each)
  const st = rt.states, foot = Object.keys(st[0].feet)[0], land = st.find((x) => x.name === 'land').feet[rt.landing];
  const lo = st[0].feet[foot][1] + 0.15 * rt.s, hi = land[1] - 0.15 * rt.s;
  let best = { into: Infinity, box: boxOf({ ...O, y0: (lo + hi - O.d) / 2 }, rt.floor) };
  for (let y0 = lo; y0 <= hi - O.d; y0 += 0.01) {
    const B = boxOf({ ...O, y0 }, rt.floor);
    let worst = -Infinity; frames.forEach((f, i) => { const c = intoBox(pts[i], B); worst = Math.max(worst, c.into); });
    // (of the places it clears, the one most evenly between the feet; until one clears, the one it clears most)
    const room = Math.min(y0 - lo, hi - (y0 + O.d)), clears = worst <= -MARGIN;
    if (clears ? !best.clears || room > best.room : !best.clears && worst < best.into) best = { into: worst, box: B, clears, room };
  }
  return best;
}

function clipOf(R, name, base, V, g, rt, baked, { seconds }) {
  const { frames, T: T0, N } = baked;
  const T = seconds ?? T0, k = T / T0;
  const { box, s, floor } = rt;
  // in place: the pelvis's run along y taken out (the engine carries it), the feet's, the hands' and the turn's with it
  const rootY = frames.map((f) => f.W[1]), rootZ = frames.map((f) => f.W[2]);
  const inPlace = (pose, y) => {
    const o = { ...pose, shift: { ...(pose.shift || {}), y: (pose.shift?.y ?? 0) - y } };
    if (pose.feet) o.feet = Object.fromEntries(Object.entries(pose.feet).map(([S, p]) => [S, [p[0], p[1] - y, p[2]]]));
    if (pose.body) o.body = { ...pose.body, at: [pose.body.at[0], pose.body.at[1] - y, pose.body.at[2]] };
    return o;
  };
  const step = Math.max(1, Math.round(FINE / FPS)), keys = [], keyRoot = [];
  for (let i = 0; i <= N; i += step) { keys.push(inPlace(frames[i].pose, rootY[i])); keyRoot.push([rootY[i], rootZ[i]]); }
  if ((N % step) !== 0) { keys.push(inPlace(frames[N].pose, rootY[N])); keyRoot.push([rootY[N], rootZ[N]]); }
  // the ends are the gait's own frames (the clip in place, as the gait is)
  keys[0] = g.loco.fn(g.stance[rt.foot].t0); keys[keys.length - 1] = g.loco.fn((g.stance[rt.landing].t0 + g.stance[rt.landing].span) % 1);
  const M = keys.length - 1;
  const fn = (u) => { const x = clamp(u, 0, 1) * M, i = Math.min(M - 1, Math.floor(x)); return blendPose(keys[i], keys[i + 1], x - i); };
  const rootAt = (u) => { const x = clamp(u, 0, 1) * M, i = Math.min(M - 1, Math.floor(x)), f = x - i; return [lerp(keyRoot[i][0], keyRoot[i + 1][0], f), lerp(keyRoot[i][1], keyRoot[i + 1][1], f)]; };
  const st = rt.states, beat = (n) => st.find((x) => x.name === n);
  const plant = beat('plant'), land = beat('land'), exit = beat('exit');
  const takeoff = box.lo[1] - plant.feet[Object.keys(plant.feet)[0]][1];
  const landing = land.feet[rt.landing][1] - box.hi[1];
  const air = st.filter((x) => x.fly).map((x) => ({ from: r3(x.t * k), to: r3((x.t + x.fly.T) * k), vz: r3(x.fly.vz0), to_: x.fly.to })).map(({ to_, ...a }) => a);
  const foot = /Left$/.test(name) ? 'R' : 'L';
  const props = [{ lo: box.lo, hi: box.hi, colour: '#8a7a66' }];
  const c0 = vaultChecks(R, rt, frames, T0, { takeoff, landing, air, gait: g }), lifted = baked.lifted ?? 0;
  // (the clearance lift is a correction off the flights' parabolas: a few centimetres at most, or the poses are wrong)
  const checks = { ...c0, lifted: r4(lifted), laws: { ...c0.laws, lift: lifted <= LIFT_MAX * rt.s } };
  return {
    name, move: base, from: g.name, foot, landing: rt.landing, seconds: r3(T), keys, fn,
    root: { y: (u) => rootAt(u)[0] - rootY[0], z: (u) => rootAt(u)[1], travel: r3(rootY[N] - rootY[0]), v: r3(g.v) },
    entry: { phase: r4(plant.words && g.stance[foot].t0), foot, takeoff: r3(takeoff) },
    exit: { phase: r4((g.stance[rt.landing].t0 + g.stance[rt.landing].span) % 1), foot: rt.landing, landing: r3(landing) },
    air, beats: st.map((x) => ({ name: x.name, t: r3(x.t * k), ...(x.fit ? { fit: Object.fromEntries(Object.entries(x.fit).map(([q, v]) => [q, typeof v === 'number' ? r3(v) : v])) } : {}) })),
    box: { h: r3(box.hi[2] - floor), d: r3(box.hi[1] - box.lo[1]), w: r3(box.hi[0] - box.lo[0]), y0: r3(box.lo[1] - (plant.feet[foot][1])) },
    props: props.map((p) => ({ ...p, lo: [p.lo[0], p.lo[1] - rootY[0], p.lo[2]], hi: [p.hi[0], p.hi[1] - rootY[0], p.hi[2]] })),
    checks,
  };
}
/** two keys' poses blended (hero-rise's) */
function blendPose(A, B, x) {
  const fa = flatten(A), fb = flatten(B), near = x < 0.5 ? fa : fb, out = {};
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) out[k] = k in fa && k in fb ? lerp(fa[k], fb[k], x) : near[k];
  const o = { ...(x < 0.5 ? A : B), ...unflatten(out) };
  o.support = (x < 0.5 ? A : B).support;
  const feet = {}; for (const S of SIDES) { const a = A.feet?.[S], b = B.feet?.[S]; if (a && b) feet[S] = lerp3(a, b, x); else if ((x < 0.5 ? a : b)) feet[S] = x < 0.5 ? a : b; }
  if (Object.keys(feet).length) o.feet = feet; else delete o.feet;
  if (A.body && B.body) o.body = { ...o.body, at: lerp3(A.body.at, B.body.at, x) }; else if ((x < 0.5 ? A : B).body) o.body = (x < 0.5 ? A : B).body; else delete o.body;
  return o;
}

// ─── the checks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The machine gate on a vault: ends (m: the first and last frames off the gait's own frames at the entry and exit
 * phases, the run carried on), clear (m: the most the flesh goes into the box, − clear; the contacts excused while they
 * bear), plant (m: the most a held foot or hand moves), floor (m: the lowest flesh under the floor), takeoff (m/s: the
 * fastest upward take-off, under VZ_MAX), landing (m past the far face, over a foot's length), reach (m: the most a hand
 * on the top is off its point), knees and hips (degrees of flexion, the rise's ranges), speed (m/s: the fastest joint
 * relative to the pelvis, at most SPEED_OVER × the gait's own fastest), laws.
 */
function vaultChecks(R, rt, frames, T, { takeoff, landing, air, gait }) {
  const s = rt.s, floor = rt.floor, dt = T / (frames.length - 1);
  const nodes = frames.map((f) => rigNodesAt(R, f.pose).nodes);
  // the ends against the gait itself (its frames, carried to where the clip has the pelvis)
  const endOff = (n, ph) => { const f = rigNodesAt(R, gait.loco.fn(ph)).nodes, d = sub(n.pelvisHub, f.pelvisHub); return Math.max(...BODY_JOINTS.map((k) => dist(n[k], add(f[k], d)))); };
  const st = rt.states, foot = Object.keys(st[0].feet)[0];
  const ends = [endOff(nodes[0], gait.stance[foot].t0), endOff(nodes[nodes.length - 1], (gait.stance[rt.landing].t0 + gait.stance[rt.landing].span) % 1)];
  const clear = clearanceOf(R, rt, frames);
  let reachAt = null, plantAt = null, plant = 0, reach = 0, low = Infinity, lowAt = null, knee = 0, hip = 0, speed = 0, speedAt = null;
  nodes.forEach((n, i) => {
    const f = frames[i];
    for (const k of BODY_JOINTS) { const d = n[k][2] - fleshAt(k, R, s) - floor; if (d < low) { low = d; lowAt = `${k}@${i}`; } }
    for (const S of SIDES) {
      const L = R.legs[S]; knee = Math.max(knee, 180 - angle(sub(n[L.hip], n[L.knee]), sub(n[L.hock], n[L.knee]))); hip = Math.max(hip, angle(sub(n.pelvisHub, n.neckHub), sub(n[L.knee], n[L.hip])));
      if (i && f.ground[S] >= 0.999 && frames[i - 1].ground[S] >= 0.999 && dist(n[L.toeBase], nodes[i - 1][L.toeBase]) > plant) { plant = dist(n[L.toeBase], nodes[i - 1][L.toeBase]); plantAt = `toe${S}@${i}`; }
      if (f.hands[S] >= 0.999) { const tgt = handTarget(rt, f.t, S); if (tgt && dist(n[`wrist${S}`], tgt) > reach) { reach = dist(n[`wrist${S}`], tgt); reachAt = `${S}@${i}`; } if (i && frames[i - 1].hands[S] >= 0.999 && dist(n[`wrist${S}`], nodes[i - 1][`wrist${S}`]) > plant) { plant = dist(n[`wrist${S}`], nodes[i - 1][`wrist${S}`]); plantAt = `hand${S}@${i}`; } }
    }
    if (i) for (const k of BODY_JOINTS) { const v = dist(sub(n[k], n.pelvisHub), sub(nodes[i - 1][k], nodes[i - 1].pelvisHub)) / dt; if (v > speed) { speed = v; speedAt = `${k}@${i}`; } }
  });
  const up = Math.max(0, ...air.map((a) => a.vz));
  const foot1 = 0.2 * s;
  const own = gaitSpeed(R, gait);
  const laws = { ends: Math.max(...ends) < 0.02, clear: clear.into < 0, plant: plant < (/^hand/.test(plantAt ?? '') ? 0.025 : 0.01), floor: low > -0.02, takeoff: up <= VZ_MAX, landing: landing > foot1, reach: reach < 0.03, knees: knee <= 162, hips: hip <= 165, speed: speed <= SPEED_OVER * own };
  return { ends: ends.map(r4), clear: r4(clear.into), clearAt: clear.at ? `${clear.at}@${clear.i}` : null, plant: r4(plant), plantAt, floor: r4(low), floorAt: lowAt, takeoff: r3(up), takeoffDistance: r3(takeoff), landing: r3(landing), reach: r4(reach), reachAt, knees: r1(knee), hips: r1(hip), speed: r3(speed), speedAt, gaitSpeed: r3(own), laws };
}
/** the gait's own fastest joint relative to its pelvis (m/s) over a cycle: what a vault out of it may reach, and a third more */
const speedCache = new WeakMap();
function gaitSpeed(R, g) {
  const m = speedCache.get(R) || {}; speedCache.set(R, m); if (m[g.name]) return m[g.name];
  const K = 120, n = Array.from({ length: K + 1 }, (_, i) => rigNodesAt(R, g.loco.fn((i / K) % 1)).nodes), dt = g.seconds / K; let v = 0;
  for (let i = 1; i <= K; i++) for (const k of BODY_JOINTS) v = Math.max(v, dist(sub(n[i][k], n[i].pelvisHub), sub(n[i - 1][k], n[i - 1].pelvisHub)) / dt);
  return (m[g.name] = v);
}
const handTarget = (rt, t, S) => { const a = [...rt.states].reverse().find((x) => !x.inFlight && x.t <= t + 1e-9); return a?.hands?.[S] ?? null; };

// ─── the solver ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** the moves each gait reaches for, in order of preference by the box (a thin wall, a deep table) */
// (sprinting at a thin box: the hurdle while it is low, the speed vault from mid-thigh up — it keeps the run's height)
const PREFER = Object.freeze({
  jog: { thin: () => ['hurdle', 'stepVault'], deep: () => ['stepVault'] },
  sprint: { thin: (ratio) => (ratio < 0.5 ? ['hurdle', 'speedVault'] : ['speedVault', 'hurdle']), deep: () => ['kongVault'] },
});
const DEEP = 0.45;   // metres of depth past which a box is a table, not a wall
/** the swing toe's least clearance in a gait (metres): what it strides over without a move at all */
function strideClear(R, g) {
  let lo = Infinity; const floor = floorOf(R);
  for (const S of SIDES) { const st = g.stance[S]; for (let i = 1; i < 20; i++) { const ph = st.t0 + st.span + ((1 - st.span) * i) / 20; const n = rigNodesAt(R, g.loco.fn(((ph % 1) + 1) % 1)).nodes; if (i >= 6 && i <= 14) lo = Math.min(lo, n[R.legs[S].toeTip][2] - floor, n[R.legs[S].toeBase][2] - floor); } }
  return lo;
}
const vaultCache = new WeakMap();
const cached = (R, key, f) => { const m = vaultCache.get(R) || new Map(); vaultCache.set(R, m); if (!m.has(key)) m.set(key, f()); return m.get(key); };

/**
 * THE FREE-RUN SOLVER. From the frame the runner is in — `state` { gait: 'jog' | 'sprint' | 'walk', phase (0 … 1) } —
 * and an obstacle ahead — { h, d, w, distance (metres from the pelvis to its near face) } — the way over it:
 * { move: a VAULT_NAMES name | 'stride' (low enough to run over: the swing clears it) | null, why, clip (heroVault's),
 * approach: { steps (the footfalls before the take-off one), stretch (each stride's length as a share of the gait's), rate
 * (the gait's playback rate through them: 1 / stretch), seconds (until the take-off touchdown) } }.
 * The obstacle bands are the figure's own: a share of its hip height up to its waist. A box beyond them, or one no move
 * can be fitted to at this speed and distance, returns move null and why.
 */
export function freeRun(state, obstacle, R) {
  const { gait = 'jog', phase = 0 } = state || {}, { h, d = 0.3, w = 1.5, distance } = obstacle || {};
  if (!(Number.isFinite(h) && h > 0) || !Number.isFinite(distance)) throw new Error('hero-vault: freeRun needs obstacle { h, distance } (metres)');
  const g = gaitOn(R, gait), J = R.joints, floor = floorOf(R), hipH = J.pelvisHub[2] - floor, waist = J.navel[2] - floor;
  const ratio = h / hipH;
  const clearRun = strideClear(R, g);
  if (h + MARGIN < clearRun && d < 0.6) return { move: 'stride', why: `${r3(h)} m is under the ${gait}'s swing clearance (${r3(clearRun)} m): run on`, clip: null, approach: null };
  if (h > waist + 0.02) return { move: null, why: `${r3(h)} m is over the waist (${r3(waist)} m): a climb, not a vault`, clip: null, approach: null };
  const P = PREFER[gait]; if (!P) return { move: null, why: `out of a ${gait} only a stride (the vaults are taken out of a jog or a sprint)`, clip: null, approach: null };
  const order = (d > DEEP ? P.deep : P.thin)(ratio), tried = [];
  // where each foot's next touchdowns fall, from the frame the runner is in (the pelvis's frame: metres ahead of it)
  const cyc = g.seconds, v = g.v;
  for (const base of order) {
    const V = VAULTS[base];
    const band = V.band[gait];
    if (!band || ratio < band[0] || ratio > band[1] || d < V.depth[0] || d > V.depth[1]) { tried.push(`${base}: out of its band (${band ? `${band[0]}–${band[1]} of the hip height` : `not out of a ${gait}`}, ${V.depth[0]}–${V.depth[1]} m deep)`); continue; }
    let fit = null;
    for (const foot of SIDES) {
      const name = foot === 'L' ? base : `${base}Left`;
      const clip = cached(R, `${name}|${gait}|${r3(h)}|${r3(d)}|${r3(w)}`, () => heroVault(name, R, { h, d, w, from: gait }));
      if (!Object.values(clip.checks.laws).every(Boolean)) { tried.push(`${name}: ${Object.entries(clip.checks.laws).filter(([, x]) => !x).map(([k]) => k).join(', ')}`); continue; }
      // the take-off toe's place ahead of the pelvis at its touchdown, at the gait's own stride; the next touchdowns of
      // that foot, a cycle apart; the one whose stretch is least off 1 within ±STRETCH
      const st = g.stance[foot], toeAhead = rigNodesAt(R, g.loco.fn(st.t0)).nodes[R.legs[foot].toeBase][1] - J.pelvisHub[1];
      const lead = (((st.t0 - phase) % 1) + 1) % 1;   // the share of a cycle to its next touchdown
      for (let n = 0; n < 6; n++) {
        const cycles = lead + n, need = distance - clip.entry.takeoff - toeAhead;   // the pelvis's travel to put the toe there
        if (cycles < 0.15) continue;   // (too near to adjust)
        const stretch = need / (v * cycles * cyc);
        // (the footfalls before it: this foot's n, the other's in the same span)
        const otherLead = (((g.stance[other(foot)].t0 - phase) % 1) + 1) % 1, steps = n + Math.max(0, Math.ceil(cycles - otherLead - 1e-9));
        if (Math.abs(stretch - 1) <= STRETCH && (!fit || Math.abs(stretch - 1) < Math.abs(fit.approach.stretch - 1))) fit = { move: name, clip, approach: { steps, stretch: r3(stretch), rate: r3(1 / stretch), seconds: r3(cycles * cyc * stretch) } };

      }
    }
    if (fit) return { ...fit, why: `${base} over ${r3(h)} × ${r3(d)} m out of the ${gait}` };
    tried.push(`${base}: no take-off spot within ±${STRETCH * 100}% strides at ${r3(distance)} m${distance - (cached(R, `${base}|${gait}|${r3(h)}|${r3(d)}|${r3(w)}`, () => null)?.entry.takeoff ?? 0) < 0.6 * g.loco.travel / 2 ? ' (too near: the take-off spot is already under the runner)' : ''}`);
  }
  return { move: null, why: tried.join('; '), clip: null, approach: null };
}
