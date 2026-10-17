/**
 * A CAST MEMBER'S MOVES: the clips a character needs to play its part, read from its sheet, so the character loop
 * orchestrates its animation as it does its look. Each is a hero `motion` word (polygonizer/hero-motion.js), solved on
 * the character's own rig at mint and shown on its page by the clip picker:
 *
 *   ready    the stance it fights from, by its role             (a frontline guard, a flanker low, a caster centred)
 *   attack   what it does to a foe, by its role                 (a frontline cross, a flanker jab, a caster's point)
 *   react    how it takes a blow: a hit and a stagger (the versus fighter's own, hero-react.js); a fighter also topples
 *            and gets up (the rest `knockedOut`: knockedOutDown, knockedOutUp)
 *   win      its showcase pose, by its archetype                (the hero's fist to the sky, the ruler's crossed arms)
 *
 * A non-combatant gets no ready, no attack and no topple: a hit and its win. Absent from every character but a cast's
 * member on the hero door (egocube/kind.js `egocubeCreate`).
 *
 *   moveSetOf(facets)    → { motion: { <word>: true }, moves: { ready?, attack?, react: [..], win } }
 *   fieldStatesOf(moves) → the controllable runtime's states its own moves play on the level map (a hit's lurch, the
 *                          topple and the rise, a swing), for a figure's `clips` beside its library's
 *
 * Pure. First readings, for the eyes gate.
 */
export const READY_OF_ROLE = Object.freeze({ frontline: 'guard', flanker: 'low', support: 'centre', controller: 'centre', caster: 'centre', ranged: 'athletic' });
export const ATTACK_OF_ROLE = Object.freeze({ frontline: 'cross', flanker: 'jab', ranged: 'jab', controller: 'josephPoint', caster: 'jotaroPoint', support: 'fistToSky' });
export const WIN_OF_ARCHETYPE = Object.freeze({
  innocent: 'peaceWink', explorer: 'fistToSky', sage: 'glassesPush', hero: 'fistToSky', outlaw: 'pocketsCool', magician: 'dioBack',
  everyman: 'niceGuy', jester: 'fingerGuns', lover: 'hairToss', caregiver: 'heroHips', creator: 'jotaroPoint', ruler: 'crossedArms',
});

/** A member's moves from its facets (a sheet's, or a beast's or a mascot's temperament). */
export function moveSetOf(f) {
  const fights = f.role !== 'non-combatant';
  const moves = {
    ...(fights && READY_OF_ROLE[f.role] ? { ready: READY_OF_ROLE[f.role] } : {}),
    ...(fights && ATTACK_OF_ROLE[f.role] ? { attack: ATTACK_OF_ROLE[f.role] } : {}),
    react: fights ? ['hitHigh', 'stagger', 'knockedOut'] : ['hitHigh'],
    win: WIN_OF_ARCHETYPE[f.archetype],
  };
  const words = [moves.ready, moves.attack, ...moves.react, moves.win].filter(Boolean);
  return { motion: Object.fromEntries([...new Set(words)].map((w) => [w, true])), moves };
}

/** The runtime's states (worlds/controllable: combat-hit.js, combat-melee.js) a member's own moves play on the field. */
export function fieldStatesOf(moves) {
  const react = new Set(moves.react);
  return {
    stagger: react.has('stagger') ? 'stagger' : 'hitHigh',
    ...(react.has('knockedOut') ? { topple: 'knockedOutDown', getup: 'knockedOutUp' } : {}),
    ...(moves.attack ? { swing_neutral: moves.attack, swing_forward: moves.attack } : {}),
  };
}
