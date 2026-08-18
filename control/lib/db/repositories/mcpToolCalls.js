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

// Drawer-miss detection contract, shared with the convention sweep in
// lib/mcp/tools/drawer-signals.test.js: a drawer tool that rejects an unknown
// id must either attach a soft-miss signal ({ id_requested: true, found:
// false }) or throw an error whose message matches DRAWER_MISS_ERROR_RE —
// otherwise the miss is invisible to the orientation cut below.
export const DRAWER_TOOL_RE = /^get_.*_vocab$|^get_creative_toolset$/;
export const DRAWER_MISS_ERROR_RE = /unknown (card|id|form)/i;

// One weak-search threshold for BOTH consumers (routing-context-weaving.plan.md
// C1): the orientation cut counts a search below it as a gap, and the
// semantic_search tool decorates the same searches with an in-band hint —
// telemetry and the agent-facing nudge must never disagree about what "weak"
// means.
export const WEAK_SEARCH_TOP_SCORE = 0.35;

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
    signal: row.signal_json ? safeParse(row.signal_json, null) : null,
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
         result_bytes, input_json, result_json, signal_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      row.resultJson ?? null,
      row.signalJson ?? null
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

  /**
   * The orientation-gap cut (orientation-ramp.plan.md R4; first-hop cut from
   * routing-context-weaving.plan.md thread A): the moments the ask-and-discover
   * loop failed to reward the question. Four signals:
   *
   *  - lowScoreSearches — semantic_search calls whose attached signal shows an
   *    empty result set or a weak top score (the coined term didn't retrieve).
   *  - drawerMisses — vocab/worked-example drawer calls whose signal recorded
   *    { found: false } (an id was asked for that doesn't exist).
   *  - abandonment — sessions that called an orientation tool and then made NO
   *    non-orientation call afterward (oriented, then went nowhere). Derived
   *    at read time from existing rows; nothing extra is captured for it.
   *  - firstHops — for each routing read (forward_context, labeled by its
   *    signal's mode, and semantic_search calls whose signal kinds include
   *    'routing'), the NEXT non-orientation tool called in the same session.
   *    A read the session never followed with a non-orientation call counts
   *    with tool: null. Derived at read time, id-ordered; this is what makes
   *    "routing rows that never route" answerable (orientation-diet's parked
   *    pruning step).
   *
   * `orientationTools` is passed in by the caller — ring membership is Ring-0
   * knowledge (context.js), not a repository concern.
   */
  orientationGaps({
    sinceDays = 7,
    orientationTools = [],
    lowScoreThreshold = WEAK_SEARCH_TOP_SCORE,
  } = {}) {
    const db = getDb();
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    const rows = db
      .prepare(
        `SELECT tool, session_id, started_at, status, error_message, signal_json
         FROM mcp_tool_calls
         WHERE started_at >= ?
         ORDER BY id ASC`
      )
      .all(cutoff);

    const orientationSet = new Set(orientationTools);
    const lowScoreSearches = [];
    const drawerMisses = [];
    const sessions = new Map(); // session_id → { oriented: bool, followed: bool }
    const pendingReads = new Map(); // session_id → [label, …] routing reads awaiting their first hop
    const hopCounts = new Map(); // `${after}\n${tool}` → count (tool '' = never followed)

    const bumpHop = (after, tool) => {
      const key = `${after}\n${tool ?? ''}`;
      hopCounts.set(key, (hopCounts.get(key) || 0) + 1);
    };

    for (const r of rows) {
      const signal = r.signal_json ? safeParse(r.signal_json, null) : null;

      if (r.tool === 'semantic_search' && signal) {
        const empty = signal.result_count === 0;
        const weak =
          typeof signal.top_score === 'number' && signal.top_score < lowScoreThreshold;
        if (empty || weak) {
          lowScoreSearches.push({ startedAt: r.started_at, sessionId: r.session_id, signal });
        }
      }

      // A drawer miss arrives two ways: a signal-carrying soft miss
      // ({ id_requested, found: false }) or a drawer that throws on an unknown
      // id (error row whose message names the unknown card/id/form).
      if (
        (signal && signal.id_requested === true && signal.found === false) ||
        (r.status === 'error' &&
          DRAWER_TOOL_RE.test(r.tool) &&
          DRAWER_MISS_ERROR_RE.test(r.error_message || ''))
      ) {
        drawerMisses.push({ tool: r.tool, startedAt: r.started_at, sessionId: r.session_id });
      }

      if (r.session_id) {
        let s = sessions.get(r.session_id);
        if (!s) {
          s = { oriented: false, followed: false };
          sessions.set(r.session_id, s);
        }
        if (orientationSet.has(r.tool)) s.oriented = true;
        else if (s.oriented) s.followed = true;

        // First-hop attribution. A non-orientation call settles EVERY pending
        // routing read in its session (settle BEFORE this row can open its own
        // pending read, so forward_context → semantic_search[routing] → mint
        // attributes both edges). Status is ignored on purpose: a failed hop
        // still shows where the routing sent the agent.
        const pending = pendingReads.get(r.session_id);
        if (pending && pending.length && !orientationSet.has(r.tool)) {
          for (const after of pending) bumpHop(after, r.tool);
          pending.length = 0;
        }
        if (r.tool === 'forward_context') {
          // Legacy rows predate the mode signal (A1) — default to office,
          // matching the handler's own default.
          const mode = signal && typeof signal.mode === 'string' ? signal.mode : 'office';
          const list = pendingReads.get(r.session_id) || [];
          list.push(`forward_context[${mode}]`);
          pendingReads.set(r.session_id, list);
        } else if (
          r.tool === 'semantic_search' &&
          signal &&
          Array.isArray(signal.kinds) &&
          signal.kinds.includes('routing')
        ) {
          const list = pendingReads.get(r.session_id) || [];
          list.push('semantic_search[routing]');
          pendingReads.set(r.session_id, list);
        }
      }
    }

    // Routing reads never followed by a non-orientation call → tool: null.
    for (const pending of pendingReads.values()) {
      for (const after of pending) bumpHop(after, null);
    }
    const firstHops = [...hopCounts.entries()]
      .map(([key, count]) => {
        const [after, tool] = key.split('\n');
        return { after, tool: tool || null, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);

    const orientedSessions = [...sessions.values()].filter((s) => s.oriented);
    const abandonedSessions = orientedSessions.filter((s) => !s.followed);

    return {
      sinceDays,
      lowScoreSearches: lowScoreSearches.slice(-25),
      drawerMisses: drawerMisses.slice(-25),
      firstHops,
      sessions: {
        total: sessions.size,
        oriented: orientedSessions.length,
        abandoned: abandonedSessions.length,
      },
    };
  },
};
