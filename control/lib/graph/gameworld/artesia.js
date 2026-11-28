/**
 * CERES — the world of Fable of Artesia, the rail's game (rails.js `fable-of-artesia`, pitch-start.js): an action RPG in the
 * Link to the Past and Link's Awakening mould, its heroine silent. Artesia, chief of the royal guard and second in line
 * to the throne of Ceres, is cast out by a facsimile of her brother, the prince, whom the wizard Olric holds in a crystal
 * prison. Olric rules the dragons of Ceres through the Royal Amber. She crosses the land region by region, freeing each
 * dragon from his control, and from the freed dragons' shards reforms the Amber to break him.
 *
 * It NAMES; the tables behind it MEASURE. Each region is a world map (world-map.js worldMapLevel: its blocks walked and
 * zoned, its storybook town, its own names, its climax its dragon), lit at its own hour, on its own cube (the world's,
 * its land and its palette moved); its dragon fought in its lair (lair.js, the boss shelf's dragons) and cast
 * by the casting call (foe-casting.js: a beat naming `dragon-<id>`); the regions a megaworld CHAIN (megaworld.js), each
 * way in shut until the shard freed in the region before is held. A region is a row.
 *
 *   CERES                 the land's words: its heroine, its foe, its relic, its capital, the premise
 *   REGIONS               the chain, in order: { id, name, says, hour, shift?, blocks, dragon?, shard?, boss? }
 *   regionCube(geocube, R) → the region's cube: the world's, with its land (biocube, snow) and its palette moved
 *   regionLevel(R, i, { geocube? }) → the region's gameworld level (its world map, its names, its climax, its hour, its cube)
 *   APPROACH              the game's first page, before the first region: one block, the coast road (world-map.js
 *                           approachLevel). Artesia comes up it on Seimos and gets down (the controls taught), goblins
 *                           have the merchant Rhayu at the road's far end (the first fight taught), and he leads her on
 *                           to Lagoona's harbour village (the story and its quest, below)
 *   RHAYU, CERES_STORY, CERES_QUESTS   the merchant (a cast member in words), his moments, the quest they make
 *   ceresApproach(geocube?) → the approach's gameworld level, in Lagoona's light and on its cube
 *   ceresWorld(world)     → the world laid as Ceres: the approach then its regions for its levels, the chain for its
 *                           links, Rhayu in its cast and his story, under every key the creator wrote but its levels and
 *                           links (pitch-start.js, the rail's starter)
 *
 * Pure: the same world, the same Ceres.
 */
import { worldMapLevel, approachLevel } from './world-map.js';
import { DRAGONS } from '../boss/dragons.js';
import { stampMegaworld } from './megaworld.js';

const f = Object.freeze;
export const CERES = f({
  land: 'Ceres', heroine: 'Artesia', foe: 'Olric', relic: 'the Royal Amber', capital: 'Imperial City', silent: true,
  // (her horse, ridden across the plains and called to her there: the world's `mounts`, worlds/mount-units.js)
  steed: f({ name: 'Seimos', coat: 'grey' }),
  premise: 'Artesia, chief of the royal guard and second in line to the throne of Ceres, is cast out of the kingdom by a facsimile of her brother, the prince, whom the wizard Olric holds in a crystal prison. Olric dominates the dragons of Ceres through the Royal Amber. She journeys region by region to free them, break his power, and reform the Amber from the freed dragons.',
});

// (a region's LIGHT: its hour on the geocube's dial, era/geocube-hours.js; its shift the world's palette moved,
// color-theorist/solve.js: `light` toward night or day, `warm`, `chroma`, `turn`. Its LAND: what grows on it, a biocube
// of era/biocube.js, and its snow, era/snow.js. Each laid on the region's own cube: the level's land is read whole from
// its cube, so a block's own shift never reaches the ground)
export const REGIONS = f([
  f({ id: 'lagoona', name: 'Lagoona', says: 'a lagoon coast at noon: white sand, turquoise shallows, a harbour town; where Artesia comes ashore, cast out', hour: 'noon', biocube: 'coast',
    shift: f({ chroma: 1.2, turn: 22 }), blocks: f(['the harbour village', 'the shore road', 'the drowned ruins', 'the dune plains', 'the reed flats', 'the lagoon town', 'the storm reef']), dragon: 'storm', shard: 'storm-shard' }),
  f({ id: 'athlan', name: 'Athlan', says: 'green highland terraces in a warm afternoon, old ruins on them, fens below', hour: 'afternoon', biocube: 'upland',
    shift: f({ warm: 0.3, chroma: 1.1 }), blocks: f(['the terrace village', 'the highland road', 'the old ruins', 'the high meadows', 'the fen fields', 'Athlan town', 'the fen heights']), dragon: 'venom', shard: 'venom-shard' }),
  f({ id: 'letzo', name: 'Letzo', says: 'cold peaks and pines in a pale morning, a frozen pass', hour: 'morning', biocube: 'alpine', snow: 'cover',
    shift: f({ warm: -0.6, chroma: 0.65, light: 0.2 }), blocks: f(['the pine hamlet', 'the frozen road', 'the ice ruins', 'the white plains', 'the frost fields', 'Letzo town', 'the high pass']), dragon: 'rime', shard: 'rime-shard' }),
  f({ id: 'khabar', name: 'Khabar', says: 'desert and volcanic badlands under a golden hour', hour: 'golden', biocube: 'desert',
    shift: f({ warm: 0.6, chroma: 1.2, turn: -18 }), blocks: f(['the oasis', 'the dune road', 'the sunken ruins', 'the salt flats', 'the red steppe', 'the Khabar bazaar', 'the ember crater']), dragon: 'ember', shard: 'ember-shard' }),
  // (the capital at night under Olric's veil: the false prince on the throne; the Amber reformed opens it, Olric's last
  // beast at its height, the family's boss: the hydra)
  f({ id: 'imperial-city', name: 'Imperial City', says: 'the capital of Ceres at night under Olric\'s veil, the false prince on its throne', hour: 'night', biocube: 'bare',
    shift: f({ chroma: 0.75, warm: -0.3 }), blocks: f(['the outer gate', 'the city road', 'the old quarter', 'the crown fields', 'the king\'s road', 'the imperial square', 'Olric\'s spire']), boss: 'hydra' }),
]);
export const REGION_IDS = f(REGIONS.map((R) => R.id));
/** The open country between each region's first zone and its town (world-map.js PLAINS): ridden across on Seimos. */
export const REGION_PLAINS = 2;
/** A region's dragon as the bestiary names it (foe-casting.js: a beat naming `dragon-<id>` is cast as that dragon). */
export const dragonKind = (id) => `dragon-${id}`;

/** A region's own cube: the world's (a preset's id, or { from, …changes }) with the region's land and its palette moved;
 * null where the world names none. */
export function regionCube(geocube, R) {
  if (geocube === undefined || geocube === null) return null;
  const G = typeof geocube === 'string' ? { from: geocube } : geocube;
  return { ...G, ...(R.biocube ? { biocube: R.biocube } : {}), ...(R.snow ? { snow: R.snow } : {}), ...(R.shift && G.palette && typeof G.palette === 'object' ? { palette: { ...G.palette, shift: { ...R.shift } } } : {}) };
}

/** A region as a gameworld level: its world map (its blocks named, its storybook town, its dragon its climax, come into
 * with nothing taught: the approach teaches), lit at its hour, on its own cube (regionCube: the world's `geocube` given). */
export function regionLevel(R, i = 0, { geocube } = {}) {
  if (R.dragon !== undefined && !DRAGONS[R.dragon]) throw new Error(`ceres: ${R.id}'s dragon is one of ${Object.keys(DRAGONS).join(', ')}`);
  // (the controls are the approach's to teach: every region is come into, nothing taught)
  const { level } = worldMapLevel({ n: 3, plains: REGION_PLAINS, town: 'storybook', names: R.blocks, opening: false, ...(R.dragon ? { climax: { [dragonKind(R.dragon)]: 1 } } : {}) });
  const cube = regionCube(geocube, R);
  return { ...level, name: R.name, style: { hour: R.hour, ...(cube ? { geocube: cube } : {}) } };
}

// THE APPROACH: the game begins with Artesia's return, up the coast road to Lagoona's harbour village on Seimos
export const APPROACH = f({ id: 'coast-road', name: 'the coast road', says: 'the coast road into Lagoona: Artesia rides home, cast out, and finds goblins on the road', region: 'lagoona' });
// (the merchant the goblins hold on the road, in words: a stout man in a merchant's russet; the hero's tradition makes him)
export const RHAYU = f({ name: 'Rhayu', looks: f({ body: f({ cast: 'male', tune: 'stout' }), hair: f({ hair: f({ style: 'crew' }) }), colour: f({ palette: f({ Top: '#9a5b2e' }) }) }) });
const HARBOUR = REGIONS[0].blocks[0];
/** His moments: he stands among the goblins at the ambush; won, he thanks her (she is silent) and walks on to the road's
 * end; at the harbour village he says where they are. Each finds its place as the world is bound (story.js). */
export const CERES_STORY = f([
  f({ id: 'rhayu-thanks', who: ['rhayu'], where: f({ level: APPROACH.id, place: 'ambush' }), stand: f({ rhayu: 'ambush' }), when: f({ won: 'ambush-rest' }), sets: ['met-rhayu'], beats: f([
    f({ line: f({ who: 'rhayu', say: 'Gone, all of them. I owe you my life, and my cart.' }) }),
    f({ line: f({ who: 'rhayu', say: `I am Rhayu, a merchant of ${HARBOUR}. Goblins never came down the coast before the dragons turned.` }) }),
    f({ line: f({ who: 'rhayu', say: 'The village is just along the road. Come, I will take you there.' }) }),
    f({ do: f({ walk: f({ who: 'rhayu', to: 'exit', find: true }) }) }),
  ]) }),
  f({ id: 'rhayu-harbour', who: ['rhayu'], where: f({ level: REGIONS[0].id }), stand: f({ rhayu: 'start' }), when: f({ slot: 'before' }), sets: ['reached-harbour'], beats: f([
    f({ line: f({ who: 'rhayu', say: `Here we are: ${HARBOUR}. Rest a while. The road on is no safer than the one behind us.` }) }),
  ]) }),
]);
export const CERES_QUESTS = f([
  f({ id: 'the-road-in', name: 'The road in', starts: 'met-rhayu', steps: f([f({ log: `Follow Rhayu to ${HARBOUR}`, done: 'reached-harbour', moments: ['rhayu-harbour'] })]) }),
]);
/** The approach as a gameworld level: one block, ridden onto, its ambush and the road on; Lagoona's light and cube. */
export function ceresApproach({ geocube } = {}) {
  const R = REGIONS.find((x) => x.id === APPROACH.region), { level } = approachLevel({ name: APPROACH.name, ridden: true, on: `Follow Rhayu to ${HARBOUR}` });
  const cube = regionCube(geocube, R);
  return { ...level, style: { hour: R.hour, ...(cube ? { geocube: cube } : {}) } };
}

/** The world laid as Ceres: its regions its levels, a megaworld chain their ways, each region past the first shut until
 * the shard freed in the one before it is held. Every key the creator wrote wins but the levels and the ways. */
// (one palette for the whole world, each region's moved off it: its seed the one stamped, else settled here from the
// world's own seed, so the stamp at authoring keeps it and never rolls each region a palette of its own)
const seedOf = (v) => { let h = 2166136261; for (const c of `ceres|${v}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return 1 + (h % 9999999); };
function seededCube(world) {
  const G = world.style?.geocube;
  if (!G || typeof G !== 'object' || !G.palette || typeof G.palette !== 'object' || Number.isInteger(G.palette.seed)) return G;
  return { ...G, palette: { ...G.palette, seed: seedOf(world.seed ?? 1) } };
}
export function ceresWorld(world = {}) {
  const geocube = seededCube(world);
  const levels = { [APPROACH.id]: ceresApproach({ geocube }), ...Object.fromEntries(REGIONS.map((R, i) => [R.id, regionLevel(R, i, { geocube })])) };
  const gates = Object.fromEntries(REGIONS.slice(1).map((R, i) => { const prev = REGIONS[i]; return [R.id, prev.shard ? { key: prev.shard, keyAt: prev.id } : {}]; }).filter(([, g]) => g.key));
  const { levels: _l, links: _k, start: _s, megaworld: _m, ...kept } = world;
  return stampMegaworld({
    ...kept, ...(geocube !== world.style?.geocube ? { style: { ...world.style, geocube } } : {}), levels,
    // (Rhayu in the cast, his moments and the quest they make, where the world has its people: the creator's own win)
    ...(world.characters ? { characters: { ...world.characters, cast: { rhayu: RHAYU, ...(world.characters.cast ?? {}) } }, story: world.story ?? CERES_STORY, quests: world.quests ?? CERES_QUESTS } : {}),
    // (Seimos, on every ridden page: a region's plains)
    mounts: world.mounts ?? [{ coat: CERES.steed.coat, name: CERES.steed.name, call: true }],
    // (the approach first, its way on open: the road into Lagoona)
    megaworld: { shape: 'chain', rings: [[APPROACH.id], ...REGIONS.map((R) => [R.id])], gates },
    // (the world map the readout walks is the first region's: its opening block, its first zone)
    brief: { ...(world.brief ?? {}), ...(world.brief?.worldMap ? { worldMap: { level: REGIONS[0].id, blocks: levels[REGIONS[0].id].glyphs.plan.route.length, opening: levels[REGIONS[0].id].glyphs.plan.route.slice(0, 1), firstZone: levels[REGIONS[0].id].glyphs.zoned[0] } } : {}), ceres: { premise: CERES.premise, regions: REGIONS.map((R) => ({ id: R.id, name: R.name, hour: R.hour, ...(R.dragon ? { dragon: R.dragon } : { boss: R.boss }) })) } },
  });
}
