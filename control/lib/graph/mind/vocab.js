/**
 * THE MIND VOCABULARY: what any non-player character decides, said once for every mind, the way fauna/behavior says
 * once what every animal does.
 *
 * SYSTEM ORIENTATION. A mind faces SITUATIONS (`idle`, `notice`, `engage`, `strike`, `pressed`, `lost`). Each resolves
 * per character to a STRATEGY (./strategies.js) from four axes:
 *   motivation      authored: why it acts (its goal)
 *   aggressiveness  authored: how readily it engages, and the spacing and pressure knobs that say so
 *   actions         MEASURED from its body: the Power verbs it holds (./measure.js), never authored
 *   capability      MEASURED from its body: speed, flight, sight, pathing (./measure.js), never authored
 * and two more authored dials beside them:
 *   rank            minion · elite · miniboss · boss. Minibosses and bosses DUEL: they hold every strategy that
 *                   qualifies for a situation (a repertoire) and switch between them, instead of the first that does
 *   skill           how well it executes what it decided: accuracy and latency, applied after deciding. A base for a
 *                   whole class of minds, tuned per character (resolveSkill), so difficulty moves as a class and a
 *                   boss is fine-tuned
 *
 * Skill and aggressiveness are independent: a timid expert and a reckless novice are both expressible. The arena's
 * three difficulty tiers are exactly three (skill, aggressiveness) pairs (presets.js, ARENA_TIERS).
 *
 * Pure data. Nothing here reaches a plan or a page.
 */

export const SITUATIONS = Object.freeze({
  idle:    'nothing perceived: what now?',
  notice:  'something perceived: what first?',
  engage:  'in it: what distance, what rhythm?',
  strike:  'which verb, and when?',
  pressed: 'hit, staggered or clashed: what reflex?',
  lost:    'the target is gone, unreachable, or the plan stalled: what then?',
});

export const MOTIVATIONS = Object.freeze({
  hunt:        'seeks a target and fights it',
  guard:       'holds a post; engages intruders, then returns',
  territorial: 'warns, then attacks inside a radius',
  flee:        'keeps away from threats',
  forage:      'wanders to food',
  wander:      'roams without a goal',
  escort:      'stays with an ally',
  ambient:     'no goal: it is there to be met (the practice dummy)',
  sentry:      'never moves: turns to the nearest foe in range and fires (a tower, a turret)',
  frag:        'plays a match: fights whom it sees (who shot it first), hunts the noise when it sees no one, strafes as it shoots',
});

/**
 * Aggressiveness, least to most, each with the engagement knobs it sets. The knobs are the arena's aggression axis
 * (spacing, juke uptime, escape-roll laziness, knockdowns), now said for any mind. `tackleGuard` is the
 * opportunist's read: it strikes only when the target cannot answer, and stuffs a raw swing with a charge.
 */
export const AGGRESSIVENESS = Object.freeze({
  passive:     { level: 0, line: 'never attacks', knobs: null },
  defensive:   { level: 1, line: 'fights only once hurt', knobs: { dodgeCdMul: 3, standoffMul: 1.3, closeMul: 0.55, boostBurstMul: 0.5, boostRestMul: 1.8, noTopple: true } },
  wary:        { level: 2, line: 'keeps its distance; pulls its blows', knobs: { dodgeCdMul: 3, standoffMul: 1.3, closeMul: 0.55, boostBurstMul: 0.5, boostRestMul: 1.8, noTopple: true } },
  bold:        { level: 3, line: 'engages readily, mid range', knobs: { dodgeCdMul: 1.6, standoffMul: 1.12, closeMul: 0.8, boostBurstMul: 0.75, boostRestMul: 1.3 } },
  opportunist: { level: 4, line: 'full pressure, but strikes only when the target cannot answer', knobs: { dodgeCdMul: 1, standoffMul: 1, closeMul: 1, boostBurstMul: 1, boostRestMul: 1, tackleGuard: true } },
  relentless:  { level: 5, line: 'always presses in', knobs: { dodgeCdMul: 0.8, standoffMul: 0.85, closeMul: 1.2, boostBurstMul: 1.2, boostRestMul: 0.8 } },
});

export const RANKS = Object.freeze({
  minion:   { duels: false, line: 'one way to do each thing' },
  elite:    { duels: false, line: 'one way to do each thing, done well' },
  miniboss: { duels: true, line: 'a repertoire it rotates through' },
  boss:     { duels: true, line: 'a repertoire it rotates through, shifting at health phases and adapting to what works' },
});

/**
 * How a duelist moves through its repertoire. `rotate` is the arena's weapon rotation (it presses in and falls back
 * in turns); `phase` changes the repertoire's order as health falls; `adapt` drops what got punished and leans on
 * what landed (the commander's digest, said per mind).
 */
export const SWITCHES = Object.freeze({
  rotate: 'cycles its options on a cadence',
  phase:  'shifts its options at health thresholds',
  adapt:  'drops what got punished, repeats what landed',
});
export const RANK_SWITCHES = Object.freeze({ minion: [], elite: [], miniboss: ['rotate'], boss: ['rotate', 'phase', 'adapt'] });

/**
 * Skill tiers: the accuracy and latency knobs, applied after deciding (the brain believes it is locked on; the shot
 * inherits the error). `novice`, `regular` and `ace` are the arena's; `veteran` sits between the last two.
 */
export const SKILLS = Object.freeze({
  novice:  { aimWobble: 0.09, wobbleHz: 1.7, reactDelay: 1.2, burstMul: 0.5, pauseMul: 2.2 },
  regular: { aimWobble: 0.04, wobbleHz: 1.4, reactDelay: 0.55, burstMul: 0.75, pauseMul: 1.5 },
  veteran: { aimWobble: 0.02, wobbleHz: 1.2, reactDelay: 0.25, burstMul: 0.9, pauseMul: 1.2 },
  ace:     { aimWobble: 0, wobbleHz: 0, reactDelay: 0, burstMul: 1, pauseMul: 1 },
});

/** The measured words (./measure.js): what a body's verbs and senses allow. */
export const ACTIONS = Object.freeze({
  melee:  'swings a blade or a limb (a melee seek, a strike, or a blade in the loadout)',
  ranged: 'fires a weapon',
  lob:    'a ranged weapon that arcs (fire class lob)',
  area:   'a ranged weapon that sprays (fire class area)',
  dash:   'bursts of speed (boost)',
  dodge:  'an evasive roll',
  tackle: 'a body-check that beats a swing',
  jump:   'leaves the ground',
  contact: 'hurts by touch: it runs into its target (a foe class\'s contact or charge: rule.foe.touch)',
});
export const CAPABILITY = Object.freeze({
  flier:   'moves freely in three dimensions (flight or the void)',
  swimmer: 'lives suspended in water',
  route:   'has waypoints to walk',
  sight:   'sees in a facing cone with a line of sight',
  memory:  'remembers where it last saw a target, goes there and searches (rule.mind.perception: memory)',
  navmesh: 'finds paths round obstacles (rule.mind.pathing: navmesh); without it, it slides along them',
  commanded: 'a commander sets its posture at strategy rate (rule.commanded)',
});

/**
 * How a mind SEES and WATCHES, said as words a class or a game's cast names (the runtime reads their knobs:
 * worlds/controllable/mind.js perceive, the lookout's sweep and takeCover):
 *   SIGHTS   how far and how wide it sees: narrow (a guard's beam), wide (a soldier's view), keen (far, a lookout's)
 *   GAZES    still (it looks where it faces) or sweep (at its post it sweeps its gaze either side, so a sneak can time it)
 *   COVER    `cover: true`: under fire it takes cover behind what stands near and peeks out to fire
 * sightKnobs({ sight?, gaze?, cover? }) → the rule's knobs for them ({} for none).
 */
export const SIGHTS = Object.freeze({
  narrow: { line: 'sees close and in a narrow beam', knobs: { sightRange: 14, sightCone: 0.6 } },
  wide:   { line: 'sees a fair way, in a wide view', knobs: { sightRange: 30, sightCone: 1.1 } },
  keen:   { line: 'sees far, in a wide view', knobs: { sightRange: 60, sightCone: 1.2 } },
});
export const GAZES = Object.freeze({
  still: { line: 'looks where it faces', knobs: {} },
  sweep: { line: 'at its post, sweeps its gaze either side of its heading', knobs: { scan: 1.3, scanPeriod: 7 } },
});
export const COVER = Object.freeze({ line: 'under fire, takes cover behind what stands near and peeks out to fire', knobs: { cover: { radius: 7, hold: 2.5 } } });
export function sightKnobs({ sight, gaze, cover } = {}) {
  return { ...(sight ? SIGHTS[sight].knobs : {}), ...(gaze ? GAZES[gaze].knobs : {}), ...(cover ? COVER.knobs : {}) };
}

/** A rank's typical health floor: a boss under it is advised, never refused. Relative to the hero's 100. */
export const RANK_HP = Object.freeze({ minion: 0, elite: 60, miniboss: 120, boss: 300 });
