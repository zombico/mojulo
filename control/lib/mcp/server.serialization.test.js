// Isolate to in-memory SQLite before any import that pulls db/index.js —
// same pattern as context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { registerTool, dispatchMcpRequest } from '@/lib/mcp/server';

// The single-writer execution queue (runSerialized): agent harnesses batch
// independent tool calls in parallel — the 0813 first-contact probe wedged the
// plane with three parallel submit_image_render calls. These tests pin the
// guard: parallel tools/call executions serialize FIFO by default, a throwing
// call doesn't jam the chain, and `concurrent: true` (the long-polls) bypasses.

const call = (name, id) =>
  dispatchMcpRequest(
    { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: {} } },
    { mcpSessionId: 'serialization-test', userId: 'local' },
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('tools/call single-writer queue', () => {
  it('serializes parallel tool calls by default (no interleaving)', async () => {
    const log = [];
    registerTool({
      name: 'test_serial_slow',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => {
        log.push('slow:enter');
        await sleep(40);
        log.push('slow:exit');
        return { ok: true };
      },
    });
    registerTool({
      name: 'test_serial_fast',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => {
        log.push('fast:enter');
        log.push('fast:exit');
        return { ok: true };
      },
    });
    await Promise.all([call('test_serial_slow', 1), call('test_serial_fast', 2)]);
    // Without the queue, fast would enter (and exit) during slow's 40ms await.
    expect(log).toEqual(['slow:enter', 'slow:exit', 'fast:enter', 'fast:exit']);
  });

  it('a throwing call does not jam the queue', async () => {
    registerTool({
      name: 'test_serial_thrower',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => {
        throw new Error('boom');
      },
    });
    registerTool({
      name: 'test_serial_after',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => ({ ok: true }),
    });
    const [errResp, okResp] = await Promise.all([
      call('test_serial_thrower', 3),
      call('test_serial_after', 4),
    ]);
    // Tool failure surfaces as isError per MCP spec; the next queued call runs.
    expect(errResp.result.isError).toBe(true);
    expect(okResp.result.isError).toBeFalsy();
  });

  it('concurrent:true (long-poll shape) bypasses the queue', async () => {
    const log = [];
    registerTool({
      name: 'test_long_poll',
      listed: false,
      inputSchema: { type: 'object' },
      concurrent: true,
      handler: async () => {
        log.push('poll:enter');
        await sleep(60);
        log.push('poll:exit');
        return { ok: true };
      },
    });
    registerTool({
      name: 'test_write_behind_poll',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => {
        log.push('write');
        return { ok: true };
      },
    });
    await Promise.all([call('test_long_poll', 5), call('test_write_behind_poll', 6)]);
    // The write must complete while the long-poll is still parked — a queued
    // long-poll would force `write` after `poll:exit`.
    expect(log.indexOf('write')).toBeLessThan(log.indexOf('poll:exit'));
  });
});

// remote-worker exports P4: a tool that returns `_structured` beside its body gets it on the
// wire as `structuredContent`; the text block never carries the field. A tool without it is
// byte-identical to before.
describe('tools/call structuredContent', () => {
  it('`_structured: true` ships the WHOLE body as structuredContent (Claude Code renders it in place of the text)', async () => {
    registerTool({
      name: 'test_structured_plain',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => ({ ok: true, path: '/x/world.html', handoff: { next: 'publish it' }, _structured: true }),
    });
    const res = await call('test_structured_plain', 501);
    const body = { ok: true, path: '/x/world.html', handoff: { next: 'publish it' } };
    expect(res.result.structuredContent).toEqual(body);
    expect(res.result.content).toEqual([{ type: 'text', text: JSON.stringify(body, null, 2) }]);
  });

  it('an explicit `_structured` object is used as given', async () => {
    registerTool({
      name: 'test_structured_object',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => ({ ok: true, big: 'x'.repeat(50), _structured: { small: 1 } }),
    });
    const res = await call('test_structured_object', 504);
    expect(res.result.structuredContent).toEqual({ small: 1 });
    expect(res.result.content[0].text).not.toMatch(/_structured/);
  });

  it('a host with a result byte cap (grok-build: 20 KB) gets no structuredContent at all', async () => {
    const { rememberClientInfo, _resetClientBindingsForTests } = await import('@/lib/mcp/client-bindings');
    rememberClientInfo('serialization-capped', { name: 'grok-build', version: '1' });
    registerTool({ name: 'test_structured_capped', listed: false, inputSchema: { type: 'object' }, handler: async () => ({ ok: true, _structured: true }) });
    try {
      const res = await dispatchMcpRequest(
        { jsonrpc: '2.0', id: 505, method: 'tools/call', params: { name: 'test_structured_capped', arguments: {} } },
        { mcpSessionId: 'serialization-capped', userId: 'local' },
      );
      expect(res.result).toEqual({ content: [{ type: 'text', text: JSON.stringify({ ok: true }, null, 2) }] });
    } finally {
      _resetClientBindingsForTests();
    }
  });

  it('lifts `_structured` out of an already MCP-shaped result (the agent-tasks shape)', async () => {
    registerTool({
      name: 'test_structured_shaped',
      listed: false,
      inputSchema: { type: 'object' },
      handler: async () => ({ content: [{ type: 'text', text: 'hi' }], _structured: { a: 1 } }),
    });
    const res = await call('test_structured_shaped', 502);
    expect(res.result).toEqual({ content: [{ type: 'text', text: 'hi' }], structuredContent: { a: 1 } });
  });

  it('a result without `_structured` is unchanged', async () => {
    registerTool({ name: 'test_structured_none', listed: false, inputSchema: { type: 'object' }, handler: async () => ({ ok: true }) });
    const res = await call('test_structured_none', 503);
    expect(res.result).toEqual({ content: [{ type: 'text', text: JSON.stringify({ ok: true }, null, 2) }] });
    expect(res.result).not.toHaveProperty('structuredContent');
  });
});
