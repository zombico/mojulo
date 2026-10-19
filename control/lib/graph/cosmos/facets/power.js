/**
 * POWER: the verbs and rules, whoever holds them. Shape as in reality.js. `multi` settings take a list.
 * `godot` names the list of values that survive a Godot export, or is false where none does. Checked 10-11 against
 * the Godot kernel 0.18.0 (scene/bus-abi.js): the bus, the stats, the walker, the hero's fight (melee and ranged, and
 * the reactions of what it hits) with the mechanics that count its hits, the systems (they lower to stats, cues, HUD
 * and menus, and their keys travel), and a cue's beams and explosions (moments on the cast's clock, struck when a
 * beam lands; drawn simpler than the page) all do; the motion rules beyond walk, platform and follow stay on the web.
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
      // the genre snipe (10-12): unseen, laps, on-beat, score, waves and push are built (game/mechanics.js), web only:
      // not in GODOT_MECHANICS
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
        // built 10-12: play.battle (playscape/ui/battles.js) composes a fight of a cue, a talk menu and guarded hp vars;
        // 10-16: play.rpg (playscape/rpg) is the party's: a kernel the page runs, rounds in speed order
        'turn-based': { status: 'built', godot: false, lowers: 'lib/graph/playscape/rpg/rpg.js', note: 'a party of classed characters (classes switched, each with its own rank and skill tree) against packs of foes in rounds: attack, skills, items, guard, flee; elements, statuses, xp, levels, gold and drops (play.rpg); the one-on-one play.battle remains' },
        // built 10-15: a one-on-one fight from the side as its own frame simulation (versus/versus-core.js: 60 Hz, integer
        // millimetres; normals, specials, supers, throws, blocking, rounds), played by two local players or the CPU. A
        // quick game's goal fight; the World page draws it on a stage arena (scene/channels/versus.js). Web only.
        // built 10-19 (strategy board): fought on the board's spots, not in a window over a frozen field
        tactics: { status: 'built', requires: ['space.board=spots'], ...WEB, lowers: 'lib/graph/gameworld/board-levels.js', note: 'battles.on: board: each stage that meets packs a tactics battle on its own ground, the book\'s party deployed (classes, ranks, skills, gear carried), speed turns of move, act and face, facing and height, a plain foe mind, spoils into the party' },
        versus: { status: 'built', godot: false, lowers: 'lib/graph/versus/versus-core.js', note: 'a 1v1 fighter from the side: a frame simulation of normals, specials, supers, throws, blocks and rounds, two local players or the CPU (quick goal fight), fought on a stage arena' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS' } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS' } },
    // built 10-19 (the strategy board): summoned beings, 3D and animated on the map, called by a summoner's skills
    summons: { multi: true, source: { module: 'lib/graph/board/board-battle.js', table: 'BOARD_SUMMONS', godot: false } },
    // resource, stamina, unlock, transform, equip: stats, cues, HUD and menus on the bus, fired by their keys
    systems: {
      multi: true,
      source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS' },
      // built 10-12: a pad the player uses (E) wakes what stands asleep there, paid from a var (a cue's if and add): a
      // defence's towers. Free placement on a board's spots: maze (10-19).
      planned: {
        place: { status: 'built', ...WEB, lowers: 'lib/graph/playscape/ui/cues.js', note: 'on pads: a cue (use, if: gold, add, spawn) wakes what was minted asleep there; a defence\'s towers (quick goal defend); on any free spot of a board: maze' },
        // built 10-19 (the strategy board): the maze defence's placement
        maze: { status: 'built', ...WEB, requires: ['space.board=spots'], lowers: 'lib/graph/board/board-td.js', note: 'a tower on any free spot of a board, paid from the purse, where every gate and every walking foe keeps a way to the base: the road bends round the towers (board td; quick defend with board)' },
        // priced 10-19: the real-time strategist's verbs
        // built 10-19 (the strategy board): the skirmish's orders
        orders: { status: 'built', requires: ['space.camera=tactical'], ...WEB, lowers: 'lib/graph/board/board-rts.js', note: 'select a unit or a box of them and order it: move, attack-move, attack, hold, stop, gather; buildings train for gold and send out to a rally point; an enemy mind plays the other side (board rts; quick conquer)' },
        // built 10-19 (the strategy board): a side's ladder, its technology what it fields
        research: { status: 'built', requires: ['power.systems=orders'], ...WEB, lowers: 'lib/graph/board/board-rts-tech.js', note: 'each side a civilization whose technology is its roster (hand weapons arm infantry, armour is heavy, machine weapons are siege, a turret shoots), climbing a ladder researched one step at a time: its machines, then its showpieces, and income steps; drawn as crafted (quick conquer sides)' },
      },
    },
    // every stat op runs in Godot (kernel/stats.gd, held equal to the web's)
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN', godot: { module: 'lib/graph/playscape/stats/kernel.js', table: 'STAT_OPS' } } },
    idiom: { source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS' } },
  },
});
