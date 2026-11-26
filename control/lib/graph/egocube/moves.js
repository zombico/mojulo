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
 *   beastMovesOf(species, { strike? })→ { motion: [gaits…, reactions…], states }: a beast's animal `motion` (its two
 *                          gaits and its flinch, fall and rise: fauna/behavior/react.js) and the field states they play;
 *                          with `strike` (true, or its attack's { startup, active, recovery }) and a body that can deal
 *                          one (fauna/behavior/strike.js), the motion's object form carrying it, played by the swing
 *   beastMovesOf(species, { strike, way })  → the same with its swing an attack card's way (foes/attacks.js: a snap, a
 *                          maul), its clip at the strike's timing, where the body has that way
 *   beastMovesOf(species, { battle: true }) → a party battle's beast: its strike and its other ways at a foe (a snap, a
 *                          maul, its roar: fauna/behavior/strike.js) as its acts by name, strike, strike2, strike3, roar
 *   foeBattleMovesOf(role, { archetype?, armed? }) → a party battle's person foe: a member's repertoire and a roar
 *   beastFieldOf(species, { strike?, battle? }) → a beast's figure on the level map: its own gaits as the walker's states, its
 *                          reactions (and its strike) as its moves (a cast's beast, a battle's beast foe, a fielded
 *                          foe); throws for a species the fauna does not know
 *   REACT_MOTION          the reactions any person a run makes may carry (a world's `moves`): a hit, a stagger, the
 *                          fall and the rise, as hero motion words
 *   reactStatesOf(words)  → the field states the reactions among a figure's motion words play, or null (none)
 *
 * Pure. First readings, for the eyes gate.
 */
import { MOTION_GAITS } from '../polygonizer/hero-motion.js';
import { motionGaits, motionReactions } from '../fauna/rig.js';
import { strikesOf, strikeWaysOf } from '../fauna/behavior/strike.js';

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

/**
 * A PARTY BATTLE'S REPERTOIRE (a member who fights in the party, `bond: 'party'`, and the hero of a world of party
 * battles): enough moves that a fight is not one blow over and over. Three attacks by its role (the page plays them in
 * turn, varied), a cast by its role for a skill, a thumbs-up for an item, four ways to take a blow, its ready stance
 * held while it fights and its win pose, and its CHANNEL (hero-aura.js `channel`: the hands drawn up to cup a gathering
 * power before the chest, the set-up a spell or an ability plays before it goes off). The states are the names the
 * battle's acts look for (rpg-channel.js juice, the controllable channel's __ACT_CLIPS): strike, strike2, strike3,
 * channel, cast, use, hurt, hurt2, hurt3, ready, win.
 */
export const BATTLE_ATTACKS_OF_ROLE = Object.freeze({
  frontline: ['cross', 'hook', 'uppercut'], flanker: ['jab', 'bodyHook', 'thrust'], ranged: ['jab', 'crossLeft', 'thrustLeft'],
  controller: ['jab', 'cross', 'hookLeft'], caster: ['jab', 'cross', 'hookLeft'], support: ['jab', 'cross', 'hookLeft'],
});
export const BATTLE_CAST_OF_ROLE = Object.freeze({ frontline: 'fistCrush', flanker: 'killerQueen', ranged: 'fingerGuns', controller: 'josephPoint', caster: 'jotaroPoint', support: 'fistToSky' });
const BATTLE_HURTS = ['hitHigh', 'hitBody', 'hitLow'], BATTLE_USE = 'niceGuy';
export const BATTLE_CHANNEL = 'channel';
// (a party class's role, for the hero of a world of party battles, whose sheet is the hero door's and not a member's)
export const ROLE_OF_CLASS = Object.freeze({ fighter: 'frontline', knight: 'frontline', monk: 'flanker', rogue: 'flanker', mage: 'caster', cleric: 'support' });
/** The play.rpg class (playscape/rpg/presets.js) a person's facets read as: a frontliner a knight when ordered (or a
 * hero, a ruler, a caregiver), else a fighter; a flanker a monk when ordered, else a rogue; a caster or a controller a
 * mage; a ranged one a rogue; the rest clerics (gameworld/casting.js classOf reads a member by it). */
export function classOfFacets(f) {
  if (f.role === 'frontline') return f.order < 1 / 3 || ['hero', 'ruler', 'caregiver'].includes(f.archetype) ? 'knight' : 'fighter';
  if (f.role === 'flanker') return f.order < 1 / 3 ? 'monk' : 'rogue';
  if (f.role === 'caster' || f.role === 'controller') return 'mage';
  if (f.role === 'ranged') return 'rogue';
  return 'cleric';
}
/**
 * THE VICTORY POSES a class strikes when a fight is won (hero-aura.js, the `victory` family; a starter each): the
 * fighter's champion, its blade thrust up; the knight's salute, its hilt before the chin; the rogue's ease, its fist cocked
 * by the shoulder; the mage's triumph, its staff planted and a hand to the sky; the cleric's thanks, palms pressed; the
 * monk's martial salute, a fist in the palm and a bow. One with no class cheers. A world names its own per class
 * (`battles.wins`, any motion word: another pose of the hero door's, or its own).
 */
export const WIN_OF_CLASS = Object.freeze({ fighter: 'victoryRaise', knight: 'victorySalute', rogue: 'victoryShoulder', mage: 'victoryStaff', cleric: 'victoryPrayer', monk: 'victoryBow' });
export const VICTORY_CHEER = 'victoryCheer';

/**
 * A party class's WEAPON in hand (the hero door's `gear`, hero-gear.js): the fighter's greatsword, the knight's sword and
 * shield, the rogue's dagger, the mage's short staff and the cleric's mace; the monk fights with its fists. One who holds a blade or
 * a haft strikes with it: the page bakes its held swings on its own rig (world-kinds.js, the held strike: the cut, the
 * thrust and the cleave, `swing_neutral`, `swing_forward`, `swing_back`), and those are its three attacks.
 */
export const WEAPON_OF_CLASS = Object.freeze({
  fighter: Object.freeze({ right: Object.freeze({ item: 'greatsword' }) }),
  knight: Object.freeze({ right: Object.freeze({ item: 'sword' }), left: Object.freeze({ item: 'shield' }) }),
  rogue: Object.freeze({ right: Object.freeze({ item: 'dagger' }) }),
  // (a caster's staff on an arm's haft, swung head first as a blade is; a long staff is walked with, its heel by the floor,
  // and swung from the wrong end: hero-gear.js; the cleric's a mace)
  mage: Object.freeze({ right: Object.freeze({ item: 'staff', style: 'druid', parts: Object.freeze({ hilt: 'arm' }) }) }),
  cleric: Object.freeze({ right: Object.freeze({ item: 'staff', style: 'celestial', parts: Object.freeze({ hilt: 'arm', end: 'mace' }) }) }),
});
export const ARMED_ATTACKS = Object.freeze(['swing_neutral', 'swing_forward', 'swing_back']);
/** A person foe's ROAR: the threat a boss opens its fight with and a summoned foe enters by (an aura: the deep squat,
 * both fists flexed by the head, the face shouting). */
export const FOE_ROAR = 'recoome';
/** The gear a party class holds, as the hero door takes it (a fresh copy), or null (fists). */
export const weaponOfClass = (cls) => (WEAPON_OF_CLASS[cls] ? structuredClone(WEAPON_OF_CLASS[cls]) : null);

/** A party fighter's battle moves: { motion: { <word>: true }, states: { strike…win: <word> } }. `armed`: it holds a
 * weapon (WEAPON_OF_CLASS), its attacks the held swings the page bakes, so none of its fists' is minted. `cls`: its class,
 * its victory pose its class's (WIN_OF_CLASS); `win` a pose of its own over it; neither, its archetype's showcase. */
export function battleMovesOf(role, { archetype = null, armed = false, cls = null, win = null } = {}) {
  const r = BATTLE_ATTACKS_OF_ROLE[role] ? role : 'frontline', [a1, a2, a3] = armed ? ARMED_ATTACKS : BATTLE_ATTACKS_OF_ROLE[r];
  const states = { strike: a1, strike2: a2, strike3: a3, channel: BATTLE_CHANNEL, cast: BATTLE_CAST_OF_ROLE[r], use: BATTLE_USE, hurt: BATTLE_HURTS[0], hurt2: BATTLE_HURTS[1], hurt3: BATTLE_HURTS[2], ready: READY_OF_ROLE[r], win: win ?? WIN_OF_CLASS[cls] ?? WIN_OF_ARCHETYPE[archetype] ?? VICTORY_CHEER };
  const words = Object.values(states).filter((w) => !ARMED_ATTACKS.includes(w));
  return { motion: Object.fromEntries([...new Set([...words, ...Object.keys(REACT_MOTION)])].map((w) => [w, true])), states };
}

/** A PARTY BATTLE'S PERSON FOE: a member's repertoire by its role (its strikes, its cast, its recoils, its ready
 * stance) and its roar, the act a boss opens its fight with and a summoned foe enters by (rpg-channel.js). */
export function foeBattleMovesOf(role, { archetype = null, armed = false } = {}) {
  const B = battleMovesOf(role, { archetype, armed });
  return { motion: { ...B.motion, [FOE_ROAR]: true }, states: { ...B.states, roar: FOE_ROAR } };
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
// (every way a mind swings plays the one blow: a beast has no cleave of its own yet)
const SWINGS = ['neutral', 'forward', 'back', 'left', 'right'];
// (a party battle's beast: its strike and its other ways at a foe, fauna/behavior/strike.js, as the acts the page plays
// them by, strike, strike2, strike3 in turn, its roar and its channel; a body that cannot strike has none of them)
const BATTLE_WAYS = Object.freeze({ snap: 'strike2', maul: 'strike3', roar: 'roar', channel: 'channel' });
export function beastMovesOf(species, { strike, battle = false, way = null } = {}) {
  const reacts = motionReactions(species), gaits = beastGaitsOf(species);
  // (a strike at its attack's timing: the motion's object form; without one the words, as always)
  const struck = (strike || battle) && strikesOf(species).length ? strike || true : null;
  const ways = battle && struck ? strikeWaysOf(species).filter((w) => BATTLE_WAYS[w]) : [];
  // (a body with no maul, a snake, varies its two)
  const acts = ways.length ? { strike: 'strike', ...Object.fromEntries(ways.map((w) => [BATTLE_WAYS[w], w])) } : {};
  // (an attack card's WAY, foes/attacks.js: its swing plays that way's clip, at the attack's own timing, where the body
  // has it; the lunge, or a way the body has not, plays the strike as always)
  const own = struck && way && way !== 'strike' && strikeWaysOf(species).includes(way) ? way : null;
  const strikes = { ...Object.fromEntries(ways.map((w) => [w, true])), ...(own ? { [own]: struck } : {}) };
  return {
    motion: struck ? { gaits, ...(reacts.length ? { reactions: reacts } : {}), strike: struck, ...(Object.keys(strikes).length ? { strikes } : {}) } : [...gaits, ...reacts],
    states: { ...(reacts.length ? { stagger: 'flinch', topple: 'fall', getup: 'rise' } : {}), ...(struck ? Object.fromEntries(SWINGS.map((d) => [`swing_${d}`, own ?? 'strike'])) : {}), ...acts },
  };
}

export function beastFieldOf(species, { strike, battle = false, way = null } = {}) {
  const g = beastGaitsOf(species), M = beastMovesOf(species, { strike, battle, way });
  return { own: { forward: g.at(-1), turn: g[0], strafe: g.at(-1) }, ...(Object.keys(M.states).length ? { moves: M.states } : {}) };
}
