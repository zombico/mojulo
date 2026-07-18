// File-backed SQLite (NOT :memory:) — the whole point of this table is that a
// parked render request survives a control-plane restart, and a :memory: DB
// is destroyed on close. Set the path before any import that pulls in
// db/index.js (getDb is lazy and reads SQLITE_PATH on first call).
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.SQLITE_PATH = path.join(
  mkdtempSync(path.join(os.tmpdir(), 'irq-restart-')),
  'render-requests.db',
);
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, closeDb } from '../index.js';
import { RenderRequestRepository as R } from './render-requests.js';

function reset() {
  getDb().exec('DELETE FROM image_render_requests;');
}

const PARK = { ref: 'sk_test01', target: 'page', kind: 'image-outcome', manifestHash: 'abc123' };

describe('RenderRequestRepository', () => {
  beforeEach(() => reset());

  it('parks a durable request with an irq_ id and pending status', () => {
    const r = R.park(PARK);
    expect(r.id).toMatch(/^irq_[0-9a-f]{16}$/);
    expect(r.status).toBe('pending');
    expect(r.ref).toBe('sk_test01');
    expect(r.target).toBe('page');
  });

  it('is idempotent per (ref, target, manifestHash) — a re-request returns the same row', () => {
    const a = R.park(PARK);
    const b = R.park(PARK);
    expect(b.id).toBe(a.id);
    expect(R.listByRef('sk_test01')).toHaveLength(1);
    // A different head manifest is a NEW request, not a stale one.
    const c = R.park({ ...PARK, manifestHash: 'def456' });
    expect(c.id).not.toBe(a.id);
    expect(R.listByRef('sk_test01')).toHaveLength(2);
  });

  it('claimNext marks the oldest pending request in_flight and drains in order', () => {
    const first = R.park(PARK);
    const second = R.park({ ...PARK, target: 'panel-2' });
    const claimedA = R.claimNext({ ref: 'sk_test01' });
    expect(claimedA.id).toBe(first.id);
    expect(claimedA.status).toBe('in_flight');
    expect(claimedA.pulledAt).toBeTypeOf('number');
    const claimedB = R.claimNext({ ref: 'sk_test01' });
    expect(claimedB.id).toBe(second.id);
    // Queue drained — nothing pending left.
    expect(R.claimNext({ ref: 'sk_test01' })).toBeNull();
  });

  it('drives the lifecycle pending → in_flight → submitted → accepted', () => {
    const r = R.park(PARK);
    R.claimNext({ ref: 'sk_test01' });
    const submitted = R.recordSubmit({ id: r.id, renderN: 1, workerAudit: { invoked_generator: true }, source: 'test' });
    expect(submitted.status).toBe('submitted');
    expect(submitted.renderN).toBe(1);
    expect(submitted.workerAudit).toEqual({ invoked_generator: true });
    const accepted = R.recordAccept({ id: r.id, acceptAudit: { beats_ok: true } });
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptAudit).toEqual({ beats_ok: true });
  });

  it('refuses to accept a render that was never submitted (the gate is a separate step)', () => {
    const r = R.park(PARK);
    R.claimNext({ ref: 'sk_test01' });
    // in_flight, not submitted — accept must refuse.
    expect(() => R.recordAccept({ id: r.id, acceptAudit: {} })).toThrow(/only a submitted render/);
  });

  it('a rejected render can be re-submitted against the same request', () => {
    const r = R.park(PARK);
    R.claimNext({ ref: 'sk_test01' });
    R.recordSubmit({ id: r.id, renderN: 1 });
    const rejected = R.recordReject({ id: r.id, acceptAudit: { scaffold_echo: true } });
    expect(rejected.status).toBe('rejected');
    const resubmitted = R.recordSubmit({ id: r.id, renderN: 2 });
    expect(resubmitted.status).toBe('submitted');
    expect(resubmitted.renderN).toBe(2);
  });

  // THE core proof: durability across a restart. mcp_jobs (in-memory long-poll)
  // cannot do this; the render handoff must.
  it('a parked request SURVIVES a control-plane restart (close + reopen the DB)', () => {
    const r = R.park(PARK);
    expect(r.status).toBe('pending');

    closeDb(); // simulate `npm run dev` going down with a render still outstanding

    // Reopen (a fresh process would getDb() on the same file path).
    const reopened = R.getById(r.id);
    expect(reopened).not.toBeNull();
    expect(reopened.id).toBe(r.id);
    expect(reopened.status).toBe('pending');
    // And it is still pullable after the restart.
    const claimed = R.claimNext({});
    expect(claimed.id).toBe(r.id);
    expect(claimed.status).toBe('in_flight');
  });
});
