/**
 * AUTONOMOUS MODE — a whole gameworld decided from a few prompts. The words a creator gives are READ against a
 * lexicon of what they say about the ground (a kit, a building language, a fortification, the land's forms and how
 * much of each, the ground's character); what no word decides, the seed does, inside the same rails a creator would
 * choose from. Then the agent checks its own work: a level whose town's laws advise is laid again on the next seed,
 * up to a few times, before it is handed over. Its levels stand on the geocube the words point at (CUBE_WORDS, else
 * the kit's nearest), drawn on the kit's own card, its colours left to the color theorist where the world is stored.
 * The world comes back in autonomous mode, every part stamped by its
 * machine gate (review.js), the prompt and every decision kept in its `brief`, ready for the creator to approve or
 * send back.
 *
 * Words also say what a level is played for (relics to collect, a boss at the end, health: a level's `goal`, quick.js
 * levelGoalMechanics) and whether it is indoors (a dungeon, a crypt: building levels in a room kit); none, and every
 * level is a walk to its exit, as before.
 *
 *   composeGameworld({ prompt, name?, id?, levels?: 1…6, seed? }) → a gameworld recipe
 *
 * Pure: the same prompt and seed compose the same world.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { LAND_FORMS } from '../era/out-land.js';
import { readGameworld, resolveLevel } from './world.js';
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
import { GEOCUBE_PRESETS } from '../era/geocube.js';

/**
 * What a word says about the ground. Each reading sets parts of a world's style or its civilizations: `kit`,
 * `anchor` and `fort` (the first civilization's, or a second one's when a second language is named), `land.<form>`
 * (a variant, a step), `trail.<dial>`, `meru` (a preset), `levels` (more or fewer).
 */
export const LEXICON = Object.freeze({
  // the kit: the look the whole ground is drawn in
  meadow: { kit: 'isekai-meadow' }, pastoral: { kit: 'isekai-meadow' }, green: { kit: 'isekai-meadow' }, valley: { kit: 'isekai-meadow', 'land.landscape': ['downs', 0.5] },
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
  // rock and cliff
  rocky: { 'land.rock': ['boulders', 0.75] }, boulders: { 'land.rock': ['boulders', 1] }, tor: { 'land.rock': ['tor', 0.5] }, crags: { 'land.face': ['crag', 0.75] },
  cliffs: { 'land.face': ['blocky', 0.5] }, basalt: { 'land.face': ['columnar', 0.75] }, columns: { 'land.face': ['columnar', 0.75] },
  layered: { 'land.strata': ['layered', 0.5] }, sandstone: { 'land.strata': ['layered', 0.75], 'land.landmark': ['butte', 0.25] }, folded: { 'land.strata': ['folded', 0.5] },
  canyon: { 'land.strata': ['tilted', 0.5], 'land.landmark': ['butte', 0.5], 'land.face': ['slabby', 0.5] }, desert: { 'land.landmark': ['butte', 0.5], 'land.cloud': ['cirrus', 0.25], 'land.rock': ['hoodoo', 0.5], weather: 'desert' },
  coast: { 'land.rock': ['stack', 0.5], 'land.landmark': ['arch', 0.25] }, shore: { 'land.rock': ['stack', 0.25] }, sea: { 'land.rock': ['stack', 0.5] },
  // landmarks
  arch: { 'land.landmark': ['arch', 0.25] }, arches: { 'land.landmark': ['arch', 0.75] }, spire: { 'land.landmark': ['spire', 0.25] }, spires: { 'land.landmark': ['spire', 0.75] },
  monolith: { 'land.landmark': ['monolith', 0] }, waterfall: { 'land.landmark': ['falls', 0] }, falls: { 'land.landmark': ['falls', 0] }, mesa: { 'land.landmark': ['butte', 0.25] },
  // the sky
  clear: { 'land.cloud': [null, 0] }, fair: { 'land.cloud': ['cumulus', 0.25] }, cloudy: { 'land.cloud': ['cumulus', 0.75] }, overcast: { 'land.cloud': ['stratus', 1], weather: { overcast: 4, haze: 1, drizzle: 0.5 } },
  misty: { 'land.cloud': ['stratus', 0.75], weather: { mist: 4, fog: 1, overcast: 1, clear: 1 } }, foggy: { 'land.cloud': ['stratus', 1], weather: { fog: 4, mist: 2, overcast: 1 } }, stormy: { 'land.cloud': ['towering', 0.75], weather: 'storm-coast' }, windy: { 'land.cloud': ['cirrus', 0.5] }, lenticular: { 'land.cloud': ['lenticular', 0.25] },
  // what falls
  rainy: { weather: { drizzle: 2, rain: 3, overcast: 2, mist: 1 } }, wet: { weather: { drizzle: 2, rain: 3, overcast: 2, mist: 1 } }, monsoon: { weather: 'monsoon' },
  snowy: { weather: 'alpine' }, snow: { weather: 'alpine' }, alpine: { weather: 'alpine' }, dusty: { weather: 'desert' }, autumn: { weather: 'autumn' },
  // how big
  small: { levels: 2 }, short: { levels: 2 }, epic: { levels: 5 }, vast: { levels: 5 }, long: { levels: 4 },
  // what a level is played for (a level's goal, quick.js levelGoalMechanics): what lies along the way to pick up, a boss
  // at the end, health to lose
  relic: { 'goal.collect': 'relic' }, treasure: { 'goal.collect': 'treasure' }, coin: { 'goal.collect': 'coin' }, gem: { 'goal.collect': 'gem' }, jewel: { 'goal.collect': 'jewel' }, collect: { 'goal.collect': true },
  boss: { 'goal.boss': true }, bosses: { 'goal.boss': true },
  health: { 'goal.health': true }, lives: { 'goal.health': true }, heart: { 'goal.health': true }, hp: { 'goal.health': true },
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
});
// a kit's nearest cube when no word names one; an airless plain has none (every cube has air)
const KIT_CUBE = Object.freeze({ 'isekai-meadow': 'island-noon', 'isekai-sakura': 'island-noon', 'isekai-garden': 'island-noon', 'isekai-bamboo': 'jungle-haze', 'alien-night': 'gothic-night' });

const STOP = new Set(['with', 'from', 'into', 'over', 'under', 'that', 'this', 'their', 'there', 'where', 'some', 'very']);
const SUFFIX = ['approach', 'crossing', 'heights', 'hold', 'reach', 'end'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'world';
const pick = (rand, a) => a[Math.floor(rand() * a.length)];

/** Read a prompt's words: what each decides, and what nothing read. */
export function readPrompt(prompt) {
  const words = String(prompt ?? '').toLowerCase().split(/[^a-z-]+/).filter(Boolean), read = [], unread = [];
  for (const w of words) { const r = LEXICON[w] ?? LEXICON[w.replace(/s$/, '')]; if (r) read.push({ word: w, decides: Object.keys(r) }); else if (w.length > 3 && !STOP.has(w)) unread.push(w); }
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
  const goal = {};
  for (const { word } of P.read) {
    const r = LEXICON[word] ?? LEXICON[word.replace(/s$/, '')];
    for (const [k, v] of Object.entries(r)) {
      if (k === 'kit') kit = kit ?? v;
      else if (k === 'anchor') { if (!langs.includes(v)) langs.push(v); }
      else if (k === 'fort') fort ??= v;
      else if (k === 'meru') meru ??= v;
      else if (k === 'weather') weather ??= typeof v === 'string' ? v : { climate: v };
      else if (k === 'levels') count ??= v;
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
  const world = { id: wid, name: title, seed, mode: 'autonomous', brief: { prompt, read: P.read, unread: P.unread.filter((w) => !tunnelled.has(w)), tunnels }, style, civilizations, levels: {}, links: [] };
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
    const lid = `${wid}-${i + 1}`.slice(0, 48), last = i === n - 1, climb = i % 2 === 0;
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
  readGameworld(world);
  return world;
}
