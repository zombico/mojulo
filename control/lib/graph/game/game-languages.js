/**
 * game-languages — a game in more than one language, declared ONCE on the game manifest and carried into each
 * engine's own localization system (spike). The manifest holds the words; every runtime reads its native table.
 *
 *   languages: { source: 'en', locales: ['en', 'ja', 'es'], default?: 'en',
 *                strings?: { ja: { '<source text>': '<translation>', … }, es: { … } } }
 *
 * The table is keyed by the SOURCE TEXT itself (gettext's msgid, not an invented key): authored words already
 * travel verbatim through game.json / score.json / bus.json to every runtime, and two engines translate a label
 * whose text matches a key with no code at all (Godot's Control auto_translate, Roblox's AutoLocalize against a
 * LocalizationTable's Source column). Re-wording a source string orphans its translations, which `coverage` says.
 *
 * Determinism: the language set and every translation are recipe data; nothing here reads Intl, navigator or the
 * clock. The player's language is chosen at RUN time, among tables already baked (pickLanguage, inlined into a
 * page), so the emitted bytes are the same on every host. Absent `languages` → nothing here is called, and no
 * export gains a byte.
 *
 *   readLanguages(spec, { where })      → errors[] (teaching)
 *   gameSourceText(manifest)            → [{ text, at: [path, …] }] the authored player-facing words, first-seen order
 *   CHROME_WORDS                        the fixed words the runtimes write themselves (they need a lookup, not data)
 *   languageTable(manifest)             → { source, locales, rows: [{ text, at, values: { <loc>: string|null } }] }
 *   coverage(manifest)                  → { <loc>: { done, total, missing: [text], stale: [text] } }  advisory only
 *   languageTodo(manifest, loc)         → [text] the words a translator still owes `loc` (locale-sync's todo shape)
 *   mergeTranslations(languages, loc, [{ source, translation }]) → { languages, errors } placeholders held equal
 *   godotTranslationCsv / godotInternationalization / robloxLocalizationCsv / unrealStringTableCsv / unrealPo /
 *   unityStringsJson / webStrings       the per-engine tables
 *   pickLanguage(declared, wanted, fallback) the run-time choice (pure; inlined with toString())
 */

const TAG = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;   // BCP 47: language, script?, region?
export const RTL = Object.freeze(['ar', 'he', 'fa', 'ur']);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const base = (tag) => tag.split('-')[0];

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
    if (!isObj(spec.strings)) errors.push(`${where}.strings is { <locale>: { '<source text>': '<translation>' } }`);
    else for (const [loc, t] of Object.entries(spec.strings)) {
      if (!Array.isArray(L) || !L.includes(loc) || loc === spec.source) errors.push(`${where}.strings.${loc}: a translation table for a declared locale other than the source`);
      else if (!isObj(t) || !Object.values(t).every((v) => typeof v === 'string')) errors.push(`${where}.strings.${loc} maps each source text to its translation (strings)`);
    }
  }
  return errors;
}

// the manifest's player-facing words: these keys hold words wherever they sit, outside the subtrees that hold none
// (store slice names and init are identifiers, music and theme are refs and tokens). A segment ({ text, href }) is words.
const WORD_KEYS = new Set(['title', 'subtitle', 'tagline', 'label', 'name', 'sub', 'blurb', 'body', 'footer', 'role', 'names', 'thanks', 'closing', 'text', 'press']);
const NO_WORDS = new Set(['store', 'music', 'theme', 'screen', 'run', 'languages', 'links', 'kind', 'ref', 'id', 'href', 'gate', 'cover', 'shell', 'final', 'style', 'layout']);

/** The game manifest's authored player-facing words, each once, in first-seen order, with where it was seen. */
export function gameSourceText(manifest) {
  const seen = new Map();
  const add = (text, at) => {
    if (!isStr(text)) return;   // never trimmed: a runtime matches the exact text it sets ('See ' before a link)
    if (!seen.has(text)) seen.set(text, []);
    seen.get(text).push(at);
  };
  const walk = (v, at, wordy) => {
    if (typeof v === 'string') { if (wordy) add(v, at); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`, wordy)); return; }
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) {
      if (NO_WORDS.has(k)) continue;
      walk(x, at ? `${at}.${k}` : k, wordy || WORD_KEYS.has(k));
    }
  };
  walk(manifest, '', false);
  return [...seen].map(([text, at]) => ({ text, at }));
}

/** The words the runtimes write themselves (kernel literals today). Each leg needs a lookup at its sites; listed
 * here so a translator's todo covers them and the tables carry them. Kept to the sites the export kernels share. */
export const CHROME_WORDS = Object.freeze([
  'LEVEL COMPLETE', 'FAILED', 'level complete', 'game complete', 'next', 'close', 'use',
  'new quest', 'quest complete', 'done', 'JOURNAL', 'start a run', 'new run',
]);

/** The game's string table: one row per source text (authored, then chrome), a value per declared locale. */
export function languageTable(manifest) {
  const lang = manifest.languages;
  const authored = gameSourceText(manifest), have = new Set(authored.map((r) => r.text));
  const rows = [...authored, ...CHROME_WORDS.filter((w) => !have.has(w)).map((text) => ({ text, at: ['chrome'] }))];
  return {
    source: lang.source, locales: lang.locales, default: lang.default ?? lang.source,
    rows: rows.map(({ text, at }) => ({
      text, at,
      values: Object.fromEntries(lang.locales.map((loc) => [loc, loc === lang.source ? text : (lang.strings?.[loc]?.[text] ?? null)])),
    })),
  };
}

/** How far each language has come — advisory; a missing word plays in the source language, it never refuses. */
export function coverage(manifest) {
  const T = languageTable(manifest), live = new Set(T.rows.map((r) => r.text)), out = {};
  for (const loc of T.locales) {
    if (loc === T.source) continue;
    const missing = T.rows.filter((r) => r.values[loc] == null).map((r) => r.text);
    const stale = Object.keys(manifest.languages.strings?.[loc] ?? {}).filter((s) => !live.has(s));
    out[loc] = { done: T.rows.length - missing.length, total: T.rows.length, missing, stale };
  }
  return out;
}

export const languageTodo = (manifest, loc) => coverage(manifest)[loc]?.missing ?? [];

// placeholders a runtime substitutes: {var} (hud subst) and %d / %s (kernel formats). A translation keeps the set.
const holes = (s) => [...s.matchAll(/\{[A-Za-z0-9_.]+\}|%[ds]/g)].map((m) => m[0]).sort().join('|');

/** Fold a translator's lines into the declaration (to be stored with update_sketch). Pure; the input is untouched. */
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

const csvCell = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = (rows) => rows.map((r) => r.map((c) => csvCell(c ?? '')).join(',')).join('\n') + '\n';

// each engine spells a tag its own way: Godot pt_BR, Unreal/Unity pt-BR, Roblox lower-case language codes
export const godotLocale = (tag) => tag.replace(/-/g, '_');
export const robloxLocale = (tag) => {
  const [l, x] = tag.split('-');
  if (l === 'zh') return x === 'Hant' || x === 'TW' || x === 'HK' ? 'zh-tw' : 'zh-cn';
  return x && /^[A-Z]{2}$/.test(x) ? `${l}-${x.toLowerCase()}` : l;
};

/** Godot: a translation CSV (keys = source text; an empty cell is no message, so tr() falls back to the key). Its
 * import makes i18n/strings.<locale>.translation, which godotInternationalization registers. */
export function godotTranslationCsv(T) {
  return csv([['keys', ...T.locales.map(godotLocale)], ...T.rows.map((r) => [r.text, ...T.locales.map((l) => r.values[l])])]);
}

/** Godot: the project.godot section. Labels and Buttons whose text is a key translate themselves (auto_translate). */
export function godotInternationalization(T, dir = 'i18n') {
  const files = T.locales.map((l) => `"res://${dir}/strings.${godotLocale(l)}.translation"`).join(', ');
  return `
[internationalization]

locale/translations=PackedStringArray(${files})
locale/fallback="${godotLocale(T.default)}"
`;
}

/** Roblox: a LocalizationTable CSV (Rojo makes the instance from a .csv); rows match by Source, so AutoLocalize on
 * a TextLabel translates authored words with no script. Words the server composes need a Translator (see the plan). */
export function robloxLocalizationCsv(T) {
  const targets = T.locales.filter((l) => l !== T.source);
  return csv([['Key', 'Context', 'Example', 'Source', ...targets.map(robloxLocale)], ...T.rows.map((r) => ['', '', '', r.text, ...targets.map((l) => r.values[l])])]);
}

// a stable short key for the engines that want one (Unreal's string table): FNV-1a of the source text
const fnv = (s) => { let h = 0x811c9dc5; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
export const textKey = (s) => `t_${fnv(s)}`;

/** Unreal: the source string table (Content/Localization/StringTables), keyed by textKey. */
export function unrealStringTableCsv(T) {
  return csv([['Key', 'SourceString'], ...T.rows.map((r) => [textKey(r.text), r.text])]);
}

/** Unreal: one culture's translations as the PO the Localization Dashboard imports (then compiles to .locres). */
export function unrealPo(T, loc, namespace = 'Mojulo') {
  const q = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  const head = `msgid ""\nmsgstr ""\n"Language: ${loc}\\n"\n"Content-Type: text/plain; charset=UTF-8\\n"\n`;
  return head + T.rows.map((r) => `\nmsgctxt ${q(`${namespace},${textKey(r.text)}`)}\nmsgid ${q(r.text)}\nmsgstr ${q(r.values[loc] ?? '')}\n`).join('');
}

/** Unity: a table JsonUtility reads (arrays, no dictionaries) — the plain route; com.unity.localization can import it. */
export function unityStringsJson(T) {
  return JSON.stringify({ source: T.source, fallback: T.default, locales: T.locales, rows: T.rows.map((r) => ({ text: r.text, values: T.locales.map((l) => r.values[l] ?? '') })) }, null, 2);
}

/** Web: what a page bakes — only the translated words, per locale, and which ones read right to left. */
export function webStrings(T) {
  const t = {};
  for (const loc of T.locales) {
    if (loc === T.source) continue;
    t[loc] = Object.fromEntries(T.rows.filter((r) => r.values[loc] != null).map((r) => [r.text, r.values[loc]]));
  }
  return { source: T.source, fallback: T.default, locales: T.locales, rtl: T.locales.filter((l) => RTL.includes(base(l))), t };
}

/** The run-time choice: the first wanted tag declared exactly, then by its language alone, else the fallback.
 * `wanted` is the player's ordered list (navigator.languages, OS locale) — read in the player's runtime, never at mint. */
export function pickLanguage(declared, wanted, fallback) {
  const W = (wanted || []).map(String);
  for (const w of W) { const hit = declared.find((d) => d.toLowerCase() === w.toLowerCase()); if (hit) return hit; }
  for (const w of W) { const hit = declared.find((d) => d.split('-')[0].toLowerCase() === w.split(/[-_]/)[0].toLowerCase()); if (hit) return hit; }
  return fallback;
}
