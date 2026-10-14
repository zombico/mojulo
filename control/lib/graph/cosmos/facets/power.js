/**
 * POWER: the verbs and rules, whoever holds them. Shape as in reality.js. `multi` settings take a list.
 * `godot` is each value's Godot mark (scene/godot-marks.js, the one portability source): a sourced setting reads it
 * from the tables the export reads (a mechanic's is found by lowering it and reading the bus rows it uses), a hand
 * value writes it.
 */
const PORT = 'lib/graph/scene/engine-portability.js';
const MARKS = 'lib/graph/scene/godot-marks.js';
const WEB = { godot: 'absent' };
// a moment on the cast's clock (kernel/cast.gd), struck when a beam lands, drawn simpler than the page
const MOMENT = { all: 'approximated', how: 'a moment on the cast\'s clock (kernel/cast.gd), drawn simpler than the page' };
export const POWER = Object.freeze({
  id: 'power',
  asks: 'what can be done?',
  settings: {
    mechanics: {
      multi: true,
      source: { module: 'lib/graph/game/mechanics.js', table: 'MECHANIC_KINDS', godot: { module: PORT, read: 'mechanicMarks' } },
      // a mechanic's mark is found by lowering it (engine-portability.js MECHANIC_MARKS): unseen waits on `seen`, on-beat
      // on `beat`, push and crops draw bus entities, supplies rearms; laps and score keep a best the kernel does not
    },
    kit: { source: { module: 'lib/graph/game/kits.js', table: 'KITS', godot: { module: PORT, read: 'kitMarks' } } },
    rules: {
      multi: true,
      source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'engineRules', godot: { module: MARKS, read: 'ruleMarks' } },
    },
    combat: {
      multi: true,
      values: {
        // the hero's swings and rounds, adjudicated by kernel/combat.gd (held equal to the web's); the set pieces, the
        // combo's juggle and every AI's attack stay on the web
        melee: { status: 'built', godot: 'approximated', lowers: 'lib/graph/worlds/controllable/combat-melee.js' },
        ranged: { status: 'built', godot: 'approximated', lowers: 'lib/graph/worlds/controllable/combat-ranged.js' },
        // built 10-12: play.battle (playscape/ui/battles.js) composes a fight of a cue, a talk menu and guarded hp vars
        // Godot: a battle's menu, guarded vars and the foe's beat run on the bus, the world frozen while it is up (II5,
        // godot-story-rows.test.js: equal frame by frame)
        'turn-based': { status: 'built', godot: 'built', lowers: 'lib/graph/playscape/ui/battles.js', note: 'walk up to a foe: a battle menu (its hp and yours; attack, guard, flee), the foe answering a beat later; one on one, no party turns, skills or items yet' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS', godot: MOMENT } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS', godot: MOMENT } },
    // resource, stamina, unlock, transform, equip: stats, cues, HUD and menus on the bus, fired by their keys
    systems: {
      multi: true,
      source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS', godot: { module: MARKS, read: 'systemMarks' } },
      // built 10-12: a pad the player uses (E) wakes what stands asleep there, paid from a var (a cue's if and add): a
      // defence's towers. Free placement anywhere on a grid is not built.
      planned: {
        place: { status: 'built', ...WEB, lowers: 'lib/graph/playscape/ui/cues.js', note: 'on pads: a cue (use, if: gold, add, spawn) wakes what was minted asleep there; a defence\'s towers (quick goal defend); free placement on a grid not yet' },
      },
    },
    // every stat op runs in Godot (kernel/stats.gd, held equal to the web's)
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN', godot: { module: 'lib/graph/playscape/stats/kernel.js', table: 'STAT_OPS' } } },
    idiom: { source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS', godot: { module: MARKS, read: 'idiomMarks' } } },
  },
});
