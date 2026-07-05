/**
 * Beats vocabulary loader — one card per `create_beats` kind (beats.plan.md).
 *
 * Each card carries the kind's routing phrases + parameter manual, keeping the
 * create_beats tool description lean (the create_view / view-vocab discipline:
 * discover a kind by intent via semantic_search({ kinds: ['beats_vocab'] }),
 * read the full card via get_beats_vocab, then compose params). Cards are
 * indexed into meta_embeddings under source_kind='beats_vocab' (embeddings.js
 * reindexAll).
 *
 * File format mirrors catalysts / sketch-vocab — JSON frontmatter between two
 * `---` fences, then the markdown body. Validation faults are loader bugs
 * (curated library, not user input) — throw with file + field so a bad PR
 * fails loudly.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_DIR = dirname(fileURLToPath(import.meta.url));
const REQUIRED_FIELDS = ['id', 'name', 'summary', 'when'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let _catalog = null;

export function parseBeatsVocabCard(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`Beats vocab card ${filePath} is missing JSON frontmatter (expected '---' fences).`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Beats vocab card ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`Beats vocab card ${filePath} is missing required string field '${field}'.`);
    }
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`Beats vocab card ${filePath} has an empty body — the parameter manual is the value.`);
  }
  return { id: meta.id, name: meta.name, summary: meta.summary, when: meta.when, body };
}

function loadCatalog() {
  const cards = new Map();
  if (!existsSync(VOCAB_DIR)) return cards;
  for (const file of readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.md'))) {
    const filePath = join(VOCAB_DIR, file);
    const card = parseBeatsVocabCard(filePath, readFileSync(filePath, 'utf8'));
    if (cards.has(card.id)) {
      throw new Error(`Beats vocab id collision: '${card.id}' declared twice (${file}).`);
    }
    cards.set(card.id, card);
  }
  return cards;
}

export function getBeatsVocabCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function getBeatsVocabCard(id) {
  return getBeatsVocabCatalog().get(id) || null;
}

export function listBeatsVocab() {
  return [...getBeatsVocabCatalog().values()].map(({ id, name, summary, when }) => ({ id, name, summary, when }));
}
