/**
 * POWER: the verbs and rules, whoever holds them. Shape as in reality.js. `multi` settings take a list.
 * `godot` names the list of values that survive a Godot export, or is false where none does. Checked 10-11 against
 * the Godot kernel 0.17.0 (scene/bus-abi.js): the bus, the stats, the walker and the hero's fight (melee and ranged,
 * and the reactions of what it hits) travel, with the mechanics that count its hits; the controllable runtime's
 * systems, beams and explosions stay on the web.
 */
const PORT = 'lib/graph/scene/engine-portability.js';
const WEB = { godot: false };
export const POWER = Object.freeze({
  id: 'power',
  asks: 'what can be done?',
  settings: {
    mechanics: {
      multi: true,
      source: { module: 'lib/graph/game/mechanics.js', table: 'MECHANIC_KINDS', godot: { module: PORT, table: 'GODOT_MECHANICS' } },
    },
    kit: { source: { module: 'lib/graph/game/kits.js', table: 'KITS' } },
    rules: {
      multi: true,
      source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'engineRules', godot: { module: PORT, table: 'GODOT_RULES' } },
    },
    combat: {
      multi: true,
      values: {
        // the hero's swings and rounds, adjudicated by kernel/combat.gd (held equal to the web's); the set pieces, the
        // combo's juggle and every AI's attack stay on the web
        melee: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-melee.js' },
        ranged: { status: 'built', lowers: 'lib/graph/worlds/controllable/combat-ranged.js' },
        'turn-based': { status: 'absent', effort: 'L', note: 'no turn or initiative model found (10-10)' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS', ...WEB } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS', ...WEB } },
    systems: { multi: true, source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS', ...WEB } },
    // every stat op runs in Godot (kernel/stats.gd, held equal to the web's)
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN', godot: { module: 'lib/graph/playscape/stats/kernel.js', table: 'STAT_OPS' } } },
    idiom: { source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS' } },
  },
});
