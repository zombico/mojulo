/**
 * title-words — the words a game's title cards say, in the world's language.
 *
 * A HUD row's `text` may name a WORD instead of spelling it: `'@fight'`, `'@round'`, `'@gameOver'`. The word is read
 * from the dashboard's own locale catalogs (control/messages/<locale>.json, the `gameTitles` namespace — the same files
 * next-intl serves the dashboard from, so the game speaks every language the dashboard does, and a new language lands
 * in both at once through /sync-locales). The world says its language with a top-level `locale` (a shipped code; absent
 * ⇒ `en`). A word keeps its `{var}` placeholders (`Round {round}`), which the HUD fills from the bus as any text.
 *
 *   TITLE_KEYS                 the words (en.json's gameTitles keys)
 *   titleWords(locale)         key → word in that language (a key the language lacks falls to English)
 *   readTitleLocale(v, where)  a locale code checked against the shipped list (throws a teaching error)
 *   localizeHudRows(rows, locale)  the rows with every `@key` text spelled out (a row without one is returned as is;
 *                              an unknown key throws, listing the words)
 *
 * Reads the catalogs beside the package (a data reader: scripts/test-changed.mjs DATA_READERS). Pure otherwise.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { locales as SHIPPED_LOCALES, defaultLocale } from '../../../i18n/config.js';

const MESSAGES_DIR = path.resolve(moduleDir(import.meta.url, 'lib/graph/game'), '../../../messages');
const NAMESPACE = 'gameTitles';   // messages/<locale>.json → gameTitles.<key>
const KEY = /^@([a-zA-Z][a-zA-Z0-9]*)$/;

const _catalog = new Map();
function catalog(locale) {
  if (!_catalog.has(locale)) {
    const m = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
    _catalog.set(locale, m[NAMESPACE] && typeof m[NAMESPACE] === 'object' ? m[NAMESPACE] : {});
  }
  return _catalog.get(locale);
}

export { SHIPPED_LOCALES };
export const TITLE_KEYS = Object.freeze(Object.keys(catalog(defaultLocale)));

/** `v` as a shipped locale code (undefined ⇒ the default). Throws a teaching error on anything else. */
export function readTitleLocale(v, where = 'locale') {
  if (v === undefined || v === null) return defaultLocale;
  if (typeof v === 'string' && SHIPPED_LOCALES.includes(v)) return v;
  throw new Error(`${where} '${v}' is not a shipped language — one of: ${SHIPPED_LOCALES.join(', ')}`);
}

/** key → word in `locale`; a key the language lacks reads in English. */
export function titleWords(locale = defaultLocale) {
  const en = catalog(defaultLocale), own = locale === defaultLocale ? en : catalog(locale);
  return Object.fromEntries(TITLE_KEYS.map((k) => [k, typeof own[k] === 'string' && own[k] ? own[k] : en[k]]));
}

/** Is this text a word reference (`@fight`)? → the key, or null. */
export function titleKeyOf(text) {
  const m = typeof text === 'string' ? text.match(KEY) : null;
  return m ? m[1] : null;
}

/** Any row's `text` naming a word? (the gate: a world with none is never touched) */
export function hasTitleWords(rows) {
  return Array.isArray(rows) && rows.some((r) => r && titleKeyOf(r.text));
}

/**
 * The rows with every `@key` text spelled out in `locale`. Rows without a word reference are passed through untouched
 * (same object), and an array with none returns itself. An unknown key throws, teaching the words.
 */
export function localizeHudRows(rows, locale = defaultLocale, where = 'events.hud') {
  if (!hasTitleWords(rows)) return rows;
  const words = titleWords(readTitleLocale(locale, 'locale'));
  return rows.map((r, i) => {
    const key = r && titleKeyOf(r.text);
    if (!key) return r;
    if (!words[key]) throw new Error(`${where}[${i}].text '@${key}' names no title word — the words: ${TITLE_KEYS.map((k) => `@${k}`).join(', ')}`);
    return { ...r, text: words[key] };
  });
}
