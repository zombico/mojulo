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
