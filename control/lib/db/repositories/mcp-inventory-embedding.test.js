process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED_BACKFILL_ONLY = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../embedder/local.js', async () => {
  const { createHash } = await import('node:crypto');
  const LOCAL_EMBEDDING_DIM = 384;
  function vectorFromText(text) {
    const v = new Float32Array(LOCAL_EMBEDDING_DIM);
    const buf = createHash('sha512').update(text).digest();
    for (let i = 0; i < LOCAL_EMBEDDING_DIM; i++) v[i] = (buf[i % buf.length] - 128) / 128;
    let mag = 0;
    for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
    mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= mag;
    return Array.from(v);
  }
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async (texts) => texts.map(vectorFromText)),
  };
});

import { closeDb, getDb } from '../index.js';
import { InventoryRepository } from './mcp-inventory.js';
import { EmbeddingsRepository } from './embeddings.js';

beforeEach(() => {
  closeDb();
});

describe('replaceInventoryWithEmbeddings', () => {
  it('writes a meta_embeddings row per (server, tool)', async () => {
    getDb();
    const out = await InventoryRepository.replaceInventoryWithEmbeddings([
      {
        name: 'gmail',
        tools: [
          { name: 'send_message', description: 'Send a message' },
          { name: 'search_messages', description: 'Search across the inbox' },
        ],
      },
    ]);
    expect(out.inserted).toBe(2);

    const db = getDb();
    const rows = db
      .prepare("SELECT source_ref, body_text FROM meta_embeddings WHERE source_kind = 'mcp_tool'")
      .all()
      .sort((a, b) => a.source_ref.localeCompare(b.source_ref));
    expect(rows).toHaveLength(2);
    expect(rows[0].source_ref).toBe('gmail::search_messages');
    expect(rows[1].source_ref).toBe('gmail::send_message');
    expect(rows[1].body_text).toContain('Send a message');
  });

  it('wipes prior embeddings on the next declaration (orphan-free)', async () => {
    getDb();
    await InventoryRepository.replaceInventoryWithEmbeddings([
      { name: 'gmail', tools: [{ name: 'old_tool' }] },
    ]);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'gmail::old_tool')).not.toBe(null);

    // Second declare drops gmail entirely; old_tool's embedding must be gone.
    await InventoryRepository.replaceInventoryWithEmbeddings([
      { name: 'notion', tools: [{ name: 'create_page' }] },
    ]);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'gmail::old_tool')).toBe(null);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'notion::create_page')).not.toBe(null);
  });

  it('tools without descriptions get the server.tool-only body', async () => {
    getDb();
    await InventoryRepository.replaceInventoryWithEmbeddings([
      { name: 'minimal', tools: [{ name: 'do_thing' }] },
    ]);
    const row = EmbeddingsRepository.findByRef('mcp_tool', 'minimal::do_thing');
    expect(row.bodyText).toBe('minimal.do_thing');
  });

  it('soft-skips when MOJULO_SEMANTIC_INDEX_DISABLED=1 — inventory still commits', async () => {
    const original = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
    try {
      getDb();
      const out = await InventoryRepository.replaceInventoryWithEmbeddings([
        { name: 'gmail', tools: [{ name: 'send', description: 'x' }] },
      ]);
      expect(out.inserted).toBe(1);
      // No embedding row written.
      const row = EmbeddingsRepository.findByRef('mcp_tool', 'gmail::send');
      expect(row).toBe(null);
    } finally {
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED = original;
    }
  });

  it('atomicity — bad payload mid-batch rolls back inventory + embedding writes', async () => {
    getDb();
    await InventoryRepository.replaceInventoryWithEmbeddings([
      { name: 'gmail', tools: [{ name: 'a' }] },
    ]);
    // The bad call should not partially update.
    await expect(
      InventoryRepository.replaceInventoryWithEmbeddings([
        { name: 'notion', tools: [{ name: 'good' }, { name: '' }] },
      ]),
    ).rejects.toThrow();
    // Original gmail row + embedding survive.
    const db = getDb();
    const inv = db.prepare('SELECT * FROM meta_mcp_inventory').all();
    expect(inv).toHaveLength(1);
    expect(inv[0].server).toBe('gmail');
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'gmail::a')).not.toBe(null);
  });
});

describe('replaceInventory (sync, no embeddings)', () => {
  it('leaves meta_embeddings untouched', () => {
    getDb();
    const out = InventoryRepository.replaceInventory([
      { name: 'gmail', tools: [{ name: 'send' }] },
    ]);
    expect(out.inserted).toBe(1);
    const row = EmbeddingsRepository.findByRef('mcp_tool', 'gmail::send');
    expect(row).toBe(null);
  });
});
