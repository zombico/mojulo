/**
 * HUD vocabulary loader — the screen-space UI language cards (hud-widgets.js): the guide, the
 * readout kinds, banners / legends, and the style tokens the game shell and a level share.
 * Hand-written under lib/graph/game/hud-cards/; find one by intent via
 * semantic_search({ kinds: ['game_hud'] }), read its manual via get_game_vocab({ id }), then
 * declare rows in a world's `events.hud` (or a game's `theme`). Indexed into meta_embeddings
 * under source_kind='game_hud' (embeddings.js reindexAll).
 *
 * Same JSON-frontmatter format + loud-fail discipline as the mechanic-cards loader.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../../module-dir.js';
const VOCAB_DIR = moduleDir(import.meta.url, 'lib/graph/game/hud-cards');
const REQUIRED_FIELDS = ['id', 'name', 'summary', 'when'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let _catalog = null;

export function parseHudVocabCard(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`HUD vocab card ${filePath} is missing JSON frontmatter (expected '---' fences).`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`HUD vocab card ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`HUD vocab card ${filePath} is missing required string field '${field}'.`);
    }
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`HUD vocab card ${filePath} has an empty body — the parameter manual is the value.`);
  }
  return { id: meta.id, name: meta.name, summary: meta.summary, when: meta.when, body };
}

function loadCatalog() {
  const cards = new Map();
  if (!existsSync(VOCAB_DIR)) return cards;
  for (const file of readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.md'))) {
    const filePath = join(VOCAB_DIR, file);
    const card = parseHudVocabCard(filePath, readFileSync(filePath, 'utf8'));
    if (cards.has(card.id)) {
      throw new Error(`HUD vocab id collision: '${card.id}' declared twice (${file}).`);
    }
    cards.set(card.id, card);
  }
  return cards;
}

export function getHudVocabCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function getHudVocabCard(id) {
  return getHudVocabCatalog().get(id) || null;
}

export function listHudVocab() {
  return [...getHudVocabCatalog().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when }));
}
