// Isolate to in-memory SQLite — must run before any import that pulls in
// db/index.js (getDb is lazy and reads SQLITE_PATH on first call).
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import { ProvidersRepository, _internals } from './mcp-providers.js';

beforeEach(() => {
  closeDb();
});

describe('schema bootstraps', () => {
  it('creates meta_mcp_providers on first getDb()', () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'meta_mcp_providers'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('enforces UNIQUE on provider_ref', () => {
    const db = getDb();
    db.prepare("INSERT INTO meta_mcp_providers (provider_ref) VALUES ('gmail')").run();
    expect(() => {
      db.prepare("INSERT INTO meta_mcp_providers (provider_ref) VALUES ('gmail')").run();
    }).toThrow(/UNIQUE/i);
  });
});

describe('ProvidersRepository.upsertByRef', () => {
  it('inserts on first call and returns wasNew=true', () => {
    getDb();
    const result = ProvidersRepository.upsertByRef('gmail', { displayName: 'Gmail' });
    expect(result.wasNew).toBe(true);
    expect(result.providerRef).toBe('gmail');
    expect(result.displayName).toBe('Gmail');
    expect(typeof result.id).toBe('number');
    expect(typeof result.createdAt).toBe('number');
  });

  it('returns the existing row on second call with wasNew=false', () => {
    getDb();
    const first = ProvidersRepository.upsertByRef('gmail', { displayName: 'Gmail' });
    const second = ProvidersRepository.upsertByRef('gmail', { displayName: 'Different Name' });
    expect(second.wasNew).toBe(false);
    expect(second.id).toBe(first.id);
    // First-writer-wins: display_name unchanged.
    expect(second.displayName).toBe('Gmail');
  });

  it('preserves null display_name if first writer omitted it, even if second supplies one', () => {
    getDb();
    ProvidersRepository.upsertByRef('foo');
    const second = ProvidersRepository.upsertByRef('foo', { displayName: 'Foo' });
    expect(second.wasNew).toBe(false);
    expect(second.displayName).toBe(null);
  });

  it('accepts omitted displayName option entirely', () => {
    getDb();
    const result = ProvidersRepository.upsertByRef('linear');
    expect(result.wasNew).toBe(true);
    expect(result.displayName).toBe(null);
  });

  it('handles multiple distinct providers without collision', () => {
    getDb();
    const gmail = ProvidersRepository.upsertByRef('gmail');
    const notion = ProvidersRepository.upsertByRef('notion');
    const linear = ProvidersRepository.upsertByRef('linear');
    expect(new Set([gmail.id, notion.id, linear.id]).size).toBe(3);
  });

  it('throws on empty providerRef', () => {
    getDb();
    expect(() => ProvidersRepository.upsertByRef('')).toThrow(/non-empty string/);
  });

  it('throws on null providerRef', () => {
    getDb();
    expect(() => ProvidersRepository.upsertByRef(null)).toThrow(/non-empty string/);
  });

  it('throws on undefined providerRef', () => {
    getDb();
    expect(() => ProvidersRepository.upsertByRef(undefined)).toThrow(/non-empty string/);
  });

  it('throws on non-string providerRef', () => {
    getDb();
    expect(() => ProvidersRepository.upsertByRef(42)).toThrow(/non-empty string/);
  });

  it('treats whitespace-only displayName as null', () => {
    getDb();
    const result = ProvidersRepository.upsertByRef('foo', { displayName: '   ' });
    expect(result.displayName).toBe(null);
  });

  it('trims surrounding whitespace from displayName', () => {
    getDb();
    const result = ProvidersRepository.upsertByRef('foo', { displayName: '  Foo  ' });
    expect(result.displayName).toBe('Foo');
  });
});

describe('ProvidersRepository.getByRef', () => {
  it('returns null for an unknown ref', () => {
    getDb();
    expect(ProvidersRepository.getByRef('unknown')).toBe(null);
  });

  it('returns the row after upsert', () => {
    getDb();
    ProvidersRepository.upsertByRef('notion', { displayName: 'Notion' });
    const row = ProvidersRepository.getByRef('notion');
    expect(row).not.toBe(null);
    expect(row.providerRef).toBe('notion');
    expect(row.displayName).toBe('Notion');
  });

  it('returns null for empty / null / non-string input', () => {
    getDb();
    expect(ProvidersRepository.getByRef('')).toBe(null);
    expect(ProvidersRepository.getByRef(null)).toBe(null);
    expect(ProvidersRepository.getByRef(undefined)).toBe(null);
    expect(ProvidersRepository.getByRef(42)).toBe(null);
  });
});

describe('ProvidersRepository.getById', () => {
  it('returns the row by id', () => {
    getDb();
    const inserted = ProvidersRepository.upsertByRef('gmail');
    const fetched = ProvidersRepository.getById(inserted.id);
    expect(fetched.providerRef).toBe('gmail');
  });

  it('returns null for unknown id', () => {
    getDb();
    expect(ProvidersRepository.getById(999)).toBe(null);
  });

  it('returns null for non-integer input', () => {
    getDb();
    expect(ProvidersRepository.getById(null)).toBe(null);
    expect(ProvidersRepository.getById('1')).toBe(null);
    expect(ProvidersRepository.getById(1.5)).toBe(null);
  });
});

describe('ProvidersRepository.listAll', () => {
  it('returns [] when empty', () => {
    getDb();
    expect(ProvidersRepository.listAll()).toEqual([]);
  });

  it('returns all providers ordered by provider_ref', () => {
    getDb();
    ProvidersRepository.upsertByRef('notion');
    ProvidersRepository.upsertByRef('gmail');
    ProvidersRepository.upsertByRef('linear');
    const all = ProvidersRepository.listAll();
    expect(all.map((p) => p.providerRef)).toEqual(['gmail', 'linear', 'notion']);
  });
});

describe('_internals.normalizeDisplayName', () => {
  it('returns null for non-string input', () => {
    expect(_internals.normalizeDisplayName(null)).toBe(null);
    expect(_internals.normalizeDisplayName(undefined)).toBe(null);
    expect(_internals.normalizeDisplayName(42)).toBe(null);
  });

  it('returns null for empty / whitespace-only string', () => {
    expect(_internals.normalizeDisplayName('')).toBe(null);
    expect(_internals.normalizeDisplayName('   ')).toBe(null);
    expect(_internals.normalizeDisplayName('\t\n')).toBe(null);
  });

  it('trims surrounding whitespace', () => {
    expect(_internals.normalizeDisplayName('  Gmail  ')).toBe('Gmail');
  });

  it('preserves internal whitespace', () => {
    expect(_internals.normalizeDisplayName('Google Drive')).toBe('Google Drive');
  });
});
