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
        summary: 'Linear MCP',
        affordances: { read: true, write: true, watch: false },
        capabilities: { cursor: true },
      }) +
      '\n---\n\n# Body\n\nProse.';
    const { meta, body } = parseComponentFile('mcp/linear.md', raw);
    expect(meta.ref).toBe('linear');
    expect(meta.version).toBe('0.1.0');
    expect(meta.summary).toBe('Linear MCP');
    expect(meta.affordances).toEqual({ read: true, write: true, watch: false });
    expect(meta.capabilities).toEqual({ cursor: true });
    expect(body).toBe('# Body\n\nProse.');
  });

  it('throws when frontmatter fences are missing', () => {
    expect(() => parseComponentFile('mcp/x.md', '# Just a body')).toThrow(/missing JSON frontmatter/);
  });

  it('throws when ref is missing', () => {
    const raw = '---\n' + JSON.stringify({ version: '0.1.0', summary: 's' }) + '\n---\n\nbody';
    expect(() => parseComponentFile('mcp/x.md', raw)).toThrow(/missing required string field 'ref'/);
  });

  it('throws when JSON is malformed', () => {
    expect(() => parseComponentFile('mcp/x.md', '---\n{ not: valid }\n---\n\nbody')).toThrow(
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
    mkdirSync(join(tmpRoot, 'pattern'));
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'aggregation', version: '0.1.0', summary: 'agg' }) +
        '\n---\n\nbody',
    );
    mkdirSync(join(tmpRoot, 'trigger'));
    writeFileSync(
      join(tmpRoot, 'trigger', 'scheduled.md'),
      '---\n' +
        JSON.stringify({ ref: 'scheduled', version: '0.1.0', summary: 'cron' }) +
        '\n---\n\nbody',
    );
    const out = discoverComponents(tmpRoot);
    expect(out).toHaveLength(2);
    const kinds = out.map((c) => c.kind).sort();
    expect(kinds).toEqual(['pattern', 'trigger']);
    expect(out.every((c) => c.source === 'builtin')).toBe(true);
  });

  it('skips directories that are not known kinds (including legacy mcp/source/destination)', () => {
    mkdirSync(join(tmpRoot, 'pattern'));
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'aggregation', version: '0.1.0', summary: 'agg' }) +
        '\n---\n\nbody',
    );
    // Legacy kinds from prior iterations — loader should skip them, not crash.
    // 'mcp' moved to seeds/mcp-capabilities/ via the providers identity layer;
    // 'source' / 'destination' collapsed into composition roles on mcp entries.
    for (const legacy of ['mcp', 'source', 'destination']) {
      mkdirSync(join(tmpRoot, legacy));
      writeFileSync(
        join(tmpRoot, legacy, 'stale.md'),
        '---\n' +
          JSON.stringify({ ref: 'stale', version: '0.1.0', summary: 'old' }) +
          '\n---\n\nbody',
      );
    }
    mkdirSync(join(tmpRoot, 'not-a-kind'));
    writeFileSync(
      join(tmpRoot, 'not-a-kind', 'whatever.md'),
      '---\n' +
        JSON.stringify({ ref: 'whatever', version: '0.1.0', summary: 'no' }) +
        '\n---\n\nbody',
    );
    const out = discoverComponents(tmpRoot);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('pattern');
  });

  it('throws when filename basename does not match frontmatter ref', () => {
    mkdirSync(join(tmpRoot, 'pattern'));
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'routing', version: '0.1.0', summary: 'wrong' }) +
        '\n---\n\nbody',
    );
    expect(() => discoverComponents(tmpRoot)).toThrow(/filename ref 'aggregation' does not match/);
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
    mkdirSync(join(tmpRoot, 'pattern'));
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'aggregation', version: '0.1.0', summary: 'agg' }) +
        '\n---\n\nbody',
    );
    const result = seedComponents({ rootDir: tmpRoot });
    expect(result.skipped).toBe(false);
    expect(result.inserted).toBe(1);
    const row = MCPOrbitComponentRepository.findByRef('pattern', 'aggregation');
    expect(row).not.toBeNull();
    expect(row.bodyMd).toBe('body');
    expect(row.source).toBe('builtin');
    expect(row.payload.summary).toBe('agg');
  });

  it('is idempotent across re-seeds with force', () => {
    mkdirSync(join(tmpRoot, 'pattern'));
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'aggregation', version: '0.1.0', summary: 'agg' }) +
        '\n---\n\nbody-v1',
    );
    seedComponents({ rootDir: tmpRoot });
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'aggregation', version: '0.1.0', summary: 'agg' }) +
        '\n---\n\nbody-v2',
    );
    seedComponents({ rootDir: tmpRoot, force: true });
    const row = MCPOrbitComponentRepository.findByRef('pattern', 'aggregation');
    expect(row.bodyMd).toBe('body-v2');
  });

  it('drops removed components on re-seed (deleteAllBuiltins behavior)', () => {
    mkdirSync(join(tmpRoot, 'pattern'));
    writeFileSync(
      join(tmpRoot, 'pattern', 'aggregation.md'),
      '---\n' +
        JSON.stringify({ ref: 'aggregation', version: '0.1.0', summary: 'agg' }) +
        '\n---\n\nbody',
    );
    writeFileSync(
      join(tmpRoot, 'pattern', 'routing.md'),
      '---\n' +
        JSON.stringify({ ref: 'routing', version: '0.1.0', summary: 'rou' }) +
        '\n---\n\nbody',
    );
    seedComponents({ rootDir: tmpRoot });
    expect(MCPOrbitComponentRepository.list({ kind: 'pattern' })).toHaveLength(2);
    rmSync(join(tmpRoot, 'pattern', 'routing.md'));
    seedComponents({ rootDir: tmpRoot, force: true });
    const remaining = MCPOrbitComponentRepository.list({ kind: 'pattern' });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ref).toBe('aggregation');
  });
});

describe('shipped components', () => {
  it('the bundled mcp-orbit-components directory parses without error', () => {
    // Touches the real directory — catches any future regression where a
    // shipped component is malformed. After decuration, vendor knowledge
    // ('mcp' kind) moved out of the component loader to the providers +
    // capabilities Ring 6 surfaces; the loader now ships only the
    // composable scaffolding (trigger / pattern / idempotency / render).
    const out = discoverComponents();
    expect(out.length).toBeGreaterThanOrEqual(6);
    const refs = out.map((c) => c.kind + '/' + c.ref).sort();
    // Weekly-digest shape (non-mcp parts)
    expect(refs).toContain('trigger/scheduled');
    expect(refs).toContain('pattern/aggregation');
    expect(refs).toContain('idempotency/window-key');
    // Signal-routing shape (non-mcp parts)
    expect(refs).toContain('trigger/signal-polled');
    expect(refs).toContain('pattern/routing');
    expect(refs).toContain('idempotency/source-side-label');
    // 'mcp' kind no longer ships through the loader — assertions for
    // vendor bodies live in the capabilities repository / seed migration
    // tests now.
    expect(refs.some((r) => r.startsWith('mcp/'))).toBe(false);
  });

  it('every shipped component declares intentKeywords for the recommender', () => {
    // The recommender uses intentKeywords to pick trigger/pattern/idempotency
    // by matching against the operator's intent prose. Every shipped
    // component should declare at least one keyword (mcp components used to
    // be exempt; with mcp removed from the loader, no exemption needed).
    const out = discoverComponents();
    expect(out.length).toBeGreaterThanOrEqual(6);
    for (const c of out) {
      const kw = c.payload?.intentKeywords;
      expect(Array.isArray(kw)).toBe(true);
      expect(kw.length).toBeGreaterThan(0);
    }
  });
});
