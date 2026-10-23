/**
 * THE CONCERNS — what a game asks of its world, keyed by the cube's values (intent.js), never by genre. A concern is
 * raised by any of its values (`when`: 'facet.setting=value'), so a farm with a shooter in it asks what both ask, and a
 * genre is only the cube that raises a familiar set.
 *
 * Each concern has up to three faces:
 *   asks   the words: what the world must give, and why (the intent page shows them to the creator)
 *   lays   what the world does for it, on its ground or its stages, before any goal reads them (lay-concerns.js)
 *   laws   machine checks over the laid level: advisory, as every gate here
 * A concern with asks only is said and not yet laid or checked; the readout says which.
 *
 *   CONCERNS                 [{ id, name, when: [key], asks, lays?, laws? }]
 *   concernsOf(cube)         → [{ id, name, asks, by: [key], laid: bool, checked: bool }] in table order (laid: the
 *                            world lays it, lay-concerns.js LAID)
 *   concernIds(cube)         → [id] the concerns the cube raises
 */
import { LAID } from './lay-concerns.js';

export const CONCERNS = Object.freeze([
  {
    id: 'cover', name: 'Cover and sightlines',
    when: ['power.combat=ranged'],
    asks: 'a fight at range needs things to hide behind: cover a few steps from wherever a fighter stands, taller than a person or low enough to crouch at; sightlines no longer than the weapons reach; a way round each strong point to flank it',
  },
  {
    id: 'room-to-fight', name: 'Room to fight',
    when: ['power.combat=melee'],
    asks: 'a fight up close needs open ground to circle in: level footing round each fight, no cliff at its edge, walls near enough to be pinned against',
  },
  {
    id: 'encounters', name: 'Encounters along the way',
    when: ['power.combat=turn-based'],
    asks: 'turn-based fights happen where the party walks up to a foe: packs one at a time along the way, tougher further on, with quiet ground between them and a place to rest (laid by battles.js, the world\'s battles or their defaults)',
  },
  {
    id: 'watchers', name: 'Lines of sight to break',
    when: ['mind.perception=sight', 'mind.perception=memory', 'power.mechanics=unseen'],
    asks: 'watchers that see need sight to be broken: walls and crates between their posts and the way, blind spots behind them, a second way round each watcher, gazes that sweep so a crossing can be timed',
  },
  {
    id: 'fields', name: 'Fields by home',
    when: ['power.mechanics=crops', 'time.passage=growth'],
    asks: 'growing needs level land close to home: a field on flat ground beside the start, room for its plots, a short path between home, field and market that a day\'s routine can walk',
  },
  {
    id: 'day-and-night', name: 'A place for every hour',
    when: ['time.passage=day-night', 'time.passage=seasons', 'mind.social=schedule'],
    asks: 'a clock needs places with a time: a home to return to at night, a workplace for the day, paths between them the folk walk, landmarks that still read in the dark',
  },
  {
    id: 'lanes', name: 'Lanes to read at speed',
    when: ['power.mechanics=runner', 'space.levelForm=run'],
    asks: 'a run needs lanes the eye reads at speed: rows spaced for a reaction at the speed reached, every row with a way through, low things to jump, high ones to slide under, coins drawing the eye to a safe lane (laid as it is played, worlds/controllable/runner.js)',
  },
  {
    id: 'saga-curve', name: 'A curve across the map',
    when: ['time.progression=saga'],
    asks: 'a saga needs a curve: every level winnable in its moves by a steady player, the first generous, the moves thinning and the goals climbing, a goal the player reads at a glance (measured against a greedy player, philosophers-stone-saga.js)',
  },
  {
    id: 'circuit', name: 'A line to race',
    when: ['power.mechanics=laps'],
    asks: 'racing needs a line: checkpoints spaced so each leg is a stretch worth taking (twelve metres or more), a way wide enough to take at speed, the finish in sight of the last bend',
  },
  {
    id: 'arena', name: 'An arena to fight in',
    when: ['power.mechanics=frags'],
    asks: 'a match needs a bounded floor that loops: every way between two spawns with another round it, no spawn in sight of another, cover a few steps from anywhere, no line across the whole floor, lanes for short and long fights',
  },
  {
    id: 'loop', name: 'A track that comes round',
    when: ['space.levelForm=circuit'],
    asks: 'going round needs a track that comes back to its start: a closed line on level land, wide enough to pass on, nothing standing on it, the infield closed so the way round is the way',
  },
  {
    id: 'drivable', name: 'Ground a vehicle can take',
    when: ['soul.hero=vehicle', 'power.rules=drive'],
    asks: 'a vehicle needs ground it can take: gentle grades, wide turns, no stairs, ladders or narrow gaps on its line',
  },
  {
    id: 'road-to-base', name: 'A road to the base',
    when: ['power.mechanics=waves'],
    asks: 'waves need one road from where they come to what they attack, long enough to fight along, with room beside it to build on',
  },
  {
    id: 'board', name: 'A board for the puzzle',
    when: ['power.mechanics=push'],
    asks: 'a pushing puzzle needs a flat board its grid fits on, clear of the walk, with room to stand on every side of a boulder',
  },
  {
    id: 'steady-run', name: 'A steady run',
    when: ['power.mechanics=on-beat'],
    asks: 'playing to the beat needs a long, even run: a steady stride with nothing that stops the feet or breaks the rhythm',
  },
  {
    id: 'reachable', name: 'Gaps a jump clears',
    when: ['power.rules=platform', 'power.kit=platformer', 'power.kit=collectathon'],
    asks: 'jumping needs measured ground: gaps a jump clears, ledges within a jump\'s reach, something worth reaching on the high places',
  },
  {
    id: 'framed', name: 'Rooms that frame',
    when: ['space.camera=fixed'],
    asks: 'fixed cameras need rooms and corners that frame well: the way turns where a camera cuts, nothing tall between a camera and the way',
  },
  {
    id: 'from-above', name: 'Read from above',
    when: ['space.camera=top-down'],
    asks: 'a camera from above needs ground that reads in plan: landmarks with a shape from above, no overhang hiding the hero',
  },
  {
    id: 'one-line', name: 'One line through the land',
    when: ['space.camera=side'],
    asks: 'a side view needs one line through the land: what matters stands on it, what is behind it is backdrop',
  },
  {
    id: 'eye-level', name: 'Landmarks at eye level',
    when: ['space.camera=first-person'],
    asks: 'from the eye, the way is found by what rises above it: landmarks taller than the walk, the exit seen before it is reached',
  },
  {
    id: 'stand-alone', name: 'Stretches that stand alone',
    when: ['time.progression=runs'],
    asks: 'runs draw stretches in any order: each must start and end on even ground and stand without the one before it',
  },
  {
    id: 'breakable', name: 'Things worth breaking',
    when: ['time.passage=aftermath'],
    asks: 'what breaks stays broken: things worth breaking near the way, so coming back shows what was done',
  },
  {
    id: 'a-centre', name: 'A centre to return to',
    when: ['space.topology=hub', 'space.topology=interconnected'],
    asks: 'a world that is returned to needs a centre every way leads back to, and landmarks seen from afar to steer by',
  },
  {
    id: 'rooms', name: 'Rooms and a way back',
    when: ['space.levelForm=rooms', 'space.levelForm=floormap', 'power.kit=dungeon-crawler'],
    asks: 'a crawl through rooms needs rooms joined by doors, a way back out, and somewhere each room keeps its reward',
  },
  {
    id: 'walk-together', name: 'Room to walk together',
    when: ['soul.party=party'],
    asks: 'a party needs room to walk abreast and places to gather: ways wider than one, stops where the group stands together',
  },
  {
    id: 'stages', name: 'Places a scene can stand',
    when: ['time.shots=staged', 'time.shots=banter', 'time.shots=in-world'],
    asks: 'scenes need places to stand their cast: open spots along the way with a backdrop, where a camera can stand off',
  },
]);

const keysOf = (cube) => Object.entries(cube ?? {}).flatMap(([f, s]) => Object.entries(s ?? {}).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${f}.${k}=${x}`)));

export function concernsOf(cube) {
  const have = new Set(keysOf(cube));
  return CONCERNS.filter((c) => c.when.some((k) => have.has(k))).map((c) => ({
    id: c.id, name: c.name, asks: c.asks, by: c.when.filter((k) => have.has(k)), laid: !!LAID[c.id], checked: !!c.laws,
  }));
}

export const concernIds = (cube) => concernsOf(cube).map((c) => c.id);
