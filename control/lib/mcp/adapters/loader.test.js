import { describe, it, expect } from 'vitest';
import {
  getAdapter,
  getAdapterCatalog,
  listAdapters,
  resolveAdapterId,
  _parseAdapterFileForTests as parseAdapterFile,
} from './loader.js';

describe('parseAdapterFile', () => {
  it('parses a well-formed adapter', () => {
    const raw =
      '---\n' +
      JSON.stringify({
        id: 'x',
        name: 'X',
        summary: 'a test',
        artifactTarget: '/tmp/<slug>.md',
        supportsClientInfoHint: ['X-Agent', 'X'],
      }) +
      '\n---\n\n# Body\n\nProse.';
    const adapter = parseAdapterFile('test.md', raw);
    expect(adapter.id).toBe('x');
    expect(adapter.name).toBe('X');
    expect(adapter.artifactTarget).toBe('/tmp/<slug>.md');
    expect(adapter.supportsClientInfoHint).toEqual(['x-agent', 'x']);
    expect(adapter.body).toBe('# Body\n\nProse.');
    expect(adapter.version).toBe(1);
  });

  it('throws when artifactTarget is missing', () => {
    const raw =
      '---\n' +
      JSON.stringify({ id: 'x', name: 'X', summary: 's' }) +
      '\n---\n\nbody';
    expect(() => parseAdapterFile('test.md', raw)).toThrow(
      /missing required string field 'artifactTarget'/
    );
  });

  it('throws when frontmatter fences are missing', () => {
    expect(() => parseAdapterFile('test.md', '# Just a body')).toThrow(/missing JSON frontmatter/);
  });

  it('throws when JSON is malformed', () => {
    const raw = '---\n{ not: valid }\n---\n\nbody';
    expect(() => parseAdapterFile('test.md', raw)).toThrow(/invalid JSON frontmatter/);
  });

  it('throws when body is empty', () => {
    const raw =
      '---\n' +
      JSON.stringify({ id: 'x', name: 'X', summary: 's', artifactTarget: 't' }) +
      '\n---\n\n   \n';
    expect(() => parseAdapterFile('test.md', raw)).toThrow(/empty body/);
  });
});

describe('built-in adapter catalog', () => {
  it('loads claude-code, codex, and generic', () => {
    const catalog = getAdapterCatalog();
    expect(catalog.has('claude-code')).toBe(true);
    expect(catalog.has('codex')).toBe(true);
    expect(catalog.has('generic')).toBe(true);
  });

  it('every shipped adapter has the documented contract', () => {
    const catalog = getAdapterCatalog();
    for (const [id, adapter] of catalog) {
      expect(adapter.id).toBe(id);
      expect(typeof adapter.name).toBe('string');
      expect(adapter.name.length).toBeGreaterThan(0);
      expect(typeof adapter.summary).toBe('string');
      expect(typeof adapter.artifactTarget).toBe('string');
      expect(adapter.artifactTarget.length).toBeGreaterThan(0);
      expect(typeof adapter.body).toBe('string');
      expect(adapter.body.length).toBeGreaterThan(100);
      expect(Array.isArray(adapter.supportsClientInfoHint)).toBe(true);
    }
  });
});

describe('listAdapters', () => {
  it('returns id/name/summary/artifactTarget (not body)', () => {
    const adapters = listAdapters();
    for (const a of adapters) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('summary');
      expect(a).toHaveProperty('artifactTarget');
      expect(a).not.toHaveProperty('body');
    }
  });
});

describe('getAdapter', () => {
  it('returns the full adapter including body', () => {
    const adapter = getAdapter('claude-code');
    expect(adapter).not.toBeNull();
    expect(adapter.id).toBe('claude-code');
    expect(typeof adapter.body).toBe('string');
    expect(adapter.body).toMatch(/Claude Code/);
  });

  it('returns null for unknown id', () => {
    expect(getAdapter('does-not-exist')).toBeNull();
  });

  it('does not expose internal _file field', () => {
    const adapter = getAdapter('claude-code');
    expect(adapter).not.toHaveProperty('_file');
  });
});

describe('resolveAdapterId', () => {
  it('honors an explicit host parameter when it matches an adapter', () => {
    expect(resolveAdapterId({ host: 'claude-code' })).toBe('claude-code');
    expect(resolveAdapterId({ host: 'codex' })).toBe('codex');
    expect(resolveAdapterId({ host: 'generic' })).toBe('generic');
  });

  it('falls back to generic when explicit host is unknown', () => {
    expect(resolveAdapterId({ host: 'no-such-adapter' })).toBe('generic');
  });

  it('matches clientInfo.name against supportsClientInfoHint case-insensitively', () => {
    expect(resolveAdapterId({ clientName: 'Claude Code' })).toBe('claude-code');
    expect(resolveAdapterId({ clientName: 'claude-code-1.0' })).toBe('claude-code');
    expect(resolveAdapterId({ clientName: 'codex' })).toBe('codex');
  });

  it('explicit host wins over clientInfo.name', () => {
    expect(
      resolveAdapterId({ host: 'generic', clientName: 'Claude Code' })
    ).toBe('generic');
  });

  it('falls back to generic when neither host nor clientInfo match', () => {
    expect(resolveAdapterId({})).toBe('generic');
    expect(resolveAdapterId({ clientName: 'some-other-agent' })).toBe('generic');
  });
});
