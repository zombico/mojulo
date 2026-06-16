// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db/index';
import {
  enterOperationsModeHandler,
  forgeOpsTagHandler,
  bindToOpsTagHandler,
  unbindFromOpsTagHandler,
  getOpsTagHandler,
  listOpsTagsHandler,
  reviseOpsTagHandler,
  _internals,
} from './operations-mode.js';

function reset() {
  const db = getDb();
  db.exec('DELETE FROM ops_tag_members; DELETE FROM ops_tags;');
}

describe('operations-mode MCP tools', () => {
  beforeEach(() => reset());

  it('enter_operations_mode returns the discipline brief', async () => {
    const out = await enterOperationsModeHandler({}, {});
    expect(out.brief).toBe(_internals.OPERATIONS_MODE_BRIEF);
    expect(out.brief).toMatch(/Operations mode/);
    expect(out.brief).toMatch(/Consulted, not driving/);
  });

  it('forge_ops_tag creates a tag and returns its ref', async () => {
    const out = await forgeOpsTagHandler(
      { title: 'Marketing', descriptor: 'Outbound nurture, brand voice X.' },
      {},
    );
    expect(out.tag_ref).toMatch(/^ops_[0-9a-f]{12}$/);
    expect(out.title).toBe('Marketing');
    expect(out.status).toBe('active');
  });

  it('forge_ops_tag refuses without descriptor', async () => {
    await expect(forgeOpsTagHandler({ title: 'x' }, {})).rejects.toThrow(/descriptor.*required/i);
  });

  it('bind_to_ops_tag attaches a committed-reality member', async () => {
    const tag = await forgeOpsTagHandler({ title: 't', descriptor: 'd' }, {});
    const bound = await bindToOpsTagHandler(
      {
        tag_ref: tag.tag_ref,
        member_kind: 'bot',
        member_ref: 'deploy_xyz',
      },
      {},
    );
    expect(bound.ok).toBe(true);
    expect(bound.member_kind).toBe('bot');
    expect(bound.member_ref).toBe('deploy_xyz');
  });

  it('bind_to_ops_tag refuses pre-reality kinds (plan, research)', async () => {
    const tag = await forgeOpsTagHandler({ title: 't', descriptor: 'd' }, {});
    await expect(
      bindToOpsTagHandler(
        { tag_ref: tag.tag_ref, member_kind: 'plan', member_ref: 'plan_x' },
        {},
      ),
    ).rejects.toThrow(/memberKind must be one of/);
  });

  it('get_ops_tag returns the bounded read with descriptor + members + counts', async () => {
    const tag = await forgeOpsTagHandler(
      { title: 'Marketing', descriptor: 'Outbound nurture.' },
      {},
    );
    await bindToOpsTagHandler(
      { tag_ref: tag.tag_ref, member_kind: 'bot', member_ref: 'd_1' },
      {},
    );
    await bindToOpsTagHandler(
      { tag_ref: tag.tag_ref, member_kind: 'cook', member_ref: 'c_1' },
      {},
    );
    await bindToOpsTagHandler(
      { tag_ref: tag.tag_ref, member_kind: 'cook', member_ref: 'c_2' },
      {},
    );

    const out = await getOpsTagHandler({ tag_ref: tag.tag_ref }, {});
    expect(out.tag_ref).toBe(tag.tag_ref);
    expect(out.descriptor).toMatch(/Outbound nurture/);
    expect(out.member_counts).toEqual({ bot: 1, cook: 2 });
    expect(out.members).toHaveLength(3);
  });

  it('get_ops_tag throws for unknown ref', async () => {
    await expect(
      getOpsTagHandler({ tag_ref: 'ops_does_not_exi' }, {}),
    ).rejects.toThrow(/not found/);
  });

  it('list_ops_tags returns inbox shape with member counts and totals', async () => {
    const a = await forgeOpsTagHandler({ title: 'A', descriptor: 'a' }, {});
    const b = await forgeOpsTagHandler({ title: 'B', descriptor: 'b' }, {});
    await bindToOpsTagHandler(
      { tag_ref: a.tag_ref, member_kind: 'bot', member_ref: 'd1' },
      {},
    );
    await bindToOpsTagHandler(
      { tag_ref: a.tag_ref, member_kind: 'app', member_ref: 'a1' },
      {},
    );

    const out = await listOpsTagsHandler({}, {});
    expect(out.total).toBe(2);
    const aSummary = out.tags.find((t) => t.tag_ref === a.tag_ref);
    expect(aSummary.member_total).toBe(2);
    expect(aSummary.member_counts).toEqual({ bot: 1, app: 1 });
    const bSummary = out.tags.find((t) => t.tag_ref === b.tag_ref);
    expect(bSummary.member_total).toBe(0);
  });

  it('list_ops_tags filters by status', async () => {
    const a = await forgeOpsTagHandler({ title: 'A', descriptor: 'a' }, {});
    await forgeOpsTagHandler({ title: 'B', descriptor: 'b' }, {});
    await reviseOpsTagHandler({ tag_ref: a.tag_ref, status: 'archived' }, {});

    const active = await listOpsTagsHandler({ status: 'active' }, {});
    expect(active.total).toBe(1);
    expect(active.tags[0].title).toBe('B');

    const archived = await listOpsTagsHandler({ status: 'archived' }, {});
    expect(archived.total).toBe(1);
    expect(archived.tags[0].title).toBe('A');
  });

  it('revise_ops_tag patches descriptor (the rubric-sharpening move)', async () => {
    const tag = await forgeOpsTagHandler({ title: 't', descriptor: 'vague' }, {});
    const revised = await reviseOpsTagHandler(
      { tag_ref: tag.tag_ref, descriptor: 'sharper rubric' },
      {},
    );
    expect(revised.tag_ref).toBe(tag.tag_ref);
    const full = await getOpsTagHandler({ tag_ref: tag.tag_ref }, {});
    expect(full.descriptor).toBe('sharper rubric');
  });

  it('unbind_from_ops_tag is idempotent and reports the removed flag', async () => {
    const tag = await forgeOpsTagHandler({ title: 't', descriptor: 'd' }, {});
    await bindToOpsTagHandler(
      { tag_ref: tag.tag_ref, member_kind: 'bot', member_ref: 'd1' },
      {},
    );
    const first = await unbindFromOpsTagHandler(
      { tag_ref: tag.tag_ref, member_kind: 'bot', member_ref: 'd1' },
      {},
    );
    expect(first.ok).toBe(true);
    expect(first.removed).toBe(true);

    const again = await unbindFromOpsTagHandler(
      { tag_ref: tag.tag_ref, member_kind: 'bot', member_ref: 'd1' },
      {},
    );
    expect(again.ok).toBe(true);
    expect(again.removed).toBe(false);
  });

  it('MEMBER_KIND_ENUM matches the v0 committed-reality list', () => {
    expect(_internals.MEMBER_KIND_ENUM).toEqual([
      'bot',
      'app',
      'mcp_orbit',
      'cook',
      'catalyst',
      'trigger',
      'stash',
    ]);
  });
});
