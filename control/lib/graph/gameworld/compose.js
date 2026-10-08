/**
 * AUTONOMOUS MODE — a whole gameworld decided from a few prompts. The words a creator gives are READ against a
 * lexicon of what they say about the ground (a kit, a building language, a fortification, the land's forms and how
 * much of each, the ground's character); what no word decides, the seed does, inside the same rails a creator would
 * choose from. Then the agent checks its own work: a level whose town's laws advise is laid again on the next seed,
 * up to a few times, before it is handed over. The world comes back in autonomous mode, every part stamped by its
 * machine gate (review.js), the prompt and every decision kept in its `brief`, ready for the creator to approve or
 * send back.
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

/**
 * What a word says about the ground. Each reading sets parts of a world's style or its civilizations: `kit`,
 * `anchor` and `fort` (the first civilization's, or a second one's when a second language is named), `land.<form>`
 * (a variant, a step), `trail.<dial>`, `meru` (a preset), `levels` (more or fewer).
 */
export const LEXICON = Object.freeze({
  // the kit: the look the whole ground is drawn in
  meadow: { kit: 'isekai-meadow' }, pastoral: { kit: 'isekai-meadow' }, green: { kit: 'isekai-meadow' }, valley: { kit: 'isekai-meadow', 'land.landscape': ['downs', 0.5] },
  bamboo: { kit: 'isekai-bamboo' }, forest: { kit: 'isekai-bamboo' },
  blossom: { kit: 'isekai-sakura' }, sakura: { kit: 'isekai-sakura' }, spring: { kit: 'isekai-sakura' },
  night: { kit: 'alien-night', 'land.cloud': [null, 0] }, alien: { kit: 'alien-night' }, moon: { kit: 'alien-night' }, glowing: { kit: 'alien-night' },
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
  canyon: { 'land.strata': ['tilted', 0.5], 'land.landmark': ['butte', 0.5], 'land.face': ['slabby', 0.5] }, desert: { 'land.landmark': ['butte', 0.5], 'land.cloud': ['cirrus', 0.25], 'land.rock': ['hoodoo', 0.5] },
  coast: { 'land.rock': ['stack', 0.5], 'land.landmark': ['arch', 0.25] }, shore: { 'land.rock': ['stack', 0.25] }, sea: { 'land.rock': ['stack', 0.5] },
  // landmarks
  arch: { 'land.landmark': ['arch', 0.25] }, arches: { 'land.landmark': ['arch', 0.75] }, spire: { 'land.landmark': ['spire', 0.25] }, spires: { 'land.landmark': ['spire', 0.75] },
  monolith: { 'land.landmark': ['monolith', 0] }, waterfall: { 'land.landmark': ['falls', 0] }, falls: { 'land.landmark': ['falls', 0] }, mesa: { 'land.landmark': ['butte', 0.25] },
  // the sky
  clear: { 'land.cloud': [null, 0] }, fair: { 'land.cloud': ['cumulus', 0.25] }, cloudy: { 'land.cloud': ['cumulus', 0.75] }, overcast: { 'land.cloud': ['stratus', 1] },
  misty: { 'land.cloud': ['stratus', 0.75] }, foggy: { 'land.cloud': ['stratus', 1] }, stormy: { 'land.cloud': ['towering', 0.75] }, windy: { 'land.cloud': ['cirrus', 0.5] }, lenticular: { 'land.cloud': ['lenticular', 0.25] },
  // how big
  small: { levels: 2 }, short: { levels: 2 }, epic: { levels: 5 }, vast: { levels: 5 }, long: { levels: 4 },
});

const SUFFIX = ['approach', 'crossing', 'heights', 'hold', 'reach', 'end'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'world';
const pick = (rand, a) => a[Math.floor(rand() * a.length)];

/** Read a prompt's words: what each decides, and what nothing read. */
export function readPrompt(prompt) {
  const words = String(prompt ?? '').toLowerCase().split(/[^a-z-]+/).filter(Boolean), read = [], unread = [];
  for (const w of words) { const r = LEXICON[w] ?? LEXICON[w.replace(/s$/, '')]; if (r) read.push({ word: w, decides: Object.keys(r) }); else if (w.length > 3) unread.push(w); }
  return { words, read, unread: [...new Set(unread)] };
}

/** A whole gameworld from a few prompts, decided by the agent, checked by its machine gate. */
export function composeGameworld({ prompt, name, id, levels, seed = 1 } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('gameworld: compose needs a prompt: a few words about the world');
  const P = readPrompt(prompt), rand = mulberry32((seed * 2654435761) >>> 0 || 1);
  const style = { trail: {}, land: {} }, langs = [];
  let fort = null, meru = null, kit = null, count = null;
  for (const { word } of P.read) {
    const r = LEXICON[word] ?? LEXICON[word.replace(/s$/, '')];
    for (const [k, v] of Object.entries(r)) {
      if (k === 'kit') kit = kit ?? v;
      else if (k === 'anchor') { if (!langs.includes(v)) langs.push(v); }
      else if (k === 'fort') fort ??= v;
      else if (k === 'meru') meru ??= v;
      else if (k === 'levels') count ??= v;
      // the first word to decide a thing decides it (the more particular word comes first: basalt cliffs)
      else if (k.startsWith('trail.')) style.trail[k.slice(6)] ??= v;
      else if (k.startsWith('land.')) { const f = k.slice(5), [variant, many] = v, o = style.land[f] || {}; style.land[f] = { ...(variant && o.variant === undefined ? { variant } : {}), ...(many != null && o.many === undefined ? { many } : {}), ...o }; }
    }
  }
  // what no word decided, the seed does, inside the rails
  style.kit = kit ?? 'isekai-meadow';
  if (!langs.length) langs.push(pick(rand, ['timber-hall', 'tiered', 'shell']));
  for (const f of ['rock', 'landmark']) if (!style.land[f]) style.land[f] = { variant: pick(rand, Object.keys(LAND_FORMS[f].variants).filter((v) => v !== 'falls')), many: pick(rand, [0, 0.25, 0.5]) };
  style.meru = { preset: meru ?? pick(rand, ['mountain-lookout', 'stacked-lookout', 'terraced-mountain']) };
  if (!Object.keys(style.trail).length) delete style.trail;
  const n = Math.max(1, Math.min(6, levels ?? count ?? 3));

  // who builds: a civilization a language named, the first settling every level, a second raising the last castle
  const civilizations = Object.fromEntries(langs.map((a, i) => [`${a}-folk`, { name: `The ${a.replace('-', ' ')} folk`, anchor: a, fort: i === 0 ? (fort ?? 'crenellated') : 'battered' }]));
  const civIds = Object.keys(civilizations);
  style.civilization = civIds[0];

  const title = name ?? cap(P.read[0]?.word ?? 'nameless') + (P.read[1] ? ` ${P.read[1].word}` : '') + ' world', wid = id ?? slug(title);
  const landscape = style.land.landscape?.variant ?? 'meadow';
  const world = { id: wid, name: title, seed, mode: 'autonomous', brief: { prompt, read: P.read, unread: P.unread }, style, civilizations, levels: {}, links: [] };
  const decided = [];
  for (let i = 0; i < n; i++) {
    const lid = `${wid}-${i + 1}`.slice(0, 48), last = i === n - 1, climb = i % 2 === 0;
    const nodes = { [`${SUFFIX[i] ?? 'stage'}-a`]: { trail: true }, [`${SUFFIX[i] ?? 'stage'}-b`]: { trail: true }, ...(climb ? { lookout: { meru: true } } : {}) };
    const L = { name: `${cap(landscape)} ${SUFFIX[i] ?? `stage ${i + 1}`}`, walk: { nodes } };
    if (i > 0) L.places = { town: true, ...(last || n === 1 ? { castle: civIds[1] ? { civilization: civIds[1] } : true } : {}) };
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
  readGameworld(world);
  return world;
}
