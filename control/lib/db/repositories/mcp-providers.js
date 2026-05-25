/**
 * meta_mcp_providers repository — identity layer for MCP providers.
 *
 * One row per logical MCP (e.g. "gmail", "notion", "linear"), keyed on a
 * canonical lowercase provider_ref. Inventory rows (introspection facet) and
 * capability rows (research facet) both FK here, so both paths to knowing an
 * MCP converge on the same provider entity.
 *
 * Mojulo never asserts a provider directly — rows are upserted as a
 * side-effect of facet writes. There is no register_mcp_provider tool, by
 * design: a provider row with no facets is useless. Callers are expected to
 * be the inventory and capabilities repositories.
 *
 * display_name is first-writer-wins (no repair tool in v0); subsequent
 * upserts do not overwrite an existing display_name.
 *
 * SYNCHRONOUS, matching the meta-context / mcp-inventory repos.
 *
 * See lite-template/integration/MCP_DECURATION_PLAN.md.
 */

import { getDb } from '../index.js';

function rowToProvider(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerRef: row.provider_ref,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

function normalizeDisplayName(displayName) {
  if (typeof displayName !== 'string') return null;
  const trimmed = displayName.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export const ProvidersRepository = {
  /**
   * Upsert by canonical provider_ref. First-writer-wins on display_name.
   *
   * Returns `{ id, providerRef, displayName, createdAt, wasNew }`.
   */
  upsertByRef(providerRef, { displayName = null } = {}) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) {
      throw new Error('ProvidersRepository.upsertByRef: providerRef must be a non-empty string');
    }
    const db = getDb();
    const cleanedDisplayName = normalizeDisplayName(displayName);

    const txn = db.transaction(() => {
      const existing = db
        .prepare('SELECT * FROM meta_mcp_providers WHERE provider_ref = ?')
        .get(providerRef);
      if (existing) {
        return { row: existing, wasNew: false };
      }
      const result = db
        .prepare(
          'INSERT INTO meta_mcp_providers (provider_ref, display_name) VALUES (?, ?)'
        )
        .run(providerRef, cleanedDisplayName);
      const fresh = db
        .prepare('SELECT * FROM meta_mcp_providers WHERE id = ?')
        .get(result.lastInsertRowid);
      return { row: fresh, wasNew: true };
    });

    const { row, wasNew } = txn();
    return { ...rowToProvider(row), wasNew };
  },

  /** Single-row lookup by canonical provider_ref. Returns null if absent. */
  getByRef(providerRef) {
    if (typeof providerRef !== 'string' || providerRef.length === 0) return null;
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM meta_mcp_providers WHERE provider_ref = ?')
      .get(providerRef);
    return rowToProvider(row);
  },

  /** Single-row lookup by surrogate id. Returns null if absent. */
  getById(id) {
    if (!Number.isInteger(id)) return null;
    const db = getDb();
    const row = db.prepare('SELECT * FROM meta_mcp_providers WHERE id = ?').get(id);
    return rowToProvider(row);
  },

  /** List all providers ordered by provider_ref. Used by fleet brief. */
  listAll() {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM meta_mcp_providers ORDER BY provider_ref ASC')
      .all();
    return rows.map(rowToProvider);
  },
};

// Test seam.
export const _internals = { rowToProvider, normalizeDisplayName };
