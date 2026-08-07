import { getDb } from '../index.js';

function shortRef() {
  // Short collision-resistant slug, prefixed `fld_` so a folder ref is
  // visually distinct from a sketch ref (`sk_`) when both appear in a URL
  // or in the agent transcript.
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return `fld_${n.toString(36).padStart(10, '0').slice(-10)}`;
}

function rowToFolder(row) {
  if (!row) return null;
  return {
    ref: row.ref,
    name: row.name,
    createdAt: row.created_at,
    sketchCount: row.sketch_count ?? 0,
  };
}

export const SketchFolderRepository = {
  create({ name, ref }) {
    const db = getDb();
    const finalRef = ref || shortRef();
    db.prepare(
      `INSERT INTO sketch_folders (ref, name, created_at)
       VALUES (?, ?, unixepoch())`,
    ).run(finalRef, name);
    return this.getByRef(finalRef);
  },

  getByRef(ref) {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT f.*, (
            SELECT COUNT(*) FROM sketches s WHERE s.folder_ref = f.ref
          ) AS sketch_count
           FROM sketch_folders f
          WHERE f.ref = ?`,
      )
      .get(ref);
    return rowToFolder(row);
  },

  update({ ref, name }) {
    if (!ref) return null;
    const existing = this.getByRef(ref);
    if (!existing) return null;
    const db = getDb();
    db.prepare('UPDATE sketch_folders SET name = ? WHERE ref = ?').run(
      name === undefined ? existing.name : name,
      ref,
    );
    return this.getByRef(ref);
  },

  // Move sketches in this folder back to root, then drop the folder row.
  // Returns true if a row was removed. No-op (returns false) if the folder
  // doesn't exist.
  remove(ref) {
    if (!ref) return false;
    const db = getDb();
    const txn = db.transaction(() => {
      db.prepare('UPDATE sketches SET folder_ref = NULL WHERE folder_ref = ?').run(ref);
      return db.prepare('DELETE FROM sketch_folders WHERE ref = ?').run(ref).changes;
    });
    return txn() > 0;
  },

  list() {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT f.*, (
            SELECT COUNT(*) FROM sketches s WHERE s.folder_ref = f.ref
          ) AS sketch_count
           FROM sketch_folders f
          ORDER BY f.created_at DESC`,
      )
      .all();
    return rows.map(rowToFolder);
  },
};
