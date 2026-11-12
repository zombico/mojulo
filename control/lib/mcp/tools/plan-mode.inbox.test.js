// The plan inbox is get_plan with no plan_ref (list_plans, its folded name, answers the same).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { forgePlanHandler, getPlanHandler, listPlansHandler } from './plan-mode.js';

beforeEach(() => closeDb());

describe('get_plan — one plan, or the inbox', () => {
  it('with no plan_ref lists the plans, by status, and marks nothing read', async () => {
    const a = await forgePlanHandler({ title: 'first', goal: 'a goal' });
    await forgePlanHandler({ title: 'second', goal: 'another' });
    const inbox = await getPlanHandler({});
    expect(inbox).toEqual(await listPlansHandler({}));
    expect(inbox.total).toBe(2);
    expect(inbox.plans.every((p) => p.seen === false)).toBe(true);
    expect((await getPlanHandler({ status: 'executed' })).total).toBe(0);
    expect((await getPlanHandler()).total).toBe(2);

    const one = await getPlanHandler({ plan_ref: a.plan_ref });
    expect(one.plan_ref).toBe(a.plan_ref);
    expect((await getPlanHandler({})).plans.find((p) => p.plan_ref === a.plan_ref).seen).toBe(true);
  });

  it('refuses a plan_ref that is not a ref, and one that is not there', async () => {
    await expect(getPlanHandler({ plan_ref: 7 })).rejects.toThrow(/omit it for the inbox/);
    await expect(getPlanHandler({ plan_ref: 'plan_nope' })).rejects.toThrow(/not found/);
  });
});
