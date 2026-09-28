import { getDb } from '../index.js';
import { currentSpaceId } from '../../roles/scope.js';

// The documents table is read-only since 3.0.0. The 2.x chatbot factory wrote it (its document
// uploader and RAG corpus); the factory left mojulo and nothing writes documents any more. The
// one reader is the stash media route, which resolves a legacy `doc_…` media_ref on an image item
// to its stored file (app/api/stashes/[ref]/media/[id]). Existing rows are never rewritten or
// dropped.

// Workshop-space scope (roles-pack.plan.md Phase 4): a delegate's reads see only their space.
// Null scope (operator / roles off / background jobs) is unfiltered — no behavior change.
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
};
