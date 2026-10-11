/**
 * MIND: what the other characters decide, relative to Power and Soul. Shape as in reality.js.
 *
 * Seeded from the mobile-suit arena (10-10). Its hunter brain (`ai`, mobile-suit/ms-ai.js) ships in the controllable
 * emission but was built for that one game: suit fields, an arena genre. So most values here are `local`: a mine to
 * lift into a general mind, not a capability yet. The commander (agent-commander.js) is not tracked at all.
 */
const ARENA = 'lib/graph/mobile-suit/ms-ai.js';
const HUNTER = 'the arena hunter brain only: built for suits, not a general mind';
// one change fills every arena-local value: lifting the hunter brain into a general mind
const LIFT = { status: 'local', effort: 'M', pkg: 'mind-lift' };

export const MIND = Object.freeze({
  id: 'mind',
  asks: 'how do the others decide?',
  settings: {
    target: {
      values: {
        none: { status: 'built', note: 'nothing to decide' },
        player: { ...LIFT, lowers: ARENA, note: HUNTER },
        nearest: { ...LIFT, lowers: 'lib/graph/worlds/match-modes.js', note: `free-for-all targeting; ${HUNTER}` },
        'enemy-team': { ...LIFT, lowers: 'lib/graph/worlds/match-modes.js', note: `team-aware targeting; ${HUNTER}` },
      },
    },
    idle: {
      values: {
        none: { status: 'built' },
        patrol: { status: 'built', lowers: 'lib/graph/worlds/controllable/tutorial.js', note: 'a waypoint walker that never targets' },
        dormant: { status: 'built', lowers: 'lib/graph/worlds/controllable/tutorial.js', note: 'absent until a step wakes it' },
      },
    },
    perception: {
      values: {
        omniscient: { ...LIFT, lowers: ARENA, note: 'the hunter always knows its target' },
        sight: { ...LIFT, lowers: ARENA, note: 'a facing cone for the counter and a sightline to fire; no hearing, no memory, no search' },
      },
    },
    posture: {
      values: Object.fromEntries(['rush', 'skirmish', 'siege', 'kite'].map((p) => [p, { ...LIFT, lowers: ARENA, note: `${HUNTER}; kite is the commander's` }])),
    },
    reflexes: {
      multi: true,
      values: {
        'dodge-on-hit': { ...LIFT, lowers: ARENA, note: HUNTER },
        'retreat-on-clash': { ...LIFT, lowers: ARENA, note: HUNTER },
        counter: { ...LIFT, lowers: ARENA, note: 'charge beats swing (the max tier); the counter table belongs to Power' },
      },
    },
    commit: { values: { 'timeout-give-up': { ...LIFT, lowers: ARENA, note: HUNTER } } },
    difficulty: { source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'aiDifficulty', ...LIFT, note: `accuracy, latency and aggression detunes; ${HUNTER}` } },
    commander: {
      values: {
        none: { status: 'built' },
        builtin: { status: 'local', effort: 'L', pkg: 'commander', note: 'mobile-suit/agent-commander.js is untracked: a 0807 spike' },
        agent: { status: 'local', effort: 'L', pkg: 'commander', note: 'the hook and http transports of the untracked commander' },
      },
    },
    squad: {
      values: {
        none: { status: 'built' },
        'team-aware': { ...LIFT, lowers: 'lib/graph/worlds/match-modes.js', note: 'teams skip allies when targeting; no group tactics' },
      },
    },
    pathing: {
      values: {
        direct: { ...LIFT, lowers: ARENA, note: 'straight at the target, sliding along colliders' },
        navmesh: { status: 'absent', effort: 'M', note: 'no pathfinding found (10-10)' },
      },
    },
    social: {
      values: {
        none: { status: 'built' },
        talk: { status: 'partial', effort: 'M', lowers: 'lib/graph/era/floormap.js', note: 'a talk hotspot verb; no dialogue' },
        flee: { status: 'absent', effort: 'M' },
        schedule: { status: 'absent', effort: 'L' },
      },
    },
  },
});
