#!/usr/bin/env node
/**
 * Rebuild the meta_embeddings sidecar from scratch against every source kind
 * + the catalyst markdown shelf. Idempotent — re-running on a populated index
 * is a no-op (hash-skip on every row).
 *
 * Use when:
 *   - body-composition logic changes (e.g. mcp_tool body shape evolves) and
 *     existing rows need to recompute their hashes against the new shape;
 *   - first-boot auto-run failed and the operator wants to retry manually;
 *   - catalyst markdown was updated in-place without a source-row write to
 *     trigger the per-write hook.
 *
 *   node scripts/reindex-embeddings.js [--verbose]
 *
 * Set MOJULO_SEMANTIC_INDEX_DISABLED=1 to skip the first-boot auto-run from
 * getDb() init. This CLI ignores that flag — it's the manual recovery path.
 */

import { reindexAll } from '../lib/db/repositories/embeddings.js';
import { getDb, closeDb } from '../lib/db/index.js';

const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

async function main() {
  // Force DB init up front so any schema migration runs before the reindex.
  getDb();
  const start = Date.now();
  const result = await reindexAll({ verbose });
  const ms = Date.now() - start;
  console.log(
    `reindex-embeddings: totalSeen=${result.totalSeen} written=${result.written} skipped=${result.skipped} failed=${result.failed} (${ms}ms)`,
  );
  closeDb();
}

main().catch((err) => {
  console.error('reindex-embeddings: failed:', err);
  process.exit(1);
});
