/**
 * Shared agent-routed chat relay.
 *
 * The control plane never "calls" the local agent — it parks a turn on the
 * agent-tasks queue and the operator's Claude Code agent pulls it, answers,
 * and submits an envelope back (see agent-tasks/queue.js). This helper is the
 * common body two surfaces share:
 *
 *   - the builder web chat in `agent` mode  (task_kind 'chat_turn')
 *   - the home-page unfiltered chat          (task_kind 'host_chat')
 *
 * Both subscribe the open SSE stream to the agent-ui signal bus for the turn
 * (so the worker's `emit_chat_signal` narration and `request_chat_decision`
 * cards reach the browser over the same EventTypes vocabulary), park the turn,
 * stream the answer back, and unsubscribe. What differs — session bookkeeping,
 * audit, the `done` payload — is injected via callbacks so neither surface
 * leaks into the other.
 *
 * See lite-template/integration/app-system/0528/home-agent-chat.md and
 * agent-routed-chat.md.
 */

import { parkRequest, AgentTaskError } from '@/lib/mcp/agent-tasks/queue';
import { subscribe as subscribeChatSignals } from '@/lib/agent-ui/signal-bus';

// Default well past the 60s queue default and above the decision TTL (10min),
// so the parked HTTP outlives any in-flight `request_chat_decision` rather than
// expiring under the operator. A turn that drives tools can run long.
const DEFAULT_SUBMIT_TIMEOUT_MS = 900_000;

function sendEvent(controller, encoder, type, data) {
  const event = { type, ...data, timestamp: Date.now() };
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

/**
 * Park a conversational turn for the local agent and relay its envelope back
 * over SSE. Emits the shared EventTypes vocabulary: `modulo_expression`,
 * `text`, `done`, `error`. AgentTaskError (NO_AGENT_WORKER, INFERENCE_TIMEOUT,
 * …) is surfaced as a clean `error` event and returned as `{ ok:false }`; only
 * unexpected errors throw to the caller's outer catch.
 *
 * @param {object} args
 * @param {string} args.taskKind          — 'chat_turn' | 'host_chat'
 * @param {string} args.sessionId         — couples the turn to the signal bus
 *                                           subscription + any decision prompt
 *                                           (builder session id, or the home
 *                                           chat's client conversationId).
 * @param {string} args.text              — the operator's latest message.
 * @param {Array}  [args.history]         — prior turns [{role, content}].
 * @param {object} [args.extraInputs]     — merged into queue `inputs` (e.g.
 *                                           { image_base64, image_mime }).
 * @param {object} [args.callerRef]       — queue caller_ref; defaults to
 *                                           { kind: taskKind, sessionId }.
 * @param {string|null} [args.locale]
 * @param {object} args.controller        — SSE ReadableStream controller.
 * @param {object} args.encoder           — TextEncoder.
 * @param {number} [args.submitTimeoutMs]
 * @param {(answer:string, envelope:object)=>Promise<void>|void} [args.onAnswer]
 *        — runs after the `text` event, before `done` (session bookkeeping).
 * @param {object|((answer:string, envelope:object)=>Promise<object>|object)} [args.doneFields]
 *        — extra fields merged into the `done` event.
 * @returns {Promise<{ok:true, answer, envelope} | {ok:false, code, message}>}
 */
export async function relayAgentTurn({
  taskKind,
  sessionId,
  text,
  history = [],
  extraInputs = {},
  callerRef,
  locale = null,
  controller,
  encoder,
  submitTimeoutMs = DEFAULT_SUBMIT_TIMEOUT_MS,
  onAnswer,
  doneFields,
}) {
  sendEvent(controller, encoder, 'modulo_expression', { state: 'thinking' });

  // Forward bus events verbatim — they're already shaped as { type, data }
  // matching the SSE EventTypes. Unsubscribed in the finally before close.
  const unsubscribeSignals = subscribeChatSignals(sessionId, (evt) => {
    try {
      sendEvent(controller, encoder, evt.type, evt.data || {});
    } catch {
      // controller already closed — ignore
    }
  });

  try {
    const { envelope } = await parkRequest(
      {
        task_kind: taskKind,
        inputs: { text, ...extraInputs },
        protocol_context: { sessionId, history, locale },
        caller_ref: callerRef || { kind: taskKind, sessionId },
      },
      { submitTimeoutMs },
    );

    const answer = typeof envelope?.answer === 'string' ? envelope.answer : '';
    sendEvent(controller, encoder, 'text', { text: answer });

    if (onAnswer) await onAnswer(answer, envelope);

    sendEvent(controller, encoder, 'modulo_expression', { state: 'idle' });

    const extra =
      typeof doneFields === 'function'
        ? await doneFields(answer, envelope)
        : doneFields || {};
    sendEvent(controller, encoder, 'done', extra);

    return { ok: true, answer, envelope };
  } catch (error) {
    if (error instanceof AgentTaskError) {
      sendEvent(controller, encoder, 'modulo_expression', { state: 'concerned' });
      sendEvent(controller, encoder, 'error', {
        error: error.message,
        code: error.code,
      });
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  } finally {
    unsubscribeSignals();
  }
}
