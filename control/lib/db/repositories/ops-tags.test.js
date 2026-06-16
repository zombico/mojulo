// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../index.js';
import { OpsTagRepository, _internals } from './ops-tags.js';

function reset() {
  const db = getDb();
  db.exec('DELETE FROM ops_tag_members; DELETE FROM ops_tags;');
}

describe('OpsTagRepository', () => {
  beforeEach(() => reset());

  it('forges a tag with a unique ref and stores the descriptor', () => {
    const tag = OpsTagRepository.forge({
      title: 'Marketing',
      descriptorMd: 'Outbound + nurture, brand voice X, no transactional outreach.',
    });
    expect(tag.tagRef).toMatch(/^ops_[0-9a-f]{12}$/);
    expect(tag.title).toBe('Marketing');
    expect(tag.descriptorMd).toMatch(/brand voice X/);
    expect(tag.status).toBe('active');
  });

  it('refuses to forge without title or descriptor', () => {
    expect(() => OpsTagRepository.forge({ descriptorMd: 'x' })).toThrow(/title is required/);
    expect(() => OpsTagRepository.forge({ title: 'x' })).toThrow(/descriptor.*required/i);
  });

  it('lists tags with optional status filter, newest-updated first', () => {
    const a = OpsTagRepository.forge({ title: 'A', descriptorMd: 'aa' });
    const b = OpsTagRepository.forge({ title: 'B', descriptorMd: 'bb' });
    OpsTagRepository.revise(b.tagRef, { status: 'archived' });

    const all = OpsTagRepository.list();
    expect(all.map((t) => t.tagRef)).toEqual([b.tagRef, a.tagRef]);

    const active = OpsTagRepository.list({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].tagRef).toBe(a.tagRef);

    const archived = OpsTagRepository.list({ status: 'archived' });
    expect(archived).toHaveLength(1);
    expect(archived[0].tagRef).toBe(b.tagRef);
  });

  it('rejects an unknown status filter', () => {
    expect(() => OpsTagRepository.list({ status: 'frozen' })).toThrow(/status must be one of/);
  });

  it('binds, lists, and unbinds members', () => {
    const tag = OpsTagRepository.forge({ title: 'Mktg', descriptorMd: 'd' });

    const m1 = OpsTagRepository.bind({
      tagRef: tag.tagRef,
      memberKind: 'bot',
      memberRef: 'deploy_123',
    });
    expect(m1.memberKind).toBe('bot');
    expect(m1.memberRef).toBe('deploy_123');

    const m2 = OpsTagRepository.bind({
      tagRef: tag.tagRef,
      memberKind: 'cook',
      memberRef: 'cook_abc',
    });
    expect(m2.memberKind).toBe('cook');

    // Re-bind is idempotent — no error, no duplicate row.
    OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'bot', memberRef: 'deploy_123' });

    const members = OpsTagRepository.listMembers(tag.tagRef);
    expect(members).toHaveLength(2);

    const counts = OpsTagRepository.memberCounts(tag.tagRef);
    expect(counts).toEqual({ bot: 1, cook: 1 });

    const removed = OpsTagRepository.unbind({
      tagRef: tag.tagRef,
      memberKind: 'bot',
      memberRef: 'deploy_123',
    });
    expect(removed).toBe(true);
    expect(OpsTagRepository.listMembers(tag.tagRef)).toHaveLength(1);
  });

  it('rejects an unknown member kind at the gate (no pre-reality)', () => {
    const tag = OpsTagRepository.forge({ title: 't', descriptorMd: 'd' });
    expect(() =>
      OpsTagRepository.bind({
        tagRef: tag.tagRef,
        memberKind: 'plan',
        memberRef: 'plan_xyz',
      }),
    ).toThrow(/memberKind must be one of/);
    expect(() =>
      OpsTagRepository.bind({
        tagRef: tag.tagRef,
        memberKind: 'research',
        memberRef: 'res_xyz',
      }),
    ).toThrow(/memberKind must be one of/);
  });

  it('refuses to bind to an unknown tag', () => {
    expect(() =>
      OpsTagRepository.bind({
        tagRef: 'ops_deadbeef0000',
        memberKind: 'bot',
        memberRef: 'd_1',
      }),
    ).toThrow(/not found/);
  });

  it('unbind on a non-existent binding returns false (idempotent)', () => {
    const tag = OpsTagRepository.forge({ title: 't', descriptorMd: 'd' });
    expect(
      OpsTagRepository.unbind({
        tagRef: tag.tagRef,
        memberKind: 'bot',
        memberRef: 'never_bound',
      }),
    ).toBe(false);
  });

  it('revise patches title / descriptor / status and bumps updated_at', () => {
    const tag = OpsTagRepository.forge({ title: 'Original', descriptorMd: 'orig' });
    const t1 = OpsTagRepository.revise(tag.tagRef, { descriptorMd: 'refined' });
    expect(t1.descriptorMd).toBe('refined');
    expect(t1.title).toBe('Original');

    const t2 = OpsTagRepository.revise(tag.tagRef, { status: 'archived' });
    expect(t2.status).toBe('archived');
  });

  it('revise refuses with no patch fields', () => {
    const tag = OpsTagRepository.forge({ title: 't', descriptorMd: 'd' });
    expect(() => OpsTagRepository.revise(tag.tagRef, {})).toThrow(/at least one of/);
  });

  it('revise on an unknown tag returns null', () => {
    expect(OpsTagRepository.revise('ops_nonexistent00', { title: 'x' })).toBeNull();
  });

  it('listTagsForMember finds all tags owning a resource (multi-tag membership)', () => {
    const marketing = OpsTagRepository.forge({ title: 'Marketing', descriptorMd: 'm' });
    const finance = OpsTagRepository.forge({ title: 'Finance', descriptorMd: 'f' });
    const ops = OpsTagRepository.forge({ title: 'Ops', descriptorMd: 'o' });

    OpsTagRepository.bind({ tagRef: marketing.tagRef, memberKind: 'bot', memberRef: 'shared_bot' });
    OpsTagRepository.bind({ tagRef: finance.tagRef, memberKind: 'bot', memberRef: 'shared_bot' });
    OpsTagRepository.bind({ tagRef: ops.tagRef, memberKind: 'bot', memberRef: 'other_bot' });

    const owners = OpsTagRepository.listTagsForMember({
      memberKind: 'bot',
      memberRef: 'shared_bot',
    });
    const refs = owners.map((t) => t.tagRef).sort();
    expect(refs).toEqual([finance.tagRef, marketing.tagRef].sort());
  });

  it('cascading delete: removing a tag drops its member rows', () => {
    const tag = OpsTagRepository.forge({ title: 't', descriptorMd: 'd' });
    OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'bot', memberRef: 'd1' });
    OpsTagRepository.bind({ tagRef: tag.tagRef, memberKind: 'cook', memberRef: 'c1' });

    const db = getDb();
    db.prepare('DELETE FROM ops_tags WHERE tag_ref = ?').run(tag.tagRef);
    const remaining = db
      .prepare('SELECT COUNT(*) AS n FROM ops_tag_members WHERE tag_ref = ?')
      .get(tag.tagRef);
    expect(remaining.n).toBe(0);
  });

  it('VALID_MEMBER_KINDS does not include plan or research', () => {
    expect(_internals.VALID_MEMBER_KINDS.has('plan')).toBe(false);
    expect(_internals.VALID_MEMBER_KINDS.has('research')).toBe(false);
    expect(_internals.VALID_MEMBER_KINDS.has('bot')).toBe(true);
  });
});
