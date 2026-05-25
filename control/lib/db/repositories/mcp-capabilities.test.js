process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import { CapabilitiesRepository, _internals } from './mcp-capabilities.js';
import { ProvidersRepository } from './mcp-providers.js';

beforeEach(() => {
  closeDb();
});

// Helper: seed an inventory row directly (bypassing InventoryRepository which
// gets its provider_id wiring in a later phase).
function seedInventoryRow(db, { server, providerId, toolName, description = null }) {
  db.prepare(
    `INSERT INTO meta_mcp_inventory (server, tool_name, tool_ref, description, declared_at, provider_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(server, toolName, `${server}.${toolName}`, description, Math.floor(Date.now() / 1000), providerId);
}

describe('schema bootstraps', () => {
  it('creates meta_mcp_capabilities on first getDb()', () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'meta_mcp_capabilities'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('creates the unique partial index on (provider_id) WHERE superseded_by IS NULL', () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name = 'idx_meta_mcp_capabilities_current'"
      )
      .all();
    expect(indexes).toHaveLength(1);
    expect(indexes[0].sql).toMatch(/superseded_by\s+IS\s+NULL/i);
  });

  it('FK to providers cascades on delete', () => {
    const db = getDb();
    const provider = ProvidersRepository.upsertByRef('gmail');
    CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'body' });
    expect(CapabilitiesRepository.getCurrent('gmail')).not.toBe(null);
    db.prepare('DELETE FROM meta_mcp_providers WHERE id = ?').run(provider.id);
    expect(CapabilitiesRepository.getCurrent('gmail')).toBe(null);
  });
});

describe('CapabilitiesRepository.insert: first row for a provider', () => {
  it('returns supersededId=null on first insert', () => {
    getDb();
    const result = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      displayName: 'Gmail',
      versionTag: 'v1',
      bodyMd: 'gmail body',
      sourceUrls: ['https://developers.google.com/gmail'],
    });
    expect(result.supersededId).toBe(null);
    expect(result.providerRef).toBe('gmail');
    expect(result.versionTag).toBe('v1');
    expect(typeof result.id).toBe('number');
    expect(typeof result.discoveredAt).toBe('number');
  });

  it('creates the provider row as a side effect', () => {
    getDb();
    expect(ProvidersRepository.getByRef('notion')).toBe(null);
    CapabilitiesRepository.insert({
      providerRef: 'notion',
      displayName: 'Notion',
      bodyMd: 'notion body',
    });
    const provider = ProvidersRepository.getByRef('notion');
    expect(provider).not.toBe(null);
    expect(provider.displayName).toBe('Notion');
  });

  it('returns provenance="research" by default', () => {
    getDb();
    const result = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'body',
      sourceUrls: ['https://example.com'],
    });
    expect(result.provenance).toBe('research');
  });

  it('returns provenance="seed" when sourceUrls[0] starts with mojulo://', () => {
    getDb();
    const result = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'body',
      sourceUrls: ['mojulo://CHANGELOG#v0.5.0', 'https://example.com'],
    });
    expect(result.provenance).toBe('seed');
  });

  it('uses provided discoveredAt sentinel (for seed migration)', () => {
    getDb();
    const sentinel = 1700000000;
    const result = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'body',
      discoveredAt: sentinel,
    });
    expect(result.discoveredAt).toBe(sentinel);
  });

  it('accepts null versionTag (when docs declare nothing)', () => {
    getDb();
    const result = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'body',
    });
    expect(result.versionTag).toBe(null);
  });

  it('treats whitespace-only versionTag as null', () => {
    getDb();
    const result = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'body',
      versionTag: '   ',
    });
    expect(result.versionTag).toBe(null);
  });
});

describe('CapabilitiesRepository.insert: supersession', () => {
  it('supersedes the prior current row on second insert', () => {
    getDb();
    const first = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1 body',
      versionTag: 'v1',
    });
    const second = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v2 body',
      versionTag: 'v2',
    });
    expect(second.supersededId).toBe(first.id);
    expect(second.id).not.toBe(first.id);

    const current = CapabilitiesRepository.getCurrent('gmail');
    expect(current.id).toBe(second.id);
    expect(current.bodyMd).toBe('v2 body');
    expect(current.supersededBy).toBe(null);
  });

  it('chains supersession across three writes', () => {
    getDb();
    const v1 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v1' });
    const v2 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v2' });
    const v3 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v3' });

    const all = CapabilitiesRepository.listForProvider('gmail');
    expect(all).toHaveLength(3);

    // v1 superseded by v2; v2 superseded by v3; v3 is current.
    const v1Row = all.find((r) => r.id === v1.id);
    const v2Row = all.find((r) => r.id === v2.id);
    const v3Row = all.find((r) => r.id === v3.id);
    expect(v1Row.supersededBy).toBe(v2.id);
    expect(v2Row.supersededBy).toBe(v3.id);
    expect(v3Row.supersededBy).toBe(null);
  });

  it('enforces the unique partial index (at most one current row per provider)', () => {
    const db = getDb();
    CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v1' });
    const providerId = ProvidersRepository.getByRef('gmail').id;
    // Attempting to insert a raw second NULL-superseded row should fail.
    expect(() => {
      db.prepare(
        `INSERT INTO meta_mcp_capabilities (provider_id, body_md, superseded_by)
         VALUES (?, ?, NULL)`
      ).run(providerId, 'rogue');
    }).toThrow(/UNIQUE/i);
  });

  it('supersession is isolated per provider', () => {
    getDb();
    const gmailV1 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'gmail v1' });
    const notionV1 = CapabilitiesRepository.insert({ providerRef: 'notion', bodyMd: 'notion v1' });
    const gmailV2 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'gmail v2' });

    // gmail supersession chain advanced
    const gmailCurrent = CapabilitiesRepository.getCurrent('gmail');
    expect(gmailCurrent.id).toBe(gmailV2.id);
    // notion is untouched
    const notionCurrent = CapabilitiesRepository.getCurrent('notion');
    expect(notionCurrent.id).toBe(notionV1.id);
    expect(notionCurrent.supersededBy).toBe(null);
  });
});

describe('CapabilitiesRepository.insert: validation', () => {
  it('throws on missing providerRef', () => {
    getDb();
    expect(() => CapabilitiesRepository.insert({ bodyMd: 'x' })).toThrow(/providerRef/);
  });

  it('throws on missing bodyMd', () => {
    getDb();
    expect(() => CapabilitiesRepository.insert({ providerRef: 'gmail' })).toThrow(/bodyMd/);
  });

  it('throws on empty bodyMd', () => {
    getDb();
    expect(() => CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: '' })).toThrow(/bodyMd/);
  });

  it('throws on non-string versionTag', () => {
    getDb();
    expect(() =>
      CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'x', versionTag: 42 })
    ).toThrow(/versionTag/);
  });

  it('throws on non-array sourceUrls', () => {
    getDb();
    expect(() =>
      CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'x', sourceUrls: 'http://x' })
    ).toThrow(/sourceUrls/);
  });

  it('throws on sourceUrls with non-string entries', () => {
    getDb();
    expect(() =>
      CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'x', sourceUrls: [42] })
    ).toThrow(/sourceUrls/);
  });

  it('throws on non-integer discoveredAt', () => {
    getDb();
    expect(() =>
      CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'x', discoveredAt: 1.5 })
    ).toThrow(/discoveredAt/);
  });
});

describe('CapabilitiesRepository.getCurrent', () => {
  it('returns null for unknown provider', () => {
    getDb();
    expect(CapabilitiesRepository.getCurrent('unknown')).toBe(null);
  });

  it('returns null for provider with no capabilities yet', () => {
    getDb();
    ProvidersRepository.upsertByRef('gmail');
    expect(CapabilitiesRepository.getCurrent('gmail')).toBe(null);
  });

  it('returns the most recent (current) row', () => {
    getDb();
    CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v1' });
    const v2 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v2' });
    const current = CapabilitiesRepository.getCurrent('gmail');
    expect(current.id).toBe(v2.id);
    expect(current.bodyMd).toBe('v2');
  });

  it('parses sourceUrls from JSON', () => {
    getDb();
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1',
      sourceUrls: ['https://a', 'https://b'],
    });
    const current = CapabilitiesRepository.getCurrent('gmail');
    expect(current.sourceUrls).toEqual(['https://a', 'https://b']);
  });
});

describe('CapabilitiesRepository.getAsOf', () => {
  it('returns null when no row exists at that time', () => {
    getDb();
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'v1',
      discoveredAt: 2000,
    });
    expect(CapabilitiesRepository.getAsOf('gmail', 1000)).toBe(null);
  });

  it('returns the row that was current at the queried time', () => {
    getDb();
    const v1 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v1', discoveredAt: 1000 });
    const v2 = CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v2', discoveredAt: 2000 });
    CapabilitiesRepository.insert({ providerRef: 'gmail', bodyMd: 'v3', discoveredAt: 3000 });

    // At t=1500, v1 was current
    expect(CapabilitiesRepository.getAsOf('gmail', 1500).id).toBe(v1.id);
    // At t=2500, v2 was current
    expect(CapabilitiesRepository.getAsOf('gmail', 2500).id).toBe(v2.id);
    // At t=4000, v3 is still current
    expect(CapabilitiesRepository.getAsOf('gmail', 4000).bodyMd).toBe('v3');
  });

  it('returns null for non-integer asOfUnix', () => {
    getDb();
    expect(CapabilitiesRepository.getAsOf('gmail', 1.5)).toBe(null);
  });
});

describe('CapabilitiesRepository.consolidatedView', () => {
  it('returns null for unknown provider', () => {
    getDb();
    expect(CapabilitiesRepository.consolidatedView('unknown')).toBe(null);
  });

  it('provider exists but neither facet (null inventory, null capabilities)', () => {
    getDb();
    ProvidersRepository.upsertByRef('gmail');
    const view = CapabilitiesRepository.consolidatedView('gmail');
    expect(view.providerRef).toBe('gmail');
    expect(view.inventory).toBe(null);
    expect(view.capabilities).toBe(null);
  });

  it('inventory-only view', () => {
    const db = getDb();
    const provider = ProvidersRepository.upsertByRef('gmail', { displayName: 'Gmail' });
    seedInventoryRow(db, {
      server: 'claude_ai_Gmail',
      providerId: provider.id,
      toolName: 'send_message',
      description: 'Send an email',
    });
    const view = CapabilitiesRepository.consolidatedView('gmail');
    expect(view.inventory).not.toBe(null);
    expect(view.inventory.installAliases).toEqual(['claude_ai_Gmail']);
    expect(view.inventory.tools).toHaveLength(1);
    expect(view.inventory.tools[0].name).toBe('send_message');
    expect(view.capabilities).toBe(null);
  });

  it('capabilities-only view (no inventory rows yet)', () => {
    getDb();
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      displayName: 'Gmail',
      bodyMd: 'gmail body',
      versionTag: 'v1',
      sourceUrls: ['https://example.com'],
    });
    const view = CapabilitiesRepository.consolidatedView('gmail');
    expect(view.inventory).toBe(null);
    expect(view.capabilities).not.toBe(null);
    expect(view.capabilities.bodyMd).toBe('gmail body');
    expect(view.capabilities.versionTag).toBe('v1');
    expect(view.capabilities.provenance).toBe('research');
  });

  it('full view: both facets present', () => {
    const db = getDb();
    CapabilitiesRepository.insert({
      providerRef: 'gmail',
      displayName: 'Gmail',
      bodyMd: 'gmail body',
      sourceUrls: ['mojulo://CHANGELOG#v0.5.0'],
    });
    const provider = ProvidersRepository.getByRef('gmail');
    seedInventoryRow(db, {
      server: 'claude_ai_Gmail',
      providerId: provider.id,
      toolName: 'send_message',
    });
    seedInventoryRow(db, {
      server: 'claude_ai_Gmail',
      providerId: provider.id,
      toolName: 'search_messages',
    });

    const view = CapabilitiesRepository.consolidatedView('gmail');
    expect(view.inventory.tools).toHaveLength(2);
    expect(view.capabilities.provenance).toBe('seed');
    expect(view.displayName).toBe('Gmail');
  });

  it('multiple install aliases collapse into one provider view', () => {
    const db = getDb();
    const provider = ProvidersRepository.upsertByRef('notion');
    seedInventoryRow(db, {
      server: 'claude_ai_Notion',
      providerId: provider.id,
      toolName: 'search',
    });
    seedInventoryRow(db, {
      server: 'notion-mcp-server',
      providerId: provider.id,
      toolName: 'fetch',
    });
    const view = CapabilitiesRepository.consolidatedView('notion');
    expect(view.inventory.installAliases.sort()).toEqual(
      ['claude_ai_Notion', 'notion-mcp-server'].sort()
    );
    expect(view.inventory.tools).toHaveLength(2);
  });
});

describe('_internals.capabilitiesProvenance', () => {
  it('returns "research" for null/undefined/empty', () => {
    expect(_internals.capabilitiesProvenance(null)).toBe('research');
    expect(_internals.capabilitiesProvenance(undefined)).toBe('research');
    expect(_internals.capabilitiesProvenance([])).toBe('research');
  });

  it('returns "seed" when first URL is mojulo://', () => {
    expect(_internals.capabilitiesProvenance(['mojulo://CHANGELOG#v0.5.0'])).toBe('seed');
    expect(_internals.capabilitiesProvenance(['mojulo://x', 'https://y'])).toBe('seed');
  });

  it('returns "research" when first URL is not mojulo://', () => {
    expect(_internals.capabilitiesProvenance(['https://example.com'])).toBe('research');
    expect(_internals.capabilitiesProvenance(['https://a', 'mojulo://b'])).toBe('research');
  });
});
