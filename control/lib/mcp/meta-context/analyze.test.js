// In-memory SQLite isolation — must precede any db/index.js import.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import { InventoryRepository } from '@/lib/db/repositories/mcp-inventory';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import { MetaNodeRepository, MetaEdgeRepository } from '@/lib/db/repositories/meta-context';
import { canonicalizeServerName } from '@/lib/mcp/providers/canonicalize';
import {
  analyze,
  analyzeStaleBindings,
  STALE_CAPABILITY_SECONDS,
  STALE_INVENTORY_SECONDS,
} from './analyze.js';

beforeEach(() => {
  closeDb();
});

// Seed a `binds` edge: artifact node —binds→ mcp_tool node, mirroring what
// commitArtifactMaterialization writes. Returns nothing; the graph is the
// side effect the lens reads.
function seedBinding({ artifactRef, artifactLabel = 'Svc', toolRef, fieldsBound = null }) {
  const art = MetaNodeRepository.upsert({ kind: 'artifact', ref: artifactRef, label: artifactLabel });
  const tool = MetaNodeRepository.upsert({ kind: 'mcp_tool', ref: toolRef, label: toolRef });
  MetaEdgeRepository.upsert({
    src_id: art.id,
    dst_id: tool.id,
    kind: 'binds',
    payload: fieldsBound ? { fields_bound: fieldsBound } : null,
  });
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

describe('analyzeStaleBindings', () => {
  it('empty inventory → every binding is unknown, never a false missing, plus a re-declare nudge', () => {
    seedBinding({ artifactRef: 'cc:a', toolRef: 'gmail.send_message' });
    const out = analyzeStaleBindings();
    expect(out.inventory.empty).toBe(true);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].severity).toBe('unknown');
    expect(out.summary.bySeverity.missing).toBe(0);
    expect(out.nudges.join(' ')).toMatch(/declare_inventory/);
  });

  it('missing tool → severity missing with a re-research recommendation', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    seedBinding({ artifactRef: 'cc:a', toolRef: 'hubspot.create_contact' });
    const out = analyzeStaleBindings();
    expect(out.findings[0].severity).toBe('missing');
    expect(out.findings[0].toolRef).toBe('hubspot.create_contact');
    expect(out.findings[0].recommendation).toMatch(/research-mcp-vendor/);
    expect(out.summary.providersToRefresh).toContain(canonicalizeServerName('hubspot'));
  });

  it('present tool with no capability row → no-capability', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    seedBinding({ artifactRef: 'cc:a', toolRef: 'gmail.send_message' });
    const out = analyzeStaleBindings();
    expect(out.findings[0].severity).toBe('no-capability');
  });

  it('present tool with fresh capability → ok', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    CapabilitiesRepository.insert({
      providerRef: canonicalizeServerName('gmail'),
      bodyMd: '# gmail',
      sourceUrls: ['https://developers.google.com/gmail'],
      discoveredAt: nowSeconds(),
    });
    seedBinding({ artifactRef: 'cc:a', toolRef: 'gmail.send_message' });
    const out = analyzeStaleBindings();
    expect(out.findings[0].severity).toBe('ok');
    expect(out.summary.artifactsAffected).toBe(0);
  });

  it('present tool with aged capability → stale-capability', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    CapabilitiesRepository.insert({
      providerRef: canonicalizeServerName('gmail'),
      bodyMd: '# gmail',
      sourceUrls: ['https://developers.google.com/gmail'],
      discoveredAt: nowSeconds() - STALE_CAPABILITY_SECONDS - 86400,
    });
    seedBinding({ artifactRef: 'cc:a', toolRef: 'gmail.send_message' });
    const out = analyzeStaleBindings();
    expect(out.findings[0].severity).toBe('stale-capability');
    expect(out.findings[0].capabilityAgeSeconds).toBeGreaterThan(STALE_CAPABILITY_SECONDS);
  });

  it('stale inventory snapshot → still classifies, flags inventory.stale + nudge', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    // Backdate the declaration past the staleness window.
    getDb()
      .prepare('UPDATE meta_mcp_inventory SET declared_at = ?')
      .run(nowSeconds() - STALE_INVENTORY_SECONDS - 86400);
    seedBinding({ artifactRef: 'cc:a', toolRef: 'gmail.send_message' });
    const out = analyzeStaleBindings();
    expect(out.inventory.stale).toBe(true);
    expect(out.findings[0].severity).not.toBe('unknown'); // still judged
    expect(out.nudges.join(' ')).toMatch(/Re-declare inventory/);
  });

  it('ranks missing before stale-capability before ok', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
      { name: 'drive', tools: [{ name: 'list_files' }] },
    ]);
    CapabilitiesRepository.insert({
      providerRef: canonicalizeServerName('gmail'),
      bodyMd: '# gmail',
      sourceUrls: ['https://x'],
      discoveredAt: nowSeconds(),
    });
    CapabilitiesRepository.insert({
      providerRef: canonicalizeServerName('drive'),
      bodyMd: '# drive',
      sourceUrls: ['https://x'],
      discoveredAt: nowSeconds() - STALE_CAPABILITY_SECONDS - 86400,
    });
    seedBinding({ artifactRef: 'cc:a', toolRef: 'gmail.send_message' }); // ok
    seedBinding({ artifactRef: 'cc:a', toolRef: 'drive.list_files' }); // stale-capability
    seedBinding({ artifactRef: 'cc:a', toolRef: 'notion.query' }); // missing
    const out = analyzeStaleBindings();
    expect(out.findings.map((f) => f.severity)).toEqual([
      'missing',
      'stale-capability',
      'ok',
    ]);
  });
});

describe('analyze dispatcher', () => {
  it('rejects an unknown lens', () => {
    expect(() => analyze({ scope: { kind: 'fleet' }, lens: 'nope' })).toThrow(/lens must be/);
  });

  it('rejects an unsupported scope kind', () => {
    expect(() => analyze({ scope: { kind: 'operator' }, lens: 'stale-bindings' })).toThrow(
      /not supported/,
    );
  });

  it('artifact scope filters to one service', () => {
    InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send_message' }] },
    ]);
    seedBinding({ artifactRef: 'cc:a', toolRef: 'notion.query' });
    seedBinding({ artifactRef: 'cc:b', toolRef: 'linear.create_issue' });
    const out = analyze({ scope: { kind: 'artifact', ref: 'cc:a' }, lens: 'stale-bindings' });
    expect(out.scope).toEqual({ kind: 'artifact', ref: 'cc:a' });
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0].artifactRef).toBe('cc:a');
  });

  it('artifact scope with no such node → meta.empty, no throw', () => {
    const out = analyze({ scope: { kind: 'artifact', ref: 'cc:ghost' }, lens: 'stale-bindings' });
    expect(out.meta.empty).toBe(true);
    expect(out.findings).toHaveLength(0);
  });
});
