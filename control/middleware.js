import { NextResponse } from 'next/server';
import { SESSION_COOKIE, isAuthEnabled, verifySessionToken } from '@/lib/auth/session';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|api/health|api/auth/login|api/auth/logout|api/mcp|login).*)',
  ],
};

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
  if (!isAuthEnabled()) return NextResponse.next();

  if (presentedBearerMatchesMcpKey(req)) return NextResponse.next();

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
