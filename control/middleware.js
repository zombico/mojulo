import { NextResponse } from 'next/server';
import { SESSION_COOKIE, isAuthEnabled, verifySessionToken } from '@/lib/auth/session';
import { checkDashboardRequest } from '@/lib/auth/request-guard';

// Every path but Next's static assets and /api/mcp, which answers only its own bearer keys (the MCP
// key and the roles pack's delegate keys) and 404s without one. Each exclusion is anchored: the
// unanchored `api/mcp`, `api/health` and `login` it replaces also skipped /api/mcp-telemetry,
// /api/healthz and /loginx, so the loopback guard never ran on the tool-call log.
export const config = {
  // Node, not Edge: a delegate's session (roles pack) is checked against the users table, which the
  // Edge runtime cannot reach. The operator's session and installs without the roles pack read nothing.
  runtime: 'nodejs',
  matcher: ['/((?!_next/static/|_next/image(?:/|$)|favicon\\.ico$|icon\\.svg$|api/mcp(?:/|$)).*)'],
};

// Reachable without a login session: uptime probes and the login flow itself. They still pass the
// loopback guard. Exact paths, so a route that only starts with one of these names is gated.
const PUBLIC_PATHS = new Set(['/api/health', '/api/auth/login', '/api/auth/logout', '/login']);

// Constant-time string compare for bearer tokens. Avoids early-exit timing
// leaks on a mismatched prefix; not strictly load-bearing for single-user
// local-only mojulo, but cheap to do right.
function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Bearer-first auth: if the caller presents the control-plane MCP key in
// an Authorization header, they're trusted — bypass the session-cookie
// gate entirely. This unifies the two auth schemes (cookie OR token) so
// every bearer-protected route (`/api/mcp`, `/api/app-inference/envelope`,
// future agent-callable routes) just works without per-route matcher
// edits. The MCP key IS the unified credential.
function presentedBearerMatchesMcpKey(req) {
  const expected = process.env.CONTROL_PLANE_MCP_KEY;
  if (!expected) return false;
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return constantTimeEquals(match[1].trim(), expected);
}

// A verified session is the operator's (r: 'admin', from the CONTROL_PLANE_USER login) or a
// delegate's (roles pack). The operator's is live until it expires, with no database read, as before.
// A delegate's also needs its key to be live: revoking it, letting it expire or bumping its epoch ends
// the session on the next request rather than when the 7-day cookie runs out. The check is loaded
// only for a delegate's session, so the operator's path loads no SQLite.
async function sessionIsLive(claims) {
  if (claims.r === 'admin') return true;
  const { delegateSessionRefusal } = await import('@/lib/auth/delegate-session');
  return delegateSessionRefusal(claims) === null;
}

// A live delegate's session is READ-ONLY. No dashboard route checks a role, a grant or a flag, so a
// delegate session that could write would hold the operator's whole authority: delete the operator's
// saved keys, write an app's `.env` and start the app, delete sketches, spend a saved provider key
// through the polygonizer route. The roles pack's grants and deny-list bind the MCP bearer; until the
// dashboard enforces them too, a delegate reads pages and the API and writes nothing, and the settings
// API (the operator's saved keys) answers no read either. The operator's session is unaffected.
const READ_METHODS = new Set(['GET', 'HEAD']);
const OPERATOR_ONLY_READS = /^\/api\/settings(?:\/|$)/;

function decodedPath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function delegateWriteRefusal(claims, method, pathname) {
  if (claims.r === 'admin') return null;
  if (READ_METHODS.has(method) && !OPERATOR_ONLY_READS.test(decodedPath(pathname))) return null;
  return {
    error: "A delegate's dashboard session is read-only: the dashboard does not check a delegate's grants, so writes and the settings API are the operator's. Use your MCP key for what your role grants.",
    code: 'DELEGATE_READ_ONLY',
  };
}

export async function middleware(req) {
  // A matching bearer cannot come from a rebinding or cross-site page, so it
  // skips the loopback guard too.
  if (presentedBearerMatchesMcpKey(req)) return NextResponse.next();

  // Runs whether or not login is on: with it off (the default) this is the
  // only thing between a web page in the operator's browser and the API.
  const refusal = checkDashboardRequest({
    method: req.method,
    host: req.headers.get('host'),
    origin: req.headers.get('origin'),
    secFetchSite: req.headers.get('sec-fetch-site'),
  });
  if (refusal) {
    return new NextResponse(JSON.stringify(refusal), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAuthEnabled()) return NextResponse.next();
  const pathname = req.nextUrl.pathname.replace(/\/+$/, '') || '/';
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token, process.env.CONTROL_PLANE_PASSWORD);
  if (claims && (await sessionIsLive(claims))) {
    const readOnly = delegateWriteRefusal(claims, req.method, pathname);
    if (readOnly) {
      return new NextResponse(JSON.stringify(readOnly), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({
        error: 'Authentication required: present a session cookie or a Bearer token matching CONTROL_PLANE_MCP_KEY.',
        code: 'SESSION_REQUIRED',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const next = req.nextUrl.pathname + req.nextUrl.search;
  if (next && next !== '/login') url.searchParams.set('next', next);
  return NextResponse.redirect(url);
}
