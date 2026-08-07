/**
 * claude-code-headless runtime adapter — invokes the Claude Code CLI as a
 * one-shot subprocess via `claude --print --output-format json`. Each task
 * gets its own subprocess; the operator's main Claude Code session stays
 * free for human use.
 *
 * The adapter builds a system prompt that mirrors the run-inference-worker
 * catalyst's operating instructions (distilled for a single invocation)
 * and a user prompt from the task payload's inputs + protocol_context. The
 * subprocess is expected to return a single JSON object whose `result`
 * field contains the envelope-shaped JSON the queue will validate.
 *
 * Vision: images are passed as base64 data URLs in the user prompt with a
 * note instructing the model to reason over the embedded image. (Native
 * image content blocks are not currently surface-exposed by `claude --print`
 * — the prompt-embedding fallback works on the spike, and we'll revisit if
 * a cleaner channel ships.)
 *
 * See AGENT_TASKS_NODE_DRIVEN_PLAN.md.
 */

import { execFile } from 'node:child_process';
import { AgentRuntimeError } from './errors.js';

const SYSTEM_PROMPT = `You are mojulo's headless inference worker. A control plane task is described below; produce a JSON envelope satisfying the embedded schema.

Hard rules:
- Output ONLY the JSON envelope. No surrounding prose, no markdown fences, no commentary.
- The envelope must satisfy the schema below; missing 'answer' is a failure.
- Reason over the user input and any embedded image fully before answering.
- If the input is genuinely unfulfillable, return a JSON object: {"_cancel":"<short reason>"} — the parent process treats that as a cancel signal.`;

// chat_turn relays the control plane's own web chat builder (agent-routed-chat.md).
// Headless: this one-shot subprocess has no mojulo MCP connection, so it answers
// conversationally only — the tool-driven build path runs in the operator's
// interactive worker session, not here.
const CHAT_TURN_SYSTEM_PROMPT = `You are the conversational brain of mojulo's chat builder — the web chat an operator uses to design and reason about their bot/app fleet. Answer the operator's latest message helpfully and concisely, grounded in the conversation so far.

Hard rules:
- Output ONLY a JSON envelope satisfying the embedded schema. No prose outside the JSON, no markdown fences.
- Put your reply to the operator in the 'answer' field. Optionally add up to 3 short 'suggestions' for what the operator might say next.
- You are running headless with no tools this turn. Answer conversationally. If the request needs you to actually build, deploy, or inspect bots, describe what you would do and ask the operator to confirm — the richer tool-driven path runs in their interactive agent session.
- If the message is genuinely unfulfillable, return {"_cancel":"<short reason>"}.`;

function buildUserPrompt({ taskPayload, envelope_schema }) {
  const parts = [];
  parts.push('## Envelope schema (must satisfy):');
  parts.push('```json');
  parts.push(JSON.stringify(envelope_schema, null, 2));
  parts.push('```');

  if (taskPayload?.protocol_context) {
    parts.push('## Protocol context (app guidance):');
    parts.push(typeof taskPayload.protocol_context === 'string'
      ? taskPayload.protocol_context
      : JSON.stringify(taskPayload.protocol_context, null, 2));
  }

  const text = taskPayload?.inputs?.text;
  if (typeof text === 'string' && text.length > 0) {
    parts.push('## User input text:');
    parts.push(text);
  }

  const imageBase64 = taskPayload?.inputs?.image_base64 || taskPayload?.inputs?.image?.base64;
  const imageMime = taskPayload?.inputs?.image_mime || taskPayload?.inputs?.image?.mime || 'image/png';
  if (imageBase64) {
    parts.push('## User input image (base64):');
    parts.push(`data:${imageMime};base64,${imageBase64}`);
    parts.push('Reason over the image above as part of producing the envelope.');
  }

  parts.push('## Produce the JSON envelope now.');
  return parts.join('\n\n');
}

function buildChatTurnUserPrompt({ taskPayload, envelope_schema }) {
  const parts = [];
  parts.push('## Envelope schema (must satisfy):');
  parts.push('```json');
  parts.push(JSON.stringify(envelope_schema, null, 2));
  parts.push('```');

  const ctx = taskPayload?.protocol_context || {};
  const history = Array.isArray(ctx.history) ? ctx.history : [];
  if (history.length > 0) {
    parts.push('## Conversation so far:');
    parts.push(
      history
        .map((m) => {
          const who = m.role === 'assistant' ? 'Assistant' : 'Operator';
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          return `${who}: ${content}`;
        })
        .join('\n'),
    );
  }
  if (ctx.locale) {
    parts.push(`## Reply in this language/locale: ${ctx.locale}`);
  }

  const text = taskPayload?.inputs?.text;
  parts.push("## Operator's latest message:");
  parts.push(typeof text === 'string' ? text : '');

  parts.push('## Produce the JSON envelope now — your reply goes in "answer".');
  return parts.join('\n\n');
}

function spawnClaudePrint({ systemPrompt, userPrompt, timeoutMs, signal }) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format', 'json',
      '--system-prompt', systemPrompt,
      userPrompt,
    ];
    const child = execFile('claude', args, {
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      maxBuffer: 16 * 1024 * 1024,
      signal,
    }, (err, stdout, stderr) => {
      if (err) {
        if (err.killed && err.signal === 'SIGKILL') {
          reject(new AgentRuntimeError(
            `Claude Code subprocess exceeded ${timeoutMs}ms timeout`,
            { code: 'RUNTIME_TIMEOUT', cause: err },
          ));
          return;
        }
        if (err.code === 'ENOENT') {
          reject(new AgentRuntimeError(
            "Claude Code CLI ('claude') not found on PATH. Install Claude Code or unset MOJULO_AGENT_RUNTIME.",
            { code: 'RUNTIME_INVOCATION_FAILED', cause: err },
          ));
          return;
        }
        reject(new AgentRuntimeError(
          `Claude Code subprocess failed: ${err.message}${stderr ? `\n--- stderr ---\n${stderr}` : ''}`,
          { code: 'RUNTIME_INVOCATION_FAILED', cause: err },
        ));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseClaudeOutput(stdout) {
  // `claude --print --output-format json` returns one JSON object whose
  // shape includes a `result` (string) field carrying the model's reply
  // alongside metadata. We extract that and parse the inner JSON.
  let outer;
  try {
    outer = JSON.parse(stdout);
  } catch (err) {
    throw new AgentRuntimeError(
      `Claude Code output was not valid JSON: ${err.message}`,
      { code: 'RUNTIME_OUTPUT_INVALID', cause: err },
    );
  }
  const inner = outer?.result;
  if (typeof inner !== 'string') {
    throw new AgentRuntimeError(
      "Claude Code JSON output missing string 'result' field",
      { code: 'RUNTIME_OUTPUT_INVALID' },
    );
  }
  const model = outer?.model || outer?.modelId || null;
  // The model may wrap its JSON in a code fence even with the explicit
  // instructions. Strip a single layer of fence before attempting parse.
  const stripped = inner.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  let envelope;
  try {
    envelope = JSON.parse(stripped);
  } catch (err) {
    throw new AgentRuntimeError(
      `Claude Code returned non-JSON envelope text: ${err.message}`,
      { code: 'RUNTIME_OUTPUT_INVALID', cause: err },
    );
  }
  if (envelope && typeof envelope === 'object' && typeof envelope._cancel === 'string') {
    throw new AgentRuntimeError(envelope._cancel, { code: 'RUNTIME_REJECTS_INPUT' });
  }
  return { envelope, model };
}

export const claudeCodeHeadlessAdapter = {
  id: 'claude-code-headless',
  capabilities: {
    vision: true,
    streaming: false,
  },
  supportedKinds: ['envelope_inference', 'chat_turn'],

  /**
   * @param {object} args
   * @param {object} args.taskPayload — the parked task payload
   *   ({ inputs, protocol_context, caller_ref, ... }).
   * @param {object} args.envelope_schema — schema the response must satisfy.
   * @param {number} args.timeoutMs — hard wall-clock budget for the
   *   subprocess; exceeded → SIGKILL → AgentRuntimeError(RUNTIME_TIMEOUT).
   * @param {AbortSignal} [args.signal] — propagated to the subprocess so
   *   the Node fulfiller's stop loop can cancel an in-flight invoke.
   * @returns {Promise<{ envelope, model }>}
   */
  invoke: async ({ taskPayload, envelope_schema, timeoutMs, signal }) => {
    const isChatTurn = taskPayload?.task_kind === 'chat_turn';
    const systemPrompt = isChatTurn ? CHAT_TURN_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const userPrompt = isChatTurn
      ? buildChatTurnUserPrompt({ taskPayload, envelope_schema })
      : buildUserPrompt({ taskPayload, envelope_schema });
    const { stdout } = await spawnClaudePrint({
      systemPrompt,
      userPrompt,
      timeoutMs,
      signal,
    });
    return parseClaudeOutput(stdout);
  },
};

export const _internals = {
  SYSTEM_PROMPT,
  CHAT_TURN_SYSTEM_PROMPT,
  buildUserPrompt,
  buildChatTurnUserPrompt,
  parseClaudeOutput,
};
