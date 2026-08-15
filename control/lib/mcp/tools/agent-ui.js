/**
 * MCP Ring 7 (runtime) — agent-ui surface for the agent-routed chat builder.
 *
 * Two tools the chat-builder worker uses while fulfilling a `chat_turn` task,
 * so the operator gets "the right answer at the right time" without the
 * worker being a black box for the length of the turn:
 *
 *   - `emit_chat_signal({ session_id, kind, text? | phase? })` — fire-and-forget
 *     narration. Maps onto the existing builder SSE vocabulary: `note` →
 *     a `text` delta that streams into the assistant bubble, `phase` → a
 *     `modulo_expression` avatar state. The browser needs no new rendering.
 *
 *   - `request_chat_decision({ session_id, question, options[], allow_text?,
 *     wait_ms?, prompt_id? })` — the reverse path. Publishes a `decision`
 *     event the UI renders as an inline card, then long-polls for the
 *     operator's answer (re-poll with the returned `prompt_id`). One shape
 *     covers approve/deny (two options), pick-one, and free-text.
 *
 * Both publish through [lib/agent-ui/signal-bus.js] keyed on the builder
 * `session_id` the worker reads from the pull manifest's
 * `caller_ref.sessionId`. Only the MCP-connected interactive worker can call
 * these; the headless node-fulfiller has no MCP connection and emits nothing.
 *
 * See lite-template/integration/app-system/0528/agent-routed-chat-ui-signals.md
 */

import { registerTool } from '@/lib/mcp/server';
import {
  publish,
  createDecision,
  awaitDecision,
  disposeDecision,
} from '@/lib/agent-ui/signal-bus';

// The avatar states the builder UI already understands (ModuloAvatar).
const PHASE_STATES = new Set([
  'thinking',
  'speaking',
  'idle',
  'success',
  'concerned',
  'celebrating',
]);

// Per-call long-poll ceiling — kept under reverse-proxy idle cutoffs, same
// idiom as pull_agent_task. The decision survives across re-polls; only the
// bus's absolute TTL ends it.
const DECISION_POLL_CEILING_MS = 45_000;

export async function emitChatSignalHandler(input = {}) {
  const sessionId = input.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('session_id is required (string)');
  }
  const kind = input.kind;

  if (kind === 'note') {
    const text = typeof input.text === 'string' ? input.text : '';
    if (!text.trim()) throw new Error("kind 'note' requires a non-empty `text`");
    // Trailing newline so consecutive progress notes render as separate lines
    // (and the final answer, which follows in its own bubble, isn't glued on).
    const line = text.endsWith('\n') ? text : `${text}\n`;
    const delivered = publish(sessionId, { type: 'text', data: { text: line } });
    return { delivered };
  }

  if (kind === 'phase') {
    const state = input.phase;
    if (!PHASE_STATES.has(state)) {
      throw new Error(`kind 'phase' requires \`phase\` ∈ ${[...PHASE_STATES].join(', ')}`);
    }
    const delivered = publish(sessionId, { type: 'modulo_expression', data: { state } });
    return { delivered };
  }

  throw new Error("`kind` must be 'note' or 'phase'");
}

function normalizeOptions(options) {
  return options.map((o, i) => {
    const id = typeof o?.id === 'string' && o.id ? o.id : `opt_${i}`;
    const label = typeof o?.label === 'string' && o.label ? o.label : id;
    const out = { id, label };
    if (typeof o?.description === 'string' && o.description) out.description = o.description;
    return out;
  });
}

export async function requestChatDecisionHandler(input = {}) {
  const sessionId = input.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('session_id is required (string)');
  }
  const waitMs = Math.max(
    0,
    Math.min(
      typeof input.wait_ms === 'number' ? input.wait_ms : DECISION_POLL_CEILING_MS,
      DECISION_POLL_CEILING_MS,
    ),
  );

  // Re-poll path: continue waiting on an already-created decision.
  if (input.prompt_id) {
    const result = await awaitDecision(input.prompt_id, waitMs);
    if (result.status === 'answered' || result.status === 'expired' || result.status === 'unknown') {
      disposeDecision(input.prompt_id);
    }
    return result;
  }

  // Create path.
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  if (!question) throw new Error('`question` is required when creating a decision');
  const options = Array.isArray(input.options) ? input.options : [];
  const allowText = !!input.allow_text;
  if (options.length === 0 && !allowText) {
    throw new Error('provide at least one `options` entry, or set `allow_text:true`');
  }
  const normOptions = normalizeOptions(options);

  const { promptId } = createDecision(sessionId);
  const delivered = publish(sessionId, {
    type: 'decision',
    data: {
      prompt_id: promptId,
      question,
      options: normOptions,
      allow_text: allowText,
    },
  });

  if (!delivered) {
    // No live chat stream for this session — the turn's SSE isn't open
    // (e.g. fulfilled outside an agent-routed chat turn). Don't block on a
    // card nobody can see; tell the worker to fall back.
    disposeDecision(promptId);
    return { status: 'no_listener', prompt_id: promptId };
  }

  const result = await awaitDecision(promptId, waitMs);
  if (result.status === 'answered' || result.status === 'expired') {
    disposeDecision(promptId);
  }
  return result;
}

export function registerAgentUiTools() {
  registerTool({
    name: 'emit_chat_signal',
    description:
      "Narrate progress to the operator during an agent-routed chat builder turn. Fire-and-forget; never blocks. Pass the `session_id` from your pulled task's `caller_ref.sessionId`. `kind:'note'` streams `text` into the assistant's reply bubble (use for short progress lines as a long turn unfolds); `kind:'phase'` sets the avatar state (`thinking` | `speaking` | `success` | `concerned` | `celebrating` | `idle`). Returns `{ delivered }` — `false` means the turn's chat stream is already closed (you're not in a live chat turn), so stop emitting. Only reachable from the interactive worker; the headless node-fulfiller has no MCP connection and should not call this.",
    inputSchema: {
      type: 'object',
      required: ['session_id', 'kind'],
      properties: {
        session_id: {
          type: 'string',
          description: "The builder session id from the pulled chat_turn manifest's `caller_ref.sessionId`.",
        },
        kind: {
          type: 'string',
          enum: ['note', 'phase'],
          description: "'note' = a short progress line (requires `text`); 'phase' = avatar state (requires `phase`).",
        },
        text: {
          type: 'string',
          description: "For kind 'note': the progress line to stream into the reply bubble.",
        },
        phase: {
          type: 'string',
          enum: ['thinking', 'speaking', 'idle', 'success', 'concerned', 'celebrating'],
          description: "For kind 'phase': the avatar state to show.",
        },
      },
    },
    handler: emitChatSignalHandler,
  });

  registerTool({
    name: 'request_chat_decision',
    description:
      "Ask the operator a structured question mid-turn and get their answer back — the 'right answer at the right time' affordance for agent-routed chat. Use ONLY when a choice genuinely needs the operator (ambiguous intent, a destructive/deploy action, a fork); otherwise just answer. First call: pass `session_id` (from `caller_ref.sessionId`), `question`, and `options` (`[{id,label,description?}]`; two options like allow/deny model an approval) and/or `allow_text:true`. It renders an inline card and long-polls up to `wait_ms` (≤45000). Returns `{ status:'answered', selected?, text? }`, or `{ status:'waiting', prompt_id }` (re-call with that `prompt_id` to keep waiting), or `{ status:'expired' }` (operator never answered — fall back to a sensible default and proceed; do NOT hang), or `{ status:'no_listener' }` (no live chat stream — fall back). Reachable only from the interactive worker.",
    inputSchema: {
      type: 'object',
      required: ['session_id'],
      properties: {
        session_id: {
          type: 'string',
          description: "The builder session id from the pulled chat_turn manifest's `caller_ref.sessionId`.",
        },
        prompt_id: {
          type: 'string',
          description: "Omit on the first call (creates the decision). Pass the `prompt_id` returned by a `waiting` result to continue waiting for the same decision.",
        },
        question: {
          type: 'string',
          description: 'The question to show the operator. Required when creating (no `prompt_id`).',
        },
        options: {
          type: 'array',
          description: 'Selectable answers. Use `[{id:"allow",label:"Allow"},{id:"deny",label:"Deny"}]` for an approval, or any pick-one set.',
          items: {
            type: 'object',
            required: ['label'],
            properties: {
              id: { type: 'string', description: 'Stable id returned as `selected`. Defaults to opt_<index> if omitted.' },
              label: { type: 'string', description: 'Button text.' },
              description: { type: 'string', description: 'Optional sub-label explaining the choice.' },
            },
          },
        },
        allow_text: {
          type: 'boolean',
          description: 'Also accept a free-text answer (returned as `text`). Set true for open-ended prompts.',
        },
        wait_ms: {
          type: 'integer',
          minimum: 0,
          maximum: 45000,
          description: 'How long this call blocks waiting for an answer. Default/ceiling 45000ms. On `waiting`, re-call with `prompt_id`.',
        },
      },
    },
    handler: requestChatDecisionHandler,
    // Long-poll: blocks up to wait_ms awaiting the operator's answer — must
    // bypass the single-writer tool queue (server.js runSerialized) or the
    // wait starves every call queued behind it.
    concurrent: true,
  });
}
