/**
 * THE COMIC HERO PACK'S CUBES: comic-book and superhero game types said as cosmos cubes, in registry words only, each a
 * genre row the way the core fixtures are (cosmos/fixtures.js): `intent.from` starts a world on one and the world's own
 * values go over it. A row names the look of the pack's dial it suits by default (`look`, looks.js) and the values it
 * WANTS that the registry holds only as planned (`wants`, 'facet.setting=value'): the cube itself never names them, so it
 * validates and dry-runs today, and the wants are the gaps the pack prices. No franchise names.
 *
 *   PACK_CUBES        [{ id, name, why, words, look, cube, wants }]
 *   packCube(id)      one, or throws naming the known ids
 */
export const PACK_CUBES = Object.freeze([
  {
    id: 'street-brawler',
    name: 'Comic street brawler',
    why: 'a hero against waves of thugs on a city street; every landed blow a burst',
    words: ['brawler', 'thugs', 'street fight', 'punch', 'superhero', 'comic', 'vigilante'],
    look: 'dcau-golden',
    cube: {
      reality: { era: 'gen-6', look: 'city-night', medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'city', places: 'street' },
      power: { idiom: 'shonen-like', combat: ['melee'], mechanics: ['defeat-all', 'hp-pool', 'waves'], explosions: ['comic'], rules: ['walk', 'follow', 'platform'] },
      soul: { hero: 'hero', cast: 'heroic', vibe: 'bold', gaits: ['jab', 'cross', 'hitHigh', 'heroHips', 'fistToSky'] },
      mind: { motivation: 'hunt', aggressiveness: 'bold', squad: 'pack' },
      time: { progression: 'linear', shots: ['staged', 'banter'] },
    },
    wants: ['reality.look=comic-night', 'power.mechanics=knockback', 'power.mechanics=throw', 'power.mechanics=destructible', 'soul.equipment=cape', 'time.shots=panel'],
  },
  {
    id: 'rooftop-courier',
    name: 'Rooftop courier',
    why: 'swing and glide across a city of rooftops against the clock; the city is open',
    words: ['rooftops', 'swing', 'web', 'glide', 'courier', 'parkour', 'skyline'],
    look: 'dcau-golden',
    cube: {
      reality: { era: 'gen-6', look: 'city-night', medium: '3d', climate: 'storm-coast' },
      space: { camera: 'third-person', topology: 'open', levelForm: 'city', places: 'buildings', traversal: 'wall' },
      power: { gear: 'swinger', rules: ['walk', 'glide', 'platform', 'follow'], mechanics: ['reach-exit', 'collect', 'clock'] },
      soul: { hero: 'hero', cast: 'lithe', vibe: 'nimble' },
      mind: { motivation: 'ambient' },
      time: { progression: 'linear', passage: 'day-night' },
    },
    wants: ['reality.look=comic-day', 'power.rules=super-jump', 'soul.equipment=cape'],
  },
  {
    id: 'sky-defender',
    name: 'Sky defender',
    why: 'a flying hero holds the sky against waves and a boss, beams against beams',
    words: ['flying hero', 'fly', 'beams', 'eye beams', 'sky', 'invasion', 'boss fight'],
    look: 'anime-day',
    cube: {
      reality: { era: 'gen-6', look: 'desert-dusk', medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'airspace' },
      power: { rules: ['fly', 'follow'], combat: ['ranged'], beams: ['laser', 'ray'], mechanics: ['defeat-all', 'hp-pool', 'waves'], explosions: ['blast', 'comic'] },
      soul: { hero: 'hero', cast: 'heroic', vibe: 'noble' },
      mind: { motivation: 'hunt', aggressiveness: 'relentless', rank: 'boss', skill: 'ace' },
      time: { progression: 'linear', shots: ['staged'] },
    },
    wants: ['soul.equipment=cape', 'time.shots=panel'],
  },
  {
    id: 'versus-heroes',
    name: 'Versus heroes',
    why: 'two heroes, one arena, a transformation mid-fight; the camera from the side',
    words: ['versus', 'fighting game', 'one on one', 'transformation', 'power up', 'rounds'],
    look: 'anime-day',
    cube: {
      reality: { era: 'gen-6', look: 'lab-dark', medium: '3d' },
      space: { camera: 'side', topology: 'linear', levelForm: 'arena' },
      power: { combat: ['versus'], systems: ['transform'], explosions: ['comic', 'blast'], rules: ['walk', 'platform'] },
      soul: { hero: 'hero', cast: 'brute', vibe: 'swagger', seats: 'two', contest: 'versus', gaits: ['henshin', 'guard', 'jab', 'cross'] },
      mind: { motivation: 'hunt', aggressiveness: 'bold', skill: 'veteran' },
      time: { shots: ['staged'] },
    },
    wants: ['reality.look=comic-day', 'power.mechanics=knockback', 'time.shots=panel'],
  },
  {
    id: 'origin-story',
    name: 'Origin story',
    why: 'a city hub opened district by district, powers found as the story advances, people talk',
    words: ['origin', 'origin story', 'powers awaken', 'secret identity', 'districts', 'story', 'city hub'],
    look: 'realistic-night',
    cube: {
      reality: { era: 'gen-6', look: 'city-night', medium: '3d' },
      space: { camera: 'third-person', topology: 'hub', levelForm: 'city', places: 'buildings' },
      power: { idiom: 'action-adventure-like', combat: ['melee'], systems: ['unlock', 'transform'], stats: ['grant', 'level'] },
      soul: { hero: 'hero', cast: 'heroic', vibe: 'composed' },
      mind: { motivation: 'ambient', social: 'talk' },
      time: { progression: 'gated', advance: 'quests', chapters: 'epochs', passage: 'day-night', shots: ['banter', 'staged'] },
    },
    wants: ['soul.equipment=cape', 'time.shots=panel'],
  },
  {
    id: 'team-up',
    name: 'Team-up',
    why: 'two heroes side by side on one couch against waves; one camera, one shared pool',
    words: ['team up', 'team-up', 'co-op', 'two heroes', 'couch', 'duo', 'sidekick'],
    look: 'dcau-golden',
    cube: {
      reality: { era: 'gen-6', look: 'city-night', medium: '3d' },
      space: { camera: 'third-person', topology: 'linear', levelForm: 'arena' },
      power: { combat: ['melee'], mechanics: ['defeat-all', 'waves', 'hp-pool'], explosions: ['comic'], rules: ['walk', 'follow', 'platform'] },
      soul: { hero: 'hero', cast: 'heroic', seats: 'two', contest: 'co-op', frame: 'follow-all', pool: 'shared', join: 'drop-in' },
      mind: { motivation: 'hunt', squad: 'team-aware' },
      time: { progression: 'linear' },
    },
    wants: ['reality.look=comic-night', 'power.mechanics=knockback', 'power.mechanics=throw'],
  },
]);

export function packCube(id) {
  const c = PACK_CUBES.find((x) => x.id === id);
  if (!c) throw new Error(`comic-hero: no cube '${id}' (known: ${PACK_CUBES.map((x) => x.id).join(', ')})`);
  return c;
}
