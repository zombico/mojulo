import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { delegateSessionRefusal, readDelegateUser, closeDelegateReader } from './delegate-session.js';
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from './session.js';

// A delegate's dashboard session (roles pack) is live only while the key behind it is. The reader
// uses its own read-only handle, so these tests put the database in a real file and write it through
// the app's own repository (getDb), the way the dashboard's route handlers do.
//
// The end-to-end cases (mint_role_key, /api/auth/login, middleware, revoke_role_key) live here rather
// than in middleware.test.js: that file loads Next's build internals in plain Node for its matcher
// tests, and the MCP server's tool registration then meets their AsyncLocalStorage stand-in.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_KEYS = [
  'SQLITE_PATH', 'MOJULO_ROLES', 'MOJULO_SEMANTIC_INDEX_DISABLED', 'CONTROL_PLANE_USER', 'CONTROL_PLANE_PASSWORD',
  'CONTROL_PLANE_MCP_KEY', 'MOJULO_UI_HOST', 'MOJULO_UI_ALLOWED_HOSTS',
];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
let dir;
let UserRepository;
let getDb;

beforeAll(async () => {
  for (const k of ENV_KEYS) delete process.env[k];
  dir = mkdtempSync(path.join(tmpdir(), 'mojulo-delegate-session-'));
  process.env.SQLITE_PATH = path.join(dir, 'mojulo-lite.db');
  process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
  ({ UserRepository } = await import('@/lib/db/repositories/users'));
  ({ getDb } = await import('@/lib/db/index'));
  getDb();
});

afterEach(() => {
  delete process.env.MOJULO_ROLES;
});

afterAll(async () => {
  closeDelegateReader();
  (await import('@/lib/db/index')).closeDb();
  rmSync(dir, { recursive: true, force: true });
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

let n = 0;
const delegate = (extra = {}) =>
  UserRepository.create({ name: `delegate-${++n}`, role: 'privileged', tokenHash: `hash-${n}`, ...extra });
const claimsOf = (user) => ({ u: user.id, r: user.role, e: user.tokenEpoch });

describe('delegateSessionRefusal', () => {
  it('a live key keeps its session', () => {
    process.env.MOJULO_ROLES = 'enabled';
    const user = delegate();
    expect(user.tokenEpoch).toBe(1);
    expect(delegateSessionRefusal(claimsOf(user))).toBeNull();
  });

  it('revoking the key refuses the session minted before it', () => {
    process.env.MOJULO_ROLES = 'enabled';
    const user = delegate();
    const claims = claimsOf(user);
    UserRepository.revoke(user.id);
    expect(delegateSessionRefusal(claims)).toBe('revoked');
  });

  it('an epoch bump alone refuses the older session, and a session at the new epoch is live', () => {
    process.env.MOJULO_ROLES = 'enabled';
    const user = delegate();
    const claims = claimsOf(user);
    getDb().prepare('UPDATE users SET token_epoch = token_epoch + 1 WHERE id = ?').run(user.id);
    expect(delegateSessionRefusal(claims)).toBe('stale_epoch');
    expect(delegateSessionRefusal({ ...claims, e: 2 })).toBeNull();
    // A session with no epoch claim never matches.
    expect(delegateSessionRefusal({ u: user.id, r: user.role })).toBe('stale_epoch');
  });

  it('an expired key refuses its session, on the same clock findActiveByTokenHash uses', () => {
    process.env.MOJULO_ROLES = 'enabled';
    const expiresAt = Date.now() + 60_000;
    const user = delegate({ expiresAt });
    expect(delegateSessionRefusal(claimsOf(user))).toBeNull();
    expect(delegateSessionRefusal(claimsOf(user), { now: expiresAt + 1 })).toBe('expired');
    const lapsed = delegate({ expiresAt: Date.now() - 1000 });
    expect(delegateSessionRefusal(claimsOf(lapsed))).toBe('expired');
  });

  it('an unknown user, or claims with no user, are refused', () => {
    process.env.MOJULO_ROLES = 'enabled';
    expect(delegateSessionRefusal({ u: 'usr_gone', r: 'privileged', e: 1 })).toBe('unknown_user');
    expect(delegateSessionRefusal({ r: 'privileged', e: 1 })).toBe('no_user');
    expect(delegateSessionRefusal({ u: '', r: 'privileged', e: 1 })).toBe('no_user');
  });

  it('with the roles pack off, a delegate session is refused without reading anything', () => {
    const user = delegate();
    let reads = 0;
    const findUser = () => {
      reads += 1;
      return { tokenEpoch: 1, expiresAt: null, revokedAt: null };
    };
    expect(delegateSessionRefusal(claimsOf(user), { findUser })).toBe('roles_disabled');
    process.env.MOJULO_ROLES = 'on';
    expect(delegateSessionRefusal(claimsOf(user), { findUser })).toBe('roles_disabled');
    expect(reads).toBe(0);
  });

  it('a users table that cannot be read refuses the session instead of throwing', () => {
    process.env.MOJULO_ROLES = 'enabled';
    const findUser = () => {
      throw new Error('SQLITE_CANTOPEN');
    };
    expect(delegateSessionRefusal({ u: 'usr_x', r: 'privileged', e: 1 }, { findUser })).toBe('unreadable');
  });
});

describe('readDelegateUser', () => {
  it('reads the row the app wrote, and sees a later write on the next call', () => {
    const user = delegate();
    expect(readDelegateUser(user.id)).toEqual({ tokenEpoch: 1, expiresAt: null, revokedAt: null });
    UserRepository.revoke(user.id);
    const after = readDelegateUser(user.id);
    expect(after.tokenEpoch).toBe(2);
    expect(after.revokedAt).toBeGreaterThan(0);
    expect(readDelegateUser('usr_nobody')).toBeNull();
  });

  it('never creates a database: a missing file throws and leaves nothing behind', () => {
    const before = process.env.SQLITE_PATH;
    const missing = path.join(dir, 'absent', 'mojulo-lite.db');
    process.env.SQLITE_PATH = missing;
    try {
      expect(() => readDelegateUser('usr_x')).toThrow();
      expect(existsSync(missing)).toBe(false);
      expect(existsSync(path.dirname(missing))).toBe(false);
    } finally {
      process.env.SQLITE_PATH = before;
    }
  });

  it('opens its handle on the first read only, and closeDelegateReader says whether one was open', () => {
    closeDelegateReader();
    expect(closeDelegateReader()).toBe(false);
    const user = delegate();
    readDelegateUser(user.id);
    expect(closeDelegateReader()).toBe(true);
    expect(closeDelegateReader()).toBe(false);
  });

  it('resolves the database file exactly as lib/db/index.js resolveDbPath does', () => {
    // Two resolvers for one file: if they drift, a delegate session is checked against a different
    // database than the one revoke_role_key writes.
    const expr = "process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'mojulo-lite.db')";
    const db = readFileSync(path.join(HERE, '..', 'db', 'index.js'), 'utf8');
    const own = readFileSync(path.join(HERE, 'delegate-session.js'), 'utf8');
    expect(db).toMatch(/function resolveDbPath\(\) \{\n\s+return ([^;]+);/);
    expect(db.match(/function resolveDbPath\(\) \{\n\s+return ([^;]+);/)[1]).toBe(expr);
    expect(own.match(/function dbPath\(\) \{\n\s+return ([^;]+);/)[1]).toBe(expr);
  });

  it('pulls in no lib/db module (a second instance would re-run getDb init in middleware)', () => {
    const own = readFileSync(path.join(HERE, 'delegate-session.js'), 'utf8');
    const imports = [...own.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(['@/lib/roles/enabled', 'better-sqlite3', 'node:path']);
    expect(readFileSync(path.join(HERE, '..', 'roles', 'enabled.js'), 'utf8')).not.toMatch(/^import /m);
  });
});

// Before this, a delegate's dashboard session outlived revoke_role_key until its 7-day cookie ran out:
// middleware checked only the signature and expiry.
describe('middleware and a delegate session, end to end', () => {
  const ADMIN = { mcpSessionId: 'delegate-session-test', userId: 'local' };
  const PASSWORD = 'pw-' + 'x'.repeat(24);
  let server;
  let login;
  let middleware;

  beforeAll(async () => {
    server = await import('@/lib/mcp/server');
    await server.ensureToolsRegistered();
    ({ POST: login } = await import('@/app/api/auth/login/route'));
    ({ middleware } = await import('@/middleware'));
  });

  beforeEach(() => {
    process.env.CONTROL_PLANE_USER = 'op';
    process.env.CONTROL_PLANE_PASSWORD = PASSWORD;
    process.env.MOJULO_ROLES = 'enabled';
  });

  afterEach(() => {
    for (const k of ['CONTROL_PLANE_USER', 'CONTROL_PLANE_PASSWORD']) delete process.env[k];
  });

  async function tool(name, args) {
    const res = await server.dispatchMcpRequest(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
      ADMIN,
    );
    expect(res.result?.isError, res.result?.content?.[0]?.text).toBeFalsy();
    return JSON.parse(res.result.content[0].text);
  }

  // The session cookie /api/auth/login sets for these credentials.
  async function signIn(username, password) {
    const res = await login(
      new Request('http://127.0.0.1:3001/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }),
    );
    expect(res.status).toBe(200);
    return res.cookies.get(SESSION_COOKIE).value;
  }

  let minted = 0;
  async function delegateSession(extra = {}) {
    const key = await tool('mint_role_key', { name: `session-delegate-${++minted}`, ...extra });
    return { key, cookie: await signIn(key.name, key.token) };
  }

  const request = (pathname, cookie, { host = '127.0.0.1:3001' } = {}) =>
    middleware(
      new NextRequest(`http://127.0.0.1:3001${pathname}`, {
        headers: { host, ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}) },
      }),
    );
  const passes = (res) => res.headers.get('x-middleware-next') === '1';

  async function expectLive(cookie) {
    expect(passes(await request('/api/stashes', cookie))).toBe(true);
    expect(passes(await request('/settings', cookie))).toBe(true);
  }

  // What a dead session gets: the same 401 JSON and /login redirect as no session at all.
  async function expectRefused(cookie) {
    const api = await request('/api/stashes', cookie);
    expect(api.status).toBe(401);
    expect(api.headers.get('content-type')).toBe('application/json');
    expect((await api.json()).code).toBe('SESSION_REQUIRED');
    const page = await request('/settings', cookie);
    expect(page.status).toBe(307);
    const to = new URL(page.headers.get('location'));
    expect(to.pathname).toBe('/login');
    expect(to.searchParams.get('next')).toBe('/settings');
  }

  it('a delegate session minted at epoch 1 is refused on the next request after revoke_role_key', async () => {
    const { key, cookie } = await delegateSession();
    expect(await verifySessionToken(cookie, PASSWORD)).toMatchObject({ u: key.userId, r: 'privileged', e: 1 });
    await expectLive(cookie);

    expect((await tool('revoke_role_key', { user: key.name })).status).toBe('revoked');
    // The cookie is still a good signature inside its 7 days; the key behind it is not.
    expect(await verifySessionToken(cookie, PASSWORD)).toBeTruthy();
    await expectRefused(cookie);
  });

  it('an epoch bump alone ends the sessions minted before it; signing in again mints a live one', async () => {
    const { key, cookie } = await delegateSession();
    await expectLive(cookie);
    getDb().prepare('UPDATE users SET token_epoch = token_epoch + 1 WHERE id = ?').run(key.userId);
    await expectRefused(cookie);
    const fresh = await signIn(key.name, key.token);
    expect((await verifySessionToken(fresh, PASSWORD)).e).toBe(2);
    await expectLive(fresh);
  });

  it("a key's expiry ends its dashboard session, not only its bearer", async () => {
    const { key, cookie } = await delegateSession({ expires_in_days: 1 });
    await expectLive(cookie);
    getDb().prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, key.userId);
    await expectRefused(cookie);
  });

  it('a session for a user the database does not have is refused', async () => {
    const orphan = await createSessionToken(PASSWORD, { claims: { u: 'usr_nobody', r: 'privileged', e: 1 } });
    await expectRefused(orphan);
  });

  it("the operator's session is unaffected and reads no database, with the roles pack on or off", async () => {
    const admin = await signIn('op', PASSWORD);
    expect(await verifySessionToken(admin, PASSWORD)).toMatchObject({ u: 'local', r: 'admin' });
    // Point the check at a file that does not exist: a read would refuse, and none may happen.
    const before = process.env.SQLITE_PATH;
    const missing = path.join(dir, 'absent', 'mojulo-lite.db');
    process.env.SQLITE_PATH = missing;
    closeDelegateReader();
    try {
      for (const roles of ['enabled', undefined]) {
        if (roles) process.env.MOJULO_ROLES = roles;
        else delete process.env.MOJULO_ROLES;
        await expectLive(admin);
      }
      expect(closeDelegateReader()).toBe(false);
      expect(existsSync(missing)).toBe(false);
    } finally {
      process.env.SQLITE_PATH = before;
    }
  });

  it('no roles pack: a delegate session is refused and nothing is read; login off gates nothing', async () => {
    const { cookie } = await delegateSession();
    await expectLive(cookie);
    closeDelegateReader();
    delete process.env.MOJULO_ROLES;
    await expectRefused(cookie);
    expect(closeDelegateReader()).toBe(false);
    // The default install: no login, no roles pack. The session gate does not run.
    delete process.env.CONTROL_PLANE_USER;
    delete process.env.CONTROL_PLANE_PASSWORD;
    expect(passes(await request('/api/stashes'))).toBe(true);
    expect(passes(await request('/api/stashes', cookie))).toBe(true);
    expect(closeDelegateReader()).toBe(false);
  });

  it('the loopback guard still answers first: a revoked session behind a forged Host gets 403', async () => {
    const { key, cookie } = await delegateSession();
    await tool('revoke_role_key', { user: key.userId });
    const res = await request('/api/stashes', cookie, { host: 'attacker.example:3001' });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('HOST_NOT_ALLOWED');
  });
});
