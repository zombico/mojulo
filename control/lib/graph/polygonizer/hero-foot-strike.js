// hero-foot-strike — A FOOT STRIKE: a blow the legs deal, not the hands (a foe's second attack thrown with its legs,
// foes/attacks.js FOLK ways). Its own module so the swing verbs' (hero-swing.js), which the contest's pages inline, stay
// as they were. Pure data: no dice, no clock.
import { swingKeys } from './hero-swing.js';

/** the swing's ready key (hero-swing.js READY): a foot strike starts and its clip eases from where a swing's does */
const READY = swingKeys('chop', 'normal').keys[0];
/**
 * A FOOT STRIKE (a foe's second attack thrown with its legs, foes/attacks.js FOLK ways): its two keys after the swing's
 * ready, the leg up and the leg down. The STOMP: the weight onto the left foot, the right thigh raised high in front, the
 * knee bent, the arms flung up and out (the tell); then the hoof driven down ahead of it, the body dropped onto it,
 * hinged over, the arms brought down. Played as a foe's `fire` clip (world-kinds.js): ready → up → down, holding down.
 */
export const FOOT_STRIKES = Object.freeze({
  stomp: Object.freeze({
    up: { support: 'L', crouch: 0.04, hipR: { yaw: 0, pitch: 72, roll: 0 }, kneeR: 95, shR: { yaw: -10, pitch: 100, roll: 20 }, elbowR: 60, shL: { yaw: -20, pitch: 90, roll: 0 }, elbowL: 50, spine: { arch: 0.14 }, head: { pitch: -8 } },
    down: { support: 'both', crouch: 0.3, hipR: { yaw: 0, pitch: 28, roll: 0 }, kneeR: 40, shR: { yaw: 10, pitch: 40, roll: 0 }, elbowR: 30, shL: { yaw: -10, pitch: 35, roll: 0 }, elbowL: 30, spine: { curl: 0.22 }, hinge: 18, head: { pitch: 12 } },
  }),
});
export const FOOT_WORDS = Object.freeze(Object.keys(FOOT_STRIKES));
/** A foot strike's keys as a hero plays them: the swing's ready, the leg up, the leg down; on the structured core's swing
 * base and with the held hands closed on their grips as a swing's (swingClipKeys). */
export function footStrikeKeys(word, { base = null, grip = [] } = {}) {
  const F = FOOT_STRIKES[word]; if (!F) throw new Error(`hero-swing: no foot strike '${word}' (have ${FOOT_WORDS.join(', ')})`);
  let keys = [READY, F.up, F.down].map((k) => structuredClone(k));
  if (base) keys = keys.map((k) => ({ ...base, ...k, crouch: Math.max(k.crouch ?? 0, base.crouch) }));
  if (grip.length) keys = keys.map((k) => ({ ...Object.fromEntries(grip.filter((f) => k[f] === undefined).map((f) => [f, 'grip'])), ...k }));
  return keys;
}
