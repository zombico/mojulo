import { getDb } from '../index.js';

function shortRef() {
  // Short collision-resistant slug: 10 chars of base36 from crypto entropy.
  // ~52 bits — plenty for a single-user control plane that mints maybe
  // dozens of sketches a session. Prefix `sk_` so the agent can recognize
  // a sketch ref at a glance.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return `sk_${n.toString(36).padStart(10, '0').slice(-10)}`;
}

function rowToSketch(row) {
  if (!row) return null;
  let manifest;
  try {
    manifest = JSON.parse(row.manifest_json);
  } catch {
    manifest = null;
  }
  return {
    ref: row.ref,
    title: row.title,
    manifest,
    createdAt: row.created_at,
    folderRef: row.folder_ref || null,
  };
}

export const SketchRepository = {
  create({ title, manifest, ref, folderRef }) {
    const db = getDb();
    const finalRef = ref || shortRef();
    db.prepare(
      `INSERT INTO sketches (ref, title, manifest_json, folder_ref, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    ).run(finalRef, title, JSON.stringify(manifest), folderRef || null);
    return this.getByRef(finalRef);
  },

  getByRef(ref) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sketches WHERE ref = ?').get(ref);
    return rowToSketch(row);
  },

  // In-place update of an existing sketch. Any of title/manifest/folderRef
  // may be passed; missing fields are left untouched. Pass folderRef=null
  // explicitly to move the sketch to root. Returns the refreshed sketch row,
  // or null if no row matches `ref`. Used by the rename UI, the move-to-
  // folder affordance, and the update_sketch MCP tool.
  update({ ref, title, manifest, folderRef }) {
    if (!ref) return null;
    const existing = this.getByRef(ref);
    if (!existing) return null;
    const db = getDb();
    const nextTitle = title === undefined ? existing.title : title;
    const nextManifest =
      manifest === undefined ? existing.manifest : manifest;
    const nextFolderRef =
      folderRef === undefined ? existing.folderRef : folderRef || null;
    db.prepare(
      `UPDATE sketches
          SET title = ?, manifest_json = ?, folder_ref = ?
        WHERE ref = ?`,
    ).run(nextTitle, JSON.stringify(nextManifest), nextFolderRef, ref);
    return this.getByRef(ref);
  },

  // Bulk move: set folder_ref on every row whose ref is in `refs`. Pass
  // folderRef=null to move to root. Returns the number of rows updated.
  // Used by the multi-select "move to folder" affordance.
  moveMany({ refs, folderRef }) {
    if (!Array.isArray(refs) || refs.length === 0) return 0;
    const db = getDb();
    const placeholders = refs.map(() => '?').join(',');
    const result = db
      .prepare(
        `UPDATE sketches SET folder_ref = ? WHERE ref IN (${placeholders})`,
      )
      .run(folderRef || null, ...refs);
    return result.changes;
  },

  deleteByRef(ref) {
    if (!ref) return 0;
    const db = getDb();
    const result = db.prepare('DELETE FROM sketches WHERE ref = ?').run(ref);
    return result.changes;
  },

  deleteMany({ refs }) {
    if (!Array.isArray(refs) || refs.length === 0) return 0;
    const db = getDb();
    const placeholders = refs.map(() => '?').join(',');
    const result = db
      .prepare(`DELETE FROM sketches WHERE ref IN (${placeholders})`)
      .run(...refs);
    return result.changes;
  },

  // Returns recent sketches first, capped at `limit`. Used by the index
  // page; client-side filters the result by title/ref substring so we
  // don't fight pagination at this density. Bump the cap (or add q/server
  // pagination) when the agent's actually minting hundreds.
  list({ limit = 200 } = {}) {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM sketches ORDER BY created_at DESC LIMIT ?')
      .all(limit);
    return rows.map(rowToSketch);
  },
};
