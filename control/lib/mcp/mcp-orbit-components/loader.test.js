// Isolate to in-memory SQLite — must set env before any db import.
process.env.SQLITE_PATH = ':memory:';

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { closeDb } from '../../db/index.js';
import { MCPOrbitComponentRepository } from '../../db/repositories/mcp-orbit.js';
import {
  discoverComponents,
  seedComponents,
  _parseComponentFileForTests as parseComponentFile,
  _resetSeededForTests,
} from './loader.js';

beforeEach(() => {
  closeDb();
  _resetSeededForTests();
});

describe('parseComponentFile', () => {
  it('parses a well-formed component', () => {
    const raw =
      '---\n' +
      JSON.stringify({
        ref: 'linear',
        version: '0.1.0',
        summary: 'Linear source',
        capabilities: { cursor: true },
      }) +
      '\n---\n\n# Body\n\nProse.';
    const { meta, body } = parseComponentFile('source/linear.md', raw);
    expect(meta.ref).toBe('linear');
    expect(meta.version).toBe('0.1.0');
    expect(meta.summary).toBe('Linear source');
    expect(meta.capabilities).toEqual({ cursor: true });
    expect(body).toBe('# Body\n\nProse.');
  });

  it('throws when frontmatter fences are missing', () => {
    expect(() => parseComponentFile('source/x.md', '# Just a body')).toThrow(/missing JSON frontmatter/);
  });

  it('throws when ref is missing', () => {
    const raw = '---\n' + JSON.stringify({ version: '0.1.0', summary: 's' }) + '\n---\n\nbody';
    expect(() => parseComponentFile('source/x.md', raw)).toThrow(/missing required string field 'ref'/);
  });

  it('throws when JSON is malformed', () => {
    expect(() => parseComponentFile('source/x.md', '---\n{ not: valid }\n---\n\nbody')).toThrow(
      /invalid JSON frontmatter/,
    );
  });
});

describe('discoverComponents', () => {
  let tmpRoot;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'mcp-orbit-loader-test-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('discovers components from <kind>/<ref>.md', () => {
    mkdirSync(join(tmpRoot, 'source'));
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'linear', version: '0.1.0', summary: 'lin' }) +
        '\n---\n\nbody',
    );
    mkdirSync(join(tmpRoot, 'destination'));
    writeFileSync(
      join(tmpRoot, 'destination', 'gdrive.md'),
      '---\n' +
        JSON.stringify({ ref: 'gdrive', version: '0.1.0', summary: 'gd' }) +
        '\n---\n\nbody',
    );
    const out = discoverComponents(tmpRoot);
    expect(out).toHaveLength(2);
    const kinds = out.map((c) => c.kind).sort();
    expect(kinds).toEqual(['destination', 'source']);
    expect(out.every((c) => c.source === 'builtin')).toBe(true);
  });

  it('skips directories that are not known kinds', () => {
    mkdirSync(join(tmpRoot, 'source'));
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'linear', version: '0.1.0', summary: 'lin' }) +
        '\n---\n\nbody',
    );
    mkdirSync(join(tmpRoot, 'not-a-kind'));
    writeFileSync(
      join(tmpRoot, 'not-a-kind', 'whatever.md'),
      '---\n' +
        JSON.stringify({ ref: 'whatever', version: '0.1.0', summary: 'no' }) +
        '\n---\n\nbody',
    );
    const out = discoverComponents(tmpRoot);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('source');
  });

  it('throws when filename basename does not match frontmatter ref', () => {
    mkdirSync(join(tmpRoot, 'source'));
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'jira', version: '0.1.0', summary: 'wrong' }) +
        '\n---\n\nbody',
    );
    expect(() => discoverComponents(tmpRoot)).toThrow(/filename ref 'linear' does not match/);
  });
});

describe('seedComponents', () => {
  let tmpRoot;
  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'mcp-orbit-seed-test-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('seeds discovered components into the store', () => {
    mkdirSync(join(tmpRoot, 'source'));
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'linear', version: '0.1.0', summary: 'lin' }) +
        '\n---\n\nbody',
    );
    const result = seedComponents({ rootDir: tmpRoot });
    expect(result.skipped).toBe(false);
    expect(result.inserted).toBe(1);
    const row = MCPOrbitComponentRepository.findByRef('source', 'linear');
    expect(row).not.toBeNull();
    expect(row.bodyMd).toBe('body');
    expect(row.source).toBe('builtin');
    expect(row.payload.summary).toBe('lin');
  });

  it('is idempotent across re-seeds with force', () => {
    mkdirSync(join(tmpRoot, 'source'));
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'linear', version: '0.1.0', summary: 'lin' }) +
        '\n---\n\nbody-v1',
    );
    seedComponents({ rootDir: tmpRoot });
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'linear', version: '0.1.0', summary: 'lin' }) +
        '\n---\n\nbody-v2',
    );
    seedComponents({ rootDir: tmpRoot, force: true });
    const row = MCPOrbitComponentRepository.findByRef('source', 'linear');
    expect(row.bodyMd).toBe('body-v2');
  });

  it('drops removed components on re-seed (deleteAllBuiltins behavior)', () => {
    mkdirSync(join(tmpRoot, 'source'));
    writeFileSync(
      join(tmpRoot, 'source', 'linear.md'),
      '---\n' +
        JSON.stringify({ ref: 'linear', version: '0.1.0', summary: 'lin' }) +
        '\n---\n\nbody',
    );
    writeFileSync(
      join(tmpRoot, 'source', 'jira.md'),
      '---\n' +
        JSON.stringify({ ref: 'jira', version: '0.1.0', summary: 'jir' }) +
        '\n---\n\nbody',
    );
    seedComponents({ rootDir: tmpRoot });
    expect(MCPOrbitComponentRepository.list({ kind: 'source' })).toHaveLength(2);
    rmSync(join(tmpRoot, 'source', 'jira.md'));
    seedComponents({ rootDir: tmpRoot, force: true });
    const remaining = MCPOrbitComponentRepository.list({ kind: 'source' });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ref).toBe('linear');
  });
});

describe('shipped components', () => {
  it('the bundled mcp-orbit-components directory parses without error', () => {
    // Touches the real directory — catches any future regression where a
    // shipped component is malformed.
    const out = discoverComponents();
    expect(out.length).toBeGreaterThanOrEqual(5);
    const refs = out.map((c) => c.kind + '/' + c.ref).sort();
    expect(refs).toContain('destination/gdrive');
    expect(refs).toContain('idempotency/window-key');
    expect(refs).toContain('pattern/aggregation');
    expect(refs).toContain('source/linear');
    expect(refs).toContain('trigger/scheduled');
  });
});
