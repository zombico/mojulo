// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import {
  ProviderArtifactRepository,
  _internals as providerArtifactInternals,
} from './mcp-orbit-provider-artifacts.js';

beforeEach(() => {
  closeDb();
});

function baseInsert(overrides = {}) {
  return ProviderArtifactRepository.insert({
    primitiveRef: 'document-store@0.1.0',
    role: 'source',
    server: 'claude_ai_Google_Drive',
    introspectedAt: '2026-05-24T18:00:00Z',
    snapshotConfidence: 'tools_list_full',
    bodyMd: '# Provider artifact\n\nbody.',
    manifest: { bound: [], unbound: [], declaredCount: 0 },
    bindings: {},
    ...overrides,
  });
}

describe('schema bootstraps', () => {
  it('creates mcp_orbit_provider_artifacts and its indexes', () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'mcp_orbit_provider_artifacts'",
      )
      .all();
    expect(tables).toHaveLength(1);
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_mcp_orbit_provider_artifacts_%'",
      )
      .all()
      .map((r) => r.name)
      .sort();
    expect(indexes).toEqual([
      'idx_mcp_orbit_provider_artifacts_primitive',
      'idx_mcp_orbit_provider_artifacts_server',
    ]);
  });

  it('enforces the role CHECK constraint at the DB layer', () => {
    const db = getDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO mcp_orbit_provider_artifacts
             (ref, primitive_ref, role, server, body_md, manifest_json, bindings_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('prov_x', 'p@0.1', 'sideways', 's', 'b', '{}', '{}'),
    ).toThrow(/CHECK constraint failed/);
  });

  it('enforces UNIQUE(ref) at the DB layer', () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO mcp_orbit_provider_artifacts
         (ref, primitive_ref, role, server, body_md, manifest_json, bindings_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('prov_dup', 'p@0.1', 'source', 's', 'b', '{}', '{}');
    expect(() =>
      db
        .prepare(
          `INSERT INTO mcp_orbit_provider_artifacts
             (ref, primitive_ref, role, server, body_md, manifest_json, bindings_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run('prov_dup', 'p@0.1', 'source', 's', 'b', '{}', '{}'),
    ).toThrow(/UNIQUE constraint failed/);
  });
});

describe('ProviderArtifactRepository.insert', () => {
  it('inserts a row and returns the generated ref + parsed JSON fields', () => {
    const row = baseInsert({
      bodyMd: '# body',
      manifest: { bound: [{ affordance: 'a', tool: 't', confidence: 'agent-inferred' }], unbound: [], declaredCount: 1 },
      bindings: { a: { tool: 't', confidence: 'agent-inferred' } },
    });
    expect(row.ref).toMatch(/^prov_[a-f0-9]{12}$/);
    expect(row.primitiveRef).toBe('document-store@0.1.0');
    expect(row.role).toBe('source');
    expect(row.server).toBe('claude_ai_Google_Drive');
    expect(row.bodyMd).toBe('# body');
    expect(row.manifest.bound).toHaveLength(1);
    expect(row.bindings).toEqual({ a: { tool: 't', confidence: 'agent-inferred' } });
    expect(typeof row.introspectedAt).toBe('number'); // stored as unix seconds
  });

  it('converts ISO introspectedAt strings into unix seconds', () => {
    const row = baseInsert({ introspectedAt: '2026-05-24T18:00:00Z' });
    const expected = Math.floor(Date.parse('2026-05-24T18:00:00Z') / 1000);
    expect(row.introspectedAt).toBe(expected);
  });

  it('accepts numeric introspectedAt as unix seconds', () => {
    const row = baseInsert({ introspectedAt: 1700000000 });
    expect(row.introspectedAt).toBe(1700000000);
  });

  it('stores null introspectedAt when missing', () => {
    const row = baseInsert({ introspectedAt: null });
    expect(row.introspectedAt).toBeNull();
  });

  it('rejects unknown roles', () => {
    expect(() => baseInsert({ role: 'sideways' })).toThrow(/role must be one of/);
  });

  it('requires primitiveRef, server, bodyMd, manifest, bindings', () => {
    expect(() => baseInsert({ primitiveRef: '' })).toThrow(/primitiveRef/);
    expect(() => baseInsert({ server: '' })).toThrow(/server/);
    expect(() => baseInsert({ bodyMd: '' })).toThrow(/bodyMd/);
    expect(() => baseInsert({ manifest: null })).toThrow(/manifest/);
    expect(() => baseInsert({ bindings: null })).toThrow(/bindings/);
  });

  it('generates collision-resistant refs across many inserts', () => {
    const refs = new Set();
    for (let i = 0; i < 100; i++) refs.add(baseInsert().ref);
    expect(refs.size).toBe(100);
  });
});

describe('ProviderArtifactRepository.findByRef', () => {
  it('returns null for unknown refs', () => {
    expect(ProviderArtifactRepository.findByRef('prov_nope')).toBeNull();
    expect(ProviderArtifactRepository.findByRef('')).toBeNull();
    expect(ProviderArtifactRepository.findByRef(null)).toBeNull();
  });

  it('returns the inserted row by ref', () => {
    const inserted = baseInsert({ bodyMd: '# look up me' });
    const found = ProviderArtifactRepository.findByRef(inserted.ref);
    expect(found).not.toBeNull();
    expect(found.bodyMd).toBe('# look up me');
    expect(found.ref).toBe(inserted.ref);
  });
});

describe('ProviderArtifactRepository.listForServer', () => {
  it('returns most-recent first', () => {
    const a = baseInsert({ server: 'srv-A', bodyMd: 'A1' });
    const b = baseInsert({ server: 'srv-A', bodyMd: 'A2' });
    baseInsert({ server: 'srv-B', bodyMd: 'B1' });
    const list = ProviderArtifactRepository.listForServer('srv-A');
    expect(list).toHaveLength(2);
    expect(list[0].ref).toBe(b.ref);
    expect(list[1].ref).toBe(a.ref);
  });

  it('returns empty for unknown server', () => {
    expect(ProviderArtifactRepository.listForServer('nope')).toEqual([]);
    expect(ProviderArtifactRepository.listForServer('')).toEqual([]);
  });
});

describe('ProviderArtifactRepository.listForPrimitiveAndRole', () => {
  it('filters by both primitive ref and role', () => {
    baseInsert({ primitiveRef: 'document-store@0.1.0', role: 'source', server: 's1' });
    baseInsert({ primitiveRef: 'document-store@0.1.0', role: 'destination', server: 's1' });
    baseInsert({ primitiveRef: 'issue-tracker@0.1.0', role: 'source', server: 's2' });
    const list = ProviderArtifactRepository.listForPrimitiveAndRole(
      'document-store@0.1.0',
      'source',
    );
    expect(list).toHaveLength(1);
    expect(list[0].server).toBe('s1');
    expect(list[0].role).toBe('source');
  });

  it('returns empty for unknown primitive or invalid role', () => {
    baseInsert();
    expect(ProviderArtifactRepository.listForPrimitiveAndRole('no@0.1', 'source')).toEqual([]);
    expect(ProviderArtifactRepository.listForPrimitiveAndRole('document-store@0.1.0', 'sideways')).toEqual([]);
  });
});

describe('_internals', () => {
  it('generateRef matches the prov_<12-hex> shape', () => {
    const ref = providerArtifactInternals.generateRef();
    expect(ref).toMatch(/^prov_[a-f0-9]{12}$/);
  });
});
