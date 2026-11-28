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
 *   ceresWorld(world)     → the world laid as Ceres: its regions for its levels, the chain for its links, under every
 *                           key the creator wrote but its levels and links (pitch-start.js, the rail's starter)
 *
 * Pure: the same world, the same Ceres.
 */
import { worldMapLevel } from './world-map.js';
import { DRAGONS } from '../boss/dragons.js';
import { stampMegaworld } from './megaworld.js';

const f = Object.freeze;
export const CERES = f({
  land: 'Ceres', heroine: 'Artesia', foe: 'Olric', relic: 'the Royal Amber', capital: 'Imperial City', silent: true,
  premise: 'Artesia, chief of the royal guard and second in line to the throne of Ceres, is cast out of the kingdom by a facsimile of her brother, the prince, whom the wizard Olric holds in a crystal prison. Olric dominates the dragons of Ceres through the Royal Amber. She journeys region by region to free them, break his power, and reform the Amber from the freed dragons.',
});

// (a region's LIGHT: its hour on the geocube's dial, era/geocube-hours.js; its shift the world's palette moved,
// color-theorist/solve.js: `light` toward night or day, `warm`, `chroma`, `turn`. Its LAND: what grows on it, a biocube
// of era/biocube.js, and its snow, era/snow.js. Each laid on the region's own cube: the level's land is read whole from
// its cube, so a block's own shift never reaches the ground)
export const REGIONS = f([
  f({ id: 'lagoona', name: 'Lagoona', says: 'a lagoon coast at noon: white sand, turquoise shallows, a harbour town; where Artesia comes ashore, cast out', hour: 'noon', biocube: 'coast',
    shift: f({ chroma: 1.2, turn: 22 }), blocks: f(['the harbour village', 'the shore road', 'the drowned ruins', 'the lagoon town', 'the storm reef']), dragon: 'storm', shard: 'storm-shard' }),
  f({ id: 'athlan', name: 'Athlan', says: 'green highland terraces in a warm afternoon, old ruins on them, fens below', hour: 'afternoon', biocube: 'upland',
    shift: f({ warm: 0.3, chroma: 1.1 }), blocks: f(['the terrace village', 'the highland road', 'the old ruins', 'Athlan town', 'the fen heights']), dragon: 'venom', shard: 'venom-shard' }),
  f({ id: 'letzo', name: 'Letzo', says: 'cold peaks and pines in a pale morning, a frozen pass', hour: 'morning', biocube: 'alpine', snow: 'cover',
    shift: f({ warm: -0.6, chroma: 0.65, light: 0.2 }), blocks: f(['the pine hamlet', 'the frozen road', 'the ice ruins', 'Letzo town', 'the high pass']), dragon: 'rime', shard: 'rime-shard' }),
  f({ id: 'khabar', name: 'Khabar', says: 'desert and volcanic badlands under a golden hour', hour: 'golden', biocube: 'desert',
    shift: f({ warm: 0.6, chroma: 1.2, turn: -18 }), blocks: f(['the oasis', 'the dune road', 'the sunken ruins', 'the Khabar bazaar', 'the ember crater']), dragon: 'ember', shard: 'ember-shard' }),
  // (the capital at night under Olric's veil: the false prince on the throne; the Amber reformed opens it, Olric's last
  // beast at its height, the family's boss: the hydra)
  f({ id: 'imperial-city', name: 'Imperial City', says: 'the capital of Ceres at night under Olric\'s veil, the false prince on its throne', hour: 'night', biocube: 'bare',
    shift: f({ chroma: 0.75, warm: -0.3 }), blocks: f(['the outer gate', 'the city road', 'the old quarter', 'the imperial square', 'Olric\'s spire']), boss: 'hydra' }),
]);
export const REGION_IDS = f(REGIONS.map((R) => R.id));
/** A region's dragon as the bestiary names it (foe-casting.js: a beat naming `dragon-<id>` is cast as that dragon). */
export const dragonKind = (id) => `dragon-${id}`;

/** A region's own cube: the world's (a preset's id, or { from, …changes }) with the region's land and its palette moved;
 * null where the world names none. */
export function regionCube(geocube, R) {
  if (geocube === undefined || geocube === null) return null;
  const G = typeof geocube === 'string' ? { from: geocube } : geocube;
  return { ...G, ...(R.biocube ? { biocube: R.biocube } : {}), ...(R.snow ? { snow: R.snow } : {}), ...(R.shift && G.palette && typeof G.palette === 'object' ? { palette: { ...G.palette, shift: { ...R.shift } } } : {}) };
}

/** A region as a gameworld level: its world map (its blocks named, its storybook town, its dragon its climax, the
 * first region alone teaching the controls), lit at its hour, on its own cube (regionCube: the world's `geocube` given). */
export function regionLevel(R, i = 0, { geocube } = {}) {
  if (R.dragon !== undefined && !DRAGONS[R.dragon]) throw new Error(`ceres: ${R.id}'s dragon is one of ${Object.keys(DRAGONS).join(', ')}`);
  const { level } = worldMapLevel({ n: 3, town: 'storybook', names: R.blocks, opening: i === 0, ...(R.dragon ? { climax: { [dragonKind(R.dragon)]: 1 } } : {}) });
  const cube = regionCube(geocube, R);
  return { ...level, name: R.name, style: { hour: R.hour, ...(cube ? { geocube: cube } : {}) } };
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
  const levels = Object.fromEntries(REGIONS.map((R, i) => [R.id, regionLevel(R, i, { geocube })]));
  const gates = Object.fromEntries(REGIONS.slice(1).map((R, i) => { const prev = REGIONS[i]; return [R.id, prev.shard ? { key: prev.shard, keyAt: prev.id } : {}]; }).filter(([, g]) => g.key));
  const { levels: _l, links: _k, start: _s, megaworld: _m, ...kept } = world;
  return stampMegaworld({
    ...kept, ...(geocube !== world.style?.geocube ? { style: { ...world.style, geocube } } : {}), levels,
    megaworld: { shape: 'chain', rings: REGIONS.map((R) => [R.id]), gates },
    // (the world map the readout walks is the first region's: its opening block, its first zone)
    brief: { ...(world.brief ?? {}), ...(world.brief?.worldMap ? { worldMap: { level: REGIONS[0].id, blocks: levels[REGIONS[0].id].glyphs.plan.route.length, opening: levels[REGIONS[0].id].glyphs.plan.route.slice(0, 1), firstZone: levels[REGIONS[0].id].glyphs.zoned[0] } } : {}), ceres: { premise: CERES.premise, regions: REGIONS.map((R) => ({ id: R.id, name: R.name, hour: R.hour, ...(R.dragon ? { dragon: R.dragon } : { boss: R.boss }) })) } },
  });
}
