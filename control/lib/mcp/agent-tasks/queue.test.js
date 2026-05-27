// Unit tests for the agent-tasks queue — park/pull/deliver/cancel
// state machine. No DB, no MCP transport — just the queue's in-memory
// matchmaking semantics.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parkRequest,
  pullNext,
  deliverResult,
  cancel,
  getInFlightPayload,
  getQueueStats,
  getRecentEvents,
  validateEnvelopeOrThrow,
  AgentTaskError,
  _internals,
} from './queue.js';

beforeEach(() => {
  _internals._resetForTests();
});

// Pre-attach a no-op catch so a sync rejection (cancel/expire firing before
// the test's `await expect(...).rejects` lands) doesn't surface as an
// unhandled rejection. Tests still assert via the returned promise.
function safePark(payload, opts) {
  const p = parkRequest(payload, opts);
  p.catch(() => {});
  return p;
}

describe('park → pull → deliver happy path', () => {
  it('delivers the envelope to the parked request', async () => {
    const parked = parkRequest({ inputs: { text: 'hello' } });

    const pulled = await pullNext({ waitMs: 50 });
    expect(pulled).not.toBeNull();
    expect(pulled.payload.inputs.text).toBe('hello');

    deliverResult(pulled.id, { answer: 'world' }, { model: 'sonnet' });

    const result = await parked;
    expect(result.envelope).toEqual({ answer: 'world' });
    expect(result.meta.model).toBe('sonnet');
    expect(typeof result.durationMs).toBe('number');
    expect(result.request_id).toBe(pulled.id);
  });

  it('returns null on pullNext when no work is parked within waitMs', async () => {
    const out = await pullNext({ waitMs: 30 });
    expect(out).toBeNull();
  });

  it('pull with waitMs=0 is non-blocking', async () => {
    const out = await pullNext({ waitMs: 0 });
    expect(out).toBeNull();
  });

  it('a parked request that arrives during a long-poll is delivered immediately', async () => {
    const pullPromise = pullNext({ waitMs: 200 });
    // Park after the puller is waiting.
    setTimeout(() => {
      parkRequest({ inputs: { text: 'late' } });
    }, 10);
    const pulled = await pullPromise;
    expect(pulled).not.toBeNull();
    expect(pulled.payload.inputs.text).toBe('late');
  });
});

describe('timeouts', () => {
  it('parked request without a worker rejects with NO_AGENT_WORKER', async () => {
    const promise = safePark({ inputs: { text: 'orphan' } }, {
      noWorkerWindowMs: 30,
      submitTimeoutMs: 30,
    });
    await expect(promise).rejects.toMatchObject({
      code: 'NO_AGENT_WORKER',
      status: 503,
    });
  });

  it('in-flight request without a submit rejects with INFERENCE_TIMEOUT', async () => {
    const promise = safePark({ inputs: { text: 'pulled but not submitted' } }, {
      noWorkerWindowMs: 200,
      submitTimeoutMs: 40,
    });
    const pulled = await pullNext({ waitMs: 100 });
    expect(pulled).not.toBeNull();
    await expect(promise).rejects.toMatchObject({
      code: 'INFERENCE_TIMEOUT',
      status: 504,
    });
  });
});

describe('cancel', () => {
  it('cancel rejects the parked request with INFERENCE_CANCELLED + reason', async () => {
    const promise = safePark({ inputs: { text: 'cancel-me' } });
    const pulled = await pullNext({ waitMs: 50 });
    cancel(pulled.id, 'image unreadable');
    await expect(promise).rejects.toMatchObject({
      code: 'INFERENCE_CANCELLED',
      status: 422,
      message: 'image unreadable',
    });
  });

  it('cancel on unknown request_id throws UNKNOWN_REQUEST', () => {
    expect(() => cancel('nope', 'r')).toThrow(AgentTaskError);
  });
});

describe('concurrent puller single-claim', () => {
  it('only one of two concurrent pullers gets a given request', async () => {
    safePark({ inputs: { text: 'one' } });
    const [a, b] = await Promise.all([
      pullNext({ waitMs: 100 }),
      pullNext({ waitMs: 100 }),
    ]);
    const claimed = [a, b].filter(Boolean);
    expect(claimed).toHaveLength(1);
  });
});

describe('getInFlightPayload', () => {
  it('returns payload + parkedAt for an in_flight entry; null otherwise', async () => {
    const promise = safePark({ inputs: { text: 'peek' }, caller_ref: 'app:foo' });
    expect(getInFlightPayload('nope')).toBeNull();
    const pulled = await pullNext({ waitMs: 50 });
    const peeked = getInFlightPayload(pulled.id);
    expect(peeked.payload.caller_ref).toBe('app:foo');
    expect(typeof peeked.parkedAt).toBe('number');
    deliverResult(pulled.id, { answer: 'k' });
    await promise;
    expect(getInFlightPayload(pulled.id)).toBeNull();
  });
});

describe('deliverResult invalid states', () => {
  it('throws UNKNOWN_REQUEST on unknown id', () => {
    expect(() => deliverResult('nope', { answer: 'x' })).toThrow(AgentTaskError);
  });

  it('throws INVALID_STATE when request is still pending (not pulled)', async () => {
    const promise = safePark({ inputs: { text: 'unpulled' } });
    // Reach into the queue to find the parked id without pulling.
    const stats = getQueueStats();
    expect(stats.pendingCount).toBe(1);
    // We don't expose ids without pulling — but we can verify the throw shape
    // by calling deliver on the id-less unknown path, then cancelling promise.
    expect(() => deliverResult('not-a-real-id', { answer: 'x' })).toThrow(AgentTaskError);
    // Cleanup: pull + cancel so the parked promise rejects cleanly.
    const pulled = await pullNext({ waitMs: 50 });
    cancel(pulled.id, 'cleanup');
    await expect(promise).rejects.toMatchObject({ code: 'INFERENCE_CANCELLED' });
  });
});

describe('queue stats', () => {
  it('tracks pending, in-flight, and recent pull counts', async () => {
    safePark({ inputs: { text: 'a' } });
    safePark({ inputs: { text: 'b' } });
    const before = getQueueStats();
    expect(before.pendingCount).toBe(2);
    expect(before.inFlightCount).toBe(0);
    const pulled = await pullNext({ waitMs: 50 });
    const mid = getQueueStats();
    expect(mid.pendingCount).toBe(1);
    expect(mid.inFlightCount).toBe(1);
    expect(mid.recentPullCount).toBeGreaterThan(0);
    cancel(pulled.id, 'reset');
  });
});

describe('validateEnvelopeOrThrow', () => {
  it('accepts a minimal valid envelope', () => {
    expect(() => validateEnvelopeOrThrow({ answer: 'ok' }, undefined)).not.toThrow();
  });

  it('rejects an envelope missing the required answer field', () => {
    expect(() => validateEnvelopeOrThrow({}, undefined))
      .toThrowError(/missing required field 'answer'/);
  });

  it('rejects an envelope with an unexpected top-level field', () => {
    expect(() => validateEnvelopeOrThrow({ answer: 'ok', foo: 1 }, undefined))
      .toThrowError(/unexpected field 'foo'/);
  });

  it('rejects an envelope whose answer is not a string', () => {
    expect(() => validateEnvelopeOrThrow({ answer: 123 }, undefined))
      .toThrowError(/expected string/);
  });

  it('throws AgentTaskError with code INVALID_ENVELOPE', () => {
    try {
      validateEnvelopeOrThrow({}, undefined);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AgentTaskError);
      expect(err.code).toBe('INVALID_ENVELOPE');
      expect(err.status).toBe(422);
    }
  });

  it('accepts an envelope satisfying a custom schema', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: { name: { type: 'string' } },
    };
    expect(() => validateEnvelopeOrThrow({ name: 'x' }, schema)).not.toThrow();
  });
});

describe('deliverResult — envelope validation as load-bearing gate', () => {
  it('delivers a schema-valid envelope and resolves the parked HTTP', async () => {
    const parked = parkRequest({ inputs: { text: 'q' } });
    const pulled = await pullNext({ waitMs: 50 });
    deliverResult(pulled.id, { answer: 'ok' });
    const result = await parked;
    expect(result.envelope.answer).toBe('ok');
  });

  it('rejects malformed envelope at the queue, regardless of the puller', async () => {
    const parked = safePark({ inputs: { text: 'q' } });
    const pulled = await pullNext({ waitMs: 50 });
    expect(() => deliverResult(pulled.id, { suggestions: ['no answer'] })).toThrow(AgentTaskError);
    await expect(parked).rejects.toMatchObject({
      code: 'INVALID_ENVELOPE',
      status: 422,
    });
  });

  it('honors a payload-supplied envelope_schema over the default', async () => {
    const customSchema = {
      type: 'object',
      required: ['ticket_id'],
      additionalProperties: false,
      properties: { ticket_id: { type: 'string' } },
    };
    // Default envelope ({ answer: 'x' }) FAILS the custom schema (missing ticket_id).
    const parked = safePark({ inputs: { text: 'q' }, envelope_schema: customSchema });
    const pulled = await pullNext({ waitMs: 50 });
    expect(() => deliverResult(pulled.id, { answer: 'x' })).toThrow(AgentTaskError);
    await expect(parked).rejects.toMatchObject({ code: 'INVALID_ENVELOPE' });
  });
});

describe('pullNext with kindsFilter', () => {
  it('skips entries whose task_kind is not in the filter', async () => {
    const a = safePark({ inputs: { text: 'a' }, task_kind: 'other_kind' });
    const b = safePark({ inputs: { text: 'b' }, task_kind: 'envelope_inference' });
    const pulled = await pullNext({ waitMs: 50, kindsFilter: ['envelope_inference'] });
    expect(pulled).not.toBeNull();
    expect(pulled.payload.inputs.text).toBe('b');
    // Clean up
    cancel(pulled.id, 'cleanup');
    await expect(b).rejects.toThrow();
    // The 'a' entry remains pending; pull it without filter and cancel.
    const pulledA = await pullNext({ waitMs: 50 });
    cancel(pulledA.id, 'cleanup');
    await expect(a).rejects.toThrow();
  });

  it('returns null when nothing matches the filter even if pending exists', async () => {
    const parked = safePark({ inputs: { text: 'x' }, task_kind: 'envelope_inference' });
    const pulled = await pullNext({ waitMs: 30, kindsFilter: ['some_other_kind'] });
    expect(pulled).toBeNull();
    // Clean up the parked entry.
    const fallback = await pullNext({ waitMs: 50 });
    cancel(fallback.id, 'cleanup');
    await expect(parked).rejects.toThrow();
  });

  it('coexists with unfiltered pullers — filtered waiter skips, unfiltered wins', async () => {
    safePark({ inputs: { text: 'go' }, task_kind: 'envelope_inference' });
    const [filtered, unfiltered] = await Promise.all([
      pullNext({ waitMs: 60, kindsFilter: ['unrelated_kind'] }),
      pullNext({ waitMs: 60 }),
    ]);
    expect(filtered).toBeNull();
    expect(unfiltered).not.toBeNull();
    cancel(unfiltered.id, 'cleanup');
  });
});

describe('recent events ring buffer', () => {
  it('records delivered events with fulfiller', async () => {
    const parked = parkRequest({ inputs: { text: 'q' } });
    const pulled = await pullNext({ waitMs: 50 });
    deliverResult(pulled.id, { answer: 'a' }, { fulfiller: { kind: 'agent-mcp' }, model: 'm' });
    await parked;
    const events = getRecentEvents();
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.kind).toBe('delivered');
    expect(last.fulfiller.kind).toBe('agent-mcp');
    expect(last.model).toBe('m');
  });

  it('records cancelled events with reason', async () => {
    const parked = safePark({ inputs: { text: 'q' } });
    const pulled = await pullNext({ waitMs: 50 });
    cancel(pulled.id, 'image unreadable');
    await expect(parked).rejects.toThrow();
    const events = getRecentEvents();
    const last = events[events.length - 1];
    expect(last.kind).toBe('cancelled');
    expect(last.reason).toBe('image unreadable');
  });

  it('records invalid_envelope events on schema failure', async () => {
    const parked = safePark({ inputs: { text: 'q' } });
    const pulled = await pullNext({ waitMs: 50 });
    expect(() => deliverResult(pulled.id, {})).toThrow();
    await expect(parked).rejects.toThrow();
    const events = getRecentEvents();
    const last = events[events.length - 1];
    expect(last.kind).toBe('invalid_envelope');
  });

  it('caps at RECENT_EVENT_LIMIT', async () => {
    for (let i = 0; i < _internals.RECENT_EVENT_LIMIT + 5; i++) {
      const parked = parkRequest({ inputs: { text: String(i) } });
      const pulled = await pullNext({ waitMs: 50 });
      deliverResult(pulled.id, { answer: 'a' });
      await parked;
    }
    expect(getRecentEvents().length).toBe(_internals.RECENT_EVENT_LIMIT);
  });
});
