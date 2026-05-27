// Envelope client — invokes mojulo's agent-routed inference primitive from
// the running app. Routes through the control plane HTTP route
// `/api/app-inference/envelope`, which parks the request in mojulo's
// REST↔MCP translator. The operator's Claude Code agent — running in worker
// mode via /loop + the `run-inference-worker` catalyst — pulls the parked
// request, generates the envelope, and submits it. The HTTP call returns
// when the agent submits.
//
// Mojulo holds NO LLM credentials on this path. The agent is the inference
// engine; the control plane is the matchmaking layer.
//
// Framework-agnostic. Pass `baseUrl`, `bearer`, `callerRef` explicitly —
// the function uses `fetch`, which is available in Node 18+ and every
// modern browser. The recommended pattern for the spike (Express + vanilla
// HTML/CSS) is server-side: keep the bearer in the app's `.env` and call
// this from an Express handler, then have the browser hit your own
// endpoint. That way the bearer never crosses to the browser.
//
// Server-side usage (Express handler):
//
//   import { runProtocolEnvelope, NoAgentWorkerError, InferenceTimeoutError,
//            InferenceCancelledError } from './app-mcp/lib/envelope-client.js';
//
//   app.post('/infer', async (req, res) => {
//     try {
//       const result = await runProtocolEnvelope({
//         baseUrl:  process.env.MOJULO_CONTROL_PLANE_URL,
//         bearer:   process.env.MOJULO_CONTROL_PLANE_KEY,
//         callerRef: process.env.MOJULO_APP_REF,
//         inputs: { text: req.body.prompt, image_base64: req.body.image_base64 },
//       });
//       res.json(result);
//     } catch (err) {
//       if (err.code === 'NO_AGENT_WORKER') {
//         return res.status(503).json({ error: 'Start your mojulo agent worker loop.' });
//       }
//       if (err.code === 'INFERENCE_TIMEOUT') {
//         return res.status(504).json({ error: 'The mojulo agent did not respond in time.' });
//       }
//       if (err.code === 'INFERENCE_CANCELLED') {
//         return res.status(422).json({ error: err.message });
//       }
//       res.status(500).json({ error: err.message });
//     }
//   });
//
// The app's `.env` should carry:
//   MOJULO_CONTROL_PLANE_URL=http://127.0.0.1:3001
//   MOJULO_CONTROL_PLANE_KEY=<bearer from control/.env's CONTROL_PLANE_MCP_KEY>
//   MOJULO_APP_REF=<materialization ref — typically adapter_id:locator>
//
// Operator UX: before using inference-dependent apps, run
//   /loop /get_catalyst run-inference-worker
// in your Claude Code session. The catalyst tells the agent how to long-poll
// `pull_pending_inference` and submit envelopes via `submit_inference_result`.

export class NoAgentWorkerError extends Error {
  constructor(message = 'No mojulo agent worker is polling. Run `/loop /run-inference-worker` in your Claude Code session.') {
    super(message);
    this.code = 'NO_AGENT_WORKER';
  }
}

export class InferenceTimeoutError extends Error {
  constructor(message = 'The mojulo agent pulled the request but did not submit a result in time.') {
    super(message);
    this.code = 'INFERENCE_TIMEOUT';
  }
}

export class InferenceCancelledError extends Error {
  constructor(message = 'The mojulo agent cancelled the inference request.') {
    super(message);
    this.code = 'INFERENCE_CANCELLED';
  }
}

export class EnvelopeClientError extends Error {
  constructor(message, { code = 'ENVELOPE_CLIENT_ERROR', status, cause } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

// Distinct from a wrong-bearer 401: this is the control plane's session
// middleware refusing the request because the bearer didn't unlock the
// outer gate. Usually means the operator turned on HTTP login
// (CONTROL_PLANE_USER/PASSWORD) but the app's MOJULO_CONTROL_PLANE_KEY
// doesn't match CONTROL_PLANE_MCP_KEY. Separate class so the app can
// surface a more specific affordance.
export class SessionRequiredError extends Error {
  constructor(message = 'Control plane session middleware rejected the call — check that MOJULO_CONTROL_PLANE_KEY matches CONTROL_PLANE_MCP_KEY.') {
    super(message);
    this.code = 'SESSION_REQUIRED';
  }
}

function joinUrl(base, path) {
  if (!base) throw new EnvelopeClientError('baseUrl is required', { code: 'INVALID_INPUT' });
  return `${base.replace(/\/+$/, '')}${path}`;
}

/**
 * @typedef RunProtocolEnvelopeInput
 * @property {string} baseUrl                — control plane base URL (e.g. http://127.0.0.1:3001)
 * @property {string} bearer                 — CONTROL_PLANE_MCP_KEY value
 * @property {object} inputs                 — { text?, image_base64?, image_mime?, image? }
 * @property {object} [envelope_schema]      — optional JSON Schema for the response
 * @property {object} [protocol_context]     — optional app-supplied guidance
 * @property {string} [callerRef]            — calling app's materialization ref
 * @property {string} [model]                — optional model hint recorded in the audit principle
 * @property {AbortSignal} [signal]
 */

/**
 * Call mojulo's agent-routed inference primitive. Returns the envelope and
 * call metadata. Throws typed errors for the operator-visible failure
 * states (no worker, timeout, cancelled).
 *
 * @param {RunProtocolEnvelopeInput} opts
 * @returns {Promise<{ envelope: object, mode: string, model: string|null, duration_ms: number, request_id: string }>}
 */
export async function runProtocolEnvelope(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new EnvelopeClientError('runProtocolEnvelope requires an options object', {
      code: 'INVALID_INPUT',
    });
  }
  const { baseUrl, bearer, inputs, envelope_schema, protocol_context, callerRef, model, signal } = opts;
  if (!bearer) {
    throw new EnvelopeClientError('bearer is required (control plane MCP key)', {
      code: 'INVALID_INPUT',
    });
  }
  if (!inputs || typeof inputs !== 'object') {
    throw new EnvelopeClientError('inputs is required, e.g. { text: "..." }', {
      code: 'INVALID_INPUT',
    });
  }

  const url = joinUrl(baseUrl, '/api/app-inference/envelope');
  const body = { inputs };
  if (envelope_schema) body.envelope_schema = envelope_schema;
  if (protocol_context) body.protocol_context = protocol_context;
  if (callerRef) body.caller_ref = callerRef;
  if (model) body.model = model;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    throw new EnvelopeClientError('Failed to reach the control plane envelope route', {
      code: 'NETWORK_ERROR',
      cause,
    });
  }

  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    // Fall through — empty/non-JSON body. parsed stays null; error handling
    // below uses status as the source of truth.
  }

  if (!res.ok) {
    const code = parsed?.code;
    const message = parsed?.error || `Envelope call failed: HTTP ${res.status}`;
    if (code === 'SESSION_REQUIRED') throw new SessionRequiredError(message);
    if (code === 'NO_AGENT_WORKER') throw new NoAgentWorkerError(message);
    if (code === 'INFERENCE_TIMEOUT') throw new InferenceTimeoutError(message);
    if (code === 'INFERENCE_CANCELLED') throw new InferenceCancelledError(message);
    throw new EnvelopeClientError(message, {
      code: code || 'ENVELOPE_HTTP_ERROR',
      status: res.status,
    });
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new EnvelopeClientError('Envelope route returned a non-JSON body', {
      code: 'ENVELOPE_INVALID_RESPONSE',
      status: res.status,
    });
  }
  return parsed;
}
