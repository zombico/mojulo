/**
 * Routing-card loader — one card per creative-mint routing row retired from
 * forward_context's Create-things section (orientation-diet: the mini
 * segmented index names the FORM + entry tool; the full recognizer row lives
 * here and is retrieved by intent via semantic_search({ kinds: ['routing'] })).
 *
 * A card is a routing row, not a parameter manual: recognizer quotes + the
 * entry tool + the fork sentences a mid-tier model can't infer. Parameter
 * depth stays in the entry tool's description and the get_*_vocab cards.
 * Cards are indexed into meta_embeddings under source_kind='routing'
 * (embeddings.js reindexAll); search returns the FULL body for this kind
 * (routing rows are snippet-sized by design — see ROW lint below).
 *
 * File format mirrors catalysts / beats-vocab — JSON frontmatter between two
 * `---` fences, then the markdown body. `entry` names the entry tool(s) so
 * the eval harness can assert intent → entry-tool routing without parsing
 * prose. Validation faults are loader bugs (curated library, not user input)
 * — throw with file + field so a bad PR fails loudly.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { CREATIVE_FORMS } from '../creative-forms.js';

const CARDS_DIR = moduleDir(import.meta.url, 'lib/mcp/routing-cards');
const REQUIRED_FIELDS = ['id', 'name', 'summary', 'when', 'entry'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

// A routing card that outgrows this is a vocab card wearing a routing card's
// clothing — same ceiling as the routing-row lint in context.test.js.
export const ROUTING_CARD_BODY_CEILING = 1100;

let _catalog = null;

export function parseRoutingCard(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`Routing card ${filePath} is missing JSON frontmatter (expected '---' fences).`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Routing card ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`Routing card ${filePath} is missing required string field '${field}'.`);
    }
  }
  // `form` links a creative-mint card to its get_creative_toolset drawer. It is
  // OPTIONAL — a routing card can point at a non-Ring-10 paradigm (e.g.
  // publication-cook → mint_stash) and omit it — but when present it must name a
  // real form. The coverage lint (routing-cards.test.js) pins that every
  // CREATIVE_FORM has ≥1 card carrying it.
  if (meta.form !== undefined && !CREATIVE_FORMS.includes(meta.form)) {
    throw new Error(
      `Routing card ${filePath} has form '${meta.form}' — must be one of: ${CREATIVE_FORMS.join(', ')} (or omitted).`,
    );
  }
  // `wing` tags which orientation wing a card serves — 'studio' (creative FORMs,
  // the default and original population) or 'office' (the Bot / App / Connected
  // Service paradigm-disambiguation cards). Optional; both wings share the
  // 'routing' source_kind and the one semantic_search hop. The eval harness
  // filters office vs studio fixtures on it.
  if (meta.wing !== undefined && meta.wing !== 'office' && meta.wing !== 'studio') {
    throw new Error(
      `Routing card ${filePath} has wing '${meta.wing}' — must be 'office' or 'studio' (or omitted, defaulting to 'studio').`,
    );
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`Routing card ${filePath} has an empty body — the routing row is the value.`);
  }
  if (body.length > ROUTING_CARD_BODY_CEILING) {
    throw new Error(
      `Routing card ${filePath} body is ${body.length} chars (> ${ROUTING_CARD_BODY_CEILING}). ` +
        'Move parameter detail into the entry tool description or a vocab card.',
    );
  }
  return { id: meta.id, name: meta.name, summary: meta.summary, when: meta.when, entry: meta.entry, form: meta.form ?? null, wing: meta.wing ?? 'studio', body };
}

function loadCatalog() {
  const cards = new Map();
  if (!existsSync(CARDS_DIR)) return cards;
  for (const file of readdirSync(CARDS_DIR).filter((f) => f.endsWith('.md'))) {
    const filePath = join(CARDS_DIR, file);
    const card = parseRoutingCard(filePath, readFileSync(filePath, 'utf8'));
    if (cards.has(card.id)) {
      throw new Error(`Routing card id collision: '${card.id}' declared twice (${file}).`);
    }
    cards.set(card.id, card);
  }
  return cards;
}

export function getRoutingCardCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function getRoutingCard(id) {
  return getRoutingCardCatalog().get(id) || null;
}
