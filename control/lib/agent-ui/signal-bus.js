/**
 * agent-ui signal bus — in-memory pub/sub keyed by the builder `sessionId`,
 * plus a pending-decision registry for the reverse (operator → agent) path.
 *
 * The agent-routed chat builder parks a `chat_turn` task and holds an SSE
 * stream open (see `runAgentChatTurn` in
 * [app/api/builder/stream/route.js]). The fulfilling worker (the MCP-connected
 * interactive `/loop` worker) narrates progress and asks structured decisions
 * via the agent-ui MCP tools ([lib/mcp/tools/agent-ui.js]); those tools publish
 * here, and the open SSE stream — subscribed for the turn — forwards each event
 * to the browser using the existing builder `EventTypes` vocabulary. A decision
 * additionally registers a pending promise that the `/api/agent-ui/respond`
 * route resolves with the operator's answer.
 *
 * In-memory only, same posture as the agent-tasks queue: a control-plane
 * restart drops subscribers and settles outstanding decisions as expired. The
 * node-fulfiller (headless one-shot, no MCP connection) cannot reach these
 * tools, so turns fulfilled that way simply emit nothing here and the relay
 * returns the final answer only.
 *
 * See lite-template/integration/app-system/0528/agent-routed-chat-ui-signals.md
 */

import { randomUUID } from 'node:crypto';

// sessionId → Set<listener>. A listener is (event) => void where `event` is
// { type, data } shaped to the builder SSE EventTypes (e.g. { type: 'text',
// data: { text } }).
const subscribers = new Map();

// promptId → entry. Entries live until answered/expired, then are swept lazily.
const decisions = new Map();

const DECISION_STATUS = Object.freeze({
  WAITING: 'waiting',
  ANSWERED: 'answered',
  EXPIRED: 'expired',
});

// Absolute lifetime of a decision. Must stay UNDER the parked chat_turn's
// submitTimeoutMs (bumped to 15min in route.js) so a stuck decision expires
// before the parked HTTP does, letting the worker fall back and still submit.
const DEFAULT_DECISION_TTL_MS = 10 * 60_000;

// Settled entries are kept briefly so a late re-poll can still read the answer,
// then swept. Bounds the in-memory leak for workers that never re-poll.
const SETTLED_GC_MS = 60_000;

function sweepSettled() {
  const now = Date.now();
  for (const [promptId, entry] of decisions) {
    if (entry.status !== DECISION_STATUS.WAITING && entry.settledAt && now - entry.settledAt > SETTLED_GC_MS) {
      decisions.delete(promptId);
    }
  }
}

// ─── pub/sub ───────────────────────────────────────────────────────────────

export function subscribe(sessionId, listener) {
  if (!sessionId || typeof listener !== 'function') {
    throw new Error('subscribe requires (sessionId, listener)');
  }
  let set = subscribers.get(sessionId);
  if (!set) {
    set = new Set();
    subscribers.set(sessionId, set);
  }
  set.add(listener);
  return function unsubscribe() {
    const s = subscribers.get(sessionId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) subscribers.delete(sessionId);
  };
}

/**
 * Publish an SSE-shaped event to every live subscriber of `sessionId`.
 * Returns true if at least one subscriber received it — a fire-and-forget
 * emit reports `delivered:false` so the worker knows the turn's SSE is closed.
 * A throwing listener (e.g. a closed controller) never breaks siblings.
 */
export function publish(sessionId, event) {
  const set = subscribers.get(sessionId);
  if (!set || set.size === 0) return false;
  let delivered = false;
  for (const listener of set) {
    try {
      listener(event);
      delivered = true;
    } catch {
      // closed controller / dead listener — ignore, keep delivering to siblings
    }
  }
  return delivered;
}

export function hasSubscriber(sessionId) {
  const set = subscribers.get(sessionId);
  return !!set && set.size > 0;
}

// ─── decisions (reverse path) ────────────────────────────────────────────────

/**
 * Register a pending decision for `sessionId`. The returned `promptId` is the
 * key the worker re-polls on and the `/api/agent-ui/respond` route resolves
 * against. The decision auto-expires after `ttlMs`.
 */
export function createDecision(sessionId, { ttlMs = DEFAULT_DECISION_TTL_MS } = {}) {
  sweepSettled();
  const promptId = randomUUID();
  let settleFn;
  const settled = new Promise((resolve) => {
    settleFn = resolve;
  });
  const entry = {
    sessionId,
    status: DECISION_STATUS.WAITING,
    settle: settleFn,
    settled,
    result: null,
    createdAt: Date.now(),
    settledAt: null,
    ttlHandle: setTimeout(() => expireDecision(promptId), ttlMs),
  };
  decisions.set(promptId, entry);
  return { promptId };
}

/** Operator answered — resolve the worker's blocked await with the answer. */
export function resolveDecision(promptId, { selected = null, text = null } = {}) {
  const entry = decisions.get(promptId);
  if (!entry) return { ok: false, reason: 'unknown_prompt' };
  if (entry.status !== DECISION_STATUS.WAITING) {
    return { ok: false, reason: `already_${entry.status}` };
  }
  entry.status = DECISION_STATUS.ANSWERED;
  clearTimeout(entry.ttlHandle);
  entry.result = { status: DECISION_STATUS.ANSWERED, selected, text };
  entry.settledAt = Date.now();
  entry.settle(entry.result);
  return { ok: true };
}

function expireDecision(promptId) {
  const entry = decisions.get(promptId);
  if (!entry || entry.status !== DECISION_STATUS.WAITING) return;
  entry.status = DECISION_STATUS.EXPIRED;
  clearTimeout(entry.ttlHandle);
  entry.result = { status: DECISION_STATUS.EXPIRED };
  entry.settledAt = Date.now();
  entry.settle(entry.result);
}

/** Clean up a decision the worker has already read to a terminal state. */
export function disposeDecision(promptId) {
  const entry = decisions.get(promptId);
  if (!entry) return;
  clearTimeout(entry.ttlHandle);
  decisions.delete(promptId);
}

/**
 * Long-poll for the operator's answer. Resolves immediately if already
 * settled; otherwise waits up to `waitMs` then returns the `waiting` sentinel
 * so the caller can re-poll on the same `promptId`.
 */
export function awaitDecision(promptId, waitMs) {
  const entry = decisions.get(promptId);
  if (!entry) return Promise.resolve({ status: 'unknown', prompt_id: promptId });
  if (entry.result) return Promise.resolve({ ...entry.result, prompt_id: promptId });
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ status: DECISION_STATUS.WAITING, prompt_id: promptId });
    }, waitMs);
    entry.settled.then((result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...result, prompt_id: promptId });
    });
  });
}

/** Safe metadata view for the respond route's session-match guard. */
export function getDecisionMeta(promptId) {
  const entry = decisions.get(promptId);
  if (!entry) return null;
  return { sessionId: entry.sessionId, status: entry.status };
}

export const _internals = {
  DECISION_STATUS,
  DEFAULT_DECISION_TTL_MS,
  SETTLED_GC_MS,
  _resetForTests() {
    for (const entry of decisions.values()) {
      clearTimeout(entry.ttlHandle);
      if (entry.status === DECISION_STATUS.WAITING) {
        entry.status = DECISION_STATUS.EXPIRED;
        entry.result = { status: DECISION_STATUS.EXPIRED };
        entry.settle(entry.result);
      }
    }
    decisions.clear();
    subscribers.clear();
  },
};
