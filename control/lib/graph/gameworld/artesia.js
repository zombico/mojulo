/**
 * CERES — the world of Fable of Artesia, the rail's game (rails.js `fable-of-artesia`, pitch-start.js): an action RPG in the
 * Link to the Past and Link's Awakening mould, its heroine silent. Artesia, chief of the royal guard and second in line
 * to the throne of Ceres, is cast out by a facsimile of her brother, the prince, whom the wizard Olric holds in a crystal
 * prison. Olric rules the dragons of Ceres through the Royal Amber. She crosses the land region by region, freeing each
 * dragon from his control, and from the freed dragons' shards reforms the Amber to break him.
 *
 * It NAMES; the tables behind it MEASURE. Each region is a world map (world-map.js worldMapLevel: its blocks walked and
 * zoned, its storybook town, its own names, its climax its dragon), lit at its own hour and moved off the world's
 * palette (a block's `palette: { shift }`); its dragon fought in its lair (lair.js, the boss shelf's dragons) and cast
 * by the casting call (foe-casting.js: a beat naming `dragon-<id>`); the regions a megaworld CHAIN (megaworld.js), each
 * way in shut until the shard freed in the region before is held. A region is a row.
 *
 *   CERES                 the land's words: its heroine, its foe, its relic, its capital, the premise
 *   REGIONS               the chain, in order: { id, name, says, hour, shift?, blocks, dragon?, shard?, boss? }
 *   regionLevel(R, i)     → the region's gameworld level (its world map, its hour, its light, its names, its climax)
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

// (a region's light: its hour on the geocube's dial, era/geocube-hours.js; its shift the world's palette moved, every
// block of it, color-theorist/solve.js: `light` toward night or day, `warm`, `chroma`, `turn`)
export const REGIONS = f([
  f({ id: 'lagoona', name: 'Lagoona', says: 'a lagoon coast at noon: white sand, turquoise shallows, a harbour town; where Artesia comes ashore, cast out', hour: 'noon',
    shift: f({ chroma: 1.15, turn: 12 }), blocks: f(['the harbour village', 'the shore road', 'the drowned ruins', 'the lagoon town', 'the storm reef']), dragon: 'storm', shard: 'storm-shard' }),
  f({ id: 'athlan', name: 'Athlan', says: 'green highland terraces in a warm afternoon, old ruins on them, fens below', hour: 'afternoon',
    shift: f({ warm: 0.2 }), blocks: f(['the terrace village', 'the highland road', 'the old ruins', 'Athlan town', 'the fen heights']), dragon: 'venom', shard: 'venom-shard' }),
  f({ id: 'letzo', name: 'Letzo', says: 'cold peaks and pines in a pale morning, a frozen pass', hour: 'morning',
    shift: f({ warm: -0.55, chroma: 0.7, light: 0.15 }), blocks: f(['the pine hamlet', 'the frozen road', 'the ice ruins', 'Letzo town', 'the high pass']), dragon: 'rime', shard: 'rime-shard' }),
  f({ id: 'khabar', name: 'Khabar', says: 'desert and volcanic badlands under a golden hour', hour: 'golden',
    shift: f({ warm: 0.6, chroma: 1.2, turn: -18 }), blocks: f(['the oasis', 'the dune road', 'the sunken ruins', 'the Khabar bazaar', 'the ember crater']), dragon: 'ember', shard: 'ember-shard' }),
  // (the capital at night under Olric's veil: the false prince on the throne; the Amber reformed opens it, Olric's last
  // beast at its height, the family's boss: the hydra)
  f({ id: 'imperial-city', name: 'Imperial City', says: 'the capital of Ceres at night under Olric\'s veil, the false prince on its throne', hour: 'night',
    shift: f({ chroma: 0.8, warm: -0.3 }), blocks: f(['the outer gate', 'the city road', 'the old quarter', 'the imperial square', 'Olric\'s spire']), boss: 'hydra' }),
]);
export const REGION_IDS = f(REGIONS.map((R) => R.id));
/** A region's dragon as the bestiary names it (foe-casting.js: a beat naming `dragon-<id>` is cast as that dragon). */
export const dragonKind = (id) => `dragon-${id}`;

/** A region as a gameworld level: its world map (its blocks named, its storybook town, its dragon its climax, the
 * first region alone teaching the controls), lit at its hour, every block moved off the world's palette by its shift. */
export function regionLevel(R, i = 0) {
  if (R.dragon !== undefined && !DRAGONS[R.dragon]) throw new Error(`ceres: ${R.id}'s dragon is one of ${Object.keys(DRAGONS).join(', ')}`);
  const { level } = worldMapLevel({ n: 3, town: 'storybook', names: R.blocks, opening: i === 0, ...(R.dragon ? { climax: { [dragonKind(R.dragon)]: 1 } } : {}) });
  const key = Object.fromEntries(Object.entries(level.glyphs.plan.key).map(([S, k]) => [S, R.shift ? { ...k, palette: { shift: { ...(k.palette?.shift ?? {}), ...R.shift } } } : k]));
  return { ...level, name: R.name, style: { hour: R.hour }, glyphs: { ...level.glyphs, plan: { ...level.glyphs.plan, key } } };
}

/** The world laid as Ceres: its regions its levels, a megaworld chain their ways, each region past the first shut until
 * the shard freed in the one before it is held. Every key the creator wrote wins but the levels and the ways. */
export function ceresWorld(world = {}) {
  const levels = Object.fromEntries(REGIONS.map((R, i) => [R.id, regionLevel(R, i)]));
  const gates = Object.fromEntries(REGIONS.slice(1).map((R, i) => { const prev = REGIONS[i]; return [R.id, prev.shard ? { key: prev.shard, keyAt: prev.id } : {}]; }).filter(([, g]) => g.key));
  const { levels: _l, links: _k, start: _s, megaworld: _m, ...kept } = world;
  return stampMegaworld({
    ...kept, levels,
    megaworld: { shape: 'chain', rings: REGIONS.map((R) => [R.id]), gates },
    // (the world map the readout walks is the first region's: its opening block, its first zone)
    brief: { ...(world.brief ?? {}), ...(world.brief?.worldMap ? { worldMap: { level: REGIONS[0].id, blocks: levels[REGIONS[0].id].glyphs.plan.route.length, opening: levels[REGIONS[0].id].glyphs.plan.route.slice(0, 1), firstZone: levels[REGIONS[0].id].glyphs.zoned[0] } } : {}), ceres: { premise: CERES.premise, regions: REGIONS.map((R) => ({ id: R.id, name: R.name, hour: R.hour, ...(R.dragon ? { dragon: R.dragon } : { boss: R.boss }) })) } },
  });
}
