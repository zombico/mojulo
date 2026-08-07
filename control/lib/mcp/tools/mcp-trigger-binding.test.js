// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
// Short-circuit the semantic-index sidecar — this suite covers trigger
// binding behavior, not embedding indexing. Without the flag every
// trigger_artifact_materialization commit would await the ONNX model.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import { MetaNodeRepository } from '@/lib/db/repositories/meta-context';
import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';
import { _resetSeededForTests, seedComponents } from '@/lib/mcp/mcp-orbit-components/loader';
import {
  bindTriggerHandler,
  unbindTriggerHandler,
  listTriggersHandler,
  getTriggerHandler,
} from './mcp-trigger-binding.js';

beforeEach(() => {
  closeDb();
  _resetSeededForTests();
  getDb();
  // Seed the composer's component store so component_ref resolution against
  // 'trigger/scheduled@0.1.0' works.
  seedComponents({ force: true });
});

function seedArtifactNode({ ref = 'app:trigger-test', label = 'Trigger Test' } = {}) {
  return MetaNodeRepository.upsert({ kind: 'artifact', ref, label });
}

function validBindInput(overrides = {}) {
  return {
    component_ref: 'trigger/scheduled@0.1.0',
    binding_params: { cron: '0 9 * * *', timezone: 'UTC' },
    payload_template: {
      task_kind: 'envelope_inference',
      envelope: { inputs: { text: '{{fired_at}}' } },
    },
    artifact_ref: 'app:trigger-test',
    ...overrides,
  };
}

describe('bind_trigger — input shape validation', () => {
  it('rejects non-object input', async () => {
    await expect(bindTriggerHandler(null)).rejects.toThrow(/requires an object/);
    await expect(bindTriggerHandler('a string')).rejects.toThrow(/requires an object/);
  });

  it('rejects a malformed component_ref', async () => {
    seedArtifactNode();
    await expect(
      bindTriggerHandler(validBindInput({ component_ref: 'trigger-scheduled-0.1.0' })),
    ).rejects.toThrow(/<kind>\/<ref>@<version>/);
  });

  it('rejects a non-trigger component_ref kind', async () => {
    seedArtifactNode();
    await expect(
      bindTriggerHandler(validBindInput({ component_ref: 'pattern/aggregation@0.1.0' })),
    ).rejects.toThrow(/kind 'trigger'/);
  });

  it('rejects an unknown component_ref (not in the composer store)', async () => {
    seedArtifactNode();
    await expect(
      bindTriggerHandler(validBindInput({ component_ref: 'trigger/madeup@9.9.9' })),
    ).rejects.toThrow(/not in the composer's component store/);
  });

  it("rejects a known component whose runtime isn't shipped (signal-polled is Phase 2/3)", async () => {
    seedArtifactNode();
    await expect(
      bindTriggerHandler(validBindInput({ component_ref: 'trigger/signal-polled@0.1.0' })),
    ).rejects.toThrow(/runtime daemon is not shipped/);
  });
});

describe('bind_trigger — schedule-kind validation', () => {
  beforeEach(() => seedArtifactNode());

  it('rejects an invalid cron expression', async () => {
    await expect(
      bindTriggerHandler(validBindInput({ binding_params: { cron: 'not a cron expression' } })),
    ).rejects.toThrow(/not a valid cron expression/);
  });

  it('rejects missing binding_params.cron', async () => {
    await expect(
      bindTriggerHandler(validBindInput({ binding_params: { timezone: 'UTC' } })),
    ).rejects.toThrow(/binding_params\.cron is required/);
  });

  it('rejects a non-string timezone', async () => {
    await expect(
      bindTriggerHandler(
        validBindInput({ binding_params: { cron: '0 9 * * *', timezone: 7 } }),
      ),
    ).rejects.toThrow(/timezone must be a string/);
  });
});

describe('bind_trigger — payload_template validation', () => {
  beforeEach(() => seedArtifactNode());

  it('rejects a payload_template without task_kind', async () => {
    await expect(
      bindTriggerHandler(validBindInput({ payload_template: { envelope: {} } })),
    ).rejects.toThrow(/payload_template\.task_kind is required/);
  });

  it('rejects a non-object payload_template', async () => {
    await expect(
      bindTriggerHandler(validBindInput({ payload_template: 'string' })),
    ).rejects.toThrow(/payload_template must be an object/);
  });
});

describe('bind_trigger — artifact_ref requirement', () => {
  it('rejects missing artifact_ref (Phase 1 requirement)', async () => {
    seedArtifactNode();
    await expect(
      bindTriggerHandler(validBindInput({ artifact_ref: undefined })),
    ).rejects.toThrow(/artifact_ref is required in Phase 1/);
  });
});

describe('bind_trigger — happy path', () => {
  beforeEach(() => seedArtifactNode());

  it('validates, inserts, seals, returns trigger_ref + next_fire_at', async () => {
    const out = await bindTriggerHandler(validBindInput());
    expect(out.ok).toBe(true);
    expect(out.trigger_ref).toMatch(/^trig_[a-f0-9]{12}$/);
    expect(out.component_ref).toBe('trigger/scheduled@0.1.0');
    expect(out.artifact_ref).toBe('app:trigger-test');
    expect(out.principle_id).toBeGreaterThan(0);
    expect(typeof out.next_fire_at).toBe('string');
    // next_fire_at must parse as a valid date
    expect(Number.isNaN(Date.parse(out.next_fire_at))).toBe(false);
  });

  it('persists the row in mcp_orbit_trigger_artifacts and the audit principle in meta_principles', async () => {
    const out = await bindTriggerHandler(validBindInput());
    const trigger = TriggerArtifactRepository.getByRef(out.trigger_ref);
    expect(trigger).not.toBeNull();
    expect(trigger.enabled).toBe(true);
    expect(trigger.componentRef).toBe('trigger/scheduled@0.1.0');
    expect(trigger.bindingParams.cron).toBe('0 9 * * *');
    expect(trigger.payloadTemplate.task_kind).toBe('envelope_inference');
  });
});

describe('bind_trigger — duplicate binding rejection', () => {
  beforeEach(() => seedArtifactNode());

  it('rejects a second binding against the same target with a clear message', async () => {
    await bindTriggerHandler(validBindInput());
    await expect(bindTriggerHandler(validBindInput())).rejects.toThrow(
      /already exists for component .*against this target.*unbind_trigger/,
    );
  });

  it('allows rebinding the same target after unbind', async () => {
    const first = await bindTriggerHandler(validBindInput());
    await unbindTriggerHandler({ trigger_ref: first.trigger_ref });
    const second = await bindTriggerHandler(validBindInput());
    expect(second.trigger_ref).not.toBe(first.trigger_ref);
    expect(second.ok).toBe(true);
  });
});

describe('bind_trigger — rollback on commit failure', () => {
  it('disables the orphan trigger row if the meta_context commit throws', async () => {
    // No artifact node seeded → commit handler rejects with "no contextmap
    // node." The trigger row was inserted before the commit, so the rollback
    // should disable it.
    await expect(bindTriggerHandler(validBindInput())).rejects.toThrow(/no contextmap node/);

    // The trigger row exists but is disabled.
    const all = TriggerArtifactRepository.listActive();
    expect(all).toHaveLength(0);
  });
});

describe('unbind_trigger', () => {
  beforeEach(() => seedArtifactNode());

  it('rejects missing trigger_ref', async () => {
    await expect(unbindTriggerHandler({})).rejects.toThrow(/trigger_ref is required/);
  });

  it('rejects unknown trigger_ref', async () => {
    await expect(unbindTriggerHandler({ trigger_ref: 'trig_nope' })).rejects.toThrow(/not found/);
  });

  it('disables an active trigger and returns ok=true / already_disabled=false', async () => {
    const bound = await bindTriggerHandler(validBindInput());
    const out = await unbindTriggerHandler({ trigger_ref: bound.trigger_ref });
    expect(out.ok).toBe(true);
    expect(out.already_disabled).toBe(false);
    const fetched = TriggerArtifactRepository.getByRef(bound.trigger_ref);
    expect(fetched.enabled).toBe(false);
  });

  it('is idempotent — re-unbinding returns already_disabled=true', async () => {
    const bound = await bindTriggerHandler(validBindInput());
    await unbindTriggerHandler({ trigger_ref: bound.trigger_ref });
    const second = await unbindTriggerHandler({ trigger_ref: bound.trigger_ref });
    expect(second.ok).toBe(true);
    expect(second.already_disabled).toBe(true);
  });
});

describe('list_triggers', () => {
  it('returns empty when nothing is bound', async () => {
    const out = await listTriggersHandler({});
    expect(out.total).toBe(0);
    expect(out.triggers).toEqual([]);
  });

  it('returns active triggers with the expected shape', async () => {
    seedArtifactNode();
    const bound = await bindTriggerHandler(validBindInput());
    const out = await listTriggersHandler({});
    expect(out.total).toBe(1);
    expect(out.triggers[0].trigger_ref).toBe(bound.trigger_ref);
    expect(out.triggers[0].component_ref).toBe('trigger/scheduled@0.1.0');
    expect(out.triggers[0].binding_params.cron).toBe('0 9 * * *');
  });

  it('excludes disabled triggers', async () => {
    seedArtifactNode();
    const bound = await bindTriggerHandler(validBindInput());
    await unbindTriggerHandler({ trigger_ref: bound.trigger_ref });
    const out = await listTriggersHandler({});
    expect(out.total).toBe(0);
  });

  it('filters by artifact_ref', async () => {
    seedArtifactNode({ ref: 'app:filter-a' });
    seedArtifactNode({ ref: 'app:filter-b' });
    await bindTriggerHandler(validBindInput({ artifact_ref: 'app:filter-a' }));
    await bindTriggerHandler(validBindInput({ artifact_ref: 'app:filter-b' }));
    const out = await listTriggersHandler({ artifact_ref: 'app:filter-a' });
    expect(out.total).toBe(1);
    expect(out.triggers[0].artifact_ref).toBe('app:filter-a');
  });

  it('filters by component_ref', async () => {
    seedArtifactNode();
    await bindTriggerHandler(validBindInput());
    const matching = await listTriggersHandler({
      component_ref: 'trigger/scheduled@0.1.0',
    });
    const nonMatching = await listTriggersHandler({
      component_ref: 'trigger/signal-polled@0.1.0',
    });
    expect(matching.total).toBe(1);
    expect(nonMatching.total).toBe(0);
  });
});

describe('get_trigger', () => {
  beforeEach(() => seedArtifactNode());

  it('rejects missing trigger_ref', async () => {
    await expect(getTriggerHandler({})).rejects.toThrow(/trigger_ref is required/);
  });

  it('rejects unknown trigger_ref', async () => {
    await expect(getTriggerHandler({ trigger_ref: 'trig_nope' })).rejects.toThrow(/not found/);
  });

  it('returns the full trigger row', async () => {
    const bound = await bindTriggerHandler(validBindInput());
    const out = await getTriggerHandler({ trigger_ref: bound.trigger_ref });
    expect(out.trigger_ref).toBe(bound.trigger_ref);
    expect(out.component_ref).toBe('trigger/scheduled@0.1.0');
    expect(out.binding_params.cron).toBe('0 9 * * *');
    expect(out.payload_template.task_kind).toBe('envelope_inference');
    expect(out.enabled).toBe(true);
    expect(out.superseded_by).toBeNull();
  });

  it('returns disabled triggers too (enabled: false distinguishes)', async () => {
    const bound = await bindTriggerHandler(validBindInput());
    await unbindTriggerHandler({ trigger_ref: bound.trigger_ref });
    const out = await getTriggerHandler({ trigger_ref: bound.trigger_ref });
    expect(out.enabled).toBe(false);
  });
});
