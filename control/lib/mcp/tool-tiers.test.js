// Every listed tool has a tier (or waits in TIER_DEFERRED), and only a host that declares
// `capabilities.modelTiers` sees it in tools/list.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { TOOL_LINES } from '@/lib/mcp/tool-lines';
import { TOOL_TIERS, TIER_DEFERRED } from '@/lib/mcp/tool-tiers';
import { TIERS } from '@/lib/agent-tasks/tiers';
import { ensureToolsRegistered, listTools } from '@/lib/mcp/server';

describe('the tier table', () => {
  it('gives every tool line a tier, or defers it by name', () => {
    const missing = Object.keys(TOOL_LINES).filter((n) => !(n in TOOL_TIERS) && !TIER_DEFERRED.includes(n));
    expect(missing).toEqual([]);
  });

  it('names only tools that have a line, and never tiers a deferred one', () => {
    expect(Object.keys(TOOL_TIERS).filter((n) => !(n in TOOL_LINES))).toEqual([]);
    expect(TIER_DEFERRED.filter((n) => n in TOOL_TIERS)).toEqual([]);
    expect(TIER_DEFERRED.filter((n) => !(n in TOOL_LINES))).toEqual([]);
  });

  it('uses only known tier names', () => {
    expect(Object.values(TOOL_TIERS).filter((t) => !TIERS.includes(t))).toEqual([]);
  });
});

describe('tools/list', () => {
  beforeAll(async () => {
    await ensureToolsRegistered();
  });

  const tierOf = (tools, name) => tools.find((t) => t.name === name)?._meta?.['mojulo/tier'];

  it('a Claude host sees each tool tier as _meta', () => {
    const tools = listTools({ clientInfo: { name: 'claude-code', version: 'x' } });
    expect(tierOf(tools, 'get_tool_index')).toBe('ride');
    expect(tierOf(tools, 'compose_world')).toBe('fill');
    expect(tierOf(tools, 'create_sketch')).toBe('judge');
    expect(tierOf(tools, 'design_game')).toBe('design');
    expect(tierOf(tools, 'create_character')).toBeUndefined();
  });

  it('any other host, or none, gets no tier at all', () => {
    for (const clientInfo of [{ name: 'codex' }, { name: 'some-new-host' }, undefined]) {
      const tools = listTools({ clientInfo });
      expect(tools.filter((t) => t._meta?.['mojulo/tier'])).toEqual([]);
    }
  });
});
