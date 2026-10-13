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
        // built 10-12: play.battle (playscape/ui/battles.js) composes a fight of a cue, a talk menu and guarded hp vars
        'turn-based': { status: 'built', godot: false, lowers: 'lib/graph/playscape/ui/battles.js', note: 'walk up to a foe: a battle menu (its hp and yours; attack, guard, flee), the foe answering a beat later; one on one, no party turns, skills or items yet' },
      },
    },
    beams: { multi: true, source: { module: 'lib/graph/playscape/elements/beams.js', table: 'BEAMS' } },
    explosions: { multi: true, source: { module: 'lib/graph/playscape/elements/explosions.js', table: 'EXPLOSIONS' } },
    // resource, stamina, unlock, transform, equip: stats, cues, HUD and menus on the bus, fired by their keys
    systems: {
      multi: true,
      source: { module: 'lib/graph/gameworld/actions.js', table: 'SYSTEM_KINDS' },
      // built 10-12: a pad the player uses (E) wakes what stands asleep there, paid from a var (a cue's if and add): a
      // defence's towers. Free placement anywhere on a grid is not built.
      planned: {
        place: { status: 'built', ...WEB, lowers: 'lib/graph/playscape/ui/cues.js', note: 'on pads: a cue (use, if: gold, add, spawn) wakes what was minted asleep there; a defence\'s towers (quick goal defend); free placement on a grid not yet' },
      },
    },
    // every stat op runs in Godot (kernel/stats.gd, held equal to the web's)
    stats: { multi: true, source: { module: 'lib/graph/playscape/stats/stats.js', table: 'STAT_THEN', godot: { module: 'lib/graph/playscape/stats/kernel.js', table: 'STAT_OPS' } } },
    idiom: { source: { module: 'lib/graph/gameworld/actions.js', table: 'IDIOMS' } },
  },
});
