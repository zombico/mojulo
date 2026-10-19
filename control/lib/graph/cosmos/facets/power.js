/**
 * POWER: the verbs and rules, whoever holds them. Shape as in reality.js. `multi` settings take a list.
 * Each value carries its mark in every engine with a runtime kernel (scene/engines/registry.js): a sourced setting's
 * `marks` names the reader (cosmos/read-sources.js) that reads it from each engine's own tables, the ones its export
 * reads (a mechanic's is found by lowering it and reading the bus rows it uses); a hand value, or a sourced setting's
 * `godot: { all }`, writes one engine's mark by that engine's id.
 */
// a moment on the cast's clock (kernel/cast.gd), struck when a beam lands, drawn simpler than the page
const MOMENT = { all: 'approximated', how: 'a moment on the cast\'s clock (kernel/cast.gd), drawn simpler than the page' };
export const POWER = Object.freeze({
  id: 'power',
  asks: 'what can be done?',
  settings: {
    mechanics: {
      multi: true,
      source: { module: 'lib/graph/game/mechanics.js', table: 'MECHANIC_KINDS', marks: 'mechanicMarks' },
      // a mechanic's mark is found by lowering it (engine-portability.js mechanicMarks): unseen waits on `seen`, on-beat
      // on `beat`, push and crops draw bus entities, supplies rearms; laps and score keep their bests in kernel/game.gd
    },
    kit: { source: { module: 'lib/graph/game/kits.js', table: 'KITS', marks: 'kitMarks' } },
    rules: {
      multi: true,
      source: { module: 'lib/graph/worlds/controllable/compose.js', read: 'engineRules', marks: 'ruleMarks' },
    },
    combat: {
      multi: true,
      values: {
        // the hero's swings and rounds, adjudicated by kernel/combat.gd (held equal to the web's); the set pieces, the
        // combo's juggle and every AI's attack stay on the web
        melee: { status: 'built', godot: 'approximated', roblox: 'approximated', lowers: 'lib/graph/worlds/controllable/combat-melee.js' },
        ranged: { status: 'built', godot: 'approximated', roblox: 'approximated', lowers: 'lib/graph/worlds/controllable/combat-ranged.js' },
        // built 10-12: play.battle (playscape/ui/battles.js) composes a fight of a cue, a talk menu and guarded hp vars;
        // 10-16: play.rpg (playscape/rpg) is the party's: a kernel the page runs, rounds in speed order
        // Godot: the one-on-one play.battle runs on the bus, the world frozen while its menu is up (II5,
        // godot-story-rows.test.js: equal frame by frame); the party's rounds (play.rpg) stay on the web
        'turn-based': { status: 'built', godot: 'approximated', roblox: 'absent', lowers: 'lib/graph/playscape/rpg/rpg.js', note: 'a party of classed characters (classes switched, each with its own rank and skill tree) against packs of foes in rounds: attack, skills, items, guard, flee; elements, statuses, xp, levels, gold and drops (play.rpg); the one-on-one play.battle remains' },
        // built 10-15: a one-on-one fight from the side as its own frame simulation (versus/versus-core.js: 60 Hz, integer
        // millimetres; normals, specials, supers, throws, blocking, rounds), played by two local players or the CPU. A
        // quick game's goal fight; the World page draws it on a stage arena (scene/channels/versus.js). Web only.
        versus: { status: 'built', godot: 'absent', roblox: 'absent', lowers: 'lib/graph/versus/versus-core.js', note: 'a 1v1 fighter from the side: a frame simulation of normals, specials, supers, throws, blocks and rounds, two local players or the CPU (quick goal fight), fought on a stage arena' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS', godot: MOMENT } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS', godot: MOMENT } },
    // resource, stamina, unlock, transform, equip: stats, cues, HUD and menus on the bus, fired by their keys
    systems: {
      multi: true,
      source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS', marks: 'systemMarks' },
      // built 10-12: a pad the player uses (E) wakes what stands asleep there, paid from a var (a cue's if and add): a
      // defence's towers. Free placement anywhere on a grid is not built.
      planned: {
        place: { status: 'built', godot: 'built', roblox: 'approximated', lowers: 'lib/graph/playscape/ui/cues.js', note: 'on pads: a cue (use, if: gold, add, spawn) wakes what was minted asleep there; a defence\'s towers (quick goal defend); free placement on a grid not yet' },
      },
    },
    // every stat op runs in Godot (kernel/stats.gd, held equal to the web's)
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN', godot: { module: 'lib/graph/playscape/stats/kernel.js', table: 'STAT_OPS' }, roblox: { module: 'lib/graph/playscape/stats/kernel.js', table: 'STAT_OPS' } } },
    // the gear that moves the hero through the air, its directions held by the gear: a line to a face above and ahead (a
    // swinger), and later one to an edge or a roof (a grapnel) or two to any face in a cone (a twin hook). The city stalker (10-19)
    gear: {
      values: {
        none: { status: 'built', godot: 'built', roblox: 'built', note: 'the hero\'s own legs: jumps, glides and climbs' },
        // built 10-19 (phase 3): a body owner after the wall, the line to a face found for the hero; web only
        swinger: { status: 'built', lowers: 'lib/graph/worlds/controllable/swing.js', godot: 'absent', roblox: 'absent', note: 'a line to a building\'s face above and ahead, found for the hero (rule.gear), swung on under a pivot drawn toward the hero\'s line, its arc clear of the street, released with its speed; a zip to the face from the ground; no face in reach, no swing' },
      },
    },
    idiom: {
      source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS', marks: 'idiomMarks' },
      planned: {
        'city-stalker-like': { status: 'absent', effort: 'M', godot: 'absent', roblox: 'absent', requires: ['power.gear=swinger', 'space.traversal=wall'], note: 'traversal is the verb and the gear\'s reach gates the city: which roofs a gear reaches, measured on the district, opens the next; a city level refuses a key laid in it today' },
      },
    },
  },
});
