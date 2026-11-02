/**
 * body — the actor's BODY TAKE: a read's gesture cues (interpret.js) played on the hero's rig, on the read's clock, as
 * the body plays them: each gesture prepared, struck on its word, held and let go, the joints of a chain arriving in
 * turn, the stand living between them; the style's body dials (style.js `body`, `time`) shaping all of it.
 *
 *   actBody(read, { R, base?, style?, seed?, walks?, pole? }) → the take: { seconds, base, tracks, idle, gestures, dropped,
 *     walk? } (`walks`: the crosses a scene blocks, scene.js, each played as the hero's walk cycle phased by the ground
 *     it covers, blended in and out over WALK_BLEND, the head and neck the act's; an arm gesture on one is let go)
 *     R       the rig (station-loft-rig.js validateRig); `base` the stand (pose words, hero-gesture.js GESTURE_PRESETS)
 *     tracks  the gestures' channels, absolute: { <path>: [{ t, v }] } (tracks.js paths), eased key to key, the stand's
 *             value where no gesture moves them
 *     idle    the stand's life, added over everything: the trunk's carriage shifting every few seconds
 *     gestures each placed: { word, cause, t (the cue), paths (its channels), peak (their values at the apex), side, start, apex, end, amp, chained? }; `dropped` the cues too
 *             close to the one before on the same limbs to be done
 *   poseAt(take, t) → pose words (rigNodesAt reads them) at `t` seconds
 *   actClip(take) → the take as a one-shot clip: fn(u) → pose, `keys` (30 a second) and `once` (station-loft-rig.js
 *     packLayeredRig samples it as it samples a gait)
 *
 * A GESTURE: its apex (the furthest the limb goes) `LEAD` seconds before its cue (the stroke lands on or just before its
 * word: the speech-gesture synchrony); prepared before it, held, and let go after, the preparation and the let-go the
 * feel flavor's (`time`) but never so quick that a joint turns past its speed (tracks.js SPEED). The amplitude is the
 * style's `exaggerate` with a seeded variation (no two alike); `anticipation` winds the limb against its stroke before
 * it goes; `followThrough` carries it a little past its stroke at the apex and spaces the joints of a chain (the
 * shoulder, then the elbow, the wrist, the fingers). Two gestures on the same limbs: the second goes on from the
 * first's hold where it starts before the first has let go, and is dropped where its apex falls within `GAP` of the
 * first's.
 *
 * No style: a neutral body (NEUTRAL). Seeded (its own stream), pure and deterministic.
 */
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { GESTURES, strokeOf, armsOf } from './gestures.js';
import { styleOf } from './style.js';
import { flatten, unflatten, trackAt, jointOf, clampTo, SPEED, FPS } from './tracks.js';
import { motionPlan, stampHeroMotion, heroLocomotion } from '../polygonizer/hero-motion.js';

export { FPS };
/** the body of a read with no style: the gestures done plainly */
export const NEUTRAL = Object.freeze({ exaggerate: 1, anticipation: 0.2, followThrough: 1, idle: 1, stillness: 0.5, hold: 0.15 });
/** how long each part of a gesture takes at the realistic flavor (s); `arrive` the stroke's last stretch into the apex,
 * `settle` the way back from the apex's overshoot */
export const TIMING = Object.freeze({ prep: 0.38, retract: 0.5, minHold: 0.12, arrive: 0.08, settle: 0.12 });
export const FLAVOR_TIME = Object.freeze({ realistic: 1, action: 0.75, platformer: 0.6, pinball: 0.5 });
/** the apex's lead on its word (s), and the least gap between two apexes on the same limbs (s) */
export const LEAD = 0.12, GAP = 0.55;
/** the chain's spacing (s at followThrough 1): each joint arrives this much after the shoulder */
export const CHAIN = Object.freeze({ sh: 0, elbow: 0.03, wrist: 0.05, fingers: 0.06, head: 0.04, spine: 0, neck: 0.03 });
/** the stand's life: a shift every `every` seconds (seeded within it, the stiller the style the rarer), of `pelvis`
 * degrees, a sideways bend of the spine and a roll of the head, eased over `ease` seconds */
export const IDLE = Object.freeze({ every: [2.6, 4.4], pelvis: 3, sideBend: 0.06, roll: 1.5, ease: 0.9 });
/** an arm's stroke scaled by the variation alone, the seeded spread mapped onto this (its solved place, a little short or
 * past; never a clamp, so no two strokes coincide) */
export const ARM_VARY = Object.freeze([0.88, 1.05]);
/** the seeded spread of a gesture's amplitude about the style's */
export const VARY = Object.freeze([0.82, 1.12]);
/** smoothstep peaks at 1.5× its mean speed: a move of d degrees over s seconds turns at most 1.5 d / s */
const PEAK = 1.5;
/** the share of the preparation the limb travels in, after winding up against its stroke */
const WIND = 0.6;

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const group = (path) => { const m = /^(sh|elbow|wrist|fingers)([LR])/.exec(path); return m ? `arm${m[2]}` : path.split('.')[0]; };
const chainOf = (path) => CHAIN[jointOf(path)] ?? 0;
/** the least time a set of channel moves takes, each joint within its speed: { <path>: degrees } → s */
const leastTime = (moves) => Math.max(0, ...Object.entries(moves).map(([p, d]) => (PEAK * Math.abs(d)) / (SPEED[jointOf(p)] ?? 1e9)));

/** The read's body take (see the header) */
/** a cross's walk on a rig: the hero's own walk cycle (hero-motion.js, its silhouette's `pole`), cached per rig */
const gaits = new WeakMap();
export function walkOn(R, pole = null) {
  const memo = gaits.get(R) ?? new Map(); gaits.set(R, memo);
  if (!memo.has(pole)) { const W = motionPlan(stampHeroMotion({ walk: true }, { pole })).walk; memo.set(pole, heroLocomotion(W.spec, R, { tilt: W.tilt })); }
  return memo.get(pole);
}
/** the channels of the legs and of what carries them (switched whole between the stand and the walk) */
const LEGS = /^(hip|knee|ankle|toe|heel|feet|crouch|sink|support|stance|stagger|lift|pelvis|shift|facing)/;
/** how long a walk takes to come in from the stand and to go back to it (s) */
export const WALK_BLEND = 0.3;
const inWalk = (walks, t, pad = 0) => (walks ?? []).find((w) => t >= w.start - pad && t <= w.end + pad);

export function actBody(read, { R, base = {}, style, seed = 1, walks = null, pole = null } = {}) {
  const S = style === undefined || style === null ? null : styleOf(style), B = S ? S.body : NEUTRAL, f = FLAVOR_TIME[S?.time ?? 'realistic'] ?? 1;
  const rnd = mulberry32(((seed >>> 0) * 104729 + 7) >>> 0), seconds = read.seconds;
  const { num: baseNum, words: baseWords } = flatten(base);
  const tracks = {}, placed = [], dropped = [], busy = {};
  const push = (path, t, v) => { (tracks[path] ??= []).push({ t: r4(t), v: r4(v) }); };
  const restOf = (path) => baseNum[path] ?? 0;
  const now = (path, t) => trackAt(tracks[path], t, restOf(path));

  for (const cue of [...read.body].sort((a, b) => a.t - b.t)) {
    const G = GESTURES[cue.gesture];
    if (!G) { dropped.push({ ...cue, why: 'no such gesture on the body' }); continue; }
    // (a walk has the arms: a gesture of the arms on a cross is let go; the head's still nods)
    if (G.arms && inWalk(walks, cue.t, WALK_BLEND + TIMING.prep)) { dropped.push({ ...cue, why: 'the arms are walking' }); continue; }
    // (a one-handed gesture is the right hand's, now and then the left's)
    const arms = armsOf(cue.gesture), side = arms.length === 1 && rnd() < 0.3 ? 'L' : 'R';
    const { num } = flatten(strokeOf(R, cue.gesture, side, base).channels);
    const paths = Object.keys(num), groups = [...new Set(paths.map(group))];
    const apex = Math.max(0.2, cue.t - LEAD);
    // (the limbs it needs: free, freed by the one before letting go early (chained), or too soon after it (dropped))
    const before = groups.map((g) => busy[g]).filter(Boolean).sort((a, b) => b.apex - a.apex)[0];
    if (before && apex - before.apex < GAP) { dropped.push({ ...cue, why: `within ${GAP} s of the ${before.word} before it` }); continue; }
    const vary = VARY[0] + (VARY[1] - VARY[0]) * rnd(), amp = B.exaggerate * vary, anti = B.anticipation, ft = B.followThrough, over = 1 + 0.1 * ft * Math.max(1, B.exaggerate);
    // (the goal: the stroke scaled by the amplitude, kept in each channel's range with the overshoot's room. An arm's
    // stroke is the place its solve found: past its solved place it would be another arm, not a bigger gesture (a shoulder's
    // roll scaled is not a hand further out), so the arm keeps its stroke and the style's size goes to its overshoot,
    // its head and its trunk)
    const armAmp = Math.min(1, B.exaggerate) * (ARM_VARY[0] + ((ARM_VARY[1] - ARM_VARY[0]) * (vary - VARY[0])) / (VARY[1] - VARY[0])), ampOf = (p) => (/^(sh|elbow|wrist|fingers)[LR]/.test(p) ? armAmp : amp);
    const goal = Object.fromEntries(paths.map((p) => { const r = restOf(p), g = clampTo(p, r + ampOf(p) * (num[p] - r)); return [p, r + (clampTo(p, r + over * (g - r)) - r) / over]; }));
    // (the timings: the flavor's, stretched where a joint would turn past its speed)
    const chained0 = !!before && apex - TIMING.prep * f < before.end;
    // (the going is the preparation's last WIND share after the wind-up, the stroke's arrival at its end)
    const prep = Math.max(TIMING.prep * f, ((TIMING.arrive + leastTime(Object.fromEntries(paths.map((p) => [p, (1 + 0.2 * anti) * (goal[p] - (chained0 ? now(p, apex - TIMING.prep * f) : restOf(p)))])))) / WIND) * 1.05);
    const retract = Math.max(TIMING.retract * f, leastTime(Object.fromEntries(paths.map((p) => [p, goal[p] - restOf(p)]))) * 1.05);
    const hold = Math.max(TIMING.minHold, B.hold), inner = G.beats ?? [], last = inner.length ? inner.at(-1).at * f : 0;
    const start = apex - prep, end = Math.min(seconds, apex + TIMING.settle + last + hold + retract), chained = !!before && start < before.end;
    for (const p of paths) {
      const rest = restOf(p), d = goal[p] - rest, lag = chainOf(p) * ft;
      // (chained: on from the last gesture's hold, its let-go dropped; else from the stand, wound against the stroke)
      if (chained && tracks[p]?.length) { const k = tracks[p]; while (k.length && k.at(-1).t > start + lag) k.pop(); }
      else { push(p, start + lag * 0.5, rest); if (anti > 0) push(p, start + prep * (1 - WIND) + lag, rest - anti * 0.2 * d); }
      push(p, apex - TIMING.arrive + lag, rest + d);
      push(p, apex + lag, rest + over * d);
      push(p, apex + TIMING.settle + lag, rest + d);
      for (const b of inner) push(p, apex + TIMING.settle + lag + b.at * f, rest + b.k * d);
      push(p, apex + TIMING.settle + lag + last + hold, rest + (inner.length ? inner.at(-1).k : 1) * d);
      push(p, Math.min(seconds, end + lag), rest);
    }
    const peak = Object.fromEntries(paths.map((p) => [p, r4(restOf(p) + over * (goal[p] - restOf(p)))]));
    const P = { word: cue.gesture, cause: cue.cause, t: cue.t, paths, peak, side: arms.length === 1 ? side : arms.length ? 'both' : null, start: r4(start), apex: r4(apex), end: r4(end), amp: r4(amp), ...(chained ? { chained: true } : {}) };
    placed.push(P);
    for (const g of groups) busy[g] = P;
  }
  for (const k of Object.values(tracks)) k.sort((a, b) => a.t - b.t);

  // ─── the stand's life: a shift every few seconds, the other way each time, smaller and rarer the stiller the style ─
  const idle = {}, a = B.idle * (1 - 0.7 * B.stillness);
  if (a > 0) {
    let t = 0.4, sign = rnd() < 0.5 ? 1 : -1;
    const put = (p, at, v) => (idle[p] ??= []).push({ t: r4(at), v: r4(v) });
    for (const p of ['pelvis', 'spine.sideBend', 'head.roll']) put(p, 0, 0);
    while (t < seconds - IDLE.ease) {
      const k = sign * a * (0.7 + 0.3 * rnd());
      for (const [p, amt] of [['pelvis', IDLE.pelvis], ['spine.sideBend', IDLE.sideBend], ['head.roll', IDLE.roll]]) { put(p, t, idle[p].at(-1).v); put(p, t + IDLE.ease, k * amt); }
      t += IDLE.ease + (IDLE.every[0] + (IDLE.every[1] - IDLE.every[0]) * rnd()) / Math.max(0.25, B.idle * (1 - 0.5 * B.stillness));
      sign = -sign;
    }
  }
  // (the crosses: the walk cycle over each, phased by the ground it covers, so the feet keep their place)
  const walk = walks?.length ? { cycle: walkOn(R, pole), walks: walks.map((w) => ({ ...w })) } : null;
  return { seconds, base: { num: baseNum, words: baseWords }, tracks, idle, gestures: placed, dropped, ...(walk ? { walk } : {}) };
}

/** the walk's weight at t (0 off a cross, 1 within it, eased in and out over WALK_BLEND) and its pose, or null */
function walkAt(take, t) {
  const W = take.walk; if (!W) return null;
  const w = inWalk(W.walks, t, WALK_BLEND); if (!w) return null;
  const smooth = (u) => u * u * (3 - 2 * u), k = t < w.start ? smooth((t - (w.start - WALK_BLEND)) / WALK_BLEND) : t > w.end ? smooth(((w.end + WALK_BLEND) - t) / WALK_BLEND) : 1;
  const speed = w.distance / Math.max(1e-6, w.end - w.start), ground = Math.max(0, Math.min(w.end, t) - w.start) * speed;
  return { k, pose: W.cycle.fn((ground / W.cycle.travel) % 1) };
}

/** The pose at t seconds: the stand, the gestures' channels over it, the idle added */
export function poseAt(take, t) {
  const num = { ...take.base.num };
  for (const [p, k] of Object.entries(take.tracks)) num[p] = trackAt(k, t, num[p] ?? 0);
  for (const [p, k] of Object.entries(take.idle)) num[p] = (num[p] ?? 0) + trackAt(k, t, 0);
  // (a cross: the walk's channels blended over the act's, all but the head and neck, which keep the act's nods and looks)
  const W = walkAt(take, t);
  if (!W) return unflatten(num, take.base.words);
  // (the legs: the walk's own words (its feet's targets, no weight leg) once it is more than half in: a snap mid-blend)
  // (the legs and what carries them switch whole at mid-blend: a leg half the stand's and half the walk's can be asked to
  // reach a planted toe past its length; the trunk and arms blend)
  const { num: wn, words: ww } = flatten(W.pose), walking = W.k > 0.5, words = walking ? ww : take.base.words;
  for (const p of new Set([...Object.keys(wn), ...Object.keys(num)])) {
    if (/^(head|neck)\b/.test(p)) continue;
    if (LEGS.test(p)) { if (walking) num[p] = wn[p] ?? 0; else if (!(p in num)) num[p] = 0; continue; }
    num[p] = (num[p] ?? 0) + ((wn[p] ?? 0) - (num[p] ?? 0)) * W.k;
  }
  if (walking) for (const p of Object.keys(num)) if (LEGS.test(p) && !(p in wn)) delete num[p];
  return unflatten(num, words);
}

/** The take as a one-shot clip, 30 keys a second */
export function actClip(take) {
  const fn = (u) => poseAt(take, u * take.seconds);
  fn.keys = Math.max(2, Math.round(take.seconds * FPS) + 1);
  fn.once = true;
  return fn;
}
