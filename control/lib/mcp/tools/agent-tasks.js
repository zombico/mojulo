/**
 * MCP Ring 7 (runtime) — agent-tasks surface.
 *
 * mojulo's opinionated runtime primitive for agent-mediated,
 * schema-validated work. Three tools for the operator's Claude Code
 * agent running in worker mode:
 *
 *   - `pull_agent_task({ wait_ms?, kinds? })` — long-poll. Returns the
 *     next parked task (or null on no-work). Manifest carries
 *     `task_kind` so the worker catalyst can dispatch to the right
 *     per-kind submit tool. Marks the entry in_flight so concurrent
 *     pullers don't double-claim.
 *
 *   - Per-kind submit tools — each task_kind has its own submit tool
 *     with the kind's response schema embedded as inputSchema. MCP's
 *     protocol layer rejects structurally-invalid responses at the wire,
 *     not in the handler. Today there is one:
 *       `submit_envelope_inference({ request_id, envelope, model? })`
 *     Future kinds (classification, decision, structuring) ship their
 *     own per-kind submit tools (`submit_classification`, etc.).
 *
 *   - `cancel_agent_task({ request_id, reason })` — kind-agnostic
 *     escape hatch. Releases the parked HTTP with a typed
 *     `INFERENCE_CANCELLED` error. No principle is recorded —
 *     cancellations are operator-visible errors, not outcomes.
 *
 * Ring 7, registered after the runner tools so the reading order in
 * tools/list flows lifecycle → agent-tasks (pull → submit → cancel).
 *
 * See APP_SPIKE_A_REFRAME_PLAN.md and spike_qualities.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { ENVELOPE_SCHEMA } from '@/lib/envelope-schema';
import {
  pullNext,
  deliverResult,
  cancel,
  getInFlightPayload,
  AgentTaskError,
} from '@/lib/mcp/agent-tasks/queue';
import { recordInferenceOutcome } from '@/lib/mcp/agent-tasks/audit';

const TASK_KIND_ENVELOPE_INFERENCE = 'envelope_inference';
const TASK_KIND_CHAT_TURN = 'chat_turn';
const TASK_KIND_HOST_CHAT = 'host_chat';

// Envelope-shaped kinds share one submit tool + the canonical envelope schema.
// `chat_turn` is the builder web-chat relay (see agent-routed-chat.md) and
// `host_chat` is the home-page unfiltered relay (see home-agent-chat.md): both
// answer a conversational turn with the same { answer, suggestions, ... }
// envelope an app inference uses, so they ride submit_envelope_inference rather
// than shipping a redundant per-kind submit tool.
const ENVELOPE_SHAPED_KINDS = new Set([
  TASK_KIND_ENVELOPE_INFERENCE,
  TASK_KIND_CHAT_TURN,
  TASK_KIND_HOST_CHAT,
]);

// Run-rate conversational kinds record NO contextmap principle — a principle
// per chat turn would flood the deliberation log. Only true app inferences are
// audited. (Structural actions the agent takes WITH its tools still commit
// their own principles through those tools.)
const RUN_RATE_CHAT_KINDS = new Set([TASK_KIND_CHAT_TURN, TASK_KIND_HOST_CHAT]);

function submitToolNameForKind(taskKind) {
  if (ENVELOPE_SHAPED_KINDS.has(taskKind)) return 'submit_envelope_inference';
  return 'submit_agent_task'; // generic fallback; future kinds ship their own.
}

export async function pullAgentTaskHandler(input = {}, context = {}) {
  const waitMs = typeof input.wait_ms === 'number' ? input.wait_ms : undefined;
  // Optional kind filter so a specialized worker (e.g. the chat-builder worker)
  // claims only its kind and never cancels tasks meant for another worker.
  const kindsFilter =
    Array.isArray(input.kinds) && input.kinds.length > 0 ? input.kinds : undefined;
  // Lane = the caller's account (roles-pack Phase 3): a delegate's connected
  // agent pulls only its own user's tasks; the operator pulls 'local'. With
  // roles off pullNext ignores lanes entirely.
  const entry = await pullNext({ waitMs, kindsFilter, forUserId: context.userId });
  if (!entry) return { request: null };

  const payload = entry.payload || {};
  const responseInputs = { ...(payload.inputs || {}) };
  const taskKind = payload.task_kind || TASK_KIND_ENVELOPE_INFERENCE;

  const content = [];
  const manifest = {
    request_id: entry.id,
    task_kind: taskKind,
    submit_tool: submitToolNameForKind(taskKind),
    envelope_schema: payload.envelope_schema || ENVELOPE_SCHEMA,
    protocol_context: payload.protocol_context || null,
    caller_ref: payload.caller_ref || null,
    inputs: {
      text: typeof responseInputs.text === 'string' ? responseInputs.text : null,
      image_present: !!(responseInputs.image_base64 || responseInputs.image?.base64),
    },
    parked_at: entry.parkedAt,
  };
  content.push({ type: 'text', text: JSON.stringify(manifest, null, 2) });

  const imageBase64 = responseInputs.image_base64 || responseInputs.image?.base64;
  const imageMime = responseInputs.image_mime || responseInputs.image?.mime || 'image/png';
  if (imageBase64) {
    content.push({
      type: 'image',
      data: imageBase64,
      mimeType: imageMime,
    });
  }

  return { content, _structured: manifest };
}

export async function submitEnvelopeInferenceHandler(input = {}) {
  const requestId = input.request_id;
  const envelope = input.envelope;
  const model = typeof input.model === 'string' ? input.model : null;

  if (!requestId || typeof requestId !== 'string') {
    throw new Error('request_id is required (string)');
  }
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('envelope is required (object)');
  }
  if (typeof envelope.answer !== 'string') {
    throw new Error('envelope.answer is required (string)');
  }

  const lookup = getInFlightPayload(requestId);
  if (!lookup) {
    throw new Error(`No in-flight request found for request_id ${requestId}`);
  }
  const { payload, parkedAt } = lookup;

  // Kind guard: this submit services envelope-shaped tasks (envelope_inference,
  // chat_turn). Wrong-kind submits should cancel with reason 'wrong worker kind'
  // so a kind-specific worker can pick the task up.
  const taskKind = payload.task_kind || TASK_KIND_ENVELOPE_INFERENCE;
  if (!ENVELOPE_SHAPED_KINDS.has(taskKind)) {
    throw new Error(
      `submit_envelope_inference cannot service task_kind '${taskKind}'. ` +
        `Call cancel_agent_task with reason 'wrong worker kind' instead.`,
    );
  }

  const durationMs = Date.now() - parkedAt;

  // Audit BEFORE unblocking the HTTP response so the principle is durable
  // before the app sees its answer. Better-sqlite3 is synchronous; a
  // write failure logs and continues — we'd rather deliver the inference
  // and lose audit than fail the inference.
  const fulfillerStamp = { kind: 'agent-mcp', model: model || undefined };

  // chat_turn / host_chat relay the web chats (builder + home page). These are
  // run-rate conversational turns, not structural outcomes, so they do NOT
  // write a contextmap principle — recording one per turn would flood the
  // deliberation log. Only true app inferences are audited.
  let principleId = null;
  if (!RUN_RATE_CHAT_KINDS.has(taskKind)) {
    try {
      const { principle } = recordInferenceOutcome({
        caller_ref: payload.caller_ref,
        inputs: payload.inputs,
        envelope,
        durationMs,
        model,
        fulfiller: fulfillerStamp,
      });
      principleId = principle?.id ?? null;
    } catch (err) {
      console.error('[agent-tasks] principle recording failed:', err);
    }
  }

  try {
    deliverResult(requestId, envelope, { model, fulfiller: fulfillerStamp });
  } catch (err) {
    if (err instanceof AgentTaskError) {
      throw new Error(`Delivery failed: ${err.code} ${err.message}`);
    }
    throw err;
  }

  return {
    accepted: true,
    request_id: requestId,
    task_kind: taskKind,
    duration_ms: durationMs,
    principle_id: principleId,
  };
}

export async function cancelAgentTaskHandler(input = {}) {
  const requestId = input.request_id;
  const reason = typeof input.reason === 'string' ? input.reason : null;
  if (!requestId || typeof requestId !== 'string') {
    throw new Error('request_id is required (string)');
  }
  try {
    cancel(requestId, reason);
  } catch (err) {
    if (err instanceof AgentTaskError) {
      throw new Error(`Cancel failed: ${err.code} ${err.message}`);
    }
    throw err;
  }
  return { cancelled: true, request_id: requestId };
}

export function registerAgentTaskTools() {
  registerTool({
    name: 'pull_agent_task',
    description:
      "Worker-mode long-poll for mojulo's agent-tasks runtime primitive. Returns the next parked task (or `{ request: null }` if no work arrives within `wait_ms`). The manifest in the first content block carries `task_kind` (`envelope_inference` for app inference, `chat_turn` for the builder web-chat relay, `host_chat` for the home-page unfiltered relay) and the name of the per-kind submit tool the worker should call. If the task has an image input, it follows as a native MCP `image` content block. Pass `kinds` to claim only specific task_kinds so a specialized worker never cancels another worker's tasks. Pair every successful pull with either the per-kind submit tool (e.g. `submit_envelope_inference`) or `cancel_agent_task` — un-submitted requests time out and the caller sees an `INFERENCE_TIMEOUT` error.",
    inputSchema: {
      type: 'object',
      properties: {
        wait_ms: {
          type: 'integer',
          minimum: 0,
          maximum: 50000,
          description:
            'How long to block waiting for work. Default 25000ms; hard ceiling 50000ms (kept under reverse-proxy idle cutoffs). Pass 0 for a non-blocking poll.',
        },
        kinds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional: restrict to these task_kinds (e.g. ["chat_turn"] or ["envelope_inference"]). Omit to pull any kind. Use this so a specialized worker only claims tasks it can fulfill, leaving others for the right worker instead of cancelling them.',
        },
      },
    },
    handler: pullAgentTaskHandler,
    // Long-poll: blocks up to wait_ms awaiting parked work — must bypass the
    // single-writer tool queue (server.js runSerialized) or it starves every
    // call queued behind it.
    concurrent: true,
  });

  registerTool({
    name: 'submit_envelope_inference',
    description:
      "Deliver an envelope-shaped response to a previously-pulled envelope-shaped task (`envelope_inference`, `chat_turn`, or `host_chat`). The `envelope` field is validated against the canonical mojulo envelope schema by MCP's inputSchema layer — structurally-invalid envelopes are rejected at the protocol boundary before this handler runs. On success, an `app_inference` principle is recorded on the calling app's artifact node (when `caller_ref` resolved) before the parked HTTP response unblocks; the web-chat relays (`chat_turn`, `host_chat`) are run-rate and deliberately record no principle. For other task kinds, use the matching per-kind submit tool (none other exists yet).",
    inputSchema: {
      type: 'object',
      required: ['request_id', 'envelope'],
      properties: {
        request_id: {
          type: 'string',
          description: 'The `request_id` from the matching `pull_agent_task` manifest.',
        },
        envelope: {
          ...ENVELOPE_SCHEMA,
          description:
            'The structured envelope response. Must satisfy the canonical mojulo envelope schema (answer + optional suggestions / form / triage / appointment / extraction).',
        },
        model: {
          type: 'string',
          description:
            'Optional: the model the agent used to produce the envelope, recorded in the audit principle.',
        },
      },
    },
    handler: submitEnvelopeInferenceHandler,
  });

  registerTool({
    name: 'cancel_agent_task',
    description:
      "Escape hatch for a previously-pulled task the agent can't fulfill (image unreadable, prompt malformed, schema unsatisfiable, wrong worker kind). Kind-agnostic. Releases the parked HTTP response with a typed `INFERENCE_CANCELLED` error carrying the supplied `reason`. No audit principle is recorded — cancellations are operator-visible errors, not outcomes.",
    inputSchema: {
      type: 'object',
      required: ['request_id'],
      properties: {
        request_id: { type: 'string' },
        reason: {
          type: 'string',
          description: 'Short human-readable cause; surfaces to the app as the error message.',
        },
      },
    },
    handler: cancelAgentTaskHandler,
  });
}
