/**
 * hero-box — A BOXER'S ARCED PUNCHES at the hero door: the hook and the uppercut, which the straight strikes
 * (hero-strike.js: the jab, the cross) do not throw, each one strike of SPACE BOXER (hero-reach.js) at its own target from
 * the guard, as a fighting game's move is a strike at an opponent.
 *
 *   • THE TARGET is where an opponent squared up at punching range stands to be hit, in the striking shoulder's own
 *     terms (targetDrill's): `az` degrees round from straight ahead (− across the body, toward the centre line), `el`
 *     degrees up off the shoulder's level, `share` of the arm's reach to its surface. So it scales with the body: a long
 *     arm hooks a farther chin.
 *   • THE SOLVE is space boxer's: the knuckles brought to the target along the family's approach (a hook turned in about
 *     the thorax's up, an uppercut rising about its lateral), the arm held to its servos, the body joining in a rung at a
 *     time when the arm alone cannot land it, driven along its arc into contact and recovered to the guard; timed by the
 *     servos' speeds (`pace`). A clip starts and ends on the guard's held pose, as every strike does.
 *   • THE CHECKS (the machine gate): the knuckles on the target at contact, the force line along the approach, no servo
 *     past a stop, the balance inside the feet, read on the clip as played (targetDrill's checks).
 *
 * The guard is right-led (hero-stance.js): `hook` is the lead hand's (R), `uppercut` the rear's (L), `bodyHook` the lead
 * hand's to the ribs; `<name>Left` the exact mirror (out of the left-led guard). Pure and deterministic.
 */
import { targetDrill } from './hero-reach.js';
import { keyedClip, mirrored } from './hero-jump.js';

export const BOX_STRIKES = Object.freeze({
  hook: Object.freeze({ hand: 'R', family: 'hook', az: -22, el: 10, share: 0.74, serves: Object.freeze(['lead hook', 'hook']) }),
  uppercut: Object.freeze({ hand: 'L', family: 'uppercut', az: -32, el: 6, share: 0.62, serves: Object.freeze(['rear uppercut', 'uppercut']) }),
  bodyHook: Object.freeze({ hand: 'R', family: 'hook', az: -14, el: -38, share: 0.8, serves: Object.freeze(['lead hook to the body', 'body shot']) }),
});
export const BOX_NAMES = Object.freeze(Object.keys(BOX_STRIKES).flatMap((n) => [n, `${n}Left`]));
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/**
 * Solve a boxer's arced punch on a rig: { name, hand, seconds, clip, keys, contact: { t (seconds), at (rig frame) },
 * family (the approach landed), rung (the ladder's rung it needed), checks: { contact (m), approach (°), past, path (m),
 * balance (m), laws: { lands, facing, servos, balance } }, serves }. `seconds` stretches the solved timing to it.
 */
export function heroBox(name, R, { seconds = null, pace = 0.55 } = {}) {
  const left = /Left$/.test(name), base = left ? name.slice(0, -4) : name, B = BOX_STRIKES[base];
  if (!B) throw new Error(`hero-box: no punch '${name}' (have ${BOX_NAMES.join(', ')})`);
  const D = targetDrill(R, { side: B.hand, stance: 'guard', pace, aimed: [{ az: B.az, el: B.el, share: B.share, surface: 'knuckles', families: [B.family] }] });
  const T = seconds ?? D.seconds, x = D.targets[0], c = D.checks.targets[0];
  const keys = left ? mirrored(D.keys) : D.keys;
  const clip = keyedClip({ seconds: T, keys }, R);
  const at = left ? [-x.at[0], x.at[1], x.at[2]] : x.at;
  const hand = left ? (B.hand === 'R' ? 'L' : 'R') : B.hand;
  // (the laws: landed within 5 mm, the knuckles square to the approach within 25°, no servo past a stop, the centre of
  // mass inside the feet)
  const laws = { lands: c.contact <= 0.005, facing: c.approach <= 25, servos: !c.past.length, balance: c.balance >= 0 };
  return { name, from: left ? 'guardLeft' : 'guard', hand, seconds: r4(T), clip, keys, contact: { t: r4((x.t / D.seconds) * T), at },
    family: x.family, rung: x.rung, checks: { ...c, laws }, serves: [...B.serves] };
}
