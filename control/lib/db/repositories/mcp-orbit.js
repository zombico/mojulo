/**
 * mcp-orbit component store + composition log.
 *
 * Decomposes the monolithic mcp-orbit catalyst pattern into a small set of
 * typed components that combine multiplicatively:
 *   N sources × M destinations × T triggers × K patterns × idempotency × render.
 *
 * Two tables, two repositories:
 *
 *   - mcp_orbit_components — typed, versioned, kind/ref-addressable component
 *     bodies the agent reads at composition time. Loaded into the store from
 *     repo-side .md files at server startup (see mcp-orbit-components/loader.js)
 *     and, in v1, written by `register_mcp_orbit_component` (deferred — schema
 *     accommodates via source='custom').
 *
 *   - mcp_orbit_compositions — first-class log of every composition the
 *     server has ever recommended or the agent has ever assembled. State
 *     machine: proposed → dry_run → materialized → retired. Stored upfront
 *     (option (b) from the plan) because the v1+ trajectory — templates,
 *     analytics, sharing — all needs compositions queryable.
 *
 * SYNCHRONOUS, matching meta-context.js and mcp-inventory.js — both are called
 * from sync transactions via db.transaction(fn) (better-sqlite3 requires fn to
 * be sync).
 *
 * See lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md for the design.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';
import {
  EmbeddingsRepository,
  composeOrbitComponentRef,
} from './embeddings.js';

// 'mcp' kind is intentionally absent — vendor knowledge moved out of the
// component loader into the providers + capabilities Ring 6 surfaces (see
// MCP_DECURATION_PLAN.md). The SQL CHECK constraint still permits 'mcp' for
// backward compatibility with v0.4.x DBs (the seeded loader's
// deleteAllBuiltins() clears any leftover rows on next boot); new code may
// not write 'mcp'-kind components.
const COMPONENT_KINDS = ['trigger', 'pattern', 'idempotency', 'render'];
const COMPONENT_SOURCES = ['builtin', 'custom'];
const COMPOSITION_STATUSES = ['proposed', 'dry_run', 'materialized', 'retired'];
// Roles that an mcp-kind entry can play inside a composition. Non-mcp
// kinds don't carry a role — they're singletons in the composition.
const MCP_ROLES = ['source', 'destination'];

function rowToComponent(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    ref: row.ref,
    version: row.version,
    bodyMd: row.body_md,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    source: row.source,
    createdAt: row.created_at,
  };
}

function rowToComposition(row) {
  if (!row) return null;
  return {
    id: row.id,
    ref: row.ref,
    intentMd: row.intent_md,
    componentRefs: JSON.parse(row.component_refs),
    knobs: JSON.parse(row.knobs_json),
    rankingScore: row.ranking_score,
    status: row.status,
    artifactRef: row.artifact_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertComponentKind(kind) {
  if (!COMPONENT_KINDS.includes(kind)) {
    throw new Error(
      `Invalid component kind '${kind}' (expected one of: ${COMPONENT_KINDS.join(', ')})`,
    );
  }
}

function assertCompositionStatus(status) {
  if (!COMPOSITION_STATUSES.includes(status)) {
    throw new Error(
      `Invalid composition status '${status}' (expected one of: ${COMPOSITION_STATUSES.join(', ')})`,
    );
  }
}

export const MCPOrbitComponentRepository = {
  /**
   * Upsert a component by (kind, ref, version). On conflict, body and payload
   * are overwritten so re-loading the .md file at server start picks up edits
   * without leaving stale rows behind. `source` is preserved on conflict — a
   * row that came in as 'custom' from a user registration shouldn't be
   * downgraded to 'builtin' by a coincidental ref/version match with a
   * shipped component (loader checks for this before writing).
   */
  upsert({ kind, ref, version, body_md, payload, source = 'builtin' }) {
    assertComponentKind(kind);
    if (!ref || typeof ref !== 'string') {
      throw new Error('component.ref must be a non-empty string');
    }
    if (!version || typeof version !== 'string') {
      throw new Error('component.version must be a non-empty string');
    }
    if (!body_md || typeof body_md !== 'string') {
      throw new Error('component.body_md must be a non-empty string');
    }
    if (!COMPONENT_SOURCES.includes(source)) {
      throw new Error(
        `component.source must be one of: ${COMPONENT_SOURCES.join(', ')} (got '${source}')`,
      );
    }
    const db = getDb();
    const payloadJson = payload === undefined || payload === null ? null : JSON.stringify(payload);
    db.prepare(
      `INSERT INTO mcp_orbit_components (kind, ref, version, body_md, payload_json, source)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(kind, ref, version) DO UPDATE SET
         body_md = excluded.body_md,
         payload_json = excluded.payload_json`,
    ).run(kind, ref, version, body_md, payloadJson, source);
    return this.findByRef(kind, ref, version);
  },

  /**
   * Lookup by (kind, ref, version?). When version is omitted, returns the
   * lexicographically-highest version row — components ship under semver, so
   * the highest version string corresponds to the latest release when callers
   * follow the convention. Callers wanting a specific version pass it.
   */
  findByRef(kind, ref, version = null) {
    assertComponentKind(kind);
    const db = getDb();
    if (version) {
      const row = db
        .prepare('SELECT * FROM mcp_orbit_components WHERE kind = ? AND ref = ? AND version = ?')
        .get(kind, ref, version);
      return rowToComponent(row);
    }
    const row = db
      .prepare(
        `SELECT * FROM mcp_orbit_components
         WHERE kind = ? AND ref = ?
         ORDER BY version DESC, id DESC
         LIMIT 1`,
      )
      .get(kind, ref);
    return rowToComponent(row);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM mcp_orbit_components WHERE id = ?').get(id);
    return rowToComponent(row);
  },

  /**
   * List components, optionally filtered by kind and/or ref-prefix. Returns
   * the highest-version row per (kind, ref) so discovery isn't polluted by
   * older versions still living in the table.
   */
  list({ kind, refPattern } = {}) {
    if (kind) assertComponentKind(kind);
    const db = getDb();
    // Window-function-free dedupe: pick the max version per (kind, ref), then
    // join back to grab the matching row. Single query, no SQL extensions.
    const where = [];
    const params = [];
    if (kind) {
      where.push('kind = ?');
      params.push(kind);
    }
    if (refPattern) {
      where.push('ref LIKE ?');
      params.push(refPattern);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT c.* FROM mcp_orbit_components c
         JOIN (
           SELECT kind, ref, MAX(version) AS max_version
           FROM mcp_orbit_components
           ${whereClause}
           GROUP BY kind, ref
         ) latest
           ON c.kind = latest.kind
          AND c.ref = latest.ref
          AND c.version = latest.max_version
         ORDER BY c.kind ASC, c.ref ASC`,
      )
      .all(...params);
    return rows.map(rowToComponent);
  },

  /**
   * Delete every builtin row. Used by the loader at startup to drop the
   * shipped components before re-seeding from disk, so a removed/renamed
   * .md file doesn't linger. Custom rows (user-registered, when that ships)
   * are never touched by this path.
   */
  deleteAllBuiltins() {
    const db = getDb();
    const result = db.prepare("DELETE FROM mcp_orbit_components WHERE source = 'builtin'").run();
    return result.changes;
  },

  /**
   * Embedding-aware variant of upsert. Pre-embeds body_md before opening
   * the sync txn so the sidecar row commits / rolls back atomically with
   * the component row. Falls back to the bare sync upsert when
   * MOJULO_SEMANTIC_INDEX_DISABLED=1.
   *
   * The sidecar's source_ref keys on `${kind}/${ref}@${version}` so each
   * version gets its own embedding row. The semantic_search tool returns
   * matches across versions; callers disambiguate by version in the result
   * (or pin the search via list() at recompose time).
   */
  async upsertWithEmbedding(params) {
    if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') {
      return this.upsert(params);
    }
    if (!params?.kind || !params?.ref || !params?.version || !params?.body_md) {
      // Defer to upsert's validation for shapely error messages.
      return this.upsert(params);
    }
    const sourceRef = composeOrbitComponentRef({
      kind: params.kind,
      ref: params.ref,
      version: params.version,
    });
    const embedded = await EmbeddingsRepository.embed(
      'orbit_component',
      sourceRef,
      params.body_md,
    );
    const db = getDb();
    let result;
    db.transaction(() => {
      result = this.upsert(params);
      EmbeddingsRepository.upsertSync({
        sourceKind: 'orbit_component',
        sourceRef,
        bodyText: params.body_md,
        hash: embedded.hash,
        vector: embedded.vector,
      });
    })();
    return result;
  },
};

export const MCPOrbitCompositionRepository = {
  /**
   * Insert a fresh composition row. Generates the public ref ('comp_<uuid12>')
   * server-side so the agent can refer to it across tool calls before
   * materialization.
   */
  insert({ intent_md, component_refs, knobs, ranking_score = null, status = 'proposed' }) {
    if (!intent_md || typeof intent_md !== 'string') {
      throw new Error('composition.intent_md must be a non-empty string');
    }
    if (!Array.isArray(component_refs) || component_refs.length === 0) {
      throw new Error('composition.component_refs must be a non-empty array');
    }
    for (const r of component_refs) {
      if (!r || typeof r !== 'object') {
        throw new Error(
          'every component_refs[] entry must be an object with { kind, ref, version, role? }',
        );
      }
      if (!r.kind || typeof r.kind !== 'string') {
        throw new Error('component_refs[].kind must be a string');
      }
      if (!r.ref || typeof r.ref !== 'string') {
        throw new Error('component_refs[].ref must be a string');
      }
      if (!r.version || typeof r.version !== 'string') {
        throw new Error('component_refs[].version must be a string');
      }
      // role is required for mcp-kind entries (which workflow role this MCP
      // plays in the composition) and disallowed elsewhere — the other kinds
      // are singletons in a composition (one trigger, one pattern, etc.).
      if (r.kind === 'mcp') {
        if (!r.role || !MCP_ROLES.includes(r.role)) {
          throw new Error(
            `component_refs[].role must be one of: ${MCP_ROLES.join(', ')} for kind='mcp' entries (got '${r.role ?? ''}')`,
          );
        }
      } else if (r.role !== undefined) {
        throw new Error(
          `component_refs[].role is only valid for kind='mcp' entries (got role='${r.role}' on kind='${r.kind}')`,
        );
      }
    }
    if (!knobs || typeof knobs !== 'object') {
      throw new Error('composition.knobs must be an object (use {} for none)');
    }
    assertCompositionStatus(status);
    const db = getDb();
    const ref = `comp_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const result = db
      .prepare(
        `INSERT INTO mcp_orbit_compositions
           (ref, intent_md, component_refs, knobs_json, ranking_score, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ref,
        intent_md,
        JSON.stringify(component_refs),
        JSON.stringify(knobs),
        ranking_score,
        status,
      );
    const row = db.prepare('SELECT * FROM mcp_orbit_compositions WHERE id = ?').get(result.lastInsertRowid);
    return rowToComposition(row);
  },

  findByRef(ref) {
    if (!ref || typeof ref !== 'string') return null;
    const db = getDb();
    const row = db.prepare('SELECT * FROM mcp_orbit_compositions WHERE ref = ?').get(ref);
    return rowToComposition(row);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM mcp_orbit_compositions WHERE id = ?').get(id);
    return rowToComposition(row);
  },

  list({ status, artifactRef } = {}) {
    if (status) assertCompositionStatus(status);
    const db = getDb();
    const where = [];
    const params = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (artifactRef) {
      where.push('artifact_ref = ?');
      params.push(artifactRef);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM mcp_orbit_compositions ${whereClause} ORDER BY created_at DESC, id DESC`)
      .all(...params);
    return rows.map(rowToComposition);
  },

  /**
   * Embedding-aware variant of insert. Pre-embeds intent_md before
   * opening the sync txn so the sidecar row commits / rolls back
   * atomically with the composition row. Falls back to the bare sync
   * insert when MOJULO_SEMANTIC_INDEX_DISABLED=1.
   */
  async insertWithEmbedding(params) {
    if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') {
      return this.insert(params);
    }
    if (typeof params?.intent_md !== 'string' || params.intent_md.length === 0) {
      // Defer to insert's validation.
      return this.insert(params);
    }
    // Compositions are append (no fixed ref pre-insert); we don't know the
    // generated ref until insert returns. Compute the embedding once,
    // upsert with the post-insert ref inside the txn.
    const embedded = await EmbeddingsRepository.embed(
      'orbit_composition',
      '__pending__',
      params.intent_md,
      { skipUnchanged: false },
    );
    const db = getDb();
    let result;
    db.transaction(() => {
      result = this.insert(params);
      EmbeddingsRepository.upsertSync({
        sourceKind: 'orbit_composition',
        sourceRef: result.ref,
        bodyText: params.intent_md,
        hash: embedded.hash,
        vector: embedded.vector,
      });
    })();
    return result;
  },

  /**
   * Update mutable fields. Whitelist: status, knobs, ranking_score,
   * artifact_ref. intent_md and component_refs are immutable — the agent
   * recomposing means inserting a new row, so the deliberation history stays
   * append-friendly.
   */
  update(ref, { status, knobs, ranking_score, artifact_ref } = {}) {
    if (!ref || typeof ref !== 'string') {
      throw new Error('update(ref) requires a non-empty string ref');
    }
    if (status !== undefined) assertCompositionStatus(status);

    const sets = [];
    const params = [];
    if (status !== undefined) {
      sets.push('status = ?');
      params.push(status);
    }
    if (knobs !== undefined) {
      if (!knobs || typeof knobs !== 'object') {
        throw new Error('update.knobs must be an object when provided');
      }
      sets.push('knobs_json = ?');
      params.push(JSON.stringify(knobs));
    }
    if (ranking_score !== undefined) {
      sets.push('ranking_score = ?');
      params.push(ranking_score);
    }
    if (artifact_ref !== undefined) {
      sets.push('artifact_ref = ?');
      params.push(artifact_ref);
    }
    if (sets.length === 0) {
      throw new Error('update() requires at least one of: status, knobs, ranking_score, artifact_ref');
    }
    sets.push('updated_at = unixepoch()');

    const db = getDb();
    const result = db
      .prepare(`UPDATE mcp_orbit_compositions SET ${sets.join(', ')} WHERE ref = ?`)
      .run(...params, ref);
    if (result.changes === 0) {
      throw new Error(`No composition with ref '${ref}'`);
    }
    return this.findByRef(ref);
  },
};

// Test seams.
export const _COMPONENT_KINDS_FOR_TESTS = COMPONENT_KINDS;
export const _COMPONENT_SOURCES_FOR_TESTS = COMPONENT_SOURCES;
export const _COMPOSITION_STATUSES_FOR_TESTS = COMPOSITION_STATUSES;
export const _MCP_ROLES_FOR_TESTS = MCP_ROLES;
