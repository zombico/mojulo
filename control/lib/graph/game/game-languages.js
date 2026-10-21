/**
 * game-languages — a game LOCALIZED into more than one language, declared once on the game manifest (spike, web first).
 * The manifest holds the words; each level's World page is served with its words swapped for the player's language
 * (level-words.js localizePayload), typeset for its script (locale-conventions.js localeCss).
 *
 *   languages: { source: 'en', locales: ['en', 'ja', 'es'], default?: 'en',
 *                strings?: { ja: { '<source text>': '<localized text>', … }, es: { … } } }
 *
 * Localized, not translated: a word goes over with what it IS (a HUD label in a box that does not grow, a line one
 * character says, a menu choice), the conventions of the language (its register, quotes, plural forms, names in its
 * script) and the words its players already use in games (locale-conventions.js). localizationBrief hands all of that
 * to the operator's agent beside each word still owed; mojulo stores and checks what comes back, it never translates.
 *
 * Keyed by the SOURCE TEXT itself (gettext's msgid): the same phrase in two places is localized once; re-wording a
 * source orphans its entry, which coverage names as stale. Determinism: the language set and every entry are recipe
 * data; nothing here reads Intl, navigator or the clock. Absent `languages` → nothing here is called.
 *
 *   readLanguages(spec, { where })      → errors[] (teaching)
 *   gameWords(manifest)                 → [{ text, role, at }] the game manifest's own player-facing words
 *   languageTable(manifest, levelWords) → { source, locales, default, rows: [{ text, roles, where, speakers, values }] }
 *                                          levelWords: { <level ref>: payloadWords(...) } (level-words.js)
 *   coverage(manifest, levelWords)      → { <loc>: { done, total, missing: [text], stale: [text] } }  advisory only
 *   localizationBrief(manifest, levelWords, loc) → what a localizer needs: the profile, rules, glossary, words owed
 *   mergeTranslations(languages, loc, [{ source, translation }]) → { languages, errors } placeholders held equal
 *   pickLanguage(declared, wanted, fallback) the run-time choice (pure; inlined with toString())
 */

import { localeProfile, glossaryFor } from './locale-conventions.js';

const TAG = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;   // BCP 47: language, script?, region?
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/** A languages declaration's shape, read; every fault said. */
export function readLanguages(spec, { where = 'languages' } = {}) {
  const errors = [];
  if (!isObj(spec)) return [`${where} is { source, locales: [<tag>, …], default?, strings? }: the game's languages, its source first`];
  for (const k of Object.keys(spec)) if (!['source', 'locales', 'default', 'strings'].includes(k)) errors.push(`${where}.${k}: not a languages setting (source, locales, default, strings)`);
  if (!isStr(spec.source) || !TAG.test(spec.source)) errors.push(`${where}.source is the language the game is written in, a BCP 47 tag ('en', 'pt-BR', 'zh-Hans')`);
  const L = spec.locales;
  if (!Array.isArray(L) || L.length < 2 || !L.every((t) => typeof t === 'string' && TAG.test(t))) {
    errors.push(`${where}.locales is two or more BCP 47 tags, the source among them ('en', 'ja', 'pt-BR')`);
  } else {
    if (new Set(L).size !== L.length) errors.push(`${where}.locales names a language twice`);
    if (isStr(spec.source) && !L.includes(spec.source)) errors.push(`${where}.locales must include the source '${spec.source}'`);
    if (L.length > 32) errors.push(`${where}.locales: 32 at most`);
  }
  if (spec.default !== undefined && !(Array.isArray(L) && L.includes(spec.default))) errors.push(`${where}.default is one of locales (the language a player gets when theirs is not offered; absent: the source)`);
  if (spec.strings !== undefined) {
    if (!isObj(spec.strings)) errors.push(`${where}.strings is { <locale>: { '<source text>': '<localized text>' } }`);
    else for (const [loc, t] of Object.entries(spec.strings)) {
      if (!Array.isArray(L) || !L.includes(loc) || loc === spec.source) errors.push(`${where}.strings.${loc}: a table for a declared locale other than the source`);
      else if (!isObj(t) || !Object.values(t).every((v) => typeof v === 'string')) errors.push(`${where}.strings.${loc} maps each source text to its localized text (strings)`);
    }
  }
  return errors;
}

// the game manifest's word fields and what each is. Subtrees with none are skipped (store slice names are identifiers,
// music and theme are refs and tokens, the root's `links` join doors); credits' `names` are people, who keep their names
// in every language. An about entry's links are words (their label and sub)
const ROLES = { title: 'title', subtitle: 'menu-sub', tagline: 'tagline', label: 'label', name: 'option', sub: 'option-sub', blurb: 'prose', body: 'prose', footer: 'prose', role: 'credit-role', thanks: 'prose', closing: 'prose', text: 'prose', press: 'prompt' };
const NO_WORDS = new Set(['store', 'music', 'theme', 'screen', 'run', 'languages', 'kind', 'ref', 'id', 'href', 'gate', 'cover', 'shell', 'final', 'style', 'layout', 'names']);
const titleRole = (at) => (at === 'title' ? 'game-title' : /^levels\[/.test(at) ? 'level-title' : 'menu-entry');

/** The game manifest's own player-facing words, one entry a place, in manifest order. */
export function gameWords(manifest) {
  const out = [];
  const walk = (v, at, role) => {
    if (typeof v === 'string') { if (role && isStr(v)) out.push({ text: v, role: role === 'title' ? titleRole(at) : role, at }); return; }   // never trimmed: the page matches the exact text
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`, role)); return; }
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) if (!NO_WORDS.has(k) && !(k === 'links' && !at)) walk(x, at ? `${at}.${k}` : k, role || ROLES[k]);
  };
  walk(manifest, '', null);
  return out;
}

/** The game's localization table: one row per distinct source text (the game's words, then each level's), with every
 * role and place it has, who says it, and a value per declared locale (null: not localized yet). */
export function languageTable(manifest, levelWords = {}) {
  const lang = manifest.languages, rows = new Map();
  const add = (w, where) => {
    if (!rows.has(w.text)) rows.set(w.text, { text: w.text, roles: [], where: [], speakers: [] });
    const r = rows.get(w.text);
    if (!r.roles.includes(w.role)) r.roles.push(w.role);
    r.where.push(where);
    if (w.speaker && !r.speakers.includes(w.speaker)) r.speakers.push(w.speaker);
  };
  for (const w of gameWords(manifest)) add(w, `game: ${w.at}`);
  for (const lv of manifest.levels ?? []) for (const w of levelWords[lv.ref] ?? []) add(w, `${lv.ref}: ${w.at}`);
  return {
    source: lang.source, locales: lang.locales, default: lang.default ?? lang.source,
    rows: [...rows.values()].map((r) => ({
      ...r, values: Object.fromEntries(lang.locales.map((loc) => [loc, loc === lang.source ? r.text : (lang.strings?.[loc]?.[r.text] ?? null)])),
    })),
  };
}

/** How far each language has come — advisory: a word not localized plays in the source language, nothing refuses. */
export function coverage(manifest, levelWords = {}) {
  const T = languageTable(manifest, levelWords), live = new Set(T.rows.map((r) => r.text)), out = {};
  for (const loc of T.locales) {
    if (loc === T.source) continue;
    const missing = T.rows.filter((r) => r.values[loc] == null).map((r) => r.text);
    const stale = Object.keys(manifest.languages.strings?.[loc] ?? {}).filter((s) => !live.has(s));
    out[loc] = { done: T.rows.length - missing.length, total: T.rows.length, missing, stale };
  }
  return out;
}

// the roles that sit in a box that does not grow: a budget rides beside them, in Latin-letter widths
const TIGHT = new Set(['hud-label', 'hud-text', 'choice', 'prompt', 'menu-title', 'menu-entry', 'item-name', 'speaker', 'quest', 'option', 'level-title']);
const ROLE_SAYS = {
  'game-title': 'the game\'s title: a name; localize it as a publisher would (keep, adapt, or subtitle it)',
  'level-title': 'a level\'s name on the level list',
  'menu-entry': 'a menu entry', 'menu-sub': 'the line under a menu entry', tagline: 'the line under the title',
  'hud-label': 'a HUD label beside a number: a word or an abbreviation, never a sentence',
  'hud-text': 'a banner or toast that flashes over play: short, punchy; {placeholders} are filled by the game',
  speaker: 'a character\'s name in the dialogue box', line: 'a line of dialogue or a question a character asks',
  choice: 'an answer the player picks: the player\'s own voice, short', prompt: 'the word beside the interact key (a verb)',
  quest: 'a quest\'s name in the journal', 'quest-step': 'a journal entry: what to do next',
  'menu-title': 'a menu\'s heading (a shop, a chest)', page: 'a sign, a note or a book page the player reads',
  'item-name': 'an item\'s name', 'item-about': 'the line under an item', sign: 'a sign in the world',
  option: 'a difficulty or setup option', 'option-sub': 'the line under an option', label: 'a label',
  prose: 'prose on an about or credits screen', 'credit-role': 'a role in the credits roll', title: 'a title',
};

// the rules every localizer gets: what localizing a game means beyond its words
const RULES = [
  'Localize, do not transliterate: an idiom, a joke or a pun becomes one that works in the language; a line keeps its intent and its speaker\'s voice.',
  'Keep every {placeholder} exactly as written; move it wherever the sentence needs it.',
  'A word in a box that does not grow carries `fit`: about that many Latin letters wide (a CJK character counts as two). Abbreviate as the language\'s games do rather than overflow.',
  'Counts: prefer the forms games use to dodge plural grammar ("×3", "Coins: 3") over a sentence that needs plural forms.',
  'Numbers are drawn by the game; never spell a number as words or change its digits.',
  'A button keeps the name the platform prints on it (Start, A, Esc); a key prompt names the key, not the letter it types.',
  'One term, one word: the same source term localizes the same way everywhere in the game (the glossary is the start).',
  'Placeholders a game shows when words are missing ("[Hero: line 3]", "[Choice 2]") are worth localizing as the slot they are, or leaving for the author to fill.',
];

/** What a localizer needs for `loc`: the language's conventions, the rules, the glossary for the words owed, and each
 * word still owed with what it is, where it is, who says it and how much room it has. */
export function localizationBrief(manifest, levelWords, loc) {
  const T = languageTable(manifest, levelWords);
  if (!T.locales.includes(loc) || loc === T.source) throw new Error(`'${loc}' is not one of this game's target languages (${T.locales.filter((l) => l !== T.source).join(', ')})`);
  const P = localeProfile(loc), C = coverage(manifest, levelWords)[loc];
  const owed = T.rows.filter((r) => r.values[loc] == null);
  return {
    locale: loc, source: T.source, done: C.done, total: C.total, stale: C.stale,
    conventions: {
      known: P.known, script: P.script, dir: P.dir, address: P.address, quotes: P.quotes, punct: P.punct, plural: P.plural,
      names: P.names, expansion: P.expansion, keys: P.keys, units: P.units,
      ...(P.known ? {} : { note: `no conventions are bundled for '${loc}': it reads as a left-to-right Latin language; follow the platform holder's terminology` }),
    },
    rules: RULES,
    glossary: glossaryFor(loc, owed.map((r) => r.text)),
    words: owed.map((r) => ({
      text: r.text, is: r.roles.map((x) => ROLE_SAYS[x] ?? x), where: r.where,
      ...(r.speakers.length ? { said_by: r.speakers } : {}),
      ...(r.roles.some((x) => TIGHT.has(x)) ? { fit: Math.max(r.text.length, Math.ceil(r.text.length * 1.3)) } : {}),
    })),
  };
}

// placeholders a page substitutes ({var}, {event.n}); a localized text keeps the same set
const holes = (s) => [...s.matchAll(/\{[A-Za-z0-9_.-]+\}/g)].map((m) => m[0]).sort().join('|');

/** Fold a localizer's lines into the declaration (to be stored with update_sketch). Pure; the input is untouched. */
export function mergeTranslations(languages, loc, entries) {
  const errors = [];
  if (!languages.locales.includes(loc) || loc === languages.source) return { languages, errors: [`'${loc}' is not a declared target locale`] };
  const table = { ...(languages.strings?.[loc] ?? {}) };
  for (const { source, translation } of entries) {
    if (!isStr(source) || typeof translation !== 'string') { errors.push(`a line needs { source, translation }: ${JSON.stringify({ source, translation })}`); continue; }
    if (holes(source) !== holes(translation)) { errors.push(`'${source}' → '${translation}': placeholders differ (${holes(source) || 'none'} vs ${holes(translation) || 'none'})`); continue; }
    table[source] = translation;
  }
  const sorted = Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]]));   // stable bytes whatever the order lines came in
  return { languages: { ...languages, strings: { ...(languages.strings ?? {}), [loc]: sorted } }, errors };
}

/** The run-time choice: the first wanted tag declared exactly, then by its language alone, else the fallback.
 * `wanted` is the player's ordered list (navigator.languages) — read in the player's runtime, never at mint. */
export function pickLanguage(declared, wanted, fallback) {
  const W = (wanted || []).map(String);
  for (const w of W) { const hit = declared.find((d) => d.toLowerCase() === w.toLowerCase()); if (hit) return hit; }
  for (const w of W) { const hit = declared.find((d) => d.split('-')[0].toLowerCase() === w.split(/[-_]/)[0].toLowerCase()); if (hit) return hit; }
  return fallback;
}

/** What the World route serves for (game, lang): the language to set on the page and the words to swap, or null when
 * the game declares no such language. The source language gets its tag and no swap. */
export function pageLocale(gameManifest, lang) {
  const L = gameManifest && gameManifest.kind === 'game' ? gameManifest.languages : null;
  if (!L || !Array.isArray(L.locales) || !L.locales.includes(lang)) return null;
  return { lang, strings: lang === L.source ? null : (L.strings?.[lang] ?? {}) };
}
