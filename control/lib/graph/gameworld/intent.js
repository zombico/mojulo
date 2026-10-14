/**
 * THE INTENT — what game a gameworld is, said as a cosmos cube (cosmos/cosmos.js), so the world can be laid for it.
 * The cube is the contract; a genre is only a preset cube to start from (the cosmos probes), never a lock: any value
 * may be changed and a world may mix what two genres ask.
 *
 *   intent: { from?: '<genre id>', cube?: { <facet>: { <setting>: value } }, why?: '<words>' }
 *     from   a genre (GENRES) whose cube the world starts from
 *     cube   the world's own values, laid over it value by value
 *     why    the creator's words for it
 *
 * A world that names no intent still has a cube: the one it implies (its quick goal's genre, its camera, topology,
 * ride, pixel look), read and shown, never written.
 *
 *   GENRES                   { <id>: { name, why, words } } the presets, with the words a brief uses for each
 *   QUICK_GENRE              { <quick goal>: <genre id> } the genre a quick goal is
 *   suggestGenres(text, n?)  → [{ id, name, why, matched }] the presets whose words the text uses, most first: a
 *                            heuristic over words, said to be one, for the agent (the real reader of a brief) to pick
 *                            from or ask about. It suggests a starting cube and refuses nothing.
 *   readIntent(v)            → { from, cube, why } or null; throws, teaching
 *   cubeOfWorld(world)       → { cube, from, said: [<facet.setting>] } the cube the world is: its genre's, then what the
 *                            world's own settings imply, then its intent's own values (`said`: the ones the intent wrote)
 *   intentReport(world)      → { from, written, verdict, concerns: [{ id, name, by, laid, checked }], suggest? } the
 *                            readout's: the world's cube read (cosmos dryRun's verdict), what it asks of the world, and
 *                            for a world that wrote no intent, the genres its brief's words suggest
 */
import { FIXTURES } from '../cosmos/fixtures.js';
import { validateCube, dryRun } from '../cosmos/cosmos.js';
import { concernsOf } from './concerns.js';
import { CRAFT } from '../skyscape/eye.js';

// the words a brief uses for each genre (lower case; a phrase is matched whole)
const WORDS = Object.freeze({
  'dungeon-crawler': ['dungeon', 'crawler', 'crypt', 'catacomb', 'rooms', 'loot'],
  collectathon: ['collect', 'collectathon', 'coins', 'gems', 'platformer', 'jump'],
  'top-down-adventure': ['top-down', 'top down', 'adventure', 'overworld', 'zelda-like', 'explore'],
  shooter: ['shooter', 'shoot', 'gun', 'guns', 'rifle', 'fps', 'first-person shooter', 'firefight', 'cover', 'ammo'],
  jrpg: ['rpg', 'jrpg', 'party', 'turn-based', 'turn based', 'battle', 'battles', 'role-playing'],
  metroidvania: ['metroidvania', 'abilities unlock', 'backtrack', 'map', 'interconnected'],
  'survival-horror': ['horror', 'survival horror', 'scary', 'dread', 'fixed camera', 'mansion'],
  'story-adventure': ['story', 'narrative', 'cutscene', 'cutscenes', 'dialogue', 'characters talk'],
  'arena-brawler': ['brawler', 'arena', 'melee', 'sword fight', 'beat-em-up', 'fight'],
  'pixel-puzzle': ['pixel', 'retro', 'puzzle'],
  stealth: ['stealth', 'sneak', 'guards', 'unseen', 'spotted', 'infiltrate'],
  racing: ['race', 'racing', 'car', 'cars', 'drive', 'driving', 'laps', 'time trial', 'checkpoints'],
  'kart-racer': ['kart', 'karts', 'kart racer', 'go-kart', 'rivals', 'circuit', 'track', 'grand prix', 'podium'],
  'flight-sim': ['fly', 'flying', 'flight', 'flight sim', 'plane', 'airplane', 'aircraft', 'pilot', 'glider', 'runway', 'take off', 'landing', 'ring gates', 'rings in the sky'],
  'space-shooter': ['space', 'spaceship', 'starfighter', 'star fighter', 'space shooter', 'space combat', 'asteroid', 'asteroids', 'trench run', 'trench', 'x-wing', 'battle station', 'exhaust port'],
  'air-combat': ['dogfight', 'dogfights', 'dogfighting', 'air combat', 'ace combat', 'fighter jet', 'jet fighter', 'fighter jets', 'shoot down', 'enemy planes', 'top gun'],
  rhythm: ['rhythm', 'beat', 'music', 'dance', 'tempo'],
  roguelike: ['roguelike', 'roguelite', 'runs', 'permadeath', 'procedural', 'run'],
  farming: ['farm', 'farming', 'crops', 'harvest', 'plant', 'village life', 'life sim', 'seasons'],
  'tower-defense': ['tower defence', 'tower defense', 'towers', 'waves', 'defend', 'base'],
  'block-puzzle': ['boulder', 'boulders', 'push', 'sokoban', 'block puzzle', 'plates'],
});
export const GENRES = Object.freeze(Object.fromEntries(FIXTURES.map((f) => [f.id, Object.freeze({ name: f.name, why: f.why, words: WORDS[f.id] ?? [] })])));
const CUBES = Object.fromEntries(FIXTURES.map((f) => [f.id, f.cube]));
export const QUICK_GENRE = Object.freeze({
  collect: 'collectathon', race: 'racing', sneak: 'stealth', rhythm: 'rhythm', defend: 'tower-defense',
  puzzle: 'block-puzzle', farm: 'farming', battle: 'jrpg', shoot: 'shooter', fly: 'flight-sim',
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (c) => Object.fromEntries(Object.entries(c ?? {}).map(([f, s]) => [f, { ...s }]));
const fail = (m) => new Error(`gameworld: intent${m}`);

export function suggestGenres(text, n = 3) {
  const t = ` ${String(text ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ')} `;
  return Object.entries(GENRES)
    .map(([id, g]) => ({ id, name: g.name, why: g.why, matched: g.words.filter((w) => t.includes(` ${w} `)) }))
    .filter((g) => g.matched.length)
    .sort((a, b) => b.matched.length - a.matched.length || a.id.localeCompare(b.id))
    .slice(0, n);
}

export function readIntent(v) {
  if (v === undefined) return null;
  if (!isObj(v)) throw fail(' is { from?: <genre>, cube?: { <facet>: { <setting>: value } }, why? }');
  for (const k of Object.keys(v)) if (!['from', 'cube', 'why'].includes(k)) throw fail(`.${k} is not part of an intent (from, cube, why)`);
  if (v.from !== undefined && !GENRES[v.from]) throw fail(`.from is a genre: ${Object.keys(GENRES).join(', ')}`);
  if (v.cube !== undefined) {
    if (!isObj(v.cube)) throw fail('.cube is { <facet>: { <setting>: value } } (get_game_vocab({ id: \'gameworld-intent\' }))');
    try { validateCube(v.cube); } catch (e) { throw fail(`.cube: ${e.message.replace(/^cosmos: /, '')}`); }
  }
  if (v.why !== undefined && typeof v.why !== 'string') throw fail('.why is the creator\'s words for it');
  if (v.from === undefined && v.cube === undefined) throw fail(' names a genre (from) or its own cube, or both');
  return { from: v.from ?? null, cube: clone(v.cube), why: v.why ?? null };
}

const put = (cube, f, s, v) => { (cube[f] ||= {})[s] = v; };

export function cubeOfWorld(world) {
  const I = readIntent(world?.intent), Q = world?.quick;
  // a race against rivals is a kart race (its cube a loop's); alone, a time trial
  // a shooter with a craft is a dogfight: a space craft's a space shooter, an atmosphere craft's air combat
  const from = I?.from ?? (Q && (Q.goal === 'race' && Q.rivals ? 'kart-racer' : Q.goal === 'shoot' && Q.craft ? (CRAFT[Q.craft]?.space ? 'space-shooter' : 'air-combat') : QUICK_GENRE[Q.goal])) ?? null;
  const cube = clone(from ? CUBES[from] : {});
  // what the world's own settings imply
  if (world?.camera) put(cube, 'space', 'camera', world.camera);
  if (world?.topology) put(cube, 'space', 'topology', world.topology);
  if (Q?.ride) put(cube, 'soul', 'hero', 'vehicle');
  if (Q?.track) put(cube, 'space', 'levelForm', Q.track === 'loop' ? 'circuit' : 'trail');
  if (Q?.run) put(cube, 'time', 'progression', 'runs');
  if (world?.style?.pixel) put(cube, 'reality', 'medium', 'pixel');
  // the intent's own values, last
  const said = [];
  for (const [f, s] of Object.entries(I?.cube ?? {})) for (const [k, v] of Object.entries(s)) { put(cube, f, k, v); said.push(`${f}.${k}`); }
  validateCube(cube);
  return { cube, from, said };
}

export function intentReport(world) {
  const { cube, from } = cubeOfWorld(world), written = world?.intent !== undefined;
  const brief = typeof world?.brief === 'string' ? world.brief : world?.brief?.prompt ?? world?.brief?.text ?? '';
  const suggest = !written && !world?.quick && brief ? suggestGenres(brief) : [];
  return {
    from, written, verdict: dryRun(cube).verdict,
    concerns: concernsOf(cube).map(({ asks: _, ...c }) => c),
    ...(suggest.length ? { suggest: suggest.map((g) => ({ id: g.id, matched: g.matched })) } : {}),
  };
}
