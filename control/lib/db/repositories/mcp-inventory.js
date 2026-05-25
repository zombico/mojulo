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
import {
  EmbeddingsRepository,
  composeMcpToolRef,
  composeMcpToolBody,
} from './embeddings.js';

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

function validateServers(servers) {
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
}

// Synchronous write — the actual delete-and-reinsert dance, optionally
// paired with the embedding sidecar (the async `replaceInventoryWithEmbeddings`
// wrapper pre-embeds and passes the prepared vectors in).
function replaceInventoryInternal(servers, toolEmbeddings) {
  validateServers(servers);
  const db = getDb();
  const declaredAt = Math.floor(Date.now() / 1000);

  const hasEmbeddings = Array.isArray(toolEmbeddings) && toolEmbeddings.length > 0;

  const run = db.transaction(() => {
    const before = db.prepare('SELECT COUNT(*) AS n FROM meta_mcp_inventory').get().n;
    db.prepare('DELETE FROM meta_mcp_inventory').run();
    if (hasEmbeddings) {
      // Inventory replace is whole-environment; mirror that on the sidecar
      // so we don't carry orphan rows for servers the operator removed.
      db.prepare("DELETE FROM meta_embeddings WHERE source_kind = 'mcp_tool'").run();
    }
    const insert = db.prepare(
      `INSERT INTO meta_mcp_inventory
         (server, tool_name, tool_ref, description, declared_at, input_schema_json, introspection_confidence, provider_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let inserted = 0;
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
    // Sidecar upsert for every (server, tool) we just inserted. Soft on
    // missing vector (embed failure) — the inventory row still commits,
    // recall degrades for that one tool until the next reindex.
    if (hasEmbeddings) {
      for (const e of toolEmbeddings) {
        EmbeddingsRepository.upsertSync({
          sourceKind: e.sourceKind,
          sourceRef: e.sourceRef,
          bodyText: e.bodyText,
          hash: e.hash,
          vector: e.vector,
        });
      }
    }
    return { replaced: before, inserted };
  });

  const { replaced, inserted } = run();
  return { replaced, inserted, declaredAt };
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
   *
   * SYNC. The semantic-index sidecar's write happens via
   * `replaceInventoryWithEmbeddings` below, which pre-embeds asynchronously
   * before calling into this sync writer with the prepared vectors. Tests
   * that don't exercise the embedding path keep using this entry point
   * unchanged.
   */
  replaceInventory(servers) {
    return replaceInventoryInternal(servers, []);
  },

  /**
   * Embedding-aware variant. Pre-embeds every tool's body BEFORE opening
   * the sync txn so the sidecar rows commit / roll back atomically with
   * the inventory rows. Falls back to the bare write when
   * MOJULO_SEMANTIC_INDEX_DISABLED=1.
   *
   * better-sqlite3's db.transaction(fn) requires fn to be synchronous; the
   * embedding model is async. The split lets the async work happen up
   * front, then the txn body is pure sync writes (inventory + sidecar).
   * The inventory side wipes every prior `mcp_tool` embedding row inside
   * the txn (orphans for servers removed since last declare get cleared
   * along with the inventory rows), so the embed runs in
   * `skipUnchanged: false` mode — a hash-skip would lose the vector.
   */
  async replaceInventoryWithEmbeddings(servers) {
    validateServers(servers);
    let toolEmbeddings = [];
    if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED !== '1') {
      const items = [];
      for (const s of servers) {
        const serverName = s.name.trim();
        for (const t of s.tools) {
          const toolName = t.name.trim();
          items.push({
            sourceKind: 'mcp_tool',
            sourceRef: composeMcpToolRef(serverName, toolName),
            bodyText: composeMcpToolBody({
              server: serverName,
              toolName,
              description: t.description,
            }),
          });
        }
      }
      toolEmbeddings = await EmbeddingsRepository.embedMany(items, {
        skipUnchanged: false,
      });
    }
    return replaceInventoryInternal(servers, toolEmbeddings);
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
