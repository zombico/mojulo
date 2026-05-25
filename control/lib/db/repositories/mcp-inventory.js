/**
 * meta_mcp_inventory repository — current-state cache of the connecting
 * agent's MCP environment.
 *
 * Sits alongside the append-only contextmap (meta_nodes / meta_edges /
 * meta_principles) by design. The contextmap records sealed structural
 * decisions and is append-only. Inventory records what tools the operator
 * has available *right now* — that's a present-state fact that gets
 * REPLACED on every declaration, never merged or accumulated. Mixing the
 * two semantics in one table would let the graph slowly diverge from the
 * operator's actual environment.
 *
 * SYNCHRONOUS, matching meta-context.js — both are called from a single
 * transaction via MetaContextRepository.commit(fn) (better-sqlite3 requires
 * fn to be sync).
 *
 * See lite-template/integration/MCP_INVENTORY_PLAN.md for the design.
 */

import { getDb } from '../index.js';
import { ProvidersRepository } from './mcp-providers.js';
import { canonicalizeServerName } from '../../mcp/providers/canonicalize.js';

const VALID_CONFIDENCE = new Set([
  'tools_list_full',
  'agent_inferred',
  'names_only',
]);

function rowToTool(row) {
  if (!row) return null;
  return {
    id: row.id,
    server: row.server,
    toolName: row.tool_name,
    toolRef: row.tool_ref,
    description: row.description,
    declaredAt: row.declared_at,
    inputSchema: row.input_schema_json ? JSON.parse(row.input_schema_json) : null,
    introspectionConfidence: row.introspection_confidence || null,
    providerId: row.provider_id ?? null,
  };
}

function toolRef(server, toolName) {
  return `${server}.${toolName}`;
}

// Derive a per-server confidence label from its tools' per-tool labels.
// Most-pessimistic wins: any tool without a schema or marked names_only drops
// the whole server to names_only, since the agent can't trust a single
// schema-less tool any more than a fully-named-only snapshot.
//
// Precedence (highest to lowest): tools_list_full > agent_inferred > names_only.
function deriveServerConfidence(toolConfidences) {
  if (toolConfidences.length === 0) return null;
  if (toolConfidences.some((c) => !c || c === 'names_only')) return 'names_only';
  if (toolConfidences.some((c) => c === 'agent_inferred')) return 'agent_inferred';
  return 'tools_list_full';
}

export const InventoryRepository = {
  /**
   * Atomic replace. DELETE everything, INSERT the declared snapshot, in one
   * transaction. This is the only write path — there is intentionally no
   * `addTool` / `removeTool` affordance, because the whole point of the
   * primitive is that the latest declaration is authoritative.
   *
   * Pass `servers: [{ name, tools: [{ name, description? }, ...] }, ...]`.
   * Returns `{ replaced, inserted, declaredAt }`.
   */
  replaceInventory(servers) {
    if (!Array.isArray(servers)) {
      throw new Error('replaceInventory(servers) requires an array');
    }
    for (const s of servers) {
      if (!s || typeof s !== 'object') {
        throw new Error('every server entry must be an object');
      }
      if (!s.name || typeof s.name !== 'string' || !s.name.trim()) {
        throw new Error('server.name must be a non-empty string');
      }
      if (!Array.isArray(s.tools)) {
        throw new Error(`server '${s.name}' requires a tools array (use [] for empty)`);
      }
      for (const t of s.tools) {
        if (!t || typeof t !== 'object') {
          throw new Error(`every tool entry under server '${s.name}' must be an object`);
        }
        if (!t.name || typeof t.name !== 'string' || !t.name.trim()) {
          throw new Error(`every tool under server '${s.name}' requires a non-empty name`);
        }
        if (
          t.description !== undefined &&
          t.description !== null &&
          typeof t.description !== 'string'
        ) {
          throw new Error(
            `tool '${s.name}.${t.name}' description must be a string when provided`,
          );
        }
        // Optional richer fields for capability snapshots — backward-compatible.
        if (
          t.inputSchema !== undefined &&
          t.inputSchema !== null &&
          typeof t.inputSchema !== 'object'
        ) {
          throw new Error(
            `tool '${s.name}.${t.name}' inputSchema must be an object when provided`,
          );
        }
        if (
          t.introspectionConfidence !== undefined &&
          t.introspectionConfidence !== null &&
          !VALID_CONFIDENCE.has(t.introspectionConfidence)
        ) {
          throw new Error(
            `tool '${s.name}.${t.name}' introspectionConfidence must be one of: ${[...VALID_CONFIDENCE].join(', ')}`,
          );
        }
      }
    }

    const db = getDb();
    const declaredAt = Math.floor(Date.now() / 1000);

    const run = db.transaction(() => {
      const before = db.prepare('SELECT COUNT(*) AS n FROM meta_mcp_inventory').get().n;
      db.prepare('DELETE FROM meta_mcp_inventory').run();
      const insert = db.prepare(
        `INSERT INTO meta_mcp_inventory
           (server, tool_name, tool_ref, description, declared_at, input_schema_json, introspection_confidence, provider_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      let inserted = 0;
      // Per-server provider resolution. Canonicalize each server name once and
      // upsert the providers row, then stamp the resulting id on every tool
      // row for that server. Two install aliases that canonicalize to the
      // same provider_ref (e.g. "claude_ai_Notion" and "notion-mcp-server")
      // share the same provider_id, which is how the identity layer collapses
      // them into one logical "notion" provider.
      const providerIdByServer = new Map();
      for (const s of servers) {
        const serverName = s.name.trim();
        if (!providerIdByServer.has(serverName)) {
          const providerRef = canonicalizeServerName(serverName);
          const provider = ProvidersRepository.upsertByRef(providerRef);
          providerIdByServer.set(serverName, provider.id);
        }
        const providerId = providerIdByServer.get(serverName);
        for (const t of s.tools) {
          const toolName = t.name.trim();
          insert.run(
            serverName,
            toolName,
            toolRef(serverName, toolName),
            t.description ?? null,
            declaredAt,
            t.inputSchema ? JSON.stringify(t.inputSchema) : null,
            t.introspectionConfidence ?? null,
            providerId,
          );
          inserted += 1;
        }
      }
      return { replaced: before, inserted };
    });

    const { replaced, inserted } = run();
    return { replaced, inserted, declaredAt };
  },

  /**
   * Return the current inventory grouped by server, plus declaration metadata.
   * `declaredAt` is the most recent declared_at across all rows (all rows in a
   * single declaration share the same timestamp). `ageSeconds` is computed at
   * read time so callers can decide freshness without re-querying.
   *
   * Returns `{ servers: [{ name, tools: [...] }], declaredAt, ageSeconds, toolCount }`
   * or `{ servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 }` when
   * the inventory has never been declared.
   */
  currentInventory() {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM meta_mcp_inventory
         ORDER BY server ASC, tool_name ASC`,
      )
      .all();
    if (rows.length === 0) {
      return { servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 };
    }

    const byServer = new Map();
    let latestDeclaredAt = 0;
    for (const row of rows) {
      const tool = rowToTool(row);
      if (tool.declaredAt > latestDeclaredAt) latestDeclaredAt = tool.declaredAt;
      if (!byServer.has(tool.server)) byServer.set(tool.server, []);
      const entry = {
        name: tool.toolName,
        ref: tool.toolRef,
        description: tool.description,
      };
      if (tool.inputSchema !== null) entry.inputSchema = tool.inputSchema;
      if (tool.introspectionConfidence !== null) {
        entry.introspectionConfidence = tool.introspectionConfidence;
      }
      byServer.get(tool.server).push(entry);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    return {
      servers: Array.from(byServer.entries()).map(([name, tools]) => ({ name, tools })),
      declaredAt: latestDeclaredAt,
      ageSeconds: Math.max(0, nowSeconds - latestDeclaredAt),
      toolCount: rows.length,
    };
  },

  /** Single-row lookup by canonical `${server}.${tool}` ref. */
  findByRef(ref) {
    if (!ref || typeof ref !== 'string') return null;
    const db = getDb();
    const row = db.prepare('SELECT * FROM meta_mcp_inventory WHERE tool_ref = ?').get(ref);
    return rowToTool(row);
  },

  /** True iff at least one tool has ever been declared. */
  hasInventory() {
    const db = getDb();
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM meta_mcp_inventory').get();
    return n > 0;
  },

  /**
   * Return a capability snapshot for one server in the exact shape the
   * primitive-binding generator expects:
   *
   *   {
   *     server,
   *     introspected_at,            // ISO-8601 string (converted from unix seconds)
   *     introspection_confidence,   // derived per-server from tool labels
   *     tools: [{ name, description, inputSchema }, ...]
   *   }
   *
   * Returns null if the server is not in the current inventory.
   *
   * The conversion to ISO is deliberate — the generator stringifies the value
   * into the artifact body, and ISO is more readable in audit trails than
   * a unix timestamp. Internally the DB still stores unix seconds.
   */
  snapshotForServer(serverName) {
    if (!serverName || typeof serverName !== 'string') return null;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM meta_mcp_inventory
         WHERE server = ?
         ORDER BY tool_name ASC`,
      )
      .all(serverName);
    if (rows.length === 0) return null;

    const tools = rows.map((row) => {
      const tool = rowToTool(row);
      const entry = { name: tool.toolName };
      if (tool.description !== null) entry.description = tool.description;
      if (tool.inputSchema !== null) entry.inputSchema = tool.inputSchema;
      return entry;
    });

    const toolConfidences = rows.map((r) => r.introspection_confidence);
    const serverConfidence = deriveServerConfidence(toolConfidences);

    // All rows in a single declaration share declared_at; take any one.
    const declaredAtUnix = rows[0].declared_at;
    const introspected_at = new Date(declaredAtUnix * 1000).toISOString();

    return {
      server: serverName,
      introspected_at,
      introspection_confidence: serverConfidence,
      tools,
    };
  },
};

// Test seam — surface internals for unit testing.
export const _internals = {
  deriveServerConfidence,
  VALID_CONFIDENCE,
};
