/**
 * hero-motion — the hero's LOCOMOTION: a vajra motion spec (figure-posing.js `resolveMotion`: the walk's dials, the
 * run's, keyframes, the performance layer) played on a station-loft rig with its feet on the floor.
 *
 * The vajra gait walks on a treadmill: the stance foot slides back under the body as the hip extends, the swing foot
 * arcs forward to its next contact. The rig's own leg solve plants a foot at its REST spot (station-loft-rig.js
 * `plantedFoot`), which would glue both feet in place through double support and erase the stride. So each phase is
 * baked in two passes over the rig:
 *   1. the core's own pose with no foot planted (`support: 'none'`): every toe where the gait's hip, knee and ankle put
 *      it (forward kinematics);
 *   2. the rig posed again with `feet` — each toe-base TARGET: the forward-kinematic toe, brought down to the floor by
 *      the gait's plant weight (`plant`, 1 through stance, easing to 0 mid-swing) — and `sink`, the root lowered just
 *      enough that a foot planted fore or aft still reaches (the inverted pendulum's vault, as the stick figure's
 *      `groundVault` does). A target the leg still cannot reach rises (the heel lifts) rather than refuse.
 * The clip walks in place; `travel` is the ground it covers per cycle (the stance toes' mean backward slide), so a
 * clip of `seconds` carries the ground speed v = travel ÷ seconds that an engine plays it against (playback rate =
 * planar speed ÷ v): at that speed a planted foot stays put in the world.
 *
 * Pure and deterministic; absent from every hero until a caller asks (no door field yet).
 */
import { rigNodesAt, VAJRA_CORE } from './station-loft-rig.js';
import { resolveMotion, WALK_MINT, SPRINT_MINT } from './figure-posing.js';
import { heroJump, JUMPS, keyedClip, mirrored } from './hero-jump.js';
import { elbowsDown, elbowDownRoll } from './hero-elbow.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const REACH = 0.998;   // a planted leg straightens to this share of femur + tibia at most (the knee never locks dead straight)

/** the rig's core joints as the vajra posing engine takes them (its `base`) */
export const rigCore = (R) => Object.fromEntries(VAJRA_CORE.map((k) => [k, { x: R.joints[k][0], y: R.joints[k][1], z: R.joints[k][2] }]));

/** a leg's plant weight at a dof: the gait's `plant`, else its support word */
const plantOf = (dof, S) => {
  if (dof?.plant && Number.isFinite(dof.plant[S])) return Math.max(0, Math.min(1, dof.plant[S]));
  if (Number.isFinite(dof?.lift) && dof.lift > 0) return 0;
  const s = dof?.support ?? 'both';
  return s === 'both' || s === S ? 1 : 0;
};

const rotX = (v, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a); return [v[0], v[1] * c - v[2] * si, v[1] * si + v[2] * c]; };
const HEEL_MAX = 40;    // the trailing heel rises up to this (degrees) at push-off
const CLEAR = 0.04;     // the swing toe's least clearance mid-swing (metres): it leaves the floor at lift-off and meets it at landing
const HARMONICS = 4;    // the root's sink keeps this many harmonics of the cycle: the bob (two steps a cycle) and its overtone, never a jolt
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** a leg's reach problem: the hock for a toe at `toe` with the heel up `heel` degrees, and the root drop it needs */
function needAt(hip, toe, heelRest, heel, reach) {
  const hv = rotX(heelRest, -heel); const hock = [toe[0] + hv[0], toe[1] + hv[1], toe[2] + hv[2]];
  const dh = Math.hypot(hip[0] - hock[0], hip[1] - hock[1]);
  return Math.max(0, (hip[2] - hock[2]) - Math.sqrt(Math.max(0, reach * reach - dh * dh)));
}

/**
 * One phase of a motion on the rig → the rig pose (the motion's own dof plus `feet`, `sink` and the heels), the forward
 * toes and the plant weights.
 * @param {object} R    a validated rig (station-loft-rig.js validateRig)
 * @param {object} dof  the motion's pose at this phase (resolveMotion(spec)(phase))
 * @param {{ footY?: { [side]: number } }} [opt]  a stance toe's fore-aft place, overriding the forward-kinematic one
 *   (heroLocomotion's constant-speed stance; absent for a side in swing); `swing` the side's place in its swing, 0 … 1
 *   (lifted off the floor between the ends); `sink` the root's drop and `heel` each side's heel (degrees up), when the
 *   caller has planned them over the cycle (heroLocomotion), else found here for this phase alone
 */
export function groundedPose(R, dof, { footY = {}, swing = {}, sink: sinkAt = null, heel: heelAt = null } = {}) {
  const { plant, support, heelLift: _heel, ...own } = dof || {};   // the rig lifts its own heels (heelL / heelR, below)
  const free = rigNodesAt(R, { ...own, support: 'none' }).nodes;
  const sides = Object.keys(R.legs); const rest = R.joints; const legs = {};
  let sink = 0;
  for (const S of sides) {
    const L = R.legs[S];
    const femur = len(sub(rest[L.knee], rest[L.hip])), tibia = len(sub(rest[L.hock], rest[L.knee]));
    const heelRest = sub(rest[L.hock], rest[L.toeBase]);   // the toe base → the hock at rest (the foot flat)
    const floor = rest[L.toeBase][2]; const fk = free[L.toeBase];
    // with the stance known (heroLocomotion), a foot is on the floor exactly through it and in the air otherwise;
    // without, the gait's own plant weight says
    const timed = Object.keys(footY).length > 0; const w = timed ? (Number.isFinite(footY[S]) ? 1 : 0) : plantOf(dof, S);
    const y = Number.isFinite(footY[S]) ? footY[S] : fk[1];
    const toe = [fk[0], y, floor]; const hip = free[L.hip]; const reach = REACH * (femur + tibia);
    // a planted foot behind the hip rolls onto its toes before the body sinks for it (the push-off)
    let heel = Math.max(0, Number(own[`toe${S}`]) || 0) * w;
    if (heelAt && Number.isFinite(heelAt[S])) heel = heelAt[S];
    else if (y < hip[1]) while (heel < HEEL_MAX && needAt(hip, toe, heelRest, heel, reach) > 0) heel = Math.min(HEEL_MAX, heel + 1);
    legs[S] = { L, w, fk, y, heelRest, floor, reach, heel };
    sink = Math.max(sink, w * needAt(hip, toe, heelRest, heel, reach));
  }
  // heroLocomotion's sink: one smooth curve over the whole cycle, at or above every phase's need
  if (Number.isFinite(sinkAt)) sink = sinkAt;
  const feet = {}; const heels = {};
  for (const S of sides) {
    const { L, w, fk, y, heelRest, floor, reach, heel } = legs[S];
    const hip = [free[L.hip][0], free[L.hip][1], free[L.hip][2] - sink];
    // the forward toe rode the root down by `sink`; the plant weight brings it to the floor
    let z = Math.max(floor, (1 - w) * (fk[2] - sink) + w * floor);
    // a timed swing (0 at lift-off … 1 at landing) is off the floor between its ends, whatever the forward toe does
    if (Number.isFinite(swing[S])) z = Math.max(z, floor + CLEAR * Math.sin(Math.PI * swing[S]));
    // still out of reach (a long stride at a light plant): the foot rises along its line until the leg reaches
    const hv = rotX(heelRest, -heel);
    const dh = Math.hypot(hip[0] - fk[0] - hv[0], hip[1] - y - hv[1]);
    const zMin = hip[2] - hv[2] - Math.sqrt(Math.max(0, reach * reach - dh * dh));
    if (z < zMin) z = zMin;
    feet[S] = [fk[0], y, z]; heels[`heel${S}`] = -Math.round(heel * 1000) / 1000;   // the rig's heel word: negative raises the heel
  }
  return { pose: { ...own, ...heels, feet, sink }, toes: Object.fromEntries(sides.map((S) => [S, free[R.legs[S].toeBase]])), plant: Object.fromEntries(sides.map((S) => [S, legs[S].w])) };
}

/**
 * A motion spec as a rig clip: `fn(phase) → rig pose`, the cycle's `travel` (metres of ground per cycle) and `v(seconds)`
 * the ground speed at a clip length. Each foot's stance is re-timed to slide back at ONE constant speed (the gait's own
 * hip swing is a sine, so its stance toe races mid-stance and stalls at the ends — no playback rate keeps that foot
 * still): from where the forward-kinematic toe is furthest forward (the landing) to where it is furthest back (the
 * lift-off), linearly; the swing keeps the gait's own arc, and the two meet at both ends.
 * @param {string|object} spec  a vajra motion spec (resolveMotion's)
 * @param {object} R            a validated rig
 * `tilt` (degrees) leans the body into the gait.
 */
export function heroLocomotion(spec, R, { frames = 24, fine = 240, tilt = 0 } = {}) {
  const gaitMove = resolveMotion(spec, { frames, base: rigCore(R) });
  // the TILT: the trunk hinged forward over the hips, the spine straight (the pose engine's `hinge`), the head taking
  // back GAZE_HOLD of it; the legs then reach their footfalls from the tilted body (0 ⇒ the gait as it is)
  // and every raised arm bends with its elbow down (hero-elbow.js: the sprint's pump, never a chicken wing)
  const tilted = gaitMove && tilt ? (ph) => { const d = gaitMove(ph); return { ...d, hinge: (d.hinge || 0) + tilt, head: { ...(d.head || {}), pitch: ((d.head && d.head.pitch) || 0) + GAZE_HOLD * tilt } }; } : gaitMove;
  const move = tilted ? (ph) => elbowsDown(R, tilted(ph)) : tilted;
  if (!move) throw new Error(`hero-motion: not a motion spec (${JSON.stringify(spec)}) — a vajra motion spec: 'walk', { walk: {…} }, { sprint: {…} }, { keyframes: […] }`);
  const sides = Object.keys(R.legs);
  // each leg's stance on the cycle: from where its forward-kinematic toe is furthest forward (the landing) on to where
  // it is furthest back (the lift-off); a leg that never moves fore and aft has none
  // A gait with a flight phase (the run: the root rises by `lift` between contacts) says its contact itself: the stance
  // is the run of the foot's plant weight ≥ ½, from its first to its last frame on the ground.
  const samples = Array.from({ length: fine }, (_, i) => move(i / fine));
  const walked = !samples.some((d) => Number.isFinite(d?.lift) && d.lift > 0);   // no flight: a walk
  const stance = {};
  for (const S of sides) {
    const ys = samples.map((d) => rigNodesAt(R, { ...d, plant: undefined, support: 'none' }).nodes[R.legs[S].toeBase][1]);
    let hi = 0, lo = 0;
    if (walked) ys.forEach((y, i) => { if (y > ys[hi]) hi = i; if (y < ys[lo]) lo = i; });
    else {
      const on = samples.map((d) => plantOf(d, S) >= 0.5);
      if (on.every(Boolean) || !on.some(Boolean)) { stance[S] = null; continue; }
      hi = on.findIndex((x, i) => x && !on[(i - 1 + fine) % fine]); let n = 0; while (on[(hi + n) % fine] && n < fine) n++; lo = (hi + n - 1) % fine;
    }
    if (ys[hi] - ys[lo] < 1e-4) { stance[S] = null; continue; }
    stance[S] = { t0: hi / fine, span: ((lo - hi + fine) % fine) / fine, y0: ys[hi], y1: ys[lo] };
  }
  const yOf = (S, phase) => {
    const st = stance[S]; if (!st) return undefined;
    const u = ((((phase - st.t0) % 1) + 1) % 1) / st.span;            // 0 at landing, 1 at lift-off; past 1 the swing
    return u <= 1 ? st.y0 + (st.y1 - st.y0) * u : undefined;
  };
  const swingOf = (S, phase) => {   // 0 at lift-off … 1 at landing; undefined in stance
    const st = stance[S]; if (!st) return undefined;
    const u = (((phase - st.t0) % 1) + 1) % 1; if (u <= st.span) return undefined;
    return (u - st.span) / (1 - st.span);
  };
  const timing = (phase) => ({ footY: Object.fromEntries(sides.map((S) => [S, yOf(S, phase) ?? null])), swing: Object.fromEntries(sides.map((S) => [S, swingOf(S, phase) ?? null])) });
  // THE HEEL, planned: a heel-to-toe roll, the heel rising through the back half of the stance to just what the lift-off
  // needs (found once, at the lift-off), and lowering in the first third of the swing — a smooth curve, never a step
  const rest = R.joints; const legOf = {};
  for (const S of sides) {
    const L = R.legs[S]; const st = stance[S]; if (!st) continue;
    const reach = REACH * (len(sub(rest[L.knee], rest[L.hip])) + len(sub(rest[L.hock], rest[L.knee]))); const heelRest = sub(rest[L.hock], rest[L.toeBase]);
    const off = (st.t0 + st.span) % 1; const free = rigNodesAt(R, { ...move(off), plant: undefined, support: 'none' }).nodes;
    const toe = [free[L.toeBase][0], st.y1, rest[L.toeBase][2]];
    let lo = 0, hi = HEEL_MAX; if (needAt(free[L.hip], toe, heelRest, 0, reach) > 0) { for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (needAt(free[L.hip], toe, heelRest, m, reach) > 0) lo = m; else hi = m; } } else hi = 0;
    legOf[S] = { L, reach, heelRest, end: hi };
  }
  const heelOf = (S, phase) => {
    const st = stance[S], g = legOf[S]; if (!st || !g) return 0;
    const u = (((phase - st.t0) % 1) + 1) % 1;
    return u <= st.span ? g.end * smooth(0.5, 1, u / st.span) : g.end * (1 - smooth(0, 0.35, (u - st.span) / (1 - st.span)));
  };
  // THE SINK, planned: each phase's need (the planted feet at their planned heels, nothing for a foot in the air), then
  // one smooth curve over the cycle at or above it — its first HARMONICS, lifted until no phase is short and no phase
  // rises above the rig's rest. A sink computed phase by phase drops the body in one frame as a foot lands far forward:
  // a jolt the eye (and any camera on the head) reads as shake.
  const need = samples.map((d, i) => {
    const ph = i / fine; const t = timing(ph); const free = rigNodesAt(R, { ...d, plant: undefined, support: 'none' }).nodes;
    let n = 0;
    for (const S of sides) { const g = legOf[S]; if (!g || !Number.isFinite(t.footY[S])) continue; n = Math.max(n, needAt(free[g.L.hip], [free[g.L.toeBase][0], t.footY[S], rest[g.L.toeBase][2]], g.heelRest, heelOf(S, ph), g.reach)); }
    return n;
  });
  const coef = [];
  for (let h = 0; h <= HARMONICS; h++) { let re = 0, im = 0; need.forEach((x, m) => { const a = (2 * Math.PI * h * m) / fine; re += x * Math.cos(a); im -= x * Math.sin(a); }); coef.push([re / fine, im / fine]); }
  const series = (phase) => coef.reduce((o, [re, im], h) => { const a = 2 * Math.PI * h * phase; return o + (h ? 2 : 1) * (re * Math.cos(a) - im * Math.sin(a)); }, 0);
  const lift = Math.max(0, ...need.map((x, i) => x - series(i / fine)), ...need.map((_, i) => -series(i / fine)));
  const sinkOf = (phase) => series(phase) + lift;
  const fn = (phase) => groundedPose(R, move(phase), { ...timing(phase), sink: sinkOf(phase), heel: Object.fromEntries(sides.map((S) => [S, heelOf(S, phase)])) }).pose;
  const speeds = sides.map((S) => stance[S]).filter(Boolean).map((st) => (st.y0 - st.y1) / st.span);   // metres per cycle
  const travel = speeds.length ? Math.max(0, speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  return { fn, travel, stance, v: (seconds) => (seconds > 0 ? travel / seconds : 0) };
}

// ─── the hero door's `motion` ──────────────────────────────────────────────
// `motion: { walk?, jog?, sprint? }` — each `true` (the gait as studied) or an object of the gait's own dials plus
// `seconds` (the cycle's designed duration) and `tilt` (degrees: the whole body leaning into the run). A walk is the
// vajra walk (figure-posing.js WALK_DEFAULTS); a jog and a sprint are the vajra run (SPRINT_DEFAULTS, a flight phase):
// the jog softer and tilted a little, the sprint tilted further and driven harder (knees, arm pump, stride, push-off).
// A name here REPLACES the hero's own clip of that name (the stock walk). Stored as given; compiled on the hero's rig
// where its clips are packed.

/** the gaits the door takes: the vajra motion each compiles to, the dials it starts from, its tilt and its seconds */
export const MOTION_GAITS = Object.freeze({
  walk: Object.freeze({ motion: 'walk', base: Object.freeze({}), tilt: 0, seconds: 1.1 }),
  jog: Object.freeze({ motion: 'sprint', base: Object.freeze({ dutyFactor: 0.45, strideLength: 0.5, lean: 0.06, armSwing: 40, armBack: 1.15 }), tilt: 10, seconds: 0.7 }),
  // effort: the knee driven higher and the heel tucked tighter, a bigger arm pump with the elbows driving back, a longer
  // stride with less ground and more flight, a harder push off the forefoot
  sprint: Object.freeze({ motion: 'sprint', base: Object.freeze({ strideLength: 0.72, hipDrive: 1.7, swingTuck: 130, armSwing: 56, armBack: 1.1, elbowBend: 84, lean: 0.08, dutyFactor: 0.32, flightLift: 0.09, spineGive: 0.06, anklePoint: 20, toeFlick: 30 }), tilt: 18, seconds: 0.55 }),
  // the jumps (hero-jump.js): one-shot clips in place, their air timed for an engine's physics
  ...Object.fromEntries(Object.entries(JUMPS).map(([k, J]) => [k, Object.freeze({ motion: 'jump', seconds: J.seconds })])),
  // the stops (heroStop): one-shot, out of a gait when forward is let go
  ...Object.fromEntries(Object.entries({ walk: 0.6, jog: 0.75, sprint: 0.9 }).map(([g, sec]) => [`${g}Stop`, Object.freeze({ motion: 'stop', from: g, seconds: sec })])),
});

// ─── the STOP: letting go of forward ───────────────────────────────────────
// The game stops the character on the spot; the clip shows the momentum it had. Out of the gait's own frame (the lead
// foot past the middle of its swing, the trail foot planted behind), the lead foot sets down under the body as a brake,
// the body runs on over it — the trunk pitching forward past the feet, the arms flung forward, the head dipping, the
// trail heel peeling up — then the trail foot steps up beside the lead, the trunk recoils just past upright and settles
// into the stand. The feet end on their rest spots and nothing slides, so it hands over to the idle clean. `effort`
// scales the lurch with the gait's speed: a walk barely sways, a sprint folds over.
/** each gait's stop: how hard the momentum shows (0 … 1) */
export const STOP_EFFORT = Object.freeze({ walk: 0.3, jog: 0.65, sprint: 1 });
/** the lead foot's place in its swing at the release frame */
const STOP_AT = 0.6;
const both2 = (o) => Object.fromEntries(Object.entries(o).flatMap(([k, v]) => [[`${k}L`, v], [`${k}R`, v]]));
const armsOf = (pitch, elbow) => ({ shL: { pitch }, shR: { pitch }, ...both2({ elbow }) });

/**
 * A gait's stop on a rig: `fn(t)` (0 … 1 inclusive, a one-shot), its `seconds` and `stop` — the gait it leaves (`from`),
 * the lead foot (`lead`, the one that brakes) and the gait `phase` its first frame is (an engine starts the stop whose
 * phase is nearest the cycle's when forward is let go: one for each lead).
 * @param {{ spec, seconds, tilt }} gait  the gait as the plan carries it (motionPlan)
 * @param {'R'|'L'} lead
 */
export function heroStop(gait, R, { from = 'walk', lead = 'R', seconds, effort = STOP_EFFORT[from] ?? 0.5, frames = 24 } = {}) {
  const loco = heroLocomotion(gait.spec, R, { frames, tilt: gait.tilt ?? 0 });
  const trail = lead === 'R' ? 'L' : 'R'; const st = loco.stance[lead];
  if (!st || !loco.stance[trail]) throw new Error(`hero-motion: a stop needs a gait with a stance on both feet`);
  const phase = (st.t0 + st.span + STOP_AT * (1 - st.span)) % 1;
  const { feet, sink, heelL, heelR, ...pose } = loco.fn(phase);
  const heelOf = { L: -heelL, R: -heelR };
  // the gait's arms already roll elbow-down; the timeline rolls them again as it plays, so the frame goes in without it
  for (const S of ['L', 'R']) { const sh = pose[`sh${S}`]; if (sh && Number.isFinite(sh.pitch)) pose[`sh${S}`] = { ...sh, roll: (sh.roll || 0) - elbowDownRoll(R, S, sh.pitch) }; }
  // the trail foot where the gait has it (planted, behind); the lead in the air
  const f0 = feet[trail][1] - R.joints[R.legs[trail].toeBase][1];
  const e = effort, tilt = gait.tilt ?? 0, lurch = 4 + 30 * e;
  // (the catch step never lets go of its foot entirely — `ground` 0.03 at its top — so the floor clamp holds it out of a
  // sunk body's floor; the bent knee lifts it)
  // the timeline written for the RIGHT foot leading (`T` the trail's channels are L's); a left lead is its mirror
  const k = [
    { t: 0.18, pose: { hinge: 0.5 * tilt + 0.55 * lurch, spine: { sagittal: 0.05 * e }, hipL: { pitch: -8 }, kneeL: 20, ...armsOf(15 + 25 * e, 20 + 20 * e), head: { pitch: 4 } }, sink: 0.02 + 0.04 * e, heelL: 18 + 15 * e, heelR: 0, groundL: 1, groundR: 1, footL: f0, footR: 0 },
    { t: 0.32, pose: { hinge: lurch, spine: { sagittal: 0.06 + 0.1 * e }, hipL: { pitch: -10 }, kneeL: 25 + 20 * e, ...armsOf(35 + 45 * e, 15 + 20 * e), neck: { pitch: -4 * e }, head: { pitch: -3 - 6 * e } }, sink: 0.03 + 0.06 * e, heelL: 28 + 15 * e, heelR: 0, groundL: 1, groundR: 1, footL: f0, footR: 0 },
    { t: 0.45, pose: { hinge: 0.55 * lurch, spine: { sagittal: 0.04 * e }, hipL: { pitch: 40 }, kneeL: 75, ...armsOf(15 + 15 * e, 30 + 20 * e), head: { pitch: 2 } }, sink: 0.025 + 0.05 * e, heelL: 10, heelR: 0, groundL: 0.03, groundR: 1, footL: f0 / 2, footR: 0 },
    { t: 0.58, pose: { hinge: 2, spine: { sagittal: -0.04 - 0.06 * e }, ...armsOf(-8 - 12 * e, 22), head: { pitch: 3 } }, sink: 0.02 + 0.04 * e, heelL: 0, heelR: 0, groundL: 1, groundR: 1, footL: 0, footR: 0 },
    { t: 0.75, pose: { hinge: 3 + 3 * e, spine: { sagittal: 0.01 }, ...armsOf(6, 18), head: { pitch: -1 } }, sink: 0.015 + 0.02 * e, heelL: 0, heelR: 0, groundL: 1, groundR: 1, footL: 0, footR: 0 },
    { t: 1, pose: {}, sink: 0, heelL: 0, heelR: 0, groundL: 1, groundR: 1, footL: 0, footR: 0 },
  ];
  const keys = [
    { t: 0, pose, sink, [`heel${lead}`]: heelOf[lead], [`heel${trail}`]: heelOf[trail], [`ground${lead}`]: 1e-5, [`ground${trail}`]: 1, [`foot${lead}`]: 0, [`foot${trail}`]: f0 },
    ...(lead === 'R' ? k : mirrored(k)),
  ];
  const T = seconds ?? MOTION_GAITS[`${from}Stop`]?.seconds ?? 0.75;
  const J = keyedClip({ seconds: T, keys }, R);
  return { fn: J.fn, seconds: J.seconds, stop: { from, lead, phase: Math.round(phase * 1e4) / 1e4 } };
}
/** a tilt's share the head takes back, so the gaze runs ahead (a little down) instead of at the floor */
const GAZE_HOLD = 0.7;
const TILT = [0, 35];
const JUMP_SECONDS = [0.5, 3];
const MOTION_SECONDS = [0.25, 10];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** the refusals for a door `motion`, as strings (empty when it is fine) */
export function validateHeroMotion(motion, dials = { walk: WALK_MINT, sprint: SPRINT_MINT }) {
  if (motion === undefined) return [];
  if (!isObj(motion)) return [`motion: an object of gaits (${Object.keys(MOTION_GAITS).join(', ')}), each true or { <the gait's dials>, tilt, seconds }`];
  const errs = [];
  for (const [name, g] of Object.entries(motion)) {
    const G = MOTION_GAITS[name];
    if (!G) { errs.push(`motion.${name}: not a gait (have ${Object.keys(MOTION_GAITS).join(', ')})`); continue; }
    if (g === true) continue;
    if (G.motion === 'jump' || G.motion === 'stop') {
      if (!isObj(g)) { errs.push(`motion.${name}: true, or { seconds }`); continue; }
      for (const [k, v] of Object.entries(g)) {
        if (k !== 'seconds') errs.push(`motion.${name}.${k}: a ${G.motion} takes only seconds (its poses are studied; tune them in hero-${G.motion === 'stop' ? 'motion' : 'jump'}.js)`);
        else if (!(Number.isFinite(v) && v >= JUMP_SECONDS[0] && v <= JUMP_SECONDS[1])) errs.push(`motion.${name}.seconds: ${JUMP_SECONDS[0]} … ${JUMP_SECONDS[1]} seconds`);
      }
      continue;
    }
    if (!isObj(g)) { errs.push(`motion.${name}: true, or an object of the ${G.motion}'s dials, tilt and seconds`); continue; }
    const known = dials[G.motion];
    for (const [k, v] of Object.entries(g)) {
      if (k === 'tilt') { if (!(Number.isFinite(v) && v >= TILT[0] && v <= TILT[1])) errs.push(`motion.${name}.tilt: ${TILT[0]} … ${TILT[1]} degrees of forward lean`); continue; }
      if (k === 'seconds') { if (!(Number.isFinite(v) && v >= MOTION_SECONDS[0] && v <= MOTION_SECONDS[1])) errs.push(`motion.${name}.seconds: a cycle of ${MOTION_SECONDS[0]} … ${MOTION_SECONDS[1]} seconds`); continue; }
      if (!(k in known)) { errs.push(`motion.${name}.${k}: not a ${G.motion} dial (have ${Object.keys(known).join(', ')}, tilt, seconds)`); continue; }
      if (typeof known[k] === 'boolean' ? typeof v !== 'boolean' : !Number.isFinite(v)) errs.push(`motion.${name}.${k}: ${typeof known[k] === 'boolean' ? 'true or false' : 'a finite number'}`);
    }
  }
  return errs;
}

/** a door `motion` as the plan carries it (`plan.locomotion`): per gait the vajra motion spec and its seconds */
export function motionPlan(motion) {
  if (!isObj(motion) || !Object.keys(motion).length) return null;
  return Object.fromEntries(Object.entries(motion).map(([name, g]) => {
    const G = MOTION_GAITS[name];
    if (G.motion === 'jump') return [name, { jump: name, seconds: (g === true ? undefined : g.seconds) ?? G.seconds }];
    if (G.motion === 'stop') return [name, { stop: G.from, seconds: (g === true ? undefined : g.seconds) ?? G.seconds }];
    const { seconds, tilt, ...own } = g === true ? {} : g;
    return [name, { spec: { [G.motion]: { ...G.base, ...own } }, seconds: seconds ?? G.seconds, tilt: tilt ?? G.tilt }];
  }));
}

/**
 * A door `motion` as it is STORED when authored: each walk, jog or sprint gait gets every dial of its mint table
 * (figure-posing.js WALK_MINT / SPRINT_MINT), the gait's own base, its seconds and its tilt written in, under what the
 * creator set (`true` ⇒ the gait as studied, by value). Jumps and stops, and anything not an object, pass as given.
 * Called where a hero is written (the hero door, an edit under /hero, a world's inline hero), never at render: a hero
 * stored before the mint tables keeps resolving its left-out dials against the frozen defaults.
 */
export function stampHeroMotion(motion) {
  if (!isObj(motion)) return motion;
  return Object.fromEntries(Object.entries(motion).map(([name, g]) => {
    const G = MOTION_GAITS[name];
    if (!G || (G.motion !== 'walk' && G.motion !== 'sprint') || !(g === true || isObj(g))) return [name, g];
    const mint = G.motion === 'walk' ? WALK_MINT : SPRINT_MINT;
    return [name, { ...mint, ...G.base, seconds: G.seconds, tilt: G.tilt, ...(g === true ? {} : g) }];
  }));
}

/**
 * A recipe's `locomotion` compiled on its rig: the clips (functions the rig pack samples, each `keys` frames a cycle), their
 * seconds and their ground speeds. Throws naming the gait when one cannot be baked.
 */
export function locomotionClips(locomotion, R, { keys = 24 } = {}) {
  const clips = {}, seconds = {}, speeds = {};
  for (const [name, { spec, seconds: s, tilt = 0, jump, stop }] of Object.entries(locomotion || {})) {
    if (stop) {
      // a stop: two clips, the right foot braking (`<name>`) and the left (`<name>Left`), out of the hero's own gait (the
      // door's, else the gait as studied)
      const gait = locomotion[stop] ?? motionPlan({ [stop]: true })[stop];
      for (const lead of ['R', 'L']) {
        const clip = lead === 'R' ? name : `${name}Left`; let S;
        try { S = heroStop(gait, R, { from: stop, lead, seconds: s, frames: keys }); } catch (err) { throw new Error(`motion.${name}: ${err.message}`); }
        const K = Math.max(keys, Math.round(S.seconds * 30) + 1);
        try { for (let k = 0; k < K; k++) rigNodesAt(R, S.fn(k / (K - 1))); } catch (err) { throw new Error(`motion.${name}: ${err.message}`); }
        const fn = (t) => S.fn(t); fn.keys = K; fn.once = true; fn.stop = S.stop;
        clips[clip] = fn; seconds[clip] = S.seconds;
      }
      continue;
    }
    if (jump) {
      // a jump: one-shot (sampled 0 … 1 inclusive), ~30 keys a second, its air riding the function
      // a running jump slides its planted feet at the hero's sprint speed (the door's sprint if it has one, else the
      // sprint as studied), so it plays between sprint cycles
      let speed;
      if (JUMPS[jump].run) { const sp = locomotion.sprint ?? motionPlan({ sprint: true }).sprint; speed = heroLocomotion(sp.spec, R, { frames: keys, tilt: sp.tilt }).v(sp.seconds); }
      let J; try { J = heroJump(jump, R, { seconds: s, ...(speed ? { speed } : {}) }); } catch (err) { throw new Error(`motion.${name}: ${err.message}`); }
      const K = Math.max(keys, Math.round(J.seconds * 30) + 1);
      try { for (let k = 0; k < K; k++) rigNodesAt(R, J.fn(k / (K - 1))); } catch (err) { throw new Error(`motion.${name}: ${err.message}`); }
      const fn = (t) => J.fn(t); fn.keys = K; fn.once = true; if (J.air) fn.air = J.air; if (J.roll) fn.roll = J.roll;
      clips[name] = fn; seconds[name] = J.seconds; continue;
    }
    let loco;
    try { loco = heroLocomotion(spec, R, { frames: keys, tilt }); for (let k = 0; k < keys; k++) rigNodesAt(R, loco.fn(k / keys)); }
    catch (err) { throw new Error(`motion.${name}: ${err.message}`); }
    const fn = (phase) => loco.fn(phase); fn.keys = keys;
    clips[name] = fn; seconds[name] = s; speeds[name] = Math.round(loco.v(s) * 1e4) / 1e4;
  }
  return { clips, seconds, speeds };
}

/**
 * A hero gait's FIRST-PERSON BOB, in the shape the World walk reads (`walk.bob`, gait-camera.js `gaitCameraCurve`): the
 * eye's wobble over one cycle — dx lateral, dy fore-aft, dz vertical (in the figure's STAND units: metres ÷ the eye
 * height × 0.855, the walk's own scaling), pitch / roll / yaw of the head in degrees — zero-meaned, sampled `samples`
 * times, and `strideDistance` the ground one cycle covers (same units). Read off THIS hero's baked gait, so the view
 * bobs as the body it rides does; the sink is already smooth, so no band-limit is needed for comfort, but `smooth`
 * (harmonics) is honoured as gait-camera honours it.
 */
export function locomotionCameraCurve(spec, R, { samples = 32, smooth: kmax = 0 } = {}) {
  const loco = heroLocomotion(spec, R);
  const eye = R.joints.headBase[2]; const unit = 0.855 / eye;   // the vajra figure's eye sits at 0.855 STAND
  const DEG = 180 / Math.PI;
  const raw = Array.from({ length: samples }, (_, i) => {
    const n = rigNodesAt(R, loco.fn(i / samples)).nodes; const hb = n.headBase, ht = n.headTop;
    const v = [ht[0] - hb[0], ht[1] - hb[1], ht[2] - hb[2]];
    const fwd = n.shoulderL && n.shoulderR ? Math.atan2(n.shoulderR[1] - n.shoulderL[1], n.shoulderR[0] - n.shoulderL[0]) * DEG : 0;
    return { x: hb[0] * unit, y: hb[1] * unit, z: hb[2] * unit, pitch: Math.atan2(v[1], Math.hypot(v[0], v[2])) * DEG, roll: Math.atan2(v[0], Math.hypot(v[1], v[2])) * DEG, yaw: fwd };
  });
  const keys = ['x', 'y', 'z', 'pitch', 'roll', 'yaw']; const out = ['dx', 'dy', 'dz', 'pitch', 'roll', 'yaw'];
  const mean = Object.fromEntries(keys.map((k) => [k, raw.reduce((s, r) => s + r[k], 0) / samples]));
  let curve = raw.map((r) => Object.fromEntries(keys.map((k, j) => [out[j], r[k] - mean[k]])));
  if (kmax > 0) {
    const lim = Object.fromEntries(out.map((k) => {
      const s = curve.map((c) => c[k]);
      const c = Array.from({ length: kmax + 1 }, (_, h) => { let re = 0, im = 0; s.forEach((x, m) => { const a = (2 * Math.PI * h * m) / samples; re += x * Math.cos(a); im -= x * Math.sin(a); }); return [re / samples, im / samples]; });
      return [k, s.map((_, m) => c.reduce((o, [re, im], h) => { const a = (2 * Math.PI * h * m) / samples; return o + (h ? 2 : 1) * (re * Math.cos(a) - im * Math.sin(a)); }, 0))];
    }));
    curve = curve.map((_, m) => Object.fromEntries(out.map((k) => [k, lim[k][m]])));
  }
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  return { samples, strideDistance: r6(loco.travel * unit), curve: curve.map((c) => Object.fromEntries(out.map((k) => [k, r6(c[k])]))) };
}
