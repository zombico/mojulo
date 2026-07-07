/**
 * Mechanic vocabulary loader — one card per game MECHANIC (+ the fall policy + an overview guide)
 * under lib/graph/game/mechanic-cards/ (game-mechanics.plan.md, M2). Each card carries the
 * mechanic's routing phrases + parameter manual, keeping level authoring discoverable: find a
 * mechanic by intent via semantic_search({ kinds: ['game_mechanic'] }), read its manual via
 * get_game_vocab, then declare it in a level's `game.mechanics`. Cards are indexed into
 * meta_embeddings under source_kind='game_mechanic' (embeddings.js reindexAll).
 *
 * Same JSON-frontmatter format + loud-fail discipline as the slice-cards loader.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_DIR = dirname(fileURLToPath(import.meta.url));
const REQUIRED_FIELDS = ['id', 'name', 'summary', 'when'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let _catalog = null;

export function parseMechanicVocabCard(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`Mechanic vocab card ${filePath} is missing JSON frontmatter (expected '---' fences).`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Mechanic vocab card ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`Mechanic vocab card ${filePath} is missing required string field '${field}'.`);
    }
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`Mechanic vocab card ${filePath} has an empty body — the parameter manual is the value.`);
  }
  return { id: meta.id, name: meta.name, summary: meta.summary, when: meta.when, body };
}

function loadCatalog() {
  const cards = new Map();
  if (!existsSync(VOCAB_DIR)) return cards;
  for (const file of readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.md'))) {
    const filePath = join(VOCAB_DIR, file);
    const card = parseMechanicVocabCard(filePath, readFileSync(filePath, 'utf8'));
    if (cards.has(card.id)) {
      throw new Error(`Mechanic vocab id collision: '${card.id}' declared twice (${file}).`);
    }
    cards.set(card.id, card);
  }
  return cards;
}

export function getMechanicVocabCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function getMechanicVocabCard(id) {
  return getMechanicVocabCatalog().get(id) || null;
}

export function listMechanicVocab() {
  return [...getMechanicVocabCatalog().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when }));
}
