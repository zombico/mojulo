/** hero-gaits — the door's three GAITS (hero-motion.js MOTION_GAITS: walk, jog, sprint): the vajra motion each compiles
 * to, the dials it starts from, its tilt and its seconds. A leaf module, so a reader of the gaits' own numbers (the
 * gameworld's vibes, hero-vibe.js GAIT_BASE) loads without the motion library behind MOTION_GAITS. */
export const GAITS = Object.freeze({
  walk: Object.freeze({ motion: 'walk', base: Object.freeze({}), tilt: 0, seconds: 1.1 }),
  jog: Object.freeze({ motion: 'sprint', base: Object.freeze({ dutyFactor: 0.45, strideLength: 0.5, lean: 0.06, armSwing: 40, armBack: 1.15 }), tilt: 10, seconds: 0.7 }),
  // effort: the knee driven higher and the heel tucked tighter, a bigger arm pump with the elbows driving back, a longer
  // stride with less ground and more flight, a harder push off the forefoot
  sprint: Object.freeze({ motion: 'sprint', base: Object.freeze({ strideLength: 0.72, hipDrive: 1.7, swingTuck: 130, armSwing: 56, armBack: 1.1, elbowBend: 84, lean: 0.08, dutyFactor: 0.32, flightLift: 0.09, spineGive: 0.06, anklePoint: 20, toeFlick: 30 }), tilt: 18, seconds: 0.55 }),
});

/**
 * The hero's own walk dials, over the figure's mint table (figure-posing.js WALK_MINT) on every hero walk minted now:
 * heroLocomotion reads `duty` (the stance's share of the cycle), `heelMax` (the heel's cap at push-off, degrees) and
 * `heelRoll` (the heel rolled up through the stance by each phase's need); `strideLength` is in the rig's metres. Tuned
 * on the cast heroes: about 1.05 m/s, a 3.3 cm bob, a 58 % stance, the body no longer held low all cycle (the studied
 * walk: 0.70 m/s, 5.5 cm, the hips never less than 5.5 cm down). The figure's gait ignores the three hero dials.
 */
export const HERO_WALK = Object.freeze({ strideLength: 0.55, duty: 0.55, heelMax: 70, heelRoll: true });
