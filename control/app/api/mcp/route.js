/**
 * Remote MCP server for Claude Desktop / Claude Code / any MCP HTTP client.
 *
 * Wire protocol: MCP over Streamable HTTP — JSON-RPC 2.0 messages POSTed to
 * this route, with a bearer token for auth. The user's Claude becomes the
 * agent loop; the control plane is a tool host that wraps the same
 * builderToolHandlers that the in-app web chat-builder uses.
 *
 * Auth: a bearer token. CONTROL_PLANE_MCP_KEY is the operator's key — if
 * unset, the route returns 404 — MCP is opt-in. With the roles pack enabled
 * (MOJULO_ROLES=enabled, lib/mcp/roles-pack.plan.md) the bearer may instead be
 * an operator-issued delegate key resolved against the users table; identity
 * is minted HERE and only here (buildContext — the one mint). Same
 * single-operator posture as the rest of the control plane; do NOT expose
 * this route to the public internet.
 *
 * See [docs/mcp-integration.md] for client setup and
 * [lite-template/integration/claude_mcp_plan.md] for the design rationale.
 */

import { dispatchMcpRequest, ensureToolsRegistered } from '@/lib/mcp/server';
import { rolesEnabled, resolveBearerUser } from '@/lib/roles/keys';

function notFound() {
  return new Response('Not found', { status: 404 });
}

function notConfigured() {
  // 404 (not 401) so probes can't fingerprint whether MCP is "off" vs "wrong
  // key". Matches the rest of the control plane's opt-in posture.
  return notFound();
}

function unauthorized() {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer' },
  });
}

function checkBearer(request) {
  const expected = process.env.CONTROL_PLANE_MCP_KEY;
  if (!expected) return { configured: false };

  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { configured: true, authorized: false };

  const provided = match[1].trim();
  // The operator's god-key first — back-compat, and the admin path even with
  // roles enabled. Constant-time-ish compare; length-leak is fine.
  if (provided.length === expected.length) {
    let diff = 0;
    for (let i = 0; i < provided.length; i++) {
      diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff === 0) return { configured: true, authorized: true, user: null };
  }

  // Roles pack: an operator-issued delegate key (hash lookup; revoked/expired
  // keys resolve null and fall through to 401, indistinguishable from a wrong
  // key). No-op with MOJULO_ROLES unset.
  if (rolesEnabled()) {
    const user = resolveBearerUser(provided);
    if (user) return { configured: true, authorized: true, user };
  }

  return { configured: true, authorized: false };
}

function buildContext(request, user) {
  // mcp-session-id is set by Streamable HTTP clients to thread state across
  // requests. We treat it as the key for binding a BuilderSession lazily.
  // Fall back to a stable per-process default for clients that omit it.
  const sessionId =
    request.headers.get('mcp-session-id') ||
    request.headers.get('x-mcp-session-id') ||
    'default';
  // The ONE identity mint (roles-pack.plan.md): every execution context's
  // userId originates here. God-key / roles-off → the local operator, exactly
  // as before (no userRole field — its absence means admin; see
  // isAdminContext in lib/roles/keys.js). A resolved delegate key → that
  // user's id + role.
  if (user) {
    return {
      mcpSessionId: sessionId,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
    };
  }
  return {
    mcpSessionId: sessionId,
    userId: 'local',
  };
}

export async function POST(request) {
  const auth = checkBearer(request);
  if (!auth.configured) return notConfigured();
  if (!auth.authorized) return unauthorized();

  await ensureToolsRegistered();

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const context = buildContext(request, auth.user || null);

  // Batch support per JSON-RPC 2.0 — array of messages.
  if (Array.isArray(body)) {
    const responses = [];
    for (const msg of body) {
      const resp = await dispatchMcpRequest(msg, context);
      if (resp !== null) responses.push(resp);
    }
    if (responses.length === 0) {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(responses), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = await dispatchMcpRequest(body, context);
  if (response === null) {
    // Notification — no response body.
    return new Response(null, { status: 204 });
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(request) {
  // GET on the MCP endpoint is reserved by the Streamable HTTP spec for
  // server-initiated SSE streams (resource updates, sampling requests).
  // We don't surface any of those yet, so we 405 with a helpful message
  // rather than 404 (which would imply the route doesn't exist).
  const auth = checkBearer(request);
  if (!auth.configured) return notFound();
  if (!auth.authorized) return unauthorized();
  return new Response('Method not allowed (server-initiated SSE not supported)', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
