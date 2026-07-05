import { getDb } from '../index.js';

/**
 * MCP tool-call telemetry repository.
 *
 * One row per handler invocation. The writer (lib/mcp/telemetry.js) records the
 * CALL, never the conversation — see the mcp_tool_calls table comment in
 * index.js and the invariants in lib/mcp/observability.plan.md. Percentiles are
 * computed in JS (SQLite has no native percentile), which is fine at the
 * single-operator, retention-capped scale of this table.
 */

function rowToCall(row) {
  if (!row) return null;
  return {
    id: row.id,
    tool: row.tool,
    via: row.via,
    sessionId: row.session_id || null,
    client: row.client_name ? { name: row.client_name, version: row.client_version || null } : null,
    startedAt: row.started_at,
    durationMs: row.duration_ms != null ? row.duration_ms : null,
    status: row.status,
    errorMessage: row.error_message || null,
    inputKeys: row.input_keys ? safeParse(row.input_keys, []) : [],
    inputBytes: row.input_bytes != null ? row.input_bytes : null,
    resultBytes: row.result_bytes != null ? row.result_bytes : null,
    inputJson: row.input_json || null,
    resultJson: row.result_json || null,
  };
}

function safeParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const frac = rank - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

export const McpToolCallRepository = {
  /**
   * Insert one telemetry row. Callers (telemetry.js) already wrap this in
   * try/catch so a write failure degrades to the stderr line — but keep the
   * SQL tolerant of nulls so it never throws on a well-formed row.
   */
  record(row) {
    const db = getDb();
    db.prepare(
      `INSERT INTO mcp_tool_calls
        (tool, via, session_id, client_name, client_version, started_at,
         duration_ms, status, error_message, input_keys, input_bytes,
         result_bytes, input_json, result_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.tool,
      row.via,
      row.sessionId ?? null,
      row.client?.name ?? null,
      row.client?.version ?? null,
      row.startedAt,
      row.durationMs ?? null,
      row.status,
      row.errorMessage ?? null,
      row.inputKeys ? JSON.stringify(row.inputKeys) : null,
      row.inputBytes ?? null,
      row.resultBytes ?? null,
      row.inputJson ?? null,
      row.resultJson ?? null
    );
  },

  /**
   * Most-recent calls, newest first. Optional { tool, status } filters.
   */
  recent({ limit = 50, tool, status } = {}) {
    const db = getDb();
    const clauses = [];
    const params = [];
    if (tool) {
      clauses.push('tool = ?');
      params.push(tool);
    }
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const capped = Math.max(1, Math.min(500, Math.round(limit)));
    const rows = db
      .prepare(`SELECT * FROM mcp_tool_calls ${where} ORDER BY id DESC LIMIT ?`)
      .all(...params, capped);
    return rows.map(rowToCall);
  },

  /**
   * Per-tool aggregates over the last `sinceDays` days:
   * { tool, calls, errors, errorRate, p50, p95, lastError, lastCalledAt }.
   * Timeouts and late_settle rows count as calls; only 'error' and 'timeout'
   * count toward errorRate (a late_settle that eventually succeeded does not).
   */
  aggregates({ sinceDays = 7 } = {}) {
    const db = getDb();
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    const rows = db
      .prepare(
        `SELECT tool, duration_ms, status, error_message, started_at
         FROM mcp_tool_calls
         WHERE started_at >= ?
         ORDER BY tool ASC, id ASC`
      )
      .all(cutoff);

    const byTool = new Map();
    for (const r of rows) {
      let agg = byTool.get(r.tool);
      if (!agg) {
        agg = { tool: r.tool, calls: 0, errors: 0, durations: [], lastError: null, lastCalledAt: 0 };
        byTool.set(r.tool, agg);
      }
      agg.calls += 1;
      if (r.status === 'error' || r.status === 'timeout') {
        agg.errors += 1;
        if (r.error_message) agg.lastError = r.error_message;
      }
      if (r.duration_ms != null) agg.durations.push(r.duration_ms);
      if (r.started_at > agg.lastCalledAt) agg.lastCalledAt = r.started_at;
    }

    return Array.from(byTool.values())
      .map((a) => {
        const sorted = a.durations.slice().sort((x, y) => x - y);
        return {
          tool: a.tool,
          calls: a.calls,
          errors: a.errors,
          errorRate: a.calls ? a.errors / a.calls : 0,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          lastError: a.lastError,
          lastCalledAt: a.lastCalledAt || null,
        };
      })
      .sort((a, b) => b.calls - a.calls);
  },
};
