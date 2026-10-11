/**
 * NAMED MINDS: a mind (the authored axes) on a reference body (an entity spec its measured axes are read from).
 *
 *   ARENA_TIERS   the arena's three difficulty tiers, each exactly a (skill, aggressiveness) pair: tuningOf() of the
 *                 pair equals the arena's AI_DIFFICULTY row (mind.test.js holds it)
 *   PRESETS       { [id]: { mind, body, line } }: the arena hunters, dungeon minds, the practice dummy
 *   faunaMind(id) a species' mind from the tags it already carries (fauna/behavior/tags.js): predators hunt, prey
 *                 flee, grazers and browsers forage; its body from its measured capabilities. No authoring per species
 *
 * Pure.
 */
import { SPECIES } from '../fauna/species.js';
import { tagsOf, capabilitiesOf } from '../fauna/behavior/index.js';

export const ARENA_TIERS = Object.freeze({
  easy:   { skill: 'novice', aggressiveness: 'wary' },
  medium: { skill: 'regular', aggressiveness: 'bold' },
  max:    { skill: 'ace', aggressiveness: 'opportunist' },
});

// the arena's seat body (match-modes seatRule): boost, melee seek, a spray gun and a rifle
const ARENA_BODY = Object.freeze({
  rule: { type: 'ai', boost: true, meleeSeek: true, loadout: [{ name: 'saber', strike: 'melee' }, { name: 'mg', weapon: { fireClass: 'area' } }, { name: 'rifle', weapon: { fireClass: 'sight' } }] },
  body: { hp: 140 },
});
// minds on the engine's rule: a knight with a blade, a wall archer, a champion with a blade, a spear and a dash
const KNIGHT = Object.freeze({ rule: { type: 'ai', meleeSeek: true, loadout: [{ name: 'sword', strike: 'melee' }] }, body: { hp: 90 } });
const ARCHER = Object.freeze({ rule: { type: 'ai', dodge: false }, weapon: { fireClass: 'lob' }, body: { hp: 50 } });
const CHAMPION = Object.freeze({ rule: { type: 'ai', meleeSeek: true, boost: true, loadout: [{ name: 'blade', strike: 'melee' }, { name: 'spear', weapon: { fireClass: 'sight' } }] }, body: { hp: 420 } });
const DUMMY = Object.freeze({ rule: { type: 'patrol', waypoints: [[0, 0, 0], [10, 0, 0]] }, body: { hp: 60 } });

export const PRESETS = Object.freeze({
  ...Object.fromEntries(Object.entries(ARENA_TIERS).map(([tier, axes]) => [`arena-${tier}`, {
    line: `the arena hunter at ${tier}`, mind: { motivation: 'hunt', rank: 'miniboss', ...axes }, body: ARENA_BODY,
  }])),
  'dungeon-guard': { line: 'holds a door; fights intruders at blade range', mind: { motivation: 'guard', aggressiveness: 'bold', rank: 'elite', skill: 'regular' }, body: KNIGHT },
  sentry: { line: 'a wall archer that keeps its distance', mind: { motivation: 'guard', aggressiveness: 'defensive', rank: 'minion', skill: 'novice' }, body: ARCHER },
  'champion-boss': { line: 'a boss with a blade, a spear, a charge and a dash, switching between them', mind: { motivation: 'hunt', aggressiveness: 'opportunist', rank: 'boss', skill: 'veteran' }, body: CHAMPION },
  'practice-dummy': { line: 'walks its route and never fights', mind: { motivation: 'ambient', aggressiveness: 'passive', rank: 'minion', skill: 'novice' }, body: DUMMY },
});

export function faunaMind(id) {
  const s = SPECIES[id];
  if (!s) throw new Error(`mind: no species '${id}'`);
  const tags = tagsOf(s.family, id) || [], cap = capabilitiesOf(id);
  const has = (t) => tags.includes(t);
  const motivation = has('predator') ? 'hunt' : has('prey') ? 'flee' : (has('grazer') || has('browser') || has('roots') || has('filter')) ? 'forage' : 'wander';
  const aggressiveness = has('predator') ? 'bold' : has('prey') ? 'passive' : 'defensive';
  // no fauna body holds a combat verb yet: a predator's hunt resolves to what its body can do, which today is nothing
  const body = { rule: { type: cap.wings ? 'fly' : 'walk', ...(cap.swimmer ? { swimmer: true } : {}) } };
  return { mind: { motivation, aggressiveness, rank: 'minion', skill: 'regular' }, body, tags };
}
