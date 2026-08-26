import { getDb } from '../index.js';
import { newId } from '../ids.js';

/**
 * Workshop spaces (roles-pack.plan.md Phase 4). v1 is one space per
 * privileged user, minted with their key; `space_members` (sharing a room)
 * is deferred until two delegates ever need it.
 */

function rowToSpace(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export const WorkshopSpaceRepository = {
  findById(id) {
    const db = getDb();
    return rowToSpace(db.prepare('SELECT * FROM workshop_spaces WHERE id = ?').get(id));
  },

  /** The one space a privileged user works in (v1: creator = occupant). */
  findByCreator(userId) {
    const db = getDb();
    return rowToSpace(
      db
        .prepare('SELECT * FROM workshop_spaces WHERE created_by = ? ORDER BY created_at ASC')
        .get(userId)
    );
  },

  ensureForUser(userId, name) {
    const existing = this.findByCreator(userId);
    if (existing) return existing;
    const db = getDb();
    const id = newId('ws');
    db.prepare(
      'INSERT INTO workshop_spaces (id, name, created_by, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, name, userId, Date.now());
    return this.findById(id);
  },

  list() {
    const db = getDb();
    return db
      .prepare('SELECT * FROM workshop_spaces ORDER BY created_at ASC')
      .all()
      .map(rowToSpace);
  },
};
