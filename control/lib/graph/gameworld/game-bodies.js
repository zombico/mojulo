/**
 * THE BODY RAILS — what kind of BODY a game puts in it, by the kind of game it is: a small table, not code per game (a
 * new kind of body is a row), as the underlayer rails are what a world's setting makes a person wear (hero-looks.js
 * UNDERLAYERS). Each rail names the games it is for and, per ROLE (the hero, the henchman: the grunt a cast fields),
 * the hero-door words it lowers, in each STYLE the world's own primitives choose:
 *
 *   comic      superheroes and their henchmen (a city stalker, a brawler)   anime | ink | material
 *   realistic  people as they are (a story, a western RPG, serious action)  anime | western
 *   muscular   the fighters (a versus fighter)                              anime | western
 *   mascot     the platformer's (a collectathon, a runner, a kart)          mascot | lowpoly
 *
 * The style is the world's, never the rail's: the anime tradition draws on the anime frame (anime-bodies.js: a body
 * codename, Shonen High's among them); the western on the tiered builds (hero-form.js
 * HERO_BUILDS) or the realistic body (`form: 'realistic'` and a physique), by the world's look; a pixel world's mascot
 * on the lowpoly register. Heads and light are not a rail's: the tradition's head and the character light stay where
 * they are (characters.js TRADITIONS), and how a head sits on the body is its own loop.
 *
 * The MUSCLE SHIRT is optional, never a rail's default: an anime role names the definition it would wear (`shirt`) and
 * the shirt is put on only when the world asks for it (`muscle`: true for the role's, or a definition 0 to 1). A western
 * body's muscle is its build or its physique, so `muscle` reads nothing there.
 *
 *   railOfGame({ genre?, goal?, feel? })  → { rail, from, why } | null   the rail a game reads: its feel template, else
 *                                       its genre (intent.from), else its quick goal; none when none names one
 *   styleOf(rail, primitives)          → { style, why }   primitives { tradition?, look?, pixel?, style? }
 *   gameBody(rail, role, primitives)   → { rail, role, style, spec, why, shirt? }   `spec` the hero-door words;
 *                                       `primitives.pole` male | female choosing a codename's or a build's pole,
 *                                       `primitives.muscle` true | 0 … 1 putting the muscle shirt on
 *   readBodyWord(v, at)                → the word, checked: a rail, 'game' (the rail the game reads), or
 *                                       { rail, style?, muscle? }
 *
 * Pure data and resolvers; no dice, no imports.
 */

/** The rails, each { read, genres, goals (a quick game's), feels, styles: { <style>: { when, roles: { hero, henchman } } } }.
 * A role's words are hero-door fields; `animeBody` and `build` are poled ({ male, female }, or one word for both) and
 * resolved by `gameBody`; `shirt` is the muscle shirt's definition the role wears when the world asks for muscle. */
export const GAME_BODIES = Object.freeze({
  comic: Object.freeze({
    read: 'superheroes and their henchmen: the hero broad and defined under a suit, the henchmen heavy',
    genres: ['city-stalker', 'arena-brawler', 'co-op-brawler'],
    goals: [],
    feels: ['vigilante-justice'],
    styles: Object.freeze({
      anime: { when: 'the anime tradition', roles: {
        hero: { animeBody: { male: 'toji', female: 'mizuki' }, shirt: 0.5 },
        henchman: { animeBody: { male: 'armstrong', female: 'kale' }, shirt: 0.5 } } },
      ink: { when: 'the western tradition, drawn (the comic page\'s cel and ink, the default)', roles: {
        hero: { build: 'heroic' },
        henchman: { build: 'brute' } } },
      material: { when: 'the western tradition in a material look (the world\'s juice look)', roles: {
        hero: { form: 'realistic', physique: 'jacked' },
        henchman: { form: 'realistic', physique: { from: 'heavyset', bulk: 0.6 } } } },
    }),
  }),
  realistic: Object.freeze({
    read: 'people as they are: a grown body on earth, neither a hero\'s nor a mascot\'s',
    genres: ['story-adventure', 'survival-horror', 'stealth', 'shooter', 'dungeon-crawler', 'tactics'],
    goals: ['shoot', 'sneak', 'deathmatch'],
    feels: ['ebon-spirits', 'conscription'],
    styles: Object.freeze({
      // (the anime tradition's real body is the anime frame's: a lead's lean body, Shonen High's, and the grown base
      // around it; the realistic body takes only the realistic casts' proportions)
      anime: { when: 'the anime tradition', roles: {
        hero: { animeBody: 'shonen-high', shirt: 0.3 },
        henchman: { animeBody: { male: 'toji', female: 'mizuki' }, shirt: 0.3 } } },
      western: { when: 'the western tradition', roles: {
        hero: { form: 'realistic', physique: 'athletic' },
        henchman: { form: 'realistic', physique: 'athletic' } } },
    }),
  }),
  muscular: Object.freeze({
    read: 'the fighters: every muscle drawn, the heavies hulking',
    genres: ['versus-fighter'],
    goals: ['fight'],
    feels: ['mojulo-fighter'],
    styles: Object.freeze({
      anime: { when: 'the anime tradition', roles: {
        hero: { animeBody: { male: 'toji', female: 'mizuki' }, shirt: 1 },
        henchman: { animeBody: { male: 'armstrong', female: 'kale' }, shirt: 1 } } },
      western: { when: 'the western tradition', roles: {
        hero: { form: 'realistic', physique: 'jacked' },
        henchman: { form: 'realistic', physique: { from: 'jacked', bulk: 1, weight: 0.4 } } } },
    }),
  }),
  mascot: Object.freeze({
    read: 'the platformer\'s: a big head on a small round body, or a few flat faces',
    genres: ['collectathon', 'co-op-platformer', 'metroidvania', 'endless-runner', 'racing', 'kart-racer', 'rhythm'],
    goals: ['collect', 'runner', 'race', 'rhythm'],
    feels: ['jumping-giuseppe', 'galaxy-boy'],
    styles: Object.freeze({
      mascot: { when: 'any world but a pixel one (the default)', roles: {
        hero: { build: 'chibi' },
        henchman: { build: 'chibi' } } },
      lowpoly: { when: 'a pixel world (its medium), or the operator\'s word', roles: {
        hero: { register: 'lowpoly' },
        henchman: { register: 'lowpoly', build: 'stout' } } },
    }),
  }),
});
export const GAME_BODY_NAMES = Object.freeze(Object.keys(GAME_BODIES));
export const GAME_BODY_ROLES = Object.freeze(['hero', 'henchman']);
/** the word that takes the rail the game reads */
export const GAME_WORD = 'game';

const BY_GENRE = Object.fromEntries(GAME_BODY_NAMES.flatMap((r) => GAME_BODIES[r].genres.map((g) => [g, r])));
const BY_GOAL = Object.fromEntries(GAME_BODY_NAMES.flatMap((r) => GAME_BODIES[r].goals.map((g) => [g, r])));
const BY_FEEL = Object.fromEntries(GAME_BODY_NAMES.flatMap((r) => GAME_BODIES[r].feels.map((f) => [f, r])));

/** The rail a game reads: its feel template's (how the hero moves says what it is), else its genre's, else its quick
 * goal's; null when none names one (the door as it is). */
export function railOfGame({ genre = null, goal = null, feel = null } = {}) {
  if (feel && BY_FEEL[feel]) return { rail: BY_FEEL[feel], from: 'feel', why: `its feel plays ${feel}` };
  if (genre && BY_GENRE[genre]) return { rail: BY_GENRE[genre], from: 'genre', why: `a ${genre} game` };
  if (goal && BY_GOAL[goal]) return { rail: BY_GOAL[goal], from: 'goal', why: `a quick game to ${goal}` };
  return null;
}

/** The style a world draws a rail in, from its primitives: the tradition (anime | western), the look (the juice look:
 * material makes a western comic realistic), the medium (a pixel world's mascot is lowpoly). */
export function styleOf(rail, { tradition = null, look = null, pixel = false, style = null } = {}) {
  const R = GAME_BODIES[rail];
  if (!R) throw new Error(`body: '${rail}' is not a rail (${GAME_BODY_NAMES.join(', ')})`);
  const S = R.styles;
  if (style) {
    if (!S[style]) throw new Error(`body: the ${rail} rail is drawn ${Object.keys(S).join(' | ')} (not '${style}')`);
    return { style, why: 'the operator\'s word' };
  }
  if (rail === 'mascot') return pixel ? { style: 'lowpoly', why: 'a pixel world' } : { style: 'mascot', why: S.mascot.when };
  if (tradition === 'anime') return { style: 'anime', why: 'the anime tradition' };
  if (rail === 'comic') return look === 'material' ? { style: 'material', why: 'the western tradition in a material look' } : { style: 'ink', why: 'the western tradition, drawn' };
  return { style: 'western', why: tradition === 'western' ? 'the western tradition' : 'no tradition named: the western, the default that never lies about a body' };
}

/** A role's hero-door words on a rail, in the world's style, for a pole: the codename and the build resolved. */
export function gameBody(rail, role = 'hero', primitives = {}) {
  if (!GAME_BODY_ROLES.includes(role)) throw new Error(`body: '${role}' is not a role (${GAME_BODY_ROLES.join(', ')})`);
  const { style, why } = styleOf(rail, primitives), pole = primitives.pole === 'female' ? 'female' : 'male';
  const { animeBody, build, shirt, ...rest } = GAME_BODIES[rail].styles[style].roles[role];
  const spec = { ...JSON.parse(JSON.stringify(rest)) }, poled = (v) => (typeof v === 'string' ? v : v[pole]);
  if (animeBody) spec.animeBody = poled(animeBody);
  if (build) spec.cast = { pole, build: poled(build) };
  // (the muscle shirt, only when asked: the role's own definition, or the world's)
  const M = primitives.muscle, definition = M === true ? shirt : typeof M === 'number' ? M : undefined;
  if (definition !== undefined && animeBody) spec.muscleShirt = { definition };
  return { rail, role, style, spec, why, ...(shirt !== undefined ? { shirt } : {}) };
}

/** A body word, checked: a rail, or 'game' (the rail the game reads). */
export function readBodyWord(v, at = 'body') {
  if (v === GAME_WORD || GAME_BODY_NAMES.includes(v)) return v;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) if (!['rail', 'style', 'muscle'].includes(k)) throw new Error(`${at}.${k}: a body is { rail, style?, muscle? }`);
    if (v.muscle !== undefined && typeof v.muscle !== 'boolean' && !(typeof v.muscle === 'number' && v.muscle >= 0 && v.muscle <= 1)) throw new Error(`${at}.muscle is true (the muscle shirt at the role's definition), false, or a definition 0 to 1 (the anime frame's; a western body's muscle is its build)`);
    const rail = readBodyWord(v.rail, `${at}.rail`);
    if (v.style !== undefined) {
      if (rail === GAME_WORD) throw new Error(`${at}.style names a style on a rail; '${GAME_WORD}' has none until the game is read (name the rail)`);
      styleOf(rail, { style: v.style });
    }
    return { rail, ...(v.style !== undefined ? { style: v.style } : {}), ...(v.muscle !== undefined ? { muscle: v.muscle } : {}) };
  }
  throw new Error(`${at} is a body rail (${GAME_BODY_NAMES.map((n) => `${n}: ${GAME_BODIES[n].read}`).join('; ')}), '${GAME_WORD}' for the one the game reads, or { rail, style?, muscle? }`);
}

/** the hero door's words the realistic body does not take (the stylized body's own), left off when a rail lays it */
const STYLIZED_ONLY = Object.freeze(['detail', 'body', 'girth', 'paint']);
/**
 * A rail's body laid under a hero-door spec of its own (a quick game's hero, a figure it rolls): the spec's own words
 * win, but a cast WORD only names the pole the rail's build stands on; the anime frame's codename takes the anime head
 * where the spec names none (kept under the realistic head, `head: 'relational'`, a fighter's; left off a spec that names
 * another); the realistic body leaves off what it does not
 * take. `B` is gameBody's. → the spec, unchanged when `B` is null.
 */
export function lowerBody(spec, B) {
  if (!B) return spec;
  const own = spec || {}, W = B.spec, out = { ...W, ...own };
  if (W.cast && typeof own.cast === 'string') out.cast = W.cast;
  if (W.animeBody) {
    if (own.head === undefined) out.head = 'anime';
    // (the realistic head wears the codename on its frame too, a fighter's: fighter wiring; the landmark head as before)
    else if (own.head !== 'anime' && own.head !== 'relational') { delete out.animeBody; delete out.muscleShirt; }
  }
  if (W.form === 'realistic' && own.form === undefined) {
    for (const k of STYLIZED_ONLY) delete out[k];
    if (out.proportions !== undefined && out.proportions !== 'hero') delete out.proportions;
  }
  return out;
}
/** The rail a body word names for a game: the word's own, or (for 'game') the one its feel, genre or goal reads; null
 * when it names none. `word` a rail, 'game' or { rail, style?, muscle? }. → { rail, from, why, style?, muscle? } | null */
export function railOfWord(word, game = {}) {
  if (word === undefined || word === null) return null;
  const W = typeof word === 'string' ? { rail: word } : word;
  const read = W.rail === GAME_WORD ? railOfGame(game) : { rail: W.rail, from: 'word', why: 'the game names it' };
  return read ? { ...read, ...(W.style ? { style: W.style } : {}), ...(W.muscle !== undefined ? { muscle: W.muscle } : {}) } : null;
}
/** The rail a read world's book names for its people (`characters.direction.body`), its kind read for 'game'; null when
 * it names none. → railOfWord's */
export function bookRail(G) {
  const feel = typeof G?.feel === 'string' ? G.feel : G?.feel?.pole ?? null;
  return railOfWord(G?.characters?.direction?.body, { genre: G?.intent?.from ?? null, goal: G?.quick?.goal ?? null, feel });
}
/** The words a lowered spec changed over its base: each new or changed word, and null for a word it left off (so a
 * create over a sheet, `{ ...sheet, ...words }`, draws the lowered spec). {} when nothing changed. */
export function bodyWords(base, lowered) {
  const out = {};
  for (const [k, v] of Object.entries(lowered)) if (JSON.stringify(v) !== JSON.stringify(base[k])) out[k] = v;
  for (const k of Object.keys(base)) if (!(k in lowered)) out[k] = null;
  return out;
}

