// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js, since getDb() is lazy and reads SQLITE_PATH on
// first call. Vitest runs test files in worker isolation, so this env mutation
// doesn't leak to sibling test files.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import {
  MCPOrbitComponentRepository,
  MCPOrbitCompositionRepository,
  _COMPONENT_KINDS_FOR_TESTS as COMPONENT_KINDS,
  _COMPOSITION_STATUSES_FOR_TESTS as COMPOSITION_STATUSES,
} from './mcp-orbit.js';

beforeEach(() => {
  closeDb();
});

describe('schema bootstraps', () => {
  it('creates mcp_orbit_components and mcp_orbit_compositions on first getDb()', () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mcp_orbit_%'")
      .all()
      .map((r) => r.name)
      .sort();
    expect(tables).toEqual(['mcp_orbit_components', 'mcp_orbit_compositions']);
  });

  it('creates the documented indexes', () => {
    const db = getDb();
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_mcp_orbit_%'")
      .all()
      .map((r) => r.name)
      .sort();
    expect(indexes).toEqual([
      'idx_mcp_orbit_components_kind',
      'idx_mcp_orbit_components_ref',
      'idx_mcp_orbit_compositions_artifact',
      'idx_mcp_orbit_compositions_status',
    ]);
  });

  it('enforces the component kind CHECK constraint at the DB layer', () => {
    const db = getDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO mcp_orbit_components (kind, ref, version, body_md)
           VALUES (?, ?, ?, ?)`,
        )
        .run('nonsense', 'x', '0.1.0', 'body'),
    ).toThrow(/CHECK constraint failed/);
  });

  it('enforces the composition status CHECK constraint at the DB layer', () => {
    const db = getDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO mcp_orbit_compositions (ref, intent_md, component_refs, knobs_json, status)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run('comp_test', 'intent', '[]', '{}', 'nonsense'),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe('MCPOrbitComponentRepository.upsert', () => {
  it('inserts a new component', () => {
    const c = MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.1.0',
      body_md: '# linear body',
      payload: { summary: 'Linear source' },
    });
    expect(c.id).toBeGreaterThan(0);
    expect(c.kind).toBe('source');
    expect(c.ref).toBe('linear');
    expect(c.version).toBe('0.1.0');
    expect(c.bodyMd).toBe('# linear body');
    expect(c.payload).toEqual({ summary: 'Linear source' });
    expect(c.source).toBe('builtin');
  });

  it('upsert(same kind, ref, version) overwrites body and payload', () => {
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.1.0',
      body_md: 'v1',
      payload: { summary: 'first' },
    });
    const updated = MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.1.0',
      body_md: 'v2',
      payload: { summary: 'second' },
    });
    expect(updated.bodyMd).toBe('v2');
    expect(updated.payload).toEqual({ summary: 'second' });
  });

  it('different versions of the same ref coexist', () => {
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.1.0',
      body_md: 'old',
    });
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.2.0',
      body_md: 'new',
    });
    const latest = MCPOrbitComponentRepository.findByRef('source', 'linear');
    expect(latest.version).toBe('0.2.0');
    const explicitV1 = MCPOrbitComponentRepository.findByRef('source', 'linear', '0.1.0');
    expect(explicitV1.bodyMd).toBe('old');
  });

  it('rejects invalid kind', () => {
    expect(() =>
      MCPOrbitComponentRepository.upsert({
        kind: 'nonsense',
        ref: 'x',
        version: '0.1.0',
        body_md: 'body',
      }),
    ).toThrow(/Invalid component kind/);
  });

  it('rejects empty ref / version / body_md', () => {
    expect(() =>
      MCPOrbitComponentRepository.upsert({ kind: 'source', ref: '', version: '0.1.0', body_md: 'b' }),
    ).toThrow(/component.ref/);
    expect(() =>
      MCPOrbitComponentRepository.upsert({ kind: 'source', ref: 'x', version: '', body_md: 'b' }),
    ).toThrow(/component.version/);
    expect(() =>
      MCPOrbitComponentRepository.upsert({ kind: 'source', ref: 'x', version: '0.1.0', body_md: '' }),
    ).toThrow(/component.body_md/);
  });
});

describe('MCPOrbitComponentRepository.list', () => {
  beforeEach(() => {
    getDb(); // ensure schema
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.1.0',
      body_md: 'lin',
    });
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.2.0',
      body_md: 'lin2',
    });
    MCPOrbitComponentRepository.upsert({
      kind: 'destination',
      ref: 'gdrive',
      version: '0.1.0',
      body_md: 'gd',
    });
  });

  it('lists max version per (kind, ref)', () => {
    const all = MCPOrbitComponentRepository.list();
    expect(all).toHaveLength(2);
    const linear = all.find((c) => c.ref === 'linear');
    expect(linear.version).toBe('0.2.0');
  });

  it('filters by kind', () => {
    const sources = MCPOrbitComponentRepository.list({ kind: 'source' });
    expect(sources).toHaveLength(1);
    expect(sources[0].ref).toBe('linear');
  });

  it('filters by ref pattern (LIKE)', () => {
    const lin = MCPOrbitComponentRepository.list({ refPattern: 'lin%' });
    expect(lin).toHaveLength(1);
    expect(lin[0].ref).toBe('linear');
  });
});

describe('MCPOrbitComponentRepository.deleteAllBuiltins', () => {
  it('drops builtin rows but preserves custom rows', () => {
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'linear',
      version: '0.1.0',
      body_md: 'b',
      source: 'builtin',
    });
    MCPOrbitComponentRepository.upsert({
      kind: 'source',
      ref: 'my-custom',
      version: '0.1.0',
      body_md: 'c',
      source: 'custom',
    });
    const deleted = MCPOrbitComponentRepository.deleteAllBuiltins();
    expect(deleted).toBe(1);
    const remaining = MCPOrbitComponentRepository.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ref).toBe('my-custom');
    expect(remaining[0].source).toBe('custom');
  });
});

describe('MCPOrbitCompositionRepository.insert', () => {
  it('inserts a composition with auto-generated ref and default status proposed', () => {
    const c = MCPOrbitCompositionRepository.insert({
      intent_md: 'weekly linear digest to drive',
      component_refs: [
        { kind: 'source', ref: 'linear', version: '0.1.0' },
        { kind: 'destination', ref: 'gdrive', version: '0.1.0' },
      ],
      knobs: { cadence: 'weekly' },
      ranking_score: 0.85,
    });
    expect(c.ref).toMatch(/^comp_[a-f0-9]{12}$/);
    expect(c.status).toBe('proposed');
    expect(c.componentRefs).toHaveLength(2);
    expect(c.knobs).toEqual({ cadence: 'weekly' });
    expect(c.rankingScore).toBe(0.85);
  });

  it('rejects empty intent_md / empty component_refs', () => {
    expect(() =>
      MCPOrbitCompositionRepository.insert({ intent_md: '', component_refs: [], knobs: {} }),
    ).toThrow(/intent_md/);
    expect(() =>
      MCPOrbitCompositionRepository.insert({ intent_md: 'x', component_refs: [], knobs: {} }),
    ).toThrow(/component_refs/);
  });

  it('rejects malformed component_refs entries', () => {
    expect(() =>
      MCPOrbitCompositionRepository.insert({
        intent_md: 'x',
        component_refs: [{ kind: 'source', ref: 'linear' }],
        knobs: {},
      }),
    ).toThrow(/version/);
  });
});

describe('MCPOrbitCompositionRepository.update', () => {
  it('transitions status and persists artifact_ref', () => {
    const c = MCPOrbitCompositionRepository.insert({
      intent_md: 'x',
      component_refs: [{ kind: 'source', ref: 'linear', version: '0.1.0' }],
      knobs: {},
    });
    const updated = MCPOrbitCompositionRepository.update(c.ref, {
      status: 'materialized',
      artifact_ref: 'claude-code:.claude/skills/weekly-digest/SKILL.md',
    });
    expect(updated.status).toBe('materialized');
    expect(updated.artifactRef).toBe('claude-code:.claude/skills/weekly-digest/SKILL.md');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(c.createdAt);
  });

  it('throws on unknown ref', () => {
    expect(() => MCPOrbitCompositionRepository.update('comp_bogus', { status: 'dry_run' })).toThrow(
      /No composition with ref/,
    );
  });

  it('requires at least one field', () => {
    const c = MCPOrbitCompositionRepository.insert({
      intent_md: 'x',
      component_refs: [{ kind: 'source', ref: 'linear', version: '0.1.0' }],
      knobs: {},
    });
    expect(() => MCPOrbitCompositionRepository.update(c.ref, {})).toThrow(/at least one/);
  });
});

describe('MCPOrbitCompositionRepository.list', () => {
  it('filters by status and orders newest first', () => {
    const a = MCPOrbitCompositionRepository.insert({
      intent_md: 'a',
      component_refs: [{ kind: 'source', ref: 'linear', version: '0.1.0' }],
      knobs: {},
    });
    const b = MCPOrbitCompositionRepository.insert({
      intent_md: 'b',
      component_refs: [{ kind: 'source', ref: 'linear', version: '0.1.0' }],
      knobs: {},
    });
    MCPOrbitCompositionRepository.update(b.ref, { status: 'materialized' });
    const materialized = MCPOrbitCompositionRepository.list({ status: 'materialized' });
    expect(materialized).toHaveLength(1);
    expect(materialized[0].ref).toBe(b.ref);
    const proposed = MCPOrbitCompositionRepository.list({ status: 'proposed' });
    expect(proposed).toHaveLength(1);
    expect(proposed[0].ref).toBe(a.ref);
  });
});

describe('exported kinds and statuses', () => {
  it('exports expected COMPONENT_KINDS', () => {
    expect(COMPONENT_KINDS).toEqual([
      'source',
      'destination',
      'trigger',
      'pattern',
      'idempotency',
      'render',
    ]);
  });
  it('exports expected COMPOSITION_STATUSES', () => {
    expect(COMPOSITION_STATUSES).toEqual(['proposed', 'dry_run', 'materialized', 'retired']);
  });
});
