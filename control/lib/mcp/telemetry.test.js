// In-memory SQLite, isolated — must be set before any import that pulls in
// db/index.js. Same pattern as tools/context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDb, closeDb, pruneMcpToolCalls, MCP_TELEMETRY_MAX_ROWS } from '@/lib/db/index';
import { McpToolCallRepository } from '@/lib/db/repositories/mcpToolCalls';
import { rememberClientInfo, _resetClientBindingsForTests } from '@/lib/mcp/client-bindings';
import { instrumentedInvoke } from '@/lib/mcp/telemetry';
import { getToolTelemetryHandler } from '@/lib/mcp/tools/context';

// Silence the [mcp] stderr lines the seam emits during the run.
let errSpy;

beforeEach(() => {
  closeDb();
  _resetClientBindingsForTests();
  delete process.env.MOJULO_MCP_TELEMETRY;
  delete process.env.MOJULO_MCP_TELEMETRY_CAPTURE;
  delete process.env.MOJULO_MCP_TOOL_TIMEOUT_MS;
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errSpy?.mockRestore();
  vi.restoreAllMocks();
});

function allRows() {
  return getDb().prepare('SELECT * FROM mcp_tool_calls ORDER BY id ASC').all();
}

const okTool = { name: 'create_view', handler: async (input) => ({ ref: 'v1', echoedKeys: Object.keys(input) }) };
const boomTool = {
  name: 'compose_world',
  handler: async () => {
    throw new Error('kaboom in handler');
  },
};

describe('instrumentedInvoke — status rows', () => {
  it('records an ok row with shape + timing on success', async () => {
    const result = await instrumentedInvoke(okTool, { kind: 'derivative', expr: 'x^2' }, {}, { via: 'rpc' });
    expect(result.ref).toBe('v1');
    const rows = allRows();
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.tool).toBe('create_view');
    expect(r.via).toBe('rpc');
    expect(r.status).toBe('ok');
    expect(r.duration_ms).toBeGreaterThanOrEqual(0);
    // Input SHAPE only: key names, never values.
    expect(JSON.parse(r.input_keys)).toEqual(['kind', 'expr']);
    expect(r.input_bytes).toBeGreaterThan(0);
    expect(r.result_bytes).toBeGreaterThan(0);
    // No value capture by default.
    expect(r.input_json).toBeNull();
    expect(r.result_json).toBeNull();
  });

  it('records an error row and re-throws so callers keep their catch semantics', async () => {
    await expect(instrumentedInvoke(boomTool, {}, {}, { via: 'rpc' })).rejects.toThrow('kaboom in handler');
    const rows = allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('error');
    expect(rows[0].error_message).toContain('kaboom');
  });

  it('records the CALLED (alias) name, not the canonical target', async () => {
    // A deprecated alias resolves to a tool whose .name is the canonical name;
    // telemetry must record the name as called.
    await instrumentedInvoke(okTool, {}, {}, { via: 'rpc', name: 'derivative_view' });
    expect(allRows()[0].tool).toBe('derivative_view');
  });

  it('records client info from the session binding', async () => {
    rememberClientInfo('sess-1', { name: 'claude-code', version: '9.9.9' });
    await instrumentedInvoke(okTool, {}, { mcpSessionId: 'sess-1' }, { via: 'rpc' });
    const r = allRows()[0];
    expect(r.session_id).toBe('sess-1');
    expect(r.client_name).toBe('claude-code');
    expect(r.client_version).toBe('9.9.9');
  });

  it('soft-timeout: throws a budget error, records timeout, then records late_settle when the handler finishes', async () => {
    let resolveLate;
    const slowTool = {
      name: 'stitch_motion',
      timeoutMs: 20,
      handler: () => new Promise((res) => { resolveLate = () => res({ frames: 3 }); }),
    };
    await expect(instrumentedInvoke(slowTool, {}, {}, { via: 'rpc' })).rejects.toThrow(/exceeded its 20ms budget/);
    // The timeout row lands synchronously with the throw.
    let rows = allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('timeout');

    // Let the orphaned handler settle → late_settle row with the real outcome.
    resolveLate();
    await new Promise((r) => setTimeout(r, 5));
    rows = allRows();
    expect(rows).toHaveLength(2);
    expect(rows[1].status).toBe('late_settle');
    expect(rows[1].result_bytes).toBeGreaterThan(0);
  });

  it('per-tool timeoutMs overrides the global budget', async () => {
    // A generous per-tool budget lets a moderately slow handler complete ok.
    process.env.MOJULO_MCP_TOOL_TIMEOUT_MS = '10';
    const slowishTool = {
      name: 'forge_motion',
      timeoutMs: 200,
      handler: () => new Promise((res) => setTimeout(() => res('done'), 25)),
    };
    const out = await instrumentedInvoke(slowishTool, {}, {}, { via: 'rpc' });
    expect(out).toBe('done');
    expect(allRows()[0].status).toBe('ok');
  });
});

describe('instrumentedInvoke — config flags', () => {
  it('MOJULO_MCP_TELEMETRY=off writes nothing and still returns the result', async () => {
    process.env.MOJULO_MCP_TELEMETRY = 'off';
    const out = await instrumentedInvoke(okTool, { a: 1 }, {}, { via: 'rpc' });
    expect(out.ref).toBe('v1');
    expect(allRows()).toHaveLength(0);
  });

  it('capture flag OFF ⇒ input_json / result_json stay null even for rich inputs', async () => {
    await instrumentedInvoke(okTool, { secret: 'pasted document text', more: [1, 2, 3] }, {}, { via: 'rpc' });
    const r = allRows()[0];
    expect(r.input_json).toBeNull();
    expect(r.result_json).toBeNull();
    // But the shape is still there.
    expect(JSON.parse(r.input_keys)).toEqual(['secret', 'more']);
  });

  it('capture flag=full ⇒ truncated input/result JSON is stored', async () => {
    process.env.MOJULO_MCP_TELEMETRY_CAPTURE = 'full';
    await instrumentedInvoke(okTool, { a: 1 }, {}, { via: 'rpc' });
    const r = allRows()[0];
    expect(r.input_json).toContain('"a":1');
    expect(r.result_json).toContain('v1');
  });

  it('a telemetry write failure never breaks the tool call', async () => {
    vi.spyOn(McpToolCallRepository, 'record').mockImplementation(() => {
      throw new Error('disk full');
    });
    const out = await instrumentedInvoke(okTool, {}, {}, { via: 'rpc' });
    expect(out.ref).toBe('v1'); // call succeeded despite the write throwing
    expect(allRows()).toHaveLength(0);
  });
});

describe('McpToolCallRepository — aggregates + recent', () => {
  beforeEach(() => {
    const now = Date.now();
    const seed = [
      { tool: 'a', via: 'rpc', startedAt: now - 1000, durationMs: 10, status: 'ok' },
      { tool: 'a', via: 'rpc', startedAt: now - 900, durationMs: 30, status: 'ok' },
      { tool: 'a', via: 'rpc', startedAt: now - 800, durationMs: 50, status: 'error', errorMessage: 'boom a' },
      { tool: 'b', via: 'plan-executor', startedAt: now - 700, durationMs: 5, status: 'ok' },
    ];
    for (const s of seed) McpToolCallRepository.record(s);
  });

  it('computes per-tool calls, error rate, p50/p95, lastError', () => {
    const agg = McpToolCallRepository.aggregates({ sinceDays: 7 });
    const a = agg.find((x) => x.tool === 'a');
    expect(a.calls).toBe(3);
    expect(a.errors).toBe(1);
    expect(a.errorRate).toBeCloseTo(1 / 3, 5);
    expect(a.p50).toBe(30); // median of [10,30,50]
    expect(a.lastError).toBe('boom a');
    // Sorted by call volume descending — 'a' (3) before 'b' (1).
    expect(agg[0].tool).toBe('a');
  });

  it('recent() honours tool + status filters, newest first', () => {
    const errs = McpToolCallRepository.recent({ status: 'error' });
    expect(errs).toHaveLength(1);
    expect(errs[0].tool).toBe('a');
    const bcalls = McpToolCallRepository.recent({ tool: 'b' });
    expect(bcalls).toHaveLength(1);
    expect(bcalls[0].via).toBe('plan-executor');
  });
});

describe('get_tool_telemetry — drawer handler shape', () => {
  it('no-args → aggregate summary text with the per-tool table + recent errors', async () => {
    const now = Date.now();
    McpToolCallRepository.record({ tool: 'create_view', via: 'rpc', startedAt: now, durationMs: 12, status: 'ok' });
    McpToolCallRepository.record({ tool: 'compose_world', via: 'rpc', startedAt: now, durationMs: 40, status: 'error', errorMessage: 'bad geometry' });
    const { content } = await getToolTelemetryHandler({});
    const text = content[0].text;
    expect(text).toMatch(/MCP tool telemetry/);
    expect(text).toContain('`create_view`');
    expect(text).toContain('Recent errors');
    expect(text).toContain('bad geometry');
  });

  it('{ tool } → that tool\'s recent calls', async () => {
    const now = Date.now();
    McpToolCallRepository.record({ tool: 'create_view', via: 'rpc', startedAt: now, durationMs: 7, status: 'ok' });
    const { content } = await getToolTelemetryHandler({ tool: 'create_view' });
    expect(content[0].text).toMatch(/`create_view` — last 1 calls/);
  });

  it('empty state names the telemetry flag', async () => {
    const { content } = await getToolTelemetryHandler({});
    expect(content[0].text).toMatch(/No MCP tool calls recorded/);
  });
});

describe('pruneMcpToolCalls — retention caps', () => {
  it('drops rows older than the age cap', () => {
    const now = Date.now();
    const old = now - 40 * 24 * 60 * 60 * 1000; // 40 days > 30d cap
    McpToolCallRepository.record({ tool: 'old', via: 'rpc', startedAt: old, status: 'ok' });
    McpToolCallRepository.record({ tool: 'fresh', via: 'rpc', startedAt: now, status: 'ok' });
    const deleted = pruneMcpToolCalls(getDb());
    expect(deleted).toBe(1);
    const remaining = allRows().map((r) => r.tool);
    expect(remaining).toEqual(['fresh']);
  });

  it('trims to the row cap by dropping the oldest ids', () => {
    const now = Date.now();
    const total = MCP_TELEMETRY_MAX_ROWS + 5;
    const insert = getDb().prepare(
      'INSERT INTO mcp_tool_calls (tool, via, started_at, status) VALUES (?, ?, ?, ?)'
    );
    const tx = getDb().transaction(() => {
      for (let i = 0; i < total; i++) insert.run('t', 'rpc', now, 'ok');
    });
    tx();
    const deleted = pruneMcpToolCalls(getDb());
    expect(deleted).toBe(5);
    const count = getDb().prepare('SELECT COUNT(*) c FROM mcp_tool_calls').get().c;
    expect(count).toBe(MCP_TELEMETRY_MAX_ROWS);
  });
});

describe('handler-attached outcome signals (orientation-ramp R4)', () => {
  const signalTool = {
    name: 'semantic_search',
    handler: async () => ({
      results: [{ score: 0.12 }],
      _telemetrySignal: { result_count: 1, top_score: 0.12, kinds: ['view_vocab'] },
    }),
  };

  it('persists the sanitized signal to signal_json and STRIPS the key from the result', async () => {
    const result = await instrumentedInvoke(signalTool, { query: 'x' }, {}, { via: 'rpc' });
    expect('_telemetrySignal' in result).toBe(false);
    const row = allRows()[0];
    const signal = JSON.parse(row.signal_json);
    expect(signal).toEqual({ result_count: 1, top_score: 0.12, kinds: ['view_vocab'] });
  });

  it('strips the key even when telemetry is off (never reaches the wire)', async () => {
    process.env.MOJULO_MCP_TELEMETRY = 'off';
    const result = await instrumentedInvoke(signalTool, { query: 'x' }, {}, { via: 'rpc' });
    expect('_telemetrySignal' in result).toBe(false);
    expect(allRows()).toEqual([]);
  });

  it('sanitizer drops nested objects and long strings — shapes only, mechanically', async () => {
    const sneaky = {
      name: 'semantic_search',
      handler: async () => ({
        ok: true,
        _telemetrySignal: {
          n: 3,
          nested: { leak: 'user text' },
          long: 'y'.repeat(500),
          list: ['a', { deep: true }, 2],
        },
      }),
    };
    await instrumentedInvoke(sneaky, {}, {}, { via: 'rpc' });
    const signal = JSON.parse(allRows()[0].signal_json);
    expect(signal.nested).toBeUndefined();
    expect(signal.long.length).toBeLessThanOrEqual(64);
    expect(signal.list).toEqual(['a', 2]);
    expect(signal.n).toBe(3);
  });
});

describe('McpToolCallRepository.orientationGaps — the dead-end-clue cut', () => {
  const ORIENT = ['forward_context', 'get_tool_index'];

  function record({ tool, sessionId = null, status = 'ok', signal = null, errorMessage = null, at = Date.now() }) {
    McpToolCallRepository.record({
      tool,
      via: 'rpc',
      sessionId,
      startedAt: at,
      status,
      errorMessage,
      signalJson: signal ? JSON.stringify(signal) : null,
    });
  }

  it('flags weak + empty searches, signal-based and error-based drawer misses', () => {
    record({ tool: 'semantic_search', signal: { result_count: 0 } });
    record({ tool: 'semantic_search', signal: { result_count: 3, top_score: 0.1 } });
    record({ tool: 'semantic_search', signal: { result_count: 5, top_score: 0.9 } }); // healthy
    record({ tool: 'get_worked_example', signal: { id_requested: true, found: false } });
    record({ tool: 'get_view_vocab', status: 'error', errorMessage: "get_view_vocab: unknown card 'flying-spaghetti'" });
    record({ tool: 'get_view_vocab', status: 'error', errorMessage: 'something else broke' }); // not a miss

    const gaps = McpToolCallRepository.orientationGaps({ orientationTools: ORIENT });
    expect(gaps.lowScoreSearches).toHaveLength(2);
    expect(gaps.drawerMisses.map((m) => m.tool)).toEqual(['get_worked_example', 'get_view_vocab']);
  });

  it('abandonment: oriented-then-nothing sessions counted; oriented-then-acted sessions are not', () => {
    record({ tool: 'forward_context', sessionId: 'abandoned' });
    record({ tool: 'get_tool_index', sessionId: 'abandoned' }); // more orientation ≠ following through
    record({ tool: 'forward_context', sessionId: 'productive' });
    record({ tool: 'create_sketch', sessionId: 'productive' });
    record({ tool: 'create_view', sessionId: 'never-oriented' });

    const gaps = McpToolCallRepository.orientationGaps({ orientationTools: ORIENT });
    expect(gaps.sessions).toEqual({ total: 3, oriented: 2, abandoned: 1 });
  });

  it('get_tool_telemetry { orientation: true } renders the cut', async () => {
    record({ tool: 'semantic_search', signal: { result_count: 0 }, sessionId: 's1' });
    record({ tool: 'forward_context', sessionId: 's1' });
    const { content } = await getToolTelemetryHandler({ orientation: true });
    const text = content[0].text;
    expect(text).toContain('Orientation gaps');
    expect(text).toContain('Weak searches');
    expect(text).toContain('oriented');
  });
});
