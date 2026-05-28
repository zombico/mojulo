/**
 * plans repository (Ring 8 — plan mode).
 *
 * Plans are the PROPOSED layer of mojulo's deliberation model: the speculative
 * counterpart to contextmap's committed reality (meta_principles). A plan is a
 * sealed cognitive unit that draws the schematic of one vertical slice (a
 * "spike") and, once its manifest is tractable, compiles to status='actionable'
 * so the operator can execute it under per-execution approval.
 *
 * Lifecycle (status):
 *   draft → actionable → executing → executed
 *                     ↘ (compile fails: stays draft)
 *                          executing → failed (a manifest call threw)
 *
 * `seen` is the light read/unread inbox gate — opening a plan via get() flips
 * it to 1. The real execution gate is status='actionable' + an explicit
 * confirm at execute time; `seen` is informational, not an approval state.
 *
 * No cross-plan context in v0: plans never reference other plans. Branching
 * ideation (a collider spawning a spike) lives inside the prime plan's
 * manifest, not as sibling rows.
 *
 * See lite-template/integration/app-system/0527/plan-feature/PLAN_MODE.md.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../index.js';

const VALID_LENSES = new Set([
  'spike',
  'segment_expansion',
  'vertical_reinforcement',
  'collider',
]);

function parseJSON(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    planRef: row.plan_ref,
    title: row.title,
    goalMd: row.goal_md,
    lens: row.lens,
    status: row.status,
    seen: row.seen === 1,
    frame: parseJSON(row.frame_json, null),
    manifest: parseJSON(row.manifest_json, null),
    analysis: parseJSON(row.analysis_json, null),
    revisionLog: parseJSON(row.revision_log_json, []),
    executionLog: parseJSON(row.execution_log_json, null),
    // Close-the-loop: archived is orthogonal to status (an archived plan
    // stays status='executed'). release carries the link back to the
    // contextmap artifact(s) this plan's execution materialized.
    archived: row.archived === 1,
    archivedAt: row.archived_at ?? null,
    release: parseJSON(row.release_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateRef() {
  // Short stable ref `plan_<12-hex>` — visually distinct from prov_/trig_.
  return `plan_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export const PlanRepository = {
  /**
   * Forge a new Draft plan. `manifest`, `frame`, `analysis`, and `lens` are
   * optional — a plan can start as goal-only and accrete its shadow scratchpad
   * through revisions. Returns the inserted plan.
   */
  forge({ title, goalMd, lens, frame, manifest, analysis }) {
    if (!title || typeof title !== 'string') {
      throw new Error('title is required');
    }
    if (!goalMd || typeof goalMd !== 'string') {
      throw new Error('goalMd is required (the named goal of the plan)');
    }
    if (lens !== undefined && lens !== null && !VALID_LENSES.has(lens)) {
      throw new Error(
        `lens must be one of: ${[...VALID_LENSES].join(', ')} (got '${lens}')`,
      );
    }
    const db = getDb();
    const planRef = generateRef();
    const result = db
      .prepare(
        `INSERT INTO plans
           (plan_ref, title, goal_md, lens, frame_json, manifest_json, analysis_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        planRef,
        title,
        goalMd,
        lens ?? null,
        frame ? JSON.stringify(frame) : null,
        manifest ? JSON.stringify(manifest) : null,
        analysis ? JSON.stringify(analysis) : null,
      );
    const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(result.lastInsertRowid);
    return rowToPlan(row);
  },

  /**
   * Fetch by ref. When `markSeen` is true (the operator "opening" the plan),
   * flips seen → 1 in the same call.
   */
  getByRef(planRef, { markSeen = false } = {}) {
    if (!planRef || typeof planRef !== 'string') return null;
    const db = getDb();
    if (markSeen) {
      db.prepare('UPDATE plans SET seen = 1 WHERE plan_ref = ? AND seen = 0').run(planRef);
    }
    const row = db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef);
    return rowToPlan(row);
  },

  list({ status } = {}) {
    const db = getDb();
    const clauses = [];
    const params = [];
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC, id DESC`)
      .all(...params);
    return rows.map(rowToPlan);
  },

  /**
   * Apply a revision: append a {note, revised_at} entry to the revision log and
   * optionally patch goal / lens / frame / manifest / analysis. A revision
   * always resets status to 'draft' — touching the schematic un-commits the
   * compile, so the operator must re-compile before re-executing. Returns the
   * updated plan, or null if the ref is unknown.
   */
  revise(planRef, { note, goalMd, lens, frame, manifest, analysis } = {}) {
    if (!planRef || typeof planRef !== 'string') return null;
    if (!note || typeof note !== 'string') {
      throw new Error('note is required on a revision (what changed and why)');
    }
    if (lens !== undefined && lens !== null && !VALID_LENSES.has(lens)) {
      throw new Error(
        `lens must be one of: ${[...VALID_LENSES].join(', ')} (got '${lens}')`,
      );
    }
    const db = getDb();
    const existing = db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef);
    if (!existing) return null;

    const revisionLog = parseJSON(existing.revision_log_json, []);
    revisionLog.push({ note, revised_at: Math.floor(Date.now() / 1000) });

    const next = {
      goal_md: goalMd !== undefined ? goalMd : existing.goal_md,
      lens: lens !== undefined ? lens : existing.lens,
      frame_json:
        frame !== undefined ? (frame ? JSON.stringify(frame) : null) : existing.frame_json,
      manifest_json:
        manifest !== undefined
          ? manifest
            ? JSON.stringify(manifest)
            : null
          : existing.manifest_json,
      analysis_json:
        analysis !== undefined
          ? analysis
            ? JSON.stringify(analysis)
            : null
          : existing.analysis_json,
    };

    // Re-open an archived plan on revise: touching the schematic un-graduates
    // it (symmetric with un-committing the compile by resetting to 'draft'), so
    // it re-enters the active inbox. release_json is kept as historical lineage
    // — a revised plan can still show what it previously released.
    db.prepare(
      `UPDATE plans
         SET goal_md = ?, lens = ?, frame_json = ?, manifest_json = ?, analysis_json = ?,
             revision_log_json = ?, status = 'draft', archived = 0, archived_at = NULL,
             updated_at = unixepoch()
       WHERE plan_ref = ?`,
    ).run(
      next.goal_md,
      next.lens,
      next.frame_json,
      next.manifest_json,
      next.analysis_json,
      JSON.stringify(revisionLog),
      planRef,
    );
    return rowToPlan(db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef));
  },

  /**
   * Transition status. Centralized so the legal transitions live in one place.
   * Throws on an illegal transition. Returns the updated plan.
   */
  setStatus(planRef, status) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef);
    if (!existing) throw new Error(`Plan '${planRef}' not found`);
    db.prepare('UPDATE plans SET status = ?, updated_at = unixepoch() WHERE plan_ref = ?').run(
      status,
      planRef,
    );
    return rowToPlan(db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef));
  },

  /**
   * Record the result of an execution run. `executionLog` is the per-call
   * array; `status` is the terminal status ('executed' | 'failed').
   */
  recordExecution(planRef, { executionLog, status }) {
    const db = getDb();
    db.prepare(
      `UPDATE plans
         SET execution_log_json = ?, status = ?, updated_at = unixepoch()
       WHERE plan_ref = ?`,
    ).run(JSON.stringify(executionLog ?? []), status, planRef);
    return rowToPlan(db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef));
  },

  /**
   * Close the loop: archive a plan whose execution materialized artifact(s)
   * into the contextmap. `release` is the structural link back to those
   * artifacts (the plan→contextmap graduation record); it's stored on the row
   * and surfaced by the /plan inbox. Leaves `status` untouched — archived is
   * orthogonal to the executed/failed terminal status. Returns the updated
   * plan, or null if the ref is unknown.
   */
  archiveWithRelease(planRef, release) {
    if (!planRef || typeof planRef !== 'string') return null;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM plans WHERE plan_ref = ?').get(planRef);
    if (!existing) return null;
    const archivedAt = release?.archivedAt ?? Math.floor(Date.now() / 1000);
    db.prepare(
      `UPDATE plans
         SET archived = 1, archived_at = ?, release_json = ?, updated_at = unixepoch()
       WHERE plan_ref = ?`,
    ).run(archivedAt, release ? JSON.stringify(release) : null, planRef);
    return rowToPlan(db.prepare('SELECT * FROM plans WHERE plan_ref = ?').get(planRef));
  },
};

// Test seam.
export const _internals = { generateRef, VALID_LENSES };
