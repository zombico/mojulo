// compile_plan tells a tier-routing host (capabilities.modelTiers) what a plan saves: its steps by tier, all run by
// execute_plan with no model. Any other host's compile answer is unchanged.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { ensureToolsRegistered, invokeRegisteredTool } from '../server.js';
import { rememberClientInfo } from '../client-bindings.js';
import { tierCounts } from '../tool-tiers.js';

beforeAll(async () => {
  await ensureToolsRegistered();
  rememberClientInfo('tiers-claude', { name: 'claude-code', version: 'x' });
  rememberClientInfo('tiers-codex', { name: 'codex', version: 'x' });
}, 120_000);

const manifest = [
  { tool: 'create_view', args: { kind: 'mechanics', title: 'throw', params: { scenario: 'projectile', v0: 18, angle: 45 } } },
  { tool: 'measure_view', args: { ref: { $step: 0, path: '/ref' } } },
  { tool: 'list_stashes', args: {} },
];

async function compileAs(session) {
  const ctx = { userId: 'local', mcpSessionId: session };
  const { plan_ref } = await invokeRegisteredTool('forge_plan', { title: 't', goal: 'g', manifest }, ctx);
  return invokeRegisteredTool('compile_plan', { plan_ref }, ctx);
}

describe('compile_plan and tiers', () => {
  it('counts steps by tier, lightest first, and names untiered tools', () => {
    expect(tierCounts(['create_view', 'measure_view', 'list_plans', 'design_game'])).toEqual({ ride: 2, fill: 1, design: 1 });
    expect(tierCounts(['create_character'])).toEqual({ judge: 1 });
    expect(tierCounts(['not_a_listed_tool'])).toEqual({ untiered: 1 });
  });

  it('a Claude host learns the steps by tier and that execution needs no model', async () => {
    const res = await compileAs('tiers-claude');
    expect(res.compiled, JSON.stringify(res)).toBe(true);
    expect(res.tiers).toEqual({ ride: 2, fill: 1 });
    expect(res.message).toMatch(/Steps by tier: 2 ride, 1 fill; execute_plan runs every one with no model/);
  }, 120_000);

  it('another host gets the compile answer it always had', async () => {
    const res = await compileAs('tiers-codex');
    expect(res.compiled).toBe(true);
    expect(res).not.toHaveProperty('tiers');
    expect(res.message).not.toMatch(/tier/);
  }, 120_000);
});
