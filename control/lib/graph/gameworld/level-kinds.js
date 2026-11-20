/**
 * LEVEL KINDS — the kinds of level a game of a rail's type is built from: each a PRIMITIVE an agent making such a game
 * picks by name (an approach, then a compound, then a holding block), with the verbs it teaches, what presses on the
 * player in it, and the LAWS that prove it a good one of its kind. A game is not one kind repeated: its levels are kinds
 * in an order, and the order is the game's (its Game Brief's labour), never the rail's. A new kind is a row.
 *
 *   LEVEL_KINDS   { <rail id>: [{ id, name, shape, teaches, pressure, laws, status, example? }] }
 *     shape      the space, in a line: what a person walks through
 *     teaches    the verbs the kind is where the player learns (what it asks the player to do)
 *     pressure   what presses on the player there: who watches, what the clock or the alarm does
 *     laws       what proves one of this kind good, each a sentence a check can be made of (the route search's, the
 *                building's, the mission's)
 *     status     'built' (a level of it is played, its laws checked), 'spike' (a level of it stands as a spike, its laws
 *                in part), 'proposed' (named, not yet made: what it waits on is its `waits`)
 *     example    where a level of it is made, a recipe and its builder (repo paths), when there is one
 *     waits      a proposed kind's: what it needs that is not built
 *
 *   levelKindsOf(rail)   → its kinds ([] for a rail with none named yet)
 *   levelKindLine(k)     → one line the rail's card says: its name, its shape, its status
 *
 * Pure data. The rail's sheet carries them (rails.js railSheet `kinds`), and its card says them.
 */
const row = (o) => Object.freeze({ ...o, teaches: Object.freeze(o.teaches), laws: Object.freeze(o.laws) });

export const LEVEL_KIND_STATUSES = Object.freeze(['built', 'spike', 'proposed']);

export const LEVEL_KINDS = Object.freeze({
  'steel-serpents': Object.freeze([
    row({ id: 'approach', name: 'the approach', shape: 'a line: a trail outdoors through checkpoints, the base at its end',
      teaches: ['read a sight cone', 'crouch and crawl', 'grass as cover', 'a takedown that opens a way'],
      pressure: 'watchers posted and pacing at each checkpoint; floods by night',
      laws: ['the straight way through each checkpoint is seen', 'a way through unseen exists', 'it costs patience or a detour', 'a second way, apart from the first', 'where a takedown is the way, no way past while every watcher stands'],
      status: 'built', example: 'control/scripts/spikes/mission/level0.json (level0.mjs)' }),
    row({ id: 'compound', name: 'the compound', shape: 'a hub: open ground round buildings, lit by floods, the way in a locked door',
      teaches: ['choose an order', 'fetch a key and carry it back', 'lamp against dark'],
      pressure: 'guards walking the ground between the buildings; floods that light a body crossing them',
      laws: ['the locked door is passed on the way to its key', 'the key is reached past at least one watcher', 'the floods leave a dark way between them'],
      status: 'built', example: 'control/scripts/spikes/mission/level1.json segments.perimeter (yard.mjs)' }),
    row({ id: 'interior', name: 'the interior', shape: 'rooms off corridors, a goal room at a corridor\'s end',
      teaches: ['a doorway as cover', 'slip room to room', 'a soldier in a corridor'],
      pressure: 'a sentry walking the corridor and looking round at its end',
      laws: ['the only way to the goal room runs past a watcher', 'every room off that corridor is reached from it (a place to step into)', 'the watcher sees a body standing at the corridor\'s mouth'],
      status: 'built', example: 'control/scripts/spikes/mission/level1.json segments.perimeter.barracks (yard.mjs); hangar.mjs' }),
    row({ id: 'holding', name: 'the holding block', shape: 'cells along a corridor, a desk, the property room, the way out a sally port: captured, the kit taken',
      teaches: ['bare hands: knock out and drag', 'read a routine', 'get the kit back', 'a vent a body lies flat in'],
      pressure: 'a guard on a round past the cells; the desk between the cells and the way out',
      laws: ['the kit is taken: bare hands until it is found', 'the straight way out is seen', 'a way out unseen exists by the round alone', 'the kit is on a way out, never off every way', 'no way out needs a kill'],
      status: 'spike', example: 'control/scripts/spikes/mission/holding.json (holding.mjs)' }),
    row({ id: 'gauntlet', name: 'the gauntlet on alert', shape: 'a way out run with the base already hunting: the alarm up at the start',
      teaches: ['the alarm\'s phases', 'break the line and hide until it dies down'],
      pressure: 'searchers spread round the last place the player was seen; backup on its way',
      laws: ['from every point on the way a hiding place is in reach', 'every search sweep leaves a gap', 'the alarm can die down before the end'],
      status: 'proposed', waits: 'a level that starts on alert (alarm.js phase set at the start) and a search the route search can read' }),
    row({ id: 'checkpoint', name: 'the moving checkpoint', shape: 'a gate on a road, trucks driven through it',
      teaches: ['ride or hide on moving cover', 'time a gap'],
      pressure: 'a gate that checks what passes; a road watched end to end',
      laws: ['the gate is not passed on foot unseen', 'a vehicle carries a body through unseen'],
      status: 'proposed', waits: 'vehicles driven on a route through a level (parked ones only today)' }),
    row({ id: 'overwatch', name: 'the overwatch', shape: 'open ground under one long-sighted watcher: a sniper\'s tower or a searchlight',
      teaches: ['read one sweeping gaze', 'cross in its blind beats'],
      pressure: 'one watcher seeing far, turning on a rhythm',
      laws: ['the ground cannot be crossed in one beat', 'every crossing has a place to stop out of its sweep'],
      status: 'proposed', waits: 'a searchlight (a watcher whose cone turns on a schedule and lights what it sees)' }),
  ]),
});

export const levelKindsOf = (rail) => LEVEL_KINDS[rail] ?? [];

export const levelKindLine = (k) => `${k.id.padEnd(11)}${k.name}: ${k.shape} (${k.status}${k.status === 'proposed' ? `: waits on ${k.waits}` : ''})`;
