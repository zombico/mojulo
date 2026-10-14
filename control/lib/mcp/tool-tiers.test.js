// Every listed tool has a tier (or waits in TIER_DEFERRED), and only a host that declares
// `capabilities.modelTiers` sees it in tools/list.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { TOOL_LINES } from '@/lib/mcp/tool-lines';
import { TOOL_TIERS, TIER_DEFERRED, toolTier, routingCardTier, ceilingTier } from '@/lib/mcp/tool-tiers';
import { TIERS } from '@/lib/agent-tasks/tiers';
import { ensureToolsRegistered, listTools } from '@/lib/mcp/server';
import { PACKS } from '@/lib/mcp/packs';
import { getRoutingCardCatalog } from '@/lib/mcp/routing-cards/loader';

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

  it('a door is as heavy as the heaviest tool behind it', () => {
    expect(ceilingTier(['ride', 'judge', 'fill'])).toBe('judge');
    expect(ceilingTier([undefined, 'nonsense'])).toBeUndefined();
    const world = PACKS.find((p) => p.id === 'pack_world');
    expect(toolTier('pack_world')).toBe(ceilingTier(world.members.map((m) => TOOL_TIERS[m])));
    // the Characters pack authors and revises: as heavy as its members
    expect(toolTier('pack_character')).toBe('judge');
  });

  it('compose_world is judge: it authors a city plan and a machine for the crafter, not only a settled world', () => {
    expect(TOOL_TIERS.compose_world).toBe('judge');
  });
});

describe('the listed surface, not only the tool lines', () => {
  beforeAll(async () => {
    await ensureToolsRegistered();
  }, 120_000);

  // A tool listed in either mode (flat, or packs: the default for a host that loads every schema) has a tier, or it
  // and every tool behind it wait in TIER_DEFERRED.
  it('every tool listed flat or in packs mode has a tier, or waits by name', () => {
    const prev = process.env.MOJULO_TOOL_PACKS;
    const names = new Set();
    try {
      for (const mode of ['off', 'on']) {
        process.env.MOJULO_TOOL_PACKS = mode;
        for (const t of listTools()) names.add(t.name);
      }
    } finally {
      if (prev === undefined) delete process.env.MOJULO_TOOL_PACKS;
      else process.env.MOJULO_TOOL_PACKS = prev;
    }
    const waits = (n) => TIER_DEFERRED.includes(n) || PACKS.find((p) => p.id === n)?.members.every((m) => TIER_DEFERRED.includes(m));
    expect([...names].filter((n) => !toolTier(n) && !waits(n))).toEqual([]);
  });
});

describe('routing cards', () => {
  it('every card resolves to a tier, unless its entry tool waits', () => {
    const untiered = [...getRoutingCardCatalog().values()].filter((c) => !routingCardTier(c) && !TIER_DEFERRED.includes(c.entry));
    expect(untiered.map((c) => c.id)).toEqual([]);
  });

  it("a card's own tier wins over its entry tool's", () => {
    expect(routingCardTier({ entry: 'mint_solid' })).toBe('judge');
    expect(routingCardTier({ entry: 'mint_solid', tier: 'fill' })).toBe('fill');
  });
});

describe('tools/list', () => {
  beforeAll(async () => {
    await ensureToolsRegistered();
  }, 120_000);

  const tierOf = (tools, name) => tools.find((t) => t.name === name)?._meta?.['mojulo/tier'];

  it('a Claude host sees each tool tier as _meta', () => {
    const tools = listTools({ clientInfo: { name: 'claude-code', version: 'x' } });
    expect(tierOf(tools, 'get_tool_index')).toBe('ride');
    expect(tierOf(tools, 'create_view')).toBe('fill');
    expect(tierOf(tools, 'compose_world')).toBe('judge');
    expect(tierOf(tools, 'create_sketch')).toBe('judge');
    expect(tierOf(tools, 'design_game')).toBe('design');
    expect(tierOf(tools, 'create_character')).toBe('judge');
  });

  it('any other host, or none, gets no tier at all', () => {
    for (const clientInfo of [{ name: 'codex' }, { name: 'some-new-host' }, undefined]) {
      const tools = listTools({ clientInfo });
      expect(tools.filter((t) => t._meta?.['mojulo/tier'])).toEqual([]);
    }
  });
});
