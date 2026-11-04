/**
 * hero-box — A BOXER'S ARCED PUNCHES at the hero door: the hook and the uppercut, which the straight strikes
 * (hero-strike.js: the jab, the cross) do not throw, each one strike of SPACE BOXER (hero-reach.js) at its own target from
 * the guard, as a fighting game's move is a strike at an opponent.
 *
 *   • THE TARGET is a mark on an opponent squared up on the line between the fighters (MARKS: his chin, his ribs, at
 *     the attacker's own heights), as far ahead as `share` of the striking arm's reach: a long arm hooks a farther
 *     chin. Aimed off the shoulder instead (its own angles, as the drill draws), a bladed guard's turned trunk put an
 *     uppercut beside the opponent's head, seen in a bout.
 *   • THE SOLVE is space boxer's: the knuckles brought to the target along the family's approach (a hook turned in about
 *     the thorax's up, an uppercut rising about its lateral), the arm held to its servos, the body joining in a rung at a
 *     time when the arm alone cannot land it, driven along its arc into contact and recovered to the guard; timed by the
 *     servos' speeds at the hero's own strikes' (`pace` 1), a move between keys as short as `step` (the drill's 40 ms
 *     floor held a hand to 2 m/s over its drive's few centimetres). A clip starts and ends on the guard's held pose, as every strike does.
 *   • THE FOLLOW-THROUGH: the knuckles carry on FOLLOW past the target along the approach, so the hand meets it at
 *     speed (a drill's touch holds on the target, and the clip's curve through its keys braked the hand onto it: the
 *     hook landed at a seventh of the jab's speed, seen in a bout).
 *   • THE CHECKS (the machine gate): the knuckles on the target at contact, the force line along the approach, no servo
 *     past a stop, the balance inside the feet, read on the clip as played (targetDrill's checks), and the wrist at
 *     contact at least two thirds of its fastest over its drive, chamber to contact (`speed`, `peak`, m/s); the guarding arm kept out of the
 *     trunk as the body turns into the punch (hero-solid.js, the law `solid`).
 *
 * The guard is right-led (hero-stance.js): `hook` is the lead hand's (R), `uppercut` the rear's (L), `bodyHook` the lead
 * hand's to the ribs; `<name>Left` the exact mirror (out of the left-led guard). Pure and deterministic.
 */
import { targetDrill, stanceBody, handFeatures } from './hero-reach.js';
import { keyedClip, mirrored } from './hero-jump.js';
import { rigNodesAt } from './station-loft-rig.js';
import { solidArms, solidRead } from './hero-solid.js';

export const BOX_STRIKES = Object.freeze({
  hook: Object.freeze({ hand: 'R', family: 'hook', aim: 'chin', share: 0.8, serves: Object.freeze(['lead hook', 'hook']) }),
  uppercut: Object.freeze({ hand: 'L', family: 'uppercut', aim: 'chin', share: 0.72, serves: Object.freeze(['rear uppercut', 'uppercut']) }),
  bodyHook: Object.freeze({ hand: 'R', family: 'hook', aim: 'ribs', share: 0.85, serves: Object.freeze(['lead hook to the body', 'body shot']) }),
});
/** THE OPPONENT'S MARKS, on the line between the fighters (the vertical plane through the middle of the attacker's feet,
 * straight ahead), at the attacker's own heights, so an opponent of its size stands to them: the CHIN at its head's base,
 * a hook's on the jaw's side toward the striking hand (`side` metres off the line); the RIBS three quarters down from the neck
 * to the pelvis, a body hook's on the flank toward the striking hand */
export const MARKS = Object.freeze({ chin: Object.freeze({ side: 0.05, down: 0 }), ribs: Object.freeze({ side: 0.1, down: 0.75 }) });
/** where a punch aims in the rig's frame, from the guard: the mark, as far ahead as `share` of the striking arm's reach to
 * its knuckles from its shoulder (an uppercut's mark on the line itself) */
export function boxTarget(R, B) {
  const n = stanceBody(R, 'guard', B.hand).nodes, M = MARKS[B.aim], sh = n[`shoulder${B.hand}`];
  const toes = Object.values(R.legs).map((L) => n[L.toeBase]), cx = (toes[0][0] + toes[1][0]) / 2;
  const sign = Math.sign(R.joints[`shoulder${B.hand}`][0] - R.joints[`shoulder${B.hand === 'R' ? 'L' : 'R'}`][0]);
  const x = cx + (B.family === 'uppercut' ? 0 : sign * M.side), z = n.headBase[2] - M.down * (n.neckHub[2] - n.pelvisHub[2]);
  const F = handFeatures(R, B.hand), reach = Math.hypot(...[0, 1, 2].map((i) => R.joints[`shoulder${B.hand}`][i] - R.joints[`elbow${B.hand}`][i])) + Math.hypot(...[0, 1, 2].map((i) => R.joints[`elbow${B.hand}`][i] - R.joints[`wrist${B.hand}`][i])) + Math.hypot(...[0, 1, 2].map((i) => F.surfaces.knuckles.p[i] - F.wrist[i]));
  const r = B.share * reach, ahead = Math.sqrt(Math.max(0.05 ** 2, r * r - (x - sh[0]) ** 2 - (z - sh[2]) ** 2));
  return [x, sh[1] + ahead, z];
}
/** metres the knuckles carry on past the target along the approach: a punch's follow-through (the drill's touch holds) */
export const FOLLOW = 0.06;
export const BOX_NAMES = Object.freeze(Object.keys(BOX_STRIKES).flatMap((n) => [n, `${n}Left`]));
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/**
 * Solve a boxer's arced punch on a rig: { name, hand, seconds, clip, keys, contact: { t (seconds), at (rig frame) },
 * family (the approach landed), rung (the ladder's rung it needed), checks: { contact (m), approach (°), past, path (m),
 * balance (m), laws: { lands, facing, servos, balance } }, serves }. `seconds` stretches the solved timing to it.
 */
export function heroBox(name, R, { seconds = null, pace = 1, step = 0.012 } = {}) {
  const left = /Left$/.test(name), base = left ? name.slice(0, -4) : name, B = BOX_STRIKES[base];
  if (!B) throw new Error(`hero-box: no punch '${name}' (have ${BOX_NAMES.join(', ')})`);
  const D = targetDrill(R, { side: B.hand, stance: 'guard', pace, step, follow: FOLLOW, aimed: [{ at: boxTarget(R, B), surface: 'knuckles', families: [B.family] }] });
  const T = seconds ?? D.seconds, x = D.targets[0], c = D.checks.targets[0];
  const keys = left ? mirrored(D.keys) : D.keys;
  // (the guarding arm kept out of the trunk as the body turns into the punch, hero-solid.js; the striking arm is the
  // reach's own, held clear of the trunk by its solve)
  const hand0 = left ? (B.hand === 'R' ? 'L' : 'R') : B.hand, guarding = hand0 === 'R' ? 'L' : 'R', K0 = keyedClip({ seconds: T, keys }, R);
  const clip = { ...K0, fn: solidArms(R, K0.fn, { sides: [guarding] }) }, solid = solidRead(R, clip.fn, 40)[guarding].worst;
  const at = left ? [-x.at[0], x.at[1], x.at[2]] : x.at;
  const hand = left ? (B.hand === 'R' ? 'L' : 'R') : B.hand;
  // THE DRIVE: the hand's speed at contact against its fastest on the way in (its wrist, on the clip as played): a punch
  // lands near its fastest, never braking onto the target
  const tc = x.t / D.seconds, w = (t) => rigNodesAt(R, D.clip.fn(Math.max(0, Math.min(1, t)))).nodes[`wrist${B.hand}`], h = 0.004;
  const v = (t) => { const a = w(t - h), b = w(t + h); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * h * D.seconds); };
  // (the fastest over its drive, from the chamber to the contact: a hook's swing out into its chamber is the arm's, not the punch's)
  const t0 = x.chamber / D.seconds; let peak = 0; for (let k = 0; k <= 24; k++) peak = Math.max(peak, v(t0 + ((tc - t0) * k) / 24));
  const speed = v(tc);
  // (the laws: landed within 5 mm, the knuckles square to the approach within 25°, no servo past a stop, the centre of
  // mass inside the feet, the hand at contact at least two thirds of its fastest)
  const laws = { lands: c.contact <= 0.005, facing: c.approach <= 25, servos: !c.past.length, balance: c.balance >= 0, drives: speed >= (2 / 3) * peak, solid: solid <= 0.01 };
  return { name, from: left ? 'guardLeft' : 'guard', hand, seconds: r4(T), clip, keys, contact: { t: r4((x.t / D.seconds) * T), at },
    family: x.family, rung: x.rung, checks: { ...c, speed: r4((speed * D.seconds) / T), peak: r4((peak * D.seconds) / T), laws }, serves: [...B.serves] };
}
