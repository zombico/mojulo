/**
 * meta_embeddings repository — single semantic-search sidecar over durable
 * app state.
 *
 * One table covers eight source kinds (principles, mcp tools, capability
 * bodies, orbit components/compositions/provider artifacts, catalyst
 * markdown, sketch vocabulary cards). Each row is
 * `(source_kind, source_ref) -> (content_hash, body_text, embedding, model)`.
 * The agent reads through the
 * `semantic_search` MCP tool; writes are driven from the source-row write
 * paths via the split sync/async API documented below.
 *
 * ── Split API, why ───────────────────────────────────────────────────────
 *
 * better-sqlite3's db.transaction(fn) requires fn to be SYNCHRONOUS, and
 * generateEmbeddings(...) is async (the embedder loads ONNX and runs
 * inference). The split lets each source-table write follow the same
 * pattern:
 *
 *   compose body text(s) → await embed(...) → enter sync txn that writes
 *   the source row(s) + the embedding row(s) together
 *
 * Atomicity is preserved end-to-end: if the host write rolls back, the
 * embedding write rolls back with it. The embedding cost is paid before
 * the txn opens, so the txn itself stays narrow.
 *
 * ── Failure posture ──────────────────────────────────────────────────────
 *
 * Embed failures are SOFT everywhere. `embed`/`embedMany` log and return
 * `{ vector: null }` on failure so the host write still commits; the agent
 * loses recall on that specific row until the next reindex. Same posture
 * applies to bulk inventory replace — a network blip during embed leaves a
 * whole server's tools un-indexed, but the inventory write itself
 * succeeds.
 *
 * See lite-template/integration/SEMANTIC_INDEX_PLAN.md.
 */

import { createHash } from 'node:crypto';

import { getDb } from '../index.js';
import {
  generateEmbeddings,
  LOCAL_EMBEDDING_MODEL,
  LOCAL_EMBEDDING_DIM,
} from '../../embedder/local.js';

export const SOURCE_KINDS = [
  'principle',
  'mcp_tool',
  'mcp_capability',
  'orbit_component',
  'orbit_composition',
  'orbit_artifact',
  'catalyst',
  'sketch_vocab',
];

const SNIPPET_MAX_CHARS = 280;

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function assertSourceKind(kind) {
  if (!SOURCE_KINDS.includes(kind)) {
    throw new Error(
      `Invalid source_kind '${kind}' (expected one of: ${SOURCE_KINDS.join(', ')})`,
    );
  }
}

// Float32Array <-> Buffer round-trip. Stored as a raw little-endian f32 blob;
// no JSON, no header — the BLOB column owns the layout and the dimension is
// fixed by LOCAL_EMBEDDING_DIM. Reading uses .buffer / .byteOffset / .byteLength
// to avoid copying when the source buffer is already aligned.
function vectorToBuffer(vector) {
  if (!Array.isArray(vector) && !(vector instanceof Float32Array)) {
    throw new Error('vectorToBuffer: expected array or Float32Array');
  }
  const f32 = vector instanceof Float32Array ? vector : Float32Array.from(vector);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

function bufferToVector(buf) {
  // SQLite hands back a Node Buffer; reinterpret as Float32 view.
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  // Return a copy so callers can mutate freely without touching the row.
  return Array.from(f32);
}

function cosine(a, b) {
  // Both populations come out of generateEmbeddings normalized (L2=1), so
  // cosine reduces to dot product. We don't re-normalize on read — the column
  // contract is "store the normalized vector" and any future model swap pays
  // for normalization there.
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function snippetOf(bodyText) {
  if (typeof bodyText !== 'string') return '';
  if (bodyText.length <= SNIPPET_MAX_CHARS) return bodyText;
  return bodyText.slice(0, SNIPPET_MAX_CHARS - 1) + '…';
}

export const EmbeddingsRepository = {
  /**
   * Compute an embedding for one body text. Returns `{ hash, vector }`. When
   * a row at `(sourceKind, sourceRef)` already exists with the same content
   * hash, returns `{ hash, vector: null }` so the sync upsert can no-op
   * without re-embedding. On embed failure, logs and returns
   * `{ hash, vector: null, error }` — host writes never throw on this path.
   *
   * Pass `{ skipUnchanged: false }` for write paths whose host transaction
   * deletes the prior embedding row before upserting (e.g. inventory
   * replace). The hash-skip optimization is unsafe there — the skipped
   * vector would never make it back to the row.
   */
  async embed(sourceKind, sourceRef, bodyText, { skipUnchanged = true } = {}) {
    assertSourceKind(sourceKind);
    if (typeof bodyText !== 'string' || bodyText.length === 0) {
      throw new Error('embed: bodyText must be a non-empty string');
    }
    const hash = sha256(bodyText);
    if (skipUnchanged) {
      const db = getDb();
      const existing = db
        .prepare(
          'SELECT content_hash FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?',
        )
        .get(sourceKind, sourceRef);
      if (existing && existing.content_hash === hash) {
        return { hash, vector: null };
      }
    }
    try {
      const [vector] = await generateEmbeddings([bodyText], {
        inputType: 'search_document',
      });
      return { hash, vector };
    } catch (err) {
      console.warn(
        `[meta_embeddings] embed failed for ${sourceKind}:${sourceRef} — ${err.message}`,
      );
      return { hash, vector: null, error: err.message };
    }
  },

  /**
   * Batched embed for the bulk path (inventory replace, first-install
   * reindex). One model load + one tensor pass. Returns an array parallel to
   * the input: each element is `{ sourceKind, sourceRef, bodyText, hash,
   * vector }`. Hash-skip semantics apply per entry — entries whose hash
   * matches an existing row come back with `vector: null` and are pulled out
   * of the batch before the model call.
   *
   * Pass `{ skipUnchanged: false }` for the inventory-replace path (the
   * host txn deletes the prior embedding row before upserting; a skipped
   * vector there would never make it back into storage).
   */
  async embedMany(items, { skipUnchanged = true } = {}) {
    if (!Array.isArray(items)) {
      throw new Error('embedMany: items must be an array');
    }
    if (items.length === 0) return [];
    const db = getDb();
    const prepped = items.map((it) => {
      assertSourceKind(it.sourceKind);
      if (typeof it.bodyText !== 'string' || it.bodyText.length === 0) {
        throw new Error('embedMany: every item requires a non-empty bodyText');
      }
      const hash = sha256(it.bodyText);
      let skip = false;
      if (skipUnchanged) {
        const existing = db
          .prepare(
            'SELECT content_hash FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?',
          )
          .get(it.sourceKind, it.sourceRef);
        skip = !!(existing && existing.content_hash === hash);
      }
      return {
        sourceKind: it.sourceKind,
        sourceRef: it.sourceRef,
        bodyText: it.bodyText,
        hash,
        vector: null,
        skip,
      };
    });
    const toEmbed = prepped.filter((p) => !p.skip);
    if (toEmbed.length > 0) {
      try {
        const vectors = await generateEmbeddings(
          toEmbed.map((p) => p.bodyText),
          { inputType: 'search_document' },
        );
        for (let i = 0; i < toEmbed.length; i++) {
          toEmbed[i].vector = vectors[i];
        }
      } catch (err) {
        console.warn(
          `[meta_embeddings] embedMany failed (${toEmbed.length} items) — ${err.message}`,
        );
        // Leave .vector = null on every toEmbed entry; the caller treats the
        // batch as a soft loss and the source write still commits.
      }
    }
    return prepped.map((p) => ({
      sourceKind: p.sourceKind,
      sourceRef: p.sourceRef,
      bodyText: p.bodyText,
      hash: p.hash,
      vector: p.vector,
    }));
  },

  /**
   * Synchronous upsert. Call from inside a host write's `db.transaction(fn)`
   * so the embedding row commits or rolls back with the source row.
   *
   * `vector: null` is the soft-failure signal — the upsert is skipped and the
   * caller continues. Existing rows are NOT deleted on soft failure: a prior
   * good embedding stays in place even if the latest embed failed, so recall
   * doesn't regress below the previous state until the row is overwritten or
   * reindexed.
   */
  upsertSync({ sourceKind, sourceRef, bodyText, hash, vector, model = LOCAL_EMBEDDING_MODEL }) {
    assertSourceKind(sourceKind);
    if (typeof sourceRef !== 'string' || sourceRef.length === 0) {
      throw new Error('upsertSync: sourceRef must be a non-empty string');
    }
    if (vector === null || vector === undefined) {
      // No-op on soft-failure / hash-skip. Caller decides whether to log.
      return { written: false, reason: 'no_vector' };
    }
    if (!Array.isArray(vector) && !(vector instanceof Float32Array)) {
      throw new Error('upsertSync: vector must be an array of numbers');
    }
    if (vector.length !== LOCAL_EMBEDDING_DIM) {
      throw new Error(
        `upsertSync: vector length ${vector.length} != expected ${LOCAL_EMBEDDING_DIM}`,
      );
    }
    if (typeof bodyText !== 'string' || bodyText.length === 0) {
      throw new Error('upsertSync: bodyText must be a non-empty string');
    }
    if (typeof hash !== 'string' || hash.length === 0) {
      throw new Error('upsertSync: hash must be a non-empty string');
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO meta_embeddings (source_kind, source_ref, content_hash, body_text, embedding, model)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_kind, source_ref) DO UPDATE SET
         content_hash = excluded.content_hash,
         body_text = excluded.body_text,
         embedding = excluded.embedding,
         model = excluded.model,
         created_at = unixepoch()`,
    ).run(sourceKind, sourceRef, hash, bodyText, vectorToBuffer(vector), model);
    return { written: true };
  },

  /** Sync delete for a single (kind, ref). */
  deleteByRefSync(sourceKind, sourceRef) {
    assertSourceKind(sourceKind);
    const db = getDb();
    const result = db
      .prepare('DELETE FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?')
      .run(sourceKind, sourceRef);
    return result.changes;
  },

  /**
   * Sync delete for every row whose source_ref starts with prefix. Used by
   * the inventory replace path to drop a server's tools in one shot
   * (`deleteByRefPrefixSync('mcp_tool', '${server}::')`).
   */
  deleteByRefPrefixSync(sourceKind, prefix) {
    assertSourceKind(sourceKind);
    if (typeof prefix !== 'string' || prefix.length === 0) {
      throw new Error('deleteByRefPrefixSync: prefix must be a non-empty string');
    }
    const db = getDb();
    // LIKE-escape the prefix's wildcards so a server name with `_` or `%`
    // doesn't widen the delete. The ESCAPE clause makes `\` the escape char
    // and we escape only the LIKE metacharacters; backslash itself is
    // double-escaped for the LIKE pattern.
    const escaped = prefix.replace(/\\/g, '\\\\').replace(/[%_]/g, (m) => `\\${m}`);
    const result = db
      .prepare(
        "DELETE FROM meta_embeddings WHERE source_kind = ? AND source_ref LIKE ? ESCAPE '\\'",
      )
      .run(sourceKind, `${escaped}%`);
    return result.changes;
  },

  /**
   * Cosine top-k. Loads the (optionally kind-filtered) rows into memory,
   * scores against the query embedding, sorts, slices. Acceptable to ~10k
   * rows; past that, swap in sqlite-vec without changing the row shape.
   *
   * Returns `[{ source_kind, source_ref, score, snippet }]`. The caller
   * (`semantic_search` MCP tool) is responsible for re-checking row
   * relevance against current state — e.g. filtering out superseded
   * capability rows by joining against meta_mcp_capabilities.
   */
  async search(query, { kinds, limit = 8 } = {}) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('search: query must be a non-empty string');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error('search: limit must be an integer in [1, 50]');
    }
    let kindFilter = null;
    if (kinds !== undefined && kinds !== null) {
      if (!Array.isArray(kinds) || kinds.length === 0) {
        throw new Error('search: kinds must be a non-empty array when provided');
      }
      for (const k of kinds) assertSourceKind(k);
      kindFilter = kinds;
    }

    let queryVector;
    try {
      const [v] = await generateEmbeddings([query], { inputType: 'search_query' });
      queryVector = v;
    } catch (err) {
      console.warn(`[meta_embeddings] search embed failed: ${err.message}`);
      return [];
    }

    const db = getDb();
    let rows;
    if (kindFilter) {
      const placeholders = kindFilter.map(() => '?').join(',');
      rows = db
        .prepare(
          `SELECT id, source_kind, source_ref, body_text, embedding
           FROM meta_embeddings WHERE source_kind IN (${placeholders})`,
        )
        .all(...kindFilter);
    } else {
      rows = db
        .prepare(
          'SELECT id, source_kind, source_ref, body_text, embedding FROM meta_embeddings',
        )
        .all();
    }

    // Capability rows are append-with-supersession; filter out anything whose
    // backing row is no longer the current capability for its provider. The
    // join goes through meta_mcp_providers because source_ref keys on
    // provider_ref, not capability id. A row in meta_embeddings without a
    // current capability entry is silently dropped — exactly the "never
    // return stale vendor knowledge" property the plan calls for.
    let validCapabilityRefs = null;
    const hasCapabilityRows = rows.some((r) => r.source_kind === 'mcp_capability');
    if (hasCapabilityRows) {
      const currentRows = db
        .prepare(
          `SELECT p.provider_ref
           FROM meta_mcp_capabilities c
           JOIN meta_mcp_providers p ON p.id = c.provider_id
           WHERE c.superseded_by IS NULL`,
        )
        .all();
      validCapabilityRefs = new Set(currentRows.map((r) => r.provider_ref));
    }

    const scored = [];
    for (const r of rows) {
      if (
        validCapabilityRefs &&
        r.source_kind === 'mcp_capability' &&
        !validCapabilityRefs.has(r.source_ref)
      ) {
        continue;
      }
      const vec = bufferToVector(r.embedding);
      const score = cosine(queryVector, vec);
      scored.push({
        source_kind: r.source_kind,
        source_ref: r.source_ref,
        score,
        snippet: snippetOf(r.body_text),
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  },

  /** Read-only inspector used by tests + the integration suite. */
  findByRef(sourceKind, sourceRef) {
    assertSourceKind(sourceKind);
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, source_kind, source_ref, content_hash, body_text, model, created_at
         FROM meta_embeddings WHERE source_kind = ? AND source_ref = ?`,
      )
      .get(sourceKind, sourceRef);
    if (!row) return null;
    return {
      id: row.id,
      sourceKind: row.source_kind,
      sourceRef: row.source_ref,
      contentHash: row.content_hash,
      bodyText: row.body_text,
      model: row.model,
      createdAt: row.created_at,
    };
  },
};

// ── Body composition helpers ──────────────────────────────────────────────
//
// Each source kind has a canonical body shape; the plan's "Body composition
// per source kind" table is enforced here. Write-site callers pick the right
// helper before handing the result to `embed`/`embedMany`. Centralizing the
// composition keeps the index consistent with the plan when source-row
// shapes evolve, and the reindex CLI rides the same helpers.

export const ToolRefSeparator = '::';

export function composeMcpToolRef(server, toolName) {
  return `${server}${ToolRefSeparator}${toolName}`;
}

export function composeMcpToolBody({ server, toolName, description }) {
  // Body = "${server}.${toolName}\n${description ?? ''}". server.tool dotted
  // alone is still useful signal even when description is null — the plan
  // accepts that asymmetry. Note: the ref keys on `::` (so a `.` inside a
  // server name doesn't split badly), but the body uses `.` so tool-name
  // tokens cluster naturally.
  const head = `${server}.${toolName}`;
  if (description && typeof description === 'string' && description.trim()) {
    return `${head}\n${description.trim()}`;
  }
  return head;
}

export function composeOrbitComponentRef({ kind, ref, version }) {
  return `${kind}/${ref}@${version}`;
}

export const BodyComposition = {
  principle(principle) {
    return principle.body_md ?? principle.bodyMd;
  },
  capability(capability) {
    return capability.body_md ?? capability.bodyMd;
  },
  orbitComponent(component) {
    return component.body_md ?? component.bodyMd;
  },
  orbitComposition(composition) {
    return composition.intent_md ?? composition.intentMd;
  },
  orbitArtifact(artifact) {
    return artifact.body_md ?? artifact.bodyMd;
  },
  catalyst(catalyst) {
    // Full markdown — body + frontmatter recomposed so a search for `id`
    // metadata still hits. Loader strips the frontmatter and exposes
    // structured fields, so we round-trip into a serialized form here. This
    // matches the plan's "full markdown file contents" wording.
    const lines = [];
    lines.push(`# ${catalyst.name}`);
    if (catalyst.summary) lines.push('', catalyst.summary);
    if (catalyst.valueHook) lines.push('', `*${catalyst.valueHook}*`);
    if (catalyst.category) lines.push('', `Category: ${catalyst.category}`);
    if (catalyst.body) {
      lines.push('', '---', '', catalyst.body);
    }
    return lines.join('\n');
  },
  sketchVocab(card) {
    // The retrieval signal is the "when" line + summary + body (layout math).
    // Lead with name/summary/when so a query phrased as an intent ("show
    // proportions of a whole") matches the card before the geometry prose.
    const lines = [];
    lines.push(`# ${card.name}`);
    if (card.summary) lines.push('', card.summary);
    if (card.when) lines.push('', `When: ${card.when}`);
    if (card.body) lines.push('', '---', '', card.body);
    return lines.join('\n');
  },
};

// ── reindexAll ────────────────────────────────────────────────────────────
//
// One-shot backfill across every source kind. Idempotent — re-running on a
// populated index is a no-op (hash-skip on every row). Run on first boot
// (wired via maybeBackfillEmbeddings in db/index.js) and re-invocable via
// scripts/reindex-embeddings.js.

export async function reindexAll({ verbose = false } = {}) {
  const log = (msg) => {
    if (verbose) console.log(`[reindex-embeddings] ${msg}`);
  };

  const db = getDb();
  const items = [];

  // 1. Principles
  const principleRows = db
    .prepare('SELECT id, body_md FROM meta_principles')
    .all();
  for (const r of principleRows) {
    items.push({
      sourceKind: 'principle',
      sourceRef: String(r.id),
      bodyText: r.body_md,
    });
  }
  log(`principles: ${principleRows.length}`);

  // 2. MCP tools (inventory)
  const toolRows = db
    .prepare('SELECT server, tool_name, description FROM meta_mcp_inventory')
    .all();
  for (const r of toolRows) {
    items.push({
      sourceKind: 'mcp_tool',
      sourceRef: composeMcpToolRef(r.server, r.tool_name),
      bodyText: composeMcpToolBody({
        server: r.server,
        toolName: r.tool_name,
        description: r.description,
      }),
    });
  }
  log(`mcp_tools: ${toolRows.length}`);

  // 3. Current capability rows
  const capabilityRows = db
    .prepare(
      `SELECT p.provider_ref, c.body_md
       FROM meta_mcp_capabilities c
       JOIN meta_mcp_providers p ON p.id = c.provider_id
       WHERE c.superseded_by IS NULL`,
    )
    .all();
  for (const r of capabilityRows) {
    items.push({
      sourceKind: 'mcp_capability',
      sourceRef: r.provider_ref,
      bodyText: r.body_md,
    });
  }
  log(`mcp_capabilities: ${capabilityRows.length}`);

  // 4. Orbit components
  const componentRows = db
    .prepare('SELECT kind, ref, version, body_md FROM mcp_orbit_components')
    .all();
  for (const r of componentRows) {
    items.push({
      sourceKind: 'orbit_component',
      sourceRef: composeOrbitComponentRef({
        kind: r.kind,
        ref: r.ref,
        version: r.version,
      }),
      bodyText: r.body_md,
    });
  }
  log(`orbit_components: ${componentRows.length}`);

  // 5. Orbit compositions
  const compositionRows = db
    .prepare('SELECT ref, intent_md FROM mcp_orbit_compositions')
    .all();
  for (const r of compositionRows) {
    items.push({
      sourceKind: 'orbit_composition',
      sourceRef: r.ref,
      bodyText: r.intent_md,
    });
  }
  log(`orbit_compositions: ${compositionRows.length}`);

  // 6. Orbit provider artifacts
  const artifactRows = db
    .prepare('SELECT ref, body_md FROM mcp_orbit_provider_artifacts')
    .all();
  for (const r of artifactRows) {
    items.push({
      sourceKind: 'orbit_artifact',
      sourceRef: r.ref,
      bodyText: r.body_md,
    });
  }
  log(`orbit_artifacts: ${artifactRows.length}`);

  // 7. Catalysts — filesystem markdown via the loader.
  const { getCatalystCatalog } = await import('../../mcp/catalysts/loader.js');
  const catalog = getCatalystCatalog();
  for (const cat of catalog.values()) {
    items.push({
      sourceKind: 'catalyst',
      sourceRef: cat.id,
      bodyText: BodyComposition.catalyst(cat),
    });
  }
  log(`catalysts: ${catalog.size}`);

  // 8. Sketch vocabulary — filesystem markdown via the loader. The cards are
  // the retrieval-primed chart vocabulary the /sketch skill queries before
  // composing (kinds: ['sketch_vocab']). Repo-curated, like catalysts.
  const { getSketchVocabCatalog } = await import('../../graph/sketch-vocab/loader.js');
  const vocab = getSketchVocabCatalog();
  for (const card of vocab.values()) {
    items.push({
      sourceKind: 'sketch_vocab',
      sourceRef: card.id,
      bodyText: BodyComposition.sketchVocab(card),
    });
  }
  log(`sketch_vocab: ${vocab.size}`);

  if (items.length === 0) {
    log('nothing to index');
    return { totalSeen: 0, written: 0, skipped: 0, failed: 0 };
  }

  const embedded = await EmbeddingsRepository.embedMany(items);

  let written = 0;
  let skipped = 0;
  let failed = 0;
  const txn = db.transaction(() => {
    for (const e of embedded) {
      if (e.vector === null) {
        // Hash-skip OR soft-fail. We can't distinguish from the return shape
        // alone; the hash-skip case is benign and we just count the row as
        // skipped. embedMany already logged any actual failures.
        const existing = EmbeddingsRepository.findByRef(e.sourceKind, e.sourceRef);
        if (existing && existing.contentHash === e.hash) {
          skipped += 1;
        } else {
          failed += 1;
        }
        continue;
      }
      const res = EmbeddingsRepository.upsertSync({
        sourceKind: e.sourceKind,
        sourceRef: e.sourceRef,
        bodyText: e.bodyText,
        hash: e.hash,
        vector: e.vector,
      });
      if (res.written) written += 1;
      else skipped += 1;
    }
  });
  txn();
  log(`written=${written} skipped=${skipped} failed=${failed}`);
  return { totalSeen: items.length, written, skipped, failed };
}

export const _internals = {
  sha256,
  vectorToBuffer,
  bufferToVector,
  cosine,
  snippetOf,
  SNIPPET_MAX_CHARS,
};
