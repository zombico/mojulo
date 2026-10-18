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
 *                          topple and the rise, a swing), for a figure's `moves` beside its library's
 *   creatureMovesOf(f)   → the same for a body below the hero door (a beast-kin on the creature loop's rig): a walk and
 *                          a jog to cross the field, and the moves its rig can solve (a stance, a strike, the reactions,
 *                          the fall); a showcase pose is a person's
 *   beastGaitsOf(species)→ [walk, run]: the two gaits a beast crosses the field in (fauna/locomotion), slowest first
 *   beastMovesOf(species)→ { motion: [gaits…, reactions…], states }: a beast's animal `motion` (its two gaits and its
 *                          flinch, fall and rise: fauna/behavior/react.js) and the field states they play
 *   beastFieldOf(species) → a beast's figure on the level map: its own gaits as the walker's states, its reactions as
 *                          its moves (a cast's beast, a battle's beast foe); throws for a species the fauna does not know
 *   REACT_MOTION          the reactions any person a run makes may carry (a world's `moves`): a hit, a stagger, the
 *                          fall and the rise, as hero motion words
 *   reactStatesOf(words)  → the field states the reactions among a figure's motion words play, or null (none)
 *
 * Pure. First readings, for the eyes gate.
 */
import { MOTION_GAITS } from '../polygonizer/hero-motion.js';
import { motionGaits, motionReactions } from '../fauna/rig.js';

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

export const REACT_MOTION = Object.freeze({ hitHigh: true, stagger: true, knockedOut: true });

export function reactStatesOf(words) {
  const has = new Set(words ?? []);
  if (!has.has('hitHigh') && !has.has('stagger')) return null;
  return { stagger: has.has('stagger') ? 'stagger' : 'hitHigh', ...(has.has('knockedOut') ? { topple: 'knockedOutDown', getup: 'knockedOutUp' } : {}) };
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

/** The families a creature's rig solves (a showcase pose reaches for a person's shoulders and hands). */
const CREATURE_FAMILIES = new Set(['stance', 'strike', 'react']);
/** A beast-kin below the hero door: its walk and jog, and the moves of its set its rig can solve. */
export function creatureMovesOf(f) {
  const { moves } = moveSetOf(f), ok = (w) => w && (MOTION_GAITS[w]?.motion === 'rest' || CREATURE_FAMILIES.has(MOTION_GAITS[w]?.family));
  const own = { ...(ok(moves.ready) ? { ready: moves.ready } : {}), ...(ok(moves.attack) ? { attack: moves.attack } : {}), react: moves.react.filter(ok) };
  const words = ['walk', 'jog', own.ready, own.attack, ...own.react].filter(Boolean);
  return { motion: Object.fromEntries([...new Set(words)].map((w) => [w, true])), moves: own };
}

/** The two gaits a beast crosses the field in: its walk (else its slowest), and the next one that keeps its feet down
 * or hops (not a flight or a glide, not a stalk); one gait when it has no other. */
export function beastGaitsOf(species) {
  const all = motionGaits(species), walk = all.includes('walk') ? 'walk' : all[0];
  const run = all.slice(all.indexOf(walk) + 1).find((g) => !['fly', 'glide', 'stalk', 'swim', 'soar'].includes(g)) ?? walk;
  return [...new Set([walk, run])];
}

/** A beast's motion: its two gaits and its reactions (a swimmer has none); and the field states the reactions play. */
export function beastMovesOf(species) {
  const reacts = motionReactions(species);
  return {
    motion: [...beastGaitsOf(species), ...reacts],
    states: reacts.length ? { stagger: 'flinch', topple: 'fall', getup: 'rise' } : {},
  };
}

export function beastFieldOf(species) {
  const g = beastGaitsOf(species), M = beastMovesOf(species);
  return { own: { forward: g.at(-1), turn: g[0], strafe: g.at(-1) }, ...(Object.keys(M.states).length ? { moves: M.states } : {}) };
}
