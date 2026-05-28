/**
 * Shared principle-embedding glue for contextmap writes.
 *
 * Every principle that lands in meta_principles is also indexed in the
 * meta_embeddings sidecar so `semantic_search` can recall it. The dance is
 * two-step because better-sqlite3 requires the commit transaction to be
 * synchronous while the embedder is async:
 *
 *   1. `embedPrincipleBodies(bodies)` — async, runs the ONNX model OUTSIDE the
 *      txn, keyed on body text (principles are append-only, so there's no
 *      stable source_ref to key on until the row is inserted).
 *   2. `upsertPrincipleEmbedding(principle, map)` — sync, called INSIDE the
 *      commit txn after each principle insert; pairs the freshly-inserted row
 *      with its pre-computed (hash, vector) and upserts the sidecar row so both
 *      writes commit or roll back together.
 *
 * Extracted from tools/meta-context.js so the plan→contextmap release bridge
 * (lib/mcp/meta-context/plan-release.js) can graduate plan releases on the same
 * embedding path the structural commit types use, without duplicating the dance.
 */

import { EmbeddingsRepository } from '@/lib/db/repositories/embeddings';

/**
 * Pre-embed every distinct principle body before opening the sync txn.
 * Returns a Map keyed on body_text → { hash, vector }. Distinct-only to avoid
 * redundant model work when one body fans out to N principle rows (the `binds`
 * fan-out case). Soft on failure: callers walk the map and skip upsert when an
 * entry is missing or its `vector` is null.
 */
export async function embedPrincipleBodies(bodies) {
  // Operator-facing kill switch — also doubles as the test escape hatch so
  // suites that don't care about the embedding sidecar can skip the ONNX
  // model load with one line at the top of the file.
  if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') return new Map();
  const cleaned = (Array.isArray(bodies) ? bodies : [])
    .filter((b) => typeof b === 'string' && b.length > 0);
  if (cleaned.length === 0) return new Map();
  const distinct = Array.from(new Set(cleaned));
  const items = distinct.map((body) => ({
    sourceKind: 'principle',
    // Placeholder ref: principles are append-only so there's nothing to
    // hash-skip against. skipUnchanged: false below also short-circuits the
    // SELECT — we just want the model to run once per distinct body.
    sourceRef: '__pending__',
    bodyText: body,
  }));
  const embedded = await EmbeddingsRepository.embedMany(items, {
    skipUnchanged: false,
  });
  const map = new Map();
  for (const e of embedded) {
    map.set(e.bodyText, { hash: e.hash, vector: e.vector });
  }
  return map;
}

/**
 * Sync. Pair a freshly-inserted principle row with its pre-computed embedding
 * and upsert the sidecar row. Soft on missing entries.
 */
export function upsertPrincipleEmbedding(principle, bodyEmbeddings) {
  if (!principle || !bodyEmbeddings) return;
  const e = bodyEmbeddings.get(principle.bodyMd);
  if (!e) return;
  EmbeddingsRepository.upsertSync({
    sourceKind: 'principle',
    sourceRef: String(principle.id),
    bodyText: principle.bodyMd,
    hash: e.hash,
    vector: e.vector,
  });
}
