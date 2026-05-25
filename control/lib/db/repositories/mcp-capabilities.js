/**
 * meta_mcp_capabilities repository — vendor knowledge facet of a provider.
 *
 * Append-with-supersession. A new write for an existing provider inserts a
 * new row and flips the supersession FK on the prior current row, all in one
 * transaction. The unique partial index on `(provider_id) WHERE superseded_by
 * IS NULL` enforces at most one current row per provider — supersession is
 * mandatory, not optional.
 *
 * The supersession dance is three statements (not two) because the unique
 * partial index fires on each statement, not at commit. The sequence is:
 *
 *   1. INSERT new with superseded_by = prior.id (or NULL if first)
 *      — non-NULL placeholder so the constraint isn't violated yet
 *   2. UPDATE prior SET superseded_by = new.id
 *      — prior is no longer current; zero rows have NULL (constraint allows)
 *   3. UPDATE new SET superseded_by = NULL
 *      — new is now the only current row
 *
 * Briefly during steps 1–2 the chain has a benign cycle (new → prior, prior →
 * new). SQLite permits cyclic FKs as long as each row exists.
 *
 * Provenance is derived from `source_urls[0]`: a leading "mojulo://" URL
 * marks the row as a build-time seed; anything else (or empty/missing)
 * marks it as agent-research. The composer and fleet brief surface this
 * to the agent so it knows when to refresh via the research-mcp-vendor
 * catalyst.
 *
 * SYNCHRONOUS, matching the meta-context / mcp-inventory / mcp-providers
 * repos.
 *
 * See lite-template/integration/MCP_DECURATION_PLAN.md.
 */

import { getDb } from '../index.js';
import { ProvidersRepository } from './mcp-providers.js';
import { EmbeddingsRepository } from './embeddings.js';

function rowToCapability(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerId: row.provider_id,
    versionTag: row.version_tag,
    bodyMd: row.body_md,
    sourceUrls: row.source_urls ? JSON.parse(row.source_urls) : null,
    discoveredAt: row.discovered_at,
    supersededBy: row.superseded_by,
  };
}

// Provenance derived from source_urls[0] — "seed" when it starts with
// mojulo:// (shipped as build-time seed), "research" otherwise. The composer
// uses this to decide whether to suggest the research-mcp-vendor catalyst.
function capabilitiesProvenance(sourceUrls) {
  if (!Array.isArray(sourceUrls) || sourceUrls.length === 0) return 'research';
  const first = sourceUrls[0];
  if (typeof first === 'string' && first.startsWith('mojulo://')) return 'seed';
  return 'research';
}

function validateSourceUrls(sourceUrls) {
  if (sourceUrls === null || sourceUrls === undefined) return null;
  if (!Array.isArray(sourceUrls)) {
    throw new Error('CapabilitiesRepository.insert: sourceUrls must be an array');
  }
  for (const u of sourceUrls) {
    if (typeof u !== 'string' || u.length === 0) {
      throw new Error('CapabilitiesRepository.insert: each sourceUrls entry must be a non-empty string');
    }
  }
  return sourceUrls;
}

export const CapabilitiesRepository = {
  /**
   * Insert a new capability row for the given provider. If a current row
   * exists, supersede it atomically.
   *
   * Inputs:
   *   providerRef    — canonical provider_ref (lowercase). Required.
   *   displayName    — optional, forwarded to ProvidersRepository.upsertByRef
   *                    on first-time provider creation (first-writer-wins).
   *   versionTag     — optional string (the vendor's declared API version).
   *                    Nullable when docs declare nothing.
   *   bodyMd         — required string, the vendor knowledge body.
   *   sourceUrls     — optional array of strings (citation URLs). First
   *                    element controls provenance: "mojulo://..." → seed,
   *                    anything else → research.
   *   discoveredAt   — optional integer (unix seconds). Defaults to now.
   *                    Used by the seed migration to set the v0.5.0 release
   *                    sentinel for seed rows.
   *
   * Returns `{ id, providerId, providerRef, versionTag, discoveredAt,
   *            supersededId, provenance }`. `supersededId` is the id of the
   *            prior current row (now superseded) or null.
   */
  insert({
    providerRef,
    displayName = null,
    versionTag = null,
    bodyMd,
    sourceUrls = null,
    discoveredAt = null,
  }) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) {
      throw new Error('CapabilitiesRepository.insert: providerRef must be a non-empty string');
    }
    if (typeof bodyMd !== 'string' || bodyMd.length === 0) {
      throw new Error('CapabilitiesRepository.insert: bodyMd must be a non-empty string');
    }
    if (versionTag !== null && versionTag !== undefined && typeof versionTag !== 'string') {
      throw new Error('CapabilitiesRepository.insert: versionTag must be a string or null');
    }
    if (discoveredAt !== null && discoveredAt !== undefined && !Number.isInteger(discoveredAt)) {
      throw new Error('CapabilitiesRepository.insert: discoveredAt must be an integer (unix seconds) or null');
    }
    const cleanSourceUrls = validateSourceUrls(sourceUrls);

    const db = getDb();
    const cleanedVersionTag =
      versionTag !== null && versionTag !== undefined && versionTag.trim()
        ? versionTag.trim()
        : null;

    const txn = db.transaction(() => {
      const provider = ProvidersRepository.upsertByRef(providerRef, { displayName });

      const prior = db
        .prepare(
          'SELECT id FROM meta_mcp_capabilities WHERE provider_id = ? AND superseded_by IS NULL'
        )
        .get(provider.id);

      // Step 1: insert new row. If a prior current row exists, point
      // superseded_by at it as a non-NULL placeholder so the unique partial
      // index doesn't fire (two rows with NULL would collide).
      const insertSql = discoveredAt !== null && discoveredAt !== undefined
        ? `INSERT INTO meta_mcp_capabilities
             (provider_id, version_tag, body_md, source_urls, discovered_at, superseded_by)
           VALUES (?, ?, ?, ?, ?, ?)`
        : `INSERT INTO meta_mcp_capabilities
             (provider_id, version_tag, body_md, source_urls, superseded_by)
           VALUES (?, ?, ?, ?, ?)`;
      const insertParams = discoveredAt !== null && discoveredAt !== undefined
        ? [
            provider.id,
            cleanedVersionTag,
            bodyMd,
            cleanSourceUrls ? JSON.stringify(cleanSourceUrls) : null,
            discoveredAt,
            prior ? prior.id : null,
          ]
        : [
            provider.id,
            cleanedVersionTag,
            bodyMd,
            cleanSourceUrls ? JSON.stringify(cleanSourceUrls) : null,
            prior ? prior.id : null,
          ];
      const result = db.prepare(insertSql).run(...insertParams);
      const newId = result.lastInsertRowid;

      if (prior) {
        // Step 2: prior is no longer current.
        db.prepare(
          'UPDATE meta_mcp_capabilities SET superseded_by = ? WHERE id = ?'
        ).run(newId, prior.id);
        // Step 3: clear new row's placeholder. Now only new has NULL.
        db.prepare(
          'UPDATE meta_mcp_capabilities SET superseded_by = NULL WHERE id = ?'
        ).run(newId);
      }

      const fresh = db
        .prepare('SELECT * FROM meta_mcp_capabilities WHERE id = ?')
        .get(newId);
      return {
        row: fresh,
        providerRef: provider.providerRef,
        supersededId: prior ? prior.id : null,
      };
    });

    const { row, providerRef: ref, supersededId } = txn();
    const cap = rowToCapability(row);
    return {
      id: cap.id,
      providerId: cap.providerId,
      providerRef: ref,
      versionTag: cap.versionTag,
      discoveredAt: cap.discoveredAt,
      supersededId,
      provenance: capabilitiesProvenance(cap.sourceUrls),
    };
  },

  /**
   * Embedding-aware variant. Pre-embeds the body BEFORE the supersession
   * dance so the sidecar row commits / rolls back atomically with the
   * capability row. The sidecar's source_ref keys on provider_ref (one
   * row per logical provider); the upsert on the next write supersedes
   * itself naturally and the search-time filter drops any sidecar row
   * whose backing capability is no longer current.
   *
   * Falls back to the bare sync write when
   * MOJULO_SEMANTIC_INDEX_DISABLED=1.
   */
  async insertWithEmbedding(params) {
    if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') {
      return this.insert(params);
    }
    if (typeof params?.providerRef !== 'string' || params.providerRef.length === 0) {
      throw new Error('insertWithEmbedding: providerRef must be a non-empty string');
    }
    if (typeof params?.bodyMd !== 'string' || params.bodyMd.length === 0) {
      throw new Error('insertWithEmbedding: bodyMd must be a non-empty string');
    }

    // Pre-embed. skipUnchanged: true so a re-seed of an identical body
    // (e.g. running the same install twice) avoids a redundant model call.
    const embedded = await EmbeddingsRepository.embed(
      'mcp_capability',
      params.providerRef,
      params.bodyMd,
    );

    const db = getDb();
    let result;
    const txn = db.transaction(() => {
      result = this.insert(params);
      EmbeddingsRepository.upsertSync({
        sourceKind: 'mcp_capability',
        sourceRef: params.providerRef,
        bodyText: params.bodyMd,
        hash: embedded.hash,
        vector: embedded.vector,
      });
    });
    txn();
    return result;
  },

  /** Return the current capability row for a provider, or null. */
  getCurrent(providerRef) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) return null;
    const db = getDb();
    const row = db
      .prepare(
        `SELECT c.*
         FROM meta_mcp_capabilities c
         JOIN meta_mcp_providers p ON p.id = c.provider_id
         WHERE p.provider_ref = ? AND c.superseded_by IS NULL`
      )
      .get(providerRef);
    return rowToCapability(row);
  },

  /**
   * Return the capability row that was current at `asOfUnix` (unix seconds).
   * Walks: pick the most-recent row whose discovered_at <= asOfUnix. Since
   * each provider's rows are linearly ordered by discovered_at in the
   * supersession chain, the most-recent-at-or-before answers the question.
   */
  getAsOf(providerRef, asOfUnix) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) return null;
    if (!Number.isInteger(asOfUnix)) return null;
    const db = getDb();
    const row = db
      .prepare(
        `SELECT c.*
         FROM meta_mcp_capabilities c
         JOIN meta_mcp_providers p ON p.id = c.provider_id
         WHERE p.provider_ref = ? AND c.discovered_at <= ?
         ORDER BY c.discovered_at DESC, c.id DESC
         LIMIT 1`
      )
      .get(providerRef, asOfUnix);
    return rowToCapability(row);
  },

  /** List all capability rows for a provider, most-recent first. */
  listForProvider(providerRef) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.*
         FROM meta_mcp_capabilities c
         JOIN meta_mcp_providers p ON p.id = c.provider_id
         WHERE p.provider_ref = ?
         ORDER BY c.discovered_at DESC, c.id DESC`
      )
      .all(providerRef);
    return rows.map(rowToCapability);
  },

  /**
   * Composer-facing consolidated view: provider identity + inventory facet
   * + capabilities facet, joined on provider_id. Either facet may be null.
   *
   * Returns null only when the provider itself doesn't exist.
   *
   * Shape:
   *   {
   *     providerRef,
   *     displayName,
   *     inventory: { installAliases, tools, lastSeenAt } | null,
   *     capabilities: { id, versionTag, bodyMd, sourceUrls, discoveredAt, provenance } | null
   *   }
   */
  consolidatedView(providerRef) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) return null;
    const provider = ProvidersRepository.getByRef(providerRef);
    if (!provider) return null;
    const db = getDb();

    const capabilityRow = db
      .prepare(
        `SELECT * FROM meta_mcp_capabilities
         WHERE provider_id = ? AND superseded_by IS NULL`
      )
      .get(provider.id);

    const inventoryRows = db
      .prepare(
        `SELECT * FROM meta_mcp_inventory
         WHERE provider_id = ?
         ORDER BY server ASC, tool_name ASC`
      )
      .all(provider.id);

    let inventory = null;
    if (inventoryRows.length > 0) {
      const installAliases = Array.from(new Set(inventoryRows.map((r) => r.server)));
      const tools = inventoryRows.map((r) => ({
        server: r.server,
        name: r.tool_name,
        ref: r.tool_ref,
        description: r.description,
      }));
      const lastSeenAt = Math.max(...inventoryRows.map((r) => r.declared_at));
      inventory = { installAliases, tools, lastSeenAt };
    }

    let capabilities = null;
    if (capabilityRow) {
      const sourceUrls = capabilityRow.source_urls
        ? JSON.parse(capabilityRow.source_urls)
        : null;
      capabilities = {
        id: capabilityRow.id,
        versionTag: capabilityRow.version_tag,
        bodyMd: capabilityRow.body_md,
        sourceUrls,
        discoveredAt: capabilityRow.discovered_at,
        provenance: capabilitiesProvenance(sourceUrls),
      };
    }

    return {
      providerRef: provider.providerRef,
      displayName: provider.displayName,
      inventory,
      capabilities,
    };
  },
};

export const _internals = {
  rowToCapability,
  capabilitiesProvenance,
  validateSourceUrls,
};
