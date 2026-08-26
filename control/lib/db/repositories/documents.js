import { getDb } from '../index.js';
import { newId } from '../ids.js';
import { deleteFile } from '../../storage/index.js';
import { currentSpaceId } from '../../roles/scope.js';

// Workshop-space scope (roles-pack.plan.md Phase 4): delegate creates stamp
// their space; their reads see only it. Null scope (operator / roles off /
// background jobs) is unfiltered — no behavior change.
function spaceFilter() {
  const space = currentSpaceId();
  return space ? { sql: ' AND workshop_space_id = ?', params: [space] } : { sql: '', params: [] };
}

function rowToDocument(row) {
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    parsedText: row.parsed_text,
    createdAt: new Date(row.created_at),
  };
}

export const DocumentRepository = {
  async findById(id) {
    const db = getDb();
    const scope = spaceFilter();
    const row = db
      .prepare(`SELECT * FROM documents WHERE id = ?${scope.sql}`)
      .get(id, ...scope.params);
    return rowToDocument(row);
  },

  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const db = getDb();
    const scope = spaceFilter();
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM documents WHERE id IN (${placeholders})${scope.sql}`)
      .all(...ids, ...scope.params);
    return rows.map(rowToDocument);
  },

  // Kept for API parity with the builder stream code. In Lite there are no bot spaces,
  // so this returns the full document list — scoped to the caller's workshop
  // space for delegate keys (roles pack).
  async findByBotSpaceId(_botSpaceId) {
    const db = getDb();
    const scope = spaceFilter();
    const rows = db
      .prepare(`SELECT * FROM documents WHERE 1=1${scope.sql} ORDER BY created_at DESC`)
      .all(...scope.params);
    return rows.map(rowToDocument);
  },

  async create({ originalName, mimeType, sizeBytes, storagePath, parsedText = null }) {
    const db = getDb();
    const id = newId('doc');
    const now = Date.now();
    db.prepare(
      `INSERT INTO documents (id, original_name, mime_type, size_bytes, storage_path, parsed_text, workshop_space_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, originalName, mimeType, Number(sizeBytes) || 0, storagePath, parsedText, currentSpaceId(), now);
    return this.findById(id);
  },

  // Cascades blob removal so the row and the file in data/storage/ go together.
  // Storage failures are logged and swallowed — the row is the source of truth
  // for whether the doc "exists" in the app.
  async delete(id) {
    const db = getDb();
    const scope = spaceFilter();
    const row = db
      .prepare(`SELECT storage_path FROM documents WHERE id = ?${scope.sql}`)
      .get(id, ...scope.params);
    if (scope.sql && !row) return; // cross-space delete: not-found, no cascade
    if (row?.storage_path) {
      try {
        await deleteFile(row.storage_path);
      } catch (err) {
        console.warn(`[documents] storage delete failed for ${id} (continuing):`, err.message);
      }
    }
    db.prepare(`DELETE FROM documents WHERE id = ?${scope.sql}`).run(id, ...scope.params);
  },
};
