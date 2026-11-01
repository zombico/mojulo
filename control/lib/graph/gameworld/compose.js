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
import { GEOCUBE_PRESETS, readGeocube, geocubeDomains } from '../era/geocube.js';
import { suggestGenres, cubeOfWorld } from './intent.js';
import { readHour, referenceHour } from '../era/geocube-hours.js';
import { glyphOf } from './glyph-words.js';
import { PALETTE_PRESETS } from '../color-theorist/solve.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from '../era/sixth-gen.js';
import { composerFills } from './resonance.js';

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
  night: { kit: 'alien-night', 'land.cloud': [null, 0] }, alien: { kit: 'alien-night' }, moon: { kit: 'alien-night' }, glowing: { kit: 'alien-night' },
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
 * its water (era/out-water.js).
 */
export const BIOMES = Object.freeze({
  coast: Object.freeze({ biocube: 'coast', palette: 'coastal-noon', water: Object.freeze({ coast: true }) }),
  alpine: Object.freeze({ biocube: 'alpine', palette: 'alpine-dawn' }),
  desert: Object.freeze({ biocube: 'desert', palette: 'desert-haze', skin: 'sandstone' }),
});
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
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
export function technologyOfWords(prompt) {
  const things = {}, crafted = {}, tunnels = {};
  for (const clause of String(prompt).split(/[,;:]|\band\b/i).map((c) => c.trim()).filter(Boolean)) {
    // (a clause about buildings is the building tunnel's; its fittings, a mast or wings, do not make it one)
    if (readIntent(buildingDomain(), clause).traits.some((t) => !['solar', 'mast'].includes(t.id))) continue;
    const fn = readIntent(techDomain(), clause).traits.filter((t) => TECH_TRAITS[t.id].fn);
    if (fn.length) {
      const id = slug(fn.at(-1).word.replace(/s$/, ''));
      if (!things[id]) things[id] = clause.replace(/^(an?|the)\s+/i, '');
      continue;
    }
    // no machine: a clause that names a vehicle, a tech-structure or a weapon ("war galleys", "a stargate") is the crafter's
    const kind = craftKindOf(clause);
    if (!kind) continue;
    const list = Object.keys(CRAFTED).find((k) => CRAFTED[k] === kind), form = readIntent(craftDomain(kind), clause).traits.filter((t) => CRAFT_TRAITS[kind][t.id].form);
    const id = slug(form.at(-1).word.replace(/s$/, ''));
    crafted[list] ??= {};
    if (!crafted[list][id]) crafted[list][id] = clause.replace(/^(an?|the)\s+/i, '');
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
  if (!langs.length) langs.push(pick(rand, ['timber-hall', 'tiered', 'shell']));
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
  // what game it is (intent.js): the genre the words name, written as the feel is, before the levels are laid so they
  // are laid for it. Only a clear read: the first genre ahead of the second, on two of its words at least (one word,
  // "towers" or "map", says too little). Otherwise none, and design_game asks, naming the genres the words point at
  const [lead, next] = suggestGenres(prompt, 2), leadWords = new Set((lead?.matched ?? []).flatMap((w) => w.split(/[^a-z0-9-]+/)));
  const genre = lead && leadWords.size >= 2 && !(next && next.matched.length === lead.matched.length) ? lead : null;
  // the form (resonance.js): what the genre's cube asks of the world that the composer can fill, written before the
  // levels are laid (a co-op platformer's side camera, its walks laid without climbs); the hero it asks is the creator's
  const fills = genre ? composerFills(cubeOfWorld({ intent: { from: genre.id } }).cube) : {};
  const world = { id: wid, name: title, seed, mode: 'autonomous', brief: { prompt, read: P.read, unread: P.unread.filter((w) => !tunnelled.has(w) && !feelWords.has(w) && !(genre && leadWords.has(w))), tunnels }, ...(genre ? { intent: { from: genre.id } } : {}), ...(fills.camera ? { camera: fills.camera } : {}), ...(said ? { feel: said.pole } : {}), juice: 'auto', style, civilizations, levels: {}, links: [] };
  // the words that named the genre are read: they decide the intent
  for (const w of genre?.matched ?? []) {
    const says = `intent.from=${genre.id}`, r = world.brief.read.find((x) => x.word === w);
    if (r) r.decides = [...r.decides, says]; else world.brief.read.push({ word: w, decides: [says] });
  }
  // indoors (a dungeon, a crypt…): the levels are buildings of one use in a room kit; where the prompt also names the
  // ground outside (a kit or a land form), the first level is that ground, the way in, and the later ones the building
  const indoors = room ? (() => {
    const useWord = P.words.find((w) => ROOM_USE_WORDS[w] ?? ROOM_USE_WORDS[w.replace(/s$/, '')]), use = useWord ? ROOM_USE_WORDS[useWord] ?? ROOM_USE_WORDS[useWord.replace(/s$/, '')] : room;
    const outside = P.read.some((r) => r.decides.some((d) => d === 'kit' || d.startsWith('land.')));
    return { use, kit: roomKit ?? ROOM_KIT_OF_USE[use] ?? 'gothic-stone', useWord, from: outside && n > 1 ? 1 : 0 };
  })() : null;
  const goals = Object.keys(goal).length ? goal : null;
  const decided = [];
  for (let i = 0; i < n; i++) {
    const lid = `${wid}-${i + 1}`.slice(0, 48), last = i === n - 1, climb = i % 2 === 0 && fills.climb !== false;
    // the level's goal: what is collected and the health on every level, the boss at the end of the last
    const lg = goals ? (({ boss, ...g }) => ({ ...g, ...(boss && last ? { boss } : {}) }))(goals) : null;
    const lgoal = lg && Object.keys(lg).length ? { goal: lg } : {};
    const inside = indoors && i >= indoors.from;
    const nodes = { [`${SUFFIX[i] ?? 'stage'}-a`]: { trail: true }, [`${SUFFIX[i] ?? 'stage'}-b`]: { trail: true }, ...(climb ? { lookout: { meru: true } } : {}) };
    const L = inside ? { name: `${cap(indoors.use)} ${SUFFIX[i] ?? `stage ${i + 1}`}`, building: { use: indoors.use, kit: indoors.kit }, ...lgoal }
      : { name: `${cap(landscape)} ${SUFFIX[i] ?? `stage ${i + 1}`}`, walk: { nodes }, ...lgoal };
    if (i > 0 && !inside) L.places = { town: true, ...(last || n === 1 ? { castle: civIds[1] ? { civilization: civIds[1] } : true } : {}) };
    // the agent checks its own work: a level whose town's laws advise is laid again on the next seed
    let s = seed * 100 + i * 7 + 1, tries = 0, laws = [];
    for (; tries < 6; tries++, s++) {
      world.levels[lid] = { ...L, seed: s };
      const R = resolveLevel(readGameworld(world), lid);
      laws = R.town ? designTown(structureStyle(R.style.kit, s), s, R.town).laws.filter((l) => !l.ok).map((l) => l.law) : [];
      if (!laws.length) break;
    }
    decided.push({ level: lid, seed: s, tries: tries + 1, laws });
    if (i > 0) world.links.push({ from: `${wid}-${i}`.slice(0, 48), to: lid, kind: last && n > 2 ? 'gate' : 'road' });
  }
  world.brief.levels = decided;
  // what the levels are played for, and which are buildings: said only when a word decided it
  if (goals) world.brief.goal = { ...goals, ...(goals.boss ? { boss: `${wid}-${n}`.slice(0, 48) } : {}) };
  // what the composer filled of the genre's form: said only when it filled something
  if (Object.keys(fills).length) world.brief.form = fills;
  if (indoors) {
    world.brief.indoors = { use: indoors.use, kit: indoors.kit, levels: Object.keys(world.levels).slice(indoors.from) };
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
  const cubeId = cubeWord ? CUBE_WORDS[cubeWord] ?? CUBE_WORDS[cubeWord.replace(/s$/, '')] : KIT_CUBE[style.kit] ?? null;
  if (cubeId) {
    style.geocube = GEOCUBE_PRESETS[cubeId].outside.base === style.kit ? cubeId : { from: cubeId, outside: { base: style.kit } };
    world.brief.cube = { id: cubeId, ...(cubeWord ? { word: cubeWord } : { from: `the kit, ${style.kit}` }) };
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
  if (style.geocube !== undefined && (open || flowers !== null || snowy || wet || dunes !== null || biome || biocube || palette)) style.geocube = cubeWithLand(style.geocube, { open, flowers, snow: snowy, water: wet, dunes, biome, biocube, palette });
  if (openWord !== null && !open) for (const r of world.brief.read) r.decides = r.decides.map((d) => (d === 'outside.cliff' ? `outside.cliff (gave way to ${cliffWord ?? 'a thing'})` : d));
  // the games inside the game the words ask for (minigames.js): read, laid once the world has its people
  for (const w of minigamesOfWords(prompt)?.words ?? []) {
    const r = world.brief.read.find((x) => x.word === w);
    if (r) r.decides = [...r.decides, 'minigames']; else world.brief.read.push({ word: w, decides: ['minigames'] });
    world.brief.unread = world.brief.unread.filter((x) => x !== w);
  }
  readGameworld(world);
  return world;
}
