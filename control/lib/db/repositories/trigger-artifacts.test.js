// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js. Vitest workers isolate sibling files so this
// doesn't leak.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '../index.js';
import {
  TriggerArtifactRepository,
  _internals as triggerInternals,
} from './trigger-artifacts.js';

beforeEach(() => {
  closeDb();
});

function baseInsert(overrides = {}) {
  return TriggerArtifactRepository.insert({
    componentRef: 'trigger/scheduled@0.1.0',
    bindingParams: { cron: '0 9 * * *', timezone: 'UTC' },
    payloadTemplate: { task_kind: 'envelope_inference', envelope: { inputs: {} } },
    artifactRef: 'artifact:test-app',
    ...overrides,
  });
}

describe('schema bootstraps', () => {
  it('creates mcp_orbit_trigger_artifacts and its indexes', () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'mcp_orbit_trigger_artifacts'",
      )
      .all();
    expect(tables).toHaveLength(1);
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_mcp_orbit_trigger_artifacts_%'",
      )
      .all()
      .map((r) => r.name)
      .sort();
    expect(indexes).toEqual([
      'idx_mcp_orbit_trigger_artifacts_component',
      'idx_mcp_orbit_trigger_artifacts_current',
    ]);
  });
});

describe('generateRef', () => {
  it('mints trig_<12 hex chars>', () => {
    const ref = triggerInternals.generateRef();
    expect(ref).toMatch(/^trig_[a-f0-9]{12}$/);
  });

  it('is unique across calls', () => {
    const refs = new Set();
    for (let i = 0; i < 100; i++) refs.add(triggerInternals.generateRef());
    expect(refs.size).toBe(100);
  });
});

describe('insert', () => {
  it('inserts a row and returns the parsed shape', () => {
    const trigger = baseInsert();
    expect(trigger.triggerRef).toMatch(/^trig_[a-f0-9]{12}$/);
    expect(trigger.componentRef).toBe('trigger/scheduled@0.1.0');
    expect(trigger.bindingParams).toEqual({ cron: '0 9 * * *', timezone: 'UTC' });
    expect(trigger.payloadTemplate.task_kind).toBe('envelope_inference');
    expect(trigger.artifactRef).toBe('artifact:test-app');
    expect(trigger.compositionRef).toBeNull();
    expect(trigger.enabled).toBe(true);
    expect(trigger.supersededBy).toBeNull();
    expect(typeof trigger.createdAt).toBe('number');
  });

  it('accepts a compositionRef alongside artifactRef', () => {
    const trigger = baseInsert({ compositionRef: 'comp_xyz' });
    expect(trigger.compositionRef).toBe('comp_xyz');
    expect(trigger.artifactRef).toBe('artifact:test-app');
  });

  it('rejects missing componentRef', () => {
    expect(() => TriggerArtifactRepository.insert({})).toThrow(/componentRef is required/);
  });

  it('rejects non-object bindingParams', () => {
    expect(() =>
      TriggerArtifactRepository.insert({
        componentRef: 'trigger/scheduled@0.1.0',
        bindingParams: 'cron-string',
        payloadTemplate: {},
      }),
    ).toThrow(/bindingParams must be an object/);
  });

  it('rejects array bindingParams', () => {
    expect(() =>
      TriggerArtifactRepository.insert({
        componentRef: 'trigger/scheduled@0.1.0',
        bindingParams: [],
        payloadTemplate: {},
      }),
    ).toThrow(/bindingParams must be an object/);
  });

  it('rejects non-object payloadTemplate', () => {
    expect(() =>
      TriggerArtifactRepository.insert({
        componentRef: 'trigger/scheduled@0.1.0',
        bindingParams: {},
        payloadTemplate: 'string',
      }),
    ).toThrow(/payloadTemplate must be an object/);
  });

  it('enforces the unique partial index on (composition_ref, artifact_ref, component_ref) for active rows', () => {
    baseInsert({ artifactRef: 'artifact:same-target', compositionRef: 'comp_x' });
    expect(() =>
      baseInsert({ artifactRef: 'artifact:same-target', compositionRef: 'comp_x' }),
    ).toThrow(/UNIQUE constraint/);
  });

  it('allows two triggers against the same target after the first is disabled', () => {
    const first = baseInsert({ artifactRef: 'artifact:rebind-target' });
    TriggerArtifactRepository.disable(first.triggerRef);
    // Second insert succeeds because the unique partial index excludes
    // rows where enabled = 0.
    const second = baseInsert({ artifactRef: 'artifact:rebind-target' });
    expect(second.triggerRef).not.toBe(first.triggerRef);
  });

  it('rejects two NULL-target bindings with the same component_ref via COALESCE in the unique index', () => {
    // The index expression COALESCEs NULL refs to '' so the tuple comparison
    // catches duplicates even when both refs are unset. Two "no target"
    // bindings of the same kind are the same logical binding; the operator
    // must unbind one before creating another.
    baseInsert({ artifactRef: null });
    expect(() => baseInsert({ artifactRef: null })).toThrow(/UNIQUE constraint/);
  });
});

describe('getByRef', () => {
  it('returns the parsed row by trigger_ref', () => {
    const inserted = baseInsert();
    const fetched = TriggerArtifactRepository.getByRef(inserted.triggerRef);
    expect(fetched.triggerRef).toBe(inserted.triggerRef);
    expect(fetched.componentRef).toBe('trigger/scheduled@0.1.0');
  });

  it('returns null for unknown ref', () => {
    expect(TriggerArtifactRepository.getByRef('trig_does_not_exist')).toBeNull();
  });

  it('returns null for non-string ref', () => {
    expect(TriggerArtifactRepository.getByRef(undefined)).toBeNull();
    expect(TriggerArtifactRepository.getByRef('')).toBeNull();
  });
});

describe('listActive', () => {
  it('returns only enabled + non-superseded rows, oldest-first', async () => {
    const a = baseInsert({ artifactRef: 'artifact:list-a' });
    // Tiny delay to ensure distinct created_at values (unixepoch is second-grained).
    await new Promise((r) => setTimeout(r, 1100));
    const b = baseInsert({ artifactRef: 'artifact:list-b' });
    const disabled = baseInsert({ artifactRef: 'artifact:list-disabled' });
    TriggerArtifactRepository.disable(disabled.triggerRef);

    const active = TriggerArtifactRepository.listActive();
    const refs = active.map((t) => t.triggerRef);
    expect(refs).toContain(a.triggerRef);
    expect(refs).toContain(b.triggerRef);
    expect(refs).not.toContain(disabled.triggerRef);
    // Oldest first (created_at ASC).
    expect(refs.indexOf(a.triggerRef)).toBeLessThan(refs.indexOf(b.triggerRef));
  });

  it('filters by componentRef', () => {
    baseInsert({ componentRef: 'trigger/scheduled@0.1.0', artifactRef: 'a:1' });
    baseInsert({ componentRef: 'trigger/webhook@0.1.0', artifactRef: 'a:2' });
    const sched = TriggerArtifactRepository.listActive({
      componentRef: 'trigger/scheduled@0.1.0',
    });
    expect(sched).toHaveLength(1);
    expect(sched[0].artifactRef).toBe('a:1');
  });

  it('filters by artifactRef', () => {
    baseInsert({ artifactRef: 'a:target' });
    baseInsert({ artifactRef: 'a:other' });
    const out = TriggerArtifactRepository.listActive({ artifactRef: 'a:target' });
    expect(out).toHaveLength(1);
    expect(out[0].artifactRef).toBe('a:target');
  });

  it('returns empty array when nothing matches', () => {
    expect(TriggerArtifactRepository.listActive({ artifactRef: 'a:nope' })).toEqual([]);
  });
});

describe('disable', () => {
  it('soft-deletes a trigger and returns true when a row was updated', () => {
    const trigger = baseInsert();
    expect(TriggerArtifactRepository.disable(trigger.triggerRef)).toBe(true);
    const after = TriggerArtifactRepository.getByRef(trigger.triggerRef);
    expect(after.enabled).toBe(false);
  });

  it('returns false for already-disabled triggers', () => {
    const trigger = baseInsert();
    TriggerArtifactRepository.disable(trigger.triggerRef);
    expect(TriggerArtifactRepository.disable(trigger.triggerRef)).toBe(false);
  });

  it('returns false for unknown refs', () => {
    expect(TriggerArtifactRepository.disable('trig_nonexistent')).toBe(false);
  });
});
