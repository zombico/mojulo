/**
 * Render handoff repository (render-handoff.plan.md — the durable I3 seam).
 *
 * Durable rows for the render-worker bicycle (docs/bicycles.md): one row per
 * render target parked for an external image-capable worker, moving through
 * pending → in_flight → submitted → accepted | rejected. The durability is
 * the whole point — a parked request must outlive a control-plane restart
 * (the property the in-memory `mcp_jobs` long-poll cannot give). All lifecycle
 * transitions bump `updated_at`; `id` is a render-event provenance token
 * (`irq_…`), never manifest data.
 */

import { getDb } from '../index.js';

function renderRequestId() {
  // Short collision-resistant slug from crypto entropy (the shortRef pattern).
  // A render-event id — provenance, not a seed; randomness is legitimate here.
  const buf = new Uint32Array(3);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf, (n) => n.toString(16).padStart(8, '0')).join('');
  return `irq_${hex.slice(0, 16)}`;
}

function parseJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rowToRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    ref: row.ref,
    target: row.target,
    kind: row.kind,
    manifestHash: row.manifest_hash,
    status: row.status,
    renderN: row.render_n ?? null,
    workerAudit: parseJson(row.worker_audit),
    acceptAudit: parseJson(row.accept_audit),
    source: row.source || null,
    pulledAt: row.pulled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const RenderRequestRepository = {
  /**
   * Park a request for (ref, target, manifestHash). Idempotent per the UNIQUE
   * constraint — a re-request against the same head manifest returns the
   * existing row rather than duplicating it (or resurrecting a terminal one).
   */
  park({ ref, target, kind, manifestHash }) {
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM image_render_requests WHERE ref = ? AND target = ? AND manifest_hash = ?')
      .get(ref, target, manifestHash);
    if (existing) return rowToRequest(existing);
    const id = renderRequestId();
    db.prepare(
      `INSERT INTO image_render_requests (id, ref, target, kind, manifest_hash, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
    ).run(id, ref, target, kind, manifestHash);
    return this.getById(id);
  },

  getById(id) {
    const db = getDb();
    return rowToRequest(
      db.prepare('SELECT * FROM image_render_requests WHERE id = ?').get(id),
    );
  },

  listByRef(ref) {
    const db = getDb();
    return db
      .prepare('SELECT * FROM image_render_requests WHERE ref = ? ORDER BY created_at ASC, rowid ASC')
      .all(ref)
      .map(rowToRequest);
  },

  listPending({ ref } = {}) {
    const db = getDb();
    const rows = ref
      ? db
          .prepare(
            "SELECT * FROM image_render_requests WHERE status = 'pending' AND ref = ? ORDER BY created_at ASC, rowid ASC",
          )
          .all(ref)
      : db
          .prepare(
            "SELECT * FROM image_render_requests WHERE status = 'pending' ORDER BY created_at ASC, rowid ASC",
          )
          .all();
    return rows.map(rowToRequest);
  },

  /**
   * Claim the oldest pending request (optionally scoped to one ref) — marks it
   * in_flight and stamps pulled_at so concurrent pullers don't double-claim.
   * Returns the claimed request, or null when the queue is drained. The
   * SELECT+UPDATE runs in an IMMEDIATE transaction so the claim is atomic.
   */
  claimNext({ ref } = {}) {
    const db = getDb();
    const claim = db.transaction(() => {
      const next = ref
        ? db
            .prepare(
              "SELECT * FROM image_render_requests WHERE status = 'pending' AND ref = ? ORDER BY created_at ASC, rowid ASC LIMIT 1",
            )
            .get(ref)
        : db
            .prepare(
              "SELECT * FROM image_render_requests WHERE status = 'pending' ORDER BY created_at ASC, rowid ASC LIMIT 1",
            )
            .get();
      if (!next) return null;
      db.prepare(
        "UPDATE image_render_requests SET status = 'in_flight', pulled_at = unixepoch(), updated_at = unixepoch() WHERE id = ?",
      ).run(next.id);
      return this.getById(next.id);
    });
    return claim.immediate ? claim.immediate() : claim();
  },

  /**
   * Record a worker submission: link the render-store slot, store the worker's
   * audit claim + source, move to submitted. Only a pulled (in_flight) request
   * — or a re-submitted one — may be submitted against.
   */
  recordSubmit({ id, renderN, workerAudit, source }) {
    const db = getDb();
    const info = db
      .prepare(
        `UPDATE image_render_requests
         SET status = 'submitted', render_n = ?, worker_audit = ?, source = ?, updated_at = unixepoch()
         WHERE id = ? AND status IN ('in_flight','submitted','rejected')`,
      )
      .run(renderN, workerAudit ? JSON.stringify(workerAudit) : null, source || null, id);
    if (info.changes === 0) {
      const cur = this.getById(id);
      if (!cur) throw new Error(`render request '${id}' not found`);
      throw new Error(
        `render request '${id}' is '${cur.status}' — pull it first (submit accepts in_flight | submitted | rejected)`,
      );
    }
    return this.getById(id);
  },

  /** The audit gate: accept a submitted render, recording the accepting audit. */
  recordAccept({ id, acceptAudit }) {
    return this._resolve({ id, status: 'accepted', acceptAudit });
  },

  /** The audit gate: reject a submitted render, recording why. */
  recordReject({ id, acceptAudit }) {
    return this._resolve({ id, status: 'rejected', acceptAudit });
  },

  _resolve({ id, status, acceptAudit }) {
    const db = getDb();
    const info = db
      .prepare(
        `UPDATE image_render_requests
         SET status = ?, accept_audit = ?, updated_at = unixepoch()
         WHERE id = ? AND status IN ('submitted','accepted','rejected')`,
      )
      .run(status, acceptAudit ? JSON.stringify(acceptAudit) : null, id);
    if (info.changes === 0) {
      const cur = this.getById(id);
      if (!cur) throw new Error(`render request '${id}' not found`);
      throw new Error(
        `render request '${id}' is '${cur.status}' — only a submitted render can be accepted or rejected`,
      );
    }
    return this.getById(id);
  },

  cancel({ id }) {
    const db = getDb();
    db.prepare(
      "UPDATE image_render_requests SET status = 'cancelled', updated_at = unixepoch() WHERE id = ? AND status NOT IN ('accepted')",
    ).run(id);
    return this.getById(id);
  },
};

export const _internals = { renderRequestId };
