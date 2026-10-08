/**
 * hero-strike — SCOPED ACTIONS, the first family: STRAIGHT STRIKES out of a ready stance (hero-stance.js), solved from
 * principles, never keyed angle by angle. A strike is design words (STRIKES); the solver makes its timeline:
 *
 *   READY → LOAD → DRIVE → CONTACT → FOLLOW → READY
 *
 *   • PURPOSE. The striking hand's CONTACT point is on the target line at its shoulder's height (`up` off it), as far as
 *     the arm reaches `reach` of its length from where the shoulder stands at contact; the hand travels a STRAIGHT line
 *     to it from where the load left it, and carries on past it (`follow`) before it comes home.
 *   • THE CHAIN. A body-led strike (`order: 'body'`: a punch) drives proximal to distal: the weight moves first, then
 *     the hips turn, then the chest, then the arm, each starting later, peaking later and BRAKING as the next one takes
 *     over, the hand alone accelerating into contact (fastest there, not stopping on it). A hand-led strike (`order: 'hand'`: a fencer's
 *     thrust) extends the arm first, the point leading, and the body and the lunge follow.
 *   • WEIGHT TRANSFER. The body's weight moves toward the lead foot (`weight`, the share of the way from the rear foot's
 *     centre to the lead's: the core carried over the planted feet by the rig's `shift`); a LUNGE steps the lead foot
 *     out `lunge` leg lengths on a bent leg and lands at contact, the rear leg straightening behind.
 *   • THE REAR FOOT turns with the hips: a rear-hand strike pivots it on its ball (`pivot` degrees, its heel up `heel`).
 *   • THE OTHER HAND guards (rides the chest at its stance's angles) or COUNTERS (a fencer's rear arm thrown back and
 *     down against the thrust: a swing of its joints, an arc, from the guard's angles to the counter's).
 *   • EYES ON THE TARGET throughout: the neck and head turn back by the body's facing at every frame.
 *   • THE LOAD: a small anticipation the other way first — the hips and chest coil away, the weight settles back, the
 *     hand draws back `pull` along its line.
 *
 * Each strike leads with the right foot (its stance's frame); `<name>Left` is its exact mirror. A strike gives its clip
 * (a one-shot that starts and ends on the stance's held pose), its contact (time, point) and its CHECKS (the machine
 * gate): the hand on its contact point, the path's straightness (a hand-led path: two straight runs), the chain's order (when each link moves fastest), the
 * balance while both feet are down, the planted feet holding still, the elbow's extension at contact.
 * Pure and deterministic.
 */
import { rigNodesAt } from './station-loft-rig.js';
import { keyedClip, mirrored } from './hero-jump.js';
import { elbowsDown } from './hero-elbow.js';
import { stanceState, reachArm, handGoal, comOf } from './hero-stance.js';

const GLANCE = 75, NECK_TURN = 35, HEAD_TURN = 45, TWIST_CAP = 35;
const STEP = 1 / 40;       // the timeline's sampling (a share of the clip)

/**
 * The strikes, every one from a right-led stance. `hand` the striking hand (R the lead's, L the rear's).
 *   reach   share of the arm's length out at contact     up      metres the contact sits off the shoulder's height
 *   turn    degrees the body's facing turns by contact (+ to its left: a right lead's shoulder forward)
 *   chest   degrees the chest turns on with it (the spine's twist)       weight  the share on the lead foot at contact
 *   pivot   degrees the rear toe turns in on its ball   heel    degrees the rear heel rises    lunge  leg lengths stepped
 *   follow  metres past contact along the line          pull    metres the hand draws back in the load
 *   load    { turn, chest, weight }: the anticipation (the other way)
 *   counter the other hand's place at contact (a hand spec: hero-stance `hands`), else it guards
 *   timing  { load, contact, follow } shares of the clip   order  'body' | 'hand'   serves  the actions it is
 */
export const STRIKES = Object.freeze({
  jab: {
    from: 'guard', hand: 'R', order: 'body', seconds: 0.42, reach: 0.985, up: -0.02, turn: 9, chest: 6, weight: 0.56,
    pivot: 0, heel: 0, follow: 0.02, pull: 0.03, load: { turn: -3, chest: -2, weight: -0.04 },
    timing: { load: 0.18, contact: 0.44, follow: 0.54 }, serves: ['jab', 'lead straight', 'knife thrust'],
  },
  cross: {
    from: 'guard', hand: 'L', order: 'body', seconds: 0.55, reach: 0.97, up: -0.02, turn: -44, chest: -12, weight: 0.66,
    pivot: 40, heel: 38, follow: 0.03, pull: 0.03, load: { turn: 5, chest: 3, weight: -0.05 },
    timing: { load: 0.2, contact: 0.46, follow: 0.56 }, serves: ['cross', 'rear straight', 'palm strike'],
  },
  thrust: {
    from: 'fencing', hand: 'R', order: 'hand', seconds: 0.9, reach: 0.99, up: -0.05, turn: 4, chest: 0, weight: 0.6,
    pivot: 0, heel: 0, lunge: 0.42, follow: 0.03, pull: 0.02, load: { turn: 0, chest: 0, weight: -0.03 },
    counter: { at: 'rearShoulder', fwd: -0.34, up: -0.3, side: -0.1 },
    timing: { load: 0.1, contact: 0.5, follow: 0.58 }, serves: ['thrust', 'lunge', 'spear thrust', 'rapier attack'],
  },
});
export const STRIKE_NAMES = Object.freeze(Object.keys(STRIKES).flatMap((n) => [n, `${n}Left`]));

const r4 = (x) => +x.toFixed(4), r1 = (x) => +x.toFixed(1);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ss = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const into = (x) => { const t = clamp(x, 0, 1); return 1.5 * t * t - 0.5 * t * t * t; };   // slow out of the load, fast into contact
const out = (x) => { const t = clamp(x, 0, 1); return 1 - (1 - t) * (1 - t); };            // carried on past contact, slowing
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Solve a strike on a rig: { name, from, hand, seconds, clip, keys, contact: { t (seconds), at (the contact point,
 * rig frame) }, checks, serves }.
 * @param {string} name  a STRIKE_NAMES name (`<name>Left` the mirror)
 * @param {object} R     a validated rig
 */
export function heroStrike(name, R, { seconds } = {}) {
  const left = /Left$/.test(name); const base = left ? name.slice(0, -4) : name; const K = STRIKES[base];
  if (!K) throw new Error(`hero-strike: no strike '${name}' (have ${STRIKE_NAMES.join(', ')})`);
  const T = seconds ?? K.seconds;
  const solved = solveStrike(K, R);
  const keys = left ? mirrored(solved.keys) : solved.keys;
  const clip = keyedClip({ seconds: T, keys }, R);
  const at = left ? [-solved.contact[0], solved.contact[1], solved.contact[2]] : solved.contact;
  const hand = left ? (K.hand === 'R' ? 'L' : 'R') : K.hand;
  const contact = { t: r4(K.timing.contact * T), at: at.map(r4) };
  return { name, from: left ? `${K.from}Left` : K.from, hand, seconds: T, clip, keys, contact, serves: [...K.serves],
    checks: strikeChecks(R, clip, { hand, contact: K.timing.contact, at, path: [solved.chamber, ...(solved.ext ? [solved.ext] : []), solved.contact].map((p) => (left ? [-p[0], p[1], p[2]] : p)), drive: solved.drive, order: K.order, lead: left ? 'L' : 'R', lunge: !!K.lunge }) };
}

function solveStrike(K, R) {
  const st = stanceState(K.from, R); const { S, ball, legLen } = st; const rest = R.joints, legs = R.legs;
  const tm = K.timing, other = K.hand === 'R' ? 'L' : 'R';
  // the chain's lags: each link starts LAG after the one before it (the body's from the feet up, or the hand first)
  // THE CHAIN: each link's window within the drive (shares of load → contact) and its ease. Body-led, every link but the
  // hand turns and BRAKES within its window (fastest at its middle), handing on to the next, which starts later and runs
  // later; the hand alone accelerates into contact. Hand-led, the arm extends first and the body and the lunge follow.
  const links = K.order === 'hand'
    ? { arm: { w: [0, 0.55], ease: ss }, weight: { w: [0.3, 1], ease: ss }, hips: { w: [0.35, 1], ease: ss }, chest: { w: [0.4, 1], ease: ss } }
    : { weight: { w: [0, 0.6], ease: ss }, hips: { w: [0.1, 0.75], ease: ss }, chest: { w: [0.2, 0.88], ease: ss }, arm: { w: [0.35, 1], ease: into } };
  const D = tm.contact - tm.load, at0 = (L) => tm.load + L.w[0] * D, at1 = (L) => tm.load + L.w[1] * D;
  // a link's progress through READY → LOAD → CONTACT → FOLLOW → READY, as (state a, state b, mix)
  const phase = (t, L, drive = L.ease) => {
    if (t <= tm.load) return ['ready', 'load', ss(t / tm.load)];
    if (t <= at0(L)) return ['load', 'load', 0];
    if (t <= tm.contact) return ['load', 'contact', drive(Math.min(1, (t - at0(L)) / (at1(L) - at0(L))))];
    if (t <= tm.follow) return ['contact', 'follow', out((t - tm.contact) / (tm.follow - tm.contact))];
    return ['follow', 'ready', ss((t - tm.follow) / (1 - tm.follow))];
  };
  const mixOf = (vals, t, lag, drive) => { const [a, b, x] = phase(t, lag, drive); const A = vals[a], B = vals[b]; return Array.isArray(A) ? A.map((v, i) => lerp(v, B[i], x)) : lerp(A, B, x); };
  // the states of each scalar link
  const F = st.facing, ax0 = st.trunk.spine?.axial ?? 0;
  const facingV = { ready: F, load: F + K.load.turn, contact: F + K.turn, follow: F + K.turn * 1.08 };
  const axialV = { ready: ax0, load: ax0 + K.load.chest / TWIST_CAP, contact: ax0 + K.chest / TWIST_CAP, follow: ax0 + (K.chest * 1.1) / TWIST_CAP };
  // the feet: the lead's ball out by the lunge along the foot line (landing at contact, home after the follow)
  const u = [Math.cos((S.line * Math.PI) / 180), Math.sin((S.line * Math.PI) / 180)];
  const lungeTo = K.lunge ? [ball.R[0] + u[0] * K.lunge * legLen, ball.R[1] + u[1] * K.lunge * legLen] : ball.R;
  const leadAt = (t) => {
    if (!K.lunge) return ball.R;
    const go0 = at0(links.weight), go1 = tm.contact, back0 = tm.follow + 0.08, back1 = 0.92;
    const x = t <= go0 ? 0 : t <= go1 ? ss((t - go0) / (go1 - go0)) : t <= back0 ? 1 : t <= back1 ? 1 - ss((t - back0) / (back1 - back0)) : 0;
    return [lerp(ball.R[0], lungeTo[0], x), lerp(ball.R[1], lungeTo[1], x)];
  };
  // the lead foot is off the floor while it travels (blending in and out over BLEND of the clip)
  const BLEND = 0.04;
  const airWindows = K.lunge ? [[at0(links.weight), tm.contact], [tm.follow + 0.08, 0.92]] : [];
  const leadGround = (t) => { let g = 1; for (const [a, b] of airWindows) g = Math.min(g, 1 - clamp(Math.min((t - a) / BLEND, (b - t) / BLEND), 0, 1)); return g; };
  // the body's ground point for a weight share: rear centre → lead centre (the balls and heels as the stance bears)
  const centre = (b) => [b[0], b[1] - 0.04];
  const weightV = { ready: S.weight, load: S.weight + K.load.weight, contact: K.weight, follow: K.weight + 0.02 };
  const baseOf = (t) => ({ L: ball.L, R: leadAt(t) });
  // the rear foot's pivot and heel ride the hips
  const pivotV = { ready: 0, load: 0, contact: K.pivot, follow: K.pivot }, heelV = { ready: S.heel, load: S.heel, contact: Math.max(S.heel, K.heel), follow: Math.max(S.heel, K.heel) };
  const trunkAt = (t) => {
    const facing = mixOf(facingV, t, links.hips), axial = mixOf(axialV, t, links.chest);
    const back = Math.abs(facing), sg = -Math.sign(facing);
    return { facing, hinge: S.lean, ...(Math.abs(axial) > 1e-4 ? { spine: { sagittal: 0, lateral: 0, axial: r4(axial) } } : {}),
      ...(back > 0.01 && back <= GLANCE ? { glance: r1(sg * back) } : {}), ...(back > GLANCE ? { neck: { turn: sg * NECK_TURN } } : {}),
      head: { pitch: r1(S.lean * 0.7), ...(back > GLANCE ? { turn: r1(sg * Math.min(HEAD_TURN, back - NECK_TURN)) } : {}) } };
  };
  const ready = rigNodesAt(R, { ...st.trunk, ...st.arms, facing: F, sink: st.sink, support: 'none' }).nodes;
  const com0 = comOf(ready);
  // the weight: the core shifted so the centre of mass's ground point stands at the weight's share of the base
  const shiftAt = (t, trunk, arms, sink) => {
    const w = mixOf(weightV, t, links.weight), b = baseOf(t), a = centre(b.L), c = centre(b.R);
    const want = [lerp(a[0], c[0], w), lerp(a[1], c[1], w)];
    const ws0 = [lerp(centre(ball.L)[0], centre(ball.R)[0], S.weight), lerp(centre(ball.L)[1], centre(ball.R)[1], S.weight)];
    let sh = [want[0] - ws0[0], want[1] - ws0[1]];
    // (one correction for what the turn and the arms move of the mass)
    const n = rigNodesAt(R, elbowsDown(R, { ...trunk, ...arms, shift: { x: sh[0], y: sh[1] }, sink, support: 'none' })).nodes; const c1 = comOf(n);
    const drift = [c1[0] - sh[0] - com0[0], c1[1] - sh[1] - com0[1]]; sh = [sh[0] - drift[0], sh[1] - drift[1]];
    return sh;
  };
  // the sink: the stance's, deeper as the legs need to reach their feet from where the hips have gone
  const reachSink = (pose, b, heel = 0) => {
    let sink = st.sink;
    for (let i = 0; i < 60; i++) {
      const n = rigNodesAt(R, { ...pose, sink, support: 'none' }).nodes; let ok = true;
      for (const s of ['L', 'R']) { const L = legs[s]; const lf = dist(rest[L.knee], rest[L.hip]) + dist(rest[L.hock], rest[L.knee]); const hock = [b[s][0], b[s][1] - 0.03, rest[L.hock][2] + (s === 'L' && heel > 5 ? 0.035 : 0)]; if (dist(hock, n[L.hip]) > 0.975 * lf) ok = false; }
      if (ok) return sink; sink += 0.004;
    }
    return sink;
  };
  // THE CONTACT POINT: the body at contact (no arms yet), the striking shoulder there, the line at its height
  const tc = tm.contact;
  const trC = trunkAt(tc);
  const lenArm = dist(rest[`shoulder${K.hand}`], rest[`elbow${K.hand}`]) + dist(rest[`elbow${K.hand}`], rest[`wrist${K.hand}`]);
  const shC0 = (() => { const sh = shiftAt(tc, trC, st.arms, st.sink); const n = rigNodesAt(R, { ...trC, ...st.arms, shift: { x: sh[0], y: sh[1] }, sink: st.sink, support: 'none' }).nodes; return n[`shoulder${K.hand}`]; })();
  const reachLen = K.reach * lenArm, dz = K.up, dx = -shC0[0];
  const contact = [0, shC0[1] + Math.sqrt(Math.max(0, reachLen * reachLen - dx * dx - dz * dz)), shC0[2] + dz];
  // the timeline is solved twice: the first pass finds where the striking shoulder really goes (the sink and the weight
  // the legs need), the second puts the contact point (and a hand-led strike's extension) on those places
  const toFeet = (b) => Object.fromEntries(['L', 'R'].flatMap((s) => [[`out${s}`, r4((b[s][0] - rest[legs[s].toeBase][0]) * Math.sign(rest[legs[s].hip][0]))], [`foot${s}`, r4(b[s][1] - rest[legs[s].toeBase][1])]]));
  const times = [...new Set([...Array.from({ length: Math.round(1 / STEP) + 1 }, (_, i) => r4(i * STEP)), tm.load, tc, tm.follow, at1(links.arm)].map(r4))].sort((a, b) => a - b);
  const pass = (contact, ext, counter) => {
    const keys = [], shoulder = new Map(), bodies = new Map(); let seed = { R: { sh: st.arms.shR, elbow: st.arms.elbowR }, L: { sh: st.arms.shL, elbow: st.arms.elbowL } };
    let chamber = null, prevArms = st.arms;
    for (const t of times) {
      const trunk = trunkAt(t);
      const b = baseOf(t), gR = leadGround(t);
      const pivot = mixOf(pivotV, t, links.hips), heel = mixOf(heelV, t, links.hips);
      const legsPose = { splayL: S.toes.L - pivot, splayR: -S.toes.R };
      // the lead leg carried bent while its foot is in the air (as far as it must clear the floor)
      const lift = 1 - gR; const swing = lift > 0 ? { hipR: { pitch: r1(32 * lift) }, kneeR: r1(58 * lift) } : {};
      // the body without the arms, its sink for the legs' reach, its shift for the weight
      const sink0 = reachSink({ ...trunk, ...prevArms }, b, heel);
      const sh = shiftAt(t, trunk, prevArms, sink0);
      const sink = reachSink({ ...trunk, ...prevArms, shift: { x: sh[0], y: sh[1] } }, b, heel);
      const body = { ...trunk, shift: { x: r4(sh[0]), y: r4(sh[1]) }, sink, support: 'none' };
      const n = rigNodesAt(R, elbowsDown(R, { ...body, ...prevArms })).nodes;
      // THE STRIKING HAND: guard → (load: drawn back) → a straight line to contact → on past it → home to guard; a
      // hand-led strike's line has a corner: the arm extends to `ext` first, and the lunge carries the point to contact
      const guardS = handGoal(n, S.hands[K.hand], K.hand);
      const [pa, pb, x] = phase(t, links.arm);
      const lineDir = (() => { const g = chamber ?? guardS; const v = [contact[0] - g[0], contact[1] - g[1], contact[2] - g[2]]; const l = Math.hypot(...v) || 1; return v.map((c) => c / l); })();
      const past = [contact[0] + lineDir[0] * K.follow, contact[1] + lineDir[1] * K.follow, contact[2] + lineDir[2] * K.follow];
      const ptOf = (state) => state === 'ready' ? guardS : state === 'load' ? (chamber ?? [guardS[0] - lineDir[0] * K.pull, guardS[1] - lineDir[1] * K.pull, guardS[2] - lineDir[2] * K.pull]) : state === 'contact' ? contact : past;
      if (t >= tm.load && !chamber) chamber = ptOf('load');
      let goalS = lerp3(ptOf(pa), ptOf(pb), x);
      if (ext && t > tm.load && t <= tc) {
        const a1 = at1(links.arm);
        goalS = t <= a1 ? lerp3(chamber, ext, phase(t, links.arm)[2]) : lerp3(ext, contact, ss((t - a1) / (tc - a1)));
      }
      // THE OTHER HAND rides the chest at its guard's angles (the guard turns with the body), or SWINGS to its counter:
      // a swing is an arc of the joints from the guard's angles to the counter's, not a line the hand is aimed along
      const guardA = { sh: st.arms[`sh${other}`], elbow: st.arms[`elbow${other}`] };
      const aO = counter ? (() => { const [qa, qb, y] = phase(t, links.arm, ss); const A = (s) => (s === 'contact' || s === 'follow' ? counter : guardA); const a = A(qa), b2 = A(qb);
        return { sh: { pitch: r1(lerp(a.sh.pitch, b2.sh.pitch, y)), yaw: r1(lerp(a.sh.yaw ?? 0, b2.sh.yaw ?? 0, y)), roll: r1(lerp(a.sh.roll ?? 0, b2.sh.roll ?? 0, y)) }, elbow: r1(lerp(a.elbow, b2.elbow, y)) }; })() : guardA;
      const aS = reachArm(R, body, K.hand, goalS, seed[K.hand]);
      seed = { ...seed, [K.hand]: aS };
      const arms = { [`sh${K.hand}`]: aS.sh, [`elbow${K.hand}`]: aS.elbow, [`sh${other}`]: aO.sh, [`elbow${other}`]: aO.elbow };
      prevArms = arms;
      // (the shoulder where this frame's arm leaves it: the collarbone rises with the arm)
      shoulder.set(t, rigNodesAt(R, elbowsDown(R, { ...body, ...arms })).nodes[`shoulder${K.hand}`]); bodies.set(t, body);
      keys.push({ t, pose: { ...trunk, ...arms, ...legsPose, ...swing, shift: body.shift }, sink: r4(sink), ...toFeet(b), groundL: 1, groundR: r4(gR), heelL: r1(heel), heelR: 0 });
    }
    return { keys, shoulder, chamber, bodies };
  };
  const contactFrom = (shc) => [0, shc[1] + Math.sqrt(Math.max(0, reachLen * reachLen - shc[0] * shc[0] - dz * dz)), shc[2] + dz];
  // (three passes: the shoulder rises with the arm it carries, so where it stands at contact settles over two)
  let contact2 = contact, ext = null, counter = null, run = pass(contact, null, null);
  for (let k = 0; k < 2; k++) {
    // the counter's angles: the other arm solved afresh for its place on the body at contact
    if (K.counter) { const bc = run.bodies.get(r4(tc)), nc = rigNodesAt(R, bc).nodes; counter = reachArm(R, bc, other, handGoal(nc, K.counter, other)); }
    const shc = run.shoulder.get(r4(tc)); contact2 = contactFrom(shc);
    const rel = [contact2[0] - shc[0], contact2[1] - shc[1], contact2[2] - shc[2]], shA = run.shoulder.get(r4(at1(links.arm)));
    ext = K.order === 'hand' ? [contact2[0], shA[1] + rel[1], shA[2] + rel[2]] : null;
    run = pass(contact2, ext, counter);
  }
  const { keys, chamber } = run;
  // the ends are the stance's held key exactly (a strike plays from the ready pose and back to it)
  const held = { t: 0, pose: { ...st.held }, ...toFeet(ball), sink: st.sink, groundL: 1, groundR: 1, heelL: S.heel, heelR: 0 };
  keys[0] = { ...held, t: 0 }; keys[keys.length - 1] = { ...held, t: 1 };
  return { keys, contact: contact2, chamber, ext, drive: [at0(links.arm), tc] };
}

/**
 * The machine gate on a strike's clip: { contact (metres the hand misses its point at contact), straight (the most the
 * hand strays off the chamber → contact line while it drives), order (each link's moment of greatest speed, seconds
 * shares: hips, chest, hand; `ordered` whether they run as the strike's order says), balance (the least margin of the
 * centre of mass inside the footprint while both feet are down, metres), plant (the most a planted foot slides, metres),
 * elbow (degrees the striking elbow stays bent at contact), ends (metres the first and last frames are off the stance) }.
 */
export function strikeChecks(R, clip, { hand, contact, at, path, drive, order, lead, lunge }) {
  const N = 80, legs = R.legs, rear = lead === 'R' ? 'L' : 'R';
  const frames = Array.from({ length: N + 1 }, (_, i) => rigNodesAt(R, clip.fn(i / N)).nodes);
  const nC = rigNodesAt(R, clip.fn(contact)).nodes;
  const w = (n) => n[`wrist${hand}`];
  // the drive's straightness: the hand's distance off its path (chamber → contact, or chamber → extension → contact)
  const offSeg = (p, a, b) => { const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = e[0] * e[0] + e[1] * e[1] + e[2] * e[2] || 1; const s = clamp(((p[0] - a[0]) * e[0] + (p[1] - a[1]) * e[1] + (p[2] - a[2]) * e[2]) / l2, 0, 1); return dist(p, [a[0] + e[0] * s, a[1] + e[1] * s, a[2] + e[2] * s]); };
  let straight = 0;
  frames.forEach((n, i) => { const t = i / N; if (t < drive[0] || t > drive[1]) return; const p = w(n); let d = Infinity; for (let k = 0; k + 1 < path.length; k++) d = Math.min(d, offSeg(p, path[k], path[k + 1])); straight = Math.max(straight, d); });
  // the chain: each link's moment of greatest speed before contact (the hips' and the chest's turns, the hand)
  const yaw = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const peak = (f) => { let best = 0, bi = 0; for (let i = 1; i < frames.length && i / N <= contact + 0.02; i++) { const v = Math.abs(f(frames[i]) - f(frames[i - 1])); if (v > best) { best = v; bi = i; } } return r4((bi - 0.5) / N); };
  const hips = peak((n) => yaw(n.hipL, n.hipR)), chest = peak((n) => yaw(n.shoulderL, n.shoulderR));
  // the hand's link: its speed (body-led), or its elbow opening (hand-led: the lunge carries the hand fastest at the end)
  const bend = (n) => { const a = n[`shoulder${hand}`], b = n[`elbow${hand}`], c = w(n); const u1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], u2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]; return Math.acos(clamp((u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2]) / (Math.hypot(...u1) * Math.hypot(...u2)), -1, 1)); };
  let hb = 0, hi = 0; for (let i = 1; i < frames.length && i / N <= contact + 0.02; i++) { const v = order === 'hand' ? Math.abs(bend(frames[i]) - bend(frames[i - 1])) : dist(w(frames[i]), w(frames[i - 1])); if (v > hb) { hb = v; hi = i; } }
  const handPeak = r4((hi - 0.5) / N);
  const ordered = order === 'hand' ? handPeak < Math.min(hips, chest) : hips <= chest + 1e-9 && chest <= handPeak + 1e-9;
  // balance while both feet are down, the planted feet's slide
  let balance = Infinity, plant = 0; const toe0 = { L: frames[0][legs.L.toeBase], R: frames[0][legs.R.toeBase] };
  const down = (n, s) => n[legs[s].toeBase][2] - R.joints[legs[s].toeBase][2] < 1e-3;
  for (const n of frames) {
    if (down(n, 'L') && down(n, 'R')) {
      // (a heel bears while it is down: the hock within a centimetre of its rest height)
      const pts = []; for (const s of ['L', 'R']) { pts.push(n[legs[s].toeBase], n[legs[s].toeTip]); if (n[legs[s].hock][2] - R.joints[legs[s].hock][2] < 0.01) pts.push(n[legs[s].hock]); }
      balance = Math.min(balance, marginOf(pts.map((p) => [p[0], p[1]]), comOf(n)));
    }
    plant = Math.max(plant, Math.hypot(n[legs[rear].toeBase][0] - toe0[rear][0], n[legs[rear].toeBase][1] - toe0[rear][1]));
    if (!lunge) plant = Math.max(plant, Math.hypot(n[legs[lead].toeBase][0] - toe0[lead][0], n[legs[lead].toeBase][1] - toe0[lead][1]));
  }
  const sh = nC[`shoulder${hand}`], el = nC[`elbow${hand}`], wr = nC[`wrist${hand}`];
  const u1 = [el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]], u2 = [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]];
  const elbow = (Math.acos(clamp((u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2]) / (Math.hypot(...u1) * Math.hypot(...u2)), -1, 1)) * 180) / Math.PI;
  const ends = Math.max(...Object.keys(frames[0]).map((k) => dist(frames[0][k], frames[N][k])));
  return { contact: r4(dist(w(nC), at)), straight: r4(straight), order: { hips, chest, hand: handPeak, ordered }, balance: r4(balance), plant: r4(plant), elbow: r1(elbow), ends: r4(ends) };
}
function marginOf(pts, q) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const r of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], r) <= 0) lo.pop(); lo.push(r); }
  for (const r of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], r) <= 0) up.pop(); up.push(r); }
  const H = lo.slice(0, -1).concat(up.slice(0, -1)); let m = Infinity;
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; const e = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(e[0], e[1]); m = Math.min(m, (e[0] * (q[1] - a[1]) - e[1] * (q[0] - a[0])) / l); }
  return m;
}
