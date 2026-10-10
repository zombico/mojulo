// A plan whose later steps take an earlier step's result: forge → compile → execute through the real registry.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { ensureToolsRegistered, invokeRegisteredTool } from '../server.js';

const ctx = { userId: 'local', mcpSessionId: 'test' };
const call = (name, args) => invokeRegisteredTool(name, args, ctx);

beforeAll(async () => { await ensureToolsRegistered(); }, 120_000);

describe('plan step references', () => {
  it('a mint feeds a measure, and the log records the value taken', async () => {
    const { plan_ref } = await call('forge_plan', { title: 'chain', goal: 'mint then measure', manifest: [
      { tool: 'create_view', args: { kind: 'mechanics', title: 'throw', params: { scenario: 'projectile', v0: 18, angle: 45 } } },
      { tool: 'measure_view', args: { ref: { $step: 0, path: '/ref' } } },
    ] });
    expect((await call('compile_plan', { plan_ref })).status).toBe('actionable');
    const run = await call('execute_plan', { plan_ref, confirm: true });
    expect(run.status).toBe('executed');
    expect(run.execution_log[1].refs['/ref']).toMatch(/^sk_/);
  }, 120_000);

  it('compile refuses a reference forward', async () => {
    const { plan_ref } = await call('forge_plan', { title: 'bad', goal: 'forward ref', manifest: [
      { tool: 'measure_view', args: { ref: { $step: 1, path: '/ref' } } },
      { tool: 'create_view', args: { kind: 'mechanics', params: { scenario: 'projectile' } } },
    ] });
    const res = await call('compile_plan', { plan_ref }).catch((e) => ({ error: e.message }));
    expect(JSON.stringify(res)).toMatch(/first step has none/);
  }, 120_000);

  it('execution stops at a pointer that finds nothing', async () => {
    const { plan_ref } = await call('forge_plan', { title: 'miss', goal: 'bad pointer', manifest: [
      { tool: 'create_view', args: { kind: 'mechanics', params: { scenario: 'projectile' } } },
      { tool: 'measure_view', args: { ref: { $step: 0, path: '/sketch_ref' } } },
    ] });
    await call('compile_plan', { plan_ref });
    const run = await call('execute_plan', { plan_ref, confirm: true });
    expect(run.status).toBe('failed');
    expect(run.execution_log[1].error).toMatch(/nothing at '\/sketch_ref'/);
  }, 120_000);
});
