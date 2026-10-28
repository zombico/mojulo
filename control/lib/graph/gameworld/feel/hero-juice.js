/**
 * THE HERO'S MOVEMENT JUICE — what a body's movement looks like in a platformer and in pinball, as rows the page's rig
 * juice plays (car-designer/juice.js's form, the racer's engine: a trigger over the facts, at an anchor on the body,
 * never floating free). The flavor (feel/flavor.js) says how the take PLAYS; this says what the world shows round it.
 *
 *   platformer   movement first, every beat marked: a puff off the floor at the take-off, a ring and a burst of dust on
 *                a landing (more the harder the fall), a ring of air under an air jump, a skid's dust on a hard stop,
 *                stars from a stomp or a boop, the buster's charge in its three colours, a white flash on a hit and the
 *                mercy's flicker after it
 *   pinball      speed: a trail left at the feet past running pace, the air streaking past near the top speed, speed
 *                lines on the screen on a surge, a ring of air thrown back as a boost starts, the spin dash's sparks
 *                revving in its colours, ricochet stars off a bumper, the body glowing while it revs
 *
 * The facts are the platform rule's (worlds/controllable/rules-platform.js) as the page reads them each frame:
 *   takeoff (a jump's frame), airJump (an air jump's), landed (the landing's), fall (the landing's speed, m/s),
 *   grounded, speed (along the ground, m/s), topShare (of the rule's top speed), accel, brake (a hard stop on the ground),
 *   surge, boosting, boostStart, charging, charge (0 … 1), impact (a sudden loss of speed: a bump), hit (a blow taken),
 *   invulnerable
 *
 *   HERO_JUICE                              the rows by flavor (realistic and action have none: their juice is the
 *                                           effects floor's, scene/juice-style.js)
 *   heroJuice(flavor, figure, { fidelity? })   → the figure's `juice` (bakeJuice's, marked `hero`), or null
 *
 * Anchors (the body's frame, z up from the feet): feet on the ground, body at its middle, head at its top. Sizes are
 * shares of the module D, a third of the figure's height. Pure data.
 */
import { bakeJuice } from '../../car-designer/juice.js';

const DUST = ['#f3eee2', '#c9bfab'];
export const HERO_JUICE = Object.freeze({
  platformer: Object.freeze({
    rows: {
      takeoffPuff: { when: 'takeoff', at: 'feet', look: 'puff', colours: DUST, rate: 420, life: 0.35, size: 0.32, budget: 8, why: 'the take-off: a puff off the floor where the feet left it' },
      landDust: { when: 'landed && fall > 5', at: 'feet', look: 'dust', colours: DUST, rate: 720, life: 0.45, size: 0.4, budget: 14, why: 'a hard landing: dust thrown out round the feet' },
      landRing: { when: 'landed', at: 'feet', look: 'ring', colours: ['#ffffff'], life: 0.28, size: 2.2, budget: 2, why: 'every landing: a squash ring on the floor' },
      airJumpRing: { when: 'airJump', at: 'feet', look: 'ring', colours: ['#bfe9ff'], life: 0.32, size: 1.8, budget: 2, why: 'an air jump: a ring of air under the feet it kicked off' },
      skidDust: { when: 'brake', at: 'feet', look: 'dust', colours: DUST, rate: 36, life: 0.4, size: 0.3, budget: 10, why: 'a hard stop: dust off the skidding feet' },
      buster: { when: 'charging', at: 'body', look: 'spark', colours: ['#7ad6ff', '#5dff7a', '#ffd23a'], tierBy: 'charge', tierAt: [0, 0.45, 0.95], rate: 34, life: 0.28, size: 0.16, budget: 26, why: 'the buster charging: sparks gathering in its level\'s colour' },
    },
    fx: {
      stompStars: { when: 'impact || hit', at: 'body', look: 'stars', colours: ['#fff36b', '#ffffff', '#ffb02e'], count: 6, life: 0.5, size: 0.34, why: 'a stomp or a boop: stars burst from it' },
    },
    status: {
      hit: { when: 'hit', slots: ['all'], look: 'flash', colours: ['#ffffff'], amount: 0.85, duration: 0.12, why: 'a hit: the body flashes white' },
      mercy: { when: 'invulnerable', slots: ['all'], look: 'pulse', colours: ['#ffffff'], amount: 0.5, rate: 8, why: 'the mercy after a hit: the body flickers' },
      charged: { when: 'charge > 0.95', slots: ['all'], look: 'pulse', colours: ['#ffd23a'], amount: 0.35, rate: 6, why: 'the buster full: the body pulses its colour' },
    },
  }),
  pinball: Object.freeze({
    rows: {
      speedTrail: { when: 'speed > 9', at: 'feet', look: 'trail', colours: ['#bfe9ff'], life: 0.3, size: 0.16, budget: 34, why: 'past running pace: a trail of light left at the feet' },
      spinSparks: { when: 'charging', at: 'feet', look: 'spark', colours: ['#9fdcff', '#ffffff', '#ffd23a'], tierBy: 'charge', tierAt: [0, 0.5, 0.95], rate: 70, life: 0.24, size: 0.13, budget: 44, why: 'the spin dash revving: sparks off the floor in its level\'s colour' },
      landRing: { when: 'landed && fall > 6', at: 'feet', look: 'ring', colours: ['#bfe9ff'], life: 0.25, size: 2, budget: 2, why: 'a hard landing at speed: a ring of air' },
    },
    fx: {
      motionLines: { when: 'topShare > 0.6 || boosting', at: 'body', look: 'streak', colours: ['#ffffff'], rate: 30, life: 0.2, size: 1.8, budget: 24, why: 'near the top speed: the air streaks past' },
      speedLines: { when: 'boosting || surge > 0.3', at: 'screen', look: 'screen', colours: ['#ffffff'], by: 'surge', count: 46, why: 'a surge: speed lines rush in from the screen\'s edges' },
      boostShock: { when: 'boostStart', at: 'feet', look: 'shock', colours: ['#bfe9ff', '#ffffff'], life: 0.32, size: 1.6, why: 'a boost\'s first instant: a ring of air thrown back' },
      ricochet: { when: 'impact || hit', at: 'body', look: 'stars', colours: ['#ffffff', '#7ad6ff', '#ffd23a'], count: 7, life: 0.45, size: 0.3, why: 'a bumper: the body ricochets in a burst of stars' },
    },
    status: {
      revving: { when: 'charging', slots: ['all'], look: 'pulse', colours: ['#9fdcff'], amount: 0.4, rate: 7, why: 'revving: the body glows as it spins' },
      hit: { when: 'hit', slots: ['all'], look: 'flash', colours: ['#ffffff'], amount: 0.85, duration: 0.1, why: 'a hit: the body flashes white' },
    },
  }),
});
export const HERO_JUICE_FLAVORS = Object.freeze(Object.keys(HERO_JUICE));

/** The hero's movement juice for a flavor, on its figure: its rows at the body's anchors, marked `hero` (the page reads
 *  the platform rule's facts for it); null for a flavor that has none. */
export function heroJuice(flavor, figure, { fidelity } = {}) {
  const J = HERO_JUICE[flavor];
  if (!J || !figure) return null;
  const H = Math.max(0.4, Number(figure.figH) || 1.8), r = (v) => Math.round(v * 1e4) / 1e4;
  const anchors = [
    { kind: 'feet', bone: null, at: [0, 0, 0.04], dir: [0, 0, 1] },
    { kind: 'body', bone: null, at: [0, 0, r(H * 0.55)], dir: [0, 0, 1] },
    { kind: 'head', bone: null, at: [0, 0, r(H * 0.92)], dir: [0, 0, 1] },
  ];
  const rows = Object.entries(J.rows).map(([id, row]) => ({ id, ...row }));
  return { ...bakeJuice(rows, anchors, r(H / 3), { status: J.status, fx: J.fx, ...(fidelity ? { fidelity } : {}) }), hero: true };
}
