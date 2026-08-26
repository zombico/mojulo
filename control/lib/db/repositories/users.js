import { getDb } from '../index.js';
import { newId } from '../ids.js';

/**
 * Users repository — the roles pack's key ledger (lib/mcp/roles-pack.plan.md).
 *
 * Operator-owned delegation, not multi-tenancy: one 'local' admin row (the
 * operator), plus one row per key the operator cut for a delegate. Bearer keys
 * are stored as hashes only — the plaintext token is shown exactly once at
 * mint (lib/roles/keys.js owns mint/hash). With MOJULO_ROLES unset this table
 * stays empty and no request path reads it.
 */

export const LOCAL_ADMIN_ID = 'local';

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    tokenEpoch: row.token_epoch,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at || null,
  };
}

export const UserRepository = {
  findById(id) {
    const db = getDb();
    return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  },

  findByName(name) {
    const db = getDb();
    return rowToUser(db.prepare('SELECT * FROM users WHERE name = ?').get(name));
  },

  /**
   * Resolve a presented bearer key's hash to its ACTIVE user: not revoked, not
   * expired. Revoked/expired keys resolve to null — indistinguishable from a
   * wrong key at the auth surface (the 404-not-403 discipline).
   */
  findActiveByTokenHash(tokenHash) {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM users WHERE token_hash = ? AND revoked_at IS NULL')
      .get(tokenHash);
    const user = rowToUser(row);
    if (!user) return null;
    if (user.expiresAt && Date.now() > user.expiresAt) return null;
    return user;
  },

  list() {
    const db = getDb();
    return db
      .prepare('SELECT * FROM users ORDER BY created_at ASC')
      .all()
      .map(rowToUser);
  },

  /**
   * The operator's own admin row. Idempotent; called lazily once the roles
   * pack is enabled so grants/attribution have a real FK target. Carries no
   * token_hash — the operator authenticates via CONTROL_PLANE_MCP_KEY (the
   * god-key), never via a users-table key.
   */
  ensureLocalAdmin() {
    const db = getDb();
    db.prepare(
      `INSERT OR IGNORE INTO users (id, name, role, token_hash, created_at)
       VALUES (?, 'Local Operator', 'admin', NULL, ?)`
    ).run(LOCAL_ADMIN_ID, Date.now());
    return this.findById(LOCAL_ADMIN_ID);
  },

  create({ name, role, tokenHash, expiresAt = null }) {
    const db = getDb();
    const id = newId('usr');
    db.prepare(
      `INSERT INTO users (id, name, role, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, role, tokenHash, expiresAt, Date.now());
    return this.findById(id);
  },

  /**
   * Revoke a key: the row stays (attribution history keeps its FK target), the
   * key stops resolving, and the epoch bump invalidates any future per-user
   * dashboard sessions (Phase 4) lazily.
   */
  revoke(id) {
    const db = getDb();
    db.prepare(
      `UPDATE users
       SET revoked_at = ?, token_epoch = token_epoch + 1
       WHERE id = ? AND revoked_at IS NULL`
    ).run(Date.now(), id);
    return this.findById(id);
  },
};
