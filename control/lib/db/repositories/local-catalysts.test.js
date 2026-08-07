// Isolate this test file to in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';
// Short-circuit the semantic-index sidecar — these tests cover the storage
// layer; embedding mirroring is covered by local-catalysts-embedding.test.js.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import { LocalCatalystRepository } from '@/lib/db/repositories/local-catalysts';
import { validateCatalystMeta } from '@/lib/mcp/catalysts/loader';

beforeEach(() => {
  closeDb();
  getDb();
});

function validCatalyst(overrides = {}) {
  return validateCatalystMeta(
    {
      id: 'evening-digest',
      name: 'Evening Digest',
      summary: 'Digest the day into a channel',
      valueHook: 'A nightly summary without asking for it',
      category: 'digest',
      ...overrides,
    },
    overrides.body ?? '# Body\n\nMapping intent prose.',
  );
}

describe('LocalCatalystRepository', () => {
  it('mints at rev 1 with derived version and local origin', () => {
    const created = LocalCatalystRepository.create({ catalyst: validCatalyst() });
    expect(created.rev).toBe(1);
    expect(created.version).toBe(1);
    expect(created.origin).toBe('local');
    expect(created.status).toBe('active');
    expect(created.kind).toBe('workflow');
    expect(created.body).toContain('Mapping intent');
    expect(LocalCatalystRepository.listRevisions('evening-digest')).toHaveLength(1);
  });

  it('refuses to re-create an existing id in any status', () => {
    LocalCatalystRepository.create({ catalyst: validCatalyst() });
    expect(() => LocalCatalystRepository.create({ catalyst: validCatalyst() })).toThrow(
      /already exists \(status: active\)/,
    );
    LocalCatalystRepository.archive('evening-digest');
    expect(() => LocalCatalystRepository.create({ catalyst: validCatalyst() })).toThrow(
      /already exists \(status: archived\)/,
    );
  });

  it('update appends a revision, bumps the head, and keeps history readable', () => {
    LocalCatalystRepository.create({ catalyst: validCatalyst(), note: 'first mint' });
    const updated = LocalCatalystRepository.update({
      catalyst: validCatalyst({ summary: 'Digest v2', body: '# Body v2\n\nRevised.' }),
      note: 'tighten mapping',
    });
    expect(updated.rev).toBe(2);
    expect(updated.version).toBe(2);
    expect(updated.summary).toBe('Digest v2');
    expect(updated.body).toContain('Revised');

    const revisions = LocalCatalystRepository.listRevisions('evening-digest');
    expect(revisions.map((r) => r.rev)).toEqual([2, 1]);
    expect(revisions[0].note).toBe('tighten mapping');

    const rev1 = LocalCatalystRepository.getRevision('evening-digest', 1);
    expect(rev1.body).toContain('Mapping intent');
    expect(rev1.meta.summary).toBe('Digest the day into a channel');
  });

  it('archive removes from the active shelf but keeps get + revisions; update revives', () => {
    LocalCatalystRepository.create({ catalyst: validCatalyst() });
    expect(LocalCatalystRepository.archive('evening-digest')).toBe(true);
    expect(LocalCatalystRepository.archive('evening-digest')).toBe(false); // already archived
    expect(LocalCatalystRepository.listActive()).toHaveLength(0);
    expect(LocalCatalystRepository.get('evening-digest').status).toBe('archived');
    expect(LocalCatalystRepository.listRevisions('evening-digest')).toHaveLength(1);

    const revived = LocalCatalystRepository.update({
      catalyst: validCatalyst({ body: 'back on the shelf' }),
      note: 'revive',
    });
    expect(revived.status).toBe('active');
    expect(revived.rev).toBe(2);
    expect(LocalCatalystRepository.listActive()).toHaveLength(1);
  });

  it('update throws on unknown id', () => {
    expect(() => LocalCatalystRepository.update({ catalyst: validCatalyst() })).toThrow(/not found/);
  });

  it('stores technique kind and round-trips requires/parameters', () => {
    const technique = validateCatalystMeta(
      {
        id: 'technique-scratch-store',
        name: 'Scratch Store',
        summary: 's',
        valueHook: 'v',
        kind: 'technique',
        requires: { destinationMcpCategory: 'data-store-like', destinationExamples: ['SQLite'] },
        parameters: [{ name: 'path', prompt: 'Where?' }],
      },
      'body',
    );
    const created = LocalCatalystRepository.create({ catalyst: technique });
    expect(created.kind).toBe('technique');
    expect(created.requires.destinationExamples).toEqual(['SQLite']);
    expect(created.parameters).toEqual([{ name: 'path', prompt: 'Where?' }]);
  });

  it('createWithEmbedding degrades to plain create when the index is disabled', async () => {
    const created = await LocalCatalystRepository.createWithEmbedding({ catalyst: validCatalyst() });
    expect(created.rev).toBe(1);
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM meta_embeddings WHERE source_kind = 'catalyst'`)
      .get();
    expect(row.n).toBe(0);
  });
});
