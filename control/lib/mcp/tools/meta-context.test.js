// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { closeDb } from '@/lib/db/index';
import { DeploymentRepository } from '@/lib/db/repositories/deployments';
import {
  MetaContextRepository,
  MetaNodeRepository,
  MetaEdgeRepository,
  MetaPrincipleRepository,
} from '@/lib/db/repositories/meta-context';
import {
  briefHandler,
  commitHandler,
  commitOperatorKyc,
  commitArtifactMaterialization,
} from './meta-context.js';

let tmpRoot;
let existingArtifactPath;
const missingArtifactPath = '/tmp/__definitely-not-here__/__nope__.md';

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mojulo-meta-context-test-'));
  existingArtifactPath = join(tmpRoot, 'SKILL.md');
  writeFileSync(existingArtifactPath, '# stub');
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
});

// Helper: seed a real deployment row so artifact_materialization commits can
// resolve bot_ref via DeploymentRepository.findById.
async function seedDeployment({ id = 'dep-test', botName = 'Test Bot' } = {}) {
  // Insert directly so we can pin the id (DeploymentRepository.create
  // generates its own id via newId('dep')).
  const { getDb } = await import('@/lib/db/index');
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO deployments (id, bot_name, flow_type, status, config, api_key, document_ids, created_at, updated_at)
     VALUES (?, ?, 'modular', 'saved', ?, 'k', '[]', ?, ?)`,
  ).run(id, botName, '{}', now, now);
  return DeploymentRepository.findById(id);
}

// ---------------------------------------------------------------------------
// briefHandler
// ---------------------------------------------------------------------------

describe('briefHandler', () => {
  it('fleet scope on empty graph → meta.suggest_kyc: true', async () => {
    const out = await briefHandler({ scope: { kind: 'fleet' } });
    expect(out.nodes).toEqual([]);
    expect(out.meta.empty).toBe(true);
    expect(out.meta.suggest_kyc).toBe(true);
  });

  it('per-scope brief returns 1-hop neighborhood', async () => {
    const bot = MetaNodeRepository.upsert({ kind: 'bot', ref: 'dep-1', label: 'B' });
    const art = MetaNodeRepository.upsert({ kind: 'artifact', ref: 'cc:foo', label: 'Foo' });
    MetaEdgeRepository.upsert({ src_id: art.id, dst_id: bot.id, kind: 'runs_for' });

    const out = await briefHandler({ scope: { kind: 'bot', ref: 'dep-1' } });
    expect(out.nodes.map((n) => n.ref).sort()).toEqual(['cc:foo', 'dep-1']);
    expect(out.edges).toHaveLength(1);
  });

  it('rejects missing scope', async () => {
    await expect(briefHandler({})).rejects.toThrow(/scope is required/);
  });

  it('rejects unsupported scope.kind', async () => {
    await expect(briefHandler({ scope: { kind: 'mcp_tool', ref: 'x' } })).rejects.toThrow(
      /scope.kind must be one of/,
    );
    await expect(briefHandler({ scope: { kind: 'operator', ref: 'self' } })).rejects.toThrow(
      /scope.kind must be one of/,
    );
  });
});

// ---------------------------------------------------------------------------
// commitHandler — dispatch
// ---------------------------------------------------------------------------

describe('commitHandler — dispatch', () => {
  it('rejects unknown event types', async () => {
    await expect(commitHandler({ type: 'made_up_event' })).rejects.toThrow(
      /Unknown commit event type/,
    );
  });

  it('rejects a non-object input', async () => {
    await expect(commitHandler(null)).rejects.toThrow(/event object/);
    await expect(commitHandler('hello')).rejects.toThrow(/event object/);
  });
});

// ---------------------------------------------------------------------------
// commit: operator_kyc
// ---------------------------------------------------------------------------

describe('commitOperatorKyc', () => {
  it('happy path — creates operator node + principle, returns ids', async () => {
    const out = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'Agency owner serving dental practices',
      primary_goal: 'Convert dental leads to booked appointments',
      constraints: ['CRM is HubSpot', 'Connecting agent is Claude Code'],
    });
    expect(out.ok).toBe(true);
    expect(out.operatorNodeId).toBeGreaterThan(0);
    expect(out.principleId).toBeGreaterThan(0);
    expect(out.revised).toBe(false);

    // Re-brief shows the anchor; suggest_kyc is gone.
    const brief = await briefHandler({ scope: { kind: 'fleet' } });
    expect(brief.meta.suggest_kyc).toBeUndefined();
    expect(brief.nodes.find((n) => n.kind === 'operator')?.ref).toBe('self');
    expect(brief.principles).toHaveLength(1);
    expect(brief.principles[0].bodyMd).toMatch(/Agency owner/);
    expect(brief.principles[0].bodyMd).toMatch(/CRM is HubSpot/);
  });

  it('composes the principle body with role + primary_goal + constraints', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      primary_goal: 'pg',
      constraints: ['c1', 'c2'],
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    const [p] = MetaPrincipleRepository.listForScope('node', node.id);
    expect(p.bodyMd).toMatch(/\*\*Role:\*\* r/);
    expect(p.bodyMd).toMatch(/\*\*Primary goal:\*\* pg/);
    expect(p.bodyMd).toMatch(/- c1/);
    expect(p.bodyMd).toMatch(/- c2/);
  });

  it('omits the primary_goal line when not provided', async () => {
    await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
    });
    const node = MetaNodeRepository.findByRef('operator', 'self');
    const [p] = MetaPrincipleRepository.listForScope('node', node.id);
    expect(p.bodyMd).not.toMatch(/Primary goal/);
  });

  it('rejects missing role', async () => {
    await expect(
      commitOperatorKyc({ type: 'operator_kyc', constraints: ['x'] }),
    ).rejects.toThrow(/role/);
  });

  it('rejects empty constraints', async () => {
    await expect(
      commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: [] }),
    ).rejects.toThrow(/constraints/);
  });

  it('rejects non-string constraint entries', async () => {
    await expect(
      commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['ok', 42] }),
    ).rejects.toThrow(/non-empty string/);
  });

  it('second KYC without revise → soft rejection with existing_operator hint', async () => {
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r1', constraints: ['c1'] });
    const out = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r2',
      constraints: ['c2'],
    });
    expect(out.ok).toBe(false);
    expect(out.existing_operator).toBe(true);
    expect(out.reason).toBe('operator_anchor_already_exists');

    // Still only one principle attached.
    const node = MetaNodeRepository.findByRef('operator', 'self');
    expect(MetaPrincipleRepository.listForScope('node', node.id)).toHaveLength(1);
  });

  it('revise: true stacks a new principle on the same operator node', async () => {
    const first = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r1',
      constraints: ['c1'],
    });
    const second = await commitOperatorKyc({
      type: 'operator_kyc',
      role: 'r2',
      constraints: ['c2'],
      revise: true,
    });
    expect(second.ok).toBe(true);
    expect(second.operatorNodeId).toBe(first.operatorNodeId);
    expect(second.revised).toBe(true);
    expect(MetaPrincipleRepository.listForScope('node', first.operatorNodeId)).toHaveLength(2);

    // Operator label updates to the most recent role.
    const node = MetaNodeRepository.findById(first.operatorNodeId);
    expect(node.label).toBe('r2');
  });

  it('routes through the commit dispatcher correctly', async () => {
    const out = await commitHandler({
      type: 'operator_kyc',
      role: 'r',
      constraints: ['c1'],
    });
    expect(out.ok).toBe(true);
    expect(out.operatorNodeId).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// commit: artifact_materialization
// ---------------------------------------------------------------------------

function buildBaseMaterializationInput(overrides = {}) {
  return {
    type: 'artifact_materialization',
    adapter_id: 'claude-code',
    artifact: {
      locator: existingArtifactPath,
      label: 'Qualify Lead to CRM',
    },
    bot_ref: 'dep-test',
    catalyst_ref: 'qualify-lead-to-crm',
    bindings: [
      { mcp_tool: 'hubspot.create_contact', fields_bound: ['name', 'email', 'phone'] },
    ],
    principles: [
      {
        scope: 'artifact',
        body_md: 'Route qualified leads to HubSpot contacts.',
      },
      {
        scope: 'materialized_by',
        body_md: 'Materialized as Claude Code skill because clientInfo was claude-code.',
      },
    ],
    ...overrides,
  };
}

describe('commitArtifactMaterialization', () => {
  it('happy path — writes bot, adapter, catalyst, artifact, mcp_tool nodes + 4 edges + 2 principles', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Dental Front Desk' });

    const out = await commitArtifactMaterialization(buildBaseMaterializationInput());

    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
    expect(out.nodes.bot).toBeGreaterThan(0);
    expect(out.nodes.adapter).toBeGreaterThan(0);
    expect(out.nodes.catalyst).toBeGreaterThan(0);
    expect(out.nodes.artifact).toBeGreaterThan(0);
    expect(out.edges.seeded).toBeGreaterThan(0);
    expect(out.edges.materialized_by).toBeGreaterThan(0);
    expect(out.edges.runs_for).toBeGreaterThan(0);
    expect(out.edges.binds).toHaveLength(1);
    expect(out.edges.binds[0].mcp_tool).toBe('hubspot.create_contact');
    expect(out.principlesCreated).toBe(2);
    expect(out.verification.ok).toBe(true);
    expect(out.warnings).toContain('no_operator_anchor');
  });

  it('omits warnings when an operator anchor exists', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await commitOperatorKyc({ type: 'operator_kyc', role: 'r', constraints: ['c'] });
    const out = await commitArtifactMaterialization(buildBaseMaterializationInput());
    expect(out.warnings).toBeUndefined();
  });

  it('resolves catalyst label from the catalyst loader, falls back to ref', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await commitArtifactMaterialization(buildBaseMaterializationInput());
    const catalystNode = MetaNodeRepository.findByRef('catalyst', 'qualify-lead-to-crm');
    expect(catalystNode.label).not.toBe('qualify-lead-to-crm'); // it has a real name
    expect(catalystNode.label.length).toBeGreaterThan(0);

    // Unknown catalyst id → label falls back to the ref.
    await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        catalyst_ref: 'made-up-catalyst-that-does-not-exist',
        artifact: { locator: existingArtifactPath, label: 'Other' },
      }),
    );
    const fallback = MetaNodeRepository.findByRef('catalyst', 'made-up-catalyst-that-does-not-exist');
    expect(fallback.label).toBe('made-up-catalyst-that-does-not-exist');
  });

  it('stores artifact payload with adapter_id, locator, host', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await commitArtifactMaterialization(buildBaseMaterializationInput());
    const artifactNode = MetaNodeRepository.findByRef(
      'artifact',
      `claude-code:${existingArtifactPath}`,
    );
    expect(artifactNode.payload.adapter_id).toBe('claude-code');
    expect(artifactNode.payload.locator).toBe(existingArtifactPath);
    expect(artifactNode.payload.host).toBeTruthy();
  });

  it('binds edge carries fields_bound in its payload', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(buildBaseMaterializationInput());
    const edge = MetaEdgeRepository.findById(out.edges.binds[0].edgeId);
    expect(edge.payload).toEqual({ fields_bound: ['name', 'email', 'phone'] });
  });

  it('rejects unknown adapter_id', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({ adapter_id: 'not-a-real-adapter' }),
      ),
    ).rejects.toThrow(/Unknown adapter/);
    // No writes.
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it('rejects missing artifact.locator / label', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({ artifact: { label: 'X' } }),
      ),
    ).rejects.toThrow(/locator/);
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({ artifact: { locator: '/x' } }),
      ),
    ).rejects.toThrow(/label/);
  });

  it('rejects unknown bot_ref', async () => {
    await expect(
      commitArtifactMaterialization(buildBaseMaterializationInput({ bot_ref: 'nope' })),
    ).rejects.toThrow(/Unknown bot_ref/);
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it('rejects when verification fails — no DB writes', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          artifact: { locator: missingArtifactPath, label: 'Missing' },
        }),
      ),
    ).rejects.toThrow(/Artifact verification failed/);
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it('codex adapter with opaque locator accepts on assertion, surfaces note in response', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        adapter_id: 'codex',
        artifact: { locator: 'my-codex-automation-handle', label: 'Codex Auto' },
      }),
    );
    expect(out.ok).toBe(true);
    expect(out.verification.note).toBe('codex_accept_on_assertion');
  });

  it('re-committing the same materialization is idempotent on edges, stacks principles', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const first = await commitArtifactMaterialization(buildBaseMaterializationInput());
    const second = await commitArtifactMaterialization(buildBaseMaterializationInput());

    // Same node ids.
    expect(second.nodes.artifact).toBe(first.nodes.artifact);
    expect(second.nodes.catalyst).toBe(first.nodes.catalyst);
    expect(second.edges.seeded).toBe(first.edges.seeded);

    // Two principles per scope now.
    const artifactNode = MetaNodeRepository.findById(first.nodes.artifact);
    expect(MetaPrincipleRepository.listForScope('node', artifactNode.id)).toHaveLength(2);
  });

  it('rejects principle scope with no matching edge/node', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          principles: [{ scope: 'binds:never-bound-tool', body_md: 'x' }],
        }),
      ),
    ).rejects.toThrow(/no matching binding/);

    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          principles: [{ scope: 'made-up-scope', body_md: 'x' }],
        }),
      ),
    ).rejects.toThrow(/Unknown principle scope/);

    // No writes from the failed commits.
    expect(MetaContextRepository.brief({ kind: 'fleet' }).nodes).toHaveLength(0);
  });

  it("bare 'binds' principle fans out to every binding edge", async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        bindings: [
          { mcp_tool: 'hubspot.create_contact', fields_bound: ['email'] },
          { mcp_tool: 'hubspot.update_contact', fields_bound: ['phone'] },
        ],
        principles: [{ scope: 'binds', body_md: 'Common binding posture.' }],
      }),
    );
    expect(out.principlesCreated).toBe(2);
    for (const { edgeId } of out.edges.binds) {
      expect(MetaPrincipleRepository.listForScope('edge', edgeId)).toHaveLength(1);
    }
  });

  it("binds:<ref> targets a specific binding edge only", async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitArtifactMaterialization(
      buildBaseMaterializationInput({
        bindings: [
          { mcp_tool: 'hubspot.create_contact', fields_bound: ['email'] },
          { mcp_tool: 'hubspot.update_contact', fields_bound: ['phone'] },
        ],
        principles: [
          { scope: 'binds:hubspot.create_contact', body_md: 'Just the create edge.' },
        ],
      }),
    );
    expect(out.principlesCreated).toBe(1);
    const createEdge = out.edges.binds.find((e) => e.mcp_tool === 'hubspot.create_contact');
    const updateEdge = out.edges.binds.find((e) => e.mcp_tool === 'hubspot.update_contact');
    expect(MetaPrincipleRepository.listForScope('edge', createEdge.edgeId)).toHaveLength(1);
    expect(MetaPrincipleRepository.listForScope('edge', updateEdge.edgeId)).toHaveLength(0);
  });

  it('rejects principle missing body_md', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    await expect(
      commitArtifactMaterialization(
        buildBaseMaterializationInput({
          principles: [{ scope: 'artifact' }],
        }),
      ),
    ).rejects.toThrow(/body_md/);
  });

  it('per-bot brief after commit returns the artifact and edges', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Dental Front Desk' });
    await commitArtifactMaterialization(buildBaseMaterializationInput());

    const brief = await briefHandler({ scope: { kind: 'bot', ref: 'dep-test' } });
    expect(brief.nodes.find((n) => n.kind === 'bot')?.label).toBe('Dental Front Desk');
    expect(brief.nodes.find((n) => n.kind === 'artifact')).toBeTruthy();
    expect(brief.edges.find((e) => e.kind === 'runs_for')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// commitHandler routing
// ---------------------------------------------------------------------------

describe('commitHandler — routes artifact_materialization', () => {
  it('end-to-end through the dispatcher', async () => {
    await seedDeployment({ id: 'dep-test', botName: 'Bot' });
    const out = await commitHandler(buildBaseMaterializationInput());
    expect(out.ok).toBe(true);
    expect(out.artifactNodeId).toBeGreaterThan(0);
  });
});
