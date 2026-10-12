// hero-rise — getting UP out of a rest pose (hero-rest.js), and sitting or lying DOWN into it, solved from contacts. A
// clip is a ROUTE of contact STATES — each a pose with what it rests on (the sit bones on the seat, planted feet, knees
// on the floor, hands on a thigh, an armrest, the seat or the floor) — timed in seconds. Between the states the words
// flow through them (hero-jump's monotone cubic: the body passes through a state, it does not stop on it) and the
// contacts are re-solved at every frame: a planted foot holds its spot, a foot that moves is lifted along a min-jerk arc
// (one carried a long way swings round beside the body), a hand held through two states holds its point (the arm solved
// step by step from where it was, so it never flips to another way of reaching), the sit bones keep the seat, and the
// body is lifted off the floor by whatever of it would go through.
//
//   • FROM A SEAT (a chair, a couch), by the phases of sit-to-stand (Schenkman et al. 1990): sit up off the backrest,
//     scoot forward, draw the feet back behind the knees, flex forward over the hips and leave the seat, the transfer over
//     the feet, extend. The flexion at SEAT-OFF is solved, not authored: the least for which the body's momentum carries
//     its centre of mass over the feet (Hof's extrapolated centre of mass). The hands push off the thighs (a chair), the
//     seat beside the hips (a couch) or an armrest. Sitting down plays the states back, slower, the seat met near the end
//     of the descent; a lounge is let down onto the backrest on the arms.
//   • FROM THE FLOOR: cross-legged (and the lotus) uncross into a knees-up sit, the hands on the floor behind; lean over
//     the right knee, the left leg comes under onto its knee (a deep half kneel), the back knee lifts on tucked toes, the
//     push over the front foot, the back foot steps up beside it. A knee already up goes the same way from the lean.
//   • FROM LYING: sitting up, off the back or the side, propped on the hands, into the knees-up sit, then up as from the
//     floor; a body knocked out gets up the same way, slower (groggy). Lying down is the route reversed.
//   • KNOCKED OUT (knockedOut, yamcha): down is a COLLAPSE — the knees buckle, then the body falls about its feet as a
//     rod under gravity (θ'' = 3g / 2L · sin θ: the fall timed by the figure's own height), lands, and the limbs settle.
//
// Each clip gives its keys, `fn(t)` (t 0 … 1, a one-shot), its states and their times, the seat-off (or seat contact)
// and impact moments, the props of its rest, and its CHECKS (the machine gate): the ends equal to the rest pose and the
// stand, nothing through the floor or the seat, planted feet not sliding, balance (the extrapolated centre of mass inside
// what bears the body, out of it no longer than a step takes), the knees and hips in range, joint speeds bounded. Pure
// and deterministic.
import { rigNodesAt, HAND_POSES } from './station-loft-rig.js';
import { elbowsDown } from './hero-elbow.js';
import { reachArm, comOf, hull, margin } from './hero-stance.js';
import { curve } from './hero-jump.js';
import { heroRest, RESTS, REST_NAMES, heightOf, floorOf, ischOf, turnOf, frontOf, BODY_JOINTS, fleshAt, flatHand } from './hero-rest.js';
import { CANON_HEIGHT } from './hero-canon.js';
import { MASS } from './figure-balance.js';
import { liteOf } from './hero-grip.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), dist = (a, b) => len(sub(a, b)), unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
const angle = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r1 = (x) => +x.toFixed(1), r3 = (x) => +x.toFixed(3), r4 = (x) => +x.toFixed(4);
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
/** the minimum-jerk profile (Flash & Hogan 1985): a reach's own ease, still at both ends */
const minJerk = (m) => { const x = clamp(m, 0, 1); return x * x * x * (10 - 15 * x + 6 * x * x); };
const SIDES = ['R', 'L'];
const G = 9.81;

// ─── a state's pose ───────────────────────────────────────────────────────────────────────────────────────────────────
const NON_WORDS = new Set(['support', 'sink', 'shift', 'body', 'feet']);
/** the joint words of a pose (all but how the body is placed and where its feet are) */
const wordsOf = (pose) => Object.fromEntries(Object.entries(pose).filter(([k]) => !NON_WORDS.has(k)));
/**
 * A pose from a placement: the words, the pelvis at `W` (world), the whole figure turned (`pitch`, `roll`) about it, each
 * planted foot's toe at its world spot (`feet` { S: world | null }) — carried into the upright frame the legs are solved
 * in and kept inside the leg's reach.
 */
function placed(R, { words, W, pitch = 0, roll = 0, feet = {} }) {
  const J = R.joints, pz = J.pelvisHub[2], sink = Math.max(0, pz - W[2]), at = [W[0], W[1], pz - sink], up = W[2] - at[2];
  const turned = Math.abs(pitch) > 1e-9 || Math.abs(roll) > 1e-9 || Math.abs(up) > 1e-9;
  const pose = { ...words, support: 'none', sink, shift: { x: W[0] - J.pelvisHub[0], y: W[1] - J.pelvisHub[1] }, ...(turned ? { body: { pitch, roll, at, up } } : {}) };
  const planted = SIDES.filter((S) => feet[S]);
  if (!planted.length) return pose;
  const T = turnOf({ pitch, roll }), toUp = (p) => add(at, mtv(T.M, sub(sub(p, [0, 0, up]), at)));
  const free = rigNodesAt(R, pose).nodes, upright = free.$body?.unrot ?? free;
  return { ...pose, feet: Object.fromEntries(planted.map((S) => [S, reachToe(R, S, upright[R.legs[S].hip], toUp(feet[S]), pose)])) };
}
/** a toe target pulled in to what the leg reaches from its hip: the hock (the toe plus the foot turned by its heel and
 * splay words) inside 99.5 % of thigh and shin */
function reachToe(R, S, hip, toe, pose) {
  const J = R.joints, L = R.legs[S], max = 0.995 * (dist(J[L.hip], J[L.knee]) + dist(J[L.knee], J[L.hock]));
  const h = rad(pose[`heel${S}`] || 0); let o = sub(J[L.hock], J[L.toeBase]);
  o = [o[0], o[1] * Math.cos(h) - o[2] * Math.sin(h), o[1] * Math.sin(h) + o[2] * Math.cos(h)];
  const sp = rad((pose[`splay${S}`] || 0) * (J[L.hip][0] < 0 ? 1 : -1)); o = [o[0] * Math.cos(sp) - o[1] * Math.sin(sp), o[0] * Math.sin(sp) + o[1] * Math.cos(sp), o[2]];
  const hockAt = (t) => add(lerp3(hip, toe, t), o);
  if (dist(hip, hockAt(1)) <= max) return toe;
  let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (dist(hip, hockAt(m)) <= max) lo = m; else hi = m; }
  return lerp3(hip, toe, lo);
}
/** a state read off a rest pose: its words, where its pelvis is and how it is turned, its planted toes (world) */
function fromRest(R, K, extra = {}) {
  const n = rigNodesAt(R, K.pose).nodes, B = K.pose.body || {};
  const feet = Object.fromEntries(SIDES.filter((S) => K.pose.feet?.[S]).map((S) => [S, n[R.legs[S].toeBase]]));
  return { name: K.name, words: wordsOf(K.pose), W: n.pelvisHub, pitch: B.pitch ?? 0, roll: B.roll ?? 0, feet, hands: { ...(K.contacts.hands || {}) }, ...extra };
}

// ─── the frames between states ────────────────────────────────────────────────────────────────────────────────────────
/** every numeric leaf of a pose as path → value (`hipL.pitch`, `kneeL`) */
function flatten(o, pre = '', out = {}) { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, `${pre}${k}.`, out); else if (Number.isFinite(v)) out[`${pre}${k}`] = v; } return out; }
function unflatten(m) { const o = {}; for (const [p, v] of Object.entries(m)) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c = c[k] || (c[k] = {}); }); c[ks[ks.length - 1]] = v; } return o; }

/**
 * The route played: states [{ t (seconds), words, W, pitch, roll, feet, hands, sit, lie, fall }] → a frame at any time.
 * The words, the pelvis and the turn flow through the states; per segment the feet hold or step, the hands hold or
 * reach, the sit bones keep the seat, a lying body keeps off the floor.
 */
function player(R, states, { backward = false } = {}) {
  const J = R.joints, s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R), isch = ischOf(R);
  let flat = states.map((st) => flatten(st.words));
  const paths = [...new Set(flat.flatMap((f) => Object.keys(f)))];
  const through = (vals) => curve(states.map((st, i) => ({ t: st.t, v: vals(st, i) })));
  const C = {};
  const rebuild = (only = paths) => { flat = states.map((st) => flatten(st.words)); for (const p of only) C[p] = through((st, i) => flat[i][p] ?? 0); };
  rebuild();
  const CW = [0, 1, 2].map((k) => through((st) => st.W[k])), CP = through((st) => st.pitch), CR = through((st) => st.roll);
  const T1 = states[states.length - 1].t, chains = new Map();
  /** a held hand's arm through segment i: reached at CHAIN steps, each seeded from the step before (so the arm keeps its
   * way of reaching), from the nearer state's words toward the rest pose's side. Built segment by segment, before any
   * frame is played. */
  const CHAIN = 24, armOf = (w, S) => ({ sh: { pitch: 0, yaw: 0, roll: 0, ...(w[`sh${S}`] || {}) }, elbow: w[`elbow${S}`] ?? 0 });
  const mixArm = (p, q, x) => ({ sh: Object.fromEntries(['pitch', 'yaw', 'roll'].map((k) => [k, lerp(p.sh[k] ?? 0, q.sh[k] ?? 0, x)])), elbow: lerp(p.elbow, q.elbow, x) });
  const chainOf = (i, S) => chains.get(`${i}${S}`);
  // (a hand slides a few centimetres along what it rests on)
  const handAt = (ha, hb, m) => lerp3(ha, hb, minJerk(m));
  // (anchored at the rest pose: run forward from it when the clip starts there, backward from it when the clip ends there)
  const segs = [...Array(states.length - 1).keys()]; if (backward) segs.reverse();
  const wristMix = (A, B, x) => (A.wrist || B.wrist ? Object.fromEntries(['flex', 'deviation', 'twist'].map((q) => [q, lerp(A.wrist?.[q] ?? 0, B.wrist?.[q] ?? 0, x)])) : undefined);
  for (const i of segs) for (const S of SIDES) {
    const a = states[i], b = states[i + 1]; if (!a.hands[S] || !b.hands[S] || dist(a.hands[S], b.hands[S]) >= 0.08 * s) continue;
    const from = backward ? b : a, far = backward ? i : i + 1, mOf = (p) => (backward ? 1 - p : p);
    const steps = [{ ...armOf(from.words, S), ...(from.words[`wrist${S}`] ? { wrist: from.words[`wrist${S}`] } : {}) }];
    for (let k = 1; k <= CHAIN; k++) {
      const m = mOf(k / CHAIN), body = frameAt(lerp(a.t, b.t, m), true, i).pose, goal = handAt(a.hands[S], b.hands[S], m);
      let arm = { ...reachNear(R, body, S, goal, steps[k - 1]), ...(steps[k - 1].wrist ? { wrist: steps[k - 1].wrist } : {}) };
      // (a hand held on the floor kept flat on it as the arm turns over it, the wrist raised by what of it would still
      // press into the floor)
      if (goal[2] - floor < 0.06 * s) for (let it = 0, g = goal; it < 3; it++) {
        arm.wrist = flatNear(R, { ...body, [`sh${S}`]: arm.sh, [`elbow${S}`]: arm.elbow }, S, floor, s, steps[k - 1].wrist ?? { flex: 0, deviation: 0 });
        const n = rigNodesAt(R, { ...body, [`sh${S}`]: arm.sh, [`elbow${S}`]: arm.elbow, [`wrist${S}`]: arm.wrist }).nodes, low = Math.min(n[`knuckles${S}`][2] - fleshAt(`knuckles${S}`, R, s), n[`wrist${S}`][2] - fleshAt(`wrist${S}`, R, s)) - floor;
        if (low >= -0.003) break;
        g = add(g, [0, 0, -low]); arm = { ...reachNear(R, body, S, g, arm), wrist: arm.wrist };
      }
      steps.push(arm);
    }
    const at = (p) => { const x = clamp(p, 0, 1) * CHAIN, k = Math.min(CHAIN - 1, Math.floor(x)), out = mixArm(steps[k], steps[k + 1], x - k), w = wristMix(steps[k], steps[k + 1], x - k); return w ? { ...out, wrist: w } : out; };
    // (the far state is the clip's own end, met exactly: the chain eases onto its words over the last third)
    if (far === 0 || far === states.length - 1) {
      const E = { ...armOf(states[far].words, S), wrist: states[far].words[`wrist${S}`] };
      chains.set(`${i}${S}`, (m) => { const p = backward ? 1 - m : m, c = at(p), e = minJerk((p - 0.67) / 0.33), out = mixArm(c, E, e), w = wristMix(c, E, e); return w ? { ...out, wrist: w } : out; });
      continue;
    }
    // (else the far state takes the arm the chain ends on, so the next segment flows on from it)
    const end = steps[CHAIN], fw = { [`sh${S}`]: end.sh, [`elbow${S}`]: end.elbow, ...(end.wrist ? { [`wrist${S}`]: end.wrist } : {}) };
    states[far] = { ...states[far], words: { ...states[far].words, ...fw } };
    rebuild([...new Set([...paths, ...Object.keys(flatten(fw))])].filter((p) => p.startsWith(`sh${S}.`) || p === `elbow${S}` || p.startsWith(`wrist${S}.`)));
    chains.set(`${i}${S}`, (m) => at(backward ? 1 - m : m));
  }
  return (time) => frameAt(time, false);
  function frameAt(time, noHands, seg = null) {
    const t = clamp(time, 0, T1);
    let i = 0; if (seg !== null) i = seg; else while (i < states.length - 2 && states[i + 1].t <= t) i++;
    const a = states[i], b = states[i + 1], m = (t - a.t) / (b.t - a.t || 1), mj = minJerk(m);
    const words = unflatten(Object.fromEntries(paths.map((p) => [p, C[p](t)])));
    let W = CW.map((c) => c(t)); const pitch = CP(t), roll = CR(t);
    // the sit bones held on the seat while seated (the whole figure carried up or down so they stay on it)
    if (a.sit !== undefined && b.sit !== undefined && a.sit !== null && b.sit !== null) { const sz = W[2] + mv(turnOf({ pitch, roll }).M, isch)[2]; W = [W[0], W[1], W[2] + (a.sit - sz)]; }
    // the feet: held, stepped along an arc, or blended between their free swing and a spot
    // (a body on the floor with its legs free is first lifted off it on its free legs, which the feet then leave from;
    // a leg on its spot is the feet's below)
    let free = rigNodesAt(R, placed(R, { words, W, pitch, roll })).nodes;
    if (a.lie || b.lie) {
      // (a leg coming to its spot counts for less as it comes: the lift fades out as the foot takes the floor)
      const weight = (k) => { const S = SIDES.find((q) => k.endsWith(q)); if (!/^(knee|ankle|toe)/.test(k) || !S) return 1; const fa = a.feet[S], fb = b.feet[S]; return fa && fb ? 0 : fa ? mj : fb ? 1 - mj : 1; };
      let need = 0; for (const k of BODY_JOINTS) { if (!free[k] || /^(wrist|knuckles)/.test(k) || (a.sit != null && b.sit != null && /^(pelvisHub|hip[LR])$/.test(k))) continue; need = Math.max(need, weight(k) * (-(free[k][2] - fleshAt(k, R, s) - floor) - 0.01)); }
      if (need > 0) { W = [W[0], W[1], W[2] + need]; free = rigNodesAt(R, placed(R, { words, W, pitch, roll })).nodes; }
    }
    const feet = {}, ground = {}, held = {}, heels = {};
    for (const S of SIDES) {
      const fa = a.feet[S], fb = b.feet[S], L = R.legs[S];
      if (fa && fb) {
        if (dist(fa, fb) < 1e-4) { feet[S] = fa; held[S] = true; }
        // (a stepping foot lifted on its way; one carried a long way under the body moves while the body is up off it —
        // after it has risen, before it comes down — low over the floor, bowed out to its own side, so the leg swings
        // round beside the body, folded no more than it must be)
        else { const d = dist(fa, fb), far = d > 0.25 * s, lift = far ? 0.008 * s : Math.min(0.06 * s, 0.4 * d + 0.01 * s), bow = far ? (S === "R" ? 1 : -1) * Math.min(0.15 * s, 0.3 * d) : 0, win = a.window ?? b.window ?? 0.65, u = far ? (a.W[2] <= b.W[2] ? minJerk((m - 1 + win) / win) : minJerk(m / win)) : mj; const p = lerp3(fa, fb, u), arc = Math.sin(Math.PI * u); feet[S] = [p[0] + bow * arc, p[1], p[2] + lift * arc]; }
        ground[S] = 1;
      } else if (fa || fb) {
        const g = fa ? 1 - mj : mj; ground[S] = g;
        // (a foot coming to (or leaving) its spot: from where its free leg carries it, never below the floor, and tilted as
        // the free foot is, easing to its planted tilt — so the leg's solve takes over the free leg where it is)
        if (g > 0.02) {
          const p = lerp3(free[L.toeBase], fa ?? fb, g); feet[S] = [p[0], p[1], Math.max(p[2], J[L.toeBase][2])];
          const up = free.$body?.unrot ?? free, ang = (v) => Math.atan2(v[2], v[1]), tilt = deg(ang(sub(up[L.hock], up[L.toeBase])) - ang(sub(J[L.hock], J[L.toeBase])));
          heels[`heel${S}`] = lerp(((tilt + 540) % 360) - 180, words[`heel${S}`] ?? 0, g);
        }
      } else ground[S] = 0;
    }
    let pose = placed(R, { words: { ...words, ...heels }, W, pitch, roll, feet });
    const sits = a.sit !== undefined && a.sit !== null && b.sit !== undefined && b.sit !== null;
    // the body kept off the floor: the whole figure lifted by what of it would go through (by more than a centimetre: the
    // flesh gives that much, and the rest poses' own contacts sit within it); a body sitting keeps its seat
    {
      // (again until it holds: a lifted pelvis re-solves the planted legs; the hands held to the floor are placed after)
      for (let it = 0; it < 4; it++) {
        const n = rigNodesAt(R, pose).nodes; let low = Infinity;
        for (const k of BODY_JOINTS) { if (!n[k] || (sits && /^(pelvisHub|hip[LR])$/.test(k)) || (/^(toe|ankle)/.test(k) && SIDES.some((S) => k.endsWith(S) && ground[S] === 1)) || (/^(wrist|knuckles)/.test(k) && SIDES.some((S) => k.endsWith(S) && a.hands[S] && b.hands[S]))) continue; low = Math.min(low, n[k][2] - fleshAt(k, R, s) - floor); }
        if (low >= -0.01) break;
        W = [W[0], W[1], W[2] - low - 0.01]; pose = { ...placed(R, { words: wordsOf(pose), W, pitch, roll, feet }) };
      }
    }
    // the hands: held where two states hold them alike (or slid a little), else carried by their words
    const bear = {};
    for (const S of SIDES) {
      const ha = a.hands[S], hb = b.hands[S]; if (!ha || !hb || dist(ha, hb) >= 0.08 * s) continue;
      if (dist(ha, hb) < 0.01 * s && a.bears?.[S] && b.bears?.[S]) bear[S] = lerp3(ha, hb, mj);   // (a hand kept on its place bears)
      if (noHands || !chainOf(i, S)) continue;
      const arm = chainOf(i, S)(m);
      pose = { ...pose, [`sh${S}`]: arm.sh, [`elbow${S}`]: arm.elbow, ...(arm.wrist ? { [`wrist${S}`]: arm.wrist } : {}) };
    }
    // a hand carried by its words kept off the floor: raised (the arm turned a little) where it would go through
    if (!noHands) for (const S of SIDES) for (let it = 0; it < 2; it++) {
      if (a.hands[S] && b.hands[S] && dist(a.hands[S], b.hands[S]) < 0.08 * s) continue;
      const n = rigNodesAt(R, pose).nodes, w = n[`wrist${S}`], low = Math.min(w[2] - 0.025 * s, n[`knuckles${S}`][2] - 0.015 * s) - floor;
      if (low >= -0.005) break;
      const arm = reachNear(R, pose, S, add(w, [0, 0, -low]), { sh: { pitch: 0, yaw: 0, roll: 0, ...(pose[`sh${S}`] || {}) }, elbow: pose[`elbow${S}`] ?? 0 }, 30);
      pose = { ...pose, [`sh${S}`]: arm.sh, [`elbow${S}`]: arm.elbow };
    }
    return { pose, seg: i, ground, held, bear, sit: a.sit !== undefined && a.sit !== null && b.sit !== undefined && b.sit !== null, lie: !!(a.lie || b.lie), fall: !!(a.fall || b.fall) };
  }
}

/**
 * An arm brought to a goal from where it is, by no more than BOUND degrees a joint: the words (as a pose takes them)
 * searched in small steps about `from`, so the arm follows a hold without ever leaping to another way of reaching it.
 */
const BOUND = 8;
function reachNear(R, body, S, goal, from, bound = BOUND) {
  const at = (x) => ({ ...body, [`sh${S}`]: { pitch: x[0], yaw: x[1], roll: x[2] }, [`elbow${S}`]: x[3] });
  const x0 = [from.sh.pitch ?? 0, from.sh.yaw ?? 0, from.sh.roll ?? 0, from.elbow ?? 0];
  const lite = liteOf(R), cost = (x) => { const w = rigNodesAt(lite, at(x)).nodes[`wrist${S}`]; return dot(sub(w, goal), sub(w, goal)) + 1e-7 * x.reduce((t, v, i) => t + (v - x0[i]) ** 2, 0); };
  let best = { x: x0, c: cost(x0) };
  for (const step of [2, 1, 0.5, 0.25]) {
    let moved = true;
    while (moved) { moved = false; for (let i = 0; i < 4; i++) for (const sg of [1, -1]) { const x = [...best.x]; x[i] = clamp(x[i] + sg * step, x0[i] - bound, x0[i] + bound); if (i === 3) x[3] = clamp(x[3], 0, 150); const c = cost(x); if (c < best.c - 1e-12) { best = { x, c }; moved = true; } } }
  }
  return { sh: { pitch: best.x[0], yaw: best.x[1], roll: best.x[2] }, elbow: best.x[3] };
}

/** a hand kept flat on the floor from how it lay a moment before (hero-rest flatHand's aim — the knuckles a finger's
 * breadth over the floor, level with the wrist — searched about the last wrist, never far from it) */
function flatNear(R, pose, S, floor, s, from) {
  const sq = (v) => v * v, x0 = [from.flex ?? 0, from.deviation ?? 0];
  const f = (x) => { const n = rigNodesAt(R, { ...pose, [`wrist${S}`]: { flex: x[0], deviation: x[1], twist: 0 } }).nodes; return sq(n[`knuckles${S}`][2] - floor - 0.018 * s) + 0.25 * sq(n[`knuckles${S}`][2] - n[`wrist${S}`][2]) + 1e-6 * (sq(x[0] - x0[0]) + sq(x[1] - x0[1])); };
  let best = { x: x0, c: f(x0) };
  for (const st of [4, 2, 1, 0.5]) { let moved = true; while (moved) { moved = false; for (let i = 0; i < 2; i++) for (const sg of [1, -1]) { const x = [...best.x]; x[i] = clamp(x[i] + sg * st, Math.max(i ? -30 : -70, x0[i] - 12), Math.min(i ? 20 : 70, x0[i] + 12)); const c = f(x); if (c < best.c - 1e-12) { best = { x, c }; moved = true; } } } }
  return { flex: best.x[0], deviation: best.x[1], twist: 0 };
}

// ─── the states ───────────────────────────────────────────────────────────────────────────────────────────────────────
const legOf = (R, S) => { const J = R.joints, L = R.legs[S]; return { L, thigh: dist(J[L.hip], J[L.knee]), shin: dist(J[L.knee], J[L.hock]), toe: J[L.toeBase] }; };
/** the posed nodes of a state */
const nodesOf = (R, st) => rigNodesAt(R, placed(R, st)).nodes;
/** a state's pose re-read after its arms reached their goals ({ S: world }): the words with the arms, the hands the
 * wrists' places */
function withHands(R, st, goals, poles = {}, seed = null) {
  let pose = placed(R, st);
  for (const [S, g] of Object.entries(goals)) { const a = reachArm(R, pose, S, g, seed?.[`sh${S}`] ? { sh: { pitch: 0, yaw: 0, roll: 0, ...seed[`sh${S}`] }, elbow: seed[`elbow${S}`] ?? 0 } : null, poles[S] ? { pole: poles[S] } : {}); pose = { ...pose, [`sh${S}`]: a.sh, [`elbow${S}`]: a.elbow, [`fingers${S}`]: { ...HAND_POSES.relaxed } }; }
  pose = elbowsDown(R, pose);
  const n = rigNodesAt(R, pose).nodes;
  // (a hand that reached its goal holds the goal itself, so two states sharing a hold share it exactly)
  return { ...st, words: wordsOf(pose), hands: { ...st.hands, ...Object.fromEntries(Object.entries(goals).map(([S, g]) => [S, dist(n[`wrist${S}`], g) < 0.05 ? g : n[`wrist${S}`]])) } };
}
/** the support's points under a frame (xy): the planted feet, the sit bones on (or within a catch of) their seat, knees on
 * the floor, the hands that bear (on an armrest, the floor) */
function supportOf(R, n, f, s, floor, isch, seat = null) {
  const pts = [];
  for (const S of SIDES) {
    const L = R.legs[S];
    // (a foot as wide as it is: its ball and toes ± 4 cm, its heel ± 3 cm when down)
    if ((f.ground?.[S] ?? 0) >= 0.5) { const w = (p, d) => [[p[0] - d, p[1]], [p[0] + d, p[1]]]; pts.push(...w(n[L.toeBase], 0.04 * s), ...w(n[L.toeTip], 0.03 * s)); if (n[L.hock][2] - floor < 0.12 * s) pts.push(...w([n[L.hock][0], n[L.hock][1] - 0.04 * s], 0.03 * s)); }
    if (n[L.knee][2] - fleshAt(L.knee, R, s) - floor < 0.025 * s) pts.push(n[L.knee]);
    if (f.bear?.[S] && dist(n[`wrist${S}`], f.bear[S]) < 0.03 * s) pts.push(n[`wrist${S}`]);   // (where it is on its hold)
  }
  // the seat bears the sit bones on it, and catches them within 3 cm of it (the last of sitting down is a drop onto it)
  // (and the thighs where they lie on it)
  if (seat) {
    const T = n.$body?.M, c = (x, y = 0) => add(add(n.pelvisHub, [x, y, 0]), T ? mv(T, isch) : isch), m = c(0);
    if (m[2] - seat.z < 0.03 * s && (seat.kind === 'floor' || (m[1] > seat.yb && m[1] < seat.front))) {
      pts.push(c(0.06 * s), c(-0.06 * s), c(0.06 * s, -0.04 * s), c(-0.06 * s, -0.04 * s));
      for (const S of SIDES) for (const u of [0.3, 0.5, 0.7]) { const L = R.legs[S], q = lerp3(n[L.hip], n[L.knee], u); if ((seat.kind === 'floor' || q[1] < seat.front) && q[2] - 0.07 * s - seat.top < 0.02 * s) pts.push(q); }
    }
  }
  if (n.pelvisHub[2] - fleshAt('pelvisHub', R, s) - floor < 0.03 * s) pts.push(n.pelvisHub);
  return pts.map((p) => [p[0], p[1]]);
}
/** a seated body's feet as support (xy): each toe's base and tip and its heel */
const feetPts = (R, n, s) => SIDES.flatMap((S) => { const L = R.legs[S]; return [n[L.toeBase], n[L.toeTip], [n[L.hock][0], n[L.hock][1] - 0.04 * s, 0]]; }).map((p) => [p[0], p[1]]);
/** the centre of mass in 3D (figure-balance's segment masses on the rig's joints) */
function com3(n) { let x = 0, y = 0, z = 0, M = 0; for (const [a, b, m] of MASS) { if (!n[a] || !n[b]) continue; x += ((n[a][0] + n[b][0]) / 2) * m; y += ((n[a][1] + n[b][1]) / 2) * m; z += ((n[a][2] + n[b][2]) / 2) * m; M += m; } return [x / M, y / M, z / M]; }
/** the extrapolated centre of mass (Hof 2005): where the centre of mass's momentum carries it, as an inverted pendulum
 * of its own height over the floor */
const xcomOf = (c, v, floor) => { const w0 = Math.sqrt(G / Math.max(0.15, c[2] - floor)); return [c[0] + v[0] / w0, c[1] + v[1] / w0]; };

/**
 * FROM A SEAT, by the phases of sit-to-stand (Schenkman et al. 1990): rest → READY (scooted forward until half the thigh
 * is off the seat, upright, the feet drawn back behind the knees, the hands on the thighs or an armrest) → SEAT-OFF
 * (flexed forward over the hips, still on the seat, moving) → TRANSFER (the most flexion, the seat just left, the
 * centre of mass over the feet) → MID-RISE (half way up, over the feet) → STAND (over the feet where they were drawn
 * back to). Sitting down plays the same states back, the seat met at SEAT-OFF.
 */
function seatRoute(R, K) {
  const J = R.joints, s = heightOf(R) / CANON_HEIGHT, isch = ischOf(R), Gs = K.seat, P = RESTS[K.name], floor = floorOf(R);
  const rest = fromRest(R, K);
  rest.sit = rest.W[2] + mv(turnOf({ pitch: rest.pitch, roll: rest.roll }).M, isch)[2];
  // hands on an armrest stay on it and push off it; off a low soft seat (a couch) the others push off the seat beside the
  // hips; off a chair they go to the thighs above the knees
  const armrest = SIDES.filter((S) => P.hands?.[S] === 'armrest'), onSeat = Gs.kind === 'couch' ? SIDES.filter((S) => !armrest.includes(S)) : [];
  { const n = rigNodesAt(R, K.pose).nodes; rest.hands = { ...rest.hands, ...Object.fromEntries(armrest.map((S) => [S, n[`wrist${S}`]])) }; }
  // READY
  const { thigh, shin } = legOf(R, 'R');
  const c0 = K.contacts.sitBones, cy = Math.max(c0[1], Gs.front - 0.5 * thigh), contact = [0, cy, rest.sit];
  const W1 = sub(contact, isch);
  const back = rad(18);   // the shin inclined back from the knee: the feet drawn behind it
  const feet = Object.fromEntries(SIDES.map((S) => { const { L, toe } = legOf(R, S); const hipY = W1[1] + J[L.hip][1] - J.pelvisHub[1]; return [S, [toe[0], hipY + 0.97 * thigh - shin * Math.sin(back) + (toe[1] - J[L.hock][1]), toe[2]]]; }));
  // the trunk flexes at the hips (the hinge: the pelvis turning with it would turn the planted feet), the gaze kept ahead
  const trunk = (lean) => ({ hinge: r1(lean), spine: { sagittal: 0, lateral: 0, axial: 0 }, head: { pitch: r1(0.6 * lean) } });
  let ready = { name: 'ready', words: trunk(0), W: W1, pitch: 0, roll: 0, feet, hands: {}, sit: contact[2] };
  const thighGoal = (n, S) => add(lerp3(n[R.legs[S].hip], n[R.legs[S].knee], 0.78), [0, 0, 0.06 * s]);
  const seatGoal = (n, S) => [n[R.legs[S].hip][0] + (S === 'R' ? 1 : -1) * 0.13 * s, contact[1] + 0.03 * s, Gs.top + 0.03 * s];
  const handGoals = (n) => Object.fromEntries(SIDES.map((S) => [S, armrest.includes(S) ? rest.hands[S] : onSeat.includes(S) ? seatGoal(nodesOf(R, ready), S) : thighGoal(n, S)]));
  { const n = nodesOf(R, ready); ready = withHands(R, ready, handGoals(n)); }
  // STAND: the legs straight under the pelvis, the feet where they were drawn back to
  const stand = { name: 'stand', words: {}, W: add(J.pelvisHub, [0, feet.R[1] - J[R.legs.R.toeBase][1], 0]), pitch: 0, roll: 0, feet, hands: {} };
  // the pelvis placed (fore and aft) so the centre of mass stands over the middle of the feet
  // (`share` of the way from the heels to the middle of the feet: the transfer only just over the heels, its momentum
  // carrying it on; the rise over the middle)
  const overFeet = (at, share = 1) => {
    const goal = (n) => { const p = feetPts(R, n, s), heel = Math.min(...p.map((q) => q[1])); return lerp(heel, p.reduce((t, q) => t + q[1], 0) / p.length, share); };
    let lo = W1[1] - 0.2 * s, hi = stand.W[1] + 0.2 * s; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, n = nodesOf(R, at(m)); if (comOf(n)[1] < goal(n)) lo = m; else hi = m; } return at((lo + hi) / 2);
  };
  const bears = Object.fromEntries([...armrest, ...onSeat].map((S) => [S, true]));
  rest.bears = bears; ready.bears = bears;
  // SIT UP (from a back on its backrest): upright where the sit bones rest, before sliding forward — the trunk lifts off
  // the backrest first (and settles back onto it last)
  let sitUp = null;
  if (Math.abs(rest.pitch) > 5) {
    sitUp = { name: 'sitUp', words: trunk(0), W: sub(c0, isch), pitch: 0, roll: 0, feet: rest.feet, hands: {}, sit: rest.sit, bears };
    const n = nodesOf(R, sitUp); sitUp = { ...withHands(R, sitUp, Object.fromEntries([...armrest.map((S) => [S, rest.hands[S]]), ...onSeat.map((S) => [S, [n[R.legs[S].hip][0] + (S === 'R' ? 1 : -1) * 0.14 * s, c0[1] - 0.11 * s, Gs.top + 0.03 * s]])])), bears };
  }
  // LEAN BACK (onto a couch's backrest): the rest's recline, the hands still on the seat behind the hips, so the body is
  // let down onto the backrest on its arms (and pushed up off it), before the arms go where the rest lays them
  let leanBack = null;
  if (sitUp && onSeat.length) { leanBack = { ...withHands(R, { ...rest, name: 'leanBack' }, sitUp.hands), bears }; }
  const build = (lean) => {
    const seatOff = withHands(R, { ...ready, name: 'seatOff', words: { ...ready.words, ...trunk(lean) } }, ready.hands, {}, ready.words);
    seatOff.bears = bears;   // (the hands stay on the thighs, pushing, until the transfer is made; an armrest's until then too)
    const tz = contact[2] - isch[2] + 0.025 * s;
    let transfer = overFeet((y) => ({ name: 'transfer', words: { ...seatOff.words, ...trunk(1.12 * lean) }, W: [0, y, tz], pitch: 0, roll: 0, feet, hands: {} }), 0.35);
    { const n = nodesOf(R, transfer); transfer = { ...withHands(R, transfer, handGoals(n), {}, seatOff.words), bears }; }
    const arms = Object.fromEntries(Object.entries(transfer.words).filter(([k]) => /^(sh|elbow)[LR]$/.test(k)).map(([k, v]) => [k, typeof v === 'number' ? 0.5 * v : Object.fromEntries(Object.entries(v).map(([a, x]) => [a, 0.5 * x]))]));
    const mid = overFeet((y) => ({ name: 'midRise', words: { ...trunk(0.55 * lean), ...arms }, W: [0, y, lerp(tz, stand.W[2], 0.5)], pitch: 0, roll: 0, feet, hands: {} }));
    return [rest, ...(leanBack ? [leanBack] : []), ...(sitUp ? [sitUp] : []), ready, seatOff, transfer, mid, stand];
  };
  // the durations (s): sitting up grows with the recline, sliding forward with how far
  const scoot = 0.35 + 0.6 * Math.min(1, (cy - c0[1]) / (0.15 * s)), recline = Math.abs(rest.pitch) / 45;
  // (the arms go to the seat and back at a hand's easy pace, ~0.8 m/s)
  const armTravel = leanBack ? Math.max(...SIDES.map((S) => { const a = rigNodesAt(R, K.pose).nodes, b = nodesOf(R, leanBack); return dist(a[`wrist${S}`], b[`wrist${S}`]); })) : 0;
  const swing = Math.max(0.4, armTravel / 0.8);
  const up = [...(leanBack ? [swing] : []), ...(sitUp ? [0.35 + 0.5 * recline, scoot] : [scoot + 0.1]), 0.5, 0.35, 0.4, 0.5];
  const down = [...(leanBack ? [swing + 0.1] : []), ...(sitUp ? [0.5 + 0.6 * recline, scoot + 0.1] : [scoot + 0.25]), 0.35, 0.4, 0.6, 0.65];
  const so = 2 + (sitUp ? 1 : 0) + (leanBack ? 1 : 0);
  // THE FLEXION AT SEAT-OFF, solved: the least for which the body's momentum carries its centre of mass over the feet —
  // the extrapolated centre of mass (Hof 2005: x + v / ω₀, ω₀ = √(g / l)) inside the feet's hull as the seat is left,
  // its speed read off the clip itself
  const xcomAt = (lean) => {
    let t = 0; const timed = build(lean).map((x, i) => { if (i) t += up[i - 1]; return { ...x, t }; });
    const play = player(R, timed), ts = timed[so].t, h = 1 / 60, [a, n, b] = [ts - h, ts, ts + h].map((x) => rigNodesAt(R, play(x).pose).nodes);
    return margin(hull(feetPts(R, n, s)), xcomOf(com3(n), sub(com3(b), com3(a)).map((v) => v / (2 * h)), floor));
  };
  // (scanned up from a little flexion to the first that carries it, then bisected; no further than the hips flex — 140°
  // of the trunk's line off the thigh — the pushing hands bearing what is short of it)
  const hipsAt = (lean) => { const n = nodesOf(R, build(lean)[so]); return Math.max(...SIDES.map((S) => angle(sub(n.pelvisHub, n.neckHub), sub(n[R.legs[S].knee], n[R.legs[S].hip])))); };
  let lo = 5, hi = null, best = { lean: 5, m: -Infinity };
  for (let l = 5; l <= 75 && hipsAt(l) <= 140; l += 7.5) { const m = xcomAt(l); if (m >= 0) { hi = l; break; } lo = l; if (m > best.m) best = { lean: l, m }; }
  if (hi === null) hi = best.lean; else for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (xcomAt(m) < 0) lo = m; else hi = m; }
  const lean = r1(hi);
  return { kind: 'seat', lean, states: build(lean), up, down, seatOff: so, props: K.props };
}

/** a state let down (or lifted) until the lowest of the knees named rests its flesh on the floor */
function kneesDown(R, st, sides, floor, s) {
  const gap = (z) => { const n = nodesOf(R, { ...st, W: [st.W[0], st.W[1], z] }); return Math.min(...sides.map((S) => n[R.legs[S].knee][2] - fleshAt(R.legs[S].knee, R, s) - floor)); };
  let lo = floor, hi = R.joints.pelvisHub[2] + 0.1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gap(m) > 0) hi = m; else lo = m; }
  return { ...st, W: [st.W[0], st.W[1], hi] };
}
const TUCK = -78;   // a kneeling foot's heel word: the toes tucked under, the sole near upright (the rig turns it about the ball)

/**
 * UP FROM THE KNEES (the end of every floor route): HALF KNEEL (the right foot planted ahead — at `front` if given — the
 * left knee down on tucked toes, the right hand on its knee) → KNEE LIFT (the back knee off the floor, its toes still
 * down) → PUSH (up and forward over the front foot, the hand pushing down the thigh) → STAND (the back foot, unloaded
 * once the centre of mass is over the front foot, stepped up beside it).
 */
function kneelUp(R, { front = null, behindY = null } = {}) {
  const J = R.joints, s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R), { thigh, shin } = legOf(R, 'R');
  const toeOf = (S) => J[R.legs[S].toeBase];
  // the half kneel: the pelvis over the back knee, the front shin upright under its knee
  const Wy = behindY ?? 0;
  const fr = front ?? [toeOf('R')[0], Wy + J[R.legs.R.hip][1] + 0.92 * thigh + (toeOf('R')[1] - J[R.legs.R.hock][1]), toeOf('R')[2]];
  const back = [toeOf('L')[0], Wy - 0.97 * shin, toeOf('L')[2]];
  // (its leg words near what the planted legs solve to, so a leg leaving or meeting the floor swings from them)
  // (a front foot already planted keeps its place: the pelvis comes forward over it as far as `behindY`, a deep kneel)
  let half = { name: 'halfKneel', words: { hinge: 12, head: { pitch: 8 }, heelL: TUCK, hipR: { pitch: 55, yaw: 0, roll: 0 }, kneeR: 90, hipL: { pitch: -5, yaw: 0, roll: 0 }, kneeL: 95 }, W: [0, front && behindY === null ? fr[1] - J[R.legs.R.hip][1] - 0.92 * thigh - (toeOf('R')[1] - J[R.legs.R.hock][1]) : Wy, J.pelvisHub[2]], pitch: 0, roll: 0, feet: { R: fr, L: back }, hands: {} };
  half = { ...half, feet: { R: fr, L: [toeOf('L')[0], half.W[1] - 0.97 * shin, toeOf('L')[2]] } };
  half = kneesDown(R, half, ['L'], floor, s);
  { const n = nodesOf(R, half); half = withHands(R, half, { R: add(n[R.legs.R.knee], [0, -0.02 * s, 0.05 * s]) }); }
  // the push: half way up, over the front foot (its ball and heel), the back knee lifted, the hand down the thigh
  const stand = { name: 'stand', words: {}, W: add(J.pelvisHub, [half.feet.R[0] - toeOf('R')[0], half.feet.R[1] - toeOf('R')[1], 0]), pitch: 0, roll: 0, feet: { R: half.feet.R, L: add(toeOf('L'), [0, half.feet.R[1] - toeOf('R')[1], 0]) }, hands: {} };
  // (over the front foot both ways: fore and aft between its ball and heel, and across, the pelvis carried over it as the
  // back foot is about to lift)
  const pushAt = (x, y) => ({ name: 'push', words: { hinge: 32, head: { pitch: 20 }, heelL: TUCK }, W: [x, y, lerp(half.W[2], stand.W[2], 0.55)], pitch: 0, roll: 0, feet: half.feet, hands: {} });
  const L = R.legs.R; let px = 0, py = half.W[1];
  for (let it = 0; it < 3; it++) {
    let lo = half.W[1], hi = half.feet.R[1]; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, n = nodesOf(R, pushAt(px, m)); if (comOf(n)[1] < (n[L.toeBase][1] + n[L.hock][1]) / 2) lo = m; else hi = m; }
    py = (lo + hi) / 2; const n = nodesOf(R, pushAt(px, py)); px += (n[L.toeBase][0] + n[L.hock][0]) / 2 - comOf(n)[0];
  }
  let push = pushAt(px, py);
  { const n = nodesOf(R, push); push = withHands(R, push, { R: add(lerp3(n[R.legs.R.hip], n[R.legs.R.knee], 0.75), [0, 0, 0.06 * s]) }, {}, half.words); }
  // (the back foot, unloaded over the front one, comes off the floor and swings through to the stand)
  push = { ...push, feet: { R: half.feet.R }, words: { ...push.words, heelL: 0, hipL: { pitch: -5, yaw: 0, roll: 0 }, kneeL: 70 } };
  // between the kneel and the push: the back knee lifted off the floor, its toes still tucked on it (a support while the
  // weight comes forward onto the front foot; going down, the toes are set back before the knee is lowered)
  // (placed, fore and aft and across, so the centre of mass stands over the middle of the front foot and the back toes)
  const liftAt = (x, y) => ({ ...half, name: 'kneeLift', words: { ...half.words, hinge: 22, head: { pitch: 14 } }, W: [x, y, lerp(half.W[2], push.W[2], 0.35)] });
  let lx = 0, ly = lerp(half.W[1], push.W[1], 0.35);
  for (let it = 0; it < 4; it++) { const n = nodesOf(R, liftAt(lx, ly)), c = comOf(n), mid = [(n[L.toeBase][0] + n[L.hock][0] + n[R.legs.L.toeBase][0] + n[R.legs.L.toeTip][0]) / 4, (n[L.toeBase][1] + n[L.hock][1] + n[R.legs.L.toeBase][1] + n[R.legs.L.toeTip][1]) / 4]; lx += mid[0] - c[0]; ly += mid[1] - c[1]; }
  let lift = liftAt(lx, ly);
  { const n = nodesOf(R, lift); lift = withHands(R, lift, { R: add(lerp3(n[R.legs.R.hip], n[R.legs.R.knee], 0.85), [0, 0, 0.06 * s]) }, {}, half.words); }
  return [half, lift, push, stand];
}

/** hands down flat on the floor: each wrist's goal and the bearing it gives */
function floorHands(R, st, goals, seed = null) {
  const s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R);
  let g = goals, x, pose;
  // (the wrist raised by whatever of the flattened hand would still press into the floor, once)
  for (let it = 0; it < 2; it++) {
    x = withHands(R, st, g, {}, seed); pose = placed(R, x);
    for (const S of Object.keys(g)) pose = { ...pose, ...flatHand(R, pose, S, floor, s) };
    const n = rigNodesAt(R, pose).nodes, low = Object.fromEntries(Object.keys(g).map((S) => [S, Math.min(n[`knuckles${S}`][2] - fleshAt(`knuckles${S}`, R, s), n[`wrist${S}`][2] - fleshAt(`wrist${S}`, R, s)) - floor]));
    if (Object.values(low).every((d) => d >= -0.003)) break;
    g = Object.fromEntries(Object.entries(g).map(([S, p]) => [S, add(p, [0, 0, Math.max(0, -low[S])])]));
  }
  return { ...x, words: wordsOf(pose), bears: { ...(x.bears || {}), ...Object.fromEntries(Object.keys(g).map((S) => [S, true])) } };
}
/**
 * FROM THE FLOOR: a knee already up (kneeUp) leans over it, the hand behind still down, the folded leg comes under onto
 * its knee, and up over the planted foot; cross-legged (and the lotus) first uncross into a knees-up sit.
 */
function floorRoute(R, K) {
  const s = heightOf(R) / CANON_HEIGHT, isch = ischOf(R), P = RESTS[K.name];
  const rest = fromRest(R, K); rest.sit = rest.W[2] + mv(turnOf({ pitch: rest.pitch, roll: rest.roll }).M, isch)[2];
  const n0 = rigNodesAt(R, K.pose).nodes;
  if (P.feet.R.at === 'up') {
    // lean over the raised knee, the right hand on it; the sit bones down
    let lean = { ...rest, name: 'leanOver', words: { ...rest.words, hinge: 5, head: { pitch: 8 } }, pitch: 0, W: sub(K.contacts.sitBones, isch) };
    lean.sit = lean.W[2] + isch[2];
    const n = nodesOf(R, lean);
    // (the left hand stays where it rests on the floor behind, bearing, while the folded leg comes under)
    lean = withHands(R, lean, { R: add(n[R.legs.R.knee], [0, -0.03 * s, 0.05 * s]) });
    lean = floorHands(R, lean, { L: rest.hands.L }, rest.words);
    rest.bears = { L: true };
    const chain = kneelUp(R, { front: n0[R.legs.R.toeBase], behindY: lean.W[1] + 0.1 * s });
    return { kind: 'floor', states: [rest, lean, ...chain], up: [0.6, 0.75, 0.45, 0.6, 0.75], down: [0.75, 0.75, 0.5, 0.55, 0.8], props: K.props };
  }
  // cross-legged: the legs uncrossed first, both feet set flat before the seat, the hands on the floor behind; then up as
  // from a knee up — lean over the right knee, the left leg comes under onto its knee, up over the right foot
  const [knees, ...rise] = fromKneesUp(R, { ...rest, words: { ...rest.words } }, sub(K.contacts.sitBones, isch));
  return { kind: 'floor', states: [rest, knees, ...rise], up: [0.8, 0.5, 0.85, 0.45, 0.6, 0.75], down: [1.0, 0.6, 0.74, 0.5, 0.55, 0.8], props: K.props };
}

/** sitting on the floor with both knees up (the feet flat before the seat, the hands on the floor behind the hips), and
 * the way up from it: lean over the right knee, the left leg under onto its knee, the half kneel and the push */
function fromKneesUp(R, base, W) {
  const J = R.joints, s = heightOf(R) / CANON_HEIGHT, isch = ischOf(R), floor = floorOf(R);
  let knees = { ...base, name: 'kneesUp', pitch: 0, roll: 0, lie: undefined, W, words: { ...base.words, hinge: 0, spine: { sagittal: 0.1, lateral: 0, axial: 0 }, head: { pitch: 0 }, splayR: 6, splayL: 6 } };
  knees.sit = knees.W[2] + isch[2];
  { const n = nodesOf(R, knees); knees.feet = Object.fromEntries(SIDES.map((S) => [S, [(S === 'R' ? 1 : -1) * 0.11 * s + W[0], n[R.legs[S].hip][1] + 0.3 * s, J[R.legs[S].toeBase][2]]])); }
  { const n = nodesOf(R, knees); knees = floorHands(R, knees, Object.fromEntries(SIDES.map((S) => [S, [n[`hip${S}`][0] + (S === 'R' ? 0.1 : -0.1) * s, n[`hip${S}`][1] - 0.12 * s, floor + 0.035 * s]]))); }
  // (its leg's swing onto the knee takes three quarters of the roll: the uncrossed leg has further to go)
  let lean = { ...knees, name: 'leanOver', window: 0.75, words: { ...knees.words, hinge: 5, head: { pitch: 8 } } };
  { const n = nodesOf(R, lean); lean = withHands(R, lean, { R: add(n[R.legs.R.knee], [0, -0.03 * s, 0.05 * s]) }); lean = floorHands(R, lean, { L: knees.hands.L }, knees.words); }
  return [knees, lean, ...kneelUp(R, { front: knees.feet.R, behindY: lean.W[1] + 0.1 * s })];
}

/**
 * FROM LYING: sitting up — off the back (the trunk raised about the hips) or off the side (turned up about the body's
 * long axis), the hands pushing — into the knees-up sit, then up from it as from the floor. A body knocked out gets up
 * the same way, slower (groggy).
 */
function lyingRoute(R, K) {
  const s = heightOf(R) / CANON_HEIGHT, isch = ischOf(R), floor = floorOf(R), P = RESTS[K.name];
  const rest = { ...fromRest(R, K), lie: true, hands: {} };
  const n0 = rigNodesAt(R, K.pose).nodes;
  // (sat up where the hips lie)
  const W = sub([n0.pelvisHub[0], n0.pelvisHub[1], floor], isch);
  // (its legs' words near what the knees-up sit solves them to, so the legs fold up into it rather than straighten)
  const base = { ...rest, lie: undefined, words: { ...Object.fromEntries(Object.entries(rest.words).filter(([k]) => !/^(hip|knee|seat|wrist|fingers|sh|elbow)/.test(k))), hipR: { pitch: 55, yaw: 0, roll: 0 }, hipL: { pitch: 55, yaw: 0, roll: 0 }, seat: 50, kneeR: 140, kneeL: 140 } };
  const [knees, ...rise] = fromKneesUp(R, base, W);
  // half way up: the trunk raised half of the way, propped on the hands, the knees drawn up
  const half = (v) => v / 2;
  let prop = { ...knees, name: 'propUp', lie: true, sit: undefined, pitch: half(rest.pitch), roll: half(rest.roll), W: lerp3(rest.W, knees.W, 0.5), feet: {}, hands: {}, words: { ...knees.words, hipR: { pitch: 50, yaw: 0, roll: 0 }, kneeR: 110, hipL: { pitch: 50, yaw: 0, roll: 0 }, kneeL: 110, seat: 20 } };
  // (propped on both hands, flat on the floor out beside the hips: pushing the trunk up)
  { const n = nodesOf(R, prop); const out = sub(n.hipR, n.hipL); out[2] = 0; const u = unit(out); prop = floorHands(R, prop, Object.fromEntries(SIDES.map((S) => { const h = lerp3(n[`hip${S}`], n[`shoulder${S}`], 0.3), sg = S === 'R' ? 1 : -1; return [S, [h[0] + sg * u[0] * 0.18 * s, h[1] + sg * u[1] * 0.18 * s, floor + 0.035 * s]]; }))); prop = { ...prop, hands: {}, lie: true }; }
  const slow = P.limp ? 1.5 : 1;   // (knocked out: groggy)
  // (the arms brought from where they lie to the floor behind at a hand's easy pace, ~0.6 m/s along the way they go)
  const nk = nodesOf(R, knees), travel = Math.max(...SIDES.map((S) => dist(n0[`wrist${S}`], nk[`wrist${S}`])));
  const first = Math.max(0.8 * slow, travel / 0.6);
  return { kind: 'lying', states: [rest, prop, knees, ...rise], up: [first, 0.8 * slow, 0.5, 0.85, 0.45, 0.6, 0.75], down: [first, 0.9, 0.6, 0.74, 0.5, 0.55, 0.8], props: K.props };
}

/**
 * KNOCKED DOWN (the way down into a knocked-out rest): the knees buckle, then the body falls about its feet as a rigid
 * rod under gravity — θ'' = 3g / 2L · sin θ, L the figure's height, from the buckle's lean — so the fall's timing is
 * the body's own; it lands flat (on its back, or on its side and a little forward), and the limbs settle into the rest.
 * Each moment of the fall is a state, at the time the rod reaches its angle.
 */
function collapseRoute(R, K) {
  const J = R.joints, H = heightOf(R), s = H / CANON_HEIGHT, P = RESTS[K.name], floor = floorOf(R);
  const rest = { ...fromRest(R, K), lie: true, hands: {} };
  const turn = P.turn, onSide = !!turn.roll;
  const n0 = rigNodesAt(R, K.pose).nodes;
  // standing where the fall lays the body on its rest: the feet where the rest's feet lie, the body upright over them
  const feetAt = lerp3(n0[R.legs.R.toeBase], n0[R.legs.L.toeBase], 0.5);
  const stand = { name: 'stand', words: {}, W: add(J.pelvisHub, [feetAt[0], feetAt[1] - J[R.legs.R.toeBase][1], 0]), pitch: 0, roll: 0, feet: {}, hands: {} };
  const pivot = [stand.W[0], stand.W[1], floor];
  // the buckle: knees giving, the head lolling, the arms starting to float
  const limp = { hinge: 6, head: { pitch: -15 }, hipR: { pitch: 12, yaw: 0, roll: 0 }, hipL: { pitch: 12, yaw: 0, roll: 0 }, kneeR: 28, kneeL: 28 };
  const buckle = { name: 'buckle', words: limp, W: add(stand.W, [0, 0, -0.06 * s]), pitch: 0, roll: 0, feet: {}, hands: {}, lie: true, fall: true };
  // the rod's fall, integrated from the buckle's tilt (a few degrees) to flat
  const k = (3 * G) / (2 * H), th0 = rad(5), dt = 1 / 2000; let th = th0, w = 0, t = 0; const at = [];
  const marks = [15, 30, 45, 60, 75, 90].map(rad);
  for (let m = 0; m < marks.length && t < 3;) { w += k * Math.sin(th) * dt; th += w * dt; t += dt; if (th >= marks[m]) { at.push({ th: marks[m], t }); m++; } }
  // the turn the fall goes through: back (pitch to −90) or onto the right side and a little forward (roll to 90, pitch)
  const turnAt = (f) => (onSide ? { pitch: (turn.pitch ?? 0) * f, roll: 90 * f } : { pitch: -90 * f, roll: 0 });
  const impactWords = { ...Object.fromEntries(Object.entries(rest.words).filter(([q]) => !/^(hip|knee|seat|head)/.test(q))), ...limp, head: { pitch: onSide ? -10 : 0 } };
  const fallState = (f, name) => {
    // (the arms fly out early in the fall, while it is still slow, and are where they land by the time it is fast)
    const tr = turnAt(f), T = turnOf(tr), Wt = add(pivot, mv(T.M, sub(buckle.W, pivot))), fa = Math.min(1, Math.sqrt(f) * 1.15);
    const words = Object.fromEntries(Object.keys({ ...limp, ...impactWords }).map((q) => [q, q in impactWords && q in limp && typeof limp[q] === 'number' ? lerp(limp[q], impactWords[q], f) : f < 0.5 ? (limp[q] ?? impactWords[q]) : (impactWords[q] ?? limp[q])]));
    return { name, words: { ...words, ...Object.fromEntries(Object.entries(impactWords).filter(([q]) => /^(sh|elbow|fingers|wrist)/.test(q)).map(([q, v]) => [q, typeof v === 'number' ? v * fa : Object.fromEntries(Object.entries(v).map(([a2, x]) => [a2, x * fa]))])) }, W: Wt, pitch: tr.pitch, roll: tr.roll, feet: {}, hands: {}, lie: true, fall: true };
  };
  const falls = at.map((a, i) => fallState(a.th / rad(90), i === at.length - 1 ? 'impact' : `fall${Math.round((a.th * 180) / Math.PI)}`));
  // durations (played order: stand → buckle → the fall → impact → settle into the rest)
  const tBuckle = 0.22, settle = 0.45;
  const played = [stand, buckle, ...falls, rest], durs = [tBuckle, at[0].t, ...at.slice(1).map((a, i) => a.t - at[i].t), settle];
  return { kind: 'collapse', states: [...played].reverse(), down: [...durs].reverse(), up: null, props: K.props, fall: { seconds: r3(at[at.length - 1].t), from: r1((th0 * 180) / Math.PI) } };
}

// ─── the clip ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** the routes, by the rest pose's family and seat */
function routeOf(R, K) {
  if (K.family === 'seated' && K.seat?.kind !== 'floor') return seatRoute(R, K);
  if (K.family === 'seated') return floorRoute(R, K);
  return lyingRoute(R, K);
}
const FPS = 30;
/** two keys' poses blended (a channel one lacks is the nearer one's) */
function blendPose(A, B, x) {
  const fa = flatten(A), fb = flatten(B), near = x < 0.5 ? fa : fb, out = {};
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) out[k] = k in fa && k in fb ? lerp(fa[k], fb[k], x) : near[k];
  const o = { ...(x < 0.5 ? A : B), ...unflatten(out) };
  for (const k of ['support']) o[k] = (x < 0.5 ? A : B)[k];
  // arrays: the feet's targets, the body's pivot
  const feet = {}; for (const S of SIDES) { const a = A.feet?.[S], b = B.feet?.[S]; if (a && b) feet[S] = lerp3(a, b, x); else if ((x < 0.5 ? a : b)) feet[S] = x < 0.5 ? a : b; }
  if (Object.keys(feet).length) o.feet = feet; else delete o.feet;
  if (A.body && B.body) o.body = { ...o.body, at: lerp3(A.body.at, B.body.at, x) }; else if ((x < 0.5 ? A : B).body) o.body = (x < 0.5 ? A : B).body; else delete o.body;
  return o;
}

/**
 * Getting up out of a rest pose, or (`down`) sitting or lying down into it (a knocked-out rest: collapsing into it).
 * → { name, rest, down, seconds, keys (the frames' poses at 30 per second), fn(t) (t 0 … 1), beats ({ seatOff | seatOn,
 * impact, states: [{ name, t }] }, s), props (the rest's seat or crater), lean (a seat's flexion at seat-off, degrees),
 * checks }. `seconds` stretches or shrinks the whole clip.
 */
export function heroRise(rest, R, { down = false, seconds } = {}) {
  if (!RESTS[rest]) throw new Error(`hero-rise: no rest pose '${rest}' (have ${REST_NAMES.join(', ')})`);
  // (a body knocked out goes down by falling, not by lying down)
  const K = heroRest(rest, R), route = down && RESTS[rest].limp ? collapseRoute(R, K) : routeOf(R, K);
  const order = down ? [...route.states].reverse() : route.states, durs = down ? [...route.down].reverse() : route.up;
  let t = 0; const states = order.map((st, i) => { if (i) t += durs[i - 1]; return { ...st, t }; });
  const T0 = t, T = seconds ?? T0, k = T / T0; for (const st of states) st.t *= k;
  const play = player(R, states, { backward: down });
  const N = Math.max(2, Math.ceil(T * FPS));
  const frames = Array.from({ length: N + 1 }, (_, i) => play((i / N) * T));
  // the ends are the rest pose and the stand themselves
  const ends = [K.pose, placed(R, route.states[route.states.length - 1])];
  frames[0] = { ...frames[0], pose: down ? ends[1] : ends[0] }; frames[N] = { ...frames[N], pose: down ? ends[0] : ends[1] };
  const keys = frames.map((f) => f.pose);
  const fn = (u) => { const x = clamp(u, 0, 1) * N, i = Math.min(N - 1, Math.floor(x)); return blendPose(keys[i], keys[i + 1], x - i); };
  const so = route.seatOff !== undefined ? states[down ? states.length - 1 - route.seatOff : route.seatOff].t : null;
  const impact = states.find((st) => st.name === 'impact');
  const beats = { ...(so !== null ? { [down ? 'seatOn' : 'seatOff']: r3(so) } : {}), ...(impact ? { impact: r3(impact.t) } : {}), states: states.map((st) => ({ name: st.name, t: r3(st.t) })) };
  return { name: `${rest}${down ? 'Down' : 'Up'}`, rest, down, seconds: r3(T), keys, fn, beats, props: route.props ?? [], lean: route.lean ?? null, checks: riseChecks(R, K, frames, T, { down, ends }) };
}

/**
 * The machine gate on a rise (or a sit): ends (m: the first and last frames off the rest pose and the stand), floor (m:
 * the lowest flesh off the floor over every frame, + clear), seat (m: the sit bones most below the seat while over it),
 * plant (m: the most a foot planted through a segment moves), balance (m: the least margin of the extrapolated centre of
 * mass — Hof's x + v / ω₀ — inside what bears the body, over every frame that is not lying, falling or leaning on a
 * backrest) and outside (s: the longest it stays out by more than a centimetre: the law holds it to a step's time),
 * knees and hips (the most flexion, degrees: a hip's is the trunk's line off the thigh — the hip's flexion and the lower
 * back's rounding together, no further than the thigh folded against the belly, ~165°), speed (m/s: the fastest joint,
 * under 4 — a brisk limb — out of a fall) and fallSpeed (in a fall: under half again the falling rod's own tip speed
 * at impact, √(3gH), the flung hands outrunning it), laws.
 */
/** the longest the extrapolated centre of mass may stay outside what bears the body: as long as a step takes to catch it
 * (a walk's swing, ~0.3 s), so a quick shift onto a new contact (a knee, a foot) is a step, not a fall */
const STEP_TIME = 0.3;
function riseChecks(R, K, frames, T, { down, ends }) {
  const s = heightOf(R) / CANON_HEIGHT, floor = floorOf(R), isch = ischOf(R), dt = T / (frames.length - 1);
  const nodes = frames.map((f) => rigNodesAt(R, f.pose).nodes);
  const endOff = (n, pose) => { const m = rigNodesAt(R, pose).nodes; return Math.max(...BODY_JOINTS.map((k) => dist(n[k], m[k]))); };
  const endsOff = [endOff(nodes[0], down ? ends[1] : ends[0]), endOff(nodes[nodes.length - 1], down ? ends[0] : ends[1])];
  let fallSpeed = 0, run = 0, longest = 0, longestAt = null, low = Infinity, lowAt = null, bal = Infinity, balAt = null, speed = 0, speedAt = null, plant = 0, seatLow = Infinity, knee = 0, hip = 0;
  const seatZ = K.seat && K.seat.kind !== 'floor' ? K.seat.z : null;
  nodes.forEach((n, i) => {
    const f = frames[i];
    for (const k of BODY_JOINTS) { if (k === 'pelvisHub' && (f.sit || K.family === 'seated')) continue; if (seatZ !== null && /^(pelvisHub|hip[LR])$/.test(k)) continue; const d = n[k][2] - fleshAt(k, R, s) - floor; if (d < low) { low = d; lowAt = `${k}@${i}`; } }
    if (seatZ !== null) { const c = add(n.pelvisHub, n.$body ? mv(n.$body.M, isch) : isch); if (c[1] > K.seat.yb && c[1] < K.seat.front) seatLow = Math.min(seatLow, c[2] - seatZ); }
    // (a back on the backrest is held by it: no balance to keep)
    const onBack = K.seat?.back && dot(sub(sub(lerp3(n.neckHub, n.navel, 0.35), mul(frontOf(n), 0.105 * s)), K.seat.back.at), K.seat.back.n) < 0.03 * s;
    if (!f.lie && !f.fall && !onBack && i > 0 && i < nodes.length - 1) { const pts = supportOf(R, n, f, s, floor, isch, K.seat ?? null), v = sub(com3(nodes[i + 1]), com3(nodes[i - 1])).map((x) => x / (2 * dt)); const m = pts.length < 3 ? -Infinity : margin(hull(pts), xcomOf(com3(n), v, floor)); if (m < bal) { bal = m; balAt = i; } if (m < -0.01) { run += dt; if (run > longest) { longest = run; longestAt = i; } } else run = 0; } else run = 0;
    if (i) { for (const k of BODY_JOINTS) { const v = dist(n[k], nodes[i - 1][k]) / dt; if (f.fall && frames[i - 1].fall) { if (v > fallSpeed) fallSpeed = v; continue; } if (v > speed) { speed = v; speedAt = `${k}@${i}`; } } for (const S of SIDES) if (f.held[S] && frames[i - 1].held[S] && f.seg === frames[i - 1].seg) { const L = R.legs[S]; plant = Math.max(plant, dist(n[L.toeBase], nodes[i - 1][L.toeBase])); } }
    for (const S of SIDES) { const L = R.legs[S]; knee = Math.max(knee, 180 - angle(sub(n[L.hip], n[L.knee]), sub(n[L.hock], n[L.knee]))); hip = Math.max(hip, angle(sub(n.pelvisHub, n.neckHub), sub(n[L.knee], n[L.hip]))); }
  });
  const laws = { ends: Math.max(...endsOff) < 0.002, floor: low > -0.015, ...(seatZ !== null ? { seat: seatLow > -0.015 } : {}), plant: plant < 0.003, balance: longest <= STEP_TIME, knees: knee <= 162, hips: hip <= 165, speed: speed < 4, ...(fallSpeed ? { fallSpeed: fallSpeed < 1.5 * Math.sqrt(3 * G * heightOf(R)) } : {}) };
  return { ends: endsOff.map(r4), floor: r4(low), floorAt: lowAt, ...(seatZ !== null ? { seat: r4(seatLow) } : {}), plant: r4(plant), balance: r4(bal), balanceAt: balAt, outside: r3(longest), outsideAt: longestAt, knees: r1(knee), hips: r1(hip), speed: r3(speed), speedAt, ...(fallSpeed ? { fallSpeed: r3(fallSpeed) } : {}), laws };
}
