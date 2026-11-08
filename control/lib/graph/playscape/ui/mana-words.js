/**
 * THE GAME UI'S WORDS IN THE GAME'S LANGUAGE — the bridge from the dashboard's locale catalogs to the game UI runtime
 * (control/lib/mana-ui/, internal name mana-ui), which imports nothing outside its folder and so cannot read them.
 *
 * mana-ui says a few words of its own that no game passes in: a legend's Select and Back, a list's Nothing here, an
 * idiom's Loading, Rank, Turn order (kernel.js WORDS, in English). Those words live in the catalogs' `gameUi` namespace
 * (control/messages/<locale>.json, the files next-intl serves the dashboard from), so the game's menus speak every
 * language the dashboard does, and a new language lands in both at once through /sync-locales. A host hands them to
 * the runtime as `host.words` (a page: manaUiPage(spec, { words })); a word a language lacks reads in English.
 *
 *   manaWords(locale?)   key → word in that language (a shipped code; absent ⇒ English); throws, teaching, on any other
 *   MANA_WORD_KEYS       the keys (en.json's gameUi)
 *
 * Reads the catalogs beside the package (a data reader: scripts/test-changed.mjs DATA_READERS). Pure otherwise.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../../module-dir.js';
import { locales as SHIPPED_LOCALES, defaultLocale } from '../../../../i18n/config.js';

const MESSAGES_DIR = path.resolve(moduleDir(import.meta.url, 'lib/graph/playscape/ui'), '../../../../messages');
const NAMESPACE = 'gameUi';

const _catalog = new Map();
function catalog(locale) {
  if (!_catalog.has(locale)) {
    const m = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'));
    _catalog.set(locale, m[NAMESPACE] && typeof m[NAMESPACE] === 'object' ? m[NAMESPACE] : {});
  }
  return _catalog.get(locale);
}

export const MANA_WORD_KEYS = Object.freeze(Object.keys(catalog(defaultLocale)));

/** The game UI's words in `locale` (a key the language lacks reads in English). */
export function manaWords(locale) {
  const code = locale === undefined || locale === null ? defaultLocale : locale;
  if (!SHIPPED_LOCALES.includes(code)) throw new Error(`locale '${code}' is not a shipped language — one of: ${SHIPPED_LOCALES.join(', ')}`);
  const en = catalog(defaultLocale), own = code === defaultLocale ? en : catalog(code);
  return Object.fromEntries(MANA_WORD_KEYS.map((k) => [k, typeof own[k] === 'string' && own[k] ? own[k] : en[k]]));
}
