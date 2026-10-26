/**
 * SCENE WORDS — a place from words, with nobody in it: the words a scene is asked in, read into the geocube kind's
 * keys (era/geocube.js `show: 'path'`). One table with the game's (compose.js LEXICON, CUBE_WORDS, HOUR_OF_WORDS): what a
 * word decides for a game's cube it decides for a scene's, and a scene reads only REALITY (the look, the land, what
 * grows, the sky, the hour), so a word that asks for a game (a hero, a goal, a level count, a building to enter, a
 * climb) is read and gives way: a scene that asks for one is a game (design_game).
 *
 *   sceneOfWords(words, { seed? }) → { cube, show: 'path', hour?, clouds?, trail?, brief: { read, unread } }
 *     cube    the cube a word names (CUBE_WORDS), else the kit's nearest (KIT_CUBE), drawn on the kit a word names (the
 *             meadow by default); the land laid on it (compose.js cubeWithLand): open (`outside.cliff: false`) unless a
 *             word names a cliff, a face or beds; wildflowers in its grass; its snow
 *     hour    the first hour word (HOUR_OF_WORDS)
 *     clouds, trail   the land forms the words name, lowered as a level's are (nature.js landToLevel): the sky's cover,
 *             the trail's mounds, rocks and landmark; the trail's dials (heartbeat, bumpiness)
 *   SCENE_GIVES_WAY   the decides a scene does not take (a game's), each read as giving way
 *
 * Pure: the same words (and seed) give the same keys.
 */
import { LEXICON, CUBE_WORDS, HOUR_OF_WORDS, KIT_CUBE, readPrompt, cubeWithLand } from './compose.js';
import { landToLevel } from './nature.js';
import { GEOCUBE_PRESETS } from '../era/geocube.js';

// what a word decides that a scene does not take: a game's (who builds, a goal, how many levels, a building to enter,
// a climb, a weather that plays)
export const SCENE_GIVES_WAY = Object.freeze(['anchor', 'fort', 'meru', 'levels', 'building', 'building.kit', 'weather']);
const gives = (d) => SCENE_GIVES_WAY.includes(d) || d.startsWith('goal.');
const lookup = (T, w) => T[w] ?? T[w.replace(/s$/, '')];

export function sceneOfWords(words, { seed = 1 } = {}) {
  if (typeof words !== 'string' || !words.trim()) throw new Error('scene: words are a few words about the place');
  const P = readPrompt(words), land = {}, trail = {};
  let kit = null, openWord = null, flowers = null, snow = false;
  for (const { word } of P.read) for (const [k, v] of Object.entries(lookup(LEXICON, word))) {
    if (k === 'kit') kit ??= v;
    else if (k === 'outside.cliff') openWord ??= word;
    else if (k === 'flora.flowers') flowers ??= v;
    else if (k === 'snow') snow = true;
    else if (k.startsWith('trail.')) trail[k.slice(6)] ??= v;
    else if (k.startsWith('land.')) { const f = k.slice(5), [variant, many] = v, o = land[f] || {}; land[f] = { ...(variant && o.variant === undefined ? { variant } : {}), ...(many != null && o.many === undefined ? { many } : {}), ...o }; }
  }
  kit ??= 'isekai-meadow';
  const cubeWord = P.words.find((w) => lookup(CUBE_WORDS, w)), cubeId = cubeWord ? lookup(CUBE_WORDS, cubeWord) : KIT_CUBE[kit] ?? 'island-noon';
  const base = GEOCUBE_PRESETS[cubeId].outside.base === kit ? cubeId : { from: cubeId, outside: { base: kit } };
  const cliffWord = P.read.find((r) => r.decides.some((d) => d === 'land.face' || d === 'land.strata'))?.word, open = openWord !== null && !cliffWord;
  const cube = open || flowers !== null || snow ? cubeWithLand(base, { open, flowers, snow }) : base;
  const hourWord = P.words.find((w) => lookup(HOUR_OF_WORDS, w)), hour = hourWord ? lookup(HOUR_OF_WORDS, hourWord) : undefined;
  const lowered = landToLevel(kit, land, { seed, painted: true, sections: ['trail'], trail });
  const path = { ...trail, ...(lowered?.trail ?? {}) };
  // what each word decided in the scene: what it gave way to, and the words nothing read
  const read = P.read.map(({ word, decides }) => ({ word, decides: decides.map((d) => (gives(d) ? `${d} (a game's: gave way)` : d === 'outside.cliff' && !open ? `outside.cliff (gave way to ${cliffWord})` : d)) }));
  for (const [w, says] of [[cubeWord, 'geocube'], [hourWord, 'hour']]) if (w && !read.some((r) => r.word === w)) read.push({ word: w, decides: [says] });
  const unread = P.unread.filter((w) => !lookup(CUBE_WORDS, w) && !lookup(HOUR_OF_WORDS, w));
  return { cube, show: 'path', ...(hour !== undefined ? { hour } : {}), ...(lowered?.clouds ? { clouds: lowered.clouds } : {}), ...(Object.keys(path).length ? { trail: path } : {}), brief: { read, unread } };
}
