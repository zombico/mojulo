/**
 * Sketch revisions (continuous-guardrails.plan.md G5, actioning cad-aid.plan.md C2) — the
 * beats_revisions shape for the SOLID kinds.
 *
 * Solids stay rows in `sketches` (the universal recipe store) and every update_sketch edit
 * overwrote the row in place with no history — iteration leaked into sibling refs or was
 * destructive. This table is the DOMAIN layer that makes a solid's history first-class: the
 * PREVIOUS manifest is archived before each overwrite, so rev 1 is the mint manifest (written
 * lazily at the first edit — no mint site changes) and the sketches row always holds HEAD.
 * Revisions are history, never the live pointer: /world, export, skins all read the row.
 */

import { getDb } from '../index.js';

// The stored `kind` of every mint_solid family (mint-solid.js SOLID_KINDS, by what they PERSIST:
// the code door stores 'workbench', 'vehicle' stores 'vehicle-instance', 'solid-turntable'
// stores 'css3d-turntable'). Worlds and diagrams iterate by sibling refs today; widening this
// set is a decision, not a default.
export const REVISIONED_KINDS = new Set([
  'workbench', 'assembler', 'carved-solid', 'css3d-turntable', 'vehicle-instance',
  'figure', 'animal', 'manji-tree', 'edifice',
]);

function rowToRevision(row, { withManifest = false } = {}) {
  if (!row) return null;
  const out = { rev: row.rev, note: row.note || null, createdAt: row.created_at };
  if (withManifest) {
    try { out.manifest = JSON.parse(row.manifest_json); } catch { out.manifest = null; }
  }
  return out;
}

export const SketchRevisionRepository = {
  // Append the next revision for `ref` (rev 1 when none exist). Returns the written row.
  append({ ref, manifest, note }) {
    const db = getDb();
    const head = db.prepare('SELECT MAX(rev) AS rev FROM sketch_revisions WHERE ref = ?').get(ref);
    const rev = (head && head.rev ? head.rev : 0) + 1;
    db.prepare(
      `INSERT INTO sketch_revisions (ref, rev, manifest_json, note, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    ).run(ref, rev, JSON.stringify(manifest), note || null);
    return this.get(ref, rev);
  },

  get(ref, rev) {
    const row = getDb().prepare('SELECT * FROM sketch_revisions WHERE ref = ? AND rev = ?').get(ref, rev);
    return rowToRevision(row, { withManifest: true });
  },

  head(ref) {
    const row = getDb().prepare('SELECT * FROM sketch_revisions WHERE ref = ? ORDER BY rev DESC LIMIT 1').get(ref);
    return rowToRevision(row, { withManifest: true });
  },

  // Newest-first index (no manifests — get() fetches one in full).
  list(ref) {
    return getDb()
      .prepare('SELECT rev, note, created_at FROM sketch_revisions WHERE ref = ? ORDER BY rev DESC')
      .all(ref)
      .map((r) => rowToRevision(r));
  },
};
