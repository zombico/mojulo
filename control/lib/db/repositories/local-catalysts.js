/**
 * Local-catalyst repository (local-catalysts.plan.md) — the operator-minted
 * shelf beside the curated library.
 *
 * Rows hold the HEAD; every write appends to local_catalyst_revisions (the
 * beats pattern — history, never the live pointer). The stored
 * frontmatter_json is the *validated* meta in the same shape
 * `parseCatalystFile()` produces — validation is the tool layer's job
 * (`validateCatalystMeta` in ../../mcp/catalysts/loader.js); this module is
 * storage + embedding mirroring only.
 *
 * Embedding posture mirrors game-projects: the write always lands; a failed
 * embed just means no recall row until the next reindex (soft). Archive
 * deletes the embedding row but keeps the revisions — history survives,
 * search stops surfacing it.
 */

import { getDb } from '../index.js';
import { BodyComposition, EmbeddingsRepository } from './embeddings.js';

function rowToCatalyst(row, { withBody = true } = {}) {
  if (!row) return null;
  let meta;
  try {
    meta = JSON.parse(row.frontmatter_json);
  } catch {
    meta = {};
  }
  const out = {
    ...meta,
    id: row.id,
    kind: row.kind,
    // For local catalysts `version` is DERIVED — always the head rev. The
    // honor-system frontmatter number is a curated-shelf concept.
    version: row.rev,
    rev: row.rev,
    status: row.status,
    origin: 'local',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (withBody) out.body = row.body_md;
  return out;
}

function rowToRevision(row, { withBody = false } = {}) {
  if (!row) return null;
  const out = { rev: row.rev, note: row.note || null, createdAt: row.created_at };
  if (withBody) {
    try {
      out.meta = JSON.parse(row.frontmatter_json);
    } catch {
      out.meta = null;
    }
    out.body = row.body_md;
  }
  return out;
}

// The embedding text for a local catalyst — same composition as the curated
// shelf uses in reindexAll, so search treats the two shelves identically.
function embeddingBody(catalyst) {
  return BodyComposition.catalyst(catalyst);
}

function metaJson(catalyst) {
  // Strip storage-owned fields; frontmatter_json carries the validated meta only.
  const { body, rev, status, origin, createdAt, updatedAt, ...meta } = catalyst;
  return JSON.stringify(meta);
}

async function mirrorEmbedding(catalyst) {
  if (process.env.MOJULO_SEMANTIC_INDEX_DISABLED === '1') return;
  const bodyText = embeddingBody(catalyst);
  const embedded = await EmbeddingsRepository.embed('catalyst', catalyst.id, bodyText);
  if (!embedded.vector) return; // unchanged hash or soft failure
  EmbeddingsRepository.upsertSync({
    sourceKind: 'catalyst',
    sourceRef: catalyst.id,
    bodyText,
    hash: embedded.hash,
    vector: embedded.vector,
  });
}

export const LocalCatalystRepository = {
  /**
   * Mint a new local catalyst at rev 1. `catalyst` is the validated object
   * from validateCatalystMeta. Throws if the id already exists in any status
   * (the tool layer routes existing ids to update()).
   */
  create({ catalyst, note } = {}) {
    const db = getDb();
    const existing = db.prepare('SELECT status FROM local_catalysts WHERE id = ?').get(catalyst.id);
    if (existing) {
      throw new Error(
        `Local catalyst '${catalyst.id}' already exists (status: ${existing.status}) — updates append a revision instead.`,
      );
    }
    const json = metaJson(catalyst);
    db.transaction(() => {
      db.prepare(
        `INSERT INTO local_catalysts (id, frontmatter_json, body_md, kind, rev, status)
         VALUES (?, ?, ?, ?, 1, 'active')`,
      ).run(catalyst.id, json, catalyst.body, catalyst.kind);
      db.prepare(
        `INSERT INTO local_catalyst_revisions (catalyst_id, rev, frontmatter_json, body_md, note)
         VALUES (?, 1, ?, ?, ?)`,
      ).run(catalyst.id, json, catalyst.body, note || null);
    })();
    return this.get(catalyst.id);
  },

  async createWithEmbedding(params) {
    const created = this.create(params);
    await mirrorEmbedding(created);
    return created;
  },

  /**
   * Append the next revision and move the head. A write to an archived
   * catalyst revives it — updating something is the clearest possible signal
   * the operator wants it back on the shelf.
   */
  update({ catalyst, note } = {}) {
    const db = getDb();
    const head = db.prepare('SELECT rev FROM local_catalysts WHERE id = ?').get(catalyst.id);
    if (!head) throw new Error(`Local catalyst '${catalyst.id}' not found`);
    const rev = head.rev + 1;
    const json = metaJson(catalyst);
    db.transaction(() => {
      db.prepare(
        `UPDATE local_catalysts
            SET frontmatter_json = ?, body_md = ?, kind = ?, rev = ?, status = 'active',
                updated_at = unixepoch()
          WHERE id = ?`,
      ).run(json, catalyst.body, catalyst.kind, rev, catalyst.id);
      db.prepare(
        `INSERT INTO local_catalyst_revisions (catalyst_id, rev, frontmatter_json, body_md, note)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(catalyst.id, rev, json, catalyst.body, note || null);
    })();
    return this.get(catalyst.id);
  },

  async updateWithEmbedding(params) {
    const updated = this.update(params);
    await mirrorEmbedding(updated);
    return updated;
  },

  /** Archive: off the shelf and out of search, revisions kept. */
  archive(id) {
    const db = getDb();
    const result = db
      .prepare(`UPDATE local_catalysts SET status = 'archived', updated_at = unixepoch() WHERE id = ? AND status = 'active'`)
      .run(id);
    if (result.changes > 0) {
      EmbeddingsRepository.deleteByRefSync('catalyst', id);
    }
    return result.changes > 0;
  },

  /** Head row in any status (callers filter on .status when it matters). */
  get(id) {
    const db = getDb();
    return rowToCatalyst(db.prepare('SELECT * FROM local_catalysts WHERE id = ?').get(id));
  },

  /** The active shelf, newest-updated first. */
  listActive() {
    const db = getDb();
    return db
      .prepare(`SELECT * FROM local_catalysts WHERE status = 'active' ORDER BY updated_at DESC, id`)
      .all()
      .map((row) => rowToCatalyst(row));
  },

  getRevision(id, rev) {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM local_catalyst_revisions WHERE catalyst_id = ? AND rev = ?')
      .get(id, rev);
    return rowToRevision(row, { withBody: true });
  },

  /** Newest-first revision index (no bodies — getRevision fetches one in full). */
  listRevisions(id) {
    const db = getDb();
    return db
      .prepare('SELECT rev, note, created_at FROM local_catalyst_revisions WHERE catalyst_id = ? ORDER BY rev DESC')
      .all(id)
      .map((r) => rowToRevision(r));
  },
};
