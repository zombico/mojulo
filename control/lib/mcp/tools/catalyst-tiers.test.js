// A catalyst carries the tier of the work it runs, and a routing card the tier of its entry tool. Both reach only a host
// that routes light work to a lighter model (capabilities.modelTiers); every other host's answer is unchanged.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll } from 'vitest';
import { ensureToolsRegistered, invokeRegisteredTool } from '../server.js';
import { rememberClientInfo } from '../client-bindings.js';
import { getCatalystCatalog, validateCatalystMeta, serializeCatalystFile } from '../catalysts/loader.js';
import { TIERS } from '../../agent-tasks/tiers.js';

const claude = { userId: 'local', mcpSessionId: 'cat-tiers-claude' };
const codex = { userId: 'local', mcpSessionId: 'cat-tiers-codex' };

beforeAll(async () => {
  await ensureToolsRegistered();
  rememberClientInfo(claude.mcpSessionId, { name: 'claude-code', version: 'x' });
  rememberClientInfo(codex.mcpSessionId, { name: 'codex', version: 'x' });
}, 120_000);

const meta = { id: 'x', name: 'X', summary: 's', valueHook: 'v' };

describe('the catalyst tier', () => {
  it('every curated catalyst names one', () => {
    const missing = [...getCatalystCatalog().values()].filter((c) => !TIERS.includes(c.tier)).map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('is optional for a minted catalyst, refused when unknown, and round-trips to the shelf file', () => {
    expect(validateCatalystMeta(meta, 'body').tier).toBeNull();
    expect(() => validateCatalystMeta({ ...meta, tier: 'cheap' }, 'body')).toThrow(/invalid 'tier' value 'cheap'/);
    const c = validateCatalystMeta({ ...meta, tier: 'Judge' }, 'body');
    expect(c.tier).toBe('judge');
    expect(serializeCatalystFile(c)).toMatch(/"tier": "judge"/);
  });

  it('the new world-building catalysts sit where their work does', () => {
    const cat = getCatalystCatalog();
    expect(cat.get('design-tech-family').tier).toBe('design');
    expect(cat.get('populate-world-gear').tier).toBe('fill');
  });
});

describe('who sees it', () => {
  it('a Claude host reads the tier from list_catalysts, get_catalyst and recommend_catalysts', async () => {
    const list = await invokeRegisteredTool('list_catalysts', {}, claude);
    expect(list.catalysts.find((c) => c.id === 'print-object').tier).toBe('ride');
    const one = await invokeRegisteredTool('get_catalyst', { id: 'design-tech-family' }, claude);
    expect(one.tier).toBe('design');
    const rec = await invokeRegisteredTool('recommend_catalysts', {}, claude);
    expect(rec.applicable.find((c) => c.id === 'populate-world-gear').tier).toBe('fill');
  }, 120_000);

  it('another host gets the catalyst answers it always had', async () => {
    const list = await invokeRegisteredTool('list_catalysts', {}, codex);
    expect(list.catalysts.filter((c) => 'tier' in c)).toEqual([]);
    const one = await invokeRegisteredTool('get_catalyst', { id: 'design-tech-family' }, codex);
    expect(one).not.toHaveProperty('tier');
    const rec = await invokeRegisteredTool('recommend_catalysts', {}, codex);
    expect(rec.applicable.filter((c) => 'tier' in c)).toEqual([]);
  }, 120_000);

  it('a routing card found by semantic_search carries its tier for a Claude host only', async () => {
    const asClaude = await invokeRegisteredTool('semantic_search', { query: 'a city with districts and transit', kinds: ['routing'] }, claude);
    const asCodex = await invokeRegisteredTool('semantic_search', { query: 'a city with districts and transit', kinds: ['routing'] }, codex);
    expect(asClaude.results.length).toBeGreaterThan(0);
    for (const r of asClaude.results) expect(r.tier === undefined || TIERS.includes(r.tier)).toBe(true);
    expect(asClaude.results.some((r) => r.tier)).toBe(true);
    expect(asCodex.results.filter((r) => 'tier' in r)).toEqual([]);
  }, 120_000);
});
