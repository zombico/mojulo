/**
 * Cook repository (Ring 9 — research mode v2, slice 2).
 *
 * A Cook row is the database-side index of an Outcome Artifact; the load-bearing
 * thing it points at is the folder under `control/data/outcomes/<cook_ref>/`
 * (report.md + index.html + manifest.json + optional visuals). The folder is
 * what the user opens; the row is how we find it again.
 *
 * One-way coupling: cooks reference stashes (by ref, denormalized into JSON);
 * stashes never know about cooks. The materialization of the folder is
 * delegated to lib/outcomes/write.js — this repository only writes rows.
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

function rowToCook(row) {
  if (!row) return null;
  const slices = parseJSON(row.slices_json, []);
  return {
    id: row.id,
    cookRef: row.cook_ref,
    slices,
    // Denormalized: the distinct set of stash_refs touched, in slice order.
    // Handy for routing the cook back to the source stashes (e.g. UI chips,
    // synthesize_abstract({ from_cook }) lineage).
    stashRefs: [...new Set(slices.map((s) => s.stash_ref).filter(Boolean))],
    aim: row.aim,
    additionalContext: parseJSON(row.additional_context_json, []),
    outcomeDir: row.outcome_dir,
    suggestedLens: row.suggested_lens,
    templateVersion: row.template_version,
    createdAt: row.created_at,
  };
}

function generateRef() {
  return `cook_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export const CookRepository = {
  /**
   * Insert a cook row. The folder is materialized by lib/outcomes/write.js
   * BEFORE this call — by the time we insert, the artifact is on disk and
   * outcomeDir is the relative path that resolves it.
   *
   * `slices` is the cleaved-slice manifest: an ordered array of
   * { stash_ref, item_ids? } objects (item_ids omitted = whole stash). `aim`
   * is the singular dismantling question the agent aimed the nucleation arrow
   * at — one target per cook (the binding vow).
   */
  insert({ cookRef, slices, aim, additionalContext, outcomeDir, suggestedLens, templateVersion }) {
    if (!cookRef || typeof cookRef !== 'string') {
      throw new Error('cookRef is required');
    }
    if (!Array.isArray(slices) || slices.length === 0) {
      throw new Error('slices must be a non-empty array of { stash_ref, item_ids? } objects');
    }
    for (const [i, s] of slices.entries()) {
      if (!s || typeof s !== 'object' || typeof s.stash_ref !== 'string' || !s.stash_ref) {
        throw new Error(`slices[${i}] must be an object with a stash_ref string`);
      }
      if (s.item_ids !== undefined) {
        if (!Array.isArray(s.item_ids) || !s.item_ids.every((n) => Number.isInteger(n))) {
          throw new Error(`slices[${i}].item_ids must be an array of integers when provided`);
        }
      }
    }
    if (!aim || typeof aim !== 'string') {
      throw new Error('aim is required (the singular dismantling question)');
    }
    if (!outcomeDir || typeof outcomeDir !== 'string') {
      throw new Error('outcomeDir is required');
    }
    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO stash_cooks
           (cook_ref, slices_json, aim, additional_context_json, outcome_dir, suggested_lens, template_version)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        cookRef,
        JSON.stringify(slices),
        aim,
        JSON.stringify(additionalContext || []),
        outcomeDir,
        suggestedLens || null,
        templateVersion || null,
      );
    return rowToCook(db.prepare('SELECT * FROM stash_cooks WHERE id = ?').get(result.lastInsertRowid));
  },

  getByRef(cookRef) {
    if (!cookRef || typeof cookRef !== 'string') return null;
    const db = getDb();
    return rowToCook(db.prepare('SELECT * FROM stash_cooks WHERE cook_ref = ?').get(cookRef));
  },

  list({ limit } = {}) {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM stash_cooks ORDER BY created_at DESC, id DESC ${limit ? 'LIMIT ?' : ''}`,
      )
      .all(...(limit ? [limit] : []));
    return rows.map(rowToCook);
  },
};

// Test seam.
export const _internals = { generateRef };
