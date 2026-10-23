/**
 * GAME TYPES AS COSMOS CUBES, at depth 0–1: the fixtures the sweep reads before it rolls any dice.
 *
 *   anchors  games the tree makes today. Each must dry-run `makeable`; if one doesn't, the registry is wrong, not the
 *            builder (fixtures.test.js holds them).
 *   probes   genres the builder is asked about. Their verdict is the finding, not a gate: a probe may be blocked.
 *
 * A fixture says the genre in game-code words and nothing more; an unset setting is left to the default and is not
 * checked. `why` is the one line that makes the tuple that genre. No franchise names.
 *
 *   FIXTURES      [{ id, name, anchor, why, cube }]
 *   fixture(id)   one, or throws naming the known ids
 */
export const FIXTURES = Object.freeze([
  {
    id: 'dungeon-crawler',
    name: 'Third-person dungeon crawler',
    anchor: true,
    why: 'room to room, reach the exit, loot and hazards; the kit gates the campaign itself',
    cube: {
      reality: { era: 'gen-6', look: 'gothic-night', kit: 'catacomb', medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'rooms', links: 'door' },
      power: { kit: 'dungeon-crawler', mechanics: ['reach-exit', 'collect', 'hazard-damage', 'fail-on-death'], combat: ['melee'], rules: ['walk', 'follow'] },
      soul: { hero: 'hero', cast: 'heroic', equipment: ['sword', 'shield'] },
      mind: { motivation: 'ambient', aggressiveness: 'passive' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'collectathon',
    name: '3D collectathon',
    anchor: true,
    why: 'gather the loot, reach the exit; non-lethal, a linear set of stages',
    cube: {
      reality: { era: 'gen-6', look: 'island-noon', kit: 'island-plaza', medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'trail', traversal: 'platform' },
      power: { kit: 'collectathon', mechanics: ['collect', 'reach-exit'], rules: ['walk', 'glide', 'platform', 'follow'] },
      soul: { hero: 'hero', cast: 'chibi', vibe: 'bouncy' },
      mind: { motivation: 'ambient' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'top-down-adventure',
    name: 'Top-down action-adventure',
    anchor: false,
    why: 'a ¾ overhead camera, a sword, a hub of dungeons opened by found items',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'top-down', topology: 'hub', levelForm: 'rooms', links: 'door' },
      power: { idiom: 'action-adventure-like', combat: ['melee'], systems: ['unlock'] },
      soul: { hero: 'hero', equipment: ['sword', 'shield', 'bow'] },
      mind: { motivation: 'guard', aggressiveness: 'bold' },
      time: { progression: 'gated', advance: 'steps' },
    },
  },
  {
    id: 'shooter',
    name: 'First-person shooter',
    anchor: false,
    why: 'a first-person camera, ranged combat, enemies that see, take cover and duel (at today\'s fidelity: the game is the rules, not the resolution)',
    cube: {
      reality: { era: 'gen-6', medium: '3d' },
      space: { camera: 'first-person', topology: 'linear', levelForm: 'arena' },
      power: { combat: ['ranged'], mechanics: ['defeat-all', 'hp-pool'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'sight', pathing: 'navmesh', squad: 'team-aware' },
      time: { progression: 'linear', advance: 'cues', shots: ['in-world'] },
    },
  },
  {
    id: 'jrpg',
    name: 'Party role-playing game',
    anchor: false,
    why: 'a party, turn-based fights, a town hub, quests that move the world on',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'hub' },
      power: { combat: ['turn-based'], stats: ['xp', 'level', 'buy'], systems: ['equip'] },
      soul: { hero: 'hero', party: 'party', equipment: ['sword', 'staff'] },
      mind: { motivation: 'hunt', aggressiveness: 'bold', rank: 'boss', social: 'talk' },
      time: { progression: 'gated', chapters: 'overlays', advance: 'quests', shots: ['banter', 'staged'] },
    },
  },
  {
    id: 'metroidvania',
    name: 'Metroidvania',
    anchor: false,
    why: 'a side camera, one interconnected map, abilities that open the way back',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'side', topology: 'interconnected', traversal: 'platform' },
      power: { idiom: 'metroidvania-like', rules: ['platform'], systems: ['unlock'], combat: ['melee'] },
      soul: { hero: 'hero', gaits: ['jump', 'doubleJump'] },
      mind: { motivation: 'territorial', aggressiveness: 'bold', rank: 'miniboss' },
      time: { progression: 'gated', advance: 'cues' },
    },
  },
  {
    id: 'survival-horror',
    name: 'Survival horror',
    anchor: false,
    why: 'fixed cameras through a mapped house, scarce resources, a pursuer, the house changing as it goes',
    cube: {
      reality: { medium: '3d', look: 'lab-dark' },
      space: { camera: 'fixed', topology: 'interconnected', levelForm: 'floormap', links: 'door' },
      power: { combat: ['ranged'], systems: ['resource'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'hunt', aggressiveness: 'relentless', perception: 'memory', pathing: 'navmesh' },
      time: { progression: 'gated', chapters: 'overlays', advance: 'cues', shots: ['staged'] },
    },
  },
  {
    id: 'story-adventure',
    name: 'Story adventure',
    anchor: false,
    why: 'one town that changes chapter by chapter; people give quests, talk face to face, and the camera directs the turns',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'hub' },
      soul: { hero: 'hero' },
      mind: { motivation: 'ambient', social: 'talk' },
      time: { progression: 'linear', chapters: 'overlays', passage: 'seasons', advance: 'quests', shots: ['in-world', 'banter'], framing: ['wide'] },
    },
  },
  {
    id: 'arena-brawler',
    name: 'Arena brawler',
    anchor: false,
    why: 'one arena, free-for-all bots, the last one standing',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', levelForm: 'arena' },
      power: { kit: 'survival-arena', combat: ['melee', 'ranged'], mechanics: ['survive', 'hp-pool'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'hunt', aggressiveness: 'bold', skill: 'regular', rank: 'miniboss', squad: 'free-for-all' },
    },
  },
  {
    id: 'pixel-puzzle',
    name: 'Arcade puzzle in pixels',
    anchor: false,
    why: 'a pixel screen seen from above, collect everything, reach the exit',
    cube: {
      reality: { medium: 'pixel' },
      space: { camera: 'top-down', topology: 'linear' },
      power: { mechanics: ['collect', 'reach-exit'] },
      time: { progression: 'linear' },
    },
  },
  // the genre snipe (10-12): genres the parts nearly make, each asking one or two things no table holds yet
  {
    id: 'stealth',
    name: 'Stealth infiltration',
    anchor: false,
    why: 'guards who see and remember, a house of rooms to cross, and being seen is the failure',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'floormap', links: 'door' },
      power: { mechanics: ['unseen', 'reach-exit'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'guard', aggressiveness: 'wary', perception: 'memory', pathing: 'navmesh' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'racing',
    name: 'Time-trial racing',
    anchor: false,
    why: 'the hero is a car on a trail, checkpoints in order, laps against the clock and a best time',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'trail' },
      power: { rules: ['drive', 'follow'], mechanics: ['laps', 'score'] },
      soul: { hero: 'vehicle' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'kart-racer',
    name: 'Kart racer',
    anchor: false,
    why: 'cars round a loop against rival drivers, laps and a place to finish in',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'circuit' },
      power: { rules: ['drive', 'racer', 'follow'], mechanics: ['laps', 'score'] },
      soul: { hero: 'vehicle' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'arena-shooter',
    name: 'Arena shooter',
    anchor: false,
    why: 'a deathmatch: bots that fight whom they see and hunt the noise, frags and respawns, an arena that loops',
    cube: {
      reality: { era: 'gen-6', medium: '3d' },
      space: { camera: 'first-person', topology: 'linear', levelForm: 'arena' },
      power: { combat: ['ranged'], mechanics: ['frags', 'supplies'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'frag', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh', squad: 'free-for-all' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'flight-sim',
    name: 'Flight sim',
    anchor: false,
    why: 'an aircraft over a map: take off, fly the ring gates in order, land, on the clock',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'airspace' },
      power: { rules: ['fly', 'follow'], mechanics: ['laps'] },
      soul: { hero: 'aircraft' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'space-shooter',
    name: 'Space shooter',
    anchor: false,
    why: 'a starfighter: asteroids, a wing of fighters to shoot down, a trench run to its port',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'airspace' },
      power: { rules: ['fly', 'follow', 'ai'], combat: ['ranged'], mechanics: ['defeat-all', 'fail-on-death', 'respawn'] },
      soul: { hero: 'aircraft' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'air-combat',
    name: 'Air combat',
    anchor: false,
    why: 'a jet over a map: a dogfight, a crash that costs, the ground to keep clear of',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'airspace' },
      power: { rules: ['fly', 'follow', 'ai'], combat: ['ranged'], mechanics: ['defeat-all', 'fail-on-death', 'respawn'] },
      soul: { hero: 'aircraft' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'endless-runner',
    name: 'Endless runner',
    anchor: false,
    why: 'a hero runs on its own down lanes, ever faster: change lane, jump and slide past what comes; a crash ends the run, the best kept',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'third-person', levelForm: 'run' },
      power: { rules: ['platform'], mechanics: ['runner'] },
      soul: { hero: 'hero', gaits: ['jump'] },
      time: { progression: 'none' },
    },
  },
  {
    id: 'match-3-saga',
    name: 'Match-3 saga',
    anchor: false,
    why: 'a map of short puzzle levels on a swap-to-match board, each a few moves to reach its goal, three stars to earn',
    cube: {
      reality: { medium: 'board' },
      time: { progression: 'saga' },
    },
  },
  {
    id: 'rhythm',
    name: 'Rhythm runner',
    anchor: false,
    why: 'a side-on run where the jumps land on the music\'s beat, scored',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'side', topology: 'linear', levelForm: 'trail' },
      power: { rules: ['platform'], mechanics: ['on-beat', 'score', 'reach-exit'] },
      soul: { hero: 'hero', gaits: ['jump'] },
      time: { progression: 'linear', advance: 'cues' },
    },
  },
  {
    id: 'roguelike',
    name: 'Roguelike dungeon',
    anchor: false,
    why: 'rooms rolled from the run\'s seed, a death ends the run, levels and loot carry the next one further',
    cube: {
      reality: { medium: '3d', kit: 'catacomb' },
      space: { camera: 'top-down', levelForm: 'rooms', links: 'door' },
      power: { combat: ['melee'], mechanics: ['defeat-all', 'reach-exit', 'fail-on-death'], stats: ['xp', 'level'] },
      soul: { hero: 'hero', equipment: ['sword'] },
      mind: { motivation: 'hunt', aggressiveness: 'bold', rank: 'elite' },
      time: { progression: 'runs' },
    },
  },
  {
    id: 'farming',
    name: 'Farming life sim',
    anchor: false,
    why: 'plant on a plot, crops grow while time passes, sell the harvest; townsfolk keep their own day',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'top-down', topology: 'hub', places: 'street' },
      power: { systems: ['place', 'resource'], stats: ['buy'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'ambient', social: 'schedule' },
      time: { passage: 'growth', advance: 'quests' },
    },
  },
  {
    id: 'tower-defense',
    name: 'Tower defence',
    anchor: false,
    why: 'waves march on the base, the player places towers paid from what the waves drop',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'top-down', levelForm: 'arena' },
      power: { systems: ['place', 'resource'], mechanics: ['waves'], stats: ['buy'] },
      mind: { motivation: 'hunt', aggressiveness: 'relentless', squad: 'pack' },
      time: { progression: 'linear' },
    },
  },
  {
    id: 'tactics',
    name: 'Tactics role-playing game',
    anchor: false,
    why: 'a party of classed units on a board of spots, a turn each on a charge-time clock: move, act, face; height and facing count; chapters travelled from a map, scenes told on the board, summons',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'tactical', board: 'spots', levelForm: 'trail' },
      power: { combat: ['tactics'], stats: ['xp', 'level'], systems: ['equip'], summons: ['inferno'] },
      soul: { party: 'party' },
      mind: { squad: 'team-aware' },
      time: { progression: 'map', chapters: 'epochs', shots: ['board', 'banter'] },
    },
  },
  {
    id: 'rts',
    name: 'Real-time strategy',
    anchor: false,
    why: 'armies ordered from above in real time: select, move, attack, gather and build; unalike sides, each climbing its own technology',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'tactical', levelForm: 'arena' },
      power: { combat: ['ranged', 'melee'], systems: ['orders', 'research', 'resource', 'place'], stats: ['buy'] },
      mind: { pathing: 'navmesh', squad: 'team-aware' },
      time: { progression: 'linear' },
    },
  },
  // the fighter (10-15): a side-on one-on-one in rounds, its own simulation on a stage arena
  {
    id: 'versus-fighter',
    name: 'Versus fighter',
    anchor: false,
    why: 'two fighters face each other from the side, one on one, in rounds: normals, specials, throws and blocks',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'side', levelForm: 'arena' },
      power: { combat: ['versus'], mechanics: ['hp-pool'] },
    },
  },
  {
    id: 'block-puzzle',
    name: 'Block-pushing puzzle',
    anchor: false,
    why: 'push blocks onto plates in a room seen from above, the door opens when every plate is held',
    cube: {
      reality: { medium: '3d' },
      space: { camera: 'top-down', topology: 'linear', levelForm: 'rooms' },
      power: { mechanics: ['push', 'reach-exit'] },
      time: { progression: 'linear', advance: 'cues' },
    },
  },
  // the city stalker (10-19): the open city as a primitive, its districts played one at a time
  {
    id: 'city-stalker',
    name: 'City stalker',
    anchor: false,
    why: 'a hero who swings between towers and crawls their walls, fights on the roofs and streets, the gear\'s reach opening the city district by district',
    cube: {
      reality: { medium: '3d', look: 'city-night' },
      space: { camera: 'third-person', topology: 'interconnected', levelForm: 'city', traversal: 'wall' },
      power: { idiom: 'city-stalker-like', gear: 'swinger', rules: ['platform', 'follow'], combat: ['melee'], systems: ['unlock'] },
      soul: { hero: 'hero' },
      mind: { motivation: 'guard', aggressiveness: 'bold', perception: 'sight' },
      time: { progression: 'gated' },
    },
  },
]);

export function fixture(id) {
  const f = FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`cosmos: no fixture '${id}' (known: ${FIXTURES.map((x) => x.id).join(', ')})`);
  return f;
}
