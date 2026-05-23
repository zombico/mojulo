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

function rowToTool(row) {
  if (!row) return null;
  return {
    id: row.id,
    server: row.server,
    toolName: row.tool_name,
    toolRef: row.tool_ref,
    description: row.description,
    declaredAt: row.declared_at,
  };
}

function toolRef(server, toolName) {
  return `${server}.${toolName}`;
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
      }
    }

    const db = getDb();
    const declaredAt = Math.floor(Date.now() / 1000);

    const run = db.transaction(() => {
      const before = db.prepare('SELECT COUNT(*) AS n FROM meta_mcp_inventory').get().n;
      db.prepare('DELETE FROM meta_mcp_inventory').run();
      const insert = db.prepare(
        `INSERT INTO meta_mcp_inventory (server, tool_name, tool_ref, description, declared_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      let inserted = 0;
      for (const s of servers) {
        const serverName = s.name.trim();
        for (const t of s.tools) {
          const toolName = t.name.trim();
          insert.run(
            serverName,
            toolName,
            toolRef(serverName, toolName),
            t.description ?? null,
            declaredAt,
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
      byServer.get(tool.server).push({
        name: tool.toolName,
        ref: tool.toolRef,
        description: tool.description,
      });
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
};
