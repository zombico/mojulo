/**
 * MIND: what the other characters decide, relative to Power and Soul. Shape as in reality.js.
 *
 * Seeded from the mobile-suit arena (10-10). Its hunter brain (`ai`, mobile-suit/ms-ai.js) ships in the controllable
 * emission but was built for that one game: suit fields, an arena genre. So most values here are `local`: a mine to
 * lift into a general mind, not a capability yet. The commander (agent-commander.js) is not tracked at all.
 */
const ARENA = 'lib/graph/mobile-suit/ms-ai.js';
const HUNTER = 'the arena hunter brain only: built for suits, not a general mind';

export const MIND = Object.freeze({
  id: 'mind',
  asks: 'how do the others decide?',
  settings: {
    target: {
      values: {
        none: { status: 'built', note: 'nothing to decide' },
        player: { status: 'local', lowers: ARENA, note: HUNTER },
        nearest: { status: 'local', lowers: 'lib/graph/worlds/match-modes.js', note: `free-for-all targeting; ${HUNTER}` },
        'enemy-team': { status: 'local', lowers: 'lib/graph/worlds/match-modes.js', note: `team-aware targeting; ${HUNTER}` },
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
        omniscient: { status: 'local', lowers: ARENA, note: 'the hunter always knows its target' },
        sight: { status: 'local', lowers: ARENA, note: 'a facing cone for the counter and a sightline to fire; no hearing, no memory, no search' },
      },
    },
    posture: {
      values: Object.fromEntries(['rush', 'skirmish', 'siege', 'kite'].map((p) => [p, { status: 'local', lowers: ARENA, note: `${HUNTER}; kite is the commander's` }])),
    },
    reflexes: {
      multi: true,
      values: {
        'dodge-on-hit': { status: 'local', lowers: ARENA, note: HUNTER },
        'retreat-on-clash': { status: 'local', lowers: ARENA, note: HUNTER },
        counter: { status: 'local', lowers: ARENA, note: 'charge beats swing (the max tier); the counter table belongs to Power' },
      },
    },
    commit: { values: { 'timeout-give-up': { status: 'local', lowers: ARENA, note: HUNTER } } },
    difficulty: { source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'aiDifficulty', status: 'local', note: `accuracy, latency and aggression detunes; ${HUNTER}` } },
    commander: {
      values: {
        none: { status: 'built' },
        builtin: { status: 'local', note: 'mobile-suit/agent-commander.js is untracked: a 0807 spike' },
        agent: { status: 'local', note: 'the hook and http transports of the untracked commander' },
      },
    },
    squad: {
      values: {
        none: { status: 'built' },
        'team-aware': { status: 'local', lowers: 'lib/graph/worlds/match-modes.js', note: 'teams skip allies when targeting; no group tactics' },
      },
    },
    pathing: {
      values: {
        direct: { status: 'local', lowers: ARENA, note: 'straight at the target, sliding along colliders' },
        navmesh: { status: 'absent', note: 'no pathfinding found (10-10)' },
      },
    },
    social: {
      values: {
        none: { status: 'built' },
        talk: { status: 'partial', lowers: 'lib/graph/era/floormap.js', note: 'a talk hotspot verb; no dialogue' },
        flee: { status: 'absent' },
        schedule: { status: 'absent' },
      },
    },
  },
});
