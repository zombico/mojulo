/**
 * THE CASTING PAGE — the character book's people rolled as one cast for the game (egocube/cast.js), as many as the game
 * asks for: the hero alone, a rival, a party, or a whole journey's cast. The world says who they are: the game's setting
 * (cast-setting.js: its tradition, era and colours) loads every roll, a turn-based world reads as a battle, and the
 * world's own words (its prompt) say how complete a game it is when the page names no scale.
 *
 *   characters.casting?: {
 *     scale?:    'hero' | 'rival' | 'party' | 'journey'   the cast a game of that size asks for (cast.js castOfScale);
 *                absent, read from the world's prompt, else a party for a world that fights turn by turn, else the hero
 *     n?:        1 … 7, the party besides the hero
 *     anchor?:   { brief?, facets?, faction? }   the hero as a sheet: who everyone else is rolled against
 *     cast?:     { <key>: { relation, …cast.js member words, name?, joins? } }   over the scale's, a key the scale has
 *                replaced in place; `name` is the box's, `joins` the flag that brings them to the hero on the field
 *     factions?, bodies?, seed?   cast.js's own
 *   }
 *
 * Each member becomes a cast member of the book (`laidCasting`): one egocube row holds the cast (the proposal: the
 * members standing in a line), and each member is made from it by path (create_character { egocube, member }). A
 * journey cast waits on its page's approval (`characters:cast`) before a body is made. The first party fights in the
 * party battles from the start, each in the class its sheet reads as (`classOf`), and walks the field beside the hero
 * from the start; with `joins`, once that flag is set, as a written member does. On the level map each member plays
 * its own moves (its hit, its fall and rise, its swing): a person over the library's walk, a beast, a mascot or a
 * beast-kin on its own gaits. A familiar of the hero or of a party member fights beside its keeper and picks for itself
 * (play.rpg `auto`).
 *
 *   castingRequest(G)    → { request, scale, from }     the rollCast request (the game's setting in it) and why that scale
 *   castingOf(G)         → { request, scale, from, sheet, anchor, members } or null (no casting page); a member is
 *                          { id, path, of, name, relation, bond?, body, cls?, joins?, field }: `field` its figure on
 *                          the level map (`fieldOf`)
 *   castingIds(casting)  → [{ id, key, bond }]          the member ids a page makes, without rolling
 *   laidCasting(G)       → G with the rolled members in characters.cast, as { name, joins? } (their ids in characters.rolled)
 *   scaleOfWords(text)   → { scale?, n?, familiar?, bodies?, words }   what a prompt's words ask of the cast
 *   classOf(member)      → the play.rpg class (playscape/rpg/presets.js) a member's mind reads as
 *
 * Pure. A world with no casting page is untouched.
 */
import { rollCast, castOfScale, RELATIONS, SCALES } from '../egocube/cast.js';
import { settingOfGame } from './cast-setting.js';
import { moveSetOf, fieldStatesOf, creatureMovesOf, beastGaitsOf } from '../egocube/moves.js';
import { cubeOfWorld } from './intent.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const words = (s) => s.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`).replace(/-/g, ' ').split(' ').map(cap).join(' ');
export const BOOK_MEMBER_KEYS = Object.freeze(['name', 'joins']);

/** The words that say how complete a game is, highest first: a story's cast, a party, a rival. */
export const SCALE_WORDS = Object.freeze({
  journey: ['saga', 'journey', 'story', 'villain', 'villains', 'mastermind', 'emperor', 'overlord', 'nemeses'],
  party: ['party', 'companions', 'companion', 'crew', 'team', 'allies', 'squad', 'band', 'jrpg', 'rpg', 'friends'],
  rival: ['rival', 'nemesis'],
});
const NUMBERS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const FAMILIAR_WORDS = ['familiar', 'familiars', 'summon', 'summons', 'summoner', 'pet', 'pets', 'tamer'];
const MASCOT_WORDS = ['chibi', 'mascot', 'mascots', 'cute', 'kawaii'];
const BEAST_WORDS = ['beast', 'beasts', 'beastfolk', 'beastmen', 'animal', 'animals', 'furry', 'kemonomimi'];

/** What a prompt's words ask of the cast: the scale, the party's size, a familiar for the hero, the bodies leaned. */
export function scaleOfWords(text) {
  const W = String(text ?? '').toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean), read = [];
  let scale;
  for (const s of Object.keys(SCALE_WORDS)) {
    const hit = W.filter((w) => SCALE_WORDS[s].includes(w));
    if (hit.length) { read.push(...hit); scale ??= s; }
  }
  // "a party of four" counts the hero; "three companions" does not
  let n;
  W.forEach((w, i) => {
    const k = NUMBERS[w] ?? (/^[2-8]$/.test(w) ? Number(w) : null);
    if (!k) return;
    if (W[i - 1] === 'of' && ['party', 'team', 'crew', 'squad', 'band'].includes(W[i - 2])) { n ??= k - 1; read.push(w); }
    else if (['companions', 'allies', 'friends', 'heroes'].includes(W[i + 1])) { n ??= k; read.push(w); }
  });
  const familiar = W.some((w) => FAMILIAR_WORDS.includes(w));
  const mascot = W.some((w) => MASCOT_WORDS.includes(w)), beast = W.some((w) => BEAST_WORDS.includes(w));
  const bodies = { ...(mascot ? { mascot: 4 } : {}), ...(beast ? { beastkin: 3, beast: 3 } : {}) };
  read.push(...W.filter((w) => FAMILIAR_WORDS.includes(w) || MASCOT_WORDS.includes(w) || BEAST_WORDS.includes(w)));
  return { ...(scale ? { scale } : {}), ...(n !== undefined && n >= 1 ? { n: Math.min(7, n) } : {}), ...(familiar ? { familiar: true } : {}), ...(Object.keys(bodies).length ? { bodies } : {}), words: [...new Set(read)] };
}

const turnBased = (G) => {
  if (G.battles !== undefined) return true;
  try { const c = cubeOfWorld(G).cube.power?.combat; return Array.isArray(c) ? c.includes('turn-based') : c === 'turn-based'; } catch { return false; }
};
const strip = (m) => (isObj(m) ? Object.fromEntries(Object.entries(m).filter(([k]) => !BOOK_MEMBER_KEYS.includes(k))) : m);

/** The page's request, before the setting: the scale's cast with the book's over it. */
function requestOf(c, scale, n, heard = {}) {
  const base = castOfScale(scale, { n: c.n ?? n ?? 3 });
  if (heard.familiar && !c.cast?.familiar) base.familiar = { relation: 'familiar' };
  const cast = { ...base };
  for (const [k, m] of Object.entries(c.cast ?? {})) cast[k] = strip(m);
  return { ...(c.anchor ? { anchor: c.anchor } : {}), cast, ...(c.factions ? { factions: c.factions } : {}), ...(c.bodies ?? heard.bodies ? { bodies: c.bodies ?? heard.bodies } : {}), ...(c.seed !== undefined ? { seed: c.seed } : {}) };
}

/** The rollCast request for a world's casting page: { request, scale, from }. */
export function castingRequest(G) {
  const c = G.characters?.casting;
  if (!c) return null;
  const heard = scaleOfWords(G.prompt ?? G.brief?.prompt);   // the world's prompt (readGameworld carries it for a casting page)
  const scale = c.scale ?? heard.scale ?? (turnBased(G) ? 'party' : 'hero');
  const from = c.scale ? 'the page' : heard.scale ? `the prompt's words (${heard.words.join(', ')})` : turnBased(G) ? 'a world that fights turn by turn' : 'nothing asked: the hero alone';
  const setting = { ...settingOfGame(G), ...(turnBased(G) ? { genre: 'battle' } : {}) };
  const request = { ...requestOf(c, scale, heard.n, c.scale ? {} : heard), setting, seed: c.seed ?? (Number.isInteger(G.seed) ? G.seed : 1) };
  return { request, scale, from };
}

/** A member's id in the book: its path below the anchor, a dash for each step (hero/mastermind/lieutenant → mastermind-lieutenant). */
export const castIdOf = (path) => path.split('/').slice(1).join('-');

/** The member ids a page makes, read from its words alone (no roll): [{ id, key, bond }]. */
export function castingIds(c, prompt) {
  const heard = scaleOfWords(prompt);
  const scale = c.scale ?? heard.scale ?? 'hero';
  const req = requestOf(c, scale, heard.n, c.scale ? {} : heard), out = [];
  for (const [key, m] of Object.entries(req.cast)) {
    const bond = m.bond ?? RELATIONS[m.relation]?.bond ?? null;
    if (m.n === undefined) out.push({ id: key.replace(/\//g, '-'), key, bond });
    else for (let i = 1; i <= m.n; i++) out.push({ id: `${key}-${i}`.replace(/\//g, '-'), key, bond });
  }
  return out;
}

/** The class a member's mind reads as, among the presets (fighter, knight, mage, cleric, rogue, monk). */
export function classOf(m) {
  const f = m.temperament ?? m.sheet.facets;
  if (f.role === 'frontline') return f.order < 1 / 3 || ['hero', 'ruler', 'caregiver'].includes(f.archetype) ? 'knight' : 'fighter';
  if (f.role === 'flanker') return f.order < 1 / 3 ? 'monk' : 'rogue';
  if (f.role === 'caster' || f.role === 'controller') return 'mage';
  if (f.role === 'ranged') return 'rogue';
  return 'cleric';
}
/** The roles the presets have no class of their own for: the class stands in, and the readout says so. */
export const CLASS_GAPS = Object.freeze({ ranged: 'no archer class: a rogue stands in', controller: 'no summoner class: a mage stands in' });

/**
 * A member's figure on the level map: `moves` the runtime states its own moves play (a person over the library's walk
 * and idle), or `own` its own clips by state for a body the library does not fit (a beast its two gaits, a mascot its
 * run, walk and idle, a beast-kin below the hero door its walk and jog), with `moves` beside them where it has some.
 * Null for a beast whose species the fauna does not know (no gait to rig).
 */
export function fieldOf(m) {
  if (m.body === 'beast') {
    let g; try { g = beastGaitsOf(m.beast.species); } catch { return null; }
    return { own: { forward: g.at(-1), turn: g[0], strafe: g.at(-1) } };
  }
  if (m.body === 'mascot') return { own: { forward: 'run', idle: 'idle', turn: 'walk', strafe: 'run' }, moves: { stagger: 'surprised' } };
  if (m.sheet.ancestry?.door === 'hero') return { moves: fieldStatesOf(moveSetOf(m.sheet.facets).moves) };
  return { own: { forward: 'jog', idle: 'idle', turn: 'walk', strafe: 'jog' }, moves: fieldStatesOf(creatureMovesOf(m.sheet.facets).moves) };
}

const RELATION_NAMES = { rival: 'The Rival', foil: 'The Foil', mentor: 'The Mentor', shadow: 'The Shadow', lieutenant: 'The Lieutenant', mastermind: 'The Mastermind', herald: 'The Herald', 'threshold-guardian': 'The Guardian', trickster: 'The Trickster', shapeshifter: 'The Shapeshifter' };
/** A name for the box until the book gives one: a beast by its species, a mascot by its promise, a party member by its
 * archetype's reading (the shadow's name when it reads as its shadow), the rest by their relation. */
function nameOf(m) {
  if (m.body === 'beast') return words(m.beast.species);
  if (m.body === 'mascot') return `${cap(m.sheet.facets.promise)} Sprite`;
  if (m.relation === 'rank') return cap(m.rank === 'foot' ? 'troops' : m.rank);
  if (RELATION_NAMES[m.relation]) return RELATION_NAMES[m.relation];
  const r = m.sheet.reading ?? {};
  return cap(r.reads === 'shadow' ? r.shadow : `the ${m.sheet.facets.archetype}`);
}

/** The book's written members: its cast less those laid from the casting page (laidCasting marks them `rolled`). */
const written = (G) => new Set(Object.keys(G.characters?.cast ?? {}).filter((id) => !(G.characters.rolled ?? []).includes(id)));

const ROLLED = new Map(), ROLLED_MAX = 32;
/** The page rolled: { request, scale, from, sheet, anchor: { cls }, members: [{ id, path, name, relation, bond?, body, cls?, joins? }] }. */
export function castingOf(G) {
  const Q = castingRequest(G);
  if (!Q) return null;
  const key = JSON.stringify(Q.request);
  let sheet = ROLLED.get(key);
  if (!sheet) { sheet = rollCast(Q.request); if (ROLLED.size >= ROLLED_MAX) ROLLED.delete(ROLLED.keys().next().value); ROLLED.set(key, sheet); }
  const own = G.characters.casting.cast ?? {};
  const members = sheet.order.slice(1).map((path) => {
    // (an id a written member holds, from a scale the prompt chose, takes '-cast': the written member is the book's)
    const m = sheet.members[path], id = written(G).has(castIdOf(path)) ? `${castIdOf(path)}-cast` : castIdOf(path), key0 = path.split('/').slice(1).join('/'), book = own[key0] ?? {};
    return { id, path, of: m.of, name: book.name ?? nameOf(m), relation: m.relation, ...(m.bond ? { bond: m.bond } : {}), body: m.body, ...(m.bond ? { cls: classOf(m) } : {}), ...(book.joins ? { joins: book.joins } : {}), field: fieldOf(m) };
  });
  return { ...Q, sheet, anchor: { cls: classOf(sheet.members[sheet.anchor]) }, members };
}

/** The world with its rolled members in the book's cast, as the story, the field party and the bible read a written one. */
export function laidCasting(G) {
  const C = castingOf(G);
  if (!C) return G;
  const cast = { ...(G.characters.cast ?? {}) };
  for (const M of C.members) cast[M.id] = { name: M.name, ...(M.joins ? { joins: M.joins } : {}) };
  return { ...G, characters: { ...G.characters, cast, rolled: C.members.map((M) => M.id) } };
}

export { SCALES };
