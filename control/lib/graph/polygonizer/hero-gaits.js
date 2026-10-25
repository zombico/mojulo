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
 * heroLocomotion reads `duty` (the stance's share of the cycle), `heelMax` (the heel's cap at push-off, degrees),
 * `heelRoll` (the heel rolled up through the stance by each phase's need) and `swingFoot` (HERO_RUN); `strideLength` is
 * in the rig's metres. Tuned
 * on the cast heroes: about 1.05 m/s, a 3.3 cm bob, a 58 % stance, the body no longer held low all cycle (the studied
 * walk: 0.70 m/s, 5.5 cm, the hips never less than 5.5 cm down). The figure's gait ignores the hero dials.
 * `swingClear` (m) is the least gap the legs keep as the swing leg passes the planted one (hero-stride.js): on the walk's
 * narrow base the swing foot goes round the planted leg by the least excursion that keeps it, out after the lift-off and
 * back onto its line late, past the planted foot. It needs the body's leg girths (the recipe's `locomotion` carries them,
 * layered.js); a walk stored before it passes straight through, as it did.
 */
export const HERO_WALK = Object.freeze({ strideLength: 0.55, duty: 0.55, heelMax: 70, heelRoll: true, swingFoot: true, swingClear: 0.008 });

/**
 * A walk by the hero's SILHOUETTE, over HERO_WALK (stampHeroMotion `pole`, the adult cast's: a child or a chibi walks the
 * one walk). The MAN walks a wider base: on the narrow one (`stepWidth` 0.05) his ankles came onto one line as they
 * passed and his legs ran 5 to 6 cm through each other but for the swing's going round (hero-stride.js); at 0.16 his
 * feet land 10 to 11 cm apart (men's heels about 10 to 13), his legs clear each other on their own (the game body by
 * 0.9 cm, the realistic by 2.3) and the swing goes straight through, no crossing and no going round. The woman keeps the
 * near-single line, her hips carrying it.
 */
export const HERO_WALK_POLE = Object.freeze({ male: Object.freeze({ stepWidth: 0.16 }) });

/**
 * The hero's own run dials (the jog and the sprint), over the figure's mint table (figure-posing.js SPRINT_MINT):
 * heroLocomotion reads `swingFoot`, as it does on the walk (HERO_WALK). With it, a foot in its swing follows its own
 * shank (the gait's own ankle, its `anklePoint` and `toeFlick`), so a run's recovery tucks the heel up with the toes
 * trailing down and back; without it (a hero stored before), the swing foot is held level with the floor, and as the
 * knee folds the toes point forward. The figure's gait ignores it.
 */
export const HERO_RUN = Object.freeze({ swingFoot: true });
