/**
 * MCP tool-layer telemetry — the single instrumentation seam.
 *
 * server.js routes BOTH handler call paths (rpc `tools/call` and the plan-mode
 * executor) through `instrumentedInvoke`, so every tool invocation — including
 * future transports — is timed, logged, and (optionally) persisted from one
 * place. See lib/mcp/observability.plan.md.
 *
 * Invariants (enforced here):
 *   - Never persist input VALUES by default. We record the input's SHAPE —
 *     top-level key names + serialized byte size — never the values. Full
 *     capture is the explicit, off-by-default MOJULO_MCP_TELEMETRY_CAPTURE=full
 *     debug flag.
 *   - A telemetry failure must never fail or slow a tool call: the DB write is
 *     fire-and-forget inside a try/catch and degrades to the stderr line.
 *   - The timeout is SOFT. JS can't cancel a running handler, so on timeout we
 *     unblock the session and flag the call; the orphaned promise is watched so
 *     its eventual settle is recorded as `late_settle` (which is what
 *     distinguishes "slow" from "hung forever" after the fact).
 */

import { performance } from 'node:perf_hooks';
import { getClientInfo } from '@/lib/mcp/client-bindings';
import { McpToolCallRepository } from '@/lib/db/repositories/mcpToolCalls';

export const DEFAULT_TOOL_TIMEOUT_MS = 120_000;
const ERROR_MESSAGE_MAX = 500;
const CAPTURE_JSON_MAX = 4096;

// Distinct sentinel so we can tell the timeout branch from a real handler
// rejection in the race below.
const TIMEOUT = Symbol('mcp-tool-timeout');

export function telemetryEnabled() {
  return process.env.MOJULO_MCP_TELEMETRY !== 'off';
}

export function fullCaptureEnabled() {
  return process.env.MOJULO_MCP_TELEMETRY_CAPTURE === 'full';
}

function resolveTimeoutMs(tool) {
  if (tool && Number.isFinite(tool.timeoutMs) && tool.timeoutMs > 0) return tool.timeoutMs;
  const env = Number(process.env.MOJULO_MCP_TOOL_TIMEOUT_MS);
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_TOOL_TIMEOUT_MS;
}

function truncate(text, max) {
  if (typeof text !== 'string') return text == null ? null : String(text);
  return text.length > max ? text.slice(0, max) : text;
}

// Input SHAPE only — never values. Top-level key names + serialized byte size.
function computeInputShape(input) {
  let keys = [];
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    keys = Object.keys(input);
  }
  let bytes = 0;
  try {
    bytes = JSON.stringify(input ?? {}).length;
  } catch {
    bytes = 0;
  }
  return { keys, bytes };
}

function serializedBytes(value) {
  try {
    return JSON.stringify(value ?? null)?.length ?? 0;
  } catch {
    return null;
  }
}

// Full-capture debug payloads — only computed when the flag is on. Tools that
// handle secrets (e.g. mint_role_key returns a bearer token once) register
// `noCapture: true` and are exempt even under the debug flag: secret material
// never persists to mcp_tool_calls.
function captureJson(value, tool) {
  if (tool?.noCapture) return null;
  if (!fullCaptureEnabled()) return null;
  try {
    return truncate(JSON.stringify(value ?? null), CAPTURE_JSON_MAX);
  } catch {
    return null;
  }
}

function recordRow(row) {
  // Fire-and-forget. A telemetry write must never break a tool call.
  try {
    McpToolCallRepository.record(row);
  } catch (err) {
    console.error('[mcp] telemetry write failed:', err?.message || err);
  }
}

// --- Handler-attached outcome signals (orientation-ramp.plan.md R4) ---
//
// A handler may attach `_telemetrySignal` to its result — a small object of
// NUMBERS and ENUMS describing the call's outcome shape (e.g. semantic_search
// → { top_score, result_count, kinds }; a vocab drawer → { id_requested,
// found }). The key is stripped here on EVERY path (including telemetry-off)
// so it never reaches the wire; the sanitized value persists to signal_json.
// Same discipline as input_keys: shapes and numbers, never values — the
// sanitizer enforces it mechanically (short strings only, shallow, capped).

const SIGNAL_STRING_MAX = 64;
const SIGNAL_JSON_MAX = 512;

function sanitizeSignal(signal) {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) return null;
  const out = {};
  for (const [key, value] of Object.entries(signal)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string') out[key] = truncate(value, SIGNAL_STRING_MAX);
    else if (Array.isArray(value)) {
      out[key] = value
        .slice(0, 16)
        .filter((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
        .map((v) => (typeof v === 'string' ? truncate(v, SIGNAL_STRING_MAX) : v));
    }
    // objects / functions / anything deeper: dropped.
  }
  if (Object.keys(out).length === 0) return null;
  try {
    return truncate(JSON.stringify(out), SIGNAL_JSON_MAX);
  } catch {
    return null;
  }
}

// Pull the signal off the result (mutating it so the key never serializes to
// the wire) and return the sanitized JSON string or null.
function takeSignal(result) {
  if (!result || typeof result !== 'object' || !('_telemetrySignal' in result)) return null;
  const signal = result._telemetrySignal;
  delete result._telemetrySignal;
  return sanitizeSignal(signal);
}

function logLine({ tool, durationMs, status, via, sessionId }) {
  const ms = Math.round(durationMs);
  const session = sessionId ? ` session=${sessionId}` : '';
  console.error(`[mcp] tool=${tool} ms=${ms} ${status} via=${via}${session}`);
}

/**
 * Run a registered tool's handler with telemetry + a soft timeout.
 *
 * Preserves each caller's existing control flow: returns the raw handler result
 * on success, and THROWS on error or timeout (handleToolCall maps a throw to an
 * isError result; the plan executor records it as a failed step). The timeout
 * message names /observability and get_tool_telemetry so the operator can find
 * the flagged call.
 *
 * @param {object} tool - the registered tool ({ name, handler, timeoutMs? }).
 * @param {object} input - tool arguments.
 * @param {object} context - execution context ({ mcpSessionId, ... }).
 * @param {object} opts - { via: 'rpc' | 'plan-executor', name: called-name }.
 */
export async function instrumentedInvoke(tool, input, context, { via, name } = {}) {
  const calledName = name || tool?.name || 'unknown';

  // Fast path: telemetry off ⇒ no timing, no timeout, no record. The signal
  // key is still stripped so it never leaks to the wire.
  if (!telemetryEnabled()) {
    const result = await tool.handler(input || {}, context || {});
    takeSignal(result);
    return result;
  }

  const sessionId = context?.mcpSessionId || null;
  const client = sessionId ? getClientInfo(sessionId) : null;
  const { keys, bytes } = computeInputShape(input);
  const startedAt = Date.now();
  const started = performance.now();
  const timeoutMs = resolveTimeoutMs(tool);

  const base = {
    tool: calledName,
    via: via || 'rpc',
    sessionId,
    client,
    // Per-key attribution (roles-pack.plan.md Phase 1): 'local' for the
    // operator; a delegate's user id when a roles-pack key made the call.
    userId: context?.userId || null,
    startedAt,
    inputKeys: keys,
    inputBytes: bytes,
    inputJson: captureJson(input, tool),
  };

  // Race the handler against a soft timeout. The handler promise is retained so
  // that on timeout we can watch it settle (late_settle) rather than orphan it.
  const handlerPromise = Promise.resolve().then(() => tool.handler(input || {}, context || {}));
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(TIMEOUT), timeoutMs);
  });

  try {
    const result = await Promise.race([handlerPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    const durationMs = performance.now() - started;
    const signalJson = takeSignal(result); // strip BEFORE measuring wire bytes
    recordRow({
      ...base,
      durationMs,
      status: 'ok',
      resultBytes: serializedBytes(result),
      resultJson: captureJson(result, tool),
      signalJson,
    });
    logLine({ tool: calledName, durationMs, status: 'ok', via: base.via, sessionId });
    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    const durationMs = performance.now() - started;

    if (err === TIMEOUT) {
      recordRow({ ...base, durationMs, status: 'timeout', errorMessage: `exceeded ${timeoutMs}ms budget` });
      logLine({ tool: calledName, durationMs, status: 'timeout', via: base.via, sessionId });

      // Watch the orphaned handler so its true outcome is recorded once it
      // finally settles. late_settle carries the REAL duration from start.
      handlerPromise.then(
        (lateResult) => {
          const lateMs = performance.now() - started;
          const lateSignalJson = takeSignal(lateResult);
          recordRow({
            ...base,
            durationMs: lateMs,
            status: 'late_settle',
            resultBytes: serializedBytes(lateResult),
            resultJson: captureJson(lateResult, tool),
            signalJson: lateSignalJson,
          });
          logLine({ tool: calledName, durationMs: lateMs, status: 'late_settle', via: base.via, sessionId });
        },
        (lateErr) => {
          const lateMs = performance.now() - started;
          recordRow({
            ...base,
            durationMs: lateMs,
            status: 'late_settle',
            errorMessage: truncate(lateErr?.message || String(lateErr), ERROR_MESSAGE_MAX),
          });
          logLine({ tool: calledName, durationMs: lateMs, status: 'late_settle', via: base.via, sessionId });
        }
      );

      throw new Error(
        `${calledName} exceeded its ${timeoutMs}ms budget; the work may still be running. ` +
          `Check /observability or get_tool_telemetry.`
      );
    }

    recordRow({
      ...base,
      durationMs,
      status: 'error',
      errorMessage: truncate(err?.message || String(err), ERROR_MESSAGE_MAX),
    });
    logLine({ tool: calledName, durationMs, status: 'error', via: base.via, sessionId });
    throw err;
  }
}
