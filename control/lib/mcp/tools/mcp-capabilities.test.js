// Isolate this test file to an in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';
// Short-circuit the semantic-index sidecar — this suite covers
// capabilities tool behavior, not embedding indexing. Without the flag
// every recordCapabilitiesHandler call would await the ONNX model.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import {
  seedMcpCapabilities,
  _resetSeededForTests as _resetCapabilitiesSeedForTests,
  _internals as seedInternals,
} from '@/lib/mcp/seeds/mcp-capabilities-seed';
import { _resetSeededForTests as _resetComponentsSeedForTests, seedComponents } from '@/lib/mcp/mcp-orbit-components/loader';
import { commitOperatorKyc } from './meta-context.js';
import { recommendCompositionsHandler } from './mcp-orbit.js';
import {
  recordCapabilitiesHandler,
  getCapabilitiesHandler,
  _internals,
} from './mcp-capabilities.js';

beforeEach(() => {
  closeDb();
});

describe('recordCapabilitiesHandler: input validation', () => {
  it('throws when input is not an object', async () => {
    getDb();
    await expect(recordCapabilitiesHandler(null)).rejects.toThrow(/object input/);
    await expect(recordCapabilitiesHandler('x')).rejects.toThrow(/object input/);
  });

  it('throws when provider_ref is missing', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ body_md: 'body' })
    ).rejects.toThrow(/provider_ref/);
  });

  it('throws when provider_ref is empty / whitespace', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ provider_ref: '   ', body_md: 'body' })
    ).rejects.toThrow(/provider_ref/);
  });

  it('throws when body_md is missing', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ provider_ref: 'gmail' })
    ).rejects.toThrow(/body_md/);
  });

  it('throws when body_md is empty', async () => {
    getDb();
    await expect(
      recordCapabilitiesHandler({ provider_ref: 'gmail', body_md: '   ' })
    ).rejects.toThrow(/body_md/);
  });
});

describe('recordCapabilitiesHandler: happy path', () => {
  it('inserts a first capability row and returns the rich response shape', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      display_name: 'Gmail',
      version_tag: 'API v1',
      body_md: 'gmail vendor body',
      source_urls: ['https://developers.google.com/gmail'],
    });
    expect(res.ok).toBe(true);
    expect(res.providerRef).toBe('gmail');
    expect(res.versionTag).toBe('API v1');
    expect(res.supersededId).toBe(null);
    expect(res.provenance).toBe('research');
    expect(typeof res.id).toBe('number');
    expect(typeof res.providerId).toBe('number');
    expect(typeof res.discoveredAt).toBe('number');
  });

  it('trims provider_ref whitespace before writing', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: '  notion  ',
      body_md: 'body',
    });
    expect(res.providerRef).toBe('notion');
  });

  it('supersedes the prior current row on second write', async () => {
    getDb();
    const first = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'v1',
    });
    const second = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'v2',
      version_tag: 'v2',
    });
    expect(second.supersededId).toBe(first.id);
    // Repo confirms current row flipped.
    const current = CapabilitiesRepository.getCurrent('gmail');
    expect(current.id).toBe(second.id);
    expect(current.bodyMd).toBe('v2');
  });

  it('reports provenance="seed" when source_urls[0] starts with mojulo://', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'body',
      source_urls: ['mojulo://CHANGELOG#v0.5.0'],
    });
    expect(res.provenance).toBe('seed');
  });

  it('surfaces no_operator_anchor warning when no KYC has been committed', async () => {
    getDb();
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'body',
    });
    expect(res.warnings).toEqual(['no_operator_anchor']);
  });

  it('omits warnings field when an operator anchor exists', async () => {
    getDb();
    await commitOperatorKyc({
      role: 'test operator',
      constraints: ['test constraint'],
    });
    const res = await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      body_md: 'body',
    });
    expect(res.warnings).toBeUndefined();
  });
});

describe('getCapabilitiesHandler: input validation', () => {
  it('throws when input is not an object', async () => {
    getDb();
    await expect(getCapabilitiesHandler(null)).rejects.toThrow(/object input/);
  });

  it('throws when provider_ref is missing', async () => {
    getDb();
    await expect(getCapabilitiesHandler({})).rejects.toThrow(/provider_ref/);
  });

  it('throws when provider_ref is empty', async () => {
    getDb();
    await expect(getCapabilitiesHandler({ provider_ref: '' })).rejects.toThrow(/provider_ref/);
  });

  it('throws when asOf is provided but not parseable as ISO 8601', async () => {
    getDb();
    await expect(
      getCapabilitiesHandler({ provider_ref: 'gmail', asOf: 'not-a-date' })
    ).rejects.toThrow(/asOf/);
  });
});

describe('getCapabilitiesHandler: not found', () => {
  it('returns found=false with a hint for unknown providers', async () => {
    getDb();
    const res = await getCapabilitiesHandler({ provider_ref: 'unknown' });
    expect(res.ok).toBe(true);
    expect(res.found).toBe(false);
    expect(res.providerRef).toBe('unknown');
    expect(res.hint).toMatch(/research-mcp-vendor/);
  });

  it('returns found=false when asOf precedes the first row', async () => {
    getDb();
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1',
      discoveredAt: 2000,
    });
    const res = await getCapabilitiesHandler({
      provider_ref: 'gmail',
      asOf: '1970-01-01T00:00:00Z',
    });
    expect(res.found).toBe(false);
  });
});

describe('getCapabilitiesHandler: found', () => {
  it('returns the current row when asOf is omitted', async () => {
    getDb();
    await recordCapabilitiesHandler({
      provider_ref: 'gmail',
      display_name: 'Gmail',
      version_tag: 'API v1',
      body_md: 'gmail body',
      source_urls: ['https://docs.example.com'],
    });
    const res = await getCapabilitiesHandler({ provider_ref: 'gmail' });
    expect(res.ok).toBe(true);
    expect(res.found).toBe(true);
    expect(res.providerRef).toBe('gmail');
    expect(res.versionTag).toBe('API v1');
    expect(res.bodyMd).toBe('gmail body');
    expect(res.sourceUrls).toEqual(['https://docs.example.com']);
    expect(res.supersededBy).toBe(null);
    expect(typeof res.id).toBe('number');
    expect(typeof res.providerId).toBe('number');
    expect(typeof res.discoveredAt).toBe('number');
  });

  it('walks the supersession chain via asOf', async () => {
    getDb();
    const v1 = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1',
      discoveredAt: 1000,
    });
    const v2 = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v2',
      discoveredAt: 2000,
    });
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v3',
      discoveredAt: 3000,
    });

    // At t=1500 (ISO), v1 was current.
    const at1500 = await getCapabilitiesHandler({
      provider_ref: 'gmail',
      asOf: new Date(1500 * 1000).toISOString(),
    });
    expect(at1500.id).toBe(v1.id);
    expect(at1500.bodyMd).toBe('v1');

    // At t=2500, v2 was current.
    const at2500 = await getCapabilitiesHandler({
      provider_ref: 'gmail',
      asOf: new Date(2500 * 1000).toISOString(),
    });
    expect(at2500.id).toBe(v2.id);
  });

  it('trims provider_ref whitespace before lookup', async () => {
    getDb();
    await recordCapabilitiesHandler({ provider_ref: 'gmail', body_md: 'body' });
    const res = await getCapabilitiesHandler({ provider_ref: '  gmail  ' });
    expect(res.found).toBe(true);
  });
});

describe('_internals.parseIsoToUnixSeconds', () => {
  it('parses a valid ISO 8601 string', () => {
    expect(_internals.parseIsoToUnixSeconds('2026-05-25T00:00:00Z')).toBe(
      Math.floor(Date.parse('2026-05-25T00:00:00Z') / 1000)
    );
  });

  it('throws on empty string', () => {
    expect(() => _internals.parseIsoToUnixSeconds('')).toThrow(/non-empty ISO/);
  });

  it('throws on non-string input', () => {
    expect(() => _internals.parseIsoToUnixSeconds(null)).toThrow(/non-empty ISO/);
    expect(() => _internals.parseIsoToUnixSeconds(42)).toThrow(/non-empty ISO/);
  });

  it('throws on unparseable string', () => {
    expect(() => _internals.parseIsoToUnixSeconds('garbage')).toThrow(/not a valid/);
  });
});

// ---------------------------------------------------------------------------
// Decuration smoke: research catalyst supersedes seed end-to-end
//
// Exercises the full vertical from seed migration → tool surface → composer
// re-read. This is the integration check the plan calls for — verifies that
// the research-mcp-vendor catalyst's tool calls round-trip correctly, that
// supersession honestly flips a seed row to a research row, and that the
// composer immediately sees the updated provenance.
// ---------------------------------------------------------------------------

describe('decuration smoke: catalyst supersedes seed end-to-end', () => {
  beforeEach(() => {
    closeDb();
    _resetCapabilitiesSeedForTests();
    _resetComponentsSeedForTests();
    getDb();
    seedComponents({ force: true });
    seedMcpCapabilities({ force: true });
  });

  it('notion starts as a seed row with capabilities-only state', async () => {
    const res = await getCapabilitiesHandler({ provider_ref: 'notion' });
    expect(res.found).toBe(true);
    expect(res.versionTag).toBe('2025-09-03'); // from notion frontmatter
    expect(res.sourceUrls[0]).toBe(seedInternals.SOURCE_MOJULO_PREFIX);
    expect(res.discoveredAt).toBe(seedInternals.V0_5_0_RELEASE_UNIX);
    expect(res.supersededBy).toBe(null);

    // Consolidated view confirms the seed provenance.
    const view = CapabilitiesRepository.consolidatedView('notion');
    expect(view.capabilities.provenance).toBe('seed');
    expect(view.inventory).toBe(null);
  });

  it('record_mcp_capabilities supersedes the seed row and flips provenance to research', async () => {
    // Capture the seed row's id before superseding.
    const seedRow = CapabilitiesRepository.getCurrent('notion');
    expect(seedRow.supersededBy).toBe(null);

    // Simulate the research-mcp-vendor catalyst's effect: agent writes a
    // freshly-researched body with vendor URLs as the first source_urls
    // entry (no mojulo:// prefix).
    const recordRes = await recordCapabilitiesHandler({
      provider_ref: 'notion',
      display_name: 'Notion',
      version_tag: '2026-04-01',
      body_md: '# mcp: Notion\n\nFresh agent-researched body.\n\n<!-- sources\n- https://developers.notion.com/changelog\n-->',
      source_urls: ['https://developers.notion.com/changelog'],
    });

    expect(recordRes.ok).toBe(true);
    expect(recordRes.supersededId).toBe(seedRow.id);
    expect(recordRes.provenance).toBe('research');
    expect(recordRes.versionTag).toBe('2026-04-01');

    // get_mcp_capabilities now returns the fresh body.
    const current = await getCapabilitiesHandler({ provider_ref: 'notion' });
    expect(current.id).toBe(recordRes.id);
    expect(current.bodyMd).toMatch(/Fresh agent-researched body/);
    expect(current.versionTag).toBe('2026-04-01');
    expect(current.supersededBy).toBe(null);

    // Supersession invariant: the prior current row is no longer current —
    // its superseded_by points at the fresh row.
    const chain = CapabilitiesRepository.listForProvider('notion');
    expect(chain).toHaveLength(2);
    const oldRow = chain.find((r) => r.id === seedRow.id);
    expect(oldRow.supersededBy).toBe(recordRes.id);

    // Consolidated view confirms provenance flipped from seed → research.
    const view = CapabilitiesRepository.consolidatedView('notion');
    expect(view.capabilities.provenance).toBe('research');
  });

  it('asOf walks back to the seed row from before the supersession', async () => {
    const sentinel = seedInternals.V0_5_0_RELEASE_UNIX;

    await recordCapabilitiesHandler({
      provider_ref: 'notion',
      body_md: '# fresh',
      source_urls: ['https://example.com'],
    });

    // asOf=sentinel returns the seed (it was current then).
    const past = await getCapabilitiesHandler({
      provider_ref: 'notion',
      asOf: new Date(sentinel * 1000).toISOString(),
    });
    expect(past.found).toBe(true);
    expect(past.versionTag).toBe('2025-09-03');
    // The seed's superseded_by points forward to the research row.
    expect(past.supersededBy).not.toBe(null);

    // asOf=now returns the fresh row.
    const now = await getCapabilitiesHandler({
      provider_ref: 'notion',
      asOf: new Date().toISOString(),
    });
    expect(now.found).toBe(true);
    expect(now.bodyMd).toBe('# fresh');
  });

  it('the composer treats a research-superseded provider as research-grade (no seed warning)', async () => {
    // Declare inventory so notion is also installed; this puts the provider
    // in the 'seed' state initially (has both facets, capabilities is seed).
    InventoryRepository.replaceInventory([
      { name: 'claude_ai_Notion', tools: [{ name: 'notion-search' }] },
      { name: 'gmail', tools: [{ name: 'search_messages' }] },
    ]);
    await commitOperatorKyc({
      role: 'test operator',
      constraints: ['weekly digest cadence'],
    });

    // Before the catalyst runs: composer surfaces seed_capabilities:notion.
    const before = await recommendCompositionsHandler({
      intent: 'When a Gmail support thread arrives, file a Notion page with the thread context',
    });
    const beforeWarnings = before.candidates[0].constraintWarnings;
    expect(beforeWarnings.some((w) => w.startsWith('seed_capabilities:'))).toBe(true);
    expect(before.candidates[0].rationale.catalystHint).toMatch(/research-mcp-vendor/);

    // Run the catalyst's effect.
    await recordCapabilitiesHandler({
      provider_ref: 'notion',
      version_tag: 'research-2026',
      body_md: '# fresh notion body',
      source_urls: ['https://developers.notion.com'],
    });

    // After: composer no longer surfaces seed warning for notion.
    const after = await recommendCompositionsHandler({
      intent: 'When a Gmail support thread arrives, file a Notion page with the thread context',
    });
    const afterWarnings = after.candidates[0].constraintWarnings;
    expect(afterWarnings.some((w) => w === 'seed_capabilities:notion')).toBe(false);
  });

  it('seed migration is no-op on a second boot — never re-overwrites the research row', () => {
    // Research notion.
    CapabilitiesRepository.insert({
      providerRef: 'notion',
      bodyMd: '# research',
      sourceUrls: ['https://example.com'],
    });
    const researchRow = CapabilitiesRepository.getCurrent('notion');

    // Simulate a second-boot seed pass (force=true to bypass the in-process
    // _seeded flag).
    _resetCapabilitiesSeedForTests();
    const result = seedMcpCapabilities({ force: true });

    // Notion was skipped; the other three are also already in the table
    // from the first seedMcpCapabilities call in beforeEach. So inserted=0.
    expect(result.inserted).toBe(0);

    const current = CapabilitiesRepository.getCurrent('notion');
    expect(current.id).toBe(researchRow.id);
    expect(current.bodyMd).toBe('# research');
  });
});
