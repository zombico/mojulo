/**
 * MIND: what the other characters decide, relative to Power and Soul. Shape as in reality.js.
 *
 * The mind matrix (lib/graph/mind/): a mind meets six situations, resolved per character from four axes. Two are
 * authored and live here, motivation and aggressiveness, beside rank (minibosses and bosses duel) and skill (a base
 * for a class, tuned per character). The other two, actions and capability, are MEASURED from the body that Power
 * and Soul give it, so a cube cannot author a mind its body cannot carry out. The authored axes' statuses are found
 * by resolving each value (mind/cosmos.js), never written here.
 *
 * The fighting strategies run in the engine's mind (worlds/controllable/mind.js), lifted whole from the arena.
 */
import { mindAxisValues } from '../../mind/cosmos.js';

const MIND_RULE = 'lib/graph/worlds/controllable/mind.js';
const AXES = mindAxisValues();

export const MIND = Object.freeze({
  id: 'mind',
  asks: 'how do the others decide?',
  settings: {
    motivation: { values: AXES.motivation },
    aggressiveness: { values: AXES.aggressiveness },
    rank: { values: AXES.rank },
    skill: { values: AXES.skill },
    perception: {
      values: {
        sight: { status: 'built', lowers: MIND_RULE, note: 'a facing cone for the counter and a line of sight to fire' },
        memory: { status: 'built', lowers: MIND_RULE, note: 'a last-seen record: it goes there, searches, then forgets' },
      },
    },
    pathing: {
      values: {
        direct: { status: 'built', lowers: MIND_RULE, note: 'straight at the target, sliding along colliders' },
        navmesh: { status: 'built', lowers: 'lib/graph/worlds/controllable/nav.js', note: 'A* over a walk grid baked from the colliders; one floor, ground only' },
      },
    },
    squad: {
      values: {
        none: { status: 'built' },
        'free-for-all': { status: 'built', lowers: MIND_RULE, note: 'targets the nearest live body (`target: all`)' },
        'team-aware': { status: 'partial', effort: 'M', lowers: MIND_RULE, note: 'skips allies when targeting (`target: enemy`); no group tactics' },
      },
    },
    social: {
      values: {
        none: { status: 'built' },
        talk: { status: 'partial', effort: 'M', lowers: 'lib/graph/era/floormap.js', note: 'a talk hotspot verb; no dialogue' },
        schedule: { status: 'absent', effort: 'L', note: 'no daily routines' },
      },
    },
    commander: {
      values: {
        none: { status: 'built' },
        builtin: { status: 'built', lowers: 'lib/graph/worlds/controllable/commander.js', note: 'the reference commander, on rule.commanded' },
        agent: { status: 'partial', effort: 'S', lowers: 'lib/graph/worlds/controllable/commander.js', note: 'hook and http ports are wired; no live model has driven one yet' },
      },
    },
  },
});
