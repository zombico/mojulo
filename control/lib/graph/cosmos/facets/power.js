/**
 * POWER: the verbs and rules, whoever holds them. Shape as in reality.js. `multi` settings take a list.
 * `godot` names the list of values that survive a Godot export.
 */
export const POWER = Object.freeze({
  id: 'power',
  asks: 'what can be done?',
  settings: {
    mechanics: {
      multi: true,
      source: { module: 'lib/graph/game/mechanics.js', table: 'MECHANIC_KINDS', godot: { module: 'lib/graph/scene/engine-portability.js', table: 'MECHANICS_VOCAB' } },
    },
    kit: { source: { module: 'lib/graph/game/kits.js', table: 'KITS' } },
    rules: {
      multi: true,
      source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'engineRules' },
    },
    combat: {
      multi: true,
      values: {
        melee: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-melee.js' },
        ranged: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-ranged.js' },
        'turn-based': { status: 'absent', note: 'no turn or initiative model found (10-10)' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS' } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS' } },
    systems: { multi: true, source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS' } },
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN' } },
    idiom: { source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS' } },
  },
});
