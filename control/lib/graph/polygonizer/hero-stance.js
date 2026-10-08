/**
 * hero-stance — READY STANCES: the poses a body takes before an action, solved from where the feet stand.
 *
 * A stance is said in design words (STANCES) and solved from principles, not keyed angle by angle:
 *
 *   • THE FEET decide the body. The feet stand `spread` leg lengths apart along a FOOT LINE at `line` degrees off the
 *     lateral (0 side by side, 90 heel to toe toward the target), each toe turned `toes` degrees (counter-clockwise from
 *     the target, seen from above). The pelvis squares to the foot line, but no further than each hip can turn its knee
 *     over its toes (TURNOUT: out at most 50°, in at most 15°) — so the FACING follows from the feet: two toes forward
 *     keep the body square however the feet stagger; a rear toe turned out lets it blade side on.
 *   • KNEES OVER TOES. A planted foot turned on its ball turns its knee's pole with it (the rig's `splay`), so the knee
 *     always tracks the toes; the hips' turnout limit keeps that inside what a hip can do.
 *   • BALANCE. The centre of mass (figure-balance.js's segment masses) is set over the feet: the feet move under the body
 *     until it stands `weight` of the way from the rear foot's centre to the lead's (½ even), inside the footprint.
 *   • EYES ON THE TARGET. The neck and head turn the whole way back from the facing to the target (a glance, past
 *     GLANCE the neck and head at their limits); the chest turns `chest` of it too (a spine twist, up to the spine's
 *     cap), a lead shoulder brought round — the head's frame does not ride the spine's twist, so the neck turns it all.
 *   • THE HANDS where the action needs them: each hand's place is said in the TARGET's frame (`fwd` metres toward the
 *     target, `up` from a landmark — chin, chest, navel, shoulder — and `side` toward the lead side, on the target line
 *     or off the landmark), and the arm is solved to reach it (shoulder pitch and yaw, elbow; the elbow kept down).
 *
 * Two FAMILIES by foot position, and so by orientation: SQUARE (the body facing the target: the toes forward) and
 * BLADED (side on: the rear toe turned out). Every stance here leads with the RIGHT foot (the right side toward the
 * target); `<name>Left` is its exact mirror, the free third. A square stance with no lead is its own mirror.
 *
 * Each stance gives its held POSE, an ENTER clip from the stand (the feet stepping into place one at a time, the body
 * turning over them, the arms coming up) and its CHECKS (the machine gate): the centre of mass's margin inside the
 * footprint, the weight share, the knees over the toes, each hip's turnout, the gaze off the target, the legs' reach.
 * Pure and deterministic.
 */
import { rigNodesAt, boneFrames, solveTwoBone } from './station-loft-rig.js';
import { keyedClip, mirrored } from './hero-jump.js';
import { elbowsDown } from './hero-elbow.js';
import { MASS } from './figure-balance.js';

const TURNOUT = { out: 50, in: 15 };   // degrees a hip turns its knee out / in from the pelvis's forward, standing
const TWIST_CAP = 35;                  // the spine's whole axial range (figure-vajra SPINE_CAP: 5 + 9 + 21)
const GLANCE = 75;                     // the most a glance turns the neck and head (40 / 60 of it, inside their limits)
const NECK_TURN = 35, HEAD_TURN = 45;  // past a glance: the neck and the head each at its limit (figure-vajra LIMITS)
const REACH = 0.985;                   // a planted leg's most hip-to-hock reach, a share of femur + tibia
const SQUARE_BELOW = 25;               // a facing under this many degrees is square

/**
 * The stances: design words, every one leading with the right foot. `serves` names the actions each is ready for.
 *   spread  the balls of the feet apart, leg lengths      line   the foot line off the lateral, degrees (0 abreast)
 *   toes    { L, R } degrees each toe turns counter-clockwise from the target (seen from above: + toward the left)
 *   sink    the hips lowered, leg lengths                 lean   the trunk forward over the hips (the hinge), degrees
 *   weight  0 on the rear foot … 1 on the lead (½ even)   heel   the rear heel raised, degrees (on the ball)
 *   chest   the share of the facing the chest turns back toward the target (the spine twist)
 *   hands   { R, L }: { at: chin | chest | navel | shoulder (its own) | leadShoulder | rearShoulder, fwd, up, side
 *           (metres: toward the target, up, toward the lead side), line: true measured from the target line }
 */
export const STANCES = Object.freeze({
  // ── SQUARE: the feet abreast or toes forward; the body faces the target ──
  athletic: {
    family: 'square', spread: 0.52, line: 0, toes: { L: 12, R: -12 }, sink: 0.11, lean: 24, weight: 0.5, heel: 0, chest: 0,
    hands: { R: { at: 'navel', fwd: 0.32, up: 0.08, side: 0.2 }, L: { at: 'navel', fwd: 0.32, up: 0.08, side: -0.2 } },
    serves: ['receive', 'catch', 'block', 'dodge', 'jump', 'sidestep'],
  },
  low: {
    family: 'square', spread: 0.78, line: 0, toes: { L: 28, R: -28 }, sink: 0.22, lean: 32, weight: 0.5, heel: 0, chest: 0,
    hands: { R: { at: 'navel', fwd: 0.36, up: -0.04, side: 0.16 }, L: { at: 'navel', fwd: 0.36, up: -0.04, side: -0.16 } },
    serves: ['grapple', 'tackle', 'lift', 'push', 'brace'],
  },
  centre: {
    family: 'square', spread: 0.3, line: 82, toes: { L: 4, R: 0 }, sink: 0.06, lean: 4, weight: 0.5, heel: 14, chest: 1,
    hands: { R: { at: 'navel', fwd: 0.3, up: 0.06, side: 0.0, line: true }, L: { at: 'navel', fwd: 0.22, up: 0.0, side: -0.01, line: true } },
    serves: ['two-handed cut', 'spear thrust', 'staff', 'polearm', 'overhead strike'],
  },
  // ── BLADED: a rear toe turned out; the body turns side on to the target ──
  guard: {
    family: 'bladed', spread: 0.5, line: 48, toes: { L: 48, R: 18 }, sink: 0.08, lean: 10, weight: 0.45, heel: 22, chest: 0.35,
    hands: { R: { at: 'chin', fwd: 0.3, up: -0.02, side: 0.0, line: true }, L: { at: 'chin', fwd: 0.12, up: -0.05, side: -0.1, line: true } },
    serves: ['jab', 'cross', 'hook', 'kick', 'knife', 'parry'],
  },
  fencing: {
    family: 'bladed', spread: 0.62, line: 88, toes: { L: 90, R: 0 }, sink: 0.13, lean: 2, weight: 0.5, heel: 0, chest: 0.15,
    hands: { R: { at: 'leadShoulder', fwd: 0.5, up: -0.12, side: 0.0, line: true }, L: { at: 'rearShoulder', fwd: -0.08, up: 0.24, side: -0.04 } },
    serves: ['thrust', 'lunge', 'one-handed sword', 'rapier', 'parry-riposte'],
  },
  hitting: {
    family: 'bladed', spread: 0.66, line: 90, toes: { L: 92, R: 75 }, sink: 0.1, lean: 18, weight: 0.4, heel: 0, chest: 0,
    hands: { R: { at: 'rearShoulder', fwd: 0.02, up: -0.02, side: -0.18 }, L: { at: 'rearShoulder', fwd: 0.0, up: -0.08, side: -0.18 } },
    serves: ['bat swing', 'golf swing', 'two-handed slash', 'axe chop', 'throw'],
  },
});
export const STANCE_NAMES = Object.freeze(Object.keys(STANCES).flatMap((n) => (mirrors(STANCES[n]) ? [n, `${n}Left`] : [n])));
/** a stance with a lead (its feet or its hands not mirror images of each other) has a left-led twin */
function mirrors(S) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return S.line !== 0 || S.toes.L !== -S.toes.R || !same(S.hands.R, { ...S.hands.L, side: -S.hands.L.side });
}

const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2, dist = (a, b) => Math.sqrt(dist2(a, b));
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const r4 = (x) => +x.toFixed(4), r1 = (x) => +x.toFixed(1);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** the centre of mass's ground point (figure-balance's segment masses on the rig's joints) */
export function comOf(nodes) {
  let x = 0, y = 0, M = 0;
  for (const [a, b, m] of MASS) { if (!nodes[a] || !nodes[b]) continue; x += ((nodes[a][0] + nodes[b][0]) / 2) * m; y += ((nodes[a][1] + nodes[b][1]) / 2) * m; M += m; }
  return [x / M, y / M];
}
/** the convex hull of ground points (counter-clockwise), and a point's signed margin inside it (metres; − outside) */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function margin(H, q) {
  let m = Infinity;
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; const e = sub2(b, a), l = Math.hypot(e[0], e[1]); m = Math.min(m, (e[0] * (q[1] - a[1]) - e[1] * (q[0] - a[0])) / l); }
  return m;
}

/** where a planted foot bears: the middle of its sole, or of its ball when the heel is up */
function contactCentre(n, L, onBall) {
  const a = n[L.toeBase], b = onBall ? n[L.toeTip] : n[L.hock];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** the facing (degrees, + to the left) the feet allow: squared to the foot line, inside each hip's turnout */
export function facingOf({ line, toes }) {
  // each hip's turnout is its toe's angle off the pelvis's forward, outward + (the left's outward is counter-clockwise):
  // the left's is toes.L − facing, the right's facing − toes.R, each inside [−in, out]
  const lo = Math.max(toes.L - TURNOUT.out, toes.R - TURNOUT.in);
  const hi = Math.min(toes.L + TURNOUT.in, toes.R + TURNOUT.out);
  // the right foot leads: the hip line squares to the foot line rear → lead, as far as the hips allow
  return lo > hi ? (lo + hi) / 2 : clamp(line, lo, hi);
}

/**
 * Solve a stance on a rig: { name, family, lead, facing, hold (the rig pose), keys (the enter timeline), clip
 * (keyedClip of it), feet, checks, serves }.
 * @param {string} name  a STANCE_NAMES name (`<name>Left` the mirror)
 * @param {object} R     a validated rig
 */
export function heroStance(name, R, { seconds = 0.7 } = {}) {
  const left = /Left$/.test(name) && STANCES[name.slice(0, -4)]; const base = left ? name.slice(0, -4) : name;
  const S = STANCES[base]; if (!S || (left && !mirrors(S))) throw new Error(`hero-stance: no stance '${name}' (have ${STANCE_NAMES.join(', ')})`);
  const solved = solveStance(S, R);
  const keys = left ? mirrored(solved.keys) : solved.keys;
  const clip = keyedClip({ seconds, keys }, R);
  const hold = clip.fn(1);
  const lead = S.line === 0 ? null : left ? 'L' : 'R';
  return { name, family: S.family, lead, facing: r1(left ? -solved.facing : solved.facing), serves: [...S.serves], hold, keys, clip, checks: stanceChecks(R, hold, { lead: lead ?? 'R', weight: S.weight, heelRear: S.heel }) };
}

function solveStance(S, R) {
  const rest = R.joints; const legs = R.legs;
  const legLen = rest[legs.R.hip][2] - rest[legs.R.toeBase][2];
  const facing = facingOf(S);
  // the feet: balls `spread` apart along the foot line (right ahead for a lead), about the body's ground point
  const d = S.spread * legLen, u = [Math.cos(rad(S.line)), Math.sin(rad(S.line))];
  let ball = { R: [u[0] * d / 2, u[1] * d / 2], L: [-u[0] * d / 2, -u[1] * d / 2] };
  // the trunk: the hinge, the chest turned back toward the target, the eyes on it (level against the lean)
  const twist = Math.min(TWIST_CAP, Math.abs(facing) * S.chest);
  const turnBack = Math.abs(facing), sg = -Math.sign(facing);
  const trunk = {
    hinge: S.lean,
    ...(twist > 0.01 ? { spine: { sagittal: 0, lateral: 0, axial: r4(sg * twist / TWIST_CAP) } } : {}),
    ...(turnBack > 0.01 && turnBack <= GLANCE ? { glance: r1(sg * turnBack) } : {}),
    ...(turnBack > GLANCE ? { neck: { turn: sg * NECK_TURN } } : {}),
    head: { pitch: r1(S.lean * 0.7), ...(turnBack > GLANCE ? { turn: r1(sg * Math.min(HEAD_TURN, turnBack - NECK_TURN)) } : {}) },
  };
  const sinkOf = (b) => {
    // the sink asked, or deeper until both legs reach their feet
    let sink = S.sink * legLen;
    for (let i = 0; i < 80; i++) {
      const n = rigNodesAt(R, { ...trunk, facing, sink, support: 'none' }).nodes; let ok = true;
      for (const s of ['L', 'R']) { const L = legs[s]; const femur = Math.hypot(...[0, 1, 2].map((k) => rest[L.knee][k] - rest[L.hip][k])), tibia = Math.hypot(...[0, 1, 2].map((k) => rest[L.hock][k] - rest[L.knee][k])); const hock = [b[s][0], b[s][1], rest[L.hock][2] + (S.heel && s === 'L' ? 0.03 : 0)]; if (Math.hypot(...[0, 1, 2].map((k) => hock[k] - n[L.hip][k])) > REACH * (femur + tibia)) ok = false; }
      if (ok) return sink; sink += 0.005;
    }
    return sink;
  };
  const toKey = (b, sink, extra = {}) => ({
    sink,
    ...Object.fromEntries(['L', 'R'].flatMap((s) => [[`out${s}`, r4((b[s][0] - rest[legs[s].toeBase][0]) * Math.sign(rest[legs[s].hip][0]))], [`foot${s}`, r4(b[s][1] - rest[legs[s].toeBase][1])]])),
    ...extra,
  });
  const poseOf = (b, sink, arms = {}) => ({ ...trunk, ...arms, facing, splayL: S.toes.L, splayR: -S.toes.R, heelL: S.heel ? -S.heel : 0, feet: { L: [b.L[0], b.L[1], rest[legs.L.toeBase][2]], R: [b.R[0], b.R[1], rest[legs.R.toeBase][2]] }, sink });
  // BALANCE: move the feet under the body until the centre of mass stands `weight` of the way rear → lead
  const centreOf = (n, s) => contactCentre(n, legs[s], s === 'L' && S.heel > 5);
  let sink = sinkOf(ball), arms = {};
  for (let it = 0; it < 6; it++) {
    if (it === 3) arms = armsFor(S, R, poseOf(ball, sink));
    const n = rigNodesAt(R, elbowsDown(R, poseOf(ball, sink, arms))).nodes;
    const c = comOf(n), a = centreOf(n, 'L'), b = centreOf(n, 'R');
    const want = [a[0] + (b[0] - a[0]) * S.weight, a[1] + (b[1] - a[1]) * S.weight];
    const dx = c[0] - want[0], dy = c[1] - want[1];
    ball = { L: [ball.L[0] + dx, ball.L[1] + dy], R: [ball.R[0] + dx, ball.R[1] + dy] };
    sink = sinkOf(ball);
  }
  arms = armsFor(S, R, poseOf(ball, sink));
  const held = { ...trunk, ...arms, facing, splayL: S.toes.L, splayR: -S.toes.R };
  // ENTER: from the stand, the foot that moves further steps first (lifted, carried, set down), the body turning over
  // the planted feet; then the other; then the sink, the lean and the guard settle
  const move = (s) => Math.hypot(ball[s][0] - rest[legs[s].toeBase][0], ball[s][1] - rest[legs[s].toeBase][1]);
  const [first, second] = move('R') >= move('L') ? ['R', 'L'] : ['L', 'R'];
  const restB = { L: [rest[legs.L.toeBase][0], rest[legs.L.toeBase][1]], R: [rest[legs.R.toeBase][0], rest[legs.R.toeBase][1]] };
  const half = (s) => [(restB[s][0] + ball[s][0]) / 2, (restB[s][1] + ball[s][1]) / 2];
  const at = (b1, b2) => ({ [first]: b1, [second]: b2 });
  const lerpPose = (k) => ({ ...(k > 0 ? { hinge: S.lean * k, head: Object.fromEntries(Object.entries(trunk.head).map(([a, v]) => [a, v * k])), facing: facing * k } : {}), ...(k > 0 && trunk.neck ? { neck: { turn: trunk.neck.turn * k } } : {}), ...(k > 0 && trunk.spine ? { spine: { sagittal: 0, lateral: 0, axial: trunk.spine.axial * k } } : {}), ...(k > 0 && trunk.glance ? { glance: trunk.glance * k } : {}) });
  // each foot turns on its way to its place (the first, then the second)
  const splay = (k1, k2) => { const k = { [first]: k1, [second]: k2 }; return { splayL: S.toes.L * k.L, splayR: -S.toes.R * k.R }; };
  // a lifted foot is carried by a bent leg (hip forward, knee bent), so it clears the floor under the sunk hips
  // (the knee bent twice the hip's pitch lifts the foot by the leg's length times 1 − cos of the hip's: as far as the
  // hips have sunk at the lift, and 4 cm more)
  const step = (s, k) => { const L = legs[s], len = Math.hypot(...[0, 1, 2].map((i) => rest[L.knee][i] - rest[L.hip][i])) + Math.hypot(...[0, 1, 2].map((i) => rest[L.hock][i] - rest[L.knee][i]));
    const hip = deg(Math.acos(clamp(1 - (sink * k + 0.04) / len, -1, 1))); return { [`hip${s}`]: { pitch: r1(hip) }, [`knee${s}`]: r1(2 * hip) }; };
  const keys = [
    { t: 0, pose: {}, sink: 0, heel: 0, ground: 1 },
    { t: 0.14, pose: { ...lerpPose(0.15) }, ...toKey(restB, sink * 0.4), heel: 0, ground: 1 },
    { t: 0.3, pose: { ...lerpPose(0.4), ...splay(0.5, 0), ...step(first, 0.6) }, ...toKey(at(half(first), restB[second]), sink * 0.6), [`ground${first}`]: 0, [`ground${second}`]: 1, heel: 0 },
    { t: 0.44, pose: { ...lerpPose(0.6), ...splay(1, 0) }, ...toKey(at(ball[first], restB[second]), sink * 0.7), ground: 1, heel: 0 },
    { t: 0.58, pose: { ...lerpPose(0.8), ...splay(1, 0.5), ...step(second, 0.85) }, ...toKey(at(ball[first], half(second)), sink * 0.85), [`ground${first}`]: 1, [`ground${second}`]: 0, heel: 0 },
    { t: 0.74, pose: { ...lerpPose(1), ...splay(1, 1), ...halfArms(arms, 0.7) }, ...toKey(ball, sink), ground: 1, heel: 0 },
    { t: 1, pose: { ...held }, ...toKey(ball, sink), ground: 1, ...(S.heel ? { heelL: S.heel } : {}), heel: 0 },
  ];
  return { facing, keys };
}
const halfArms = (arms, k) => Object.fromEntries(Object.entries(arms).map(([j, v]) => [j, typeof v === 'number' ? v * k : Object.fromEntries(Object.entries(v).map(([a, x]) => [a, x * k]))]));

/** a landmark on the posed body (rig frame) */
function landmark(n, at, side) {
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  if (at === 'chin') return [n.headBase[0], n.headBase[1], n.headBase[2] - 0.03];
  if (at === 'chest') { const m = mid(n.shoulderL, n.shoulderR); return [m[0], m[1], m[2] - 0.12]; }
  if (at === 'navel') return [...n.navel];
  if (at === 'shoulder') return [...n[`shoulder${side}`]];
  if (at === 'leadShoulder') return [...n.shoulderR];   // every stance here leads with the right
  if (at === 'rearShoulder') return [...n.shoulderL];
  throw new Error(`hero-stance: no landmark '${at}' (chin, chest, navel, shoulder, leadShoulder, rearShoulder)`);
}

/** each arm solved to put its wrist where the stance's hands say (in the target's frame), the elbow kept down */
function armsFor(S, R, body) {
  const lite = { ...R, rides: {}, chains: {}, folds: undefined };   // the wrists alone: no riders, no folds
  const n0 = rigNodesAt(lite, body).nodes; const out = {};
  for (const side of ['R', 'L']) {
    const h = S.hands[side]; const lm = landmark(n0, h.at, side === 'R' ? 'R' : 'L');
    // the lead side is the right (+x); `side` metres toward it, from the target line or the landmark
    const goal = [(h.line ? 0 : lm[0]) + h.side, lm[1] + h.fwd, lm[2] + h.up];
    // a hand is reached many ways (the arm swivels about its shoulder → wrist line): ELBOWS DOWN picks the one — the
    // elbow in the upright plane through the shoulder and the wrist, under their line
    // so the elbow's place is solved first (two links from the shoulder to the hand, bent toward the floor and a little
    // out), and the shoulder and elbow angles are searched to put the elbow and the wrist there
    const l1 = dist(R.joints[`shoulder${side}`], R.joints[`elbow${side}`]), l2 = dist(R.joints[`elbow${side}`], R.joints[`wrist${side}`]);
    const pole = [side === 'R' ? 0.25 : -0.25, 0, -1];
    // (the roll is searched too: the rig's own elbow-down roll is set for an arm swung straight ahead, and an arm swung
    // across a turned body needs its own)
    const cost = ([p, y, e, r]) => {
      const n = rigNodesAt(lite, elbowsDown(R, { ...body, [`sh${side}`]: { pitch: p, yaw: y, roll: r }, [`elbow${side}`]: e })).nodes;
      const w = n[`wrist${side}`], el = n[`elbow${side}`], sh = n[`shoulder${side}`];
      const d = dist(sh, goal), k = Math.min(1, (0.999 * (l1 + l2)) / d), g = [sh[0] + (goal[0] - sh[0]) * k, sh[1] + (goal[1] - sh[1]) * k, sh[2] + (goal[2] - sh[2]) * k];
      const sol = solveTwoBone(sh, g, l1, l2, pole); const E = sol.ok ? sol.mid : el;
      return dist2(w, goal) + 0.5 * dist2(el, E);
    };
    let best = null;
    for (let p = -30; p <= 170; p += 20) for (let y = -90; y <= 90; y += 22.5) for (let e = 0; e <= 150; e += 30) for (let r = -60; r <= 60; r += 30) { const c = cost([p, y, e, r]); if (!best || c < best.c) best = { x: [p, y, e, r], c }; }
    for (const step of [12, 6, 3, 1, 0.5]) {
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < 4; i++) for (const sg of [1, -1]) {
          const x = [...best.x]; x[i] += sg * step; x[2] = clamp(x[2], 0, 150); x[0] = clamp(x[0], -40, 175); x[1] = clamp(x[1], -100, 100); x[3] = clamp(x[3], -90, 90);
          const c = cost(x); if (c < best.c - 1e-12) { best = { x, c }; moved = true; }
        }
      }
    }
    out[`sh${side}`] = { pitch: r1(best.x[0]), yaw: r1(best.x[1]), roll: r1(best.x[3]) }; out[`elbow${side}`] = r1(best.x[2]);
    out[`$reach${side}`] = Math.sqrt(best.c);
  }
  const reachErr = { R: out.$reachR, L: out.$reachL }; delete out.$reachR; delete out.$reachL;
  Object.defineProperty(out, '$reach', { value: reachErr, enumerable: false });
  return out;
}

/**
 * The machine gate on a held stance pose: { com: { margin (m, + inside the footprint), weight (0 rear … 1 lead) },
 * knees: { L, R } (degrees the knee strays off its toe's line), turnout: { L, R } (degrees each knee turns out from the
 * pelvis's forward), gaze (degrees the head looks off the target), reach: { L, R } ('ok' | 'clamped'), floor (metres
 * the lowest planted toe sits off the floor) }.
 */
export function stanceChecks(R, pose, { lead = 'R', weight = 0.5, heelRear = 0 } = {}) {
  const { nodes: n, report } = rigNodesAt(R, pose); const legs = R.legs; const rear = lead === 'R' ? 'L' : 'R';
  const c = comOf(n);
  const pts = []; for (const s of ['L', 'R']) { const L = legs[s]; pts.push(n[L.toeBase], n[L.toeTip]); if (!(s === rear && heelRear > 5)) pts.push(n[L.hock]); }
  const H = hull(pts.map((p) => [p[0], p[1]]));
  const centre = (s) => contactCentre(n, legs[s], s === rear && heelRear > 5);
  const a = centre(rear), b = centre(lead), ab = sub2(b, a), l2 = ab[0] ** 2 + ab[1] ** 2;
  const w = l2 > 1e-9 ? ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1]) / l2 : 0.5;
  const hipFwd = (() => { const v = sub2(n.hipR, n.hipL); return deg(Math.atan2(v[1], v[0])); })();   // the hip line's angle: the pelvis faces it + 90°
  const knees = {}, turnout = {};
  for (const s of ['L', 'R']) {
    const L = legs[s]; const toe = sub2(n[L.toeTip], n[L.toeBase]); const toeA = deg(Math.atan2(toe[1], toe[0]));
    // the knee's way: its offset off the hip → hock line, seen from above
    const hp = n[L.hip], hk = n[L.hock], kn = n[L.knee]; const ax = [hk[0] - hp[0], hk[1] - hp[1], hk[2] - hp[2]]; const al = Math.hypot(...ax);
    const t = ((kn[0] - hp[0]) * ax[0] + (kn[1] - hp[1]) * ax[1] + (kn[2] - hp[2]) * ax[2]) / (al * al);
    const off = [kn[0] - hp[0] - ax[0] * t, kn[1] - hp[1] - ax[1] * t]; const kneeA = deg(Math.atan2(off[1], off[0]));
    knees[s] = r1(Math.abs(wrap(kneeA - toeA)));
    turnout[s] = r1(wrap(toeA - hipFwd - 90) * (s === 'L' ? 1 : -1));
  }
  const head = boneFrames(R, R.joints, n)[R.boneIndex.head]; const g = [head.m[0][1], head.m[1][1]];
  const gaze = r1(Math.abs(deg(Math.atan2(-g[0], g[1]))));
  const floor = Math.min(...['L', 'R'].map((s) => n[legs[s].toeBase][2])) - Math.min(...['L', 'R'].map((s) => R.joints[legs[s].toeBase][2]));
  return { com: { margin: r4(margin(H, c)), weight: r4(w) }, knees, turnout, gaze, reach: Object.fromEntries(Object.entries(report.legs).map(([s, v]) => [s, v.reach])), floor: r4(floor) };
}
