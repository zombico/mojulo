import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';
import { middleware, config } from './middleware.js';
import { checkDashboardRequest, hostnameOf } from './lib/auth/request-guard.js';

// Which paths the middleware runs on is decided by Next's own matcher code, so the exported
// config.matcher is run through it (the same functions `next build` uses) rather than read as text.
// The exclusions used to be unanchored, so `api/mcp` also skipped /api/mcp-telemetry (the tool-call
// log, readable through DNS rebinding), `api/health` /api/healthz, and `login` /loginx.
const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'middleware.js'), 'utf8');
const nextRequire = createRequire(import.meta.url);
const { getMiddlewareMatchers } = nextRequire('next/dist/build/analysis/get-page-static-info.js');
const { getMiddlewareRouteMatcher } = nextRequire('next/dist/shared/lib/router/utils/middleware-route-matcher.js');
const runsOn = getMiddlewareRouteMatcher(getMiddlewareMatchers(config.matcher, { i18n: undefined }));
const middlewareRuns = (path) => runsOn(path, { headers: {}, cookies: {} }, {});

describe('middleware matcher', () => {
  it('runs on every route that only starts with an excluded name', () => {
    for (const path of ['/api/mcp-telemetry', '/api/mcp-telemetry/x', '/api/healthz', '/loginx', '/api/auth/loginfoo', '/favicon.icox']) {
      expect(middlewareRuns(path), path).toBe(true);
    }
  });

  it('runs on pages, the API, /api/health and the login routes (the guard covers them all)', () => {
    for (const path of ['/', '/settings', '/api/stashes', '/api/sketches/x/png', '/api/health', '/login', '/api/auth/login', '/api/auth/logout']) {
      expect(middlewareRuns(path), path).toBe(true);
    }
  });

  it('skips Next static assets, the icons and /api/mcp (its own bearer check)', () => {
    for (const path of ['/_next/static/chunks/x.js', '/_next/image', '/favicon.ico', '/icon.svg', '/api/mcp', '/api/mcp/']) {
      expect(middlewareRuns(path), path).toBe(false);
    }
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
  const ENV_KEYS = ['MOJULO_UI_HOST', 'MOJULO_UI_ALLOWED_HOSTS', 'CONTROL_PLANE_MCP_KEY', 'CONTROL_PLANE_USER', 'CONTROL_PLANE_PASSWORD'];
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
    for (const path of ['/api/stashes', '/settings']) {
      const res = await middleware(request(path, { host: 'attacker.example:3001' }));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('HOST_NOT_ALLOWED');
    }
  });

  it('loopback Hosts pass', async () => {
    for (const host of ['localhost:3001', '127.0.0.1:3001', '[::1]:3001', 'LOCALHOST:3001', 'localhost']) {
      expect(passes(await middleware(request('/api/stashes', { host })))).toBe(true);
    }
  });

  it('MOJULO_UI_HOST adds its address; an unspecified bind address is never trusted as a Host', async () => {
    expect((await middleware(request('/', { host: '192.168.1.20:3001' }))).status).toBe(403);
    process.env.MOJULO_UI_HOST = '192.168.1.20';
    expect(passes(await middleware(request('/', { host: '192.168.1.20:3001' })))).toBe(true);
    process.env.MOJULO_UI_HOST = '0.0.0.0';
    expect((await middleware(request('/', { host: '0.0.0.0:3001' }))).status).toBe(403);
  });

  // MOJULO_UI_HOST is also the bind address, so it cannot name a reverse proxy's hostname or a LAN
  // address while the server is bound to 0.0.0.0. MOJULO_UI_ALLOWED_HOSTS is never bound.
  it('MOJULO_UI_ALLOWED_HOSTS adds names the dashboard is reached by, and the 403 names it', async () => {
    const refused = await middleware(request('/', { host: 'dash.example.lan' }));
    expect(refused.status).toBe(403);
    expect((await refused.json()).error).toContain('MOJULO_UI_ALLOWED_HOSTS');

    process.env.MOJULO_UI_ALLOWED_HOSTS = ' Dash.Example.Lan , 192.168.1.10:3001, https://name-3001.app.github.dev/, 0.0.0.0';
    expect(passes(await middleware(request('/api/stashes', { host: 'dash.example.lan' })))).toBe(true);
    expect(passes(await middleware(request('/', { host: 'name-3001.app.github.dev' })))).toBe(true);
    // Bound to 0.0.0.0 and opened from the LAN; localhost keeps working beside it.
    process.env.MOJULO_UI_HOST = '0.0.0.0';
    expect(passes(await middleware(request('/', { host: '192.168.1.10:3001' })))).toBe(true);
    expect(passes(await middleware(request('/', { host: 'localhost:3001' })))).toBe(true);
    // An unspecified address is never a trusted Host, from either variable.
    expect((await middleware(request('/', { host: '0.0.0.0:3001' }))).status).toBe(403);
  });

  it('a write through a proxy that rewrites Host passes when its Origin is an allowed name', async () => {
    const write = () =>
      middleware(
        request('/api/stashes', {
          method: 'POST',
          host: '127.0.0.1:3001',
          headers: { origin: 'https://dash.example.lan', 'sec-fetch-site': 'same-origin' },
        }),
      );
    expect((await write()).status).toBe(403);
    process.env.MOJULO_UI_ALLOWED_HOSTS = 'dash.example.lan';
    expect(passes(await write())).toBe(true);
    // The allow-list names the operator's hosts only: another port on localhost is still another origin.
    expect(
      (await middleware(request('/api/stashes', { method: 'POST', headers: { origin: 'http://127.0.0.1:5173' } })))
        .status,
    ).toBe(403);
    expect(
      (await middleware(request('/api/stashes', { method: 'POST', headers: { origin: 'https://attacker.example' } })))
        .status,
    ).toBe(403);
  });

  it('a non-GET from another origin gets 403', async () => {
    const res = await middleware(
      request('/api/stashes', { method: 'POST', headers: { origin: 'https://attacker.example' } }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('CROSS_SITE_REQUEST');
    // Another port on localhost is another origin too.
    expect(
      (await middleware(request('/api/stashes', { method: 'POST', headers: { origin: 'http://127.0.0.1:5173' } })))
        .status,
    ).toBe(403);
    // Sandboxed frames and file:// pages send Origin: null.
    expect(
      (await middleware(request('/api/stashes', { method: 'DELETE', headers: { origin: 'null' } }))).status,
    ).toBe(403);
  });

  it('Sec-Fetch-Site: cross-site on a non-GET gets 403 even without Origin', async () => {
    const res = await middleware(
      request('/api/sketches/x/png', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }),
    );
    expect(res.status).toBe(403);
  });

  it('same-origin writes, and writes with no browser headers (curl, server-side), pass', async () => {
    expect(
      passes(
        await middleware(
          request('/api/stashes', {
            method: 'POST',
            headers: { origin: 'http://127.0.0.1:3001', 'sec-fetch-site': 'same-origin' },
          }),
        ),
      ),
    ).toBe(true);
    expect(passes(await middleware(request('/api/stashes', { method: 'POST' })))).toBe(true);
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
    expect((await middleware(request('/api/stashes', { host: 'attacker.example' }))).status).toBe(403);
    expect((await middleware(request('/api/stashes'))).status).toBe(401);
  });

  it('the tool-call log and /api/health refuse a rebinding Host', async () => {
    for (const path of ['/api/mcp-telemetry?limit=500', '/api/health']) {
      const res = await middleware(request(path, { host: 'rebind.attacker.example:3001' }));
      expect(res.status, path).toBe(403);
    }
  });

  it('with login on, only the exact public paths skip the session check', async () => {
    process.env.CONTROL_PLANE_USER = 'op';
    process.env.CONTROL_PLANE_PASSWORD = 'pw';
    for (const path of ['/api/health', '/api/auth/login', '/api/auth/logout', '/login', '/login/']) {
      expect(passes(await middleware(request(path))), path).toBe(true);
    }
    expect((await middleware(request('/api/mcp-telemetry'))).status).toBe(401);
    expect((await middleware(request('/api/healthz'))).status).toBe(401);
    expect((await middleware(request('/loginx'))).status).toBe(307);
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
