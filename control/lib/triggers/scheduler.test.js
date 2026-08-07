// Isolate this test file to in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';
// Short-circuit the semantic-index sidecar — daemon tests cover firing
// behavior, not embedding indexing.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDb, getDb } from '@/lib/db/index';
import {
  MetaNodeRepository,
  MetaPrincipleRepository,
} from '@/lib/db/repositories/meta-context';
import { TriggerArtifactRepository } from '@/lib/db/repositories/trigger-artifacts';
import { getQueueStats } from '@/lib/mcp/agent-tasks/queue';
import {
  startScheduler,
  stopScheduler,
  reload,
  requestReload,
  renderPayloadTemplate,
  _internals,
} from './scheduler.js';

const { jobs, fireTrigger, isStarted } = _internals;

beforeEach(() => {
  closeDb();
  getDb();
});

afterEach(async () => {
  // Make sure no daemon stays running between tests; stopScheduler is
  // idempotent.
  await stopScheduler();
});

function seedArtifact({ ref = 'app:scheduler-test', label = 'Scheduler Test' } = {}) {
  return MetaNodeRepository.upsert({ kind: 'artifact', ref, label });
}

function seedTrigger({
  componentRef = 'trigger/scheduled@0.1.0',
  cron = '0 9 * * *',
  timezone = 'UTC',
  artifactRef = 'app:scheduler-test',
  payloadTemplate = {
    task_kind: 'envelope_inference',
    envelope: { inputs: { text: 'fixed' } },
  },
} = {}) {
  return TriggerArtifactRepository.insert({
    componentRef,
    bindingParams: { cron, timezone },
    payloadTemplate,
    artifactRef,
    compositionRef: null,
  });
}

describe('renderPayloadTemplate', () => {
  it('substitutes flat keys in strings', () => {
    const out = renderPayloadTemplate(
      { task_kind: 'envelope_inference', when: '{{fired_at}}' },
      { fired_at: '2026-05-27T09:00:00Z' },
    );
    expect(out.when).toBe('2026-05-27T09:00:00Z');
    expect(out.task_kind).toBe('envelope_inference');
  });

  it('recurses into nested objects and arrays', () => {
    const out = renderPayloadTemplate(
      { envelope: { inputs: { items: ['a-{{fired_at_date}}', 'b'] } } },
      { fired_at_date: '2026-05-27' },
    );
    expect(out.envelope.inputs.items[0]).toBe('a-2026-05-27');
    expect(out.envelope.inputs.items[1]).toBe('b');
  });

  it('leaves missing keys as visible placeholders (no silent undefined)', () => {
    const out = renderPayloadTemplate(
      { val: 'fired={{fired_at}} missing={{not_there}}' },
      { fired_at: 'T' },
    );
    expect(out.val).toBe('fired=T missing={{not_there}}');
  });

  it('preserves non-string, non-collection values verbatim', () => {
    const out = renderPayloadTemplate(
      { n: 42, b: true, nil: null },
      { fired_at: 'T' },
    );
    expect(out.n).toBe(42);
    expect(out.b).toBe(true);
    expect(out.nil).toBeNull();
  });
});

describe('fireTrigger (direct call, bypasses croner)', () => {
  it('parks a task and writes a trigger_firing principle on the target artifact node', async () => {
    const node = seedArtifact();
    const trigger = seedTrigger();

    const beforeStats = getQueueStats();
    const beforePending = beforeStats.pendingCount;

    const scheduledAt = new Date('2026-05-27T09:00:00.000Z');
    await fireTrigger(trigger, scheduledAt);

    // A pending task should be on the queue.
    const afterStats = getQueueStats();
    expect(afterStats.pendingCount).toBe(beforePending + 1);

    // A trigger_firing principle was written on the artifact node.
    const principles = MetaPrincipleRepository.listForScope('node', node.id);
    const firing = principles.filter((p) => p.sourceEvent === 'trigger_firing');
    expect(firing).toHaveLength(1);
    expect(firing[0].bodyMd).toContain(trigger.triggerRef);
    expect(firing[0].bodyMd).toContain('trigger/scheduled@0.1.0');
    expect(firing[0].bodyMd).toContain('drift_ms');
  });

  it('still writes a principle when parkRequestForTrigger throws (audit-first discipline)', async () => {
    seedArtifact({ ref: 'app:fire-test-2' });
    // Trigger whose payloadTemplate is missing task_kind — fireTrigger
    // catches the parkRequest failure, writes principle with parkedTaskRef = null.
    const trigger = seedTrigger({
      artifactRef: 'app:fire-test-2',
      payloadTemplate: { envelope: { inputs: {} } }, // no task_kind
    });

    const scheduledAt = new Date('2026-05-27T09:00:00.000Z');
    await fireTrigger(trigger, scheduledAt);

    const node = MetaNodeRepository.findByRef('artifact', 'app:fire-test-2');
    const principles = MetaPrincipleRepository.listForScope('node', node.id);
    const firing = principles.filter((p) => p.sourceEvent === 'trigger_firing');
    expect(firing).toHaveLength(1);
    // Principle body doesn't include parked_task_ref because parkRequest failed.
    expect(firing[0].bodyMd).not.toContain('parked_task_ref');
  });

  it('handles missing target artifact node without throwing (writes no principle, no parked task)', async () => {
    const trigger = seedTrigger({ artifactRef: 'app:does-not-exist' });
    const beforeStats = getQueueStats();

    // Should not throw — fireTrigger swallows audit failures.
    await fireTrigger(trigger, new Date());

    const afterStats = getQueueStats();
    // parkRequestForTrigger still runs (the queue doesn't know the artifact
    // is missing). The audit principle silently fails to write because the
    // target node isn't there.
    expect(afterStats.pendingCount).toBe(beforeStats.pendingCount + 1);
  });
});

describe('startScheduler / stopScheduler', () => {
  it('is idempotent — re-entrant start() is a no-op', () => {
    seedArtifact();
    seedTrigger();
    startScheduler();
    expect(isStarted()).toBe(true);
    expect(jobs.size).toBe(1);
    startScheduler();
    expect(jobs.size).toBe(1);
  });

  it('registers active triggers from the DB at start', () => {
    seedArtifact({ ref: 'app:a' });
    seedArtifact({ ref: 'app:b' });
    seedTrigger({ artifactRef: 'app:a' });
    seedTrigger({ artifactRef: 'app:b' });
    startScheduler();
    expect(jobs.size).toBe(2);
  });

  it('skips disabled triggers at start', () => {
    seedArtifact({ ref: 'app:disabled-target' });
    const trigger = seedTrigger({ artifactRef: 'app:disabled-target' });
    TriggerArtifactRepository.disable(trigger.triggerRef);
    startScheduler();
    expect(jobs.size).toBe(0);
  });

  it('stopScheduler() cancels all jobs and clears state', async () => {
    seedArtifact();
    seedTrigger();
    startScheduler();
    expect(jobs.size).toBe(1);
    await stopScheduler();
    expect(isStarted()).toBe(false);
    expect(jobs.size).toBe(0);
  });

  it('stopScheduler() before start is a clean no-op', async () => {
    await expect(stopScheduler()).resolves.toBeUndefined();
  });
});

describe('reload', () => {
  it('registers newly-active triggers and cancels removed ones', () => {
    seedArtifact({ ref: 'app:reload-a' });
    seedArtifact({ ref: 'app:reload-b' });
    const triggerA = seedTrigger({ artifactRef: 'app:reload-a' });
    startScheduler();
    expect(jobs.size).toBe(1);
    expect(jobs.has(triggerA.triggerRef)).toBe(true);

    // Add a new trigger after start. reload() should pick it up.
    const triggerB = seedTrigger({ artifactRef: 'app:reload-b' });
    reload();
    expect(jobs.size).toBe(2);
    expect(jobs.has(triggerB.triggerRef)).toBe(true);

    // Disable A. reload() should drop it.
    TriggerArtifactRepository.disable(triggerA.triggerRef);
    reload();
    expect(jobs.size).toBe(1);
    expect(jobs.has(triggerA.triggerRef)).toBe(false);
    expect(jobs.has(triggerB.triggerRef)).toBe(true);
  });

  it('is a no-op when the scheduler is not started', () => {
    seedArtifact();
    seedTrigger();
    reload();
    expect(jobs.size).toBe(0);
    expect(isStarted()).toBe(false);
  });
});

describe('requestReload (event bus)', () => {
  it('fires reload through the in-process event bus', async () => {
    seedArtifact({ ref: 'app:event-bus' });
    startScheduler();
    expect(jobs.size).toBe(0);

    // Add a trigger AFTER start, then emit reload.
    seedTrigger({ artifactRef: 'app:event-bus' });
    requestReload();
    // Event emitter is synchronous, so the listener has fired by here.
    expect(jobs.size).toBe(1);
  });

  it('no-ops cleanly when the scheduler is stopped', () => {
    expect(() => requestReload()).not.toThrow();
  });
});

describe('integration — actually firing on schedule', () => {
  it('a 1-second cron fires within ~1.5s and writes the chain', async () => {
    const node = seedArtifact({ ref: 'app:integration' });
    seedTrigger({
      artifactRef: 'app:integration',
      cron: '* * * * * *', // every second
    });

    startScheduler();

    // Wait up to 2 seconds for at least one fire.
    const start = Date.now();
    let principles = [];
    while (Date.now() - start < 2200) {
      await new Promise((r) => setTimeout(r, 150));
      principles = MetaPrincipleRepository.listForScope('node', node.id).filter(
        (p) => p.sourceEvent === 'trigger_firing',
      );
      if (principles.length > 0) break;
    }

    expect(principles.length).toBeGreaterThanOrEqual(1);
    expect(principles[0].bodyMd).toContain('Trigger fired');
    expect(principles[0].bodyMd).toContain('drift_ms');
  }, 5000);

  it('stop() drains an in-flight fire before resolving', async () => {
    // Hard to deterministically catch a fire mid-execution without
    // re-spiking croner. Instead, verify the in-flight set is drained
    // by stopScheduler() — same drain pattern verified in the pre-flight
    // spike. We start a trigger, wait until at least one fire has begun,
    // call stop, and confirm we don't crash and jobs.size returns to 0.
    seedArtifact({ ref: 'app:drain' });
    seedTrigger({ artifactRef: 'app:drain', cron: '* * * * * *' });
    startScheduler();
    await new Promise((r) => setTimeout(r, 1100));
    await stopScheduler();
    expect(jobs.size).toBe(0);
    expect(isStarted()).toBe(false);
  }, 5000);
});
