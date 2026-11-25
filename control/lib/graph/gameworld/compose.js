/**
 * AUTONOMOUS MODE — a whole gameworld decided from a few prompts. The words a creator gives are READ against a
 * lexicon of what they say about the ground (a kit, a building language, a fortification, the land's forms and how
 * much of each, the ground's character); what no word decides, the seed does, inside the same rails a creator would
 * choose from. Then the agent checks its own work: a level whose town's laws advise is laid again on the next seed,
 * up to a few times, before it is handed over. Its levels stand on the geocube the words point at (CUBE_WORDS, else
 * the kit's nearest), drawn on the kit's own card, its colours left to the color theorist where the world is stored,
 * and lit at the hour a word names (HOUR_OF_WORDS: dusk, dawn, night…, the world's `style.hour`) unless it is lit at it already.
 * The world comes back in autonomous mode, every part stamped by its
 * machine gate (review.js), the prompt and every decision kept in its `brief`, ready for the creator to approve or
 * send back.
 *
 * Words also say what a level is played for (relics to collect, a boss at the end, health, guards to sneak past: a
 * level's `goal`, quick.js levelGoalMechanics) and whether it is indoors (a dungeon, a crypt: building levels in a room
 * kit); none, and every level is a walk to its exit, as before. Words that name a game clearly (intent.js suggestGenres) write its `intent`,
 * and its levels are laid for it.
 *
 *   composeGameworld({ prompt, name?, id?, levels?: 1…6, seed? }) → a gameworld recipe
 *
 * Pure: the same prompt and seed compose the same world.
 */
import { DEFAULT_GAUNTLET, DEFAULT_HOLDOUT } from './gauntlet.js';
import { mulberry32 } from '../vegetation/grow.js';
import { LAND_FORMS } from '../era/out-land.js';
import { readGameworld, resolveLevel } from './world.js';
import { minigamesOfWords } from './minigames.js';
import { structureStyle } from '../era/out-structures.js';
import { designTown } from '../era/out-town.js';
import { readIntent } from './tunnel.js';
import { landDomain } from './tunnel-land.js';
import { buildingDomain } from './tunnel-buildings.js';
import { techDomain, TECH_TRAITS } from './tunnel-tech.js';
import { craftDomain, craftKindOf, CRAFT_TRAITS } from './tech-crafter.js';
import { motifOf } from './tech-direction.js';
import { ELEMENT_WORDS } from './element-words.js';
import { CRAFTED } from './world.js';
import { suggestFeels, FEEL_WORDS } from './feel/suggest.js';
import { arsenalFor } from './combos.js';
import { GENRE_HERO } from './hero-rows.js';
import { GEOCUBE_PRESETS, GEOCUBE_PALETTES, readGeocube, geocubeDomains, cubeStreetLook } from '../era/geocube.js';
import { suggestGenres, readGenre, cubeOfWorld, GENRES } from './intent.js';
import { GENRE_FORMS, HAND_OFFS, refusalOf, pendingOf, heroFrameOf, heroStreetWords } from './genre-forms.js';
import { RAILS } from './rails.js';
import { pilotSchoolStart } from './pilot-school.js';
import { wolfSquadronStart } from './wolf-squadron.js';
import { blazeGunnerStart } from './blaze-gunner.js';
import { rebelStormStart } from './rebel-storm.js';
import { worldMapLevel, wildsLevel, WORLD_MAP } from './world-map.js';
import { stampMegaworld } from './megaworld.js';
import { gmnOfWords, resolveGmn, stampGameBrief, MOTIVATIONS } from './gmn.js';
import { roundEraOf, eraBattles } from './round-eras.js';
import { bossOfLabour, roundBossBattles } from './round-bosses.js';
import { roundStory } from './round-story.js';
import { settingOfGame, ERA_OF_KIT } from './cast-setting.js';
import { heroDesign } from './hero-design.js';
import { genrePaletteWords } from './world-palette.js';
import { FLOW_IN_PLAY } from '../game/flow.js';
import { readHour, referenceHour } from '../era/geocube-hours.js';
import { glyphOf } from './glyph-words.js';
import { PALETTE_PRESETS } from '../color-theorist/solve.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from '../era/sixth-gen.js';
import { ISEKAI_STYLES } from '../era/isekai-tiles.js';
import { SWATCHES } from '../era/style/swatches.js';
import { rgbToHex } from '../color-theorist/oklab.js';
import { composerFills } from './resonance.js';
import { readFoeWords, foePacks } from './foe-words.js';

/**
 * What a word says about the ground. Each reading sets parts of a world's style or its civilizations: `kit`,
 * `anchor` and `fort` (the first civilization's, or a second one's when a second language is named), `land.<form>`
 * (a variant, a step), `trail.<dial>`, `meru` (a preset), `levels` (more or fewer).
 */
export const LEXICON = Object.freeze({
  // the kit: the look the whole ground is drawn in
  meadow: { kit: 'isekai-meadow' }, pastoral: { kit: 'isekai-meadow' }, green: { kit: 'isekai-meadow' }, grassy: { kit: 'isekai-meadow' }, grass: { kit: 'isekai-meadow' }, valley: { kit: 'isekai-meadow', 'land.landscape': ['downs', 0.5] },
  bamboo: { kit: 'isekai-bamboo' }, forest: { kit: 'isekai-bamboo' },
  blossom: { kit: 'isekai-sakura', weather: 'spring-blossom' }, sakura: { kit: 'isekai-sakura', weather: 'spring-blossom' }, spring: { kit: 'isekai-sakura', weather: 'spring-blossom' },
  night: { kit: 'alien-night', 'land.cloud': [null, 0] }, alien: { kit: 'alien-night' },
  // (a future setting said plainly: an alien world, the future era's kit, cast-setting.js ERA_OF_KIT)
  'sci-fi': { kit: 'alien-night' }, scifi: { kit: 'alien-night' }, futuristic: { kit: 'alien-night' }, space: { kit: 'alien-night' },
  galactic: { kit: 'alien-night' }, interstellar: { kit: 'alien-night' }, starship: { kit: 'alien-night' }, spaceship: { kit: 'alien-night' }, moon: { kit: 'alien-night' }, glowing: { kit: 'alien-night' },
  airless: { kit: 'airless-plain' }, lunar: { kit: 'airless-plain' }, crater: { kit: 'airless-plain' }, cratered: { kit: 'airless-plain' }, asteroid: { kit: 'airless-plain' }, vacuum: { kit: 'airless-plain' },
  garden: { kit: 'isekai-garden' }, zen: { kit: 'isekai-garden', 'land.rock': ['balanced', 0.25] },
  // who builds: a building language and a fortification
  timber: { anchor: 'timber-hall' }, village: { anchor: 'timber-hall' }, medieval: { anchor: 'timber-hall', fort: 'crenellated' },
  shell: { anchor: 'shell' }, dome: { anchor: 'shell' }, domes: { anchor: 'shell' }, orb: { anchor: 'shell' }, round: { anchor: 'shell' },
  tiered: { anchor: 'tiered' }, pagoda: { anchor: 'tiered' }, temple: { anchor: 'tiered', meru: 'temple-pyramid' }, stepped: { anchor: 'tiered', meru: 'ziggurat' },
  fortress: { fort: 'battered' }, stronghold: { fort: 'battered' }, battered: { fort: 'battered' }, castle: { fort: 'crenellated' },
  // the lie of the ground and its character
  flat: { 'land.landscape': ['meadow', 0] }, gentle: { 'land.landscape': ['meadow', 0.25], 'trail.heartbeat': 0.4 }, rolling: { 'land.landscape': ['downs', 0.5] },
  hills: { 'land.landscape': ['downs', 0.75] }, hilly: { 'land.landscape': ['downs', 0.75] }, highland: { 'land.landscape': ['rugged', 0.5], 'trail.heartbeat': 0.9 },
  mountain: { 'land.landscape': ['rugged', 0.75], 'land.face': ['crag', 0.75], meru: 'mountain-lookout', 'trail.heartbeat': 0.95 }, rugged: { 'land.landscape': ['rugged', 1], 'trail.bumpiness': 0.9 },
  terraced: { 'land.landscape': ['terraced', 0.5], meru: 'terraced-mountain' }, hummocky: { 'land.landscape': ['hummocky', 0.5] }, steep: { 'trail.heartbeat': 1 },
  // the land open, no far cliff on its trails (the cube's `outside.cliff: false`); a word that names a cliff, a face or
  // beds wins over it (plains under basalt cliffs keep their cliffs)
  field: { 'outside.cliff': false }, plain: { 'outside.cliff': false }, prairie: { 'outside.cliff': false }, steppe: { 'outside.cliff': false },
  grassland: { kit: 'isekai-meadow', 'outside.cliff': false }, savanna: { 'outside.cliff': false },
  // what grows: wildflowers in the grass (the cube's biocube, era/biocube.js), a share of the live grass
  colorful: { 'flora.flowers': 0.4 }, colourful: { 'flora.flowers': 0.4 }, flower: { 'flora.flowers': 0.4 }, flowery: { 'flora.flowers': 0.5 },
  wildflower: { 'flora.flowers': 0.5 }, floral: { 'flora.flowers': 0.4 }, blooming: { 'flora.flowers': 0.5 },
  // rock and cliff
  rocky: { 'land.rock': ['boulders', 0.75] }, boulders: { 'land.rock': ['boulders', 1] }, tor: { 'land.rock': ['tor', 0.5] }, crags: { 'land.face': ['crag', 0.75] },
  cliffs: { 'land.face': ['blocky', 0.5] }, basalt: { 'land.face': ['columnar', 0.75] }, columns: { 'land.face': ['columnar', 0.75] },
  layered: { 'land.strata': ['layered', 0.5] }, sandstone: { 'land.strata': ['layered', 0.75], 'land.landmark': ['butte', 0.25] }, folded: { 'land.strata': ['folded', 0.5] },
  canyon: { 'land.strata': ['tilted', 0.5], 'land.landmark': ['butte', 0.5], 'land.face': ['slabby', 0.5] }, desert: { 'land.landmark': ['butte', 0.5], 'land.cloud': ['cirrus', 0.25], 'land.rock': ['hoodoo', 0.5], weather: 'desert', biome: 'desert' },
  coast: { 'land.rock': ['stack', 0.5], 'land.landmark': ['arch', 0.25], biome: 'coast' }, shore: { 'land.rock': ['stack', 0.25], 'water.coast': true }, sea: { 'land.rock': ['stack', 0.5], 'water.coast': true },
  // the water on the land (era/out-water.js), laid on the cube so every trail it paints is cut with it: a lake beside the
  // walk, the open side falling to the sea, a river beside the walk (the falls are a landmark's, below)
  lake: { 'water.lake': true }, lakeside: { 'water.lake': true }, pond: { 'water.lake': { size: 4 } }, tarn: { 'water.lake': { size: 5 } },
  beach: { 'water.coast': true }, ocean: { 'water.coast': true }, seaside: { biome: 'coast' }, coastal: { biome: 'coast' },
  river: { 'water.river': true }, riverside: { 'water.river': true }, stream: { 'water.river': { width: 1.8 } }, brook: { 'water.river': { width: 1.6 } }, creek: { 'water.river': { width: 1.8 } },
  // a biome (BIOMES): its flora, its palette's character and its ground laid on the cube together
  // conifers: the alpine flora's stands on the meadow's card (a pine forest is not a bamboo one)
  pine: { kit: 'isekai-meadow', 'flora.biocube': { from: 'alpine', flora: { trees: { clusters: 11 } } } }, conifer: { kit: 'isekai-meadow', 'flora.biocube': { from: 'alpine', flora: { trees: { clusters: 11 } } } },
  spruce: { kit: 'isekai-meadow', 'flora.biocube': { from: 'alpine', flora: { trees: { clusters: 11 } } } }, fir: { kit: 'isekai-meadow', 'flora.biocube': { from: 'alpine', flora: { trees: { clusters: 11 } } } },
  // (the land laid in sand dunes, every trail the cube paints, open on both sides of the walk: era/out-dunes.js; a sea of
  // sand is long ridges, its crests tall)
  dunes: { biome: 'desert', 'outside.dunes': true, 'outside.cliff': false }, dune: { biome: 'desert', 'outside.dunes': true, 'outside.cliff': false },
  // under the sea (a scene's `sea`, scene/channels/sea.js, by the word's depth): the bed the desert's ground in low
  // dunes, open, its flora the bed's own (BIOMES.seabed: reef rock, corals, weed; marine/roster.js)
  underwater: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'reef' }, undersea: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'reef' },
  seabed: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'reef' }, seafloor: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'reef' },
  reef: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'shallows' }, coral: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'shallows' },
  abyss: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'midnight' }, abyssal: { biome: 'seabed', 'outside.dunes': { supply: 1, height: 1.4, spacing: 18 }, 'outside.cliff': false, sea: 'midnight' },
  sandy: { biome: 'desert', 'outside.dunes': { supply: 0.5 } }, erg: { biome: 'desert', 'outside.dunes': { supply: 1, height: 4 }, 'outside.cliff': false }, arid: { biome: 'desert' },
  // landmarks
  arch: { 'land.landmark': ['arch', 0.25] }, arches: { 'land.landmark': ['arch', 0.75] }, spire: { 'land.landmark': ['spire', 0.25] }, spires: { 'land.landmark': ['spire', 0.75] },
  monolith: { 'land.landmark': ['monolith', 0] }, waterfall: { 'land.landmark': ['falls', 0] }, falls: { 'land.landmark': ['falls', 0] }, cascade: { 'land.landmark': ['falls', 0] }, mesa: { 'land.landmark': ['butte', 0.25] },
  // the sky
  clear: { 'land.cloud': [null, 0] }, fair: { 'land.cloud': ['cumulus', 0.25] }, cloudy: { 'land.cloud': ['cumulus', 0.75] }, overcast: { 'land.cloud': ['stratus', 1], weather: { overcast: 4, haze: 1, drizzle: 0.5 } },
  misty: { 'land.cloud': ['stratus', 0.75], weather: { mist: 4, fog: 1, overcast: 1, clear: 1 } }, foggy: { 'land.cloud': ['stratus', 1], weather: { fog: 4, mist: 2, overcast: 1 } }, stormy: { 'land.cloud': ['towering', 0.75], weather: 'storm-coast' }, windy: { 'land.cloud': ['cirrus', 0.5] }, lenticular: { 'land.cloud': ['lenticular', 0.25] },
  // what falls
  rainy: { weather: { drizzle: 2, rain: 3, overcast: 2, mist: 1 } }, wet: { weather: { drizzle: 2, rain: 3, overcast: 2, mist: 1 } }, monsoon: { weather: 'monsoon' },
  snowy: { weather: 'alpine', snow: true }, snow: { weather: 'alpine', snow: true }, alpine: { weather: 'alpine', biome: 'alpine' }, dusty: { weather: 'desert' }, autumn: { weather: 'autumn' },
  // how big
  small: { levels: 2 }, short: { levels: 2 }, epic: { levels: 5 }, vast: { levels: 5 }, long: { levels: 4 },
  // what a level is played for (a level's goal, quick.js levelGoalMechanics): what lies along the way to pick up, a boss
  // at the end, health to lose, guards who see to get past unseen
  relic: { 'goal.collect': 'relic' }, treasure: { 'goal.collect': 'treasure' }, coin: { 'goal.collect': 'coin' }, gem: { 'goal.collect': 'gem' }, jewel: { 'goal.collect': 'jewel' }, collect: { 'goal.collect': true },
  boss: { 'goal.boss': true }, bosses: { 'goal.boss': true },
  escape: { 'goal.escape': true }, locked: { 'goal.escape': true },
  // (a wave gauntlet's: never `gauntlet` or `waves`, which say a glove and a tower defence)
  horde: { 'goal.gauntlet': true }, hordes: { 'goal.gauntlet': true }, onslaught: { 'goal.gauntlet': true },
  // (and one to endure: its waves on a clock, a time to outlast)
  holdout: { 'goal.gauntlet': 'holdout' }, holdouts: { 'goal.gauntlet': 'holdout' },
  health: { 'goal.health': true }, lives: { 'goal.health': true }, heart: { 'goal.health': true }, hp: { 'goal.health': true },
  guard: { 'goal.guards': true }, sentry: { 'goal.guards': true }, sentries: { 'goal.guards': true }, stealth: { 'goal.guards': true }, stealthy: { 'goal.guards': true }, sneak: { 'goal.guards': true }, sneaking: { 'goal.guards': true }, unseen: { 'goal.guards': true },
  // indoors: the levels are buildings (a crypt by default), laid room by room in a room kit
  dungeon: { building: 'crypt' }, crypt: { building: 'crypt' }, vault: { building: 'crypt' }, interior: { building: 'crypt' },
  catacomb: { building: 'crypt', 'building.kit': 'catacomb' }, tomb: { building: 'crypt', 'building.kit': 'catacomb' },
});
// what a building is when the prompt is indoors and a word names one (read only then): its use, and the room kit it is
// dressed in unless a word named that (a temple's nave; else the dungeon's stone)
const ROOM_USE_WORDS = Object.freeze({ keep: 'keep', castle: 'keep', temple: 'temple', shrine: 'temple' });
const ROOM_KIT_OF_USE = Object.freeze({ temple: 'gothic-nave' });
// a party RPG round its town: the cube it stands on when no word names one, and its places' character on it (their
// flora, era/biocube.js; the first wilds' water, era/out-water.js; the cube's grit, so its town is drawn from relief)
const ROUND_CUBE = 'valley-morning';
const ROUND_PLACES = Object.freeze({ grit: 0.5, quiet: 0, wilds: 'grove', castle: 'upland', water: Object.freeze({ lake: true }) });
// the words that name a castle: round a hub, a level of its own (its castle walked); elsewhere a building's use
const CASTLE_WORDS = new Set(['castle', 'castles', 'keep', 'citadel']);
// the round laid as a mandala (megaworld.js): the key that opens the way into its core, named for what the core is
const ROUND_MANDALA = Object.freeze({ key: (core) => `${core}-key` });
// THE ROUND'S TALK: a townsperson who follows the story (folk/pages.js), RPG Maker's event pages from the mandala's own
// gate: the priest (every turn-based town keeps a temple) says where the core's key is kept until it is held, then that
// the way is open. Their words, the composer's starter: the operator's `say` takes their place
const ROUND_TALK = Object.freeze({ who: 'priest' });
// a party RPG's brief where its words name none (gmn.js): save the world, by storming the citadel (a mandala, a walled
// core at its middle)
// THE ROUND'S QUEST (the journal's): its name the motivation's, its steps the key, the way in and the boss; each raised
// by what happens (the key's pickup where it is kept, the core begun) or by the boss's fall (its flag, battles.sets)
export function roundQuest({ motivation, gate, core, name, boss }) {
  const key = gate.key.replace(/-/g, ' '), found = `found-${gate.key}`.slice(0, 48), entered = 'entered-core', stormed = 'core-stormed';
  const title = MOTIVATIONS[motivation].name, cap1 = (s) => s[0].toUpperCase() + s.slice(1);
  const steps = [
    { log: `Find the ${key} in ${name(gate.keyAt)}.`, done: found, on: `pickup:${gate.key}`, at: gate.keyAt },
    { log: `Go into ${name(core)}.`, done: entered, on: 'start', at: core },
    ...(boss ? [{ log: `Bring down what waits at the heart of ${name(core)}.`, done: stormed }] : []),
  ];
  return { quest: { id: motivation, name: cap1(title), steps }, ...(boss ? { sets: stormed } : {}) };
}

// THE CITADEL a citadel labour's core is built as (wcd/wcd.js, era/programs.js uses): its guardhouse, its vault (the
// dungeon the words name, else this), its sanctum
const CITADEL = Object.freeze({ gate: 'guardhouse', vault: 'crypt', core: 'citadel' });
const ROUND_GMN = Object.freeze({ motivations: Object.freeze({ 'save-the-world': 1 }), labours: Object.freeze({ 'storm-the-citadel': 1 }) });
const ROUND_NOT_YET = (shape) => `a party RPG lays its round as a mandala, a chain, a hub or an open world; a ${shape} round is not laid, so the mandala stands for it`;
// the shapes a party RPG's round is laid in (megaworld.js)
const ROUND_SHAPES = Object.freeze(['mandala', 'chain', 'hub', 'open']);
// the treasure chests each fighting stage of a party RPG keeps (gameworld/chests.js)
// (two a stage; one in four of them locked, its key won from a pack on the stage, one in seven a mimic)
const ROUND_CHESTS = Object.freeze({ n: 2, locked: 0.25, mimics: 0.15 });
const low = (t) => (typeof t === 'string' && /^The /.test(t) ? `the ${t.slice(4)}` : t);
function roundTalk(world) {
  const M = world.megaworld, core = M?.rings?.at(-1)?.[0], gate = core && M.gates?.[core];
  if (!gate?.key) return null;
  const name = (id) => low(world.levels[id]?.name ?? id), far = M.rings[1][0], key = gate.key.replace(/-/g, ' ');
  return { say: { [ROUND_TALK.who]: [
    { if: { has: gate.key }, say: [`You carry the ${key}.`, `The way past ${name(far)} to ${name(core)} is open to you now. Go carefully.`] },
    { say: [`${name(core)[0].toUpperCase()}${name(core).slice(1)} past ${name(far)} is sealed.`, `Its key is kept in ${name(gate.keyAt)}.`] },
  ] } };
}

// the cube a word points at (era/geocube.js): one style for the level's inside and outside, its colours the color
// theorist's (the stamp seeds its palette, and the world takes it). The first word to name one decides it
export const CUBE_WORDS = Object.freeze({
  night: 'gothic-night', dark: 'gothic-night', gothic: 'gothic-night', crypt: 'gothic-night', haunted: 'gothic-night', moonlit: 'gothic-night', torchlit: 'gothic-night',
  island: 'island-noon', coast: 'island-noon', sea: 'island-noon', shore: 'island-noon', beach: 'island-noon', sunny: 'island-noon', tropical: 'island-noon', noon: 'island-noon',
  jungle: 'jungle-haze', haze: 'jungle-haze', hazy: 'jungle-haze', swamp: 'jungle-haze', overgrown: 'jungle-haze', humid: 'jungle-haze',
  limestone: 'limestone-crags', crag: 'limestone-crags',
});
// the hour a word lights the cube's outside at (era/geocube-hours.js, the world's `style.hour`): the first word to name
// one decides it, read once the cube is chosen. An hour the cube is lit at already adds nothing (the night of a night cube)
export const HOUR_OF_WORDS = Object.freeze({
  dawn: 'dawn', sunrise: 'dawn', morning: 'morning', daytime: 'noon', midday: 'noon', daylight: 'noon', afternoon: 'afternoon', sunset: 'golden', dusk: 'dusk', twilight: 'dusk', evening: 'dusk', night: 'night', moonlit: 'night',
});
/**
 * THE BIOMES: a place's character laid on a cube at once: its flora (a biocube, era/biocube.js), its palette's character
 * (the colour theorist's own preset for such a place, color-theorist/solve.js PALETTE_PRESETS: its axes and hues as the
 * spec, solved with the cube's seed), its ground (a land's formation, era/substrate.js: sandstone weathers to sand) and
 * its water (era/out-water.js); `colour`: the cube's colours it locks (a role the palette's solve fits the rest round).
 */
export const BIOMES = Object.freeze({
  coast: Object.freeze({ biocube: 'coast', palette: 'coastal-noon', water: Object.freeze({ coast: true }) }),
  alpine: Object.freeze({ biocube: 'alpine', palette: 'alpine-dawn' }),
  desert: Object.freeze({ biocube: 'desert', palette: 'desert-haze', skin: 'sandstone' }),
  // (a seabed: the desert's ground and palette, its flora the bed's own, era/biocube.js `seabed`; no grass grows on it, so
  // the ground a land paints as grass is sand too: its grass and foliage roles locked to the bed's sand and weed)
  seabed: Object.freeze({ biocube: Object.freeze({ from: 'seabed', fauna: Object.freeze({ sea: true }) }), palette: 'desert-haze', skin: 'sandstone', colour: Object.freeze({ grass: '#cbbd98', foliage: '#6f8a4a' }) }),
});
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** What a world map grows where its cube names no flora: the meadow kit's own card flora (era/biocube.js). */
export const MAP_FLORA = Object.freeze({ kit: 'isekai-meadow', biocube: 'meadow' });
/** A cube (a preset id or { from, …changes }) with the land the words name laid on it: open (`outside.cliff: false`),
 * wildflowers in its grass (its biocube's, else the meadow's, with `flowers.share`), its snow, its water (`outside.water`),
 * its dunes (`outside.dunes`),
 * a biome (BIOMES: its flora, palette, ground and water), a biocube a word names, the palette's character a word names
 * (`palette`: the theorist's axes, over the biome's). Shared by a game's cube (composeGameworld) and a scene's
 * (scene-words.js). */
export function cubeWithLand(geocube, { open = false, flowers = null, snow = false, water = null, dunes = null, biome = null, biocube = null, palette = null } = {}) {
  const c = typeof geocube === 'string' ? { from: geocube } : { ...geocube };
  if (open) c.outside = { ...(c.outside ?? {}), cliff: false };
  const B = biome ? BIOMES[biome] : null;
  if (B?.skin) c.outside = { ...(c.outside ?? {}), land: { ...(c.outside?.land ?? {}), skin: B.skin } };
  if (B?.colour) c.colour = { ...(c.colour ?? {}), ...B.colour };
  const W = { ...(B?.water ?? {}), ...(water ?? {}) };
  if (Object.keys(W).length) c.outside = { ...(c.outside ?? {}), water: { ...(c.outside?.water ?? {}), ...W } };
  if (dunes !== null) c.outside = { ...(c.outside ?? {}), dunes };
  const bio = biocube ?? B?.biocube ?? null;
  if (bio !== null) c.biocube = bio;
  if (flowers !== null && bio === null) { const b = readGeocube(geocube).biocube; c.biocube = { from: typeof b === 'string' ? b : b?.from ?? 'meadow', flora: { flowers: { share: flowers } } }; }
  else if (flowers !== null) c.biocube = { from: typeof bio === 'string' ? bio : bio.from, flora: { ...(isObj(bio) ? bio.flora : {}), flowers: { share: flowers } } };
  if (snow) c.snow = true;
  const P = B ? PALETTE_PRESETS[B.palette] : null, axes = { ...(P ? { intent: P.says, ...P.spec } : {}), ...(palette ?? {}) };
  if (Object.keys(axes).length) c.palette = { ...(isObj(c.palette) ? c.palette : {}), ...axes };
  return c;
}

/** What a word decides: the shared table's reading (LEXICON), else a painted-landscape glyph's (glyph-words.js) where
 * no table reads the word; a game takes no camera (a scene's still). → { <decide>: value } | null */
export function readingOf(word, { scene = false } = {}) {
  const r = LEXICON[word] ?? LEXICON[word.replace(/s$/, '')];
  if (r) return r;
  if (CUBE_WORDS[word] ?? CUBE_WORDS[word.replace(/s$/, '')] ?? HOUR_OF_WORDS[word] ?? HOUR_OF_WORDS[word.replace(/s$/, '')]) return null;
  const g = glyphOf(word);
  if (!g || (g.family === 'camera' && !scene)) return null;
  return g.decides;
}
/** The words that fall from a cliff (a landmark's falls): a fall keeps the cliff an open word would take away. */
export const fallsWords = (P) => P.read.filter((r) => { const v = readingOf(r.word)?.['land.landmark']; return v && v[0] === 'falls'; }).map((r) => r.word);
// a kit's nearest cube when no word names one; an airless plain has none (every cube has air)
// the cube a prompt's levels stand on: the one its words name, else the kit's nearest (null: none has its air)
const cubeOfWords = (P, kit) => { const w = P.words.find((x) => CUBE_WORDS[x] ?? CUBE_WORDS[x.replace(/s$/, '')]); return w ? CUBE_WORDS[w] ?? CUBE_WORDS[w.replace(/s$/, '')] : KIT_CUBE[kit] ?? null; };
export const KIT_CUBE = Object.freeze({ 'isekai-meadow': 'island-noon', 'isekai-sakura': 'island-noon', 'isekai-garden': 'island-noon', 'isekai-bamboo': 'jungle-haze', 'alien-night': 'gothic-night' });

const STOP = new Set(['with', 'from', 'into', 'over', 'under', 'that', 'this', 'their', 'there', 'where', 'some', 'very']);
const SUFFIX = ['approach', 'crossing', 'heights', 'hold', 'reach', 'end'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'world';
const pick = (rand, a) => a[Math.floor(rand() * a.length)];

/** Read a prompt's words: what each decides, and what nothing read. */
export function readPrompt(prompt, { scene = false } = {}) {
  const words = String(prompt ?? '').toLowerCase().split(/[^a-z-]+/).filter(Boolean), read = [], unread = [];
  for (const w of words) { const r = readingOf(w, { scene }); if (r) read.push({ word: w, decides: Object.keys(r) }); else if (w.length > 3 && !STOP.has(w)) unread.push(w); }
  return { words, read, unread: [...new Set(unread)] };
}

/** A whole gameworld from a few prompts, decided by the agent, checked by its machine gate. */
/**
 * A civilization's technology in words: each clause that names a machine's function is a thing ("tracked haulers",
 * "solar arrays"), one that names a vehicle, a tech-structure or a weapon the crafter's ("war galleys", "a stargate"),
 * and what the crafted things share (a motif, the elements named) its direction. → { technology?, tunnels }, technology
 * absent when the words name nothing it makes.
 */
// a clause names a thing when it is a noun phrase: the thing's word among its first few ("tracked haulers", "a great
// lighthouse", "iron truss bridges"), never a sentence that mentions one ("a cursed knight guards the gate")
const NOUN_LEAD = 3;
// → the noun phrase ("great lighthouse"), or null when the clause is not one
const named = (clause, word) => {
  const ws = clause.replace(/^(an?|the)\s+/i, '').split(/[^A-Za-z0-9-]+/).filter(Boolean), w = String(word).toLowerCase();
  const at = ws.findIndex((x) => x.toLowerCase() === w || x.toLowerCase().startsWith(w));
  if (at < 0 || at > NOUN_LEAD) return null;
  // a short clause is the phrase whole ("zeppelin airships", "solar arrays"); a long one is cut after the thing's word
  return ws.length <= NOUN_LEAD + 3 ? clause.replace(/^(an?|the)\s+/i, '') : ws.slice(0, at + 1).join(' ');
};

export function technologyOfWords(prompt) {
  const things = {}, crafted = {}, tunnels = {};
  for (const clause of String(prompt).split(/[,;:]|\band\b/i).map((c) => c.trim()).filter(Boolean)) {
    // (a clause about buildings is the building tunnel's; its fittings, a mast or wings, do not make it one)
    if (readIntent(buildingDomain(), clause).traits.some((t) => !['solar', 'mast'].includes(t.id))) continue;
    const fn = readIntent(techDomain(), clause).traits.filter((t) => TECH_TRAITS[t.id].fn);
    const thing = fn.length ? named(clause, fn.at(-1).word) : null;
    if (fn.length && !thing) continue;
    if (fn.length) {
      const id = slug(fn.at(-1).word.replace(/s$/, ''));
      if (!things[id]) things[id] = thing;
      continue;
    }
    // no machine: a clause that names a vehicle, a tech-structure or a weapon ("war galleys", "a stargate") is the crafter's
    const kind = craftKindOf(clause);
    if (!kind) continue;
    const list = Object.keys(CRAFTED).find((k) => CRAFTED[k] === kind), form = readIntent(craftDomain(kind), clause).traits.filter((t) => CRAFT_TRAITS[kind][t.id].form);
    const phrase = form.length ? named(clause, form.at(-1).word) : null;
    if (!phrase) continue;
    const id = slug(form.at(-1).word.replace(/s$/, ''));
    crafted[list] ??= {};
    if (!crafted[list][id]) crafted[list][id] = phrase;
  }
  let technology = null;
  if (Object.keys(things).length) { technology = { things }; tunnels.things = Object.keys(things); }
  for (const [list, made] of Object.entries(crafted)) { technology = { ...(technology ?? {}), [list]: made }; tunnels[list] = Object.keys(made); }
  // what the crafted things share: a motif and the elements the prompt names, when it crafts anything
  if (Object.keys(crafted).length) {
    const motif = motifOf(prompt), els = String(prompt).toLowerCase().split(/[^a-z0-9-]+/).filter((w) => ELEMENT_WORDS[w]).filter((w, i, a) => a.indexOf(w) === i);
    const direction = { ...(motif ? { motif } : {}), ...(els.length ? { elements: { primary: els[0], ...(els[1] ? { secondary: els[1] } : {}) } } : {}) };
    if (Object.keys(direction).length) { technology.direction = direction; tunnels.direction = Object.keys(direction); }
  }
  return { ...(technology ? { technology } : {}), tunnels };
}

// THE FLIGHT RAILS' STARTERS: the rails whose first reading is their own starter (each a game of levels laid whole, its
// lessons, stages or missions), with the count a sentence's `levels` asks of it. A rail is named by its own words; the
// words alone too common to name it (a cockpit is a car's too) name it only beside its genre
const RAIL_STARTS = Object.freeze({
  'pilot-school': (w, n) => pilotSchoolStart(w, n ? { lessons: n } : {}),
  'wolf-squadron': (w, n) => wolfSquadronStart(w, n ? { stages: n } : {}),
  'rebel-storm': (w, n) => rebelStormStart(w, n ? { missions: n } : {}),
  'blaze-gunner': (w, n) => blazeGunnerStart(w, n ? { stages: n } : {}),
});
const RAIL_WEAK = new Set(['cockpit', 'starfighter', 'barrel roll', 'realistic flight']);
const FLIGHT_GENRES = new Set(['flight-sim', 'air-combat', 'space-shooter', 'space-sim', 'co-op-scroller']);
/** The flight rail a sentence is laid as, or null: { id, matched } (the rail's own words it used; none where the
 * genre read is one no other form lays). Only beside no genre or a flight genre. */
export function starterRailOf(prompt, genreId = null) {
  if (genreId && !FLIGHT_GENRES.has(genreId)) return null;
  const t = ` ${String(prompt ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ')} `;
  const named = Object.keys(RAIL_STARTS)
    .map((id) => ({ id, matched: RAILS[id].words.filter((w) => t.includes(` ${w} `)) }))
    .filter((r) => r.matched.length && (genreId || r.matched.some((w) => !RAIL_WEAK.has(w))))
    .sort((a, b) => b.matched.length - a.matched.length || Math.max(...b.matched.map((w) => w.length)) - Math.max(...a.matched.map((w) => w.length)));
  if (named.length) return named[0];
  // (a genre that is a rail's own cube and no form of the book's: laid as that rail)
  const own = genreId && !GENRE_FORMS[genreId] ? Object.keys(RAIL_STARTS).find((id) => RAILS[id].handles.genres[0] === genreId) : null;
  return own ? { id: own, matched: [] } : null;
}
/** The composed world laid as a flight rail's starter: its name, its brief and its seed the sentence's, the rest the
 * rail's (its levels, its intent, its look), its pitch written. */
function railStarterWorld(world, { id, matched }, levels) {
  const R = RAILS[id], says = `rail.from=${id}`;
  for (const w of matched) { const r = world.brief.read.find((x) => x.word === w); if (r) r.decides = [...r.decides, says]; else world.brief.read.push({ word: w, decides: [says] }); }
  const said = new Set(matched.flatMap((w) => w.split(/[^a-z0-9-]+/)));
  const brief = { ...world.brief, unread: world.brief.unread.filter((w) => !said.has(w)), rail: { from: id, name: R.name, by: matched.length ? matched : 'its genre' }, start: `${R.name}'s starter: ${R.level1}` };
  const { world: W } = RAIL_STARTS[id]({ id: world.id, name: world.name, seed: world.seed, brief }, levels);
  const out = { ...W, ...(W.intent === undefined ? { intent: { from: R.handles.genres[0] } } : {}), rail: { from: id, size: 'designed' } };
  readGameworld(out);
  return out;
}

export function composeGameworld({ prompt, name, id, levels, seed = 1 } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('gameworld: compose needs a prompt: a few words about the world');
  const P = readPrompt(prompt), rand = mulberry32((seed * 2654435761) >>> 0 || 1);
  const style = { trail: {}, land: {} }, langs = [];
  let fort = null, meru = null, kit = null, count = null, weather = null, room = null, roomKit = null;
  let openWord = null, flowers = null, snowy = false, dunes = null, biome = null, biocube = null, palette = null, glyphHour = null;
  const goal = {}, water = {};
  for (const { word } of P.read) {
    const r = readingOf(word);
    for (const [k, v] of Object.entries(r)) {
      if (k === 'kit') kit = kit ?? v;
      else if (k === 'anchor') { if (!langs.includes(v)) langs.push(v); }
      else if (k === 'fort') fort ??= v;
      else if (k === 'meru') meru ??= v;
      else if (k === 'weather') weather ??= typeof v === 'string' ? v : { climate: v };
      else if (k === 'levels') count ??= v;
      // (the land laid on the cube once it is chosen: open, its wildflowers, its snow)
      else if (k === 'outside.cliff') openWord ??= word;
      else if (k === 'flora.flowers') flowers ??= v;
      else if (k === 'snow') snowy = true;
      // (its water, its biome, a flora a glyph names, the palette's character, a glyph's hour: era/out-water.js, BIOMES)
      else if (k.startsWith('water.')) water[k.slice(6)] ??= v;
      else if (k === 'outside.dunes') dunes ??= v;
      else if (k === 'biome') biome ??= v;
      else if (k === 'flora.biocube') biocube ??= v;
      else if (k === 'palette') palette ??= v;
      else if (k === 'hour') glyphHour ??= word;
      // (a word naming what is collected wins over one that only says to collect)
      else if (k.startsWith('goal.')) { const g = k.slice(5); goal[g] = g === 'collect' && typeof goal.collect === 'string' ? goal.collect : v; }
      else if (k === 'building') room ??= v;
      else if (k === 'building.kit') roomKit ??= v;
      // the first word to decide a thing decides it (the more particular word comes first: basalt cliffs)
      else if (k.startsWith('trail.')) style.trail[k.slice(6)] ??= v;
      else if (k.startsWith('land.')) { const f = k.slice(5), [variant, many] = v, o = style.land[f] || {}; style.land[f] = { ...(variant && o.variant === undefined ? { variant } : {}), ...(many != null && o.many === undefined ? { many } : {}), ...o }; }
    }
  }
  // what no word decided, the seed does, inside the rails
  style.kit = kit ?? 'isekai-meadow';
  // (who builds, where no word says: the builders of the cube the levels will stand on, so the town is drawn in the
  // same art direction as its land (era/geocube.js cubeStreetLook); the seed's roll where the cube names none. The roll
  // is made either way, so what the seed decides after it stays as it was)
  if (!langs.length) { const rolled = pick(rand, ['timber-hall', 'tiered', 'shell']), cid = cubeOfWords(P, style.kit); langs.push((cid && cubeStreetLook(readGeocube(cid)).anchor) ?? rolled); }
  for (const f of ['rock', 'landmark']) if (!style.land[f]) style.land[f] = { variant: pick(rand, Object.keys(LAND_FORMS[f].variants).filter((v) => v !== 'falls')), many: pick(rand, [0, 0.25, 0.5]) };
  if (weather) style.weather = weather;
  style.meru = { preset: meru ?? pick(rand, ['mountain-lookout', 'stacked-lookout', 'terraced-mountain']) };
  if (!Object.keys(style.trail).length) delete style.trail;
  const n = Math.max(1, Math.min(6, levels ?? count ?? 3));

  // who builds: a civilization a language named, the first settling every level, a second raising the last castle
  const civilizations = Object.fromEntries(langs.map((a, i) => [`${a}-folk`, { name: `The ${a.replace('-', ' ')} folk`, anchor: a, fort: i === 0 ? (fort ?? 'crenellated') : 'battered' }]));
  const civIds = Object.keys(civilizations);
  style.civilization = civIds[0];
  // the tunnels: what the prompt says about the look, the buildings and the machines is tunnelled, not looked up. The
  // whole prompt is each tunnel's intent: every tunnel reads only the words it knows
  const tunnels = { look: readIntent(landDomain(), prompt).traits.map((t) => t.id), builds: readIntent(buildingDomain(), prompt).traits.map((t) => t.id), things: [] };
  if (tunnels.look.length) style.look = prompt;
  if (tunnels.builds.length) civilizations[civIds[0]].builds = prompt;
  const T = technologyOfWords(prompt);
  if (T.technology) {
    civilizations[civIds[0]].technology = T.technology;
    Object.assign(tunnels, T.tunnels);
  }
  // a civilization whose buildings are tunnelled from the prompt is named for what it builds
  if (tunnels.builds.length && !P.read.some((r) => r.decides.includes('anchor'))) {
    const said = readIntent(buildingDomain(), prompt).traits.map((t) => t.word), word = ['habitat', 'outpost', 'bunker', 'module', 'tower'].find((w) => said.includes(w)) ?? 'builder';
    const cid = `${slug(word.replace(/s$/, ''))}-folk`, C = civilizations[civIds[0]];
    delete civilizations[civIds[0]];
    civilizations[cid] = { ...C, name: `The ${word.replace(/s$/, '').replace(/-/g, ' ')} folk` };
    civIds[0] = cid; style.civilization = cid;
  }

  const title = name ?? cap(P.read[0]?.word ?? 'nameless') + (P.read[1] ? ` ${P.read[1].word}` : '') + ' world', wid = id ?? slug(title);
  const landscape = style.land.landscape?.variant ?? 'meadow';
  // a word a tunnel read is read, whatever the lexicon made of it
  // a word is unread when neither the lexicon nor any tunnel read it
  const unreadBy = [landDomain(), buildingDomain(), techDomain(), ...Object.values(CRAFTED).map((k) => craftDomain(k))].map((d) => new Set(readIntent(d, prompt).unread)), tunnelled = { has: (w) => !unreadBy.every((u) => u.has(w)) };
  // its juice (juice.js): 'auto', so a composed world's effects are drawn in its register and timed by its game type;
  // written into the recipe it mints (an older recipe without it is drawn as it always was)
  // the feel a prompt names (feel/suggest.js: a game it is like, "a Mega Man style run and gun"): written, so the
  // world plays it; its words are read. A prompt that names none writes none
  const said = suggestFeels(prompt, 1)[0], feelWords = new Set((said?.matched ?? []).flatMap((w) => w.split(/[^a-z0-9-]+/)));
  if (said) tunnels.feel = said.matched;
  // what game it is (intent.js readGenre): the genre the words name, written as the feel is, before the levels are laid
  // so they are laid for it. Only a clear read: a genre's own name, or the first genre ahead of the second on two of its
  // words (one word, "towers" or "map", says too little). Otherwise none, and design_game asks, naming the genres the
  // words point at
  // (a genre named only by words the brief's FEEL already claims is the feel's, not a genre: "a mega man style run and
  // gun" names a game whose feel is known, a platformer that shoots, not a street to fight down)
  const genre0 = readGenre(prompt);
  const genre = genre0 && said && said.matched.length > genre0.matched.length && genre0.matched.every((w) => said.matched.includes(w)) ? null : genre0;
  const leadWords = new Set((genre?.matched ?? []).flatMap((w) => w.split(/[^a-z0-9-]+/)));
  // a genre that is another door's medium is said, not laid; one the registry cannot make yet is refused with what it
  // waits on (genre-forms.js), nothing laid in its place
  if (genre && HAND_OFFS[genre.id]) throw new Error(`gameworld: compose: ${GENRES[genre.id].name.toLowerCase()} is made by ${HAND_OFFS[genre.id].door}: ${HAND_OFFS[genre.id].why}. Nothing is laid here.`);
  const refused = genre ? refusalOf(genre.id, suggestGenres(prompt, Infinity).map((g) => g.id)) : null;
  if (refused) throw new Error(`gameworld: compose: ${GENRES[genre.id].name.toLowerCase()} is ${refused.verdict === 'blocked' ? 'not makeable yet' : 'not wholly makeable yet'}: it waits on ${refused.waits.join(', ')}. Nothing is laid in its place.${refused.others.length ? ` The words also point at ${refused.others.map((g) => GENRES[g].name.toLowerCase()).join(', ')}, which can be made.` : ''}`);
  const pending = genre ? pendingOf(genre.id) : null;
  if (pending) throw new Error(`gameworld: compose: ${GENRES[genre.id].name.toLowerCase()} is not laid from a sentence yet: it waits on ${pending.waits}. Nothing is laid in its place.${pending.one ? ` One level of it alone is design_game({ quick: ${pending.call} }).` : ''}`);
  const form = genre ? GENRE_FORMS[genre.id] ?? null : null;
  // (a beat-em-up a sentence calls a superhero one: its streets on the heroes tuning, genre-forms.js heroStreetWords)
  const heroWords = genre?.id === 'co-op-brawler' ? heroStreetWords(prompt) : [];
  // the frame a genre on foot is laid in (genre-forms.js heroFrameOf): a hero by default, the camera its cube asks, a
  // monitor's screen; written before the levels are laid (a side camera runs a trail's line: no climbs)
  // the form (resonance.js): what the genre's cube asks of the world that the composer can fill, written before the
  // levels are laid (a co-op platformer's side camera, its walks laid without climbs); the hero it asks is the creator's
  const fills = genre ? composerFills(cubeOfWorld({ intent: { from: genre.id } }).cube) : {};
  const frame = genre && (!form || form.hero) ? heroFrameOf(genre.id, null) : null, camera = fills.camera ?? frame?.camera ?? null;
  const world = { id: wid, name: title, seed, mode: 'autonomous', brief: { prompt, read: P.read, unread: P.unread.filter((w) => !tunnelled.has(w) && !feelWords.has(w) && !(genre && leadWords.has(w))), tunnels }, ...(genre ? { intent: { from: genre.id } } : {}), ...(camera ? { camera } : {}), ...(frame || form ? { screen: form?.screen ?? frame?.screen ?? 'screen' } : {}), ...(said ? { feel: said.pole } : {}), juice: 'auto', style, civilizations, levels: {}, links: [] };
  // the words that named the genre are read: they decide the intent
  for (const w of genre?.matched ?? []) {
    const says = `intent.from=${genre.id}`, r = world.brief.read.find((x) => x.word === w);
    if (r) r.decides = [...r.decides, says]; else world.brief.read.push({ word: w, decides: [says] });
  }
  // A FLIGHT RAIL'S OWN GAME (rails.js): a sentence that names Pilot School, Wolf Squadron or Rebel Storm in their own
  // words (flight school, a star fox style rail shooter, x-wing), or names the genre only that rail lays (a space combat
  // sim), is laid as the rail's starter, its pitch written unlocked (the producer says it back and locks it)
  const railStart = starterRailOf(prompt, genre?.id ?? null);
  if (railStart) return railStarterWorld(world, railStart, levels);
  // (and the words that make a beat-em-up a superhero one decide its streets' tuning)
  for (const w of heroWords) {
    const says = 'levels.street.tuning=heroes', r = world.brief.read.find((x) => x.word === w);
    if (r) r.decides = [...r.decides, says]; else world.brief.read.push({ word: w, decides: [says] });
    world.brief.unread = world.brief.unread.filter((x) => !w.split(' ').includes(x));
  }
  // the foes the words name (foe-words.js: skeletons, orcs, beast folk…), where the world fights turn by turn: its party
  // battles' packs walk round them, each in the look its word asks for, made through its character door
  const foeWords = genre && [].concat(cubeOfWorld({ intent: { from: genre.id } }).cube.power?.combat ?? []).includes('turn-based') ? readFoeWords(prompt) : null;
  if (foeWords) {
    world.battles = { packs: foePacks(foeWords.kinds), ...(Object.keys(foeWords.looks).length ? { looks: foeWords.looks } : {}) };
    const said = new Set(foeWords.read.flatMap((r) => r.word.split(' ')));
    world.brief.unread = world.brief.unread.filter((w) => !said.has(w));
    for (const r of foeWords.read) world.brief.read.push(r);
  }
  // indoors (a dungeon, a crypt…): the levels are buildings of one use in a room kit; where the prompt also names the
  // ground outside (a kit or a land form), the first level is that ground, the way in, and the later ones the building
  const indoors = room ? (() => {
    const useWord = P.words.find((w) => ROOM_USE_WORDS[w] ?? ROOM_USE_WORDS[w.replace(/s$/, '')]), use = useWord ? ROOM_USE_WORDS[useWord] ?? ROOM_USE_WORDS[useWord.replace(/s$/, '')] : room;
    const outside = P.read.some((r) => r.decides.some((d) => d === 'kit' || d.startsWith('land.')));
    return { use, kit: roomKit ?? ROOM_KIT_OF_USE[use] ?? 'gothic-stone', useWord, from: outside && n > 1 ? 1 : 0 };
  })() : null;
  // (a genre that fights, its cube's combat melee or ranged, fights its guards: they are its foes, the casting call's, not
  // watchers the level is lost to; the watchers' goal stays the sneak's)
  if (goal.guards && genre && [].concat(cubeOfWorld({ intent: { from: genre.id } }).cube.power?.combat ?? []).some((c) => c === 'melee' || c === 'ranged')) {
    delete goal.guards;
    const r = P.read.find((x) => x.decides.includes('goal.guards'));
    if (r) r.decides = r.decides.map((d) => (d === 'goal.guards' ? 'foes (a fighting genre\'s guards are fought)' : d));
  }
  const goals = Object.keys(goal).length ? goal : null;
  const decided = [];
  // a genre whose world is returned to (its cube's space.topology hub: a party RPG, a top-down adventure) is laid round a
  // centre: the first level is the town (its street on the ground: its hall and its first shop walked into as part of
  // the world, their keepers inside at their counters; each more one walked into takes a later house's ground; the street closed by
  // its builders' walls, a gatehouse at each end), every other level joined to it both
  // ways (a map
  // world, world.js hub), each
  // a stretch of the wilds; a building, a form or a single level is laid as before
  // A PARTY RPG ROUND ITS TOWN (a hub genre whose words name a dungeon or a castle): the dungeon does not turn the world
  // indoors; it is the last level, a building of its use with the boss at its end, and a castle named is a level of its
  // own before it; the wilds between the town and them. A turn-based game's town keeps an inn and a temple on its
  // street (era/town-trades.js), the party's rest and its priest
  const hubbed = !!genre && !form && n >= 2 && cubeOfWorld({ intent: { from: genre.id } }).cube.space?.topology === 'hub';
  const turnBased = hubbed && [].concat(cubeOfWorld({ intent: { from: genre.id } }).cube.power?.combat ?? []).includes('turn-based');
  // THE ROUND'S BRIEF (gmn.js): what a party RPG is about and what it asks of the player, read from its words (the
  // princess, the citadel, the sea…), a JRPG's own where they name none (ROUND_GMN: save the world, storm the citadel).
  // Its labour's shape is the round's: a mandala, rings travelled inward to a gated core. A shape a party RPG does not
  // lay yet (a chain, a hub, an open world) is laid as the mandala, and the brief says so. A labour whose climax is a
  // CITADEL always has its dungeon: the round's core, a walled core (CITADEL below), the dungeon the words name its vault,
  // else a crypt
  const roundBrief = turnBased ? gmnOfWords(P.words, { defaults: ROUND_GMN }) : null;
  const roundResolved = roundBrief ? resolveGmn(roundBrief.gmn) : null, askedShape = roundResolved?.structure?.shape ?? null;
  // (a citadel the words named always has its dungeon; the JRPG's own, unnamed, builds one where the words laid a dungeon)
  const citadelClimax = roundResolved?.structure?.climax === 'citadel', namedLabour = !!roundBrief?.read.some((r) => r.decides.some((d) => d.startsWith('gameBrief.gmn.labours.')));
  // (THE ERA a party RPG's round is in, its kit's: round-eras.js; a fantasy era none, the presets as they are. Its
  // citadel built of its own buildings)
  const eraRow = turnBased ? roundEraOf(ERA_OF_KIT[style.kit]) : null, CIT = eraRow?.citadel ?? CITADEL;
  // (its levels named by its era's place word where it has one, else by the land's form: a colony, not a meadow)
  const placeWord = eraRow?.place ?? landscape;
  const vault = indoors ?? (hubbed && citadelClimax && namedLabour ? { use: CIT.vault, kit: CIT.kit ?? ROOM_KIT_OF_USE[CIT.vault] ?? 'gothic-stone', useWord: null, from: 0 } : null);
  const castled = hubbed && P.words.some((w) => CASTLE_WORDS.has(w)), dungeoned = hubbed && !!vault;
  const N = hubbed ? Math.max(n, 2 + (castled ? 1 : 0) + (dungeoned ? 1 : 0)) : n;
  const castleAt = castled ? (dungeoned ? N - 2 : N - 1) : -1;
  // (a turn-based round of three levels or more is laid in its labour's shape, ROUND_MANDALA below; its wilds counted as
  // they are laid. `roundMandala`: a round laid as a megaworld, in its shape, roundShape)
  const roundMandala = turnBased && N >= 3, roundShape = ROUND_SHAPES.includes(askedShape) ? askedShape : 'mandala';
  let wildsK = 0;
  // (the dungeon's use: the word's, but a castle named beside it is the castle's level, and the dungeon stays a crypt)
  const dungeonUse = dungeoned ? (vault.use === 'keep' && castled ? room : vault.use) : null;
  const hubId = `${wid}-1`.slice(0, 48);
  // a genre whose cube asks for a WORLD MAP (space.worldMap 'zones' on levelForm 'map': the action RPG) is laid as one: a
  // planned map walked block by block and travelled zone to zone, its first zone laid in teaching order (world-map.js),
  // never a run of trail walks. A building or a form is laid as before
  const spaceOf = genre ? cubeOfWorld({ intent: { from: genre.id } }).cube.space ?? {} : {};
  const mapped = !!genre && !form && !indoors && !hubbed && spaceOf.worldMap === 'zones' && spaceOf.levelForm === 'map';
  if (mapped) {
    const mid = `${wid}-map`.slice(0, 48), { level } = worldMapLevel({ n, landscape });
    world.levels[mid] = { ...level, seed: seed * 100 + 1 };
    Object.assign(world, { topology: 'interconnected', start: mid });
    decided.push({ level: mid, seed: seed * 100 + 1, tries: 1, laws: [] });
    // (how it starts: the opening block a page of its own, the controls and the enemy trail on it; then the first zone)
    world.brief.worldMap = { level: mid, blocks: level.glyphs.plan.route.length, opening: level.glyphs.plan.route.slice(0, WORLD_MAP.opening), ...(level.glyphs.zoned ? { firstZone: level.glyphs.zoned[0] } : {}) };
  }
  // (a mandala round's wilds are a world map, travelled zone to zone: the world a map world as its levels are laid)
  if (roundMandala) world.topology = 'interconnected';
  for (let i = 0; i < (mapped ? 0 : N); i++) {
    const lid = `${wid}-${i + 1}`.slice(0, 48), last = i === N - 1, climb = !hubbed && i % 2 === 0 && fills.climb !== false && camera !== 'side' && !(goal.gauntlet && last && !goal.boss);
    // the level's goal: what is collected and the health on every level, the boss at the end of the last; a horde's
    // gauntlet at the end of the last level a boss does not end (it owns the hero's hp there, so no health); held in an
    // escape room on every level neither ends
    const held = goals?.gauntlet && last && !goals.boss && !(indoors && i >= indoors.from && camera !== 'side');
    const lg = goals ? (({ boss, escape, gauntlet, health, ...g }) => ({ ...g, ...(health && !held ? { health } : {}), ...(boss && last ? { boss } : held ? { gauntlet: gauntlet === 'holdout' ? { ...DEFAULT_HOLDOUT, arenas: DEFAULT_HOLDOUT.arenas.map((A) => ({ waves: A.waves.map((W) => ({ ...W })) })) } : { arenas: DEFAULT_GAUNTLET.arenas.map((A) => ({ waves: A.waves.map((W) => ({ ...W })) })) } } : escape ? { escape } : {}) }))(goals) : null;
    const lgoal = lg && Object.keys(lg).length ? { goal: lg } : {};
    // (a side camera runs a trail's lane: a side-scroller's levels stay out of doors)
    const inside = (hubbed ? !!vault && dungeoned && last : !!indoors && i >= indoors.from) && camera !== 'side';
    const nodes = { [`${SUFFIX[i] ?? 'stage'}-a`]: { trail: true }, [`${SUFFIX[i] ?? 'stage'}-b`]: { trail: true }, ...(climb ? { lookout: { meru: true } } : {}) };
    // (a genre's book form, genre-forms.js: its levels laid in it, a flight sim's courses; no town, no walk goal)
    const L = hubbed && i === 0 ? { name: `${cap(placeWord)} town`, walk: { nodes: { square: { trail: true } } }, places: { town: true, street: turnBased ? { houses: 7, enter: ['shop', 'inn', 'temple'], walk: ['shop'], walls: true, inside: true } : { houses: 6, enter: 2, walk: ['shop'], walls: true, inside: true } } }
      : form ? (({ street, ...rest }) => ({ name: `${form.name} ${i + 1}`, ...rest, ...(street ? { street: heroWords.length ? { ...street, tuning: 'heroes' } : street } : {}) }))(form.level(i, n))
      : inside && hubbed ? { name: citadelClimax && roundMandala ? 'The citadel' : `The ${dungeonUse}`, building: { use: dungeonUse, kit: dungeonUse === vault.use ? vault.kit : ROOM_KIT_OF_USE[dungeonUse] ?? 'gothic-stone' }, ...lgoal }
      : hubbed && i === castleAt ? { name: 'The castle', walk: { nodes }, ...lgoal, places: { castle: civIds[1] ? { civilization: civIds[1] } : true } }
      // (a mandala round's wilds, its second ring: the world map's blocks walked out from the town, world-map.js
      // wildsLevel, each block's pack its battles'; the core is laid as it was)
      : roundMandala && !last ? { name: `${cap(placeWord)} ${SUFFIX[i] ?? `stage ${i + 1}`}`, ...wildsLevel({ landscape, at: wildsK++ }), ...lgoal }
      : inside ? { name: `${cap(indoors.use)} ${SUFFIX[i] ?? `stage ${i + 1}`}`, building: { use: indoors.use, kit: indoors.kit }, ...lgoal }
      : { name: `${cap(placeWord)} ${SUFFIX[i] ?? `stage ${i + 1}`}`, walk: { nodes }, ...lgoal };
    if (i > 0 && !inside && !form && !hubbed) L.places = { town: true, ...(last || n === 1 ? { castle: civIds[1] ? { civilization: civIds[1] } : true } : {}) };
    // (round a hub, the wilds: no town of their own, the last raising its castle)
    if (i > 0 && hubbed && last && !castled && !dungeoned) L.places = { castle: civIds[1] ? { civilization: civIds[1] } : true };
    // the agent checks its own work: a level whose town's laws advise is laid again on the next seed
    let s = seed * 100 + i * 7 + 1, tries = 0, laws = [];
    for (; tries < 6; tries++, s++) {
      world.levels[lid] = { ...L, seed: s };
      const R = resolveLevel(readGameworld(world), lid);
      laws = R.town ? designTown(structureStyle(R.style.kit, s), s, R.town).laws.filter((l) => !l.ok).map((l) => l.law) : [];
      if (!laws.length) break;
    }
    decided.push({ level: lid, seed: s, tries: tries + 1, laws });
    if (i > 0) world.links.push({ from: hubbed ? hubId : `${wid}-${i}`.slice(0, 48), to: lid, kind: last && N > 2 ? 'gate' : 'road' });
  }
  if (hubbed) Object.assign(world, { topology: 'interconnected', hub: hubId, start: hubId });
  // (a party RPG's levels carry the game's UI on mana-ui, its folk speaking in the talk box, in the console RPG's plain
  // blue windows and their own colours, the classic-rpg card: none of a party game's layers, interface-look.js)
  if (turnBased && world.ui === undefined) world.ui = { theme: 'classic-rpg', colour: 'theme' };
  // (and fights turn by turn, one at a time: each member picks when its turn comes and acts at once, the foes between
  // them, never the whole party choosing and then the round played: playscape/rpg/kernel.js, rules.turns 'timeline')
  // (a foe's HP shown as the same bar over its head as a member's: rules.foeHp 'bar')
  // (and opens a fight now and then with the party striking first, or ambushed: never its boss's, play.rpg rules.openings)
  if (turnBased && world.battles?.rules?.turns === undefined) world.battles = { ...(world.battles ?? {}), rules: { turns: 'timeline', foeHp: 'bar', openings: true, ...(world.battles?.rules ?? {}) } };
  // (and is reskinned in its era, round-eras.js: its foes' names and looks, its items' and gear's names, the presets'
  // numbers kept; the looks its words named keep theirs)
  if (eraRow && world.battles) {
    const E = eraBattles(eraRow), B0 = world.battles;
    world.battles = { ...B0, looks: { ...E.looks, ...(B0.looks ?? {}) }, foes: { ...E.foes, ...(B0.foes ?? {}) }, items: B0.items ?? E.items, gear: B0.gear ?? E.gear };
  }
  // (and keeps treasure off the path: two chests a fighting stage, opened once, gameworld/chests.js)
  if (turnBased && world.battles && world.battles.chests === undefined) world.battles = { ...world.battles, chests: { ...ROUND_CHESTS } };
  // (and its party makes joint techs together where its members know their parts: play.rpg techs)
  if (turnBased && world.battles && world.battles.techs === undefined) world.battles = { ...world.battles, techs: true };
  if (hubbed) world.brief.hub = hubId;
  // (round a hub: its castle's level, its dungeon, the trades on its town's street, said as the world was laid)
  if (hubbed && (castled || dungeoned || turnBased)) world.brief.round = { ...(castled ? { castle: `${wid}-${castleAt + 1}`.slice(0, 48) } : {}), ...(dungeoned ? { dungeon: `${wid}-${N}`.slice(0, 48) } : {}), ...(turnBased ? { trades: ['inn', 'temple'] } : {}) };
  if (eraRow) world.brief.round = { ...world.brief.round, era: { era: ERA_OF_KIT[style.kit], says: eraRow.says } };
  // THE ROUND AS A MANDALA (megaworld.js): a turn-based round is not a star of roads but rings travelled inward. The town
  // the first ring, where it sets out; the wilds and the castle the second, each a road from the town; the last level the
  // core (the dungeon, else the castle, else the farthest wilds), its way in gated by a key found on the way: in the
  // castle when the castle is not the core, else in the farthest wilds. The megaworld lays the links (stampMegaworld), so
  // the shell's travel screen draws the rings, a fight won stays won on return, and the core's first win ends the game.
  // The town stays the hub: its keepers keep the world's shops (battles.js hubFolkShops). Two levels are a town and its
  // wilds, no ring between them and a core: they stay a hub
  if (roundMandala) {
    const lids = Object.keys(world.levels), core = lids[lids.length - 1], castleId = world.brief.round.castle;
    const wilds = lids.slice(1, -1).filter((l) => l !== castleId), mid = castleId && castleId !== core ? castleId : null;
    // (the farthest wilds first in their ring: the way to the core runs from the zone first in it)
    const ring = [...[...wilds].reverse(), ...(mid ? [mid] : [])];
    const gate = { key: ROUND_MANDALA.key(dungeoned ? dungeonUse : 'castle'), keyAt: mid ?? wilds[wilds.length - 1] };
    // (its save points: the town, and each stretch of the wilds where the party comes in; never the castle or the core)
    // THE ROUND IN ITS LABOUR'S SHAPE (megaworld.js, gmn.js WORLD_SHAPES): a MANDALA's rings inward to the core; a CHAIN
    // map after map, the wilds in order, the castle last before the core, the core the far end; a HUB the town joined to
    // every zone, the core among them; an OPEN world one ring, each zone joined to its neighbours. In each the core is
    // gated by its key, found in the zone the round reaches before it, and the core's first win ends the game
    const rings = roundShape === 'chain' ? [[hubId], ...[...wilds, ...(mid ? [mid] : [])].map((z) => [z]), [core]]
      : roundShape === 'hub' ? [[hubId], [...wilds, ...(mid ? [mid] : []), core]]
      : roundShape === 'open' ? [[hubId, ...wilds, ...(mid ? [mid] : []), core]]
      : [[hubId], ring, [core]];
    world.megaworld = { shape: roundShape, rings, gates: { [core]: gate }, saves: [hubId, ...wilds], ...(roundShape === 'hub' || roundShape === 'open' ? { end: core } : {}) };
    Object.assign(world, stampMegaworld(world), { hub: hubId });
    world.brief.round = { ...world.brief.round, [roundShape === 'mandala' ? 'mandala' : 'way']: { core, ...gate }, talk: { who: ROUND_TALK.who, pages: 2, on: gate.key } };
    // THE ROUND'S BOSS: a turn-based world's boss is a party battle (battles.js `boss`, the last pack, no escape from it),
    // never the real-time goal's: the one its story calls for (round-bosses.js: the citadel's drake, the far shore's
    // leviathan, the final hall's champion…), in its era, written out whole (its numbers, its telegraphed blow, its
    // second form, its look, its height, its fight's lines) for the person to change; the core's goal keeps what else
    // it holds
    const C = world.levels[core];
    // (a citadel's core keeps its boss whether or not the words named one; a story the words named, its climax's)
    if (C.goal?.boss || (citadelClimax && dungeoned) || namedLabour) {
      const { boss: _b, ...rest } = C.goal ?? {};
      if (Object.keys(rest).length) C.goal = rest; else if (C.goal) delete C.goal;
      const id = bossOfLabour(roundResolved?.labour), RB = roundBossBattles(id, { era: eraRow, place: low(C.name ?? core) }), B0 = world.battles ?? {};
      world.battles = { ...B0, boss: RB.boss, bossPages: RB.bossPages, foes: { ...(B0.foes ?? {}), ...RB.foes }, looks: { ...(B0.looks ?? {}), ...RB.looks }, heights: { ...(B0.heights ?? {}), ...RB.heights } };
      world.brief.round = { ...world.brief.round, boss: { pack: [...RB.boss], at: core, for: roundResolved?.labour ?? null } };
    }
    // THE CITADEL (a labour whose climax is one: storm the citadel): the core a WALLED CORE (wcd/wcd.js) over its level,
    // layer on layer on its critical path: its guardhouse (an outer, crossed), its vault (the dungeon the words named,
    // else a crypt), and its sanctum at the heart (the citadel's own rooms), the boss there; each layer fought through
    // (battles.js lays the packs in the rooms on the way, the boss in the last). Its doors' gates are the design's words:
    // the way in is the mandala's key
    if (citadelClimax && dungeoned) {
      const sp = (kind, depth, use) => ({ kind, depth, level: core, use });
      world.wcd = { core: 'sanctum', spaces: { gate: sp('outer', 0, CIT.gate), vault: sp('inner', 1, dungeonUse), sanctum: sp('inner', 2, CIT.core) },
        doors: [{ from: 'gate', to: 'vault', via: 'door', gate: { clearance: 1 } }, { from: 'vault', to: 'sanctum', via: 'stair', gate: { clearance: 2 } }] };
      world.brief.round = { ...world.brief.round, citadel: { at: core, path: ['gate', 'vault', 'sanctum'], uses: [CIT.gate, dungeonUse, CIT.core] } };
    }
    // THE ROUND'S QUEST (a gameworld's quests, playscape/ui/quests.js: the journal, J): named for what the round is about
    // (its brief's motivation), its steps the round's own way to its end: find the core's key where it is kept, go in,
    // and, where the core keeps a boss, bring it down. Each step's flag raised by what happens (story.js quest steps' `on`:
    // the key picked up where it is kept, the core begun) or by the boss's fall (battles.sets)
    if (roundResolved?.motivation) {
      const Q = roundQuest({ motivation: roundResolved.motivation, gate, core, name: (id) => low(world.levels[id]?.name ?? id), boss: !!world.battles?.boss });
      world.quests = [...(world.quests ?? []), Q.quest];
      if (Q.sets) world.battles = { ...world.battles, sets: Q.sets };
      world.brief.round = { ...world.brief.round, quest: { id: Q.quest.id, steps: Q.quest.steps.map((s) => s.done) } };
    }
    // THE ROUND'S STORY (round-story.js): its opening in the town, a line as the core begins, its ending in the core,
    // from what the round is about; written out in the world's story to change
    if (roundResolved?.motivation && !world.story) {
      world.story = roundStory({ motivation: roundResolved.motivation, hub: hubId, core, coreName: low(world.levels[core]?.name ?? core) });
      world.brief.round = { ...world.brief.round, story: world.story.map((m) => m.id) };
    }
  }
  // (the round's brief stamped: its reading and its orders, gmn.js; the words that named it read)
  if (roundBrief) {
    world.gameBrief = stampGameBrief({ gameBrief: { gmn: roundBrief.gmn } }).gameBrief;
    for (const r of roundBrief.read) {
      const had = world.brief.read.find((x) => x.word === r.word);
      if (had) had.decides = [...new Set([...had.decides, ...r.decides])]; else world.brief.read.push({ word: r.word, decides: [...r.decides] });
    }
    world.brief.unread = world.brief.unread.filter((w) => !roundBrief.read.some((r) => r.word === w));
    const laid = roundMandala ? roundShape : 'hub';
    world.brief.round = { ...(world.brief.round ?? {}), brief: { motivation: roundResolved.motivation, labour: roundResolved.labour, shape: laid, ...(askedShape && askedShape !== laid && roundMandala ? { asked: askedShape, why: ROUND_NOT_YET(askedShape) } : {}) } };
  }
  world.brief.levels = decided;
  // what the levels are played for, and which are buildings: said only when a word decided it
  // (a genre's form: what its levels were laid as, said in the brief)
  if (form) world.brief.levelForm = { genre: genre.id, form: form.form };
  if (goals && !form && !mapped) world.brief.goal = { ...goals, ...(goals.boss ? { boss: `${wid}-${N}`.slice(0, 48) } : {}) };
  // what the composer filled of the genre's form: said only when it filled something
  if (Object.keys(fills).length) world.brief.form = fills;
  if (indoors && !form) {
    world.brief.indoors = hubbed ? { use: dungeonUse, kit: world.levels[`${wid}-${N}`.slice(0, 48)].building?.kit ?? indoors.kit, levels: dungeoned ? [`${wid}-${N}`.slice(0, 48)] : [] } : { use: indoors.use, kit: indoors.kit, levels: Object.keys(world.levels).slice(indoors.from) };
    // the word that named the use is read (as a cube's word is): it decides the building's use
    if (indoors.useWord) {
      const r = world.brief.read.find((x) => x.word === indoors.useWord);
      if (r) r.decides = [...r.decides, 'building.use']; else world.brief.read.push({ word: indoors.useWord, decides: ['building.use'] });
      world.brief.unread = world.brief.unread.filter((x) => x !== indoors.useWord);
    }
  }
  // the cube: the one the words name, else the kit's nearest, drawn on the kit's own card so its flora stay; the
  // color theorist decides its colours when it is stored (color-theorist/stamp.js)
  const cubeWord = P.words.find((w) => CUBE_WORDS[w] ?? CUBE_WORDS[w.replace(/s$/, '')]);
  // (a party RPG round its town, no word naming a cube, on the meadow's kit: the green valley's limestone, red roofs and
  // meadow, ROUND_CUBE, not the kit's nearest, an island's stucco under a hard sun)
  const roundCube = !cubeWord && turnBased && style.kit === 'isekai-meadow';
  const cubeId = roundCube ? ROUND_CUBE : cubeOfWords(P, style.kit);
  if (cubeId) {
    style.geocube = GEOCUBE_PRESETS[cubeId].outside.base === style.kit ? cubeId : { from: cubeId, outside: { base: style.kit } };
    world.brief.cube = { id: cubeId, ...(cubeWord ? { word: cubeWord } : roundCube ? { from: 'a party RPG round its town' } : { from: `the kit, ${style.kit}` }) };
    // every word that names a cube is read: the first decides it, one naming the same cube agrees, another gives way
    const cubeOf = (w) => CUBE_WORDS[w] ?? CUBE_WORDS[w.replace(/s$/, '')];
    for (const w of [...new Set(P.words.filter(cubeOf))]) {
      const says = cubeOf(w) === cubeId ? 'geocube' : `geocube (gave way to ${cubeWord})`, r = world.brief.read.find((x) => x.word === w);
      if (r) r.decides = [...r.decides, says]; else world.brief.read.push({ word: w, decides: [says] });
      world.brief.unread = world.brief.unread.filter((x) => x !== w);
    }
  } else world.brief.cube = { id: null, why: `no cube has ${style.kit}'s air` };
  // domain expansion: a cube that names the levels it makes lends them to the walks, the ones the words name first (in
  // the order they are said), then the rest in the cube's order, round again when the walks outnumber them
  if (style.geocube !== undefined) {
    const C = readGeocube(style.geocube), outside = C.domains ? geocubeDomains(C).filter((d) => d.side === 'outside') : [];
    const named = (d) => P.words.findIndex((w) => w.length >= 4 && !STOP.has(w) && (d.name.split('-').includes(w) || d.reads.toLowerCase().split(/[^a-z]+/).includes(w)));
    const order = [...outside.filter((d) => named(d) >= 0).sort((a, b) => named(a) - named(b)), ...outside.filter((d) => named(d) < 0)];
    const walks = Object.keys(world.levels).filter((lid) => world.levels[lid].walk);
    if (order.length && walks.length) {
      world.brief.domains = walks.map((lid, k) => {
        const d = order[k % order.length], i = named(d);
        world.levels[lid].style = { ...(world.levels[lid].style ?? {}), domain: d.name };
        return { level: lid, domain: d.name, ...(i >= 0 ? { word: P.words[i] } : {}) };
      });
      for (const w of new Set(world.brief.domains.filter((x) => x.word).map((x) => x.word))) {
        const r = world.brief.read.find((x) => x.word === w);
        if (r) r.decides = [...r.decides, 'domain']; else world.brief.read.push({ word: w, decides: ['domain'] });
        world.brief.unread = world.brief.unread.filter((x) => x !== w);
      }
    }
  }
  // the hour: the first word naming one lights the cube's outside at it, unless the cube is lit at it already
  // (a sky glyph's hour, glyph-words.js, where no hour word names one)
  const hourOf = (w) => HOUR_OF_WORDS[w] ?? HOUR_OF_WORDS[w.replace(/s$/, '')] ?? (w === glyphHour ? readingOf(w).hour : undefined);
  const hourWord = style.geocube !== undefined ? P.words.find(hourOf) : undefined;
  if (hourWord) {
    const hour = hourOf(hourWord), cube = readGeocube(style.geocube);
    if (readHour(hour) !== referenceHour(SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)])) {
      style.hour = hour;
      for (const w of [...new Set(P.words.filter(hourOf))]) {
        const says = w === hourWord || hourOf(w) === hour ? 'hour' : `hour (gave way to ${hourWord})`, r = world.brief.read.find((x) => x.word === w);
        if (r) r.decides = [...r.decides, says]; else world.brief.read.push({ word: w, decides: [says] });
        world.brief.unread = world.brief.unread.filter((x) => x !== w);
      }
    }
  }
  // the land the words name, laid on the cube so every level it paints takes it (era/geocube.js): open, no far cliff on
  // its trails, unless a word names a cliff, a face or beds (or a tunnel read the word as something else: field cannon);
  // wildflowers in its grass; its snow. A world with no cube (an airless plain) takes none of them
  // (and a fall keeps the cliff it falls from: a field with a waterfall)
  const cliffWord = P.read.find((r) => r.decides.some((d) => d === 'land.face' || d === 'land.strata'))?.word ?? fallsWords(P)[0];
  // (a word naming the thing after it is not the land: in "field cannon" the next word is a machine a tunnel reads)
  const after = openWord === null ? null : P.words[P.words.indexOf(openWord) + 1];
  const thing = after !== undefined && after !== null && [techDomain(), ...Object.values(CRAFTED).map((k) => craftDomain(k))].some((d) => readIntent(d, after).traits.length > 0);
  const open = openWord !== null && !cliffWord && !thing;
  const wet = Object.keys(water).length ? water : null;
  // (the colour DIRECTION its genre is laid in (world-palette.js GENRE_COLOUR: a choice made at the eyes gate, a row): the
  // axes it moves on the cube's own palette, written as the cube's palette words under any the sentence's own name)
  const direction = genre && cubeId ? genrePaletteWords(genre.id, GEOCUBE_PALETTES[cubeId] ?? {}, style.kit) : null;
  if (direction) { palette = { ...direction.words, ...(palette ?? {}) }; world.brief.colour = { direction: direction.direction }; }
  if (style.geocube !== undefined && (open || flowers !== null || snowy || wet || dunes !== null || biome || biocube || palette)) style.geocube = cubeWithLand(style.geocube, { open, flowers, snow: snowy, water: wet, dunes, biome, biocube, palette });
  if (openWord !== null && !open) for (const r of world.brief.read) r.decides = r.decides.map((d) => (d === 'outside.cliff' ? `outside.cliff (gave way to ${cliffWord ?? 'a thing'})` : d));
  // WHAT GROWS ON A WORLD MAP: a cube's land is polygons, and grass stands on it only where a biocube brings it back
  // (era/isekai.js), so a map painted in a cube that names no flora was bare ground from edge to edge. A meadow kit's map
  // takes the meadow's own (the kit's card flora, era/biocube.js: its groves, its tufts and the live field), unless the
  // cube or a word of the sentence names what grows (a desert, an alpine, a coast keep theirs)
  if (world.brief.worldMap && style.kit === MAP_FLORA.kit && style.geocube !== undefined && !readGeocube(style.geocube).biocube) {
    style.geocube = cubeWithLand(style.geocube, { biocube: MAP_FLORA.biocube });
    world.brief.worldMap.grows = `the ${MAP_FLORA.biocube}'s flora (its cube names none): grass on the land, groves beside the ways`;
  }
  // HOW ITS LAND IS DRAWN (a genre hero row's `land`, hero-rows.js): rocks and cliff lips kept bare (`hats: false`, a
  // glyph map's word carried to each tile's stage), and the kit's card's own sky and air over the cube's (`sky: 'card'`:
  // the card's dome ends and its haze colour written as the cube's `light.sky`, its haze density as the cube's share of
  // its reference's, `light.outsideFog`). A world whose row says neither, or with no map or no cube, is as it was
  const land = genre ? GENRE_HERO[genre.id]?.land : null;
  if (land?.hats === false && world.brief.worldMap) world.levels[world.brief.worldMap.level].glyphs.hats = false;
  if (land?.sky === 'card' && style.geocube !== undefined) {
    const card = ISEKAI_STYLES[style.kit], dome = SWATCHES[style.kit]?.land?.sky, fog = card?.air?.fog;
    const cube = typeof style.geocube === 'string' ? { from: style.geocube } : { ...style.geocube };
    const ref = SIXTH_GEN_REFERENCES[resolveLook(readGeocube(style.geocube).light.reference)];
    if (Array.isArray(dome) && fog && ref?.air?.fog?.density > 0 && cube.light?.sky === undefined) {
      const share = Math.min(4, Math.max(0.01, +(fog.density / ref.air.fog.density).toFixed(4)));
      cube.light = { ...(cube.light ?? {}), outsideFog: share, sky: { zenith: rgbToHex(dome[0]).toLowerCase(), horizon: rgbToHex(dome[dome.length - 1]).toLowerCase(), fog: fog.color } };
      style.geocube = cube;
    }
  }
  // THE ROUND'S PLACES ON ITS CUBE (a party RPG round its town): the cube gritty, so its town is drawn from relief (its
  // render worn to its stone, its roofs in lapped courses, its lane in setts: era/town-dress.js), and each place its own
  // flora on the one style (ROUND_PLACES): the town the cube's own, the wilds in groves with a lake beside the first, the
  // castle on the windswept upland. Unless a word named what grows (a biome, a biocube): then every place grows it
  if (hubbed && turnBased && style.geocube !== undefined) {
    const base = typeof style.geocube === 'string' ? { from: style.geocube } : { ...style.geocube };
    if (base.grit === undefined) { base.grit = ROUND_PLACES.grit; style.geocube = base; }
    const said = !!(biome || biocube), places = {};
    if (!said) {
      const wilds = Object.keys(world.levels).filter((lid, i) => i > 0 && (world.levels[lid].walk || world.levels[lid].glyphs) && lid !== world.brief.round?.castle);
      wilds.forEach((lid, k) => {
        world.levels[lid].style = { ...(world.levels[lid].style ?? {}), geocube: cubeWithLand(base, { biocube: ROUND_PLACES.wilds, ...(k === 0 ? { water: ROUND_PLACES.water } : {}) }) };
        places[lid] = `${ROUND_PLACES.wilds}${k === 0 ? ', a lake beside the way' : ''}`;
      });
      const castle = world.brief.round?.castle;
      if (castle) { world.levels[castle].style = { ...(world.levels[castle].style ?? {}), geocube: cubeWithLand(base, { biocube: ROUND_PLACES.castle }) }; places[castle] = ROUND_PLACES.castle; }
    }
    // (the wilds laid as the world map's blocks, world-map.js wildsLevel, QUIET: the grit is the town's stone, worn and
    // lapped; on open ground it paints every tile from relief, a block's page some four times its quiet weight)
    const quiet = Object.keys(world.levels).filter((lid) => world.levels[lid].glyphs);
    for (const lid of quiet) world.levels[lid].style = { ...(world.levels[lid].style ?? {}), geocube: { ...(world.levels[lid].style?.geocube ?? base), grit: ROUND_PLACES.quiet } };
    world.brief.round = { ...(world.brief.round ?? {}), grit: base.grit, ...(quiet.length ? { quiet } : {}), ...(Object.keys(places).length ? { places } : {}) };
  }
  // the games inside the game the words ask for (minigames.js): read, laid once the world has its people
  for (const w of minigamesOfWords(prompt)?.words ?? []) {
    const r = world.brief.read.find((x) => x.word === w);
    if (r) r.decides = [...r.decides, 'minigames']; else world.brief.read.push({ word: w, decides: ['minigames'] });
    world.brief.unread = world.brief.unread.filter((x) => x !== w);
  }
  readGameworld(world);
  // the hero the frame makes by default, drawn in the world's own tradition (its kit's pole: cast-setting.js), said in
  // the brief beside the words that asked for it
  if (frame) {
    const tradition = settingOfGame(readGameworld(world)).tradition ?? 'anime';
    // (a hub's town is lived in: its folk (folk-cast.js), each to talk to, its shopkeeper the merchant and a keeper
    // the inn where the world's battles have them)
    world.characters = { ...frame.characters, direction: { ...frame.characters.direction, tradition }, ...(world.hub ? { folk: roundTalk(world) ?? true } : {}) };
    if (frame.moves) world.moves = true;
    // (and DESIGNED, where nothing else designs it (hero-design.js: a game that reads no body rail): rolled as a person of
    // this world, its protagonist, its sheet's plan laid as the looks pages in the pages' own words, its garment the
    // world's accent; each page is the creator's to rewrite)
    const design = heroDesign(readGameworld(world));
    if (design) { world.characters.hero = { ...world.characters.hero, looks: design.looks }; readGameworld(world); }
    world.brief.hero = { genre: genre.id, vibe: frame.characters.hero.motion.vibe, powers: 'none', camera: camera ?? 'third-person', tradition,
      ...(design ? { design: { roll: design.sheet, ...(design.garment ? { garment: design.garment } : {}), pieces: design.pieces.map((p) => p.kind), read: design.read } } : {}) };
  }
  // HOW IT STARTS (`flow: 'play'`, game/flow.js startInPlay): its opening is a CUTSCENE, the slot the game's opening
  // sequence is handed to (the story's opening moment where it has one; empty until then, and passed at once), and from
  // it straight into play; the title only where quitting goes back to. The flow page is the game director's to rewrite.
  world.flow = FLOW_IN_PLAY;
  // HOW IT SOUNDS (gameworld/sound-sheet.js, cue-sheet.js): a world map's game is heard. It is put on the SOUND SHEET
  // (an empty `sound`: every sound solved from what the game already is, its arsenal's swings and blows, its foes'
  // voices, its ground underfoot, a bed a place) and given a SCORE (an empty `music`: the audio direction solved from
  // its words, every level scored from the cue sheet). Play's sounds only: the interface keeps its own (mana-ui's set,
  // which the direction names and never replaces). Both are the creator's to rewrite, word by word
  // HOW IT FIGHTS (gameworld/arsenal.js): a world map's game whose feel has a kit plays it (`arsenal: 'auto'`): its
  // weapons, their strings and specials, and its sidearm (the action-adventure's sword, its three cuts and its spin,
  // and the bow); a feel with no kit, the hero's one blow as before
  if (world.brief.worldMap && world.feel !== undefined && world.arsenal === undefined && arsenalFor(world.feel)) world.arsenal = 'auto';
  // ITS GENRE'S OWN (hero-rows.js): the juice's dials its row turns (a hero whose blows leave no trail), and a game
  // that fills its window (`screen: 'fill'`: no frame written, so no bars on a window of another shape)
  const row = genre ? GENRE_HERO[genre.id] : null;
  if (row?.juice && world.juice === 'auto') world.juice = { ...row.juice };
  // (written as null, the world's word for no frame: an absent `screen` is one design_game makes for a phone)
  if (row?.screen === 'fill') world.screen = null;
  // HOW ITS SCREENS LOOK (playscape/ui/interface-look.js): a world map's game has an interface (an empty `ui`: its look
  // the world's, by its intent, its colours the world's palette), so the play shell's screens are mana-ui's in that look
  // (game/play-shell-mana.js) as its HUD is; a game with no map keeps the shell's own screens
  if (world.brief.worldMap && world.ui === undefined) world.ui = {};
  // (a party RPG round its town too: its levels sounded and scored, so its scenes and cues may play a sound by its word)
  if (world.brief.worldMap || (world.brief.round && world.megaworld && world.sound === undefined)) { world.sound = {}; world.music = {}; world.brief.audio = 'on the sound sheet and scored from the cue sheet: its sounds and its music solved from the game, the interface\'s sounds its own'; }
  world.brief.start = 'its opening cutscene (a slot, empty until it is given a video or a scene), then straight into play';
  readGameworld(world);
  return world;
}
