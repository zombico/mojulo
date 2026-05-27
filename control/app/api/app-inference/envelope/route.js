/**
 * Envelope inference HTTP route — the path materialized apps call.
 *
 * Apps POST `{ envelope_schema?, inputs, protocol_context?, caller_ref? }`
 * and get back the envelope-shaped response. Internally this parks an
 * `envelope_inference` task in mojulo's agent-tasks queue; the operator's
 * Claude Code agent (running in worker mode via /loop +
 * run-inference-worker catalyst) pulls it via `pull_agent_task`,
 * generates the envelope, and submits it via `submit_envelope_inference`.
 *
 * Error codes the app can surface:
 *   - NO_AGENT_WORKER (503) — no worker pulled the request in time.
 *   - INFERENCE_TIMEOUT (504) — worker pulled but didn't submit.
 *   - INFERENCE_CANCELLED (422) — worker called cancel_inference.
 *   - INFERENCE_PARKED_LOST (503) — control-plane restart mid-flight.
 *   - INVALID_JSON / INVALID_INPUT / UNAUTHORIZED — request-shape errors.
 *
 * Auth posture matches the rest of the control plane: opt-in only when
 * `CONTROL_PLANE_MCP_KEY` is set, bearer-checked. CORS is permissive
 * (`Access-Control-Allow-Origin: *`) because apps run on a separate port;
 * the control plane is local-only and bearer-gated so the wide-open
 * origin is acceptable spike posture.
 *
 * See APP_SPIKE_A_REFRAME_PLAN.md.
 */

import { parkRequest, AgentTaskError } from '@/lib/mcp/agent-tasks/queue';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function checkBearer(request) {
  const expected = process.env.CONTROL_PLANE_MCP_KEY;
  if (!expected) return { configured: false };
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { configured: true, authorized: false };
  const provided = match[1].trim();
  if (provided.length !== expected.length) return { configured: true, authorized: false };
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return { configured: true, authorized: diff === 0 };
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AgentTaskError('Request body must be an object', {
      code: 'INVALID_INPUT',
      status: 400,
    });
  }
  const { inputs } = body;
  if (!inputs || typeof inputs !== 'object') {
    throw new AgentTaskError('inputs is required, e.g. { text: "..." }', {
      code: 'INVALID_INPUT',
      status: 400,
    });
  }
  const hasText = typeof inputs.text === 'string' && inputs.text.trim().length > 0;
  const hasImage = !!(inputs.image_base64 || (inputs.image && inputs.image.base64));
  if (!hasText && !hasImage) {
    throw new AgentTaskError(
      'inputs must include at least one of: text, image_base64, image',
      { code: 'INVALID_INPUT', status: 400 },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request) {
  const auth = checkBearer(request);
  if (!auth.configured) {
    return jsonResponse(404, { error: 'Not found' });
  }
  if (!auth.authorized) {
    return jsonResponse(401, { error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body', code: 'INVALID_JSON' });
  }

  try {
    validatePayload(body);
  } catch (err) {
    if (err instanceof AgentTaskError) {
      return jsonResponse(err.status, { error: err.message, code: err.code });
    }
    return jsonResponse(400, { error: err.message, code: 'INVALID_INPUT' });
  }

  try {
    const result = await parkRequest({ ...body, task_kind: 'envelope_inference' });
    return jsonResponse(200, {
      envelope: result.envelope,
      mode: 'agent-routed',
      model: result.meta?.model || null,
      duration_ms: result.durationMs,
      request_id: result.request_id,
    });
  } catch (err) {
    if (err instanceof AgentTaskError) {
      return jsonResponse(err.status, { error: err.message, code: err.code });
    }
    console.error('[app-inference/envelope] unexpected error:', err);
    return jsonResponse(500, {
      error: err.message || 'Envelope primitive call failed',
      code: 'ENVELOPE_INTERNAL_ERROR',
    });
  }
}
