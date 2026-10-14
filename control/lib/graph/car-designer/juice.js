/**
 * THE RACER'S JUICE AND STATUS — what each game state looks like on a cartoon racer, as data. Every state the drive
 * rule writes (worlds/controllable/rules-drive.js: speed, throttle, braking, steerAngle, skidding, airborne / landed,
 * boosting) and what a game adds (damage, shield, invulnerable, item) has a visual, at an ANCHOR a part provides
 * (parts.js `fx`: an exhaust's tip, a wheel's contact, a lamp, a booster's nozzle), never one floating free.
 *
 *   JUICE    a row per effect: `when` (a trigger over the facts, written as a small expression), `at` (the anchor kind),
 *            `look` (flame, puff, smoke, dust, spark, ring, trail), its colours by tier, its rate (per second), life (s),
 *            size (share of the machine's module D), and the most of it alive at once (its budget)
 *   STATUS   a row per indicator shader: the fact it reads, the paint slots that listen (lamp, accent, body …), the look
 *            (glow, pulse, fill, flash, cycle, tint, bubble) and its colours
 *   MOTION   how the machine itself answers the facts (racer.js bones): the front wheels' steer, the body's squat, dive,
 *            lean and bounce, a mast's wobble; exaggerated past physics (a cartoon's lean is three times a car's)
 *
 * Tiers are the genre's: a drift's charge (blue, then orange, then violet), a boost's flame white-hot at its root.
 * Principles: an effect reads in a frame (big, bright, short); it never covers the driver's head; its colour says its
 * tier; the steady state is quiet (an idle puff), the event is loud (a boost). Pure data.
 */

export const DRIFT_TIERS = Object.freeze(['#58b8ff', '#ff9a2e', '#c86bff']);

export const JUICE = Object.freeze({
  idlePuff: { when: 'speed < 2 && throttle < 0.1', at: 'tip', look: 'puff', colours: ['#d8d8d8', '#9a9a9a'], rate: 2.5, life: 0.9, size: 0.18, budget: 8, why: 'the engine is alive at rest: a putt of smoke' },
  throttleFlame: { when: 'throttle > 0.6 && !boosting', at: 'tip', look: 'flame', colours: ['#fff2b0', '#ff8a2a'], flicker: 0.35, size: 0.32, budget: 1, why: 'the throttle open: a short flame flickering at the tip' },
  boostFlame: { when: 'boosting', at: 'tip', look: 'flame', colours: ['#ffffff', '#7ad6ff', '#3a6bff'], flicker: 0.15, size: 0.9, budget: 1, why: 'a boost: a long flame, white-hot at the root, the cool colour of speed' },
  boostNozzle: { when: 'boosting', at: 'boost', look: 'flame', colours: ['#ffffff', '#ffd23a', '#ff5a1a'], flicker: 0.2, size: 1.3, budget: 1, why: 'a booster lit: the biggest flame on the machine' },
  boostTrail: { when: 'boosting && speed > 8', at: 'contact.rear', look: 'trail', colours: ['#7ad6ff'], life: 0.35, size: 0.12, budget: 2, why: 'speed lines off the rear wheels while boosting' },
  driftSpark: { when: 'skidding && abs(steer) > 0.2 && speed > 6', at: 'contact.rear', look: 'spark', colours: DRIFT_TIERS, tierBy: 'skidTime', tierAt: [0, 0.8, 1.8], rate: 40, life: 0.25, size: 0.06, budget: 60, why: 'a drift charging: sparks from the rear tyres, their colour the charge' },
  skidSmoke: { when: 'skidding || (braking && speed > 10)', at: 'contact.rear', look: 'smoke', colours: ['#e6e6e6', '#bdbdbd'], rate: 18, life: 0.8, size: 0.4, budget: 24, why: 'rubber smoke where the tyres slide' },
  surfaceDust: { when: 'speed > 4 && surface != "asphalt"', at: 'contact.rear', look: 'dust', colours: ['$surface'], rate: 14, life: 0.7, size: 0.35, budget: 20, why: 'off the tarmac the wheels throw the ground they are on' },
  landingRing: { when: 'landed', at: 'contact', look: 'ring', colours: ['$surface', '#ffffff'], life: 0.4, size: 1.6, budget: 4, why: 'a landing: a ring of dust where the wheels hit' },
  damageSmoke: { when: 'damage > 0.6', at: 'tip', look: 'smoke', colours: ['#3a3a3a', '#6a6a6a'], rate: 8, life: 1.4, size: 0.5, budget: 14, why: 'hurt: black smoke from the engine' },
});

export const STATUS = Object.freeze({
  headlamps: { fact: 'always', slots: ['lamp:head'], look: 'glow', colours: ['#fff6d0'], why: 'the face lit' },
  brakeLamps: { fact: 'braking', slots: ['lamp:brake'], look: 'glow', colours: ['#5a1010', '#ff2a1a'], why: 'the brake lamps flare red' },
  boostReady: { fact: 'boostCharge', slots: ['accent'], look: 'fill', colours: ['#2a3a5a', '#7ad6ff', '#ffffff'], why: 'the hero piece fills with charge; full, it glows white' },
  driftTier: { fact: 'skidTime', slots: ['lamp:brake', 'accent'], look: 'cycle', colours: DRIFT_TIERS, why: 'the drift\'s tier in the lamps' },
  hit: { fact: 'hit', slots: ['body', 'accent'], look: 'flash', colours: ['#ffffff'], duration: 0.12, why: 'a hit: the machine flashes white' },
  damaged: { fact: 'damage', slots: ['body'], look: 'tint', colours: ['#000000'], amount: 0.35, flicker: 0.6, why: 'damage darkens and flickers the paint' },
  shield: { fact: 'shield', slots: ['bubble'], look: 'bubble', colours: ['#8fe6ff'], rim: 0.8, why: 'a shield: a bright-rimmed bubble round the machine' },
  invulnerable: { fact: 'invulnerable', slots: ['body', 'accent'], look: 'cycle', colours: ['#ff4b4b', '#ffd23a', '#5dff7a', '#4bc3ff', '#c86bff'], rate: 8, why: 'a star: the colours cycling' },
  itemHeld: { fact: 'item', slots: ['accent'], look: 'pulse', colours: ['#ffffff'], rate: 2, why: 'an item held: the hero piece pulses' },
});

/** How the machine answers the facts: the bone, the fact, the gain (exaggerated), the limit, the return (s). */
export const MOTION = Object.freeze({
  steer: { bone: 'steerF', fact: 'steerAngle', gain: 1.6, limit: 0.6, why: 'the front wheels turn more than the road needs: the turn reads' },
  lean: { bone: 'body', fact: 'steerAngle * speed', gain: 0.08, limit: 0.22, why: 'the body leans out of a turn, three times a car\'s' },
  squat: { bone: 'body', fact: 'throttle', gain: 0.1, limit: 0.1, settle: 0.25, why: 'the nose lifts and the tail squats on the throttle' },
  dive: { bone: 'body', fact: 'braking', gain: 0.12, limit: 0.12, settle: 0.2, why: 'the nose dives on the brake' },
  bounce: { bone: 'body', fact: 'landed', gain: 0.25, limit: 0.25, settle: 0.45, why: 'a landing: the body squashes and springs back' },
  wobble: { bone: 'mast', fact: 'speed', gain: 0.03, limit: 0.35, why: 'a mast whips behind as it goes' },
});
