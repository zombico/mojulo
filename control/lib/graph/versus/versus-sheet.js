/**
 * versus sheet — a fighter designed by the character loop: its fight read off its Egocube.
 *
 * Every fighter is a character. A roster entry is the SHEET that designs one (an Egocube roll: who they are, what their
 * life has done to them), made into a character with create_character, or a character already made. The fight is read
 * off the same sheet, so the body, the face and the fight say one thing:
 *
 *   role       how they fight → the fight's style: the frontline grapples, the flanker rushes down, the ranged and the
 *              caster keep the screen, the rest are all-rounders
 *   archetype  what drives them → one signature word (the hero's reversal, the magician's fireball, the outlaw's
 *              overhead); the shadow, as motivation turns them, adds its own (the bully's heavy body, the tyrant's grab)
 *   build      how much body they have → heavy or light (brute and stout heavy, lithe light)
 *   age        a child is light on its feet
 *
 *   fighterSpec(entry, k, seed)  a roster entry → { id, name?, color?, roll | hero, over } (said what is wrong)
 *   defaultFighters(seed)        the roster when none is named: four sheets, a frontline, a flanker, a caster and a
 *                                support, of four different archetypes in a seeded draw
 *   fighterFromSheet(sheet)      → { intent: { archetype, signature }, reads: [{ facet, value, why }] }
 *   fighterName(sheet)           the name the HUD shows: the archetype, or the shadow it has become
 *
 * An entry's own fight words (`style`, `signature`, `weapon`, `library`, `normals`, `specials`, `super`, `tune`) lay
 * over what the sheet says. Pure and deterministic.
 */
import { ARCHETYPES, ROLES, BUILDS, AGES } from '../egocube/facets.js';
import { ARCHETYPES as STYLES, SIGNATURES } from './versus-solver.js';
import { mulberry32 } from '../vegetation/grow.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`versus: ${m}`);

// how they fight → the fight's style
export const STYLE_OF_ROLE = Object.freeze({
  frontline: ['grappler', 'takes the hit so others do not: a big body that walks in and grabs'],
  flanker: ['rushdown', 'arrives from the side and leaves before the answer: fast feet and pressure'],
  ranged: ['zoner', 'one long line to the target: keeps the screen with a fireball and long pokes'],
  caster: ['zoner', 'works at a distance: keeps the screen'],
  controller: ['zoner', 'fights through something else, at a distance: keeps the screen'],
  support: ['all-rounder', 'keeps the others standing: an answer for everything'],
  'non-combatant': ['all-rounder', 'their power is not in their hands: the plainest kit'],
});
// what drives them → one signature word (the light reading)
export const WORD_OF_ARCHETYPE = Object.freeze({
  innocent: ['light', 'unguarded and quick'], explorer: ['kicks', 'weight forward, all legs'], sage: ['fire', 'knowledge thrown across the screen'],
  hero: ['reversal', 'the answer that rises through anything'], outlaw: ['overhead', 'comes over the guard'], magician: ['fire', 'the trick in the hands'],
  everyman: ['punches', 'plain hands'], jester: ['kicks', 'a loose, elastic body'], lover: ['light', 'soft and quick'],
  caregiver: ['reversal', 'the protector\'s answer'], creator: ['grab', 'the maker\'s hands'], ruler: ['heavy', 'mass and stillness'],
});
// the shadow, as motivation turns them → its own word
export const WORD_OF_SHADOW = Object.freeze({
  explorer: ['light', 'the drifter keeps nothing'], sage: ['reversal', 'the cold judge waits for the mistake'], hero: ['heavy', 'the bully puts the chest out'],
  outlaw: ['grab', 'the destroyer takes hold'], magician: ['overhead', 'the corrupter comes from where it should not'], jester: ['overhead', 'the cruel prankster\'s trick'],
  lover: ['grab', 'the obsessive holds on'], caregiver: ['heavy', 'the martyr carries everything'], creator: ['fire', 'the mad maker\'s overwork thrown'],
  ruler: ['grab', 'the tyrant seizes'],
});
const WORD_OF_BUILD = Object.freeze({ brute: ['heavy', 'a brute\'s mass'], stout: ['heavy', 'a stout, planted body'], lithe: ['light', 'a lithe body'] });
const WORD_OF_AGE = Object.freeze({ child: ['light', 'a child is light on its feet'] });

const cap = (s) => s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/** The name the HUD shows: the archetype, or the shadow the life has turned it into. */
export function fighterName(sheet) {
  const r = sheet.reading ?? {};
  return cap(r.reads === 'shadow' ? r.shadow : `the ${sheet.facets.archetype}`);
}

/** A rolled sheet → the fight it reads as: the solver's intent words and why each was chosen. */
export function fighterFromSheet(sheet) {
  const f = sheet.facets, reads = [], words = [];
  const say = (facet, value, word, why) => reads.push({ facet, value, ...(word ? { word } : {}), why });
  const [style, styleWhy] = STYLE_OF_ROLE[f.role] ?? STYLE_OF_ROLE.support;
  say('role', f.role, style, styleWhy);
  const add = (facet, value, row) => {
    if (!row) return;
    const [word, why] = row;
    // heavy and light pull against each other: the body (build, age) holds, the drive gives way
    const against = word === 'heavy' ? 'light' : word === 'light' ? 'heavy' : null;
    if (words.includes(word)) return;
    if (against && words.includes(against)) { say(facet, value, null, `${why}, but the body already says ${against}`); return; }
    words.push(word);
    say(facet, value, word, why);
  };
  add('build', f.build, WORD_OF_BUILD[f.build]);
  add('age', f.age, WORD_OF_AGE[f.age]);
  const reading = sheet.reading?.reads ?? 'light';
  if (reading !== 'shadow') add('archetype', f.archetype, WORD_OF_ARCHETYPE[f.archetype]);
  if (reading !== 'light') add('archetype', `${f.archetype}/shadow`, WORD_OF_SHADOW[f.archetype]);
  return { intent: { archetype: style, ...(words.length ? { signature: words } : {}) }, reads };
}

// what an entry may say: the sheet's words, a character, and the fight's own words over the sheet
const SHEET_KEYS = ['brief', 'facets', 'seed', 'archetype', 'build', 'age', 'role', 'ancestry', 'pole'];
const FIGHT_KEYS = ['style', 'signature', 'weapon', 'library', 'normals', 'specials', 'super', 'tune'];
const OWN_KEYS = ['id', 'name', 'color'];
const ENTRY = 'a fighter is a character: an archetype word, a brief in words, { brief?, facets?, seed?, archetype?, build?, age?, role?, name?, … }, or { hero: { ref } } (a character made with create_character)';

/** A roster entry → { id, name?, color?, roll: { brief?, facets, seed } | hero: { ref }, over: { fight words } }. */
export function fighterSpec(entry, k = 0, seed = 1) {
  const s0 = seed * 31 + 7 * k + 1, id = `fighter-${k + 1}`;
  if (typeof entry === 'string') {
    const w = entry.trim();
    if (!w) throw fail(ENTRY);
    if (STYLES[w]) throw fail(`'${w}' is a fight style: say who the fighter is (an archetype like ${Object.keys(ARCHETYPES).slice(0, 3).join(', ')}, or a brief), and give the style as { style: '${w}' }`);
    return { id, roll: ARCHETYPES[w] ? { facets: { archetype: w }, seed: s0 } : { brief: w, facets: {}, seed: s0 }, over: {} };
  }
  if (!isObj(entry)) throw fail(ENTRY);
  for (const key of Object.keys(entry)) {
    if (key === 'hero' || OWN_KEYS.includes(key) || SHEET_KEYS.includes(key) || FIGHT_KEYS.includes(key)) continue;
    if (key === 'cast' || key === 'body') throw fail(`${key}: a fighter's body is its character's (say it on the sheet: build, age, or the brief)`);
    throw fail(`'${key}' is not a fighter's word (${[...OWN_KEYS, ...SHEET_KEYS, ...FIGHT_KEYS, 'hero'].join(', ')})`);
  }
  if (entry.id !== undefined && !(typeof entry.id === 'string' && /^[a-z0-9-]{1,32}$/.test(entry.id))) throw fail('a fighter\'s id is a short lower-case name');
  if (entry.name !== undefined && !(typeof entry.name === 'string' && entry.name.trim() && entry.name.length <= 24)) throw fail('a fighter\'s name is a few words (at most 24 letters)');
  if (entry.color !== undefined && !/^#[0-9a-f]{6}$/i.test(entry.color)) throw fail('a fighter\'s color is a #rrggbb colour');
  if (entry.style !== undefined && !STYLES[entry.style]) throw fail(`style is a fight style: ${Object.keys(STYLES).join(', ')}`);
  if (entry.signature !== undefined && !(Array.isArray(entry.signature) && entry.signature.every((w) => SIGNATURES[w]))) throw fail(`signature is a list of ${Object.keys(SIGNATURES).join(', ')}`);
  const over = Object.fromEntries(FIGHT_KEYS.filter((x) => entry[x] !== undefined).map((x) => [x, entry[x]]));
  const own = { id: entry.id ?? id, ...(entry.name ? { name: entry.name } : {}), ...(entry.color ? { color: entry.color } : {}) };
  if (entry.hero !== undefined) {
    if (STYLES[entry.archetype]) throw fail(`archetype '${entry.archetype}' is a fight style: give it as style`);
    const sheet = SHEET_KEYS.filter((x) => entry[x] !== undefined);
    if (sheet.length) throw fail(`${sheet.join(', ')}: a character already made has its sheet (drop ${sheet.length > 1 ? 'them' : 'it'}, or the hero)`);
    if (!isObj(entry.hero) || Object.keys(entry.hero).join() !== 'ref' || typeof entry.hero.ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(entry.hero.ref)) throw fail('hero is { ref } (a character made with create_character)');
    return { ...own, hero: { ref: entry.hero.ref }, over };
  }
  if (entry.archetype !== undefined && !ARCHETYPES[entry.archetype]) {
    throw fail(STYLES[entry.archetype] ? `archetype '${entry.archetype}' is a fight style: give it as style, and the archetype as who they are (${Object.keys(ARCHETYPES).join(', ')})` : `archetype is one of ${Object.keys(ARCHETYPES).join(', ')}`);
  }
  if (entry.role !== undefined && !ROLES[entry.role]) throw fail(`role is one of ${Object.keys(ROLES).join(', ')}`);
  if (entry.build !== undefined && !BUILDS[entry.build]) throw fail(`build is one of ${Object.keys(BUILDS).join(', ')}`);
  if (entry.age !== undefined && !AGES[entry.age]) throw fail(`age is one of ${Object.keys(AGES).join(', ')}`);
  if (entry.facets !== undefined && !isObj(entry.facets)) throw fail('facets are the Egocube\'s ({ archetype, role, build, age, ancestry, … })');
  if (entry.brief !== undefined && typeof entry.brief !== 'string') throw fail('a brief is words');
  if (entry.seed !== undefined && !Number.isInteger(entry.seed)) throw fail('a seed is a whole number');
  const facets = { ...(entry.facets ?? {}), ...Object.fromEntries(['archetype', 'build', 'age', 'role', 'ancestry', 'pole'].filter((x) => entry[x] !== undefined).map((x) => [x, entry[x]])) };
  return { ...own, roll: { ...(entry.brief ? { brief: entry.brief } : {}), facets, seed: entry.seed ?? s0 }, over };
}

// the default roster's roles: one of each way of fighting the styles have
const DEFAULT_ROLES = ['frontline', 'flanker', 'caster', 'support'];

/** The roster when none is named: four sheets, one per style, of four different archetypes drawn by the seed. */
export function defaultFighters(seed = 1) {
  const rand = mulberry32((seed * 2654435761) >>> 0), pool = Object.keys(ARCHETYPES);
  return DEFAULT_ROLES.map((role) => ({ role, archetype: pool.splice(Math.floor(rand() * pool.length), 1)[0] }));
}
