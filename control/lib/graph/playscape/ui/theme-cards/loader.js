/**
 * THE THEME CARDS — the game UI's looks as data, so a new look is a card a model (or a person) writes, the way a
 * WordPress theme is a theme.json: no code. Each `<id>.json` beside this file is one card:
 *
 *   { "id": "<id, the file's name>", "name": "…", "about": "what it is for, in a line",
 *     "family"?: "party | calm | grave | machine | …", "tags"?: ["souls-like", …], "author"?: "…",
 *     "from"?: "<a preset> | <another card's id> | world",
 *     …the theme's own words (control/lib/mana-ui/theme.js: tokens, type, frame, corner, plate, focus, motion, slant,
 *       transition, backdrop, material, backing, crest, breakout, overlay, stage, sounds, ornaments, …) }
 *
 * A card is a CHILD THEME: it says only what it changes over what it comes `from` (a preset, another card, or `world`:
 * the look a game's art direction and colour theorist give it, interface-look.js). Every card is read when this
 * module loads, its `from` chain followed (a card that names a card it cannot reach, or itself, is refused with the
 * reason), its words checked by mana-ui's own reader (readTheme): a card that loads is a theme that draws.
 *
 *   THEME_CARDS · THEME_CARD_IDS   id → the card as written
 *   cardTheme(id, { world? })      → the card as a theme mana-ui reads (its `from` chain resolved; `world` is the look
 *                                    handed in, else the greybox stands in for it)
 *   cardThemes({ world? })         → id → theme, for the board's switcher (scripts/mana-board.mjs --cards)
 *
 * Reads the cards beside it (a data reader: scripts/test-changed.mjs DATA_READERS). Pure otherwise.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../../../module-dir.js';
import { readTheme, THEMES } from '../../../../mana-ui/theme.js';

const DIR = moduleDir(import.meta.url, 'lib/graph/playscape/ui/theme-cards');
const META = ['id', 'name', 'about', 'family', 'tags', 'author', 'from'];
const ID = /^[a-z][a-z0-9-]{1,40}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function readCard(file) {
  const where = `theme-cards/${file}`, card = JSON.parse(readFileSync(path.join(DIR, file), 'utf8'));
  if (!isObj(card)) throw new Error(`${where} is a card { id, name, about, from?, …the theme's words }`);
  if (card.id !== file.replace(/\.json$/, '') || !ID.test(card.id)) throw new Error(`${where}: id is the file's name (lower case, digits, hyphens)`);
  for (const k of ['name', 'about']) if (typeof card[k] !== 'string' || !card[k].trim()) throw new Error(`${where}: ${k} is words`);
  if (card.tags !== undefined && !(Array.isArray(card.tags) && card.tags.every((t) => typeof t === 'string'))) throw new Error(`${where}: tags is a list of words`);
  if (THEMES[card.id]) throw new Error(`${where}: '${card.id}' is a preset's name; a card takes a name of its own`);
  return card;
}

export const THEME_CARDS = Object.freeze(Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().map((f) => { const c = readCard(f); return [c.id, Object.freeze(c)]; })));
export const THEME_CARD_IDS = Object.freeze(Object.keys(THEME_CARDS));

const own = (card) => Object.fromEntries(Object.entries(card).filter(([k]) => !META.includes(k)));

/** A card as a theme mana-ui reads: its `from` chain resolved. `world` is the look the card's `world` parent means. */
export function cardTheme(id, { world } = {}, seen = []) {
  const card = THEME_CARDS[id];
  if (!card) throw new Error(`no theme card '${id}' (the cards: ${THEME_CARD_IDS.join(', ') || 'none'}; the presets: ${Object.keys(THEMES).join(', ')})`);
  if (seen.includes(id)) throw new Error(`theme card '${id}' comes from itself (${[...seen, id].join(' → ')})`);
  const f = card.from;
  const parent = f === undefined ? undefined : f === 'world' ? world || 'greybox' : THEMES[f] ? f : THEME_CARDS[f] ? cardTheme(f, { world }, [...seen, id]) : null;
  if (parent === null) throw new Error(`theme card '${id}': from '${f}' is a preset (${Object.keys(THEMES).join(', ')}), a card (${THEME_CARD_IDS.join(', ')}) or world`);
  return { name: card.name, ...own(card), ...(parent !== undefined ? { from: parent } : {}) };
}

/** Every card as a theme (for the board's switcher). */
export function cardThemes({ world } = {}) {
  return Object.fromEntries(THEME_CARD_IDS.map((id) => [id, cardTheme(id, { world })]));
}

// a card that loads is a theme that draws: each read through mana-ui's own reader now, so a bad one is refused here
for (const id of THEME_CARD_IDS) {
  try { readTheme(cardTheme(id)); } catch (e) { throw new Error(`theme card '${id}': ${e.message}`); }
}
