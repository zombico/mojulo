/**
 * A gameworld's requisitions (the `gameworld_reqs` table; the ledger's rules are gameworld/reqs.js). A row per unit the
 * director asked for, in the order it was asked (`seq`, from 1 within its world). Only what the book cannot say is
 * stored; a req's status is derived at read time from the book's stamps. Never part of the recipe.
 */
import { getDb } from '../index.js';

const parse = (text, fallback) => {
  if (text === null || text === undefined) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
};

function rowToReq(row) {
  if (!row) return null;
  return {
    id: `r${row.seq}`,
    seq: row.seq,
    world: row.world_ref,
    unit: row.unit,
    remit: parse(row.remit_json, null),
    staffing: row.staffing,
    budget: parse(row.budget_json, {}),
    verdict: parse(row.verdict_json, null),
    notes: parse(row.notes_json, []),
    raisedBy: row.raised_by,
  };
}

/** `r3` → 3; anything else → null. */
export const reqSeq = (id) => (typeof id === 'string' && /^r[1-9]\d*$/.test(id) ? Number(id.slice(1)) : null);

export const GameworldReqRepository = {
  /** A world's reqs in the order they were raised. */
  list(worldRef) {
    return getDb().prepare('SELECT * FROM gameworld_reqs WHERE world_ref = ? ORDER BY seq').all(worldRef).map(rowToReq);
  },

  get(worldRef, id) {
    const seq = reqSeq(id);
    if (seq === null) return null;
    return rowToReq(getDb().prepare('SELECT * FROM gameworld_reqs WHERE world_ref = ? AND seq = ?').get(worldRef, seq));
  },

  /** Raise one; → the req. Its seq is the next in its world. */
  create({ worldRef, unit, remit = null, staffing = 'soloist', budget = {}, raisedBy = 'director' }) {
    const db = getDb();
    const make = db.transaction(() => {
      const seq = (db.prepare('SELECT MAX(seq) AS m FROM gameworld_reqs WHERE world_ref = ?').get(worldRef)?.m ?? 0) + 1;
      db.prepare(`INSERT INTO gameworld_reqs (world_ref, seq, unit, remit_json, staffing, budget_json, raised_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(worldRef, seq, unit, remit === null ? null : JSON.stringify(remit), staffing, JSON.stringify(budget), raisedBy);
      return seq;
    });
    return this.get(worldRef, `r${make()}`);
  },

  /** Change what is given of one req: remit, staffing, budget, verdict, notes. → the req. */
  update(worldRef, id, { remit, staffing, budget, verdict, notes } = {}) {
    const seq = reqSeq(id);
    if (seq === null) return null;
    const sets = [], args = [];
    if (remit !== undefined) { sets.push('remit_json = ?'); args.push(remit === null ? null : JSON.stringify(remit)); }
    if (staffing !== undefined) { sets.push('staffing = ?'); args.push(staffing); }
    if (budget !== undefined) { sets.push('budget_json = ?'); args.push(JSON.stringify(budget)); }
    if (verdict !== undefined) { sets.push('verdict_json = ?'); args.push(verdict === null ? null : JSON.stringify(verdict)); }
    if (notes !== undefined) { sets.push('notes_json = ?'); args.push(JSON.stringify(notes)); }
    if (sets.length) {
      sets.push('updated_at = unixepoch()');
      getDb().prepare(`UPDATE gameworld_reqs SET ${sets.join(', ')} WHERE world_ref = ? AND seq = ?`).run(...args, worldRef, seq);
    }
    return this.get(worldRef, id);
  },
};

function rowToJob(row) {
  if (!row) return null;
  return {
    id: `j${row.n}`, n: row.n, req: `r${row.req_seq}`, kind: row.kind, tier: row.tier,
    ...(row.angle ? { angle: row.angle } : {}), ...(row.lens ? { lens: row.lens } : {}),
    status: row.status, report: parse(row.report_json, null),
  };
}

/** `j2` → 2; anything else → null. */
export const jobN = (id) => (typeof id === 'string' && /^j[1-9]\d*$/.test(id) ? Number(id.slice(1)) : null);

export const GameworldReqJobRepository = {
  /** A req's jobs in the order they were issued. */
  list(worldRef, reqId) {
    const seq = reqSeq(reqId);
    if (seq === null) return [];
    return getDb().prepare('SELECT * FROM gameworld_req_jobs WHERE world_ref = ? AND req_seq = ? ORDER BY n').all(worldRef, seq).map(rowToJob);
  },

  get(worldRef, reqId, jobId) {
    const seq = reqSeq(reqId), n = jobN(jobId);
    if (seq === null || n === null) return null;
    return rowToJob(getDb().prepare('SELECT * FROM gameworld_req_jobs WHERE world_ref = ? AND req_seq = ? AND n = ?').get(worldRef, seq, n));
  },

  /** Issue jobs on a req, in order; → the jobs. */
  issue(worldRef, reqId, jobs) {
    const seq = reqSeq(reqId), db = getDb();
    const run = db.transaction(() => {
      let n = db.prepare('SELECT MAX(n) AS m FROM gameworld_req_jobs WHERE world_ref = ? AND req_seq = ?').get(worldRef, seq)?.m ?? 0;
      const made = [];
      for (const j of jobs) {
        n += 1;
        db.prepare('INSERT INTO gameworld_req_jobs (world_ref, req_seq, n, kind, tier, angle, lens) VALUES (?, ?, ?, ?, ?, ?, ?)').run(worldRef, seq, n, j.kind, j.tier, j.angle ?? null, j.lens ?? null);
        made.push(`j${n}`);
      }
      return made;
    });
    return run().map((id) => this.get(worldRef, reqId, id));
  },

  /** A job's status and, given, its report; → the job. */
  update(worldRef, reqId, jobId, { status, report } = {}) {
    const seq = reqSeq(reqId), n = jobN(jobId);
    if (seq === null || n === null) return null;
    const sets = [], args = [];
    if (status !== undefined) { sets.push('status = ?'); args.push(status); }
    if (report !== undefined) { sets.push('report_json = ?'); args.push(report === null ? null : JSON.stringify(report)); }
    if (sets.length) {
      sets.push('updated_at = unixepoch()');
      getDb().prepare(`UPDATE gameworld_req_jobs SET ${sets.join(', ')} WHERE world_ref = ? AND req_seq = ? AND n = ?`).run(...args, worldRef, seq, n);
    }
    return this.get(worldRef, reqId, jobId);
  },
};
