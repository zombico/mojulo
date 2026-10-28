/**
 * THE UNDEAD'S WALKS: each a word for how one kind of dead moves, as the walk's own dials (polygonizer/figure-posing.js
 * WALK_DEFAULTS and UNDEAD_GAIT: hobble, stiff, drag, hitch, shortStep, lurch, stagger, jerk, armReach; the skeleton's
 * unbound, flail, loll, swivel, snap, chatter) with its
 * cycle's seconds. A HOBBLE is optional: a walk names how one bad leg moves and the odds a body has one (seeded; the
 * hero's `undead.hobble` says yes or no outright).
 *
 *   shamble   the dead walking: slow, the arms reaching, the trunk swaying and the steps stumbling; a dragged foot
 *   creep     starved and folded: long deep-kneed strides, the head thrust out, the arms hanging
 *   waddle    swollen: a wide base, the trunk heaving side to side over each foot
 *   drag      a giant's corpse hauling a dead leg: the stiff leg swung round and dragged, the trunk lurching onto it
 *   stumble   newly risen: the steps mistimed, the arms coming up, the trunk lurching
 * A SKELETON'S walks (march, clatter, lumber, trundle, scuttle) are UNBOUND: no flesh holds its bones to a person's
 * ranges, so its arms are flung past the swing, its skull lolls and turns half round, its hips wrench, its knees snap
 * back and its jaw clatters (figure-posing.js UNDEAD_GAIT: unbound, flail, loll, swivel, snap, chatter).
 *
 *   march     a soldier's bones: stiff-kneed, staccato, snapped from pose to pose as a marionette is
 *   clatter   long loose bones: long strides rattling unevenly, the arms swinging wide
 *   lumber    a giant's bones: slow and heavy, rolling over each foot
 *   trundle   short heavy bones: short quick steps rocking from side to side
 *   scuttle   the attack skeleton: low, quick and jerky, the clawed hands held up
 *
 *   UNDEAD_GAITS       the walks
 *   gaitOf(card, layers)   → the walk word a card walks (the attack skeleton's scuttle over its card's own)
 *   walkDials(word, { hobbled, side, stride })   → the walk's dials for the hero's `motion.walk` (its stride the
 *                      hero's own × the walk's share), the hobble's laid in when `hobbled`
 *
 * Pure.
 */
export const UNDEAD_GAITS = Object.freeze({
  shamble: { stride: 0.55, dials: { stanceKnee: 14, swingLift: 30, armSwing: 6, armReach: 60, lean: 0.25, headTilt: 14, lurch: 0.45, stagger: 0.25 }, seconds: 1.9, hobble: { odds: 0.7, stiff: 0.5, drag: 0.9, hitch: 0.5, shortStep: 0.5 } },
  creep: { stride: 0.9, dials: { stanceKnee: 34, swingLift: 62, armSwing: 4, armReach: 12, lean: 0.5, headTilt: 26, stagger: 0.15 }, seconds: 2.3, hobble: { odds: 0.3, stiff: 0.2, drag: 0.3, hitch: 0.3, shortStep: 0.3 } },
  waddle: { stride: 0.45, dials: { stepWidth: 0.32, stanceKnee: 10, swingLift: 24, armSwing: 12, armReach: 18, lean: -0.05, lurch: 0.9 }, seconds: 1.7, hobble: { odds: 0.2, stiff: 0.3, drag: 0.3, hitch: 0.5, shortStep: 0.3 } },
  drag: { stride: 0.6, dials: { stanceKnee: 22, swingLift: 34, armSwing: 8, armReach: 10, lean: 0.4, headTilt: 16, lurch: 0.6 }, seconds: 2.1, hobble: { odds: 1, stiff: 0.8, drag: 1, hitch: 0.9, shortStep: 0.6 } },
  stumble: { stride: 0.8, dials: { stanceKnee: 12, swingLift: 40, armSwing: 16, armReach: 35, lean: 0.12, headTilt: 8, stagger: 0.7, lurch: 0.35 }, seconds: 1.35, hobble: { odds: 0.3, stiff: 0.3, drag: 0.4, hitch: 0.3, shortStep: 0.3 } },
  march: { stride: 0.95, dials: { stanceKnee: 4, swingLift: 44, armSwing: 20, elbowBase: 8, jerk: 0.7, unbound: 2, flail: 0.35, loll: 0.3, swivel: 0.5, snap: 0.6, chatter: 0.4 }, seconds: 1.2, hobble: { odds: 0.2, stiff: 0.6, drag: 0.2, hitch: 0.2, shortStep: 0.4 } },
  clatter: { stride: 1, dials: { stanceKnee: 8, swingLift: 58, armSwing: 28, jerk: 0.35, stagger: 0.4, lurch: 0.3, unbound: 2.5, flail: 1, loll: 0.8, swivel: 0.8, snap: 0.4, chatter: 0.8 }, seconds: 1.15, hobble: { odds: 0.3, stiff: 0.4, drag: 0.5, hitch: 0.4, shortStep: 0.4 } },
  lumber: { stride: 0.8, dials: { stanceKnee: 22, swingLift: 36, armSwing: 10, lean: 0.3, headTilt: 10, lurch: 0.7, jerk: 0.2, unbound: 2, flail: 0.3, loll: 0.6, swivel: 0.6, snap: 0.5, chatter: 0.4 }, seconds: 1.8, hobble: { odds: 0.4, stiff: 0.5, drag: 0.6, hitch: 0.6, shortStep: 0.4 } },
  trundle: { stride: 0.5, dials: { stepWidth: 0.26, stanceKnee: 16, swingLift: 30, armSwing: 18, lurch: 0.5, jerk: 0.25, unbound: 2, flail: 0.5, loll: 0.5, swivel: 1, snap: 0.3, chatter: 0.6 }, seconds: 0.9, hobble: { odds: 0.25, stiff: 0.4, drag: 0.4, hitch: 0.4, shortStep: 0.3 } },
  scuttle: { stride: 0.7, dials: { stanceKnee: 42, swingLift: 46, armSwing: 8, armReach: 40, elbowBase: 60, lean: 0.45, headTilt: -6, jerk: 0.4, stagger: 0.2, unbound: 2.5, flail: 0.6, loll: 0.7, swivel: 0.5, snap: 0.3, chatter: 1 }, seconds: 0.75, hobble: { odds: 0.15, stiff: 0.3, drag: 0.3, hitch: 0.3, shortStep: 0.3 } },
});

export const gaitOf = (card, layers = []) => (card.form === 'bone' && layers.includes('attack') ? 'scuttle' : card.gait);

export function walkDials(word, { hobbled = false, side = 1, stride }) {
  const G = UNDEAD_GAITS[word];
  if (!G) throw new Error(`undead: no walk '${word}' (walks: ${Object.keys(UNDEAD_GAITS).join(', ')})`);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const { odds: _o, ...hob } = G.hobble ?? {};
  return { strideLength: r3(stride * G.stride), ...G.dials, ...(hobbled && G.hobble ? { hobble: 1, hobbleSide: side < 0 ? -1 : 1, ...hob } : {}), seconds: G.seconds };
}
