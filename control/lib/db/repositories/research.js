/**
 * research repository (Ring 9 — research mode).
 *
 * Research is the ACCRETIVE / exploratory layer upstream of the proposed layer
 * (plans). A research session is a durable, book-like context with no goal but
 * to assist; starting one auto-saves it. Broad items bind to it; abstracts are
 * synthesized from the accreted book and (optionally) sent to plan mojulo for
 * evaluation.
 *
 * Three tables:
 *   - research_sessions   — the book (open | archived)
 *   - research_items      — broad bindings (link/article/summary/screencap/…)
 *   - research_abstracts  — append-only synthesis history
 *
 * One-way coupling: this repository never imports plan code. The abstract →
 * plan bridge lives in lib/research/evaluate.js and is invoked above this
 * layer. See lite-template/integration/app-system/0528/research-mode.md.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';

function parseJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    researchRef: row.research_ref,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    researchRef: row.research_ref,
    kind: row.kind,
    title: row.title,
    body: row.body_md,
    sourceUrl: row.source_url,
    mediaRef: row.media_ref,
    metadata: parseJSON(row.metadata_json, null),
    createdAt: row.created_at,
  };
}

function rowToAbstract(row) {
  if (!row) return null;
  return {
    id: row.id,
    researchRef: row.research_ref,
    body: row.body_md,
    itemCount: row.item_count,
    planRef: row.plan_ref,
    assessment: parseJSON(row.assessment_json, null),
    createdAt: row.created_at,
  };
}

function generateRef() {
  // Short stable ref `res_<12-hex>` — visually distinct from plan_/prov_/trig_.
  return `res_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export const ResearchRepository = {
  /**
   * Start (auto-save) a research session. Low-ceremony on purpose: the session
   * exists the moment research begins; abandoning it just leaves a thin book.
   */
  startSession({ title }) {
    if (!title || typeof title !== 'string') {
      throw new Error('title is required to start a research session');
    }
    const db = getDb();
    const researchRef = generateRef();
    const result = db
      .prepare('INSERT INTO research_sessions (research_ref, title) VALUES (?, ?)')
      .run(researchRef, title);
    const row = db
      .prepare('SELECT * FROM research_sessions WHERE id = ?')
      .get(result.lastInsertRowid);
    return rowToSession(row);
  },

  getSession(researchRef) {
    if (!researchRef || typeof researchRef !== 'string') return null;
    const db = getDb();
    return rowToSession(
      db.prepare('SELECT * FROM research_sessions WHERE research_ref = ?').get(researchRef),
    );
  },

  listSessions({ status } = {}) {
    const db = getDb();
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    const rows = db
      .prepare(`SELECT * FROM research_sessions ${where} ORDER BY updated_at DESC, id DESC`)
      .all(...params);
    return rows.map(rowToSession);
  },

  archiveSession(researchRef) {
    const db = getDb();
    const result = db
      .prepare(
        "UPDATE research_sessions SET status = 'archived', updated_at = unixepoch() WHERE research_ref = ? AND status = 'open'",
      )
      .run(researchRef);
    return result.changes > 0;
  },

  /**
   * Bind a broad item to the book. Touches the session's updated_at so the
   * inbox sorts by recent activity. Returns the inserted item.
   */
  bindItem({ researchRef, kind, title, body, sourceUrl, mediaRef, metadata }) {
    const db = getDb();
    const session = db
      .prepare('SELECT id FROM research_sessions WHERE research_ref = ?')
      .get(researchRef);
    if (!session) throw new Error(`Research session '${researchRef}' not found`);
    const result = db
      .prepare(
        `INSERT INTO research_items
           (research_ref, kind, title, body_md, source_url, media_ref, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        researchRef,
        kind,
        title ?? null,
        body ?? null,
        sourceUrl ?? null,
        mediaRef ?? null,
        metadata ? JSON.stringify(metadata) : null,
      );
    db.prepare('UPDATE research_sessions SET updated_at = unixepoch() WHERE research_ref = ?').run(
      researchRef,
    );
    const row = db.prepare('SELECT * FROM research_items WHERE id = ?').get(result.lastInsertRowid);
    return rowToItem(row);
  },

  listItems(researchRef) {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM research_items WHERE research_ref = ? ORDER BY created_at ASC, id ASC')
      .all(researchRef);
    return rows.map(rowToItem);
  },

  countItems(researchRef) {
    const db = getDb();
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM research_items WHERE research_ref = ?')
      .get(researchRef);
    return row ? row.n : 0;
  },

  /**
   * Append a synthesized abstract. itemCount snapshots the book size at
   * synthesis time. plan_ref / assessment are backfilled separately via
   * attachAbstractEvaluation once plan mojulo has evaluated it.
   */
  insertAbstract({ researchRef, body, itemCount }) {
    const db = getDb();
    const session = db
      .prepare('SELECT id FROM research_sessions WHERE research_ref = ?')
      .get(researchRef);
    if (!session) throw new Error(`Research session '${researchRef}' not found`);
    const result = db
      .prepare(
        'INSERT INTO research_abstracts (research_ref, body_md, item_count) VALUES (?, ?, ?)',
      )
      .run(researchRef, body, itemCount ?? 0);
    db.prepare('UPDATE research_sessions SET updated_at = unixepoch() WHERE research_ref = ?').run(
      researchRef,
    );
    const row = db
      .prepare('SELECT * FROM research_abstracts WHERE id = ?')
      .get(result.lastInsertRowid);
    return rowToAbstract(row);
  },

  attachAbstractEvaluation(abstractId, { planRef, assessment }) {
    const db = getDb();
    db.prepare(
      'UPDATE research_abstracts SET plan_ref = ?, assessment_json = ? WHERE id = ?',
    ).run(planRef ?? null, assessment ? JSON.stringify(assessment) : null, abstractId);
    return rowToAbstract(db.prepare('SELECT * FROM research_abstracts WHERE id = ?').get(abstractId));
  },

  listAbstracts(researchRef) {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM research_abstracts WHERE research_ref = ? ORDER BY created_at ASC, id ASC',
      )
      .all(researchRef);
    return rows.map(rowToAbstract);
  },

  /** Full book: session + items + abstracts. */
  getFullBook(researchRef) {
    const session = this.getSession(researchRef);
    if (!session) return null;
    return {
      session,
      items: this.listItems(researchRef),
      abstracts: this.listAbstracts(researchRef),
    };
  },
};

// Test seam.
export const _internals = { generateRef };
