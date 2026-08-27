/**
 * Node fulfiller — long-lived in-process poller that pulls tasks from the
 * agent-tasks queue and invokes a configured runtime adapter to produce
 * the envelope, all without an external Claude Code session in worker
 * mode.
 *
 * Opt-in only: set MOJULO_AGENT_RUNTIME (today: `claude-code-headless`)
 * before boot. Unset → startNodeFulfiller is a no-op and today's /loop
 * behavior is preserved byte-for-byte.
 *
 * Coexistence with /loop is intentional. The agent-tasks queue is
 * FIFO single-claim; whichever puller pulls first wins. Operators who
 * want the visible-in-session UX keep /loop; operators who want
 * "mojulo just works" set the env var. Both can run simultaneously.
 *
 * Phase 1 posture:
 *   - Serial: one in-flight subprocess at a time (Phase 2 may parallelize).
 *   - kindsFilter restricts pulls to the adapter's supportedKinds so
 *     unsupported kinds fall through to other pullers.
 *   - On adapter failure: the queue entry is cancelled with the runtime
 *     error's reason. The HTTP-side parked promise receives INVALID_ENVELOPE
 *     (validation gate inside deliverResult) or INFERENCE_CANCELLED (from
 *     the cancel call below) — either way the app sees a typed error
 *     rather than hanging.
 *
 * See AGENT_TASKS_NODE_DRIVEN_PLAN.md.
 */

import {
  pullNext,
  deliverResult,
  cancel,
  AgentTaskError,
} from '@/lib/mcp/agent-tasks/queue';
import { recordInferenceOutcome } from '@/lib/mcp/agent-tasks/audit';
import { resolveConfiguredAdapter } from '@/lib/runtime-adapters';
import { AgentRuntimeError } from '@/lib/runtime-adapters/errors';

const DEFAULT_INVOKE_TIMEOUT_MS = 60_000;
const DEFAULT_PULL_WAIT_MS = 25_000;

// Keyed on globalThis (not module scope) so it survives dev HMR re-evaluation
// and we never stack more than one SIGTERM listener across reloads.
const SIGTERM_HANDLER_KEY = Symbol.for('mojulo.nodeFulfiller.sigtermHandler');

let state = null;

function logInfo(msg) {
  console.log(`[node-fulfiller] ${msg}`);
}

function logWarn(msg) {
  console.warn(`[node-fulfiller] ${msg}`);
}

async function loopOnce({ adapter, invokeTimeoutMs, pullWaitMs }) {
  const entry = await pullNext({
    waitMs: pullWaitMs,
    kindsFilter: adapter.supportedKinds,
    // The in-process fulfiller runs on the OPERATOR's runtime — it claims the
    // 'local' lane only. A delegate's tasks wait for that delegate's own
    // agent; letting the house fulfiller absorb them would re-form the
    // subscription multiplexer (roles-pack.plan.md, the 1:1 inference rule).
    forUserId: 'local',
  });
  if (!entry) return;
  const payload = entry.payload || {};
  const envelope_schema = payload.envelope_schema;
  try {
    const { envelope, model } = await adapter.invoke({
      taskPayload: payload,
      envelope_schema,
      timeoutMs: invokeTimeoutMs,
      signal: state?.abortController?.signal,
    });

    const fulfillerStamp = {
      kind: 'node-driven-runtime',
      runtime: adapter.id,
      model: model || undefined,
    };
    const durationMs = Date.now() - entry.parkedAt;

    // Audit BEFORE delivery so the principle is durable before the parked
    // HTTP unblocks — mirrors the MCP submit_envelope_inference handler.
    // chat_turn (the builder web-chat relay) is run-rate and records no
    // principle, matching that handler's gating.
    if (payload.task_kind !== 'chat_turn') {
      try {
        recordInferenceOutcome({
          caller_ref: payload.caller_ref,
          inputs: payload.inputs,
          envelope,
          durationMs,
          model,
          fulfiller: fulfillerStamp,
        });
      } catch (err) {
        logWarn(`principle recording failed: ${err.message || err}`);
      }
    }

    try {
      deliverResult(entry.id, envelope, { model, fulfiller: fulfillerStamp });
    } catch (err) {
      // deliverResult validates the envelope; on INVALID_ENVELOPE it
      // already rejected the parked promise. Other AgentTaskError codes
      // (UNKNOWN_REQUEST, INVALID_STATE) mean the entry vanished from
      // under us — log and move on.
      if (err instanceof AgentTaskError) {
        logWarn(`deliverResult rejected: ${err.code} ${err.message}`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    // Adapter (or audit) blew up. Cancel the queue entry so the parked
    // HTTP gets a typed INFERENCE_CANCELLED with a meaningful reason.
    // Skip cancellation if the entry already settled (INVALID_ENVELOPE
    // path above already drained it).
    const reason = err instanceof AgentRuntimeError
      ? `${err.code}: ${err.message}`
      : (err?.message || 'Node fulfiller failed');
    try {
      cancel(entry.id, reason);
    } catch (cancelErr) {
      if (!(cancelErr instanceof AgentTaskError)) throw cancelErr;
      // UNKNOWN_REQUEST / INVALID_STATE are expected when the entry
      // already settled — no further action.
    }
    logWarn(`task ${entry.id} cancelled: ${reason}`);
  }
}

async function runLoop({ adapter, invokeTimeoutMs, pullWaitMs }) {
  while (state && state.running) {
    try {
      await loopOnce({ adapter, invokeTimeoutMs, pullWaitMs });
    } catch (err) {
      // Defensive — loopOnce shouldn't escape, but if it does, log and
      // sleep briefly so a tight failure loop doesn't burn CPU.
      logWarn(`loop iteration failed: ${err?.message || err}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (state) state.exited = true;
}

/**
 * Idempotently start the Node fulfiller if MOJULO_AGENT_RUNTIME resolves
 * to a registered adapter. Safe to call from boot paths that may fire
 * more than once (Next.js dev mode, repeated getDb() calls).
 */
export function startNodeFulfiller(opts = {}) {
  if (state && state.running) return state;
  const adapter = resolveConfiguredAdapter();
  if (!adapter) return null;

  const invokeTimeoutMs = opts.invokeTimeoutMs ?? DEFAULT_INVOKE_TIMEOUT_MS;
  const pullWaitMs = opts.pullWaitMs ?? DEFAULT_PULL_WAIT_MS;

  state = {
    adapter,
    running: true,
    exited: false,
    abortController: new AbortController(),
    sigtermHandler: null,
  };

  // SIGTERM during a control-plane restart should drain cleanly: stop the
  // loop after the current in-flight task completes. Registration is made
  // idempotent across HMR: dev re-evaluates this module (resetting `state`)
  // while `process` outlives module scope, so a naive process.once() would
  // accumulate one dead listener per reload (MaxListenersExceededWarning).
  // We stash the live handler on globalThis and drop any prior one first.
  const handler = () => {
    logInfo('SIGTERM received — draining current task and stopping');
    stopNodeFulfiller().catch(() => {});
  };
  state.sigtermHandler = handler;
  const prior = globalThis[SIGTERM_HANDLER_KEY];
  if (prior) {
    try { process.off('SIGTERM', prior); } catch { /* ignore */ }
  }
  globalThis[SIGTERM_HANDLER_KEY] = handler;
  process.once('SIGTERM', handler);

  logInfo(`started (runtime: ${adapter.id}, supportedKinds: ${adapter.supportedKinds.join(',')})`);
  runLoop({ adapter, invokeTimeoutMs, pullWaitMs });
  return state;
}

/**
 * Stop the running fulfiller. Resolves when the current in-flight task
 * (if any) completes. Safe to call multiple times.
 */
export async function stopNodeFulfiller() {
  if (!state) return;
  if (!state.running) {
    // Already stopping / stopped — wait for the loop to exit if it hasn't.
    while (state && !state.exited) {
      await new Promise((r) => setTimeout(r, 25));
    }
    return;
  }
  state.running = false;
  // Aborting frees any in-flight subprocess wait. The loop will then
  // observe state.running === false and exit on its next iteration.
  try { state.abortController.abort(); } catch { /* ignore */ }
  if (state.sigtermHandler) {
    try { process.off('SIGTERM', state.sigtermHandler); } catch { /* ignore */ }
    if (globalThis[SIGTERM_HANDLER_KEY] === state.sigtermHandler) {
      globalThis[SIGTERM_HANDLER_KEY] = undefined;
    }
  }
  // Wait for loop to settle so a subsequent start gets a clean state.
  const deadline = Date.now() + 5000;
  while (state && !state.exited && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 25));
  }
  state = null;
}

export function getNodeFulfillerStatus() {
  if (!state) return { running: false, runtime: null };
  return {
    running: !!state.running,
    runtime: state.adapter?.id || null,
    supportedKinds: state.adapter?.supportedKinds || [],
  };
}

export const _internals = {
  loopOnce,
  DEFAULT_INVOKE_TIMEOUT_MS,
  DEFAULT_PULL_WAIT_MS,
};
