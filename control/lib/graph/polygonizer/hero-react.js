/**
 * hero-react — how a hero takes a blow: the REACTIONS, lifted from the versus fighter's library (versus/versus-react.js)
 * onto any hero's rig, so every character a game makes can be hit, not only a fighter. The fighter's library stays the
 * one source: its impact poses and its stagger are read here through `planeToVajra`, never copied.
 *
 *   hitHigh   the head snaps back, the arms fly                 (HIT_PEAKS.high)
 *   hitBody   the trunk folds over the blow                     (HIT_PEAKS.body)
 *   hitLow    a knee buckles, the body drops                    (HIT_PEAKS.low)
 *   stagger   a guard broken open: blown back, then swaying until it recovers (CRUSH_CLIP)
 *
 * TAKEN IN THE GUARD (fighter wiring): `guardHitHigh`, `guardHitBody`, `guardHitLow`, `guardStagger` are the same blows
 * on a hero squared up, starting and ending on the `guard` stance's held pose (hero-stance.js: its feet, its sink, its
 * fists) with the impact laid over it, so a fighter in its guard is struck out of it and comes back to it, where the
 * plain words start and end on the relaxed stand (its hands dropped before the blow lands). The arms are kept out of
 * the trunk through the clip (hero-solid.js: never deeper than the guard holds them; the law `solid`).
 *
 * Toppling and getting up are the rests' (hero-rise.js): `knockedOut` makes `knockedOutDown` (the collapse) and
 * `knockedOutUp` (the groggy rise).
 *
 * A hit is struck FAST (its peak a tenth into the clip, as the fight's impact snaps), held through the blow's freeze,
 * then gives back to the stand slowly; the feet stay planted throughout and the clip starts and ends on the stand, so it
 * plays over any idle. `planeToVajra(pose)` reads the fight plane's absolute segment angles (versus-rig.js: torso and
 * head + forward, limbs 0 down and +90 forward) as the hero's joints (hero-jump.js keys: hinge, head pitch + up, shoulder
 * pitch + forward and up, elbow and knee + bend); the lead side (F) is the right. The arms and the trunk are read as
 * they are; the legs only as the knees' bend past the fight's guard and the drop of the hips (`sink`), since a planted
 * hero stands on its own feet, not the guard's.
 *
 *   REACTS, REACT_NAMES, BLOCK_NAMES (`block`, `blockBody`: a punch taken on the guard, below)
 *   heroReact(name, R, { seconds? }) → { fn, seconds, laws, act }   laws: the ends on the stand, the feet planted; act:
 *                                      the face it acts (hero-face-action.js `react`, anime-face-tracks.js)
 *
 * Pure and deterministic.
 */
import { HIT_PEAKS, CRUSH_CLIP } from '../versus/versus-react.js';
import { POSES } from '../versus/versus-library.js';
import { keyedClip } from './hero-jump.js';
import { rigNodesAt } from './station-loft-rig.js';
import { heroStance } from './hero-stance.js';
import { solidArms, solidRead } from './hero-solid.js';

const r1 = (x) => Math.round(x * 10) / 10;
const kneeOf = (leg) => leg[0] - leg[1];
const GUARD = POSES.guard;
/** degrees of the fight's twist to one unit of the spine's axial drive */
const AXIAL_DEG = 45;

/** A fight-plane pose as the hero's joints (hero-jump key words) and its sink, metres. */
export function planeToVajra(p) {
  const pose = {
    hinge: r1(p.torso),
    head: { pitch: r1(-((p.head ?? 0) - p.torso)) },
    shR: { pitch: r1(p.armF[0] - p.torso) }, elbowR: r1(Math.max(0, p.armF[1] - p.armF[0])),
    shL: { pitch: r1(p.armB[0] - p.torso) }, elbowL: r1(Math.max(0, p.armB[1] - p.armB[0])),
    kneeR: r1(Math.max(0, kneeOf(p.legF) - kneeOf(GUARD.legF))), kneeL: r1(Math.max(0, kneeOf(p.legB) - kneeOf(GUARD.legB))),
    ...(p.twist ? { spine: { axial: Math.round((p.twist / AXIAL_DEG) * 1000) / 1000 } } : {}),
  };
  return { pose, sink: Math.round(Math.max(0, -(p.hip?.[1] ?? 0)) / 10) / 100 };
}

const STAND = { t: 0, pose: {}, sink: 0, heel: 0, ground: 1 };
const key = (t, p, scale = 1) => {
  const { pose, sink } = planeToVajra(p);
  const s = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' ? s(v) : Math.round(v * scale * 1000) / 1000]));
  return { t, pose: s(pose), sink: Math.round(sink * scale * 100) / 100, heel: 0, ground: 1 };
};
// a hit: struck at a tenth, held to two fifths, given back by the end
const hit = (where, seconds) => ({ seconds, from: `HIT_PEAKS.${where}`, keys: [STAND, key(0.1, HIT_PEAKS[where]), key(0.4, HIT_PEAKS[where], 0.85), { ...STAND, t: 1 }] });

/** The reactions, each a timeline in hero-jump's shape (`keyedClip`). */
const BLOWS = Object.freeze({
  hitHigh: hit('high', 0.5),
  hitBody: hit('body', 0.55),
  hitLow: hit('low', 0.55),
  // the stagger: the fight's crush keys after a snap out of the stand, played over a second and a half
  stagger: { seconds: 1.5, from: 'CRUSH_CLIP', keys: [STAND, ...CRUSH_CLIP.slice(0, -1).map(([t, p]) => key(0.06 + 0.84 * t, p)), { ...STAND, t: 1 }] },
});
/** the blows taken in the guard: each its plain blow's keys, laid over the guard's held pose on the rig (heroReact) */
const IN_GUARD = Object.freeze(Object.fromEntries(Object.entries(BLOWS).map(([n, J]) => [`guard${n[0].toUpperCase()}${n.slice(1)}`, Object.freeze({ ...J, guard: true })])));
/**
 * THE BLOCKS: a punch taken on the guard, not the body. The guard absorbing it as the fight's block does (versus-react.js
 * `block`: rocked back into the guard, held, then out), on the hero's own guard: each key a CHANGE over the guard's held
 * pose (`d`: degrees on its joints, metres on its sink), so the fists, the feet and the guard's shape are the hero's.
 *   block      the high guard: the gloves driven back toward the face, the chin tucked behind them, the body rocked
 *              back, the knees giving
 *   blockBody  the elbows dropped onto the ribs, the trunk curled over them
 */
const BLOCKED = Object.freeze({
  block: { seconds: 0.4, guard: true, block: true, keys: [
    { t: 0, d: {} },
    { t: 0.12, d: { hinge: -7, head: { pitch: -8 }, shR: { pitch: -10 }, shL: { pitch: -10 }, elbowR: 8, elbowL: 8, sink: 0.02 } },
    { t: 0.45, d: { hinge: -5, head: { pitch: -6 }, shR: { pitch: -7 }, shL: { pitch: -7 }, elbowR: 6, elbowL: 6, sink: 0.015 } },
    { t: 1, d: {} }] },
  blockBody: { seconds: 0.45, guard: true, block: true, keys: [
    { t: 0, d: {} },
    { t: 0.14, d: { hinge: 8, head: { pitch: -6 }, shR: { pitch: -24 }, shL: { pitch: -20 }, elbowR: 12, elbowL: 10, sink: 0.03 } },
    { t: 0.5, d: { hinge: 6, head: { pitch: -5 }, shR: { pitch: -18 }, shL: { pitch: -15 }, elbowR: 9, elbowL: 8, sink: 0.022 } },
    { t: 1, d: {} }] },
});
export const REACTS = Object.freeze({ ...BLOWS, ...IN_GUARD, ...BLOCKED });
/** the reactions a punch landing on the guard (a glove, a forearm) plays: the high block, or the body's */
export const BLOCK_NAMES = Object.freeze(Object.keys(BLOCKED));
export const REACT_NAMES = Object.freeze(Object.keys(REACTS));

/** a blow's keys laid over the guard's held pose on a rig: the stand's keys the guard's own, an impact's pose over the
 * guard's (a joint the impact moves its, a shoulder whole, the rest the guard's: the fists stay closed), its sink added
 * to the guard's */
/** a block's changes laid over the guard's held pose on a rig (each joint the guard's plus the change) */
function overGuard(keys, R) {
  const st = heroStance('guard', R), { t: _t, pose: G, sink: g0 = 0, ...feet } = st.keys.at(-1), r = (x) => Math.round(x * 1000) / 1000;
  const plus = (g, d) => (d && typeof d === 'object' ? { ...(g ?? {}), ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, r((g?.[k] ?? 0) + v)])) } : r((g ?? 0) + d));
  return keys.map(({ t, d }) => { const { sink = 0, ...joints } = d, pose = { ...G }; for (const [j, v] of Object.entries(joints)) pose[j] = plus(G[j], v); return { t, ...feet, pose, sink: Math.round((g0 + sink) * 1e4) / 1e4 }; });
}
function inGuard(keys, R) {
  const st = heroStance('guard', R), { t: _t, pose: G, sink: g0 = 0, ...feet } = st.keys.at(-1);
  return keys.map((k) => {
    if (!Object.keys(k.pose).length) return { ...k, ...feet, pose: G, sink: g0 };
    const pose = { ...G };
    // (a shoulder the blow moves is the blow's whole: the guard's swing and roll kept under the blow's pitch threw the arm
    // back across the chest, through it)
    for (const [j, v] of Object.entries(k.pose)) pose[j] = v && typeof v === 'object' && G[j] && typeof G[j] === 'object' && !/^sh[RL]$/.test(j) ? { ...G[j], ...v } : v;
    return { ...k, ...feet, pose, sink: Math.round((g0 + (k.sink ?? 0)) * 1e4) / 1e4 };
  });
}
/** A reaction on a rig: its clip and its laws (the machine gate). */
export function heroReact(name, R, { seconds } = {}) {
  const J = REACTS[name];
  if (!J) throw new Error(`hero-react: no reaction '${name}' (have ${REACT_NAMES.join(', ')})`);
  const keys = J.block ? overGuard(J.keys, R) : J.guard ? inGuard(J.keys, R) : J.keys;
  const C0 = keyedClip({ ...J, keys }, R, { seconds });
  // (a blow taken in the guard keeps the body solid under its arms, hero-solid.js: between the guard and the blow each
  // shoulder's angles, curved on their own, took the arm through the chest)
  const C = J.guard ? { ...C0, fn: solidArms(R, C0.fn) } : C0;
  const toes = (t) => { const n = rigNodesAt(R, C.fn(t)).nodes; return Object.values(R.legs).map((L) => n[L.toeBase]); };
  const at0 = toes(0), drift = Math.max(...[0.1, 0.4, 0.7, 1].flatMap((t) => toes(t).map((p, i) => Math.hypot(p[0] - at0[i][0], p[1] - at0[i][1], p[2] - at0[i][2]))));
  const solid = J.guard ? solidRead(R, C.fn, 40) : null;
  const laws = { ...(solid ? { solid: Math.max(solid.R.worst, solid.L.worst) <= 0.01 } : {}), planted: drift < 0.02, ends: keys[0].t === 0 && keys.at(-1).t === 1 && JSON.stringify(keys[0].pose) === JSON.stringify(keys.at(-1).pose) && (J.guard || !Object.keys(keys.at(-1).pose).length) };
  // (the face it acts, hero-face-action.js `react`: on its impact, the first key off the stand, and its hold, the last
  // before it gives back)
  const T = C.seconds, act = { family: 'react', action: { family: 'react', name, seconds: T, beats: { impact: J.keys[1].t * T, hold: J.keys.at(-2).t * T, end: T } } };
  return { fn: C.fn, seconds: T, laws, act };
}
