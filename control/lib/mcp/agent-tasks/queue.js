/**
 * agent-tasks queue — mojulo's opinionated runtime primitive for
 * agent-mediated, schema-validated work.
 *
 * The queue exposes one shape: park a typed request, long-poll for a
 * worker, validate the response against a JSON-schema (load-bearing
 * gate inside deliverResult), resolve the parked promise. Workers come
 * in two flavors today: the operator's Claude Code agent running in
 * worker mode (via /loop + a per-kind catalyst), and the optional
 * in-process Node fulfiller that spawns a one-shot agent subprocess per
 * task (see [../../runtime-adapters/] + [../../agent-tasks/node-fulfiller.js]).
 * Both pullers race on the same queue with FIFO single-claim semantics.
 *
 * Today there is one task_kind (`envelope_inference`) driving the App
 * paradigm's R1 path. The substrate generalizes to classification,
 * decision, structuring, transformation — any agent-mediated workload
 * that wants a typed response. Each new kind ships its own per-kind
 * submit tool (so tools/list stays the discovery surface) plus its own
 * worker catalyst (so operators opt into specific workloads).
 *
 * In-memory only. A control-plane restart drops all in-flight requests —
 * each parked promise rejects with `INFERENCE_PARKED_LOST`. Matches the
 * existing in-memory MCP state surfaces (session-binding, client-bindings).
 *
 * See APP_SPIKE_A_REFRAME_PLAN.md, spike_qualities.md, and
 * AGENT_TASKS_NODE_DRIVEN_PLAN.md.
 */

import { randomUUID } from 'node:crypto';
import { ENVELOPE_SCHEMA } from '@/lib/envelope-schema';

export class AgentTaskError extends Error {
  constructor(message, { code, status = 500 } = {}) {
    super(message);
    this.code = code || 'AGENT_TASK_ERROR';
    this.status = status;
  }
}

const DEFAULT_PULL_WAIT_MS = 25_000;
const HARD_PULL_CEILING_MS = 50_000;
const DEFAULT_SUBMIT_TIMEOUT_MS = 60_000;
const DEFAULT_NO_WORKER_WINDOW_MS = 5_000;
const RECENT_EVENT_LIMIT = 10;

function resolvePullCeiling() {
  const raw = process.env.MOJULO_INFERENCE_PULL_MAX_MS;
  if (!raw) return HARD_PULL_CEILING_MS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1000) return HARD_PULL_CEILING_MS;
  return Math.min(n, HARD_PULL_CEILING_MS);
}

const STATUS = Object.freeze({
  PENDING: 'pending',
  IN_FLIGHT: 'in_flight',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
});

const pending = new Map();
const waitingPullers = [];
let recentPullCount = 0;
let lastPullAt = 0;

// Ring buffer of the most recent completed / cancelled / expired events.
// Drives the /api/agent-tasks/status endpoint's "last event" line so the
// operator's status bar can show what just happened without polling the
// contextmap. Capped at RECENT_EVENT_LIMIT — oldest evicted on push.
const recentEvents = [];

function recordEvent(event) {
  recentEvents.push({ ...event, recordedAt: Date.now() });
  if (recentEvents.length > RECENT_EVENT_LIMIT) {
    recentEvents.splice(0, recentEvents.length - RECENT_EVENT_LIMIT);
  }
}

function newEntry(payload, { noWorkerWindowMs, submitTimeoutMs }) {
  const id = randomUUID();
  const parkedAt = Date.now();
  let resolveFn;
  let rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  const timeoutHandle = setTimeout(() => {
    expireParked(id);
  }, noWorkerWindowMs + submitTimeoutMs);
  const entry = {
    id,
    payload,
    parkedAt,
    status: STATUS.PENDING,
    resolve: resolveFn,
    reject: rejectFn,
    promise,
    timeoutHandle,
    submitTimeoutHandle: null,
    submitTimeoutMs,
  };
  pending.set(id, entry);
  return entry;
}

function clearEntryTimers(entry) {
  if (entry.timeoutHandle) {
    clearTimeout(entry.timeoutHandle);
    entry.timeoutHandle = null;
  }
  if (entry.submitTimeoutHandle) {
    clearTimeout(entry.submitTimeoutHandle);
    entry.submitTimeoutHandle = null;
  }
}

function entryTaskKind(entry) {
  return entry?.payload?.task_kind || 'envelope_inference';
}

function expireParked(id) {
  const entry = pending.get(id);
  if (!entry) return;
  if (entry.status === STATUS.PENDING) {
    entry.status = STATUS.REJECTED;
    clearEntryTimers(entry);
    pending.delete(id);
    recordEvent({
      kind: 'expired',
      taskKind: entryTaskKind(entry),
      reason: 'no_worker',
      durationMs: Date.now() - entry.parkedAt,
    });
    entry.reject(
      new AgentTaskError(
        'No mojulo agent worker picked up the request before timeout. Run `/loop /run-inference-worker` in your Claude Code session, or set `MOJULO_AGENT_RUNTIME=claude-code-headless` to enable the Node fulfiller.',
        { code: 'NO_AGENT_WORKER', status: 503 },
      ),
    );
  } else if (entry.status === STATUS.IN_FLIGHT) {
    entry.status = STATUS.REJECTED;
    clearEntryTimers(entry);
    pending.delete(id);
    recordEvent({
      kind: 'expired',
      taskKind: entryTaskKind(entry),
      reason: 'submit_timeout',
      durationMs: Date.now() - entry.parkedAt,
    });
    entry.reject(
      new AgentTaskError(
        'Worker pulled the request but did not submit a result before timeout.',
        { code: 'INFERENCE_TIMEOUT', status: 504 },
      ),
    );
  }
}

function notifyWaitingPullers() {
  // Walk waitingPullers and try to match each against any pending entry
  // that satisfies its kindsFilter. We iterate the waiters list rather
  // than just popping head because filter-mismatched waiters need to be
  // skipped without losing their place in line.
  for (let i = 0; i < waitingPullers.length; ) {
    const puller = waitingPullers[i];
    const next = nextPendingEntry(puller.kindsFilter);
    if (!next) {
      i += 1;
      continue;
    }
    waitingPullers.splice(i, 1);
    clearTimeout(puller.timeoutHandle);
    markPulled(next);
    puller.resolve(next);
  }
}

function nextPendingEntry(kindsFilter) {
  for (const entry of pending.values()) {
    if (entry.status !== STATUS.PENDING) continue;
    if (kindsFilter && !kindsFilter.includes(entryTaskKind(entry))) continue;
    return entry;
  }
  return null;
}

function markPulled(entry) {
  entry.status = STATUS.IN_FLIGHT;
  if (entry.timeoutHandle) {
    clearTimeout(entry.timeoutHandle);
    entry.timeoutHandle = null;
  }
  entry.submitTimeoutHandle = setTimeout(() => {
    expireParked(entry.id);
  }, entry.submitTimeoutMs);
  recentPullCount += 1;
  lastPullAt = Date.now();
}

/**
 * HTTP route entry point. Parks the inference request and awaits a worker
 * delivery. Throws `AgentTaskError` on timeout / cancel / no-worker.
 *
 * @param {object} payload — { envelope_schema?, inputs, protocol_context?, caller_ref?, task_kind? }
 * @param {object} [opts]
 * @param {number} [opts.noWorkerWindowMs]
 * @returns {Promise<{ envelope, model?, durationMs, request_id }>}
 */
export async function parkRequest(payload, opts = {}) {
  const noWorkerWindowMs = opts.noWorkerWindowMs ?? DEFAULT_NO_WORKER_WINDOW_MS;
  const submitTimeoutMs = opts.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
  const entry = newEntry(payload, { noWorkerWindowMs, submitTimeoutMs });
  notifyWaitingPullers();
  return entry.promise;
}

/**
 * Long-poll for the next pending entry. Returns the entry (marked
 * `in_flight`) or null if none arrives within waitMs.
 *
 * @param {object} [opts]
 * @param {number} [opts.waitMs]
 * @param {string[]} [opts.kindsFilter] — restrict to specific task_kinds.
 *   Used by the Node fulfiller to claim only kinds its runtime adapter
 *   advertises support for; the MCP /loop puller doesn't pass this.
 */
export async function pullNext({ waitMs, kindsFilter } = {}) {
  const ceiling = resolvePullCeiling();
  const wait = Math.max(0, Math.min(waitMs ?? DEFAULT_PULL_WAIT_MS, ceiling));
  const filter = Array.isArray(kindsFilter) && kindsFilter.length > 0 ? kindsFilter : null;
  const immediate = nextPendingEntry(filter);
  if (immediate) {
    markPulled(immediate);
    return immediate;
  }
  if (wait === 0) return null;
  return new Promise((resolve) => {
    const waiter = {
      resolve,
      kindsFilter: filter,
      timeoutHandle: setTimeout(() => {
        const idx = waitingPullers.indexOf(waiter);
        if (idx >= 0) waitingPullers.splice(idx, 1);
        resolve(null);
      }, wait),
    };
    waitingPullers.push(waiter);
  });
}

/**
 * MCP `submit_inference_result` entry point. Resolves the parked HTTP
 * response with the agent's envelope. `meta` accepts optional audit fields
 * the agent chose to include (model name, etc).
 *
 * The envelope is validated against the entry's payload.envelope_schema
 * (or ENVELOPE_SCHEMA as default) inside this function. Validation failure
 * throws AgentTaskError(INVALID_ENVELOPE) AND rejects the parked promise
 * with the same error — the queue is the only load-bearing schema gate,
 * regardless of whether the call came from MCP submit or the Node
 * fulfiller. MCP inputSchema validation is belt-and-suspenders on top.
 */
export function deliverResult(requestId, envelope, meta = {}) {
  const entry = pending.get(requestId);
  if (!entry) {
    throw new AgentTaskError(`Unknown request_id: ${requestId}`, {
      code: 'UNKNOWN_REQUEST',
      status: 404,
    });
  }
  if (entry.status !== STATUS.IN_FLIGHT) {
    throw new AgentTaskError(
      `request_id ${requestId} is in status ${entry.status}; expected ${STATUS.IN_FLIGHT}`,
      { code: 'INVALID_STATE', status: 409 },
    );
  }
  const schema = entry.payload?.envelope_schema || ENVELOPE_SCHEMA;
  try {
    validateEnvelopeOrThrow(envelope, schema);
  } catch (err) {
    // Validation failure rejects the parked HTTP and propagates back to
    // the caller (MCP submit handler or Node fulfiller). The entry is
    // marked rejected so it doesn't stay in_flight forever.
    entry.status = STATUS.REJECTED;
    clearEntryTimers(entry);
    pending.delete(entry.id);
    const httpErr = new AgentTaskError(err.message, {
      code: 'INVALID_ENVELOPE',
      status: 422,
    });
    recordEvent({
      kind: 'invalid_envelope',
      taskKind: entryTaskKind(entry),
      reason: err.message,
      durationMs: Date.now() - entry.parkedAt,
      fulfiller: meta?.fulfiller || null,
    });
    entry.reject(httpErr);
    throw err;
  }
  entry.status = STATUS.RESOLVED;
  clearEntryTimers(entry);
  pending.delete(entry.id);
  const durationMs = Date.now() - entry.parkedAt;
  recordEvent({
    kind: 'delivered',
    taskKind: entryTaskKind(entry),
    durationMs,
    fulfiller: meta?.fulfiller || null,
    model: meta?.model || null,
  });
  entry.resolve({ envelope, durationMs, request_id: entry.id, meta });
  return { durationMs };
}

/**
 * MCP `cancel_inference` entry point. Resolves the parked HTTP response
 * with a typed cancellation error carrying the agent's reason.
 */
export function cancel(requestId, reason) {
  const entry = pending.get(requestId);
  if (!entry) {
    throw new AgentTaskError(`Unknown request_id: ${requestId}`, {
      code: 'UNKNOWN_REQUEST',
      status: 404,
    });
  }
  if (entry.status !== STATUS.IN_FLIGHT) {
    throw new AgentTaskError(
      `request_id ${requestId} is in status ${entry.status}; expected ${STATUS.IN_FLIGHT}`,
      { code: 'INVALID_STATE', status: 409 },
    );
  }
  entry.status = STATUS.REJECTED;
  clearEntryTimers(entry);
  pending.delete(entry.id);
  recordEvent({
    kind: 'cancelled',
    taskKind: entryTaskKind(entry),
    reason: reason || null,
    durationMs: Date.now() - entry.parkedAt,
  });
  entry.reject(
    new AgentTaskError(reason || 'Agent cancelled the inference request.', {
      code: 'INFERENCE_CANCELLED',
      status: 422,
    }),
  );
  return { cancelled: true };
}

/**
 * Read the payload of an in-flight request. Used by `submit_inference_result`
 * to resolve caller_ref against the parked payload before unblocking the
 * HTTP response — keeps audit recording in the synchronous path so the
 * principle is durable before the app sees its answer.
 */
export function getInFlightPayload(requestId) {
  const entry = pending.get(requestId);
  if (!entry) return null;
  if (entry.status !== STATUS.IN_FLIGHT) return null;
  return { payload: entry.payload, parkedAt: entry.parkedAt };
}

export function getQueueStats() {
  let pendingCount = 0;
  let inFlightCount = 0;
  for (const entry of pending.values()) {
    if (entry.status === STATUS.PENDING) pendingCount += 1;
    else if (entry.status === STATUS.IN_FLIGHT) inFlightCount += 1;
  }
  return {
    pendingCount,
    inFlightCount,
    waitingPullers: waitingPullers.length,
    recentPullCount,
    lastPullAt,
  };
}

/**
 * Snapshot of the most-recent events, oldest-first. Caller decides
 * whether to render only the latest one or the full window. Used by the
 * /api/agent-tasks/status endpoint.
 */
export function getRecentEvents() {
  return recentEvents.slice();
}

// ─── Schema validation ───────────────────────────────────────────────────
//
// Minimal JSON-Schema validator covering the slice ENVELOPE_SCHEMA uses:
// type, required, additionalProperties (false), properties, items, enum,
// minimum. Hand-rolled to avoid pulling AJV (~100KB) for one schema;
// generalize / swap to AJV when a second envelope-shaped kind lands.

function typeMatches(value, expected) {
  if (expected === 'string') return typeof value === 'string';
  if (expected === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (expected === 'boolean') return typeof value === 'boolean';
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  if (expected === 'null') return value === null;
  // Unknown type — be permissive (we don't ship schemas with arbitrary types).
  return true;
}

function validateAgainstSchema(value, schema, path) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type && !typeMatches(value, schema.type)) {
    throw new Error(`${path || 'value'}: expected ${schema.type}, got ${describe(value)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    throw new Error(`${path || 'value'}: must be one of ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      throw new Error(`${path || 'value'}: must be >= ${schema.minimum}`);
    }
  }
  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, idx) => {
      validateAgainstSchema(item, schema.items, `${path || 'value'}[${idx}]`);
    });
  }
  if (schema.type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) {
          throw new Error(`${path || 'value'}: missing required field '${key}'`);
        }
      }
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          throw new Error(`${path || 'value'}: unexpected field '${key}'`);
        }
      }
    }
    for (const [key, childSchema] of Object.entries(props)) {
      if (key in value) {
        validateAgainstSchema(value[key], childSchema, `${path ? `${path}.` : ''}${key}`);
      }
    }
  }
}

function describe(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Throws AgentTaskError(INVALID_ENVELOPE) if `envelope` doesn't satisfy
 * `schema`. The error message points at the first failing path.
 *
 * @param {object} envelope
 * @param {object} schema — JSON Schema subset (see validator above).
 */
export function validateEnvelopeOrThrow(envelope, schema) {
  const effective = schema || ENVELOPE_SCHEMA;
  try {
    validateAgainstSchema(envelope, effective, 'envelope');
  } catch (err) {
    throw new AgentTaskError(err.message, { code: 'INVALID_ENVELOPE', status: 422 });
  }
}

export const _internals = {
  STATUS,
  DEFAULT_PULL_WAIT_MS,
  HARD_PULL_CEILING_MS,
  DEFAULT_SUBMIT_TIMEOUT_MS,
  DEFAULT_NO_WORKER_WINDOW_MS,
  RECENT_EVENT_LIMIT,
  _resetForTests() {
    // Reset clears the queue silently — we attach a no-op catch first and
    // then resolve (not reject) parked promises so tests that left a
    // request un-awaited don't emit an unhandledRejection on next-tick.
    // Tests that exercise rejection semantics produce them inside the test
    // body via cancel / expireParked, not via this reset path.
    for (const entry of pending.values()) {
      clearEntryTimers(entry);
      entry.promise.catch(() => {});
      entry.resolve({
        envelope: { answer: '<test-reset>' },
        durationMs: 0,
        request_id: entry.id,
        meta: { reset: true },
      });
    }
    pending.clear();
    while (waitingPullers.length > 0) {
      const p = waitingPullers.shift();
      clearTimeout(p.timeoutHandle);
      p.resolve(null);
    }
    recentPullCount = 0;
    lastPullAt = 0;
    recentEvents.length = 0;
  },
};
