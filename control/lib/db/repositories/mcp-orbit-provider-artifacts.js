/**
 * mcp_orbit_provider_artifacts repository.
 *
 * Stores generated provider artifacts produced by the primitive-binding
 * generator. Each row is a session-scoped markdown body produced by filling
 * a primitive's role-specific template against a capability snapshot for one
 * MCP, plus the structured binding manifest the caller passed in.
 *
 * The persistence layer matters because:
 *   - The agent calls `bind_primitives` first and then composes / dry-runs /
 *     commits later. The artifact ref is the stable handle across those
 *     calls.
 *   - `meta_context_commit` for a primitive materialization references the
 *     artifact ref so the contextmap's audit trail can chase back to the
 *     exact snapshot + bindings that produced the artifact.
 *   - Persistence enables Phase B work (drift diffing across snapshots,
 *     regenerating when the snapshot changes) without retroactive
 *     instrumentation.
 *
 * See lite-template/integration/MCP_PRIMITIVE_BINDING_PLAN.md.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';
import { EmbeddingsRepository } from './embeddings.js';

const VALID_ROLES = new Set(['source', 'destination']);

function rowToArtifact(row) {
  if (!row) return null;
  return {
    id: row.id,
    ref: row.ref,
    primitiveRef: row.primitive_ref,
    role: row.role,
    server: row.server,
    introspectedAt: row.introspected_at,
    snapshotConfidence: row.snapshot_confidence,
    bodyMd: row.body_md,
    manifest: JSON.parse(row.manifest_json),
    bindings: JSON.parse(row.bindings_json),
    createdAt: row.created_at,
  };
}

function generateRef() {
  // Short stable ref: `prov_<12-hex-chars>`. UUID-derived for collision safety
  // without dragging the full 36-char UUID into agent-facing IDs.
  return `prov_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export const ProviderArtifactRepository = {
  /**
   * Persist a generated provider artifact. Returns the inserted row with its
   * generated ref. The caller (`bind_primitives` handler) typically also
   * inlines the body in its response so the agent doesn't need a second
   * round-trip to read what was just produced.
   */
  insert({ primitiveRef, role, server, introspectedAt, snapshotConfidence, bodyMd, manifest, bindings }) {
    if (!primitiveRef || typeof primitiveRef !== 'string') {
      throw new Error('primitiveRef is required');
    }
    if (!VALID_ROLES.has(role)) {
      throw new Error(`role must be one of: ${[...VALID_ROLES].join(', ')}`);
    }
    if (!server || typeof server !== 'string') {
      throw new Error('server is required');
    }
    if (!bodyMd || typeof bodyMd !== 'string') {
      throw new Error('bodyMd is required');
    }
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('manifest is required');
    }
    if (!bindings || typeof bindings !== 'object') {
      throw new Error('bindings is required');
    }
    const db = getDb();
    const ref = generateRef();
    // introspectedAt is stored as unix seconds; the snapshot's ISO string is
    // converted at the call site. NULL is acceptable when no snapshot is bound.
    const introspectedAtUnix = (() => {
      if (introspectedAt === null || introspectedAt === undefined) return null;
      if (typeof introspectedAt === 'number') return Math.floor(introspectedAt);
      // ISO string → unix seconds
      const parsed = Date.parse(introspectedAt);
      return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
    })();
    const result = db
      .prepare(
        `INSERT INTO mcp_orbit_provider_artifacts
           (ref, primitive_ref, role, server, introspected_at, snapshot_confidence, body_md, manifest_json, bindings_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ref,
        primitiveRef,
        role,
        server,
        introspectedAtUnix,
        snapshotConfidence ?? null,
        bodyMd,
        JSON.stringify(manifest),
        JSON.stringify(bindings),
      );
    const row = db
      .prepare('SELECT * FROM mcp_orbit_provider_artifacts WHERE id = ?')
      .get(result.lastInsertRowid);
    return rowToArtifact(row);
  },

  /**
   * Embedding-aware variant of insert. Pre-embeds body_md before opening
   * the sync txn so the sidecar row commits / rolls back atomically with
   * the artifact row. Falls back to the bare sync insert when
   * MOJULO_SEMANTIC_INDEX_DISABLED=1.
   *
   * Like compositions, the artifact's ref is generated at insert time
   * (`prov_<uuid12>`), so the embed is computed without a hash-skip
   * lookup and the upsert happens inside the sync txn against the
   * post-insert ref.
   */
  async insertWithEmbedding(params) {
    if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') {
      return this.insert(params);
    }
    if (typeof params?.bodyMd !== 'string' || params.bodyMd.length === 0) {
      return this.insert(params); // defer to validation
    }
    const embedded = await EmbeddingsRepository.embed(
      'orbit_artifact',
      '__pending__',
      params.bodyMd,
      { skipUnchanged: false },
    );
    const db = getDb();
    let result;
    db.transaction(() => {
      result = this.insert(params);
      EmbeddingsRepository.upsertSync({
        sourceKind: 'orbit_artifact',
        sourceRef: result.ref,
        bodyText: params.bodyMd,
        hash: embedded.hash,
        vector: embedded.vector,
      });
    })();
    return result;
  },

  findByRef(ref) {
    if (!ref || typeof ref !== 'string') return null;
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM mcp_orbit_provider_artifacts WHERE ref = ?')
      .get(ref);
    return rowToArtifact(row);
  },

  /** All artifacts generated against a given server, most-recent first. */
  listForServer(server) {
    if (!server || typeof server !== 'string') return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM mcp_orbit_provider_artifacts
         WHERE server = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(server);
    return rows.map(rowToArtifact);
  },

  /**
   * All artifacts of a (primitive_ref, role) shape across servers — useful
   * for cross-operator analytics in Phase B.
   */
  listForPrimitiveAndRole(primitiveRef, role) {
    if (!primitiveRef || !VALID_ROLES.has(role)) return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM mcp_orbit_provider_artifacts
         WHERE primitive_ref = ? AND role = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(primitiveRef, role);
    return rows.map(rowToArtifact);
  },
};

// Test seam.
export const _internals = { generateRef, VALID_ROLES };
