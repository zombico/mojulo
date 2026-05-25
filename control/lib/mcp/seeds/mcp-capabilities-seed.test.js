// Isolate to in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';

import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import { CapabilitiesRepository } from '@/lib/db/repositories/mcp-capabilities';
import { ProvidersRepository } from '@/lib/db/repositories/mcp-providers';
import {
  seedMcpCapabilities,
  _resetSeededForTests,
  _internals,
} from './mcp-capabilities-seed.js';

beforeEach(() => {
  closeDb();
  _resetSeededForTests();
});

describe('seedMcpCapabilities: shipped seeds (the real directory)', () => {
  it('seeds the four shipped vendor bodies into a fresh DB', () => {
    getDb();
    const result = seedMcpCapabilities();
    expect(result.skipped).toBe(false);
    expect(result.inserted).toBe(4);
    expect(result.providers.sort()).toEqual(['gmail', 'google_drive', 'linear', 'notion']);
  });

  it('creates the providers row for each seed with the hardcoded display_name', () => {
    getDb();
    seedMcpCapabilities();
    expect(ProvidersRepository.getByRef('gmail').displayName).toBe('Gmail');
    expect(ProvidersRepository.getByRef('notion').displayName).toBe('Notion');
    expect(ProvidersRepository.getByRef('linear').displayName).toBe('Linear');
    expect(ProvidersRepository.getByRef('google_drive').displayName).toBe('Google Drive');
  });

  it('stamps the v0.5.0 release sentinel on every seed row', () => {
    getDb();
    seedMcpCapabilities();
    const sentinel = _internals.V0_5_0_RELEASE_UNIX;
    for (const ref of ['gmail', 'notion', 'linear', 'google_drive']) {
      const row = CapabilitiesRepository.getCurrent(ref);
      expect(row).not.toBeNull();
      expect(row.discoveredAt).toBe(sentinel);
    }
  });

  it("source_urls[0] is the mojulo:// prefix; subsequent entries are vendor URLs from the body's <!-- sources --> block", () => {
    getDb();
    seedMcpCapabilities();
    const notion = CapabilitiesRepository.getCurrent('notion');
    expect(notion.sourceUrls[0]).toBe(_internals.SOURCE_MOJULO_PREFIX);
    expect(notion.sourceUrls.length).toBeGreaterThan(1);
    // Notion body cites developers.notion.com; confirm at least one vendor URL
    // made it through.
    const hasVendorUrl = notion.sourceUrls.some((u) =>
      u.startsWith('https://developers.notion.com')
    );
    expect(hasVendorUrl).toBe(true);
  });

  it('reads version_tag from frontmatter.capabilities.apiVersion when present', () => {
    getDb();
    seedMcpCapabilities();
    // Notion body declares apiVersion '2025-09-03'.
    const notion = CapabilitiesRepository.getCurrent('notion');
    expect(notion.versionTag).toBe('2025-09-03');
  });

  it('leaves version_tag null when frontmatter.capabilities.apiVersion is absent', () => {
    getDb();
    seedMcpCapabilities();
    // Gmail/linear/gdrive don't declare apiVersion in their frontmatter.
    const gmail = CapabilitiesRepository.getCurrent('gmail');
    expect(gmail.versionTag).toBe(null);
  });

  it('consolidatedView reports provenance="seed" for shipped seed rows', () => {
    getDb();
    seedMcpCapabilities();
    const view = CapabilitiesRepository.consolidatedView('notion');
    expect(view.capabilities.provenance).toBe('seed');
  });

  it('is idempotent across calls — second call is a no-op via the _seeded flag', () => {
    getDb();
    const first = seedMcpCapabilities();
    expect(first.skipped).toBe(false);
    expect(first.inserted).toBe(4);
    const second = seedMcpCapabilities();
    expect(second.skipped).toBe(true);
    expect(second.inserted).toBe(0);
  });

  it('with force=true, re-evaluates each provider but still skips ones with existing rows', () => {
    getDb();
    seedMcpCapabilities();
    _resetSeededForTests();
    const second = seedMcpCapabilities();
    // After reset, the function runs again, but every provider already has a
    // row, so inserted=0.
    expect(second.skipped).toBe(false);
    expect(second.inserted).toBe(0);
    expect(second.providers).toEqual([]);
  });

  it('never overwrites a pre-existing capability row (agent-research takes precedence)', () => {
    getDb();
    // Simulate the agent researching notion BEFORE the seed migration runs.
    CapabilitiesRepository.insert({
      providerRef: 'notion',
      displayName: 'Notion',
      versionTag: 'agent-asserted-version',
      bodyMd: 'agent body',
      sourceUrls: ['https://example.com/agent-research'],
    });
    const result = seedMcpCapabilities();
    // Notion was skipped; other three seeded.
    expect(result.inserted).toBe(3);
    expect(result.providers.sort()).toEqual(['gmail', 'google_drive', 'linear']);
    // Notion row is unchanged.
    const notion = CapabilitiesRepository.getCurrent('notion');
    expect(notion.bodyMd).toBe('agent body');
    expect(notion.versionTag).toBe('agent-asserted-version');
    expect(notion.sourceUrls[0]).toBe('https://example.com/agent-research');
  });
});

describe('seedMcpCapabilities: synthetic fixture (isolated rootDir)', () => {
  let tmpRoot;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'mcp-capabilities-seed-test-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writeSeed(name, frontmatter, body) {
    writeFileSync(
      join(tmpRoot, `${name}.md`),
      `---\n${JSON.stringify(frontmatter)}\n---\n\n${body}`
    );
  }

  it('returns inserted=0 when the seeds directory does not exist', () => {
    getDb();
    const missing = join(tmpRoot, '__not-here__');
    const result = seedMcpCapabilities({ rootDir: missing });
    expect(result.skipped).toBe(false);
    expect(result.inserted).toBe(0);
  });

  it('ignores non-.md files in the seeds directory', () => {
    getDb();
    writeSeed('foo', { ref: 'foo' }, '# foo body');
    writeFileSync(join(tmpRoot, 'README.txt'), 'not a seed');
    const result = seedMcpCapabilities({ rootDir: tmpRoot });
    expect(result.inserted).toBe(1);
    expect(result.providers).toEqual(['foo']);
  });

  it('throws on a malformed seed file (missing frontmatter)', () => {
    getDb();
    writeFileSync(join(tmpRoot, 'broken.md'), '# no frontmatter');
    expect(() => seedMcpCapabilities({ rootDir: tmpRoot })).toThrow(/missing JSON frontmatter/);
  });

  it('throws on invalid JSON frontmatter', () => {
    getDb();
    writeFileSync(join(tmpRoot, 'broken.md'), '---\n{ bad json }\n---\n\nbody');
    expect(() => seedMcpCapabilities({ rootDir: tmpRoot })).toThrow(/invalid JSON frontmatter/);
  });

  it('uses null display_name for providers not in the DISPLAY_NAMES map', () => {
    getDb();
    writeSeed('unknown-vendor', { ref: 'unknown-vendor' }, '# body');
    seedMcpCapabilities({ rootDir: tmpRoot });
    expect(ProvidersRepository.getByRef('unknown-vendor').displayName).toBe(null);
  });
});

describe('_internals.extractSourceUrls', () => {
  it('returns [] when no <!-- sources --> block exists', () => {
    expect(_internals.extractSourceUrls('plain body, no comment')).toEqual([]);
  });

  it('extracts URLs from a sources block', () => {
    const body = `
Body prose.

<!-- sources
  - https://a.example.com/foo
  - https://b.example.com/bar
-->`;
    expect(_internals.extractSourceUrls(body)).toEqual([
      'https://a.example.com/foo',
      'https://b.example.com/bar',
    ]);
  });

  it('handles multi-line entries with descriptive suffix text after the URL', () => {
    const body = `
<!-- sources
  - https://example.com/a (description after URL)
  - https://example.com/b — note about this source
-->`;
    expect(_internals.extractSourceUrls(body)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('handles an empty sources block gracefully', () => {
    expect(_internals.extractSourceUrls('<!-- sources -->')).toEqual([]);
  });
});

describe('_internals.parseSeedFile', () => {
  it('parses well-formed frontmatter and body', () => {
    const raw = '---\n{"ref":"foo","capabilities":{"apiVersion":"v1"}}\n---\n\nbody text';
    const { frontmatter, body } = _internals.parseSeedFile('foo.md', raw);
    expect(frontmatter.ref).toBe('foo');
    expect(frontmatter.capabilities.apiVersion).toBe('v1');
    expect(body).toContain('body text');
  });

  it('throws when fences are missing', () => {
    expect(() => _internals.parseSeedFile('bad.md', 'no fences')).toThrow(/missing JSON frontmatter/);
  });

  it('throws on invalid JSON', () => {
    expect(() => _internals.parseSeedFile('bad.md', '---\n{ bad }\n---\n\nbody')).toThrow(
      /invalid JSON frontmatter/
    );
  });
});
