/**
 * THE HIT — the join of the swing and the ball. The swing system (polygonizer/hero-swing.js) puts a swing's STRIKE in one
 * segment of its clip and names the contact WINDOW round it (the cock to the end of the follow-through); a game type
 * re-times both (swingTiming). The hit is live through that window and lands on the strike frame: a ball inside the hit
 * volume then takes a velocity whose direction is the stick and the verb's arc, whose speed is the register's power over
 * the body's real tip speed (the weapon spike's law: the blow is the tip's speed), grown by the register's rally, and
 * whose spin is the verb's (a topspin forehand, a slice, a flat drive). The result is the physics property's own
 * `impulse` (a change of momentum) and a `touch` fact the contest kernel reads.
 *
 *   HIT_VERBS                   { <verb>: { arc, lift, spin, rate, power, hands, swing } }
 *                                 arc    deg: the elevation the ball leaves at with the stick at rest (+ up)
 *                                 lift   deg: how far the stick's forward and back tilt it (± at full deflection)
 *                                 spin   'top' | 'back' | 'side' | 'none': the verb's spin, about the axis each means
 *                                 rate   rev/s at the realistic register (the registers scale it)
 *                                 power  a share of the register's power
 *                                 swing  the swing-system verb that plays it (its strike frame and window), or null
 *                                        for a verb no swing clip plays yet (the hit law still holds; the clip is said)
 *   HIT_REGISTERS               { <register>: { base, gain, spread, spin } }: speed = base + gain × tipSpeed (m/s), the
 *                                 stick's sideways aim ± spread deg, the spin rates × spin
 *   hitWindow(verb, cls, register)   → { strike, window, swing } the phase the hit lands and the span it is live, on the
 *                                 game's timeline (realistic: the swing's own)
 *   hitLive(u, verb, cls, register)  → whether the swing's phase u is inside the window
 *   hitVelocity({ verb, register, facing, stick, tipSpeed, hits })  → { velocity, angularVelocity, speed, azimuth,
 *                                 elevation, spin: { kind, rate } }   facing: the heading the body faces (rad, x toward
 *                                 +x); stick: [x, y] in -1 … 1 (x right, y forward); tipSpeed m/s; hits: clean hits so
 *                                 far in the rally (the arcade grows it)
 *   hitBall({ ball, who, verb, register, facing, stick, tipSpeed, hits, at })  → { impulse, angularVelocity, velocity,
 *                                 fact }   ball: the sim body ({ mass, velocity }); impulse = m × (v' − v); fact the
 *                                 contest kernel's { kind: 'touch', who, at: [x, y] }
 *
 * Frame: the court's (contest-kernel.js), z up, metres and seconds. Pure: no dice, no clock.
 */
import { swingKeys, swingTiming, SWING_WORDS } from '../polygonizer/hero-swing.js';
import { BALL_REGISTERS, rallySpeed } from './ball-card.js';

export const HIT_VERBS = Object.freeze({
  forehand: Object.freeze({ arc: 8, lift: 12, spin: 'top', rate: 25, power: 1, hands: 1, swing: 'forehand' }),
  backhand: Object.freeze({ arc: 8, lift: 12, spin: 'back', rate: 15, power: 0.9, hands: 1, swing: 'backhand' }),
  // the overhead verbs lift the elbow over the head, which the swing system's law forbids (hero-swing.js): no clip yet
  serve: Object.freeze({ arc: -6, lift: 6, spin: 'none', rate: 0, power: 1.25, hands: 1, swing: null }),
  spike: Object.freeze({ arc: -15, lift: 8, spin: 'top', rate: 10, power: 1.3, hands: 1, swing: null }),
  // the volleyball's bare-handed touches (no gear in the hand: the swing door needs an item) and the leg: no clip yet
  bump: Object.freeze({ arc: 60, lift: 10, spin: 'none', rate: 0, power: 0.5, hands: 2, swing: null }),
  set: Object.freeze({ arc: 70, lift: 10, spin: 'none', rate: 0, power: 0.35, hands: 2, swing: null }),
  kick: Object.freeze({ arc: 15, lift: 20, spin: 'side', rate: 8, power: 1.2, hands: 0, swing: null }),
  throw: Object.freeze({ arc: 30, lift: 20, spin: 'back', rate: 5, power: 0.6, hands: 1, swing: null }),
  bat: Object.freeze({ arc: 25, lift: 15, spin: 'back', rate: 30, power: 1.5, hands: 2, swing: 'bat' }),
  putt: Object.freeze({ arc: 0, lift: 0, spin: 'top', rate: 2, power: 0.1, hands: 2, swing: null }),
});
export const HIT_VERB_IDS = Object.freeze(Object.keys(HIT_VERBS));

/** The registers' power: a ball leaves at base + gain × the tip's speed; the stick aims ± spread; spin rates × spin. */
export const HIT_REGISTERS = Object.freeze({
  realistic: Object.freeze({ base: 0, gain: 1.6, spread: 25, spin: 1 }),
  action: Object.freeze({ base: 12, gain: 1.2, spread: 35, spin: 0.4 }),
  platformer: Object.freeze({ base: 10, gain: 0.5, spread: 40, spin: 0.2 }),
  pinball: Object.freeze({ base: 15, gain: 1.5, spread: 30, spin: 0.1 }),
});

const fail = (m) => { throw new Error(`hit: ${m}`); };
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const RAD = Math.PI / 180;

function verbOf(verb) {
  const V = HIT_VERBS[verb];
  if (!V) fail(`verb '${verb}' is one of ${HIT_VERB_IDS.join(', ')}`);
  return V;
}
function registerOf(register) {
  const R = HIT_REGISTERS[register];
  if (!R) fail(`register '${register}' is one of ${Object.keys(HIT_REGISTERS).join(', ')}`);
  return R;
}

/** The hit's strike phase and live window on the game's timeline, from the swing system; a verb with no clip says so. */
export function hitWindow(verb, cls = 'normal', register = 'realistic') {
  const V = verbOf(verb);
  registerOf(register);
  if (!V.swing) return { swing: null, strike: null, window: null, says: `no swing clip plays '${verb}' yet: the hit law holds, the clip is the body's own` };
  if (!SWING_WORDS.includes(V.swing)) fail(`'${verb}' names a swing '${V.swing}' the swing system does not have`);
  const T = swingTiming(cls, register);
  if (T) return { swing: V.swing, cls, strike: T.strike, window: T.window.slice(), flavor: register };
  const K = swingKeys(V.swing, cls);
  return { swing: V.swing, cls, strike: K.strike, window: K.window.slice(), flavor: null };
}

/** Whether a swing at phase u (0 … 1 of its clip) is live for the hit. */
export function hitLive(u, verb, cls = 'normal', register = 'realistic') {
  const W = hitWindow(verb, cls, register);
  return !!W.window && u >= W.window[0] && u <= W.window[1];
}

/** The verb's spin as an angular velocity about its axis, for a ball leaving along the unit heading `d` (z up). */
function spinVector(kind, rate, d) {
  const w = rate * 2 * Math.PI;
  if (kind === 'none' || !(w > 0)) return [0, 0, 0];
  // topspin: the top of the ball turns forward, the axis up × d (a ball along +x spins about +y); backspin the other way
  const top = [-d[1], d[0], 0];
  if (kind === 'top') return top.map((v) => r4(v * w));
  if (kind === 'back') return top.map((v) => r4(-v * w));
  return [0, 0, r4(w)];   // side: about the vertical, curling left of the aim (flight.js's curl +)
}

/** The ball's velocity off the hit, by the verb, the register, the stick and the tip's speed, grown by the rally. */
export function hitVelocity({ verb, register = 'realistic', facing = 0, stick = [0, 0], tipSpeed = 0, hits = 0 } = {}) {
  const V = verbOf(verb), R = registerOf(register);
  if (!Array.isArray(stick) || stick.length !== 2 || !stick.every((s) => Number.isFinite(s) && s >= -1 && s <= 1)) fail('stick is [x, y], each -1 to 1');
  if (!(Number.isFinite(tipSpeed) && tipSpeed >= 0)) fail('tipSpeed is the swing\'s tip speed at the strike, m/s');
  if (!(Number.isInteger(hits) && hits >= 0)) fail('hits is the rally\'s clean hits so far');
  if (!BALL_REGISTERS.includes(register)) fail(`register '${register}' is one of ${BALL_REGISTERS.join(', ')}`);
  const azimuth = facing + stick[0] * R.spread * RAD;
  const elevation = (V.arc + stick[1] * V.lift) * RAD;
  const base = (R.base + R.gain * tipSpeed) * V.power;
  const speed = rallySpeed(register, hits, base);   // the arcade's rally grows the ball by its card

  const d = [Math.cos(azimuth), Math.sin(azimuth), 0];
  const velocity = [r4(speed * Math.cos(elevation) * d[0]), r4(speed * Math.cos(elevation) * d[1]), r4(speed * Math.sin(elevation))];
  const rate = r4(V.rate * R.spin);
  return { velocity, angularVelocity: spinVector(V.spin, rate, d), speed, azimuth: r4(azimuth), elevation: r4(elevation / RAD), spin: { kind: V.spin, rate } };
}

/** The hit on a sim body: the impulse that takes it from its velocity to the hit's, its new spin, and the kernel's fact. */
export function hitBall({ ball, who, at, ...rest }) {
  if (!ball || !(ball.mass > 0) || !Array.isArray(ball.velocity)) fail('ball is the sim body: { mass, velocity }');
  if (typeof who !== 'string' || !who) fail('who is the player that hit it (a1, b2 …)');
  if (!Array.isArray(at) || at.length < 2) fail('at is where the ball was hit, [x, y] in the court frame');
  const H = hitVelocity(rest);
  const impulse = H.velocity.map((v, i) => r4(ball.mass * (v - (ball.velocity[i] || 0))));
  return { impulse, velocity: H.velocity, angularVelocity: H.angularVelocity, speed: H.speed, spin: H.spin, fact: { kind: 'touch', who, at: [at[0], at[1]] } };
}
