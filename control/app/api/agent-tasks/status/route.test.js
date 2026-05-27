// Integration tests for the /api/agent-tasks/status endpoint. The
// endpoint is the spike-time "Phase 1.5" status surface: a single-line
// plain-text snapshot the operator's terminal can poll, plus a JSON
// variant for richer consumption.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import {
  parkRequest,
  pullNext,
  deliverResult,
  cancel,
  _internals as queueInternals,
} from '@/lib/mcp/agent-tasks/queue';
import {
  registerAdapter,
  _internals as adapterInternals,
} from '@/lib/runtime-adapters';
import {
  startNodeFulfiller,
  stopNodeFulfiller,
} from '@/lib/agent-tasks/node-fulfiller';
import { GET } from './route.js';

function reqFor(format) {
  const url = format
    ? `http://localhost/api/agent-tasks/status?format=${format}`
    : 'http://localhost/api/agent-tasks/status';
  return new Request(url, { method: 'GET' });
}

beforeEach(async () => {
  closeDb();
  queueInternals._resetForTests();
  adapterInternals._clearForTests();
  delete process.env.MOJULO_AGENT_RUNTIME;
});

afterEach(async () => {
  delete process.env.MOJULO_AGENT_RUNTIME;
  await stopNodeFulfiller();
});

describe('text format (default)', () => {
  it('reports idle when nothing is happening', async () => {
    const res = await GET(reqFor());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/^mojulo: idle$/);
  });

  it('reports in-flight + queued counts when work is parked', async () => {
    const a = parkRequest({ inputs: { text: 'a' } });
    a.catch(() => {});
    const b = parkRequest({ inputs: { text: 'b' } });
    b.catch(() => {});
    const pulled = await pullNext({ waitMs: 50 });

    const res = await GET(reqFor());
    const body = await res.text();
    expect(body).toMatch(/1 in-flight/);
    expect(body).toMatch(/1 queued/);

    // Cleanup — cancel the in-flight one; the still-pending `b` will be
    // drained by `_resetForTests` in the next beforeEach (resolves silently
    // so no unhandled rejection).
    cancel(pulled.id, 'cleanup');
    await expect(a).rejects.toThrow();
  });

  it('reports the last delivered event with fulfiller label', async () => {
    const parked = parkRequest({ inputs: { text: 'x' } });
    const pulled = await pullNext({ waitMs: 50 });
    deliverResult(pulled.id, { answer: 'ok' }, {
      fulfiller: { kind: 'node-driven-runtime', runtime: 'fake' },
      model: 'fake-1',
    });
    await parked;
    const res = await GET(reqFor());
    const body = await res.text();
    expect(body).toMatch(/✓ delivered/);
    expect(body).toMatch(/node/);
  });
});

describe('JSON format', () => {
  it('returns structured stats + recentEvents array', async () => {
    const res = await GET(reqFor('json'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const json = await res.json();
    expect(json).toHaveProperty('pendingCount');
    expect(json).toHaveProperty('inFlightCount');
    expect(json).toHaveProperty('idle');
    expect(json).toHaveProperty('fulfiller');
    expect(json).toHaveProperty('recentEvents');
    expect(Array.isArray(json.recentEvents)).toBe(true);
  });

  it('surfaces the last event after a delivery', async () => {
    const parked = parkRequest({ inputs: { text: 'x' } });
    const pulled = await pullNext({ waitMs: 50 });
    deliverResult(pulled.id, { answer: 'a' }, { fulfiller: { kind: 'agent-mcp' } });
    await parked;
    const res = await GET(reqFor('json'));
    const json = await res.json();
    expect(json.lastEvent).not.toBeNull();
    expect(json.lastEvent.kind).toBe('delivered');
    expect(json.lastEvent.fulfiller.kind).toBe('agent-mcp');
  });
});

describe('fulfiller prefix in text mode', () => {
  it('annotates the line with [runtime] when the Node fulfiller is running', async () => {
    const fake = {
      id: 'fake-prefix',
      capabilities: { vision: false, streaming: false },
      supportedKinds: ['envelope_inference'],
      invoke: async () => ({ envelope: { answer: 'x' }, model: 'm' }),
    };
    registerAdapter(fake);
    process.env.MOJULO_AGENT_RUNTIME = 'fake-prefix';
    startNodeFulfiller({ pullWaitMs: 50 });

    const res = await GET(reqFor());
    const body = await res.text();
    expect(body).toMatch(/mojulo\[fake-prefix\]:/);
  });
});
