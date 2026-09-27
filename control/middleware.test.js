import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NextRequest } from 'next/server';
import { middleware } from './middleware.js';
import { checkDashboardRequest, hostnameOf } from './lib/auth/request-guard.js';

// The matcher is a static string literal; a text-level assertion is enough to
// catch "we accidentally gated /api/health and broke probes." The loopback
// guard is tested by calling middleware() directly (see the end of the file).
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

// The dashboard binds 127.0.0.1 with login off by default. Without a Host and
// Origin check, any web page the operator visits could reach its API through
// DNS rebinding (Host: attacker.example) or a cross-site POST (document
// upload, deploy).
describe('middleware loopback guard (DNS rebinding, cross-site writes)', () => {
  const ENV_KEYS = ['MOJULO_UI_HOST', 'CONTROL_PLANE_MCP_KEY', 'CONTROL_PLANE_USER', 'CONTROL_PLANE_PASSWORD'];
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  for (const k of ENV_KEYS) delete process.env[k];

  function request(path, { method = 'GET', host = '127.0.0.1:3001', headers = {} } = {}) {
    return new NextRequest(`http://127.0.0.1:3001${path}`, { method, headers: { host, ...headers } });
  }
  const passes = (res) => res.headers.get('x-middleware-next') === '1';

  it('a forged Host header gets 403, on API routes and pages alike', async () => {
    for (const path of ['/api/documents', '/settings']) {
      const res = await middleware(request(path, { host: 'attacker.example:3001' }));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('HOST_NOT_ALLOWED');
    }
  });

  it('loopback Hosts pass', async () => {
    for (const host of ['localhost:3001', '127.0.0.1:3001', '[::1]:3001', 'LOCALHOST:3001', 'localhost']) {
      expect(passes(await middleware(request('/api/documents', { host })))).toBe(true);
    }
  });

  it('MOJULO_UI_HOST adds its address; an unspecified bind address is never trusted as a Host', async () => {
    expect((await middleware(request('/', { host: '192.168.1.20:3001' }))).status).toBe(403);
    process.env.MOJULO_UI_HOST = '192.168.1.20';
    expect(passes(await middleware(request('/', { host: '192.168.1.20:3001' })))).toBe(true);
    process.env.MOJULO_UI_HOST = '0.0.0.0';
    expect((await middleware(request('/', { host: '0.0.0.0:3001' }))).status).toBe(403);
  });

  it('a non-GET from another origin gets 403', async () => {
    const res = await middleware(
      request('/api/documents', { method: 'POST', headers: { origin: 'https://attacker.example' } }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('CROSS_SITE_REQUEST');
    // Another port on localhost is another origin too.
    expect(
      (await middleware(request('/api/documents', { method: 'POST', headers: { origin: 'http://127.0.0.1:5173' } })))
        .status,
    ).toBe(403);
    // Sandboxed frames and file:// pages send Origin: null.
    expect(
      (await middleware(request('/api/documents', { method: 'DELETE', headers: { origin: 'null' } }))).status,
    ).toBe(403);
  });

  it('Sec-Fetch-Site: cross-site on a non-GET gets 403 even without Origin', async () => {
    const res = await middleware(
      request('/api/deployments/x/cloud-deploy', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }),
    );
    expect(res.status).toBe(403);
  });

  it('same-origin writes, and writes with no browser headers (curl, server-side), pass', async () => {
    expect(
      passes(
        await middleware(
          request('/api/documents', {
            method: 'POST',
            headers: { origin: 'http://127.0.0.1:3001', 'sec-fetch-site': 'same-origin' },
          }),
        ),
      ),
    ).toBe(true);
    expect(passes(await middleware(request('/api/documents', { method: 'POST' })))).toBe(true);
  });

  it('a cross-site GET is not refused (reads are covered by the Host check)', async () => {
    expect(
      passes(await middleware(request('/api/sketches', { headers: { 'sec-fetch-site': 'cross-site' } }))),
    ).toBe(true);
  });

  it('the CONTROL_PLANE_MCP_KEY bearer skips the guard (apps on other ports and hosts)', async () => {
    process.env.CONTROL_PLANE_MCP_KEY = 'k'.repeat(40);
    const res = await middleware(
      request('/api/app-inference/envelope', {
        method: 'POST',
        host: 'host.docker.internal:3001',
        headers: { origin: 'http://localhost:5173', authorization: `Bearer ${'k'.repeat(40)}` },
      }),
    );
    expect(passes(res)).toBe(true);
    const wrong = await middleware(
      request('/api/app-inference/envelope', {
        method: 'POST',
        host: 'host.docker.internal:3001',
        headers: { authorization: 'Bearer wrong' },
      }),
    );
    expect(wrong.status).toBe(403);
  });

  it('the guard runs before the login gate when login is on', async () => {
    process.env.CONTROL_PLANE_USER = 'op';
    process.env.CONTROL_PLANE_PASSWORD = 'pw';
    expect((await middleware(request('/api/documents', { host: 'attacker.example' }))).status).toBe(403);
    expect((await middleware(request('/api/documents'))).status).toBe(401);
  });

  it('hostnameOf strips ports and keeps IPv6 brackets', () => {
    expect(hostnameOf('LocalHost:3001')).toBe('localhost');
    expect(hostnameOf('[::1]:3001')).toBe('[::1]');
    expect(hostnameOf('[::1')).toBeNull();
    expect(hostnameOf('')).toBeNull();
    expect(hostnameOf(undefined)).toBeNull();
    expect(checkDashboardRequest({ method: 'GET', host: null })).toMatchObject({ code: 'HOST_NOT_ALLOWED' });
  });
});
