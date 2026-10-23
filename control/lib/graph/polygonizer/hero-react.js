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
 *   REACTS, REACT_NAMES
 *   heroReact(name, R, { seconds? }) → { fn, seconds, laws, act }   laws: the ends on the stand, the feet planted; act:
 *                                      the face it acts (hero-face-action.js `react`, anime-face-tracks.js)
 *
 * Pure and deterministic.
 */
import { HIT_PEAKS, CRUSH_CLIP } from '../versus/versus-react.js';
import { POSES } from '../versus/versus-library.js';
import { keyedClip } from './hero-jump.js';
import { rigNodesAt } from './station-loft-rig.js';

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
export const REACTS = Object.freeze({
  hitHigh: hit('high', 0.5),
  hitBody: hit('body', 0.55),
  hitLow: hit('low', 0.55),
  // the stagger: the fight's crush keys after a snap out of the stand, played over a second and a half
  stagger: { seconds: 1.5, from: 'CRUSH_CLIP', keys: [STAND, ...CRUSH_CLIP.slice(0, -1).map(([t, p]) => key(0.06 + 0.84 * t, p)), { ...STAND, t: 1 }] },
});
export const REACT_NAMES = Object.freeze(Object.keys(REACTS));

/** A reaction on a rig: its clip and its laws (the machine gate). */
export function heroReact(name, R, { seconds } = {}) {
  const J = REACTS[name];
  if (!J) throw new Error(`hero-react: no reaction '${name}' (have ${REACT_NAMES.join(', ')})`);
  const C = keyedClip(J, R, { seconds });
  const toes = (t) => { const n = rigNodesAt(R, C.fn(t)).nodes; return Object.values(R.legs).map((L) => n[L.toeBase]); };
  const at0 = toes(0), drift = Math.max(...[0.1, 0.4, 0.7, 1].flatMap((t) => toes(t).map((p, i) => Math.hypot(p[0] - at0[i][0], p[1] - at0[i][1], p[2] - at0[i][2]))));
  const laws = { planted: drift < 0.02, ends: J.keys[0].t === 0 && J.keys.at(-1).t === 1 && !Object.keys(J.keys.at(-1).pose).length };
  // (the face it acts, hero-face-action.js `react`: on its impact, the first key off the stand, and its hold, the last
  // before it gives back)
  const T = C.seconds, act = { family: 'react', action: { family: 'react', name, seconds: T, beats: { impact: J.keys[1].t * T, hold: J.keys.at(-2).t * T, end: T } } };
  return { fn: C.fn, seconds: T, laws, act };
}
