/**
 * animation-games — FLAVOR: one take (a clip the hero library already solves), rendered for the kind of game it plays in.
 *
 * The same poses are selected for every game; the flavor decides how they PLAY: how long each part of the action takes,
 * how far the body winds up and carries through around the poses it must hit, whether the frame freezes on a blow, how
 * the body squashes and stretches, how fast the take plays and whether its fastest frames are smeared, and how much force a blow hands on
 * (the "powerscale": the victim's change of speed against what a body on earth would give it).
 *
 *   realistic    the body on earth: the clip as its solver made it, at its own pace, no holds, a blow's momentum real
 *   action       force made visible: a deep wind-up held long enough to read, a snap into contact, both bodies frozen on
 *                the blow for as long as it was heavy, the victim thrown
 *   platformer   movement first: quick starts, squash and stretch on every take-off and landing, a blow is a boop (the
 *                victim squashes and is pushed, the striker bounces back)
 *   pinball      speed: the whole take plays faster the faster the body travels (a new pose every frame, the take's
 *                content passing in a fraction of its time), smeared, a hit ricochets out with more speed than it came in
 *                with (racing, Sonic, pinball)
 *
 * THE PROMISE. A flavor bends time and the wings of an action, never its point: the CONTACT pose (the hand on its target,
 * the feet leaving and meeting the floor) is the same pose in every flavor. Gains act on a key's distance from the ready
 * pose and are 1 at every promised beat, so the wind-up and the follow-through grow while contact stays put.
 *
 * A TAKE is a keyed clip (hero-jump `keyedClip` shape) plus its BEATS, the moments its solver already knows:
 *   strikeTake   ready → load → contact (the blow dealt) → follow → ready        (hero-strike.js)
 *   jumpTake     ready → load → takeoff → land → absorb → ready                   (hero-jump.js)
 *   reactTake    blow → peak (the blow taken) → release → ready                   (hero-react.js)
 * Each span between beats has a ROLE (wind, act, air, after, settle) a flavor times.
 *
 *   FLAVORS, FLAVOR_NAMES
 *   strikeTake(name, R) · jumpTake(name, R) · reactTake(name, R, { gain })
 *   render(take, flavor, R, { fps, blowDv, speed }) → { flavor, seconds, fps, rate, frames: [{ k, time, src, pose, held, scale }], beats, hitstop }
 *   nodesOf(R, rendered) → per frame the rig's nodes (z-up metres), smears marked
 *   blow(strike, flavor, R, { attackerKg, victimKg, speed }) → { handSpeed, dv, powerscale, hitstop, knockback, bounce, reactGain }
 *   exchange(strike, react, flavor, R) → the attacker's and the victim's renders on one clock, the blow between them
 *   signature(R, rendered) → the machine gate's measures
 *   GENRE_FLAVOR, flavorFor({ flavor?, genre?, says?, words? }) → { flavor, from, why }: what a game's genre asks for
 *
 * Pure and deterministic: no Math.random, no Date. A spike: nothing registers, nothing is listed.
 */
import { keyedClip, JUMPS } from '../../../lib/graph/polygonizer/hero-jump.js';
import { heroStrike, STRIKES } from '../../../lib/graph/polygonizer/hero-strike.js';
import { REACTS } from '../../../lib/graph/polygonizer/hero-react.js';
import { rigNodesAt } from '../../../lib/graph/polygonizer/station-loft-rig.js';
import { GENRES } from '../../../lib/graph/gameworld/intent.js';

const G = 9.81;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * The flavors. `time` multiplies each role's span; `gain` the wind-up's and the follow-through's distance from ready
 * (contact, take-off and landing are always 1: the promise); `windHold` seconds the wind-up holds at its deepest;
 * `hitstop` how the frame freezes on a blow (frames at 60 fps: `base` + `perMs` per m/s the victim is given, at most
 * `max`); `rate` (pinball) the whole take's playback tied to the body's travel speed: `ref` m/s plays it at its own
 * pace, faster plays it that much faster, never past `max` times; `squash` the volume-kept squash and stretch at the beats; `smear` metres a hand or
 * foot must jump in one frame to be smeared; `force` what a blow hands on.
 */
export const FLAVORS = Object.freeze({
  realistic: {
    says: 'the body on earth: the clip as its solver made it, at its own pace, no holds, a blow\'s momentum real',
    time: { wind: 1, act: 1, air: 1, after: 1, settle: 1 }, gain: { wind: 1, after: 1 }, windHold: 0,
    hitstop: null, squash: 0, smear: null,
    force: { model: 'momentum', gain: 1 },
  },
  action: {
    says: 'force made visible: a deep wind-up held to read, a snap into contact, both bodies frozen on the blow, the victim thrown',
    time: { wind: 1.5, act: 0.45, air: 1, after: 1.4, settle: 0.8 }, gain: { wind: 1.8, after: 1.5 }, windHold: 0.07,
    hitstop: { base: 4, perMs: 0.6, max: 14 }, squash: 0.06, smear: 0.09,
    force: { model: 'momentum', gain: 12, lift: 18 },
  },
  platformer: {
    says: 'movement first: quick starts, squash and stretch on every take-off and landing, a blow is a boop',
    time: { wind: 0.55, act: 0.7, air: 1, after: 0.6, settle: 0.6 }, gain: { wind: 1.25, after: 1.2 }, windHold: 0,
    hitstop: { base: 2, perMs: 0, max: 2 }, squash: 0.22, smear: null,
    force: { model: 'boop', push: 2.5, bounce: 3 },
  },
  pinball: {
    says: 'speed: the take plays faster the faster the body travels, a new pose every frame, smeared, a hit ricochets out faster',
    time: { wind: 1, act: 1, air: 1, after: 1, settle: 1 }, gain: { wind: 1, after: 1 }, windHold: 0,
    rate: { ref: 4, speed: 10, max: 5 }, hitstop: null, squash: 0.1, smear: 0.05,
    force: { model: 'ricochet', restitution: 1.3 },
  },
});
export const FLAVOR_NAMES = Object.freeze(Object.keys(FLAVORS));
const flavorOf = (f) => (typeof f === 'string' ? FLAVORS[f] && { name: f, ...FLAVORS[f] } : f) || (() => { throw new Error(`animation-games: no flavor '${f}' (have ${FLAVOR_NAMES.join(', ')})`); })();

// ─── takes ─────────────────────────────────────────────────────────────────
/** a strike out of the hero library: its solved keys and its timing's beats */
export function strikeTake(name, R) {
  const S = heroStrike(name, R); const tm = STRIKES[name.replace(/Left$/, '')].timing;
  return { kind: 'strike', name, seconds: S.seconds, keys: S.keys, hand: S.hand, contactAt: S.contact.at,
    beats: [{ id: 'ready', at: 0 }, { id: 'load', at: tm.load, role: 'wind' }, { id: 'contact', at: tm.contact, role: 'act', promise: true, deals: true },
      { id: 'follow', at: tm.follow, role: 'after' }, { id: 'ready', at: 1, role: 'settle' }] };
}

/** a jump: its keys, the take-off and the landing its clip measures, the deepest crouch before and after */
export function jumpTake(name, R) {
  const J = JUMPS[name]; if (!J) throw new Error(`animation-games: no jump '${name}'`);
  const C = keyedClip(J, R); const off = C.air.takeoff / C.seconds, on = C.air.land / C.seconds;
  const deepest = (keys) => keys.reduce((a, k) => ((k.sink ?? 0) > (a.sink ?? 0) ? k : a), keys[0]);
  const load = deepest(J.keys.filter((k) => k.t < off)).t, absorb = deepest(J.keys.filter((k) => k.t > on)).t;
  return { kind: 'jump', name, seconds: C.seconds, keys: J.keys, air: C.air,
    beats: [{ id: 'ready', at: 0 }, { id: 'load', at: load, role: 'wind' }, { id: 'takeoff', at: r4(off), role: 'act', promise: true, squash: 1 },
      { id: 'land', at: r4(on), role: 'air', promise: true, squash: -1 }, { id: 'absorb', at: absorb, role: 'after' }, { id: 'ready', at: 1, role: 'settle' }] };
}

/** a reaction: the blow lands at 0, the peak (its keys' first) is the blow taken, the hold gives back from `release` */
export function reactTake(name, R, { gain = 1 } = {}) {
  const J = REACTS[name]; if (!J) throw new Error(`animation-games: no reaction '${name}'`);
  return { kind: 'react', name, seconds: J.seconds, keys: J.keys, reactGain: gain,
    beats: [{ id: 'blow', at: 0 }, { id: 'peak', at: J.keys[1].t, role: 'act', takes: true, squash: -1 }, { id: 'release', at: J.keys[2].t, role: 'after' }, { id: 'ready', at: 1, role: 'settle' }] };
}

// ─── the key layer: the wind-up and the follow-through grown about ready ───
function flatten(o, pre = '', out = {}) { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object') flatten(v, `${pre}${k}.`, out); else if (Number.isFinite(v)) out[`${pre}${k}`] = v; } return out; }
function unflatten(m) { const o = {}; for (const [p, v] of Object.entries(m)) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => { c = c[k] || (c[k] = {}); }); c[ks[ks.length - 1]] = v; } return o; }
const FIXED = /^(t|ground[LR]?)$/;   // a key's time and its feet's contact are the take's own, never grown

/** the gain at each beat: 1 at a promise and at rest, the flavor's at a wind-up or a follow-through, the blow's at a reaction */
function beatGain(b, F, take) {
  if (b.promise || b.id === 'ready' || b.id === 'blow') return 1;
  if (b.id === 'load') return F.gain.wind;
  if (b.id === 'follow' || b.id === 'absorb') return F.gain.after;
  if (b.id === 'peak' || b.id === 'release') return take.reactGain ?? 1;
  return 1;
}
const piecewise = (pts) => (t) => { if (t <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return b === a ? vb : va + ((vb - va) * (t - a)) / (b - a); } return pts.at(-1)[1]; };

/** the take's keys with every key's distance from the first grown by the gain at its time; the identity when every gain is 1 */
function grownKeys(take, F) {
  const g = piecewise(take.beats.map((b) => [b.at, beatGain(b, F, take)]));
  if (take.keys.every((k) => g(k.t) === 1)) return take.keys;
  const base = flatten(take.keys[0]);
  return take.keys.map((k) => {
    const gk = g(k.t); if (gk === 1) return k;
    const f = flatten(k);
    return unflatten(Object.fromEntries(Object.entries(f).map(([p, v]) => [p, FIXED.test(p.split('.').pop()) || !(p in base) && !p.startsWith('pose.') ? v : r4((base[p] ?? 0) + (v - (base[p] ?? 0)) * gk)])));
  });
}

// ─── the time layer: spans retimed, holds inserted, whole frames ─────────
/**
 * Render a take in a flavor. `blowDv` (m/s the blow gives the victim) sizes the hitstop; without it a dealt or taken
 * blow freezes for the flavor's base. `speed` (m/s the body travels) sets a pinball take's rate. Every beat falls ON a
 * frame (its time on the flavor's clock rounded, each span at least one frame) and every hold is whole frames, so the
 * promised pose is shown exactly and a realistic take keeps its length to half a frame.
 * Each frame: `src` the take's share shown, `pose` the rig pose, `held` the frame repeats the last (a freeze), `scale`
 * [x, y, z] the body's squash and stretch about its feet (null: none).
 */
export function render(take, flavor, R, { fps = 60, blowDv = null, speed = null } = {}) {
  const F = flavorOf(flavor);
  const keys = grownKeys(take, F);
  const clip = keyedClip({ ...take, keys }, R);
  const T = take.seconds;
  const rate = F.rate ? clamp((speed ?? F.rate.speed) / F.rate.ref, 1, F.rate.max) : 1;
  // the output clock in frames: each span its role's time; a hold after the deepest wind-up and on the blow
  const stop = F.hitstop ? Math.min(F.hitstop.max, Math.round(F.hitstop.base + F.hitstop.perMs * (blowDv ?? 0))) : 0;
  const segs = [], beatFrame = [0]; let clock = 0, held = 0, own = 0;
  for (let i = 1; i < take.beats.length; i++) {
    const a = take.beats[i - 1], b = take.beats[i];
    own += ((b.at - a.at) * T * (F.time[b.role] ?? 1) * fps) / rate;
    const d = Math.max(1, Math.round(own) + held - clock);
    segs.push({ f0: clock, f1: clock + d, s0: a.at, s1: b.at }); clock += d; beatFrame.push(clock);
    const hold = Math.round((b.id === 'load' ? F.windHold : 0) * fps) + ((b.deals || b.takes) ? stop : 0);
    if (hold > 0) { segs.push({ f0: clock, f1: clock + hold, s0: b.at, s1: b.at, hold: true }); clock += hold; held += hold; }
  }
  const srcAt = (k) => { const s = segs.find((g) => k <= g.f1) ?? segs.at(-1); return s.hold ? s.s0 : s.s0 + ((s.s1 - s.s0) * (k - s.f0)) / (s.f1 - s.f0); };
  // squash and stretch: a pulse at each beat that carries one (a take-off stretches, a landing and a blow taken squash,
  // a wind-up squashes a little), a twentieth of a second wide, about the feet. A blow DEALT never stretches: the hand
  // must stay on its target (the promise), so the striker's body keeps its size there
  const pulses = F.squash ? take.beats.map((b, i) => ({ at: beatFrame[i] / fps, k: (b.squash ?? (b.id === 'load' ? -0.5 : 0)) * F.squash })).filter((p) => p.k) : [];
  const dealt = take.beats.findIndex((b) => b.deals), until = dealt < 0 ? Infinity : beatFrame[dealt] / fps;
  const scaleAt = (time) => { if (!pulses.length) return null; let s = 0; for (const p of pulses) s += p.k * Math.exp(-(((time - p.at) / 0.05) ** 2)); s *= clamp((until - time) / 0.05, 0, 1); if (Math.abs(s) < 1e-4) return null; const z = 1 + s, xy = 1 / Math.sqrt(z); return [r4(xy), r4(xy), r4(z)]; };
  const frames = [];
  for (let k = 0; k <= clock; k++) {
    const src = r4(srcAt(k));
    frames.push({ k, time: r4(k / fps), src, pose: clip.fn(clamp(src, 0, 1)), held: k > 0 && src === frames[k - 1].src, scale: scaleAt(k / fps) });
  }
  return { take: take.name, kind: take.kind, flavor: F.name, seconds: r4(clock / fps), fps, rate: r4(rate), frames,
    beats: take.beats.map((b, i) => ({ id: b.id, at: b.at, frame: beatFrame[i] })), hitstop: stop };
}

/** the rig's nodes for every frame, and the smears: a hand, a foot or the head that jumps further than the flavor's
 * `smear` in one frame. The body's scale is applied about its feet: up and down from the floor, and across about the
 * point between the feet only above the ankles (fading in to the hips), so a planted foot never slides */
const ENDS = ['wristL', 'wristR', 'toeTipL', 'toeTipR', 'headTop'];
export function nodesOf(R, rendered) {
  const F = flavorOf(rendered.flavor);
  const out = rendered.frames.map((f) => {
    const n = rigNodesAt(R, f.pose).nodes;
    if (!f.scale) return n;
    const o = [(n.toeBaseL[0] + n.toeBaseR[0]) / 2, (n.toeBaseL[1] + n.toeBaseR[1]) / 2, Math.min(n.toeBaseL[2], n.toeBaseR[2])];
    const ankle = Math.max(n.ankleL[2], n.ankleR[2]), hip = Math.min(n.hipL[2], n.hipR[2]);
    return Object.fromEntries(Object.entries(n).map(([k, p]) => { const w = clamp((p[2] - ankle) / Math.max(1e-6, hip - ankle), 0, 1), sx = 1 + (f.scale[0] - 1) * w, sy = 1 + (f.scale[1] - 1) * w;
      return [k, [o[0] + (p[0] - o[0]) * sx, o[1] + (p[1] - o[1]) * sy, o[2] + (p[2] - o[2]) * f.scale[2]]]; }));
  });
  const smears = [];
  if (F.smear) for (let i = 1; i < out.length; i++) for (const e of ENDS) if (out[i][e] && dist(out[i][e], out[i - 1][e]) > F.smear) smears.push({ frame: i, node: e, from: out[i - 1][e].map(r4), to: out[i][e].map(r4) });
  return { nodes: out, smears };
}

// ─── the force layer: what a blow hands on ────────────────────────────────
/** the striking hand's speed into contact on the take's own clock (m/s): the body's, whatever the flavor shows. Over the
 * last 60th of a second before contact, not the instant: the clip's monotone cubic flattens a joint at its extreme (the
 * elbow straightening at contact), so the instant before contact reads half the speed the drive carried */
function handSpeed(take, R) {
  const clip = keyedClip(take, R); const c = take.beats.find((b) => b.deals).at, h = 1 / (60 * take.seconds);
  const w = `wrist${take.hand}`; const a = rigNodesAt(R, clip.fn(c - h)).nodes[w], b = rigNodesAt(R, clip.fn(c)).nodes[w];
  return dist(a, b) / (h * take.seconds);
}
const EFFECTIVE = 0.04;   // the share of the striker's mass a straight blow carries into its target (a jab's 2–3 kg)
const FULL_DV = 1.2;      // m/s given the victim that the reaction library's peaks were posed for (a fighting game's hit)
/**
 * A blow: the striker's hand speed (its take's), what it gives the victim (`dv` m/s), against the body on earth's
 * (`powerscale`), the frames it freezes, how far and how high the victim is thrown (a ricochet hands back the body's
 * travel `speed` times its restitution), the striker's bounce, and how far
 * into its reaction the victim goes (`reactGain`: the reaction's peak scaled by the blow, never past half again).
 */
export function blow(take, flavor, R, { attackerKg = 75, victimKg = 75, speed = null } = {}) {
  const F = flavorOf(flavor); const v = handSpeed(take, R);
  const m = EFFECTIVE * attackerKg, real = (m * v) / (m + victimKg);
  let dv, lift = 0, bounce = 0;
  if (F.force.model === 'momentum') { dv = real * F.force.gain; lift = F.force.lift ?? 0; }
  else if (F.force.model === 'boop') { dv = F.force.push; bounce = F.force.bounce; }
  else { dv = (speed ?? F.rate?.speed ?? v) * F.force.restitution; }   // a ricochet: the body's own travel, handed back with more
  const rad = (lift * Math.PI) / 180, up = dv * Math.sin(rad), along = dv * Math.cos(rad);
  // thrown: the flight (if lifted), then a slide on the soles (friction 0.8) or a tumble
  const air = up > 0 ? (2 * up) / G : 0; const slide = (along * along) / (2 * 0.8 * G);
  const hitstop = F.hitstop ? Math.min(F.hitstop.max, Math.round(F.hitstop.base + F.hitstop.perMs * dv)) : 0;
  return { handSpeed: r4(v), dv: r4(dv), powerscale: r4(dv / real), hitstop,
    knockback: { speed: r4(dv), angle: lift, airborne: r4(air), distance: r4(along * air + slide), height: r4((up * up) / (2 * G)) },
    bounce, reactGain: r4(clamp(dv / FULL_DV, 0.15, 1.5)) };
}

/**
 * The exchange: the striker's take and the victim's reaction on one clock, the reaction starting on the frame the blow
 * lands, both frozen for the blow's hitstop.
 */
export function exchange(strike, reactName, flavor, R, opts = {}) {
  const F = flavorOf(flavor); const B = blow(strike, F, R, opts);
  const attacker = render(strike, F, R, { blowDv: B.dv, speed: opts.speed });
  const react = reactTake(reactName, R, { gain: B.reactGain });
  const victim = render(react, F, R, { blowDv: B.dv, speed: opts.speed });
  const at = attacker.beats.find((b) => b.id === 'contact').frame;
  return { flavor: F.name, blow: B, attacker, victim, offset: at };
}

// ─── the machine gate ──────────────────────────────────────────────────────
/**
 * What a render measures: its length, its holds (frames and the longest run), the wind-up's depth (the most the ends
 * move off ready up to the load, metres), frames moving from load to the promised beat (holds not counted), the ends' peak speed (m/s on the
 * output clock), how much changes a frame (metres, mean of the moving frames), poses shown a second, the squash's
 * deepest and its volume error, smears, and (a strike) the hand's distance at contact from where the take puts it.
 */
export function signature(R, rendered, { take = null } = {}) {
  const { nodes, smears } = nodesOf(R, rendered); const fr = rendered.frames; const fps = rendered.fps;
  const beat = (id) => rendered.beats.find((b) => b.id === id);
  const promised = rendered.beats.find((b) => ['contact', 'takeoff', 'peak'].includes(b.id));
  const wound = beat('load') ?? promised;
  const runs = []; let run = 0; for (const f of fr) { if (f.held) run++; else { if (run) runs.push(run); run = 0; } } if (run) runs.push(run);
  const move = (i) => Math.max(...ENDS.map((e) => dist(nodes[i][e], nodes[i - 1][e])));
  const steps = fr.slice(1).map((_, i) => move(i + 1)); const moving = steps.filter((s) => s > 1e-5);
  const wind = wound ? Math.max(0, ...nodes.slice(0, wound.frame + 1).map((n) => Math.max(...ENDS.map((e) => dist(n[e], nodes[0][e]))))) : 0;
  const distinct = new Set(fr.map((f) => f.src)).size;
  const peak = steps.indexOf(Math.max(...steps));
  const sq = fr.filter((f) => f.scale);
  let contactErr = null;
  if (take?.kind === 'strike') { const c = beat('contact'); contactErr = r4(dist(nodes[c.frame][`wrist${take.hand}`], rigNodesAt(R, keyedClip(take, R).fn(take.beats.find((b) => b.deals).at)).nodes[`wrist${take.hand}`])); }
  return {
    seconds: rendered.seconds, frames: fr.length, held: fr.filter((f) => f.held).length, longestHold: Math.max(0, ...runs),
    windDepth: r4(wind), driveFrames: beat('load') && promised ? fr.slice(beat('load').frame + 1, promised.frame + 1).filter((f) => !f.held).length : null,
    peakSpeed: r4(Math.max(...steps) * fps), meanStep: r4(moving.reduce((a, b) => a + b, 0) / Math.max(1, moving.length)),
    peakAt: { frame: peak + 1, node: ENDS.find((e) => dist(nodes[peak + 1][e], nodes[peak][e]) === steps[peak]) },
    posesPerSecond: r4(distinct / rendered.seconds), takeSecondsPerSecond: r4((fr.at(-1).src - fr[0].src) * (take?.seconds ?? NaN) / rendered.seconds),
    squash: r4(Math.max(0, ...sq.map((f) => Math.abs(f.scale[2] - 1)))), volumeErr: r4(Math.max(0, ...sq.map((f) => Math.abs(f.scale[0] * f.scale[1] * f.scale[2] - 1)))),
    smears: smears.length, contactErr,
  };
}

// ─── selection: the kind of game asks for a flavor ─────────────────────────
/**
 * The flavor each of the cosmos's genres asks for (gameworld/intent.js GENRES, the same ids `cubeOfWorld` answers
 * `from`). A genre with no bodies on screen still has one: a pilot's or a driver's own moments play in it.
 */
export const GENRE_FLAVOR = Object.freeze({
  pinball: ['racing', 'kart-racer', 'endless-runner', 'rhythm'],
  platformer: ['collectathon', 'metroidvania', 'pixel-puzzle', 'block-puzzle', 'match-3-saga'],
  action: ['dungeon-crawler', 'top-down-adventure', 'arena-brawler', 'versus-fighter', 'city-stalker', 'roguelike', 'jrpg', 'arena-shooter'],
  realistic: ['shooter', 'survival-horror', 'story-adventure', 'stealth', 'farming', 'tactics', 'rts', 'tower-defense', 'flight-sim', 'air-combat', 'space-shooter'],
});
const BY_GENRE = Object.fromEntries(Object.entries(GENRE_FLAVOR).flatMap(([f, ids]) => ids.map((id) => [id, f])));
const WHY = {
  pinball: 'the body is a projectile: the faster it goes the faster its poses change, a hit ricochets',
  platformer: 'movement is the verb: the take-off and the landing are the show, a hit is a boop',
  action: 'the blow is the verb: wind-up, snap, freeze, throw',
  realistic: 'the body must read as a body on earth: no holds, real momentum',
};
/**
 * The flavor a game asks for: the operator's own word (`flavor`) over all; else its genre id; else the genre whose
 * words its own words name (GENRES `words`); else realistic, the default that never lies about a body.
 */
export function flavorFor(game = {}) {
  if (game.flavor) return { flavor: flavorOf(game.flavor).name, from: 'flavor', why: 'the operator\'s word' };
  if (BY_GENRE[game.genre]) return { flavor: BY_GENRE[game.genre], from: game.genre, why: WHY[BY_GENRE[game.genre]] };
  const said = ` ${[game.says, ...(game.words ?? [])].filter(Boolean).join(' ').toLowerCase()} `;
  for (const [id, g] of Object.entries(GENRES)) if (BY_GENRE[id] && g.words.some((w) => said.includes(` ${w} `))) return { flavor: BY_GENRE[id], from: id, why: WHY[BY_GENRE[id]] };
  return { flavor: 'realistic', from: null, why: 'nothing named a genre: ' + WHY.realistic };
}
