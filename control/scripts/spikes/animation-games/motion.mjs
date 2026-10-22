/**
 * animation-games — MOTION: running, then jumping, in the four flavors. The poses are the hero library's (the jog and the
 * sprint cycles, hero-motion.js `heroLocomotion`; the `runningJump`, hero-jump.js); a flavor decides how the body
 * MOVES through the world with them: how fast speed builds and how high it tops out, how the stride cycle keeps up with
 * the ground, how long the take-off's contact is, the jump's arc (height, gravity, hang, a fall faster than the rise),
 * what the landing costs, squash and stretch, smears.
 *
 *   realistic    a fit runner on earth: speed builds over seconds to 7 m/s, the cycle plays at exactly the ground's rate
 *                (the feet never skate), the jump is the clip's own flight on earth's gravity, a landing costs speed
 *   action       a hero: top speed in half a second, a deep gather, a jump to 1.2 m with a hang at the top, a landing that
 *                holds three frames
 *   platformer   the platform rule's numbers: 6 m/s at once, a quick spring, 8.5 m/s up on gravity 20 and down on 34 (the
 *                arc falls faster than it rose), squash and stretch, no speed lost
 *   pinball      a long build to 20 m/s, the cycle outrunning the ground (legs a blur, never fewer than four frames a
 *                stride), a short contact the faster it goes, a launch, no speed lost
 *
 * THE SEQUENCE: a run-up from a jog (`v0`, the jog's own ground speed) over `runUp` metres, the stride cycle blending
 * jog → sprint with speed; the jump starts on the first frame after the run-up whose cycle phase is the jump's own first
 * pose (found by the nearest pose); the jump's contact before take-off, its air and its contact after landing are timed
 * by the flavor; the run-out picks the cycle up at the phase nearest the jump's last pose. Hand-offs cross-fade the
 * joints' positions over FADE frames.
 *
 * THE PROMISE: the feet leave the floor on the frame the arc leaves it and meet it on the frame the arc returns (the
 * clip's take-off and landing are the flight's ends in every flavor); a cycle whose rate is the ground's keeps a planted
 * foot still in the world.
 *
 *   MOTION_FLAVORS
 *   runJump(R, flavor, { runUp, runOut, fps }) → { flavor, fps, frames: [{ k, time, part, nodes (world, z-up m), root,
 *     speed, held, scale, fade }], beats: { takeoff, land, …frames }, measures }
 *   motionSignature(R, run) → the machine gate's measures
 *
 * Pure and deterministic. A spike: nothing registers.
 */
import { heroLocomotion } from '../../../lib/graph/polygonizer/hero-motion.js';
import { GAITS } from '../../../lib/graph/polygonizer/hero-gaits.js';
import { JUMPS, keyedClip } from '../../../lib/graph/polygonizer/hero-jump.js';
import { rigNodesAt } from '../../../lib/graph/polygonizer/station-loft-rig.js';

const G = 9.81, FADE = 4;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const wrap = (x) => ((x % 1) + 1) % 1;

/**
 * `top` m/s and `tau` s: speed builds as top − (top − v0)·e^(−t/τ). `cadence`: past the sprint's own speed the cycle
 * plays (1 + cadence·(v/v_sprint − 1)) times the ground's rate (0: exactly the ground's, the feet planted), never above
 * FPS/4 strides a second. `ground`: the jump's contacts' time (a number, or 'speed': 7 m/s ÷ the speed, the faster the
 * shorter). `wings`: the gather's (`load`) and the landing's (`absorb`) depth, sink and lean. `flight`: { clip } the
 * clip's own air on earth's gravity; { height, g, hang } a symmetric arc with a float at the top; { up, g, fall } the
 * platform rule's: launched at `up`, rising on `g`, falling on `fall`. `keep`: the speed a landing keeps. `landHold`:
 * frames the landing freezes. `spin`: the air is a tucked spin, not the leap (below). `squash`, `smear` as flavor.mjs.
 *
 * THE SPIN (pinball's air, Sonic's spin ball): out of the take-off the body folds into the forward roll's tuck (hero-jump
 * `rollForward`, its middle key, the shoulder's tilt left out so the ball spins square), turns forward about its hips,
 * and opens back out into the leap's own landing pose. It turns as a ball of the tuck's size rolling at the take-off
 * speed would (speed ÷ π·diameter turns a second), rounded to whole turns so it lands upright, and never faster than
 * SPIN_FRAMES frames a turn so the turn still reads.
 */
export const MOTION_FLAVORS = Object.freeze({
  realistic: { top: 7, tau: 1.0, cadence: 0, ground: 1, wings: { load: 1, absorb: 1 }, flight: { clip: true }, keep: 0.9, landHold: 0, squash: 0, smear: null },
  action: { top: 9, tau: 0.45, cadence: 0, ground: 1, wings: { load: 1.7, absorb: 1.6 }, flight: { height: 1.2, g: G, hang: 0.1 }, keep: 1, landHold: 3, squash: 0.08, smear: 0.2 },
  platformer: { top: 6, tau: 0.08, cadence: 0, ground: 0.6, wings: { load: 1.3, absorb: 1.3 }, flight: { up: 8.5, g: 20, fall: 34 }, keep: 1, landHold: 0, squash: 0.25, smear: null },
  pinball: { top: 20, tau: 1.4, cadence: 0.8, ground: 'speed', wings: { load: 1, absorb: 1 }, flight: { height: 1.0, g: 1.6 * G }, spin: true, keep: 1, landHold: 0, squash: 0.12, smear: 0.06 },
});
const ENDS = ['wristL', 'wristR', 'toeTipL', 'toeTipR', 'headTop'];
const SPIN_FRAMES = 8, TUCK_IN = 0.12, TUCK_OUT = 0.8;   // a turn's fewest frames; the air's shares the tuck closes by and opens from
const ss = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
/** the tuck: the forward roll's middle key, square (no shoulder tilt), in the air (no foot planted) */
function tuckOf(R) {
  const key = JUMPS.rollForward.keys.find((k) => k.t === 0.5); const { rollBody, pitchBody, ...k } = key;
  const n = rigNodesAt(R, keyedClip({ seconds: 1, keys: [{ ...k, t: 0, ground: 0, sink: 0 }, { ...k, t: 1, ground: 0, sink: 0 }] }, R).fn(0.5)).nodes;
  return { nodes: n, diameter: Math.max(...Object.values(n).map((p) => p[2])) - Math.min(...Object.values(n).map((p) => p[2])) };
}
/** every node turned forward by `deg` about the side axis through `at` (the head goes forward and down) */
const pitched = (n, deg, at) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return Object.fromEntries(Object.entries(n).map(([k, p]) => { const y = p[1] - at[1], z = p[2] - at[2]; return [k, [p[0], at[1] + y * c + z * s, at[2] - y * s + z * c]]; })); };
const mixNodes = (a, b, w) => (w <= 0 ? a : w >= 1 ? b : Object.fromEntries(Object.keys(a).map((k) => [k, [0, 1, 2].map((i) => lerp(a[k][i], b[k][i], w))])));
const floorOf = (R) => Math.min(...Object.values(R.legs).flatMap((L) => [R.joints[L.toeBase][2], R.joints[L.toeTip][2]]));

/** the flight a flavor flies: { up (s), hang (s), down (s), height (m), z(t) } */
function flightOf(F, clipAir) {
  const f = F.flight;
  if (f.clip) { const t = clipAir / 2, h = (G * t * t) / 2; return { up: t, hang: 0, down: t, height: h, gUp: G, gDown: G }; }
  if (f.up) { const t = f.up / f.g, h = (f.up * f.up) / (2 * f.g); return { up: t, hang: 0, down: Math.sqrt((2 * h) / f.fall), height: h, gUp: f.g, gDown: f.fall }; }
  const t = Math.sqrt((2 * f.height) / f.g); return { up: t, hang: f.hang ?? 0, down: t, height: f.height, gUp: f.g, gDown: f.g };
}
const zIn = (fl, t) => (t <= fl.up ? fl.height - (fl.gUp * (fl.up - t) ** 2) / 2 : t <= fl.up + fl.hang ? fl.height : Math.max(0, fl.height - (fl.gDown * (t - fl.up - fl.hang) ** 2) / 2));

/** the cycles, once per rig: the jog's and the sprint's clips, travel per stride and natural speed */
const CYCLES = new WeakMap();
function cyclesOf(R) {
  if (CYCLES.has(R)) return CYCLES.get(R);
  const mk = (g) => { const Gt = GAITS[g]; const L = heroLocomotion({ [Gt.motion]: Gt.base }, R, { tilt: Gt.tilt }); return { fn: L.fn, travel: L.travel, v: L.travel / Gt.seconds, stance: L.stance }; };
  const c = { jog: mk('jog'), sprint: mk('sprint') }; CYCLES.set(R, c); return c;
}

/** the jump's keys with the gather and the landing deepened (sink and lean) by the flavor's wings */
function wingedJump(F, off, on) {
  const J = JUMPS.runningJump; const deepest = (ks) => ks.reduce((a, k) => ((k.sink ?? 0) > (a.sink ?? 0) ? k : a), ks[0]);
  const load = deepest(J.keys.filter((k) => k.t < off)), absorb = deepest(J.keys.filter((k) => k.t > on));
  return { ...J, keys: J.keys.map((k) => { const g = k === load ? F.wings.load : k === absorb ? F.wings.absorb : 1; return g === 1 ? k : { ...k, sink: r4(k.sink * g), pose: { ...k.pose, hinge: r4((k.pose.hinge ?? 0) * (1 + (g - 1) / 2)) } }; }) };
}

/**
 * Run up, jump, land, run out, in a flavor. `runUp` metres before the jump may start, `runOut` seconds after it lands.
 */
export function runJump(R, flavor, { runUp = 12, runOut = 0.8, fps = 60 } = {}) {
  const F = MOTION_FLAVORS[flavor]; if (!F) throw new Error(`animation-games: no motion flavor '${flavor}' (have ${Object.keys(MOTION_FLAVORS).join(', ')})`);
  const C = cyclesOf(R), floor = floorOf(R);
  const v0 = C.jog.v;
  const nodesAt = (pose) => rigNodesAt(R, pose).nodes;
  // the cycle at a speed: jog → sprint by speed, the stride's travel blended with it; its rate (strides a second)
  const mixOf = (v) => clamp((v - C.jog.v) / (C.sprint.v - C.jog.v), 0, 1);
  const travelOf = (v) => lerp(C.jog.travel, C.sprint.travel, mixOf(v));
  const rateOf = (v) => Math.min(fps / 4, (v / travelOf(v)) * (1 + F.cadence * Math.max(0, v / C.sprint.v - 1)));
  // a foot is PLANTED where its gait's stance window has it (the dominant gait's; the window's middle 80 %, past the
  // plant weight's easing at its ends)
  const plantedAt = (phase, v) => { const st = (mixOf(v) >= 0.5 ? C.sprint : C.jog).stance; return Object.fromEntries(['L', 'R'].map((S) => { const u = wrap(phase - st[S].t0) / st[S].span; return [S, u > 0.1 && u < 0.9]; })); };
  const cycleNodes = (phase, v) => { const w = mixOf(v); const s = nodesAt(C.sprint.fn(phase)); if (w >= 1) return s; const j = nodesAt(C.jog.fn(phase)); return Object.fromEntries(Object.keys(s).map((k) => [k, [0, 1, 2].map((i) => lerp(j[k][i], s[k][i], w))])); };
  // the jump's own timing and the cycle phases that meet it (the nearest pose, over the sprint's cycle)
  const air0 = keyedClip(JUMPS.runningJump, R, { speed: 0 }).air, Tj = JUMPS.runningJump.seconds;
  const off = air0.takeoff / Tj, on = air0.land / Tj;
  const J = wingedJump(F, off, on);
  const near = (target) => { let best = 0, bd = Infinity; for (let i = 0; i < 240; i++) { const n = nodesAt(C.sprint.fn(i / 240)); const d = ['toeBaseL', 'toeBaseR', 'kneeL', 'kneeR', 'wristL', 'wristR'].reduce((a, k) => a + dist(n[k], target[k]), 0); if (d < bd) { bd = d; best = i / 240; } } return best; };
  const phaseIn = near(nodesAt(keyedClip(J, R, { speed: 0 }).fn(0))), phaseOut = near(nodesAt(keyedClip(J, R, { speed: 0 }).fn(1)));

  const frames = []; let y = 0, v = v0, phase = wrap(phaseIn - 0.5), t = 0;
  const push = (o) => frames.push({ k: frames.length, time: r4(frames.length / fps), ...o });
  const place = (n, root, scale) => {
    let out = n;
    if (scale) {   // squash and stretch about the feet: up and down from the floor, across only above the ankles
      const o = [(n.toeBaseL[0] + n.toeBaseR[0]) / 2, (n.toeBaseL[1] + n.toeBaseR[1]) / 2, floor];
      const ankle = Math.max(n.ankleL[2], n.ankleR[2]), hip = Math.min(n.hipL[2], n.hipR[2]);
      out = Object.fromEntries(Object.entries(n).map(([k, p]) => { const w = clamp((p[2] - ankle) / Math.max(1e-6, hip - ankle), 0, 1); return [k, [o[0] + (p[0] - o[0]) * (1 + (scale[0] - 1) * w), o[1] + (p[1] - o[1]) * (1 + (scale[1] - 1) * w), o[2] + (p[2] - o[2]) * scale[2]]]; }));
    }
    return Object.fromEntries(Object.entries(out).map(([k, p]) => [k, [r4(p[0]), r4(p[1] + root[1]), r4(p[2] + root[2])]]));
  };

  // ── the run-up: speed builds, the cycle keeps up; the jump waits for its phase once the run-up is covered ──
  for (;;) {
    push({ part: 'run', nodes: place(cycleNodes(phase, v), [0, y, 0]), root: [0, r4(y), 0], speed: r4(v), phase: r4(phase), rate: r4(rateOf(v)), mix: r4(mixOf(v)), planted: plantedAt(phase, v) });
    const dt = 1 / fps; t += dt;
    const vNext = F.top - (F.top - v0) * Math.exp(-t / F.tau);
    y += ((v + vNext) / 2) * dt; v = vNext;
    const p1 = phase + rateOf(v) * dt;
    if (y >= runUp && (wrap(phaseIn - phase) < p1 - phase)) { phase = wrap(p1); break; }   // the phase passes the jump's
    phase = wrap(p1);
    if (frames.length > fps * 30) throw new Error('animation-games: the run-up never met the jump');
  }

  // ── the jump: its contact before take-off, the flight, its contact after landing ──
  const vT = v, fl = flightOf(F, (on - off) * Tj);
  const mIn = F.ground === 'speed' ? clamp(7 / vT, 0.35, 1) : F.ground;
  const vL = vT * F.keep, mOut = F.ground === 'speed' ? clamp(7 / vL, 0.35, 1) : F.ground;
  const clipIn = keyedClip(J, R, { speed: vT * mIn }), clipOut = keyedClip(J, R, { speed: vL * mOut });
  const nIn = Math.max(1, Math.round(off * Tj * mIn * fps)), nAir = Math.max(2, Math.round((fl.up + fl.hang + fl.down) * fps)), nOut = Math.max(1, Math.round((1 - on) * Tj * mOut * fps));
  const airSec = nAir / fps, scaleAir = airSec / (fl.up + fl.hang + fl.down);   // the arc fitted to whole frames
  const start = frames.length, fadeFrom = (k) => (k < FADE ? { w: (k + 1) / (FADE + 1) } : null);
  const squashAt = (k, beats) => { if (!F.squash) return null; let s = 0; for (const b of beats) s += b.k * F.squash * Math.exp(-(((k - b.at) / fps / 0.05) ** 2)); if (Math.abs(s) < 1e-4) return null; const z = 1 + s, xy = 1 / Math.sqrt(z); return [r4(xy), r4(xy), r4(z)]; };
  const kOff = start + nIn, kLand = kOff + nAir;
  const sqBeats = [{ at: kOff - Math.round(0.06 * fps), k: -0.5 }, { at: kOff, k: 1 }, { at: kLand, k: -1 }];
  let runPhase = phase, runV = vT;
  for (let k = 0; k < nIn; k++) {   // the gather and the push: on the floor, the body carried on at the take-off speed
    const s = (off * k) / nIn; const n = nodesAt(clipIn.fn(s));
    const f = fadeFrom(k); let blended = n;
    if (f) { runPhase = wrap(runPhase + rateOf(runV) / fps); const c = cycleNodes(runPhase, runV); blended = Object.fromEntries(Object.keys(n).map((j) => [j, [0, 1, 2].map((i) => lerp(c[j][i], n[j][i], f.w))])); }
    const sc = squashAt(start + k, sqBeats);
    push({ part: 'takeoff', nodes: place(blended, [0, y, 0], sc), root: [0, r4(y), 0], speed: r4(vT), share: r4(s), scale: sc, fade: !!f });
    y += vT / fps;
  }
  // the spin's turns: a ball of the tuck rolling at the take-off speed, whole turns, none quicker than SPIN_FRAMES
  const tuck = F.spin ? tuckOf(R) : null;
  const spinFrames = (TUCK_OUT - TUCK_IN) * nAir;
  const turns = tuck ? clamp(Math.round(((vT / (Math.PI * tuck.diameter)) * airSec)), 1, Math.max(1, Math.floor(spinFrames / SPIN_FRAMES))) : 0;
  for (let k = 0; k < nAir; k++) {   // the flight: the clip's air stretched to the flavor's arc (or the spin flown along it)
    const s = off + ((on - off) * k) / nAir, z = zIn(fl, (k / fps) / scaleAir); const sc = squashAt(kOff + k, sqBeats);
    let n = nodesAt(clipIn.fn(s)), spin = 0;
    if (tuck) {
      const u = k / nAir, w = Math.min(ss(u / TUCK_IN), 1 - ss((u - TUCK_OUT) / (1 - TUCK_OUT)));
      spin = 360 * turns * ss((u - TUCK_IN / 2) / (TUCK_OUT - TUCK_IN / 2));
      const m = mixNodes(n, tuck.nodes, w); n = pitched(m, spin, m.navel);
    }
    push({ part: 'air', nodes: place(n, [0, y, z], sc), root: [0, r4(y), r4(z)], speed: r4(vT), share: r4(s), scale: sc, ...(tuck ? { spin: r4(spin) } : {}) });
    y += vT / fps;
  }
  const yTake = frames[kOff].root[1];
  for (let k = 0; k < F.landHold; k++) push({ ...frames.at(-1), k: frames.length, time: r4(frames.length / fps), part: 'land', nodes: place(nodesAt(clipOut.fn(on)), [0, y, 0], squashAt(kLand, sqBeats)), root: [0, r4(y), 0], speed: 0, share: on, held: true, scale: squashAt(kLand, sqBeats) });
  const kAfter = frames.length;
  for (let k = 0; k < nOut; k++) {   // the landing: back on the floor, the speed the landing kept
    const s = on + ((1 - on) * k) / nOut; const sc = squashAt(kLand + k, sqBeats);
    push({ part: 'land', nodes: place(nodesAt(clipOut.fn(s)), [0, y, 0], sc), root: [0, r4(y), 0], speed: r4(vL), share: r4(s), scale: sc });
    y += vL / fps;
  }
  // ── the run-out: the cycle picked up where the jump left the feet, speed building again ──
  const endPose = nodesAt(clipOut.fn(1)); phase = phaseOut; v = vL; let tOut = 0;
  const vFrom = vL, n0 = frames.length;
  for (let k = 0; k < Math.round(runOut * fps); k++) {
    const c = cycleNodes(phase, v); const w = k < FADE ? (k + 1) / (FADE + 1) : 1;
    const n = w < 1 ? Object.fromEntries(Object.keys(c).map((j) => [j, [0, 1, 2].map((i) => lerp(endPose[j][i], c[j][i], w))])) : c;
    push({ part: 'run', nodes: place(n, [0, y, 0]), root: [0, r4(y), 0], speed: r4(v), phase: r4(phase), rate: r4(rateOf(v)), mix: r4(mixOf(v)), fade: w < 1, planted: plantedAt(phase, v) });
    tOut += 1 / fps; const vNext = F.top - (F.top - vFrom) * Math.exp(-tOut / F.tau);
    y += ((v + vNext) / 2) / fps; v = vNext; phase = wrap(phase + rateOf(v) / fps);
  }
  const beats = { takeoff: kOff, land: kLand, jump: start, runOut: n0 };
  // the clip's own feet at its landing (its toe rides TOUCH over the floor until its contact is whole): the promise's mark
  const own = nodesAt(keyedClip(JUMPS.runningJump, R, { speed: 0 }).fn(on)), clipLandToes = Math.min(own.toeBaseL[2], own.toeBaseR[2]) - floor;
  return { flavor, fps, frames, beats, floor, clipLandToes: r4(clipLandToes),
    jump: { takeoffSpeed: r4(vT), landSpeed: r4(vL), air: r4(airSec), height: r4(fl.height), length: r4(frames[kLand].root[1] - yTake), upDown: r4(fl.up / fl.down), contactIn: r4(nIn / fps), contactOut: r4(nOut / fps), hang: fl.hang,
      ...(tuck ? { turns, framesPerTurn: r4(spinFrames / turns), tuck: r4(tuck.diameter), ballTurns: r4((vT / (Math.PI * tuck.diameter)) * airSec) } : {}) },
    cycle: { jog: r4(C.jog.v), sprint: r4(C.sprint.v), travel: r4(C.sprint.travel) } };
}

/**
 * The machine gate's measures: the run (seconds to 90 % of top speed from the jog, the top reached, strides a second and
 * frames a stride at the take-off speed, the planted feet's worst slide in the world on the run's frames outside the
 * cross-fades, m/s, on one gait and while the jog blends into the sprint, and the frames that blend take; how much faster than the ground the stride sweeps its feet at take-off), the gather (the hips'
 * lowest in the take-off's contact), the spin (its turns, frames a turn, the turns a ball of the tuck would roll, how
 * far it has turned on the frame before landing, and whether the head is up on the take-off and landing frames), the jump (its own), the landing (the root's height on its frame, the frame before, the feet's height
 * there), holds, squash, smears.
 */
export function motionSignature(R, run) {
  const F = MOTION_FLAVORS[run.flavor], fr = run.frames, fps = run.fps;
  const top90 = fr.findIndex((f) => f.speed >= 0.9 * F.top);
  const atT = fr[run.beats.jump - 1];
  // a planted foot (its gait's stance on two frames running, outside the cross-fades): its slide in the world between
  // them, on one gait (`skate`) and while the jog blends into the sprint (`blendSkate`: the mix between 0 and 1)
  const sk = { one: { v: 0 }, blend: { v: 0 } };
  for (let i = 1; i < fr.length; i++) {
    if (fr[i].part !== 'run' || fr[i - 1].part !== 'run' || fr[i].fade || fr[i - 1].fade) continue;
    const pure = (m) => fr[i].mix === m && fr[i - 1].mix === m, which = pure(0) || pure(1) ? sk.one : sk.blend;
    for (const S of ['L', 'R']) { if (!fr[i].planted[S] || !fr[i - 1].planted[S]) continue; const a = fr[i - 1].nodes[`toeBase${S}`], b = fr[i].nodes[`toeBase${S}`]; which.v = Math.max(which.v, Math.hypot(b[0] - a[0], b[1] - a[1]) * fps); }
  }
  const blendFrames = fr.filter((f) => f.part === 'run' && f.mix > 0 && f.mix < 1).length;
  // a smear: a hand, a foot or the head jumping further than the flavor's `smear` in a frame, against the body (the
  // root's own travel taken out: a body crossing the screen is not a smear)
  const rel = (f, e) => [f.nodes[e][0] - f.root[0], f.nodes[e][1] - f.root[1], f.nodes[e][2] - f.root[2]];
  const planted = (f, e) => /^toe/.test(e) && f.planted?.[e.slice(-1)];   // a planted foot sweeping back under the body is not a smear
  const smears = F.smear ? fr.slice(1).reduce((a, f, i) => a + ENDS.filter((e) => !planted(f, e) && dist(rel(f, e), rel(fr[i], e)) > F.smear).length, 0) : 0;
  // the gather: the hips' lowest over the floor in the take-off's contact; the outrun: how much faster the stride's feet
  // sweep back than the ground goes by at take-off (0: planted; the legs a wheel past it)
  const gather = Math.min(...fr.filter((f) => f.part === 'takeoff').map((f) => Math.min(f.nodes.hipL[2], f.nodes.hipR[2]) - run.floor));
  const outrun = atT.rate * (atT.mix >= 1 ? run.cycle.travel : NaN) - atT.speed;
  const L = fr[run.beats.land];
  return {
    seconds: r4(fr.length / fps), frames: fr.length, toTop90: top90 < 0 ? null : r4(top90 / fps), takeoffSpeed: run.jump.takeoffSpeed,
    stridesPerSecond: atT.rate, framesPerStride: r4(fps / atT.rate), outrun: Math.round(outrun * 100) / 100 + 0, gather: r4(gather), skate: r4(sk.one.v), blendSkate: r4(sk.blend.v), blendFrames,
    air: run.jump.air, height: run.jump.height, length: run.jump.length, upDown: run.jump.upDown, contactIn: run.jump.contactIn, landSpeed: run.jump.landSpeed,
    landRoot: L.root[2], beforeLandRoot: fr[run.beats.land - 1].root[2], landToes: r4(Math.min(L.nodes.toeBaseL[2], L.nodes.toeBaseR[2]) - run.floor), clipLandToes: run.clipLandToes,
    turns: run.jump.turns ?? 0, framesPerTurn: run.jump.framesPerTurn ?? null, ballTurns: run.jump.ballTurns ?? null,
    spinEnd: fr[run.beats.land - 1].spin ?? 0, upright: ['takeoff', 'land'].every((b) => { const n = fr[run.beats[b]].nodes; return n.headTop[2] > n.navel[2] + 0.3; }),
    held: fr.filter((f) => f.held).length, squash: r4(Math.max(0, ...fr.filter((f) => f.scale).map((f) => Math.abs(f.scale[2] - 1)))), smears,
  };
}
