/**
 * MIND: what the other characters decide, relative to Power and Soul. Shape as in reality.js.
 *
 * The mind matrix (lib/graph/mind/): a mind meets six situations, resolved per character from four axes. Two are
 * authored and live here, motivation and aggressiveness, beside rank (minibosses and bosses duel) and skill (a base
 * for a class, tuned per character). The other two, actions and capability, are MEASURED from the body that Power
 * and Soul give it, so a cube cannot author a mind its body cannot carry out. The authored axes' statuses are found
 * by resolving each value (mind/cosmos.js), never written here.
 *
 * Most of it runs today only inside the arena's hunter brain (mobile-suit/ms-ai.js): `local`, the mind-lift package.
 */
import { mindAxisValues } from '../../mind/cosmos.js';

const ARENA = 'lib/graph/mobile-suit/ms-ai.js';
const MODES = 'lib/graph/worlds/match-modes.js';
// one change fills every arena-local value: lifting the hunter brain into a general mind
const LIFT = { status: 'local', effort: 'M', pkg: 'mind-lift' };
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
        sight: { ...LIFT, lowers: ARENA, note: 'a facing cone and a line of sight, in the arena brain only' },
        memory: { status: 'absent', effort: 'M', note: 'no memory of where a target was last seen; no search' },
      },
    },
    pathing: {
      values: {
        direct: { ...LIFT, lowers: ARENA, note: 'straight at the target, sliding along colliders' },
        navmesh: { status: 'absent', effort: 'M', note: 'no pathfinding found (10-10); the walk grid is server side only' },
      },
    },
    squad: {
      values: {
        none: { status: 'built' },
        'free-for-all': { ...LIFT, lowers: MODES, note: 'targets the nearest live body; the arena brain only' },
        'team-aware': { ...LIFT, lowers: MODES, note: 'skips allies when targeting; no group tactics' },
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
        builtin: { status: 'local', effort: 'L', pkg: 'commander', note: 'mobile-suit/agent-commander.js is untracked: a 0807 spike' },
        agent: { status: 'local', effort: 'L', pkg: 'commander', note: 'the hook and http transports of the untracked commander' },
      },
    },
  },
});
