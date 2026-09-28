// Retired-shelf prune for the semantic index. Routing cards and curated
// catalysts are shipped markdown that reindexAll mirrors into meta_embeddings,
// and the mirror only ever upserts: a card or catalyst a release deletes keeps
// its row, so semantic_search goes on returning a body whose entry tool no
// longer exists (3.0.0 removed the `bot` routing card and the chatbot-factory
// catalysts; a 2.x index still holds them). This drops `routing` and
// `catalyst` rows whose source is no longer on either shelf. They are derived
// index rows, never operator data: the operator's own active mint_catalyst
// rows are part of the live set and are kept.
//
// Synchronous and model-free (two dep-free markdown loaders and one SELECT),
// so getDb() runs it at boot before any search can answer; reindexAll runs it
// again with the catalogs it already built. A shelf that reads as empty means
// the loader could not see the shipped files (a mis-resolved package root),
// never that every card was retired, so the prune stands down rather than
// emptying the index.

import { getRoutingCardCatalog } from '../mcp/routing-cards/loader.js';
import { getCatalystCatalog } from '../mcp/catalysts/loader.js';

function liveCatalystIds(db) {
  const ids = new Set(getCatalystCatalog().keys());
  if (ids.size === 0) return ids;
  for (const { id } of db.prepare("SELECT id FROM local_catalysts WHERE status = 'active'").all()) {
    ids.add(id);
  }
  return ids;
}

/**
 * Delete meta_embeddings rows of source_kind 'routing' / 'catalyst' whose
 * source_ref is not in the live set. `routingIds` / `catalystIds` default to
 * the shipped routing cards and the curated catalysts plus the active local
 * shelf. Returns the number of rows removed; meta_fts follows through its
 * delete trigger.
 */
export function pruneRetiredShelfEmbeddings(db, { routingIds, catalystIds } = {}) {
  const rows = db
    .prepare("SELECT id, source_kind, source_ref FROM meta_embeddings WHERE source_kind IN ('routing', 'catalyst')")
    .all();
  if (rows.length === 0) return 0;
  const live = {
    routing: routingIds ?? new Set(getRoutingCardCatalog().keys()),
    catalyst: catalystIds ?? liveCatalystIds(db),
  };
  const stale = rows.filter((r) => live[r.source_kind].size > 0 && !live[r.source_kind].has(r.source_ref));
  if (stale.length === 0) return 0;
  const del = db.prepare('DELETE FROM meta_embeddings WHERE id = ?');
  db.transaction(() => {
    for (const r of stale) del.run(r.id);
  })();
  return stale.length;
}
