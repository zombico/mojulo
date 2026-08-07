// Unit tests for the audit module's principle-body composers and writers.
// The inference path is already exercised end-to-end via
// agent-tasks.integration.test.js; this file pins the smaller pieces
// directly so a regression in body shape shows up without spinning up the
// full integration stack. Phase 1 only covers the trigger_firing composer
// (the inference composer's surface hasn't changed and stays covered by
// the integration tests).

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { MetaNodeRepository, MetaPrincipleRepository } from '@/lib/db/repositories/meta-context';
import { recordTriggerFiring, _internals } from './audit.js';

const { composeTriggerFiringPrincipleBody } = _internals;

beforeEach(() => {
  closeDb();
});

describe('composeTriggerFiringPrincipleBody', () => {
  it('renders the trigger ref, component ref, fired_at, and parked_task_ref', () => {
    const body = composeTriggerFiringPrincipleBody({
      triggerRef: 'trig_abcdef123456',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: '2026-05-27T09:00:00.142Z',
      parkedTaskRef: 'task_xyz',
      evidence: { scheduled_at: '2026-05-27T09:00:00.000Z', drift_ms: 142 },
    });
    expect(body).toContain('Trigger fired');
    expect(body).toContain('trig_abcdef123456');
    expect(body).toContain('trigger/scheduled@0.1.0');
    expect(body).toContain('2026-05-27T09:00:00.142Z');
    expect(body).toContain('task_xyz');
    expect(body).toContain('drift_ms');
  });

  it('omits the evidence block when evidence is empty or missing', () => {
    const withEmpty = composeTriggerFiringPrincipleBody({
      triggerRef: 'trig_x',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: 'T',
      parkedTaskRef: 'task_x',
      evidence: {},
    });
    expect(withEmpty).not.toContain('**Evidence:**');

    const withMissing = composeTriggerFiringPrincipleBody({
      triggerRef: 'trig_x',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: 'T',
      parkedTaskRef: 'task_x',
    });
    expect(withMissing).not.toContain('**Evidence:**');
  });

  it('omits the parked_task_ref line when not provided (cancellation / dry-run cases)', () => {
    const body = composeTriggerFiringPrincipleBody({
      triggerRef: 'trig_x',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: 'T',
    });
    expect(body).not.toContain('parked_task_ref');
  });
});

describe('recordTriggerFiring', () => {
  function seedArtifactNode(ref = 'app:firing-target', label = 'Firing Target') {
    return MetaNodeRepository.upsert({ kind: 'artifact', ref, label });
  }

  it('writes a trigger_firing principle on the target artifact node', () => {
    const node = seedArtifactNode();
    const result = recordTriggerFiring({
      artifactRef: 'app:firing-target',
      triggerRef: 'trig_abc',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: '2026-05-27T09:00:00.142Z',
      parkedTaskRef: 'task_abc',
      evidence: { scheduled_at: '2026-05-27T09:00:00.000Z', drift_ms: 142 },
    });
    expect(result.principle).not.toBeNull();
    expect(result.artifactNode.id).toBe(node.id);

    const principles = MetaPrincipleRepository.listForScope('node', node.id);
    const firing = principles.filter((p) => p.sourceEvent === 'trigger_firing');
    expect(firing).toHaveLength(1);
    expect(firing[0].bodyMd).toContain('trig_abc');
  });

  it('returns { principle: null, artifactNode: null } when the target node does not exist', () => {
    const result = recordTriggerFiring({
      artifactRef: 'app:does-not-exist',
      triggerRef: 'trig_x',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: 'T',
      parkedTaskRef: 'task_x',
    });
    expect(result.principle).toBeNull();
    expect(result.artifactNode).toBeNull();
  });

  it('chains alongside app_inference principles on the same node', () => {
    const node = seedArtifactNode('app:chain-target');
    recordTriggerFiring({
      artifactRef: 'app:chain-target',
      triggerRef: 'trig_chain',
      componentRef: 'trigger/scheduled@0.1.0',
      firedAt: '2026-05-27T09:00:00Z',
      parkedTaskRef: 'task_1',
    });
    // Simulate the fulfiller writing an app_inference principle next.
    MetaPrincipleRepository.insert({
      scope_kind: 'node',
      scope_id: node.id,
      body_md: '**App inference call** simulated',
      source_event: 'app_inference',
    });
    const principles = MetaPrincipleRepository.listForScope('node', node.id);
    const sourceEvents = principles.map((p) => p.sourceEvent);
    expect(sourceEvents).toContain('trigger_firing');
    expect(sourceEvents).toContain('app_inference');
  });
});
