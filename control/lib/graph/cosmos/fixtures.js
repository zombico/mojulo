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
      reality: { rung: 'gen-6.0', look: 'gothic-night', kit: 'catacomb', medium: '3d' },
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
      reality: { rung: 'gen-6.0', look: 'island-noon', kit: 'island-plaza', medium: '3d' },
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
    why: 'a first-person camera, ranged combat, enemies that see, take cover and duel',
    cube: {
      reality: { rung: 'gen-7.0', medium: '3d' },
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
]);

export function fixture(id) {
  const f = FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`cosmos: no fixture '${id}' (known: ${FIXTURES.map((x) => x.id).join(', ')})`);
  return f;
}
