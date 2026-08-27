import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  isAuthEnabled,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from './session.js';

const ENV_KEYS = ['CONTROL_PLANE_USER', 'CONTROL_PLANE_PASSWORD'];
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL_ENV[k];
  }
});

describe('createSessionToken / verifySessionToken round-trip', () => {
  it('a freshly-created token verifies under the same password with admin default claims', async () => {
    const token = await createSessionToken('correct-horse-battery-staple');
    const claims = await verifySessionToken(token, 'correct-horse-battery-staple');
    expect(claims).toBeTruthy();
    // Default claims are the operator's — a caller that omits claims mints
    // exactly the pre-roles admin session.
    expect(claims.u).toBe('local');
    expect(claims.r).toBe('admin');
  });

  it('verifies across the documented default TTL', async () => {
    const token = await createSessionToken('pw', SESSION_TTL_SECONDS);
    expect(await verifySessionToken(token, 'pw')).toBeTruthy();
  });

  it('verifies a short TTL while still in window (numeric second arg back-compat)', async () => {
    const token = await createSessionToken('pw', 60);
    expect(await verifySessionToken(token, 'pw')).toBeTruthy();
  });

  it('round-trips delegate claims (userId / role / epoch) intact', async () => {
    const token = await createSessionToken('pw', {
      claims: { u: 'usr_abc', r: 'privileged', e: 3 },
    });
    const claims = await verifySessionToken(token, 'pw');
    expect(claims.u).toBe('usr_abc');
    expect(claims.r).toBe('privileged');
    expect(claims.e).toBe(3);
    expect(claims.x).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe('verifySessionToken rejection paths', () => {
  it('rejects an expired token (exp in the past, no leeway)', async () => {
    // ttl of -10s, not -1s, so the test doesn't race the second boundary
    // between createSessionToken and verifySessionToken (exp < now uses
    // strict less-than, so same-second exp passes verification).
    const token = await createSessionToken('pw', -10);
    expect(await verifySessionToken(token, 'pw')).toBeNull();
  });

  it('rejects a token signed with a different password (rotation invariant)', async () => {
    // This is the load-bearing claim from the file header: rotating
    // CONTROL_PLANE_PASSWORD invalidates every outstanding session because
    // the signing key IS the password. If this ever flips, password rotation
    // silently stops being effective.
    const token = await createSessionToken('password-A');
    expect(await verifySessionToken(token, 'password-B')).toBeNull();
  });

  it('rejects a token whose signature byte was flipped', async () => {
    const token = await createSessionToken('pw');
    const [payload, sig] = token.split('.');
    // Flip the FIRST char of the b64url signature. The LAST char of a 32-byte
    // (SHA-256) HMAC only carries 4 meaningful bits — its low bits are b64 padding
    // beyond the 32nd byte — so flipping A↔B there can decode to the same bytes and
    // still verify (a time-seeded flake). The first char always maps to real bytes.
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(await verifySessionToken(`${payload}.${flipped}`, 'pw')).toBeNull();
  });

  it('rejects a tampered payload (claims edited after signing)', async () => {
    const token = await createSessionToken('pw');
    const [, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ u: 'usr_evil', r: 'admin', x: Math.floor(Date.now() / 1000) + 3600 })
    )
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '');
    expect(await verifySessionToken(`${forged}.${sig}`, 'pw')).toBeNull();
  });

  it('rejects a pre-claims (legacy exp-only) token — one re-login on upgrade', async () => {
    // The old format was `<exp>.<sig(exp)>`. Its payload isn't JSON claims, so
    // it must fail closed rather than verify as something.
    expect(await verifySessionToken('1893456000.abcdef', 'pw')).toBeNull();
  });

  it('rejects an empty token', async () => {
    expect(await verifySessionToken('', 'pw')).toBeNull();
  });

  it('rejects a non-string token', async () => {
    expect(await verifySessionToken(null, 'pw')).toBeNull();
    expect(await verifySessionToken(undefined, 'pw')).toBeNull();
    expect(await verifySessionToken(12345, 'pw')).toBeNull();
    expect(await verifySessionToken({}, 'pw')).toBeNull();
  });

  it('rejects a token with no dot separator', async () => {
    expect(await verifySessionToken('no-dot-here', 'pw')).toBeNull();
  });

  it('rejects a token whose payload is non-JSON', async () => {
    expect(await verifySessionToken('notanumber.abc', 'pw')).toBeNull();
  });

  it('rejects a token with garbage base64 in the signature without throwing', async () => {
    // The middleware path can't tolerate an uncaught throw on every request.
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const garbage = `${exp}.@@@not-real-b64@@@`;
    // Must not throw; must return null.
    let result;
    try {
      result = await verifySessionToken(garbage, 'pw');
    } catch (e) {
      result = '__threw__';
    }
    expect(result).toBeNull();
  });
});

describe('isAuthEnabled — opt-in invariant', () => {
  // The most likely upgrade-day footgun: auth flipping on by default. CLAUDE.md
  // is explicit that the control plane is single-user, self-hosted, and login
  // is *opt-in* — a regression here either locks out every existing self-host
  // user on upgrade, or leaves auth half-on in a confusing way.

  it('returns false when both env vars are unset', () => {
    expect(isAuthEnabled()).toBe(false);
  });

  it('returns false when only USER is set', () => {
    process.env.CONTROL_PLANE_USER = 'admin';
    expect(isAuthEnabled()).toBe(false);
  });

  it('returns false when only PASSWORD is set', () => {
    process.env.CONTROL_PLANE_PASSWORD = 'hunter2';
    expect(isAuthEnabled()).toBe(false);
  });

  it('returns true only when both are set', () => {
    process.env.CONTROL_PLANE_USER = 'admin';
    process.env.CONTROL_PLANE_PASSWORD = 'hunter2';
    expect(isAuthEnabled()).toBe(true);
  });

  it('returns false when either env var is empty string (coerces to falsy)', () => {
    process.env.CONTROL_PLANE_USER = '';
    process.env.CONTROL_PLANE_PASSWORD = 'hunter2';
    expect(isAuthEnabled()).toBe(false);

    process.env.CONTROL_PLANE_USER = 'admin';
    process.env.CONTROL_PLANE_PASSWORD = '';
    expect(isAuthEnabled()).toBe(false);
  });
});

describe('module-level constants', () => {
  it('SESSION_COOKIE is the canonical name', () => {
    expect(SESSION_COOKIE).toBe('mojulo_session');
  });

  it('SESSION_TTL_SECONDS is 7 days', () => {
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});
