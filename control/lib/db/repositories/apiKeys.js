import { getDb } from '../index.js';
import { newId } from '../ids.js';
import { rolesEnabled } from '../../roles/keys.js';
import { UserRepository } from './users.js';
import { migrateLegacyCiphertext } from '../../deployment-auth.js';

function rowToApiKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    encryptedKey: row.encrypted_key,
    isDefault: row.is_default === 1,
    ownerUserId: row.owner_user_id || null,
    createdAt: new Date(row.created_at),
  };
}

// Re-encrypt rows saved under the pre-2.2 built-in key with the per-install
// key (lib/deployment-auth.js), once per process and database, before the
// first read. The WHERE on the old value keeps a concurrent process's
// migration of the same row from being overwritten.
let migratedDb = null;
function migrateLegacyRows(db) {
  if (migratedDb === db) return;
  migratedDb = db;
  const rows = db.prepare('SELECT id, encrypted_key FROM api_keys').all();
  const update = db.prepare('UPDATE api_keys SET encrypted_key = ? WHERE id = ? AND encrypted_key = ?');
  for (const row of rows) {
    try {
      const reencrypted = migrateLegacyCiphertext(row.encrypted_key);
      if (reencrypted) update.run(reencrypted, row.id, row.encrypted_key);
    } catch (err) {
      // Reads still decrypt legacy values; the next process retries.
      console.warn(`[api_keys] could not re-encrypt key ${row.id}: ${err.message}`);
    }
  }
}

function migratedHandle() {
  const handle = getDb();
  migrateLegacyRows(handle);
  return handle;
}

export const ApiKeyRepository = {
  /**
   * The key-resolution funnel (roles-pack.plan.md Phase 3 — BYOK per
   * account). Roles off, or the operator: every key, exactly as before. A
   * delegate resolves ONLY their own rows — plus the operator's house keys
   * (owner NULL) when their key carries the admin-granted `house_keys` flag.
   * A keyless delegate falls through to the existing "no LLM key configured"
   * refusal at the call sites. Scoping lives HERE so every caller that
   * threads userId (mint_solid's prompt door today; the 2.x chatbot builder
   * did too) is covered by one funnel.
   */
  async findByUserId(userId) {
    const db = migratedHandle();
    const rows = db
      .prepare('SELECT * FROM api_keys ORDER BY is_default DESC, created_at ASC')
      .all()
      .map(rowToApiKey);
    if (!rolesEnabled() || !userId || userId === 'local') return rows;
    const user = UserRepository.findById(userId);
    if (!user || user.role === 'admin') return rows;
    const houseAllowed = Boolean(user.flags?.house_keys);
    return rows.filter(
      (k) => k.ownerUserId === userId || (houseAllowed && !k.ownerUserId)
    );
  },

  async findById(id) {
    const db = migratedHandle();
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    return rowToApiKey(row);
  },

  async findDefault() {
    const db = migratedHandle();
    const row = db.prepare('SELECT * FROM api_keys WHERE is_default = 1 LIMIT 1').get();
    return rowToApiKey(row);
  },

  async findByProvider(provider) {
    const db = migratedHandle();
    const row = db
      .prepare('SELECT * FROM api_keys WHERE provider = ? ORDER BY is_default DESC, created_at ASC LIMIT 1')
      .get(provider);
    return rowToApiKey(row);
  },

  async create({ name, provider, encryptedKey, isDefault = false, ownerUserId = null }) {
    const db = getDb();
    const id = newId('ak');
    const now = Date.now();

    if (isDefault) {
      db.prepare('UPDATE api_keys SET is_default = 0').run();
    }

    db.prepare(
      `INSERT INTO api_keys (id, name, provider, encrypted_key, is_default, owner_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, provider, encryptedKey, isDefault ? 1 : 0, ownerUserId, now);

    return this.findById(id);
  },

  async setDefault(id) {
    const db = getDb();
    db.prepare('UPDATE api_keys SET is_default = 0').run();
    db.prepare('UPDATE api_keys SET is_default = 1 WHERE id = ?').run(id);
    return this.findById(id);
  },

  async delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
  },
};
