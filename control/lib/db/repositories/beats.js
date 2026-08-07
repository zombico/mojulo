/**
 * Beats domain repositories (B9, beats.plan.md) — revisions + annotations.
 *
 * Beats artifacts remain rows in `sketches` (the substrate's universal recipe
 * store); these tables are the DOMAIN layer that makes beats first-class to a
 * composer: a revision history behind every ref (create_beats writes rev 1,
 * update_beats appends) and commentary anchored in musical terms. The sketches
 * row always holds the HEAD manifest — revisions are history, never the live
 * pointer — so world `beatsRef` resolution, the player, and WAV export all
 * keep reading the row they always read.
 */

import { getDb } from '../index.js';

function rowToRevision(row, { withManifest = false } = {}) {
  if (!row) return null;
  const out = {
    rev: row.rev,
    note: row.note || null,
    createdAt: row.created_at,
  };
  if (withManifest) {
    try {
      out.manifest = JSON.parse(row.manifest_json);
    } catch {
      out.manifest = null;
    }
  }
  return out;
}

export const BeatsRevisionRepository = {
  // Append the next revision for `ref` (rev 1 when none exist). Returns the
  // written revision row (with manifest).
  append({ ref, manifest, note }) {
    const db = getDb();
    const head = db.prepare('SELECT MAX(rev) AS rev FROM beats_revisions WHERE ref = ?').get(ref);
    const rev = (head && head.rev ? head.rev : 0) + 1;
    db.prepare(
      `INSERT INTO beats_revisions (ref, rev, manifest_json, note, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    ).run(ref, rev, JSON.stringify(manifest), note || null);
    return this.get(ref, rev);
  },

  get(ref, rev) {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM beats_revisions WHERE ref = ? AND rev = ?')
      .get(ref, rev);
    return rowToRevision(row, { withManifest: true });
  },

  head(ref) {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM beats_revisions WHERE ref = ? ORDER BY rev DESC LIMIT 1')
      .get(ref);
    return rowToRevision(row, { withManifest: true });
  },

  // Newest-first revision index (no manifests — get() fetches one in full).
  list(ref) {
    const db = getDb();
    return db
      .prepare('SELECT rev, note, created_at FROM beats_revisions WHERE ref = ? ORDER BY rev DESC')
      .all(ref)
      .map((r) => rowToRevision(r));
  },
};

function rowToAnnotation(row) {
  if (!row) return null;
  let anchor;
  try {
    anchor = JSON.parse(row.anchor_json);
  } catch {
    anchor = { scope: 'artifact' };
  }
  return {
    id: row.id,
    ref: row.ref,
    rev: row.rev,
    anchor,
    body: row.body_md,
    author: row.author,
    status: row.status,
    resolvedRev: row.resolved_rev ?? null,
    createdAt: row.created_at,
  };
}

export const BeatsAnnotationRepository = {
  add({ ref, rev, anchor, body, author }) {
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO beats_annotations (ref, rev, anchor_json, body_md, author, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', unixepoch())`,
    ).run(ref, rev, JSON.stringify(anchor || { scope: 'artifact' }), body, author === 'operator' ? 'operator' : 'agent');
    return this.get(result.lastInsertRowid);
  },

  get(id) {
    const db = getDb();
    return rowToAnnotation(db.prepare('SELECT * FROM beats_annotations WHERE id = ?').get(id));
  },

  // Open first (newest first within status) — the read order get_beats surfaces.
  list(ref, { status } = {}) {
    const db = getDb();
    const rows = status
      ? db.prepare('SELECT * FROM beats_annotations WHERE ref = ? AND status = ? ORDER BY id DESC').all(ref, status)
      : db.prepare(
          `SELECT * FROM beats_annotations WHERE ref = ?
           ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC`,
        ).all(ref);
    return rows.map(rowToAnnotation);
  },

  // Mark annotations resolved by the revision that answered them. Returns the
  // number of rows that actually flipped (already-resolved ids are no-ops).
  resolve({ ref, ids, resolvedRev }) {
    if (!Array.isArray(ids) || !ids.length) return 0;
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(
      `UPDATE beats_annotations SET status = 'resolved', resolved_rev = ?
        WHERE ref = ? AND status = 'open' AND id IN (${placeholders})`,
    ).run(resolvedRev ?? null, ref, ...ids);
    return result.changes;
  },
};
