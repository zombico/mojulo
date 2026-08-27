import { getDb } from '../index.js';
import { newId } from '../ids.js';
import { rolesEnabled } from '../../roles/keys.js';
import { UserRepository } from './users.js';

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

export const ApiKeyRepository = {
  /**
   * The key-resolution funnel (roles-pack.plan.md Phase 3 — BYOK per
   * account). Roles off, or the operator: every key, exactly as before. A
   * delegate resolves ONLY their own rows — plus the operator's house keys
   * (owner NULL) when their key carries the admin-granted `house_keys` flag.
   * A keyless delegate falls through to the existing "no LLM key configured"
   * refusal at the call sites. Scoping lives HERE so every caller that
   * threads userId (session-binding preload, builder executor,
   * tool-executors) is covered by one funnel.
   */
  async findByUserId(userId) {
    const db = getDb();
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
    const db = getDb();
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    return rowToApiKey(row);
  },

  async findDefault() {
    const db = getDb();
    const row = db.prepare('SELECT * FROM api_keys WHERE is_default = 1 LIMIT 1').get();
    return rowToApiKey(row);
  },

  async findByProvider(provider) {
    const db = getDb();
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
