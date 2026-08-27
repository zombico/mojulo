// HMAC-signed session token, used by middleware.js + /api/auth/*.
// The token is `<b64url(claimsJson)>.<b64url(hmac(password, claimsJson))>`,
// claims = { u: userId, r: role, e: tokenEpoch, x: expUnixSeconds }. Signing
// with the password itself means rotating CONTROL_PLANE_PASSWORD invalidates
// every outstanding session with no extra bookkeeping.
//
// Roles pack Phase 4 (lib/mcp/roles-pack.plan.md): the Edge layer (middleware)
// verifies signature + expiry ONLY — it cannot reach SQLite. Per-user
// revocation is checked lazily in the Node runtime (lib/auth/service.js):
// compare the token's `e` to users.token_epoch — bumping the epoch (revoke)
// kills all of that user's sessions. Pre-claims tokens fail verification, so
// upgrading costs each browser one re-login.
//
// Web Crypto only — middleware runs on the Edge runtime.

const enc = new TextEncoder();

export const SESSION_COOKIE = 'mojulo_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function isAuthEnabled() {
  return !!(process.env.CONTROL_PLANE_USER && process.env.CONTROL_PLANE_PASSWORD);
}

async function hmacKey(password) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64urlEncode(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/') + pad);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/**
 * Mint a session token. Default claims are the operator's — callers that omit
 * `claims` get exactly the admin session the pre-roles login minted.
 *
 * @param {string} password — the signing secret (CONTROL_PLANE_PASSWORD).
 * @param {object} [opts]
 * @param {number} [opts.ttlSeconds]
 * @param {{u: string, r: string, e?: number}} [opts.claims] — userId / role /
 *   token epoch (epoch only meaningful for delegate users).
 */
export async function createSessionToken(password, opts = {}) {
  // Back-compat: a numeric second arg is a bare ttlSeconds (pre-claims callers).
  if (typeof opts === 'number') opts = { ttlSeconds: opts };
  const { ttlSeconds = SESSION_TTL_SECONDS, claims } = opts;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = JSON.stringify({ u: 'local', r: 'admin', ...(claims || {}), x: exp });
  const payloadB64 = b64urlEncode(enc.encode(payload));
  const key = await hmacKey(password);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

/**
 * Verify signature + expiry and return the claims object, or null. The Edge
 * layer treats the truthy return as "let through"; the Node layer additionally
 * checks the epoch against the users table (lazy revocation).
 */
export async function verifySessionToken(token, password) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sigStr = token.slice(dot + 1);
  let payload;
  try {
    payload = new TextDecoder().decode(b64urlDecode(payloadB64));
  } catch {
    return null;
  }
  let claims;
  try {
    claims = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!claims || typeof claims !== 'object') return null;
  if (!Number.isFinite(claims.x) || claims.x < Math.floor(Date.now() / 1000)) return null;
  try {
    const key = await hmacKey(password);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sigStr), enc.encode(payload));
    return ok ? claims : null;
  } catch {
    return null;
  }
}
