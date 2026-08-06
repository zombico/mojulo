import { getDb } from '../index.js';
import { classifyBucket } from '../../graph/sketch/sketch-manifest.js';

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
  // Bucket override pins the sketch into a specific Maker gallery; absent it,
  // the bucket is derived from manifest.kind. The effective `bucket` is what
  // callers filter on; `bucketOverride` is surfaced so the UI can tell a pinned
  // bucket from a derived one (and offer "reset to derived").
  const bucketOverride = row.bucket || null;
  return {
    ref: row.ref,
    title: row.title,
    manifest,
    createdAt: row.created_at,
    folderRef: row.folder_ref || null,
    bucket: bucketOverride || classifyBucket(manifest),
    bucketOverride,
  };
}

export const SketchRepository = {
  create({ title, manifest, ref, folderRef, bucket }) {
    const db = getDb();
    const finalRef = ref || shortRef();
    db.prepare(
      `INSERT INTO sketches (ref, title, manifest_json, folder_ref, bucket, created_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())`,
    ).run(finalRef, title, JSON.stringify(manifest), folderRef || null, bucket || null);
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
  update({ ref, title, manifest, folderRef, bucket }) {
    if (!ref) return null;
    const existing = this.getByRef(ref);
    if (!existing) return null;
    const db = getDb();
    const nextTitle = title === undefined ? existing.title : title;
    const nextManifest =
      manifest === undefined ? existing.manifest : manifest;
    const nextFolderRef =
      folderRef === undefined ? existing.folderRef : folderRef || null;
    // bucket override: undefined leaves it as-is; null clears it (back to
    // derived); a string pins the Maker gallery. existing.bucketOverride is the
    // pinned value (null when derived).
    const nextBucket =
      bucket === undefined ? existing.bucketOverride : bucket || null;
    db.prepare(
      `UPDATE sketches
          SET title = ?, manifest_json = ?, folder_ref = ?, bucket = ?
        WHERE ref = ?`,
    ).run(nextTitle, JSON.stringify(nextManifest), nextFolderRef, nextBucket, ref);
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

  // Returns every folder-tagged sketch plus the most recent `rootLimit`
  // root sketches, newest first overall. Used by the index page; the
  // client filters by title/ref substring and by folder context. Folder
  // sketches are always included so navigating into a folder never shows
  // an empty list just because root has crowded them past the cap.
  list({ rootLimit = 200, bucket = null } = {}) {
    const db = getDb();
    // Bucket-scoped queries (the Arcade, the Maker galleries) must see EVERY
    // sketch in the bucket, so the root cap must NOT pre-truncate the candidate
    // set — otherwise an older game/world silently drops out of its gallery once
    // >rootLimit newer root sketches exist. Bucket is JS-derived from
    // manifest_json, so we scan the full table and filter in JS; a bucket result
    // is naturally small. Single-user scratch surface, so the full scan is fine
    // (see maker.plan.md — persist a derived bucket column to move this to SQL).
    if (bucket) {
      const rows = db
        .prepare('SELECT * FROM sketches ORDER BY created_at DESC')
        .all();
      return rows.map(rowToSketch).filter((s) => s.bucket === bucket);
    }
    const rows = db
      .prepare(
        `SELECT * FROM sketches WHERE folder_ref IS NOT NULL
         UNION ALL
         SELECT * FROM (
           SELECT * FROM sketches WHERE folder_ref IS NULL
            ORDER BY created_at DESC LIMIT ?
         )
         ORDER BY created_at DESC`,
      )
      .all(rootLimit);
    return rows.map(rowToSketch);
  },

  // Pin (or clear) a sketch's Maker gallery without touching its content. Pass
  // bucket=null to drop back to the derived bucket. Returns the refreshed row,
  // or null if no row matches `ref`.
  setBucket({ ref, bucket }) {
    if (!ref) return null;
    return this.update({ ref, bucket: bucket || null });
  },
};
