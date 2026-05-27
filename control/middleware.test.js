import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Read middleware.js as text and assert the matcher pattern. We deliberately
// do not import middleware.js — it pulls 'next/server' which requires the
// Next Edge runtime to resolve. The matcher is a static string literal; a
// text-level assertion is sufficient to catch the regression we care about:
// "we accidentally gated /api/health and broke probes."
const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'middleware.js'), 'utf8');

describe('middleware matcher — public-path exemption list', () => {
  it('exempts /api/health (uptime probes must reach the route unauthenticated)', () => {
    expect(SOURCE).toMatch(/api\/health/);
  });

  it('exempts the login route and its API endpoints', () => {
    expect(SOURCE).toMatch(/api\/auth\/login/);
    expect(SOURCE).toMatch(/api\/auth\/logout/);
    expect(SOURCE).toMatch(/\blogin\b/);
  });

  it('exempts Next static asset paths', () => {
    expect(SOURCE).toMatch(/_next\/static/);
    expect(SOURCE).toMatch(/_next\/image/);
  });

  it('exempts the favicon and icon assets', () => {
    expect(SOURCE).toMatch(/favicon\.ico/);
    expect(SOURCE).toMatch(/icon\.svg/);
  });

  it('matcher is a negative-lookahead pattern (not an inverse-of-allow-list)', () => {
    // Documents the matcher's shape so a refactor to a list-based matcher
    // surfaces deliberately. The current form is /((?!exemptions).*).
    expect(SOURCE).toMatch(/\/\(\(\?!/);
  });
});

describe('middleware bearer-first auth (CONTROL_PLANE_MCP_KEY short-circuit)', () => {
  // Bearer-first: if Authorization: Bearer matches CONTROL_PLANE_MCP_KEY,
  // the session-cookie check is skipped. Unifies the two auth schemes so
  // every bearer-protected route (/api/mcp, /api/app-inference, future
  // agent-callable routes) is reachable without per-route matcher edits.
  it('reads CONTROL_PLANE_MCP_KEY before the session check runs', () => {
    expect(SOURCE).toMatch(/CONTROL_PLANE_MCP_KEY/);
    expect(SOURCE).toMatch(/presentedBearerMatchesMcpKey/);
    // The short-circuit must run before verifySessionToken — otherwise the
    // 401 still fires for bearer-only callers.
    const bearerIdx = SOURCE.indexOf('presentedBearerMatchesMcpKey(req)');
    const verifyIdx = SOURCE.indexOf('verifySessionToken(token');
    expect(bearerIdx).toBeGreaterThan(0);
    expect(verifyIdx).toBeGreaterThan(0);
    expect(bearerIdx).toBeLessThan(verifyIdx);
  });

  it('uses constant-time comparison for the bearer token', () => {
    expect(SOURCE).toMatch(/constantTimeEquals/);
  });

  it('matches Bearer scheme case-insensitively', () => {
    expect(SOURCE).toMatch(/\^Bearer\\s\+\(\.\+\)\$\/i/);
  });
});

describe('middleware 401 body shape (diagnostic friction fix)', () => {
  it('returns JSON with SESSION_REQUIRED code, not plain text', () => {
    // Before this change the body was just "Authentication required" which
    // was indistinguishable from a wrong-bearer 401 returned by the route
    // itself. SESSION_REQUIRED tells the app: you hit the outer gate, not
    // the route handler.
    expect(SOURCE).toMatch(/SESSION_REQUIRED/);
    expect(SOURCE).toMatch(/Content-Type.*application\/json/);
  });
});
