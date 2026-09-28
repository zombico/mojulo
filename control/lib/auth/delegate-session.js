/**
 * Delegate dashboard sessions (roles pack), checked by middleware.js on each request that carries one.
 *
 * /api/auth/login mints a delegate's session with claims { u: user id, r: role, e: token epoch }
 * (lib/auth/session.js). Its signature and 7-day expiry say only that this control plane minted it.
 * Whether the key behind it is still good lives in the users table, so a verified delegate session is
 * live only while the roles pack is on and the user's row exists, is not revoked, has not expired, and
 * still carries the epoch the session was minted at (revoke_role_key bumps it). Those are the rules
 * findActiveByTokenHash applies to the same delegate's MCP bearer, plus the epoch. The operator's
 * session (r: 'admin') never comes here.
 *
 * It reads the row itself instead of calling UserRepository.findById because middleware is bundled in
 * its own webpack layer: lib/db/index.js there would be a second module instance, and its first
 * getDb() would re-run every migration and start a second trigger scheduler and node fulfiller beside
 * the app's. This opens its own read-only handle to the same file, reads one row by primary key, and
 * never writes. Node only (better-sqlite3), which is why middleware.js runs on the Node runtime.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { rolesEnabled } from '@/lib/roles/enabled';

// The same resolution as resolveDbPath() in lib/db/index.js (not importable here, see above).
// delegate-session.test.js holds the two together.
function dbPath() {
  return process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'mojulo-lite.db');
}

let reader = null;
let warned = false;

/**
 * The revocation state of one users row, or null when there is no such row. Throws when the database
 * cannot be read (no file yet, no users table). Each call sees the latest committed write.
 */
export function readDelegateUser(id) {
  const file = dbPath();
  if (reader?.file !== file) {
    closeDelegateReader();
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
      reader = { file, db, get: db.prepare('SELECT token_epoch, expires_at, revoked_at FROM users WHERE id = ?') };
    } catch (err) {
      db.close();
      throw err;
    }
  }
  const row = reader.get.get(id);
  if (!row) return null;
  return { tokenEpoch: row.token_epoch, expiresAt: row.expires_at || null, revokedAt: row.revoked_at || null };
}

/** Close the read-only handle. Returns whether one was open (false: nothing has read the table). */
export function closeDelegateReader() {
  if (!reader) return false;
  reader.db.close();
  reader = null;
  return true;
}

/**
 * Why a verified non-admin session has to be refused, or null when it is live. Never throws: a users
 * table that cannot be read refuses the session.
 *
 * @param {{u?: string, e?: number}} claims — from verifySessionToken
 * @param {{findUser?: (id: string) => ({tokenEpoch: number, expiresAt: number|null, revokedAt: number|null}|null), now?: number}} [opts]
 * @returns {null | 'roles_disabled' | 'no_user' | 'unreadable' | 'unknown_user' | 'revoked' | 'expired' | 'stale_epoch'}
 */
export function delegateSessionRefusal(claims, { findUser = readDelegateUser, now = Date.now() } = {}) {
  // Only /api/auth/login mints these, and only with the roles pack on. With it off no delegate key
  // resolves anywhere, so no delegate session does either, and nothing is read.
  if (!rolesEnabled()) return 'roles_disabled';
  if (typeof claims?.u !== 'string' || !claims.u) return 'no_user';
  let user;
  try {
    user = findUser(claims.u);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(`[auth] delegate sessions refused: the users table could not be read (${err?.message || err})`);
    }
    return 'unreadable';
  }
  if (!user) return 'unknown_user';
  if (user.revokedAt) return 'revoked';
  if (user.expiresAt && now > user.expiresAt) return 'expired';
  if (user.tokenEpoch !== claims.e) return 'stale_epoch';
  return null;
}
