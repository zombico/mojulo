import { NextResponse } from 'next/server';
import { SESSION_COOKIE, isAuthEnabled, verifySessionToken } from '@/lib/auth/session';
import { checkDashboardRequest } from '@/lib/auth/request-guard';

// Every path but Next's static assets and /api/mcp, which answers only its own bearer keys (the MCP
// key and the roles pack's delegate keys) and 404s without one. Each exclusion is anchored: the
// unanchored `api/mcp`, `api/health` and `login` it replaces also skipped /api/mcp-telemetry,
// /api/healthz and /loginx, so the loopback guard never ran on the tool-call log.
export const config = {
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
  const ok = await verifySessionToken(token, process.env.CONTROL_PLANE_PASSWORD);
  if (ok) return NextResponse.next();

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
