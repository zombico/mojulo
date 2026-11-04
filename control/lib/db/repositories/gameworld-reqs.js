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
